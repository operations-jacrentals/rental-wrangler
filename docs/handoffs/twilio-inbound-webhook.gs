/* Twilio inbound webhook — v101 snapshot (2026-07-14). PUSHED to HEAD + versioned as v101,
 * awaiting Jac's editor deploy + Twilio-side URL wiring + the TWILIO_WH_KEY Script Property.
 * See docs/handoffs/BACKEND-DEPLOY-QUEUE.md for the wiring runbook + security note.
 *
 * The live Code.gs is gitignored; this is the reviewable copy of exactly what's on v101.
 * Two anonymous handlers hang off the existing `?wh=` router in handle() (mirrors stripeWebhook_):
 *
 *   // in handle(e), right after the stripe branch, BEFORE the try{} (so a throw would 500, not be swallowed):
 *   if (e && e.parameter && e.parameter.wh === 'twilioIn') return twilioInbound_(e);
 *   if (e && e.parameter && e.parameter.wh === 'twilioStatus') return twilioStatus_(e);
 *
 * SECURITY: GAS doPost can't read the X-Twilio-Signature header, so authenticity rides on a URL
 * token (whk) matched against Script Property TWILIO_WH_KEY — the same pattern stripeWebhook_ uses.
 * Unlike Stripe (which re-fetches authoritative state), this hook ACTS on the payload (flips consent),
 * so TWILIO_WH_KEY is REQUIRED, not optional. Red-teamed; findings fixed inline (see comments).
 */

function twilioXml_(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.XML); }
var TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twilioInbound_(e) {
  try {
    var whKey = PropertiesService.getScriptProperties().getProperty('TWILIO_WH_KEY');
    if (whKey && (!e || !e.parameter || e.parameter.whk !== whKey)) return twilioXml_(TWIML_EMPTY);   // drop unauthenticated POSTs before any scan/write
    var p = (e && e.parameter) || {};
    var from = smsNormalizePhone_(p.From || '');
    var body = String(p.Body || '').trim();
    var sid = String(p.MessageSid || p.SmsSid || '');
    if (!from) return twilioXml_(TWIML_EMPTY);
    var kw = body.toUpperCase().replace(/[^A-Z]/g, '');
    var STOPW = { STOP: 1, STOPALL: 1, UNSUBSCRIBE: 1, CANCEL: 1, END: 1, QUIT: 1 };
    var STARTW = { START: 1, YES: 1, UNSTOP: 1 };
    var wish = STOPW[kw] ? 'opted-out' : STARTW[kw] ? 'opted-in' : '';   // '' = a normal reply, no consent change
    // Match the sender to a customer OR (else) a roster hand — by normalized PHONE (the reliable key,
    // robust to id-less / duplicate-name roster rows). Customer-first is deliberate: if a number is BOTH
    // a customer and a crew member, a STOP opts them out of the customer (marketing-basis) channel; a
    // crew member's operational-alert consent is a separate basis, edited on the roster, not by STOP.
    var matchedCustId = '', rosterMatched = false, matchedRosterId = '';
    var cs = ss().getSheetByName('customers');
    if (cs && cs.getLastRow() >= 2) {
      var cv = cs.getRange(2, 2, cs.getLastRow() - 1, 1).getValues();
      for (var i = 0; i < cv.length; i++) { var c = null; try { c = JSON.parse(cv[i][0]); } catch (e2) { continue; }
        if (c && c.customerId && smsNormalizePhone_(c.phone) === from) { matchedCustId = String(c.customerId); break; } }
    }
    if (!matchedCustId) {
      var emps0 = ((getConfigObj().settings || {}).employees) || [];
      for (var j = 0; j < emps0.length; j++) { if (smsNormalizePhone_(emps0[j].phone) === from) { rosterMatched = true; matchedRosterId = String(emps0[j].id || emps0[j].name || ''); break; } }
    }
    // Consent (STOP/START only) + the inbound log go under ONE lock. Twilio does NOT retry inbound
    // webhooks, so on lock contention we DON'T 500 (that would just error, not retry) — we still log
    // the reply and stamp `consentPending` so a missed opt-out/in is visible for admin reconciliation
    // (STOP is enforced at the carrier by Twilio Advanced Opt-Out regardless).
    var lock = tryLock_(15000);
    var consentApplied = !(wish && (matchedCustId || rosterMatched));   // nothing to apply → already "applied"
    try {
      if (!consentApplied && lock) {
        if (matchedCustId) { var c2 = readRecord_('customers', matchedCustId); if (c2) { c2.commsConsent = c2.commsConsent || {}; if (c2.commsConsent.sms !== wish) { c2.commsConsent.sms = wish; writeRecord_('customers', c2); } } consentApplied = true; }
        else { var cfg = getConfigObj(); var emps = (cfg.settings && cfg.settings.employees) || [], ch = false;   // re-match by PHONE under the lock (not a non-unique id||name string)
          for (var m = 0; m < emps.length; m++) { if (smsNormalizePhone_(emps[m].phone) === from) { emps[m].commsConsent = emps[m].commsConsent || {}; if (emps[m].commsConsent.sms !== wish) { emps[m].commsConsent.sms = wish; ch = true; } break; } }
          if (ch) saveConfigObj(cfg); consentApplied = true; }
      }
      // Log the inbound (dedup by provider sid so a Twilio re-post can't double-log). Roster replies ride
      // audience:'staff' so messagesFor_ never leaks them into a customer projection.
      var sh = messagesSheet_(), dup = false;
      if (sid && sh.getLastRow()) { var rows = sh.getRange(1, 1, sh.getLastRow(), 2).getValues(); for (var k = 0; k < rows.length; k++) { try { if (JSON.parse(rows[k][1]).providerId === sid) { dup = true; break; } } catch (e3) {} } }
      if (!dup) {
        var msgId = 'MSG-' + Utilities.getUuid().slice(0, 8);
        var rowObj = { msgId: msgId, channel: 'sms', provider: 'twilio', direction: 'inbound', audience: rosterMatched ? 'staff' : 'customer', from: from, body: body.slice(0, 600), providerId: sid, keyword: wish, status: 'received', when: new Date().toISOString() };
        if (matchedCustId) rowObj.customerId = matchedCustId;
        if (rosterMatched && matchedRosterId) rowObj.rosterId = matchedRosterId;
        if (!consentApplied) rowObj.consentPending = wish;   // lock was busy — a STOP/START to reconcile by hand
        sh.appendRow([msgId, JSON.stringify(rowObj)]);
      }
    } finally { if (lock) lock.releaseLock(); }
  } catch (err) { try { console.error('twilioInbound_ ' + (err && err.stack ? err.stack : err)); } catch (e4) {} }
  return twilioXml_(TWIML_EMPTY);
}

