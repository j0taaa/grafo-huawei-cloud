import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import {
  calculatorUrlForService,
  defaultCalculatorFormRoot,
  dismissCalculatorOverlays,
  parsePricingServiceSlugFromArgv,
} from "./huawei-ecs-calculator-options.js";
import {
  applyCalculatorFormAction,
  buildCandidateCalculatorActions,
  extractCalculatorFormControls,
  mapWithConcurrency,
  readCalculatorFormQuickSignature,
  type CalculatorFormAction,
  type CalculatorFormControl,
} from "./huawei-calculator-form-state.js";

const OUTPUT_DIR = path.resolve("playwright-output");
const DEFAULT_CONCURRENCY = Number(process.env.HUAWEI_AUTOMATON_CONCURRENCY || "4");

type ControlState = CalculatorFormControl;
type Action = CalculatorFormAction;

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

function controlDisplayLabel(control: Pick<ControlState | Action, "label" | "rowIndex">): string {
  return control.label || `row-${control.rowIndex}`;
}

function actionDisplayLabel(action: Action): string {
  const slot =
    action.kind === "checkbox" && (action.checkboxIndex ?? 0) > 0
      ? `[${action.checkboxIndex}]`
      : "";
  return `${controlDisplayLabel(action)}${slot}=${action.option}`;
}

function stateSignature(controls: ControlState[], memory: Record<string, string>): string {
  return JSON.stringify(
    {
      visible: controls.map((control) => ({
        kind: control.kind,
        label: control.label,
        options: control.options,
        current: control.current ?? "",
        ...(control.kind === "checkbox" ? { checkboxIndex: control.checkboxIndex ?? 0 } : {}),
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
  return controls.map((control) => {
    if (control.rowIndex !== action.rowIndex || control.kind !== action.kind) return control;
    if (action.kind === "checkbox" && (control.checkboxIndex ?? 0) !== (action.checkboxIndex ?? 0)) {
      return control;
    }
    return { ...control, current: action.option };
  });
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
  await page.waitForTimeout(180);
  await dismissCalculatorOverlays(page);
  await defaultCalculatorFormRoot(page).waitFor({ timeout: 30_000 });
}

async function openCalculatorPage(browser: Browser, url: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitForCalculatorReady(page);
  return page;
}

async function extractControlStates(page: Page): Promise<ControlState[]> {
  return extractCalculatorFormControls(page, {
    ignoreLabels: new Set(),
    includeSingletonButtonGroups: true,
  });
}

async function extractQuickSignature(page: Page): Promise<string> {
  return readCalculatorFormQuickSignature(page);
}

async function applyAction(page: Page, action: Action): Promise<void> {
  await applyCalculatorFormAction(page, action);
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
      const actions: Action[] = buildCandidateCalculatorActions(state.controls);

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
