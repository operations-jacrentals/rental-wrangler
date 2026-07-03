# Implementation Plan — The Round-Up reporting board

- **Spec:** `docs/superpowers/specs/2026-07-03-roundup-reporting-board-design.md` (approved with amendment: custom date-range picker in v1)
- **Branch:** `claude/units-card-graphs-review-n5c67n` · ships as PRs to `main` per phase, each gated + live-audited
- **Files touched:** `app.js` (new §13.6 Round-Up chapter inside the APP-25/26 region; later a removal pass in §13.5), `style.css` (`.ru-*` block), `index.html` (cache-bust only), `rule-usage.js` (regen), `docs/code-map.generated.md` (regen)

## Phase A — Shell (its own PR; no charts yet)
1. Pinned ESM imports (`@observablehq/plot`, `d3-shape`) at top of `app.js`; verify app boots with imports present (smoke).
2. `WINDOW_CATALOG` entry `{ kind: 'roundup', … }` + overlay body `renderRoundup(o)`: full-screen shell, rivets, stamped wordmark, R24 close, section headers with placeholder panels.
3. Time spine: presets (Today/Wk/Mo/30d/60d/90d/All) + **Custom…** (R22 `dateField` from/to popover; R19 flash on from>to). State: `o.range = {a,b}` on the overlay object; generalize `uCutoff` → `uRange(p|custom)`; `uBuckets(spanDays)`.
4. Entry points: header Round-Up button; card graph icons → `openOverlay({kind:'roundup', section})` + scroll-to-section. In-column panels still exist this phase (removal is Phase E).
5. Post-render mount pass scaffold (`.ru-plotmount` walker) alongside `mountDispatchMap()`.
6. **Verify var(--token) resolution on JS-set SVG attrs** with one throwaway Plot call (spec §5 risk) — fallback: `getComputedStyle` resolution helper `ruColor(name)`.
7. Gates + live-login harness (extend `shoot-all-cards.mjs`: open Round-Up, shoot shell) → PR → merge → deploy verify.

## Phase B — Money section (bars prove the stack)
1. `ruBars(mount, segs, opts)` via `Plot.barY` + `axisY` + `gridY` (dotted) + `Plot.text` values-on-bars; ROI text mark above revenue bars.
2. **Verify 1:1 mark↔row order** against live data (spec §5 risk) before wiring `data-nav`.
3. Click→navigate handler: close overlay → set column member → push filter term → `render()` (generalize the `js-notready` pattern; one delegated `.js-ru-nav`).
4. Panels 1–5 (revenue/category +ROI, expenses/category, revenue/status +uncollected overlay, top customers, balances). Leaderboards = HTML ports.
5. Range plumbing live end-to-end (presets + custom). Gates + harness (Money section, 3 timeframes + one custom range) → PR.

## Phase C — Trends (lines/areas) + today's-reality snapshots
1. `ruLine` (`Plot.line`+`dot` endpoint), `ruArea` (`Plot.areaY` stacked, cumulative-mix data unchanged).
2. Today's-reality pinned column component (number + mini status bar) on panels 6, 9, 10, 11.
3. Panels 6, 9 (area + queue donut placeholder till Phase D), 10-trend, 11-trend. Gates + harness → PR.

## Phase D — Donuts (d3-shape) + remaining panels
1. `ruDonut(mount, segs, opts)`: `pie()`+`arc()`, center total+noun, in-slice counts, thin-sliver callout fan (port today's collision logic onto d3 angles).
2. Panels 7, 9-queue, 10-donut, 12, 13, 14, 16, 17 + stat tiles (8).
3. Full-board harness sweep, all sections × timeframes × one custom range; click-navigate smoke on each mark type. Gates → PR.

## Phase E — Removal pass (separate PR = rollback hatch, spec §9)
1. Delete `graphPanelV2`/`unitsGraphPanel` chrome, `uDonut/uBars/uRevBars/uArea/uTraj/uXAxis`, `.ug-*` CSS; keep all data assembly + filter cols (now serving Round-Up).
2. Card graph icons: drop `graphView` toggling (already rewired in Phase A); `gvOpen`/`gvSyncClosed` cleanup for V2 srcs; keep shop-'all' stackbars + mechanic landing untouched (regression-shot it).
3. Dead-code sweep, code-map regen, rule-usage regen. Gates + full harness + live deploy verify → PR.

## Standing rules every phase
Real-login audit before every push (zero console/page errors); screenshots self-critiqued before Jac sees them; cache-bust `?v=` per deploy; R-rulebook stamps + regen when usage changes; commit messages carry no model ids; $-data role-gating stays Jac's open call (build sections gateable).
