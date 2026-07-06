/* Customer SMS — backend addition (comms-notifications Phase 1, spec D1/D2/D3, 2026-07-06)
 *
 * ADDITIVE splice for Code.gs (gitignored; pushed via the service-account path —
 * see docs/handoffs/BACKEND-DEPLOY-QUEUE.md; go-live is Jac's editor deploy).
 * First server-side customer channel: SMS via MoceanAPI (spec comms D1).
 *
 * SECRETS (Script Properties, set in the editor — NEVER in this repo):
 *   MOCEAN_TOKEN                        — Bearer API token (preferred auth)
 *   MOCEAN_API_KEY / MOCEAN_API_SECRET  — legacy credential pair (fallback)
 *   MOCEAN_FROM                         — sender id or number
 *   SMS_DAILY_CAP                       — optional, default 50 (runaway guard)
 *
 * SECURITY (all SERVER-side; the public client is untrusted — spec comms §3):
 *  - Rides handle()'s password gate; any signed-in role may SEND (spec D2 — no tier
 *    gate on quotes/reminders; tighten later if abused).
 *  - CUSTOMER ISOLATION: the recipient is resolved from the record's OWN customerId.
 *    A client-supplied `to` is ignored entirely; a customerId/record mismatch rejects
 *    ({ok:false, reason:'isolation'}) — a tampered client cannot cross-send.
 *  - VAR ALLOWLIST (hardest form): client-supplied vars are NEVER read. Template
 *    values are derived server-side from the record (firstName, total via
 *    computeInvoiceCents_, dates, company name/phone). bottomDollar/cost/margin
 *    cannot leak because interpolation never touches client input or those fields.
 *  - CONSENT: commsConsent.sms === 'opted-out' hard-blocks (spec Q-16, no override).
 *    'unknown' passes for these transactional templates only (spec Q-2 default).
 *  - QUIET HOURS (America/Chicago, 08:00–20:00) block AUTOMATED sends (spec D3);
 *    a manual operator send passes but is logged with quiet:true.
 *  - DEDUP: an automated send of the same template+record+day is skipped.
 *  - DAILY CAP: outbound sends/day capped (SMS_DAILY_CAP, default 50) — all senders.
 *  - The `messages` tab is SERVER-ONLY (outside PERSIST_KEYS → never synced/seeded);
 *    the client gets a REDACTED projection (no `to`, no body) via messagesFor_.
 *
 * WIRE-UP: add to handle()'s router (after the unauthorized gate):
 *     if (action === 'sendCustomerMessage') return json(sendCustomerMessage_(body, role));
 *     if (action === 'messagesFor') return json(messagesFor_(body, role));
 */

var SMS_TEMPLATES = {   // server-side registry (spec Q-13/Q-14: hardcoded v1). {vars} are server-derived only.
  'quote':           'Hi {firstName}, your {companyName} quote {invoiceId} is ready — {total}. Reply or call us{companyPhoneSuffix}. Reply STOP to opt out.',
  'reminder-start':  'Hi {firstName}, a reminder from {companyName}: your rental starts {startDate}. Questions? Call us{companyPhoneSuffix}. Reply STOP to opt out.',
  'reminder-return': 'Hi {firstName}, a reminder from {companyName}: your rental is due back {endDate}. Need more time? Call us{companyPhoneSuffix}. Reply STOP to opt out.',
};
var SMS_ENTITY_SHEET = { invoice: 'invoices', rental: 'rentals', customer: 'customers' };

