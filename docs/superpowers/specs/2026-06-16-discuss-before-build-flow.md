# Discuss-before-build + mid-build "needs you" — one flow

**Date:** 2026-06-16 · **Approved by Jac (pop-ups):** balanced gate · build both as one flow.

One conversation surface (the **Talk to Mr. Wrangler** chat) and one review surface
(the **Requests inbox** + the **notification bell** as the alert) handle a change
from idea → plan → build → (if needed) a mid-build question → resume → shipped.

## Issue lifecycle (labels = state)

- **`wrangler-fix`** — an obvious bug, or a plan Jac OK'd → the engine builds it.
- **`wrangler-request`** — a change Mr. Wrangler proposed; **needs Jac's plan-OK**
  (he reviews/refines in chat, then taps **Build this plan**).
- **`wrangler-needs-jac`** (NEW) — the build **paused** on a real decision; **needs
  Jac's answer**. Lights the inbox badge + bell. Jac answers in the same chat →
  relabel back to `wrangler-fix` → the engine **resumes** (reads the full thread).

## In-app (frontend — this repo)

- **Plan gate (chat):** a *bug* still auto-files (`action:"fix"`). A *change* makes
  Mr. Wrangler propose a concrete **plan** (`action:"plan"`) — the bubble shows a
  **✓ Build this plan** button. Building files `wrangler-fix` with an
  **"### Approved plan (build to this)"** section as the spec.
- **Inbox states:** each request card is tagged **Needs your OK** (plan) /
  **Needs your answer** (needs-jac) / **Building**, read from the issue label.
  `needs-jac` cards lead with Mr. Wrangler's question + **Answer** (opens the chat).
- **Bell:** a feed entry when something enters a "needs you" state (hooks the
  existing bell feed). The inbox FAB badge already counts open items.
- **Answering:** sending in the chat on a `needs-jac` request posts the answer to
  the issue **and** resumes the build (relabel).

## Engine (`.github/workflows/wrangler-fix.yml` — this repo)

- If the issue has an **"### Approved plan"**, build **exactly** to it.
- If genuinely blocked (an ambiguous decision, or it would touch
  money/card/auth/WO-completion), **do not guess**: post the question as a comment,
  relabel `wrangler-fix → wrangler-needs-jac`, and stop. A later answer +
  relabel to `wrangler-fix` resumes it.

## Backend (Code.gs — owner paste; documented, graceful without it)

- `wranglerRequests` returns each issue's **label** (so the inbox can tag state +
  the bell can alert).
- Answering a `needs-jac` request (`wranglerComment`) also **relabels it to
  `wrangler-fix`** to resume (or a `wranglerResume` action).
- Everything degrades: with no backend changes, the chat plan-gate + inbox still
  work; the state tags/auto-resume light up after the paste.
</content>
