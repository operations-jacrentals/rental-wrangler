# Backend handoff — partial / per-line refunds (#125)

Ships the remaining half of the #125 refund feature. **Validated against the LIVE backend
on 2026-06-23** (read via Drive/`clasp pull`, not assumed). The plan changed once we saw
the real code — read the status box before doing anything.

> ⚠️ **STOP-gate.** This touches the money path and ALL environments share one backend +
> Stripe. Deploy via `/clasp` only, with explicit confirmation. Do NOT flip
> `PARTIAL_REFUNDS_ENABLED` to true until the backend is live and a real partial refund is
> verified on a throwaway `DIAG-INV-*` record.

## STATUS — what's actually live (this is the important part)

- **Card path (`stripeRefundInvoice_`) is ALREADY deployed with partial-refund support.**
  It already reads `body.amountCents`, clamps it, and issues a **partial** Stripe refund.
  **Do not touch it.** It is our reference contract (the "net model" below).
- **Cash/check path (`recordManualRefund_`) is the ONLY backend change left.** Today it
  ignores `amountCents` and always refunds the full amount. We make it mirror the card
  handler (net model, honors `amountCents`).
- **Money model = NET (decided by Jac, 2026-06-23):** a refund **reduces `amountPaid`**
  (what the card handler already does), `refundedAmount` accumulates as the audit total,
  and `refunded` flips only when `amountPaid` hits $0. We are NOT keeping `amountPaid`
  gross.

### Live-bug note (a consequence of #279, intentionally deferred)
The `Collected` KPI netting `paid − refundedAmount` shipped live in #279. Under the net
model the card handler already reduced `amountPaid`, so that netting **double-subtracts**
for fully-refunded **card** invoices → Collected understates (can go negative) on the live
dashboard **right now**. Jac chose to **leave it until this full release** rather than ship
a standalone KPI PR. The fix (drop the `− refundedAmount`) is bundled into the frontend
step below — do not ship it separately.

## Contract (both handlers, net model)

`body.amountCents` is **optional**. Absent / `0` ⇒ refund the whole remaining (legacy full
refund). The per-line split stays **client-owned** (`inv.refundAllocations`, synced like
`inv.allocations`) — the server only owns the money totals and never reads/writes the split.

- `reqCents = body.amountCents != null ? Math.round(Number(body.amountCents)) : null`.
- `paidCents = round(amountPaid*100)`; reject `<= 0` with `{ ok:false, error:'nothing-to-refund' }`.
- Clamp: `cents = (reqCents && reqCents > 0) ? min(reqCents, paidCents) : paidCents`
  (the card handler additionally caps at the **last charge's** cents because Stripe refunds
  against one PaymentIntent; cash has no charge constraint, so the cap is just `paidCents`).
- `amountPaid = (paidCents − cents) / 100` — **reduced** by the refund.
- `refundedAmount = (prev refundedAmount) + cents/100` — **accumulates**.
- On full refund (`paidCents − cents <= 0`): `refunded = true; paid = false`.
- Append to `payments[]` (`type:'manual-refund'`) and the ledger (`-cents`), as today.
- Return `{ ok, status, amountPaid, refunded, refundedAmount, refundedCents }` where
  `refundedCents` is **this** event (for the history line).

## Reference — the LIVE card handler (the shape to mirror, secret-free)

```javascript
// stripeRefundInvoice_ (already live) — the net-model lines we copy:
var reqCents = body.amountCents != null ? Math.round(Number(body.amountCents)) : null;
// …clamp against the last charge…
var newPaidCents = paidCents - cents;
inv.amountPaid     = newPaidCents / 100;
inv.refundedAmount = (Number(inv.refundedAmount) || 0) + cents / 100;
inv.payments.push({ type: 'refund', refundId: b.id, paymentIntentId: lastPi, amountCents: cents, at: ..., role: role });
if (newPaidCents <= 0) { inv.refunded = true; inv.paid = false; }
```

## `recordManualRefund_` (cash / check) — REPLACE the body with this

