# Bouncie trucks → Unit records — design note

**Date:** 2026-07-09 · **Approved by:** Jac (in-session directive + one follow-up
answer). Resolves `docs/specs/gps-tracking.md` D1's open build note ("decide
whether trucks are a new mini-entity or units of a 'truck' type") — **trucks
are units of a 'truck' type.** Also unblocks the Trips card's live truck
marker (`docs/superpowers/specs/2026-07-09-trips-card-design.md` §2.6),
which needs a unit to hang a `gpsProvider`/`gpsDeviceId` off for
`gpsFleetRoster()` to resolve.

**Depends on:** the `area/wrangler-gps` merge (in progress) — needs `gpsFetch`,
`gpsNormalize`, `gpsFleetStatus`, `gpsConfigured`, `GPS_BACKEND_URL`, the GPS
toolbar's popup-overlay pattern, and `logAction`/`reindex`/`toast`, none of
which exist on this branch pre-merge.

## Source data

Bouncie vehicles arrive already normalized (`gpsNormalize('bouncie', raw)`,
app.js, shipped on `area/wrangler-gps`):
`{ imei, name, make, model, lat, lng, speed, engineOn, lastSeen, odometer,
fuelLevel, mil }`. No VIN or equipment-style serial is exposed — `imei` is
the stable, already-used join key (`unit.gpsDeviceId`).

## Category

One new category: **`name: 'Truck'`**. No rental-pricing fields populated
(`rate1Day`/`rate7Day`/`rate4Wk`/`weekend`/`msrp`/`askPrice`/`bottomDollar`
stay null/blank) — trucks are internal fleet, never rented, and this app's
convention is to leave a field genuinely unknown rather than fake a value
(matches the Driving-Score KPI's `null`-not-faked precedent, and the Trips
card cab sheet's `NO WEIGHT` fallback). Created once, reused for every truck.

## Unit fields per truck

| Field | Value | Why |
|---|---|---|
| `name` | Bouncie's normalized `name` (nickname, or "Year Make Model" fallback) | already the right display string |
| `make` / `model` | Bouncie's normalized `make`/`model` | free-text fields — no separate Makes entity exists anywhere in `config.js`/`app.js` (checked); populating the field *is* "creating the make" |
| `categoryId` | the new Truck category | groups trucks together, drives icon fallback |
| `gpsProvider` | `'bouncie'` | matches `gpsFleetRoster()`'s existing join |
| `gpsDeviceId` | the vehicle's `imei` | ditto — same field every other GPS-mapped unit uses |
| `fleetStatus` | `'Inactive'` | **verified, not assumed:** `RENTABLE_SKIP_FLEET` (app.js ~1949) already excludes `Inactive` from rental-eligibility; the default Units-card list (app.js ~5022, ~7767) hides non-`Active` fleet by default — **but** a `reveal` toggle keyed off the card's own sort field (`allFleet`/`soldInactive`, app.js ~7767) makes Inactive units fully visible to anyone, including mechanics, who switches to that sort. Work-order creation is not gated by `fleetStatus` at all. This is exactly what Jac asked for: off the rental side, still findable for service. |
| `weight` | blank | Bouncie exposes no GVWR; the cab sheet already renders `NO WEIGHT` gracefully — not a new gap |
| `serial` | blank | `imei` (in `gpsDeviceId`) is already the real identifier; duplicating it into `serial` adds nothing |

## Onboarding mechanism (new — nothing existing does this)

`gpsApplyMappings` (the existing Round-Up-Trackers bulk action) only maps a
device onto an **already-existing** unit — `IDX.unit.get(p.unitId)` fails
with `"Unit not found"` otherwise (verified by reading the function). Bouncie
trucks have no corresponding unit at all yet, so this needs new code, not an
extension of that call path.

**New action, same neighborhood as the existing GPS toolbar (Round Up
Trackers / Tracker Health):** something like a **"Pull Bouncie Trucks"**
popup or a step inside a broadened round-up flow —
1. `gpsFetch('/api/bouncie/vehicles')`, normalize each via the existing
   `gpsNormalize('bouncie', ...)`.
2. Filter out any `imei` already present as some unit's `gpsDeviceId` (any
   provider — a device shouldn't double-onboard).
3. Ensure the `Truck` category exists (create once if missing).
4. For each remaining vehicle, build a unit record per the table above and
   `DATA.units.push(u); IDX.unit.set(id, u); reindex('units', u);
   logAction(u, 'Added from Bouncie fleet pull');` (mirrors the existing
   Mr.-Wrangler unit-creation path, app.js ~12309, and the bulk-write shape
   `gpsApplyMappings` already uses).
5. Surface per-vehicle ok/skip like `gpsApplyMappings` does (reused vehicle,
   creation failure) — never a silent partial batch.
6. Backend: additive `Code.gs`/Sheets write for a new unit record — same path
   the standard "+Unit" add already uses; no new backend action needed if
   unit-creation already round-trips through the existing sync layer (verify
   at build time; add one only if it doesn't).

## Open items intentionally left for build time (not blocking)

- Exact popup shell (new dedicated popup vs. a step folded into
  `gpsRoundup`) — a UI-layout call, not a data-model one; whichever reads
  cleaner through the `jactec-ui` pass.
- `inspectionStatus` default for a freshly-pulled truck — leave blank/`—`;
  `RENTABLE_SKIP_FLEET`/`fleetStatus:'Inactive'` already keeps it out of
  rental-eligibility regardless, so this isn't load-bearing.
