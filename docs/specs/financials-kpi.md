# Financials / KPI — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/financials-kpi`
**Task branch:** `financials-kpi/spec` (proposed)
**Maturity:** ✅ Shipped
**Scope:** The role-based KPI ring dashboard, the admin-definable KPI metric engine (safe DSL + Mr. Wrangler authoring), the gamification score-pops, the per-card graph overlays, and the company Revenue Goal — *not* the general ledger, P&L, or accounting export (that is `accounting`).

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions.

- **D1 · Dollar rings stay OPEN to all internal logins (resolves Q1/Q2).** The internal dashboard is **login-gated and is NOT a customer surface** (customers use the separate portal/website; a logged-out visitor only ever sees the login, not real data). So keep the office/sales `$` rings + the `+$X` score-pops visible to every signed-in role — morale > secrecy, and the real boundary is the login + per-role passwords. **No new money gate.**
- **D2 · Keep the "Coming 2026" plate (resolves Q11).** Don't un-blur the live rings yet; reveal them at a formal launch, not now.
- **D3 · Add trend sparklines / direction arrows (resolves Q8).** A per-ring last-N-days trend backed by a lightweight **daily snapshot store** (additive backend) — turns a level into a direction. Phase 2.
- **D4 · Manager+ can author KPIs (resolves Q4).** Open KPI authoring to **Manager+** (consistent with Manager+ accepting pricing changes), not Admin-only.

**Defaults adopted:** Q3 → server-side `setConfig` admin-verify is now backed by **per-role passwords** (`backend-data` D1) · Q1a → block `agg:'sum'` on `customers` (`_totalPaid` stays filter-only) · Q9 → null rings keep "Coming soon" (GPS/comms will fill them; Driving Score is now **per-driver** via `gps-tracking` D1) · Q10 → orphan-key cleanup on role edit · Q5 → start-month revenue attribution · Q6 → goal rings may bind to `companyRevenueGoal()` · Q7 → default band `up` unless an inverse metric is detected.

---

## 1. Goal & Problem

### 1.1 What this area is for

Rental Wrangler runs a single yard. Jac and the crew need a **glanceable, role-relevant read on "are we winning right now?"** without opening a report, exporting a sheet, or doing mental math. This area owns the **operations-intel layer that sits on top of the live entity data** — it derives, bands, and surfaces KPIs as Apple-style concentric rings, lets an admin re-define what each ring measures (in plain English, via Mr. Wrangler), and turns every data-changing action into a small dopamine hit (the score-pop) so the dashboard *rewards* good work in real time.

It is deliberately **not** accounting. There is no ledger, no double-entry, no tax filing, no P&L here. Those live in `invoicing-payments` (the money engine) and `accounting` (the expense ledger + future export). Financials/KPI is the **measurement and motivation** surface — it reads from every entity and renders a scorecard.

### 1.2 The business/user problem

- A heavy-equipment yard has a dozen leading indicators (fleet readiness, WO completion, collection rate, show rate, revenue pace) scattered across six cards. No single human keeps all of them in their head.
- Different roles care about different numbers. A mechanic cares about Healthy Fleet and WO completion; the office cares about collection and show rate; sales cares about the monthly revenue pace. A one-size dashboard buries the signal each person needs.
- The numbers Jac wants to track **change over time** — what mattered last season isn't what matters now. Hard-coding 15 formulas means every tweak is a code deploy. The metric engine exists so Jac (or an admin) can re-aim a ring himself, in plain English, and have it proven against live data before it ships.
- Morale: a yard runs on hustle. The score-pop ("+$1,250", "+3") flashing green over the ring when you take a payment or finish a WO is intentional gamification — the *delta on a real numerator* is the reward.

### 1.3 North star

> **Every role opens the app and, in one glance at three rings, knows whether their part of the yard is winning — and every good action they take is rewarded the instant it lands, with no report, no export, and no code change to re-aim what's measured.**

---

## 2. Current State (Baseline) — LIVE SYSTEM AS CANON

Everything in this section is **shipped on `main`** and is documented here as canon. Anchors are `file:line` against the 2026-06-28 tree.

### 2.1 The ring dashboard (shipped)

| Piece | Where | Notes |
|---|---|---|
| 5 role KPI rings in the header | `headerEl()` app.js:7359, `roleRing` app.js:7361 | One `.kpi-ring.js-ring` button per role, `ring3SVG(kpiFor(id), …, {size:64})` |
| 3-concentric-ring SVG | `ring3SVG()` app.js:7056 | Outer = ring 0 (most important), each ring colored by **its own** value band |
| N-ring variant (team) | `ringsSVG()` app.js:7072 | One ring per item, auto-fits count |
| Band coloring | `bandColor(pct)` app.js:7047 | 0–25 red · 25–50 orange · 50–75 yellow · 75–90 green · ≥90 **glowing** green |
| Role popup (the scorecard) | `o.kind === 'role'` app.js:9244 | Big 150px ring + a `.kpi-line` per KPI with live %, band color, ring tag (Outer/Middle/Inner), and `KPI_HELP` tooltip. WINDOW_CATALOG kind `role` app.js:9805 |
| Opens via | click handler app.js:12465 | `.js-ring` → `openOverlay({kind:'role', role})` |
| Per-KPI plain-English help | `KPI_HELP` app.js:7148 | 15 explainer strings, shown on hover in popup + Settings |

The 5 roles and their three KPIs are defined in `config.js`:

```
ROLES (config.js:302)
  mechanic (blue)  : Healthy Fleet · WO Completion Rate · Parts Breakeven
  mtech   (purple) : Successful Rentals · Ready Rate · WO Rate (20% goal)
  driver  (green)  : On-Time · Wash Completion · Driving Score          ← Driving Score = null (GPS)
  office  (orange) : Invoice Collection Rate · Show Rate · Reputation   ← Reputation = null (email)
  sales   (navy)   : Revenue Goal · Active Customer Rate · Pipeline
```

### 2.2 The legacy math (shipped, now the "builtin" escape hatch)

`legacyKpiPct(roleId)` (app.js:7091) is the hand-written switch returning `[pct,pct,pct]` (0–100) per role; `legacyKpiRaw(roleId)` (app.js:7298) returns the **raw numerators** (natural unit: `$` for money rings, count otherwise). These are the source of truth for the 15 shipped KPIs. Selected formulas (cited verbatim — see §7):

