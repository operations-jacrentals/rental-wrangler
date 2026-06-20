/* ─────────────────────────────────────────────────────────────────────────
 * Backend additions — cross-device chat sync (team chat + Mr. Wrangler rail)
 * Secret-free; spliced into the gitignored backend/Code.gs and clasp-deployed.
 * See docs/superpowers/specs/2026-06-20-wrangler-rail-cross-device-sync-design.md
 *
 * Two Sheet tabs, one row per chat (each cell well under the 50k-char cap):
 *   teamChats     [id, json]          — SHARED across the team (never deleted)
 *   wranglerRails [role, id, json]    — per-ROLE (role from roleForPassword; a
 *                                       client reads/writes only its own rows)
 *
 * NOTE: team-chat sync's frontend (pushChats/loadChats/mergeChats) was already
 * built; only this backend handler was missing, so it was dormant. This lights
 * it up. Reuses ss()/rowIndexById()/LockService from Code.gs.
 *
 * Wire into doPost's action switch, next to saveSession/getSession:
 *   if (action === 'getChats')        return json(getChats_(body, role));
 *   if (action === 'setChats')        return json(setChats_(body, role));
 *   if (action === 'getWranglerRail') return json(getWranglerRail_(body, role));
 *   if (action === 'setWranglerRail') return json(setWranglerRail_(body, role));
 * (Any signed-in role. role is already resolved server-side from the password.)
 * ───────────────────────────────────────────────────────────────────────── */

var TEAMCHATS_TAB = 'teamChats';
var WRANGLERRAIL_TAB = 'wranglerRails';

/* ── Team chat (SHARED, persistent — upsert-only, never delete) ───────────── */
function getChats_(body, role) {
  var s = ss().getSheetByName(TEAMCHATS_TAB), out = [];
  if (s) {
    var last = s.getLastRow();
    if (last >= 2) {
      var vals = s.getRange(2, 2, last - 1, 1).getValues();   // the json column
      for (var i = 0; i < vals.length; i++) {
        try { var c = JSON.parse(vals[i][0]); if (c && c.id) out.push(c); } catch (e) {}
      }
    }
  }
  return { ok: true, chats: out };
}
function setChats_(body, role) {
  var chats = (body && body.chats) || [];
  var n = 0;
  if (!chats.length) return { ok: true, saved: 0 };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var s = ss().getSheetByName(TEAMCHATS_TAB);
    if (!s) { s = ss().insertSheet(TEAMCHATS_TAB); s.getRange(1, 1, 1, 2).setValues([['id', 'json']]); }
    var idMap = rowIndexById(s), appends = [];
    chats.forEach(function (c) {
      if (!c || !c.id) return;
      var id = String(c.id), js = JSON.stringify(c), row = idMap[id];
      if (row) s.getRange(row, 1, 1, 2).setValues([[id, js]]);
      else appends.push([id, js]);
      n++;
    });
    if (appends.length) s.getRange(s.getLastRow() + 1, 1, appends.length, 2).setValues(appends);
  } finally { lock.releaseLock(); }
  return { ok: true, saved: n };
}

/* ── Mr. Wrangler rail (per-ROLE; client only ever touches its own rows) ──── */
function wranglerRailSheet_() {
  var s = ss().getSheetByName(WRANGLERRAIL_TAB);
  if (!s) { s = ss().insertSheet(WRANGLERRAIL_TAB); s.getRange(1, 1, 1, 3).setValues([['role', 'id', 'json']]); }
  return s;
}
function getWranglerRail_(body, role) {
  var s = ss().getSheetByName(WRANGLERRAIL_TAB), out = [];
  if (s) {
    var last = s.getLastRow();
    if (last >= 2) {
      var vals = s.getRange(2, 1, last - 1, 3).getValues();   // role, id, json
      for (var i = 0; i < vals.length; i++) {
        if (String(vals[i][0]) !== String(role)) continue;     // ISOLATION: only this role's rows
        try { var c = JSON.parse(vals[i][2]); if (c && c.id) out.push(c); } catch (e) {}
      }
    }
  }
  return { ok: true, chats: out };
}
// Reconcile THIS role's rail to exactly body.chats (upsert present, delete absent).
// The client always sends its full in-memory rail (like setChats), so deletes
// propagate. Other roles' rows are never read or touched.
function setWranglerRail_(body, role) {
  var chats = (body && body.chats) || [];
  var n = 0;
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var s = wranglerRailSheet_();
    var last = s.getLastRow();
    var rowOf = {}, existing = {};
    if (last >= 2) {
      var meta = s.getRange(2, 1, last - 1, 2).getValues();    // role, id
      for (var i = 0; i < meta.length; i++) {
        if (String(meta[i][0]) !== String(role)) continue;
        var eid = String(meta[i][1]); rowOf[eid] = i + 2; existing[eid] = true;
      }
    }
    var keep = {}, appends = [];
    // 1) upsert existing rows in place (no index shift)
    chats.forEach(function (c) {
      if (!c || !c.id) return;
      var id = String(c.id), js = JSON.stringify(c); keep[id] = true;
      if (rowOf[id]) s.getRange(rowOf[id], 1, 1, 3).setValues([[String(role), id, js]]);
      else appends.push([String(role), id, js]);
      n++;
    });
    // 2) delete this role's rows absent from the payload (high→low, before appends)
    var del = [];
    Object.keys(existing).forEach(function (id) { if (!keep[id]) del.push(rowOf[id]); });
    del.sort(function (a, b) { return b - a; }).forEach(function (r) { s.deleteRow(r); });
    // 3) append the new rows
    if (appends.length) s.getRange(s.getLastRow() + 1, 1, appends.length, 3).setValues(appends);
  } finally { lock.releaseLock(); }
  return { ok: true, saved: n };
}
