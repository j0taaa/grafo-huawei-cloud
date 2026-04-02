import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { instance } from "@viz-js/viz";

const OUTPUT_DIR = path.resolve("graphs");
/** Hand-maintained graph specs as JSON (same basename as PNGs in `graphs/`). */
const GRAPH_SPECS_JSON_DIR = path.resolve("graph-specs");

/** Device pixel ratio for PNG (2–3 recommended for dense graphs). Override with GRAPH_RENDER_DPR. */
const RENDER_DEVICE_SCALE = Math.min(
  4,
  Math.max(1, Number(process.env.GRAPH_RENDER_DPR ?? "2.5") || 2.5),
);

type GraphState = {
  id: string;
  title: string;
  controls: string[];
};

type GraphEdge = {
  from: string;
  to: string;
  action: string;
};

type GraphSpec = {
  name: string;
  title: string;
  subtitle: string;
  states: GraphState[];
  edges: GraphEdge[];
};

function getServiceArg(): string {
  const args = process.argv.slice(2);
  const eq = args.find((arg) => arg.startsWith("--service="));
  if (eq) return eq.slice("--service=".length).trim().toLowerCase();
  const idx = args.indexOf("--service");
  if (idx >= 0 && args[idx + 1]) return args[idx + 1]!.trim().toLowerCase();
  return "cce";
}

