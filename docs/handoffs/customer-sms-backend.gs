/* Customer SMS — backend addition (comms-notifications Phase 1, spec D1/D2/D3, 2026-07-06)
 *
 * ADDITIVE splice for Code.gs (gitignored; pushed via the service-account path —
 * see docs/handoffs/BACKEND-DEPLOY-QUEUE.md; go-live is Jac's editor deploy).
 * Server-side customer channels: SMS via MoceanAPI (spec D1) + EMAIL via GmailApp
 * as operations@ with send-as alias FROM picker (spec D6/D7, Jac 2026-07-06).
 *
 * SECRETS (Script Properties, set in the editor — NEVER in this repo):
 *   TWILIO_SID / TWILIO_TOKEN           — Twilio credential pair (preferred provider when set)
 *   TWILIO_FROM                         — the Twilio number, E.164 (+1...)
 *   SMS_PROVIDER                        — optional override: 'twilio' | 'mocean' (default: auto — twilio if configured)
 *   MOCEAN_TOKEN                        — Mocean Bearer API token (fallback provider)
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
 *     if (action === 'messagesFor') return json(messagesFor_(body, role, pw));
 *     if (action === 'commsAliases') return json(commsAliases_(body, role));
 *     if (action === 'commsThreads') return json(commsThreads_(body, role));
 */

var SMS_TEMPLATES = {   // server-side registry (spec Q-13/Q-14: hardcoded v1). {vars} are server-derived only.
  'quote':           'Hi {firstName}, your {companyName} quote {invoiceId} is ready — {total}. Reply or call us{companyPhoneSuffix}. Reply STOP to opt out.',
  'reminder-start':  'Hi {firstName}, a reminder from {companyName}: your rental starts {startDate}. Questions? Call us{companyPhoneSuffix}. Reply STOP to opt out.',
  'reminder-return': 'Hi {firstName}, a reminder from {companyName}: your rental is due back {endDate}. Need more time? Call us{companyPhoneSuffix}. Reply STOP to opt out.',
};
var SMS_ENTITY_SHEET = { invoice: 'invoices', rental: 'rentals', customer: 'customers' };

