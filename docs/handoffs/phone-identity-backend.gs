/* Phone-Verified Device Identity — backend additions (Phase 1)  ── SECURITY-CRITICAL
 * ============================================================================
 * Secret-free, tracked copy of the additive Code.gs handlers for per-person staff
 * logins (Code.gs is gitignored; this is the reviewable mirror, per the /clasp rules).
 * Spec: docs/superpowers/specs/2026-07-13-text-link-identity-design.md
 * Plan: docs/superpowers/plans/2026-07-14-text-link-identity-plan.md
 *
 * WHAT: identity = a Team Roster person (settings.employees[]). A one-time SMS code
 * proves phone possession; then a PERSONAL device is trusted 30 days (login = open the
 * app) and a SHARED device takes a PIN each session. No passwords.
 *
 * DEPLOY (STOP-GATE, every time): additive only — old clients + the shared-password
 * path keep working. Push via the service-account path
 * (docs/handoffs/gas-deploy-service-account.mjs, GAS_IMPERSONATE_SUBJECT=
 * operations@jacrentals.com); GO-LIVE is Jac's Apps Script EDITOR deploy (a REST deploy
 * breaks anonymous web-app access). Confirm end-to-end with a real test text first.
 *
 * SECURITY NOTES
 *  - The secret store lives in Script Properties (PID_* keys) — it is NEVER returned by
 *    `load` and never reaches any device. The synced config/roster holds NO secrets.
 *  - PINs and codes are hashed with HMAC-SHA256 under a server-only pepper (PID_PEPPER),
 *    so a property/Sheet dump alone can't verify a guess without the pepper. Per-record
 *    random salt too. PINs are low-entropy (4–8 digits) — the ONLINE defense is the
 *    attempt-cap + lockout below; offline brute-force of a leaked hash is possible but
 *    requires the pepper AND store access (backend-only). Acceptable for the internal
 *    honest-employee threat model (spec §5, §11).
 *  - Device/session tokens are 256-bit random; only their HMAC is stored (the raw token
 *    is the client's bearer credential). Trust is revocable (authRevoke) → sign-out
 *    everywhere / remove-cascade.
 *  - authStart/authVerify/authLoginPin/authResume are UNAUTHENTICATED by design (you're
 *    logging in); they are hardened by roster-only sends, rate-limits, and attempt-caps.
 *    authSetPin needs a fresh session; authRevoke/authEnrollBlast are admin-or-self.
 *  - The FEATURES flag is NOT the gate — the backend authenticates every call here on its
 *    own; a browser toggle grants nothing.
 */

/* ── tunables (backend is authoritative; mirrors config.js PHONE_IDENTITY) ── */
var PID_CODE_LEN      = 6;
var PID_CODE_TTL_MS   = 10 * 60 * 1000;        // verification code lifetime
var PID_LINK_TTL_MS   = 45 * 60 * 1000;        // enrollment/welcome link lifetime
var PID_TRUST_MS      = 30 * 24 * 60 * 60 * 1000;   // personal-device trust window (30d)
var PID_SESS_MS       = 12 * 60 * 60 * 1000;   // shared-device session lifetime
var PID_PIN_MIN       = 4;
var PID_PIN_MAX       = 8;
var PID_CODE_MAXTRY   = 5;                      // bad-code attempts before a code is burned
var PID_PIN_MAXTRY    = 5;                      // bad-PIN attempts before lockout
var PID_PIN_LOCK_MS   = 15 * 60 * 1000;        // PIN lockout duration
var PID_SEND_MIN_GAP  = 30 * 1000;             // min gap between code sends to one person
var PID_SEND_HR_CAP   = 6;                      // max code sends per person per rolling hour

/* ── low-level store (Script Properties, namespaced; JSON values) ── */
function pidProps_() { return PropertiesService.getScriptProperties(); }
function pidGet_(key) { var v = pidProps_().getProperty(key); if (!v) return null; try { return JSON.parse(v); } catch (e) { return null; } }
function pidPut_(key, obj) { pidProps_().setProperty(key, JSON.stringify(obj)); }
function pidDel_(key) { pidProps_().deleteProperty(key); }

