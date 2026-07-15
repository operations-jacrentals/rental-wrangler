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
- **2026-07-15 — Interaction is HYBRID** (supersedes "always ask via popups, never
  inline", 2026-06-15). Formatted **inline** for exploration/nuance; a crisp
  structured block for clean either/or; an **artifact** for comparative/visual.
  Lead with the outcome; no massive bullet blobs.
- **2026-07-15 — Delegation by cost-of-being-wrong** *and* whether the main thread
  needs the reasoning (supersedes "delegate heavily, always"). Haiku = mechanical/IO,
  Sonnet = scoped build, Opus = hard reasoning / stays on main, Fable = rare frontier
  escalation (2× Opus; only when Opus itself stalls and correctness ≫ cost).

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

## Open threads
- **Repo privacy** — parked on Jac's GitHub billing-tier check. Pages-from-private
  needs GitHub Pro; Free forces public, and flipping private on Free takes
  `app.jacrentals.com` down. If Pro: canary staging → confirm → flip main + production
  (Jac's explicit trigger only). Memory ships public-safe either way, so this doesn't
  block anything.
