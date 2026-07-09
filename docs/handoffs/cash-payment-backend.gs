/* ════════════════════════════════════════════════════════════════════════
 * MANUAL CASH / CHECK payments + refunds — backend fix (2026-06-19)
 * -------------------------------------------------------------------------
 * BUG: invoice money fields (amountPaid, payments, paymentMethod, paidAt,
 * refunded, refundedAmount) are server-owned / sync-PROTECTED (PROTECTED.invoices)
 * so a client can't fake a Stripe outcome. That ALSO silently stripped legitimate
 * manual cash/check payments + refunds on sync, so they "reverted" on refresh.
 *
 * FIX: record them SERVER-SIDE via two money-role actions (mirrors the Stripe
 * charge's server-authority). The frontend (recordManualPayment / refundInvoiceFlow
 * cash branch) now calls these and applies the result via applyPayment(), instead
 * of writing the protected fields locally and relying on the (stripping) sync.
 *
 * This file is the tracked source of truth — NO secrets. Two edits to Code.gs:
 *
 * EDIT 1 — dispatch (in handle(), right after the membershipActivate line):
 *   if (action === 'recordManualPayment') return json(roleMoneyOk_(role) ? recordManualPayment_(body, role) : { ok: false, error: 'forbidden' });
 *   if (action === 'recordManualRefund')  return json(roleMoneyOk_(role) ? recordManualRefund_(body, role) : { ok: false, error: 'forbidden' });
 *
 * CONFIRMED against the live Code.gs (Drive read, 2026-07-09): both dispatch
 * lines already use roleMoneyOk_ in production — this file was stale (still
 * showed the pre-migration MONEY_ROLES[role] form), now corrected to match.
 *
 * EDIT 2 — paste the two functions below (anywhere top-level; e.g. after the
 * Stripe section). They reuse existing helpers: readRecord_, writeRecord_,
 * computeInvoiceCents_, appendLedger_, MAX_CHARGE_CENTS.
 * ════════════════════════════════════════════════════════════════════════ */

// Record a manual CASH / CHECK payment. Money role only. Caps at the live balance,
// derives amountPaid + paid, appends to payments[], audits to the ledger.
function recordManualPayment_(body, role) {
  var invoiceId = String(body.invoiceId || '');
  var method = /check/i.test(String(body.method || '')) ? 'check' : 'cash';
  var reqCents = Math.round(Number(body.amountCents) || 0);
  var checkNum = String(body.checkNum || '').replace(/[^\w \-#]/g, '').slice(0, 40);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var inv = readRecord_('invoices', invoiceId);
    if (!inv) return { ok: false, error: 'invoice-not-found' };
    var amt = computeInvoiceCents_(inv), balance = amt.balanceCents;
    if (balance <= 0) return { ok: true, status: 'succeeded', alreadyPaid: true, amountPaid: Number(inv.amountPaid) || 0, paymentMethod: inv.paymentMethod || '' };
    if (!(reqCents > 0)) return { ok: false, error: 'bad-amount' };
    if (reqCents > MAX_CHARGE_CENTS) return { ok: false, error: 'over-ceiling' };
    var cents = Math.min(reqCents, balance);                          // never overpay
    var label = method === 'check' ? ('Check' + (checkNum ? ' #' + checkNum : '')) : 'Cash';
    inv.amountPaid = (Math.round((Number(inv.amountPaid) || 0) * 100) + cents) / 100;
    inv.payments = inv.payments || [];
    inv.payments.push({ type: method, amountCents: cents, at: new Date().toISOString(), role: role, checkNum: checkNum || '' });
    inv.paymentMethod = label;
    inv.paidAt = new Date().toISOString();
    inv.paid = (amt.totalCents > 0 && Math.round(inv.amountPaid * 100) >= amt.totalCents);
    if (inv.refunded) delete inv.refunded;                            // a fresh payment un-refunds
    writeRecord_('invoices', inv);
    try { appendLedger_([new Date().toISOString(), invoiceId, inv.customerId || '', cents, '', role, method]); } catch (e) {}
    return { ok: true, status: 'succeeded', amountPaid: inv.amountPaid, paid: inv.paid, paidAt: inv.paidAt, paymentMethod: label, chargedCents: cents };
  } finally { lock.releaseLock(); }
}

// Manual CASH / CHECK refund (no Stripe to reverse). Money role only. Keeps amountPaid
// (so the balance still reads $0) and flips inv.refunded → status Refunded.
function recordManualRefund_(body, role) {
  var invoiceId = String(body.invoiceId || '');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var inv = readRecord_('invoices', invoiceId);
    if (!inv) return { ok: false, error: 'invoice-not-found' };
    var paidCents = Math.round((Number(inv.amountPaid) || 0) * 100);
    if (paidCents <= 0) return { ok: false, error: 'nothing-to-refund' };
    inv.refunded = true; inv.refundedAmount = paidCents / 100;
    inv.payments = inv.payments || [];
    inv.payments.push({ type: 'manual-refund', amountCents: paidCents, at: new Date().toISOString(), role: role });
    writeRecord_('invoices', inv);
    try { appendLedger_([new Date().toISOString(), invoiceId, inv.customerId || '', -paidCents, '', role, 'manual-refund']); } catch (e) {}
    return { ok: true, status: 'refunded', refunded: true, refundedAmount: inv.refundedAmount, refundedCents: paidCents, amountPaid: Number(inv.amountPaid) || 0 };
  } finally { lock.releaseLock(); }
}
