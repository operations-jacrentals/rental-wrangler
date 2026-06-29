# Maps / Location — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/maps-location`
**Task branch:** `maps-location/spec` (proposed)
**Maturity:** ✅ Shipped (this spec documents the live system as canon, then proposes the next thin layer)
**Scope:** All Google Maps + geocoding + drive-distance integration — the inline transport editor, the dispatch cockpit map, the transport-pricing bridge, geocode caching, and the single referrer-locked browser key — described as the live system plus a small forward roadmap.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions.

- **D1 · Gate transport address editing to money-tier (resolves Q1/§3.1A — closes the live security gap).** Wrap the transport **write** handlers (`js-tedit-save`, `js-ttype`, the type-locking `js-tnode`) in `canMoney()` — only **money-tier+** (Office/Sales/Manager/Admin) may set/change a transport address or type; `staff` (drivers) **view only** (`js-tedit-open` stays ungated). *(Tighter than Shop WO-billing, which stayed open — by Jac's call, because transport pricing is a customer money commitment, not a staff member billing their own work.)*
- **D2 · Site minimap on the detail card + click-to-expand large popup (resolves Q5).** Add a **read-only minimap thumbnail** of the saved pin on the rental/unit detail card; **clicking it opens a large map popup** (full-size view). The large popup is a **new `WINDOW_CATALOG` kind** + `data-r` stamps. (The "Open in Google Maps" deep-link Q6 was *not* selected — skip for now.)

**Defaults adopted:** Q3 → dispatch run **synced per-driver** (`rentals-dispatch` D3) · Q2 → drivers **view** their run, the dispatcher reorders/assigns (multi-driver, `rentals-dispatch` D4) · Q15 → **persist the geocode cache** (write `sitePin` back on first successful dispatch geocode) to cut repeat Google cost · Q4 → add `recoveryPin` · Q8 → keep the committed **referrer-locked key as primary** (`mapsKey` backend fallback) · Q11 → transport rates stay **static `config.js`** constants, **not** pulled into `automated-pricing` · Q10 → the multi-yard origin seam stays exposed but its owner is the **parked multi-location concern** (fleet-spread was re-aimed to capital-allocation; multi-yard is now a separate parked item, not this area).

---

## 1. Goal & Problem

**What this area is for.** Rental Wrangler is a heavy-equipment yard tool. Almost every rental ships from one yard (Sulphur, LA) to a job site and comes back. Maps/Location owns the three places geography enters the app:

1. **Capturing where a unit goes** — the inline transport editor (`+Transport`, `APP-06`) lets the office type a site address with Google Places autocomplete, drop/drag an exact driver pin on a minimap, and capture the one-way driving distance/time.
2. **Pricing the haul from that geography** — the transport-pricing bridge turns cached one-way miles into a per-leg dollar amount on the invoice (`computeTransportPrice`, `config.js:491`), with an offline city-tier fallback.
3. **Running the day's route** — the dispatch cockpit (the Calendar card body, `app.js:8029+`) draws every transport stop for a day on a live map as an ordered route from the yard and back, with a driver marker, a reorderable rail, and free-form route arrows.

**The business/user problem.** Before this, "where does it go and what does it cost to get there" lived in a popup with a hand-maintained city-tier price table. That under/over-charged on real drive distance, gave dispatch no map, and made the driver's day a guess. Maps/Location replaced guessing with measured geography: exact pins, Google drive miles, and a cockpit that shows the run.

**Why it matters.** Transport is real margin and a real labor cost. A wrong address is a wasted truck-hour; a wrong mileage is money left on the table or an angry customer. The map is also the spine for two adjacent Wants: **GPS/Tracking** (`gps-tracking` — the live truck marker is seamed here today) and **Fleet Spread** (`fleet-spread` — multi-yard origins price off this same Distance-Matrix call).

**North star.** *Every haul is a known route with a known price the moment the address is set — and the driver opens one map that shows the whole day.* Determinism is a hard constraint: Google is called only at address-save time, never during render or billing, so `ci/logic-test.mjs` stays reproducible.

---

## 2. Current State (Baseline) — live system AS CANON

### 2.1 The Google key & loader (shipped)

| Piece | Where | Behavior |
|---|---|---|
| Browser key | `GOOGLE_MAPS_KEY` `config.js:44` | **Referrer-locked** to `app.jacrentals.com/*` (+ `localhost:*` for dev). Committed in `config.js` *by design* — it is safe to ship to the browser because it is HTTP-referrer-restricted and API-restricted to Maps JS + Places + Distance Matrix. **It is NOT a secret; but this spec still refers to it by name only and does not reproduce its value.** |
| Key resolver | `ensureMapsKey()` `app.js:1299` | Uses the committed key directly (no backend round-trip — that paid an Apps Script cold-start that hung the map). Falls back to `backendCall('mapsKey')` *only if* config has no key. |
| Backend fallback | `docs/google-maps-setup.md` | Documents an additive `mapsKey` GAS action returning `{ ok, key }` from Script Property `GOOGLE_MAPS_KEY`. Currently the committed key is the live path; the backend action is the documented-but-secondary route. |
| SDK loader | `loadGoogleMaps()` `app.js:1313` | Injects `maps/api/js?...&libraries=places&loading=async`, then `importLibrary('maps'|'places'|'marker')`. A failed/empty load **clears `_mapsPromise`** so the next editor-open retries (caching the failure once hung the map for the whole session). |
| Readiness gate | `mapsReady()` `app.js:1345` | `google.maps.Map && google.maps.places` — the core needed to mount + autocomplete. The **Routes** library (mileage) is NOT required here; `teFetchDistance` lazily `importLibrary('routes')`s it on demand. |
| Yard center | `YARD_CENTER` `app.js:1346` | `{ lat: 30.2366, lng: -93.3774 }` — Sulphur, LA. Map default before a pin is set; also the dispatch route's start/end node. |

### 2.2 Inline transport editor — `APP-06` (shipped)

The editor (`app.js:1290–1599`) replaced the old `site` popup. It is an **inline panel** (not a popup — no WINDOW_CATALOG entry), stamped `data-r="R5b"` at `transportEditorHtml()` `app.js:1375`.

| Capability | Function | Notes |
|---|---|---|
| Open / close | `openTransportEdit(rentalId, unitId, leg)` `app.js:1350` / `closeTransportEdit` `app.js:1366` | Per-unit, per-leg (`delivery`/`recovery`). Seeds `state.transportEdit` from the unit entry (`eu`) or the rental. |
| Mount live map | `mountTransportEditor()` `app.js:1392` | Mounts when `mapsReady()` and the div has no `.gm-style` yet — keys off live DOM so any render self-heals a stuck editor. Draggable site pin + a fixed orange yard marker. Has a first-open 0×0 repaint nudge (rAF + 250ms timeout). |
| Autocomplete | `teQuery` `app.js:1431` → `teRenderSug` `app.js:1470` | New Places API `AutocompleteSuggestion.fetchAutocompleteSuggestions`, `includedRegionCodes:['us']`, 180ms debounce, one `AutocompleteSessionToken` spans keystrokes + the details fetch (billed as one session). Top 5 place predictions. |
| Offline fallback | `teCityFallback` `app.js:1462` | When Places is down/absent, proposes best-effort city matches from `TRANSPORT_MAP` keys so the field still suggests something typeable. |
| Resolve a pick | `tePick(i)` `app.js:1482` | `place.fetchFields(['location','formattedAddress'])` → geocodes, recenters, drops the pin, then `teFetchDistance()`. |
| Keyboard nav | `teKeydown` `app.js:1474` | ↑/↓ move, Tab/Enter set, Esc cancel. |
| Drive distance | `teFetchDistance()` `app.js:1513` | Lazily loads the **Routes** library, `RouteMatrix.computeRouteMatrix({ origins:[YARD_ORIGIN], destinations:[pin], travelMode:'DRIVING', units:IMPERIAL })`. Gates on `condition === 'ROUTE_EXISTS'`. Sets `te.miles` (meters ÷ 1609.344, 1dp) + `te.driveMin`. Any failure → `failToEstimate()` → `miles=null`, toast "city-tier estimate". |
| Save | `saveTransportEdit()` `app.js:1550` | Writes `deliveryAddress`/`recoveryAddress`, `transportMiles`, `transportDriveMin`, `sitePin` onto the unit entry (and mirrors to the rental for the primary unit), then `syncTransportLine(r)` re-bills, `logAction`, toast "Site saved — address + pin go to dispatch." |

**Empty/offline/error states** (`transportEditorHtml` `app.js:1377`): live map → mounts; key present but not yet loaded → spinner + "Loading dispatch map…"; no key / `mapFailed` → pin glyph + "Offline · city-tier pricing" (or "Live map unavailable") + a `.map-sub` hint to type the address; reopen to retry.

### 2.3 The Jac—Site—Jac journey + route-rail (shipped)

The transport **type** is set by tapping nodes on a journey control, not a dropdown:

- `ROUTE_PAIR` `app.js:1589`: `jacL+site → Delivery`, `jacR+site → Recovery`, `jacL+jacR → Round-Trip`.
- `armTransportNode(rentalId, unitId, node)` `app.js:1590` — tap a node to arm, tap a second to lock the type (`setTransportType` `app.js:1579` → re-bill), tap the same to disarm.
- Rendered by `miniJourneyHtml` / `yardToolHtml`, stamped **R15** (per-unit journey; reads/writes `eu`).

### 2.4 Dispatch cockpit map — `§2.3` (shipped)

The Calendar card body is a **daily driver timeline** over a full-pane live map (`app.js:8029–8304`).

| Piece | Function | Notes |
|---|---|---|
| Stop derivation | `dispatchEvents()` `app.js:8032` | One Deliver task per unit at `startDate`, one Pick-up at `endDate`; skips Self/Cancelled/No Show/Returned/Quote. Carries `pin` (the geocoded drop). |
| Per-day stops | `dispatchDayStops(day)` `app.js:8095` | Merges per-device order (`jactec.dispatchOrder`) + times (`jactec.dispatchTimes`), sorts by manual order then time. |
| Map singleton | `mountDispatchMap()` `app.js:8240` / `refreshDispatchMap()` `app.js:8256` | The Map is re-parented into the fresh mount each render so it never reloads/flickers; only pins/route/truck refresh. Straight-line `Polyline` route (no Directions/quota), `fitBounds` once a real stop is located. |
| Pins | `placeDispatchPin()` `app.js:8277` | Deliver = blue `#18b6ff`, Recover = `#c79366`, Done = green `#46c06a`, **Next** = big orange `#ff7a1a` with a Saira-Condensed time label. |
| Truck marker | `dispatchTruckPos(stops)` `app.js:8114` | **v1 seam** — last done stop's pin, else `YARD_CENTER`. Comment: "swapped for live telematics (~next week, Jac)." |
| Geocode pinless stops | `dispGeocode(addr, day)` `app.js:8288` | New Places `Place.searchByText({ textQuery, fields:['location'], locationBias: YARD_CENTER })`, cached in `_dispGeo[addr]`, then a single refresh. The key has Places, not the Geocoding API. |
| Route arrows | `dispatchArrowClick` `app.js:8068`, `autoDispatchRoute` `app.js:8085`, `drawDispatchArrows()` `app.js:8194` | Free-form directional legs between any two stop icons (or the yard nodes `home:in`/`home:out`), per-day in `jactec.dispatchOrder`/`jactec.dispatchArrows` localStorage. SVG overlay drawn post-render. |
| Focus a stop | `dispatchFocusStop(stopId)` `app.js:8132` | Tap a rail token → pan + highlight on the map; never leaves the cockpit. |

### 2.5 Transport-pricing bridge (shipped)

| Function | Where | Behavior |
|---|---|---|
| `computeTransportPrice({transportType, oneWayMiles, fueled, unlimitedTransport})` | `config.js:491` | **PURE, testable, no Google.** `perLeg = 3.5*miles + 50 load + (fueled?20:0)`; `price = round(perLeg * legs)`. Unlimited member → `$0`. `miles==null` → `price:null` ("—"). |
| `legsForType` | `config.js:483` | Round-Trip → 2, Delivery/Recovery → 1, Self/none → 0. |
| `legacyTransportPrice` | `config.js:457` | City-tier `TRANSPORT_MAP` fallback for never-geocoded addresses (seeded demo data, CI). |
| `transportCost` | `app.js:899` | Picks `computeTransportPrice` when cached `miles != null`, else `legacyTransportPrice`. |
| `unitTransport` / `transportLineItems` | `app.js:913` / `920` | Per-unit transport cost → one `kind:'transport'` invoice line per billed unit; gates `unlimitedTransport` on an **Active member** (`§10.4`). |
| `syncTransportLine(r)` | `app.js:1213` | Lid-preserving, paid-safe re-price of the transport invoice line (allocations/refunds survive). |

### 2.6 What's shipped vs partial vs missing

- **Shipped:** everything in 2.1–2.5 above.
- **Partial / seamed:** the dispatch truck marker (`dispatchTruckPos`) is a placeholder for live telematics (owned by `gps-tracking`); the backend `mapsKey` action is documented but the committed key is the live path.
- **Missing (candidate forward work):** no recovery-leg pin (only delivery has a `sitePin`); no multi-yard origin (`YARD_ORIGIN` is one hardcoded string — owned jointly with `fleet-spread`); no map on the customer/unit detail cards; no geofence/ETA; no offline tile caching; no usage/cost telemetry on Google calls.

---

## 3. Users, Roles & Data Gates

The role system is **tier-based** (`ROLE_TIERS` `config.js:326`, ranks in `BUILTIN_ROLE_TIERS` `config.js:340`): `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`. Built-in roles in `ROLES` `config.js:302`: Mechanic, M.Tech, Driver (all default `staff`), Office, Sales (both default `money`). Roles are customizable in Settings → Roles & Logins, so **gates compare TIER, never role name** — the live helpers are `roleTier(currentRole)` (`app.js:13055`), `canMoney()` (`app.js:14166`, `roleTier >= tierRank('money')`, and note it returns **`true` when `!currentRole`** — i.e. an un-logged-in/seed session is treated as privileged), `adminUnlocked()` (`app.js:13071`), `devUnlocked()` (`app.js:13073`), `canApproveRequests()` (`app.js:10895`, manager+).

| Actor | Tier (default) | Maps/Location touchpoints | Gate notes |
|---|---|---|---|
| **Office** | money | Sets transport addresses/pins, runs the dispatch cockpit, edits the run | Office is the primary operator. Address-save **changes the invoice transport line** → a money action; must be `money+` (see §3.1). |
| **Driver** | staff | Reads the cockpit map, opens a stop's address, marks captures (Deliver/Pickup) which advance the truck marker | Read-mostly. Should a driver be able to *retime/reorder* the run, or only view it? (Open Q 2.) |
| **Sales** | money | May set a delivery address while quoting | Same `money+` gate as Office. |
| **Mechanic / M.Tech** | staff | Rarely — may see a unit's last site | No write path proposed; read-only on any site map. |
| **Manager** | manager | Same as Office | Superset of money; no extra Maps power needed. |
| **Admin / Developer** | admin/developer | Same as Office + would own any future Settings (yard origin, Google usage caps) | Multi-yard origin editing (future) is admin (`adminUnlocked()`). |

### 3.1 Data gates (explicit)

**(A) Money gate — CONCRETE GAP FOUND, must close before P1.** Setting/clearing a transport address re-prices the transport invoice line via `syncTransportLine`, and `setTransportType` (journey-node tap) re-bills too. These mutate *customer-facing money*. **The handlers do NOT currently gate.** Compare the live dispatch table at `app.js:12744–12748`:

```
// js-tedit-open  → openTransportEdit(...)   // app.js:12745  — NO canMoney() check
// js-ttype       → setTransportType(...)    // app.js:12746  — NO canMoney() check (RE-BILLS)
// js-tnode       → armTransportNode(...)    // app.js:12747  — NO canMoney() check (can lock a type → re-bill)
// js-tedit-save  → saveTransportEdit()      // app.js:12748  — NO canMoney() check (RE-BILLS via syncTransportLine)
```

…versus the **membership/card handlers immediately above** (`app.js:12417–12427`, `app.js:14207`), every one of which is wrapped:

```
if (!canMoney()) { toast('Membership billing is Office/Admin only.'); return; }
```

The `+Transport` add button itself is already conditionally rendered behind a broad card gate, but the **direct save/type handlers are reachable by a `staff` Driver** (e.g. via the legacy `js-site-go` dispatch link at `app.js:12744`, or a re-render race), so a Driver can silently change a billed amount. **Decision (recommend, surfaced as Open Q 1):** gate the three *write* handlers — `js-ttype`, `js-tnode`(when it locks a type), and `js-tedit-save` — with `canMoney()` using the same toast convention (e.g. `toast('Transport pricing is Office/Admin only.')`), as **defence-in-depth** matching the §3261 comment "Handlers re-check `canMoney()` as defence-in-depth." Keep **open/view** (`js-tedit-open`) ungated so `staff` can see the site; only the money-mutating actions gate. This is a one-line-per-handler change but it is a **security/auth gate** → stays on the main session, not delegated.

- **Transport price is NOT margin/bottom-dollar.** It is a customer-facing line amount, so the gate is "may mutate an invoice," not "may see the floor." Maps/Location **never** reads or renders `bottomDollar`/margin; confirm no future "transport margin" view sneaks the floor in (Open Q 11, out of scope v1).
- **Customer-isolation / PII.** A delivery address + pin is **customer site data** (often a private residence or a competitor-sensitive job site). The dispatch cockpit shows every active customer's site to anyone who can see the Calendar card. This is consistent with the internal-tool model (all staff see all rentals today), but the spec states it as canon: **site addresses/pins are internal-only and must never reach a customer-facing surface** (a future self-service portal under `mobile-remote` MUST row-isolate so customer A never sees customer B's job-site pin). No address/pin is ever sent to Google with customer-identifying metadata — only the bare address string and lat/lng go to Places/Routes. The `formattedAddress`/`location` returned by `place.fetchFields` is stored as-is; **no name, phone, or invoice id is ever attached to a Google request.**
- **Key handling.** The browser key (`GOOGLE_MAPS_KEY` in `config.js`) is referrer-locked + API-restricted and intentionally public; it is **not** in the "secrets" class and is named-only in this file. The backend `GOOGLE_MAPS_KEY` **Script Property** (the `mapsKey` fallback path) is managed server-side, must never be echoed to logs/UI, and is referred to by name only.
- **Margin/`bottomDollar`.** Maps/Location does **not** touch margin, bottom-dollar, or rental-rate floors anywhere.

