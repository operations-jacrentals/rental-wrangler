# Mr. Wrangler chat-rail storage — IndexedDB + Drive offload

**Date:** 2026-06-20
**Status:** Approved (design) — ready for implementation plan
**Surface:** the Mr. Wrangler dock + its bottom-right rail of past chats
(`state.wranglerRail`, `wranglerRailSave` at `app.js:5190`; attachments at
`app.js:6833`–`6839`).

## Summary

The Mr. Wrangler AI rail keeps up to 8 past conversations in **localStorage**,
with image attachments stored as **inline base64**. Several image-heavy chats
blow the ~5 MB localStorage cap, and the save is a silent `try/catch` — so
history **vanishes without warning**. This moves the rail to **IndexedDB**
(gigabytes of headroom, native Blobs), offloads images to **Drive**, and makes
every failure **loud**. The mandate (Jac): *this silent loss can never happen
again.*

## Scope — what this is and isn't

| Surface | Storage today | This spec |
|---|---|---|
| **Mr. Wrangler AI rail** (`state.wranglerRail`) | localStorage, base64 images, **per-device** | ✅ the subject |
| **Team chat** (§17 dock, `state.chat.chats`) | backend-synced, text-only, **already cross-device** | ❌ untouched |

- **Device-local only** (decided). Team chats already sync across devices via
  `pushChats`/`loadChats`; the Wrangler rail stays per-device. Making the rail
  *cross-device* (server-synced like team chat) is a **possible later
  follow-up**, explicitly out of scope here.
- Not the DATA/Sheet photo-offload (separate, shipped: inspection/part photos).

## The problem (confirmed)

- The rail loads from `localStorage['jactec.wranglerRail']` (`app.js:1424`) and
  saves via `wranglerRailSave` (`app.js:5190`) — `localStorage.setItem(...,
  JSON.stringify(rail.slice(0, 8)))`, wrapped in `try {} catch (e) {}`.
- Attachments downscale to **1200 px / 0.7 JPEG base64** (~60–120 KB each, up to
  4 per message; `app.js:6836`) and ride **inline** in each message's `images`
  (snapshot at `app.js:5203`).
- 8 chats × several image messages easily exceeds the ~5 MB cap → `setItem`
  throws `QuotaExceededError` → the silent catch swallows it → **the rail isn't
  saved and history is lost on reload.**

## Decisions (locked 2026-06-20)

| Question | Decision |
|---|---|
| Local store | **IndexedDB**, two object stores (`chats` + `blobs`) |
| Image representation | **Blobs** in IndexedDB; messages carry a **ref** `{blobKey, driveUrl?}`, never inline base64 |
| Drive offload trigger | **Both** — on filing a wrangler issue AND on a size threshold (`estimate()` budget) |
| Retention | **Keep all chat text** (no count cap); bound the store by a **size budget** (`WR_LOCAL_BUDGET` ≈ 25 MB), defended in layers |
| Offline over-budget | **Evict oldest local image blobs**, preferring ones already on Drive; text/messages **never** deleted in normal use; a **visible** notice names what was freed |
| Failure handling | **No silent catch** — every persist failure surfaces; IndexedDB-unavailable → in-memory + a loud one-time notice |
| Cross-device | Out of scope (device-local); team chat already covers the cross-device need |

## Non-goals

- No cross-device sync of the Wrangler rail (future follow-up).
- No change to team chat, the live-chat send path's request shape, or the
  wrangler-issue *content*.
- No new dependency — a hand-rolled IndexedDB wrapper (vanilla single-file app).
- No re-encoding; attachments already downscale at capture.

## Architecture

### A · `wrStore` — vanilla IndexedDB module (no deps)

DB `jactec.wrangler`, version 1, two object stores:

- **`chats`** (keyed by chat `id`): the snapshot
  `{ id, title, ts, card, recId, recType, reqNumber, reqTitle, reqUrl, messages }`
  — identical to today **except** each message's `images`/`files` hold
  **refs** `{ blobKey, driveUrl, name, mime }`, not base64 strings.
- **`blobs`** (keyed by `blobKey` = `b_<chatId>_<seq>`): the image **Blob**.

A ~80-line promise wrapper exposing: `open()`, `putChat(c)`, `getChat(id)`,
`listChats()` (metadata + message refs, cheap — no blob reads), `delChat(id)`,
`putBlob(key, blob)`, `getBlob(key)`, `delBlob(key)`, `estimate()` (wraps
`navigator.storage.estimate()`). One file, focused, independently testable.

### B · Write path (replaces `wranglerRailSave`)

- On chat update → `await wrStore.putChat(snapshot)`. Each new attachment Blob →
  `wrStore.putBlob(key, blob)`; the message stores `{ blobKey: key }`.
- **Render:** an image uses `driveUrl` when present, else
  `URL.createObjectURL(await wrStore.getBlob(blobKey))` (object URLs revoked on
  re-render to avoid leaks).
- **Loud on failure:** a `putChat`/`putBlob` rejection raises an `attnFlash`/
  toast naming the problem — never swallowed.

### C · Drive offload (dual trigger)

