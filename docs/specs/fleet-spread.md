# Fleet Spread — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/fleet-spread`
**Task branch:** `fleet-spread/spec` (proposed)
**Maturity:** ⬜ Greenfield
**Scope:** Make the app aware of *where* iron lives and earns — a first-class **Location/Yard** dimension (and the partner/co-owner arrangements that ride on it) so a single JacRentals DB can run more than one yard without forking, while every existing single-yard screen keeps working unchanged.

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

*(Everything from "## 1. Goal & Problem" down is the OLD wrong-premise draft, retained only until the re-author lands.)*

---

## 1. Goal & Problem

### 1.1 The problem
Rental Wrangler is **single-location by construction**. The whole app assumes one yard in Sulphur, LA:

- One Sheets DB, one password gate, one `PERSIST_KEYS` set (`app.js:15638`).
- One transport-pricing origin: `YARD_ORIGIN = 'JacRentals, Sulphur, LA, USA'` (`config.js:474`), fed straight into the Google Maps **RouteMatrix** `origins:[YARD_ORIGIN]` call (`app.js:1531`, inside the `APP-06` transport editor). (Note: the live code uses `RouteMatrix.computeRouteMatrix`, not the deprecated DistanceMatrixService — the spec must patch the real call site.)
- One Revenue Goal (`REVENUE_GOAL_DEFAULT = 150000`, `config.js:557`) summed across all units, all customers, no geographic split.
- A vestigial `store` normalizer (`config.js:290`) that *collapses* every legacy store code — `'SUL'`, `'BMT'`, `'Pick One'` — down to the single string `'Sulphur'`. That map is the fossil of an older multi-store idea that was flattened, and it's the clearest proof the seam was deliberately closed.
- The role doc states it plainly: *"Other tenants' data (not applicable — single-store, but worth noting if multi-location is ever added)"* (`role-roles.md:60`).

So the business questions a growing rental operation asks have **no home in the data model**:

- *Which yard is U004 stabled at right now? Where does it return to?*
- *Is the Beaumont yard hitting its own revenue number, or is Sulphur carrying it?*
- *When a Lake Charles customer rents, which yard's transport clock starts — and which yard's iron is even eligible?*
- *Partner Joe co-owns three excavators at 40% — what's his cut this month, and can his login see only his machines?*

None of these are answerable. The fields don't exist; the math is yard-blind; there is no partner concept at all.

### 1.2 What this area is for
Introduce a **Location dimension** as an *additive, optional* attribute on the entities that physically have a place (Units, and by inheritance Rentals/Transport), plus a thin **Partner/co-owner** ledger layer on top of Units. The north star is that JacRentals can stand up a second yard — or onboard a co-ownership deal — **without a code fork and without breaking the single-yard experience for the 99% case that stays one yard.**

This is explicitly a **Want** (tier), priority #11. It is *strategic optionality*, not a current operational need. The spec is deliberately phased so Phase 1 ships the data spine + a yard filter (real value, low risk) and the harder money/partner/isolation questions are surfaced as Open Questions for Jac rather than silently decided.

### 1.3 North star
> One DB, many yards. Open the app and it looks **exactly like today** when there's one yard. Add a second yard and every list, map, KPI, and transport quote becomes yard-aware — each yard sees its own iron and its own number, transport prices from the *right* origin, and a co-owner login sees only the machines they own. Nothing about the single-yard path regresses.

---

## 2. Current State (Baseline)

Mapped against live code on 2026-06-28. **Everything in this area is greenfield** — the table records what exists *adjacent* to build on, not what's shipped for Fleet Spread.

| Concern | State | Anchor |
|---|---|---|
| Location field on any entity | ❌ Missing | — |
| Yard / store concept | 🟡 Fossil only — `store` map flattens all codes → `'Sulphur'` | `config.js:290` |
| Transport origin | 🟡 Single hardcoded const | `config.js:474` (`YARD_ORIGIN`), `app.js:1531` |
| Revenue Goal | 🟡 Single global number | `config.js:557` (`REVENUE_GOAL_DEFAULT`), `COMPANY_DEFAULTS.revenueGoal` `app.js:3119`, KPI engine `APP-21` `app.js:7167` |
| Persisted entities | ✅ 11 entity arrays, schema-less | `app.js:15638` (`PERSIST_KEYS`) |
| Backend sync | ✅ Diff-based upsert/delete on one `backendCall` entry | `APP-38` `app.js:15650` (`backendCall`), diff `computeChanges` `app.js:15693` |
| Money-action gate | ✅ Single tier check `canMoney()` = role tier ≥ `money` (rank 2) | `app.js:14166`, banner `APP-35` `app.js:14143` |
| Role / permission tiers | ✅ 5-tier ladder, customizable roles | `config.js:326` (`ROLE_TIERS`), `BUILTIN_ROLE_TIERS` `config.js:340`, `tierRank` `config.js:334` |
| Customer-isolation pattern | ❌ None — every signed-in role sees every record (full `load` ships the whole DB) | (no per-record scoping anywhere) |
| Fleet status pill | ✅ Purchased/Onboard/Active/Inactive/For Sale/Sold | `config.js:78–83` |
| Saved Views / filters | ✅ Field-driven view registry incl. fleet-status views | `config.js:400` (`SORT_FIELDS`), views sync `getViews/setViews` `app.js:11532` |
| Flag color engine | ✅ Per-entity computed R/Y/G | `APP-11` `app.js:3700`, spec `flag-color-system.md` |
| Popup inventory | ✅ `WINDOW_CATALOG` (admin Rulebook "Windows" tab) | `APP-27` `app.js:9789`, const `app.js:9796` |

