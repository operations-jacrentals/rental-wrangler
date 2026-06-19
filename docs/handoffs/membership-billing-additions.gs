/* ════════════════════════════════════════════════════════════════════════
 * MEMBERSHIP BILLING (recurring Stripe Subscriptions) — added 2026-06-19
 * -------------------------------------------------------------------------
 * Paste-in additions to the LIVE Code.gs (which is gitignored). This file is
 * the tracked source of truth for the four edits — it contains NO secrets
 * (price ids + tax id live in Script Properties, never here).
 *
 * Activate creates a Subscription on the saved DEFAULT card, billing anchored
 * to today (no proration), + 10.75% tax to match invoices. Renewals/failures
 * are reconciled from Stripe: Apps Script doPost CANNOT read the
 * Stripe-Signature header, so the webhook is treated as a PING and the
 * authoritative subscription is RE-FETCHED with our secret (a forged event can
 * change nothing). A daily trigger also reconciles every sub + enforces the
 * 7-day grace → lapse, so the system is correct even if a webhook never lands.
 *
 * ── FOUR EDITS to Code.gs ───────────────────────────────────────────────
 * EDIT A — extend PROTECTED.customers (server owns the billing-outcome fields
 *   so an optimistic client sync can never clobber a webhook write). Replace:
 *     customers: ['stripeId', 'defaultPmId', 'cardBrand', 'cardLast4', 'cardExpMonth', 'cardExpYear', 'cardMandate'],
 *   with:
 *     customers: ['stripeId', 'defaultPmId', 'cardBrand', 'cardLast4', 'cardExpMonth', 'cardExpYear', 'cardMandate', 'membershipStatus', 'paidUntil', 'graceUntil', 'stripeSubId', 'membershipStartedAt', 'membershipLapsedAt'],
 *
 * EDIT B — route the webhook at the very top of handle(e). After the line
 *   `function handle(e) {` add as the FIRST statement:
 *     if (e && e.parameter && e.parameter.wh === 'stripe') return stripeWebhook_(e);
 *
 * EDIT C — dispatch the activate action. Immediately BEFORE the
 *   `// ── data actions ──` comment add:
 *     if (action === 'membershipActivate') return json(MONEY_ROLES[role] ? membershipActivate_(body, role) : { ok: false, error: 'forbidden' });
 *
 * EDIT D — paste EVERYTHING BELOW at the END of Code.gs.
 * ════════════════════════════════════════════════════════════════════════ */

// Find-or-create the recurring 10.75% sales-tax rate; cache its id in a Script Property.
function memberTaxRateId_() {
  var p = PropertiesService.getScriptProperties(), id = p.getProperty('MEMBER_TAX_RATE');
  if (id) return id;
  var r = stripeApi_('post', 'tax_rates', { display_name: 'Sales Tax', percentage: String(TAX_RATE_SERVER * 100), inclusive: 'false' });
  if (r.ok && r.body && r.body.id) { p.setProperty('MEMBER_TAX_RATE', r.body.id); return r.body.id; }
  return '';
}

