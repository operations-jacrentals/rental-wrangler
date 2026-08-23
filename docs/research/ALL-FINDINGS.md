# All 171 findings

Sorted by severity, then card.

### 1. [RED] Calendar / Driver — The live map is hard-coded 260px tall inside the card's single 333px-tall scroll region, so on first paint it occupies 78% of everything the driver can see before a single trip row appears.

- **job:** figure out where he's going next, from the cab, in one glance
- **primitive:** map panel / shared scroll region · **failure:** invisible · **scope:** density · **role:** driver
- **cite:** `style.css:903; app.js:9652-9655, 11812`
- **evidence:** Measured live: .cal-scroll clientHeight 333px, scrollHeight 902px. Map open = 1 of 4 trip rows visible; map collapsed = 3 of 4 visible. tripsMapOpen() defaults true for every user/role/device on first load (v==null?true).

### 2. [RED] Calendar / Driver — The recovery/pickup leg of every trip is hardcoded to time:'' while the delivery leg reads r.startTime — a pickup can never carry a time regardless of what data exists.

- **job:** know when a pickup is due so he can plan his route
- **primitive:** row time field · **failure:** lying · **scope:** signal · **role:** driver
- **cite:** `app.js:11297-11298 (vs. delivery-leg convention at app.js:7123)`
- **evidence:** delivery leg: time: r.startTime || ''; pickup leg: literal time: ''. r.endTime is written by at least one production path (WR_OPERATIONS.startRental) and read in 3 other places in the same file, so the pickup leg ignores data the app already uses elsewhere.

### 3. [RED] Calendar / Driver — tripsFor()/dispatchEvents() apply zero identity filtering — every driver's trips plus the entire unassigned pool render on one shared list, even though the code's own landing comment calls this screen 'the driver's day.'

- **job:** see his own day, not the whole yard's dispatch board
- **primitive:** trip list / role landing · **failure:** unreachable · **scope:** architecture · **role:** driver
- **cite:** `app.js:11285-11302, 9674; landing comment at 25636-25644`
- **evidence:** Grep across the render path for any driver-identity filter: zero matches. myRosterId() already exists (app.js:10582) and is used to scope team-chat visibility, but is never wired into the Trips list.

### 4. [RED] Calendar / Driver — The Trips tab badge only counts stops dated today-or-later that aren't done; any undone stop from a prior day contributes zero to the number the driver glances at.

- **job:** trust the one number that's supposed to say what's still outstanding
- **primitive:** tab badge count · **failure:** lying · **scope:** signal · **role:** driver
- **cite:** `app.js:9471-9472`
- **evidence:** Live: badge read 4, while the collapsed 'Earlier' group held 6 total / 2 done = 4 more undone stops (two 78 days old) that never touch the badge. Comment at 9471 confirms the exclusion is deliberate but nothing distinguishes 'history' from 'never got done.'

### 5. [RED] Calendar / Driver — The 'Earlier' bucket — the only place undone past-day trips live — is the sole group on any card that defaults collapsed, and its color is a hardcoded 'gray' literal that can never receive red/danger styling no matter how many undone jobs it holds.

- **job:** spot the thing actually on fire without opening a closed drawer he doesn't know exists
- **primitive:** group header / severity color · **failure:** invisible · **scope:** signal · **role:** driver · **SYSTEMIC**
- **cite:** `app.js:9333, 9340 (color:'gray' hardcoded), 9358 (only default-collapsed group/card combo), 9423 (sec-danger only fires on color==='red')`
- **evidence:** Live-confirmed: 4 undone runs sat inside a collapsed 'Earlier · 6 · 2 done' group, two 78 days late. 'Today' is separately hardcoded red every day regardless of contents (app.js:9337), so red already carries no reliable signal even before Earlier's gray problem.

### 6. [RED] Calendar / Driver — The app-wide scroll-memory reads/writes .card-body's scrollTop, but on the Trips card .card-body is overflow:hidden — the real scroller is the nested .cal-scroll — so any render() (e.g. after assigning a driver) resets scroll position to 0.

- **job:** keep his place on a list he just scrolled through while dispatch works an assignment
- **primitive:** scroll position / render cycle · **failure:** inconsistent · **scope:** interaction · **role:** dispatcher
- **cite:** `style.css:900-901; app.js:17186-17190, 17229-17233; 18614-18615 (assign→render())`
- **evidence:** The defect actually spans 5 call sites, not 2: render() ×2, renderResults() ×2, and restoreJogScroll() ×1 — all read/write .card-body instead of .cal-scroll. A live control test showed scroll position 120→0 on unpatched code.

### 7. [RED] Calendar / Driver — assignStopDriver()'s only effect on a successful assignment is pushing a line into a hidden per-rental audit array — no toast, no badge write, no push, nothing addressed to the driver.

- **job:** find out he's been given a job without opening the app and reading every row
- **primitive:** assignment action / notification · **failure:** invisible · **scope:** signal · **role:** driver
- **cite:** `app.js:11341-11352 (assignStopDriver), 22575 (logAction — push+saveSoon only)`
- **evidence:** All 3 call sites traced (single-stop picker, drag-and-drop, bulk 'Round up'). The one toast() call anywhere in the chain fires in the DISPATCHER's own browser confirming their bulk action — never addressed to or visible on the assigned driver's device.

### 8. [RED] Calendar / Driver — The Show More handler reads activeSession().cards[card] and bails unless that's truthy — but Calendar is deliberately card-stateless, so the click is a guaranteed no-op. Past the 60-row cap, the rest are permanently unreachable.

- **job:** get to a trip past the visible cutoff on a busy day
- **primitive:** show more button · **failure:** unreachable · **scope:** interaction · **role:** driver
- **cite:** `app.js:19246 (handler), 2817 (calendar excluded from GRID_CARDS/card-stateless)`
- **evidence:** Latent on today's low-volume data but structurally guaranteed to fail the moment volume crosses the cap — confirmed from the card-stateless definition itself, not just observed behavior.

### 9. [RED] Calendar / Driver — The row prints a town name ('Lake Charles'); the full street address exists in the DOM but only as a hover tooltip (data-tip), which a driver in a truck with a glove on will never trigger.

- **job:** find the actual property without guessing or calling the office
- **primitive:** row address text · **failure:** invisible · **scope:** density · **role:** driver
- **cite:** `app.js:7366, 9670`
- **evidence:** Live DOM confirmed: data-tip holds the full address '1700 11th St, Lake Charles, LA 70601, US' sitting unused as a hover-only attribute instead of rendered text.

### 10. [RED] Calendar / Driver — tripTownGo() writes state.dispatchDay to the tapped stop's day but nothing ever resets it — the map can sit on a future day's pins while the list header above it still reads 'TODAY,' with no reset control anywhere on screen.

- **job:** trust that what the map shows matches what the list says he's doing today
- **primitive:** map panel / day state · **failure:** inconsistent · **scope:** architecture · **role:** driver
- **cite:** `app.js:11796; scan for any day-reset control returned none`
- **evidence:** Reproduced live: tapped Monday's town, map showed mapPanelDay:'2026-07-20' while list header still read 'TODAY · 2'; only recovery was a full page reload. Dead, unwired handlers for exactly this reset (.js-disp-day / .js-disp-today, commented Phase 6) already exist in the codebase but are never emitted by any template.

### 11. [RED] Calendar / Driver — tripTownGo() force-opens a collapsed map by calling tripsMapSetOpen(true), which writes to localStorage — a driver who deliberately collapsed the map to see his day has that choice silently and permanently reverted by one unrelated tap on a town.

- **job:** keep a screen preference he deliberately set, without an unrelated tap undoing it
- **primitive:** map toggle / persisted preference · **failure:** destructive · **scope:** interaction · **role:** driver
- **cite:** `app.js:11798 (force-open call), 11813 (setter writes localStorage)`
- **evidence:** Verified live: localStorage key jactec.tripsMap flipped '0'→'1' and visible rows dropped 3→1 after a single town tap — not a session-only override, a permanent write.

### 12. [RED] Calendar / Driver — uploadCaptureMedia posts the walkaround video once; on a network failure the catch only toasts 'saved without it' for two seconds, and the row still stamps green 'Logged' with no distinction from a delivery whose video actually landed.

- **job:** know his proof of condition actually reached the office before he drives away
- **primitive:** capture / logged status badge · **failure:** lying · **scope:** signal · **role:** driver
- **cite:** `app.js:20280, 25426`
- **evidence:** That video is the only defense against a later damage claim; a failed upload and a successful one are visually identical on the row afterward.

### 13. [RED] Calendar / Driver — The log-gate (e.g. 'no invoice on this rental') is only evaluated when the driver taps Log Delivery, not when the row renders — a stop already blocked that morning shows no lock, no red flag, nothing, until he's driven the full distance.

- **job:** know before loading the trailer that a stop can't actually be completed
- **primitive:** row / block state · **failure:** invisible · **scope:** signal · **role:** driver
- **cite:** `app.js:20198`
- **evidence:** The gate check exists in the codebase — it simply runs at the wrong moment (on tap, not render), so the information is computed but never surfaced ahead of time.

### 14. [RED] Calendar / Driver — state.tripsSyncStatus starts null and only flips to 'synced' after a push/pull succeeds — until then the footer defaults to 'Offline — cached' regardless of real connectivity, and nothing re-checks after the first success either, so it can just as easily read false-'Synced' after signal is later lost.

- **job:** trust the one line of chrome that's supposed to say whether his screen is current
- **primitive:** sync status footer · **failure:** lying · **scope:** signal · **role:** driver · **SYSTEMIC**
- **cite:** `app.js:2502 (initial null), 11390/11413 (flip to synced), 11499 (footer copy fallback)`
- **evidence:** The footer is pinned, non-scrolling chrome — one of the few things visible on first paint — so this false reading is prominent, not buried. No code path checks connectivity before a write at all, so a held/failed write in a real dead zone produces no distinct signal either.

### 15. [RED] Calendar / Driver — A failed sync during a capture holds the pending write only in RAM (a code comment states the local cache is never a save baseline) while the banner instructs the driver 'Don't close the app' — an instruction a phone user can't reliably guarantee, since the OS backgrounds/locks apps on its own.

- **job:** have his delivery count as logged even in a signal dead zone, without keeping his phone open and unlocked
- **primitive:** capture flow / sync banner · **failure:** destructive · **scope:** interaction · **role:** driver
- **cite:** `app.js:25405-25411 (in-RAM hold, no persistence), 25426 (banner copy), 24576 (comment: cache never a save baseline)`
- **evidence:** The practical failure this produces is a completed delivery log reverting to undelivered overnight — exactly what the app exists to prevent.

### 16. [RED] Categories — Member day-rate ($120) is stored and edited as a first-class field but never rendered on the mini-card; the card shows only the four retail tiers (1-Day $440 etc.), so a counter rep reading the face he actually looks at overquotes a member by 267%.

- **job:** quote a rental rate to a caller over the phone/counter before they hang up
- **primitive:** rate tile / mini-card face · **failure:** invisible · **scope:** architecture · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:7271-7275 (mini-card rate() omits memberDaily) vs app.js:8876-8879 (detail priceFld lists memberDaily first) vs app.js:1078 (rentalPrice() short-circuits to days×memberDaily for a member, skipping all four displayed tiers)`
- **evidence:** Live production: 12k Excavator member day = $120, mini-card shows $440. Second live example: 8k Excavator member $89 vs displayed $320. Not a billing defect — invoices/Rentals/Wrangler all call rentalPrice() correctly — the risk is a rep saying the wrong number out loud, not the invoice being wrong.

### 17. [RED] Categories — The category detail's availability count and the mini-card's availability count disagree because the detail bucket (unitRentalBucket) files any unit with no active rental as "Available" regardless of fleetStatus, while the mini-card correctly restricts to Active fleet.

- **job:** check whether a machine class actually has stock to rent right now
- **primitive:** status pill / detail availability bar · **failure:** lying · **scope:** signal · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:2300-2305 (unitRentalBucket, no fleetStatus check) vs app.js:7216-7225 (mini-card, fleetStatus==='Active' only); root definition at app.js:2251 isUnitRentable/RENTABLE_SKIP_FLEET`
- **evidence:** Live-reconfirmed, same category, same second: 12k Excavator mini-card reads "NEXT MON" (zero free), detail reads "9 Available" (11 units total minus 2 on rent = 9, none excluded for Sold/For Sale/Inactive). Second live example: Lift Scissor 19ft mini-card "2 Avail", detail "5 Available" — the 3 extra are sold machines. A comment at app.js:7212 shows this exact bug class was already fixed on the mini-card on 2026-06-25; the fix never reached the detail renderer.

### 18. [RED] Categories — A category with 0 in every rate field still shows a bright green availability pill when units are physically ready — the app internally knows and labels the record "STUB — fill in pricing," but that text lives only in the detail nobody opens.

- **job:** know it's not safe to quote a price before a caller is put on hold
- **primitive:** status pill (availability lead pill) · **failure:** invisible · **scope:** signal · **role:** counter-sales rep
- **cite:** `mini-card availability renderer (green lead pill, app.js ~7255-7258) vs detail Fleet Summary "STUB — fill in pricing" text; predicate catRatesUnset() app.js:1113-1115`
- **evidence:** Live: LIFT SCISSOR 19FT shows a bright green "2 AVAIL" pill, both units inspection-passed, and every rate tile is an em-dash. In production, 7 of the 46 live categories (about 15%) are currently unpriced this way.

### 19. [RED] Categories — A category whose entire fleet has been sold still displays full rack rates on the mini-card ("NONE · SOLD" pill sits directly above quotable dollar figures) — the machine is gone but the price still reads as offerable.

- **job:** avoid promising a machine the yard no longer owns
- **primitive:** rate tile · **failure:** lying · **scope:** signal · **role:** counter-sales rep
- **cite:** `mini-card renderer — no gate ties the rate() helper to categoryUnavailReason/allOffFleet`
- **evidence:** Live: SKID STEER MINI shows "NONE · SOLD" and still lists $280/1-day, $790/7-day beneath it. Verify pass noted the card border isn't even red in this state (falls to neutral) since the Active-only "free" set is empty — the pill is the only warning.

### 20. [RED] Categories — Committing a category rate edit (admin inline-edit or a Wrangler chat write) fires zero toast, team-dock ping, or push to anyone — not even to the person who made the edit; the commit path is reindex + logAction + render only.

