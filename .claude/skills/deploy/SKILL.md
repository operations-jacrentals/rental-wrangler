---
name: deploy
description: Deploy the current feature branch to the STAGING review site (Gate-1 prep) via tools/deploy-staging.mjs, then verify staging actually serves the new bytes. Use when Jac says "deploy to staging" / "put it on staging", or before a "merge it". A failed or unverified deploy is a HARD STOP — staging must never fall behind production. Invoke with /deploy.
---

# /deploy — put the feature branch on staging (and PROVE it took)

Staging is the review surface for the two-gate workflow: a feature branch deploys its site
files to the staging Pages site so Jac reviews the running app at the staging URL, before
"merge it" (Gate 1) and "promote it" (Gate 2). This skill runs that deploy and — critically —
**confirms staging actually updated**, because a silent stale deploy is what breaks the whole
gate. (Learned 2026-07-13: an expired `STAGING_DEPLOY_PAT` made every deploy fail while staging
drifted behind, and the failure got worked around with local renders instead of stopped.)

## Preconditions
- On a **short feature branch** off `trunk` (the script refuses `trunk`/`production`).
- Work is **committed** — a dirty tree still deploys, but the *commit* is what Gate 1 merges, so
  commit first.
- `STAGING_DEPLOY_PAT` (or `STAGING_DEPLOY_KEY_PATH`) is set. If neither is, the deploy is a
  no-op / fails — that is a HARD STOP, not something to route around (see below).

## Steps
1. **Deploy:** `node tools/deploy-staging.mjs`
   - It crawls the real site-file set, bumps the shared `?v=` token in `index.html`, clones the
     staging repo, syncs, pushes, and then **curl-verifies the live staging URL serves the new
     `?v=`** (polling ~1 min for Pages), exiting **non-zero** if it never catches up.
   - `--dry-run` bumps `index.html` locally and stops before touching the staging repo.
2. **Read the exit code + the ✅/🔴 line.**
   - **✅ verified** → staging is live at the new token; proceed to the review.
   - **🔴 / non-zero / auth error** → **HARD STOP** (below).
3. **Review the running app** (only after ✅): drive the staging URL with Claude-in-Chrome (no
   local install) — log in (`$RW_PW`, never echo it), exercise exactly what you built plus a
   sanity flow, confirm no console errors and that the visible result matches. Save a screenshot.
   A red review STOPs the merge — fix on the branch, `/deploy` again, re-check.

## HARD STOP — a failed or unverified deploy
If the script errors (expired PAT, network, wrong repo/branch) or the live-bytes check fails:
- **STOP.** Do NOT proceed to "merge it", do NOT run "promote it", and do NOT substitute a local
  `#local` render *as* the staging review. **Staging behind production defeats the workflow.**
- **Surface it to Jac** so the credential/host gets fixed — a dead `STAGING_DEPLOY_PAT` needs
  rotating (a GitHub PAT with write access to the staging repo, **not** an app login password;
  never echo it).
- A local render may *supplement* the review to keep moving, but only with Jac's explicit,
  flagged OK to skip the live-staging gate this once.

## Then
On a green deploy + green review, Gate 1 is "merge it" (see `/start` → the two-gate loop). The
`/promote` skill (Gate 2) independently refuses to go live unless staging matches the promoted
commit — so keeping this deploy green is also what keeps that gate unblocked.
