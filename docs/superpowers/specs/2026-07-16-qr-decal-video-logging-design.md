# QR Decal → Scan-to-Log Video — Design Spec

- **Date:** 2026-07-16
- **Status:** Approved (design) — ready for implementation plan
- **Branch:** `claude/qr-decal-video-logging-6fj6fh`
- **Decal mockup:** artifact `dc23516a-7a70-4168-8b4f-4dd94e9c23a1`

## Summary

Print one QR decal per unit. When a phone camera scans it, the app opens, the
camera opens to video with a single tap, and the saved video is filed to that
unit's **correct** rental log automatically — Start (delivery) or End (recovery)
— with **no On Rent / End Rent choice** for the user to make. If the unit isn't
going out today and isn't out, the scan is **blocked with a plain explanation**.

The QR encodes only the unit's immutable record id, so the printed decal never
has to be reprinted when logic changes. The upload path is **write-only and
exposes no customer data**, and phones are **remembered silently at login** — so
there is no enrollment workflow to build or train.

## Goals

1. Scan a unit decal → camera → video filed to the right log, minimum taps.
2. The system infers Start vs End from the unit's live status ("knows where it goes").
3. Works on any staff phone; a decal is never invalidated by a software change.
4. No new PII surface and no separate enrollment step.

## Non-goals (YAGNI)

