# Sales / Growth — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/sales-growth`
**Task branch:** `sales-growth/spec` (proposed)
**Maturity:** partial
**Scope:** Owns the customer sales pipeline (used-equipment sales + membership sign-ups), the next-action follow-up loop, the Sales KPI ring, and the future growth toolkit (quoting, campaigns, referrals) that turns pipeline motion into booked revenue.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions.

- **D1 · A dedicated top-level Sales/Pipeline board — drop the confusing "Round-Up" name (resolves Q1).** The board is the **pipeline cockpit**: a daily *who-to-contact-today* worklist (overdue + due follow-ups, soonest-first) **plus** a Kanban of leads by funnel stage (drag to move stage → `setFunnelStage` + `logAction`). Rename the spec's "Round-Up" to a **plain "Sales"/"Pipeline"** surface (ranch flavor stays light in *copy*, not the surface name). Lives as **its own top-level card** (Sales needs a home now that Marketing splits out — D2). *(Jac can redirect placement/name; he asked what it was, so this is my default pick.)*
- **D2 · Marketing splits to its own area #19 (resolves Q12).** Sales/Growth scope **ends at pipeline + quoting**; campaigns / outreach / referrals move to the **Marketing** area. The draft's Phase-4 growth toolkit relocates there.
- **D3 · Build the used-equipment quote tool; send via comms (resolves Q13 + scope).** Build the `salesQuote` model + Quote popup + `saveSalesQuote`/`quotePdf`/`acceptSalesQuote`→invoice, and **send the quote through the Mocean SMS / `comms-notifications` channel** (D1 there). `costBasis`/margin gated **money-tier** (mirrors the `units-fleet` `bottomDollar` gate + the `automated-pricing` sale-price engine D2/D3) and **server-stripped** for sub-money callers; the customer-facing PDF never carries cost/margin.

**Defaults adopted:** Q11/Q15 → **fix the Pipeline ring** (exclude `Don't Contact` + closed terminals `Paid`/`Signed`, dedupe member-also-lead, make the target admin-settable like `companyRevenueGoal`) · `recomputeDigests` (P2) so Active-Rate is honest · Q3 → wire `salesAction` + the follow-up "due today" styling in **Phase 1** · Q8 → prescriptive **R/Y/G** for overdue follow-ups · Q4/Q17 → `nextFollowUp` recomputed in the same path that writes a `Scheduled:` line · Q5 → staff may log a follow-up on a customer card they can already open, but the **cross-customer board is money+** · Q9 → `salesQuotes` as a **top-level entity** (easier to list/seam to invoices) · Q16 → a smuggled `costBasis` from a sub-manager caller is **dropped + logged**, never persisted/returned.

---

## 1. Goal & Problem

### 1.1 What this area is for

Rental Wrangler today is built to *operate* the yard — dispatch, shop, invoicing. The **Sales / Growth** area is the layer that *fills the yard*: it tracks every customer's position in two sales funnels, schedules the next touch, and measures whether the shop is growing. It is the one area whose job is to answer **"who do I call next, and is the business pointed up?"**

### 1.2 The business problem

JacRentals has the raw signals scattered across the Customer detail card — two funnel pills, an Activity Log, a `salesAction` hint, interested categories — but **no place to work the pipeline as a pipeline**. A salesperson cannot:

- See *all* leads sorted by who's overdue for a follow-up.
- See *which scheduled follow-ups are due today* without opening each customer.
- Turn an "interested in category X" signal into a sent quote.
- Measure conversion (lead → paid) or velocity (days-in-stage).

The data exists; the **workflow and the roll-up do not**. The Sales KPI ring exists but is fed by hardcoded `_digest` numbers and a couple of crude counts.

### 1.3 North star

> **A salesperson opens the app, sees a single prioritized "round-up" of who to contact today, works each one to its next stage, and watches the Pipeline + Revenue rings climb — without ever leaving the sales surface.**

Wrangler/ranch voice fits this area better than any other: you *round up* leads, *corral* the pipeline, *wrangle* a deal to Signed, *brand* the close.

---

## 2. Current State (Baseline)

This is what exists **today**, with anchors. Treat the SHIPPED rows as canon.

