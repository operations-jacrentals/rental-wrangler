# Dispatch Map Redesign — Design Spec (2026-06-15)

Replaces the dispatch **list** (`dispatchGridBody`, in the Calendar card) with an
interactive **map** view. Approved direction: **one role-aware view, two cockpits** —
the office orchestrates on a map + time-rail; the single driver follows + logs from a
cab view. Reference screenshot was inspiration only.

## Locked decisions (from Jac, 2026-06-15)

- **Office cockpit = THE RUNNING RAIL.** A welded vertical time-rail beside the live
  map; dragging a stop token to a new TIME *is* the reorder (no numbers, no separate
  gesture). Ghost-drift preview + a red "can't-make-it" infeasible-leg guard.
- **Driver cockpit = THE DISPATCH DECK cab.** Map snapped to you-are-here → next stop,
  one giant action plate, Add video/pic, a persistent NOW-bar.
- **Single driver.** No driver-assignment field, no multi-rail. The run = "today's run".
- **Progress = "Completed" only** (NOT Arrived→Unloading→Completed). Marking a stop done
  logs the existing per-leg capture (deliver → `startCapture`, recover → `endCapture`)
  and fills that route leg green. No net-new progress state.
- **Live board, NO "Send the run."** The schedule is always live — an edit applies the
  instant it's made. The driver is AUTO-notified (debounced so a burst of drags = one
  heads-up), in-app for v1 (SMS phase-2), with a "notified · seen" receipt so the office
  knows it landed. No draft/commit/send step.
- **Rail shows next + kind.** Every rail token carries its KIND (Deliver = blue,
  Recover = tan; color + label + icon) and the NEXT stop is unmistakable (orange ring +
  "next"), matching the map pins 1:1.
- **Truck position = telematics-ready seam.** Jac has live telematics, integrating
  ~next week. v1 derives position from the last-completed stop / planned next; the
  telematics feed swaps into ONE function later.

## Architecture

**Where it lives.** Replace `dispatchGridBody()` (app.js ~4808, rendered by
`calendarCardEl` ~4021). Keep the data plumbing: `dispatchEvents()` (~4746) →
`dispatchDayStops(day)` (~4798), and the localStorage time/order
(`dispatchTimesLS`/`dispatchOrderLS`). The free-form "2 ARROWS" overlay is retired —
the route is just the line through time-ordered pins.

**Mode select.** Role-aware: Office/Sales → god-view; Driver → cab; a stamped toggle
flips modes (owner-operator who dispatches AND drives). Same data, two render branches.

**Stop model (reuse + extend).** Keep the derived stop `{rentalId, unitId, id, unit,
cust, addr, date, time, task, ttype, color}`. "Completed" state is read from the unit's
existing capture (`startCapture` for Deliver, `endCapture` for Recover) — no new field.
Sort by time (custom order in `dispatchOrderLS` still honored within equal times).

**Map.** Reuse `loadGoogleMaps`/`mapsReady`/`YARD_CENTER`. Mount a Google Map in the
dispatch view (new). Route = a styled **straight Polyline** through time-ordered pins
(no Directions API — avoids the quota/dependency; build judge). Leg color: driven =
green, next = orange, later = gray. Pins = markers synced from the stop model; the
NEXT stop is the one tall orange time-plate, others dim. Editing stays **off** the map.

**The Run Rail (office).** Vertical time axis auto-trimmed to the day's window, "Roll
out" / "Return to yard" bookends fixed. Each stop = a token positioned by time, same
shape as its map pin (hover one → flare the other). Drag a token (custom pointer engine
+ `#drag-layer` + cancel-arc — NOT native HTML5 DnD, which dies on the mid-drag route
re-render). Snap to :00/:15/:30/:45 detents. Live feedback: cursor time-bug, ghost of
the original slot, route rubber-bands, downstream tokens nudge. **Feasibility:** use the
`config.js` transport drive-MINUTES table for an instant, quota-free estimate during the
drag; if a leg's drive-time > the gap to the next stop, flash that leg red and resist
the seat (release-anyway allowed, logged). Unscheduled-time stops live in a tray at the
rail foot. Retime = reorder; the unit/customer/address never move, only WHEN. Each token
carries its KIND (Deliver = blue, Recover = tan; color + label + icon) and the NEXT stop
wears the orange ring + "next" — the rail reads 1:1 with the map pins.

**Live updates (notify).** The board is always live — a drag applies immediately (no
draft/commit/send). After edits settle (debounce ~a few seconds) ONE notification record
is written automatically summarizing what changed; a brief inline undo reverts the last
change. Footer = a live indicator + a "notified · seen" receipt. Driver side: a hazard
banner "Dispatch updated — N stops" over the map with one Acknowledge button; until
acked, old ghost tokens show beside the new. (No push/SMS exists — in-app record now,
SMS phase-2.)

**Driver cab.** Map snapped to truck → next pin. One giant action plate (R-built): time
+ Deliver/Recover tag + unit + customer + tap-to-navigate address + caution strip for
special instructions. Primary action = **Mark delivered / Mark recovered** → logs the
leg capture (timestamp + green leg), advances status, auto-promotes the next stop. Big
R21 `fileDrop` "Add video / pic" (capture=environment) into the existing Drive-backed
capture store. Persistent NOW-bar: "Next: <cust> · <drive-min> · <addr>". Graceful
fallback: no GPS/signal → manual "Next stop" + last-known, never a frozen map.

**Truck-position seam.** A single `driverPosition(day)` → `{lat, lng, source}`. v1:
last-completed stop (or yard), facing next planned. Phase-next: telematics feed replaces
the body of this one function.

## Phasing

1. **Office cockpit** — map + pins + route + the Run Rail (retime=reorder, ghost-drift,
   feasibility guard, unscheduled tray). The orchestration core.
2. **Driver cab** — next-stop map + action plate + Mark-completed (capture reuse) +
   Add video/pic + NOW-bar + auto-advance.
3. **Live auto-notify + driver banner** (debounced notification record on change +
   acknowledge + "notified · seen" receipt). No send button.
4. **(next week)** telematics → `driverPosition`. **(later)** SMS notify.

## Build constraints (jactec-ui)

- Every pill/flag/add/button/field via a §5 builder with a `data-r` stamp; zero R0
  flash-lint violations. Tokens only (no hardcoded hex/font). One orange = selected /
  ignition / linked. Saira Condensed stamps, Geist body. AA in dark + light.
- The hazard stripe is the one signature beat (rail bookends, the Add-video drop).
- Gates before push: `node ci/smoke.mjs` · `node ci/logic-test.mjs` ·
  `node ci/gen-rule-usage.mjs --check`. Feature branch → PR → squash-merge.
- Map reuses the hardened loader (core-gated `mapsReady`, lazy DMS, no failed-load
  cache — shipped in #49).

## Open / risks

- Notification delivery rides whatever sync the app already does to the backend; the
  driver must have the app open to see the banner until SMS lands (phase-2).
- Drive-MINUTES table accuracy for feasibility is rough vs. real Distance Matrix; v1
  accepts that for the live drag (optionally one DMS solve on drop later).
- `dispatchTimes`/`dispatchOrder` remain per-device localStorage in v1 (no backend
  sync of the schedule) — fine for a single dispatcher; revisit if multi-device.
