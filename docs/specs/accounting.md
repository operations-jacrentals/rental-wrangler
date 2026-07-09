# Accounting — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/accounting`
**Task branch:** `accounting/spec` (proposed)
**Maturity:** partial
**Scope:** Everything *above* the invoicing/payments layer — the cost/expense ledger, vendor spend, and the derived money picture (P&L, margins, tax/category reporting, chart of accounts, and any future QuickBooks/Xero export) that turns the yard's revenue and costs into a number Jac can act on.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions and amend §3 / §6 / §7 / §8.

- **D1 · Cost / spend / aggregate P&L are open to all signed-in users (resolves Q1/G1, Q16).** **Drop** the proposed money-tier gate on the Expenses board, `vendorTotals`, part `priceEach`, and the aggregate P&L/tax surfaces — staff see cost, vendor spend, and the P&L, consistent with the `customers-crm` open-visibility posture. Field cost-capture is simplified: staff both **log and read** cost (no special least-privilege verb). *(Exception → D3.)*
- **D2 · Accounting basis = accrual, tax-excluded net (resolves Q3/Q5).** Revenue books on the **invoice date**; **Net = Σ `invoice.subtotal` − Σ `expense.amount`**, with sales tax treated as a **pass-through liability** (not revenue). This is the server-canonical `acctPnl` formula so the app and any export always agree. (Basis may become a Setting later if the CPA wants cash; accrual+tax-excluded is the locked v1.)
- **D3 · Per-unit / per-category profitability — build it, Phase 3, money-gated (resolves Q6/G3).** Show **realized margin** (revenue − attributed cost) per unit/category to **money-tier+**, never the `bottomDollar` floor itself — reuses the `units-fleet` margin gate. This is the one cost surface that stays gated (margin-floor-adjacent / competitive), even though aggregate cost is open (D1).
- **D4 · Export — CSV/IIF first (Phase 2), QuickBooks OAuth later (Phase 3) (resolves Q9/G5).** CSV is the zero-integration interim; QuickBooks Online OAuth (server-held token, named-only) follows once Q13 is solid.
- **D5 · Uncollectables route to a Collections feature, not a passive write-off (Jac, 2026-06-29).** Instead of a terminal "bad-debt Write-off," an uncollectable invoice is **sent to "Collections"** — a planned in-app feature that **integrates a 3rd-party collections service**. Collections is its **own roadmap area** (see `AREAS-ROADMAP.md`); accounting still nets a sent-to-collections invoice out of revenue (as a recoverable receivable, not booked income), and reconciles any recovered amount back when the 3rd party remits. The exact accounting treatment (when it leaves revenue, how a partial recovery books) is specced in the Collections area + revisited here.

