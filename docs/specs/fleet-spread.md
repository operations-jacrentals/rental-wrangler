# Fleet Spread — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/fleet-spread`
**Task branch:** `fleet-spread/spec` (proposed)
**Maturity:** ⬜ Greenfield
**Scope:** A **capital-allocation / portfolio advisor over equipment categories** — derive, per category, how many invested dollars are tied up (Σ unit `trueCost`/`purchasePrice`), the return those dollars earn (ROI, revenue-per-dollar, utilization), and the demand pressure against them (lost-demand misses + utilization trend), then rank categories and recommend **buy / hold / sell more** so the next dollar of fleet capital goes where supply is short of demand and the return is highest. Output feeds purchasing decisions and the `automated-pricing` sale-side engine. (Multi-yard locations and partner co-ownership are explicitly **out of scope** — parked as separate concerns, see the Redefinition block D2/D3.)

---

## ⚠️ REDEFINITION — 2026-06-29 critique (Jac) — this spec is being RE-AUTHORED

**The draft below built the WRONG area.** Jac's actual meaning:

> **Fleet Spread = capital-allocation efficiency across equipment *categories*.** It's about *where the invested dollars are spread* — how much capital is tied up in each category — and whether that spread is the most efficient use of money given **supply and demand**. The question it answers: *"should my next dollar go into another excavator or a skid steer? Which categories are over-/under-invested relative to the demand and utilization they earn?"*

So the real Fleet Spread is a **capital-allocation / portfolio advisor over categories**, built from:
- **Invested dollars per category** (Σ unit `trueCost`/`purchasePrice` — `units-fleet`),
- **Return on that capital** (category ROI / revenue-per-dollar-invested / utilization — `units-fleet`, `financials-kpi`),
- **Demand pressure** (lost-demand misses + utilization from `market-research` D1/D3),
- **Supply** (how many units in each category),
→ a ranked **buy / hold / sell** recommendation per category, feeding purchasing and the `automated-pricing` sale-side engine.

**Decisions:**
- **D1 · Re-author this spec to the capital-allocation meaning.** The yard/partner content below is superseded. (A re-authored draft is being generated.)
- **D2 · Multi-yard / locations is a SEPARATE concern, not Fleet Spread.** Yards do exist as a concept and **Settings should dictate which yards each employee can access** (per-employee yard-access control) — but that's its own future area, not this one. Parked for a separate spec; not built into Fleet Spread.
- **D3 · Partners / co-ownership is a SEPARATE, LAST-priority feature.** Jac: "I haven't said anything about partners… maybe a last-priority feature." Removed from Fleet Spread; parked as a low-priority future item.

*(The capital-allocation re-author follows. The old multi-yard / partner draft has been removed; D2/D3 above record where those parked concerns now live.)*

---

## 1. Goal & Problem

### 1.1 The problem
JacRentals' fleet capital is spread across equipment **categories** — 12k excavators, skid steers, scissor lifts, light towers — and **nobody knows whether that spread is the right one.** Every dollar Jac has ever spent on iron is tied up in some category, but the app cannot answer the one question that decides the next purchase:

> *"Should my next dollar go into another excavator or a skid steer? Which categories are over-invested for what they earn, and which are starved relative to the demand they'd serve?"*

Today the inputs to that question exist in scattered, instantaneous form but are never assembled into a portfolio read:

- **Invested dollars per category** is already summed — `categoryStats` (`app.js:1836`) computes `trueCost = Σ (u.trueCost || u.purchasePrice || 0)` for every category. But it's only shown as an ROI denominator on one category card; there is no cross-category ranking of "where the money lives."
- **Return on that capital** is derived per category — `categoryStats` annualized `roi`, per-unit revenue (`avgRevUnit`), per-unit expense (`avgExpUnit`) (`app.js:1836`–1862). Again, per-card only; never ranked across the fleet.
- **Utilization / supply** is derived — `categoryRentable` (`app.js:1809`) gives rentable/total per category, `categoryAvailableCount` (`app.js:1707`) gives free-units-for-a-window. There is no rolled-up "how hard is this category working" signal.
- **Demand pressure** — lost-demand misses (a customer turned away at 0-available) and utilization trend — is the explicit subject of the **`market-research`** area (its D1 builds external feeds + the 0-available capture, its D3 brands the miss at the button). That demand signal has no consumer today.

So the most consequential financial decision the yard makes — **where to put the next chunk of capital** — is a gut call against a dashboard that shows each category in isolation and never says "this one is starved, that one is bloated."

### 1.2 What this area is for
Fleet Spread is the **portfolio advisor over categories.** It assembles the four signals above into one ranked board and, per category, recommends **BUY MORE · HOLD · SELL DOWN** — "this category earns $X per invested dollar, runs at Y% utilization, and turned away Z jobs last quarter; it is starved → buy" vs. "this category sits on $X of idle capital at Z% utilization with no missed demand → sell down / don't reinvest."

It is **read-mostly intelligence**, almost entirely **derived** — it owns essentially no new stored data. It reads `units-fleet`'s cost/ROI/utilization derivations and `market-research`'s demand signal, ranks, and advises. Its output **feeds purchasing** (the human buy/sell decision) and the **`automated-pricing` sale-side engine** (whose D2/D3 derive `bottomDollar`/`askPrice` from a cost/MSRP/auction-value basis — a "SELL DOWN" verdict from Fleet Spread is the trigger to list units at those derived sale prices).

This is a **Want** (strategic optionality), not an operational Need — the yard rents fine without it, but it removes the single biggest blind spot in **capital allocation**.

### 1.3 North star
> When Jac has cash to deploy or a slow category to trim, the decision is one board away: every category ranked by **how hard its invested dollars are working** and **how much demand is pushing on it**, with a plain **buy / hold / sell** stamp on each — so the next dollar of fleet capital always goes where supply is shortest of demand and the return is highest, and idle capital gets flagged for sale into the automated-pricing engine.

---

