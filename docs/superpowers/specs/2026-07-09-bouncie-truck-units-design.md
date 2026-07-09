# Bouncie trucks → Unit records — design note

**Date:** 2026-07-09 · **Approved by:** Jac. Resolves `docs/specs/gps-tracking.md`
D1's open build note ("decide whether trucks are a new mini-entity or units
of a 'truck' type") — **trucks are units of a 'truck' type.** Keep this
simple (Jac, 2026-07-09 follow-up — a prior draft of this note over-built it).

**Depends on:** the `area/wrangler-gps` merge (landed — `gpsFetch`,
`gpsNormalize`, `gpsFleetStatus`, `gpsConfigured`, `GPS_BACKEND_URL` all now
on this branch).

## What to actually do

1. **One new category:** `name: 'Truck'`. Nothing else special about it —
   created the normal way, same as any category.
2. **Pull Bouncie's vehicle list** (`gpsFetch('/api/bouncie/vehicles')` →
   `gpsNormalize('bouncie', raw)` per vehicle: `{ imei, name, make, model }`
   is what we need).
3. **Create a unit per truck**, `categoryId` = Truck, `name`/`make`/`model`
   straight from Bouncie, `gpsProvider: 'bouncie'`, `gpsDeviceId: imei`
   (these two are pre-existing fields — every other GPS-mapped unit already
   uses them; not something new).
4. **`fleetStatus`: leave it at the normal default a new unit gets.** No
   `Inactive` trick, no hiding behind a sort/filter — trucks show up in the
   Units card like everything else. (Dropped: an earlier draft tried to keep
   trucks out of rental pickers via `fleetStatus: 'Inactive'` — not worth the
   complexity. Leave it alone.)
5. **No new fields.** Weight, serial, inspection status — just leave blank,
   same as any unit missing that data. Nothing to engineer.
6. **No new popup/wizard.** Just create the records directly — a plain
   one-shot action (script or a small `+X` trigger), not a review-table UI.

That's the whole scope.
