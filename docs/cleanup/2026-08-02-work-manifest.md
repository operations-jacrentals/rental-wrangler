# Work manifest — what's actually unfinished (2026-08-02)

**Why this exists.** Sessions piled up without the archive-as-you-go ritual, and it stopped being
possible to tell which chats still held unmerged work. This is the map: every open PR and every
remote branch, with a verdict and an action. Built once, from content — not from memory.

**How to use it.** Find the PR a chat was working on. If its row says **CLOSE** or **SHIPPED**, that
chat is safe to archive. If it says **RESCUE** or **DECIDE**, the work is real and still waiting.

**Method.** For every ref: `git merge-tree --write-tree origin/trunk <ref>`. Resulting tree equals
trunk's tree → the content is already on trunk. Non-zero exit → it no longer merges cleanly. This is
content-based on purpose: the repo **squash-merges**, so SHAs differ after merge and
`git branch --merged` gives wrong answers here.

> **Gotcha that corrupted this analysis TWICE — carry it into `MEMORY.md`.**
> Cloud sessions clone shallow (`depth=50`), and on the sandboxed git proxy **any plain `git fetch`
> re-applies `.git/shallow`**, truncating `origin/trunk` to **one reachable commit**. It is not one
> bad command — it recurs after every fetch. `git fetch --unshallow` reported success and
> `git rev-parse --is-shallow-repository` answered `false` while `.git/shallow` was still on disk, so
> **that check cannot be trusted.**
>
> It bit twice, with two different disguises:
> 1. Every `merge-base` against trunk returned "no merge base" — reading exactly like 62 branches
>    sharing no history with trunk.
> 2. Later, the absorbed set came back **empty** — reading exactly like "nothing is safe to delete."
>
> Both are artifacts. The reliable tell is `git rev-list --max-parents=0 origin/trunk` returning
> trunk's own HEAD: **a repository's root commit can never be its own tip.** Repair with
> `rm -f .git/shallow && git fetch origin '+refs/heads/*:refs/remotes/origin/*'` (830 commits
> return), then measure *without fetching again in between*.
>
> `tools/prune-absorbed-branches.mjs` now encodes this: it repairs the state, then **asserts trunk is
> deep and exits 2 if not**, rather than reporting a confident wrong answer.

---

## The board at a glance

| | Count | Meaning |
|---|---|---|
| Open PRs | **64** | |
| — Dead base | 14 | Base is a frozen `area/*` or the retired `staging`. Cannot merge as-is. |
| — Parked notes | 12 | No code. A to-do list stored as PRs. |
| — Conflicts | 28 | Real content, no longer merges cleanly. **This is where the valuable work is.** |
| — Has work | 10 | Merges cleanly. All design-exploration or stale docs — no live app code. |
| — Absorbed | **0** | Nothing closes for free. |
| Remote branches | **296** | 22 absorbed · 41 has-work · 233 conflicts |

**The single most useful fact:** zero PRs are absorbed. Every one still carries unmerged diff. The
pile is real, not an illusion of stale metadata.

**The second most useful fact:** most "conflicts" are not code fights. `docs/code-map.generated.md`,
`rule-usage.js`, and the `?v=` cache-bust token regenerate on every trunk change, so nearly any
branch older than a few days collides on those files even when its feature code would apply cleanly.
A conflict verdict here means *stale*, not *broken*.

---

## 1. CLOSE — 14 dead-base PRs

All 14 point at a base branch that the 2026-07-13 trunk/production switch retired. They cannot merge
through GitHub regardless of content value.

**Eleven are `[Backlog]` tickets** — one markdown note each, no code:
#376 #375 #374 #373 #371 #370 #369 #368 #366 #365 #364

**Three carry real content and are salvaged into `backlog.md` before closing:**

| PR | Content | Verdict |
|---|---|---|
| **#499** | SMS-consent clause (§20/§21) added to Rental + Membership agreements, version-frozen under `AGREEMENT_VERSIONS` so existing signings keep resolving old text | ⚠ PII/compliance — **the clear keeper.** Re-cut onto trunk. |
| #529 | Backend handoff doc for STOP/START/HELP keyword auto-reply (A2P/10DLC) | Salvage the doc |
| #528 | Bulk one-time `docs/specs/*` sync | Likely superseded by trunk's own docs |

