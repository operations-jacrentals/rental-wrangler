---
name: start
description: Jac Rentals session startup routine — run at the top of a session with /start. Probes the toolchain (node/npm/clasp/gh/git + Playwright), orients on the current git branch vs the trunk (trunk), recalls relevant memory, proposes a short feature branch (or git worktree) off the trunk and a dated session-output folder — waiting for your OK before switching — then sets token-efficiency + role-aware working rules for the rest of the session.
---

# /start — Jac Rentals session startup

Run this first thing in a session. It gets the session organized, orients you on the **trunk-based** dev flow, and primes Claude with the right tools, conventions, and discipline. Built for both local (Windows/PowerShell) and cloud (Linux) sessions.

## 1. Toolchain probe
Run and report a short table — node, npm, clasp, gh, git, PowerShell, and env secrets:
```
node --version; npm --version; clasp --version; gh --version; git --version
$PSVersionTable.PSVersion.ToString()
```
Also check that the app password secret is present (do NOT echo it):
```powershell
[Environment]::GetEnvironmentVariable("RW_PW", "User") -ne $null -and `
[Environment]::GetEnvironmentVariable("RW_PW", "User") -ne ""
# True = set; False = missing (Staging review login won't work)
```
- **`RW_PW` is an environment SECRET — never a repo value.** It's the team/staging login
  password, and that login gates the live GAS + Sheets backend and its **real customer PII**,
  so it lives ONLY as an environment variable: set it in the cloud environment's settings
  alongside `STAGING_DEPLOY_PAT` / `GAS_SA_KEY_B64` (on a local Windows box, a User env var).
  If the check above prints missing/`False`, the staging-review login can't run this session —
  add it there, don't work around it. **NEVER** hardcode or echo the value: the repo is public
  via Pages, so a password committed to it (even in a skill file) is a permanent PII leak.
- **Backend deploy auth = check `GAS_SA_KEY_B64`, NOT clasp (Jac, 2026-07-06 — clasp's OAuth is currently broken).** Confirmed: even a **brand-new** clasp token, minted fresh in a **cloud** session, fails `invalid_grant / invalid_rapt` immediately — this is a Google Workspace re-auth policy on the `cloud-platform` scope, enforced server-side per call, and no amount of re-`clasp login`-ing fixes it. **Do not re-attempt `clasp login` as a troubleshooting step** — it will not work until the Workspace admin changes that policy.
  ```bash
  [ -n "$GAS_SA_KEY_B64" ] && echo "service-account deploy: READY" || echo "service-account deploy: NOT SET (backend deploys blocked)"
  clasp --version   # informational only — clasp itself is NOT the deploy path right now
  ```
  - **`GAS_SA_KEY_B64` set** → backend **pushes** are reachable via the **service-account path**: `docs/handoffs/gas-deploy-service-account.mjs` with `GAS_IMPERSONATE_SUBJECT=operations@jacrentals.com` (domain-wide delegation — a bare SA 403s "User has not enabled the Apps Script API"). **`push` only — the go-live deploy is done in the Apps Script EDITOR by Jac** (a REST-API deploy breaks the web app's anonymous access and takes the live backend DOWN — confirmed 2026-07-06; the script's `deploy` subcommand is now guarded against this). **Full runbook + queue status: `docs/handoffs/BACKEND-DEPLOY-QUEUE.md`.** `/clasp` has the full detail; same STOP-gate before push, and the go-live editor click is Jac's.
  - **`GAS_SA_KEY_B64` not set** → backend deploys are blocked this session. Say so plainly; don't fall back to clasp (it will fail) and don't hunt for `~/.clasprc.json`. Reading `Code.gs` (diagnosis only) still works via the Drive connector regardless — see `/clasp` → "Reading the backend locally."
  - `clasp show-authorized-user --json` saying `loggedIn:true` proves a creds *file* exists — it is **not** proof a deploy will work. Don't treat it as the readiness signal anymore.
- **Playwright (browser gates) — runs in CI, NOT locally on this machine.** `ci/smoke.mjs` (boot check) and `ci/logic-test.mjs` (money + multi-unit regression) drive headless Chromium via Playwright (pinned `1.48.0`). **CI installs it fresh and runs both on every PR** — that's the source of truth, and why PRs are safe with nothing installed locally. A local install was attempted repeatedly and **fails on this desktop**: the Chromium extraction wedges (sandboxed → Playwright's lockfile starves on slow I/O; unsandboxed → exit 127), even after a Defender exclusion. **Don't burn time reinstalling it here — rely on CI** for the browser gates; only `node ci/gen-rule-usage.mjs --check` (no browser) runs locally. (A future machine that CAN run them: `npm install --no-save playwright@1.48.0 && npx playwright install chromium`, then swap the reserved port — `sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, `git checkout -- ci/`.)
- **Google Drive / Sheets — read the live data directly; don't ask Jac to paste it.** The Drive MCP tools (`search_files`, `read_file_content`, `list_recent_files`) reach this account's Drive, **including the Google Sheets that ARE the backend data** — e.g. **"Rental Wrangler — Live Database"** and **"Daily Category Report"** (owner operations@jacrentals.com). Use them whenever a task needs real data or its shape — the read-side complement to `/clasp` (which deploys the backend *code*). **PII guard:** the live DB holds real customer data — read-only for understanding; **NEVER** paste Drive/Sheets contents into the public repo, commits, seed files, or reports ([[jactec-real-data-migration]]).
- **Chrome (Claude-in-Chrome extension) — Claude can drive a real browser.** The Claude-in-Chrome MCP (`navigate`, `read_page`, `find`, `screenshot`, `list_connected_browsers`, …) controls a connected Chrome. Confirm one's attached with `list_connected_browsers`; if none, ask Jac to connect the extension. This powers the **staging review** step (§3 — driving the running staging app) and any "go look at the real page" task.
- If a tool is missing, say so plainly — don't assume it's there.

