# Wrangler Ops — developer chat bridge — implementation plan

- **Spec:** [2026-06-29-wrangler-ops-developer-chat-bridge-design.md](../specs/2026-06-29-wrangler-ops-developer-chat-bridge-design.md)
- **Branch:** `claude/mirror-wrangler-chats-l8pjfd`
- **Date:** 2026-06-29

Each phase is its own bisectable commit. **Gates before any push** (per CLAUDE.md):
`node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`,
`node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`. Port 8000 is reserved —
`sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, then `git checkout -- ci/`.
**Cache-bust** the shared `?v=` token on the final UI commit. **All UI phases run through `/jactec-ui`**
(yard data-plate language, `data-r` stamps, screenshot + self-critique before showing Jac).

**Backend (`Code.gs`) ships via `/clasp`, never git** — additive actions only; the `/clasp` skill STOPS for
explicit confirmation before any prod deploy. Reference handler shapes:
`docs/handoffs/wrangler-rail-sync-backend.gs` (`getWranglerRail_`/`setWranglerRail_`).

**Order rationale:** the backend contract (Phase 1) is the foundation both clients depend on; the customer
dock changes (Phase 2) are the auth-/agent-loop-sensitive core and stay on main; the Ops inbox (Phase 3) is
well-scoped UI against the settled contract and can drop to a Sonnet subagent through `/jactec-ui`.

---

## Phase 0 — Baseline (confirm green before touching anything)
- Run all five gates on the current branch; confirm pass. Establishes the "behavior unchanged" baseline.
- **Verify:** all gates green. No commit.

---

## Phase 1 — Backend dev-gated actions + storage fields (`Code.gs`, `/clasp`)
**Why first:** both clients bind to this contract. **Auth-sensitive — contract + gate authored on main session.**
- Add a `DEV_PASSWORD` Script Property check helper: `devOK_(body)` → `body.devKey === PROP('DEV_PASSWORD')`;
  every action below returns `{ok:false, error:'auth'}` when it fails. Never logged/echoed.
- Extend the rail store record with two additive fields, defaulted on read: `driver` (default `'ai'`) and
  `lastTs` (default = max message `ts`). Schema-less Sheet → no migration.
- New actions (route in the existing `doPost` dispatch beside `getWranglerRail`/`setWranglerRail`):
  - `getWranglerChatsAll` → `{ok, chats:[{id,role,title,lastTs,driver,msgCount,preview}], serverTs}` —
    flatten every role's rail; **metadata + last-message preview only** (no full transcripts).
  - `getWranglerChat` → `{ok, messages:[ts>sinceTs], driver, lastTs}`. Accepts a dev call (`devKey`) **or** the
    existing team-password gate for the customer's own chat. Filters by `sinceTs`.
  - `appendWranglerMessage` → append `message`, bump `lastTs`, **set `driver:'human'`**; `{ok,lastTs}` or
    `{ok:false,reason:'gone'}` if the chat was pruned.
  - `setWranglerDriver` → set `driver ∈ {'ai','human'}`; `{ok}`.
- **Verify:** local unit-stub of the four handlers (pure-function extraction tested in `logic-test` where
  possible — see Phase 4); deploy via **`/clasp`** (STOP-gated) and smoke each action with a throwaway chat id.
- **Model:** main session (auth gate + contract). The mechanical handler body may draft on Sonnet, but the
  `devOK_`/dispatch wiring is reviewed on main. **Commit:** *"Wrangler Ops backend: dev-gated chat actions + driver/lastTs"*.

---

## Phase 2 — Customer dock: poller + silent AI pause + seamless rendering (`app.js`)
**Stays on main — touches the agent-loop gate (`wrRunAgent`) and must never let the AI talk over Jac.**
- **Poller** `wranglerDockPoll` near the dock mount (`mountWranglerDock`, ~`app.js:7715`): on a ~6–8s interval
  while a dock is open + online, call `getWranglerChat(id, sinceTs=lastSeenTs)`; append new messages to
  `state.wrangler.messages[]`, advance `lastSeenTs`, re-render. Start on open, clear on close, exponential
  backoff on error (keep last-known state, silent).
- **Seamless render:** a `dev:true` message renders **identically to a normal assistant bubble** — no label, no
  "human joined" notice. `dev`/`author` retained in the message object for audit only; never surfaced.
- **Silent AI pause:** in `wranglerSend`/`wrRunAgent` (~`app.js:10192`–`10222`), when the chat's `driver==='human'`,
  store + sync the user's message but **short-circuit before the Anthropic call** (no agent loop). No notice.
  Resume normally when `driver==='ai'`. **Fail-safe:** treat a failed poll as "driver unchanged" so a known
  `human` keeps the bot quiet until an explicit release.
- **Offline path:** unchanged sync-up; a queued dev reply surfaces on next open via the existing notification bell.
- **Verify:** two browser profiles (or the existing rail-sync test harness) — dev appends a message, customer
  dock shows it seamlessly within one poll; customer reply while `driver==='human'` does **not** trigger an API
  call; release → next reply does. Smoke green.
- **Model:** main session. **Commit:** *"Wrangler dock: poll for injected turns + silent AI pause while a human drives"*.

---

## Phase 3 — Developer Wrangler Ops inbox view (`app.js` + `style.css`)
**Well-scoped UI against the settled contract — Sonnet subagent via `/jactec-ui`.**
- A **dev-only view** unlocked by `DEV_PASSWORD` (Owner-only entry; absent from normal-role nav). Inert without the key.
- **List:** poll `getWranglerChatsAll` (~6–8s); rows sorted by `lastTs` — role/user · title · preview · age ·
  a **live dot** (active <~2 min) · driver state. Yard data-plate styling, `data-r` stamps.
- **Open:** full transcript (reuse the existing Wrangler message renderer in read mode) + a **composer**.
  Send → `appendWranglerMessage` (takes the wheel). **"Release to AI"** → `setWranglerDriver('ai')`.
- New popup → `WINDOW_CATALOG` entry (the `check-window-catalog` gate).
- **Verify:** open the inbox with the dev key (and confirm it's invisible without it); see a live chat appear,
  open it, post a turn, watch it land in the customer dock (Phase 2), release. Screenshot + self-critique.
- **Model:** Sonnet via `/jactec-ui`; the data-sensitivity/auth call (what the inbox exposes) reviewed on main.
- **Commit:** *"Wrangler Ops inbox: live chat list + transcript + jump-in composer"*.

---

## Phase 4 — Logic-test coverage (`ci/logic-test.mjs`)
- driver transitions: `ai → human` on append, `human → ai` on release.
- AI pause: `driver==='human'` → the agent loop is not invoked; `'ai'` → it is.
- `getWranglerChat(id, sinceTs)` returns only `ts > sinceTs`.
- `getWranglerChatsAll` flattens chats across multiple roles into one list.
- **Verify:** `node ci/logic-test.mjs` green incl. the new cases.
- **Model:** Sonnet (tests against settled behavior). **Commit:** *"Tests: Wrangler Ops driver/pause/sinceTs/flatten"*.

---

## Phase 5 — `/jactec-ui` finalize + cache-bust
- Regenerate `node ci/gen-rule-usage.mjs` (drop `--check`); confirm `--check`, `check-window-catalog`, and
  `gen-code-map --check` all pass. Bump the shared `?v=` token on `style.css`/`rule-usage.js`/`app.js` in `index.html`.
- **Verify:** all five gates green. **Commit:** *"Wrangler Ops: rule-usage + window catalog + cache-bust"*.

---

## Phase 6 — (seam only) Escalate → Claude Code button
- In the Ops transcript pane, a quiet **"Escalate → Claude Code"** button wired to the existing `wranglerFile`
  (chat → GitHub issue) — surfaces the issue URL from which a CC web session launches. No new escalation machinery.
- **Verify:** button files an issue with the transcript; URL opens. Smoke green.
- **Model:** Sonnet. **Commit:** *"Wrangler Ops: escalate a chat to Claude Code via the existing Thread Mirror"*.

---

## After the build
- **Local area test (§3 of `/start`):** this branch is a cloud task branch — Jac pulls and serves on
  `localhost:9147`, logs in with `$RW_PW`, exercises the inbox + a two-browser jump-in.
- Then the **continue-or-archive fork**. Backend (`Code.gs`) lands separately via `/clasp` (not git) — track that
  it's deployed before declaring the feature live.
- **Not** pushed to `main` from this session — promotion is Jac's selective call (areas → `staging` → one PR).
