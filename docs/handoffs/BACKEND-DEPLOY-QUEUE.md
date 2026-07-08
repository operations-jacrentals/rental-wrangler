# Backend deploy queue — DEPLOYED (2026-07-06 late session); doc kept as the deploy runbook

> **STATUS UPDATE (2026-07-06 ~23:00):** the queue below IS LIVE (perfReport + unitDaily
> + the trigger installed by Jac), plus the comms pipe (sendCustomerMessage SMS+email,
> messagesFor, commsAliases, adminSetProps) — prod versions v66–v70. Deploys now run
> **via the Apps Script REST API** (SA + impersonation, versions.create → deployments.update
> with full deploymentConfig, immediate JSON probe) — see /clasp SKILL.md §AMENDED. The
> editor click is the FALLBACK/recovery path, no longer the only go-live.

## ✅ DEPLOYED — team-chat privacy (2026-07-08, Jac editor deploy)
- **What:** `getChats_` / `setChats_` replaced with scoped + authorized versions (+ helpers
  `chatCanSee_` / `chatMergeMsgs_` / `chatMergeSeen_` / `chatAuthorizeWrite_`). Team-chat
  membership is now a real server-side boundary (reads scoped to admin+members; writes
  authorized — a non-member can't inject/tamper, only self-leave + own view-state). Spliced
  from `docs/handoffs/team-chat-privacy-backend.gs` (adapted to the live `tryLock_`).
- **Deploy:** SA `push` HEAD (service account) → Jac editor **New version** deploy. **Verified:**
  auth-rejection POST → `{"ok":false,"error":"unauthorized"}` (anonymous access intact, JSON not
  403/HTML); `getChats` with a bad password → `unauthorized` (gated, no chats leaked).
- **Client side:** shipped on `claude/internal-chat-updates-vq6p7b` (sends `me`/`rosterId`;
  prunes scoped-out chats live). Back-compat: absent `body.me` = old client → prior behavior,
  so the current live frontend keeps working; scoping activates once the new frontend ships.
- **Caveat:** identity is client-asserted (gated behind the team password) — a real filter,
  not a crypto boundary; true per-person privacy needs per-user auth.

## ✅ STATUS 2026-07-06: queue DEPLOYED (prod version 62)
- **perfReport** — DEPLOYED. Router + `perfReport_` handler live; verified end-to-end (a
  synthetic POST landed a `_perf` row with the correct 11 columns). Client flush still lives
  only on `build/areas-sprint`, so organic rows begin once that frontend ships to prod.
- **unitDaily** — was ALREADY live (@57, 2026-07-03); the live `Code.js` was byte-identical
  to `unit-daily-snapshots.gs`, so nothing to re-splice. (Confirm `installUnitDailyTrigger()`
  has been run once in the editor if no `unitDaily` rows are accruing.)

## ⛔ HOW to deploy this web app (learned the hard way, 2026-07-06)
The Apps Script **REST API can `push` but CANNOT `deploy`** this web app: updating the
deployment via the API **breaks its anonymous access** — the entryPoint still reports
`ANYONE_ANONYMOUS` but the `/exec` URL 403s ("Access Denied — you need access") for anonymous
callers, i.e. **the whole live backend goes DOWN**. An API rollback does NOT fix it. This
took prod down briefly on 2026-07-06; recovery was an **editor** redeploy.
**The deploy recipe that works:**
1. `push` HEAD via the service account (safe — content only) — see the flow below.
2. **Deploy from the Apps Script EDITOR**: open the project → Deploy → Manage deployments →
   Edit the prod deployment → **New version**, Execute as **Me (operations@jacrentals.com)**,
   Who has access **Anyone** → Deploy. Same exec URL; anonymous access preserved.
   (The `deploy` subcommand in `gas-deploy-service-account.mjs` is now GUARDED against this.)

### Auth for `push`: service account + DOMAIN-WIDE DELEGATION (configured 2026-07-06)
A bare service account can't call the Apps Script API (its per-user API toggle can't be set
for a SA identity → 403 "User has not enabled the Apps Script API", even with the project API
on). Fix in place: the SA (`clasp-deployer@rental-wrangler-deploy.iam.gserviceaccount.com`,
client_id `108241190981526622554`) has **domain-wide delegation** for the four `script.*` /
`drive.file` scopes, and `push` impersonates a real user via `GAS_IMPERSONATE_SUBJECT`:
```bash
GAS_SA_KEY_B64=... GAS_IMPERSONATE_SUBJECT=operations@jacrentals.com \
  node docs/handoffs/gas-deploy-service-account.mjs push
```
`operations@jacrentals.com` must have the Apps Script API toggle on at
script.google.com/home/usersettings (it does) and edit access to the script (it owns it).

## Auth status (2026-07-06): clasp's user-OAuth is BLOCKED by Google's RAPT re-auth policy

