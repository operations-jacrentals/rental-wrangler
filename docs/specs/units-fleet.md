# Units / Fleet — SPEC v1 (DRAFT)

**Date:** 2026-06-28 (updated 2026-07-08; status reconciled against shipped `main` 2026-07-09)
**Status:** DRAFT — for critique
**Area branch:** `area/units-fleet`
**Task branch:** `units-fleet/spec` (proposed)
**Maturity:** ✅ Shipped (documenting the live system as canon + the next-slice decisions)
**Scope:** Owns the Unit and Category records, their fleet/inspection/GPS/service statuses, availability-window logic, the Add Unit/Category quick-create, the fleet migration tool, and the unit & category detail cards (Specs, GPS, Investment, Inspection, Fleet Summary).

---

## Shipped status (2026-07-09)

A large slice (this area's D1–D3/D9 gates + the Sell-a-unit flow, among other work) was promoted
`staging` → `main` today. Verified against the live `app.js` on `main`:

| Item | Status | Note |
|---|---|---|
| **D1** — margin-floor (`bottomDollar`) + Category ROI% display gate to ≥money | ✅ **SHIPPED** | `canMoney()` gates the `bottomDollar` `kv` (`app.js:7438`), the Category ROI% (`app.js:7436`), and the unit-level Profit·ROI% (`app.js:7120`). Raw value still flows into `DATA`/sync/`categoryStats` math untouched — matches the spec exactly. |
| **D2** — lock cost-field edits (`trueCost`/`purchasePrice`/`purchaseDate`) to ≥money | ⚠️ **PARTIAL** | `purchasePrice` and `trueCost` ship with `efld(..., { money:true })` (`app.js:7110`, `7112`), enforced by the inline-edit handler (`app.js:15971`, "Cost fields are Office/Admin only."). **`purchaseDate` (`app.js:7111`) was left without `money:true`** — it's still editable by any signed-in operator, unlike the other two fields D2 named. Looks like an oversight, not a deliberate scope-cut. |
| **D3** — first-class "Sell a unit" flow | ✅ **SHIPPED**, with one gap | `sellUnit()` `app.js:16713`; popup `kind:'sellUnit'` `app.js:12153` (money-gated, defence-in-depth re-check); `WINDOW_CATALOG` entry `app.js:12343`; opener pill `js-open-sell` `app.js:7101`/`15921`; save handler `js-sell-save` `app.js:15795`. Captures sale price + date, flips `fleetStatus:'Sold'`, writes new unit fields `salePrice`/`saleDate`/`soldNote` (not yet listed in §4.1's field table), and logs `"Sold for $X on <date>"`. `categoryStats`'s residual math (§7.5) was refined beyond the spec's documented formula — see the §7.5 note below. **Gap:** the plain fleet-status dropdown (`openFleetDropdown`/`setUnitFleet`, `app.js:14159`–`14170`) still lets anyone flip `fleetStatus` straight to `Sold` with no price/date capture and no money gate — the "bare flip" path (§8 Phase 2) still coexists with the new Sell flow instead of being retired/redirected by it. |
| **D9** — gate all `$` amounts in History/audit log by role | ✅ **SHIPPED** | `histText()` `app.js:18768` masks `$12,500`→`$•••` when `!canMoney()`; wired into the single shared `historySection` renderer (`app.js:7676`) used by every card kind — one site, not the spec's "two render sites," because the customer `activityLog`/Action-Log renderer (`actionLogHtml` `app.js:3781`) turns out never to carry `$` text. |
| §2.1/§2.2/§7.1–7.4 (availability, rentable, investment math, service countdown, migration tool, category mix bars) | ✅ **SHIPPED, unchanged** | No drift found from what's documented. |
| §2.7 Models/service-schedule stack (D4–D8) | ✅ **SHIPPED** (not re-verified this pass) | Out of focus for this reconciliation pass — spot-checked as still present, not re-audited line-by-line. |

Everything below this point keeps the original prose; status callouts are added inline at the
specific claims the above table updates.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These supersede the matching Open Questions and amend §3 / §5 / §6 / §7 / §8.

- **D1 · Margin-floor display gate (resolves Q1 + Q10).** Gate **both** the `bottomDollar` `kv` **and** the back-derivable Category **ROI%** to **≥ money** tier (mirror `canMoney()` so the `#local` no-role demo is unaffected). Keep `msrp` / `askPrice` open (ask is customer-facing anyway). **Client-side display gate only** — the raw value still flows into `DATA` / sync and into `categoryStats` math untouched. The heavier **server-withheld secret is explicitly NOT taken** (no `backend-data` change); it covers the realistic screen-share/screenshot threat, not devtools-level access. **Security decision — stays on main, not delegated.** — ✅ **SHIPPED 2026-07-09** (see Shipped status table).
- **D2 · Lock the cost-field edits (resolves Q11).** `trueCost` / `purchasePrice` / `purchaseDate` become editable only at **≥ money** tier (they move ROI). Health / spec / hours / GPS `efld`s stay open to any signed-in operator (a Mechanic logging hours is the intended flow). — ⚠️ **PARTIAL as of 2026-07-09**: `trueCost`/`purchasePrice` shipped gated; `purchaseDate` shipped WITHOUT the gate (see Shipped status table).
- **D3 · First-class "Sell a unit" (resolves Q6).** A **Sell** flow captures **sale price + date**, closes out the unit's ROI cleanly, and writes a **revenue/accounting entry** — the integration seam with the **`accounting`** area. New UI → `/jactec-ui` + a `data-r` stamp; if it opens as a popup, a `WINDOW_CATALOG` entry + `check-window-catalog` re-run. — ✅ **SHIPPED 2026-07-09**, with the old bare fleet-status-dropdown flip to "Sold" still live alongside it (see Shipped status table).

**Kept at recommendation:** Q3 (`assignedMechanic` stays free-text until `hr-compliance` lands) · Q5 (clamp `currentHours` monotonic-up on sync to protect service countdowns — recommend adopt) · new quick-added unit stays **bookable before its first inspection** (shipped behavior; one-line `isUnitAvailableFor` change if it ever bites) · Q2/Q4/Q7/Q8/Q9 stand at their stated recommendations.

## ✅ Decisions — 2026-07-07/08 (Jac)

A large slice shipped onto this area branch — see the new **§2.7** for the canon. Key decisions, all popup-confirmed:

- **D4 · Models are a category-scoped sub-entity, not global.** A Category derives which Models a Unit may pick; each Model owns its real maintenance-schedule task list. A Model keyed off a real make/model is the join point for OEM service data. (`DATA.models`; §4.5.)
- **D5 · Retire the standalone Shop card.** Work Orders, Service Orders & Inspections render inside a **Unit's own detail**; the Units card carries the cross-fleet worklist; mechanics land on Units at clock-in. Every WO/inspection/service reference resolves to the **owning unit**. (§2.7.)
- **D6 · Snooze silences the alarm.** A snoozed service task is skipped by `topServiceForUnit` (row pills, Units alert, worklist, `__svcstat` filter, Service-Due sort all go quiet); the row itself stays honest; completion clears the snooze.
- **D7 · "Hold their hands" mechanic surface.** The service popup shows fluid capacity/type + parts, deep-links each task to its cited OEM manual page, and lets the mechanic edit parts (remove / type-new / **browse the parts catalog**) — reusing the Work-Order `partform` and the parts board rather than parallel UI. Part edits persist to the **real model task** (affect every unit of that model).
- **D8 · Sourced service data lives in PRODUCTION, not in these PRs.** 63 real models, 869 tasks, 34 Drive-hosted OEM manuals, and 233 fluid/part `detail` entries were loaded directly via the sync action (double-extracted + capacity-verified). The demo seed carries only a few illustrative examples. Manuals sourced from genuine OEM Operator's/Service manuals; blanks left honest where a manual doesn't specify.
- **D9 · Gate ALL dollar amounts in the History/audit log by role (extends D1/D2).** Non-money roles never see `$` amounts in any History/audit line — a **client-side DISPLAY redaction only** (`histText()` masks `$12,500`→`$•••` when `!canMoney()`; the raw action text still stores/syncs untouched), same philosophy as the D1 `bottomDollar` display gate. Applied at the two audit-line render sites (`historySection`, the customer `activityLog` renderer); team chat is out of scope (comms, not the audit log). Surfaced by the Sell-a-unit "Sold for $X" line (D3), but applies to every money log line (payments, refunds, WO costs, membership totals). Security/margin decision — stays on main. — ✅ **SHIPPED 2026-07-09**: `histText()` wired into the shared `historySection` renderer (`app.js:7676`, `app.js:18768`); the customer `activityLog` render site turned out to carry no `$` text, so one site covers it (see Shipped status table).

---

## 1. Goal & Problem

### What this area is for
Units / Fleet is the **equipment system of record**. Every excavator, skid steer, scissor lift and light tower in the yard is a **Unit**; every Unit belongs to a **Category** (the home of all pricing and the buy/sell investment view). This area answers four operating questions the business asks all day:

1. **What do we own, and what shape is it in?** — the Specs, hours, inspection state, GPS state, and open work for each machine.
2. **Can I rent it right now (or for *this* window)?** — `isUnitAvailableFor` / `categoryAvailableCount`, surfaced as the availability lens on the Units and Categories cards.
3. **Is it making money?** — per-unit Investment (Total Revenue, Monthly, Work Orders, Profit, ROI) and the Category-level ROI / per-unit revenue rollups.
4. **What needs my attention?** — the flag-driven color (failed inspection, service past-due, overbooked, GPS offline, wash requested) that decides the pill/border color.

### Business / user problem
JacRentals lives or dies on **fleet readiness and fleet economics**. A machine that's down, failed inspection, or overbooked is lost revenue; a machine bought above its earning power is a bad investment. Before this app, that lived in a spreadsheet + the owner's head. The app makes "rentable vs total," "service due," and "ROI per unit" first-class, derived-live numbers so Jac and the M.Tech can see the yard's health at a glance and act on it.

### Why it matters / north star
> **Every machine in the yard is one tap from its full story** — what it is, whether it can rent today, what it has earned vs cost, and the single most-urgent thing it needs — and the fleet's readiness and return are always derived live from facts, never hand-maintained.

Units / Fleet is **foundational**: Rentals reference a unit by ID, Invoicing bills per unit, Maintenance/Shop hangs WOs and service off a unit, Financials/KPI scores Ready Rate / Healthy Fleet off it, and the future GPS, Automated-Pricing, and Fleet-Spread areas all read this spine.

---

## 2. Current State (Baseline)

This area is **shipped**. The sections below document the live behavior **as canon**, with anchors (`file:line`, chapter IDs). Open forks are deferred to §11.

### 2.1 Shipped — Units

| Capability | Where | Notes |
|---|---|---|
| **Unit detail renderer** (Specs · GPS · Investment · Inspection · Notes · History · open-WO sections · yard-tool journey) | `STD.units` `app.js:5855` (`APP-16`) | The standard-view body. Fields edit inline via `efld`. |
| **Yard-tool journey strip** (per-unit On-Rent → FC → Return capture nodes) | `yardToolHtml` `app.js:5224` | Only renders when a unit has an active rental. Per-unit captures (`startCapture`/`fcCapture`/`endCapture`). |
| **Inspection segment control** (Pass / Not Ready / Fail) + Wash segcontrol (Wash / Don't Wash / Washed) | `app.js:5905`–5921 | Gated to a full checklist when `checklistRequired(u)` — opens the inspection flow (Maintenance/Shop) instead of a bare toggle. |
| **Fleet-status gate pill** + dropdown | `gatePill('unitFleetStatus', …)` `app.js:5898`; `openFleetDropdown`/`setUnitFleet` `app.js:11462`–11473 | 6 values (Purchased · Onboard · Active · Inactive · For Sale · Sold). `setUnitFleet` logs the change + re-indexes. |
| **GPS section** (status pill + type + placement, inline-edit) | `app.js:5873` | Metadata only — no live feed (that's `gps-tracking`). `gpsStatus` ∈ {Reporting, Verify, Not Reporting}. |
| **Investment block** (Total Revenue · Monthly · Work Orders · Profit · ROI%) | `app.js:5878`–5898 | All right-column values derived; left column is entry (purchasePrice, purchaseDate, trueCost, purchaseHours). |
| **Service countdown** (wash + the recurring service tasks) | `topServiceForUnit` `app.js:1761`, `unitServiceRows` `app.js:1751`, `service-countdown.js` | Wash is a 100-engine-hour recurring interval pinned to the top of the service list. |
| **Quick-add unit from search** | `quickAddUnitFromSearch` `app.js:13977`; handler `app.js:12601` | Typing a name + the +New affordance creates a `Not Ready`/`Active` unit and opens it. |
| **Unit list columns/rows** | `DEFAULT_LAYOUT.units` `app.js:5077` (`row1: name·category·hours`, `row2: inspection·rental·service`); `CARD_COLUMNS.units` `app.js:4987` | Card list (`APP-15`). |
| **Availability lens** | `isUnitAvailableFor` `app.js:1702`, `availUnavailable` `app.js:1729` | Red tint on rows that can't serve the active window. |

### 2.2 Shipped — Categories

| Capability | Where | Notes |
|---|---|---|
| **Category detail renderer** (mix bars · Pricing · Fleet Summary · Investment · unit roster) | `STD.categories` `app.js:6171` (`APP-16`) | |
| **Pricing block** (5 rates, **Admin-gated edit**) | `app.js:6188`–6191 | `memberDaily · rate1Day · rate7Day · rate4Wk · weekend`. Anyone reads; editing fires `requireAdmin`. |
| **Inspection mix bar + rental mix bar** (clickable → filters Units) | `categoryMix` `app.js:1797`, `categoryRentalMix` `app.js:1824`, render `app.js:6180`–6184 | Each segment is a filter chip into the Units card. |
| **Category Investment** (ROI% · /unit revenue · /unit expenses · MSRP · ask · bottom dollar) | `categoryStats` `app.js:1836`, render `app.js:6205`–6210 | **`bottomDollar` is the margin floor AND a live ROI input** — see §3.3 gate + §7.5. It is added into lifetime return as the assumed residual sale value (`app.js:1852`), so gating its display must not strip it from the math. |
| **Rentable / total health tally** | `categoryRentable` `app.js:1809`, `isUnitRentable` `app.js:1808` | "Rentable" = not Inactive/Sold/For-Sale AND inspection ≠ Failed. |
| **Availability count for a window** | `categoryAvailableCount` `app.js:1707` | |
| **Quick-add category from search** | `quickAddCategoryFromSearch` `app.js:13992` | Creates a $0-rate category and opens it. |
| **Category graph views** (Units per Category · Largest Categories) | `app.js:8536` (`APP-24`) | |

### 2.3 Shipped — the Fleet Migration tool ("Round up missing units")

A repair tool for imported rentals whose machine was only a free-text `legacyUnitName` (no real unit record).

- **Entry:** admin hash `#migrate-units` `app.js:16020` (guarded by `adminUnlocked()` `app.js:16022` — non-admins get the toast "Admin unlock required to round up missing units."); `openMigrationPreview` `app.js:16474`.
- **Plan (pure / no mutation):** `planUnitMigration` `app.js:16427` groups by cleaned name (`cleanUnitName` `app.js:16413` strips ❌, date ranges, "(combo)" notes, "BMT ONLY"…), picks the dominant category, and emits create-or-link rows.
- **Preview popup:** overlay kind `migrateUnits` `app.js:8967` — a table (Unit · Action · Category · Rentals) behind a Cancel / "Create & link N" confirm.
- **Apply:** `applyUnitMigration` `app.js:16452` creates the units, relinks each referencing rental (top-level `unitId`, any `units[]` entry, and billed invoice line `unitId`s), then `saveSoon()`. **Idempotent** — a second run finds nothing. The click handler is `js-migrate-go` `app.js:12755` (re-checks `o.kind === 'migrateUnits'` as defence-in-depth before mutating).
- **Registered overlay:** `WINDOW_CATALOG` entry `migrateUnits` `app.js:9798` (label "Round up missing units", tag "Units · migrate") — so `ci/check-window-catalog.mjs` already covers it; the render branch is `app.js:8967`.

### 2.4 Data shape (seed)

`data.js:24` (categories) and `data.js:34` (units). A live backend replaces this object (`PERSIST_KEYS` → one Sheets tab per entity); all derived values (price, ROI, status, countdowns) are computed in `app.js`, never stored (`data.js:9` "one fact, one place").

### 2.5 Open task branch (in flight)
The **Models + Services stack** (§2.7, PRs #504→#505→#506→#520→#521→#522→#527) is assembled on this area branch and is the primary open work, pending the area→staging push (owned by a separate session). Also noted: `units-fleet/category-rows-scroll-group` — a scroll-grouping treatment for the category unit-roster rows (roadmap; not yet merged). This spec should not pre-empt it but notes it in §8.

### 2.6 Explicitly NOT in this area today (and which area owns it)
- **Live GPS / telematics feed, geofencing, stray alerts** → `gps-tracking` (only metadata + the `gpsStatus` registry live here).
- **Work-order lifecycle & the inspection checklist ENGINE** → `maintenance-shop`. NOTE (2026-07-07, §2.7): the standalone **Shop card is retired** — Units now *hosts the render surface* for open-WO sections, the per-unit Services list, and the inspection segctl, and carries the cross-fleet worklist; the deeper WO/inspection state machine remains shared with Shop.
- **Rate automation / demand pricing** → `automated-pricing` (rates are static fields on the Category here).
- **Multi-location / co-owned fleet** → `fleet-spread` (single-yard by design today).

### 2.7 Shipped — Models entity, per-model service schedules & the mechanic service surface (2026-07-07/08)

A major slice landed on this area branch (PRs #504→#505→#506→#520→#521→#522→#527). Live behavior, as canon:

- **Models sub-entity** (`DATA.models`, id `modelId`; `IDX.model`; wired through `PERSIST_KEYS`/`PERSIST_ID`/`IDX_MAP`/`SINGULAR`/`WR_IDX`). A **Category derives which Models a Unit may pick**: the Unit's Model field is a category-scoped `<select>` (`editKind:'unitModel'` in `startInlineEdit`, mirroring `unitCategory`) with an inline "+ Add new model…" create. Shape: `{modelId, categoryId, name, tasks:[{taskId,name,intervalHours,parts,source,sourceUrl,detail}]}`. Managed from the **Category detail → Models section** (list + task-count badges + inline +Model), via the `modelSchedule` popup (view/manage tasks) and `svctaskform` popup (add/edit a task) — both in `WINDOW_CATALOG`. **Duplicate a model** (#520): a per-row Duplicate action clones a model + its task list under a new name.
- **Per-model real service schedules** replace the generic 250/500/1000hr placeholder — `unitServiceRows(u)` prefers `IDX.model.get(u.modelId).tasks`, falling back **honestly** (visibly generic) when no model/tasks are set.
- **Shop card RETIRED** (#505): Work Orders, Service Orders & Inspections render inside a **Unit's own detail** (Inspection → Services → WOs). The Units card carries the worklist (service-urgency sort + `__svcstat` filter + the stackbars graph via `graphViewsFor('units')`); mechanics land on Units at clock-in (`applyShopRoleLanding`). Any WO/inspection/service reference (KPI drills, invoice refs, search, Mr. Wrangler) resolves to the **owning unit** (`unitOfShopRec`).
- **Service snooze** (#506, backlog #43): per-task Snooze (7/14/30d)/Wake ghost button; **snooze silences the alarm** (`svcSnoozedUntil`/`snoozeService`, `u.serviceSnoozes`; `topServiceForUnit` skips snoozed tasks); row stays honest ("Snoozed thru X · was Y overdue"); completion clears the snooze. Services list capped at 6 with a "Show all" expander.
- **Mechanic service surface** (#521/#522/#527 — "hold their hands"): the service-completion popup shows a **"What you need"** block (fluid **capacity** + type, notes, parts/filters), a **manual deep-link** per task (`sourceLinkBtn`, R26 → `#page=N` into the OEM manual). Parts are editable — remove/edit reuse the WO `partform`, add via **`+Part`** (type-new) or **"Browse catalog"** (`js-svc-browseparts` → the parts board in `pickTarget` mode → `attachCatalogPart`, deduped by OEM/name) — and each opens a **side-by-side part-detail panel** (vendor/phone/cost, `cardSub` two-popup precedent). All part edits persist to the **real model task** (`svcRealTask` + `reindex('models',…)`), so they affect every unit of that model.
- **Production data (NOT in these PRs — see D8):** 63 real models, 869 sourced tasks, 34 Drive-hosted OEM manuals, and 233 fluid/part `detail` entries loaded directly via the sync action. The demo seed carries only a few illustrative examples.

---

## 3. Users, Roles & Data Gates

Permissions key off **TIERS**, not role names (`ROLE_TIERS` `config.js:326`; `tierRank` `config.js:334`). Ladder: `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`.

### 3.1 Who touches Units / Fleet (of the 5 built-in roles `config.js:302`)

| Role | Default tier | Relationship to this area |
|---|---|---|
| **Mechanic** | staff | Reads unit health; sets inspection/wash; opens WOs from the unit; **Healthy Fleet** KPI. |
| **M.Tech** | staff/manager | Drives Ready Rate / readiness; assigned-mechanic field; inspection cascade. |
| **Driver** | staff | Reads unit + yard-tool journey for dispatch; wash completion. |
| **Office** | money | Sees Investment $ + Category margins; legitimately reads pricing-floor numbers (the intended audience of `bottomDollar`). |
| **Sales** | money | Reads category specs/rates to quote; interested-category linkage (CRM). **Must not undercut `bottomDollar`** — but at *money* tier they may legitimately see it; the leak risk is staff-tier exposure, not Sales. |
| **Admin/Owner** | admin | Edits pricing, runs migration, edits categories. |

> **No-role / `#local` demo caveat:** `canMoney()` returns `true` when `!currentRole` (`app.js:14166`), so the `#local` demo and any unauthenticated boot path see money-gated values. That is by design for local dev but means a gate added for Q1 should be written as *"hide when a role is set AND its tier < money"*, mirroring `canMoney`, so the demo is unaffected while real staff sessions are protected.

### 3.2 Gates that already apply (KEEP — do not loosen)

| Gate | Rule today | Where | Tier |
|---|---|---|---|
| **Category pricing edit** | Reading the 5 rates is open; editing any rate (or the category itself) fires `requireAdmin("Categories and pricing are Admin-only.")` (Admin/Owner pass; others get the backend-verified password popup) | `priceFld(... { admin:true })` `app.js:6188`; click guard `app.js:12831` (`dataset.admin === '1' && !adminUnlocked()`) | admin |
| **Fleet migration** | Admin-only, preview-first, confirm-gated, idempotent | `#migrate-units` `app.js:16020` → `adminUnlocked()` `app.js:16022` | admin |
| **Reseed** | Admin-only, password + confirm, refuses to shrink a populated DB | `reseedFromFile` `app.js:16482` | admin |
| **Sale-economics row (MSRP / ask / `bottomDollar`)** | ~~No gate today~~ — ✅ **SHIPPED 2026-07-09**: `bottomDollar` now gated to ≥money (`app.js:7438`); `msrp`/`askPrice` stay open per the Q1 recommendation. See §3.3 and the Shipped status table. | `app.js:7438` | money |

### 3.3 Pricing-floor / margin visibility — the sensitive one

> ✅ **SHIPPED 2026-07-09 — this section now describes history, not the live gate.** As of today, `bottomDollar` and the Category/unit ROI% ARE gated to ≥money (D1, `app.js:7438`/`7436`/`7120`). The narrative below (written pre-ship, describing the "no gate" state) is left intact as the record of the reasoning; don't read "Today:" below as current. Line numbers below (`app.js:6210`) have also since shifted with unrelated code growth — the live render site is `app.js:7438`.

The Category Investment block surfaces **`bottomDollar` (the lowest sale price), `askPrice`, and `msrp`** (`app.js:6210`, `kv(money(c.bottomDollar), { sfx: 'bottom dollar' })`). `bottomDollar` is a true **margin floor** — the number a salesperson must never undercut and a customer must never see.

- **Today [as of the pre-ship draft — see the ✅ SHIPPED callout above]:** these render in the Category detail with **no tier gate** — they show to any signed-in operator (`app.js:6210`). The five *rental rates* above them are read-open / **admin-gated to edit** (§3.2), but the *sale economics* row (MSRP / ask / bottom dollar) has no gate at all, read or write — it is an inline `efld`-free `kv` display, so it is visible to a staff-tier Mechanic, Driver, or M.Tech who opens any Category.
- **`bottomDollar` is also a live ROI input, not just a label.** `categoryStats` adds it into lifetime return as the assumed residual sale value: `lifetimeRoi = trueCost ? ((totalRev + bottomDollar * unitCount) − denom) / denom : null` (`app.js:1852`). The displayed **ROI%** therefore *encodes* the floor — even if the raw number is hidden, a savvy viewer could back it out from ROI + revenue + cost. A complete gate must consider both surfaces.
- **The Wrangler-AI read gate already treats this number as sensitive** — `app.js:10319` lists "bottomDollar margin floor" among the values the agent is restricted around. The UI gate is the inconsistency: the agent guards it, the Category card does not.
- **This is a fork, not a settled decision.** See §11 **Q1**. The conservative read of the house rule ("pricing-floor visibility … surface the gate decision as an Open Question rather than silently loosening it") is to **gate the `bottomDollar` display (and likely the back-derivable ROI%) to ≥ money tier**, keep `askPrice`/`msrp` open, and keep the raw value flowing into the math server-side/in-memory regardless of who can *see* it — but that is Jac's call. **This spec does not change the gate; it surfaces it and flags that gating the display alone is insufficient if ROI% leaks it back.**

> Gate-tier reference (`config.js:326` `ROLE_TIERS`, `config.js:334` `tierRank`; resolved per-user by `roleTier` `app.js:13055`): `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`. The money gate helper is `canMoney()` `app.js:14166` (`roleTier ≥ tierRank('money')`, with a `!currentRole` pass-through for the `#local` no-role demo); the admin gate is `adminUnlocked()` `app.js:13071` (`≥ admin`).

### 3.4 Customer isolation / PII
Units and Categories hold **no customer PII** directly. The only customer linkage is **derived**: the yard-tool journey (`app.js:5227`) and the unit History resolve the *active rental's* customer name by ID at render time. No customer fields are stored on a unit. → No new isolation surface introduced by this area; any customer-name display inherits the Rentals/CRM isolation rules.

---

## 4. Data Model

### 4.1 Unit (`DATA.units`, `data.js:34`; id field `unitId`)

| Field | Type | Source | Notes |
|---|---|---|---|
| `unitId` | string `U###` | entry | `nextUnitId()` `app.js:13973`; migration uses `U`+padded seq. |
| `name` | string | entry | The machine's yard nickname ("Worm", "Shrek"). |
| `categoryId` | ref → category | entry | Home of pricing; quick-add leaves it blank to be set on open. |
| `assignedMechanic` | string | entry | Free-text name today (not an HR-linked employee — that's `hr-compliance`). |
| `currentHours` | number | entry | Engine hours; drives every service countdown. |
| `purchaseHours` | number | entry | Baseline for service intervals (`baselineField`). |
| `serviceCompletions` | map `{taskId: hours}` | entry | Last-done hours per recurring task; feeds `service-countdown.js`. |
| `inspectionStatus` | enum `Ready` / `Not Ready` / `Failed` | set via inspection | Label "Passed" for Ready (`config.js:72`); `Failed` blocks availability. |
| `fleetStatus` | enum (6) | gate pill | Purchased · Onboard · Active · Inactive · For Sale · Sold (`config.js:77`). |
| `serial` `year` `make` `model` `weight` | string/number | entry | Specs block. |
| `gpsType` `gpsPlacement` | string | entry | e.g. "GPSWOX" / "Under dash". |
| `gpsStatus` | enum (3) | entry today | Reporting · Verify · Not Reporting (`config.js:145`). Becomes feed-driven in `gps-tracking`. |
| `purchasePrice` `trueCost` `purchaseDate` | number/date | entry | Investment cost basis. `trueCost` preferred over `purchasePrice`. Edit-gated ≥money for `purchasePrice`/`trueCost` only (D2) — ⚠️ `purchaseDate` shipped ungated, see Shipped status table. |
| `salePrice` `saleDate` `soldNote` | number/date/string | Sell popup (D3) | ✅ **NEW 2026-07-09, not previously in this table.** Written by `sellUnit()` `app.js:16713` when a unit is sold; `salePrice` replaces the assumed `bottomDollar` residual for that unit in `categoryStats` (§7.5). Money-gated at entry (Sell popup requires `canMoney()`). |
| `washChoice` `washRequested` | string/bool | wash segctl | Drives the wash flag + the "Wash Requested" blue pill. |
| `serviceLog` | array | service action | Wash/service completion log; counts washes for History chips. |
| `condAt` `condClock` | date/string | inspection | Inspection timestamp shown in the section header. |
| `notes` / `actions` | string / log | inline | `notesSection` + `logAction` audit trail. |
| `mock` | bool | seed | `true` on every seed record (hygiene, easy removal). |

### 4.2 Category (`DATA.categories`, `data.js:24`; id field `categoryId`)

| Field | Type | Notes |
|---|---|---|
| `categoryId` | string `CAT###` | `nextCategoryId()` `app.js:13988`. |
| `name` | string | "12k Excavator". |
| `memberDaily` `rate1Day` `rate7Day` `rate4Wk` `weekend` | number | The 5 rates — **all pricing lives here** (units inherit). Admin-gated edit. |
| `msrp` `askPrice` `bottomDollar` | number | Investment / sale economics. **`bottomDollar` = margin floor.** |
| `fuelType` | string | Diesel / Electric. |
| `description` | string | Spec blurb. |

### 4.3 Relationships (by ID)
```
Category (1) ──< Unit (many)              unit.categoryId → category.categoryId
Category (1) ──< Model (many)             model.categoryId → category.categoryId
Model (1) ──< Unit (many)                 unit.modelId → model.modelId   (a unit's Model is category-scoped)
Model (1) ──< ServiceTask (embedded)      model.tasks[] — the per-model maintenance schedule
Unit (1) ──< Rental (many)                rental.unitId / rental.units[].unitId → unit.unitId
Unit (1) ──< WorkOrder (many)             wo.unitId → unit.unitId
Unit (1) ──< Inspection (many)            insp.unitId → unit.unitId
Unit (1) ──< ServiceOrder (derived)       serviceOrdersForUnit(unit) — not stored
Unit revenue/ROI ── derived from its Rentals (unitTotalRevenue app.js:1783)
Unit repair $    ── derived from its WOs   (unitRepairCost app.js:1768)
```

### 4.5 Model (`DATA.models`, id field `modelId`) — added 2026-07-07 (§2.7, D4)
Category-scoped join point for real OEM service data. `IDX.model`; persisted like any entity (`PERSIST_KEYS`/`PERSIST_ID.models = 'modelId'`/`IDX_MAP.models = 'model'`). The GAS backend required `models` in its `ENTITIES`/`ID_FIELD` arrays (deployed) — without it `doSync` silently drops the entity.
```
Model {
  modelId, categoryId, name,               // e.g. "Yanmar VIO55" under category "12k Excavator"
  manualUrl?, manualTitle?,                 // the Drive-hosted OEM manual (per-model)
  tasks: [ {
    taskId, name, intervalHours, parts[],   // the maintenance-schedule row
    source?, sourceUrl?,                     // human citation + deep-link (#page=N) to the manual page
    detail?: { fluidType?, fluidCapacity?,   // "what you need" — the mechanic hand-holding data
               partRefs?: [{ name, oem?, cost?, vendorId?, url?, photo? }], sourcePage?, notes? }
  } ]
}
```
Mechanic part edits (§2.7, D7) mutate the **live** `model.tasks[].detail.partRefs` (via `svcRealTask` + `reindex('models',…)`), so they persist for **every unit of that model** — an intentional "fix the reference once" behavior, not a per-unit override.

### 4.4 Schema-less / additive notes & migration concerns
- Backend is **schema-less Sheets** — a new field is **additive**: add it to the seed shape, write/read it where rendered, and the diff-sync (`computeChanges`) carries it. No migration step for a pure add.
- **A new *required* field needs a default** for every legacy row (e.g. `quickAddUnitFromSearch` `app.js:13977` seeds the full create shape — match that pattern):
```js
// quick-add unit seed (app.js:13980)
{ unitId, name, categoryId:'', assignedMechanic:'', currentHours:0,
  inspectionStatus:'Not Ready', fleetStatus:'Active', purchaseHours:0, serviceCompletions:{} }
// quick-add category seed (app.js:13995)
{ categoryId, name, memberDaily:0, rate1Day:0, rate7Day:0, rate4Wk:0, weekend:0,
  msrp:0, askPrice:0, bottomDollar:0, fuelType:'', description:'' }
```
- **Subtle:** a quick-added unit seeds `fleetStatus:'Active'` but `inspectionStatus:'Not Ready'` — so it is **rentable** (`isUnitRentable` only excludes Failed) but **available** for a window (`isUnitAvailableFor` requires `Active` + not-Failed; Not Ready passes). A brand-new, never-inspected unit can therefore be booked the moment it's created. Whether that's desired or should default to a gate is an edge worth Jac's eye (noted in §10).
- **Category-id renumbering is forbidden** in practice — rentals/units/invoices reference it by string; treat `categoryId`/`unitId` as immutable once created.
- The migration tool (§2.3) is the canonical pattern for any future "backfill missing unit" repair: **pure plan → preview popup → confirm → apply → saveSoon**, idempotent.

---

## 5. Backend / Integration Contract

### 5.1 Existing (sufficient for everything in §2)
Units / Fleet has **no dedicated backend action** — it rides the generic sync.

| Action | Role here |
|---|---|
| `load` | Hydrates `units` + `categories` tabs on sign-in. |
| `sync` | Diff upserts/deletes for unit/category edits, quick-adds, migration writes (`saveSoon` → debounced `sync`). |
| `seed` | Admin `#reseed` only. |
| `setConfig`/`getConfig` | Carries any admin Settings that touch this area (e.g. a future flag/pricing-gate toggle). |

`backendCall` (`app.js:15650`, chapter `APP-38` banner `app.js:15637`) is the single entry; every call carries `backendPassword` and the server replies `{ ok, … }`. Unit/category writes never call it directly — they mutate `DATA`, then `saveSoon()` (`app.js:15851`, 1200ms debounce) batches a `sync` whose diff (`computeChanges`) carries the changed `units`/`categories` rows. **Implication for any Q1 gate:** hiding `bottomDollar` in the *UI* does nothing to the *sync payload* — the raw number is always written to and read from the Sheet for every operator's client. A true server-side floor secret would require the value to live behind a tier-checked action, which the schema-less single-tab model does **not** support today (every client loads the whole `categories` tab via `load`). So the realistic gate is **display-only** (hide the number + the back-derivable ROI for staff tier); a genuine server-withheld floor is a larger `backend-data` change and a separate fork (Q10).

### 5.2 Proposed-additive (only if the §11 forks land)
All **additive** on the single entry point — no breaking change.

| Proposed action | Trigger | Payload (shape only) | Failure handling |
|---|---|---|---|
| *(none required for v1 of this spec)* | — | — | — |
| `unitTelemetry` (→ `gps-tracking`) | live GPS pull | `{ unitId, lat, lng, ts, gpsStatus }` | **Owned by `gps-tracking`, not here.** Listed only to mark the seam: `gpsStatus` would become server-set. |
| `setPricingGate` (only if Q1's gate is made *admin-configurable* rather than hardcoded) | admin toggles which tier sees the margin floor | `{ floorMinTier: 'money' }` carried inside the existing `setConfig` `config.settings` blob — **no new action** | Falls back to the hardcoded `'money'` default if unread/offline. |
| `getSensitiveCategoryFields` (only if Q10 → true server-withheld floor) | sub-money client load that must NOT receive `bottomDollar` | server omits `bottomDollar` from the `load` `categories` rows below `money` tier; returns a server-computed `roi` instead so the card still renders | **Structural `backend-data` change**, breaks client-side ROI for gated clients — out of scope for v1; listed to mark the seam. |

> **Recommended v1 path (no backend change):** implement the Q1 gate as a pure client-side display gate — wrap the `bottomDollar` `kv` and the ROI% render in a `canMoney()`-style check (hide when a role is set and its tier < money). The value stays in `DATA`/sync and in `categoryStats` math untouched. This needs **zero** new GAS action; `setConfig`/`getConfig` only come into play if Jac wants the gate *tier* to be admin-tunable rather than a constant.

> External integrations (Stripe, Maps, telematics NVR) **do not** belong to this area. Telematics is the one future seam, and it is owned by `gps-tracking`.

---

## 6. UX / UI

All UI is in the **yard data-plate** language (dark steel panels, ONE safety-orange `#ff7a1a` accent reserved for chrome/ignition only, hi-vis hazard stripe for danger, Saira Condensed stamped section labels, corner rivets, subtle leather-tan ranch seasoning in copy). **Any new/changed UI runs through `/jactec-ui`, gets a `data-r` stamp, and — if a new popup — a `WINDOW_CATALOG` entry.** This area touches no money-popup, so the Stripe-gate UI is out of scope.

### 6.1 Unit detail card (live — canon)
Order (top → bottom), `STD.units` `app.js:5855` (the assembled body is near `app.js:5933`):
1. **Yard-tool journey** (only with an active rental).
2. **Title** (unit name, stamped).
3. **Inspection** section — color-coded `sec-green/yellow/red` by condition, with the Pass / Not Ready / Fail segctl + Wash segctl, timestamp in the header.
4. **Open WO sections** + "+Work Order" add-row.
5. **Specs** + **GPS** columns (`detail-cols`).
6. **Investment** split (entry left, derived right) with the **fleet-status gate pill** bottom-right.
7. **Notes** + **History** (Inspections / WOs / Rentals / Washes chips).

### 6.2 Category detail card (live — canon)
`STD.categories` `app.js:6171` (assembled body near `app.js:6216`): mix bars (inspection + rental, clickable filters) → Pricing (admin-gated) → Fleet Summary → Investment (ROI / per-unit / **MSRP·ask·bottom-dollar**, the `kv` row at `app.js:6210` that Q1 gates) + unit roster → Notes → History.

### 6.3 States
- **Empty:** quick-add ("Set its category, hours, and inspection" toast `app.js:13985`; "Set its day/week/month rates" for category `app.js:14000`). Category with no units → "No units" in the roster (`app.js:6213`).
- **Loading:** inherits the global boot/sync screen (no area-specific loader).
- **Error:** unknown status → `getStatus` returns the safe `—`/gray placeholder (`config.js:199`), never a crash; dangling `categoryId` renders "Unknown category" (`app.js:5865`).

### 6.4 Mobile reflow
The unit/category detail flows inside the standard-view bottom-sheet (`mobile-remote` M-rules). `detail-cols` collapse 2→1; segctls keep the touch-target floor. No area-specific mobile work proposed for v1 beyond honoring the shipped M0–M3 reflow.

### 6.5 Existing popups (`WINDOW_CATALOG`, `APP-27`)
- **Round up missing units** (`migrateUnits`) — already catalogued; Cancel `R18` + ignition confirm `R17` (`app.js:8979`). **No new popup proposed in v1** → `check-window-catalog.mjs` unaffected.

### 6.6 R-rulebook stamps already present
Inspection/wash segctls, the fleet gate pill (`gatePill`), the open-checklist ignition button (`R17` `app.js:5910`), the migration popup buttons (`R17`/`R18`). Any new element added under §11 forks gets a fresh `data-r` and a `rule-usage.js` regen.

---

## 7. Business Rules / Derivations / Money

All values below are **derived live** — none are stored.

### 7.1 Availability (the gate every card/quote leans on)
```
isUnitAvailableFor(u, start, end, selfId):           // app.js:1702
  fleetStatus !== 'Active'        → NOT available
  inspectionStatus === 'Failed'   → NOT available
  any overlapping rental (excl. selfId) → NOT available
  else                            → available
categoryAvailableCount(catId, start, end, selfId)    // count of available units in the category
```
The active window comes from `activeDraftWindow()` (`app.js:1714`): the open rental's window (or its staged inline-calendar edit), else an "available" search token, else none.

### 7.2 Rentable vs Available (two different ideas — keep distinct)
- **Available** = free for a *specific window* (above).
- **Rentable** (`isUnitRentable` `app.js:1808`) = a fleet-health notion: NOT in {Inactive, Sold, For Sale} **and** inspection ≠ Failed. Drives the Category "rentable / total" tally and the Ready-Rate KPI. **Sold units leave inventory entirely** (`categoryRentable` excludes `Sold` from the denominator, `app.js:1810`).

### 7.3 Service countdown
`unitServiceRows(u)` (`app.js:1751`) runs `service-countdown.js` over `UNIT_SVC_TASKS` (Wash @ 100h pinned first + `SERVICE_TASKS`), keyed on `currentHours` vs `purchaseHours` baseline and `serviceCompletions`. Status ∈ {ok, due-soon, past-due} → colors green/yellow/red. `topServiceForUnit` floats a pending wash request to the top.

### 7.4 Unit Investment math (`app.js:5878`)
```
invested  = trueCost || purchasePrice || 0
totalRev  = Σ unitRentalPrice(r, unitId) over the unit's rentals   // app.js:1783
repair    = Σ WO line-item costs                                   // app.js:1768
profit    = totalRev − repair − invested
roi       = invested ? round(profit / invested * 100) : null
avgRevMo  = monthsOwned ? round(totalRev / monthsOwned) : 0        // months from purchaseDate
```

### 7.5 Category Investment / ROI (`categoryStats` `app.js:1836`)

> ⚠️ **Formula below is now stale post-D3 (2026-07-09) — one term changed.** The shipped
> `residual` sums **per-unit**: a `Sold` unit with a recorded `salePrice` contributes its
> *realized* `salePrice` instead of the assumed `bottomDollar`; every still-unsold unit keeps
> the old assumed-residual behavior (`app.js:2093`–`2096`). Net effect on the formula below:
> `bottomDollar * unitCount` → `Σ (u.fleetStatus==='Sold' && u.salePrice ? u.salePrice : bottomDollar)`.
> This is the D3-documented "surgical, only this one term changed" swap — the rest of §7.5 is
> unchanged and shipped as written.

```
trueCost   = Σ (u.trueCost || u.purchasePrice || 0)          // acquisition basis, category-wide
totalRev   = Σ unitTotalRevenue(u.unitId)
totalRepair= Σ unitRepairCost(u.unitId)
denom      = trueCost + totalRepair
lifetimeRoi= trueCost ? ((totalRev + bottomDollar * unitCount) − denom) / denom : null   // app.js:1852 — SEE NOTE ABOVE, residual term is now per-unit post-D3
roi        = lifetimeRoi != null ? round(lifetimeRoi * (365 / avgDaysOwned) * 100) : null  // annualized
```
- **ROI is gated on a real `trueCost`** (not repair alone) — without an acquisition basis it reads `—`, never a fake 900,000% (the comment at `app.js:1849` is explicit about this).
- **`bottomDollar` is baked in** as the assumed per-unit residual sale value `× unitCount`, so the displayed ROI% is a function of the margin floor — the §3.3 / Q1 leak surface. ROI is **annualized**: × (365 ÷ avg days owned); units missing `purchaseDate` default to ~1 year (annualize factor ≈ 1).
- Per-unit revenue (`avgRevUnit`) / expense (`avgExpUnit`) are category sums ÷ unit count (`app.js:1856`).

### 7.6 Money / margin numbers
- **No money *moves* in this area** (no Stripe charge/refund) — so the `canMoney()` payment gate (`app.js:14166`) does not currently fire on any control here. (Q1 would be the *first* place `canMoney()` gates a *visibility*, not a payment, in this area.)
- The **margin floor** (`bottomDollar`), ask, and MSRP render via plain `kv` displays (no `efld`, so not even admin-gated to *edit* — they are edited elsewhere/by seed), but they are **pricing-sensitive** and `bottomDollar` is also a **live ROI input** (§7.5) — not "read-only display" as one might assume. See §3.3 / §11 **Q1**.
- **Rates are read-here, used-elsewhere**: `rentalPrice()` (Rentals/Dispatch, `app.js:836`) reads the category's 5 rates to pick the cheapest blend, and `catRatesUnset()` (`app.js:873`) guards a category whose rates are still `0`; this area only *stores and edits* them (admin-gated via `priceFld`).

### 7.7 Flag-driven color (Units) — what decides the pill/border
`getEntityColor` → highest active flag (`FLAG_META.units` `config.js:235`, `FLAG_COND.units` `app.js:3952`):

| Flag | Sev | Condition |
|---|---|---|
| `inspection-failed` | 🔴 | `inspectionStatus === 'Failed'` |
| `service-past-due` | 🔴 | top service order `past-due` |
| `overbooked` | 🔴 | unit has an overlapping active rental |
| `gps-offline` | 🔴 | `gpsStatus === 'Not Reporting'` |
| `inspection-not-ready` | 🟡 | `inspectionStatus === 'Not Ready'` |
| `service-due-soon` | 🟡 | top service order `due-soon` |
| `wash-requested` | 🟡 | `washRequested` |
| `gps-verify` | 🟡 | `gpsStatus === 'Verify'` |

No flags → green; per the flag-color spec, fleet statuses no longer carry static colors — the pill keeps the **fleet-status label** but takes the computed color. **Categories have no flag set today** (color is structural). Whether a Category should compute a roll-up color from its worst unit is a fork — §11 Q4.

---

## 8. Phasing & Milestones

Because the area is shipped, "phases" here mean **the next slice of decisions/work**, not a green-field build.

### Phase 1 — Lock the spec + resolve gates (this document)
- Resolve §11 forks (esp. the **margin-floor visibility gate** Q1 — highest priority because it's a potential pricing leak).
- Land the in-flight `units-fleet/category-rows-scroll-group` treatment (already on its branch).
- **In scope:** documenting canon; the margin-floor gate decision; the category-roster scroll group.
- **Out of scope for v1:** any live GPS, demand pricing, multi-location, or an HR-linked mechanic.

### Phase 2 — Readiness & economics polish (post-approval, optional)
- Category roll-up flag color (Q4), if Jac wants the Categories card to glow on its worst unit.
- A "fleet readiness" mini-view / KPI surfacing rentable-vs-total per category more prominently.
- Optional: a **unit-retire / sell** affordance that formalizes Sold (today Sold is just a fleet-status value). — ✅ **SHIPPED 2026-07-09 as D3** ("Sell a unit"), though the plain fleet-status-dropdown flip to Sold was NOT retired/redirected — both paths coexist today (see Shipped status table).

### Phase 3 — Seams handed to neighbor areas (NOT built here)
- `gps-tracking` flips `gpsStatus` from manual entry to feed-driven (this area only consumes it).
- `automated-pricing` proposes rate changes against the category rates (this area still owns the edit UI + the admin gate).
- `hr-compliance` replaces free-text `assignedMechanic` with an employee ref.

---

## 9. Acceptance Criteria

Concrete + testable. CI-gate impact called out.

1. **Availability is correct.** A unit that is `fleetStatus!=='Active'` OR `inspectionStatus==='Failed'` OR has an overlapping rental returns `false` from `isUnitAvailableFor`. `categoryAvailableCount` matches the count of `true`s. → covered by `ci/logic-test.mjs` (the money/multi-unit logic harness); any change to §7.1 must keep it green.
2. **Sold leaves inventory.** A `Sold` unit is excluded from `categoryRentable` denominator and never counts as rentable. → `logic-test`.
3. **Investment math.** `profit = totalRev − repair − invested`; `roi` null when `invested===0`. ROI never NaN. → `logic-test`.
4. **Quick-add.** Creating a unit/category from search yields a record with the documented defaults, opens it, and persists via `sync`. → `smoke` boots; manual local check on `:9147`.
5. **Migration is safe & idempotent.** `planUnitMigration` mutates nothing; `applyUnitMigration` relinks rentals + invoice line `unitId`s; a second run finds zero. → manual + (proposed) a `logic-test` case.
6. **Pricing edit is admin-gated.** A non-admin editing a category rate fires `requireAdmin` (`app.js:12831` / `6188`); reading is open. → manual check on `:9147` as Mechanic then Admin; do not regress. CI: a regression here would not be auto-caught (no role-fixture in `logic-test` today) — **flag as a coverage gap (Q7-adjacent)**.
7. **Margin-floor gate (if Q1 resolved to "gate").** A staff-tier session opening any Category detail sees **neither** the `bottomDollar` `kv` **nor** a usable ROI% (it is back-derivable), while a money-tier+ session sees both; the `#local` no-role demo is unaffected (gate mirrors `canMoney()`'s `!currentRole` pass-through). The raw `bottomDollar` value still flows into `DATA`/sync and into `categoryStats` math unchanged. → new behavior; add a `logic-test` assertion that `categoryStats(cat).roi` is unchanged by the gate (math vs display are independent) **and** a manual two-role visual check. CI: new gated render gets a fresh `data-r` if it adds/wraps an element → `gen-rule-usage.mjs --check` must be regenerated. — ✅ **SHIPPED 2026-07-09** — behavior matches this AC as written (`app.js:7436`/`7438`/`7120`). `ci/logic-test.mjs` has real coverage: the D3 sold-unit residual swap (`ci/logic-test.mjs:1650`–`1673`, asserting `categoryStats(cat).roi` moves correctly when a unit sells) and the D9 `histText` money-gate (`ci/logic-test.mjs:1676`–`1687`, both staff- and money-tier roles). No standalone "ROI unchanged by the *display* gate" case, but since the gate is display-only and never touches `categoryStats`'s inputs, that's adequately covered by the existing math tests.
8. **Flag color.** A Failed-inspection or past-due-service unit renders red; due-soon/not-ready/wash/verify render yellow; clean units green. → covered by the flag engine; visual check.
9. **Rulebook / window catalog stay green.** Any new `data-r` element regenerates `rule-usage.js` (`gen-rule-usage.mjs --check`); no new popup means `check-window-catalog.mjs` unaffected. Any banner move regenerates the code map (`gen-code-map.mjs --check`).

---

## 10. Risks & Edge Cases

| Risk / edge | Detail | Mitigation |
|---|---|---|
| **Margin-floor leak (UI)** | `bottomDollar` shows to any operator today (§3.3), and the Category ROI% encodes it (`app.js:1852`) — so even hiding the number leaks it via ROI. A staff/sales screen-share or screenshot exposes the floor. | Resolve **Q1**; conservative default = gate **both** the number and ROI% display to ≥ money tier (mirror `canMoney()`). Security decision — stays on main, not delegated. |
| **Margin-floor leak (data)** | The whole `categories` tab (incl. `bottomDollar`) loads to every client's `DATA` via `load`; a UI gate doesn't remove it from the browser (§5). | Accept for the realistic threat (screen-share/screenshot) via the display gate; escalate to a server-withheld field (**Q10**) only if devtools-level access is in scope — a `backend-data` change, not this area's. |
| **New unit instantly bookable** | A quick-added unit seeds `fleetStatus:'Active'` + `inspectionStatus:'Not Ready'`, so it is available for a window before it has ever been inspected (§4.4). | Live availability is correct per the shipped rule; if Jac wants a "must pass first inspection" gate, that's a one-line change to `isUnitAvailableFor` and a new fork. Surface, don't silently change. |
| **Failed-inspection still rentable via direct edit** | Availability blocks Failed, but a user could flip fleetStatus/inspection mid-window. | Availability is recomputed live every render — a flipped unit immediately drops out; overbooked/failed flags fire red. |
| **Unit deleted while referenced** | A rental/invoice references a now-missing `unitId`. | `recOf`/`idOf` are null-safe (`app.js:736`) → renders "Unknown", never crashes. Avoid hard-deleting units that have rentals; prefer Inactive/Sold. |
| **Migration mis-grouping** | `cleanUnitName` could merge two different machines with similar free-text names. | Preview-first popup; admin confirms each plan; idempotent re-run. |
| **Category renumber / id reuse** | Breaks every reference. | Treat ids as immutable; `nextCategoryId`/`nextUnitId` never reuse. |
| **Multi-user race on a unit edit** | Two devices edit the same unit between sync polls. | Diff-sync is last-writer-wins per field via `computeChanges`; acceptable for fleet metadata. Note for Q5. |
| **`trueCost` 0 / missing purchaseDate** | ROI/Monthly fall back (null ROI, ~1yr annualize). | Documented; no crash. Could mislead — surface "estimated" if Jac wants. |
| **Offline** | No service worker (`frontend-performance`); offline edits sit in localStorage until reconnect. | Out of this area's scope; inherits the global persistence behavior. |

---

## 11. Open Questions

> **Resolved 2026-06-29:** Q1 → D1 (gate number + ROI to ≥money, display-only) · Q10 → D1 (display gate, not server-withheld) · Q11 → D2 (lock cost-field edits to ≥money) · Q6 → D3 (first-class Sell action). Q3/Q5 kept at recommendation; Q2/Q4/Q7/Q8/Q9 stand. See the Decisions block up top.
>
> **Shipped 2026-07-09:** Q1/D1 ✅ shipped in full. Q10/D1 ✅ shipped (display gate; server-withheld secret NOT built, as recommended). Q6/D3 ✅ shipped, with the old bare-flip path still live (gap, see Shipped status table). Q11/D2 ⚠️ shipped for `trueCost`/`purchasePrice` only — `purchaseDate` was left ungated. Q2/Q3/Q4/Q5/Q7/Q8/Q9 remain open — no evidence any of them shipped in this pass.

> Seed list was empty — all questions below are generated from the code. Ordered by blast radius; **Q1 (margin-floor display gate) is the security decision and should be answered first.** Q1 + Q10 + Q11 are the pricing/data-sensitivity cluster and stay on the main session (not delegated); the rest are product forks.

| # | Question | Trade-offs |
|---|---|---|
| **Q1** ✅ SHIPPED 2026-07-09 | **Should the `bottomDollar` margin floor be tier-gated in the UI?** Today it renders to every operator (incl. staff-tier Mechanic/Driver/M.Tech) in the Category Investment block with no gate (`app.js:6210`), and it is *baked into the displayed ROI%* (`app.js:1852`), so hiding the raw number alone still leaks it via ROI. | **Gate display to ≥money** (mirror `canMoney()` so the `#local` no-role demo is unaffected): protects the floor from staff/sales screen-share/screenshots (matches the house pricing-floor rule and the existing Wrangler-AI guard at `app.js:10319`). Must hide **both** the `bottomDollar` `kv` *and* the back-derivable ROI% for staff tier, else the gate is cosmetic. Cost: M.Tech/Mechanic lose numbers they currently see + a `logic`/manual test. **Leave open:** zero work, real pricing-leak surface. *Recommend: gate `bottomDollar` + the Category ROI% display to ≥money; keep `msrp`/`askPrice` open (ask is the customer-facing number anyway). Keep the raw value flowing into the math untouched.* **Security decision — stays on the main session, not delegated.** |
| **Q2** | **Should `inspectionStatus` and `fleetStatus` enter the flag-color system fully, or keep any structural color?** The flag spec says fleet statuses retire static colors, but Categories have no flag set. | Full flag-only = one consistent "what needs doing" signal. Risk: Sold/Inactive units default green, which could read as "fine" when they're really out-of-service — may want a distinct gray. (Flag spec §6.3 already addresses units; confirm it's fully wired.) |
| **Q3** | **Should `assignedMechanic` become an employee reference now, or stay free-text until `hr-compliance` lands?** | Ref = clean dispatch/credential linkage later. Free-text = zero dependency, ships today. *Lean: stay free-text; revisit when HR exists.* |
| **Q4** | **Should the Categories card compute a roll-up flag color from its worst unit?** Categories are colorless today. | Roll-up = the Categories list glows red when any unit is down (great triage). Cost: a `categories` flag set + condition that scans units; perf on large fleets. |
| **Q5** | **Conflict policy for concurrent unit edits.** Diff-sync is last-writer-wins per field. Is that acceptable for fleet metadata, or do hours/inspection need a guard? | LWW is simple and fine for names/notes. Engine hours going *backward* (a stale write) could corrupt service countdowns — maybe clamp `currentHours` to monotonic-up on sync. |
| **Q6** ✅ SHIPPED 2026-07-09 | **Should "Sell a unit" be a first-class action** (set Sold + capture sale price/date, maybe an expense/revenue entry), or stays a bare fleet-status flip? | First-class = clean ROI close-out + accounting hook (ties to `accounting`). Bare flip = today's behavior, no new UI. |
| **Q7** | **Does the migration tool need a `logic-test` case** so the relink/idempotency contract can't silently regress? | Adds coverage to a rarely-run admin tool. Low cost; recommended. |
| **Q8** | **Should `gpsStatus` be editable by hand at all once `gps-tracking` is live**, or become read-only/feed-owned? | Decision belongs to the GPS area but affects this card's GPS section edit affordance. Note the seam now. |
| **Q9** | **Category `description` / spec sheet** — keep as one free-text blurb, or grow structured spec fields (lumens, lift height, flow)? | Structured = better search/quoting; more schema. Free-text = flexible, ships. |
| **Q10** ✅ SHIPPED 2026-07-09 (as display gate, not server-withheld) | **Does the margin floor need a *true* server-withheld secret, or is a display gate (Q1) enough?** The schema-less single-tab model loads the whole `categories` tab to every client via `load` (§5), so `bottomDollar` is always in the browser's `DATA` regardless of UI gating — a determined staff user could read it from devtools. | **Display gate only (Q1):** cheap, covers the realistic screen-share/screenshot threat, no `backend-data` change. **Server-withheld:** a tier-checked `getSensitiveCategoryFields` action that omits `bottomDollar` from the `load` payload for sub-money clients — a real secret, but a structural `backend-data` change (and breaks client-side ROI for those clients, who'd then need a server-computed ROI). *Lean: display gate now (Q1); only escalate to server-withheld if the threat model demands it. Owned jointly with `backend-data`.* |
| **Q11** ⚠️ PARTIALLY SHIPPED 2026-07-09 | **Should the unit `efld` inline edits (hours, specs, GPS) carry any tier gate, or stay open to all signed-in operators?** Today only *category pricing* and *category-link* edits are admin-gated; everything else on a unit (currentHours, serial, GPS, purchase cost) edits open. | **Open:** matches today; a Mechanic logging hours/condition is the intended flow. **Gate purchase-cost fields (`trueCost`/`purchasePrice`/`purchaseDate`) to ≥money:** those are investment/economics inputs a staff user arguably shouldn't rewrite (they move ROI). Cost: more conditional `efld`s; friction for whoever onboards a new unit. *Lean: keep health/spec fields open; consider gating the three cost fields to ≥money alongside Q1.* **Shipped result: `trueCost`/`purchasePrice` gated (`app.js:7110`/`7112`); `purchaseDate` (`app.js:7111`) shipped without the gate — likely an oversight, worth a quick follow-up fix.** |

---

## 12. Dependencies & Sequencing

Per the roadmap (`docs/specs/AREAS-ROADMAP.md` §2), Units / Fleet **depends on** and is **depended on by** many areas. It is priority #2 / tier Need — foundational.

### 12.1 What this area provides to others (downstream consumers)
- `rentals-dispatch` — units referenced by ID; availability lens; the per-unit yard-tool journey lives in the unit card.
- `invoicing-payments` — per-unit billing line `unitId`.
- `maintenance-shop` — WOs/inspections/service hang off `unitId`; this card renders open-WO sections + the inspection segctl.
- `financials-kpi` — Ready Rate / Healthy Fleet / Parts Breakeven read fleet/inspection state and unit economics.
- `automated-pricing` — reads the category rates this area owns. **Note (2026-07-09):** a "sale-price engine" also shipped (`salePricingCfg`/`salePriceSuggest`/`salePricingAutoApply`, `app.js:1824`–`1862`, tagged in-code as spec `automated-pricing` D1/D3, not this spec) that *writes* `bottomDollar`/`askPrice` — fields this spec's §4.2 lists as owned here. Manager+-gated (approve or full-auto mode); out of scope for this reconciliation pass, flagged only because it touches fields §3.3/§7.5 describe as this area's.
- `gps-tracking` — consumes `gpsType/Placement/Status` and the `gps-offline`/`gps-verify` flags.
- `fleet-spread` — would extend the single-yard unit spine across locations.

### 12.2 What must land / be decided first
1. **Q1 (margin-floor display gate)** — resolve before any wider pricing-visibility work; it's a security decision, kept on the main session, and gates both the `bottomDollar` number and the ROI% that encodes it. Recommended v1 path is a pure client-side display gate (no `backend-data` change); **Q10** (server-withheld floor) is the heavier alternative and is jointly owned with `backend-data`. — ✅ **SHIPPED 2026-07-09**, recommended path taken (display gate, no `backend-data` change).
2. **Q11** (gating the three unit cost fields `trueCost`/`purchasePrice`/`purchaseDate`) — decide alongside Q1 since they also feed ROI and are the same staff-visibility concern. — ⚠️ **SHIPPED 2026-07-09 for 2 of 3 fields**; `purchaseDate` still open, see Shipped status table.
3. **`maintenance-shop`** inspection-checklist contract — the unit card *invokes* `checklistRequired`/the inspection flow; keep the contract stable.
4. **`backend-data`** sync — already shipped; **no new action needed for v1** (Q1's display gate is client-only; only Q10 or an admin-tunable gate tier would touch `setConfig`).
5. **`gps-tracking`** — only when live telematics is built does `gpsStatus` change ownership; until then this area's manual GPS edit stands.

### 12.3 Sequencing note
Nothing blocks documenting this area as canon now. The only **build** item with a real dependency is Q1's gate (self-contained, ship-anytime) and the in-flight `category-rows-scroll-group` (already branched). Live-GPS, demand-pricing, sell-a-unit, and HR-linked mechanic are all **downstream** and should be specced in their own areas, with this spec as the upstream truth.

---

*End of DRAFT — for Jac's critique. Every numbered decision in §11 is a real fork found in the code; none were silently resolved.*
