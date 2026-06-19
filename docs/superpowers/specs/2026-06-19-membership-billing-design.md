# Membership Recurring Billing — Design (v1)

**Date:** 2026-06-19
**Status:** Approved (Jac, 2026-06-19) — ready for implementation plan
**Scope:** NEW members only. Existing-member migration, member-initiated
cancellation UI, ACH membership billing, and a self-signup portal are all
explicitly **out of scope for v1** (see §10).

---

## 1. Problem

Today the app has the membership *scaffolding* — member account types
(`Non-Business Member`, `Business Member`), a membership sales funnel
(`membershipStage`), member daily rates (`memberDaily`), the auto-swapped
**Membership Agreement**, and a `paidUntil` date shown on the customer card —
but **no recurring billing**. `paidUntil` is read-only/cosmetic: nothing in the
code ever charges a membership fee or advances that date. Billing a member is a
manual one-off invoice charge today.

The Membership Agreement (`agreements.js`) already fixes the commercial terms:

- **Monthly Plan — $299.00/month** (+ tax)
- **Annual Plan — $2,691.00/year** (+ tax)
- A **12-month commitment** regardless of plan.

What's missing is (a) capturing **which plan** a member chose (in the signed
packet) and (b) the **engine that charges them on a cycle**. This spec adds both.

## 2. Decisions (locked with Jac, 2026-06-19)

1. **Engine = Stripe Subscriptions.** Stripe runs the recurring charge and its
   own retries/dunning. We add one signature-verified webhook to the backend.
2. **Plan toggle lives on the account form**, attached to the agreement, so the
   chosen plan is part of the signed packet (not the card/payment side).
3. **Billing anchors to the enrollment day, NOT the 1st of the month, and there
   is no proration.** Monthly recurs on the same day-of-month the card was first
   run; annual recurs on that date yearly. (This overrides the old contract
   wording — see §9.)
4. **Activation is an explicit "Activate Membership" button** — the only thing
   that starts a subscription / first charge. Nothing charges by surprise.
5. **Failed payment → 7-day grace, then lapse.** After Stripe's automatic
   retries are exhausted: flag **Past Due** and start a 7-day grace during which
   member rates are retained. If still unpaid at day 7: account auto-downgrades
   Member → non-member, member pricing is revoked, **and every currently active
   rental of that customer is re-priced to standard rates** (not just future
   rentals). Paying anytime during grace keeps them a member with no changes.
6. **The Membership Agreement text will be updated** so the signed terms match
   enrollment-day billing (see §9).
7. **v1 bills the card on file only** (ACH membership billing deferred).

## 3. Plan capture — account form

- New customer field **`membershipPlan`**: `'monthly' | 'annual' | ''`.
- In the **Edit / Complete Account** packet (`newCustomer` overlay, app.js
  ~6280), when `accountType` matches `/member/i` (the same test that already
  swaps in the Membership Agreement at app.js:6289), render a **Monthly /
  Annual** segmented toggle **directly above the membership agreement block**.
  - Selecting a plan writes `d.membershipPlan` and stamps the chosen plan +
    price into the packet (a visible line, e.g. *"Selected plan: Monthly —
    $299/mo"*) so the signed agreement records the plan.
  - The toggle is required before the agreement can be signed for a member type
    (you cannot sign a membership agreement with no plan chosen).
- On save, `membershipPlan` persists on the customer alongside
  `agreementType`/`agreementSignedAt`.
- **Design language:** the toggle is built with the jactec-ui segmented-control
  pattern (stamped Saira Condensed labels, safety-orange "on" state), stamped
  with the appropriate R-rule. Run through the `jactec-ui` skill at build.

## 4. Activation — the money moment

- A new **"Activate Membership"** action (ignition-style primary button) on the
  customer standard view / account. It is **enabled only when ALL of**:
  - account type is a Member type, **and**
  - `membershipPlan` is set, **and**
  - the membership agreement is signed (`agreementSignedAt` + `agreementType
    === 'membership'`), **and**
  - a card is on file (`hasCardOnFile`).
  Otherwise it shows the missing prerequisite (mirrors the existing card
  consent-gate copy pattern).
- Tapping → backend **`membershipActivate`** →
  1. ensure a Stripe Customer exists (reuse `c.stripeId`),
  2. create a **Subscription** on the saved card with the matching Price
     (monthly $299 / annual $2,691), **`billing_cycle_anchor = now`**, no
     proration, tax applied (§8),
  3. charge immediately; return `{ subscriptionId, currentPeriodEnd, status }`.
- App then sets: `stripeSubId`, `membershipStatus = 'active'`,
  `membershipStartedAt = today`, `paidUntil = currentPeriodEnd`, funnel
  `membershipStage = 'Paid'`. Logged to the customer activity log.
- **Idempotent:** if `stripeSubId` already exists and is active, Activate is a
  no-op (no double-subscribe). Admin-only is NOT required for v1 (any office
  role can activate) — revisit if needed.

## 5. Recurring engine — Stripe + webhook

- Stripe auto-charges each cycle and runs its own card-retry/dunning schedule.
- The backend `doPost` gains a **Stripe webhook branch** (signature-verified
  against the Stripe signing secret; the secret lives only in the gitignored
  `Code.gs`). Events handled:
  - `invoice.paid` → advance `paidUntil` to the new `currentPeriodEnd`, set
    `membershipStatus = 'active'`, clear any `graceUntil`/Past Due.
  - `invoice.payment_failed` (retries not yet exhausted) → optional soft Past
    Due flag; no downgrade yet.
  - `customer.subscription.updated` with `status = 'past_due'` /
    `invoice` final failure → start the §6 grace flow.
  - `customer.subscription.deleted` / `unpaid` → treat as final failure → lapse
    path (§6) if grace already elapsed.
- Webhook writes go through the same server-owned/sync-protected field path as
  other money fields (the app never writes these locally except the optimistic
  activation echo).

## 6. Failed payment — 7-day grace, then lapse

- **Enter grace:** on final retry failure / `past_due`, set
  `membershipStatus = 'past_due'`, `graceUntil = today + 7`. Show a **Past Due**
  flag on the customer card with a "fix payment method" prompt. **Member rates
  stay active during grace.**
- **Resolve in grace:** any successful payment (Stripe retry or staff re-charge)
  → `invoice.paid` webhook restores `active`, clears `graceUntil`. No downgrade.
- **Lapse at day 7:** a daily backend time-trigger (or the
  `subscription.deleted` webhook, whichever fires) checks `graceUntil`. If
  reached and still unpaid:
  - `membershipStatus = 'lapsed'`;
  - **account type downgrades** Member → its non-member equivalent
    (`Business Member` → `Business`, `Non-Business Member` → `Non-Business`);
  - member pricing is revoked going forward;
  - **re-rate active rentals:** find the customer's currently active (on-rent,
    not yet returned/closed) rentals and recompute each `price` at **standard
    (non-member) rates** using the existing pricing logic (the `isMember`
    branch at app.js:466–468 now resolves false). Each re-rate is logged to that
    rental's activity log.
