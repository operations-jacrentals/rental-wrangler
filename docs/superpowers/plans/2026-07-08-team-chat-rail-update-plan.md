# Team chat in the new comms rail — implementation plan

**Spec:** `docs/superpowers/specs/2026-07-08-team-chat-rail-update-design.md`
**Date:** 2026-07-08
**Base branch:** MUST be cut from `comms-notifications/dock-threads` (the v3 rail). See Phase 0.

This plan is staged so each phase is independently testable at the area level
(`localhost:9147`, log in with `$RW_PW`, exercise the feature). Phases are ordered
so nothing renders against data that doesn't exist yet.

---

## Phase 0 — Base the branch on the v3 rail (blocker)

The feature depends on `state.commsRail`, `commsRailEl`, `commsSessTabsHtml`,
`commsFreshSessions`, `chatShow()` — present only on `comms-notifications/dock-threads`,
not `main`.

- [ ] Confirm the landing base: either (a) `dock-threads` is merged to
  `area/comms-notifications` (preferred — cut the task branch off the area), or
  (b) if not yet, rebase `claude/internal-chat-updates-vq6p7b` directly onto
  `origin/comms-notifications/dock-threads`.
- [ ] Verify the rail is live locally: Team chip summons a session; tabs pop; status dots render.

**Acceptance:** the app boots on the base branch with the v3 four-chip rail working.

## Phase 1 — Team-members roster (backend + Settings UI)

- [ ] **Backend (additive, `/clasp`):** persist `settings.teamRoster = [{id,name,role}]`
  in the config `settings` blob (mirror `roleMeta`; no `Code.gs` schema change). Confirm
  it round-trips and syncs to every device on load.
- [ ] **Settings → Team members panel:** add / rename / remove a person; assign each a
  role (existing `ROLES` id). `data-r` stamps; `/jactec-ui` for the panel; new
  `WINDOW_CATALOG` entry; `ci/check-window-catalog.mjs`.
- [ ] Read path: a `teamRoster()` accessor + `rosterPerson(id)` lookup.

**Acceptance:** admin adds/edits people in Settings; the list persists and syncs.

## Phase 2 — Chat data model + migration

- [ ] Evolve chat shape → `{ id, title, members:[personId], messages:[{id,by,at,text,refs?}], seen }`.
  Drop `tags`; `participants` retired.
- [ ] **Migration** for existing `state.chat.chats`: synthesize `title` from the first
  tag label (else "Team chat"), set `members = []` with **open visibility** until curated,
  convert any tag into a rendered chip where referenced. Non-destructive to messages.
- [ ] Update `newChat`, `openChat`, `chatFeed`, sync (`pushChatsSoon`) for the new shape.

**Acceptance:** legacy chats still open and show their history; new fields present.

## Phase 3 — "+ New chat" sheet

- [ ] New popup: **Title** field (Saira label, orange focus) + **member picker**
  (roster grouped under role headings, tap-to-add, **default none**) + **Start chat**.
- [ ] Creating pushes a chat and lands it as the open Team tab.
- [ ] `data-r` stamps; `/jactec-ui`; `WINDOW_CATALOG` entry; touch-first (Phase 9).

**Acceptance:** create a titled chat with chosen members; it appears as a Team tab.

## Phase 4 — Member rail (replaces role toggles)

- [ ] Recast `chatRoleBarHtml` → a **member rail**: chat's roster people grouped by role,
  default none, add/remove in place. Same visual family, new semantics.
- [ ] Visibility: a user sees a chat iff they're in `members` (see Phase 8).

**Acceptance:** editing members adds/removes the chat from those users' rails.

## Phase 5 — Copy an element → paste a live chip

- [ ] `state.held = { card, recId, label }` (single slot, not persisted).
- [ ] **Copy** affordance on elements (records, line items, pills, prices) — context-menu
  item and/or inline control — sets `state.held`.
- [ ] **Paste** in an internal chat compose surfaces the held chip; send writes `refs`
  onto the message and clears `state.held`.
- [ ] **Chip render** (below message text): **live pointer** to the record; clicking opens
  it via the existing `data-chat-open="card|recId"` path (reused from flagged rows);
  deleted record → greyed "no longer available."
- [ ] **Scope:** internal only (Team + Mr. Wrangler). In Texts/Email, paste inserts the
  element's **plain text** instead.
- [ ] `data-r` stamps; `/jactec-ui` for Copy control + chip.

**Acceptance:** copy a rental, paste into a team chat, another member clicks the chip and lands on the rental.

## Phase 6 — Retire the right-click seed

- [ ] Remove `startChatFromEl` (act `startchat`), the R20 `🧵 Start chat` menu item, and
  `chatStartFromDrop` / drag-to-corner new-chat. Fold `🤠 Ask Mr. Wrangler about X` into copy/paste.
- [ ] Sweep for dead references (menu, drop targets, tips).

**Acceptance:** no right-click "start a chat about this record" path remains; nothing dangling.

## Phase 7 — Status grammar on Team tabs

- [ ] Per-chat status: **red** = messages from others newer than `seen`; **yellow** = seen
  but latest isn't mine; **green** = I sent latest / all seen. Feed the tab + the toolbar
  Team chip's worst-status dot.

**Acceptance:** dots match the mock's red/yellow/green semantics through a send/receive cycle.

## Phase 8 — Identity ↔ roster binding

- [ ] Resolve `currentUser` (login name) to a roster person id; membership + unread key off
  that id. Unmatched login → in no chats until added (consistent with default-none).
- [ ] Decide the bind rule (exact-name match vs. login picks a roster person) — smallest
  change that's unambiguous.

**Acceptance:** signing in as a rostered person shows exactly their chats.

## Phase 9 — Phone

- [ ] `+ New chat` sheet, member picker, and copy/paste all work touch-first; keep the
  bottom-sheet dock (D9 `chatShow` phone branch). `/jactec-ui` mobile pass.

**Acceptance:** full flow works on a phone viewport.

## Phase 10 — Gates & ship

- [ ] `/jactec-ui` self-critique screenshot pass on every new surface.
- [ ] `node ci/gen-rule-usage.mjs` (regen), `node ci/check-window-catalog.mjs`,
  `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`,
  `node tools/gen-code-map.mjs` (regen the reshaped `APP-23` chapter).
- [ ] `/role` audit on roster + membership visibility (low-risk, still worth it).
- [ ] Cache-bust `?v=` on `style.css` / `rule-usage.js` / `app.js` in `index.html`.
- [ ] Backend roster deploy via `/clasp` (additive; STOP-gate before prod).

**Acceptance:** all gates green; feature exercised end-to-end at the area level.

---

## Deferred (not in this plan)

- **Flagged-comments feed** fate (Notifications / landing / drop) — revisit with Jac.
- Legacy migration finer points (Phase 2) — confirm the open-visibility default is acceptable.
