# Text-Link Identity — per-person staff logins (SMS setup/reset) — DESIGN

**Topic:** Replace the shared role-passwords with per-person staff logins. Identity =
a roster person (name + phone + role); the person sets their **own** password via a
one-time **texted link**; the device remembers them for 30 days; self-serve reset by text.

**Status:** Design — **approved section-by-section by Jac** (Sections A–D all locked). Ready
for `writing-plans` once Jac confirms this reconstruction is faithful.

**Original date:** 2026-07-13 (brainstormed + approved with Jac).
**Reconstruction note (2026-07-14):** The original spec was written to branch
`claude/team-roster-roles-logins-e4cio2` (commit `f77c162`) in a cloud session that was
reclaimed **before the branch was pushed** — the file never reached GitHub (`422 No commit
found`), so it was lost. This file faithfully restores the approved design from the session
transcript, and folds in the one change since 2026-07-13: **Twilio is now the live SMS
provider (backend v92, 2026-07-14)** — the send plumbing this feature was "waiting for" is
in place. Everything else is as Jac approved it.

---

## 0. Why (the problem)

Today a "login" is a **shared role-password**: one `Office` password, one `Sales` password,
etc., shared by everyone in that role (`{ RoleName: password }` map + tier ladder;
`roleForPassword(pw)` on the backend returns a role/tier — the password *is* the credential
and the tier). Identity is only a **free-text "Operator" name** typed at login and matched to
a roster person by case-insensitive name (`myRosterId()`, `app.js`) — anyone can type any name.

Three things Jac wants gone, and this design removes all three:

1. **Making & handing out passwords** — gone. The admin never sets or sees a password; the
   person sets their own from a texted link.
2. **Password resets** — gone from the admin's plate. A user self-texts a fresh link from the
   login screen; the admin is never in the loop.
3. **Who's who** — the **phone number is the identity**. No fuzzy name-matching; add/remove is
   one roster entry, and every action is attributable to a real person.

This is the well-proven **phone-number-as-identity + texted setup/reset link** pattern
(WhatsApp / Signal / much of SaaS onboarding), adapted to a single-team app.

---

## 1. Section A — Identity & roles (the core reframe)  ✅ approved ("Yes, that's it")

Flip where the credential lives:

- **People hold the logins.** Each person is **name + phone + role + their own password**. The
  **Team Roster becomes the actual list of who can log in** — not a side list anymore. (Today's
  roster row is `settings.employees[] = { id, name, role, phone, note }`, rendered at
  `app.js:4686`; this design promotes it to the identity source of truth and adds credentials
  in a *separate* store — see §2.)
- **Roles stop having passwords.** A role becomes purely **"what this person can see and do"** —
  its permission **tier** on the existing ladder (`ROLE_TIERS`, `config.js:331`:
  staff → money → manager → admin → developer) **plus which KPI rings show**. When you add
  someone you pick their role, and that sets their powers. **Same ladder, attached to the person
  instead of a shared password.**
- **Clean two-place split:**
  - **Visible roster** (name, phone, role, note) — stays in the normal Settings → Team Roster
    pane, editable as today.
  - **Secrets** (the password, **hashed**, and the login/setup tokens) — live **only** in a new,
    locked-away backend store that the login check reads and that **never gets sent to any
    device**. (Explicitly NOT the synced settings/config bundle — that bundle is broadcast to
    every device that opens the app, so putting a password there would broadcast everyone's
    passwords. See §5.)

So: **add a hand** = add a person to the roster with phone + role → they set their own password
from the text. **Someone leaves** = remove them from the roster → this also kills their login and
any remembered device.

---

## 2. Data model

**Visible (synced, non-secret) — `settings.employees[]` (existing, extended):**
```
{ id, name, phone, role, note }          // role now drives the permission tier + KPI rings
```
No credential or token fields here. This is what renders in Settings and syncs to devices.

