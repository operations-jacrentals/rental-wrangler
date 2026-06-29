# Marketing — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/marketing`
**Task branch:** `marketing/spec` (proposed)
**Maturity:** greenfield
**Scope:** The demand-generation layer — turn fleet-utilization gaps, customer history, and seasonal demand into bookings via promotions, membership-enrollment drives, targeted outreach lists, and an acquisition-vs-retention measurement split — sitting *above* the Sales pipeline (`sales-growth`), never duplicating it.

---

## ✅ Decisions — 2026-06-29 critique (Jac) — ⚠️ SCOPE EXPANSION

Marketing is now **its own area** (Sales/Growth D2) and **bigger than the draft**: demand-gen core **+ social/ad management + full automation (including auto-published social posts)**. The spec body's internal-demand-gen sections stay, but a **social/ad-management + automation section needs to be built out**.

- **D1 · Scope = demand-gen core + social/ad management + FULL automation (resolves Q1 + scope + Q13).** Beyond the internal core (utilization ranking → target-list → campaign → acquisition/retention split → hand to Sales), Marketing adds: **(a) social/ad management** — track + manage ad campaigns (Google Ads / Meta ad spend → leads, attribution), and **(b) full marketing automation** — campaigns send **automatically via the Mocean `comms-notifications` channel** (SMS/email, respecting consent + quiet hours + the dedup/cost guards) **AND auto-publish social media posts** to the connected platforms. The in-app "hand to Sales" stays as one path, but the north star is **automated outbound + social**.
- **D2 · Marketing login = money-tier, and an OPTIONAL role (resolves Q2/Q3).** The Marketing lens/role carries **money-tier** — it sees dollar revenue-at-risk + resulting promo prices; it still does **NOT** see the `bottomDollar` margin floor (that stays gated). Marketing is an **optional role** — **nothing in the app requires a Marketing role to function.** Gates still compare **tier, never name** (Q2a).
- **D3 · Real automated outbound (resolves Q13; supersedes "in-app handoff only").** Campaigns send for real via **Mocean comms**, and social posts **auto-publish** — not just an in-app handoff. Sequencing: `comms-notifications` (Mocean) is a **prerequisite** for the SMS/email send; the **social-platform + ad-platform integrations are a NEW external-integration layer** (Google Ads, Meta/Facebook, social posting APIs — server-side tokens named-only, additive on `backendCall`).

**Defaults adopted:** Q2a → tier-based gates only · Q6 → no raw PII **CSV** export in v1 (the automated send *is* the egress path now — gated + consent-bound) · Q8 → a campaign is an **advisory offer**, never writes the rental price (real rate changes stay an Office/Admin money-action) · Q9 → `campaigns` as a **top-level entity** · Q15 → acquisition/retention split rides the **`financials-kpi` KPI engine** · Q7a → utilization ranking computed **clear of `categoryStats` dollar/margin fields** · Q14 → idle ranking uses prescriptive hazard-stripe coloring · Q10 → trailing-30d window, count Reserved+On-Rent+Returned, exclude Quote · Q11 → acquisition = first-ever invoice in month · Q12 → membership savings = trailing-actual, modeled fallback.

> **Build-out note:** §4/§5/§6/§7 need a new **social/ad-management + automation** section (ad-platform + social-posting integration contract, an automated-send + auto-post engine with consent/quiet-hours/budget guards, and ad-attribution metrics). Treat that as the expansion this critique authorized.

---

## 1. Goal & Problem

### 1.1 What this area is for

`sales-growth` works the pipeline **one customer at a time** — who do I call next, where are they in the funnel. **Marketing works the yard in aggregate**: which *categories* are idle this month, which *segment* of customers should I push a promotion at, is the business *acquiring* or only *retaining*. Marketing is the layer that decides **"what do we promote, to whom, and is it working?"** and hands Sales a ready-to-work list.

Where Sales answers *"who do I call next?"*, Marketing answers *"who should be on the call list, and why?"*

### 1.2 The business problem

JacRentals is a single-yard independent competing against United Rentals. Every idle day on a machine is sunk margin, and the owner has no surface that says **"the 8k excavators sat 60% idle last month — run a weekend special."** The raw signals all exist but are scattered and non-actionable:

- **Fleet utilization** lives only as ROI / revenue per category (`categoryStats` `app.js:1836`) — there is **no idle-days / time-utilization metric**, so nobody can rank "what's underused right now."
- **Demand interest** is captured per-customer as `interestedCategoryIds[]` (`data.js:60`) but cannot be **pivoted into "all customers interested in CAT008"** without clicking through every record (the Marketing role's literal audit question #2, `role-roles.md:174`).
- **Marketing collateral** (QR codes, banners, logos, member-rate sheet) exists as `companyFiles` rows grouped `'Marketing'` (`data.js:174–179`) but is just a flat file list with a review-by date — not a campaign.
- **Acquisition vs retention** is invisible: the Revenue Goal ring (`app.js:7136`) sums all rental revenue with **no new-vs-repeat split** (the role's audit question #3).
- **Membership value** (the Unlimited-Transport dollar savings a prospect would get) is not quantified anywhere a marketer can show it (audit question #5).

There is no place to **assemble a target list, attach an offer, hand it to Sales, and measure the lift.** That workflow is the entire reason this area exists.

### 1.3 North star

> **The owner opens a Marketing surface, sees a ranked list of underused categories, picks one, gets an auto-built outreach list of customers most likely to rent it, attaches a promo + a piece of collateral, and ships it to the Sales round-up — then watches an Acquisition-vs-Retention split show whether it worked.**

### 1.4 Voice

The ranch seasoning fits, used sparingly and only in copy: *"Round up a list", "Corral the slow movers", "Drive the herd" (enrollment drive), "Brand the offer"*. Keep it a seasoning — the surface still reads as an industrial rental yard first.

---

## 2. Current State (Baseline)

Marketing is **greenfield** — there is **no dedicated feature, no chapter, no board, no role-scoped surface**. The branch-map currently routes the keyword "marketing" → `area/sales-growth` (`branch-map.md:27`). What exists is adjacent substrate Marketing must build *on*, not reinvent.

### 2.1 What exists today (adjacent substrate — anchors)

| Capability | Status | Anchor | Relevance to Marketing |
|---|---|---|---|
| `companyFiles` rows, `group: 'Marketing'` (QR codes, banner, logos, member-rate sheet) | **SHIPPED** | `data.js:174–179`; board render `app.js:11169`; `reviewState()` `app.js:11148` | The collateral library. Today it's a flat back-office board, not a campaign tool. |
| `companyFileType` registry (Document/Photo/Link/Note) | **SHIPPED** | `config.js:175` | Type pills for collateral. |
| Back-office board host (Parts/Vendors/Expenses/**Files**) | **SHIPPED** | `boardRows()` `app.js:11149`, `kind:'board'` `WINDOW_CATALOG` `app.js:9811` | The existing popup that lists `companyFiles`. |
| `interestedCategoryIds[]` per customer | **SHIPPED** | `data.js:60`; `addInterestedCategory` `app.js:11517` | The demand-interest signal Marketing pivots into target lists. |
| Dual funnels (`usedSalesStage`, `membershipStage`) | **SHIPPED** | `config.js:134`; pills `app.js:11490` | Read-only inputs to segmentation; **owned by `sales-growth`**. |
| `activityLog[]` + `salesAction` | **SHIPPED / PARTIAL** | `app.js:6139`, `data.js:60` | Where a Marketing outreach action lands once handed to Sales. |
| Sales KPI ring (Revenue Goal · Active Rate · Pipeline) | **SHIPPED but thin** | `legacyKpiPct('sales')` `app.js:7132–7143` | Revenue goal has **no acquisition/retention split** — a Marketing gap. |
| `categoryStats(cat)` → count/ROI/avgRev/avgExp | **SHIPPED** | `app.js:1836–1862` | Per-category economics — but **NO time-utilization / idle-days field**. |
| `_digest{}` per customer (totalPaid/visits/activePct/first-last invoice) | **SHIPPED (seed)** | `data.js:59`; rings `app.js:7138` | Retention/recency signal for segmentation; currently frozen seed (recompute is a `sales-growth`/`customers-crm` gap). |
| KPI metric engine (DSL, allowlisted fields) | **SHIPPED** | `KPI_ENTITY`/`KPI_FIELDS` `app.js:7174+/7265` | Any Marketing ring must ride this, not bespoke math. |
| Marketing role persona (view-only authority, must-not-see list, 6 audit questions) | **SHIPPED (doc only)** | `role-roles.md:159–178` | The authority + PII contract this spec must honor. No code role maps to it: `ROLES` (`config.js:301`) holds 5 ring-lenses (mechanic/mtech/driver/office/sales), and gates key off `ROLE_TIERS` (`config.js:328`), not role names — see §3.1. |
| Role/tier decoupling (gates compare tiers, not names) | **SHIPPED** | `ROLE_TIERS` + `tierRank` `config.js:328–360` | Every Marketing money/PII gate must compare `tierRank()`, never a role string. |

### 2.2 What is explicitly MISSING (the greenfield)

- **No fleet-utilization ranking.** `categoryStats` computes ROI/revenue but **no idle-days or time-utilization %**. There is nothing that ranks categories by "how underused right now" (Phase-1 keystone).
- **No interest pivot / target-list builder.** No way to query "all customers interested in CAT008" or "all non-members who rented ≥3× this year" and produce a contact list.
- **No campaign object.** No promotion/offer/campaign entity; `companyFiles` is just files.
- **No outreach handoff.** No mechanism to push a built list into the Sales round-up (`salesAction` / `Scheduled:` log lines).
- **No acquisition-vs-retention metric.** Revenue Goal ring is one undifferentiated sum.
- **No membership-savings calculator** surfaced for a prospect conversation.
- **No Marketing role code mapping.** The persona exists in `role-roles.md` only; the 5 built-in `ROLES` (`config.js:301`) don't include a `marketing` ring lens, and no login is tier-mapped to "Marketing = `staff`-with-Marketing-rings". (Note: adding a ROLE alone grants no power — the gate is the **tier** assigned to the login; §3.1.)

### 2.3 Adjacency / ownership boundary with `sales-growth`

This is the single most important boundary in the spec. **Marketing must not re-build the pipeline.** Concretely:

| Concern | Owner | Marketing does |
|---|---|---|
| Funnel stage pills, drag-to-move, `setFunnelStage` | `sales-growth` (`app.js:11490+`) | Reads stages for segmentation; **never** mutates a stage. |
| The Round-Up pipeline board (proposed in `sales-growth` §6.2) | `sales-growth` | **Feeds** it a target list; does not own it. |
| `salesAction` / follow-up scheduling | `sales-growth` | Writes a *campaign-tagged* action onto the customer that Sales then works. |
| Sales/Revenue/Pipeline rings | `financials-kpi` engine, surfaced in Sales lens | Marketing adds **new** rings (utilization, acquisition split) inside the KPI allowlist. |
| Quoting | `sales-growth` Phase 3 | Out of scope for Marketing. |

> **Open structural question (Q1):** does Marketing stay folded into `sales-growth` (the branch-map's current routing) or split into its own `area/marketing` with its own surface? This spec is written as a **separable area** but every phase is designed to degrade gracefully into a `sales-growth` sub-tab if Jac folds it.

---

## 3. Users, Roles & Data Gates

### 3.1 The role/tier model (read this first — it changes how the gate works)

**Permissions no longer key off role NAMES.** The 2026-06-26 role-system redesign (`config.js` `ROLE_TIERS` comment) **decoupled** the two axes:

- **`ROLES`** (`config.js:301` — `mechanic, mtech, driver, office, sales`) are now only a **KPI-ring/dashboard lens** (which three rings you see) and are **user-customizable** (add/rename in Settings → Roles & Logins). There is **no `marketing` role today** and there are **5**, not 15, built-in ROLES.
- **`ROLE_TIERS`** (`config.js:328` — `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`, strict-superset ladder) is what **every gate compares against** via `tierRank()`. A custom role carries exactly **one** tier.

This matters for Marketing two ways:

1. **A "Marketing lens" is a ROLES entry** (gives it the utilization / acquisition rings) — but it grants **no power on its own**; its actual authority comes from **the TIER assigned to that login**. So "add a Marketing lens" (a ring set) and "gate the money columns" (a tier comparison) are **two separate decisions** — see **Q2** (lens) and **Q3** (tier).
2. The **15 logins** map onto these 5 ROLES × 5 TIERS. The `role-roles.md` "Marketing (Growth)" entry (`role-roles.md:159`) is a **persona doc**, not a code role — it describes a login that should carry **`staff`-tier-with-a-Marketing-ring**, deliberately **below `money`** so it can't see margin/floor.

### 3.2 Authority matrix (from the `role-roles.md:159` persona, mapped to tiers)

| Who | ROLES lens | TIER (proposed) | Touch | Authority |
|---|---|---|---|---|
| **Marketing** | new `marketing` ring set (Q2) | **`staff`** (no money) | Primary | **View-only** over all customer records, rental history, funnel stages, category/unit utilization. **Operational-edit** over funnel pills (`setFunnelStage` `app.js:11499`), Activity Log actions, Schedule entries, interested-categories (`addInterestedCategory` `app.js:11517`). **No financial authority** — cannot edit rates, discounts, invoices, payments, or category pricing. Cannot change rental status or approve card overrides. |
| **Owner / Admin** | any lens | **`admin`+** | Oversight | Sets the goal, sees the acquisition/retention split **with** the dollar/margin columns, edits category pricing (the only place a promo becomes a real rate). |
| **Manager** | any | **`manager`** | Oversight | Approves; sees money columns (≥`money`). |
| **Sales / Office** | `sales` / `office` | typically **`money`** | Consumer | Receives the outreach list into the round-up; works the leads; sees the resulting $ (they're `money`-tier). |
| **`money`-tier+** | — | ≥`money` | Pricing | Gate to see any **dollar** offer value / resulting price / promo margin math (§3.4). |
| **`staff`-tier** (incl. Marketing) | — | `staff` | — | Sees **operational** utilization bars + segment **counts** but **no dollar column** (Q3, conservative default). |

> **Why tier, not name:** gating Marketing by checking `roleId === 'marketing'` would be wrong and brittle — a custom-renamed role or a Marketing login bumped to `money` must behave correctly. **Every money/PII gate below compares `tierRank(currentTier)`**, never a role string. **Q2a.**

### 3.3 Customer-isolation & PII

Marketing's whole job touches customer lists, so this is the sharpest gate. From the role's **must-NOT-see** list (`role-roles.md:164`):

- ❌ Individual payment-method details beyond brand/last4; ❌ full Stripe `stripePmId`/`stripeId` (real fields on the customer record, `data.js:62`); ❌ per-invoice line-item pricing (only aggregate revenue); ❌ WO/parts/labor internals; ❌ Mechanic/Driver/M.Tech KPIs; ❌ GPS placement/status; ❌ admin override / card-override logs.

**Gate rules this spec adopts (conservative, all tier-based):**

1. **Target lists carry name/phone/email — these are PII.** Any list builder MUST render the named rows behind the **same visibility check the Customer card already enforces**; it must never become a backdoor that shows contact PII to a tier that can't open the customer (mirrors `sales-growth.md` §3.2). The **count** is non-PII (a scalar) and may render to `staff`; the **named rows** require the card gate. **Q4.**
2. **Aggregate rings stay inside the KPI allowlist.** Verified against code: `KPI_FIELDS.customers = ['accountType','usedSalesStage','membershipStage','industry','_totalPaid','_activePct']` (`app.js:7265`) — **no name/phone/email/address/stripeId/idNumber**, and the allowlist is enforced by `wrValidateKpiSource` (`app.js:7267`) which rejects any `where`/`sum` field outside it. Any new Marketing ring (utilization, acquisition split, membership-drive progress) MUST stay inside it. A "top prospects" widget that names customers is **NOT a ring** — it lives behind the card's PII gate. **Q5.**
3. **`stripePmId`/`stripeId` never enter a Marketing surface.** These live on the customer record (`data.js:62`) and on `customer.cards[].stripePmId`; no Marketing list, ring, campaign `audienceSnapshot`, or export may carry them. The `audienceSnapshot` stores **customer IDs only** (`['C0009','C0033']`), never contact fields — re-resolve name/phone through the gated card at render time.
4. **Export gate.** A "export contact list to CSV / clipboard / push to outreach" action moves PII *out* of the app. This is the highest-risk action in the area and MUST be gated. Surfaced as **Q6**, defaulted CLOSED (no raw export in v1; in-app handoff only). If ever opened, gate at **`manager`+** (the same tier that approves overrides), never `staff`.

### 3.4 Money / pricing-floor gating

- **Promo discount math is money.** A campaign that says "15% off weekend light-tower rentals" computes a discounted dollar figure. The **discount %** (a marketing lever) may be visible to the Marketing (`staff`) lens, but the **resulting price** and the **margin impact** are `money`-tier+ and MUST NOT render the floor (`bottomDollar`, a real per-category field consumed by `categoryStats` `app.js:1853`) to a sub-`money` request. **Q7.**
- **`bottomDollar` is the margin floor and is category-level.** `categoryStats` already mixes `cat.bottomDollar` into its ROI math (`app.js:1853`); Marketing reuses `categoryStats` for the utilization board **only for the count/idle fields it returns** — it must **not** surface the `roi`/`avgRevUnit`/`avgExpUnit` dollar fields to a `staff` Marketing request. Either compute `utilStats` independently of `categoryStats` (preferred — see §7.1), or tier-strip the dollar fields. **Q7a.**
- **Marketing cannot apply pricing.** Per the role contract, Marketing **cannot edit rates or category pricing** (backend-only). A campaign therefore produces a **recommendation/offer artifact**, not a live price change — the actual rate adjustment, if any, is an Office/Admin (`money`/`admin`) money-action downstream. **This spec treats promo pricing as advisory metadata, never a write to the rental price formula (`rentalPrice` `app.js`).** **Q8.**
- **Membership-savings figure.** The Unlimited-Transport dollar savings (audit q#5) is a *positive* sell number, not a margin floor — safe for the Marketing lens to see and show a prospect. Cite the real economics function (§7.4).

> **Gate posture for this draft:** conservative. Every non-obvious gate is an Open Question, defaulted to the tighter option.

---

## 4. Data Model

Everything is **additive** on the schema-less store (`m()`-wrapped records, persisted via `PERSIST_KEYS` `app.js:15638`). Absent field = falsy/default → **no migration pass** required (same posture as `_digest`).

### 4.1 Existing fields read by Marketing (no change)

| Field | On | Source | Marketing use |
|---|---|---|---|
| `interestedCategoryIds[]` | Customer | `addInterestedCategory` | Pivot → "interested in CAT008" target list. |
| `usedSalesStage` / `membershipStage` | Customer | funnel | Segment filters (e.g. non-members, stalled leads). |
| `accountType` | Customer | onboarding | Member vs Non-Business vs Business segmentation. |
| `_digest{}` (totalPaid, visits, activePct, firstInvoice, lastInvoice) | Customer | seed/derived | Recency / value / new-vs-repeat segmentation. |
| `industry` | Customer | onboarding | Industry-segment campaigns. |
| `companyFiles` (`group:'Marketing'`) | top-level | `data.js:174` | Collateral attached to a campaign. |
| `categoryStats(cat)` (count/ROI/avgRev) | derived | `app.js:1836` | Per-category economics for the utilization board. |

### 4.2 Proposed additive fields & entities

| Entity / field | Shape | Where | Purpose | Phase |
|---|---|---|---|---|
| **`utilStats` (derived)** | `{ categoryId, idleDays30, timeUtilPct, lastRentedOn }` | computed in `app.js`, NOT stored | Per-category time-utilization ranking. Derived from rentals+units, not persisted. | P1 |
| `companyFile.campaignTags[]` | `string[]` | `companyFiles` | Tag collateral to a campaign (additive on existing files). | P2 |
| **`campaign`** (new top-level `DATA.campaigns`) | see §4.3 | new Sheets tab | The promotion/offer object. | P2 |
| `customer.campaignTouches[]` | `[{ campaignId, when, channel }]` | Customer | Which campaigns a customer was targeted by (for de-dup + lift measurement). | P2 |
| `customer._acqType` (derived) | `'new' | 'repeat'` | derived | First-invoice in current period vs prior → acquisition split. | P3 |

### 4.3 Proposed `campaign` shape (Phase 2 — needs Jac sign-off)

```js
{
  id: 'CMP-0001',                  // monotonic, like invoice ids (app.js:1945 pattern)
  name: 'Weekend Light-Tower Special',
  status: 'Draft'|'Active'|'Sent'|'Closed',
  goal: 'utilization'|'enrollment'|'acquisition'|'retention',
  targetCategoryIds: ['CAT001'],   // categories being promoted
  segment: {                       // the audience filter, stored as a saved query
    interestedIn: ['CAT001'],
    accountTypeIn: ['Non-Business','Business'],
    nonMembersOnly: true,
    minVisits: 1, maxActivePct: 60, // "lapsing" target
  },
  offer: {                         // ADVISORY metadata, never a live price write (§3.4)
    kind: 'percent'|'flat'|'membership-trial'|'none',
    value: 15,                     // money-tier sees resulting $; Marketing sees the %
    blurb: '15% off weekend rentals through July',
  },
  collateralFileIds: ['F001'],     // companyFiles attached
  createdAt: ISO, sentAt: ISO,
  audienceSnapshot: ['C0009','C0033'], // customer ids targeted at send time (lift baseline)
}
```

**Where it lives.** Top-level `DATA.campaigns` (new Sheets tab + `PERSIST_KEYS`/`PERSIST_ID`/`IDX_MAP` additions) rather than embedded — campaigns are cross-customer and need their own list/report surface. Trade-off in **Q9**.

### 4.4 Relationships (by ID)

```
Campaign ──< targetCategoryIds ──> Category
Campaign ──< collateralFileIds ──> companyFile (group:'Marketing')
Campaign ──< audienceSnapshot ──> Customer
Customer ──< campaignTouches ──> Campaign            [de-dup + lift]
Customer ──< interestedCategoryIds ──> Category      [segmentation input]
Campaign ──(handoff)──> salesAction / Scheduled: log on Customer   [sales-growth owns the action]
```

### 4.5 Migration concerns

- All fields additive; absent = default. No backfill needed.
- New `DATA.campaigns` tab: add to `PERSIST_KEYS` (`app.js:15638`), `PERSIST_ID` (`campaigns:'id'`), `IDX_MAP` (`campaigns:'campaign'`), and the `boardRows`/index init (`app.js:693,709`). This is a `backend-data` touch (§5).
- `companyFile.campaignTags[]` is additive on existing `companyFiles` rows — no migration.

---

## 5. Backend / Integration Contract

Backend = **Google Apps Script + schema-less Google Sheets**, single `backendCall(action, payload)` entry point (`Code.gs` gitignored; **additive actions only**). Front end mutates `DATA`, renders, then syncs (local-first; on failure, keep local + re-sync next online write — same posture as `pushViewsToBackend` `app.js:11555`).

**Auth model (important for the gates).** The backend authenticates with a **single shared password** sent on every call (`backendPassword`, `app.js:15640`) — there is **no per-user identity at the Sheets layer**, so the server **cannot** enforce per-tier visibility by itself. Consequence for Marketing: the **money/PII gates are front-end-enforced** (the `staff`-context render simply must not request or display a `bottomDollar`-derived figure), and the backend's job is the **narrower** one of (a) not *persisting* a client-supplied margin field and (b) not *echoing* cost fields it doesn't need to. This is a known limitation of the model — it is why §3.4 insists money figures be **computed client-side from already-gated inputs**, not round-tripped through a server that can't tell who's asking. **Q7b** raises whether any Marketing money figure should exist client-side at all.

### 5.1 Existing actions reused

| Action | Use here |
|---|---|
| customer save (existing) | Persists `campaignTouches[]`, and the Sales handoff (`salesAction` / `activityLog` line). |
| companyFiles save (existing persist path) | Persists `campaignTags[]` on collateral. |
| `getViews`/`setViews` (`app.js:11553/11557`) | A saved Marketing segment (e.g. "lapsing CAT008 renters") persists company-wide like any saved view. |

### 5.2 Proposed additive actions

| Action | Payload | Returns | Phase | Notes |
|---|---|---|---|---|
| `saveCampaign` | `campaign` (server strips margin/cost fields for sub-`money` callers) | `{ ok, id }` | P2 | Additive; server stamps `id` if absent. New `campaigns` tab. Server must **reject** any inbound `offer` field carrying a `bottomDollar`/cost figure from a `staff`-context save (don't persist client-supplied margin). |
| `listCampaigns` | `{}` | `{ ok, campaigns:[] }` | P2 | Or rides the existing full-sync; standalone for report surface. |
| `recomputeDigests` (shared w/ `sales-growth`) | `{}` or `{customerId}` | `{ ok, updated }` | P1-dep | **NOT owned here** — Marketing's acquisition/retention split is only honest once `_digest` is recomputed (the `customers-crm`/`sales-growth` gap). Marketing **depends on** this, doesn't build it. |
| `pushToOutreach` | `{ campaignId }` | `{ ok, touched:n }` | P2 | Writes a campaign-tagged `salesAction` + `Scheduled:` line onto each audience customer (the Sales handoff). Idempotent per `(campaignId, customerId)` via `campaignTouches`. |

### 5.3 External integrations

| Integration | Use | Status |
|---|---|---|
| **SMS / Email** | Actually *send* a promo / enrollment drive to the audience. | **OUT of v1.** Owned by `comms-notifications` (currently 🟡 partial). v1 hands off **in-app** to the Sales round-up only; no outbound send. |
| **Google Drive (Drive-offload pattern)** | Host collateral (QR/banner/logo PDFs) — already the `companyFiles` link model + the photo-offload pattern. | Reuse existing; no new integration. |
| **QuickBooks** | Revenue reconciliation behind acquisition split. | OUT — `accounting` area. |
| **Telematics / cameras** | n/a to Marketing. | OUT. |

**Failure handling.** `pushToOutreach` must be **idempotent** — re-running a campaign must not double-stack `salesAction` lines (guard on `campaignTouches` containing `campaignId`). `saveCampaign` must never accept or echo a margin/cost field from a sub-`money`-tier caller (server-side strip, §3.4). All money math stays server-or-`money`-tier-gated; the public Pages bundle must never carry a `bottomDollar`-derived figure readable by a `staff`-tier (Marketing-lens) request. **The server cannot trust the client's claimed tier** — it must re-derive the caller's tier from the authenticated login (the shared-password model means the *front end* enforces visibility, so a `bottomDollar`-derived value must simply **never be sent down** in a `staff`-context response, not merely hidden in the DOM). **Q7b.**

---

## 6. UX / UI

All new UI in the **yard data-plate** language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), corner **rivets**, **Saira Condensed** stamped uppercase labels (~2px tracking), exactly **one** safety-orange accent (`--accent #ff7a1a`) on the primary/ignition action, the **hazard stripe** as the signature surface, worn-leather-tan saddle-stitch dividers as the occasional ranch touch, copy carrying the seasoning. Every interactive element gets a `data-r="Rxx"` stamp (`ci/gen-rule-usage.mjs --check` gate); every new popup gets a `WINDOW_CATALOG` entry (`ci/check-window-catalog.mjs` gate) **and** a `data-r` stamp. A new card chapter gets an `APP-xx` banner → regenerate the Code-Atlas (`tools/gen-code-map.mjs`). **Run every screen through the `jactec-ui` skill (plan tokens → build → screenshot → self-critique) before showing Jac.**

### 6.1 Phase-1 surface: the **Utilization Round-Up** (the keystone, NEW)

The cheapest real win and the role's #1 audit question: *"tell me which categories are underused right now, as a ranked fleet list."*

- **Form:** a ranked panel — one stamped row per category, sorted by `timeUtilPct` ascending (most idle first). Each row: category name (Tabler backhoe glyph), a **utilization bar** (the bold move — hazard-stripe fill where the bar is *empty/idle*, so idle reads as hi-vis caution), `idleDays30`, last-rented date, and a stamped **"Promote"** ignition button (orange) that seeds a campaign (P2) or, in P1, just opens the interested-customer list (§6.2).
- **Empty/loading/error:** empty = *"Every machine earned its keep this month. Nothing to round up."* (saddle-stitch divider). Loading = skeleton rivets. Error = standard offline banner.
- **Money gate:** the bar + idle counts are **operational, not money** → visible to Marketing/staff. Any **$ revenue-at-risk** column is money-tier+ (Q3/Q7).
- **Surface placement (Q1):** its own nav card/chapter `APP-xx` vs a tab inside an existing card. If it's an overlay → `WINDOW_CATALOG` entry + `data-r` stamps on rows, bar, and Promote button.
- **Mobile:** single scrollable list, bar full-width, Promote as a bottom-sheet action (per `mobile-adaptive-design.md`).

### 6.2 Phase-1/2 surface: the **Target-List builder** (NEW popup)

Pivots `interestedCategoryIds` + segment filters into a contact list (audience q#2).

- **`kind:'targetList'` overlay** (`WINDOW_CATALOG` entry, `data-r` on every control). Header: stamped *"Round up a list"*, tag *"Marketing · audience"*. Body: filter chips (interested-in category, account type, members/non-members, min visits, max active%), live count, then the **gated list** of matching customers (name + phone — **PII, rendered only behind the customer-card visibility check, §3.3**).
- **Foot:** ignition **"Hand to Sales"** (orange) → `pushToOutreach` (P2) writing a campaign-tagged action; ghost **"Save as View"** (reuses `setViews`).
- **No raw CSV export in v1** (Q6) — in-app handoff only.
- **Empty state:** *"No hands match that filter. Loosen the corral."*

### 6.3 Phase-2 surface: the **Campaign** card/popup (NEW)

- **`kind:'campaign'` overlay** (catalog + stamps). Build/edit a `campaign` (§4.3): name, goal, target categories, the §6.2 segment, an **offer** block (kind + value + blurb — **the resulting $ and any margin hidden from Marketing lens, Q7**), and **collateral attach** (multiselect over `companyFiles` where `group:'Marketing'`). Status pill (Draft/Active/Sent/Closed) reuses the registry pattern.
- **Collateral panel** reuses the existing files board row style (`app.js:11169`) but filtered to Marketing collateral, with an "attach to campaign" toggle.
- **Foot:** ignition **"Ship it"** → `saveCampaign` + `pushToOutreach`.

### 6.4 Phase-3 surface: **Membership-Drive** + **Acquisition/Retention** widgets

- **Membership-savings calculator** (audit q#5): a small stamped readout inside the customer card or campaign builder showing the prospect's projected Unlimited-Transport savings (§7.4). Operational/positive number — Marketing-visible.
- **Acquisition vs Retention split**: a new KPI ring (or a two-segment bar on the existing Revenue Goal ring) splitting the month's revenue into **new-customer** vs **repeat** (§7.3). Must stay inside `KPI_FIELDS` (no names) → it's a count/sum ring, not a list.

### 6.5 R-rulebook / WINDOW_CATALOG summary

| New element | data-r | WINDOW_CATALOG |
|---|---|---|
| Utilization Round-Up rows / bar / Promote btn | new stamps | entry if it opens as overlay |
| Target-List builder | stamps on all controls | **`kind:'targetList'`** |
| Campaign builder | stamps on all controls | **`kind:'campaign'`** |
| Membership-savings readout | stamp | none (inline) |
| Acquisition/Retention ring | stamp | none (ring) |

---

## 7. Business Rules / Derivations / Money

### 7.1 Time-utilization (NEW — the Phase-1 formula)

`categoryStats` (`app.js:1836`) gives ROI/revenue but **no time utilization**. Propose, computed at render (not stored):

```
For a category over a trailing window W (default 30 days, admin-settable later):
  unitDaysAvailable = (# active units in category) × W
  unitDaysRented    = Σ over rentals of that category, overlapping W,
                      of (min(end, windowEnd) − max(start, windowStart) + 1) days
  timeUtilPct  = clamp( unitDaysRented / unitDaysAvailable , 0..100 )
  idleDays30   = unitDaysAvailable − unitDaysRented        // aggregate idle machine-days
  lastRentedOn = max endDate among the category's rentals
```

- **Active units only** in the denominator (exclude Sold/For Sale/Inactive — mirror the Ready-Rate eligibility convention `app.js:7153`).
- **Edge:** a category with zero active units → `timeUtilPct = —` (guard like the ROI `trueCost` guard `app.js:1852`), not a divide-by-zero.
- **Edge:** overlapping/multi-unit rentals counted per unit-day, not per rental (so a multi-unit event `R-MU` counts both machines). **Q10** — confirm the window length (30d) and whether quotes/reserved-future count.

### 7.2 Segment counts (target list)

```
audience(seg) = customers where
   (seg.interestedIn ⊆ interestedCategoryIds)  if set
 ∧ (accountType ∈ seg.accountTypeIn)            if set
 ∧ (seg.nonMembersOnly ⇒ ¬/Member/.test(accountType))
 ∧ (_digest.visits ≥ seg.minVisits)            if set
 ∧ (_digest.activePct ≤ seg.maxActivePct)       if set    // "lapsing" target
```

Pure read over the customer index; O(n). No money. Honors PII gate on the *rendered* list, not the *count*.

### 7.3 Acquisition vs Retention split (NEW)

```
ym = thisMonth
periodRevenue = Σ rentalPrice(r).price for rentals starting in ym     // mirrors Revenue Goal (app.js:7136)
newCust    = customers whose _digest.firstInvoice falls in ym (or no prior invoice)
acqRevenue = Σ that revenue attributable to newCust
retRevenue = periodRevenue − acqRevenue
acqPct = acqRevenue / periodRevenue
```

- Reuses the **same** monthly window + `rentalPrice` as the shipped Revenue Goal ring (§7.1 of `sales-growth`) — do **not** invent a parallel revenue number.
- **Depends on a real `_digest.firstInvoice`** → honest only after `recomputeDigests` (§5.2). Until then label as estimate.
- Stays inside `KPI_FIELDS` (uses `_totalPaid`/derived counts, no names). **Q11** — split on `firstInvoice` (first-ever) vs "first in N months" (reactivation)?

### 7.4 Membership-savings figure (positive sell number)

The Unlimited-Transport entitlement (`unlimitedTransport`, real field on `data.js:65`; see also `paidFees`/`paidCadence` on member records) waives per-trip transport cost. The membership economics already have a **real engine** — reuse it, don't invent: `membershipEconomics`, `membershipFee`, `membershipFeeRevenue`, `membershipPricing` are all exported from `app.js` (`app.js:16399` export bundle). The savings a prospect would see:

```
projectedSavings = (customer's trailing transport spend over the entitlement period)
                 − membershipFee(cadence)          // the real fee, from membershipEconomics/membershipFee
```

- **Use the existing `membershipEconomics`/`membershipFee` functions for the fee side** — never hard-code a member fee in the Marketing surface (it would drift from the real pricing). The transport-spend side is the drive-time/city-lookup pricing owned by `maps-location` — Marketing **reads** it, never recomputes the floor.
- Surfaced as a **positive** number to motivate enrollment. **Not** a margin floor → Marketing-safe (audit q#5).
- **Q12** — use trailing actual transport spend (honest per customer, but **zero for a brand-new prospect** with no history), or a modeled "avg member trips × avg leg cost" (gives every prospect a number, less precise)? Default: trailing-actual, fall back to modeled when no history.

### 7.5 Money-precision & gate rules

- Promo `offer.value` as a **percent** is a marketing lever (Marketing/`staff`-visible). The **resulting price** and any **margin** are `money`-tier+ and server-stripped for the Marketing lens (§3.4, §5.3).
- A campaign **never writes the rental price formula** — offers are advisory metadata; any real rate change is an Office/Admin money-action downstream (§3.4, Q8).

---

## 8. Phasing & Milestones

### Phase 1 — See the idle yard (MVP, near-zero backend)
**In:** the Utilization Round-Up ranking (§6.1, derived `utilStats`); the Target-List builder read-only with "Save as View" (§6.2, reuses `setViews`); the Acquisition/Retention split ring (§7.3, front-end only, honest once `_digest` recompute lands). **Out:** the `campaign` object, outreach handoff, any send. **Backend:** none new (rides existing views save; depends on the shared `recomputeDigests` for honest numbers).

### Phase 2 — Run a campaign
**In:** `DATA.campaigns` tab + `saveCampaign`/`listCampaigns`; the Campaign builder (§6.3) with collateral attach (`campaignTags`); `pushToOutreach` handoff into the Sales round-up; `campaignTouches` de-dup. **Out:** outbound SMS/email send.

### Phase 3 — Measure & enroll
**In:** membership-drive flow + savings calculator (§7.4); campaign-lift reporting (compare `audienceSnapshot` rentals before/after); acquisition split made fully honest. **Out:** automated lead scoring.

### Phase 4 — Real outbound (heavily dependent)
**In:** actual SMS/email campaign send via `comms-notifications`; deliverability/opt-out; channel attribution. **Gated on** `comms-notifications` shipping outbound.

### Out-of-scope for v1 (all phases)
Outbound email/SMS deliverability, automated lead scoring, A/B testing, QuickBooks reconciliation, raw PII CSV export (Q6), any write to category/rental pricing.

---

## 9. Acceptance Criteria

| # | Criterion | CI impact |
|---|---|---|
| AC-1 | Utilization Round-Up lists every category ranked by `timeUtilPct` ascending; a zero-active-unit category reads `—`, not a divide error. | `ci/logic-test.mjs` (formula + guard). |
| AC-2 | `timeUtilPct` / `idleDays30` correctly count multi-unit rentals per unit-day (R-MU counts both machines). | `ci/logic-test.mjs`. |
| AC-3 | Target-List builder returns exactly the customers matching the segment filter; the *count* is visible but the *named list* renders only behind the customer-card visibility gate. | `ci/logic-test.mjs` (filter) + `jactec-ui` gate review. |
| AC-4 | Acquisition/Retention split sums to the same monthly revenue as the shipped Revenue Goal ring (no parallel revenue number). | `ci/logic-test.mjs`. |
| AC-5 | No Marketing ring references a customer field outside `KPI_FIELDS.customers`. | `ci/logic-test.mjs` (allowlist assertion already patterned). |
| AC-6 | Money/PII gates compare `tierRank()` (not a role-name string); a `staff`-tier render path never computes a `bottomDollar`-derived figure; `saveCampaign` from a sub-`money` caller never persists/echoes `offer` margin/cost. | `ci/logic-test.mjs` (tier compare + strip). |
| AC-7 | `pushToOutreach` is idempotent — re-running a campaign does not double-stack `salesAction`/log lines (guarded by `campaignTouches`). | `ci/logic-test.mjs`. |
| AC-8 | Every new popup (Target-List, Campaign) has a `WINDOW_CATALOG` entry. | **`ci/check-window-catalog.mjs`** must pass. |
| AC-9 | Every new interactive element carries a `data-r` stamp; `rule-usage.js` regenerated. | **`ci/gen-rule-usage.mjs --check`** must pass. |
| AC-10 | New Utilization Round-Up chapter banner added → Code-Atlas regenerated. | **`tools/gen-code-map.mjs --check`** must pass. |
| AC-11 | New `campaigns` tab wired into `PERSIST_KEYS`/`PERSIST_ID`/`IDX_MAP`; round-trips a campaign across reload. | `ci/smoke.mjs` + `ci/logic-test.mjs`. |
| AC-12 | Marketing never writes a funnel stage or a rental price; the handoff only writes a `salesAction`/`Scheduled:` line. | `ci/logic-test.mjs` (no `setFunnelStage`/price write from Marketing path). |
| AC-13 | Reduced-motion honored; visible focus on round-up rows + builder; mobile reflow to single-column verified. | `jactec-ui` self-critique + smoke. |

---

## 10. Risks & Edge Cases

- **PII leak via list builder (HIGH).** A target list naming customers is the single biggest risk — it could expose contact PII to a role that can't open the customer card. Mitigate: render the named list strictly behind the customer-card visibility check; keep rings name-free; no raw export in v1.
- **Margin/price leak (HIGH — money gate).** Promo offer math could expose `bottomDollar`/margin to a `staff`-tier Marketing render or the public Pages bundle. Mitigate: percent-only to `staff`; build $ columns only in a `money`+ render path (Q7b); never embed a margin-derived figure in the client-readable seed; compute `utilStats` clear of `categoryStats`'s dollar fields (Q7a).
- **Scope creep into `sales-growth` (HIGH — architecture).** Marketing could accidentally re-build the funnel board or mutate stages. Mitigate: hard boundary (§2.3); AC-12; Marketing reads stages, writes only the `salesAction` handoff.
- **Stale `_digest` poisons acquisition split (MED).** Until `recomputeDigests` lands, the new-vs-repeat split and `maxActivePct` segment are decorative. Mitigate: label as estimate; depend on the shared recompute; ship the utilization ranking (which doesn't need `_digest`) first.
- **Utilization double-count / window bugs (MED).** Per-unit-day overlap math is easy to get wrong with multi-unit + extended rentals. Mitigate: AC-2 fixture on `R-MU`; clamp at 100%.
- **Outreach double-stack (MED).** Re-running a campaign spamming the same customer's log. Mitigate: idempotent `pushToOutreach` keyed on `campaignTouches`.
- **Role-lens absent / wrong-axis gating (MED — security).** No real Marketing lens exists in code, AND gates now key off **tiers, not names** (§3.1). Building a gate as `roleId === 'marketing'` would be silently wrong (a custom-renamed or money-bumped login bypasses it). Mitigate: resolve Q2/Q2a first (tier-based gates only); until the lens is mapped, surface under `sales`/`office` and gate on `tierRank()`.
- **Concurrent campaign edit / multi-user (MED — data-integrity).** Two users editing the same `campaign` race through the per-record diff sync (`app.js:15696`+, last-writer-wins on the `id`). `audienceSnapshot` and `campaignTouches` must be **append/merge-safe**, not blind-overwrite, or a concurrent `pushToOutreach` could drop touches. Mitigate: idempotent `pushToOutreach` keyed on `campaignTouches` (AC-7); treat `audienceSnapshot` as immutable-at-send.
- **Offline (LOW).** Campaign/segment saves are local-first; reuse the views/customer sync posture (`pushViewsToBackend`); a campaign created offline syncs on next online write like any record.
- **Performance (LOW).** Utilization + segment scans are O(n) over existing indexes; avoid per-row re-scans of `activityLog`/rentals (precompute per-category rental buckets once per render).

---

## 11. Open Questions

> **Resolved 2026-06-29 (scope expansion — see Decisions block):** Q1+scope → D1 (demand-gen + social/ad management + full automation incl. auto social posts) · Q2/Q3 → D2 (money-tier, OPTIONAL role) · Q13 → D3 (real automated outbound via Mocean + social auto-publish). Adopted: Q2a/Q6/Q7a/Q8/Q9/Q10/Q11/Q12/Q14/Q15.

> No seed questions were captured for this area; all below are generated from the code and the role contract, surfaced for Jac. Each defaults to the **conservative** option until decided.

1. **Q1 — Does Marketing stay folded into `sales-growth`, or split into its own `area/marketing` with its own surface?** The branch-map routes "marketing" → `sales-growth` (`branch-map.md:27`). Trade-off: a separate area gives the role a real home + a clean acquisition/utilization surface; folding avoids a near-duplicate area and keeps pipeline + demand-gen in one place. *This spec is written separable but degrades into a `sales-growth` sub-tab.*
2. **Q2 — Add a real Marketing ring lens** to the 5 built-in `ROLES` (`config.js:301`) with its own three KPI rings (utilization / acquisition-split / pipeline), or run Marketing surfaces under the existing `sales`/`office` lenses? The persona exists in `role-roles.md` doc-only today. *Reminder (§3.1): a ROLES entry is only a ring set — it grants no authority.*
   - **Q2a — Gate by tier, not name (confirm).** Every Marketing money/PII gate compares `tierRank(currentTier)` (`config.js`), never `roleId === 'marketing'`, so a renamed/custom role or a Marketing login bumped to `money` behaves correctly. Conservative default: **yes, tier-based gates only**.
3. **Q3 — Which TIER does a "Marketing" login carry?** Conservative default: **`staff`** — it sees operational utilization bars + segment **counts** but **no dollar column**; any $ revenue-at-risk / resulting-price / margin column requires **≥`money`**. The alternative (Marketing = `money`) would let it see margin — rejected as too loose for the persona's must-not-see list.
4. **Q4 — Confirm the target-list named-customer view renders ONLY behind the same visibility check as the customer card** (no PII backdoor). Conservative default: yes, hard-gated.
5. **Q5 — Confirm every Marketing ring stays inside `KPI_FIELDS.customers`** (no name/phone). A "top prospects" widget that names customers must live behind the card PII gate, not in a ring. Conservative default: yes.
6. **Q6 — Raw contact-list CSV/clipboard export: allow in v1 and behind which gate, or in-app handoff only?** Conservative default: **no raw export in v1**; in-app "Hand to Sales" handoff only. Export is the highest-PII-risk action.
7. **Q7 — Promo offer: Marketing (`staff`) sees the discount % but NOT the resulting $ / margin (≥`money`)?** Conservative default: yes — percent-only to `staff`-tier Marketing.
   - **Q7a — Utilization board & `categoryStats` dollar fields.** `categoryStats` (`app.js:1836`) returns `roi`/`avgRevUnit`/`avgExpUnit` and mixes in `cat.bottomDollar` (`app.js:1853`). For the utilization board, do we (preferred) compute `utilStats` **independently** of `categoryStats` so no dollar/margin field is ever in scope for a `staff` request, or reuse `categoryStats` and tier-strip its dollar fields? Default: **compute independently** (smaller blast radius).
   - **Q7b — Should ANY Marketing money figure exist client-side at all?** Because the backend uses a single shared password (§5, `app.js:15640`) and can't enforce per-tier visibility, any margin-derived number that reaches the client is only DOM-hidden, not truly gated. Safest posture: **no `bottomDollar`-derived value is ever computed or sent in a `staff`-context render** — money columns are built only in a `money`+ render path. Conservative default: **yes, money figures live only in `money`+ render paths**.
8. **Q8 — A campaign produces an advisory offer artifact and NEVER writes the rental price formula** (real rate changes stay an Office/Admin money-action)? Conservative default: yes, advisory-only.
9. **Q9 — `campaign` as a new top-level `DATA.campaigns` tab vs embedded on customers?** Top-level (proposed) eases cross-customer listing/reporting + new Sheets-tab wiring; embedded avoids a new tab but scatters campaign data. Default: top-level.
10. **Q10 — Time-utilization window = trailing 30 days?** And do Reserved/Quote-future rentals count toward "rented," or only realized On-Rent/Returned? Affects whether the ranking shows *current* idle or *committed* idle. Default: trailing 30d, count Reserved+On-Rent+Returned, exclude Quote.
11. **Q11 — Acquisition split: "new" = first-ever invoice in month, or first invoice in N months (reactivation counts as acquisition)?** Default: first-ever (`_digest.firstInvoice` in month).
12. **Q12 — Membership-savings figure: trailing actual transport spend, or a modeled "avg member trips × avg leg cost"?** Trailing-actual is honest per customer but zero for new prospects; modeled gives every prospect a number. Default: trailing-actual, fall back to modeled when no history.
13. **Q13 — Outreach handoff channel.** v1 writes an in-app `salesAction`/`Scheduled:` line into the Sales round-up only (no send). Confirm we wait for `comms-notifications` for any real SMS/email, vs a "copy message" affordance now. Default: in-app handoff only.
14. **Q14 — Should the Utilization Round-Up adopt the prescriptive R/Y/G flag-color system** (`flag-color-system.md`) — idle category = red, due-soon = yellow — or its own utilization-bar coloring? The flag system is prescriptive ("what do I do now") which fits "promote this idle category." Default: utilization bar uses the hazard stripe for idle; revisit flag adoption with `design-system`.
15. **Q15 — Does the Acquisition/Retention split live here or in `financials-kpi`?** The Revenue Goal ring + KPI engine live in `financials-kpi`; Marketing only needs the *split*. Default: Marketing defines the metric spec, the ring rides the `financials-kpi` engine.

---

## 12. Dependencies & Sequencing

| Depends on (roadmap slug) | Why | Must land first? |
|---|---|---|
| `sales-growth` | Owns the funnel + the round-up board Marketing hands lists to + `salesAction`/follow-up. Hard ownership boundary (§2.3). | **Yes** (for the handoff target); P1 utilization can ship without it. |
| `customers-crm` | Hosts the customer record, `interestedCategoryIds`, `_digest`, PII visibility gate. | **Yes** — the substrate (shipped). |
| `units-fleet` | Category/unit data + fleet status behind the utilization ranking. | **Yes** — P1 reads it (shipped). |
| `financials-kpi` | KPI engine, `KPI_FIELDS` allowlist, ring rendering for the acquisition split. | **Yes** — gates §3.3/AC-5 (shipped). |
| `memberships` | Membership entitlement + Unlimited-Transport for the savings figure; `membershipStage` terminal. | Before P3 enrollment drive (shipped). |
| `maps-location` | Transport-cost source for the membership-savings number. | Before P3 savings calc (shipped). |
| `comms-notifications` | Actual outbound SMS/email send. | **Before Phase 4** (currently 🟡 partial — no outbound). |
| `backend-data` | New `campaigns` tab + `saveCampaign`/`pushToOutreach`/shared `recomputeDigests` actions + persist wiring. | Before Phase 2. |

**Recommended sequence:** P1 utilization ranking + target-list builder (front-end, reads shipped data) → resolve Q1/Q2 (area + role lens) → P2 campaign object + outreach handoff (needs `backend-data` + `sales-growth` round-up) → P3 measurement/enrollment (needs honest `_digest` recompute + `memberships`/`maps-location`) → P4 real send (needs `comms-notifications` outbound).

---

*End of DRAFT — every numbered decision in §11 is open for Jac, each defaulted conservatively. Marketing is the demand-generation layer ABOVE the Sales pipeline; the hard rule is it never re-builds the funnel and never writes a price. Run all proposed UI through the `jactec-ui` skill (screenshot + self-critique) before build.*
