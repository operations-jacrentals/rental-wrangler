/* comms v102 — BUILT + HELD (2026-07-14). NOT pushed to HEAD, NOT versioned.
 *
 * WHY HELD: a concurrent session pushed a large phone-identity auth feature
 * (spec 2026-07-13-text-link-identity: authStart/authVerify/session tokens, pidRole_/pidAdmin_
 * gates, pidReconcileRoster_) onto the shared Code.gs HEAD. GAS versions snapshot the WHOLE
 * HEAD, so versioning these comms changes now would bundle them with that in-progress auth
 * work into one deployable version. Rather than ship someone else's half-built auth in a "comms"
 * version, this is parked here verbatim.
 *
 * UN-HOLD when the phone-identity feature is versioned + DEPLOYED (i.e., it's the live baseline):
 *   1) pull live HEAD fresh, 2) splice the two helpers below + the 4 one-line hooks, 3) node --check,
 *   4) push HEAD → versions.create → Jac editor-deploy. (Anon-access check after, as always.)
 *
 * WHAT IT DOES (two comms enhancements, both additive):
 *   (a) Carrier opt-out sync — Twilio Advanced Opt-Out owns STOP/START, so our inbound webhook
 *       never sees them. When a send fails with Twilio error 21610 ("unsubscribed recipient"),
 *       flip that party's commsConsent.sms → 'opted-out' so our records reflect reality.
 *   (b) Delivery receipts — we send From:<number> directly (bypassing the Messaging Service, whose
 *       callback config therefore doesn't apply), so attach a per-message StatusCallback pointing
 *       at twilioStatus_ (needs the v101 webhook, already live) so rows move sent→delivered/failed.
 */

// ── (1) HELPERS — paste both just ABOVE `function sendCustomerMessage_(` ──────────────

// Twilio error 21610 = "Attempt to send to unsubscribed recipient": the party STOP'd at the
// carrier (Advanced Opt-Out owns STOP/START, so our inbound webhook never sees it). Sync our OWN
// consent record from the send-failure so the UI/records reflect the opt-out. Idempotent; own lock.
function syncCarrierOptOut_(kind, id) {
  try {
    var lk = tryLock_(10000); if (!lk) return;
    try {
      if (kind === 'customer') {
        var c = readRecord_('customers', id);
        if (c) { c.commsConsent = c.commsConsent || {}; if (c.commsConsent.sms !== 'opted-out') { c.commsConsent.sms = 'opted-out'; writeRecord_('customers', c); } }
      } else {   // roster hand — match by stable ref (id||name) in settings.employees
        var cfg = getConfigObj(); var emps = (cfg.settings && cfg.settings.employees) || [], ch = false;
        for (var i = 0; i < emps.length; i++) { if (String(emps[i].id || emps[i].name || '') === String(id)) { emps[i].commsConsent = emps[i].commsConsent || {}; if (emps[i].commsConsent.sms !== 'opted-out') { emps[i].commsConsent.sms = 'opted-out'; ch = true; } break; } }
        if (ch) saveConfigObj(cfg);
      }
    } finally { lk.releaseLock(); }
  } catch (e) { try { console.error('syncCarrierOptOut_ ' + e); } catch (e2) {} }
}

// Build the Twilio SMS payload + attach a StatusCallback so Twilio POSTs delivery status back to
// twilioStatus_ (we send From:<number> directly, bypassing the Messaging Service, so its callback
// config doesn't apply — the per-message StatusCallback is the reliable path). URL derived from the
// running web-app deployment + the TWILIO_WH_KEY gate; omitted if the URL can't be resolved.
function twilioSmsPayload_(from, to, text) {
  var p = { From: from, To: '+' + to, Body: text };
  try {
    var k = PropertiesService.getScriptProperties().getProperty('TWILIO_WH_KEY') || '';
    var url = ScriptApp.getService().getUrl();
    if (url) p.StatusCallback = url + '?wh=twilioStatus' + (k ? '&whk=' + encodeURIComponent(k) : '');
  } catch (e) {}
  return p;
}

// ── (2) FOUR ONE-LINE HOOKS — in the Twilio branch of BOTH send functions ─────────────
//
// sendCustomerMessage_  (twilio branch):
//   payload line:  payload: { From: twFrom, To: '+' + to, Body: text },
//        becomes:  payload: twilioSmsPayload_(twFrom, to, text),
//   error else:    else providerErr = String(tout.message || tout.error_message || tres.getResponseCode()).slice(0, 80);
//        becomes:  else { providerErr = String(tout.message || tout.error_message || tres.getResponseCode()).slice(0, 80); if (Number(tout.code) === 21610 && custId) syncCarrierOptOut_('customer', custId); }
//
// sendStaffMessage_  (twilio branch — identical lines, different scope var `rid`):
//   payload line:  payload: { From: twFrom, To: '+' + to, Body: text },
//        becomes:  payload: twilioSmsPayload_(twFrom, to, text),
//   error else:    else providerErr = String(tout.message || tout.error_message || tres.getResponseCode()).slice(0, 80);
//        becomes:  else { providerErr = String(tout.message || tout.error_message || tres.getResponseCode()).slice(0, 80); if (Number(tout.code) === 21610 && rid) syncCarrierOptOut_('roster', rid); }