- **mechanic** Healthy Fleet = `(Ready + Not Ready) ÷ total fleet`; WO Completion = `Complete ÷ live (non-cancelled) WOs`; Parts Breakeven = `min(billedEarnings / partsCostTotal, 1)` (goal ring, 100% = parts cost covered).
- **mtech** Successful Rentals = `1 − fieldCallRentals/allRentals`; Ready Rate = `Ready ÷ eligible` (excludes Failed + Inactive/Sold/For Sale fleetStatus); WO Rate = progress toward **20% of last-30-day inspections spawning a WO** (full ring at 20%).
- **driver** On-Time = `delivered ÷ scheduled`; Wash Completion = `washed ÷ wash-requested`; Driving Score = **null** (GPS backend).
- **office** Collection Rate = `Σ(paid − refunded) ÷ Σ(billed)` across invoices; Show Rate = `shows ÷ reservations`; Reputation = **null** (email backend).
- **sales** Revenue Goal = `thisMonth's rental revenue ÷ companyRevenueGoal()`; Active Customer Rate = `active big customers ÷ big customers (>$1,999 lifetime)`; Pipeline = `(members + leads) ÷ 10`.

### 2.3 The KPI metric engine (shipped — `APP-21`, app.js:7166)

A **safe, declarative DSL** (no `eval`, Pages-public-safe). A metric is *filters + an aggregate over an entity allowlist*, evaluated by `kpiEval(ring)` (app.js:7216). Shipped pieces:

| Piece | Where | Contract |
|---|---|---|
| Entity allowlist | `KPI_ENTITY` app.js:7174 | units, rentals, workOrders, inspections, invoices, customers |
| Derived fields | `KPI_DERIVED` app.js:7179 | `_ageDays, _month, _revenue, _paid, _billed, _totalPaid, _activePct` |
| Tokens | `KPI_TOKENS` app.js:7188 | `@thisMonth, @today` |
| Condition eval | `kpiCond` app.js:7191 | ops: eq, ne, in, nin, gt, gte, lt, lte, contains, exists, truthy, falsy |
| Row filter | `kpiRows` app.js:7203 | applies `where[]`, swallows per-cond throws |
| Aggregate | `kpiAgg` app.js:7209 | `count` or `sum` of a field |
| Evaluator | `kpiEval` app.js:7216 | `{pct, raw, unit}`; kinds: `builtin · ratio · count · goal · sum`; defensive (bad spec → zero ring, never throws) |
| Defaults | `KPI_DEFAULTS` app.js:7241 | every shipped KPI as a `kind:'builtin'` ring → **defaults === today, byte-for-byte** |
| Override resolve | `roleRings(roleId)` app.js:7248 | reads `state.settings.kpis[roleId]` if it's a valid 3-ring array, else defaults |
| Public read-through | `kpiFor` / `kpiRaw` app.js:7254 | the dashboard + gamification both route through the spec layer |
| Filterable-field allowlist | `KPI_FIELDS` app.js:7259 | gates BOTH the Wrangler validator and what the authoring prompt may reference — **nothing money/auth/pricing** |
| Validator | `wrValidateKpi` app.js:7275 | rebuilds the ring from allowlisted parts only, then runs `kpiEval` live to prove it computes |

### 2.4 Mr. Wrangler KPI authoring (shipped)

- **Settings → KPIs & Rings pane** `settingsKpisPane(o)` app.js:3810: role picker chips → 3 ring rows, each with a **LABEL** input, a **MEASURES** readback (`kpiMetricReadback` app.js:3802), a live-value chip, **TARGET** + **BETTER (▲High/▼Low band)** controls for DSL rings, a **🤠 Refine** button (`data-r="R17"`), and reset-to-default. A mini 3-ring live preview sits beside the rows.
- **Draft lifecycle:** `draftRoleRings` app.js:3788, `ensureKpiDraft` app.js:3794 (clones defaults into the draft on first edit).
- **Authoring handoff:** `openWranglerForKpi(roleId, idx)` app.js:3848 seeds the Wrangler dock with `wranglerKpiSystem()` (app.js:3862) — the KPI-authoring system-prompt addendum listing the allowlisted entities/fields and the exact `wrangler-action` block to emit.
- **Apply:** `lockKpiFromWrangler(mi)` app.js:3879 writes the validated ring into `settings.kpis`, persists with the carried admin credential, applies live, and reopens the Settings board on the KPIs tab (app.js:3893).
- **Wrangler tab is gated:** the Settings board itself is **Admin-tier** (`openSettings()` app.js:13885 prompts for the Admin password; `adminUnlocked()` app.js:13071 = tier ≥ admin).

### 2.5 Gamification — score-pops (shipped, `APP-20`)

`scoreTick()` (app.js:7315, called every render) snapshots each KPI's raw numerator via `kpiSnapshot()` (app.js:7313). When a numerator **rises**, `scorePop(role, ringIdx, delta, unit)` (app.js:7322) flashes that exact ring green ×3 (`.ring-score-flash`) and floats a `+ΔN` pop (`+$X` on money rings via `money()`, `+N` on counts) that fades after 760ms. **Any** action that raises a numerator auto-joins — no per-action hooks.

### 2.6 The Revenue Goal (shipped)

- `companyRevenueGoal()` app.js:3130 → `Number(companyCfg().revenueGoal)` if > 0, else `COMPANY_DEFAULTS.revenueGoal` (app.js:3119, sourced from `CFG.REVENUE_GOAL_DEFAULT`, config.js:557).
- **Admin-set:** Settings → Company carries a `MONTHLY REVENUE GOAL` field (app.js:3526; sanitized on save app.js:13701 — only a positive finite number is stored, else cleared to default).
- It is **monthly** and feeds the sales **Revenue Goal** ring (app.js:7137) and the `goal`/`sum` DSL kind targets.

> **Security note — the default value lives in `config.js` as a non-secret number and is intentionally NOT a secret.** This spec must never inline any password/credential; the Revenue Goal default is fine to reference by name.

### 2.7 Per-card graph overlays (shipped, `APP-24`/`APP-25`)

- Pure SVG/CSS chart primitives (no chart lib): `pieSVG` app.js:8327 (donut), `gvBars` app.js:8351 (vertical bars), plus tile builders `gvNumTile/gvPieTile/gvBarTile/gvLeadTile/gvTableTile` (app.js:8381–8385).
- **Graph carousel** `APP-25` app.js:8427: a per-card deck of interactive views stacked above the list; clicking a slice/bar/row toggles a search term (the chart drives the rows). `graphViewsFor(card)` app.js:8441 defines the views (units shipped with Inspection/Fleet/Shop pies, Field-Call bars + leaderboard, etc.).
- **Timeline selector** `APP-24` §13.4 (app.js:8391): per-source 7/10/30/90/180/360-day or All window (`GV_WIN_OPTS`, `loadGvWin/saveGvWin`, `gvBuckets`).

### 2.8 Null placeholders (intentionally unbuilt)