---

## 4. Data Model

### 4.1 Existing fields (per unit-entry `eu`, mirrored onto the rental for the primary unit)

Schema-less Google Sheets; fields are added by writing them. The rental entity lives in `data.js` (`rentals`), units inside `r.units[]` (`data.js:120`).

| Field | Type | Lives on | Set by | Read by |
|---|---|---|---|---|
| `transportType` | `'Self'\|'Delivery'\|'Recovery'\|'Round-Trip'` | `eu` + rental (primary) | journey nodes / `setTransportType` | `legsForType`, dispatch, billing |
| `deliveryAddress` | string (free text) | `eu` + rental | editor save | dispatch, geocode, legacy pricing |
| `recoveryAddress` | string | `eu` + rental | editor save (recovery leg) | dispatch Pick-up addr |
| `transportMiles` | number\|null (one-way driving miles, 1dp) | `eu` + rental | `teFetchDistance` → save | `computeTransportPrice` |
| `transportDriveMin` | number\|null (one-way minutes) | `eu` + rental | `teFetchDistance` → save | UI label, dispatch |
| `sitePin` | `{lat,lng}`\|null | `eu` + rental (delivery only) | pin drag / pick | dispatch map pin (`dispatchEvents`) |

**Back-compat:** legacy mock pins `{x,y}` are read as unset (`app.js:1356`, `app.js:1407`). Only `{lat,lng}` with finite numbers are honored.

