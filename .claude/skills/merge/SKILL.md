---
name: merge
description: STEP 2 / Gate 1 of the ship flow (/deploy → /merge → /promote) — squash-merge the reviewed feature branch INTO trunk (integrated, still NOT live). Use when Jac says "merge it". ALWAYS runs /deploy first if the feature hasn't been deployed to staging + reviewed. Invoke with /merge.
---

# /merge — fold the feature branch into trunk (Gate 1, "merge it")

## The flow — all three gates share this (know it cold)

```
   FEATURE BRANCH ──/deploy──▶  STAGING      (review mirror — pushes to NOTHING)
        │
      /merge   (Gate 1: squash the feature branch INTO trunk)
        │
        ▼
      TRUNK  ──/promote──▶  PRODUCTION        (Gate 2: fast-forward trunk → production = LIVE)
 (integrated,
  not live)
```

- Your **feature branch is the one source**: `/deploy` copies its files to the **staging
  review site**, and `/merge` folds it into **trunk**.
- **Staging pushes to nothing** — it's a dead-end copy you look at, never a step between trunk
  and production.
- **trunk → production (`/promote`) is the only thing that goes live.**

**Ordered gates — ALWAYS backfill the earlier steps first.** The gates run strictly in the order
**/deploy → /merge → /promote**. Whichever skill you're invoked as, FIRST confirm the steps
before it are done; if they are NOT, do them (in order) and THEN your own step — even if Jac
jumps straight to the last one.
- **/deploy** — step 1, no predecessor (just needs a feature branch with the work committed).
- **/merge** — needs **/deploy** first. Missing → run `/deploy`, then merge.
- **/promote** — needs **/merge** (on trunk) + fresh staging. Missing → run `/merge` (which
  backfills `/deploy`), then promote.

## Ensure predecessor first — /deploy
Before merging, the feature must have been **deployed to staging and reviewed** — that's the
point of Gate 1: you look at the running app before integrating it. By default that's a **deck
deploy** (a numbered `d/<feature>-<n>/` folder); under `--slots` it's a slot. Check:
- **Change touches SERVED site files** (`app.js`/`style.css`/`index.html`/`*.html`/`assets/`…):
  staging must be showing THIS feature — for a deck deploy, the newest deploy for this feature's
  branch matches the branch's current commit (the deploy id/label `/deploy` printed); under
  `--slots`, the live staging `?v=` matches this branch's `index.html` `?v=` (`deploy-staging`
  prints it). If staging is stale/behind → **run `/deploy` first**, get the review, THEN merge.
  Never merge an un-reviewed feature.
- **Change touches ONLY non-served files** (skills, CI, tools, docs — not served by Pages):
  there's nothing for staging to show, so skip the deploy step and merge directly.

## This step — merge to trunk
1. **Local gates green:** `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
   `node ci/lease-test.mjs`, `node ci/lease-deploy-test.mjs`, `node ci/promote-test.mjs`,
   `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`,
   `node tools/gen-code-map.mjs --check`. (Port 8000 is reserved → `sed -i 's/8000/9147/g'
   ci/smoke.mjs ci/logic-test.mjs`, run, then `git checkout -- ci/`. The `lease-*` and
   `promote-test` suites are pure-Node — **not** part of the port swap.)
2. **Fresh-context review — the safety net that replaces plan-reading.** Spawn a
   **code-review subagent** (fresh context, no conversation history) on the diff
   `git diff origin/trunk...HEAD`, scoped to correctness + requirement gaps (not style).
   A reviewer that never watched the code get written catches what the writing context is
   blind to. If it surfaces a real correctness bug, **stop and fix before the PR.** This
   review is the enforced gate here: merges land via the PR/squash (not a local command a
   hook can intercept), so the review discipline is what actually guards the merge.
   - **Auto-bump the `?v=` cache-bust token (before the PR).** Run `node tools/bump-cachebust.mjs`
     — it commits a `?v=` bump to the feature branch **iff** a served, versioned file
     (`app.js`/`style.css`/`rule-usage.js`) changed vs trunk and the token wasn't already bumped
     (a clean **no-op** otherwise — e.g. a config-only branch, or a slot deploy that already
     bumped). This is what makes a **deck-mode** ship actually reach devices: production serves the
     branch root with `max-age=600` and the service worker caches by `?v=`, so a served change
     under an **unchanged** token serves stale bytes live. **Push the bump commit** so it rides
     into the PR. The CI guard `ci/check-cachebust.mjs` (in the `smoke` job) **fails the merge** if
     the bump was skipped, so this can't be forgotten.
3. **PR to `trunk`** (draft is fine); let CI (`smoke`) pass — `trunk` is branch-protected, so the
   required check MUST be green before merge. Fix a red conflict with trunk first (a pure `?v=`
   token conflict resolves mechanically; anything substantive, resolve by hand).
4. **Squash-merge** the PR into `trunk`. Integrated on the trunk but **NOT live** (Pages serves
   the separate `production` branch).
5. **Release the staging slot (`--slots` only — skip entirely in deck mode):** deck deploys are
   ephemeral (pruned by retention, never "held"), so when the feature was reviewed via the
   default deck path there is **no slot to release** — skip straight to step 6. If the feature
   was deployed with `--slots`: `node tools/staging-lease.mjs release --branch <feature-branch>`
   — the review window is over, so free the slot the moment the feature is integrated. Release is
   **by branch** (the merge process may be a different session than the one that `/deploy`ed it,
   so a session-keyed release would miss). This is a **soft step**: if it fails (network, auth,
   nothing to release), **WARN and keep going — a failed release NEVER fails the merge.** The
   30-min holder TTL is the backstop that frees the slot regardless.
   - **`not-held` / `not-holder` handoff:** if the release reports the branch didn't hold a slot,
     the lease was **TTL-reclaimed during the review** (the review outran the 30-min budget, or
     another session took the freed slot). Nothing is broken — but staging may no longer be
     showing this feature. **Warn Jac and re-run `/deploy`** to re-land it on staging *before* any
     `/promote`, so the promote-freshness gate has fresh bytes to check.
6. **Delete the feature branch** (local + remote).

## After
The work is on trunk, integrated but not live. The next gate is **/promote** (Gate 2) — always
Jac's explicit call. If Jac jumps straight to "promote it", the `/promote` skill will confirm
this merge happened first (and run it, and `/deploy`, if not).
