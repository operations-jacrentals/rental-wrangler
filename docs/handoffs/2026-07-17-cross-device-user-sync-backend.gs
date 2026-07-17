/* Cross-device user sync — backend additions (Code.gs)          ── SECURITY-CRITICAL
 * ============================================================================
 * Secret-free, tracked mirror of the additive Code.gs handlers for cross-device
 * per-PERSON sync (Code.gs is gitignored; this is the reviewable copy, per /clasp).
 * Spec: docs/superpowers/specs/2026-07-17-cross-device-user-sync-design.md (§4, §8, §12)
 *
 * ⚠ DEPLOY STATUS (2026-07-17): `getUserPrefs_`/`setUserPrefs_` (+ their dispatch and the
 * `setUserPrefs` WRITE_ACTIONS entry) were ALREADY deployed to HEAD by a concurrent session
 * (a compatible contract: personId resolved server-side from the token, `body.doc`, per-top-
 * level-bucket field-merge, returns {ok,doc}). So THIS change pushed ONLY the additive
 * `pidSyncKey_` + `getGroupOrderResolved_` functions and the four group-order/Wrangler-rail
 * dispatch re-keys — NOT the getUserPrefs/setUserPrefs blob below (kept here for reference;
 * the live blob is the concurrent session's equivalent). Do NOT re-push the blob — it would
 * duplicate `function getUserPrefs_`. Go-live remains Jac's Apps Script editor deploy.
 *
 * WHAT (all keyed on personId, resolved SERVER-SIDE from the session token):
 *   1. NEW  getUserPrefs / setUserPrefs — a small per-person JSON "light state" blob
 *           (display/sort prefs, saved Views, dispatch route state, comms state, a
 *           resume pointer). Field-merged server-side, last-write-wins per field.
 *   2. RE-KEY (additive superset) getGroupOrder/setGroupOrder + getWranglerRail/
 *           setWranglerRail from role → personId. A legacy shared-password session
 *           (no personId) keeps its EXACT current role-keyed behavior — nothing
 *           removed, only a new per-person branch added.
 *
 * DEPLOY (STOP-GATE, every time): ADDITIVE ONLY — old clients + the shared-password
 * path keep working. Push via the service-account path
 * (docs/handoffs/gas-deploy-service-account.mjs, GAS_IMPERSONATE_SUBJECT=
 * operations@jacrentals.com); GO-LIVE is Jac's Apps Script EDITOR deploy.
 *
 * ── SECURITY (the hard gate, spec §8) ─────────────────────────────────────────
 *  - personId is resolved from the AUTHENTICATED session token on the backend
 *    (pidResolveCaller_(sessionToken) → the router's `pidCaller`). It is NEVER
 *    selected from a client-supplied value. A body.personId is only a HINT and, if
 *    present, MUST equal the resolved caller — else `unauthorized` (mirrors
 *    authSetPin_). So operator A can never read/write operator B's prefs (or rail /
 *    group-order) by passing B's id.
 *  - Reads by a caller with no resolvable personId (legacy login) return an empty
 *    doc (the client falls back to device-local localStorage). Writes by such a
 *    caller are rejected — never write an un-keyed row.
 *  - The blob holds innocuous UI/pref state only: no customer PII, no margin/cost.
 * ============================================================================ */

var USERPREFS_TAB = 'UserPrefs';   // columns: [personId, json] — one row per person

/* Namespaced sync key: prefer the caller's personId (follows the person across
 * devices); fall back to the role (legacy shared-password session). The 'p:' prefix
 * keeps personId keys from ever colliding with a role literal ('admin', 'office', …)
 * in the shared _groupOrder cell or the wranglerRails role column. */
function pidSyncKey_(pidCaller, role) {
  return (pidCaller && pidCaller.personId) ? ('p:' + String(pidCaller.personId)) : String(role || '');
}

