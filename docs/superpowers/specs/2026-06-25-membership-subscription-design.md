# Membership Subscription System — Design Spec

**Date:** 2026-06-25
**Area:** `area/memberships`
**Status:** Approved design → ready for implementation plan
**Backlog:** Resolves item #4 "Memberships — needs detail"

---

## 1. Problem

Today the *pricing & paperwork* half of memberships works: members get member
equipment rates (`memberDaily`, `app.js:844`), the right agreement is
auto-selected (`agreements.js`), and a printable membership agreement exists
(#293). But the *subscription* half is unbuilt — there is no enrollment, no
billing, no Paid-Until tracking, no renewals, and no lapse handling. The paid
fields (`paidUntil`, `paidCadence`, `unlimitedTransport`, `paidFees`) exist only
in demo seed data, and moving the membership funnel to "Paid" just changes a
label (`setFunnelStage`, `app.js:10128`).

This spec defines the full subscription system: enrollment, recurring billing,
add-ons, the membership lifecycle/state machine, and the cancellation mechanic.

---

## 2. The product (money model)

| Component | Monthly | Annual | What it does |
|---|---|---|---|
| **Base membership** | $299 / mo | $2,691 / yr | Unlocks member equipment rates (`memberDaily`) |
| **Unlimited Transport** (optional add-on) | +$500 / mo | +$4,500 / yr | $0 delivery/pickup — sets the existing `unlimitedTransport` flag that already zeroes transport pricing (`computeTransportPrice`) |
| **Rental Protection** (optional add-on) | +15% of **base only** | +15% of **base only** | Covers up to **$2,000/mo** in damages |

Rules:

- **No proration.** Membership starts on a chosen **start date** (default =
  today, or a future customer-specified date). The first charge is the **full**
  plan amount on the start date.
- **Tax 10.75%** (`TAX_RATE`) applies on top of every membership invoice, same as
  all other invoices.
- **Unlimited Transport** is a flat per-cadence fee ($500/mo or $4,500/yr) that
  follows the plan cadence and bills in the same invoice as the base.
- **Rental Protection** has **two** billing effects:
  1. **Membership side:** +15% of the **base fee only** (excludes the transport
     add-on) on each membership invoice.
  2. **Rental side:** +15% of **each rental's subtotal** (pre-tax) on every
     rental invoice for that account, for as long as protection is on.
- **All prices are Owner-settable, not hardcoded** (Principle 9; `/role` Owner Q5).
  The base fees, both add-on fees, the 15% rate, and the $2,000 cap live in the
  **Settings → Company config** (Sheets-backed) and are read **server-side** at
  billing time — Jac reprices next year with no code deploy. The numbers in this
  table are the *initial defaults*.
- Worked example — Monthly member with both add-ons:
  base $299 + transport $500 + protection (15% × $299 = $44.85) = **$843.85/mo**
  + 10.75% tax.

### 2.1 Rental Protection is an account-level toggle (mirrors the PO gate)

Rental Protection is **not** members-only. It is a new account-level boolean
`rentalProtection`, modeled exactly like the existing `requiresPO`:

- **New/Edit Customer form:** a tri-state toggle (`Yes / No / ?`) identical in
  behavior to the PO button (`app.js:8670`, handler `js-nc-po` at `app.js:11022`).
  Answer required before save (mirrors the forced-PO-answer at `app.js:12680`).
- **When ON:** every rental invoice for that account adds a **+15% Rental
  Protection line** on the subtotal.
- **When OFF:** every rental shows a reminder pill — **"Rental Protection not
  enabled"** — mirroring the `⚠ PO required` warning at `app.js:11731` / the
  invoice-list PO cell at `app.js:5531`.
- Members who purchase the protection add-on get `rentalProtection` switched ON
  automatically at enrollment. Non-members can carry it independently.
- `$2,000/mo` coverage is a tracked allowance (resets each calendar month). v1
  surfaces the cap as informational; damage-claim accounting against the cap is a
  follow-on (see §8 Deferred).

---

## 3. State machine

```
 Prospect ──enroll──► Incomplete ──activate(card + agreement + 1st charge OK)──► Active
                          │                                                        │
                          │                                  renewal charge fails  │
                       (abandon)                                                    ▼
                                                                              Past Due ──grace 7d──► Lapsed
                                                                                │  member rates kept  │
                                                                                │  flag: "Canceled    │  revert to RETAIL
                                                              charge succeeds   │   In N Days"        │  + Cancellation Invoice
                                                                                ▼                     ▼
                                                                             Active            (Monthly mid-term)
                                                                                                      │ paid in full
                                                                                                      ▼
                                                                                          Active-Prepaid ──► term end
                                                                                          (rides to commitmentEnd,
                                                                                           no further charges)
```

Mapped onto existing fields — **schema-less Sheets, so no migration**, just new
JSON keys on the customer record:

| Concept | Field | Notes |
|---|---|---|
| Member-ness / pricing gate | `accountType` | `Member` / `Business Member` ⇄ `Member Incomplete` ⇄ non-member. **Lapse flips this off "Member"** → the gate at `app.js:844` reverts to retail automatically — no pricing code changes. |
| Funnel label | `membershipStage` | Terminal stage renamed **"Paid" → "Signed"** (§3.1). Add `Past Due` / `Lapsed`. |
| Billing cadence | `paidCadence` | `Monthly` / `Yearly` |
| Paid through | `paidUntil` | Advances +1 mo / +1 yr per successful charge |
| Commitment window | `commitmentStart`, `commitmentEnd` | 12 months from start date |
| Add-ons | `addOns: { transport: bool, protection: bool }` | drives invoice lines + the `unlimitedTransport` / `rentalProtection` flags |
| Auto-renew | `autoRenew: bool` | captured at enrollment, default **OFF** (§3.2) |
| Prepaid-to-term | `prepaid: bool` | set when a Cancellation Invoice is paid (§4) |
| Grace deadline | `graceUntil` | start + 7 days; drives the countdown flag |

**During the 7-day grace (Past Due): member rates are KEPT** (the agreement gives
7 days to resolve). The card shows a countdown flag **"⚠️ Canceled In N Days"**.
Only on lapse (grace expired) do rates revert to retail.

**Lapse is atomic** (`/role` Step 7). On lapse, ONE server-side transaction:
flips `accountType` off Member (→ pricing reverts via the `app.js:844` gate),
sets `membershipStage = Lapsed`, **clears the member entitlements**
(`unlimitedTransport` → off), and generates the Cancellation Invoice (§4). No
partial/stale state. **Rental Protection (`rentalProtection`) is NOT cleared** —
it is an independent account-level setting (protection is never free), so a
lapsed member keeps the +15%-on-rentals line until someone explicitly turns it
off (Jac, 2026-06-25).

### 3.1 Membership funnel: "Paid" → "Signed", agreement-driven, not manual

- The membership funnel's terminal stage label changes from **"Paid"** to
  **"Signed"**. (The **Used-Sales** funnel, which shares the `funnelStage`
  status set, keeps "Paid" — so this is a membership-only relabel, not a global
  status rename.)
- **"Signed" cannot be set by hand.** It is removed from the manual
  membership-funnel dropdown (`openFunnelDropdown` / `setFunnelStage`,
  `app.js:10128`). Signing the membership agreement auto-flips the stage to
  **Signed**. "Signed" = paperwork complete; it is the *enrollment charge* that
  promotes the member to **Active**.

### 3.2 Auto-renew toggle (default OFF)

A per-member `autoRenew` boolean is captured at enrollment, default **OFF**.
At a completed 12-month term:

- `autoRenew` **ON** → a fresh 12-month commitment begins; billing resumes
  (the agreement's "a new 12-month commitment begins").
- `autoRenew` **OFF** → the membership **completes** and reverts to retail, with
  a renewal prompt surfaced on the card.

---

## 4. The Cancellation Invoice

On **cancel** *or* **lapse** (grace expired) for a **Monthly** member who is
mid-commitment:

- Generate a single **Cancellation Invoice** =
  `(months remaining in the 12-month term) × (their full monthly fee incl.
  add-ons)`. It **sits on the account** — never auto-charged (per the agreement,
  the customer is not pursued for it).
- **Reactivation = pay that whole invoice in one transaction.** On payment:
  - membership reopens (`accountType` back to Member),
  - `paidUntil` jumps to `commitmentEnd`,
  - `prepaid = true` → the member **rides out the remainder of the term with zero
    further charges** (contract complete).
- **Annual members** already prepaid the full term, so cancel simply stops the
  next renewal — **no Cancellation Invoice** (nothing is owed). The membership
  runs to `commitmentEnd` then follows the `autoRenew` rule.

The Cancellation Invoice is a normal invoice record (appears in the Invoices
card, printable, charged via the existing `stripeChargeInvoice` path when paid).

---

## 5. Billing engine (app-driven, no webhooks)

A daily Apps Script **time-trigger** `membershipBillingCron` (additive backend,
ships via `/clasp`):

1. Find members whose `paidUntil ≤ today` and `prepaid !== true`.
2. **Generate the cycle's membership invoice** — itemized lines: Base, Unlimited
   Transport (if on), Rental Protection (15% of base, if on), Tax. (Yes — an
   invoice is created **every cycle**; it is the audit trail + receipt + revenue
   rollup.)
3. **Charge** the saved default card via the existing **`stripeChargeInvoice`**
   action (Admin/Office money-role gated).
4. **Success** → mark invoice paid, advance `paidUntil` (+1 mo / +1 yr), log to
   activity. If a Monthly member just completed month 12 → apply the `autoRenew`
   rule (§3.2).
5. **Failure** → leave the invoice **UNPAID**, flip the member to **Past Due**,
   set `graceUntil = today + 7d`, surface the **"⚠️ Canceled In N Days"**
   countdown flag. Retry daily during grace. Grace expired → **Lapse**: revert to
   retail (flip `accountType`) and generate the **Cancellation Invoice** (§4).

All membership money actions stay behind the existing Admin/Office role gate. The
cron itself runs server-side under the project's own authority.

> **Note:** the billing math (fees, add-ons, 15% protection, tax) is computed
> **server-side** in `Code.gs` so the client can't fake amounts — same hardening
> rationale as the cash-payment backend fix (`docs/handoffs/cash-payment-backend.gs`).

---

## 6. Enrollment flow (new UI)

Triggered by an Office/Admin from the customer card's **Membership** section
("Enroll / Saddle Up" action). Opens an enrollment dialog (new popup → needs a
`WINDOW_CATALOG` entry):

1. **Plan:** Monthly / Annual.
2. **Add-ons:** Unlimited Transport, Rental Protection (toggles).
3. **Start date:** date picker, default today; future date allowed (§2, no
   proration).
4. **Auto-renew:** toggle, default OFF (§3.2).
5. **Gates to activate:** a **valid card on file** + a **signed membership
   agreement** (reuses existing card-on-file + agreement infra). Missing either →
   the customer stays **Member Incomplete** (enrollment captured, not yet active).
6. Shows the **live first-charge total** (full plan + add-ons + tax; no
   proration), then on confirm fires the charge on the start date.
7. **Success** → `Active`: sets `accountType` to Member / Business Member, all
   membership fields, `commitmentStart/End`, switches `unlimitedTransport` /
   `rentalProtection` per the chosen add-ons, logs to activity.

The Membership section then displays: plan + cadence, Paid-Until (with countdown),
add-on badges, auto-renew state, and contextual actions — **Cancel** and, when
lapsed, **Pay Cancellation Invoice**.

### 6.1 Self-enrollment-ready seam (forward-looking)

Enrollment, renewal, and cancellation are implemented as **single backend
actions** (`membershipEnroll`, `membershipCancel`, `membershipReactivate`,
plus the `membershipBillingCron`) with all validation + money math server-side.
The in-app Office/Admin UI is the first caller; the **planned public website
self-enrollment** flow can call the exact same actions later with no rework. v1
builds the in-app path only; the website is out of scope here but the contract is
designed for it.

---

## 7. Membership economics tracking (per-customer, Standard view)

Surfaced in the **Membership section of the customer card's Standard view**
(`app.js:5409` area) — per customer, internal-only (Office / Owner / Sales lens;
never the customer portal). Four figures + two derived:

| Metric | Definition |
|---|---|
| **Membership Fee Revenue** | Lifetime sum of this customer's **paid** membership-invoice fee lines (base + add-ons + protection-on-fee + tax). |
| **Member Rental Revenue** | Sum of this customer's rentals priced at the **member** rate (actual billed). |
| **Counterfactual Retail** | The **same** rentals re-priced at **retail** — **equipment rate only** (day / 7-day / 4-week / weekend tiers). Excludes transport & protection (Jac, 2026-06-25). |
| **Member Discount** (derived) | `Counterfactual Retail − Member Rental Revenue` — what the membership rate gave away on equipment. |
| **Net Program Contribution** (derived) | `Membership Fee Revenue − Member Discount` — is the program net-positive for this member? |

- **Nothing extra is stored.** The retail counterfactual is **derived on the fly**
  from each rental's window + the category's retail rates — the existing
  `priceRental` (`app.js:844`) already computes both the member and retail paths;
  reporting just evaluates the retail branch for member rentals.
- These are **revenue comparisons (member rate vs retail), not margin floors** —
  no Bottom Dollar / True Cost / ROI — so they are **not** T1-radioactive and are
  safe on the staff Standard view. They remain **internal-only** (not the customer
  self-service portal).
- The Membership-Fee-Revenue and Member-Rental-Revenue figures also roll up into
  the $150k Revenue Goal (§10.5); the counterfactual and derived figures are
  **analysis-only** and never count as revenue.

## 8. UI / design-language obligations

All new/reshaped UI runs through **`/jactec-ui`** then **`/frontend`** (yard
data-plate language). Specifically:

- Enrollment dialog, Membership card section, Cancellation-Invoice action, and
  the Past-Due **"Canceled In N Days"** flag — stamped with `data-r="Rxx"`
  rulebook attributes; `rule-usage.js` regenerated (`node ci/gen-rule-usage.mjs`).
- The enrollment dialog is a new popup → add a `WINDOW_CATALOG` entry
  (`ci/check-window-catalog.mjs`).
- Account-level **Rental Protection** toggle in the New/Edit Customer form mirrors
  the PO toggle's look + tri-state behavior.
- The per-rental **"Rental Protection not enabled"** reminder mirrors the PO
  warning styling.
- The **Membership economics block** (§7) on the customer Standard view — stamped
  stat pills/KVs in the existing Membership section, in the yard data-plate
  language.

---

## 9. Scope — in vs. deferred

**In v1:**
- Full enrollment (in-app, Office/Admin), start-date, plan + both add-ons,
  auto-renew toggle.
- Recurring per-cycle invoicing + auto-charge (Monthly + Annual).
- 12-month commitment, full lifecycle incl. Past Due / grace / lapse.
- Cancellation Invoice mechanic + reactivation-to-prepaid.
- Account-level Rental Protection toggle + per-rental reminder + 15% lines.
- Funnel "Signed" relabel + agreement-driven auto-set.
- **Membership economics block** on the customer Standard view (§7): fee revenue,
  member-rental revenue, counterfactual retail, member discount, net contribution.

**Deferred (flagged, not built in v1):**
- **Damage-claim accounting against the $2,000/mo protection cap** → split into
  its **own follow-on feature** on a dedicated branch **`memberships/protection-claims`**
  (off `area/memberships`), tracked separately (Jac, 2026-06-25). v1 surfaces the
  cap **informationally only** — recording claims, drawing them down against the
  monthly allowance, and the reset/rollover logic all live in that branched
  feature, not here.
- Public **website self-enrollment** (backend seam built in v1; web UI later).
- Dunning niceties beyond the daily-retry / 7-day grace (e.g. escalating
  reminders, SMS/email — would route through `area/comms-notifications`).

---

## 10. Access, audit & integrity (role-audit hardening)

From the `/role` audit (2026-06-25). These are build requirements, not optional.

1. **Authority gate (T2).** `membershipEnroll`, `membershipCancel`,
   `membershipReactivate`, and any membership charge are **money actions** —
   server-side gated to **Office + Owner** (Admin override separately logged),
   like every other `stripe*` action. The billing cron runs under the project's
   own authority.
2. **Audit trail — automatic + attributed.** Every membership money event writes
   an **append-only, timestamped, attributed** History entry with **no form**:
   enrollment charge, **each cycle's charge — success AND decline**, cancel,
   lapse, reactivation payment, and auto-renew roll. Cron entries attribute to a
   system/auto-billing actor.
3. **Price-lock seal.** Membership invoices and the Cancellation Invoice respect
   the existing **price-lock HMAC** once charged/paid — no silent post-charge
   edits (Office Q1).
4. **Entitlement gating, both surfaces.** Member rates and the `unlimitedTransport`
   $0 entitlement are **refused to `Member Incomplete`** and to lapsed accounts in
   **both the quote and the invoice line** (Conflict #10). Entitlement flags are
   set only on **activation**, cleared on lapse — never merely "flag present."
5. **Revenue Goal.** Recurring membership revenue **counts toward the $150k
   Revenue Goal ring** (Jac, 2026-06-25). Documented here so the ring moving is
   expected, not a surprise (Owner Q3).
6. **Self-enrollment isolation seam.** The shared enroll/reactivate backend
   actions must enforce **server-side row-level isolation** when the future public
   website calls them — a customer can enroll / pay for **only themselves**, and
   never see another account's membership or fees. Required of the seam now even
   though the web UI is deferred (§8).

## 11. Key code anchors

- Member pricing gate: `app.js:844` (`isMember`) — lapse reverts pricing for free.
- PO gate pattern to mirror for Rental Protection: form toggle `app.js:8670` /
  handler `app.js:11022`; per-rental warning `app.js:11731`; invoice cell
  `app.js:5531`; forced-answer-before-save `app.js:12680`.
- Funnel stage set + setter: `config.js:134`; `setFunnelStage` `app.js:10128`.
- Membership card section: `app.js:5407–5415`.
- Existing Stripe charge path: `stripeChargeInvoice` (+ `recordManualPayment`).
- Tax: `TAX_RATE` (10.75%, `app.js:1310`).
- Backend deploy: `/clasp` (additive), `docs/handoffs/backend-access.md`.
