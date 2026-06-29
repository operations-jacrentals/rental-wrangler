/* ─────────────────────────────────────────────────────────────────────────
 * Backend additions — Wrangler Ops (developer chat bridge)
 * Secret-free; spliced into the gitignored backend/Code.gs and clasp-deployed.
 * See docs/superpowers/specs/2026-06-29-wrangler-ops-developer-chat-bridge-design.md
 *     docs/superpowers/plans/2026-06-29-wrangler-ops-developer-chat-bridge-plan.md
 *
 * Lets the developer (Jac) (1) read EVERY role's Mr. Wrangler chat and
 * (2) jump into a live thread — posting a turn the customer's open dock picks
 * up, while the AI pauses. Builds on the existing per-role rail store
 * (wranglerRails [role, id, json]) from wrangler-rail-sync-backend.gs.
 *
 * GATE: every action below is DEV-ONLY — guarded by devOK_(), which checks a
 * dedicated DEV_PASSWORD Script Property (NOT a role, NOT the team password).
 * Set it once: Apps Script → Project Settings → Script Properties →
 *   DEV_PASSWORD = <a long random string>   (never in the repo, never logged)
 *
 * STORAGE DELTA (additive, schema-less): two fields live INSIDE each chat's
 * json blob — `driver` ('ai' | 'human', default 'ai') and `lastTs` (ms epoch,
 * server-stamped on append). No new columns; the wranglerRails tab is unchanged.
 *
 * CURSOR NOTE: Wrangler messages carry no per-message timestamp, so message
 * delivery uses a COUNT cursor (sinceCount = how many the client already has),
 * not a time cursor. lastTs is chat-level only (sort + liveness).
 *
 * Wire into doPost's action switch (these need NO signed-in role — they carry
 * their own devKey — so place them BEFORE the role-password resolution, or pass
 * body through; they never read `role`):
 *   if (action === 'getWranglerChatsAll')  return json(getWranglerChatsAll_(body));        // dev-only
 *   if (action === 'appendWranglerMessage')return json(appendWranglerMessage_(body));      // dev-only
 *   if (action === 'setWranglerDriver')    return json(setWranglerDriver_(body));          // dev-only
 *   if (action === 'getWranglerChat')      return json(getWranglerChat_(body, role));      // dev OR owning role
 * The three dev-only actions carry their own devKey and ignore `role`.
 * getWranglerChat takes the server-resolved `role` (like getWranglerRail) so a
 * NON-dev caller can only read a chat stored under its OWN role — preserving the
 * rail's per-role customer isolation. Place it AFTER role resolution.
 *
 * Reuses ss()/LockService and WRANGLERRAIL_TAB/wranglerRailSheet_() from the
 * rail-sync additions.
 * ───────────────────────────────────────────────────────────────────────── */

/* ── Dev gate ─────────────────────────────────────────────────────────────
 * True only when body.devKey matches the DEV_PASSWORD Script Property.
 * Never echoes the property; returns a plain boolean. */
function devOK_(body) {
  var want = PropertiesService.getScriptProperties().getProperty('DEV_PASSWORD');
  if (!want) return false;                                  // unset ⇒ feature inert
  var got = body && body.devKey;
  return typeof got === 'string' && got.length > 0 && got === want;
}

/* ── small helpers over the wranglerRails tab ─────────────────────────────── */
// Last-message preview text (content may be a string or a content-block array).
function wrPreview_(messages) {
  if (!messages || !messages.length) return '';
  var c = messages[messages.length - 1].content;
  var t = '';
  if (typeof c === 'string') t = c;
  else if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) { if (c[i] && c[i].type === 'text' && c[i].text) { t = c[i].text; break; } } if (!t) t = '[attachment]'; }
  t = String(t).replace(/\s+/g, ' ').trim();
  return t.length > 90 ? t.slice(0, 90) + '…' : t;
}
function wrLastTs_(chat) {
  return (chat && typeof chat.lastTs === 'number') ? chat.lastTs : ((chat && typeof chat.ts === 'number') ? chat.ts : 0);
}
// Scan column 2 (id) across ALL roles; return {row, role, chat} or null.
function wrFindById_(s, id) {
  var last = s.getLastRow();
  if (last < 2) return null;
  var vals = s.getRange(2, 1, last - 1, 3).getValues();      // role, id, json
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][1]) === String(id)) {
      try { return { row: i + 2, role: String(vals[i][0]), chat: JSON.parse(vals[i][2]) }; }
      catch (e) { return null; }
    }
  }
  return null;
}

/* ── 1) read EVERY role's chats (metadata only — cheap to poll) ───────────── */
function getWranglerChatsAll_(body) {
  if (!devOK_(body)) return { ok: false, error: 'auth' };
  var s = ss().getSheetByName(WRANGLERRAIL_TAB), out = [];
  if (s) {
    var last = s.getLastRow();
    if (last >= 2) {
      var vals = s.getRange(2, 1, last - 1, 3).getValues();    // role, id, json
      for (var i = 0; i < vals.length; i++) {
        try {
          var c = JSON.parse(vals[i][2]);
          if (!c || !c.id) continue;
          var msgs = c.messages || [];
          out.push({
            id: String(c.id),
            role: String(vals[i][0]),
            title: c.title || '',
            lastTs: wrLastTs_(c),
            driver: c.driver === 'human' ? 'human' : 'ai',
            msgCount: msgs.length,
            preview: wrPreview_(msgs)
          });
        } catch (e) {}
      }
    }
  }
  out.sort(function (a, b) { return b.lastTs - a.lastTs; });   // newest activity first
  return { ok: true, chats: out, serverTs: Date.now() };
}

