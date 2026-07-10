# Backend deploy queue — DEPLOYED (2026-07-06 late session); doc kept as the deploy runbook

> **STATUS UPDATE (2026-07-06 ~23:00):** the queue below IS LIVE (perfReport + unitDaily
> + the trigger installed by Jac), plus the comms pipe (sendCustomerMessage SMS+email,
> messagesFor, commsAliases, adminSetProps) — prod versions v66–v70. Deploys now run
> **via the Apps Script REST API** (SA + impersonation, versions.create → deployments.update
> with full deploymentConfig, immediate JSON probe) — see /clasp SKILL.md §AMENDED. The
> editor click is the FALLBACK/recovery path, no longer the only go-live.

## ⏳ PUSHED, AWAITING EDITOR DEPLOY — 10 medium audit fixes (2026-07-09)
- **What:** 10 of the 16 MEDIUM findings from the backend audit, auto-fixed per Jac's "fix the
  mechanical ones" call. Full detail in `docs/handoffs/backend-audit-2026-07-09-medium-fixes.gs`:
  - `wrangler` + `adminSetProps` added to WRITE_ACTIONS (were GET-reachable)
  - `deformula_()` formula-injection guard added to: `feedback_`'s type field, `setChats_`'s id,
    `setWranglerRail_`'s id, `writeRecord_`/`doSeed`/`doSync`'s id column (every sync/seed write),
    and `perfReport_`'s `t1()` (this one was already written+queued once before but never
    actually deployed — now actually live)
  - Lock added around `getConfigObj()`/`backfillRoles_`'s writes and
    `stripeSetDefault_`/`stripeRemoveCard_`'s read-modify-write
  - **⚠ Bigger than the others:** `sendCustomerMessage_`'s SMS daily-cap race needed a real
    restructure (reserve-then-send-then-finalize under a lock, since holding the lock across the
    Twilio/Mocean/Gmail network call would violate this file's own lock discipline) — worth an
    extra look before deploying, not a one-liner like the rest.
- **Pushed to HEAD** (service account, content-only), confirmed present, `node --check` passes.
- **Not yet deployed** — awaiting Jac's go, same editor flow as the previous two batches.
- **✅ Remaining 6 mediums — all fixed, pushed to HEAD, node --check passes.** Full detail in
  `docs/handoffs/backend-audit-2026-07-09-final-6-fixes.gs`:
  - `getConfigObj()` no longer wipes all custom role passwords when `admin` is falsy but `roles`
    is intact — repairs just `admin`, matching the file's own stated intent.
  - Invoice price-lock seal now pins the customer's `salesTaxExempt` flag too (frozen into
    `inv.taxExempt` at first-charge time, not a signature-format change — doesn't affect any
    already-locked invoice's seal check).
  - `membershipActivate_`'s Stripe idempotency key dropped its calendar-day scoping (was creating
    real duplicate subscriptions on a retry that crossed midnight).
  - `stripeRefundInvoice_` now walks ALL charges on a multi-charge invoice for a "full" refund
    instead of capping at just the last one (was silently under-refunding).
  - `wranglerReply_` + `wranglerFile_` gain a shared **global 100/day** cap (Jac's call — one
    combined counter, not per-role, tunable via `WRANGLER_DAILY_CAP` Script Property).
