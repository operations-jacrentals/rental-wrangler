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

## Two staging paths: the Deck (default) vs `--slots` (backup)
`node tools/deploy-staging.mjs` with **no flags** runs the **Staging Deck** — the default since
2026-07-18 (spec: `docs/superpowers/specs/2026-07-18-staging-deck-design.md`). Every deploy gets
its own **immutable numbered folder** `d/<feature>-<n>/` in the staging repo — nothing is ever
overwritten, so there's no lease/TTL/slot to arbitrate:
- Publishes the site to `d/<feature>-<n>/`, rewrites the served manifest `d/deploys.json`, and
  prunes to the newest 20 — all in **one commit**, with push-race CAS-retry (a rejected push
  refetches, recomputes the id, and retries — bounded).
- Prints the **deploy id** (e.g. `work-queue-92oeso-3`), the **label**, and the folder URL.
  **`--label "<text>"`** sets a human-readable description (default: the HEAD commit subject).
- A **stable launcher** at `…/rental-wrangler-staging/d/` always redirects to the newest deploy —
  Jac bookmarks that ONE url once and it never goes stale.
- On staging builds, a dev-gated in-app **`Staging ▾`** switcher (bottom-right) lists recent
  deploys by label and jumps between them — Claude just tells Jac which id/label to open.
- **No lease is acquired in deck mode**, and there's nothing to release later either (see
  `/merge`, `/promote`, `/end`) — deck deploys are ephemeral, pruned by retention, never "held".

**`--slots` is the backup path** — `node tools/deploy-staging.mjs --slots` falls back to the old
3-slot lease pool, completely unchanged (still covered by the `lease-*` CI suites). Everything
below about slots/lease/TTL/exit-3 is `--slots` behavior — reach for it only when the deck path
itself is the problem.

## This step — deploy + PROVE it took
1. **Deploy (deck, the default):** `node tools/deploy-staging.mjs` — crawls the real site-file
   set, publishes it to a fresh `d/<feature>-<n>/` folder in the staging repo (one commit, no
   lease), then **curl-verifies the new folder serves the expected `?v=`** (polling ~1 min for
   Pages), exiting **non-zero** if it never catches up. Prints the **deploy id**, **label**, and
   folder URL. `--label "<text>"` sets the label. `--dry-run` bumps locally and stops before
   touching the staging repo. `--slots` runs the old lease/slot pool instead (see above).
2. **Read the exit code + the ✅/🔴 line.** ✅ verified (exit 0) → proceed to review. **Exit 3 only
   happens under `--slots`: staging is BUSY, not broken** (all slots held by other sessions and
   the queue wait gave up) — do **NOT** treat it as the HARD STOP / rotate-PAT case; handle it per
   "Exit 3" below. The default deck path never contends for a shared slot, so it never exits 3.
   Any other non-zero (1 = auth/network/guard, 2 = pushed-but-verify-failed) / 🔴 / auth error →
   **HARD STOP** (below).
3. **Review the running app** (after ✅): drive **the folder URL `/deploy` printed** — deck mode,
   `…/rental-wrangler-staging/d/<id>/` (or open it via the in-app **`Staging ▾`** switcher, or the
   stable `…/d/` launcher) — with Claude-in-Chrome: log in (`$RW_PW`, never echo it), exercise
   exactly what you built + a sanity flow, confirm no console errors and the visible result
   matches. Save a screenshot. Under `--slots`, review **the slot URL `/deploy` printed** instead
   (N=3: your deploy lands on slot 1, 2, or 3 — review THAT slot's URL, e.g.
   `…/rental-wrangler-staging-2/`, never a fixed one). A red review STOPs the merge — fix on the
   branch, `/deploy` again, re-check.

## HARD STOP — a failed or unverified deploy
If the script errors (expired PAT, network, wrong repo/branch) or the live-bytes check fails:
- **STOP.** Do NOT `/merge`, do NOT `/promote`, and do NOT substitute a local `#local` render *as*
  the staging review. **Staging behind production defeats the workflow.**
- **Surface it to Jac** so the credential/host gets fixed — a dead `STAGING_DEPLOY_PAT` needs
  rotating (a GitHub PAT with write access to the staging repo, **not** an app login password;
  never echo it). Note a rotated token only reaches a **fresh session** (env vars are fixed at
  session start).

## Exit 3 — staging BUSY, not broken (`--slots` only — do NOT rotate the PAT)
This only happens under `--slots`; the default deck path has no shared target to contend over, so
it never exits 3. Staging is a **3-slot pool (N=3)** guarded by a lease (`tools/staging-lease.mjs`)
— each session gets its own lane (slot 1/2/3), each an independent Pages site/URL. Exit
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
