# Implementation plan — Mr. Wrangler duplicate-check before filing

- **Date:** 2026-07-03
- **Spec:** `docs/superpowers/specs/2026-07-03-wrangler-dedup-before-filing-design.md`
- **Area:** wrangler-ai
- **Branch:** TBD with Jac before coding (separate from the timestamp work on
  `claude/mr-wrangler-troubleshooting-8ssi55`).

## Shape of the work

Most of this is **prompt + a read-only index** — no new backend, popup, or stamped
element. Only the "Add to #NNN" branch needs a small new agentic tool. Build in
phases so each lands independently and is verifiable on its own.

Key grounding from the code:
- `wranglerContext(o)` — `app.js:10213` (where the index gets injected).
- `WRANGLER_SYSTEM` / `WR_TOOLS_NOTE` — the system prompt + tool note.
- `ask_user` Stage 2b — `app.js:10498` (askFn); chips render as `.wr-askbtn` at
  `app.js:7886`; the tap resolves the answer string back into `wrRunAgent`.
- `wranglerFileAction` — `app.js:11168` (the existing file path; unchanged).
- `wranglerComment` backend action takes `{ number, role, text, images }` —
  `syncWranglerComment` (`app.js:11309`) proves any issue number can be targeted.
- Index sources: `wranglerRequests` (`app.js:11194`, open) + `wranglerNotifs`
  (`app.js:11203`, recently closed/resolved).

## Phase 1 — the issue index (read-only; no behavior change)

**Step 1 — `wrIssueIndex()` pure helper.**
- Add near `wranglerContext`. Merge `wranglerRequests` + `wranglerNotifs`, dedupe by
  `number`, map each to `#<n> · "<title>" · <state>` where state ∈
  {open, needs your OK, building, fixed, closed}. Cap length (e.g. most-recent 40)
  so the block stays small. Return `''` when both lists are empty.
- **Verify:** unit assertion — sample requests + notifs → expected compact string;
  empty inputs → `''`.

**Step 2 — inject into `wranglerContext(o)`.**
- Append `\n\nALREADY FILED (check before filing a new fix/request):\n` + `wrIssueIndex()`
  when non-empty.
- **Verify:** log the built context in a dev session; confirm the block is present
  and correctly formatted with real data.

## Phase 2 — detection + chips (prompt only)

**Step 3 — `WRANGLER_SYSTEM` dedup instruction.**
- Add: *before* proposing a `fix` or `request`, scan ALREADY FILED. If the new report
  describes the same problem as an existing entry, do NOT emit the file action —
  instead call `ask_user` with the single best match:
  > "Looks like this is already reported — #NNN '<title>' (<open|already fixed>).
  > What do you want to do?"
  options: `["Add my note to #NNN", "File a new one anyway", "It's already fixed — refresh"]`
  (drop the third option unless the match is completed/merged).
- **Verify (E2E, staging):** report a known duplicate (e.g. re-tier wording) → the
  chips appear referencing the right issue number; report a novel bug → no chips,
  normal file path.

## Phase 3 — the three branches

**Step 4 — "File a new one anyway".**
- No new code: the model proceeds to emit its normal `request`/`fix` action, which
  flows through the existing `wranglerFileAction`.
- **Verify:** tapping it files a new issue exactly as today.

**Step 5 — "It's already fixed — refresh".**
- No new code: the model replies with text ("fixed in #NNN — hard-refresh to load it").
- **Verify:** tapping it files nothing and shows the refresh copy.

**Step 6 — "Add my note to #NNN" (the one new capability).**
- Add a small agentic tool `note_on_issue({ number, text })` to `WR_TOOLS` that calls
  `backendCall('wranglerComment', { number, role: 'user', text })`. On the "Add" tap,
  the model calls it with the match number + a one-paragraph summary of the new
  report, then replies "Added your note to #NNN."
- **Verify:** tapping it posts a comment on the matched issue (check the issue thread);
  no new issue created.

## Phase 4 — guards, tests, gates

**Step 7 — edge guards.**
- `!backendPassword` (demo/offline) or both lists empty → `wrIssueIndex()` returns `''`,
  the ALREADY-FILED block is omitted, and filing behaves exactly as today (never block
  a report on the dedup step). `not_planned`-closed matches are treated as open (no
  "already fixed" option).
- **Verify:** demo mode still files; a dismissed-issue match doesn't offer "fixed".

**Step 8 — tests, gates, cache.**
- Unit: `wrIssueIndex()` assertion (Step 1).
- Gates: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check` (no stamp change expected),
  `node ci/check-window-catalog.mjs` (no popup change expected),
  `node tools/gen-code-map.mjs --check` (regenerate if banners shifted).
- Bump the shared `?v=` cache token in `index.html`.

**Step 9 — E2E on staging.**
- Drive the staging app (Claude-in-Chrome): report a known-duplicate bug, confirm the
  chips reference the right issue, and exercise all three branches (comment lands /
  new issue files / refresh copy). Screenshot for the handoff.

## Rollout / ordering

Phases 1→2 are safe to land first (index + detection only changes what the model
*sees* and *asks*, never what it files). Phase 3 Step 6 is the only new plumbing.
Phase 1's helper can even ship alone (dormant) if we want to split PRs.

## Not doing (from the spec)

Similarity-scoring engine; backend/GAS change; multi-tenant isolation. If detection
proves leaky, add a deterministic keyword prefilter (A+B hybrid) later without redoing
this.