/* server-only pepper — lazily minted once, then stable */
function pidPepper_() {
  var p = pidProps_(), v = p.getProperty('PID_PEPPER');
  if (!v) { v = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('PID_PEPPER', v); }
  return v;
}
/* HMAC-SHA256(value, pepper) over salt+value → hex */
function pidHash_(value, salt) {
  var bytes = Utilities.computeHmacSha256Signature(String(salt) + '|' + String(value), pidPepper_());
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}
function pidSalt_() { return Utilities.getUuid(); }
function pidToken_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }
function pidCode_() { var n = ''; for (var i = 0; i < PID_CODE_LEN; i++) n += Math.floor(Math.random() * 10); return n; }
/* constant-time-ish compare of two equal-length hex strings */
function pidEq_(a, b) { a = String(a); b = String(b); if (a.length !== b.length) return false; var r = 0; for (var i = 0; i < a.length; i++) r |= (a.charCodeAt(i) ^ b.charCodeAt(i)); return r === 0; }

/* ── roster lookup (settings.employees is the authoritative identity + phone + role) ── */
function pidRoster_() { try { return (getConfigObj().settings || {}).employees || []; } catch (e) { return []; } }
function pidPerson_(opts) {   // resolve by personId (preferred) or normalized phone
  var list = pidRoster_(), i;
  if (opts.personId) { for (i = 0; i < list.length; i++) if (String(list[i].id) === String(opts.personId)) return list[i]; }
  if (opts.phone) { var t = smsNormalizePhone_(opts.phone); if (t) for (i = 0; i < list.length; i++) if (smsNormalizePhone_(list[i].phone) === t) return list[i]; }
  return null;
}
function pidTierRank_(person) { return roleTierRank_(person && person.role); }   // reuse the role→tier ladder

/* ── roster-scoped SMS (login codes): reuse the provider pick, but the destination is
 *    ALWAYS the roster record server-side, and quiet-hours are BYPASSED (transactional). ── */
function pidSendSms_(phoneRaw, text) {
  var to = smsNormalizePhone_(phoneRaw); if (!to) return { ok: false, reason: 'no-phone' };
  var props = pidProps_();
  var twSid = props.getProperty('TWILIO_SID'), twTok = props.getProperty('TWILIO_TOKEN'), twFrom = props.getProperty('TWILIO_FROM');
  var mtoken = props.getProperty('MOCEAN_TOKEN'), apiKey = props.getProperty('MOCEAN_API_KEY'), apiSecret = props.getProperty('MOCEAN_API_SECRET'), moFrom = props.getProperty('MOCEAN_FROM');
  var pref = String(props.getProperty('SMS_PROVIDER') || '').toLowerCase();
  var provider = pref === 'mocean' ? 'mocean' : (pref === 'twilio' || (twSid && twTok && twFrom)) ? 'twilio' : 'mocean';
  try {
    if (provider === 'twilio') {
      if (!twSid || !twTok || !twFrom) return { ok: false, reason: 'not-configured' };
      var tres = UrlFetchApp.fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(twSid) + '/Messages.json', {
        method: 'post', muteHttpExceptions: true,
        headers: { Authorization: 'Basic ' + Utilities.base64Encode(twSid + ':' + twTok) },
        payload: { From: twFrom, To: '+' + to, Body: text },
      });
      var tout = JSON.parse(tres.getContentText() || '{}');
      return (tres.getResponseCode() < 300 && tout.sid) ? { ok: true } : { ok: false, reason: 'send-failed' };
    }
    if (!moFrom || (!mtoken && (!apiKey || !apiSecret))) return { ok: false, reason: 'not-configured' };
    var payload = { 'mocean-from': moFrom, 'mocean-to': to, 'mocean-text': text, 'mocean-resp-format': 'json' };
    var mopts = { method: 'post', muteHttpExceptions: true, payload: payload };
    if (mtoken) mopts.headers = { Authorization: 'Bearer ' + mtoken }; else { payload['mocean-api-key'] = apiKey; payload['mocean-api-secret'] = apiSecret; }
    var res = UrlFetchApp.fetch('https://rest.moceanapi.com/rest/2/sms', mopts);
    var m0 = (JSON.parse(res.getContentText() || '{}').messages || [])[0];
    return (m0 && Number(m0.status) === 0) ? { ok: true } : { ok: false, reason: 'send-failed' };
  } catch (e) { return { ok: false, reason: 'fetch-error' }; }
}

