/* SMS keyword auto-reply — inbound Twilio webhook handler
 * (comms-notifications Phase 2/3, A2P/10DLC compliance: STOP/START/HELP)
 *
 * ADDITIVE splice for Code.gs (gitignored; pushed via the service-account path —
 * see docs/handoffs/BACKEND-DEPLOY-QUEUE.md; go-live is Jac's editor deploy).
 * The A2P 10DLC campaign registration DECLARES opt-in/opt-out/help keywords;
 * this is the handler that actually HONORS a real inbound STOP/START/HELP from
 * a customer instead of only registering the intent.
 *
 * DEPENDS ON helpers already LIVE in Code.gs from the Phase-1 SMS pipe
 * (docs/handoffs/customer-sms-backend.gs, shipped 2026-07-06 per the comms
 * spec's D5 addendum) — do not splice this file into a Code.gs that predates
 * that phase:
 *   smsNormalizePhone_(p)   — digits-only E.164-ish normalizer (also used to
 *                             match the inbound `From` against a customer's
 *                             stored `phone`)
 *   messagesSheet_()        — the shared `messages` log tab ([id, json] rows)
 *   readRecord_ / writeRecord_ / tryLock_ / todayIso_ / ss() — base Code.gs helpers
 *
 * ============================================================================
 * ASSUMPTIONS / OPEN ITEMS — read before splicing or deploying
 * ============================================================================
 * 1. CONSENT FIELD (the compliance-critical one). This handler reads/writes
 *    the customer record's:
 *        customer.commsConsent = { sms: 'opted-in'|'opted-out'|'unknown',
 *                                   email: 'opted-in'|'opted-out'|'unknown',
 *                                   updatedAt: <epoch ms>, source: '...' }
 *    per docs/specs/comms-notifications.md §4.2, and it is EXACTLY the shape
 *    `sendCustomerMessage_`'s hard-block reads today:
 *        var consent = (cust.commsConsent && cust.commsConsent[channel]) || 'unknown';
 *        if (consent === 'opted-out') return { ok:false, reason:'opted-out' };
 *    (see customer-sms-backend.gs line ~119-120). This handler only ever
 *    touches the `sms` key — `email` and any other existing keys on the
 *    object are read back and preserved verbatim (a shallow merge, not a
 *    replace) so it can never accidentally clear email consent.
 *    IF THE LIVE Code.gs's commsConsent SHAPE HAS DRIFTED from this since
 *    2026-07-06, reconcile before splicing — a mismatch here means the STOP
 *    handler silently writes a field the hard-block never reads, which is a
 *    live compliance bug (customer thinks they opted out; sends continue).
 * 2. WEBHOOK AUTHENTICITY / ANTI-SPOOF. The spec (§5.3) asks for the Twilio
 *    `X-Twilio-Signature` HMAC to be verified before any state change. GAS
 *    web-app doPost(e) does NOT expose incoming HTTP headers at all (a known
 *    Apps Script limitation — `e` only has parameter/parameters/postData/
 *    contentLength/queryString), so the header-based signature check as
 *    literally specced CANNOT be implemented here. Workaround used (the
 *    common pattern for GAS + Twilio): a shared-secret token embedded in the
 *    webhook URL query string itself, e.g. `.../exec?wh=<TOKEN>&...`, read
 *    back as `e.parameter.wh` and compared to a new Script Property
 *    `TWILIO_INBOUND_TOKEN`. Configure the SAME token in both places. This is
 *    weaker than a signed request (a leaked URL is a leaked secret) but is a
 *    real bar against blind/opportunistic POSTs to the guessed exec URL.
 *    Flag for Jac: confirm this substitution is acceptable, or front the
 *    webhook with something that CAN read the header (e.g. a tiny Cloud
 *    Function / Cloudflare Worker relay) if stricter verification is needed.
 * 3. PROVIDER SHAPE. Written for TWILIO's inbound webhook fields (`From`,
 *    `Body`, `To`, `MessageSid`, form-urlencoded) and replies via the Twilio
 *    REST send path (TWILIO_SID/TWILIO_TOKEN/TWILIO_FROM — the same Script
 *    Properties customer-sms-backend.gs already reads), per this task's
 *    explicit brief ("Twilio posts inbound messages"). NOTE: the spec's D5
 *    addendum (2026-07-06) instead names "the Mocean inbound webhook" as the
 *    two-way channel. If Mocean ends up the primary inbound provider, this
 *    parser needs a Mocean-shaped sibling (different field names and a
 *    different signature/verification scheme) — don't assume this file
 *    covers both.
 * 4. UNKNOWN SENDER. An inbound from a phone number that matches no customer
 *    record is NEVER auto-attached to any customer (anti-spoof, spec §10) —
 *    keyword replies (STOP/START/HELP) still fire (they're generic, no PII),
 *    but nothing is written to any customer record and non-keyword replies
 *    from an unknown number are simply dropped (not logged), since there is
 *    no customer thread to attach them to.
 * 5. FIRST-WORD MATCHING. Per this task's brief, the body is trimmed,
 *    uppercased, and only the FIRST WORD is matched against the keyword
 *    sets (e.g. "Stop please" still matches). This is more lenient than
 *    Twilio/CTIA's own default carrier-level matching (typically the ENTIRE
 *    trimmed message must equal one keyword) — intentional per spec, but
 *    worth knowing since it means a message that merely *starts* with STOP
 *    text will opt someone out.
 * 6. REPLIES BYPASS THE OPT-OUT HARD-BLOCK — ON PURPOSE. The STOP
 *    confirmation, the START confirmation, and HELP are sent via a direct
 *    Twilio call (`smsInboundReply_`), NOT through `sendCustomerMessage_`,
 *    because that function would immediately re-block a STOP confirmation to
 *    a number it just marked opted-out. This is not a violation of the
 *    "hard-block opted-out, no override" rule (spec Q-16) — the opt-out/
 *    opt-in/HELP confirmations are the compliance mechanism ITSELF (CTIA/
 *    TCPA require exactly these system replies regardless of opt state);
 *    they are not a marketing/transactional message riding the customer's
 *    consent. No other message type gets this bypass.
 *
 * ============================================================================
 * WIRE-UP
 * ============================================================================
 * Router (Twilio POSTs application/x-www-form-urlencoded — not the app's own
 * JSON `{action:...}` body — so route on MessageSid ahead of the normal
 * action switch, before the JSON body is parsed/required):
 *     // Router: if (action === 'inboundSms' || e.parameter.MessageSid) return smsInbound_(e);
 * `smsInbound_` returns a raw TwiML `ContentService` XML output (empty
 * `<Response></Response>`), NOT `json(...)` — Twilio's webhook expects a
 * TwiML body (or empty 200), not the app's `{ok:...}` envelope. The actual
 * reply text goes out via a separate outbound Twilio API call, not inline
 * TwiML, so it lands in the `messages` log like every other send.
 *
 * Twilio console config:
 *  - Phone number → Messaging → "A message comes in" → Webhook, POST, pointed
 *    at the exec URL with the shared-secret query param from assumption #2
 *    appended, e.g. `https://script.google.com/macros/s/AKfycb.../exec?wh=...`.
 *  - Advanced Opt-Out: Twilio can intercept STOP/START at the carrier level
 *    and auto-reply WITHOUT ever forwarding the message to our webhook. If
 *    that's on, our own `commsConsent` never learns about the opt-out. Enable
 *    "Send inbound messages for opt-out keywords to my application" (the
 *    Messaging Service / Advanced Opt-Out setting) so this handler still
 *    fires and records the opt-out in our data — this is *why* the handler
 *    must be idempotent (task brief): Twilio may ALSO auto-reply on its own,
 *    and our handler may fire on top of that.
 *
 * Script Properties (names only, set in the editor — never in this repo):
 *   TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM   — already required by
 *                                                customer-sms-backend.gs
 *   TWILIO_INBOUND_TOKEN                      — NEW (assumption #2), the
 *                                                shared-secret webhook token
 */

