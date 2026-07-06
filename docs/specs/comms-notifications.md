# Comms / Notifications — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/comms-notifications`
**Task branch:** `comms-notifications/spec` (proposed)
**Maturity:** 🟡 Partial
**Scope:** All comms channels — internal team chat, operator/system notifications (the resolved-fix bell), and **outbound customer messaging** (SMS/email for quotes, reminders, dispatch alerts, and reputation/review requests), plus the per-role notification preferences that govern them.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions. **Priority note:** Jac wants this built **before GPS** (the SMS channel is the prerequisite for GPS stray alerts, `gps-tracking` D4) — and it also unblocks the dead Reputation KPI.

- **D1 · SMS provider = MoceanAPI (resolves Q-3).** Jac has a **Mocean** account (moceanapi.com). Use Mocean as the SMS vendor; key named-only in GAS Script Properties (e.g. `MOCEAN_API_KEY` / `MOCEAN_FROM`), **never in repo**. SMS-first; email a later phase. The `sendCustomerMessage` contract stays provider-agnostic with a **Mocean adapter** server-side (so a future swap is server-only).
- **D2 · Sends are OPEN to all signed-in users for now (resolves Q-1).** **No tier gate** on firing a customer message (quote or reminder) — any signed-in role may send, consistent with the open-visibility posture. The other server-side gates **stand and are not loosened**: customer-**isolation** (recipient resolved from the record's `customerId`, never a client `to`), the **var-allowlist** (no `cost`/`margin`/`bottomDollar` in any body), and **consent/opt-out**. (Tighten the tier later if it's ever abused.)
- **D3 · Full hands-off automation + quiet hours (resolves Q-6).** The reminder sweep sends **silently/automatically** — SMS is hands-off, **no morning-approval step**. **But NO after-hours sends** — quiet hours enforced (America/Chicago). The dedup ledger + daily cost cap remain the runaway guards.
- **D4 · Reputation is a multi-source COMPOSITE (resolves Q-3b; reframes §7.4).** The Reputation KPI is **not** a single review-star source — it aggregates **Google reviews + email engagement + vendor statuses + customer-account statuses + more** into a weighted composite. Define the full signal set + weights as a follow-up (ties to the `financials-kpi` KPI engine); this area feeds the review-request + email-engagement signals in. The ring stays null until enough signals land.

**Defaults adopted:** Q-2 → consent `unknown` = implied for **transactional** (quotes/reminders; quick legal check, marketing needs express opt-in) · Q-16 → **hard-block opted-out**, no override · Q-7 → **record-only** recipients (no ad-hoc numbers) · Q-9/Q-17 → `messages` log is **server-only** (on-demand fetch; PII never synced) · Q-8b → history phone lines **masked** · Q-13/Q-14 → templates in a **server-side registry**, hardcoded v1 · Q-11 → channel **stop-on-fail** for automated · Q-15 → daily send-cap as an admin setting · Q-10 → quiet hours **America/Chicago**, server-computed.

---

## 1. Goal & Problem

### 1.1 What this area is for

Rental Wrangler today can *show* the team what's flagged and *let the team talk* about it (team-chat dock + Mr.-Wrangler resolved-fix bell). What it **cannot** do is reach the **customer** through any server-controlled channel. The only outbound path is a device deep-link (`sms:` / `mailto:`) that opens the *operator's* phone app pre-filled — the message is sent by a human, from a personal number, with no log of delivery, no scheduling, and no automation.

This area owns the seam between **internal comms** (team, operators) and **outbound comms** (customers), and the single place a human decides "who gets pinged, by what channel, about what, and when."

### 1.2 The business problem

- **No proactive customer touch.** Reservation-starts-today, return-due, balance-overdue, and "your unit is on the way" all require a human to remember and manually text. JacRentals is a small shop; this slips.
- **Reputation KPI is dead.** The Office dashboard ring "Reputation" returns `null` (`app.js:7130`) because there is no review-request channel and no review source. A whole KPI is a placeholder.
- **No delivery proof.** A `sms:`/`mailto:` deep link logs only "Texted/Emailed quote" on the invoice history (`logAction`) — there is no record the message actually sent, was delivered, or got a reply.
- **Notifications settings is a stub.** The Settings → Notifications tab is a "Planned" placeholder (`app.js:3414`), so there is no per-role control over team-chat, dispatch alerts, or customer cadence.

### 1.3 North star

> **The shop never has to remember to reach out.** The right person — operator or customer — gets the right message on the right channel, automatically when a rule fires or with one tap when a human decides, and every send is logged on the record it came from.

A glance at the bell or the chat dock tells the team what needs a human; the customer hears from JacRentals without anyone in the office thinking about it.

---

## 2. Current State (Baseline)

The live system is documented here **as canon**. Three sub-systems exist; only the first two are real channels.

### 2.1 SHIPPED — Internal team chat (`APP-23`, app.js:7541)

A bottom-dock chat built on Phase-6 record comments.

| Piece | Where | Behavior |
|---|---|---|
| Comment feed | `chatComments()` app.js:7548 | Every `rec.comments[]` across customers/rentals/units/invoices/workOrders/categories, flattened into a "what's flagged" feed. |
| Threads | `state.chat.chats[]` | Each chat = `{ id, tags[], participants[], messages[], seen{} }`. Threads are **never deleted** — a 0-participant chat goes dormant and is reopened via a tagged element. |
| Tags | `chat.tags[]` | Colored chips referencing a record (`{card, recId}`); a thread "carries its own context." Added by right-click / long-press / drag-in. |
| Roles | `chat.participants[]` | Role buttons toggle who's included (`chatToggleRole` app.js:7955). Default = all `ROLES`. |
| Unread | `chatUnreadCount()` 7554, `chatUnseenForRec()` 7561 | Per-user `seen{}` map drives a re-flash on tagged elements and an unread count. |
| Send | `chatSend()` app.js:7945 | Pushes a message `{id, by, when, at, text}`, marks self-seen, debounced sync, haptic tick. |
| Sync | `pushChats/loadChats/mergeChats` app.js:15755–15807 | Mirrored through the backend `teamChats` Sheet tab. **UNION by id** (threads, messages, tags, participants) so two users never clobber. `setChats/getChats` GAS actions. |
| Backend | `docs/handoffs/wrangler-rail-sync-backend.gs` | `getChats_/setChats_` upsert-only, never delete; one row per chat `[id, json]`. |

`commentUserKey()` identifies the author (role/device-derived). Avatars: deterministic color + initials (`chatAvatarColor`, `chatInitials`).

### 2.2 SHIPPED — Mr.-Wrangler notification bell (§18f, app.js:10915)

