/* Unit daily snapshots — backend additions (M4, prepared 2026-07-03)
 * ------------------------------------------------------------------
 * Secret-free record of the ADDITIVE Code.gs changes for the daily
 * unit-hours/fleet-status snapshot job (Code.gs is gitignored; this is
 * the tracked copy per the /clasp rules).
 * Spec: docs/superpowers/specs/2026-07-03-manager-metrics-design.md §3
 * Also serves fleet-history #454 (fleetStatus rides the same rows).
 *
 * WHY: the manager's Time Utilization formula needs actual meter hours
 * per rolling 30 days — we only store one lifetime currentHours per
 * unit. A daily snapshot builds the history: after ~30 days the
 * front-end swaps its days-on-rent proxy for (Δhours ÷ expected) × 100.
 *
 * STORAGE: a 'unitDaily' tab with FLAT columns (date · unitId ·
 * currentHours · fleetStatus) — one row per unit per day. Flat beats
 * the JSON-blob entity convention here: it's a time series (~36.5k
 * rows/yr at 100 units), and flat ranges read in one getValues() pass.
 *
 * INSTALL (three additive steps, nothing existing changes):
 *   1. Paste this whole file at the END of Code.gs.
 *   2. Add ONE route line inside handle(), anywhere after the
 *      `if (!role) return json({ ok:false, error:'unauthorized' });`
 *      gate (so any signed-in role can read — Jac's 2026-07-03 call):
 *        if (action === 'unitDaily') return json(unitDaily_(body));
 *   3. Run installUnitDailyTrigger() ONCE from the Apps Script editor
 *      (Run button) — the editor will prompt to authorize the new
 *      trigger permission (script.scriptapp) on first run; approve it.
 *      This CANNOT be automated: web-app executions lack that scope,
 *      and adding a scope requires owner re-consent — which IS the
 *      editor run. Deployed to prod @57, 2026-07-03.
 */

var UNITDAILY_TAB = 'unitDaily';

/* the daily job — installable time-driven trigger target (~5am America/Chicago).
 * Idempotent per day: re-runs (or a manual run after the trigger) no-op. */
function snapshotUnitsDaily() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var s = ss().getSheetByName(UNITDAILY_TAB);
    if (!s) { s = ss().insertSheet(UNITDAILY_TAB); s.appendRow(['date', 'unitId', 'currentHours', 'fleetStatus']); }
    var last = s.getLastRow();
    if (last >= 2) {
      var lastDate = s.getRange(last, 1).getValue();
      var lastIso = (lastDate instanceof Date) ? Utilities.formatDate(lastDate, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(lastDate);
      if (lastIso === today) return;   // already snapped today
    }
    // read the units entity the same way doLoad() does (JSON blob per row)
    var units = [], us = ss().getSheetByName('units');
    if (us) {
      var ulast = us.getLastRow(), ucols = us.getLastColumn();
      if (ulast >= 2 && ucols >= 1) {
        var vals = us.getRange(2, 1, ulast - 1, ucols).getValues();
        for (var i = 0; i < vals.length; i++) {
          for (var c = vals[i].length - 1; c >= 0; c--) {
            var cell = vals[i][c];
            if (typeof cell === 'string' && cell.charAt(0) === '{') { try { units.push(JSON.parse(cell)); break; } catch (e2) {} }
          }
        }
      }
    }
    if (!units.length) return;
    var rows = [];
    for (var j = 0; j < units.length; j++) {
      var u = units[j]; if (!u || !u.unitId) continue;
      rows.push([today, String(u.unitId), Number(u.currentHours) || 0, String(u.fleetStatus || '')]);
    }
    if (rows.length) s.getRange(s.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  } finally { lock.releaseLock(); }
}

/* read handler — returns snapshot rows, optionally floored by body.since
 * (ISO date). Auth: rides handle()'s existing role gate (any signed-in
 * role; no money data in these rows). */
function unitDaily_(body) {
  var s = ss().getSheetByName(UNITDAILY_TAB);
  if (!s || s.getLastRow() < 2) return { ok: true, rows: [] };
  var since = String((body && body.since) || '');
  var vals = s.getRange(2, 1, s.getLastRow() - 1, 4).getValues(), out = [];
  for (var i = 0; i < vals.length; i++) {
    var d = (vals[i][0] instanceof Date) ? Utilities.formatDate(vals[i][0], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(vals[i][0]);
    if (since && d < since) continue;
    out.push({ date: d, unitId: String(vals[i][1]), hours: Number(vals[i][2]) || 0, fleetStatus: String(vals[i][3]) });
  }
  return { ok: true, rows: out };
}

/* one-time trigger install — safe to re-run (dedupes on handler name) */
function installUnitDailyTrigger() {
  var trigs = ScriptApp.getProjectTriggers();
  for (var i = 0; i < trigs.length; i++) {
    if (trigs[i].getHandlerFunction() === 'snapshotUnitsDaily') return;
  }
  ScriptApp.newTrigger('snapshotUnitsDaily').timeBased().everyDays(1).atHour(5).create();
}
