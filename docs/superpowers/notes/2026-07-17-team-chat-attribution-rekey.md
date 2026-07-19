# [Parked] Team-chat / record-comment attribution re-key → personId

**Parked:** 2026-07-17, at the close of the cross-device-user-sync ship (PRs #692 + #702).
**Origin:** deferred item from spec `docs/superpowers/specs/2026-07-17-cross-device-user-sync-design.md` §13.
**Status:** design note only — no code. This branch is a discoverable tracker; do not merge it.

## What it is

Cross-device user sync (shipped live, `userSync` ON) re-keyed the *storage* of prefs, group-order,
and the Wrangler rail from role → `personId`. Spec §4.2 also called for re-keying **team-chat and
record-comment attribution** — `commentUserKey()` / `chatSyncIdentity()` from the free-text
`currentUser`/`currentRole` to `personId`. That piece was **deliberately NOT shipped** (spec §13),
because it is not the leak fix and, done naively, it silently breaks existing data.

**It is NOT the cross-person leak fix.** The role-shared Mr. Wrangler AI-history leak is fixed by the
`getWranglerRail`/`setWranglerRail` re-key (server-side, already live), which does not touch
`commentUserKey`. So this is a robustness/attribution improvement, not a security gate — no urgency.

## Why it can't just flip (the three real regressions, verified against the LIVE backend)

1. **Creator visibility break.** `chatCanSee_` (live `Code.gs`, from `team-chat-privacy-backend.gs`)
   grants visibility on `String(c.by) === String(me)` **or** roster-membership, and `newChat()`
   deliberately leaves the creator OUT of `members` ("creator = admin via `by`, members start empty").
   Every pre-cutover chat's `by` is the old free-text key (a name/role). Flip `commentUserKey` →
   `personId` and `me` no longer matches `by` → **every existing chat vanishes for its own creator**
   (invisible AND unwritable, since `chatAuthorizeWrite_` uses the same owner check).
2. **Raw-id display.** The comms rail renders `last.by` **raw** (`app.js`, the team/SMS row label:
   `last.by === commentUserKey() ? 'you' : (last.by || 'them')`). New messages attributed to a
   `personId` would show a raw id (e.g. `E123`) instead of the person's name — for new content too,
   not just old.
3. **`seen`/`ack` discontinuity.** `seen{userKey:at}` and comment `ack[]` are keyed by the old
   `commentUserKey`. A switch makes a user's prior seen/ack entries not match → a one-time
   unread-count bump.

## What a correct implementation needs

- **Backward-compat visibility ALIAS.** `chatSyncIdentity()` sends the legacy identity alongside
  `personId`; `chatCanSee_` / `chatAuthorizeWrite_` (team-chat backend, additive) accept a match on
  EITHER the token-derived `personId` OR the legacy alias. Old clients that send only `me` keep working.
- **Lazy `by` migration.** When a chat is loaded and matched via the legacy alias, rewrite `c.by` →
  `personId` and push it up (the owner path must accept the alias so the migrating write succeeds).
  Over time all chats become person-keyed.
- **`personId → name` DISPLAY lookup** at every render site of `by`/`me` — comms rail row labels,
  team-chat message authors, record-comment authors, seen indicators. A `displayNameFor(key)` that
  maps a roster `personId` to its name and falls back to the raw key (for legacy name keys).
- **`seen` migration** (or tolerance) so unread counts don't spike once.

## Scope / risk

Touches a **security-sensitive shared-chat auth handler** (`chatCanSee_`/`chatAuthorizeWrite_`) plus a
**broad display surface**. It deserves its own spec + `/role` audit + adversarial review, and its own
backend `/clasp` deploy. Do NOT bolt it onto an unrelated change.

## Pointers

- Spec: `docs/superpowers/specs/2026-07-17-cross-device-user-sync-design.md` §13
- Backend auth: `docs/handoffs/team-chat-privacy-backend.gs` (`chatCanSee_`, `chatAuthorizeWrite_`, `getChats_`)
- Client: `commentUserKey` / `chatSyncIdentity` / `newChat` / the comms-rail row label in `app.js`
