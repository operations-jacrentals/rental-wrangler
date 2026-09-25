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
 * AMENDED 2026-08-28 (issue #835 — BEFORE this ever deployed): the first draft of this
 * function stamped `paidCadence:'Yearly'` on every activation. `paidCadence` is
 * `membershipBillingCron`'s PLAN INPUT, so activating a signed $299/mo member rewrote
 * his plan to Yearly and queued the $2,691 ANNUAL base against his card on the next
 * cycle (and `memLapse_` would have skipped his Monthly remaining-term Cancellation
 * Invoice). It now keeps the member's own plan, grants ONE cycle of it, and leaves an
 * existing 12-month commitment alone.
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
   grace, and charges NOTHING. Idempotent: a member already paid ahead is returned as-is.
   #835 (2026-08-28): records ONE cycle of the member's OWN plan and never rewrites
   paidCadence / the 12-month commitment — see the two notes inline. */
function membershipActivateCash_(body, role) {
  var customerId = String(body.customerId || '');
  var c = readRecord_('customers', customerId);
  if (!c) return { ok: false, error: 'customer-not-found' };
  if (c.stripeSubId) return { ok: false, error: 'stripe-subscription' };   // legacy Stripe-native member (membershipDailySweep owns those) — cancel the subscription first, never run both engines
  var today = todayIso_();
  if (c.paidUntil && c.paidUntil > today && !c.graceUntil) {                // already paid ahead and not counting down → nothing to change
    return { ok: true, status: 'active', alreadyActive: true, paidUntil: c.paidUntil, accountType: c.accountType, commitmentEnd: c.commitmentEnd || '', paidCadence: c.paidCadence || '' };
  }
  /* #835 — the plan is the member's own, set once at enrollment (memEnroll_). Stamping 'Yearly'
     here converted a signed $299/mo member into a Yearly one, and paidCadence IS
     membershipBillingCron's plan input (it bills that plan's base and advances paidUntil by 12 or
     1 month) — so the next cron run would have put the $2,691 ANNUAL base on his card, and
     memLapse_ would have skipped his Monthly remaining-term Cancellation Invoice. Only a customer
     with no plan at all gets the annual default the control is annotated for. */
  var cadence = (c.paidCadence === 'Monthly') ? 'Monthly' : 'Yearly';
  var paidUntil = memAddMonthsIso_(today, cadence === 'Monthly' ? 1 : 12);   // ONE paid cycle, the same 12-or-1 rule memEnroll_/memCron use
  /* #835 — the 12-month COMMITMENT is a different clock from the paid-through cycle: never
     restarted (it would reset a signed member's term) and never collapsed onto paidUntil (the cron
     reads paidUntil >= commitmentEnd as "term complete" and, with autoRenew false, stops billing). */
  var commitmentStart = c.commitmentStart || today;
  var patch = {
    accountType: memMemberAccountType_(c),
    paidCadence: cadence,
    commitmentStart: commitmentStart,
    commitmentEnd: c.commitmentEnd || memAddMonthsIso_(commitmentStart, MEM_TERM_MONTHS),
    paidUntil: paidUntil,
    memberActivatedAt: today,
    prepaid: false,          // the term must still expire on its own (a cash cycle is not "prepaid to term")
    autoRenew: false,        // there is no card to renew against
    graceUntil: undefined,   // clears the decline countdown the cron set
    renewalFailed: undefined
  };
  var c2 = memPatchCustomer_(customerId, patch);
  if (!c2) return { ok: false, error: 'busy' };
  memLedger_('', customerId, 0, c.stripeId, role, 'membership-cash-activate');   // audit only — 0 cents, no charge
  return { ok: true, status: 'active', paidUntil: c2.paidUntil, accountType: c2.accountType, commitmentEnd: c2.commitmentEnd, paidCadence: c2.paidCadence };
}
