# Handoff — Dispatch Cockpit + Maps + Board-view removal (this chat, 2026-06-18)

Pick up here for the work **this chat** shipped. Everything below is **live on `main`** and on
app.jacrentals.com. This is ONE of several concurrent handoffs — see the note at the bottom.

> **Before you start:** `git fetch && git log --oneline -20 origin/main`. Multiple Claude sessions
> push to `main`; get the real live state first. Claude memory auto-loads from the `memory/` folder —
> the most relevant files for this work are `dispatch_office_cockpit.md`, `rentals_stall_board.md`
> (maps gotchas), and `no_board_view.md`. On a fresh machine, recreate them from `MEMORY-FILES.md`.

---

## What this chat shipped (all on `main`, branch → PR → squash-merge)

### 1 · Maps: first-open paint fix (PR #68)
The live Google map (the transport editor's address map) needed **two opens to appear**. Root cause:
the map is created the same frame its container is inserted into the DOM, before layout, so Google
paints it at **0×0** and it stays blank until the next open. Fix in `mountTransportEditor`: after
creating the map, nudge it once it has real size —
`requestAnimationFrame(() => { trigger(map,'resize'); map.setCenter(center); })` **plus a 250ms
`setTimeout` backstop**.
- Diagnosed from the **prod console**: the key is HEALTHY — zero referrer/API/quota errors, only Google
  *deprecation* warnings (AutocompleteService / PlacesService / DistanceMatrix), which still work. So
  "map won't load" was never a key problem; it was first-paint timing.
- **Apply this same nudge to ANY new map mount.** (The dispatch map needed it too.)

### 2 · Dispatch Office Cockpit — Phase 1 (PRs #73, #79, #104, #106, #131)
Replaced the old dispatch **list** (in the Calendar card) with the approved **office cockpit**: a
**full-pane live Google map** of the day's run + a **minimal schedule rail floating on the right that
expands on hover/focus** to adjust the run. Built via a brainstorming → 6-concept judged workflow →
mockups; Jac picked "Running Rail", which evolved into this full-pane-map + hover-rail.

Where it lives / key functions in `app.js`:
- `dispatchGridBody()` — the cockpit markup (full-pane `.dispm` map + `.disprail` hover-overlay list).
- `mountDispatchMap` / `refreshDispatchMap` / `placeDispatchPin` / `dispGeocode` — the map engine.
  Mounts fresh into the render-rebuilt node each render (transport-editor pattern) with **remembered
  pan/zoom**; the **0×0 paint fix** from #68; straight-line `Polyline` route (no Directions/quota);
  Places `findPlaceFromQuery` geocode fallback for stops with no stored `sitePin`.
- `dispatchTruckPos(stops)` — **the telematics seam.** v1 = last-completed stop's pin (or yard). Jac
  has live telematics and is wiring it in ~the week of 2026-06-23 — swap the body of this ONE function.
- `dispatchFocusStop(stopId)` — **tapping a stop FOCUSES it on the map** (pan + highlight), never
  navigates away (Jac's explicit choice — it used to open a burying anchor tab with no back).
- Helpers: `dispatchEvents` (carries `pin` + recovery address), `dispatchKind`, `stopDone` (reads the
  per-unit start/end captures), `dispatchNextId`, `timeToMin` (parses 12h `"9:00 AM"` AND 24h),
  `fmtClock`.

Rail behavior (`.disprail` / `.disp-tok` / `.dt-*`):
- Collapsed = a 90px strip of kind-dot + time; **hover/focus expands to ~256px** (the rail is
  `tabindex=0` so keyboard works) to reveal editable rows. "No set time" stops pin to the TOP.
- Each token: KIND (`badge` R3b) + NEXT (`.dt-next` accent label) + Done (`badge`) + **customer
  (`refPill` R2 → opens the rental)** + **unit (`unitPill` R2)** + address. Editable stop-time
  (re-sorts on a complete time). **Drag a token to reorder** (native dnd → `dispatchOrder`). Dragging
  pins the rail open (`.disprail.dragging`); the moved stop keeps a blue focus ring (`state.dispFocusId`).
- **Live board — NO "send" button** (Jac: the schedule is always running). Footer shows the live state.

### 3 · Board-view (spreadsheet) removal (PR #134)
Jac did not approve the "sheets/board view" toggle (the grid icon by the search bar). Removed the two
`js-boardview` buttons (`.bv-btn`) from the card + shop headers, making the whole Board-View spreadsheet
feature unreachable. **Did NOT touch** the separate, established **back-office board popups**
(vendors/parts/expenses/files via `js-board` + `BACKOFFICE_BOARDS`) — those are kept. Standing rule in
memory: `no_board_view.md`.

---

## R-Rulebook status (no in-code rule change from this chat)
The cockpit uses **existing** builders, so no new `RULE_META` rule was added: kind/done = `badge`
(R3b); customer/unit = `refPill`/`unitPill` (R2). Verified **zero R0 lint violations** in the cockpit.
`.disp-tok`/`.disprail`/`.dt-*` are structural (not lint-family), and `.dt-time` is a plain input (not
`.datefield`), so the R0 lint doesn't flag them. **Another session is actively editing the in-code
R-Rulebook on `origin/claude/handoff-continuation-q442qm` (documenting R19/R20, fixing R23/R24 order,
SPEC v7→v8 labels) — do not double-edit `RULE_META`; let that branch land first.**

---

## Incomplete tasks (next up for the dispatch cockpit)
- **Phase 2 — the DRIVER CAB view.** The approved "Dispatch Deck" cab: map snapped to you-are-here →
  next stop, one giant action plate, a "Mark delivered/recovered" that logs the existing capture, Add
  video/pic (reuse the capture store), a persistent NEXT bar. Role-aware (office cockpit vs driver cab).
- **Phase 3 — the real driver notification.** The footer says "auto-notifies the driver on change" but
  the actual send is NOT wired yet. Plan: in-app, **debounced** (a burst of edits = one heads-up), with
  a "notified · seen" receipt; SMS is a later phase. No "send" button (live board).
- **Telematics → `dispatchTruckPos`** (~week of 2026-06-23, Jac). Swap the v1 seam for the live feed.
- **(Done by another session)** Maps deprecation migration (Places/DistanceMatrix → new Places/Routes) —
  see `maps_api_migration.md`. Our dispatch `dispGeocode` still uses `PlacesService.findPlaceFromQuery`;
  confirm it's covered by that migration.

## Gotchas / how to work
- **Verify the dispatch map on PROD, not `#local`.** The `#local` demo's data index empties under
  automated testing churn and crashes the app's `render()` — the dispatch map never paints there. It
  works fine on prod (the live map renders; the 0×0 fix + boot preload make it open instantly).
- Map is warmed at boot (`loadGoogleMaps()` in `boot()`) so the cockpit/editor open with no first-open wait.
- Map editing stays OFF the map: `dragDown` bails on `.tedit` AND `.dispm` so Google owns pan/zoom.
- Spec for the cockpit design: `docs/superpowers/specs/2026-06-15-dispatch-map-design.md`.
- Standard deploy: branch → PR → squash-merge (`main` is branch-protected, `smoke` required). Gates:
  `node ci/smoke.mjs` · `node ci/logic-test.mjs` · `node ci/gen-rule-usage.mjs --check`. **Port 8000 is
  reserved on this machine** — another session's handoff covers the port-swap workaround.

---

## Concurrent-sessions note (be mindful)
This chat = PRs **#68, #73, #79, #104, #106, #131, #134** only. Other sessions shipped Blued Steel +
nav + KPI work (#60–#133) and a pile of wrangler-fixes — see the sibling `HANDOFF-2026-06-18.md` in this
folder for theirs. There is also an **unmerged** handoff/rulebook branch
`origin/claude/handoff-continuation-q442qm` (SPEC v8.1 delta, rulebook R19/R20, a "The Yard" theme) —
reconcile it before relying on the SPEC/rulebook being final.
