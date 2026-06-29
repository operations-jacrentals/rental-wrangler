# Market Research — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/market-research`
**Task branch:** `market-research/spec` (proposed)
**Maturity:** Greenfield (nothing in code today)
**Scope:** Capture, store, and surface external market intelligence — competitor / MSRP / auction / rental pricing, regional benchmarks, lost-demand misses, and demand trends — so JacRentals can make purchasing and pricing decisions from data instead of gut.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions and **invert the §3 visibility gate** (comps are public, not staff-hidden).

- **D1 · External feeds are the HEADLINE, not Phase 3 (resolves OQ-8).** Prioritize auto-pull feeds: **auction value** (Ritchie Bros / IronPlanet), **MSRP**, and **competitor rental rates** — server-side API keys (named-only), with manual entry as backup. These feed the `automated-pricing` **sale-price basis** (auction/MSRP, D2/D3 there) and the demand pricing. Build the `marketFetch` action in **v1**. Run a legal/ToS review before the competitor-rate scrape specifically.
- **D2 · Market comps are PUBLIC / customer-facing — but the margin floor stays secret (resolves OQ-1, OQ-14; inverts §3.2).** Show market comps + **our advertised rates** openly, **including to customers on the website + the customer portal** ("the market charges $X, we charge $Y" — a transparency / sales tool). **HARD LINE (unchanged):** never expose `bottomDollar` / cost / margin / the floor-delta on any surface — those stay money-gated and **never reach a customer-facing surface.** So: market + our-rate numbers = public; the *margin* = secret. (Reframes AC-4: assert the **floor/margin** never appears on a public/customer surface, rather than hiding comps from staff. Internal lost-demand *value* — `estValue`, buy-pressure — stays money/manager-internal.)
- **D3 · Build lost-demand capture into the existing 0-available button (resolves OQ-5) — Phase 1.** The rental workflow already shows a 0-available availability indicator; wire the "brand the miss" capture **into that button** so a turn-away is logged at the moment it happens. Coordinate with `rentals-dispatch`'s availability render.

**Cross-area:** D2 makes Market Research a **customer-portal + website data source** (public comp display) — note the new dependency on `customer-portal` and that the (out-of-scope) marketing website may consume this via an export/API.

**Defaults adopted:** OQ-13 → market-research is **upstream**, ships first · OQ-3 → money edits own captures, manager+ deletes · OQ-16 → `estValue` pre-fills from the category rate · OQ-2 → market-above-ours = green "room to raise" · OQ-12 → derive reason colors from one source · OQ-4 → two boards · OQ-9 → `MC####`/`DS####` ids · OQ-10 → standalone entities · OQ-7 → confirm tab auto-create with the backend owner · OQ-11 → Wrangler capture Phase 2.

---

## 1. Goal & Problem

### 1.1 The problem
JacRentals prices every category by hand. The five rate fields (`rate1Day`,
`rate7Day`, `rate4Wk`, `weekend`, `memberDaily`) and the disposal numbers
(`msrp`, `askPrice`, `bottomDollar`) live on the category record (`data.js:24`)
and are typed in by Jac. There is **no record of why** any number is what it is —
no competitor quote, no auction comp, no "we turned away three skid-steer jobs
last week." When a customer asks for iron we don't have, or asks for a price we
can't match, the miss evaporates. Purchasing the next unit is a gut call.

The Fleet Manager role doc names this gap explicitly as an open audit question
(`role-roles.md:132`):

> *"Does this feature create or surface any data that helps capture lost-demand
> signals — i.e., when a customer asks for equipment we cannot provide, is there
> anywhere to record that miss so fleet purchasing decisions can be
> data-driven?"*

Today the answer is **no**. This area builds that "anywhere."

### 1.2 What this area is for
A lightweight intelligence ledger that turns three streams of external signal
into structured, queryable records the business can act on:

1. **Competitor / market pricing comps** — what United, Sunbelt, the local
   independents, and auction sites (Ritchie Bros, IronPlanet) charge or sell a
   comparable unit for, captured per category.
