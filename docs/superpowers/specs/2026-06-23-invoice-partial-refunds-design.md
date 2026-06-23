# Invoice per-line / partial refunds — design (#125 refund half)

**Date:** 2026-06-23
**Issue:** [#125 — Partial Payment & Refund Line-Item Allocation](https://github.com/operations-jacrentals/rental-wrangler/issues/125)
**Area:** `area/invoicing-payments` (money path) + light touch on `area/rentals-dispatch` (cross-card reflection) and `area/financials-kpi` (revenue netting)
**Status:** approved (Jac, 2026-06-23) — proceed to implementation plan

## Why

The **payment** half of #125 shipped — per-line allocation on a payment
(`allocLines` / `allocSectionHtml` / `setupPayAlloc` / `allocCharge`, app.js §19).
The **refund** half never got built: `refundInvoiceFlow` (app.js:12042) still
reverses the **whole** invoice in one shot. This spec builds the approved refund
half: assign refund dollars per line item, gray/strike/lock fully-refunded lines
and invoices, show each line's paid + refunded history, and **reflect a refunded
rental/unit on the rental itself** (Jac, 2026-06-23).

Decisions locked with Jac (2026-06-23):
- **All payment methods** get per-line / partial refunds (cash, check, **and** card
  — Stripe supports partial refunds of a PaymentIntent natively).
- **Settled model:** a refund never re-bills. Refunding $40 of a $100 fully-paid
  invoice returns $40 to the customer, marks the line refunded, and leaves the
  balance at **$0** — it does NOT spring a balance back (that was the #116 bug).
- The system must **know** an invoice was partially refunded behind the scenes, and
  a refunded **rental/unit must show it on the rental** (strikethrough + marker).

## 1. Data model — mirror the proven payment-allocation pattern

The §19 payment allocation already solved "track money per line across splices" by
keying on a **stable per-line `lid`**, never the array index (indices shift when a
line is spliced / No-Show'd / transport re-synced). Refunds mirror it exactly.

**The trust model mirrors the existing payment allocation exactly** (verified in
code): the per-line *split* is **client-owned** and rides the normal record sync
(`inv.allocations` is NOT in the sync-protected set and stores **pre-tax dollars**,
compared directly to `li.amount`); the money *totals* are **server-owned /
sync-protected** (`amountPaid`, `paymentMethod`, `paidAt`, `payments`, `refunded`,
`refundedAmount`). Refunds keep that division.

| Field | Owner | Meaning |
|---|---|---|
| `inv.refundAllocations` | **client** (synced normally, like `allocations`) | `{ lid: refundedDollars }` — refunded **pre-tax dollars** per line. New. |
| `inv.refundedAmount` | **server** (sync-protected) | running total refunded **dollars** (already exists; now accumulates across partial refunds). |
| `inv.refunded` | **server** (sync-protected) | bool — **fully** refunded = `refundedAmount >= amountPaid` (within a cent). |
| `inv.amountPaid` | **server** | **unchanged by a refund** (settled model → balance stays $0). |

Helpers (app.js, next to `itemPaid` / `rentalAllocated`) — dollars throughout, to
match `allocations` / `itemPaid`:

```js
// refunded so far on a line (dollars), capped at what was paid on it
function itemRefunded(inv, li) {
  if (!inv || !inv.refundAllocations) return 0;
  return Math.min(Number(inv.refundAllocations[lineKey(li)]) || 0, itemPaid(inv, li));
}
// still-refundable on a line = paid − already refunded
function itemRefundable(inv, li) { return Math.max(0, itemPaid(inv, li) - itemRefunded(inv, li)); }
// any refund recorded against this line?
function lineRefunded(inv, li) { return itemRefunded(inv, li) > 0.005; }
// fully refunded line = its paid is all returned
function lineFullyRefunded(inv, li) { return itemPaid(inv, li) > 0.005 && itemRefundable(inv, li) <= 0.005; }
```

`refundLines(inv)` mirrors `allocLines(inv)`: the lines still carrying a refundable
balance (`itemRefundable > 0.005`), each with `{ li, key, label, paid, refunded, refundable }`.

**Rejected alternatives:**
- Storing refund state on the `lineItem` object (`li.refunded`) — orphans on splice,
  the exact bug `lid`-keying exists to prevent.
- A full timestamped refund-ledger array (`inv.refunds = [{at, amount, alloc}]`) —
  richer audit but heavier; `logAction` already writes each refund event to invoice
  history, so the audit trail exists without a new array.

## 2. Backend contract (Code.gs via clasp — additive, money-path)

Because the per-line split is **client-owned** (§1), the backend change is **small and
additive**: each refund handler just learns an optional **partial amount**. The money
*total* stays the server's truth (#177); the per-line `refundAllocations` is merged
client-side in `applyPayment` and synced like `allocations` — the server never needs
the split.

```
recordManualRefund({ invoiceId, amountCents })   // cash / check
stripeRefundInvoice({ invoiceId, amountCents })   // card → Stripe partial refund
```
- `amountCents` = total being refunded **this call** (omitted ⇒ legacy full refund, so
  the call stays backward-compatible with the current server).
- **Server validates the total:** `amountCents ≤ (amountPaid − refundedAmount)` in cents.
  Reject an over-refund with a typed error. (Per-line caps are enforced in the UI; the
  split is client-owned, exactly like payment `allocations` today.)
- **Card:** issue a Stripe **partial** refund of `amountCents` against the captured
  PaymentIntent. Cash/check: hand-recorded, no processor.
- **Server mutates + persists (sync-protected):** `refundedAmount += amountCents/100`;
  **keep `amountPaid`**; set `refunded=true` only when fully refunded. Returns the new state.
- **Return shape** (consumed by `applyPayment`): `{ ok, amountPaid, refunded, refundedAmount, refundedCents (this event), locked, paymentMethod }`.
- Client side: `applyPayment` merges the just-refunded per-line split into
  `inv.refundAllocations` (the same way it merges a payment `alloc` into `allocations`)
  and the normal record sync persists it.
- Backend doc: write a `docs/handoffs/partial-refunds-backend.md` paste-ready handoff.
  **Ships via `/clasp` (additive, STOP-gate before prod)** — not git.

> **Until the backend ships:** a server that ignores `amountCents` falls back to a full
> refund — never a *wrong* partial. We do **not** show a per-line refund as succeeded
> unless the server confirms the new `refundedAmount` (no client-only money writes — #177).

## 3. Refund UI — refund mode in the existing pay popup

Today the **Refund** button sets `o.confirmRefund` → a one-line "Refund $X to the
card?" confirm (app.js:7968, 7984). Replace that with a **refund-allocation panel
that mirrors `allocSectionHtml` + `setupPayAlloc`** so it's already on-language:

- `refundSectionHtml(lines, o)` — one `.alloc-row` per `refundLines(inv)` entry:
  the line label, `/ $<refundable>` remaining, and a `$` input capped at the line's
  refundable (`o.refundAlloc[key]`, lazy-init to the full refundable = "refund in full").
- `setupRefundAlloc()` — DOM-driven live recompute (no re-render, keeps input focus,
  exactly like `setupPayAlloc`): updates `o.refundAlloc`, a "Refunding **$X** of
  $Y paid" counter, and the Confirm button's label/enabled state (enabled once the
  assigned total > $0).
- "Refund in full" shortcut mirrors "Pay in full" (`js-refund-auto`).
- Confirm (`js-refund-confirm`) → `refundInvoiceFlow(invoiceId)` now passes
  `{ amountCents, alloc }` resolved from `o.refundAlloc` (a `resolveRefund(inv, o)`
  mirroring `allocCharge`). The cash/check vs card branch in `refundInvoiceFlow`
  stays; both pass the alloc.
- `applyPayment` extended: accept the refund result, merge `refundAllocations`,
  set `refunded` only when fully refunded, keep `amountPaid`. The existing
  `if (inv.refunded) inv.allocations = {}` (full-refund release) stays for a full
  refund; a **partial** refund leaves `allocations` intact.

No new popup window (reuses the `payment` overlay kind) ⇒ `WINDOW_CATALOG` unchanged.
Refund rows reuse the existing `.alloc-*` classes / `data-r` stamps ⇒ no new R-rule.
(Confirm during build via `node ci/gen-rule-usage.mjs --check` + `check-window-catalog`.)

## 4. Line & invoice states (the gray/strike/lock from the approved plan)

- **Fully-refunded line** (`lineFullyRefunded`): in the invoice line list (app.js:4780)
  render the label struck through + greyed + a "↩ refunded" tag; its refundable is $0
  so it naturally drops out of both the pay panel (`allocLines`, already fully paid)
  and the refund panel (`refundLines`). Inputs are locked by absence.
- **Partially-refunded line:** show both figures on the line — the existing paid
  badge `${money2(paid)}✓` plus a new `↩${money2(refunded)}` refunded chip.
- **Fully-refunded invoice** (`inv.refunded`): status → **Refunded**, whole `inv-data`
  greys/strikes, Pay + Refund both disabled — already today's behavior (payCell 4796,
  pay popup 7981). Unchanged.

## 5. Cross-card reflection — refunds show on the rental (Jac's addition)

A refunded rental/unit must show on the **rental**, not just inside the invoice.
Invoice lines already map back: `li.ref === rentalId` (rental + transport lines),
`li.unitId` identifies the unit (`rentalLineItems` / `transportLineItems`, app.js:848/880).

- Helper `rentalLineRefund(r, unitId)` → looks up `r.invoiceId`'s invoice, finds the
  rental/transport line(s) for that unit, returns `{ refunded, fully }`.
- **Rental detail (standard mode) + rental rows:** a unit whose invoice line is
  fully refunded renders its unit pill / price **struck through** with a small
  "↩ refunded" marker; a partially-refunded unit gets the marker without the strike.
- Scope guard: read-only reflection — the rental view never *initiates* a refund,
  it only mirrors the invoice's refund state. Keep it to the unit/transport price
  display; no change to rental status/lifecycle.

## 6. Status & revenue correctness

- **Status:** lifecycle status stays **Paid** while only partially refunded (balance
  is settled), with a "↩ $X refunded" annotation in the pay popup + invoice ledger;
  only a **full** refund reads **Refunded**. (Decision: no new top-level status enum
  value — avoids rippling through every pill / KPI pie. A "Part. Refunded" pill was
  offered and declined.)
- **Revenue netting (money-correctness):** the financials KPI counts `collected += t.paid`
  (app.js:7125) — a refund should reduce booked revenue. Net it:
  `collected += t.paid − (inv.refundedAmount || 0)` for both partial and full refunds.
  Scoped, correct, rides along. (Verify against the §ROI/utilization readers so the
  netting is consistent wherever `t.paid` feeds a revenue number.)

## 7. Out of scope (YAGNI)

- Multi-currency, refund-to-a-different-method, refund reason codes.
- Re-rating an active rental on refund (that's the membership-lapse re-rate, separate).
- Bulk / cross-invoice refunds.

## 8. Testing

`ci/logic-test.mjs` additions (headless, money invariants — the source of truth):
- Per-line refund caps: a line's refund can't exceed its paid; invoice total refund
  can't exceed `amountPaid − refundedAmount`.
- **Settled-balance invariant:** after a partial refund, `invoiceTotals(inv).balance`
  is unchanged (stays $0 on a paid invoice) — the #116 guard, extended to partials.
- Full-refund-when-all-lines-refunded: refunding every line flips `inv.refunded` and
  status → Refunded.
- Revenue netting: `collected` drops by the refunded amount.
- Cross-card: `rentalLineRefund` reports a unit's refund state from its invoice.

Gates before push: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
`node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`; bump the
shared `?v=` cache token in `index.html`.

## 9. Build order (frontend first, backend in parallel via clasp)

1. Data-model helpers (`itemRefunded` / `itemRefundable` / `lineFullyRefunded` / `refundLines`) + `logic-test` cases.
2. Refund-allocation UI (`refundSectionHtml` / `setupRefundAlloc` / `resolveRefund`) wired into `refundInvoiceFlow` + `applyPayment`.
3. Line/invoice gray-strike-lock + per-line paid/refunded display.
4. Cross-card rental reflection (`rentalLineRefund` + rental render).
5. Revenue netting.
6. Backend handoff (`partial-refunds-backend.md`) + `/clasp` deploy of the
   `recordManualRefund` / `stripeRefundInvoice` partial contract (STOP-gate).

Front-end ships behind the contract; the per-line refund is only *shown as done*
once the backend confirms it (no client-only money writes — #177).
