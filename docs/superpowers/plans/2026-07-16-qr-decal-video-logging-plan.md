# QR Decal → Scan-to-Log Video — Implementation Plan

- **Date:** 2026-07-16
- **Spec:** `docs/superpowers/specs/2026-07-16-qr-decal-video-logging-design.md`
- **Branch / PR:** `claude/qr-decal-video-logging-6fj6fh` · #660
- **Status:** ready to build

## Architecture decisions locked while reading the code

1. **`scanDeviceToken` is NOT `pidToken`.** The in-flight `phoneIdentity` system
   (`app.js:23856`, flag OFF) mints a `pidToken` that *becomes the full credential*
   (`backendPassword = tok`, `pidAdopt` `app.js:23871`) — full PII access. Reusing
   it for scanning would give any decal-scanning phone the whole database. Our
   scan credential is a **separate token**, stored under its own localStorage key
   (`jactec.scanDevice`), that authorizes **only** `captureByScan`. We mirror the
   *shape* of `pidTokenGet/Set/Clear` (`app.js:23865-23867`), not the token.
2. **Lite mode never loads PII.** The normal login path fires `backendCall('load')`
   — the full dataset (`attemptLogin` `app.js:23830-23848`, `finishLoad`
   `app.js:23735`). A remembered scanning phone must **skip that entirely**: the
   scan capture screen is a **standalone flow** authorized by the scan token, with
   no data load, no `render()` of the app, no customer data on the device.
3. **The Start/End/Block decision is server-side** (`captureByScan`), so lite mode
   needs zero client data to decide — it just posts `{unitId, token, video}` and
   shows the returned result.
4. **Entry point is `boot()`** (`app.js:24028`) + its hash routing (~`app.js:24403`),
   ahead of the login-vs-app decision (`renderLogin` `app.js:23681`).
5. **Backend goes live LAST (Jac, 2026-07-16), so the frontend must not depend on
   it being live.** The whole scan flow rides behind a `FEATURES` flag
   (`config.js`, `flagOn()`), shipping **dormant** — it can merge and promote with
   the flag OFF and nothing in production breaks while `captureByScan` doesn't yet
   exist. Staging is exercised via a **preview response** (all states) so Jac signs
   off on the UX + decal before the backend. After Jac's `/clasp` push + editor
   deploy, flip the flag ON (config-only) and do **one real confirmation scan**
   before the print run. There is only one shared GAS backend behind staging and
   production, so an additive `captureByScan` deployed early is dormant in prod
   until the flag flips — but per Jac's call, the backend deploy stays last.

## Phase 1 — Scan boot route + three entry states (frontend)

**Files:** `app.js` (`boot()` 24028, hash block ~24403, `attemptLogin` 23812).

- Detect `#u=<unitId>` at boot; parse + self-clear the hash
  (`history.replaceState`), park `pendingScan = unitId`.
- Resolve entry state:
  - **scan token present** (`localStorage jactec.scanDevice`) → **lite capture**
    (Phase 2), no data load.
  - **live session present** (`sessionStorage jactec.pw`, `app.js:21862`) → allow
    the normal boot to finish, then open the capture screen for `pendingScan`.
  - **cold** (neither) → `renderLogin()`; on successful `attemptLogin`, mint the
    scan token (Phase 3) and replay `pendingScan` → capture screen.
- Mirror the existing park-then-replay pattern used by `#s=` session-restore
  (`app.js:23759`).

## Phase 2 — The scan capture screen (frontend)

**Files:** `app.js` (new standalone renderer), `style.css`, `WINDOW_CATALOG`
(`app.js:9547`), run through **`jactec-ui`**.

- Full-screen "Recording for `<unit>` ▸ REC" view. `<unit>` label comes from the
  `captureByScan` preflight (a `mode:'peek'` call returning **unit name only** —
  equipment, non-PII — plus the resolved action, or a block reason) so lite mode
  can show the unit and the intended slot before recording. No customer data.
- Reuse the video input primitive (`accept="video/*" capture="environment"`,
  `fileDrop` `app.js:5811`; existing capture popup `app.js:13160`).