## 2. Branch + status orientation
- Run: `git branch --show-current`, `git status -sb`, `git log --oneline -5`.
- Show how the current branch differs from the trunk: `git diff --stat origin/trunk...HEAD`.
- Recall memory: read `MEMORY.md` (Decisions · Design prefs · Gotchas · Open threads) and surface anything relevant to this session's topic. It's the git-committed cross-session memory, so it's current even in a fresh cloud clone.
- **The SessionStart hook already oriented you.** It ran `tools/branch-preflight.mjs` (report-only) — a live `git ls-remote` — and printed where you sit relative to the trunk (`trunk`) and `production`. Read its report; don't re-derive branch state from a shallow clone's stale local refs.

### 2b. Docs are on the trunk — no spec-sync anymore
- The SessionStart hook already ran `node tools/branch-preflight.mjs` (report-only). There's nothing to `--ensure` now — the trunk model has no shared `staging`/`master-spec` branches to create.
- **Docs live on the trunk.** Specs, plans, and decisions are in `docs/` on `trunk` — just `git pull` (or fetch `origin/trunk`) to see the latest. The old `spec-sync` / `master-spec` cross-branch sync is retired; don't run it, and don't arm any ~2h spec-sync self-timer.

## 3. Cut a SHORT feature branch off the trunk — DO NOT switch without an OK
The app uses **trunk-based development**: one trunk (`trunk`), short-lived **feature branches** cut off it, merged the same day and deleted. There is no per-area routing anymore.
- **Propose a short feature branch** in one line (e.g. *"Invoicing refund rounding → branch `claude/refund-rounding` off `trunk`?"*). For a **parallel** session, propose a git **worktree** instead (`claude --worktree <task>`) — isolation without divergence. **WAIT for his OK** before switching.
- On OK, start from the latest trunk:
  1. `git fetch origin trunk`
  2. `git checkout -b claude/<task> origin/trunk`
  3. Commit your work to the feature branch and push there.
