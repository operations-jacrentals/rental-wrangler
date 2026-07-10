# Customers / CRM — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/customers-crm`
**Task branch:** `customers-crm/spec` (proposed)
**Maturity:** ✅ Shipped
**Scope:** The Customer record and everything that hangs off it — account/contact details, the dual sales funnels, the activity-cadence engine, card/ACH payment methods with card-bound agreements + selfie capture, and the new/edit overlay — documented AS CANON with proposed forward work.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

**Posture (important):** Jac runs a small, trusted single-yard team. Internal **visibility** of customer info is **open**; the gating that matters is **money *movement*** (and competitive secrets like the margin floor, gated in `units-fleet`). These resolve the §11 Open Questions and amend §3 / §6 / §7.

- **D1 · Staff see the full customer card; gate only the money *actions* (resolves Q4/Q5/Q5b).** **Reverses** the draft's "collapse the payment block" idea. The payment-method **rows stay visible to every signed-in user** (brand · last4 · sign-state), as do the spend `_digest` and net terms — read-only. Only the **money action buttons** stay `canMoney()`-gated: Add card, Take payment / Charge, Set default, Sign, Remove, ACH add/verify. (This still closes the real shipped gap — today a staff/no-role view can *click* default/sign/remove — by wrapping those **actions** in `canMoney()`, while leaving the display open per Jac.)
- **D2 · `idNumber` stays visible, plaintext, no mask, no gate (resolves Q6).** It's internal identity info the team may see. The **hard rule is unchanged**: never export it to the public repo / Pages / search blob / AI tool output. Internal UI display is fine.
- **D3 · Anyone can blacklist, with an audit trail (resolves Q3).** There is **no blacklist UI today** — `Blacklisted` is in the `customerAccountType` registry (`config.js:113`) but absent from `NC_ACCOUNT_TYPES` (`app.js:14040`). Wire it into the account-type pills, **settable by any signed-in user (no tier gate)** via a **red hazard-stripe confirm** ("This blocks new rentals for this account"); stamp `blacklistedAt` + a `'Blacklisted by <role>'` `activityLog` entry (audit, not gate). **Soft gate:** blocks *new* rentals only, never retro-cancels live ones (read by `rentals-dispatch`).
- **D4 · Customer merge → Phase 2 (resolves Q7).** Spec it now, build later — it's destructive and touches rentals/invoices.

**Defaults adopted:** Q1 → `_digest` recomputes **client-side on load** (single-pass, bucketed by `customerId`, isolation-filtered) · Q2 → `payStatus` becomes **derived** from open invoices (kills drift). **Now moot** given the open-visibility posture: Q11 (role-fixture mainly needs to assert staff can't *click* money actions — keep as a light check) and Q12 (demo PII masking — dropped; `idNumber` isn't masked). Q8/Q9/Q10 stand at their recommendations.

---

## ✅ Decisions — 2026-07-08 Customer Details reorg, PR 1 (Jac) — SHIPPED to `area/customers-crm`

Full design + rationale: [`docs/superpowers/specs/2026-07-08-customer-details-invoice-reorg-design.md`](../superpowers/specs/2026-07-08-customer-details-invoice-reorg-design.md). This reshapes the §2.2 detail renderer, folds the §2.4 dual funnels, and embeds invoices — amending §2, §6.1, §6.4, §6.7.

- **R1 · Dual funnels → ONE centered toggle** `RENTAL | EQUIPMENT SALES` (the toggle *is* the section header; no title). Each tab shows an RYG urgency dot for its most-urgent open Next Action. "Membership"→**Rental**, "Used Sales"→**Equipment Sales**. Folds the old side-by-side `.detail-cols` **and** the Action Board.
- **R2 · Next Actions (replaces the schedule feature).** Each funnel owns a running list of dated Next Actions (single-row, date-first chip reading "Late: Nd" when overdue, RYG by date), a blue **＋ Action** pill, and **✓ Done / ✕ Cancel** that both log the outcome. Stored as funnel-scoped `activityLog` entries (`scope:'rental'|'usedSales'`, `outcome` on close); the Due-Today banner ignores closed ones; legacy untagged entries bucket to Rental.
- **R3 · Per-toggle Action Log** (renamed from history) — collapsible, built strictly from funnel-scoped `activityLog` **action** entries; **NOT** the card-bottom `historySection`. ✓/✕ prefix for done/cancelled.
- **R4 · Equipment Sales gains `desiredAge` + `desiredHours`** buyer-criteria fields, and interest is by **Make OR Category** (`interestedMakes[]` + `interestedCategoryIds[]`; the +Make/Category button; tan Make tag vs orange Cat tag).
- **R5 · Account button relocated** from the top-right title bar onto the funnel gate row (both tabs); opens the existing agreements window. The membership lifecycle pills (Take Renewal / Print Agreement / Cancel) moved **into** that window, `canMoney()` preserved verbatim. No separate manual "+Log" (redundant with ＋Action → ✓).
- **R6 · Invoice card RETIRED** as a standalone grid card (`config.js` COLUMNS/COLUMN_OF; data model + `DETAIL.invoices` kept). Its list is now an embedded, scrollable **Invoices section directly below the funnel** in Customer Details, with a manager summary strip. A row expands (accordion, one at a time) into the **pretty yard-log invoice** (shared `invoiceDocHtml()`, print byte-identical; ported from `claude/invoice-print-pdf-styling-i0n2ll`); expand drops the list's inner scroll so the whole invoice pushes content below down. Status pill doubles as the action menu (Pay/Print/Send; solid-on-open). Cross-links route via `pillTo('invoices')` → `openInvoice()`. Mobile-reflowed via `@container` on `.io-sheet-wrap`.
- **R7 · Drag-to-build re-homed** to the embedded section — drop rental/WO on an invoice row / opened invoice / a mid-drag **+Invoice** pill (new invoice, snaps via `openInvoice`); mobile long-press menu path fixed; Rental & WO tap "Invoice" buttons snap to the invoice. Building lines stays ungated (only *charging* is `canMoney()`); menu-linking stays gated by `linkRoleAllows`.
- **R8 · "Sales — coming soon" placeholder** card holds the retired invoice slot (right column, `Customers | Sales`; bespoke like `calendarCardEl`, not in `GRID_CARDS`). `MOBILE_CARDS` drops the dead `invoices` entry for `sales`.

**Follow-ups (own PRs):** the real **Sales card** dashboard (R8 placeholder → live) · **Merge accounts** (still Phase 2 per D4 — §6.4) · **Make→Units filter** (make pill navigates) · wire **Send invoice** to `area/comms-notifications`. **Promotion note:** at staging, `printInvoice`/`invoiceDocHtml` converges with `area/invoicing-payments` (both produce the yard-log doc — take the refactored `invoiceDocHtml`).

---

## Shipped status (2026-07-09)

