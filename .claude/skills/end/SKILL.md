---
name: end
description: Close out a Claude Code session on the trunk workflow — report what's actually shipped (merged to trunk vs promoted to production vs still pending/uncommitted), sweep loose ideas or half-done threads onto their own parked branches so nothing is lost, refuse to archive while anything is pending/parked/uncommitted, then archive the chat. Replaces tidy-sessions, which only archived. Use when a feature is done, a session is winding down, or chats pile up. Invoke with /end.
---

# /end — capture, close out, archive

Closes a session properly on the trunk model: one `trunk` (the trunk branch),
short-lived feature branches, a `production` release-pointer branch. Runs FOUR
jobs, strictly in order — the archive step only fires once the first three are
clean. Replaces `tidy-sessions`, which only did job 4.

> **PR/GitHub operations below** are shown as `gh` commands (local sessions). In a
> cloud session there is no `gh` — use the GitHub MCP tools (`mcp__github__*`,
> discover via ToolSearch) for the same reads/writes. Session archival likewise:
> `mcp__ccd_session_mgmt__*` on a desktop session; if it's absent (a cloud run),
> say so and point Jac to archive in the Claude app.

## 1. Report shipped-state plainly
Don't let the session end on a fuzzy "did this actually ship?". Check and
state all three, even when a bucket is empty:
- **PROMOTED (live):** `git log origin/production..origin/trunk --oneline` —
  empty means `trunk` IS what's live; anything listed is on the trunk but
  **not yet promoted**.
- **MERGED TO TRUNK, not yet promoted:** the output of the check above.
- **PENDING / uncommitted:** `git status -sb` on the current branch/worktree,
  plus any feature branch this session pushed that never merged.
- **Worktree state**, if this session ran in a `claude --worktree`: name it,
  say whether its work already landed on `trunk`. Landed → cleanup candidate
  for job 4. Not landed → it's PENDING and blocks archive under job 3.
- Write this into a short handoff note (session-output folder) so the next
  session — this one resuming, or a fresh one — doesn't have to re-derive it.

## 2. Catch loose work before it's lost
The job `tidy-sessions` never did, and the one Jac most wanted. Scan for
anything worth keeping that isn't already cleanly shipped or committed to a
tracked branch:
- `git status -sb` / `git diff` for uncommitted or untracked changes not
  already covered by job 1's shipped report.
- `git stash list` — anything stashed and forgotten.
- Skim the session itself for ideas Jac raised or Claude proposed and then
  deferred — cue phrases like "later," "not now," "someday," "good idea but
  skip," "table this," "follow-up." A verbal idea with zero code still
  counts if it's worth keeping.
- Any half-built function/file left mid-edit in the working tree that isn't
  part of the shipping diff.

For each candidate, confirm with Jac via an `AskUserQuestion` popup (one attempt; if
it fails, present the same short list inline as lettered **A/B/C… + Other**) with the
choices: **park it**, **keep working it now instead of ending the session**, or
**drop it**. Default suggestion is park — it's cheap and reversible; dropping needs an
explicit yes.

**Mechanics for parking (every confirmed item):**
1. **Name it** `parked/<short-kebab-slug>` — e.g. `parked/dark-mode-toggle`.
   Add a date prefix only if the slug could collide or timing matters:
   `parked/2026-07-12-dark-mode-toggle`.
2. **Branch it** off the trunk (or off the current feature branch, if the
   loose work only makes sense on top of it — say which and why):
   `git checkout trunk && git pull && git checkout -b parked/<slug>`.
3. **Commit the loose work** with a message that stands alone months later —
   what it is, why it was parked, what's left:
   ```
   Park: <one-line description>

   Deferred from <origin branch/session> on <date>.
   Needs: <what's left to finish it>.
   ```
   For an idea with no code yet, commit a short markdown note (e.g. under
   `docs/superpowers/notes/`) instead of an empty branch — the note IS the
   artifact.
4. **Push it:** `git push -u origin parked/<slug>`.
5. **Note it** — open a draft PR so it's discoverable without merging:
   `gh pr create --draft --title "[parked] <slug>" --body "<what it is, why
   parked, what's left>"`. Draft PRs surface via `gh pr list --draft`, so a
   later session (or the next `/end` run) can resurface stale
   parked work instead of it rotting silently.
6. **Return** to the branch you were on before parking — never leave the
   session sitting on a parked branch.
7. List every parked branch + its draft-PR link in the job-1 handoff note.

## 3. Guard against premature archive
If job 1 found anything PENDING/uncommitted, or job 2 found a loose thread
that's still undecided (or Jac chose to keep working it now) — **do NOT
archive**. State plainly what's outstanding and what would clear it (e.g.
"commit `foo.js`," "confirm parking the CSV-export idea"), then stop. Same
conservative posture `tidy-sessions` already applied to archiving itself,
just moved one step earlier to cover the whole close-out.

## 4. Archive the chat reliably — last step, only once 1–3 are clean
The old `tidy-sessions` job, unchanged in spirit:
1. List sessions with `mcp__ccd_session_mgmt__list_sessions`. If unavailable
   (e.g. a cloud run), say so and point Jac to archive in the Claude app.
2. Identify candidates conservatively: no activity in 7+ days, OR the
   session's branch is merged/gone (cross-check `gh pr list --state merged`
   / `git ls-remote`). Never flag the current session or one with an open
   PR, or no PR yet.
3. **If this session ran in a worktree and job 1 confirmed its work already
   landed on `trunk`, clean it up now** — remove the worktree
   (`ExitWorktree` / `git worktree remove`) so it doesn't linger as a stale
   checkout.
4. Present candidates as a short table (title · last activity · branch
   status) via `AskUserQuestion`; default-select the clearly-done ones, let
   Jac deselect.
5. Archive the confirmed ones with `mcp__ccd_session_mgmt__archive_session`.
   Report what was archived, what was kept, and what was cleaned up.

## Rules
- **Never skip ahead.** Job 4 cannot run before 1–3 are clean — that
  ordering is the whole point of replacing `tidy-sessions`.
- **Never archive or park without confirmation.** Both are reversible, but
  silent action isn't welcome — surface the choice via the `AskUserQuestion`
  popup (one attempt; if it fails, the same choice inline as **A/B/C… + Other**).
- **Never archive the active session.**
- Default conservative throughout: unsure whether something's finished →
  leave it, ask.
- **Refresh `MEMORY.md` before archiving.** Append this session's durable
  decisions, new gotchas, and design prefs to `MEMORY.md` (public-safe — no
  PII / pricing / secrets), and prune Open threads that have closed. It's the
  git-committed cross-session brain a fresh cloud clone starts from.
- **Out of scope, by design:** driving Gate 1 ("merge it") or Gate 2
  ("promote it"), and "landing" work beyond reporting + parking. That's the
  `start` skill's two-gate deploy loop, not this one.