function getGraphSpec(service: string): GraphSpec {
  if (service === "cce") {
    return {
      name: "cce",
      title: "CCE Visible-State Graph",
      subtitle: "Region fixed to LA-Sao Paulo1; state = visible clickable options only",
      states: [
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
      ],
      edges: [
        { from: "S0", to: "S1", action: "Billing Mode=Pay-per-use" },
        { from: "S1", to: "S0", action: "Billing Mode=Yearly/Monthly" },
        { from: "S1", to: "S2", action: "Product Category=CCE Autopilot cluster" },
        { from: "S2", to: "S1", action: "Product Category=CCE cluster" },
        { from: "S2", to: "S0", action: "Billing Mode=Yearly/Monthly" },
      ],
    };
  }

  if (service === "redis" || service === "dcs") {
    return {
      name: "redis",
      title: "DCS (for Redis) Visible-State Graph",
      subtitle: "Default calculator region; state = visible clickable options only",
      states: [
        {
          id: "R0",
          title: "Basic / v7 / Single-node / Yearly-Monthly",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "Edition: Basic | Professional (performance) | Professional (storage)",
            "Version: 7.0 | 6.0 | 5.0 | 4.0",
            "Instance Type: Single-node | Master/Standby | Redis Cluster",
            "Specification: 0.125 GB ... 64 GB",
            "Required Duration: 1 month ... 3 years",
          ],
        },
        {
          id: "R1",
          title: "Basic / v7 / Single-node / Pay-per-use",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "Edition: Basic | Professional (performance) | Professional (storage)",
            "Version: 7.0 | 6.0 | 5.0 | 4.0",
            "Instance Type: Single-node | Master/Standby | Redis Cluster",
            "CPU | Memory: X86 | DRAM | ARM | DRAM",
            "Specification: 0.125 GB ... 64 GB",
            "Elastic Bandwidth: Buy now | Buy later",
          ],
        },
        {
          id: "R2",
          title: "Basic / v7 / Master-Standby",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "Edition: Basic | Professional (performance) | Professional (storage)",
            "Version: 7.0 | 6.0 | 5.0 | 4.0",
            "Instance Type: Single-node | Master/Standby | Redis Cluster",
            "Replicas: 2 | 3 | 4 | 5",
            "Specification: 0.125 GB ... 64 GB",
            "Required Duration: 1 month ... 3 years",
          ],
        },
        {
          id: "R3",
          title: "Basic / v7 / Redis Cluster",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "Edition: Basic | Professional (performance) | Professional (storage)",
            "Version: 7.0 | 6.0 | 5.0 | 4.0",
            "Instance Type: Single-node | Master/Standby | Redis Cluster",
            "Replicas: 1 | 2 | 3 | 4 | 5",
            "Specification: 4 GB ... 1,024 GB",
            "Required Duration: 1 month ... 3 years",
          ],
        },
        {
          id: "R4",
          title: "Basic / v6 family",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "Edition: Basic | Professional (performance) | Professional (storage)",
            "Version: 7.0 | 6.0 | 5.0 | 4.0",
            "Instance Type: Single-node | Master/Standby | Read/Write splitting | Proxy Cluster | Redis Cluster",
            "Replicas: 1 | 2 | 3 | 4 | 5",
            "Specification: 4 GB ... 1,024 GB",
            "Required Duration: 1 month ... 3 years",
          ],
        },
        {
          id: "R5",
          title: "Professional (performance)",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "Edition: Basic | Professional (performance) | Professional (storage)",
            "Specification: 8 GB | 16 GB | 32 GB | 64 GB",
            "Elastic Bandwidth: Buy now | Buy later",
          ],
        },
        {
          id: "R6",
          title: "Professional (storage)",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "Edition: Basic | Professional (performance) | Professional (storage)",
            "Specification: 8 GB | 16 GB | 32 GB",
            "Elastic Bandwidth: Buy now | Buy later",
          ],
        },
      ],
      edges: [
        { from: "R0", to: "R1", action: "Billing Mode=Pay-per-use" },
        { from: "R1", to: "R0", action: "Billing Mode=Yearly/Monthly" },
        { from: "R0", to: "R2", action: "Instance Type=Master/Standby" },
        { from: "R0", to: "R3", action: "Instance Type=Redis Cluster" },
        { from: "R2", to: "R0", action: "Instance Type=Single-node" },
        { from: "R2", to: "R3", action: "Instance Type=Redis Cluster" },
        { from: "R3", to: "R0", action: "Instance Type=Single-node" },
        { from: "R3", to: "R2", action: "Instance Type=Master/Standby" },
        { from: "R0", to: "R4", action: "Version=6.0" },
        { from: "R4", to: "R0", action: "Version=7.0" },
        { from: "R0", to: "R5", action: "Edition=Professional (performance)" },
        { from: "R0", to: "R6", action: "Edition=Professional (storage)" },
        { from: "R1", to: "R5", action: "Edition=Professional (performance)" },
        { from: "R1", to: "R6", action: "Edition=Professional (storage)" },
        { from: "R5", to: "R0", action: "Edition=Basic" },
        { from: "R5", to: "R6", action: "Edition=Professional (storage)" },
        { from: "R6", to: "R0", action: "Edition=Basic" },
        { from: "R6", to: "R5", action: "Edition=Professional (performance)" },
      ],
    };
  }

  if (service === "rds") {
    return {
      name: "rds",
      title: "RDS Visible-State Graph",
      subtitle:
        "Buttons + readonly selects; HA read replica hides General-purpose; instance spec select options depend on class",
      states: [
        {
          id: "D0",
          title: "MySQL / Yearly-Monthly (default class)",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "DB Engine: MySQL | PostgreSQL",
            "DB Engine Version: 8.0 | 5.7",
            "DB Instance Type: Primary/Standby | Single | Read replica | HA read replica",
            "DB Instance Class: General-purpose | Dedicated [typical start: General-purpose]",
            "select: Instance specification (vCPU/RAM) — list A for General-purpose",
            "Required Duration: 1 month | 2–9 | 1 year",
          ],
        },
        {
          id: "D4",
          title: "MySQL / Yearly / Dedicated selected",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "DB Engine: MySQL | PostgreSQL",
            "DB Engine Version: 8.0 | 5.7",
            "DB Instance Type: Primary/Standby | Single | Read replica | HA read replica",
            "DB Instance Class: General-purpose | Dedicated [current: Dedicated]",
            "select: Instance specification — list B (different sizes than General-purpose)",
            "Required Duration: 1 month | 2–9 | 1 year",
          ],
        },
        {
          id: "D5",
          title: "MySQL / Yearly / HA read replica",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "DB Engine: MySQL | PostgreSQL",
            "DB Engine Version: 8.0 | 5.7",
            "DB Instance Type: Primary/Standby | Single | Read replica | HA read replica [current: HA read replica]",
            "DB Instance Class: Dedicated only (General-purpose not offered)",
            "select: Instance specification",
            "Required Duration: 1 month | 2–9 | 1 year",
          ],
        },
        {
          id: "D1",
          title: "MySQL / Pay-per-use (default class)",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "DB Engine: MySQL | PostgreSQL",
            "DB Engine Version: 8.0 | 5.7",
            "DB Instance Type: Primary/Standby | Single | Read replica | HA read replica | Proxy",
            "DB Instance Class: General-purpose | Dedicated",
            "select: Instance specification — list depends on class",
          ],
        },
        {
          id: "D6",
          title: "MySQL / Pay-per-use / Dedicated selected",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "DB Engine: MySQL | PostgreSQL",
            "DB Engine Version: 8.0 | 5.7",
            "DB Instance Type: Primary/Standby | Single | Read replica | HA read replica | Proxy",
            "DB Instance Class: General-purpose | Dedicated [current: Dedicated]",
            "select: Instance specification — alternate size list",
          ],
        },
        {
          id: "D7",
          title: "MySQL / Pay-per-use / HA read replica",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "DB Engine: MySQL | PostgreSQL",
            "DB Engine Version: 8.0 | 5.7",
            "DB Instance Type: … | HA read replica | Proxy [current: HA read replica]",
            "DB Instance Class: Dedicated only",
            "select: Instance specification",
          ],
        },
        {
          id: "D2",
          title: "PostgreSQL / Yearly-Monthly",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "DB Engine: MySQL | PostgreSQL",
            "DB Engine Version: 17 | 16 | 15 | 14 | 13",
            "DB Instance Type: Primary/Standby | Single | Read replica",
            "DB Instance Class: General-purpose | Dedicated",
            "select: Instance specification + Storage etc. — option lists depend on class",
            "Required Duration: 1 month | 2–9 | 1 year",
          ],
        },
        {
          id: "D3",
          title: "PostgreSQL / Pay-per-use",
          controls: [
            "Billing Mode: Yearly/Monthly | Pay-per-use",
            "DB Engine: MySQL | PostgreSQL",
            "DB Engine Version: 17 | 16 | 15 | 14 | 13",
            "DB Instance Type: Primary/Standby | Single | Read replica",
            "DB Instance Class: General-purpose | Dedicated",
            "select: Instance specification + Storage — lists depend on class",
          ],
        },
      ],
      edges: [
        { from: "D0", to: "D1", action: "Billing Mode=Pay-per-use" },
        { from: "D1", to: "D0", action: "Billing Mode=Yearly/Monthly" },
        { from: "D0", to: "D2", action: "DB Engine=PostgreSQL" },
        { from: "D2", to: "D0", action: "DB Engine=MySQL" },
        { from: "D1", to: "D3", action: "DB Engine=PostgreSQL" },
        { from: "D3", to: "D1", action: "DB Engine=MySQL" },
        { from: "D2", to: "D3", action: "Billing Mode=Pay-per-use" },
        { from: "D3", to: "D2", action: "Billing Mode=Yearly/Monthly" },
        { from: "D0", to: "D4", action: "DB Instance Class=Dedicated" },
        { from: "D4", to: "D0", action: "DB Instance Class=General-purpose" },
        { from: "D1", to: "D6", action: "DB Instance Class=Dedicated" },
        { from: "D6", to: "D1", action: "DB Instance Class=General-purpose" },
        { from: "D0", to: "D5", action: "DB Instance Type=HA read replica" },
        { from: "D5", to: "D0", action: "DB Instance Type=Primary/Standby" },
        { from: "D4", to: "D5", action: "DB Instance Type=HA read replica" },
        { from: "D5", to: "D4", action: "DB Instance Type=Primary/Standby" },
        { from: "D1", to: "D7", action: "DB Instance Type=HA read replica" },
        { from: "D7", to: "D1", action: "DB Instance Type=Primary/Standby" },
        { from: "D6", to: "D7", action: "DB Instance Type=HA read replica" },
        { from: "D7", to: "D6", action: "DB Instance Type=Primary/Standby" },
        { from: "D5", to: "D7", action: "Billing Mode=Pay-per-use" },
        { from: "D7", to: "D5", action: "Billing Mode=Yearly/Monthly" },
      ],
    };
  }

  throw new Error(`Unsupported service graph: ${service}`);
}

