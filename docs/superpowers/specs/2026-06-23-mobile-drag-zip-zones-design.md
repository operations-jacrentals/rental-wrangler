# Mobile drag — zip-zones + draggable item-tabs

**Date:** 2026-06-23
**Branch:** `claude/mobile-app-improvements-xunrtg`
**Status:** approved (design); spec pending Jac's review

## Goal

Make cross-card drag-linking usable on a phone. Two complementary mechanisms,
both built on the existing drag engine + `DROP_MATRIX`:

1. **Zip-zones** — during a live drag, side zones let you jump to another card's
   column without releasing, then drop precisely on the target row.
2. **Draggable item-tabs** — open-record tabs become drag handles you can carry to
   any column, so you can navigate first (no sustained hold) and drag a short hop.

## Root cause (confirmed — this is a reachability problem, not a missing link)

The link targets Jac hit are all already wired: **Work Order → invoice** is in
`DROP_MATRIX` (`app.js:10276`, `woDroppableToInvoice`), as are unit↔rental,
invoice↔rental, etc. The pain is **reach**: on a phone only one column shows at a
time, so the source and target cards aren't both visible, and the only way across
mid-drag is `phoneDragEdge` (`app.js:10587`) — a **350ms dwell in a 30px screen-edge
zone while holding the drag**. That dwell is invisible, narrow, and slow, so
unit→rental, invoice→rental, and (deepest of all) WO→invoice feel broken.

## Current state (what we build on)

- **Drag engine §15c** (`app.js` ~10310–10720): `initDrag`, `dragDown/Move/Up`,
  `cancelDrag`, a single rAF hit-test loop (`elementFromPoint` per frame →
  `updateHot`), and the `DRAG` state object. Mid-drag re-render re-stamps targets
  via `reapplyDragDecor` (`app.js:10542`).
- **`DROP_MATRIX`** (`app.js:10256`): bidirectional source→target validators
  (specific `srcRec`/`tgtRec`). `dropTargetAt` (`app.js:10489`) resolves a row/card
  target; valid targets get `.drop-ok`, the one under the pointer gets `.drop-hot`.
- **Affordance pattern to mirror:** `cancel-arc` and `chat-drop` — fixed elements,
  slide in via transform, a hazard-stripe signature (`::before`), a `.hot` armed
  state, and a haptic tick on arm (`app.js:10520`, CSS `style.css:1288`, `2795`).
- **Phone specifics:** `cancel-arc` is hidden on phone; releasing in empty space
  already cancels (`§M2`). `state.mobileCol` (0/1/2) picks the visible column;
  `COLUMNS` order is left→middle→right.
- **Item tabs:** `tabStrip(state.tabs)` renders open-record tabs in `.header-tabs`
  (`app.js:6555`); on phone `.hr-top` is collapsed (`§M5`, `style.css:371`).

## Design

### Mechanism 1 — Zip-zones (primary)

