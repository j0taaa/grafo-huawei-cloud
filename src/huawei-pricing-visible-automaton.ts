import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { instance } from "@viz-js/viz";
import {
  calculatorUrlForService,
  defaultCalculatorFormRoot,
  dismissCalculatorOverlays,
  readOpenTinySelectDropdownOptions,
} from "./huawei-ecs-calculator-options.js";
import {
  applyCalculatorFormAction,
  buildCandidateCalculatorActions,
  calculatorFormSignature,
  extractCalculatorFormControls,
  mapWithConcurrency,
  readCalculatorFormQuickSignature,
  type CalculatorFormAction,
  type CalculatorFormControl,
} from "./huawei-calculator-form-state.js";

const OUTPUT_DIR = path.resolve("playwright-output");

const VISIBLE_CONCURRENCY = Number(process.env.HUAWEI_VISIBLE_AUTOMATON_CONCURRENCY ?? "4");
const MAX_STATES = (() => {
  const raw = process.env.HUAWEI_VISIBLE_AUTOMATON_MAX_STATES?.trim();
  if (!raw) return Number.POSITIVE_INFINITY;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : Number.POSITIVE_INFINITY;
})();

type StateNode = {
  id: string;
  signature: string;
  quickSignature: string;
  controls: CalculatorFormControl[];
  path: CalculatorFormAction[];
};

type Edge = {
  from: string;
  to: string;
  action: string;
};

type Automaton = {
  service: string;
  region: string | null;
  mode: "visible-only";
  states: StateNode[];
  edges: Edge[];
};

function normalizeText(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

function canonicalizeLabel(label: string): string {
  return normalizeText(label);
}

function parseArgValue(flag: string): string | null {
  const args = process.argv.slice(2);
  const eq = args.find((arg) => arg.startsWith(`${flag}=`));
  if (eq) return eq.slice(flag.length + 1);
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("-")) {
    return args[idx + 1]!;
  }
  return null;
}

function getServiceArg(): string {
  return parseArgValue("--service") ?? process.env.HUAWEI_PRICING_SERVICE ?? "cce";
}

function getRegionArg(): string | null {
  return parseArgValue("--region") ?? process.env.HUAWEI_PRICING_REGION ?? null;
}

function getIgnoreLabels(): Set<string> {
  const raw =
    parseArgValue("--ignore-labels") ??
    process.env.HUAWEI_AUTOMATON_IGNORE_LABELS ??
    "AZ,Sub-AZ";
  return new Set(
    raw
      .split(",")
      .map((item) => canonicalizeLabel(item))
      .filter(Boolean),
  );
}

function includeSingletonControls(): boolean {
  return process.argv.includes("--include-singletons");
}

async function waitReady(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Price Calculator" }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(180);
  await dismissCalculatorOverlays(page);
  await defaultCalculatorFormRoot(page).waitFor({ timeout: 30_000 });
}

async function selectDropdownOption(page: Page, option: string): Promise<void> {
  const clicked = await page.evaluate((target) => {
    const pops = [...document.querySelectorAll(".tiny-select-dropdown.tiny-popper")];
    const pop = pops
      .filter((p) => {
        const style = getComputedStyle(p);
        const rect = p.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      })
      .at(-1);
    if (!pop) return false;

    const region = [...pop.querySelectorAll(".tvp-region__option-content-item[title]")].find(
      (node) => (node.getAttribute("title") ?? "").trim() === target,
    );
    if (region instanceof HTMLElement) {
      region.click();
      return true;
    }

    const item = [...pop.querySelectorAll("li.tiny-option")].find((node) => {
      const label = node.querySelector(".tiny-option-label");
      return ((label?.textContent ?? node.textContent ?? "").replace(/\s+/g, " ").trim() === target);
    });
    if (item instanceof HTMLElement) {
      item.click();
      return true;
    }

    return false;
  }, option);

  if (!clicked) {
    throw new Error(`Could not select dropdown option "${option}".`);
  }
}

async function setFixedRegion(page: Page, region: string | null): Promise<void> {
  if (!region) return;

  const items = defaultCalculatorFormRoot(page).locator(".tiny-form-item");
  const count = await items.count();

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const label = canonicalizeLabel(
      await item.locator(".tiny-form-item__label").first().innerText().catch(() => ""),
    );
    if (label !== "Region") continue;

    const input = item.locator("input.tiny-input__inner[readonly]").first();
    if ((await input.count()) === 0) return;
    await input.click({ force: true });
    await page.locator(".tiny-select-dropdown.tiny-popper").last().waitFor({
      state: "visible",
      timeout: 8000,
    });
    const options = await readOpenTinySelectDropdownOptions(page);
    if (!options.includes(region)) {
      await page.keyboard.press("Escape").catch(() => undefined);
      throw new Error(`Region "${region}" not available.`);
    }
    await selectDropdownOption(page, region);
    await page.waitForTimeout(320);
    return;
  }
}

async function openCalculatorSession(
  browser: Browser,
  service: string,
  region: string | null,
): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto(calculatorUrlForService(service), { waitUntil: "domcontentloaded" });
  await waitReady(page);
  await setFixedRegion(page, region);
  await page.waitForTimeout(450);
  return page;
}

function actionDisplay(action: CalculatorFormAction): string {
  const lab = action.label || `row-${action.rowIndex}`;
  const slot =
    action.kind === "checkbox" && (action.checkboxIndex ?? 0) > 0
      ? `[${action.checkboxIndex}]`
      : "";
  return `${lab}${slot}=${action.option}`;
}

