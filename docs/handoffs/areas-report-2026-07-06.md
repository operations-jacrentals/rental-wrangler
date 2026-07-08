# Areas Report — 2026-07-06

**Scope:** every `area/*` branch + the two trunks (`main`, `staging`), open PRs, and hygiene findings.
**Method:** `git rev-list --left-right --count` per branch vs both trunks, tip SHAs, merge history, and the open-PR list. Counts vs `main` are inflated by design — `main` only takes squash-merges, so content that already shipped still "counts" as ahead. Read the *content* columns, not just the numbers.

## TL;DR

- **`staging` is carrying almost everything.** It is ~722 commits ahead of `main`, dominated by the **2026-07-06 autonomous sprint** (`build/areas-sprint`, drops 1–7, all gates green) that shipped work for 16 areas straight to `staging` — see the Build log in `docs/specs/AREAS-ROADMAP.md` (on `staging`). Rulebook Phase 1a/1b is in there too. None of it is on `main` yet.
- **14 of 17 area branches are parked at the identical commit** `f12aa77` (#393, 2026-06-27, "Wrangler agentic Stage 1"). They hold **zero unique work** — everything they had is already in `staging`. The sprint bypassed them (task work merged via `build/areas-sprint`), so area branches currently do NOT reflect the true state of their domains; `staging` does.
- **Only two areas have their own in-flight work:** `area/design-system` (Rulebook Phase 1a/1b, 11 commits, all already in `staging`, awaiting promotion) and `area/backend-data` (freshest — rebased onto today's `main` + 3 commits for the backend deploy queue, **not** in `staging`, with PR #487 open into it).
- **`main` has 5 commits `staging` doesn't have** (today's bespoke-glyph work #476–478 and the fold-invoice fix #483/#484). A `main → staging` sync is needed before the next promotion or those fixes regress.
- Hygiene: 2 area branches were missing from the `/start` branch map (fixed in this PR), 3 stray utility branches linger, and 12 `[Backlog]` draft PRs from 2026-06-26 target `main` directly — several likely obsoleted by the sprint.

## Trunks

| Branch | Tip | Notes |
|---|---|---|
| `main` (live) | `ae72791` 2026-07-06 — cache-bust for the #483 fold-invoice fix | 5 commits not yet in `staging` (#476, #477, #478, #483, #484 — glyphs + fold-invoice wrap) |
| `staging` | `108131e` 2026-07-06 — merge `build/areas-sprint` (drop 7) | ~722 commits ahead of `main`: the whole 2026-07-06 sprint + Rulebook Phase 1a/1b + earlier accumulated area work |

## Area-by-area

**Parked group — 14 branches, all at `f12aa77` (2026-06-27), 0 unique commits, fully contained in `staging`, 50 behind `main`:**
`rentals-dispatch`, `invoicing-payments`, `customers-crm`, `memberships`, `units-fleet`, `maintenance-shop`, `financials-kpi`, `comms-notifications`, `hr-compliance`, `sales-growth`, `maps-location`, `search-views`, `mobile-remote`, `frontend-performance`, `wrangler-ai` *(15 names listed because `frontend-performance` + `wrangler-ai` are in this group too)*.

Being 50 behind `main` is normal — `/start` §3 refreshes an area from `main` when a task branch is cut. The real finding is that **the sprint's per-area work (see Build log table in `AREAS-ROADMAP.md`) lives only on `staging`**, so these branches are stale as domain snapshots until the next promotion + refresh cycle.

**Divergent areas:**

| Area | vs `main` | vs `staging` | What's on it |
|---|---|---|---|
| `area/design-system` | +11 (43 behind) | 0 ahead (all merged) | Rulebook Phase 1a (mute green token) + Phase 1b-1…2d (tier CSS, focal-Primary on list rows / GPS detail, retire Rentals Not-Ready blocker, G1 commit-ramp on Complete Rental/WO), R0–R25 spec. Last touch 2026-07-01. **Done at area level; waiting on promotion.** |
| `area/backend-data` | +3 (0 behind — on today's `main` tip) | +8 / 722 behind | Backend deploy queue: service-account path, `perfReport` sink, deploy guard (#486) + the 27-area spec/roadmap docs sync. **Not in `staging` yet.** Draft PR **#487** (skills: push-then-EDITOR-deploy recipe) open into it. |

## Open PRs (30) — triage

- **Into an area (healthy flow):** #487 → `area/backend-data` (draft, today).
- **Active fix PRs → `main`, non-draft, awaiting review:** #481 (Overdue Return flag, today), #446 (extension re-tiers paid rental), #418 (Transport filter), #336 (card-on-file role gate), #297 (printable Membership Agreement), #292 (unnamed `claude/blissful-fermi` — needs a look or close).
- **12 `[Backlog]` drafts (2026-06-26, #364–#376)** all target `main` directly — pre-date the area flow. Candidates **likely obsoleted by the 2026-07-06 sprint** (verify before closing): #372 (move enroll button — sprint shipped memberships D5 "sign-up moved to account-level agreement popup"), #364/#365 (red legibility / blue buttons — sprint shipped the design-system contrast hard-gate + flag-override engine). The rest should be retargeted to their `area/*` per the map.
- **Feature/infra drafts:** #485 (backend service-account deploy — overlaps `area/backend-data` #486; reconcile), #466 (remove Shop card), #458 (jactec-ui re-spec), #423/#409 (texture/UI showcases), #407 (Wrangler ops chat bridge), #398 (Areas-Roadmap docs — roadmap now lives on `staging`; likely supersedable), #354 (Mr. Wrangler prompt caching), #345 (membership trigger E2E), #312 (no-card 90-day window).

## Hygiene

- **Branch map was missing 2 real areas** — `area/frontend-performance`, `area/wrangler-ai`. **Fixed in this PR**, plus a note that the 27-area roadmap includes areas with no branch yet (Customer Portal, Equipment Insurance, Collections, Market Research, Automated Pricing…).
- **Stray utility branches:** `backup/staging-2026-06-23`, `deploy/staging-to-main`, `promote/filter-resolved-items-to-main` — janitor candidates once confirmed dead.
- `/start` §2 says to read `MEMORY.md`; no such file exists in the repo (local-only or never created) — worth reconciling the skill text.

## Recommended next actions (Jac's call)

## Outcomes — executed same-day (this session, with Jac's popup sign-off)

- ✅ **`main` → `staging` synced** (merge `44fe43c`): glyphs #476–478 + fold-invoice #483/484 now in staging. `?v=` bumped to `20260706i`; conflicts (token, generated code map) resolved; smoke + logic 439/439 + all drift guards green on the merged tree before push. Mirror picks it up on its 10-min cron (couldn't force `sync-staging.yml` — mirror repo outside session scope).
- ✅ **Backlog sweep:** #367 + #372 closed as shipped (evidence in closing comments); #364/#365/#375 → `area/design-system`, #366/#370 → `area/units-fleet`, #368/#374 → `area/search-views`, #369 → `area/invoicing-payments`, #371/#373 → `area/customers-crm`, #376 → `area/rentals-dispatch` (bases retargeted). All 13 were ticket-doc placeholders; every verdict verified against staging/main code.
- ✅ **Non-draft triage executed:** #297, #292, #418 closed as superseded/retired-architecture (evidence in comments). #481's "smoke" failure was actually the **code-map drift guard** — merged current main in, regenerated the map, pushed; **CI now green**. #446 was verified genuinely unshipped and green — awaiting Jac's merge call.
- ✅ **ACH money-gate gap fixed** (found triaging #336: card half shipped in #335, ACH half never landed — `+ACH`/`openAddBank`/`js-add-ach` had no `canMoney()` gate). Fix on `customers-crm/ach-money-gate` → **PR #489** into the freshly main-refreshed `area/customers-crm`; mirrors the card pattern at all three sites; all gates green locally (note: `ci.yml` only runs on PRs targeting `main`, so area-targeted PRs rely on the local gate run). #336 can close once #489 lands.
- Repo note for future cloud sessions: the container clone is **shallow** — `git merge` across old branch points fails with "refusing to merge unrelated histories" until `git fetch --unshallow origin`.

## Remaining next actions (Jac's call)

1. **Promotion decision:** `staging` now holds the entire sprint + Rulebook 1b + today's synced fixes. When ready: bump `?v=`, force the mirror sync, run the combined Staging E2E, then ONE PR `staging` → `main`.
2. **After promotion, refresh the parked area branches** from the new `main` so they reflect their domains again (or formally adopt the sprint's staging-first flow and update `/start`/branch-map to match).
3. **Merge `area/backend-data` → `staging`** when the deploy-queue story is settled (and reconcile #485 vs #486).
4. **Review/merge calls:** #446 and #481 (both green, both real fixes), #488 (this report), #489 (ACH gate → area).
5. **Branch janitor** on the 3 stray branches.

From the roadmap's own "Next session queue": rentals-dispatch driver-laned rail (`units[].leg.driverId`, big), the No-Show semantics design pass, maintenance-shop per-category/per-unit service schedules, Flags-editor severity polish, portal scaffold (blocked on comms).