### 4.2 Per-device (localStorage, not synced)

| Key | Shape | Owner |
|---|---|---|
| `jactec.dispatchOrder` | `{ [dayISO]: stopId[] }` | run order |
| `jactec.dispatchTimes` | `{ [stopId]: 'h:mm a' }` | stop times |
| `jactec.dispatchArrows` | `{ [dayISO]: [from,to][] }` | route legs |

`stopId = rentalId|unitId|task` (`dispatchStopId` `app.js:8056`). **Note:** dispatch order/times/arrows are **per-device** — they do not sync across the office's machines today.

### 4.3 Runtime caches (not persisted)

- `_dispGeo[addr] = {lat,lng}` — geocode cache for pinless dispatch stops (memory-only, rebuilt per session).
- `_mapsKey`, `_mapsPromise` — SDK load state.

### 4.4 Proposed-additive (forward; none required for v1 doc-of-record)

- `recoveryPin` `{lat,lng}` on `eu` — so Round-Trip recovery can have its own drop separate from delivery. (Open Q — is this worth it, given recovery is usually the same site?)
- Multi-yard origin: see `fleet-spread` (`DATA.locations[]`, `yardAddress(r)`). **Out of scope here; owned by `fleet-spread`.**

**Migration concerns:** none for the doc-of-record. Any new field is additive and absent-tolerant (the app already treats missing `transportMiles`/`sitePin` as "fall back to city-tier / no pin").

