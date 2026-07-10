# Automated Pricing — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/automated-pricing`
**Task branch:** `automated-pricing/spec` (proposed)
**Maturity:** greenfield
**Scope:** Add an engine that *proposes* (and, where Jac allows, *applies*) rental-rate changes — occupancy/utilization signals, seasonal rules, and AI-suggested adjustments — on top of today's fully-static per-category rates, always fenced by the bottom-dollar/margin floor and the Admin pricing gate.

---

## ✅ Decisions — 2026-06-29 critique (Jac) — ⚠️ SCOPE EXPANSION

Jac's direction makes this a **two-headed pricing engine** (rental + sale), bigger than the draft's rental-advisor scope. These supersede §1/§3/§4/§7/§8 where noted; **the spec body needs a revision pass to fully build out the sale-price engine + the basis model + the auto toggle.**

- **D1 · Full automation for RENTAL rates, by category, demand × supply (supersedes "advisor-only").** The engine **fully automates** per-category rental rates from a **demand-and-supply** signal — not advisor-only. Whether each change still needs a Manager+ tap or runs fully automatic is a **Settings switch (D5)**.
- **D2 · NEW: a SALE-price engine for `bottomDollar` + `askPrice` (scope expansion).** The engine **also computes the sale prices** used to sell units — `bottomDollar` (floor) and `askPrice` — derived as a **percentage of a configurable basis: % of cost · % of MSRP · % of option/list value · % of Auction Value.** This is net-new scope the draft listed as out-of-scope; it's now in. (Auction Value + MSRP bases come from **`market-research`** — see dependency note.)
- **D3 · "Scale" + bases are Manager+ Settings (resolves OQ-9, reshaped).** In Settings, **Manager+** sets the **scale** and the **percentages** that derive `bottomDollar`/`askPrice` from cost / MSRP / option value / auction value. So the price floor is **not** a guessed formula from a sale number — the sale numbers are themselves *derived* from a basis Manager+ configures. The rental-rate floor derives from cost / the computed `bottomDollar`.
- **D4 · Manager+ accepts and sees proposals (resolves OQ-1/OQ-2/OQ-3/OQ-14).** Accepting is **Manager+** (now server-verifiable via per-role passwords, `backend-data` D1). Proposals + their margin rationale are visible to **Manager+ only** — pricing strategy is management-only here (tighter than the open-visibility posture elsewhere, by Jac's explicit choice).
- **D5 · Settings toggle — approve-each vs full-automation.** A Settings switch decides whether **Manager+ must accept every change** or the engine **runs fully automatic** (per-category or global granularity — TBD in the revision). This is the master control over D1's automation.

**Dependency strengthened:** `market-research` is now a **harder dependency** — Auction Value, MSRP, and market rental-rate benchmarks feed both the demand-based rental pricing and the sale-price basis (D2/D3). Sequence market-research's data contract alongside this engine, not "Phase 2 optional."

**Defaults adopted:** member/weekend rates stay manual · no per-customer pricing (PII-clear) · 90-day signal retention · both cron + boot snapshot · surge/discount thresholds ship as first-cut numbers Jac tunes in-app.

---

## 1. Goal & Problem

### 1.1 The problem today
JacRentals prices every rental from **five hand-entered numbers per category** (`rate1Day`, `rate7Day`, `rate4Wk`, `weekend`, `memberDaily`) plus the sale-side trio (`msrp`, `askPrice`, `bottomDollar`). Those numbers are typed once and almost never revisited. They do not move when:

- the **12k Excavator** fleet is 100% out and three customers are waiting (under-pricing scarcity),
- it's **December** and demand is dead (over-pricing a cold category sits units idle),
- a competitor down the I-10 corridor undercuts the **Skid Steer 75hp** day rate (lost quotes nobody logs),
- a category's true cost crept up (fuel, parts) and the rate quietly fell below a healthy margin.

There is **no automation, no demand signal, and no recommendation code anywhere in the app** (confirmed: see §2). Every dollar of pricing optimization is left on the table or done in Jac's head.

### 1.2 What this area is for
A **pricing engine** that watches the signals the app already computes (utilization, availability, rental windows, ROI, bottom-dollar) and **surfaces concrete rate proposals** — "Bump the 12k Excavator 7-day rate $1,290 → $1,420 (+10%); it's been 100% utilized for 21 days" — that Jac (or an Admin) can **accept, edit, or dismiss** in one tap.

### 1.3 North star
> Every category's rate is *always defensible* — either Jac set it on purpose, or the engine proposed it from a signal Jac can see, and nothing the engine touches ever quotes below the bottom-dollar margin floor.

The engine is an **advisor first**. Auto-*apply* is a later, opt-in, per-rule phase — never the default, never silent (§8).

---

## 2. Current State (Baseline)

This documents exactly what exists, as canon. **Pricing is 100% static and manual.** There is no automation surface to build *onto* — only the static rate model to build *around*.

### 2.1 The static rate model (shipped)

| Concept | Where | Notes |
|---|---|---|
| Rate fields live on the **category** | `data.js:25` (seed), `config.js` (no defaults — born 0) | `memberDaily, rate1Day, rate7Day, rate4Wk, weekend` |
| Sale/margin fields on the category | `data.js:25` | `msrp, askPrice, bottomDollar` — the **margin floor** |
| Rate selection | `rentalPrice(r)` `app.js:836` | Picks the **cheapest blend** of 4-week/7-day/1-day across the window; member + weekend overrides |
| Unset-rate guard | `catRatesUnset(cat)` `app.js:873` | True when all three of `rate1Day/rate7Day/rate4Wk` are 0 — drives the quote-time caution flag so a $0 category never quotes free |
| Per-unit pricing | `unitRentalPrice(r, unitId)` `app.js:879` | Each unit billed by **its own** category over the shared window |
| Transport pricing | `computeTransportPrice()` `config.js:491`, `TRANSPORT_RATES` `config.js:471` | `perMile 3.5, loadPerLeg 50, fuelPerLeg 20` — **out of scope** for v1 (rental rates only) |

`rentalPrice()` core, verbatim shape (`app.js:854–858`):

```js
let best = null;
for (let mm = 0; mm <= Math.floor(days / 28); mm++) {
  for (let ww = 0; ww <= Math.floor((days - 28 * mm) / 7); ww++) {
    const dd = days - 28 * mm - 7 * ww;
    const total = mm * cat.rate4Wk + ww * cat.rate7Day + dd * cat.rate1Day;
    if (best == null || total < best.total) best = { total, mm, ww, dd };
  }
}
```

The member override (`days * cat.memberDaily`) and the weekend override (`cat.weekend` for Fri→Sun / Fri→Mon / Sat→Mon, NOT Sat→Sun) sit **above** the blend (`app.js:844–851`).

### 2.2 How rates are edited today (shipped)

- Category detail **Pricing** section: five inline-editable fields via `priceFld()` `app.js:6188`, each stamped `{ admin: true }` → **editing a rate fires the requireAdmin popup**; Admin/Owner pass straight through. **Reading rates is open to all roles; changing one is Admin-only.**
- Category **reference card** shows read-only rates (`app.js:4878`).
- Investment section shows `msrp / askPrice / bottomDollar` and a derived ROI (`app.js:6210`); `bottomDollar` already feeds an ROI residual-value calc at `app.js:1852`.

### 2.3 What is absent (greenfield — must be built)

| Missing | Consequence |
|---|---|
| Any demand/utilization **time series** | No signal to price against — utilization is computed *instantaneously* per render, never stored |
| Any **rate-history / audit trail** | Can't tell who changed a rate, when, or from what — required before auto-apply |
| Any **proposal/recommendation** entity, store, or UI | Nothing to accept/dismiss |
| Any **seasonal / rule** config | No way to express "December = −15% on light towers" |
| Any **competitor / market** data | Benchmarking deferred to the `market-research` area (dependency) |
| Any **backend pricing action** | `backendCall` has membership/Stripe/config actions but no pricing action |

### 2.4 Adjacent code this must build on

- **Utilization is already derived** for the category Investment/Fleet summary (avg hours, ROI, `time/dollar util (backend)` placeholder `app.js:6211`) — the engine should source utilization from the same derivations, not invent a parallel one.
- **`FLAG_CATALOG`** (flag-color-system.md) is the established pattern for "a catalog of declarative rules in `config.js` evaluated at render time." The pricing **rule catalog** should imitate that shape exactly (id / label / condition / effect).
- **KPI metric engine** (`financials-kpi`, `config.js:301/557`) already has a DSL + admin authoring pane — the seasonal/utilization rule authoring UI should reuse its Settings-board conventions, not fork a new one.
- **`canMoney()`** `app.js:14166` and the `admin:true` field gate are the two existing fences; the engine must respect both (§3).

---

## 3. Users, Roles & Data Gates

### 3.1 Tier model (shipped — `config.js:326`)
Five tiers, strict superset ladder; gates compare `tierRank`:

```
staff(1) → money(2) → manager(3) → admin(4) → developer(5)
```
Built-in role→tier (`config.js:340`): mechanic/mtech/driver = `staff`; office/sales = `money`; manager = `manager`; admin = `admin`; owner→admin (compat bridge).

**The two shipped fences this engine inherits (do not loosen either):**

1. **Margin-visibility floor = `money` (config.js:320–323, verbatim comment):**
   `staff` is "operational only"; `money` is "+ see pricing/margin." So **the
   existing law already says staff should NOT reason about margin** — the engine
   must honor that, not invent a looser one. This is the anchor for OQ-2/OQ-3.
2. **Rate-edit fence = `admin`, BACKEND-VERIFIED (not just a client tier check).**
   Editing a rate field is `{admin:true}` on `priceFld` (`app.js:6188`) → fires
   `requireAdmin()` (`app.js:13076`), which **does not trust the client tier**: it
   POSTs the typed password to `backendCall('getConfig', {password})` and only
   proceeds on `{ok:true}` (`app.js:13081`). In demo/offline (`!backendPassword`)
   it falls open. **Accepting a proposal is a rate change and therefore MUST route
   through this same backend-verified path** — see §5.2. The client-side tier table
   below is convenience/affordance; the server password check is the real authority.

### 3.2 Who touches Automated Pricing

| Tier | Sees rates? | Sees proposals? | Accept / dismiss proposal? | Edit/author rules? | Enable auto-apply? |
|---|---|---|---|---|---|
| `staff` | ✅ read-only (today's behavior) | ❌ (proposed default — see OQ-2) | ❌ | ❌ | ❌ |
| `money` (Office/Sales) | ✅ | ✅ read | ❌ (see OQ-2) | ❌ | ❌ |
| `manager` | ✅ | ✅ | ✅ (proposed) | ❌ | ❌ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `developer` | ✅ | ✅ | ✅ | ✅ | ✅ |

**Anchoring rationale:** the *act of changing a rate* is already Admin-gated and **backend-password-verified** (`admin:true` on `priceFld` → `requireAdmin` → `getConfig`, §3.1). The engine must **not loosen that**. Accepting a proposal **is** a rate change, so by the existing law it should require Admin **and the same server-side password proof** (§5.2). Whether **manager** may accept (a tier below admin) is a **gate-loosening decision** surfaced as **OQ-1** — and it carries a hidden cost: there is no server-verified manager gate today (only the Admin password), so manager-accept would be client-tier-only and forgeable on a public SPA unless a new server check is built (**OQ-14**). Not silently decided.

### 3.3 Margin-floor / pricing-floor visibility (hard gate)
`bottomDollar` is the **margin floor**. Two distinct concerns:

1. **Enforcement (always on, all tiers):** the engine **MUST NOT propose** a rate that drops the effective day-equivalent below a `bottomDollar`-derived floor (§7.4). This is a computation guard, not a visibility gate — it runs identically regardless of who is logged in (and runs again **server-side** on accept, §5.2).
2. **Visibility of the floor number.** Reconciled against the shipped law (§3.1): margin reasoning is a **`money`-tier+** privilege (`config.js:320`). So the conservative, code-consistent default is a **two-step gate**, NOT "manager+ only":
   - **`staff`:** sees no proposal at all (proposed default, OQ-2) → never sees a floor number or margin rationale. If staff visibility is ever turned on (OQ-2), they see only a **non-numeric "within margin" badge**, never the dollar.
   - **`money` (Office/Sales):** already entitled to "see pricing/margin" today → MAY see the dollar floor and the full rationale text. The draft's earlier "manager+ only for the dollar" was *tighter than the shipped law and is corrected here* to `money+`, because gratuitously hiding margin from a tier the code already trusts is inconsistent — but whether the **rationale string** should still soften to a badge for `money` (vs. the raw floor number) is **OQ-3**.
   - **`manager+`:** full rationale + floor number.

   Note: `bottomDollar` is *currently* shown in the Investment section without an explicit tier gate at the field level (any role that can open the category detail sees it). That is an **existing** exposure this area does not widen; if anything, OQ-13 asks whether the Investment `bottomDollar` field should itself be `money`-gated to match the §3.1 law — but that is a `units-fleet` fix, flagged here, not silently changed by this spec.

### 3.4 Customer isolation / PII
Pricing operates on **categories** (equipment classes), not customers. The engine reads aggregate utilization and rental *windows*, never customer identity, balances, or PII. **No customer record, name, company, card, or Stripe id enters any proposal, rule, or stored signal.** (Member pricing stays where it is — `isActiveMember` in `rentalPrice` — untouched.) This keeps the area fully clear of the customer-isolation gate. *Confirm no per-customer pricing is in scope: see OQ-7.*

---

## 4. Data Model

Schema-less Sheets / `data.js`-shaped objects. All new fields are **additive** and default-safe (absent = "no automation," identical to today).

### 4.1 Category — new additive fields

| Field | Type | Default (absent) | Meaning |
|---|---|---|---|
| `pricingMode` | `'manual' \| 'advised' \| 'auto'` | `'manual'` | Per-category engine posture. `manual` = today. `advised` = engine proposes only. `auto` = engine may apply rules flagged auto-safe (§8 Phase 3). |
| `rateHistory` | `RateChange[]` | `[]` | Append-only audit of rate changes (manual *and* engine). |
| `floorOverride` | `number \| null` | `null` | Admin can pin a custom price floor above the derived `bottomDollar` floor. |
| `lastAdvisedAt` | ISO string | — | When the engine last produced a proposal for this category (dedup / cadence). |

`RateChange` shape:
```js
{
  changeId: 'RC0001',
  at: '2026-06-28T14:02:00Z',
  by: 'admin',                 // role id (NOT a person/PII)
  source: 'manual' | 'proposal' | 'auto',
  proposalId: 'PR0007' | null, // links to the proposal it came from
  field: 'rate7Day',
  from: 1290, to: 1420,
  rule: 'util-surge' | null    // which rule fired, if engine-sourced
}
```

### 4.2 Pricing Proposal — new entity (`DATA.pricingProposals`)

One record per engine suggestion. Lives on its own Sheets tab `pricingProposals`.

```js
{
  proposalId: 'PR0007',
  categoryId: 'CAT011',
  field: 'rate7Day',            // which of the 5 rate fields
  currentValue: 1290,
  proposedValue: 1420,
  deltaPct: 10.1,
  rule: 'util-surge',           // rule id from the catalog (§7.2)
  ruleLabel: 'High Utilization Surge',
  rationale: 'CAT011 has been 100% utilized for 21 days; 3 unfilled requests.',
  signals: { util14d: 1.0, availNow: 0, openWindowsOverlap: 3 },  // the evidence
  floorOk: true,                // passed the bottom-dollar guard (§7.4)
  status: 'open',               // 'open' | 'accepted' | 'edited' | 'dismissed' | 'stale'
  createdAt: '2026-06-28T14:00:00Z',
  resolvedAt: null,
  resolvedBy: null,             // role id
  appliedValue: null            // what actually got applied (may differ if edited)
}
```

### 4.3 Utilization Signal Snapshot — new entity (`DATA.pricingSignals`)

The engine needs a **time series** that doesn't exist today (§2.3). A small daily snapshot per category, written by a backend cron (§5.4) and/or on app boot.

```js
{
  snapId: 'SNAP-CAT011-2026-06-28',
  categoryId: 'CAT011',
  date: '2026-06-28',
  totalUnits: 5,
  rentableUnits: 4,           // in-yard, inspection not Failed
  unitsOnRent: 4,
  utilization: 1.0,           // unitsOnRent / rentableUnits
  openRequests: 3,            // rentals wanting this category with no unit free
  avgDayRateBilled: 1180      // derived from rentalPrice over the day's active rentals
}
```

Retention: rolling window (proposed 90 days, OQ-5). Sheets tab `pricingSignals`.

### 4.4 Pricing Rule Catalog — config (not data)

Like `FLAG_CATALOG`, the rule set is **hardcoded defaults in `config.js`** for v1 (`PRICING_RULES`), with a parked Settings authoring UI (§8 Phase 2). See §7.2 for the shape and the default rules.

### 4.5 Migration concerns
- All new fields are absent-safe → **zero migration** for existing categories; they read as `pricingMode:'manual'`, behave exactly as today.
- `pricingProposals` / `pricingSignals` tabs are created on first write (schema-less Sheets create-on-demand, same as other tabs).
- `rateHistory` starts empty; the **first** manual edit after ship begins populating it (no backfill — OQ-6 asks whether to backfill a synthetic "baseline" entry).

---

## 5. Backend / Integration Contract

Backend = Google Apps Script + schema-less Sheets, single `backendCall(action, payload)` entry point, `Code.gs` gitignored. **All new behavior is additive actions.** Code.gs cannot be read here; this defines the *contract* only.

### 5.1 Existing actions (reference, unchanged)
`mapsKey`, `setConfig`, `membershipEnroll/Cancel/Reactivate`, `stripeSetDefault/RemoveCard`, `uploadCapture`, `archiveAgreementMedia`, `feedback` (`app.js` various). Pricing adds to this list; it changes none.

### 5.2 `savePricingProposalResolution` (additive)
Called when a user accepts / edits / dismisses a proposal.

```
backendCall('savePricingProposalResolution', {
  proposalId, categoryId,
  decision: 'accept' | 'edit' | 'dismiss',
  field, appliedValue,          // appliedValue null on dismiss
  password                       // Admin password — re-verified server-side (see below)
}) → { ok, proposal, rateChange } | { ok:false, error:<code> }
```

**Server-side gate (defense-in-depth — reuse the SHIPPED pattern, do not invent a weaker one).**
A rate change today is gated by `requireAdmin()` (`app.js:13076`), which proves
authority by **POSTing the Admin password to the backend** (`getConfig`) and
trusting `{ok:true}` — it explicitly does NOT trust a client-asserted tier
(`app.js:13077–13082`). `savePricingProposalResolution` MUST inherit exactly this:

- **DO NOT** send a client-asserted `byTier` and trust it (an earlier draft of this
  spec did — that is rejected here as forgeable; the SPA is public via Pages so any
  client value is attacker-controlled). Instead **carry the `password`** through the
  same `requireAdmin` flow the field edit already uses and let the server validate it.
- Server steps on `decision:'accept'|'edit'`: (1) validate `password` (Admin, or the
  OQ-1 manager threshold if Jac loosens it — but the manager threshold has **no
  password concept today**, which is itself a reason OQ-1 is non-trivial: loosening to
  manager means inventing a manager-level server check that doesn't exist); (2)
  re-read the live `currentValue` from the category row and **reject as `stale`** if it
  drifted from the proposal's `currentValue` (someone hand-edited the rate after the
  proposal was generated — §10 staleness); (3) re-run the §7.4 floor guard on
  `appliedValue` server-side; (4) **atomically** write the new rate to the category row
  AND append a `RateChange` to `rateHistory`, then flip proposal `status`.
- **Error codes** (returned as `error`, never throw): `'bad-password'`,
  `'stale'` (currentValue drifted), `'below-floor'`, `'already-resolved'`,
  `'unknown-proposal'`. The UI maps each to a specific toast and reverts the optimistic apply.
- **`decision:'dismiss'`** needs no password (it changes no money) — but is still tier-gated
  client-side to the proposal-visibility tier (it shouldn't let a hidden-from-staff
  proposal be dismissed by staff). Dismiss only flips `status:'dismissed'` + `resolvedBy`.

### 5.3 `snapshotPricingSignals` (additive)
```
backendCall('snapshotPricingSignals', { date }) →
  { ok, written: <count>, signals: SignalSnapshot[] } | { ok:false, error }
```
Computes today's per-category utilization snapshot (server-side, from the rentals/units tabs) and appends to `pricingSignals`. Idempotent per `(categoryId,date)` — re-running overwrites the day's row, never duplicates.

### 5.4 Cron / cadence
A GAS time-driven trigger runs `snapshotPricingSignals` once daily (off-hours). Greenfield risk: **if the cron is the only writer, the series has gaps when the sheet/script is paused.** Mitigation: app boot also opportunistically writes *today's* snapshot if missing (cheap, idempotent). **Whether to depend on a server cron vs. a boot-time write vs. both is OQ-4.**

### 5.5 AI-suggested adjustments (Mr. Wrangler tie-in — Phase 2+)
The roadmap names "AI-suggested adjustments." The app already has a **Mr. Wrangler** agentic surface (`2026-06-27-wrangler-agentic-design.md`, `find_categories` tool `app.js:10099`). Phase 2 can add a read-only Wrangler tool `propose_rate(categoryId, field)` that returns a *draft* proposal for human review — **never** auto-applies, **never** sees PII, and **always** runs the §7.4 floor guard before returning. PII/leak rules for this tool (hard, Phase 2):

- **Input to the model = category aggregates ONLY** (utilization series, current rate fields, `bottomDollar`-derived floor, open-request counts). **No** customer record, name, company, balance, card, or Stripe id enters the prompt — same isolation as §3.4.
- The model's output is **structured** (field, deltaPct, proposedValue, short rationale), not raw free text written straight into the rate. Any rationale string it emits is **length-capped and scrubbed** before persisting to `proposals.rationale`, and **must not surface internal cost numbers to a non-`money` tier** (the §3.3 visibility gate applies to AI-authored rationale exactly as to rule-authored rationale). **Whether to store the model's free-text rationale at all vs. a fixed template is OQ-15.**
- This is an LLM provider call (Anthropic/Claude per the project stack) routed through the backend; **no model identifier, API key, or prompt-embedded secret appears in the repo** (public via Pages) — referred to by name only. A model/provider failure degrades to "no AI proposal this cycle," never to a silent or unfloored change. Treated as a Phase-2 dependency, not v1.

### 5.6 External integrations
- **Competitor / market benchmarking** → owned by the `market-research` area; **out of scope here**, consumed via that area's contract once it lands.
- **QuickBooks / Stripe** → not touched (pricing is rate-card, not billing).
- **Failure handling & offline:** reads degrade gracefully — proposals render from `DATA.pricingProposals` already in memory. **Writes split by money-sensitivity:**
  - **Dismiss** (no money) may queue via the existing `saveSoon()` path and re-sync, like any other edit.
  - **Accept/Edit** (a money action) **MUST NOT be silently queued offline** — it requires a *live* backend password verification (§5.2). If the device is offline, the "Wrangle it" action is **disabled with a stamped "needs the yard office (online) to apply"** hint, not optimistically applied-and-queued. Optimistically writing a rate that the server might later reject for `bad-password`/`stale`/`below-floor` would let an unverified rate quote in the meantime — unacceptable for a money gate. The optimistic apply is allowed only *after* the synchronous server `{ok:true}` returns; on any `{ok:false}` the UI reverts and toasts the specific error code.
  - This is stricter than a normal field edit deliberately: a rate is money, and the engine must never let an unconfirmed proposal-apply leak into a live quote.

---

## 6. UX / UI

All surfaces in the **yard data-plate** language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), corner rivets, Saira Condensed stamped uppercase labels (~2px tracking), the single safety-orange `#ff7a1a` accent for the primary "ignition" action only, the hi-vis hazard stripe as the signature motif, and a **light wrangler/ranch seasoning in copy** ("Wrangle the rate", "Round up", "Rein it in"). Status meaning still flows through the R/Y/G flag colors — orange stays brand chrome, never a status (per flag-color-system.md §2).

### 6.1 The Pricing Proposal banner (in-context, not a popup)
On the **Category detail Pricing section**, when an open proposal exists for that category, a **stamped advisory plate** sits above the rate fields:

```
┌─ rivet ───────────────────────── rivet ─┐
│ ▓▓ ADVISED ▓▓   12k Excavator           │   ← hazard-stripe cap + Saira stamp
│ 7-Day  $1,290 → $1,420   (+10%)         │   ← from→to, delta
│ "100% utilized 21 days · 3 unfilled"    │   ← rationale (ranch-trimmed copy)
│ ✓ within margin                          │   ← floor badge (green) — §3.3 gating
│ [ Wrangle it ]  [ Edit ]  [ Dismiss ]    │   ← ignition / ghost / ghost(red)
└─ rivet ───────────────────────── rivet ─┘
```

- **"Wrangle it"** = the orange ignition primary (accept-as-proposed). Fires requireAdmin (or manager per OQ-1) → optimistic apply → `savePricingProposalResolution`.
- **"Edit"** opens an inline rate field pre-filled with `proposedValue`, clamped to the floor (typing below floor shows a red hazard hint and disables apply).
- **"Dismiss"** = ghost button, red accent (danger variant of the hazard stripe), marks `status:'dismissed'`.
- **R-rulebook:** the banner, its buttons, and the floor badge each need a `data-r` stamp (reuse `R17` for the ignition button per existing convention `app.js:3691`; new banner container needs a fresh `Rxx` — regenerate `rule-usage.js`).

### 6.2 Pricing Round-Up review popup (NEW window — needs WINDOW_CATALOG entry)
A single popup that lists **all open proposals across all categories** for a manager/admin to triage in one sitting. Reached from a count chip on the Categories card header ("3 advised").

- Steel panel, rivets, saddle-stitch (tan dashed) dividers between proposal rows.
- Each row: category pill (R2), field, from→to delta bar, rationale, floor badge, per-row `[Wrangle] [Dismiss]`, plus a footer **`[Wrangle all clear]`** (batch-accept only the floor-OK, non-conflicting ones).
- Empty state: a stamped "Corral's quiet — no rate moves to make" plate.
- Loading: skeleton rows with the hazard-stripe shimmer.
- Error: "Couldn't reach the yard office — proposals shown may be stale" inline strip.
- **This is a new popup → MUST be added to `WINDOW_CATALOG` (admin Rulebook "Windows" tab), or `ci/check-window-catalog.mjs` fails CI.** Its `data-r` stamps must be reflected in `rule-usage.js`.

### 6.3 Rate-history mini-log
In the category Pricing section, a collapsible **"Rate log"** (saddle-stitch divider) listing `rateHistory` entries newest-first: `Jun 28 · Admin · 7-Day $1,290→$1,420 · util-surge`. Read-only. Visible to `money+` (it reveals rate movement; see OQ-3 on whether staff see it).

### 6.4 `pricingMode` selector
A small segmented control (Manual · Advised · Auto) in the Pricing section, **Admin-gated** (same `admin:true` fence as the rate fields). "Auto" is **disabled/locked in v1** with a stamped "Phase 3" tooltip until auto-apply ships (§8).

### 6.5 Mobile reflow
Per `jactec-ui` mobile rules: the proposal banner collapses to a full-width stacked plate; the three actions become a bottom-aligned row (≥44px touch targets); the Round-Up popup becomes a bottom sheet with one proposal per snap-card and swipe-to-dismiss (with Vibration-API haptic confirm). Respect `prefers-reduced-motion` on the hazard-stripe shimmer and delta-bar animation; visible focus rings on all actions.

### 6.6 Self-critique gate
Every new/changed surface here goes through the `jactec-ui` skill (screenshot + self-critique before showing Jac), per CLAUDE.md design law. Quality floor: responsive, visible focus, reduced-motion respected.

---

## 7. Business Rules / Derivations / Money

### 7.1 Utilization (the primary signal)
```
utilization(cat, date) = unitsOnRent / rentableUnits
rentableUnits = units in-yard AND inspectionStatus !== 'Failed'   (matches §2.4 derivation)
```
Edge cases: `rentableUnits === 0` → utilization is **undefined**, not 1.0 or 0 (a category with every unit Failed/Sold isn't "fully booked," it's *out of service*) → engine emits **no surge proposal**, optionally a "fleet down" advisory. A single-unit category swings 0↔100% violently → require a **multi-day window** (proposed 14-day trailing avg) before surging, not a single day.

### 7.2 Rule catalog shape (mirrors `FLAG_CATALOG`)
```js
{
  id: 'util-surge',
  label: 'High Utilization Surge',
  field: 'rate7Day',                 // which rate field it adjusts (or 'all')
  when: (cat, signals, ctx) => bool, // does this rule fire?
  effect: (cat, signals) => ({       // proposed change
    field, deltaPct, proposedValue, rationale
  }),
  autoSafe: false                    // may this rule auto-apply in Phase 3?
}
```

### 7.3 Default rules (v1, hardcoded in `config.js → PRICING_RULES`)

| id | Label | Fires when | Effect (proposed) |
|---|---|---|---|
| `util-surge` | High Utilization Surge | 14-day avg util ≥ 0.9 **and** ≥1 open request | +10% to `rate1Day`/`rate7Day` (clamped to floor) |
| `util-slack` | Low Utilization Discount | 14-day avg util ≤ 0.25 | −10% to `rate7Day`/`rate4Wk`, **never below floor** |
| `seasonal` | Seasonal Adjustment | current month ∈ rule's month set | ±% per the seasonal table (admin-authored, Phase 2; v1 ships an empty seasonal set) |
| `rates-unset` | Unpriced Category | `catRatesUnset(cat)` true (`app.js:873`) | Propose seeding from a sibling/peer category's rates — flagged "needs review," never auto |
| `floor-breach` | Below Margin Floor | effective day-rate < floor (§7.4) | Propose raising to floor (defensive; should rarely fire) |

**The exact thresholds (0.9 / 0.25), window length (14d), and step size (±10%) are first-cut numbers and are OQ-8 — Jac must tune them.**

### 7.4 The bottom-dollar margin floor (HARD, non-negotiable)
No proposal — engine, AI, or batch — may set a rate whose **day-equivalent** falls below the derived floor:
```
floor = floorOverride ?? derivedFloorFrom(bottomDollar)
```
`bottomDollar` is a **sale** number, not a daily rate, so `derivedFloorFrom()` needs an explicit definition. **Proposed v1 interpretation:** the floor protects the *7-day* and *4-week* blend such that the implied daily never drops below a cost-recovery threshold Jac defines as a % of `bottomDollar` amortized over expected rental-days-to-recoup. **This formula is genuinely undefined today and is OQ-9 — Jac must specify how `bottomDollar` (a sale price) maps to a daily-rate floor.** Until specified, v1 ships a **conservative guard**: never propose a *decrease* that takes any rate below its current value × (1 − maxDrop), with `maxDrop` capped (e.g. 15%), AND never propose below a flat admin-set `floorOverride` if present. The decrease rules (`util-slack`) are **disabled** until the floor formula is locked.

### 7.5 Member & weekend rates
The engine, by default, proposes only the **standard** rate fields (`rate1Day/rate7Day/rate4Wk`). `memberDaily` and `weekend` are pricing *policy* Jac sets deliberately (member is a loyalty lever, weekend is the getaway promo) — **out of scope for automated adjustment in v1** to avoid the engine quietly eroding member value. Surfaced as OQ-10.

### 7.6 Idempotency / dedup
One **open** proposal per `(categoryId, field)` at a time. A new signal that would re-propose the same field updates the existing open proposal's `proposedValue/rationale/signals` rather than stacking a second. Accepting/dismissing clears it; the next snapshot may create a fresh one (gated by `lastAdvisedAt` cadence, proposed ≥7 days between repeat proposals on the same field — OQ-8).

---

## 8. Phasing & Milestones

### Phase 1 — MVP: Advisor (in-scope for v1)
- Additive category fields (`pricingMode` default `manual`, `rateHistory`, `floorOverride`).
- `pricingSignals` snapshot (boot-time write at minimum; cron optional per OQ-4).
- `PRICING_RULES` catalog in `config.js` with `util-surge`, `rates-unset`, `floor-breach` (the **increase/neutral** rules — decrease rules parked until the floor formula lands, §7.4).
- `pricingProposals` entity + generation on boot/snapshot.
- **In-context proposal banner** (§6.1) and **rate log** (§6.3) on Category detail.
- **Round-Up review popup** (§6.2) + WINDOW_CATALOG entry.
- `savePricingProposalResolution` backend action with server-side gate + atomic rate-write + `rateHistory` append.
- Accept requires **admin** (OQ-1 may extend to manager).

**Out of scope for v1:** auto-apply (`pricingMode:'auto'` locked); seasonal authoring UI; competitor/market benchmarking; member/weekend automation; AI `propose_rate`; transport-rate automation; per-customer pricing.

### Phase 2 — Seasonal rules + AI suggestions + authoring
- Settings authoring pane for seasonal rules + rule thresholds (reusing KPI-engine Settings conventions).
- Mr. Wrangler `propose_rate` read-only tool (§5.5).
- `util-slack` decrease rule **after** the §7.4 floor formula is locked.

### Phase 3 — Opt-in auto-apply
- Per-category `pricingMode:'auto'` unlock; only `autoSafe:true` rules apply, only within a bounded delta, always logged to `rateHistory` with `source:'auto'`, always floor-guarded, with a daily digest of auto-changes for Admin review and one-tap rollback.

---

## 9. Acceptance Criteria

Testable, with CI-gate impact noted.

1. A fresh category with no new fields prices **byte-identical** to today (`rentalPrice()` untouched; no proposal renders) — covered by `ci/logic-test.mjs` (add a "manual mode = legacy" assertion).
2. With `rates-unset` true, exactly one `rates-unset` proposal exists and is non-auto.
3. A category at 14-day util ≥ 0.9 with an open request produces one `util-surge` proposal with `floorOk:true` and the correct `+10%` `proposedValue`.
4. **No** generated proposal ever has `proposedValue` below the floor guard (§7.4) — assert in `ci/logic-test.mjs`.
5. Accepting a proposal: writes the new rate to the category, appends a `RateChange` to `rateHistory`, flips proposal `status:'accepted'`, and a **wrong/absent Admin password** is rejected by the server (`{ok:false, error:'bad-password'}`, reusing the `getConfig` verification at `app.js:13081`) and the UI reverts the optimistic apply. (A client-asserted tier is NOT accepted as proof — §5.2.)
5a. **Staleness:** if the category's live `currentValue` drifted from the proposal's `currentValue` between generation and accept, the server returns `error:'stale'`, marks the proposal `status:'stale'`, and the UI forces a re-review instead of applying.
6. Dismiss sets `status:'dismissed'` and the banner clears; the field is unchanged.
7. The Round-Up popup is registered in `WINDOW_CATALOG` → `ci/check-window-catalog.mjs` passes.
8. Every new UI element carries a `data-r` stamp → `ci/gen-rule-usage.mjs --check` passes (regenerate after build).
9. If a chapter banner is added to `app.js` for the engine, `tools/gen-code-map.mjs --check` passes (regenerate the Code Atlas).
10. `ci/smoke.mjs` passes (remember the port-8000→9147 swap before running gates, per CLAUDE.md).
11. Offline: **accept/edit is disabled** (no optimistic queue — §5.6, it's a money action needing live verify); **dismiss** still queues via `saveSoon` and re-syncs. A server-gate failure on a *live* accept reverts the optimistic apply and toasts the specific `error` code.
12. Reduced-motion: hazard-stripe shimmer and delta-bar animation are static.

---

## 10. Risks & Edge Cases

| Risk | Severity | Mitigation |
|---|---|---|
| **Margin leak** — engine proposes below cost | Critical | Hard §7.4 floor guard, server-side re-check, decrease rules parked until floor formula locked |
| **Silent rate change** erodes trust | High | v1 is advisor-only; nothing applies without an Admin tap + `rateHistory` audit; auto-apply is Phase 3 opt-in |
| **Floor formula undefined** (`bottomDollar` is a sale price, not a daily) | High | OQ-9; ship conservative %-drop guard until locked; no decreases in v1 |
| **Thin signal** — single-unit categories swing wildly | Med | 14-day trailing avg, `rentableUnits===0` → undefined not 100% |
| **Cron gap** — no daily snapshot when script paused | Med | Boot-time idempotent write as backstop (OQ-4) |
| **Pricing rationale leaks the margin floor** to staff | Med | OQ-3; non-money tiers see "within margin" badge, not the dollar |
| **Proposal staleness** — rate moved manually after a proposal generated | Med | Re-validate `currentValue` server-side on accept; mark `status:'stale'` if drifted, force re-review |
| **Sheets growth** — `pricingSignals` unbounded | Low | Rolling 90-day retention (OQ-5) |
| **Multi-user race** — two admins accept different edits to the same field | Med | Server re-reads live `currentValue`; second accept hits `error:'stale'` or `error:'already-resolved'` and is forced to re-review (not last-write-wins on the *rate*). `rateHistory` append stays additive (both attempts traceable). |
| **Forged-tier accept** on a public SPA | High | Server does NOT trust a client tier; accept re-verifies the Admin password via `getConfig` (§5.2). Manager-accept (OQ-1) has no server check yet → OQ-14. |
| **Unconfirmed rate leaks into a live quote** (optimistic apply before server confirm) | High | Accept applies only *after* synchronous `{ok:true}`; offline accept is disabled, not queued (§5.6). |
| **PII / cost-number creep** via AI rationale | High (Phase 2) | `propose_rate` receives category **aggregates only** — no customer fields, names, balances, or Stripe ids in the prompt; stored rationale is structured/length-capped, scrubbed of internal cost numbers so it can't leak margin to a non-`money` tier (OQ-15); repo carries no model id/key/prompt-embedded secret (public via Pages). |

---

## 11. Open Questions (for Jac)

> **Resolved 2026-06-29 (with a scope expansion — see the Decisions block):** OQ-1 → full automation, Manager+ accepts (D1/D4) · OQ-2/OQ-3 → Manager+ only sees proposals (D4) · OQ-9 → sale prices derived from a Manager+-set basis (% of cost/MSRP/option/auction), not a guessed floor formula (D2/D3) · plus a Settings approve-vs-auto toggle (D5) and a NEW sale-price engine (D2). `market-research` becomes a hard dependency. Adopted: OQ-5/OQ-7/OQ-10, thresholds. **The spec body needs a revision pass to build out the sale-price engine.**

*(No seed questions were captured from the code-grounding map; all below are generated from the real code and the forks hit while drafting.)*

| # | Question | Trade-off |
|---|---|---|
| **OQ-1** | **Who may accept a proposal — admin only, or manager+?** | Today *changing a rate* is Admin-only (`admin:true` on `priceFld`). Letting **manager** accept loosens that gate. Tighter (admin-only) = consistent with today, fewer hands on pricing. Looser (manager) = faster yard response to demand, but is a real gate-loosening — needs explicit blessing. |
| **OQ-2** | **Do `money`-tier (Office/Sales) and `staff` see proposals at all, or only manager+?** | Office sees demand daily and might triage; but proposals reveal margin reasoning. Show-to-money = more eyes; manager-only = tighter. |
| **OQ-3** | **May proposal rationale name the dollar floor to non-money tiers?** | Numeric floor in rationale = transparent but exposes margin to staff. Non-numeric "within margin" badge = safe default. |
| **OQ-4** | **Signal source: server cron, boot-time write, or both?** | Cron-only = clean but gaps if script paused. Boot-only = no infra but depends on someone opening the app daily. Both = robust, slightly more code. |
| **OQ-5** | **`pricingSignals` retention window?** | 90 days proposed. Longer = better seasonal learning later; shorter = smaller sheet. |
| **OQ-6** | **Backfill a synthetic baseline `rateHistory` entry on ship?** | Backfill = the log shows a starting point; no backfill = log only reflects real future changes (cleaner provenance). |
| **OQ-7** | **Confirm: no per-customer / per-deal pricing in scope?** | v1 prices categories only (keeps clear of customer-isolation gate). Per-customer pricing would pull PII into the engine — big scope + gate change. |
| **OQ-8** | **Tune the default thresholds:** surge ≥0.9 / slack ≤0.25, 14-day window, ±10% step, ≥7-day repeat cadence. | First-cut numbers. Too aggressive = jumpy rates; too soft = no movement. Jac knows the yard's real demand rhythm. |
| **OQ-9** | **Define `derivedFloorFrom(bottomDollar)` — how does a SALE price map to a daily-rate floor?** | This formula does not exist today and blocks all decrease rules. Options: % of bottomDollar amortized over expected rental-days-to-recoup; or just use a flat admin `floorOverride` and ignore bottomDollar for the daily floor. |
| **OQ-10** | **Should the engine ever touch `memberDaily` / `weekend`?** | v1 excludes them (loyalty/promo policy levers). Including later risks eroding member value silently. |
| **OQ-11** | **Where does the Round-Up entry chip live — Categories card header, a global nav badge, or the Settings board?** | Card header = contextual; global badge = always visible to managers; both add UI surface. |
| **OQ-12** | **Does `util-surge` propose to `rate1Day`+`rate7Day` together, or one field?** | Bundling keeps the blend consistent; single-field is simpler to reason about and accept. Note the §2.1 blend picks the *cheapest* combo — bumping only `rate7Day` without `rate4Wk` can make a long rental route around the surge via 4-week math, blunting the increase. |
| **OQ-13** | **Should the Investment `bottomDollar` field be `money`-tier-gated to match §3.1?** | Today it renders to any role that opens the category (an existing exposure, not created here). Gating it to `money+` matches the shipped "staff = operational only" law — but it's a `units-fleet` change, not this area's; flag-and-defer vs. fix-as-a-dependency. |
| **OQ-14** | **OQ-1's hidden cost: there is no server-verified "manager" gate today** — only the Admin **password** (`requireAdmin`/`getConfig`). | Loosening accept to `manager` (OQ-1) can't reuse the existing backend check; it forces either a new manager-password concept or accepting that manager-accept is *client-tier-only* (forgeable on a public SPA). Admin-only keeps the strong server gate; manager needs new server auth. This is the real blocker behind OQ-1. |
| **OQ-15** | **AI `propose_rate` (Phase 2): which provider/route, and does any rationale text it emits get stored verbatim?** | The stack is Anthropic/Claude, routed through the backend (no model id/key in the repo). If the LLM's free-text rationale is persisted into `proposals.rationale`, it must be length-capped + scrubbed of anything but category aggregates (no echoed PII, no internal cost numbers leaking to non-`money` tiers). Store a structured rationale vs. raw model text. |
| **OQ-16** | **Snapshot cost / scale:** computing `snapshotPricingSignals` server-side reads the full rentals+units tabs daily. At today's fleet size it's trivial; is there a near-term fleet/multi-yard (`fleet-spread`) growth that makes a per-category incremental snapshot worth designing now vs. a full scan? | Full scan = simplest, fine now; incremental = premature for a 5-category yard. Decide whether to design the cheap thing or the scalable thing first. |

---

## 12. Dependencies & Sequencing

Roadmap dependencies for this area (`AREAS-ROADMAP.md:181`): `units-fleet`, `rentals-dispatch`, `market-research`, `financials-kpi`, `backend-data`.

| Depends on | Why | Must land first? |
|---|---|---|
| `units-fleet` | `rentableUnits` / utilization derivation, category rate fields, `bottomDollar` | Yes — the signal source |
| `rentals-dispatch` | Active rentals, windows, open requests feed the utilization snapshot | Yes — the demand signal |
| `backend-data` | The `savePricingProposalResolution` / `snapshotPricingSignals` additive actions + new Sheets tabs + the cron | Yes — no engine without the store/actions |
| `financials-kpi` | Reuse the KPI-engine Settings authoring conventions for Phase-2 rule authoring; ROI/`bottomDollar` reasoning | Partial — Phase 2 only |
| `market-research` | Competitor/MSRP/auction benchmarking signals | **No (Phase 2+)** — v1 ships with internal-signal rules only; market data plugs in later via that area's contract |

**Sequencing:** Phase 1 needs only `units-fleet` + `rentals-dispatch` (already shipped/baseline) + the `backend-data` additive actions. **Build order:** (1) signal snapshot + store, (2) rule catalog + proposal generation, (3) banner/Round-Up UI + accept/dismiss + audit log, (4) gate the accept action. `market-research` and AI suggestions are explicitly **later** and do not block v1.
