import assert from "node:assert/strict";
import test from "node:test";
import { chromium } from "playwright";
import {
  calculatorUrlForService,
  defaultCalculatorFormRoot,
  dismissCalculatorOverlays,
} from "./huawei-ecs-calculator-options.js";
import {
  applyCalculatorFormAction,
  calculatorFormSignature,
  extractCalculatorFormControls,
} from "./huawei-calculator-form-state.js";

const LIVE = process.env.HUAWEI_LIVE_TEST === "1";

const IGNORE = new Set(["Region", "AZ", "Sub-AZ"]);

function findSpecLikeSelect(
  controls: Awaited<ReturnType<typeof extractCalculatorFormControls>>,
) {
  return controls.find(
    (c) => c.kind === "select" && c.options.some((o) => /vcpu|vcpus|gb/i.test(o)),
  );
}

test(
  "live RDS: HA read replica removes General-purpose from DB Instance Class",
  { skip: !LIVE, timeout: 180_000 },
  async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    try {
      await page.goto(calculatorUrlForService("rds"), {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await page.getByRole("tab", { name: "Price Calculator" }).waitFor({ timeout: 90_000 });
      await dismissCalculatorOverlays(page);
      await defaultCalculatorFormRoot(page).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(500);

      let controls = await extractCalculatorFormControls(page, {
        ignoreLabels: IGNORE,
        includeSingletonButtonGroups: true,
      });
      const typeRow = controls.find((c) => c.label === "DB Instance Type");
      assert.ok(typeRow, "expected DB Instance Type row");
      await applyCalculatorFormAction(page, {
        rowIndex: typeRow.rowIndex,
        kind: "button-group",
        label: typeRow.label,
        option: "HA read replica",
      });

      controls = await extractCalculatorFormControls(page, {
        ignoreLabels: IGNORE,
        includeSingletonButtonGroups: true,
      });
      const classRow = controls.find((c) => c.label === "DB Instance Class");
      assert.ok(classRow, "expected DB Instance Class row after HA read replica");
      const hasGP = classRow.options.some((o) => /general-purpose|general purpose/i.test(o));
      assert.equal(
        hasGP,
        false,
        "General-purpose should not be offered when HA read replica is selected",
      );
    } finally {
      await browser.close();
    }
  },
);

test(
  "live RDS: switching DB Instance Class changes instance specification select options",
  { skip: !LIVE, timeout: 180_000 },
  async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    try {
      await page.goto(calculatorUrlForService("rds"), {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await page.getByRole("tab", { name: "Price Calculator" }).waitFor({ timeout: 90_000 });
      await dismissCalculatorOverlays(page);
      await defaultCalculatorFormRoot(page).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(500);

      const controlsA = await extractCalculatorFormControls(page, {
        ignoreLabels: IGNORE,
        includeSingletonButtonGroups: true,
      });
      const sigA = calculatorFormSignature(controlsA);
      const specA = findSpecLikeSelect(controlsA);
      assert.ok(specA, "expected a vCPU-style specification select");

      const classRow = controlsA.find((c) => c.label === "DB Instance Class");
      assert.ok(classRow, "expected DB Instance Class row");
      const target =
        classRow.current === "Dedicated" ? "General-purpose" : "Dedicated";
      assert.ok(
        classRow.options.includes(target),
        `class row should expose ${target} for this test`,
      );

      await applyCalculatorFormAction(page, {
        rowIndex: classRow.rowIndex,
        kind: "button-group",
        label: classRow.label,
        option: target,
      });

      const controlsB = await extractCalculatorFormControls(page, {
        ignoreLabels: IGNORE,
        includeSingletonButtonGroups: true,
      });
      const sigB = calculatorFormSignature(controlsB);
      assert.notEqual(sigA, sigB, "form signature should change when instance class changes");

      const specB = findSpecLikeSelect(controlsB);
      assert.ok(specB, "expected specification select after class change");
      assert.notDeepEqual(
        specA.options,
        specB.options,
        "instance specification dropdown options should differ across classes",
      );
    } finally {
      await browser.close();
    }
  },
);