/* Build the SMS body for a sign-in / setup code. The ENROLL variant (new hire, or a
 * changed number) names the app and links it so a first-timer knows where to go; the
 * login/reset variant stays terse (the person is already at the app). Override the URL
 * with a PID_APP_URL Script Property. App-store download links for the native
 * Android/iOS apps get appended to the enroll copy here once those ship. */
/* App URL used in crew messaging (override with a PID_APP_URL Script Property). */
function pidAppUrl_() { return pidProps_().getProperty('PID_APP_URL') || 'https://app.jacrentals.com'; }

/* Terse, FIXED sign-in code SMS — security/transactional, deliberately NOT customizable. */
function pidCodeSms_(code, ttlMs) {
  return 'JacRentals: your sign-in code is ' + code + '. Expires in ' + Math.round(ttlMs / 60000) + ' min. Never share it.';
}

/* Backend-authoritative default crew-welcome copy (mirrors config.js PHONE_IDENTITY.welcomeText);
 * used when settings.phoneWelcome is blank. Tokens: {name}, {link}. */
var PID_WELCOME_DEFAULT = "Saddle up, {name}! You're on the JacRentals crew. Open {link} and sign in with your mobile number to get rolling.";

/* Build a hand's crew-welcome from the (admin-customizable) template + token substitution.
 * NO login code — the phone-first sign-in issues that in-app when they enter their number. */
function pidWelcomeText_(person) {
  var tpl = '';
  try { tpl = String((getConfigObj().settings || {}).phoneWelcome || ''); } catch (e) { tpl = ''; }
  if (!tpl.trim()) tpl = PID_WELCOME_DEFAULT;
  var name = (person && person.name ? String(person.name) : '').trim() || 'partner';
  return tpl.replace(/\{name\}/g, name).replace(/\{link\}/g, pidAppUrl_());
}

/* Send the crew-welcome to one roster person. Roster-scoped, quiet-hours bypassed
 * (transactional onboarding), and it does NOT touch the login-code rate-limit bucket — so a
 * hand added seconds before opening the app still gets their in-app sign-in code cleanly. */
function pidSendWelcome_(person) {
  if (!person || !smsNormalizePhone_(person.phone)) return { ok: false, reason: 'no-phone' };
  return pidSendSms_(person.phone, pidWelcomeText_(person));
}

/* ── ACTION: authStart — text a one-time code to a roster person's own phone ──
 * body: { personId? , phone? , purpose? ('login'|'reset'|'enroll') }.  UNAUTHENTICATED.
 * Roster-only, rate-limited. Generic response (no hard valid/invalid tell beyond `sent`). */
function authStart_(body) {
  body = body || {};
  var person = pidPerson_({ personId: body.personId, phone: body.phone });
  if (!person || !smsNormalizePhone_(person.phone)) return { ok: true, sent: false };   // roster-only; nothing sent
  var pid = String(person.id), now = Date.now();
  var rl = pidGet_('PID_RL_' + pid) || { win: now, n: 0, last: 0 };
  if (now - rl.win > 3600 * 1000) { rl.win = now; rl.n = 0; }
  if (now - rl.last < PID_SEND_MIN_GAP) return { ok: true, sent: false, reason: 'too-soon' };
  if (rl.n >= PID_SEND_HR_CAP) return { ok: true, sent: false, reason: 'rate' };
  var purpose = body.purpose === 'enroll' ? 'enroll' : (body.purpose === 'reset' ? 'reset' : 'login');
  var code = pidCode_(), salt = pidSalt_();
  var ttl = purpose === 'enroll' ? PID_LINK_TTL_MS : PID_CODE_TTL_MS;
  pidPut_('PID_CODE_' + pid, { hash: pidHash_(code, salt), salt: salt, purpose: purpose, exp: now + ttl, tries: 0 });
  var send = pidSendSms_(person.phone, pidCodeSms_(code, ttl));
  if (!send.ok) return { ok: true, sent: false, reason: send.reason };
  rl.n += 1; rl.last = now; pidPut_('PID_RL_' + pid, rl);
  return { ok: true, sent: true, personId: pid, name: person.name || '', masked: smsMaskPhone_(person.phone) };
}

