# Memberships — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/memberships`
**Task branch:** `memberships/spec` (proposed)
**Maturity:** shipped
**Scope:** The customer subscription lifecycle — enroll → bill → entitle → lapse/cancel/reactivate — with member-rate + Unlimited-Transport entitlement gates, Rental Protection, the Cancellation-Invoice mechanic, and per-customer economics.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions.

- **D1 · Auto-renewal = app-driven daily cron (resolves OQ #2; confirms prior art).** Jac: the billing-model decisions were settled last week — see `docs/superpowers/specs/2026-06-25-membership-*` — and he confirms **#1**, the daily Apps Script time-trigger (`membershipBillingCron`), **not** Stripe Subscriptions or lazy-on-open. Phase 2; ships via `/clasp`. Cross-check the prior-art spec before building so this doesn't re-decide what's already settled.
- **D2 · Amend the agreement to "full month, no proration" (resolves OQ #3).** Rather than add a proration branch, change Membership Agreement §2 text (`agreements.js:79`) to **full-month-on-start-date, no first-month proration** — a new agreement version with Jac's sign-off. Code stays as-is; renewals charge a full cycle anchored to the enrollment day. (Resolves the contract-vs-code divergence in the code's favor.)
- **D3 · Auto-renew stays default OFF / opt-in (resolves OQ #5).**
- **D4 · Keep Sales' membership-charge authority (resolves OQ #16 + #1).** Sales (money-tier) keeps Enroll / Cancel / Pay-Cancellation — they close the membership and take the first payment in one motion. Now **server-enforceable** via per-role passwords (`backend-data` D1) so the `canMoney()` gate is real server-side. (Confirm a live login can never have an empty role — the `!currentRole → true` short-circuit is dev/demo only.)
- **D5 · Move membership SIGN-UP into the account-level agreement popup (Jac, 2026-06-29) — placement fix.** Enrollment currently lives as a money-gated pill in the **Membership section of the customer card** (`membershipEnroll` overlay opened from `app.js:3263`). That's the wrong home: **sign-ups should live in the account-level agreement popup windows** (the onboarding/agreement flow — cf. the `customers-crm/signup-agreement-first-invoice` + `onboarding-single-window` work). The Membership card section still **shows** status/badges/economics, but the **Enroll action moves** into the agreement flow at the account level. Re-home the enroll trigger; keep the `membershipEnroll` overlay's internals, just change where it's launched from (and update `WINDOW_CATALOG`/`data-r` as the entry point moves). Coordinate with `customers-crm`.

**Defaults adopted:** grace stays **7-day** (per the agreement) · cron runs under a **narrow system-billing actor** (renewal + lapse only, never arbitrary charges) · **server idempotency** per `(customerId, cycle)` so a retry can't double-charge · economics **never** customer-facing (a future portal shows fees + plan only) · membership revenue **rolls into** the Revenue Goal ring (expected, not a bug) · normalize "Annual"/"Yearly" to one stored term · organic lapse mirrors the manual cancel's Cancellation Invoice exactly.

---

## 1. Goal & Problem

### 1.1 What this area is for

Memberships is JacRentals' **recurring-revenue subscription**. A member pays a flat
**Monthly ($299/mo)** or **Annual ($2,691/yr)** fee that unlocks **member equipment
rates** (`memberDaily`), with two optional add-ons — **Unlimited Transport** (flat
fee, $0 delivery/pickup) and **Rental Protection** (+15% of base, damage coverage).
The program turns a transactional rental customer into a committed 12-month account.

### 1.2 The business problem

Equipment rental margins are thin and demand is seasonal. A membership:

- **Smooths cash flow** — predictable recurring fees instead of lumpy one-off rentals.
- **Locks loyalty** — a 12-month commitment + member-only rates discourages
  shopping competitors mid-season.
- **Subsidizes the discount** — the fee revenue is meant to *more than cover* the
  member-rate discount given away on equipment (the §7 "net program contribution"
  is the scoreboard that proves it).

### 1.3 North star

> Every active member is **net-positive**: the fees they pay exceed the equipment
> discount we give them — and the staff can see that number on the customer card,
> enroll/cancel in one money-gated action, and never accidentally extend member
> pricing to a lapsed account.

---

## 2. Current State (Baseline)

This area is **shipped** (PRs #338 / #342 / #344). This section documents the live
system **as canon** — what exists, where, and what is explicitly deferred.

### 2.1 Shipped — the engine (`app.js:3131–3389`)

| Piece | Symbol | Anchor | Notes |
|---|---|---|---|
| Owner-settable pricing | `MEMBERSHIP_DEFAULTS`, `membershipPricing()` | `app.js:3135–3147` | Reads `mem*` config keys with shipped defaults; repriceable without deploy. |
| Per-cycle fee calculator | `membershipFee({plan, addOns}, pricing)` | `app.js:3152–3162` | Pure; **no proration**; protection = % of **base only**; tax = `TAX_RATE` (10.75%). |
| Lifecycle derivation | `membershipStatus(c)` | `app.js:3171–3181` | 5 states: `None / Incomplete / Active / Past Due / Lapsed`, derived from customer fields. |
| **The entitlement gate** | `isActiveMember(c)` | `app.js:3185` | The ONE gate: member rate + $0 transport apply only to `Active` **or** `Past Due` (in-grace). |
| Rental Protection (rental side) | `rentalProtectionRate()`, `rentalProtectionAmount(r)` | `app.js:3190–3196` | Account-level surcharge = % of the rental's **equipment** subtotal; members **and** non-members. |
| Economics (F7) | `membershipFeeRevenue`, `membershipEconomics`, `membershipEconomicsHtml` | `app.js:3203–3239` | Fee revenue, member-rate vs retail counterfactual, derived discount + net. Internal-only. |
| Cancellation Invoice lookup | `membershipCancellationInvoice(c)` | `app.js:3241–3244` | Finds the outstanding `membershipCancellation` invoice with a balance. |
| Membership card section (F6) | `membershipSectionHtml(c)` | `app.js:3246–3278` | Lifecycle badges, grace countdown, plan/add-on badges, economics, money-gated actions. |
| Enroll/cancel/reactivate orchestration (F5) | `openMembershipEnroll`, `memApplyActive`, `membershipEnrollCommit`, `membershipCancel`, `membershipReactivate` | `app.js:3298–3389` | Demo path (client-side) + PROD path (backend-wired). |
| Enroll overlay UI | `renderOverlay → o.kind === 'membershipEnroll'` | `app.js:8989–9032` | Plan seg, add-on toggles, start date, auto-renew, live tote, ignition Enroll button. |
| `WINDOW_CATALOG` entry | `membershipEnroll` | `app.js:9826` | Catalogued popup (passes `ci/check-window-catalog.mjs`). |
| Action handlers (money-gated) | `js-mem-enroll / js-mem-cancel / js-mem-paycxl / js-me-commit` | `app.js:12418–12424` | Each re-checks `canMoney()` as defence-in-depth; toast "Membership billing is Office/Admin only." on fail. Overlay segs (`js-me-plan/transport/protection/autorenew`) are state-only, ungated. |
| Membership Agreement | `agreements.js → membership` | `agreements.js:71–119` | Printable; auto-selected for member accounts. **Legal basis for recurring billing** lives here: §2 "billed on the first day of each month", §14 "authorizes Jac to … automatically charge recurring membership fees." — the Phase-2 cron rests on this clause. |
| Funnel terminal relabel (F3) | `membershipStage` "Paid"→"Signed" | `app.js:165–168`, `app.js:412–413`, `config.js:143` | "Signed" auto-set by signing the agreement; never manual. |

### 2.2 Customer fields in play (schema-less, on the customer record)

`accountType`, `membershipStage`, `paidCadence`, `paidUntil`, `commitmentStart`,
`commitmentEnd`, `addOns: {transport, protection}`, `autoRenew`, `prepaid`,
`graceUntil`, `unlimitedTransport`, `rentalProtection`, `paidFees` (legacy). See §4.

### 2.3 Config keys (Settings → Company, `mem*`)

`memMonthlyBase`, `memAnnualBase`, `memMonthlyTransport`, `memAnnualTransport`,
`memProtectionPct`, `memProtectionCap`. Defaults in `MEMBERSHIP_DEFAULTS`
(`app.js:3135`); the `memProtectionCap` dollar field renders at `app.js:3558`.

### 2.4 Backend actions (additive, on `backendCall`)

`membershipEnroll`, `membershipCancel`, `membershipReactivate` are **wired and
called** today (`app.js:3334 / 3352 / 3385`). The contract is described in §5.

### 2.5 Explicitly DEFERRED (not built)

| Deferred item | Why / where it goes |
|---|---|
| **Auto-renewal billing cron** (`membershipBillingCron`) | The recurring per-cycle charge is designed (prior-art §5) but **not deployed**. `autoRenew` is captured but no server time-trigger advances `paidUntil`. **This is the single biggest gap** — see §8 Phase 2. |
| **$2,000/mo Rental Protection damage-claim accounting** | Cap is surfaced informationally only; claim draw-down/reset lives on a separate branch `memberships/protection-claims`. |
| **Public website self-enrollment** | Backend actions are designed as a reusable seam; no public UI. |
| **Dunning beyond 7-day grace** | Escalating SMS/email reminders route through `area/comms-notifications`. |

---

## 3. Users, Roles & Data Gates

### 3.1 Roles that touch this area

| Role lens | Can see | Can do |
|---|---|---|
| **Owner / Admin** (`admin` tier) | Everything, incl. economics (§7) | Enroll, Cancel, Pay Cancellation, reprice config (`mem*`) |
| **Manager** (`manager` tier) | Membership section + economics | Enroll, Cancel, Pay Cancellation (≥ money) |
| **Office** (`money` tier) | Membership section + economics | Enroll, Cancel, Pay Cancellation (money actions) |
| **Sales** (`money` tier — see ⚠) | Membership section, funnel, economics (revenue comparison, not margin) | Move funnel stage; **AND today, money actions too** — see §3.2 ⚠ / OQ #16 |
| **Shop / Driver / Mechanic / MTech** (`staff` tier) | Membership badges/status (read), Print Agreement | **Print Agreement only** (not a money action) |

The 15-role set resolves to 5 tiers via `BUILTIN_ROLE_TIERS` + `ROLE_TIERS`
(`config.js:326–347`). `canMoney()` is true for `money` and above (Office, **Sales**,
Manager, Admin, Owner-bridge). Staff-tier roles (Mechanic, MTech, Driver) cannot.

### 3.2 The money gate — `canMoney()`

All three subscription money actions (Enroll, Cancel, Pay Cancellation) are gated by
`canMoney()` (`app.js:14166` — `!currentRole || roleTier(currentRole) >= tierRank('money')`):

> **⚠ LIVE GATE DISCREPANCY (carried to §11 OQ #16).** `canMoney()` is true for the
> **`money`** tier and above. Per `BUILTIN_ROLE_TIERS` (`config.js:342`), **Sales is
> `money` tier** — so a Sales user can run Enroll/Cancel/Pay-Cancellation **today**.
> The prior-art role audit intended membership money actions for **Office + Owner**
> (Admin override separately logged), with Sales limited to the **funnel** only. The
> code is **looser** than the intent. This spec documents the shipped reality
> (Sales = money) **as canon** but does **NOT** bless it — whether Sales should keep
> membership-charge authority is OQ #16. **Do not silently tighten or loosen** —
> Jac decides. (Note: `!currentRole` short-circuits to `true` — a blank/unset role
> is treated as full money authority. Confirm that's intended for the dev/demo path
> and never a live login with no role.)

- **UI gate:** the action pills are only *rendered* for `canMoney()` roles
  (`mayMoney` at `app.js:3263`). **Print Agreement stays visible to every role**
  (not a money action).
- **Handler gate (defence-in-depth):** each handler re-checks `canMoney()` and
  toasts "Membership billing is Office/Admin only." on failure (`app.js:12418–12424`).
- **Server gate (authoritative):** `membershipEnroll/Cancel/Reactivate` MUST
  re-validate the money role server-side (the client gate is convenience only). The
  enroll/reactivate paths reuse the same money-gated charge model as rental charges.
  The client gates (`canMoney()`) are **trivially bypassable** (public Pages, JS in
  the browser) — they are UX, not security. The single source of truth for "may this
  caller move money" is the backend's own check on `backendPassword` + role claim.
- **Cron has NO interactive role (Phase 2).** `membershipBillingCron` runs under the
  Apps Script project's own authority, not a logged-in money-role user. It therefore
  must **NOT** reuse the interactive `canMoney()` path — it needs an explicit
  server-side "system actor" branch that is allowed to charge *recurring renewals
  only* (never an ad-hoc enroll/cancel). Mixing the two is a privilege-escalation
  footgun: a bug that lets the cron path run arbitrary money actions has no human in
  the loop. Spec the system-actor authority narrowly (renewal charge + lapse only).
- **No money action without a charge record.** Every enroll/renew/reactivate charge
  MUST produce an attributed, append-only History entry (actor = role user, or
  `system:billing-cron`) so a money movement is never silent. Decline attempts are
  logged too (`logAction`, `app.js:3314`), so a failed charge is auditable.

> **GATE DECISION (carried to §11):** the UI gate today is `canMoney()` (Office +
> Admin/Owner). The prior-art role audit said "Office + Owner (Admin override
> separately logged)". Confirm whether plain **Admin** should be able to run
> membership charges or only **log an override** — this is an Open Question, not
> silently loosened here.

### 3.3 Customer isolation & PII

- Economics (§7) are **internal-only** — never exposed to the customer self-service
  portal. The `membershipEconomics` derivation (`app.js:3208`) iterates **all**
  `DATA.rentals` for the customer and re-prices a retail counterfactual; if that ever
  rendered customer-side it would leak the program's internal scoreboard. Keep it
  staff-only and exclude it from any portal payload.
- The **future** public self-enrollment seam (§5.6) MUST enforce **server-side
  row-level isolation**: a customer can enroll/pay for **only themselves** and never
  read another account's membership, fees, invoices, or cards. The three actions take
  a `customerId` argument today — server-side, that id MUST be **derived from the
  authenticated session**, never trusted from the request body, or a customer can
  pass another account's id and act on it. (Internally the staff app is trusted, so
  the body `customerId` is fine; the public seam flips that trust model.)
- **PII / card data:** referenced by `stripeId` / card-on-file infra; **no raw PAN**
  is stored or logged anywhere in the membership path. `cardLabel(c)` surfaces only a
  masked label in the enroll gate note (`app.js:9011`). The agreement
  card-authorization clause (`agreements.js:115`, §14) governs how cards are added
  (selfie-while-holding-the-card) and authorizes recurring + balance charges.
- **Customer name / contact** never appears in the economics block or invoice
  rollups — those key only on `customerId`. The membership section renders inside the
  customer's own card, so it inherits that card's existing isolation.

### 3.4 Pricing-floor visibility (T1)

The economics block is **revenue comparison** (member rate vs retail), **NOT** a
margin floor — no Bottom Dollar / True Cost / ROI. So it is **not T1-radioactive**
and is safe on the staff Standard view. The retail counterfactual is derived from
the public retail tiers, exposing nothing about cost. **Do not** add cost/margin
figures to this block without a fresh `/role` audit.

---

## 4. Data Model

All membership state lives as **additive JSON keys on the customer record**
(schema-less Sheets — **no migration**). Invoices carry membership markers.

### 4.1 Customer record — membership fields

| Field | Type | Set by | Meaning |
|---|---|---|---|
| `accountType` | string | enroll / lapse | `Non-Business Member` / `Business Member` ⇄ `Member Incomplete` ⇄ non-member. **The pricing gate keys off this** (`isActiveMember` → `membershipStatus` → `/Member/.test(accountType)`). |
| `membershipStage` | string (`funnelStage` set) | funnel / agreement signing | Sales funnel label. Terminal = **"Signed"** (auto-set, never manual). |
| `paidCadence` | `'Monthly'` \| `'Yearly'` | enroll | Billing cadence (note: enroll maps UI "Annual" → stored "Yearly"). |
| `paidUntil` | ISO `YYYY-MM-DD` | enroll / charge | Paid-through date. **Active** iff `paidUntil >= TODAY_ISO`. |
| `commitmentStart` / `commitmentEnd` | ISO | enroll | 12-month window (`MEMBERSHIP_MONTHS = 12`). |
| `addOns` | `{transport:bool, protection:bool}` | enroll | Drives invoice lines + the entitlement flags. |
| `autoRenew` | bool | enroll | Captured; default OFF. **No cron consumes it yet** (§2.5). |
| `prepaid` | bool | reactivation | When true → **Active** regardless of `paidUntil`; rides to term, no further charges. |
| `graceUntil` | ISO | charge-fail / cancel | 7-day grace deadline. In-grace → **Past Due** (rates kept). |
| `unlimitedTransport` | bool | enroll (transport add-on) | $0-transport entitlement flag. **Only honored when `isActiveMember`** (`app.js:909,915`). |
| `rentalProtection` | bool | enroll (protection add-on) OR account toggle | Account-level; **independent of membership** — NOT cleared on lapse (protection is never free). |
| `paidFees` | number (legacy) | seed | Fallback for `membershipFeeRevenue` when no membership invoices exist. |

> **Grandfathering (live behavior):** `membershipStatus` returns `Active` for a
> `Member` account with **no** `paidUntil/paidCadence/commitmentEnd` — legacy members
> keep their rate (`app.js:3176`). Preserve this.

### 4.2 Invoice record — membership markers

| Field | Type | Meaning |
|---|---|---|
| `membership` | bool | This invoice is a membership-fee invoice (counts in fee-revenue rollup). |
| `membershipCancellation` | bool | This invoice is the §6 Cancellation Invoice. |
| `lineItems[].kind` | `'membership'` | Identifies membership lines for the §7 economics + revenue rollup. |

Built by `buildMembershipInvoice(c, lines, {cancellation, date, due})` (`app.js:3292`).

### 4.3 Relationships (by ID)

- Customer `customerId` ← invoices `invoice.customerId` (membership + cancellation).
- Customer `addOns.transport` → `unlimitedTransport` flag → `computeTransportPrice`.
- Customer `rentalProtection` → per-rental `rentalProtectionAmount(r)` line.
- Category `memberDaily` ← gated by `isActiveMember(cust)` in the rental price path.

### 4.4 Migration concerns

Schema-less — **no DDL migration**. The only "migration" shipped is the funnel
relabel `Paid → Signed` (`app.js:168`, idempotent on load). New fields default to
absent and are read defensively (`num(...)`, `!!c.x`).

---

## 5. Backend / Integration Contract

Backend = Google Apps Script + schema-less Sheets, deployed by **clasp** (`Code.gs`
gitignored). All membership behavior is **additive actions on `backendCall`**.
Client mirrors the money math for live UI; **the backend recomputes
authoritatively at charge time** (`app.js:3151` comment).

### 5.1 `membershipEnroll` (shipped)

Request (`app.js:3334`):
```
backendCall('membershipEnroll', {
  customerId, plan: 'Monthly'|'Yearly', addOns: {transport, protection},
  startDate, autoRenew
})
```
Response (consumed at `app.js:3336–3341`):
```
{ ok: true, status: 'active', paidUntil: 'YYYY-MM-DD', charge: {...} }      // success → Active
{ ok: true|false, status: 'incomplete', charge: {decline...} }              // decline → stays Member Incomplete
```
- Server: recompute fee (base + add-ons + tax) from **server-side** `mem*` config
  (never trust the client total); create membership invoice; charge saved default
  card via the existing money-gated `stripeChargeInvoice` model; on cleared charge set
  protected fields (`paidUntil`, `accountType`, `commitmentStart/End`, `addOns`,
  `autoRenew`) and return `status:'active'` with the authoritative `paidUntil`. On
  decline, leave **Member Incomplete** + UNPAID invoice.
- **Idempotency (must spec):** a double-submit (network retry, double-tap) must NOT
  double-charge. The client has a `busy` guard (`app.js:3321`) but that is not
  authoritative. Server: key enrollment by `(customerId, startDate)` (or a
  client-supplied idempotency token) — if an UNPAID membership invoice for that cycle
  already exists, re-attempt the charge on **it** rather than creating a second.
- **Protected fields:** `paidUntil` / `graceUntil` / `accountType` are
  server-authoritative — the client sets them optimistically for an immediate UI
  (`memApplyActive`, `app.js:3305`) but they round-trip and the backend wins on the
  next sync. A spoofed client cannot grant itself member pricing because the gate
  re-derives from these fields and the backend overwrites them.
- **Failure handling (client):** `friendlyPayErr` surfaces a decline (`app.js:3341`);
  account stays Incomplete; overlay re-enables with the error. A thrown/network error
  shows "Network error — try again." and leaves state untouched (no optimistic flip).

### 5.2 `membershipCancel` (shipped)

Request (`app.js:3352`): `{ customerId }`.
Response (consumed `app.js:3353`): `{ ok, cancellationInvoiceId? }`.
- Server: expire `paidUntil`/`graceUntil` (→ derives `Lapsed`); for a **Monthly**
  mid-commitment member, drop a Cancellation Invoice and return its id. Revert
  pricing via the `accountType` gate. **Do NOT clear `rentalProtection`.**

### 5.3 `membershipReactivate` (shipped)

Request (`app.js:3385`): `{ customerId, invoiceId }`.
Response (consumed `app.js:3386`): `{ ok, status:'active', charge }`.
- Server: charge the Cancellation Invoice **in full** (single transaction); on
  success set `accountType` back to Member, `paidUntil = commitmentEnd`,
  `prepaid = true` (rides to term, no further charges).

### 5.4 `membershipBillingCron` (PROPOSED — Phase 2, not built)

A daily Apps Script **time-trigger** (additive, ships via `/clasp`):
1. Find members where `paidUntil <= today` AND `prepaid !== true`.
2. Build the cycle's itemized membership invoice (base + transport? + protection? + tax).
3. Charge the saved default card (same money model; runs under the **project's own
   authority** — cron has no interactive role).
4. **Success** → mark paid, advance `paidUntil` (+1mo/+1yr), append attributed
   History; at month-12 apply the `autoRenew` rule.
5. **Failure** → leave invoice UNPAID, flip **Past Due**, set `graceUntil = today+7d`;
   retry daily; grace expired → **Lapse** (atomic: flip `accountType`, clear
   `unlimitedTransport`, generate Cancellation Invoice; keep `rentalProtection`).

**Cron safety requirements (must spec, all are security/data-integrity gates):**

- **Idempotent per cycle.** The cron may fire late, twice, or after a partial run.
  Charge keyed by `(customerId, cycle-period)` — one membership invoice per cycle;
  if this cycle's invoice exists, re-attempt **it**, never create a second. `paidUntil`
  advances **only** on a *cleared* charge, so a re-run cannot double-advance.
- **Atomic lapse.** The lapse transition (flip `accountType`, clear
  `unlimitedTransport`, drop Cancellation Invoice) must be one server transaction —
  a half-applied lapse that flips `accountType` but leaves `unlimitedTransport` true
  would still leak $0 transport. The `isActiveMember` gate guards the rate, but
  belt-and-suspenders: clear the entitlement flags too.
- **System-actor authority only (see §3.2).** The cron charges under the project's own
  authority via a narrow "system billing" branch — *renewal charge + lapse only*,
  never enroll/cancel. It must not be reachable from the interactive `backendCall`
  surface.
- **Parity with manual cancel.** The organic-lapse path must produce the **same**
  Cancellation Invoice a manual `membershipCancel` would (Monthly mid-commitment only;
  Annual already prepaid → none). See OQ #6.
- **Bounded retries.** Daily retry only while `graceUntil >= today`; once grace
  expires, stop retrying and lapse (no infinite charge loop on a dead card).

> **Open Question (§11):** cron vs. on-open lazy billing vs. Stripe-subscription
> webhooks. Prior art chose app-driven cron (no webhooks). Confirm before building.

### 5.5 External integrations

| Integration | Use | Notes |
|---|---|---|
| **Stripe** | Charge the saved card on enroll / reactivate / (future) renewal | Reuses the existing `stripeChargeInvoice` money path; **no new Stripe surface** in Phases 1–2 unless OQ #2 picks the webhook fork. Secrets (the Stripe key) live server-side in `Code.gs` only — never the repo. |
| **Google Maps** | (indirect) Unlimited-Transport zeroes `computeTransportPrice` | No direct membership call. |
| **SMS/Email** | (deferred) Dunning reminders | Out of scope; `area/comms-notifications`. |

**Stripe failure modes (charge path):** (1) **card_declined / insufficient_funds**
→ no `paidUntil` advance, invoice stays UNPAID, account stays Incomplete (enroll) or
flips Past Due (renewal). (2) **network/timeout** → treat as UNKNOWN: do NOT assume
success; the next cron pass / next open re-checks the invoice's real paid state from
Stripe before re-charging (avoid double-charge on an ambiguous timeout). (3)
**expired card / no card on file** → blocked *before* the call (`hasValidCard`,
`app.js:3319/3378`) with a yellow gate note (enroll) or toast (reactivate). Never
surface raw Stripe error codes to staff — `friendlyPayErr` maps them to plain copy.

### 5.6 Self-enrollment isolation seam (forward-looking)

The three actions are designed so a future **public website** can call them. The
seam **requires server-side row-level isolation now** even though no public UI ships:
a caller may act on **only its own** `customerId`; never read another account.

### 5.7 Demo vs. PROD branching

`memIsDemo()` (`app.js:3302`, true when no `backendPassword`) takes a **client-side**
path: builds the invoice locally, marks it paid (`Card (demo)`), applies Active
fields. PROD calls the backend. Both end in the same local `memApplyActive` state so
the UI is identical. Preserve this dual-path for offline/demo builds.

---

## 6. UX / UI

All membership UI is in the **yard data-plate** language: dark steel panels, ONE
safety-orange (`--accent #ff7a1a`) accent reserved for the **ignition** Enroll
button, hi-vis hazard stripe for danger, Saira Condensed stamped caps for labels,
corner rivets, with a **light ranch seasoning in the copy** ("Saddle Up — Enroll",
"Membership active — saddle up! ✓").

### 6.1 Membership section on the customer card (F6, `app.js:3246`)

```
┌─ MEMBERSHIP ──────────────────────────────┐
│   [ Signed ]            ← funnel pill       │
│   [ Active Member ]     ← green state badge │
│   ⚠ Canceled in 4 days  ← red grace flag    │  (Past Due only)
│   Jun 15, 2027 · paid until                 │
│   [Paid Monthly][Unlimited Transport]       │  ← plan badges
│   [Protected][Auto-Renew]                   │
│   $897 membership fees   (derived)          │  ← §7 economics
│   $4,210 member-rate rentals (derived)      │
│   …                                         │
│   [ Saddle Up — Enroll ] [ Cancel ]         │  ← money-gated pills
│   [ Pay Cancellation $1,240 ] [Print Agmt]  │
└────────────────────────────────────────────┘
```

State badges (`app.js:3251–3254`):

| Status | Badge | Color |
|---|---|---|
| Active | "Active Member" | green |
| Past Due | "Past Due" + "⚠ Canceled in N days" | yellow + red |
| Lapsed | "Lapsed" | red |
| Incomplete | "Member Incomplete" | yellow |
| None | — | (Enroll action only) |

### 6.2 Enrollment overlay (`app.js:8989`, `WINDOW_CATALOG: membershipEnroll`)

- Width 430px; `popupShell` titled **"Saddle Up — Membership"**, tag "Customer · enroll".
- **Plan** segmented control (Monthly / Annual), green-on.
- **Unlimited Transport** + **Rental Protection** Yes/No segs showing the live price.
  Transport seg follows the selected plan (`$500/mo` Monthly / `$4,500/yr` Annual,
  `app.js:9006`); Protection seg shows `15% of base` (`app.js:9007`). Both read
  Owner-set `mem*` config, not hardcoded.
- **Auto-Renew at term end** Yes/No (navy-on).
- **Start date** date field (default today; future allowed; no proration).
- **Live tote**: base, transport, protection, tax (10.75%), **First charge** total.
- **Gate note**: charges `<cardLabel>` now; warns if the agreement isn't signed;
  yellow warning if **no valid card on file** (disables the commit button).
- **Footer**: ghost **Cancel** (`data-r="R18"`) + ignition **Enroll & Charge $X**
  (`data-r="R17"`), disabled while `!ready || busy`, shows "Charging…".

### 6.3 States

| State | Treatment |
|---|---|
| Empty (non-member) | Only the "Saddle Up — Enroll" pill (if `canMoney`). |
| No valid card | Enroll overlay shows yellow gate note + disabled commit. |
| Charging | Commit button "Charging…", `busy` disables interaction. |
| Decline | Inline `set-err` in overlay; account stays Incomplete. |
| Network error | Overlay re-enables with "Network error — try again." |
| Past Due (in grace) | Red countdown flag on the card; rates still honored. |
| Lapsed | Red "Lapsed" badge; Enroll re-offered; Cancellation Invoice action. |

### 6.4 Mobile reflow

The Membership section sits inside the customer card's `fieldstack centered`; it
already reflows in the 3-column → single-column phone layout (per `/jactec-ui`
mobile rules). The enroll overlay (430px) becomes a bottom-sheet on phones; verify
the segmented controls stay tap-comfortable (≥44px targets) and the tote stays legible.

### 6.5 R-Rulebook + WINDOW_CATALOG obligations

- The enroll overlay is **already catalogued** (`membershipEnroll`, `app.js:9826`,
  the only membership popup today). **Any new popup MUST be added to
  `WINDOW_CATALOG`** or `ci/check-window-catalog.mjs` fails CI. Concretely, the
  Phase-2 **renewal-confirm dialog** and any Phase-3 **protection-claim** popup each
  need their own catalog entry (with a `sample()` factory like the enroll one) the
  same PR they're added.
- All membership UI elements carry `data-r` stamps (commit/ignition Enroll =
  `R17` at `app.js:9029`; ghost Cancel = `R18` at `app.js:9028`; action pills via
  `actionPill`; badges via `badge`/`kvPills`; date field via `dateField`). **Any
  new/changed element MUST carry a `data-r` stamp**, and `rule-usage.js` MUST be
  regenerated (`node ci/gen-rule-usage.mjs`, drop `--check`) or the `--check` drift
  guard + duplicate-rule guard fail CI. New UI built outside an existing stamped
  builder must be run through `/jactec-ui` so it lands in the yard data-plate
  language **and** gets the right stamp — not bolted on after.

---

## 7. Business Rules / Derivations / Money

### 7.1 Fee formula (`membershipFee`, `app.js:3152`)

```
annual      = plan ∈ {Yearly, Annual}
base        = annual ? annualBase : monthlyBase
transport   = addOns.transport ? (annual ? annualTransport : monthlyTransport) : 0
protection  = addOns.protection ? round2(base × protectionPct/100) : 0   ← BASE only, excludes transport
subtotal    = round2(base + transport + protection)
tax         = round2(subtotal × TAX_RATE)        ← TAX_RATE = 10.75%
total       = round2(subtotal + tax)
```
**No proration** (code path). First charge = full plan amount on the start date.
Worked example (Monthly + both add-ons): 299 + 500 + (15% × 299 = 44.85) = **843.85**
subtotal + 10.75% tax = **$934.57** first charge.

> **⚠ Code↔Agreement conflict (carried to §11 OQ #3).** The signed Membership
> Agreement (`agreements.js:79`, §2) states the Monthly plan is *"billed on the
> first day of each month, **first month pro-rated by enrollment date**."* The
> shipped `membershipFee` does **NOT** prorate — it charges a full month on any
> start date. Today this is masked (most enrollments start same-day), but it is a
> live contract-vs-code divergence. Phase 2 renewal billing forces the decision:
> honor the agreement (prorate the first cycle) or amend the agreement text to
> match the code. Do **not** silently pick one — surfaced as an Open Question.

Default transport prices (Owner-repriceable `mem*` config): **Monthly $500/mo**,
**Annual $4,500/yr** (`MEMBERSHIP_DEFAULTS`, `app.js:3135`).

### 7.2 Lifecycle derivation (`membershipStatus`, `app.js:3171`)

```
not /Member/.test(accountType)                          → None
accountType === 'Member Incomplete'                     → Incomplete
no paidUntil & no paidCadence & no commitmentEnd        → Active   (legacy/grandfathered)
prepaid === true                                        → Active   (rode-to-term)
paidUntil >= TODAY_ISO                                  → Active
graceUntil >= TODAY_ISO                                 → Past Due (rates KEPT)
otherwise                                               → Lapsed
```
ISO date strings compare lexically — direct `>=` is valid for `YYYY-MM-DD`.

### 7.3 The entitlement gate (`isActiveMember`, `app.js:3185`)

`isActiveMember = status ∈ {Active, Past Due}`. Used in **both** the quote and the
invoice line:
- **Member equipment rate** (`memberDaily`) only when `isActiveMember` (`app.js:842`).
- **$0 Unlimited Transport** only when `unlimitedTransport && isActiveMember`
  (`app.js:909, 915`).
- **Refused to Incomplete and Lapsed.** Past Due keeps rates through the 7-day grace.

### 7.4 Rental Protection (rental side, `rentalProtectionAmount`, `app.js:3191`)

```
amount = round2( sum(rental equipment line amounts) × protectionPct/100 )   when cust.rentalProtection
```
- **% of the EQUIPMENT subtotal only** — excludes transport + other surcharges.
- Taxable like a rental line.
- Account-level: applies to members **and** non-members; **not cleared on lapse**.
- When OFF, rentals surface a "Protection off / not enabled" reminder
  (`app.js:5765, 13140` — mirrors the PO advisory).

### 7.5 Cancellation Invoice (`app.js:3361–3366`)

For a **Monthly** member, mid-commitment (`commitmentEnd` set, not prepaid):
```
remainingMonths = monthsRemaining(commitmentEnd)
cancellationAmount = round2( membershipFee(Monthly, currentAddOns).subtotal × remainingMonths )
```
- Sits on the account; **never auto-charged** (the agreement does not pursue it).
- **Annual** members already prepaid → **no Cancellation Invoice**.
- Reactivation = pay it **in full** → `prepaid = true`, `paidUntil = commitmentEnd`.

### 7.6 Economics (`membershipEconomics`, `app.js:3208`)

| Figure | Derivation |
|---|---|
| `feeRevenue` | Σ paid membership invoices' `amountPaid` (fallback `paidFees`). |
| `memberRev` | Σ rental days × `category.memberDaily` (actual member-rate equipment rev). |
| `retailRev` | Same rentals re-priced via `rentalPrice({customerId:'__retail__'})` (retail tiers). |
| `discount` (derived) | `retailRev − memberRev` — what the member rate gave away. |
| `net` (derived) | `feeRevenue − discount` — is this member net-positive? |

Counterfactual is **derived on the fly** (nothing extra stored). Equipment-rate only —
excludes transport & protection.

### 7.7 Edge cases

- **Decline at enrollment** → invoice UNPAID, account **Member Incomplete** (not Active).
- **Voided units** excluded from economics (`unitVoided` guard, `app.js:3215`).
- **Legacy member, no sub data** → grandfathered Active (keep their rate).
- **Past Due → unit failed / unpaid** flags can stack red on the card (flag system).
- **Reactivation without a valid card** → blocked with a toast (`app.js:3378`).
- **`memProtectionCap` ($2,000/mo)** is informational only in v1 (no claim draw-down).

---

## 8. Phasing & Milestones

### Phase 1 — SHIPPED (canon)
Enrollment overlay, fee calculator, 5-state lifecycle, entitlement gate, Rental
Protection (rental side + account toggle), economics block, Cancellation-Invoice +
reactivation, funnel "Signed" relabel, backend-wired enroll/cancel/reactivate,
demo + PROD dual path.

### Phase 2 — Auto-renewal billing (PROPOSED, the headline gap)
- `membershipBillingCron` daily time-trigger (§5.4): per-cycle invoice + charge,
  `paidUntil` advance, Past Due → grace → Lapse automation, `autoRenew` roll at term.
- Attributed, append-only History on **every** charge (success AND decline) +
  cron actor attribution.
- Renewal prompt on the card when `autoRenew` OFF and term complete.
- **In scope:** server-side billing math, retry-during-grace, atomic lapse.
- **Out of scope:** SMS/email dunning (→ comms), webhook-based Stripe subscriptions.

### Phase 3 — Protection claims (`memberships/protection-claims`)
- Damage-claim recording, draw-down against the $2,000/mo cap, monthly reset/rollover.

### Phase 4 — Public self-enrollment (web)
- Reuse the enroll/reactivate actions behind a public, row-isolated web surface.

---

## 9. Acceptance Criteria

### 9.1 Engine (testable, `ci/logic-test.mjs` candidates)
- [ ] `membershipFee` matches §7.1 for all plan × add-on combinations to the cent.
- [ ] Protection = % of **base only** (transport excluded) — assert with transport ON.
- [ ] `membershipStatus` returns the correct state for each of the 6 branches in §7.2.
- [ ] `isActiveMember` is true **only** for Active + Past Due; false for Incomplete/Lapsed.
- [ ] `rentalProtectionAmount` = % of equipment subtotal only (transport excluded).
- [ ] Cancellation amount = monthly subtotal × remaining months (Monthly only; Annual = $0).
- [ ] Economics: `discount = retailRev − memberRev`, `net = feeRevenue − discount`.

### 9.2 UI / gates
- [ ] Enroll/Cancel/Pay-Cancellation pills render **only** for `canMoney()` roles.
- [ ] Each handler re-checks `canMoney()` (defence-in-depth) and toasts on failure.
- [ ] Print Agreement is visible to **every** role (not a money action).
- [ ] Enroll commit is disabled without a valid card on file.
- [ ] Lapsed account prices **rentals at retail** (gate reverts via `accountType`).
- [ ] Past Due (in-grace) account still prices at **member rate**.
- [ ] `unlimitedTransport` true but membership lapsed → transport prices at **full
      rate** (gate is `unlimitedTransport && isActiveMember`, not the flag alone).
- [ ] Incomplete account (decline at enroll) prices rentals at **retail** (refused).
- [ ] Demo (`memIsDemo`) and PROD enroll paths both end at the same Active local state.

### 9.2b Gate / security (NOT auto-testable in CI — manual `/role` audit before ship)
- [ ] Server recomputes the fee from server-side `mem*` config; a client posting a
      tampered total cannot under-charge (verified against `Code.gs`, not the SPA).
- [ ] Server derives `customerId` from the session on the public seam (not the body).
- [ ] Phase-2 cron cannot be invoked from the interactive `backendCall` surface.
- [ ] Economics figures never appear in any customer-facing payload.

### 9.3 CI-gate impact
- [ ] `node ci/gen-rule-usage.mjs --check` — any new/changed UI element stamped + regenerated.
- [ ] `node ci/check-window-catalog.mjs` — `membershipEnroll` catalogued; any new popup added.
- [ ] `node ci/smoke.mjs` — app boots, membership section renders without error.
- [ ] `node tools/gen-code-map.mjs --check` — if a chapter banner moves (Phase 2 cron in `Code.gs` won't, but any app.js chapter retitle must regen).

---

## 10. Risks & Edge Cases

| Risk | Mitigation |
|---|---|
| **Client fakes the membership fee** | Backend recomputes the charge from server-side `mem*` config; client math is display-only. |
| **Entitlement leaks to a lapsed account** | Single `isActiveMember` gate, checked in quote **and** invoice line; lapse flips `accountType` → gate reverts automatically. Never gate on "flag present." |
| **Lapse leaves stale state** | Lapse must be **atomic** (one server transaction): flip `accountType`, clear `unlimitedTransport`, drop Cancellation Invoice — keep `rentalProtection`. |
| **Double-charge on enroll retry** | `busy` guard client-side; server idempotency on enroll (one invoice per cycle/start). |
| **Cron charges a member twice / on the wrong day** | `paidUntil <= today && prepaid !== true` filter; advance `paidUntil` only on cleared charge; retry, don't re-create. |
| **Protection cap silently overspent** | v1 informational only; claim accounting deferred (Phase 3) — do NOT imply coverage tracking we don't have. |
| **Economics exposes margin** | §3.4 — revenue comparison only; re-audit before adding any cost figure. |
| **Offline/demo divergence** | `memIsDemo` dual path lands in the same local state; keep parity when changing either branch. |
| **Funnel "Signed" set by hand** | "Signed" is agreement-driven only (`app.js:412`); keep it out of the manual dropdown. |
| **Self-enroll cross-account read (future)** | Row-level isolation enforced server-side in the shared actions **now**; `customerId` derived from the session, never the request body. |
| **Code↔agreement proration divergence** | Code charges full-month; signed agreement promises first-month proration (`agreements.js:79`). A member who notices could dispute the first charge. Resolve OQ #3 (prorate vs amend the agreement) before Phase 2 renewals make it recurring. |
| **Multi-user concurrent edit** | Two staff enrolling/cancelling the same customer at once: the diff-sync layer (`backend-data`) is last-write-wins on the customer row. Membership writes touch `accountType`/`paidUntil`/`graceUntil`; a concurrent unrelated edit could clobber. Mitigation: the server is authoritative on the protected fields and re-derives on next poll; keep membership writes to the minimal field set. |
| **Offline enroll** | `memIsDemo`/offline marks the invoice paid locally with `Card (demo)`; a real charge never happened. This is correct for demo builds but MUST NOT run against a real customer with `backendPassword` unset by accident — the `memIsDemo()` gate keys on `backendPassword`, so a misconfigured PROD build is the risk. Verify `backendPassword` is set in any live deploy. |
| **Stale UI after successful charge** | Optimistic local apply + a lost response can briefly show non-member while the backend is Active (OQ #15). Next poll reconciles; flagged as an Open Question for an explicit refetch. |
| **Performance: economics is O(rentals × units)** | `membershipEconomics` re-prices every rental's retail counterfactual on each card render. Fine at current volume; for a heavy account it recomputes on every re-render. If it shows up in the 100ms render budget (`frontend-performance`), memoize per customer per data-version. |

---

## 11. Open Questions

> **Resolved 2026-06-29:** OQ #2 → D1 (cron; prior-art decided) · OQ #3 → D2 (amend agreement, no proration) · OQ #5 → D3 (auto-renew OFF) · OQ #16/#1 → D4 (keep Sales authority, now server-enforced) · **+ D5 placement fix (sign-up moves to the account-level agreement popup).** Adopted: grace 7d, narrow cron actor, server idempotency, economics never customer-facing, revenue rolls into the ring. See the Decisions block up top.

1. **Admin vs. Office money authority.** UI gate today is `canMoney()` (the `money`
   tier and above — Office, **Sales** (see OQ #16), Manager, Admin, Owner-bridge).
   Prior-art audit said "Office + Owner, Admin override separately logged." Should
   plain **Admin** be able to *initiate* a membership charge, or only *log an
   override*? (Trade-off: tighter audit vs. operational flexibility when Office is
   out.) **— surface, don't silently loosen.** (The specific Sales-tier inclusion is
   OQ #16.)

2. **Billing automation model (Phase 2).** Three forks:
   (a) app-driven daily **cron** (prior-art choice, no webhooks, simple, but charges
   only run when the script trigger fires);
   (b) **lazy on-open** billing (charge when staff opens the account — no trigger,
   but unpredictable timing);
   (c) **Stripe Subscriptions + webhooks** (Stripe owns recurrence/dunning, but adds
   a webhook surface + reconciliation with our invoice records). Which?

3. **Proration — code contradicts the signed agreement.** The shipped `membershipFee`
   charges a **full month on any start date (no proration)**, but the Membership
   Agreement §2 (`agreements.js:79`) the customer signs says the Monthly plan is
   *"billed on the first day of each month, first month pro-rated by enrollment date."*
   This is a live contract-vs-code divergence (masked today because most enrollments
   start same-day). Two fixes, pick one: **(a)** implement first-cycle proration so the
   code honors the signed text (more correct, but adds a proration branch + a partial
   `paidUntil`); **(b)** amend the agreement text to "full month, no proration"
   (simpler code, but changes the customer contract — needs Jac's sign-off and a new
   agreement version). Phase 2 renewal billing forces this: are renewals full-charge
   each cycle with `paidUntil` anchored to the enrollment day, or calendar-month
   aligned with a prorated first cycle? **Surface, don't silently pick.**

4. **Grace length.** Hardcoded **7 days** (`graceUntil = today + 7d`, matches the
   agreement). Should this be Owner-settable like the `mem*` prices, or stay fixed
   to the signed agreement text?

5. **Auto-renew default.** Captured as **OFF** at enrollment. Is OFF the right
   default, or should the 12-month commitment imply auto-renew ON with an opt-out?

6. **Cancellation Invoice on a non-prepaid Monthly that already lapsed.** Today cancel
   for a Monthly mid-commitment drops the invoice. Does **organic lapse** (cron, grace
   expired) also drop it (prior-art §4 says yes) — confirm the cron path mirrors the
   manual `membershipCancel` exactly.

7. **`rentalProtection` persistence on lapse.** Confirmed kept (never free). Should
   there be **any** UI affordance to auto-prompt turning it off when a member lapses,
   or strictly manual?

8. **Protection cap reset boundary (Phase 3).** "$2,000/mo" — calendar month, rolling
   30-day, or membership-cycle month? Affects claim accounting design.

9. **Economics in the funnel/KPI rollup.** Prior art says membership fee + member-rate
   rental revenue roll into the **$150k Revenue Goal** ring; the counterfactual/derived
   figures do **not**. Confirm the ring is expected to move (so it's not read as a bug).

10. **Self-enrollment scope.** Is the public web self-enrollment (Phase 4) actually
    wanted, or should the isolation seam requirement (§5.6) be dropped to simplify the
    backend until/unless that's a real roadmap item?

11. **"Annual" vs "Yearly" naming.** UI says "Annual"; stored `paidCadence` is "Yearly";
    backend payload maps to "Yearly". Harmless today but a footgun — normalize to one
    term, or document the mapping permanently?

12. **Enroll idempotency token — who owns it?** A double-tap or network retry could
    create two membership invoices / two charges. Should the **client** mint an
    idempotency token passed to `membershipEnroll`, or should the **server** dedupe by
    `(customerId, startDate, cycle)`? (Trade-off: client token is simplest and works
    offline-to-online, but a buggy client could reuse it across customers; server-side
    keying is authoritative but needs the server to read existing invoices first.)
    Same question applies to the Phase-2 cron's per-cycle keying.

13. **System-actor authority shape (Phase 2).** The cron must charge without an
    interactive money-role user (§3.2). Do we (a) give the Apps Script project a
    dedicated narrow "billing-system" capability that can ONLY run renewal-charge +
    lapse, or (b) reuse the money path with a synthetic actor flag? (a) is safer
    (smaller blast radius if the cron has a bug) but more code; (b) is less code but
    risks the cron path drifting into arbitrary money actions. Security call — stays
    on main, not delegable.

14. **Economics block & a future customer portal.** `membershipEconomics` exposes the
    internal program scoreboard (fee revenue vs derived member discount vs net). It is
    staff-only today. If the Phase-4 portal ever shows the member *anything* about
    their membership value, what exactly is safe to expose — only their own fees paid,
    or nothing derived at all? (Default conservative answer: portal shows fees + plan
    only; the discount/net/retail-counterfactual figures NEVER cross to the customer.)
    Confirm so the portal payload is designed isolated from the start.

15. **Decline-then-Active race on enroll.** The optimistic `memApplyActive`
    (`app.js:3305`) sets member fields client-side *before* the backend confirms. In
    PROD the code only applies on `r.status === 'active'`, so a decline doesn't flip
    locally — but a slow/lost response after a *successful* server charge could leave
    the UI showing non-member while the backend is Active until the next sync. Is the
    next-poll reconciliation enough, or do we need an explicit post-enroll refetch of
    the customer record? (Trade-off: extra round-trip vs a brief stale-UI window.)

16. **Should Sales run membership money actions? (live gate discrepancy)** Shipped
    reality: Sales is `money` tier (`config.js:342`), so `canMoney()` is true and a
    Sales user **can** Enroll / Cancel / Pay-Cancellation today. Prior-art intent was
    **Office + Owner** for money actions, Sales limited to the **funnel**. Keep Sales'
    charge authority (operationally handy — Sales closes the membership and takes the
    first payment in one motion), or tighten the membership money gate to exclude
    Sales (e.g., a membership-specific check stricter than `canMoney`)? (Trade-off:
    sales-floor convenience vs. fewer roles that can move money. If tightened, it
    can't ride the shared `canMoney()` — it needs its own gate.) **Security call —
    stays on main.** Also: `!currentRole` short-circuits `canMoney()` to `true` —
    confirm a live login can never have an empty role.

---

## 12. Dependencies & Sequencing

### 12.1 Cross-area dependencies (roadmap slugs)

| Depends on | Why |
|---|---|
| `invoicing-payments` | Membership + Cancellation invoices; `stripeChargeInvoice` money path; price-lock HMAC on charged invoices; `TAX_RATE`. |
| `customers-crm` | Membership lives on the customer record; account-type, funnel, card-on-file, agreement signing. |
| `rentals-dispatch` | The entitlement gate is **consumed** in the rental price path (member rate + $0 transport + protection line). |
| `automated-pricing` | `memberDaily` / retail tiers feed the gate and the §7 counterfactual. |
| `backend-data` | The additive `membership*` actions + (Phase 2) the billing cron live in `Code.gs`. |
| `financials-kpi` | Revenue-Goal ring rollup of membership revenue. |
| `maps-location` | Unlimited-Transport zeroes `computeTransportPrice`. |

### 12.2 Areas that depend on Memberships
`accounting`, `wrangler-ai` (AI parity over membership actions), `sales-growth` (the
membership funnel + enrollment drives), `marketing`.

### 12.3 What must land first (for Phase 2)
1. Confirm OQ #1 (authority) and OQ #2 (billing model) **on main** — these are
   security/architecture calls, not delegable.
2. `backend-data` deploy of `membershipBillingCron` via `/clasp` (additive, with the
   STOP gate) **before** any UI renewal affordance.
3. History/audit append plumbing (attributed, append-only) shared with other money
   actions — reuse, don't fork.