**Key takeaways for the build:**
- The schema-less Sheets backend means **adding a `locationId` field to a unit is free** — no migration, no DDL. Records without the field simply read as "the home yard."
- There is **no customer-isolation machinery to extend** — partner-scoped visibility (§3) would be the app's *first* per-record visibility gate. That is the single most security-sensitive decision in this area and is treated conservatively.
- The `store` fossil tells us the intended normalization shape already (codes → human label); a real `LOCATIONS` registry is its natural successor.

---

## 3. Users, Roles & Data Gates

### 3.1 Roles that touch this area
Of the 15 role lenses (5 shipped built-ins + custom), the ones materially affected:

| Role / tier | Interest in Fleet Spread |
|---|---|
| **Owner / Admin** (admin tier) | Stands up yards, defines partner deals, sees the whole spread + per-yard P&L + each partner's cut. The only tier that can create/edit a Location or Partner. |
| **Manager** (manager tier) | Per-yard operational view; may be scoped to one yard (Open Q 11-G). Can move a unit between yards. |
| **Office / Sales** (money tier) | Filter rentals/invoices by yard; transport quotes from the correct origin; per-yard Revenue Goal progress. |
| **Asset Manager** (custom, money-ish) | Per-yard utilization and per-partner asset performance — "is *this yard's* iron earning its keep." |
| **Driver / Mechanic / M.Tech** (staff tier) | Mostly yard-as-filter — *which yard is this machine at, where does it go back to.* No money, no partner cut. |
| **Partner / Co-owner** (NEW role, see Open Q 11-C) | The app's first **isolated** login: sees only units they co-own + the revenue/expense lines on those units. Never sees other partners' deals, never sees full-fleet money. |

### 3.2 Data gates — SPEC THESE EXPLICITLY (do not loosen silently)

1. **Location create/edit = Admin only.** Standing up a yard or renaming one is an Admin-tier (`tierRank >= 4`) action, gated like Settings/category edits. Reusing the existing tier ladder (`config.js:334`), *not* a new password.

2. **Partner co-ownership math = Money-tier+ to view margin, Admin to edit the deal.** A partner's *cut* is derived from revenue **and cost** (margin), so it inherits the existing pricing-floor (`bottomDollar`/`trueCost`) visibility gate. A staff-tier user must **never** see partner-cut dollars (they expose cost basis). Surface as Open Q 11-E.

3. **Partner-login isolation = the new hard gate.** If a Partner role ships (Open Q 11-C), its login must see **only** records where the unit's `partnerId` (or split table) includes them. This is **per-record visibility**, which the app has never done. Two sub-decisions, both deferred to Jac:
   - **Where the filter lives** — client-side filter (fast, but the full DB still ships to the browser → not real isolation, PII-adjacent leak risk) vs. server-side scoped `load` (true isolation, but a new partner-scoped GAS action + a way for the server to know "who is this login"). **Recommendation: do NOT ship a partner login until server-side scoping exists.** Client-only "isolation" over a public-Pages app is theater. (Open Q 11-C / 11-F.)
   - **What a partner sees of the *customer*** — a co-owner needs to know their machine is on rent and earning, but the renting customer's PII (name, address, card) is JacRentals' relationship, not the partner's. Default: partner sees unit + utilization + their revenue line, **not** customer identity. (Open Q 11-D.)

4. **Per-yard money does NOT change any existing global gate.** Splitting the Revenue Goal by yard is a *display/grouping* change. The underlying money-action gate `canMoney()` (`app.js:14166`, banner `APP-35` `app.js:14143`) — `!currentRole || roleTier(currentRole) >= tierRank('money')`, i.e. tier rank ≥ 2 — and pricing-floor (`bottomDollar`/`trueCost`) visibility are **untouched**. No money *action* (charge/refund/lock/card-on-file) is added by this area in Phase 1. Yard CRUD (Phase 2) and partner-deal edits (Phase 3) are **Admin-tier** (rank ≥ 4) writes, *stricter* than `canMoney`; re-stabling a unit (Phase 2) is Manager-tier+ (rank ≥ 3). Each handler MUST re-check its tier server-agnostically at click time (defence-in-depth, matching the `canMoney` re-check pattern at `app.js:12417`+), never rely on the button being hidden.

5. **No PII into the spec or config.** Yard addresses are *business* addresses (fine to store). Partner identities are **people** — store `partnerId` + a display name only; **never** SSN, banking/payout details, tax ID, home address, or any partner PII in the repo, `config.js`, or the `data.js` demo seed (the repo is public via Pages). Partner payout banking, if ever needed, lives **server-side only** in the GAS config Sheet, referenced by name — see §5.2.

6. **Default-deny on every yard-aware visibility branch.** The yard badge, filter, Spread Board, partner panel, and `loadScoped` response all default to *showing less*: an unknown/blank tier resolves to rank 0 (`tierRank` `config.js:334`) and sees no money, no partner cut, and no cross-yard money rollup. New gates are added by *raising* the floor, never by widening an existing `canMoney` check.

