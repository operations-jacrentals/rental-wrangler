# GPS / Tracking — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/gps-tracking`
**Task branch:** `gps-tracking/spec` (proposed)
**Maturity:** 🟡 Partial (seam only)
**Scope:** Turn the metadata-only GPS seam into a live telematics layer — real-time unit position, a self-healing `gpsStatus`, geofence-based stray/yard alerting, and the Driver "Driving Score" — wired through ONE additive backend action that polls Jac's existing telematics provider (GPSWOX) server-side.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions and **supersede the single-driver / asset-only assumptions** (the `rentals-dispatch` D4 multi-driver decision changed that).

- **D1 · Track trucks AND drivers; trucks are first-class GPS assets (resolves §11.5/§11.13).** The dispatch Google Map embed is wired to the **trucks' own live GPS** — so a **truck is a tracked entity with its own `gpsDeviceId`**, and `dispatchTruckPos` reads the **truck's live position directly** (not inferred from the hauled unit). The office Tracking board shows trucks + drivers + units, all live data. Combined with `rentals-dispatch` D4 (multi-driver), **per-driver tracking + Driving Score become real** (per-driver, not fleet-aggregate). *(Build note: decide whether trucks are a new mini-entity or units of a "truck" type — they need a device id + a driver assignment.)*
- **D2 · On-rent coordinates open to all staff (resolves §11.6/§11.15).** Drop the money-tier coord gate — all signed-in staff see exact unit coordinates (consistent with the open-visibility posture). Still **never customer-facing**, never on a Pages-served surface.
- **D3 · Engine hours — telematics auto-updates `currentHours`, manual stays as fallback/override (resolves §11.10).** A reported engine-hour reading updates `currentHours` (with a **monotonic / sane-range clamp** so a bad read can't corrupt service countdowns — ties to `maintenance-shop` OQ-9); manual entry remains available as fallback + override; position-only devices keep hours manual. (Jac: "both.")
- **D4 · Build server-side SMS BEFORE GPS stray alerts (resolves §11.16 — sequencing).** Jac: "build SMS before GPS." The stray-alert path depends on **`comms-notifications` server-side outbound SMS**, so that capability is a **prerequisite** — prioritize comms SMS ahead of GPS **Phase 2** (geofence/stray). GPS **Phase 1** (status truth + live position dots + truck-linked dispatch map) still proceeds; only stray *alerting* waits on SMS.

**Defaults adopted:** §11.7 → server-side poll for v1 (webhook Phase 3) · GPSWOX provider, provider-agnostic `gpsSnapshot` shape (§11.12) · §11.14 → fold config into `setConfig` · §11.1 → 2-consecutive-breach hysteresis, 250 m yard / 500 m jobsite defaults · §11.2 → blank `gpsDeviceId` = unmanaged (keeps manual status) · §11.11 → write to units tab (move to a `gpsState` tab only if row-churn fights other writers) · §11.3 → stray ledger Phase 3 · §11.4 → last-known only (no breadcrumb) in v1.

---

## 1. Goal & Problem

### 1.1 The problem
JacRentals rents heavy equipment that drives off the yard on a flatbed and sits on a customer jobsite for days or weeks. Today the app has **no idea where any machine physically is**. Every GPS field in the system is hand-entered metadata:

- `gpsType` ("GPSWOX"), `gpsPlacement` ("Under dash") — typed by an operator, never verified.
- `gpsStatus` ∈ {Reporting · Verify · Not Reporting} — a *manual* registry pill someone toggles, not a live signal.
- The dispatch map's truck marker (`dispatchTruckPos`) is an **explicit v1 placeholder** that snaps to the last-completed stop, with a code comment promising "swapped for live telematics (~next week, Jac)".
- The Driver KPI ring "Driving Score" is hard-coded `null` because it "needs the GPS backend".

So the questions a rental yard most wants answered — *Where is U004 right now? Did it leave the jobsite? Is the unit on my dispatch map actually moving? Which machine fell off the network three days ago?* — are all unanswerable. The seams exist; the feed does not.

### 1.2 What this area is for
Light up the seams with a **real, low-frequency telematics feed** so the app reflects physical reality:

1. **Live position** — every GPS-equipped unit carries a last-known `{lat, lng, ts}`, drawn on the maps the app already mounts (`maps-location`).
2. **Self-healing status** — `gpsStatus` flips to `Not Reporting` automatically when a device goes silent past a threshold, instead of waiting for a human to notice; `Reporting` when fresh data lands. This is the single biggest fix — the red **GPS Offline** flag (`gps-offline`, app.js:3956) becomes *trustworthy*.
3. **Geofencing** — a yard fence (and optionally a per-rental jobsite fence) that fires a **stray alert** when a machine leaves where it's supposed to be (theft / unauthorized move).
4. **Driving Score** — populate the Driver ring from real harsh-event / speeding telematics, replacing the `null` placeholder.

### 1.3 North star
> Open any unit card, the dispatch map, or the new Tracking board and **trust the dot.** A red GPS pill means the machine is genuinely dark; a moving truck on dispatch is the *actual* truck; a stray alert means a machine actually left the yard or jobsite. No human re-keying, no "swapped next week" lies in the code.

This is a **Want** (tier), priority #8 — high value but gated on an external provider integration and the maps/dispatch spine landing first. The spec deliberately phases so Phase 1 (status truth + position dots) ships value without geofencing or scoring.

---

## 2. Current State (Baseline)

Everything that exists today is **metadata + seam**. There is no live feed, no webhook, no geofence, no scoring. Documenting the seam precisely so the build extends it rather than reinventing it.

### 2.1 What exists (shipped — but inert)

| Piece | Anchor | State |
|---|---|---|
| **GPS section** on the unit card (status pill + type + placement, inline-edit) | `STD.units`, app.js:5873–5877 (`APP-16`) | Renders `statusPill('gpsStatus', …)` or a `badge('No GPS')`, then two `efld` text fields `gpsType` / `gpsPlacement`. Pure metadata. |
| **`gpsStatus` registry** (3 values) | `config.js:145` | `Reporting`=green · `Verify`=yellow · `Not Reporting`=red. Manually set; an admin-editable status set (`SET_CARD.gpsStatus = 'units'`, app.js:3915). |
| **Two GPS flags** | `app.js:3956,3960` + `config.js:239,243` | `gps-offline` (red) = `gpsStatus === 'Not Reporting'`; `gps-verify` (yellow) = `gpsStatus === 'Verify'`. These already feed the unit pill color via the flag-color system. **They fire off the manual field today** — Phase 1 makes the field truthful, so the flags become real with zero flag-code changes. |
| **Driving Score KPI ring** | app.js:7118–7123, `KPI_HELP` 7157, `ROLES` config.js:307 | Driver role ring #3 returns `null` ("Driving Score = GPS backend"). Renders as an empty/placeholder ring. |
| **`dispatchTruckPos(stops)` seam** | app.js:8114–8118 | v1 = last-done stop's pin, else `YARD_CENTER`. Comment: "swapped for live telematics (~next week, Jac)". The dispatch map (`mountDispatchMap`/`refreshDispatchMap`, ~app.js:8247) drops a "Driver" marker at this position. |
| **`driverPosition(day)` seam (spec'd, not built)** | dispatch-map design §"Truck-position seam" | The design spec proposed a single `driverPosition(day) → {lat,lng,source}` to be the swap point. **Not in code** — `dispatchTruckPos` is the actual seam. |
| **Settings → Integrations stub** | app.js:3415 | `{ id:'integrations', label:'Integrations', note:'Stripe, Maps, telematics feed — references & toggles (secrets stay server-side)' }` — note only; the panel body is **not built** (no `v1:true`). |
| **`YARD_CENTER`** | app.js:1346 | `{ lat: 30.2366, lng: -93.3774 }` — Sulphur, LA. Map default + the implicit yard origin. The natural center of the yard geofence. |
| **Seed device data** | `data.js:36,37,43,46…` | Units carry `gpsType:'GPSWOX'`, `gpsPlacement`, and a seeded `gpsStatus`. **GPSWOX is the provider** (a real GPS-tracking platform with a REST API + webhooks). |
| **Search index** | app.js:778,781 | `gpsType`, `gpsStatus` (+ its label `L('gpsStatus',…)`) are indexed for global search. |

### 2.2 What is missing (the build)
- **No live position field** on units — no `lat`/`lng`/`gpsTs` anywhere in `data.js`.
- **No backend telematics action** — `backendCall` has Stripe / maps / membership / wrangler / config actions; **nothing for GPS**.
- **No geofence model** — no yard fence radius, no jobsite fence, no breach detection.
- **No stray alert flag** — only offline/verify exist; "left the geofence" has no flag, notification, or surface.
- **No Driving Score formula** — the ring is `null`.
- **No Tracking surface** — no map of the whole fleet; position would only ever appear on the unit card / dispatch map.
- **No Integrations panel UI** — the telematics toggle/health is a note, not a screen.

### 2.3 Adjacent code it MUST build on (don't reinvent)
- **Maps loader** — `loadGoogleMaps` / `mapsReady` / the hardened core-gated loader, `YARD_CENTER`, the `_teMap`/`_dispMap` mount pattern (app.js:1404, 8247). Referrer-locked Maps key fetched via `backendCall('mapsKey')` (app.js:1309). **Reuse, don't add a second map stack.**
- **Flag-color system** — `gps-offline` / `gps-verify` already wired; the new stray flag plugs into the same `FLAG_CATALOG` machinery (`config.js` + app.js:3952 units block).
- **`backendCall`** single entry point — every backend feature is one additive action on it.
- **KPI ring engine** — `legacyKpiPct('driver')` (app.js:7118) returns the ring triple; the third slot is where Driving Score lands. (A future admin-definable metric engine, `kpiEval`, exists at app.js:7167 but Driving Score is an *external-data* metric, not a DATA aggregate — see §7.4.)
- **Dispatch cockpit** — `dispatchTruckPos` is the seam; the driver-cab Phase 2 (dispatch-map spec §"Driver cab", still pending) is the natural consumer of live truck position.

---

## 3. Users, Roles & Data Gates

### 3.1 Roles (15-role / tier model — `ROLE_TIERS`, config.js:326)
Roles are customizable; gates compare **tiers** (`tierRank`), not names. The five shipped roles map to tiers via `settings.roleMeta` (default ladder: staff < money < manager < admin < developer).

| Role / tier | What they see in GPS/Tracking |
|---|---|
| **Driver** (staff) | Their own truck on the dispatch cab map; their **Driving Score** ring. Can see unit positions for the day's run. Should NOT see the full fleet stray board (it's a manager/owner asset-protection tool — Open Q §11.5). |
| **Mechanic / M.Tech** (staff) | GPS status pill + position on the unit card (helps locate a machine to service). No scoring, no stray board. |
| **Office** (money) | Unit positions + GPS status everywhere they already see units; stray alerts in the notification stream. |
| **Sales** (money/navy) | Unit positions are useful for "is this machine free / where is it" — read-only. |
| **Manager / Admin** (manager/admin) | The full **Tracking board** (fleet map + offline roster + stray log), geofence config, the Integrations health panel, and the device↔unit mapping. |
| **Admin / Developer** (admin/developer) | Settings → Integrations: enable/disable the feed, see last-poll health, edit the yard fence. Secrets (GPSWOX token) live server-side only; the panel shows **status, never the secret** (§5). |

### 3.2 Gate matrix — who can do what (the enforcement contract)
Every row below is a **tier compare** (`tierRank(role) >= tierRank(X)`), never a name match, so a renamed/custom role inherits the gate by its mapped tier. **Read gates are UI-conditioned (front-end); WRITE/money-adjacent gates are ENFORCED server-side** (a hidden button is not a gate — the action re-checks the password tier).

| Capability | Min tier | Enforced where | Note |
|---|---|---|---|
| See a unit's `gpsStatus` pill + "Last seen" on the unit card | staff | UI | Same surface they already see units on. |
| See raw `gpsLat/gpsLng` of an **on-rent** unit (exact jobsite coords) | **money (Office+)** | UI + `gpsSnapshot` field-trim | Conservative: staff (mechanic/driver) see *status + "on-site / strayed"*, not the customer's exact coordinates. → Open Q §11.6. |
| See own truck position on the driver-cab map | staff (Driver, self only) | UI | Driver sees **their own** position, never a peer's. |
| Open the fleet **Tracking board** (whole-fleet map) | **manager** | UI | Asset-protection tool. → Open Q §11.13 (does Office/Sales get it too?). |
| Acknowledge a stray (`gpsAckStray`) | **manager** | UI + server | Clears the nag; manager-tier so a random staffer can't silence a theft signal. |
| Edit the geofence / cadence / enable the feed (`gpsConfig`) | **admin** | **server (admin password)** | Same gate as `setConfig`. |
| Test the provider connection (`gpsTestConn`) | **admin** | **server (admin password)** | Proves the token works; never returns it. |
| See the GPSWOX token / any secret | **nobody** (server-only) | n/a | Never in a payload, never echoed by `gpsHealth`. |

### 3.3 Data gates — explicit decisions
- **Position is NOT pricing or customer-PII per se** — but it is **derived location intelligence about a customer.** A unit's lat/lng is JacRentals' own asset location; a unit **on rent** sits at a **customer's jobsite**, so its coordinates effectively reveal *where that customer is operating* (and, by extension, that customer's project/competitive footprint). **Decision (conservative):** raw on-rent coordinates are a **money-tier+** (Office+) staff-internal datum; staff below money tier see a coarsened state ("On site" / "Strayed") not exact coords. Never exposed to any customer-facing surface, never written to anything Pages-served. → Open Q §11.6.
- **Driver-location privacy.** A live driver position is *employee location tracking* and is legally/ethically sensitive (consent, off-shift tracking). **Decision (conservative for v1):** the driver-cab map shows **the driver their own** position only; the office Tracking board tracks **units/assets** and infers the hauling truck from the **unit it carries**, not from a person. We build **no "track my employees" panel**, and a unit's position is **not** retained as an employee movement history. → Open Q §11.5.
- **No money gate touched, none loosened.** GPS adds no pricing, margin, `bottomDollar`, or invoice surface. Nothing here can read or expose a pricing floor. Geofence *editing* and feed *enable/disable* are **Admin-tier money-equivalent writes** (they change a server-side integration) and reuse the admin-password gate verbatim. If a later phase ever surfaces position **on the customer card** or pipes it into a customer-facing portal, that is a **new gate decision** — flagged, not assumed (Open Q §11.6).
- **Customer isolation.** Stray alerts and positions are keyed by `unitId`. The backend must resolve "is this unit on rent, and to whom" only to decide the **fence center** — it must **never** join one customer's jobsite coordinates into another customer's view, and `gpsSnapshot` returns position **per unit**, never grouped or labelled by customer to a customer. GPS data is **never** rendered on the customer card in v1.
- **Public-repo constraint (hard).** No real GPSWOX device id, token, or real coordinate ever enters the repo or seed `data.js` (Pages serves it publicly). Existing demo `gpsType:'GPSWOX'` values are fictional and stay so; `gpsDeviceId` seeds, if any, are obviously fake.

