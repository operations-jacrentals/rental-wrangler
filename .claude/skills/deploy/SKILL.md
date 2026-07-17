---
name: deploy
description: STEP 1 of the ship flow (/deploy → /merge → /promote) — deploy the current feature branch to the STAGING review site via tools/deploy-staging.mjs, then verify staging actually serves the new bytes. Use when Jac says "deploy to staging" / "put it on staging". A failed or unverified deploy is a HARD STOP — staging must never fall behind production. Invoke with /deploy.
---

# /deploy — put the feature branch on staging (Step 1)

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

## Ensure the precondition (Step 1 has no predecessor)
`/deploy` is first — nothing runs before it. Its one precondition is **a feature branch with the
work committed**: `deploy-staging` refuses `trunk`/`production`. If you're on trunk or the work
is uncommitted, cut/commit to a feature branch off trunk first
(`git checkout -b claude/<task> origin/trunk`), then deploy.

## This step — deploy + PROVE it took
1. **Deploy:** `node tools/deploy-staging.mjs` — crawls the real site-file set, bumps the shared
   `?v=` token in `index.html`, clones the staging repo, syncs, pushes, then **curl-verifies the
   live staging URL serves the new `?v=`** (polling ~1 min for Pages), exiting **non-zero** if it
   never catches up. `--dry-run` bumps locally and stops before touching the staging repo.
2. **Read the exit code + the ✅/🔴 line.** ✅ verified (exit 0) → proceed to review. **Exit 3 is
   special: staging is BUSY, not broken** (all slots held by other sessions and the queue wait
   gave up) — do **NOT** treat it as the HARD STOP / rotate-PAT case; handle it per "Exit 3"
   below. Any other non-zero (1 = auth/network/guard, 2 = pushed-but-verify-failed) / 🔴 / auth
   error → **HARD STOP** (below).
3. **Review the running app** (after ✅): drive **the slot URL `/deploy` printed** with
   Claude-in-Chrome (N=3: your deploy lands on slot 1, 2, or 3 — review THAT slot's URL, e.g.
   `…/rental-wrangler-staging-2/`, never a fixed one) — log in (`$RW_PW`, never echo it), exercise
   exactly what you built + a sanity flow, confirm no console errors and the visible result matches.
   Save a screenshot. A red review STOPs the merge — fix on the branch, `/deploy` again, re-check.

## HARD STOP — a failed or unverified deploy
If the script errors (expired PAT, network, wrong repo/branch) or the live-bytes check fails:
- **STOP.** Do NOT `/merge`, do NOT `/promote`, and do NOT substitute a local `#local` render *as*
  the staging review. **Staging behind production defeats the workflow.**
- **Surface it to Jac** so the credential/host gets fixed — a dead `STAGING_DEPLOY_PAT` needs
  rotating (a GitHub PAT with write access to the staging repo, **not** an app login password;
  never echo it). Note a rotated token only reaches a **fresh session** (env vars are fixed at
  session start).

## Exit 3 — staging BUSY, not broken (do NOT rotate the PAT)
Staging is a **3-slot pool (N=3)** guarded by a lease (`tools/staging-lease.mjs`) — each session
gets its own lane (slot 1/2/3), each an independent Pages site/URL. Exit
**3** means every slot is held by another session and the auto-queue wait gave up with no forward
progress — the deploy is **queued or timed-out, NOT failed**. Nothing is wrong with the PAT, the
host, or your branch.
- **Do NOT HARD STOP and do NOT ask Jac to rotate the token** — this is contention, not a
  credential/host failure.
- **Report it plainly:** which slot is held (session last-4 + feature) and the ETA the script
  printed, and that you were queued. Then simply **re-run `/deploy`** — a freed slot (a holder's
  `/merge` or its 30-min TTL) is claimed on the next acquire.
- The deploy did **not** touch staging, so staging has NOT fallen behind — the "staging behind
  production defeats the workflow" rule is not in play here.

## Then
On a green deploy + review, the next gate is **/merge** ("merge it"). If Jac says "merge it"
without having deployed, `/merge` will run this step first.
