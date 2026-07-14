# Notifications B / C / D — implementation plans (2026-07-14)

> **STATUS (updated 2026-07-14):** Phase A shipped to trunk (#620). **Phase B BUILT** → backend **v98**
> (reviewed, dry-run-validated). **Phase C CORE BUILT** → backend **v99** (the manual crew broadcast;
> `/role`-audited + reviewed). Both are pushed + versioned, **awaiting Jac's editor deploy** (see
> `BACKEND-DEPLOY-QUEUE.md`). REMAINING: C's frontend broadcast composer + the 3 auto-triggers (§C
> below — triggers are a real lift), and all of Phase D. The plans below are the build guide for what's left.

Ready-to-build plans for the phases that **fire real sends** or **need Jac's editor deploy /
trigger install** — so we build + activate them together, supervised. Design: the companion
`2026-07-14-notifications-pane-design.md`. Phase A (the pane) is built + staged this session.

**Deploy pattern (every backend step):** edit the gitignored `Code.gs` (on disk at `~/rw-backend`) →
`node --check` → push HEAD via the service account → `versions.create` → **Jac points the live
deployment at the new version in the editor** (REST deploy breaks anonymous access — editor only).
**Activation** (installing a cron, firing real texts) is always Jac-supervised.

---

## 🅑 Customer reminder engine

**Goal:** the "shop never has to remember" auto-texts — start / return / balance — driven by the
Phase-A settings + the Customer window.

**Backend (`Code.gs`, additive):**
1. **Templates** — add `reminder-balance` to `SMS_TEMPLATES` (+ email sibling). `quote` /
   `reminder-start` / `reminder-return` already exist. Balance body (server-derived vars only):
   "Hi {firstName}, a reminder from {companyName}: invoice {invoiceId} has a balance of {total} due
   {dueDate}. Call us{companyPhoneSuffix}. Reply STOP to opt out."
2. **`runReminderSweep_()`** — walks records, evaluates `settings.notifications.customer.reminders`
   against today, fires `sendCustomerMessage_({...auto:true})` per due record. Derivations
   (comms spec §7.1): **start** = `status==='Reserved' && startDate===today+leadDays`; **return** =
   window-end `=== today+leadDays`; **balance** = invoice `Unpaid|Late && dueDate < today-afterDueDays`.
   `auto:true` → the Customer window (`smsQuietNow_('customer')`) + dedup + cap all apply already.
   Dedup key `(channel,event,recId,day)` is the existing `messages` ledger — a re-run never double-texts.
3. **`runReminderSweepNow` action (admin, dry-run-capable)** — runs the sweep once on demand so Jac can
   **test before installing the cron**. Support `body.dryRun:true` → return the list of *who would get
   what* (masked) WITHOUT sending. This is the safe pre-activation check.

**Activation (Jac):** create a daily **installable time trigger** for `runReminderSweep_` in the editor
(Triggers → Add trigger → time-driven → daily, ~8am Central). **Not auto-installed** — a buggy sweep
texts 2,257 real customers. Test path: `runReminderSweepNow {dryRun:true}` → review → `{dryRun:false}`
on ONE reserved test rental → confirm → install the daily trigger.

**Gates:** consent (opt-out hard-block) · isolation · var allowlist · Customer window · daily cap · dedup.
**Frontend:** none beyond Phase A (the cadence toggles already drive it). Optionally a "Run reminders
now (dry-run)" admin button in the Channels/Reminders card for the test path.

---

## 🅒 Staff (crew) SMS channel

**Goal:** text the crew for work — driver run assigned, WO assigned, schedule change — plus a manual
"text the crew" broadcast. New audience: roster people, not customers.

**Backend (`Code.gs`, additive):**
1. **`sendStaffMessage_(body, role, pw)`** — mirror of `sendCustomerMessage_` for the crew:
   - Recipient resolved **from `body.rosterId`** → `settings.employees[i].phone` (NEVER a client-supplied
     `to`). Unknown/absent roster id or phone → `{ok:false, reason:'no-recipient'|'no-phone'}`.
   - **Crew consent** — `employee.commsConsent.sms !== 'opted-out'` (additive field on the roster person;
     default `unknown` = allowed for internal work texts). A crew STOP flips it (inbound, below).
   - **Staff var allowlist** — job/customer NAME, delivery ADDRESS, dates, unit name, time. **NEVER**
     `cost` / `margin` / `bottomDollar` / any pricing floor — even to a driver's phone. Enforce by
     server-side derivation (same construction as the customer allowlist: never read client vars).
   - **Staff window** — `smsQuietNow_('staff')` (already wired; reads `channels.windows.staff`).
   - Cap (shared) · dedup `(event,rosterId,recId,day)` · `messages` row `{audience:'staff', rosterId}`.
   - Templates: `staff-run`, `staff-wo`, `staff-schedule`, `staff-broadcast` (freeform, operator text).