---

## 5. Backend / Integration Contract

### 5.1 Google Maps (the only external integration here)

- **Libraries:** Maps JavaScript API, Places API (new: `AutocompleteSuggestion`, `Place`), Distance Matrix via the **Routes** library (`RouteMatrix.computeRouteMatrix`). All client-side; the key is referrer + API restricted.
- **Call sites (the ONLY times Google is hit), with request shape:**

  | # | Trigger | Google call | Request shape (fields only — no PII) | Cost class |
  |---|---|---|---|---|
  | 1 | `teQuery` (debounced 180ms) | `AutocompleteSuggestion.fetchAutocompleteSuggestions` | `{ input, includedRegionCodes:['us'], sessionToken }` | Autocomplete (per-session billed) |
  | 2 | `tePick(i)` | `place.fetchFields(['location','formattedAddress'])` | one Place + the **same** `sessionToken` (closes the billed session) | Place Details |
  | 3 | `teFetchDistance()` | `RouteMatrix.computeRouteMatrix` | `{ origins:[YARD_ORIGIN], destinations:[{lat,lng}], travelMode:'DRIVING', units:'IMPERIAL' }` | Routes / Distance |
  | 4 | `dispGeocode(addr,day)` | `Place.searchByText` | `{ textQuery:addr, fields:['location'], locationBias:YARD_CENTER }`, cached in `_dispGeo[addr]` | Text Search |

  The **one** `AutocompleteSessionToken` spans all keystrokes for a field **plus** the details fetch on pick, so a full pick is billed as a single Autocomplete session, not N+1 calls. Note the deployed key has **Places + Routes**, **not** the classic Geocoding API — `dispGeocode` deliberately uses `Place.searchByText` (Places), not `Geocoder`.
