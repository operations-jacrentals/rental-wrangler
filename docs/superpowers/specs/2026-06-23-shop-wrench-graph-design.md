# Shop wrench toggle + 3-bar shop graph — design

**Date:** 2026-06-23
**Branch:** `claude/mobile-app-improvements-xunrtg`
**Status:** approved (design); spec pending Jac's review

## Goal

Give the shop crew a one-glance "what's on my plate" front page. Replace the
left-column **Service-heart toggle** and the **Not-Ready clipboard chip** with a
single wrench **"Shop"** toggle that opens a focused **3-bar graph**
(Not Ready · Services · Work Orders) over the shop list. Make that graph the
default landing view for the shop roles, on desktop **and** phone. Fold the phone
footer's shop sub-types into the one Shop entry (which also fixes a highlight/swipe
bug).

## Current state (what already exists)

- **Graph machinery:** `cs.graphView` flips a card between list and graph;
  `graphViewsFor(card)` returns view descriptors (`pie` / `bars` / `lead` / `nums`)
  rendered as a carousel by `graphPanelHtml`; `gvOpen` / `gvChevron` drive it; bar
  segments carry `{col, value, label, count, color}` and clicking a segment filters
  the list via the segment-match switch `totColMatch` (`app.js:2049`, the
  `col === '__…'` cases + a fallback to the normal column match).
  **No shop view is defined today** — the shop card falls back to a legacy combined
  `cardGraphBody('shop')` dashboard (`app.js:6191-6193`).
- **Shop card:** `shopCardEl` renders the three `SHOP_SEGMENTS`
  (`inspections` / `workOrders` / `serviceOrders`) as a segment bar; `SHOP_TYPES`
  fold to the single `'shop'` engine card; `shopAlertCount` already computes the
  "needs work" count per segment.
- **Desktop toggles:** `colTabButtonsHtml` (`app.js:5861`) builds the left column's
  `coltab` row. Today it shows **Units · Categories · Service(heart)** plus a
  **Not-Ready clipboard chip** (`nrChip`, `js-notready`, count of
  `inspectionStatus === 'Not Ready'`). `inspections` / `workOrders` are
  `HIDDEN_TABS` (render only while active).
- **Phone footer:** `MOBILE_CARDS` (`app.js:6685`) =
  `['units','categories','inspections','serviceOrders','rentals','calendar','customers','invoices']`
  — note **`workOrders` is absent**, and `currentMobileMember()` (used for the
  footer highlight + swipe-step) does **not** fold shop-types the way
  `activeMobileCard()` does. So landing on a shop sub-type leaves the footer with no
  active toggle and mis-indexes the swipe. (Bug — fixed here.)
- **Roles:** `ROLES` = mechanic, mtech, driver, office, sales. `currentRole` is set
  at login (`app.js:14350`). **No per-role default landing exists today.**
- **Service urgency:** `topServiceForUnit(rec).status` is `'past-due'` (overdue),
  `'due-soon'` (due), else on-schedule. Already filterable via the `__svcstat`
  segment (`app.js:2063-2071`).
- **Icons:** `wrench` → `CARD_ICON.workOrders` (Lucide wrench, `app.js:2168`),
  `serviceOrders` = heart, `inspections` = clipboard. The wrench is the natural
  Shop mark.

## Design

### 1. The wrench "Shop" toggle

- Introduce a single **`'shop'` toggle** in the left column's `coltab` row, using
  the wrench icon and label "Shop". It **replaces** the `serviceOrders` (Service
  heart) toggle and the `nrChip` Not-Ready chip. `inspections` / `workOrders` /
  `serviceOrders` are no longer standalone toggles — they are reached *through* Shop
  (via the bars or the in-card segment bar).
- Tapping the Shop toggle activates the shop card **with the graph showing**
  (`graphView = true`), defaulting to the 3-bar view.
- The toggle carries the existing **alert** treatment (red) when any of the three
  buckets is non-zero, so the crew sees "work waiting" at a glance even before
  opening it. Count badge = total needs-attention items across the three bars.
- **Phone footer:** in `MOBILE_CARDS`, replace the `inspections` + `serviceOrders`
  entries with one `'shop'` entry → `['units','categories','shop','rentals','calendar','customers','invoices']`.
  Fix `currentMobileMember()` to fold `SHOP_TYPES → 'shop'` (mirror
  `activeMobileCard`) so the footer highlight and the swipe-step index track
  correctly. `goToCard('shop')` opens the shop card in graph view.

### 2. The 3-bar graph (shop "front page")

