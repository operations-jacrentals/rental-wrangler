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

## ✅ LIVE — cutover promoted 2026-07-15

`FEATURES.phoneIdentity` is **ON** in production (app.jacrentals.com, `?v=20260715b`). The
whole crew is on per-person phone login. Flag-OFF remains the instant backout.

## Auto-enroll on roster add / number change — 2026-07-15 (backend)

`pidReconcileRoster_` now, on a config save: **added** person w/ phone → auto-text a setup
code; **number changed** → purge old device trust/PIN (re-verify on the new number) + text
the new number; **removed** → purge (unchanged). New `pidCodeSms_` puts the app URL
(`app.jacrentals.com`, override via `PID_APP_URL` prop) in the **enroll** text so a
first-timer knows where to go (also upgrades the blast copy); native app-store links slot in
later. Mirror updated (`phone-identity-backend.gs`); pushed to HEAD via service account —
**go-live is Jac's editor New-version deploy.**

## ✅ Backend DEPLOYED + verified — 2026-07-14

Phase 1 backend is **live** (dormant behind the flag). Merged additively into `Code.js` per the
map below, pushed to HEAD via the service account, Jac did the editor **New version** go-live.
Verified against the live `/exec`: `auth` wrong-pw → `{ok:false,unauthorized}`; `auth` real pw →
`{ok:true,role:Admin}` (**shared-password login intact**); `authStart` non-roster → `{ok:true,
sent:false}`; `authResume` bogus token → `{ok:false,expired}`. Anonymous access healthy.

**Pre-flip follow-ups (before flipping `phoneIdentity` ON):**
- ✅ **`auth*` actions are now POST-only** (added to `WRITE_ACTIONS`, dispatch moved after the §256
  guard) — deployed + verified 2026-07-14 (GET `authStart` → `post-required`; POST still works).
- ✅ **Per-person login verified end-to-end on staging** — personal login + code→verify, and
  Developer-tier admin access after the roster role-picker fix (commit `fa12819`).
- **Still to spot-check on staging:** shared-device PIN path, self-serve "Need a code?" reset,
  Sign-out-everywhere, remove-a-person → access dies.
- **Verify `adminSetProps_` + other inner `pw`-rechecking functions honor a per-person session**
  (dormant-path item; a per-person admin using those niche actions would otherwise be rejected).
- **Set up the real roster** — every active hand needs name + phone + role/tier (flag-OFF admin
  data entry) before the flip.

**Roster role → tier gotcha (fixed):** the roster role picker only offered the KPI-ring ROLES
(staff/money), so a per-person user could never be Manager/Admin/Developer. Fixed by adding those
to the picker (`fa12819`); `roleTier`/`roleTierRank_` already resolve them. Assign each person's
tier via the picker while flag-OFF, before flipping.

## ⚠️ Remaining — resume here

Frontend Phases 2–4 are built but **not yet driven end-to-end** (needs the staging drive above).
Original deploy map (kept for reference — the splice is already applied + live):

1. **Deploy the backend — ✅ DONE 2026-07-14 (see above). Original map:**
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
