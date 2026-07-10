/* ════════════════════════════════════════════════════════════════════════
 * Backend audit (2026-07-09, 8-agent adversarial pass over live Code.gs) —
 * CRITICAL fixes #3 (seed) and #4 (recordCharge_), prepared per Jac's
 * decisions. Secret-free; both are drop-in replacements for the live
 * functions (pulled fresh via the Apps Script REST API, service account,
 * read-only — no deploy risk in the pulling).
 * ════════════════════════════════════════════════════════════════════════ */

/* ── CRITICAL #3a — seed gated to Admin+ (dispatch-level, in handle()) ──────
 * WAS: any signed-in role (even lowest 'staff' tier) could call `seed`, a
 * full destructive database replace — the app's own UI only ever fires it
 * from the admin-only #reseed bootstrap flow, but the backend never
 * enforced that. Matches the existing isAdmin gate used for getConfig/
 * feedbackList/setViews. load/sync are UNCHANGED (stay open to any signed-in
 * role — normal day-to-day staff CRUD needs them).
 *
 * Replace this line in handle()'s dispatch:
 *   else if (action === 'seed') out = doSeed(body.data || {});
 * with:
 *   else if (action === 'seed') out = isAdmin(pw) ? doSeed(body.data || {}) : { ok: false, error: 'forbidden' };
 * ────────────────────────────────────────────────────────────────────── */

/* ── CRITICAL #3b — doSeed no longer wipes an entity absent from the payload ──
 * WAS: `var arr = data[entity] || []` treated "entity key missing from the
 * client's payload" the same as "entity should be emptied" — `s.clear()` ran
 * unconditionally for every entity in ENTITIES regardless of whether the
 * caller sent anything for it. A future ENTITIES/PERSIST_KEYS drift (backend
 * list vs. frontend's dataSnapshot() list going out of sync) would silently
 * delete every row of the forgotten entity on the next admin reseed, with no
 * warning. Fix: skip any entity not present as a key in `data` — leave its
 * sheet untouched instead of wiping it. REPLACES doSeed in Code.gs. */
function doSeed(data) {
  var lock = tryLock_(30000); if (!lock) return { ok: false, error: 'busy' };
  try {
    ENTITIES.forEach(function (entity) {
      if (!(entity in data)) return;   // omitted entity — leave its sheet untouched, don't wipe it
      var arr = data[entity] || [], s = sheetFor(entity), idf = ID_FIELD[entity];
      s.clear();
      s.getRange(1, 1, 1, 2).setValues([['id', 'json']]);
      if (arr.length) {
        var rows = arr.map(function (r) { return [String(r[idf] == null ? '' : r[idf]), JSON.stringify(r)]; });
        s.getRange(2, 1, rows.length, 2).setValues(rows);
      }
    });
  } finally { lock.releaseLock(); }
  return { ok: true, seeded: true };
}

/* ── CRITICAL #4 — recordCharge_ de-dup guard against a repeat invocation ──
 * WAS: the only duplicate guard covered ACH-pending→charge promotion; a
 * SECOND call with a PaymentIntent id already recorded as type:'charge'
 * (a client retry after a network hiccup, a double-click, etc.) would
 * unconditionally re-add `cents` to amountPaid and push a second payments
 * row — inflating the invoice's recorded paid amount with no matching
 * second charge on the card (Stripe's own idempotency key prevents an
 * actual double-charge; this is a BOOKKEEPING bug, not a billing one, but a
 * real one: the invoice would show more collected than was ever charged).
 * Fix: if this PaymentIntent id is already recorded as a 'charge', treat the
 * call as an idempotent no-op and return the invoice's current state
 * instead of re-applying it. REPLACES recordCharge_ in Code.gs. */
function recordCharge_(inv, cust, piBody, cents, role) {
  var already = (inv.payments || []).filter(function (p) { return p.paymentIntentId === piBody.id && p.type === 'charge'; })[0];
  if (already) {   // already recorded — idempotent no-op, do NOT re-add to amountPaid
    return { ok: true, status: 'succeeded', paymentIntentId: piBody.id, paid: inv.paid, fullyPaid: inv.paid,
      paidAt: inv.paidAt, chargedCents: 0, amountPaid: inv.amountPaid, paymentMethod: inv.paymentMethod, locked: !!inv.locked };
  }
  var total = computeInvoiceCents_(inv).totalCents;
  var newPaidCents = Math.round((Number(inv.amountPaid) || 0) * 100) + cents;
  inv.amountPaid = newPaidCents / 100;
  inv.payments = inv.payments || [];
  var pendingAch = inv.payments.filter(function (p) { return p.paymentIntentId === piBody.id && p.type === 'ach-pending'; })[0];
  if (pendingAch) { pendingAch.type = 'charge'; pendingAch.settledAt = new Date().toISOString(); }   // §14b ACH settled → promote the pending marker (no dup)
  else inv.payments.push({ type: 'charge', paymentIntentId: piBody.id, amountCents: cents, at: new Date().toISOString(), role: role });
  inv.lastPaymentIntentId = piBody.id;
  var achK = (cust.achAccounts || []).filter(function (k) { return k.stripePmId === piBody.payment_method; })[0];   // §14b label by method
  inv.paymentMethod = achK ? ((achK.bankName || 'Bank') + ' ••' + (achK.last4 || '')) : (cust.cardBrand ? (cust.cardBrand + ' ••••' + (cust.cardLast4 || '')) : 'Card');
  if (inv.achProcessing) delete inv.achProcessing;
  inv.paid = (total > 0 && newPaidCents >= total);     // fully paid? (status itself is derived from amountPaid)
  inv.paidAt = new Date().toISOString();
  if (inv.pendingPaymentIntentId) delete inv.pendingPaymentIntentId;   // 3DS resolved
  if (inv.refunded) delete inv.refunded;                               // a new charge un-refunds
  if (!inv.lineItemsSig) { inv.lineItemsSig = signInvoice_(inv); inv.locked = true; }   // first charge seals the pricing
  writeRecord_('invoices', inv);                                       // persist FIRST (arms guards)
  try { appendLedger_([new Date().toISOString(), inv.invoiceId, inv.customerId || '', cents, cust.stripeId || '', role, 'charge']); } catch (e) {}
  return { ok: true, status: 'succeeded', paymentIntentId: piBody.id, paid: inv.paid, fullyPaid: inv.paid,
    paidAt: inv.paidAt, chargedCents: cents, amountPaid: inv.amountPaid, paymentMethod: inv.paymentMethod, locked: !!inv.locked };
}
