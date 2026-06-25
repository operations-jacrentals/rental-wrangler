/* ════════════════════════════════════════════════════════════════════════
 * MEMBERSHIP BILLING — backend additions (2026-06-25)
 * -------------------------------------------------------------------------
 * The frontend (F1–F7) already runs membership ENROLL / CANCEL / REACTIVATE by
 * orchestrating the EXISTING, deployed, money-gated `stripeChargeInvoice` action
 * (it creates the membership invoice, sets the member fields, and charges the saved
 * card — same security model as a rental charge). So nothing below is required for
 * the in-app flow to work.
 *
 * This file adds the TWO genuinely server-only pieces:
 *   (1) membershipBillingCron — a daily time-trigger that auto-charges recurring
 *       cycles (the recurring engine, spec §5), and
 *   (2) membershipEnroll_ / membershipCancel_ / membershipReactivate_ — a single
 *       consolidated, money-gated server endpoint the FUTURE public website will
 *       call (spec §6.1 / §10.6 row-isolation seam). The in-app UI can migrate onto
 *       these later; until then they're additive and unused.
 *
 * This file is the tracked source of truth — NO secrets. Deploy via /clasp once the
 * clasp credential is re-minted (the session that authored this was RAPT-blocked).
 *
 * ── SPLICE (3 edits to Code.gs) ──────────────────────────────────────────
 * EDIT 1 — dispatch (in handle(), beside the other money actions):
 *   if (action === 'membershipEnroll')     return json(MONEY_ROLES[role] ? membershipEnroll_(body, role)     : { ok:false, error:'forbidden' });
 *   if (action === 'membershipCancel')      return json(MONEY_ROLES[role] ? membershipCancel_(body, role)      : { ok:false, error:'forbidden' });
 *   if (action === 'membershipReactivate')  return json(MONEY_ROLES[role] ? membershipReactivate_(body, role)  : { ok:false, error:'forbidden' });
 *
 * EDIT 2 — paste the functions below (top-level, e.g. after the Stripe section).
 *
 * EDIT 3 — install the daily trigger ONCE (run installMembershipCron_ from the
 *   Apps Script editor, or add a time-driven trigger on `membershipBillingCron`):
 *   function installMembershipCron_(){ ScriptApp.newTrigger('membershipBillingCron').timeBased().everyDays(1).atHour(3).create(); }
 *
 * ── RECONCILE AT SPLICE (named reuse — confirm against live Code.gs) ──────
 *   • readRecord_(entity,id) · writeRecord_(entity,rec) · allRecords_(entity)
 *     — record store helpers (used by recordManualPayment_, etc.).
 *   • computeInvoiceCents_(inv) → { totalCents, balanceCents } · appendLedger_([...]).
 *   • stripeChargeInvoice_(body, role) — the function BEHIND the deployed
 *     `stripeChargeInvoice` action (charges an invoice's saved default card).
 *     The cron reuses it; if its real name/shape differs, point CHARGE_INVOICE_ at it.
 *   • MONEY_ROLES, MAX_CHARGE_CENTS, LockService, json().
 *   • There may be a legacy `membershipActivate` action stub in the dispatch — it is
 *     unused by the frontend; replace/remove it in favor of these.
 * ════════════════════════════════════════════════════════════════════════ */

var MEMBERSHIP_TERM_MONTHS = 12;
var MEMBERSHIP_GRACE_DAYS = 7;
var TAX_RATE_ = 0.1075;

