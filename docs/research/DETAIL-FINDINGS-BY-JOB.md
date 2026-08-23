# Detail-view findings, indexed by job

**130 findings · 4 cards · second audit wave (detail/standard views) · 2026-07-19**

The four card detail views were deep-audited after the list-view gathering, each walked from the
persona's real low-tier seat (achieved via `#local` + `setRole` on pinned production bytes), every
load-bearing claim adversarially verified. Findings keep their session ids (UNITS `UD-`/`N-`,
RENTALS `RD-`, CUSTOMERS `F-`, CATEGORIES `F-`/`N-`); full evidence + cites live in each
`contrib/<card>-detail/findings.json`.

**Every one of the 130 maps to exactly one of the 25 jobs — zero off-vocabulary, in a wave with no
contact with the taxonomy authors.** The controlled vocabulary held across an independent second
pass, which is the strongest available evidence it is the right backbone.

**Damage profile inverts from the list view.** The list wave was led by `spot-the-fire`; the detail
wave is led by **`trust-the-screen` (54)** — the detail is the dense, authoritative surface where
two systems' answers to one number render inches apart. Damage = 3R + 2O + 1Y.

| Job | n | R/O/Y | Damage |
|---|---|---|---|
| `trust-the-screen` | 25 | 7/15/3 | **54** |
| `whats-next-to-wrench` | 14 | 10/2/2 | **36** |
| `clean-records` | 11 | 3/6/2 | **23** |
| `no-surprises` | 9 | 4/4/1 | **21** |
| `spot-the-fire` | 9 | 3/6/0 | **21** |
| `keep-the-keys` | 8 | 1/6/1 | **16** |
| `got-one-free` | 8 | 0/6/2 | **14** |
| `no-fat-fingers` | 7 | 1/4/2 | **13** |
| `whats-making-money` | 6 | 2/2/2 | **12** |
| `get-our-money` | 5 | 2/3/0 | **12** |
| `quote-the-caller` | 4 | 1/3/0 | **9** |
| `get-to-it` | 4 | 0/2/2 | **6** |
| `line-up-the-runs` | 3 | 1/1/1 | **6** |
| `work-the-wrench-job` | 2 | 1/1/0 | **5** |
| `field-trouble` | 2 | 1/1/0 | **5** |
| `log-it-from-the-field` | 2 | 1/1/0 | **5** |
| `keep-my-place` | 3 | 0/1/2 | **4** |
| `works-in-gloves` | 3 | 0/1/2 | **4** |
| `reach-the-person` | 2 | 1/0/1 | **4** |
| `get-it-back` | 1 | 1/0/0 | **3** |
| `run-my-route` | 1 | 0/1/0 | **2** |
| `size-up-the-customer` | 1 | 0/0/1 | **1** |

Totals: 130 findings · 40R / 66O / 24Y · UNITS 74 · CATEGORIES 24 · RENTALS 16 · CUSTOMERS 16.

---

## `trust-the-screen` — "Trust what the screen says" (n=25, damage 54)

