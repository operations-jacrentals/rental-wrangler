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

1. **Deploy the backend (STOP-gate, Jac's call) — NOT a blind push; needs careful review.**
   The auth handlers in `phone-identity-backend.gs` merge into the gitignored `Code.gs`. The
   live code was pulled + mapped on 2026-07-14; all helper deps exist. **Exact integration map
   (live `Code.js` line numbers as of the 2026-07-14 pull — re-grep before applying):**
   - **Append** every `phone-identity-backend.gs` function (drop its trailing ROUTER-WIRING
     comment block) to the end of `Code.js`.
   - In `handle()` **after line 132** (`var pw = ..., action = ...`): insert
     `var pidCaller = body.sessionToken ? pidResolveCaller_(body.sessionToken) : null;` + the 7
     `auth*` dispatch lines (`authStart/authVerify/authLoginPin/authResume/authSetPin` public;
     `authRevoke`/`authEnrollBlast` pass the effective role) + two helpers
     `pidRole_()` (`pidCaller ? pidCaller.role : roleForPassword(pw)`) and
     `pidAdmin_()` (`pidCaller ? pidCaller.tier >= ROLE_TIER_RANK.admin : isAdmin(pw)`).
   - **Change these existing gates** so a session authorizes (pw path unchanged when no token):
     line 144 `getConfig` + 145 `setConfig` `isAdmin(pw)`→`pidAdmin_()`; line 148
     `var role = roleForPassword(pw)`→`var role = pidRole_();`; and the `isAdmin(pw)` gates at
     runReminderSweep (153), adminSetProps (154), setViews (167), feedbackList (183)→`pidAdmin_()`.
   - **VERIFY** the inner functions that take/re-check `pw` don't independently reject a session:
     `adminSetProps_(body,pw)`, `sendCustomerMessage_(body,role,pw)`, `messagesFor_`,
     `smsProviderStatus_(pw)`, and **the `load` action gate** (find it — the frontend's boot
     `backendCall('load')` must succeed for a per-person session).
   - In `saveConfigFromBody` (909): capture `prevEmp` before `saveConfigObj`, then call
     `pidReconcileRoster_(prevEmp, (clean.settings||{}).employees||[])` before returning (the
     roster-remove cascade).
   - `node --check Code.js` → **STOP, show Jac the diff** → push HEAD via
     `GAS_SA_KEY_B64=$GAS_SA_KEY_B64 GAS_IMPERSONATE_SUBJECT=operations@jacrentals.com node
     docs/handoffs/gas-deploy-service-account.mjs push` → **Jac's editor go-live** (New version,
     Who has access: Anyone) → verify anonymous JSON:
     `POST {"action":"auth","password":"__wrong__"}` → expect `{"ok":false,...}` (HTML = broken).
   - **No safe pre-deploy test exists** (clasp RAPT-blocked; REST deploy guarded/breaks anon
     access) → the editor review + the post-deploy JSON probe ARE the test. Best done in a
     focused session with Jac live at the editor. Pull the live code first:
     `node <scratch>/getContent.mjs` (service-account `projects.getContent` → `~/rw-backend`).
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
