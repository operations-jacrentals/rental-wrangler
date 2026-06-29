# Customers / CRM — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/customers-crm`
**Task branch:** `customers-crm/spec` (proposed)
**Maturity:** ✅ Shipped
**Scope:** The Customer record and everything that hangs off it — account/contact details, the dual sales funnels, the activity-cadence engine, card/ACH payment methods with card-bound agreements + selfie capture, and the new/edit overlay — documented AS CANON with proposed forward work.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

**Posture (important):** Jac runs a small, trusted single-yard team. Internal **visibility** of customer info is **open**; the gating that matters is **money *movement*** (and competitive secrets like the margin floor, gated in `units-fleet`). These resolve the §11 Open Questions and amend §3 / §6 / §7.

- **D1 · Staff see the full customer card; gate only the money *actions* (resolves Q4/Q5/Q5b).** **Reverses** the draft's "collapse the payment block" idea. The payment-method **rows stay visible to every signed-in user** (brand · last4 · sign-state), as do the spend `_digest` and net terms — read-only. Only the **money action buttons** stay `canMoney()`-gated: Add card, Take payment / Charge, Set default, Sign, Remove, ACH add/verify. (This still closes the real shipped gap — today a staff/no-role view can *click* default/sign/remove — by wrapping those **actions** in `canMoney()`, while leaving the display open per Jac.)
- **D2 · `idNumber` stays visible, plaintext, no mask, no gate (resolves Q6).** It's internal identity info the team may see. The **hard rule is unchanged**: never export it to the public repo / Pages / search blob / AI tool output. Internal UI display is fine.
- **D3 · Anyone can blacklist, with an audit trail (resolves Q3).** There is **no blacklist UI today** — `Blacklisted` is in the `customerAccountType` registry (`config.js:113`) but absent from `NC_ACCOUNT_TYPES` (`app.js:14040`). Wire it into the account-type pills, **settable by any signed-in user (no tier gate)** via a **red hazard-stripe confirm** ("This blocks new rentals for this account"); stamp `blacklistedAt` + a `'Blacklisted by <role>'` `activityLog` entry (audit, not gate). **Soft gate:** blocks *new* rentals only, never retro-cancels live ones (read by `rentals-dispatch`).
- **D4 · Customer merge → Phase 2 (resolves Q7).** Spec it now, build later — it's destructive and touches rentals/invoices.

**Defaults adopted:** Q1 → `_digest` recomputes **client-side on load** (single-pass, bucketed by `customerId`, isolation-filtered) · Q2 → `payStatus` becomes **derived** from open invoices (kills drift). **Now moot** given the open-visibility posture: Q11 (role-fixture mainly needs to assert staff can't *click* money actions — keep as a light check) and Q12 (demo PII masking — dropped; `idNumber` isn't masked). Q8/Q9/Q10 stand at their recommendations.

---

## 1. Goal & Problem

### 1.1 What this area is for

The **Customer** is the spine of the business. Every rental, invoice, payment, membership, agreement, and funnel move resolves back to one customer record. Customers / CRM owns:

