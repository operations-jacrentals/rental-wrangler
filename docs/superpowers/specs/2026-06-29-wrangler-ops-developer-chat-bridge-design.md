# Wrangler Ops — the developer chat bridge

**Date:** 2026-06-29
**Status:** Approved design (MVP)
**Area:** Mr. Wrangler (in-app AI assistant)
**Scope:** Single tenant (JacRentals) now; designed to generalize to multi-tenant later.

---

## 1. Problem & goal

Rental Wrangler is scaling toward serving up to ~50 rental companies. As the
developer, Jac wants to **support customers who are trying to solve problems
through Mr. Wrangler** — by (1) seeing the Mr. Wrangler conversations happening
in the app, and (2) **jumping into a live thread himself** to continue it when
the AI is failing the user. Escalating a conversation into a Claude Code session
to fix something in code is a third capability, but it is mostly already built
(see §9) and is **not** the focus of this MVP.

**MVP = developer inbox (see all chats) + live jump-in (continue a thread).**

### Hard constraint that shapes everything

The backend is Google Sheets behind a Google Apps Script web app. **There are no
websockets or server-push.** "Live" therefore means **polling** (~6–8s). This is
accepted: it matches the existing architecture and is fine for "support jumps in."

### Tenancy decision

The app is **single-tenant today** — one backend Sheet, one team password, and
`getWranglerRail`/`setWranglerRail` keyed by **role**, not company. This MVP is
built for the single JacRentals tenant. Every new backend action is designed so a
`companyId` filter can be added later without reshaping the contract — the seam is
left, the 50-backend fan-out is **not** built now (see §10).

---

## 2. Existing plumbing we build on

- Live transcript: `state.wrangler.messages[]` — clean `{role, content, ...}` JSON
  (Anthropic message shape). App `§18`, ~`app.js:9642–10313`.
- Persistence: IndexedDB (`jactec.wrangler` → `chats` store) + backend Sheet via
  `getWranglerRail` / `setWranglerRail` (cross-device sync, keyed by role).
- Agent loop: `wrRunAgent(messages, system, opts)` (`app.js:10192`) →
  `backendCall('wrangler', …)` → Anthropic via the GAS backend (server-side key).
- Thread Mirror (reused for escalation only): `wranglerFile` (chat → GitHub issue),
  `wranglerComment` / `wranglerThread` (mirror turns), plus the auto-fix pipeline
  (`docs/wrangler-pipeline.md`, Track B) that hands issues to a Claude Code agent.

---

## 3. Architecture overview

```
  Customer's Wrangler dock                 Backend Sheet (GAS)                Developer's Wrangler Ops inbox
  ─────────────────────────                ───────────────────                ──────────────────────────────
  chats sync up (existing) ───setWranglerRail──▶  rail store                          │
                                              { …chats, driver, lastTs }              │
  dock poll (~6–8s) ◀──getWranglerChat(id,sinceTs)──┤                                 │
   • append dev msgs (seamless)                     │                                 │
   • driver==='human' → AI paused                   ├──getWranglerChatsAll──▶ poll (~6–8s): list all chats
                                                     │                          • open → full transcript
  customer reply ───setWranglerRail──▶ (stored, no AI call while human-driving)│      • composer → append (takes wheel)
                                                     │◀──appendWranglerMessage──┤      • "Release to AI" → setWranglerDriver
                                                     │◀──setWranglerDriver──────┤
```

Three isolated units: **backend actions** (§4), **customer dock poller + AI pause**
(§5), **developer Ops inbox** (§6). Each communicates through the documented action
contracts and can be tested independently.

---

## 4. Unit A — backend dev-gated actions (`Code.gs`, ships via `/clasp`, additive)

**Gate:** a dedicated `DEV_PASSWORD` Script Property — **not** the team password,
**not** a role. Owner/developer-only. Every action below validates
`body.devKey === DEV_PASSWORD` server-side and returns `{ok:false, error:'auth'}`
otherwise. The key is never in the repo, never echoed, never logged.

