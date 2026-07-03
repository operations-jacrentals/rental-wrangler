# Units Card Graph Section — Redesign (tabs · time-rail · in-chart labels · pie→time-series)

- **Date:** 2026-07-03
- **Status:** Draft for review (design approved verbally in-session; written spec pending Jac's redline)
- **Branch:** `claude/units-card-graphs-review-n5c67n`
- **Design language:** yard data-plate (`jactec-ui`) — dark steel, ONE safety-orange accent, registry green/yellow/red, Saira Condensed labels. NOT the reference image's blue-neon skin.
- **Code seams:** `APP-24 §13.3 Card Graph View` (`app.js:~8621`), `APP-25 §13.4 Graph Carousel` (`app.js:~8727`), `graphViewsFor` / `gvRenderView` / `graphPanelHtml` / `loadGvWin` / `openGvWinMenu`; styles `style.css` `.gv-*` (`~1810–1921`).
- **Reference:** Jac's "PERFORMANCE TRACKING DASHBOARD | 90-DAY VIEW & TODAY'S REALITY" mockup + the in-session artifact (`combined-A+B-in-chart-labels`).

---

## 1. Problem / motivation

The current per-card Graph carousel (Units) has real weaknesses surfaced in the design review:

1. **Wasted real estate.** The chart sits in a tall column with large empty vertical bands (a donut ~130px tall floating above a mostly-empty area); the bar view is even emptier.
2. **A separate right/legend pill column** duplicates information that could live on the chart, eating horizontal width.
3. **Chevron carousel** hides which graphs exist — you cycle blind through 6 views.
4. **A redundant per-chart title + a "Current" label** repeat what the selected tab and selected period already say.
5. **Pies can't show time.** Inspection/Fleet/Shop are snapshots by nature; there is no way to see how a metric trended over a period.
6. **Correctness bugs** (from the review, folded into this redesign):
   - The *Shop · Open WOs* donut treats overlapping subsets as exclusive wedges (Parts-Ordered ⊆ Open-WOs) → the total double-counts.
   - Bar/time views have **no empty state** — zero data renders as red baseline stubs under a void, reading as "broken."
   - First-open **auto-selects the smallest slice and fills it safety-orange**, inverting emphasis and putting `--accent` on a status chip (breaks the color law).

## 2. Goals

- Replace the chevron carousel with **named metric tabs across the top** of the graph section.
- Add a **left-hand vertical time-period rail**: **Current · This Week · This Month · Last 30 · Last 60 · Last 90**.
- **Current = the snapshot form** (donut / stat tiles). **Picking a window morphs it into a time-series** — a **trajectory line** for single-value counts, or a **stacked proportional-area** for status breakdowns — with a **"today's reality" snapshot** pinned at the right edge.
- **Fold the counts into the chart** (direct labels on slices / band-edge labels) and drop the separate pill column; the **slice/band/caption becomes the click-to-filter control**.
- **Remove the per-chart title and the "Current" static label** (redundant with the selected tab + selected period + the caption key).
- **Denser layout** — reclaim the vertical + horizontal space; the reclaimed width enables an optional **two-up** (two metrics side by side).
- Fix the three correctness bugs above as part of the rebuild.
- Stay 100% inside the yard data-plate language + pass all gates (R-rulebook, smoke, logic, rule-usage, window-catalog, code-map).

## 3. Non-goals

- The full wide "performance board" (reference-faithful multi-chart stack on its own surface) — captured as **future work** (§10), not this pass.
- Backend changes / new stored history (see the data-availability decision in §6).
- Restyling the other cards' graphs (Rentals/Customers/etc.) — the carousel is shared, so the redesign must not break them, but this spec's scope is the **Units** metrics. Rollout to other cards is a follow-up.

## 4. Layout

The graph section (shown when `cs.graphView` is on, in place of the list) is a three-band plate:

```
┌───────────────────────────────────────────────┐  ← card
│  INSPECTION  FLEET  SHOP  FIELD CALLS  #S       │  metric TABS (top)
├──────┬──────────────────────────────────────────┤
│ NOW  │                                           │
│ WEEK │        [ donut  |  trajectory  |          │  time-RAIL (left)  +  CHART (fills reclaimed width)
│ MONTH│          stacked proportional-area ]      │
│ 30D  │                                           │
│ 60D  │                                           │
│ 90D  │   ● Ready   ● Not Ready   ● Failed        │  caption KEY (series names; the filter controls)
└──────┴──────────────────────────────────────────┘
```

- **Metric tabs** (top): one per Units metric (§5). Selected tab = solid orange + dark ink (R-tab convention). Horizontally scrollable if they overflow the column. Replaces `gvChevron` + the dots indicator.
- **Time rail** (left, ~56–64px): the period selector. Selected period = **orange outline + soft fill** (armed, not solid — it's a mode, distinct from the tab's solid fill). Replaces the top `gv-win` pill + `openGvWinMenu` dropdown. **Disabled/hidden for snapshot-only metrics** (see §6) — those show `Current` only.
- **Chart** (center): fills the width the pill column used to occupy. No title line; no "Current" label.
- **Caption key** (below chart): the series names with color swatches — one compact wrapping row. This is the click-to-filter control (replaces the old pill legend); counts live **on the chart**, not here.
- **No separate right pill column.**

### Two-up (Phase 2)
Because labels moved onto the charts, two metrics fit side by side under shared tabs + one shared time-rail (e.g. Inspection + Shop). Donuts run smaller in a 1/3 column — acceptable at a glance, detail on tap. Gated behind Phase 1 landing; a header "Show: A + B" control picks the pair.

## 5. Metrics (Units) — snapshot + windowed forms

Each metric declares: its **Current (snapshot)** form, its **Windowed (time-series)** form, its **dated source**, and whether it supports a real time-series.

| Metric | Current (snapshot) | Windowed (time-series) | Dated source | Time-series? |
|---|---|---|---|---|
| **Inspection** | donut: fleet readiness now — Passed/Not Ready/Failed of all units (green/yellow/red), count on each slice, total in center | **stacked proportional-area** of inspection **outcomes** over the window (Pass/pending/Fail from `DATA.inspections` by `date`), band-edge % labels + today-snapshot | `inspections.date` + `inspResult()` | ✅ (see §6 denominator note) |
| **Shop** | **FIX (shipped)**: two independent count tiles — *Work Orders* + *Parts Ordered* (Parts ⊆ WOs, so a summing pie would double-count) — renamed from "Open WOs" per Jac | — (WO-phase-over-time deferred) | `workOrders` | current-only for now |
| **Field Calls** *(combined — was two tabs; Jac)* | leaderboard (top units by FC count) | **trajectory line** — FC count per bucket, clickable buckets | `workOrders(woType='Field Call').date` | ✅ |
| **Fleet** | donut: fleet composition (Active/Onboard/Inactive/…) | — no dated history → **Current only** (no rail). **Fleet history is a confirmed future need (Jac)** — see §10 | `units.fleetStatus` (current only) | ❌ today |
| **By the Numbers** | stat tiles (FC / Work Orders / Parts / Wash / For Sale) | tiles stay; optional per-tile sparkline where a dated source exists (stretch) | mixed | ⚠️ partial |

Fixes folded in: Shop overlap (row 2), empty states for every windowed form (§7), and the removal of auto-orange-smallest (§7).

## 6. Data availability & the morph — the one real decision

Jac's mental model: *"show the performance numbers of the current graph in a different style over time."* This is literally possible **only for metrics backed by a dated event log.** Current-state fields (a unit's `fleetStatus`, a unit's current `inspectionStatus`) have **no history** — we don't store daily snapshots — so a true "same metric over time" isn't derivable today.

**Resolution (recommended):**
1. **Enable the time-rail only where a dated source exists** (Inspection, Shop/WOs, Field Calls). Snapshot-only metrics (Fleet, and the pure current-readiness) show **Current** with the rail collapsed to a single non-interactive "Current" affordance — never a broken/empty time-series.
2. For enabled metrics, the windowed series is derived from the **event log**, which introduces a **denominator shift** worth naming:
   - *Inspection · Current* = readiness of the **12 units right now**.
   - *Inspection · 90D* = outcomes of the **N inspection events** in that window.
   Both map to the same green/yellow/red identity (Passed/Pass · Not Ready/pending · Failed/Fail), so the morph stays visually coherent; the meaning shifts from "fleet state now" to "inspection performance over time." Given titles are removed, the **caption key + the selected period** carry the disambiguation; if that's judged insufficient we add a one-line micro-caption only in windowed mode.
3. **Future (out of scope):** begin recording a daily status snapshot (backend) to enable a true readiness-over-time trajectory. Noted in §10.

> **DECISION FOR JAC:** OK to source windowed charts from the event log (accepting the denominator shift), rail-disabled on history-less metrics? Alternative is to defer all time-series until we build snapshot history (bigger, backend).

### Period definitions
- **Current** — snapshot; no time axis.
- **This Week** — current calendar week to date (locale week start → today).
- **This Month** — current calendar month to date (1st → today).
- **Last 30 / 60 / 90** — rolling N days ending today.
- Bucket granularity for the series adapts (reuse/extend `gvBuckets`): This Week → daily; This Month / 30 / 60 → weekly; 90 → weekly or ~monthly. Stamp nothing on a title (removed); the selected rail item is the scope indicator.

## 7. Chart craft (folds in the review fixes)

- **Donut, direct-labeled:** count rendered on each slice (inside when the wedge is wide enough, else a short leader just outside); center = total + unit noun; slices are the clickable filter. Caption row = series names only.
- **No auto-orange-smallest:** on open, **show the whole snapshot with nothing filtered** (default = no active filter). Selecting a slice/band/caption **arms** a filter — armed state = the series' own status color + an **orange outline/lift**, never an orange fill on a status chip.
- **Stacked proportional-area:** green/yellow/red bands, faint gridlines, **band values labeled at the right edge** (like the reference), a 2px surface gap between bands. A "today's reality" mini stacked bar + number pinned at the right.
- **Trajectory line:** 2–2.4px line in the metric's hue, faint area fill, **emphasized endpoint** dot + today value. (Field Calls trend uses **blue** as the calm trend hue, matching the app's other monthly bars; red is reserved for the *Most Field Calls* attention leaderboard.)
- **Empty state (all forms):** a single "No data in this window." line (matching today's `lead`/`pie` empty states) — never bare red baseline stubs.
- **Zero-value bars:** faint baseline gridline, not red.

## 8. Interaction & state

- `cs.graphView` (unchanged) toggles the section.
- **Metric selection:** replace `cs.graphIdx` chevron cycling with a metric key selected by tab click (keep an index internally for order). Tabs call a `gvSelectMetric(card, key)`.
- **Period selection:** generalize `loadGvWin/saveGvWin`. New option set `['now','wk','mo',30,60,90]` (`now` = snapshot). Persist per-source in `localStorage` (as today). `gvWinCutoff` extended for calendar week/month.
- **Filtering:** unchanged mechanic — slice/band/caption toggles a `g`-tagged term in `cs.filterTerms` via `toggleGraphSeg`; `gvSegOn` drives the armed state. Removing auto-select = don't seed a default term in `gvRestore`.
- **Keyboard/focus:** tabs and rail items are buttons with visible `:focus-visible`; arrow-key roving optional. Slices remain pointer add-ons; the caption key is the keyboard-accessible filter path.
- Removed: `gvChevron`, the dots indicator, `graphPanelHtml`'s title + `winCtl` static "Current", `openGvWinMenu` dropdown (replaced by the always-visible rail).

## 9. Design-language / rulebook / gates

- **New/changed UI elements get `data-r` stamps** and route through §5 builders: the metric tabs, the time-rail period buttons, the in-chart filter slices/bands, the caption-key filter chips, the today-snapshot. Map each to an existing rule where one fits (tab → selected-tab convention; caption chip/slice filter → the graph-seg filter family) or add a `RULE_META` row + `RB_FOUNDATION`/`RB_TABS` entry in the same edit if a genuinely new element type appears.
- Regenerate `rule-usage.js` (`node ci/gen-rule-usage.mjs`) whenever rule usage changes; `--check` is the gate.
- **Windows:** the graph section is in-column, **not a popup** → no `WINDOW_CATALOG` entry expected. The removed `openGvWinMenu` was a floating dropdown, not a catalogued window. Confirm `ci/check-window-catalog.mjs` stays green.
- Mirror all treatments across **dark + light (+ ranch)** via tokens only; verify AA contrast for band labels on their fills (dark ink on green/yellow, white on red).
- Respect `prefers-reduced-motion` (no morph animation flourish beyond the app's standard).
- **Gates before push:** `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`, zero R0 flash-lint, self-critique screenshot. (Swap port 8000→9147 for the browser gates, then `git checkout -- ci/`.)

## 10. Phasing

- **Phase 1 (shipped):** the in-column redesign — tabs, left time-rail, in-chart counts, no titles/Current-label, caption-key filter, pie→time-series morph for the history-backed metrics, snapshot-only handling for the rest, + the three correctness fixes. Units only.
- **Phase 2 (shipped):** two-up (side-by-side pair) via a "2-Up" toggle using the reclaimed width; each column labeled; shared time-rail. Field Calls combined into one tab; "Open WOs" → "Work Orders".
- **Phase 3 / future:**
  - **Fleet history (confirmed need, Jac):** we store only current `fleetStatus`, so a "fleet increasing/decreasing by area over time" trend can't be derived retroactively. Requires **recording a periodic (daily) fleet snapshot** to the backend (new stored series) — start capturing now so the trend accrues. This also unlocks true readiness-over-time for Inspection. **Backend work → ships via `/clasp`, not this PR.**
  - Windowed **filtering** on the stacked-area/trajectory marks (Phase 1/2 windowed marks are read-only except FC buckets).
  - Roll the pattern to the other cards' carousels; a dedicated **wide performance board** (reference-faithful) for an office monitor.

## 11. Open decisions (for Jac's redline)

1. **Event-log sourcing + denominator shift** (§6) — accept, or defer time-series until snapshot history exists?
2. **This Week / This Month = calendar-to-date** (vs rolling 7 / rolling 30) — confirm.
3. **Two-up default pair** for Units (Inspection + Shop?) and whether it's Phase 1 or Phase 2.
4. **Default filter on open** — confirm "nothing filtered" (my recommendation) vs keeping the old "smallest slice armed" triage behavior.
5. **Windowed micro-caption** — rely on tab+period+key only, or allow a one-line caption in windowed mode to name the shifted denominator?