---

## 2. RESCUE — the work actually worth recovering

All in the CONFLICTS bucket. Ranked by value to the business. ⚠ = touches money, auth, PII, or
work-order completion.

| # | PR | What it does | Flag |
|---|---|---|---|
| 1 | **#755** | Damage Charge line item on invoices, including already-paid ones. Append-only line + audit log; never touches `amountPaid`/Stripe directly; pre-materializes existing payment allocations so paid lines stay paid | ⚠ money — carefully guarded, closest to mergeable |
| 2 | **#446** | Extending a rental across a paid-invoice spill boundary didn't credit already-billed days toward the cheaper weekly/4-week tier — customers were **overbilled** | ⚠ money — ships with logic-test coverage |
| 3 | **#507** | Turns one generic "declined" into specific issuer-block messages (pickup/stolen/fraud → "get a different card") | ⚠ money-adjacent — text only, no charging logic |
| 4 | **#743** | Four Categories-card math bugs: cancelled WOs counted as repair cost, voided/no-show rentals counted as revenue, Sold/Inactive units shown "Available", silent $0 rates. Distorts the ROI numbers fleet decisions run on | Financial display |
| 5 | **#499** | SMS consent agreement text (see §1 — currently stranded on a dead base) | ⚠ PII/compliance |

**Solid, lower urgency:** #742 (warn-never-block on unfit units + implausible hour meter readings —
motivated by a 10× typo that sat live 26 days) · #751, #741 (UNITS navigation + audit-log ordering
fixes) · #272 (reverse customer↔unit search) · #748 (dispatch pickup leg discarded the rental's real
return time) · #590 #548 #544 #600 (mobile layout/toolbar decluttering).

**#285 — partial/per-line refunds. ⚠ money — LIKELY SUPERSEDED, verify before closing.**
The PR's own guard comment says it is hard-gated behind `PARTIAL_REFUNDS_ENABLED = false` because
flipping it before the backend honors partial amounts would **over-refund real money on the shared
production Stripe account**. That describes the PR's 40-day-old branch, not reality:

```
app.js:8059 (trunk)       const PARTIAL_REFUNDS_ENABLED = true;
app.js:8198 (production)  const PARTIAL_REFUNDS_ENABLED = true;
```

The feature is **already live in production**. So #285 is a stale record of shipped work, not
pending work.

**Separate open safety question, pre-existing and not from this session.** `backlog.md` records that
this flag was flipped to `true` in production *"with no in-repo writeup confirming the
deploy→verify→flip sequence Decision D1 required was actually followed in order."* Since the flag is
live and money moves through it, that ordering is worth confirming with whoever flipped it. It is
**not** part of the trunk→production gap — both sides already read `true`, so promoting changes
nothing here.

**#750 — crew SMS alerts.** Inert twice over: default-off Settings flag *and* a hardcoded
`STAFF_ALERTS_LIVE = false`. Safe to merge as a no-op.

**#749 — driver Mine/All scoping.** ⚠ auth. Changes what a driver login can see. Needs an explicit
review of the visibility boundary, not a routine merge.

---

## 3. CONSOLIDATE — 12 parked notes

Zero code between them. Each is a follow-up note wearing a PR costume — the worst possible storage
for a to-do list, because it makes the PR board unreadable.

#791 #787 #732 #731 #723 #710 #706 #647 #641 #621 #615 #612

**Action:** fold the contents into `backlog.md` (or `MEMORY.md` for #710, which is literally a
MEMORY patch), then close all 12. Not yet done — awaiting the go-ahead.

---

## 4. DECIDE — needs a human call

| PR | The question |
|---|---|
| **#259** | Flag-color system + list-row redesign (+1151/−205, 12 commits). The largest substantive PR here. `wrangler-style` has moved a long way since 06-23 — likely **redo the intent, not the diff**. |
| **#174** | ⚠ money. Membership monthly/annual billing. But #635 and #345 both reference membership-billing work that shipped *after* this opened. Redundant, partly superseded, or still additive? |
| **#312** | Bundles a real no-card-flag improvement with an apparently unrelated removal of Settings → Layout & Footers. Should be split before merging. |
| **#696** | ⚠ auth design. Per-person logins replacing shared role-passwords — doc-only, addresses a stated pain point, needs a build decision. |
| **#550** | Predates the 07-13 trunk rename that already rewrote this exact routing rule. Likely superseded. |
| **#398** | 14k-line Areas Roadmap bundle, likely superseded by `docs/specs/AREAS-ROADMAP.md` on trunk. Needs a content diff. |
| **#354 / #345** | Both PRs' own text says the underlying work is deployed/live. Likely closeable as historical record. |

