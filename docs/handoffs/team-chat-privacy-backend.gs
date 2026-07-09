/* ─────────────────────────────────────────────────────────────────────────
 * Backend additions — TEAM-CHAT PRIVACY (2026-07-08 rail spec)
 * Secret-free; REPLACES getChats_/setChats_ in the gitignored backend/Code.gs.
 * See docs/superpowers/specs/2026-07-08-team-chat-rail-update-design.md
 *
 * WHY: team chats were SHARED — getChats_ returned every chat to every client,
 * so membership was a client-side filter only (anyone with the team password
 * could read a chat they weren't in via the raw sync). This scopes reads to the
 * caller and authorizes writes, so membership is a real server-side boundary.
 *
 * IDENTITY MODEL: the backend authenticates by the shared team PASSWORD (→ role),
 * not per person. The client asserts who it is: body.me = userKey (the login
 * name / commentUserKey), body.rosterId = its Settings→Team Roster person id.
 * This is a real filter for normal use, gated behind the team password — NOT a
 * cryptographic boundary (a crafted request could assert another identity). True
 * per-person privacy would need per-user auth (separate logins), a bigger change.
 *
 * ⚠ UPDATED 2026-07-09 (backend audit, CRITICAL finding, confirmed): the original
 * BACK-COMPAT design below — "body.me absent → treat as an old client, fall back
 * to unscoped read / trust-all write" — is a universal bypass, not just an
 * old-client shim: the server can't tell a genuinely old client from ANY current
 * caller who simply omits `me`. Since the new frontend that sends me/rosterId on
 * every call (branch claude/internal-chat-updates-vq6p7b) hasn't shipped yet, this
 * means the scoping this feature was built for has never actually been active in
 * production for anyone. Fix: the back-compat fallback is REMOVED below — both
 * handlers now always scope/authorize by `me`, full stop. This is NOT safe to
 * deploy independently anymore (the current live frontend never sends `me`, so it
 * would suddenly see empty chats / have writes rejected) — deploy this in the SAME
 * rollout as claude/internal-chat-updates-vq6p7b, not before.
 *
 * UPDATED AGAIN 2026-07-09 (same audit, HIGH finding): chatMergeMsgs_ didn't
 * validate that an incoming message's `by` field matched the authenticated
 * `me` — any authorized participant could inject a message object claiming
 * to be from a DIFFERENT member. Fixed below (now takes `me`, drops any
 * incoming message whose `by` doesn't match). Also folded in: setChats_'s
 * `id` now goes through deformula_() (already shipped live separately —
 * keeping this queued file in sync so deploying it later doesn't regress it).
 * ───────────────────────────────────────────────────────────────────────── */

// Can this caller SEE this chat? Admin (creator) or a listed member. A legacy chat
// with no recorded owner stays visible (back-compat with pre-spec threads).
function chatCanSee_(c, me, rosterId) {
  if (!c) return false;
  if (!c.by) return true;                                   // legacy — no owner recorded
  if (String(c.by) === String(me)) return true;             // you created it (admin)
  var mem = c.members || [];
  return rosterId != null && mem.map(String).indexOf(String(rosterId)) !== -1;
}

// Union messages by id (never lose a concurrent poster's message), oldest-first.
// me: reject any incoming message whose `by` doesn't match the caller — you can
// only ever inject messages asserting YOUR OWN authorship, never someone else's.
function chatMergeMsgs_(existing, incoming, me) {
  var out = (existing || []).slice(), have = {};
  out.forEach(function (m) { if (m && m.id) have[m.id] = true; });
  (incoming || []).forEach(function (m) {
    if (!m || !m.id || have[m.id]) return;
    if (String(m.by) !== String(me)) return;
    out.push(m); have[m.id] = true;
  });
  out.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
  return out;
}

// Merge per-user maps (seen/muted) taking the latest / union so one client's stale
// view can't clobber another user's state.
function chatMergeSeen_(existing, incoming) {
  var out = {}, k;
  existing = existing || {}; incoming = incoming || {};
  for (k in existing) out[k] = existing[k];
  for (k in incoming) if (!(k in out) || (incoming[k] || 0) > (out[k] || 0)) out[k] = incoming[k];
  return out;
}

