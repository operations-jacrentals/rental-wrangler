# Phone-Verified Device Identity — per-person staff logins (SMS code + device-aware) — DESIGN

**Topic:** Replace the shared role-passwords with per-person staff logins. Identity =
a roster person (name + phone + role). A person is verified by a **one-time SMS code**; then:
a **personal device** trusts them for 30 days (login = just open the app), and a **shared
device** asks for a **PIN every session**. **No passwords anywhere.**

**Status:** Design — **approved with Jac** through the device-aware refinement (2026-07-14).
Ready for `writing-plans` once Jac confirms this revision reads right.

**Lineage:**
- **2026-07-13** — original brainstorm (branch `claude/team-roster-roles-logins-e4cio2`,
  commit `f77c162`) landed on a **user-set password + texted link** model. That branch was
  created in a cloud session reclaimed **before it was pushed**, so the file was lost
  (`422 No commit found`).
- **2026-07-14 (this doc)** — restored, then **evolved** per Jac: he preferred the far simpler
  **phone-code + device-type** model over passwords, and asked to close the "coworkers know
  each other's numbers" hole with a **shared-device PIN**. Twilio is now the live SMS provider
  (backend v92) — the send path the feature was waiting on.

---

## 0. Why (the problem)

Today a "login" is a **shared role-password** (`{ RoleName: password }` map;
`roleForPassword(pw)` on the backend returns a role/tier — the password *is* the credential and
the tier). Identity is only a **free-text "Operator" name** matched to a roster person by
case-insensitive name (`myRosterId()`) — anyone can type any name.

Three things Jac wants gone, all removed here:
1. **Making & handing out passwords** — gone. There are no passwords at all.
2. **Password resets** — gone. Recovery is a self-serve phone code.
3. **Who's who** — the **phone is the identity**; every action is attributable to a real person.

### The threat we explicitly design against ("coworkers know the numbers")
Knowing a coworker's number does **not**, by itself, let anyone log in as them — the code is
texted to **their** phone. The number is not the secret; **the code is**, and it lands on their
device. Knowing the number only bites when someone can *also see the code*: an unlocked phone, a
phone left on the bench, or the **shared office computer**. So the exposure is *shared /
left-out devices*, and that is exactly where a second factor (the PIN) is required.

---

## 1. Identity & roles (the core reframe)  ✅ approved

- **People hold the logins.** Each person is **name + phone + role**. The **Team Roster becomes
  the actual list of who can log in** (today's roster row is
  `settings.employees[] = { id, name, role, phone, note }`, rendered at `app.js:4686`).
- **Roles stop having passwords.** A role is purely **permission tier + which KPI rings show** —
  the existing ladder (`ROLE_TIERS`, `config.js:331`: **staff → money → manager → admin →
  developer**). Pick a role at add-time and that sets their powers. Same ladder, attached to the
  person instead of a shared password.
- **Clean split of what's stored where:**
  - **Visible roster** (name, phone, role, note) — normal Settings pane, synced to devices.
  - **Secrets** (the **PIN hash**, verification codes, device-trust tokens) — a new
    **backend-only** store the login check reads and that **never** goes to any device.
    Explicitly NOT the synced settings bundle (that bundle is broadcast to every device — see §5).

---

## 2. Data model

**Visible (synced, non-secret) — `settings.employees[]` (existing):**
```
{ id, name, phone, role, note }          // role drives the permission tier + KPI rings
```

**Secret (backend-only, NEVER synced) — new private store:**
```
enrollment:   { personId, phoneE164, pinHash|null, pinSetAt|null, tierAtLogin }
loginCode:    { codeHash, personId, purpose:'verify'|'reset', expiresAt, usedAt|null, attempts }
deviceTrust:  { deviceToken(hashed), personId, kind:'personal', issuedAt, expiresAt(+30d) }
```
- **No password field, ever.** `pinHash` is present only once a person has used a shared device
  (null for personal-only hands). PINs and codes stored **hashed**; the raw code lives only in
  the text, single-use.