When a drag is active on a phone, show a zone per **valid target card** (derived
from `DROP_MATRIX[source]`). Dragging onto a zone **zips** the view to that card's
column (sets `state.mobileCol` + the column's member) **without ending the drag**;
the zones then update for the new context and you drop on the precise target row.
Release on a row = link (existing path); release in empty space = cancel.

- **Trigger to zip:** the zone arms (`.hot` + haptic tick) when the drag pointer
  enters it, and fires the column jump after a **short dwell (~150ms)** — long
  enough to avoid accidental fires when dragging toward a near-edge row, far shorter
  and far more visible than today's 350ms/30px dwell. (Dwell tunable on device.)
- **Which zones:** only the source's valid targets. Unit → {Rentals, Invoices};
  Work Order → {Invoices}; invoice → {Rentals, Customers}; etc. A target already in
  the current column (e.g. Invoices when you're on Customers — both right column) is
  a member switch, not a column jump — same zone mechanism, just sets the member.
- **Side placement (by the target's column position):** left-column targets dock to
  the **left** edge, right-column to the **right** edge, middle-column (Rentals)
  docks to the side with room (default left). Multiple same-side zones stack
  vertically. Each zone is a steel tab (cancel-arc body language) bearing the target
  card's **icon + stamped Saira label**.
- **Color:** the only color is a thin per-card **hazard stripe** on each zone (the
  signature device), so you can aim by color: Units = leather-tan (`--tan`), Rentals
  = `--blue`, Invoices = `--green`, Customers = `--purple`, Shop = `--accent`. Zone
  bodies stay steel; orange stays reserved for selection/ignition/links in
  persistent UI. **This thin-stripe tint is a deliberate, documented exception to
  "one orange," scoped only to these transient drag overlays** (hue values tunable).
- **Replaces** `phoneDragEdge`'s blind dwell on phone (desktop unchanged — it shows
  all 3 columns already).

### Mechanism 2 — Draggable item-tabs (complementary)

Make the open-record **item tabs** draggable handles. Because a tab is always at the
top regardless of which column you're viewing, you can **navigate freely first** (no
held drag), open the target card, then drag the source record's tab a short hop onto
the target row/card — avoiding the sustained cross-column hold entirely.

- The tab carries the same `[data-chat-el]`-style drag payload (card + recId) and
  flows through the same `DROP_MATRIX` validation + drop link path.
- On phone the tab strip is currently collapsed (`§M5`); this mechanism needs the
  tabs **reachable while dragging** — surface the strip (or a compact tab handle)
  when there are open tabs, so a tab is grabbable. (Exact phone tab-bar treatment
  tuned during build + `/jactec-ui`.)
- Long-press a tab = arm drag (same gesture model as rows); tap a tab = its existing
  switch action (unchanged).

### Shared

- Both feed the existing `dragUp` → link dispatch; no change to `DROP_MATRIX`
  semantics or the validators.
- Let-go-anywhere-but-a-target cancels (existing). Haptic tick on zone arm + on a
  committed drop (existing vocabulary).
- Desktop behavior is unchanged by both.

## Files touched (anticipated)

- `app.js`: the drag engine (zip-zone elements built in `initDrag`; zone hit-test +
  arm/zip in the rAF loop alongside `updateHot`/`phoneDragEdge`; gate zip-zones to
  `is-phone`), a `zipTargetsFor(source)` helper off `DROP_MATRIX`, making `tabStrip`
  tabs draggable sources, and the phone tab-strip surfacing.
- `style.css`: `§M` zone styles (steel tab + per-card hazard stripe + `.hot`),
  reduced-motion, focus; phone tab-strip tweak.
- No backend change. No new popup window → no `WINDOW_CATALOG` change.

## R-rulebook / gates

- New interactive elements follow the existing drag-affordance pattern (cancel-arc /
  chat-drop carry no `data-r`; the zones match). If any stamped lint-family element
  is added, stamp it + regen `rule-usage.js`. Gates: `smoke`, `logic-test`,
  `gen-rule-usage --check`, `check-window-catalog` (Playwright in CI).
- Run the zones + tab-drag through `/jactec-ui` then `/frontend`.

## Out of scope (YAGNI)

- No changes to `DROP_MATRIX` link rules or what links to what.
- No desktop drag changes.
- No new link types.

## Open questions / tune on device (cloud session can't drive touch)

- **Zip dwell timing** (~150ms) and zone **edge widths/sizes** — tune for thumb
  reach on a real phone.
- **Middle-column (Rentals) zone side** — default left; confirm it doesn't crowd.
- **Per-card hue values** — the proposed tan/blue/green/purple/orange set is a
  starting point; adjust for legibility against the steel body.
- **Phone tab-strip surfacing** for Mechanism 2 — how prominent the tab handles are
  while dragging vs. normally (must not crowd the `§M4` header).
- **Build order:** zip-zones first (the core fix), then item-tabs — they're
  independent and can land in separate commits.