- **✅ Caught a gap 2026-07-09: the 7 HIGH findings had been skipped entirely** (only criticals +
  mediums were fixed in the first pass). All 6 outstanding ones now fixed and pushed to HEAD too
  (the 7th, doSeed clearing missing entities, was already resolved as a side effect of the seed
  critical fix). Full detail in `docs/handoffs/backend-audit-2026-07-09-remaining-high-low.gs`:
  - `sendCustomerMessage` added to WRITE_ACTIONS (was GET-reachable)
  - `chatMergeMsgs_` now validates an incoming message's `by` against the caller's `me` (was a
    chat-impersonation gap) — also backported into the queued team-chat-privacy replacement file
    so it isn't lost when that eventually ships
  - `wranglerComment_`'s resume-a-paused-build logic now requires Admin+ tier, not any signed-in role
  - `stripeSaveBank_` actually persists to `cust.achAccounts` now (was a complete no-op write)
  - `recordManualRefund_` (+ self-caught: my own earlier `stripeRefundInvoice_` rewrite had the
    same bug) reject an explicit non-positive `amountCents` instead of silently refunding in full
  - `sendCustomerMessage_`'s dedup + quiet-hours checks are unconditional now, not just for
    `auto:true` callers (Jac's call)
  - Also fixed 4 of 5 LOW findings alongside these: dead `MONEY_ROLES`/`ADMIN_ROLES` removed,
    `saveConfigFromBody` rejects a blank role key, `saveGroupOrderFromBody` gets a size cap,
    `stripeChargeInvoice_`'s dead `passedAch` var removed. The 5th LOW (`saveSession_` has no
    expiry on its Script Properties entries) is **parked** — needs a real design call (new
    trigger vs. Sheets-backed storage), not a one-liner.
  - **This closes the full 32-finding backend audit for real this time** (4 critical + 7 high +
    16 medium + 4/5 low — the 5th low is parked by design, not an oversight).
  - **✅ DEPLOYED + VERIFIED 2026-07-09 (v88).** All patches confirmed present in the live version,
    anonymous access intact. Only the queued team-chat-privacy hardening remains undeployed
    (intentionally, gated on the new frontend branch) — every other backend audit finding is now
    live in production.

## ⏳ QUEUED, READY TO DEPLOY INDEPENDENTLY — seed gate + recordCharge_ dedup (2026-07-09)
- **What (2 fixes, no frontend coordination needed, unlike the chat-privacy item below):**
  1. **`seed` gated to Admin+.** Any signed-in role could trigger a full destructive database
     replace before — the app's UI only ever fires it from the admin-only `#reseed` bootstrap
     flow, now the backend enforces that too (`isAdmin(pw)` check at dispatch, matching
     `getConfig`/`feedbackList`/`setViews`'s existing pattern). `load`/`sync` unchanged.
  2. **`doSeed` no longer wipes an entity absent from the payload.** Was: an entity key missing
     from the client's `data` object got treated as "empty it" (`s.clear()` ran regardless) — a
     future `ENTITIES`/`PERSIST_KEYS` drift would silently delete a whole entity's rows on the
     next reseed. Now skips any entity not present as a key in `data`.
  3. **`recordCharge_` de-dup guard.** A retry with an already-recorded PaymentIntent id
     (network hiccup, double-click) inflated `amountPaid` a second time with no matching second
     Stripe charge — bookkeeping bug, not a real double-charge (Stripe's own idempotency key
     prevents that), but real. Now a repeat call for an already-recorded charge is an idempotent
     no-op.
- **Prepared** in `docs/handoffs/backend-audit-2026-07-09-critical-fixes.gs`, `node --check` passes.
- **✅ PUSHED to HEAD 2026-07-09** (service account, content-only, confirmed present in a fresh
  HEAD read). **REMAINING STEP (Jac, editor):** Deploy → Manage deployments → Edit prod →
  New version → Deploy. No trigger install needed this time (unlike the membership fix) — these
  are pure logic changes, nothing to install. Verify after: anonymous-access curl check, and
  confirm `seed` now returns `{"ok":false,"error":"forbidden"}` for a non-admin password.

## ⏳ QUEUED, GATED ON FRONTEND — team-chat privacy hardening (2026-07-09)
- **What:** the 8-agent backend audit (2026-07-09) confirmed CRITICAL: `getChats_`/
  `chatAuthorizeWrite_`'s original "old client → unscoped fallback" back-compat design is a
  universal bypass — any caller (not just a genuinely old client) can omit `body.me` to read
  every team chat and overwrite any chat's ownership/members. Worse: the new frontend that
  always sends `me`/`rosterId` (`claude/internal-chat-updates-vq6p7b`) hasn't shipped yet, so
  this scoping has never actually been active in production for anyone.
- **Fix prepared** in `docs/handoffs/team-chat-privacy-backend.gs`: back-compat fallback removed
  from both handlers — `getChats_` always scopes via `chatCanSee_`, `chatAuthorizeWrite_` rejects
  any write with no asserted `me`. `node --check` passes.
- **⛔ NOT safe to deploy independently** — the CURRENT live frontend never sends `me`, so
  deploying this alone would make every team member's chats disappear / writes get silently
  rejected. **Must ship in the same rollout as `claude/internal-chat-updates-vq6p7b`.** Jac's
  call (2026-07-09): fix now, coordinate the deploy with that frontend branch landing — not
  deployed yet, no STOP-gate go-ahead given for the live push.

## ⏳ PUSHED, AWAITING EDITOR DEPLOY — membership regression fix (2026-07-09)
- **What:** re-splices the app-driven membership block (`membershipEnroll_`/`membershipCancel_`/
  `membershipReactivate_`/`membershipBillingCron` + ~15 helpers + the 3 dispatch lines) that was
  silently deleted in v48 (2026-06-25T23:21:35Z, 11 minutes after it first shipped in v46) — see
  `docs/handoffs/membership-billing-additions.gs` for the full root-cause trace (pulled directly
  from the Apps Script version history via the REST API, service account, read-only).
- **Confirmed no retroactive cleanup needed:** pulled the live production dataset (2,245
  customers, 185 invoices) and checked every angle — zero `MINV-` invoices, zero
  `membership:true` invoices, zero customers with any app-driven billing field populated
  (`paidCadence`/`commitmentStart`/`commitmentEnd`/`paidUntil`/`stripeSubId`). The feature had no
  organic production usage in its 11-minute live window or since, so there's no missed-billing or
  stuck-customer fallout to reconcile.
- **Content pushed to HEAD** (service account, content-only, safe — does NOT affect the live
  `/exec` URL): confirmed via a fresh HEAD read that all 5 membership markers are present and
  `node --check` passes.
- **✅ DONE 2026-07-09: v83 ("Massive Audit") deployed by Jac.** Verified live: membership
  markers present in v83's content, anonymous access intact (`{"ok":false,"error":"unauthorized"}`
  on a bad password, not HTML/403).