## 2. Current State (Baseline)

**This area is greenfield** — there is no Fleet Spread board, no capital-allocation rollup, no buy/hold/sell recommendation anywhere in code. But unlike a true blank slate, **every input signal already exists or is specced adjacent.** The table records what's there to build *on*, not what's shipped for Fleet Spread.

| Signal this area needs | State | Anchor |
|---|---|---|
| **Invested $ per category** (`Σ trueCost\|\|purchasePrice`) | ✅ Already summed in `categoryStats` | `categoryStats` `app.js:1836` (`trueCost = sum(u.trueCost\|\|u.purchasePrice\|\|0)`) |
| **Category ROI** (annualized lifetime, cost-basis-gated) | ✅ Derived | `categoryStats.roi` `app.js:1836`–1862 (`lifetimeRoi`, gated on real `trueCost`) |
| **Per-unit revenue / expense per category** | ✅ Derived | `avgRevUnit` / `avgExpUnit` `app.js:1856`; `unitTotalRevenue` `app.js:1783` |
| **Rentable / total supply per category** | ✅ Derived | `categoryRentable` `app.js:1809`, `isUnitRentable` `app.js:1808` |
| **Available-units-for-a-window count** | ✅ Derived | `categoryAvailableCount` `app.js:1707` |
| **Utilization (instantaneous)** | 🟡 Computed per-render, never stored as a trend | category mix bars `categoryMix` `app.js:1797`, `categoryRentalMix` `app.js:1824` |
| **Lost-demand misses + demand trend** | ⬜ Specced, not built | `market-research` `demandSignals` entity + D3 0-available capture (`docs/specs/market-research.md`) |
| **Sale-price basis (cost/MSRP/auction %)** | ⬜ Specced, not built | `automated-pricing` D2/D3 — the downstream of a "sell" verdict |
| **Money-tier visibility gate** | ✅ Shipped | `canMoney()` `app.js:14166` (`!currentRole \|\| roleTier ≥ tierRank('money')`) |
| **Margin-floor (`bottomDollar`) display gate** | ✅ Decided in `units-fleet` D1 (≥ money) | `units-fleet` D1; `bottomDollar` is a live ROI input `app.js:1852` |
| **Back-office board pattern** (list-shell to reuse) | ✅ Shipped | `BACKOFFICE_BOARDS` `config.js:371`, board popup `app.js:9378`, `BOARD_DEF` `app.js:11150`, menu `app.js:13863` |
| **Popup inventory / window catalog** | ✅ Shipped | `WINDOW_CATALOG` `app.js:9796`, `ci/check-window-catalog.mjs` |
| **R-rulebook stamp machinery** | ✅ Shipped | `data-r` stamps + `ci/gen-rule-usage.mjs` |

**Key takeaways for the build:**
- **The hard math is already written.** `categoryStats` already produces invested-$, ROI, and per-unit revenue per category; `categoryRentable` already produces supply. Fleet Spread is mostly **assembly + ranking + a verdict function** over derivations that ship today — not new financial code.
- **The one genuinely missing internal signal is a utilization *trend*** (a time series). Utilization is computed instantaneously per render; there is no stored history. This area can either (a) read the *current* utilization snapshot only (cheap, no new store), or (b) consume the `pricingSignals` daily snapshot that **`automated-pricing` §4.3** already proposes to build (`SNAP-…` per category/day). **Lean: reuse `automated-pricing`'s snapshot rather than build a parallel one** (Open Q FS-3).
- **Demand is owned next door.** The lost-demand and demand-trend signal is `market-research`'s `demandSignals`. Fleet Spread is its first real **consumer** — it must not re-implement capture, only read the rollup (`missesByCategory`, est-value, buy-pressure per `market-research` §7.2).
- **No new persistence is needed for the core.** The recommendation is derived live, exactly like ROI. The only candidate stored field is an optional per-category override (target allocation / pinned buy-hold-sell), §4.

---

## 3. Users, Roles & Data Gates

Permissions key off **TIERS, never role names** (`ROLE_TIERS` `config.js:326`, `tierRank` `config.js:334`; ladder `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`). The 15-role `jactec-ui` lens maps onto these 5 tiers.

### 3.1 Who touches Fleet Spread
Fleet Spread is a **capital-allocation / money-strategy view** — its core figures (invested $, ROI, revenue-per-dollar, lost-revenue) are money figures.

| Role / lens | Tier | Interest in Fleet Spread |
|---|---|---|
| **Owner / Admin** | admin | The primary consumer. Deploys capital, decides buy/sell, sees the whole spread + every figure + the margin floor. |
| **Fleet Manager** (Owner-adjacent) | manager/admin | The day-to-day driver — utilization × ROI × misses → purchasing recommendation. |
| **Office / Sales** | money | May read the spread to understand "why we're pushing/parking a category"; sees invested-$/ROI/revenue-per-dollar (money-tier entitled). |
| **Mechanic / M.Tech / Driver** | staff | Operational only — they may legitimately see *supply/utilization* counts, but **not** the invested-$ / ROI / lost-revenue figures (margin-adjacent). |

### 3.2 Gate decisions — SPEC THESE EXPLICITLY (surfaced, not silently set)

1. **Capital figures = `money`-tier+ to view.** Invested $, ROI, revenue-per-dollar, and the lost-revenue (`estValue`) rollup are money figures and gate on `canMoney()` (`app.js:14166`). A `staff` viewer who reaches the board sees only **operational** columns (unit count, rentable/total, utilization %) — the dollar columns return a locked `🔒`, never a number. **Enforced by NOT emitting the figure into the DOM** (the `row()` returns `🔒`), never by CSS `display:none` (a `staff` user can inspect that away) — same discipline as `market-research` §4.5 / `automated-pricing` §6.