On 2026-07-09 a large batch — including the "Customer Details reorg" — promoted from
`staging` to `main` (production). This section is a reality-check pass against the rest of
this doc; the prose below is left as originally written (per Jac: annotate, don't rewrite),
so treat the items here as canon-overriding wherever they conflict with older section text.
Inline `[2026-07-09: …]` markers at the affected sections point back here.

- **SHIPPED — Invoice card retirement.** The standalone `invoices` grid column is gone from
  `COLUMN_OF` / the column-tab UI (config.js:401 comment: *"no 'invoices' — links route via
  openInvoice() into Customer Details"*); `GRID_CARDS` (config.js:358) still lists `invoices`
  as an entity definition (kept for `SORT_FIELDS`, `DETAIL.invoices`, routing/cascade), but it
  is no longer a selectable card. Invoices now render as an embedded, scrollable, accordion
  section (`customerInvoicesSection`, app.js:3905) directly under Customer Details — not
  documented anywhere in §2/§6 of this spec (written pre-reorg, 2026-06-28).
- **SHIPPED — Programs funnel (was: two separate Membership + Used Sales blocks).** §2.4's
  "two independent funnels, both rendered as the gate-timeline dropdown" is now ONE section
  (`funnelSectionHtml`, app.js:3812): a centered R14 segmented toggle — **Rental | Equipment
  Sales** — IS the header, each tab wearing an RYG urgency dot (`naDotClass`) for its own
  dated Next Actions. `usedSalesStage` / `membershipStage` remain separate data fields
  (§2.4/§4.1's data model is still accurate) — only the *UI* merged into one toggle.
- **SHIPPED — Action Board replaced by per-funnel Next Actions + Action Log.** §2.2's "Action
  header/entry" and "Activity columns" (logged LEFT / scheduled RIGHT) rows are retired for
  Customers; dated RYG Next Actions with Done(✓)/Cancel(✕)/+Action live inside each funnel tab
  (`nextActionsHtml`), backed by a collapsible per-tab Action Log (`actionLogHtml`). The
  underlying `activityLog[]` shape gained additive optional keys (`scope`, `outcome`,
  `closedWhen`) — not a breaking schema change, §4.5's additive-only rule held.
- **SHIPPED — Membership lifecycle actions moved into the agreement popup.** Cancel
  Membership / Pay Cancellation / Print Agreement (`membershipActionsHtml`, app.js:3723) now
  render inside the existing `agreement` `WINDOW_CATALOG` popup, not the card body. The
  `canMoney()` gate on Cancel/Pay-Cancellation is preserved verbatim (Print Agreement stays
  ungated). No new `WINDOW_CATALOG` row was needed (reused the existing `agreement` kind) —
  §6.7's catalog list is still accurate as written. Enrollment was already relocated into this
  same popup in an earlier change (no duplicate enroll button exists).
- **SHIPPED — Equipment Sales buyer-criteria fields.** `desiredAge`, `desiredHours`
  (`custMetaField`, app.js:3808) and `interestedMakes[]` (Make-OR-Category interest, alongside
  the existing `interestedCategoryIds[]`) are real, persisted fields (app.js:3825-3830; seeded
  in the new-customer scaffolds). **Not documented** in §4.1's data-model table — add these
  three rows there.
- **NOT SHIPPED — placeholder only — Sales card ("PR2").** `salesCardEl` (app.js:8039) is a
  bespoke "coming soon" plate occupying the grid slot the retired Invoice card vacated
  (`sales: 'right'` in the column map, config.js:401). No list/detail view, no data model — the
  real Sales dashboard/work-manager is an explicitly deferred future PR. Not mentioned
  anywhere else in this spec (out of scope when it was written).
- **STILL PLANNED — unaffected by this promotion — §6.2a Payment Methods gate-visibility
  fix.** `cardTabBody` / `achTabBody` (app.js:643-676) still render card/ACH rows (brand,
  last4, Sign, Make-default, remove ✕) unconditionally to any viewer; only the `+Card`/`+ACH`
  add buttons stay `canMoney()`-gated. §3.2 item 1's "gate gap to close" and §11 Q5 are **still
  open**.
- **STILL PLANNED — `_digest` live recompute.** No `recomputeDigests` action or client-side
  recompute pass exists in app.js today. §2.6 / §4.2 / §5.2 / §8 Phase-1 item 1 are all still
  aspirational, unchanged by this promotion.
- **STILL PLANNED / open question — `payStatus` derivation (§7.3, §11 Q2).** Still a
  stored/seeded field, not derived from open invoices.
- **BUILT DIFFERENTLY THAN SPEC'D — Blacklist (§6.3, §11 Q3).** Shipped (app.js:15489-15490,
  7342-7344) as a direct action pill on the Account section ("Blacklist" / "Lift blacklist",
  double-click-to-arm confirm, `blacklistedAt` + `activityLog` audit entry) — matching the
  top-of-doc **D3 decision** (any signed-in user, no tier gate) rather than §6.3's body text
  (which still describes a manager+-gated red hazard-stripe popup confirm; that prose predates
  D3 and was never reconciled with it). `Blacklisted` is still **absent from
  `NC_ACCOUNT_TYPES`** (app.js:17641) — §2.8's gap row is still accurate for the *account-type
  pill* specifically, even though the standalone blacklist action now exists and works.
- **R-rulebook numbers assigned:** `R28` = the account button (`acctBtn`, app.js:3802-3804)
  that opens the agreement popup; `R29` = the invoice status/action menu pill
  (`invoiceStatMenu`, app.js:3891). Both were renumbered from an earlier draft's R27/R28 due to
  staging drift. `R30` was separately claimed by the concurrent Wrangler-Ops paused banner
  (app.js:9045) — unrelated to this area; noted here only so `Rxx` placeholders still in
  §6.2a/§6.3/§6.4 aren't accidentally assigned R30 later.

## Shipped status (2026-07-10) — Account/Agreements redesign + membership auto-enroll

A same-day batch on `customers-crm/account-agreements-redesign` (PR #584 → `area/customers-crm`,
not yet merged as of this note) closed a real bug — staff could set a customer to `Business
Member` via a raw account-type picker with zero invoice/charge/cadence — and rebuilt the
surrounding Account/Agreements UI, membership enrollment, and the account-block gate. Full spec:
`docs/superpowers/specs/2026-07-10-account-agreements-membership-redesign-design.md` (D1-D27);
plan: `docs/superpowers/plans/2026-07-10-account-agreements-membership-redesign-plan.md`.

- **R-numbers shifted again since the 2026-07-09 note above — that note is now STALE.** Current
  reality: `R27` = `acctBtn` (not R28), `R28` = `invoiceStatMenu`/`js-inv-statmenu` (not R29),
  `R29` = the new `toggleChip` builder (Member-Mode / Net-Terms chips, app.js ~5341). `rule-usage.js`
  (generated, `ci/gen-rule-usage.mjs --check`) is the source of truth going forward — treat any
  prose R-number here as a snapshot, not canon.
- **SHIPPED — account type can now ONLY change via a signed agreement (`agreementSignCommit`,
  app.js).** The raw account-type picker + its `js-nc-acct` handler are removed; Wrangler/CSV
  import clamp to non-member (`wrAccount`). This is the actual bug fix — every account-type
  change now requires a captured signature, and for a Member type, a Start Date + a card on file.
- **SHIPPED — Account section + Agreements accordion** (`customerAccountSection`,
  `customerAgreementsSection`, app.js) replace the old top-of-card account fields.
  `paymentMethodsSection` was **deliberately kept, not retired** — it still owns real ACH/card
  management (nickname, make-default, remove) the new accordion doesn't replicate (read-only).
- **SHIPPED — `Pending` membership status** (`membershipStatus`) for a signed-but-future-dated
  enrollment: card isn't charged until the Start Date; if Start Date is today, it charges
  immediately. **Backend now enforces this too** (2026-07-10 patch to `membershipEnroll_` /
  `membershipBillingCron` in the Apps Script project) — a deferred enrollment lands the member
  account-type + commitment fields immediately without charging, and the daily cron picks up the
  first charge on the Start Date via `commitmentStart`/`paidUntil` (fields that already existed;
  no invented schema). The frontend's sign=enroll commit was corrected to match this real
  contract — PROD never fabricates a local invoice (the backend creates it), fixing what would
  otherwise have been a permanently-unpaid phantom invoice for every future-dated enrollment.
- **SHIPPED — account-block delivery gate** (`accountBlock`, `blockPicker`,
  `accountBlockGate`/`accountBlockOverride`): `blacklist` (Owner-tier, hard stop, no per-action
  bypass) and `invoice-hold` (staff-tier, resolves when the held invoices clear) are new manual
  block types; `no-card` / `failed-payment` are derived and extend (never weaken) the pre-existing
  `cardGateBlocked` gate. A failed **membership** charge specifically does NOT trip this gate
  (D11) — only a declined rental/other invoice does, via a customer-level `c.chargeFailedAt` flag
  cleared by ANY successful payment on the account (not per-invoice).
- **SHIPPED — KPI strip rework** (`invSummaryStrip`): Member-Mode sales toggle (arrows + inline
  delta, the underlying tile number never changes) + an Open/All/Transactions view toggle
  (replaces the plain "Invoices" title). "Paid YTD" was renamed **"1YR AVG"** and changed from a
  calendar-year sum (reset toward $0 every January) to a trailing-365-day total divided by 12 — a
  smoothed monthly run-rate that never resets.
- **SHIPPED — invoice accordion: click anywhere in an open invoice's header to collapse it**, not
  just the chevron (excludes the status-menu's own dropdown, which still needs its own click for
  Pay/Print/Refund).
- **Design-system Phase 6 (dot→background sweep) shipped SEPARATELY**, PR #588 →
  `area/design-system` (merged) → `staging` (live) — out of scope for this doc/area; see that
  plan's Phase 6 note. Only 2 of 6 dot-bearing toggles found codebase-wide were in scope (the two
  genuine 3-state red/yellow/green status toggles); 4 category-color pickers were left alone.

---

## 1. Goal & Problem

### 1.1 What this area is for

The **Customer** is the spine of the business. Every rental, invoice, payment, membership, agreement, and funnel move resolves back to one customer record. Customers / CRM owns:

- **Who the customer is** — contact + account identity (name, company, phone, email, industry, address, driver's-license/ID #, PO requirement, payment terms).
- **What we're allowed to do with their money** — cards + bank accounts on file, the card-bound signed agreement, the selfie/signature packet, and the gates those drive.
- **Where they are in our pipelines** — the **Used-Sales** funnel and the **Membership** funnel (dual, independent).
- **How healthy the relationship is** — the 5-stage activity-cadence engine ("when is this customer due to rent again, and how overdue are they?") and the 9-month spend chart.
- **What we've done and plan to do** — the Activity Log (logged actions) + Schedule (follow-ups).

### 1.2 The business problem

JacRentals is a relationship business in a small market (Sulphur/Lake Charles, LA). The same construction/industrial outfits rent repeatedly. The money question isn't "did we close this deal" — it's **"is this account still warm, and is it safe to put a $90k machine on their job with their card on file?"** The CRM has to answer both at a glance, on the yard, from a phone, without a separate sales tool.

### 1.3 North star

> Open a customer and instantly know: **can I rent to them right now** (card + signed agreement + pay status), **are they slipping away** (cadence stage), and **what's the next move** (funnels + scheduled actions) — with every money/PII surface gated to the right role.

---

## 2. Current State (Baseline)

This is the **live, shipped** Customers card. Treat it as canon.

### 2.1 The customer record (data.js:54–74)

Seeded demo rows carry the full production shape. Source fields are editable; the `_digest`
history block is **DERIVED in production but seeded static today** (see §2.6). Key fields:
`customerId`, `firstName`/`lastName`/`name`, `company`, `phone`, `email`, `address`,
`accountType`, `payStatus`, `industry`, `requiresPO`, `rentalProtection`, `accountNotes`,
`idNumber`, `netDays`, `stripeId`, `cards[]`, `usedSalesStage`, `membershipStage`,
`interestedCategoryIds[]`, `salesAction`, `activityLog[]`, `_digest{}`, plus membership fields
(`paidUntil`, `paidCadence`, `unlimitedTransport`, `paidFees`) and `custom{}`.

### 2.2 The detail renderer — `customers:` (app.js:6087–6168) — SHIPPED

> **[2026-07-09: render order below is SUPERSEDED — see "Shipped status" above.]** The
> 2026-07-08 Customer Details reorg changed the order to: title → filled Notes → the ONE
> Programs funnel section (toggle = header) → embedded Invoices → activity chart → Account →
> Comms → Payment Methods → empty Notes → History (`DETAIL.customers`, app.js:7364-7375). The
> "Membership + Used Sales" two-column row and the separate "Action header/entry" / "Activity
> columns" rows in the table below no longer exist as such — folded into the funnel toggle's
> per-tab Next Actions + Action Log.

Render order, top to bottom:

| Block | Source | Notes |
|---|---|---|
| Title | `fullName(c)` | R9 title flags carry account-type + pay-status; no badge row |
| Notes (top) | `notesSection('customers', …, 'accountNotes')` | filled notes float above funnels |
| Membership + Used Sales | `membershipSectionHtml`, funnels | two-column `detail-cols` |
| Action header / entry | `js-act-open` (record/schedule) | "Actions" / "Schedule" labels |
| Activity columns | `activityLog` split on `^Scheduled:` | logged LEFT, scheduled RIGHT |
| Activity chart | `customerActivityChart(c)` | spend area + cadence track |
| Account | merged Contact+Account | LEFT = entered fields, RIGHT = facts + derived; faded selfie backdrop |
| Payment Methods | `paymentMethodsSection(c)` | Cards / ACH tabs |
| Notes (bottom) | empty-notes slot (R12) | |
| History | `historySection('customers', …)` | `_digest` audit |

Click-to-edit on every contact/account field via `efield()` → `data-edit="custField"`
(auto-saves through the persist hook). Empty fields render the R5 dashed `+Thing` add.

### 2.3 Activity-cadence engine — `customerActivity(c)` (app.js:5261–5279) — SHIPPED

Reads `_digest.avgFrequencyDays` (`f`) and `_digest.lastInvoice` (`last`). Computes
`expDate = last + f days`, `pastPct = 100*(daysSinceLast − f)/f` (signed), then buckets:

| Stage | Condition | Color |
|---|---|---|
| **New** | no `f` or no `last` | gray |
| **Active** | `past < 0` (before expected) | green |
| **Check-in** | `0 < pastPct ≤ 25` | yellow |
| **Action Required** | `25 < pastPct ≤ 50` | orange |
| **Inactive** | `50 < pastPct ≤ 100` | red |
| **Lost** | `pastPct > 100` | red (deep) |

`customerActivityChart` (app.js:5302) draws a 9-month spend area chart (`customerMonthly`,
`rentalAmt`) plus a second "days rented" series (leather-tan dashed, `#c2925a`), with a
Today line + dashed Next-Expected line + runway band, and a Best-Month callout. **This is
the ranch-twist reference implementation** (tan dashed series).

### 2.4 Dual funnels — `gateTimeline` / `openFunnelDropdown` (app.js:11383–11508) — SHIPPED

> **[2026-07-09: SHIPPED, but UI merged — see "Shipped status" above.]** The stage dropdowns
> (`gateTimeline`) described here are still used to *change* a stage, but the customer-detail
> presentation is now the single Programs toggle (`funnelSectionHtml`, app.js:3812) — Rental |
> Equipment Sales tabs, each with an RYG dot — not two side-by-side blocks. Data model below is
> unchanged.

Two independent funnels per customer, both rendered as the gate-timeline dropdown:

- **Used Sales** (`usedSalesStage`) — `funnelStage` order, free choice.
- **Membership** (`membershipStage`) — `MEMBERSHIP_FUNNEL_ORDER`, terminal stage `Signed`
  is **locked** (auto-set by signing the membership agreement, never manual; F3).

Stages: `N/A → Inbound Lead → Outbound Lead → Don't Contact → Contacted → Not A No! →
Payment Discussed → Paid/Signed`. Every move logs to `activityLog`. Interested categories
(`interestedCategoryIds`) attach via `openIntCatDropdown`.

### 2.5 New/Edit overlay — `kind: 'newCustomer'` (app.js:9448–9535; open at 14017) — SHIPPED

Tabbed popup (`nc-popup`): an **Account** tab + one tab per saved card (signed-dot rail) +
`+Card`. Account tab fields: Name*, Company, Phone*, Email, Industry, Notes·PO·Protection,
Account type pills, Driver's-license/ID #, Net-days terms. Validations in `saveNewCustomer`
(app.js:14094): name required, phone required, email format, required custom fields, and the
**forced** PO (Yes/No) + Rental-Protection (Yes/No) answers.

**Quick-add** (`quickSaveCustomer`, app.js:14049): the instant First+Phone exist, the record
persists behind the scenes and the popup flips to edit-in-place so a card can be attached
without a second Save. `applyCustomerLink` re-anchors a Quote/invoice that spawned the create.

### 2.6 `_digest` — STATIC TODAY (data.js:54–57 note)

> **[2026-07-09: still STILL PLANNED — unchanged by the 2026-07-09 promotion.]** No
> `recomputeDigests` action or client-side recompute pass exists in app.js today.

`_digest{ totalPaid, visits, years, avgFrequencyDays, activePct, firstInvoice, lastInvoice }`
is the seed of the cadence engine, the spend chart, History, and the Sales/Office KPIs
(app.js:7138, 8523, 8787). The seed comment is explicit: these numbers are **derived in
production** but are **currently hardcoded** in the seed. New customers get a zeroed digest
(app.js:14061/14132). **There is no live recompute pass that walks rentals/invoices to rebuild
`_digest`.** This is the single biggest gap in the area (see §7.1, §11 Q1).

### 2.7 Payment methods + card-bound agreements (app.js:615–658) — SHIPPED

`paymentMethodsSection` → Cards / ACH tabs. Each card carries its own
`agreement: { signedAt, version, signature, selfie }` (migration app.js:104–114). Per
prior art `docs/superpowers/specs/2026-06-18-card-bound-agreements-design.md`: a signature
is always attached to a card; cards can be saved+charged **Unsigned**; **any unsigned card
blocks On-Rent + delivery**. Selfie backdrop on the Account section
(`docs/superpowers/specs/2026-06-20-customer-photo-account-backdrop-design.md`).

### 2.8 What's missing / partial (shipped-area gaps)

| Gap | State |
|---|---|
| Live `_digest` recompute | **Missing** — static seed only |
| Blacklisted account type in the new/edit pills | **Partial** — `Blacklisted` exists in `customerAccountType` (config.js:113) but is NOT in `NC_ACCOUNT_TYPES` (app.js:14040); no UI to set it |
| Merge / de-dup of duplicate customers | **Missing** |
| Contact-attempt outcome on scheduled follow-ups | **Partial** — schedule logs free text only |
| PII export / GDPR-style deletion | **Missing** |
| Per-customer aged-receivables roll-up on the card | **Missing** (lives on Invoices) |

---

## 3. Users, Roles & Data Gates

Roles carry a **tier** (config.js:326, `ROLE_TIERS`): `staff(1) < money(2) < manager(3) <
admin(4) < developer(5)`. The per-role default tier is `BUILTIN_ROLE_TIERS` (config.js:340),
overridable at runtime via `settings.roleMeta`; the legacy **Owner** login bridges to `admin`
until explicitly converted to Manager (config.js:344 — the rollout never strips an in-use login
mid-flight). The shipped money gate is `canMoney() = !currentRole || roleTier(currentRole) ≥
tierRank('money')` (app.js:14166) — note the `!currentRole` short-circuit: the **`#local`
demo / no-role build shows every money surface** (intentional, for design review on `:9147`),
so a gate that relies *only* on `canMoney()` is wide-open in demo. New gates that protect real
PII/money in production must therefore *also* be exercised under a real role fixture, not just
the demo (see §9 A3 / §10 "demo unlock").

The 15 shipped roles map onto five tiers. The five **built-in KPI roles** (config.js:302) are
Mechanic·M.Tech·Driver (→ `staff`), Office·Sales (→ `money`); Manager·Admin·Developer carry
their own tiers. Admin-defined roles inherit a tier through `settings.roleMeta`.

### 3.1 Who touches Customers

| Tier | Built-in roles | Customer access (proposed canon) |
|---|---|---|
| **Staff (1)** | Mechanic, M.Tech, Driver | **Operational contact only** — name, phone, address, industry for dispatch/delivery. **No** payment methods, **no** `_digest` spend, **no** `idNumber`, **no** net terms / pay-status dollar amounts. |
| **Money (2)** | Office, Sales | Full CRM: create/edit, funnels, cadence, **payment methods + take payment**, spend digest, net terms, PO. |
| **Manager (3)** | Manager | + override gates (blacklisted account, unsigned-card rental block via the existing `requireAdmin` card-override path). |
| **Admin (4)** | Admin (+ Owner bridge) | + Settings: account-type registry, agreement text, custom-field schema, KPI authoring. |
| **Developer (5)** | Developer | + everything; not a customer-facing distinction here. |

**Conservative default for ambiguous surfaces:** if a surface mixes operational and financial
data, **split it** so Staff get the operational half and the financial half is `canMoney()`-or-
higher gated — do **not** show the whole block to Staff "because it's convenient." Where the
split isn't yet built, the surface stays money-tier until Jac rules otherwise (§11 Q4/Q5).

### 3.2 Gates this area MUST honor (do not loosen silently)

1. **[2026-07-09: STILL PLANNED — this gap is NOT closed by the 2026-07-09 promotion; see
   "Shipped status" above.]** **Money gate (`canMoney()`).** The Payment Methods section's add/charge/default/remove
   actions, taking payment, and the spend `_digest` are money-tier. Today `cardTabBody` already
   wraps **only the `+Card` add button** in `canMoney()` (app.js:643) — note the **card *rows*
   themselves (brand, last4, "Make default", "Sign", remove ✕) render unconditionally** today.
   That means a Staff/no-role view currently *reads* last4 + sign-state and can *click* default/
   sign/remove. **This is a gate gap to close:** wrap the whole `paymentMethodsSection` body (and
   the ACH tab) in `canMoney()`, not just the add button. Track as §11 Q5 — do not loosen; tighten.

2. **Card-bound agreement gate.** Any active card lacking a valid signed agreement whose key
   matches `requiredAgreementKey(c)` for the **current account type** blocks On-Rent + delivery.
   The state machine is `cardSignState(c,k)` → `authorized | stale | unsigned` (app.js:295), built
   from `cardCurrentSigning(c,k)` (app.js:283, picks the latest signing whose `key` equals the
   required key) and `cardAuthorized` / `cardComplete` (selfie + signing, app.js:293). This gate
   is **owned here and read by `rentals-dispatch`** (which holds the only blessed override:
   `cardOverrideRental` → `requireAdmin`, backend-verified, logged — `rentals-dispatch.md:152`).
   Account-type change → matching key changes → existing signings become `stale` → re-sign
   required. **No CRM edit may weaken this**; the account-type pills *drive* `cardSignState` and
   must keep doing so. A CRM edit must never silently mark a card `authorized`.

3. **PII handling.** Customer records hold real names, phones, emails, addresses, driver's-
   license/ID numbers, and selfie + signature images. Per the repo's PII guard (CODE-MAP §442)
   and the public-Pages constraint: **no real PII in the repo, seeds, or this spec** (seed rows
   use obviously-fake/demo data; this spec names no real customer). Selfie/signature/agreement
   images **offload to Drive** via `uploadCapture` / `archiveAgreementMedia`; only a downscaled
   thumb (client `downscaleImage`, `frontend-performance`) may ride a cell, never the full image.
   `idNumber` (driver's-license) is **plaintext in the Sheets cell today** and rendered in the
   Account section to any money-tier viewer — **flag for review (§11 Q6):** mask in UI (`••••1234`),
   gate read to manager+, or drop if unused. It must **never** be exported to a public surface.

4. **Blacklisted.** `Blacklisted` is a red account type + customer flag (config.js:265). Setting
   it is a **rental-blocking** action, so it must be **manager+** and **audited** (`blacklistedAt`
   + an `activityLog` entry). It is not currently settable in the UI (§2.8) — wiring it is a gated
   action and a security-sensitive decision that stays on the main session (§11 Q3).

5. **No pricing-floor leak.** The customer card does **not** show `bottomDollar` / margin (those
   live on Categories, admin-gated — `units-fleet.md:110`). Keep it that way. The cadence engine
   and spend chart show **revenue** (`rentalAmt` / `_digest.totalPaid`), never cost or margin, so
   there is no floor to leak today — but any future "profitability per customer" idea would cross
   into margin territory and must be admin-gated, surfaced as an Open Question, not shipped inline.

6. **Customer-isolation.** Every derivation (the `_digest` recompute, the spend chart, cadence,
   any per-customer roll-up) must filter strictly by `customerId`. A wrong join leaks one
   customer's spend/cadence onto another's card — a confidentiality breach, not just a bug. This
   is the **highest-severity correctness gate in the area** (§10). The recompute walks
   `DATA.rentals`/`DATA.invoices` *pre-filtered* on `r.customerId === c.customerId` (mirroring
   `customerMonthly`, app.js:5294) — never an unfiltered reduce.

---

## 4. Data Model

### 4.1 Customer entity (`DATA.customers`, Sheets tab `customers`, `PERSIST_ID = customerId`)

Schema-less: new fields are **additive** — write the key, it round-trips. `migrateCustomers()`
(app.js:96) backfills `firstName/lastName`, folds a legacy single card into `cards[]`, and
repairs colliding card ids.

| Field | Type | Source | Notes |
|---|---|---|---|
| `customerId` | `C0001` str | `nextCustomerId()` | sequential, persist id |
| `firstName` / `lastName` / `name` | str | form / `fullName()` | `name` derived |
| `company`, `phone`, `email`, `address`, `industry` | str | click-to-edit | `phone` required at create |
| `accountType` | enum | pills | `customerAccountType` registry |
| `payStatus` | enum | derived/seed | `customerPayStatus` registry |
| `requiresPO` | bool | forced answer | drives invoice PO gate |
| `rentalProtection` | bool | forced answer | +protection% on rentals |
| `idNumber` | str | form | driver's-license/ID — **PII** |
| `netDays` | int | form | payment terms; `0 = COD`, capped at company max |
| `stripeId` | str | Stripe | customer object id |
| `cards[]` | obj[] | Stripe + signing | `{ id, stripePmId, brand, last4, expMonth, expYear, nickname, notes, isDefault, status, agreement }` |
| `achAccounts[]` | obj[] | Stripe | `{ id, bankName, last4, accountType, verified, isDefault, mandate }` |
| `usedSalesStage` / `membershipStage` | enum | funnels | `funnelStage` order |
| `interestedCategoryIds[]` | str[] | dropdown | category refs |
| `interestedMakes[]` *(missing from this table, SHIPPED 2026-07-09)* | str[] | Equipment Sales tab | Make-OR-Category interest, alongside `interestedCategoryIds[]` (app.js:3825–3830) |
| `desiredAge` / `desiredHours` *(missing from this table, SHIPPED 2026-07-09)* | str | Equipment Sales tab | buyer-criteria fields, click-to-edit (`custMetaField`, app.js:3808) |
| `salesAction` | str | sales | next-action hint |
| `activityLog[]` | obj[] | `logAction` | `{ when, text }`; `^Scheduled:` = a follow-up |
| `accountNotes` (+`accountNotesColor`) | str | notes | R12 |
| `custom{}` | obj | custom fields | admin-defined |
| `_digest{}` | obj | **derived (static today)** | see §4.2 |
| membership fields | mixed | memberships area | `paidUntil`, `paidCadence`, `unlimitedTransport`, `paidFees` |

### 4.2 `_digest` (the derived history block)

```js
_digest: { totalPaid, visits, years, avgFrequencyDays, activePct, firstInvoice, lastInvoice }
```

**Proposed derivation (the missing recompute):**

| Field | Formula |
|---|---|
| `totalPaid` | Σ `amountPaid` across this customer's invoices (paid + partial) |
| `visits` | count of distinct rentals (or invoiced events) |
| `years` | `(today − firstInvoice) / 365`, floored |
| `firstInvoice` / `lastInvoice` | min/max invoice `date` for the customer |
| `avgFrequencyDays` | mean gap between consecutive rental start dates (needs ≥2) |
| `activePct` | % of the active window the customer was renting, OR cadence-derived 0–100 |

### 4.3 Card sub-object — `agreement` (source of truth for the signing gate)

```js
agreement: { signedAt: 'ISO', version: 'rental'|'member'|…, signature: <dataURL/Drive>, selfie: <dataURL/Drive> }
```

### 4.4 Relationships (by ID)

- `rental.customerId → customer.customerId` (rentals, cadence, spend chart)
- `invoice.customerId → customer.customerId` (pay status, digest, PO)
- `customer.interestedCategoryIds[] → category.categoryId` (used-sales funnel)
- `customer.stripeId` → Stripe customer object (server-side)

### 4.5 Migration concerns

Additive only. Any new field (e.g. a `mergedInto` tombstone for de-dup, a `blacklistedAt`
audit stamp, a recomputed `_digest`) writes through `reindex('customers', c)` → diff-sync.
**No destructive rename** of `_digest` keys — KPIs and the chart read them by name.

---

## 5. Backend / Integration Contract

Single entry point `backendCall(action, extra)` (app.js:14811), team-password gated, diff-sync
persistence. Customers ride the generic `sync`/`load` path (no per-entity customer action).

### 5.1 Existing actions used by this area

All ride `backendCall(action, extra)` (app.js:14811), team-password gated. Every reply is
`{ ok: true, … }` on success or `{ ok: false, error }` on failure; **the client never coerces a
failure into success** (§5.3). Action names below are the *contracts this area depends on* — the
exact server signatures live in the gitignored `Code.gs` and are owned by `backend-data`; treat
these as the documented interface, not a claim about server internals.

| Action | Used for | Request (extra) → Response (relevant) |
|---|---|---|
| `sync` / `load` | persist/hydrate the `customers` tab (diff-based via `computeChanges`) | `sync`: `{ changes:{customers:{upsert[],delete[]}, … } }` → `{ ok, … }`. `load`: `{}` → `{ ok, data:{ customers:[…] } }` |
| `stripeSetupIntent` | begin add-card (off-session SetupIntent) | `{ customerId }` → `{ ok, clientSecret, stripeId }` |
| `stripeSaveCard` | confirm + persist the card | `{ customerId, stripePmId }` → `{ ok, card:{ id, brand, last4, expMonth, expYear } }` |
| `stripeSetDefault` | set default PM | `{ customerId, stripePmId }` → `{ ok }` |
| `stripeRemoveCard` | detach PM | `{ customerId, stripePmId }` → `{ ok }` |
| `stripeBankSetupIntent`, `stripeSaveBank`, `stripeVerifyBank` | ACH on file (micro-deposit verify) | `{ customerId, … }` → `{ ok, bank{} }` / `{ ok, verified }` |
| `stripePubKey` | fetch the publishable key (falls back to `CFG.STRIPE_PUBLISHABLE_KEY`) | `{}` → `{ ok, pubKey }` |
| `uploadCapture`, `archiveAgreementMedia` | offload selfie/signature/agreement media to Drive | `{ customerId, cardId, kind, dataUrl }` → `{ ok, fileId, url }` |

**Secrets:** the Stripe **secret key** and the team password live server-side only (named, never
valued here). The publishable key arrives via `stripePubKey`; only the publishable key may ever
reach the client. No DEFAULT_CONFIG password, secret, or key appears in this repo (public Pages).

### 5.2 Proposed additive action — `recomputeDigests` (the §2.6 gap)

The recompute can run **client-side** (cheap; the client already holds all rentals/invoices)
on each `load` and after any invoice/rental mutation — **preferred for v1**, no backend change.
If centralizing is wanted later, an additive GAS action:

```
action: 'recomputeDigests'
→ server walks invoices+rentals per customer, writes _digest back to the customers tab
← { ok:true, updated:N }
```

**Performance contract:** the client-side recompute runs **once per `load` in a single pass** —
bucket `DATA.rentals` and `DATA.invoices` by `customerId` first (a `Map`), then derive each
customer's `_digest` from its bucket. Never a per-customer unfiltered `filter`/`reduce` (that's
O(customers × records); see §10). Re-run after any invoice/rental mutation that could move a
customer's numbers, then `reindex('customers', c)` so the diff-sync persists the new digest.

**Open Question (§11 Q1):** client-side recompute (no backend, instant, but every device
recomputes) vs. server-side action (one source, but a round-trip + GAS deploy). Conservative
default: **client-side on load**, mirroring how other derived values already work, with the
single-pass bucketing above.

### 5.3 Failure handling

| Failure | Behavior |
|---|---|
| Stripe SetupIntent/charge declines | Toast the human message; **no `cards[]` mutation**; record never partially commits. The card row only appears after `stripeSaveCard` returns `{ ok, card }`. |
| Drive `uploadCapture` fails | Keep the in-memory downscaled thumb; retry on next save; **never** drop the signing/selfie record just because the upload bounced (the agreement is the gate, the image is evidence). |
| `sync` rejected (bad password / offline) | Client keeps editing in-memory `DATA`; `saveSoon` (1200 ms debounce, `frontend-performance`) re-attempts; multi-user reconciles on next `load`. |
| `recomputeDigests` (if server-side) fails | **Leave the existing `_digest` intact — never zero it.** A stale-but-real digest beats a blanked one (which would flip every customer to "New" and wipe the KPIs). |
| Account-type flip leaves cards `stale` | Surface the `stale` "Re-sign" badge (already shipped, app.js:628); do **not** auto-block silently and do **not** auto-clear the old signing. |

The Stripe **publishable** key is fetched live (`stripePubKey`, app.js:14156) with a graceful
`CFG.STRIPE_PUBLISHABLE_KEY` fallback when offline; `getStripe()` (app.js:14158) toasts rather
than throwing if the library/key isn't ready. No money action proceeds without a confirmed
SetupIntent/PaymentIntent.

---

## 6. UX / UI — yard data-plate language

All new/changed UI runs through `jactec-ui`. Foundation stays the dark steel yard; ranch twist
is mostly voice + the existing tan dashed cadence series.

### 6.1 The customer detail card (canon, light forward edits)

Steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), corner **rivets**, Saira Condensed
stamped section headers (`Account`, `Used Sales`, `Payment Methods`). Safety-orange
(`#ff7a1a`) reserved for the spend area-fill gradient + ignition primary buttons only — never a
status color. Status/flags use R/Y/G per the flag-color system.

### 6.2 Cadence stage chip + chart (canon)

`.ca-stage c-<color>` chip + the spend/days chart. Keep the leather-tan dashed "Days rented"
series — it's the area's signature ranch touch. Voice: "Round up" / "due to rent again" /
"slipping" in copy, never campy.

### 6.2a Payment Methods — gate-visibility fix (NEW behavior on an existing block)

> **[2026-07-09: STILL PLANNED — not part of the 2026-07-09 promotion.]** `cardTabBody` /
> `achTabBody` (app.js:643–676) still render rows unconditionally; only the add buttons are
> gated. This section's proposal is unbuilt.

Today only `+Card` is `canMoney()`-wrapped (app.js:643); the card/ACH **rows** render to any
viewer. Reshape `paymentMethodsSection` so that under **sub-money tier the whole block collapses**
to a single stamped line — Saira Condensed, muted: `PAYMENT METHODS · MONEY-TIER` (or simply hide
the section header's count + body). Money-tier and above see the full Cards/ACH tabs unchanged.

- This is a *reshaped* existing block → run through `jactec-ui`; keep the steel panel + rivets.
- **R-rulebook:** the collapsed-state line needs a `data-r` stamp (reuse the gated-section rule if
  one exists, else add `Rxx`); regenerate `rule-usage.js` (`ci/gen-rule-usage.mjs`, drop `--check`).
- No new popup, so **no `WINDOW_CATALOG` change** for this item.

### 6.3 Proposed: Blacklist + account-state action (NEW, gated)

> **[2026-07-09: BUILT — but DIFFERENTLY than this section describes; see "Shipped status"
> above.]** A blacklist action shipped (app.js:15489–15490, 7342–7344) as a direct pill with a
> double-click-to-arm confirm, matching the top-of-doc **D3 decision** (any signed-in user, no
> manager+ gate, no hazard-stripe popup) — not the manager+-gated red hazard-stripe confirm
> popup this section still describes below (that prose predates D3 and was never reconciled).
> `Blacklisted` remains absent from `NC_ACCOUNT_TYPES` (app.js:17641), so the account-type-pill
> half of this proposal is still unbuilt.

Add `Blacklisted` to the account-type pills (it already exists in `customerAccountType`
config.js:113 but is absent from `NC_ACCOUNT_TYPES` app.js:14040). Setting it fires a **manager+
confirm** — mirror the shipped `requireAdmin` backend-verified path (app.js:10081) with a tier-
checked variant (`requireManager`, §11 Q3). The confirm popup uses the **red hazard-stripe
variant** (`repeating-linear-gradient(135deg, var(--red,#ff4242) 0 13px, #14181d 13px 26px)`),
an explicit "This blocks new rentals for this account" line, and an ignition-style abort/confirm
pair. On confirm: set `accountType='Blacklisted'`, stamp `blacklistedAt` (ISO) + a
`'Blacklisted by <role>'` `activityLog` entry, `reindex('customers', c)`.

- **Soft gate:** blacklisting blocks **new** rentals only; it must **not** retro-cancel live
  rentals (§10). The rental block is read by `rentals-dispatch` via the customer flag.
- **R-rulebook:** the new pill + confirm get `data-r` stamps; regenerate `rule-usage.js`.
- **Is the confirm a catalogued popup?** If it routes through `openOverlay`/`buildPopupEl` it
  **needs a `WINDOW_CATALOG` entry** (e.g. `{ kind:'blacklistConfirm', label:'Blacklist account',
  tag:'Customer · blacklist', sample: … }`) or `ci/check-window-catalog.mjs` fails. A pure inline
  `confirm()`-style guard with no popup kind does not — decide which during build (§11 Q3).

### 6.4 Proposed: Customer merge (NEW popup)

A "Merge duplicate" flow (manager+): pick a survivor + a duplicate, re-point that duplicate's
rentals/invoices to the survivor by ID, tombstone the duplicate (`mergedInto`). Steel popup,
hazard-stripe header, explicit "this can't be undone" line.

- **New popup → REQUIRES a `WINDOW_CATALOG` entry** (`ci/check-window-catalog.mjs` gate). e.g.
  `{ kind:'mergeCustomer', label:'Merge duplicate customer', tag:'Customer · merge', sample: … }`.
- **R-rulebook:** every new element gets a `data-r` stamp; regenerate `rule-usage.js`
  (`ci/gen-rule-usage.mjs`, drop `--check`).

### 6.5 States

- **Empty** — new customer, zeroed `_digest`: cadence reads "No rental cadence yet — needs a
  few rentals to read the pattern" (already shipped, app.js:5344). Funnels at `N/A`.
- **Loading** — card renders from in-memory `DATA`; no per-card spinner (SPA hydration).
- **Error** — failed Stripe action toasts; the customer record never partially commits.

### 6.6 Mobile reflow

Account `split` and `detail-cols` collapse to single column at the M-breakpoints
(`mobile-remote`). Payment-method rows wrap; popup → bottom-sheet. Touch targets respect the
floor. No new gestures proposed.

### 6.7 Existing WINDOW_CATALOG entries owned here (must stay current)

`newCustomer`, `agreement`, `schedule`, `addCard`, `addAch`, `verifyAch` (app.js:9815–9824).
Any new popup (§6.4) adds a row; removing one fails CI.

---

## 7. Business Rules / Derivations / Money

### 7.1 `_digest` recompute (the headline rule — see §4.2)

Must walk only this customer's `DATA.invoices` (`amountPaid`, `date`) and `DATA.rentals`
(`startDate`) — no cross-customer leakage. `totalPaid` counts real money in
(`amountPaid`), not invoiced totals, so it agrees with the Office Collection KPI.

### 7.2 Cadence math (canon — §2.3)

`expDate = lastInvoice + avgFrequencyDays`; `pastPct = 100*(since − f)/f`. Edge cases:
- `f ≤ 0` or no `lastInvoice` → **New** (gray), no expected date.
- Single rental → no frequency → New until a second rental exists.
- Future-dated last invoice (data error) → `since` clamped to ≥0.

### 7.3 Pay status (canon)

> **[2026-07-09: still open / STILL PLANNED — §11 Q2 unresolved.]** `payStatus` remains a
> stored/seeded field; no derive-from-open-invoices pass exists.

`customerPayStatus`: Current(green) / Unpaid(red) / Partial(yellow) / New Customer(blue).
Drives the customer flag (`unpaid-balance`, `partial-balance`) and the rental `unpaid-balance`
flag. **Open Question (§11 Q2):** is `payStatus` a stored field or should it be *derived* from
open invoices like `_digest`? Today it's stored/seeded; deriving it would kill drift.

### 7.4 Card flags (canon)

`cardFlag(c)` (app.js:270) → no-card / unsigned / expiring / expired. Feeds the Payment Methods
header chip and the customer-level `no-card` / `card-expiring` flags (30-day threshold,
flag-color-system §7.5).

### 7.5 Net terms

`netDays` (0 = COD) capped at `companyMaxNetDays()`. Sets invoice due dates downstream
(invoicing-payments). PO requirement (`requiresPO`) forces a PO before invoicing (the white
`.req` "PO #" chip shows only when `cust.requiresPO && !inv.po`). `rentalProtection` mirrors
`requiresPO` exactly (membership-design.md:60) and adds protection % to rentals. Both are
**forced Yes/No answers** at create (`saveNewCustomer`, app.js:14094) — there is no "unset"
that silently defaults to a money-favorable answer.

### 7.6 `idNumber` (driver's-license / ID) — PII rule

Stored plaintext today; rendered in the Account section. Until §11 Q6 is resolved, treat it as
**display-restricted**: do not add it to any export, search blob, KPI, or Wrangler-readable tool
output, and prefer a masked render (`••••` + last 4). It is collected for delivery/agreement
identity verification only; it is not a money field and never gates pricing.

---

## 8. Phasing & Milestones

### Phase 1 — MVP (close the canon gaps)

1. **Live `_digest` recompute** (§4.2, §5.2) — client-side on load + after invoice/rental
   mutation. *Biggest value; unblocks accurate cadence + KPIs.* **[2026-07-09: STILL PLANNED.]**
2. **Wire `Blacklisted`** into account-type with a manager+ gate (§6.3). **[2026-07-09: BUILT
   DIFFERENTLY — a no-tier-gate direct action shipped per the D3 decision, not this manager+
   pill/popup; the account-type-pill half is still unbuilt — see "Shipped status" above.]**
3. **`payStatus` audit** — decide stored vs derived (§7.3) and make it consistent. **[2026-07-09:
   STILL an open question — still stored, not derived.]**

**In scope v1:** recompute, blacklist wiring, the gate decisions.
**Out of scope v1:** customer merge, PII export/delete, contact-outcome on follow-ups,
server-side digest action.

### Phase 2 — relationship tooling

- Customer **merge / de-dup** popup (§6.4).
- Scheduled follow-up **outcomes** (Reached / No answer / Booked) logged structurally.
- Per-customer aged-receivables roll-up surfaced on the card (read from Invoices).

### Phase 3 — growth

- Outreach lists from cadence stage (feeds `comms-notifications` / `marketing`).
- Reputation/review request hook (needs the email backend — `comms-notifications`).

---

## 9. Acceptance Criteria

| # | Criterion | Testable check | CI gate |
|---|---|---|---|
| A1 | `_digest` recompute matches a hand-computed fixture | `ci/logic-test.mjs` fixture: customer with N invoices → expected `totalPaid`/`firstInvoice`/`lastInvoice`/`avgFrequencyDays` | `logic-test` |
| A2 | Cadence stage buckets at the exact thresholds (boundaries 0 / 25 / 50 / 100 %) | unit-style assertions on `customerActivity` at `pastPct` = −1, 0, 25, 26, 50, 51, 100, 101 | `logic-test` |
| A3 | **Customer-isolation:** a 2-customer fixture (each with rentals/invoices) → each `_digest` reflects ONLY its own records; swapping `customerId` changes the result | `logic-test` join-filter assertion | `logic-test` |
| A4 | Sub-money tier sees **no** payment-method rows, no `_digest` dollars, no `idNumber` | render under a `staff` role fixture → assert those nodes absent; render under `money` → present | manual on `:9147` (Mechanic vs Office) + (ideally) a role fixture in `logic-test` (none today — coverage gap, §11 Q11) |
| A5 | Unsigned/`stale` card still blocks On-Rent after any CRM edit | edit account-type → assert `cardSignState` flips to `stale`, gate intact; only `cardOverrideRental`+`requireAdmin` unblocks | manual |
| A6 | New popup (merge / blacklist confirm) has a `WINDOW_CATALOG` row | catalog check passes; removing a row fails CI | `check-window-catalog` |
| A7 | New UI elements carry `data-r`; usage regenerated; no duplicate rule | no drift | `gen-rule-usage --check` |
| A8 | No chapter-banner drift if a chapter is added/moved/retitled | code map current | `gen-code-map --check` |
| A9 | App boots + renders Customers card; empty-digest "No rental cadence yet" copy renders | smoke passes on `:9147` | `smoke` |
| A10 | Failed `recomputeDigests` leaves prior `_digest` intact (not zeroed) | inject a recompute error → assert digest unchanged | `logic-test` |

Run gates per CLAUDE.md (swap `8000→9147`, run, `git checkout -- ci/`).

---

## 10. Risks & Edge Cases

- **Digest drift / double-count.** Recompute must use `amountPaid` not totals, and dedupe
  invoices shared across rentals (`rentalIds[]`).
- **Customer-isolation leak.** Any recompute or KPI must filter by `customerId` only — a wrong
  join leaks one customer's spend onto another. Highest-severity correctness risk.
- **PII exposure.** `idNumber` plaintext; selfie/signature must stay Drive-offloaded, never in
  the public repo/seed. A merge that copies media must re-point Drive refs, not duplicate PII.
- **Account-type flip un-signs cards.** Correct behavior (re-sign required) but surprising —
  must surface the `stale` banner, not silently block.
- **Multi-user race.** Two devices editing the same customer → diff-sync last-writer-wins on a
  field; acceptable for contact fields, risky for `cards[]` (use the stable card `id`).
- **Blacklist as a soft gate.** Blacklisting must not retro-cancel live rentals; it blocks new
  ones only.
- **Offline.** Recompute runs on in-memory `DATA`; works offline, re-syncs on reconnect. Because
  it's client-side, two devices that both recompute then `sync` converge to the same value (the
  inputs are the same rentals/invoices), so digest recompute is **not** a multi-user race — but a
  device that recomputes against a *stale* local `DATA` could briefly write an old digest; the
  next `load`+recompute self-heals.
- **Gate gap (shipped):** payment-method rows + `idNumber` currently render below money-tier
  (§3.2.1, §6.2a). Until the wrap lands, a Staff/no-role session **can read last4 and click
  default/sign/remove**. Highest-priority security fix in the area.
- **Demo unlock.** `canMoney()` is open in the `#local`/no-role demo (app.js:14166). A
  screenshot or screen-share of the demo therefore exposes every money/PII surface — new PII
  (e.g. `idNumber`) should mask even in demo (§11 Q12), and the demo must keep using fake seed
  data only.
- **Account-type → blacklist confusion.** `Blacklisted` is both an account *type* and a flag;
  setting it via the type pill must not be confused with the membership account types
  (`Member Incomplete`, §11 Q10) — double-write between CRM and Memberships is a data-integrity
  risk.
- **Digest recompute performance.** Walking `DATA.rentals`+`DATA.invoices` per customer on every
  `load` is O(customers × records). For the current single-yard dataset this is trivial, but the
  recompute should run **once per load over all customers in a single pass** (bucket records by
  `customerId` first), not an N² nested filter, to stay inside the 100 ms render budget
  (`frontend-performance`).

---

## 11. Open Questions

> **Resolved 2026-06-29:** Q4/Q5/Q5b → D1 (full card visible; gate only money *actions*) · Q6 → D2 (idNumber stays plaintext, internal-only) · Q3 → D3 (anyone can blacklist + audit; no UI exists yet) · Q7 → D4 (merge = Phase 2). Adopted: Q1 client-side recompute, Q2 derived payStatus. Q11 reduced to a click-gate check; Q12 dropped (open-visibility posture). See the Decisions block up top.

| # | Question | Trade-off / options |
|---|---|---|
| **Q1** | **Where does `_digest` recompute live?** | *Client-side on load* (no backend, instant, every device recomputes — preferred) vs *server-side `recomputeDigests` action* (one source of truth, but a round-trip + GAS deploy). |
| **Q2** | **Is `payStatus` stored or derived?** | Stored (today; can drift from invoices) vs derived from open invoices (no drift, but a render-time cost + couples CRM to Invoices). |
| **Q3** | **Blacklist gate tier?** | Manager+ (blocks rentals → manager-level) vs Admin-only (safer, fewer hands) vs Money (more convenient, riskier). Default proposed: **manager+** with an audit log entry. |
| **Q4** | **Should Staff see contact fields at all?** | Drivers need phone/address to deliver. Show *operational* contact only (phone/address) but hide digest/payment? Or hide the whole card from Staff? |
| **Q5** | **Payment-method block — gate the whole section or just `+Card`?** | Today only `+Card` is `canMoney()`-wrapped (app.js:643); card/ACH *rows* (last4, default, sign, remove) render to any viewer, and the `#local` demo shows everything. Gate the **whole `paymentMethodsSection` + ACH tab** to money-tier (conservative, closes the read+click gap — **proposed**) vs leave rows visible (status-only) and gate only the *actions* (more info for Staff, but exposes last4). Default: **gate the whole block.** |
| **Q5b** | **Spend digest visibility floor.** | Money-tier only (conservative) vs visible to all (handy for Drivers gauging a "big" account). Default: **money-tier** — Staff get operational contact, not dollars. |
| **Q6** | **`idNumber` (driver's-license) handling.** | Plaintext field today. Mask in UI? Treat as PII-restricted (manager+ to view)? Drop it entirely if unused? |
| **Q7** | **Customer merge — Phase 1 or 2?** | Duplicates are a real CRM pain, but merge is destructive + multi-entity. Defer to Phase 2 (proposed) vs pull forward. |
| **Q8** | **Cadence "Lost" auto-action.** | Should reaching **Lost** auto-create a scheduled win-back follow-up, or stay passive (just the red chip)? Ties into `comms-notifications`. |
| **Q9** | **Scheduled-follow-up outcomes.** | Keep free-text (today) vs add structured outcomes (Reached / Booked / No answer) for funnel reporting. |
| **Q10** | **`Member Incomplete` ownership.** | This account type spans CRM + Memberships. Does CRM render/set it, or is it fully owned by `memberships`? Avoid double-write. |
| **Q11** | **Role-gate CI coverage.** | There is **no role fixture in `logic-test` today** (`units-fleet.md:356` flags the same gap), so A4 (Staff sees no money/PII surface) is **manual-only** — a regression that exposes payment rows or `idNumber` to Staff would ship un-caught. Add a minimal render-under-role fixture to `logic-test` (best, but new test infra) vs accept manual verification (cheaper, riskier on a PII/money gate). Given this gate guards PII + last4, **proposed: add the fixture.** |
| **Q12** | **Demo (`#local`) money-surface exposure.** | `canMoney()` returns `true` for the no-role demo by design (design review). Is that acceptable for any *new* PII surface (e.g. unmasked `idNumber`), or should new PII be hidden even in demo so a screenshot/recording can't leak a real cell? Proposed: **new PII surfaces honor masking even in demo.** |

---

## 12. Dependencies & Sequencing

| Depends on | Why |
|---|---|
| `invoicing-payments` | `_digest.totalPaid`, pay status, PO, net terms; Stripe charging |
| `memberships` | `membershipStage`, member account types, protection/transport entitlements |
| `rentals-dispatch` | reads the card-bound agreement gate + cadence; rentals feed the digest |
| `backend-data` | the `sync`/`load` contract + any additive `recomputeDigests` action |
| `design-system` | flag-color system, R-rulebook stamps, WINDOW_CATALOG gate |
| `wrangler-ai` | Mr. Wrangler create/edit customer action parity |

**Must land first for Phase 1:** the `_digest` derivation decision (§11 Q1) blocks A1/A2 and
the KPIs. The Blacklist + `payStatus` gate decisions (Q2/Q3) should be settled on `main`
(security-sensitive) before delegating the mechanical UI wiring.

**Sequencing note:** keep the agreement-gate and account-type logic on the main session
(touches the rental-blocking gate). The `_digest` recompute and the spend-chart wiring are
well-scoped enough to delegate against this spec once Q1 is answered.
