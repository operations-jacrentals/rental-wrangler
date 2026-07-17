# Backend deploy queue — DEPLOYED (2026-07-06 late session); doc kept as the deploy runbook

## ✅ DEPLOYED LIVE 2026-07-17 — §authz approval codes (tier-gate swap)
- **What:** the frontend's tier gates (Net Terms D22, rental-gate override D14, blacklist
  set/lift D13, card-gate override, admin inline pricing edits) no longer take the retired
  shared password — a below-tier user now picks a Manager/Admin off the roster and the backend
  texts THAT person's own phone a one-time 6-digit **approval code** that authorizes the ONE
  action. Two additive handlers in `docs/handoffs/phone-identity-backend.gs` §authz:
  **`authzStart_`** (authenticated requester; approver tier ≥ minTier enforced at mint, floored
  at manager; own rate bucket `PID_AZRL_`; roster-resolved destination) and **`authzVerify_`**
  (single-use burn, 5-try cap, 10-min TTL, tier re-checked at verify, `rec.need` must cover the
  gate being asked; returns `{ok, approver}` — **never a token/session**). Separate `PID_AZCODE_`
  namespace so a login code can't approve and an approval code can't log in. `pidPurgePerson_`
  extended (+2 keys). Router: 2 dispatch lines (after `role` is computed) + 2 `WRITE_ACTIONS`
  keys — see the ROUTER WIRING block in the mirror.
- **Frontend:** ships on `claude/tier-gate-phone-code-iupiwy` (the tierAuth shell). **Fail-closed
  until this deploys** — below-tier users see "Couldn't text the code" (no regression: the
  password path was already a dead end with no password to type); at-tier users are unaffected.
- **Deploy flow:** the standard splice — pull live `Code.js` → append §authz functions + wire the
  router → `node --check` → STOP-gate (show Jac) → SA `push` HEAD → **Jac's editor New-version
  deploy** → verify anonymous JSON + a real approval round-trip on staging.
## 🟡 PUSHED TO HEAD — awaiting Jac's editor deploy — invoice email PNG attachment (2026-07-17)
- **Status:** spliced against the LIVE `Code.js` (pulled via SA `getContent`, matched the snapshot
  at `sendCustomerMessage_` 2446-2448), `node --check` passed, **pushed to HEAD via the service
  account** (content-only — NOT live). **Go-live = Jac's editor deploy** (Deploy → Manage
  deployments → Edit prod → New version, Execute as Me (operations@), Who has access: Anyone).
  Verify after: POST `{"action":"auth","password":"__wrong__"}` to the exec URL → expect JSON
  `{"ok":false,...}` (HTML/403 = anonymous access broke → editor rollback).
- **What:** `docs/handoffs/invoice-email-attachment-backend.gs` — a small ADDITIVE splice in
  `sendCustomerMessage_` (email branch, right before `GmailApp.sendEmail`). The client
  (`emailQuoteSend`, shipped on `claude/random-improvements-quivhs`) now renders the invoice sheet to
  a PNG and passes `body.attachment = {name, mimeType:'image/png', dataB64}`; this patch decodes it to
  a blob and adds `mailOpts.attachments`.
- **Safety:** recipient is still server-resolved from the invoice's own customer (existing isolation
  gate), so the image can only reach that customer; gated to `entity==='invoice'`, MIME-whitelisted
  (png/jpeg), ~3MB size-capped, and a bad blob is dropped (never fails the send). Consent/quiet-hours/
  cap/dedup all still run first, unchanged.
- **Fail-safe until deployed:** the client sends the attachment field; the un-patched backend simply
  ignores it → emails still send text-only (no regression). The image appears once this deploys.
- **Deploy flow:** pull live `Code.js` → splice the block per the handoff header → `node --check` →
  STOP-gate (show Jac) → SA `push` HEAD → **Jac's editor New-version deploy** → verify a real invoice
  email arrives WITH the PNG on staging.