- **job:** know that the price you're about to quote was just changed by someone else
- **primitive:** toast (absent) · **failure:** invisible · **scope:** interaction · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:19658-19668 (generic `kind==='field'` commit closure, shared by every card's efld()); app.js:19213 admin gate; app.js:8876 rate fields route through it; app.js:16113-16136 Wrangler write path, same silent logAction`
- **evidence:** Contrast: js-lost-demand, js-spe-accept, and js-blacklist all toast the acting user; the generic admin-gated field editor that all 5 rate fields (memberDaily/rate1Day/rate7Day/rate4Wk/weekend) route through is the one edit path in the app that stays silent even to its own author.

### 21. [RED] Categories — Creating a category is completely ungated (no admin/permission check anywhere on the create handler), while editing a rate field on that same category is explicitly admin-gated — the authority matrix is inverted, and it is the mechanism that produces unpriced-but-instantly-rentable $0 records.

- **job:** control who is allowed to introduce a new, instantly-live rentable equipment class
- **primitive:** authority gate · **failure:** destructive · **scope:** interaction · **role:** owner-operator · **SYSTEMIC**
- **cite:** `app.js:19008/18946 (create handler, no requireAdmin) → app.js:21174-21251 quickAddCategoryFromSearch (all rates hardcoded 0) vs app.js:19213 + app.js:8876-8931 (admin:true on every rate field)`
- **evidence:** A non-admin can mint unlimited live categories but cannot price any of them — plausibly how the observed unpriced LIFT SCISSOR 19FT record came to exist. Deliberately left unfixed pending an explicit owner decision (offered, declined for now).

### 22. [RED] Categories — ROI/margin is money-tier-gated in the detail view, but the same categoryStats().roi value is registered as an ungated list column with a colored pill in the card's default layout, AND is an ungated sort key — a below-money-tier user can read the exact percentage off the list or infer the entire fleet's profitability ranking just by sorting on it.

- **job:** keep margin/profitability data restricted to the roles who are supposed to see it
- **primitive:** list column / sort menu · **failure:** inconsistent · **scope:** architecture · **role:** owner-operator · **SYSTEMIC**
- **cite:** `app.js:8916 (gated, canMoney()) vs app.js:7487 (ungated list column) + app.js:7562 (default layout includes it) + config.js:432/app.js:9239/19208 (ungated sort key); note canMoney() (app.js:21348) is permissive on a blank role while adminUnlocked() (app.js:19776) is restrictive on the same blank role — the two gates disagree about who a no-role user is`
- **evidence:** Fixed in this audit's branch (gate now applied to column, cell, and sort-key list) but production still leaks at time of audit. Flagged explicitly as a never-delegate authority/margin-visibility class of bug.

### 23. [RED] Categories — Nothing in the app ever deletes, merges, retires, or splits a category — DATA.categories is push/read/index-only. A typo'd or duplicate category is permanent and pollutes every grid, sort, and picker forever. The de-facto workaround (retagging units one at a time via a bare, unconfirmed select) commits on change/blur with no confirm and silently re-prices every open rental on that unit.

- **job:** clean up or consolidate a mis-created or duplicate equipment category without corrupting a live rental's price
- **primitive:** form field (select) · **failure:** destructive · **scope:** architecture · **role:** owner-operator · **SYSTEMIC**
- **cite:** `app.js:19669-19679 (bare `<select>`, commits on change/blur, no confirm); app.js:1119-1123 (unitRentalPrice reads categoryId live, so rentals re-price instantly); contrast Invoices' full merge flow at app.js:9000/19098-19100/mergeInvoiceInto`
- **evidence:** Orphaning is also unhelpfully handled: a unit pointing at a deleted/nonexistent categoryId renders as literal text "Unknown category" and "—" on the mini-card, neither actionable nor filterable. No bulk "move all N units" action and no search on the reassignment select (a phone user faces a ~50-option native dropdown).

### 24. [RED] Categories — Filters set from one category persist and silently combine with a filter clicked on a different category later — clicking a status pill on 12k Excavator returned a Light Tower because an earlier tally-pill filter from another category was still active, stacking with no warning.

- **job:** trust that the list shown reflects only the filter just clicked, not a leftover one from ten minutes ago
- **primitive:** filter chip / group bar · **failure:** inconsistent · **scope:** interaction · **role:** dispatcher
- **cite:** `app.js:3238-3242 addColFilter (never clears cs.filterTerms first) + app.js:19071-19078 (.js-fleet-filter handler skips setAnchor, so the cascaded-card reset at app.js:2586-2596 never fires)`
- **evidence:** Live-confirmed: two chips ("Not Ready · Light…" + "Ready · 12k Exca…") intersected on screen with Back/Forward vanished; the result looked like a normal list, just of the wrong machine.

### 25. [RED] Categories — The circular icon on a filter chip, which looks like a clear/remove control, actually inverts (negates) the filter instead of removing it — the list visibly changes so a hurried user concludes it cleared, while he is now viewing the exact complement of what he asked for.

- **job:** clear an unwanted filter and see the real unfiltered list
- **primitive:** filter chip · **failure:** lying · **scope:** interaction · **role:** dispatcher
- **cite:** `app.js:3287-3297 (filterTermPill) + app.js:19041 (delegated click checks .js-ft-neg first and calls toggleFilterNeg, returning before reaching the actual remove path)`
- **evidence:** Live-confirmed: clicking the leading circle turned the chip red ("excluding") and the list changed — the natural read is "it worked," but it inverted rather than cleared. No remove control appears on hover either.

### 26. [RED] Customers — No call, text, charge, or follow-up control exists anywhere on a customer row or in the detail record — the card only ever states facts.

- **job:** decide what to do next about a specific customer and do it without leaving the record
- **primitive:** row / detail action controls · **failure:** invisible · **scope:** interaction · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:7141-7183 (row); app.js:4233-4235 (funnel layer); app.js:8826-8856 (detail)`
- **evidence:** Measured live: with a customer record open and 71 customer + 34 rental rows rendered, and separately a rental detail open with 59 phone numbers on screen, there were zero tel:, sms:, or mailto: links anywhere. The funnel's only prompt is a dashed "+ action" identical whether a lead is fresh or a year cold.

### 27. [RED] Customers — The row computes an accurate live owed/overdue $ figure from real invoices every render, but the group header, sort field, filter, and pulsing detail-view flag all read a separate stored field written once at signup and never updated by anything in the client — so two contradictory answers to "does this person owe us" sit inches apart on the same screen.

- **job:** decide, at a glance, whether a specific customer can rent right now or needs to be chased for money
- **primitive:** status pill / group header / sort & filter · **failure:** lying · **scope:** signal · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `live: app.js:7149-7161 · stored: app.js:9317-9319, 8351-8352, 5886, 5897, config.js:430 · only writes: app.js:21102,21144,21238,21309,15804`
- **evidence:** Repo-wide grep found zero write sites to payStatus outside the five creation paths (all set 'New Customer'). The team's own spec (docs/specs/customers-crm.md:642-650, dated 2026-07-09, nine days before this audit) already documents it: "payStatus remains a stored/seeded field; no derive-from-open-invoices pass exists... STILL an open question." Also confirmed there is no in-app editor for the field at all (a column that looks editable is read-only display) — it can only be changed via the Sheets backend.

### 28. [RED] Customers — "New Customer" is a declared, first-class blue pay-status in config, but the grouping list only lists Unpaid/Partial/Current, so nearly the whole book falls into an unnamed, hard-coded-grey leftover bucket appended last.

- **job:** tell a brand-new lead apart from a live paying account without opening every record
- **primitive:** group header / bucket · **failure:** invisible · **scope:** architecture · **role:** counter-sales rep
- **cite:** `app.js:9317-9319 vs config.js:116-121 · fallback app.js:9410-9411`
- **evidence:** Of 2,265 customers, only 5 sit under the real "Current" group; 2,260 sit under "New Customer," which renders as generic grey overflow rather than its own configured blue section — including customers who have rented for years and owe money right now.

### 29. [RED] Customers — Two of the five customer sort options are dead no-ops that silently fall through to name order while the menu still shows them as selected.

- **job:** find who owes the most money, or whose invoice is oldest, without reading every row
- **primitive:** sort control · **failure:** lying · **scope:** interaction · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `config.js:430 declares both · app.js:9223-9245 switch has neither case · rendered as real buttons app.js:17145, 19208`
- **evidence:** Measured live, element by element: sorting by "Pay Status" produced a list byte-identical to sorting by "Name." Sorting by "Last Invoice" produced reverse-alphabetical order (Z names first, then Y, then W), with a real duplicate customer name appearing twice in the captured list — no reference to any invoice date at all.

### 30. [RED] Customers — The money pill and the phone number share one line, and the money wins the truncation — so the more a customer owes, the less of their number she can read.

- **job:** call the specific accounts that owe money
- **primitive:** row text (phone) · **failure:** invisible · **scope:** density · **role:** counter-sales rep
- **cite:** `app.js:7147, 7152-7160 (row template, one-line-by-design per style.css .cr/.cr-sub)`
- **evidence:** Measured across 400 rendered rows on production: 96% of rows carrying a balance had a clipped phone number (22 of 23) vs 25% without one. A customer owing $13,240.52 rendered a phone number of "(337) …" — the exact accounts she most needs to call are the ones she can't read the number for.

### 31. [RED] Customers — Red is the default state of the screen and it never says why a row is red.

- **job:** tell what's actually urgent among 2,265 customers without opening each one
- **primitive:** name-text tint / flag · **failure:** ambiguous · **scope:** signal · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:5885-5900, 5934-5938, 7144-7146 · measured on production DOM`
- **evidence:** Measured live: 44 of 60 rendered rows red, 11 of the first 12 in the default view. Inspecting a red row's DOM directly: no flag word in its text, no title attribute; the only tooltip on the row belongs to an unrelated eye-preview toggle. (Self-corrected mid-audit from an overstated "every customer is red" — a name search returned only 4 of 19 red; the saturation is specific to the default view.)

### 32. [RED] Customers — Three separate alert-pulse mechanisms on this card are inverted or hardcoded backwards: the rental-status badge pulses unconditionally for all seven active statuses (none red); the pay-status pulse tests for a 'Paid' value customers can never hold, so every New Customer throbs like a debtor; and the membership billing flag has its booleans swapped so "No Billing" (a setup gap) pulses while "Payment Due" (genuinely overdue) sits calm.

- **job:** notice which customer actually needs attention right now, among ones that just look busy
- **primitive:** pulse / alert animation · **failure:** lying · **scope:** signal · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:8360 (alert:true unconditional) · app.js:8351-8352 (dead 'Paid' branch) · app.js:3989 vs 3992 (inverted booleans)`
- **evidence:** All three mechanisms confirmed live in code; a person who scans for whatever blinks is actively misdirected to the calm cases and past the real ones on every one of the three signals this card ships.

### 33. [RED] Customers — A customer's stored "Don't Contact" stage renders correctly as a red pill on the row and on the Sales pipeline board, but the customer-detail popup silently clamps any off-vocabulary legacy value (including this one) to a calm blue "Lead" — so opening the record to check the warning makes the warning disappear.

- **job:** confirm before dialing whether this specific person should be contacted at all
- **primitive:** flag / funnel-stage pill (detail view) · **failure:** lying · **scope:** signal · **role:** counter-sales rep
- **cite:** `row: app.js:7164-7167 + config.js:157 · clamp: app.js:212-219 · migration: app.js:326-334`
- **evidence:** "Don't Contact" is a value Mr. Wrangler chat and CSV import can both write onto a live customer today; the 2026-07-17 funnel-vocabulary migration only rewrites the old Inbound/Outbound Lead labels and never purges this one. A first-party test (ci/logic-test.mjs:1592) asserts the clamp is intentional, but the row-vs-detail contradiction it produces is untested and unreconciled.

### 34. [RED] Customers — Adding a card on file is gated to Office/Admin with a toast; removing one, or changing which card is the default, has zero permission check and zero confirmation, twelve lines below the handler that does check.

- **job:** protect the shop's ability to charge a customer from an accidental or malicious one-click delete
- **primitive:** remove (X) button on a saved card/bank · **failure:** destructive · **scope:** interaction · **role:** counter-sales rep (any logged-in role, incl. mechanic/driver, can trigger this) · **SYSTEMIC**
- **cite:** `app.js:858-876 (ungated X at 871 vs gated Add at 875) · app.js:18468-18473 · app.js:803-822 · Stripe detach app.js:820`
- **evidence:** Measured live off the card-health ring: of 2,265 customers, 124 have a card on file and 2,141 do not (94.5% of the book). Since a valid card is required before On Rent, those 124 are effectively the entire float, and removeCard fires a live Stripe detach — not locally reversible — with no gate and no confirm at all.

### 35. [RED] Customers — "Pay Cancellation" charges the customer's saved card in full the instant it is tapped — the one control on this card most in need of a review step is the only money action that skips the shared payment-review overlay every other charge uses.

- **job:** collect a cancellation fee without risking a fat-finger charge on the wrong customer or amount
- **primitive:** one-click money action button · **failure:** destructive · **scope:** interaction · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:4100 button · app.js:18452 handler · app.js:4975-4989 charges immediately · contrast app.js:21392 overlay pattern`
- **evidence:** Every other money action (pay balance, refund) opens a shared payment overlay for amount/card review first; this handler calls membershipReactivate directly with no review step.

### 36. [RED] Customers — Sending an account to collections, and voiding a bad invoice, are both fully built end-to-end (manager gate, confirm popup with reason codes, overlay, auto-blacklist, audit-log entry / money-safe void handler) but their only trigger buttons render inside a standalone Invoices card that was retired and never renders anywhere.

- **job:** send an uncollectable account to the agency, or remove a mistyped/duplicate invoice, with a proper record
- **primitive:** menu action button · **failure:** unreachable · **scope:** architecture · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `orphaned Collections app.js:8974-8979, Void app.js:8991-8995 · live handlers app.js:18671, 18692, 18712-18716 · retirement config.js:421-426 · reachable menu lacks it app.js:4842-4856`
- **evidence:** Verified live on production: opening the status menu on a real Late invoice offers exactly three items — Pay, Print, and Send (greyed out). No Void, no Send to Collections, no Recall. The only visible workaround for a bad debt is the raw Blacklist button, which skips agency placement, amount-placed tracking, and reason codes entirely. Two invoices on one real account were already marked VOIDED, implying voiding currently only happens through the Sheets backend, never through any reachable app UI.

### 37. [RED] Customers — A customer's spend chart sums rental list price over a 9-month window while the account stat beside it shows the actual server-computed amount paid — different basis, different period, no label distinguishing either.

- **job:** judge how valuable or active a specific account really is before deciding how to treat them
- **primitive:** chart / stat tile · **failure:** lying · **scope:** signal · **role:** counter-sales rep
- **cite:** `app.js:4685-4693 vs app.js:7769-7789`
- **evidence:** On one real account, observed simultaneously: chart callout "$47,720 · BEST · APR"; Transactions tab "$2,834.84 collected, 1 payment, 0 refunds"; 1-year average $236.24; open balance $13,240.52 — and the caption beneath the chart still read "No rental cadence yet." A roughly 17x overstatement, both numbers on screen at once, nothing telling her which to trust.

### 38. [RED] Customers — Only 60 of 2,265 customer rows load by default; the "Show more" button re-renders the entire list every press instead of appending, so each press gets slower than the last.

- **job:** find a customer who isn't in the first 60 rows without giving up and asking a coworker
- **primitive:** pagination / "Show more" button · **failure:** unreachable · **scope:** interaction · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `measured on production, timed in-page over four consecutive presses`
- **evidence:** Timed: 547ms → 658ms → 803ms → 1,044ms for identical 200-row additions; cost tracks total row count (~1.1ms/row), confirming a full re-render each press rather than an append. Reaching the end of the book is roughly eleven presses and over twelve seconds of frozen screen, each requiring a manual scroll back to the button first.

### 39. [RED] Customers — There is no tap-to-call anywhere on this card, and the only real text/email action is hidden behind an undiscoverable right-click/long-press context menu — which itself has no "Call" option at all.

- **job:** call or text a specific customer directly from their record
- **primitive:** phone/email text vs. right-click context menu · **failure:** unreachable · **scope:** interaction · **role:** counter-sales rep
- **cite:** `telHref app.js:11742 (only call site app.js:7368, Rentals trip-row) · customer plain text app.js:7147, 8359, 4395-4404 · right-click comms app.js:6377, openCtxMenu 6351-6389`
- **evidence:** Repo-wide grep: telHref has exactly 3 hits — its definition, one Rentals trip-row call site, and a module re-export — zero uses on Customers. The right-click menu does fire real sms:/mailto: sends via commsOpenConv, but is reachable only by right-click or long-press, and even it never offers a "Call" action anywhere in the app.

### 40. [RED] Customers — Settings has live, saveable toggles for customer reminders and dispatch ETAs, but the engines behind them are inert — the toggle persists, nothing acts on it.

- **job:** trust that turning on a reminder setting actually results in someone getting reminded
- **primitive:** settings toggle · **failure:** lying · **scope:** signal · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `Settings → Notifications toggles`
- **evidence:** Anyone flipping these toggles on reasonably believes the app is now chasing customers on a schedule. It isn't — the toggle only writes its own saved state.

### 41. [RED] Customers — Because the pay status never updates, red tints never say why, and only one sort works, counter staff have been typing business state directly into the customer name field — balances, do-not-rent flags, credits, and escalation contacts — and prefixing 23 of 25 with punctuation specifically because punctuation sorts above letters in the one sort (alphabetical) that isn't broken. The same improvisation shows up in free-text note fields on individual accounts, used as an ad hoc, undated "next follow-up" tracker because no structured field exists.

- **job:** flag an urgent, do-not-rent, or credit-holding customer so it actually surfaces, given that the official flag/sort/status systems don't reliably do it
- **primitive:** name field / free-text notes / sort · **failure:** ambiguous · **scope:** architecture · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `measured on production, names redacted for privacy`
- **evidence:** Of 860 rendered customer names, 25 carried business state typed into the name field: 13 owed-amount flags (e.g. "!!!Owes $X!!!"), 7 do-not-rent flags, 3 account-credit notes, 2 escalation-contact routings. This is not sloppiness — it's staff actively routing around three separate defects (dead sorts, frozen pay status, the vanishing Don't-Contact flag) every day, by hand, and is the strongest evidence in the whole audit that those defects are real and costing time.

### 42. [RED] RENTALS — On a multi-unit rental, flagging a Field Call on a non-primary unit dispatches the repair to the rental's PRIMARY unit and leaves the actually-broken machine bookable.