| Ring | Role | Blocked on | Anchor |
|---|---|---|---|
| Driving Score | driver | GPS/telematics backend (`gps-tracking`) | app.js:7123 returns `null` |
| Reputation | office | server-side email + reviews backend (`comms-notifications`) | app.js:7130 returns `null` |

A `null` ring renders empty and the role popup shows "Coming soon" (app.js:9251).

### 2.9 The "Coming 2026" plate (shipped, `APP-22`, app.js:7331)

The header rings currently ride behind a blur with a "Coming 2026" data-plate (`.coming-plate.js-roadmap`, app.js:7366) that opens the roadmap popup. *This is a morale/roadmap surface, not a KPI feature* — noted here only because it overlays the ring area.

---

## 3. Users, Roles & Data Gates

### 3.1 The 15 roles & who touches this area

There are 15 logins resolving to **5 tiers** (`ROLE_TIERS` config.js:326: staff < money < manager < admin < developer; `BUILTIN_ROLE_TIERS` config.js:340). Every login *sees* the 5-ring dashboard; only some can *configure* it.

| Capability | Today's gate | Anchor |
|---|---|---|
| **See** the 5 role rings in the header | **Ungated** — every login (and logged-out demo) sees all 5; does NOT consult `canMoney()` | `headerEl` app.js:7369 |
| **Open** a role popup (scorecard) | Ungated | app.js:12465 |
| **See** per-card graph overlays | Ungated (same as card visibility) | `graphViewsFor` app.js:8441 |
| **Edit** KPI definitions (Settings → KPIs & Rings) | **Admin** tier (Settings is Admin-gated) | `openSettings` app.js:13885, `adminUnlocked` app.js:13071 |
| **Author** a KPI via Mr. Wrangler | Admin (reached only through the gated Settings board) | `openWranglerForKpi` app.js:3848 |
| **Set** the company Revenue Goal | Admin (Settings → Company) | app.js:3526 |
| **Dev** tools (Lint/Inspector/Rulebook) | Developer tier | `devUnlocked` app.js:13073 |

### 3.2 Data-gate concern — money visibility on the rings (OPEN, see §11)

**Tier model (ground truth).** Roles carry a **tier**, not a name-based gate (`config.js:315–348`). The comparison key is `tierRank` (`config.js:334`) over the ladder `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`. Crucially, the **five KPI ring *names* are role labels, not login tiers** — the shipped tier of each *login* (`BUILTIN_ROLE_TIERS`, config.js:340) is:

```
mechanic / mtech / driver  → staff   (tier 1)
office / sales             → money   (tier 2)
manager → manager · admin → admin · developer → developer · owner → admin (back-compat bridge)
```

So a logged-in **mechanic is `staff`-tier** and a logged-in **office is `money`-tier**. The runtime helper is `canMoney()` (app.js:14166): `!currentRole || roleTier(currentRole) >= tierRank('money')` — i.e. "can see pricing/margin, take payments." It is already the gate on cards-on-file, invoice pricing, and membership billing (app.js:6251, 12417, 14207). **The KPI dashboard predates this tier and does NOT consult `canMoney()`** — `headerEl` (app.js:7369) renders all 5 rings unconditionally; the role popup and `scorePop` never check tier.

The exposed dollars are the **office** and **sales** rings whose raw numerator is `$`:
1. **Invoice Collection Rate** raw `Σ(paid − refunded)` (`legacyKpiRaw` office, app.js:7305) and **Revenue Goal** raw `this-month rental revenue` (`legacyKpiRaw` sales, app.js:7308),
2. surfaced as the **role popup** % (a percentage, lower sensitivity), and
3. as the **score-pop** `+$X` — an actual dollar delta (`scorePop` app.js:7327, `money(delta)`).

A `staff`-tier mechanic can therefore currently watch a `+$1,250` payment pop and read the office collection %.

> **Quirk worth gating around:** `canMoney()` returns **true when `!currentRole`** (no login / demo / offline). Any new money-gate built on `canMoney()` would, by that helper's own logic, *open* the dollars in a logged-out/demo session. If the gate must be conservative there too, the new check must be `currentRole && canMoney()` rather than bare `canMoney()`. See §11 Q1 / Q2.

This is a **conservative-gate decision for Jac** (Q1). The spec does **not** silently loosen or tighten it; §11 surfaces the fork. The DSL is *already* walled off from money: `KPI_FIELDS` (app.js:7259) exposes no margin/cost/`bottomDollar` field on any entity (confirmed verbatim — see §3.3 and the field allowlist in §4.1), so **admin-authored** custom KPIs cannot leak pricing-floor data. The exposure is limited to the **2 shipped `$`-unit builtin rings** (office Collection, sales Revenue Goal) and their `+$` pops.

### 3.3 Customer isolation & PII