// Shipped defaults — mirror config.js MEMBERSHIP_DEFAULTS. Owner-settable values live in
// the Company config; membershipCfg_ reads them, falling back to these (spec §2/§10.1).
function membershipCfg_() {
  var d = { monthlyBase: 299, annualBase: 2691, monthlyTransport: 500, annualTransport: 4500, protectionPct: 15, protectionCapMonthly: 2000 };
  try {
    var co = (readRecord_('settings', 'company') || readRecord_('config', 'company') || {});   // RECONCILE: however the Company config row is keyed
    function num(v, def) { var n = Number(v); return (v != null && v !== '' && isFinite(n) && n >= 0) ? n : def; }
    return {
      monthlyBase: num(co.memMonthlyBase, d.monthlyBase), annualBase: num(co.memAnnualBase, d.annualBase),
      monthlyTransport: num(co.memMonthlyTransport, d.monthlyTransport), annualTransport: num(co.memAnnualTransport, d.annualTransport),
      protectionPct: num(co.memProtectionPct, d.protectionPct), protectionCapMonthly: num(co.memProtectionCap, d.protectionCapMonthly)
    };
  } catch (e) { return d; }
}

// Server-side fee math — the authoritative copy (mirrors app.js membershipFee). NO proration;
// protection = % of BASE only; 10.75% tax. plan: 'Monthly'|'Yearly'.
function membershipFee_(plan, addOns, cfg) {
  cfg = cfg || membershipCfg_(); addOns = addOns || {};
  function r2(n) { return Math.round(n * 100) / 100; }
  var annual = (plan === 'Yearly' || plan === 'Annual');
  var base = annual ? cfg.annualBase : cfg.monthlyBase;
  var transport = addOns.transport ? (annual ? cfg.annualTransport : cfg.monthlyTransport) : 0;
  var protection = addOns.protection ? r2(base * (cfg.protectionPct / 100)) : 0;
  var subtotal = r2(base + transport + protection);
  var tax = r2(subtotal * TAX_RATE_);
  return { base: base, transport: transport, protection: protection, subtotal: subtotal, tax: tax, total: r2(subtotal + tax) };
}

// ── helpers ───────────────────────────────────────────────────────────────
function memIsMemberType_(at) { return /Member/.test(at || '') && at !== 'Member Incomplete'; }
function memAddMonthsISO_(iso, n) { var d = iso ? new Date(iso) : new Date(); return Utilities.formatDate(new Date(d.getFullYear(), d.getMonth() + n, d.getDate()), 'UTC', 'yyyy-MM-dd'); }
function memTodayISO_() { return Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd'); }
function memMonthsRemaining_(toISO) { var a = new Date(), b = new Date(toISO); return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())); }
function memNextInvoiceId_() { return 'MINV-' + Utilities.formatDate(new Date(), 'UTC', 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 1000); }   // RECONCILE: use the app's nextInvoiceId scheme if one exists server-side
function memFeeLines_(plan, addOns, cfg) {
  var fee = membershipFee_(plan, addOns, cfg), lines = [{ kind: 'membership', label: 'Membership · ' + plan + ' base', amount: fee.base }];
  if (fee.transport) lines.push({ kind: 'membership', label: 'Unlimited Transport', amount: fee.transport });
  if (fee.protection) lines.push({ kind: 'membership', label: 'Rental Protection · ' + cfg.protectionPct + '%', amount: fee.protection });
  return { fee: fee, lines: lines };
}
function memCreateInvoice_(cust, lines, opts) {
  opts = opts || {};
  var inv = { invoiceId: memNextInvoiceId_(), customerId: cust.customerId, membership: true, membershipCancellation: !!opts.cancellation,
    date: opts.date || memTodayISO_(), dueDate: opts.due || opts.date || memTodayISO_(), po: '', amountPaid: 0, lineItems: lines };
  writeRecord_('invoices', inv);
  return inv;
}
// Charge an invoice's saved card by reusing the deployed action's internal handler.
function CHARGE_INVOICE_(invoiceId, amountCents, role) {
  return stripeChargeInvoice_({ invoiceId: invoiceId, amountCents: amountCents }, role || 'Owner');   // RECONCILE: real handler name/shape
}

