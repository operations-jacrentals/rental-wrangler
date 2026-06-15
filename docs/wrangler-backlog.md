# Rental Wrangler — Jac's task dump (2026-06-15)

Pinned backlog from the sticky-note photos, grouped into like-minded phases.
(FC = Field Call. Crossed-out notes are parked at the bottom.)

## ✅ Autonomous run summary (2026-06-15, on `claude/ui-overhaul-w55upw`)
Worked all 6 phases end-to-end. Every commit passed the 3 gates; each UI piece was
screenshot-checked. **All on the branch (PR #7)** — nothing auto-shipped to live.

- **Phase 1 — bugs:** ✅ right-click-over-preview · Complete-Rental feedback · Bill/Don't-bill toggle · fleet-dropdown z-index · Cancel/Reopen WO · footers-no-longer-change-mode · ✅ **For-Sale-in-availability** (units list now hides non-Active fleet under an availability window). The 2 units-list scroll bugs: **proven resolved at HEAD** (Playwright repro — Back/right-click-back/jog all restore the saved scroll; fresh opens land at top) — fixed by the Phase 2a/2b interaction work (#16/#17).
- **Phase 2 — chrome:** ✅ per-card striped-header colors · removed Dashboard · removed footer dashed line · Membership/Used-Sales swapped · +Unit pill hidden after first unit · Yard Mode already locked. (Graph icon delivered with Phase 4.)
- **Phase 3 — KPIs:** ✅ all four (Healthy Fleet, Parts Breakeven, Ready-Rate denominator, WO-Rate 20%/30-day goal-ring).
- **Phase 4 — graphs:** ✅ per-card Graph icon + the full Units graph (FC stats, leaderboard, FC-history bars, Inspection & Parts donuts, unit roster).
- **Phase 5 — WO/parts:** ✅ Part-in-Stock status · Part/Task autofocus + Enter-to-add · WO→failed-inspection link · failed-unit re-inspection gated on the last blocking WO.
- **Phase 6 — transport:** ✅ Calendar = daily driver timeline (D/R/🏠, times, deadlines, drag-reorder, sequential route order, day nav). ✅ **free-form route arrows** — click any stop icon then another to draw an arbitrary directional "from here → there" leg (kept per-day in localStorage, drawn in the route's left rail; re-draw a leg or click it to remove, "× N arrows" clears the day, Esc cancels a draw).

## Phase 1 — Bugs / broken controls (auto-fixer candidates)
> **Decision:** fix all on the feature branch (PR #7), batched with the redesign — not via the live engine (would collide with the branch).
>
> **Status (2026-06-15):** ✅ right-click-over-preview · ✅ Complete-Rental locked feedback · ✅ Bill/Don't-bill toggle · ✅ fleet dropdown z-index/preview · ✅ Cancel WO · ✅ footers no longer yank you out of Yard Mode.
> **✅ PINNED ITEMS — RESOLVED (2026-06-15, dogfooded the `wrangler-fix` prove-then-fix protocol):**
> - *Units list scrolls to a different spot on Back* + *Unit opens scrolled all the way down* — **could not reproduce at HEAD.** Playwright repro on the real app: scroll the list, open a unit (lands at top — correct), then Back via the button, right-click, and the back/forward jog — every path restores the exact saved scroll (e.g. 229/200/150). The Phase 2a/2b interaction rework (#16/#17) fixed it. **No code change** — shipping a speculative scroll edit would risk the working path.
> - *For-Sale machines in Category Availability* — **fixed.** Proof: §9 says non-Active units aren't rentable, and `isUnitAvailableFor`/`categoryAvailableCount` already drop *every* non-Active fleetStatus, so the count excludes them — but `unitsVisible` only hid Sold/Inactive, so a For-Sale machine still *listed* under an availability window while the count said it was gone. Fix: under an active availability window (`availWin`), the Units list shows only the Active (rentable) fleet — matching the count. The all-fleet / sold-inactive sorts still reveal them, and normal management views (no window) are untouched. (`app.js` §13.2 list build.)
- [ ] Right-click not working
- [ ] Right-click should win over the hover Preview
- [ ] "Complete Rental" button does nothing
- [ ] Can't cancel work orders → add a **Cancel** button left of "Complete WO"
- [ ] WO-failure "Charge the customer" / "Bill" / "Don't Bill" buttons never visually select
- [ ] Hovering a unit + changing fleet status → the options box is hidden behind the hover window
- [ ] Units list scrolls to a different spot when using the back button
- [ ] Unit opens already scrolled all the way down
- [ ] Machines marked "For Sale" still show up in Category Availability
- [ ] Footers still triggering a "mode"

## Phase 2 — Header & card chrome
> **Decision:** the "decor" = the striped (hazard) card-header. Color per card type, each paired with black (#14181d): Customers **blue**, Rentals **green**, Units **yellow**, Categories **orange**, Invoices **red**, Calendar **pink**.
- [ ] Card decor: top border → Yellow / Green / Blue
- [ ] Remove the yellow dotted line in the footer toolbar
- [ ] Remove "Dashboard"
- [ ] Keep "Yard Mode", hide the other modes
- [ ] Add a "Graph" icon to the top-left corner of card headers (opens Phase 4)
- [ ] Swap the Membership & Used Sales sections
- [ ] Once one unit is added to a Rental, hide the "+Unit" pill

## Phase 3 — KPI / metric definitions
> **Decision:** KPIs are 0→100% goal-rings. WO-Rate = progress toward a GOAL of **20% of the last rolling-30-day inspections generating a WO** (hit 20% = full ring), same pattern as the sales-revenue-goal KPI.
- [ ] WO-Rate KPI is wrong — we WANT up to ~20% of inspections to spawn WOs (not a bad thing); fix the scoring
- [ ] Ready-Rate should NOT count Failed / Inactive / Sold units
- [ ] Rename "Renting Rate" / Rentable → **"Healthy Fleet"**
- [ ] Rename "Bill Rate" → **"Parts Breakeven"** (= share of parts cost covered by earnings from billed WOs)

## Phase 4 — Graphs dashboard (behind the new Graph icon)
> **Decision:** per-card Graph view (a sibling to Board View), **Units first**. Other cards get their own charts later.
- [ ] Units Graph: "Days Since FC" (e.g. 15) + "Most FCs" leaderboard (Whiskey 5 · Cameron, Baba 6 · Dave, Mama 1 · Dave)
- [ ] Bar graph: FC history
- [ ] Pie: Ready / Not Ready / Failed
- [ ] Pie: Need Parts / Parts Ordered / Not Needed
- [ ] Rows of units beneath

## Phase 5 — WO / Inspection / Parts workflow
> **Decisions:** (a) a failed unit must NOT move to "not ready" until *that specific failure's* WO is completed — unrelated completed WOs don't trigger it; verify, leave alone if already correct. (b) "Part in Stock" = a new WO part-journey **status**, positioned right after "Part is Local."
- [ ] Add a "Part in Stock" button
- [ ] Link to the failed inspection from the work order (and back)
- [ ] Completing a failed-inspection WO auto-changes the unit to "not ready" — decide intended behavior
- [ ] +Part/Task box: focus the Part/Task text field by default
- [ ] "Add line" should be confirmable with the Enter key
- [ ] (related to Phase 1 billing-button bug)

## Phase 6 — Transport scheduling ("Auto-Enter") — big feature
> **Decision:** lives on the **Calendar card** as a **daily driver timeline** (the 7/9/10/12/2/3 are stop TIMES; rows = stop with D/R/🏠 icon + unit + town, auto-filled from each rental's delivery/recovery dates). **Full build at once:** auto-fill + bold-red deadlines + drag-drop reorder + click icon-to-icon route arrows.
- [ ] A schedule that auto-enters transports from Rentals
- [ ] Icons: Delivery (D) / Recovery (R) / Home-JAC (🏠), e.g. "7 [D] Bojangles: Lake Charles", "9 🏠 102 S Huntington", "10 [D] Skittles: Moss Bluff", "12 [R] Whiskey: DeRidder"
- [ ] Drag & drop to order/assign
- [ ] On drag, show the deadline in **bold red** on the schedule
- [ ] Click icon-to-icon to draw a route arrow ("driver from here → there")

---
### Parked (crossed out on the notes)
- ~~WO Completion Rate: Last 30~~
- ~~Hide "Returned"~~