/* ── ACTION: authVerify — check the code; personal ⇒ 30d device trust, shared ⇒ session ──
 * body: { personId, code, deviceKind ('personal'|'shared') }.  UNAUTHENTICATED. */
function authVerify_(body) {
  body = body || {};
  var pid = String(body.personId || ''); if (!pid) return { ok: false, error: 'bad-request' };
  var rec = pidGet_('PID_CODE_' + pid);
  if (!rec) return { ok: false, error: 'no-code' };
  if (Date.now() > rec.exp) { pidDel_('PID_CODE_' + pid); return { ok: false, error: 'expired' }; }
  if (rec.tries >= PID_CODE_MAXTRY) { pidDel_('PID_CODE_' + pid); return { ok: false, error: 'too-many' }; }
  if (!pidEq_(pidHash_(String(body.code || ''), rec.salt), rec.hash)) {
    rec.tries += 1; pidPut_('PID_CODE_' + pid, rec);
    return { ok: false, error: 'bad-code', left: Math.max(0, PID_CODE_MAXTRY - rec.tries) };
  }
  pidDel_('PID_CODE_' + pid);                                   // burn the code (one-time)
  var person = pidPerson_({ personId: pid }); if (!person) return { ok: false, error: 'gone' };
  var kind = body.deviceKind === 'personal' ? 'personal' : 'shared';
  var token = pidToken_(), h = pidHash_(token, 'tok');
  if (kind === 'personal') {
    pidPut_('PID_DEV_' + h, { personId: pid, exp: Date.now() + PID_TRUST_MS });
    pidIndexAdd_(pid, 'PID_DEV_' + h);
  } else {
    pidPut_('PID_SESS_' + h, { personId: pid, exp: Date.now() + PID_SESS_MS });
    pidIndexAdd_(pid, 'PID_SESS_' + h);
  }
  return { ok: true, token: token, kind: kind, personId: pid, name: person.name || '',
           role: person.role || '', tier: pidTierRank_(person), pinSet: !!pidGet_('PID_PIN_' + pid) };
}

/* ── ACTION: authSetPin — set/replace the shared-device PIN (needs a fresh session) ──
 * body: { personId, pin, token (from a recent authVerify) }. */
function authSetPin_(body) {
  body = body || {};
  var caller = pidResolveCaller_(body.token);
  if (!caller || String(caller.personId) !== String(body.personId)) return { ok: false, error: 'unauthorized' };
  var pin = String(body.pin || '');
  if (!/^\d+$/.test(pin) || pin.length < PID_PIN_MIN || pin.length > PID_PIN_MAX) return { ok: false, error: 'bad-pin' };
  var salt = pidSalt_();
  pidPut_('PID_PIN_' + String(body.personId), { hash: pidHash_(pin, salt), salt: salt, setAt: Date.now() });
  pidDel_('PID_PINLOCK_' + String(body.personId));
  return { ok: true };
}

/* ── ACTION: authLoginPin — shared-device sign-in by PIN (attempt-capped) ──
 * body: { personId, pin }.  UNAUTHENTICATED. Issues a short session (no device trust). */
function authLoginPin_(body) {
  body = body || {};
  var pid = String(body.personId || ''); if (!pid) return { ok: false, error: 'bad-request' };
  var lock = pidGet_('PID_PINLOCK_' + pid), now = Date.now();
  if (lock && lock.until > now) return { ok: false, error: 'locked', until: lock.until };
  var rec = pidGet_('PID_PIN_' + pid); if (!rec) return { ok: false, error: 'no-pin' };
  var person = pidPerson_({ personId: pid }); if (!person) return { ok: false, error: 'gone' };
  if (!pidEq_(pidHash_(String(body.pin || ''), rec.salt), rec.hash)) {
    var f = (lock && lock.n || 0) + 1;
    if (f >= PID_PIN_MAXTRY) pidPut_('PID_PINLOCK_' + pid, { n: 0, until: now + PID_PIN_LOCK_MS });
    else pidPut_('PID_PINLOCK_' + pid, { n: f, until: 0 });
    return { ok: false, error: 'bad-pin', left: Math.max(0, PID_PIN_MAXTRY - f) };
  }
  pidDel_('PID_PINLOCK_' + pid);
  var token = pidToken_(), h = pidHash_(token, 'tok');
  pidPut_('PID_SESS_' + h, { personId: pid, exp: now + PID_SESS_MS }); pidIndexAdd_(pid, 'PID_SESS_' + h);
  return { ok: true, token: token, kind: 'shared', personId: pid, name: person.name || '', role: person.role || '', tier: pidTierRank_(person) };
}