- **The two-gate deploy loop** (build → review → integrate → wait → go-live) — both gates run on Jac's say-so:
  1. **Deploy to staging** — run the **`/deploy` skill** (wraps `node tools/deploy-staging.mjs`) to push your feature branch's site files to the staging repo; Jac reviews the running app at the staging URL (`https://operations-jacrentals.github.io/rental-wrangler-staging/` — [[jactec-staging-url]]). The script now **curl-verifies the live staging bytes and exits non-zero if staging didn't actually update** (a "pushed" is not a "served"). A failed or unverified deploy is a **HARD STOP** — see the working-rules bullet; never work around it.
  2. **Gate 1 — "merge it"** — run the **`/merge` skill** (local gates → PR to `trunk` → `smoke` CI → squash-merge → delete branch). Integrated on the trunk but **NOT live** (Pages serves the `production` release-pointer branch). `/merge` runs `/deploy` first if the feature wasn't deployed/reviewed — the three gates (`/deploy → /merge → /promote`) each backfill the earlier steps.
  3. **Wait** — as long as Jac likes; the trunk holds blessed-but-not-live work.
  4. **Gate 2 — "promote it"** — run the **`/promote` skill** (wraps `node tools/promote.mjs` — bare first for a read-only preview, then `--yes`) to fast-forward `production` to the approved `trunk` commit → app.jacrentals.com goes live. **`promote.mjs` now REFUSES to promote unless the live staging `?v=` matches the trunk commit being promoted** — so staging can never fall behind production; a stale-staging promote is blocked (deliberate override only: `--skip-staging-check`, prints loud). This is the ONLY step that changes the live site; it is fast-forward-only and **always Jac's explicit call.**
- **Big replacements ride behind a `FEATURES` flag** in `config.js` (`flagOn()` reader) so backing out is a runtime toggle, not code surgery. (A flag hides execution, not source, on a public Pages site — never gate a secret/auth check on it.)
- **The old `area/*` branches are FROZEN legacy — don't build on them.** ~19 `area/*` branches remain from the previous workflow; they're dormant (kept, not deleted — they carry large unaudited divergence and some hold live content, so a "what's stranded" audit precedes any cleanup). New work is always a feature branch off the trunk. `references/branch-map.md` is kept only as a **domain reference** (which domain owns which surface), not a routing target.
- **Optional quick local look.** To eyeball your working tree before a staging deploy, serve it statically on `localhost:9147` (8000 is reserved). It's the dev-loop version of what `ci/smoke.mjs` does (a static server), minus Playwright:
  > **Cloud session vs. local machine — read this first.** When Claude Code runs in the web/cloud environment (`CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE=cloud_default`), the static server starts inside the cloud container but the port is **NOT proxied** to Jac's browser — `http://localhost:9147` from a cloud session is unreachable. Detect with: `echo $CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE` (prints `cloud_default` = cloud, blank/other = local). From a cloud session, the real review surface is the **staging URL** (deploy-staging above); local serving is only a boot-smoke-check (`curl -s http://localhost:9147 | head -3`), never a browser URL for Jac.
  1. Save this server to a **gitignored scratch path** (e.g. the session-output folder — never commit it) as `serve.mjs`:
     ```js
     import { createServer } from 'http';
     import { readFile } from 'fs/promises';
     import { extname, join, normalize } from 'path';
     const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
       '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
       '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2', '.woff':'font/woff' };
     const ROOT = process.cwd();
     createServer(async (q, s) => {
       try {
         let p = decodeURIComponent(q.url.split('?')[0]);
         if (p === '/') p = '/index.html';
         const safe = normalize(p).replace(/^(\.\.[\/\\])+/, '');
         const file = join(ROOT, safe);
         const data = await readFile(file);
         s.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
         s.end(data);
       } catch { s.writeHead(404); s.end('Not found'); }
     }).listen(9147, () => console.log('serving on http://localhost:9147'));
     ```
  2. `node <path>/serve.mjs`, open `http://localhost:9147`, log in — password from **`$env:RW_PW`** (never hardcode or echo it; no var set → you can only check the pre-login surface). Then **exercise exactly the feature you built**, plus a sanity flow. Drive it with **Claude-in-Chrome** for an automated assertion (no local install needed), or just open it yourself.
  - **Backend note:** local hits the SAME single GAS web app + Sheets DB that staging and production use (`app.js` → `BACKEND_URL`), gated by the team password — so local testing is **no riskier with real data than staging**. PII guard still applies: read for understanding; NEVER paste Drive/Sheets data into the repo/commits/seeds ([[jactec-real-data-migration]]).