- **Determinism guarantee (load-bearing).** Render and billing **never** call Google — they read cached `transportMiles`/`sitePin` off `eu`. This is required for `ci/logic-test.mjs` to be reproducible and offline. Any new feature MUST preserve "geocode/measure at save, read from cache forever after." A geocode/Distance call inside a render or billing path is a **review-blocking defect**.
- **Failure handling (all graceful, no crash, app always boots):**

  | Failure | Detection | Degraded behavior |
  |---|---|---|
  | No key (config + backend both empty) | `mapsReady()` false / `mapFailed` | Editor shows offline glyph + "Offline · city-tier pricing"; pricing falls to `legacyTransportPrice` |
  | SDK load fails / empty | `loadGoogleMaps()` rejects → **clears `_mapsPromise`** | Next editor-open retries (caching the failure once hung the map for the whole session — do NOT re-cache a failed promise) |
  | Places down/absent | autocomplete throws/empty | `teCityFallback` proposes `TRANSPORT_MAP`-key city matches so the field still suggests |
  | Routes down / `condition !== 'ROUTE_EXISTS'` | `teFetchDistance` guard | `failToEstimate()` → `miles=null` → toast "city-tier estimate" → `legacyTransportPrice` |
  | Dispatch geocode fail | `dispGeocode` catch | stop stays unplaced; later render refreshes from cache and retries |

### 5.2 Backend GAS actions

The backend is Google Apps Script + schema-less Sheets, one `backendCall` entry point, `Code.gs` gitignored. Maps/Location needs **no required backend action today** (the committed key is live). The single documented-additive action:

```
// REQUEST
backendCall('mapsKey', {})                  // no args; secondary/fallback path only
// RESPONSE (success)
{ ok: true, key: '<referrer-locked browser key from Script Property GOOGLE_MAPS_KEY>' }
// RESPONSE (key not configured server-side)
{ ok: false, error: 'no-key' }              // → app stays on offline/city-tier path
```

No password gate (the key is referrer-locked, so handing it to a browser is by design). **No new backend action is proposed for v1.** Two *candidate* additive pairs are surfaced as Open Questions, never silently added:

```
// Open Q 3 — synced dispatch run (move §4.2 off per-device localStorage)
backendCall('getDispatchRun', { dayISO })   → { ok, order:[stopId], times:{stopId:'h:mm a'}, arrows:[[from,to]] }
backendCall('setDispatchRun', { dayISO, order, times, arrows })  → { ok }
// — requires last-writer-wins or per-field merge for two offices editing the same live board

// Open Q 9 — Google usage telemetry (counts only, NO PII, NO key)
backendCall('logMapsUsage', { kind:'autocomplete'|'details'|'distance'|'geocode', day })  → { ok }
```

Any such action is ADDITIVE on the single `backendCall` entry point; `Code.gs` is gitignored and deployed via `/clasp`. The action **contract** is specced here; the GAS body is not assumed-readable.

### 5.3 Cross-integration touchpoints

- **Invoicing:** `syncTransportLine` writes the transport line. Maps owns the *miles*; Invoicing owns the *line lifecycle*. The contract is `computeTransportPrice`'s pure output.
- **Memberships:** `unlimitedTransport && isActiveMember(cust)` → `$0` transport (`app.js:915`). Maps reads the entitlement; it does not own it.
- **GPS/Tracking:** `dispatchTruckPos` is the documented seam where a live feed replaces the "last done pin" heuristic.

---

## 6. UX / UI — yard data-plate language

All new/changed UI runs through `jactec-ui`. The two surfaces here are already in-language; the spec records the language they use and the stamps any change must carry.

### 6.1 Inline transport editor (existing — `R5b`)

- **Panel:** a `sec` data-plate that slides in below the rental split — dark steel panel (`linear-gradient(180deg,#1b2129,#0c0e11)`), corner rivets, a stamped Saira-Condensed head ("SET DELIVERY SITE", uppercase, ~2px tracking).
- **Minimap on top**, then the address input, then the suggestion `listbox`.
- **Accent discipline:** the yard origin marker is the ONE safety-orange `#ff7a1a` dot (`app.js:1417`); the site pin is neutral/draggable. Orange is brand chrome, never a status color.
- **Ranch twist (voice, subtle):** the editor head/hint copy may lean lightly wrangler — e.g. "Drop the pin where the hand sets it down" / "Set the haul" — but the dominant read stays industrial. Saddle-stitch tan dashed divider is *optional seasoning only* if a divider is needed; default is rivets.
- **States:** live (map mounts) · loading ("Loading dispatch map…" + spinner) · offline/failed ("Offline · city-tier pricing" / "Live map unavailable" + a sub-hint).
- **Stamps:** the editor block is `data-r="R5b"` (`app.js:1375`); the `+Transport` add button is R5b (`addBtn`); the journey is **R15**. **No new stamp needed for the existing editor.**
- **NOT a popup** → **no WINDOW_CATALOG entry.** Any change that keeps it inline keeps the catalog untouched.

### 6.2 Dispatch cockpit (existing)