| Capability | Status | Anchor |
|---|---|---|
| Dual funnels per customer (`usedSalesStage`, `membershipStage`) | **SHIPPED** | `config.js:134` (`funnelStage`), `app.js:11490` (`openFunnelDropdown`), `app.js:11499` (`setFunnelStage`) |
| Membership funnel terminal `Signed`, locked + auto-set by signing (F3) | **SHIPPED** | `MEMBERSHIP_FUNNEL_ORDER` `app.js:11489`, lock `app.js:11502`, auto-set `app.js:412–413` |
| Funnel default = `N/A` (not `Inbound Lead`) | **SHIPPED** | migration `app.js:164–165`, new-customer `app.js:14060/14131` |
| Funnel pills in Customer detail (Used Sales + Membership sections) | **SHIPPED** | `app.js:6127–6130` (`funnelPill`), `funnelStage` registry |
| Interested categories (`interestedCategoryIds`) | **SHIPPED** | `openIntCatDropdown` `app.js:11511`, `addInterestedCategory` `app.js:11517`, render `app.js:6126` |
| Activity Log + two-column logged/scheduled split | **SHIPPED** | render `app.js:6139–6149`, log `app.js:14170–14178` |
| Schedule follow-up popup (date+time → `Scheduled:` log line) | **SHIPPED** | popup `kind:'schedule'` `app.js:9649–9660`, catalog `app.js:9820` |
| `salesAction` field (free-text next-action hint) | **PARTIAL** | stored `data.js:60`, searchable `app.js:757` — **but NOT rendered/edited in the detail UI** |
| Sales KPI ring (Revenue Goal · Active Customer Rate · Pipeline) | **SHIPPED but thin** | `legacyKpiPct('sales')` `app.js:7132–7143`, help `app.js:7161–7163`, role `config.js:311` |
| `companyRevenueGoal()` admin-settable monthly goal | **SHIPPED** | `app.js:3130` |
| Custom KPI engine (DSL, allowlisted fields) usable for sales | **SHIPPED** | `KPI_FIELDS.customers` `app.js:7265`, engine `app.js:7174+` |

### 2.1 What is explicitly MISSING (greenfield)

