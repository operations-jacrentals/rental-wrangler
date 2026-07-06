# Rentals / Dispatch — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/rentals-dispatch`
**Task branch:** `rentals-dispatch/spec` (proposed)
**Maturity:** shipped
**Scope:** Owns the full rental lifecycle (Quote → Return) — the multi-unit event model, the rate-blend money engine, the rental-window picker + extension billing, per-unit transport/delivery legs, and the dispatch cockpit (the Calendar card's live map + reorderable run rail), with the driver-cab and live-auto-notify phases still unbuilt.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These supersede the matching Open Questions and amend §2.7 / §3 / §4 / §5 / §6 / §8.

- **D1 · Money gate — tighten the fragile-window save only (resolves OQ-1/OQ-2).** Wrap the fragile-window extension save (`winPickSave` → `billExtension`) in `canMoney()` so a `staff`-tier Driver cannot silently raise a customer balance. Leave invoice creation and the pre-invoice live-commit path **un-gated** (parity with `createInvoiceForRental`/`addCustomLine`). Collecting payment stays gated as today.
- **D2 · Pre-login money exposure — render-gate (resolves OQ-15).** Keep the `canMoney()` no-role fallthrough (load-bearing for solo/owner-operator mode), but **never mount a money-action surface until `auth` has resolved a role.** A render-gate, not a permission change — closes the shared/kiosk pre-login window.
- **D3 · Schedule storage — backend-synced (resolves OQ-4/OQ-7).** Move stop time/order off per-device localStorage to an additive backend `dispatchSchedule` slice with **stale-rev conflict rejection** (multiple dispatchers run the board). Keyed **per-driver** (see D6). ADDITIVE backend action → needs a `/clasp` deploy (prod-deploy STOP gate applies).
- **D4 · Multi-driver is coming — hybrid assign model (supersedes the OQ-5 single-driver lock).** A stop reaches a driver two ways, **both supported**: (a) **auto-split** into per-driver runs (by region/load) as the starting suggestion, and (b) the dispatcher **drag-drops** a stop onto a driver to assign/override. Each **driver cab shows only that driver's assigned run.**
- **D5 · Schedule UI — evolve the existing rail into driver lanes (resolves OQ-11).** The cockpit's existing drag-drop stop rail grows **driver lanes on the same surface as the map.** **Collapsed by default**; when opened, the dispatcher **clicks which drivers to show side-by-side** (scales 2–3 → 7+ with no fixed lane count). The retired free-form route arrows (`dispatchArrowsLS` / `autoDispatchRoute` / `drawDispatchArrows`) are **removed** — the orange route Polyline + the laned rail replace them.
- **D6 · Data model — per-stop driver assignment.** Add `units[].leg.driverId` (absent → unassigned/auto-pool) so assignment is one-fact-one-place on the leg. The `dispatchSchedule` slice keys order/time **per driver**: `{ [dayISO]: { [driverId]: { order:[stopId], times:{stopId:"HH:MM"} } } }`. Driver identity ties to **`hr-compliance`** (employee/driver records).
- **D7 · Mark-delivered stamps the driver.** Reusing the leg capture stays (OQ-6), but the capture now also records **which driver** completed it (`driverId` on the capture) so the per-driver run and any on-time KPI are attributable.

**Still open:** OQ-13 (telematics feed contract — lock when Jac wires the feed) and OQ-14 (extend-a-`Returned`-rental — confirm intentional; low priority). All other OQs are resolved by their stated recommendations.

---

## 1. Goal & Problem

### 1.1 What this area is for

Rentals / Dispatch is the **operational heart** of Rental Wrangler. A *rental* is not "one machine for one customer" — it is an **event**: one customer, one shared date window, **one-to-many units**, each carrying its own status, transport leg, and site address, all rolling up to one priced invoice (or a 28-day billing series). Dispatch is the same data viewed as *today's run* — the transports that fall on a given day, drawn as a route from the yard and back, that one driver/owner-operator works through.

### 1.2 The business / user problem

JacRentals lives and dies on three questions, all answered here:

1. **"Can I rent this, and for how much?"** — availability + the cheapest legal rate blend (4-Week / 7-Day / 1-Day, plus Member and Weekend specials), per unit, across a shared window. Getting the *blend* wrong leaks margin on every long rental.
2. **"What's going out / coming back today, in what order, and can the one truck make it?"** — the dispatch cockpit. A blown route order means a missed delivery, an idle machine, an angry contractor.
3. **"They kept it longer — did we bill the extra days?"** — the historical gap: the window picker would silently let a fragile rental's end date slide and **never re-price**. The extension engine closes that.

### 1.3 North star

> **One fact, one place. The rental window and unit set are the source; price, availability, transport cost, drive time, status urgency, and the day's run are all DERIVED LIVE.** A dispatcher should be able to lengthen a rental, watch the added charge land on the invoice before they commit, and see the new return stop appear on the right day's run — without ever typing a number twice or re-pricing by hand.

---

## 2. Current State (Baseline)

This documents the **live, shipped system on `main` as canon.** Anchors are `file:line` against the real code; chapter ids are Code-Atlas banners (`grep "APP-NN app.js"`).

### 2.1 Shipped — the multi-unit event model

| Piece | Anchor | Behavior |
|---|---|---|
| `rentalUnits(r)` | `app.js:202` | The unit set. Returns `r.units[]` (the §20 multi-unit array) if present, else a legacy single-unit fallback from `r.unitId`. |
| `unitStatus(r, eu)` | `app.js:231` | Per-unit status. `Reserved` whose start passed without going On Rent derives to `No Show`. **`Today`/`Tomorrow` are retired** as statuses — urgency now rides the `starts-today` / `starts-tomorrow` flags. |
| `rentalStatusDisplay(r)` | `app.js:246` | The rental's app-wide status: the single status when units are uniform; the lifecycle-ordered mix label (e.g. `Today/On Rent`) with a gray color when they diverge. Color is **flag-driven** (`getEntityColor('rentals', r)`), label is the lifecycle status. |
| `TERMINAL_UNIT` / `allUnitsTerminal(r)` | `app.js:256–261` | Terminal = `Returned`, `Cancelled`, `No Show`. "Complete Rental" unlocks only when **every** unit is terminal. |
| `unitVoided(r, eu)` | `app.js:260` | No Show / Cancelled — stays on the record but is **not billed** (no rental/transport line). `Returned` is terminal **but still billed**. |
| `setRentalStatus` / `setUnitStatus` | `app.js:13114 / 13147` | The master gate (bulk-set every unit) and the per-unit gate. Same §9 hard gates on both (see §3). |

### 2.2 Shipped — the rate-blend money engine

| Piece | Anchor | Behavior |
|---|---|---|
| `rentalPrice(r)` | `app.js:836` | The optimizer. Member daily, else Weekend special (`Fri→Sun`/`Fri→Mon`/`Sat→Mon` only), else the **cheapest blend** of `mm×rate4Wk + ww×rate7Day + dd×rate1Day` over all decompositions. Returns `{price, rate, days}`. |
| `unitRentalPrice(r, unitId)` | `app.js:879` | §20 per-unit pricing — each unit billed by **its own category** across the rental's shared window. |
| `rentalLineItems(r)` | `app.js:886` | One `rental` invoice line **per non-voided unit** (`ref=rentalId`, `li.unitId` identifies which). |
| `catRatesUnset(cat)` | `app.js:873` | A $0-rate category — drives the quote-time caution so it never quotes free. |

### 2.3 Shipped — rental extensions + 28-day billing series (`APP-05`, Jac 2026-06-25)

| Piece | Anchor | Behavior |
|---|---|---|
| `rentalFragile(r)` | `app.js:14977` | Fragile = `r.invoiceId \|\| status ∈ {On Rent, End Rent, Off Rent, Returned}`. Fragile rentals **stage** window edits behind an explicit Save; everything else commits live. |
| `winPickSave()` | `app.js:14984` | Writes the staged window, then calls `billExtension(r, prevEnd, prevStart)` to bill a lengthened window across the ≤28-day series. |
| `retroPricingOn()` | `app.js:941` | Admin toggle `company.retroactivePricing` (default ON). ON = cheapest price for **all** days, prior billing counts toward it. OFF = bill only the added segment as a fresh rental. |
| `unitExtensionDelta(...)` | `app.js:951` | Per-unit extension charge honoring the retro setting. |
| `isWindowExtension(ps,pe,ns,ne)` | `app.js:986` | True only for a **pure superset** extension (no prior day dropped, ≥1 day added). A move/shrink is not an extension → no auto-bill. |
| `INV_CAP_DAYS = 28` + `invoiceChunks` | `app.js:965 / 990` | An invoice bills ≤28 rental-days/unit; long rentals split into a series. The 4-Week rate **is** 28 days, so the split bills the **same total** — purely organizational. |
| `createInvoiceForRental` | `app.js:14860` | Chunks the window into ≤28-day invoices; transport + protection billed once on chunk 0. |
| `extensionPreview` (in win-picker) | `app.js:15144` | Pure, drives the picker's live banner — days delta, per-unit deltas, tax, new balance, basis copy. |

> **Refund-first invariant:** positive deltas only. A shortened window (or a Member/Weekend boundary that lowers the optimum) yields `delta ≤ 0` → **no line added, nothing auto-credited.** Reducing a charge is a manual refund decision.

### 2.4 Shipped — the window picker (`APP-12.2`, inline)

`winPickerEl(r)` (`app.js:15116`) renders an inline two-click range calendar (`.winpicker`/`.wp-*`) with a time selector, availability-blocked days (`dayBlocked` reads `winPickSubject()` — an anchored Unit/Category on a side card), an overbooking soft-block path (`state.overbookOn`), and, for fragile rentals, the staged extension-preview banner + a context-relabeled **`BILL EXTENSION`** save. Selecting a window pushes an "available" search lens onto the Units + Categories cards (`enterAvailabilitySearch`).

### 2.5 Shipped — inline transport editor + Google Maps (`APP-06`, Jac 2026-06-15)

`openTransportEdit` (`app.js:1350`), `transportEditorHtml` (`app.js:1369`) — the popup `site` flow is **retired**; an inline panel (`data-r="R5b"`) with a minimap, an address field, and keyboard-navigable Places typeahead sets a per-unit, per-leg site address. Geocode → cached `transportMiles`/`transportDriveMin` on the unit entry, so **pricing/billing never call Google** (keeps `ci/logic-test.mjs` deterministic). Pricing: `perLeg = 3.50×oneWayMiles + 50 + (fueled?20:0)`, `legs` per transport type; unlimited-transport active members → $0.

### 2.6 Shipped — the dispatch cockpit (Phase 1, PRs #73/#79/#104/#106/#131)

| Piece | Anchor | Behavior |
|---|---|---|
| `dispatchEvents()` | `app.js:8032` | Derives **one task set per unit** from rentals (skips Cancelled/No Show/Returned/Quote/Self). Delivery/Round-Trip → a `Deliver` stop on `startDate`; Round-Trip/Recovery → a `Pick up` stop on `endDate`. |
| `dispatchDayStops(day)` | `app.js:8095` | The day's stops, honoring per-device `dispatchTimesLS` / `dispatchOrderLS` (localStorage). |
| `dispatchGridBody()` | `app.js:8148` | The cockpit: a full-pane Google map + a right-edge hover rail (`.disprail`). "No set time" stops pin to the **top**. Editable stop-time (12h/24h, re-sorts), **native HTML5 DnD** reorder, stop-click → `dispatchFocusStop` (pan+highlight, never navigates away). Live-board footer, no "send". |
| `mountDispatchMap` / `refreshDispatchMap` | `app.js:8240 / 8256` | Singleton map re-parented each render (no flicker). Pins synced from stops; route = a straight `Polyline` (no Directions API/quota); `YARD_CENTER` origin + "back to yard". Pinless stops geocoded via Places (`dispGeocode`) + cached. |
| `dispatchTruckPos(stops)` | `app.js:8114` | **Telematics seam (v1):** truck = last-done stop's pin, else yard. One function to swap for the live feed. |
| `stopDone(ev)` / `dispatchNextId` | `app.js:8108 / 8113` | "Completed" is read from the unit's existing capture (`startCapture` for Deliver, `endCapture` for Recover) — no new progress state. Next = first not-done. |
| Free-form arrows | `app.js:8068–8233` | A legacy overlay (`dispatchArrowsLS`, `autoDispatchRoute`, `drawDispatchArrows`) lets the dispatcher draw arbitrary directional legs in the route gutter. *(See OQ-11 — the map-redesign spec calls this "retired"; it still exists in code.)* |

### 2.7 Partial / Unbuilt

- **Driver cab (Phase 2)** — next-stop map, one giant action plate, Mark-delivered/recovered (logs the leg capture + auto-advances), Add video/pic, persistent NOW-bar. **Not built.**
- **Live auto-notify (Phase 3)** — debounced in-app notification record on schedule change + driver hazard banner + "notified · seen" receipt. **Not built** (the footer says "auto-notifies" but no record is written).
- **Telematics live feed** into `dispatchTruckPos` — seam present, real feed not wired.
- **Time-axis drag / feasibility guard / snap detents / unscheduled tray** — the rail is a list, not a time axis (see `2026-06-15-dispatch-map-design.md` §"Phase 1 As-Built").
- **Schedule sync** — `dispatchTimes`/`dispatchOrder` are **per-device localStorage**, not backend-synced. Fine for one dispatcher; breaks with two.

---

## 3. Users, Roles & Data Gates

### 3.1 Roles that touch this area

Roles are **customizable** (Settings → Roles & Logins); permissions key off a **tier**, never a role name (`roleTier`, `app.js:13055`; tiers in `config.js:326`). The five shipped roles map to tiers via `BUILTIN_ROLE_TIERS`:

| Role | Tier | What they do in Rentals / Dispatch |
|---|---|---|
| **Office** | money | The dispatcher. Quotes, books, sets windows, creates invoices, runs the cockpit, takes payments. |
| **Sales** | money | Builds quotes, sees pricing/margin to close deals. |
| **Driver** | staff | Works the day's run (drives the route, logs deliver/recover captures). Phase-2 driver cab is theirs. |
| **Mechanic / M.Tech** | staff | Touch a rental indirectly via the unit's inspection/service status flags that gate booking. |
| **Manager / Admin** | manager / admin | Override blocks, edit pricing/categories, flip the retroactive-pricing toggle, set Rental Rules. |

### 3.2 The money gate — `canMoney()`

The literal shipped definition (`app.js:14166`):

```js
const canMoney = () => !currentRole || roleTier(currentRole) >= tierRank('money');
```

`tierRank('money') === 2` (`config.js:328`), so `canMoney()` is true for **Office / Sales / Manager / Admin / Developer** (ranks 2–5) and false for **Driver / Mechanic / M.Tech** (`staff`, rank 1).

> **⚠️ SECURITY NUANCE — the no-role fallthrough.** `canMoney()` returns **`true` when `currentRole` is falsy** (no login / single-user / unauthenticated boot). This is intentional for the owner-operator solo mode, but it means *the gate is only a gate once a role is actually signed in.* Any new money-action this area adds **must lean on `canMoney()` (which already encodes that fallthrough) and never invent its own `roleTier(...) >= 2` check** that would behave differently before a login resolves. Surfaced as **OQ-15**.

`canMoney()` gates **collecting payment, cards on file, locking/unlocking price, merging invoices, the membership cancellation-pay pill** — *not* creating an invoice or adding a line. Handlers re-check `canMoney()` server-adjacent as defence-in-depth (`app.js:3262`).

**Today's posture (shipped, conservative — keep unless Jac flips):**
- **Creating an invoice** (`createInvoiceForRental`) and **adding lines** are **not** `canMoney`-gated — any dispatch role can (dragging a unit onto an invoiced rental already adds a `rental` line).
- **Extension billing** (`winPickSave` → `billExtension`) is likewise **not** `canMoney`-gated — editing the fragile window is itself the gate (per `2026-06-25-rental-extensions` §8). **Collecting payment** stays gated.
- **The `staff`-tier reality:** a Driver who can reach a fragile window *can* lengthen it and silently raise the customer balance; they simply cannot **collect** on it. The money-leak surface is *balance creation*, not *fund movement* — that is the exact fork OQ-1/OQ-2 hold open.

> **Gate decision surfaced as OQ-1 / OQ-2:** should extension billing and invoice creation move behind `canMoney` so a `staff` driver can't silently raise a customer's balance? Today they can't *collect*, but they can *bill*. Conservative recommendation: keep as-is for parity with `createInvoiceForRental`/`addCustomLine`, but flag — and if Jac wants it tighter, wrap the **fragile-window save path only** (not the live-commit non-fragile path, which is pre-invoice and harmless) in `canMoney()`.

### 3.3 Pricing-floor (margin) visibility

Categories carry `bottomDollar` (the floor) and `askPrice`/`msrp` (the sale fields). **These are sale/margin fields, not rental fields** — the rental engine (`rentalPrice`, `unitRentalPrice`, `unitExtensionDelta`) reads ONLY the four rate fields (`rate1Day`/`rate7Day`/`rate4Wk` + `memberDaily`/`weekend`) and **never touches `bottomDollar`/`msrp`/`askPrice`.** That is the structural reason this area is margin-safe today: the dispatch/rental data path has no code that even *loads* a margin field.

**Hard rule — Rentals / Dispatch must never surface `bottomDollar`, `msrp`, `askPrice`, or any derived per-unit margin to a `staff`-tier role.** The gate that owns this lives in `units-fleet` (the unit detail "Investment" section is the canonical margin surface and is already tier-gated there). Any new dispatch UI that renders a *unit* inline (the cockpit's unit pill, a future Phase-2 cab unit line) must show only **non-margin fields** — `unit.name`, category label, status, transport leg, address — and must **never** call into the unit Investment renderer. This spec **adds no margin surface** and the Phase-2 acceptance (§9.2) makes "no margin field in the cab" a hard `/jactec-ui /role`-audit gate. (OQ-3.)

### 3.4 Customer-isolation & PII

A rental references a customer by `customerId`; the cockpit shows `cust.name`/`company` and a delivery **address** (PII-adjacent). The dispatch map plots customer site addresses. **No new PII export, no cross-customer aggregation** is introduced here. Phase-2 driver-cab "tap-to-navigate" hands a customer address to the device's map app — that is the existing address, no new exposure. Phase-3 notify must **not** put customer PII in any SMS body until the comms-notifications gate is settled (OQ-8).

### 3.5 Booking hard gates (shipped, §9 — keep verbatim)

Both `setRentalStatus` and `setUnitStatus` enforce, before committing a status:
- **On Rent requires a linked invoice** (`!r.invoiceId` → blocked).
- **Blacklisted customer** → On Rent/Reserved blocked.
- **Admin "Rental Rules"** (`rentalRuleBlock`) — hard-block On Rent until each admin-marked-Required item (card / signature / selfie / PO / ID / terms) is met.
- **Card gate** — booking requires a valid, account-type-signed card; an unsigned card blocks. **Admin override** (`cardOverrideRental` → `requireAdmin`, backend-verified) unblocks + logs. Charging is never gated.
- **No-Show/Cancel a unit with an assigned payment** → blocked ("refund it first").

---

## 4. Data Model

### 4.1 The Rental entity (`data.js:107`, Sheets `rentals` tab — schema-less)

| Field | Type | Notes |
|---|---|---|
| `rentalId` | id | PK. `ref`/`covOf` links from invoices point here. |
| `customerId` | id → customers | The event's customer. |
| `categoryId` | id → categories | Legacy/primary category (per-unit category is read from each unit). |
| `unitId` | id → units \| null | **Legacy primary** unit; the §20 truth is `units[]`. |
| `units[]` | array | §20 multi-unit event array. Each entry: `{unitId, status, startHours, returnHours, startCapture, endCapture, fcCapture, transportType, deliveryAddress, recoveryAddress, sitePin, transportMiles, transportDriveMin}`. |
| `rentalName` | string | Read-only derived display elsewhere (`rentalDisplayName`); the stored name is a label. |
| `startDate` / `endDate` | ISO date | The shared window. **date-only** (price/availability contract). |
| `startTime` | 12h string | e.g. `"8:00 AM"`. |
| `status` | enum | `Quote / Reserved / On Rent / End Rent / Off Rent / Returned / Cancelled / No Show` (`Today`/`Tomorrow` retired). Mirror of the aggregate; per-unit status is canonical. |
| `transportType` | enum | `Self / Delivery / Recovery / Round-Trip` (legacy primary; per-unit on `units[]`). |
| `deliveryAddress` / `recoveryAddress` | string | Site addresses (PII-adjacent). |
| `sitePin` | `{lat,lng}` \| null | Geocoded drop. |
| `transportMiles` / `transportDriveMin` | number | **Cached** Google distance/time — pricing never re-calls Google. |
| `invoiceId` | id → invoices | The first/active invoice (1:1 anchor; the series adds more via `rentalIds`). |
| `startCapture` / `endCapture` | `{date, clock, video}` | Yard-journey logs; **also** the dispatch "done" signal. |
| `cardOverride` | bool | Admin override of the card gate. |
| `completed` | bool | Set by "Complete Rental"; drives the gray archived flag color. |
| `actions[]` | array | Audit log (`logAction`). |

### 4.2 Proposed-additive fields (Phase 2/3)

Schema-less, so additive — **migration-free** (absent = default):

| Field | Where | Purpose | Default |
|---|---|---|---|
| `units[].leg.deliveredAt` / `recoveredAt` | rental unit entry | Driver-cab timestamp distinct from the capture date (the capture already carries `clock`; this is a precise dispatch-completion stamp). | absent → fall back to capture |
| `dispatchSchedule` (NEW) | a backend config slice keyed by day | If we move stop times/order off per-device localStorage to a shared schedule (OQ-7). Shape: `{ [dayISO]: { order:[stopId], times:{stopId:"HH:MM"} } }`. | absent → localStorage today |
| `dispatchNotifies[]` (NEW) | per-day notification log | Phase-3 "notified · seen" receipt records: `{day, summary, at, seenAt}`. | absent → none |

### 4.3 Relationships by ID

```
customer 1──* rental ──* units[]  *──1 unit ──1 category (rate source)
   │              │
   │              ├──1 invoiceId ──┐
   │              └──* rentalIds  ──┴── invoice (28-day series; covOf/contOf/covStart/covEnd)
   │
dispatch stop  = derived (rentalId | unitId | task) — NO stored entity
```

**A dispatch stop is purely derived** (`dispatchStopId = rentalId|unitId|task`). It has no record; only its *time/order* persists (localStorage today). Migration concern: if a rental's unit set or transport type changes, its stop id can change → orphaned localStorage time/order entries (harmless, ignored on read).

### 4.4 Schema-less / migration notes

- All seed records carry `mock:true` (hygiene). New fields are additive; **no Sheets migration** — a missing field reads as its default. This is the project's core data discipline ("one fact, one place"; derived values never stored).
- The §20 `units[]` array coexists with legacy `unitId` via `rentalUnits()` — any new code must go through that helper, never read `r.unitId` directly.

---

## 5. Backend / Integration Contract

Backend = Google Apps Script + schema-less Sheets, single `backendCall(action, payload)` entry point. `Code.gs` is **gitignored** — this spec describes contracts only; it cannot read `Code.gs`.

### 5.1 Existing actions this area rides

| Action | Use here | Notes |
|---|---|---|
| `auth` | Returns `currentRole` (drives tier gating). | Already wired. |
| `getConfig` | Admin-password verification for `requireAdmin` overrides. | |
| sync (load/save) | Persists rentals/invoices through the data-wiring seam. | Extension lines + new additive fields ride this **unchanged** — no new action. |
| `mapsKey` | Fallback Maps key when config has none. | The committed referrer-locked key is preferred; `mapsKey` is the offline fallback. |

> **Extensions / billing require NO backend change** (per `2026-06-25` §7) — extension lines are ordinary invoice line items that persist through existing sync. **No `/clasp` deploy** for the shipped extension feature.

### 5.2 External integrations

| Integration | Status | Surface | Failure handling |
|---|---|---|---|
| **Google Maps (Maps JS + Places)** | live | Inline transport editor minimap + typeahead; dispatch cockpit map + geocode. | Hardened loader (`loadGoogleMaps`): a failed/empty load **clears `_mapsPromise`** so the next open retries (a cached failure once hung the map). Offline → city-tier pricing + placeholder map; cockpit shows located stops only, retries pinless later. |
| **Google Routes/Distance Matrix** | live (lazy) | One-way miles/drive-time for transport pricing, cached on the unit entry. | Lazy `importLibrary('routes')`; falls back to the city-tier estimate. Pricing **never** calls Google at render/bill time (cached). |
| **Telematics** | seam only | `dispatchTruckPos(stops)` v1 = last-done pin. | Phase-next: replace the body of this one function. Until then, no live position. |
| **Stripe / invoicing** | via invoicing-payments | Extension lines flow into the existing invoice; payment stays server-owned + `canMoney`-gated. | Owned by `invoicing-payments`; this area only appends lines. |
| **SMS / email notify** | unbuilt | Phase-3 driver notify (in-app first, SMS later). | Owned by `comms-notifications`. |

### 5.3 Proposed-additive actions (Phase 2/3 — only if these phases ship)

| Action (proposed) | Payload | Returns | Failure / concurrency handling | Why additive |
|---|---|---|---|---|
| `saveDispatchSchedule` | `{day:"YYYY-MM-DD", order:[stopId], times:{stopId:"HH:MM"}}` | `{ok:true, rev}` | **Last-write-wins is wrong for two dispatchers.** Return a `rev` (or `updatedAt`); client sends the `rev` it read and the action **rejects a stale write** (`{ok:false, conflict:true, current}`) → client re-pulls + re-applies its local reorder. Network fail → keep the localStorage copy, retry on next render (the schedule is never lost, just unsynced). | Only if OQ-4 picks backend-synced over localStorage. |
| `pushDispatchNotify` | `{day, summary}` | `{ok, notifyId}` | **Debounced client-side** (one record per settle, ~few-sec quiet window) so a flurry of reorders doesn't spam. Idempotency: include a client `dedupeKey = day+hash(summary)`; the action no-ops a duplicate within the window. Offline → queue locally, flush on reconnect. | Phase-3 notify record (in-app). |
| `ackDispatchNotify` | `{notifyId}` | `{ok, seenAt}` | Ack is idempotent (second ack returns the first `seenAt`). Unknown `notifyId` → `{ok:false}` (record GC'd), client treats as already-seen. | Driver acknowledge → "notified · seen" receipt. |

All additive on `backendCall`; none mutate the money path; none carry customer PII in the payload (`summary` is "N stops", never a name/address — see §3.4 / OQ-8). **Surface as OQ — do not assume `Code.gs` can take these without Jac's `/clasp` deploy (ADDITIVE only, prod-deploy STOP gate applies).**

---

## 6. UX / UI

All UI in the **yard data-plate** language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), **one** safety-orange accent (`--accent #ff7a1a` — selected / ignition / next / linked, **never** a status color), the hi-vis hazard stripe as the **single** signature beat, Saira Condensed stamped uppercase labels (~2px tracking), Geist body, corner rivets, and a **restrained** ranch-twist mostly in copy. Every new pill/flag/add/button/field goes through a §5 builder with a `data-r` stamp; zero R0 flash-lint violations.

### 6.1 Shipped surfaces (canon — restyle only when touched)

| Surface | Where | Yard-plate state |
|---|---|---|
| Rental detail card | `EngineCard.rentals`, the Day Timeline + per-unit journey | Status pill (flag-driven color), the Jac—Site—Jac journey as the transport control, +Unit / +Transport (R5b) / +Invoice action column. |
| Window picker | `winPickerEl`, inline | `.winpicker` calendar, time selector, blocked days, staged extension banner (`.wp-ext`), `BILL EXTENSION` relabel. |
| Transport editor | `transportEditorHtml` (R5b), inline | Minimap, typeahead, one-way price + "X min /one-way". |
| Dispatch cockpit | Calendar card body, `dispatchGridBody` | Full-pane map (orange route Polyline, orange yard arrow, next-stop orange ring), `.disprail` hover rail with kind badges (Deliver = blue, Recover = brown/tan), Done badge, editable time, DnD reorder, live footer. |

### 6.2 Extension preview banner (shipped, document as canon)

Inside the picker, only when the staged window **lengthens** a fragile + invoiced rental:

```
┌─ EXTENSION ─────────────────────────────┐
│ +7 days · Ju12 → Ju19                    │  ← Saira kicker + days delta
│ Added charge      $1,290.00              │
│ Tax (10.75%)        $138.68              │
│ New balance       $3,196.70              │
│ Cheapest price for all rental days —     │  ← basis copy (retro ON)
│ prior charges count toward it.           │
└──────────────────────────────────────────┘
```

A down-reblend (extending unlocks the cheaper 4-Week rate) shows `Re-price` + an "Invoice credit" line. A shorten shows "Window shortened — no auto-credit; refund manually if owed."

### 6.3 Proposed — Driver Cab (Phase 2, the one new big surface)

A role-aware second cockpit branch (Driver tier → cab; Office → god-view; a stamped toggle for the owner-operator who dispatches *and* drives). Yard-plate, mobile-first (a driver holds a phone in a truck):

- **Map snapped** you-are-here → next pin.
- **One giant action plate** (R-built, full-width): time · `Deliver`/`Recover` badge · unit · customer (`refPill`) · tap-to-navigate address · a **hazard-stripe caution strip** for special instructions.
- **Primary action = `MARK DELIVERED` / `MARK RECOVERED`** (ignition-orange gradient, dark ink) → logs the existing leg capture, fills the route leg green, auto-promotes the next stop.
- **Add video / pic** — a big R21 `fileDrop` (`capture=environment`) into the Drive-backed capture store.
- **Persistent NOW-bar:** "Next: ⟨cust⟩ · ⟨drive-min⟩ · ⟨addr⟩".
- **Graceful fallback:** no GPS/signal → manual "Next stop" + last-known, never a frozen map.
- **Copy (ranch-twist, subtle):** "Roll out", "Back to the yard", "Next stop on the run".

**R-rulebook:** the action plate, Mark button, caution strip, and NOW-bar get **new `data-r` stamps**; regenerate `rule-usage.js`. **WINDOW_CATALOG:** the cab is a **view branch inside the Calendar card, not a popup** — *if* any part opens as an overlay (e.g. a stop-detail sheet), it needs a catalog entry + `check-window-catalog.mjs` re-run (OQ-9).

### 6.4 Proposed — Live auto-notify + driver banner (Phase 3)

- **Office side:** keep the live-board footer; after edits settle (debounce ~few sec) write **one** notification record + a brief inline undo. Footer gains a "notified · seen" receipt.
- **Driver side:** a **hazard-stripe banner** "Dispatch updated — N stops" over the map with one `ACKNOWLEDGE` plate; until acked, old ghost tokens show beside the new.
- No draft/commit/send step — the board is always live.

**R-rulebook:** banner + acknowledge plate + receipt = new stamps. **WINDOW_CATALOG:** no popup if it's an inline banner.

### 6.5 States

| State | Cockpit | Picker | Driver cab |
|---|---|---|---|
| Empty | "No transports on this day" + truck glyph + flip-days hint (shipped). | No window set → two-click prompt. | "Run's clear — nothing on today." |
| Loading | "Loading dispatch map…" spinner (map mount). | instant. | snapped map loading; NOW-bar shows last-known. |
| Error / offline | Located stops render; pinless retried; placeholder if no key. | calendar works offline. | manual "Next stop", last-known, no freeze. |

### 6.6 Mobile reflow

The 3-column yard grid collapses per `2026-06-14-mobile-adaptive-design.md`. The cockpit map must take the full mobile viewport (dvh-aware, safe-area insets); the hover rail becomes a **bottom sheet** on touch (no hover). The driver cab is **phone-primary**. Run all of it through `/jactec-ui` (mobile sub-capability) — touch gestures (tap vs long-press vs drag), Vibration-API haptic on Mark-delivered.

---

## 7. Business Rules / Derivations / Money

### 7.1 The rate optimizer (cite the real formula, `rentalPrice` `app.js:836`)

```
days       = max(1, dayDiff(start, end))
if member  → price = days × memberDaily              ; rate = "Member×days"
elif weekend window (Fri→Sun=2d | Fri→Mon=3d | Sat→Mon=2d, NOT Sat→Sun)
           → price = category.weekend                ; rate = "WKND"
else       → minimize over mm,ww,dd of
             mm×rate4Wk + ww×rate7Day + dd×rate1Day
             subject to 28×mm + 7×ww + dd = days
```

- **Per unit**, each unit billed by its **own** category across the **shared** window.
- A category with all three rates 0 (`catRatesUnset`) → quote-time caution (never bills free).

### 7.2 Extension delta (cite `unitExtensionDelta` `app.js:951`)

```
retro ON :  delta = round( rentalPrice(new full window).price
                           − unitBilledRental(inv, rentalId, unitId), cents )
retro OFF:  delta = round( rentalPrice(prevEnd → newEnd).price, cents )   // fresh added segment
bill iff   delta > 0.005   (positive only; refund-first on a shorten)
```

`unitBilledRental` sums the unit's existing `rental` + `extension` line amounts, so **composes** across repeated extensions with no double-count. Invariant: **ON total ≤ OFF total** for the same extension (blending never costs more).

### 7.3 The 28-day series (cite `INV_CAP_DAYS` `app.js:965`)

An invoice bills ≤28 rental-days/unit. Because the 4-Week rate **is** 28 days, splitting at 28-day marks bills the **same total** as one blended invoice — purely organizational. Extension fills the active chunk toward its cap first (re-blend per the retro setting, **up or down** for *unpaid* lines), then spills remaining days into fresh ≤28-day invoices. A **closed (balance $0)** or **locked** active chunk spills immediately (never reopen a settled invoice). Continuation invoices carry `covOf`/`covStart`/`covEnd`/`contOf`; their labels read "… · Ext of ⟨rental⟩ (⟨first inv#⟩)".

### 7.4 Tax

Extension and rental lines are taxable by default; `invoiceTotals()` (`app.js:1304`) applies the **10.75%** exact-cent tax (owned by `invoicing-payments`). Customer/line tax exemption flows through unchanged.

### 7.5 Transport pricing (cite §10 / `2026-06-15-inline-transport-redesign`)

```
legs    = Round-Trip→2 ; Delivery|Recovery→1 ; Self|none→0
fueled  = /diesel|gas|gasoline|petrol|propane|lp/i.test(category.fuelType)
perLeg  = 3.50 × oneWayMiles + 50 (load) + (fueled ? 20 : 0) (fuel)
price   = perLeg × legs ;  $0 for unlimited-transport active members
```

`oneWayMiles`/`driveMin` cached on the unit entry at save time → deterministic billing, no Google at render.

### 7.6 Status derivation & the flag-color system

Status **label** = lifecycle (`Quote…No Show`); status **color** = flag-driven (R/Y/G/gray) via `getEntityColor('rentals', r)` (see `flag-color-system.md` §7.1). `Today`/`Tomorrow` retired → `starts-today`/`starts-tomorrow` yellow flags. `Off Rent` always red (overdue return); `End Rent` always yellow (returning today); terminal-but-not-completed → yellow `complete-rental` flag; `r.completed` → gray.

### 7.7 Dispatch derivations

- **Stops** derive from rentals (`dispatchEvents`); skip Self/voided/terminal/quote.
- **Done** = the unit's `startCapture` (Deliver) / `endCapture` (Recover) exists — no new state.
- **Next** = first not-done stop in run order.
- **Order/time** = per-device localStorage layered over the natural date+time sort.
- **Truck** = last-done pin (v1 seam).

### 7.8 Edge cases

- **Multi-unit divergence** locks the master gate to a gray mix label until units re-converge.
- **Voided unit (No Show/Cancelled)** stays on the record, **un-billed**; un-voiding restores its lines.
- **A unit with an assigned payment** can't be No-Show/Cancelled until refunded.
- **Window move/shrink** is never an extension (`isWindowExtension` requires a strict superset) → no auto-bill.
- **Locked/closed invoice** blocks an extension on that chunk → spills to a new continuation.
- **Stop-id churn** (unit/transport change) orphans localStorage time/order entries (ignored on read).

---

## 8. Phasing & Milestones

### Phase 1 — Office cockpit + lifecycle + money ✅ SHIPPED (canon)

Multi-unit event model, rate-blend optimizer, per-unit transport editor + Maps, window picker, extension billing + 28-day series, dispatch cockpit (map + rail + reorder/retime). **In scope of v1 of this spec = document as canon, no rebuild.**

### Phase 2 — Driver cab ⏳ PROPOSED

- Role-aware cab branch (next-stop map, action plate, Mark-delivered/recovered → capture reuse + auto-advance, Add video/pic, NOW-bar, offline fallback). Owner-operator toggle.
- **Out of scope for v1:** any net-new progress state beyond "Completed"; multi-driver assignment (single-driver model is locked).

### Phase 3 — Live auto-notify ⏳ PROPOSED

- Debounced in-app notification record on schedule change; driver hazard banner + acknowledge + "notified · seen" receipt. SMS deferred to comms-notifications.
- **Out of scope:** SMS/email body content + opt-out (owned by comms-notifications).

### Phase 4 — Telematics + schedule sync ⏳ PROPOSED

- Swap `dispatchTruckPos` body for the live feed.
- Decide localStorage → backend-synced schedule (OQ-7). **Out of scope for v1.**

**Explicit v1 spec scope:** ratify Phase 1 as canon + lock the Phase 2/3/4 contracts and open questions. **No code change is mandated by this spec** unless Jac approves a phase.

---

## 9. Acceptance Criteria

### 9.1 Phase-1 regression (must stay green — these are CI-enforced today)

| # | Criterion | Gate |
|---|---|---|
| 1 | 5→12-day extension on a single-unit invoiced rental → one `extension` line == `rentalPrice(12d) − rentalPrice(5d)`; tax recomputed. | `ci/logic-test.mjs` |
| 2 | 5→8→12 two-step → two extension lines, no double-count, total == `price(12d) − price(5d)`. | `ci/logic-test.mjs` |
| 3 | Multi-unit: each non-voided unit gets its own delta; voided unit gets none. | `ci/logic-test.mjs` |
| 4 | Shorten (12→8) on an invoiced rental → no line, balance unchanged. | `ci/logic-test.mjs` |
| 5 | Allocation stability: a payment allocated to the `rental` line is untouched after an `extension` line appends (lid-keyed). | `ci/logic-test.mjs:40` |
| 6 | Locked invoice → extension blocked, date unchanged. | `ci/logic-test.mjs` |
| 7 | App boots; cockpit renders; picker opens. | `ci/smoke.mjs` |
| 8 | Every UI element stamped `data-r`; no duplicate rules. | `ci/gen-rule-usage.mjs --check` |
| 9 | No popup added/removed without a catalog update. | `ci/check-window-catalog.mjs` |
| 10 | Code-Atlas chapter banners not drifted. | `tools/gen-code-map.mjs --check` |

### 9.2 Phase-2 (driver cab) acceptance — when built

- Mark-delivered logs `startCapture`, fills the leg green, advances next, persists.
- Offline → manual advance works; map never freezes.
- New stamps regenerate `rule-usage.js`; any overlay → WINDOW_CATALOG entry + green `check-window-catalog`.
- Driver (`staff`) sees the cab but **no margin/pricing-floor** field (margin-leak check via `/jactec-ui /role` audit).

### 9.3 Phase-3 (notify) acceptance — when built

- One debounced record per settle; acknowledge → "notified · seen"; no PII in any future SMS body until comms gate clears.

> **Port note for local gates:** port 8000 is reserved — `sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, `git checkout -- ci/`.

---

## 10. Risks & Edge Cases

| Risk | Severity | Mitigation |
|---|---|---|
| **Schedule is per-device localStorage** — two dispatchers see different runs. | High (multi-user) | OQ-7: backend-sync the schedule; v1 single-dispatcher accepted. |
| **Maps quota / load failure** hangs the cockpit. | Med | Hardened loader clears cached failures + retries; offline placeholder + city-tier pricing. |
| **Extension double-billing** if `unitBilledRental` misses a line kind. | High (money) | Diffs against `rental` + `extension` kinds only; logic-test cases 1–6 lock it. Refund-first: positive deltas only. |
| **Margin leak** if Phase-2 cab surfaces a unit card with `bottomDollar`. | High (data gate) | This spec adds no margin surface; `/jactec-ui /role` audit before any cab build. |
| **Stale stop-ids** orphan time/order. | Low | Ignored on read; harmless. |
| **Stop "done" depends on capture** — a capture cleared elsewhere un-completes a stop. | Low | Single source ("one fact, one place") is intentional; document. |
| **Telematics feed shape unknown** until Jac wires it. | Med | Isolated to `dispatchTruckPos` body; seam contract `{lat,lng,source}`. |
| **Phase-3 notify without SMS** — driver must have the app open. | Med | In-app first, SMS phase-2 (comms-notifications). |
| **Free-form arrows** linger in code though the redesign called them retired. | Low | OQ-11: keep, hide, or remove. |
| **Reduced-motion / focus** on the cockpit map + drag. | Med (quality floor) | Respect `prefers-reduced-motion`; visible focus on rail tokens (jactec-ui floor). |
| **`canMoney()` no-role fallthrough** opens money actions pre-login on a shared device. | Med (security) | OQ-15: render-gate money surfaces until `auth` resolves a role; keep the fallthrough for solo mode. |
| **Concurrent window edit** — two users open the same fragile rental; both Save an extension → double `extension` lines. | High (money/data-integrity) | The sync layer's diff-upsert is last-write-wins on the *rental*, but the *invoice* lines append — a true concurrent extension could double-bill. Mitigation: the `billExtension` diff is against `unitBilledRental` (current line state); a second save that re-reads the now-updated invoice computes `delta ≤ 0` → no second line. The window is narrow (both must read the pre-extension invoice). Flag for a hard test if a second dispatcher is added (ties to OQ-4). |
| **Capture cleared after a stop "done"** → stop flips back to not-done mid-run, re-promoting it as "next". | Low | Intentional single-source ("one fact, one place"); the driver simply re-marks. Document; don't add a shadow "dispatched" flag. |
| **Geocode cache staleness** — a customer edits their site address but the cached `transportMiles`/`sitePin` is the *old* drop → bills/routes the wrong distance. | Med (money + ops) | Cache is keyed/refreshed at transport-editor save; a customer-record address change does NOT auto-reprice (the rental holds its own `deliveryAddress`). Document: the rental's leg is the source, not the customer record — re-open the transport editor to re-geocode. |

---

## 11. Open Questions

> **Resolved 2026-06-29:** OQ-1/OQ-2 → D1 · OQ-15 → D2 · OQ-4/OQ-7 → D3 · OQ-5 → D4 · OQ-11 → D5 · OQ-6 → D7. OQ-3/OQ-8/OQ-10/OQ-12 stand at their stated recommendations. **Only OQ-13 and OQ-14 remain genuinely open.** (See the Decisions block up top.)

*(No seed questions were captured for this area; all below are generated from the code + specs.)*

| # | Question | Trade-off / recommendation |
|---|---|---|
| **OQ-1** | Should **extension billing** move behind `canMoney`? | Today a `staff` driver *can* lengthen a fragile window → silently raise a customer's balance (they still can't *collect*). **Tighter** = a one-line guard, parity with "Pay/Charge". **As-is** = matches `createInvoiceForRental`/`addCustomLine` (un-gated). *Rec: surface to Jac — lean tighter for money safety.* |
| **OQ-2** | Should **invoice creation** (`createInvoiceForRental`) be `canMoney`-gated? | Same fork as OQ-1; today un-gated by design (dragging a unit already adds a line). |
| **OQ-3** | Does the cockpit's inline **unit pill** ever risk surfacing margin (`bottomDollar`) to a `staff` driver? | It shows a unit *name* today (safe). Any future enrichment (e.g. unit value on the cab) must keep the margin gate. *Rec: hard rule — no margin in dispatch.* |
| **OQ-4** | **Schedule storage:** keep per-device localStorage, or move to a backend `dispatchSchedule` slice? | localStorage = zero backend, single-dispatcher only. Backend = multi-device truth but needs an additive action + `/clasp`. *Rec: backend-sync once a second dispatcher exists.* |
| **OQ-5** | **Phase-2 driver cab — is it still single-driver?** | The map-redesign locked single-driver (no assignment field). Confirm JacRentals still has one driver before building multi-rail would be wasted. *Rec: stay single-driver.* |
| **OQ-6** | **Mark-delivered = the capture, or a separate dispatch stamp?** | Reuse capture (no new field, "Completed only") per the locked decision, vs. a precise `deliveredAt` timestamp distinct from the yard-journey log. *Rec: reuse capture; add `deliveredAt` only if a precise on-time KPI needs it.* |
| **OQ-7** | **Phase-3 notify channel** — in-app record only for v1, SMS later? | In-app needs the app open; SMS needs comms-notifications + a PII decision. *Rec: in-app first (locked), SMS via comms.* |
| **OQ-8** | **PII in any future dispatch SMS** — name + address, or a bare "you have N stops"? | Address in an SMS body is a PII exposure (public-repo / opt-out concern). *Rec: minimal body, no PII, until comms gate settles.* |
| **OQ-9** | **Does the driver cab introduce any popup** (stop-detail sheet) needing a `WINDOW_CATALOG` entry? | If the cab is a pure view branch in the Calendar card → no catalog change. A bottom-sheet overlay → catalog + `check-window-catalog`. *Rec: keep it inline; catalog only if an overlay is unavoidable.* |
| **OQ-10** | **Feasibility guard / time-axis drag / snap detents** (the full map-redesign vision) — build in Phase 2, or stay a list rail? | The drive-MINUTES feasibility check is rough vs. Distance Matrix; the time-axis drag was deferred once. *Rec: keep the list rail; add feasibility only if route mistakes are actually hurting.* |
| **OQ-11** | **Free-form route arrows** — the map-redesign spec says "retired", but `dispatchArrowsLS`/`autoDispatchRoute`/`drawDispatchArrows` are still in code. Keep, hide, or delete? | Dead-ish code adds drift risk. *Rec: confirm with Jac, then remove or hide behind a dev flag.* |
| **OQ-12** | **"Off Rent" semantics.** Ground truth: `Off Rent` **IS a real stored, user-settable status** — it's in `STATUS_ORDER` (`app.js:230`), `ACTIVE_RENTAL` (`app.js:1630`), the settable `rentalStatus` flag-registry order (`app.js:11381`), and has its own gate icon (`app.js:11360`); its flag color is always-red via `off-rent-overdue` (`app.js:3942`). So the open question is **not** "is it stored" but **"what transitions a unit *into* `Off Rent`, and is it ever auto-set?"** Today a user picks it manually (machine past its window but not yet inspected/returned). | If JacRentals wants `Off Rent` to *auto-derive* when `endDate` passes without a `Returned` capture, that's a new derivation rule (and a flag-vs-status conflict to resolve). *Rec: keep it manual (one fact, one place — don't auto-mutate a stored status); document the manual transition; only auto-flag (not auto-set) overdue.* |
| **OQ-13** | **Telematics feed contract** — what shape does Jac's live feed return, and how often? | `dispatchTruckPos` expects `{lat,lng,source}`. Polling vs. push, staleness handling. *Rec: lock the contract before wiring.* |
| **OQ-14** | **Extension on a `Returned` rental** — allowed today (`rentalFragile` includes `Returned`). Is "extend a returned machine" a real flow or an accident? | Rare-but-allowed per the extensions spec — a contractor who returned then immediately re-took the same machine within the window. *Rec: confirm it's intentional; if it's an accident vector, drop `Returned` from `rentalFragile`'s status set (it stays fragile via `invoiceId` anyway, so the only loss is extending an un-invoiced returned record — which shouldn't exist).* |
| **OQ-15** | **The `canMoney()` no-role fallthrough** — `canMoney()` returns `true` when `currentRole` is falsy (pre-login / solo mode). For a *single-yard owner-operator* that's correct; but if a kiosk/shared device ever shows the cockpit before a login resolves, every money action is briefly open. Should the dispatch money paths (and any Phase-2 cab money touch) require a **resolved** role, not the permissive default? | Tighter (`currentRole && canMoney()`) closes the pre-login window but breaks the intentional solo/no-auth mode. *Rec: keep the fallthrough (it's load-bearing for solo mode); guard instead by never mounting a money-action surface until `auth` has returned a role — a render-gate, not a permission change.* |

---

## 12. Dependencies & Sequencing

| Depends on (roadmap slug) | Why | Must land first? |
|---|---|---|
| `invoicing-payments` | Extension lines, tax, locking, the 28-day series live there; payment is server-owned + `canMoney`-gated. | Already shipped — the contract this area appends to. |
| `units-fleet` | Per-unit category (rate source), availability (`isUnitAvailableFor`/`categoryAvailableCount`), inspection/service/GPS statuses that gate booking + flags. | Shipped. **Margin gate** owned here — respect it. |
| `customers-crm` | Customer record, card/agreement gate, blacklist, pay-status flags. | Shipped. |
| `maps-location` | The Maps loader, geocode, Distance Matrix, `YARD_CENTER`. | Shipped — cockpit + transport editor reuse it. |
| `gps-tracking` | Telematics feed for `dispatchTruckPos` (Phase 4). | **Must land for Phase 4** truck position. |
| `automated-pricing` | Any future rate automation feeds `rentalPrice`'s inputs (rates), not the optimizer. | Optional. |
| `comms-notifications` | Phase-3 driver notify (in-app now, SMS later) + the PII-in-SMS decision (OQ-8). | **Must land for Phase 3** SMS. |
| `backend-data` | The sync seam; any additive dispatch-schedule / notify action (OQ-4/7) needs a `/clasp` deploy. | **Must land for** backend-synced schedule. |
| `design-system` | The flag-color system (status colors), the R-rulebook, WINDOW_CATALOG enforcement. | Shipped — all new UI conforms. |

**Sequencing for the proposed phases:** Phase 2 (driver cab) is self-contained (reuses captures + Maps) and can ship without backend changes — build first. Phase 3 (notify) needs a backend notify record (additive action + `/clasp`) → after `backend-data`/`comms-notifications`. Phase 4 (telematics + schedule sync) waits on `gps-tracking` + the OQ-4 storage decision.

---

*End of DRAFT — every numbered decision above is open to Jac's critique. Surface conflicts via popup (AskUserQuestion), never inline.*
