# Collections — SPEC v1 (DRAFT)

**Date:** 2026-06-29
**Status:** DRAFT — for critique
**Area branch:** `area/collections`
**Task branch:** `collections/spec` (proposed)
**Maturity:** greenfield
**Scope:** Turn the existing 120-day **Collections** aging tier (today only a red pill color) into an actionable feature — flag an uncollectable invoice, send it to a **3rd-party collections agency** via a server-held outbound integration, track its status, and reconcile any recovered amount back through the existing payment path, with accounting netting it out of active revenue as a recoverable receivable.

## ✅ Decisions — 2026-06-29 critique (Jac)

- **D1 — Send-to-Collections gate = manager-tier + a SECOND approver (OQ-3 = YES).** The placement action requires manager-tier AND a second manager's password to confirm (the dual-approver pattern). Ship a **Settings → Company "Require a second approver to send to collections"** toggle, **default ON**. Collections is the first area to actually implement dual-approver (the refund second-approver is still a spec decision, not shipped) — so it builds the pattern. Both `placedBy` and `approvedBy` are stamped on the placement (§4.1). The outbound `collectionsSend` still stays **blocked until `backend-data` server-tier trust (OQ-1) lands** — a dual-approver gate that the server can't verify is theatre; the second approver's password must be a *server-re-validated* second credential (§5.2).
- **D2 — Placement AUTO-blacklists the account (OQ-5 changed).** Sending an invoice to collections **automatically sets `accountType: 'Blacklisted'`** (blocks new rentals) — not the draft's decoupled-with-prompt. The send confirm still shows what's happening ("This also blacklists the account"), and the existing blacklist audit trail (`customers-crm` D3) + a `'Sent to Collections & blacklisted by <role>'` `activityLog` entry record it. A **Recall** (§7.5) should prompt to lift the blacklist (since the chase is back in-house) — flag that reciprocal as a build detail.
- **D3 — One invoice per placement; multi-invoice debt is handled by INVOICE MERGE first (OQ-9).** Keep placement to a single invoice for clean money math. To place a customer's whole stack, the office **merges the open invoices into one** *before* placing it — and **the merge MUST carry line items that reference their origin invoices** (so the merged invoice is auditable back to each source). **Confirmed 2026-06-29 (code investigation):** invoice merge **IS built and shipped** — `mergeInvoiceInto(keepId, absorbId)` (`app.js:15598`), `invoiceMergeable(i)` (`app.js:15593`, requires a customer, not locked/refunded/ACH-processing, and `amountPaid === 0`), UI `mergePicker` (`app.js:6262`), gated `canMoney()`. It is **hard-constrained to a single customer** (`app.js:15603` rejects a cross-customer merge). **BUT the one gap is exactly the origin reference Jac required:** merged line items are copied with only a freshly-minted `lid` (`app.js:15605`) and **carry NO `originInvoiceId`** — so a merged invoice is not auditable back to its source invoices. **Action item (prerequisite for the "place a whole customer's debt" workflow): add an `originInvoiceId` (and ideally `originInvoiceLabel`) field to each line item moved by `mergeInvoiceInto`**, so the merged-then-placed invoice traces to each source. This is a small, additive change to one function. Cross-customer placement stays hard-rejected (`cross-customer`). `invoicing-payments` invoice-merge is thus a **dependency** of the multi-invoice collections workflow, **with one origin-reference enhancement to build.**
- **D4 — Adopt the conservative drafts for the rest:** Phase 1 ships the **local "queue for collections"** (no outbound, no secret) so a dead invoice leaves active aging safely even while OQ-1 is open; outbound integration is **Phase 2, hard-blocked on `backend-data` OQ-1** (OQ-1). Status sync = **pull/poll**, no inbound webhook (OQ-4). Placement **idempotency nonce** = yes (OQ-8). Queue surface **folds into the existing back-office board** catalog entry, no new popup (OQ-10). A placed invoice **refuses office payment/refund** — recovery only via the agency remit (OQ-11 refuse-and-redirect). **No app-sent customer collections notice** in v1 — the agency owns debtor contact; minimal PII allowlist, `idNumber` never sent (OQ-7, legal = Jac's counsel). Placement is **suggested at the 120-day threshold, never auto-placed** (OQ-12). Accounting treatment (contra-revenue vs reserve, tax-on-recovery, fee-as-expense) stays the **load-bearing `accounting` co-owned fork (OQ-2)** — nothing books a recovery before it resolves. Vendor choice + remittance model (net vs gross+fee-invoice) confirmed before Phase 2/3 (OQ-13/OQ-14). Mr. Wrangler **can never** send/recall/book-recovery (§3.6 AI fence).

## 0. How this area was born (provenance)

This area is the resolution of a thread left open by two shipped/adjacent specs — it does not invent a new problem, it **closes one already named**:

- **`invoicing-payments` D3 (2026-06-29):** *"For a partially-paid uncollectable, rather than a passive bad-debt write-off, the invoice is **sent to 'Collections'** — a planned in-app feature integrating a **3rd-party collections service** (now its own roadmap area). A `Sent to Collections` status (gray-adjacent) marks it, the balance leaves active aging, and a recovery remits back through the payment path."* (invoicing-payments.md:18)
- **`accounting` D5 (2026-06-29):** *"Instead of a terminal 'bad-debt Write-off,' an uncollectable invoice is **sent to 'Collections'** … accounting still nets a sent-to-collections invoice out of revenue (as a recoverable receivable, not booked income), and reconciles any recovered amount back when the 3rd party remits."* (accounting.md:20)

So the canonical decisions this spec must honor (not re-open) are: **(a)** a new `Sent to Collections` invoice status, gray-adjacent; **(b)** the balance leaves active aging once sent; **(c)** recovery remits **through the existing payment path** (not a new money primitive); **(d)** accounting treats a sent invoice as a **recoverable receivable**, netted out of revenue, and books a recovery when remitted. This spec designs the **how** for all four, plus the load-bearing new surface: an **outbound 3rd-party integration with a server-held token** and the auth/trust model around it (§3, §5).

---

## 1. Goal & Problem

### 1.1 What this area is for

Invoicing/Payments owns the **money in** and the aging ladder that ends at `Collections` (120 days past due, `invoiceTotals` `app.js:1622`). Today that tier is **purely cosmetic** — a red pill (`config.js:97`) and a red flag (`FLAG_CATALOG` `collections`, `config.js:259` / `app.js:3976`). Nothing *happens* when an invoice hits it: it sits red forever (invoicing-payments §2.3: *"an invoice can sit in `Collections` forever; nothing retires it short of refund"*). Collections turns that dead-end into a **workflow**: an Office/Manager user decides an invoice is uncollectable in-house, **hands it to a 3rd-party collections agency**, the agency works it, status syncs back, and any dollars the agency recovers land back on the invoice via the normal payment path — minus the agency's contingency cut, which is a cost (accounting, not revenue).

### 1.2 The business problem

JacRentals is a heavy-equipment yard in Sulphur, LA. A $9,000 unpaid invoice that has sat 120 days is real money the office cannot keep chasing with `sms:` reminders. The owner's choice today is binary and bad: **keep it red on the board forever** (inflating the aging/AR picture with money that will never come) or **refund/void it** (which isn't a refund — no money moved — and pollutes the ledger). The right answer for a real business is a **third option**: place it with a collections agency, accept that the invoice is no longer *active* AR, mark it as *recoverable* (the agency might get 40–60¢ on the dollar), and book whatever comes back as a recovery against a now-closed account. The app has no path for any of this.

### 1.3 North star

> **A red 120-day invoice becomes a tracked, off-the-active-books "Sent to Collections" item with one gated, audited action; the agency integration is server-only and never holds a secret in the public bundle; any dollars recovered flow back through the *same* payment path the office already trusts; and accounting always agrees that a sent invoice is a recoverable receivable, not income.** Collections must never invent money, never expose the floor/margin, never leak customer PII to the public repo, and never let a non-manager hand a customer to a collections agency.

---