2. **The margin floor (`bottomDollar`) is NEVER shown here, at any tier-display.** `bottomDollar` is the sale-side floor; `units-fleet` D1 already gates its display to ≥ money and never exposes it on a customer surface. Fleet Spread's "SELL DOWN" verdict may *reference* that a category is a sell candidate, but it **must not render the floor number** — the sell price the floor implies is `automated-pricing`'s gated surface, not this board's. (Open Q FS-7.)

3. **Jac's open-visibility posture — note, don't over-gate.** Adjacent areas have *loosened* cost visibility (`accounting` D1: cost/spend/aggregate P&L open to all signed-in users; `market-research` D2: market comps public). **The one thing that stays secret everywhere is the margin floor / `bottomDollar` itself.** So there is a real, surfaced fork (FS-6): does Fleet Spread follow `units-fleet`'s **closed** posture (invested-$/ROI gated to money — the conservative default proposed here, since this board *concentrates* the most cost-sensitive numbers into one ranked screen), or `accounting`'s **open** posture (cost is open; only the floor stays secret)? **This spec defaults closed and flags it — it does not silently decide.**

4. **Default-deny on every figure branch.** An unknown/blank tier resolves to rank 0 and sees no capital figure (matching the `canMoney() && currentRole` discipline in `market-research` §4.5 / `automated-pricing` — a no-role `#local` demo must not leak the whole capital spread). The verdict stamp (buy/hold/sell) is itself derived from money figures, so a `staff` viewer sees an operational board **without** the verdict column, or a non-numeric badge only (FS-6 decides which).

5. **No money MOVES here, and no rate/price is written.** Fleet Spread **records nothing and changes no number** — it surfaces a recommendation. It never writes a rate, never sets a sale price, never charges. The only optional write is a human-set per-category override (§4.2), which is a `manager`+ action. The buy/sell *execution* (actually buying iron, or listing a unit) is the human's job downstream — Fleet Spread advises.

### 3.3 Customer isolation / PII
Fleet Spread operates entirely on **categories and aggregate fleet economics** — no customer record, name, balance, or card enters any figure or recommendation. The demand signal it reads from `market-research` is already FK-only (`demandSignals.customerId`, no PII denorm, `market-research` §3.3); Fleet Spread reads the **rollup counts**, not the underlying customer rows. → **No customer-isolation surface is introduced by this area.** No PII, no secret, no model id, no password enters the spec or any config it touches (repo is public via Pages).

---

## 4. Data Model

Fleet Spread is **almost entirely derived** — its primary output is computed live from `units-fleet` and `market-research` data, exactly like ROI is computed today. **The default is ZERO new stored fields.** Two small, optional persisted additions are surfaced as forks, not assumed.

### 4.1 Derived per-category "spread row" (NOT stored — computed at render)
The core object the board renders, assembled once per board open from live data:

```js
// derived, never persisted — the unit of the Fleet Spread board
{
  categoryId,                 // → categories[].categoryId
  name,                       // category.name
  // — SUPPLY (units-fleet) —
  unitCount,                  // DATA.units where categoryId match
  rentable, total,            // categoryRentable(categoryId)            app.js:1809
  utilization,                // current util (or trailing avg if snapshot available)
  // — INVESTED CAPITAL (units-fleet / categoryStats) —
  invested,                   // categoryStats.trueCost  (Σ trueCost||purchasePrice) app.js:1836  [money+]
  // — RETURN (units-fleet / categoryStats) —
  revenue,                    // Σ unitTotalRevenue over the category               [money+]
  roi,                        // categoryStats.roi (annualized)                     [money+]
  revPerDollar,               // revenue / invested  (the core efficiency number)   [money+]
  // — DEMAND (market-research) —
  misses,                     // missesByCategory[categoryId] count, trailing window [money+ for value]
  missValue,                  // Σ estValue of those misses (lost revenue)          [money+]
  // — VERDICT (derived, §7) —
  buyPressure,                // composite score (§7.3)
  verdict,                    // 'buy' | 'hold' | 'sell'   (§7.4)
  // — optional human override (§4.2, only if FS-1 lands) —
  targetPct, pinnedVerdict,   // null unless set
}
```

Every field here is **read from an existing derivation** (`categoryStats`, `categoryRentable`, `market-research` rollups) — nothing here is a new source of truth.

### 4.2 Optional new stored fields on `category` (additive, schema-less — gated on Open Qs)
Only if Jac wants the board to be more than pure advice:

| Field | Type | Default (absent) | Meaning | Gated on |
|---|---|---|---|---|
| `targetAllocationPct` | number \| null | `null` | Admin/Manager-set target % of total fleet capital this category *should* hold; the board shows actual-vs-target. | **FS-2** — does the board just advise, or hold target allocations? |
| `spreadVerdictPin` | `'buy'\|'hold'\|'sell'\|null` | `null` | A human override of the derived verdict (e.g. "I know this category is seasonal — HOLD regardless of the score"). | **FS-1** |
| `spreadNote` | string | `''` | A one-line rationale for a pin/target. | with the above |

- **Schema-less / additive:** these ride the existing diff-sync (`computeChanges`) with zero migration — absent reads as "no override / no target," identical to today. They sit on the existing `categories` tab; **no new entity, no new Sheets tab.**
- **If neither FS-1 nor FS-2 lands, the data model is empty** — Fleet Spread stores nothing and is 100% derived. That is the proposed v1 default.

### 4.3 Relationships (by id — all existing)
```
Category(categoryId) ──< Unit(categoryId)              → invested$, supply, ROI  (units-fleet)
Category(categoryId) ──< demandSignals(categoryId)      → misses, lost revenue   (market-research)
Category(categoryId) ── (read by) automated-pricing      → sale-price basis on a 'sell' verdict
```
No new relationship is introduced — Fleet Spread is a *reader* across the existing category-keyed spine.

### 4.4 Migration concerns
None for the derived core (it computes over live data). The two optional category fields (§4.2) are additive-with-default → **no backfill, no migration**. A backend that predates this area simply has categories without the fields, which read as null/empty.

---

## 5. Backend / Integration Contract