2. **Lost-demand signals** — every time we turn away or fail to fill a request
   (no unit available, price too high, category we don't stock at all),
   recorded with enough structure to count and trend.
3. **Demand / utilization trends** — derived rollups already latent in our own
   data (rental counts, utilization, win/loss) surfaced next to the external
   comps so a buy decision sees both sides.

### 1.3 North star
> When Jac is deciding whether to buy another 12k excavator or raise the
> skid-steer weekly, the answer is one board away: *here is what the market
> charges, here is what we've turned away, here is our utilization — buy / hold /
> reprice.*

Market Research is the **evidence layer** that feeds `automated-pricing` (#9) and
informs `units-fleet` purchasing. It is deliberately a **Want**, not a Need: the
yard runs without it, but it removes the single biggest blind spot in
capital-allocation and rate-setting.

---

## 2. Current State (Baseline)

**Nothing of this area exists in code.** This is a true greenfield. The full
inventory of what is *absent*:

| Capability | State | Evidence |
|---|---|---|
| Competitor / MSRP / auction comp storage | ❌ Missing | no entity, no field, no Sheets tab |
| Lost-demand / turn-away capture | ❌ Missing | the only reference is an aspirational role-doc audit question (`role-roles.md:132`) |
| Demand-trend rollups | ❌ Missing | rental counts exist in data but are not aggregated for buying intel |
| Any market-research UI | ❌ Missing | no card, board, popup, or settings pane |
| Backend action | ❌ Missing | not in the `backendCall` action catalog (`CODE-MAP.md` Part III) |

### 2.1 Adjacent code this must build ON (the real seams)

The area is greenfield but it does **not** start from zero scaffolding — it slots
into four existing, shipped systems:

| Seam | Where | How this area uses it |
|---|---|---|
| **Category pricing record** (home of all pricing) | `data.js:24`, `rentalPrice` `APP-04` `app.js:836`, `catRatesUnset` `app.js:873` | comps attach to a `categoryId`; the comp board sits next to the very rates it benchmarks |
| **Disposal numbers** | `msrp` / `askPrice` / `bottomDollar` on category (`data.js:24`) | external MSRP/auction comps benchmark these directly |
| **Back-office board pattern** | `BACKOFFICE_BOARDS` (`config.js:371` — 4 boards today: parts/vendors/expenses/files), board popup `app.js:9378`, `boardRows` (`app.js:11149`), `BOARD_DEF` (`app.js:11150`), board menu render (`app.js:13863`) | the natural home for the comps + lost-demand ledgers — a 5th/6th board, not a 7th grid card. **Note:** a board is NOT just a `BACKOFFICE_BOARDS` entry + a `boardRows` case — it ALSO needs a `BOARD_DEF` entry (its `cols` + `row(rec)` renderer). The draft's §4.4 makes this explicit. |
| **Diff-sync persistence** | `PERSIST_KEYS` (`app.js:15638` — 11 entities today), `PERSIST_ID` (`app.js:15687`), `backendCall` (`app.js:15650`) | new entities ride the existing diff-sync; no new transport |
| **Tier gating** | `canMoney()` (`app.js:14166` — `() => !currentRole \|\| roleTier(currentRole) >= tierRank('money')`), `roleTier` / `tierRank` (`config.js:326`) | margin-bearing comp numbers gate on `money`+; capture of a miss is `staff`. **Note the `!currentRole` short-circuit:** a blank/unset role reads as `canMoney()===true` (dev/demo convenience) — the gate is a *floor*, so anything below `money` must be a role with an actual tier; the board renderers must not rely on `canMoney()` to hide figures from a no-role demo session. |

### 2.2 The "Today" baseline, stated plainly
- Pricing is **fully static and manual** (the `automated-pricing` baseline).
- There is **no demand signal of any kind** persisted.
- The Coming-in-2026 roadmap popup (`kind:'roadmap'` in `WINDOW_CATALOG`) is the
  closest thing to a forward-looking surface, and it is copy-only.

---

## 3. Users, Roles & Data Gates

The app has 5 shipped roles (`ROLES`, `config.js:302`) carrying one of 5 tiers
(`ROLE_TIERS`, `config.js:326`, strict superset ladder `staff < money < manager
< admin < developer`). Custom roles are allowed; **gates key off TIER, never role
name** (the role-system redesign canon). The 15-role lens (the `jactec-ui`
`/role` audit) maps onto these 5 tiers.

### 3.1 Who touches Market Research

| Role (lens) | Tier | What they do here |
|---|---|---|
| **Owner / Sales** | money/admin | read comps + lost-demand, drive buy/reprice decisions, edit comp records |
| **Fleet Manager** (Owner-adjacent) | admin | the primary consumer — utilization × comps × misses → purchasing |
| **Office** | money | logs a lost-demand miss at the moment a quote dies; reads comps |
| **Sales** | money | logs a miss when a deal is lost on price; reads comps to argue a rate |
| **Driver / M.Tech / Mechanic** | staff | may *report* a "customer asked for X we don't have" miss (capture only), but see **no margin/comp numbers** |

### 3.2 The gate decisions (CONSERVATIVE — surfaced as Open Questions, not silently set)

This area touches the **pricing-floor / margin visibility** gate. The
conservative default I propose, with the loosenings flagged for Jac in §11:

| Data | Proposed gate | Rationale |
|---|---|---|
| **Our rate / `bottomDollar` / `askPrice` / margin delta** (the `Ours`/`Δ` columns, comp delta, `quotedPrice`, `estValue`) | `canMoney()` (tier ≥ `money`) to **view** | same floor that already hides pricing from `staff`; a comp that says "market $X vs our floor $Y" leaks the floor. **Enforced by NOT emitting the figure into the DOM** (§4.5 `row()` returns `🔒`), never by CSS `display:none` (which a `staff` user can inspect away). |
| **External-only comp numbers** (competitor day-rate, auction sale `amount`) | **`money`+ (conservative default)** — OQ-1 may loosen to `staff` | external numbers aren't *our* margin, but they're commercially sensitive and the app currently sets **no** precedent of showing any pricing surface to `staff`. Defaulting open here would be the first such precedent — hence held closed pending Jac. |
| **Logging a lost-demand miss** (`demandForm` capture) | `staff` (anyone can report a turn-away) | maximize capture; a Driver overhearing "y'all got a 30k excavator?" should be able to brand it. The capture FORM hides money fields (`quotedPrice`/`estValue`) when `!canMoney()` — a `staff` capturer logs the miss without a dollar figure. |
| **Reading lost-demand counts / trends / tally** | `money`+ | the aggregate (misses × est value, buy-pressure) is a buying signal = commercial. The raw row's non-money fields (category, reason, window) MAY show to `staff` per OQ-1; the tally and est-value totals do not. |
| **Editing / deleting a comp or miss** | `manager`+ (proposed) — OQ-3 | data-integrity; misses feed purchasing. Capture is `staff`, but *correcting/removing* a record that drives a buy decision is a higher bar. Open: should `money` edit *their own* captures? |
| **Opening the capture form at all** | `staff`+ | the form itself is the capture surface; gating it higher would defeat the capture-where-it-dies goal |

### 3.3 Customer-isolation & PII
- A lost-demand miss **may** reference a customer (the one who asked). Store it by
  **`customerId` only** (a foreign key), never a denormalized name/phone/email —
  same discipline as rentals. The board renders the name by lookup at display
  time and respects whatever customer-row visibility the viewer already has.
- A miss may also be **anonymous** (walk-in, phone tire-kicker) — `customerId`
  null is valid and expected.
- Comp records reference **competitors**, not our customers — no customer PII.
- **Never** store a competitor's confidential pricing obtained improperly; comps
  are "publicly quotable / observed" figures. (Policy note, not a code gate.)

---

## 4. Data Model

Two new entities, both **additive**, both riding the existing schema-less
diff-sync. Schema-less means: add fields freely, never assume a field exists,
default on read.

### 4.1 Entity: `marketComps` (competitor / MSRP / auction pricing comp)

Lives in `DATA.marketComps`; one Sheets tab `marketComps`; id field `compId`.

```js
{
  compId:        'MC0001',        // 'MC' + zero-padded running number
  categoryId:    'CAT011',        // FK → category being benchmarked (required)
  source:        'United Rentals',// free text competitor / auction house / "MSRP"
  sourceType:    'competitor',    // 'competitor' | 'auction' | 'msrp' | 'dealer'
  metric:        'rate7Day',      // which of OUR rate fields this benchmarks
                                  //   'rate1Day'|'rate7Day'|'rate4Wk'|'weekend'
                                  //   |'memberDaily'|'msrp'|'askPrice'|'salePrice'
  amount:        1390,            // the external number, USD whole dollars
  region:        'Lake Charles, LA', // where the comp was observed (free text)
  observedDate:  '2026-06-20',    // when captured (ISO)
  url:           '',              // optional source link (quote screenshot, listing)
  notes:         'Phone quote, includes delivery within 25mi.',
  enteredBy:     'office',        // role id of capturer (audit, not PII)
  archived:      false,           // soft-delete → gray, never hard-delete (audit)
}
```

**Relationships:** `categoryId` → `categories[].categoryId`. A category has 0..N
comps. No comp without a category (a comp benchmarks one of *our* lines).

**Derived (NOT stored):** the **delta vs our rate** — computed at render from the
live category record so it never goes stale (see §7.1).

### 4.2 Entity: `demandSignals` (lost-demand / turn-away ledger)

Lives in `DATA.demandSignals`; one Sheets tab `demandSignals`; id field
`signalId`.

```js
{
  signalId:      'DS0001',        // 'DS' + running number
  categoryId:    'CAT008',        // FK → category requested (nullable: "don't stock it")
  requestedLabel:'30k excavator', // free text when categoryId is null / not in catalog
  reason:        'no-availability',// 'no-availability'|'dont-stock'|'price'|'window'|'other'
  startDate:     '2026-07-01',    // requested window (optional, ISO)
  endDate:       '2026-07-05',
  customerId:    'C0009',         // FK → customer (nullable for anonymous/walk-in)
  quotedPrice:   null,            // if reason='price', what we quoted (money+ only)
  competitorWon: '',              // optional: who got the job instead
  estValue:      null,            // optional est. revenue of the miss (money+ only)
  observedDate:  '2026-06-28',    // ISO, defaults today
  enteredBy:     'sales',         // role id (audit)
  resolved:      false,           // closed out (e.g., we bought the unit) → gray
  notes:         '',
}
```

**Relationships:** `categoryId` → category (nullable); `customerId` → customer
(nullable, FK-only, no PII denorm). When `categoryId` is null the
`requestedLabel` carries the ask (the buy signal for a category we don't even
have).

### 4.3 Registry constants (proposed, in `config.js`)

```js
// config.js — alongside the other registries
export const COMP_SOURCE_TYPES = ['competitor', 'auction', 'msrp', 'dealer'];
export const COMP_METRICS = ['rate1Day','rate7Day','rate4Wk','weekend','memberDaily','msrp','askPrice','salePrice'];
export const DEMAND_REASONS = [
  { id: 'no-availability', label: 'No availability',   color: 'yellow' },
  { id: 'dont-stock',      label: "Don't stock it",     color: 'red'    },
  { id: 'price',           label: 'Lost on price',      color: 'red'    },
  { id: 'window',          label: 'Window conflict',    color: 'yellow' },
  { id: 'other',           label: 'Other',              color: 'gray'   },
];
// New back-office boards
export const BACKOFFICE_BOARDS = [
  /* …existing… */
  { id: 'comps',   title: 'Market Comps'   },
  { id: 'demand',  title: 'Lost Demand'    },
];
```

### 4.4 Wiring into the sync layer (the additive edits)

| File | Edit | Note |
|---|---|---|
| `app.js:15638` `PERSIST_KEYS` | add `'marketComps'`, `'demandSignals'` | 11 → 13 entities |
| `app.js:15687` `PERSIST_ID` | add `marketComps:'compId'`, `demandSignals:'signalId'` | id field per entity |
| `app.js` `IDX` build (`app.js:693` cluster) | add `IDX.comp` / `IDX.signal` Maps | for fast FK lookup (mirrors `IDX.vendor` use in `BOARD_DEF`) |
| `config.js:371` `BACKOFFICE_BOARDS` | add `{id:'comps',title:'Market Comps'}`, `{id:'demand',title:'Lost Demand'}` | makes them appear in the board menu (`app.js:13863`) |
| `app.js:11149` `boardRows` | add `comps: DATA.marketComps, demand: DATA.demandSignals` | feeds the board popup count + table |
| **`app.js:11150` `BOARD_DEF`** | **add a `comps` and `demand` def** (`cols` + `row(rec)`) — REQUIRED, not optional | without this the board popup has no columns to render; this is the single edit the prior draft under-specified. The `row()` renderers carry the `canMoney()` gate inline (see §4.5). |
| `app.js:9796` `WINDOW_CATALOG` | add `compForm` + `demandForm` entries | CI-gated (`check-window-catalog.mjs`) |
| `data.js` | seed a handful of demo comps + signals (NON-real, NON-PII) | so the board renders non-empty in demo |

### 4.5 The `BOARD_DEF` row renderers (gate lives HERE, concretely)

The board columns and per-row rendering follow the shipped `BOARD_DEF` pattern
(`app.js:11150`). The money gate is enforced **inside `row()`** so a `staff`
viewer never receives the figure in the DOM at all (not merely CSS-hidden):

```js
// app.js — BOARD_DEF additions (sketch; final renderer per jactec-ui pass)
comps: {
  cols: ['Category', 'Source', 'Type', 'Metric', 'Market', /*money+:*/ 'Ours', 'Δ', 'Observed'],
  row: (c) => {
    const cat = IDX.category.get(c.categoryId);
    const money = canMoney() && currentRole; // see §2.1: never trust bare canMoney() for a no-role demo
    const ours  = cat && !catRatesUnset(cat) ? cat[c.metric] : null;
    return [
      cat ? esc(cat.name) : esc(c.requestedLabel || '—'),
      c.url ? linkName(esc(c.source), { js:'js-open-link', data:{ url:safeUrl(c.url) } }) : esc(c.source),
      statusPill('compSourceType', c.sourceType),
      esc(c.metric),
      money(c.amount),                                   // external number — visible per OQ-1 default money+
      money ? (ours==null ? 'rate unset' : money(ours)) : '🔒',   // OUR rate — money+ ONLY
      money ? compDeltaChip(c, ours) : '🔒',                       // delta vs floor — money+ ONLY
      esc(fmtShortDate(c.observedDate)) + (compAged(c) ? ' '+badge('aged','yellow') : ''),
    ];
  },
},
demand: {
  cols: ['Requested', 'Reason', 'Window', 'Customer', /*money+:*/ 'Quoted', 'Est. Miss', 'Logged'],
  row: (s) => {
    const cat  = IDX.category.get(s.categoryId);
    const cust = s.customerId ? IDX.customer.get(s.customerId) : null;  // FK lookup at render
    const money = canMoney() && currentRole;
    return [
      cat ? esc(cat.name) : `<b class="c-red">${esc(s.requestedLabel||'—')}</b>`, // don't-stock = loud
      statusPill('demandReason', s.reason),
      (s.startDate ? esc(fmtShortDate(s.startDate)) : '—') + (s.endDate ? '–'+esc(fmtShortDate(s.endDate)) : ''),
      cust ? linkName(esc(cust.name), { js:'js-customer-open', data:{ rec:s.customerId } }) : 'Walk-in / phone',
      money && s.quotedPrice!=null ? money(s.quotedPrice) : (money ? '—' : '🔒'),
      money && s.estValue!=null    ? money(s.estValue)    : (money ? '—' : '🔒'),
      esc(fmtShortDate(s.observedDate)),
    ];
  },
},
```

Two derived helpers (§7) back these: `compDeltaChip(c, ours)` (the §7.1 delta,
already gated by the caller) and `compAged(c)` (`observedDate` > 180d). The
customer cell is rendered **by FK lookup** (`IDX.customer.get`) — no name is ever
read off the `demandSignals` record itself (§3.3, AC-5). `statusPill`/`badge`
read from `STATUS_META`, so two new status registries are needed (§4.6).

### 4.6 Two new `STATUS_META` registries (for the pills/badges)

The `statusPill('compSourceType', …)` / `statusPill('demandReason', …)` calls
above need entries in the status registry (the shipped `getStatus`/`STATUS_META`
source, same place `paymentMethod`/`vendorType` live). Additive:

```js
// config.js — STATUS_META additions
compSourceType: { competitor:{color:'gray'}, auction:{color:'gray'}, msrp:{color:'gray'}, dealer:{color:'gray'} },
demandReason:   {
  'no-availability':{color:'yellow'}, 'dont-stock':{color:'red'},
  'price':{color:'red'}, 'window':{color:'yellow'}, 'other':{color:'gray'},
},
```

These colors mirror the `DEMAND_REASONS` registry (§4.3) — keep the two in sync
(or derive one from the other to avoid drift; flagged in OQ-12).

**Migration concern:** schema-less Sheets means the two new tabs are created
lazily on first `sync` of a record. Backends that predate this area simply have
empty arrays (default-on-read). **No destructive migration.** The `load` /
`computeChanges` path should tolerate a `PERSIST_KEYS` entry whose tab doesn't
exist yet (it round-trips an empty array) — **this is an assumption to confirm
with the backend owner** (OQ-7), not a verified fact (Code.gs is gitignored).

---

## 5. Backend / Integration Contract

### 5.1 Persistence — reuse, don't add
Both entities persist through the **existing** `sync` action via the diff-sync
layer. **No new persistence action is required** — adding the keys to
`PERSIST_KEYS`/`PERSIST_ID` is the entire backend change for storage, and the
Sheets tabs auto-create. This is the cheapest possible backend footprint and is
strongly preferred for v1.

### 5.2 Optional additive action (Phase 2+, NOT v1)
If/when external feeds are wired (auction APIs, competitor scrape), a single
**additive** action on the one `backendCall` entry point:

```
action: 'marketFetch'
payload: { action:'marketFetch', password, categoryId, sourceType }
returns: { ok:true, comps:[ {source, metric, amount, region, url, observedDate} … ] }
         | { ok:false, error }
```

Contract rules (matching the house backend discipline, `CODE-MAP.md` Part III):
- POST `text/plain` (dodges GAS CORS preflight), gated by the team **password**.
- Server holds any third-party API key **server-side only** — never in the
  client, never in the repo, named only (e.g. `IRONPLANET_KEY`).
- Always replies `{ ok, … }`; client parses defensively, never coerces failure
  to success.
- **Additive only:** never changes an existing handler's behavior.

### 5.3 External integrations (all Phase 2+, all OQs)
| Integration | Use | Status |
|---|---|---|
| Auction listings (Ritchie Bros / IronPlanet) | auto-pull MSRP/sale comps per category | OQ-8 — likely manual paste in v1 |
| Competitor rate scrape | day/week comp ingest | OQ-8 — manual in v1; legal/ToS risk |
| QuickBooks / accounting | none here (this is intel, not ledger) | out of scope |
| `automated-pricing` engine (#9) | **consumes** comps + demand as inputs | the downstream consumer, see §12 |

**v1 has zero external integration.** All capture is manual (paste a quote, log a
miss). This keeps v1 inside the existing sync layer with no new GAS handler.

### 5.4 Failure handling

**Local-first capture (storage path).** A logged miss/comp writes to
`DATA.demandSignals` / `DATA.marketComps`, reindexes `IDX`, renders, then
diff-syncs on the normal save timer — identical to every other entity. An
offline or sync failure never loses the record: it stays in local state and
syncs on reconnect, exactly as rentals/WOs behave today. The id (`MC####` /
`DS####`) is minted client-side from the running max, so a record is fully
addressable before it ever reaches the server.

**Multi-user / concurrency.** Two users editing the same comp resolves
last-writer-wins via the existing diff-sync `computeChanges` path — acceptable
for low-write intel (a comp is rarely co-edited). Two users *adding* comps
concurrently each mint an id from their local max; a collision is possible if
both are offline and pick the same `MC####`. Mitigation: the running-number
scheme should derive from the synced max at mint time, and a post-sync de-dup
guard (same id → keep both, re-id the loser) — same risk profile as any
client-minted id in the app today (OQ-9 confirms the prefix; the collision
window is the residual risk, called out in §10).

**`marketFetch` (Phase 2+ external path) failure handling.**
- Network/timeout → client shows "couldn't reach the market feed," the board
  falls back to manually-entered comps; **no partial write** of fetched comps.
- `{ ok:false, error }` → surface the error string verbatim in a non-blocking
  toast; never coerce to success.
- A fetched comp is staged as a **draft** in `compForm` for human confirmation
  before it persists — an auto-ingested number is never silently trusted into
  the ledger (provenance: `enteredBy:'feed:<source>'`).
- The server-side third-party key is named-only (e.g. `IRONPLANET_KEY`); a
  missing/expired key returns `{ ok:false, error:'feed-unconfigured' }`, not a
  stack trace, and never leaks the key value.

---

## 6. UX / UI

All UI in the **yard data-plate** language: dark steel panels
(`linear-gradient(180deg,#1b2129,#0c0e11)`), corner **rivets**, the hi-vis
**hazard stripe** signature, **Saira Condensed** stamped uppercase labels, the
ONE safety-orange `#ff7a1a` accent for the primary/ignition action only, status
colors via the flag system (R/Y/G/gray — orange is chrome, never status), and a
**light ranch seasoning in copy** ("Lost Demand" board, "Brand a miss", "Round up
comps", "The market read"). Every new UI element needs a `data-r` stamp and every
new popup a `WINDOW_CATALOG` entry — both **CI-enforced** (`gen-rule-usage`,
`check-window-catalog`).

### 6.1 Surface choice — boards, not a grid card
The 6-card grid (`GRID_CARDS`) is fixed at 3×2 and owns the operational entities.
Market Research is **back-office intel**, so it follows the
Parts/Vendors/Expenses/Files precedent (the **4 boards shipped today** in
`BACKOFFICE_BOARDS`, `config.js:371`): **two new back-office boards** (the 5th and
6th) reached from the board menu (`app.js:13863`) / Tools tray, rendered by the
existing board popup (`app.js:9378`) + its `BOARD_DEF` renderer (`app.js:11150`).
This avoids reflowing the grid and reuses the shipped board chrome — but note a
board is only "free" for the *list shell*; its columns + per-row gating are
new code in `BOARD_DEF` (§4.5).

- **Board: "Market Comps"** (`id:'comps'`) — the competitor/auction/MSRP ledger.
- **Board: "Lost Demand"** (`id:'demand'`) — the turn-away ledger.

Both ride `BACKOFFICE_BOARDS` and the `kind:'board'` popup, so **no new popup
kind** is strictly required for the list views — they reuse the catalogued
`board` window. The **two capture forms ARE new popups** and need their own
`WINDOW_CATALOG` entries (§6.5).

### 6.2 Market Comps board (data-plate list)
A steel panel with a hazard-stripe header rail and the Saira stamp
**"MARKET COMPS"**. Each comp row is a data-plate strip:

```
┌─[rivet]──────────────────────────────────────────────[rivet]─┐
│ ▌ 12k Excavator · rate7Day        UNITED RENTALS  competitor  │
│   Market $1,390   ·   Ours $1,290   ·   ▲ +$100 (+7.8%)       │  ← delta, money+ only
│   Lake Charles, LA · observed Jun 20 · 🔗                     │
└─[rivet]──────────────────────────────────────────────[rivet]─┘
```

- The **delta chip** (`Ours $X · ▲/▼ $Y`) renders **only when `canMoney()`** — it
  exposes our live rate; `staff` viewers (if comps are shown to them at all per
  OQ-1) see the external number alone.
- Delta color via the flag system: market **above** ours = green-ish "room to
  raise"; market **below** ours = red "we're priced over market." (Direction
  semantics in OQ-2 — "room to raise" being good or bad depends on Jac's read.)
- Sort/filter via the existing board search/sort chrome (the `boardview` window).
- Grouped by category (collapsible), each group header showing our current rate
  for that metric as the baseline.

**States:** empty → a stamped "No comps rounded up yet" plate with a single
ignition-orange **"+ Add Comp"** button; loading → the standard skeleton; error →
inline plate, capture stays local.

### 6.3 Lost Demand board
Same data-plate language, stamp **"LOST DEMAND"**, ranch copy. Each miss is a row
colored by `DEMAND_REASONS[].color` (flag system):

```
┌──────────────────────────────────────────────────────────────┐
│ ▌ Skid Steer 75hp        NO AVAILABILITY      Jul 01–05       │
│   Devin Lyles (bayou games) · est $1,400 miss                 │  ← est value money+ only
│   "Needed it same week, we were booked."                      │
└──────────────────────────────────────────────────────────────┘
```

- A **"don't-stock-it"** miss (no `categoryId`) shows the `requestedLabel` in
  bold red — the loudest buy signal.
- A small **tally strip** at the top: misses per category in the trailing 90 days
  (the demand trend at a glance), `money`+ only.
- `estValue` and `quotedPrice` render `money`+ only.

### 6.4 Capture entry points (low-friction, where the miss happens)
The whole value is **capturing the miss at the moment it dies**, so capture must
be reachable from where a quote dies, not only from the board:

1. **Rentals card** — when a category shows **0 Available** for a requested window
   (the `categoryAvailableCount` path, `units-fleet`), surface a tiny stamped
   **"Brand the miss"** link that pre-fills the demand-capture popup with the
   category + window. (Hook point, OQ-5 — exact placement TBD with
   `rentals-dispatch`.)
2. **Tools tray** — a **"Log Lost Demand"** action opens the blank capture popup.
3. **Right-click context menu** — on a category row, a "Brand a miss" item
   (reuses the R20 context menu).
4. **Mr. Wrangler** — natural-language "log a miss: customer wanted a 30k
   excavator we don't have" → the agentic action fills the popup (depends on
   `wrangler-ai` full-action-parity; Phase 2).

### 6.5 New popups (each needs a `WINDOW_CATALOG` entry + `data-r` stamp)

| `kind` | Label | `tag` | Sample seed |
|---|---|---|---|
| `compForm` | New / Edit Comp | `Market · comp` | `{ editId:null, draft:{ categoryId:(cats[0]||{}).categoryId, sourceType:'competitor', metric:'rate7Day' } }` |
| `demandForm` | Log Lost Demand | `Market · miss` | `{ editId:null, draft:{ categoryId:null, reason:'no-availability', observedDate:TODAY_ISO } }` |

Both are steel form popups with rivets, a hazard-stripe title rail, Saira field
stamps, and a single ignition-orange commit button ("Round Up Comp" / "Brand the
Miss"). The form layout mirrors the Receipt form (`receiptform`) and New Customer
(`newCustomer`) popups so it reads as the same shop. The `category` field is a
dropdown over live categories; `metric` a segmented control; money-bearing inputs
(`quotedPrice`, `estValue`, comp delta preview) are hidden when `!canMoney()`.

### 6.6 Mobile reflow
The app is desktop-first (min-width 1180px), but the capture popups must be
phone-usable per the `jactec-ui` mobile rules (the field miss often gets logged on
a phone): bottom-sheet reflow, `dvh` sizing, safe-area insets, 44px touch
targets, a light Vibration-API haptic on commit (Android). The list boards stay
desktop-primary.

### 6.7 R-rulebook & catalog obligations (CI-enforced)
- Every new element (board rows, comp/miss rows, capture-link, form fields) gets a
  `data-r="Rxx"` stamp; regenerate `rule-usage.js` via `ci/gen-rule-usage.mjs`
  (drop `--check`). Reuse existing rules where the element matches (e.g. R24 close
  X, R21 file-drop for a comp-source screenshot, R22 datefield for the window) and
  mint a new rule only for a genuinely new interaction.
- Add `compForm` + `demandForm` to `WINDOW_CATALOG`; `check-window-catalog.mjs`
  fails CI otherwise.
- If a chapter banner is added/moved, regenerate the Code Atlas
  (`tools/gen-code-map.mjs`).

---

## 7. Business Rules / Derivations / Money

### 7.1 Comp delta (the one real formula)
Computed at render from the **live** category record, never stored:

```
ourRate  = category[comp.metric]          // e.g. category.rate7Day
delta    = comp.amount - ourRate          // + = market above us
deltaPct = ourRate ? delta / ourRate : null
```

- If `catRatesUnset(category)` for a rate metric (the `$0` un-entered case,
  `app.js:873`), show **"rate unset"** instead of a misleading "market $1390 vs
  ours $0 → +∞%".
- `deltaPct` rounds to 1 decimal; `delta` is whole dollars.
- The delta + both our-rate and pct render **only under `canMoney()`**.

### 7.2 Demand trend rollups (derived, not stored)
```
missesByCategory[catId] = demandSignals filtered to last 90d, unresolved, grouped
missCount               = count
missValue               = Σ estValue (money+ only; null estValue = 0)
```
A "buy pressure" indicator per category = `missCount` weighted by reason
(`dont-stock` and `no-availability` weight highest). Exact weighting is OQ-6.

### 7.3 Edge cases
| Case | Rule |
|---|---|
| Comp for a metric the category doesn't price (`salePrice` has no field) | benchmark against `askPrice`/`bottomDollar`; never invent a field |
| Miss with null `categoryId` (don't-stock) | no delta; counts toward "categories to add" buy signal, not utilization |
| Anonymous miss (null `customerId`) | valid; renders "Walk-in / phone" |
| Stale comp (`observedDate` > 180d) | render dimmed with an "aged" yellow flag — comps decay |
| Resolved/archived records | gray, excluded from trend rollups |
| `estValue`/`quotedPrice` present but viewer is `staff` | value hidden, record still counts |

### 7.4 No money MOVES here
This area **records and surfaces** money figures but **takes no payment, charges
nothing, and changes no rate**. It never writes to a category's rate fields (that
would be `automated-pricing`'s job, gated separately). It is read-mostly intel.
The only money gate is **visibility** (§3.2), not action — which is why capture
can sit at `staff` while figures sit at `money`.

---

## 8. Phasing & Milestones

### Phase 1 — MVP (manual capture, in-scope for v1)
1. Two entities (`marketComps`, `demandSignals`) wired into `PERSIST_KEYS` /
   `PERSIST_ID` / `IDX` / `boardRows`. Seed demo rows.
2. Two back-office boards (`comps`, `demand`) via the existing board popup.
3. Two capture popups (`compForm`, `demandForm`) + `WINDOW_CATALOG` entries +
   `data-r` stamps.
4. Capture entry points: Tools tray + context menu (the 0-Available Rentals hook
   is Phase 1.5, pending `rentals-dispatch` coordination).
5. Comp delta + 90-day demand tally derivations, fully gated.
6. Tier gates per §3.2 (conservative defaults; OQ-1/OQ-3 resolved before build).

**In-scope v1:** manual capture, manual comps, the two boards, the derivations,
the gates, demo seed.
**Out-of-scope v1:** any external feed/API, the `marketFetch` action, automated
rate suggestions, the Mr. Wrangler agentic capture, cross-region benchmarking,
charts/graphs beyond the simple tally.

### Phase 2 — Signal enrichment
- The 0-Available Rentals capture hook (with `rentals-dispatch`).
- Mr. Wrangler agentic capture ("log a miss …").
- Per-category demand-trend overlay (sparkline) on the comps board.

### Phase 3 — External feeds & the pricing bridge
- Additive `marketFetch` action; auction/competitor ingest (legal review first).
- **Hand-off to `automated-pricing` (#9):** comps + demand become the inputs to a
  rate-recommendation engine. Market Research stays the evidence layer; pricing
  stays separate and gated.

---

## 9. Acceptance Criteria

| # | Criterion | Test surface |
|---|---|---|
| AC-1 | `marketComps` & `demandSignals` round-trip through diff-sync (add → sync → reload) without data loss | `ci/logic-test.mjs` + manual |
| AC-2 | A comp delta computes from the **live** category rate, recomputing when the rate changes | `ci/logic-test.mjs` unit on the §7.1 formula |
| AC-3 | `catRatesUnset` category shows "rate unset", never a `/0` or `+∞%` | logic test |
| AC-4 | With a `staff`-tier role, **no** `bottomDollar`/`estValue`/`quotedPrice`/our-rate/delta string appears **in the DOM** (not merely CSS-hidden) of the two boards or forms — `row()` returned `🔒` for those cells | smoke (assert absence in rendered HTML) + manual role-switch |
| AC-4b | A **no-role** demo session (`!currentRole`) is treated as below-`money` for the margin columns (per OQ-14 default) — same figures suppressed | smoke with no role set |
| AC-5 | A lost-demand miss stores `customerId` only — no name/phone/email denormalized into the record | code review + logic test |
| AC-6 | Both new popups appear in `WINDOW_CATALOG` and `check-window-catalog.mjs` passes | `ci/check-window-catalog.mjs` |
| AC-7 | Every new UI element carries a `data-r` stamp; `gen-rule-usage --check` passes | `ci/gen-rule-usage.mjs` |
| AC-8 | No chapter-banner drift, or the Atlas is regenerated | `tools/gen-code-map.mjs --check` |
| AC-9 | `ci/smoke.mjs` boots the app with the two new boards and renders both empty + seeded | `ci/smoke.mjs` |
| AC-10 | An anonymous (null customer) and a don't-stock (null category) miss both capture and render correctly | manual |
| AC-11 | `?v=` cache-bust token bumped on deploy (style.css / app.js / rule-usage.js) | deploy checklist |
| AC-12 | Both boards render columns (have `BOARD_DEF` entries) and a non-empty seeded count; `compSourceType`/`demandReason` pills resolve a color (no "unknown status") | smoke + manual |
| AC-13 | A category-less (don't-stock) comp/miss renders via `requestedLabel` without throwing on the null `IDX.category.get` | logic test |

**CI-gate impact summary:**
- **`ci/check-window-catalog.mjs`** — two new popups (`compForm`, `demandForm`)
  MUST be added to `WINDOW_CATALOG` or CI fails.
- **`ci/gen-rule-usage.mjs --check`** — every new element (board rows, form
  fields, capture links) needs a `data-r` stamp; regenerate `rule-usage.js`.
- **`tools/gen-code-map.mjs --check`** — if a new chapter banner is added for the
  Market Research code, regenerate the Code Atlas.
- **`ci/smoke.mjs`** — boots the app with the two new boards; assert both render
  empty + seeded, and (AC-4) assert margin strings are absent from `staff`-role
  HTML.
- **`ci/logic-test.mjs`** — unit the §7.1 delta formula (incl. `catRatesUnset` →
  "rate unset", no `/0`) and the §7.2 rollups; round-trip both entities through
  diff-sync.
- **No new CI gate is introduced**; the `STATUS_META` additions ride existing
  pill rendering (no separate gate), but a mismatch surfaces as a runtime
  "unknown status" — covered by AC-12.

---

## 10. Risks & Edge Cases

| Risk | Severity | Mitigation |
|---|---|---|
| **Margin/floor leak** — a comp delta exposes `bottomDollar`/our rate to a `staff` viewer | High | hard `canMoney()` gate on every figure; AC-4 verifies; surfaced as OQ-1/OQ-3 not silently loosened |
| **Customer PII denorm** in a miss record | High | FK-only (`customerId`), name resolved at render; AC-5 |
| **Stale comps mislead a buy** | Med | aging flag at 180d; observedDate mandatory; trend uses 90d window |
| **Legal/ToS on competitor scraping** | Med | v1 is manual paste only; any feed is Phase 3 behind legal review (OQ-8) |
| **Low capture rate** (misses never get logged) | Med | put capture where the miss dies (0-Available hook, context menu, Wrangler), not only on a board nobody opens |
| **Grid/board sprawl** | Low | reuse `BACKOFFICE_BOARDS` + the board popup; no new grid card |
| **Backend tab auto-create assumption wrong** | Med | OQ-7 — verify the `load`/`sync` path tolerates a not-yet-existing tab before shipping |
| **Multi-user race** on the same comp | Low | rides the existing diff-sync last-writer-wins; same as all entities, acceptable for low-write intel |
| **Client-minted id collision** (two offline adders pick same `MC####`/`DS####`) | Low | mint from synced max; post-sync de-dup re-ids the loser (§5.4); same residual risk as every client-minted id today |
| **Money leak via CSS, not DOM** — a `staff` user inspects a `display:none` figure | High | gate **in `row()`** so the figure is never emitted (returns `🔒`), never CSS-hidden; AC-4 asserts the figure is absent from the DOM, not merely hidden |
| **No-role demo session sees margin** (`canMoney()===true` when `!currentRole`) | High | margin columns gate on `canMoney() && currentRole` (§4.5); OQ-14 confirms the policy |
| **Status-registry drift** — `DEMAND_REASONS` and `STATUS_META.demandReason` disagree | Low | derive one from the other (OQ-12); else a manual-sync note + review |
| **Demo seed PII / confidential comps** | High | seed must be obviously fake (no real competitor confidential pricing, no real customer name/phone) — repo is public via Pages; the seed lives in `data.js` which IS served |

---

## 11. Open Questions (for Jac)

> **Resolved 2026-06-29:** OQ-8 → D1 (external feeds are the headline) · OQ-1/OQ-14 → D2 (comps public/customer-facing, margin floor stays secret) · OQ-5 → D3 (capture into the 0-available button, Phase 1). Adopted: OQ-2/3/4/7/9/10/11/12/13/16. See the Decisions block up top.

*(No seed questions were captured for this area; all below are generated from the
code and the gate analysis above.)*

- **OQ-1 (gate).** Should **external-only** comp numbers (a competitor's published
  day-rate, an auction sale price — not our margin) be visible to `staff`, or
  gated to `money`+ like everything else pricing-adjacent? Trade-off: `staff`
  visibility helps a Driver/M.Tech understand "why we charge what we charge," but
  any pricing surface to `staff` is a precedent the app currently never sets.
  **Proposed default: `money`+ (conservative).**
- **OQ-2 (semantics).** When market is **above** our rate, is that green ("room to
  raise") or neutral? The "good/bad" direction of a price delta is a business
  read, not a universal — I don't want to color it wrong. What's the intent
  signal you want at a glance?
- **OQ-3 (edit gate).** Edit/delete of comps and misses at `manager`+ (proposed) —
  or should `money` (Office/Sales) be able to edit their own captures? Capture is
  `staff`; who can *correct/remove*?
- **OQ-4 (surface).** Two back-office **boards** (proposed) vs. one merged
  "Market" board with two tabs vs. a Settings pane. Boards reuse shipped chrome
  and keep comps next to the pricing they benchmark; a merged board is one fewer
  entry in the tray. Preference?
- **OQ-5 (capture hook).** The 0-Available Rentals "Brand the miss" link — Phase 1
  or Phase 1.5? It's the highest-value capture point but it reaches into
  `rentals-dispatch`'s availability render and needs that area's sign-off.
- **OQ-6 (buy-pressure weighting).** How should the demand-trend "buy pressure"
  weight reasons? Proposed: `dont-stock` and `no-availability` highest, `price`
  next, `window`/`other` lowest. Do you want raw counts instead, or count ×
  `estValue`?
- **OQ-7 (backend).** Confirm the `load`/`computeChanges` path tolerates a
  `PERSIST_KEYS` entry whose Sheets tab doesn't exist yet (auto-create on first
  `sync`). If not, we need an additive `ensureTab`-style server tweak before the
  entities go live. (Backend is gitignored — needs the backend owner to confirm.)
- **OQ-8 (external feeds).** Any appetite (and legal comfort) for auto-pulling
  auction comps (Ritchie Bros/IronPlanet) or competitor rates? If yes, that's the
  Phase 3 `marketFetch` action + a server-side key; if no, v1 stays 100% manual.
- **OQ-9 (id format).** `MC####` / `DS####` running numbers (proposed) consistent
  with the `U###`/`C####`/invoice-id conventions — confirm the prefixes.
- **OQ-10 (entity vs sub-record).** Comps as a **standalone entity** (proposed,
  syncs independently) vs. an array embedded on the category record
  (`category.comps[]`). Standalone keeps the category record lean and lets comps
  sync/diff independently; embedded keeps a comp physically next to its rate.
  Trade-off is diff-sync granularity vs. locality.
- **OQ-11 (Mr. Wrangler).** Should agentic capture ("log a miss…") be in v1 or
  wait for the wrangler full-action-parity work to settle? Proposed: Phase 2.
- **OQ-12 (registry duplication).** The reason colors live in **two** places —
  `DEMAND_REASONS` (§4.3) and the `demandReason` `STATUS_META` block (§4.6).
  Keep both and keep them in sync, or derive the `STATUS_META` entry from
  `DEMAND_REASONS` at module load so there's one source of truth? Trade-off:
  one-source avoids drift but couples the status registry to a new array shape;
  duplication is simpler but a CI drift risk. **Proposed: derive from
  `DEMAND_REASONS`.**
- **OQ-13 (dependency direction).** Confirm Market Research is **upstream**
  (evidence producer) and `automated-pricing` is **downstream** (consumer) — the
  master roadmap currently lists the dependency in the opposite direction on this
  area's line (§12.1). This determines build order: if Market Research is truly
  upstream it ships standalone first (proposed); if it actually needs the pricing
  engine, the whole area blocks behind #9.
- **OQ-14 (no-role demo leak).** `canMoney()` returns `true` for a blank role
  (the `!currentRole` short-circuit, §2.1). A demo/kiosk session with no role set
  would therefore see *all* margin figures. Is that acceptable for demo, or do
  the board renderers gate on `canMoney() && currentRole` (proposed in §4.5) so a
  no-role session is treated as below-`money`? Trade-off: stricter is safer for a
  public-Pages demo but diverges from how every other money surface treats the
  no-role case. **Proposed: gate on `canMoney() && currentRole` for these
  margin-bearing columns specifically.**
- **OQ-15 (board edit affordance).** The shipped `BOARD_DEF` rows are largely
  read/link cells (parts/vendors/expenses). How does an edit/add reach the
  capture popups from the board — an add button in the board head (like the
  `files` board's "+ File"), a row click, or a context-menu item? Proposed: an
  ignition-orange add button in each board head + row-click-to-edit (gated by
  OQ-3's edit tier).
- **OQ-16 (estValue trust).** `estValue` on a miss is a hand-typed guess that
  rolls up into a headline "lost revenue" number. Do we want it free-entry, or
  auto-suggested from the category's `rate7Day` × a default window so the rollup
  is consistent? Free-entry is faster to capture; auto-suggest makes the
  aggregate comparable across capturers. Proposed: pre-fill from rate, editable.

---

## 12. Dependencies & Sequencing

### 12.1 Cross-area dependencies (roadmap slugs)
| Dependency | Direction | Why |
|---|---|---|
| `units-fleet` | **upstream (must exist — it does)** | comps attach to `categoryId`; misses reference categories; the 0-Available hook lives in availability logic |
| `automated-pricing` (#9) | **downstream consumer** (see note) | this area is the evidence layer that #9's rate-recommendation engine reads; #9 must NOT loosen the margin gate when it consumes comps. **Roadmap discrepancy (flagged):** the master roadmap lists `automated-pricing` in *this* area's "Depends on" line (i.e. as upstream), while #9's own section lists `market-research` as one of *its* dependencies. Both can't be upstream. The intended direction is: **Market Research is the upstream evidence producer; `automated-pricing` is the downstream consumer.** Market Research stands alone and ships first (§12.2). Surfaced for confirmation as OQ-13. |
| `financials-kpi` (#12) | **optional downstream** | a future "Lost Demand" or "Market Position" KPI ring could read demand rollups |
| `backend-data` (#7) | **upstream** | rides the existing diff-sync; OQ-7 (tab auto-create) needs the backend owner |
| `rentals-dispatch` (#1) | **lateral** | the 0-Available capture hook reaches into its availability render (OQ-5) |
| `customers-crm` (#4) | **lateral** | misses FK to a customer; reuse the no-PII-denorm discipline |
| `wrangler-ai` (#22) | **downstream (Phase 2)** | agentic miss capture |

### 12.2 What must land first
1. **Nothing blocks Phase 1 storage** — `units-fleet`, `customers-crm`, and the
   diff-sync layer are all shipped. The two entities can be wired and seeded now.
2. **Resolve OQ-1 / OQ-3 (gates)** on the main session **before build** — these
   are margin/PII visibility calls and must not be delegated or silently set.
3. **Resolve OQ-7 (backend tab)** with the backend owner before the entities go
   live against the real DB.
4. **`automated-pricing` does NOT need to land first** — Market Research stands
   alone as a capture/intel tool and delivers value (data-driven purchasing)
   independent of any pricing automation. The pricing bridge is the eventual
   payoff, not a prerequisite.

---

*End of DRAFT — every numbered decision above (especially §3 gates and §11) is
open for Jac's critique before any branch is cut.*
