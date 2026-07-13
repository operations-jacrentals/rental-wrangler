# Implementation Plan — Trunk-Based Dev Workflow with Two-Gate Staging→Production

- **Date:** 2026-07-12
- **Status:** DRAFT plan (authored autonomously while Jac was away). Needs Jac for the Phase 0 items marked ⛔ (repo settings + secrets) before anything goes live.
- **Design:** `docs/superpowers/specs/2026-07-12-dev-workflow-trunk-based-redesign-design.md` (approved 2026-07-12).
- **Guardrail:** Do **not** touch the `frontend-performance` area while Jac's "App performance issues" session is open (§Phase 3).
- **Nothing in this plan runs on its own** — the deploy scripts are drafted here as code blocks, not installed as live `.github/workflows/*.yml`, so no pipeline fires until we deliberately wire it in Phase 0/1.

## Guiding shape (from the design)

Two environments, two chat-driven gates, one trunk:

```
feature branch ──deploy──▶ STAGING (2nd repo)  ──"merge it"──▶ TRUNK (main)  ──"promote it"──▶ PRODUCTION
   (Claude builds)          you review                          integrated,                     app.jacrentals.com
                                                                not live yet                    (release-pointer branch)
```

The one mechanical crux: **production must stop auto-tracking `main`**, or merging to the trunk would go live instantly and destroy Gate 2. Chosen mechanism (fits "Claude does it from chat"): the production repo's Pages serves a **`production` release-pointer branch**, and "promote it" fast-forwards `production` to the approved trunk commit. The trunk (`main`) then holds blessed-but-not-live work, exactly as the design intends.

---

## Phase 0 — One-time setup (⛔ = needs Jac: repo admin / secrets)

0.1 **Keep the staging repo.** `operations-jacrentals/rental-wrangler-staging` stays as the staging site's host (Pages is one-site-per-repo). We stop feeding it by cron; Claude pushes to it on "deploy to staging" (Phase 1).

0.2 ⛔ **Create the production release-pointer branch.** From the current live commit: `git branch production origin/main && git push origin production`. This is a *pointer*, not divergent code — same bytes as the trunk at each promote.

0.3 ⛔ **Repoint production Pages to the `production` branch.** Prod repo → Settings → Pages → Build and deployment → Source = *Deploy from a branch* → Branch = `production` `/ (root)`. After this, merging to `main` no longer changes the live site — only a `production` update does. **Verify** app.jacrentals.com is unchanged immediately after (same commit, just a different source branch pointing at it).

0.4 ⛔ **Add a cross-repo deploy credential** so Claude can push the feature build into the staging repo: either an SSH **deploy key** (public half on `rental-wrangler-staging`, private half as a secret) or a fine-scoped **PAT**. Needed because the default token can't push cross-repo. Store as an env secret this session can read (never echoed).

0.5 **Retire the old staging sync.** Delete/disable the 10-min cron + `sync-staging.yml` workflow-dispatch on the staging mirror **only after** Phase 2 proves the push-based deploy works. (Sequenced so we never have zero working staging paths.)

**Phase 0 exit check:** `main` merges do NOT change the live site; `production` updates DO; staging repo is push-writable by this session.

---

## Phase 1 — The three chat-driven actions (drafted; reversible)

Three tiny scripts under `tools/` (or documented command sequences). Build-free posture preserved — they copy the existing files, they don't bundle. Each bumps the shared `?v=` token so caches refresh (until Phase 6 replaces that with content-hashing).

**1.1 `tools/deploy-staging.mjs` — "put my feature on staging."** Pushes the *current working tree's* site files (`index.html`, `app.js`, `style.css`, `config.js`, `data.js`, `icons*.js`, `rule-usage.js`, assets…) into the staging repo's Pages branch, bumping `?v=`. Draft:

```
# pseudocode / command shape — finalize paths in implementation
1. sanity: on a feature branch, working tree builds (node ci/smoke.mjs on :9147)
2. bump the shared ?v= token in index.html (timestamped)
3. rsync the site files into a checkout of rental-wrangler-staging (Pages branch)
4. commit + push that repo   ->  staging URL updates within ~1 min
5. print the staging URL + the new ?v= marker to confirm
```