A **read-only mirror** of resolved auto-fix tickets — *system* notifications, not customer comms.

| Piece | Where | Behavior |
|---|---|---|
| Feed | `wranglerNotifs[]`, `refreshWranglerNotifications()` app.js:10935 | Pulls `wranglerNotifications` GAS action → recently-resolved `wrangler-fix` GitHub issues with verdicts. |
| Badge | `unseenNotifs()` app.js:10929 | Count of resolved issues with `number > notifsSeenMax()`, unless muted. |
| Seen / dismiss / mute | localStorage keys `jactec.notifsSeen` / `notifsDismissed` / `notifsMuted` (10919–10934) | Opening the bell marks seen; per-issue dismiss + mute persist locally. |
| Popup | overlay `kind: 'notifications'` app.js:9306 | Lists resolved fixes with verdict + GitHub link. **In `WINDOW_CATALOG`** app.js:9807. Button `js-notifications` app.js:7373 (desktop) / 9421 (mobile) / 7447 (FAB). |

There is a sibling **Requests inbox** (overlay `kind: 'requests'`) for Owner/Admin to approve filed Mr.-Wrangler requests (`canApproveRequests`, `roleTier >= manager`). Both are part of the wrangler-AI pipeline, surfaced here because they share the bell chrome.

### 2.3 PARTIAL — Outbound customer messaging (deep-links only)

| Piece | Where | Behavior |
|---|---|---|
| Text a quote | `sendInvoiceText(invoiceId)` app.js:14757 | Builds an SMS body, opens `sms:<tel>?&body=…` deep-link on the device. Logs `Texted quote to <phone>` via `logAction`. **No server send.** |
| Email a quote | `sendInvoiceEmail(invoiceId)` app.js:14746 | Builds a `mailto:` with the quote summary. Logs `Emailed quote to <email>`. **No server send.** |
| Guards | both | Disabled/guarded when the customer has no `phone`/`email` on file. |

These are the *only* customer-facing comms. There is **no** reminder engine, no dispatch alert to customers, no review request, no delivery receipt, and no scheduling.

### 2.4 STUB — Notifications settings tab