- Keyed by `personId` = the roster `employee.id`. **Shared devices are never stored as trusted**
  — they hold no `deviceTrust` row, so no one is silently remembered on them.
- Removing the roster row cascade-deletes the person's `enrollment` (incl. `pinHash`), every
  `deviceTrust`, and any pending `loginCode` (§5).

---

## 3. The everyday flows  ✅ approved (device-aware)

### 3.1 Adding a hand (enrollment)
Settings → **Team Roster → "+ Employee"** (label changes from today's **"+ Hand"**,
`app.js:4686`) → type **name, phone, role** → **Save**. That's the whole admin step — **no
password or PIN is set by the admin.** The person is now on the roster and can verify themselves
on first login (or the admin can fire them a "you're set up" text; see §4).

### 3.2 First login on an unrecognized device
1. **Identify** — enter phone number (or pick name) → backend texts a **one-time code** (short
   expiry, ~10 min) → they enter it → **verified** (proves they hold that phone).
2. **The device question — "Is this a shared device?"**
   - **No → personal device.** The device is **trusted for 30 days**. From now on **login = just
     open the app**, greeted by name — no PIN, no password. At 30 days a **fresh code**
     re-verifies, then trusts again. (The phone's own lock screen is the guard on a personal
     device.)
   - **Yes → shared device.** The device is **never** trusted/remembered. If the person has no
     PIN yet, they **set one now** (they just proved ownership by code). Every session on a
     shared device = **pick your name from the roster + type your PIN**, and it signs out when
     done.

### 3.3 Day-to-day
- **Personal phone:** open the app → in (for 30 days). The "no passwords, yay" path.
- **Shared computer:** pick your name + PIN, each time. Honest attribution on the one machine
  many people touch.
- **Handed-off / new device:** a **different person** verifies by code and (if they mark it
  personal) becomes the remembered one; on a shared device nothing to re-bind — they just pick
  their name + PIN.

### 3.4 Forgot PIN / new phone (self-serve, no admin)
On the login screen: **"Need a code?"** → enter phone (or pick name) → backend texts a fresh
one-time code → verify → set a new PIN (if needed). The admin is never involved. **Codes only
ever send to a number already on the roster** — no stranger can fish for one.

---

## 4. Cutover (behind the `FEATURES` flag)  ✅ approved (blast + self-serve)

Ships as a **big replacement behind a `FEATURES` flag** (`config.js:617`, `flagOn()` reader — the
standard additive/default-OFF pattern; header warning at `config.js:609`).

- **Flag OFF (build + test):** nothing changes — shared role-passwords keep working exactly as
  today; the new system sits dormant; Jac can test his own per-person login first.
- **Before the flip:** make sure every active roster person has **name + phone + role** (they
  already have name + role — this is really just **adding phones**).
- **Flip ON = cutover.** Login switches to per-person mode for everyone. To onboard:
  - **Blast a welcome/verify text** to every rostered person at once (they tap, verify, pick
    personal/shared). *(Chosen default — proactive.)*
  - **Self-serve fallback** — anyone who misses it taps **"Need a code?"** at the login screen.
    *(Always-on safety net.)*
- **Backing out:** flip the flag **OFF** → everyone instantly back on shared passwords; their
  enrollments stay set up for next time.
- **Once everyone's across:** a final small backend change **retires the shared passwords for
  good** (so "off" is truly off — the flag is a UX switch, not the security lock; §5).

---

## 5. Safety rails  ✅ approved (no passwords; PIN only on shared)

1. **PINs are hashed, never stored readable.** The phone (a fresh code) is the recovery path.
2. **Login/verify/reset codes are one-time and expire fast (~10 min); setup/welcome links ~45
   min.** A forwarded or stale text can't be reused.
3. **PIN-guessing is capped** — a small attempt limit + lockout on the shared device stops
   someone brute-forcing a 4-digit PIN.
4. **Removing someone cuts them off completely and immediately** — enrollment (incl. PIN), every
   trusted device, and any pending code all die on roster removal.
