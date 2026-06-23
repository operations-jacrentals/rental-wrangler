# Backend handoff — partial / per-line refunds (#125)

Ships the backend half of the #125 refund feature. **Additive + backward-compatible.**
The front-end is gated behind `PARTIAL_REFUNDS_ENABLED` (app.js) — keep it **false until
this is deployed and smoke-tested**, then flip it on in the same release.

> ⚠️ **STOP-gate.** This touches the money path and ALL environments share one backend +
> Stripe. Deploy via `/clasp` only, with explicit confirmation. Do NOT flip
> `PARTIAL_REFUNDS_ENABLED` to true until this is live and a real partial refund is verified.

## Contract

Both refund handlers learn an **optional** `body.amountCents` (the partial total to refund
this call). Omitted ⇒ today's full refund (unchanged). The per-line split stays
**client-owned** (`inv.refundAllocations`, synced like `inv.allocations`) — the server only
owns the money totals, so it never needs the split.

Server rules (both handlers):
- `reqCents = Math.round(Number(body.amountCents) || 0)` — `0`/absent ⇒ refund the whole
  remaining (`amountPaid − refundedAmount`), i.e. legacy behavior.
- Clamp: `refundCents = min(reqCents || remainingCents, remainingCents)` where
  `remainingCents = round(amountPaid*100) − round((refundedAmount||0)*100)`. Reject `<= 0`
  with `{ ok:false, error:'nothing-to-refund' }`.
- `inv.refundedAmount = (prevRefundedCents + refundCents) / 100`.
- `inv.refunded = (prevRefundedCents + refundCents) >= round(amountPaid*100) - 1` (fully
  refunded within a cent). **Keep `amountPaid`** (settled model → balance stays $0).
- Return `refundedCents` = **this** event (for the history line), plus `refunded`,
  `refundedAmount`, `amountPaid`.

## `recordManualRefund_` (cash / check) — replace the body

```javascript
function recordManualRefund_(body, role) {
  var invoiceId = String(body.invoiceId || '');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var inv = readRecord_('invoices', invoiceId);
    if (!inv) return { ok: false, error: 'invoice-not-found' };
    var paidCents = Math.round((Number(inv.amountPaid) || 0) * 100);
    var prevCents = Math.round((Number(inv.refundedAmount) || 0) * 100);
    var remaining = paidCents - prevCents;
    if (remaining <= 0) return { ok: false, error: 'nothing-to-refund' };
    var req = Math.round(Number(body.amountCents) || 0);           // 0/absent → full remaining
    var refundCents = req > 0 ? Math.min(req, remaining) : remaining;
    var totalRefunded = prevCents + refundCents;
    inv.refundedAmount = totalRefunded / 100;
    inv.refunded = totalRefunded >= paidCents - 1;                 // fully refunded within a cent
    inv.payments = inv.payments || [];
    inv.payments.push({ type: 'manual-refund', amountCents: refundCents, at: new Date().toISOString(), role: role });
    writeRecord_('invoices', inv);
    try { appendLedger_([new Date().toISOString(), invoiceId, inv.customerId || '', -refundCents, '', role, 'manual-refund']); } catch (e) {}
    return { ok: true, status: inv.refunded ? 'refunded' : 'partial-refund', refunded: inv.refunded,
             refundedAmount: inv.refundedAmount, refundedCents: refundCents, amountPaid: Number(inv.amountPaid) || 0 };
  } finally { lock.releaseLock(); }
}
```

## `stripeRefundInvoice_` (card) — the same clamp + a Stripe **partial** refund

Mirror the clamp above, then issue a Stripe refund of `refundCents` against the captured
PaymentIntent (Stripe supports partial refunds natively):

```javascript
// inside stripeRefundInvoice_, after computing refundCents the same way:
var resp = stripeApi_('refunds', { payment_intent: inv.paymentIntentId, amount: refundCents });
// (existing full-refund call just omits `amount`; adding it makes it partial)
if (resp && resp.id) {
  var totalRefunded = prevCents + refundCents;
  inv.refundedAmount = totalRefunded / 100;
  inv.refunded = totalRefunded >= paidCents - 1;
  // keep amountPaid; append payments[] + ledger as today
  return { ok: true, status: inv.refunded ? 'refunded' : 'partial-refund', refunded: inv.refunded,
           refundedAmount: inv.refundedAmount, refundedCents: refundCents, amountPaid: Number(inv.amountPaid) || 0 };
}
```

Note: `inv.refundAllocations` is **not** read or written by the server — the front-end
merges the per-line split locally (in `applyPayment`) and it syncs like `inv.allocations`.

## After deploy
1. Verify a **partial** cash refund: refunded total grows, status stays `partial-refund`
   while `< amountPaid`, balance stays $0.
2. Verify a partial **card** refund actually issues a partial Stripe refund (not full).
3. Verify refunding the remainder flips `refunded:true` → status `Refunded`.
4. Flip `PARTIAL_REFUNDS_ENABLED = true` in app.js, bump the `?v=` token, ship.