Confirmed with a **brand-new** OAuth consent (not a stale token) — it fails
`invalid_grant / invalid_rapt` on the very first call. This is Google Workspace enforcing
a re-authentication policy on the `cloud-platform` scope for the `jacrentals.com` domain;
it's enforced server-side per-call and a CLI's refresh-token flow can never satisfy it.
**Re-running `clasp login` will not fix this** — don't retry it.

### The real fix — a SERVICE ACCOUNT (JWT auth, not subject to RAPT), Jac in progress

1. GCP project with the **Apps Script API** enabled.
2. A service account + JSON key in that project.
3. The Apps Script project's GCP link pointed at that project (script editor → ⚙️ Project Settings → GCP Project → Change project).
4. The Apps Script file shared with the service account's email as **Editor**.
5. The key, base64'd (`base64 -w0 keyfile.json`), set as the **`GAS_SA_KEY_B64`** env secret (never in chat/repo).
6. Start a fresh cloud session and say "deploy the backend queue" — it drives `docs/handoffs/gas-deploy-service-account.mjs` (push + deploy via the Apps Script REST API directly, no clasp involved).

### Fallback if the service-account setup stalls: deploy by paste

The Apps Script web editor always works regardless of any of the above —
https://script.google.com/d/1hw9A7Id3YIoiSCBkNFeDaKGRv-VtljFFIuBdQG5QULrgS0DjQhQ_2vyZ/edit
→ paste the spliced `Code.js` → Deploy → Manage deployments → Edit the existing deployment → New version. Slower, zero dependency on OAuth/service-account plumbing.

### (Historical — clasp user-OAuth re-arm, superseded by the service account above)
1. `npx @google/clasp login` (browser OAuth as operations@jacrentals.com) — **will hit invalid_rapt immediately per the above; kept only for reference if Google's policy ever changes**
2. `base64 -w0 ~/.clasprc.json` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\.clasprc.json"))`)
3. Paste the output into the **`CLASPRC_JSON_B64`** environment secret (Claude Code env settings — never into chat/repo)
4. Start a **fresh cloud session** (secrets inject at session start) and say "deploy the backend queue"

## The queue (all ADDITIVE — splice into Code.gs, one push, one redeploy)

| # | Item | Source | Wire-up | Status |
|---|---|---|---|---|
| 1 | **perfReport** — Web-Vitals sink → `_perf` tab (5k-row FIFO, metrics-only by construction) | `perf-report-backend.gs` | `if (action === 'perfReport') return json(perfReport_(body));` (wrap in `json()` — `handle()` must return a ContentService output, not the bare `{ok:true}` the source's comment shows) | ✅ DEPLOYED @62 (2026-07-06) |
| 2 | **unitDaily snapshots (M4)** — daily unit hours/fleet-status history | `unit-daily-snapshots.gs` | router line per that file + run `installUnitDailyTrigger()` ONCE | ✅ Already live @57 (2026-07-03) |

Deploy flow (same deployment id, same exec URL). **`push` via the API, then deploy from the
EDITOR** — the API `deploy` breaks anonymous access (see the ⛔ section above):
```bash
npm i --no-save googleapis   # ephemeral, not committed
#  pull the LIVE Code.js first (projects.getContent via the SA, or the web editor / Drive API
#  — Code.js is not in git), splice the .gs addition(s) into ~/rw-backend/Code.js, node --check.
GAS_SA_KEY_B64=... GAS_IMPERSONATE_SUBJECT=operations@jacrentals.com \
  node docs/handoffs/gas-deploy-service-account.mjs push
#  then: Apps Script editor → Deploy → Manage deployments → Edit prod → New version,
#        Who has access: Anyone → Deploy.
```
Verify (anonymous, no secret needed — a wrong password returns JSON, proving the exec URL
serves anonymously again after the editor deploy):
`curl -sS -L -H 'Content-Type: text/plain;charset=utf-8' --data '{"action":"auth","password":"__wrong__"}' "$EXEC_URL"`
→ expect `{"ok":false,"error":"unauthorized"}` (HTML/403 = anonymous access still broken).
For a write path, POST the new action with a role password and read the tab back.

## NOT in the queue (bigger, later)
- Collections Phase-2 outbound (`collectionsSend` + agency token) — needs the vendor pick first (spec collections OQ-13)
- Views getViews/setViews — retired client-side; the actions can stay deployed, harmless
- Per-role passwords / tier gates — **already live** (`role-tiers-backend.gs`, deployed 2026-06-26 era); the specs' "backend-data OQ-1 blocker" is narrower than written: what remains is per-ACTION tier maps for the new Phase-2 actions when they land

## Standing rule
Every deploy here is `/clasp` STOP-gated — Jac's explicit go before `clasp deploy`, every time.