- **Who the customer is** — contact + account identity (name, company, phone, email, industry, address, driver's-license/ID #, PO requirement, payment terms).
- **What we're allowed to do with their money** — cards + bank accounts on file, the card-bound signed agreement, the selfie/signature packet, and the gates those drive.
- **Where they are in our pipelines** — the **Used-Sales** funnel and the **Membership** funnel (dual, independent).
- **How healthy the relationship is** — the 5-stage activity-cadence engine ("when is this customer due to rent again, and how overdue are they?") and the 9-month spend chart.
- **What we've done and plan to do** — the Activity Log (logged actions) + Schedule (follow-ups).

### 1.2 The business problem

JacRentals is a relationship business in a small market (Sulphur/Lake Charles, LA). The same construction/industrial outfits rent repeatedly. The money question isn't "did we close this deal" — it's **"is this account still warm, and is it safe to put a $90k machine on their job with their card on file?"** The CRM has to answer both at a glance, on the yard, from a phone, without a separate sales tool.

### 1.3 North star

> Open a customer and instantly know: **can I rent to them right now** (card + signed agreement + pay status), **are they slipping away** (cadence stage), and **what's the next move** (funnels + scheduled actions) — with every money/PII surface gated to the right role.

---

## 2. Current State (Baseline)

This is the **live, shipped** Customers card. Treat it as canon.

### 2.1 The customer record (data.js:54–74)

Seeded demo rows carry the full production shape. Source fields are editable; the `_digest`
history block is **DERIVED in production but seeded static today** (see §2.6). Key fields:
`customerId`, `firstName`/`lastName`/`name`, `company`, `phone`, `email`, `address`,
`accountType`, `payStatus`, `industry`, `requiresPO`, `rentalProtection`, `accountNotes`,
`idNumber`, `netDays`, `stripeId`, `cards[]`, `usedSalesStage`, `membershipStage`,
`interestedCategoryIds[]`, `salesAction`, `activityLog[]`, `_digest{}`, plus membership fields
(`paidUntil`, `paidCadence`, `unlimitedTransport`, `paidFees`) and `custom{}`.

### 2.2 The detail renderer — `customers:` (app.js:6087–6168) — SHIPPED

Render order, top to bottom:

| Block | Source | Notes |
|---|---|---|
| Title | `fullName(c)` | R9 title flags carry account-type + pay-status; no badge row |
| Notes (top) | `notesSection('customers', …, 'accountNotes')` | filled notes float above funnels |
| Membership + Used Sales | `membershipSectionHtml`, funnels | two-column `detail-cols` |
| Action header / entry | `js-act-open` (record/schedule) | "Actions" / "Schedule" labels |
| Activity columns | `activityLog` split on `^Scheduled:` | logged LEFT, scheduled RIGHT |
| Activity chart | `customerActivityChart(c)` | spend area + cadence track |
| Account | merged Contact+Account | LEFT = entered fields, RIGHT = facts + derived; faded selfie backdrop |
| Payment Methods | `paymentMethodsSection(c)` | Cards / ACH tabs |
| Notes (bottom) | empty-notes slot (R12) | |
| History | `historySection('customers', …)` | `_digest` audit |

Click-to-edit on every contact/account field via `efield()` → `data-edit="custField"`
(auto-saves through the persist hook). Empty fields render the R5 dashed `+Thing` add.

### 2.3 Activity-cadence engine — `customerActivity(c)` (app.js:5261–5279) — SHIPPED

Reads `_digest.avgFrequencyDays` (`f`) and `_digest.lastInvoice` (`last`). Computes
`expDate = last + f days`, `pastPct = 100*(daysSinceLast − f)/f` (signed), then buckets:

| Stage | Condition | Color |
|---|---|---|
| **New** | no `f` or no `last` | gray |
| **Active** | `past < 0` (before expected) | green |
| **Check-in** | `0 < pastPct ≤ 25` | yellow |
| **Action Required** | `25 < pastPct ≤ 50` | orange |
| **Inactive** | `50 < pastPct ≤ 100` | red |
| **Lost** | `pastPct > 100` | red (deep) |

`customerActivityChart` (app.js:5302) draws a 9-month spend area chart (`customerMonthly`,
`rentalAmt`) plus a second "days rented" series (leather-tan dashed, `#c2925a`), with a
Today line + dashed Next-Expected line + runway band, and a Best-Month callout. **This is
the ranch-twist reference implementation** (tan dashed series).

### 2.4 Dual funnels — `gateTimeline` / `openFunnelDropdown` (app.js:11383–11508) — SHIPPED

Two independent funnels per customer, both rendered as the gate-timeline dropdown:

- **Used Sales** (`usedSalesStage`) — `funnelStage` order, free choice.
- **Membership** (`membershipStage`) — `MEMBERSHIP_FUNNEL_ORDER`, terminal stage `Signed`
  is **locked** (auto-set by signing the membership agreement, never manual; F3).

Stages: `N/A → Inbound Lead → Outbound Lead → Don't Contact → Contacted → Not A No! →
Payment Discussed → Paid/Signed`. Every move logs to `activityLog`. Interested categories
(`interestedCategoryIds`) attach via `openIntCatDropdown`.

### 2.5 New/Edit overlay — `kind: 'newCustomer'` (app.js:9448–9535; open at 14017) — SHIPPED

Tabbed popup (`nc-popup`): an **Account** tab + one tab per saved card (signed-dot rail) +
`+Card`. Account tab fields: Name*, Company, Phone*, Email, Industry, Notes·PO·Protection,
Account type pills, Driver's-license/ID #, Net-days terms. Validations in `saveNewCustomer`
(app.js:14094): name required, phone required, email format, required custom fields, and the
**forced** PO (Yes/No) + Rental-Protection (Yes/No) answers.

**Quick-add** (`quickSaveCustomer`, app.js:14049): the instant First+Phone exist, the record
persists behind the scenes and the popup flips to edit-in-place so a card can be attached
without a second Save. `applyCustomerLink` re-anchors a Quote/invoice that spawned the create.

### 2.6 `_digest` — STATIC TODAY (data.js:54–57 note)

`_digest{ totalPaid, visits, years, avgFrequencyDays, activePct, firstInvoice, lastInvoice }`
is the seed of the cadence engine, the spend chart, History, and the Sales/Office KPIs
(app.js:7138, 8523, 8787). The seed comment is explicit: these numbers are **derived in
production** but are **currently hardcoded** in the seed. New customers get a zeroed digest
(app.js:14061/14132). **There is no live recompute pass that walks rentals/invoices to rebuild
`_digest`.** This is the single biggest gap in the area (see §7.1, §11 Q1).

### 2.7 Payment methods + card-bound agreements (app.js:615–658) — SHIPPED

`paymentMethodsSection` → Cards / ACH tabs. Each card carries its own
`agreement: { signedAt, version, signature, selfie }` (migration app.js:104–114). Per
prior art `docs/superpowers/specs/2026-06-18-card-bound-agreements-design.md`: a signature
is always attached to a card; cards can be saved+charged **Unsigned**; **any unsigned card
blocks On-Rent + delivery**. Selfie backdrop on the Account section
(`docs/superpowers/specs/2026-06-20-customer-photo-account-backdrop-design.md`).

### 2.8 What's missing / partial (shipped-area gaps)

| Gap | State |
|---|---|
| Live `_digest` recompute | **Missing** — static seed only |
| Blacklisted account type in the new/edit pills | **Partial** — `Blacklisted` exists in `customerAccountType` (config.js:113) but is NOT in `NC_ACCOUNT_TYPES` (app.js:14040); no UI to set it |
| Merge / de-dup of duplicate customers | **Missing** |
| Contact-attempt outcome on scheduled follow-ups | **Partial** — schedule logs free text only |
| PII export / GDPR-style deletion | **Missing** |
| Per-customer aged-receivables roll-up on the card | **Missing** (lives on Invoices) |

---

## 3. Users, Roles & Data Gates

Roles carry a **tier** (config.js:326, `ROLE_TIERS`): `staff(1) < money(2) < manager(3) <
admin(4) < developer(5)`. The per-role default tier is `BUILTIN_ROLE_TIERS` (config.js:340),
overridable at runtime via `settings.roleMeta`; the legacy **Owner** login bridges to `admin`
until explicitly converted to Manager (config.js:344 — the rollout never strips an in-use login
mid-flight). The shipped money gate is `canMoney() = !currentRole || roleTier(currentRole) ≥
tierRank('money')` (app.js:14166) — note the `!currentRole` short-circuit: the **`#local`
demo / no-role build shows every money surface** (intentional, for design review on `:9147`),
so a gate that relies *only* on `canMoney()` is wide-open in demo. New gates that protect real
PII/money in production must therefore *also* be exercised under a real role fixture, not just
the demo (see §9 A3 / §10 "demo unlock").

The 15 shipped roles map onto five tiers. The five **built-in KPI roles** (config.js:302) are
Mechanic·M.Tech·Driver (→ `staff`), Office·Sales (→ `money`); Manager·Admin·Developer carry
their own tiers. Admin-defined roles inherit a tier through `settings.roleMeta`.

### 3.1 Who touches Customers

| Tier | Built-in roles | Customer access (proposed canon) |
|---|---|---|
| **Staff (1)** | Mechanic, M.Tech, Driver | **Operational contact only** — name, phone, address, industry for dispatch/delivery. **No** payment methods, **no** `_digest` spend, **no** `idNumber`, **no** net terms / pay-status dollar amounts. |
| **Money (2)** | Office, Sales | Full CRM: create/edit, funnels, cadence, **payment methods + take payment**, spend digest, net terms, PO. |
| **Manager (3)** | Manager | + override gates (blacklisted account, unsigned-card rental block via the existing `requireAdmin` card-override path). |
| **Admin (4)** | Admin (+ Owner bridge) | + Settings: account-type registry, agreement text, custom-field schema, KPI authoring. |
| **Developer (5)** | Developer | + everything; not a customer-facing distinction here. |

**Conservative default for ambiguous surfaces:** if a surface mixes operational and financial
data, **split it** so Staff get the operational half and the financial half is `canMoney()`-or-
higher gated — do **not** show the whole block to Staff "because it's convenient." Where the
split isn't yet built, the surface stays money-tier until Jac rules otherwise (§11 Q4/Q5).

### 3.2 Gates this area MUST honor (do not loosen silently)

1. **Money gate (`canMoney()`).** The Payment Methods section's add/charge/default/remove
   actions, taking payment, and the spend `_digest` are money-tier. Today `cardTabBody` already
   wraps **only the `+Card` add button** in `canMoney()` (app.js:643) — note the **card *rows*
   themselves (brand, last4, "Make default", "Sign", remove ✕) render unconditionally** today.
   That means a Staff/no-role view currently *reads* last4 + sign-state and can *click* default/
   sign/remove. **This is a gate gap to close:** wrap the whole `paymentMethodsSection` body (and
   the ACH tab) in `canMoney()`, not just the add button. Track as §11 Q5 — do not loosen; tighten.

2. **Card-bound agreement gate.** Any active card lacking a valid signed agreement whose key
   matches `requiredAgreementKey(c)` for the **current account type** blocks On-Rent + delivery.
   The state machine is `cardSignState(c,k)` → `authorized | stale | unsigned` (app.js:295), built
   from `cardCurrentSigning(c,k)` (app.js:283, picks the latest signing whose `key` equals the
   required key) and `cardAuthorized` / `cardComplete` (selfie + signing, app.js:293). This gate
   is **owned here and read by `rentals-dispatch`** (which holds the only blessed override:
   `cardOverrideRental` → `requireAdmin`, backend-verified, logged — `rentals-dispatch.md:152`).
   Account-type change → matching key changes → existing signings become `stale` → re-sign
   required. **No CRM edit may weaken this**; the account-type pills *drive* `cardSignState` and
   must keep doing so. A CRM edit must never silently mark a card `authorized`.

3. **PII handling.** Customer records hold real names, phones, emails, addresses, driver's-
   license/ID numbers, and selfie + signature images. Per the repo's PII guard (CODE-MAP §442)
   and the public-Pages constraint: **no real PII in the repo, seeds, or this spec** (seed rows
   use obviously-fake/demo data; this spec names no real customer). Selfie/signature/agreement
   images **offload to Drive** via `uploadCapture` / `archiveAgreementMedia`; only a downscaled
   thumb (client `downscaleImage`, `frontend-performance`) may ride a cell, never the full image.
   `idNumber` (driver's-license) is **plaintext in the Sheets cell today** and rendered in the
   Account section to any money-tier viewer — **flag for review (§11 Q6):** mask in UI (`••••1234`),
   gate read to manager+, or drop if unused. It must **never** be exported to a public surface.

4. **Blacklisted.** `Blacklisted` is a red account type + customer flag (config.js:265). Setting
   it is a **rental-blocking** action, so it must be **manager+** and **audited** (`blacklistedAt`
   + an `activityLog` entry). It is not currently settable in the UI (§2.8) — wiring it is a gated
   action and a security-sensitive decision that stays on the main session (§11 Q3).

5. **No pricing-floor leak.** The customer card does **not** show `bottomDollar` / margin (those
   live on Categories, admin-gated — `units-fleet.md:110`). Keep it that way. The cadence engine
   and spend chart show **revenue** (`rentalAmt` / `_digest.totalPaid`), never cost or margin, so
   there is no floor to leak today — but any future "profitability per customer" idea would cross
   into margin territory and must be admin-gated, surfaced as an Open Question, not shipped inline.

6. **Customer-isolation.** Every derivation (the `_digest` recompute, the spend chart, cadence,
   any per-customer roll-up) must filter strictly by `customerId`. A wrong join leaks one
   customer's spend/cadence onto another's card — a confidentiality breach, not just a bug. This
   is the **highest-severity correctness gate in the area** (§10). The recompute walks
   `DATA.rentals`/`DATA.invoices` *pre-filtered* on `r.customerId === c.customerId` (mirroring
   `customerMonthly`, app.js:5294) — never an unfiltered reduce.

---

## 4. Data Model

### 4.1 Customer entity (`DATA.customers`, Sheets tab `customers`, `PERSIST_ID = customerId`)

Schema-less: new fields are **additive** — write the key, it round-trips. `migrateCustomers()`
(app.js:96) backfills `firstName/lastName`, folds a legacy single card into `cards[]`, and
repairs colliding card ids.

| Field | Type | Source | Notes |
|---|---|---|---|
| `customerId` | `C0001` str | `nextCustomerId()` | sequential, persist id |
| `firstName` / `lastName` / `name` | str | form / `fullName()` | `name` derived |
| `company`, `phone`, `email`, `address`, `industry` | str | click-to-edit | `phone` required at create |
| `accountType` | enum | pills | `customerAccountType` registry |
| `payStatus` | enum | derived/seed | `customerPayStatus` registry |
| `requiresPO` | bool | forced answer | drives invoice PO gate |
| `rentalProtection` | bool | forced answer | +protection% on rentals |
| `idNumber` | str | form | driver's-license/ID — **PII** |
| `netDays` | int | form | payment terms; `0 = COD`, capped at company max |
| `stripeId` | str | Stripe | customer object id |
| `cards[]` | obj[] | Stripe + signing | `{ id, stripePmId, brand, last4, expMonth, expYear, nickname, notes, isDefault, status, agreement }` |
| `achAccounts[]` | obj[] | Stripe | `{ id, bankName, last4, accountType, verified, isDefault, mandate }` |
| `usedSalesStage` / `membershipStage` | enum | funnels | `funnelStage` order |
| `interestedCategoryIds[]` | str[] | dropdown | category refs |
| `salesAction` | str | sales | next-action hint |
| `activityLog[]` | obj[] | `logAction` | `{ when, text }`; `^Scheduled:` = a follow-up |
| `accountNotes` (+`accountNotesColor`) | str | notes | R12 |
| `custom{}` | obj | custom fields | admin-defined |
| `_digest{}` | obj | **derived (static today)** | see §4.2 |
| membership fields | mixed | memberships area | `paidUntil`, `paidCadence`, `unlimitedTransport`, `paidFees` |

### 4.2 `_digest` (the derived history block)

```js
_digest: { totalPaid, visits, years, avgFrequencyDays, activePct, firstInvoice, lastInvoice }
```

**Proposed derivation (the missing recompute):**

| Field | Formula |
|---|---|
| `totalPaid` | Σ `amountPaid` across this customer's invoices (paid + partial) |
| `visits` | count of distinct rentals (or invoiced events) |
| `years` | `(today − firstInvoice) / 365`, floored |
| `firstInvoice` / `lastInvoice` | min/max invoice `date` for the customer |
| `avgFrequencyDays` | mean gap between consecutive rental start dates (needs ≥2) |
| `activePct` | % of the active window the customer was renting, OR cadence-derived 0–100 |

### 4.3 Card sub-object — `agreement` (source of truth for the signing gate)

```js
agreement: { signedAt: 'ISO', version: 'rental'|'member'|…, signature: <dataURL/Drive>, selfie: <dataURL/Drive> }
```

### 4.4 Relationships (by ID)

- `rental.customerId → customer.customerId` (rentals, cadence, spend chart)
- `invoice.customerId → customer.customerId` (pay status, digest, PO)
- `customer.interestedCategoryIds[] → category.categoryId` (used-sales funnel)
- `customer.stripeId` → Stripe customer object (server-side)

### 4.5 Migration concerns

Additive only. Any new field (e.g. a `mergedInto` tombstone for de-dup, a `blacklistedAt`
audit stamp, a recomputed `_digest`) writes through `reindex('customers', c)` → diff-sync.
**No destructive rename** of `_digest` keys — KPIs and the chart read them by name.

---

## 5. Backend / Integration Contract

Single entry point `backendCall(action, extra)` (app.js:14811), team-password gated, diff-sync
persistence. Customers ride the generic `sync`/`load` path (no per-entity customer action).

### 5.1 Existing actions used by this area

All ride `backendCall(action, extra)` (app.js:14811), team-password gated. Every reply is
`{ ok: true, … }` on success or `{ ok: false, error }` on failure; **the client never coerces a
failure into success** (§5.3). Action names below are the *contracts this area depends on* — the
exact server signatures live in the gitignored `Code.gs` and are owned by `backend-data`; treat
these as the documented interface, not a claim about server internals.

| Action | Used for | Request (extra) → Response (relevant) |
|---|---|---|
| `sync` / `load` | persist/hydrate the `customers` tab (diff-based via `computeChanges`) | `sync`: `{ changes:{customers:{upsert[],delete[]}, … } }` → `{ ok, … }`. `load`: `{}` → `{ ok, data:{ customers:[…] } }` |
| `stripeSetupIntent` | begin add-card (off-session SetupIntent) | `{ customerId }` → `{ ok, clientSecret, stripeId }` |
| `stripeSaveCard` | confirm + persist the card | `{ customerId, stripePmId }` → `{ ok, card:{ id, brand, last4, expMonth, expYear } }` |
| `stripeSetDefault` | set default PM | `{ customerId, stripePmId }` → `{ ok }` |
| `stripeRemoveCard` | detach PM | `{ customerId, stripePmId }` → `{ ok }` |
| `stripeBankSetupIntent`, `stripeSaveBank`, `stripeVerifyBank` | ACH on file (micro-deposit verify) | `{ customerId, … }` → `{ ok, bank{} }` / `{ ok, verified }` |
| `stripePubKey` | fetch the publishable key (falls back to `CFG.STRIPE_PUBLISHABLE_KEY`) | `{}` → `{ ok, pubKey }` |
| `uploadCapture`, `archiveAgreementMedia` | offload selfie/signature/agreement media to Drive | `{ customerId, cardId, kind, dataUrl }` → `{ ok, fileId, url }` |

**Secrets:** the Stripe **secret key** and the team password live server-side only (named, never
valued here). The publishable key arrives via `stripePubKey`; only the publishable key may ever
reach the client. No DEFAULT_CONFIG password, secret, or key appears in this repo (public Pages).

### 5.2 Proposed additive action — `recomputeDigests` (the §2.6 gap)

The recompute can run **client-side** (cheap; the client already holds all rentals/invoices)
on each `load` and after any invoice/rental mutation — **preferred for v1**, no backend change.
If centralizing is wanted later, an additive GAS action:

```
action: 'recomputeDigests'
→ server walks invoices+rentals per customer, writes _digest back to the customers tab
← { ok:true, updated:N }
```

**Performance contract:** the client-side recompute runs **once per `load` in a single pass** —
bucket `DATA.rentals` and `DATA.invoices` by `customerId` first (a `Map`), then derive each
customer's `_digest` from its bucket. Never a per-customer unfiltered `filter`/`reduce` (that's
O(customers × records); see §10). Re-run after any invoice/rental mutation that could move a
customer's numbers, then `reindex('customers', c)` so the diff-sync persists the new digest.

**Open Question (§11 Q1):** client-side recompute (no backend, instant, but every device
recomputes) vs. server-side action (one source, but a round-trip + GAS deploy). Conservative
default: **client-side on load**, mirroring how other derived values already work, with the
single-pass bucketing above.

### 5.3 Failure handling

| Failure | Behavior |
|---|---|
| Stripe SetupIntent/charge declines | Toast the human message; **no `cards[]` mutation**; record never partially commits. The card row only appears after `stripeSaveCard` returns `{ ok, card }`. |
| Drive `uploadCapture` fails | Keep the in-memory downscaled thumb; retry on next save; **never** drop the signing/selfie record just because the upload bounced (the agreement is the gate, the image is evidence). |
| `sync` rejected (bad password / offline) | Client keeps editing in-memory `DATA`; `saveSoon` (1200 ms debounce, `frontend-performance`) re-attempts; multi-user reconciles on next `load`. |
| `recomputeDigests` (if server-side) fails | **Leave the existing `_digest` intact — never zero it.** A stale-but-real digest beats a blanked one (which would flip every customer to "New" and wipe the KPIs). |
| Account-type flip leaves cards `stale` | Surface the `stale` "Re-sign" badge (already shipped, app.js:628); do **not** auto-block silently and do **not** auto-clear the old signing. |

The Stripe **publishable** key is fetched live (`stripePubKey`, app.js:14156) with a graceful
`CFG.STRIPE_PUBLISHABLE_KEY` fallback when offline; `getStripe()` (app.js:14158) toasts rather
than throwing if the library/key isn't ready. No money action proceeds without a confirmed
SetupIntent/PaymentIntent.

---

## 6. UX / UI — yard data-plate language

All new/changed UI runs through `jactec-ui`. Foundation stays the dark steel yard; ranch twist
is mostly voice + the existing tan dashed cadence series.

### 6.1 The customer detail card (canon, light forward edits)

Steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), corner **rivets**, Saira Condensed
stamped section headers (`Account`, `Used Sales`, `Payment Methods`). Safety-orange
(`#ff7a1a`) reserved for the spend area-fill gradient + ignition primary buttons only — never a
status color. Status/flags use R/Y/G per the flag-color system.