---

## 4. Data Model

Schema-less Sheets + `data.js` shapes. **All new fields are additive** — old records simply lack them and render as "No GPS" / unknown, exactly as today.

### 4.1 Unit — new live-telematics fields (additive to the existing unit record)

| Field | Type | Source | Notes |
|---|---|---|---|
| `gpsType` | string | entry (existing) | e.g. "GPSWOX". Already present. The provider/device label. |
| `gpsPlacement` | string | entry (existing) | "Under dash". Already present. |
| `gpsDeviceId` | string | entry (NEW) | The provider-side device/unit id used to map GPSWOX → our `unitId`. The join key for the feed. Blank = unmapped = treated as "No GPS". |
| `gpsStatus` | enum (existing) | **server-set (NEW behavior)** | Becomes feed-driven: `Reporting` / `Verify` / `Not Reporting`. Manual override still allowed (see §7.2) but the poll re-derives it. |
| `gpsLat` `gpsLng` | number | server-set (NEW) | Last-known position. Null until first fix. |
| `gpsTs` | ISO string | server-set (NEW) | Timestamp of last fix (UTC). Drives the staleness → status derivation. |
| `gpsSpeed` | number (mph) | server-set (NEW, optional) | Last reported speed; feeds "moving?" + speeding events. |
| `gpsHeading` | number (deg) | server-set (NEW, optional) | For an oriented map arrow. |
| `gpsStray` | bool / `{at, fence}` | server-set (NEW) | True when last fix is outside its expected fence (yard, or the on-rent jobsite fence). Drives the new stray flag. |
| `gpsOverride` | `{status, until, by}` | entry (NEW, optional) | Manual status pin (e.g. "device pulled for repair, ignore offline") so the feed doesn't fight a known-good human call. |