---

## 4. Data Model

### 4.1 New entity — `Location` (a yard)
A new top-level registry. Two shape options (Open Q 11-A): a real persisted entity vs. a config-only list. Proposed shape if persisted:

```js
{
  locationId: 'L-SUL',          // stable id; home yard seeded as L-SUL
  name: 'Sulphur Yard',         // human label (replaces YARD_ORIGIN string)
  short: 'SUL',                 // the legacy store-code, reused as the badge
  address: 'JacRentals, Sulphur, LA, USA',  // transport origin for THIS yard
  lat: null, lng: null,         // optional, for the spread map (maps-location)
  isHome: true,                 // exactly one home yard; the single-yard default
  active: true,
  revenueGoal: null,            // null → inherits REVENUE_GOAL_DEFAULT (config.js:557)
  notes: '',
}
```

- **Where it lives:** a new `locations` array in `DATA`, added to `PERSIST_KEYS` (`app.js:15638`) + `PERSIST_ID` (`app.js:15687`, id field `locationId`) + `IDX_MAP` (`app.js:15711`). Schema-less Sheets → a new `locations` tab appears on first save, zero migration.
- **Backward-compat:** if `DATA.locations` is empty, the app **synthesizes one home yard** from `YARD_ORIGIN` at boot. Single-yard installs never see a Location anywhere.

### 4.2 New optional fields on existing entities (additive, schema-less)