/* ── ACTION: authResume — a trusted personal device on boot ──
 * body: { token }.  UNAUTHENTICATED (the token IS the credential). */
function authResume_(body) {
  var caller = pidResolveCaller_((body || {}).token);
  if (!caller) return { ok: false, error: 'expired' };
  var person = pidPerson_({ personId: caller.personId }); if (!person) return { ok: false, error: 'gone' };
  return { ok: true, personId: String(person.id), name: person.name || '', role: person.role || '', tier: pidTierRank_(person) };
}

/* ── ACTION: authRevoke — remove-cascade / sign-out-everywhere (admin, or self) ──
 * body: { personId, token?, pw? }. Admin (tier>=admin) or the person themselves. */
function authRevoke_(body, role) {
  body = body || {};
  var pid = String(body.personId || ''); if (!pid) return { ok: false, error: 'bad-request' };
  var caller = pidResolveCaller_(body.token);
  var isSelf = caller && String(caller.personId) === pid;
  var isAdminCaller = (caller && caller.tier >= ROLE_TIER_RANK.admin) || roleTierRank_(role) >= ROLE_TIER_RANK.admin;
  if (!isSelf && !isAdminCaller) return { ok: false, error: 'forbidden' };
  pidPurgePerson_(pid);
  return { ok: true };
}

/* ── ACTION: authEnrollBlast — text the crew-welcome (app link, NO code) to the roster.
 * body: { personId? , token? }. Admin only. With personId → welcome just that one hand (the
 * per-person "send invite" button); without → the whole-crew blast. ── */
function authEnrollBlast_(body, role) {
  body = body || {};
  if (roleTierRank_(role) < ROLE_TIER_RANK.admin) {
    var caller = pidResolveCaller_(body.token);
    if (!caller || caller.tier < ROLE_TIER_RANK.admin) return { ok: false, error: 'forbidden' };
  }
  var list = pidRoster_(), sent = 0, skipped = 0;
  if (body.personId != null) list = list.filter(function (e) { return e && String(e.id) === String(body.personId); });
  for (var i = 0; i < list.length; i++) {
    var r = pidSendWelcome_(list[i]);
    if (r && r.ok) sent++; else skipped++;
  }
  return { ok: true, sent: sent, skipped: skipped };
}

/* ── per-call authorization: resolve a bearer token → { personId, role, tier } or null.
 *    Checks device-trust first (30d), then session (12h). Prunes on expiry. ── */
function pidResolveCaller_(token) {
  if (!token) return null;
  var h = pidHash_(String(token), 'tok'), now = Date.now();
  var rec = pidGet_('PID_DEV_' + h) || pidGet_('PID_SESS_' + h);
  var key = pidGet_('PID_DEV_' + h) ? 'PID_DEV_' + h : (pidGet_('PID_SESS_' + h) ? 'PID_SESS_' + h : null);
  if (!rec || !key) return null;
  if (now > rec.exp) { pidDel_(key); return null; }
  var person = pidPerson_({ personId: rec.personId }); if (!person) { pidDel_(key); return null; }
  return { personId: String(person.id), role: person.role || '', tier: pidTierRank_(person) };
}

/* ── per-person token index (for revoke-all) + purge ── */
function pidIndexAdd_(pid, key) { var ix = pidGet_('PID_IDX_' + pid) || []; if (ix.indexOf(key) === -1) ix.push(key); pidPut_('PID_IDX_' + pid, ix); }
function pidPurgePerson_(pid) {
  var ix = pidGet_('PID_IDX_' + pid) || [];
  for (var i = 0; i < ix.length; i++) pidDel_(ix[i]);
  pidDel_('PID_IDX_' + pid); pidDel_('PID_PIN_' + pid); pidDel_('PID_CODE_' + pid);
  pidDel_('PID_PINLOCK_' + pid); pidDel_('PID_RL_' + pid);
}