- Also offer a session-output folder `<YYYY-MM-DD> <Topic>/` (git-ignored; OUTPUTS only — never source). Use today's date.
- If the topic isn't clear yet, defer until the first real task is defined — don't branch blind.

## 4. Working rules for this session (state briefly, then follow)

### Hard rules — no exceptions
- **Questions → popup-first, single-attempt (Jac, 2026-07-16).** Route **every** decision and question through the `AskUserQuestion` popup — try it **exactly once**. If that one popup fails, do **NOT** retry it; fall back to **inline**, presenting the same question and the same options as lettered choices (**A / B / C … + Other**) in a crisp structured block. This supersedes the 2026-07-15 hybrid rule. (Artifacts still *show* anything comparative/visual; the popup — or its inline fallback — is how you *ask*.)
- **Designing or building a feature first? → `/brainstorming`.** When Jac wants to plan, design, or spec a feature BEFORE touching code ("what should we do about X?", "how should we approach Y?"), invoke `/brainstorming` to turn the rough idea into an approved design. Don't start coding a UI concept without a spec sign-off.
- **Any new or reshaped UI → `/jactec-ui`** — the single design skill and quality gate for every visual change. It's the yard data-plate design language enforcer (dark steel, ONE safety-orange accent, hazard-stripe, Saira Condensed, rivets, R0–R24 rulebook) and governs every screen, card, column, pill, button, field, popup, menu, date picker, KPI ring. It now also carries the four folded sub-capabilities — **aesthetic direction / typography** (former `/frontend`), **mobile** reflow/viewport/touch (former `mobile-*`), **DESIGN.md** scaffold/lint (former `/design-md`), and the **`/role` audit** — each behind its own reference + section. Backend (`Code.gs`) changes, CI scripts, and pure logic are exempt.
- **R-Rulebook — stamp UI + keep `rule-usage.js` current.** Every new UI element gets a `data-r="Rxx"` attribute matching the rulebook. When rule usage changes, regenerate: `node ci/gen-rule-usage.mjs` (no `--check`). The `--check` flag is the CI gate — run `node ci/gen-rule-usage.mjs --check` before pushing; it fails on drift or duplicate rules. **Any new or reshaped UI keeps the R-Rulebook current — a hard rule (see CLAUDE.md → R-rulebook).** New popup windows also need a `WINDOW_CATALOG` entry, enforced by `node ci/check-window-catalog.mjs`.

