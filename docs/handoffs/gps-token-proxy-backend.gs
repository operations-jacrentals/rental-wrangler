/* ════════════════════════════════════════════════════════════════════════
 * gpsToken — WranglerGPS auth proxy (AS-BUILT REFERENCE, read from live
 * Code.gs via the Drive connector 2026-07-09, for the #552 pre-promotion
 * audit's "no snippet exists for this action" gap). NO secrets below.
 * -------------------------------------------------------------------------
 * The forked WranglerGPS telematics service (Railway) authenticates with a
 * SINGLE team password that mints an x-auth-token good for both reads and
 * remote engine shutdown — so that password must never reach the public
 * Pages client. app.js calls backendCall('gpsToken') instead; the backend
 * logs in server-side and hands back ONLY the derived token.
 *
 * Dispatch (in handle(), after the role/password gate):
 *   if (action === 'gpsToken') return json(gpsToken_(role));
 * gpsToken is also listed in WRITE_ACTIONS (POST-only) — the derived token
 * is itself shutdown-capable, so it must never ride in a GET URL that could
 * get logged/prefetched (§256 in the live source).
 * ════════════════════════════════════════════════════════════════════════ */

function gpsToken_(role) {
  var props = PropertiesService.getScriptProperties();
  // Script Property WINS. Live source ALSO carries a hardcoded fallback
  // password here (a real string, not a placeholder) for "no Script-Property
  // step needed to go live" — see the audit finding below before ever
  // re-pasting this function verbatim.
  var pw = props.getProperty('GPS_DASHBOARD_PASSWORD') || '<REDACTED — see finding below, do not restore a hardcoded fallback>';
  if (!pw) return { ok: false, error: 'gps-not-configured' };
  var base = (props.getProperty('GPS_BACKEND_URL') || 'https://wranglergps-production-c2ad.up.railway.app').replace(/\/+$/, '');
  var resp;
  try {
    resp = UrlFetchApp.fetch(base + '/auth/login', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ password: pw }), muteHttpExceptions: true
    });
  } catch (e) { return { ok: false, error: 'gps-unreachable' }; }
  var code = resp.getResponseCode();
  var out; try { out = JSON.parse(resp.getContentText()); } catch (e) { out = null; }
  if (code >= 200 && code < 300 && out && out.token) return { ok: true, token: out.token };
  return { ok: false, error: 'gps-auth-' + code };   // never echo the upstream body — may leak internals
}

/* ── AUDIT FINDING (2026-07-09) — flagged to Jac in chat, not fixed here ──
 * The live gpsToken_ has a HARDCODED plaintext fallback password baked into
 * the source (`props.getProperty('GPS_DASHBOARD_PASSWORD') || '<a real
 * password string>'`), justified in the live comment as "minimal steps,
 * secrets-exposure OK — Code.js is server-side + gitignored, never served
 * publicly." That's true for the PUBLIC-repo exposure vector, but it still
 * means the credential can never be fully rotated without an editor edit
 * (clearing the Script Property alone doesn't remove it — the fallback just
 * silently takes back over), and it sits in plaintext for anyone with edit
 * access to the Apps Script project, not just Script Properties access.
 * Recommend: set GPS_DASHBOARD_PASSWORD as a real Script Property (it may
 * already be set — Script Property still wins today) and remove the
 * hardcoded fallback string entirely on the next backend deploy.
 * ── */
