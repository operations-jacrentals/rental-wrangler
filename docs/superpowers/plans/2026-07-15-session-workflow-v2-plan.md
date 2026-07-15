# Session Workflow v2 — Implementation Plan

- **Spec:** `docs/superpowers/specs/2026-07-15-session-workflow-v2-design.md`
- **Branch / PR:** `claude/session-workflow-guidelines-nyom46` / #636 → `trunk` (one PR).
- **Rule:** each step is a coherent commit, pushed as it lands (ephemeral cloud).

## Order of work

| # | Step | Verify |
|---|---|---|
| 1 | **WS1a De-drift** — remove `main`/`area`/"merge = live"/`gh pr merge`/`master-spec` from `.claude/skills/**` + `CLAUDE.md`; replace with the trunk model. | `grep` for the stale patterns returns only accurate trunk-model language |
| 2 | **WS1b Enforcement** — `.claude/hooks/guard-bash.mjs` (PreToolUse) + `.claude/settings.json`: `permissions.deny` (backend + enumerated secret paths), expanded read-only `allow`, hook wiring. | Run the hook standalone with sample stdin: blocks `git push … HEAD:trunk`, blocks secret-var echo, **allows** normal commands; `settings.json` is valid JSON |
| 3 | **WS2 Slim CLAUDE.md** — extract Icons → `.claude/rules/icons.md` (`paths:` globs); trim CLAUDE.md to < 150 lines + TOC. | line count < 150; rule frontmatter valid |
| 4 | **WS3 Memory** — new public-safe `MEMORY.md` (seeded) + wire `/start` read + `/end` write. | file exists with the 4 sections; no PII/pricing/secrets |
| 5 | **WS4 Review loop** — `/merge` fresh-context `/code-review` step + merge-command tripwire in the guard hook. | merge skill documents the required review step |
| 6 | **WS5 Interaction** — hybrid rule in `CLAUDE.md` + `/start` + `/end`; delegation/mockup note. | `grep` for "popups"/"never inline" returns only the new hybrid rule |
| 7 | **Gates** — `node ci/gen-rule-usage.mjs --check`, `node tools/gen-code-map.mjs --check`, `node ci/check-window-catalog.mjs`; confirm smoke/logic unaffected (config-only diff). Push; CI green on #636. | all `--check` gates pass; #636 `smoke` green |

## Risks / guards
- A broken `PreToolUse` hook would affect Jac's real sessions → **test the hook standalone before wiring it** into `settings.json`; make it fail-safe (allow on parse error, never hard-crash).
- Command-matching tripwires fail open — documented in the skills, not oversold. Branch protection + `permissions.deny` remain the walls.
- Enumerate secret-bearing local paths for `permissions.deny` from `.gitignore` (backend, `*.local.md`, `test-creds.local.json`, generated PII data files).
- CLAUDE.md is edited by both WS2 and WS5 → do those edits together to avoid double-touch.
- All changes live in `.claude/`, `docs/`, `CLAUDE.md`, `MEMORY.md`, `settings.json` — none touch the served app bundle, so the app CI gates' targets are unaffected.