**Secret (backend-only, NEVER synced) — new private store (Script Properties or a locked Sheet
tab the web app never returns in `load`):**
```
credential:  { personId, phoneE164, passwordHash, passwordSetAt, tierAtLogin }
setupToken:  { tokenHash, personId, purpose:'enroll'|'reset', expiresAt, usedAt|null }
device:      { deviceToken(hashed), personId, rememberMe:bool, issuedAt, expiresAt(+30d) }
```
- Passwords stored **hashed only** (never reversible). Tokens stored as **hashes** of the raw
  value (raw is only ever in the texted link, single-use).
- Keyed by `personId` = the roster `employee.id`. Removing the roster row triggers a cascade
  delete of the person's `credential` + all `device` rows + any pending `setupToken` (§5).

---

## 3. Section B — the three everyday flows  ✅ approved (with "+ Employee" label)

### 3.1 Adding a hand (enrollment)
Settings → **Team Roster → "+ Employee"** (button label changes from today's **"+ Hand"** at
`app.js:4686`) → type **name, phone, role** → **Save**. The backend texts them a **one-time link
(~45 min expiry)**. They tap it → land on a **"Set your password"** screen → pick their password →
they're in. **The admin never sees or touches the password.** If the link goes stale before use,
one tap **re-sends** a fresh one.

### 3.2 Signing in day-to-day
- **Own phone (Remember me ✓):** after first setup, the app **greets them by name, no typing** —
  straight in. Every **30 days** it asks for their **password once more** (still knows who they
  are — **no name entry**), then remembers again.
- **Shared office computer (Remember me ✗):** one machine can't "remember" five people, so they
  **pick their name from the roster list + enter their password each session**, and it **signs
  them out when done**. This is the one spot the "no typing" magic doesn't fully apply — a
  deliberate trade so the **audit trail stays correct**.
- **New / handed-off device:** signing in as a **different person** (name/phone + password)
  **re-binds the device to them** going forward ("same cycle continues").

### 3.3 Forgot password (self-serve, no admin)
Right on the login screen: **"Need a link?"** → they enter their **phone (or pick their name)** →
the backend texts a **fresh one-time link** → they set a new password. The admin is never
involved. **Safety catch:** links only ever send to a number **already on the roster**, so no
stranger can fish for one.

---

## 4. Section C — the cutover (behind the `FEATURES` flag)  ✅ approved (blast + self-serve)

Ships as a **big replacement behind a `FEATURES` flag** (`config.js:617`, `flagOn()` reader —
the standard additive/default-OFF pattern; see the header warning at `config.js:609`).

- **Flag OFF (build + test):** nothing changes for anyone — shared role-passwords keep working
  exactly as today. The new per-person system sits dormant; Jac can test his own per-person login
  before anyone else sees it.
- **Before the flip:** make sure every active roster person has **name + phone + role** filled in
  (they already have name + role — this is really just **adding phones**).
- **Flip the flag ON = cutover.** The login screen switches to per-person mode for everyone. To
  move people onto their accounts:
  - **Blast the setup links** — one action texts **every rostered person** their one-time link at
    once; they tap, set a password, done. *(Chosen default — proactive.)*
  - **Self-serve fallback** — anyone who misses their text taps **"Need a link?"** at the login
    screen (their phone is already on the roster). *(Always-on safety net.)*
- **Backing out:** if anything looks wrong right after flipping, **flip the flag back OFF** →
  everyone is instantly back on the shared passwords; their new accounts stay set up for the next
  go. (This is exactly why we build behind the flag.)
- **Once everyone's across:** a final small backend change **retires the shared passwords for
  good**, so "off" is truly off — not just hidden by the toggle. **The flag is a UX switch, not
  the security lock** (§5).

---

## 5. Section D — safety rails  ✅ approved (password only, no PIN)

Mostly non-negotiable engineering musts — they're what makes this trustworthy:

1. **Passwords are hashed, never stored readable** — not by anyone peeking the backend store. The
   **phone is the recovery path**.
2. **Setup/reset links are one-time and expire (~45 min).** A forwarded or stale text can't be
   reused to grab an account (stored as a hash; `usedAt` burns it on first use).
