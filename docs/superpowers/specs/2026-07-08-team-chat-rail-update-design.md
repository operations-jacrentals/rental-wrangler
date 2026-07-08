# Team chat in the new comms rail — design

**Date:** 2026-07-08
**Area:** `comms-notifications` (rides on the v3 comms rail; touches `design-system` + a `backend-data` config field)
**Status:** Approved design — ready for implementation plan
**Depends on:** the **v3 comms rail** ("D9"), currently only on `comms-notifications/dock-threads` (NOT on `main`). See *Dependencies & branch base*.

---

## 1. Why

The comms rail was redesigned (v3 / "D9") so all four conversation categories — **Team · Texts · Email · Mr. Wrangler** — share one engine: a bottom-left toolbar chip summons that category's *last session* onto the rail, tabs pop Messenger-style above themselves, and status reads red / yellow / green (unseen / reply? / replied). Texts and Email map cleanly onto this (one thread per customer). **Team** does not: the old §17 Internal Team Dock (`APP-23`) is a *different* mental model — one active chat at a time, auto-including every role, built around a **flagged-comments feed**, a **tagged-element context rail**, and **role-participant toggles**, with threads spun up by right-clicking a record.

D9 already *bridged* the old team chat onto the rail (`chatShow()` lands the active chat as the Team category's single window; phones keep the bottom-sheet dock). This spec updates the **team chat itself** to be a first-class citizen of the new world.

## 2. What changes (summary)

1. **Many titled chats.** Team is no longer one running conversation — users create as many named chats as they want, each its own Team tab.
2. **Members are named people**, chosen from a **new explicit "Team members" roster in Settings**. Default: **no one** until added.
3. **Copy → paste element chips** replaces the right-click "start a chat about this record." Any element can be copied and pasted into a conversation as a **live, clickable chip** every member can follow.
4. **Status grammar** (red/yellow/green) applies to Team tabs, same as the other categories.
5. **Flagged-comments feed — deferred.** Left as-is this pass; its fate (move to Notifications / keep as landing / drop) is revisited later.

Non-goals this pass: reworking Texts/Email/Wrangler categories; changing the login/role/tier system; the flagged-feed decision.

---

## 3. The pieces

### 3.1 Titled, member-scoped chats

**Chat shape** (evolves `state.chat.chats[]`, today `{ id, tags, participants, messages, seen }`):

```
{ id, title, members: [personId], messages: [ { id, by, at, text, refs? } ], seen: { userKey: at } }
```

- `title` — user-typed, editable (Rename ✎ on the chat header).
- `members` — array of **roster-person ids** (§3.2), not role ids. Default `[]` (no one).
- `tags` is **retired** for team chat (the tagged-element rail goes away — replaced by pasted chips, §3.3).
- `refs?` on a message — the pasted element chips (§3.3).

**Creating a chat — the "+ New chat" sheet** (a new popup → `WINDOW_CATALOG` entry):
- A **Title** field (Saira-stamped label, orange focus ring).
- A **member picker** — the roster (§3.2), people grouped under their role heading (honors the "rail of roles" instinct while selecting individuals). Tap to add; **none selected by default**.
- **Start chat** (ignition-orange). Creates the chat, drops it onto the Team rail as the open tab.

**Ownership (creator = admin).** The person who creates a chat owns it (stored as `by`). **Only the admin adds/removes members or renames**; everyone else sees a read-only member list. **Members default to none** — being admin already grants the creator visibility + control, so `members` starts empty. A member can **voluntarily leave** (removes their own roster id), which drops the chat off their rail. Non-admins cannot add themselves or anyone else.

**Membership & visibility (shipped).** Identity binds the free-text login name (`currentUser`) to a roster person by **case-insensitive name match** (`myRosterId()`). A team chat is visible to its **admin + members**; a bound non-member does not see it (so *Leave* actually hides it). An **unbound login** (name not on the roster, e.g. demo) sees all as a safe fallback so the rail is never mysteriously empty. `commentUserKey()` (= `currentUser || currentRole || 'me'`) remains the message-author / seen key.

**Server-side privacy (client shipped, backend staged).** Client-side filtering alone isn't a boundary — the sync shipped every chat to every client. The client now sends its identity (`me`/`rosterId`) with `getChats`/`setChats` and prunes scoped-out chats live (`reconcileScopedChats`). The backend counterpart (`docs/handoffs/team-chat-privacy-backend.gs`) scopes reads to admin+members and authorizes writes (a non-member can only self-leave, never inject/tamper); it's **back-compatible** (absent `me` = old client → prior behavior) and **STOP-gated** for a Jac-confirmed `/clasp` editor deploy. Identity is client-asserted behind the team password — a real filter, not a crypto boundary; true per-person privacy would need per-user auth.

**Gear settings menu.** Classic chat controls live behind a gear (`I.sliders`) in the window header: **Mark as read** and **Mute notifications** (per-user; a muted chat never raises its status dot) for everyone; **Rename** + **End chat** for the admin; **Leave chat** for a member.

**Status per Team tab** (mirrors the Texts/Email session status the rail already computes):
- **red — unseen:** messages from others newer than this user's `seen`.
- **yellow — reply?:** seen, but the latest message isn't from this user (their turn).
- **green — replied:** this user sent the latest message, or all seen and no reply owed.

The toolbar Team chip shows the **worst** status across the user's chats (red > yellow > green), matching the mock.

### 3.2 The Team-members roster (Settings)

New **Settings → Team members** panel (admin-editable), stored in the backend **config `settings` blob** — the same mechanism as `roleMeta` (Phase-4 role seeding), so it syncs to every signed-in device on load and needs **no `Code.gs` schema change** (additive; ships via `/clasp`).

```
settings.teamRoster = [ { id, name, role } ]   // role = one of the existing ROLES ids
```

- Add / rename / remove a person; assign each a role (drives the grouping in the member picker).
- Not sensitive: names + roles only, **no passwords, no customer PII** — safe in the synced config.
- The picker in §3.1 reads `settings.teamRoster`.

### 3.3 Copy an element → paste a chip

**Retire:** the R20 context-menu items `🧵 Start chat` (`startChatFromEl`, act `startchat`) and the drag-to-corner `chatStartFromDrop` / "new chat from dropped element" path — the whole "thread anchored to one originating element" model. (`🤠 Ask Mr. Wrangler` about X is also folded into copy/paste — see scope below.)

**Add — Copy:** every element that can carry context today (records, line items, pills, prices — the set the old tag rail accepted) gets a **Copy** affordance (context menu item and/or inline control). Copy sets a single in-app **held item**:

```
state.held = { card, recId, label }   // one at a time; NOT persisted (lost on refresh)
```

**Paste:** in an **internal** conversation's compose (Team or Mr. Wrangler), the held item surfaces as a paste-ready chip; sending the message attaches it and clears `state.held`. A message's `refs` renders each chip **below the text**.

**The chip** is a **live pointer**: it always reflects the record's current state, and clicking it opens that record for **any member** (reuse the existing `data-chat-open="card|recId"` open path already used by flagged rows in `chatFeedRowsHtml`). If the record is later deleted, the chip **greys out** to "no longer available."

**Scope — internal only.** Element chips paste into **Team + Mr. Wrangler** only (both are in-app, every reader can click through). In **Texts / Email** to a customer, a paste instead inserts the element's **plain text** (e.g. the quote number) — a customer can't click into our app.

### 3.4 Role rail → member rail

The old `chatRoleBarHtml` (role-participant toggles, everyone-in-by-default) becomes a **member rail**: it shows the chat's roster people (grouped by role), default none, editable in place. Same visual family (stamped role-tinted chips), new semantics (people, opt-in).

### 3.5 Platforms

- **Desktop:** the rail window (inherited from D9 `chatShow()`), now rendering a titled, member-scoped chat with pasted chips.
- **Phones:** keep the bottom-sheet dock; the **+ New chat** sheet, member picker, and copy/paste must all work touch-first (runs through `/jactec-ui` mobile).

---

## 4. Data flow

1. **Roster:** admin edits `settings.teamRoster` in Settings → saved to backend config → syncs to all devices on load.
2. **Create chat:** user opens **+ New chat**, titles it, picks members from the roster → new `{id,title,members,messages:[],seen}` pushed to `state.chat.chats` → `pushChatsSoon()` syncs (existing team-chat sync path) → appears as a Team tab for each member.
3. **Copy/paste:** Copy sets `state.held`; paste-on-send writes `refs` onto the message; chip renders live and is clickable by all members.
4. **Status:** per-tab red/yellow/green derived from `messages` vs the user's `seen`, feeding both the tab and the toolbar chip.

---

## 5. Enforcement / gates (jactec-ui + CI)

- **`/jactec-ui`** governs every new surface: Copy control, element chip, member rail, **+ New chat** sheet, Settings → Team members. Data-plate language: steel, ONE orange (send / active tab / Start chat), hazard cap on the popup, saddle-stitch tan on paste chips, status dots carry registry meaning.
- **R-rulebook:** stamp all new UI with `data-r="Rxx"`; regenerate `rule-usage.js` (`node ci/gen-rule-usage.mjs`).
- **`WINDOW_CATALOG`:** add the **+ New chat** sheet and the Settings → Team members panel (`ci/check-window-catalog.mjs`).
- **Code Atlas:** `APP-23 · §17` chapter banner is reshaped; regenerate the map (`node tools/gen-code-map.mjs`).
- **Security/authority:** roster holds no secrets/PII; internal-only paste prevents leaking clickable app chips to customers; no money/role-gate surface touched. Low-risk, but worth one `/role`-audit pass on the roster + membership visibility before build.

## 6. Dependencies & branch base

- **Must build on the v3 rail.** All of the above assumes `state.commsRail`, `commsRailEl`, `commsSessTabsHtml`, `commsFreshSessions`, and `chatShow()` — which exist **only on `comms-notifications/dock-threads`**, not `main`. The implementation branch must be based on that work (rebase the designated branch onto `dock-threads`, or wait until it merges to `area/comms-notifications` → `staging` and base there). Building on `main` would conflict wholesale.
- **Backend:** the roster is an additive `settings` config field — ships via `/clasp` (additive only), no schema change.

## 7. Open / deferred

- **Flagged-comments feed** — deferred by decision. Revisit: move to Notifications (it's really alerts, not chat), keep as a Team landing view, or drop.
- **Mr. Wrangler paste** — shipped as a record *focus* (feeds `wranglerContext`), not a clickable chip, since the AI can't click. Team paste = clickable chip; Wrangler paste = focus. Both internal-only.
- ~~**Login ↔ roster binding**~~ — RESOLVED: bind by case-insensitive name match (`myRosterId`); unbound logins see all as a fallback.
- **Texts/Email plain-text paste** — a copied element pasting its *text* into a customer text/email is not yet wired (held chips simply don't surface in customer composers, so nothing leaks). Low priority.

## 8. Legacy migration (shipped)

Existing `state.chat.chats` carried role `participants` + `tags`, not `title`/`members`. `normalizeTeamChat()` runs on load + sync: it synthesizes a `title` from the old first-tag label (else "Untitled chat"), ensures a `members` array, and leaves legacy `tags` as harmless passthrough (a legacy chat with no `by` stays openly editable for back-compat). The sync layer (`normalizeChat`/`mergeChats`) preserves + unions `title`, `members`, and `muted`.

## 9. Code anchors (for the plan)

- Team chat / §17: `newChat`, `openChat`, `chatShow`, `chatFeed`, `chatFeedRowsHtml`, `chatRoleBarHtml`, `chatDockEl`, `chatComments`, `chatUnreadCount` (`APP-23`, ~`app.js:8100+` on `dock-threads`).
- Rail engine: `commsRailEl`, `commsSessTabsHtml`, `state.commsRail`, `COMMS_CATS`, `loadCommsRail`/`saveCommsRail`, `commsFreshSessions`.
- Retire: `startChatFromEl` (act `startchat`), `chatStartFromDrop`, the R20 `🧵 Start chat` menu item.
- Identity: `currentUser`, `currentRole`, `commentUserKey`; roster mechanism mirrors `settings.roleMeta` (see `docs/handoffs/role-system-phase4-seeding.md`).
