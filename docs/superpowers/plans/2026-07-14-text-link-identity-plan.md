# Implementation Plan — Phone-Verified Device Identity (per-person staff logins)

Spec: `docs/superpowers/specs/2026-07-13-text-link-identity-design.md`
Branch: `claude/zen-mayer-r2rdgw`

**What ships:** the shared role-passwords are replaced by per-person logins — identity =
a roster person, verified by a one-time SMS code; a **personal** device is trusted 30 days
(login = open the app), a **shared** device takes a **PIN** each session. No passwords. Behind a
`FEATURES` flag; the **backend enforces auth independently** of the flag.

**Security discipline (applies to every phase touching auth):** credential/PIN/code storage +
hashing, one-time/expiry, attempt caps, roster-only sends, the remove-cascade, and the
server-side per-person tier gate are authored and reviewed **on the main session** (never
delegated) and get a dedicated **security review** before the backend go-live. The backend is
the gate — **never** gate an auth check on `FEATURES` (`config.js:609`).

**Backend deploy path:** additive `Code.gs` handlers are authored as a tracked handoff `.gs`,
pushed via the **service-account** path (`docs/handoffs/gas-deploy-service-account.mjs`,
`GAS_IMPERSONATE_SUBJECT=operations@jacrentals.com`), and taken live by **Jac's Apps Script
editor deploy** — a REST deploy breaks anonymous web-app access. This is a **STOP gate** every
time (`/clasp`). `Code.gs` stays gitignored (public repo).

Gates after every code phase (port 8000 reserved → swap to 9147, then restore):
```
sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs
node ci/smoke.mjs && node ci/logic-test.mjs && node ci/gen-rule-usage.mjs --check \
  && node ci/check-window-catalog.mjs && node tools/gen-code-map.mjs --check
git checkout -- ci/
```

---

## Phase 0 — `config.js`: the feature flag

- Add `FEATURES.phoneIdentity = false` (default OFF) beside the existing `flagOn()` reader
  (`config.js:617`).
- Add any shared client constants (code length, PIN length min, personal-trust window = 30d,
  code TTL ≈ 10 min, link TTL ≈ 45 min) as plain non-secret config.
- **Verify:** gates green. **Commit:** "Phone identity: FEATURES flag + client constants".

## Phase 1 — Backend: private credential store + auth actions (SECURITY-CRITICAL)

Authored in a tracked handoff (`docs/handoffs/phone-identity-backend.gs`); additive to the
`doGet`/`doPost` router so **old clients and the shared-password path keep working unchanged**
while the flag is off (back-compat, mirrors the role/team-chat backends).

- **Private store** (Script Properties, or a locked Sheet tab the web app **never** returns in
  `load`): `enrollment{personId, phoneE164, pinHash|null, pinSetAt, tierAtLogin, active}`,
  `loginCode{codeHash, personId, purpose, expiresAt, usedAt, attempts}`,
  `deviceTrust{deviceTokenHash, personId, expiresAt}`. Codes/PINs stored **hashed only**.
- **Actions:**
  - `authStart({phoneOrName, purpose})` — resolve the roster person **server-side**, mint a
    one-time code, send it via the **roster-scoped** staff SMS (Phase-1b), rate-limited, **no
    valid/invalid disclosure** (anti-enumeration).
  - `authVerify({personId|phone, code, deviceKind, deviceId})` — validate + **burn** the code;
    `personal` → issue a 30-day `deviceTrust` token + return `{identity, tier}`; `shared` →
    session only (no trust). Returns `pinSet:bool` so the client knows whether to prompt set-PIN.
  - `authSetPin({personId, pin, proof})` — requires a fresh verified code/session; writes
    `pinHash`; enforces min length.
  - `authLoginPin({personId, pin})` — shared-device session; verifies `pinHash` with an
    **attempt cap + lockout**; returns `{identity, tier}`.
  - `authResume({deviceToken})` — validate a trusted personal device (≤30d) → `{identity, tier}`;
    at expiry require a fresh code.
  - `authRevoke({personId})` — wipe `enrollment` (incl. `pinHash`) + all `deviceTrust` + pending
    `loginCode` (the roster-remove cascade + "sign out everywhere").