function ymd_(unixSec)   { return Utilities.formatDate(new Date(unixSec * 1000), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function todayIso_()     { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function addDaysIso_(n)  { var d = new Date(); d.setDate(d.getDate() + n); return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

// Period end (→ paidUntil), read defensively across Stripe API versions.
function subPaidUntil_(sub) {
  var end = sub && sub.current_period_end;
  if (!end && sub && sub.items && sub.items.data && sub.items.data[0]) end = sub.items.data[0].current_period_end;
  if (!end && sub && sub.latest_invoice && sub.latest_invoice.lines && sub.latest_invoice.lines.data && sub.latest_invoice.lines.data[0] && sub.latest_invoice.lines.data[0].period) end = sub.latest_invoice.lines.data[0].period.end;
  return end ? ymd_(end) : '';
}

// Resolve our customer record from a Stripe subscription (metadata first, then scan).
function customerBySub_(sub) {
  if (sub && sub.metadata && sub.metadata.customerId) { var hit = readRecord_('customers', sub.metadata.customerId); if (hit) return hit; }
  var s = ss().getSheetByName('customers'); if (!s) return null;
  var last = s.getLastRow(); if (last < 2) return null;
  var vals = s.getRange(2, 2, last - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) { var c = null; try { c = JSON.parse(vals[i][0]); } catch (e) { continue; } if (c && c.stripeSubId === (sub && sub.id)) return c; }
  return null;
}

function membershipLedger_(c, event) { try { appendLedger_([new Date().toISOString(), '', (c && c.customerId) || '', 0, (c && c.stripeId) || '', 'system', 'membership-' + event]); } catch (e) {} }

// Apply a (re-fetched, authoritative) subscription's status to our customer record. Caller holds the lock.
function applySubStatus_(c, sub) {
  var st = sub && sub.status;
  if (st === 'active' || st === 'trialing') {
    var pu = subPaidUntil_(sub);
    c.membershipStatus = 'active'; c.stripeSubId = sub.id; if (pu) c.paidUntil = pu; if (c.graceUntil) delete c.graceUntil;
    writeRecord_('customers', c); membershipLedger_(c, 'active');
  } else if (st === 'past_due') {
    if (c.membershipStatus !== 'past_due' && c.membershipStatus !== 'lapsed') {
      c.membershipStatus = 'past_due'; c.graceUntil = addDaysIso_(7);
      writeRecord_('customers', c); membershipLedger_(c, 'past_due');
    }
  } else if (st === 'unpaid' || st === 'canceled' || st === 'incomplete_expired') {
    lapseMembership_(c);
  }
}

// Lapse: mark the membership lapsed (server-owned). The account-type downgrade + active-rental
// re-rate to Retail are the FRONTEND's job (Phase 3) — it owns accountType + the pricing engine,
// so doing it client-side avoids a sync tug-of-war over accountType. Caller holds the lock.
function lapseMembership_(c) {
  if (!c || c.membershipStatus === 'lapsed') return;
  c.membershipStatus = 'lapsed'; c.membershipLapsedAt = todayIso_(); if (c.graceUntil) delete c.graceUntil;
  writeRecord_('customers', c); membershipLedger_(c, 'lapsed');
}

// action: membershipActivate {customerId, plan} — money role only (gated in handle()).
function membershipActivate_(body, role) {
  var customerId = String(body.customerId || ''), plan = (String(body.plan || '') === 'annual') ? 'annual' : 'monthly';
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var rec = readRecord_('customers', customerId);
    if (!rec) return { ok: false, error: 'customer-not-found' };
    if (!/Member/.test(String(rec.accountType || ''))) return { ok: false, error: 'not-member' };
    if (!rec.stripeId || !rec.defaultPmId) return { ok: false, error: 'no-card-on-file' };
    if (rec.membershipStatus === 'active' && rec.stripeSubId)        // idempotent — already enrolled
      return { ok: true, subscriptionId: rec.stripeSubId, paidUntil: rec.paidUntil || '', last4: rec.cardLast4 || '' };
    var priceId = PropertiesService.getScriptProperties().getProperty(plan === 'annual' ? 'PRICE_MEMBER_ANNUAL' : 'PRICE_MEMBER_MONTHLY');
    if (!priceId) return { ok: false, error: 'no-price-configured' };
    var params = {
      customer: rec.stripeId, 'items[0][price]': priceId, default_payment_method: rec.defaultPmId,
      off_session: 'true', payment_behavior: 'error_if_incomplete', proration_behavior: 'none',
      'metadata[customerId]': customerId, 'metadata[plan]': plan, 'expand[0]': 'latest_invoice.payment_intent'
    };
    var taxId = memberTaxRateId_(); if (taxId) params['default_tax_rates[]'] = taxId;
    var r = stripeApi_('post', 'subscriptions', params, 'mbrsub_' + customerId + '_' + plan + '_' + todayIso_());
    if (!r.ok) { var er = (r.body && r.body.error) || {}; return { ok: false, error: er.code || er.decline_code || 'stripe-error', declineCode: er.decline_code || '' }; }
    var sub = r.body, inv = sub.latest_invoice || {};
    if (sub.status !== 'active' && sub.status !== 'trialing') return { ok: false, error: (inv.payment_intent && inv.payment_intent.status) || sub.status || 'not-active' };
    var paidUntil = subPaidUntil_(sub);
    rec.stripeSubId = sub.id; rec.membershipStatus = 'active'; rec.membershipStartedAt = todayIso_();
    rec.membershipPlan = plan; if (paidUntil) rec.paidUntil = paidUntil; if (rec.graceUntil) delete rec.graceUntil;
    writeRecord_('customers', rec);
    try { appendLedger_([new Date().toISOString(), (inv.id || ''), customerId, Number(inv.amount_paid || 0), rec.stripeId || '', role, 'membership-activate']); } catch (e) {}
    return { ok: true, subscriptionId: sub.id, paidUntil: paidUntil, last4: rec.cardLast4 || '' };
  } finally { lock.releaseLock(); }
}

// Stripe webhook (…/exec?wh=stripe). doPost can't read headers → no signature check; instead we
// RE-FETCH the subscription with our secret and trust only that. Always returns 200.
function stripeWebhook_(e) {
  try {
    var ev = JSON.parse((e && e.postData && e.postData.contents) || '{}'), type = String(ev.type || ''), obj = (ev.data && ev.data.object) || {};
    var subId = (type.indexOf('customer.subscription') === 0) ? obj.id : (type.indexOf('invoice') === 0 ? obj.subscription : '');
    if (subId) {
      var sr = stripeApi_('get', 'subscriptions/' + encodeURIComponent(subId), null);
      if (sr.ok && sr.body && sr.body.id) {
        var found = customerBySub_(sr.body);
        if (found) { var lock = LockService.getScriptLock(); lock.waitLock(15000); try { var c = readRecord_('customers', found.customerId); if (c) applySubStatus_(c, sr.body); } finally { lock.releaseLock(); } }
      }
    }
  } catch (err) { try { console.error('stripeWebhook_ ' + (err && err.stack ? err.stack : err)); } catch (e2) {} }
  return ContentService.createTextOutput('ok');
}

// Daily time-trigger: reconcile every active/past_due subscription against Stripe (covers any
// webhook that didn't deliver) and enforce OUR 7-day grace → lapse. Install via the Triggers UI.
function membershipDailySweep_() {
  var s = ss().getSheetByName('customers'); if (!s) return;
  var last = s.getLastRow(); if (last < 2) return;
  var vals = s.getRange(2, 2, last - 1, 1).getValues(), ids = [];
  for (var i = 0; i < vals.length; i++) { var c = null; try { c = JSON.parse(vals[i][0]); } catch (e) { continue; } if (c && c.stripeSubId && c.membershipStatus !== 'lapsed') ids.push(c.customerId); }
  var today = todayIso_();
  for (var j = 0; j < ids.length; j++) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(20000);
      var c = readRecord_('customers', ids[j]); if (!c || !c.stripeSubId || c.membershipStatus === 'lapsed') continue;
      var sr = stripeApi_('get', 'subscriptions/' + encodeURIComponent(c.stripeSubId), null);
      if (sr.ok && sr.body && sr.body.id) applySubStatus_(c, sr.body);
      var c2 = readRecord_('customers', ids[j]);
      if (c2 && c2.membershipStatus === 'past_due' && c2.graceUntil && c2.graceUntil <= today) lapseMembership_(c2);
    } catch (e) {} finally { try { lock.releaseLock(); } catch (e2) {} }
  }
}
