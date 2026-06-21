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

## 3. Route to an area branch — DO NOT switch without an OK
The app is organized into long-lived **area branches** (`area/*`) off `staging`, each owning a domain (rentals/dispatch, invoicing, units/fleet, design system, etc.). Many sessions share one area branch; the flow is **`area/<domain>` → `staging` (preview/debug) → `main` (live)**.
- Read **`references/branch-map.md`**, match what Jac described to the best-fitting area, and **PROPOSE** it in one line (e.g. *"This is invoicing work → switch to `area/invoicing-payments`?"*). **WAIT for his OK** before switching.
- On OK: `git fetch origin && git checkout <area-branch> && git pull --ff-only` so you start from the latest. Commit and push to that same area branch.
- If two areas overlap, name both and let Jac pick (use `AskUserQuestion`). If **nothing** fits, propose a NEW `area/<slug>` branched off `staging`.
- Also offer a session-output folder `<YYYY-MM-DD> <Topic>/` (git-ignored; OUTPUTS only — exports, scratch — never source). Use today's date.
- If the topic isn't clear yet, defer routing until the first real task is defined — don't switch branches blind.

## 4. Working rules for this session (state briefly, then follow)
- **Token discipline:** terse by default; `Grep`/`Glob` before `Read`; read only the range you need; spawn subagents for large isolated work to protect the main context.
- **Clarifying questions:** use the `AskUserQuestion` popup — not inline prose — whenever a decision is genuinely Jac's to make.
- **Specs:** after generating or changing a spec/feature/screen, offer to run `/role` to audit it through the 15 role lenses.
- **Efficiency:** `/audit` is available anytime; the ~1M-token auto-audit hook will also prompt a coaching report.

## 5. Ready summary
End with 3–4 lines: tools OK/missing, current branch + what's in flight, the proposed branch/folder (awaiting OK), and "what are we working on?"

## Conventions reference
- **Branches:** work on an **`area/*`** branch (see `references/branch-map.md`) → merge to `staging` (preview/debug) → `staging` → `main` (`main` = live at app.jacrentals.com via GitHub Pages). `main` is protected: changes land via PR + CI.
- **Backend:** ships via `/clasp` (clasp), never git. `Code.gs`/`Code.js` are gitignored (public repo). In cloud sessions a `SessionStart` hook auto-wires clasp auth from the `CLASPRC_JSON_B64` env secret.
- **Sibling skills:** `/clasp` (backend deploy), `/role` (spec audit), `/audit` (token + model-fit coaching). Plus the existing suite: `jactec-ui`, `frontend`, `mobile-*`, `webapp-testing`, `wrangler-fix`.
- **At session end:** write a short handoff note (what changed, what's pending, which area branch) into the session folder so the next chat — local or cloud — picks up cleanly.