## ⏳ READY TO PUSH — membership dues PO-hold + create-ahead-regardless-of-payment (2026-07-17)
- **What:** `docs/handoffs/2026-07-17-membership-po-advance-billing.gs` — additive splice against the LIVE
  membership block (reconciled 2026-07-17 against the live source pulled via the Drive connector; the live
  code is AHEAD of the old `membership-billing-additions.gs` record — it already has
  `memEnsureNextInvoice_`/`memFindDueInvoice_`/the future-start branch). Spec:
  `docs/superpowers/specs/2026-07-17-membership-po-advance-billing-design.md`.
  - **Change 1 — PO-hold:** new `duesRequirePO` customer field (default falsey = exempt; set client-side in
    the agreement / account line). When `requiresPO && duesRequirePO && !inv.po`, `membershipEnroll_` /
    `membershipBillingCron` **HOLD** the dues charge — no charge, **no grace, no lapse** — until a PO is
    added (or the toggle is turned off). Held ≠ declined.
  - **Change 2 — create-ahead regardless of payment:** new `memEnsureInvoicesAhead_` creates every cycle's
    dues invoice ~28 days before its due for EVERY active member each run (regardless of whether prior dues
    are paid → open invoices stack, each month its own invoice) + the immediate next on a cleared charge.
    **Annual is clamped to 28-days-before-renewal** (no year-early renewal invoice). Charge stays on the due
    date; `paidUntil` advances only on a cleared charge. Cancellation/lapse unchanged.
- **Edits:** 4 new helpers (`memAddDaysIso_`, `memDuesPoHeld_`, `memDuesInvoiceIndex_`,
  `memEnsureInvoicesAhead_`) + full-replacement `membershipEnroll_` and `membershipBillingCron`. The old
  `memEnsureNextInvoice_` calls are replaced by `memEnsureInvoicesAhead_` (leave the old fn defined-but-unused
  or delete it — no other caller).
