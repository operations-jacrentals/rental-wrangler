# HANDOFF — Calendar/Driver card audit + fixes

**From:** a local session, 2026-07-18. **To:** a cloud session picking this up cold.
**Read this whole file before touching anything.** Several things here will bite you.

This document was adversarially audited before handoff (facts / dropped-work / cold-start angles);
four blockers were found and corrected. It should be self-contained.

---

## 0. What this work is

A `/lazy-audit` of the **Calendar (Trips) card** — where the **Driver** role lands
(`ROLE_LANDING.driver → member:'calendar'`). Audited as **"Dewey"**, a lazy driver who won't
scroll, won't read, won't infer. Method: 6 lens agents + 3 completeness critics + 78 adversarial
skeptic votes against **`origin/production` bytes** (SHA256-verified, `?v=20260718i`), plus **two
live drives of real production** in a signed-in browser (55 interactive elements clicked).

There is a private artifact at `https://claude.ai/code/artifact/266b522a-81cd-41b7-af39-575d2a8e6d9a`
(Jac's account). **Nothing here depends on it** — it is visual evidence only, already summarised
below. A cloud session cannot read it; don't try.

---

## 1. Decisions Jac has ALREADY made — do NOT re-ask

| Question | His answer |
|---|---|
| Audit target | Calendar/Driver card (not Customers) |
| Live-drive permission | May create ONE obviously-fake test record; may exercise real write flows on it |
| Trips badge semantics | **Outstanding work, any date** — count not-done trips, no date floor |
| Map default | **Collapse for the driver role only** |
| Town tap overwriting map pref | **Fix it** — override must be transient |
| Driver scoping behaviour | assigned to me **+** unassigned **+** a toggle to see everyone **+** unbound login sees all |
| Assignment alerts | **SMS via the existing comms path**; staff consent already covered |
| SMS triggers | assigned to a trip · trip time changed · morning summary. **NOT** removed-from-trip |
| SMS testing | **Stub the sends** until Jac approves the exact messages |
| Branch strategy | **Separate branch per fix** |
| Promote range incl. §dev-login | **Approved to ship** |
| Ship depth | `/live` — his explicit call. See §3 for exactly which PRs that covers |

**One decision worth RE-ASKING (do not treat as settled):** Jac declined a *"Today" map-reset
control*. He was asked as though it were new UI. In fact `app.js` already carries dead handlers for
exactly this — `.js-disp-day` and `.js-disp-today` (commented "§2.3 dispatch timeline — day nav…
Phase 6") — and a repo-wide grep shows **no template ever emits those classes**. The narrower
question ("wire up the dead code that's already there?") was never put to him. See P-26.

---

## 2. State at handoff (verified 2026-07-18)

```
production   0fac006   ?v=20260718i
trunk        1c9612d   ?v=20260719b   ← contains #744
```

| Item | Branch | Token | Status |
|---|---|---|---|
| **#744** scroll-position fix | *(deleted)* | — | **MERGED to trunk**, not promoted |
| **#745** badge + map | `wrangler-fix/calendar-badge-and-map` | `20260719c` | OPEN, MERGEABLE, gates green, staging-reviewed (`calendar-badge-and-map-2`) |
| **#746** drag edge auto-scroll | `wrangler-fix/drag-autoscroll-cal-scroll` | `20260719c` | OPEN, MERGEABLE, gates green. Same root cause as #744 |
| pickup time + deadline label | `wrangler-fix/trips-pickup-time` @ `5c68252` | `20260719a` | Pushed, **no PR yet**, reviewed SHIP, predates #744 so needs a trunk sync |

**#745 and #746 both already sit at `20260719c`** — they collide with each other. Whoever merges
second gets caught by `check-cachebust` and must re-bump. Budget for at least two re-bumps (`d`, `e`).

**Other sessions' work, NOT yours, all currently CONFLICTING against trunk:** #741 units-audit,
#742 units-fleet readiness, #743 categories-derivation. **Do not touch or promote these.**

---

## 3. The ship (do this first)

Jac's `/live` covers exactly these three: **#745, #746, and the pickup-time PR.** Nothing else.

1. **Open the pickup-time PR.** Sync `wrangler-fix/trips-pickup-time` onto trunk first — resolve
   `docs/code-map.generated.md` by regenerating (`node tools/gen-code-map.mjs`, never hand-merge),
   and `index.html` by taking trunk's copy then re-bumping (§5 gotcha 2). Re-run gates, re-`/deploy`
   (staging must show the branch's CURRENT commit), then PR.
   **Before merging this one specifically, surface P-25 to Jac** — see §4c.
2. **Merge #745, #746, and the pickup-time PR**, one at a time. Each merge moves trunk, so the next
   needs a fresh sync + token re-bump.
3. **Then ONE `/promote`** covering those three plus the already-merged #744. Not one per branch,
   and explicitly **not** #741/#742/#743.

The gates, `/deploy`, `/merge`, `/promote` and `/live` are all documented in **CLAUDE.md** — read it.
This file deliberately does not repeat them.

---

## 4. Specified but NOT built

### 4a. Driver scoping — "my trips"

Fully specified (§1). The card currently renders the whole yard's board with no notion of who is
looking at it.

- **`myRosterId()` already exists** — matches the typed login name against a Settings → Team Roster
  entry, returns that employee's id or `null`. Verified present.
- Trips carry `driverId` (`eu.deliveryDriverId` / `eu.recoveryDriverId`).
- **Trap:** `driverRoster()` uses `e2.id || e2.name` as the id, so an employee with no `id` yields
  the NAME, while `myRosterId()` returns `String(hit.id)`. Match tolerantly on both or a roster gap
  silently empties a driver's card.
- **House precedent to mirror:** an unbound login currently sees ALL team chats rather than an empty
  list.

### 4b. SMS assignment alerts

- Route through the **existing comms path** the yard already uses for customers.
- Triggers: assigned to a trip · trip time changed · morning summary.
- **STUB THE SENDS.** Build the path, log what *would* go out, show Jac the exact messages and
  recipients. Consent being handled is NOT permission to fire live texts while developing.
- `sw.js` has **no push listener at all** (verified) — browser push is not a shortcut. SMS was
  chosen deliberately over push.
- **Scope note:** this covers only the SMS half of F-1. The **in-app toast + badge** half — so
  office/dispatch users see an assignment without being the SMS recipient — is still unbuilt and
  unspecified.

### 4c. The `r.endTime` question (gates the pickup-time PR)

The pickup-time fix makes the recovery leg read `r.endTime || ''` instead of a hardcoded `''`.

**`r.endTime` IS written in production today** — by `WR_OPERATIONS.startRental`, the in-app
Mr. Wrangler AI booking flow (`endTime: win.time`; confirmed verbatim on `origin/production`). An
earlier draft of this handoff wrongly called the fix "inert"; that was wrong and is corrected here.

What is still **open**: whether the *normal, non-AI* rental-creation UI or the Google Sheet ever
populate it. If they don't, most pickups will still render blank (now labelled "by 5:00p" rather
than "—:—", which is at least honest). **Ask Jac whether the rentals sheet has a return-time column
before merging that PR** — the answer decides whether a UI to set pickup times is needed next.

---

## 5. Gotchas that WILL bite you

1. **Cloud sessions cannot browser-drive the staging or production URL at all.** The TLS proxy CA
   is untrusted by headless Chromium and `github.io` is HSTS-preloaded, so it hard-fails with
   `ERR_CONNECTION_RESET` — not a soft warning. Written up in the repo's own **PR #621**
   (`parked/cloud-chromium-proxy-ca`). **Workaround:** `curl` the `app.js ?v=` token to prove
   byte-freshness, and do visual/functional review against a **local `#local` render of the same
   files**. Do not burn time re-discovering this.
2. **Never `git add -A` during a conflicted merge.** It stages files with `<<<<<<<` markers intact.
   This session committed a broken `index.html` that way and only caught it because the token check
   printed two values. `index.html` conflicts are always just the `?v=` token — resolve with
   `git checkout origin/trunk -- index.html`, then `node tools/bump-cachebust.mjs`. Then scan:
   `git grep -n -E '^(<<<<<<< |=======$|>>>>>>> )' HEAD`.
3. **`ci/check-cachebust.mjs` leaves the repo SHALLOW** (`git fetch --depth=1 origin trunk`). After
   that, `origin/trunk` looks like a 1-commit orphan, older PRs appear "missing", and merges die
   with **"refusing to merge unrelated histories."** Nothing is lost —
   **`git fetch --unshallow origin`** restores it (795 commits here). Expect this every time you run
   the gates then try to merge.
4. **Cache-token collisions are constant** — see §2. Re-bump, don't fight it.
5. **Git identity is LOCAL to the repo, not global.** `tools/deploy-staging.mjs` clones the staging
   repo to a temp dir where that config doesn't apply and dies with *"Please tell me who you are."*
   Pass it through rather than editing global config: `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` /
   `GIT_COMMITTER_NAME` / `GIT_COMMITTER_EMAIL` = `operations-jacrentals` / `operations@jacrentals.com`.
6. **`STAGING_DEPLOY_PAT` is not set** (confirmed in both local and a fresh session). `gh` IS
   authenticated with `repo` scope, so always run
   **`$env:STAGING_DEPLOY_PAT = (gh auth token)`** before `/deploy`. Never echo the value.
7. **`window.__rw` is `#local`-only.** You cannot census production data from the console.
8. **Testing role-dependent behaviour in `#local`:** priming `sessionStorage.jactec.role` does NOT
   reliably set `currentRole` on the demo boot path. Use **`window.__rw.setRole('driver')`**. Clear
   `sessionStorage`/`localStorage` between role tests — leftover state produced a false failure in
   this session, twice.
9. **Multiple sessions share the local checkout.** Work in a dedicated `git worktree` off trunk or
   you will branch from another session's HEAD (this session did, once).

---

## 6. LANE 1 — bugs cleared as safe to fix WITHOUT asking Jac

These were verified (analysis + two independent challengers each) as *"things that should already
work"* — real defects whose correct behaviour is unambiguous. **They do not need a Jac decision.**
Two of the original ten already shipped (#744) or were folded into #745; these six remain:

| # | Bug | Where |
|---|---|---|
| L-1 | **"Show more" is inert on Trips.** The handler does `activeSession().cards[card]` and bails on `if (cs)`; calendar is deliberately card-stateless, so the button does nothing. Trips past the virtualisation cap are unreachable. *(Needs a decision on where that state should live — flagged as the one genuinely ambiguous piece.)* | `.js-showmore` |
| L-2 | **Phone label renders the raw stored string** while `telHref()` normalises the href. Live, three rows showed a formatted shape and one a bare 10-digit number. **Note:** raw display IS the app-wide convention — vendors use the identical raw-label/normalised-href pattern, and there is **no phone formatter anywhere in app.js** — so fixing Trips alone would make it the odd one out. Decide scope: fix globally, or leave. | trip row · `telHref` |
| L-3 | **Merged trip: `+Log` is scoped to the primary stop** but gated on trip-wide done-ness, so after logging stop 1 the button still shows and re-targets the completed stop. *(Two plausible fixes — gate on the primary's own capture, or retarget to next-undone. Genuinely ambiguous; ask.)* | trip row |
| L-4 | **`_dispMapFailed` is sticky** — one dead zone leaves the map offline for the rest of the shift until manually toggled. *(Code comments call retry-on-user-action deliberate; retry cadence is a design call.)* | `_dispMapFailed` |
| L-5 | **Group header "N done" counts trips, not stops** — a 4-stop run with 3 logged reads as zero progress. *(Spec §2.1 defines the unit as the trip, so changing it is arguably a design change.)* | `groupSuffix` |
| L-6 | **Escape doesn't close dropdown menus** — it closes the transport editor, sign sheet and drag, but no Escape path calls `closeMenus()`. Verified live: the driver picker stayed `display:block`. *(Adding it changes dismissal behaviour.)* | `closeMenus` |

**Honest caveat:** the original pass cleared these as Lane-1, but the adversarial re-check found
several (L-1, L-3, L-4, L-5, L-6) have a defensible second answer. Treat them as *"fix it, but say
which way you went and why"* rather than *"guess freely."* Only L-2's scope question genuinely needs
Jac.

---

## 7. LANE 2 — parked, genuinely needs a Jac decision

| # | Issue (current behaviour) | Decision needed |
|---|---|---|
| P-1 | "Earlier" group is collapsed by default and not even rendered, hiding overdue runs | Should overdue lead the card? |
| P-2 | Group colours are static constants — Today is **always** red, Earlier **always** grey — so red carries no information | Colour by actual trouble? |
| P-3 | A blank stop time silently inherits a 5PM deadline (partly addressed: the empty input now reads "by 5:00p") | Does the row need more? |
| P-4 | `timeToMin` accepts only colon forms; `9am`, `0900`, `noon` parse to null and are silently discarded with no feedback | Accept more formats, or reject visibly? |
| P-5 | The row shows a town only; the full street address already exists in the link's `data-tip` hover | Put the address on the row? |
| P-6 | Tapping a **customer** pill replaces the middle column so Trips vanishes; tapping a **unit** pill opens the left column and leaves Trips mounted — same pill pattern, opposite consequences | Which is correct? |
| P-7 | Returning from a record works, but the control is an unlabelled bare chevron a driver won't recognise | Label it? |
| P-8 | "Open in Google Maps" only appears after a stop is focused; there is no per-row Directions button | Add one by default? |
| P-9 | `driverRoster()` falls back to **ALL employees** when no employee's role matches `/driver/i`. Latent today (one driver exists) — one role typo makes bookkeepers assignable | Show an empty-state instead? |
| P-10 | Trips is the only card with **no sort, no globe/global-search, no graph toggle** — its listbar is empty while Units and Customers carry "Name ▲▼" | Add them? |
| P-11 | Trips search is a plain substring match, not the shared AND-term engine — `"lake pick"` returns **0 rows** against a "Pick up" at "Lake Charles" | Unify search? |
| P-12 | On-Time KPI computes delivered ÷ scheduled — that is completion, not punctuality; a driver late on everything scores 100% | Rename, or recompute against the deadline? |
| P-13 | A failed walkaround-video upload toasts for two seconds and the row still stamps green "Logged" | Needs a queue + amber "pending" state |
| P-14 | The log gate is evaluated on tap, not at render — a blocked stop looks identical to a good one until the driver is at the drop, 40 miles out | Show a lock badge at list time? |
| P-15 | Sync footer reads "Offline — cached" before the first sync of a session | Code comments call this deliberate |
| P-16 | Overdue work never auto-flags late — only after someone manually runs Auto-Run | Auto-flag? |
| P-17 | Nothing indicates there are more trips below the fold | Add a "N more" affordance? |
| P-18 | The 18s refresh poll triggers a full re-render | Perf/UX tradeoff |
| P-25 | **`r.endTime` may not be populated outside the AI booking flow** — see §4c | Does the rentals sheet have a return-time column? |
| P-26 | **The map/list day desync.** `tripTownGo` writes `state.dispatchDay` and nothing writes it back — the map sits on another day while the list still says "Today", recoverable only by reloading. Dead handlers `.js-disp-day` / `.js-disp-today` already exist but no template emits them | Wire up the existing dead code? (Jac declined "build a new control" — this narrower question was never asked) |

## 8. LANE 3 — missing capability (feature work)

| # | Gap |
|---|---|
| F-1 | Driver assignment is silent — no toast, no badge, no push. **SMS half** is specified in §4b; the **in-app toast/badge half is still open** |
| F-2 | No push notifications at all; `sw.js` has no `push` listener |
| F-3 | No "running late" / "can't complete" from a trip row — the ⋯ menu offers only "Merge trip…". **A `+FC` Field Call button already exists on the Unit card** (verified), just not where the driver is standing |
| F-4 | Nothing reaches the customer — no ETA, no "on my way" |
| F-5 | No offline queue; nothing checks connectivity before a write |
| F-6 | Overdue work has no owner — raises nothing, notifies no one |

## 9. LANE 4 — operational, for Jac, not code

**Two units may be physically unaccounted for.** On live production the collapsed "Earlier" group
held four undone runs:

| Day | Task | Unit | Days late |
|---|---|---|---|
| 2026-05-01 | Deliver | "White" | **78** |
| 2026-05-01 | Deliver | "Squirrel" | **78** |
| 2026-07-10 | Deliver | "Alabama" | 8 |
| 2026-07-12 | Pick up | "Alabama" | 6 |

Either that equipment is in a customer's yard off the books, or these are stale records. The app
surfaces neither — excluded from the badge, collapsed by default. **Someone should check this
against the physical yard.**

---

## 10. Honesty notes about the work already done

- The audit's adversarial pass **refuted 0 of 26 findings** but downgraded 7 severities. A 0% kill
  rate deserves suspicion, which is why the top 8 were re-verified by hand (one correction: the
  `driverRoster` fallback is real but latent).
- One lens finding was contaminated by a bad fact fed to the agents — **"Frankenstein" and "Mace
  Windu" are UNITS, not drivers.** The underlying finding (no driver scoping) is independently
  true; only the illustration was wrong.
- The completeness critics out-performed the six lenses: the dead "Show more", the stops-vs-trips
  badge mismatch, the hardcoded pickup time and the offline data loss all came from them.
- This handoff's earlier draft claimed the pickup-time fix was "inert" based on a wrong reading of
  a `mock: true` flag. Corrected in §4c.
