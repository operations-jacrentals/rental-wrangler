/* ════════════════════════════════════════════════════════════════════════
 * Backend audit (2026-07-09) — the last 6 MEDIUM findings, all now fixed
 * and pushed to HEAD. Closes out the full 32-finding audit (4 critical + 16
 * medium all resolved; the 7 high / 5 low from the original 54-item
 * pre-promotion audit tracker were separate and already resolved earlier).
 * ════════════════════════════════════════════════════════════════════════ */

/* ── #9 — getConfigObj(): was silently discarding ALL custom role passwords
 * and reseeding DEFAULT_CONFIG whenever `admin` was falsy/missing, even with
 * `roles` fully intact — contradicts the file's own stated intent
 * (backfillRoles_'s comment: "Only seed defaults if a stored config has
 * somehow lost ALL roles"). Fix: repair just the missing `admin` field when
 * roles exist, never wipe roles for that alone. REPLACES getConfigObj: ── */
function getConfigObj() {
  var s = ss().getSheetByName(CONFIG_TAB);
  if (s) {
    var raw = s.getRange(1, 1).getValue();
    if (raw) {
      try {
        var c = JSON.parse(raw);
        if (c && c.roles && Object.keys(c.roles).length) {   // has real role data — REPAIR admin if missing, never wipe roles for that alone
          if (!c.admin) {
            c.admin = DEFAULT_CONFIG.admin;
            var lock1 = tryLock_(15000);
            if (lock1) { try { saveConfigObj(c); } catch (e) {} finally { lock1.releaseLock(); } }
          }
          return backfillRoles_(c);
        }
      } catch (e) {}
    }
  }
  var lock0 = tryLock_(15000);   // first run / roles truly gone → seed defaults (locked)
  if (lock0) { try { saveConfigObj(DEFAULT_CONFIG); } finally { lock0.releaseLock(); } }
  return DEFAULT_CONFIG;
}

/* ── #13 — invoice price-lock seal didn't pin the CUSTOMER's salesTaxExempt
 * flag (only the invoice's own taxExempt), even though computeInvoiceCents_
 * uses both — a locked invoice's charged total wasn't fully pinned by the
 * seal. NOT a signature-format change (would break every already-locked
 * invoice's seal check) — instead, freeze the customer's exemption INTO
 * inv.taxExempt at the moment of first sealing, and once locked, stop
 * re-reading the live customer record. Two small changes: ── */
// In computeInvoiceCents_, replace:
//   var exempt = !!(inv.taxExempt || (cust && cust.salesTaxExempt));
// with:
//   var exempt = inv.locked ? !!inv.taxExempt : !!(inv.taxExempt || (cust && cust.salesTaxExempt));
//
// In recordCharge_, replace the sealing line:
//   if (!inv.lineItemsSig) { inv.lineItemsSig = signInvoice_(inv); inv.locked = true; }
// with:
//   if (!inv.lineItemsSig) { inv.taxExempt = !!(inv.taxExempt || (cust && cust.salesTaxExempt)); inv.lineItemsSig = signInvoice_(inv); inv.locked = true; }

/* ── #14 — membershipActivate_'s Stripe idempotency key was scoped to the
 * calendar day (todayIso_()). A retry after a local-persistence failure
 * that crosses midnight got a DIFFERENT key → Stripe treats it as a new
 * request → real duplicate subscription + double charge. Fix: drop the day
 * scoping entirely — Stripe's own ~24h idempotency window already governs
 * key reuse correctly, the day-scoping was redundant AND harmful exactly at
 * the boundary it most needed to protect. One-line change: ── */
// var r = stripeApi_('post', 'subscriptions', params, 'mbrsub_' + customerId + '_' + plan);

/* ── #11 — stripeRefundInvoice_'s default "full" refund was capped at only
 * the LAST charge's amount, not the invoice's total amountPaid — silently
 * under-refunding any invoice paid via more than one charge (Stripe refunds
 * are per-PaymentIntent, so a multi-charge invoice needs multiple refund
 * calls). REPLACES stripeRefundInvoice_ — now walks charges most-recent-
 * first, refunding each PaymentIntent up to its own remaining balance until
 * the requested total is covered: ── */