- **UNITS UD-007** [R] — The unit history's tab counters contradict the history content and the record's own header badge on one screen — '0 Inspections' renders dir
- **UNITS UD-023** [R] — UNITS detail (sibling of existing finding #57, new surface + new root): the unit detail page's ONLY coverage surface is the Investment secti
- **UNITS UD-027** [R] — Re-opening a passed inspection re-enters the same fully-live checklist with no result pill, no pass date, and no locked controls — its X and
- **UNITS UD-036** [R] — Sibling root to finding 56: the Services task row is the ONLY surface that still names a snoozed past-due service, and it is structurally un
- **UNITS UD-042** [R] — A unit with a physical tracker but no API mapping shows a green 'Reporting' chip and green GPS section border on the same header bar whose b
- **UNITS UD-056** [R] — The inspection/work-order half of a unit's history log is ordered by string-comparing a year-less "MMM DD" display value, so it sorts by mon
- **UNITS UD-063** [R] — Service completions are keyed by bare taskId, and taskIds are not unique across schedules — so an admin changing a unit's model silently tra
- **UNITS UD-008** [O] — The unit history log renders in non-chronological order on production data, interleaving months.
- **UNITS UD-010** [O] — An explicit 'don't wash' suppression on a unit does not suppress its wash task, which continues to accrue and render as past due.
- **UNITS UD-011** [O] — The Specs section stamps a green 'OK' chip beside the hour meter on a machine the same screen reports 526 hours past due, and renders its fi
- **UNITS UD-020** [O] — The Specs section stamps a hardcoded green "OK" chip and sec-green border with no data dependency — visually identical to the derived greens
- **UNITS UD-034** [O] — A cancelled work order is filtered out of the unit's Work Orders section but not out of its History, where it is labelled with its raw store
- **UNITS UD-040** [O] — The unit detail view's Services list renders manufacturer-sourced intervals and the module's self-declared pre-production placeholder interv
- **UNITS UD-048** [O] — The unit detail carries no rental history — historyFor('units') returns only inspections and work orders — yet it emits an "N Rentals" chip 
- **UNITS UD-057** [O] — All four history count-chips on the unit detail take their number from a DATA collection but filter a merged log built from a different sour
- **UNITS UD-066** [O] — LATENT: the model maintenance-schedule task form validates only the task name — a blank interval saves as null with no guard, then reads two
- **RENTALS RD-02** [O] — The history money counter classifies by regex over human prose, so it counts a non-payment and misses a real one
- **RENTALS RD-13** [O] — The history chip's count and the chip's own filter run over different populations — it reads 0 and reveals 1 when tapped
- **CUSTOMERS CUS-04** [O] — The customer-level 'view agreement' button reads legacy fields that the current card-level signing flow never writes, so a customer who sign
- **CUSTOMERS CUS-07** [O] — The detail header is a single nowrap flex row whose only overflow protection is on the title, so on narrower viewports and heavily-flagged c
- **CATEGORIES F-03** [O] — An empty category's record header renders a green 'All Passed' while the same record's mini-card renders a red 'None · N/A' — so opening the
- **CATEGORIES F-04** [O] — A category whose entire fleet has been sold also renders the green 'All Passed' header flag, because the inspection tally counts every unit 
- **UNITS UD-035** [Y] — UNITS — The confirm dialog gating "Complete WO" recomputes its own list with a looser filter than the check that opened it, so lines the mec
- **UNITS UD-046** [Y] — Once a tracker is mapped, the unit's GPS state forks into two never-reconciled reads: the mini-card flag corner and the detail chip go live-
- **UNITS UD-074** [Y] — The Services section is the one unit-detail block wired to a bespoke toggle handler with no section identifier, while every sibling section 

## `whats-next-to-wrench` — "Figure out which machine to wrench on next" (n=14, damage 36)

- **UNITS UD-002** [R] — The unit detail's Work Orders bar reads a green 'CLEAR / 0 open' on a machine the same screen simultaneously badges 'Failed', flags with an 
- **UNITS UD-003** [R] — The headline 'HRS OVERDUE' figure that drives the tile colour, the flag, the countdown sort and the mechanic's worklist order is manufacture
- **UNITS UD-016** [R] — The service baseline (`purchaseHours`) is seeded to 0 by all three create paths but is exposed ONLY inside the Investment section labeled "H
- **UNITS UD-032** [R] — An open 'Part in Stock' line is the greenest possible bottleneck a work order can have: WO_SEV ranks it more-blocking than 'No Part Needed' 
- **UNITS UD-037** [R] — The wash task's 100-HRS interval is 2.5x tighter than any real service, so on any used machine the never-logged wash always wins topServiceF
- **UNITS UD-044** [R] — On the UNITS detail view the GPS section defaults an untracked unit to the same red as a dead tracker — the gpsStatus registry has no 'untra
- **UNITS UD-053** [R] — The photo-backdrop feature is wired end to end but never invoked: woBackdrop's value is computed and discarded at app.js:8022, `bg` is the o
- **UNITS UD-061** [R] — Retagging a unit's category leaves its modelId pointing at the old category's model, and the Model picker then pre-selects '— No model —' wi
- **UNITS UD-065** [R] — On the unit detail view's Services section, a unit with no `modelId` (or a model with an empty task list) silently falls back to the generic
- **UNITS UD-073** [R] — A cosmetic wash task masks the machine's real safety overrun: on the worst unit in the seed the top service is a detailing job at 2882 hrs, 
- **UNITS UD-012** [O] — The machine carries a live telematics tracker reporting engine state, yet the hour meter driving all 24 service countdowns is a manual text 
- **UNITS UD-049** [O] — UNITS detail — the date-derived half of the unit History log (inspections + work orders) sorts on a month-NAME string, so it renders in reve
- **UNITS UD-015** [Y] — Only 6 of a unit's 24 service tasks render before a 'Show all 24 tasks' control.
- **UNITS UD-030** [Y] — Marking a passed unit "Not Ready" creates no inspection record, so the section flips yellow and stamps today's date while the only prose on 

## `clean-records` — "Get data in right, fix what got in wrong, don't lose anyone's work" (n=11, damage 23)

- **UNITS UD-052** [R] — Photo evidence on an inspection can be deleted with no history line, no confirm and no undo — the add path logs (app.js:20970, 20973), both 
- **UNITS UD-064** [R] — On the CATEGORIES detail view (not Units), the Models section and its schedule popup are the one unconditionally ungated write surface on th
- **UNITS UD-069** [R] — The app self-destructs abandoned empty drafts — for invoices and rentals only. Work orders are created carrying the same mock:true draft fla
- **UNITS UD-028** [O] — Tapping Pass on an already-Passed unit that has no inspection record writes and syncs a brand-new inspection dated today — flipping the unit
- **UNITS UD-029** [O] — Rental Wrangler ships ~350 lines of real per-family inspection checklists (INSP_DEFAULTS, app.js:3489-3838) that are wired to exactly one th
- **UNITS UD-071** [O] — Passing a unit requires no checklist at all — the shipped per-family inspection checklists resolve to nothing for every category, so one tap
- **CATEGORIES F-09** [O] — The three fields that produce this record's most misleading output — description, fuelType and name — have no editor anywhere on the record 
- **CATEGORIES F-08** [O] — Creating or duplicating a model writes its audit entry onto the model record, whose history has no viewer anywhere in the application — the 
- **CATEGORIES F-21** [O] — The category record's History can only ever show what somebody typed on this screen — the shared history engine has no categories branch, so
- **RENTALS RD-09** [Y] — Opening a rental's detail view writes to the record
- **CATEGORIES F-13** [Y] — History names a rate field by its raw camelCase identifier, giving one field three different names inside one record.

## `no-surprises` — "Controls do what they look like they do" (n=9, damage 21)

- **UNITS UD-005** [R] — A unit out on rent to a real customer displays 'UNINSURED', and coverage is a bare two-button toggle with no confirmation sitting in the sam
- **UNITS UD-031** [R] — "Cancel WO" is an unconfirmed R18 ghost pill — the app's own "quiet action / Cancel / Close" style (app.js:6510) — sitting between +Invoice 
- **UNITS UD-043** [R] — The GPS section's own comment says "an untracked unit reads red — no visibility is the worst tracking state" (app.js:8565), but the stored-f
- **RENTALS RD-04** [R] — Returned is terminal but is the only terminal status with no visual distinction from the reversible rows beside it
- **UNITS UD-038** [O] — Snooze is sold in calendar days but the alarm it mutes is measured in engine hours, with no cap on re-snoozing — and on the Units list tile 
- **UNITS UD-058** [O] — The unit history's blue "N Rentals" chip structurally cannot be fulfilled: its count comes from DATA.rentals while its filter (/rent/i) runs
- **UNITS UD-072** [O] — Snooze is offered in calendar days (7 / 14 / 30) and stored as a calendar date, while the alarm it silences is measured in engine hours — a 
- **CATEGORIES F-06** [O] — Three controls in one record follow three different gate/confirm/log policies, and the only one that touches money is the only one that says
- **CUSTOMERS CUS-06** [Y] — The button labelled 'Pay Cancellation $X' also re-enrols the member and marks them prepaid through the full commitment term. The label names

## `spot-the-fire` — "Spot what's on fire without reading every row" (n=9, damage 21)

- **UNITS UD-006** [R] — The unit tile and the unit detail header state contradictory part status for the same machine at the same moment — the tile's reassuring 'NO
- **UNITS UD-068** [R] — The UNITS card prints 'FIELD CALL' on a unit's tile purely because its inspection is Failed while on a rental — the rental record itself car
- **RENTALS RD-01** [R] — The status gate's word and its colour come from two different systems, so the healthiest label in the app ships in the alarm colour
- **UNITS UD-009** [O] — The service task list is not ordered by urgency, and the collapsed section header names a task that is neither the first row nor the worst.
- **UNITS UD-033** [O] — Inside the unit's Work Orders section, collapsed rows carry no work-order TYPE — with several WOs open, a Field Call, a failed-inspection jo
- **UNITS UD-039** [O] — On a unit with a real per-model schedule (19 tasks for MOD002 'Yanmar ViO35'), the Services list shows only 6 rows and one of those six is p
- **UNITS UD-045** [O] — Related to finding 58 (sibling, opposite direction): the unit detail's GPS section hard-defaults to RED for any unit with no GPS mapping and
- **RENTALS RD-14** [O] — A quote with nothing billed and nothing owed renders its balance in the alarm red
- **RENTALS RD-15** [O] — A mixed-status rental is the only kind whose colour is discarded — the state that most needs attention renders neutral gray

## `keep-the-keys` — "Keep money numbers & admin switches with the right people" (n=8, damage 16)

- **UNITS UD-067** [R] — The money tier is computed correctly and then never consulted by the unit's Investment block — a mechanic (canMoney()===false) reads the mac
- **UNITS UD-022** [O] — Inside the unit's Investment section, four derived dollar figures — Total Revenue, Monthly, Work Orders and Profit — render with no tier che
- **CUSTOMERS CUS-05** [O] — The `!currentRole ||` fail-open is applied inconsistently across six privilege gates, so a signed-in person whose role string is empty recei
- **CUSTOMERS CUS-12** [O] — Only ADDING a payment method is money-gated: the sign, make-default and remove handlers carry no privilege check at all. The removal is curr
- **CUSTOMERS CUS-13** [O] — Money VISIBILITY on the customer detail is not tier-gated at all — only money CONTROLS are. Every dollar figure on the record renders identi
- **CATEGORIES N-02** [O] — canMoney() is the one privilege gate in the app that fails OPEN on a blank role, and a genuinely signed-in user can reach that blank state t
- **CATEGORIES N-03** [O] — The category detail carries a SECOND blank-role fail-open, and this one writes: for a role-less session both the visibility guard and the cl
- **RENTALS RD-07** [Y] — The per-unit status gate and the date-split control exist only on multi-unit rentals, so the habit formed on one rental does not transfer to

## `got-one-free` — "Find out if we've actually got one to rent" (n=8, damage 14)

- **RENTALS RD-10** [O] — The empty-unit slot instructs a drag gesture and names a control that was retired
- **CATEGORIES F-18** [O] — The record you open to get more detail is a strictly worse answer than the card you opened it from: the mini-card's next-available date and 
- **CATEGORIES F-20** [O] — Green means opposite things in the two bars stacked on top of each other: in the upper bar green is 'passed inspection', and in the lower ba
- **CATEGORIES F-17** [O] — The app's own canonical 'is this rentable' predicate counts a machine that has never passed inspection as available — it excludes only Faile
- **CATEGORIES F-10** [O] — A Sold, For Sale or Inactive machine appears in the category detail's unit list wearing a green 'Passed' inspection pill — mislabelled rathe
- **CATEGORIES F-16** [O] — The record opens with two unlabelled full-width bars stacked on top of each other that measure different taxonomies, so on a one-machine cat
- **UNITS UD-014** [Y] — Unit search matches on a field that is never rendered, returning rows with no visible reason for the match.
- **CATEGORIES F-15** [Y] — Category search matches against description and notes — fields that exist only in the detail and never render on the grid — so a search retu

## `no-fat-fingers` — "One stray tap can't wreck a charge, a record, or a job" (n=7, damage 13)

- **UNITS UD-001** [R] — A single click in the Work Orders accordion created and persisted a real work order on a live unit — no confirmation, no draft state, no und
- **UNITS UD-019** [O] — The sole field that writes the hour meter silently discards the entry whenever the number widget can't parse it — including the comma-groupe
- **UNITS UD-055** [O] — On a checklist evidence photo the remove button is clipped by its own parent's `overflow: hidden` to a ~12×12 unlabeled red corner wedge — a
- **UNITS UD-070** [O] — Every list row carries an unlabeled eye icon whose click is not a per-row action at all — it toggles hover previews OFF for the entire app, 
- **CATEGORIES F-11** [O] — +Lost is a one-tap, ungated, unconfirmed write that stamps a hardcoded narrative sentence into permanent history — a sentence that can be, a
- **UNITS UD-013** [Y] — Two numbers carrying the same 'HRS' unit and within 2% of each other, meaning entirely different things, appear on the same record across ti
- **CUSTOMERS CUS-08** [Y] — Two saved payment methods can be visually identical — same brand, last four and expiry — separated only by status words, and the destructive

## `whats-making-money` — "See what's making us money and what's bleeding us" (n=6, damage 12)

- **UNITS UD-004** [R] — The unit's Investment block prints a confident 'Profit' figure identical to gross revenue whenever the cost fields are empty — no empty stat
- **UNITS UD-060** [R] — For an Admin/Owner only, retagging a unit's category instantly repaints the machine's entire lifetime Total Revenue, Monthly and Profit with
- **UNITS UD-050** [O] — SIBLING/ROOT of existing finding #77 — the revenue guard that is missing is per-UNIT-ENTRY (`unitVoided`), not per-rental, so #77's implied 
- **CATEGORIES N-01** [O] — The money gate on the category record covers two of its six money figures: ROI and bottom dollar are hidden below money tier, while MSRP, as
- **UNITS UD-051** [Y] — On a unit with rental revenue but no purchase date, the Investment block prints 'Monthly $0' on the line directly beneath a non-zero 'Total 
- **CATEGORIES F-07** [Y] — Two of the Investment block's per-unit dollar figures are divide-by-zero artifacts printed as confident measurements beside the literal word

## `get-our-money` — "Get our money — billed, chased, collected" (n=5, damage 12)

- **UNITS UD-026** [R] — The bill-to-customer question is a label, not a gate — but the auto-created inspection record is the only one of six creators that seeds bil
- **CUSTOMERS CUS-15** [R] — A customer can be charged the membership cancellation fee through the ordinary Invoices route, but the code that reactivates the membership 
- **UNITS UD-062** [O] — Retagging a unit's category re-prices what the rental screen *displays* but never re-prices the invoice line, so the rental detail contradic
- **CUSTOMERS CUS-01** [O] — The customer detail's Open KPI counts a REFUNDED invoice as money owed, so the detail view reports a larger balance than the list row for th
- **CUSTOMERS CUS-02** [O] — In the Transactions view a refund recorded inside inv.payments[] is counted as a payment — inflating 'Collected' and the payment count, and 

## `quote-the-caller` — "Work out what to charge this caller" (n=4, damage 9)

- **CATEGORIES F-02** [R] — The only warning in production that a category has no prices is a sentence a human typed into the free-text `description` field; the app's o
- **CATEGORIES F-19** [O] — The Pricing block leads with the member discount rate and renders all five rate fields at identical visual weight, so the first number a rat
- **CATEGORIES F-01** [O] — The first chip in a category record's header is the raw fuelType string, which for every non-powered attachment is literally the word 'None'
- **CATEGORIES F-12** [O] — The toast that greets a newly created category names a rate tier the app does not have and omits two it does — including the one field most 

## `get-to-it` — "Get to the thing — record, list, button, door" (n=4, damage 6)

- **RENTALS RD-06** [O] — When a rental's units diverge, the master gate silently becomes inert and the only explanation is a hover tooltip
- **CUSTOMERS CUS-16** [O] — The agreements window is unreachable from the running app: its only entry point is a function that is never called, so the signed-agreement 
- **UNITS UD-021** [Y] — Tapping the Model row in Specs raises an Admin-approval overlay reading "Categories and pricing are Admin-only. needs Admin approval." — Mod
- **RENTALS RD-11** [Y] — The month calendar is the largest thing in the record, taking 58% of the rental section, above the units and the route

## `line-up-the-runs` — "Line up today's hauls" (n=3, damage 6)

- **RENTALS RD-03** [R] — The driver is stored on the rental's own unit entry and never displayed anywhere in the rental's detail view
- **RENTALS RD-08** [O] — On a multi-unit delivery, only the primary unit inherits the rental's address; the others render an empty +Address
- **RENTALS RD-16** [Y] — The route rail renders identically for every role but refuses to work below the money tier, and the refusal is a toast fired after the tap

## `work-the-wrench-job` — "Work a repair through — parts, progress, proof" (n=2, damage 5)

- **UNITS UD-017** [R] — The Specs Model row is the only control that links a unit to its real manufacturer service schedule — and it is admin-gated, so the mechanic
- **CATEGORIES F-05** [O] — Full create, edit and delete of the maintenance schedule that decides when machines get serviced is completely ungated, while changing a rat

## `field-trouble` — "Handle trouble in the field" (n=2, damage 5)

- **UNITS UD-024** [R] — Failing a unit that's on rent red-flags the customer's live rental (r.fieldCall), and nothing on the unit record ever clears that flag — the
- **UNITS UD-047** [O] — On the four units that carry GPS hardware, the GPS section prints the tracker brand 'GPSWOX' as a bare unlabeled string on the line immediat

## `log-it-from-the-field` — "Log the job from the field and have it stick" (n=2, damage 5)

- **UNITS UD-025** [R] — Failing an on-rent unit skips the forced §12.8 photo/notes capture that the identical tap on a yard unit fires three lines away — the field-
- **UNITS UD-054** [O] — Every unit's detail header carries a functionless flag labelled 'QR' — styled cursor:pointer with a hover underline but wired to nothing — w

## `keep-my-place` — "Keep my place — scroll, filters, view" (n=3, damage 4)

- **UNITS UD-059** [O] — UNITS — A history-log search query survives onto the NEXT unit opened in the same tab (after backing out to the list; a direct standard→stan
- **CUSTOMERS CUS-11** [Y] — The record's height scales with how much the customer has done, so the customers most worth reading are the ones whose Invoices, Payment Met
- **CATEGORIES F-14** [Y] — Models, Investment, the unit list and the entire History log are the last four blocks of a record roughly 2.4× taller than the viewport, so 

## `works-in-gloves` — "Works in the hands that hold it" (n=3, damage 4)

- **CUSTOMERS CUS-14** [O] — The remove control on every saved card and bank row renders zero pixels wide, so a saved payment method cannot be removed by mouse — while i
- **RENTALS RD-05** [Y] — Every gate-timeline row is 40px tall, below the 44px minimum touch target
- **RENTALS RD-12** [Y] — Three of 54 interactive controls in the rental detail carry an accessible name

## `reach-the-person` — "Call, text, or message the person this is about" (n=2, damage 4)

- **CUSTOMERS CUS-03** [R] — A fully-built Comms section for the customer record exists, is named in the render order by the section's own current spec comment, and is n
- **CUSTOMERS CUS-10** [Y] — The customer detail view offers no way to contact the customer — zero tel: links, zero mailto:, no text/email/send control — on a record tha

## `get-it-back` — "Get the machine back when it’s due" (n=1, damage 3)

- **UNITS UD-041** [R] — On the three seeded units that carry a stored gpsStatus but no device mapping, the GPS section stamps a green "Reporting"/"Verify" chip and 

## `run-my-route` — "Run my route" (n=1, damage 2)

- **UNITS UD-018** [O] — Units' Specs `weight` is the only field the Wrangler writer declares numeric (WR_NUMERIC, app.js:15594) whose human editor declares it text 

## `size-up-the-customer` — "Size up this customer before I hand them iron" (n=1, damage 1)

- **CUSTOMERS CUS-09** [Y] — Customers with the same name are indistinguishable on the row: the record id is never rendered as row text, and a customer with no phone on 