- **On file** — when a chat is filed as a wrangler-fix issue, upload its blobs to
  Drive (reuse `uploadCapture`), set `driveUrl` on each message image, and the
  issue carries the URLs (extends the existing gather at `app.js:7099`). The
  local Blob becomes a droppable cache (`driveUrl` is now the source of truth).
- **Threshold** — after a write, if the tracked store size passes a soft mark
  (≈ 60 % of `WR_LOCAL_BUDGET`, the single budget constant defined in §D) **and**
  online, offload the oldest chats' un-synced blobs to Drive, swap each to
  `driveUrl`, and `delBlob` the local copy. Drains proactively so the store never
  approaches the hard `WR_LOCAL_BUDGET` ceiling.

### D · Retention & the storage guarantee (the "cap it somehow")

**Keep all chat text** — no count cap (the old `WR_RAIL_MAX` hard-drop of the
9th-oldest chat is retired; text is tiny and IndexedDB has room). The hard bound
is a **size budget** `WR_LOCAL_BUDGET` (≈ 25 MB, a named constant — well under any
IndexedDB quota), enforced via `estimate()` + the store's tracked size, defended
in layers so the budget is a real guarantee that's effectively never felt:

1. **Layer 1 — images → Drive.** On the size trigger (and online), offload the
   oldest un-synced image blobs to Drive and `delBlob` the local copies. Images
   are ~99 % of the weight, so this alone keeps text history growing for years.
2. **Layer 2 — image eviction (offline over-budget).** Can't reach Drive: drop
   oldest local blobs that **already have a `driveUrl`** first (safe cache drop,
   re-fetchable); only then drop oldest **un-synced** blobs (lossy last resort) —
   with a **visible notice** naming what was freed.
3. **Layer 3 — text trim (the absolute backstop).** Only if text *alone* ever
   approaches `WR_LOCAL_BUDGET` (pathological — tens of thousands of messages),
   trim the oldest chats' text with a **visible notice**. Size-based, loud, and
   effectively unreachable — but it makes the bound a hard guarantee.

In every realistic scenario nothing is lost: text is kept, images live on Drive.
The store is **always ≤ `WR_LOCAL_BUDGET`**, so localStorage's silent-overflow
failure can never recur.

The visible rail UI lists recent chats (scrollable); storage retaining all chats
is decoupled from how many the rail shows at once.

### E · Migration (one-time)

On first load with the new code: if `localStorage['jactec.wranglerRail']` exists,
import each chat into `chats`; each inline base64 image becomes a `blobs` entry
with the message rewritten to a `{ blobKey }` ref; then `removeItem` the
localStorage key. Guarded + idempotent (absent key → skip).

### Data flow

```
attach image → Blob → wrStore.putBlob(key) ; message = { blobKey }
chat update  → wrStore.putChat(snapshot)         (text + refs only — tiny)
render       → driveUrl ?? objectURL(getBlob(blobKey))
file issue   → upload blobs → driveUrl on messages → issue carries URLs → drop local Blob
over budget  → online: offload oldest un-synced → Drive ; offline: evict (synced-first) + notice
```

## Error handling & the "never again" guarantee

- Every persist path is `await`ed and its failure **surfaced** (no silent
  `try/catch` that drops history). The old localStorage silent-catch is removed.
- IndexedDB unavailable (private mode / disabled) → operate **in-memory** for the
  session and show a **loud one-time notice** that history won't persist on this
  device — strictly better than silent loss.
- Threshold offload keeps the store well under any quota, so
  `QuotaExceededError` is avoided in the normal (online) path entirely.

## Testing

- **Logic-seam tests** (expose `wrStore` + the policy helpers on `window.__rw`;
  use a fresh test DB):
  - `putChat`/`getChat` round-trip; `listChats` returns refs without reading
    blobs; an image persists as a `{ blobKey }` ref, **not** base64.
  - offload swaps `blobKey → driveUrl` (stubbed uploader) and `delBlob`s the
    local copy.
  - eviction drops synced blobs before un-synced and **never** removes message
    text in normal use; over-budget offline path emits the notice; the Layer-3
    text-trim backstop fires only past `WR_LOCAL_BUDGET` and emits its notice.
  - migration imports a seeded `localStorage` rail into IndexedDB then clears the
    key; a second run is a no-op.
- **smoke:** app boots; opening the dock + rail renders from IndexedDB without
  throwing (empty store → empty rail, no error).

## Gates (per CLAUDE.md)

- Any new/changed dock control runs through `jactec-ui` (the offline/quota notice
  is new UI — emit via the established pattern; an `attnFlash`/toast needs no
  `data-r`). Regenerate `rule-usage.js` only if a `data-r` element changes.
- Three gates: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check` (port-swap 8000→9147 first, restore `ci/`).
- Bump the shared `?v=` token in `index.html`.
- Ship via feature branch → PR → squash-merge (main is branch-protected).

## Open item for Jac

Same `uploadCapture` backend reuse as the photo-offload spec — confirm it accepts
a generic `{dataUrl, name}` → `{ok, url}`. If yes, **no backend change**; the
photo-offload spec's appendix already carries a paste-in handler if not.
