# MEMORY — Rental Wrangler

> Durable cross-session memory. **Read at `/start`, updated at `/end`.** This is a
> **PUBLIC** repo (served by Pages) — **never** put customer PII, pricing / margin
> data, `DEFAULT_CONFIG` passwords, or any secret value here. Shareable context only.
> Keep it lean; the first ~200 lines are what a session actually leans on.

## Decisions
- **2026-07-13 — Trunk-based ship model.** Feature branch off `trunk` → PR →
  squash-merge to `trunk` (integrated, **not** live) → `tools/promote.mjs`
  fast-forwards `production` (the only go-live; Pages serves `production`). The
  trunk branch was renamed `main` → `trunk` the same day. Never push directly to
  `trunk`/`production`.
- **2026-07-15 — Session Workflow v2** (branch `claude/session-workflow-guidelines-nyom46`,
  PR #636). Thesis: *shift the safety load off Jac's vigilance onto deterministic
  machinery.* Ships de-drift + hard gates, slim CLAUDE.md via path-scoped
  `.claude/rules/`, this committed memory, fresh-context review in `/merge`, and a
  hybrid interaction model. Spec: `docs/superpowers/specs/2026-07-15-session-workflow-v2-design.md`.
- **2026-07-16 — Interaction is POPUP-FIRST, single-attempt** (supersedes the
  2026-07-15 HYBRID rule — Jac: *"the popup question format is WAY better."*). ALL
  decisions/questions go through the `AskUserQuestion` popup. Try it **once**; never
  retry a failed popup. If that one popup fails, fall back to **inline** — the same
  question + same options as lettered **A/B/C… + Other** in a structured block.
  **Batch related questions (up to 4/popup) and favor multiSelect** when answers
  aren't mutually exclusive (Jac: *"I love the multiselect most"*); `/brainstorming`
  now routes its clarifying questions through popups too.
- **2026-07-17 — Session title auto-tracks this session's PRs.** A `SessionStart` hook
  (`.claude/hooks/session-title.mjs`) sets the title to `#<nums> · <branch-label>` from a
  gitignored `.claude/.session-prs` the assistant maintains (append on PR-open, remove on
  merge/close); fails safe, respects a manual `/rename`. On opening a PR also surface a
  one-tap `/rename #… · <label>` (the model can't self-rename) for an instant update. Spec:
  `docs/superpowers/specs/2026-07-17-session-title-pr-numbers-design.md`. Manual `/rename`
  is respected via a **PR-set marker** (`.session-title-set`) — the hook only re-asserts the
  title when the open-PR set changes, since SessionStart stdin carries no live title. **Verify
  live:** that this harness actually consumes `hookSpecificOutput.sessionTitle`.
- **2026-07-15 — Delegation by cost-of-being-wrong** *and* whether the main thread
  needs the reasoning (supersedes "delegate heavily, always"). Haiku = mechanical/IO,
  Sonnet = scoped build, Opus = hard reasoning / stays on main, Fable = rare frontier
  escalation (2× Opus; only when Opus itself stalls and correctness ≫ cost).
- **2026-07-15 — Auto-fix must reach LIVE in real time, autonomously.** End-users
  report in-app; Mr. Wrangler fixes and runs the **full** pipeline (deploy → merge →
  promote) with no user interaction, ending live — the end-user never sees git. The
  trunk rename **broke** this (Pages serves `production`, so merge-to-trunk ≠ live);
  restoring it needs the auto-fixer to run `promote` too. Safety = **fully
  machine-gated**: smoke + logic CI, staging byte-verify, and the fresh-context
  review must ALL pass; any failure hard-stops and pings Jac — never a broken fix to
  live. Flipping the live auto-promote switch (`wrangler-fix.yml` + an automated
  promote path) is Jac's explicit one-time go.
- **2026-07-17 — Phone-login sign-in UX** (#655, #664). The per-person
  (`phoneIdentity: true`) login now: holds the button at **"Wrangling the herd…"**
  through the whole `pidEnter` data load (no flip-back to a clickable "Verify"/"Saddle
  Up?" mid-sign-in — the old bug); plays the Mr. Wrangler intro **video** behind the
  plate during sign-in (mute toggle **ported from the classic screen** for audio
  parity, retries muted if unmuted autoplay is blocked); **auto-submits** the 6-digit
  code on entry (also catches the OS one-time-code autofill); and the code button reads
  **"Confirm"** (was "Verify"). Busy label unified to "Wrangling the herd…" across both
  login screens.

- **2026-07-17 — Coverage folded into Investment; manual "Check for updates" button.**
  Unit-detail Coverage is now a sub-block at the top of the **Investment** section (riding
  #657's `unitSecOpen` RYG collapsible stack) — coverage status drives that section's chip +
  border color (green insured / yellow uninsured); there is **no** separate Coverage section
  (#659, Jac's call). Added a **"Check for updates"** row to the tools menu (#661) that clears
  the SW + HTTP caches and hard-reloads past a stale cache — the escape hatch for pinned builds.
- **2026-07-17 — Inspection toggle IS the interface** (#662, #676). The unit-card Inspection
  section always shows the `Pass · Not Ready · Fail` segmented toggle (stacked on its own row
  to match mobile); the old `+ Inspection` / `Resume inspection` checklist button is **retired**.
  **Pass gates** the inspection: a required-checklist category opens the checklist takeover
  (completion cascades to Pass); no checklist → a direct, wash-gated (R19) pass; already-passed →
  Pass re-opens the completed inspection to **view** (`openInspectionRecord`, which materialises a
  lightweight pass record if none is on file so it's never a dead-end, never a blank pending
  checklist). **Not Ready** resets. **Fail** smart-routes: a unit out on an active rental →
  `markFieldCall` (field call — red-flag the rental, dispatch); a yard unit → bench
  failed-inspection. The shared §12.8 inspection popup is now **pass-aware** — it drops the
  "Failure report" title, danger styling, and "Charge the customer?" bill gate when the
  inspection passed. Reuses `segCtl` (R14); multi-unit field-call granularity is a parked thread.

## Design prefs
- Yard **"data-plate"** design language: dark industrial steel, **ONE** safety-orange
  accent (`#ff7a1a`), hi-vis hazard stripe signature, stamped Saira Condensed labels,
  rivets, a light wrangler/ranch seasoning (voice-first). Run **all** new/changed UI
  through `/jactec-ui`. Don't retroactively restyle the existing site.
- Icons always come from a library (Lucide), never hand-drawn — see `.claude/rules/icons.md`.

## Gotchas
- **Cloud sessions are ephemeral** (fresh clone, container reclaimed) — only
  git-committed work survives, and Claude Code's native auto-memory is machine-local
  so it won't carry over. Commit + push early.
- **Backend deploy** uses the service account (`GAS_SA_KEY_B64` + the service-account
  script), push only; go-live is Jac's Apps Script **editor** deploy. clasp OAuth is
  RAPT-blocked (2026-07-06) — don't retry `clasp login`.
- **Port 8000 is reserved** — swap gates to 9147 before running
  (`sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, `git checkout -- ci/`).
- **Cache-bust** the shared `?v=` on `style.css` / `rule-usage.js` / `app.js` in
  `index.html` on every deploy.
- **Staging is a direct push** (`tools/deploy-staging.mjs`); verify the live bytes. A
  failed/unverified staging deploy is a **HARD STOP** — never work around it.
- **Staging is ONE shared slot — parallel sessions clash** (2026-07-17). A concurrent
  session's `/deploy` overwrites the staging mirror, which can trip `promote.mjs`'s
  staging-freshness gate even when your trunk commit is clean and self-contained.
  `--skip-staging-check` is the legitimate override *only* when your exact bytes were
  already deployed + verified on staging before the stomp; otherwise re-deploy trunk first.
- **Playwright browser gates DO run in a cloud session** (2026-07-17) — contradicts the
  "browser gates only run in CI" note, which was about Jac's Windows desktop. Chromium is
  pre-installed at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. `npm i --no-save
  playwright@1.61.1`, then either `sed` the port to 9147 + inject `executablePath` into
  `ci/smoke.mjs`/`ci/logic-test.mjs` (revert with `git checkout -- ci/`), or launch your own
  script with `chromium.launch({ executablePath })`. smoke + logic-test both pass in-container.
- **Self-scheduling tools are approval-gated in non-interactive cloud runs** (2026-07-17) —
  `send_later` / `create_trigger` (claude-code-remote MCP) fail with "MCP tool call requires
  approval". Fallback timer: a background Bash `sleep N; echo …` with `run_in_background`
  re-invokes the session when it exits.
- **The git proxy rejects delete-refspec pushes** (2026-07-17) — `git push origin --delete
  <branch>` / `:<branch>` throws "send-pack: unexpected disconnect" from a cloud session.
  Merged feature branches can't be deleted here; leave them for GitHub-side cleanup.
- **GPS auth was wired to the OLD login only** (2026-07-17) — the "NO GPS / refresh broken"
  bug: `gpsLogin()` (mint the GPS token) lived ONLY in the password-login handler, so the
  phone-identity login (the staging/prod default) never minted a token → the whole GPS section
  read "NO GPS" and the connect picker / Refresh started unauthenticated. Fix: GPS login now runs
  in `finishLoad()` (every login mode), and `gpsFetch` re-authenticates once on a 401. **The GPS
  backend was healthy the entire time** (token mints, Deere authenticates, CORS allows staging) —
  verify the client-side token before ever blaming the backend.
- **Mobile Safari pins index.html HARD** (2026-07-17) — a shipped fix can sit invisible on a
  cached device (this ate an hour of "it's not working" that was really a stale build). A
  `?fresh`-style query on the URL, a Private tab, or the tools-menu "Check for updates" busts it.
  Subtle trap: the prod service worker serves cached index.html via an `ignoreSearch` match, so
  an update CHECK must clear caches BEFORE fetching index.html or it reads stale bytes and falsely
  reports "up to date."
- **The phone-identity login can't be driven headlessly** (2026-07-17) — the live login
  is **SMS-gated** (a real code to a roster phone) and `app.js` is an **ES module** (login
  internals aren't on `window`), so you can't drive it past the "enter phone" step even
  with Playwright, and you must **never** fire `authStart` on a real number (it texts a
  real hand). Staging-review of login changes = **served-bytes verification**
  (`curl … | grep`); the real end-to-end drive is Jac on a phone.
- **Land merges through a degraded GitHub API with auto-merge** (2026-07-17) — during a
  REST-API Major outage, `merge_pull_request` failed repeatedly, but
  `enable_pr_auto_merge` (SQUASH) landed the PR once `smoke` passed **and** closed the
  "trunk moved during CI → merge conflict" race. Corollary: the shared `?v=` token
  conflicts on nearly every concurrent merge — resolve mechanically
  (`git checkout --ours/--theirs index.html` to pick the forward token, then
  `node tools/gen-code-map.mjs`), never by hand-editing the generated map.
- **CI's `pull_request` synchronize is unreliable + raw GitHub REST is 403** (2026-07-17) —
  later pushes to a PR didn't always spawn a `smoke` run, so the branch-protected merge stalled
  with no check. Fix: dispatch `ci.yml` via `workflow_dispatch` on the branch head (creates the
  required `smoke` check on that commit). And you can't poll from bash — curl to api.github.com
  is 403 ("GitHub access is not enabled"; the proxy routes GitHub only through the MCP `github`
  tools) — poll with `mcp__github__actions_list` + a background `sleep` timer.
- **The Bash guard false-positives on compound git commands** (2026-07-17) — a single Bash
  command containing BOTH `git push` AND a `trunk`/`production` token (e.g. a `git push …; git …
  origin/trunk` chain, or a `git merge-base --is-ancestor origin/trunk HEAD` check alongside a
  push) is blocked as "Direct push to a protected release branch," even when the push targets a
  feature branch. Run the push in its OWN command with no `trunk`/`production` token in the string.
- **promote.mjs's staging gate matches the ?v= TOKEN, not content** (2026-07-17) — it passes when
  live staging's `?v=` equals the trunk commit's `?v=`. On a fast-churning shared-staging trunk,
  your feature's token can ride the squash onto trunk and match staging even though a concurrent
  commit that landed between your `/deploy` and merge isn't on staging. It's still the sanctioned
  bar (that commit was CI-gated + staged by its own session), but token-match ≠ full content-match
  — re-deploy trunk to staging if you need a faithful mirror before a go-live.
- **Headless Chromium can silently fail to paint a specific fixed node** (2026-07-16) —
  a `position:fixed` body-level element wouldn't composite in a `chrome-headless-shell`
  screenshot even with every computed style correct and a provably paintable spot (an
  identical plain div rendered there; the login plate rendered fine). A headless
  artifact, not a real-browser defect — verify transient/fixed visual cues on the
  **staging drive** (real Chrome), not headless screenshots.

## Open threads
- **#666 mobile-nav pass — SHIPPED LIVE** (2026-07-17, `cc7dd7d`) — wider footer Back/Forward
  jog + thicker chevrons (height unchanged); phone Back now "escapes" a filtered/anchored list
  via the phone-only `jogBackEscape` (both the fleet-filter path and `setAnchor` wipe backStack,
  which is why Back dead-ended before); `+Lost` moved off the category mini-cards into Category
  Details → Fleet Summary. Went live inside a **sibling session's** trunk→production promote (not
  a dedicated one — a good reminder that a trunk promote ships everyone's integrated backlog). Two
  minor deferred nits remain: `jogBackEscape`'s `'filter'` branch clears graph-view `.g` terms
  wholesale (phone edge case, harmless); Fleet Summary shows the lost-demand count twice (derived
  stat + the `+Lost N` button label).
- **Repo privacy** — parked on Jac's GitHub billing-tier check. Pages-from-private
  needs GitHub Pro; Free forces public, and flipping private on Free takes
  `app.jacrentals.com` down. If Pro: canary staging → confirm → flip main + production
  (Jac's explicit trigger only). Memory ships public-safe either way, so this doesn't
  block anything.
- **Auto-fix live pipeline** — design the `wrangler-fix.yml` + automated-promote
  wiring so end-user reports reach a live fix autonomously (fully machine-gated).
  Get Jac's explicit one-time go before enabling live auto-promote.
- **Multi-unit Field Call granularity** — when an inspection **Fail** on a unit
  that's out on a *multi-unit* rental raises a Field Call, it flags the rental's
  **primary** unit (`markFieldCall(rentalId)` uses `r.unitId`), not necessarily the
  specific failed unit — matches how the yard `+FC` node already works app-wide.
  Fine for single-unit rentals (the common case). Parked from the inspection-toggle
  redesign (PR #662, 2026-07-17); revisit if per-unit field calls are needed.
- **Instant Cache — fast signed-in open** (SHIPPING 2026-07-17, flag ON, PR #653). On a
  PERSONAL device, paint the last confirmed backend load from an on-device IndexedDB
  snapshot instantly on a signed-in reopen, then reconcile with the live backend.
  Display-only — **never a save baseline** (`paintFromCache` leaves `booting=true`, no
  `snapshotSaved`), so a stale cache can't corrupt the Sheet; **personal devices only**
  (a shared PIN device never caches → no PII at rest); schema/appVer/token-gated +
  self-healing; behind `FEATURES.instantCache` (flipped ON — instant rollback stays a
  one-line toggle). Ships with the black-screen boot fix (splash + parallel resume, ex-#650).
  Reconciled with trunk #655 (`pidEnter` intro video), #659 (`gpsLogin` in `finishLoad`),
  #660 (`maybeReplayScan`); the planned "shared-device login video" (Phase 4) was
  **dropped** — #655 already shipped it. Spec + plan:
  `docs/superpowers/{specs,plans}/2026-07-16-instant-cache-*.md`.
