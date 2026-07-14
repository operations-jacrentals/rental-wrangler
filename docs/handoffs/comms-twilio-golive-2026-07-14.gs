/* Comms — TWILIO GO-LIVE + backend v92 (2026-07-14)
 * =================================================================================
 * Twilio was approved and taken LIVE. This file records what changed on the backend
 * (deployed as v92) and what's left to build. It supersedes the quiet-hours lines in
 * docs/handoffs/customer-sms-backend.gs (that file is the Phase-1 snapshot).
 *
 * GO-LIVE SUMMARY
 *  - Twilio is now the PRIMARY sms provider (Mocean = fallback). The provider selector
 *    (sendCustomerMessage_) auto-picks Twilio when TWILIO_SID/TWILIO_TOKEN/TWILIO_FROM
 *    are all present in Script Properties; no SMS_PROVIDER pin is set.
 *  - Creds were set LIVE via the `adminSetProps` action (name-allowlisted, set-only) —
 *    NOT via the editor. Validated against Twilio's API (number is SMS-capable) and
 *    confirmed end-to-end with a real test text (provider:twilio, status:sent).
 *  - SECRETS: TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM live ONLY in Script Properties.
 *    Never in the repo, never echoed. adminSetProps + smsProviderStatus report NAMES /
 *    booleans only, never values.
 *
 * WHAT CHANGED IN Code.gs (v92) — three surgical edits + one new action:
 * ---------------------------------------------------------------------------------
 * 1) smsQuietNow_(): window widened to 6am–8pm Central (was 8am–8pm). Jac: "earlier
 *    texts for employee use."
 */
function smsQuietNow_() {
  var h = Number(Utilities.formatDate(new Date(), 'America/Chicago', 'H'));
  return h < 6 || h >= 20;                       // send window 6am–8pm Central (Jac 2026-07-13)
}
/*
 * 2) sendCustomerMessage_(body, role) -> sendCustomerMessage_(body, role, pw)  [+ router
 *    call updated to pass pw] so the function can check isAdmin(pw) for the override.
 *
 * 3) Quiet-hours gate — replaces the unconditional `if (smsQuietNow_()) return quiet-hours`.
 *    Quiet hours still apply to EVERY send; an ADMIN may pass override:true on a MANUAL
 *    send (never the automated sweep) as a deliberate "send anyway" escape:
 */
// var auto = !!body.auto;
// var override = !!body.override && !auto && isAdmin(pw);
// if (smsQuietNow_() && !override) return { ok: false, reason: 'quiet-hours' };
/*
 * 4) NEW admin read-only action `smsProviderStatus` (router: after the role gate:
 *      if (action === 'smsProviderStatus') return json(smsProviderStatus_(pw));)
 *    Reports provider config PRESENCE (booleans only) for the Settings → Integrations
 *    LIVE/OFFLINE pill (spec §6.3) and to confirm creds without sending:
 */
function smsProviderStatus_(pw) {
  if (!isAdmin(pw)) return { ok: false, error: 'forbidden' };
  var p = PropertiesService.getScriptProperties();
  var twSid = !!p.getProperty('TWILIO_SID'), twTok = !!p.getProperty('TWILIO_TOKEN'), twFrom = !!p.getProperty('TWILIO_FROM');
  var moCreds = !!p.getProperty('MOCEAN_TOKEN') || (!!p.getProperty('MOCEAN_API_KEY') && !!p.getProperty('MOCEAN_API_SECRET'));
  var moFrom = !!p.getProperty('MOCEAN_FROM');
  var pref = String(p.getProperty('SMS_PROVIDER') || '').toLowerCase();
  var provider = pref === 'mocean' ? 'mocean' : (pref === 'twilio' || (twSid && twTok && twFrom)) ? 'twilio' : 'mocean';
  return { ok: true, provider: provider, pin: pref || null,
           twilio: { configured: twSid && twTok && twFrom, sid: twSid, token: twTok, from: twFrom },
           mocean: { configured: moCreds && moFrom, creds: moCreds, from: moFrom },
           dailyCap: Number(p.getProperty('SMS_DAILY_CAP')) || 50 };
}
/*
 * DEPLOY MECHANICS (learned this session): `updateContent` (service-account push) only
 * updates HEAD — it does NOT create a version. The live web-app deployment (…trNlObZw)
 * is version-pinned, so a push alone changes nothing live. To go live you must create a
 * NEW version and point that deployment at it. versions.create via the API is SAFE;
 * deployments.update via the API is NOT (it breaks the web app's anonymous access — see
 * gas-deploy-service-account.mjs). So: push HEAD -> versions.create (or editor "New
 * version") -> point …trNlObZw at the new version FROM THE EDITOR.
 *
 * =================================================================================
 * REMAINING ROADMAP — the instructions to ourselves (spec comms-notifications.md §8)
 * ---------------------------------------------------------------------------------
 * PHASE 2 (next):
 *  - Settings → Notifications pane (fills the app.js stub) + `settings.notifications`
 *    slice: channel toggles, CONFIGURABLE quiet hours (Jac's "more controls to respect
 *    people's quiet time"), reminder cadence, consent visibility, provider LIVE/OFFLINE
 *    pill (uses smsProviderStatus).
 *  - runReminderSweep (GAS installable trigger): start / return / balance reminders,
 *    auto:true, dedup ledger, quiet-hours respected. Needs the pane to configure it.
 *  - Editable customer consent surface (commsConsent plate, money+ tier).
 *  - Templates: add reminder-balance / review-request / dispatch-eta (only quote /
 *    reminder-start / reminder-return exist today).
 *
 * PHASE 3:
 *  - inboundMessage webhook: sync a customer's STOP/START into commsConsent. NOTE:
 *    Twilio's Advanced Opt-Out already blocks a STOP'd number at the carrier (we're
 *    LEGAL), but our backend doesn't know, so it keeps ATTEMPTING + logging failures
 *    and the UI never shows the opt-out. Verify the provider signature before any state
 *    change (anti-spoof).
 *  - messageStatus reconcile: Twilio delivery/failure webhooks -> flip sent->delivered/
 *    failed (today we only know Twilio ACCEPTED, not delivered).
 *  - dispatch-eta send + review-request + a review source -> light the null Reputation KPI.
 */
