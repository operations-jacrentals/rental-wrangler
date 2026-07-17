# Membership — PO exemption + ahead-of-time dues invoicing (design)

**Status:** DRAFT — awaiting Jac's sign-off. No code until approved.
**Requested by:** Jac, 2026-07-17 (follow-on from the #652 PO-required gate).
**Touches:** backend membership billing (Apps Script `Code.gs`, gitignored — tracked record in
`docs/handoffs/membership-billing-additions.gs`) + a small frontend toggle in the membership agreement.
**Ships via:** `/clasp` push → **Jac's Apps Script editor deploy** (STOP-gated; nothing goes live silently).

---

## 1. Current live state (verified)

App-driven membership billing is **live** (re-deployed v83, 2026-07-09 — see `BACKEND-DEPLOY-QUEUE.md`).
The daily `membershipBillingCron` (3am) drives recurring dues.

- **Invoices are created reactively.** The cron only creates + charges the next cycle's invoice **on the
  day the current paid period ends** — `membership-billing-additions.gs:205` (`if (!c.paidUntil || c.paidUntil > today) continue;`). Creation and charge happen together; `paidUntil` advances only on a cleared charge; a decline → 7-day grace → lapse.
- **PO does not apply to dues today.** Membership dues charge **server-side** via `stripeChargeInvoice_`
  (inside `membershipEnroll_` / `membershipBillingCron`). The #652 PO gate is **client-side**, so it never
  touches dues — a `requiresPO` member's dues charge regardless of PO right now.
- **Cancellation already bills the leftover term at once** — a monthly mid-term cancel/lapse writes ONE
  invoice for all remaining months' subtotal (`membershipCancel_` / `memLapse_`, lines 162–175, 226–236).
  **Unchanged by this design.**

---

## 2. Change 1 — PO exemption for membership dues

**Decision (Jac):** exempt by default; opt-in requirement lives in the agreement; changeable anytime.

- **New membership field:** `duesRequirePO` (boolean, **default `false` = exempt**). Server-owned, same
  protected-field treatment as `paidUntil` so a client sync can't clobber it.
- **Agreement toggle:** a clickable **"Require a PO for membership dues"** control in the membership
  agreement UI, editable at any time (not locked at enrollment). Runs through the `jactec-ui` design gate.
- **Gate condition:** dues are PO-gated only when **`customer.requiresPO === true` AND
  `duesRequirePO === true`** and the dues invoice has no `po`. (Account not requiring PO, or the toggle off
  → dues bill normally.)
- **Backend enforcement (the real gate):** in `membershipEnroll_` and `membershipBillingCron`, before
  `stripeChargeInvoice_`, if the gate condition holds → **HOLD**:
  - create the dues invoice (so it's visible/queued),
  - **do not charge**, **do not advance `paidUntil`**,
  - **do not start a grace clock and do not lapse** — held ≠ declined (Jac Q2a).
  - Retry on subsequent cron runs; the moment a PO is added to that invoice (or the toggle is flipped
    off), the next run charges it.
- **Held state is distinct from Past-Due/Grace** so the member keeps status while we wait for the PO.

---

## 3. Change 2 — ahead-of-time dues invoicing

**Decision (Jac):** create the next invoice proactively; keep each month a separate invoice; charge on due date.

- **Two creation triggers — whichever fires first:**
  1. **On payment** — when a cycle's dues invoice clears, immediately create the next cycle's invoice
     (due at the new `paidUntil`).
  2. **28-day fallback** — if `today >= paidUntil − 28 days` and the next invoice doesn't exist yet, create
     it anyway. This covers the "pay thing hasn't worked out" case so an unpaid/held prior invoice never
     stalls creation of the upcoming one.
- **Create-only (Jac Q4a):** the invoice *appears* early but the **card is charged on its due date**
  (`paidUntil`). `paidUntil` still advances only on a cleared charge.
- **Regardless of prior payment (Jac):** the upcoming invoice is created even while earlier dues are
  unpaid/held — **open invoices may stack.**
- **Each month is its own invoice** (Jac: "keep the monthly invoices separated") — one `MINV-` record per
  cycle, **never consolidated.** (Cancellation remains the one exception that bills remaining months in a
  single invoice.)
- **Cron restructure:** split the single create-and-charge loop into
  - **(a) creation pass** — ensure each active member's *next* invoice exists per the triggers above
    (idempotent: skip if the cycle's invoice already exists — keyed by cycle/period so no duplicates), and
  - **(b) charge pass** — charge any open dues invoice whose due date ≤ today (respecting the PO-hold rule),
    advance `paidUntil` on success, grace/lapse on a genuine decline (not on a PO-hold).

---

## 4. Open decision (needs Jac)

**Annual plans + the "on payment" trigger.** For a **monthly** member the two triggers nearly coincide
(~30-day cycle), so "on payment" ≈ "28 days ahead." For an **annual** member, "create the next one when
this one is paid" would create next year's renewal invoice **a full year early** — an open invoice sitting
on the account for ~11 months.

- **Recommended default:** for **annual**, use only the **28-day-before-renewal** trigger (skip the
  create-a-year-early "on payment" trigger). Monthly keeps both.
- **Alternative:** apply "on payment → create next" uniformly, and accept a year-early annual renewal invoice.

_Default assumed in this spec: the recommended (annual = 28-day only). Say the word to flip it._

---

## 5. Rollout

1. Frontend: add `duesRequirePO` toggle to the membership agreement (design-gated), persist + sync.
2. Backend (`membership-billing-additions.gs` → live `Code.gs`): the PO-hold gate + the create/charge split.
   **Reconcile against the live `Code.gs` first** (the `.gs` is a tracked record, not the source of truth)
   before splicing — additive recipe per `BACKEND-DEPLOY-QUEUE.md`.
3. Ship: `/clasp` push → **Jac runs the editor deploy**. No trigger re-install needed (cron already installed).
4. Verify: a monthly test member shows next month's invoice created ahead of its due date and charged on
   the due date; a `requiresPO` + `duesRequirePO` member's dues **hold** (created, not charged, no lapse)
   until a PO is added.