function stripeRefundInvoice_(body, role) {
  var invoiceId = String(body.invoiceId || '');
  var reqCents = body.amountCents != null ? Math.round(Number(body.amountCents)) : null;
  var lock = tryLock_(20000); if (!lock) return { ok: false, error: 'busy' };
  try {
    var inv = readRecord_('invoices', invoiceId);
    if (!inv) return { ok: false, error: 'invoice-not-found' };
    var paidCents = Math.round((Number(inv.amountPaid) || 0) * 100);
    if (paidCents <= 0) return { ok: false, error: 'nothing-to-refund' };
    var charges = (inv.payments || []).filter(function (p) { return p.type === 'charge' && p.paymentIntentId; });
    if (!charges.length) return { ok: false, error: 'no-charge-to-refund' };
    var already = {};   // paymentIntentId -> cents already refunded against it
    (inv.payments || []).forEach(function (p) { if (p.type === 'refund' && p.paymentIntentId) already[p.paymentIntentId] = (already[p.paymentIntentId] || 0) + (Number(p.amountCents) || 0); });
    var want = (reqCents && reqCents > 0) ? Math.min(reqCents, paidCents) : paidCents;
    if (!(want > 0)) return { ok: false, error: 'bad-refund-amount' };
    var remaining = want, refunded = 0, newPayments = [];
    for (var i = charges.length - 1; i >= 0 && remaining > 0; i--) {
      var ch = charges[i];
      var avail = (Number(ch.amountCents) || 0) - (already[ch.paymentIntentId] || 0);
      if (avail <= 0) continue;
      var take = Math.min(avail, remaining);
      var rf = stripeApi_('post', 'refunds', { payment_intent: ch.paymentIntentId, amount: take, 'metadata[invoiceId]': invoiceId, 'metadata[role]': role });
      var b = rf.body || {};
      if (!rf.ok || !(b.status === 'succeeded' || b.status === 'pending')) {
        if (refunded > 0) break;   // partial progress already made — report what succeeded rather than error the whole call
        return { ok: false, error: (b.error && b.error.code) || 'refund-failed' };
      }
      newPayments.push({ type: 'refund', refundId: b.id, paymentIntentId: ch.paymentIntentId, amountCents: take, at: new Date().toISOString(), role: role });
      refunded += take; remaining -= take;
    }
    if (refunded <= 0) return { ok: false, error: 'no-charge-to-refund' };
    var newPaidCents = paidCents - refunded;
    inv.amountPaid = newPaidCents / 100;
    inv.refundedAmount = (Number(inv.refundedAmount) || 0) + refunded / 100;
    inv.payments = (inv.payments || []).concat(newPayments);
    if (newPaidCents <= 0) { inv.refunded = true; inv.paid = false; }
    writeRecord_('invoices', inv);
    try { appendLedger_([new Date().toISOString(), invoiceId, inv.customerId || '', -refunded, '', role, 'refund']); } catch (e) {}
    return { ok: true, status: 'succeeded', amountPaid: inv.amountPaid, refunded: !!inv.refunded, refundedAmount: inv.refundedAmount, refundedCents: refunded };
  } finally { lock.releaseLock(); }
}

/* ── #6/#7 — wranglerReply_ (paid Claude calls) and wranglerFile_ (GitHub
 * issue filing, can auto-trigger the fix engine) had no rate limit at all.
 * Jac's call: ONE shared GLOBAL daily cap of 100 across both, not per-role.
 * New shared helper + one guard line added near the top of each function: ── */
function wranglerRateLimitOk_() {
  var lock = tryLock_(10000); if (!lock) return false;   // busy → fail closed
  try {
    var props = PropertiesService.getScriptProperties();
    var today = todayIso_();
    var state = {}; try { state = JSON.parse(props.getProperty('WRANGLER_USAGE_TODAY') || '{}'); } catch (e) {}
    if (state.date !== today) state = { date: today, count: 0 };
    var cap = Number(props.getProperty('WRANGLER_DAILY_CAP')) || 100;   // tunable without a redeploy
    if (state.count >= cap) return false;
    state.count++;
    props.setProperty('WRANGLER_USAGE_TODAY', JSON.stringify(state));
    return true;
  } finally { lock.releaseLock(); }
}
// wranglerReply_ gains, right after the API-key check:
//   if (!wranglerRateLimitOk_()) return { error: 'Daily Mr. Wrangler usage cap reached — try again tomorrow.' };
// wranglerFile_ gains, right after the GitHub-token check:
//   if (!wranglerRateLimitOk_()) return { ok: false, error: 'rate-limited' };