> **Why store position on the unit, not a separate ledger?** The app's whole model is one flat record per entity with derived views. Last-known position is a *property of the unit* (like `currentHours`). A historical breadcrumb trail is **out of scope for v1** (Open Q §11.4) — if added later it's a separate `unitTelemetry` ledger tab, never inlined.

### 4.2 Geofence config (NEW — lives in `settings`, not per-unit)
Stored under `config.settings.gps` (admin-set via Settings → Integrations / a Geofence sub-panel), synced through the existing `setConfig` backend action (app.js:2646).

```js
settings.gps = {
  enabled: false,                 // master telematics toggle
  provider: 'gpswox',             // device platform id (label only; token is server-side)
  pollMinutes: 15,                // feed cadence (see §5.3)
  staleMinutes: 60,               // no fix older than this → gpsStatus = 'Not Reporting'
  verifyMinutes: 30,              // stale beyond this but < staleMinutes → 'Verify'
  yardFence: { lat: 30.2366, lng: -93.3774, radiusM: 250 },  // default = YARD_CENTER
  jobsiteFenceM: 500,             // radius around an on-rent unit's delivery pin
  strayOnRent: 'jobsite',         // 'jobsite' | 'off' — fence on-rent units to their jobsite, vs only yard
}
```

- **No secret in here.** The GPSWOX API token is referenced by NAME only and lives in GAS Script Properties (server-side). The repo is public via Pages (HARD CONSTRAINT) — `settings.gps` carries only the platform id and tuning knobs.
- `yardFence` defaults to `YARD_CENTER` so it works before anyone configures it.