// ── (1) THE DAILY RECURRING CRON (spec §5) ─────────────────────────────────
// Find members whose Paid-Until has arrived (and aren't prepaid), auto-charge the cycle,
// advance Paid-Until; on decline open the 7-day grace, and on grace-expiry lapse them.
function membershipBillingCron() {
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var today = memTodayISO_(), cfg = membershipCfg_(), customers = allRecords_('customers') || [];
    for (var i = 0; i < customers.length; i++) {
      var c = customers[i];
      if (!memIsMemberType_(c.accountType) || c.prepaid) continue;
      // PAST DUE in grace → retry; grace expired → lapse
      if (c.graceUntil && c.graceUntil >= today) continue;                 // still inside grace; a later run retries
      if (c.graceUntil && c.graceUntil < today) { membershipLapse_(c); continue; }
      if (!c.paidUntil || c.paidUntil > today) continue;                   // not due yet
      // Term complete? (Monthly reaching commitmentEnd) → autoRenew rule
      if (c.commitmentEnd && c.paidUntil >= c.commitmentEnd) {
        if (!c.autoRenew) { c.paidCadence = c.paidCadence; writeRecord_('customers', c); continue; }   // completed; stop billing (stays member until paidUntil)
        c.commitmentStart = today; c.commitmentEnd = memAddMonthsISO_(today, MEMBERSHIP_TERM_MONTHS);   // fresh 12-mo cycle
      }
      var plan = (c.paidCadence === 'Yearly') ? 'Yearly' : 'Monthly';
      var built = memFeeLines_(plan, c.addOns || {}, cfg);
      var inv = memCreateInvoice_(c, built.lines, { date: today, due: today });
      var res = CHARGE_INVOICE_(inv.invoiceId, Math.round(built.fee.total * 100), 'Owner');
      if (res && res.ok && (res.status === 'succeeded' || res.alreadyPaid)) {
        c.paidUntil = memAddMonthsISO_(c.paidUntil, plan === 'Yearly' ? 12 : 1);
        c.graceUntil = '';
        writeRecord_('customers', c);
        try { appendLedger_([new Date().toISOString(), inv.invoiceId, c.customerId, Math.round(built.fee.total * 100), '', 'cron', 'membership-cycle']); } catch (e) {}
      } else {
        c.graceUntil = memAddMonthsISO_(today, 0); c.graceUntil = Utilities.formatDate(new Date(Date.now() + MEMBERSHIP_GRACE_DAYS * 86400000), 'UTC', 'yyyy-MM-dd');
        writeRecord_('customers', c);                                       // unpaid invoice stays on the account; Past Due flag derives from graceUntil
        try { appendLedger_([new Date().toISOString(), inv.invoiceId, c.customerId, 0, '', 'cron', 'membership-decline']); } catch (e) {}
      }
    }
    return { ok: true };
  } finally { lock.releaseLock(); }
}

// Grace expired → revert to retail (keep the member accountType but expire Paid-Until so the
// app derives 'Lapsed'); for a Monthly member mid-commitment, drop a Cancellation Invoice for
// the remaining term (spec §4). Rental Protection is NOT cleared (never free).
function membershipLapse_(c) {
  var today = memTodayISO_(), cfg = membershipCfg_();
  if (c.paidCadence === 'Monthly' && c.commitmentEnd && !c.prepaid) {
    var rem = memMonthsRemaining_(c.commitmentEnd);
    if (rem > 0) {
      var fee = membershipFee_('Monthly', c.addOns || {}, cfg);
      memCreateInvoice_(c, [{ kind: 'membership', label: 'Cancellation — ' + rem + ' mo remaining (Membership)', amount: Math.round(fee.subtotal * rem * 100) / 100 }], { cancellation: true, due: c.commitmentEnd });
    }
  }
  var yest = Utilities.formatDate(new Date(Date.now() - 86400000), 'UTC', 'yyyy-MM-dd');
  c.paidUntil = yest; c.graceUntil = yest; c.prepaid = false;
  writeRecord_('customers', c);
  try { appendLedger_([new Date().toISOString(), '', c.customerId, 0, '', 'cron', 'membership-lapse']); } catch (e) {}
}