- **No dedicated Sales board / chapter.** The ROADMAP area has **zero items**; there is no `APP-xx` chapter for sales. All sales work happens inside the Customer detail card.
- **No pipeline roll-up view.** No way to list "all leads in stage X", "follow-ups due today", or a Kanban/column board across customers.
- **No quoting tool.** There is a rental **Quote** *status* (`app.js:4731`) and a "Text a quote" message template (`app.js:3525`), but no standalone sales quote object, no quote PDF for used-equipment sales, no quote-sent tracking.
- **No campaigns / outreach lists / referrals.** No code exists. ("Marketing" is a separate ROADMAP area #19 whose branch currently routes here — see §11 Q12.)
- **No live `_digest` recompute.** The Sales rings read hardcoded seed digests (`data.js:54–57` note; gap flagged in `customers-crm.md` §2.6). Active Customer Rate is only as true as the seed.
- **No days-in-stage / velocity / conversion metric.** Funnel moves log to `activityLog` but nothing computes stage dwell time.

### 2.2 Adjacent code this area must build on

- **Customer detail render** (`app.js:6100–6167`) — the host surface for every sales control.
- **`gateTimeline` dropdown** (`app.js` ~11383) — the funnel UI primitive; reuse, don't reinvent.
- **`logAction(rec, text)`** — every sales mutation already routes through this; keep it.
- **KPI metric engine** (`app.js:7174+`) — custom sales rings should ride this DSL, not new bespoke math.
- **Membership area** (`memberships.md`) — owns the `membershipStage` terminal contract; Sales must not duplicate it.

---

## 3. Users, Roles & Data Gates

### 3.1 Roles & the permission ladder (canon)

Roles are **runtime-customizable** (add/remove/rename in Settings → Roles & Logins), so **permissions no longer key off role NAMES** — every role carries one **tier**, and all gates compare tiers (`config.js:315–348`). The ladder is a strict superset (`ROLE_TIERS`, `config.js:326`):

| Tier | rank | Grants (cumulative) |
|---|---|---|
| `staff` | 1 | operational only — units/shop/rentals/inspections |
| `money` | 2 | + see pricing/margin, take payments, invoices |
| `manager` | 3 | + approve requests, override blocks |
| `admin` | 4 | + Settings, category/pricing edits, migrations |
| `developer` | 5 | + dev tools (Design Lint / Inspector / Rulebook) |

Gates compare via `tierRank(tierId)` (`config.js:334`; unknown/blank → `0`, no privilege). The **default tier per shipped role** is in `BUILTIN_ROLE_TIERS` (`config.js:340`): **`sales` and `office` both default to `money`**; `mechanic`/`mtech`/`driver` to `staff`; `manager`→`manager`, `admin`→`admin`, legacy `owner`→`admin`. The 5 KPI **lenses** (`config.js:302`, `ROLES`) are *display* dashboards, not permission grants — the `sales` lens shows the Revenue/Active/Pipeline rings (`config.js:311`), but the *gate* is the login's tier, never the lens.

| Role / tier | Touch | Notes |
|---|---|---|
| **Sales** lens (default `money` tier) | Primary | Owns the funnels, follow-ups, Sales ring. Sees prices because `money`, NOT because "sales". |
| **Office** (default `money`) | Heavy | Books rentals, often works the funnel too. |
| **Manager / Admin** (`manager`/`admin`) | Oversight | Pipeline roll-up + revenue; sets the goal; sees margin (§3.3). |
| **`staff`-tier custom role** | Read-only pipeline? | **OPEN (Q5)** — a renamed/custom `staff` login could be pointed at the Sales lens. Can it see funnel stages + follow-ups but no dollars? Conservative default below. |

> **Gate rule for this area:** any dollar figure (quote `askPrice`, revenue, `_digest.totalPaid`, ring numbers that expose money) requires `tierRank(tier) >= tierRank('money')`. Any **margin / `costBasis`** figure requires `>= tierRank('manager')`. Funnel *stages* and *follow-up text* are operational (non-money) and MAY be visible at `staff` — but only behind the existing Customer-card visibility (§3.2), and Q5 must confirm whether a `staff` login reaches the Sales surface at all.

### 3.2 Customer-isolation & PII

The pipeline surfaces customer **name, phone, email, company, industry, address** (`app.js:6107–6110`) and the Activity Log free text. These are PII. Rules to honor:

- Any new **roll-up / board** that lists customers MUST respect the same visibility the Customer card already enforces — it cannot become a backdoor that shows PII to a role that can't open the Customer card.
- The **KPI allowlist** is the canonical PII gate for rings: `KPI_FIELDS.customers = ['accountType','usedSalesStage','membershipStage','industry','_totalPaid','_activePct']` (`app.js:7265`) — **no name/phone/email/address/idNumber** (see `financials-kpi.md` §line 159). **Any new sales ring MUST stay inside this allowlist.** Adding a name-bearing field to a ring is a PII leak and is **out of scope without an explicit Jac gate decision** (Q6).

### 3.3 Money / pricing-floor gating

Gating is by **tier**, evaluated with `tierRank` (§3.1), NOT by role name. Three concentric rings of sensitivity:

| Datum | Min tier | Enforcement point |
|---|---|---|
| Funnel stage, `salesAction`, follow-up text, `interestedCategoryIds` | `staff` (operational) | Customer-card visibility (§3.2). |
| Quote `askPrice`, line `amount`, revenue figures, `_digest.totalPaid`, any **dollar** in a ring | `money` (rank ≥ 2) | Client hides + **server omits** the field for sub-money callers. |
| Used-sale **margin** = `askPrice − costBasis`, the raw `costBasis` itself | `manager` (rank ≥ 3) | **Server strips `costBasis` from the response** for sub-manager callers; client never receives it, so view-source on the public Pages bundle can't leak it. |
| Any **money action** (send a priced quote, accept→spawn invoice, take payment) | `money`; quote *acceptance that books revenue* mirrors invoice/payment gating in `invoicing-payments` | Server re-checks tier on the action, never trusts the client. |

- The Revenue Goal ring shows aggregate revenue and is already gated to the money-tier Sales/Office/Manager dashboards (rings render only on those lenses). A quoting tool gates the *price* (not the *existence* of the quote) behind `money`.
- **Margin is the strictest gate.** A used-sale `costBasis` is the equivalent of `bottomDollar` on a rental — surfacing it below `manager` is a pricing-floor leak. It must **never** be embedded in the client seed or returned to a sub-manager `backendCall`. This is the one place the spec refuses to decide loosely (Q7): default is *hidden + server-stripped* until Jac confirms.

> **Gate posture for this draft:** conservative and tier-based. Where a gate decision is non-obvious it is surfaced as an Open Question (Q5, Q6, Q7) rather than decided here. No gate is loosened silently; the server is the source of truth (the client is public via Pages and cannot be trusted to hide a field).

---

## 4. Data Model

### 4.1 Existing fields (on the Customer record, `data.js`, schema-less)

| Field | Type | Source | Meaning |
|---|---|---|---|
| `usedSalesStage` | enum (`funnelStage`) | funnel dropdown | Used-equipment sales stage; free choice; terminal `Paid`. |
| `membershipStage` | enum (`funnelStage`, `MEMBERSHIP_FUNNEL_ORDER`) | funnel / agreement | Membership stage; terminal `Signed` (locked, auto-set). |
| `salesAction` | string | (no UI yet) | Free-text next-action hint. Searchable (`app.js:757`). |
| `interestedCategoryIds[]` | string[] (category IDs) | `addInterestedCategory` | Categories the customer is interested in. |
| `activityLog[]` | `{ when, text }[]` | `logAction` | Touch history; lines prefixed `Scheduled:` are follow-ups. |
| `_digest{}` | object | seed (prod: derived) | `totalPaid, visits, years, avgFrequencyDays, activePct, firstInvoice, lastInvoice`. Feeds Sales rings. |

### 4.2 The `funnelStage` enum (canon — `config.js:134`)

```
N/A · Inbound Lead · Outbound Lead · Don't Contact · Contacted ·
Not A No! · Payment Discussed · Paid (used) / Signed (membership, locked)
```

Colors are descriptive (blue/navy/red/yellow/purple/orange/green) — **NOT** the R/Y/G flag-color system. Whether the sales pipeline should adopt prescriptive flag colors is Q8.

### 4.3 Proposed additive fields (schema-less — no migration, just start writing them)

All proposed fields are **additive on existing records**; absent = falsy/default, so no migration pass is required (consistent with `_digest`-style additive evolution).

| Field | Type | On | Purpose | Phase |
|---|---|---|---|---|
| `salesAction` (wire up UI) | string | Customer | Editable next-action; render in detail. | P1 |
| `nextFollowUp` | ISO datetime | Customer | Denormalized "soonest open `Scheduled:` line" for fast sort/board. Derived from `activityLog`; cached. | P1 |
| `stageEnteredAt` (per funnel) | `{ usedSales: ISO, membership: ISO }` | Customer | Timestamp of last stage change → days-in-stage / velocity. Written in `setFunnelStage`. | P2 |
| `salesQuotes[]` | object[] | Customer | Used-equipment sale quotes (see §4.4). | P3 |
| `referredBy` / `referrals[]` | id / id[] | Customer | Referral graph. | P4 |

### 4.4 Proposed `salesQuote` shape (Phase 3 — needs Jac sign-off)

```js
{
  id: 'SQ-0001',                 // monotonic, like invoice ids (app.js:1945 pattern)
  customerId: 'C0009',
  kind: 'used-equipment',        // 'used-equipment' | 'rental-package' | 'membership'
  unitId: 'U012' | null,         // the for-sale unit, if any
  categoryId: 'CAT008' | null,
  askPrice: 18500,               // money-tier visible
  costBasis: 12000,              // MANAGER/ADMIN ONLY (margin) — never to Sales lens (Q7)
  status: 'Draft'|'Sent'|'Accepted'|'Declined'|'Expired',
  sentAt: ISO, expiresAt: ISO,
  note: 'string', lines: [{ desc, qty, amount }],
}
```

**Where it lives.** Either embedded on the Customer (`salesQuotes[]`) or a new top-level `DATA.salesQuotes` tab. Trade-off in Q9.

### 4.5 Relationships (by ID)

```
Customer ──< activityLog (embedded)
Customer ──< interestedCategoryIds ──> Category
Customer ──< salesQuotes ──> (Unit | Category)        [proposed]
Customer ──1 membershipStage ──> Agreement (sign → Signed)   [memberships area]
salesQuote ──0..1 Invoice (on Accept → spawn invoice)         [invoicing area, proposed]
```

---

## 5. Backend / Integration Contract

Backend = **Google Apps Script + schema-less Google Sheets**, single `backendCall(action, payload)` entry point (`Code.gs` gitignored; **additive actions only**). The front end already persists the whole customer record on edit, so funnel/`salesAction`/follow-up changes **need no new action** — they ride the existing customer-save path and `logAction` history.

### 5.1 Existing actions reused

| Action | Use here |
|---|---|
| customer save (existing) | Persists `usedSalesStage`, `membershipStage`, `salesAction`, `activityLog`, proposed `nextFollowUp`/`stageEnteredAt`. |
| `getViews` / `setViews` (`app.js:11553/11557`) | A saved "Leads due today" view persists company-wide like any other view. |

### 5.2 Proposed additive actions

All actions ride the **single `backendCall(action, payload)` entry point**; they are **additive** (new `case` arms), never edits to existing handlers. Every action that returns or writes money/margin must **re-derive the caller's tier server-side** (from the authenticated session/role config the backend already holds) and gate accordingly — the client tier is advisory only.

| Action | Payload | Returns | Phase | Auth / gate | Notes |
|---|---|---|---|---|---|
| `recomputeDigests` | `{}` or `{ customerId }` | `{ ok, updated: n, ts }` | P2 | `manager`+ to run a full walk; per-customer recompute may ride a normal save | Walk rentals+invoices to rebuild each `_digest` so Active Customer Rate is real. **Idempotent** (same inputs → same digests). Must never *invent* money — only sums existing invoice/rental rows. Resolves the `customers-crm.md` §2.6 gap. |
| `saveSalesQuote` | `salesQuote` (see §4.4); `costBasis` accepted **only** if caller is `manager`+, else ignored/rejected | `{ ok, id, quote }` (returned `quote` has `costBasis` stripped for sub-manager) | P3 | `money`+ to create/send; `costBasis` write requires `manager`+ | Server stamps a monotonic `id` (`SQ-####`) if absent; returns the canonical record so the client never fabricates ids. |
| `quotePdf` | `{ quoteId }` | `{ ok, url }` | P3 | `money`+ | Render a branded quote PDF, offloaded to Drive (Drive-offload pattern, `photo-offload-drive-design.md`); the PDF must **exclude `costBasis`/margin** regardless of caller (a PDF is forwardable to the customer). |
| `acceptSalesQuote` | `{ quoteId }` | `{ ok, invoiceId }` | P3 | `money`+ | Accept → spawn one invoice (handoff to `invoicing-payments`). **Idempotent on `quoteId`**: a second call returns the already-spawned `invoiceId`, never a duplicate (the quote/invoice race, §10). |

### 5.3 External integrations (future, mostly out of v1)

| Integration | Use | Status |
|---|---|---|
| **SMS / Email** | Send a quote / follow-up reminder. The "Text a quote" template already exists (`app.js:3525`) — a reply/call number, no send pipe. Real send = `comms-notifications` area. | OUT of v1 (depends on `comms-notifications`). |
| **Stripe** | Accept a quote → spawn invoice → take payment. Card-on-file already exists. | P3+, via `invoicing-payments`. |
| **QuickBooks** | Revenue reconciliation for the goal ring. | OUT of scope here (`accounting`). |

**Failure handling.**

- **Local-first writes.** Stage/`salesAction`/follow-up mutations mutate `DATA`, render, then sync via the existing customer-save path. On offline/`backendCall` failure: keep the local change, re-sync on next online write (same posture as `pushViewsToBackend` `app.js:11557`). A follow-up scheduled offline must survive re-sync (it lives in `activityLog`, which already round-trips).
- **`recomputeDigests`** is safe to re-run (idempotent) and never invents money — only sums existing rows. If it fails mid-walk, partial writes are still valid digests; the next run reconciles. UI shows the last successful `ts` so a stale Active-Rate ring is labelled, not silently trusted.
- **`saveSalesQuote` / `acceptSalesQuote`** are money actions and are **NOT** fire-and-forget: on failure the client must show an error and NOT optimistically render an "Accepted" quote or a phantom invoice. Acceptance is idempotent on `quoteId` so a retried/duplicated request can't double-spawn an invoice.
- **Tier mismatch / forbidden field.** If a sub-manager caller smuggles `costBasis`, the server drops it and proceeds (or rejects with `{ ok:false, err:'forbidden_field' }` — Q-decision; default: drop + log, never persist). A sub-money caller hitting a money action gets `{ ok:false, err:'tier' }` and no write.

---

## 6. UX / UI

All new UI in the **yard data-plate** language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), corner **rivets**, **Saira Condensed** stamped uppercase labels (~2px tracking), **one** safety-orange accent (`--accent #ff7a1a`) on the primary/ignition action only, the **hazard stripe** motif for the signature surface, and a **light** wrangler seasoning carried mostly in copy ("Round up", "Corral", "Brand it"). Any new popup needs a `data-r="Rxx"` stamp **and** a `WINDOW_CATALOG` entry (`ci/check-window-catalog.mjs` gate). Every interactive element needs its `data-r` rulebook stamp (`ci/gen-rule-usage.mjs --check` gate). **Run all of this through the `jactec-ui` skill before showing Jac** (screenshot + self-critique).

