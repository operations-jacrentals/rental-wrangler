# Text-Link Identity — per-person logins to end password babysitting

**Owner:** Jac
**Date:** 2026-07-13
**Status:** Design — awaiting review
**Branch:** `claude/team-roster-roles-logins-e4cio2`
**Builds on:** `docs/superpowers/specs/2026-06-26-role-system-redesign-design.md` (the tier ladder)

## 1. Problem

Sign-in today is **shared role passwords**: `config.roles = { roleId: password }` plus a
separate `config.admin` password (`settingsLoginsPane`, `app.js:4686`). A person types a
free-text **name** (used only to stamp audit lines — `currentUser`, `app.js:20419`) plus a
shared role password; `backendCall('auth')` maps the password → a role string
(`attemptLogin`, `app.js:23116`). Identity-to-person is a fragile name-match
(`myRosterId`, `app.js:9603`).

Jac's stated pain (verbatim): *"I HATE having to always log new employees in. It sucks.
Always having to manage passwords is the worst."* The chores he named are all symptoms of
the shared-password model:

- **Making & handing out passwords** — a shared secret he has to create and distribute.
- **Password resets** — he's in the loop for every one.
- **Keeping track of who's who** — shared logins can't say *who* did a thing; cleanup on
  departure is fuzzy.

The fix is to **make each person their own login, with no password Jac ever manages** — and,
as a direct by-product, to give every person a stable identity that the long-requested
per-user personalization can hang off later.

## 2. Goals / non-goals

**Goals**
- Each **person** on the Team Roster is a login: **name + phone + role + their own password**.
- **Admin never sees or handles the password** — the employee sets it themselves from a
  texted one-time link; resets are self-serve by text.
- **Roles keep the existing tier ladder** (staff → money → manager → admin → developer) and
  KPI rings; a person's role sets what they can see/do.
- **Device remembers the person** (greets by name, no username entry) on personal devices,
  with a **revocable 30-day** re-auth; honest attribution on the shared office computer.
- **Removing a person cuts them off completely and immediately.**
- Ships **behind a `FEATURES` flag**; flipping it on is a **cutover** for everyone, flipping
  it back is instant rollback.

**Non-goals (YAGNI)**
- No SSO / Google sign-in / magic-link-only / passkeys (considered and rejected for this
  round — password chosen; see §12 decisions).
- No PIN option (Jac chose password-only).
- No per-user personalization *features* yet — this only lays the **stable identity key**
  personalization will later use. (Separate spec.)
- No change to the KPI `ROLES` registry (`config.js:307`) shape or the KPI-ring authoring.
- No new signup/self-registration — a person exists only if an admin/manager adds them.
- No restricting employee-phone visibility to admins only (it's already broadcast to signed-in
  clients today; tightening that is separate hardening — §11 risks).

## 3. The reframe (approved — Section A)

Ownership of the login flips from **roles** to **people**:

- **People hold logins.** A roster person = `{ id, name, phone, role, note }` plus, in a
  *separate private store* (§5), their credential and tokens. The **Team Roster becomes the
  real login list**, not a side list.
- **Roles stop holding passwords.** A role becomes `{ label, tier, KPI rings }` only. When an
  admin adds a person they pick a **role**, which carries the tier (via the existing
  `roleMeta`/`ROLE_TIERS` machinery, `config.js:331`) and the KPI rings. The permission ladder
  and every tier gate (`roleTier`, `app.js:18045`; `adminUnlocked`/`devUnlocked`,
  `app.js:18061`) are **unchanged** — they resolve a person's role → tier exactly as today.
- **`currentRole` stays the tier key.** After a person signs in, `currentRole` is set to their
  role id, so every existing gate keeps working with **zero changes to permission logic**.
- **`currentUser` becomes the person, not free text.** It's resolved from the authenticated
  person (their roster `id` + name), so audit stamps (`logAction`, `app.js:20422`) and
  `myRosterId` (`app.js:9603`) are now exact, not name-matched.