## 2. Current State (Baseline) — honestly greenfield

**There is no Collections feature.** What exists is the *seam* this area builds onto. Every claim below is grounded in live code.

### 2.1 What exists to build on

| Seam | Where | What it gives us |
|---|---|---|
| **`Collections` aging tier** | `invoiceTotals` (`app.js:1603`), status block `app.js:1622` (`daysPast >= 120 ? 'Collections' : …`) | The derived status value that signals "uncollectable candidate." **Derived, not stored** — it falls out of the aging math, so it cannot today coexist with a *manual* "sent" marker without a model change (§4). |
| **`Collections` status registry entry** | `config.js:97` (`'Collections': { color:'red' }`) | The pill label + red color already render on the Invoices board. |
| **`collections` flag** | `FLAG_CATALOG` `config.js:259` + `app.js:3976` (`(i) => invoiceTotals(i).status === 'Collections'`) | The red flag that drives the prescriptive R/Y/G pill (flag-color-system §7.4). |
| **Invoice entity + server-owned money totals** | `data.js:78`, `invoiceTotals` `app.js:1602`, money fields server-owned (#177, invoicing-payments §4.1) | `amountPaid`/`refundedAmount`/`payments[]` are **server-authoritative** — any recovery must land through them, never a client write. |
| **The payment path** | `recordManualPayment` / `postManualPayment` `app.js:14656/14637`; `stripeChargeInvoice` `app.js:14557` | The existing, server-capped money-in primitives a recovery remit can reuse (§5, §7). |
| **Money gate** | `canMoney()` `app.js:14166` (`!currentRole || roleTier(currentRole) >= tierRank('money')`) | The gate every money action already re-checks (client) + server `forbidden` (invoicing-payments §3.2). |
| **Role tiers** | `ROLE_TIERS` `config.js:326`, `tierRank` `config.js:334`, `BUILTIN_ROLE_TIERS` `config.js:340` | `staff(1) < money(2) < manager(3) < admin(4) < developer(5)` — the ladder a "manager-tier to send" gate keys off. |
| **Customer standing** | `customerAccountType` registry incl. `Blacklisted` `config.js:113`; blacklist decision in customers-crm D3 | The customer-facing side: a sent-to-collections customer's standing (§3.4, §7.6). |
| **Single `backendCall` entry point** | `app.js:15650` (`backend-data` §2.1) | Every new outbound action is **additive** here; the agency token rides server-side only. |
| **WINDOW_CATALOG / R-rulebook** | `WINDOW_CATALOG` `app.js:9796`; highest stamp today `R25` | New popups + controls must register (§6, §9). |
| **Dual-approver pattern** | invoicing-payments D2 (refund second-approver Settings toggle — a SPEC decision, **not yet in shipped code**: the refund flow ships with `refundAllocations`/`recordManualRefund`/`stripeRefundInvoice` `app.js:5535`/`14186`-area, but no second-approver gate exists today) | The "two-person, both-responsible" control Jac likes — a candidate gate for the send action (§3, OQ-3). Collections would be the **first** area to actually implement it, so its design can't lean on a shipped reference; it builds the pattern. |

### 2.2 What does NOT exist (this spec proposes all of it)

- No stored "this invoice was *sent* to collections" marker — `Collections` is purely a *derived aging value*, so a sent invoice and a merely-120-days-late invoice are **indistinguishable today.**
- No collections-agency integration, no outbound action, no token, no status sync.
- No `Collections` board / queue / detail surface — nowhere to *see* what's been placed and what it's recovering.
- No recoverable-receivable accounting treatment (accounting D5 names it; nothing computes it).
- No customer-facing collections notice (a legally-sensitive comms surface — `comms-notifications`).
- No recovery-remit flow (the agency wires JacRentals its share; nothing books it).
- No agency cost/contingency-fee handling (the agency keeps 30–50%; that's a cost, accounting).

### 2.3 Honest greenfield note

This is a **Later-Wants, greenfield** area (AREAS-ROADMAP.md:78). The single highest-risk piece is **not** the UI — it is the **outbound 3rd-party integration + its auth/trust model** on a backend whose authorization is *client-side-only today* (`backend-data` D3/OQ-1: *"no server-side enforcement of role tiers — the password is a single team password"*). Sending a customer's PII to an external agency from a backend that can't yet verify the caller's tier is the load-bearing design problem, and it is **§3 + the top Open Questions**, conservative by default.

---

## 3. Users, Roles, Gates & Isolation — THE LOAD-BEARING DESIGN

Collections is the first **outbound-PII, money-adjacent, irreversible-ish** surface in the app: handing a customer's name/contact/debt to an external agency is **harder to undo than a refund** (a refund returns money; a collections placement is a reputational + legal act against a customer). The gate model must be conservative by default.

### 3.1 The four gates this area introduces

| Gate | Action | Proposed tier | Why |
|---|---|---|---|
| **G-SEND** | "Send to Collections" (place an invoice with the agency) | **manager-tier+** (`tierRank(currentRole) >= tierRank('manager')`), recommend **+ dual-approver** | Outbound PII + a customer-standing act. Higher than the `money` tier that takes a payment, because it's harder to reverse and has legal/reputational blast radius. (OQ-1, OQ-3) |
| **G-RECALL** | "Recall / withdraw from Collections" (pull it back before/after the agency works it) | **manager-tier+** | Symmetric with G-SEND; also money-adjacent (changes AR treatment back). |
| **G-RECOVERY** | Book a recovery remittance (agency wired us our share) | **money-tier+** (reuses the existing payment path) | It's a money-in event; it inherits the existing `canMoney()` + server `forbidden` gate exactly like a manual payment. |
| **G-VIEW** | See the Collections queue / a sent invoice's collections status | **open to all signed-in users** (read), consistent with the open-visibility posture (customers-crm D-posture, accounting D1) | The *amounts* are already visible on the invoice; hiding the queue adds nothing. But see G-PII below for what must NOT render. |

> **Why manager-tier for SEND (not money):** invoicing-payments gates *taking money* at `money` (Office/Sales). Collections is **not** taking money — it is an outbound act with **legal/reputational consequences for a customer**, harder to reverse than a refund (which is itself a candidate for manager-tier + dual-approver, invoicing-payments OQ-2/D2). Defaulting SEND to **manager + dual-approver** is the conservative posture; Jac can relax it (OQ-3). This mirrors the "money-action gating" + "dual-approver pattern Jac likes" the brief calls for.

### 3.2 The server-trust problem (BLOCKS the outbound action — top Open Question)

This is the **single most important fork**, inherited verbatim from `backend-data` OQ-1/D3 and `accounting` Q13:

> **Today `backendCall` authenticates with ONE shared team password; the server does not verify the caller's *role/tier*.** (`backend-data` §3.2: *"client-side gates are UX, not security … a determined user who has the password can craft any `backendCall` directly."*)

For Collections this is not theoretical: if the **send-to-collections action** is gated only client-side, then **anyone with the team password can POST `collectionsSend` for any invoice** — shipping a customer's PII to an external agency with no server-side authority check. That is a materially worse outcome than the existing money-gate hole, because the blast radius is **outbound PII to a third party**, not an in-house number.

**Conservative posture this spec adopts (do NOT regress):**

- **The outbound `collectionsSend` action MUST NOT ship until the server can verify the caller's tier** (`backend-data` OQ-1 resolved with per-role passwords or a server-side `tierRank` check). This mirrors `accounting`'s rule that its destructive/outbound actions (`expenseDelete`, `acctExport`) are **blocked on Q13.** Collections' outbound action is in the same blocked class.
- **Phase 1 may ship a *local-only* "flag as uncollectable / queue for collections" state** that moves nothing outbound and books nothing — it only sets the in-app status + removes the invoice from active aging (a reversible, in-app, money-adjacent-but-not-money act). The actual **outbound placement** (the integration) waits for the server-trust resolution. (§8 phasing.)
- The `auth` reply's `role` is **advisory** today (`backend-data` §3.2) — never treat it as the authority for an outbound placement.

### 3.3 Customer isolation & PII (outbound to a third party)

Collections is the app's **first deliberate PII *egress* to an external party.** The PII guard flips from "never leaks" to "leaves on purpose, to a named recipient, under audit":

- **What the agency needs (minimal):** customer name, company, billing contact (phone/email/address), the invoice id(s), the placed balance, and the debt age. **No more.** Define an explicit **placement payload allowlist** (§5.3) — the server sends *only* those fields; it must NEVER forward card/ACH tokens (`stripeId`, `cards[]` pm ids/last4), selfies, signed-agreement media, `idNumber`, or internal cost/margin.
- **The placement payload is assembled SERVER-SIDE from the live record**, not posted by the client, so a crafted client can't smuggle extra fields out. (Same posture as the refund cap living server-side, invoicing-payments §1.)
- **`idNumber` (driver's-license/ID #) NEVER goes to the agency** even though it's internally visible (customers-crm D2: *"never export it to the public repo / Pages / search blob / AI tool output"* — extend that to **never to the agency** unless an OQ explicitly approves it for skip-tracing, OQ-7).
- **No agency token, agency URL, or any secret in the repo** — the agency API token lives **server-side in GAS Script Properties, referred to by name only** (named e.g. `COLLECTIONS_API_TOKEN`), exactly like the Stripe secret key and Anthropic key (`backend-data` §5.4 hard rule). The repo is public via Pages (CLAUDE.md "Don't").
- **Customer-isolation invariant (server-enforced, not advisory):** a placement is keyed to **one customer's** invoice(s). The server resolves each `invoiceId` → its row, reads the row's *own* `customerId` (it does NOT trust a client-supplied customer id), and if a multi-invoice placement's rows don't share a single `customerId` it returns `cross-customer` and writes nothing. The agency body's `debtor` block is built from **that one resolved customer's** record only — so even a crafted multi-invoice POST cannot splice one customer's debt onto another customer's contact details. Mirrors invoice-merge's same-customer hard constraint (invoicing-payments §3.3). *(v1 may restrict to one invoice per placement entirely — OQ-9 — which makes the invariant trivially true.)*
- **G-PII (render gate):** the Collections queue may show the placed balance + status to all signed-in users (open posture), but the **agency-side reference / any agency credential / the recovery contingency-cost math must not render below money-tier** (it's cost/margin-adjacent), and **no agency token ever reaches the DOM** (it's server-only).

### 3.4 The customer's standing (customers-crm)

Sending an invoice to collections is a **customer-standing event**, related to but distinct from `Blacklisted`:

- It SHOULD stamp an **audit entry** on the customer's existing `activityLog` array (real shipped shape is `{ when, text }`, e.g. `app.js:14177` `c.activityLog.push({ when: TODAY_ISO, text })` — **reuse that exact shape**, do not invent `{ at, event, role }` here): `{ when: TODAY_ISO, text: 'Sent invoice INV… to Collections by <role>' }`. Same audit-not-gate pattern the `customers-crm` D3 blacklist trail proposes (a `'Blacklisted by <role>'` activity-log entry + a `blacklistedAt` field) — **note both that blacklist trail and the refund "second-approver" toggle are SPEC decisions, not yet in shipped code** (grep finds no `blacklistedAt`/`secondApprover` today), so Collections must not assume they exist — it either lands them or degrades gracefully if absent.
- **Open (OQ-5):** does sending to collections **auto-set** `accountType: 'Blacklisted'` (block new rentals, customers-crm D3 soft-gate), or are the two **decoupled** (you can place a debt without blacklisting, and blacklist without placing)? Recommend **decoupled with a strong prompt** ("Also blacklist this account?") — collections is per-*invoice*; blacklist is per-*account*.

### 3.5 Pricing-floor / margin

Collections shows **balances and recoveries**, never cost/margin/`bottomDollar` (invoicing-payments §3.5, units-fleet floor gate). The one margin-adjacent number is the **agency contingency fee** (what % the agency keeps) — treat it as **cost**, gate any *aggregate* contingency-cost rollup to **money-tier+** (accounting), and never render it on a customer-facing surface.

### 3.6 Mr. Wrangler (AI) fence

Extend the existing AI money fence (invoicing-payments §3.4) explicitly: **Mr. Wrangler may NEVER send an invoice to collections, recall one, or book a recovery.** Sending PII outbound is strictly outside the `apply_changes` allowlist — it is added to the NEVER column alongside charge/refund/password-change. The AI may *read* collections status (read tools) but its only money-adjacent write stays `recordPayment` (cash/check, server-capped) and `billRental`. A recovery remit, even though it routes through the payment path, is **operator-only** because it's tied to an outbound placement the AI can't have initiated.

---

## 4. Data Model (additive, schema-less)

Schema-less Sheets — new fields are **additive**, default-absent reads as empty (`backend-data` §4.2; `m({...})` defaults). The hard model problem: **`Collections` is a derived aging value, not a stored fact**, so a *sent* invoice needs a **stored marker that out-ranks the derived aging status.**

### 4.1 New fields on the **invoice** entity (`DATA.invoices`, `data.js:78`)

| Field | Owner | Type | Meaning |
|---|---|---|---|
| `collections` | **server** (set on placement; gates recovery) | object \| absent | The placement record (sub-object below). Absent ⇒ never sent. |
| `collections.status` | server | enum | `Queued` (Phase-1 local flag, not yet placed) · `Placed` (sent to agency) · `Acknowledged` · `InProgress` · `PartiallyRecovered` · `Recovered` · `Closed` (agency gave up / uncollectable) · `Recalled` (withdrawn by us). |
| `collections.placedAt` | server | ISO | When the outbound placement succeeded. |
| `collections.placedBy` | server | string (role) | Derived from the call password — *who* placed it (audit). |
| `collections.approvedBy` | server | string (role) | The **second** approver (if dual-approver gate ON, §3.1/OQ-3). |
| `collections.agencyRef` | server | string | The agency's reference id for this placement (their case number). **Money-tier render gate** (§3.3 G-PII). |
| `collections.placedBalanceCents` | server | int cents | The balance handed to the agency at placement (frozen — the active balance leaves aging). |
| `collections.recoveredCents` | server | int cents | Running total the agency has recovered + remitted to us (gross, before their cut). |
| `collections.feeCents` | server | int cents | The agency's contingency cut on recovered funds (cost; accounting). **Money-tier render gate.** |
| `collections.lastSyncAt` | server | ISO | Last successful status sync from the agency. |
| `collections.reason` | client | enum + note | Why it was placed (structured, mirrors the refund-reason ask, invoicing-payments D2). |
| `collections.history[]` | server | object[] | `{ at, event, role, amountCents? }` append-only placement timeline (audit). *(This is a NEW server-owned sub-array on the invoice — distinct from the customer's `{ when, text }` `activityLog`; the two are separate audit trails by design: the invoice carries the machine-readable money/status timeline, the customer carries the human standing note.)* |

> **Why a stored `collections` object, not a new status string:** the aging status is *computed* every render from `dueDate`/`amountPaid` (`invoiceTotals`). A stored object is the only way a *placed* invoice stays distinguishable from a freshly-120-days-late one, survives a balance change, and carries the agency ref. The **displayed `invoiceStatus` becomes `Sent to Collections` when `collections` is present and active** (§7.1) — the stored marker out-ranks the derived aging tier.

### 4.2 New `invoiceStatus` registry value (`config.js:89` block)

Add one terminal-ish, **gray-adjacent** status (per invoicing-payments D3: *"a `Sent to Collections` status (gray-adjacent)"*):

```js
// config.js invoiceStatus registry — additive
'Sent to Collections': { label: 'In Collections', color: 'gray' },   // gray-adjacent: off the active R/Y/G aging ladder
```

- Color **gray** (archived-adjacent) so it reads as "off the active books" — the balance has **left active aging** (D3). It is NOT red (red = "chase this now"; a placed invoice is no longer the office's chase).
- It does **not** replace `Refunded`'s gray semantics; both are "off the active money picture" but for different reasons.

### 4.3 Flag-color treatment (flag-color-system)

| State | Pill color | Rationale |
|---|---|---|
| `collections.status ∈ {Queued}` (Phase-1 local, not yet placed) | **yellow** (action needed: a manager must place it) | A queued item is a to-do. |
| `collections.status ∈ {Placed, Acknowledged, InProgress}` | **gray** (off active aging — record-keeping) | Out of the office's hands. |
| `collections.status ∈ {PartiallyRecovered, Recovered}` | **green-adjacent** or gray | Money came back; reconciled. (OQ-6 — exact color.) |
| `collections.status === Closed` (uncollectable, agency gave up) | **gray** (archived) | The bad-debt end-state. |
| `collections.status === Recalled` | reverts to normal aging (the derived `Collections`/`Late+` red) | Pulled back into the office's chase. |

Add a `sent-to-collections` flag to `FLAG_CATALOG` invoices (`config.js`) and **retire the old `collections` red flag's dominance** for placed invoices: the existing `collections` flag (`app.js:3976`) fires on the *derived* `Collections` aging tier; once `collections` object is present, the stored status wins. (Build-checklist item, §8/§9.)

### 4.4 Relationships (by ID)

`invoice.collections` is in-line on the invoice (no new entity needed for v1). It joins:
`invoice.customerId → customer` (the standing/audit side, §3.4) · `invoice.rentalIds → rentals` (the placed debt's origin) · a **recovery payment** appends to the existing `invoice.payments[]` with a new `type:'collections-recovery'` (§7.4). **No new `PERSIST_KEYS` entity** in v1 — this is purely additive fields, so it needs **zero** `PERSIST_KEYS`/`PERSIST_ID`/`IDX_MAP` change (`backend-data` §4.2: adding fields needs no structural backend change). *(If a multi-agency or per-placement-document model is ever needed, a `collections` entity becomes the structural change — OQ-9.)*

### 4.5 Migration / schema-less notes

- All additive; absent `collections` reads as "never sent." No migration.
- `collections.*Cents` fields are **integer cents, server-owned** (the money-totals rule #177) — never client-written. The recovery routes through the server payment path so totals stay server-authoritative.
- `collections.reason` is **client-owned** (like `refundAllocations`) — the server never reads it for money math.

---

## 5. Backend / Integration Contract — additive GAS actions + the 3rd-party agency

Backend = Google Apps Script + schema-less Sheets, deployed by clasp (`Code.gs` gitignored). All new behavior is **additive actions on the single `backendCall(action, payload)` entry point** (`app.js:15650`). The agency token is **server-side only, named only.** No existing action changes.

### 5.1 Proposed additive GAS actions

| Action | Payload (client → server) | Returns | Gate (server re-checks tier — see §3.2) |
|---|---|---|---|
| `collectionsQueue` | `{ invoiceId, reason }` | `{ ok, collections:{ status:'Queued', … } }` | manager-tier *(Phase 1, local — no outbound, see §8)* |
| `collectionsSend` | `{ invoiceId, reason, approverPassword? }` | `{ ok, collections:{ status:'Placed', agencyRef, placedAt, placedBalanceCents } }` or `{ ok:false, error }` | **manager-tier + (optional) dual-approver** — **BLOCKED until server-trust resolves (§3.2, OQ-1)** |
| `collectionsRecall` | `{ invoiceId, reason }` | `{ ok, collections:{ status:'Recalled' } }` | manager-tier (outbound withdraw to agency) |
| `collectionsSync` | `{ invoiceId? }` (or all active) | `{ ok, updated:[{ invoiceId, status, recoveredCents, feeCents, lastSyncAt }] }` | money-tier (read-ish); **server-initiated poll preferred** (§5.4) |
| `collectionsRecovery` | `{ invoiceId, amountCents, feeCents }` | `{ ok, amountPaid, payments }` *(routes through the manual-payment primitive)* | money-tier (reuses the payment-path gate) |

**The server is authoritative for every money + outbound figure.** The client *requests*; the server **assembles the placement payload from the live record** (§5.3), **re-derives the placed balance**, and **re-checks the caller's tier**. A client-invented balance or an extra PII field is ignored. (Same north-star contract as invoicing-payments §1.)

### 5.2 Server-side role re-check (the suspenders)

Each action re-validates the caller's tier server-side before doing anything; an under-tier caller gets `{ ok:false, error:'forbidden' }`. The client gate is **belt** (`canMoney()` `app.js:14166` for money actions; a `roleTier(currentRole) >= tierRank('manager')` open-path guard for SEND/RECALL — `roleTier` resolves a role → rank via `roleMetaMap` then `BUILTIN_ROLE_TIERS`, `app.js:13055`), the server check is **suspenders** — and per §3.2, **for `collectionsSend`/`collectionsRecall` the server check must be REAL (not the advisory `auth` role) before the action ships.** Until `backend-data` OQ-1 lands, only the **non-outbound** `collectionsQueue` (local flag) is safe.

> **Concrete server-trust shape (whichever `backend-data` OQ-1 picks):** the server handler must derive the caller's tier from a *credential it trusts*, not from a client-supplied `role` string. Two viable mechanisms, in `backend-data`'s gift: (a) **per-role passwords** — the POST carries the role password, the server maps password → role → tier and compares to the action's minimum; (b) **a server-side tier table** keyed to whatever identity the auth handshake establishes. Either way the Collections handler's first line is `if (callerTier < REQUIRED[action]) return { ok:false, error:'forbidden' }` where `REQUIRED.collectionsSend = tierRank('manager')`. The **dual-approver** second factor (OQ-3) is a *second* trusted credential (the approver's role password) the server re-validates the same way — the client never decides it passed.

### 5.3 The 3rd-party agency integration (the new external surface)

```jsonc
// collectionsSend — SERVER assembles the outbound payload from the live record (allowlist only)
//   The client NEVER posts the customer fields; it posts only { invoiceId, reason }.
//   The server reads the invoice + customer, builds this minimal placement, and POSTs it
//   to the agency API using COLLECTIONS_API_TOKEN (Script Property, named-only).
SERVER → AGENCY  {
  "debtor": { "name":"…", "company":"…", "phone":"…", "email":"…", "address":"…" },  // PII allowlist (§3.3)
  "account": { "invoiceId":"INV…", "balanceCents": 900000, "debtAgeDays": 137, "currency":"USD" },
  "client_ref": "INV…"
  // NEVER: stripeId, cards[], selfies, agreement media, idNumber, cost/margin
}
AGENCY → SERVER  { "ok":true, "case_id":"AG-…", "status":"received" }   // → collections.agencyRef
```

- **Token:** `COLLECTIONS_API_TOKEN` (and any agency base URL, e.g. `COLLECTIONS_API_BASE`) live **only** in GAS Script Properties, **referred to by name** — retrieved server-side via `PropertiesService.getScriptProperties().getProperty('COLLECTIONS_API_TOKEN')` at call time, never in the repo/bundle/this spec (public via Pages), never echoed in any `{ ok, … }` reply, never logged. Same hard rule as the Stripe secret key and the Anthropic key (`backend-data` §5.4). The client never sees or holds it; if the property is absent the handler returns `collections-not-configured` (§5.5) rather than calling out with an empty token.
- **PII allowlist enforced server-side, by construction** — the server builds the outbound body field-by-field from the live invoice + customer record (an *explicit* object literal of the §3.3 fields), so a client-supplied extra key is *structurally* incapable of reaching the agency (it's never read into the outbound object). This is stronger than a deny-list filter: the payload is an allow-by-construction whitelist, not a sanitize pass. A unit/string-scan asserts the builder names no forbidden field (AC5).
- **Idempotency:** `collectionsSend` is **not** auto-retried by sync backoff (mirrors the money-action rule, `backend-data` §5.4/R12) — a placement is an outbound side-effecting act; an ambiguous failure surfaces to the operator, who confirms before re-sending (an accidental double-placement is a real harm). A server-held **placement nonce** (per-invoice) makes a re-send a no-op (OQ-8, mirrors the Stripe idempotency-key ask, `backend-data` OQ-14).

### 5.4 Status sync from the agency

Two options (OQ-4):
- **(a) Pull (poll):** a server-side time-driven trigger (GAS `ScriptApp` time trigger) calls the agency's status endpoint on a cadence and writes `collections.status`/`recoveredCents`/`feeCents` back to the invoice row. The client reads the synced fields on the normal `load`/`refreshFromBackend`. **No inbound webhook surface** → smaller attack surface, simpler trust. **Recommended.**
- **(b) Push (webhook):** the agency POSTs status changes to a GAS web-app endpoint. Lower latency but **opens a new inbound, internet-facing surface** that must authenticate the agency (a shared secret / HMAC in Script Properties) and resist forgery — a meaningfully larger security design. Defer unless latency demands it.

A **recovery** detected by sync does NOT auto-book money — it sets `status:'PartiallyRecovered'`/`Recovered` and surfaces a **"Book recovery"** action for an operator (money-tier), which routes through `collectionsRecovery` → the manual-payment primitive. (No money lands without a human, mirroring invoicing-payments Q18/D — *"every AI-initiated payment requires an explicit human Apply"* — extended here to agency-initiated recoveries.)

### 5.5 Failure handling (CANON pattern, reused)

- Every flow uses `withTimeout` and the defensive `backendCall` parse (`backend-data` §2.1) — a GAS error page becomes `{ ok:false, error:'http-NNN' }`, never a masked success.
- Typed errors map to friendly yard copy (extend `friendlyPayErr`-style): `forbidden` (under-tier), `collections-not-configured` (no agency token deployed), `agency-unreachable`, `already-placed` (the invoice already has an active `collections`), `cross-customer` (placement mixed customers — rejected), `balance-zero` (nothing to place), `recovery-over-cap` (a remit exceeds the placed balance — server re-caps).
- **Concurrency:** `collectionsSend`/`collectionsRecovery` take a `LockService` script lock (serialize against the same invoice row, like the refund handlers, invoicing-payments §5.2).
- **`collections-not-configured`** is the clean degrade when the backend predates the agency token (capability negotiation, `backend-data` D2/OQ-2) — the UI shows "Collections integration isn't set up yet" rather than erroring the app.

### 5.6 External integrations summary

| Integration | Action family | Secret location | Failure handling |
|---|---|---|---|
| **3rd-party collections agency** (NEW) | `collectionsSend/Recall/Sync` | `COLLECTIONS_API_TOKEN` + base URL — **GAS Script Properties, named-only** | `{ ok:false, error }`; never masks; not auto-retried; PII allowlist server-enforced |
| **Existing payment path** (reused) | `collectionsRecovery → recordManualPayment` | Stripe secret server-only (unchanged) | inherits the payment-path failure contract (invoicing-payments §5.2) |

No new Stripe surface; no QuickBooks (that's accounting). The agency is the **only** new external party, and it is **outbound + server-token-only.**

---

## 6. UX / UI — yard data-plate language

All new/changed UI runs through the **`jactec-ui` skill** in the **yard data-plate** language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), **one** safety-orange `--accent #ff7a1a` accent reserved for the primary/ignition action, hi-vis **hazard stripe** for danger/abort (here: the **red** variant on the irreversible *Send to Collections* confirm), corner **rivets**, **Saira Condensed** stamped uppercase labels (~2px tracking), **Geist** body, light **ranch-twist** voice in copy. Spend boldness in ONE place; respect reduced-motion + visible focus. **Self-screenshot + critique before showing Jac.**

Every new element needs a **`data-r="Rxx"` stamp** (regenerate `rule-usage.js` via `ci/gen-rule-usage.mjs`, drop `--check`); every **new popup** needs a **`WINDOW_CATALOG`** entry (`app.js:9796`) or `ci/check-window-catalog.mjs` fails CI. **Highest stamp today is `R25`** — new controls start at **R26+**.

### 6.1 The "Send to Collections" action (on the invoice detail / payment popup)

Where the office decides an invoice is uncollectable. Lives in the invoice money-actions area (`app.js:9729` payment region), rendered **only** for `collections.status` absent AND the invoice is in a red aging tier (`Late+…`/`Collections`).

- A **danger-styled** control (red **hazard-stripe** variant, NOT the orange ignition accent — orange stays for *taking* money) labeled **"Wrangle to Collections"** (ranch voice; double-meaning of rounding up a stray debt). Proposed stamp **`R26`**.
- Tapping opens the **Send-to-Collections confirm popup** (new — §6.2).

### 6.2 NEW popup: "Send to Collections" confirm (`kind:'collectionsSend'`)

A red-hazard-stripe steel plate (the irreversible-act treatment, like customers-crm's blacklist confirm + the R25 banner idiom):

```
┌─ ▞▞ SEND TO COLLECTIONS ▞▞ ──────────────────────────┐
│  Bamba Construction · INV.04.12.26.003               │
│  Balance handed over:  $ 9,000.00   (137 days past)  │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (saddle-stitch tan) ─ ─ │
│  Reason  [ Uncollectable in-house  ▾ ]  + note…      │  ← structured reason (R27)
│  ☐ Also blacklist this account (blocks new rentals)  │  ← OQ-5 decoupled prompt (R28)
│  ───────────────────────────────────────────────────│
│  Second approver (manager+):  [ password ]           │  ← dual-approver, if ON (R29)
│  This hands the debt to <Agency>. It leaves active   │
│  aging and can't be un-sent without a Recall.        │
│        [ Cancel ]            [ ▞ Send to Collections ]│  ← red hazard primary
└──────────────────────────────────────────────────────┘
```

- **WINDOW_CATALOG entry (new):** `{ kind:'collectionsSend', label:'Send to Collections', tag:'Invoice · collections', sample:()=>({ invoiceId:((DATA.invoices||[])[0]||{}).invoiceId }) }`.
- **Gate:** the popup early-returns / refuses to open below **manager-tier** (gate at the open path, like accounting's P&L popup `!canMoney()` guard, accounting §6.1) — and the server re-checks (§3.2).
- **States:** busy ("Placing…", disabled), error (`collections-not-configured` → "The collections agency isn't connected yet."; `forbidden`; `agency-unreachable`), success toast ("Sent to Collections — INV… is off the active books.").
- **Stamps:** confirm primary `R26`-adjacent (or its own), reason select `R27`, blacklist checkbox `R28`, approver field `R29`.

### 6.3 NEW: a Collections queue/board (back-office)

A **back-office board** (reuse the `BACKOFFICE_BOARDS` + `boardTable` pattern, accounting §2.1 / app.js:11150) listing every invoice with an active `collections` object: columns **Customer · Invoice · Placed balance · Recovered · Status · Placed (date) · Agency ref**. Read-open to all (G-VIEW); the **Agency ref + Recovered-fee** cells gate to **money-tier** (G-PII). Row opens the invoice detail.

- If it's a **new popup** → new `WINDOW_CATALOG` entry (`{ kind:'collectionsBoard', … }`) + stamps. If it folds into the existing generic `board` catalog entry (kind `board` already exists, app.js:9811) as just another `BACKOFFICE_BOARDS` id, **no new catalog entry** — re-stamp only new cells. (Prefer folding in to avoid catalog churn — OQ-10.)

### 6.4 NEW: recovery on the invoice detail

When `collections.status` is `PartiallyRecovered`/`Recovered`, the invoice detail shows a **"Book recovery"** action (money-tier, orange-ignition since it's a money-in) that routes through `collectionsRecovery` → the payment popup's Record mode (reuse, not a new money primitive). The recovered amount appears in the existing ledger block and `payments[]` history with a `collections-recovery` label. New stamp for the action (R30-ish); **no new popup** (reuses `payment`).

### 6.5 Status surfacing on the pill + preview

- The invoice **status pill** shows `In Collections` (gray) per §4.2, stamped `R1` (existing status-pill rule, no new stamp).
- The flag-color **preview** (flag-color-system §5) gains a `Sent to Collections` flag row (gray dot) and, when recovering, a `Recovering $X` line.

### 6.6 Customer-facing notice (comms-notifications, legally sensitive — OQ-7/§7.6)

If JacRentals must **notify the customer** before/at placement (FDCPA-adjacent practice varies; the *agency* usually sends the dunning notice, not the creditor), that notice is a **`comms-notifications`** surface, not built here. This spec only stamps the **internal** audit log entry (§3.4). **Do NOT auto-send any customer collections notice in v1** — it's legally sensitive and the agency typically owns it (OQ-7).

### 6.7 Mobile reflow

The Send confirm becomes a bottom sheet; the danger primary stays a full-width ≥44px target pinned to the sheet bottom (mobile pattern, `2026-06-14-mobile-adaptive-design.md`). The queue board reflows to single-column cards. Reduced-motion: the hazard stripe must not animate under `prefers-reduced-motion`.

---

## 7. Business Rules / Money

**Be precise — this is money-adjacent.** Collections **never invents money**; it reclassifies a balance and reuses the payment path for recoveries.

### 7.1 Status derivation (the stored marker out-ranks derived aging)

```
displayStatus(inv):
  if inv.refunded                              → 'Refunded'            (gray, existing)
  if inv.collections && active(inv.collections) → 'Sent to Collections' (gray)   // NEW — stored wins over aging
  else → invoiceTotals(inv).status             // existing aging ladder (… Collections@120d red)
where active(c) = c.status ∉ {'Recalled'}      // a recalled invoice falls back to normal aging
```

So a **placed** invoice reads `In Collections` (gray) regardless of how many days past due — it has **left active aging** (invoicing-payments D3). A **recalled** invoice returns to the red aging ladder (the office is chasing it again).

### 7.2 The balance leaves active aging (AR / accounting netting — D5)

- Once `collections` is active, the invoice's balance is a **recoverable receivable**, NOT active AR and NOT booked revenue (accounting D5).
- **Accounting (`acctPnl`, accounting §7) must EXCLUDE the placed balance from active revenue/AR** and surface it as a separate **"In Collections (recoverable)"** line — never summed into `net` as income. The *original* invoice revenue was already booked on the invoice date (accrual, accounting D2); placement **reverses/contra's** that booked revenue into a recoverable-receivable bucket. **Exact contra treatment is the load-bearing accounting fork (OQ-2, revisited in accounting).**
- The aging KPIs (`financials-kpi`) must likewise drop placed invoices from "overdue AR" so the aging picture reflects only what the office is still chasing.

### 7.3 The placed balance is FROZEN at placement

`collections.placedBalanceCents` snapshots the balance the agency received. The live invoice balance can no longer be paid through the normal office path (it's been handed over) — **new office payments on a placed invoice are blocked** server-side (`error:'in-collections'`) to prevent double-collecting; money only comes back via `collectionsRecovery` (§7.4). (OQ-6 — should a customer who walks in *after* placement be allowed to pay the office, which then must remit the agency's cut? Edge case.)

### 7.4 Recovery / remittance (through the payment path — D3)

When the agency remits JacRentals its share:

```
collectionsRecovery({ invoiceId, amountCents, feeCents }):
  // amountCents = GROSS recovered from the debtor (what the customer paid the agency)
  // feeCents    = the agency's contingency cut on this remit (a COST, accounting)
  netToUsCents  = amountCents − feeCents
  // routes through the manual-payment primitive (server-capped at placedBalanceCents):
  recordManualPayment-equivalent posts `amountCents` against the invoice (amountPaid grows, server-owned)
  collections.recoveredCents += amountCents
  collections.feeCents       += feeCents
  if recoveredCents >= placedBalanceCents − 1 → collections.status = 'Recovered'
  else                                        → collections.status = 'PartiallyRecovered'
  appends inv.payments[] { type:'collections-recovery', amountCents, feeCents, at, role }
```

- **Server-owned + server-capped** (the recovery posts through the same server primitive that owns `amountPaid`, #177). A recovery can't exceed the placed balance (`recovery-over-cap` re-cap).
- The **agency fee is a COST** booked to accounting (a `Collections` expense category candidate — accounting), never netted out of the customer's invoice gross. Revenue *recovered* is the gross; the fee is an expense.
- **Tax handling on a recovery (OQ-2 sub):** the original invoice already collected/booked LA tax; a partial recovery's tax treatment is an accounting fork — confirm whether a recovery re-recognizes the proportional tax or treats the whole remit as recovery-of-receivable.

### 7.5 Recall

`collectionsRecall` withdraws the placement (status `Recalled`), tells the agency to stop, and the invoice **returns to normal aging** (§7.1). Any already-recovered money stays booked. Recall is **manager-tier** + audited.

### 7.6 Customer standing (§3.4)

- Placement stamps a `customer.activityLog` audit entry (not a gate).
- `accountType: 'Blacklisted'` is **decoupled** by default (OQ-5) but offered as a one-tap prompt on the send confirm (§6.2).

### 7.7 Edge cases (money)

- **Multi-invoice placement:** placing several invoices for ONE customer is allowed; mixing customers is rejected (`cross-customer`, §5.5). (v1 may restrict to **one invoice per placement** for simplicity — OQ-9.)
- **28-day series invoices:** a `contOf` chunk can be placed independently; the placed-balance math is per-invoice (no double-count, mirrors accounting §7.5).
- **Already-paid invoice:** placement is blocked if balance ≤ 0 (`balance-zero`).
- **Refund vs. collections:** a placed invoice cannot be refunded (no money to refund — it's been handed over); the refund path must reject on `collections active`.
- **Over-recovery:** a remit exceeding the placed balance is re-capped server-side (`recovery-over-cap`) — never over-books.
- **Closed (uncollectable):** if the agency gives up (`Closed`), the balance is finally a **true bad debt** — accounting writes it off (the original "Write-off" idea, now reached only *through* a failed collections, accounting D5).

---

## 8. Phasing & Milestones

Greenfield — phase by **risk**, gating the outbound integration behind the server-trust resolution.

**Phase 1 — Local "queue for collections" (NO outbound, NO secret, ships safe).**
In scope: the `collections` field model (§4), the `Sent to Collections` status + flag color, the **`collectionsQueue`** local action (sets `status:'Queued'`, removes the invoice from active aging, stamps the audit log), the **Send confirm popup** (§6.2) and **queue board** (§6.3) *wired to the local queue only*, accounting **excludes queued/placed balances from active revenue** (the D5 recoverable-receivable line). **Out of scope:** any outbound call, any agency token, any recovery booking. This phase is **safe even with `backend-data` OQ-1 open** because it adds **no outbound action surface** (mirrors accounting Phase 1 shipping client-side while Q13 is open). It already delivers the core business value: getting a $9k dead invoice **off the active aging board** with an auditable, reversible, manager-gated act.

**Phase 2 — The outbound integration (BLOCKED on server-trust / `backend-data` OQ-1).**
In scope: `collectionsSend`/`collectionsRecall` with the **server-held agency token** (named-only), the **PII-allowlist server payload** (§5.3), the **server-side tier re-check** (§3.2/§5.2), the **dual-approver** gate (§3.1/OQ-3), `collectionsSync` (poll, §5.4a). **Hard prerequisite:** the server can verify the caller's tier (`backend-data` OQ-1 resolved). **Nothing in Phase 2 ships before that** — an outbound-PII action gated only client-side is the exact hole §3.2 forbids.

**Phase 3 — Recovery + accounting close.**
In scope: `collectionsRecovery` through the payment path (§7.4), the agency contingency-**fee as a cost** (accounting category), the `Closed`/true-bad-debt write-off, per-period collections recovery reporting (accounting), the customer-standing blacklist coupling decision (OQ-5).

**Later / parked:** webhook status push (§5.4b), multi-agency support, a dedicated `collections` entity (OQ-9), skip-tracing data (OQ-7), customer-facing notice automation (comms-notifications, OQ-7).

**Explicitly OUT of scope v1:** choosing/contracting the actual agency (a business decision), legal compliance review (FDCPA — Jac's counsel), any inbound webhook, multi-location.

---

## 9. Acceptance Criteria (testable + CI gates)

| # | Criterion | CI / gate |
|---|---|---|
| AC1 | A manager-tier user can queue an invoice (Phase 1); a `collections` object is set, `status:'Queued'`, and the invoice leaves active aging (its pill reads `In Collections`, gray). | `ci/logic-test.mjs` over the status-derivation (§7.1). |
| AC2 | A **non-manager** session cannot open the Send-to-Collections popup (gate at the open path) AND the server returns `forbidden` for an under-tier `collectionsSend` call. | `ci/logic-test.mjs` gate assertion (client); manual/integration for the server gate (blocked on OQ-1, like accounting AC3b). |
| AC3 | The placed-balance is **excluded** from `acctPnl` active revenue and shown as a recoverable-receivable line, counted exactly once (no double-count with 28-day series). | `ci/logic-test.mjs` accounting fixture (§7.2). |
| AC4 | A recovery routes through the payment-path primitive: `amountPaid` grows server-side, `collections.recoveredCents` matches, and a remit > placed balance is re-capped (`recovery-over-cap`). | `ci/logic-test.mjs` money fixture (§7.4). |
| AC5 | The outbound placement payload contains **only** the §3.3 allowlist fields — never `stripeId`/`cards`/selfies/`idNumber`/cost/margin. Server assembles it; a crafted client cannot widen it. | manual/integration over the server payload; a **string-scan** asserting no forbidden field name in any client→server collections payload builder. |
| AC6 | No agency token, agency URL, or secret appears in any committed file (repo public via Pages). | grep/secret-scan guard + review (mirrors accounting AC9 / backend-data A7). |
| AC7 | A placed invoice cannot be refunded and cannot take a normal office payment (`in-collections` / refund-rejected). | `ci/logic-test.mjs`. |
| AC8 | New popup(s) appear in `WINDOW_CATALOG`; every new control carries a unique `data-r` stamp (R26+). | `ci/check-window-catalog.mjs`, `ci/gen-rule-usage.mjs --check`. |
| AC9 | New/changed UI passes `node ci/smoke.mjs` (no console errors, renders), reduced-motion + visible-focus floor; the hazard stripe doesn't animate under `prefers-reduced-motion`. | `ci/smoke.mjs`. |
| AC10 | Any new/moved/retitled chapter banner regenerates the Code Atlas clean. | `node tools/gen-code-map.mjs --check`. |
| AC11 | Mr. Wrangler cannot send/recall/book a recovery (AI fence, §3.6). | `ci/logic-test.mjs` over the `apply_changes` allowlist (mirrors invoicing-payments AC7). |
| AC12 | Cache-bust `?v=` token bumped on deploy (`style.css`/`rule-usage.js`/`app.js` in `index.html`). | release check. |

Standard gate run (port 8000 reserved → swap to **9147** first, then `git checkout -- ci/`): `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`.

---

## 10. Risks & Edge Cases

| Risk | Severity | Mitigation |
|---|---|---|
| **Outbound PII to the agency from a client-only-gated action** (§3.2) — anyone with the team password POSTs `collectionsSend`. | **Critical** | `collectionsSend` is **blocked until server-trust (backend-data OQ-1) resolves**; Phase 1 is local-only (no outbound). PII allowlist server-enforced. |
| **Agency token leak** into the public bundle/repo. | **Critical** | Token in GAS Script Properties, named-only; never in repo/spec/client; AC6. |
| **Over-sending PII** (forwarding card tokens / selfies / `idNumber`). | High | Server assembles payload from an explicit allowlist; client can't widen it; AC5. |
| **Double-placement** on an ambiguous failure. | High | Not auto-retried (off the sync-backoff path); placement nonce (OQ-8); `already-placed` reject; ambiguous result surfaces to the operator. |
| **Recovery over-books money** (a remit exceeds the placed balance). | High | Server re-caps at `placedBalanceCents` (`recovery-over-cap`); routes through the server-owned payment primitive (#177); `LockService` lock. |
| **Accounting double-counts** a placed balance as both AR and recoverable. | High | Placement contra's booked revenue into a recoverable bucket; `acctPnl` excludes placed balances from active revenue (§7.2); AC3. |
| **Cross-customer placement** mixes debtors. | Medium | Server rejects `cross-customer` (one customer per placement); customer-isolation invariant (§3.3). |
| **Refunding / paying a placed invoice** double-collects. | Medium | Placed invoice blocks normal office payment + refund (§7.3/§7.7). |
| **Customer reputational/legal harm** from an erroneous placement. | High | manager-tier + dual-approver gate (§3.1); audit trail (placedBy/approvedBy/history); recall path. **Legal/FDCPA compliance is Jac's counsel's call** (OQ-7). |
| **Webhook forgery** (if push sync is built). | High (if 5.4b) | Default to **pull** (§5.4a, no inbound surface); a webhook needs HMAC auth in Script Properties before it's considered. |
| **AI places a debt / leaks PII outbound.** | High | Hard AI fence (§3.6) — outbound is outside `apply_changes`; AC11. |
| **Backend predates the agency token** → confusing error. | Low | `collections-not-configured` graceful degrade (§5.5). |
| **Provider mismatch** — the chosen agency is batch/CSV-only (no real-time API), so `collectionsSend`/`collectionsSync` don't fit and status drifts silently. | Medium | Pick the vendor before Phase 2 (OQ-13); spec stays provider-agnostic; re-scope §5.4 to manual reconciliation if batch-only. |
| **Fee/remittance model mismatch** — agency remits gross + separately bills its fee, but the recovery flow assumed net, mis-booking the cost. | Medium | Confirm remittance model before Phase 3 (OQ-14); `feeCents` is server-recorded either way; fee-as-expense ties to OQ-2. |
| **Floor/margin leak via the agency fee** (an aggregate contingency-cost rollup is margin-adjacent). | Medium | Fee/recovery-cost cells gate to money-tier (§3.5/G-PII); never on a customer surface. |

---

## 11. Open Questions (every real fork)

> **Resolved 2026-06-29:** OQ-3 → **D1** (manager + second approver, Settings toggle default ON). OQ-5 → **D2** (placement **auto-blacklists**; Recall prompts to lift). OQ-9 → **D3** (one invoice per placement; place a stack via **origin-referencing invoice merge** — confirm/build that first). OQ-1/OQ-2/OQ-4/OQ-7/OQ-8/OQ-10/OQ-11/OQ-12/OQ-13/OQ-14 → **D4** (adopt conservative drafts; OQ-1 + OQ-2 remain the load-bearing blockers on Phase 2 outbound + Phase 3 recovery booking respectively).

> **The load-bearing two are OQ-1 (server trust — blocks the whole outbound integration) and OQ-2 (the exact accounting treatment of a placed/recovered balance). Nothing in Phase 2 ships before OQ-1; nothing in Phase 3's recovery booking ships before OQ-2.**

**OQ-1 — Server-trust for the outbound action (BLOCKER).** `collectionsSend` ships PII to a third party; today the backend can't verify the caller's tier (`backend-data` D3/OQ-1, `accounting` Q13). Options: (a) **wait** for `backend-data` to add per-role passwords or a server-side `tierRank` check, then ship Phase 2 (recommended — conservative); (b) ship Phase 2 with **client-gating only** and accept that any password-holder can place a debt (rejected — outbound PII blast radius is too high). **Trade-off:** real security vs. time-to-ship. *Recommend (a); Phase 1 (local queue) delivers most of the value meanwhile.*

**OQ-2 — Accounting treatment of a placed / recovered balance (load-bearing money fork).** When exactly does the placed balance leave revenue — at *queue* or at *placed*? Is it a **contra-revenue** (reverse the booked income into a recoverable-receivable) or an **allowance/bad-debt-reserve** entry? When a partial recovery comes back, does it **re-recognize** the proportional LA sales tax, or treat the whole remit as recovery-of-receivable (tax already filed)? The agency's contingency **fee** — a `Collections` expense category? **Trade-off:** CPA-correctness vs. simplicity. *Resolve jointly with the `accounting` spec (D5 explicitly defers the exact treatment here).*

**OQ-3 — Dual-approver on Send?** Recommend **manager-tier + a second-approver password** (the pattern Jac likes, invoicing-payments D2) for an irreversible outbound act. Or is a single manager confirm + the recall path enough? **Trade-off:** friction vs. blast radius. Default a **Settings → Company "Require a second approver to send to collections"** toggle (default **ON** recommended), symmetric with the refund toggle.

**OQ-4 — Status sync: pull (poll) or push (webhook)?** Recommend **(a) pull** — a server-side time trigger, no inbound surface (§5.4). A webhook is lower-latency but opens an authenticated internet-facing endpoint. **Trade-off:** latency vs. attack surface. *Recommend pull until latency demands otherwise.*

**OQ-5 — Does placement auto-blacklist the account?** Recommend **decoupled** (collections is per-invoice; blacklist is per-account) with a one-tap prompt on the send confirm (§6.2). Or auto-blacklist on placement? **Trade-off:** a customer with one bad invoice vs. a blanket block.

**OQ-6 — Color of a recovering invoice.** `PartiallyRecovered`/`Recovered` — green-adjacent (money came back) or stay gray (off active books)? **Trade-off:** signal "money recovered" vs. "this is closed, don't chase." (§4.3.)

**OQ-7 — PII scope + customer notice (legal).** (a) Does the agency need `idNumber`/skip-tracing data, or is name+contact+balance enough (recommend the minimal allowlist)? (b) Does JacRentals send any **customer-facing collections notice**, or does the agency own all debtor contact (recommend agency-owns; no auto-notice in v1)? **This is a legal/FDCPA question for Jac's counsel** — the spec defaults to the most conservative (minimal PII, no app-sent notice).

**OQ-8 — Placement idempotency nonce?** A per-invoice server-held nonce makes an accidental re-send a no-op (mirrors the Stripe idempotency-key ask, `backend-data` OQ-14). Recommend **yes** for an outbound side-effecting act.

**OQ-9 — One invoice per placement, or batch?** v1 simplest is **one invoice per placement** (clean money math); a multi-invoice (same-customer) placement is a convenience. **Trade-off:** simplicity vs. real-world "place this customer's whole stack." A dedicated `collections` *entity* (vs. inline invoice fields) only becomes necessary for multi-agency / per-placement documents — defer.

**OQ-10 — Queue surface: fold into the existing `BACKOFFICE_BOARDS`/`board` catalog entry, or a dedicated popup?** Recommend **fold in** (no new `WINDOW_CATALOG` entry, less churn) unless the queue needs bespoke chrome (§6.3).

**OQ-11 — Can a placed invoice still be paid at the office?** If a customer walks in and pays *after* placement, does the office accept it (then owe the agency its cut), or refuse and redirect to the agency? **Trade-off:** customer convenience vs. a tangled remit (§7.3). *Recommend refuse-and-redirect for v1.*

**OQ-13 — Which agency / integration provider (the contract is provider-shaped).** The §5.3 payload + sync model are written **provider-agnostic on purpose**, but a real vendor pins them: a modern API-first agency (e.g. a REST/webhook product) gives a clean `collectionsSend`→`case_id` round-trip and supports pull *or* push sync; a traditional agency may take **batch CSV/SFTP placements** with no real-time status at all (sync becomes a manual reconciliation, not `collectionsSync`). **Trade-off:** an API-first vendor fits this spec almost as-written but may cost more / want a bigger contingency cut; a cheap local agency may force a degraded, manual-sync Phase 2. *Recommend: pick the vendor BEFORE building Phase 2 and confirm it exposes (a) an authenticated placement endpoint and (b) at least pull-able status — if it's batch-only, re-scope §5.4 to a manual reconciliation surface. This is a business+integration decision; the spec stays provider-agnostic until Jac names one.*

**OQ-14 — Contingency billing / how the agency's cut is settled.** The fee model is the agency's contingency rate (commonly 25–50%, often **tiered by debt age** — older debt costs more) but *how it's settled* shapes §7.4: (a) the agency remits **net** (keeps its cut, wires us the remainder) — then `collectionsRecovery.amountCents` is what *we receive* and `feeCents` is informational/derived; or (b) the agency remits **gross** and **separately invoices JacRentals** for its fee — then the fee is a real AP/expense bill (accounting), not just a number on the recovery. The spec currently assumes (a)-style accounting (gross recovered − fee = net to us). **Trade-off:** model (a) is simpler bookkeeping; model (b) is what some agencies actually do and needs an expense/AP entry. *Confirm the vendor's remittance model (ties to OQ-2's fee-as-expense-category fork and OQ-13's vendor choice) before Phase 3 books recoveries.*

**OQ-12 — Threshold / auto-suggest.** Should the app **auto-suggest** placement when an invoice crosses a Settings threshold (e.g. the 120-day `Collections` tier, already a Settings value per invoicing-payments Q5/D), or is placement always a manual manager decision? Recommend **suggest, never auto-place** (auto-placing PII outbound is exactly the kind of irreversible act that must stay human-gated).

---

## 12. Dependencies & Sequencing (roadmap slugs)

| Depends on | Why | Must land first? |
|---|---|---|
| **`backend-data`** | The outbound `collections*` actions are additive on `backendCall`; the agency token lives in Script Properties; **and OQ-1 (server-side tier trust) BLOCKS the outbound action.** | **Yes for Phase 2** — OQ-1 must resolve before any outbound/PII-egress action ships. Phase 1 (local) needs no backend change beyond an additive field + the local action. |
| **`invoicing-payments`** | Owns the invoice, the aging ladder, the `Collections` tier, the payment path the recovery reuses, and the `Sent to Collections` status decision (D3). Recovery routes through `recordManualPayment`; money totals stay server-owned. | Shipped — read + reuse; the new status/field is the additive change. |
| **`accounting`** | D5 names this area; the **recoverable-receivable netting + recovery booking + agency-fee cost** is co-owned. OQ-2 resolves jointly. | Coordinate Phase 1 (revenue exclusion) + Phase 3 (recovery/fee booking). |
| **`customers-crm`** | Customer standing (audit log entry; optional blacklist coupling, D3); the customer fields the allowlist forwards. | Read + additive audit entry. |
| **`comms-notifications`** | Any customer-facing collections notice (legally sensitive; agency usually owns it). | Only if OQ-7(b) ever says the app notifies — not v1. |
| **`financials-kpi`** | Aging/AR KPIs must drop placed invoices from "overdue AR." | Read-only constraint (Phase 1). |
| **`design-system`** | Yard data-plate language, R-rulebook stamps (R26+), WINDOW_CATALOG, flag-color treatment via `jactec-ui`. | Concurrent. |

**Sequencing.** Phase 1 (local queue + status + accounting revenue-exclusion) ships against today's shipped invoicing/accounting with **only additive invoice fields** — fastest trustworthy win, **safe even with `backend-data` OQ-1 open** (no outbound action surface). Phase 2 (the agency integration) is **hard-blocked on `backend-data` OQ-1 (server-side tier trust)** and OQ-3 (dual-approver) — no outbound-PII action ships until the server can verify the caller. Phase 3 (recovery booking + fee accounting + true bad-debt close) is blocked on **OQ-2** (the accounting treatment) and coordinates with the `accounting` spec.

---

*End of DRAFT — every numbered item in §11 is open for Jac's critique. The two load-bearing forks are OQ-1 (server trust — the entire outbound integration depends on it) and OQ-2 (the accounting treatment of a placed/recovered balance). Nothing outbound ships before OQ-1; nothing books a recovery before OQ-2. The agency token is server-side, named-only, never in this repo.*
