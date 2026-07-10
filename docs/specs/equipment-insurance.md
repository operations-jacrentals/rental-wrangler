# Equipment Insurance — SPEC v1 (DRAFT)

**Date:** 2026-06-29
**Status:** DRAFT — for critique
**Area branch:** `area/equipment-insurance`
**Task branch:** `equipment-insurance/spec` (proposed)
**Maturity:** greenfield
**Scope:** An owner-side, **per-unit** insurance/coverage configuration surface — the rental-company owner selects which units carry insurance and which **coverage/service types** each unit gets — plus the billing/entitlement that follows (premiums, covered-unit lookup, damage-claim routing), kept clearly distinct from the customer-facing membership **Rental Protection** add-on it must reconcile with.

## ✅ Decisions — 2026-06-29 critique (Jac)

- **D1 — The yard's coverage-type catalog is exactly THREE: `Theft`, `Flood`, `In-Tow Damage (asset only)`.** Replace the proposed six. These three are the yard's *equipment* (asset) policy coverage types. **Owner-editable** in Settings so Jac can tune the list live (per his "the owner selects which types" intent). Drop Physical-Damage/Liability/Roadside/Loss-of-Use as standalone catalog entries — note "In-Tow Damage (asset only)" is the on-the-road transport-damage case, asset-only (no third-party liability in the yard policy). `INSURANCE_COVERAGE_TYPES` ships these three as defaults; the Settings editor is in v1, not deferred.
- **D2 — Rental Protection ≠ a yard coverage type; it covers ANYTHING up to $2,000 for the unit on the rental.** Critical reconciliation correction: **RPP (membership Rental Protection) protects literally anything** up to the $2,000 cap for the rented unit — it is broad, customer-side, and is **NOT** one of the three narrow yard catalog types. Keep the §1.4 delineation but restate RPP's scope as "anything, up to $2,000/unit-on-rental," not a peril-specific cap.
- **D3 — Claim waterfall: RPP pays FIRST (OQ#3 order changed).** New payer order: **(1) Membership Rental Protection** (anything, up to the $2,000 cap) → **(2) customer liability insurance** (now confirmable via COI, D4) → **(3) yard equipment policy** (only for Theft/Flood/In-Tow per the unit's selected types) → **(4) customer out-of-pocket deductible** (→ Collections if uncollectable). RPP-first is Jac's explicit call; tiers 2–4 follow in that order (flag tier 2/3 ordering for a quick confirm if it ever matters in practice). The no-double-coverage / sums-to-`estimatedLoss` invariant (§7.5) holds; the yard policy (tier 3) still only pays when the unit carries the matching one of the three types.
- **D4 — Build COI (certificate-of-insurance) tracking NOW (OQ#3 gap = build).** Do not ship a perpetually-"unconfirmed" tier 1/2. Add customer **COI tracking** in this area: is the renter's certificate on file, current, and naming JacRentals as additional insured? This makes the customer-liability tier **confirmable** at claim time. It joins the `hr-compliance` document-vault seam but is **built here** as part of v1 scope (pulls the COI fields/vault forward from Phase 3 into the core build). COI data is PII-adjacent (insurer name + policy number + agent contact) — gated ≥money, never on a public/print surface, never in the Wrangler-AI read context.
- **D5 — Premium AND insured-value are BOTH admin/owner-only (OQ#6/#13).** Tighten from the draft: both the per-unit premium and the insured value are **owner-only to read and edit** — omitted from the sub-admin DOM (not CSS-hidden), never on print/customer/AI surfaces, never reaching a money-tier browser. **Coverage STATUS** (insured y/n + the three rider badges) stays **open to all signed-in staff** (a driver needs to know a unit is uninsured before it leaves). Phase-1 gate is display-only (the whole `units` tab still syncs); a true server-withheld premium remains OQ#6-(b), out of v1.
- **D6 — Adopt the conservative drafts for the rest:** per-unit config in Phase 1, category `insuranceDefault` roll-down in Phase 2 if the grind is real (OQ#4); nested `unit.insurance{}` shape (OQ#5); ship both coverage flags — `uninsured-active` 🟡 (on-rent + uncovered) and `coverage-expired` 🔴 (OQ#7); premiums book as `Insurance` **expenses**, manual receipt in Phase 1 / auto-expense Phase 3 (OQ#2); inline `efld` editing in Phase 1, overlay only if the type multiselect needs room (OQ#11); keep the in-app name **"Equipment Insurance" / "Coverage"**, never reuse "Protection" for it (OQ#12); extend the **existing** `invoicing-payments` print/PDF CI string-scan to also reject `premium`/`insuredValue`/insurer tokens (OQ#8). **Carrier API stays OUT of v1** (OQ#10). Claims internal-only until `customer-portal` external-auth exists (OQ#9b); money-mutating claim actions still **blocked on `backend-data` Q13** server role-trust (OQ#9a).

---

## 1. Goal & Problem

### 1.1 What this area is for

Equipment Insurance is a **service JacRentals provides** and an **owner-configured property/coverage layer over the fleet**. The rental-company **owner** (admin/owner tier) decides, **per unit** (or per category, rolling down to units), two things:

1. **Is this unit insured at all?** (a covered/not-covered flag on the unit).
2. **Which coverage/service types apply to it?** (a selected subset of an owner-curated **coverage-type catalog** — e.g. *Physical Damage*, *Theft*, *Liability*, *Roadside/Recovery*, *Loss-of-Use*, *Flood* — each unit picks the types it gets).

On top of that selection sits the money and entitlement layer: a **premium** the yard pays (or recovers) to insure a unit, a **covered-unit lookup** any other area can ask ("is `U042` insured, and for what?"), and a **damage-claim** path that decides — for a given damaged unit — **who pays**: the yard's equipment-insurance policy, the customer's required liability insurance (per the rental agreement), the customer's membership **Rental Protection** damage cap, or the customer out-of-pocket.

### 1.2 The business problem

A heavy-equipment yard's single largest asset class is the iron in the lot. A machine that's stolen, flooded, or destroyed on a job is a five- or six-figure hit. Today the app has **three unrelated, partial answers** to "who covers the damage," and **none of them is the yard's own property coverage**:

- The **rental agreement** (`agreements.js:55` / `agreements.js:121`) requires the **customer** to carry $500k auto + $500k/$1M general liability + property coverage for the rented equipment's replacement value. This is the customer's **liability** insurance — an obligation in the contract, but **nothing in the app tracks whether the COI is on file or current** (that gap is partly `hr-compliance`'s document-vault aspiration, `hr-compliance.md:328`).
- **Membership Rental Protection** (`customer.rentalProtection`, `app.js:3186–3196`) is a **customer-facing damage-cap add-on** — a surcharge of `protectionPct` (default 15%) of the rental's **equipment subtotal** that buys the renter a **$2,000/mo damage cap** (`memProtectionCap`, surfaced informationally; claim accounting is the deferred `memberships/protection-claims` branch, `memberships.md:88`). It is **the customer's** protection against owing for damage, not the yard's coverage of the asset.
- The **yard's own equipment insurance** — the actual property policy that pays to repair/replace JacRentals' machine when the customer's coverage and the protection cap don't fully cover it — **does not exist in the app at all.**

The result: nobody can answer "which units do we insure, for what, at what premium, and when a `U042` claim lands, which of these four payers covers which dollar." This area builds the **owner's coverage-configuration surface** and the **claim-routing logic** that ties the three existing concepts together with the missing fourth (the yard policy).

### 1.3 North star

> Every unit in the yard has a **clear, owner-set coverage profile** (insured y/n + which coverage types), every other area can ask "is this unit covered, for what" in one call, and when a machine is damaged the app shows **exactly who pays which dollar** — yard policy, customer liability, membership Rental Protection, or customer out-of-pocket — with no double-coverage and no silent gap. The owner sees the yard's total insured value and premium spend at a glance; staff below the owner tier see coverage status without ever seeing premium cost.

### 1.4 The reconciliation that defines this area (read first)

This area exists **alongside** the shipped membership Rental Protection, not on top of it. They are different things on different sides of the transaction. Getting this delineation right is the **load-bearing design decision** (it recurs in §3, §4, §7, and the top Open Questions):

| | **Membership Rental Protection** (shipped, `memberships`) | **Equipment Insurance** (this area, new) |
|---|---|---|
| **Whose** | The **customer's** | The **rental company's (yard's)** |
| **Side of the deal** | Customer-facing add-on / surcharge | Owner-side asset coverage |
| **What it protects** | The **customer** from owing for damage (a $2,000/mo damage *cap*) | The **yard's machine** (property: repair/replace cost) |
| **Configured by** | Sales/Office at enroll (`addOns.protection`) or the account toggle (F4) | The **owner** (admin tier), per unit/category |
| **Lives on** | `customer.rentalProtection` (a bool on the **customer**) | A new `unit.insurance{}` (and/or category default) on the **unit** |
| **Money** | A **surcharge billed to the customer** (15% of equipment subtotal, `rentalProtectionAmount`, `app.js:3191`) | A **premium the yard pays/recovers** to its insurer (an expense, not a customer line) |
| **On a claim** | Draws down the customer's $2,000/mo cap (deferred accounting) | The yard files against its **property policy** for the asset loss above what the customer covers |
| **Tier to see/set** | money-tier (Sales/Office) for the add-on; the surcharge is customer-visible | admin/owner to configure; **premium cost is owner-only** (margin-floor-adjacent) |

**They interact on exactly one event: a damage claim** (§7.5 the waterfall). They are otherwise independent: a unit can be yard-insured while the renter has no Rental Protection, and a renter can carry Rental Protection on a unit the yard chose not to insure. **This spec does NOT modify membership Rental Protection** — `customer.rentalProtection`, `rentalProtectionAmount`, and the `mem*` config stay exactly as `memberships.md` documents them. It only **reads** them at claim time.

---

## 2. Current State (Baseline)

This area is **greenfield** — there is **no equipment-insurance code today**. No `unit.insurance` field, no coverage-type catalog, no premium ledger, no claim record, no UI, no backend action. The sections below honestly inventory the **adjacent** code this area builds *on* (and must not duplicate or break).

### 2.1 What exists adjacent (build ON, do not reinvent)

| Adjacent thing | Where | Relationship to this area |
|---|---|---|
| **Membership Rental Protection** (customer-facing damage cap) | `rentalProtectionAmount`/`rentalProtectionRate` `app.js:3190–3196`; `customer.rentalProtection` bool; `memProtectionPct`/`memProtectionCap` config (`memberships.md` §2.3, §7.4) | The concept this area must **reconcile with and stay distinct from** (§1.4). Read at claim time (§7.5). **Not modified.** |
| **The customer-liability clause** | `agreements.js:55`, `agreements.js:121` (the signed Rental/Membership agreement §… "Insurance must be primary and non-contributory") | The **customer's** insurance obligation. Today there is **no tracking** of whether the customer's COI is on file/current — a gap this area's claim waterfall exposes (OQ #3). |
| **Unit / Category records** | Units seed `data.js:34`, Categories `data.js:24`; unit detail `STD.units` `app.js:5855`; category detail `STD.categories` `app.js:6171` | The new coverage config is **additive fields on the unit** (and a category default), rendered in a new section of these existing cards (`units-fleet.md` §4). |
| **Fleet status / inspection / GPS sections** | `app.js:5873`–`5921`; `unitFleetStatus` `config.js:77` | The coverage section sits beside these in the unit detail; "Sold"/"Inactive" units should drop out of insured-value rollups (parallel to `isUnitRentable`, `units-fleet.md` §7.2). |
| **Expense / receipt ledger** | `DATA.expenses` `data.js:184`; `expenseCategory` `config.js:155`; `vendorTotals` `app.js:11138` (`accounting.md` §2.1) | A **premium** is a recurring **expense** — it should book through the existing expense ledger (a new `Insurance` category or a vendor = the insurer), not invent a parallel money store (§5, §7.3). |
| **Invoice / claim money path** | `invoiceTotals` `app.js:1602`; charge/refund/manual money path (`invoicing-payments.md` §5) | A claim *recovery* or a customer **deductible** charge rides the existing invoice/payment rails — no new money primitive (§5, §7.5). |
| **The Investment / `bottomDollar` margin gate** | `categoryStats` `app.js:1836`; the `units-fleet` D1 decision (gate `bottomDollar` + ROI to ≥money, `units-fleet.md` Decisions) | **Premium cost and insured value are margin-floor-adjacent** and inherit the same visibility posture: owner/admin sees the dollars; the **insured-value-vs-replacement** ratio can back-derive the floor (§3.4). |
| **Flag-color system** | `FLAG_CATALOG`/`getEntityColor` (`flag-color-system.md` §4) | A new **`uninsured-active`** / **`coverage-expired`** unit flag can fire the prescriptive R/Y/G pill (§6, OQ #7). Additive to `FLAG_COND.units`. |
| **`WINDOW_CATALOG` + R-rulebook** | `WINDOW_CATALOG` `app.js:9796`; the R0–R24 stamps (CLAUDE.md) | Any new popup (claim form, coverage-config overlay) needs a catalog entry + `data-r` stamps + a `sample()` (§6.6). |
| **Settings → Company `mem*` pattern** | `MEMBERSHIP_DEFAULTS` `app.js:3135`; Settings repriceable config (`memberships.md` §2.3) | The owner-set **coverage-type catalog** and the **premium defaults** follow this exact "owner-settable config key, repriceable without deploy" pattern (§4.3). |

### 2.2 What is explicitly NOT here today (and which area owns the seam)

- **Customer COI / liability-insurance tracking** (is the renter's certificate on file, current, naming JacRentals as additional insured?) → the document-vault gap noted in `hr-compliance.md:328`; this area surfaces the **need** at claim time (OQ #3) but does not build the vault.
- **Membership protection-claim accounting** (the $2,000/mo cap draw-down) → `memberships/protection-claims` branch (`memberships.md` §2.5 / Phase 3). This area's claim waterfall **invokes** that cap as one payer but does not build its accounting.
- **A real-time policy feed from an insurance carrier API** → not in scope for Phase 1–2; if ever built, the carrier token is **server-side, named-only** (§5.4, OQ #10).
- **Collections** (an uncollectable customer deductible) → the new `Collections` roadmap area (`invoicing-payments.md` D3 / `accounting.md` D5).

---

## 3. Users, Roles, Gates & Isolation

Permissions key off **tiers**, never role names (`ROLE_TIERS` `config.js:326`, `tierRank` `config.js:334`): `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`. The five shipped roles map via `BUILTIN_ROLE_TIERS` (`config.js:340`). The money gate is `canMoney()` (`app.js:14166`, `!currentRole || roleTier ≥ tierRank('money')`); the admin gate is `adminUnlocked()` (`app.js:13071`, `≥ admin`).

> **This is an OWNER-configured surface.** Jac's description is explicit: the **rental-company owner** selects coverage per unit. So the **configuration** verbs (insure/un-insure a unit, set its coverage types, set the premium) gate to **admin/owner tier** — the same gate as category pricing edits (`requireAdmin`, `units-fleet.md` §3.2), not the looser `canMoney()`. **Reading** coverage *status* (insured y/n + which types) is operationally useful to everyone (a driver should know a machine is uninsured before it leaves the yard), so the **status** is open; the **premium dollars** are owner-only.

### 3.1 Roles that touch this area

| Role / tier | May SEE | May DO |
|---|---|---|
| **Mechanic / M.Tech / Driver** (staff) | Coverage **status** (Insured ✓ / Uninsured, which coverage-type badges) on the unit — operational readiness | Nothing config; (Phase 2) **file** a damage claim against a unit they're inspecting (the staff "report damage" capture, like the inspection-failure flow), never set the payer or amount |
| **Office / Sales** (money) | Coverage status + (Phase 2) the **claim** records and the claim **waterfall** (who pays) — they handle the customer money side | Initiate the **customer-side** money of a claim (a deductible charge / a recovery) via the existing money-gated invoice path; **not** configure coverage or see premium cost |
| **Manager** (manager) | + (Phase 3) approve a claim payout / write-off above a threshold | + claim approval workflow |
| **Admin / Owner** (admin) | **Everything**, incl. **premium cost**, insured value vs replacement, the coverage-type catalog | **Configure coverage** per unit/category; set premiums; edit the coverage-type catalog; file/settle/close claims |
| **Developer** (developer) | + dev tools | no extra insurance power |
| **`#local` / no-role demo** | shows all UI (`!currentRole` passes `canMoney()` AND must pass the admin gate's demo bypass) | demo only; no real config persists without a backend |

### 3.2 The configuration gate — admin/owner only (NEW gate, mirror `requireAdmin`)

The per-unit **insure toggle**, the **coverage-type selection**, and the **premium field** are **admin-gated to edit**, exactly like category pricing (`priceFld(... { admin:true })` `app.js:6188`, click guard `app.js:12831`). Concretely:

- **UI gate (render):** the coverage-config controls render as **read-only badges** below admin tier and become **editable controls** (segctl/toggle/`efld`) only when `adminUnlocked()`. The **premium dollar `efld`** is not even rendered below admin tier (it's margin-floor-adjacent — §3.4).
- **Handler gate (defence-in-depth):** every config click handler re-checks `adminUnlocked()` and fires the standard `requireAdmin("Equipment insurance is Owner-only.")` toast on failure (mirrors `units-fleet.md` §3.2).
- **Server gate (authoritative):** the additive backend write action (§5) **re-validates the caller's tier server-side** — the client gate is convenience, never security. **⚠ This depends on the unresolved `backend-data` Q13 (`accounting.md` Q13): does the GAS layer receive a *verifiable role*, or only the shared `backendPassword`?** If only the password, an admin-tier server gate collapses to "anyone with the backend password." **Carried to §11 OQ #9 — conservative default: keep the config write admin-tier AND re-confirmed in-UI, and treat the server gate as not-yet-trustworthy until Q13 lands.**

### 3.3 Customer isolation & PII

- **Coverage config holds NO customer PII** — it lives on the **unit/category** (the yard's own asset), keyed by `unitId`/`categoryId`. No customer field is added.
- **A claim record DOES touch a customer** (the renter at the time of damage). It is keyed by `rentalId`/`customerId` and inherits the **same per-customer isolation** as rentals/invoices — a claim renders inside the rental/invoice context, never as a cross-customer list a lower tier could browse. **Isolation enforcement (concrete):** a claim is only ever surfaced (a) nested under the rental/invoice it belongs to, or (b) in an admin/money-tier `Claims` board that is itself behind the tier gate — there is **no claim view that lets a sub-tier session enumerate other customers' claims**. If a customer-facing surface ever renders a claim (the deductible doc, or a future `customer-portal` claim view), the **server filters on the authenticated `customerId` as the single isolation join** — the same per-customer server-side filter `customer-portal.md` §5 makes load-bearing — and never trusts a client-supplied `customerId` to scope the read. The current single-team-password backend does **not** provide that per-customer isolation, so **no claim data crosses to a customer-facing surface until the `customer-portal` external-auth + server-side per-customer filter exists** (cross-ref §12.1, OQ #9).
- **The customer's COI / liability-insurer details**, if ever stored (OQ #3), are **PII-adjacent** (an insurer name + policy number, possibly the renter's agent contact) and must be treated like the card-bound agreement media: referenced, gated to ≥money, **never on a public/print surface**, and never echoed into the Wrangler-AI read context.
- **The print/customer-facing surface NEVER shows the yard's premium, the yard's insurer, or the insured-value-vs-replacement ratio** — those are internal cost/margin-adjacent figures and the repo is public via Pages. A customer-facing claim document (a deductible invoice) shows **only the customer's deductible/charge**, priced like any invoice line (sell-side), per `invoicing-payments.md` §3.5. (OQ #8: the new insurance dollar tokens — `premium`, `insuredValue`, insurer name — join the **existing** print/PDF/quote CI string-scan that `invoicing-payments.md` Q10 / Q11.10 specifies, which already asserts no `cost`/`margin`/`bottomDollar` leaks onto the customer-facing template; this is **not** a separate accounting scan.)

### 3.4 Pricing-floor / margin visibility (the sensitive one)

The yard's **premium per unit** and the **insured value vs replacement cost** are **cost/margin-adjacent**: the premium is a cost input to the unit's true ROI, and "we insure this $90k excavator for $70k" leaks the replacement/residual basis that `bottomDollar` guards (`units-fleet.md` §3.3, D1). Therefore:

- **Premium dollars** (per-unit premium, total premium spend) gate to **≥ money tier to read** and **admin to edit** — at least as tight as `bottomDollar` (which is now ≥money to *see* per `units-fleet` D1). **Recommend admin-only for premium** since it is owner-set and rarely needs Office eyes; surface as OQ #6.
- **Insured value** (the declared value the yard insures the asset for) is the same margin-floor concern as `bottomDollar`/replacement — gate to **≥ money** display, **admin** edit, and **never** let it back-derive onto a staff or customer surface.
- **Coverage status** (insured y/n, which coverage-type badges) is **NOT** dollar-bearing → open to all signed-in operators (a driver needs it).
- **Do not** add any cost/margin/premium figure to the unit's investment block, the print doc, or the AI read surface without a fresh `/role` audit (the Wrangler-AI read gate already fences `bottomDollar`, `units-fleet.md` §3.3 — premium/insured-value join that fenced set, OQ #6).

---

## 4. Data Model

All state is **additive, schema-less JSON** — no migration. Coverage config lives on the **unit** (and an optional **category** default); the **coverage-type catalog** and **premium defaults** live in **Settings/config** (not on every row, so re-curating the catalog doesn't rewrite history); **premiums** book as **expenses** (existing ledger); **claims** are a **new entity** keyed by IDs.

### 4.1 Unit record — new coverage fields (additive, on `DATA.units`, `data.js:34`)

| Field | Type | Set by | Meaning |
|---|---|---|---|
| `insurance.covered` | bool | owner config | Is this unit insured by the yard's policy at all. Default **absent → false** (read defensively `!!u.insurance?.covered`). |
| `insurance.types` | string[] (catalog ids) | owner config | The subset of the coverage-type catalog this unit gets, e.g. `['physical-damage','theft','liability']`. |
| `insurance.insuredValue` | number | owner config | Declared value the yard insures the asset for (≥money read, admin edit; margin-floor-adjacent, §3.4). |
| `insurance.premium` | number | owner config | Per-unit periodic premium the yard pays (admin only, §3.4). |
| `insurance.premiumCadence` | `'Monthly'`\|`'Annual'` | owner config | Billing cadence of the premium. |
| `insurance.policyRef` | string | owner config | Free-text policy number / line ref (internal). |
| `insurance.effective` / `insurance.expires` | ISO `YYYY-MM-DD` | owner config | Coverage window; drives a `coverage-expired` flag (OQ #7). |
| `insurance.vendorId` | `V…` ref | owner config | The **insurer** as a vendor (reuses `DATA.vendors`); ties premiums to the existing vendor-spend rollup. |

> **Why nested under `insurance`** rather than flat `insuranceCovered`/`insuranceTypes`/…: keeps the additive footprint to one key, reads cleanly defensively (`u.insurance || {}`), and mirrors the `customer.addOns{transport,protection}` nesting (`memberships.md` §4.1). **OQ #5** asks flat-vs-nested (the diff-sync `computeChanges` is last-write-wins per top-level row, so a nested object is one field — fine).

### 4.2 Category record — optional coverage default (additive, `DATA.categories`, `data.js:24`)

| Field | Type | Meaning |
|---|---|---|
| `insuranceDefault.covered` | bool | A category-level default ("all excavators are insured") that **rolls down** to units lacking their own `insurance.covered`. |
| `insuranceDefault.types` | string[] | Default coverage types for the category. |

> **Roll-down rule (must spec):** a unit's effective coverage = its own `insurance` if present, **else** the category `insuranceDefault`. The owner can override per unit. This mirrors how pricing lives on the category and units inherit (`units-fleet.md` §4.2). **OQ #4** asks whether the per-unit surface is *enough* (Jac said "per unit" explicitly) or whether the category default is wanted at all — recommend ship per-unit first, add the category default in Phase 2 if the per-unit grind is real.

### 4.3 Coverage-type catalog + premium defaults — owner-set config (Settings, NOT per-row)

Following the `mem*` "owner-settable, repriceable without deploy" pattern (`MEMBERSHIP_DEFAULTS` `app.js:3135`):

```js
// config.js — INSURANCE_DEFAULTS (owner-overridable via Settings → Company, carried in setConfig blob)
const INSURANCE_COVERAGE_TYPES = [
  { id: 'physical-damage', label: 'Physical Damage', desc: 'Repair/replace from collision, rollover, fire' },
  { id: 'theft',           label: 'Theft',           desc: 'Stolen unit' },
  { id: 'liability',       label: 'Liability',       desc: 'Third-party injury/property the YARD is liable for' },
  { id: 'roadside',        label: 'Roadside / Recovery', desc: 'Tow/recovery of a stranded unit' },
  { id: 'loss-of-use',     label: 'Loss of Use',     desc: 'Lost rental revenue while down' },
  { id: 'flood',           label: 'Flood',           desc: 'Flood/water (Sulphur, LA — Gulf exposure)' },
];
// premium defaults are per-unit (owner enters), with an optional category default; no global flat rate.
```

The catalog is **owner-editable** (add/rename/remove a coverage type) — stored in the Settings config blob (`setConfig`/`getConfig`, `units-fleet.md` §5.1), loaded at boot alongside `mem*`. **No coverage-type definition lives on a unit** — units store only the **ids** they selected (so renaming a type doesn't rewrite every unit). **OQ #1** asks whether the catalog should be hardcoded defaults (like `FLAG_CATALOG`, `flag-color-system.md` §8) or owner-editable from day one (recommend hardcoded defaults for Phase 1, Settings editor in Phase 2).

### 4.4 Claim record — new entity (Phase 2, additive tab `Claims`)

A claim is created when a covered (or rented) unit is damaged. It is the **only** place this area writes money-adjacent data, and it **routes** rather than **owns** money.

| Field | Type | Owner | Meaning |
|---|---|---|---|
| `claimId` | `CLM###` str | id | PK (`nextClaimId()` pattern). |
| `unitId` | `U…` ref | client | Damaged unit. |
| `rentalId` / `customerId` | refs | client | The rental/renter at time of damage (nullable if damaged in-yard). |
| `incidentDate` | ISO | client | When the damage occurred. |
| `description` | str | client | What happened (the staff capture). |
| `photos` | Drive ids | client | Damage evidence (reuses the Drive offload, `accounting.md` §5.2). |
| `estimatedLoss` | number | money/admin | Repair/replace estimate (the total to allocate). |
| `payerAllocation` | `{ yardPolicy, customerLiability, rentalProtection, customerOOP }` (each a number) | money/admin | **The waterfall result** (§7.5) — who pays which dollar. |
| `deductibleInvoiceId` | `INV…` ref | server | The customer-deductible invoice (if any) — billed via the **existing** invoice path. |
| `recoveryAmount` / `recoveryAt` | number / ISO | server | What the yard's insurer remitted (books as revenue/offset, `accounting`). |
| `status` | enum | client/server | `Open → Submitted → Approved → Paid → Closed` (or `Denied`). |
| `mock` | bool | client | Seed/demo hygiene. |

### 4.5 Premium booking — an EXPENSE, not a new money store

A premium is a recurring **cost the yard pays its insurer**. It books through the **existing expense ledger** (`accounting.md` §4.1): an `expense` row with `category: 'Insurance'` (a new `expenseCategory` value, `config.js:155`), `vendorId` = the insurer, `amount` = the premium, optional `notes` referencing the unit/policy. **This area does not invent a premium ledger** — it writes (or prompts the owner to write) an expense, and the `vendorTotals`/P&L rollups (`accounting`) pick it up for free. **OQ #2** asks whether premiums auto-generate an expense on config, or stay a manual receipt the owner logs.

### 4.6 Relationships (by ID)

```
Category (1) ──< Unit (many)        unit.categoryId → category.categoryId   (coverage roll-down)
Unit (1)     ──< Claim (many)       claim.unitId → unit.unitId
Rental (1)   ──< Claim (0..1)       claim.rentalId → rental.rentalId        (nullable in-yard)
Customer (1) ──< Claim (many)       claim.customerId → customer.customerId  (isolation inherited)
Vendor (1)   ──< Expense (premium)  expense.vendorId → insurer vendor
Vendor (1)   ──< Unit.insurance     unit.insurance.vendorId → insurer
Claim (1)    ──> Invoice (deductible) claim.deductibleInvoiceId → invoice   (existing money path)
Customer.rentalProtection (bool) ── READ at claim time (§7.5), never written here
```

### 4.7 Migration concerns

Pure additive — every new field defaults absent and reads defensively (`u.insurance || {}`, `!!u.insurance?.covered`). The only true new tab is `Claims` (Phase 2), created lazily on first claim (the `accounting.md` `Periods` pattern). `categoryId`/`unitId` stay immutable (`units-fleet.md` §4.4). **No change to any membership or customer field.**

---

## 5. Backend / Integration Contract

Backend = Google Apps Script + schema-less Sheets, deployed by **clasp** (`Code.gs` gitignored). All new behavior is **additive actions on the single `backendCall(action, payload)` entry point** (`app.js:15650`). No existing action changes. Client previews; **the server is authoritative on any money figure** (`invoicing-payments.md` §1).

### 5.1 Phase 1 — NO new backend action required

Per-unit coverage config (`insure y/n`, `types`, `insuredValue`, `premium`, dates, `vendorId`) is **plain unit-record state** — it rides the **generic sync** exactly like every other unit edit (`units-fleet.md` §5.1): mutate `DATA.units`, `saveSoon()` (`app.js:15851`, 1200ms debounce) batches a `sync` whose diff (`computeChanges`) carries the changed unit row. The coverage-type catalog rides the existing `setConfig`/`getConfig` blob. **Phase 1 ships with zero new GAS action.**

> **Implication for the §3.4 premium gate:** hiding the premium in the *UI* does nothing to the *sync payload* — the whole `units` tab (incl. `insurance.premium`) loads to every client's `DATA` via `load`. So the realistic Phase-1 gate is **display-only** (hide premium + insured-value for sub-admin, like `units-fleet` D1's `bottomDollar` display gate). A genuine server-withheld premium is the heavier `getSensitiveUnitFields` change (`units-fleet.md` §5.2 Q10 analog) — **out of scope for v1**, listed as OQ #6.

### 5.2 Phase 2 — additive claim + premium actions

| Action | Payload (shape only) | Returns | Auth | Notes |
|---|---|---|---|---|
| `insuranceClaimUpsert` | `{ claim:{ unitId, rentalId?, incidentDate, description, estimatedLoss?, payerAllocation?, status } }` | `{ ok, claim }` | money (file/edit); manager (approve) | Server is source of truth for the written row; client previews. Status transitions validated server-side. |
| `insuranceClaimDeductible` | `{ claimId, amountCents }` | `{ ok, invoiceId }` | money | Creates the **customer-deductible** invoice via the **existing** `buildMembershipInvoice`-style path / invoice rails (`invoicing-payments.md` §5); server re-caps the amount; **no new money primitive**. |
| `insuranceClaimRecovery` | `{ claimId, amountCents, at }` | `{ ok }` | money/admin | Records the insurer's remittance (books to `accounting` as an offset/revenue). |
| `insurancePremiumPost` | `{ unitId, amountCents, vendorId, date }` | `{ ok, expenseId }` | admin | (Optional) auto-creates the premium **expense** row (OQ #2) — else premiums stay manual receipts. |

**Server-side role re-check (G6 / Q13).** Each action re-validates the caller's tier server-side before doing anything; an under-tier caller gets `{ ok:false, error:'forbidden' }`. **This is belt; the client gate is suspenders.** As with `accounting.md` Q13, *how* the GAS layer establishes a trustworthy role is the **`backend-data` open question** — until it's answered, treat the server gate as best-effort and keep destructive/money actions admin-tier **and** in-UI re-confirmed (OQ #9).

**Failure handling.** Every action returns `{ ok:false, error }` on failure; the client toasts a yard-voice message and never optimistically books money. Specific modes: a deductible charge into a closed accounting period refuses (`period_closed`, `accounting.md` §5.1); a recovery that exceeds the claim's estimated loss flags `over-recovery`; an offline client falls back to the client-derived waterfall preview stamped "offline — not server-of-record."

### 5.3 The claim waterfall is computed where?

The **payer waterfall** (§7.5) is **derived, not stored** — the client previews it from live facts (estimated loss, `unit.insurance.types`, `customer.rentalProtection`, the membership cap, the agreement liability requirement). At **settlement** the server recomputes and persists the `payerAllocation` so the app and any export agree (the `acctPnl` server-authoritative pattern, `accounting.md` D2). **The customer-charged dollar (deductible) is always server-re-capped** against the invoice rails — a client-invented over-charge can never move more money than the rails allow (`invoicing-payments.md` §1).

### 5.4 External integrations

| Integration | Use | Notes |
|---|---|---|
| **Insurance carrier API** (e.g. policy/claim feed) | **Out of scope Phase 1–2.** If ever built (OQ #10), the contract is explicit and conservative: **(1)** the carrier OAuth/API token lives **server-side only**, in GAS **Script Properties referred to by name** (the `backend-data.md:224`/`:226` hard-rule pattern — e.g. a `CARRIER_TOKEN` property) — **never in the bundle, the repo, a commit, or this spec** (public via Pages). **(2)** The client **never holds a carrier credential**: it only ever asks the *server* to file/query (`backendCall('insuranceCarrier…')`), and the server attaches the token. **(3)** The server **re-validates the caller's tier** before any carrier call (admin to configure the integration; money to file a claim) — same G6/Q13 server-role-trust gate as every other action; until Q13 lands, an outbound carrier call is treated as not-yet-trustworthy and stays admin-tier + in-UI re-confirmed. **(4)** **No customer PII is shipped to a carrier** beyond the minimum a claim legitimately needs (incident facts + the unit), and never the renter's full CRM record; what is sent is enumerated and reviewed before any integration ships. | A NEW external-auth surface = the load-bearing design (see §11 OQ #9/#10). Conservative default: **no carrier integration in v1**; coverage is owner-entered config + manual claims. |
| **Stripe** | Charge a customer deductible / record a recovery | Reuses the existing money path; **no new Stripe surface.** Secrets stay server-side, named-only. |
| **Google Drive** | Claim damage photos | Reuses the existing photo-offload-by-reference (`accounting.md` §5.2). |
| **Expense ledger / `accounting`** | Premiums as expenses; recoveries as offsets | No new money store (§4.5). |

---

## 6. UX / UI

All UI runs through the **`jactec-ui` skill** in the **yard data-plate** language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), exactly ONE safety-orange `--accent #ff7a1a` for the primary/ignition action, hi-vis **hazard stripe** for danger/abort, corner **rivets**, **Saira Condensed** uppercase stamped labels (~2px tracking), **Geist** body. Ranch twist stays **light, mostly copy** ("Brand it covered", "Riders" for coverage types, "Round up the claim"), leather-tan tertiary + saddle-stitch dividers used sparingly. Spend boldness in ONE place. Respect reduced-motion + visible focus. **Self-screenshot + critique before showing Jac.**

### 6.1 Coverage section on the Unit detail card (NEW — Phase 1)

A new **COVERAGE** section in `STD.units` (`app.js:5855`), sitting beside Inspection / GPS / Investment, in the steel-panel idiom:

```
┌─ ⊙  C O V E R A G E  ⊙ ───────────────────────────────┐
│  [ Insured ✓ ]          ← green badge (status, open)   │
│  Riders: [Physical Damage][Theft][Liability]            │  ← coverage-type badges (open read)
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  (saddle-stitch)     │
│  Insurer: Gulf Mutual  ·  Policy #GM-4471               │  ← vendor + policyRef (≥money)
│  Insured value  $ 72,000      (≥money · admin edit)     │  ← margin-floor-adjacent, gated
│  Premium       $ 180 / mo     (ADMIN ONLY)              │  ← not rendered below admin
│  Effective Jan 1 – Dec 31 2026                          │
│  [ Edit coverage ]   ← admin-gated ignition (R17)       │
└─────────────────────────────────────────────────────────┘
```

- **Status badges** (Insured ✓ / Uninsured + coverage-type "rider" badges) render to **everyone** (`badge`/`kvPills`), green/gray per flag-color.
- **Insurer / policyRef / insured value** render only at **≥money**; **premium** only at **admin**. Below those tiers the rows are **omitted from the DOM** (not CSS-hidden — `units-fleet` D1 / `accounting` G1: the dollar must not reach a sub-tier browser).
- **Editing** (the insure toggle, the coverage-type segmented multi-select, the premium/value `efld`s, dates, insurer pick) is **admin-gated** (`requireAdmin`, §3.2). Below admin the section is read-only badges.

### 6.2 Coverage-config overlay (NEW popup — Phase 1, optional; or inline efld)

Two options (OQ #11): **(a)** inline `efld`/segctl editing directly in the unit card section (no popup — like the GPS/inspection inline edits, simplest, no `WINDOW_CATALOG` entry); **(b)** a dedicated **"Configure coverage"** overlay (`kind:'coverageConfig'`) with the insure toggle, a multi-select coverage-type segmented control, insured-value + premium fields, insurer pick, and dates, behind a Cancel (R18) / ignition **Save coverage** (R17). **Recommend (a) inline for Phase 1** (mirrors how units edit today, zero new popup); promote to (b) only if the type-multiselect needs room. If (b): **new `WINDOW_CATALOG` entry + `sample()` required** or `ci/check-window-catalog.mjs` fails.

### 6.3 Claim form (NEW popup — Phase 2)

`kind:'insuranceClaim'` — a steel-panel overlay: damaged-unit (prefilled), incident date, description, damage-photo capture (reuses `startAgCam`-style capture), estimated loss (≥money), and the **live payer waterfall** (§7.5) read-out (who pays which dollar), behind a Cancel (R18) / ignition **File claim** (R17). The staff "report damage" entry (Phase 2) is a lighter capture that creates an `Open` claim without the money fields — like the inspection-failure capture flow (`units-fleet.md` §2.1). **New `WINDOW_CATALOG` entry + `sample()` + `data-r` stamps** the same PR it's added.

### 6.4 States

| State | Treatment |
|---|---|
| **Uninsured unit** | Gray "Uninsured" badge; (OQ #7) optionally a yellow `uninsured-active` flag if the unit is on rent and not covered. |
| **Coverage expired** | Red `coverage-expired` flag (OQ #7) when `insurance.expires < today` and `covered`. |
| **No catalog types selected** | "Insured · no riders set" — prompts the owner to pick coverage types. |
| **Claim open / submitted / paid** | Flag-color claim pill (R/Y/G per status); the waterfall read-out shows the allocation. |
| **Below-tier view** | Status + rider badges only; dollar rows absent from DOM; edit controls absent. |
| **Empty/Loading/Error** | Inherits global boot/sync; unknown coverage-type id renders a safe placeholder (`config.js:199` pattern), never a crash. |

### 6.5 Mobile reflow

The Coverage section flows inside the unit card's standard-view bottom-sheet (`mobile-remote` M-rules); the rider badges wrap; the config overlay (if used) becomes a bottom sheet with ≥44px segmented-control targets. Reduced-motion + visible-focus are the quality floor.

### 6.6 R-rulebook + WINDOW_CATALOG obligations

- **Any new popup** (coverage-config overlay if chosen, the claim form) needs a **`WINDOW_CATALOG`** entry with a `sample()` factory (`app.js:9796`) the **same PR** it's added, or `ci/check-window-catalog.mjs` fails CI.
- **Every new/changed UI element** carries a **`data-r` stamp** (status badges via `badge`/`kvPills`; the ignition Save/File = `R17`; ghost Cancel = `R18`; date fields via `dateField`; the insure toggle/segctl via the existing seg builders). Regenerate `rule-usage.js` (`node ci/gen-rule-usage.mjs`, drop `--check`) or the drift/duplicate guard fails CI.
- A **new `Insurance` `expenseCategory`** (§4.5) and any new **unit flag** (`uninsured-active`/`coverage-expired`, OQ #7) are config additions; the flag conditions go in `FLAG_COND.units` / `FLAG_META.units` (`flag-color-system.md` §7.2).

---

## 7. Business Rules / Money

### 7.1 Effective coverage (roll-down)

```
unitCoverage(u):
  if u.insurance && u.insurance.covered !== undefined   → use u.insurance
  else if category(u).insuranceDefault                  → inherit category default
  else                                                  → uninsured
effectiveTypes(u) = (u.insurance?.types ?? category(u).insuranceDefault?.types ?? [])
```

### 7.2 Insured value & rollups (owner view)

```
fleetInsuredValue   = Σ insurance.insuredValue  over covered units NOT in {Sold, Inactive, For Sale}
fleetPremiumMonthly = Σ normalize(insurance.premium, premiumCadence → monthly)  over covered units
```
- Excludes out-of-service units (parallel to `isUnitRentable`, `units-fleet.md` §7.2) so the owner sees **active** insured value.
- Both figures are **≥money/admin-gated** (§3.4) — they are margin-floor-adjacent.
- Premiums normalize to a common cadence for the rollup (Annual ÷ 12), exact-cent (`Math.round(x*100)/100`).

### 7.3 Premium = cost (books as an expense)

A premium is **not customer revenue** and **not a customer line** — it is a yard **cost**, booked as an `expense` (`category:'Insurance'`, `vendorId` = insurer, §4.5). It flows into `vendorTotals` and the `accounting` P&L (`net = Σ invoice.subtotal − Σ expense.amount`, `accounting.md` D2) **for free** — insurance premium reduces net like any other cost. **This area never books a premium as revenue.**

### 7.4 Coverage status flags (units)

| Flag (proposed) | Sev | Condition |
|---|---|---|
| `coverage-expired` | 🔴 | `insurance.covered && insurance.expires < TODAY_ISO` |
| `uninsured-active` | 🟡 | unit is **on rent** AND `!unitCoverage(u).covered` (OQ #7 — is an uninsured-on-rent unit a yellow "attention" or fine?) |

Additive to `flag-color-system.md` §7.2; no flag → green; the pill keeps its label, takes the computed color.

### 7.5 The claim waterfall — WHO PAYS (the reconciliation, the heart of this area)

When a damaged unit's claim is settled, the **estimated loss** is allocated across **four payers in priority order**. This is the one place the four insurance concepts meet. **Order and exactness are Jac's call (OQ #3)** — this is the *proposed* default:

```
estimatedLoss = the repair/replace estimate for the damaged unit

1. CUSTOMER LIABILITY (the renter's own insurance, per the signed agreement, agreements.js:55)
   - The agreement REQUIRES the renter to carry property coverage for the unit's replacement
     value, "primary and non-contributory." So the renter's policy is the FIRST payer.
   - ⚠ GAP: the app does NOT track whether the COI is on file/current (§2.2, OQ #3). If we can't
     confirm the renter's coverage, this tier is "claimed but unconfirmed" — the waterfall must
     not silently assume the renter pays when we have no proof.

2. MEMBERSHIP RENTAL PROTECTION (customer.rentalProtection, the $2,000/mo cap)
   - If the renter carries Rental Protection, it covers the customer's exposure UP TO the
     $2,000/mo cap (memProtectionCap). This is the customer's purchased damage cap — it offsets
     what the CUSTOMER would otherwise owe out-of-pocket, NOT what the yard's policy pays.
   - Read-only here: this area READS customer.rentalProtection and the cap; the cap draw-down
     ACCOUNTING is the deferred memberships/protection-claims branch (memberships.md §2.5).

3. YARD EQUIPMENT-INSURANCE POLICY (this area)
   - For loss ABOVE what the renter's liability + their protection cap cover, IF the unit carries
     the relevant coverage type (e.g. 'physical-damage' for collision), the YARD files against its
     own property policy. The yard's deductible is the yard's cost.

4. CUSTOMER OUT-OF-POCKET (deductible / uncovered remainder)
   - Any remainder the renter owes (their deductible, or loss not covered by 1–3) is billed as a
     customer DEDUCTIBLE invoice via the existing invoice/payment rails (server-re-capped). An
     uncollectable one routes to the new Collections area (invoicing-payments.md D3).

payerAllocation = { customerLiability, rentalProtection, yardPolicy, customerOOP }   // sums to estimatedLoss
```

**Invariants:**
- **No double-coverage:** a dollar is paid by exactly one tier; the allocation **sums to `estimatedLoss`** (server asserts).
- **Protection ≠ yard policy:** Rental Protection offsets the **customer's** exposure (tiers 1/4); the yard policy (tier 3) covers the **yard's asset**. They are not the same dollar — the spec must render them as distinct lines so staff don't think "they had protection, so we're covered" (they aren't — protection caps the *customer's* bill, not the yard's loss).
- **Unconfirmed customer coverage:** if the COI isn't on file, tier 1 is flagged unconfirmed and the waterfall conservatively falls through to tiers 3/4 (the yard eats more, or bills the customer) rather than assuming the renter pays. (OQ #3.)
- **Coverage-type gate:** the yard policy (tier 3) only pays if `effectiveTypes(u)` includes the relevant type — a theft loss on a unit insured only for 'physical-damage' does **not** pay from tier 3.

### 7.6 Edge cases (money / coverage)

- **Uninsured unit damaged on rent** → tiers 1/2/4 only (no yard policy); if the renter has neither liability-on-file nor protection, the loss is the **yard's out-of-pocket** with no insurance offset — the worst case the `uninsured-active` flag (OQ #7) is meant to pre-warn.
- **Damaged in-yard (no rental)** → no customer tiers; yard policy (tier 3) only, else yard absorbs.
- **Recovery exceeds estimate** → server flags `over-recovery`; never books phantom revenue.
- **Sold/Inactive unit** → drops out of insured-value/premium rollups (§7.2).
- **Premium cadence mismatch** → normalized to monthly for the rollup (§7.2).
- **Catalog type renamed/removed** after a unit selected it → the unit keeps the **id**; a missing id renders a safe placeholder, never a crash (the unit's selection is preserved, the owner re-picks).
- **Membership lapses mid-rental** → `rentalProtection` is **not cleared on lapse** (`memberships.md` §4.1); the waterfall reads the live flag at incident date.

---

## 8. Phasing & Milestones

### Phase 1 — Owner coverage config (MVP, the headline of Jac's description)
- New `unit.insurance{}` fields + the hardcoded coverage-type catalog (`INSURANCE_COVERAGE_TYPES`).
- The **Coverage section** on the unit detail card: status + rider badges (open), insurer/value (≥money), premium (admin); inline admin-gated edit.
- Insured-value + premium rollups (owner view), gated (§3.4).
- A new `Insurance` `expenseCategory` so premiums book through the existing ledger (§4.5).
- **No new backend action** (rides generic sync), **no new popup** if inline edit (6.2a).
- **In scope:** the per-unit owner-selected coverage surface + entitlement readout + premium-as-expense.
- **Out of scope:** claims, the waterfall settlement, category defaults, any carrier API.

### Phase 2 — Claims + the payer waterfall
- The `Claims` entity + `insuranceClaimUpsert`/`Deductible`/`Recovery` additive actions.
- The **claim form** popup + the staff "report damage" capture.
- The **payer waterfall** (§7.5) preview + server-settled allocation; the customer-deductible invoice via the existing rails.
- Coverage-status flags (`uninsured-active`/`coverage-expired`).
- Optional category-level `insuranceDefault` roll-down (OQ #4).
- **Blocked on `backend-data` Q13** (server role trust) before any money-mutating claim action ships (§3.2/§5.2).

### Phase 3 — Integration & automation (candidate)
- An owner-editable coverage-type catalog in Settings (OQ #1).
- Premium auto-expense generation (OQ #2).
- Manager claim-approval workflow + thresholds.
- (Optional, big) a carrier API/feed — server-held token, named-only (OQ #10).
- Customer COI / liability-insurance tracking (joins `hr-compliance` document-vault, OQ #3).

---

## 9. Acceptance Criteria

| # | Criterion | CI / gate impact |
|---|---|---|
| AC1 | A unit's Coverage section renders status + rider badges to **every** role; insurer/insured-value only at ≥money; **premium only at admin** — asserted against the **rendered HTML/data**, not CSS (no premium dollar reaches a sub-admin DOM). | `ci/logic-test.mjs` gate assertion at the row-builder source; manual multi-role check on `:9147`. |
| AC2 | Editing the insure toggle / coverage types / premium / insured value fires `requireAdmin` for a non-admin and persists via `sync` for an admin. | manual two-role check; no role-fixture in `logic-test` today (coverage-gap noted, `units-fleet.md` AC6). |
| AC3 | `effectiveTypes(u)` rolls down: unit override wins, else category default, else uninsured. | `ci/logic-test.mjs` fixture. |
| AC4 | `fleetInsuredValue`/`fleetPremiumMonthly` exclude Sold/Inactive/For-Sale units and normalize premium cadence to monthly, exact-cent. | `ci/logic-test.mjs` fixture. |
| AC5 | A premium books as an `expense` (`category:'Insurance'`) and reduces `accounting` net — never as revenue. | manual + `accounting` P&L fixture. |
| AC6 | (P2) The claim waterfall allocation **sums to `estimatedLoss`** with no double-coverage; yard-policy (tier 3) pays only when `effectiveTypes` includes the relevant type; an unconfirmed-COI tier 1 falls through conservatively. | `ci/logic-test.mjs` waterfall fixture. |
| AC7 | (P2) A customer deductible is **server-re-capped** against the invoice rails; a claim's recovery never exceeds estimated loss (`over-recovery` flag). | manual + integration. |
| AC8 | (P2) Each `insurance*` GAS action refuses an under-tier caller server-side (`forbidden`) — **blocked on `backend-data` Q13**; until then config/claims stay admin-tier + in-UI re-confirmed. | manual/integration. |
| AC9 | The customer-facing claim/deductible doc + the print template contain **no** premium/insured-value/insurer/`bottomDollar`/cost/margin token. | extend the **`invoicing-payments.md` Q10 / Q11.10** print/PDF/quote CI string-scan (the canonical one) to also reject `premium`/`insuredValue`/insurer tokens. |
| AC10 | New popups (claim form / coverage-config if used) are in `WINDOW_CATALOG` with a `sample()`; new UI elements carry `data-r` stamps; `rule-usage.js` regenerated. | `ci/check-window-catalog.mjs`, `ci/gen-rule-usage.mjs --check`. |
| AC11 | App boots, the Coverage section renders without console error; any new/moved chapter banner regenerates the Code Atlas. | `ci/smoke.mjs`, `tools/gen-code-map.mjs --check`. |
| AC12 | No secret, carrier token, OAuth credential, or `DEFAULT_CONFIG` value appears in any committed file. | manual review (repo public via Pages). |

Standard gate run (port 8000 reserved → `sed` to 9147 first, then `git checkout -- ci/`): `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`. Cache-bust the shared `?v=` token on deploy.

---

## 10. Risks & Edge Cases

| Risk | Mitigation |
|---|---|
| **Confusing equipment insurance with Rental Protection** (the #1 conceptual risk) | §1.4 delineation table + §7.5 renders them as **distinct** payer lines; staff copy never implies "they had protection so the yard is covered." This spec **does not modify** membership Rental Protection. |
| **Premium / insured-value margin leak** | Margin-floor-adjacent (§3.4): premium admin-only, insured-value ≥money, both **omitted from the sub-tier DOM** (not CSS-hidden); never on the print/customer/AI surface. Reuses `units-fleet` D1 posture. |
| **Display gate ≠ data gate** | The whole `units` tab loads to every client (§5.1), so a UI gate is display-only — covers the realistic screen-share/screenshot threat; a true server-withheld premium is the heavier OQ #6, out of v1. |
| **Server role gate is theatre if Q13 unresolved** | §3.2 / §5.2: until `backend-data` Q13 proves a verifiable server-side role, keep config/claims admin-tier **and** in-UI re-confirmed; no money-mutating claim action ships before Q13. |
| **Carrier API = new external-auth surface** | Out of v1; if built, token server-side/named-only (§5.4, OQ #9/#10); conservative-by-default (no integration). |
| **Unconfirmed customer COI** | The waterfall must not assume the renter pays without proof (§7.5 tier 1); falls through conservatively; the COI vault is `hr-compliance`/OQ #3. |
| **Double-coverage / allocation drift** | Server asserts the allocation sums to `estimatedLoss`; a dollar pays from exactly one tier. |
| **Premium booked as revenue** | Hard rule: premium is **cost** (expense), never revenue (§7.3). |
| **Claim touches a customer (isolation)** | Claim keyed by `customerId`/`rentalId`, inherits rental/invoice isolation; no cross-customer claim list below tier. |
| **Catalog id rename orphans a unit's selection** | Units store **ids**, not labels; a missing id renders a safe placeholder; the selection is preserved. |
| **Multi-user concurrent coverage edit** | Diff-sync is last-write-wins per unit row (`units-fleet.md` Q5); coverage is a single nested `insurance` field — acceptable for metadata; server authoritative on money. |
| **Offline / demo** | Config rides localStorage→sync; claims fall back to a client-derived waterfall preview stamped "not server-of-record"; no real money without `backendPassword`. |
| **Sold unit still showing premium** | Rollups exclude out-of-service units (§7.2); the per-unit field persists for history but doesn't inflate active spend. |

---

## 11. Open Questions

> **Resolved 2026-06-29:** OQ#1 → **D1** (catalog = Theft / Flood / In-Tow Damage (asset only); owner-editable in v1). OQ#3 → **D3** (waterfall order changed: **RPP first**) + **D4** (build COI tracking now, not "unconfirmed"). OQ#6/#13 → **D5** (premium AND insured-value both admin-only; status open). OQ#2/#4/#5/#7/#8/#11/#12 → **D6** (adopt drafts). RPP scope clarified → **D2** (covers anything up to $2,000, not peril-specific). OQ#9a (server role trust = `backend-data` Q13) + OQ#9b (per-customer isolation) + OQ#10 (carrier API) remain: claims internal-only in v1, money-mutating claim actions blocked on Q13, no carrier integration in v1 — all stay on main.

> Greenfield — every fork below is surfaced, not silently decided. **OQ #1 (catalog ownership), #3 (the waterfall + COI gap), and #9 (server role trust / external-auth) are load-bearing and should be answered first.** The security cluster (#6 premium gate, #9 server trust, #10 carrier auth) stays on the **main session** — not delegable.

1. **Coverage-type catalog — hardcoded defaults or owner-editable from day one?** `INSURANCE_COVERAGE_TYPES` could ship as hardcoded defaults (like `FLAG_CATALOG`, `flag-color-system.md` §8 — simplest, no Settings editor) or be owner-editable in Settings immediately (matches "the owner selects coverage types" most literally, but adds a config-editor UI). *Recommend: hardcoded defaults Phase 1, Settings editor Phase 3.* **— Jac decides the catalog's contents too** (are *Physical Damage / Theft / Liability / Roadside / Loss-of-Use / Flood* the right six for a Sulphur, LA yard? Flood is deliberately included for Gulf exposure).

2. **Premiums — auto-generate an expense on config, or stay a manual receipt?** Setting `insurance.premium` could auto-create a recurring `Insurance` expense (cleaner P&L, but needs a cadence/cron like the deferred membership billing, `memberships.md` §2.5), or the owner logs the premium receipt manually (zero automation, Phase-1-friendly). *Recommend: manual receipt Phase 1; auto-expense Phase 3 (shares the membership-cron decision).*

3. **The claim waterfall order + the COI gap (the heart of the area).** Is the §7.5 priority — **customer liability → membership Rental Protection → yard policy → customer out-of-pocket** — the right order? And the bigger gap: the app **doesn't track the customer's COI** (is it on file, current, naming JacRentals as additional insured?). Do we (a) build COI tracking now (joins `hr-compliance` document-vault) so tier 1 is *confirmable*, or (b) ship the waterfall with tier 1 marked "unconfirmed" and fall through conservatively? **Trade-off:** correctness/liability-defense vs. scope. *Recommend: (b) for v1 with an explicit unconfirmed state; COI vault later.* **— surface, don't silently pick the order.**

4. **Per-unit only, or per-unit + category default?** Jac's description says **"per unit."** Is the per-unit surface *enough*, or is a category-level `insuranceDefault` roll-down (§4.2) wanted so the owner sets "all excavators insured" once? **Trade-off:** per-unit is literal-to-the-ask and simplest; category default saves the owner a grind on a big fleet. *Recommend: per-unit Phase 1, category default Phase 2 if the grind is real.*

5. **Data shape — nested `unit.insurance{}` or flat fields?** Nested (recommended, §4.1) keeps the additive footprint to one key and mirrors `customer.addOns`; flat (`insuranceCovered`, `insuranceTypes`, …) is marginally easier to diff per-field. **Trade-off:** tidy footprint vs. per-field LWW granularity (diff-sync is per top-level row either way). *Recommend: nested.*

6. **Premium / insured-value visibility — admin-only, ≥money, or server-withheld?** Premium is owner-set cost (recommend **admin-only** to read+edit); insured value is margin-floor-adjacent (recommend **≥money** read, admin edit) — but both load to every client via `load` (§5.1), so a UI gate is display-only. Do we (a) display-gate only (cheap, covers screen-share/screenshot — like `units-fleet` D1), or (b) build a server-withheld `getSensitiveUnitFields` (a real secret, but a structural `backend-data` change)? *Recommend: (a) display gate Phase 1; (b) only if the threat model demands devtools-level protection.* **Security — stays on main.**

7. **Coverage-status flags — does an uninsured-on-rent unit warrant a flag?** Proposed `uninsured-active` (🟡) when a unit is on rent and not covered, and `coverage-expired` (🔴) when past `expires` (§7.4). **Trade-off:** great pre-dispatch warning vs. flag-noise if most units are intentionally self-insured. *Recommend: ship both; `uninsured-active` is the one that prevents the worst-case §7.6.* **— Jac confirms whether uninsured-on-rent is "attention" or "fine."**

8. **Customer-facing claim doc — confirm the no-cost-leak rule + CI scan.** A customer deductible invoice must show **only** the customer's charge — never premium/insured-value/insurer/`bottomDollar` (§3.3). Confirm, and **extend the canonical print/PDF/quote CI string-scan that `invoicing-payments.md` Q10 / Q11.10 owns** (it already rejects `cost`/`margin`/`bottomDollar`) to also reject the new insurance tokens (`premium`, `insuredValue`, insurer name). *Recommend: confirm + extend the existing scan (don't fork a second scan).*

9. **Server-side role trust + per-customer isolation for the config/claim actions (the security fork).** Two coupled questions:
   - **(a) Server role trust.** The admin/money server gates (§3.2/§5.2) collapse to "anyone with the `backendPassword`" **unless** the GAS layer receives a verifiable role — the **same unresolved `backend-data` Q13** (referenced by `accounting.md` Q13/G6, deferred to the `backend-data` spec). Until it's answered: keep config + claims admin-tier **and** in-UI re-confirmed, treat the server gate as best-effort. **Trade-off:** doing it right may need a signed per-user/role token through `backendCall` (a `backend-data` change) vs. accepting UI-only gating as best-effort until then.
   - **(b) Per-customer isolation.** A claim is the first insurance record that touches a customer (§3.3). Internal-only (admin/money board) it inherits the existing tier gate. But the moment a claim is exposed customer-facing, it needs the **strict server-side per-customer filter** that `customer-portal.md` §5 establishes (single `customerId` join, server-authenticated, never client-scoped) — which **does not exist** under today's single-team-password model. **Trade-off:** ship claims internal-only now (no isolation infra needed) vs. wait for `customer-portal` external-auth before any customer-facing claim view.
   *Recommend: claims internal-only in Phase 2 (no customer-facing claim surface), so neither (a) nor (b) blocks an admin/money-tier claim board; any customer-facing claim view waits on `customer-portal`.* **Both must be answered before any money-mutating OR customer-facing claim action ships. Security — stays on main, not delegable.**

10. **A carrier API/feed — ever?** Phase 1–2 are owner-entered config + manual claims (no external auth). If a real carrier integration is ever wanted (auto-sync policies, file claims via API), it's a **NEW external-auth surface** — the token is **server-side, named-only** (§5.4), and the auth/isolation/server-trust model becomes load-bearing. *Recommend: explicitly OUT for v1–v2; revisit only if Jac wants it, and design the auth conservatively then.* **Security — stays on main.**

11. **Coverage edit — inline `efld` or a dedicated overlay popup?** Inline (recommended Phase 1, §6.2a — mirrors GPS/inspection editing, no new `WINDOW_CATALOG` entry) vs. a "Configure coverage" overlay (§6.2b — room for the type multi-select, but a new popup + catalog entry). *Recommend: inline Phase 1; overlay only if the multi-select needs room.*

12. **Naming.** "Equipment Insurance" (the area) vs. the customer-facing "Rental Protection" (membership) vs. the agreement's "Insurance" requirement — three "insurance" concepts. Do we surface a distinct in-app label for the yard coverage ("Asset Coverage"? "Yard Coverage"? "Equipment Insurance"?) so staff don't conflate it with Rental Protection? **Trade-off:** a clear distinct name reduces the §1.4 confusion risk; "Insurance" is what Jac called it. *Recommend: keep "Equipment Insurance" / "Coverage" in-app; never reuse "Protection" for it.*

13. **Does Sales/Office need to SEE the yard premium at all?** The customer money side (deductible) is theirs, but the yard's premium cost is owner business. Recommend **admin-only premium** (OQ #6) — confirm Office/Sales don't need it for any workflow.

---

## 12. Dependencies & Sequencing

Per `AREAS-ROADMAP.md` (Equipment Insurance is one of the 3 areas added 2026-06-29, tier **Want**, **greenfield**).

### 12.1 Cross-area dependencies (roadmap slugs)

| Depends on | Why |
|---|---|
| `units-fleet` | The per-unit coverage config is **additive fields on the unit** (+ category default); reuses the unit detail card, the fleet-status out-of-service exclusion, and the `bottomDollar`/cost-field gate posture (D1/D2). |
| `memberships` | Reconciliation centerpiece (§1.4): READS `customer.rentalProtection` + the $2,000/mo cap at claim time; **does not modify** them. |
| `invoicing-payments` | The customer **deductible** + claim **recovery** ride the existing invoice/payment rails (server-re-capped); no new money primitive; the no-cost-on-print rule (§3.5). |
| `accounting` | Premiums book as **expenses** (`Insurance` category) → `vendorTotals` / P&L net; recoveries as offsets. Shares the server-role-trust open question (Q13) and the print-margin CI scan (Q10). |
| `customers-crm` | A claim touches the renter; inherits customer isolation; (Phase 3) the COI/liability-insurer fields are customer/document-vault data. |
| `backend-data` | The additive `insurance*` actions (Phase 2) live in `Code.gs`; **Q13 (server role trust) BLOCKS** money-mutating claim actions. |
| `hr-compliance` | The document-vault gap (`hr-compliance.md:328`) is where customer-COI tracking would live (OQ #3). |
| `design-system` / `jactec-ui` | Yard data-plate language + R-rulebook stamps + `WINDOW_CATALOG` for any new popup. |
| `Collections` (new area) | An uncollectable customer deductible routes here (`invoicing-payments.md` D3). |

### 12.2 Areas that depend on Equipment Insurance
`financials-kpi` (an insured-value / premium-spend / claim-loss KPI, if Jac wants one), `accounting` (premium cost in the P&L), and any future `gps-tracking`/stray-alert (a stolen unit ↔ a theft claim).

### 12.3 What must land / be decided first
1. **OQ #3 (waterfall order + COI gap)** and **OQ #1 (catalog)** — product/conceptual forks, resolve on main before any build.
2. **OQ #9 (server role trust, = `backend-data` Q13)** — security fork; **blocks** Phase-2 money-mutating claim actions; stays on main.
3. **OQ #6 (premium/insured-value gate)** — security/visibility; resolve alongside the `units-fleet` D1 gate it reuses.
4. **Phase 1 is self-contained** — per-unit config + premium-as-expense ride the **generic sync** with **no new backend action**, so it can ship against today's shipped `units-fleet`/`accounting` once #1/#6 are answered; Phase 2 (claims) waits on #9.

---

*End of DRAFT — for Jac's critique. Every numbered Open Question is a real fork; none were silently resolved. This spec reconciles the new owner-side Equipment Insurance with the existing membership Rental Protection (§1.4) and does NOT modify the latter.*