3. **Removing someone cuts them off completely and immediately** — their password, **every**
   remembered device, and any pending link all die the moment they're removed from the roster.
4. **Links only ever text a number already on the roster** — no stranger can fish for one.
5. **Login & reset texts skip the 8pm–8am quiet hours** — they send right away; only
   marketing-type texts wait for morning (see §7).
6. **The flag is not the lock.** The **backend authenticates every login on its own**; nobody can
   flip a client-side setting in their browser to sneak in. (Never gate an auth check on
   `FEATURES` — `config.js:609` says exactly this.)
7. **The 30-day "remember me" is a revocable token** — Jac (or a leaving employee) can be
   **signed out everywhere on demand** (revoke = delete the `device` rows).
8. **Passwords have a sensible minimum length**, and each person picks their own. **Decision:
   password only — no PIN option** (Jac, approved).

---

## 6. Backend contract (new — additive)

New **server-side** work (this is a genuine auth feature; unlike the 2026-06-26 role redesign it
**cannot** avoid the backend). All additive `Code.gs` actions, deployed via the service-account
push path + **Jac's editor go-live click** (per `/clasp`):

- `enrollStart(personId)` — admin-tier only; mints an `enroll` setup token, texts the link. Also
  the "blast all" variant for cutover (§4).
- `setupPassword(token, newPassword)` — validates + burns the token, writes the hashed password,
  returns a device/session token (respecting `rememberMe`).
- `login(phoneOrPersonId, password, rememberMe)` — verifies against the hashed credential, returns
  the person's identity + **tier** (this replaces `roleForPassword` for flagged-on clients) + a
  device token if `rememberMe`.
- `resendSetup(personId)` / `requestReset(phoneOrPersonId)` — roster-scoped; self-serve reset.
- `resumeDevice(deviceToken)` — validates a remembered device (≤30d), returns identity; prompts
  for password at day 30.
- `revokePerson(personId)` — the remove-cascade (credential + devices + pending tokens).
- **Tier enforcement moves server-side per person:** the login response carries the person's tier;
  money/admin gates compare **tier** (as they already do — `tierRank`), now keyed to the
  authenticated person rather than a shared password.

**Auth-gate discipline (stays on the main session):** credential storage, hashing, token
minting/expiry, roster-only sends, and the remove-cascade are security-critical — authored and
reviewed on the main session (never delegated), with a security review before deploy.

---

## 7. SMS send path (the "waiting for Twilio" piece — now unblocked)

**The plumbing already exists** and, as of **2026-07-14, Twilio is live (backend v92)** as the
primary provider (`provider:twilio, status:sent` confirmed end-to-end), with **Mocean as
fallback**. So there is **no new service to sign up for and no new bill** — enrollment/reset texts
ride the existing send path. *(The original 2026-07-13 spec referenced Mocean because that was the
live adapter that day; Twilio going live the next day is precisely what let us resume.)*

Two implementation musts on top of the existing pipe:

