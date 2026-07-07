/* adminSetProps — backend addition (2026-07-06, Jac: "I want YOU to be able to do this stuff")
 *
 * ADDITIVE splice for Code.gs. Lets an ADMIN-authenticated caller set Script Properties
 * through the web app — closing the one gap Google's REST API has no endpoint for, so the
 * agent can wire provider keys (from env secrets) without the editor.
 *
 * SECURITY:
 *  - isAdmin(pw) gated — same gate as getConfig/setConfig.
 *  - SET-ONLY: never reads, never echoes a value; the response lists property NAMES set.
 *  - NAME ALLOWLIST: only comms-scope properties may be written. Deliberately excludes
 *    STRIPE_SECRET / price-lock HMAC / GitHub tokens — blast radius stays comms-sized.
 *    Growing the allowlist is a reviewed code change, not a parameter.
 *
 * WIRE-UP: add to handle()'s router (pw is in scope, same as the getConfig route):
 *     if (action === 'adminSetProps') return json(adminSetProps_(body, pw));
 */
var ADMIN_PROP_ALLOWLIST = ['TWILIO_SID', 'TWILIO_TOKEN', 'TWILIO_FROM', 'SMS_PROVIDER', 'MOCEAN_TOKEN', 'MOCEAN_API_KEY', 'MOCEAN_API_SECRET', 'MOCEAN_FROM', 'SMS_DAILY_CAP'];

function adminSetProps_(body, pw) {
  if (!isAdmin(pw)) return { ok: false, error: 'forbidden' };
  var props = (body && body.props) || {};
  var set = [], skipped = [];
  for (var k in props) {
    if (ADMIN_PROP_ALLOWLIST.indexOf(k) !== -1 && props[k] !== undefined && props[k] !== '') {
      PropertiesService.getScriptProperties().setProperty(k, String(props[k]));
      set.push(k);
    } else {
      skipped.push(k);
    }
  }
  return { ok: true, set: set, skipped: skipped };   // names only — values never round-trip
}
