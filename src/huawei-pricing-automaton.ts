import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright";
import {
  calculatorUrlForService,
  defaultCalculatorFormRoot,
  dismissCalculatorOverlays,
  parsePricingServiceSlugFromArgv,
  readOpenTinySelectDropdownOptions,
} from "./huawei-ecs-calculator-options.js";

const OUTPUT_DIR = path.resolve("playwright-output");
const DEFAULT_CONCURRENCY = Number(process.env.HUAWEI_AUTOMATON_CONCURRENCY || "4");

type ControlKind = "button-group" | "select";

type ControlState = {
  rowIndex: number;
  kind: ControlKind;
  label: string;
  current: string | null;
  options: string[];
};

type Action = {
  rowIndex: number;
  kind: ControlKind;
  label: string;
  option: string;
};

type AutomatonNode = {
  id: string;
  signature: string;
  quickSignature: string;
  controls: ControlState[];
  memory: Record<string, string>;
  path: Action[];
};

type AutomatonEdge = {
  from: string;
  to: string;
  rowIndex: number;
  label: string;
  option: string;
};

type Automaton = {
  service: string;
  url: string;
  states: AutomatonNode[];
  edges: AutomatonEdge[];
};

const MEMORY_CONTROL_LABELS = new Set(
  (process.env.HUAWEI_AUTOMATON_MEMORY_LABELS ||
    "Billing Mode,Product Category,Package")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean),
);

async function mapWithConcurrency<T, R>(
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

function normalizeText(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

function controlDisplayLabel(control: Pick<ControlState | Action, "label" | "rowIndex">): string {
  return control.label || `row-${control.rowIndex}`;
}

function actionDisplayLabel(action: Action): string {
  return `${controlDisplayLabel(action)}=${action.option}`;
}

function stateSignature(controls: ControlState[], memory: Record<string, string>): string {
  return JSON.stringify(
    {
      visible: controls.map((control) => ({
        kind: control.kind,
        label: control.label,
        options: control.options,
      })),
      memory: Object.fromEntries(Object.entries(memory).sort(([a], [b]) => a.localeCompare(b))),
    },
  );
}

function buildMemoryFromControls(
  controls: ControlState[],
  previous: Record<string, string> = {},
): Record<string, string> {
  const next = { ...previous };
  const visibleLabels = new Set<string>();

  for (const control of controls) {
    const label = control.label;
    if (!MEMORY_CONTROL_LABELS.has(label)) continue;
    visibleLabels.add(label);
    if (control.current) {
      next[label] = control.current;
    }
  }

  for (const label of visibleLabels) {
    if (!(label in next)) delete next[label];
  }

  return next;
}

function updateVisibleControlCurrent(
  controls: ControlState[],
  action: Action,
): ControlState[] {
  return controls.map((control) =>
    control.rowIndex === action.rowIndex && control.kind === action.kind
      ? { ...control, current: action.option }
      : control,
  );
}

function updateMemoryForAction(memory: Record<string, string>, action: Action): Record<string, string> {
  if (!MEMORY_CONTROL_LABELS.has(action.label)) {
    return memory;
  }
  return {
    ...memory,
    [action.label]: action.option,
  };
}

async function waitForCalculatorReady(page: Page): Promise<void> {
  await page.getByRole("tab", { name: "Price Calculator" }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await dismissCalculatorOverlays(page);
  await defaultCalculatorFormRoot(page).waitFor({ timeout: 30_000 });
}

async function openCalculatorPage(browser: Browser, url: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForCalculatorReady(page);
  return page;
}

async function readButtonGroupOptions(group: Locator): Promise<string[]> {
  return group.evaluate((el) =>
    [...el.querySelectorAll("button")]
      .map((button) => (button.textContent || "").replace(/\s+/g, " ").trim())
      .filter(Boolean),
  );
}

async function readActiveButton(group: Locator): Promise<string | null> {
  return group.evaluate((el) => {
    const active =
      el.querySelector("li.active button") ??
      el.querySelector("button.is-active") ??
      el.querySelector("button.active");
    return active ? (active.textContent || "").replace(/\s+/g, " ").trim() : null;
  });
}

async function extractControlStates(page: Page): Promise<ControlState[]> {
  const root = defaultCalculatorFormRoot(page);
  const items = root.locator(".tiny-form-item");
  const count = await items.count();
  const controls: ControlState[] = [];

  for (let rowIndex = 0; rowIndex < count; rowIndex++) {
    const item = items.nth(rowIndex);
    if (!(await item.isVisible().catch(() => false))) continue;

    const label = normalizeText(
      await item.locator(".tiny-form-item__label").first().innerText().catch(() => ""),
    );

    const group = item.locator(".tiny-button-group").first();
    if ((await group.count()) > 0) {
      const options = await readButtonGroupOptions(group);
      if (options.length) {
        controls.push({
          rowIndex,
          kind: "button-group",
          label,
          current: await readActiveButton(group),
          options,
        });
      }
      continue;
    }

    const input = item.locator("input.tiny-input__inner[readonly]").first();
    if ((await input.count()) === 0) continue;

    const current = normalizeText(await input.inputValue().catch(() => ""));
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

    await page.waitForTimeout(100);
    const options = (await readOpenTinySelectDropdownOptions(page)).map(normalizeText);
    await page.keyboard.press("Escape").catch(() => undefined);
    await page.waitForTimeout(100);

    if (options.length) {
      controls.push({
        rowIndex,
        kind: "select",
        label,
        current: current || null,
        options,
      });
    }
  }

  return controls;
}

async function extractQuickSignature(page: Page): Promise<string> {
  const root = defaultCalculatorFormRoot(page);
  return root.evaluate((el) =>
    JSON.stringify(
      [...el.querySelectorAll(".tiny-form-item")]
        .map((item) => {
          const htmlItem = item as HTMLElement;
          if (htmlItem.offsetParent === null) return null;

          const label = (
            item.querySelector(".tiny-form-item__label")?.textContent || ""
          ).replace(/\s+/g, " ").trim();

          const group = item.querySelector(".tiny-button-group");
          if (group) {
            const options = [...group.querySelectorAll("button")]
              .map((button) => (button.textContent || "").replace(/\s+/g, " ").trim())
              .filter(Boolean);
            return options.length ? { kind: "button-group", label, options } : null;
          }

          const input = item.querySelector("input.tiny-input__inner[readonly]");
          if (input) {
            return { kind: "select", label };
          }

          return null;
        })
        .filter(Boolean),
    ),
  );
}

async function clickButtonGroupOption(item: Locator, option: string): Promise<boolean> {
  const buttons = item.locator(".tiny-button-group button");
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    const text = normalizeText(await button.innerText().catch(() => ""));
    if (text !== option) continue;
    await button.click();
    return true;
  }

  return false;
}

async function clickVisibleDropdownOption(page: Page, option: string): Promise<boolean> {
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
      const label = node.querySelector(".tiny-option-label");
      return ((label?.textContent ?? node.textContent ?? "").replace(/\s+/g, " ").trim() === targetOption);
    });
    if (optionMatch instanceof HTMLElement) {
      optionMatch.click();
      return true;
    }

    return false;
  }, option);
}