**Likely ZERO new backend.** Fleet Spread derives over data the client already holds — `categoryStats`, `categoryRentable`, and (once it lands) `market-research`'s `demandSignals` are all in `DATA` after the existing `load`. The board computes the spread rows in the browser, exactly as `categoryStats` is computed today. **No new GAS action is required for the core.**

### 5.1 Persistence (only if FS-1/FS-2 land)
The two optional category fields (§4.2) persist through the **existing** diff-sync — adding them to the seed shape and writing them where edited is the whole change; `computeChanges` carries them on the `categories` tab. **No new action, no new tab.**

### 5.2 Market-research feed dependency
The demand signal (`missesByCategory`, `missValue`, buy-pressure) is produced by `market-research`. Two integration modes:
- **In-memory read (default, v1):** `market-research`'s `demandSignals` already ride the shared `load`/diff-sync (it's a `PERSIST_KEYS` entity in that spec), so the rollup is computable client-side with no extra call. Fleet Spread just calls `market-research`'s rollup helper (§7.2 there) over `DATA.demandSignals`.
- **External feed (later):** `market-research`'s `marketFetch` (auction/MSRP/competitor) is **upstream of `automated-pricing`'s sale basis**, not of Fleet Spread directly. Fleet Spread does not call any external feed itself.

### 5.3 No external integration of its own
Fleet Spread introduces **no new external integration** — no Maps, no Stripe, no LLM. (A future "Mr. Wrangler, where should I put my next $50k?" agentic read is a possible Phase-2 nicety, gated on the wrangler full-action work, and would receive **category aggregates only** — no PII, no model id/key in the repo — mirroring `automated-pricing` §5.5. Out of v1.)

### 5.4 Failure handling
- The board is **read-only and derived**; if `market-research` hasn't shipped yet, the demand columns render an "—" / "no demand data" state and the verdict falls back to a **supply+ROI-only** score (graceful degradation — §7.5), never a crash.
- An optional override write (FS-1/FS-2) rides the normal `saveSoon()` debounce + diff-sync; an offline write queues and re-syncs like any field. No money action is involved, so no live-verify is required (unlike `automated-pricing`'s rate accept).

---

## 6. UX / UI — yard data-plate language

All surfaces in the **yard data-plate** system: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), corner **rivets**, the hi-vis **hazard stripe** signature, **Saira Condensed** stamped uppercase labels (~2px tracking), the ONE safety-orange `#ff7a1a` accent reserved for the primary/ignition action and brand chrome only (status meaning stays in the R/Y/G flag system — orange is never a status), and a **light wrangler/ranch seasoning in copy** ("Fleet Spread", "Where the iron-money lives", "Round up the spread", a buy verdict reads "**Saddle up — buy**", a sell reads "**Trim the herd**"). Every new element gets a `data-r` stamp; a new popup gets a `WINDOW_CATALOG` entry — both **CI-enforced**. All new UI runs through the **`jactec-ui`** skill (screenshot + self-critique) before showing Jac.

### 6.1 Surface choice — a back-office board (not a 7th grid card)
The 6-card grid (`GRID_CARDS`) is fixed 3×2 and owns the operational entities. Fleet Spread is **back-office strategy intel**, so it follows the Parts/Vendors/Expenses/Files precedent (`BACKOFFICE_BOARDS` `config.js:371`) — and the `market-research` boards alongside it: **one new back-office board** (`id:'spread'`, title "Fleet Spread"), reached from the board menu (`app.js:13863`) / Tools tray, rendered by the existing board popup (`app.js:9378`) + a new `BOARD_DEF` entry.

- **Reuse, not free:** a board's *list shell* is reused, but its **columns + per-row gating are new code** in `BOARD_DEF` (`app.js:11150`) — the `row()` carries the `canMoney()` gate inline (§6.4), exactly as `market-research` §4.5 establishes.
- Because it rides the catalogued `kind:'board'` popup, **no new popup *kind*** is strictly required for the ranked list. *(If a richer "spread detail / what-if" overlay is wanted later, that IS a new popup → `WINDOW_CATALOG` + `check-window-catalog` — flagged in §9, deferred from v1.)*

### 6.2 The Fleet Spread board (ranked data-plate list)
A steel panel with a hazard-stripe header rail and the Saira stamp **"FLEET SPREAD"**, listing every category **ranked by capital efficiency × demand** (default sort: buy-pressure desc — the most starved/under-invested at the top). Each category is a riveted data-plate strip:

```
┌─[rivet]──────────────────────────────────────────────────[rivet]─┐
│ ▌ 12K EXCAVATOR                                  ▓ SADDLE UP ▓     │  ← verdict stamp (hazard-cap)
│   Invested $182,000 · ROI 31% · $1.84 rev/$ invested              │  ← capital row  [money+]
│   5 units · 4 rentable · 96% util · 3 misses ($4,200 lost)        │  ← supply+demand row
└─[rivet]──────────────────────────────────────────────────[rivet]─┘
┌──────────────────────────────────────────────────────────────────┐
│ ▌ LIGHT TOWER                                       TRIM THE HERD  │  ← sell verdict
│   Invested $46,000 · ROI 6% · $0.41 rev/$ invested                │
│   8 units · 8 rentable · 18% util · 0 misses                      │
└──────────────────────────────────────────────────────────────────┘
```

- **Verdict stamp** colored via the **flag system** (R/Y/G), not orange: **BUY** = a positive/green-ish "go" stamp (starved + earning), **HOLD** = neutral yellow, **SELL** = red "trim" (idle capital, no demand). The stamp is the board's one **bold** element (boldness spent in one place per `jactec-ui`).
- **Capital row** (`Invested · ROI · rev/$`) renders **only under `canMoney()`** — a `staff` viewer sees the supply+demand row alone, no dollar, no verdict (or a non-numeric verdict badge per FS-6).
- **Sortable** by the existing board sort chrome: by buy-pressure (default), invested $, ROI, rev-per-dollar, utilization, or misses.
- **A small "spread bar"** at the top (optional, FS-2): a single horizontal stacked bar showing each category's *share of total invested capital* — the literal "spread" of dollars across categories at a glance, each segment colored by verdict. If `targetAllocationPct` is set, a thin tick shows target vs actual.

