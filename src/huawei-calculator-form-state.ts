import type { Locator, Page } from "playwright";
import { defaultCalculatorFormRoot, readOpenTinySelectDropdownOptions } from "./huawei-ecs-calculator-options.js";

export type CalculatorFormControlKind = "button-group" | "select";

/** One interactive row in the active calculator form (buttons or readonly Tiny select). */
export type CalculatorFormControl = {
  rowIndex: number;
  kind: CalculatorFormControlKind;
  label: string;
  current: string | null;
  options: string[];
};

export type CalculatorFormAction = {
  rowIndex: number;
  kind: CalculatorFormControlKind;
  label: string;
  option: string;
};

const SETTLE_MS = Number(process.env.HUAWEI_AUTOMATON_SETTLE_MS ?? "350");

export function normalizeCalculatorText(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

/** Canonicalize button labels for stable matching (e.g. Required Duration). */
export function canonicalizeCalculatorOption(label: string, option: string): string {
  const text = normalizeCalculatorText(option);
  if (label === "Required Duration") {
    return text.replace(/ months?$/i, "").replace(/^1 month$/i, "1");
  }
  return text;
}

export function calculatorFormSignature(controls: CalculatorFormControl[]): string {
  return JSON.stringify(
    [...controls]
      .sort((a, b) => a.rowIndex - b.rowIndex)
      .map((c) => ({
        kind: c.kind,
        label: c.label,
        current: c.current ?? "",
        options: [...c.options],
      })),
  );
}

/**
 * Fast DOM fingerprint: visible button-group option sets + active choice, and readonly select display values.
 * Used to skip redundant full extractions when the UI clearly changed.
 */
export async function readCalculatorFormQuickSignature(page: Page): Promise<string> {
  const root = defaultCalculatorFormRoot(page);
  return root.evaluate((el) => {
    const parts: unknown[] = [];
    const items = el.querySelectorAll(".tiny-form-item");
    items.forEach((item, rowIndex) => {
      const itemEl = item as HTMLElement;
      if (
        itemEl.offsetParent === null &&
        getComputedStyle(itemEl).position !== "fixed"
      ) {
        return;
      }
      const itemSt = getComputedStyle(itemEl);
      if (itemSt.display === "none" || itemSt.visibility === "hidden" || itemSt.opacity === "0") {
        return;
      }
      const itemR = itemEl.getBoundingClientRect();
      if (itemR.width <= 0 || itemR.height <= 0) return;

      const label = (item.querySelector(".tiny-form-item__label")?.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();

      const group = item.querySelector(".tiny-button-group");
      if (group) {
        const options = [...group.querySelectorAll("button")]
          .filter((b) => {
            const h = b as HTMLElement;
            if (h.offsetParent === null && getComputedStyle(h).position !== "fixed") return false;
            const st = getComputedStyle(h);
            if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
            const r = h.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          })
          .map((b) => (b.textContent || "").replace(/\s+/g, " ").trim())
          .filter(Boolean);
        if (options.length === 0) return;

        const activeBtn =
          (group.querySelector("li.active button") as HTMLButtonElement | null) ??
          (group.querySelector("button.is-active") as HTMLButtonElement | null) ??
          (group.querySelector("button.active") as HTMLButtonElement | null);
        const active = activeBtn
          ? (activeBtn.textContent || "").replace(/\s+/g, " ").trim()
          : "";

        parts.push({ rowIndex, k: "bg", label, options, active });
        return;
      }

      const input = item.querySelector("input.tiny-input__inner[readonly]") as HTMLInputElement | null;
      if (input) {
        const h = input as HTMLElement;
        if (h.offsetParent === null && getComputedStyle(h).position !== "fixed") return;
        const st = getComputedStyle(h);
        if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return;
        const r = h.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;

        parts.push({
          rowIndex,
          k: "sel",
          label,
          value: (input.value || "").replace(/\s+/g, " ").trim(),
        });
      }
    });
    return JSON.stringify(parts);
  });
}

/**
 * Extract all visible button groups and readonly selects under the active form.
 * - Button options: **visible** buttons only (avoids hidden duplicate DOM).
 * - Select options: opens each dropdown, reads options, closes — needed for correct state when lists change.
 * - Includes single-option button groups in the signature (e.g. only "Dedicated" after HA read replica).
 */
export async function extractCalculatorFormControls(
  page: Page,
  options: {
    ignoreLabels: Set<string>;
    /** @deprecated All non-empty button groups are kept; selects always kept. */
    includeSingletonButtonGroups: boolean;
  },
): Promise<CalculatorFormControl[]> {
  const root = defaultCalculatorFormRoot(page);
  const items = root.locator(".tiny-form-item");
  const count = await items.count();
  const controls: CalculatorFormControl[] = [];

  for (let rowIndex = 0; rowIndex < count; rowIndex++) {
    const item = items.nth(rowIndex);
    if (!(await item.isVisible().catch(() => false))) continue;

    const label = normalizeCalculatorText(
      await item.locator(".tiny-form-item__label").first().innerText().catch(() => ""),
    );
    if (options.ignoreLabels.has(label)) continue;

    const group = item.locator(".tiny-button-group").first();
    if ((await group.count()) > 0) {
      const { options: opts, current } = await group.evaluate((el) => {
        const texts = [...el.querySelectorAll("button")]
          .filter((b) => {
            const h = b as HTMLElement;
            if (h.offsetParent === null && getComputedStyle(h).position !== "fixed") return false;
            const st = getComputedStyle(h);
            if (st.display === "none" || st.visibility === "hidden" || st.opacity === "0") return false;
            const r = h.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          })
          .map((b) => (b.textContent || "").replace(/\s+/g, " ").trim())
          .filter(Boolean);
        const activeBtn =
          (el.querySelector("li.active button") as HTMLButtonElement | null) ??
          (el.querySelector("button.is-active") as HTMLButtonElement | null) ??
          (el.querySelector("button.active") as HTMLButtonElement | null);
        const cur = activeBtn ? (activeBtn.textContent || "").replace(/\s+/g, " ").trim() || null : null;
        return { options: texts, current: cur };
      });

      if (opts.length === 0) continue;
      // Keep singleton button rows in the signature (structural UI changes).
      controls.push({
        rowIndex,
        kind: "button-group",
        label,
        current,
        options: opts.map((o) => canonicalizeCalculatorOption(label, o)),
      });
      continue;
    }

    const input = item.locator("input.tiny-input__inner[readonly]").first();
    if ((await input.count()) === 0) continue;

    const current = normalizeCalculatorText(await input.inputValue().catch(() => ""));
    await input.click({ force: true });
    try {
      await page.locator(".tiny-select-dropdown.tiny-popper").last().waitFor({
        state: "visible",
        timeout: 8000,
      });
    } catch {
      await page.keyboard.press("Escape").catch(() => undefined);
      await page.waitForTimeout(120);
      continue;
    }

    await page.waitForTimeout(80);
    const rawOptions = (await readOpenTinySelectDropdownOptions(page)).map((o) =>
      normalizeCalculatorText(o),
    );
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(80);

    if (rawOptions.length === 0) continue;

    controls.push({
      rowIndex,
      kind: "select",
      label,
      current: current || null,
      options: rawOptions.map((o) => canonicalizeCalculatorOption(label, o)),
    });
  }

  void options.includeSingletonButtonGroups;
  return controls;
}

async function clickButtonGroupOption(item: Locator, label: string, option: string): Promise<boolean> {
  const buttons = item.locator(".tiny-button-group button");
  const n = await buttons.count();
  const want = canonicalizeCalculatorOption(label, option);
  for (let i = 0; i < n; i++) {
    const button = buttons.nth(i);
    if (!(await button.isVisible().catch(() => false))) continue;
    const text = canonicalizeCalculatorOption(label, await button.innerText().catch(() => ""));
    if (text !== want) continue;
    await button.click();
    return true;
  }
  return false;
}

async function clickVisibleDropdownOption(page: Page, option: string): Promise<boolean> {
  const target = normalizeCalculatorText(option);
  return page.evaluate((targetOption) => {
    const pops = [...document.querySelectorAll(".tiny-select-dropdown.tiny-popper")];
    const visible = pops.filter((p) => {
      const style = getComputedStyle(p);
      const rect = p.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    const pop = visible[visible.length - 1];
    if (!pop) return false;

    const regionMatch = [...pop.querySelectorAll(".tvp-region__option-content-item[title]")].find(
      (node) => (node.getAttribute("title") ?? "").replace(/\s+/g, " ").trim() === targetOption,
    );
    if (regionMatch instanceof HTMLElement) {
      regionMatch.click();
      return true;
    }

    const optionMatch = [...pop.querySelectorAll("li.tiny-option")].find((node) => {
      const lab = node.querySelector(".tiny-option-label");
      return (
        (lab?.textContent ?? node.textContent ?? "").replace(/\s+/g, " ").trim() === targetOption
      );
    });
    if (optionMatch instanceof HTMLElement) {
      optionMatch.click();
      return true;
    }

    return false;
  }, target);
}

export async function applyCalculatorFormAction(page: Page, action: CalculatorFormAction): Promise<void> {
  const item = defaultCalculatorFormRoot(page).locator(".tiny-form-item").nth(action.rowIndex);
  await item.waitFor({ state: "visible", timeout: 25_000 });

  if (action.kind === "button-group") {
    const ok = await clickButtonGroupOption(item, action.label, action.option);
    if (!ok) {
      throw new Error(
        `Could not click button "${action.option}" for ${action.label || `row-${action.rowIndex}`}.`,
      );
    }
  } else {
    const input = item.locator("input.tiny-input__inner[readonly]").first();
    await input.click({ force: true });
    await page.locator(".tiny-select-dropdown.tiny-popper").last().waitFor({
      state: "visible",
      timeout: 8000,
    });
    const ok = await clickVisibleDropdownOption(page, action.option);
    if (!ok) {
      throw new Error(
        `Could not select dropdown "${action.option}" for ${action.label || `row-${action.rowIndex}`}.`,
      );
    }
  }

  await page.waitForTimeout(SETTLE_MS);
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runner(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await worker(items[current]!, current);
    }
  }

  const width = Math.max(1, Math.min(concurrency, items.length || 1));
  await Promise.all(Array.from({ length: width }, () => runner()));
  return results;
}