### 6.2 Cadence stage chip + chart (canon)

`.ca-stage c-<color>` chip + the spend/days chart. Keep the leather-tan dashed "Days rented"
series — it's the area's signature ranch touch. Voice: "Round up" / "due to rent again" /
"slipping" in copy, never campy.

### 6.2a Payment Methods — gate-visibility fix (NEW behavior on an existing block)

Today only `+Card` is `canMoney()`-wrapped (app.js:643); the card/ACH **rows** render to any
viewer. Reshape `paymentMethodsSection` so that under **sub-money tier the whole block collapses**
to a single stamped line — Saira Condensed, muted: `PAYMENT METHODS · MONEY-TIER` (or simply hide
the section header's count + body). Money-tier and above see the full Cards/ACH tabs unchanged.

- This is a *reshaped* existing block → run through `jactec-ui`; keep the steel panel + rivets.
- **R-rulebook:** the collapsed-state line needs a `data-r` stamp (reuse the gated-section rule if
  one exists, else add `Rxx`); regenerate `rule-usage.js` (`ci/gen-rule-usage.mjs`, drop `--check`).
- No new popup, so **no `WINDOW_CATALOG` change** for this item.

### 6.3 Proposed: Blacklist + account-state action (NEW, gated)

Add `Blacklisted` to the account-type pills (it already exists in `customerAccountType`
config.js:113 but is absent from `NC_ACCOUNT_TYPES` app.js:14040). Setting it fires a **manager+
confirm** — mirror the shipped `requireAdmin` backend-verified path (app.js:10081) with a tier-
checked variant (`requireManager`, §11 Q3). The confirm popup uses the **red hazard-stripe
variant** (`repeating-linear-gradient(135deg, var(--red,#ff4242) 0 13px, #14181d 13px 26px)`),
an explicit "This blocks new rentals for this account" line, and an ignition-style abort/confirm
pair. On confirm: set `accountType='Blacklisted'`, stamp `blacklistedAt` (ISO) + a
`'Blacklisted by <role>'` `activityLog` entry, `reindex('customers', c)`.

- **Soft gate:** blacklisting blocks **new** rentals only; it must **not** retro-cancel live
  rentals (§10). The rental block is read by `rentals-dispatch` via the customer flag.
- **R-rulebook:** the new pill + confirm get `data-r` stamps; regenerate `rule-usage.js`.
- **Is the confirm a catalogued popup?** If it routes through `openOverlay`/`buildPopupEl` it
  **needs a `WINDOW_CATALOG` entry** (e.g. `{ kind:'blacklistConfirm', label:'Blacklist account',
  tag:'Customer · blacklist', sample: … }`) or `ci/check-window-catalog.mjs` fails. A pure inline
  `confirm()`-style guard with no popup kind does not — decide which during build (§11 Q3).

### 6.4 Proposed: Customer merge (NEW popup)

A "Merge duplicate" flow (manager+): pick a survivor + a duplicate, re-point that duplicate's
rentals/invoices to the survivor by ID, tombstone the duplicate (`mergedInto`). Steel popup,
hazard-stripe header, explicit "this can't be undone" line.

- **New popup → REQUIRES a `WINDOW_CATALOG` entry** (`ci/check-window-catalog.mjs` gate). e.g.
  `{ kind:'mergeCustomer', label:'Merge duplicate customer', tag:'Customer · merge', sample: … }`.
- **R-rulebook:** every new element gets a `data-r` stamp; regenerate `rule-usage.js`
  (`ci/gen-rule-usage.mjs`, drop `--check`).

### 6.5 States

- **Empty** — new customer, zeroed `_digest`: cadence reads "No rental cadence yet — needs a
  few rentals to read the pattern" (already shipped, app.js:5344). Funnels at `N/A`.
- **Loading** — card renders from in-memory `DATA`; no per-card spinner (SPA hydration).
- **Error** — failed Stripe action toasts; the customer record never partially commits.

### 6.6 Mobile reflow

Account `split` and `detail-cols` collapse to single column at the M-breakpoints
(`mobile-remote`). Payment-method rows wrap; popup → bottom-sheet. Touch targets respect the
floor. No new gestures proposed.

### 6.7 Existing WINDOW_CATALOG entries owned here (must stay current)

`newCustomer`, `agreement`, `schedule`, `addCard`, `addAch`, `verifyAch` (app.js:9815–9824).
Any new popup (§6.4) adds a row; removing one fails CI.

---

## 7. Business Rules / Derivations / Money

### 7.1 `_digest` recompute (the headline rule — see §4.2)

Must walk only this customer's `DATA.invoices` (`amountPaid`, `date`) and `DATA.rentals`
(`startDate`) — no cross-customer leakage. `totalPaid` counts real money in
(`amountPaid`), not invoiced totals, so it agrees with the Office Collection KPI.

### 7.2 Cadence math (canon — §2.3)

`expDate = lastInvoice + avgFrequencyDays`; `pastPct = 100*(since − f)/f`. Edge cases:
- `f ≤ 0` or no `lastInvoice` → **New** (gray), no expected date.
- Single rental → no frequency → New until a second rental exists.
- Future-dated last invoice (data error) → `since` clamped to ≥0.

### 7.3 Pay status (canon)

`customerPayStatus`: Current(green) / Unpaid(red) / Partial(yellow) / New Customer(blue).
Drives the customer flag (`unpaid-balance`, `partial-balance`) and the rental `unpaid-balance`
flag. **Open Question (§11 Q2):** is `payStatus` a stored field or should it be *derived* from
open invoices like `_digest`? Today it's stored/seeded; deriving it would kill drift.

### 7.4 Card flags (canon)

`cardFlag(c)` (app.js:270) → no-card / unsigned / expiring / expired. Feeds the Payment Methods
header chip and the customer-level `no-card` / `card-expiring` flags (30-day threshold,
flag-color-system §7.5).

### 7.5 Net terms

`netDays` (0 = COD) capped at `companyMaxNetDays()`. Sets invoice due dates downstream
(invoicing-payments). PO requirement (`requiresPO`) forces a PO before invoicing (the white
`.req` "PO #" chip shows only when `cust.requiresPO && !inv.po`). `rentalProtection` mirrors
`requiresPO` exactly (membership-design.md:60) and adds protection % to rentals. Both are
**forced Yes/No answers** at create (`saveNewCustomer`, app.js:14094) — there is no "unset"
that silently defaults to a money-favorable answer.

### 7.6 `idNumber` (driver's-license / ID) — PII rule

Stored plaintext today; rendered in the Account section. Until §11 Q6 is resolved, treat it as
**display-restricted**: do not add it to any export, search blob, KPI, or Wrangler-readable tool
output, and prefer a masked render (`••••` + last 4). It is collected for delivery/agreement
identity verification only; it is not a money field and never gates pricing.

---

## 8. Phasing & Milestones

### Phase 1 — MVP (close the canon gaps)

1. **Live `_digest` recompute** (§4.2, §5.2) — client-side on load + after invoice/rental
   mutation. *Biggest value; unblocks accurate cadence + KPIs.*
2. **Wire `Blacklisted`** into account-type with a manager+ gate (§6.3).
3. **`payStatus` audit** — decide stored vs derived (§7.3) and make it consistent.

**In scope v1:** recompute, blacklist wiring, the gate decisions.
**Out of scope v1:** customer merge, PII export/delete, contact-outcome on follow-ups,
server-side digest action.

### Phase 2 — relationship tooling

- Customer **merge / de-dup** popup (§6.4).
- Scheduled follow-up **outcomes** (Reached / No answer / Booked) logged structurally.
- Per-customer aged-receivables roll-up surfaced on the card (read from Invoices).

### Phase 3 — growth

- Outreach lists from cadence stage (feeds `comms-notifications` / `marketing`).
- Reputation/review request hook (needs the email backend — `comms-notifications`).

---

## 9. Acceptance Criteria

| # | Criterion | Testable check | CI gate |
|---|---|---|---|
| A1 | `_digest` recompute matches a hand-computed fixture | `ci/logic-test.mjs` fixture: customer with N invoices → expected `totalPaid`/`firstInvoice`/`lastInvoice`/`avgFrequencyDays` | `logic-test` |
| A2 | Cadence stage buckets at the exact thresholds (boundaries 0 / 25 / 50 / 100 %) | unit-style assertions on `customerActivity` at `pastPct` = −1, 0, 25, 26, 50, 51, 100, 101 | `logic-test` |
| A3 | **Customer-isolation:** a 2-customer fixture (each with rentals/invoices) → each `_digest` reflects ONLY its own records; swapping `customerId` changes the result | `logic-test` join-filter assertion | `logic-test` |
| A4 | Sub-money tier sees **no** payment-method rows, no `_digest` dollars, no `idNumber` | render under a `staff` role fixture → assert those nodes absent; render under `money` → present | manual on `:9147` (Mechanic vs Office) + (ideally) a role fixture in `logic-test` (none today — coverage gap, §11 Q11) |
| A5 | Unsigned/`stale` card still blocks On-Rent after any CRM edit | edit account-type → assert `cardSignState` flips to `stale`, gate intact; only `cardOverrideRental`+`requireAdmin` unblocks | manual |
| A6 | New popup (merge / blacklist confirm) has a `WINDOW_CATALOG` row | catalog check passes; removing a row fails CI | `check-window-catalog` |
| A7 | New UI elements carry `data-r`; usage regenerated; no duplicate rule | no drift | `gen-rule-usage --check` |
| A8 | No chapter-banner drift if a chapter is added/moved/retitled | code map current | `gen-code-map --check` |
| A9 | App boots + renders Customers card; empty-digest "No rental cadence yet" copy renders | smoke passes on `:9147` | `smoke` |
| A10 | Failed `recomputeDigests` leaves prior `_digest` intact (not zeroed) | inject a recompute error → assert digest unchanged | `logic-test` |

Run gates per CLAUDE.md (swap `8000→9147`, run, `git checkout -- ci/`).

---

## 10. Risks & Edge Cases

- **Digest drift / double-count.** Recompute must use `amountPaid` not totals, and dedupe
  invoices shared across rentals (`rentalIds[]`).
- **Customer-isolation leak.** Any recompute or KPI must filter by `customerId` only — a wrong
  join leaks one customer's spend onto another. Highest-severity correctness risk.
- **PII exposure.** `idNumber` plaintext; selfie/signature must stay Drive-offloaded, never in
  the public repo/seed. A merge that copies media must re-point Drive refs, not duplicate PII.
- **Account-type flip un-signs cards.** Correct behavior (re-sign required) but surprising —
  must surface the `stale` banner, not silently block.
- **Multi-user race.** Two devices editing the same customer → diff-sync last-writer-wins on a
  field; acceptable for contact fields, risky for `cards[]` (use the stable card `id`).
- **Blacklist as a soft gate.** Blacklisting must not retro-cancel live rentals; it blocks new
  ones only.
- **Offline.** Recompute runs on in-memory `DATA`; works offline, re-syncs on reconnect. Because
  it's client-side, two devices that both recompute then `sync` converge to the same value (the
  inputs are the same rentals/invoices), so digest recompute is **not** a multi-user race — but a
  device that recomputes against a *stale* local `DATA` could briefly write an old digest; the
  next `load`+recompute self-heals.