## 4. Data model

### 4.1 Roster (display) — stays in the round-tripped config
The editable roster stays in `settings.employees` (as today — `settingsTeamPane`,
`app.js:4644`), extended so `role` maps to a tier-bearing role id:
```
settings.employees[i] = { id:'EMP…', name, phone, role /* roleId */, note }
```
`id` is the existing stable per-person key minted on add (`app.js:16989`). This blob is
admin-editable and already round-trips via `getConfig`/`setConfig`. **No secrets here.**

### 4.2 Credentials & tokens — NEW private backend store
A dedicated Sheet tab (e.g. `Auth`) that the client **never** reads. Only server-side auth
actions touch it. Keyed by person `id`:
```
Auth[id] = {
  phone,                       // normalized E.164; server resolves SMS recipient from here
  passHash, passSalt,          // salted hash — NEVER the plaintext (§5)
  linkTokenHash, linkExpires,  // one-time enrollment/reset link (single-use, ~45 min)
  linkPurpose,                 // 'enroll' | 'reset'
  sessions: [ { tokenHash, expires, label } ],  // revocable 30-day "remember me" tokens
  status                       // 'active' | 'removed'
}
```
> **Why not reuse `settings.employees` for the secrets?** `getConfig` returns the whole
> `settings` blob to *every* signed-in client (roleMeta is "synced to every user in
> loadFromBackend"). Putting `passHash`/tokens there would **broadcast them to every device**.
> Secrets therefore live only in the `Auth` store, which no client-facing read ever returns.

### 4.3 Frontend registry (`config.js`)
- `FEATURES.perPersonLogins = false` — the new key (`config.js:617`), read via `flagOn()`.
- `ROLE_TIERS`, `BUILTIN_ROLE_TIERS`, `ROLES` — **unchanged**.

## 5. Security model (approved — Section D)

- **Password hashing.** Store `passHash = hash(salt + password)` with a per-person random
  `passSalt`, using a deliberately slow/iterated construction available in Apps Script
  (`Utilities.computeHmacSha256Signature` / `computeDigest` with a high iteration count, or an
  equivalent PBKDF2-style loop) plus a server-only pepper from Script Properties. **Plaintext is
  never stored or logged**; the phone is the only recovery path.
- **One-time links.** A cryptographically-random token; only its **hash** is stored, with
  `linkExpires` (~45 min) and single-use semantics (consumed/cleared on redemption). A
  forwarded or stale link fails. Links are only ever sent to a phone **already on the roster**.
- **Remember-me sessions.** On login *with* "Remember me", the server mints a random opaque
  device token, stores its **hash** with a 30-day expiry, and returns the token to the client
  (localStorage). Each app open sends it; the server validates → resolves the person **without a
  password**. Revocable server-side (leaving employee, on-demand sign-out-everywhere).
- **Remove = cut off.** Setting a person `status:'removed'` (or deleting) wipes `passHash`,
  all `sessions`, and any pending `linkTokenHash` in the same write — instant lockout across
  every device.
- **The flag is not the lock.** `FEATURES.perPersonLogins` only selects the **login UX**; the
  backend enforces auth independently, so a client-side flip can't bypass anything
  (`config.js:615` — "Never gate a secret or a security/auth check on this").
- **Quiet-hours bypass.** Enrollment/reset texts are transactional and **skip the 8pm–8am
  quiet-hours** gate the marketing pipe honors (§8), so a link sends the moment it's needed.
- **Password floor.** A sensible minimum length, enforced server-side on set. Password only —
  no PIN.

## 6. Backend actions (Google Apps Script — load-bearing)

Unlike the role-system redesign (which rode the config blob and touched no `Code.gs`), this
feature **requires backend code** for the private store + auth. New/changed actions:

| Action | Purpose |
|---|---|
| `enrollPerson` *(admin-gated)* | Given a roster `id`, mint a one-time enroll link + text it. |
| `blastEnrollLinks` *(admin-gated)* | Cutover helper: enroll-link every active rostered person. |
| `requestLink` *(unauth, roster-gated)* | Self-serve reset: caller supplies phone/name → if on roster, text a fresh link. Rate-limited. |
| `redeemLink` | Validate a link token → allow the caller to set a password. Single-use. |
| `setPassword` | Store `passHash`+`passSalt` for the person tied to a valid redeemed link. |
| `authPerson` | Verify person + password → issue a 30-day session token *(only when "Remember me" is ticked)*; return role/tier. Extends/replaces today's `auth`. |
| `sessionResume` | Validate a device token → resolve person without password. |
| `revokeSessions` *(self or admin)* | Kill remember-me tokens for a person (sign-out-everywhere). |

`load` (dataset) is unchanged. Existing `auth` (shared-password) stays live **while the flag
is off / during coexistence**, and is retired in the final backend change once everyone's
across (§7).

**Deploy path (this session):** backend pushes go via the **service-account path**
(`GAS_SA_KEY_B64` is set — `docs/handoffs/gas-deploy-service-account.mjs`, push-only). **Go-live
is Jac's click in the Apps Script editor** — a REST-API deploy breaks the web app's anonymous
access (confirmed 2026-07-06). clasp is RAPT-blocked and not the path. Full runbook:
`docs/handoffs/BACKEND-DEPLOY-QUEUE.md` + `/clasp`.

## 7. Flows

### 7.1 Enrollment (approved — Section B)
Admin opens Team Roster → **"+ Employee"** (renamed from "+ Hand" per Jac — `addBtn` at
`app.js:4654`) → name, phone, role → Save (`enrollPerson`). Backend texts a one-time link →
employee taps → **"Set your password"** (`redeemLink` → `setPassword`) → signed in; device
remembers them. Stale link → one-tap re-send.

### 7.2 Daily sign-in
- **Personal phone (Remember me ✓):** `sessionResume` → greeted by name, no typing. At 30
  days, one password entry (name already known), then re-remembered.
- **Shared office computer (Remember me ✗):** one machine can't remember five people, so the
  user **picks their name + enters password** each session, and is signed out when done — the
  deliberate spot the "no typing" magic doesn't apply, to keep attribution honest. To avoid
  listing the whole crew to anyone at the machine, the picker shows **recently-used names on
  that device** first (with a "someone else" → name/phone entry path), not the full roster.
- **New/handed-off device:** signing in as a different person (name/phone + password) re-binds
  the remembered identity to them.

### 7.3 Forgot password (self-serve)
Login screen **"Need a link?"** → enter phone / pick name → `requestLink` → texted one-time
link → set a new password. No admin involvement. Only texts roster numbers.

## 8. SMS — rides the existing Mocean pipe

Texting already exists: `sendCustomerMessage` → Mocean adapter, keys in backend Script
Properties, `SMS_DAILY_CAP`, opt-out, 8pm–8am quiet hours, masked-recipient logging
(`app.js:20228`, `app.js:20245`). This feature adds an **employee-directed** send (recipient
resolved server-side from `Auth[id].phone`, never a client-supplied `to` — same discipline as
the customer pipe) and **exempts auth texts from quiet hours** (§5). No new provider, no new
bill. In `#local`/offline demo mode (no `backendPassword`) the flow degrades gracefully (no
real send; dev stub), mirroring the existing demo deep-link fallback.

## 9. Frontend changes

- **Login screen** (`renderLogin`/`attemptLogin`, `app.js:23116`): flag-gated. New mode adds
  the remembered-name greeting, the shared-machine name-picker, "Remember me", "Set your
  password" (from a link), and "Need a link?". Old shared-password screen stays when the flag
  is off. Runs through **`/jactec-ui`** (yard data-plate language, R-Rulebook `data-r` stamps,
  `rule-usage.js` regen, `WINDOW_CATALOG` if any new popup).
- **Settings → Team Roster** (`settingsTeamPane`, `app.js:4644`): "+ Employee" label; role
  becomes a tier-bearing role picker; per-row "Send setup link" / "Reset" / "Sign out
  everywhere" / remove. Add-person mints the `id` (`app.js:16989`) and calls `enrollPerson`.
- **Settings → Roles & Logins** (`settingsLoginsPane`, `app.js:4686`): roles lose the password
  field under the flag (passwords are per-person now); keep label + tier. The `config.admin`
  bootstrap login is retained until cutover completes.
- **Session plumbing:** replace the per-tab `sessionStorage jactec.pw` reliance with the
  device token for remembered sessions; `currentUser`/`currentRole` (`app.js:20419`) resolve
  from the authenticated person.

## 10. Cutover & backout (approved — Section C)

1. **Build with the flag OFF** — shared passwords untouched; test per-person login privately.
2. **Pre-load the roster** — ensure every active person has name + phone + role.
3. **Flip `FEATURES.perPersonLogins` ON** = cutover: login switches to per-person for
   everyone; **blast setup links** (`blastEnrollLinks`) with **self-serve "Need a link?"** as
   the fallback (approved).
4. **Backout** — flip the flag OFF → everyone's instantly back on shared passwords; new
   accounts persist for the next attempt.
5. **Retire shared passwords** — once everyone's across, a final backend change removes
   `auth` (shared-password) acceptance and the `config.roles` password map, so "off" is truly
   off, not just flag-hidden.

## 11. Risks / open questions

- **Backend `Code.gs` is required and security-critical.** This is auth — it stays on the main
  session, never delegated (CLAUDE.md → Auto-delegation). Hashing, token generation, and
  session validation must be reviewed carefully. The role-system spec's verified constraint
  (the `roles` map is a fixed 6-slot set; `setConfig` drops unknown keys) is **moot here** —
  we're adding a *new* `Auth` store and actions, not new `roles` keys.
- **Apps Script hashing cost.** GAS has no native bcrypt; use an iterated HMAC/PBKDF2-style
  construction + server pepper. Validate the per-login latency is acceptable.
- **Employee phone visibility.** Phones already round-trip to signed-in clients via
  `settings.employees` today; this spec doesn't worsen it but doesn't fix it either. Tightening
  phone visibility to admins is separate hardening.
- **`main` ref currently unresolvable in-session** (shallow clone); reconcile the base branch
  before the PR/merge gate.
- **Offline/`#local` demo** must keep booting with the flag on (no backend) — the login screen
  needs a demo path.
- **Audit-history continuity.** Old `logAction` lines stamped with free-text names remain;
  new ones use the resolved person. No back-fill.

## 12. Decisions log (from brainstorming)

- **Credential model:** keep a user-set **password** (not password-free / not PIN).
- **Rollout:** build behind the `FEATURES` flag, then flip to **force a cutover**.
- **Shared machine:** **"Remember me" checkbox** — 30-day remember on personal devices, sign-out
  on the shared computer.
- **Cutover enrollment:** **blast setup links + self-serve fallback.**
- **Add button label:** **"+ Employee"** (not "+ Hand").
- **Quiet hours:** auth texts **bypass** the 8pm–8am block.

## 13. Testing & gates

- `node ci/smoke.mjs` (boot + login renders, flag off *and* on), `node ci/logic-test.mjs`
  (money/multi-unit regression), `node ci/gen-rule-usage.mjs --check`,
  `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`.
- **Manual (staging / Claude-in-Chrome):** enroll a person end-to-end (text → set password →
  signed in); remembered sign-in on a personal device; name-pick + password on a shared
  browser; 30-day expiry (simulated); forgot-password link; remove-person cuts off an active
  session; flag-off shows the old login unchanged.
- **Security review:** run `/role` (via `/jactec-ui`) and a focused auth review before cutover —
  hashing, token single-use/expiry, revocation-on-remove, roster-gated link requests, flag not
  gating the security check.
