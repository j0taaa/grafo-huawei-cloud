import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";

const TARGET_URL =
  "https://www.huaweicloud.com/intl/pt-br/pricing/calculator.html#/ecs";
const OUTPUT_DIR = path.resolve("playwright-output");

const BILLING_MODES = ["Yearly/Monthly", "Pay-per-use", "RI"] as const;

const FIELD_LABELS = [
  "Image",
  "paymentType",
  "Required Duration",
  "System Disk",
  "EIP",
  "EIP Type",
  "Bandwidth Type",
  "Billed By",
  "Quantity",
] as const;

const MODE_MARKERS = {
  "Yearly/Monthly": ["1 month", "1 year"],
  "Pay-per-use": ["Traffic"],
  RI: ["No Upfront", "1 Year", "3 Years"],
} as const;

type BillingMode = (typeof BILLING_MODES)[number];
type FieldLabel = (typeof FIELD_LABELS)[number];

type ProbeResult = {
  mode: BillingMode;
  visibleFields: Record<FieldLabel, boolean>;
  modeMarkers: string[];
  screenshotPath: string;
};

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: process.argv.includes("--headed") ? false : true,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1600, height: 1200 },
    });
    const page = await context.newPage();

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.getByRole("tab", { name: "Price Calculator" }).waitFor();
    await dismissOptionalBanners(page);

    const results: ProbeResult[] = [];

    for (const mode of BILLING_MODES) {
      await switchBillingMode(page, mode);

      const screenshotPath = path.join(
        OUTPUT_DIR,
        `${slugify(mode)}.png`,
      );

      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
      });

      results.push({
        mode,
        visibleFields: await collectFieldVisibility(page),
        modeMarkers: await collectVisibleMarkers(page, MODE_MARKERS[mode]),
        screenshotPath,
      });
    }

    const summaryPath = path.join(OUTPUT_DIR, "summary.json");
    await writeFile(summaryPath, JSON.stringify(results, null, 2));

    printSummary(results, summaryPath);
  } finally {
    await browser.close();
  }
}

async function dismissOptionalBanners(page: Page): Promise<void> {
  const dismissButtons = [
    page.getByRole("button", { name: "Do not show again", exact: true }),
    page.getByRole("button", { name: "Close", exact: true }),
  ];

  for (const button of dismissButtons) {
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
    }
  }
}

async function switchBillingMode(page: Page, mode: BillingMode): Promise<void> {
  const button = page.getByRole("button", { name: mode, exact: true });
  await button.waitFor();
  await button.click();

  const firstMarker = MODE_MARKERS[mode][0];
  if (firstMarker) {
    await page.getByText(firstMarker, { exact: true }).first().waitFor({
      timeout: 10_000,
    }).catch(() => undefined);
  }

  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(1200);
}

async function collectFieldVisibility(
  page: Page,
): Promise<Record<FieldLabel, boolean>> {
  const entries = await Promise.all(
    FIELD_LABELS.map(async (label) => [label, await isTextVisible(page, label)]),
  );

  return Object.fromEntries(entries) as Record<FieldLabel, boolean>;
}

async function collectVisibleMarkers(
  page: Page,
  markers: readonly string[],
): Promise<string[]> {
  const visible = await Promise.all(
    markers.map(async (marker) => (await isTextVisible(page, marker) ? marker : null)),
  );

  return visible.filter((marker): marker is string => Boolean(marker));
}

async function isTextVisible(page: Page, text: string): Promise<boolean> {
  const candidates: Locator[] = [
    page.getByText(text, { exact: true }).first(),
    page.locator(`text="${text}"`).first(),
  ];

  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      return true;
    }
  }

  return false;
}

function printSummary(results: ProbeResult[], summaryPath: string): void {
  console.log(`Huawei ECS billing mode probe`);
  console.log(`URL: ${TARGET_URL}`);
  console.log(`Summary JSON: ${summaryPath}`);
  console.log("");

  for (const result of results) {
    console.log(`Mode: ${result.mode}`);
    console.log(`Visible markers: ${result.modeMarkers.join(", ") || "none"}`);
    console.log(
      `System Disk visible: ${result.visibleFields["System Disk"] ? "yes" : "no"}`,
    );
    console.log(`Screenshot: ${result.screenshotPath}`);

    for (const [field, visible] of Object.entries(result.visibleFields)) {
      console.log(`  - ${field}: ${visible ? "visible" : "hidden"}`);
    }

    console.log("");
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

main().catch((error) => {
  console.error("Probe failed.");
  console.error(error);
  console.error("");
  console.error(
    "If Playwright cannot launch Chromium yet, run: npx playwright install chromium",
  );
  process.exitCode = 1;
});