// ── (2) CONSOLIDATED SERVER ENDPOINT (for the future website; in-app uses the F5 flow) ──
// Row-isolation: each action keys strictly off body.customerId — a web caller may only act on
// the account it authenticated as (enforce that mapping at the web-auth layer, spec §10.6).
function membershipEnroll_(body, role) {
  var c = readRecord_('customers', String(body.customerId || '')); if (!c) return { ok: false, error: 'customer-not-found' };
  var plan = (body.plan === 'Yearly' || body.plan === 'Annual') ? 'Yearly' : 'Monthly';
  var addOns = body.addOns || {}, cfg = membershipCfg_();
  var start = String(body.startDate || memTodayISO_());
  var built = memFeeLines_(plan, addOns, cfg);
  var inv = memCreateInvoice_(c, built.lines, { date: start, due: start });
  // set fields but stay Incomplete until the charge clears
  c.accountType = 'Member Incomplete'; c.paidCadence = plan; c.commitmentStart = start; c.commitmentEnd = memAddMonthsISO_(start, MEMBERSHIP_TERM_MONTHS);
  c.autoRenew = !!body.autoRenew; c.addOns = { transport: !!addOns.transport, protection: !!addOns.protection };
  if (addOns.transport) c.unlimitedTransport = true; if (addOns.protection) c.rentalProtection = true;
  c.prepaid = false; c.graceUntil = ''; writeRecord_('customers', c);
  var res = CHARGE_INVOICE_(inv.invoiceId, Math.round(built.fee.total * 100), role);
  if (res && res.ok && (res.status === 'succeeded' || res.alreadyPaid)) {
    c.accountType = (c.company && String(c.company).trim()) ? 'Business Member' : 'Non-Business Member';
    c.paidUntil = memAddMonthsISO_(start, plan === 'Yearly' ? 12 : 1);
    writeRecord_('customers', c);
    return { ok: true, status: 'active', invoiceId: inv.invoiceId, paidUntil: c.paidUntil };
  }
  return { ok: true, status: 'incomplete', invoiceId: inv.invoiceId, charge: res };   // declined → stays Member Incomplete
}
function membershipCancel_(body, role) {
  var c = readRecord_('customers', String(body.customerId || '')); if (!c) return { ok: false, error: 'customer-not-found' };
  if (!memIsMemberType_(c.accountType)) return { ok: false, error: 'not-a-member' };
  membershipLapse_(c);
  return { ok: true, status: 'lapsed' };
}
function membershipReactivate_(body, role) {
  var c = readRecord_('customers', String(body.customerId || '')); if (!c) return { ok: false, error: 'customer-not-found' };
  var invs = (allRecords_('invoices') || []).filter(function (x) { return x.membershipCancellation && x.customerId === c.customerId; });
  var cxl = null; for (var i = 0; i < invs.length; i++) { if (computeInvoiceCents_(invs[i]).balanceCents > 0) { cxl = invs[i]; break; } }
  if (!cxl) return { ok: false, error: 'no-cancellation-invoice' };
  var res = CHARGE_INVOICE_(cxl.invoiceId, computeInvoiceCents_(cxl).balanceCents, role);
  if (res && res.ok && (res.status === 'succeeded' || res.alreadyPaid)) {
    c.accountType = (c.company && String(c.company).trim()) ? 'Business Member' : 'Non-Business Member';
    c.paidUntil = c.commitmentEnd || memAddMonthsISO_(memTodayISO_(), MEMBERSHIP_TERM_MONTHS);
    c.prepaid = true; c.graceUntil = ''; writeRecord_('customers', c);
    return { ok: true, status: 'active', prepaidThrough: c.paidUntil };
  }
  return { ok: false, status: 'declined', charge: res };
}
