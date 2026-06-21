---
name: start
description: Jac Rentals session startup routine — run at the top of a session with /start. Probes the toolchain (node/npm/clasp/gh/git), orients on the current git branch vs staging/main, recalls relevant memory, PROPOSES a feature branch + dated session-output folder and waits for your OK before creating them, and sets token-efficiency + role-aware working rules for the rest of the session.
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

## 3. Propose branch + session folder — DO NOT create without an OK
Per the one-branch-per-chat convention:
- **Feature branch:** `feature/<YYYY-MM-DD>-<short-topic>` off `staging`.
- **Session-output folder:** `<YYYY-MM-DD> <Topic>/` in the project root (git-ignored; for OUTPUTS only — exports, reports, scratch — never source files).

State the exact branch name and folder you intend to create, then **WAIT for Jac's confirmation** before creating either. If the session's topic isn't clear yet, defer this step until the first real task is defined. (Use today's date.)

## 4. Working rules for this session (state briefly, then follow)
- **Token discipline:** terse by default; `Grep`/`Glob` before `Read`; read only the range you need; spawn subagents for large isolated work to protect the main context.
- **Clarifying questions:** use the `AskUserQuestion` popup — not inline prose — whenever a decision is genuinely Jac's to make.
- **Specs:** after generating or changing a spec/feature/screen, offer to run `/role` to audit it through the 15 role lenses.
- **Efficiency:** `/audit` is available anytime; the ~100k-token auto-audit hook will also prompt a coaching report.

## 5. Ready summary
End with 3–4 lines: tools OK/missing, current branch + what's in flight, the proposed branch/folder (awaiting OK), and "what are we working on?"

## Conventions reference
- **Branches:** `feature/<date>-<topic>` → merge to `staging` → `staging` → `main` (`main` = live at app.jacrentals.com). Prereq: the `staging` branch + deployed `staging.app.jacrentals.com` (Cloudflare/Netlify) must exist.
- **Backend:** ships via `/clasp` (clasp), never git. `Code.gs`/`Code.js` are gitignored (public repo).
- **Sibling skills:** `/clasp` (backend deploy), `/role` (spec audit), `/audit` (token + model-fit coaching).
- **At session end:** write a short handoff note (what changed, what's pending, which branch) into the session folder so the next chat isn't lost.