- **Use the roster-scoped staff send, not the customer send.** `sendCustomerMessage_` is bound to
  **customer isolation** (it resolves the recipient from a *customer* record and ignores a
  client-supplied destination), so it **cannot** text an arbitrary roster phone. The
  **roster-isolated staff path** (`sendStaffMessage_`, backend v99) already resolves a **roster
  person's** phone — enrollment/reset links ride that (or a small dedicated `sendAuthLink_`
  helper reusing the same low-level Twilio HTTP call). The destination is **always** taken from
  the roster record server-side, never from the client (rail #4).
- **Bypass quiet hours.** The marketing/customer pipe blocks 8pm–8am; a login/enrollment/reset
  link is transactional and time-sensitive, so it **sends immediately** (rail #5).

---

## 8. Frontend changes (all through `/jactec-ui` when built)

- **Login screen (flag ON):** replace the single shared-password box with per-person mode —
  remembered greeting ("Welcome back, <name>") / name-pick on shared machines, a **"Remember me"**
  checkbox, a **"Need a link?"** reset affordance, and a **"Set your password"** screen for the
  token landing. Keep the yard data-plate language (rivets, hazard-stripe, Saira Condensed,
  "Saddle Up?" ignition). New popups get `WINDOW_CATALOG` entries; new elements get `data-r`
  stamps.
- **Team Roster pane:** button label **"+ Employee"**; role field drives the permission tier;
  phone becomes load-bearing (validation + E.164 normalize). Add per-person **"Re-send link"** /
  **"Sign out everywhere"** / remove (with the cascade warning).
- **Flag reader:** `flagOn('textLinkIdentity')` (or similar) gates the login experience only —
  never the auth check.

---

## 9. Non-goals

- Not the **Customer Portal** (external, row-isolated customer auth — separate `customer-portal`
  spec, magic-link only). This is **staff/internal** login.
- No **PIN** option (password only, decided).
- No change to *what* the tiers can do — only *how a person acquires a tier* (their own role
  instead of a shared password).
- No SSO / OAuth / third-party identity providers.

---

## 10. Resolved decisions (were open questions)

| # | Question | Decision |
|---|----------|----------|
| 1 | Keep a password, or go fully passwordless? | **Keep a password** (Option 1): set once via texted link, re-entered every 30 days. |
| 2 | Who sets the password? | **The user**, from the texted link — admin never sees it. |
| 3 | Admin sets role at add-time? | **Yes** — name + phone + **role/tier** at "+ Employee". |
| 4 | Shared-machine identity risk | **"Remember me" checkbox** — ticked on personal phones (30d), unticked on shared machines (name-pick + password each session, sign out when done). |
| 5 | Rollout | **Behind a `FEATURES` flag**; build/test with shared passwords intact, then flip. |
| 6 | How to move people at the flip | **Blast setup links + self-serve fallback.** |
| 7 | PIN option? | **No — password only.** |
| 8 | Add-button label | **"+ Employee"** (not "+ Hand"). |
| 9 | SMS provider | Rides the **existing send path — Twilio-live (v92), Mocean fallback**; no new service/bill. |

---

## 11. Risks & honest edges

- **This needs real backend auth code** (credential storage, hashing, tokens, device-remember,
  remove-cascade) → a **backend deploy with Jac's editor go-live click** at the end. Stays on the
  main session; gets a careful security review. Biggest, least-reversible piece.
- **Shared office machine** remains the soft spot even with "Remember me ✗" — mitigated by
  name-pick + per-session password + sign-out-on-done, and optionally a shorter timeout / "Signed
  in as <name> — not you?" nudge.
- **Retiring the shared passwords** (the final backend step) is the point of no return for
  backing out via the flag — do it only after everyone's confirmed across.
- **Phone accuracy is load-bearing** — a wrong roster phone = that person can't enroll/reset.
  Validate + normalize; the admin re-send is the fix.
- **Token/link security** — one-time, short expiry, hashed at rest, roster-only destination; brute
  force on `login` needs an attempt cap (reuse the comms issuance throttle pattern).

---

## 12. Decisions log (chronology, from the 2026-07-13 brainstorm)

1. Jac's seed idea: admin adds name + phone + pw; user gets an auto-text; device remembers them;
   30-day re-auth; self-serve reset link; different password re-binds the device.
2. Refined: **admin does NOT set the password** — the user sets it from the texted link, so the
   admin genuinely never touches it. **Role/permissions added at add-time** (the missing field).
3. Chose **Option 1** (keep a password) over fully passwordless.
4. **Roles carry the tier + KPI rings; people carry the login** (Section A). ✅
5. Three flows (enrollment / daily sign-in / self-serve reset) ✅; button = **"+ Employee"**.
6. Cutover behind the flag; **blast links + self-serve fallback** ✅.
7. Safety rails ✅; **password only, no PIN**.
8. Reconstructed 2026-07-14 after the original branch was lost unpushed; **Twilio-live** folded in.

---

## 13. Next step

On Jac's confirmation that this reconstruction is faithful → invoke **`writing-plans`** to turn it
into a phased implementation plan (flag-gated frontend + additive backend auth, with the security
review and the Jac editor go-live as explicit gates). No code until the plan is signed off.