```javascript
function recordManualRefund_(body, role) {
  var invoiceId = String(body.invoiceId || '');
  var reqCents = body.amountCents != null ? Math.round(Number(body.amountCents)) : null;  // 0/absent → full remaining
  var lock = tryLock_(20000); if (!lock) return { ok: false, error: 'busy' };
  try {
    var inv = readRecord_('invoices', invoiceId);
    if (!inv) return { ok: false, error: 'invoice-not-found' };
    var paidCents = Math.round((Number(inv.amountPaid) || 0) * 100);
    if (paidCents <= 0) return { ok: false, error: 'nothing-to-refund' };
    var cents = (reqCents && reqCents > 0) ? Math.min(reqCents, paidCents) : paidCents;   // cash cap = full net paid
    if (!(cents > 0)) return { ok: false, error: 'bad-refund-amount' };
    var newPaidCents = paidCents - cents;
    inv.amountPaid = newPaidCents / 100;                                                  // NET model: reduce amountPaid
    inv.refundedAmount = (Number(inv.refundedAmount) || 0) + cents / 100;                 // accumulate the audit total
    inv.payments = inv.payments || [];
    inv.payments.push({ type: 'manual-refund', amountCents: cents, at: new Date().toISOString(), role: role });
    if (newPaidCents <= 0) { inv.refunded = true; inv.paid = false; }                     // only a FULL refund flips it
    writeRecord_('invoices', inv);
    try { appendLedger_([new Date().toISOString(), invoiceId, inv.customerId || '', -cents, '', role, 'manual-refund']); } catch (e) {}
    return { ok: true, status: inv.refunded ? 'refunded' : 'partial-refund', refunded: !!inv.refunded,
             refundedAmount: inv.refundedAmount, refundedCents: cents, amountPaid: inv.amountPaid };
  } finally { lock.releaseLock(); }
}
```

**What changes vs. today:** the full-refund case now **reduces `amountPaid` to $0** (today it
left it). That's the whole point of the net model and makes cash consistent with the card
handler. Helpers (`tryLock_`, `readRecord_`, `writeRecord_`, `appendLedger_`) and the
`payments[]` / ledger shapes are unchanged — confirmed against live source.

`inv.refundAllocations` is **not** read or written by the server — the front-end merges the
per-line split locally (in `applyPayment`) and it syncs like `inv.allocations`.

## Frontend changes — ship in the SAME release as the backend deploy

`applyPayment` (app.js) already adopts the server's `amountPaid`/`refunded`/`refundedAmount`,
so it's net-model-ready. Two correctness edits + the flag flip:

1. **Collected KPI → drop the netting** (the deferred #279 fix). Three sites compute
   `invoiceTotals(i).paid − (Number(i.refundedAmount) || 0)` — change each to just
   `invoiceTotals(i).paid` (since `amountPaid` is now net):
   - `app.js` ~L5937 (dashboard `collected`)
   - `app.js` ~L6120 (office role KPI)
   - `app.js` ~L7452 (`collected += t.paid …`, drop the `§19b` netting comment)
2. **`invoiceTotals` — net refunded out of balance/status** so a *partial* refund reads a
   $0 balance instead of a phantom "Partial / $X due". In `invoiceTotals` (app.js ~L1278):
   keep the gross `total` for display, but compute
   `balance = total − (Number(inv.refundedAmount) || 0) − paid` and use
   `effTotal = total − refundedAmount` for the Paid/Partial thresholds. Safe for
   non-refunded invoices (`refundedAmount = 0` ⇒ unchanged). **Verify with
   `ci/logic-test.mjs`** — add a partial-refund case.
3. **Flip `PARTIAL_REFUNDS_ENABLED = true`** and **bump the shared `?v=` token** in
   `index.html` (style.css + rule-usage.js + app.js).

## Deploy sequence (backend + frontend can't be atomic — minimize the gap)

1. `/clasp` STOP-gate → `clasp pull`, splice the `recordManualRefund_` replacement into
   `Code.js`, `clasp push --force`, `clasp deploy -i <prod-id>` (same exec URL).
2. **Verify on a throwaway `DIAG-INV-*`** (create → refund → read back → delete):
   - partial cash refund: `amountPaid` drops by the refund, `refunded:false`,
     `refundedAmount` grows, status `partial-refund`;
   - refunding the remainder: `amountPaid→0`, `refunded:true`, status `refunded`.
3. Ship the frontend PR (steps 1–3 above) → squash-merge to `main` → confirm Pages serves
   the new `?v=`. The gap between the backend deploy and this is the only window where the
   KPI is briefly off (cash refunds understate, like the card bug) — keep it short.
4. Smoke a real partial **card** refund (issues a partial Stripe refund, not full) and a
   real partial **cash** refund end-to-end. Gates: `node ci/smoke.mjs`,
   `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`,
   `node ci/check-window-catalog.mjs` (port 8000→9147 first).
