/* ─────────────────────────────────────────────────────────────────────────
 * Backend additions — Wrangler Ops (developer live-chat bridge)
 * Secret-free; spliced into the gitignored backend/Code.gs and clasp-deployed.
 * See docs/superpowers/specs/2026-07-09-wrangler-ops-chat-bridge-design.md — a
 * from-spec RE-IMPLEMENTATION (against current staging) of the stale branch
 * claude/mirror-wrangler-chats-l8pjfd's design (docs/superpowers/specs/
 * 2026-06-29-wrangler-ops-developer-chat-bridge-design.md), adapted to the
 * role-tier system that landed AFTER that branch forked (2026-06-26 redesign,
 * see docs/handoffs/role-tiers-backend.gs).
 *
 * WHAT CHANGED FROM THE STALE BRANCH'S DESIGN: the original spec invented a
 * dedicated `DEV_PASSWORD` Script Property + a `devKey` the client had to type
 * into a gate field. That predates the role-tier system. Today the app already
 * has a "Developer" role/tier (config.js ROLE_TIERS, rank 5 — the SAME gate
 * that unlocks Design Lint/Inspector/Rulebook client-side, app.js devUnlocked()).
 * So these actions reuse the EXISTING role-password auth instead of a second
 * secret: every backendCall already sends `password` (see backendCall in
 * app.js) — resolve its role via the same `roleForPassword` helper the rail
 * sync already uses, then require tier >= developer via `roleTierRank_`
 * (docs/handoffs/role-tiers-backend.gs). One less secret to provision/rotate.
 *
 * Lets a Developer-tier operator (1) read EVERY role's Mr. Wrangler chat and
 * (2) jump into a live thread — posting a turn the customer's open dock picks
 * up (within one ~7s poll), while the AI pauses. Builds on the EXISTING
 * per-role rail store (wranglerRails [role, id, json]) from
 * wrangler-rail-sync-backend.gs — same tab, same JSON-blob-per-row shape.
 *
 * STORAGE DELTA: NONE. `driver` ('ai'|'human', default 'ai') and `lastTs` (ms
 * epoch) already round-trip for free INSIDE each chat's existing json blob —
 * the frontend's wranglerRailSnapshot() now includes them on every snapshot,
 * and they ride through the UNCHANGED getWranglerRail_/setWranglerRail_. This
 * splice only adds the four actions below; it does not touch those two.
 *
 * CURSOR NOTE: Wrangler messages carry no per-message timestamp, so message
 * delivery uses a COUNT cursor (sinceCount = how many the client already has),
 * not a time cursor. lastTs is chat-level only (sort + "live" dot).
 *
 * Wire into doPost's action switch, next to getWranglerRail/setWranglerRail
 * (all four take the server-resolved `role`, exactly like getWranglerRail —
 * no separate secret param on the wire):
 *   if (action === 'getWranglerChatsAll')  return json(getWranglerChatsAll_(body, role));
 *   if (action === 'getWranglerChat')      return json(getWranglerChat_(body, role));       // dev OR the chat's own role
 *   if (action === 'appendWranglerMessage')return json(appendWranglerMessage_(body, role));
 *   if (action === 'setWranglerDriver')    return json(setWranglerDriver_(body, role));
 *
 * Reuses ss()/LockService/roleForPassword/roleTierRank_/ROLE_TIER_RANK and
 * WRANGLERRAIL_TAB/wranglerRailSheet_() from the rail-sync + role-tier splices.
 * ───────────────────────────────────────────────────────────────────────── */

/* ── Dev gate — tier >= developer, resolved from the SAME password every
 * backendCall already sends (no second secret). ── */
function wrOpsDevOK_(role) { return roleTierRank_(role) >= ROLE_TIER_RANK.developer; }

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
function getWranglerChatsAll_(body, role) {
  if (!wrOpsDevOK_(role)) return { ok: false, error: 'auth' };
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
 * A Developer-tier caller reads ANY chat. A non-dev caller (the customer's own
 * dock poller) may read a chat ONLY IF it is stored under that caller's OWN
 * server-resolved role — the same per-role isolation getWranglerRail_
 * enforces, so chat ids can't be enumerated across roles. */
function getWranglerChat_(body, role) {
  var dev = wrOpsDevOK_(role);
  var id = body && body.id;
  if (!id) return { ok: false, error: 'no-id' };
  var s = ss().getSheetByName(WRANGLERRAIL_TAB);
  if (!s) return { ok: false, reason: 'gone' };
  var hit = wrFindById_(s, id);
  if (!hit) return { ok: false, reason: 'gone' };
  if (!dev && String(hit.role) !== String(role)) return { ok: false, error: 'auth' };   // ISOLATION
  var msgs = (hit.chat.messages || []);
  var since = Math.max(0, parseInt((body && body.sinceCount) || 0, 10) || 0);
  return {
    ok: true,
    messages: since < msgs.length ? msgs.slice(since) : [],
    total: msgs.length,
    driver: hit.chat.driver === 'human' ? 'human' : 'ai',
    lastTs: wrLastTs_(hit.chat)
  };
}

/* ── 3) developer posts a turn → take the wheel (driver='human') ──────────── */
function appendWranglerMessage_(body, role) {
  if (!wrOpsDevOK_(role)) return { ok: false, error: 'auth' };
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
    // resumes); dev/author ride along for the audit trail (customer UI hides them).
    c.messages.push({ role: 'assistant', content: String(msg.content || ''), dev: true, author: String(msg.author || 'Developer') });
    c.driver = 'human';
    c.lastTs = Date.now();
    s.getRange(hit.row, 1, 1, 3).setValues([[hit.role, String(id), JSON.stringify(c)]]);
    return { ok: true, lastTs: c.lastTs, total: c.messages.length };
  } finally { lock.releaseLock(); }
}

/* ── 4) hand the wheel back (or take it) explicitly ───────────────────────── */
function setWranglerDriver_(body, role) {
  if (!wrOpsDevOK_(role)) return { ok: false, error: 'auth' };
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