5. **Codes only ever text a number already on the roster**; issuance is rate-limited and does not
   reveal whether a number is valid (no enumeration/harassment).
6. **Login/verify/reset texts skip the 8pm–8am quiet hours** — they send right away; only
   marketing texts wait (see §7).
7. **The flag is not the lock.** The backend authenticates every login on its own; a browser
   setting can't grant access. (Never gate an auth check on `FEATURES` — `config.js:609`.)
8. **The 30-day personal-device trust is a revocable token** — Jac (or a leaving employee) can be
   **signed out everywhere on demand**.
9. **"Is this a shared device?" is self-declared** (honest-employee model). Residual risk: a user
   could mark a truly shared machine "personal" to get 30-day no-PIN access. *Optional hardening
   (open for Jac):* let an admin **pre-designate the office computer as shared** server-side so it
   can't be self-marked personal. Recommended default: self-declared, with the admin override
   available if Jac wants the office PC nailed down.
10. **Residual, accepted:** a personal phone left unlocked in a coworker's hand = access as that
    person for up to 30 days — the standard trade for a personal device; the phone's own lock is
    the guard.

---

## 6. Backend contract (new — additive)

Server-side work (a genuine auth feature; deployed via the service-account push path + **Jac's
editor go-live click**, per `/clasp`):

- `verifyStart(phoneOrPersonId, purpose)` — roster-scoped; mints a one-time code, texts it
  (skips quiet hours). Also the "blast all" variant for cutover.
- `verifyCode(personId, code, deviceKind, rememberDevice)` — validates + burns the code; on
  `personal` issues a 30-day device-trust token; on `shared` returns a session only (no trust).
- `setPin(personId, pin)` / `changePin` — writes the hashed PIN (first shared-device use or
  reset); attempt-capped.
- `loginPin(personId, pin)` — shared-device session; verifies against `pinHash`, enforces the
  attempt cap.
- `resumeDevice(deviceToken)` — validates a trusted personal device (≤30d); prompts a fresh code
  at expiry.
- `revokePerson(personId)` / `revokeDevices(personId)` — remove-cascade / sign-out-everywhere.
- **Tier enforcement moves server-side per person:** the verified session carries the person's
  tier; money/admin gates compare **tier** (`tierRank`) keyed to the authenticated person, not a
  shared password. This replaces `roleForPassword` for flagged-on clients.

**Auth-gate discipline stays on the main session** (never delegated): code/PIN storage + hashing,
one-time/expiry, attempt caps, roster-only sends, the remove-cascade, and the server-side tier
gate — with a security review before deploy.

---

## 7. SMS send path (the "waiting for Twilio" piece — now unblocked)

The plumbing already exists and, as of **2026-07-14, Twilio is the live provider (backend v92)**
(`provider:twilio, status:sent` confirmed), with **Mocean as fallback** — **no new service, no new
bill.** Two musts on top of it:

