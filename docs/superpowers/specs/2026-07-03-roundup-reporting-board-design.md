# The Round-Up — a brand-new full-screen reporting board (clean-sheet graph replacement)

- **Date:** 2026-07-03
- **Status:** Draft for Jac's review
- **Branch:** `claude/units-card-graphs-review-n5c67n`
- **Directive (Jac):** *"I want you to completely throw out what we have and make it all brand new."* This spec is the clean sheet: the in-column Graph V2 panels are **removed**, and reporting moves to a purpose-built full-screen surface.
- **Supersedes:** `2026-07-03-graph-charting-library-migration-design.md` §5–§7 (the "swap internals, keep chrome" integration plan). Its **§4 library decision stands** — Observable Plot + D3-shape, ECharts and Waffle rejected, reasons recorded there.
- **Reference:** Jac's original inspiration image — "PERFORMANCE TRACKING DASHBOARD | 90-DAY VIEW & TODAY'S REALITY" (left time spine · trend charts · today's-reality snapshots) — rendered in the yard data-plate language, not the reference's blue-neon skin.

---

## 1. Why throw it out (root cause, not blame)

Today's Graph V2 took four live-review rounds (spacing, labels, collisions, chips, heights) because the design was fighting its container: real reporting was being miniaturized into a ~380px-wide, 184px-tall box inside a card column. Every fix traded against another (bigger donuts vs. vertical space; labels vs. collisions). Jac's original reference was never an in-column widget — it was a **dashboard**. The clean sheet stops miniaturizing.

## 2. The concept

**The Round-Up** — one full-screen reporting board (yard voice: the morning round-up of the whole operation). Open it from anywhere; read the business at a glance; click any mark to jump to the underlying records.