**1.2 "merge it" — Gate 1 (feature → trunk).** Claude, on Jac's say-so:
```
1. run the full local gate set (smoke, logic-test, gen-rule-usage --check,
   check-window-catalog, gen-code-map --check)   # port-swap 8000->9147 per CLAUDE.md
2. merge the feature branch into main (fast-forward or --no-ff PR merge)
3. delete the feature branch (local + remote)
# main is now integrated but NOT live (Pages serves `production`)
```

**1.3 `tools/promote.mjs` — Gate 2 ("promote it", trunk → production).** Claude, on Jac's say-so:
```
1. fast-forward `production` to main's approved commit (byte-identical to what
   was reviewed on staging, since solo/one-feature-at-a-time)
2. push `production`  ->  app.jacrentals.com goes live
3. verify the live site serves the new ?v= marker (curl), report done
```

**1.4 Feature-flag scaffold (`config.js`).** Add a `FEATURES` map (default all-off for in-flight big replacements) plus a one-line reader in `app.js` (`const flagOn = k => (FEATURES||{})[k] === true`). Big replacements gate their new path on a flag; small features skip it. (Public-Pages caveat from the design: flags hide execution, not source.)

---

## Phase 2 — Prove it end-to-end on ONE small feature

Pick a trivial, low-risk change (a copy tweak or a tiny visual fix — **not** in `frontend-performance`). Run the whole loop: feature branch → `deploy-staging` → review URL → "merge it" → `promote.mjs` → verify live. Confirm: staging updated on push (no cron), production only moved on "promote," live bytes match, rollback works (`git revert` on `main`, re-promote). Only after this passes do we retire the old cron sync (0.5).

---

## Phase 3 — Adopt the trunk model per area, incrementally

Not a big-bang. Next time an `area/<domain>` is touched, do the work as a short feature branch off the trunk instead, verify via Phase-1/2 loop, then retire that area branch (delete once its unmerged work is on the trunk).

- **⛔ SKIP `frontend-performance`** and its area branch until Jac's "App performance issues" session is done — do not migrate or delete that area, and don't apply the parked `frontend-performance.md` spec edit.
- Order the rest by how stale/low-risk they are; the janitor deletes merged branches.
- Track remaining area branches in a short checklist so "how many areas left" is always visible.

## Phase 4 — Retire spec-sync / master-spec

Once docs are consolidated on the trunk: remove `tools/spec-sync.mjs`, delete the `master-spec` branch, and strip the `spec-sync` obligations from the `start` skill. (The parked "yesterday's specs" edits land here as **plain commits on the trunk**, not a `spec-sync up` — minus `frontend-performance.md` per the guardrail.)

## Phase 5 — Update skills/docs to the trunk model

Concrete edits (staged as their own reviewed change, since they alter how every future session behaves):
- **`start` skill** + `references/branch-map.md`: replace "route to a task branch off an area" with "cut a short feature branch / worktree off the trunk"; drop the master-spec `down`/`up` steps + the ~2h spec-sync timer; add the two-gate deploy loop + `claude --worktree` for parallel sessions.
- **`CLAUDE.md`**: rewrite "Deploy & gates" (branch flow + spec-sync) to the trunk + two-gate model; keep the CI-gate list and cache-bust note (until Phase 6).
- **`tools/branch-preflight.mjs`**: reduce to trunk + worktree hygiene (or retire).

### §5a Skill rewrites — `start` + the end-of-session skill (Jac, 2026-07-12: "take note on HOW")

The session-lifecycle pair needs a rewrite for the trunk model. Capturing the approach here so it isn't lost:

