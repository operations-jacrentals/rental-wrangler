# Wrangler Ops — developer live-chat bridge (re-implementation, 2026-07-09)

**Status:** Implemented (this PR), against current `staging`.
**Predecessor:** `docs/superpowers/specs/2026-06-29-wrangler-ops-developer-chat-bridge-design.md`
and `docs/superpowers/plans/2026-06-29-wrangler-ops-developer-chat-bridge-plan.md`, built on
the stale branch `claude/mirror-wrangler-chats-l8pjfd` (forked 2026-06-29, never merged — ~350+
commits behind by 2026-07-09, real `app.js` conflicts). This document supersedes those for the
CURRENT architecture; the June docs remain as design-intent history, not as the live contract.

## Why re-implement instead of merge

The stale branch's UI/state shape no longer matches current `app.js`: the Mr. Wrangler dock is now
a phone-only bottom sheet, with desktop riding a shared body builder (`wranglerDockBodyHtml`) inside
the D9 comms-rail window (`commsWranglerPopupHtml`) — a redesign that landed after the fork. This PR
re-implements the same product intent directly against that current shape.

## What changed from the June 29 design

1. **No more `DEV_PASSWORD` / `devKey`.** The June spec predates the 2026-06-26 role-tier system
   (`docs/superpowers/specs/2026-06-26-role-system-redesign-design.md`). Today the app already has a
   **Developer tier** (config.js `ROLE_TIERS`, rank 5) gating Design Lint/Inspector/Rulebook
   (`devUnlocked()`). Wrangler Ops reuses that SAME gate — client-side, the toolbar entry point is
   simply invisible below Developer tier (`bottomBarInner`, beside Lint/Inspector/Rulebook); server-
   side, the four new backend actions resolve the caller's role from the password every `backendCall`
   already sends (`roleForPassword`) and require tier ≥ developer (`roleTierRank_` from
   `docs/handoffs/role-tiers-backend.gs`). One less secret to provision, rotate, or leak.
2. **No separate gate screen.** Because the role check already happened at login, the inbox popup
   opens straight to the chat list — no "enter the dev key" field.
3. **Entry point is a plain gated toolbar button, not a long-press gesture.** The stale branch's
   long-press-on-launcher was a workaround for the old floating-launcher-button UI (predates the D9
   comms-rail chips and the Developer tier). A `devUnlocked()`-gated icon button next to Lint/
   Inspector/Rulebook is the idiomatic entry point today.
4. **The paused banner + poller live in the SHARED body builder** (`wranglerDockBodyHtml`), so both
   the phone dock and the desktop D9 rail window get them for free — the stale branch only had a
   phone dock to patch.
5. **`driver`/`lastTs` need zero backend schema work beyond the four new actions.** They ride inside
   each chat's existing JSON blob and already round-trip through the UNCHANGED
   `getWranglerRail_`/`setWranglerRail_` (`wranglerRailSnapshot` now includes them in every snapshot).

Everything else — the polling architecture (no websockets/server-push on a GAS backend), the
single-writer concurrency argument (a paused customer writes nothing, so the developer is the sole
writer of that chat row), the seamless dev-turn rendering (no per-message "Support" label, the banner
is the one honest status signal), the count-cursor message delivery, and the Escalate → Claude Code
seam reusing the existing `wranglerFile`/Thread Mirror verbatim — carries over unchanged from the
June 29 design; see that document for the full rationale.

## Scope of this PR

**In:** backend contract (documented, not deployed — see `docs/handoffs/wrangler-ops-backend.gs`),
customer dock poller + paused banner (R28) + AI pause guard, the Wrangler Ops inbox popup (list +
transcript + jump-in composer + Release to AI), and the Escalate → Claude Code button.

**Out (unchanged from the June scope):** multi-tenant `companyId` fan-out, true realtime
(Firebase/Ably), a customer-facing "request a human" button, and any change to the Apps Script
backend itself — `backend/Code.gs` is gitignored and not in this checkout; deploying the actions
documented in `docs/handoffs/wrangler-ops-backend.gs` is a separate `/clasp` step Jac runs when ready.
Until that backend deploy lands, the new UI is present but the backend calls it makes will return a
generic failure (same graceful-degradation path every `backendCall` already has) — it does not
regress anything currently live.