// EMAIL templates (spec D6) — subject/body pairs; same server-derived-vals-only law as SMS.
var EMAIL_TEMPLATES = {
  'quote': {
    subject: 'Quote {invoiceId} from {companyName}',
    body: 'Hi {firstName},\n\nYour quote {invoiceId} from {companyName} is ready:\n\n{quoteLines}\nTotal: {total}\n\nReply to this email or call us{companyPhoneSuffix} with any questions.\n\n— {companyName}',
  },
  'reminder-start': { subject: 'Your rental starts {startDate}', body: 'Hi {firstName},\n\nA reminder from {companyName}: your rental starts {startDate}.\n\nReply or call us{companyPhoneSuffix} with any questions.\n\n— {companyName}' },
  'reminder-return': { subject: 'Your rental is due back {endDate}', body: 'Hi {firstName},\n\nA reminder from {companyName}: your rental is due back {endDate}. Need more time? Reply or call us{companyPhoneSuffix}.\n\n— {companyName}' },
};
function smsMaskEmail_(em) {
  var m = String(em || '').split('@');
  return m.length === 2 ? m[0].slice(0, 1) + '\u2022\u2022\u2022@' + m[1] : '\u2022\u2022\u2022';
}
// The FROM dropdown data (spec D7): the primary address + configured send-as aliases.
// Addresses the SHOP owns — fine for any signed-in role to list.
function commsAliases_(body, role) {
  var out = [];
  try { var me = Session.getEffectiveUser().getEmail(); if (me) out.push(me); } catch (e) {}
  if (!out.length) out.push('operations@jacrentals.com');   // the account the backend executes as (scope-free fallback)
  try { out = out.concat(GmailApp.getAliases() || []); } catch (e) {}   // fills out after the owner grants the Gmail scope
  var seen = {}; out = out.filter(function (a) { a = String(a || '').toLowerCase(); if (!a || seen[a]) return false; seen[a] = true; return true; });
  return { ok: true, aliases: out };
}

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
  var channel = body.channel === 'email' ? 'email' : 'sms';
  var template = String(body.template || '');
  var isFree = template === 'freeform';   // D5 dock threads: operator-typed text, no vars ever
  var freeText = isFree ? String(body.text || '').trim().slice(0, 600) : '';
  var tpl = isFree ? null : (channel === 'email' ? EMAIL_TEMPLATES[template] : SMS_TEMPLATES[template]);
  if (!isFree && !tpl) return { ok: false, reason: 'unknown-template' };
  if (isFree && !freeText) return { ok: false, reason: 'empty' };
  var entity = String(body.entity || ''), sheetName = SMS_ENTITY_SHEET[entity];
  if (!sheetName) return { ok: false, reason: 'unknown-entity' };
  var rec = readRecord_(sheetName, String(body.recId || ''));
  if (!rec) return { ok: false, reason: 'not-found' };
  // ISOLATION — the record's own customer, never a client-supplied recipient (spec §3.2)
  var custId = entity === 'customer' ? (rec.customerId || String(body.recId)) : rec.customerId;
  if (!custId || String(body.customerId || '') !== String(custId)) return { ok: false, reason: 'isolation' };
  var cust = entity === 'customer' ? rec : readRecord_('customers', custId);
  if (!cust) return { ok: false, reason: 'not-found' };
  var to = channel === 'email' ? String(cust.email || '').trim() : smsNormalizePhone_(cust.phone);
  if (!to || (channel === 'email' && to.indexOf('@') === -1)) return { ok: false, reason: channel === 'email' ? 'no-email' : 'no-phone' };
  var consent = (cust.commsConsent && cust.commsConsent[channel]) || 'unknown';
  if (consent === 'opted-out') return { ok: false, reason: 'opted-out' };   // spec Q-16: hard block, no override
  var auto = !!body.auto;                                                    // the Phase-2 sweep passes auto:true
  if (auto && smsQuietNow_()) return { ok: false, reason: 'quiet-hours' };
  var sh = messagesSheet_();
  var rows = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 2).getValues() : [];
  var cap = Number(PropertiesService.getScriptProperties().getProperty('SMS_DAILY_CAP')) || 50;
  if (smsCountToday_(rows) >= cap) return { ok: false, reason: 'cap' };      // one shared outbound cap, both channels
  if (auto) {                                                                // dedup ledger (automated only)
    var dupKey = channel + '|' + template + '|' + body.recId + '|' + todayIso_();
    for (var i = 0; i < rows.length; i++) { try { if (JSON.parse(rows[i][1]).dedupKey === dupKey) return { ok: false, reason: 'duplicate' }; } catch (e) {} }
  }
  // server-derived template values ONLY (spec §3.3 — the allowlist by construction)
  var cfg = {}; try { cfg = getConfigObj().settings || {}; } catch (e) {}
  var company = (cfg.company && cfg.company.name) || 'JacRentals';
  var yardPhone = (cfg.company && cfg.company.phone) || '';
  var quoteLines = '';
  if (entity === 'invoice') {
    quoteLines = (rec.lineItems || []).map(function (li) {
      return '  \u2022 ' + String(li.label || li.kind || 'Item') + ' \u2014 $' + (Number(li.amount) || 0).toFixed(2);
    }).join('\n');
    if (quoteLines) quoteLines += '\n';
  }
  var vals = {
    firstName: cust.firstName || String(cust.name || '').split(/\s+/)[0] || 'there',
    companyName: company,
    companyPhoneSuffix: yardPhone ? ' at ' + yardPhone : '',
    invoiceId: entity === 'invoice' ? (rec.invoiceId || '') : '',
    total: entity === 'invoice' ? '$' + (computeInvoiceCents_(rec).totalCents / 100).toFixed(2) : '',   // returns {totalCents, balanceCents} — not a number
    startDate: rec.startDate || '',
    endDate: rec.endDate || '',
    quoteLines: quoteLines,
  };
  var fill = function (t) { return String(t).replace(/\{(\w+)\}/g, function (_, k) { return vals[k] !== undefined ? vals[k] : ''; }); };
  var status = 'failed', providerId = '', providerErr = '', fromUsed = '', text = '', subject = '', row_provider = channel === 'email' ? 'gmail' : '';
  if (channel === 'email') {
    // D7 — the FROM picker: the client's choice is ADVISORY, validated against the real
    // alias list server-side; anything unrecognized falls back to the primary address.
    var aliases = commsAliases_({}, role).aliases || [];
    fromUsed = aliases[0] || '';
    var want = String(body.from || '').toLowerCase();
    for (var a = 0; a < aliases.length; a++) { if (String(aliases[a]).toLowerCase() === want) { fromUsed = aliases[a]; break; } }
    if (isFree) { subject = 'Message from ' + company; text = freeText; } else { subject = fill(tpl.subject); text = fill(tpl.body); }
    try {
      var mailOpts = { name: company };
      if (fromUsed && aliases[0] && fromUsed.toLowerCase() !== String(aliases[0]).toLowerCase()) mailOpts.from = fromUsed;
      GmailApp.sendEmail(to, subject, text, mailOpts);
      status = 'sent';
    } catch (e) { status = 'failed'; providerErr = String(e && e.message || e).slice(0, 80); }
  } else {
    text = isFree ? freeText : fill(tpl);
    var props = PropertiesService.getScriptProperties();
    var twSid = props.getProperty('TWILIO_SID'), twTok = props.getProperty('TWILIO_TOKEN'), twFrom = props.getProperty('TWILIO_FROM');
    var mtoken = props.getProperty('MOCEAN_TOKEN'), apiKey = props.getProperty('MOCEAN_API_KEY'), apiSecret = props.getProperty('MOCEAN_API_SECRET'), moFrom = props.getProperty('MOCEAN_FROM');
    var pref = String(props.getProperty('SMS_PROVIDER') || '').toLowerCase();   // optional pin; default auto
    var provider = pref === 'mocean' ? 'mocean' : (pref === 'twilio' || (twSid && twTok && twFrom)) ? 'twilio' : 'mocean';
    if (provider === 'twilio') {
      if (!twSid || !twTok || !twFrom) return { ok: false, reason: 'not-configured' };
      fromUsed = twFrom;
      try {
        var tres = UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(twSid) + '/Messages.json', {
          method: 'post', muteHttpExceptions: true,
          headers: { Authorization: 'Basic ' + Utilities.base64Encode(twSid + ':' + twTok) },
          payload: { From: twFrom, To: '+' + to, Body: text },
        });
        var tout = JSON.parse(tres.getContentText() || '{}');
        if (tres.getResponseCode() < 300 && tout.sid) { status = 'sent'; providerId = tout.sid; }
        else providerErr = String(tout.message || tout.error_message || tres.getResponseCode()).slice(0, 80);
      } catch (e) { status = 'failed'; providerErr = 'fetch-error'; }
    } else {
      if (!moFrom || (!mtoken && (!apiKey || !apiSecret))) return { ok: false, reason: 'not-configured' };
      fromUsed = moFrom;
      try {
        var payload = { 'mocean-from': moFrom, 'mocean-to': to, 'mocean-text': text, 'mocean-resp-format': 'json' };
        var opts = { method: 'post', muteHttpExceptions: true, payload: payload };
        if (mtoken) opts.headers = { Authorization: 'Bearer ' + mtoken };
        else { payload['mocean-api-key'] = apiKey; payload['mocean-api-secret'] = apiSecret; }
        var res = UrlFetchApp.fetch('https://rest.moceanapi.com/rest/2/sms', opts);
        var out = JSON.parse(res.getContentText() || '{}');
        var m0 = out && out.messages && out.messages[0];
        if (m0 && Number(m0.status) === 0) { status = 'sent'; providerId = m0['message-id'] || ''; }
        else providerErr = String((m0 && m0.err_msg) || out.err_msg || res.getResponseCode()).slice(0, 80);   // logged server-side only
      } catch (e) { status = 'failed'; providerErr = 'fetch-error'; }
    }
    row_provider = provider;
  }
  var msgId = 'MSG-' + Utilities.getUuid().slice(0, 8);
  var row = {   // full row is SERVER-ONLY (`to` + body never reach the client/repo)
    msgId: msgId, channel: channel, provider: row_provider, direction: 'outbound', entity: entity, recId: String(body.recId),
    customerId: String(custId), template: template, to: to, from: fromUsed, subject: subject, body: text, status: status,
    providerId: providerId, providerErr: providerErr, by: role || '', auto: auto, quiet: smsQuietNow_(),
    dedupKey: channel + '|' + template + '|' + body.recId + '|' + todayIso_(), when: new Date().toISOString(),
  };
  messagesSheet_().appendRow([msgId, JSON.stringify(row)]);
  if (status !== 'sent') return { ok: false, reason: 'provider', msgId: msgId };
  return { ok: true, msgId: msgId, status: status, channel: channel, maskedTo: channel === 'email' ? smsMaskEmail_(to) : smsMaskPhone_(cust.phone), fromUsed: channel === 'email' ? fromUsed : '' };
}
// The REDACTED projection the client may render (spec Q-9: PII never synced).
function messagesFor_(body, role, pw) {
  body = body || {};
  var admin = false; try { admin = isAdmin(pw); } catch (e) {}
  var byCust = String(body.customerId || '');   // thread mode: all messages for one customer, bodies included
  var sh = messagesSheet_();
  var rows = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 2).getValues() : [];
  var out = [];
  for (var i = 0; i < rows.length; i++) {
    try {
      var m = JSON.parse(rows[i][1]);
      if (byCust ? String(m.customerId) === byCust : (m.entity === body.entity && String(m.recId) === String(body.recId))) {
        var p = { msgId: m.msgId, channel: m.channel, provider: m.provider, direction: m.direction, entity: m.entity, recId: m.recId, customerId: m.customerId, template: m.template, status: m.status, when: m.when };
        if (admin) p.providerErr = m.providerErr || '';   // diagnostics for ADMIN callers only — still no raw `to`
        if (byCust) { p.body = m.body || ''; p.subject = m.subject || ''; p.maskedTo = m.channel === 'email' ? smsMaskEmail_(m.to) : smsMaskPhone_(m.to); p.fromUsed = m.from || ''; }
        out.push(p);
      }
    } catch (e) {}
  }
  return { ok: true, messages: out };
}