### 4.3 Stray / event records (NEW — additive Sheet tab `gpsEvents`, optional for v1)
Only if we surface a stray **log** (Open Q §11.3). Shape:

```js
{ eventId, unitId, kind: 'stray'|'return'|'offline'|'online'|'speeding'|'harsh',
  at: ISO, lat, lng, fence: 'yard'|'jobsite', acknowledged: false, ackBy: '' }
```

For v1 MVP, stray state can live purely on the unit (`gpsStray`) with no ledger; the ledger is Phase 3.

### 4.4 Relationships
- `unit.gpsDeviceId` → GPSWOX device (1:1). The **only** join the backend needs.
- `unit.gpsStray` / jobsite fence ← derived from the unit's active rental's delivery pin (`maps-location` owns the transport/site pin; GPS reads it).
- Driving Score ← aggregated per-driver telematics events; since there is **one driver** (dispatch-map locked decision: "Single driver"), v1 scores the fleet's transport events as "the driver's", not per-person.

### 4.5 Migration concerns
- Existing units have `gpsStatus` set **manually** in seed/live data. First poll will **overwrite** it from the feed. Before flipping `enabled:true`, run a one-time reconcile so a unit currently `Reporting` by hand but with no `gpsDeviceId` doesn't suddenly read `Not Reporting`. **Rule:** a unit with blank `gpsDeviceId` keeps its manual status (treated as unmanaged), and renders the existing "No GPS" / manual pill — the feed only governs **mapped** devices. → Open Q §11.2.
- No destructive migration; all new fields are additive and null-safe.

---

## 5. Backend / Integration Contract

### 5.1 The external provider — GPSWOX
GPSWOX exposes a REST API (token auth) and webhooks. Two integration shapes are possible; the spec proposes **server-side polling** for v1 (simplest, no public webhook endpoint to secure on a Pages-fronted app):

- **Poll** (proposed v1): a GAS time-driven trigger calls GPSWOX every `pollMinutes`, pulls all device positions, maps `deviceId → unitId`, derives status/stray, writes back to the units tab. The front-end then reads units as it already does.
- **Webhook** (Phase 3 option): GPSWOX pushes events to a GAS web-app URL on movement/geofence. Lower latency, but needs a shared-secret-verified public endpoint. → Open Q §11.7.

### 5.2 New additive backend actions (on the single `backendCall` entry point)
Backend `Code.gs` is gitignored; we **describe the contract**, we do not assume we can read it. All actions are additive — they extend the existing `action`-switch.

| Action | Direction | Request payload | Response | Auth | Notes |
|---|---|---|---|---|---|
| `gpsPoll` | (internal, time-trigger) | — | writes units | server-only | The scheduled job. Not called from the client. Pulls GPSWOX, derives, persists. |
| `gpsSnapshot` | client → server | `{ password, since?: ISO, tier?: string }` | `{ ok, units:[{unitId, status, ts, stray, lat?, lng?, speed?}], polledAt }` | session password (`backendPassword`) | The front-end's read. Returns position/status, **NEVER the GPSWOX token**. `lat/lng/speed` are **field-trimmed server-side for on-rent units below money tier** (status + stray only) — the gate is enforced on the server, not by hiding columns (§3.2). `since` enables delta fetch. |
| `gpsConfig` | client → server | `{ password, gps:{…} }` | `{ ok }` | **admin password** | Persist the `settings.gps` block (fence, cadence, enable). **Reconcile (Open Q §11.14):** prefer **folding into the existing `setConfig` action** (it already round-trips the whole `settings` object under the admin-pw gate, app.js:13920/3888) so there is ONE config writer and ONE gate — `gpsConfig` is only a distinct action if the geofence editor needs a narrower partial write. Either way the gate is the **admin password**, identical to `setConfig`. |
| `gpsHealth` | client → server | `{}` | `{ ok, enabled, lastPollAt, deviceCount, mappedCount, lastError }` | session password | Powers the Integrations health panel. **No secret** in the response. |
| `gpsTestConn` | client → server | `{ password }` | `{ ok, reachable, deviceCount }` | admin password | "Test connection" button — proves the server-side token works without ever returning it. |
| `gpsAckStray` | client → server | `{ unitId, eventId? }` | `{ ok }` | session password (manager-tier UI-gated) | Acknowledge a stray so it stops nagging. |

> **Token handling.** The GPSWOX token is stored in GAS Script Properties (named secret, e.g. `GPSWOX_TOKEN`), set out-of-band by Jac via `clasp`/the Apps Script console — **never** in the repo, never in any payload, never echoed by `gpsHealth`/`gpsTestConn`. Matches the existing Stripe/maps-key pattern (`backendCall('mapsKey')` returns the key only because Maps keys are referrer-locked and meant to be public; GPSWOX tokens are NOT and stay server-side).

#### 5.2.1 Concrete payload shapes