- No native app, no account system, no per-decal secret tokens.
- No in-app video trimming/editing, no push notifications.
- Bulk decal printing was previously out of scope but is now IN — see *Fleet QR
  Codes export* below (added at Jac's request 2026-07-16).

## The two concerns this addresses (traceability)

- **"The QR changing / not working."** A printed QR is a static image; it only
  breaks if the URL it encodes moves or the unit id stops existing. Mitigated by
  a **frozen URL scheme** carrying only the **immutable record id** (§QR scheme),
  a **human-readable unit id** printed as a fallback, and a clean "unit not found
  — re-link this decal" screen on a miss.
- **"They're not 'inside' the app at that moment."** A scan opens the browser
  cold. Mitigated by (a) **silent device-remembering** so a known phone skips the
  login, (b) **deferred-intent routing** — the scanned unit is parked at boot and
  replayed after login/data-load (same pattern as the existing `#s=` session
  restore), and (c) accepting the **one-tap floor** (browsers forbid opening a
  camera with zero user gesture).

## The QR scheme (permanent contract — freeze before printing)

```
https://app.jacrentals.com/#u=<unitId>
```

- `<unitId>` is the **immutable internal unit record id** (never a name, yard
  number, or anything a human retypes). Unit ids are **never recycled or reused**.
- Hash route (`#u=`), consistent with the app's existing hash deep-links
  (`#edit=`, `#s=`, `#migrate-units`), so it stays client-side on GitHub Pages.
- The QR carries **nothing else** — no action, no token, no rental id. All
  behavior is derived at scan time, so a behavior change never forces a reprint.
- Domain `app.jacrentals.com` is a permanent commitment (already production).

## The decal (print asset)

- **Big human-readable unit id** (e.g. `U-1042`) + family label (e.g. "CAT 305 ·
  Mini Excavator") printed above the code — the fallback if a code won't scan.
- **QR on a clean white field with a quiet zone** — the one hard print rule for
  reliable scanning; brand chrome must not intrude on the quiet zone.
- On-brand seasoning (hazard-stripe cap, one orange accent, stamped Saira
  Condensed labels, corner rivets) at the edges only.
- The decal is a physical object with a **fixed palette** (not theme-aware).
- Reference layout: the approved mockup artifact above.

## End-to-end flow

1. **Scan** → phone camera opens `https://app.jacrentals.com/#u=<unitId>`.
2. **Boot router** parks the scanned unit id, then:
   - **Remembered phone** (valid device token in `localStorage`) → straight through.
   - **Unknown/never-signed-in phone** → normal login shown once; scan intent is
     replayed after data-load.
3. **Capture screen** — a full-screen "Recording for `<unitName>` ▸ **REC**" view.
   One tap opens the native camera to video (`capture="environment"`).
4. **On save** → the client POSTs `{ unitId, deviceToken, video }` to the backend.
   The **server** resolves the unit's live status, decides Start / End / Block,
   uploads the media, and returns only a non-PII result.
5. **Confirmation** — "Filed as the **Start** video for `<unitName>`." (or End, or
   the block reason).

## Status inference rule ("the system knows where it goes")

Resolved server-side from the unit's **own** status within its active rental
(per-unit, not the rental roll-up), using the existing lifecycle
`STATUS_ORDER` (`app.js:247`) and `activeRentalForUnit(unitId)` (`app.js:6971`).
Reservations are not a separate entity — they are rentals in a pre-dispatch
status. `Today` / `Tomorrow` are the app's date-derived "imminent dispatch"
statuses.

| Unit's live status when scanned | Result |
|---|---|
| `Today` · `Tomorrow` | **Start / Delivery** video (`cap:'start'`) |
| `On Rent` · `End Rent` | **End / Recovery** video (`cap:'end'`) |
| `Reserved` (not yet `Today`/`Tomorrow`) | **Blocked** — *"`<unitName>` is reserved for `<startDate>`, not out today — nothing to log yet."* |
| `Quote` · `Off Rent` · `Returned` · `Cancelled` · `No Show` · no active rental | **Blocked** — *"`<unitName>` isn't on a rental or reservation right now — nothing to log."* |

- **Out-wins tiebreak:** if a unit is both out and has a future reservation, the
  out status wins → **End**.
- **Multiple active rentals for one unit:** business-rule impossible (a unit is
  out on at most one rental). If the data is ambiguous, **block** with a
  data-integrity message rather than guess — never silently pick.
- The chosen `rentalId` + `cap` feed the **same** logging path a manual "Log
  Start/End" uses today (`openOverlay({ kind:'capture', rentalId, cap, unitId })`,
  `app.js:18996`; popup `app.js:13160`), so scanned videos land exactly where
  manual ones do.

## Auth & security model

**Property to preserve above all:** the scan-capture path is **write-only** and
**never returns customer data**. A capture credential grants nothing except
appending a video to a unit's log.

- **Remembered-device token.** On successful login the server mints a random
  `scanDeviceToken`, stored server-side in a device registry and on the phone in
  `localStorage` (reusing the persistent `pidToken` primitive,
  `app.js:23865-23867`). Unlike the login itself (`sessionStorage`, dies with the
  tab, `app.js:21862`), this survives across sessions — so a remembered phone
  scans login-free indefinitely.
- **Authorization at upload.** `captureByScan` accepts a write if **either** a
  valid non-revoked `scanDeviceToken` **or** a live login session is present. An
  outsider with only a photo of the decal has neither → **blocked**. Missing/invalid
  token **and** no session → the app shows the normal login once (intent parked +
  replayed), which re-mints the device token.
- **Token scope isolation (hard rule).** The `scanDeviceToken` authorizes
  **only** `captureByScan`. The backend MUST reject it for any read/PII/mutation
  action. This is the isolation that makes a printed-yard credential acceptable.
- **No PII in any response.** Success returns `{ ok, filedAs, unitName }`; block
  returns `{ ok:false, reason }` built only from unit id/name + status. No
  customer name, address, rental detail, or pricing ever crosses to the phone.
- **Abuse bounds.** Per-token / per-unit rate limit; a video size cap; media is
  human-reviewed in the unit log. Worst case from a leaked token is junk video in
  one unit's log — no data exposure, no money movement, no auth escalation.
- **Revocation (free, optional to ship).** The device registry supports an admin
  **revoke** so a lost/stolen phone can be cut off.

> This section is an auth/PII gate and stays owner-reviewed (not delegated). Any
> subagent implementing the backend must preserve write-only + no-PII + token-scope
> isolation verbatim.

## Backend (additive GAS handlers)

1. **`captureByScan`** `{ unitId, deviceToken, video, name? }` →
   validate device/session → resolve status via the unit's active rental →
   decide Start / End / Block → on Start/End upload media (reuse the existing
   `uploadCapture` / Drive plumbing) and attach to the rental journey log →
   return `{ ok, filedAs, unitName }` or `{ ok:false, reason }`. **The one real
   new handler.** Additive; no existing handler changes behavior.
2. **Login extension** — mint + return a `scanDeviceToken` and record it in the
   device registry. Small addition to the existing login response.
3. **`revokeScanDevice`** `{ deviceToken }` (admin-gated) — optional.

Backend ships via `/clasp` (service-account path), additive only, go-live is
Jac's Apps Script editor deploy.

## Frontend changes (app.js)

- **Boot router:** add a `#u=<id>` branch alongside `#edit=`/`#s=`/`#migrate-units`
  (`app.js:23751`+). Park the unit id, self-clear the hash, replay after
  data-load; if logged-out, stash and replay post-login.
- **Capture-for-scan screen:** a focused full-screen REC view for the scanned
  unit (reuse the `capture` popup's `capture="environment"` video input,
  `app.js:13160` / `fileDrop` `app.js:5811`). On save, call `captureByScan` and
  show the returned confirmation or block reason.
- **Unknown-unit + block states:** clean, non-dead-end screens.
- **Device token:** persist/read via the `pidToken` localStorage primitive.
- **UI gate:** the new full-screen scan/REC/confirmation/block views run through
  `jactec-ui` and get `data-r` stamps; any new popup gets a `WINDOW_CATALOG` entry.

## Failure & edge states

| Case | Behavior |
|---|---|
| Unit id not found | "Unit not found — this decal may need re-linking." (no dead end) |
| Logged out, unknown device | Normal login once → intent replayed → capture screen |
| Reserved but not imminent | Block with the reserved-for-date message |
| No active rental | Block with the "not on a rental or reservation" message |
| Ambiguous / multiple active rentals | Block with a data-integrity message (never guess) |
| Camera permission denied | Explain + offer to attach a video from the gallery |
| Offline mid-upload | Retry/queue; the video isn't lost |
| iOS localStorage evicted (>7 idle days, not home-screened) | Falls back to one login, which re-mints the token; recommend Add-to-Home-Screen for scanning phones |

## Testing / staging review

- `ci/logic-test.mjs` — add coverage for the status→(start/end/block) decision
  across the full `STATUS_ORDER`, incl. out-wins tiebreak and the ambiguous block.
- Staging: deploy, then scan a **real generated QR** for a seeded unit end-to-end
  from a phone (remembered vs. cold), confirming the video lands in the right log
  and the block states read correctly. A red review is a HARD STOP.

## Rollout & print timing

- Jac prints next week — so build → stage → **scan a real test decal** before any
  bulk print run. Nothing prints until the flow is verified on staging.
- Freeze the `#u=<unitId>` scheme now so print artwork targets the final URL.

## Fleet QR Codes export — Company Files (added 2026-07-16)

A downloadable **"Fleet QR Codes"** artifact in **Company Files** (`DATA.companyFiles`,
entity `files`, `IDX.file` app.js:768) with a print-ready decal for **every active
unit**, so Jac prints the whole yard's decals at once.

- **Active fleet only.** On the sheet: `unit.fleetStatus` ∈ {Active, Onboard,
  Purchased, For Sale} (pending Jac confirm). Off: {Inactive, Sold}. A reactivated
  unit reappears; a sold/inactivated one drops off. (`fleetStatus` values defined in
  `config.js:86-93`; field read at app.js:6430 etc.)
- **Always current.** New or reactivated units are included automatically.

**Approach — on-demand generation.** A special always-current entry in Company Files
that, at download time, builds the sheet from live fleet data. Current *by
construction* — no stored file, no regeneration triggers, no stale-file risk.
(Company Files today holds only uploaded blobs / links; a generate-on-download entry
is new UI, `saveFileForm` app.js:19377.) A materialized-PDF alternative (backend job
rewrites on each fleet change) is heavier and rejected unless a fixed archived /
emailable file is later needed.

**Real QR generation — vendored client-side encoder (decision).** The app has NO
client-side QR encoder; its existing `kind:'qr'` overlay fetches a PNG from a
third-party API (`api.qrserver.com`, app.js:12364) — external, online-only, unfit for
permanent printable asset tags. We **vendor a small pinned MIT/ISC QR encoder** into
`vendor/` (same pattern as `d3-shape`/`plot`) and generate real, scannable codes fully
client-side — offline, in CI, self-controlled. **Shared infra:** it also produces the
real test decal for the scan-flow staging review (Phase 6). Optional adjacent cleanup
(not bundled unasked): repoint the existing share-session QR at the vendored encoder
to drop the external dependency.

**Data per decal:** immutable `unit.unitId` (→ `#u=<unitId>`; minted by `nextUnitId`,
never recycled — app.js:19870), `unit.name` + category name
(`IDX.category.get(unit.categoryId)?.name`) as the human fallback,
`categoryIconFor(categoryName)` glyph.

**Delivery:** a print-optimized layout (decals tiled per page) the browser prints /
saves as PDF — no PDF library needed initially.

## Decisions taken / open items

- **Include-rule — BUILT with the recommended split** (`FLEET_QR_STATUSES`, app.js):
  on the sheet = `fleetStatus` in Active/Onboard/Purchased/For Sale; off =
  Inactive/Sold. A one-line change if Jac wants different.
- **On-demand generation — BUILT:** the sheet builds from live fleet data at download
  time (always current, no stored file, no backend).
- Optional later: a true PDF export (vendored PDF lib) if print-to-PDF isn't enough;
  repointing the existing share-session QR at the vendored encoder to drop the
  external `api.qrserver.com` dependency.