- **Per-call authorization:** accept a **session/device token** on each request that resolves to a
  person + tier server-side (the new equivalent of today's shared-password check). Keep the legacy
  shared-password acceptance in parallel until Phase 5. Money/admin gates compare **tier**
  (`tierRank`) keyed to the authenticated person.
- **1b — roster-scoped send helper:** reuse `sendStaffMessage_`'s roster-phone resolution
  (backend v99) or add `sendAuthCode_(personId, text)` over the same low-level Twilio call; the
  destination is **always** the roster record server-side (never client-supplied), and it
  **skips the 8pm–8am quiet-hours** block the marketing pipe respects.
- **Security review** (main session) → **STOP gate** → service-account push → **Jac editor
  go-live**. Confirm end-to-end with a real test text to a test roster entry.
- **Verify:** local gates green (frontend unaffected while flag off). **Commit (docs/handoff
  only):** "Phone identity: backend auth store + actions (handoff .gs; deploy via SA + editor)".

## Phase 2 — Frontend: the flagged login flow (`/jactec-ui`)

Behind `flagOn('phoneIdentity')`; the shared-password `renderLogin`/`attemptLogin`
(`app.js:23465`/`23594`) stays as the flag-off path.

- **Unrecognized device:** identify (phone or roster name-pick) → **code entry** → **"Is this a
  shared device?"** →
  - **Personal** → store the returned device token; trusted 30 days; land logged-in.
  - **Shared** → if `pinSet=false`, "Set your PIN" step; then **PIN pad** each session
    (name-pick + PIN), sign out on done.
- **Trusted personal device:** `authResume` on boot → "Welcome back, `<name>`" → straight in;
  fresh-code prompt at day 30.
- **"Need a code?"** self-serve reset affordance on the login screen.
- Replace the per-call `backendPassword` with the **session/device token** when the flag is on;
  `currentRole`/`currentUser`/`myRosterId` now come from the verified identity (not a typed name).
- **Design language:** run `/jactec-ui`; keep the yard data-plate look (rivets, hazard-stripe,
  Saira Condensed, "Saddle Up?"); stamp new elements `data-r`; new popups (code entry, "shared?"
  prompt, PIN pad, set-PIN) get `WINDOW_CATALOG` entries; `node ci/gen-rule-usage.mjs` (regen).
  Screenshot + self-critique before showing Jac.
- **Verify:** gates green (flag on **and** off). **Commit:** "Phone identity: flagged login flow
  (code verify + device-aware + PIN)".

## Phase 3 — Team Roster becomes the login list (`/jactec-ui`)

- Rename the add button **"+ Hand" → "+ Employee"** (`app.js:4686`).
- Role field drives the **permission tier**; **phone** becomes load-bearing — validate + E.164
  normalize on save.
- Per-person admin actions (admin-tier only): **Re-send code**, **Sign out everywhere**
  (`authRevoke` devices), **Remove** → the full `authRevoke` cascade with a clear warning.
- Stamp `data-r`; regen rule-usage; no new popup expected (pane lives in existing Settings
  window) — confirm `check-window-catalog`.
- **Verify:** gates green. **Commit:** "Phone identity: roster = login list (+ Employee, phone
  validation, per-person revoke)".

## Phase 4 — Cutover tooling

- **Blast verify texts:** one admin action fires each rostered person a welcome/verify text
  (roster-scoped send, quiet-hours-skipped), so a flag flip onboards everyone at once.
- **Self-serve fallback** already exists from Phase 2 ("Need a code?").
- Pre-flip checklist surfaced in-app: every active person has name + phone + role.
- **Verify:** gates green. **Commit:** "Phone identity: cutover blast-verify + pre-flip check".

## Phase 5 — Deferred: retire the shared passwords (backend, point-of-no-return)

Once everyone is confirmed across (flag ON, all rostered people enrolled): a small backend change
**removes the shared-password acceptance** so "off" is truly off — done **only on Jac's call**,
because it ends the flag-backout escape hatch. Service-account push → Jac editor go-live (STOP
gate). Non-blocking for the feature landing.

## Phase 6 — Ship

- Bump the shared `?v=` cache-bust token on `style.css` / `rule-usage.js` / `app.js` in
  `index.html`.
- Final gates green.
- **Staging review (`/deploy`):** deploy the feature branch; verify the live staging bytes;
  drive the **flagged-ON** login end-to-end via Claude-in-Chrome — enroll a test person, verify
  by code, personal 30-day path, shared-device PIN path, self-serve reset, remove→revoke. No
  console errors; screenshot for the handoff. (Backend must be live for a real staging test.)
- **Gate 1 "merge it" (`/merge`):** PR #632 → `smoke` CI → squash-merge to `trunk` (flag OFF,
  so nothing changes for anyone).
- **Gate 2 "promote it" (`/promote`):** Jac's explicit call; go live with the flag still OFF.
- **Flip the flag** (config change, its own tiny ship) when Jac is ready to cut the team over —
  with blast-verify + self-serve as the on-ramp and flag-OFF as the instant backout.

---

## Sequencing notes

- **Backend (Phase 1) is the long pole** and blocks a real Phase-2/6 test — but Phases 2–4 can be
  **built** against a stubbed backend and only need the live deploy for the staging drive.
- **Nothing changes for the team until the flag flips** — every phase lands dormant behind
  `FEATURES.phoneIdentity=false`.
- **No code begins until Jac signs off this plan** (per the brainstorming gate).
