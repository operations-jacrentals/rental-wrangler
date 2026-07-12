# Development Workflow Redesign — Trunk-Based + Two-Gate Staging→Production

- **Date:** 2026-07-12
- **Status:** APPROVED design (Jac signed off 2026-07-12). Next step: implementation plan (`writing-plans`).
- **Branch:** `claude/update-specs-yesterday-y8tr3x` (design authored here; the migration itself lands incrementally — see §9).
- **Scope:** How we develop and ship, end to end. Replaces the `task → area/<domain> → staging → main` branch chain + the `spec-sync`/`master-spec` machinery with mainstream trunk-based development, while **keeping Jac's staging approval gate**.

## 1. Problem / motivation

The current workflow is a large, well-built workaround for one root choice: **long-lived branches used as environments.** There are ~19 permanent `area/*` branches, each drifting 500–800 commits from `main`, plus a 4-tier `task → area → staging → main` promotion chain, plus a custom `spec-sync` tool syncing a `docs/specs/` folder across a dedicated spec-only `master-spec` branch, plus a separate staging *mirror repo* synced by a 10-minute cron + a manual `gh workflow run sync-staging.yml` dispatch.

Almost every one of those moving parts exists to manage the divergence that permanent branches create. The symptom that triggered this redesign: `master-spec` silently went stale and started *downgrading* the specs of any session that ran `spec-sync down` — a second copy of the truth drifting from the first. Jac: *"I still feel my workflow is clunky and overcomplicated… I would like to do exactly what the mainstream industry does instead of pretending I'm smarter than them."*

The research (see §10) is unusually unanimous: fix the branching model and most of the machinery has nothing left to do. Jac's one firm constraint: **keep the staging approval gate** — he reviews the running app on a staging URL and approves before it goes live. That gate is 100% mainstream; it is *staging-as-a-long-lived-branch + mirror repo* that is the anti-pattern. The two separate cleanly.

## 2. Goals

- One **trunk** (`main`); short-lived feature branches; retire the `area/*` branches and the 4-tier promotion chain.
- **Keep** a staging review environment and a manual approval before production.
- Retire `spec-sync` and the `master-spec` branch (docs-as-code on the trunk).
- Retire the 10-minute cron mirror + manual `sync-staging.yml` dispatch (staging becomes a direct deploy).
- Support **parallel Claude sessions** via git **worktrees** off the trunk, not per-domain branches.
- Preserve every real quality asset: the CI gates, R-rulebook stamping, Code-Atlas, `jactec-ui`, and the skills.

## 3. Non-goals

- **Not** moving off GitHub Pages (evaluated; a commercial app would pay ~\$20/mo for Netlify/Vercel gated publishing, and Cloudflare Pages has no post-merge approval gate — Pages + Actions stays cheapest and most mainstream). Pages' one-site-per-repo limit means the staging site remains a second repo.
- **Not** adopting a native GitHub audit gate now. Jac chose chat-driven gates (§5); the native "Required reviewers" Approve button is a documented later option, not this design.
- **Not** a big-bang cutover. The migration is incremental, one area at a time (§9).
- **Not** re-litigating the kept infrastructure (CI gates, rulebook, atlas, skills).

## 4. The model, in one picture

```
open a session
   │
   ▼
short feature branch ───────────────▶  STAGING (runs your feature)
   │  Claude builds it; deploys at a           │
   │  testable milestone & tells you           │  you review the running app
   │                                           │
   │        ◀──── "looks good, merge it" ──────┘
   ▼
TRUNK (main) ── feature merged, branch deleted; a big replacement rides in behind a flag
   │
   │  wait as long as you like — blessed, integrated, but NOT live
   │
   │        ◀──── "promote it" ────────────────
   ▼
PRODUCTION ──▶ app.jacrentals.com  (the exact build you approved)
```

## 5. Decisions (with rationale)

Each row was decided with Jac on 2026-07-12.

| # | Decision | Rationale |
|---|---|---|
| D1 | **One trunk (`main`); short-lived feature branches off it, merged/dropped the same day and deleted.** | Trunk-based development; DORA's elite-performer thresholds (≤3 active branches, merge daily, branches live hours not days). Ends the 500–800-commit drift. |
| D2 | **Review the feature BEFORE it joins the trunk.** The feature branch is deployed to the staging environment; it merges into the trunk only after approval. | Directly answers Jac's *"what if I don't like it, especially a big replacement?"* — a disliked feature simply never merges; nothing to undo. Maps to his current "review staging, then merge" habit. |
| D3 | **Two chat-driven gates.** Gate 1 = "merge it" (Claude merges the feature into the trunk, deletes the branch). Gate 2 = "promote it" (Claude promotes the exact approved build to production). The wait between them is Jac's. | Keeps the approval gate Jac values, and decouples *integrate* from *go-live* ("release when ready"). Trunk runs a little ahead of production, holding blessed-but-not-live work — a normal continuous-delivery shape. |
| D4 | **Both gates operated from the chat**, on Jac's say-so; Claude runs the git/deploy commands. | Least friction, never leaves the session. Trade-off accepted: no native audit trail on go-live (fine for a solo operator; the native GitHub "Required reviewers" gate can be added later). |
| D5 | **Big replacements ship behind a feature flag** (a `FEATURES` map in `config.js`): new code alongside old, toggle to flip, old code deleted only once confident. Small/low-risk features merge plainly. | The mainstream tool for de-risking large swaps; makes "back it out" a runtime toggle, not code surgery. Caveat: on a public Pages site a flag disables *execution*, not *visibility* — flagged code is still readable in the shipped bundle (not a secrecy mechanism). |
| D6 | **Parallel Claude sessions use git worktrees** off the trunk (`claude --worktree <name>`), not per-domain branches. `.worktreeinclude` carries gitignored backend/config into each worktree; `isolation: worktree` self-isolates subagents. | First-party Anthropic mechanism for the exact problem the `area/*` branches were built to solve. Isolation without divergence. Sweet spot 3–5 concurrent, not 19. |
| D7 | **Docs-as-code on the trunk.** Specs/decisions live in `/docs` on `main`; retire `spec-sync` and the `master-spec` branch. Settled decisions can be recorded as ADRs. | With one trunk + short branches, every session sees the latest docs by pulling — the cross-branch sync problem (and its silent-staleness failure mode) disappears. |
| D8 | **Staging stays a second repo, fed by a push on deploy** (not a cron). Retire the 10-min cron mirror + manual `sync-staging.yml` dispatch. | Pages allows one site per repo, so the staging URL needs a second repo — but it updates instantly on deploy instead of polling, killing the documented "mirror serves an old file under a new token" bug. |

