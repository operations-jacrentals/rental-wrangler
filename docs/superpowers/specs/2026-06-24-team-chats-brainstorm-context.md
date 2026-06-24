# Team chats — brainstorm context (PARKED, WIP — not an approved spec)

**Status:** parked 2026-06-24 mid-scoping, to resume tomorrow via `/brainstorming`.
**Area:** `area/comms-notifications` · task branch `comms-notifications/team-chat-design`.
**This is NOT an approved design** — the brainstorming gate is incomplete. Do not
implement from this file. Resume the `/brainstorming` flow, finish scoping, present a
design, get Jac's approval, write the real spec, then `/writing-plans`.

## Jac's ask (verbatim intent)
"We don't have a spot for team chats. That will be a big feature for us. Will it fit
under the card toggle? Even if the user has to pull the screen up a little?"

Placement idea floated: a collapsed **team-chat bar under the card toggle** in the
mobile dock that **pulls up into a sheet** — costs ~one row at rest, full thread on
pull-up, leaves the 3-column yard grid untouched.

## KEY FINDING — a team-chat system already exists (don't build greenfield)
Explored the code (§17, "Phase 7"). Team chats are already implemented:

- **State:** `state.chat = { open, activeId, draft, chats: [] }` (app.js ~1606).
  Each chat = `{ id, tags, participants, messages, seen{ userKey: lastViewedAt } }`.
  PERSISTENT (never deleted); empty `participants` = dormant, reopened via a tagged element.
- **Creation:** `startChatFromEl(el)` / `chatStartFromDrop(p)` — a chat is **seeded from
  a record** (tag/drag a pill/row/person into it). `chatAddTag(tag)` adds record context.
- **Surface:** the **comms-rail** (bottom-right strip) renders team-chat tabs alongside
  Mr. Wrangler chats (`commsRailEl`, `data-team-open`). Compose: "Message the team…".
- **Unread/read state:** `chatUnreadCount()` + the per-user `seen{}` map; chat toggle
  button carries a badge (`js-chat-toggle`).
- **Persistence + sync:** IndexedDB store `chats` (wrTx/putChat/listChats); cross-device
  **team-chat sync** shipped in #183 ("Cross-device Mr. Wrangler rail + lit-up team-chat sync").

So the plumbing (threads, participants, messages, read state, sync, persistence) largely
EXISTS. The gap is almost certainly **placement/discoverability — especially on mobile**
(the comms-rail is a desktop bottom-right strip; phones have no real home for it).

## Open scoping question (answer FIRST tomorrow)
What's the actual gap?
1. **Mobile home/placement** — give the existing chats a real spot under the card toggle
   (pull-up sheet on phones). Mostly placement + access on top of what exists. ← most likely
2. **Discoverability** — it exists but is too buried even on desktop; needs a clearer
   always-there entry point.
3. **Different chat model** — replace record-seeded threads with a plain always-on team
   channel (group chat) not tied to records. Bigger rethink.
(Jac parked before answering — start here.)

## Questions still to resolve in the design
- Thread model: keep record-seeded threads, add a general channel, or both?
- Who's in a thread (participants) — all team, or per-thread roster? Role visibility?
- **Customer-data isolation** — tagged record context must respect customer isolation /
  margin-PII rules (a chat must not leak data a participant's role can't see). Security gate.
- Notifications — in-app badge only, or tie into `area/comms-notifications` push/alerts?
- Read state across devices (already has `seen{}` + sync — confirm it's enough).
- Mobile placement spec: the under-toggle bar + pull-up sheet (run through `/jactec-ui`
  + `/frontend`; mobile-* skills for the sheet/gesture).

## Relevant code anchors
- `app.js`: `state.chat` (~1606), `startChatFromEl` / `startchat` act (~3525),
  `commsRailEl` + team tabs (~6698), `chatById`/`chatsTagging` (~6771),
  `ensureChat`/compose (~6784, 6826), IndexedDB `chats` store (~6930–6953),
  `chatAddTag`/`chatStartFromDrop` (~7188–7203), mobile dock (`mobileDockEl` ~6740).
- `style.css`: `.comms-rail` / `.crail-*`, `.chat-*`, `.mobile-dock` / `.mdock-*`.
