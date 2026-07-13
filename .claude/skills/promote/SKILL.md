---
name: promote
description: Gate 2 of the two-gate workflow — promote the approved trunk commit to PRODUCTION (go live) via tools/promote.mjs. Use ONLY when Jac explicitly says "promote it". Preview first (bare), then --yes. REFUSES to promote if staging is behind the trunk commit (staging must never fall behind production). Invoke with /promote.
---

# /promote — take the approved trunk commit LIVE (Gate 2)

`production` is the release-pointer branch GitHub Pages serves at app.jacrentals.com. Promoting
fast-forwards `production` to the exact `trunk` commit already reviewed on staging and merged via
Gate 1. **This is the ONLY step that changes the live site — always Jac's explicit call.**

## Hard rules
- **Only on Jac's explicit "promote it".** Never promote proactively.
- **Preview first, always.** Run bare (no `--yes`) to print exactly what would go live — commit
  range, diffstat, and the staging-freshness result — then STOP.
- **Staging must not be behind.** `promote.mjs` refuses to promote unless the LIVE staging `?v=`
  equals the trunk commit's `?v=`. If staging is stale, the promote is BLOCKED — that guard is
  what keeps staging from falling behind production. Fix it by `/deploy`-ing the merged commit to
  staging first, then re-run. (Override only if staging genuinely can't be reached and Jac accepts
  the risk: `--skip-staging-check`, which prints loud.)
- **Fast-forward only.** If `production` diverged (hotfixed directly / rewritten), the script
  refuses — a human reconciles it. There is no `--force` path.

## Steps
1. **Preview:** `node tools/promote.mjs`
   - Prints the `production → trunk` commit range + diffstat, and the **staging-freshness** line
     (✅ matches / 🔴 behind / ⚠️ unreachable). Read it. If 🔴, do NOT promote — `/deploy` first.
2. **Confirm with Jac** that the exact range shown is what "promote it" means.
3. **Go live:** `node tools/promote.mjs --yes`
   - Enforces the staging gate + the fast-forward, pushes `production`, then **verifies the LIVE
     site serves the new `?v=`** and that `app.js?v=` returns HTTP 200. Report the ✅ line to Jac.
4. If the live-bytes check warns (Pages lag), re-check in ~1 min:
   `curl -s https://app.jacrentals.com/index.html | grep 'app.js?v='`.

## After
Production is live. Note the promoted `?v=` in the handoff. When the NEXT feature's `/deploy`
lands on staging, staging moves ahead of production again — that's correct: staging should
always LEAD, never lag.
