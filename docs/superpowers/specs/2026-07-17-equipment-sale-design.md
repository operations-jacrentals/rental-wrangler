# Equipment Sale — Design Spec

- **Date:** 2026-07-17
- **Status:** Approved by Jac (brainstorm 2026-07-17)
- **Author:** Claude (brainstormed with Jac)
- **Builds on:** the customer-funnel redesign (`2026-07-17-customer-funnel-redesign-design.md`, PR #693)

## Goal

Sell a machine to a customer **through the Equipment Sales section** — the entire purchase
process: picking the unit being sold, generating the sale invoice, taking payment (full /
deposit / financed), and closing the Equipment funnel — in one unified flow. Replaces the
disconnected fleet-side `Record sale` stamp (`sellUnit`, freetext buyer, no invoice, no
funnel tie-in).

## Scope (Jac's picks)

- **What's sold:** units flagged **`For Sale`** (`fleetStatus`) only. Not retiring-on-the-fly,
  not brokered new equipment, not parts.
- **Entry point:** the **customer detail → Equipment track** (Track B of the funnel section).
  One unified flow; the unit card's old **Sell** action re-routes into it with the unit
  pre-picked (asks for the buyer). No more orphaned freetext-buyer sales.
- **Payment shapes:** paid-in-full · deposit + balance · **financed** (down payment + equal
  installments, **weekly or monthly × N**, **0% interest in v1** — price ÷ N).

## Architecture — Approach A: the sale-flagged invoice

A sale is an **invoice** carrying a `sale` marker — the same pattern membership already uses
(`inv.membership`). No new entity; the schema-less Sheets backend takes the extra fields as-is,
and the whole existing payment / partial-payment / late-status / void machinery applies.

```
inv.sale = { unitId }                       // the machine being sold
inv.lineItems: [
  { kind: 'sale',      unitId, label, amount },   // machine price (suggested, editable)
  { kind: 'transport', ... amount },              // optional — amount editable, MANAGER-locked
]                                                  // + tax via the existing exempt-aware path
inv.plan = {                                 // financed sales only
  down: <amount>,                            // down payment (due at commit)
  cadence: 'weekly' | 'monthly',
  n: <count>,
  installments: [ { due: ISO, amount } ]     // equal splits of (total − down)
}
```

## Stage rename: `Paid` → `Purchased`

- The Equipment funnel terminal becomes **`Purchased`** (`FUNNELS.equipment.stages` +
  `STATUS.funnelStage` registry; the legacy `Paid` value stays registered and a one-time
  migration maps stored `usedSalesStage: 'Paid'` → `'Purchased'`).
- `Purchased` returns to **auto** (`FUNNELS.equipment.auto = ['Purchased']`) — this closes the
  gap the funnel redesign flagged (Paid had no trigger and was left manual).
- **Trigger — first money in:** the first payment recorded on a customer's sale invoice sets
  `usedSalesStage = 'Purchased'` and joins the Equipment funnel (mirror of
  `markMembershipSigned`). Manual picks of `Purchased` are rejected (auto-stage guard).

## The sale flow (customer detail → Equipment track)

1. **+Sale** in Track B (money-gated, `canMoney()` — same D2 gate as today's sell).
2. **Pick the unit** — only `fleetStatus === 'For Sale'` units listed.
3. **Price** — prefilled from the existing suggestion machinery (`salePriceSuggest`:
   cost/MSRP basis, bottom%/ask%). Editable; a price below the suggested bottom follows the
   existing **manager-approve** mode (`salePricingCfg().mode`).
4. **Transport** (optional) — a transport line whose **amount is editable but MANAGER-locked**
   (normally invoice amounts aren't editable; this is the sanctioned exception).
5. **Tax** — the existing tax + tax-exempt handling, same as rental invoices.
6. **Payment shape** — full · deposit+balance · financed (down + cadence weekly|monthly + N;
   installments auto-generated equal at 0%). **Deposit + balance is the plan shape with
   `n = 1`** — down = the deposit, one balance installment due at the pickup date — so all
   three shapes ride one representation (full = no plan).
7. **Finalize = commit:**
   - the sale invoice is created (with plan, if financed);
   - the unit flips **`Sold` immediately** — out of the rentable/For-Sale pool;
   - `unit.salePrice` = the machine line amount (tax/transport excluded — ROI math unchanged),
     `unit.saleDate` = commit date, `unit.soldToCustomerId` = the buyer (replaces the freetext
     `soldNote` buyer);
   - the Equipment funnel stays at its current stage until **first money in** → `Purchased`.

## Payment-plan mechanics

- The plan is a **schedule overlay** on the open invoice — payments themselves go through the
  **existing partial-payment engine** untouched.
- An installment reads **paid** when cumulative `amountPaid` covers the cumulative scheduled
  amount through that installment (no per-installment allocation).
- `inv.dueDate` **syncs to the next unpaid installment's due date** — so the existing
  Late / Not Due / Collections statuses work on financed sales with no new status logic.
- The Equipment track renders the schedule + next-due inline; the deposit (down payment) is
  due at commit.

## Absorbing the old unit-side flow

- The unit card's **Sell** action (`js-open-sell` → the `sellUnit` overlay) now opens the same
  sale flow with the unit pre-picked and asks for the customer.
- `sellUnit()`'s direct stamp is retired from the UI path (the function may remain as the
  commit-step internal).
- **Void** (manager, existing `voidInvoice` gate): voiding a sale invoice **un-sells** the unit
  (back to `For Sale`, `salePrice`/`saleDate`/`soldToCustomerId` cleared) and reverts the
  funnel from `Purchased` if no other paid sale invoice exists for that customer.

## Out of scope (v1)

- Interest / APR on financed sales (0% only; plan shape leaves room for it).
- Brokered/new-equipment (non-fleet) sales, parts/attachment sales.
- Trade-in credit.
- A dedicated sales board (the pipeline board + Equipment track cover v1).

## Build amendments (2026-07-17 — plan-review critique, mechanics corrections only)

Adversarial plan review refuted two mechanics this spec asserted and tightened two details.
**None of Jac's approved decisions change** — only the internal mechanisms:

1. **"Existing Late/Not Due/Collections statuses work with no new status logic" — FALSE.**
   `invoiceTotals` returns `'Partial'` whenever anything is paid, before the due-date aging
   ladder ever runs — a financed sale would never read Late. The build adds a status branch:
   a plan-carrying invoice with money in, a balance, and a lapsed due date derives the Late
   tiers. (Behavior for all non-plan invoices unchanged.)
2. **Void/un-sell mechanics.** A refund does not zero `amountPaid` (house rule keeps it and
   derives from `inv.refunded`), and `invoiceVoidable` excludes refunded invoices — so
   "refund first, then void" was unreachable. Corrected: a sale invoice becomes voidable when
   **fully refunded**; Void remains the explicit act that un-sells (Jac's approved behavior,
   working mechanism). A refund alone never un-sells.
3. **Transport line kind is `'saleTransport'`**, not `'transport'` — rental transport
   machinery keys `kind === 'transport'` lines by `ref = rentalId`; a distinct kind keeps
   sale lines out of every rental sync path by construction.
4. **Deposit + balance:** the wizard's Deposit shape collects the **pickup date** explicitly
   and the single balance installment falls due on it (not on a cadence step).

## Gates & audits

- `/role` audit before build (money surface: sale pricing uses cost/MSRP basis internally —
  **bottom-dollar/cost basis must never render on a customer-facing surface**; the sale
  invoice shows the price, not the basis).
- jactec-ui for all new/reshaped UI (the sale panel, plan schedule, unit picker).
- Existing CI gates + new logic-test coverage: plan generation math, installment-paid
  derivation, dueDate sync, Purchased trigger, void-reverts.
