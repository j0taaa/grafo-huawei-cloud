# grafoHuaweiCloud

Playwright probes and state graphs for the Huawei Cloud **pricing calculator** (e.g. CCE, DCS/Redis, RDS).

## Scripts

| Command | Description |
|--------|-------------|
| `npm run probe:huawei-pricing-visible-automaton -- --service=rds` | BFS over UI states (buttons + readonly selects). |
| `npm run probe:huawei-pricing-automaton -- --service=cce` | Full automaton (concurrency + quick signature). |
| `npm run render:service-graph -- --service=rds` | Renders `graphs/<service>.png` from the hand-maintained graph spec. |
| `npm test` | Unit tests (offline). |
| `npm run test:live` | Hits the live calculator (needs network); set `HUAWEI_LIVE_TEST=1` is automatic in script. |

## Environment (tuning)

| Variable | Default | Purpose |
|----------|---------|---------|
| `HUAWEI_AUTOMATON_SETTLE_MS` | `350` | Pause after each control change before re-reading the form. |
| `HUAWEI_AUTOMATON_CONCURRENCY` | `4` | Worker pool for `huawei-pricing-automaton`. |
| `HUAWEI_VISIBLE_AUTOMATON_CONCURRENCY` | `4` | Worker pool for `huawei-pricing-visible-automaton`. |
| `HUAWEI_VISIBLE_AUTOMATON_MAX_STATES` | _(unset)_ | Cap BFS states (safety / faster partial runs). |
| `HUAWEI_LIVE_TEST` | _(unset)_ | Set to `1` for live Playwright regression tests. |

## Outputs

- `graphs/` — PNG exports from `render:service-graph`.
- `playwright-output/` — Automaton JSON/DOT/SVG/PNG from probe scripts (gitignored).
