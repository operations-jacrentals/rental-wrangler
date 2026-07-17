# Backend snippet — `captureByScan` (+ login device-token mint, revoke)

**Feature:** QR decal → scan-to-log video (spec/plan 2026-07-16).
**Deploy:** via `/clasp` (service-account push) → **Jac editor-deploys last.** Additive
only — no existing handler changes behavior. Code.gs is gitignored; this is the
reference contract + implementation to paste in.

> **Security invariants — do not weaken.**
> 1. **Write-only / no-PII.** No response from any handler here returns a customer
>    name, phone, address, rental detail, or pricing. Only: `unitName` (equipment),
>    the resolved slot, or a block reason built from unit id/name + status.
> 2. **Token-scope isolation.** A `scanDeviceToken` authorizes **only** `captureByScan`.
>    The main router MUST reject it for every other action. It is NOT a session token
>    and must never be treated as `backendPassword`/`sessionToken` for other calls.

## Registry: `ScanDevices` sheet

| col | meaning |
|---|---|
| `token` | random opaque id (e.g. 32 hex) — the device credential |
| `mintedBy` | operator name from the login that minted it |
| `mintedAt` | ISO timestamp |
| `lastSeen` | ISO timestamp, updated on each accepted capture |
| `revoked` | `TRUE`/`FALSE` |

## 1. `captureByScan`

**Request** (POST body, `text/plain`, like every `backendCall`):
```
{ action:'captureByScan',
  unitId,                       // immutable unit record id from #u=<unitId>
  scanToken?,                   // lite mode: the device credential (no session)
  sessionToken?/password?,      // in-app mode: the normal session cred backendCall attaches
  mode?,                        // 'peek' → resolve only, no upload; else record+file
  dataUrl?, name? }             // capture payload: base64 data-URL video + a file name
                                //   ('scan_<unitId>') — the SAME { dataUrl, name } shape the app's
                                //   existing uploadCapture path sends (app.js uploadCaptureMedia)
```

**Auth:** accept if EITHER (a) `scanToken` matches a non-revoked `ScanDevices` row,
OR (b) a valid session cred is present (existing password/role check). Else
`{ ok:false, error:'unauthorized' }`. On accept via scanToken, update `lastSeen`.

**Logic:**
1. Find the unit by `unitId` in Units. Not found → `{ ok:false, code:'unit_not_found' }`.
2. Resolve the unit's active rental + its **own** per-unit status (server mirror of the
   client's `activeRentalForUnit` / per-unit status; a unit is out on ≤1 rental).
3. Decide (see table). Ambiguous (somehow >1 active) → block, code `ambiguous`.
4. `mode:'peek'` → return `{ ok:true, unitName, action, blocked, reason }` (no upload).
5. Else if action is start/end → write the video to Drive (reuse the existing
   `uploadCapture` Drive routine) and attach it to that rental's journey log exactly
   where a manual Log Start/Log End attaches → `{ ok:true, filedAs:action, unitName }`.
6. Blocked → `{ ok:true, blocked:true, reason }` (a block is a normal outcome, not an error).

**Decision table** (unit's own `fleetStatus`/rental status; mirrors the client spec):

| unit rental status | result |
|---|---|
| `Today`, `Tomorrow` | `action='start'` (delivery video) |
| `On Rent`, `End Rent` | `action='end'` (recovery video) |
| `Reserved` (future, not Today/Tomorrow) | blocked · `"<unitName> is reserved for <startDate>, not out today — nothing to log yet."` |
| `Quote`, `Off Rent`, `Returned`, `Cancelled`, `No Show`, no active rental | blocked · `"<unitName> isn't on a rental or reservation right now — nothing to log."` |

Out-wins tiebreak: if a unit is out AND has a future reservation, the out status wins → `end`.

> **Derive `Today`/`Tomorrow` from dates — don't read them raw.** In `config.js` these are
> DERIVED display states; the STORED `rentalStatus` stays `Reserved` for a reservation whose
> start is today/tomorrow. So `activeRentalStatusForUnit_` must compute the display status from
> the rental's start date vs. today (mirror the client's `deriveDisplayStatus`), NOT return the
> raw stored `Reserved` — otherwise every about-to-go-out unit wrongly hits the "reserved for
> later" block and no Start video can ever be logged.

