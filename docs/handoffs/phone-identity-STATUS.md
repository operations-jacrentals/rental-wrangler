# Phone-Verified Device Identity — build STATUS / resume note

**Feature:** per-person staff logins replacing the shared role-passwords — identity = a Team
Roster person, verified by a one-time SMS code; personal device trusted 30 days (login = open
the app), shared device takes a PIN each session. No passwords.

**Branch / PR:** `claude/zen-mayer-r2rdgw` → **PR #632** (draft). Everything is behind
`FEATURES.phoneIdentity = false` — inert on the live site.
**Spec:** `docs/superpowers/specs/2026-07-13-text-link-identity-design.md`
**Plan:** `docs/superpowers/plans/2026-07-14-text-link-identity-plan.md`

## Built & pushed (all local gates green; CI `smoke` green)

| Phase | Commit | What |
|---|---|---|
| 0 · Flag | `01a84f1` | `FEATURES.phoneIdentity` + `PHONE_IDENTITY` constants (`config.js`) |
| 1 · Backend auth | `078f03e` | `docs/handoffs/phone-identity-backend.gs` — hashed store, one-time codes, PIN + lockout, revocable device trust, roster-scoped send (quiet-hours bypass), per-call token authz, remove-cascade. **Router wiring documented inline.** |
| 2 · Login flow | `997f357` | `renderPhoneLogin` state machine + handlers (`app.js`), `.login-*` states (`style.css`) |
| 3 · Roster admin | `bccd497` | "+ Employee", per-person Text-code / Sign-out, roster=login-list note |
| 4 · Cutover blast | `d8b9c51` | "Text everyone a setup code" (`authEnrollBlast`) |

## ⚠️ NOT done — resume here

**None of Phases 1–4 has been RUN.** Cloud session couldn't deploy the backend or drive a
browser. It's flag-guarded so it's safe, but **correctness is unverified.** Resume order:

1. **Deploy the backend (STOP-gate, Jac's call).** The auth handlers in
   `phone-identity-backend.gs` must be pasted/merged into the gitignored `Code.gs` per the
   inline "ROUTER WIRING" block (add the `auth*` actions to `handle()`, the `sessionToken`
   line, the `WRITE_ACTIONS` keys, and the `pidReconcileRoster_` hook in `saveConfigFromBody`).
   Push via the **service-account** path (`docs/handoffs/gas-deploy-service-account.mjs`,
   `GAS_IMPERSONATE_SUBJECT=operations@jacrentals.com`) → **go-live is Jac's Apps Script editor
   deploy** (a REST deploy breaks anonymous access). Confirm a real test text first.
2. **Deploy the branch to staging** (`/deploy`) with the flag temporarily ON for the test.
3. **Drive the whole flow end-to-end** (Claude-in-Chrome): enroll a test roster person → text
   code → verify → personal (30-day) path; shared path → Set PIN → PIN login; self-serve "text
   me a code"; per-person Sign-out; remove→revoke; the blast. Run the **`/jactec-ui` screenshot
   self-critique** here and fix anything.
4. **Phase 5 (deferred, Jac's call):** retire the shared-password acceptance in the backend
   (point of no return for flag-backout).
5. **Phase 6 ship:** cache-bust `?v=` → `/merge` (trunk) → wait → `/promote` (production) →
   then flip `FEATURES.phoneIdentity` when ready to cut the crew over (blast + self-serve as the
   on-ramp; flag-OFF is the instant backout).

## Security posture (Phase 1 self-review)
Secrets only in Script Properties (never synced); codes/PINs HMAC-SHA256 + server pepper + salt;
one-time codes (10-min, 5-try burn); PIN lockout (5 tries/15 min); rate-limited roster-only
sends; revocable 30-day trust; remove-cascade; the flag is NOT the auth gate (backend
authenticates every call). Residual: a 4–8-digit PIN is offline-brute-forceable only if both the
property store AND the pepper leak (backend-only) — accepted for the internal threat model.
**A human security review before go-live is still recommended.**