2. **Router** — `if (action==='sendStaffMessage') return json(sendStaffMessage_(body, role, pw));`
   (POST-only; add to `WRITE_ACTIONS`).
3. **Crew consent field** — additive `employee.commsConsent` on `settings.employees[i]` (mirror customer).

**Triggers (wire into existing surfaces — each behind its `settings.notifications.staff.*` toggle):**
- **driver-assigned** → where rentals-dispatch / trips assign a driver to a delivery/pickup
  (`setTrip` / the dispatch assignment path) → `sendStaffMessage_(staff-run)` to that driver's rosterId.
- **wo-assigned** → where a work order's `assignedTo` is set → `staff-wo` to that mechanic.
- **schedule-change** → where an assigned trip's time/order changes → `staff-schedule` to the affected driver.
  *(These are server-side hooks in the relevant handlers; each checks its toggle + consent + window.)*

**Frontend (Phase C):**
- **"Text the crew" broadcast composer** — from the Crew-alerts card: a picker of roster people (reuse the
  member-picker idiom from team chat) + a message box → `sendStaffMessage_(staff-broadcast)` per selected
  rosterId. **New overlay kind → add a `WINDOW_CATALOG` entry** with a `sample()` using fictional roster
  data (passes `check-window-catalog.mjs`). Run through `/jactec-ui`; `data-r` stamps.
- Crew-consent visibility on the roster row (opted-out stamp), editable by admin.

**Security / gates:** recipient-from-roster (no client `to`) · crew consent · staff var allowlist (no
pricing) · staff window · cap · POST-only + role gate. **Who can broadcast?** — propose `manager+`
(a broadcast to the whole crew is heavier than a single customer text); confirm with Jac. Run a **/role
audit** on this before building (new customer-adjacent + PII surface).

**Activation (Jac):** deploy; test each trigger on a test record + a broadcast to Jac's own roster entry
before enabling the toggles shop-wide.

---

## 🅓 Dispatch-ETA + Reviews → Reputation

**Dispatch-ETA (customer):** `dispatch-eta` template + a hook where dispatch marks a unit **en-route** →
`sendCustomerMessage_('dispatch-eta', auto:true)` to the rental's customer, behind
`settings.notifications.customer.dispatchEta`. Gates: customer window, consent, cap. Small once C's
trigger plumbing exists.

**Review-request:** `review-request` template + a hook on rental **completed + `delayDays`** →
`sendCustomerMessage_('review-request')`, behind `customer.review`. Straightforward send; the hard part is
the **source**.

**Reputation KPI (needs a Jac decision — comms spec Q-3b, blocker):** the null Office ring
(`app.js:7130`) can't light until there's a **review source**. Options: (a) Google Business reviews
(public but hard to read programmatically), (b) reply-with-rating SMS (in our control, private), (c) a
hosted review form (most flexible, most build). **Do not build the KPI until Jac picks the source.** Once
chosen: `Reputation = (Σ stars / (5 × count)) × 100`, with a small review-count floor (Q-18) so it isn't
"100% from 1 review."

---

## Cross-cutting: inbound webhook (STOP/START + delivery receipts)

Needed before wide auto-rollout of B/C (compliance + accuracy):
- **`inboundMessage` (Twilio → GAS `doPost`)** — **verify the Twilio signature first** (anti-spoof), then:
  match the sender to a customer OR a roster person; `STOP/UNSUBSCRIBE/END/QUIT` → set that party's
  `commsConsent.sms='opted-out'`; `START/UNSTOP` → `opted-in`; otherwise log an inbound `messages` row +
  surface it (comms spec Q-5). *Note: Twilio's Advanced Opt-Out already blocks a STOP'd number at the
  carrier, so we're **legal** today — this syncs our own state so we stop attempting + show opt-outs.*
- **`messageStatus` reconcile** — Twilio delivery/failure status callback → flip the `messages` row
  `sent→delivered/failed`. Today we only know Twilio *accepted*. Configure the status callback URL on the
  Twilio number/messaging service.

---

## Build order & who-does-what
1. **B** (highest payoff, contained) → dry-run test → Jac installs the cron.
2. **Inbound webhook** (STOP sync) → protects B/C at scale.
3. **C** (new channel; /role audit first; new overlay → WINDOW_CATALOG) → Jac tests triggers + broadcast.
4. **D** dispatch-ETA (small) + review-request; **Reputation waits on Jac's source pick.**

Every backend step: push HEAD + version → **Jac's editor deploy**. Every activation (cron install,
enabling a trigger, first real batch): **Jac-supervised**. No step here fires real customer/crew texts
unsupervised.
