# Implementation Plan — Units Graph Redesign (Phase 1)

- **Date:** 2026-07-03
- **Spec:** `docs/superpowers/specs/2026-07-03-units-graph-redesign-design.md`
- **Branch:** `claude/units-card-graphs-review-n5c67n` · **PR:** #450 (draft)
- **Scope:** Phase 1 only — the in-column redesign for the **Units** card. Two-up (Phase 2), other cards, and the wide board (Phase 3) are out of scope here.

## Architecture decision (blast-radius control)

`graphViewsFor` / `gvRenderView` / `graphPanelHtml` are **shared by every card + Shop**. To avoid destabilizing Rentals/Customers/Invoices/Shop while reshaping Units:

- **Gate the new chrome + forms to `card === 'units'`.** Add a `unitsGraphViews()` producing the new metric model (snapshot + windowed forms + `hasHistory`), and a `graphPanelHtmlV2()` for the tabs + left rail. `graphPanelHtml` dispatches to V2 only for Units; every other card keeps today's chevron carousel untouched.
- Shared low-level helpers (`pieSVG`-style donut, `gvBuckets`, `gvSegOn`, `toggleGraphSeg`) are reused, not forked, where they don't change behavior for other cards.
- Generalizing the new chrome to all cards is a later phase once Units is proven.

## Build order (each step ends green before the next)

1. **Period model.** New option set `['now','wk','mo',30,60,90]`. Extend `gvWinCutoff` for calendar week/month (`wk` = locale week start→today, `mo` = 1st→today; `30/60/90` rolling). `now` = snapshot (no series). Add `gvBucketsFor(period)` (wk→daily, mo/30/60→weekly, 90→weekly/monthly). Keep per-source `localStorage` persistence. Unit-test the cutoffs in `ci/logic-test.mjs` if a seam exists, else a scratch check.
2. **Metric model (`unitsGraphViews`).** Each metric: `{ key, label, hasHistory, snapshot(), series(period) }`.
   - Inspection: snapshot = unit readiness donut (Passed/Not Ready/Failed); series = inspection outcomes proportional-area (`DATA.inspections` by `date` + `inspResult`).
   - Shop·Open WOs: snapshot = **mutually-exclusive** donut (Parts Ordered vs Open-no-parts) — fixes the overlap bug; series = WO phases proportional-area (`workOrders` by `date`+`phase`).
   - Field Calls: snapshot = count tile; series = trajectory (FC/bucket, blue).
   - Most Field Calls: leaderboard (snapshot + windowed).
   - Fleet: snapshot donut; `hasHistory:false` → rail = Current only.
   - By the Numbers: stat tiles; Current-first (sparkline stretch, optional).
3. **Renderers.**
   - `gvDonutLabeled` — in-slice counts (leader for thin slices), center total+noun, slices clickable-to-filter, caption-key row of series names (the keyboard filter path). Replaces the right pill legend.
   - `gvStackArea` — green/yellow/red bands, faint grid, right-edge band-% labels, 2px band gaps, today-snapshot mini-bar + number.
   - `gvTrajectory` — hue line, faint area, emphasized endpoint + today value.
   - Empty state for every form ("No data in this window."); zero bars = baseline gridline, not red.
   - **Remove auto-select-smallest** (no default `g`-term in the units path).
4. **Chrome (`graphPanelHtmlV2`).** Metric tabs on top (selected = solid orange); left time-rail (selected period = orange outline+soft fill; collapsed to a static "Current" when `!hasHistory`); **no title, no "Current" label**. Wire `js-gv-tab` → select metric, `js-gv-per` → select period. Remove chevrons/dots/`openGvWinMenu` for the Units path.
5. **CSS (`style.css` `.gv-*`).** Tabs, rail, in-chart labels, denser spacing; delete title styles from the Units path; dark + light + ranch parity via tokens; AA on band labels (dark ink on green/yellow, white on red).
6. **R-rulebook.** `data-r` stamps on tabs, rail buttons, filter slices/bands/caption chips, today-snapshot — map to existing rules where they fit, else add `RULE_META` + `RB_FOUNDATION`/`RB_TABS` rows in the same edit. Regenerate `node ci/gen-rule-usage.mjs`. Confirm no `WINDOW_CATALOG` change (in-column, not a popup).
7. **Gates + self-critique.** `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`, zero R0 lint. Screenshot the real rendered Units graph (headless harness, seed data) for a before/after self-critique. Port 8000→9147 for browser gates, then `git checkout -- ci/`.

## Test checkpoints

- After step 3: render each Units metric at Current + a window in the harness; confirm counts, labels, empty states, no auto-filter.
- After step 4: tab-switch + period-switch drive the chart; filtering via slice/caption still filters the list (`toggleGraphSeg` intact).
- Before push: all gates green; screenshots captured; other cards' graphs visually unchanged (regression check on Rentals/Shop).

## Risks

- **Shared-code regression** — mitigated by the Units-only gate; explicitly re-check other cards.
- **History semantics** (denominator shift) — accepted per spec §6; caption + period carry disambiguation.
- **Thin-slice labels** — leader-line fallback; verify at real seed counts.
- **File size** — `app.js` is large; keep new functions in the APP-24/25 chapter and update the code-map if a banner moves.
