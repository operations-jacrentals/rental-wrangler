/* ════════════════════════════════════════════════════════════════════════
 * MEMBERSHIP — CASH/CHECK activation, server-side (2026-08-28, issue #833)
 * -------------------------------------------------------------------------
 * BUG (#833, reported in-app): a membership activated after the customer paid a
 * full year in CASH still showed "⚠ Canceled in 7 days" on the customer card —
 * and the card processor kept trying to charge them for the year (the reporter's
 * other half of the same complaint, noted on #599).
 *
 * ROOT CAUSE: #822 shipped the cash activation CLIENT-ONLY. `paidUntil` /
 * `graceUntil` are server-owned / sync-PROTECTED (memberships spec §5.1; the
 * SERVER-OWNED note at the top of membership-billing-additions.gs), so the
 * client's stamp is stripped on sync and `refreshFromBackend` (18s poll) adopts
 * the server's row back over it. What DOES sync — `accountType` + `paidCadence` —
 * is exactly the pair `membershipBillingCron` rosters on, so the cron saw a
 * member with NO server-side paid-through: it created dues invoices, charged the
 * saved card, and on the failed charge set `graceUntil = today + MEM_GRACE_DAYS`
 * (7) → the frontend derived 'Past Due' and rendered the countdown. Seven days
 * later `memLapse_` would have revoked member rates on a fully paid year.
 *
 * Identical defect class to the 2026-06-19 manual cash/check PAYMENT bug
 * (cash-payment-backend.gs): a protected field must be written by the server.
 *
 * FIX: one additive, money-role-gated action that stamps the SAME fields
 * membershipEnroll_ stamps on a cleared charge — minus the charge — and clears
 * the decline grace. The frontend (`membershipActivateCash`, app.js) now calls
 * it and applies the returned authoritative term; if this isn't deployed yet the
 * frontend fails CLOSED (toast "Cash activation isn't on the backend yet —
 * nothing was changed"), so no half-state is written for the cron to chase.
 *
 * MONEY IS NOT TOUCHED: no invoice is created, no card is charged, nothing is
 * marked paid, no refund. The cash received is recorded separately through the
 * existing money-gated `recordManualPayment` on the dues invoice.
 * KNOWN FOLLOW-UP (deliberately NOT done here — a money call for Jac): dues
 * invoices the cron already created for this member stay open. Advancing
 * `paidUntil` stops the cron from charging them (the "paid ahead — not due yet"
 * check), but the office still has to settle or void those invoices; that write
 * is not automated.
 *
 * This file is the tracked source of truth — NO secrets. Two edits to Code.gs:
 *
 * EDIT 1 — dispatch (in handle(), next to the other membership* lines):
 *   if (action === 'membershipActivateCash') return json(roleMoneyOk_(role) ? membershipActivateCash_(body, role) : { ok: false, error: 'forbidden' });
 *   ...and add the key to WRITE_ACTIONS:  membershipActivateCash: 1
 *
 * EDIT 2 — paste the function below into the MEMBERSHIP block (after
 * membershipReactivate_). It reuses existing helpers only: readRecord_,
 * memPatchCustomer_, memAddMonthsIso_, memMemberAccountType_, memLedger_,
 * todayIso_, MEM_TERM_MONTHS.
 *
 * ⚠ DEPLOY = /clasp push (service account) → Jac's Apps Script EDITOR deploy. Do
 *   NOT REST-deploy (breaks anonymous /exec). STOP-gate: confirm the diff first.
 * ⚠ LOCK DISCIPLINE: no outer lock here — memPatchCustomer_ takes its own short
 *   lock (a second waitLock in the same execution would deadlock).
 * ════════════════════════════════════════════════════════════════════════ */

/* Activate a membership paid in CASH / CHECK. Money role only. Stamps the entitlement
   fields server-side (they're sync-PROTECTED, so only the server can), clears any decline
   grace, and charges NOTHING. Idempotent: a member already paid ahead is returned as-is. */
function membershipActivateCash_(body, role) {
  var customerId = String(body.customerId || '');
  var c = readRecord_('customers', customerId);
  if (!c) return { ok: false, error: 'customer-not-found' };
  if (c.stripeSubId) return { ok: false, error: 'stripe-subscription' };   // legacy Stripe-native member (membershipDailySweep owns those) — cancel the subscription first, never run both engines
  var today = todayIso_();
  if (c.paidUntil && c.paidUntil > today && !c.graceUntil) {                // already paid ahead and not counting down → nothing to change
    return { ok: true, status: 'active', alreadyActive: true, paidUntil: c.paidUntil, accountType: c.accountType, commitmentEnd: c.commitmentEnd || '' };
  }
  var paidUntil = memAddMonthsIso_(today, MEM_TERM_MONTHS);
  var c2 = memPatchCustomer_(customerId, {
    accountType: memMemberAccountType_(c),
    paidCadence: 'Yearly',
    commitmentStart: today,
    commitmentEnd: paidUntil,
    paidUntil: paidUntil,
    memberActivatedAt: today,
    prepaid: false,          // the term must still expire on its own (a cash year is not "prepaid to term")
    autoRenew: false,        // there is no card to renew against
    graceUntil: undefined,   // clears the decline countdown the cron set
    renewalFailed: undefined
  });
  if (!c2) return { ok: false, error: 'busy' };
  memLedger_('', customerId, 0, c.stripeId, role, 'membership-cash-activate');   // audit only — 0 cents, no charge
  return { ok: true, status: 'active', paidUntil: c2.paidUntil, accountType: c2.accountType, commitmentEnd: c2.commitmentEnd };
}
