---
name: start
description: Orient a Rental Wrangler Codex task before any work begins. Probe the toolchain, confirm repository and branch state, recall the project context, load the working rules, and propose a codex/* feature branch while waiting for approval before switching.
---

# Start

Run this at the top of every Rental Wrangler task, before investigating or changing
application code. This is an orientation routine, not a ship command.

## 1. Probe the toolchain

Run and report the versions or availability of:

- `node`
- `npm`
- `gh`
- `git`

Check whether the local Playwright browser executable is available, but do not spend
time installing it. A missing local browser is expected on this machine: the browser
smoke and logic suites install Chromium and run in CI. Report the local browser as
`available`, `missing (expected; CI is authoritative)`, or `unknown`.

Never print secret values. If a tool or credential check is unavailable, say so plainly.

## 2. Confirm the repository and orient

Confirm that `origin` points to:

`operations-jacrentals/rental-wrangler`

Then report:

- the current branch (`git branch --show-current`);
- whether it is `trunk`, ahead/behind `trunk`, or a feature branch based on `trunk`;
- whether the working tree is clean (`git status -sb`);
- the short diff summary against the latest available `origin/trunk`.

Fetch `origin/trunk` when needed to make the comparison current. If fetching is not
available, report that limitation rather than guessing. Never switch branches during
this orientation step.

## 3. Recall project context

Read these files before proposing work:

- `AGENTS.md`;
- `MEMORY.md`;
- `docs/WIP.md` (the work ledger);
- `docs/superpowers/specs/2026-07-20-list-views-inline-expand-design.md`;
- `docs/superpowers/plans/2026-07-21-list-detail-views-build-plan.md`.

If any requested file is absent, report its exact path as missing; do not recreate it
or substitute a guessed document. Give a short summary of the project state, active
work, and the next likely step, distinguishing facts from missing context.

## 4. Propose, then wait before branching

Based on the user's actual task, propose one short feature branch off the latest
`trunk`, using the form:

`codex/<short-slug>`

If the task is not clear, ask what work is intended instead of proposing a blind
branch. If the current branch already contains the requested work, report it and do
not create another branch.

Stop and wait for the user's explicit OK before switching or creating the branch.
After approval, start from the latest `origin/trunk`, use the proposed `codex/<slug>`
branch, and verify the branch before editing. Never start work directly on `trunk`.

## 5. Load the session working rules

Before any change, read and apply:

- the mandatory design canon in `.claude/skills/style/SKILL.md`;
- the mandatory design decisions in `.claude/skills/wrangler-style/SKILL.md`;
- the `Design canon`, `Working rules`, and `Where to look` sections of `AGENTS.md`.

Use `docs/CODE-MAP.md` as the navigation entrypoint before reading application code.
Keep the AGENTS.md runbooks and referenced skills as the sources of truth.

## Ready summary

End with a compact summary of:

1. tools and browser status;
2. repository, branch, cleanliness, and trunk relation;
3. context read plus any missing files;
4. the proposed `codex/<slug>` branch and the explicit wait for approval.
