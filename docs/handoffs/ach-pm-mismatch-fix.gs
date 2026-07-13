/* ════════════════════════════════════════════════════════════════════════
 * ACH categorically blocked — `stripeSaveBank_` IDOR guard vs. the
 * microdeposit us_bank_account flow.  (Reported 2026-07-13: "we can't do
 * ACH"; the Add-bank popup fails with "That card isn't linked to this
 * customer." on every save.)
 *
 * ── ROOT CAUSE (proven) ─────────────────────────────────────────────────
 * `stripeBankSetupIntent_` opens the SetupIntent with
 *   'payment_method_types[]': 'us_bank_account',
 *   'payment_method_options[us_bank_account][verification_method]': 'microdeposits'
 * so after `confirmUsBankAccountSetup` the SetupIntent is in `requires_action`
 * (microdeposits take 1-2 business days to verify), NOT `succeeded`. The
 * frontend is built for exactly this — `saveAchFlow` stores the account with
 * `verified: setupIntent.status === 'succeeded'` (i.e. false), "store now,
 * verify later" (Jac's call).
 *
 * Stripe attaches a SetupIntent's payment method to the Customer only "on
 * successful setup" (SetupIntent API reference) — i.e. when the intent reaches
 * `succeeded`, AFTER microdeposit verification. So on a fresh ACH add the PM's
 * `.customer` is still null.
 *
 * `stripeSaveBank_`'s second ownership check then does:
 *     if (pm.body.customer !== rec.stripeId) return {error:'pm-customer-mismatch'};
 * → `null !== 'cus_…'` → true → EVERY fresh ACH add returns pm-customer-mismatch.
 * ACH can never be saved. (The frontend maps that code to the card-worded
 * "That card isn't linked to this customer." — that copy is separately
 * neutralized on the frontend branch, but the block itself is here.)
 *
 * The FIRST ownership check right above it already proves ownership the correct
 * way for this flow:
 *     if (!si.ok || si.body.customer !== rec.stripeId || si.body.payment_method !== pmId)
 *        return {error:'setupintent-invalid'};
 * The SetupIntent is a server-side Stripe object created with `customer:
 * rec.stripeId`; matching both `si.customer === rec.stripeId` AND
 * `si.payment_method === pmId` binds this exact PM to THIS customer and can't be
 * forged by the client. The redundant PM-level `pm.customer` check is what
 * over-constrains it — it demands attachment that legitimately hasn't happened
 * yet.
 *
 * ── FIX (does NOT weaken the IDOR guard) ────────────────────────────────
 * Accept an UNATTACHED PM (pm.customer null — microdeposit-pending) ONLY when
 * the SetupIntent binding above was verified (siId present → the setupintent-
 * invalid check already gated it). Still reject a PM attached to a DIFFERENT
 * customer, and still reject an unattached PM with no SetupIntent proof.
 *
 *     var pmCust = pm.body.customer || '';
 *     if (pmCust ? (pmCust !== rec.stripeId) : !siId) return {error:'pm-customer-mismatch'};
 *
 *   - attached PM (card flow, or a verified ACH re-save): must equal rec.stripeId.
 *   - unattached PM (fresh microdeposit ACH): allowed iff the SetupIntent bound it.
 *   - unattached PM, no siId: still rejected (no ownership proof).
 *
 * ADDITIVE-safe: no signature change, no new action, no schema change. The rest
 * of the handler already works with an unattached PM (us_bank_account.bank_name/
 * last4/account_type are PM properties, present pre-verification; metadata write
 * on an unattached PM is allowed).
 *
 * NOTE — sibling of the same class (NOT swept here, by design): `stripeSetDefault_`
 * has the same `pm.body.customer !== rec.stripeId` guard, but the add flow does
 * NOT call it for a fresh (unverified) bank, and Stripe rejects setting an
 * unattached PM as a customer's default_payment_method anyway — so it is not a
 * live blocker. Leave it as-is unless a "make default" on a still-pending ACH is
 * ever wired up.
 *
 * DEPLOY: STOP-gated (/clasp). push HEAD via the service account (content only,
 * safe) → EDITOR redeploy (New version, Who has access: Anyone) — the REST-API
 * deploy breaks anonymous access. See BACKEND-DEPLOY-QUEUE.md.
 *
 * REPLACES `stripeSaveBank_` verbatim:
 * ════════════════════════════════════════════════════════════════════════ */
function stripeSaveBank_(body, role) {
  var customerId = String(body.customerId || ''), pmId = String(body.paymentMethodId || ''), siId = String(body.setupIntentId || '');
  if (!pmId) return { ok: false, error: 'missing-pm' };
  var lock = tryLock_(15000); if (!lock) return { ok: false, error: 'busy' };
  try {
    var rec = readRecord_('customers', customerId);
    if (!rec) return { ok: false, error: 'customer-not-found' };
    if (!rec.stripeId) return { ok: false, error: 'no-stripe-customer' };
    if (siId) {
      var si = stripeApi_('get', 'setup_intents/' + encodeURIComponent(siId), null);
      // customer + payment_method MUST match (don't trust the client's pm id alone); ACH status may be requires_action/processing.
      if (!si.ok || si.body.customer !== rec.stripeId || si.body.payment_method !== pmId) return { ok: false, error: 'setupintent-invalid' };
    }
    var pm = stripeApi_('get', 'payment_methods/' + encodeURIComponent(pmId), null);
    if (!pm.ok) return { ok: false, error: 'pm-fetch-failed' };
    // IDOR guard. For the microdeposit us_bank_account flow the PM is NOT attached to the
    // Customer until the SetupIntent reaches `succeeded` (Stripe: "the SetupIntent's payment
    // method will be attached to the Customer on successful setup"), so pm.customer is null
    // while the intent is still requires_action (microdeposits pending) — exactly the state a
    // store-now-verify-later ACH add is in. The SetupIntent check above already binds this PM
    // to THIS customer (si.customer === rec.stripeId AND si.payment_method === pmId), so an
    // unattached PM is accepted only when that binding was verified; a PM attached to a
    // DIFFERENT customer, or an unattached PM with no SetupIntent proof, is still rejected.
    var pmCust = pm.body.customer || '';
    if (pmCust ? (pmCust !== rec.stripeId) : !siId) return { ok: false, error: 'pm-customer-mismatch' };
    var b = pm.body.us_bank_account || {};
    var bank = { stripePmId: pmId, bankName: b.bank_name || 'Bank', last4: b.last4 || '', accountType: b.account_type || '', verified: false, capturedAt: new Date().toISOString(), capturedByRole: role };
    rec.achAccounts = (rec.achAccounts || []).filter(function (k) { return k.stripePmId !== pmId; });   // replace any stale entry for the same PM
    rec.achAccounts.push(bank);
    writeRecord_('customers', rec);
    // Best-effort: bind our ACH mandate evidence to the Stripe payment method (audit trail).
    stripeApi_('post', 'payment_methods/' + encodeURIComponent(pmId), {
      'metadata[ach_mandate_captured_at]': bank.capturedAt, 'metadata[consent_role]': role, 'metadata[appCustomer]': customerId
    });
    return { ok: true, bank: { bankName: bank.bankName, last4: bank.last4, accountType: bank.accountType, verified: false } };
  } finally { lock.releaseLock(); }
}