- **Gate gap (shipped):** payment-method rows + `idNumber` currently render below money-tier
  (§3.2.1, §6.2a). Until the wrap lands, a Staff/no-role session **can read last4 and click
  default/sign/remove**. Highest-priority security fix in the area.
- **Demo unlock.** `canMoney()` is open in the `#local`/no-role demo (app.js:14166). A
  screenshot or screen-share of the demo therefore exposes every money/PII surface — new PII
  (e.g. `idNumber`) should mask even in demo (§11 Q12), and the demo must keep using fake seed
  data only.
- **Account-type → blacklist confusion.** `Blacklisted` is both an account *type* and a flag;
  setting it via the type pill must not be confused with the membership account types
  (`Member Incomplete`, §11 Q10) — double-write between CRM and Memberships is a data-integrity
  risk.
- **Digest recompute performance.** Walking `DATA.rentals`+`DATA.invoices` per customer on every
  `load` is O(customers × records). For the current single-yard dataset this is trivial, but the
  recompute should run **once per load over all customers in a single pass** (bucket records by
  `customerId` first), not an N² nested filter, to stay inside the 100 ms render budget
  (`frontend-performance`).

---

## 11. Open Questions

> **Resolved 2026-06-29:** Q4/Q5/Q5b → D1 (full card visible; gate only money *actions*) · Q6 → D2 (idNumber stays plaintext, internal-only) · Q3 → D3 (anyone can blacklist + audit; no UI exists yet) · Q7 → D4 (merge = Phase 2). Adopted: Q1 client-side recompute, Q2 derived payStatus. Q11 reduced to a click-gate check; Q12 dropped (open-visibility posture). See the Decisions block up top.