var SMS_STOP_WORDS_ = { STOP: 1, STOPALL: 1, UNSUBSCRIBE: 1, CANCEL: 1, END: 1, QUIT: 1 };
var SMS_START_WORDS_ = { START: 1, YES: 1, UNSTOP: 1, SUBSCRIBE: 1, JOIN: 1, BEGIN: 1, RESUME: 1, OPTIN: 1 };
var SMS_HELP_WORDS_ = { HELP: 1, INFO: 1 };

var SMS_STOP_CONFIRM_ = "JacRentals: You're unsubscribed and will receive no more texts. Reply START to opt back in.";
var SMS_START_CONFIRM_ = "JacRentals: You're opted in to service texts. Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to opt out.";
var SMS_HELP_TEXT_ = 'JacRentals service texts. Msg frequency varies. Msg & data rates may apply. Reply STOP to opt out. Help: operations@jacrentals.com.';

// Entry point — see WIRE-UP above. Always returns a fast TwiML 200; never
// lets an exception propagate back to Twilio (a 5xx there triggers retries).
function smsInbound_(e) {
  try {
    var p = (e && e.parameter) || {};
    var wh = PropertiesService.getScriptProperties().getProperty('TWILIO_INBOUND_TOKEN');
    if (wh && String(p.wh || '') !== wh) return smsTwiml_();   // unverified (assumption #2): drop, no state change, still 200

    var from = smsNormalizePhone_(p.From || '');
    var raw = String(p.Body || '');
    var word = raw.trim().toUpperCase().split(/\s+/)[0] || '';
    if (!from) return smsTwiml_();                              // nothing to act on

    var cust = smsFindCustomerByPhone_(from);                    // null = unknown sender; NEVER auto-attach (spec §10)

    if (SMS_STOP_WORDS_[word]) {
      if (cust) smsSetConsent_(cust, 'sms', 'opted-out', 'reply-stop');
      smsInboundReply_(cust, from, SMS_STOP_CONFIRM_, 'keyword-stop');
      return smsTwiml_();
    }
    if (SMS_START_WORDS_[word]) {
      if (cust) smsSetConsent_(cust, 'sms', 'opted-in', 'reply-start');
      smsInboundReply_(cust, from, SMS_START_CONFIRM_, 'keyword-start');
      return smsTwiml_();
    }
    if (SMS_HELP_WORDS_[word]) {
      smsInboundReply_(cust, from, SMS_HELP_TEXT_, 'keyword-help');   // HELP always answers, regardless of opt state
      return smsTwiml_();
    }

    // A genuine customer reply, not a keyword — do NOT auto-reply (spec:
    // only append to the log so it can surface in the customer's thread).
    // Unattached (unknown-sender) replies are dropped, not logged — no
    // customer record exists to attach the thread to (assumption #4).
    if (cust) smsLogInbound_(cust, from, raw.slice(0, 600), String(p.MessageSid || ''));
    return smsTwiml_();
  } catch (err) {
    return smsTwiml_();   // Twilio needs a fast 200 regardless — never surface an error to the provider
  }
}

