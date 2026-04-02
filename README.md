# grafoHuaweiCloud

Playwright probes and state graphs for the Huawei Cloud **pricing calculator** (e.g. CCE, DCS/Redis, RDS).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run probe:huawei-pricing-visible-automaton -- --service=rds` | BFS over UI states (Region select, button groups, **checkboxes** e.g. ELB, readonly selects). |
| `npm run probe:huawei-pricing-automaton -- --service=cce` | Full automaton (concurrency + quick signature). |
| `npm run render:service-graph -- --service=rds` | Writes `graph-specs/<service>.json` (with live `regions[]`) and `graphs/<service>.png`. Use `--skip-region-fetch` for offline. |
| `npm test` | Unit tests (offline). |
| `npm run test:live` | Hits the live calculator (needs network); set `HUAWEI_LIVE_TEST=1` is automatic in script. |

## Environment (tuning)

| Variable | Default | Purpose |
|----------|---------|---------|
| `HUAWEI_AUTOMATON_SETTLE_MS` | `350` | Pause after each control change before re-reading the form. |
| `HUAWEI_AUTOMATON_CONCURRENCY` | `4` | Worker pool for `huawei-pricing-automaton`. |
| `HUAWEI_VISIBLE_AUTOMATON_CONCURRENCY` | `4` | Worker pool for `huawei-pricing-visible-automaton`. |
| `HUAWEI_VISIBLE_AUTOMATON_MAX_STATES` | _(unset)_ | Cap BFS states (safety / faster partial runs). |
| `HUAWEI_AUTOMATON_IGNORE_LABELS` | `AZ,Sub-AZ` | Visible automaton: labels to skip. **Region is not ignored** so every region is a valid `Region=<name>` transition. Use `Region,AZ,Sub-AZ` to keep the old “single region page” behavior. |
| `HUAWEI_LIVE_TEST` | _(unset)_ | Set to `1` for live Playwright regression tests. |
| `GRAPH_RENDER_DPR` | `2.5` | Device scale for `render:service-graph` PNGs (try `3` if text is still small). |
| `GRAPH_SKIP_REGION_FETCH` | _(unset)_ | Set to `1` to skip opening the calculator when exporting graph JSON (no `regions[]`). Same as CLI `--skip-region-fetch`. |

## Outputs

- `graphs/` — PNG exports from `render:service-graph`.
- `graph-specs/` — Graph definitions as JSON (`name`, `title`, `subtitle`, `states`, `edges`, plus **`regions`** from the live Region dropdown when `render:service-graph` runs online).
- `playwright-output/` — Automaton JSON/DOT/SVG/PNG from probe scripts (gitignored).