- **`start` skill** (rewrite, well-scoped against this design):
  - STRIP: the "route to a task branch off an `area/<domain>`" flow, the `branch-map.md` area catalogue, the `master-spec` `down`-at-start / `up`-every-2h obligations + the ~2h spec-sync self-timer, and the `branch-preflight --ensure` area/master-spec logic.
  - ADD: "cut a short feature branch (or `claude --worktree <task>`) off the **trunk**"; the two-gate deploy loop (`deploy-staging` → review URL → "merge it" → wait → "promote it"); the `FEATURES` feature-flag note for big replacements; keep the toolchain probe, memory recall, and the working-discipline/model-triage rules.

- **End-of-session skill** — REPLACES `tidy-sessions`, which Jac flags 2026-07-12 as "**has not been very useful**" (it only lists/archives finished chats). Jac's chosen shape (2026-07-12) is a **capture-and-close-out** skill, NOT a land/promote skill. Four jobs, in order:
  1. **Report shipped-state** plainly — what's **merged to the trunk** vs **promoted to production** vs **still pending / uncommitted** — so a session never ends in a fuzzy "did this actually ship?" state.
  2. **Catch loose work before it's lost** — scan the session for ideas, features, or half-done threads that should live on for later, and **move each onto its own branch** (a parked feature branch / follow-up) so closing the chat never drops a good idea or unfinished piece. This is the job Jac most wanted and the one `tidy-sessions` never did.
  3. **Guard against premature archive** — if anything is pending, parked, or uncommitted, the session should **NOT** be archived; say so and stop, rather than sweeping it away.
  4. **Archive the chat reliably** — the old `tidy-sessions` job, done well, as the **last** step and only once 1–3 are clean.
  - De-scoped per Jac's picks: it does **not** drive the two gates / promote, and does not itself "land" the work beyond reporting + parking. Worktree cleanup + a handoff note fold into steps 1/4.

## Phase 6 — Optional hardening (later)

- **Content-hashed asset filenames** via a small CI hashing step (rename `app.<hash>.js` / rewrite `index.html`) to retire the manual `?v=` bump while staying build-free.
- **Native GitHub approval gate** (Environments → Required reviewers on the public repo, free) if Jac later wants an audited go-live button instead of the chat command.

---

## Risks & rollback

- **0.3 is the sharp edge.** Repointing Pages source is the only step that can affect the live site; do it at a quiet time and verify the live commit is unchanged right after. Fully reversible (point Pages back to `main`).
- **Cross-repo secret** must never be echoed; scope it to the staging repo only.
- **One-feature-at-a-time keeps "byte-identical promotion" true.** If Jac ever runs several features to the trunk before promoting, production promotes *all* merged-but-unpromoted work at once — that's when feature flags (D5) do real work; call it out when it first happens.
- Every gate is reversible before go-live: dislike on staging → branch never merges; dislike after merge → `git revert` on the trunk before promoting.

## Blocked-on-Jac checklist (for when he's back)

1. ⛔ 0.2 create + push the `production` branch.
2. ⛔ 0.3 repoint prod Pages source to `production` (+ verify live unchanged).
3. ⛔ 0.4 provide the cross-repo deploy key/PAT secret.
4. Confirm branch names (`production` release pointer) and that "Claude does it from chat" promotion is the intended mechanism vs. adding the free native gate now.
5. Green-light Phase 2's throwaway test feature.

---

## Phase 7 — Reconcile the pre-existing `staging` divergence into the trunk (added 2026-07-13)

