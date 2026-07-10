/* ════════════════════════════════════════════════════════════════════════
 * Backend audit (2026-07-09, 8-agent adversarial pass) — 10 of the 16 MEDIUM
 * findings, auto-fixed per Jac's "fix the mechanical ones" call. All pushed
 * to HEAD already (service account, content-only, node --check passes) —
 * see BACKEND-DEPLOY-QUEUE.md for deploy status. The other 6 mediums (3
 * money-correctness bugs, 2 spend-risk, 1 config-resilience) are being
 * walked through separately, one at a time.
 *
 * NOTE: #16 (SMS daily-cap race) turned out to be more than a one-line fix —
 * flagging that one for extra review below, it restructures
 * sendCustomerMessage_'s control flow (reserve-then-send-then-finalize),
 * not just an added deformula_()/lock() call like the other 9.
 * ════════════════════════════════════════════════════════════════════════ */

/* ── #1/#2 — WRITE_ACTIONS: add `wrangler` (paid Claude call) and
 * `adminSetProps` (mutates Script Properties incl. STRIPE_SECRET/etc.) —
 * both were GET-reachable, every sibling wranglerX/admin action already had
 * this. Replace the WRITE_ACTIONS literal in handle() with: ── */
// var WRITE_ACTIONS = { setConfig: 1, setViews: 1, sync: 1, seed: 1, feedback: 1, uploadCapture: 1, uploadFile: 1, archiveAgreementMedia: 1, wrangler: 1, wranglerFile: 1, wranglerApprove: 1, wranglerDismiss: 1, wranglerComment: 1, saveSession: 1, setChats: 1, setWranglerRail: 1, recordManualPayment: 1, recordManualRefund: 1, membershipActivate: 1, setGroupOrder: 1, gpsToken: 1, adminSetProps: 1 };

/* ── #3 — feedback_: body.type wasn't deformula_()'d like its sibling fields.
 * In feedback_'s appendRow call, replace:
 *   String(body.type || 'Bug')
 * with:
 *   deformula_(String(body.type || 'Bug'))
 * ────────────────────────────────────────────────────────────────────── */

/* ── #4/#5 — setChats_ / setWranglerRail_: client-supplied chat/rail `id`
 * written raw, no deformula_(). REPLACES the id assignment line in each: ── */
function setChats_(body, role) {
  var chats = (body && body.chats) || [], me = body && body.me, rosterId = body && body.rosterId, n = 0;
  if (!chats.length) return { ok: true, saved: 0 };
  var lock = tryLock_(30000); if (!lock) return { ok: false, error: 'busy' };
  try {
    var s = ss().getSheetByName(TEAMCHATS_TAB);
    if (!s) { s = ss().insertSheet(TEAMCHATS_TAB); s.getRange(1, 1, 1, 2).setValues([['id', 'json']]); }
    var idMap = rowIndexById(s), appends = [];
    chats.forEach(function (inc) {
      if (!inc || !inc.id) return;
      var id = deformula_(String(inc.id)), row = idMap[id], existing = null;
      if (row) { try { existing = JSON.parse(s.getRange(row, 2).getValue()); } catch (e) {} }
      var toStore = chatAuthorizeWrite_(existing, inc, me, rosterId);
      if (!toStore) return;                                  // unauthorized / rejected — skip
      var js = JSON.stringify(toStore);
      if (row) s.getRange(row, 1, 1, 2).setValues([[id, js]]); else appends.push([id, js]);
      n++;
    });
    if (appends.length) s.getRange(s.getLastRow() + 1, 1, appends.length, 2).setValues(appends);
  } finally { lock.releaseLock(); }
  return { ok: true, saved: n };
}
// setWranglerRail_: same one-line change —
//   var id = String(c.id), js = JSON.stringify(c); keep[id] = true;
// becomes
//   var id = deformula_(String(c.id)), js = JSON.stringify(c); keep[id] = true;

/* ── #8 — getConfigObj()/backfillRoles_: unlocked writes to the single most
 * security-critical shared cell (role passwords), unlike saveConfigFromBody's
 * locked write to the same cell. REPLACES both functions: ── */
function getConfigObj() {
  var s = ss().getSheetByName(CONFIG_TAB);
  if (s) { var raw = s.getRange(1, 1).getValue(); if (raw) { try { var c = JSON.parse(raw); if (c && c.roles && c.admin) return backfillRoles_(c); } catch (e) {} } }
  var lock0 = tryLock_(15000);   // first run → seed defaults (locked — matches saveConfigFromBody's lock discipline)
  if (lock0) { try { saveConfigObj(DEFAULT_CONFIG); } finally { lock0.releaseLock(); } }
  return DEFAULT_CONFIG;
}
function backfillRoles_(c) {
  if (!c.roles || !Object.keys(c.roles).length) {
    c.roles = JSON.parse(JSON.stringify(DEFAULT_CONFIG.roles));
    var lock0 = tryLock_(15000);
    if (lock0) { try { saveConfigObj(c); } catch (e) {} finally { lock0.releaseLock(); } }
  }
  return c;
}