/* ── UserPrefs sheet + per-person resolution ──────────────────────────────── */
function userPrefsSheet_() {
  var s = ss().getSheetByName(USERPREFS_TAB);
  if (!s) { s = ss().insertSheet(USERPREFS_TAB); s.getRange(1, 1, 1, 2).setValues([['personId', 'json']]); }
  return s;
}
/* Resolve the row key SERVER-SIDE. pidCaller comes from the router
 * (pidResolveCaller_(body.sessionToken)). Returns the personId string, or null when
 * there's no verifiable person or a body hint disagrees with the token. */
function userPrefsPid_(body, pidCaller) {
  if (!pidCaller || !pidCaller.personId) return null;                                  // no verifiable person
  if (body && body.personId != null && String(body.personId) !== String(pidCaller.personId)) return null;  // hint must match the token (authSetPin_ rule)
  return String(pidCaller.personId);
}

/* ── ACTION: getUserPrefs — read this person's light-state doc ──
 * body: { sessionToken }.  Returns { ok:true, doc } (empty {} when no row / no person). */
function getUserPrefs_(body, pidCaller) {
  var pid = userPrefsPid_(body, pidCaller);
  if (!pid) return { ok: true, doc: {} };                    // legacy/no-person → empty → client uses localStorage
  var s = userPrefsSheet_(), last = s.getLastRow();
  if (last >= 2) {
    var vals = s.getRange(2, 1, last - 1, 2).getValues();    // personId, json
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) !== pid) continue;              // ISOLATION: only this person's row
      try { var doc = JSON.parse(vals[i][1]); return { ok: true, doc: (doc && typeof doc === 'object' && !Array.isArray(doc)) ? doc : {} }; }
      catch (e) { return { ok: true, doc: {} }; }
    }
  }
  return { ok: true, doc: {} };                              // no row yet → empty (client seeds from localStorage)
}

/* ── ACTION: setUserPrefs — field-merge a patch into this person's doc ──
 * body: { sessionToken, doc:<partial> }.  Only the top-level keys present in `doc`
 * are touched (last-write-wins per field); other keys are preserved. Writes REQUIRE
 * a resolvable person — a legacy/no-person caller is rejected (never write un-keyed). */