**STATUS — DONE (2026-07-13, #596).** Reconciled via **one clean 3-way merge** of `origin/staging` into `main`, not the per-feature port originally sketched below: staging's `app.js`/`style.css` and `main`'s redesign delta touched non-overlapping regions, so the merge auto-resolved with **zero code conflicts** (only the `index.html` `?v=` token + the generated code-map needed fixing). Verified with full CI (boot smoke, logic-test, all gates) + an Opus security review (all gates — `canMoney`, account-block, signed-agreement, block-picker auth, customer isolation — byte-identical to the audited staging) + a Sonnet merge-integrity review (no dupes/broken seams; the one `no-undef` hit, `mobileDockEl`, is pre-existing dead code in the mobile subsystem). **`main` is now the true integrated latest.** The A-vs-B staging-role question resolves to **Option A** (staging → per-feature preview) as predicted, and `CLAUDE.md` already reflects it.

**NOT done — Jac's calls (do NOT do autonomously):**
1. **Mobile coordination before promote.** The merge carried staging's current scroll-snap paging onto the trunk; the separate **frontend-performance** session is replacing that with a side-scroll/swipe system. Coordinate so the newer mobile wins *before* going live. (Also: fix the pre-existing `app.js` `mobileDockEl` → `mobileToolbarEl` dead-code reference as part of that session's mobile work — out of scope here.)
2. **"Promote it" (Gate 2).** Production is unchanged (still the prior live build); the reconciled `main` goes live only on Jac's explicit promote, after (1).

**Why this was missing.** Phases 0–6 assumed `main` was already the integrated latest. It wasn't. At cutover the long-lived `staging` branch was **~1089 commits ahead of `main`** (real *net* divergence: **26 files**), carrying features that never rode a `Promote staging → main` squash. Trunk-based development can't be "clean" until that pre-existing work is reconciled onto the trunk. (Surfaced 2026-07-13 when a `deploy-staging.mjs` run during the Phase-2 proof overwrote the staging *site*, which had been serving the `staging`-branch build — the branch itself was never at risk, and the site was restored from `staging`. The old cron mirror that used to publish the `staging` branch, `sync-staging.yml`, was already retired, which is also why the site had gone stale/behind the branch.)

**Audit (2026-07-13).** Net divergence = 26 files. `main` was ahead only by the Phase-0–5 redesign commits. `staging` held:
- ✅ **Account / Agreements + Membership auto-enrollment + payment-gate hardening** (design 2026-07-10) — *reconcile* (payment-gate = security-sensitive → main-session review, never delegated).
- ✅ **Customer Details reorg** — retire the Invoice card, embed invoices, Rental|Equipment-Sales funnel toggle (design 2026-07-08) — *reconcile*.
- ✅ **Assorted fixes/tweaks** — unit-detail accordions, KPI/invoice tweaks, a card-search perf fix, `design-system`/`rentals-dispatch` spec touches, `ci/logic-test.mjs` — *reconcile* (review first).
- ❌ **Mobile scroll-snap paging** (design 2026-07-12) — *excluded*: superseded by the newer side-scroll/swipe system built in the separate **frontend-performance** session. Mobile stays that session's domain; this reconcile does not touch it.

**Approach.**
- **Reconcile-into-the-trunk, NOT `staging → production`.** `staging`↔`main` is not a fast-forward either way, and the 1089 commits are unaudited — a blind promote would ship regressions. Instead: bring each *wanted* feature onto `main`, then promote `main → production` the normal (Gate-2) way.
- **Feature-by-feature, cleanest first, each its own trunk-flow PR** (feature branch → `deploy-staging` review → "merge it" → wait → "promote it"). Suggested order: **Customer Details reorg** (cleanest, a contiguous pre-mobile 07-08 block) → **Account/Membership** (largest; payment-gate care) → **assorted fixes**.
- **Port net feature diffs against `main`'s current state — do NOT cherry-pick blindly.** The squash-merge history plus the interleaving of the *excluded* mobile commits (07-11→07-13) with wanted work (account-field tweaks, unit-detail, perf) make raw cherry-picks fragile. Port each feature's `app.js`/`style.css`/spec hunks onto `main`, run every gate, and review on staging before "merge it."

**Guardrails.**
- **Never delete or force-push `staging`** — those commits are the only copy of that history until reconciliation is complete and confirmed.
- **Do not touch the frontend-performance area / mobile** (active in a separate session).
- `STAGING_DEPLOY_PAT` never echoed/hardcoded.
- The **A-vs-B** "where the combined accumulation surface lives" question (staging-as-preview vs staging-as-accumulation) is **deferred** until reconciliation lands: once `main` is the true latest, the separate combined surface largely dissolves and the staging URL can settle into the per-feature preview role (likely Option A).