### 6.3 States
- **Empty** (no categories with cost basis) → a stamped "No capital to spread yet — set unit costs to read the spread" plate.
- **Demand data absent** (`market-research` not shipped) → the misses columns read "—" and a small "demand feed not wired" note; verdict degrades to supply+ROI-only (§7.5).
- **Loading** → the standard skeleton steel plates.
- **`staff` viewer** → operational-only board (supply/utilization), capital row + verdict suppressed (DOM-absent, not CSS-hidden).

### 6.4 The `BOARD_DEF` row renderer (gate lives HERE, concretely)
Follows the shipped `BOARD_DEF` pattern (`app.js:11150`); the money gate is enforced **inside `row()`** so a `staff` viewer never receives the figure in the DOM:

```js
// app.js — BOARD_DEF addition (sketch; final renderer per jactec-ui pass)
spread: {
  cols: ['Category', 'Units', 'Util', /*money+:*/ 'Invested', 'ROI', 'Rev/$', 'Misses', 'Verdict'],
  row: (cat) => {
    const s     = spreadRow(cat);                  // §7 assembly over categoryStats + demand rollup
    const money = canMoney() && currentRole;       // never trust bare canMoney() for a no-role demo (§3.2/4)
    return [
      esc(cat.name),
      `${s.rentable}/${s.total}`,
      pct(s.utilization),
      money ? fmtMoney(s.invested)        : '🔒',
      money ? (s.roi==null ? '—' : s.roi+'%') : '🔒',
      money ? s.revPerDollar.toFixed(2)   : '🔒',
      money ? (s.missValue ? `${s.misses} ($${fmtK(s.missValue)})` : String(s.misses)) : verdictBadgeOperationalOnly(s),
      money ? verdictStamp(s.verdict)     : '🔒',   // FS-6: or a non-$ operational badge
    ];
  },
},
```