| Entity | New field | Meaning | Default when absent |
|---|---|---|---|
| **Unit** | `locationId` | the yard this unit is stabled at / returns to | home yard (`isHome`) |
| **Unit** | `partnerId` *(or split)* | co-owner ref, or array of `{partnerId, pct}` splits | none (JacRentals owns 100%) |
| **Rental** | `originLocationId` | yard the iron left from (snapshot at dispatch) | unit's `locationId` |
| **Invoice** | `locationId` | yard credited for this revenue (derived from rental's units) | derived; not stored if unambiguous |
| **Expense** | `locationId` | yard a cost is booked against (optional) | home yard |

**Migration concern:** because every field is optional with a sane default, **no backfill is required**. A unit with no `locationId` *is* a home-yard unit by the resolver `unitLocationId(u)` (§7.1). Adding fields to the diff-sync (`computeChanges`, `app.js:15693`) is automatic — it diffs whole records by `JSON.stringify`, so new fields ride along with no code change.

### 4.3 New entity — `Partner` (co-owner) — Phase 3, gated on Open Q 11-C
```js
{
  partnerId: 'P-001',
  name: 'Joe Landry',           // display only — NO PII beyond a name
  defaultPct: 40,               // their default split if a unit just lists partnerId
  loginEnabled: false,          // does this partner get a scoped login? (Open Q 11-C/F)
  notes: '',
}
```
Relationship by id: `Unit.partnerId → Partner.partnerId`; the partner's cut is computed per §7.3 from that unit's rental revenue minus its allocated cost. **Persisted only if Phase 3 ships;** Phase 1/2 do not touch partners.

### 4.4 Relationships (by id)
```
Location(locationId) ─┬─< Unit(locationId)
                      ├─< Expense(locationId)
                      └─ origin string drives Rental.originLocationId snapshot

Partner(partnerId) ──< Unit(partnerId)   (Phase 3)
Unit ──< Rental(unitId) ──< Invoice(rentalIds)   (existing spine, unchanged)
```

---

## 5. Backend / Integration Contract

The backend is one additive entry point (`backendCall`, `app.js:15650`). **No existing action changes shape.** New behavior is purely the new `locations` tab riding the existing `load`/diff-sync, plus (Phase 3) one *new* scoped action.

### 5.1 Phase 1/2 — zero new backend *actions*, but a registry touch in 3 client maps
- `locations` joins **four client-side maps in lockstep** — this is the concrete edit list:
  - `PERSIST_KEYS` (`app.js:15638`) → add `'locations'` so it round-trips through `load`/flush.
  - `PERSIST_ID` (`app.js:15687`) → `locations:'locationId'` so the diff-sync keys records by id.
  - `IDX_MAP` (`app.js:15711`) → `locations:'location'` so the live multi-user refresh + `IDX.location` lookup work (the `yardAddress` resolver in §7.2 reads `IDX.location?.get(...)`).
  - `DATA.locations = []` initialized at boot, with the home-yard synthesis (§4.1) filling it when empty.
- With those four lines, `locations` syncs through the *existing* `load` (returns it in `r.data.locations`, applied by the `PERSIST_KEYS.forEach` in `loadFromBackend` `app.js:15672`) and the existing diff-based upsert/delete flush — **no new action, no new code path.**
- **The GAS `Code.gs` may still need a one-line additive tab registration** if the backend hardcodes its tab list (cannot read `Code.gs` — gitignored — flagged as Open Q 11-B). If the backend is fully generic over the keys the client sends, even that is free; if it allow-lists tabs, a `/clasp` **additive** deploy (a new `locations` tab/key, no existing action changed) gates Phase 1 sync. This is the one cross-system sequencing item — coordinate with `backend-data`.

### 5.2 Phase 3 — ONE new additive action (only if partner-login isolation ships)
Contract (proposed):

```
action: 'loadScoped'
payload: { action:'loadScoped', password:<partner-login-pw>, partnerId:'P-001' }
returns: { ok:true, data:{ units:[…only this partner's units…],
                           rentals:[…on those units…],
                           // NO customers, NO full invoices, NO other yards' iron
                           revenueByUnit:{ unitId: <gross> } },
          settings:{ /* minimal, partner-safe */ } }
```

- **Server-side enforcement is the whole point** — the scope MUST be applied in GAS, never trusted from the client, because the repo is public via Pages. The client **never sends `partnerId` as the authority**; the partner-scoped login *password* is the only credential, and GAS derives the `partnerId` from it server-side (the `partnerId` in the payload above is illustrative of the *response* shape, not a client-supplied filter the server trusts). A client that guesses another partner's id gets nothing extra — the server keys off the password→partnerId map alone.
- **Auth:** partner logins are a distinct password class (a named secret, **never** in the repo). The mapping password→partnerId lives in the GAS config Sheet, not the client. A partner password MUST NOT also satisfy the main `load`/`backendCall` shared-password gate — i.e. presenting a partner password to action `load` returns `{ok:false,error:'scope-required'}`, never the full DB. This split prevents a partner credential from ever pulling an unscoped snapshot.
- **What the response MUST strip server-side (default-deny):** no `customers` array, no `customer` identity fields denormed onto rentals, no `bottomDollar`/`trueCost`/cost-basis fields on units, no other partners' splits, no `invoices` beyond the partner's own revenue lines, no other yards' iron, no `settings` beyond a minimal partner-safe subset (company name/logo only — never role passwords, KPI DSL, or pricing config).
- **Failure handling:** reuses `backendCall`'s defensive `{ok:false,error}` contract (`app.js:15650`+; the parse-defensive block returns `{ok:false,error}` on any non-JSON GAS error/quota/auth HTML, `app.js:15663–15667`). A partner login that fails scope returns `{ok:false,error:'scope-denied'}`; the client shows an empty, locked state and **never falls back to the full `load`** (an explicit guard: a `loadScoped` failure must not trigger a retry against `load`). A transient `http-5xx`/`bad-json` shows "Couldn't reach the yard — retry," never an unscoped read.
- **No diff-sync from a partner login:** partner logins are **read-only**. The `computeChanges` upsert/delete flush (`app.js:15693`) is disabled for the scoped session — a co-owner can view their iron's performance but cannot write to the shared DB. (Open Q 11-C/F.)

### 5.3 External integrations
- **Google Maps (existing):** transport pricing must origin from the **rental's yard**, not the global `YARD_ORIGIN`. The Distance Matrix call (`app.js:1531`) changes `origins:[YARD_ORIGIN]` → `origins:[ yardAddress(r) ]`. Pure read; no new key, no new API. (See §7.2.)
- **No new external integration** is introduced by this area. Telematics (`gps-tracking`) and maps spine (`maps-location`) are *dependencies*, not parts of this spec.

---

## 6. UX / UI — yard data-plate language

Everything below is the **"yard data-plate"** system: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), corner **rivets**, **Saira Condensed** stamped uppercase labels (~2px tracking), the ONE safety-orange accent (`--accent #ff7a1a`) reserved for primary/ignition actions and brand chrome only (never as a status color — status stays in the R/Y/G flag system), the hi-vis **hazard stripe** for danger/abort, and the **subtle leather-tan ranch twist mostly in voice/copy** (a yard is a "corral"; moving a unit is "**re-stabling**" or "**trailering over**"; a partner deal is a "**brand split**" — the brand double-meaning earns its keep here). All new UI runs through the **`jactec-ui`** skill before showing Jac.

### 6.1 The Yard Badge (Phase 1) — the smallest possible footprint
A stamped, condensed **yard short-code chip** (e.g. `SUL`) on the unit card/row, styled as a riveted data-plate tag, **not** a status pill (status color is owned by the flag engine). Tan saddle-stitch hairline border to lean the ranch twist *visually but quietly*.

