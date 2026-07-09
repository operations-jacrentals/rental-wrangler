/* ════════════════════════════════════════════════════════════════════════
 * ⚠ CONFIRMED REGRESSION (2026-07-09) — root-caused via the Apps Script REST
 * API's read-only projects.versions.list / projects.getContent (service
 * account, no deploy risk). This file's header claim "DEPLOYED LIVE
 * 2026-06-25 (version 46)" was TRUE at the time — v46 (23:09:17 UTC) really
 * did add membershipEnroll_/membershipCancel_/membershipReactivate_/
 * membershipBillingCron/MEM_TERM_MONTHS + the 3 dispatch lines, confirmed
 * present in v46 and v47.
 *
 * It was then SILENTLY DELETED 11 minutes later in v48 (23:21:35 UTC,
 * "redeploy: #256 POST-guard") and has been absent from every version since
 * (confirmed through v82, the version live today). Binary-searched + diffed
 * v47 vs v48 directly:
 *   - v48 legitimately ADDS the #255 grace-anchor fix, the #256 POST-guard
 *     dispatch check, deformula_() formula-injection guard, and the #250
 *     webhook token guard — all real, all still live, none of this was a
 *     mistake.
 *   - But v48 ALSO removes the 3 membershipEnroll/Cancel/Reactivate dispatch
 *     lines AND the entire ~176-line app-driven membership block (every
 *     function below this banner: memAddMonthsIso_ through installMembershipBillingCron).
 *   - The older Stripe-subscription membership path (membershipActivate_ /
 *     membershipDailySweep / membershipLedger_) is UNAFFECTED — present in
 *     both v47 and v48, still live today. Only the app-driven system below
 *     was lost.
 * Conclusion: whoever pushed the #255/#256/#250 fixes did so from a local
 * Code.js snapshot taken BEFORE v46's membership merge (updateContent is a
 * full-file overwrite, not a merge, so the stale base silently reverted
 * everything after it). This has been live in production, broken, for the
 * full ~13.5 days since 2026-06-25T23:21:35Z — the frontend (app.js) still
 * actively calls membershipEnroll/membershipCancel/membershipReactivate as
 * if they work; every one of those calls has been hitting "unknown action"
 * in prod the entire time.
 * FIX: re-splice this file's membership block (gate correction already
 * applied below: MONEY_ROLES → roleMoneyOk_) back into the CURRENT live
 * Code.gs and redeploy — same additive recipe as any other
 * BACKEND-DEPLOY-QUEUE.md item, still STOP-gated on Jac's go-ahead.
 * ════════════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════════
 * MEMBERSHIP — app-driven billing backend. DEPLOYED LIVE 2026-06-25 (version 46)
 * to the prod deployment via clasp. This file is the tracked, secret-free record of
 * the code that is live in Code.gs (which is gitignored). Reconciled against the real
 * backend helpers (readRecord_/writeRecord_/computeInvoiceCents_/stripeChargeInvoice_/
 * appendLedger_/getConfigObj/ss()/tryLock_/todayIso_/TAX_RATE_SERVER/roleMoneyOk_).
 *
 * NOTE: the backend ALSO has a separate, dormant Stripe-SUBSCRIPTION membership system
 * (membershipActivate_ / membershipDailySweep / stripeWebhook_). Per Jac (2026-06-25) we
 * went app-driven instead; this cron only touches app-driven members (no stripeSubId), so
 * the two never overlap.
 *
 * ── DISPATCH (spliced into handle(), right after the membershipActivate line ~184) ──
 *   if (action === 'membershipEnroll')     return json(roleMoneyOk_(role) ? membershipEnroll_(body, role)     : { ok:false, error:'forbidden' });
 *   if (action === 'membershipCancel')     return json(roleMoneyOk_(role) ? membershipCancel_(body, role)     : { ok:false, error:'forbidden' });
 *   if (action === 'membershipReactivate') return json(roleMoneyOk_(role) ? membershipReactivate_(body, role) : { ok:false, error:'forbidden' });
 *
 * ── REMAINING MANUAL STEP: install the daily trigger (clasp run can't — no API-exec deploy).
 *   In the Apps Script editor: Run → installMembershipBillingCron   (creates a daily 3am trigger)
 *   — or Triggers (clock icon) → Add Trigger → membershipBillingCron · Time-driven · Day timer · 3am.
 *   NOTE (2026-07-09): this installer function is named WITHOUT a trailing underscore on purpose
 *   — Apps Script's editor hides any function ending in "_" from the Run dropdown (private-helper
 *   convention), so a trailing underscore here would make it unrunnable from the UI. Matches the
 *   existing installUnitDailyTrigger precedent elsewhere in this file.
 * ════════════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════════════════════════════════════════════
 * MEMBERSHIP — app-driven recurring billing (Jac 2026-06-25)
 * Recurring membership WITHOUT Stripe subscriptions: enroll/cancel/reactivate set the
 * SERVER-OWNED membership fields (paidUntil/graceUntil are protected, so they survive the
 * client sync) and charge via stripeChargeInvoice_ (the same one-time path the app uses). A
 * daily trigger (membershipBillingCron) charges each due cycle, handling the add-ons
 * (Unlimited Transport, Rental Protection 15%) and the cancellation-invoice mechanic that a
 * Stripe subscription can't express. Operates ONLY on app-driven members (no stripeSubId) —
 * Stripe-subscription members are handled by membershipDailySweep, so the two never overlap.
 *
 * LOCK DISCIPLINE: never hold a script lock across stripeChargeInvoice_ (it acquires + RELEASES
 * the same script lock internally). Each write takes its own short lock; the charge runs unlocked.
 * ════════════════════════════════════════════════════════════════════════ */