// D5/D8 dock threads — the thread LIST: one entry per customer with message history.
// Snippet only (80 chars of the last body); any signed-in role, same posture as sends.
// D8 (2026-07-07, ADDITIVE — needs a redeploy): each thread also carries a per-CHANNEL
// `channels` rollup ({ sms: {…}, email: {…} }) so the client can seat the same customer
// as a conversation in BOTH the Texts and the Email rail categories. The v74 top-level
// last* fields stay (the shipped client falls back to them when `channels` is absent).
function commsThreads_(body, role) {
  var sh = messagesSheet_();
  var rows = sh.getLastRow() ? sh.getRange(1, 1, sh.getLastRow(), 2).getValues() : [];
  var byCust = {};
  for (var i = 0; i < rows.length; i++) {
    try {
      var m = JSON.parse(rows[i][1]);
      if (!m.customerId) continue;
      var t = byCust[m.customerId] || (byCust[m.customerId] = { customerId: String(m.customerId), count: 0, channels: {} });
      t.count++;
      if (!t.lastWhen || String(m.when) > String(t.lastWhen)) { t.lastWhen = m.when; t.lastChannel = m.channel; t.lastDirection = m.direction; t.lastSnippet = String(m.body || '').slice(0, 80); t.lastStatus = m.status; }
      var chKey = m.channel === 'email' ? 'email' : 'sms';
      var ch = t.channels[chKey] || (t.channels[chKey] = { count: 0 });
      ch.count++;
      if (!ch.lastWhen || String(m.when) > String(ch.lastWhen)) { ch.lastWhen = m.when; ch.lastDirection = m.direction; ch.lastSnippet = String(m.body || '').slice(0, 80); ch.lastStatus = m.status; }
    } catch (e) {}
  }
  var out = Object.keys(byCust).map(function (k) { return byCust[k]; });
  out.sort(function (a, b) { return String(b.lastWhen).localeCompare(String(a.lastWhen)); });
  return { ok: true, threads: out };
}