- **⚠ Found + fixed after that deploy:** `installMembershipBillingCron_` didn't show up in the
  editor's Run dropdown — Apps Script hides any function ending in `_` from that picker (private-
  helper convention). Renamed to `installMembershipBillingCron` (no underscore, matching the
  existing `installUnitDailyTrigger` precedent), re-pushed to HEAD.
- **✅ FULLY DEPLOYED + VERIFIED 2026-07-09 (v84).** Jac re-deployed, refreshed, ran
  `installMembershipBillingCron` (execution log: completed, no errors — trigger installed).
  End-to-end verification: `auth` with a money-tier password → `{"ok":true,"role":"developer",
  "money":true}`; `membershipEnroll`/`membershipCancel`/`membershipReactivate` each called with a
  deliberately nonexistent customerId → `{"ok":false,"error":"customer-not-found"}` (proves the
  dispatch is live, the money gate passed, and the function body executed — zero writes, zero
  Stripe calls, since the code returns before any write when the customer doesn't exist).
  Anonymous access confirmed intact throughout. **Regression fully closed.**

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
| 3 | **perfReport formula-injection guard** — `t1()` gets a leading-apostrophe guard so a client-supplied `build`/`device`/`role` starting with `=/+/-/@` can't be evaluated as a formula if the `_perf` tab is ever opened/exported (#552 audit, low severity — metrics tab, no money/PII) | `perf-report-backend.gs` (updated in place — same file as #1, now with the fix) | Replace the live `t1()` function body with the one in the source file (same signature, one added guard line) | ⏳ QUEUED (2026-07-09) — not yet deployed, needs the usual STOP-gate |

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