/* ── #10 — writeRecord_ / doSeed / doSync: client-controlled record ids
 * written raw into column A on every sync/seed/write path, no deformula_().
 * REPLACES writeRecord_ entirely; one-line changes in doSeed/doSync: ── */
function writeRecord_(entity, rec) {
  var idf = ID_FIELD[entity], id = String(rec[idf] == null ? '' : rec[idf]);
  var s = sheetFor(entity), row = rowIndexById(s)[id], js = JSON.stringify(rec);
  if (row) s.getRange(row, 1, 1, 2).setValues([[deformula_(id), js]]);
  else s.getRange(s.getLastRow() + 1, 1, 1, 2).setValues([[deformula_(id), js]]);
}
// doSeed: `[String(r[idf] == null ? '' : r[idf]), JSON.stringify(r)]` becomes
//         `[deformula_(String(r[idf] == null ? '' : r[idf])), JSON.stringify(r)]`
// doSync: `block[row][0] = id;` / `appends.push([id, js]);` become
//         `block[row][0] = deformula_(id);` / `appends.push([deformula_(id), js]);`
// (Lookup keys — idMap/idx/uniq — stay on the RAW id; deformula_'s leading
// apostrophe is a Sheets write-time-only text marker, never present in what
// getValues() reads back, so sanitizing only at the write call is safe and
// doesn't break any existing lookup.)

/* ── #12 — stripeSetDefault_ / stripeRemoveCard_: unlocked read-modify-write
 * of the customer record, unlike every other Stripe handler in the file.
 * REPLACES both functions: ── */
function stripeSetDefault_(body, role) {
  var lock = tryLock_(15000); if (!lock) return { ok: false, error: 'busy' };
  try {
    var rec = readRecord_('customers', String(body.customerId || '')), pmId = String(body.paymentMethodId || '');
    if (!rec || !rec.stripeId) return { ok: false, error: 'no-stripe-customer' };
    var pm = stripeApi_('get', 'payment_methods/' + encodeURIComponent(pmId), null);
    if (!pm.ok || pm.body.customer !== rec.stripeId) return { ok: false, error: 'pm-customer-mismatch' };
    stripeApi_('post', 'customers/' + encodeURIComponent(rec.stripeId), { 'invoice_settings[default_payment_method]': pmId });
    var c = pm.body.card || {}; rec.defaultPmId = pmId; rec.cardBrand = c.brand || ''; rec.cardLast4 = c.last4 || ''; rec.cardExpMonth = c.exp_month || ''; rec.cardExpYear = c.exp_year || '';
    writeRecord_('customers', rec);
    return { ok: true };
  } finally { lock.releaseLock(); }
}
function stripeRemoveCard_(body, role) {
  var lock = tryLock_(15000); if (!lock) return { ok: false, error: 'busy' };
  try {
    var rec = readRecord_('customers', String(body.customerId || '')), pmId = String(body.paymentMethodId || '');
    if (!rec || !rec.stripeId) return { ok: false, error: 'no-stripe-customer' };
    var pm = stripeApi_('get', 'payment_methods/' + encodeURIComponent(pmId), null);
    if (pm.ok && pm.body.customer === rec.stripeId) stripeApi_('post', 'payment_methods/' + encodeURIComponent(pmId) + '/detach', {});
    if (rec.defaultPmId === pmId) rec.defaultPmId = '';   // the client picks + re-syncs a new default
    writeRecord_('customers', rec);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* ── #15 — perfReport_'s t1(): formula-injection guard was already written
 * in docs/handoffs/perf-report-backend.gs and QUEUED in the deploy doc, but
 * was NEVER actually deployed — the audit re-confirmed it's still missing
 * live. Same fix, now actually applied. REPLACES t1() inside perfReport_: ── */
// var t1 = function (x, cap) {
//   var s2 = String(x == null ? '' : x).slice(0, cap || 40);
//   if (/^[=+\-@]/.test(s2)) s2 = "'" + s2;   // formula-injection guard
//   return s2;
// };

/* ── #16 — sendCustomerMessage_: SMS_DAILY_CAP check-then-append race.
 * ⚠ NOT a one-liner like the other 9 — flag for extra review. The old flow
 * checked the cap, sent via Twilio/Mocean/Gmail (a real network round-trip),
 * THEN appended the record — so concurrent calls could all pass the cap
 * check before any of them recorded a send. Holding the script lock across
 * the network call was rejected (violates this file's own stated LOCK
 * DISCIPLINE — see the membership billing block). Fix: RESERVE the cap slot
 * + dedup key atomically under a short lock (append a 'pending' placeholder
 * row) BEFORE the send, capture that row's index, then finalize the SAME
 * row with the real content after the send completes — instead of a second
 * appendRow. Full replacement function is large; see the live diff via the
 * Apps Script version history (v86+) once deployed, or ask Claude to
 * re-dump it — not reproduced in full here to keep this file scannable.
 * ════════════════════════════════════════════════════════════════════════ */
