/* ════════════════════════════════════════════════════════════════════════
 * Stripe money actions — AS-BUILT REFERENCE (read from live Code.gs via the
 * Drive connector 2026-07-09, for the #552 pre-promotion audit's "no
 * snippet exists for the largest money-critical backend surface" gap).
 * NO secrets below — STRIPE_SECRET / STRIPE_PUBLISHABLE_KEY are read from
 * PropertiesService only, never hardcoded, never echoed (stripeDiag reports
 * only whether it's configured + its key-mode prefix, never the value).
 * -------------------------------------------------------------------------
 * Central gate (handle(), after the role/password auth check): every
 * action name prefixed "stripe" (except stripePubKey, public-by-design, and
 * stripeDiag) goes through ONE money-tier check before any handler runs —
 * confirms the r5/r9-class frontend gap audit found does NOT exist on the
 * backend; this is exactly the "check centrally, not per-handler" pattern
 * the frontend audit (item 4) was retrofitted to match:
 *
 *   if (action && action.indexOf('stripe') === 0) {
 *     if (!roleMoneyOk_(role)) return json({ ok: false, error: 'forbidden' });
 *     if (action === 'stripeDiag') { ... reports configured + key-mode only ... }
 *     if (action === 'stripeSetupIntent')     return json(stripeSetupIntent_(body, role));
 *     if (action === 'stripeSaveCard')        return json(stripeSaveCard_(body, role));
 *     if (action === 'stripeBankSetupIntent') return json(stripeBankSetupIntent_(body, role));   // §14b ACH
 *     if (action === 'stripeSaveBank')        return json(stripeSaveBank_(body, role));          // §14b ACH
 *     if (action === 'stripeVerifyBank')      return json(stripeVerifyBank_(body, role));        // §14b ACH
 *     if (action === 'stripeSetDefault')      return json(stripeSetDefault_(body, role));
 *     if (action === 'stripeRemoveCard')      return json(stripeRemoveCard_(body, role));
 *     if (action === 'stripeListCards')       return json(stripeListCards_(body, role));
 *     if (action === 'stripeChargeInvoice')   return json(stripeChargeInvoice_(body, role));
 *     if (action === 'stripeFinalizeInvoice') return json(stripeFinalizeInvoice_(body, role));
 *     if (action === 'stripeRefundInvoice')   return json(stripeRefundInvoice_(body, role));
 *     if (action === 'stripeLockInvoice')     return json(stripeLockInvoice_(body, role));
 *     if (action === 'stripeUnlockInvoice')   return json(stripeUnlockInvoice_(body, role));
 *     return json({ ok: false, error: 'unknown action' });
 *   }
 *
 * stripePubKey is handled separately, above the role gate — public by design
 * (any signed-in role reads it so the client runs Stripe in the same
 * test↔live mode as the secret key, no code change needed on rotation).
 * ════════════════════════════════════════════════════════════════════════ */

// Bootstraps a Stripe Customer for this app-customer on first use, then opens
// a SetupIntent (off_session, card-only) for the browser to confirm. The
// resulting clientSecret never touches this backend again until confirmed.
function stripeSetupIntent_(body, role) {
  var customerId = String(body.customerId || '');
  var lock = tryLock_(15000); if (!lock) return { ok: false, error: 'busy' };
  try {
    var rec = readRecord_('customers', customerId);
    if (!rec) return { ok: false, error: 'customer-not-found' };
    if (!rec.stripeId) {
      var cr = stripeApi_('post', 'customers', {
        name: rec.name || ((rec.firstName || '') + ' ' + (rec.lastName || '')).trim(),
        email: rec.email || '', phone: rec.phone || '', 'metadata[customerId]': customerId
      });
      if (!cr.ok || !cr.body.id) return { ok: false, error: 'stripe-customer-failed' };
      rec.stripeId = cr.body.id; writeRecord_('customers', rec);
    }
    var si = stripeApi_('post', 'setup_intents', {
      customer: rec.stripeId, usage: 'off_session', 'payment_method_types[]': 'card',
      'metadata[customerId]': customerId, 'metadata[role]': role
    });
    if (!si.ok || !si.body.client_secret) return { ok: false, error: 'stripe-setupintent-failed' };
    return { ok: true, clientSecret: si.body.client_secret, setupIntentId: si.body.id, stripeId: rec.stripeId };
  } finally { lock.releaseLock(); }
}

