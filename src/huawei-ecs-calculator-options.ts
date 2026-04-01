import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";

/** Base URL without hash; append `/#/{service}` for a product (e.g. `ecs`, `cce`). */
export const DEFAULT_PRICING_CALCULATOR_PAGE =
  "https://www.huaweicloud.com/intl/pt-br/pricing/calculator.html";

export const DEFAULT_SERVICE_SLUG = "ecs";

/** @deprecated use {@link calculatorUrlForService} */
export const DEFAULT_ECS_CALCULATOR_URL = `${DEFAULT_PRICING_CALCULATOR_PAGE}#/ecs`;

/**
 * Builds the pricing calculator URL for a service hash segment (`#/ecs`, `#/cce`, …).
 */
export function calculatorUrlForService(
  serviceSlug: string,
  basePageUrl: string = DEFAULT_PRICING_CALCULATOR_PAGE,
): string {
  const slug = serviceSlug
    .trim()
    .toLowerCase()
    .replace(/^#+/, "")
    .replace(/^\/+/, "")
    .replace(/[^a-z0-9-]/g, "");
  if (!slug) {
    throw new Error("calculatorUrlForService: empty service slug");
  }
  return `${basePageUrl.replace(/#.*$/, "")}#/${slug}`;
}

/**
 * Parses `--service=cce`, `--service cce`, env `HUAWEI_PRICING_SERVICE`, or a single
 * trailing positional slug (e.g. `tsx …/huawei-ecs-calculator-options.ts cce`).
 */
export function parsePricingServiceSlugFromArgv(argv: string[] = process.argv): string {
  const args = argv.slice(2).filter((a) => a !== "--headed");

  const eq = args.find((a) => a.startsWith("--service="));
  if (eq) {
    const v = eq.slice("--service=".length).trim();
    if (v) return v.toLowerCase();
  }
  const idx = args.indexOf("--service");
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("-")) {
    return args[idx + 1]!.toLowerCase();
  }

  const nonFlags = args.filter((a) => !a.startsWith("-"));
  const scriptArg = nonFlags.find(
    (a) => a.endsWith(".ts") || a.endsWith(".mts") || a.includes("huawei-ecs-calculator-options"),
  );
  const positional = nonFlags.filter((a) => a !== scriptArg);
  const last = positional[positional.length - 1];
  if (last && /^[a-z0-9-]+$/i.test(last)) return last.toLowerCase();

  const fromEnv = process.env.HUAWEI_PRICING_SERVICE?.trim();
  if (fromEnv) return fromEnv.toLowerCase();

  return DEFAULT_SERVICE_SLUG;
}

/** Active product form area (ECS, CCE, … share this id today). */
export function defaultCalculatorFormRoot(page: Page): Locator {
  return page.locator("#calc.tiny-tab-pane.active-item");
}

/**
 * Closes onboarding / cookie overlays that block clicks on the calculator.
 */
export async function dismissCalculatorOverlays(page: Page): Promise<void> {
  await page
    .locator(".guide-dialog .tiny-dialog-box__headerbtn")
    .first()
    .click({ timeout: 2500 })
    .catch(() => undefined);
  await page
    .getByRole("button", { name: "Close", exact: true })
    .click({ timeout: 2500 })
    .catch(() => undefined);
  await page
    .getByRole("button", { name: "Do not show again", exact: true })
    .click({ timeout: 2500 })
    .catch(() => undefined);
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(400);
}

/**
 * Returns option labels for the currently visible TinyVue select popper (if any).
 * Handles the special region dropdown (`.tvp-region__option-content-item[title]`).
 */
export async function readOpenTinySelectDropdownOptions(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const pops = [...document.querySelectorAll(".tiny-select-dropdown.tiny-popper")];
    const visible = pops.filter((p) => {
      const st = getComputedStyle(p);
      const r = p.getBoundingClientRect();
      return st.display !== "none" && st.visibility !== "hidden" && r.width > 0 && r.height > 0;
    });
    const pop = visible[visible.length - 1];
    if (!pop) return [];

    const region = [...pop.querySelectorAll(".tvp-region__option-content-item[title]")]
      .map((el) => el.getAttribute("title")?.trim() || "")
      .filter(Boolean);
    if (region.length) return region;

    const labels = [...pop.querySelectorAll("li.tiny-option .tiny-option-label")]
      .map((el) => el.textContent?.trim().replace(/\s+/g, " ") || "")
      .filter(Boolean);
    if (labels.length) return labels;

    return [...pop.querySelectorAll("li.tiny-option")]
      .map((el) => el.textContent?.trim().replace(/\s+/g, " ") || "")
      .filter(Boolean);
  });
}