// Scan `customers` for a phone match (mirrors the [id, json] row shape used
// by membershipBillingCron's customer scan). Returns the parsed record or
// null — callers must never create/attach a record on a null result.
function smsFindCustomerByPhone_(normPhone) {
  if (!normPhone) return null;
  var s = ss().getSheetByName('customers'); if (!s) return null;
  var last = s.getLastRow(); if (last < 2) return null;
  var vals = s.getRange(2, 2, last - 1, 1).getValues();   // json column
  for (var i = 0; i < vals.length; i++) {
    var c; try { c = JSON.parse(vals[i][0]); } catch (e2) { continue; }
    if (c && smsNormalizePhone_(c.phone) === normPhone) return c;
  }
  return null;
}

// Shallow-merges ONE channel's consent state into the existing commsConsent
// object (never replaces the whole object — email/other keys survive).
// Idempotent: re-setting the same value is a harmless no-op write.
function smsSetConsent_(cust, channel, value, source) {
  var lock = tryLock_(20000); if (!lock) return false;
  try {
    var c = readRecord_('customers', cust.customerId); if (!c) return false;
    var consent = (c.commsConsent && typeof c.commsConsent === 'object') ? c.commsConsent : {};
    consent[channel] = value;          // spec §4.2 shape: { sms, email, updatedAt, source }
    consent.updatedAt = Date.now();
    consent.source = source;
    c.commsConsent = consent;
    writeRecord_('customers', c);
    return true;
  } finally { lock.releaseLock(); }
}