async function captureStateForPath(
  browser: Browser,
  service: string,
  region: string | null,
  path: CalculatorFormAction[],
  ignoreLabels: Set<string>,
  includeSingletonFlag: boolean,
): Promise<{
  controls: CalculatorFormControl[];
  quickSignature: string;
}> {
  const page = await openCalculatorSession(browser, service, region);
  try {
    for (const action of path) {
      await applyCalculatorFormAction(page, action);
    }
    const controls = await extractCalculatorFormControls(page, {
      ignoreLabels,
      includeSingletonButtonGroups: includeSingletonFlag,
    });
    const quickSignature = await readCalculatorFormQuickSignature(page);
    return { controls, quickSignature };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function buildVisibleAutomaton(service: string, region: string | null): Promise<Automaton> {
  const ignoreLabels = getIgnoreLabels();
  const includeSingletonFlag = includeSingletonControls();

  const browser = await chromium.launch({
    headless: process.argv.includes("--headed") ? false : true,
  });

  try {
    const statesBySignature = new Map<string, StateNode>();
    const queue: string[] = [];
    const edges = new Map<string, Edge>();
    let stateCounter = 0;

    const initial = await captureStateForPath(browser, service, region, [], ignoreLabels, includeSingletonFlag);
    const initialSig = calculatorFormSignature(initial.controls);
    const initialNode: StateNode = {
      id: `s${stateCounter++}`,
      signature: initialSig,
      quickSignature: initial.quickSignature,
      controls: initial.controls,
      path: [],
    };
    statesBySignature.set(initialSig, initialNode);
    queue.push(initialSig);

    while (queue.length && statesBySignature.size < MAX_STATES) {
      const signature = queue.shift()!;
      const state = statesBySignature.get(signature)!;
      const actions = buildCandidateCalculatorActions(state.controls);

      const results = await mapWithConcurrency(actions, VISIBLE_CONCURRENCY, async (action) => {
        const nextPath = [...state.path, action];

        const snap = await captureStateForPath(browser, service, region, nextPath, ignoreLabels, includeSingletonFlag);
        const nextSig = calculatorFormSignature(snap.controls);
        if (nextSig === state.signature) return null;

        return { action, snap, nextSig };
      });

      for (const result of results) {
        if (!result) continue;
        if (statesBySignature.size >= MAX_STATES) break;

        let next = statesBySignature.get(result.nextSig);
        if (!next) {
          next = {
            id: `s${stateCounter++}`,
            signature: result.nextSig,
            quickSignature: result.snap.quickSignature,
            controls: result.snap.controls,
            path: [...state.path, result.action],
          };
          statesBySignature.set(result.nextSig, next);
          queue.push(result.nextSig);
        }

        const edgeKey = `${state.id}|${next.id}|${actionDisplay(result.action)}`;
        if (!edges.has(edgeKey)) {
          edges.set(edgeKey, {
            from: state.id,
            to: next.id,
            action: actionDisplay(result.action),
          });
        }
      }
    }

    return {
      service,
      region,
      mode: "visible-only",
      states: [...statesBySignature.values()],
      edges: [...edges.values()],
    };
  } finally {
    await browser.close();
  }
}

function buildDot(automaton: Automaton): string {
  const lines = [
    "digraph visible_automaton {",
    "  rankdir=LR;",
    '  graph [bgcolor="white", pad="0.2"];',
    '  node [shape=box, style="rounded,filled", fillcolor="#F8FAFF", color="#1D4ED8", fontname="Helvetica", fontsize=11];',
    '  edge [color="#6B7280", fontname="Helvetica", fontsize=9];',
  ];

  for (const state of automaton.states) {
    const labelLines = [state.id];
    for (const control of state.controls) {
      const cur = control.current ? ` [${control.current}]` : "";
      const opts = control.options.join(" | ");
      const kindTag =
        control.kind === "select" ? "select" : control.kind === "checkbox" ? "cb" : "btn";
      labelLines.push(`${kindTag} ${control.label || "(unlabeled)"}${cur}: ${opts}`);
    }
    const label = labelLines.join("\\n").replace(/"/g, '\\"');
    lines.push(`  ${state.id} [label="${label}"];`);
  }

  for (const edge of automaton.edges) {
    lines.push(`  ${edge.from} -> ${edge.to} [label="${edge.action.replace(/"/g, '\\"')}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}

async function renderDotToFiles(baseName: string, dot: string, json: string): Promise<void> {
  const viz = await instance();
  const svg = viz.renderString(dot, { format: "svg", engine: "dot" });

  const jsonPath = path.join(OUTPUT_DIR, `${baseName}.json`);
  const dotPath = path.join(OUTPUT_DIR, `${baseName}.dot`);
  const svgPath = path.join(OUTPUT_DIR, `${baseName}.svg`);
  const pngPath = path.join(OUTPUT_DIR, `${baseName}.png`);

  await writeFile(jsonPath, json);
  await writeFile(dotPath, dot);
  await writeFile(svgPath, svg);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 2200, height: 1600 } });
    await page.setContent(
      `<html><body style="margin:0;background:#fff;display:flex;justify-content:center;align-items:flex-start;">${svg}</body></html>`,
      { waitUntil: "load" },
    );
    await page.locator("svg").first().screenshot({ path: pngPath });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const service = getServiceArg();
  const region = getRegionArg();
  const automaton = await buildVisibleAutomaton(service, region);
  const baseName = `${service}${region ? `-${region.toLowerCase().replace(/[^a-z0-9]+/g, "-")}` : ""}-visible-automaton`;
  const json = JSON.stringify(automaton, null, 2);
  const dot = buildDot(automaton);
  await renderDotToFiles(baseName, dot, json);
  console.log(`States: ${automaton.states.length}`);
  console.log(`Edges: ${automaton.edges.length}`);
  console.log(`Base name: ${baseName}`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);

if (entryPath === modulePath || entryPath.endsWith("huawei-pricing-visible-automaton.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
