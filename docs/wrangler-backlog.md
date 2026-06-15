# Rental Wrangler — Jac's task dump (2026-06-15)

Pinned backlog from the 5 sticky-note photos, grouped into like-minded phases.
(FC = Field Call. Crossed-out notes are parked at the bottom.)

## Phase 1 — Bugs / broken controls (auto-fixer candidates)
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
- [ ] Card decor: top border → Yellow / Green / Blue
- [ ] Remove the yellow dotted line in the footer toolbar
- [ ] Remove "Dashboard"
- [ ] Keep "Yard Mode", hide the other modes
- [ ] Add a "Graph" icon to the top-left corner of card headers (opens Phase 4)
- [ ] Swap the Membership & Used Sales sections
- [ ] Once one unit is added to a Rental, hide the "+Unit" pill

## Phase 3 — KPI / metric definitions
- [ ] WO-Rate KPI is wrong — we WANT up to ~20% of inspections to spawn WOs (not a bad thing); fix the scoring
- [ ] Ready-Rate should NOT count Failed / Inactive / Sold units
- [ ] Rename "Renting Rate" / Rentable → **"Healthy Fleet"**
- [ ] Rename "Bill Rate" → **"Parts Breakeven"** (= share of parts cost covered by earnings from billed WOs)

## Phase 4 — Graphs dashboard (behind the new Graph icon)
- [ ] Units Graph: "Days Since FC" (e.g. 15) + "Most FCs" leaderboard (Whiskey 5 · Cameron, Baba 6 · Dave, Mama 1 · Dave)
- [ ] Bar graph: FC history
- [ ] Pie: Ready / Not Ready / Failed
- [ ] Pie: Need Parts / Parts Ordered / Not Needed
- [ ] Rows of units beneath

## Phase 5 — WO / Inspection / Parts workflow
- [ ] Add a "Part in Stock" button
- [ ] Link to the failed inspection from the work order (and back)
- [ ] Completing a failed-inspection WO auto-changes the unit to "not ready" — decide intended behavior
- [ ] +Part/Task box: focus the Part/Task text field by default
- [ ] "Add line" should be confirmable with the Enter key
- [ ] (related to Phase 1 billing-button bug)

## Phase 6 — Transport scheduling ("Auto-Enter") — big feature
- [ ] A schedule that auto-enters transports from Rentals
- [ ] Icons: Delivery (D) / Recovery (R) / Home-JAC (🏠), e.g. "7 [D] Bojangles: Lake Charles", "9 🏠 102 S Huntington", "10 [D] Skittles: Moss Bluff", "12 [R] Whiskey: DeRidder"
- [ ] Drag & drop to order/assign
- [ ] On drag, show the deadline in **bold red** on the schedule
- [ ] Click icon-to-icon to draw a route arrow ("driver from here → there")

---
### Parked (crossed out on the notes)
- ~~WO Completion Rate: Last 30~~
- ~~Hide "Returned"~~
