# Implementation Plan — Trips card (Calendar rebuild)

Spec: `docs/superpowers/specs/2026-07-09-trips-card-design.md`
Branch: `claude/calendar-card-issues-se0r5a` (area/rentals-dispatch merged in) → PR #563 → `area/rentals-dispatch`

Gates after every code phase (port 8000 reserved → swap to 9147, then restore):
```
sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs
node ci/smoke.mjs && node ci/logic-test.mjs && node ci/gen-rule-usage.mjs --check \
  && node ci/check-window-catalog.mjs && node tools/gen-code-map.mjs --check
git checkout -- ci/
```
Every UI phase runs through `jactec-ui` (screenshot + self-critique before Jac sees it).

---

## Phase 0 — Reachability + identity (small, shippable alone)

- `config.js`: add `calendar: 'middle'` to `COLUMN_OF`.
- `app.js` `goToCard()`: tolerate a card-stateless member (calendar has no
  `s.cards.calendar`) — set column/mobileCol even when `mc` is null.
- `MEMBER_TITLE`: `m.calendar = 'Trips'`; `memberIcon('calendar')` → the truck glyph
  (`I.truck`), replacing `I.grid`.
- Tab badge (`memberBadge`, member === 'calendar'): count **upcoming ∧ not-done**
  events (`ev.date >= TODAY_ISO && !stopDone(ev)`), not `dispatchEvents().length`.
- **Verify:** Playwright phone viewport — dock tap lands on the card; card swipe
  passes through it; badge matches. Gates green.
- **Commit:** "Trips card phase 0: phone reachability (COLUMN_OF), rename, honest badge".

## Phase 1 — Trip derivation + day-grouped rows (the new card body)

- **Derivation** (new, beside `dispatchEvents`): `tripsFor()` → every dispatch event
  becomes a derived trip `{id, day, time, driverId, stops:[legRef], materialized:false}`;
  materialized records (Phase 3 store) override/absorb derived ones by legRef key.
- **Grouping:** extend `appendGroupedSections` to accept `sections` as a function
  (`typeof def.sections === 'function' ? def.sections(rows) : def.sections`); add
  `GROUP_DEFS.calendar` — keyOf = day bucket (`Today`, `Tomorrow`, `SAT JUL 12`,
  `Earlier`); sections generated per render, Earlier trailing + default-collapsed.
  Day header label carries `· n` + `done/total` fraction.
- **Rows:** trip row via the universal row path (`rowEl('calendar', trip)` + a ROWS
  metadata entry): kind badge (Deliver/Pick up), tap-to-edit time (`dt-time` input
  carried over, `timeToMin` parsing), customer refPill, unit pill(s), address +
  pin-status, driver pill (`js-stop-driver`, R5b — reused verbatim), Done dimming.
  Bundled trips (Phase 3) render stacked sequence-numbered stops in the one row.
- **Card body** (`calendarCardEl`): listbar (mini-search over trips + the map-panel
  toggle button in the graph-button slot, Phase 2) + grouped list. Retire the
  `disp-head` day pager, `.disp-empty` void (small stamped empty plate instead),
  `.disp-cockpit`/`.disprail`/lane rail markup + CSS.
- Row tap → `dispatchFocusStop` (map open only). Within-day ordering: no-time pinned
  top, then time; keep drag-reorder writing to the times/order cache (Phase 3 moves it).
- R-stamps on all new elements; `node ci/gen-rule-usage.mjs`; code-map regen
  (§2.3 chapter banner retitles to Trips).
- **Verify:** desktop + phone screenshots (self-critique vs the data-plate language);
  gates green; footer honest (`Offline — cached` placeholder until Phase 4 sync).
- **Commit:** "Trips card phase 1: day-grouped trip rows replace the cockpit".

## Phase 2 — Map panel

- Top-of-body collapsible panel (~260px): re-parent the existing `_dispMapEl`
  singleton; route polyline/markers/truck-pos code unchanged.
- Toggle = the graph-icon slot button; **open by default everywhere** (Jac);
  last state per device (`jactec.tripsMap` localStorage).
- Maps not ready/failed → stamped **MAP OFFLINE** plate (hazard-stripe edge, mirrors
  the transport editor `.ph`/`mapFailed` pattern). `#local` always shows the plate.
- **Verify:** offline plate renders in `#local` (screenshot); no empty-black pane;
  gates green. **Commit:** "Trips card phase 2: collapsible live-map panel + offline plate".

## Phase 3 — Merge / split ("double up") on the local cache

- Materialization: first touch (merge/time/driver/reorder) writes a trip record to the
  local store (`jactec.trips` — becomes the offline cache in Phase 4):
  `{id, day, driverId, time, order:[{rentalId,unitId,task}], rev}`.
- **Merge:** drag trip row onto trip row (drag-engine drop target + haptic), or
  context menu — `contextmenu` on desktop, ⋯ button on the row for touch — →
  "Merge trip…" → `openDropdown` picker of that day's other trips. Target keeps
  time + driver; stops append. **Split out** in the same menu reverses it.
  Same-day only. Every move `logAction`-ed on the affected rentals.
- Driver on a trip writes through per leg via `assignStopDriver` (D6/D7 intact).
- Read-time hygiene: refs to missing rentals/legs dropped; emptied trips discarded.
- `ci/logic-test.mjs` additions (spec §3): derived generation, merge semantics,
  split round-trip, orphan drop, badge math, day buckets across `refreshTodayISO`.
- **Verify:** logic suite green with new cases; drag + menu paths driven headless.
- **Commit:** "Trips card phase 3: trip materialization + merge/split".

## Phase 4 — Backend sync (the `/clasp` STOP gate)

- GAS `Code.js` (gitignored — ships via `/clasp`, ADDITIVE only): `getTrips` /
  `setTrips` with stale-rev conflict rejection, keyed per day. Queue through the
  backend-deploy runbook; **STOP for Jac before prod deploy**.
- Front-end: sync layer mirroring `getGroupOrder` (debounced push, boot pull,
  `#local`/offline → cache only); footer states `Synced · rev N` / `Offline — cached`
  / conflict → re-pull + toast.
- Retire `dispatchOrderLS`/`dispatchTimesLS` as sources of truth (cache only).
- **Verify:** two-client conflict simulated in logic test (rev rejection path);
  gates green. **Commit:** "Trips card phase 4: backend-synced trips slice (D3)".

## Phase 5 — Polish + handoff

- Mobile drive (phone viewport): reachability, touch targets ≥44px, long-press drag,
  ⋯ menu, map default. Reduced-motion + focus-visible checks.
- Full gate run, `jactec-ui` final screenshot pass, PR #563 description refresh,
  handoff note in the session folder. Area merge on Jac's OK (the §3 fork).