- **Use the roster-scoped staff send, not the customer send.** `sendCustomerMessage_` is bound to
  **customer isolation** (resolves the recipient from a *customer* record; ignores a
  client-supplied destination) so it can't text an arbitrary roster phone. The **roster-isolated
  staff path** (`sendStaffMessage_`, backend v99) resolves a **roster person's** phone — login
  codes ride that (or a small dedicated `sendAuthCode_` reusing the same low-level Twilio call).
  The destination is **always** taken from the roster record server-side, never the client
  (rail #5).
- **Bypass quiet hours** — a login code is transactional and someone's waiting on it, so it sends
  immediately (rail #6).

---

## 8. Frontend changes (all through `/jactec-ui` when built)

- **Login screen (flag ON):**
  - Unrecognized device: identify (phone/name) → **code entry** → **"Is this a shared device?"**
    (personal ⇒ trusted 30 days; shared ⇒ PIN pad, name-pick each session).
  - Trusted personal device: **"Welcome back, <name>"** → straight in.
  - **"Need a code?"** self-serve reset affordance; a **PIN pad** for shared devices; a
    **"Set your PIN"** step on first shared-device use.
  - Keep the yard data-plate language (rivets, hazard-stripe, Saira Condensed, "Saddle Up?"
    ignition). New popups get `WINDOW_CATALOG` entries; new elements get `data-r` stamps.
- **Team Roster pane:** button **"+ Employee"**; role drives the tier; phone is load-bearing
  (validate + E.164 normalize); per-person **"Re-send code" / "Sign out everywhere" / remove**
  (with the cascade warning).
- **Flag reader:** `flagOn('phoneIdentity')` (or similar) gates the login **experience** only —
  never the auth check.

---

## 9. Non-goals

- Not the **Customer Portal** (external, row-isolated customer auth — separate spec). This is
  **staff/internal** login.
- **No passwords** at all; **no PIN on personal devices** (PIN is shared-device-only).
- No change to *what* tiers can do — only *how a person acquires a tier*.
- No SSO / OAuth / third-party identity providers.

---

## 10. Resolved decisions

| # | Question | Decision |
|---|----------|----------|
| 1 | Password, or phone-code? | **Phone-code, no passwords** (Jac loved the simplicity). |
| 2 | Coworkers know each other's numbers — the hole | Closed with a **shared-device PIN**; the number alone can't log anyone in (code goes to *their* phone). |
| 3 | How is a device treated? | **Ask "shared device?"** at first login. **Personal ⇒ 30-day open-app** (no PIN). **Shared ⇒ PIN every session.** |
| 4 | Who sets what? | Admin sets **name + phone + role** only. The person proves themselves by code; a **PIN is set on first shared-device use**. |
| 5 | Rollout | Behind a `FEATURES` flag; build/test with shared passwords intact, then flip. |
| 6 | Onboarding at the flip | **Blast verify texts + self-serve fallback.** |
| 7 | Add-button label | **"+ Employee"**. |
| 8 | SMS provider | Existing send path — **Twilio-live (v92)**, Mocean fallback. |

**Open for Jac (non-blocking):** (a) PIN set on first shared-device use vs. at enrollment —
default is first-use; (b) admin can pre-designate the office PC as "shared" server-side vs.
self-declared only — default is self-declared (§5.9).

---

## 11. Risks & honest edges

- **Real backend auth code** (code/PIN storage, hashing, expiry, attempt caps, device-trust,
  remove-cascade, server-side tier gate) → a **backend deploy with Jac's editor go-live**. Stays
  on the main session; security-reviewed. Biggest, least-reversible piece.
- **Self-declared "shared?"** is spoofable by a dishonest user (§5.9) — mitigated by the optional
  admin override; acceptable for the internal honest-employee threat model.
- **Shared-machine PIN** is shoulder-surfable like any PIN — mitigated by attempt caps + culture;
  still far better than today's one shared password.
- **Personal phone accuracy is load-bearing** — a wrong roster phone = no verification; validate,
  and admin re-send fixes it.
- **Retiring shared passwords** (final backend step) is the point of no return for flag-backout —
  do it only once everyone's confirmed across.

---

## 12. Decisions log (chronology)

1. **2026-07-13** seed: admin adds name + phone + pw; auto-text; device remembers; 30-day
   re-auth; self-serve reset; different credential re-binds the device. Landed on **user-set
   password + texted link** (Option 1), "+ Employee", blast + self-serve, "Remember me" split.
2. Spec lost with its unpushed branch; **restored 2026-07-14**.
3. **2026-07-14 evolution (Jac):** preferred the simpler **phone-code** model, no passwords;
   raised the "coworkers know the numbers" hole; chose the **hybrid** fix →
   **device-type question: personal = 30-day open-app, shared = PIN every login.**
4. Default baked in: **PIN set on first shared-device use** (personal-only hands never set one).
5. Twilio-live folded in as the send path.

---

## 13. Next step

On Jac's confirmation this revision reads right → invoke **`writing-plans`** for a phased plan
(flag-gated frontend + additive backend auth, with the security review and the Jac editor
go-live as explicit gates). No code until the plan is signed off.
