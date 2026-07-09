# Trips card (née Calendar) — design spec

**Date:** 2026-07-09 · **Approved by:** Jac (popup dialogue, this session)
**Area:** `area/rentals-dispatch` · **Supersedes the cockpit UI** shipped in §2.3 / the
D5 laned rail (#490). The D-decisions in `docs/specs/rentals-dispatch.md` stay canon —
D3 lands here in trip-shaped form; D4/D6/D7 carry over; D5's *lane UI* is retired by this
design (its data model and non-drag assignment path survive).

## 1. Why (observed 2026-07-09, screenshots in the session)

The Calendar card fails as shipped, on `main` and on `area/rentals-dispatch` alike:

1. **Unreachable on phones — hard bug.** `COLUMN_OF` (config.js) has no `calendar`
   entry, so `goToCard('calendar')` no-ops: the dock icon does nothing and the
   card-swipe gesture hits a wall at Rentals (same `goToCard` path).
2. **Its most common state is a dead pane.** One day at a time with ‹ › paging; a day
   with no transports renders a ~520×780 px void. Finding the next trip took 26 clicks
   against the demo seed. The "N upcoming" counter offers no jump.
3. **Inverted information design.** The map owns the whole pane; the actual run lives
   in a 90 px hover-to-widen strip showing bare times. At 256 px (hovered) content still
   clips. Hover excludes touch by construction.
4. **False trust signals.** Footer claims "Live · auto-notifies the driver on change" —
   no notification wiring exists, and run order/times are per-device localStorage. The
   tab badge counts every dispatch event ever (done + past included). A failed Maps load
   leaves a permanent empty black pane (no fallback, unlike the transport editor's `.ph`).
5. **Invisible flagship.** The D5 driver lanes only materialize with assignments; with a
   sparse day (the norm) the card looks identical to the pre-lane version.
6. **Identity mismatch.** Named Calendar, grid icon; delivers neither a calendar nor a
   legible dispatch list. No data-plate design language in the card body.

Kept from the current build (they were right): stops auto-fill from rentals; "no set
time" pins to the top; done/next tracking; `driverRoster()` + the R5b `+Driver` dropdown;
`assignStopDriver()` write-through with activity log; driver-stamped captures (D7);
the map singleton with route polyline/markers.

**Domain learning (Jac, this session):** transports living *inside* rentals blocks
bundling two rentals' hauls onto one trailer run. Long-term, rental transports should be
first-class Transport Orders (Delivery, Retrieval, Swap, Repo, …) handed to drivers as
**Trips**. Full migration is out of scope (it touches transport pricing/invoicing);
this design introduces the Trip layer *additively* — scope B below.

## 2. The card

**Name:** **Trips** (tab `TRIPS`, truck glyph — `CARD_ICON`; replaces the grid icon).
Card id stays `calendar` internally (session/state churn not worth it); all user-facing
copy says Trips. Voice stays yard/wrangler: a day's work is a *run*; merging is
"double up".

**Shape:** a native list card — the same skeleton as Units/Rentals, not a bespoke
cockpit.

```
┌──────────────────────────────────────────┐
│ ▸ LIVE MAP (collapsible panel, ~260px)   │  ← graph-icon slot toggles it
├──────────────────────────────────────────┤
│ ▾ TODAY · 3 · 2/3 done            ────── │  ← grp-hd day groups
│   [Deliver] 8:00a  Devin Lyles  MOTO…    │  ← trip rows
│   [Pick up] —:—   Kaleb Guidry  SHREK    │
│ ▸ TOMORROW · 1                           │
│ ▸ SAT JUL 12 · 2                         │
│ ▸ EARLIER · 4                 (collapsed)│
├──────────────────────────────────────────┤
│ ● Synced · rev 12          (honest foot) │
└──────────────────────────────────────────┘
```

### 2.1 Map panel
- Rendered at the top of the card body, ~260 px tall, **open by default everywhere**
  (Jac's call — desktop *and* phone); collapsible via the same graph-icon button slot
  other cards use for their graph; last state remembered per device (localStorage).
- Reuses the existing singleton (`_dispMapEl` re-parenting, route polyline, yard marker,
  deliver/recover pins, truck position seam) unchanged.
- **Offline/failed Maps → a stamped placeholder plate** ("MAP OFFLINE — the run below
  still drives the day"), hazard-stripe edge, mirroring the transport editor's `.ph` +
  `mapFailed` pattern. Never an empty pane. `#local` demo mode shows the placeholder.
- Tapping a trip row focuses/pans its pin (existing `dispatchFocusStop`), map open only.

### 2.2 Trip rows, day groups
- **Row = one Trip.** Universal row system (`rowEl`), R-stamped like every other card.
  Anatomy: kind badge (Deliver blue / Pick up brown; Swap/Repo join when the order
  types exist) · departure time · customer refPill · unit pill(s) · address line with
  pin-status (⚠ no pin) · right: **driver pill** (`+Driver` dropdown — the shipped R5b
  path) · Done badge. Done rows stay visible, dimmed (research guardrail).
  A bundled trip shows its stops stacked inside the one row, sequence-numbered.
- **Grouping:** `GROUP_DEFS.calendar` day buckets — `Today`, `Tomorrow`, then
  `SAT JUL 12`-style keys; sections generated per render (small extension: allow a
  GROUP_DEFS entry's `sections` to be a function). Day headers carry `· n` and a
  `done/total` fraction (green when complete — the lane-header pattern relocated).
  Existing collapse + drag-reorder of group headers just works.
- **Rolling upcoming list** — empty days simply don't render; past trips live under a
  collapsed trailing **Earlier** group (last 14 days; older visible via search).
  If nothing is upcoming at all: one small stamped empty plate, not a void.
- **Ordering within a day:** no-time trips pinned top, then by departure time; manual
  drag-reorder within a day persists to the trips slice (below), not localStorage.

### 2.2b Driver interaction — the row IS the cab view (Jac, 2026-07-09 follow-up)

Up to now the driver had to open the rental itself to log a trip. The trips row
must carry the driver's whole loop, thumb-reachable on a phone:

- **Call the customer:** the customer's phone number rides the row as a
  tap-to-call `tel:` link (R7 hyperlink voice, phone glyph + number). No detour
  through the Customers card.
- **Navigate to the destination:** the address line gains a **Navigate ↗**
  affordance that launches Google Maps directions to the pin (or the address
  string when no pin) in the native maps app — external R7 link, distinct from
  the existing in-app "open the site / set the pin" tap.
- **Log completion from the row:** an action on the row — **+Log Delivery** /
  **+Log Recovery** (matching the journey-node labels) — opens the SAME capture
  overlay the rental journey uses (`openOverlay kind:'capture'` →
  `saveYardCapture`), so evidence attach, the Drive upload path, and the D7
  driver stamp are one code path. A done row shows the stamp clock instead of
  the action.
- Driver-lens floor: on phones all three sit inside the row without expanding
  anything; targets ≥44px; no hover.
- **The cab sheet — unit facts live one level down, not on the row (Jac).**
  The driver also needs *which units, fuel type, and unit weight* — for the
  trailer, the ramps, and the fuel can — but the row stays lean. Tapping the
  row (anywhere that isn't a pill/action) expands it inline into the **cab
  sheet**: one line per unit — unit pill · `DIESEL`/`ELECTRIC` · `24,800 LBS`
  as R3b gray fact chips (`badge`), sourced from `unit.weight` and the
  category's `fuelType`. One trip expanded at a time; tap again to collapse.
  No new data fields; a unit with no weight on record shows `NO WEIGHT` so the
  gap is visible, not silent.

### 2.3 The Trip layer (scope B — approved)
- **Model:** every transport order added to a rental surfaces as its own trip by
  default — a Delivery trip and a Retrieval trip. **Invoice line items are untouched;
  rental save paths are untouched.**
- **Mechanism:** an untouched trip is *derived* (computed from `dispatchEvents()` —
  no record written, so cancelled rentals' trips vanish for free). The moment dispatch
  touches one (merge, time, driver, reorder) it **materializes** as a backend Trip:
  `{ id, day, driverId, time, order: [ {rentalId, unitId, task} ], rev }`.
- **Merge ("double up"):** drag a trip row onto another trip, or right-click →
  **Merge trip…** → pick from that day's trips (on touch the same menu sits behind a
  small ⋯ on the row — long-press is the drag). Target trip keeps its time + driver;
  merged trip's stops append in sequence. **Split out** (same menu) returns a stop to
  its own trip — every move reversible, every move activity-logged. Same-day merges only.
- **One departure time per trip** (approved); stop sequence is the order. The time on
  the row is tap-to-edit inline (the compact time input carried over from the rail's
  `dt-time`, same 12h/24h parsing); setting it re-sorts the day. Per-stop ETAs
  are a deferred follow-up (needs drive-time data — see the 2026-07-06 research doc).
- **Driver:** trip driver writes through to `leg.driverId` via `assignStopDriver()`
  (one fact, one place — D6); captures keep stamping the driver (D7).
- **Sync (D3 lands here):** additive GAS actions `getTrips` / `setTrips` with
  stale-rev conflict rejection (multiple dispatchers). localStorage becomes the
  offline/`#local` cache only. Requires one additive `/clasp` deploy (STOP gate).
- **Read-time hygiene:** a materialized trip ref whose rental/leg no longer exists is
  dropped silently at read; an emptied trip is discarded.

### 2.4 Fixes riding along
- `COLUMN_OF.calendar = 'middle'` (+ make `goToCard` safe for card-stateless members) —
  phone dock tap and card swipe work.
- Tab badge = **upcoming, not-done trips** (was: every event ever).
- Footer: sync status (`Synced · rev N` / `Offline — cached`), **never** an
  "auto-notifies" claim until notifications exist.
- Retire the cockpit CSS (`.disp-cockpit`, `.disprail` hover machinery) and the D5 lane
  UI; dead route-arrow code is already gone (area #490).
- `WINDOW_CATALOG`: no new popups expected (dropdown + drag only); if the merge picker
  becomes a popup, catalogue it. R-stamps on all new elements; regen `rule-usage.js`;
  code-map regen (§2.3 chapter retitles to Trips).

### 2.5 Mobile
Reachable (2.4). Standard touch rows ≥44 px; zero hover dependence. Map open by default,
collapsible; reorder + merge via the existing long-press drag engine; ⋯ menu for
right-click parity. Haptics on drop, per the app's drag patterns.

## 3. Testing
- `ci/logic-test.mjs` additions: derived-trip generation (delivery + retrieval per
  transport rental); merge → order/driver/time semantics; split-out round-trip;
  orphaned refs dropped on cancelled rental; badge math (upcoming ∧ ¬done); day-bucket
  keys around TODAY_ISO rollover (`refreshTodayISO`).
- Playwright drive in `#local`: card reachable on phone viewport; day groups render;
  map placeholder shows offline; no console errors.
- Gates: smoke, logic, `gen-rule-usage --check`, `check-window-catalog`,
  `gen-code-map --check`. Visual pass through `jactec-ui` (screenshot + self-critique
  before Jac sees it).

## 4. Out of scope (named so they don't creep)
- Full Transport-Order migration (transport ownership/pricing out of rentals) — scope C,
  its own future spec.
- Driver notifications ("auto-notify") — `comms-notifications` area.
- Per-stop ETAs / drive-time impact previews; lane load meters; CDL eligibility glyphs —
  deferred list in `docs/handoffs/dispatch-ux-research-2026-07-06.md`.
- Live truck telematics (the `dispatchTruckPos` seam stays a seam).

## 5. Build notes
- Branch: `claude/calendar-card-issues-se0r5a` (area/rentals-dispatch merged in,
  2026-07-09) → PR into `area/rentals-dispatch` → local area test → staging on Jac's
  call.
- Order of work: (1) card shell + rows + groups on derived trips (pure front-end, no
  backend); (2) trip materialization + merge/split on the localStorage cache;
  (3) `getTrips`/`setTrips` backend + sync footer (the `/clasp` STOP gate);
  (4) polish + `jactec-ui` pass + tests at each step.