## 6. What stays (real quality infrastructure, unchanged)

The `smoke` + `logic-test` + `gen-rule-usage --check` + `check-window-catalog` + `gen-code-map --check` CI gates; the R-rulebook `data-r` stamping + generator; the Code-Atlas (`docs/CODE-MAP.md`); `jactec-ui` and its rulebook; and all skills (`start`, `clasp`, `atlas`, `wrangler-fix`, `tidy-sessions`, `brainstorming`, etc.). None of this was ceremony — it is the quality floor and it carries over. (Skills that reference the old branch flow — notably `start` and its `branch-map.md` — get updated to describe the trunk model; see §8.)

## 7. What gets deleted

- The ~19 long-lived `area/*` branches.
- The `task → area/<domain> → staging → main` promotion chain.
- The `spec-sync` tool (`tools/spec-sync.mjs`) and the `master-spec` branch.
- The 10-minute cron mirror sync + the manual `sync-staging.yml` workflow-dispatch step.
- `tools/branch-preflight.mjs`'s area/master-spec ensure logic (reduced to trunk + worktree hygiene, or retired).

## 8. Impacted skills / tooling to update (not delete)

- **`start` skill** + `references/branch-map.md`: rewrite the "route to a task branch off an area" flow into "cut a short feature branch / worktree off the trunk"; drop the master-spec `down`/`up` obligations and the ~2h spec-sync timer.
- **`CLAUDE.md`**: replace the Deploy & gates branch-flow description and the spec-sync references with the trunk model.
- **`clasp` skill / backend deploy**: unchanged in mechanism (backend still ships out-of-band), but its references to the branch chain get updated.

## 9. Migration approach (incremental — no big bang)

1. Land this workflow's plumbing (the trunk deploy pipeline: feature-branch→staging push, gated production promote) once, and prove it on one small feature end to end.
2. Adopt the trunk model **one area at a time**: next time an `area/*` is touched, do the work as a short feature branch off the trunk instead, verify, and retire that area branch. The branch empire dissolves gradually rather than in one risky sweep.
3. Retire `spec-sync`/`master-spec` once docs are consolidated onto the trunk.
4. Update the impacted skills/docs (§8) alongside step 1 so new sessions start on the new model.

## 10. Grounding / sources

Trunk-based development & branch lifetime: DORA (dora.dev/capabilities/trunk-based-development), Martin Fowler "Patterns for Managing Source Code Branches" (martinfowler.com/articles/branching-patterns.html), trunkbaseddevelopment.com. Branching models: GitHub Flow (docs.github.com/en/get-started/using-github/github-flow), GitLab "Branching strategies". Feature flags: Fowler "Feature Toggles" (martinfowler.com/articles/feature-toggles.html). Docs-as-code / ADRs: writethedocs.org/guide/docs-as-code, adr.github.io, diataxis.fr. Parallel AI agents: Claude Code worktrees (code.claude.com/docs/en/worktrees) + agent teams (code.claude.com/docs/en/agent-teams). Approval gate & hosting: GitHub Actions Environments / required reviewers (docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), custom Pages workflows (docs.github.com/.../using-custom-workflows-with-github-pages), Netlify locked deploys, Cloudflare Pages preview deployments, Vercel promote.

## 11. Open implementation questions (for the plan, not this design)

- Exact GitHub Pages wiring for two sites, and making **production deploy only on "promote"** (not automatically on merge to trunk) — e.g. a `production` release-pointer branch that Pages serves and that "promote" fast-forwards, or a Pages source of "GitHub Actions" with a promote-triggered deploy.
- Cross-repo push mechanism for the staging site (deploy key vs PAT).
- Whether to add **content-hashed asset filenames** to retire the manual `?v=` cache-bust token (a small CI hashing step can do this without adopting a full bundler, preserving the build-free posture).
- Where feature-flag reads live in `app.js` and how `config.js` `FEATURES` defaults are set per environment.