/* ── Scoped read: only the chats this caller may see. ALWAYS scoped — no me → sees
 * only legacy chats with no recorded owner (chatCanSee_'s own back-compat rule). ── */
function getChats_(body, role) {
  var me = body && body.me, rosterId = body && body.rosterId;
  var s = ss().getSheetByName(TEAMCHATS_TAB), out = [];
  if (s) {
    var last = s.getLastRow();
    if (last >= 2) {
      var vals = s.getRange(2, 2, last - 1, 1).getValues();   // the json column
      for (var i = 0; i < vals.length; i++) {
        try {
          var c = JSON.parse(vals[i][0]);
          if (c && c.id && chatCanSee_(c, me, rosterId)) out.push(c);
        } catch (e) {}
      }
    }
  }
  return { ok: true, chats: out };
}

/* ── Authorized write: decide what actually gets stored for each incoming chat. ──
 * No me (no asserted identity): rejected outright — no more "old client" trust-all.
 * New chat: only its stated owner may create it.
 * Existing + caller is owner: full update (messages unioned).
 * Existing + caller is a member (per the SERVER copy): may append messages + remove
 *   THEMSELVES; may NOT change title/owner or other members (no injecting/tampering).
 * Existing + caller is neither: rejected. */
function chatAuthorizeWrite_(existing, inc, me, rosterId) {
  if (me == null) return null;                               // no identity asserted → reject
  if (!existing) return (String(inc.by) === String(me)) ? inc : null;   // create only your own
  if (existing.by && String(existing.by) === String(me)) {  // owner (admin)
    inc.messages = chatMergeMsgs_(existing.messages, inc.messages, me);
    inc.seen = chatMergeSeen_(existing.seen, inc.seen);
    return inc;
  }
  var mem = (existing.members || []).map(String);
  var amMember = rosterId != null && mem.indexOf(String(rosterId)) !== -1;
  if (!amMember) return null;                                // not a participant → reject
  var next = {}, k; for (k in existing) next[k] = existing[k];   // start from the SERVER copy
  next.messages = chatMergeMsgs_(existing.messages, inc.messages, me);
  // a member may only touch THEIR OWN view-state — seen[me] + their own mute — never others'
  var seen = {}, sk; for (sk in (existing.seen || {})) seen[sk] = existing.seen[sk];
  if (inc.seen && inc.seen[me] != null && (inc.seen[me] > (seen[me] || 0))) seen[me] = inc.seen[me];
  next.seen = seen;
  var muted = (existing.muted || []).filter(function (x) { return String(x) !== String(me); });
  if ((inc.muted || []).map(String).indexOf(String(me)) !== -1) muted.push(me);
  next.muted = muted;
  var incMem = (inc.members || []).map(String);
  next.members = (incMem.indexOf(String(rosterId)) === -1)   // allow SELF-leave only
    ? mem.filter(function (x) { return x !== String(rosterId); })
    : mem;                                                   // otherwise members are the admin's to change
  return next;
}

function setChats_(body, role) {
  var chats = (body && body.chats) || [], me = body && body.me, rosterId = body && body.rosterId;
  if (!chats.length) return { ok: true, saved: 0 };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var n = 0;
  try {
    var s = ss().getSheetByName(TEAMCHATS_TAB);
    if (!s) { s = ss().insertSheet(TEAMCHATS_TAB); s.getRange(1, 1, 1, 2).setValues([['id', 'json']]); }
    var idMap = rowIndexById(s), appends = [];
    chats.forEach(function (inc) {
      if (!inc || !inc.id) return;
      var id = deformula_(String(inc.id)), row = idMap[id], existing = null;
      if (row) { try { existing = JSON.parse(s.getRange(row, 2).getValue()); } catch (e) {} }
      var toStore = chatAuthorizeWrite_(existing, inc, me, rosterId);
      if (!toStore) return;                                  // unauthorized / rejected — skip
      var js = JSON.stringify(toStore);
      if (row) s.getRange(row, 1, 1, 2).setValues([[id, js]]);
      else appends.push([id, js]);
      n++;
    });
    if (appends.length) s.getRange(s.getLastRow() + 1, 1, appends.length, 2).setValues(appends);
  } finally { lock.releaseLock(); }
  return { ok: true, saved: n };
}
