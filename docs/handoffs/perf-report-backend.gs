/* perfReport — backend addition (prepared 2026-07-06, spec frontend-performance D2)
 *
 * ADDITIVE splice for Code.gs (gitignored; deployed via clasp — see
 * docs/handoffs/backend-deploy-via-clasp.md). Accepts the client's sampled
 * Web-Vitals flush and appends it to a dedicated `_perf` tab — OUTSIDE
 * PERSIST_KEYS, so it never rides diff-sync or the cold-load payload.
 *
 * SECURITY:
 *  - Rides handle()'s existing password gate (any signed-in role — rejects
 *    anonymous, so the sink can't be spammed from outside).
 *  - METRICS ONLY by construction: the handler writes an explicit column list;
 *    a crafted client can't smuggle extra fields into the sheet. No PII, no
 *    dollars, no record ids, never a password (the role ID string only).
 *  - Fire-and-forget contract: always returns { ok:true } fast; the client
 *    swallows failures (a broken sink must be indistinguishable from none).
 *
 * WIRE-UP: add to handle()'s router:
 *     if (action === 'perfReport') return perfReport_(body);
 */
var PERF_TAB = '_perf';
var PERF_MAX_ROWS = 5000;   // rolling window — the sink can never bloat the file

function perfReport_(body) {
  try {
    var s = ss().getSheetByName(PERF_TAB);
    if (!s) { s = ss().insertSheet(PERF_TAB); s.appendRow(['ts', 'build', 'device', 'role', 'lcp', 'inp', 'cls', 'renderP50', 'renderP95', 'renderOver', 'renderN']); }
    var v = (body && body.vitals) || {};
    var r = (body && body.renders) || {};
    var n1 = function (x) { x = Number(x); return isFinite(x) ? x : ''; };
    var t1 = function (x, cap) { return String(x == null ? '' : x).slice(0, cap || 40); };
    s.appendRow([
      new Date(), t1(body && body.build), t1(body && body.device, 10), t1(body && body.role, 24),
      n1(v.lcp), n1(v.inp), n1(v.cls), n1(r.p50), n1(r.p95), n1(r.over), n1(r.n),
    ]);
    var extra = s.getLastRow() - 1 - PERF_MAX_ROWS;
    if (extra > 0) s.deleteRows(2, extra);   // FIFO: oldest samples roll off
  } catch (e) { /* fire-and-forget — never propagate an error to the client */ }
  return { ok: true };
}
