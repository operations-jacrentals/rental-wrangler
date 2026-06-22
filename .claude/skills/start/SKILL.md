---
name: start
description: Jac Rentals session startup routine — run at the top of a session with /start. Probes the toolchain (node/npm/clasp/gh/git + Playwright), orients on the current git branch vs staging/main, recalls relevant memory, ROUTES the session to the right long-lived area branch (using the branch map, based on what you want to work on) and proposes a dated session-output folder — waiting for your OK before switching — then sets token-efficiency + role-aware working rules for the rest of the session.
---

# /start — Jac Rentals session startup

Run this first thing in a session. It gets the session organized so parallel chats and branches stop colliding, and primes Claude with the right tools, conventions, and discipline. Built for both local (Windows/PowerShell) and cloud (Linux) sessions.

## 1. Toolchain probe
Run and report a short table — node, npm, clasp, gh, git:
```
node --version; npm --version; clasp --version; gh --version; git --version
```
- **clasp installed ≠ backend reachable — verify AUTH the right way.** Probe with clasp's own command, never by looking for a credentials file (clasp 3.x does **not** reliably use the old `~/.clasprc.json` path — guessing paths is exactly how sessions wrongly cry "no auth"):
  ```
  clasp --version                       # installed? (expect 3.x)
  clasp show-authorized-user --json     # authed?  -> {"loggedIn": true|false}
  ```
  (default user; if you use a named user or `--auth <file>`, pass the same flags to the check.)
  - **`loggedIn: true`** → backend IS reachable via the `/clasp` skill (additive-only; STOPS before any prod deploy). **Don't ask how to access the backend and don't re-verify by file path — just use `/clasp`.**
  - **`loggedIn: false`** → **normal for a LOCAL session — clasp creds are cloud-provisioned, so the desktop has the tool but not the keys.** Don't treat it as broken, don't claim the backend is reachable, don't dig through `~/.clasprc.json`, and **don't `clasp login` here.** Backend deploys run from a **cloud session**, where the `SessionStart` hook auto-wires auth from the `CLASPRC_JSON_B64` secret — so route any backend deploy there. (If you see `loggedIn:false` *in a cloud session*, the secret's empty → the session predates it → restart it.)
- **Playwright (browser gates) — runs in CI, NOT locally on this machine.** `ci/smoke.mjs` (boot check) and `ci/logic-test.mjs` (money + multi-unit regression) drive headless Chromium via Playwright (pinned `1.48.0`). **CI installs it fresh and runs both on every PR** — that's the source of truth, and why PRs are safe with nothing installed locally. A local install was attempted repeatedly and **fails on this desktop**: the Chromium extraction wedges (sandboxed → Playwright's lockfile starves on slow I/O; unsandboxed → exit 127), even after a Defender exclusion. **Don't burn time reinstalling it here — rely on CI** for the browser gates; only `node ci/gen-rule-usage.mjs --check` (no browser) runs locally. (A future machine that CAN run them: `npm install --no-save playwright@1.48.0 && npx playwright install chromium`, then swap the reserved port — `sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, `git checkout -- ci/`.)
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

### Hard rules — no exceptions
- **Questions → `AskUserQuestion` popup ONLY.** Every clarification, choice, or decision that is Jac's to make goes through the `AskUserQuestion` tool. NEVER ask questions inline in chat text. Not even small ones. Not even "does this look right?" — pop it up.
- **Designing or building a feature first? → `/brainstorming`.** When Jac wants to plan, design, or spec a feature BEFORE touching code ("what should we do about X?", "how should we approach Y?"), invoke `/brainstorming` to turn the rough idea into an approved design. Don't start coding a UI concept without a spec sign-off.
- **Any new or reshaped UI → two mandatory skills, in order:**
  1. **`/jactec-ui`** — the yard data-plate design language enforcer (dark steel, ONE safety-orange accent, hazard-stripe, Saira Condensed, rivets, R0–R24 rulebook). Governs every screen, card, column, pill, button, field, popup, menu, date picker, KPI ring. Run this first.
  2. **`/frontend`** — aesthetic direction, typography, avoiding AI defaults. Run after `/jactec-ui` frames the language. Together these two are the quality gate for every visual change.
  - Backend (`Code.gs`) changes, CI scripts, and pure logic are exempt from both.
- **R-Rulebook — stamp UI + keep `rule-usage.js` current.** Every new UI element gets a `data-r="Rxx"` attribute matching the rulebook. When rule usage changes, regenerate: `node ci/gen-rule-usage.mjs` (no `--check`). The `--check` flag is the CI gate — run `node ci/gen-rule-usage.mjs --check` before pushing; it fails on drift or duplicate rules. **Any new or reshaped UI keeps the R-Rulebook current — a hard rule (see CLAUDE.md → R-rulebook).** New popup windows also need a `WINDOW_CATALOG` entry, enforced by `node ci/check-window-catalog.mjs`.

