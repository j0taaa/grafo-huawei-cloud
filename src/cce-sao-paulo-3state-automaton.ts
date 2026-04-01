import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { instance } from "@viz-js/viz";

const OUTPUT_DIR = path.resolve("playwright-output");

type State = {
  id: string;
  title: string;
  controls: string[];
};

type Edge = {
  from: string;
  to: string;
  action: string;
};

const states: State[] = [
  {
    id: "S0",
    title: "Default / Yearly-Monthly",
    controls: [
      "Billing Mode: Yearly/Monthly | Pay-per-use",
      "Cluster Scale: 50 | 200 | 1000 | 2000",
      "Master Nodes: 3 Masters | Single",
      "Required Duration: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 1 year",
    ],
  },
  {
    id: "S1",
    title: "Pay-per-use + CCE cluster",
    controls: [
      "Billing Mode: Yearly/Monthly | Pay-per-use",
      "Product Category: CCE cluster | CCE Autopilot cluster",
      "Cluster Scale: 50 | 200 | 1000 | 2000",
      "Master Nodes: 3 Masters | Single",
    ],
  },
  {
    id: "S2",
    title: "Pay-per-use + CCE Autopilot",
    controls: [
      "Billing Mode: Yearly/Monthly | Pay-per-use",
      "Product Category: CCE cluster | CCE Autopilot cluster",
    ],
  },
];

const edges: Edge[] = [
  { from: "S0", to: "S1", action: "Billing Mode=Pay-per-use" },
  { from: "S1", to: "S0", action: "Billing Mode=Yearly/Monthly" },
  { from: "S1", to: "S2", action: "Product Category=CCE Autopilot cluster" },
  { from: "S2", to: "S1", action: "Product Category=CCE cluster" },
  { from: "S2", to: "S0", action: "Billing Mode=Yearly/Monthly" },
];

function buildDot(): string {
  const lines = [
    "digraph cce_sao_paulo_visible_automaton {",
    "  rankdir=LR;",
    '  graph [bgcolor="white", pad="0.25", nodesep="0.55", ranksep="0.9"];',
    '  node [shape=box, style="rounded,filled", fillcolor="#F8FAFF", color="#1D4ED8", fontname="Helvetica", fontsize=12];',
    '  edge [color="#6B7280", fontname="Helvetica", fontsize=10];',
  ];

  for (const state of states) {
    const label = [state.id, state.title, ...state.controls].join("\\n").replace(/"/g, '\\"');
    lines.push(`  ${state.id} [label="${label}"];`);
  }

  for (const edge of edges) {
    lines.push(`  ${edge.from} -> ${edge.to} [label="${edge.action.replace(/"/g, '\\"')}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}

async function renderSvgToPng(svg: string, pngPath: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1800, height: 1100 } });
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

  const graph = {
    service: "cce",
    region: "LA-Sao Paulo1",
    equivalence: "visible clickable option sets only; Region ignored as fixed environment parameter",
    states,
    edges,
  };

  const dot = buildDot();
  const viz = await instance();
  const svg = viz.renderString(dot, { format: "svg", engine: "dot" });

  const base = "cce-sao-paulo-3state-automaton";
  const jsonPath = path.join(OUTPUT_DIR, `${base}.json`);
  const dotPath = path.join(OUTPUT_DIR, `${base}.dot`);
  const svgPath = path.join(OUTPUT_DIR, `${base}.svg`);
  const pngPath = path.join(OUTPUT_DIR, `${base}.png`);

  await writeFile(jsonPath, JSON.stringify(graph, null, 2));
  await writeFile(dotPath, dot);
  await writeFile(svgPath, svg);
  await renderSvgToPng(svg, pngPath);

  console.log(`JSON: ${jsonPath}`);
  console.log(`DOT: ${dotPath}`);
  console.log(`SVG: ${svgPath}`);
  console.log(`PNG: ${pngPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
