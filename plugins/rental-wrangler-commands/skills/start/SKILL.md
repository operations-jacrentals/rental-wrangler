---
name: start
description: Orient a Rental Wrangler Codex task before any work begins. Probe the toolchain, confirm repository and branch state, recall the project context, choose an efficient agent plan, load the working rules, and propose a codex/* feature branch while waiting for approval before switching.
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

If local `gh auth status` is unavailable or reports an invalid credential because the
Codex sandbox uses a different Windows identity, do not repeatedly ask the user to
reauthenticate and do not ask for a token. Use the authenticated GitHub integration
for remote branch, commit, PR, and workflow operations when available. Report the
local CLI limitation separately; never copy credentials into the repository, a
workspace file, or command output.

Use this fallback ladder for remote work:

1. Prefer the authenticated GitHub integration.
2. If it is unavailable, check for non-secret `GH_TOKEN`/`GITHUB_TOKEN` presence,
   an existing SSH agent/key, or a configured Git credential helper without printing
   or exporting any credential value.
3. If no remote channel is available, continue read-only investigation, edits, local
   checks, commits, and artifact preparation. Mark only the final publish/PR action
   as pending and give the user one concrete host-side auth action at that boundary;
   never leave the whole session blocked and never ask them to paste a token.

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

## 4. Choose the efficient agent plan

Before proposing execution, decide whether subagents would materially help the task.
Use them for separable, low-risk work that can run in parallel, such as focused
read-only reconnaissance, mechanical file inventory, or independent verification.
Keep tightly coupled implementation, high-blast-radius reasoning, and any product,
security, money, auth, customer-PII/isolation, work-order completion, secret, force
push, or live-deployment decisions on the main thread.

When agents are useful, state the intended split briefly: what stays on the main
thread, what each agent should inspect or verify, and how the results will be
integrated. Do not spawn duplicate agents for the same question, and do not let
agent use bypass the branch, gates, staging, PR, or promotion rules.

## 5. Match model strength to task risk

Choose by capability and risk, not by a hard-coded model name; model labels and
picker offerings change over time. Keep the main thread on the strongest available
frontier coding/reasoning model for architecture, large refactors, design judgment,
auth, money, customer PII/isolation, work-order semantics, or release-risk review.
Use the balanced general coding model for ordinary feature work, bug fixes, PR
preparation, and test-guided implementation. Use a fast/efficient coding model for
bounded reconnaissance, code-map or file inventory, documentation, syntax checks,
and other mechanical work whose acceptance criteria are already clear.

Start with a balanced reasoning setting. Raise it for ambiguous, high-blast-radius,
or evidence-heavy work; lower it for latency-sensitive, well-specified work. Do not
trade away model strength for sensitive decisions, and do not block a task merely
because a preferred model label is unavailable—map the current picker to these roles
and continue with the closest safe capability.

For parallel work, keep product and safety judgment on the frontier-model main
thread and give independent low-risk checks to efficient models. Use a fresh context
for an adversarial second review when that is more valuable than additional effort in
the original thread.

## 6. Propose, then wait before branching

Based on the user's actual task, propose one short feature branch off the latest
`trunk`, using the form:

`codex/<short-slug>`

If the task is not clear, ask what work is intended instead of proposing a blind
branch. If the current branch already contains the requested work, report it and do
not create another branch.

Stop and wait for the user's explicit OK before switching or creating the branch.
After approval, start from the latest `origin/trunk`, use the proposed `codex/<slug>`
branch, and verify the branch before editing. Never start work directly on `trunk`.

## 7. Load the session working rules

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