// Charges an invoice's live balance (or a capped partial). Re-uses an
// in-flight PaymentIntent instead of ever opening a second one (guards
// double-charge), enforces MAX_CHARGE_CENTS, handles 3DS (requires_action)
// and ACH (processing) as distinct outcomes, and idempotency-keys every
// Stripe call on (invoiceId, amount, attempt) so a network retry can never
// double-charge. invoiceSealOk_() re-verifies a LOCKED invoice wasn't
// altered since sealing before charging it — the server-side half of the
// same §7.5 lock the frontend enforces (see #552 audit item 5's
// billWOToInvoice fix for the frontend-side analog of this kind of check).
function stripeChargeInvoice_(body, role) {
  var invoiceId = String(body.invoiceId || '');
  var reqCents = body.amountCents != null ? Math.round(Number(body.amountCents)) : null;   // optional partial request
  var lock = tryLock_(20000); if (!lock) return { ok: false, error: 'busy' };
  try {
    var inv = readRecord_('invoices', invoiceId);
    if (!inv) return { ok: false, error: 'invoice-not-found' };
    if (!invoiceSealOk_(inv)) return { ok: false, error: 'invoice-integrity' };       // locked invoice was altered since sealing
    var amt = computeInvoiceCents_(inv), balance = amt.balanceCents;
    if (balance <= 0) return { ok: true, status: 'succeeded', alreadyPaid: true, amountPaid: Number(inv.amountPaid) || 0 };
    var cust = inv.customerId ? readRecord_('customers', inv.customerId) : null;
    if (!cust || !cust.stripeId) return { ok: false, error: 'no-stripe-customer' };  // resolved server-side (IDOR-safe)
    if (!cust.defaultPmId && !body.paymentMethodId) return { ok: false, error: 'no-card-on-file' };
    if (inv.pendingPaymentIntentId) {
      var ex = stripeApi_('get', 'payment_intents/' + encodeURIComponent(inv.pendingPaymentIntentId), null);
      var eb = ex.body || {};
      if (ex.ok && eb.status === 'succeeded') return recordCharge_(inv, cust, eb, Number(eb.amount), role);
      if (ex.ok && eb.status === 'requires_action') return { ok: false, requiresAction: true, error: 'authentication_required', paymentIntentId: eb.id, clientSecret: eb.client_secret };
      if (ex.ok && eb.status === 'processing') return { ok: true, processing: true, status: 'processing', paymentIntentId: eb.id };   // §14b ACH still settling
      delete inv.pendingPaymentIntentId;   // previous attempt is dead → start fresh
    }
    var cents = (reqCents && reqCents > 0) ? Math.min(reqCents, balance) : balance;
    if (!(cents > 0)) return { ok: false, error: 'bad-invoice-amount' };
    if (cents > MAX_CHARGE_CENTS) return { ok: false, error: 'over-ceiling' };
    var attempt = (Number(inv.chargeAttempts) || 0) + 1;
    var chosenPm = cust.defaultPmId, passedAch = false;
    if (body.paymentMethodId) {   // §253 — re-fetch picked PM from Stripe + IDOR-check
      var pmFetch = stripeApi_('get', 'payment_methods/' + encodeURIComponent(String(body.paymentMethodId)), null);
      if (pmFetch.ok && pmFetch.body.customer === cust.stripeId) {
        chosenPm = String(body.paymentMethodId);
        passedAch = ((pmFetch.body.type || '') === 'us_bank_account');
      }
    }
    var pi = stripeApi_('post', 'payment_intents', {
      amount: cents, currency: 'usd', customer: cust.stripeId, payment_method: chosenPm,
      off_session: 'true', confirm: 'true', description: 'Invoice ' + invoiceId,
      'metadata[invoiceId]': invoiceId, 'metadata[customerId]': inv.customerId || '', 'metadata[role]': role
    }, 'inv_' + invoiceId + '_' + cents + '_' + attempt);   // idempotency key — never replays a cached decline
    var b = pi.body || {};
    if (pi.ok && b.status === 'succeeded') return recordCharge_(inv, cust, b, cents, role);
    if (pi.ok && b.status === 'processing') {
      inv.pendingPaymentIntentId = b.id; inv.achProcessing = true; inv.chargeAttempts = attempt;
      inv.payments = inv.payments || [];
      inv.payments.push({ type: 'ach-pending', paymentIntentId: b.id, amountCents: cents, at: new Date().toISOString(), role: role });
      writeRecord_('invoices', inv);
      return { ok: true, processing: true, status: 'processing', paymentIntentId: b.id, chargedCents: cents };
    }
    var perr = b.error || {};
    var piObj = perr.payment_intent || (b.status === 'requires_action' ? b : null);
    if ((perr.code === 'authentication_required' || (piObj && piObj.status === 'requires_action')) && piObj) {
      inv.pendingPaymentIntentId = piObj.id; inv.chargeAttempts = attempt; writeRecord_('invoices', inv);
      return { ok: false, requiresAction: true, error: 'authentication_required', paymentIntentId: piObj.id, clientSecret: piObj.client_secret };
    }
    inv.chargeAttempts = attempt; writeRecord_('invoices', inv);
    return { ok: false, error: (perr.code || 'charge-failed'), declineCode: perr.decline_code || '' };
  } finally { lock.releaseLock(); }
}

/* The remaining 8 actions (stripeSaveCard_, stripeBankSetupIntent_,
 * stripeSaveBank_, stripeVerifyBank_, stripeSetDefault_, stripeRemoveCard_,
 * stripeListCards_, stripeFinalizeInvoice_, stripeRefundInvoice_,
 * stripeLockInvoice_/stripeUnlockInvoice_) follow the same shape as the two
 * above: readRecord_/writeRecord_ against the Sheets-backed store, a
 * tryLock_ around any write, IDOR checks (re-fetching Stripe objects and
 * confirming they belong to the resolved customerId rather than trusting
 * client-supplied IDs), and money fields treated as server-owned. Not
 * reproduced verbatim here — this snippet exists to close the "totally
 * unverifiable" gap the audit flagged, not to be a paste-target; the
 * central money-tier gate above is the one invariant worth re-verifying on
 * every deploy. */
