# Mr. Wrangler — duplicate-check before filing an issue

- **Date:** 2026-07-03
- **Status:** Design approved (brainstorming) — pending implementation plan
- **Area:** wrangler-ai
- **Author:** Mr. Wrangler troubleshooting session

## Problem

Mr. Wrangler files a brand-new GitHub issue every time a bug/request is reported,
with **no awareness of what already exists**. `wranglerFileAction` (`app.js:11168`)
calls `backendCall('wranglerFile', { title, body, label })`, which creates a fresh
issue unconditionally. `wranglerContext(o)` (`app.js:10213`) feeds the model the
yard data and the focused record but **nothing about existing issues**, so it files
blind.

The result is heavy duplication of one real problem:

- **Weekly re-tier on extend** → 4 issues: #416, #420, #425, #444.
- **Invoice option missing on calendar-extend** → 2 issues: #426, #443.

The rail then copies each conversation across 5–6 roles, so one bug becomes ~20
rail rows. Worse, **already-fixed** bugs get re-filed as if new, making the queue
look like an unresolved flood and burying the signal that fixes shipped.

## Goal

Before Mr. Wrangler files a `fix`/`request`, it checks what already exists and lets
the **reporter choose** what to do — never filing a duplicate silently, and catching
the case where the bug is already fixed (just needs a refresh).

## Decisions (from brainstorming)

1. **On a match, the reporter chooses** — Add to the existing issue / File a new one
   anyway / (if the match is already fixed) refresh. Not auto-fold, not auto-block.
2. **Detection is AI-judged** — Mr. Wrangler judges matches *semantically* from an
   index of existing issues. Chosen over deterministic text matching because the real
   duplicates are worded three different ways ("Weekly rate not applied" vs "doesn't
   re-tier to weekly" vs "1-day×n instead of 7-day") and text matching would miss them.
3. **Scope = open + recently-closed/fixed** — required so the "already fixed — refresh"
   branch can fire.

## Architecture / data flow

### 1. The issue index (no new backend)

The client already holds both halves of the index:

- **Open issues** — `wranglerRequests` (`app.js:11194`), loaded by `refreshWranglerRequests`.
- **Recently closed/resolved** — `wranglerNotifs` (`app.js:11203`), loaded by
  `refreshWranglerNotifications` (the notifications feed already curates resolved/
  closed/merged items with `{ number, title, kind, merged, closedAt, url }`).

A tiny pure helper `wrIssueIndex()` formats these into a compact block:

```
ALREADY FILED (check before filing a new fix/request):
#444 · "Rental extension doesn't re-tier to weekly rate" · fixed
#426 · "Invoice option missing when extending rental via calendar" · open (needs your OK)
#414 · "Cannot bill rental when customer has a negative-balance invoice" · fixed
...
```

Kept to `#number · title · state` per line so it stays small.

### 2. The check (in the agentic loop, prompt-driven)

- `wranglerContext(o)` (`app.js:10213`) appends the `wrIssueIndex()` block.
- `WRANGLER_SYSTEM` gains one instruction: **before** proposing a `fix` or `request`
  action, scan ALREADY FILED; if the new report describes the same problem as an
  existing entry, do **not** file — call `ask_user` with the match instead.

### 3. The reporter chooses (existing `ask_user` chips — Stage 2b)

Mr. Wrangler surfaces the match through the existing `ask_user` flow
(`app.js:10498`, rendered as `.wr-askbtn` chips at `app.js:7886`):

> "Looks like this is already reported — **#NNN '\<title\>'** (\<open / already fixed\>).
> What do you want to do?"

Chips and their wiring:

| Chip | Action |
|---|---|
| **Add my note to #NNN** | Post a comment on #NNN via the existing `wranglerComment` / `syncWranglerComment` path (`app.js:11292`+). No new issue. |
| **File a new one anyway** | Proceed with the normal `wranglerFileAction` — nothing is lost; the reporter overrides. |
| **It's already fixed — refresh** *(only when the match is closed/fixed)* | No file. Reply: "That's fixed in #NNN — hard-refresh (Ctrl/Cmd+Shift+R) to load it." |

## Components / changes (small, additive)

1. **`wrIssueIndex()`** — new pure helper; formats `wranglerRequests` + `wranglerNotifs`
   into the compact ALREADY-FILED block. Unit-testable.
2. **`wranglerContext(o)`** (`app.js:10213`) — append the index block.
3. **`WRANGLER_SYSTEM`** — add the dedup instruction + the 3-chip protocol.
4. **"Add to #NNN" wiring** — route that chip answer to post a comment on the matched
   issue (reuse `wranglerComment` backend action; mirror via `syncWranglerComment`).

No new popup window → **no `WINDOW_CATALOG` change**. No new stamped element
(`.wr-askbtn` already exists) → **no `rule-usage` change**.

## Edge cases

- **No match** → files normally (behavior unchanged).
- **Index empty / offline / demo** (`!backendPassword`, or lists not yet loaded) →
  skip the check and file normally. Never block a report on the dedup step.
- **Model misjudges a match** → the "File a new one anyway" chip is the escape hatch;
  no report is ever lost.
- **Multiple candidate matches** → the model surfaces the single best match (top 1);
  keep the prompt from listing many.
- **Match is closed-but-not-actually-fixed** (`not_planned`) → treat as open for the
  "already fixed" copy — only show "already fixed — refresh" when the match was
  completed/merged, not when it was dismissed.

## Testing & gates

- `wrIssueIndex()` is a pure function → add a unit check (given sample requests +
  notifs → expected compact string). Fits the existing `ci/logic-test.mjs` style for
  pure helpers, or a small standalone assertion.
- The AI judgment itself is prompt behavior (like the rest of Mr. Wrangler, which is
  not covered by `ci/logic-test`) → verified by an **E2E drive on staging**: report a
  known-duplicate bug and confirm the chips appear and each branch behaves.
- Standard gates: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`,
  `node tools/gen-code-map.mjs --check`. Cache token bump on deploy.

## Out of scope (YAGNI)

- No similarity-scoring engine (that was the rejected deterministic approach B).
- No backend/GAS change (reuse `wranglerComment` + the already-loaded issue data).
- No multi-tenant issue isolation (single-tenant today; revisit with the Wrangler
  Ops multi-tenant work in #407).

## Known limitation & future

Detection is prompt-driven, so a stray file could slip through if the model ignores
the instruction. Mitigations: a strong instruction and a prominent index, and the
reporter confirms every match. If it proves leaky in practice, add a **deterministic
prefilter** (the A+B hybrid) — narrow candidates by keyword, then let the model judge
the finalists — without redoing this design.