`SETTINGS_TABS` entry `{ id: 'notifications', label: 'Notifications', icon: I.bell, note: 'Team chat on/off, driver dispatch alerts, customer reminders & cadence.' }` (app.js:3414). It is a **Planned** stub — no pane renders, no settings slice (`ci/logic-test.mjs:1004` asserts `pageDefaultSlice('notifications') === null`). A sibling `integrations` stub (3415) is where Stripe/Maps/telematics/**SMS-email** references and toggles will live, "secrets stay server-side."

### 2.5 MISSING — what does not exist

- Any **server-side send** for SMS or email (no provider integration).
- A **notification preferences** model (per-role, per-channel, per-event).
- A **reminder/cadence engine** (time-driven sends).
- A **delivery log** entity (sent/delivered/failed/replied).
- A **review/reputation** source feeding the Office KPI.
- **Customer notification consent** (opt-in/opt-out, STOP handling).

### 2.6 Adjacent code this must build on

- **Customers** carry `phone`, `email`, `firstName`, `netDays`, `accountType` (`newCustomer` draft, app.js:9815). Consent fields would be additive here.
- **`logAction(rec, text)`** stamps timestamped history (→ §R13) — the natural home for "Sent / Delivered / Replied" lines.
- **`backendCall(action, body)`** is the single GAS entry point; new sends are **additive actions**.
- **Reputation KPI** `app.js:7130` returns `null` as the third Office ring — this area lights it up.
- **Flag system** (`flag-color-system.md`) already computes per-record urgency — the natural **trigger source** for "what deserves a reminder."

---

## 3. Users, Roles & Data Gates

This area touches **three live gates** — money-action gating, customer-isolation/PII, and pricing-floor exposure. Because the repo ships to the public via Pages and the frontend is fully readable, **every gate below is specified as a SERVER-SIDE enforcement**, with the UI gate as a convenience layer only. A UI-only gate is treated as no gate. Where a gate is loose, it is tightened here and the residual decision is surfaced as an Open Question — never silently loosened.

### 3.1 The roles and who touches comms

Permissions key off **tiers** (`ROLE_TIERS`, config.js:326 — `staff`/`money`/`manager`/`admin`/`developer`, strict superset ladder), **not role names**, because roles are runtime-customizable (Settings → Roles & Logins). The five built-in KPI roles (`ROLES`, config.js:302 — mechanic, mtech, driver, office, sales) plus the manager/admin/developer logins map to tiers via `BUILTIN_ROLE_TIERS` (config.js:340). `roleTier(currentRole)` + `tierRank('…')` is the comparison primitive (cf. `canApproveRequests` app.js:10895). "The 15 roles" = the built-ins plus any custom roles a shop adds; each carries exactly one tier, so the table below is tier-keyed and covers all of them.

| Capability | Min tier | Server-enforced? | Rationale |
|---|---|---|---|
| Read/post in team chat | `staff` (1) | password gate (signed-in) | Any signed-in role; per-thread `participants[]` further scopes visibility. |
| See the resolved-fix bell | `staff` (1) | n/a (read-only mirror) | Read-only system feed, no customer data. |
| Approve Mr.-Wrangler requests | `manager` (3) | yes (existing) | Existing `canApproveRequests` app.js:10895. |
| **Send a customer QUOTE** (exposes a committed price) | `money` (2) | **YES — `sendCustomerMessage` re-checks tier server-side** | Commits a price to the customer; a price commitment is a money action. Office/Sales are `money`. |
| **Send a customer REMINDER / ETA** (no price) | `staff` (1) — **OPEN Q-1** | YES | A start/return/ETA ping carries no pricing; a `staff` driver should be able to fire it. Split from quotes so a driver isn't blocked. **Q-1 confirms the split.** |
| **Fire a `review-request`** | `money` (2) — **OPEN Q-1** | YES | Customer-relationship touch; conservative default at `money` until Jac rules. |
| **Configure reminder cadence / templates / quiet hours** | `admin` (4) | yes (settings write gate) | Settings-level; templates are shop voice + legal copy (STOP/HELP). |
| **Toggle a channel live / pick provider** | `admin` (4) | yes (settings write gate) | Operational + per-message cost; turning SMS "live" spends money. |
| **Edit a customer's consent** (`commsConsent`) | `money` (2) — **OPEN Q-1** | YES | PII + compliance state; only a STOP/START reply (server) may flip it to `opted-out`/`opted-in`. |
| See delivery logs on a record | follows the record's own gate | yes (record gate) | A delivery line on an invoice is visible to whoever can already see that invoice — no new surface. |

**Default-deny rule:** a tier of `0` (unknown/blank, `tierRank` fallback) gets **none** of the above. Any send action with an unresolved or below-threshold tier returns `{ok:false, reason:'forbidden'}` server-side and never reaches the provider.

### 3.2 Customer-isolation & PII

- **PII handled:** customer `phone`, `email`, `firstName`/`name`, and rendered **message bodies** (which may include `total`, dates, unit names). All of this is customer PII.
- **The repo is public via Pages.** No real phone/email/body, no `commsConsent` with real values, and **no provider key** may ever land in a committed file (`data.js`, `config.js`, any doc). The delivery log lives **server-side** (the `messages` Sheet tab); the in-context "comms strip" the operator sees is rendered from a **status-only projection** (see §4.3 / **OPEN Q-9**), not a payload carrying `to`/body.
- **Isolation is enforced on the SEND, not the UI.** A customer only ever receives messages about **their own** records. `sendCustomerMessage` MUST (server-side):
  1. resolve the recipient `phone`/`email` from the record's **own** `customerId`, never from a client-supplied `to`;
  2. assert that `recId`'s owner **equals** the supplied `customerId` (reject `{ok:false, reason:'isolation'}` on mismatch — a tampered client cannot send Customer A's record to Customer B);
  3. treat any client-supplied `to` as advisory/ignored (**OPEN Q-7**: forbid ad-hoc recipients entirely in v1).
- **Inbound** (STOP/replies) is matched back to a customer **by the sending phone number** server-side; an inbound from an unknown number is logged but **never auto-attached** to an arbitrary customer (anti-spoof, see §10).
- **Team chat** is internal-only and already role-scoped by `participants[]`; no customer ever sees it, and no customer PII is *authored into* a chat thread by this area (a reply-surface ping references the customer by id/name only — **OPEN Q-5**).

### 3.3 Money / pricing-floor gating

- A texted/emailed **quote** exposes `invoiceTotals(inv).total` to the customer — that is the customer-facing price and is correct to share. It MUST **never** expose `bottomDollar`, `cost`, `margin`, or any internal pricing-floor field. The existing body builder `invoiceQuoteSummary` (app.js:14740) / `sendInvoiceText` (app.js:14757) already pass **only** `invoiceTotals(inv).total` and `money2()` — **this is canon; preserve it.**
- **Server-side var allowlist (hard floor).** `sendCustomerMessage.vars` is filtered against an explicit **allowlist** (`firstName`, `total`, `startDate`, `endDate`, `unitName`, `invoiceId`, `dueDate`, `companyName`, `companyPhone`). Any var **not** on the allowlist — notably `bottomDollar`, `cost`, `margin`, `floorPrice` — is **dropped, never interpolated**. This is enforced on the server (the public client cannot be trusted) and asserted in `ci/logic-test.mjs` (§9.4). A reject-on-unknown-var posture, not a strip-known-bad posture, so a future floor field can't leak by being un-blocklisted.
- Sending a quote is a `money`-tier action (it commits a price). A reminder/ETA carries no price → may drop to `staff` (**OPEN Q-1**). The tier check and the var allowlist are **independent** gates: even a `money` operator's quote runs through the allowlist.

---

## 4. Data Model

Schema-less Sheets + additive JSON fields. Nothing renames or drops existing fields.

### 4.1 Existing (do not change)

| Entity | Fields used by comms | Where |
|---|---|---|
| Customer | `customerId`, `phone`, `email`, `firstName`, `name`, `accountType`, `netDays` | `newCustomer` draft, app.js:9815 |
| Invoice | `invoiceId`, `customerId`, `total` (via `invoiceTotals`) | app.js:14761 |
| Chat thread | `{ id, tags[], participants[], messages[], seen{} }` | `state.chat.chats` |
| Notif (system) | `{ number, title, verdict, url, closedAt, merged }` | `wranglerNotifs` |

### 4.2 Proposed — additive customer fields (consent)

Added to the customer record (Sheets column auto-appends; `data.js` shape gains keys):

```js
// on a customer record
commsConsent: {
  sms:   'opted-in' | 'opted-out' | 'unknown',   // STOP reply → 'opted-out'
  email: 'opted-in' | 'opted-out' | 'unknown',
  updatedAt: <epoch>,
  source: 'signup' | 'reply-stop' | 'manual'
}
```

Default `'unknown'`. **OPEN Q-2:** is `'unknown'` treatable as implied-consent for transactional (quote/reminder) messages, with opt-out only for marketing? (US TCPA: transactional generally OK; marketing needs express consent.)

### 4.3 Proposed — message/delivery log entity

A new schema-less collection `messages` (one Sheet tab `messages`, one row per send), **not** part of the R/Y/G flag entities. The **full row (with `to`) lives server-side only.** What the client sees is a **redacted projection** (the "status projection" — fields marked `client?` = yes below); the PII-bearing fields (`to`, and the body if Q-8 chooses to store it) **never enter the sync payload or the demo seed**.

```js
// `messages` Sheet row (server-authoritative).  client? = present in the
// status projection the client renders; the rest stay server-side.
{
  msgId:      'MSG-…',          // PERSIST_ID key                    client? yes
  channel:    'sms' | 'email',                                   // client? yes
  direction:  'outbound' | 'inbound',                            // client? yes
  entity:     'invoice' | 'rental' | 'customer',                 // client? yes
  recId:      '<id of the record it concerns>',                  // client? yes
  customerId: '<recipient customer id>',                         // client? yes (id only, not contact)
  to:         '<phone|email>',  // PII — SERVER-ONLY, never synced, never seeded  client? NO
  event:      'quote'|'reminder-start'|'reminder-return'|'reminder-balance'|'dispatch-eta'|'review-request'|'manual',  // client? yes
  templateId: 'quote-sms-v1',                                    // client? yes
  toMasked:   '(•••) •••-1234',  // server-derived display mask, safe to show     client? yes
  bodyHash:   '<sha of rendered body>',  // proves content w/o storing PII body — OPEN Q-8  client? yes
  status:     'queued'|'sent'|'delivered'|'failed'|'replied'|'opted-out'|'deferred',  // client? yes
  providerId: '<vendor message id>',     // webhook reconciliation key            client? NO (internal)
  error:      '<provider error code/null>',  // a CODE, not a PII-bearing string   client? yes
  cycle:      <n>,             // for recurring balance reminders (OPEN Q-4)       client? yes
  at:         <epoch>,                                            // client? yes
  by:         '<operator role/user, or "system" for cron/sweep>' // client? yes
}
```

The status projection is what feeds the §6.2 comms strip; it is enough to render `SMS · Quote · Sent 2:14p ✓ Delivered` (using `toMasked`, never the raw `to`). The strip is also mirrored as a `logAction` line on the record's `history` (→ §R13) for operators who can already see the record — that line is also masked (`Texted quote to (•••) •••-1234`), a deliberate change from today's `Texted quote to <full phone>` (app.js:14767), so a synced history cell can't carry a full number (**OPEN Q-8b**: mask the history line, or keep the current full-number line for support?).

### 4.4 Proposed — notification preferences (settings slice)

Stored in the backend settings blob (same mechanism as other settings slices), loaded at boot. **Per-role** for internal, **per-event** for customer:

```js
settings.notifications = {
  team:    { enabled: true },                         // team-chat dock on/off
  bell:    { enabled: true },                         // resolved-fix bell
  dispatch:{ etaAlerts: false },                      // "your unit is on the way" toggle
  customer:{
    quoteAutoFollowup: false,                         // re-ping unsent quote after N days
    reminders: {
      start:   { enabled: false, leadDays: 1 },
      return:  { enabled: false, leadDays: 1 },
      balance: { enabled: false, afterDueDays: 3 },
    },
    review:  { enabled: false, delayDays: 2 },        // after rental complete
  },
  channelPriority: ['sms', 'email'],                  // try-order if both on file
  quietHours: { start: 20, end: 8 },                  // no automated sends overnight (local LA)
}
```

### 4.5 Migration concerns

- All new fields are **additive**; old records lack them and read as `undefined` → treated as `'unknown'`/disabled. No backfill required.
- `messages` is a new collection → add to `PERSIST_KEYS`/`PERSIST_ID`/`IDX_MAP` if it should sync like other entities (**OPEN Q-9**: full-sync entity vs. server-only log the client reads but never authors).
- Demo `data.js` seeds a **few fake** message-log rows with **fictional** numbers only.

---

## 5. Backend / Integration Contract

Backend = Google Apps Script, schema-less Sheets, **additive actions** on the single `backendCall` entry point. `Code.gs` is gitignored — this spec defines the **contract**, not the implementation.

### 5.1 Existing actions (canon)

| Action | Body | Returns | Notes |
|---|---|---|---|
| `getChats` | — | `{ ok, chats[] }` | team chat, all rows |
| `setChats` | `{ chats }` | `{ ok, saved }` | upsert-only, never delete |
| `wranglerNotifications` | — | `{ ok, notifications[] }` | resolved-fix feed |
| `wranglerRequests` / `wranglerApprove` / `wranglerDismiss` | — / `{number}` | `{ ok, … }` | requests inbox |

### 5.2 Proposed — additive send actions

> **External provider:** an SMS/email vendor (Twilio-class SMS + transactional email — e.g. SendGrid/Postmark). Provider **API keys live ONLY in GAS Script Properties** (named `SMS_API_KEY`, `SMS_FROM`, `EMAIL_API_KEY`, `EMAIL_FROM` — *names only*, never values, never in repo). The frontend never holds a key. **OPEN Q-3** picks the actual vendor(s).

```text
ACTION: sendCustomerMessage
  body: {
    entity, recId, customerId,
    event,            // 'quote' | 'reminder-*' | 'review-request' | 'manual'
    channel,          // 'sms' | 'email' | 'auto'  (auto = channelPriority)
    templateId,       // server renders from a server-side template registry
    vars              // { firstName, total, dates, unitName, … }  (NO cost/margin)
  }
  server:
    1. resolve recipient from customerId  → reject if mismatch w/ recId owner (isolation)
    2. check commsConsent[channel] != 'opted-out'  → else return {ok:false, reason:'opted-out'}
    3. check quietHours (defer if automated)
    4. render template server-side (templates NOT in public repo)
    5. POST to provider; capture providerId
    6. append a `messages` row {status:'sent', providerId, …}
  returns: { ok, msgId, status, providerId } | { ok:false, reason, error }
```

```text
ACTION: messageStatus            (webhook reconcile / poll)
  body: { since? }               // epoch; returns deltas
  returns: { ok, updates:[{ msgId|providerId, status, at, error? }] }
  // provider delivery/failure/reply webhooks land in a GAS doGet/doPost or a
  // poll; the action surfaces status transitions so the client log updates.
```

```text
ACTION: inboundMessage           (provider → us; STOP/replies)
  // Provider posts inbound SMS/email to a GAS doPost webhook. Server:
  //   0. VERIFY the provider signature first — drop+log if invalid (anti-spoof)
  //   1. match the sending number/address → a customer (server-side). Unknown
  //      sender → log as unattached inbound, NEVER auto-attach to a customer.
  //   2. 'STOP'/'UNSUBSCRIBE'/'END'/'QUIT' → set commsConsent[channel]='opted-out',
  //      source:'reply-stop'; reply provider-required confirmation; STOP all future
  //      automated sends on that channel.
  //   3. 'START'/'UNSTOP' → set commsConsent[channel]='opted-in', source:'reply-start'.
  //   4. else → append a `messages` row {direction:'inbound', status:'replied'};
  //      surface a team-chat thread auto-tagged to the customer and/or a bell ping
  //      (OPEN Q-5). The reply text is server-stored; the ping references the
  //      customer by id/name, not the raw inbound body, to avoid PII in synced chat.
  // returns: { ok } (provider expects a fast 200; reconciliation is async)
```

```text
ACTION: runReminderSweep         (time-driven; GAS installable trigger / cron)
  // Server walks records, evaluates settings.notifications.customer.reminders
  // against today, fires sendCustomerMessage for each due record, dedups by
  // (recId,event,day). NOT client-invoked. Logs each send.
```

### 5.3 Auth, gating & failure handling

**Server-side gate order** for `sendCustomerMessage` (each step rejects before the next; the provider is the LAST thing touched):

1. **Signed-in:** existing backend password gate. Absent → `{ok:false, reason:'auth'}`.
2. **Tier:** resolved role tier ≥ the event's threshold (quote/review/consent-edit = `money`; reminder/ETA = `staff` pending **Q-1**). Below → `{ok:false, reason:'forbidden'}`. *Server-enforced* — never trust the UI, because the client is public.
3. **Isolation:** `recId` owner must equal `customerId`; recipient resolved from `customerId` server-side. Mismatch → `{ok:false, reason:'isolation'}`.
4. **Consent:** `commsConsent[channel] !== 'opted-out'`. Opted-out → `{ok:false, reason:'opted-out'}` (logged as an `opted-out` row, no provider call).
5. **Var allowlist:** drop any `vars` key not on the §3.3 allowlist (no floor/cost/margin can survive).
6. **Quiet hours:** automated sends outside the window → `deferred` (queued); manual sends pass.
7. **Cost cap:** if the daily send count ≥ the cap, automated sends defer to tomorrow; a manual send over cap requires an explicit confirm (**OPEN Q-6**).
8. Render template server-side → POST to provider → append `messages` row.

- **Graceful degradation:** if a provider key (`SMS_API_KEY` / `EMAIL_API_KEY`, *names only*) is absent in Script Properties (dev/offline), `sendCustomerMessage` returns `{ok:false, reason:'no-provider'}` and the **client falls back to the existing `sms:`/`mailto:` deep-link** — the deep-link path is **kept**, not removed. Mirrors the "graceful skip if handler absent" pattern (`backend-data.md:207`). The fallback deep-link still runs the §3.3 body builder, so no floor field leaks even on the fallback path.
- **Idempotency / dedup:** the reminder sweep dedups by `(recId, event, day)` (and `(recId, event, cycle)` for recurring balance reminders) using the `messages` log as the ledger, so a re-run, a double-trigger, or two overlapping crons never double-texts. The dedup check is a server read of the log **before** the provider call.
- **Webhook authenticity (inbound + status):** the provider's delivery/inbound webhooks MUST be **signature-verified server-side** (provider HMAC / shared secret in Script Properties) before any state change. An unverified or unparseable webhook is dropped and logged, **never** allowed to flip `commsConsent` or attach a reply — this is the anti-spoof control for the STOP path (§10).
- **Cost guard:** a server-side **daily send cap** + a confirm before any bulk/automated batch (**OPEN Q-6**), so a buggy sweep can't bill the shop for thousands of texts before a human notices.
- **No retry storms:** a `failed` send is logged and retried at most on the **next scheduled sweep**, not in a tight loop; transient provider 5xx uses a single bounded retry, never client-driven.

---

## 6. UX / UI

All new UI in the **yard data-plate** language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), ONE safety-orange `--accent #ff7a1a` for ignition/primary, hi-vis hazard-stripe (`repeating-linear-gradient(135deg, var(--yellow) 0 13px, #14181d 13px 26px)`) reserved for the send-confirm/danger affordance, Saira Condensed stamped labels, corner rivets, leather-tan ranch seasoning mostly in copy. **Run every screen below through the `jactec-ui` skill before building.** Every new element gets a **`data-r` stamp**; every new popup gets a **`WINDOW_CATALOG` entry**.

### 6.1 Send-from-record affordance (manual, Phase 1)

The existing "Text quote / Email quote" buttons stay where they are (invoice detail) but gain a **confirmation plate** when a server send is available:

- Tapping "Text quote" opens a small **Send confirm** plate (not a full overlay if inline) showing: stamped label `SEND TO OPERATOR-NAME`, the recipient (masked: `(•••) •••-1234`), channel chip (`SMS` / `EMAIL`), and the rendered preview body in a read-only steel panel.
- Primary "Send" = ignition orange. A **hazard-stripe edge** on the send button signals "this leaves the building." Ranch copy: "**Send it down the line**" / on success "**Sent — much obliged.**"
- States: *no provider* → button reads "Open in Messages" (deep-link fallback, no confirm). *opted-out* → button disabled with stamped "Opted out" tag + tooltip. *no phone/email* → existing disabled guard.
- **R-stamp:** the confirm plate, masked-recipient line, channel chip, and the ignition Send button each get a new `data-r` id; `rule-usage.js` regenerated via `ci/gen-rule-usage.mjs` (drop `--check`). No duplicate-rule.
- **WINDOW_CATALOG:** if the confirm is a `buildPopupEl`/overlay kind (`{ kind: 'sendConfirm' }`), it MUST be added to `WINDOW_CATALOG` (app.js:9796) **with a `sample()` that uses fictional contact data** (the catalog preview renders inert — see `previewOverlayFor` app.js:9831 — so the sample must never reach a real number) and pass `check-window-catalog.mjs`. If it's an inline plate (not an overlay kind), it is correctly absent (cf. the date-picker exception, `search-views.md`). **Recommend the inline-plate form** to avoid a new catalog entry and keep the send one tap from the record — confirm during build.
- **Quality floor (jactec-ui):** responsive reflow, a visible focus ring on Send/Cancel, `prefers-reduced-motion` respected on the hazard-stripe edge, and the boldness spent in ONE place (the orange ignition Send) — not scattered. Screenshot + self-critique before showing Jac.

### 6.2 Delivery log row (in record history)

On the invoice/rental/customer detail, a **comms strip** under history: each `messages` row as a stamped line —
`SMS · Quote · Sent 2:14p ✓ Delivered` / `· Failed (invalid number)` / `← Replied "yes"`. Status glyph from the existing library (never hand-drawn). Failed = `--red` dot; delivered = `--green`; queued = `--yellow`. Reuses the flag-color vocabulary so the operator reads it at a glance.

### 6.3 Notifications settings pane (fills the stub, Phase 2)

The `notifications` `SETTINGS_TABS` stub (app.js:3414) becomes a real pane (admin-tier). Sections as stamped steel cards:

1. **Internal** — Team-chat dock on/off; resolved-fix bell on/off.
2. **Dispatch** — "Tell customers when their unit's on the way" toggle (ETA alerts).
3. **Customer reminders** — three toggles + lead-day steppers (Starts, Returns, Balance) with a stamped cadence summary ("Reminds the day before — 1 day lead").
4. **Reviews** — "Ask for a review after a rental wraps" toggle + delay stepper.
5. **Channels** — SMS/email priority order; quiet-hours window; the **integration reference** (provider name + status pill `LIVE`/`OFFLINE`, **never the key**) — actual keys live in the `integrations` tab as server-side references only.

Saddle-stitch tan dashed dividers between sections (ranch seasoning). **R-stamps** on every toggle/stepper; this pane is inside the existing Settings popup (already catalogued) so likely **no new WINDOW_CATALOG entry** — confirm during build.

### 6.4 Customer consent surface

On the customer detail, a small stamped **consent plate**: `SMS ✓ opted-in · EMAIL — unknown`, editable by `money`+ tier. STOP-driven opt-outs show a leather-tan "Opted out via reply" stamp (read-only, only the customer's STOP/START changes it).

### 6.5 Mobile reflow

- The send-confirm plate becomes a bottom sheet (phone), respecting `dvh`/safe-area, with the same masked recipient + preview.
- The notifications settings pane reflows to single-column stacked cards.
- Haptic tick on a successful send (mirrors `chatSend`'s `haptic([12,30,12])`).
- Respect `prefers-reduced-motion` on the hazard-stripe send edge (no animation).

### 6.6 Empty / loading / error states

- **Empty log:** "No messages sent yet — quotes and reminders you send show here." (stamped, ranch-tinted).
- **Loading status:** the delivery glyph shows a `queued` (yellow) pulse until `messageStatus` resolves.
- **Send error:** toast in shop voice — "Couldn't send — the line's down. Saved as a draft." + the row logs `failed`.
- **No provider:** the whole automated section shows a stamped "Channel offline — sends open your phone instead" notice.

---

## 7. Business Rules / Derivations / Money

### 7.1 Reminder trigger derivations

Reminders are **derived from existing flags/dates**, not a new clock per event:

| Event | Fires when | Lead/offset | Source signal |
|---|---|---|---|
| `reminder-start` | `status === 'Reserved'` and `startDate === today + leadDays` | `leadDays` (default 1) | mirrors `starts-today`/`starts-tomorrow` flags |
| `reminder-return` | rental `End Rent`/window-end is `today + leadDays` | `leadDays` (default 1) | mirrors `end-rent` flag |
| `reminder-balance` | invoice `Unpaid`/`Late` and `dueDate < today - afterDueDays` | `afterDueDays` (default 3) | mirrors invoice `late`/`unpaid` flags |
| `review-request` | rental `r.completed === true` and `today >= completedAt + delayDays` | `delayDays` (default 2) | the `complete-rental` → completed transition |
| `dispatch-eta` | dispatch marks a unit en-route (rentals-dispatch) | immediate | dispatch action |

**Dedup rule:** one send per `(recId, event)` ever (or per `(recId, event, cycle)` for recurring balance reminders — **OPEN Q-4**). The `messages` log is the dedup ledger.

### 7.2 Quiet hours

No **automated** send fires outside `quietHours` (default 20:00–08:00 America/Chicago — Sulphur, LA is Central; **OPEN Q-10** confirm TZ). A **manual** send always goes (a human chose). Deferred sends queue to the next allowed window.

### 7.3 Money exposure rule

A customer-facing body may include `invoiceTotals(inv).total` ONLY. The template var allowlist **excludes** `bottomDollar`, any `cost`, any `margin`. This is a hard server-side filter on `sendCustomerMessage.vars` — an unknown var name is dropped, not interpolated.

### 7.4 Reputation KPI derivation (lights up the null ring)

Office ring 3 (`app.js:7130`) currently `null`. Once a review channel + source exists:

```
Reputation = (Σ review stars / (5 × review count)) × 100      // % of max
```

`review count` and `stars` come from the review source (**OPEN Q-3b**: where do stars come from — a Google review scrape, a reply-with-rating SMS, or a hosted form?). Until a source lands, the ring **stays null** (consistent with `financials-kpi.md` Q7).

### 7.5 Edge cases

- Customer with **both** phone+email and `channelPriority` → try first channel; on `failed`, fall to next (**OPEN Q-11**: auto-fallback or stop on first failure?).
- Customer opts out mid-cadence → all future automated sends to that channel suppress; manual send shows the opted-out block.
- A rental spanning a quiet-hours boundary on its start day → the start reminder queues to 08:00.
- Duplicate records / merged customers → dedup by `customerId`; a merge must re-point `messages.customerId`.

---

## 8. Phasing & Milestones

### Phase 1 — Real server send + delivery log (MVP)
**In scope:** `sendCustomerMessage` + `messageStatus` actions; provider wired (one channel — **SMS first**, OPEN Q-3); the send-confirm plate replacing the bare deep-link for **manual quote send**; the `messages` log + the comms strip on invoice/rental detail; deep-link kept as the no-provider fallback; consent fields read (opt-out respected) even if not yet editable.
**Out of scope:** automation/cron, reminders, reviews, settings pane.

### Phase 2 — Notification preferences + reminder engine
**In scope:** fill the Settings → Notifications stub (admin); `settings.notifications` slice; `runReminderSweep` GAS trigger; start/return/balance reminders; quiet hours; quote auto-followup; consent surface editable.
**Out of scope:** reviews, dispatch ETA, inbound replies UI.

### Phase 3 — Inbound, dispatch ETA, reviews / Reputation
**In scope:** `inboundMessage` webhook (STOP handling + reply surfacing into chat/bell); `dispatch-eta` send wired to rentals-dispatch; `review-request` send + review source + the Reputation KPI lit.
**Out of scope:** marketing campaigns (→ `marketing` area), AI-drafted messages (→ `wrangler-ai`).

---

## 9. Acceptance Criteria

Each criterion is phrased so a test (or a manual repro on `localhost:9147`) can pass/fail it. **AC-2 through AC-6 are the gate criteria** — they must be asserted server-side, not just in the UI.

1. **Manual send (Phase 1):** with a live provider, "Text quote" calls `sendCustomerMessage` server-side, returns a `providerId`, appends a `messages` row `status:'sent'`, and the invoice history shows a (masked) line. With **no** provider, the same button opens the device `sms:` deep-link (fallback intact, no console error). *Test: `ci/smoke.mjs` boots with no provider and the deep-link path is reachable.*
2. **Isolation (server):** `sendCustomerMessage` with a `recId` whose owner ≠ `customerId` returns `{ok:false, reason:'isolation'}` and makes **no** provider call. A client-supplied `to` is ignored; the recipient is always resolved from `customerId`. *Test: `ci/logic-test.mjs` unit over the resolve/assert helper.*
3. **Money gate (server):** a `staff`-tier session firing a `quote`/`review-request`/consent-edit returns `{ok:false, reason:'forbidden'}` regardless of UI state. A `staff` reminder/ETA succeeds **iff Q-1 chooses the split** (the test pins whichever answer Jac picks). *Test: `ci/logic-test.mjs` tier matrix.*
4. **No floor/cost leak:** a `sendCustomerMessage.vars` payload carrying `bottomDollar`/`cost`/`margin`/`floorPrice` drops every non-allowlisted key; the rendered body contains only allowlisted vars (`total`, `firstName`, dates, unitName, …). An **unknown** var name is dropped, not interpolated. *Test: `ci/logic-test.mjs` asserts the allowlist filter — reject-on-unknown, not strip-known-bad.*
5. **Opt-out respected (server):** a customer with `commsConsent.sms==='opted-out'` cannot receive an automated **or** manual SMS; the server suppresses, logs an `opted-out` row, makes no provider call. A STOP webhook (signature-verified) flips consent to `opted-out`; an unsigned STOP is dropped. *Test: `ci/logic-test.mjs`.*
6. **Reminder dedup:** running `runReminderSweep` twice on the same day yields exactly one `messages` row per `(recId, event[, cycle])`. *Test: `ci/logic-test.mjs` idempotency over the dedup ledger.*
7. **Status reconcile:** a signature-verified delivery webhook flips a `sent` row to `delivered`; the comms strip updates from the **status projection** (never re-fetching `to`/body). A `failed` webhook shows `--red` and logs the error code.
8. **Settings pane:** the Notifications tab renders a real pane (no longer a stub); **`ci/logic-test.mjs:1004` (the `pageDefaultSlice('notifications') === null` assertion) is intentionally updated** to assert the new slice shape — this test change is deliberate and reviewed, not incidental.
9. **CI gates green:** `ci/smoke.mjs` (boots, no-provider fallback path OK), `ci/logic-test.mjs` (AC-2…AC-6 + slice change), `ci/gen-rule-usage.mjs --check` (every new `data-r` regenerated, no dup-rule), `ci/check-window-catalog.mjs` (any new overlay kind catalogued), `tools/gen-code-map.mjs --check` (any new/moved APP-xx chapter banner regenerated). Port 8000 is reserved → swap to 9147 per CLAUDE.md before running.
10. **No secrets / PII in repo:** no provider key/secret, no real phone/email/rendered body, no `commsConsent` with real values in any committed file; demo seed uses **fictional** numbers/addresses only; `messages` PII fields (`to`, body) never enter the sync payload or `data.js`. *Verifiable by inspection + the `/security-review` of the diff.*

### CI-gate impact summary

| Gate | Impact |
|---|---|
| `gen-rule-usage` | new `data-r` stamps (confirm plate, comms strip, settings toggles) → regenerate |
| `check-window-catalog` | new `sendConfirm` overlay kind (if used) → add to `WINDOW_CATALOG` |
| `gen-code-map` | new chapter banner if a `messages`/comms section is added to `app.js` → regenerate |
| `logic-test` | **deliberately changes** the `notifications` no-slice assertion; adds money-gate + cost-leak + dedup tests |
| `smoke` | must still boot with no provider (fallback path) |

---

## 10. Risks & Edge Cases

| Risk | Severity | Mitigation |
|---|---|---|
| **Cost runaway** — a buggy sweep texts every customer | High | server-side daily cap; confirm before bulk; dedup ledger; quiet hours |
| **PII leak via public repo** | High | provider keys + recipient bodies server-only; demo seed fictional; cost/margin var allowlist |
| **Cross-customer mis-send** | High | server resolves recipient from `customerId`; reject ad-hoc `to` (OPEN Q-7) |
| **TCPA/CAN-SPAM compliance** | High | consent model + STOP handling (Phase 3); transactional-only until consent UI lands; legal review (OPEN Q-2) |
| **Double-send / multi-user** | Med | `messages` dedup by `(recId,event,day)`; sweep idempotent; chat-style union merge if `messages` syncs |
| **Provider outage** | Med | graceful fallback to deep-link; `failed` status logged; retry on next sweep |
| **Stale delivery status** | Med | `messageStatus` poll + webhook; queued shown until resolved |
| **Offline operator** | Low | deep-link fallback works offline; server log catches up on reconnect |
| **Timezone drift** (quiet hours / lead days) | Med | pin to America/Chicago; compute on server (OPEN Q-10) |
| **Inbound spoofing** (fake STOP webhook flips consent, or fake reply attaches to a customer) | High | verify provider webhook signature server-side BEFORE any state change; unknown sender never auto-attaches |
| **PII in synced cells** — a full phone/body in a `messages` row or `history` line rides the public client sync | High | `to`/body are server-only; client gets a status projection + `toMasked`; history line masked (OPEN Q-8b) |
| **UI-only gate bypass** — money/isolation gate hidden in UI but not enforced server-side; a crafted `backendCall` sends anyway | High | every gate (tier, isolation, consent, var-allowlist) re-checked **server-side** in `sendCustomerMessage`; UI gate is convenience only |
| **Consent race** — a send fires between an inbound STOP arriving and being processed | Low | consent read server-side at send time; STOP processed synchronously on the inbound webhook; worst case one in-flight message, acceptable under TCPA's reasonable-time rule (OPEN Q-2) |
| **Merged-customer mis-route** — a customer merge leaves `messages.customerId` pointing at the dead id | Med | merge must re-point `messages.customerId` (cf. §7.5); dedup keyed on the surviving id |
| **Quiet-hours queue pile-up** — many deferred sends all fire at 08:00 and trip the cost cap | Low | the cost cap also applies to the released queue; spill to the next window |

---

## 11. Open Questions

> **Resolved 2026-06-29:** Q-3 → D1 (MoceanAPI SMS) · Q-1 → D2 (sends open to all; isolation+allowlist+consent still server-enforced) · Q-6 → D3 (hands-off auto + quiet hours) · Q-3b → D4 (Reputation = multi-source composite). Adopted Q-2/7/8b/9/10/11/13/14/15/16/17. See the Decisions block up top.

> No seed questions were captured for this area; **every question below was surfaced from the code and the forks hit while drafting/hardening.** Each needs Jac's call before build. The gate-sensitive ones — Q-1 (send tier), Q-2 (consent model), Q-7 (ad-hoc recipient), Q-8/Q-8b (body/history PII), Q-9/Q-17 (sync vs. server-only log), Q-16 (opted-out override) — are the ones that must be settled BEFORE any send code ships, because each is a "wrong = live PII / pricing / compliance leak" call.

| # | Question | Trade-offs |
|---|---|---|
| **Q-1** | **What tier can fire a customer send?** Quote (exposes price) vs. a pre-authored reminder (no price). | `money`+ for everything is safest but blocks a `staff` driver from sending an ETA. Split: quotes=`money`, reminders=`staff`? Or all customer comms=`money`? |
| **Q-2** | **Consent model** — treat `'unknown'` as implied consent for transactional messages, requiring opt-out only for marketing? | Pro: ship Phase 1 without a consent-capture flow (TCPA generally permits transactional). Con: needs a quick legal sanity check; marketing later needs express opt-in anyway. |
| **Q-3** | **Which provider(s)?** (a) SMS vendor (Twilio vs. a cheaper aggregator); (b) email vendor (SendGrid/Postmark/Resend); (c) start SMS-only or both? | SMS is the higher-value channel for a yard but costs per message + needs a number/10DLC registration. Email is cheap but lower open rates. Recommend **SMS-first**, email Phase 2. |
| **Q-3b** | **Review/Reputation source** for the null KPI — Google Business review scrape, reply-with-stars SMS, or a hosted review form link? | Google reviews feed the *public* reputation but are hard to read programmatically. A reply-rating is in our control but is a private signal. Hosted form is most flexible, most build. |
| **Q-4** | **Recurring balance reminders** — one-and-done per overdue invoice, or re-ping every N days until paid? | Re-ping collects better but risks annoyance/opt-outs. Cap at e.g. 3 reminders? |
| **Q-5** | **Where do inbound replies surface?** A team-chat thread auto-tagged to the customer, a bell ping, or both? | Chat keeps context with the record (fits APP-23). Bell is more visible. Both = noisiest but safest. |
| **Q-6** | **Bulk/automated send confirmation** — does the nightly sweep send silently, or require a morning "approve today's reminders" review? | Silent = true automation (the north star). Review = safer rollout, more friction. Maybe silent after a trust period? |
| **Q-7** | **Allow ad-hoc recipients** (type a number) at all, or strictly send to the record's customer? | Ad-hoc is flexible (text a one-off) but breaks isolation guarantees and complicates the log. Recommend: **record-only** for v1. |
| **Q-8** | **Store the rendered body** in the `messages` log, or only a hash + templateId+vars? | Storing the body aids support/audit but is PII that must stay server-only (never in the public-syncable client cell). Hash+template is leaner and safer; reconstruct on demand server-side. |
| **Q-8b** | **Mask the `logAction` history line** (`Texted quote to (•••) •••-1234`) instead of today's full-number line (app.js:14767)? | Masking stops a full phone from riding a synced `history` cell (the cell is public-syncable). Con: support loses the at-a-glance number; they'd read it from the server-side log. Recommend **mask** — the full number is one resolve away server-side. |
| **Q-9** | **Is `messages` a full-sync entity** (in `PERSIST_KEYS`, client can read) **or server-only** (client reads via an action, never authors)? | Full-sync fits the existing union-merge plumbing but puts recipient PII in the client sync payload. Server-only log is safer; the client just renders status. |
| **Q-10** | **Timezone for quiet hours + lead days** — America/Chicago (Sulphur, LA is Central), computed server-side? | Yes almost certainly, but confirm; the client `TODAY_ISO` is device-local and unreliable for a cron. |
| **Q-11** | **Channel fallback** — if the priority channel `failed`, auto-try the next, or stop and log? | Auto-fallback maximizes reach but can double-cost and confuse the customer (text *and* email). Recommend: stop-and-log for automated, manual operator chooses. |
| **Q-12** | **Does the team-chat dock belong in this area or `wrangler-ai`?** It's listed here, but its sync rides `backend-data` and its UI overlaps the Mr.-Wrangler dock. | Keep chat here (it's a comms channel), reference the wrangler dock from `wrangler-ai`. Confirm ownership so specs don't fight. |
| **Q-13** | **Template authoring** — hardcoded shop-voice templates in v1 (like the current `sendInvoiceText` body), or an admin-editable template editor? | Hardcoded ships fast and keeps voice consistent; editable is a Phase-2+ "wants." Recommend hardcoded v1, editor later. |
| **Q-14** | **Where do templates live** — server-side GAS registry only (rendered server-side, never in the public repo), or shipped in `config.js`? | Server-side keeps body text + legal STOP/HELP copy out of the public repo and lets render run after the var-allowlist; `config.js` is simpler but public. Recommend **server-side registry** (frontend passes `templateId` + allowlisted vars only). |
| **Q-15** | **Daily send-cap value + scope** — per shop, per channel? What number trips the confirm/defer? | Too low blocks a legit busy day; too high defeats the runaway guard. Needs a real send-volume estimate from Jac (e.g. 200/day SMS?). Make it an admin setting with a conservative default. |
| **Q-16** | **Can a `money`+ operator override an opted-out customer on a MANUAL send?** (e.g. a genuinely transactional "your unit is here" to someone who texted STOP.) | Override risks a TCPA violation; hard-blocking risks a stuck dispatch. Recommend **hard-block all channels on opted-out, no override** — the operator uses a phone call instead. Confirm. |
| **Q-17** | **Should `messages` (status projection) sync via the existing 11-entity diff layer, or a dedicated read-only action?** (overlaps Q-9 but is the concrete plumbing fork.) | Diff-sync reuses `computeChanges`/`PERSIST_KEYS` but every client then holds the projection; a dedicated `getMessages(recId)` action fetches on demand and keeps less on each device. Recommend **on-demand action** for the strip, given the PII sensitivity. |
| **Q-18** | **Does lighting the Reputation ring require BOTH a review source AND a minimum review count** before showing a non-null value (avoid a "100% from 1 review" vanity number)? | A floor (e.g. ≥5 reviews) makes the KPI honest but keeps the ring null longer; no floor lights it sooner but is noisy. Recommend a small floor, surfaced in `financials-kpi`. |

---

## 12. Dependencies & Sequencing

**This area depends on** (roadmap slugs): `rentals-dispatch`, `customers-crm`, `invoicing-payments`, `wrangler-ai`, `backend-data`, `mobile-remote`.

| Dependency | Why | Must land first? |
|---|---|---|
| `backend-data` | new additive GAS actions + the `messages`/settings Sheet tabs + Script-Property secrets ride this layer (`backend-data.md:382`). | **Yes** — the send actions + log live here. |
| `customers-crm` | recipient `phone`/`email`, consent fields, customer-isolation. | **Yes** — consent fields are additive to the customer entity. |
| `invoicing-payments` | the quote body (`invoiceTotals`), the existing send buttons, the delivery log on invoices. | **Yes** for Phase 1 (manual quote send). |
| `rentals-dispatch` | the `dispatch-eta` trigger + return-reminder window signal. | Phase 3 (ETA); Phase 2 for return reminders. |
| `financials-kpi` | consumes the lit **Reputation** ring; blocked until a review source exists (`financials-kpi.md:455`). | Downstream — this area *unblocks* it. |
| `wrangler-ai` | shares the dock/bell chrome; future AI-drafted messages. | Parallel; resolve ownership (Q-12). |
| `mobile-remote` | bottom-sheet send-confirm, haptics, safe-area on phones. | Parallel (Phase 1 desktop, Phase 2 mobile polish). |
| `automated-pricing` / `flag-color-system` | the flags are the natural reminder triggers (§7.1). | Soft dep — flags already shipped; reuse don't rebuild. |

**Sequencing:** `backend-data` (Sheet tabs + Script Properties + action skeleton) → `customers-crm` consent fields → **Phase 1** (manual server send + log, invoicing-payments) → **Phase 2** (settings pane + reminder cron) → **Phase 3** (inbound + dispatch ETA + reviews → unblocks `financials-kpi` Reputation + feeds `sales-growth`/`marketing`).

**Areas this area unblocks:** `financials-kpi` (Reputation ring), `sales-growth` & `marketing` (both list `comms-notifications` as a dependency for outreach), `customers-crm` (its review-request hook, `customers-crm.md:404`).