- **job:** get the mechanic and a truck to the machine that actually broke down
- **primitive:** flag (Field Call) + the status action behind it · **failure:** lying · **scope:** interaction · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:20003-20014 ← call sites app.js:20045, app.js:20264`
- **evidence:** markFieldCall(rentalId) only ever reads r.unitId — documented as the PRIMARY-unit mirror (app.js:345-349, resynced every load at app.js:368) — and never the clicked unitId, which IS in scope at both call sites (setUnitCondition's Fail path, app.js:20045; the +FC yard capture, app.js:20264). The broken non-primary unit never gets inspectionStatus='Failed', so isUnitAvailableFor (app.js:2064-2067) keeps it bookable, while the untouched primary is wrongly flagged Failed and gets the WO (wo.unitId:r.unitId, app.js:20009). Verifier verdict CONFIRMED. Since fixed in PR #740.

### 43. [RED] RENTALS — A rental can be jumped straight to 'Returned' having never been invoiced, closing the job out unbilled.

- **job:** make sure a finished rental actually got billed before it's closed
- **primitive:** status pill / gate-timeline dropdown · **failure:** destructive · **scope:** interaction · **role:** AR clerk
- **cite:** `app.js:19906-19925, order app.js:16851`
- **evidence:** The invoice hard-gate fires only for val==='On Rent' (app.js:19911); blacklist/rental-rules/card/account-block gates are all scoped to BOOKING_STATUSES = ['On Rent','Reserved','Today','Tomorrow'] (app.js:19751) — 'Returned' is in none. The status dropdown is a free-jump timeline (every node a live button, no disabled state), so a dispatcher can open a fresh Reserved rental (invoiceId still null) and click 'Returned' directly; units flip Returned and the rental closes out, never billed. Verifier verdict CONFIRMED, critical.

### 44. [RED] RENTALS — The lane rail + one-tap 'Round up' auto-balance that let a dispatcher assign a whole route were retired — the handlers still exist but nothing renders their buttons.

- **job:** assign a dozen delivery/recovery stops across three trucks in one pass
- **primitive:** nav control / dispatch rail (unrendered) · **failure:** unreachable · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:11802-11805, app.js:18629-18636`
- **evidence:** The multi-driver lane rail and the 'Round up' auto-balance handlers are present in code but no UI renders their buttons. With 12 stops and 3 trucks a dispatcher can only tap +Driver one stop at a time — no 'who's carrying what' load view, no one-tap balance. Surfaced by a completeness critic (source-grounded cite, not one of the 15 triple-verified items).

### 45. [RED] RENTALS — A driver can be assigned two overlapping runs with no conflict warning — one driver, two towns, same 9 AM, silently allowed.

- **job:** not double-book one driver into two jobs at the same time
- **primitive:** flag (missing driver-conflict flag) · **failure:** invisible · **scope:** signal · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:11341-11352, app.js:18636`
- **evidence:** Units get a pulsing 'Overbooked' flag when double-booked; drivers get nothing. Assign or 'Round up' writes a driver onto a transport leg with no time-conflict check. The asymmetry with the unit-overbooking flag is what makes it look systemic (the signal system covers equipment but not people). Completeness-critic finding, source-grounded.

### 46. [RED] RENTALS — A field delivery blocked by an office-side booking gate silently discards the whole capture — recorded video included — with no way to see or clear the block from Trips.

- **job:** log a delivery from the job site and not lose the proof-of-delivery video
- **primitive:** status action / toast (missing block-surface) · **failure:** destructive · **scope:** interaction · **role:** driver · **SYSTEMIC**
- **cite:** `app.js:20256-20261, app.js:529`
- **evidence:** A driver taps 'Log Delivery'; if the office never finished the card/invoice, the booking gate refuses the status move and the entire capture (including recorded video) is thrown away — no queued retry, no visible block on the Trips side to clear. Completeness-critic finding, source-grounded.

### 47. [RED] RENTALS — Returns capture no damage: 'Log Recovery' flips the unit to Returned with only {date, video, driver} — nothing records condition, opens an inspection, or bills damage.

- **job:** charge for damage found when equipment comes back
- **primitive:** capture form / handoff (missing) · **failure:** unreachable · **scope:** architecture · **role:** mechanic · **SYSTEMIC**
- **cite:** `app.js:20259-20261, app.js:4410-4411`
- **evidence:** The recovery path stamps only {date, video, driver} and sets Returned; there is no condition capture, no inspection open, no damage line. The Rental Protection $1,000 cap can therefore never be exercised from the return path. Completeness-critic finding, source-grounded.

### 48. [RED] RENTALS — An overdue return is invisible to every count, badge and toast in the app — it only tints the row it's already sitting in.

- **job:** know the moment a rental goes overdue so I can chase it
- **primitive:** flag / bell count · **failure:** invisible · **scope:** signal · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:5846, config.js:245, commsBellCount app.js:10342-10343`
- **evidence:** off-rent-overdue is a red flag (config.js:245) but feeds only getEntityColor (row pill/border). commsBellCount = unseenNotifs()+visibleTransportAlerts()+wranglerRequests — none reference the flag, and a past-endDate leg drops OUT of the forward-windowed transportAlerts, so it isn't even indirectly counted. The rentals column tab's alert is hardcoded false (app.js:9601, only units get unitsAlertCount). No poll scans flags to fire a toast. Verifier verdict CONFIRMED.

### 49. [RED] UNITS — The hover-preview panel that looks like a glance-only tooltip is actually the full live detail view, every action button wired hot, positioned 10px right of the cursor and centred on it — exactly where the hand is already travelling.

- **job:** glance at a machine to check its state without changing anything
- **primitive:** hover preview / popup panel · **failure:** destructive · **scope:** interaction · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `style.css:825, app.js:3008, app.js:19134`
- **evidence:** style.css:825 sets pointer-events:auto explicitly on .hover-preview; app.js:3008 renders the real DETAIL.units() markup — every live control, not a summary — into the floating panel; app.js:3021-3028 positions it 10px right of and centred on the cursor. Live reproduction: hovered a unit tile to look at it, clicked once, got the toast 'Wash logged — countdown reset' — a real production write with no confirmation. The panel holds 13 live controls, none disabled, all pointer-events:auto at z-index:9000, including '✕ Fail' which fails the machine and auto-opens a work order in one click. Jac had already written uncompleteWash and labelled it 'misclick recovery' before this audit — the trap was already known.

### 50. [RED] UNITS — Attaching a machine to a customer rental has exactly one path — drag-and-drop — and the +Unit button, the only visible alternative, does not open a picker; it toasts an instruction to drag instead.