### Working discipline
- **Token discipline:** terse by default; `Grep`/`Glob` before `Read`; read only the range you need; spawn subagents for large isolated work to protect the main context.
- **Model triage:** auto-delegate mechanical/bulk work (git/gh plumbing, grep sweeps, file munging, running scripts) to **Haiku** subagents and well-scoped implementation to **Sonnet** subagents; keep architecture, security/gates, and ambiguous calls on the main session. Full rule in `CLAUDE.md` → *Auto-delegation*. (You pick subagent models; you can't change your own.)
- **Specs:** after generating or changing a spec/feature/screen, offer to run `/role` to audit it through the 15 role lenses.
- **Something reported broken → `wrangler-fix` first.** Anything reported not-working or broken — an in-app `wrangler-fix`/`wrangler-request` issue OR Jac just saying it in-session — runs through the `wrangler-fix` skill before any code change: prove the claim against the canon (R-Rulebook, SPEC v8, docs, code) with citations, trace the symptom UP to its root cause, sweep for sibling bugs of the same class, fix only what's proven at the cause, then re-reproduce to confirm it failed-before/passes-after. No fix without a cited root cause.
- **Efficiency:** `/audit` is available anytime; the ~1M-token auto-audit hook will also prompt a coaching report.
- **Promotion cadence — propose the hops, never auto-promote to live:** when a task is *done*, offer to merge `<domain>/<task>` → `area/<domain>` (the merged task branch then self-cleans via the branch janitor). When Jac wants to preview/QA, merge `area/<domain>` → `staging` — the staging mirror auto-syncs (~10 min) for phone testing. **Then run the Staging E2E check (below) before calling it clean.** Only after Jac confirms it's clean on staging, open a PR `staging` → `main` (protected; CI). **`main` is live — promoting to it is always Jac's explicit call.**
- **Staging E2E — after a push to `staging`, DRIVE THE LIVE APP before declaring it clean (don't trust unit tests alone).** A skill can't auto-fire on a git push, so this is a **session-performed** step (a CI Playwright job could automate it later — Playwright runs fine in CI even though it won't install on this desktop). On each `area/<domain>` → `staging` merge:
  1. **Force the sync** so you exercise the new code, not stale: `gh workflow run sync-staging.yml --repo operations-jacrentals/rental-wrangler-staging` (Pages rebuilds ~1 min). Staging URL: `https://operations-jacrentals.github.io/rental-wrangler-staging/` ([[jactec-staging-url]]).
  2. **Drive it with Claude-in-Chrome** (the browser MCP — needs **no local install**, unlike Playwright, which won't install on this desktop): open the staging URL, log in (password from an env var like `$RW_PW` — **never hardcode or echo it**; no var set → you can only check the pre-login surface), then **exercise exactly what you built**, end-to-end, plus a known sanity flow — e.g., run a sample CSV through **Mr. Wrangler** and confirm the expected output, not merely that the page renders.
  3. **Assert it truly worked:** no console/page errors on boot, and the feature's visible result matches expectation. Save a screenshot for the handoff note.
  4. **A red E2E STOPs promotion** — surface it, fix on the task/area branch, re-sync, re-run. Only a green staging E2E earns the `staging` → `main` PR.
## 5. Ready summary
End with 3–4 lines: tools OK/missing, current branch + what's in flight, the proposed branch/folder (awaiting OK), and "what are we working on?"

## 6. Wrap-up — after shipping to `main`, or when the session winds down
- **Run `/tidy-sessions`.** After a PR merges to `main` (work shipped) — or as the session ends — invoke `/tidy-sessions` to sweep finished/stale chats. It lists candidates and archives only what Jac confirms; it never touches the current chat or open-PR work.
- **Mark THIS chat done.** A session can't archive itself mid-use, so tell Jac his work shipped and he can archive this chat on the way out — otherwise the next `/tidy-sessions` sweep catches it automatically once its task branch is gone (the branch janitor deletes merged task branches).
- **Handoff note.** Write a short note (what shipped, what's pending, which area branch) into the session-output folder so the next chat — local or cloud — picks up cleanly.

## Conventions reference
- **Branches:** work on an **`area/*`** branch (see `references/branch-map.md`) → merge to `staging` (preview/debug) → `staging` → `main` (`main` = live at app.jacrentals.com via GitHub Pages). `main` is protected: changes land via PR + CI.
- **Backend:** ships via `/clasp` (clasp), never git. `Code.gs`/`Code.js` are gitignored (public repo). In cloud sessions a `SessionStart` hook auto-wires clasp auth from the `CLASPRC_JSON_B64` env secret.
- **Sibling skills:** `/clasp` (backend deploy), `/role` (spec audit), `/audit` (token + model-fit coaching), `/tidy-sessions` (archive finished chats), `/brainstorming` (design/spec before building — invoke before touching UI code), `/jactec-ui` (yard data-plate design language — **mandatory** for any UI), `/frontend` (aesthetic direction — **mandatory** for any UI), `mobile-*`, `webapp-testing`, `wrangler-fix`.
- **At session end:** write a short handoff note (what changed, what's pending, which area branch) into the session folder so the next chat — local or cloud — picks up cleanly.