`gpsSnapshot` response (the normalized, provider-agnostic shape the front-end consumes):
```jsonc
{ "ok": true, "polledAt": "2026-06-28T14:32:00Z",
  "units": [
    { "unitId": "U004", "status": "Reporting", "ts": "2026-06-28T14:29:11Z",
      "lat": 30.2401, "lng": -93.3702, "speed": 0, "stray": false },
    { "unitId": "U011", "status": "Not Reporting", "ts": "2026-06-25T08:02:00Z" }   // stale → no fresh lat/lng promised
  ] }
```
For a caller below money tier, an **on-rent** unit's row omits `lat/lng/speed` and carries `"site": "on-site" | "strayed"` instead (server-trimmed, §3.2).

`gpsHealth` response (powers the Integrations panel — **secret-free by construction**):
```jsonc
{ "ok": true, "enabled": true, "lastPollAt": "2026-06-28T14:32:00Z",
  "deviceCount": 14, "mappedCount": 12, "lastError": null }   // lastError is a STRING reason, never a stack/token
```

GPSWOX adapter (server-side only — the **only** place provider specifics live; isolates the swap, §10/Open Q §11.12). The GAS `gpsPoll` job calls GPSWOX's device-list/position endpoint with the bearer token from Script Properties, then maps each device → our `unitId` via `gpsDeviceId`:
```jsonc
// GPSWOX device object (illustrative — exact fields confirmed at build, Open Q §11.9):
{ "id": 8821, "name": "Excavator-04", "lat": 30.2401, "lng": -93.3702,
  "speed": 0, "course": 270, "time": "2026-06-28 14:29:11", "online": "online" }
// → normalized: find unit where gpsDeviceId === String(device.id); write gpsLat/gpsLng/gpsTs/gpsSpeed/gpsHeading; derive gpsStatus (§7.1) & gpsStray (§7.3).
```

### 5.3 Cadence & failure handling
- **Cadence:** `pollMinutes` default 15. Heavy equipment moves rarely; 15 min is plenty and keeps GPSWOX API usage + Sheet writes low. (A truck mid-run could warrant tighter polling — Open Q §11.8.)
- **Status derivation** (server, on each poll): `now - gpsTs <= verifyMinutes` → `Reporting`; `> verifyMinutes && <= staleMinutes` → `Verify`; `> staleMinutes` → `Not Reporting`. A `gpsOverride` still in its `until` window wins over the derived value.
- **Stray derivation** (server): if `strayOnRent === 'jobsite'` and the unit has an active rental with a delivery pin → fence = that pin + `jobsiteFenceM`; else fence = `yardFence`. Position outside fence → `gpsStray = {at, fence}`; back inside → clear + (Phase 3) write a `return` event.
- **Provider down / token bad / rate-limited:** the `gpsPoll` job **does NOT overwrite** `gpsStatus`/position on a failed fetch — a provider outage must not flip the whole fleet to `Not Reporting` (that would be a false fleet-wide theft/offline storm). Instead it sets `gpsHealth.lastError` (a human-readable reason string, never a token/stack), leaves last-known data intact, and the next successful poll heals it. On HTTP 429 / 5xx, back off (skip this cycle, retry next `pollMinutes`); never tight-loop GPSWOX.
- **A device goes silent (vs. provider down):** this is the **per-unit** case the status derivation handles — `now - gpsTs > staleMinutes` → that one unit flips to `Not Reporting`. Distinguish from provider-down (fleet-wide fetch failure) so one machine losing signal reads correctly while a GPSWOX outage doesn't.
- **Front-end never crashes a map mount** on a missing/late feed (mirror the maps loader's graceful offline fallback, app.js:1421): pins fall back to last-known + a "stale" marker, the Tracking board shows the degraded banner, the dispatch truck falls back to last-done-stop.
- **Offline (no `backendPassword`):** the app runs demo/seed mode; `gpsSnapshot` is simply not called and units render their seeded `gpsStatus` — identical to today.

---

## 6. UX / UI — yard data-plate language

All new UI runs through the `jactec-ui` skill in the yard data-plate language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), ONE safety-orange accent (`--accent #ff7a1a`) for the "live/now" beat, the hi-vis hazard stripe as the single signature (stray/danger uses the **red** stripe variant), Saira Condensed stamped labels (uppercase, ~2px tracking), corner rivets, and the subtle leather-tan ranch seasoning mostly in copy ("Last seen", "Strayed off the range", "Round up"). Every pill/flag/button/field is built via a §5 builder with a `data-r` stamp; zero R0 flash-lint violations; tokens only (no hardcoded hex).

### 6.1 Unit card — GPS section upgrade (app.js:5873)
Today: pill + two text fields. Add, **only when a device is mapped + reporting**:

- A **stamped "LAST SEEN"** kv: relative time (`fmtShortDate` + clock) + a tiny map thumbnail OR a "View on map" link that pans the existing map. Rivet-cornered mini steel plate.
- The status pill stays exactly as-is (`statusPill('gpsStatus', …)`) — now **feed-driven**, so its color is finally honest. `gpsDeviceId` becomes a new `efld` text field ("Device ID").
- A **stray banner** (red hazard-stripe strip, R-built) inside the section when `gpsStray`: "STRAYED — last seen 1.4 mi from yard · 9:12a" with an **Acknowledge** ignition button (`gpsAckStray`, manager-tier gated).
- Empty/loading/error: no device → existing `badge('No GPS')`; feed off → "Tracking off" gray badge; stale → "Last seen 3d ago" muted with a Verify/Not-Reporting pill (already the flag).

### 6.2 NEW: Tracking board (fleet map) — manager/admin
A new **popup window** (`board`-style or its own `kind`) showing the whole fleet on one Google Map, reusing `loadGoogleMaps`/`YARD_CENTER`/the `_dispMap` mount pattern:

- **Map pins** per mapped unit, colored by `gpsStatus` flag color (green/yellow/red) — the dot you trust. Click a pin → focus + a stamped data-plate callout (unit name, last-seen, on-rent customer if any, stray state) with a link into the unit card.
- A right-edge **roster rail** (mirrors the dispatch `.disprail` pattern): "Reporting · Verify · Offline · Strayed" stamped section heads; offline + strayed pinned to top (action-needed first, matching the flag-severity convention).
- **Yard fence** drawn as a translucent orange circle at `YARD_CENTER`/`yardFence`; on-rent jobsite fences as faint tan circles. Saddle-stitch tan dashed boundary for the fence ring is the ranch-seasoning touch.
- States: empty (no mapped devices) → a stamped "No tracked units yet — map a device ID on a unit." Loading → skeleton plate. Feed error → a red hazard-stripe banner "Telematics feed unreachable — showing last-known positions (Nm old)".
- **NEW WINDOW_CATALOG entry required** (`ci/check-window-catalog.mjs` gate): e.g. `{ kind:'tracking', label:'Fleet tracking', tag:'Yard · GPS', sample: () => ({}) }`. Its open trigger + any new buttons need `data-r` stamps and a `gen-rule-usage` regen.

### 6.3 Dispatch map — swap the truck seam (app.js:8114)
Replace `dispatchTruckPos`'s body so that, **when the feed is live**, the driver marker uses the real last-known position of the unit being hauled (or a designated truck device), falling back to the current last-done-stop logic when no fix exists. This is the literal "swapped for live telematics" the code comment promises — additive, single-function, graceful fallback. A small "live" orange pulse vs. a gray "estimated" state tells the dispatcher which they're looking at.

### 6.4 Driver cab (dispatch-map Phase 2 consumer)
When the pending driver-cab ships, its "you-are-here → next stop" map reads the live position; the NOW-bar can show real drive progress. GPS/Tracking provides the position; the cab UI is owned by `rentals-dispatch`.

### 6.5 Settings → Integrations panel (build the stub, app.js:3415)
A proper panel body (currently note-only):

- **Telematics card**: provider label (GPSWOX), a master **enable** ignition toggle, `pollMinutes`/`staleMinutes`/`verifyMinutes` numeric stamps, **Test connection** button (`gpsTestConn` → green "Reachable · N devices" / red error), and a health line from `gpsHealth` ("Last poll 6m ago · 12/14 mapped"). **Never shows the token** — only status.
- **Geofence sub-card**: a mini map to drop/size the yard fence + the jobsite-fence radius + `strayOnRent` toggle. Admin-tier gated; persists via `gpsConfig`.
- All stamped, rivets, hazard-stripe header. Each control `data-r`-stamped; panel is inside the existing `settings` window (no new WINDOW_CATALOG entry needed unless the geofence editor is a separate popup → then it is).

### 6.6 Driving Score ring (app.js:7118)
The third Driver ring fills from the feed (§7.4). On hover, `KPI_HELP['Driving Score']` gets a real formula description replacing "placeholder until that's connected". Ring renders gray/empty until the feed has enough events.

### 6.7 Mobile reflow
The Tracking board map is full-bleed on phone with the roster as a **bottom sheet** (per `jactec-ui` mobile sub-capability); fence editing is desktop/tablet-first. The unit-card stray banner stacks above the fold. Respect reduced-motion (no pulsing pin) and safe-area/dvh sizing.

---

## 7. Business Rules / Derivations / Money

No money in this area — but precise derivations:

### 7.1 Status derivation (the core rule)
Server, per poll, per **mapped** unit (blank `gpsDeviceId` = skip, keep manual status):
```
age = now - gpsTs
override active?           → gpsStatus = override.status
age <= verifyMinutes (30)  → 'Reporting'   (green)
age <= staleMinutes  (60)  → 'Verify'       (yellow)  // intermittent — check it
else                       → 'Not Reporting'(red)     // dark
```
This makes `gps-offline` (red flag) and `gps-verify` (yellow flag) **truthful** with **zero flag-code changes** — they already read `gpsStatus`.

### 7.2 Manual override precedence
`gpsOverride.status` (within `until`) beats the derived value, so "device pulled for service, ignore" doesn't fire a false red. Surfaced on the unit card as a small "manual" tag on the pill.

### 7.3 Stray rule
```
fence = (strayOnRent==='jobsite' && unit.activeRental.deliveryPin)
          ? circle(deliveryPin, jobsiteFenceM)
          : circle(yardFence, yardFence.radiusM)
distance(lastFix, fence.center) > fence.radius  → gpsStray = {at: now, fence}
```
- A machine **in the yard, not on rent** that leaves the yard fence → stray (theft signal).
- A machine **on rent** that leaves its jobsite fence → stray (unauthorized move). Re-entering clears it.
- Hysteresis: require N consecutive out-of-fence fixes (default 2) before firing, so a GPS jitter on the fence edge doesn't spam. → Open Q §11.1.

### 7.4 Driving Score formula (NEW)
The third Driver ring. GPSWOX (or similar) reports harsh-braking / harsh-accel / speeding events. Proposed:
```
score = 100 - clamp( w_speed*speedingEvents + w_harsh*harshEvents , 0, 100 )   // per rolling 30 days
```
- Single-driver model (dispatch lock): fleet transport events ≈ the driver's. Per-driver scoring waits on a driver-assignment field (out of scope; owned by `roles-team` / dispatch).
- If the feed has no event stream (position-only device), Driving Score stays `null`/gray rather than faking a number. → Open Q §11.9 (exact weights + which events the device actually emits).