function messagesSheet_() {
  var sh = ss().getSheetByName('messages');
  if (!sh) sh = ss().insertSheet('messages');
  return sh;
}
function smsMaskPhone_(p) {
  var d = String(p || '').replace(/\D/g, '');
  return d.length >= 4 ? '(•••) •••-' + d.slice(-4) : '•••';
}
function smsNormalizePhone_(p) {
  var d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) d = '1' + d;              // US default (the yard is in Louisiana)
  return d.length >= 11 ? d : '';                // Mocean wants international digits, no '+'
}
function smsQuietNow_() {
  var h = Number(Utilities.formatDate(new Date(), 'America/Chicago', 'H'));
  return h < 8 || h >= 20;                       // spec D3: quiet hours, Chicago time
}
function smsCountToday_(rows) {
  var today = todayIso_(), n = 0;
  for (var i = 0; i < rows.length; i++) {
    try { var m = JSON.parse(rows[i][1]); if (m.direction === 'outbound' && String(m.when || '').slice(0, 10) === today) n++; } catch (e) {}
  }
  return n;
}
function sendCustomerMessage_(body, role) {
  body = body || {};
  var template = String(body.template || '');
  var tpl = SMS_TEMPLATES[template];
  if (!tpl) return { ok: false, reason: 'unknown-template' };
  var entity = String(body.entity || ''), sheetName = SMS_ENTITY_SHEET[entity];
  if (!sheetName) return { ok: false, reason: 'unknown-entity' };
  var rec = readRecord_(sheetName, String(body.recId || ''));
  if (!rec) return { ok: false, reason: 'not-found' };
  // ISOLATION — the record's own customer, never a client-supplied recipient (spec §3.2)
  var custId = entity === 'customer' ? (rec.customerId || String(body.recId)) : rec.customerId;
  if (!custId || String(body.customerId || '') !== String(custId)) return { ok: false, reason: 'isolation' };
  var cust = entity === 'customer' ? rec : readRecord_('customers', custId);
  if (!cust) return { ok: false, reason: 'not-found' };
  var to = smsNormalizePhone_(cust.phone);
  if (!to) return { ok: false, reason: 'no-phone' };
  var consent = (cust.commsConsent && cust.commsConsent.sms) || 'unknown';
  if (consent === 'opted-out') return { ok: false, reason: 'opted-out' };   // spec Q-16: hard block, no override
  var auto = !!body.auto;                                                    // the Phase-2 sweep passes auto:true
  if (auto && smsQuietNow_()) return { ok: false, reason: 'quiet-hours' };
  var sh = messagesSheet_();
  var rows = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 2).getValues() : [];
  var cap = Number(PropertiesService.getScriptProperties().getProperty('SMS_DAILY_CAP')) || 50;
  if (smsCountToday_(rows) >= cap) return { ok: false, reason: 'cap' };
  if (auto) {                                                                // dedup ledger (automated only)
    var dupKey = template + '|' + body.recId + '|' + todayIso_();
    for (var i = 0; i < rows.length; i++) { try { if (JSON.parse(rows[i][1]).dedupKey === dupKey) return { ok: false, reason: 'duplicate' }; } catch (e) {} }
  }
  // server-derived template values ONLY (spec §3.3 — the allowlist by construction)
  var cfg = {}; try { cfg = getConfigObj().settings || {}; } catch (e) {}
  var company = (cfg.company && cfg.company.name) || 'JacRentals';
  var yardPhone = (cfg.company && cfg.company.phone) || '';
  var vals = {
    firstName: cust.firstName || String(cust.name || '').split(/\s+/)[0] || 'there',
    companyName: company,
    companyPhoneSuffix: yardPhone ? ' at ' + yardPhone : '',
    invoiceId: entity === 'invoice' ? (rec.invoiceId || '') : '',
    total: entity === 'invoice' ? '$' + (computeInvoiceCents_(rec) / 100).toFixed(2) : '',
    startDate: rec.startDate || '',
    endDate: rec.endDate || '',
  };
  var text = tpl.replace(/\{(\w+)\}/g, function (_, k) { return vals[k] !== undefined ? vals[k] : ''; });
  var props = PropertiesService.getScriptProperties();
  var mtoken = props.getProperty('MOCEAN_TOKEN');   // preferred: Bearer token (Mocean's current auth)
  var apiKey = props.getProperty('MOCEAN_API_KEY'), apiSecret = props.getProperty('MOCEAN_API_SECRET'), from = props.getProperty('MOCEAN_FROM');
  if (!from || (!mtoken && (!apiKey || !apiSecret))) return { ok: false, reason: 'not-configured' };
  var status = 'failed', providerId = '', providerErr = '';
  try {
    var payload = { 'mocean-from': from, 'mocean-to': to, 'mocean-text': text, 'mocean-resp-format': 'json' };
    var opts = { method: 'post', muteHttpExceptions: true, payload: payload };
    if (mtoken) opts.headers = { Authorization: 'Bearer ' + mtoken };
    else { payload['mocean-api-key'] = apiKey; payload['mocean-api-secret'] = apiSecret; }
    var res = UrlFetchApp.fetch('https://rest.moceanapi.com/rest/2/sms', opts);
    var out = JSON.parse(res.getContentText() || '{}');
    var m0 = out && out.messages && out.messages[0];
    if (m0 && Number(m0.status) === 0) { status = 'sent'; providerId = m0['message-id'] || ''; }
    else providerErr = String((m0 && m0.err_msg) || out.err_msg || res.getResponseCode()).slice(0, 80);   // stored in the log row for diagnosis — never sent to the client
  } catch (e) { status = 'failed'; providerErr = 'fetch-error'; }
  var msgId = 'MSG-' + Utilities.getUuid().slice(0, 8);
  var row = {   // full row is SERVER-ONLY (`to` + body never reach the client/repo)
    msgId: msgId, channel: 'sms', direction: 'outbound', entity: entity, recId: String(body.recId),
    customerId: String(custId), template: template, to: to, body: text, status: status,
    providerId: providerId, providerErr: providerErr, by: role || '', auto: auto, quiet: smsQuietNow_(),
    dedupKey: template + '|' + body.recId + '|' + todayIso_(), when: new Date().toISOString(),
  };
  messagesSheet_().appendRow([msgId, JSON.stringify(row)]);
  if (status !== 'sent') return { ok: false, reason: 'provider', msgId: msgId };
  return { ok: true, msgId: msgId, status: status, maskedTo: smsMaskPhone_(cust.phone) };
}
// The REDACTED projection the client may render (spec Q-9: PII never synced).
function messagesFor_(body, role) {
  body = body || {};
  var sh = messagesSheet_();
  var rows = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 2).getValues() : [];
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    try {
      var m = JSON.parse(rows[i][1]);
      if (m.entity === body.entity && String(m.recId) === String(body.recId)) {
        out.push({ msgId: m.msgId, channel: m.channel, direction: m.direction, entity: m.entity, recId: m.recId, customerId: m.customerId, template: m.template, status: m.status, when: m.when });
      }
    } catch (e) {}
  }
  return { ok: true, messages: out };
}