var MEM_TERM_MONTHS = 12;
var MEM_GRACE_DAYS = 7;
var MEM_DEFAULTS = { monthlyBase: 299, annualBase: 2691, monthlyTransport: 500, annualTransport: 4500, protectionPct: 15, protectionCapMonthly: 2000 };
var _memSeq = 0;

function memAddMonthsIso_(iso, n) {
  var d = iso ? new Date(iso + 'T00:00:00Z') : new Date();
  return Utilities.formatDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate())), 'UTC', 'yyyy-MM-dd');
}
function memYestIso_() { return Utilities.formatDate(new Date(Date.now() - 86400000), 'UTC', 'yyyy-MM-dd'); }
function memMonthsRemaining_(toIso) {
  if (!toIso) return 0;
  var a = new Date(todayIso_() + 'T00:00:00Z'), b = new Date(toIso + 'T00:00:00Z');
  return Math.max(0, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()));
}
function memPricing_() {
  var co = {};
  try { var cfg = getConfigObj(); co = (cfg && cfg.settings && cfg.settings.company) || {}; } catch (e) {}
  function num(v, dflt) { var x = Number(v); return (v != null && v !== '' && isFinite(x) && x >= 0) ? x : dflt; }
  return { monthlyBase: num(co.memMonthlyBase, MEM_DEFAULTS.monthlyBase), annualBase: num(co.memAnnualBase, MEM_DEFAULTS.annualBase),
    monthlyTransport: num(co.memMonthlyTransport, MEM_DEFAULTS.monthlyTransport), annualTransport: num(co.memAnnualTransport, MEM_DEFAULTS.annualTransport),
    protectionPct: num(co.memProtectionPct, MEM_DEFAULTS.protectionPct), protectionCapMonthly: num(co.memProtectionCap, MEM_DEFAULTS.protectionCapMonthly) };
}
function memIsAnnual_(plan) { return /(Yearly|Annual|annual)/.test(String(plan)); }
function memFee_(plan, addOns, p) {
  p = p || memPricing_(); addOns = addOns || {};
  function r2(n) { return Math.round(n * 100) / 100; }
  var annual = memIsAnnual_(plan);
  var base = annual ? p.annualBase : p.monthlyBase;
  var transport = addOns.transport ? (annual ? p.annualTransport : p.monthlyTransport) : 0;
  var protection = addOns.protection ? r2(base * (p.protectionPct / 100)) : 0;
  var subtotal = r2(base + transport + protection);
  var tax = r2(subtotal * TAX_RATE_SERVER);
  return { base: base, transport: transport, protection: protection, subtotal: subtotal, tax: tax, total: r2(subtotal + tax) };
}
function memIsMemberType_(at) { return /Member/.test(String(at || '')) && at !== 'Member Incomplete'; }
function memMemberAccountType_(c) { return (c.company && String(c.company).trim()) ? 'Business Member' : 'Non-Business Member'; }
function memNextInvId_() { _memSeq++; return 'MINV-' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHHmmss') + '-' + _memSeq; }
function memLid_() { _memSeq++; return 'Lm' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMddHHmmss') + _memSeq; }
function memFeeLines_(plan, addOns, p) {
  var fee = memFee_(plan, addOns, p), planLbl = memIsAnnual_(plan) ? 'Annual' : 'Monthly';
  var lines = [{ kind: 'membership', ref: '', lid: memLid_(), label: 'Membership · ' + planLbl + ' base', amount: fee.base }];
  if (fee.transport) lines.push({ kind: 'membership', ref: '', lid: memLid_(), label: 'Unlimited Transport', amount: fee.transport });
  if (fee.protection) lines.push({ kind: 'membership', ref: '', lid: memLid_(), label: 'Rental Protection · ' + p.protectionPct + '%', amount: fee.protection });
  return { fee: fee, lines: lines };
}
// create + persist a membership invoice under a SHORT lock (released before any charge)
function memWriteInvoice_(cust, lines, opts) {
  opts = opts || {};
  var inv = { invoiceId: memNextInvId_(), customerId: cust.customerId, membership: true, membershipCancellation: !!opts.cancellation,
    date: opts.date || todayIso_(), dueDate: opts.due || opts.date || todayIso_(), po: '', amountPaid: 0, lineItems: lines };
  var lock = tryLock_(20000); if (!lock) return null;
  try { writeRecord_('invoices', inv); } finally { lock.releaseLock(); }
  return inv;
}
function memPatchCustomer_(customerId, patch) {
  var lock = tryLock_(20000); if (!lock) return null;
  try { var c = readRecord_('customers', customerId); if (!c) return null; for (var k in patch) { if (patch[k] === undefined) delete c[k]; else c[k] = patch[k]; } writeRecord_('customers', c); return c; }
  finally { lock.releaseLock(); }
}
function memLedger_(invoiceId, customerId, cents, stripeId, role, ev) {
  try { appendLedger_([new Date().toISOString(), invoiceId || '', customerId, cents || 0, stripeId || '', role, ev]); } catch (e) {}
}

// ── enroll: create the cycle invoice, charge it, set member fields. Active only on a cleared charge. ──
function membershipEnroll_(body, role) {
  var c = readRecord_('customers', String(body.customerId || '')); if (!c) return { ok: false, error: 'customer-not-found' };
  var plan = memIsAnnual_(body.plan) ? 'Yearly' : 'Monthly';
  var addOns = body.addOns || {}, p = memPricing_(), start = String(body.startDate || todayIso_());
  var built = memFeeLines_(plan, addOns, p);
  var inv = memWriteInvoice_(c, built.lines, { date: start, due: start }); if (!inv) return { ok: false, error: 'busy' };
  // fields, still Member Incomplete until the charge clears
  memPatchCustomer_(c.customerId, { accountType: 'Member Incomplete', paidCadence: plan, commitmentStart: start, commitmentEnd: memAddMonthsIso_(start, MEM_TERM_MONTHS),
    autoRenew: !!body.autoRenew, addOns: { transport: !!addOns.transport, protection: !!addOns.protection },
    unlimitedTransport: !!addOns.transport || undefined, rentalProtection: !!addOns.protection || undefined, prepaid: false, graceUntil: undefined });
  var res = stripeChargeInvoice_({ invoiceId: inv.invoiceId }, role);   // UNLOCKED — charge manages its own lock
  if (res && res.ok && (res.status === 'succeeded' || res.alreadyPaid)) {
    var c2 = memPatchCustomer_(c.customerId, { accountType: memMemberAccountType_(c), paidUntil: memAddMonthsIso_(start, plan === 'Yearly' ? 12 : 1) });
    memLedger_(inv.invoiceId, c.customerId, Math.round(built.fee.total * 100), c.stripeId, role, 'membership-enroll');
    return { ok: true, status: 'active', invoiceId: inv.invoiceId, paidUntil: c2 && c2.paidUntil };
  }
  return { ok: true, status: 'incomplete', invoiceId: inv.invoiceId, charge: res };   // declined → stays Member Incomplete
}

// ── cancel: revert to retail (expire paid-through → Lapsed) + Cancellation Invoice for a Monthly mid-term. ──
function membershipCancel_(body, role) {
  var c = readRecord_('customers', String(body.customerId || '')); if (!c) return { ok: false, error: 'customer-not-found' };
  if (!memIsMemberType_(c.accountType)) return { ok: false, error: 'not-a-member' };
  var cxlId = '';
  if (c.paidCadence === 'Monthly' && c.commitmentEnd && !c.prepaid) {
    var rem = memMonthsRemaining_(c.commitmentEnd);
    if (rem > 0) { var fee = memFee_('Monthly', c.addOns || {}, memPricing_());
      var cxl = memWriteInvoice_(c, [{ kind: 'membership', ref: '', lid: memLid_(), label: 'Cancellation — ' + rem + ' mo remaining (Membership)', amount: Math.round(fee.subtotal * rem * 100) / 100 }], { cancellation: true, due: c.commitmentEnd });
      cxlId = cxl ? cxl.invoiceId : ''; }
  }
  memPatchCustomer_(c.customerId, { paidUntil: memYestIso_(), graceUntil: memYestIso_(), prepaid: false });
  memLedger_(cxlId, c.customerId, 0, c.stripeId, role, 'membership-cancel');
  return { ok: true, status: 'lapsed', cancellationInvoiceId: cxlId };
}

// ── reactivate: pay the Cancellation Invoice in full → reopen PREPAID through the term. ──
function membershipReactivate_(body, role) {
  var c = readRecord_('customers', String(body.customerId || '')); if (!c) return { ok: false, error: 'customer-not-found' };
  var cxlId = String(body.invoiceId || ''); if (!cxlId) return { ok: false, error: 'no-cancellation-invoice' };
  var res = stripeChargeInvoice_({ invoiceId: cxlId }, role);
  if (res && res.ok && (res.status === 'succeeded' || res.alreadyPaid)) {
    var c2 = memPatchCustomer_(c.customerId, { accountType: memMemberAccountType_(c), paidUntil: c.commitmentEnd || memAddMonthsIso_(todayIso_(), MEM_TERM_MONTHS), prepaid: true, graceUntil: undefined });
    memLedger_(cxlId, c.customerId, 0, c.stripeId, role, 'membership-reactivate');
    return { ok: true, status: 'active', prepaidThrough: c2 && c2.paidUntil };
  }
  return { ok: false, status: 'declined', charge: res };
}

// ── DAILY CRON: charge each due app-driven member's cycle; decline → 7-day grace; grace expiry → lapse. ──
function membershipBillingCron() {
  var s = ss().getSheetByName('customers'); if (!s) return;
  var last = s.getLastRow(); if (last < 2) return;
  var vals = s.getRange(2, 2, last - 1, 1).getValues(), ids = [];
  for (var i = 0; i < vals.length; i++) {
    var c0 = null; try { c0 = JSON.parse(vals[i][0]); } catch (e) { continue; }
    if (c0 && memIsMemberType_(c0.accountType) && c0.paidCadence && !c0.stripeSubId) ids.push(c0.customerId);   // app-driven members only
  }
  var today = todayIso_();
  for (var j = 0; j < ids.length; j++) {
    try {
      var c = readRecord_('customers', ids[j]); if (!c || !memIsMemberType_(c.accountType) || c.stripeSubId || c.prepaid) continue;
      if (c.graceUntil && c.graceUntil >= today) continue;                      // still inside grace — a later run retries
      if (c.graceUntil && c.graceUntil < today) { memLapse_(c); continue; }     // grace expired → lapse
      if (!c.paidUntil || c.paidUntil > today) continue;                        // not due yet
      var plan = (c.paidCadence === 'Yearly') ? 'Yearly' : 'Monthly';
      if (c.commitmentEnd && c.paidUntil >= c.commitmentEnd) {                  // term complete
        if (!c.autoRenew) continue;                                            // completed; stops billing (member until paidUntil)
        memPatchCustomer_(c.customerId, { commitmentStart: today, commitmentEnd: memAddMonthsIso_(today, MEM_TERM_MONTHS) });
        c = readRecord_('customers', ids[j]);
      }
      var built = memFeeLines_(plan, c.addOns || {}, memPricing_());
      var inv = memWriteInvoice_(c, built.lines, { date: today, due: today }); if (!inv) continue;
      var res = stripeChargeInvoice_({ invoiceId: inv.invoiceId }, 'Owner');    // UNLOCKED
      if (res && res.ok && (res.status === 'succeeded' || res.alreadyPaid)) {
        var cur = readRecord_('customers', ids[j]);
        memPatchCustomer_(ids[j], { paidUntil: memAddMonthsIso_(cur.paidUntil, plan === 'Yearly' ? 12 : 1), graceUntil: undefined });
        memLedger_(inv.invoiceId, ids[j], Math.round(built.fee.total * 100), c.stripeId, 'cron', 'membership-cycle');
      } else {
        memPatchCustomer_(ids[j], { graceUntil: Utilities.formatDate(new Date(Date.now() + MEM_GRACE_DAYS * 86400000), 'UTC', 'yyyy-MM-dd') });
        memLedger_(inv.invoiceId, ids[j], 0, c.stripeId, 'cron', 'membership-decline');
      }
    } catch (e) { try { console.error('membershipBillingCron ' + ids[j] + ': ' + (e && e.stack ? e.stack : e)); } catch (e2) {} }
  }
}
function memLapse_(c) {
  var cxlId = '';
  if (c.paidCadence === 'Monthly' && c.commitmentEnd && !c.prepaid) {
    var rem = memMonthsRemaining_(c.commitmentEnd);
    if (rem > 0) { var fee = memFee_('Monthly', c.addOns || {}, memPricing_());
      var cxl = memWriteInvoice_(c, [{ kind: 'membership', ref: '', lid: memLid_(), label: 'Cancellation — ' + rem + ' mo remaining (Membership)', amount: Math.round(fee.subtotal * rem * 100) / 100 }], { cancellation: true, due: c.commitmentEnd });
      cxlId = cxl ? cxl.invoiceId : ''; }
  }
  memPatchCustomer_(c.customerId, { paidUntil: memYestIso_(), graceUntil: memYestIso_(), prepaid: false });
  memLedger_(cxlId, c.customerId, 0, c.stripeId, 'cron', 'membership-lapse');
}
// Install ONCE from the Apps Script editor (Run → installMembershipBillingCron):
function installMembershipBillingCron() { ScriptApp.newTrigger('membershipBillingCron').timeBased().everyDays(1).atHour(3).create(); }