| Action | Input | Returns | Notes |
|--------|-------|---------|-------|
| `getWranglerChatsAll` | `{devKey}` | `{ok, chats:[{id, role, title, lastTs, driver, msgCount, preview}], serverTs}` | **Metadata only** (last-message preview, no full transcripts) so polling stays cheap. Flattens every role's rail into one list. |
| `getWranglerChat` | `{devKey?, id, sinceCount}` | `{ok, messages:[…past index sinceCount], total, driver, lastTs}` | Used by **both** sides. Dev call (valid `devKey`) reads any chat; a non-dev caller reads a chat **only if it is stored under that caller's server-resolved role** (same per-role isolation as `getWranglerRail` — ids can't be enumerated across roles). **Count cursor** (`sinceCount` = messages the client already holds), because Wrangler messages carry no per-message timestamp. |
| `appendWranglerMessage` | `{devKey, chatId, message}` | `{ok, lastTs}` or `{ok:false, reason:'gone'}` | Appends `message`, bumps `lastTs`, **sets `driver:'human'`** (takes the wheel). `gone` if the janitor pruned the chat. |
| `setWranglerDriver` | `{devKey, chatId, driver}` | `{ok}` | `driver ∈ {'ai','human'}`. Explicit hand-back ("release the wheel"). |

**Storage delta:** two additive fields on each stored chat — `driver` (default
`'ai'`) and `lastTs`. The rail store is schema-less Sheets, so this is additive;
no migration. (Track C — backend ships by `/clasp` paste, not git.)

---

## 5. Unit B — customer dock: polling + AI pause (`app.js`)

While a Wrangler dock is **open**:

- **Poller** `wranglerDockPoll` (~6–8s, only when open + online): calls
  `getWranglerChat(id, sinceCount=local message count)`. Returned messages are
  appended to `state.wrangler.messages[]` and rendered. (`lastTs` is chat-level,
  server-stamped on append — used for inbox sort/liveness, not message delivery.)
- **Paused banner + read-only composer (per Jac, 2026-06-29):** when
  `driver === 'human'`, the customer's dock shows a prominent **hazard-stripe
  banner** — *"You're Paused — Developers Are Working On This Live"* — and the
  composer is **disabled** (read-only). The customer watches the developer work the
  thread; they cannot send while paused. Banner clears and the composer re-enables
  when `driver` flips back to `'ai'`.
- **Single-writer concurrency (why the pause matters):** because the paused
  customer writes **nothing** while `driver === 'human'`, the developer is the
  **sole writer** of that chat row — so the whole-chat-replace sync can never clobber
  an injected dev turn or the `driver` flag. No per-message ids, no append-twin
  action, no merge logic needed; Phase 1's contract stands. On release, the
  customer's local copy already holds the dev turns (pulled by the poller), so its
  next normal full-rail push includes them — one more pull on resume closes the tiny
  remaining window.
- **Seamless in-thread (no per-message label):** individual developer turns
  (`dev:true`) render like a normal assistant bubble — no "Support" tag per message.
  The **banner** is the single, honest status signal that humans are on it. The
  `dev:true`/`author` fields are retained for the audit trail only.
- **AI pause:** while `driver === 'human'` the local agent loop (`wrRunAgent`) is
  also suppressed (belt-and-suspenders — the composer is disabled anyway, but a
  guard prevents any queued/programmatic send from firing an Anthropic call).
- **Fail-safe:** once a human has taken the wheel, `driver:'human'` is the persisted
  server state. Even through a failed poll the dock stays paused until an explicit
  `setWranglerDriver('ai')`.
- **Poll lifecycle:** starts on dock open, stops on close, exponential backoff on
  error (keep last-known state, silent to the customer).
- **Live visibility before the jump-in:** so a developer can see an in-progress
  conversation (which normally only syncs up on close), the open dock snapshots-up
  on each turn (`wranglerRailSnapshot` → debounced push). That happens **before** any
  pause, while the customer is still the only writer — so it stays single-writer too.

**Honest limitation:** the pause/jump-in only reaches a customer whose dock is
**open**. If closed, the chat is no longer live; the developer can still read it in
the inbox and a reply surfaces on the customer's next open via the notification bell.

---

## 6. Unit C — developer Wrangler Ops inbox (`app.js`)

