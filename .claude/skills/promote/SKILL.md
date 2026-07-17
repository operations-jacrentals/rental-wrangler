---
name: promote
description: STEP 3 / Gate 2 of the ship flow (/deploy → /merge → /promote) — promote the trunk commit to PRODUCTION (go live) via tools/promote.mjs. Use ONLY when Jac says "promote it". Preview first, then --yes. ALWAYS runs /merge (which runs /deploy) first if the work isn't on trunk yet. REFUSES to promote unless staging matches trunk. Invoke with /promote.
---

# /promote — take the trunk commit LIVE (Gate 2, "promote it")

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

## Ensure predecessors first — /merge (and /deploy)
Before you promote anything, confirm the earlier steps are done; if not, backfill them **in
order** and only then promote:
1. **Is the thing Jac wants live actually merged to trunk?** If it's still on a feature branch
   (not on trunk), **run `/merge` first** — and `/merge` itself runs `/deploy` if the feature
   was never deployed/reviewed. Do NOT promote work that isn't on trunk.
2. **Is staging fresh?** `promote.mjs` refuses to promote unless the live staging `?v=` equals
   the trunk commit's `?v=` (so you never ship what staging never showed). If the work went
   `/deploy → /merge` in order, staging already matches (the feature deploy IS what got merged).
   If staging is behind, deploy the trunk commit to staging first (a short branch off trunk →
   `/deploy` → land its `?v=` bump on trunk) — don't reach for the override blindly.

**So if Jac says just "promote it" with nothing done yet:** the chain is **/promote → /merge →
/deploy**, then back up it — deploy, review, merge, promote. Never skip straight to the push.

## This step — go live
1. **Preview:** `node tools/promote.mjs` (bare) — prints the `production → trunk` commit range +
   diffstat + the **staging-freshness** line (✅ matches / 🔴 behind / ⚠️ unreachable). Read it;
   if 🔴, fix staging first (above), don't force it.
2. **Confirm with Jac** the exact range shown is what "promote it" means.
3. **Go live:** `node tools/promote.mjs --yes` — enforces the staging gate + a fast-forward-only
   push of `production`, then **verifies the LIVE site serves the new `?v=`** (`app.js` → HTTP
   200). Report the ✅ line. If Pages lags, re-check in ~1 min:
   `curl -s https://app.jacrentals.com/index.html | grep 'app.js?v='`.
4. **Belt-and-suspenders slot release** (after the live-bytes ✅):
   `node tools/staging-lease.mjs release --branch <b>` for the promoted feature's branch — `/merge`
   should already have freed the slot, so this is just a sweep in case the merge's release was
   skipped or missed. **Soft only:** a failure or an already-free slot is a no-op — never let it
   block or unwind a completed promote. `promote.mjs` itself stays credential-free; this is a
   separate `staging-lease.mjs` call.

## Hard rules
- **Only on Jac's explicit "promote it".** Never promote proactively.
- **Preview first, always.** Then `--yes`.
- **Fast-forward only** (no `--force`); if `production` diverged, the script refuses — a human
  reconciles it.
- **Irreversible go-live** — `/promote` is the ONLY step that changes app.jacrentals.com.
- Deliberate override only if staging genuinely can't be reached: `--skip-staging-check` (loud).

## After
Production is live. Note the promoted `?v=` in the handoff. When the next feature's `/deploy`
lands on staging, staging moves ahead of production again — correct: staging always LEADS.