### 7.5 Edge cases
- Unit sold/inactive (`fleetStatus`) but device still mapped → exclude from stray + from the "offline roster" nag (it's not in service). Mirror the KPI eligibility skip-set (`Inactive/Sold/For Sale`, app.js:7108).
- Two units, one device id (data error) → backend logs `lastError`, last-writer-wins, surfaces in health.
- Clock skew between GPSWOX and GAS → always derive age server-side from the provider timestamp, normalized to UTC.

---

## 8. Phasing & Milestones

**Phase 1 — Status truth + position dots (MVP).** *In scope:* `gpsDeviceId` field; `gpsPoll`/`gpsSnapshot`/`gpsConfig`/`gpsHealth`/`gpsTestConn` actions; server status derivation (§7.1) writing `gpsStatus`+`gpsLat/Lng/Ts`; unit-card "Last seen" + honest pill; swap `dispatchTruckPos` (§6.3); Settings → Integrations telematics card with Test-connection + health. *Out of scope:* geofencing, stray alerts, Driving Score, fleet board, breadcrumb history, webhooks. **Outcome:** the red GPS flag is finally real, and you can see where a machine last reported.

**Phase 2 — Tracking board + geofence + stray alerts.** Yard + jobsite fences, `gpsStray` derivation (§7.3), the stray flag + unit-card banner + `gpsAckStray`, the manager Tracking board (§6.2, new WINDOW_CATALOG entry), the geofence editor sub-panel.

**Phase 3 — Driving Score + event ledger + (optional) webhooks.** Populate the Driver ring (§7.4), the `gpsEvents` ledger + stray log, optional GPSWOX webhook endpoint for near-real-time (Open Q §11.7), breadcrumb history (Open Q §11.4).

**Explicitly out of v1 entirely:** customer-facing "track your rental" link; per-driver scoring; predictive ETA; idle/fuel/engine-hours telematics ingestion (engine hours stay manual via `currentHours` unless Jac wants the cross-over — Open Q §11.10).

---

## 9. Acceptance Criteria

- [ ] A unit with a valid `gpsDeviceId` and a fresh fix renders `gpsStatus: Reporting` (green) **set by the feed**, plus a "Last seen" stamp — with no human touching the field.
- [ ] A device silent past `staleMinutes` flips the unit to `Not Reporting` automatically; the existing `gps-offline` red flag fires and colors the unit pill — **no flag-code change**.
- [ ] A unit with blank `gpsDeviceId` is untouched by the feed and renders exactly as today.
- [ ] `gpsSnapshot` / `gpsHealth` / `gpsTestConn` responses **contain no GPSWOX token** and no secret-shaped string (assert in a logic test that greps the serialized response).
- [ ] `gpsConfig` (or the folded `setConfig`) and `gpsTestConn` **reject** a session-only password and require the **admin** password; `gpsSnapshot` requires (only) a valid session password and rejects an empty/wrong one. (Gate test — both the accept and the reject path.)
- [ ] A **sub-money-tier** caller's `gpsSnapshot` for an **on-rent** unit returns **no exact `lat/lng`** (status + `site` only); a money+ caller gets coords. (Field-trim gate test, per the §11.15 decision.)
- [ ] A simulated provider-fetch failure leaves every unit's `gpsStatus`/position **unchanged** (no fleet-wide flip to `Not Reporting`) and only sets `gpsHealth.lastError`. (Resilience test.)
- [ ] Settings → Integrations shows live health ("Last poll …") and a working Test-connection without revealing the secret.
- [ ] `dispatchTruckPos` uses live position when present, falls back to last-done-stop when not — the dispatch map never blanks on a missing feed.
- [ ] (Phase 2) A machine moved outside its fence sets `gpsStray`, surfaces the red stray banner, and Acknowledge clears the nag.
- [ ] (Phase 3) Driving Score ring shows a real number; `KPI_HELP` text updated.
- **CI gates:** `node ci/smoke.mjs` + `node ci/logic-test.mjs` pass (add logic tests for §7.1 derivation + the no-token assertion + the admin-pw gate). New Tracking popup ⇒ **`ci/check-window-catalog.mjs`** updated. New buttons/pills/banner ⇒ **`gen-rule-usage`** regenerated (drop `--check`). New chapter banner (if a GPS chapter is added to app.js) ⇒ **`tools/gen-code-map.mjs`** regenerated. Cache-bust `?v=` bumped on deploy. Port 8000→9147 swap before running gates.

---

## 10. Risks & Edge Cases

- **External dependency reliability.** GPSWOX downtime/rate-limits/token expiry must degrade gracefully (last-known + health badge), never crash a map mount or block the app. *(Maps loader already models this.)*
- **False stray storms.** GPS jitter on a fence edge spams alerts → require N consecutive breaches + hysteresis (§7.3, Open Q §11.1).
- **Status fights.** Feed overwriting a deliberate manual status → `gpsOverride` precedence + the blank-device "unmanaged" rule (§4.5, §7.2).
- **Sheet write volume.** Polling all units every 15 min writes the units tab repeatedly → only write changed rows; consider a dedicated lightweight `gpsState` tab if unit-row churn fights other writers (Open Q §11.11).
- **Public repo / Pages.** A leaked token = live fleet tracking exposure. Token stays server-side, referenced by name only; `gpsHealth`/`gpsTestConn` are designed to prove reachability without echoing the secret. **No real coordinates or device ids in the repo/seed** beyond the existing fictional demo values.
- **Employee-location sensitivity.** Real-time driver tracking is people-tracking; v1 stays asset-centric (§3.2, Open Q §11.5).
- **Customer jobsite exposure.** On-rent coordinates reveal a customer's operating location — keep internal, never customer-facing (§3.2, Open Q §11.6).
- **Multi-device / offline.** Demo mode has no feed and must behave exactly as today; the Tracking board must no-op cleanly with zero mapped devices.
- **Provider lock-in.** Hard-coding GPSWOX specifics in the contract makes a swap painful → keep `gpsSnapshot`'s normalized shape provider-agnostic; only the server adapter knows GPSWOX (Open Q §11.12).

---

## 11. Open Questions (for Jac)

> **Resolved 2026-06-29:** §11.5/11.13 → D1 (track trucks + drivers; trucks are first-class GPS assets) · §11.6/11.15 → D2 (coords open to all staff) · §11.10 → D3 (telematics auto-updates hours + manual override) · §11.16 → D4 (build comms SMS before GPS stray alerts). Adopted: §11.1/2/3/4/7/11/12/14. **§11.9** Driving Score is now **per-driver** (multi-driver). See the Decisions block up top.

1. **Stray hysteresis / fence radius.** How many consecutive out-of-fence fixes before we cry "stray," and what default yard radius (250 m?) and jobsite radius (500 m?)? Tighter = faster theft signal but more false alarms on big jobsites.
2. **Manual-status reconcile at go-live.** When the feed turns on, mapped units get feed-driven status. Confirm the rule: *blank `gpsDeviceId` = feed ignores it, keeps manual.* Do you want a one-time "map devices" wizard, or hand-enter `gpsDeviceId` on each unit card?
3. **Stray event LEDGER vs. just unit state.** v1 MVP can carry stray purely on the unit (`gpsStray`). Do you want a persistent **stray log** (who/what/when, acknowledged-by) in a `gpsEvents` tab from the start, or add it in Phase 3?
4. **Breadcrumb history.** Store a position trail (a moving dotted track of where a machine has been) or only ever last-known? History = a separate ledger + storage cost; last-known is far simpler.
5. **Driver-location privacy.** v1 is **asset-centric** (track units, infer the truck from its unit). Confirm we do NOT build a "see the driver's live location" panel for the office — only the driver sees their own position. Acceptable for now?
6. **Customer jobsite coordinates.** A unit on rent sits at a customer's site; its coordinates reveal where that customer operates. Confirm: internal-only, never on any customer-facing surface, never on the customer card. (And: should Office even see exact jobsite coords, or just "on-site / strayed"?)
7. **Poll vs. webhook for v1.** Server-side **polling** (15 min, simplest, no public endpoint) vs. GPSWOX **webhooks** (near-real-time but needs a secured public GAS endpoint). I lean poll for v1, webhook as Phase 3. Agree?
8. **Poll cadence — fixed or adaptive?** 15 min fleet-wide is cheap. Do you want **tighter polling for a unit on an active dispatch run** (e.g. 2–3 min while a leg is in progress) so the dispatch truck moves smoothly, or is 15 min fine everywhere?
9. **Driving Score — what does the device actually emit?** The formula needs real event types (harsh brake/accel, speeding, idle). Does Jac's GPSWOX plan report driving events, or **position only**? If position-only, Driving Score stays null/gray and we may derive a crude "speeding vs. road limit" score (needs a speed-limit source) — or we cut the ring. Which?
10. **Engine-hours crossover.** Some telematics report engine hours. Should the feed **auto-update `currentHours`** (today hand-entered on the unit card), or keep hours manual to avoid fighting inspection/service math? (Touches `units-fleet` + `maintenance-shop`.)
11. **Write target.** Write live position back onto the **units** tab (simplest, one source of truth) or a dedicated lightweight **`gpsState`** tab to avoid churning unit rows against other writers? Trade-off: simplicity vs. write contention.
12. **Provider abstraction.** Keep the `gpsSnapshot` payload provider-agnostic (so a future swap off GPSWOX is a server-only change), even though GPSWOX is the only provider today? (I recommend yes — small cost now, big flexibility later.)
13. **Who sees the Tracking board?** Manager/Admin only (asset-protection tool), or also Office/Sales (they ask "where's that machine" too)? And should Driver see only their run, or the whole fleet?
14. **Config action: fold into `setConfig` or a new `gpsConfig`?** `setConfig` already round-trips the whole `settings` block under the admin-pw gate (one writer, one gate). Folding `settings.gps` into it = no new gate to get wrong; a separate `gpsConfig` = a narrower partial write for the geofence editor but a second admin-gated surface to audit. I lean **fold into `setConfig`** unless the geofence editor genuinely needs an isolated partial save. Agree?
15. **Coarsening on-rent coords for sub-money-tier staff — server-trim or just don't ship to staff at all?** §3.2 says a mechanic/driver sees "on-site / strayed" but not a customer's exact jobsite lat/lng. Do you want the server to actively **field-trim** `gpsSnapshot` rows by tier (more code, stronger guarantee), or simpler: **staff below money tier just don't get position at all** (status pill only), and exact coords are a money+/Tracking-board thing? The trim is the conservative, leak-proof choice but costs a tier check in the read path.
16. **Stray notification urgency vs. comms maturity.** `comms-notifications` has **no server-side outbound send** yet (only an `sms:` deep-link). A stray = possible theft, the most time-urgent signal in this area. Park stray alerts on the in-app stream until comms ships server send, or does theft justify fast-tracking a minimal server SMS just for strays (a real-money decision: a false-positive 2am text is costly to trust)?

---

## 12. Dependencies & Sequencing

**Must land first / build on:**
- `maps-location` — the Google Maps loader, `YARD_CENTER`, mount pattern, and the **delivery/jobsite pin** that the jobsite fence reads. **Hard dependency** for any position rendering + stray fencing.
- `units-fleet` — owns the unit record + the GPS section + `gpsStatus` registry + the `gps-offline`/`gps-verify` flags this area makes truthful. The new fields are additive to its spine. (units-fleet §"Live GPS / telematics… → `gps-tracking`" explicitly hands this off; its `unitTelemetry` seam note matches §4.1 here.)
- `backend-data` — the `backendCall` entry point + `setConfig` admin-pw gate + GAS Script Properties for the token. All new actions are additive here.
- `rentals-dispatch` — owns `dispatchTruckPos` (the seam we swap) and the pending **driver cab** (Phase 2 consumer of live position). Coordinate so the swap doesn't collide with dispatch Phase 2 work.

**Feeds / unblocks (downstream):**
- `financials-kpi` — the **Driving Score** ring (Driver) and any future "fleet uptime / location" KPI depend on this feed; today they're `null` placeholders.
- `rentals-dispatch` Phase 2 driver cab — a smoother, real truck marker + NOW-bar progress.
- `roles-team` — per-driver scoring would need a driver-assignment field there (out of v1 scope).

**Sequencing recommendation:** Phase 1 (status truth + position) can ship as soon as `maps-location` is stable and Jac sets the GPSWOX token server-side. Geofencing/stray (Phase 2) wants the jobsite delivery pin solid in `maps-location`. Driving Score (Phase 3) is gated on the Open-Q §11.9 answer about what the device actually emits.