### 6.5 Cross-surface tie-in (optional, gated)
- A **count/verdict chip** could surface on the **Categories card header** ("2 starved · 1 to trim") linking to the board — money+ only. (Mirrors `automated-pricing`'s "3 advised" chip; FS-5 decides placement.)
- A **"SELL candidate"** badge on a category in `units-fleet` could deep-link a "sell down" verdict into `automated-pricing`'s sale-price flow (the cost/MSRP/auction basis). This is the buy/sell→pricing seam (FS-7); v1 may show the verdict without wiring the action.

### 6.6 Mobile reflow
Desktop-first (min-width 1180px). Per `jactec-ui` mobile rules: the board becomes a bottom-sheet; each category collapses to a stacked snap-card (verdict stamp + the two rows); the spread bar stacks full-width. Respect `prefers-reduced-motion` on the bar fill; visible focus rings; 44px touch targets.

### 6.7 R-rulebook & catalog obligations (CI-enforced)
- Every new element (board rows, verdict stamp, spread bar, any override control) gets a `data-r="Rxx"` stamp at the **next free rule id** (the `gen-rule-usage.mjs` duplicate-rule guard fails on a clash); regenerate `rule-usage.js` (drop `--check`). Reuse an existing rule where the element matches.
- **No new popup in v1** (the board reuses the catalogued `board` window) → `check-window-catalog.mjs` is unaffected *unless* a richer spread-detail overlay is added (then a `WINDOW_CATALOG` entry is required).
- If a chapter banner is added for the Fleet Spread code, regenerate the Code Atlas (`tools/gen-code-map.mjs`).

---

## 7. Business Rules / Derivations / Money

All figures are **derived live** (none stored, except the optional overrides §4.2). The board is assembled once per open, not per row, for perf.

### 7.1 Invested capital per category (the "spread")
```
invested(cat)   = categoryStats(cat).trueCost              // = Σ (u.trueCost || u.purchasePrice || 0)   app.js:1836
totalInvested   = Σ invested(cat) over all categories
investedShare   = invested(cat) / totalInvested            // this category's slice of the spread (the "spread bar")
```
This is the literal **Fleet Spread** — where every fleet dollar lives, by category. `invested` reuses `categoryStats`' existing sum verbatim; **no new cost math.** A category with no cost basis (`invested === 0`) is excluded from ROI/efficiency ranking (shown but unranked — same guard `categoryStats` uses for ROI, `app.js:1849`).

### 7.2 Return on that capital
```
revenue(cat)     = Σ unitTotalRevenue(u.unitId) for units in cat     // app.js:1783 (already summed in categoryStats)
roi(cat)         = categoryStats(cat).roi                            // annualized lifetime ROI, app.js:1836–1862
revPerDollar(cat)= invested(cat) ? revenue(cat) / invested(cat) : null   // the core efficiency number
```
- **`revPerDollar`** ("revenue per invested dollar") is the headline efficiency metric — a category earning $1.84 per invested dollar is working its capital far harder than one earning $0.41. It's the cleanest cross-category comparison (ROI is annualized and cost-basis-sensitive; rev-per-dollar is a raw efficiency read).
- **`bottomDollar` is NOT shown** here even though `categoryStats.roi` bakes it in as residual sale value (`app.js:1852`) — the ROI *percentage* is shown (money+), the floor *dollar* is not (§3.2 rule 2; `units-fleet` D1).

### 7.3 Demand-vs-supply "buy pressure" score
The composite that drives the verdict and the default sort. Combines **utilization** (supply working hard), **lost demand** (unmet demand), and **return** (efficient capital):
```
util       = utilization(cat)                  // 0..1; current snapshot or trailing avg (FS-3)
missSignal = normalized misses (count, weighted by reason per market-research §7.2:
             'dont-stock' & 'no-availability' weight highest)
returnSig  = normalized revPerDollar(cat) (or roi) across the fleet

buyPressure(cat) = wU*util + wM*missSignal + wR*returnSig      // weights wU/wM/wR — FS-4
```
- **High buyPressure** = high utilization + unmet demand + strong return → **the capital is starved; the next dollar belongs here.**
- **Low buyPressure** = idle units, no missed demand, weak return → **over-invested; trim.**
- The exact weights (`wU/wM/wR`) and normalization are **first-cut numbers Jac must tune** (FS-4) — they encode his read of the yard's demand rhythm, exactly as `automated-pricing` §7.3's thresholds are Jac-tuned.

### 7.4 Verdict: BUY · HOLD · SELL (the recommendation)
```
verdict(cat) =
  spreadVerdictPin (if set, §4.2)               // human override always wins
  : buyPressure(cat) >= BUY_THRESHOLD   ? 'buy'   // starved + earning → deploy capital here
  : buyPressure(cat) <= SELL_THRESHOLD  ? 'sell'  // idle capital, no demand → trim / list for sale
  :                                       'hold'
```
- **BUY** → recommend purchasing another unit in this category (feeds the human purchasing decision).
- **SELL** → recommend listing idle units for sale; this is the **trigger into `automated-pricing`'s sale-side engine** (D2/D3 there derive `bottomDollar`/`askPrice` from a cost/MSRP/auction-value basis). Fleet Spread says *what* to sell; automated-pricing prices it. **Fleet Spread never sets the sale price itself.**
- **HOLD** → the spread is balanced for this category; no action.
- Thresholds (`BUY_THRESHOLD`/`SELL_THRESHOLD`) ship as first-cut numbers, Jac-tuned (FS-4). The exact **scoring formula is the single biggest open fork** (FS-4) — it's a business judgment, not a universal.

### 7.5 Graceful degradation when demand data is absent
If `market-research` hasn't shipped (`DATA.demandSignals` empty/undefined):
```
buyPressure(cat) = wU*util + wR*returnSig       // misses term dropped, weights renormalized
```
The board still ranks by utilization × return and emits buy/hold/sell on those two signals — it simply can't see unmet demand yet. The misses columns render "—" and a note flags the partial signal. **Fleet Spread is useful day-one on internal signals alone**, and gets sharper when demand capture lands.

### 7.6 No money moves; nothing is written to a rate or price
This area **records and surfaces** capital figures and a recommendation but **takes no payment, changes no rate, sets no sale price, and buys/sells no iron.** The only optional write is a human override (§4.2), a `manager`+ action carrying no money mutation. The verdict is advice; execution is human + downstream (`automated-pricing` for the sell price). This keeps the money gate a **visibility** gate (§3.2), never an action gate.

### 7.7 Edge cases
| Case | Rule |
|---|---|
| Category with `invested === 0` (no cost basis) | shown but **unranked** for efficiency; verdict suppressed or "needs cost" — never a fake ∞ rev/$ (mirrors `categoryStats` ROI guard `app.js:1849`) |
| Single-unit category swinging 0↔100% util | use a trailing-avg utilization (via the snapshot, FS-3) before a verdict, not an instantaneous 0/100 (mirrors `automated-pricing` §7.1) |
| `rentableUnits === 0` (whole category Failed/Sold) | utilization **undefined**, not 100% — emit no BUY (it's out of service, not booked); flag "fleet down" |
| Sold/For-Sale units | excluded from rentable supply (`categoryRentable` already excludes `Sold`, `app.js:1810`); their cost basis still counts toward historical invested unless retired |
| A SELL verdict on a category with active demand | the score already weighs misses; a category with misses won't read SELL — but if a human pins SELL (§4.2) it wins, with the note explaining why |
| `staff`-tier viewer | capital row + verdict suppressed (DOM-absent); operational row shown |

---

## 8. Phasing & Milestones

### Phase 1 — Derived spread board (MVP, in-scope for v1)
1. `spreadRow(cat)` assembly over `categoryStats` (invested/ROI/rev-per-dollar) + `categoryRentable` (supply/util) — **internal signals only**, no demand dependency required (degrades per §7.5).
2. One back-office board (`id:'spread'`) via the existing board popup + a new `BOARD_DEF` entry with the inline `canMoney()` gate.
3. The buy-pressure score + verdict (supply × return), first-cut weights/thresholds; the spread bar (share of invested capital).
4. Tier gates per §3.2 (capital figures + verdict money+; operational counts open).
5. `data-r` stamps + (no new popup) — reuse the `board` window.
6. **In scope:** the derived board, ranking, buy/hold/sell on internal signals, the gates, demo seed renders non-empty.
7. **Out of scope:** demand-weighted verdict (needs `market-research`), target allocations / pins (FS-1/FS-2), the sell→automated-pricing wire, any agentic read.

### Phase 2 — Demand-weighted + the pricing/purchasing wire
- Consume `market-research`'s `demandSignals` rollup → the full buy-pressure score (§7.3) with the misses term.
- The **sell→`automated-pricing`** seam (a SELL verdict deep-links the cost/MSRP/auction sale-price basis).
- Optional category chip on the Categories card (FS-5).

### Phase 3 — Active capital management (gated on Open Qs)
- `targetAllocationPct` + actual-vs-target spread (FS-2); `spreadVerdictPin` human overrides (FS-1).
- Optional Mr. Wrangler agentic read ("where should the next $50k go?") — category aggregates only, no PII/secret.

---

## 9. Acceptance Criteria

**Phase 1 (testable):**
1. `spreadRow(cat)` returns `invested` equal to `categoryStats(cat).trueCost`, `roi` equal to `categoryStats(cat).roi`, and `revPerDollar = revenue/invested` (null when invested 0) — **assert against the live derivations**, proving no parallel cost math. → `ci/logic-test.mjs`.
2. A category with `invested === 0` is shown but excluded from efficiency ranking and emits no fake `∞` rev/$ or verdict. → `logic-test`.
3. The board ranks categories by buy-pressure desc by default; re-sorting by invested/ROI/util works via the board chrome. → manual on `:9147`.
4. **With a `staff`-tier role, NO invested-$/ROI/rev-per-dollar/missValue/verdict string appears in the DOM** of the board (not merely CSS-hidden) — `row()` returned `🔒`/operational-only for those cells. → `ci/smoke.mjs` (assert absence in rendered HTML) + manual role-switch.
4b. A **no-role `#local` demo** (`!currentRole`) is treated as below-money for the capital columns (gate is `canMoney() && currentRole`) — same figures suppressed. → smoke with no role set.
5. **The `bottomDollar` floor number never appears on the board at any tier** (only the ROI% that encodes it, money+). → `logic-test`/code review + manual.
6. With `DATA.demandSignals` empty, the board still renders and ranks on internal signals (misses columns "—", verdict from supply×return), no crash. → `logic-test` + smoke.
7. A SELL verdict references the automated-pricing sale basis without rendering the floor dollar. → manual + code review.
8. Every new UI element carries a `data-r` stamp; `gen-rule-usage.mjs --check` passes (regenerate first). → CI.
9. No new popup → `check-window-catalog.mjs` unaffected; if a spread-detail overlay is added, it MUST be catalogued. → CI.
10. If a chapter banner is added for the Fleet Spread code, the Code Atlas is regenerated. → `tools/gen-code-map.mjs --check`.
11. `ci/smoke.mjs` / `ci/logic-test.mjs` boot with the new board (port-8000→9147 swap per CLAUDE.md); `?v=` cache-bust token bumped on deploy.

**CI-gate impact summary:**
- `ci/gen-rule-usage.mjs --check` — new board/verdict/spread-bar elements need `data-r` stamps; regenerate `rule-usage.js`.
- `ci/check-window-catalog.mjs` — unaffected in v1 (reuses `board` window); required only if a new overlay is added.
- `ci/logic-test.mjs` — unit the §7 derivations (invested = `categoryStats.trueCost`, rev-per-dollar, buy-pressure, verdict, `invested===0` guard, demand-absent degradation).
- `ci/smoke.mjs` — boot with the board; assert capital strings absent from `staff`-role HTML (AC-4).
- `tools/gen-code-map.mjs --check` — regenerate if a banner is added.
- **No new CI gate is introduced.**

---

## 10. Risks & Edge Cases

| Risk | Severity | Mitigation |
|---|---|---|
| **Capital-figure leak** — the board concentrates invested-$/ROI/rev-per-dollar/lost-revenue into one ranked screen; a `staff` screen-share/screenshot exposes the whole capital spread | 🔴 | Gate **in `row()`** so the figure is never emitted (returns `🔒`), never CSS-hidden; AC-4 asserts DOM-absence; the verdict (derived from money figures) is suppressed too; FS-6 decides open-vs-closed posture (default closed) — **security decision, stays on main, not delegated** |
| **Margin-floor (`bottomDollar`) leak** via a SELL verdict or rev/$ | 🔴 | Never render the floor dollar on this board at any tier (§3.2 rule 2); show ROI% (money+) but not the floor it encodes; the sale price is `automated-pricing`'s gated surface |
| **No-role demo sees the whole spread** (`canMoney()===true` when `!currentRole`) | 🔴 | Capital columns gate on `canMoney() && currentRole` (§6.4); AC-4b |
| **Bad recommendation drives a bad buy** — a wrong scoring formula sends Jac to over-buy a category | 🟠 | The verdict is **advice, not action** (§7.6); thresholds/weights are Jac-tuned (FS-4); a human pin (FS-1) always overrides; nothing is bought/sold automatically |
| **Thin signal** — single-unit category swings util 0↔100% | 🟡 | trailing-avg utilization via the snapshot (FS-3); `rentableUnits===0` → undefined not 100% (§7.7) |
| **Demand data absent** (`market-research` not shipped) | 🟡 | Graceful degradation to supply+ROI score (§7.5); board is useful day-one |
| **Parallel cost math drifts from `categoryStats`** | 🟡 | Fleet Spread MUST read `categoryStats`/`categoryRentable`, never re-implement the sums; AC-1 asserts equality |
| **Open-vs-closed visibility fork decided silently** | 🟠 | FS-6 surfaced explicitly; default closed (conservative); not delegated |
| **Performance** — per-category derivations on every render | 🟢 | Assemble the spread once per board open (not per row), reusing `categoryStats` (already O(units)); stays in the render budget |
| **Demo seed leaks real costs/PII** | 🔴 | Derived from existing seed categories/units (already non-PII mock data); no new seed of real cost numbers; repo is public via Pages |

---

## 11. Open Questions (for Jac)

*(No seed questions were captured for this re-authored area; all below are generated from the code + the gate/scoring tensions above. FS-4 — the scoring/verdict formula — and FS-6 — the visibility posture — are the highest-stakes forks.)*

| # | Question | Trade-off |
|---|---|---|
| **FS-1** | **Does Fleet Spread just *advise*, or also let a human *pin* a verdict** (`spreadVerdictPin`, §4.2) that overrides the derived score? | Pure advice = zero stored data, simplest, the board is a live read. Pins = Jac can say "HOLD this seasonal category regardless," but adds a stored field + a `manager`+ write. **Lean: advise-only for v1; pins in Phase 3.** |
| **FS-2** | **Does it hold *target allocations* (`targetAllocationPct`) — "this category *should* be 20% of fleet capital" — or only show actual share?** | Targets turn the board into a real portfolio tool (actual-vs-target gap drives buy/sell), but require Jac to set targets per category and add a stored field. Actual-only is a pure read. **Lean: actual share + the spread bar for v1; targets later.** |
| **FS-3** | **Utilization input: instantaneous (current render) or a trailing average from a stored snapshot?** | Instantaneous = zero new store, but a single-unit category whipsaws. Trailing avg = stabler verdicts, but needs a time series. **Lean: reuse `automated-pricing`'s `pricingSignals` daily snapshot (§4.3 there) rather than build a parallel one** — sequence with that area. |
| **FS-4** | **The exact buy/hold/sell *scoring formula* — weights (`wU/wM/wR`) and thresholds.** This is a business judgment, not a universal. | Utilization-heavy = chases occupancy; demand-heavy = chases unmet demand; return-heavy = chases efficiency. Jac knows the yard's rhythm. **No verdict ships until Jac picks the weights/thresholds** (first-cut numbers proposed, tunable in-app like `automated-pricing` §7.3). |
| **FS-5** | **Does a buy/sell count chip surface on the Categories card header** (like automated-pricing's "3 advised"), or live only on the board? | Chip = always-visible nudge for managers; board-only = less UI surface. Money+ either way. **Lean: board-only for v1; chip Phase 2.** |
| **FS-6** | **Visibility posture: follow `units-fleet`'s CLOSED gate (invested-$/ROI/verdict to ≥money — proposed default) or `accounting`'s OPEN posture (cost is open; only the floor stays secret)?** | This board *concentrates* the most cost-sensitive numbers into one ranked screen, so the conservative default gates the capital figures to money+. But Jac has loosened cost visibility elsewhere (`accounting` D1). **Default closed and flagged — security decision, stays on main, not delegated.** Which posture? |
| **FS-7** | **How tightly does a SELL verdict tie into `automated-pricing`'s purchasing/sale engine** — just *advise* "consider selling," or *deep-link* into the cost/MSRP/auction sale-price flow (and a BUY verdict into a purchasing checklist)? | Advise-only = clean separation, Fleet Spread stays read-only. Deep-link = one-tap from "trim the herd" to a priced sale listing, but couples the two areas. **Lean: advise + a (gated) deep-link button in Phase 2; never auto-list.** |
| **FS-8** | **Who sees the board at all** — money+ (it's a capital view) or manager+ (capital *strategy* is management-only, the tighter posture `automated-pricing` D4 took for proposals)? | Money+ = Office/Sales understand the push/park; manager+ = strategy stays with management. **Lean: money+ to *view operational + capital figures*; the *verdict/strategy* surface follows the FS-6 posture.** |
| **FS-9** | **Does "invested" use historical acquisition cost only, or mark-to-market** (current resale/auction value of the units)? | Acquisition cost = what `categoryStats` already sums, zero new data. Mark-to-market = a truer "capital currently tied up" but needs the auction-value feed (`market-research`/`automated-pricing` basis) per unit. **Lean: acquisition cost for v1; mark-to-market when the auction feed lands.** |

---

## 12. Dependencies & Sequencing

### 12.1 Cross-area dependencies
| Dependency | Direction | Why |
|---|---|---|
| **`units-fleet`** ✅ shipped | **upstream (hard)** | The whole capital + return + supply signal: `categoryStats` (invested $, ROI, rev/unit `app.js:1836`), `categoryRentable` (supply `app.js:1809`), `unitTotalRevenue` (`app.js:1783`). Fleet Spread is a *reader* of these — it must reuse them, never re-derive. Also owns the `bottomDollar` margin-floor gate (D1) Fleet Spread honors. |
| **`market-research`** ⬜ specced | **upstream (soft — degrades without it)** | The demand signal: `demandSignals` (lost-demand misses) + the demand-trend rollup (its §7.2 `missesByCategory`, buy-pressure). Fleet Spread is its first real *consumer*. v1 degrades gracefully if it's not yet shipped (§7.5). |
| **`automated-pricing`** ⬜ specced | **downstream consumer** | A SELL verdict feeds its sale-side engine (D2/D3: `bottomDollar`/`askPrice` derived from cost/MSRP/auction basis). Fleet Spread says *what* to sell; automated-pricing prices it. May also share the `pricingSignals` utilization snapshot (FS-3). |
| **`financials-kpi`** ✅ shipped | **lateral / optional downstream** | A future "capital efficiency" KPI ring could read the spread rollup; reuses the ring engine (`APP-21`). Not a v1 dependency. |
| **`accounting`** ⬜ specced (partial) | **lateral** | Sets the open-cost-visibility posture (D1) that FS-6 weighs against; the realized-margin-per-category surface (`accounting` D3, money-gated) overlaps Fleet Spread's return read — coordinate so the two agree on "revenue − attributed cost." |
| **`backend-data`** ✅ shipped | **upstream** | The derived core needs **no new action**; the optional override fields (§4.2) ride the existing diff-sync. |

### 12.2 What must land / be decided first
1. **Nothing blocks Phase 1** — `units-fleet`'s derivations are shipped; the board is computable today on internal signals alone.
2. **Resolve FS-4 (the scoring/verdict formula) and FS-6 (visibility posture) on the main session before build** — FS-4 is a business judgment that shapes every verdict; FS-6 is a margin/capital-visibility security call. Neither is delegated, neither silently set.
3. **`market-research` is the soft prerequisite for the *demand-weighted* verdict (Phase 2)** — Phase 1 ships without it (§7.5); the misses term plugs in when that area lands.
4. **`automated-pricing` is the downstream of a SELL verdict (Phase 2)** — Fleet Spread does not block on it; the sell→price wire is built once both exist.

### 12.3 Sequencing recommendation
Phase 1 (the derived spread board on internal signals) is **safe, high-value, and unblocked** — build it first, gated per FS-6. Phase 2 (demand-weighting + the pricing/purchasing wire) follows `market-research` and `automated-pricing`. Phase 3 (target allocations, human pins, agentic read) waits on FS-1/FS-2 and the wrangler work. Keep the FS-4 scoring formula and the FS-6 gate on the main session.

---

*End of re-authored DRAFT — every numbered decision (especially §3 gates, §7.3/7.4 scoring, and §11) is open for Jac's critique before any branch is cut.*