/* Twilio delivery status callback — reconcile the outbound message row (sent→delivered/failed).
 * Configure as the statusCallback  …/exec?wh=twilioStatus&whk=<TWILIO_WH_KEY> . Same URL-token
 * gate. Matches by providerId === MessageSid; never downgrades a terminal delivered/failed to sent. */
function twilioStatus_(e) {
  try {
    var whKey = PropertiesService.getScriptProperties().getProperty('TWILIO_WH_KEY');
    if (whKey && (!e || !e.parameter || e.parameter.whk !== whKey)) return ContentService.createTextOutput('ok');
    var p = (e && e.parameter) || {};
    var sid = String(p.MessageSid || p.SmsSid || ''), st = String(p.MessageStatus || p.SmsStatus || '').toLowerCase();
    if (!sid || !st) return ContentService.createTextOutput('ok');
    var MAP = { delivered: 'delivered', undelivered: 'failed', failed: 'failed', sent: 'sent' };
    var next = MAP[st]; if (!next) return ContentService.createTextOutput('ok');   // ignore queued/sending/accepted
    var lock = tryLock_(15000);
    if (lock) { try {
      var sh = messagesSheet_(), last = sh.getLastRow(); if (!last) return ContentService.createTextOutput('ok');
      var rows = sh.getRange(1, 1, last, 2).getValues();
      for (var i = rows.length - 1; i >= 0; i--) { var r = null; try { r = JSON.parse(rows[i][1]); } catch (e2) { continue; }
        if (r && r.providerId === sid && r.direction === 'outbound') {
          if ((r.status === 'delivered' || r.status === 'failed') && next === 'sent') break;   // callbacks are unordered — a late 'sent' must not clobber a terminal delivered/failed
          r.status = next; sh.getRange(i + 1, 2).setValue(JSON.stringify(r)); break;
        } }
    } finally { lock.releaseLock(); } }
  } catch (err) { try { console.error('twilioStatus_ ' + (err && err.stack ? err.stack : err)); } catch (e3) {} }
  return ContentService.createTextOutput('ok');
}
