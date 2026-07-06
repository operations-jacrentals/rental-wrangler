---
name: start
description: Jac Rentals session startup routine — run at the top of a session with /start. Probes the toolchain (node/npm/clasp/gh/git + Playwright), orients on the current git branch vs staging/main, recalls relevant memory, ROUTES the session to the right long-lived area branch (using the branch map, based on what you want to work on) and proposes a dated session-output folder — waiting for your OK before switching — then sets token-efficiency + role-aware working rules for the rest of the session.
---

# /start — Jac Rentals session startup

Run this first thing in a session. It gets the session organized so parallel chats and branches stop colliding, and primes Claude with the right tools, conventions, and discipline. Built for both local (Windows/PowerShell) and cloud (Linux) sessions.

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
# True = set; False = missing (Staging E2E login won't work)
```
- **clasp installed ≠ backend reachable — verify AUTH the right way.** Probe with clasp's own command, never by looking for a credentials file (clasp 3.x does **not** reliably use the old `~/.clasprc.json` path — guessing paths is exactly how sessions wrongly cry "no auth"):
  ```
  clasp --version                       # installed? (expect 3.x)
  clasp show-authorized-user --json     # authed?  -> {"loggedIn": true|false}
  ```
  (default user; if you use a named user or `--auth <file>`, pass the same flags to the check.)
  - **`loggedIn: true`** → creds *exist*, but that's **NOT proof they work** — the token can be expired + RAPT-blocked, and local `clasp pull` is broken (undici). To **deploy**, use `/clasp` (cloud; additive-only, STOPS before prod). To **read/diagnose** the backend locally, use the **Drive connector** (`/clasp` → "Reading the backend locally") — authed independently of clasp. Don't hunt for `~/.clasprc.json`.
  - **`loggedIn: false`** → **normal for a LOCAL session — clasp creds are cloud-provisioned, so the desktop has the tool but not the keys.** Don't treat it as broken, don't claim the backend is reachable, don't dig through `~/.clasprc.json`, and **don't `clasp login` here.** Backend deploys run from a **cloud session**, where the `SessionStart` hook auto-wires auth from the `CLASPRC_JSON_B64` secret — so route any backend deploy there. (If you see `loggedIn:false` *in a cloud session*, the secret's empty → the session predates it → restart it.)
  - **When a NEW clasp auth IS needed — hand Jac the URL, take the local URL back.** A fresh `clasp login` (e.g. provisioning new creds) can't open a browser from this environment, so run it `--no-localhost`: clasp prints an **auth URL** — **give that URL to Jac** so he can open it and authorize. After he approves, Google redirects to a **`http://localhost`** URL carrying the auth code; **have Jac paste that local URL back** so clasp finishes the handshake. The handoff is the whole point: URL out to Jac, local URL back from Jac. (Never echo the resulting token/creds.)
- **Playwright (browser gates) — runs in CI, NOT locally on this machine.** `ci/smoke.mjs` (boot check) and `ci/logic-test.mjs` (money + multi-unit regression) drive headless Chromium via Playwright (pinned `1.48.0`). **CI installs it fresh and runs both on every PR** — that's the source of truth, and why PRs are safe with nothing installed locally. A local install was attempted repeatedly and **fails on this desktop**: the Chromium extraction wedges (sandboxed → Playwright's lockfile starves on slow I/O; unsandboxed → exit 127), even after a Defender exclusion. **Don't burn time reinstalling it here — rely on CI** for the browser gates; only `node ci/gen-rule-usage.mjs --check` (no browser) runs locally. (A future machine that CAN run them: `npm install --no-save playwright@1.48.0 && npx playwright install chromium`, then swap the reserved port — `sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, `git checkout -- ci/`.)
- **Google Drive / Sheets — read the live data directly; don't ask Jac to paste it.** The Drive MCP tools (`search_files`, `read_file_content`, `list_recent_files`) reach this account's Drive, **including the Google Sheets that ARE the backend data** — e.g. **"Rental Wrangler — Live Database"** and **"Daily Category Report"** (owner operations@jacrentals.com). Use them whenever a task needs real data or its shape — the read-side complement to `/clasp` (which deploys the backend *code*). **PII guard:** the live DB holds real customer data — read-only for understanding; **NEVER** paste Drive/Sheets contents into the public repo, commits, seed files, or reports ([[jactec-real-data-migration]]).
- **Chrome (Claude-in-Chrome extension) — Claude can drive a real browser.** The Claude-in-Chrome MCP (`navigate`, `read_page`, `find`, `screenshot`, `list_connected_browsers`, …) controls a connected Chrome. Confirm one's attached with `list_connected_browsers`; if none, ask Jac to connect the extension. This powers the **Staging E2E** step (§4 — driving the live staging app) and any "go look at the real page" task.
- If a tool is missing, say so plainly — don't assume it's there.