### 6.1 Phase-1 surface: wire up `salesAction` + the follow-up loop (no new chapter)

Smallest real win — make the existing Customer card actually work the pipeline.

- **`salesAction` field**, rendered in the **Used Sales** section (`app.js:6127`) under the funnel pill, as an inline-editable stamped field ("Next move") matching the `efield` pattern (`app.js:6107`). Ranch copy: placeholder *"What's the next move? (quote, demo, call back…)"*.
- **"Due today" affordance** on the schedule columns (`app.js:6149`): a scheduled line whose datetime ≤ now gets a **red rivet dot** + hazard-stripe left edge; future = neutral. No new popup — restyle of the existing `hitem`.
- Stamps: reuse existing detail-card rules; the editable `salesAction` needs an `efield` rule stamp (likely existing R for inline fields — confirm against `rule-usage.js`).

### 6.2 Phase-2 surface: the **Round-Up** board (NEW chapter `APP-xx`, NEW popup)

A dedicated pipeline cockpit — the headline deliverable.

- **Layout:** a column board (Kanban) keyed on `funnelStage`, one column per stage (toggle Used-Sales ⇄ Membership funnel). Each card = customer name (PII — gated, §3.2) + stage age + `salesAction` + a **follow-up rivet** (red if overdue). Drag a card between columns = `setFunnelStage` (reuse existing mutation + `logAction`).
- **Top rail = "Round-Up Today":** a hazard-striped header strip listing **follow-ups due today/overdue**, sorted soonest-first — the daily worklist. This is where the area spends its **one bold move** (the hazard stripe + the count stamp).
- **States:** empty = *"Corral's empty — no follow-ups due. Go round up some leads."* (stamped, with the worn-leather-tan saddle-stitch divider). Loading = skeleton rivets. Error = standard offline banner.
- **Mobile reflow:** the 3-column board collapses to a **single scrollable stage list** with a stage-switcher chip row at top (per `mobile-adaptive-design.md` patterns); the Round-Up rail becomes a sticky top sheet. Touch: tap = open customer; long-press = stage menu (reuse the funnel dropdown).
- **Rulebook:** the board is a new card surface → needs `data-r` stamps on its columns, cards, and the stage-move control; the Round-Up rail counts as a new **window/popup** if it opens as an overlay → `WINDOW_CATALOG` entry required.

