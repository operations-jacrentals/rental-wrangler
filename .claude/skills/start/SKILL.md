---
name: start
description: Jac Rentals session startup routine — run at the top of a session with /start. Probes the toolchain (node/npm/clasp/gh/git), orients on the current git branch vs staging/main, recalls relevant memory, ROUTES the session to the right long-lived area branch (using the branch map, based on what you want to work on) and proposes a dated session-output folder — waiting for your OK before switching — then sets token-efficiency + role-aware working rules for the rest of the session.
---

# /start — Jac Rentals session startup

Run this first thing in a session. It gets the session organized so parallel chats and branches stop colliding, and primes Claude with the right tools, conventions, and discipline. Built for both local (Windows/PowerShell) and cloud (Linux) sessions.

## 1. Toolchain probe
Run and report a short table — node, npm, clasp, gh, git:
```
node --version; npm --version; clasp --version; gh --version; git --version
```
- **clasp is installed → the GAS backend is reachable via the `/clasp` skill. NEVER ask how to access the backend; use `/clasp`** (additive-only; it STOPS before any prod deploy).
- If a tool is missing, say so plainly — don't assume it's there.

## 2. Branch + status orientation
- Run: `git branch --show-current`, `git status -sb`, `git log --oneline -5`.
- Show how the current branch differs from the integration branch when available: `git diff --stat origin/staging...HEAD` (or vs `origin/main`).
- Recall memory: read `MEMORY.md` and surface anything relevant to this session's topic (e.g. `[[jactec-skill-build-plan]]`, `[[jactec-tooling]]`, `[[jactec-design-prefs]]`).

## 3. Route to a TASK BRANCH off the right area — DO NOT switch without an OK
The app is organized into long-lived **area branches** (`area/*`), each owning a domain. You do **not** work on an area branch directly — you branch a short-lived **task branch off it** (`<domain>/<task>`), so multiple sessions can work the SAME area in parallel without colliding. Flow: **`<domain>/<task>` → `area/<domain>` → `staging` (preview/debug) → `main` (live)**.
- Read **`references/branch-map.md`**, match what Jac described to the best-fitting area, and **PROPOSE a task branch** in one line (e.g. *"Invoicing work → branch `invoicing-payments/refund-rounding` off `area/invoicing-payments`?"*). **WAIT for his OK** before switching.
- On OK, start from current code (never stale):
  1. `git fetch origin`
  2. refresh the area base from the trunk: `git checkout area/<domain> && git merge --no-edit origin/main` (instant if untouched; a real merge if the area has work — **if it CONFLICTS, STOP and surface it**, don't guess), then `git push` the refreshed area.
  3. cut the task branch: `git checkout -b <domain>/<task>` and `git push -u origin <domain>/<task>`.
  4. Commit your work to the **task branch** and push there. Name it `<domain>/<task>`, NOT `area/<domain>/<task>` — git won't nest a branch under an existing branch's name.
- When the task is done: merge `<domain>/<task>` → `area/<domain>`, then `area/<domain>` → `staging` to preview/debug, then PR `staging` → `main` once clean. (A standalone task can PR straight to `staging`.)
- If two areas overlap, name both and let Jac pick (`AskUserQuestion`). If **nothing** fits, propose a NEW `area/<slug>` off `staging`, then a task branch off that.
- Also offer a session-output folder `<YYYY-MM-DD> <Topic>/` (git-ignored; OUTPUTS only — never source). Use today's date.
- If the topic isn't clear yet, defer until the first real task is defined — don't branch blind.

## 4. Working rules for this session (state briefly, then follow)
- **Token discipline:** terse by default; `Grep`/`Glob` before `Read`; read only the range you need; spawn subagents for large isolated work to protect the main context.
- **Model triage:** auto-delegate mechanical/bulk work (git/gh plumbing, grep sweeps, file munging, running scripts) to **Haiku** subagents and well-scoped implementation to **Sonnet** subagents; keep architecture, security/gates, and ambiguous calls on the main session. Full rule in `CLAUDE.md` → *Auto-delegation*. (You pick subagent models; you can't change your own.)
- **Clarifying questions:** use the `AskUserQuestion` popup — not inline prose — whenever a decision is genuinely Jac's to make.
- **Specs:** after generating or changing a spec/feature/screen, offer to run `/role` to audit it through the 15 role lenses.
- **Efficiency:** `/audit` is available anytime; the ~1M-token auto-audit hook will also prompt a coaching report.
- **Promotion cadence — propose the hops, never auto-promote to live:** when a task is *done*, offer to merge `<domain>/<task>` → `area/<domain>` (the merged task branch then self-cleans via the branch janitor). When Jac wants to preview/QA, merge `area/<domain>` → `staging` — the staging site auto-syncs (~10 min) for phone testing. Only after Jac confirms it's clean on staging, open a PR `staging` → `main` (protected; CI). **`main` is live — promoting to it is always Jac's explicit call.**
## 5. Ready summary
End with 3–4 lines: tools OK/missing, current branch + what's in flight, the proposed branch/folder (awaiting OK), and "what are we working on?"

## 6. Wrap-up — after shipping to `main`, or when the session winds down
- **Run `/tidy-sessions`.** After a PR merges to `main` (work shipped) — or as the session ends — invoke `/tidy-sessions` to sweep finished/stale chats. It lists candidates and archives only what Jac confirms; it never touches the current chat or open-PR work.
- **Mark THIS chat done.** A session can't archive itself mid-use, so tell Jac his work shipped and he can archive this chat on the way out — otherwise the next `/tidy-sessions` sweep catches it automatically once its task branch is gone (the branch janitor deletes merged task branches).
- **Handoff note.** Write a short note (what shipped, what's pending, which area branch) into the session-output folder so the next chat — local or cloud — picks up cleanly.

## Conventions reference
- **Branches:** work on an **`area/*`** branch (see `references/branch-map.md`) → merge to `staging` (preview/debug) → `staging` → `main` (`main` = live at app.jacrentals.com via GitHub Pages). `main` is protected: changes land via PR + CI.
- **Backend:** ships via `/clasp` (clasp), never git. `Code.gs`/`Code.js` are gitignored (public repo). In cloud sessions a `SessionStart` hook auto-wires clasp auth from the `CLASPRC_JSON_B64` env secret.
- **Sibling skills:** `/clasp` (backend deploy), `/role` (spec audit), `/audit` (token + model-fit coaching), `/tidy-sessions` (archive finished chats). Plus the existing suite: `jactec-ui`, `frontend`, `mobile-*`, `webapp-testing`, `wrangler-fix`.
- **At session end:** write a short handoff note (what changed, what's pending, which area branch) into the session folder so the next chat — local or cloud — picks up cleanly.
