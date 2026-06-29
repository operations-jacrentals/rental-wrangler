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
  - `getWranglerChat` → `{ok, messages:[past index sinceCount], total, driver, lastTs}`. Dev call (`devKey`) reads
    any chat; a non-dev caller reads only a chat under its **own server-resolved role** (per-role isolation).
    **Count cursor** (`sinceCount`) — Wrangler messages have no per-message timestamp.
  - `appendWranglerMessage` → append `message`, bump `lastTs`, **set `driver:'human'`**; `{ok,lastTs}` or
    `{ok:false,reason:'gone'}` if the chat was pruned.
  - `setWranglerDriver` → set `driver ∈ {'ai','human'}`; `{ok}`.
- **Verify:** local unit-stub of the four handlers (pure-function extraction tested in `logic-test` where
  possible — see Phase 4); deploy via **`/clasp`** (STOP-gated) and smoke each action with a throwaway chat id.
- **Model:** main session (auth gate + contract). The mechanical handler body may draft on Sonnet, but the
  `devOK_`/dispatch wiring is reviewed on main. **Commit:** *"Wrangler Ops backend: dev-gated chat actions + driver/lastTs"*.

---

## Phase 2 — Customer dock: poller + paused banner + AI pause (`app.js` + `style.css`)
**Stays on main — touches the agent-loop gate (`wrRunAgent`). New UI (the banner) runs through `/jactec-ui`.**
- **Live sync-up before the jump-in:** snapshot the open dock up on each turn so a developer can see an
  in-progress chat (`wranglerRailSnapshot` → debounced push; pre-pause, still single-writer).
- **Poller** `wranglerDockPoll` near the dock mount (`mountWranglerDock`, ~`app.js:7715`): ~6–8s while a dock is
  open + online, call `getWranglerChat(id, sinceCount=o.messages.length)`; append returned dev turns to
  `state.wrangler.messages[]`, set `o.driver`/banner, re-render. Start on open, clear on close, backoff on error.
- **Paused banner + read-only composer:** when `o.driver==='human'`, render a **hazard-stripe banner**
  *"You're Paused — Developers Are Working On This Live"* and **disable** the input. Clears when `driver==='ai'`.
  New UI → `data-r="Rxx"` stamp via `/jactec-ui`.
- **Seamless in-thread:** a `dev:true` message renders like a normal assistant bubble (no per-message label); the
  banner is the status signal. `dev`/`author` retained for audit only.
- **AI pause guard:** in `wranglerSend`/`wrRunAgent` (~`app.js:10192`–`10222`), if `o.driver==='human'`,
  short-circuit before the Anthropic call (belt-and-suspenders; the composer is disabled anyway). **Fail-safe:** a
  failed poll leaves `driver` unchanged so a known `human` stays paused until an explicit release.
- **Single-writer:** paused customer writes nothing → developer is sole writer → no whole-chat clobber.
- **Verify:** two browser profiles — dev appends, customer dock shows the banner + the turn within one poll, the
  composer is disabled; release → banner clears, composer re-enables, customer can chat and the AI answers. Smoke green.
- **Model:** main session; the banner styling/stamp via `/jactec-ui`. **Commit:** *"Wrangler dock: poll for dev turns + paused banner while a human drives"*.

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
- `getWranglerChat(id, sinceCount)` returns only messages past index `sinceCount`; non-dev caller refused a foreign-role chat.
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