### 6.3 Phase-3 surface: the **Quote** popup (NEW popup)

- `kind: 'salesQuote'` overlay (catalog it in `WINDOW_CATALOG`, `data-r` on every field/button). Header: stamped *"Quote — {customer}"*, tag *"Sales · quote"*. Body: unit/category picker, ask price (money-tier), optional lines, expiry date, note. Foot: **ignition** orange "Send quote" (the one accent), ghost "Save draft".
- **Margin row** (cost vs ask) renders **only** for manager/admin tier (Q7) — hidden entirely, not just greyed, for the Sales lens.
- Voice: *"Brand the deal"* on accept.

### 6.4 Sales KPI ring (existing — keep, optionally re-source)

The three rings stay (Revenue Goal · Active Customer Rate · Pipeline). Phase 2 makes them honest by feeding **recomputed** `_digest` (§5.2) and replacing the crude `pipeline = (members+leads)/10` count with a real funnel-weighted count (§7.4). No visual change required; ring rendering is shipped (`app.js:7081`).

---

## 7. Business Rules / Derivations / Money

### 7.1 Revenue Goal ring (canon — `app.js:7132–7137`)

```
ym = thisMonth                                  // 'YYYY-MM'
revenue = Σ rentalPrice(r).price  for rentals where r.startDate startsWith ym
revGoal% = clamp( revenue / companyRevenueGoal(), 0..100 )
companyRevenueGoal() = companyCfg().revenueGoal  (>0)  else COMPANY_DEFAULTS.revenueGoal
```