/* ── 2) read one chat's NEW messages (count cursor) + driver ───────────────
 * Dev call (valid devKey) reads ANY chat. A non-dev caller (the customer's own
 * dock) passes no devKey and may read a chat ONLY IF it is stored under that
 * caller's server-resolved role — the same per-role isolation getWranglerRail
 * enforces, so chat ids can't be enumerated across roles. */
function getWranglerChat_(body, role) {
  var dev = devOK_(body);
  var id = body && body.id;
  if (!id) return { ok: false, error: 'no-id' };
  var s = ss().getSheetByName(WRANGLERRAIL_TAB);
  if (!s) return { ok: false, reason: 'gone' };
  var hit = wrFindById_(s, id);
  if (!hit) return { ok: false, reason: 'gone' };
  // ISOLATION: non-dev callers may only read their OWN role's chat.
  if (!dev && String(hit.role) !== String(role)) return { ok: false, error: 'auth' };
  var msgs = (hit.chat.messages || []);
  var since = Math.max(0, parseInt((body && body.sinceCount) || 0, 10) || 0);
  return {
    ok: true,
    messages: since < msgs.length ? msgs.slice(since) : [],
    total: msgs.length,
    driver: hit.chat.driver === 'human' ? 'human' : 'ai',
    lastTs: wrLastTs_(hit.chat),
    _dev: dev ? 1 : 0                                          // harmless; lets the inbox confirm its gate
  };
}

/* ── 3) developer posts a turn → take the wheel (driver='human') ──────────── */
function appendWranglerMessage_(body) {
  if (!devOK_(body)) return { ok: false, error: 'auth' };
  var id = body && body.chatId, msg = body && body.message;
  if (!id || !msg) return { ok: false, error: 'bad-input' };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var s = wranglerRailSheet_();
    var hit = wrFindById_(s, id);
    if (!hit) return { ok: false, reason: 'gone' };           // janitor pruned it
    var c = hit.chat;
    if (!c.messages) c.messages = [];
    // Persist the human turn as a plain assistant turn (coherent if the AI later
    // resumes); keep dev/author for the audit trail (UI hides them — seamless).
    c.messages.push({ role: 'assistant', content: String(msg.content || ''), dev: true, author: String(msg.author || 'Jac') });
    c.driver = 'human';
    c.lastTs = Date.now();
    s.getRange(hit.row, 1, 1, 3).setValues([[hit.role, String(id), JSON.stringify(c)]]);
    return { ok: true, lastTs: c.lastTs, total: c.messages.length };
  } finally { lock.releaseLock(); }
}

/* ── PATCH to setWranglerRail_ (lives in wrangler-rail-sync-backend.gs) ──────
 * THE single-writer guarantee, enforced server-side. A customer's normal rail
 * sync (setWranglerRail) does a whole-row REPLACE. While the developer has taken
 * over a chat (stored driver==='human'), that replace must NOT overwrite the row,
 * or a mistimed customer push could wipe an injected dev turn / the driver flag.
 * Guarding it on the SERVER closes the race no matter what the client's poll or
 * debounce timing is — the client guard is then just an optimization.
 *
 * In setWranglerRail_'s upsert loop, replace the in-place write:
 *     if (rowOf[id]) s.getRange(rowOf[id], 1, 1, 3).setValues([[String(role), id, js]]);
 * with the guarded version:
 *     if (rowOf[id]) {
 *       var storedHuman = false;
 *       try { storedHuman = JSON.parse(s.getRange(rowOf[id], 3).getValue()).driver === 'human'; } catch (e) {}
 *       if (!storedHuman) s.getRange(rowOf[id], 1, 1, 3).setValues([[String(role), id, js]]);
 *       // else: developer owns this chat right now — leave the dev-augmented row intact.
 *     }
 * (The deletion pass is unchanged: a human-driven chat is still in the client's
 * payload, so `keep[id]` is set and it is never selected for deletion.)
 * ───────────────────────────────────────────────────────────────────────── */

/* ── 4) hand the wheel back (or take it) explicitly ───────────────────────── */
function setWranglerDriver_(body) {
  if (!devOK_(body)) return { ok: false, error: 'auth' };
  var id = body && body.chatId, driver = (body && body.driver) === 'human' ? 'human' : 'ai';
  if (!id) return { ok: false, error: 'bad-input' };
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var s = wranglerRailSheet_();
    var hit = wrFindById_(s, id);
    if (!hit) return { ok: false, reason: 'gone' };
    var c = hit.chat;
    c.driver = driver;
    c.lastTs = Date.now();
    s.getRange(hit.row, 1, 1, 3).setValues([[hit.role, String(id), JSON.stringify(c)]]);
    return { ok: true, driver: driver };
  } finally { lock.releaseLock(); }
}
