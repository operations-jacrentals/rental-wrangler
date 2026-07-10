# Graph Section — Charting Library Migration (Observable Plot + D3-shape)

- **Date:** 2026-07-03
- **Status:** SUPERSEDED IN PART by `2026-07-03-roundup-reporting-board-design.md` (Jac: "completely throw out what we have and make it all brand new"). **§4 (library choice + rejected alternatives) still stands and is referenced by the successor.** §5–§7 (swap-internals-keep-chrome integration) are dead — the in-column graph panels are being removed entirely, not re-skinned.
- **Branch:** `claude/units-card-graphs-review-n5c67n` (continues the graph-redesign work)
- **Depends on:** the shipped §13.5 "Graph V2" redesign (tabs, time-rail, fixed groups, fixed-height panels — PRs #450/#456/#457/#459). This migration replaces the **mark-rendering internals only**; the chrome around them (tabs, rail, group pairing, panel layout, filter state) is unchanged.

## 1. Problem / motivation

Today's Graph V2 build required several live-review rounds to get right: axis math, bar bottom-anchoring, label-collision avoidance on donut slivers, chip removal. Jac: *"without having to learn how to build great graphs and reporting myself I'd like to find a skill online we can download to help us."* No off-the-shelf skill/plugin/MCP server actually fits (searched and vetted three marketplaces — see chat log; nothing integrates with our Sheets-backed data model, our click-to-filter interaction, and our CSS-token theming). The real fix is to **stop hand-rolling the chart math ourselves** and lean on established, battle-tested rendering libraries for the parts that are genuinely hard to get right (axis scales, arc geometry, label collision), while keeping everything else about our system (data shape, interactivity, theming, layout) as-is.

## 2. Goals

- Replace the hand-built SVG-string generators (`uDonut`, `uBars`, `uRevBars`, `uArea`, `uTraj`) with real charting libraries for the underlying mark geometry (bar rects, arc paths, line paths, axis ticks/gridlines).
- Preserve 100% of existing behavior that isn't chart *geometry*: the tab/rail/group chrome, the fixed 184px panel height, click-to-filter wiring (`.js-ug-seg` → `uToggleSeg`), keyboard focus + `aria-label`, the jactec-ui token theming, empty states, the R-rulebook.
- Fit the app's existing **stateless, full-rebuild-every-`render()`** architecture with zero new lifecycle plumbing (no persistent chart-instance tracking).

## 3. Non-goals

- **`uLead` (leaderboards) and `uTiles` (stat tiles) are NOT charts** — they're styled HTML rows/buttons, no SVG geometry involved. Out of scope; unchanged.
- **No new "exotic" mark types this pass** (box plots, trend-line overlays, difference shading) — noted as later options, not built now (Jac: "I dont have anything specifically in mind").
- **No build step / bundler introduced.** Libraries load via pinned CDN ES-module imports, same pattern as the existing `import { DATA } from './data.js'` — consistent with how Stripe (`<script src="https://js.stripe.com/v3/">`) and Google Fonts are already loaded.
- **Round donuts stay round** — Waffle charts (Plot's own proportion-chart alternative) were considered and explicitly declined; see §6.

## 4. Library decision (and why — recorded for institutional memory)

**Observable Plot** for bars/lines/areas + **D3-shape** for donuts (pie/arc geometry only). Two small libraries, one lineage (Plot is built on D3; D3-shape is D3's own geometry module — not a second, unrelated ecosystem).

**Explicitly rejected: Apache ECharts** (and by the same reasoning, Chart.js/ApexCharts). These have native donut support and more built-in polish, but:
- They're **stateful** (a persistent chart instance bound to a canvas/DOM node via `new Chart(...)` / `echarts.init(...)`, updated via `.setOption()`). Our `render()` rebuilds the entire DOM from scratch on every state change (`replaceChildren`) — a stateful chart would need the same singleton-remount plumbing the Google-Maps dispatch cockpit already uses (`mountDispatchMap`), *repeated for ~15 separate chart instances* across every card/tab. That's not a one-time setup cost — it's permanent added surface area (instance tracking, disposal, remount-on-rebuild) for every future chart.
- **Canvas-first rendering** means marks aren't real DOM nodes — our existing global click-delegation (`.js-ug-seg`, the same pattern used for every button/pill/row in the app) doesn't reach into a canvas. ECharts has its own `.on('click', ...)` API — a second, parallel event system living alongside our one existing pattern, forever.
- **JS-object theming** (a theme config object) vs. our CSS-custom-property tokens — needs a sync step every time a design token changes; Plot/D3-shape marks can reference `var(--green)` etc. directly as literal fill/stroke strings, so theming (including dark/light/ranch) stays automatic with zero extra code.
- ~1MB vs. Plot's ~80KB + D3-shape's ~20KB.

**Explicitly rejected: Waffle charts as the donut replacement.** Plot has no pie/donut mark at all (confirmed: no arc mark exists — [GitHub issue #80](https://github.com/observablehq/plot/issues/80), [discussion #1007](https://github.com/observablehq/plot/discussions/1007); a deliberate omission per the Plot team). Plot's own alternative for proportions is a **Waffle** mark (grid of colored squares) — genuinely relevant since it would let Plot alone cover 100% of our chart types with zero D3-shape dependency, and it sidesteps the label-collision problem entirely (no angles, no callout-fan math). Jac reviewed this and chose to keep the round donut shape (already approved today, incl. the collision-avoiding callout fan) rather than switch to squares. **Revisit later if Jac wants to try Waffle** — it remains a live, low-risk option since Plot is already in the stack.

## 5. Architecture

### Loading
Pinned ES-module CDN imports directly in `app.js`, alongside the existing `import { DATA } from './data.js'`:
```js
import * as Plot from "https://esm.sh/@observablehq/plot@X.Y.Z";
import { pie, arc } from "https://esm.sh/d3-shape@X.Y.Z";
```
(`X.Y.Z` = the current stable release at implementation time, pinned to an exact version — never `@latest` — consistent with how Lucide icons and Playwright are pinned elsewhere in this project. `esm.sh` is one option for a pinned-ESM CDN; `jsdelivr`'s `+esm` path is an equivalent alternative if it proves more reliable in testing.) No global `window.Plot`/`window.d3` pollution; matches the module-import style already used in this file.

### Render integration
Each replaced function keeps its **existing call signature** (same `ctx`/`segs`/`data` shape callers already pass) and keeps returning an HTML string for the existing innerHTML-based render pipeline — but the string now wraps a **mount placeholder** (`<div class="ug-plotmount" data-mount-id="...">`) instead of a hand-built `<svg>...`. After the DOM swap, a small post-render pass (called from the same place `mountDispatchMap()` already gets called after `render()`) walks all `.ug-plotmount` nodes, calls `Plot.plot({...})` or the D3-shape arc builder fresh for each (stateless — no instance to track, no dispose step, nothing to remount on the next `render()` since it's regenerated every time anyway), and appends the result.

### Click-to-filter (the key integration point)
Plot/D3-shape don't know about our filter system, and their own interaction APIs (Plot's `Tip` mark, hover-only) don't fit our click-to-filter model. Instead: after `Plot.plot()`/the arc builder returns its SVG, walk the rendered mark elements **in the same order as the input `segs` array** (Plot renders one DOM element per data row within a single mark, in input order) and attach the exact same attributes `uSegAttrs()` sets today: `class="js-ug-seg [on]"`, `data-card`, `data-src`, `data-metric`, `data-col`, `data-value`, `data-label`, `aria-label`, `data-tip`, `tabindex="0"`, `role="button"`. The **existing** global click-delegation handler (`closest('.js-ug-seg')` in the big event-tree switch) and the keyboard Enter/Space handler added earlier today need **zero changes** — they already just look for this class + these data-attributes, regardless of what generated the element underneath. This is verified per-mark-type during implementation (bar rects render 1:1 with input rows in Plot; arc paths render 1:1 with input rows via D3's `pie()` — both need a real check against live data before being trusted, not assumed).

### Theming
Colors passed as literal token strings (e.g. `fill: "var(--green)"`) directly in the Plot/D3-shape config — SVG presentation attributes accept `var()` natively in all evergreen browsers, so this should re-theme automatically across dark/light/ranch with no extra code. **Verify this renders correctly during implementation** (not assumed) — if a browser/context doesn't resolve `var()` on a JS-set SVG attribute, the fallback is `getComputedStyle(document.documentElement).getPropertyValue('--green')` resolved to a hex string at render time. Font (`Saira Condensed` for axis labels/values, matching today) and exact sizing (fixed to fit the existing 184px `.ug-body`, tight margins matching today's density pass) are explicit Plot/D3-shape config overrides — their defaults won't match our density, this is real configuration work, not automatic.

### What does NOT change
- `GV2` config (groups/metrics/tabs), `unitsGraphPanel`/`graphPanelV2`, `uSetMetric`/`uSetPeriod`/`uToggleSeg`, the two-up pairing layout, the time-rail, the R-rulebook stamps, the fixed-height CSS, empty-state copy, the deploy pipeline (static Pages + cache-bust `?v=`), all CI gates.
- The **data** side of every metric (`gv2MetricChart`'s per-metric data assembly — `fleetInsp()`, `uCatAgg()`, the revenue/expense rollups, etc.) is untouched; only the final "turn this `segs`/`data` array into marks" step changes.

## 6. Mapping — old → new

| Today | Becomes | Notes |
|---|---|---|
| `uDonut(ctx, segs, size, noun, empty)` | D3-shape `pie()` + `arc()`, wrapped in an `<svg>`; our existing collision-avoiding callout-fan logic for thin slivers stays, riding on top of D3's arc math instead of our hand-rolled trig | Round shape preserved exactly |
| `uBars(ctx, segs, color, emptyMsg, opts)` | `Plot.barY(...)` + `Plot.axisY(...)` + `Plot.gridY(...)` | Plot's native axis/gridline marks replace our hand-built `.ug-grid`/`.ug-gridline` DOM; in-bar value labels via `Plot.text(...)` positioned to match today's "ride inside the bar" placement |
| `uRevBars(ctx, segs, emptyMsg)` | Same `Plot.barY` base + the existing red-uncollected-cap as a second stacked/overlaid `Plot.barY` layer | |
| `uArea(bk, data, emptyMsg, names, small)` | `Plot.areaY(...)` (stacked) | Cumulative-through-window math (today's data prep) unchanged — only the final draw step moves to Plot |
| `uTraj(ctx, bk, values, color, emptyMsg, col, small)` | `Plot.line(...)` + `Plot.dot(...)` for the emphasized endpoint | Clickable buckets (today's invisible `<rect>` hit targets) rebuilt the same way, positioned from Plot's own scale functions |
| `uXAxis` (hand-rolled label thinning) | Plot's native `Plot.axisX` tick logic (handles overlap automatically) | Likely deletable entirely |

## 7. Migration sequencing (within the single full-migration pass)

Even as one migration, build and verify in this order (lowest-risk first), re-running the live-login audit harness (`shoot-all-cards.mjs`) after each step before moving to the next:
1. **Bars** (`uBars`/`uRevBars`) — Rentals Revenue, Categories Revenue/Expenses/Rentals/Units. Highest-value fix (today's most-iterated chart type).
2. **Lines/Areas** (`uTraj`/`uArea`) — Rentals Booked trajectory, Field Calls trajectory, Inspection outcomes area, WO-by-phase trajectory.
3. **Donuts** (`uDonut`) — Inspection, Fleet, Shop/WO, Service, Accounts×2, Invoices Payment Status. Highest-risk (D3-shape is new to the stack; the callout-fan logic needs careful re-verification).

## 8. Verification plan

- Reuse the existing real-login audit harness (`shoot-all-cards.mjs`) — every card/tab/timeframe, real backend data, zero console/page errors required before shipping.
- Visual diff against the current (already Jac-approved) screenshots — flag any unintended visual regression; intentional differences (e.g. Plot's native axis look vs. our hand-built one) called out explicitly for sign-off, not silently shipped.
- All existing gates unchanged and must stay green: `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`.

## 9. Risks

- **CDN dependency** for two more scripts — consistent with existing practice (Stripe, Fonts), not a new risk category, but noted.
- **Per-mark-type click-wiring assumption** (elements render 1:1 with input array order) needs real verification per mark type, not just asserted — first implementation task, not assumed true from documentation alone.
- **`var()` inside JS-set SVG attributes** needs a real browser check (see §5 Theming) before the whole theming approach is trusted.
- **Rollback:** trivial — the current hand-built functions are proven, shipped, and stay in git history; if any mark type doesn't work out during implementation, that one function can revert independently without unwinding the others.

## 10. Open items for Jac's review

1. Confirm the exact library choice + rejected alternatives (§4) reads right — this is the one-way-door decision (swapping back later is a real redo, not a config flag).
2. Confirm scope (§3): leaderboards/tiles stay as-is, only donut/bar/area/trajectory geometry changes.
3. Confirm sequencing (§7) — bars first, donuts last — or reorder if a different priority matters more.