function buildDot(spec: GraphSpec): string {
  const lines = [
    "digraph service_graph {",
    "  rankdir=LR;",
    '  graph [bgcolor="white", pad="0.35", nodesep="0.75", ranksep="1.25", fontsize=16, labelfontsize=16];',
    '  node [shape=box, style="rounded,filled", fillcolor="#F8FAFF", color="#1D4ED8", fontname="Helvetica", fontsize=15];',
    '  edge [color="#6B7280", fontname="Helvetica", fontsize=12];',
    `  label="${[spec.title, spec.subtitle].join("\\n").replace(/"/g, '\\"')}";`,
    "  labelloc=t;",
    "  labeljust=l;",
  ];

  for (const state of spec.states) {
    const label = [state.id, state.title, ...state.controls].join("\\n").replace(/"/g, '\\"');
    lines.push(`  ${state.id} [label="${label}"];`);
  }

  for (const edge of spec.edges) {
    lines.push(`  ${edge.from} -> ${edge.to} [label="${edge.action.replace(/"/g, '\\"')}"];`);
  }

  lines.push("}");
  return lines.join("\n");
}

async function renderSvgToPng(svg: string, pngPath: string): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: RENDER_DEVICE_SCALE,
    });
    await page.setContent(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>` +
        `<body style="margin:0;background:#fff;line-height:0;display:inline-block;">${svg}</body></html>`,
      { waitUntil: "load" },
    );
    await page.screenshot({
      path: pngPath,
      fullPage: true,
      omitBackground: false,
      type: "png",
      scale: "device",
    });
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const service = getServiceArg();
  const spec = getGraphSpec(service);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(GRAPH_SPECS_JSON_DIR, { recursive: true });

  const jsonPath = path.join(GRAPH_SPECS_JSON_DIR, `${spec.name}.json`);
  await writeFile(jsonPath, `${JSON.stringify(spec, null, 2)}\n`, "utf8");
  console.log(`JSON: ${jsonPath}`);

  const dot = buildDot(spec);
  const viz = await instance();
  const svg = viz.renderString(dot, { format: "svg", engine: "dot" });
  const pngPath = path.join(OUTPUT_DIR, `${spec.name}.png`);
  await renderSvgToPng(svg, pngPath);
  console.log(`PNG: ${pngPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