**⚠️ Cross-cutting / deferred — Q13 (server role trust).** Does the GAS backend receive a **verifiable role**, or only the shared `backendPassword`? If only the password, tier-gating money actions server-side is theatre. **Deferred to the `backend-data` spec (#7); it BLOCKS all Phase-2 money-mutating/outbound actions** (`expenseDelete`, `acctPeriodClose`, `acctExport`). Phase 1 (read-only client P&L) ships regardless.

**Defaults adopted:** Q2 → P&L surfaces **both** as a back-office popup *and* a Financials/KPI tile (coordinate with `financials-kpi`) · Q8 → reconciliation gains a **bank-feed CSV reconcile-assist** (Phase 3, per the "Reconciliation" ask) · Q10 → ship P&L "live" first, add period-close in P3 · Q7 → map the 7 categories 1:1 to GL codes for clean QB export (fuller CoA later) · Q11 → capture optional `expense.taxPaid` for LA use-tax (P2) · Q14 → P&L drill-down reuses the existing gated Invoices board · Q15 → leave `vendorTotals` whole-dollar for P1, re-round to cents in P2 · Q4 → receipt create/edit/delete stays money-tier, closed-period edits refuse server-side · Q12 → ranch-twist copy stays light on money screens (CPA-readable).

---

## 1. Goal & Problem

**What this area is for.** Invoicing/Payments owns the *money in* (what customers owe and pay). Accounting owns the *money out and the net*: what JacRentals spent (parts, fuel, towing, supplies, shop service), to whom (vendors), against what (a work order, a unit, a category), and whether each dollar has been *reconciled* against the bank. On top of that ledger it derives the picture every owner asks for — **revenue minus cost equals profit**, broken down by period, by category, and eventually by machine — and is the boundary where that picture can be *exported* into a real accounting system instead of living only in Sheets.

**The business problem.** Jac runs a heavy-equipment yard in Sulphur, LA out of a phone and a desk. Today he can see what he *invoiced*, and he can log a *receipt* and link its parts, but he cannot answer "did the yard make money in May?" without leaving the app, because expenses and invoices have never been added up *against each other*. Reconciliation is a manual three-state toggle with no bank feed. Tax is collected per-invoice (10.75% LA) but never *reported*. Every cost is keyed to a free-text category that doesn't map to any chart of accounts, so the data can't leave the app cleanly. The result: a profitable-looking revenue line with an invisible cost line underneath it.

**Why it matters / north star.** *Accounting must never invent revenue or cost — it only sums what Invoicing and the expense ledger already recorded, and it must be visible only to roles allowed to see money.* The north star: **a one-glance P&L that any money-tier user trusts because every number on it links back to the exact invoice or receipt it came from, and a clean export that hands a CPA/QuickBooks the same numbers with zero re-keying.** Accounting is a *reporting and reconciliation* layer, not a second source of money truth — the invoice and the receipt stay canonical.

---

## 2. Current State (Baseline)

Anchors: expenses seed `data.js:184`, `IDX.expense` build `app.js:691`, expense detail renderer `app.js:5993`, `vendorTotals` `app.js:11138`, board table defs `BOARD_DEF`/`boardTable` `app.js:11150`, expense category/method/reconcile status maps `config.js:150`, back-office board registry `BACKOFFICE_BOARDS` `config.js:371`, receipt popup `receiptform` `app.js:9197`/handler `app.js:13525`, money gate `canMoney` `app.js:14166`, `invoiceTotals` `app.js:1602` (revenue side, owned by invoicing-payments).

### 2.1 Shipped (live, canon)

| Capability | Where | Notes |
|---|---|---|
| **Expense / receipt records** | `expenses` seed `data.js:184` | Fields: `expenseId`, `vendorId`, `date`, `amount`, `reconcile`, `method`, `category`, `woId`, `notes`, optional `photo`, optional `aiPending`. Schema-less — added freely. |
| **Expenses & Receipts board** | `BACKOFFICE_BOARDS` `config.js:374`, `BOARD_DEF.expenses` `app.js:11163` | Spreadsheet-style popup: cols Vendor · Date · Amount · Reconcile · Method · Category · WO. Search-filtered, row opens detail. |
| **Expense detail + receipt reconcile** | `recOf.expenses` `app.js:5993` | Thumbnail, inline-edit amount, reconcile gate pill, vendor link, method/category badges, WO ref pill, notes, history. |
| **Parts↔receipt reconciliation** | `receiptParts`/`receiptLineTotal` `app.js:11146` | Parts link a receipt via `part.receiptId` (+`receiptQty`); **Unaccounted = amount − Σ qty×priceEach**, green at $0 (the bank-match line). |
| **Receipt form popup** | `receiptform` `app.js:9197` / handler `app.js:13525` | New/Edit a receipt: vendor, amount, method, category, photo capture/replace. In `WINDOW_CATALOG` `app.js:9802`. |
| **Vendor spend rollup** | `vendorTotals` `app.js:11138` | Per vendor: `totalSpent` (Σ expense.amount), `partsCount`, `avgCost`. Shown on the Vendors board. |
| **Reconcile gate (3-state)** | `expenseReconcile` `config.js:150`, `js-reconcile` dropdown | `Unreconciled` (yellow) → `Pending` (blue) → `Reconciled` (green). |
| **Category taxonomy** | `expenseCategory` `config.js:155` | Parts · Fuel · Tools · Service · Shipping · Supplies · Other (display-color only, no GL mapping). |
| **Payment-method taxonomy** | `paymentMethod` `config.js:168` | Visa · Amex · Cash · Check · ACH (badge only). |
| **Vendor tax-exempt flag** | `vendor.salesTaxExempt` `data.js:153` | Drives a "Tax-Exempt" badge on the Vendors board; **not** yet used in any tax report. |
| **Global searchability** | `reindex('expenses'…)` `app.js:707` | Receipts/vendors/parts are in the global search blob. |
| **Money gate** | `canMoney()` `app.js:14166` | `!currentRole || roleTier(currentRole) >= tierRank('money')` — the same gate invoicing uses. *(See §3 — boards are not yet gated by it.)* |

### 2.2 Partial

| Capability | State | Where / Note |
|---|---|---|
| **Reconciliation** | Manual 3-state toggle only | No bank feed, no statement import, no auto-match. "Reconciled" means a human tapped the pill. |
| **Cost↔WO linkage** | Free-text `woId` field | A receipt *can* carry `woId` and a part *can* carry `receiptId`, but nothing rolls cost up *to* a unit/category or *into* the WO billable formula. |
| **Vendor spend** | Total only | `vendorTotals` sums all-time `amount`; no period filter, no per-category split, no trend. |

### 2.3 Missing (not built — this spec proposes it)

- **No P&L / income statement** anywhere. Revenue (`invoiceTotals`) and cost (`expenses`) have never been summed against each other.
- **No period reporting.** No month/quarter/YTD rollups for revenue, cost, or tax.
- **No tax report.** 10.75% LA tax is *collected* per invoice (invoicing-payments) but never *aggregated* for a filing; `salesTaxExempt` is decorative here.
- **No chart of accounts / GL codes.** Categories are display labels, not account codes.
- **No accounting-system export** (QuickBooks / Xero / CSV / IIF). Data cannot leave Sheets cleanly.
- **No budget / target** against expense categories.
- **No per-unit or per-category profitability** ("does the mini-ex actually earn?").
- **No expense approval workflow** (any money-tier user can edit any receipt; no second-set-of-eyes gate).

---

## 3. Users, Roles & Data Gates

Roles are **customizable** (add/remove/rename in Settings → Roles & Logins), so permissions key off **tiers**, never role names (`ROLE_TIERS` `config.js:326`, `tierRank` `config.js:334`). The five shipped roles map to tiers via `BUILTIN_ROLE_TIERS` `config.js:340`. The relevant ladder is a strict superset: `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`.

| Tier (rank) | Shipped roles | Accounting visibility (proposed) |
|---|---|---|
| **staff (1)** | Mechanic, M.Tech, Driver | **No accounting.** Can *log* a receipt photo against a WO they own (cost capture in the field), but cannot see amounts rolled up, the P&L, vendor spend, or tax. |
| **money (2)** | Office, Sales | Full expense ledger, vendor spend, reconcile, P&L, tax report, export. This is the floor for "see money out / net." |
| **manager (3)** | Manager | + expense **approval**, budget overrides, reopen a reconciled period. |
| **admin (4)** | Admin (legacy Owner bridges to admin) | + edit the chart of accounts / category→GL map, configure the export connection, close a period. |
| **developer (5)** | Developer | + dev tools; no extra accounting power. |

### 3.1 Gate decisions (conservative — surfaced as Open Questions, see §11)

- **G1 — Board gating.** The Expenses, Vendors, and Parts-cost columns currently render for *any* role (the back-office boards aren't behind `canMoney()`). Verified in code: `BACKOFFICE_BOARDS` (`config.js:371`) lists `parts`/`vendors`/`expenses` with **no tier guard**, and `BOARD_DEF.vendors`/`.parts`/`.expenses` (`app.js:11159`–`11166`) emit `money(t.totalSpent)`, `money(t.avgCost)`, `p.priceEach`, and `money(e.amount)` unconditionally. Because they expose **dollar amounts and vendor spend**, this spec proposes the **Expenses board, vendor `totalSpent`/`avgCost`, part `priceEach`, and the entire P&L/tax/export surface gate behind `canMoney()` (money-tier+)**. Staff would see vendor *names/contacts* and part *names/qty* (operational), never *cost*. **This is a tightening of current behavior — Q1.**
  - **Enforcement point (conservative):** gate at the **data/render source**, not per-popup. Concretely: (a) drop `expenses` from `BACKOFFICE_BOARDS` (or filter it) when `!canMoney()`; (b) in `BOARD_DEF.vendors.row` / `.parts.row`, substitute a masked `'—'` (or omit the column) for the cost cells when `!canMoney()`; (c) the field-level capture path that *logs* a receipt photo against a WO (staff cost-capture) must still write `amount` to the record but never echo a rolled-up total back to a staff view. A single helper (e.g. `acctVisible() === canMoney()`) is referenced everywhere money renders so the gate can't drift between call-sites — AC3 asserts it. **Do not** rely on hiding a column in CSS; the amount must not reach the DOM for a staff session (it's inspectable + the repo is public via Pages).
- **G2 — Customer isolation / PII.** Accounting deals with *vendor* spend and *internal* cost, not customer PII — but the P&L's revenue line is built from `invoiceTotals` across **all customers**. The P&L must never break customer isolation by surfacing a single customer's revenue to a role that couldn't already see that invoice. Revenue rollups are **aggregate-only**; drill-down into a customer's invoices stays behind the existing invoice gate.
- **G3 — Margin / pricing-floor visibility.** Per-unit profitability (a Phase 3 idea) divides revenue by cost per machine and is one step from exposing `bottomDollar`/margin floors. Any margin-bearing derivation inherits the existing pricing-floor visibility rule (money-tier+) and must not render the floor itself, only the realized margin. **Q6.**
- **G4 — Receipt write authority.** Today any money-tier user can create/edit/delete a receipt. Proposed: keep **create/edit at money-tier**, but route **delete and "mark Reconciled on a closed period"** to **manager-tier** (irreversible-ish money edits). **Q4.**
- **G5 — Export authority.** Pushing data to QuickBooks/CSV is an outbound money action; proposed **admin-tier** to *configure* the connection, **money-tier** to *run* an export of an already-closed period. **Q9.**
- **G6 — Server is the gate of record, not the client.** `canMoney()` is a **UI convenience gate only** — it hides amounts in the SPA but cannot stop a crafted `backendCall`. Every money/export/period action in §5 therefore **re-checks role server-side** against the same tier ladder (the server already holds `backendPassword`; the role/tier the client claims is re-validated, never trusted blind). A client that lies about its tier still cannot read a P&L, delete a receipt, or run an export. This mirrors the existing payment-action gating in invoicing-payments. **Surface the exact server re-check mechanism as Q13** (does the GAS layer today receive a verifiable role, or only the shared password? If only the password, money-tier vs admin-tier server gates collapse to "anyone with the password" — a real hole to close, see Q13).
- **G7 — Aggregate-only revenue leak guard.** The P&L revenue line sums `invoiceTotals` across **all** customers (G2). The danger is a "drill-down" link (§6.1) that, when followed by a role allowed to see the P&L *aggregate* but not an *individual* customer, exposes a per-customer invoice. Conservative rule: the drill-down target is the **existing** Invoices board/filter, which already enforces its own gate — accounting **never** ships a new, ungated per-customer revenue view. If a money-tier role can already see every invoice (today's model), this is moot; if customer-isolation ever narrows (customers-crm), the P&L drill-down inherits that narrowing automatically because it reuses the gated board. **Q14.**

No secrets, GL credentials, OAuth tokens, or DEFAULT_CONFIG values live in the repo — any QuickBooks/Xero OAuth token is held server-side (GAS Script Properties) and referred to **by name only** (see §5).

---

## 4. Data Model

### 4.1 Existing entities

**`expense`** (a.k.a. receipt) — lives in `DATA.expenses` (`data.js:184`), one Sheets tab `Expenses`. Schema-less map records (`m({…})`).

| Field | Type | Today | Notes |
|---|---|---|---|
| `expenseId` | `E0NN` str | ✅ | PK. |
| `vendorId` | `V0NN` ref | ✅ | → `vendors`. |
| `date` | ISO `YYYY-MM-DD` | ✅ | Expense date (drives period rollups). |
| `amount` | number (dollars) | ✅ | Gross paid. Exact cents. |
| `reconcile` | enum | ✅ | `Unreconciled`/`Pending`/`Reconciled` (`config.js:150`). |
| `method` | enum | ✅ | `paymentMethod` (`config.js:168`). |
| `category` | enum | ✅ | `expenseCategory` (`config.js:155`). |
| `woId` | `WO…` ref or `''` | ✅ | → `workOrders`. Free-text today. |
| `notes` | str | ✅ | Free text. |
| `photo` | data-URL / Drive id | ✅ (opt) | Receipt image. |
| `aiPending` | bool | ✅ (opt) | Mr. Wrangler-created, awaiting confirm (✨). |

**`vendor`** — `DATA.vendors` (`data.js:153`), tab `Vendors`. Relevant: `vendorId`, `name`, `phone`, `email`, `address`, `website`, `primaryContact`, `salesTaxExempt`, `vendorType` (`Local`/`Online`).

**`part`** — `DATA.parts`. Relevant to accounting: `partId`, `name`, `vendorId`, `priceEach`, `qtyOnHand`, `receiptId` (links the part to the expense it was bought on), `receiptQty`.

### 4.2 Proposed additive fields (schema-less — no migration, default-absent reads as empty)

| Entity | New field | Type | Purpose | Phase |
|---|---|---|---|---|
| `expense` | `acctCode` | str (GL code) | Chart-of-accounts code derived from `category` via a map; overridable. | P2 |
| `expense` | `taxPaid` | number | Sales tax JacRentals *paid* on this purchase (for use/input-tax reporting). | P2 |
| `expense` | `unitId` | `U…` ref | Direct cost attribution to a machine (when not via WO). | P3 |
| `expense` | `periodId` | `YYYY-MM` | Cached period bucket (derivable from `date`; stored only if periods are *closed/locked*). | P2 |
| `expense` | `approvedBy` / `approvedAt` | str / ISO | Approval workflow (manager-tier). | P3 |
| `expense` | `exportedAt` / `exportBatchId` | ISO / str | Marks a receipt already pushed to QB/CSV so it isn't double-counted. | P3 |
| `vendor` | `acct1099` | bool | Vendor is 1099-reportable (W-9 on file → `companyFiles` `F030`). | P3 |
| *(new)* `period` | `periodId`,`status`,`closedBy`,`closedAt`,`revenue`,`cost`,`tax` snapshot | new tab `Periods` | A *closed* month snapshot so a reopened invoice can't silently change history. | P3 |

**Relationships (by ID):**
`expense.vendorId → vendor` · `expense.woId → workOrder` · `part.receiptId → expense` · `expense.unitId → unit` (proposed) · revenue side joins `invoice` (owned by invoicing-payments) by **date/period**, not by a hard FK.

**Migration concerns.** All additive; absent fields read as empty (the `m()` helper + schema-less Sheets tolerate missing columns). The only true migration is the new `Periods` tab (P3) — created lazily on first period close. A category→GL map (P2) lives in **config/settings**, not on every row, so re-coding the chart of accounts doesn't rewrite history.

### 4.3 Cost↔WO billable note

A receipt's `woId` and a part's `receiptId` already form a cost trail into a work order, but accounting **does not** alter the WO billable formula (owned by `maintenance-shop`). Accounting *reads* that linkage to attribute cost; it never writes a billable number back. (Don't-list adjacent: changing a part/WO line to Complete must not complete the WO — accounting must likewise never mutate WO state.)

---

## 5. Backend / Integration Contract

Backend = Google Apps Script + schema-less Sheets, deployed by clasp (`Code.gs` gitignored). All new behavior is **additive actions on the single `backendCall(action, payload)` entry point** (pattern e.g. `backendCall('membershipEnroll', …)` `app.js:3334`). No existing action is changed.

### 5.1 Proposed additive GAS actions

| Action | Payload | Returns | Auth | Notes |
|---|---|---|---|---|
| `expenseUpsert` | `{ expense:{…} }` | `{ ok, expense }` | money-tier (server re-checks `backendPassword`/role) | Server is source of truth for the written row; client previews. *(Today writes go through the generic record-save path — this formalizes it server-side so reconcile/period locks are enforced on the server, not the client.)* |
| `expenseDelete` | `{ expenseId }` | `{ ok }` | manager-tier | Refuses if the receipt is in a **closed** period or already `exportedAt`. |
| `acctPnl` | `{ from, to }` (ISO) | `{ revenue, cost, tax, net, byCategory[], byMethod[], byVendor[] }` | money-tier | **Server computes** the P&L so the number a CPA pulls matches the app and isn't client-fudged. Revenue from invoices, cost from expenses, both filtered by date. |
| `acctTaxReport` | `{ from, to }` | `{ taxCollected, taxableSales, exemptSales, byJurisdiction }` | money-tier | Aggregates invoice tax (collected) and `expense.taxPaid` (input). |
| `acctPeriodClose` | `{ periodId }` | `{ ok, snapshot }` | admin-tier | Writes a `Periods` snapshot row; locks edits/deletes/reconcile in that month. |
| `acctPeriodReopen` | `{ periodId }` | `{ ok }` | admin-tier | Unlocks; audited. |
| `acctExport` | `{ from, to, format:'csv'\|'iif'\|'qbo' }` | `{ ok, url \| csv, batchId }` | money-tier (run); admin-tier (configure) | Marks rows `exportedAt`/`exportBatchId`. QuickBooks Online uses a stored OAuth token (see §5.2). |

**Server-side role re-check (G6).** Each action above re-validates the caller's tier server-side before doing anything; a `{ ok:false, error:'forbidden' }` is returned for an under-tier caller. The client `canMoney()` gate is **belt**, the server check is **suspenders** — neither alone is sufficient. See Q13 for the open question on *how* the GAS layer establishes a trustworthy role today.

**Concrete payload shapes (proposed):**

```jsonc
// acctPnl request / response
→ { "action":"acctPnl", "from":"2026-05-01", "to":"2026-05-31", "basis":"accrual" }   // basis: 'accrual'|'cash' — see Q3
← { "ok":true,
    "revenue": 18420.00, "cost": 6210.00, "tax": 1786.00, "net": 12210.00,
    "byCategory": [ {"category":"Parts","cost":3110.00}, {"category":"Fuel","cost":930.00} ],
    "byMethod":   [ {"method":"Visa","cost":2100.00} ],
    "byVendor":   [ {"vendorId":"V03","totalSpent":1980.00} ],
    "window": {"from":"2026-05-01","to":"2026-05-31","basis":"accrual"},
    "live": true }      // live=true means no Periods snapshot covers this window (history may shift)

// acctExport request / response
→ { "action":"acctExport", "from":"2026-05-01", "to":"2026-05-31", "format":"csv" }
← { "ok":true, "format":"csv", "batchId":"X2026-05-01", "rowCount":42,
    "url":"<drive-url>" }   // or "csv":"<inlined text>" for small windows
```

**Failure handling.** Every action returns `{ ok:false, error }` on failure; the client toasts a yard-voice message and never optimistically books money. Specific modes:
- **Partial fetch** — a P&L call where invoices load but expenses error returns `{ ok:false, error:'cost_unavailable' }` rather than a misleading half-total (cost would read $0 and inflate net).
- **Closed-period write** — `expenseUpsert`/`expenseDelete`/reconcile into a `status:'closed'` period hard-refuses server-side (`error:'period_closed'`) even if a stale client offers the edit.
- **Double-export** — `acctExport` over a window whose rows already carry `exportedAt` returns `{ ok:false, error:'already_exported', batchId }` unless an explicit `force:true` is passed (manager-tier).
- **OAuth failure** (QB/Xero, P3) — a refresh-token expiry returns `{ ok:false, error:'integration_auth' }` and the client routes the admin to re-connect; it never silently drops rows.
- **Offline / no backend** — the client falls back to the **client-derived** P&L (Phase 1 formula) and stamps the popup "offline — client estimate, not server-of-record."

### 5.2 External integrations

- **QuickBooks Online / Xero (Phase 3, optional).** OAuth handled **server-side**; the access/refresh token lives in **GAS Script Properties**, referred to by name only — **never in the repo (public via Pages)**. The client only ever asks the server to *export*; it never holds a GL credential. CSV/IIF export needs no integration and is the safe Phase-2 fallback.
- **No new Stripe surface.** Revenue/payment data is read from the existing invoice records, not re-fetched from Stripe.
- **Bank-feed import (Phase 3+, parked).** A CSV statement upload that auto-matches `amount`+`date`+`method` to flip reconcile to `Pending`. No live bank API in scope.
- **Receipt photo offload** reuses the existing Drive offload path (see `docs/superpowers/specs/2026-06-20-photo-offload-drive-design.md`); accounting adds no new storage backend.

---

## 6. UX / UI

All new/changed UI runs through the **`jactec-ui` skill** in the **yard data-plate** language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), exactly ONE safety-orange accent (`--accent #ff7a1a`) for the primary/ignition action, hi-vis hazard-stripe signature for danger/abort, corner **rivets**, **Saira Condensed** uppercase stamped labels (~2px tracking), **Geist** body. Ranch twist is **light, mostly in copy** ("Round up the books", "Tally", "Brand the ledger"), with the leather-tan tertiary (`~#c2925a`) and saddle-stitch dashed dividers used sparingly. Spend boldness in ONE place per screen; respect reduced-motion + visible focus. **Self-screenshot + critique before showing Jac.**

Every new element needs a **`data-r="Rxx"` stamp** (regenerate `rule-usage.js` via `ci/gen-rule-usage.mjs`, drop `--check`), and every **new popup** needs a **`WINDOW_CATALOG`** entry (`app.js:9796`) or `ci/check-window-catalog.mjs` fails CI.

### 6.1 P&L Ledger popup — *new* (Phase 1/2)

A back-office popup, opened from the Expenses board header (and from a Financials/KPI tile, see §12). One steel panel, rivets at the corners, a **Saira-stamped "PROFIT & LOSS"** header with a leather-tan saddle-stitch underline.

```
┌─ ⊙  P R O F I T   &   L O S S  ⊙ ──────────────[ May 2026 ▾ ]─┐
│  Revenue        $ 18,420   ◄ links to Invoices (period)        │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (saddle-stitch)      │
│  Cost           $  6,210   ◄ links to Expenses (period)        │
│   ├ Parts          3,110                                       │
│   ├ Fuel             930                                       │
│   ├ Service          840   …expandable by category            │
│  ════════════════════════                                     │
│  NET             $ 12,210   ← green if +, red if −             │
│  Tax collected   $  1,786   (10.75% LA · report ↗)            │
└───────────────────────────────────────────────────────────────┘
```

- **Period switcher:** a segmented control / pill (R14 idiom) — Month · Quarter · YTD, plus the existing date/range picker (search-views).
- **Every figure is a link** back to the records that built it (R7 link idiom) — Revenue → the invoices in that period, Cost → the Expenses board pre-filtered, each category → its filtered rows. Nothing on the P&L is a number you can't trace.
- **Net** is the one bold figure (boldness spent here): green/red by sign per the flag-color system (orange stays chrome-only).
- **States:** empty → "No receipts or invoices in this window yet — round some up." (yard copy). Loading → skeleton rows. Error → "Couldn't tally the books — the server didn't answer." with a retry.
- **Stamp/Catalog:** new `data-r` stamp; new `WINDOW_CATALOG` entry (`app.js:9796`) — `{ kind:'pnl', label:'Profit & Loss', tag:'Accounting · P&L', sample:()=>({ from:'2026-05-01', to:'2026-05-31', basis:'accrual' }) }`. **Gate:** the popup must early-return / refuse to open for `!canMoney()` (the catalog sample renders it in the Rulebook, so the gate is enforced at the open path, not by hiding the catalog row).

### 6.2 Vendor spend — period filter + category split (Phase 2)

Extend the existing Vendors board / `vendorTotals` (`app.js:11138`) so `totalSpent`/`avgCost` accept a period and a per-category mini-breakdown shows on the vendor detail. **No new popup** (in-place on the existing vendors board/detail) → no new catalog entry; re-stamp only if a new element is added. **Gate:** `totalSpent`/`avgCost` columns gated behind `canMoney()` per G1.

### 6.3 Tax Report popup — *new* (Phase 2)

A second steel panel: taxable sales, exempt sales (driven by `inv.taxExempt`/`li.taxExempt`/`customer.salesTaxExempt` — the exact flags `invoiceTotals` reads at `app.js:1606`–`1608`), tax collected, and (if `expense.taxPaid` exists) input tax. One-tap CSV export. New `data-r` stamp + new `WINDOW_CATALOG` entry — note every catalog entry **must** carry a `sample()` fn or `ci/check-window-catalog.mjs` fails: `{ kind:'taxReport', label:'Sales-Tax Report', tag:'Accounting · tax', sample:()=>({ from:'2026-05-01', to:'2026-05-31' }) }`.

### 6.4 Receipt form — reuse + small additions

The existing `receiptform` popup (`app.js:9197`) gains optional **GL code** and **tax-paid** fields (Phase 2) and a **unit** attribution field (Phase 3). Same popup → its existing catalog entry stands; re-stamp the added fields.

### 6.5 Mobile reflow

The P&L panel collapses to a single-column stack (revenue / cost-with-collapsed-categories / net) as a bottom sheet on phones, reusing the mobile bottom-sheet pattern (`docs/superpowers/specs/2026-06-14-mobile-adaptive-design.md`). The period switcher becomes a full-width segmented control. Figures stay tappable (≥44px touch targets). Net stays pinned to the bottom of the sheet so it's visible without scrolling.

### 6.6 Reconcile, refined

Keep the shipped 3-state `js-reconcile` gate. Add (Phase 2) the existing **R19 attention-flash** already wired at `app.js:13576` (when Unaccounted hits $0 the reconcile pill flashes to *suggest* Reconciled) — formalize that as the canonical "ready to reconcile" cue. No new popup.

---

## 7. Business Rules / Derivations / Money

**Be precise — this is a money area.** Accounting *sums what already exists*; it must never re-derive revenue from anything but `invoiceTotals` or cost from anything but `expense.amount`.

### 7.1 Cost rollup

```
periodCost(from,to)   = Σ expense.amount   where from ≤ expense.date ≤ to
costByCategory(c,…)   = Σ expense.amount   where expense.category === c   (in window)
costByVendor(v,…)     = Σ expense.amount   where expense.vendorId === v   (in window)   // generalizes vendorTotals.totalSpent
```
`vendorTotals` (`app.js:11138`) is the all-time special case (`from = -∞`). New P&L sums are **exact-cent** (`Math.round(x*100)/100`) — match the receipt-reconcile rounding at `app.js:5998` and the invoice tax rounding at `app.js:1609`.

> **Accuracy note / latent inconsistency:** the shipped `vendorTotals.avgCost` (`app.js:11142`) rounds to **whole dollars** (`Math.round(totalSpent / partsCount)`), and `totalSpent` itself is an un-rounded float reduce. The P&L must **not** reuse `avgCost` as a money figure (it's a display-only average), and the period-aware `costByVendor` (proposed) should sum to **exact cents**, not whole dollars, so a P&L line and the Vendors board can differ by sub-dollar rounding. Call this out in AC2's fixture so the divergence is intentional and tested, not a bug. — **Q15.**

### 7.2 Revenue rollup (read-only from invoicing-payments)

```
periodRevenue(from,to) = Σ invoiceTotals(inv).total   for invoices whose billing date ∈ window
periodTaxCollected     = Σ invoiceTotals(inv).tax     (same window)
```
**Open: what date keys an invoice into a period** — invoice date, due date, or *payment* date (cash vs accrual)? See Q3. Revenue is **aggregate**; no per-customer line leaves the gate (G2).

### 7.3 Net / P&L

```
net(from,to) = periodRevenue − periodCost
```
Net is **pre-tax-neutral on revenue** in the simplest model (tax collected is a pass-through liability, not revenue) — so the canonical net uses `invoiceTotals.subtotal`-derived revenue *or* `.total` depending on cash/accrual choice (Q3/Q5). **This is the single most important formula to lock — surfaced as Q5.** Whatever is chosen, it must be the **server's** computation (`acctPnl`) so the app and the export never disagree.

### 7.3.1 Reconcile receipt math (canon, shipped)

```
lineTotal(expenseId)   = Σ (part.receiptQty || 1) × (part.priceEach || 0)   for parts where part.receiptId === expenseId
unaccounted(expenseId) = round(expense.amount − lineTotal, cents)
                          green  when |unaccounted| < $0.005
                          yellow when > 0  (money on the receipt not yet itemized)
                          red    when < 0  (itemized more than the receipt — data error)
```
(Exactly as `app.js:5996`–`6012`. Accounting does not change this.)

### 7.4 Tax (10.75% LA, owned upstream)

Tax is **collected** by `invoiceTotals` (`TAX_RATE = 0.1075`, per-line/invoice/customer exempt flags). Accounting only **reports** it; it never recomputes a rate. `vendor.salesTaxExempt` and `expense.taxPaid` feed the *input/use-tax* side (Phase 2), distinct from collected tax.

### 7.5 Edge cases

- **Refunded invoices** must reduce period revenue exactly once — read the *settled* balance model (refund never springs the balance back, per invoicing-payments §2.1), not gross charges.
- **28-day series invoices** (`contOf`) must not double-count — sum each child invoice once; never the parent + children.
- **Voided / archived (gray) records** are excluded from P&L (flag-color-system gray = record-keeping only).
- **Receipt with `amount` but no parts** still counts as cost (cost ≠ reconciled).
- **Negative/zero amounts** (a credit memo from a vendor) sum naturally; flag a negative cost line in the UI.
- **Reopened closed period** must invalidate any cached `Periods` snapshot or warn that the export is stale.

---

## 8. Phasing & Milestones

**Phase 1 — P&L MVP (read-only, client-derivable).**
In scope: the **P&L Ledger popup** (§6.1) computing `periodRevenue`/`periodCost`/`net` over a date window from existing `invoices`+`expenses`, category breakdown, traceable links, period switcher; **G1 gating** of the Expenses board + vendor/part cost behind `canMoney()`. Out of scope: server `acctPnl`, export, GL codes, periods, tax report. *(Phase 1 can ship client-only because it only reads existing data; the server action follows to make exports trustworthy.)*

**Phase 2 — Server truth + tax + vendor periods.**
`acctPnl` + `acctTaxReport` GAS actions (server-authoritative totals), the **Tax Report popup**, vendor-spend period filter + category split, `acctCode`/`taxPaid` fields + a category→GL map in settings, **CSV/IIF export** of a window.

**Phase 3 — Close, attribute, integrate.**
`Periods` tab + `acctPeriodClose`/`Reopen`, per-unit/category cost attribution (`expense.unitId`) and per-machine profitability (behind G3 margin gate), expense **approval workflow** (manager-tier), **QuickBooks/Xero** OAuth export (server-side token), optional bank-feed CSV reconcile-assist, 1099/W-9 vendor reporting.

**Explicitly out of scope for v1:** payroll, AP/AR aging beyond what invoicing already does, multi-entity/multi-location books (single-store per the locations note `roadmap §11`), inventory valuation/COGS depreciation, and any live banking API.

---

## 9. Acceptance Criteria

| # | Criterion | CI / gate impact |
|---|---|---|
| AC1 | P&L popup opens from the Expenses board header and shows Revenue, Cost (by category), Net for a selected window, every figure linking to its source records. | `check-window-catalog` (new `pnl` kind), `gen-rule-usage` (new stamps). |
| AC2 | `net = periodRevenue − periodCost` is exact-cent and matches a hand-summed fixture of the seed data for May 2026. | `ci/logic-test.mjs` adds a P&L fixture assertion. |
| AC3 | A staff-tier (no money) session **cannot** see expense amounts, vendor `totalSpent`/`avgCost`, part `priceEach`, or the P&L/tax/export surfaces (G1) — asserted against the **rendered HTML/data**, not just CSS visibility (no dollar value reaches a staff DOM). | `ci/logic-test.mjs` gate assertion on `canMoney()` at the row-builder source. |
| AC3b | (P2) Each `acct*` GAS action **refuses an under-tier caller server-side** (G6) — a money-action requested by a staff token returns `{ ok:false, error:'forbidden' }`, independent of the client gate. Blocked on Q13 being answered. | manual/integration; `logic-test` mock of the action contract if feasible. |
| AC4 | Refunded and 28-day-series invoices are each counted exactly once in revenue (no double-count). | `ci/logic-test.mjs` fixture. |
| AC5 | Gray/voided records are excluded from all rollups. | `ci/logic-test.mjs`. |
| AC6 | (P2) `acctPnl` server action returns the **same** net the client previews for the same window. | manual + logic fixture. |
| AC7 | (P2) CSV export of a window re-imports into a spreadsheet with matching column sums; rows are stamped `exportedAt`. | manual. |
| AC8 | All new UI passes `node ci/smoke.mjs` (no console errors, renders), `gen-code-map --check` (regen if a chapter banner is added/moved), reduced-motion + visible-focus quality floor. | `smoke`, `gen-code-map`. |
| AC9 | No secret, GL token, or DEFAULT_CONFIG value appears in any committed file. | manual review (repo is public via Pages). |

Standard gate run (port 8000 reserved → swap to 9147 first, then `git checkout -- ci/`): `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`. Cache-bust the shared `?v=` token on deploy.

---

## 10. Risks & Edge Cases

- **Double source of money truth (highest risk).** If the client P&L (Phase 1) and a later server `acctPnl` (Phase 2) ever disagree, the export is untrustworthy. Mitigation: Phase 2 makes the server canonical and the client *previews* the same formula; AC6 asserts agreement.
- **Silent loosening of a gate.** Adding the P&L could accidentally expose cost to staff if G1 isn't enforced everywhere the board renders. Mitigation: gate at the board/`vendorTotals`/`priceEach` source, not per-popup; AC3 tests it.
- **Margin leak via profitability.** Per-unit profit (P3) is one join from `bottomDollar`/margin floors. Mitigation: G3 — render realized margin only, never the floor; money-tier+.
- **History mutation.** A reopened invoice or edited receipt silently changes a "closed" month. Mitigation: `Periods` snapshot (P3) + reopen audit; until then, the P&L is explicitly *live* (a footnote on the popup: "live — reflects records as of now").
- **Rounding drift.** Summing many `amount`s without per-step cent-rounding diverges from receipts. Mitigation: round to cents at each sum (matches `app.js:5998`).
- **Schema-less landmines.** Absent `category`/`date` on a hand-added receipt would silently drop it from rollups. Mitigation: a "Cost not in any window/category" catch-all row so nothing vanishes.
- **Offline / multi-user.** Two devices editing receipts then a P&L read mid-write. Mitigation: server-authoritative `expenseUpsert` (P2); P1 reads are eventually-consistent and labeled "live."
- **Export double-count.** Re-exporting an already-exported window. Mitigation: `exportedAt`/`exportBatchId` guard.
- **OAuth secret exposure.** A QB token in the repo would leak (public Pages). Mitigation: token in GAS Script Properties only, referenced by name (§5.2).
- **Client-gate-only money exposure (security, high).** If §5 actions are added but the server role re-check (G6) isn't real, a crafted `backendCall` reads a full P&L or runs an export regardless of `canMoney()`. Mitigation: Q13 must be answered before any money action ships; until then accounting stays **read-only client-derived** (no new backend action surface to exploit). The Phase 1 client P&L exposes nothing the money-tier UI gate doesn't already cover, so Phase 1 is safe even if Q13 is open; Phase 2's server actions are blocked on Q13.
- **DOM leak of masked amounts.** Hiding a cost cell via CSS still ships the dollar value to a staff browser. Mitigation (G1): the amount must never be written into the DOM for a non-money session — gate at the row builder, not the stylesheet. AC3 inspects the rendered HTML, not just visibility.
- **Concurrent close vs. write race.** Device A closes May while Device B is mid-edit on a May receipt. Mitigation: `acctPeriodClose` is server-authoritative and atomic on the `Periods` row; a `period_closed` refusal on B's next save (the diff-sync upsert already serializes server-side via `backend-data`); B's optimistic edit is rolled back and re-toasted.
- **Stale-client export.** A device with an old expense set runs an export. Mitigation: `acctExport` computes from the **server's** rows at call time (not the client's), and stamps `exportedAt` on the server rows — the client's staleness can't double-book or omit.
- **Period snapshot vs. live reopen drift.** A reopened invoice changes revenue after a `Periods` snapshot was taken. Mitigation: reopen invalidates/flags the snapshot (§7.5) and the P&L shows `live:true` until re-closed; an export of a reopened period refuses with `error:'period_reopened'`.

---

## 11. Open Questions

*(No seed questions were captured — Q1–Q12 are generated from the code; Q13–Q16 are forks surfaced during the gate-hardening review. Q1, Q5, and **Q13** are the load-bearing ones: nothing here ships before they're answered.)*

1. **Board gating (G1) — tighten now?** Today the Expenses/Vendors boards and `priceEach`/`vendorTotals` render for any role. Proposed: gate cost behind `canMoney()` (money-tier+), leaving staff vendor *names* and part *names/qty*. **Trade-off:** correctness/PII-of-spend vs. a mechanic in the field losing the ability to glance at part cost. Gate it, or carve a "field cost-view" exception?
2. **Where does the P&L live?** A back-office popup off the Expenses board, a new Financials/KPI tile (financials-kpi owns the dashboard), or both? **Trade-off:** discoverability/ownership boundary vs. duplicating an entry point.
3. **What date keys an invoice into a period — cash vs accrual?** Invoice date (accrual), due date, or payment-received date (cash)? **Trade-off:** a CPA usually wants a consistent basis; cash is simpler and matches "money that actually moved." This drives every revenue number.
4. **Receipt delete / closed-period authority (G4).** Keep create/edit at money-tier but route **delete** and "reconcile a closed month" to **manager-tier**? **Trade-off:** safety vs. an Office user being blocked from fixing their own typo.
5. **Net definition (the load-bearing formula).** Net = `Σ invoice.total − Σ expense.amount` (tax included on revenue) **or** `Σ invoice.subtotal − Σ expense.amount` (tax excluded as a pass-through liability)? **Trade-off:** the second is the "real" P&L a CPA expects; the first matches what the customer paid. Must be locked before AC2.
6. **Per-unit profitability (G3) — in or out for v1?** It's the most-wanted owner number but the closest to a margin-floor leak. **Trade-off:** value vs. pricing-floor exposure risk. Defer to Phase 3 behind the margin gate, or skip entirely?
7. **Chart of accounts depth.** Map the 7 existing categories 1:1 to GL codes, or introduce a fuller CoA (with sub-accounts) that the categories roll into? **Trade-off:** clean QB export vs. complexity Jac may never need.
8. **Reconciliation — keep manual, or add bank-feed CSV assist?** A CSV statement import that auto-suggests `Pending` by `amount`+`date` match. **Trade-off:** real reconciliation value vs. matching-logic edge cases (partial/split payments) and scope.
9. **Export target & authority (G5).** CSV/IIF only (safe, no integration), or QuickBooks/Xero OAuth? Who can configure (admin) vs. run (money)? **Trade-off:** zero-integration safety vs. the no-re-keying north star.
10. **Period close — needed for v1?** Without it the P&L is "live" and history can shift under a reopened invoice. **Trade-off:** trustworthy month-end snapshots vs. the engineering of a `Periods` tab + lock semantics. Ship live first, add close in P3?
11. **Input/use-tax tracking.** Is `expense.taxPaid` worth capturing (LA use-tax reporting), or is collected sales tax the only tax Jac files? **Trade-off:** completeness vs. extra data-entry friction on every receipt.
12. **Ranch-twist copy dosage.** How western should the ledger read ("Round up the books", "Tally", "Brand the ledger") before money copy should stay plain for a CPA's eyes? Surface to the `jactec-ui` self-critique.
13. **Server-side role trust (G6) — does the GAS layer get a verifiable role today, or only the shared `backendPassword`?** If `backendCall` authenticates with one shared password and the *role* is only a client-side label, then "admin-tier to configure export" and "money-tier to run it" collapse server-side to "anyone who can reach the backend at all" — the tier gates are **UI-only theatre** for any motivated caller. **Trade-off:** doing this right may require passing a signed role/per-user token through `backendCall` (a `backend-data` change), vs. accepting that money-action gating is best-effort-UI until then. This is a *security* fork, not a feature one — must be answered before any destructive (`expenseDelete`, `acctPeriodClose`) or outbound (`acctExport`) action ships. **Conservative default until answered: keep all destructive/outbound actions admin-tier *and* re-confirmed in-UI, and treat the server gate as not-yet-trustworthy.**
14. **P&L drill-down vs customer isolation (G7).** The aggregate revenue line is fine, but its "Revenue → invoices" link reveals per-customer invoices. Reuse the **existing gated Invoices board** as the only drill target (inherits its gate), or build a P&L-local revenue view (faster, but a second place to keep the gate correct)? **Trade-off:** zero new gate surface vs. a tighter in-context UX. Recommend reuse.
15. **Vendors-board ↔ P&L rounding divergence.** The shipped `vendorTotals` is whole-dollar/un-cent-rounded; the P&L is exact-cent. Do we (a) leave them intentionally different and document it, (b) re-round `vendorTotals` to cents (a tiny change to a shipped, money-tier-visible board — needs its own smoke/logic check), or (c) make the P&L mirror the board's whole-dollar rounding (wrong for a CPA export)? **Trade-off:** consistency vs. touching shipped money code. Recommend (a) for P1, (b) tracked for P2 when the board gains a period filter anyway.
16. **Field cost-capture write path (G1 corollary).** Staff can *log* a receipt photo + amount against their own WO but can't *see* rolled-up cost. Does that write go through the same `expenseUpsert` (server-authoritative, money-tier) — meaning staff need a narrower "create-only, no-read" server permission — or a separate `receiptCapture` action scoped to "attach to a WO I own, never read a total"? **Trade-off:** one code path vs. a clean least-privilege capture verb. This is the one place a *staff* (tier 1) role writes into the money ledger, so the permission shape matters.

---

## 12. Dependencies & Sequencing

| Depends on | Why | Must land first? |
|---|---|---|
| `invoicing-payments` | The entire **revenue** + tax-collected side reads `invoiceTotals`; settled-balance model prevents double-count. | Yes — already shipped; no change needed, only read. |
| `financials-kpi` | Owns the KPI dashboard / Revenue Goal; the P&L tile may surface there. Roadmap notes KPI "is *not* general ledger/accounting" — accounting is the GL layer **below** it. | Coordinate entry point (Q2). |
| `maintenance-shop` | `expense.woId` / `part.receiptId` cost trail; accounting reads WO linkage, never mutates billable. | No — read-only dependency. |
| `units-fleet` | Per-unit cost attribution (`expense.unitId`) for P3 profitability. | Only for P3. |
| `backend-data` | New additive `acct*` GAS actions on `backendCall`; `Periods` tab; export connection / Script Properties. | Before P2 server totals. |
| `customers-crm` | Revenue rollup must respect the same customer-isolation gate (G2). | Read-only constraint. |
| `design-system` | Flag-color (net green/red) + R-rulebook stamps + yard data-plate language via `jactec-ui`. | Concurrent. |

**Sequencing.** Phase 1 (client P&L + G1 gate) ships against today's shipped invoicing/expenses with **no backend change** — fastest trustworthy win, and safe even if the server-trust question (Q13) is open because it adds no new backend action surface. Phase 2 (`acctPnl` server truth + tax + export) requires a `backend-data` clasp deploy and locks Q3/Q5 **and Q13** first — no money-mutating or outbound GAS action ships until the server can verify the caller's tier (G6/Q13). Phase 3 (close/attribute/integrate) requires `Periods`, `units-fleet` attribution, and the QuickBooks OAuth decision (Q9). **Nothing in Phase 1 ships before Q1 (gating) and Q5 (net formula) are answered; nothing in Phase 2 ships before Q13 (server role trust) is answered.**
