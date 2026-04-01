import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { instance } from "@viz-js/viz";

const OUTPUT_DIR = path.resolve("playwright-output");

type State = {
  id: string;
  label: string;
  summary: string;
};

type Edge = {
  from: string;
  to: string;
  action: string;
};

type Automaton = {
  service: "cce";
  assumption:
    "Derived from verified UI behavior plus Huawei calculator config; focuses on structural states and hidden memory that affect future structure.";
  states: State[];
  edges: Edge[];
};

function durationLabel(index: number): string {
  if (index === 0) return "1 month";
  if (index === 9) return "1 year";
  return String(index + 1);
}

function buildCceAutomaton(): Automaton {
  const states: State[] = [];
  const edges: Edge[] = [];

  for (let i = 0; i < 10; i++) {
    const id = `C${i + 1}`;
    states.push({
      id,
      label: `Cluster / Period / ${durationLabel(i)}`,
      summary: `CCE cluster yearly-monthly; duration memory=${durationLabel(i)}`,
    });
  }

  for (let i = 0; i < 10; i++) {
    const id = `P${i + 1}`;
    states.push({
      id,
      label: `Cluster / Pay-use / mem=${durationLabel(i)}`,
      summary: `Pay-per-use visible state with hidden remembered cluster duration=${durationLabel(i)}`,
    });
  }

  states.push(
    {
      id: "A_CPU",
      label: "Autopilot / Period / CPU",
      summary: "CCE Autopilot yearly-monthly; CPU packages visible",
    },
    {
      id: "A_MEM",
      label: "Autopilot / Period / Memory",
      summary: "CCE Autopilot yearly-monthly; Memory packages visible",
    },
    {
      id: "P_AUTO",
      label: "Autopilot / Pay-use",
      summary: "Pay-per-use visible state with hidden remembered product category=Autopilot",
    },
  );

  for (let i = 0; i < 10; i++) {
    const from = `C${i + 1}`;
    edges.push({ from, to: `P${i + 1}`, action: "Billing Mode=Pay-per-use" });
    edges.push({ from, to: "A_CPU", action: "Product Category=CCE Autopilot cluster" });

    for (let j = 0; j < 10; j++) {
      if (i === j) continue;
      edges.push({
        from,
        to: `C${j + 1}`,
        action: `Required Duration=${durationLabel(j)}`,
      });
    }
  }

  for (let i = 0; i < 10; i++) {
    const from = `P${i + 1}`;
    edges.push({ from, to: `C${i + 1}`, action: "Billing Mode=Yearly/Monthly" });
    edges.push({ from, to: "P_AUTO", action: "Product Category=CCE Autopilot cluster" });
  }

  edges.push(
    { from: "A_CPU", to: "A_MEM", action: "Package=Memory Packages" },
    { from: "A_CPU", to: "P_AUTO", action: "Billing Mode=Pay-per-use" },
    { from: "A_CPU", to: "C1", action: "Product Category=CCE cluster" },
    { from: "A_MEM", to: "A_CPU", action: "Package=CPU Packages" },
    { from: "A_MEM", to: "P_AUTO", action: "Billing Mode=Pay-per-use" },
    { from: "A_MEM", to: "C1", action: "Product Category=CCE cluster" },
    { from: "P_AUTO", to: "A_CPU", action: "Billing Mode=Yearly/Monthly" },
    { from: "P_AUTO", to: "P1", action: "Product Category=CCE cluster" },
  );

  return {
    service: "cce",
    assumption:
      "Derived from verified UI behavior plus Huawei calculator config; focuses on structural states and hidden memory that affect future structure.",
    states,
    edges,
  };
}

function buildDot(automaton: Automaton): string {
  const lines = [
    "digraph cce_automaton {",
    "  rankdir=LR;",
    '  graph [bgcolor="white", pad="0.2", nodesep="0.35", ranksep="0.8"];',
    '  node [shape=box, style="rounded,filled", fillcolor="#F8FAFF", color="#2B4C7E", fontname="Helvetica", fontsize=11];',
    '  edge [color="#6B7280", fontname="Helvetica", fontsize=9];',
    "  subgraph cluster_period_cluster {",
    '    label="CCE cluster / Yearly-Monthly";',
    '    color="#C7D2FE";',
  ];

  for (let i = 0; i < 10; i++) {
    lines.push(`    C${i + 1} [label="C${i + 1}\\n${durationLabel(i)}"];`);
  }

  lines.push("  }");
  lines.push("  subgraph cluster_pay_cluster {");
  lines.push('    label="CCE cluster / Pay-per-use";');
  lines.push('    color="#BFDBFE";');

  for (let i = 0; i < 10; i++) {
    lines.push(`    P${i + 1} [label="P${i + 1}\\nmem=${durationLabel(i)}"];`);
  }

  lines.push("  }");
  lines.push('  A_CPU [label="A_CPU\\nAutopilot / CPU packages", fillcolor="#ECFDF5", color="#047857"];');
  lines.push('  A_MEM [label="A_MEM\\nAutopilot / Memory packages", fillcolor="#ECFDF5", color="#047857"];');
  lines.push('  P_AUTO [label="P_AUTO\\nAutopilot / Pay-use", fillcolor="#FEF3C7", color="#B45309"];');

  for (const edge of automaton.edges) {
    const action = edge.action.replace(/"/g, '\\"');
    lines.push(`  ${edge.from} -> ${edge.to} [label="${action}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}

async function renderSvgToPng(svg: string, pngPath: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 2200, height: 1800 } });
    await page.setContent(
      `<html><body style="margin:0;background:#fff;display:flex;justify-content:center;align-items:flex-start;">${svg}</body></html>`,
      { waitUntil: "load" },
    );
    const svgLocator = page.locator("svg").first();
    await svgLocator.screenshot({ path: pngPath });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const automaton = buildCceAutomaton();
  const dot = buildDot(automaton);
  const viz = await instance();
  const svg = viz.renderString(dot, { format: "svg", engine: "dot" });

  const jsonPath = path.join(OUTPUT_DIR, "cce-automaton-derived.json");
  const dotPath = path.join(OUTPUT_DIR, "cce-automaton-derived.dot");
  const svgPath = path.join(OUTPUT_DIR, "cce-automaton-derived.svg");
  const pngPath = path.join(OUTPUT_DIR, "cce-automaton-derived.png");

  await writeFile(jsonPath, JSON.stringify(automaton, null, 2));
  await writeFile(dotPath, dot);
  await writeFile(svgPath, svg);
  await renderSvgToPng(svg, pngPath);

  console.log(`JSON: ${jsonPath}`);
  console.log(`DOT: ${dotPath}`);
  console.log(`SVG: ${svgPath}`);
  console.log(`PNG: ${pngPath}`);
  console.log(`States: ${automaton.states.length}`);
  console.log(`Edges: ${automaton.edges.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