- Full-pane live map + a minimal floating **rail** that widens on hover/focus. Deliver tokens carry a blue badge, Recover a brown badge, Next a `I.truck` "Next" stamp, Done a green badge.
- Live-board footer: a pulsing `disp-livedot` + "Live · auto-notifies the driver on change" (note: the auto-notify is aspirational copy — actual outbound is owned by `comms-notifications`).
- Empty state: `I.truck` glyph + "No transports on this day." with a hint that rentals land here automatically.
- **Mobile reflow** (`mobile-remote`): the 3-column grid collapses; the cockpit map needs a min-height floor on phones and the rail should become a bottom-sheet-friendly strip. The first-open 0×0 repaint nudge is essential on mobile too.

### 6.3 Proposed v1.1 UI (forward, optional — surface to Jac)

- **A) Site map on the rental/unit detail card** — a small read-only static-style minimap thumbnail showing the saved pin, so you don't open the editor to see where a unit is. New element → needs an `data-r` stamp (likely reuse R-? for a read-only map tile; confirm with `jactec-ui`). Not a popup.
- **B) "Open in Google Maps" deep-link** on a stop's address — `https://www.google.com/maps/dir/?...` from yard → pin, so the driver can hand off to phone nav. No key cost (it's a URL). Tiny win; surface as Open Q.

---

## 7. Business Rules / Derivations / Money

### 7.1 The transport price formula (canonical, cite-exact)

```
legs   = Round-Trip → 2 ; Delivery|Recovery → 1 ; Self|none → 0      (config.js:483)
fueled = /diesel|gas(oline)?|petrol|propane|\blp\b/i.test(category.fuelType)   (config.js:478)
perLeg = TRANSPORT_RATES.perMile(3.5) * oneWayMiles
         + TRANSPORT_RATES.loadPerLeg(50)
         + (fueled ? TRANSPORT_RATES.fuelPerLeg(20) : 0)             (config.js:471, 496)
price  = round(perLeg * legs)                                        (config.js:497)
```

- **Unlimited member** (`unlimitedTransport && isActiveMember`) → `price = 0`.
- **No miles** (`oneWayMiles == null`) → `price = null`, label "—" → caller falls back to `legacyTransportPrice` (city tier).
- **Miles source:** `RouteMatrix` meters ÷ 1609.344, rounded to 1dp (`app.js:1543`).
- **Tax:** the transport line is **taxable** unless flagged `li.taxExempt` (`invoiceTotals` `app.js:1607`). Maps doesn't compute tax; it just produces the taxable line amount.

### 7.2 Geometry derivations

- **Drive miles/min:** one-way, yard → pin, DRIVING, IMPERIAL, gated on `condition === 'ROUTE_EXISTS'`.
- **Truck position (v1):** last completed stop's pin, else `YARD_CENTER` (`dispatchTruckPos`).
- **Next stop:** first not-`stopDone` stop (`stopDone` reads `startCapture`/`endCapture`).
- **Route polyline:** straight legs yard → stops (in run order) → yard. **No Directions API** (avoids quota); the line is "as the crow flies," not road-snapped — a deliberate cost/determinism trade.

### 7.3 Edge cases

- **Address typed but never picked** (no geometry): `te.addr` keeps the typed text; `miles=null` → city-tier price. Driver still gets a string; dispatch geocodes it via `dispGeocode`.
- **Legacy `{x,y}` pin:** treated as unset; no crash.
- **Multi-unit, multi-site:** each `eu` carries its own type/address/pin/miles → its own dispatch task + its own invoice line.
- **Voided unit:** `transportLineItems` skips `unitVoided` units — no transport billed.
- **Address changed after payment:** `syncTransportLine` re-prices only *unpaid* lines in place; a paid line is preserved (refund-first).

---

## 8. Phasing & Milestones

**This area is shipped.** Phase 0 is the doc-of-record (this spec). Forward phases are thin and optional.

| Phase | Scope | In / Out |
|---|---|---|
| **P0 — Canon** | This spec documents the live system; no code change. | IN: accuracy of §2/§5/§7. OUT: any new feature. |
| **P1 — Hardening** | (a) Confirm + (if needed) add an explicit `money+` tier check around editor-save/`setTransportType`. (b) "Open in Google Maps" deep-link on dispatch stops. | IN: a/b. OUT: new map surfaces. |
| **P2 — Read-only site map on detail cards** | Static minimap thumbnail of the saved pin on the rental/unit card. | IN: read-only tile. OUT: editing from the tile. |
| **P3 — Recovery pin** | `recoveryPin` so Round-Trip recovery can drop separately. | IN: field + editor leg. OUT: routing the recovery as a distinct dispatch leg geometry (already separate stop). |
| **P4 — Telematics handoff** | Replace `dispatchTruckPos` with the live feed. | **OUT of this area** — owned by `gps-tracking`; Maps only exposes the seam. |
| **P5 — Multi-yard origin** | `YARD_ORIGIN` → per-rental yard. | **OUT of this area** — owned by `fleet-spread`. |

**Explicitly out of scope for any v1 here:** geofencing, ETA prediction, offline tile caching, road-snapped routing (Directions API), Google-usage cost dashboards, and the customer self-service map (that lives behind the `mobile-remote` isolation boundary).

---

## 9. Acceptance Criteria

Doc-of-record (P0):

1. §2 accurately names every shipped function with a correct `file:line` anchor (verified against `app.js`/`config.js` on 2026-06-28).
2. The price formula in §7.1 matches `computeTransportPrice` (`config.js:491`) exactly, including the `3.5 / 50 / 20` rates and `round(perLeg*legs)`.
3. The determinism rule ("Google only at save, never at render/billing") is stated and matches the code.
4. The key is referred to by name only; **no key value, no Script Property value, no PII appears in this file.**

If P1+ ships, additionally:

5. **CI gates green:** `node ci/smoke.mjs`, `node ci/logic-test.mjs` (port-swapped to 9147 per CLAUDE.md), `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`.
6. **`gen-rule-usage`:** any new UI element carries a valid `data-r` and `rule-usage.js` is regenerated. The existing editor's R5b/R15 are unchanged.
7. **`check-window-catalog`:** the transport editor stays **inline** (no popup) → WINDOW_CATALOG untouched. If P2's detail-card map were ever made a popup, it MUST be added to WINDOW_CATALOG.
8. **`logic-test`:** transport-pricing tests still pass with mocked/cached miles; no live Google call enters the test path.
9. **Editor money gate (the §3.1 fix):** with `currentRole` resolving to a `staff` tier, the `js-tedit-save`, `js-ttype`, and type-locking `js-tnode` handlers each call `canMoney()`, short-circuit with a toast, and **leave the invoice transport line unchanged** (negative test: assert `r.invoice` transport line amount is identical before/after a `staff` save attempt). A `money+` tier still saves normally (positive test). The toast string matches the existing convention ("… is Office/Admin only.").
10. **Mobile:** the cockpit map renders with a usable min-height on a phone viewport; first-open paint is correct (no 0×0 blank — the rAF + 250ms repaint nudge fires).
11. **No-leak guard:** grep confirms no Google call is constructed with a customer name/phone/invoiceId in its payload; only address strings and `{lat,lng}` reach Places/Routes.
12. **Determinism (logic-test):** a `node ci/logic-test.mjs` run completes with **zero** network access and transport-pricing tests pass off cached/mocked miles (no `RouteMatrix`/`Place` call enters the test path).

---

## 10. Risks & Edge Cases

| Risk | Impact | Mitigation (today / proposed) |
|---|---|---|
| **Money gate gap (SECURITY)** | A `staff` Driver can reach `js-tedit-save`/`js-ttype`/`js-tnode` (`app.js:12746–12748`) which re-price an invoice with no `canMoney()` check — a billed-amount change by an unprivileged user. | **Fix in P1** (§3.1A, Open Q 1): wrap the three write handlers in `canMoney()` matching the membership/card pattern. Negative-test in §9.9. |
| **Key abuse / quota** | A leaked-but-referrer-locked key is low-risk, but a runaway autocomplete loop burns quota | Session tokens + 180ms debounce already in place. Consider a soft per-session call cap (Open Q 9). |
| **Repeated dispatch geocode cost** | `_dispGeo` is memory-only → the same pinless addresses are `Place.searchByText`'d again every session/day = repeat Google spend. | Persist the geocode cache or write back a `sitePin` on first hit (Open Q 15). |
| **Google API surface drift** | Google deprecated the old Places/Distance Matrix; the app already migrated to the new Places + Routes classes. Future deprecations could break autocomplete/mileage. | Graceful fallbacks mean a break degrades to city-tier, not a crash. Keep an eye on `loading=async` + `importLibrary` contracts. |
| **Stale geocode cache** | `_dispGeo` is memory-only and rebuilt per session — fine. But a saved `sitePin` from a wrong pick persists. | Pin is user-draggable; re-saving overwrites. |
| **Per-device run state** | Order/times/arrows don't sync — two office machines see different runs. | Documented as a known limitation; sync is an additive backend action if Jac wants it (Open Q). |
| **Determinism breach** | Any new code that geocodes at render/billing would make `logic-test` flaky and slow the UI. | Hard rule in §5.1/§7; CI logic-test is the guard. |
| **PII on a public surface** | A future customer portal echoing a job-site address/pin would leak site location. | §3.1 states site addresses/pins are internal-only; `mobile-remote` portal must row-isolate. |
| **Straight-line route misleads** | The polyline isn't road-snapped; a driver might misjudge order. | Acceptable trade for quota/determinism; the rail order + times are the real plan, the line is decoration. |
| **Multi-user dispatch edits** | Live-board "auto-notify" copy implies a send that doesn't exist server-side yet. | Copy is aspirational; real outbound is `comms-notifications`. Don't promise notify until that lands. |

---

## 11. Open Questions

> **Resolved 2026-06-29:** Q1 → D1 (gate transport edit to money-tier) · Q5 → D2 (card minimap + click-to-expand large popup). Adopted: Q2/Q3 (synced per-driver run, dispatcher reorders), Q4 (recoveryPin), Q8, Q11, Q15; Q6 deep-link skipped; Q10 multi-yard seam = parked multi-location concern. See the Decisions block up top.

> No seed questions were captured for this area; all below are generated from the code.

