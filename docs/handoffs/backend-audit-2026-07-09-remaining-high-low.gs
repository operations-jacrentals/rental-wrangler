/* ════════════════════════════════════════════════════════════════════════
 * Backend audit (2026-07-09) — the 6 HIGH findings that were skipped in the
 * first pass (only criticals + mediums got fixed then) plus 4 of the 5 LOW
 * findings. All pushed to HEAD, node --check passes. This closes the FULL
 * 32-finding audit end to end (4 critical + 7 high + 16 medium + 4/5 low —
 * saveSession_'s no-expiry LOW is parked, see bottom).
 * ════════════════════════════════════════════════════════════════════════ */

/* ── HIGH — sendCustomerMessage (real SMS/email send) missing from
 * WRITE_ACTIONS, GET-reachable. Added to the WRITE_ACTIONS literal. ── */

/* ── HIGH — chatMergeMsgs_ never validated an incoming message's `by` field
 * against the authenticated `me`, letting any chat participant inject a
 * message impersonating a different member. Now takes `me`, drops any
 * incoming message whose `by` doesn't match. Also updated the QUEUED
 * docs/handoffs/team-chat-privacy-backend.gs (the future getChats_/setChats_
 * replacement) to match, so deploying that later won't regress this. ── */
function chatMergeMsgs_(existing, incoming, me) {
  var out = (existing || []).slice(), have = {};
  out.forEach(function (m) { if (m && m.id) have[m.id] = true; });
  (incoming || []).forEach(function (m) {
    if (!m || !m.id || have[m.id]) return;
    if (me != null && String(m.by) !== String(me)) return;   // can't inject a message claiming to be from someone else
    out.push(m); have[m.id] = true;
  });
  out.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
  return out;
}
// chatAuthorizeWrite_'s 3 call sites now pass `me` through:
// chatMergeMsgs_(existing.messages, inc.messages, me)

/* ── HIGH — wranglerComment_'s "resume-on-answer" let ANY signed-in role
 * silently un-pause a build the auto-fix engine paused waiting specifically
 * for Jac (body.role === 'assistant'/'user' is entirely client-asserted, used
 * only for comment display formatting — never gated). Fix: the label-flip
 * that actually resumes the engine now also requires the SERVER-resolved
 * role to be Admin+ tier. The comment itself still posts either way. ── */
// if (turn === 'user' && roleTierRank_(role) >= ROLE_TIER_RANK.admin) { ...resume logic... }

/* ── HIGH — stripeSaveBank_ never called writeRecord_ at all — a "saved" ACH
 * bank account existed in Stripe (tagged via metadata) but the app's own
 * customer record never gained an achAccounts entry, so recordCharge_'s
 * later `cust.achAccounts` lookup (§14b bank-name labeling) could never find
 * it. REPLACES the tail of stripeSaveBank_ (after the IDOR-checked pm fetch): ── */
//     var b = pm.body.us_bank_account || {};
//     var bank = { stripePmId: pmId, bankName: b.bank_name || 'Bank', last4: b.last4 || '', accountType: b.account_type || '', verified: false, capturedAt: new Date().toISOString(), capturedByRole: role };
//     rec.achAccounts = (rec.achAccounts || []).filter(function (k) { return k.stripePmId !== pmId; });
//     rec.achAccounts.push(bank);
//     writeRecord_('customers', rec);
//     stripeApi_('post', 'payment_methods/' + encodeURIComponent(pmId), { 'metadata[ach_mandate_captured_at]': bank.capturedAt, 'metadata[consent_role]': role, 'metadata[appCustomer]': customerId });
//     return { ok: true, bank: { bankName: bank.bankName, last4: bank.last4, accountType: bank.accountType, verified: false } };

/* ── HIGH — recordManualRefund_ (and, self-caught while fixing this: MY OWN
 * earlier #11 rewrite of stripeRefundInvoice_ carried the identical bug)
 * silently did a FULL refund whenever the client sent amountCents <= 0,
 * instead of rejecting an explicitly-bad value. Both now distinguish
 * "omitted → full refund" (back-compat) from "explicitly non-positive →
 * reject": ── */
// if (reqCents != null && reqCents <= 0) return { ok: false, error: 'bad-refund-amount' };
// var cents = (reqCents != null) ? Math.min(reqCents, paidCents) : paidCents;

/* ── HIGH — sendCustomerMessage_'s dedup guard + quiet-hours block only
 * applied when the client set auto:true — entirely client-asserted, so any
 * caller could bypass both by omitting it. Jac's call: apply both to EVERY
 * send, not just auto:true ones (a duplicate/late-night text is unwanted
 * regardless of who triggered it). Both checks are now unconditional. ── */

/* ── LOW — MONEY_ROLES / ADMIN_ROLES: confirmed zero references anywhere in
 * the file (grep'd before removing), dead code superseded by
 * roleMoneyOk_/roleTierRank_. Deleted. ── */

/* ── LOW — saveConfigFromBody sanitized blank role VALUES but not blank role
 * KEYS — an empty-string role name would persist and then be permanently
 * unauthenticatable (every caller treats the resolved role with plain
 * truthiness). Now drops a blank KEY the same as a blank value. ── */

/* ── LOW — saveGroupOrderFromBody (any signed-in role, no Admin gate — by
 * design, it's a personal preference) had no size cap on body.order, unlike
 * saveConfigFromBody's explicit key/value caps. Added a 20,000-char cap on
 * the serialized payload, well under the Sheets ~50k cell limit. ── */

/* ── LOW — stripeChargeInvoice_ computed `passedAch` from the fetched
 * payment method's type but never used it anywhere — dead code. Removed
 * rather than guessing at the "dropped ACH-specific code path" it may have
 * represented (that would be a feature addition, not a bug fix). ── */

/* ── LOW — saveSession_ writes permanent Script Properties (sess_<sid>) with
 * no expiry/cleanup path. PARKED, not fixed here: a real fix needs either a
 * new time-trigger to sweep stale sess_ keys or a move to Sheets-backed
 * storage with its own eviction — bigger than a one-liner, needs a design
 * call on the approach + threshold, not attempted without that. ── */