- The KPI engine aggregates over **internal** entities (units, rentals, WOs, inspections, invoices, customers) into **counts and ratios**. No raw customer PII is rendered in a ring or score-pop.
- The `customers` allowlist (`KPI_FIELDS.customers`, app.js:7265) exposes only `accountType, usedSalesStage, membershipStage, industry, _totalPaid, _activePct` — categorical + digest fields, **no name/phone/email/address/idNumber**. A custom KPI cannot surface a customer's identity. The DSL aggregates are `count` and `sum` only (`kpiAgg`, app.js:7209) — there is **no list/select/groupBy that could return per-customer rows**; the output is always a scalar.
- **Customer isolation:** this app is single-tenant (one yard, all internal staff), so there is no cross-customer tenancy boundary to enforce *here* — but note that `_totalPaid`/`_activePct` are **per-customer money digests**. A `sum` over `customers.field=_totalPaid` would aggregate lifetime customer spend into a single scalar; that scalar is a money figure and falls under the **same Q1 money-gate question** if it is ever surfaced raw. Today no shipped ring does this, and `_totalPaid` is only reachable as a *filter* on the two sales builtin rings, not summed — but a future admin-authored `sum` ring could. **Decision needed:** should `_totalPaid` (a money field) be removed from `KPI_FIELDS.customers`, or its `agg:'sum'` use blocked, to prevent an admin authoring a "total customer spend" dollar ring that bypasses the Q1 gate? See §11 Q1a.
- **Pricing-floor (`bottomDollar`/margin):** explicitly **out of the allowlist** — confirmed verbatim against `KPI_FIELDS` (app.js:7259–7266): no entity exposes any `cost`, `margin`, `bottomDollar`, `floor`, or rate field. No KPI can read or aggregate the pricing floor. (Guard: keep it that way — AC #4, §10 risk #2.)

### 3.4 Authoring & money-action gates (who can change what)

| Action | Gate (helper) | Tier | Anchor |
|---|---|---|---|
| See/open any ring or graph overlay | none | all logins (incl. logged-out demo) | app.js:7369 |
| Edit a KPI definition / author via Wrangler | `adminUnlocked()` (Settings is Admin-gated) | ≥ admin | app.js:13071, 13885 |
| Set the company Revenue Goal | `adminUnlocked()` (Settings → Company) | ≥ admin | app.js:3526, 13701 |
| Save an override to the backend (`setConfig`) | carries an Admin credential | ≥ admin | app.js:3879, 13923 |
| Dev tools (Lint / Inspector / Rulebook) | `devUnlocked()` | ≥ developer | app.js:13073 |
| **See office/sales `$` rings + `+$` pops** | **none today** | **all (incl. logged-out)** | **§3.2 / §11 Q1 — gate decision pending** |

The authoring path is conservatively gated: every write to `settings.kpis` flows through the Admin-gated Settings board and carries the Admin credential (app.js:13923). The **only** loose gate in this area is the *read* visibility of the two `$` rings (Q1).

---

## 4. Data Model

### 4.1 Entities & where they live

The KPI engine is **read-only over existing entities** — it introduces no new persisted entity of its own except the admin override blob.

| Datum | Lives in | Shape | Notes |
|---|---|---|---|
| Role + KPI labels | `config.js` `ROLES` (302) | `{id,label,color,kpis:[3 strings]}` | Static; the 3 labels seed `KPI_DEFAULTS` |
| KPI override (admin-authored) | `state.settings.kpis` | `{ roleId: [ring0,ring1,ring2] }` | Persisted via `setConfig({settings})`; mirrored to `localStorage` `jactec.settings`; applied at boot by `applySettings` |
| A **ring** | inside the override | `{id, label, help, target?, unit?, band?, metric}` | `band: 'up'\|'down'`; `unit: '%'\|'$'\|'count'` |
| A **metric** | inside a ring | one of `builtin\|ratio\|count\|goal\|sum` | see §5.2 |
| A **source** | inside a metric | `{entity, where:[{f,op,v}], agg:'count'\|'sum', field?}` | entity ∈ `KPI_ENTITY`; `f` ∈ `KPI_FIELDS[entity]` (+ derived `_*`) |
| Company Revenue Goal | `state.settings.company.revenueGoal` (a.k.a. `companyCfg()`) | positive number, monthly | default `REVENUE_GOAL_DEFAULT` config.js:557 |
| Graph window pref | `localStorage` `jactec.gvWin.<src>` | one of `GV_WIN_OPTS` or 0 (All) | per-device, not synced |

### 4.2 Relationships by ID

The engine never persists a join; it resolves them **live at eval time** through the existing `IDX` maps and derived fields:
- `_revenue` (a rental's price) calls `rentalPrice(r)` which reads the rental's `unitId`/`categoryId` → category rates.
- `_paid`/`_billed` call `invoiceTotals(inv)` over the invoice's own lines.
- `_totalPaid`/`_activePct` read the customer's `_digest` (computed upstream by the customer cadence engine).

### 4.3 Schema-less / additive notes

- The override blob is a **single JSON value** under `settings.kpis` — schema-less Sheets stores it as a string; no new tab, no migration of existing rows.
- **Migration concern (none today):** because `KPI_DEFAULTS` reproduces today's rings via `kind:'builtin'`, a backend with no `settings.kpis` key renders identically. Removing or renaming a role in Settings → Roles must reconcile `settings.kpis[roleId]` (orphan key cleanup) — currently `roleRings` simply ignores keys for non-existent roles, which is safe but leaves dead data (see §10).

---

## 5. Backend / Integration Contract

### 5.1 Existing GAS actions (reused — no new endpoint needed)

| Action | Direction | Used by this area |
|---|---|---|
| `getConfig` | read | Settings board load; carries `settings.kpis` + `settings.company.revenueGoal` |
| `setConfig` | write | Saving a KPI override or the Revenue Goal; payload `{password, roles, admin, settings}` (Admin credential carried — app.js:3879/13923) |
| `wrangler` | read (AI) | The KPI-authoring chat — **already exists**; authoring adds only a *system-prompt addendum* (`wranglerKpiSystem()` app.js:3862) + a new client-side action **kind** (`kpi`), no backend change |

**No new backend action is required for the shipped feature set.** The metric engine, validator, and `kpiEval` are all **client-side** and Pages-public-safe (no `eval`, declarative DSL only). This is by design — the DSL must run in the browser so a malformed admin spec can never reach the server as code.

**Trust boundary (be explicit).** Two things matter for hardening:

1. **`setConfig` is the only write, and it is Admin-credentialed.** The client gates authoring behind `adminUnlocked()`, and `setConfig` carries the Admin password. **The front-end gate is convenience; the server password check is the real authority.** This spec assumes (cannot read `Code.gs` to confirm) that the GAS `setConfig` handler **rejects a `settings` write without a valid Admin password**. If it does not — if `setConfig` trusts the client's claim — then anyone who can POST to the deployment can rewrite `settings.kpis`. **This must be verified server-side**, not assumed (§11 Q3).
2. **The Wrangler-emitted `kpi` action is NOT trusted on receipt.** The AI returns a JSON `kpi` action; the client **re-validates it through `wrValidateKpi` (app.js:7275)**, which rebuilds the ring from allowlisted parts only and runs `kpiEval` live before it can be saved. A hostile or hallucinated action that names a non-allowlisted entity/field, a money field, or a bad target is rejected with `issues[]` and never persisted. The AI output is therefore **untrusted input that passes through the same allowlist gate as a hand-typed metric** — there is no path where AI text becomes a saved ring without validation.

### 5.2 The metric DSL contract (client-side, for reference)

```jsonc
// ratio — the cross-entity workhorse (num ÷ den, each an independent source)
{ "kind":"ratio",
  "num":{"entity":"workOrders","where":[{"f":"phase","op":"eq","v":"Complete"},{"f":"_ageDays","op":"lte","v":2}],"agg":"count"},
  "den":{"entity":"workOrders","where":[{"f":"cancelled","op":"ne","v":true}],"agg":"count"} }

// goal — value vs a numeric target; pct = min(value/target,1)*100
{ "kind":"goal",
  "src":{"entity":"rentals","where":[{"f":"_month","op":"eq","v":"@thisMonth"}],"agg":"sum","field":"_revenue"} }   // ring.target = the goal $

// count — filtered count ÷ entity total → %
{ "kind":"count", "src":{"entity":"units","where":[{"f":"fleetStatus","op":"in","v":["Ready","Not Ready"]}]} }

// builtin — escape hatch to the hand-coded legacy calc (back-compat)
{ "kind":"builtin", "ref":"sales", "idx":0 }
```

The Wrangler-emitted authoring action (validated by `wrValidateKpi`):

```jsonc
{ "action":"kpi", "role":"office", "ring":0,
  "label":"≤28 chars", "help":"one plain sentence",
  "band":"up|down", "target":<number, goal/sum only>, "unit":"%|$|count",
  "metric":{ /* one of the above */ } }
```

### 5.3 Failure handling

- **Bad metric spec** → `kpiEval` returns `{pct:0, raw:0}` defensively (try/catch app.js:7237); **never crashes the dashboard render**. The validator (`wrValidateKpi`) blocks a bad spec from being *saved* by collecting an `issues[]` list and refusing to lock in.
- **Offline / `getConfig` failure** → Settings won't open (`openSettings` toasts and closes app.js:13895); the live dashboard keeps running on `localStorage`-mirrored `settings.kpis` and the defaults.
- **Wrangler unreachable / AI returns malformed JSON** → the manual structured controls (label/target/band) still work; only the plain-English authoring fast-path is lost. A non-JSON or schema-broken AI reply fails `wrValidateKpi` and surfaces `issues[]`; nothing is saved.
- **`setConfig` write fails (network / rejected password)** → the override is **not** persisted to the backend, but the client may have already applied it to the live `state.settings.kpis` and the `localStorage` mirror. **Edge case to harden:** if the write fails after the local apply, the dashboard shows the new ring locally but a reload (which re-reads backend) reverts it — a confusing "it saved then unsaved" UX. Phase 1 should confirm `lockKpiFromWrangler` (app.js:3879) does not optimistically apply before the `setConfig` promise resolves, or surfaces a clear "save failed, reverting" toast (§11 Q3, §10 risk #11).
- **Concurrent admin edits** → `settings.kpis` is a single JSON blob; `setConfig` is last-write-wins with no field-merge (§10 risk #7).

### 5.4 Future integrations (for the two null rings — out of scope here, named only)

- **Driving Score** → `gps-tracking` telematics feed (driver-scoring payload).
- **Reputation** → `comms-notifications` server-side email + a reviews source.
Both would land as new **builtin** refs (the math is non-trivial / external) rather than DSL rings.

---

## 6. UX / UI — yard data-plate language

> All new/changed UI runs through the `jactec-ui` skill. Surfaces below are **already shipped**; this section documents them as canon and flags the few proposed deltas. The dashboard is the steel-yard core; the ranch twist stays in voice only.

### 6.1 The header rings (shipped)

- 5 `.kpi-ring` buttons, each a 64px `ring3SVG` over a **stamped Saira Condensed** role label (`.ring-label`).
- Rings ride on the dark steel header band; band colors use the palette tokens (`--red/--orange/--yellow/--green`), **never** the safety-orange brand accent (`--accent`) as a status color.
- **Glow** at ≥90% (`.ring-glow`) is the single bold moment — spend boldness there.
- **Score-pop** (`.score-pop`) floats up + fades; the ring flashes green ×3 (`.ring-score-flash`).

### 6.2 Role popup — the scorecard (shipped, WINDOW_CATALOG kind `role`)

- `popupShell` with `RING_ICON[role.id]`, title `"<Role> KPIs"`, tag `"Role · scorecard"`.
- Body: a 150px `ring3SVG` + a `.kpi-line` per KPI (ring-number chip colored to its band, KPI name, ring tag Outer/Middle/Inner, live % or "Coming soon", `KPI_HELP` tooltip).
- **Rivets + stamped labels** per the data-plate language. No new popup needed — already catalogued.

### 6.3 Settings → KPIs & Rings pane (shipped)

- Role-picker chips → 3 ring rows. Each row: `RING n` slot stamp, **LABEL** input, **MEASURES** readback, live-value chip, (DSL only) **TARGET** input + **BETTER ▲High/▼Low** segmented control (R14), **🤠 Refine** ignition pill (orange gradient, `data-r="R17"`), reset-to-default.
- Mini 3-ring live preview beside the rows (`.kpi-preview`).
- Saddle-stitch tan divider is acceptable between the picker and the rows (subtle ranch seasoning); do **not** add western chrome.

### 6.4 Per-card graph overlays (shipped)

- The `.gv-panel` carousel: pies/bars/leaderboards/number-tiles, chevrons cycle views, click-to-filter. Timeline chip stamped on the chart head (`gvWinLabel`).

### 6.5 States

| State | Treatment |
|---|---|
| Empty (no data) | Rings render at 0% (red band); `pieSVG` draws a dashed empty ring; leaderboard tiles show "No data yet." |
| Loading | Settings shows a loading shell (`openSettings` opens `loading:true`); the live dashboard never blocks on the backend (reads local data) |
| Error (bad spec) | Ring renders 0; Settings authoring shows the validator `issues[]`; save is refused |
| Null ring (GPS/email) | Empty ring + "Coming soon" in the popup |
| Mobile reflow | Rings shrink with the header; the role popup uses the standard bottom-sheet overlay (`mobile-remote` M-rules) |

### 6.6 R-Rulebook & WINDOW_CATALOG

- **No new popup** is proposed for v1 — `role` is already in `WINDOW_CATALOG` (app.js:9805). If a **proposed delta** (§8) adds a popup (e.g. a dedicated "Financials board"), it **must** be added to `WINDOW_CATALOG` or `ci/check-window-catalog.mjs` fails CI.
- Any new/changed UI element gets a `data-r="Rxx"` stamp; `rule-usage.js` is regenerated (`ci/gen-rule-usage.mjs`, drop `--check`). The Refine pill already carries `data-r="R17"`.

---

## 7. Business Rules / Derivations / Money

### 7.1 Banding (the single coloring rule) — `bandColor(pct)` app.js:7047

```
pct ≥ 90 → green + glow
pct ≥ 75 → green
pct ≥ 50 → yellow
pct ≥ 25 → orange
else     → red
```
`band:'down'` rings invert via `kpiBand` (app.js:7212): `pct → 100 − pct` **before** banding (so "lower is better" rings glow when the underlying number is low).

### 7.2 The 15 shipped formulas (canon — `legacyKpiPct` app.js:7091)

| Role | Ring | Formula | Notes |
|---|---|---|---|
| mechanic | Healthy Fleet | `(Ready+NotReady) ÷ total fleet` | rentable share |
| mechanic | WO Completion | `Complete ÷ live WOs` | cancelled WOs excluded |
| mechanic | Parts Breakeven | `min(billedEarnings/partsCostTotal, 1)`; 100% if no parts cost | goal ring; `woBillable(w)` for billed-Yes WOs |
| mtech | Successful Rentals | `1 − fieldCallRentals/allRentals` | higher = fewer breakdowns |
| mtech | Ready Rate | `Ready ÷ eligible` | eligible excludes Failed + Inactive/Sold/For Sale fleetStatus |
| mtech | WO Rate (20% goal) | `min((woSpawned/recentInsp)/0.20, 1)` | rolling 30-day window; full ring at 20% |
| driver | On-Time | `delivered ÷ scheduled` | delivered = On/End/Off Rent + Returned; scheduled excludes Quote/Cancelled/No Show |
| driver | Wash Completion | `washed ÷ wash-requested` | inspection.wash Yes ÷ (Yes+No) |
| driver | Driving Score | **null** | GPS backend |
| office | Invoice Collection Rate | `Σ(paid − refunded) ÷ Σ(billed)` | `invoiceTotals(i)`; `refundedAmount` subtracted |
| office | Show Rate | `shows ÷ reservations` | shows = On/End/Off Rent + Returned |
| office | Reputation | **null** | email backend |
| sales | Revenue Goal | `thisMonth rentalRevenue ÷ companyRevenueGoal()` | monthly, resets on the 1st; `rentalPrice(r).price` summed for rentals starting this month |
| sales | Active Customer Rate | `activeBig ÷ big` | big = `_digest.totalPaid > 1999`; active = `_digest.activePct > 0` |
| sales | Pipeline | `(members + leads) ÷ 10` | members = Member (not Incomplete); leads = past "Inbound Lead"/"N/A" |

### 7.3 The DSL evaluation rules — `kpiEval` app.js:7216

- `ratio`: `pctOf(kpiAgg(num), den)` where `den` is `{const:N}` or another source.
- `count`: `pctOf(kpiAgg(src), kpiAgg(entityTotal))`.
- `goal`/`sum`: `min(value/target, 1)*100`; unit defaults to `$` when `agg:'sum'`.
- All bounded 0–100; `pctOf(a,b) = b>0 ? round(clamp(a/b*100,0,100)) : 0`.
- `raw` (the numerator) is what feeds `kpiRaw` → `scoreTick` → gamification. **Any** DSL ring auto-gamifies by exposing `raw`.

### 7.4 Gamification rule

`scoreTick` diffs each render's `kpiSnapshot()` against the previous. A numerator that **rose** (`m.v > p.v + 1e-9`) fires `scorePop` on that ring. Format: `+$X` (`money(delta)`) for `unit==='$'`, else `+N` (`round(delta*10)/10`). Decreases are silent (no negative pop).

### 7.5 Money precision & edge cases

- `_revenue`/`_paid`/`_billed` are dollar floats; the engine rounds **percentages** to integers and **score-pop dollars** via `money()`. There is no sub-cent accumulation concern because rings aggregate already-computed line totals, not raw rates.
- **Revenue Goal month boundary:** `_month`/`@thisMonth` use `TODAY_ISO.slice(0,7)` — on the 1st, the ring resets to whatever started that calendar month. (A rental dated mid-month counts in its **start** month, not its billing month — a known modelling choice; flag in §11 if Jac wants billed-month instead.)
- **Divide-by-zero:** `pctOf` returns 0 when the denominator is 0; goal rings with `target ≤ 0` return 0 (never NaN/Infinity).

---

## 8. Phasing & Milestones

The core area is **shipped**. Phasing below frames *hardening + the open forks*, not a greenfield build.

### Phase 1 — Hardening the shipped surface (MVP for this spec)
**In scope:**
- Resolve the **money-visibility gate** decisions (§3.2 / §11 Q1 + Q1a + Q2) and implement conservatively (the behavior changes with security weight) — including the logged-out/demo case (`currentRole && canMoney()` vs bare `canMoney()`).
- **Verify server-side `setConfig` Admin authority** (§11 Q3) on the live deployment — the integrity floor; do this before relying on any front-end authoring gate.
- Orphan-key cleanup: when a role is deleted/renamed in Settings, reconcile `settings.kpis` (§10).
- Confirm the two null rings degrade cleanly on every surface (popup, score-pop, mobile).
- CI: ensure `ci/logic-test.mjs` asserts (a) **each `KPI_DEFAULTS` ring reproduces its `legacyKpiPct`/`legacyKpiRaw` value** (the defaults===today regression guard) and (b) **the `KPI_FIELDS` money/PII denylist** (AC #4).

**Out of scope for v1:** any new persisted financial entity; P&L; export; the two null backends.

### Phase 2 — Trend & history (proposed)
- A small **ring history sparkline** (per role, last N days) so a ring shows *direction*, not just level. Requires a lightweight snapshot store (daily `kpiSnapshot` → backend) — additive `setConfig`/new action TBD.
- Optional **goal-pace** read (am I on track for the monthly Revenue Goal given the day of month?).

### Phase 3 — The two null rings (depends on other areas)
- Driving Score (after `gps-tracking` lands a feed).
- Reputation (after `comms-notifications` lands server-side email + reviews).

### Out-of-scope (belongs elsewhere, always)
- General ledger, chart of accounts, P&L, QuickBooks/Xero export → `accounting`.
- Tax/aging/payment math → `invoicing-payments`.
- Automated rate proposals → `automated-pricing`.

---

## 9. Acceptance Criteria

Concrete, testable. CI-gate impact noted.

1. **Defaults === today.** With `settings.kpis` empty, `kpiFor(role)` and `kpiRaw(role)` return **identical** values to the legacy `legacyKpiPct`/`legacyKpiRaw` for all 5 roles. → asserted in `ci/logic-test.mjs` (regression guard).
2. **Defensive eval.** A deliberately malformed ring spec produces a 0-ring and **does not throw** during render. → `ci/logic-test.mjs` unit over `kpiEval`.
3. **Validator blocks bad specs.** `wrValidateKpi` rejects (a) unknown entity, (b) a `where.f` not in `KPI_FIELDS`, (c) `goal/sum` with no positive target, (d) a `sum` field not allowlisted — each with a non-empty `issues[]`. → `ci/logic-test.mjs`.
4. **No money/PII field reachable via the DSL.** `KPI_FIELDS` (app.js:7259–7266) contains no `bottomDollar`, margin, cost, rate, name, phone, email, address, or `idNumber` field on any entity. → `ci/logic-test.mjs` static assertion that iterates every `KPI_FIELDS[entity]` value against a denylist of those substrings. (This is the hard CI guard against a future edit re-introducing a pricing-floor/PII field.)
5. **Banding correct.** `bandColor` returns the §7.1 colors at boundary values (24/25/49/50/74/75/89/90). → `ci/logic-test.mjs`.
6. **Score-pop fires on rise only.** Raising a numerator pops `+ΔN`/`+$Δ`; lowering it is silent. → logic/smoke.
7. **Revenue Goal admin-set.** Setting a positive `revenueGoal` in Settings → Company changes the sales Revenue Goal ring denominator; clearing it falls back to `REVENUE_GOAL_DEFAULT`. → smoke.
8. **Money-gate (Phase 1 decision).** Per the §11 Q1 answer, office/sales `$` rings/pops are shown only to the agreed tier; a `staff`-tier login (e.g. mechanic) does not see the gated dollars, and — per Q2 — the agreed behavior holds in a **logged-out/demo** session too (the test must assert both a below-tier login *and* `currentRole === ''`). → smoke (role-switch + logged-out).
8a. **Server-side write authority (Q3).** A `setConfig` `settings` write without a valid Admin password is **rejected by the backend** (verified against the live deployment, since `Code.gs` is gitignored and not in CI). → manual/staging verification checklist, not a CI gate.
9. **WINDOW_CATALOG intact.** No new popup added without a catalog entry. → `ci/check-window-catalog.mjs`.
10. **R-rulebook current.** Any new/changed UI element carries a `data-r` stamp. → `ci/gen-rule-usage.mjs --check`.
11. **Code-Atlas drift guard.** Any new/moved `APP-xx` chapter banner regenerated. → `node tools/gen-code-map.mjs --check`.
12. **Cache-bust + port swap** observed on deploy (CLAUDE.md gates; port 9147 for CI runs).

---

## 10. Risks & Edge Cases

| # | Risk / edge case | Severity | Mitigation |
|---|---|---|---|
| 1 | **Money leak via rings/score-pops** to `staff`-tier and **logged-out** sessions (§3.2, Q1/Q2) | High (revenue/collections visibility on a public URL) | Resolve Q1+Q2; the DSL is already walled (`KPI_FIELDS` has no money field) — builtin exposure is only the 2 `$` rings (office Collection, sales Revenue Goal). Any gate must close the `!currentRole` demo case explicitly |
| 2 | A future custom KPI tries to surface margin/cost **or sum `_totalPaid`** (Q1a) | High | **Keep `KPI_FIELDS` free of any pricing-floor/cost field** (AC #4, CI-enforced); decide Q1a on `_totalPaid` summing — either drop it, block `sum` on `customers`, or gate every `$`-unit DSL ring under the Q1 money-gate |
| 2b | **Server `setConfig` trusts the client** (Q3) — unauthenticated config rewrite via the public Pages URL | High (integrity/auth) | Verify the GAS handler rejects a `settings` write without a valid Admin password; the front-end `adminUnlocked()` gate is not authority |
| 3 | Orphan `settings.kpis[roleId]` after a role is deleted/renamed | Low (dead data) | Reconcile on role edit; `roleRings` already ignores unknown roles so no crash |
| 4 | Malformed admin spec crashes the dashboard | Medium | `kpiEval` try/catch → 0-ring; `wrValidateKpi` blocks save |
| 5 | Score-pop spam on bulk import (every numerator jumps) | Low (UX) | Acceptable today; consider suppressing pops during a bulk/import render in Phase 2 |
| 6 | Revenue Goal "month" ambiguity (start-month vs billed-month) | Low (correctness) | Documented §7.5; surfaced as Q5 if Jac wants billed-month |
| 7 | Multi-user: two admins edit `settings.kpis` concurrently | Low | `setConfig` is last-write-wins on a single blob; the diff-sync layer doesn't field-merge settings — note for `backend-data` |
| 8 | Performance: `kpiFor` runs for all 5 roles every render | Low | All-time aggregates over in-memory `DATA`; bounded by the render-budget warn (`frontend-performance`); revisit if history/snapshots add cost |
| 9 | Offline: dashboard reads stale local data | By design | Acceptable — KPIs are operational glance, not a system of record |
| 10 | The "Coming 2026" blur (`APP-22`) hides the live rings | Cosmetic/roadmap | Out of this area's scope to remove; noted so a reviewer doesn't think rings are dead (Q11) |
| 11 | **Save-then-revert UX:** a KPI override applied locally before `setConfig` resolves shows the new ring, then a reload reverts it if the write failed | Medium (data-integrity/trust) | Confirm `lockKpiFromWrangler` (app.js:3879) applies only after the write resolves, or toasts "save failed — reverting" (§5.3, Q11) |
| 12 | **Offline override drift:** the `localStorage` mirror (`jactec.settings`) holds an override that never reached the backend; a second device never sees it, and a backend reconcile could silently clobber it | Low–Medium (multi-user/offline) | Acceptable for a single-admin yard; document that overrides are not authoritative until `setConfig` succeeds; reconcile is last-write-wins (risk #7) |
| 13 | **Render-cost growth** if Phase 2 history snapshots `kpiSnapshot()` per-render across all 15 rings | Low–Medium (performance) | Keep snapshot O(rings); throttle daily snapshots off the render path; respect the `frontend-performance` render-budget warn |

---

## 11. Open Questions (for Jac)

> **Resolved 2026-06-29:** Q1/Q2 → D1 (dollar rings open to all internal logins; not a customer surface) · Q11 → D2 (keep the plate) · Q8 → D3 (add trend sparklines) · Q4 → D4 (Manager+ authors KPIs). Adopted: Q3 (per-role-password server verify), Q1a, Q5/Q6/Q7/Q9/Q10. See the Decisions block up top.

> No seed questions were supplied for this area; every question below is generated from reading the live code. **Q1, Q1a, Q2, Q3** are the security-weighted forks (money visibility, customer-spend summing, logged-out exposure, server-side write authority) and must be settled before any behavior change ships.

**Q1 — Money-visibility gate on the office/sales dollar rings (the load-bearing one).**
Today **every login (and the logged-out demo)** sees the office `Invoice Collection Rate` %, the sales `Revenue Goal` %, and the `+$X` score-pop on collections/revenue. The shipped permission model has a **money** tier (`canMoney()` app.js:14166) that gates seeing pricing/payments everywhere else (cards, invoices, membership billing). The KPI dashboard does not consult it. Options:
- **(a)** Gate the *dollar* rings (office Collection + sales Revenue Goal) and their `$` score-pops behind `canMoney()` — a `staff`-tier mechanic sees those rings hidden or as a generic %; only money+ sees the dollar deltas.
- **(b)** Gate only the **raw dollar score-pop** (`+$X`) but leave the **percentage** rings visible to all (a % is less sensitive than a dollar amount).
- **(c)** Leave fully open (status quo) — the yard is small, everyone's trusted, morale > secrecy.
*Trade-off:* (a) is the conservative, model-consistent choice but changes a shipped behavior the crew may rely on for morale; (c) keeps morale but means a `staff` login reads collection performance and dollar deltas. **Recommend (b)** as the balanced default, but this is Jac's call. *Note:* per §3.2, `mechanic/mtech/driver` are `staff`-tier and `office/sales` are `money`-tier — so option (a) mostly hides the office/sales **rings' dollars** from the **shop crew**, which is exactly the intent.

**Q1a — Customer money-digest as a `sum` source.** `_totalPaid` (lifetime customer spend) is in `KPI_FIELDS.customers` (app.js:7265) and is summable. No shipped ring sums it, but a future admin could author a "total customer spend $" ring that bypasses the Q1 gate (it's a DSL ring, not a builtin). Should we (i) **remove `_totalPaid` from the allowlist** (loses the useful "Active Customer Rate" *filter*), (ii) **block `agg:'sum'` on `customers`** (keeps it as a filter-only field), or (iii) **fold any `$`-unit DSL ring under the same Q1 money-gate** as the builtins? Trade-off: (iii) is the most complete (gates the field by *output unit*, not by entity), (ii) is the narrowest surgical fix.

**Q2 — Logged-out / demo money exposure.** `canMoney()` returns **true when there's no login** (`!currentRole`). If Q1 picks gate (a) or (b) built on bare `canMoney()`, the dollars stay **open in a logged-out/demo session** — which may be exactly where a stranger is poking at a public Pages URL. Should the money-gate be `currentRole && canMoney()` (closed when logged-out) or plain `canMoney()` (the existing app-wide convention, open in demo)? Trade-off: closing it is safer for a public URL; matching the existing convention keeps one money-gate rule across the app.

**Q3 — Server-side `setConfig` Admin verification (cannot read `Code.gs`).** The client gates KPI/Revenue-Goal writes behind `adminUnlocked()` and carries the Admin password, but the **authority must be the server**. Does the GAS `setConfig` handler reject a `settings` write without a valid Admin password? If not, the public Pages URL exposes an unauthenticated config-rewrite. **This must be verified (or made true) server-side** before relying on the front-end gate. (Also: should `lockKpiFromWrangler` defer the live apply until `setConfig` resolves, to avoid the "saved then reverted on reload" UX of §5.3?)

**Q4 — Who may author/edit KPIs?** Today it's **Admin** (Settings-gated). Should **Manager** tier also be allowed (managers approve/override but can't enter Settings)? Trade-off: more flexibility vs. keeping metric definitions a single-owner concern.

**Q5 — Revenue Goal "month": start-month vs billed-month.** The sales Revenue Goal counts a rental's price in its **start** month. For a multi-week rental crossing a month boundary, should revenue attribute to the start month (today), the billed month, or be prorated? Trade-off: start-month is simplest and matches the booking moment; billed-month matches cash timing.

**Q6 — Should goal-target rings read the company Revenue Goal as one source of truth?** A custom `goal` ring takes a per-ring numeric `target`. When the metric *is* revenue, should the ring be able to bind to `companyRevenueGoal()` (so changing the company goal updates the ring) rather than a frozen per-ring number? (Carried forward from the prior design's open question.)

**Q7 — Band default for new custom KPIs.** Assume **higher-is-better** (`band:'up'`) unless Wrangler detects an inverse metric (field-call rate, overdue count)? Or always ask in the authoring chat? (Carried forward.)

**Q8 — Trend/history (Phase 2 scope).** Is a per-ring sparkline / direction arrow worth a daily snapshot store, or do glance-level rings suffice? This is the main forward-looking feature decision and drives whether we need a new additive backend action.

**Q9 — The two null rings' priority.** Driving Score and Reputation are blocked on `gps-tracking` and `comms-notifications`. Should the empty rings stay visible ("Coming soon") or be **hidden** until their backend lands (so the dashboard isn't 2/15 dead)?

**Q10 — Orphan override cleanup timing.** When a role is renamed/deleted, clean `settings.kpis` immediately (on save) or lazily (ignore at read, today's behavior)? Immediate is tidier; lazy is zero-risk.

**Q11 — "Coming 2026" blur.** The header rings ride behind the `APP-22` morale plate. Now that the metric engine *is* wired, should the live rings be un-blurred and the plate retired/relocated? (Touches `APP-22`, arguably this area's surface.)

---

## 12. Dependencies & Sequencing

### 12.1 Upstream — this area READS from (must stay stable)

| Area | Why | Anchor |
|---|---|---|
| `rentals-dispatch` | `rentalPrice` → `_revenue`; status sets for On-Time/Show/Revenue | app.js:836 |
| `units-fleet` | `fleetInsp`, fleetStatus, inspectionStatus → Healthy/Ready | app.js:1702 |
| `invoicing-payments` | `invoiceTotals` → Collection Rate, `_paid`/`_billed` | app.js:1602 |
| `customers-crm` | `_digest.totalPaid`/`activePct`, account/funnel → Active Rate, Pipeline | app.js:5261 |
| `maintenance-shop` | `woBillable`, WO phase/cancelled, inspections → Breakeven, WO Rate | app.js:1776 |
| `wrangler-ai` | the authoring chat + action pipeline | app.js:9885 |
| `backend-data` | `getConfig`/`setConfig` persistence of `settings.kpis` | app.js:15637 |
| `design-system` | rings/charts use tokens + the R-rulebook + jactec-ui | app.js:3700 |

### 12.2 Downstream — blocks / informs

- The two **null rings** are blocked on `gps-tracking` (Driving Score) and `comms-notifications` (Reputation) — Phase 3 cannot start until those land a feed.
- Phase 2 **history/snapshots** depends on `backend-data` for a new additive action and on `frontend-performance` for the render-budget headroom.
- `accounting` and `automated-pricing` will *consume* KPI signals but are not part of this area.

### 12.3 What must land first

1. **Q1 + Q1a + Q10 money-visibility decisions** (Jac) — the changes with security weight (which rings/pops gate, customer-spend summing, and the logged-out/demo case); nothing with money exposure should ship before they're settled.
2. **Q11 server-side `setConfig` Admin verification** — verify (or make true) on the live deployment that a `settings` write is rejected without a valid Admin password. This is the integrity floor; it gates trusting any front-end authoring gate.
3. The CI regression guard (defaults === today) + the `KPI_FIELDS` money/PII denylist assertion (AC #4) confirmed green before any refactor.
4. Orphan-key reconciliation (small, before Phase 2 adds more override surface).

---

*End of DRAFT — every numbered decision above is open for Jac's critique.*