function setUserPrefs_(body, pidCaller) {
  var pid = userPrefsPid_(body, pidCaller);
  if (!pid) return { ok: false, error: 'unauthorized' };
  var patch = (body && body.doc) || {};
  if (typeof patch !== 'object' || Array.isArray(patch)) return { ok: false, error: 'bad-doc' };
  if (JSON.stringify(patch).length > 200000) return { ok: false, error: 'too-large' };   // light state only — guard runaway blobs (spec §10)
  var lock = tryLock_(15000); if (!lock) return { ok: false, error: 'busy' };
  try {
    var s = userPrefsSheet_(), last = s.getLastRow(), row = 0, cur = {};
    if (last >= 2) {
      var ids = s.getRange(2, 1, last - 1, 1).getValues();   // personId column
      for (var i = 0; i < ids.length; i++) { if (String(ids[i][0]) === pid) { row = i + 2; break; } }
    }
    if (row) { try { cur = JSON.parse(s.getRange(row, 2).getValue()) || {}; } catch (e) { cur = {}; } }
    var merged = userPrefsMerge_(cur, patch);
    merged.v = merged.v || patch.v || 1;
    merged.updatedAt = Date.now();
    var js = JSON.stringify(merged);
    if (row) s.getRange(row, 1, 1, 2).setValues([[pid, js]]);
    else s.getRange(s.getLastRow() + 1, 1, 1, 2).setValues([[pid, js]]);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

/* Field-merge: each top-level key in `patch` overwrites `cur` (last-write-wins per
 * field). For known nested objects (prefs, dispatch, comms, session) we merge ONE
 * level deep, so a device flushing only `prefs` doesn't clobber `comms`, and a flush
 * carrying only the changed sub-blob still preserves the sibling keys the client sent
 * whole. Arrays (views) and scalars replace wholesale. */
function userPrefsMerge_(cur, patch) {
  var out = {}, k;
  for (k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) out[k] = cur[k];
  for (k in patch) {
    if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
    var pv = patch[k], cv = out[k];
    if (pv && typeof pv === 'object' && !Array.isArray(pv) && cv && typeof cv === 'object' && !Array.isArray(cv)) {
      var m = {}, kk;
      for (kk in cv) if (Object.prototype.hasOwnProperty.call(cv, kk)) m[kk] = cv[kk];
      for (kk in pv) if (Object.prototype.hasOwnProperty.call(pv, kk)) m[kk] = pv[kk];
      out[k] = m;
    } else {
      out[k] = pv;
    }
  }
  return out;
}

/* getGroupOrder read WITH role-default seeding (spec §6). For a personId caller with
 * no per-person slice yet, return the role default (arrangement only, no content) —
 * READ-ONLY, never persisted — so the person's copy diverges on their first save.
 * Used by the getGroupOrder dispatch (see wiring block below). */
function getGroupOrderResolved_(pidCaller, role) {
  var all = getGroupOrderObj();
  var gk = pidSyncKey_(pidCaller, role);
  if (all[gk] && typeof all[gk] === 'object') return all[gk];                      // this person's own arrangement
  if (pidCaller && pidCaller.personId && all[role] && typeof all[role] === 'object') return all[role];  // seed from the role default (read-only)
  return (all[role] && typeof all[role] === 'object') ? all[role] : {};            // legacy pw session: role slice
}

/* ============================================================================
 * ROUTER WIRING — splice into handle() in Code.gs (Code.gs:119-300 region).
 * `pidCaller` and `role` are already computed at the top of handle():
 *     var pidCaller = body.sessionToken ? pidResolveCaller_(body.sessionToken) : null;
 *     ... var role = pidRole_();  (role = pidCaller ? pidCaller.role : roleForPassword(pw))
 *
 * (A) REPLACE the four existing dispatch lines (behaviour is a strict superset — the
 *     legacy `role` branch is identical; a personId caller gets its own per-person key):
 *
 *     // was: if (action === 'getGroupOrder') return json({ ok:true, order:(getGroupOrderObj()[role]||{}) });
 *     if (action === 'getGroupOrder') return json({ ok: true, order: getGroupOrderResolved_(pidCaller, role) });
 *     // was: if (action === 'setGroupOrder') return json(saveGroupOrderFromBody(body, role));
 *     if (action === 'setGroupOrder') return json(saveGroupOrderFromBody(body, pidSyncKey_(pidCaller, role)));
 *
 *     // was: if (action === 'getWranglerRail') return json(getWranglerRail_(body, role));
 *     if (action === 'getWranglerRail') return json(getWranglerRail_(body, pidSyncKey_(pidCaller, role)));
 *     // was: if (action === 'setWranglerRail') return json(setWranglerRail_(body, role));
 *     if (action === 'setWranglerRail') return json(setWranglerRail_(body, pidSyncKey_(pidCaller, role)));
 *     //   → start-fresh falls out naturally: no wranglerRails rows for 'p:<id>' → empty rail;
 *     //     the legacy role rows are never read by a personId caller (key mismatch), never migrated.
 *
 * (B) ADD two new dispatch lines (place them next to getGroupOrder, AFTER `var role = pidRole_()`):
 *
 *     if (action === 'getUserPrefs') return json(getUserPrefs_(body, pidCaller));
 *     if (action === 'setUserPrefs') return json(setUserPrefs_(body, pidCaller));
 *
 * (C) WRITE_ACTIONS literal (Code.gs:147) — add the POST-only write:
 *     setUserPrefs: 1
 *     (getUserPrefs stays GET-readable, like getGroupOrder/getWranglerRail/getViews.)
 *
 * NOTHING ELSE CHANGES. getGroupOrderObj/saveGroupOrderFromBody/getWranglerRail_/
 * setWranglerRail_ are reused UNCHANGED — only the KEY handed to them differs, plus the
 * tiny read-time seed in getGroupOrderResolved_. Team-chat attribution (commentUserKey/
 * chatSyncIdentity → personId) is a CLIENT-only change; getChats_/setChats_ are untouched.
 * ============================================================================ */