// Sends a system reply directly via Twilio (bypassing sendCustomerMessage_'s
// consent gate on purpose — see assumption #6) and logs it to `messages`.
function smsInboundReply_(cust, to, text, kind) {
  var status = 'failed', providerId = '', providerErr = '', fromUsed = '';
  var props = PropertiesService.getScriptProperties();
  var sid = props.getProperty('TWILIO_SID'), tok = props.getProperty('TWILIO_TOKEN'), from = props.getProperty('TWILIO_FROM');
  if (sid && tok && from) {
    fromUsed = from;
    try {
      var res = UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(sid) + '/Messages.json', {
        method: 'post', muteHttpExceptions: true,
        headers: { Authorization: 'Basic ' + Utilities.base64Encode(sid + ':' + tok) },
        payload: { From: from, To: '+' + to, Body: text },
      });
      var out = JSON.parse(res.getContentText() || '{}');
      if (res.getResponseCode() < 300 && out.sid) { status = 'sent'; providerId = out.sid; }
      else providerErr = String(out.message || out.error_message || res.getResponseCode()).slice(0, 80);
    } catch (e) { providerErr = 'fetch-error'; }
  } else {
    providerErr = 'not-configured';   // no Twilio creds in Script Properties — logged, not thrown
  }
  smsLogOutbound_(cust, to, fromUsed, text, kind, status, providerId, providerErr);
}

function smsLogOutbound_(cust, to, fromUsed, text, template, status, providerId, providerErr) {
  try {
    var msgId = 'MSG-' + Utilities.getUuid().slice(0, 8);
    var row = {
      msgId: msgId, channel: 'sms', provider: 'twilio', direction: 'outbound', entity: 'customer',
      recId: cust ? String(cust.customerId) : '', customerId: cust ? String(cust.customerId) : '',
      template: template, to: to, from: fromUsed, subject: '', body: text, status: status,
      providerId: providerId || '', providerErr: providerErr || '', by: 'system', auto: true,
      quiet: false, dedupKey: '', when: new Date().toISOString(),
    };
    messagesSheet_().appendRow([msgId, JSON.stringify(row)]);
  } catch (e) { /* logging must never block the reply path */ }
}

// A non-keyword inbound reply — logged only (no auto-reply), so it can
// surface in the customer's thread (commsThreads_/messagesFor_ already skip
// any row without a customerId, so unattached inbound never leaks in there).
function smsLogInbound_(cust, from, text, inboundSid) {
  try {
    var msgId = 'MSG-' + Utilities.getUuid().slice(0, 8);
    var row = {
      msgId: msgId, channel: 'sms', provider: 'twilio', direction: 'inbound', entity: 'customer',
      recId: String(cust.customerId), customerId: String(cust.customerId), template: '', to: from, from: from,
      subject: '', body: text, status: 'replied', providerId: inboundSid || '', providerErr: '', by: '',
      auto: false, quiet: false, dedupKey: '', when: new Date().toISOString(),
    };
    messagesSheet_().appendRow([msgId, JSON.stringify(row)]);
  } catch (e) {}
}

// Twilio expects a fast 200 with an empty (or TwiML) body; we already send
// any reply asynchronously via the REST API above, so this is always empty.
function smsTwiml_() {
  return ContentService.createTextOutput('<Response></Response>').setMimeType(ContentService.MimeType.XML);
}
