# Cross-device Mr. Wrangler rail — server sync

**Date:** 2026-06-20
**Status:** Approved (design) — ready for implementation plan
**Surfaces:** the Wrangler rail (`state.wranglerRail`, `wranglerRailLoad`/
`wranglerRailPersist`, `wrOffloadChatImages`) — frontend; new
`getWranglerRail`/`setWranglerRail` actions — backend `Code.gs` (deployed via
clasp, same deployment id).

## Summary

The Mr. Wrangler AI rail is **device-local** (IndexedDB, #181). This makes a
user's chats **follow their login across devices**, mirroring the proven
team-chat sync. Local IndexedDB stays the device cache + offline buffer; the
backend becomes the cross-device source of truth. Images ride **Drive URLs**
(#181/#182), so they appear on every device.

## Decisions (locked 2026-06-20)

| Question | Decision |
|---|---|
| Identity key | **By role login** (server-derived from the password; a client reads/writes only its own rail). Roles map ~1:1 to people in the JacRentals roster. |
| Images on sync | **Full fidelity** — offload a chat's blobs to Drive *before* it pushes, so images appear on every device |
| Merge grain | **Whole-chat last-writer-wins**, union by `chatId` (Wrangler messages have no stable ids → per-message merge isn't possible) |
| Local store | IndexedDB (#181) stays the **device cache / offline buffer**; backend is the **cross-device source of truth** |
| Backend storage | A `wranglerRails` Sheet tab, **one row per chat**: `[roleKey, chatId, json]` (each row well under the 50k-char cell cap) |
| Deploy | Claude builds **and** clasp-deploys `Code.gs` to the **same deployment id** (frontend URL unchanged), throwaway-row tested first |

## Scope / non-goals

- **Per-role**, not per-typed-name. Shared-role privacy is acceptable (roster is
  1:1). Not building per-user-within-a-role separation.
- Not changing team chat, the live-chat request shape, or the wrangler-issue flow.
- Not real-time push (no websockets) — sync rides the existing boot + refresh
  poll + debounced push, exactly like team chat.
- No per-message conflict resolution (whole-chat grain, by design).

## Architecture

### A · Backend — `Code.gs` (built + clasp-deployed)

Mirror the team-chat (`getChats`/`setChats`) + entity-sheet conventions.

- **Storage:** a `wranglerRails` tab, rows `[roleKey, chatId, json]`. One row per
  chat keeps every cell well under the 50k cap; a heavy rail is many rows.
- **`getWranglerRail_(body, role)`** → `{ ok, chats: [...] }` — every row whose
  `roleKey === role`, `json`-parsed. The role is resolved **server-side** from
  the password (`roleForPassword`); the client never names a role, so it can
  only read its own rail.
- **`setWranglerRail_(body, role)`** → upsert the caller's chats by
  `(role, chatId)`; delete the role's rows absent from the payload (so a deleted
  chat propagates). `{ ok, saved: n }`.
- **Dispatch:** `if (action === 'getWranglerRail') …` / `setWranglerRail` next to
  the team-chat cases (any valid role; role-scoped).
- **Isolation invariant:** role A can never read or overwrite role B's rows
  (enforced by the server-derived role on every read/write).

### B · Frontend — mirror `pushChats`/`loadChats`

- **`pushWranglerRail()`** (debounced via `pushWranglerRailSoon`, ~1.2 s): for
  each chat queued to sync, first `await wrOffloadChatImages(chat)` (Drive URLs,
  full fidelity), then `backendCall('setWranglerRail', { chats })`. Skip when
  unchanged (a `lastRailJson` guard, like `lastChatsJson`).
- **`loadWranglerRail()`** on boot (after `wranglerRailLoad`) and in
  `refreshFromBackend`: `getWranglerRail` → `mergeWranglerRail(remoteChats)`.
- **`mergeWranglerRail(remote)`** (pure, testable): union by `chatId`; for a chat
  in both, the **newer `ts`** wins; a remote-only chat is added; a local chat
  newer-or-absent-remotely flags `localAhead` → `pushWranglerRail()`. Writes the
  merged result to IndexedDB (`wrStore.putChat`) so the local cache stays current.

### Data flow

```
chat snapshot → IndexedDB (wrStore) ──┐  (local durability, #181)
                                      ├─ pushWranglerRailSoon → offload images → setWranglerRail → Sheet row
boot / refresh → getWranglerRail → mergeWranglerRail (union by id, newest ts)
                                      └─ writes merged chats to IndexedDB + renders
result → your Wrangler rail is identical on every device you log into as that role
```

### Hook into the existing flow

- `wranglerRailPersist` (the IndexedDB writer, #181) also kicks
  `pushWranglerRailSoon()` after a successful `putChat`.
- `wranglerRailLoad` (boot, #181) calls `loadWranglerRail()` once the local rail
  is in memory, so boot = union(local, backend).
- `refreshFromBackend` calls `loadWranglerRail()` alongside `loadChats()`.

## Error handling & edges

- Offline / no backend → push and pull are silent no-ops (guarded by
  `backendPassword`); local IndexedDB keeps working; syncs on reconnect.
- A chat whose images failed to offload (offline) → it still syncs its **text**;
  images offload + re-push on the next online pass (never blocks the text).
- Role change mid-session (re-login) → the rail reloads for the new role (a
  login already re-boots; `loadWranglerRail` runs for the new role).
- Whole-chat last-writer-wins: a rare concurrent edit to the *same* chatId on two
  devices keeps only the newer. Pull-before-edit makes this uncommon; acceptable
  for v1.
- Deleted chat: absent from the push payload → the backend deletes the role's
  row → it disappears on other devices on their next pull.

## Testing

- **Frontend logic-seam** (`mergeWranglerRail` is pure):
  - union adds a remote-only chat; newer-`ts` wins both directions; a
    local-newer chat sets `localAhead`; identical input is a no-op.
  - merged chats are written to `wrStore` (cache stays current).
- **Backend** (throwaway row via the live exec URL, per the runbook):
  - `setWranglerRail` then `getWranglerRail` round-trips a chat for a role;
  - **isolation:** a different role's `getWranglerRail` does NOT return it;
  - a delete (omit from payload) removes the row;
  - clean up the throwaway rows.
- `smoke` + `logic-test` + `gen-rule-usage --check`; cache-bust bump.

## Gates / deploy (per CLAUDE.md + the clasp runbook)

- Backend: `clasp pull` → add the functions + dispatch → `clasp push --force` →
  `clasp deploy -i <prod deployment id> -d "wrangler rail sync"` (**same id** so
  the exec URL is unchanged). Verify on a throwaway role row, then delete it.
- Keep a secret-free copy of the additions in
  `docs/handoffs/wrangler-rail-sync-backend.gs`.
- Frontend three gates (port-swap 8000→9147, restore `ci/`); `?v=` bump; ship
  via feature branch → PR → squash-merge (main is branch-protected).

## Open items

- None blocking. (`uploadCapture` reuse for image offload is already confirmed
  generic and live-verified.)