## 2. Branch + status orientation
- Run: `git branch --show-current`, `git status -sb`, `git log --oneline -5`.
- Show how the current branch differs from the integration branch when available: `git diff --stat origin/staging...HEAD` (or vs `origin/main`).
- Recall memory: read `MEMORY.md` and surface anything relevant to this session's topic (e.g. `[[jactec-skill-build-plan]]`, `[[jactec-tooling]]`, `[[jactec-design-prefs]]`).

## 3. Route to a TASK BRANCH off the right area — DO NOT switch without an OK
The app is organized into long-lived **area branches** (`area/*`), each owning a domain. You do **not** work on an area branch directly — you branch a short-lived **task branch off it** (`<domain>/<task>`), so multiple sessions can work the SAME area in parallel without colliding. Flow: **`<domain>/<task>` → `area/<domain>` → `staging` (THE FINISH LINE) → `main` (explicit-only)**.

> **The current model (Jac, 2026-06-29 — supersedes the 2026-06-22 "staging is rare" rule):** **`staging` is the objective.** A piece of work is *done* when it's verified and merged to `staging` — that's where it lives and where Jac reviews it. **`main` is reached almost never, and ONLY when Jac explicitly says "push this to main."** Do not open a PR to `main`, not even a draft, by default. The everyday rhythm: pick an area → build → **self-verify (desktop + phone)** → **merge to `staging`** → send Jac screenshots → done. (History: the 2026-06-22 rule made staging a rare pre-main combined-debug bundle and ended a session's job at the area; that is no longer how we work.)
- Read **`references/branch-map.md`**, match what Jac described to the best-fitting area, and **PROPOSE a task branch** in one line (e.g. *"Invoicing work → branch `invoicing-payments/refund-rounding` off `area/invoicing-payments`?"*). **WAIT for his OK** before switching.
- On OK, start from current code (never stale):
  1. `git fetch origin`
  2. refresh the area base from the trunk: `git checkout area/<domain> && git merge --no-edit origin/main` (instant if untouched; a real merge if the area has work — **if it CONFLICTS, STOP and surface it**, don't guess), then `git push` the refreshed area.
  3. cut the task branch: `git checkout -b <domain>/<task>` and `git push -u origin <domain>/<task>`.
  4. Commit your work to the **task branch** and push there. Name it `<domain>/<task>`, NOT `area/<domain>/<task>` — git won't nest a branch under an existing branch's name.
- **SELF-VERIFY headless at TWO viewports — this is the primary gate before `staging` (Jac, 2026-06-29).** The cloud session can now **drive the app itself**, no local pull needed: install `playwright-core` ephemerally (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --no-save playwright-core` — `node_modules` is gitignored), serve the files on a port inside the container, and launch the pre-installed Chromium at **`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`**. Boot the app at **`/#local`** (demo mode — zero backend, see backend note) in **both** viewports and screenshot each:
  - **Desktop 1440×900** — assert the 3-column grid renders, no horizontal overflow, popups/menus work.
  - **Phone 390×844** (`isMobile:true, hasTouch:true`) — assert `is-phone` reflow, no h-scroll, tap targets ≥44px, sheets behave.
  - Catch `console` errors (ignore external-CDN `ERR_CONNECTION_CLOSED` for fonts/Stripe/Maps — same as `ci/smoke.mjs`). **Do NOT push to `staging` unless BOTH viewports are clean.**
  - **Send Jac the desktop + phone screenshots via `SendUserFile`** (reaches his phone) so he reviews from anywhere — this is the phone-first review loop. He's working from his phone; lead with images, not prose.
  > **Why this replaces "Jac pulls and serves locally":** the old rule said a cloud session can't hand Jac a browser URL, so Jac had to pull the branch and serve it himself. Headless self-verify removes that — the cloud session proves the screens itself and ships screenshots. The local-serve path below is still available when Jac wants to click around live, but it is no longer required for the gate.
  1. Save this server to a **gitignored scratch path** (e.g. the session-output folder — never commit it) as `serve.mjs`. **This runs on Jac's LOCAL machine** (or cloud, as a boot-smoke-check only — no browser URL from cloud):
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
  2. **On Jac's local machine:** pull the area branch (`git pull origin area/<domain>`), then from the repo root: `node <path>/serve.mjs` (**port 9147** — 8000 is reserved on this machine).
  3. Open `http://localhost:9147` and log in — password from **`$env:RW_PW`** (never hardcode or echo it; no var set → you can only check the pre-login surface). Then **exercise exactly the feature you built**, plus a sanity flow.
  - **Backend note (READ — staging shares prod today):** there is **one** GAS web app + Sheets DB, and `BACKEND_URL` (`app.js:15703`) is a single hardcoded URL — so **`staging` writes hit the SAME live customer data as `main`.** Therefore: **verify in `#local` DEMO mode** (zero backend, zero writes — covers all UI/logic/mobile/desktop). Demo mode is the default verification surface; it cannot test real sync/Stripe/SMS. **Planned (Jac, 2026-06-29, deferred until we need real-backend testing):** stand up an **isolated staging backend** (a 2nd GAS web app on a COPY of the Sheet, *or* a `mode:test` route to a separate test spreadsheet by id) **and** make `BACKEND_URL` **origin-aware** (pick prod-vs-staging backend by `location.hostname`) so the same committed code runs on both sites and `staging`→`main` is a clean no-edit merge. Until that lands, **do not exercise real backend writes from a staging build** — demo only. PII guard always applies: read live data for understanding; NEVER paste Drive/Sheets data into the repo/commits/seeds ([[jactec-real-data-migration]]).
  - Drive it with **Claude-in-Chrome** for an automated assertion (no local install needed), or just open it yourself.
- **Verify → merge to `staging` → send screenshots → done (Jac, 2026-06-29).** The moment a feature is built and passes the **two-viewport self-verify** (desktop + phone), run the CI gates, **merge it to `staging`**, do the §4 deploy steps (`?v=` bump + force the mirror re-sync + confirm live bytes), and **send Jac the desktop + phone screenshots + the staging URL**. That IS the finish line — the work now lives on staging where Jac reviews it. If Jac wants changes, loop on the same branch and re-verify; when he's happy, the task branch self-cleans via the janitor and the chat can close.
- **`main` is explicit-only — almost never.** Do **not** open a PR to `main` (not even a draft) on your own. `staging` is long-lived and accumulates finished work. `main` is touched **only** when Jac explicitly says "push this to `main`" — then, and only then, open **one** `staging`→`main` PR (protected; required CI `smoke` check), bump `?v=`, and let **Jac tap the squash-merge**. Promotion to `main` is always his call, often days/weeks apart.
- If two areas overlap, name both and let Jac pick (`AskUserQuestion`). If **nothing** fits, propose a NEW `area/<slug>` off `staging`, then a task branch off that.
- Also offer a session-output folder `<YYYY-MM-DD> <Topic>/` (git-ignored; OUTPUTS only — never source). Use today's date.
- If the topic isn't clear yet, defer until the first real task is defined — don't branch blind.

## 4. Working rules for this session (state briefly, then follow)

### Hard rules — no exceptions
- **Questions → `AskUserQuestion` popup ONLY.** Every clarification, choice, or decision that is Jac's to make goes through the `AskUserQuestion` tool. NEVER ask questions inline in chat text. Not even small ones. Not even "does this look right?" — pop it up.
- **Designing or building a feature first? → `/brainstorming`.** When Jac wants to plan, design, or spec a feature BEFORE touching code ("what should we do about X?", "how should we approach Y?"), invoke `/brainstorming` to turn the rough idea into an approved design. Don't start coding a UI concept without a spec sign-off.
- **Any new or reshaped UI → `/jactec-ui`** — the single design skill and quality gate for every visual change. It's the yard data-plate design language enforcer (dark steel, ONE safety-orange accent, hazard-stripe, Saira Condensed, rivets, R0–R24 rulebook) and governs every screen, card, column, pill, button, field, popup, menu, date picker, KPI ring. It now also carries the four folded sub-capabilities — **aesthetic direction / typography** (former `/frontend`), **mobile** reflow/viewport/touch (former `mobile-*`), **DESIGN.md** scaffold/lint (former `/design-md`), and the **`/role` audit** — each behind its own reference + section. Backend (`Code.gs`) changes, CI scripts, and pure logic are exempt.
- **R-Rulebook — stamp UI + keep `rule-usage.js` current.** Every new UI element gets a `data-r="Rxx"` attribute matching the rulebook. When rule usage changes, regenerate: `node ci/gen-rule-usage.mjs` (no `--check`). The `--check` flag is the CI gate — run `node ci/gen-rule-usage.mjs --check` before pushing; it fails on drift or duplicate rules. **Any new or reshaped UI keeps the R-Rulebook current — a hard rule (see CLAUDE.md → R-rulebook).** New popup windows also need a `WINDOW_CATALOG` entry, enforced by `node ci/check-window-catalog.mjs`.

### Working discipline
- **Token discipline:** terse by default; `Grep`/`Glob` before `Read`; read only the range you need; spawn subagents for large isolated work to protect the main context.
- **Find code map-first (the Code Atlas).** To source/find/edit/debug code, use **`/atlas`** — open `docs/CODE-MAP.md` (the narrated chapter map + reverse index) and jump to the `file:line` instead of grepping the 15.7k-line `app.js` blind. Every `app.js` chapter is stamped `APP-NN` (e.g. `grep APP-19` → the Shop card). When you add/move/retitle a chapter, regenerate the index: `node tools/gen-code-map.mjs` (the `--check` is a gate). `docs/dead-code-report.md` lists unreferenced-symbol candidates.
- **Model triage:** auto-delegate mechanical/bulk work (git/gh plumbing, grep sweeps, file munging, running scripts) to **Haiku** subagents and well-scoped implementation to **Sonnet** subagents; keep architecture, security/gates, and ambiguous calls on the main session. Full rule in `CLAUDE.md` → *Auto-delegation*. (You pick subagent models; you can't change your own.)
- **Specs:** after generating or changing a spec/feature/screen, offer to run the `/role` audit (now folded into `/jactec-ui` — § "The /role audit") to review it through the 15 role lenses.
- **Something reported broken → `wrangler-fix` first.** Anything reported not-working or broken — an in-app `wrangler-fix`/`wrangler-request` issue OR Jac just saying it in-session — runs through the `wrangler-fix` skill before any code change: prove the claim against the canon (R-Rulebook, SPEC v8, docs, code) with citations, trace the symptom UP to its root cause, sweep for sibling bugs of the same class, fix only what's proven at the cause, then re-reproduce to confirm it failed-before/passes-after. No fix without a cited root cause.
- **Efficiency:** `/audit` is available anytime; the ~1M-token auto-audit hook will also prompt a coaching report.
- **Promotion cadence — `staging` is the finish line; `main` is explicit-only (Jac, 2026-06-29):** build a feature → **self-verify headless at desktop + phone** (§3, `#local` demo) + run CI gates → **merge to `staging`** with the §4 deploy steps → **send Jac the screenshots**. That's done. **Never** push or PR to `main` on your own — `main` is touched only on Jac's explicit "push to main," via one `staging`→`main` PR he squash-merges himself. (Backend `/clasp` deploys keep their STOP gate regardless.)
- **Staging deploy + E2E — runs on EVERY merge to `staging` now that staging is the finish line (Jac, 2026-06-29).** After the headless desktop+phone self-verify (§3) and CI gates pass, merge to `staging` and do these deploy steps so the live staging site actually serves the new code. Driving the **live** staging URL (Claude-in-Chrome) is an optional extra confidence pass on top of the headless self-verify — do it when the change is interactive/backend-touching enough to warrant it. A skill can't auto-fire on a git push, so this is a **session-performed** step. On each merge to `staging`:
  1. **Bump the shared `?v=` cache token** first — check what staging has: `git show origin/staging:index.html | grep '?v='`. Set a value *newer* than that. (A same-token file swap stays cached ~10 min; skipping this has burned us before.)
  2. **Force the sync** so you exercise the new code, not stale: `gh workflow run sync-staging.yml --repo operations-jacrentals/rental-wrangler-staging` (Pages rebuilds ~1 min). Then **verify the LIVE site serves the new bytes** (`curl -s https://operations-jacrentals.github.io/rental-wrangler-staging/app.js | grep <new-only marker>`). The mirror can serve an OLD file under a NEW token — only a re-sync fixes it. Staging URL: `https://operations-jacrentals.github.io/rental-wrangler-staging/` ([[jactec-staging-url]]).
  3. **Drive it with Claude-in-Chrome** (the browser MCP — needs **no local install**, unlike Playwright, which won't install on this desktop): open the staging URL, log in (password from an env var like `$RW_PW` — **never hardcode or echo it**; no var set → you can only check the pre-login surface), then **exercise exactly what you built**, end-to-end, plus a known sanity flow — e.g., run a sample CSV through **Mr. Wrangler** and confirm the expected output, not merely that the page renders.
  4. **Assert it truly worked:** no console/page errors on boot, and the feature's visible result matches expectation. Save a screenshot for the handoff note.
  5. **A red E2E means it's not done** — surface it, fix on the task/area branch, re-merge to `staging`, re-sync, re-run. Only a green staging state earns the "send Jac the screenshots → done" finish (and, later and only on his explicit call, a `staging`→`main` PR).
## 5. Ready summary
End with 3–4 lines: tools OK/missing, current branch + what's in flight, the proposed branch/folder (awaiting OK), and "what are we working on?"

## 6. Wrap-up — when a feature is archived (§3 fork), after shipping to `main`, or when the session winds down
- **A feature is DONE once it's verified and merged to `staging`** (Jac, 2026-06-29) — not at `main`. When the desktop+phone self-verify passes, it's merged to `staging`, the live staging site serves it, and Jac has the screenshots, the session's work is complete even though `main` won't move (often for days/weeks, and only on his explicit call). Close it then — don't keep it open waiting on a `main` promotion that isn't coming by default.
- **Run `/tidy-sessions`.** After a feature is archived, a PR merges to `main`, or the session ends — invoke `/tidy-sessions` to sweep finished/stale chats. It lists candidates and archives only what Jac confirms; it never touches the current chat or open-PR work.
- **Mark THIS chat done.** A session can't archive itself mid-use, so tell Jac his work shipped and he can archive this chat on the way out — otherwise the next `/tidy-sessions` sweep catches it automatically once its task branch is gone (the branch janitor deletes merged task branches).
- **Handoff note.** Write a short note (what shipped, what's pending, which area branch) into the session-output folder so the next chat — local or cloud — picks up cleanly.

## Conventions reference
- **Branches:** task branch `<domain>/<task>` off **`area/*`** (see `references/branch-map.md`) → merge to its area and **test LOCALLY** (`node serve.mjs` → `localhost:9147`, log in with `$RW_PW`) → **continue-or-archive fork** → areas accumulate finished work → promote **chosen** area(s) to `staging` (combined final debug) → **one** PR `staging` → `main` (`main` = live at app.jacrentals.com via GitHub Pages, protected, PR + CI). Staging is the *promotion* surface, not the per-feature test surface; sessions never push to `main` individually.
- **Backend:** ships via `/clasp` (clasp), never git. `Code.gs`/`Code.js` are gitignored (public repo). In cloud sessions a `SessionStart` hook auto-wires clasp auth from the `CLASPRC_JSON_B64` env secret.
- **Sibling skills:** `/clasp` (backend deploy), `/audit` (token + model-fit coaching), `/tidy-sessions` (archive finished chats), `/brainstorming` (design/spec before building — invoke before touching UI code), `/jactec-ui` (**the single design skill — mandatory for any UI**; absorbed the former `/frontend` aesthetic direction, the `mobile-*` skills, `/design-md`, and the `/role` spec audit), `webapp-testing`, `wrangler-fix`.
- **At session end:** write a short handoff note (what changed, what's pending, which area branch) into the session folder so the next chat — local or cloud — picks up cleanly.