/* ── CASCADE HOOK (defense-in-depth): reconcile per-person auth to the roster after a
 *    config save. Call pidReconcileRoster_(prevEmployees, nextEmployees) from within
 *    saveConfigFromBody, just before returning ok. Three transitions:
 *      • REMOVED (id gone)        → pidPurgePerson_: cut device trust + PIN even if the
 *                                   client never calls authRevoke.
 *      • ADDED (new id w/ phone)  → pidSendWelcome_: text the crew-welcome (app link, no
 *                                   code) so a new hire knows where to sign in.
 *      • NUMBER CHANGED           → purge the old device trust/PIN (the phone IS the
 *                                   identity, so a moved number must re-prove possession)
 *                                   then welcome the NEW number.
 *    A name-only edit sends nothing. The welcome carries NO login code and does NOT touch the
 *    login rate-limit, so a hand can sign in immediately after being added. Runs AFTER
 *    saveConfigObj so pidWelcomeText_ reads the fresh roster + template; each send is guarded
 *    so one failure can't skip the rest of a bulk add. ── */
function pidReconcileRoster_(prevList, nextList) {
  var prevPhone = {};   // id → normalized phone at the previous save ('' if none)
  (prevList || []).forEach(function (e) { if (e && e.id) prevPhone[String(e.id)] = smsNormalizePhone_(e.phone) || ''; });
  var live = {}; (nextList || []).forEach(function (e) { if (e && e.id) live[String(e.id)] = 1; });
  // Removed → purge access.
  (prevList || []).forEach(function (e) { if (e && e.id && !live[String(e.id)]) pidPurgePerson_(String(e.id)); });
  // Added, or number changed → (re)enroll: sign out old devices on a change, then send.
  (nextList || []).forEach(function (e) {
    if (!e || !e.id) return;
    var id = String(e.id), toPhone = smsNormalizePhone_(e.phone) || '';
    if (!toPhone) return;                                          // no textable number → nothing to send
    var had = Object.prototype.hasOwnProperty.call(prevPhone, id);
    if (had && prevPhone[id] === toPhone) return;                 // unchanged number → no text
    try {
      if (had && prevPhone[id] !== toPhone) pidPurgePerson_(id);  // number moved → re-verify on the new one
      pidSendWelcome_(e);                                          // crew-welcome (app link, no code) to the (new) number
    } catch (err) { /* one bad send must not skip the rest of the roster */ }
  });
}

/* ============================================================================
 * ROUTER WIRING — add to handle() in Code.gs (mirrors the other handoff modules):
 *
 *   // per-person session token runs ALONGSIDE the legacy shared password.
 *   var pidCaller = body.sessionToken ? pidResolveCaller_(body.sessionToken) : null;
 *   var role = pidCaller ? pidCaller.role : roleForPassword(pw);
 *   // (all existing tier gates already use roleTierRank_(role)/roleMoneyOk_(role) — unchanged;
 *   //  when pidCaller is set, `pw` is ignored for authz.)
 *
 *   // UNAUTHENTICATED auth endpoints (you're logging in) — reachable pre-session:
 *   if (action === 'authStart')      return json(authStart_(body));
 *   if (action === 'authVerify')     return json(authVerify_(body));
 *   if (action === 'authLoginPin')   return json(authLoginPin_(body));
 *   if (action === 'authResume')     return json(authResume_(body));
 *   if (action === 'authSetPin')     return json(authSetPin_(body));
 *   if (action === 'authRevoke')     return json(authRevoke_(body, role));
 *   if (action === 'authEnrollBlast')return json(authEnrollBlast_(body, role));
 *
 * WRITE_ACTIONS (POST-only) — add these keys to the WRITE_ACTIONS literal:
 *   authStart:1, authVerify:1, authLoginPin:1, authResume:1, authSetPin:1,
 *   authRevoke:1, authEnrollBlast:1
 *
 * saveConfigFromBody() — capture the prior roster then reconcile after a successful save:
 *   var prevEmp = ((getConfigObj().settings||{}).employees) || [];
 *   ...saveConfigObj(clean)...
 *   pidReconcileRoster_(prevEmp, (clean.settings||{}).employees || []);
 *
 * PHASE 5 (later, Jac's call): once everyone's enrolled, remove the shared-password
 * acceptance so `pw` no longer authenticates — until then BOTH paths work (flag-safe).
 * ============================================================================ */
