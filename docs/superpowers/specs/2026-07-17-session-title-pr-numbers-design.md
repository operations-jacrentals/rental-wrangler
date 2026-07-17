# Session title = PR numbers — design

**Date:** 2026-07-17 · **Status:** IMPLEMENTED 2026-07-17 (`.claude/hooks/session-title.mjs`
+ `SessionStart` wiring + the `/start` §4 workflow rule) ·
**Origin:** Jac — *"I need the numbers in the session title… when more are created the
session title should be updated."* Brainstormed 2026-07-17; capability verified against
the Claude Code docs via the `claude-code-guide` agent.

> **Verify on next session start/resume:** two platform behaviors can only be confirmed
> live — (a) that this harness actually consumes `hookSpecificOutput.sessionTitle`, and
> (b) whether `SessionStart` stdin exposes the current title (needed for respect-manual-
> rename; the hook degrades gracefully to "set anyway" if it doesn't). The script itself
> is unit-tested across the empty / one-PR / multi-PR / manual-rename cases and fails safe
> (any error or missing file → emits nothing, leaves the title untouched).

## Goal

The Claude Code **session title** automatically reflects the GitHub PR(s) this session
opened, and updates as PRs are created or land. Example — this very session would read:

```
#669 · popup question format
```

Multiple open PRs list ascending, sharing the label: `#669, #672 · popup question format`.

## What the platform actually allows (verified)

The design is shaped by three hard facts about Claude Code (docs-cited):

1. **Only a `SessionStart` hook can set the title** — via `hookSpecificOutput.sessionTitle`.
   It fires on `startup` and on every `resume` (`--resume` / `--continue` / `/resume`).
2. **No `PostToolUse` / `Stop` hook can set the title.** So nothing fires *the instant* a
   PR is created — a hook alone can only refresh at start/resume.
3. **The model cannot self-invoke `/rename`.** Slash commands are user-only input. The
   *instant* mid-session update therefore requires a human tap on a `/rename` line.

Consequence: a fully hands-free, instant-on-PR-create title is **not** achievable. The
design gets ~95% there by combining an automatic resume-refresh with a one-tap instant
update.

## Design — three cooperating pieces

### ① The record — a best-effort scratch file

- A **gitignored** file (proposed `.claude/.session-prs`, added to `.gitignore`) holding
  the **currently-open** PR numbers this session opened, one per line (or a comma list).
- **The assistant maintains it:** append a number on PR-create; remove it when that PR
  **merges/closes** (observed via `/merge` or a `<github-webhook-activity>` event).
- **Best-effort by design:** gitignored → no repo noise. On a fresh-container reclaim the
  file is gone, so the title falls back until the next PR or `/rename`. This trade-off was
  chosen deliberately over a committed file (repo noise) or a live GitHub query (needs a
  token reachable from a shell hook, which cloud may not provide).
- Because each cloud session gets its own fresh clone/container, a repo-local gitignored
  file is effectively session-scoped.

### ② The `SessionStart` hook (matcher: `startup` + `resume`)

- Reads the scratch file. If present and non-empty, computes the title and emits:
  ```json
  { "hookSpecificOutput": { "hookEventName": "SessionStart", "sessionTitle": "#669 · popup question format" } }
  ```
- **Title = `#<n>[, #<n>…] · <label>`**, numbers ascending.
- **`<label>` = branch de-slugified:** strip the `claude/` prefix and the trailing
  `-<id>` suffix, replace hyphens with spaces
  (`claude/popup-question-format-1f0oz6` → `popup question format`).
- **Respect manual renames (as built):** `SessionStart` stdin carries no live title, so the
  hook keys off the **PR set**. It records the PR set it last titled for (`.session-title-set`)
  and, on a later resume with the *same* set, emits nothing — leaving a hand-set `/rename`
  intact. It only re-asserts the auto-title when the open-PR set actually changes (a PR opened
  or merged) or on first run.

### ③ The post-PR workflow rule (`CLAUDE.md` + `/start`)

Because the model can't self-`/rename`, whenever the assistant **opens or lands** a PR it:
1. Updates the scratch file (append on open; remove on merge/close), and
2. Surfaces a ready-to-run line for a one-tap instant update:
   ```
   /rename #669 · popup question format
   ```
This is the instant path between resumes; the hook (②) is the automatic backstop.

## Data flow

```
PR created ──▶ assistant appends # to .session-prs ──▶ prints "/rename #… · label" line
                                                          │
                                              Jac taps it ▼  (instant title update)
session resumed later ──▶ SessionStart(resume) hook reads .session-prs ──▶ sets title
                          (only when the PR set changed vs .session-title-set → a hand
                           rename survives while the PR set is stable)
PR merges/closes ──▶ assistant removes # from .session-prs ──▶ prints updated "/rename" line
```

## Scope / YAGNI

- **In:** PRs the assistant opens **this session** (recorded). Ascending order. Only
  currently-open PRs in the title (merged/closed drop off). Respect manual renames.
- **Out:** arbitrary PRs the assistant didn't open; multi-branch reconciliation; a
  committed record; a live GitHub query in the hook; keeping merged PRs in the title.

## Open implementation questions — RESOLVED during build

1. **Scratch path + `.gitignore`** — `.claude/.session-prs` and `.claude/.session-title-set`,
   both added to `.gitignore`; no collision with tracked `.claude/` content.
2. **~~Does `SessionStart` stdin expose the current title?~~** — **No** (documented fields:
   `session_id`, `source`, `transcript_path`, `permission_mode`, `hook_event_name`, `cwd`).
   Respect-manual-rename uses the **PR-set marker** in ② instead of reading a live title.
3. **De-slugify edge cases** — the trailing-id strip keeps a real `word+version` last segment
   (`oauth2`, `node20`, `sha256`, `web3`, `ipv6`) and only drops a random-looking id
   (`1f0oz6`, `l8pjfd`); a bare/no-suffix branch is used verbatim. Rare miss: an id shaped
   like `word+digits` (`nyom46`) is kept — harmless (extra token, never a truncation).

## Verify live (only observable on a real session)

- That this harness consumes `hookSpecificOutput.sessionTitle` at all (the script is
  unit-tested and fail-safe regardless).

## Testing

- **Hook unit check:** given a `.session-prs` fixture, the hook emits the expected
  `sessionTitle` JSON; empty/missing file → no title emitted (leave as-is).
- **De-slugify:** `claude/popup-question-format-1f0oz6` → `popup question format`;
  a non-matching branch → raw name.
- **Respect-manual-rename:** with a marker file present and a divergent live title, the
  hook emits no `sessionTitle`.
- **Workflow rule (manual/CI-observable):** creating a PR appends to the file and prints a
  `/rename` line; landing it removes the number.

## Success criteria

- Opening a PR yields a one-tap `/rename` line and a title reflecting it after the tap.
- Resuming the session re-derives the title from open PRs automatically.
- A hand-set title survives a resume (not overwritten).
- No tracked-file churn from the feature (record stays gitignored).