1. **Editor money gate (CONCRETE GAP — see §3.1A).** The write handlers `js-tedit-save` (`app.js:12748` → `saveTransportEdit` → `syncTransportLine`, re-bills), `js-ttype` (`app.js:12746` → `setTransportType`, re-bills), and `js-tnode` (`app.js:12747` → `armTransportNode`, can lock a type → re-bill) carry **no `canMoney()` check**, unlike the membership/card handlers right above them (`app.js:12417–12427`). A `staff` Driver reaching them (e.g. via the legacy `js-site-go` dispatch link, `app.js:12744`) silently changes a billed amount. Should we wrap the three write handlers with `if (!canMoney()) { toast('Transport pricing is Office/Admin only.'); return; }` and leave `js-tedit-open` (view) ungated? *Trade-off:* the gate stops a Driver mutating money, but adds friction if drivers are ever expected to fix addresses in the field (then we'd want `staff` to edit *address/pin* but not let it re-price — a bigger change splitting geometry-save from money-save). **Recommend: gate the three write handlers at `money+`; `staff` may open/view only.** This is auth — stays on main session.

2. **Driver write access to the run.** Should a `staff` Driver be able to **reorder/retime** the dispatch run (it's per-device localStorage, no money impact), or is that Office-only? *Trade-off:* drivers re-sequencing their own day is useful; but per-device state means their reorder doesn't reach the Office.

3. **Sync the dispatch run?** Move `dispatchOrder/Times/Arrows` from per-device localStorage to a synced backend pair (`getDispatchRun/setDispatchRun`)? *Trade-off:* one shared truth across machines + a record for the driver; cost is a new additive backend action + conflict handling on a live board.

4. **Recovery pin.** Add `recoveryPin` so Round-Trip recovery drops separately from delivery? *Trade-off:* exactness for the (rarer) different-recovery-site case vs. another field + editor leg to maintain. Today recovery reuses the delivery address/geocode.

5. **Read-only site map on the rental/unit card (P2).** Worth a static minimap thumbnail, or is opening `+Transport` enough? If yes — inline tile (no popup) or a tap-to-expand popup (which then needs a WINDOW_CATALOG entry)?

6. **"Open in Google Maps" deep-link.** Add a one-tap nav handoff (yard → pin) on dispatch stops / the editor? Zero key cost. Any reason not to?

7. **Road-snapped routing.** Ever want the dispatch polyline to follow real roads (Directions API) instead of straight legs? *Trade-off:* truer route + ordering vs. new quota + a determinism caveat. Current call: no.

8. **Backend `mapsKey` vs committed key.** Keep the committed referrer-locked key as the primary path (fast, no cold-start) and the backend action as fallback — confirm that's the intended long-term posture, given it puts a (safe, restricted) key in the public repo.

9. **Google usage/cost visibility.** Want any in-app telemetry on Google call volume (autocomplete/details/distance/geocode), or is the Cloud console enough? Relevant if quota ever bites.

10. **Multi-yard seam (coordinate with `fleet-spread`).** `YARD_ORIGIN` is a single hardcoded string fed to `RouteMatrix.origins`. When `fleet-spread` lands, the origin becomes per-rental. Confirm Maps/Location only *exposes the seam* (`origins:[yardAddress(r)]`) and `fleet-spread` owns the Location entity + fallback to today's behavior.

11. **`automated-pricing` overlap.** `automated-pricing` explicitly scopes transport pricing **out** of its v1 (rental rates only). Confirm transport rates (`3.5/50/20`) stay a static `config.js` constant here and are **not** pulled into any future pricing-automation engine without a deliberate decision.

12. **Ranch-twist dosage in dispatch copy.** The cockpit's "Live · auto-notifies the driver" line is industrial. Is any wrangler seasoning wanted in the cockpit ("Round up the run", "the hand's day"), or keep dispatch strictly operational?

13. **`canMoney()` open-session permissiveness.** `canMoney()` returns **`true` when `!currentRole`** (`app.js:14166`) — a seed/un-logged-in session is treated as fully money-privileged. That's the project-wide convention (matches every other money handler), so a transport gate inherits it. Confirm this is intended for Maps too (i.e. we do NOT want a stricter "must be logged in *and* money" rule on transport pricing), so the gate behaves identically to membership/card gates.

14. **Split geometry-save from money-save?** If Jac wants `staff` Drivers to **fix a wrong address/pin in the field** without touching price, we'd separate "save address + pin" (allowed for `staff`) from "re-price the line" (gated). *Trade-off:* field-fixable addresses vs. a divergence where a Driver edits the site but `transportMiles`/the invoice line don't refresh until an Office user re-saves. Default for v1: keep them atomic and gate the whole save at `money+` (Open Q 1).

15. **Dispatch geocode persistence.** `_dispGeo` is memory-only and rebuilt every session, so every pinless stop is re-`Place.searchByText`'d once per session/day (real, repeated Google cost for the same addresses). Persist a geocode cache (localStorage, or write a `sitePin` back to `eu` on first successful dispatch geocode) to cut repeat Text-Search calls? *Trade-off:* fewer Google calls + faster cockpit vs. a persisted pin that goes stale if the address later changes (mitigated: key the cache by the address string, invalidate on address edit).

---

## 12. Dependencies & Sequencing

**Maps/Location depends on** (per AREAS-ROADMAP): `rentals-dispatch`, `units-fleet`, `invoicing-payments`, `gps-tracking`, `backend-data`.

| Dependency | Relationship | Must land first? |
|---|---|---|
| `rentals-dispatch` | The transport editor + cockpit live inside the rental lifecycle; `dispatchEvents` reads rentals. | Already shipped — Maps builds on it. |
| `invoicing-payments` | `syncTransportLine` writes the transport line; `computeTransportPrice` feeds it. | Already shipped. Any change to the line contract is coordinated here. |
| `units-fleet` | Transport fields live on the unit-entry `eu`; `fuelType` drives the fuel charge. | Already shipped. |
| `memberships` | `unlimitedTransport && isActiveMember` → `$0`. Maps reads the gate. | Shipped; read-only dependency. |
| `gps-tracking` | Replaces `dispatchTruckPos` (the live truck marker). | **gps-tracking must land before P4.** Maps only exposes the seam now. |
| `fleet-spread` | Multi-yard origin replaces `YARD_ORIGIN`. | **fleet-spread must land before P5.** Maps exposes the `origins:[]` seam. |
| `comms-notifications` | The cockpit's "auto-notify the driver" needs a real outbound channel. | Must land before the live-board notify is anything but aspirational copy. |
| `backend-data` | Any dispatch-run sync (Open Q 3) is an additive `backendCall` action. | Only if Jac wants synced runs. |
| `mobile-remote` | Cockpit reflow + the row-isolated customer portal (PII boundary). | Coordinate; portal must never expose site addresses/pins. |

**Sequencing summary:** Nothing blocks the doc-of-record (P0). P1 (gate + deep-link) is self-contained. P2/P3 are small and independent. P4/P5 are **gated on other areas** (`gps-tracking`, `fleet-spread`) and this area only keeps the seams clean.