---

## 5. Design exploration — 10 HAS-WORK PRs, no live app code

#795 (**active — the redesign, leave alone**) · #753 Remotion logo intros · #673 R-Rulebook UI census
· #603 logo drafts · #458 jactec-ui re-spec (targets a **deleted** skill) · #423 texture library ·
#409 UI showcase · #354 · #345 · #33 (48 days old, describes long-superseded state).

These merge cleanly but are sandbox/branding/doc artifacts. Low risk either way.

---

## 6. Branches — 296 total

- **22 absorbed** — content already on trunk, safe to delete.
- **41 has-work** — but read the list before reacting: ~30 are single-commit `Backlog ticket:` or
  `Park:` notes. Only a handful carry real code.
- **233 conflicts** — mostly ancient. `mobile/phone-2col-and-paging` is 442 commits ahead of its
  merge base; `reconcile/staging-into-trunk` is 485. That lineage predates the trunk rename and is
  **archive, not backlog**.

**21 branches are provably safe to delete** — verified by content, holding back trunk, production,
the current branch, and any open-PR head. Run `node tools/prune-absorbed-branches.mjs` for the dry
run and `--yes` to execute.

⚠ **Deletion cannot be done from a cloud session.** The sandboxed git proxy returns **HTTP 403** on
ref deletion (it permits pushes to the session's own branch, not deletes), and the GitHub MCP server
exposes no branch-delete tool. The `--yes` path has to run from a session with real push rights —
a local machine — or the branches get deleted from the GitHub UI.

**The decay mechanism, in one line:**

```
wrangler-fix/reverse-renter-search   1 commit ahead   344 behind   CONFLICTS
```

A genuine one-commit fix, stranded behind 344 commits of drift, conflicting on generated files.
Rescuable today; harder every week. This is the argument for triaging now rather than later.

---

## 7. Production drift

`trunk` sits **42 commits / 15 days** ahead of `production` (last moved 2026-07-18).

- **35 commits are docs/skills/design artifacts** — promoting them is a no-op for the running app.
- **7 touch served files:**
  - Four real bug fixes, unshipped since Jul 18 — `705ea12` (four RENTALS dispatch bugs incl. a
    **field call against the wrong unit**), `e743184` (Trips overdue count + map eating the driver's
    first screen), `1c9612d` (Trips scroll position lost on every render), `56d9108` (drag
    auto-scroll no-op).
  - `7f68941` — dv2 redesign. 381 CSS lines, **every one scoped `html.dv2`**, with
    `designV2: false`. Inert in production.
  - `4c8d5a4` — dev login. Gated by an `APP_ENV === 'local'` **allowlist**; the listener isn't even
    registered off localhost, so there's no fail-open on production or the public staging mirror.
    Password typed at runtime, never in the repo. **Audited — safe.**
  - `19faddb` — `app.js` split into `src/` modules. 355+/261−, 5 new files. The one item that
    genuinely earns a staging boot check.

---

## Why this happened, and the fix

The overhaul avoided staging out of fear of pushing an unfinished redesign at the live app. **That
risk was already engineered away**: `designV2` ships `false`, auto-flips ON for staging/local, and
every redesign selector is `html.dv2`-scoped. The redesign could have ridden the normal pipeline the
whole time.

What actually broke was the closing ritual. Work merged to trunk and stopped there; PRs opened and
never closed; parked notes accumulated as PRs. `MEMORY.md` still records PR #789 as *"open/draft, NOT
yet merged to trunk"* — it merged, as commit `8dcdfb0`. When cross-session memory drifts, every new
session re-derives the board from scratch, which is exactly the tax that made this feel unmanageable.

**Structural fix worth making:** `.claude/.session-prs` is gitignored and dies with the container, so
the session→PR link is lost on every fresh cloud session. That's the weakest link in the
archive-as-you-go ritual and the reason it stopped self-healing.