- The active-rental re-rate is the **single deliberate money-write** in this
  feature. It is gated (only on confirmed lapse), idempotent, and logged.

## 7. Data model — new customer fields

All server-owned / sync-protected (added to the protected-fields list so the
optimistic client never clobbers a webhook write):

| Field | Type | Meaning |
|-------|------|---------|
| `membershipPlan` | `'monthly'\|'annual'\|''` | Chosen plan (captured at signing) |
| `membershipStatus` | `'active'\|'past_due'\|'lapsed'\|''` | Lifecycle state |
| `stripeSubId` | string | Stripe Subscription id (idempotency key) |
| `membershipStartedAt` | date | Day billing first ran |
| `graceUntil` | date | Past-due grace deadline (7 days) |
| `paidUntil` | date *(existing)* | Now webhook-driven, no longer manual |

## 8. Backend (Code.gs — Track C, hand-pasted on a cadence)

- **One-time in Stripe (dashboard):** two recurring **Prices** — Monthly
  $299.00, Annual $2,691.00 — plus a tax rate (Stripe Tax or a fixed
  TaxRate matching the existing invoice tax handling). A webhook endpoint
  pointed at the Apps Script exec URL with a signing secret.
- **New dispatch action:** `membershipActivate` (creates the Customer +
  Subscription, anchor = now, no proration, tax applied; IDOR-guarded like the
  existing Stripe actions).
- **Webhook handler** in `doPost` (signature-verified) for the §5 events.
- **Daily time-trigger** to enforce the §6 day-7 lapse for accounts whose grace
  elapsed without a paying webhook.
- Because `Code.gs` is gitignored and pasted by hand, the backend changes ship
  on the manual cadence (Track C) — the frontend degrades gracefully if the new
  actions aren't live yet (Activate shows a "billing backend not deployed" toast
  rather than erroring).

## 9. Contract reconciliation (REQUIRED)

The current Membership Agreement §2 (`agreements.js`) says membership is *"billed
on the first day of each month, first month pro-rated."* Decision #3 changes
billing to **enrollment-day, no proration**, so the signed terms must match.

- **Update `agreements.js` Membership Agreement §2** to describe enrollment-day
  billing with no proration (e.g. *"The Monthly Plan is billed on your
  enrollment date each month; the Annual Plan on your enrollment date each year.
  No proration applies."*), keeping the $299 / $2,691 amounts and the 12-month
  commitment language.
- Counsel should still glance at the revised wording before go-live (the file
  already carries a "have counsel review" note).

## 10. Out of scope (v1)

- Migrating **existing** members onto recurring billing (they keep manual
  `paidUntil` until a later pass).
- **Member-initiated cancellation / non-renewal UI** (12-month commitment;
  handled off-app for now). Re-activation after a lapse is simply running
  Activate again.
- **ACH membership billing** — card on file only in v1.
- **Member self-signup portal.**

## 11. Money-safety invariants

- Activation is the only thing that starts a subscription, and it is
  **idempotent** (existing active `stripeSubId` ⇒ no-op; no double-subscribe).
- The webhook is **signature-verified**; only verified Stripe events move money
  state.
- The lapse active-rental re-rate is the single deliberate money recompute —
  gated on confirmed lapse, idempotent, and logged per rental.
- New money/lifecycle fields are sync-protected so the optimistic client never
  overwrites a webhook-driven value.

## 12. Affected surfaces (orientation for the plan)

- `app.js` ~6280–6336 — `newCustomer` overlay (plan toggle + signing gate).
- `app.js` ~466–468 — `isMember` pricing branch (re-rate on lapse).
- `app.js` ~3680–3682 — membership section on the customer card
  (plan + status + Past Due pill + Activate button).
- `app.js` ~9698+ — Stripe flows (new `membershipActivate` client call).
- `app.js` refresh/sync + `SYNC_PROTECTED` — new sync-protected fields.
- `agreements.js` — Membership Agreement §2 rewording.
- `config.js` — any new status/pill definitions (Past Due / plan labels).
- `style.css` — toggle, Activate ignition button, pills (jactec-ui).
- `Code.gs` (gitignored) — `membershipActivate`, webhook, daily trigger.
- `rule-usage.js` — regenerate for any new stamped UI.