/**
 * All TinyVue button-group rows under `scope`, in DOM order.
 * Each row becomes one list of visible button labels.
 */
export async function getTinyButtonGroupOptionLists(scope: Locator): Promise<string[][]> {
  return scope.evaluate((root) => {
    const out: string[][] = [];
    for (const item of root.querySelectorAll(".tiny-form-item")) {
      const group = item.querySelector(".tiny-button-group");
      if (!group) continue;
      const texts = [...group.querySelectorAll("button")]
        .map((b) => (b.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      if (texts.length) out.push(texts);
    }
    return out;
  });
}

/**
 * Walks readonly `input.tiny-input__inner` fields in DOM order (skipping rows that
 * already use a button-group) and returns one options list per opened dropdown.
 */
export async function getReadonlyTinySelectOptionLists(
  page: Page,
  scope: Locator,
): Promise<string[][]> {
  const out: string[][] = [];
  const items = scope.locator(".tiny-form-item");
  const n = await items.count();

  for (let i = 0; i < n; i++) {
    const item = items.nth(i);
    if (await item.locator(".tiny-button-group").count()) continue;

    const input = item.locator("input.tiny-input__inner").first();
    if ((await input.count()) === 0) continue;
    if ((await input.getAttribute("readonly")) === null) continue;

    await input.click({ force: true });
    try {
      await page.locator(".tiny-select-dropdown.tiny-popper").last().waitFor({
        state: "visible",
        timeout: 8000,
      });
    } catch {
      await page.keyboard.press("Escape").catch(() => undefined);
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(200);
    const opts = await readOpenTinySelectDropdownOptions(page);
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(300);

    if (opts.length) out.push(opts);
  }

  return out;
}

/**
 * One list per `.tiny-form-item` row, in DOM order: button-group options first,
 * otherwise options from a readonly select-like input (dropdown opened once).
 */
export async function collectCalculatorFormOptionLists(
  page: Page,
  formRoot: Locator = defaultCalculatorFormRoot(page),
): Promise<string[][]> {
  await formRoot.waitFor({ timeout: 30_000 });

  const items = formRoot.locator(".tiny-form-item");
  const n = await items.count();
  const out: string[][] = [];

  for (let i = 0; i < n; i++) {
    const item = items.nth(i);
    const group = item.locator(".tiny-button-group").first();

    if (await group.count()) {
      const texts = await group.evaluate((el) =>
        [...el.querySelectorAll("button")]
          .map((b) => (b.textContent || "").replace(/\s+/g, " ").trim())
          .filter(Boolean),
      );
      if (texts.length) out.push(texts);
      continue;
    }

    const input = item.locator("input.tiny-input__inner").first();
    if ((await input.count()) === 0) continue;
    if ((await input.getAttribute("readonly")) === null) continue;

    await input.click({ force: true });
    try {
      await page.locator(".tiny-select-dropdown.tiny-popper").last().waitFor({
        state: "visible",
        timeout: 8000,
      });
    } catch {
      await page.keyboard.press("Escape").catch(() => undefined);
      await page.waitForTimeout(200);
      continue;
    }

    await page.waitForTimeout(200);
    const opts = await readOpenTinySelectDropdownOptions(page);
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(300);

    if (opts.length) out.push(opts);
  }

  return out;
}

/** @deprecated use {@link collectCalculatorFormOptionLists} */
export const collectEcsFormOptionLists = collectCalculatorFormOptionLists;

async function main(): Promise<void> {
  const service = parsePricingServiceSlugFromArgv();
  const url =
    process.env.HUAWEI_PRICING_CALCULATOR_URL?.trim() ||
    process.env.HUAWEI_ECS_CALCULATOR_URL?.trim() ||
    calculatorUrlForService(service);

  const browser = await chromium.launch({
    headless: process.argv.includes("--headed") ? false : true,
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.getByRole("tab", { name: "Price Calculator" }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await dismissCalculatorOverlays(page);

    const lists = await collectCalculatorFormOptionLists(page);
    console.log(JSON.stringify({ service, url, optionLists: lists }, null, 2));
  } finally {
    await browser.close();
  }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);
const isMain =
  entryPath === modulePath || entryPath.endsWith("huawei-ecs-calculator-options.ts");

if (isMain) {
  main().catch((error) => {
    console.error(error);
    console.error("Install browsers if needed: npx playwright install chromium");
    process.exitCode = 1;
  });
}