- **Single-yard installs:** the badge is **hidden entirely** — one yard means the dimension is noise. It only appears once `activeYards().length >= 2`. This is the core "looks exactly like today" promise (AC #1 regression guard).
- **R-rulebook stamp:** the badge is a new visible element → it needs a `data-r="Rxx"` stamp at the **next free rule id** (do not reuse an existing id; the `ci/gen-rule-usage.mjs` duplicate-rule guard fails on a clash). After stamping, regenerate `rule-usage.js` by running `ci/gen-rule-usage.mjs` **without** `--check`; the `--check` drift guard then passes in CI. The yard **filter** segment (§6.2), the **Spread Board** tiles (§6.3), the **Re-stable** action (§6.4), and the **Partner Cut** panel (§6.5) each likewise earn their own next-free `data-r` id. Add a short `RULE_META` row describing each so it renders in the admin Rulebook (`APP-12`).

### 6.2 The Yard Filter (Phase 1)
A segmented yard selector in the toolbar (same control family as `SHOP_SEGMENTS`, `config.js:366`), appearing **only when 2+ yards exist**. "All Yards" is the default; clicking a yard scopes every card (Units, Rentals, Shop, Invoices) to that yard; clicking the active segment clears back to All. Saved as a Saved View so a Beaumont manager can pin their yard (`config.js:400` view registry).

### 6.3 Spread Board (Phase 2) — a new popup
A new overlay (the **"Spread"** board) reachable from the header, showing per-yard tiles: each tile a steel data-plate with the yard's name (Saira stamp), unit count, on-rent count, utilization %, and **per-yard Revenue Goal progress** (a small ring reusing the KPI ring engine, `APP-21` `app.js:7167`). Optionally a mini-map of yard pins (gated on `maps-location`).

- **New popup → `WINDOW_CATALOG` entry required** (`APP-27` `app.js:9789`, const `app.js:9796`); `ci/check-window-catalog.mjs` fails CI if a popup is added without a catalog row. Add `{ kind:'spreadBoard', title:'Spread Board', … }` and wire it through `buildPopupEl`/`openOverlay` like every other overlay.
- **Money-rollup gating:** the per-yard Revenue Goal ring and on-rent revenue are **money figures** — visible only to `canMoney()` (rank ≥ 2). A staff-tier user opening the board sees the operational tiles (unit count, on-rent count, utilization) but the revenue ring renders as a locked/blank state, not a number. Cross-yard *money* rollup is Manager-tier+ (rank ≥ 3) so a single-yard Office user can't infer another yard's P&L.
- States: **empty** (one yard → board not offered at all), **loading** (skeleton steel plates), **error** (a yard with no address shows a hazard-stripe "no origin set" warning).

### 6.4 Move-a-unit flow (Phase 2)
On a unit detail, a **Manager-tier+** (rank ≥ 3) action **"Re-stable…"** (ranch-twist copy) opens a small yard picker (reuse the shared dropdown `openDropdown`, `APP-30` `app.js:11412`; mirror `openFleetDropdown` `app.js:11462` for the yard menu). Changing `locationId` logs an append-only History entry via `logAction` (the customer/record history helper, e.g. `app.js:401`) with actor/timestamp/from→to — satisfying the Owner audit-trail requirement (`role-roles.md` audit Q2). The handler re-checks `roleTier(currentRole) >= tierRank('manager')` at click time before mutating, and toasts "Re-stabling is Manager/Admin only." otherwise. Ignition-orange confirm button.

### 6.5 Partner Cut panel (Phase 3) — gated UI
On a co-owned unit, a Money-tier+ panel showing the brand-split %, the unit's gross this period, allocated cost, and the partner's cut. **Hidden below money tier.** If a Partner login exists, their dashboard is a *stripped* single-card view (their units only) — never the 6-card grid.

### 6.6 Mobile reflow
The app is desktop-first (min-width 1180px). The yard badge and filter must survive the phone reflow of the 3-column grid (per `jactec-ui` mobile sub-capability): badge collapses into the row's stamp cluster; the yard filter becomes a bottom-sheet selector. Spread Board tiles stack 1-wide on phones.

### 6.7 Quality floor (jactec-ui)
Responsive, visible focus rings, `prefers-reduced-motion` respected on the ring fills and board transitions, no acid-green/cream-serif AI-default slop. Boldness spent in **one** place: the Spread Board's per-yard data-plate tiles.

---

## 7. Business Rules / Derivations / Money

### 7.1 Yard resolution (the single most-used helper)
```js
// The home yard: the one isHome row, or a synthesized SUL plate from YARD_ORIGIN
// when DATA.locations is empty (single-yard install — §4.1 backward-compat).
function homeYard() {
  return DATA.locations.find((l) => l.isHome)
      || { locationId: 'L-SUL', name: 'Sulphur Yard', short: 'SUL',
           address: YARD_ORIGIN, isHome: true, active: true, revenueGoal: null };
}

// A unit's effective yard: explicit field, else the home yard. NEVER returns null.
function unitLocationId(u) {
  return (u && u.locationId) || homeYard().locationId;
}

// The yards that gate every piece of multi-yard UI. Returning < 2 means
// "single-yard mode" → badge/filter/Spread Board are all hidden (AC #1).
function activeYards() {
  return DATA.locations.filter((l) => l.active !== false);
}
```
Every yard-aware derivation funnels through `unitLocationId` so an un-tagged unit is *always* a home-yard unit — no record is ever "yard-orphaned." Every piece of multi-yard *UI* gates on `activeYards().length >= 2`, so a single-yard install renders byte-for-byte as today.

### 7.2 Transport pricing origin (the one money path that changes)
Today every quote prices from `YARD_ORIGIN` (`app.js:1531`). It becomes:
```js
function yardAddress(rental) {
  const u = IDX.unit.get(primaryUnitId(rental));
  const loc = u && IDX.location?.get(unitLocationId(u));
  return (loc && loc.address) || YARD_ORIGIN;   // fallback = today's behavior, exactly
}
// origins: [ yardAddress(r) ]   ← was [YARD_ORIGIN]
```
- **Edge case — multi-unit rental spanning two yards:** a rental whose units live at *different* yards has no single origin. Phase 1 rule: transport prices from the **primary unit's** yard; a hazard-stripe note flags "units span 2 yards — verify transport." (Open Q 11-H — is cross-yard transport even allowed, or must a rental be single-yard?)
- **Round-trip / recovery legs** still use the same yard as both origin and return; no change to `legsForType`.

### 7.3 Partner cut (Phase 3 money)
For a co-owned unit over a period:
```
unitGross    = Σ rental revenue lines (kind:'rental') for that unit in-period
unitCost     = Σ allocated WO/service/transport cost booked to that unit in-period
unitMargin   = unitGross − unitCost
partnerCut   = unitMargin × (split.pct / 100)        // margin-share model (DEFAULT, Open Q 11-E)
   — OR —
partnerCut   = unitGross  × (split.pct / 100)        // gross-share model (alternative)
```
**This is unsettled and money-sensitive** — margin-share exposes cost basis (gated), gross-share is simpler but ignores who pays for repairs. Surfaced as Open Q 11-E; **no formula ships without Jac picking the model.** Cut figures are Money-tier+ only.

### 7.4 Per-yard Revenue Goal
```
yardGoal(loc)     = loc.revenueGoal ?? REVENUE_GOAL_DEFAULT      // config.js:557
yardRevenue(loc)  = Σ invoice revenue where invoice's credited yard === loc.locationId
```
- **Credited yard** = the yard of the rental's primary unit at *dispatch time* (snapshot `originLocationId`), so re-stabling a unit later doesn't retroactively move historical revenue between yards.
- The **global** Revenue Goal stays the sum of yard revenues = total revenue (no double-count), so the existing top-bar KPI ring is unchanged in single-yard mode and equals the spread total in multi-yard mode.

### 7.5 Edge cases
- A unit `For Sale`/`Sold`/`Inactive` keeps its `locationId` for history but is excluded from a yard's *active* utilization.
- Deleting a yard with units attached is **blocked** — must re-stable or retire its units first (hazard-stripe confirm).
- The home yard cannot be deleted and cannot be set inactive (it's the default-resolution target).

---

## 8. Phasing & Milestones

### Phase 1 — Yard data spine + filter (MVP)
**In scope:** `Location` entity + home-yard synthesis; `locationId` on units (+ resolver); yard badge (hidden at 1 yard); yard filter segment; transport origin per-yard (`yardAddress`); Saved-View pinning; History logging on re-stable; `data.js` demo seed of 1 home yard only (so demo looks unchanged). **Out of scope:** partners, partner logins, scoped backend, Spread Board, cross-yard transport rules.

### Phase 2 — Spread Board + management
**In scope:** Spread Board popup (per-yard tiles + per-yard Revenue Goal ring); Re-stable flow; per-yard utilization; yard CRUD (Admin); cross-yard transport warning. **Out of scope:** partners, isolation.

### Phase 3 — Partners / co-ownership (gated on Open Qs)
**In scope:** `Partner` entity; `partnerId`/split on units; Partner Cut panel (Money-tier+); the partner-cut formula Jac picks; **and only if Jac approves server-side scoping** → the `loadScoped` action + isolated Partner login. **Out of scope of v1 entirely if Jac says client-only is acceptable — it isn't shippable, see §3.2.**

---

## 9. Acceptance Criteria

**Phase 1 (testable):**
1. With `DATA.locations` empty, the app renders **byte-for-byte equivalent** to today — no badge, no filter, transport prices from `YARD_ORIGIN`. (Regression guard.)
2. Adding a 2nd active yard makes the yard badge + filter appear; filtering Units/Rentals/Invoices to a yard shows only that yard's records.
3. A unit with no `locationId` resolves to the home yard everywhere (`unitLocationId`).
4. A rental whose unit lives at yard B prices transport from yard B's address.
5. Re-stabling a unit writes a History entry (`logAction`) with actor/timestamp/from→to and is logged **before** sync; a sub-Manager tier clicking the action is rejected with a toast (handler re-checks tier, not just hidden UI).
6. `locations` round-trips through `load` + diff-sync (upsert + delete) with no whole-state reseed; a `locations` upsert appears in the `computeChanges` output and a deleted yard appears in `deletes`.
7. On the Spread Board, a **staff-tier** session sees unit/on-rent/utilization counts but the per-yard Revenue Goal ring renders locked/blank (no money figure); a **money-tier** session sees its own yard's revenue; cross-yard money rollup requires Manager-tier+ (gate test).
8. Renaming/deactivating the currently-filtered yard on another device drops the local view to "All Yards" without an empty stranded card (multi-user refresh test).

**CI-gate impact:**
- `ci/gen-rule-usage.mjs --check` — must pass after the badge/filter get `data-r` stamps (regenerate first).
- `ci/check-window-catalog.mjs` — Phase 2 Spread Board popup MUST be added to `WINDOW_CATALOG` or CI fails.
- `node tools/gen-code-map.mjs --check` — if a new chapter banner is added (e.g. a "Locations" section), regenerate the Code Atlas.
- `ci/smoke.mjs` / `ci/logic-test.mjs` — add a `unitLocationId` resolver test + a transport-origin test; run on port 9147 per CLAUDE.md.
- **Cache-bust** the shared `?v=` token on deploy.

**Phase 3 (security-gated):**
9. A Partner login (if shipped) receives **only** its units from a *server-scoped* response — verified by inspecting the raw network payload and confirming it contains **no other yard's units, no `customers` array, no customer identity denormed on rentals, no `bottomDollar`/`trueCost`, and no other partner's split.** (If this can't be proven by reading the wire response server-side, Phase 3 does not ship — this is the §3.2/§10 critical gate.)
10. A partner password presented to the plain `load` action returns `scope-required`, never the full DB (credential-class split, Open Q 11-M).
11. A partner session cannot write: the diff-sync flush is disabled; an attempted mutation produces no `computeChanges` upsert (read-only test, Open Q 11-O).

---

## 10. Risks & Edge Cases

| Risk | Severity | Mitigation |
|---|---|---|
| **Partner "isolation" done client-side** leaks the full DB (incl. customer PII) to a co-owner's browser over public Pages | 🔴 Critical | Hard rule: no partner login without server-side `loadScoped`. Treated as the §3 gate decision, escalated to Jac, never delegated. |
| Single-yard regression — a yard badge/filter shows for the 1-yard case | 🟡 | Gate all yard UI on `activeYards().length >= 2`; AC #1 is the regression guard. |
| Cross-yard rental has ambiguous transport origin | 🟡 | Phase-1 rule = primary unit's yard + warning; Open Q 11-H decides if cross-yard is allowed at all. |
| Revenue double-count when summing yard goals vs. global | 🟡 | Credited-yard is a single snapshot; global = Σ yards by construction (§7.4). |
| Margin-share partner cut leaks cost basis to a sub-money role | 🔴 | Partner-cut figures Money-tier+ only; formula choice is an Open Q, ships nothing until picked. |
| Backend tab not auto-registered (can't read `Code.gs`) | 🟡 | Flag as Open Q 11-B; if GAS hardcodes tabs, a one-line additive registration is needed before Phase 1 sync works. |
| Deleting a yard orphans units | 🟢 | Block delete while units attached; home yard undeletable (§7.5). |
| Historical revenue moves when a unit re-stables | 🟡 | Snapshot `originLocationId` at dispatch; re-stable never rewrites history (§7.4). |
| Multi-user: two managers re-stable the same unit | 🟢 | Existing diff-sync last-writer-wins on the `locationId` field; both writes logged via `logAction`. The refresh loop adopts the remote `locationId` only for records the local user hasn't touched (`refreshFromBackend` clean-vs-`lastSaved` rule), so an in-progress edit isn't clobbered. |
| Remote yard rename/deactivate while a user is filtered to it | 🟡 | Filtered-yard removal drops the view to "All Yards" + toast rather than rendering an empty stranded card (Open Q 11-N). |
| Offline / sync blip during re-stable | 🟡 | `locationId` change is held in the debounced `saveSoon` queue like any field; on reconnect the diff flush sends it. History entry is written locally first so the audit trail survives a failed sync; never silently dropped. |
| Performance: per-yard derivations recomputed on every render | 🟢 | `unitLocationId`/`yardAddress` are O(1) `IDX` map lookups; the Spread Board aggregates once per open, not per row. Yard badge is a pure string read. Stays inside the 100ms render budget (`PERF_BUDGET_MS` `config.js:557` region). |
| Partner password reused as the shared `load` password | 🔴 | Distinct credential class; a partner password to plain `load` returns `scope-required`, never the full DB (Open Q 11-M, §5.2). Server-side enforced; never a client check. |
| Cost-basis leak via the per-yard Revenue Goal ring on the Spread Board | 🔴 | Revenue/utilization-revenue figures gated to `canMoney()`; cross-yard money rollup gated to Manager-tier+. Staff sees operational counts only (§6.3). |

---

## 11. Open Questions

*(No seed questions were captured for this area; all below are generated from the code + design tensions above.)*

| # | Question | Trade-off |
|---|---|---|
| **11-A** | Is `Location` a **persisted entity** (a `locations` Sheets tab) or a **config-only list** (lives in Settings/`config.js`)? | Persisted = editable in-app, syncs, scales to many yards, but adds a tab + needs the home-yard synthesis. Config-only = simpler, no backend touch, but yard edits need a config push and don't sync per-device. **Lean: persisted** (matches the schema-less ethos and the `store` fossil's intent). |
| **11-B** | Does the GAS backend auto-handle a new `locations` key, or does `Code.gs` hardcode its tab list (needs a one-line additive register)? | Can't read `Code.gs` (gitignored). If generic → free. If hardcoded → a `/clasp` additive deploy gates Phase 1 sync. |
| **11-C** | Do we ship a **scoped Partner login** at all, or is co-ownership only an *internal* bookkeeping view (Owner sees the split; the partner gets a PDF/email, not a login)? | A login is a big surface + the app's first isolation gate. An internal-only view is far safer and may be all Jac needs. **Lean: internal-only for v1; revisit login later.** |
| **11-D** | If a Partner login *does* ship, does the partner see the **renting customer's identity**, or only "Unit on rent, $X earned"? | Customer PII is JacRentals' relationship. **Lean: hide customer identity from partners.** |
| **11-E** | Partner cut = **margin-share** (gross − allocated cost) or **gross-share** (% of rental revenue)? | Margin-share is fair but exposes cost basis (gated) and needs robust cost allocation. Gross-share is simple but ignores who funds repairs. **No formula ships until Jac picks.** |
| **11-F** | If partner isolation is client-side only, is that acceptable to Jac given the public-Pages exposure? | **Strong recommendation: NO.** Client-only over public Pages = no real isolation. Documented as a blocker, not a choice to make lightly. |
| **11-G** | Should a **Manager role be scopeable to one yard** (a Beaumont manager who can't see Sulphur), or do all internal roles always see all yards (yard is just a filter)? | Per-yard manager scoping is real multi-tenancy and reuses the isolation machinery from 11-C. Filter-only is trivial. **Lean: filter-only for v1.** |
| **11-H** | Can a single rental span **two yards' units**, or must every rental be single-yard? | Cross-yard rentals complicate transport origin + revenue credit. Single-yard rentals keep the math clean. **Lean: discourage but don't hard-block; warn + price from primary unit.** |
| **11-I** | Does **transport between yards** (re-stabling iron on a flatbed) get priced/tracked as an internal transport cost, or is it off-book? | Could book a yard-to-yard `Expense` per move; or ignore it. Affects per-yard P&L accuracy. **Lean: optional Expense, off by default.** |
| **11-J** | What is the **home-yard's name/short-code** — keep "Sulphur" / `SUL` from the `store` fossil, or let Jac rename? | Reusing `SUL` honors the legacy badge; trivial either way. Cosmetic. |
| **11-K** | Does **per-yard Revenue Goal** roll *up* into the existing single top-bar ring (sum), or replace it with a yard-switchable ring? | Sum keeps the top bar stable; switchable is richer but changes a shipped KPI surface (Owner audit Q3 — "don't surprise a ring"). **Lean: sum at top, per-yard on the Spread Board.** |
| **11-L** | Should the **yard filter persist as a Saved View** (a manager pins their yard) or reset to "All Yards" each session? | Persisting matches the per-yard manager workflow; resetting avoids "why am I only seeing half the fleet" confusion for Owner. **Lean: persist as an opt-in Saved View, default All.** |
| **11-M** | If a Partner login ships, must its password be a **wholly separate credential class** from the shared `backendCall` password, such that a partner password presented to plain `load` is rejected? | A separate class prevents a partner credential from ever pulling an unscoped snapshot (the §5.2 split). But it adds a second password surface to manage server-side. **Strong lean: YES, separate class — anything less risks a full-DB read from a partner login.** |
| **11-N** | Does the **live multi-user refresh** (`refreshFromBackend`, polling `load`) adopt new `locations` rows like any other entity, and does adding/renaming a yard on one device propagate to others mid-session without disturbing an active yard filter? | `locations` rides the existing refresh via `IDX_MAP` so adoption is free; but a yard the user has *filtered to* getting renamed/deactivated remotely needs a graceful reflow (don't strand the user on a vanished yard → fall back to "All Yards"). **Lean: adopt rows normally; on filtered-yard removal, drop to All Yards + toast.** |
| **11-O** | Should a **partner login be read-only** (no diff-sync writes), as §5.2 proposes, or could a co-owner ever edit anything (e.g. a note on their own unit)? | Read-only is the conservative default and keeps the shared DB un-writable from the lowest-trust login. Any write surface from a scoped login multiplies the isolation risk. **Lean: read-only for v1, no exceptions.** |
| **11-P** | Is the **home-yard synthesis** (§4.1) computed purely at boot (ephemeral, never persisted), or is the synthesized `L-SUL` row **written back** to the `locations` tab on first multi-yard setup? | Ephemeral keeps single-yard installs with a literally-empty tab (truest "looks like today"). Persisting on first 2nd-yard add makes the home yard a real editable record. **Lean: ephemeral until a 2nd yard is added, then persist the home row so both are first-class.** |

---

## 12. Dependencies & Sequencing

**Must land first (or be co-designed):**
- `units-fleet` ✅ — the `Unit` entity that gains `locationId`/`partnerId` is owned here; coordinate the field additions.
- `rentals-dispatch` ✅ — transport-origin change (`app.js:1531`) and `originLocationId` snapshot live in the dispatch/quote flow.
- `financials-kpi` ✅ — per-yard Revenue Goal reuses the KPI ring engine (`APP-21`); the goal-split must not disturb the shipped global ring.
- `maps-location` ✅ — the Spread Board's optional yard-pin map mounts on the shared maps spine; yard `lat/lng` feed it.
- `backend-data` ✅ — the `locations` tab + any `loadScoped` action are additive on the single `backendCall`; sequence the GAS deploy (11-B).

**Soft / later:**
- `gps-tracking` 🟡 — once live telematics land, "which yard is this machine *actually* near" can auto-suggest re-stabling. Nice-to-have, not a Phase-1 dependency.
- `hr-compliance` ⬜ — if per-yard staffing/roles ever matter, the yard dimension is reused; out of scope here.

**Sequencing recommendation:** Phase 1 (spine + filter) is safe and high-value — build it first behind the `>= 2 yards` gate. Phase 2 (Spread Board) follows once a 2nd yard is real. **Phase 3 (partners) is blocked** on Jac resolving 11-C/11-E/11-F — do not start partner code until the isolation + money-model decisions are made on the main session (never delegated, per CLAUDE.md's auth/PII rule).