- **One surface, sections not tabs.** A single scrollable board with stamped section headers — **Money · Rentals · Shop · Fleet · Customers** — matching the reference's stacked-panels layout. No carousels, no per-card mini-panels, no cramming.
- **One global timeframe.** A left **time spine** (the reference's "0 DAYS → 90 DAYS" rail, our vocabulary: **Today · Wk · Mo · 30d · 60d · 90d · All**) that scopes every time-based panel at once. Snapshot panels (fleet mix, service urgency…) ignore it and are labeled by their nature, not by a "Current" chip (that lesson stands).
- **Today's reality column.** Time-trend panels carry a pinned right-edge snapshot (the current number + mini status bar) exactly like the reference image — trend on the left, "right now" on the right.
- **Click = go there.** Clicking a bar/slice/point closes the board and opens the relevant card with the matching filter pill applied (the proven `js-notready` navigate-with-filter pattern, generalized). The board is a launchpad into the records, not a dead end.

## 3. What dies, what survives

| | Fate |
|---|---|
| In-column graph panels (`graphPanelV2`, tabs/rail chrome, fixed-height CSS, `.ug-*` styles) | **Removed.** The card graph-toggle button (the chart icon on each card) now opens the Round-Up scrolled to that card's section. |
| Hand-built SVG renderers (`uDonut`, `uBars`, `uRevBars`, `uArea`, `uTraj`, `uXAxis`, callout-fan math) | **Removed** — replaced by Plot marks + D3-shape arcs. |
| Per-metric **data assembly** (`fleetInsp`, `uCatAgg`, revenue/expense rollups, `uCutoff`/`uBuckets`, the honest-denominator rules, `__insp`/`__wop`/`__svcstat`/`__fcrange`… filter cols) | **Survives intact** — this is the business logic; it feeds the new panels unchanged. |
| Click-to-filter concept | **Survives, upgraded** — from "filter the list behind the panel" to "navigate to the card with the filter applied." |
| Shop 'all' front page (mechanic-landing stackbars worklist) | **Untouched** — it's a worklist, not reporting. Mechanic/M.Tech landing behavior unchanged. |
| Design decisions Jac locked today | **All carried forward as law:** values on/above marks (never a detached row), Y-axes with dotted gridlines, bottom-anchored bars, no chips (plain stamped text, orange ink when selected), hover = plain name, no redundant titles, honest math (no overlapping-subset pies, real empty states, no auto-select). |
| Board View (spreadsheet popup), KPI rings | **Untouched** — different tools, out of scope. |

## 4. The surface

### Entry points
1. A **Round-Up button** in the header band (stamped icon + label, `data-tip`).
2. Each card's existing **graph-toggle icon** → opens the Round-Up **scrolled to that card's section** (Units icon → Fleet section, Rentals → Rentals/Money, etc.). The icon stops toggling an in-column panel.
3. `openOverlay({ kind: 'roundup', section? })` — one new `WINDOW_CATALOG` entry (**CI-gated**; `ci/check-window-catalog.mjs` must stay green).

### Layout (yard data-plate, full screen)
- Full-screen overlay on the existing overlay shell (`state.overlay` + `renderOverlay()`), steel panel, corner rivets, stamped `ROUND-UP` wordmark, standard close-✕ (R24). Esc/back behaves like every other overlay.
- **Left spine** (sticky): the timeframe control, top-to-bottom — plain stamped text, orange ink for the active period, a thin vertical rule connecting them (the reference's spine, in steel).
- **Custom date range (v1 — Jac: "important").** Below the presets, a **Custom…** spine entry opens a compact from/to popover built on the existing **R22 `dateField`** (the app-styled picker — never the native control). Applying it makes the spine show the active range as stamped text (e.g. `5/1 – 6/15`, orange ink); clicking it again clears back to **All**. Plumbing: the preset periods generalize from "cutoff → today" to a range object `{a, b}` (ISO, inclusive/exclusive) — presets emit `{a: cutoff, b: tomorrow}`, Custom emits the picked pair; `uBuckets`' granularity adaptation (daily/weekly/monthly by span) already keys off day-count and consumes the range's span directly. Every windowed rollup and trend panel takes the range; snapshot panels ignore it, as with presets. Guardrails: from ≤ to enforced with an R19 attention-flash (never a dead-end error), empty-range impossible by construction.
- **Main area**: responsive panel grid (CSS grid, 2–3 panels per row on desktop, 1 on phone). Panels are uniform-height **within a row** by grid nature — the "same size" requirement solves itself at full-screen scale.
- Each panel: stamped condensed header (e.g. `REVENUE BY CATEGORY`), the chart, and (for trend panels) the today's-reality snapshot pinned right. No legends — direct labels + hover names, as decided today.

### Panel inventory (launch set — every metric already derived today, regrouped)

**MONEY**
1. Revenue by category — Plot bars, $ values on bars, ROI% above (where cost basis exists), dotted-grid Y-axis.
2. Expenses by category (WO parts) — Plot bars.
3. Revenue by rental status — Plot bars with the red uncollected overlay.
4. Top customers by spend — leaderboard rows (HTML, not a chart).
5. Biggest open balances — leaderboard rows.

**RENTALS**
6. Bookings over time — Plot line, endpoint emphasized, today count pinned right.
7. Invoice status mix — D3-shape donut.
8. On Rent / Quotes / No Show / This Month — stat tiles.

**SHOP**
9. Inspections: outcomes over time — Plot stacked area (cumulative mix, the honest-denominator rule), today's queue donut pinned right.
10. Work orders by bottleneck phase — D3-shape donut + WOs-opened trend line.
11. Field calls — trend line + worst-offenders leaderboard.
12. Service urgency — D3-shape donut (Overdue/Due Soon/On Schedule/Wash).

**FLEET**
13. Fleet mix — D3-shape donut.
14. Units per category — Plot bars.
15. *(Future, already filed: #454 fleet history → a real fleet-size trend panel lands here when the backend snapshots exist.)*

**CUSTOMERS**
16. Account types + pay status — two D3-shape donuts.
17. Card health — D3-shape donut (Card OK / Expiring / No Card).

## 5. Technical architecture

- **Libraries:** pinned ESM CDN imports in `app.js` (`@observablehq/plot`, `d3-shape` — exact versions pinned at implementation; esm.sh or jsdelivr `+esm`). Stateless — every `renderOverlay()` regenerates panels fresh; no instances, no disposal, no remount plumbing. (Full rationale + rejected alternatives: prior spec §4.)
- **Render integration:** panel HTML renders with `.ru-plotmount` placeholders; a post-render pass (same slot where `mountDispatchMap()` runs) calls `Plot.plot({...})`/the arc builder per mount and appends the SVG. The overlay re-renders far less often than the main grid, so this is cheaper than today's approach.
- **Theming:** token strings (`var(--green)`) passed as literal fill/stroke; Saira Condensed axis/value text; **verify `var()` resolution on JS-set SVG attributes in-browser first** — fallback is `getComputedStyle` resolution at render time. Dark/light/ranch parity via tokens as always.
- **Click → navigate:** rendered marks get `data-nav` attributes (card, col, value, label) in input order (**verify 1:1 mark↔row order per mark type against live data before trusting**). One new delegated handler: close overlay → switch the column to the target card → push the filter term → `render()`. Reuses the existing filter-term machinery verbatim.
- **PII/role note (carried from today's /role audit):** the Round-Up concentrates $ data (revenue, balances, spend) on one surface, visible to all internal roles — same pre-existing exposure as today's graphs, now more prominent. The **role-gating decision remains Jac's open call**; the board should be built so sections can later be role-gated with one predicate per section.

## 6. Design-language rules for the board (jactec-ui, enforced)

Tokens only; one orange meaning (active timeframe / selected state / the Round-Up ignition button — never decorative); registry status colors; two type voices (Saira stamped headers/values, Geist body); rivets + stamped labels as the plate devices; **no hazard stripe** (Jac removed it once — stays gone unless he asks); `prefers-reduced-motion` respected; AA contrast in all three themes; every interactive element focusable with visible `:focus-visible`; R-rulebook stamps + `RULE_META` updates for any new element family; regenerate `rule-usage.js` when usage changes.

## 7. Build order

1. **Shell first:** overlay kind `roundup` + WINDOW_CATALOG + header/card entry points + time spine (no charts yet, panels as placeholders). Gates green.
2. **Bars** (Money section) — proves Plot loading, theming, value-on-bar labels, click-navigate.
3. **Lines/areas** (Rentals + Shop trends) + today's-reality snapshots.
4. **Donuts** (D3-shape) — all proportion panels.
5. **Leaderboards/tiles** (HTML ports — quick).
6. **Removal pass:** delete the in-column Graph V2 panels + dead renderers, rewire the card graph icons, `gvStripTerms` cleanup, dead-code sweep (`docs/dead-code-report.md` regeneration if applicable).
7. **Live-login audit** (extend `shoot-all-cards.mjs` → open Round-Up, shoot every section at several timeframes, click-navigate smoke test), all CI gates, cache-bust, ship.

## 8. Verification

Real-login harness against live data: every section, every timeframe, zero console/page errors; click-navigate lands on the right card with the right pill; mechanic landing unchanged; screenshots reviewed against this spec before Jac sees it (self-critique per jactec-ui). All gates: smoke · logic · rule-usage · window-catalog · code-map.

## 9. Rollback

The old system ships intact in git history through PR #459. The removal pass (step 6) is a **separate commit** from the new-board commits, so reverting just that commit restores the in-column panels while keeping the Round-Up — a real safety hatch, not a full unwind.

## 10. Open items — resolved

1. **The name** — "Round-Up" stands (no objection raised).
2. **Section order** — Money-first stands (no objection raised).
3. **Custom date range** — **IN v1** (Jac: "Date range picker is important"). Design in §4 (Left spine → Custom date range).