- **job:** build a rental / attach a machine to a customer quote
- **primitive:** button (+Unit) / drag target · **failure:** unreachable · **scope:** interaction · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:17568`
- **evidence:** Opened a new quote; clicked +Unit — no picker opens, only a toast: 'Drag a unit from the Units card onto this rental.' Drag is the only path. A user who will not perform a drag gesture (the audited persona, and by extension anyone on a difficult touch surface) cannot build a rental at all.

### 51. [RED] UNITS — The drag-drop filter that governs what can actually be attached to a customer rental checks only fleetStatus==='Active' — a failed inspection, 2,882 hours overdue on service, attaches with no warning, no confirmation, no block.

- **job:** make sure the machine going out the gate is actually fit to rent
- **primitive:** drag target / missing gate-confirm · **failure:** destructive · **scope:** interaction · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:17568 (picker filter), app.js:2251 (isUnitRentable)`
- **evidence:** Dragged Worm — failed inspection, 2,882 hrs overdue — onto a quote. It attached instantly. Searched the entire rental detail for 'failed, not ready, overdue, service, inspect, warning, caution, unsafe' — not one appears. Two competing definitions of 'rentable' exist: isUnitRentable (app.js:2251) checks fleet status AND excludes failed inspection but only feeds the availability COUNT; the actual drag-drop attach filter (app.js:17568) checks fleetStatus==='Active' only, and neither checks service-due at all — a grep for any rent-gate referencing past-due returns nothing. A warn-only patch (PR #742) has since shipped ('⚠ FAILED INSPECTION · SERVICE 2732 HRS overdue' on the drop toast, persisted to the rental's log) — but the redesign still needs to decide the real policy: warn, block, or override, and whether it should ever have been possible to attach silently in the first place.

### 52. [RED] UNITS — The mechanic's landing screen correctly opens with the Worklist graph on and countdown-ascending sort — then the first machine he opens turns graphView off permanently, with no restore on close, on Back, on returning to the list, or across sessions.

- **job:** come back to the prioritized worklist after finishing one job
- **primitive:** graph/panel view-state toggle · **failure:** unreachable · **scope:** interaction · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:2731 (openStandard clears graphView), app.js:25640 (ROLE_LANDING sets it true on arrival)`
- **evidence:** ROLE_LANDING.mechanic and .mtech both set graphView:true and sort:countdown-asc on every login and trusted-device resume (app.js:25640-25641, applied at 25658/25750) — the app front-loads the work correctly. But openStandard (app.js:2731) sets graphView=false when any unit opens, and nothing ever sets it back — not closing the record, not Back, not returning to list mode, and it is never persisted. Opening the one machine the screen exists to point him to costs him the prioritized view for the rest of the shift.

### 53. [RED] UNITS — A machine that breaks down mid-rental (failed inspection while actively on rent) never lands in the 'Needs Attention' bucket — it is filed under whatever rental stage it's in, indistinguishable from healthy rentals.

- **job:** find the machine that just broke down in the field
- **primitive:** group/bucket categorization · **failure:** lying · **scope:** architecture · **role:** mechanic / yard tech
- **cite:** `app.js:9294-9307`
- **evidence:** unitStageKey() returns on the rental-stage branch (lines 9296-9303) for any unit with an active rental, before it ever reaches the inspectionStatus==='Failed' check on line 9304 — which only fires for units with NO active rental. A field-broken machine sits inside the collapsed 'On Rent · 21' bar, indistinguishable at the group-header level from 21 healthy rentals. This is the single scenario the mechanic role exists for.

### 54. [RED] UNITS — Setting the sort to 'Service Due' does not sort by service due — grouping wins, so the sort only reorders within a bucket; a machine 1,139 hours overdue on service appears at position 9 in the list, and files under the green 'AVAILABLE' bucket.

- **job:** find the most overdue machine to service first
- **primitive:** sort control + group/bucket · **failure:** lying · **scope:** architecture · **role:** mechanic / yard tech
- **cite:** `app.js:9294 (grouping), app.js:9304 (bucket by inspection status only)`
- **evidence:** Measured live with sort explicitly set to Service Due: position 1 Highrise (440 hrs overdue), position 2 Worm (2,882 hrs overdue, shown only as 'No GPS +1'), position 3 Reptar (2,025 hrs overdue), positions 4-8 five machines with nothing wrong at all, and only at position 9, Dirt Dauber at 1,139 hrs overdue — sitting in the AVAILABLE bucket below three clean machines. Buckets are decided by inspection status alone; service urgency never enters bucket assignment.

### 55. [RED] UNITS — The single worst machine in the yard (2,882 hours past service) displays on its tile as 'No GPS +1' — the service number exists only inside a hover-tooltip string, and flag ranking is by color alone with a hardcoded push order that puts GPS ahead of engine service.

- **job:** spot the worst machine at a glance without hovering
- **primitive:** flag/badge stack, ranking logic · **failure:** invisible · **scope:** signal · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:6989`
- **evidence:** unitCardFlags shows only the single highest-ranked flag plus a '+N', the rest available only in a title-attribute hover tooltip a lazy/touch user never triggers. Ranking is by color rank, tie-broken by hardcoded push order in the flag-building code — GPS is pushed second, service pushed fourth — so a dead GPS antenna always outranks a seizing engine when both are red. Worm's 2,882-hrs-overdue service number exists nowhere on the tile face, only inside the data-tip string 'No GPS · 2882 HRS overdue.'

### 56. [RED] UNITS — A pending wash silently substitutes for a genuinely overdue service everywhere the app shows service status — card border color, the WO/Service pill, the red 'service-past-due' flag predicate itself, the countdown sort, and two KPI tallies.

- **job:** trust that a calm-looking machine isn't actually overdue on real service
- **primitive:** card border color, badge/pill, flag predicate, sort key, KPI tally · **failure:** lying · **scope:** signal · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:2206`
- **evidence:** topServiceForUnit() unconditionally returns the wash task's own row the moment unit.washRequested is true, before ever comparing it to the real worst-active task that unitServiceRows() already sorted worst-first. Consumers of that poisoned value: the card border color (unitWoSoColor, 6970-6974), the WO/Service pill (unitWoSoPill, 6976-6980), the service-past-due flag predicate itself (FLAG_COND.units, line 5857), the countdown sort key (line 9242), and two aggregate KPI tallies which explicitly skip wash-flagged units before counting overdue service (lines 12169, 12682). Concrete case: a unit 40 hrs overdue on engine oil, with a wash also requested, shows a calm yellow 'Wash Due' flag everywhere with the oil overdue invisible. The unit's own detail page gets this right — it independently excludes wash when computing the worst task (app.js:8134) — proving the correct pattern exists one function away from where it's needed. A related bug: snoozing the wash task doesn't silence it either, because the wash early-return in this same function fires BEFORE the snooze filter on the next line.

### 57. [RED] UNITS — Two RED-severity insurance flags — coverage-expired and uninsured-active — are registered in the flag system but never render as a pill anywhere on the Units card face; insurance color comes only from a covered boolean, ignoring expiry date.

- **job:** know a machine's insurance is valid before it goes out the gate
- **primitive:** flag/badge · **failure:** invisible · **scope:** signal · **role:** mechanic / yard tech
- **cite:** `app.js:6989`
- **evidence:** coverage-expired and uninsured-active are registered in FLAG_COND (coverage-expired at RED severity) but unitCardFlags never tests insurance, so neither appears on any card-face pill. They DO silently tint two other surfaces as unlabeled color only — the item-tab chip (app.js:2641) and the R2 entity-stamp pill (app.js:5996) via getEntityColor — which arguably makes it worse: color with no label anywhere naming what it means. An uninsured machine going out looks fine on the one surface anyone actually checks.

### 58. [RED] UNITS — The one alert indicator seen before opening the card watches only 3 of the 10 registered flag conditions.

- **job:** know before opening the card whether anything needs attention
- **primitive:** badge / alert indicator · **failure:** lying · **scope:** signal · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:9479`
- **evidence:** unitsAlertCount ignores failed inspection, overbooked, GPS offline, coverage expired, and uninsured-active — five of the ten registered flag conditions, including the two that can put an unsafe or uninsured machine on the road. The tab badge, the card border, the corner-flag pill, and the group bucket each reimplement their own different subset of the 10-flag registry, so four separate mechanisms disagree about what counts as 'needs attention.'

### 59. [RED] UNITS — Every work order's phase pill is frozen at its creation value on the Units card tile — the code that ever advanced it lived in the retired Shop-card renderer and is unreachable from Units.

- **job:** see whether a job you're actively working has progressed
- **primitive:** status pill (WO phase) · **failure:** lying · **scope:** architecture · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:6978`
- **evidence:** The tile pill reads raw w.phase, set once at WO creation and never updated by any code path reachable from Units. Elsewhere in the app the WO's displayed status is meant to be a DERIVED value (woBottleneck, by severity) that line edits never write directly (per the code's own comment at app.js:22610-22613) — but the Worklist graph (app.js:12170) and a list filter (app.js:3169) both bucket on the raw frozen phase instead. Two different definitions of 'what phase is this WO in' coexist on the same screen: the unit's own accordion shows the live bottleneck, the graph above it shows the creation-time value. Merle works the job all day and his tile never changes.

### 60. [RED] UNITS — Scanning a unit's own printed QR decal — the most obvious physical affordance in the yard — hijacks the app into a full-screen driver video-capture takeover with no 'open this unit' control and no way back.

- **job:** scan the machine's decal in the yard to pull up its record
- **primitive:** full-screen modal takeover / scan flow · **failure:** unreachable · **scope:** architecture · **role:** mechanic / yard tech
- **cite:** `app.js:26647, app.js:26068 (scanActive set true, never reset)`
- **evidence:** scanActive is set true on scan and never set back to false anywhere in the codebase; render() bails permanently once it's set (app.js:17177). Not one branch of the scan screen (ready / blocked / notfound / error / done) renders an 'open this unit' or 'back to the app' control — only js-scan-again / js-scan-retry. For a yard unit with no active rental, the result is 'Nothing to log for this unit right now' with the entire Units card gone. This directly contradicts the code's own documented intent: app.js:7706 states the QR decal is meant to land mechanics on the Units-card journey.

### 61. [RED] UNITS — The hour meter — the sole input every service countdown derives from — is never captured when a machine returns from rental; the seeded fields for it exist and are humanized for the audit log but have no writer anywhere in the app.

- **job:** keep the service countdown accurate after a machine comes back from a rental job
- **primitive:** data-capture flow at end-of-rental · **failure:** invisible · **scope:** architecture · **role:** mechanic / yard tech
- **cite:** `app.js:23088`
- **evidence:** startHours / returnHours exist on every rental unit entry, are seeded with real values, and are humanized for the audit log (app.js:22577) — but a grep for 'startHours =' / 'returnHours =' across app.js returns zero assignments, and nothing rolls returnHours into unit.currentHours. A unit goes out for three weeks, comes back 180 hours older, and its service countdown does not move by one hour unless someone remembers to hand-type the meter into the one manual field that does write currentHours (app.js:19644).

### 62. [RED] UNITS — The only field that writes the hour meter has zero validation — no range check, no order-of-magnitude guard, no monotonic (forward-only) check — and a 10x fat-finger typo sat in production for 26 days feeding every service decision on that machine.

- **job:** record an accurate hour-meter reading without a typo silently corrupting every downstream number
- **primitive:** inline text field · **failure:** destructive · **scope:** interaction · **role:** mechanic / yard tech
- **cite:** `app.js:19644`
- **evidence:** const v = Number(input.value); u.currentHours = v — no guard of any kind. Live production history on unit SPEECHLESS: 'Jun 17 — Hours: 1732.3 → 17385.5' (entered by Cameron), corrected 'Jul 13 — 17385.5 → 1738.5' (Bri) — a 10x typo that stood for 26 days, feeding every service countdown, the fleet hours average, category ROI, and $/Hr computations, and getting permanently stamped onto any work order opened in that window. A warn-only guard has since shipped (proven live: 'Worm: 31,220 HRS is 10.0× the last reading (3,122) — check for a missed decimal. Saved anyway') — but nothing prevents the write, only flags it after the fact, so the underlying data-integrity question (should the system ever accept a reading like this without stronger confirmation?) remains open for the redesign.

### 63. [RED] UNITS — Two mechanics editing the same unit at once silently lose one person's work — sync is whole-record last-write-wins with no field-level merge and no conflict notice of any kind.

- **job:** have two techs both work the same machine without one person's entry being silently destroyed
- **primitive:** sync/merge logic (no UI signal) · **failure:** destructive · **scope:** architecture · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:24778`
- **evidence:** If the local copy of a unit has any unsaved edit, the incoming remote version is discarded entirely and the local record is pushed over it on the next flush — the only reconciliation branch in the whole 18-second poll is a narrow invoice-id collision heal; units get none. Concrete scenario: Merle types an hour-meter reading in the yard (record now dirty); Dale, in the shop, completes the 250-hour oil change on the same unit and sees 'Service completed — countdown reset'; the poll reaches Merle's tablet, discards Dale's version because Merle's copy is dirty; Merle's next save pushes his object over Dale's, and the completed-service log entry — including any photo proof — is gone with no warning to either man. No presence indicator, no soft lock, no conflict notice exists anywhere in the app for this.

### 64. [RED] UNITS — The assignedMechanic field is stored, displayed, searched, and editable in 17 places across the codebase — and is never once used to route, filter, or badge anything. No per-mechanic queue of 'these are yours' exists in any form.

- **job:** know which machines are mine to work on today
- **primitive:** assignment field / personal queue · **failure:** unreachable · **scope:** architecture · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:20009, 22445, 23005 (17 total appearances)`
- **evidence:** Exhaustive grep confirms assignedMechanic appears 17 times: stored, displayed, edited, searched — never used to route, filter, badge, or scope a single view. Every auto-created work order is born with it blank (app.js:20009, 22445, 23005). There is no 'assigned to me' filter or badge keyed off the field and the logged-in identity anywhere in the app.

### 65. [ORANGE] Calendar / Driver — A blank time box reads as 'nothing due,' but the code silently treats it as a hard 5:00 PM cutoff (AUTORUN_EOD_DEADLINE_SEC) that is never printed on the row unless a dispatcher has already run Auto-Run for that day.

- **job:** know his real deadline for an unscheduled stop before he's already blown it
- **primitive:** time field / implicit deadline · **failure:** invisible · **scope:** signal · **role:** driver
- **cite:** `app.js:11906, 11929-11935, 7407`
- **evidence:** The 5PM constant only ever reaches the screen via a session-only Auto-Run 'Late' flag. Code comment confirms it's an internal optimizer safety net, not a customer promise — but the row gives no way to tell 'no deadline' from 'undisclosed deadline.'

### 66. [ORANGE] Calendar / Driver — A background poll (every 18 seconds) can also trigger a full render() with no action from the driver at all, hitting the identical scroll-memory bug and silently snapping the card back to the top mid-read.

- **job:** read his list without the screen jumping on him while he isn't even touching it
- **primitive:** background sync / scroll position · **failure:** inconsistent · **scope:** interaction · **role:** driver
- **cite:** `app.js:24792`
- **evidence:** Same root cause as the assignment-triggered reset, but fires purely from office activity elsewhere — a driver reading his list can be reset by someone else's edit with zero visible cause.

### 67. [ORANGE] Calendar / Driver — The service worker has no push listener and no showNotification call anywhere in the codebase — it is an offline-cache shell only, so nothing can reach a driver who isn't already staring at the screen.

- **job:** get told something changed without keeping the app open and watching it
- **primitive:** push / service worker · **failure:** invisible · **scope:** architecture · **role:** driver · **SYSTEMIC**
- **cite:** `sw.js (full file — install/activate/fetch/message only)`
- **evidence:** The one genuinely loud, render()-proof channel that does exist — the R25 sync banner (app.js:25416-25432, role=alert/aria-live=assertive) — instructs the driver 'Don't close the app,' which a phone user can't reliably comply with since the OS backgrounds/locks apps on its own.

### 68. [ORANGE] Calendar / Driver — tripMatches() does one contiguous blob.includes(q) instead of the AND-term matching every other card's search bar uses, so 'lake pick' returns zero rows against a row that is literally 'Pick up' at 'Lake Charles.'

- **job:** find a trip by typing the words he sees on the row, the way search works everywhere else
- **primitive:** search bar · **failure:** inconsistent · **scope:** interaction · **role:** driver
- **cite:** `app.js:11746`
- **evidence:** Reproduced live on production: 0 results for 'lake pick.' Credit: the empty state is handled honestly ('No trips match...') rather than silently, so it fails clearly, just wrongly.

### 69. [ORANGE] Calendar / Driver — The 'Open in Google Maps' button only renders once a stop is focused, nested inside the collapsible map panel — there is no default per-row directions affordance.

- **job:** get turn-by-turn directions to his next stop with one tap, no discovery required
- **primitive:** directions button · **failure:** unreachable · **scope:** interaction · **role:** driver
- **cite:** `app.js:9660-9673 (link only builds inside the map panel, gated on mapOpen)`
- **evidence:** Live-confirmed: the button only materialized after tapping the town link. Collapsing the map by default (the fix for the fold-eating-viewport finding) also removes the only place this link lives, since it's nested in the same collapsible panel — the two fixes need to be reconciled together, not shipped independently.

### 70. [ORANGE] Calendar / Driver — The customer pill replaces the Trips column entirely (navigating into Rentals); the unit pill opens in the left column and leaves Trips mounted. Same row, same visual treatment, opposite consequences.

- **job:** tap a related record without unpredictably losing his place on the card he was using
- **primitive:** pill / navigation · **failure:** inconsistent · **scope:** interaction · **role:** driver
- **cite:** `verified live — customer pill swapped the middle column tab, unit pill did not`
- **evidence:** Only one of the two pills costs the driver his place, with no visual difference warning him in advance which one is about to do it.

### 71. [ORANGE] Calendar / Driver — The row's entire overflow (⋯) menu contains exactly one item — 'Merge trip…' — a dispatcher concept. There is no 'running late,' 'can't complete,' or 'on my way' action anywhere on a driver's own row.

- **job:** tell the office something went wrong without picking up the phone
- **primitive:** row overflow menu · **failure:** unreachable · **scope:** architecture · **role:** driver
- **cite:** `app.js:18623`
- **evidence:** The capability already exists one card over — the Unit card carries a working '+FC' (Field Call) button (app.js:7736) — it simply isn't wired onto the row where the driver is actually standing.

### 72. [ORANGE] Calendar / Driver — The KPI labeled 'On-Time' is computed as delivered-or-handled ÷ scheduled — a completion rate, with no comparison to t.time or the implicit 5PM deadline anywhere in the formula.

- **job:** know whether he's actually running late, from the number the app itself grades him on
- **primitive:** driver KPI · **failure:** lying · **scope:** signal · **role:** driver
- **cite:** `config.js:311 (label 'On-Time') vs app.js:10015 (formula)`
- **evidence:** A driver who is late on every stop but eventually finishes all of them scores 100% on a metric named for punctuality.

### 73. [ORANGE] Calendar / Driver — timeToMin() only accepts colon-formatted times — '9am,' '9 AM,' '0900,' '9,' and 'noon' all parse to null, which is not surfaced as an error; it silently inherits the same invisible 5PM deadline as a truly blank field.

- **job:** set a time the way he'd naturally type it, and get told if it didn't take
- **primitive:** time input field · **failure:** invisible · **scope:** interaction · **role:** dispatcher
- **cite:** `app.js:11768-11773`
- **evidence:** Proven by running production's own regex against each candidate input — every non-colon form returned null with zero warning or correction shown.

### 74. [ORANGE] Calendar / Driver — On a merged trip, the Log Delivery button is hard-scoped to the primary stop's own record but gated on the whole trip's done state — after logging the first of two stops the button still reads 'Log Delivery,' pointing at a capture already completed.

- **job:** know which stop on a doubled-up job still needs logging, without re-shooting proof already captured
- **primitive:** log action button · **failure:** ambiguous · **scope:** interaction · **role:** driver
- **cite:** `app.js:7376-7380 (button scoped to primary stop), 11586 (trip-level done requires every stop)`
- **evidence:** A driver facing this either re-records a video for nothing or has to stop and puzzle out which stop the button is actually talking about — neither is driving.

### 75. [ORANGE] Calendar / Driver — There is no pre-built, always-available dispatch channel a driver lands in — every new Team chat starts with zero members, so warning the office of a delay requires first creating a thread and adding people rather than tapping into something that already exists.

- **job:** warn dispatch he's going to be late before he's already late, instead of calling
- **primitive:** team chat / dispatch channel · **failure:** unreachable · **scope:** architecture · **role:** driver
- **cite:** `app.js:10569-10570 (new chat starts members: [])`
- **evidence:** Corrected from an earlier overstatement: not admin-gated — any user, including the driver, can create a chat and add dispatch in about two taps. The real gap is narrower: no standing pre-populated dispatch thread by default, and no dedicated one-tap 'running late' affordance.

### 76. [ORANGE] Categories — The Time Utilization graph's fleet-count denominator includes every unit ever assigned to a category regardless of fleetStatus (Sold/For Sale/Inactive included), permanently depressing the displayed utilization percentage.

- **job:** judge whether the fleet is being used efficiently enough to justify buying more of a class
- **primitive:** graph (Time Util bar chart) · **failure:** lying · **scope:** signal · **role:** owner-operator
- **cite:** `app.js:12740-12741 (ruCatUtilProxy fleet accumulator, no fleetStatus gate)`
- **evidence:** Live: Time Util tab shows top category at 48%, everything else under 30% — an owner reading this concludes the fleet is under-used when real utilization (excluding dead fleet from the denominator) is higher.

### 77. [ORANGE] Categories — Category revenue/ROI figures (Round-Up strip, categoryStats.roi, Revenue-by-Category graph) still count the derived price of Cancelled and No-Show rentals, and unitRepairCost still summed cancelled work orders — money never actually collected/spent is counted as if it were.

- **job:** judge which equipment category is actually making the business money
- **primitive:** graph (Round-Up Revenue strip) · **failure:** lying · **scope:** signal · **role:** owner-operator
- **cite:** `app.js:2227 unitTotalRevenue and app.js:12396 ruCatMoney (no r.status filter) vs app.js:12740 ruCatUtilProxy which already excludes Cancelled/No-Show/Quote; expense side at app.js:2212 unitRepairCost summed cancelled work orders while ruCatMoney's expense loop already skipped them`
- **evidence:** Live: Round-Up Revenue bars show 8k Excavator $79k, Skid Steer $77k, while the Rentals card beside it shows "NO SHOW · 32" for the same period — money that was never collected sits inside those bars, and the strip carries no canMoney() gate at all so it's visible to everyone.

### 78. [ORANGE] Categories — Eight distinct one-word unavailability reasons (N/A, Sold, For Sale, Inactive, Failed, Overdue, End Dates?, Off fleet) all render through the identical single-color red pill with no legend anywhere — an actionable "Overdue" (a customer is late returning our machine) looks pixel-identical to an inert "N/A" (we never stocked the class).

- **job:** tell an actionable overdue-return situation apart from a simple no-stock situation at a glance
- **primitive:** status pill (unavailability reason pill) · **failure:** ambiguous · **scope:** signal · **role:** dispatcher
- **cite:** `app.js:2281-2297 categoryUnavailReason (single badge(...,'red') call for all 8 reasons)`
- **evidence:** Confirmed live and in code: the reason set is actually slightly larger than first thought (Purchased/Onboard also reachable), all styled identically.

### 79. [ORANGE] Categories — The sort menu offers ROI, Unit Count, and Avg Hours as sort fields, but the default mini-card face never renders any of the three — choosing one of them reshuffles the entire grid with no visible explanation of the new order.

- **job:** understand why the list just reordered after picking a sort option
- **primitive:** sort menu · **failure:** invisible · **scope:** architecture · **role:** dispatcher
- **cite:** `config.js:432 SORT_FIELDS.categories; app.js:7225-7318 ROWS.categories (default face: name + pills + 5 rate tiles only)`
- **evidence:** Live-confirmed: sorting by ROI moved Light Tower to the top with zero ROI value printed on any card — "is that the best one or the worst one?" ROI and Avg Hours are at least reachable one tap into the detail; Unit Count is shown nowhere on the card at all.

### 80. [ORANGE] Categories — Every fresh session and every page reload lands the left column on Units — a card that carries no rate field at all — regardless of where the user was previously working; there is no session-position memory and no role-based landing override for a rate-facing role.

- **job:** resume rate-lookup work immediately after a routine refresh, without re-navigating
- **primitive:** nav control (column default) · **failure:** unreachable · **scope:** architecture · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `config.js:419 (COLUMNS left default:'units'), app.js:2386 freshSession(); no ROLE_LANDING entry points a counter-facing role at Categories`
- **evidence:** Live-confirmed: after an entire session working in Categories, a reload dropped straight back to Units. Every single call effectively starts on a screen that structurally cannot answer a price question.

### 81. [ORANGE] Categories — The column-tab alert glow (the dot that says "this tab needs attention") is hardcoded to fire only for the Units member; no other column, including Categories, can ever light the tab up no matter its internal state.

- **job:** notice from across the app, without opening the card, that Categories needs attention
- **primitive:** nav control (tab alert dot) · **failure:** unreachable · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:9644-9655 (`alert: m === 'units' && unitsAlertCount() > 0`, literal string match); only unitsAlertCount() exists anywhere in the file`
- **evidence:** Grepping the whole file finds no categoriesAlertCount function. Mitigation: a category with unset rates or fleet trouble does surface an inline flag one click in — but the tab itself can never glow.

### 82. [ORANGE] Categories — Categories has zero entries in the shared flag/badge engine (FLAG_META/FLAG_COND) that every other entity (rentals/units/workOrders/invoices/customers) participates in, so no condition on a category — zero stock, negative ROI, unset pricing — can ever escalate past that one mini-card's own pill.

- **job:** get automatically warned about a category-level problem instead of noticing it by chance
- **primitive:** flag/badge (registry) · **failure:** unreachable · **scope:** signal · **role:** dispatcher · **SYSTEMIC**
- **cite:** `config.js:237-297 (FLAG_META, 5 entity keys, no categories); app.js:5833-5924 (FLAG_COND, same 5); getEntityFlags returns [] when the entity key is absent`
- **evidence:** Confirmed by full grep of both registries plus every call site — no `getEntityFlags('categories', ...)` call exists anywhere in app.js.

### 83. [ORANGE] Categories — The ~18-second background poll patches remote data into local records in place with no diff/changed-field marker anywhere in the codebase, and skips the tick entirely whenever any overlay, drag, or focused input is active.

- **job:** trust that the number on screen right now reflects the latest edit, not a stale one
- **primitive:** list row / background sync · **failure:** invisible · **scope:** signal · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:24823-24866 refreshFromBackend (guard at 24825 on document.hidden/DRAG/overlay/hoverNode; plain Object.assign+render() at 24848/24863 with no changed-key capture; no CSS class/flag/highlight logic for "recently changed" exists in the file)`
- **evidence:** A number can change under a rep mid-shift with zero visual cue — and if he has any popup open (a rental, Mr. Wrangler, Settings — all common), the refresh doesn't even run, so he silently stops receiving updates altogether.

### 84. [ORANGE] Categories — The only way to create a category is to type a name into the search box, get zero results, and click the resulting "+ New Category" button — there is no dedicated "+ New" entry point anywhere else on the card, unlike Rentals and Customers which have an always-on new-record row.

- **job:** discover that creating a new equipment category is even possible
- **primitive:** empty-state button · **failure:** unreachable · **scope:** architecture · **role:** owner-operator
- **cite:** `app.js:9878-9886/9008 (js-new-cat-search) → app.js:18946 → app.js:21174-21251; contrast Rentals' .newrow (app.js:9913-9917) and Customers' (app.js:9921-9925); a code comment at app.js:10340 documents the header +New menu was explicitly removed`
- **evidence:** Live-confirmed and not clicked (would mint a real $0 category in production): typing "zzq test category" surfaced "No Category matches... + New Category \"zzq test category\"" as the sole creation path.

### 85. [ORANGE] Categories — A brand-new category is born with every rate field at 0 and zero units, which renders it in the single most visually alarming state the card has (a full red "None · N/A" plate) — identical in appearance to a genuinely dead/retired category, with no "finish setting this up" affordance.

- **job:** tell a brand-new not-yet-priced category apart from one that's actually out of stock or dead
- **primitive:** status pill · **failure:** ambiguous · **scope:** signal · **role:** counter-sales rep
- **cite:** `app.js:21174-21184/21241-21251 (birth state, all rates 0); app.js:2283/7255-7258 (renders red "None · N/A")`
- **evidence:** The most-alarming visual state on the card is also its normal newborn state.

### 86. [ORANGE] Categories — Models (the sub-entity carrying per-model maintenance schedules that override the generic service countdown) are append-only — no rename, delete, or re-parent — and there are two independent creation paths, neither of which does a name-based lookup before minting, despite one path's own code comment claiming it "mirrors" a find-or-create idiom.

- **job:** add or correct a model's maintenance schedule without accumulating duplicate, divergent records
- **primitive:** add button (+Add Model) · **failure:** inconsistent · **scope:** architecture · **role:** mechanic / yard tech
- **cite:** `app.js:19682-19683 (comment claims find-or-create), app.js:19708 (no lookup, unconditional `DATA.models.push`), app.js:20509-20511 (Duplicate action reuses taskIds verbatim), app.js:8888-8902 (empty state doesn't explain what a Model is or that it silently changes maintenance behavior)`
- **evidence:** Contrast: resolveOrCreateVendorByName (app.js:20483-20488) does a proper name-match lookup before creating; Models has no equivalent, so typing the same model name from two different screens produces two divergent records with no way to merge them.

### 87. [ORANGE] Categories — Two lookalike pills an inch apart on the same card produce different Back-navigation outcomes: the availability pill pushes navigation history (Back restores sort/scroll/panel state), while the status-tally pill wipes backStack/fwdStack outright, making the Back/Forward controls disappear from the toolbar entirely.

- **job:** reliably back out of a filtered view no matter which control triggered it
- **primitive:** nav control (Back/Forward) · **failure:** inconsistent · **scope:** interaction · **role:** dispatcher
- **cite:** `app.js:19313 (.js-cat-avail) → app.js:2772-2792 showCategoryUnits (pushCardHistory at 2775) vs app.js:19071-19078 (.js-fleet-filter, backStack/fwdStack cleared directly, no pushCardHistory)`
- **evidence:** Live-confirmed: Avail pill → Back works perfectly, restores state. Tally pill an inch away → Back/Forward arrows vanish from the toolbar entirely (an escape still exists via the removable filter chip, but the control a person reaches for is gone).

### 88. [ORANGE] Categories — Nearly every control on the card exposes to assistive technology as a bare "button" with no accessible name, and the filter-term chips (both the pill and its nested negate-icon button) do not appear in the accessibility tree at all — unreadable and unremovable by a screen-reader user.

- **job:** operate the card at all using a screen reader
- **primitive:** control (unlabelled button/chip) · **failure:** invisible · **scope:** density · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:3291-3297 filterTermPill (bare `<span class="filt-term js-ft-x">`, no role/tabindex; nested `<button class="ft-neg js-ft-neg">` has zero text content and no aria-label)`
- **evidence:** Live full-a11y-tree read: refs spanning ref_1826 through ref_1859, plus the entire block ref_2305–ref_2328 (the category pills), all read as bare "button."

### 89. [ORANGE] Categories — Clicking an "Off Fleet" stock-count segment routes to the Units card, but cardListEl strips every non-Active unit from the row set before the per-card filter ever runs, so the click lands on an empty "No Unit" state even though a matching "Out of Fleet" section bucket already exists in the code and is never reached.

- **job:** click through from a stock-count segment to see the actual machines behind that number
- **primitive:** group bar (mixbar) segment · **failure:** unreachable · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:9884 (unitsVisible strips fleetStatus!=='Active' before filterTerms), app.js:9898 (rowMatches applied after), app.js:3193 (the __fleet matcher itself is correct), app.js:9332-9348 ("Out of Fleet" section bucket, unreachable); app.js:6825-6828 rentalsVisible already has the reveal-when-filtered pattern this doesn't mirror`
- **evidence:** Live-confirmed after shipping a fix that added the Off Fleet segment: the segment produces a correct filter chip with no console errors, but the resulting Units list renders "No Unit" — a pre-existing scoping defect the new segment simply made visible instead of hiding it inside a wrong "Available" count.

### 90. [ORANGE] Customers — The row's stage/funnel pill only reads the Equipment and Member funnels and never consults the Rental funnel — the one every customer defaults into — so a customer reserved or on rent right now still shows a grey N/A.

- **job:** tell a live renter apart from someone who has never rented, at a glance
- **primitive:** status pill · **failure:** invisible · **scope:** signal · **role:** counter-sales rep
- **cite:** `app.js:7162-7167 vs app.js:147-159, 197-199`
- **evidence:** Confirmed on production: 5 of 6 pay-status pills read N/A on the default view, including on customers who are actively renting equipment right now.

### 91. [ORANGE] Customers — Getting a customer's color collapses distinct red-severity conditions to one identical output.

- **job:** tell a harmless dormant account from an active safety risk by colour alone
- **primitive:** flag colour (name tint) · **failure:** ambiguous · **scope:** signal · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `config.js:284-296 · app.js:5934-5938 · app.js:7144-7146`
- **evidence:** Confirmed but narrowed on verify: it's a name-text tint, not a full row background, and only 3 of 5 red-severity flags (no-card, lost, inactive) are genuinely indistinguishable on the row — blacklisted and unpaid each carry their own separate badge elsewhere in the row. Still: "hasn't rented since spring" and "has no card and is about to take a machine" render identically.

### 92. [ORANGE] Customers — "Cancel Membership" ends billing and generates a cancellation invoice for the remaining term on the very first click, with no confirmation — despite an existing arm-to-confirm pattern sitting a few lines away in the same file.

- **job:** cancel a membership without accidentally ending a paying customer's billing on one stray tap
- **primitive:** destructive action button · **failure:** destructive · **scope:** interaction · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:4099 · app.js:18451 · app.js:4945-4974 · reusable pattern app.js:18639`
- **evidence:** The blacklist button on this same card already uses a two-click "arm" confirm pattern; Cancel Membership does not reuse it despite mutating billing and generating a real invoice on the first tap.

### 93. [ORANGE] Customers — Dollar figures are deliberately masked to $••• in the History log for roles without money permission, but the invoice list, open-balance strip, Transactions tab, and "total paid" stat on the very same customer screen render live dollar amounts with no role check at all.

- **job:** keep money figures away from staff-tier logins (mechanic, driver) that the app is otherwise careful to keep away from money
- **primitive:** masked text vs. plain numeric display · **failure:** inconsistent · **scope:** signal · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `masked: app.js:22582, 9165 · unmasked: app.js:4685-4693, 4780-4808, 4887, 4892, 4813-4824`
- **evidence:** The Customers card itself has no role gate on opening it at all, so a mechanic or driver login sees every customer's live balances and payment history in full — the masking control only ever covers old log text, not the numbers themselves.

### 94. [ORANGE] Customers — No customer-creation path — quick-add, full form, search-add, or the AI's create tool — checks for an existing phone, email, or name before minting a new id.

- **job:** add a new customer without silently splitting their rental/payment history across two records
- **primitive:** customer creation form(s) · **failure:** destructive · **scope:** interaction · **role:** counter-sales rep
- **cite:** `app.js:21276-21320, 21231-21250, 21088-21111, 21116-21150, 15801-15807`
- **evidence:** All five creation paths mint via nextCustomerId() unconditionally with no lookup against existing records. Live corroboration: a captured sort-order snapshot on production showed the identical customer name rendered twice in the list.

### 95. [ORANGE] Customers — Clicking an invoice belonging to a different customer than the one currently open silently spawns a whole new session tab and swaps all three columns, with no cue distinguishing "a new tab opened" from "the view updated."

- **job:** help the walk-in in front of her without losing the customer she was already mid-transaction with
- **primitive:** invoice pill / tab navigation · **failure:** invisible · **scope:** interaction · **role:** counter-sales rep
- **cite:** `app.js:2718-2727 (overtake) · app.js:2608-2625 (openInTab) · reached via app.js:3067`
- **evidence:** Confirmed intentional in-code ("Task 5" comment), not a bug — but ships with no visible signal, and the way back is a small chip she has no reason to notice.

### 96. [ORANGE] Customers — When the invoice-open handler can't resolve the target customer, it doesn't stop — it still fires its scroll-and-glow highlight animation on whatever customer already happens to be on screen.

- **job:** trust that the highlight animation after clicking an invoice is actually pointing at the customer she clicked into
- **primitive:** scroll + glow highlight animation · **failure:** lying · **scope:** interaction · **role:** counter-sales rep
- **cite:** `app.js:3057 (unguarded if(recOf(...)) with no else) · app.js:3066-3075`
- **evidence:** openInvoice() only guards the invoice's customerId being null; it then unconditionally proceeds to mutate state, scroll, and glow-flash even when the target customer record doesn't actually resolve — animating a decoy record instead of the intended one.

### 97. [ORANGE] Customers — The Sales tab — named for her job, sitting one tap from her list — is a permanent "Coming soon" placard, and returning from it re-buries whatever she'd scrolled to.

- **job:** work a lead without losing her place in the customer record she was already reading
- **primitive:** tab / navigation · **failure:** unreachable · **scope:** architecture · **role:** counter-sales rep
- **cite:** `app.js:9617-9631 · app.js:10462-10468`
- **evidence:** Confirmed live: the tab is empty. On desktop, back does restore the record (partial refute of an initial "dead end" read) but resets its scroll to the top, re-burying a balance she'd scrolled down to see; on phone, tapping back resets the card to the list entirely.

### 98. [ORANGE] Customers — A per-customer comms conversation section was fully built but has zero call sites — it renders nowhere, including a stale in-code comment claiming it does.

- **job:** see whether a customer already replied before picking up the phone to call them again
- **primitive:** comms thread panel · **failure:** unreachable · **scope:** architecture · **role:** counter-sales rep
- **cite:** `commsCustSectionHtml() — zero call sites anywhere in app.js`
- **evidence:** The developer's own comment names exactly where it should render; grep confirms it is never invoked. A related comment listing it as a live comms entry point is also stale for the same reason.

### 99. [ORANGE] Customers — The 18-second background poll refreshes app data, team chat, and the Wrangler rail, but never customer comms threads; and a failed comms fetch is fully silent — the catch resets a loading flag nothing reads, leaving stale cached state on screen.

- **job:** know a customer replied, or know the comms system itself is down, without manually refreshing
- **primitive:** background poll / silent error handling · **failure:** invisible · **scope:** architecture · **role:** counter-sales rep
- **cite:** `comms thread fetch + catch block`
- **evidence:** A dead comms backend renders identically to a genuinely quiet day — there is no distinguishing signal.

### 100. [ORANGE] Customers — The notification bell holds engineering tickets addressed to the owner — pricing-engine internals with GitHub links — rendered as raw, unparsed markdown, with nothing customer-facing in it; a dispatch concern ("Transports due") also sits in her alert count.

- **job:** know which of her customers needs a call today
- **primitive:** notification bell / panel · **failure:** invisible · **scope:** architecture · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `notification/wrangler-rail body render path`
- **evidence:** Measured live on production: 53 literal ** markdown markers across 17 lines of unrendered text in the bell panel. Nothing in it tells her a customer needs attention.

### 101. [ORANGE] Customers — On a live production customer record, the account header read "Member" while the AR (accounts-receivable) block on the same screen read "NON MEMBER MODE" for the same account.

- **job:** know whether a specific customer's account type entitles them to member pricing/terms before quoting or invoicing them
- **primitive:** header label vs. AR-section label · **failure:** lying · **scope:** signal · **role:** counter-sales rep
- **cite:** `observed live, customer detail (session transcript) — not independently re-verified by the adversarial pass`
- **evidence:** Observed on a real account carrying a $1,306.85 balance with no card on file: the detail header displayed "Member" while the AR block directly below it displayed "NON MEMBER MODE" — a direct on-screen contradiction about the same customer's account type, consistent with the broader two-pay-status-engines pattern but never captured as its own finding or verified independently.

### 102. [ORANGE] RENTALS — Rentals has no 'Needs Attention' bucket: the section header/count never reflects severity, and flagged rows aren't pulled or sorted to the top — so a dispatcher skimming headers on a busy 'On Rent' section can miss the fire.

- **job:** spot the emergency without reading every row in a long list
- **primitive:** group bar / section header · **failure:** invisible · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:9312-9316 vs UNIT_SECTIONS app.js:9279-9290`
- **evidence:** GROUP_DEFS.rentals keys buckets off lifecycle status (rentalRevStatus, app.js:1986-1990), which never consults a flag — unlike UNIT_SECTIONS, which has an explicit red 'Attention' bucket fed by unitStageKey. SCOPED by verification: the flagged ROW itself does render red (border+pill, and the pill relabels to 'Overdue'), so it is NOT camouflaged as all-clear — the real gap is at the header/count level and that within-group sort doesn't lift flagged rows. Verifier verdict PARTIAL (structural claim holds; 'green hides the fire' framing was overstated — see retractions). The Units card having the bucket and Rentals not is the systemic tell.

### 103. [ORANGE] RENTALS — The row collapses which-of-seven red conditions fired into one uniform border + generic status pill; the flag's NAME never appears on the row, and two conditions can't be identified without a hover or a hop to the customer.

- **job:** tell at a glance WHY a rental is flagged red
- **primitive:** flag / status pill · **failure:** ambiguous · **scope:** signal · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:5834-5854, config.js:239-253, app.js:5934-5938`
- **evidence:** FLAG_COND.rentals defines 7 conditions (fc, overbooked, unpaid-balance, no-card, unsigned-card, unit-failed, off-rent-overdue) ALL severity:'red'; getEntityColor collapses to fl[0].severity, so the row is one uniform red. SCOPED by verification: 3 of 7 do get a distinct on-row echo (overdue relabels the pill to 'Overdue'; unpaid shows a colored balance chip; unit-failed tints the unit name red + tooltip), and opening the record names most via headFlagsHtml — but only no-card and unsigned-card (2 of 7) are genuinely unidentifiable without the desktop hover-preview or navigating to the linked customer. Verifier verdict PARTIAL. See retractions for the overstated original.

### 104. [ORANGE] RENTALS — Customer text/email replies never auto-refresh — refreshCommsThreads is absent from every recurring poll, so a reply can sit unseen until the dispatcher manually clicks the comms chip or reloads.

- **job:** see a customer's reply in time to act on it
- **primitive:** comms thread badge / poll · **failure:** invisible · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:24796 (startRefreshPoll), refreshCommsThreads app.js:26925`
- **evidence:** Only two setInterval calls exist in the whole 27,649-line app.js: a GPS-view timer (app.js:24080) and an 18s backend poll (app.js:24796). refreshCommsThreads is in neither, and refreshFromBackend's body never calls it — it fires only at boot, on a manual click into a comms chip, or right after the dispatcher sends an outbound message. Verifier verdict PARTIAL (core claim holds; a document.hidden citation in the original was a red herring and is dropped).

### 105. [ORANGE] RENTALS — On a phone the entire link-a-record system is reachable only through an unsignposted 500ms long-press — and the on-screen hint told the user to 'drag', a gesture retired in June.

- **job:** link a unit / customer / rental to this record on a phone
- **primitive:** toast / drag target · **failure:** unreachable · **scope:** interaction · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:19046/19054/19082 vs app.js:17813-17826`
- **evidence:** Touch drag-to-link was retired 2026-06-29 (app.js:17813); a phone finger-drag is silently disarmed (ready stays false, app.js:17892-17904) — no link, no ghost, no feedback. The only path is a 500ms hold → R20 context menu → '+ Rental'/'+ Unit' pick, which nothing signposts. Six empty-slot toasts (app.js:19046, 19054, 19082, 19574, 19579, 19592) said 'drag' with no is-phone branch. Verifier verdict CONFIRMED. The misleading 'drag' copy was fixed in PR #740; the deeper unsignposted-long-press gap remains.

### 106. [ORANGE] RENTALS — Terminal status jumps (Returned/Cancelled/No Show) commit on a single click with no confirm and no undo affordance, and the row vanishes from the list on the next render.

- **job:** finish or void a rental without a fat-finger tap silently pulling a live job off the board
- **primitive:** status pill / list row (missing confirm + undo toast) · **failure:** destructive · **scope:** interaction · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:18990, app.js:19926-19941, order app.js:16851`
- **evidence:** The three terminal values sit stacked as the last rows of one dropdown (order app.js:16851), each a plain button; the click handler calls setRentalStatus directly with zero intervening step, and Cancel/No-Show strips billing in the same breath (app.js:19929). rentalCleared+rentalsVisible (app.js:442-443, 6802-6807) then drop the row instantly with no fade. SCOPED by verification: it is NOT unrecoverable — logAction+toast fire and the rental is reachable via the Completed sort/search — so the gap is specifically no confirm + no on-screen undo affordance, not data loss. Verifier verdicts CONFIRMED (terminal-no-confirm, high) + row-vanish CONFIRMED-but-polish. The app already has a confirm precedent for WO completion (app.js:20648) never extended here.

### 107. [ORANGE] RENTALS — Scroll 'preservation' is positional (raw scrollTop keyed by card|view), not record-anchored — so acting on a row in a re-sorted list restores the pixel offset onto a DIFFERENT rental, and the toast names only the new status, not who was hit.

- **job:** keep my place in the list after I change a rental's status
- **primitive:** list / status toast · **failure:** lying · **scope:** interaction · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:17185-17190 (save), app.js:17229-17234 (restore), toast app.js:19940`
- **evidence:** scrollMemo is keyed only by card|view and restored by raw pixel; the key never includes the acted-on record id, and list-mode always restores the saved value even when the list re-sorted underneath (status is a selectable sort field, config.js:431). Changing a status from the row re-sorts and lands the viewport on whatever rental now occupies that offset; the confirmation toast says only 'Status → X', giving no cue a different rental was hit. Verifier verdict CONFIRMED. NB this narrows a 'scroll is genuinely preserved' WIN I originally claimed — see retractions.

### 108. [ORANGE] RENTALS — There is no OS-level alerting at all: close or background the app and zero alerts reach the dispatcher.

- **job:** find out about an emergency when I'm not staring at the screen
- **primitive:** notification / app badge (absent) · **failure:** invisible · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `sw.js (full file, 47 lines); observed live`
- **evidence:** sw.js is documented 'OFFLINE SHELL ONLY' — 47 lines, only install/activate/fetch/message listeners, no push/notificationclick, no showNotification, no pushManager.subscribe. grep of the 27,649-line app.js for Notification/requestPermission/setAppBadge/pushManager returns zero. NOTIF_DEFAULTS has only in-app bell + sms/email channels, no web-push. Verifier verdict CONFIRMED (documented intentional state, not a defect — but a real gap for the redesign to solve).

### 109. [ORANGE] RENTALS — Every outreach to the driver or customer for a specific rental is a 2-3 screen detour; the only one-tap contact ('Text the Crew') is a Settings-buried whole-roster broadcast.

- **job:** text the driver or customer about THIS rental, right now
- **primitive:** nav control / action button (missing) · **failure:** unreachable · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `observed live`
- **evidence:** No per-rental 'text driver' / 'text customer' action exists on the rental row or detail; reaching a thread is a multi-screen navigation, and the nearest one-tap is the roster-wide 'Text the Crew' broadcast in Settings. Contrasts with how central comms is to the dispatcher's job.

### 110. [ORANGE] RENTALS — Recoveries get no bucket or signal until the day AFTER they're late — only deliveries starting today get a 'Today' group.

- **job:** get equipment recovered before it becomes overdue
- **primitive:** group bar (missing 'Due Back Today') · **failure:** invisible · **scope:** architecture · **role:** dispatcher
- **cite:** `app.js:2016-2017, app.js:9312-9316`
- **evidence:** The lifecycle grouping keys off status/start-date, so a unit due back today sits in 'On Rent' with no distinguishing signal; the first time it's grouped as urgent is once off-rent-overdue trips — i.e. after it's already late. The single most predictable dispatcher task (today's recoveries) has no forward-looking bucket.

### 111. [ORANGE] UNITS — The service-flag text truncates with an ellipsis at roughly 9px font size, cutting off exactly the word that distinguishes an emergency from a non-event ('73 HRS…' could be overdue or remaining).

- **job:** tell overdue from not-yet-due at a glance, on a tablet, outdoors
- **primitive:** flag/badge text, truncation · **failure:** ambiguous · **scope:** density · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `style.css:4806`
- **evidence:** svcText() emits either 'N HRS overdue' or 'N HRS remain'; style.css:4806 sets the mini-card flag to overflow:hidden, text-overflow:ellipsis at font-size:0.5882rem (~9px). Live production example: 'RUN' unit reads '73 HRS…'. In the seeded demo, the same field truncates at different widths on different tiles — Highrise shows '440 HRS OVERDUE' in full while Reptar shows '2025 H…' and Worm shows 'No GP…' for the identical field.

### 112. [ORANGE] UNITS — The one proactive notification bell shows 'Transports due' (a dispatch concern), and every item in the Notifications panel is invoices or card payments — nothing about units, service, work orders, or inspections, and none of it is role-filtered.

- **job:** get notified about something that actually needs a mechanic's attention
- **primitive:** notification bell / panel · **failure:** unreachable · **scope:** architecture · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `measured live (Notifications panel), app.js:14050`
- **evidence:** Bell badge reads 'Transports due · 2.' Opening Notifications shows exactly 6 items, all invoices and card payments, none role-filtered for a mechanic. Notification bodies also render literal '**Verdict:**' with the asterisks showing — confirmed at app.js:14050, the body is esc()'d correctly but only \n→<br>, with no markdown renderer anywhere in the codebase, so authored bold markers show as raw asterisks.

### 113. [ORANGE] UNITS — The 'part ordered, here's when it lands' flag can never fire — its input field has no writer reachable from any UI surface, so its sibling flag is permanently true regardless of actual state.

- **job:** know when an ordered part is arriving
- **primitive:** flag/badge, dead data pipeline · **failure:** invisible · **scope:** architecture · **role:** mechanic / yard tech
- **cite:** `app.js:5874, app.js:8016`
- **evidence:** part-ordered-eta requires w.eta to be set; the partform (the only add/edit surface for a WO line) has no date/ETA input at all, savePartForm initializes eta:'' and never touches it again, and the one ETA editor that does exist lives on the retired workOrders detail renderer that app.js:3052 unconditionally redirects away from. The flag can never be true; its sibling part-ordered-no-eta is always true.

### 114. [ORANGE] UNITS — 58 of 86 interactive controls on the mechanic's screen carry no visible name; 52 of those are explained only by a hover tooltip; zero aria-label exists anywhere in the set.

- **job:** know what a button or icon does without hovering or guessing
- **primitive:** icon buttons / toolbar controls · **failure:** invisible · **scope:** density · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `measured live in seeded demo`
- **evidence:** Full inventory of every clickable control on the Units screen: 86 interactive elements, 58 (67%) have no visible text label, 52 of those 58 are labeled only by a title-attribute hover tooltip — a gesture the audited persona (and any touch-primary user) will never trigger — and there is not one aria-label in the set, even though the repo already pairs aria-label with data-tip in 69 other places elsewhere in the codebase, establishing the pattern is known but unapplied here.

### 115. [ORANGE] UNITS — The Tools menu opens downward from a bottom-bar button with no viewport-collision detection and no internal scroll; at a 576px-tall viewport it clips 6 of its 10 items, including the one switch that disables the hover-preview trap.

- **job:** turn off hover previews (or reach any other tool) from a yard tablet in landscape
- **primitive:** dropdown menu, viewport collision handling · **failure:** unreachable · **scope:** density · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `measured live`
- **evidence:** Opened the Tools menu at a 576px-tall viewport: a 10-item menu rendered in a box that only showed the GENERAL and GPS/FLEET headers before clipping. Measured the full menu — 6 of 10 items sit below the viewport fold with no scroll affordance, including 'Hover previews: on' at y=592, the exact control that would disarm the trap that caused the misclick finding above. Scoped honestly to short viewports — could not force a taller test viewport to confirm it disappears on a tall desktop, but the mechanism (no collision flip, no scroll) is height-dependent by construction.

### 116. [ORANGE] UNITS — Two view-filtering controls ('Sold/Inactive' and 'All Units (any status)') that change which machines exist are listed under a menu header reading SORT, alongside controls that only reorder.

- **job:** understand whether a control changes what's shown or how it's ordered
- **primitive:** dropdown menu, control naming · **failure:** ambiguous · **scope:** density · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `measured live`
- **evidence:** Under a header reading 'SORT' sit 'Sold/Inactive' and 'All Units (any status)' — both filters that change the population of visible machines, not their order. A user picking one expecting a reorder gets a scope change instead, with no visual distinction between the two kinds of control.

### 117. [ORANGE] UNITS — A failed inspection's photo/video report has no visible door to it from the unit's own record — the only link to it is emitted exclusively from the retired Shop-era renderer.

- **job:** review the photos or video from a failed inspection
- **primitive:** link / detail panel · **failure:** unreachable · **scope:** architecture · **role:** mechanic / yard tech
- **cite:** `app.js:9127`
- **evidence:** The js-open-insp link that opens a failed inspection's photo/video report is emitted exclusively by the dead Shop renderer, which is no longer reachable in the shipped card structure; the unit's own Inspection section renders no thumbnail or link to the same content.

### 118. [ORANGE] UNITS — Work-order and inspection links land on the generic top of the unit page — never scrolled, expanded, or highlighted to the specific record clicked — while a sibling flag one line below is a working link and the WOs-open count is not.

- **job:** jump straight to the specific work order or inspection just clicked
- **primitive:** link / deep-link · **failure:** ambiguous · **scope:** interaction · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:3052, app.js:8334`
- **evidence:** Contrast with the two places the app gets this right — openInvoice and startNewWorkOrder both scroll, expand, and attnFlash the target record. Unit WO/inspection links instead land generically at the top of the unit page, forcing the user to search for the record they clicked. Separately, the 'N WOs Open' flag on a tile is not a link though its sibling flag one line below it is (app.js:8334).

### 119. [ORANGE] UNITS — The unit history log does not sort chronologically — it sorts on a per-page-load counter that resets to zero on every reload, so entries from different sessions/users interleave at random even though real timestamps are recorded and sit unused.

- **job:** read a machine's service and action history in the order it actually happened
- **primitive:** list / log ordering · **failure:** lying · **scope:** density · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:9153, app.js:22568 (actionSeq resets to 0)`
- **evidence:** History sorts on 'seq' (app.js:9153: acts.slice().sort((a,b)=>b.seq-a.seq)); seq comes from a module-level counter, let actionSeq = 0, that resets every page load (app.js:22568), so two different sessions' seq values are independent counters, not a shared ordering. Observed live on real production unit SPEECHLESS: entries rendered in order Jun 17, Jun 17, Jul 18, Jun 22, Jul 18, Jul 13 — a shuffled deck. Real when+clock timestamps sit in every record, unused by the sort. This was subsequently fixed (PR #741, sorts on when+clock now) — flagging it here because it demonstrates a systemic pattern worth checking on any other card's log/history view: does its sort key survive a page reload?

### 120. [ORANGE] UNITS — The mechanic's own Worklist graph and the group-bucket list it filters disagree on the same number for the same label — the graph counts the whole fleet, the list hard-filters to Active units first, so tapping a segment yields fewer rows than the number promised with no explanation.

- **job:** trust that tapping a worklist segment shows the units that number promised
- **primitive:** graph/chart segment + click-through filter · **failure:** inconsistent · **scope:** signal · **role:** mechanic / yard tech
- **cite:** `app.js:12167 (graph tally), app.js:9295 (list filter)`
- **evidence:** Live and in the code: the Worklist graph shows 'NOT READY 28' while the group bar roughly 40px below it on the same screen shows 'NOT READY · 8' — same label. The graph's tallies (app.js:12167-12170) run over every unit in DATA.units unconditionally; the list's grouping (app.js:9295) excludes out-of-fleet and on-rent units before it ever reaches the Not-Ready test. A third, narrower definition lives in unitsAlertCount (app.js:9479). Three different definitions of 'needs attention' coexist on one card, with no escape hatch short of manually switching sort to 'All Units (any status).'

### 121. [ORANGE] UNITS — The mechanic's entire tailored landing (open worklist, service-due sort) is keyed off the hardcoded role name 'mechanic'/'mtech', even though the app's own config states role names are renameable and permissions must not key off them.

- **job:** keep the mechanic's tailored landing screen working after an admin renames or customizes the role
- **primitive:** role-based configuration lookup · **failure:** inconsistent · **scope:** architecture · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:25639, config.js:342`
- **evidence:** ROLE_LANDING is a lookup keyed by the literal ids 'mechanic'/'mtech' (app.js:25639-25641), while config.js:342 states roles are runtime-customizable in Settings → Roles & Logins and 'permissions can no longer key off role NAMES.' If the yard renames the Mechanic role or adds a custom one, ROLE_LANDING[currentRole] is undefined, applyRoleLanding returns early (line 25652), and the mechanic silently loses both the open worklist graph and the service-due sort — landing instead on alphabetical Units with collapsed groups, which is exactly the failure state this audit initially (and mistakenly) diagnosed as the shipped default.

### 122. [ORANGE] UNITS — Collapsed group headers show only a bare unit count, with no sub-count of how many units inside are actually flagged, and collapse state persists indefinitely with no urgency override to force a red-carrying group back open.

- **job:** tell whether a collapsed bucket is worth opening without expanding every one
- **primitive:** group header / bucket count · **failure:** invisible · **scope:** signal · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `app.js:9429, app.js:9358`
- **evidence:** Group headers render a label and a raw count only — no red/yellow flagged sub-count. groupDefaultCollapsed special-cases only the Calendar's 'Earlier' bucket (app.js:9358); every Units group defaults open, but once a user collapses one, that state persists per device/account forever with no urgency floor to reopen it even when it starts carrying red-flagged units.

### 123. [ORANGE] UNITS — The bucket ordering places the yellow-severity 'Not Ready' group above the red-severity 'Needs Attention' group, inverting the app's own color-severity hierarchy.

- **job:** trust that the worse bucket is always listed first
- **primitive:** group/bucket ordering · **failure:** inconsistent · **scope:** architecture · **role:** mechanic / yard tech
- **cite:** `app.js:9280`
- **evidence:** UNIT_SECTIONS orders 'Not Ready' (yellow) ahead of 'Attention' (red) in the rendered stack, contradicting the severity ranking the rest of the card's color system implies (red always meant to outrank yellow elsewhere).

### 124. [ORANGE] UNITS — The 'N on hand' part-quantity number shown on a work order line is purely decorative — qtyOnHand is never decremented when a part is actually consumed by a repair or service.

- **job:** know if the part I need is actually in stock before I go look for it
- **primitive:** numeric field / inventory count · **failure:** lying · **scope:** signal · **role:** mechanic / yard tech
- **cite:** `app.js:6169`
- **evidence:** qtyOnHand is rendered as if it reflects live stock but is never decremented anywhere in the app when a part is consumed by a work order or a service task — the number is set once and never moves with usage.

### 125. [ORANGE] UNITS — With the Shop card retired, work orders live only inside each individual unit's record — there is no single place to see every open job across the whole fleet at once, and the ex-Shop quick filters built for exactly that view are unreachable, along with completed/cancelled work orders having no home anywhere.

- **job:** see every open work order across the whole yard at a glance
- **primitive:** card placement / retired-card scar (quick filters, list scope) · **failure:** unreachable · **scope:** architecture · **role:** mechanic / yard tech
- **cite:** `app.js:3167, app.js:7669, observed live`
- **evidence:** Merle's own words, driving it live: "the Shop card's gone. Work orders live down inside each unit now. So there's no one place I can stand and see every open job. I gotta open machines one at a time." In code: the ex-Shop quick filters '__wo' (WOs Open / Parts Ordered) and '__svc' (Service Due) are fully implemented with human labels but nothing links to them (app.js:3167); completed and cancelled work orders are filtered out of a unit's own Work Orders section and appear on no card anywhere (app.js:7669). RUS_TABS.units, including the ex-Shop 'Field Calls' panel, is registered in code but unreachable because the stack meant to surface it is gone (app.js:12933).

### 126. [ORANGE] UNITS — The Work Orders bar shows a count of open work orders, but clicking a segment filters by unit — a unit carrying 2 open WOs is one row in the resulting list but counted twice in the bar, so the number on the bar structurally cannot match the rows beneath it.

- **job:** trust that the number on a bar matches what you get when you tap it
- **primitive:** bar/tally + click-through filter · **failure:** lying · **scope:** signal · **role:** mechanic / yard tech
- **cite:** `app.js:12170`
- **evidence:** woByPhase tallies one entry per open work order; the click-through filters the underlying unit list. Any unit with more than one open WO inflates the bar's count relative to the row count it produces when tapped.

### 127. [ORANGE] UNITS — The Round-Up Reports board's Money section — revenue, net sales, top customers, open account balances — renders to every signed-in role with no permission gate, including roles that should never see financial data.

- **job:** keep revenue and balance data restricted to roles that should see it
- **primitive:** card section / role-based data gate · **failure:** inconsistent · **scope:** architecture · **role:** owner-operator · **SYSTEMIC**
- **cite:** `app.js:12972`
- **evidence:** The Money section of the Round-Up Reports board renders unconditionally for every signed-in role, with no check against a money-viewing permission — found while auditing the Units card's board views but affects a shared board surface, worth treating as a data-gate change rather than a simple cleanup for the redesign.

### 128. [ORANGE] UNITS — Multi-unit rentals still trip a legacy single-unit assumption in the cross-card cascade logic: anchoring the non-primary unit of a multi-unit rental cascades to an empty Rentals column instead of the rental it's actually on.

- **job:** click a unit and see its associated rental show up in the linked column
- **primitive:** cascade / cross-card linking logic · **failure:** unreachable · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `cascade.js:101`
- **evidence:** cascade.js's addRental still matches rentals by the legacy scalar r.unitId only, ignoring the units[] array that real multi-unit rentals carry — the same anti-pattern that caused markFieldCall to fail the wrong machine on a multi-unit rental (app.js:20006, since fixed independently in PR #740). Anchoring unit #2 or #3 of a multi-unit rental finds nothing and cascades to an empty column. Parked rather than fixed because correcting it changes what appears in every anchored column app-wide — a product decision (should anchoring one unit pull in its sibling units?) rather than a pure bugfix.

### 129. [ORANGE] UNITS — There is no push-notification pipeline of any kind, no 'assigned to me' badge, no auto-post to team chat when a flag condition flips true, and toast confirmations self-clear in ~2.2 seconds with no durable trail — so a uninsured or overdue machine can go out the gate with nothing on the mechanic's tablet ever having said so unless he happened to be staring at the right row at the right moment.

- **job:** get told about something that needs a mechanic's attention without staring at the screen all day
- **primitive:** push/notification pipeline, toast, chat integration · **failure:** invisible · **scope:** signal · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `grepped — zero PushManager/showNotification/Notification.requestPermission calls in app.js; sw.js registered for offline-cache only`
- **evidence:** sw.js exists purely for offline-cache + reload-for-new-build; a full grep of app.js turns up zero PushManager, showNotification, or Notification.requestPermission calls anywhere. All ten FLAG_COND.units predicates (service-past-due, inspection-failed, uninsured-active, coverage-expired, wash-requested, etc.) fire silently into data with no messenger. Team chat only ever rings for human-typed messages. Toasts are the only confirmation surface and self-clear in ~2.2 seconds with no durable inbox or log. The 18-second background poll has no change-since-last-look digest of any kind.

### 130. [ORANGE] UNITS — Clicking a unit's own name does not open its detail record — it instead surfaces two tiny, unlabeled icons (an eye and a plus) that the user must then correctly interpret, one of which is the hover-preview trap that causes the destructive misclick finding above.

- **job:** open a machine's record by clicking on it, the way a name/row click is expected to work
- **primitive:** list row / primary click target · **failure:** ambiguous · **scope:** interaction · **role:** mechanic / yard tech
- **cite:** `observed live, corroborates app.js:3008 / style.css:825`
- **evidence:** Live drive: clicking the unit NAME on a mini-card did not open the unit; it revealed two tiny unlabeled icons — a '.js-roweye' (tooltip only: "Hover: preview · Click: previews OFF app-wide") and a '.js-newtab' (tooltip only: "Open in new tab (+)"). Neither icon carries a visible label; the eye's actual click behavior toggles a GLOBAL app-wide setting, while hovering it (not clicking) opens the same live-control preview panel responsible for the misclick finding above. A user expecting a direct 'click the name to open it' affordance instead lands in an unlabeled, easily-misread icon pair.

### 131. [ORANGE] UNITS — Near-identical status text — 'Part Needed,' 'Part Ordered,' 'Part Needed?' — sit side by side on tiles looking almost the same at a glance, and the question-mark variant renders in different colors (red on one tile, amber on the next) for what reads as the identical state.

- **job:** tell apart three closely-worded part-status labels at a glance
- **primitive:** status label / color-coding consistency · **failure:** ambiguous · **scope:** density · **role:** mechanic / yard tech
- **cite:** `observed live, corroborated in app.js:6989 flag logic`
- **evidence:** 'PART NEEDED,' 'PART ORDERED,' and 'PART NEEDED?' render as near-identical text at a glance; the 'PART NEEDED?' variant specifically was observed rendering red on one tile (Worm) and yellow/amber on another tile (Mustache, Snoopy) despite reading as the same status.

### 132. [ORANGE] UNITS — Blank 'hours at completion' when logging a service silently records the service at 0 hours, corrupting the future countdown baseline for that task with no reject and no default to the unit's current reading.

- **job:** log a completed service without corrupting the baseline the next countdown is measured from
- **primitive:** form field, missing input guard · **failure:** destructive · **scope:** interaction · **role:** mechanic / yard tech
- **cite:** `service-countdown.js:135`
- **evidence:** The completion form accepts a blank 'hours at completion' value and records it as 0 with no validation — every future countdown for that specific service task is then measured from a false zero baseline rather than the unit's actual current hours.

### 133. [ORANGE] UNITS — Completing one blocking work order while a second blocking WO remains open reports plain success with no explanation for why the unit is still shown red.

- **job:** understand why a unit is still flagged red after completing the repair I was asked to do
- **primitive:** completion action / toast · **failure:** ambiguous · **scope:** interaction · **role:** mechanic / yard tech
- **cite:** `app.js:22594`
- **evidence:** woCompleteCascade reports success on completing one WO even when a second, independently blocking WO remains open on the same unit — the UI never tells the user the unit is still red because of a different, still-open work order.

### 134. [ORANGE] UNITS — A unit's tile shows only its single newest open work order with no total count, so an older and more severe work order sitting alongside it is masked from view entirely.

- **job:** see the most urgent open work order on a machine, not just the most recent one
- **primitive:** tile summary field · **failure:** invisible · **scope:** signal · **role:** mechanic / yard tech
- **cite:** `app.js:2144`
- **evidence:** The mini-card surfaces only the newest open work order and displays no count of how many total are open on the unit; an older, higher-severity work order existing alongside a newer, benign one is completely hidden from the tile.

### 135. [YELLOW] Calendar / Driver — Every other floating surface on this card closes on Escape via dismissTopSheet(), but no Escape path ever calls closeMenus() — the driver-assignment dropdown is click-outside-only.

- **job:** back out of an accidental menu open with the keyboard, like every other overlay on the card allows
- **primitive:** dropdown menu / keyboard dismissal · **failure:** inconsistent · **scope:** interaction · **role:** dispatcher
- **cite:** `app.js:11221, 16889 (click-outside only), 26562-26609 (Escape chain excludes dropdown-menu)`
- **evidence:** Verified live: after Escape the driver-picker dropdown remained display:block. A later one-line patch attempt was itself downgraded on review — it would desync Escape from the Android hardware-back chain, which the code's own comment says is meant to stay in lockstep.

### 136. [YELLOW] Calendar / Driver — Measured live against its siblings: Units and Customers both carry a 'Name ▲▼' sort control and a graph toggle in their listbar. Trips' listbar is empty — no sort, no global search, no stats toggle.

- **job:** put his own day in the order he wants to work it, the way every other list in the app lets him
- **primitive:** listbar / sort control · **failure:** inconsistent · **scope:** architecture · **role:** driver
- **cite:** `measured live in DOM against Units/Customers listbars`
- **evidence:** Every habit built on any other card (sort, search scope, stats toggle) fails to transfer to Trips.

### 137. [YELLOW] Calendar / Driver — The back control is an unlabeled bare chevron. It functions correctly — round trip verified back to Trips with state restored — but a driver who won't infer has no textual cue it's 'his way back.'

- **job:** recognize, without guessing, which control returns him to where he was
- **primitive:** back button · **failure:** ambiguous · **scope:** density · **role:** driver
- **cite:** `verified live round trip from a rental record back to Trips`
- **evidence:** Corrects an earlier over-read from the lens pass: back is not broken, only undiscoverable — the two failure modes call for different fixes (a label, not a repair).

### 138. [YELLOW] Calendar / Driver — A merged trip is marked done only when every one of its stops is done, and the group header's '· N done' suffix counts whole trips, not individual stops — four stops with three logged still contributes zero to 'done.'

- **job:** see partial progress on a multi-stop run instead of it reading as if nothing happened
- **primitive:** group header done-count · **failure:** ambiguous · **scope:** signal · **role:** driver
- **cite:** `app.js:11586 (trip-level done requires every stop), 9343 (group suffix counts trips)`
- **evidence:** A downstream review flagged this may be intentional per the card's own accounting spec ('Row = one Trip'), so it isn't a clear-cut defect — but the practical read for a driver mid-run is still 'nothing counted,' regardless of intent.

### 139. [YELLOW] Calendar / Driver — driverRoster() filters employees by /driver/i on the role field, then falls back to returning every employee if that filter comes back empty — one blank/mistyped role field would make bookkeepers assignable as drivers.

- **job:** trust that the assign-a-driver list only ever contains actual drivers
- **primitive:** driver picker dropdown · **failure:** lying · **scope:** signal · **role:** dispatcher
- **cite:** `app.js:11281`
- **evidence:** Confirmed real in code, but latent: the live picker on production currently and correctly shows exactly one name — a landmine, not an active fire.

### 140. [YELLOW] Calendar / Driver — When Trips isn't the active tab, its label truncates to a single character ('T'); the full word only exists in a hover tooltip.

- **job:** identify which tab is which by reading a label, not guessing from an icon and a number
- **primitive:** tab label · **failure:** ambiguous · **scope:** density · **role:** driver
- **cite:** `style.css:699`
- **evidence:** Confirmed reproducing on touch-capable tablet/narrow-desktop widths (the 2-3 column layout); phones use a separate icon-only nav that avoids this path, so the affected population is narrower than a driver's own phone but still real on touch-only wide layouts.

### 141. [YELLOW] Calendar / Driver — The graph-icon glyph (I.graph) means 'Graph view / stats' in the first toolbar slot on every other card, but means 'hide the live map' in the identical first-slot position on the Trips toolbar.

- **job:** trust that an icon he's learned on one card means the same thing on another
- **primitive:** toolbar icon · **failure:** inconsistent · **scope:** signal · **role:** driver
- **cite:** `app.js:9647`
- **evidence:** Same glyph, same slot, opposite job — a driver who's learned the icon elsewhere in the app has no correct expectation for what it does here.

### 142. [YELLOW] Calendar / Driver — The tel: href is normalized everywhere, but the visible label renders whatever raw string was originally typed — three of four live rows showed a formatted '(337) 555-0143' shape and one showed a bare '3373046590,' same data type, two presentations.

- **job:** read a phone number in a consistent, scannable format regardless of who entered the record
- **primitive:** phone number label · **failure:** inconsistent · **scope:** density · **role:** driver · **SYSTEMIC**
- **cite:** `app.js:7368 (Trips row), 11742 (telHref normalizes only the href); identical pattern confirmed on Vendors app.js:6154`
- **evidence:** Not Trips-local: no phone-formatting helper exists anywhere in the app for the visible label, and the same raw-vs-formatted split reproduces on the Vendors card — an app-wide display convention gap.

### 143. [YELLOW] Calendar / Driver — The map panel renders whenever mapOpen is true, completely independent of whether there are any trips — a zero-trip day still gets 260px of map with a degenerate marker and no route, over a low-contrast grey-on-grey 'NO HAULS ON THE BOOKS' plate.

- **job:** immediately recognize an empty day as empty, not as a broken or loading screen
- **primitive:** empty state / map panel · **failure:** invisible · **scope:** density · **role:** driver
- **cite:** `app.js:9660 (map render gated only on mapOpen), 9678 (independent trips-length check), style.css:875-877 (grey-on-grey empty plate)`
- **evidence:** The low-contrast treatment is exactly the visual cue this persona reads as 'nothing here, not my problem' — correct on a genuinely empty day, but the screen gives no confident signal that it's empty rather than broken.

### 144. [YELLOW] Calendar / Driver — Settings → Notifications → Crew Alerts already has a toggle named 'Driver Assigned' ('Texts a driver the moment a delivery or pickup is assigned to them') — scoped and named in the settings schema, but defaulted off and explicitly commented in-code as inert until a later phase ships the SMS path.

- **job:** turn on the exact notification he needs using a control already sitting in Settings
- **primitive:** settings toggle · **failure:** unreachable · **scope:** architecture · **role:** driver · **SYSTEMIC**
- **cite:** `app.js:5161 (default enabled:false), 5282 (toggle+description), 5291 ("Phase D — the toggles lock in intent now")`
- **evidence:** The gap isn't a missing idea — the product already named and scoped the fix. It's a build gap, and raises a UI-system question worth checking on other cards: how many other Settings toggles are visible-but-inert stubs.

### 145. [YELLOW] Categories — The four flat rate tiles (1-Day/7-Day/4-Week/Weekend) are the category's reference rates, not an invoice total, but nothing on the card lets a rep derive what an arbitrary-length rental actually bills, and the card gives no signal that mental math is required.

- **job:** quote the total price for a specific rental length (e.g. "ten days")
- **primitive:** rate tile / mini-card face · **failure:** ambiguous · **scope:** architecture · **role:** counter-sales rep
- **cite:** `app.js:1070-1107 (rentalPrice blends 4-Week/7-Day/1-Day for cheapest combo) vs app.js:7271-7275/7317 (flat tiles only, no length input, no blend)`
- **evidence:** Live-tested: a 10-day rental actually bills a blended $2,270; doing it in his head off the four tiles, Dewey quotes $3,600 — a $1,330 (59%) overquote from mental math alone, and "nobody ever tells me I was wrong."

### 146. [YELLOW] Categories — A rate field explicitly set to 0 renders as an em-dash "—" on the mini-card (truthy check on the raw value) but as "$0" in the detail (efld's has-check treats 0 as present) — the same stored value reads as two different things depending which surface you're on.

- **job:** tell whether a price tier exists at all versus was deliberately set to zero
- **primitive:** rate tile · **failure:** ambiguous · **scope:** density · **role:** counter-sales rep
- **cite:** `app.js:7271-7275/7292 (`v ? money(v) : '—'`) vs app.js:8876-8879/8929 (efld `has` = `raw !== '' && raw != null`, money(0) → "$0")`
- **evidence:** Confirmed by direct code read and matches the live "—" seen on unpriced tiers; there is no distinct "no such tier" state in the data model, so the two renderers disagree on the meaning of the identical 0.

### 147. [YELLOW] Categories — The "next available" date switches convention with no visible marker: inside 7 days it shows a bare weekday abbreviation ("Mon"), beyond 7 days it switches to month+day ("Aug 3") — nothing on the pill or its tooltip states which convention is in play or that a switch happened.

- **job:** know exactly which day a machine becomes free next
- **primitive:** status pill / lead badge · **failure:** ambiguous · **scope:** density · **role:** counter-sales rep
- **cite:** `app.js:7272 (`daysAhead <= 7 ? DOW3[...] : fmtShortDate(...)`), app.js:7275 (badge text `Next ${when}`, no disambiguating label); config.js:561-565 fmtShortDate`
- **evidence:** Sibling surfaces use a different, unified "Next Aug 3" style, so the two-format switch is Categories-specific and unlabeled in both the pill and its data-tip.

### 148. [YELLOW] Categories — The Pass/NR/Fail inspection tally sits as the single loudest, most prominent row on the mini-card, and frequently reads 0/0/0 (nothing to report), yet it occupies the visual space that would otherwise carry the one thing the persona needs (price/availability).

- **job:** scan a card face and find the number that actually answers the question in 11 seconds
- **primitive:** tally chip row · **failure:** ambiguous · **scope:** signal · **role:** counter-sales rep
- **cite:** `tally() renderer, mini-card top block (Pass/NR/Fail)`
- **evidence:** Live-observed: "them Pass/NR/Fail chips sit up top, big as life, and half of 'em say zero zero zero. That's the loudest row on the card and it don't help me quote a thing."

### 149. [YELLOW] Categories — The Categories tab label renders truncated to "CATEG…" whenever it isn't the active column, because whichever card isn't currently showing gets its name chopped.

- **job:** find and switch to the Categories card in the first place
- **primitive:** nav control (column tab) · **failure:** ambiguous · **scope:** density · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `observed live on app.jacrentals.com column-tab strip`
- **evidence:** "I gotta remember to hit the little gray 'CATEG…' tab — which is cut off, 'cause whichever card ain't showing gets its name chopped."

### 150. [YELLOW] Categories — The "+Lost" demand-tracking button logs to a private per-category array and toasts only the person who clicked it; nobody in purchasing/fleet-planning is ever told, and the dedicated "Lost Demand" rollup board specified in the product docs was never built.

- **job:** escalate "we keep losing this sale" to the person who can actually order more of that machine
- **primitive:** button (+Lost) / rollup board (absent) · **failure:** unreachable · **scope:** architecture · **role:** counter-sales rep
- **cite:** `app.js:2108-2114 lostDemandBtn; app.js:18638/18700 handler (logAction + local-only toast); config.js:403-410 BACKOFFICE_BOARDS has no 'demand' entry; docs/specs/market-research.md §6.3 specifies the missing board`
- **evidence:** The tool to escalate a real signal exists and is used, but the information dead-ends at the tapping user's own device.

### 151. [YELLOW] Categories — Escape does not close open menus — the right-click context menu and the sort menu both survive an Escape keypress and sit open over the rate values underneath; closeMenus() is wired into ~30 click paths but never the keyboard chain.

- **job:** dismiss an open menu quickly to see the data it's covering
- **primitive:** menu (context/sort) · **failure:** inconsistent · **scope:** interaction · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:26605 (the one global Escape chain: winpicker → overlay → Wrangler dock → chat dock — dropdown menus not in it)`
- **evidence:** Live-confirmed twice, including a session where the sort menu was found still open from an earlier Escape press.

### 152. [YELLOW] Categories — The colored badge on an open Categories record's tab strip shows a fixed navy fuel-type chip instead of a status-color badge, unlike every sibling card (rentals/units/workOrders/invoices/customers), all of which derive their tab badge from a real getStatus() call.

- **job:** glance at the open-record tab strip and know whether that record needs attention
- **primitive:** nav control (tab badge) · **failure:** inconsistent · **scope:** signal · **role:** dispatcher
- **cite:** `app.js:12143/12149 (`rec.fuelType ? badge(rec.fuelType, 'navy') : ''`, no getStatus call, no category status field consulted)`
- **evidence:** "No color = nothing wrong" is the habit every other tab teaches; here it just means the fuel-type field doesn't apply. Navy isn't in the red/yellow/green urgency vocabulary, which limits (but doesn't eliminate) the real-world risk.

### 153. [YELLOW] Categories — A category with zero units still computes and prints "0 HRS" avg hours and "$0" avg revenue/expense per unit as if they were real measurements, because the divide-by-zero guard (`n = us.length || 1`) produces 0/1=0 instead of null — while ROI, right beside it, correctly returns null/blank in the identical situation.

- **job:** tell whether a displayed stat is real data or just an artifact of an empty category
- **primitive:** stat tile (kv) · **failure:** lying · **scope:** signal · **role:** owner-operator
- **cite:** `app.js:2345 (`n = us.length || 1`), app.js:2368-2370 (avgHours/avgRevUnit/avgExpUnit), render sites app.js:8935/8970/7527 (none check count===0); contrast app.js:2363 where roi is correctly gated to null`
- **evidence:** The app already knows how to represent "no data" for one field (ROI) but not the two right beside it.

### 154. [YELLOW] Categories — The weekend-rate qualifying window (Fri→Sun, Fri→Mon, or Sat→Mon only — Sat→Sun deliberately excluded) is a real, deliberately-coded business rule, but no UI surface states it: the "Weekend" label carries no tooltip on either the mini-card or the detail.

- **job:** tell a caller exactly which weekend stays qualify for the weekend rate
- **primitive:** rate tile (missing tooltip) · **failure:** invisible · **scope:** density · **role:** counter-sales rep
- **cite:** `app.js:1079-1085 (rule enforced, explained only in a code comment); app.js:7292/7317 rate() helper has no title/tip param; app.js:8878 detail priceFld has the same gap`
- **evidence:** The engine — not the counter rep — ultimately prices any booked rental correctly, so this is a communication gap rather than a billing risk, but it forces the rep to guess or call someone.

### 155. [YELLOW] Categories — The Category field on a Unit's detail is rendered as an admin-gated reassignment `<select>` rather than a normal navigable link, unlike Rentals and Work Orders, which render the identical category reference as an ordinary clickable pill any user can follow to the category record.

- **job:** navigate from a unit to its category's pricing/stock without needing admin rights
- **primitive:** linked-record pill · **failure:** inconsistent · **scope:** architecture · **role:** mechanic / yard tech
- **cite:** `app.js:8575 (efld editKind:'unitCategory', admin:true, link:true) vs app.js:8523 (Rentals, plain data-pill-card) and app.js:9119 (Work Orders, plain pill)`
- **evidence:** Appears deliberate (a code comment documents opts.admin gating "Categories and pricing" edits) but functionally blocks a non-admin from reaching category context from the unit they're looking at.

### 156. [YELLOW] Categories — The audit-history redaction that hides dollar amounts from below-money-tier viewers blanks the entire line ("1-Day rate: $••• → $•••"), so a lower-tier viewer can't even see THAT a rate changed, only that some field named "1-Day rate" was touched.

- **job:** confirm from the audit trail that a price changed, even without needing the exact number
- **primitive:** history log line · **failure:** invisible · **scope:** signal · **role:** counter-sales rep
- **cite:** `app.js:22578-22582 (auditVal/histText, redacts any `$…` value for non-canMoney() roles)`
- **evidence:** Only bites a role configured below the money tier, but for that role even the fact-of-change is lost, not just the amount.

### 157. [YELLOW] Categories — No push-notification or service-worker delivery channel exists anywhere in the frontend — sw.js is explicitly documented as an offline-shell cache only, with no push listener or Notification API usage in app.js.

- **job:** get alerted to a price or stock change while the app isn't the focused tab
- **primitive:** notification channel (absent) · **failure:** unreachable · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `sw.js full read (install/activate/fetch/message listeners only); no `Notification`/`showNotification`/`push` anywhere in app.js`
- **evidence:** A capability gap, not a wiring gap — even a category rate-change broadcast (finding above) would still only reach a foregrounded, focused tab.

### 158. [YELLOW] Categories — Mr. Wrangler (the in-app assistant) carries the fully correct live rate sheet and computes the real blended price via find_categories/price_rental — but this is pull-only, never volunteered, and reachable only through a right-click context menu, a gesture this persona has never performed.

- **job:** get the correct price without doing mental math or clicking into a gated detail
- **primitive:** menu (right-click) / chat · **failure:** unreachable · **scope:** interaction · **role:** counter-sales rep
- **cite:** `app.js:15092-15093 wranglerDigest (bakes live rate sheet into context), app.js:15259-15262/15320-15330 find_categories/price_rental (real pricing engine); right-click menu confirmed live to offer Copy/Paste/Global Search/Add Comment/Ask Mr. Wrangler`
- **evidence:** "He's had the right answer this whole time. He's just behind a right-click, and I have never right-clicked anything in my life." The accurate answer sits one gesture away from every problem above.

### 159. [YELLOW] Categories — Hovering a category row reveals a quick-view "eye" icon and a "+" icon that render directly over the 1-Day rate value, obscuring the exact number the persona is trying to read.

- **job:** read a rate value without a hover-triggered control covering it
- **primitive:** hover icon overlay · **failure:** invisible · **scope:** interaction · **role:** counter-sales rep
- **cite:** `observed live on the Lift Boom 65ft category row during a full click-through pass`
- **evidence:** Hidden affordances materialize on hover directly on top of the data the reference card exists to show.

### 160. [YELLOW] Categories — The category detail's "$ UTIL" (ROI) tab renders an empty state in live production — "No revenue against a recorded cost basis yet — set true cost or purchase price on units" — because trueCost/purchase price is not populated on units, so the ROI feature is largely inert despite the gate/leak defects existing in its code.

- **job:** see a category's real return-on-investment, not just its revenue
- **primitive:** graph (empty state) · **failure:** invisible · **scope:** signal · **role:** owner-operator
- **cite:** `live-observed empty-state copy on the $ UTIL tab`
- **evidence:** Scopes (does not remove) the ROI-gate-leak finding above: the leak is real in code, but with trueCost largely unset there is currently little live margin data to leak — Revenue, by contrast, is populated and its phantom-count defect is fully live.

### 161. [YELLOW] Customers — Grouping is by pay status only, so the group header a person scans first carries no aggregate danger signal — a blacklisted or no-card customer at $0 owed sits under a calm green "Current" header.

- **job:** scan a whole bucket of customers for danger without opening each row
- **primitive:** group header · **failure:** invisible · **scope:** signal · **role:** counter-sales rep
- **cite:** `app.js:9317-9319`
- **evidence:** Narrowed on verify: individual flagged rows still show their red name-tint inside the bucket (not fully invisible), but the header itself — the thing actually scanned — stays green with no count or colour change.

### 162. [YELLOW] Customers — A dead/missing invoice link returns silently with no toast, no shake, no feedback of any kind.

- **job:** open an invoice referenced elsewhere on the card without wondering if the app froze
- **primitive:** link / pill · **failure:** invisible · **scope:** interaction · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `app.js:3064 (if (!inv) return;)`
- **evidence:** Confirmed: the handler exits with no user-facing signal at all when the invoice record can't be found; a repeated click looks identical to the first.

### 163. [YELLOW] Customers — A card control (the global search-scope "globe" toggle) fired from the Customers card silently changed the Units card's search scope as well, with no indication the change was global rather than local.

- **job:** search within Customers without unknowingly changing how a different card behaves
- **primitive:** global scope toggle · **failure:** invisible · **scope:** architecture · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `observed live during control enumeration — not captured in the artifact or verify JSON`
- **evidence:** Toggling "search everything" from the Customers card was observed to also flip the Units card's search to the same global scope; the control gives no visible signal that its effect isn't scoped to the card it lives on.

### 164. [YELLOW] Customers — A fixed "new version available" service-worker toast sits directly over the bottom alert-chip row for the entire session, at measured coordinates that put it on top of, not beside, the alerts a person would otherwise glance at.

- **job:** see her own alert chips without a system update banner sitting on top of them
- **primitive:** fixed toast vs. alert-chip row (z-index stacking) · **failure:** invisible · **scope:** density · **role:** counter-sales rep · **SYSTEMIC**
- **cite:** `style.css:5580-5583 (.sw-toast, z-index:300) · app.js:17472 (swInit)`
- **evidence:** Measured precisely on production: the fixed toast (x 500–920) sits at z-index 300 directly occluding the alert-chip row at y 663–681, for the full duration it was on screen.

### 165. [YELLOW] RENTALS — The 'next move' on an open rental is a status noun on a pill, not an action — nothing says 'go get it'.

- **job:** decide and take the next action on a rental
- **primitive:** status pill / CTA · **failure:** ambiguous · **scope:** signal · **role:** dispatcher · **SYSTEMIC**
- **cite:** `config.js:63-74, pill app.js:6017-6024`
- **evidence:** A 22px pill reads 'Off Rent'; there is no verb and no primary CTA on the open rental. 'Off Rent' reads like routine progress even when it means the machine is 3 days overdue. For a dispatcher who won't infer, a noun is not an instruction.

### 166. [YELLOW] RENTALS — Advancing a status straight from the list row works on Rentals but nowhere else, so the muscle memory doesn't transfer to sibling cards.

- **job:** act on a record the same way on every card
- **primitive:** list row / status pill · **failure:** inconsistent · **scope:** interaction · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:7061 vs app.js:6963-6981`
- **evidence:** Rentals rows expose the status gate inline (masterGate on the row); Units and the other cards require opening the record first. Nothing signals the difference — a learnable interaction is card-specific for no visible reason.

### 167. [YELLOW] RENTALS — On a day-one/empty roster the dispatcher hits a dead end: the +Driver chip is suppressed when no drivers exist, and the 'add drivers first' hint fires only FROM that suppressed chip.

- **job:** assign my first driver on day one
- **primitive:** chip / empty-state hint · **failure:** unreachable · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `app.js:7356/7359, app.js:18614/18618`
- **evidence:** The guidance that would tell a new dispatcher what to do is gated behind the very control that's hidden when the precondition (no drivers) is true — so they see unassignable trips and no explanation. Completeness-critic finding, source-grounded.

### 168. [YELLOW] RENTALS — There is no daily digest / morning brief — nothing summarizes returns due, field calls and unpaid balances at clock-in.

- **job:** see everything that needs me today when I clock in
- **primitive:** summary view (absent) · **failure:** invisible · **scope:** architecture · **role:** dispatcher · **SYSTEMIC**
- **cite:** `observed live`
- **evidence:** No 'here's your day' surface exists; a dispatcher assembles the day by scanning multiple cards. The information all exists in the data but is never composed into a start-of-shift view.

### 169. [YELLOW] RENTALS — The controls that clear an anchor/cascade filter work but are hover-revealed and unlabeled — a touch or lazy user feels stuck after drilling into one record.

- **job:** get back to the full list after drilling into one record
- **primitive:** nav control / tab close-X (hover-only) · **failure:** unreachable · **scope:** interaction · **role:** dispatcher
- **cite:** `app.js:2588-2592, app.js:9748-9750`
- **evidence:** SCOPED by verification: a visible clear DOES exist (the anchored item opens a foreground tab whose close-X is the documented clear path; plus double-click anywhere on the open card clears it), so the original 'no escape at all' was wrong. The residual is only discoverability: nothing is labeled 'clear anchor', the tab-X is hover-revealed, and the double-right-click clear has no affordance. Verifier verdict PARTIAL. See retractions.

### 170. [YELLOW] UNITS — Notification text is escaped correctly but never parsed for markdown, so authored formatting like **Verdict:** renders with the literal asterisks visible to every user, on every card, not just Units.

- **job:** read a notification cleanly, without visual noise
- **primitive:** notification text rendering · **failure:** ambiguous · **scope:** density · **role:** AR-office clerk · **SYSTEMIC**
- **cite:** `app.js:14050`
- **evidence:** Notification bodies are correctly esc()'d for safety and only convert \n to <br> — there is no markdown renderer anywhere in the codebase, so a notification authored with **Verdict:** displays the raw asterisks. Confirmed live in the Notifications panel.

### 171. [YELLOW] UNITS — A pill tap gives no immediate visual feedback while the 220ms double-click discriminator resolves, so an impatient second tap can silently fork a new browser tab instead of registering the intended single action.

- **job:** tap a status pill once and get one predictable result
- **primitive:** pill/flag tap target · **failure:** ambiguous · **scope:** interaction · **role:** mechanic / yard tech · **SYSTEMIC**
- **cite:** `backlog item S18`
- **evidence:** No visual acknowledgment renders on a pill tap before the double-click discriminator (220ms window) resolves; a user who taps again out of impatience triggers the double-click branch, which opens a new tab rather than the single-tap action, with no indication of what just happened.