### Working discipline
- **Token discipline:** terse by default; `Grep`/`Glob` before `Read`; read only the range you need; spawn subagents for large isolated work to protect the main context.
- **Find code map-first (the Code Atlas).** To source/find/edit/debug code, use **`/atlas`** — open `docs/CODE-MAP.md` (the narrated chapter map + reverse index) and jump to the `file:line` instead of grepping the huge `app.js` blind. Every `app.js` chapter is stamped `APP-NN` (e.g. `grep APP-19` → the Shop card). When you add/move/retitle a chapter, regenerate the index: `node tools/gen-code-map.mjs` (the `--check` is a gate). `docs/dead-code-report.md` lists unreferenced-symbol candidates.
- **Delegate by cost-of-being-wrong AND whether the main thread needs the intermediate reasoning (Jac, 2026-07-15) — not blindly always.** Most well-scoped, independent units of work (research, a grep/atlas sweep, an isolated bug fix, a scoped implementation, git/gh plumbing, running a script and reporting output) go to a **background** `Agent` subagent — it keeps the main thread free for Jac's next message and burns far fewer tokens. But delegation has costs (latency, lost nuance), so keep on the main session what the *Delegation & model triage* guard rails forbid delegating: authoring/revising specs, security/auth/data-gate calls, cross-system architecture, irreversible ops, and anything that already resisted ≥2 fixes.
  - **For every delegated task, pick the cheapest model that fits the risk of being wrong** (Haiku → mechanical/IO; Sonnet → well-scoped implementation against a settled spec; Opus → escalate only for a hard sub-problem) per `CLAUDE.md` → *Delegation & model triage*. Default to background agents (`run_in_background: true`, the `Agent` tool's default) so the main chat stays free; only run one in the foreground when its result must land before the next step.
  - **Always tell Jac, in one line, which agent + model you assigned and why**, before or as you launch it — e.g. *"Delegating the branch cleanup to a Haiku subagent (pure git plumbing) — running in the background."* This is a hard rule, not a courtesy: Jac should never have to guess where a model tier landed.
  - Independent delegable tasks go in a single message with multiple `Agent` calls so they run concurrently; a repeating mechanical step across many similar items goes to parallel agents (or a `Workflow` when opted in) instead of a manual loop.
- **Model triage:** auto-delegate mechanical/bulk work (git/gh plumbing, grep sweeps, file munging, running scripts) to **Haiku** subagents and well-scoped implementation to **Sonnet** subagents; keep architecture, security/gates, and ambiguous calls on the main session. Full rule in `CLAUDE.md` → *Delegation & model triage*. (You pick subagent models; you can't change your own.)
- **Specs:** after generating or changing a spec/feature/screen, offer to run the `/role` audit (now folded into `/jactec-ui` — § "The /role audit") to review it through the 15 role lenses.
- **Something reported broken → `wrangler-fix` first.** Anything reported not-working or broken — an in-app `wrangler-fix`/`wrangler-request` issue OR Jac just saying it in-session — runs through the `wrangler-fix` skill before any code change: prove the claim against the canon (R-Rulebook, SPEC v8, docs, code) with citations, trace the symptom UP to its root cause, sweep for sibling bugs of the same class, fix only what's proven at the cause, then re-reproduce to confirm it failed-before/passes-after. No fix without a cited root cause.
- **Efficiency:** `/audit` is available anytime; the ~1M-token auto-audit hook will also prompt a coaching report.
- **Ship cadence — propose the gates, never auto-promote to live.** Build on the feature branch, then: **deploy to staging** (`deploy-staging.mjs`) for Jac's review → on **"merge it"** run the local gate set + PR to `trunk` + CI (`smoke`) + squash-merge (Gate 1, integrated but not live) → **wait** → on **"promote it"** run `promote.mjs` (Gate 2, `trunk → production`). **`production` is live at app.jacrentals.com — promoting is ALWAYS Jac's explicit call**, and the only step that changes the live site. Big replacements ride behind a `FEATURES` flag so a swap can be backed out with a toggle.
- **Staging review — DRIVE THE RUNNING APP before "merge it" (don't trust unit tests alone).** After `deploy-staging.mjs` pushes your feature to the staging repo, verify the live staging site serves the new bytes (`curl -s https://operations-jacrentals.github.io/rental-wrangler-staging/index.html | grep <the new ?v= token deploy-staging printed>`), then drive it with **Claude-in-Chrome** (needs **no local install**, unlike Playwright): open the staging URL, log in (password from `$RW_PW` — **never hardcode or echo it**), and **exercise exactly what you built** end-to-end plus a known sanity flow — e.g. run a sample CSV through **Mr. Wrangler** and confirm the expected output, not merely that the page renders. No console/page errors on boot; the feature's visible result matches expectation; save a screenshot for the handoff. A red review STOPs the merge — fix on the feature branch, redeploy, re-check. `deploy-staging.mjs` is a direct push (no cron), so the staging URL updates within ~1 min.
- **A failed or unverified staging deploy is a HARD STOP — never work around it (learned 2026-07-13, the day staging silently drifted behind while a dead `STAGING_DEPLOY_PAT` made every deploy fail).** If `deploy-staging.mjs` errors (expired PAT, network, wrong repo/branch) or its live-bytes check can't confirm the new `?v=` on the staging URL, then **staging is stale and the review gate is BROKEN**. Do **NOT**: swap in a local `#local` render *as* the review, proceed to "merge it", or allow a "promote it" — **staging behind production defeats the entire two-gate workflow.** STOP and surface the failure to Jac so the credential/host gets fixed; a local render may *supplement* the staging review but NEVER *replace* it without Jac's explicit, flagged OK to skip the gate this once. The tooling now enforces this so it can't be fudged: `deploy-staging.mjs` exits non-zero if the live bytes don't update, and `promote.mjs` refuses to promote unless the live staging `?v=` matches the trunk commit being promoted (deliberate override only: `--skip-staging-check`).

## 5. Ready summary
End with 3–4 lines: tools OK/missing, current branch + what's in flight, the proposed feature branch/folder (awaiting OK), and "what are we working on?"

## 6. Wrap-up — when a feature ships, or when the session winds down
- **Report shipped-state plainly.** Say what's **merged to the trunk** (`trunk`, integrated but maybe not live) vs **promoted to production** (live) vs **still pending / uncommitted**, so a session never ends in a fuzzy "did this actually ship?" state.
- **Catch loose work before it's lost.** Scan the session for ideas, half-done threads, or follow-ups worth keeping and **park each on its own branch** so closing the chat never drops a good idea or unfinished piece.
- **Don't archive if anything's pending.** If work is parked, uncommitted, or awaiting a promote, say so and stop — don't sweep it away.
- **Run `/end`** only as the LAST step, once the above are clean — it reports shipped-state, catches loose work (parks it on its own branch), then archives finished/stale chats. Replaces `/tidy-sessions`. It never touches the current chat or open-PR work.
- **Handoff note.** Write a short note (what shipped, what's pending, which feature branch) into the session-output folder so the next chat — local or cloud — picks up cleanly.

## Conventions reference
- **Branches (trunk-based):** cut a short feature branch `claude/<task>` (or a `claude --worktree <task>`) off **`trunk`** → build → `deploy-staging.mjs` → review on the staging URL → **"merge it"** (PR → `smoke` CI → squash-merge to `trunk`, integrated but NOT live) → **wait** → **"promote it"** (`promote.mjs` fast-forwards `production`; app.jacrentals.com goes live — Jac's explicit call only). `trunk` is the trunk (protected, PR + CI); `production` is the release pointer Pages serves. The ~19 `area/*` branches are frozen legacy, not routing targets (`references/branch-map.md` is now just a domain reference).
- **Backend:** ships via `/clasp`, never git. `Code.gs`/`Code.js` are gitignored (public repo). **Deploy auth is currently the service account (`GAS_SA_KEY_B64` + `docs/handoffs/gas-deploy-service-account.mjs`), not clasp OAuth** — clasp's `CLASPRC_JSON_B64` path is RAPT-blocked as of 2026-07-06 (see `/clasp`). Full runbook + queue: `docs/handoffs/BACKEND-DEPLOY-QUEUE.md`.
- **Sibling skills:** `/clasp` (backend deploy), `/audit` (token + model-fit coaching), `/end` (close out: report shipped-state, park loose work, archive finished chats — replaces `/tidy-sessions`), `/brainstorming` (design/spec before building — invoke before touching UI code), `/jactec-ui` (**the single design skill — mandatory for any UI**; absorbed the former `/frontend` aesthetic direction, the `mobile-*` skills, `/design-md`, and the `/role` spec audit), `webapp-testing`, `wrangler-fix`.
- **At session end:** write a short handoff note (what changed, what's pending, which feature branch) into the session folder so the next chat — local or cloud — picks up cleanly.