| # | Question | Trade-off / options |
|---|---|---|
| **Q1** | **Where does `_digest` recompute live?** | *Client-side on load* (no backend, instant, every device recomputes — preferred) vs *server-side `recomputeDigests` action* (one source of truth, but a round-trip + GAS deploy). |
| **Q2** | **Is `payStatus` stored or derived?** | Stored (today; can drift from invoices) vs derived from open invoices (no drift, but a render-time cost + couples CRM to Invoices). |
| **Q3** | **Blacklist gate tier?** | Manager+ (blocks rentals → manager-level) vs Admin-only (safer, fewer hands) vs Money (more convenient, riskier). Default proposed: **manager+** with an audit log entry. |
| **Q4** | **Should Staff see contact fields at all?** | Drivers need phone/address to deliver. Show *operational* contact only (phone/address) but hide digest/payment? Or hide the whole card from Staff? |
| **Q5** | **Payment-method block — gate the whole section or just `+Card`?** | Today only `+Card` is `canMoney()`-wrapped (app.js:643); card/ACH *rows* (last4, default, sign, remove) render to any viewer, and the `#local` demo shows everything. Gate the **whole `paymentMethodsSection` + ACH tab** to money-tier (conservative, closes the read+click gap — **proposed**) vs leave rows visible (status-only) and gate only the *actions* (more info for Staff, but exposes last4). Default: **gate the whole block.** |
| **Q5b** | **Spend digest visibility floor.** | Money-tier only (conservative) vs visible to all (handy for Drivers gauging a "big" account). Default: **money-tier** — Staff get operational contact, not dollars. |
| **Q6** | **`idNumber` (driver's-license) handling.** | Plaintext field today. Mask in UI? Treat as PII-restricted (manager+ to view)? Drop it entirely if unused? |
| **Q7** | **Customer merge — Phase 1 or 2?** | Duplicates are a real CRM pain, but merge is destructive + multi-entity. Defer to Phase 2 (proposed) vs pull forward. |
| **Q8** | **Cadence "Lost" auto-action.** | Should reaching **Lost** auto-create a scheduled win-back follow-up, or stay passive (just the red chip)? Ties into `comms-notifications`. |
| **Q9** | **Scheduled-follow-up outcomes.** | Keep free-text (today) vs add structured outcomes (Reached / Booked / No answer) for funnel reporting. |
| **Q10** | **`Member Incomplete` ownership.** | This account type spans CRM + Memberships. Does CRM render/set it, or is it fully owned by `memberships`? Avoid double-write. |
| **Q11** | **Role-gate CI coverage.** | There is **no role fixture in `logic-test` today** (`units-fleet.md:356` flags the same gap), so A4 (Staff sees no money/PII surface) is **manual-only** — a regression that exposes payment rows or `idNumber` to Staff would ship un-caught. Add a minimal render-under-role fixture to `logic-test` (best, but new test infra) vs accept manual verification (cheaper, riskier on a PII/money gate). Given this gate guards PII + last4, **proposed: add the fixture.** |
| **Q12** | **Demo (`#local`) money-surface exposure.** | `canMoney()` returns `true` for the no-role demo by design (design review). Is that acceptable for any *new* PII surface (e.g. unmasked `idNumber`), or should new PII be hidden even in demo so a screenshot/recording can't leak a real cell? Proposed: **new PII surfaces honor masking even in demo.** |

---

## 12. Dependencies & Sequencing

| Depends on | Why |
|---|---|
| `invoicing-payments` | `_digest.totalPaid`, pay status, PO, net terms; Stripe charging |
| `memberships` | `membershipStage`, member account types, protection/transport entitlements |
| `rentals-dispatch` | reads the card-bound agreement gate + cadence; rentals feed the digest |
| `backend-data` | the `sync`/`load` contract + any additive `recomputeDigests` action |
| `design-system` | flag-color system, R-rulebook stamps, WINDOW_CATALOG gate |
| `wrangler-ai` | Mr. Wrangler create/edit customer action parity |

**Must land first for Phase 1:** the `_digest` derivation decision (§11 Q1) blocks A1/A2 and
the KPIs. The Blacklist + `payStatus` gate decisions (Q2/Q3) should be settled on `main`
(security-sensitive) before delegating the mechanical UI wiring.

**Sequencing note:** keep the agreement-gate and account-type logic on the main session
(touches the rental-blocking gate). The `_digest` recompute and the spend-chart wiring are
well-scoped enough to delegate against this spec once Q1 is answered.