A new **`graphViewsFor('shop')`** returning a single `bars` view, `key: 'shopfront'`,
title "Shop", with three bars (needs-attention only — on-schedule/complete excluded):

| Bar | Stacking | Count = | Drill target (tap a segment) |
|---|---|---|---|
| **Not Ready** | single (yellow) | units with `inspectionStatus === 'Not Ready'` | shop → inspections segment, scoped to Not-Ready (reuse the existing Not-Ready filter) |
| **Services** | **stacked** — red `past-due`, yellow `due-soon` | units whose `topServiceForUnit().status` is `past-due` **or** `due-soon` | shop → serviceOrders segment, filtered to that `__svcstat` value |
| **Work Orders** | **stacked by Journey (`woPhase`)** — one segment per open phase, each in its phase color | open WOs (`phase !== 'Complete' && !cancelled`) | shop → workOrders segment, filtered to that phase |

- **Stacked bars are a core requirement.** Both Services and Work Orders are
  multi-segment stacks; only Not Ready is a single bar. The `bars` renderer (today
  single-color) gets a small extension to draw a stacked bar from an array of
  `{value, label, count, color}` sub-segments, with the segment total as the bar
  height. Tapping a sub-segment drills to that exact value; tapping the bar body
  (or its label) drills to the whole segment.
- **Services** stacks two sub-segments — overdue (`past-due`, **red**) and due
  (`due-soon`, **yellow**) — so overdue load reads at a glance.
- **Work Orders** stacks by **journey phase** using the live `woPhase` set
  (`config.js:283`), Complete excluded: e.g. `Part Needed` (red), `Part Ordered`
  (blue), `Part is Local` / `No Part Needed` (yellow), `Part in Stock` (green),
  `Part Needed?` (purple) — each in its status color, so the journey bottleneck
  distribution (what's stuck waiting on parts vs ready to work) is visible at a
  glance. Order the stack by the journey sequence.
- Tapping a segment reuses the existing segment-click → list-filter path
  (`totColMatch`): `__svcstat` already covers Services; `woPhase` is a normal
  workOrders column so the fallback column-match already filters WOs by phase; only
  the Not-Ready case may need a small `col` addition.

### 3. Shop-role default

- On login as **Mechanic** or **M.Tech**, land on the Shop card with the graph up:
  - Desktop: set the left column's active member to `'shop'` and `graphView = true`.
  - Phone: make `'shop'` the active footer card with `graphView = true`.
- All other roles land normally; the wrench toggle is available to everyone.
- Implemented as a small post-login hook keyed off `currentRole ∈ {mechanic, mtech}`
  — a default only (the crew can navigate away freely; not a lock).

### 4. Visual language (`/jactec-ui` + `/frontend`)

- Wrench Shop toggle = a standard `coltab` (icon-only `compact`), wrench glyph,
  keeping the existing on/alert states. No new component shape.
- Bars use the yard palette: caution-yellow (`--yellow`), safety-orange where an
  accent reads best, danger-red (`--red`); stamped Saira Condensed bar labels;
  reduced-motion respected (no bar-grow animation when set). Run the toggle + graph
  through `/jactec-ui` then `/frontend` before finalizing.

## Files touched

- `app.js`: `colTabButtonsHtml` (swap Service+nrChip → wrench Shop), `MOBILE_CARDS`,
  `currentMobileMember` (fold shop-types), `graphViewsFor` (+`'shop'` case),
  `memberCardEl`/`memberIcon` (handle the `'shop'` pseudo-member), the `bars`
  renderer (stacked multi-segment support for Services + WO journey), `totColMatch`
  (drill targets — Not-Ready case), the post-login hook.
- `style.css`: stacked-bar segment styling; wrench toggle is an existing `coltab`.
- No backend (`Code.js`) change. No new popup window → no `WINDOW_CATALOG` change.

## R-rulebook / gates

- New/changed UI elements get/keep their `data-r` stamps; regenerate
  `node ci/gen-rule-usage.mjs` (no `--check`) if rule usage changes, then
  `--check` must pass.
- Gates before push: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`
  (Playwright gates run in CI).

## Out of scope (YAGNI)

- No changes to the existing units/rentals graph carousels.
- No new service/WO/inspection data model or backend fields.
- No role-based locking — the shop-role default is a landing default only.
- No reordering of the other columns' toggles.

## Open questions / verify on-device

- **Not Ready drill target:** units-list filtered to Not-Ready (the established
  `js-notready` affordance) vs the inspections segment. Defaulting to the existing
  Not-Ready filter; confirm during build.
- Touch double-tap-to-anchor timing (`DBL_MS = 220`) may want widening for touch —
  tracked separately from this feature.