**Abuse bounds:** per-token + per-unit rate limit; reject `video` above a size cap.

## 2. Login mint (extend the existing auth handler)

After a successful auth, mint a `scanDeviceToken` (random), append a `ScanDevices` row
(`mintedBy` = operator name, `revoked=FALSE`), and include it in the auth response:
```
{ ok:true, role, ..., scanDeviceToken:'<hex>' }
```
The client stores it in `localStorage` (`jactec.scanDevice`). Idempotent-ish: it's fine
to mint a fresh token per login; old tokens keep working until revoked (or add a
one-per-device deduplication keyed by a client-supplied stable device nonce if you want
to cap row growth — optional).

## 3. `revokeScanDevice` (admin-gated, optional)

`{ action:'revokeScanDevice', token }` → set `revoked=TRUE` on that row. Gate behind the
same admin/manager check other privileged actions use. Lets Jac kill a lost phone.

## Reference implementation (adapt to the live Code.gs conventions)

```js
function captureByScan(p) {
  // ---- auth ----
  var viaSession = isValidSession_(p);           // existing session/password check
  var dev = null;
  if (!viaSession) {
    dev = findScanDevice_(p.scanToken);          // row lookup in ScanDevices
    if (!dev || dev.revoked) return { ok:false, error:'unauthorized' };
  }
  // ---- resolve unit + status ----
  var unit = findUnitById_(p.unitId);
  if (!unit) return { ok:false, code:'unit_not_found' };
  var st = activeRentalStatusForUnit_(unit.unitId);   // {rentalId, status, startDate} | null
  var decided = decideScanAction_(st);                 // {action:'start'|'end'} | {blocked, reason}
  if (dev) touchScanDevice_(dev.token);                // lastSeen

  var unitName = unit.name || unit.unitId;
  if (decided.blocked) return { ok:true, blocked:true, reason:decided.reason.replace('<unitName>', unitName) };
  if (p.mode === 'peek') return { ok:true, unitName:unitName, action:decided.action };

  // ---- record + file ----
  var driveUrl = uploadCaptureToDrive_(p.dataUrl, p.name);  // reuse existing uploadCapture Drive routine — payload is { dataUrl, name }
  attachRentalJourneyVideo_(st.rentalId, unit.unitId, decided.action, driveUrl); // same as manual Log Start/End
  return { ok:true, filedAs:decided.action, unitName:unitName };
}

function decideScanAction_(st) {
  if (!st) return { blocked:true, reason:"<unitName> isn't on a rental or reservation right now — nothing to log." };
  var s = st.status;
  if (s === 'On Rent' || s === 'End Rent') return { action:'end' };
  if (s === 'Today' || s === 'Tomorrow')   return { action:'start' };
  if (s === 'Reserved') return { blocked:true, reason:"<unitName> is reserved for " + (st.startDate||'a later date') + ", not out today — nothing to log yet." };
  return { blocked:true, reason:"<unitName> isn't on a rental or reservation right now — nothing to log." };
}
```

**Integration TODOs (need the live Code.gs to finalize):**
- `isValidSession_`, `findUnitById_`, `activeRentalStatusForUnit_`,
  `uploadCaptureToDrive_`, `attachRentalJourneyVideo_` map to the existing internal
  routines — wire to the real names. `attachRentalJourneyVideo_` must land the media in
  the SAME structure the manual `uploadCapture` (cap start/end) flow writes, so scanned
  and manual videos are indistinguishable downstream.
- The capture payload the frontend sends is `{ dataUrl, name }` (base64 data-URL video +
  a file name) — the SAME shape as the app's existing `uploadCapture`. `uploadCaptureToDrive_`
  must accept exactly that (not `video`/`videoName`/`videoMime`).
- Register the three actions in the main `doPost` router; ensure `scanToken` auth is
  scoped to `captureByScan` ONLY.