- **Reviewed:** fresh-context Opus money-review 2026-07-17 — 2 blockers found + fixed (annual on-payment
  horizon clamped to 28d; enroll reuse scoped to a `Member Incomplete` held-retry whose due matches `start`,
  so it can't grab a stacked-future/stale invoice and mis-charge). Everything else confirmed sound (PO-hold
  never lapses; stacking charges one/run with aligned `paidUntil`; idempotent creation; no live behavior
  lost). `node --check` passes. One [CONSIDER] left as-is (a >18-cycle-behind member backfills over multiple
  runs — self-heals; doesn't affect normal members).
- **⚠ RECONCILE-AT-SPLICE:** diff against the live `membershipEnroll_`/`membershipBillingCron` before
  overwriting (the live may carry a fix newer than the 2026-07-17 pull). Preserve the future-start `'pending'`
  branch, prepaid/`stripeSubId` skips, term-complete roll, grace/lapse, and the first-charge `payBase` fallback.
- **DEPLOY:** `/clasp` push (service account) → **Jac's Apps Script editor deploy** (NOT a REST deploy). No
  new trigger install needed (the daily cron is already installed). **TEST on a staging test-member first:**
  (1) a monthly member shows next month's invoice created ahead + charged on its due date; (2) a
  `requiresPO`+`duesRequirePO` member's dues **hold** (created, not charged, no lapse) until a PO is added.
- **Frontend companion (already on branch `claude/membership-po-advance-billing`, PR #668):** the
  `duesRequirePO` toggle. Frontend ships via the normal `/deploy → /merge → /promote` gates independently.


## ⏳ PUSHED + VERSIONED — AWAITING JAC'S EDITOR DEPLOY (2026-07-14) — Twilio inbound webhook (v101)
- **Backend v101 — Twilio inbound webhook.** Two anonymous handlers on the existing `?wh=` router
  (mirrors the Stripe hook). `twilioInbound_` — an inbound SMS: matches the sender to a customer OR a
  roster hand **by normalized phone**, and on a STOP/START keyword flips that party's
  `commsConsent.sms`; logs every reply (dedup by SID) so it lands in the customer thread + opt-outs are
  visible. Returns empty TwiML (no auto-reply, no PII). `twilioStatus_` — the delivery-status callback:
  reconciles the outbound row `sent → delivered/failed` (matched by `providerId` = SID; never downgrades
  a terminal delivered/failed). Additive; `node --check` passes; red-teamed (2 medium + 3 low findings all
  fixed: log-with-`consentPending` on lock contention, terminal-status downgrade guard, atomic dedup,
  phone-based roster re-match, customer-first documented).
- **🔒 SECURITY — set `TWILIO_WH_KEY` BEFORE wiring (required here, unlike Stripe).** GAS can't read the
  `X-Twilio-Signature` header, so auth is a URL token. Stripe defaults open because it re-fetches state;
  this hook ACTS on the payload (flips consent), so gate it:
  1. Pick a long random secret → set Script Property **`TWILIO_WH_KEY`** (via `adminSetProps` or the editor; never commit it).
  2. Deploy: point the live deployment (`…trNlObZw`) at **v101** (anon access must stay intact — verify `smsProviderStatus` still returns JSON after).
  3. Twilio Console → the number's **"A MESSAGE COMES IN"** (HTTP POST) →
     `…/exec?wh=twilioIn&whk=<TWILIO_WH_KEY>` ; and the **statusCallback** →
     `…/exec?wh=twilioStatus&whk=<TWILIO_WH_KEY>`.
  4. Test: text **STOP** from a number matching a test customer → confirm `commsConsent.sms` flips to
     `opted-out` (a later send returns `opted-out`); **START** flips it back; send one message + confirm
     its row reaches `delivered`.

## ✅ DEPLOYED 2026-07-14 — comms Phase C dedup (v100, Jac deployed) + full notification test
- **Backend v100 — content-aware dedup for the crew broadcast.** `sendStaffMessage_`'s dedup key for a
  MANUAL broadcast (`isFree`) folds a short MD5 content hash into `staff|broadcast|<rosterId>|<day>|<hash>`
  — two DIFFERENT broadcasts to a hand in one day both send; identical double-taps still dedup. Deployed +
  verified live (anon access intact).
- **End-to-end notification test (2026-07-14, to the Jacob Cameron / C0991 test record):** all four SMS
  templates (quote $653.43, reminder-start, reminder-return, reminder-balance $631.28) **delivered to the
  handset**; all four **email** siblings sent from operations@; the **crew broadcast** fired to a temp
  roster hand (roster restored clean after). Every channel is proven end-to-end.

### 🔲 Phase B auto-sweep activation (customer reminders) — Jac's supervised call
Engine LIVE (v99); send path proven. Fires nothing until BOTH toggles on AND the cron installed:
1. **Enable** the reminder(s) in **Settings → Notifications** → Save (enabling alone sends nothing).
2. **Preview** — `runReminderSweepNow {dryRun:true}` → review who'd get texted today (masked + consent).
3. **Live one-off** — `runReminderSweepNow {dryRun:false}` on a quiet day (only today's window matches).
4. **Install cron** — run `installReminderSweepTrigger()` **from the editor** (creates the daily trigger,
   auto-timed inside the customer window). Editor-only — not reachable via the web app.

### 🔲 Company phone + "Office+ can adjust notifications" — Jac's call
- Texts read "Call us." with no number until the yard phone is set in **Settings → Company**.
- "Office+ adjusts notifications" needs an auth change: the pane is Admin-only today, and a naive loosening
  of `setConfig` (a full-config replace carrying role + admin passwords) would expose credentials to Office
  staff. Needs a notification-settings-only, Office-gated save path — a short spec before building.

## ✅ DEPLOYED 2026-07-14 — comms Phase B + C-core (v99, Jac deployed)
- **Backend v98 — Phase B: customer reminder sweep.** `runReminderSweep_` (start/return/balance;
  fire-once date-equality → no daily spam, no catch-up; **safe-by-default: every toggle off → 0 sends**),
  `reminder-balance` template, `{balance}`/`{dueDate}` vars, `runReminderSweepNow` admin action
  (**DRY-RUN by default**), `installReminderSweepTrigger` (auto-timed inside the customer window).
  Adversarially reviewed — 5 fixes applied. Dry-run validated live (candidates:0, 0 sends).
- **Backend v99 — Phase C core: crew SMS broadcast.** `sendStaffMessage_` — manual "text the crew"
  (**manager+** gate via the router, `rosterId` isolation, crew consent, staff window, cap, dedup) + a
  `messagesFor_` guard so crew-text bodies never surface through the customer projection. `/role`-audited
  + adversarially reviewed (BLOCKER + 3 fixes applied). **v99's HEAD included B**, so pointing the live
  deployment at v99 landed both. Validated live: `sendStaffMessage` empty probe → `reason:'empty'`;
  `messagesFor{customerId:"undefined"}` → `{ok:true,messages:[]}`.
- **Frontend composer SHIPPED (#625) — the "Text The Crew" modal is LIVE on production** (Settings →
  Notifications → Crew Alerts). Roster is empty today, so it opens to the "add crew" state.
- **REMAINING (Jac-supervised, not yet done):** enable the Phase B reminder toggles +
  `installReminderSweepTrigger()` after a real dry-run; a live crew-broadcast test once a hand is on
  the roster. The 3 auto-triggers + Phase D are a separate scoped effort — see
  `docs/superpowers/plans/2026-07-14-notifications-BCD-plan.md`.

## ✅ DEPLOYED 2026-07-14 — comms: Twilio GO-LIVE + send window/override (v92)
- **What:** Twilio approved & taken live. Backend **v92**: `smsQuietNow_` window widened to
  **6am–8pm** Central; quiet hours now gate **every** send with an **admin `override:true`**
  escape on manual sends; new admin read-only **`smsProviderStatus`** action (config presence,
  booleans only). Full deltas + remaining roadmap: `docs/handoffs/comms-twilio-golive-2026-07-14.gs`.
- **Creds:** `TWILIO_SID/TOKEN/FROM` set LIVE via the `adminSetProps` action (not the editor),
  validated against Twilio's API (number SMS-capable). Confirmed end-to-end with a real test text
  (`provider:twilio, status:sent`, delivered to the test handset). Secrets stay in Script
  Properties only — never in the repo, never echoed.
- **Deploy flow (as-shipped, and a lesson):** service-account `push` updates HEAD only — it does
  **not** create a version, so the version-pinned live deployment (…trNlObZw) saw nothing until a
  version existed. Did: push HEAD → `projects.versions.create` (v92, **safe** via API) → **Jac
  pointed …trNlObZw at v92 from the EDITOR** (deployments.update via API is still the anon-access
  landmine — editor only). Anonymous access confirmed intact after (`smsProviderStatus` returns
  JSON, not 403/HTML).

## ✅ DEPLOYED 2026-07-13 — ACH unblock: `stripeSaveBank_` PM-attachment guard
- **Staged to HEAD** (service account push, content-only) + read-back verified, then **editor
  redeploy by Jac**. Anonymous access confirmed intact afterward (wrong-password `auth` →
  `{"ok":false,"error":"unauthorized"}`, HTTP 200 JSON — not 403/HTML). Live end-to-end ACH
  add is Jac's in-app confirmation (needs live Stripe + selfie/signature consent).

### (as-shipped) ACH unblock: `stripeSaveBank_` PM-attachment guard (2026-07-13)
- **What:** ACH was categorically broken — every "Add bank account" save returned
  `pm-customer-mismatch` ("That card isn't linked to this customer."). Root cause (proven,
  live source pulled read-only): `stripeSaveBank_`'s second ownership check requires the
  confirmed PaymentMethod to already be attached to the Stripe customer
  (`pm.body.customer !== rec.stripeId`), but `stripeBankSetupIntent_` opens the SetupIntent
  with `verification_method: microdeposits`, so after `confirmUsBankAccountSetup` the intent
  is `requires_action` (not `succeeded`) and Stripe attaches the PM to the customer only "on
  successful setup". Store-now-verify-later means the PM is unattached (`pm.customer` null)
  on every fresh add → the guard fires 100% of the time.
- **Fix** in `docs/handoffs/ach-pm-mismatch-fix.gs` (REPLACES `stripeSaveBank_` verbatim):
  accept an unattached PM only when the SetupIntent binding above was verified
  (`si.customer === rec.stripeId && si.payment_method === pmId`); still reject a PM attached
  to a DIFFERENT customer, or an unattached PM with no SetupIntent proof. IDOR guard
  preserved, not weakened. Additive — no signature/schema change. `node --check` passes.
- **NOT yet staged to HEAD** — awaiting Jac's explicit go (money/auth-critical). Deploy flow:
  pull live `Code.js` → splice this `stripeSaveBank_` → `node --check` → `push` HEAD via the
  service account (content-only, safe) → **editor** redeploy (New version, Who has access:
  Anyone). Verify after: anonymous curl returns JSON, then a real ACH add on a test customer
  no longer errors. Frontend copy fix (card-worded error neutralized) ships separately on
  `claude/ach-processing-issue-hu5mtj` (PR #601).


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