Monthly, resets on the 1st. **Edge cases:** rentals with no rate count as $0 (already true); a Quote-status rental with a start date in-month **does** count its priced value — confirm that's intended (Q10).

### 7.2 Active Customer Rate ring (canon — `app.js:7138–7139`)

```
big       = customers where _digest.totalPaid > 1999
activeRate% = ( big where _digest.activePct > 0 ).length / big.length
```

**Edge:** entirely dependent on `_digest` being current. With the static seed it's frozen — P2's `recomputeDigests` is what makes this real.

### 7.3 Pipeline ring (canon — `app.js:7140–7142`)

```
members  = customers where /Member/.test(accountType) && accountType !== 'Member Incomplete'
leads    = customers where usedSalesStage ∉ { '', 'Inbound Lead', 'N/A' }
pipeline% = clamp( (members + leads) / 10, 0..100 )
```

Live code: `app.js:7140–7142`. The target of **10** is hardcoded. **Edges (all real, confirmed against the source):**
- Counts Membership *via `accountType`*, not `membershipStage` → **under-counts membership-only pipeline** (a customer mid-membership-funnel but not yet `accountType=Member` doesn't register).
- Counts leads *only* off `usedSalesStage`, ignoring `membershipStage` motion entirely.
- **Double-counts** a customer who is both a `Member` *and* a used-sales lead.
- **`Don't Contact` counts as a lead.** The exclusion set is only `{ '', 'Inbound Lead', 'N/A' }`, so a `Don't Contact` customer (explicitly do-not-pursue) inflates the pipeline number. This is almost certainly a bug — surfaced as part of Q11.

P2 should make the target admin-settable (like `companyRevenueGoal`) and decide the corrected counting rule (Q11), including whether `Don't Contact`, `Paid`, and `Signed` (already-closed terminals) belong in "pipeline" at all.

### 7.4 Proposed: days-in-stage / velocity (P2)

```
daysInStage(c, funnel) = today - stageEnteredAt[funnel]   // requires §4.3 field
```

Used to color the Round-Up board (stale leads surface up) and a future "stuck deals" metric. No money; purely derived. Keep inside the KPI allowlist if it ever feeds a ring.

### 7.5 Money-precision rules

Quote money follows the same rounding as invoices (integer cents, no float drift). Used-sale **margin = ask − costBasis**; never shown to Sales lens; never persisted to the public Pages bundle in a way a non-manager request can read (the server strips `costBasis` from non-manager responses — Q7).

---

## 8. Phasing & Milestones

### Phase 1 — Make the existing card work the pipeline (MVP)
**In:** render + edit `salesAction`; "due today" styling on scheduled follow-ups; a saved "Leads due today" View. **Out:** any new board, quoting, campaigns. No backend changes.

### Phase 2 — The Round-Up board + honest rings
**In:** new `APP-xx` Round-Up chapter (Kanban + Round-Up Today rail); `recomputeDigests` action so Active-Rate is real; admin-settable Pipeline target + a corrected counting rule; `stageEnteredAt` velocity coloring. **Out:** quoting, campaigns, referrals.

### Phase 3 — Used-equipment quoting
**In:** `salesQuote` model, the Quote popup, `saveSalesQuote` + `quotePdf` actions, accept→invoice handoff. **Out:** SMS/email send (depends on comms), campaigns.

### Phase 4 — Growth toolkit
**In:** referral graph, outreach/campaign lists, acquisition-vs-retention split. **Heavily** dependent on the Marketing area decision (Q12) and `comms-notifications`.

### Out-of-scope for v1 (all phases)
Telematics, security cameras, QuickBooks reconciliation, automated lead scoring, email deliverability.

---

## 9. Acceptance Criteria

| # | Criterion | CI impact |
|---|---|---|
| AC-1 | `salesAction` is editable in the Customer card and persists across reload. | `ci/logic-test.mjs` add a save/round-trip case. |
| AC-2 | A scheduled follow-up with datetime ≤ now renders the overdue (red rivet) treatment; future ones don't. | `ci/smoke.mjs` (render). |
| AC-3 | Round-Up board lists every customer in the correct funnel column; dragging a card moves the stage AND writes an `activityLog` line (parity with `setFunnelStage`). | `ci/logic-test.mjs` (mutation + log). |
| AC-4 | The Round-Up Today rail shows exactly the follow-ups due ≤ today, sorted soonest-first. | `ci/logic-test.mjs`. |
| AC-5 | Every new popup (Round-Up rail if overlaid, Quote) has a `WINDOW_CATALOG` entry. | **`ci/check-window-catalog.mjs`** must pass. |
| AC-6 | Every new interactive element carries a `data-r` stamp; `rule-usage.js` regenerated. | **`ci/gen-rule-usage.mjs --check`** must pass. |
| AC-7 | New Round-Up chapter banner added → Code-Atlas regenerated. | **`tools/gen-code-map.mjs --check`** must pass. |
| AC-8 | `recomputeDigests` rebuilds `_digest` from rentals/invoices and the Active-Rate ring changes accordingly; re-running is idempotent. | `ci/logic-test.mjs`. |
| AC-9 | No sales ring references a customer field outside `KPI_FIELDS.customers`. | `ci/logic-test.mjs` (allowlist assertion already patterned). |
| AC-10 | The Quote popup hides the margin/`costBasis` row for non-manager tiers. | `ci/logic-test.mjs` (tier gate). |
| AC-11 | Reduced-motion honored; visible focus on board cards; mobile reflow to single-column verified. | `jactec-ui` self-critique + smoke. |

---

## 10. Risks & Edge Cases

- **PII leak via roll-up.** A board that lists customers can expose names/phones to a role that can't open the Customer card. Mitigate: route the board through the same visibility check as the card; never bypass `KPI_FIELDS` for rings. (R: high.)
- **Margin leak.** Used-sale `costBasis`/margin visible to the Sales lens or in the public bundle. Mitigate: server-side strip for non-managers; never embed cost in client-readable seed. (R: high — money gate.)
- **Frozen `_digest`.** Until `recomputeDigests` lands, Active-Rate and Pipeline rings are decorative. Risk: management trusts a stale number. Mitigate: label as seed/estimate until P2; ship recompute early.
- **Double-counting in Pipeline.** Current formula mixes `accountType` members with `usedSalesStage` leads — a member who's also a used-sales lead counts twice. Mitigate: P2 corrected rule (Q11).
- **Funnel ↔ membership contract drift.** `membershipStage` terminal `Signed` is owned by the memberships area and auto-set. Sales UI must **never** let `Signed` be set manually (already enforced `app.js:11502`); a new board's drag must respect the lock. (R: med.)
- **Quote/invoice race.** Accept→invoice could double-spawn an invoice on a flaky network. Mitigate: idempotent server stamp + client guard (same pattern as the monotonic invoice id `app.js:1945`).
- **Offline.** Sales mutations are local-first; a follow-up scheduled offline must survive re-sync. Mitigate: reuse the views/customer sync posture; never lose an `activityLog` line on a failed sync (append-only, re-sent on next write). (R: med.)
- **Multi-user write race.** Two users moving the same customer's funnel stage (or accepting the same quote) can clobber each other on a last-write-wins customer save. Mitigate: stage moves are small + log-stamped so the loser is recoverable from `activityLog`; quote *acceptance* is idempotent server-side on `quoteId` (no double invoice). Full optimistic-locking is out of v1 scope — flag if it bites. (R: med.)
- **`nextFollowUp` cache drift.** If `nextFollowUp` is denormalized (Q4/Q17) but not recomputed on every `Scheduled:` add/edit/consume, the Round-Up board mis-sorts or omits a due follow-up — a silent worklist-integrity bug. Mitigate: recompute the cache in the same code path that writes the `Scheduled:` line, or derive live at render and accept the cost. (R: med — data integrity.)
- **Performance.** The Round-Up board renders all customers; at scale, sort/group must be O(n) over the existing index, not per-card re-scans of `activityLog`. Mitigate: denormalize `nextFollowUp` (§4.3) — but see the cache-drift risk above. (R: med.)

---

## 11. Open Questions

> **Resolved 2026-06-29:** Q1 → D1 (own Sales/Pipeline board, "Round-Up" renamed) · Q12 → D2 (Marketing splits to #19) · Q13/scope → D3 (used-equipment quote tool, send via Mocean comms). Adopted: Q3/Q4/Q5/Q7/Q8/Q9/Q11/Q15/Q16/Q17. See the Decisions block up top.

> Seed open questions: none were captured for this area. The following are generated from the code and surfaced for Jac.

1. **Q1 — Round-Up as a new top-level card vs a Customers sub-view?** A dedicated `APP-xx` Sales/Round-Up chapter (its own nav card) vs a mode inside the Customers card. Trade-off: discoverability + a real home for the Sales role vs nav clutter and overlap with Customers.
2. **Q2 — Funnel for the board: Used-Sales and Membership as one toggle, two boards, or a merged view?** They share the `funnelStage` enum but have different terminals and lock rules.
3. **Q3 — Does Phase 1 ship the `salesAction` UI, or jump straight to the board?** Cheapest win vs "build the real thing once."
4. **Q4 — Should `nextFollowUp` be denormalized/cached, or always derived from `activityLog` at render?** Speed/sort simplicity vs one-more-field to keep consistent.
5. **Q5 — Can a `staff`-tier login (rank 1, no money) reach the Sales surface and see stages + follow-ups but not dollars?** Since `sales`/`office` default to `money` (`config.js:340`), this only bites a *custom/renamed* `staff` login pointed at the Sales lens. Trade-off: letting `staff` work the pipeline (log follow-ups, move stages) widens who can sell vs. risking a thin role seeing the whole customer book. Conservative default: the **board** is `money`+; a `staff` user can still log a follow-up on a Customer card they can already open, but cannot open the cross-customer Round-Up. Confirm.
6. **Q6 — Any new sales ring stays inside `KPI_FIELDS.customers`?** Confirm we never add a name/phone field to a ring even for a "top leads" widget (that widget would have to live behind the card's PII gate, not in a ring).
7. **Q7 — Used-sale margin/`costBasis`: manager/admin-only, server-stripped for the Sales lens?** This is a money-gate decision; defaulting conservative (hidden) until Jac confirms.
8. **Q8 — Should the sales pipeline adopt the prescriptive R/Y/G flag-color system** (`flag-color-system.md`) for "overdue follow-up = red", or keep the descriptive `funnelStage` colors? The flag system is explicitly *prescriptive* ("what do I do now") which matches the Round-Up intent.
9. **Q9 — `salesQuotes` embedded on the Customer vs a top-level `DATA.salesQuotes` tab?** Embedded = simpler, travels with the customer; top-level = easier to list/sort/report across customers and to seam to invoices.
10. **Q10 — Should Quote-status rentals count toward the monthly Revenue Goal?** They have a priced value but aren't booked. Including them inflates the goal; excluding them hides real pipeline value.
11. **Q11 — Pipeline ring rule + target.** Make the target (currently hardcoded `10`) admin-settable like `companyRevenueGoal`? And fix the counting: dedupe members-also-leads, and decide whether `membershipStage` motion (not just `accountType`) counts as pipeline.
12. **Q12 — Does Marketing (#19) stay folded into `sales-growth`?** The branch-map routes "marketing" → here. If campaigns/outreach/referrals live in Sales, Phase 4 grows; if Marketing splits off, Phase 4 moves out and this area stops at quoting.
13. **Q13 — Quote send channel.** Reuse the existing "Text a quote" template path, wait for `comms-notifications`, or PDF-only (Drive link) for v1? PDF-only is the lowest dependency.
14. **Q14 — Conversion/velocity metric ownership.** Does days-in-stage / lead→paid conversion belong here or in `financials-kpi`? (Anchors say Pipeline KPI lives here; the KPI engine lives in financials.)
15. **Q15 — `Don't Contact` (and closed terminals) in the Pipeline count.** Today `Don't Contact` counts as a lead (`app.js:7141` excludes only `''`/`Inbound Lead`/`N/A`), inflating the ring; `Paid`/`Signed` (already closed) arguably shouldn't count as *open* pipeline either. Fix the exclusion set — but decide deliberately: does "pipeline" mean *open opportunities only* (exclude `Don't Contact`, `Paid`, `Signed`) or *total funnel activity*? Trade-off: a tighter set is a truer "what's in play" number but changes the historical ring value Jac may be used to.
16. **Q16 — Should the `acceptSalesQuote`/`saveSalesQuote` server REJECT a smuggled `costBasis` from a sub-manager caller, or silently DROP it?** Reject = loud, surfaces a misbehaving client; drop+log = resilient, never blocks a legitimate save over a stray field. Default in this draft: drop + log, never persist. (Either way `costBasis` is never returned to a sub-manager.)
17. **Q17 — Where does the Round-Up board's "follow-up due today" truth come from — the denormalized `nextFollowUp` or a live scan of `activityLog` `Scheduled:` lines?** Ties to Q4; if `nextFollowUp` is the source it must be recomputed whenever a `Scheduled:` line is added/edited/consumed, or the board lies. Trade-off: caching speed vs. a consistency burden that, if dropped, silently mis-sorts the daily worklist (a data-integrity risk, §10).

---

## 12. Dependencies & Sequencing

| Depends on (roadmap slug) | Why | Must land first? |
|---|---|---|
| `customers-crm` | Hosts every sales control; owns the Customer record + funnels + Activity Log. | **Yes** — it's the substrate (already shipped). |
| `memberships` | Owns `membershipStage` terminal `Signed` (locked, auto-set). Sales must defer to it. | Yes (shipped). |
| `financials-kpi` | Owns the KPI engine, `KPI_FIELDS` allowlist, ring rendering. | Yes (shipped) — the allowlist gates §3.2/§9. |
| `invoicing-payments` | Accept-quote → invoice + payment (P3). | Before Phase 3. |
| `comms-notifications` | Actually sending a quote / follow-up reminder (P3/P4). | Before any send feature. |
| `units-fleet` | For-sale unit data behind used-equipment quotes; `interestedCategoryIds`. | Before Phase 3 quoting on a specific unit. |
| `backend-data` | The `recomputeDigests` / `saveSalesQuote` additive actions + Sheets tabs. | Before Phase 2 recompute. |
| `marketing` (#19) | Campaigns/referrals if it stays folded here (Q12). | Decision before Phase 4. |

**Recommended sequence:** P1 (no deps, pure front-end) → P2 board + `recomputeDigests` (needs `backend-data`) → P3 quoting (needs `invoicing-payments` + `units-fleet`) → P4 growth toolkit (needs the Marketing decision + `comms-notifications`).

---

*End of DRAFT — every numbered decision in §11 is open for Jac. Run all proposed UI through the `jactec-ui` skill (screenshot + self-critique) before build.*