- A **dev-only view**, invisible and inert without the `DEV_PASSWORD` (entered
  through an Owner-only unlock; not present in any normal role's navigation).
- **List:** polls `getWranglerChatsAll` (~6–8s), rows sorted by `lastTs`. Each row:
  role/user, title, last preview, age, a **"live" dot** when active in the last
  ~2 min, and the **driver** state (AI vs you).
- **Open a chat:** full transcript pane (reuses the existing Wrangler message
  renderer in a read view) + a **composer**. Sending calls `appendWranglerMessage`
  (which takes the wheel). A **"Release to AI"** button calls
  `setWranglerDriver('ai')`.
- **Escalate → Claude Code** (secondary; reuses §9): a button that fires
  `wranglerFile` to mint a GitHub issue seeded with the transcript and surfaces the
  issue URL, from which a Claude Code web session launches. Present so the seam
  exists; not the MVP focus.

---

## 7. Identity / author model

Developer turns are stored as `{role:'assistant', dev:true, author:'Jac', ts}`:

- **As Anthropic context:** plain `assistant` turns, so if the AI later resumes the
  thread the conversation reads coherently.
- **As customer UI:** rendered exactly like Mr. Wrangler (seamless — §5).
- **As audit/dev signal:** `dev:true`/`author` mark which turns were human; used by
  the Ops inbox and any future audit view, never shown to the customer.

---

## 8. Security & gating (kept on the main session — auth-sensitive)

- `DEV_PASSWORD` is a Script Property, validated server-side on **every** dev action
  (`getWranglerChatsAll`, `appendWranglerMessage`, `setWranglerDriver`, and dev
  calls to `getWranglerChat`). Never the team password, never echoed, never in the
  public repo, never logged.
- The Ops surface is invisible/inert without the key.
- **PII:** Jac will see real customer chats — the intended support capability,
  owner-only. Nothing leaves the existing backend: no new external copy, no Drive
  or repo spill. (Consistent with the standing PII guard — read live data for
  support, never paste it into the public repo, commits, or seeds.)
- Money/safety fences are unchanged: developer messages are plain chat turns and do
  **not** bypass the existing hard-blocks (no card/ACH charge, no refund, no WO
  completion, no role/password change) — those gates live below this feature.

---

## 9. Escalate to Claude Code (already-built path, reused not rebuilt)

The Thread Mirror already does the heavy lifting: `wranglerFile` files a chat as a
GitHub issue with the full transcript + context + images; `wranglerComment` /
`wranglerThread` mirror turns; the Track-B pipeline (`docs/wrangler-pipeline.md`)
hands `wrangler-fix`-labelled issues to a Claude Code agent that patches, runs CI,
and ships. The Ops inbox simply exposes a clean **"Escalate → Claude Code"** entry
into this. No new escalation machinery is built in this MVP.

---

## 10. Out of scope (YAGNI for the MVP)

- **Multi-tenant `companyId` fan-out** — the action contracts leave room for a
  tenant filter, but reading across 50 separate backends is not built now.
- **True realtime** (Firebase/Ably or similar) — polling only.
- **Polished escalate-to-CC flow** — the button reuses §9 as-is.
- **Customer-facing "request a human" button** — for now Jac watches and jumps in.

---

## 11. Error handling

- **Poll failures:** exponential backoff, keep last-known state, silent to the
  customer.
- **Pruned chat** (the chat janitor removed it): `appendWranglerMessage` /
  `setWranglerDriver` return `{ok:false, reason:'gone'}`; the inbox drops the row.
- **Offline customer:** developer messages persist server-side; delivered on the
  customer's next dock open (notification bell).
- **AI-pause is fail-safe:** persisted `driver:'human'` keeps the bot quiet through
  failed polls until an explicit release.

---

## 12. Testing

- `ci/logic-test.mjs` (pure logic, no browser):
  - driver transitions: `ai → human` on `appendWranglerMessage`, `human → ai` on
    `setWranglerDriver('ai')`.
  - AI pause: with `driver==='human'`, a new customer message does **not** invoke
    the agent loop; with `driver==='ai'` it does.
  - `getWranglerChat(id, sinceCount)` returns only messages past index `sinceCount`;
    a non-dev caller is refused a chat stored under a different role.
  - `getWranglerChatsAll` flattens chats across multiple roles into one list.
- `ci/smoke.mjs`: app still boots with the Ops view registered.
- New UI (Ops inbox view + dev composer) runs through **`/jactec-ui`**:
  `data-r="Rxx"` stamps on every new element, a `WINDOW_CATALOG` entry for the Ops
  popup, and `node ci/gen-rule-usage.mjs` regenerated (the `--check` gate).
- Backend actions are additive GAS; manual smoke via the live Ops inbox after a
  `/clasp` deploy.

---

## 13. Build order (for the implementation plan)

1. Backend actions + storage fields (`driver`, `lastTs`) — `/clasp` deploy.
2. Customer dock poller + silent AI pause + seamless dev-message rendering.
3. Developer Wrangler Ops inbox (list → transcript → composer → release).
4. `logic-test.mjs` coverage for driver/pause/sinceTs/flatten.
5. `/jactec-ui` pass: stamps, `WINDOW_CATALOG`, rule-usage regen.
6. (Seam only) "Escalate → Claude Code" button wired to existing `wranglerFile`.