async function applyAction(page: Page, action: Action): Promise<void> {
  const item = defaultCalculatorFormRoot(page).locator(".tiny-form-item").nth(action.rowIndex);
  await item.waitFor({ timeout: 30_000 });

  if (action.kind === "button-group") {
    const clicked = await clickButtonGroupOption(item, action.option);
    if (!clicked) {
      throw new Error(`Could not click button option "${action.option}" on ${controlDisplayLabel(action)}.`);
    }
  } else {
    const input = item.locator("input.tiny-input__inner[readonly]").first();
    await input.click({ force: true });
    await page.locator(".tiny-select-dropdown.tiny-popper").last().waitFor({
      state: "visible",
      timeout: 8000,
    });
    const clicked = await clickVisibleDropdownOption(page, action.option);
    if (!clicked) {
      throw new Error(`Could not click dropdown option "${action.option}" on ${controlDisplayLabel(action)}.`);
    }
  }

  await page.waitForTimeout(300);
}

async function captureStateForPath(
  browser: Browser,
  url: string,
  pathToApply: Action[],
  previousMemory: Record<string, string> = {},
): Promise<{ controls: ControlState[]; quickSignature: string; memory: Record<string, string> }> {
  const page = await openCalculatorPage(browser, url);

  try {
    for (const action of pathToApply) {
      await applyAction(page, action);
    }

    const controls = await extractControlStates(page);
    return {
      quickSignature: await extractQuickSignature(page),
      memory: buildMemoryFromControls(controls, previousMemory),
      controls,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function captureQuickSignatureForPath(
  browser: Browser,
  url: string,
  pathToApply: Action[],
): Promise<string> {
  const page = await openCalculatorPage(browser, url);

  try {
    for (const action of pathToApply) {
      await applyAction(page, action);
    }

    return await extractQuickSignature(page);
  } finally {
    await page.close().catch(() => undefined);
  }
}

function buildStateSummaryLines(state: AutomatonNode): string[] {
  return state.controls.map((control) => {
    const label = controlDisplayLabel(control);
    const current = control.current ? ` current=${control.current}` : "";
    return `${label} [${control.options.length}]${current}`;
  });
}

function buildDotGraph(automaton: Automaton): string {
  const lines = ["digraph pricing_automaton {", "  rankdir=LR;", '  node [shape=box, fontsize=10];'];

  for (const state of automaton.states) {
    const summary = [`${state.id}`, ...buildStateSummaryLines(state).slice(0, 8)];
    const escaped = summary.join("\\n").replace(/"/g, '\\"');
    lines.push(`  ${state.id} [label="${escaped}"];`);
  }

  for (const edge of automaton.edges) {
    const label = `${controlDisplayLabel(edge)}=${edge.option}`.replace(/"/g, '\\"');
    lines.push(`  ${edge.from} -> ${edge.to} [label="${label}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}

async function buildAutomaton(service: string, url: string): Promise<Automaton> {
  const browser = await chromium.launch({
    headless: process.argv.includes("--headed") ? false : true,
  });

  try {
    const statesBySignature = new Map<string, AutomatonNode>();
    const edges = new Map<string, AutomatonEdge>();
    const queue: string[] = [];
    let stateCounter = 0;

    const initialSnapshot = await captureStateForPath(browser, url, []);
    const initial: AutomatonNode = {
      id: `s${stateCounter++}`,
      signature: stateSignature(initialSnapshot.controls, initialSnapshot.memory),
      quickSignature: initialSnapshot.quickSignature,
      controls: initialSnapshot.controls,
      memory: initialSnapshot.memory,
      path: [],
    };

    statesBySignature.set(initial.signature, initial);
    queue.push(initial.signature);

    while (queue.length) {
      const signature = queue.shift()!;
      const state = statesBySignature.get(signature)!;
      const actions: Action[] = [];
      for (const control of state.controls) {
        for (const option of control.options) {
          if (control.current && option === control.current) continue;
          actions.push({
            rowIndex: control.rowIndex,
            kind: control.kind,
            label: control.label,
            option,
          });
        }
      }

      console.log(`Exploring ${state.id} with ${state.controls.length} visible controls and ${actions.length} candidate transitions`);

      const results = await mapWithConcurrency(actions, DEFAULT_CONCURRENCY, async (action) => {
        const nextMemory = updateMemoryForAction(state.memory, action);
        const nextQuickSignature = await captureQuickSignatureForPath(browser, url, [
          ...state.path,
          action,
        ]);

        if (
          nextQuickSignature === state.quickSignature &&
          JSON.stringify(nextMemory) === JSON.stringify(state.memory)
        ) {
          return null;
        }

        if (nextQuickSignature === state.quickSignature) {
          const controls = updateVisibleControlCurrent(state.controls, action);
          return {
            action,
            snapshot: {
              quickSignature: nextQuickSignature,
              controls,
              memory: nextMemory,
            },
            nextSignature: stateSignature(controls, nextMemory),
          };
        }

        const snapshot = await captureStateForPath(
          browser,
          url,
          [...state.path, action],
          nextMemory,
        );
        const nextSignature = stateSignature(snapshot.controls, snapshot.memory);

        if (nextSignature === state.signature) {
          return null;
        }

        return { action, snapshot, nextSignature };
      });

      for (const result of results) {
        if (!result) continue;

        let next = statesBySignature.get(result.nextSignature);
        if (!next) {
          next = {
            id: `s${stateCounter++}`,
            signature: result.nextSignature,
            quickSignature: result.snapshot.quickSignature,
            controls: result.snapshot.controls,
            memory: result.snapshot.memory,
            path: [...state.path, result.action],
          };
          statesBySignature.set(result.nextSignature, next);
          queue.push(result.nextSignature);
        }

        const edgeKey = `${state.id}|${next.id}|${actionDisplayLabel(result.action)}`;
        if (!edges.has(edgeKey)) {
          edges.set(edgeKey, {
            from: state.id,
            to: next.id,
            rowIndex: result.action.rowIndex,
            label: result.action.label,
            option: result.action.option,
          });
        }
      }
    }

    return {
      service,
      url,
      states: [...statesBySignature.values()],
      edges: [...edges.values()],
    };
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const service = parsePricingServiceSlugFromArgv();
  const url =
    process.env.HUAWEI_PRICING_CALCULATOR_URL?.trim() || calculatorUrlForService(service);

  const automaton = await buildAutomaton(service, url);

  const jsonPath = path.join(OUTPUT_DIR, `${service}-automaton.json`);
  const dotPath = path.join(OUTPUT_DIR, `${service}-automaton.dot`);

  await writeFile(jsonPath, JSON.stringify(automaton, null, 2));
  await writeFile(dotPath, buildDotGraph(automaton));

  console.log("");
  console.log(`Automaton written to ${jsonPath}`);
  console.log(`DOT graph written to ${dotPath}`);
  console.log(`States: ${automaton.states.length}`);
  console.log(`Edges: ${automaton.edges.length}`);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);
const isMain =
  entryPath === modulePath || entryPath.endsWith("huawei-pricing-automaton.ts");

if (isMain) {
  main().catch((error) => {
    console.error(error);
    console.error("Install browsers if needed: npx playwright install chromium");
    process.exitCode = 1;
  });
}