- One tap → native camera → on save POST `captureByScan {unitId, token|session,
  video}` → render confirmation ("Filed as the Start video for `<unit>`") or the
  block reason or the unknown-unit / re-link screen.
- States: capture · uploading · filed · blocked · unit-not-found · camera-denied
  (offer gallery attach) · offline (queue/retry). All `data-r` stamped; new popup
  → `WINDOW_CATALOG` entry.

## Phase 3 — Scan-device token, client side (frontend)

**Files:** `app.js` (new `scanTokenGet/Set/Clear` near `app.js:23865`).

- On successful `attemptLogin`, if the backend returns a `scanDeviceToken`, store
  it under `jactec.scanDevice` (localStorage, durable). Independent of `pidToken`.
- Sent only on `captureByScan`. Never assigned to `backendPassword`. Never used
  for any read/mutating call.
- Cleared on explicit sign-out alongside the session.

## Phase 4 — Backend handlers (Code.gs — ships via `/clasp`)

**Write-only, PII-isolated. Owner-reviewed (not delegated).**

- **`captureByScan`** `{ unitId, token?, session?, video?, mode? }`:
  - Authorize on a valid non-revoked `scanDeviceToken` **or** a valid session.
    **Reject the scan token for every other action** (scope-isolation is the load-bearing rule).
  - Resolve the unit's active rental + its own unit-status (server mirror of
    `activeRentalForUnit` `app.js:1817` / `STATUS_ORDER` `app.js:247`).
  - Decide: `Today/Tomorrow`→start · `On Rent/End Rent`→end · else block (with the
    reserved-for-date vs. nothing message). Out-wins tiebreak; ambiguous→block.
  - `mode:'peek'` returns `{action|blockReason, unitName}` only (no upload).
    Otherwise upload via existing `uploadCapture`/Drive and attach to the rental
    journey log, then return `{ ok, filedAs, unitName }`.
  - **Never** return customer name, address, rental detail, or pricing.
- **Login extension** — mint + register a `scanDeviceToken`, return it in the auth
  response. Small addition to the existing auth handler.
- **`revokeScanDevice`** `{ token }` (admin-gated) — optional.
- Registry: a `ScanDevices` sheet (token, mintedBy, mintedAt, lastSeen, revoked).
- Rate-limit per token/unit; video size cap.

## Phase 5 — Tests + gates

- `ci/logic-test.mjs`: table-drive the status→(start/end/block) decision across all
  `STATUS_ORDER` values incl. out-wins + ambiguous-block; assert no PII in the
  scan responses.
- Local gates before push: `node ci/gen-rule-usage.mjs --check`,
  `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`
  (+ `smoke`/`logic` in CI).

## Phase 6 — Staging (preview) + test decal

- `/deploy` → verify live bytes → generate a **real** scannable QR for a seeded
  unit → drive scan→record on staging against a **preview response** (flag lets the
  client short-circuit `captureByScan` to canned Start/End/Block/unknown results,
  no real filing) so Jac walks every state + eyeballs the decal **before** the
  backend exists. Red review = HARD STOP.

## Phase 7 — Go live (backend LAST)

Order, honoring "backend deploy last":
1. `/live` ships the **frontend with the `FEATURES` flag OFF** (deploy → merge →
   promote — promote is Jac's explicit call; it touches auth). Dormant in prod;
   nothing calls `captureByScan`.
2. **Jac** `/clasp`-pushes + **editor-deploys** `captureByScan` + the login mint —
   the last gate, Jac's click, outside the git gates by design.
3. Flip the `FEATURES` flag **ON** (config-only branch → `/merge`, no promote of
   served JS needed beyond the config bump) → **one real confirmation scan** →
   then the print run.

## Delegation

- Auth spine (Phases 3–4), routing (Phase 1), and integration stay on **main**.
- Candidate background delegations once the spine lands: the `logic-test` table
  (Phase 5, Sonnet) and the decal print-QR generator for staging (Phase 6, Sonnet).

## Out of scope (this phase)

Bulk decal print-sheet UI; on-demand reprint; video trimming. All additive later.
