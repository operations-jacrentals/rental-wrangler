# All 171 findings, re-indexed by job

The controlled vocabulary is defined in `JOB-TAXONOMY.md`. Findings keep their numbers from
`ALL-FINDINGS.md` (1–64 red, 65–134 orange, 135–171 yellow). One job per finding; forced
calls are listed at the bottom of the taxonomy. Ordered by job damage rank.

## 1 · `spot-the-fire` — "Spot what's on fire without reading every row" (n=14, damage 29)

- **#31 [R] Customers** — red is the default: 44 of 60 rows red, and no row ever says why
- **#32 [R] Customers** — three alert-pulse mechanisms inverted or hardcoded backwards
- **#41 [R] Customers** — staff type balances/do-not-rent into the NAME field, punctuation-gamed to sort on top
- **#58 [R] Units** — the one pre-card alert indicator watches 3 of 10 registered flags
- **#78 [O] Categories** — eight unavailability reasons, one identical red pill, no legend
- **#81 [O] Categories** — the column-tab alert glow is hardcoded to fire for Units only
- **#91 [O] Customers** — one red tint for a dormant account and an active safety risk
- **#102 [O] RENTALS** — no 'Needs Attention' bucket; headers and counts never reflect severity
- **#103 [O] RENTALS** — seven red conditions collapse to one uniform border; 2 of 7 unidentifiable without hover
- **#122 [O] Units** — collapsed group headers show no flagged sub-count; collapse persists forever
- **#123 [O] Units** — yellow 'Not Ready' ordered above red 'Needs Attention'
- **#152 [Y] Categories** — the open-record tab badge is a navy fuel chip, not a status colour
- **#161 [Y] Customers** — group headers carry no aggregate danger signal
- **#164 [Y] Customers** — the service-worker update toast sits on top of the alert-chip row all session

## 2 · `get-told` — "Hear about it when something needs me" (n=12, damage 24)

- **#7 [R] Calendar/Driver** — a successful driver assignment writes only a hidden audit line; the driver is never told
- **#20 [R] Categories** — a rate edit fires zero toast or ping to anyone, including its own author
- **#40 [R] Customers** — reminder/ETA settings toggles save state; the engines behind them are inert
- **#67 [O] Calendar/Driver** — sw.js has no push listener; nothing reaches a driver who isn't staring at the screen
- **#82 [O] Categories** — categories have zero entries in the flag registry; no category condition can escalate
- **#100 [O] Customers** — the bell holds engineering tickets in raw markdown; nothing customer-facing
- **#108 [O] RENTALS** — no OS-level alerting: background the app, zero alerts reach the dispatcher
- **#112 [O] Units** — the bell shows dispatch and billing items; nothing a mechanic needs, none role-filtered
- **#129 [O] Units** — all ten unit flag predicates fire silently into data; toasts self-clear in 2.2s
- **#144 [Y] Calendar/Driver** — the 'Driver Assigned' SMS toggle exists in Settings, defaulted off, commented inert
- **#157 [Y] Categories** — no push/notification channel exists anywhere in the frontend
- **#170 [Y] Units** — notification text renders markdown asterisks raw to every user

## 3 · `keep-my-place` — "Keep my place — my scroll, my filters, my view" (n=10, damage 24)

- **#6 [R] Calendar/Driver** — scroll memory reads the wrong scroller on Trips; any render resets to 0
- **#11 [R] Calendar/Driver** — one town tap force-opens the collapsed map and persists it to localStorage
- **#24 [R] Categories** — filters from different categories persist and silently intersect
- **#25 [R] Categories** — the filter chip's circle icon negates the filter while reading as 'clear'
- **#66 [O] Calendar/Driver** — the 18-second poll snaps the driver's scroll to top with no user action
- **#79 [O] Categories** — sorting by ROI/Unit-Count/Avg-Hours reshuffles the grid with none of the three rendered
- **#80 [O] Categories** — every reload lands the left column on Units; rate work restarts from scratch
- **#95 [O] Customers** — clicking another customer's invoice silently spawns a new session tab, swapping all three columns
- **#97 [O] Customers** — the Sales tab is a 'Coming soon' placard, and returning re-buries the scroll position
- **#107 [O] RENTALS** — scroll restore is positional, so acting on a re-sorted list lands on a different rental

## 4 · `get-to-it` — "Get to the thing — record, list, button, door" (n=12, damage 24)

- **#8 [R] Calendar/Driver** — Show More is a guaranteed no-op on the card-stateless Calendar; rows past 60 unreachable
- **#38 [R] Customers** — 'Show more' re-renders the whole list each press, slower every time; ~11 presses to reach the end
- **#60 [R] Units** — scanning a unit's QR decal hijacks the app into a capture takeover with no way back
- **#68 [O] Calendar/Driver** — trip search is one blob.includes; 'lake pick' returns zero rows
- **#70 [O] Calendar/Driver** — customer pill navigates away, unit pill doesn't — same look, opposite cost
- **#84 [O] Categories** — creating a category is only discoverable via a zero-result search
- **#87 [O] Categories** — two lookalike pills an inch apart: one pushes Back history, the other erases it
- **#118 [O] Units** — WO/inspection links land at the generic top of the unit page, never at the record clicked
- **#128 [O] Units** — anchoring a non-primary unit of a multi-unit rental cascades to an empty column
- **#149 [Y] Categories** — the Categories tab renders truncated to 'CATEG…' whenever inactive
- **#155 [Y] Categories** — unit→category is an admin-gated select where sibling cards render a plain link
- **#162 [Y] Customers** — a dead invoice link returns silently, indistinguishable from a frozen app

## 5 · `trust-the-screen` — "Trust what the screen says" (n=10, damage 20)

- **#10 [R] Calendar/Driver** — the map's day-state never resets; future-day pins under a 'TODAY' header
- **#14 [R] Calendar/Driver** — the sync footer defaults to 'Offline — cached' and never re-checks after first success
- **#72 [O] Calendar/Driver** — the KPI labelled 'On-Time' is a completion rate; punctuality never enters the formula
- **#83 [O] Categories** — the poll patches data in place with no changed-marker, and skips whenever an overlay is open
- **#96 [O] Customers** — a failed invoice-open still glow-flashes whatever customer is on screen
- **#119 [O] Units** — unit history sorts on a per-load counter; entries render as a shuffled deck
- **#120 [O] Units** — the Worklist graph says 'NOT READY 28'; the list 40px below says 'NOT READY · 8'
- **#126 [O] Units** — the WO bar counts work orders but the click filters units; the numbers can't match
- **#138 [Y] Calendar/Driver** — three of four stops logged still counts zero 'done' at the group header
- **#143 [Y] Calendar/Driver** — a zero-trip day renders a full-height map over a grey-on-grey empty plate

## 6 · `clean-records` — "Get data in right, fix what got in wrong, don't lose anyone's work" (n=8, damage 19)

- **#23 [R] Categories** — categories can never be deleted/merged; the retag workaround silently re-prices live rentals
- **#62 [R] Units** — the hour-meter field has zero validation; a 10× typo stood 26 days feeding every downstream number
- **#63 [R] Units** — last-write-wins whole-record sync silently destroys one tech's work
- **#73 [O] Calendar/Driver** — non-colon times parse to null with no error, silently inheriting the hidden 5PM cutoff
- **#85 [O] Categories** — a newborn category renders identical to a dead one (full red 'None · N/A')
- **#86 [O] Categories** — models are append-only with two creation paths and no dedupe
- **#94 [O] Customers** — five customer-creation paths, zero duplicate check on phone/email/name
- **#132 [O] Units** — a blank 'hours at completion' records as 0, corrupting the next countdown's baseline

## 7 · `get-it-back` — "Get the machine back when it's due — and take it in right" (n=6, damage 17)

- **#4 [R] Calendar/Driver** — the Trips badge excludes past-day undone stops; two were 78 days old
- **#5 [R] Calendar/Driver** — the only home for undone past work is the sole default-collapsed, hardcoded-gray bucket
- **#47 [R] RENTALS** — 'Log Recovery' stamps {date, video, driver}; no condition, no inspection, no damage line
- **#48 [R] RENTALS** — an overdue return is invisible to every count, badge and toast; it only tints its own row
- **#61 [R] Units** — the hour meter is never captured at return; the service countdown doesn't move
- **#110 [O] RENTALS** — recoveries get no bucket or signal until the day AFTER they're late

## 8 · `whats-next-to-wrench` — "Figure out which machine to wrench on next" (n=6, damage 16)

- **#52 [R] Units** — the mechanic's correct landing (graph + service-due sort) dies on the first record opened
- **#54 [R] Units** — grouping beats the Service-Due sort; a 1,139-hr-overdue machine sits ninth, under green
- **#55 [R] Units** — the worst machine in the yard displays as 'No GPS +1'; the service number is tooltip-only
- **#56 [R] Units** — a pending wash masks genuinely overdue service across five surfaces
- **#111 [O] Units** — service-flag text truncates at exactly the word that distinguishes overdue from remaining
- **#125 [O] Units** — no fleet-wide open-jobs view exists; the ex-Shop quick filters are fully built and unreachable

## 9 · `work-the-wrench-job` — "Work a repair through — parts, progress, proof" (n=7, damage 15)

- **#59 [R] Units** — every WO phase pill is frozen at creation; the advancing code lived on the retired Shop card
- **#113 [O] Units** — the part-ETA flag can never fire; its input field has no writer anywhere
- **#117 [O] Units** — a failed inspection's photo/video report has no door from the unit's own record
- **#124 [O] Units** — 'N on hand' part quantities are decorative; nothing ever decrements them
- **#131 [O] Units** — 'Part Needed' / 'Part Ordered' / 'Part Needed?' near-identical, colours varying tile to tile
- **#133 [O] Units** — completing one blocking WO reports plain success while a second keeps the unit red
- **#134 [O] Units** — a tile shows only the newest open WO; an older, worse one is masked entirely

## 10 · `reach-the-person` — "Call, text, or message the person this is about" (n=7, damage 15)

- **#26 [R] Customers** — no call, text, charge or follow-up control exists anywhere on row or detail
- **#39 [R] Customers** — no tap-to-call at all; text/email hides behind an undiscoverable right-click
- **#98 [O] Customers** — the per-customer comms thread panel is fully built with zero call sites
- **#99 [O] Customers** — the poll never refreshes comms; a dead comms backend looks like a quiet day
- **#104 [O] RENTALS** — customer replies never auto-refresh; a reply sits unseen until a manual click
- **#109 [O] RENTALS** — texting the driver or customer about THIS rental is a 2–3 screen detour
- **#142 [Y] Calendar/Driver** — phone labels render as-typed; only the href is normalized, app-wide

## 11 · `quote-the-caller` — "Work out what to charge this caller" (n=9, damage 14)

- **#16 [R] Categories** — the member day-rate is never on the mini-card face; a rep overquotes a member 267%
- **#18 [R] Categories** — an unpriced category still shows a bright green availability pill
- **#101 [O] Customers** — header says 'Member', the AR block on the same screen says 'NON MEMBER MODE'
- **#145 [Y] Categories** — four flat tiles, no way to derive a 10-day price; 59% mental-math overquote
- **#146 [Y] Categories** — a 0 rate renders '—' on the card and '$0' in the detail
- **#148 [Y] Categories** — a 0/0/0 inspection tally is the loudest row on the rate card
- **#154 [Y] Categories** — the weekend-rate qualifying window is enforced in code and stated nowhere
- **#158 [Y] Categories** — Mr. Wrangler computes the correct blended price — behind a right-click only
- **#159 [Y] Categories** — hover icons render directly on top of the 1-Day rate value

## 12 · `size-up-the-customer` — "Size up this customer before I hand them iron" (n=5, damage 14)

- **#27 [R] Customers** — live owed-$ and frozen payStatus give two contradictory answers inches apart
- **#28 [R] Customers** — 2,260 of 2,265 customers sit in an unnamed grey leftover bucket
- **#33 [R] Customers** — the detail popup clamps 'Don't Contact' to a calm blue 'Lead'
- **#37 [R] Customers** — spend chart vs paid stat: 17× apart, no label saying which to trust
- **#90 [O] Customers** — the stage pill never consults the Rental funnel; a live renter shows N/A

## 13 · `log-it-from-the-field` — "Log the job from the field and have it stick" (n=5, damage 14)

- **#12 [R] Calendar/Driver** — a failed video upload still stamps the row green 'Logged'
- **#13 [R] Calendar/Driver** — the log-gate runs on tap, not render; a blocked stop shows no lock until he's driven there
- **#15 [R] Calendar/Driver** — a failed-sync capture is held only in RAM behind a 'Don't close the app' banner
- **#46 [R] RENTALS** — a gate-blocked field delivery silently discards the whole capture, video included
- **#74 [O] Calendar/Driver** — on a merged trip, 'Log Delivery' points at a stop already logged

## 14 · `run-my-route` — "Run my route — where to, when, how to get there" (n=5, damage 13)

- **#1 [R] Calendar/Driver** — the map occupies 78% of everything the driver can see before the first trip row
- **#2 [R] Calendar/Driver** — pickup legs are hardcoded time:''; a pickup can never carry a time
- **#9 [R] Calendar/Driver** — the row prints a town; the full address exists only in a hover tooltip
- **#65 [O] Calendar/Driver** — a blank time box silently means a hard 5:00 PM cutoff, printed nowhere
- **#69 [O] Calendar/Driver** — 'Open in Google Maps' only exists nested inside the focused map panel

## 15 · `keep-the-keys` — "Keep money numbers and admin switches with the right people" (n=6, damage 13)

- **#21 [R] Categories** — creating a rentable class is ungated while pricing it is admin-gated — inverted authority
- **#22 [R] Categories** — ROI is money-gated in the detail and ungated as a list column and sort key
- **#93 [O] Customers** — History masks $ for low roles while four sibling surfaces print live money
- **#121 [O] Units** — the mechanic landing is keyed to a hardcoded role name a rename silently kills
- **#127 [O] Units** — the Round-Up Money section renders to every signed-in role
- **#156 [Y] Categories** — audit redaction blanks the whole line; even the fact a price changed is lost

## 16 · `no-fat-fingers` — "One stray tap can't wreck a charge, a record, or a job" (n=5, damage 13)

- **#34 [R] Customers** — removing a saved card: zero gate, zero confirm, live Stripe detach
- **#35 [R] Customers** — 'Pay Cancellation' charges the saved card instantly, skipping the shared review overlay
- **#49 [R] Units** — the hover preview is the full live detail: 13 hot controls placed under the travelling cursor
- **#92 [O] Customers** — 'Cancel Membership' ends billing and invoices the remaining term on the first click
- **#106 [O] RENTALS** — terminal status jumps commit on one click, no confirm, no undo, row vanishes

## 17 · `get-our-money` — "Get our money — billed, chased, collected" (n=4, damage 12)

- **#29 [R] Customers** — the 'Pay Status' and 'Last Invoice' sorts are dead no-ops shown as selected
- **#30 [R] Customers** — the money pill wins the truncation; the more owed, the less phone number
- **#36 [R] Customers** — collections and void are built end-to-end; their buttons render only on the retired Invoices card
- **#43 [R] RENTALS** — a Reserved rental can jump straight to 'Returned', closing out unbilled

## 18 · `hook-it-to-the-rental` — "Put a machine on the rental — only one fit to go" (n=4, damage 11)

- **#50 [R] Units** — attach has exactly one path: drag; the +Unit button toasts an instruction to drag
- **#51 [R] Units** — the attach filter checks fleetStatus only; a failed, 2,882-hr-overdue machine attaches silently
- **#57 [R] Units** — the two red insurance flags never render a pill on the card face
- **#105 [O] RENTALS** — on a phone, linking is an unsignposted 500ms long-press; the hint copy said 'drag'

## 19 · `no-surprises` — "Controls do what they look like they do — same everywhere" (n=9, damage 11)

- **#116 [O] Units** — two population filters sit under a menu header reading SORT
- **#130 [O] Units** — clicking a unit's name doesn't open it; it reveals two unlabeled icons, one of them the trap
- **#135 [Y] Calendar/Driver** — Escape closes every overlay on the card except dropdown menus
- **#136 [Y] Calendar/Driver** — Trips' listbar is empty: no sort, no search, no stats toggle
- **#141 [Y] Calendar/Driver** — the same glyph means 'graph view' on every card and 'hide the map' here
- **#151 [Y] Categories** — Escape doesn't close the context or sort menus
- **#163 [Y] Customers** — the global search-scope globe silently changes other cards' search too
- **#166 [Y] RENTALS** — advancing status from the list row works on Rentals and nowhere else
- **#171 [Y] Units** — no feedback while the 220ms double-click discriminator resolves; a second tap forks a tab

## 20 · `field-trouble` — "Handle trouble in the field" (n=4, damage 10)

- **#42 [R] RENTALS** — a Field Call on a non-primary unit dispatches the repair to the wrong machine
- **#53 [R] Units** — a machine that breaks mid-rental never lands in 'Needs Attention'
- **#71 [O] Calendar/Driver** — the driver row's overflow menu holds one item: 'Merge trip…'
- **#75 [O] Calendar/Driver** — no standing dispatch channel; a new chat starts with zero members

## 21 · `got-one-free` — "Find out if we've actually got one to rent" (n=4, damage 9)

- **#17 [R] Categories** — mini-card and detail availability disagree on the same screen at the same second
- **#19 [R] Categories** — a fully sold category still displays quotable rack rates
- **#89 [O] Categories** — the Off-Fleet stock segment clicks through to an empty list
- **#147 [Y] Categories** — 'next available' silently switches date convention at the 7-day mark

## 22 · `works-in-gloves` — "Works in my hands — touch, gloves, small screen, no hover, no eyes" (n=6, damage 9)

- **#88 [O] Categories** — controls expose as bare 'button'; filter chips invisible to a screen reader
- **#114 [O] Units** — 58 of 86 controls have no visible name; 52 are tooltip-only; zero aria-labels
- **#115 [O] Units** — the Tools menu clips 6 of 10 items at tablet height — including the hover-off switch
- **#137 [Y] Calendar/Driver** — the back control is an unlabeled bare chevron
- **#140 [Y] Calendar/Driver** — an inactive tab truncates to a single character 'T'
- **#169 [Y] RENTALS** — the anchor-clear controls work but are hover-revealed and unlabeled

## 23 · `line-up-the-runs` — "Line up today's hauls — who's driving what where" (n=4, damage 8)

- **#44 [R] RENTALS** — the lane rail and one-tap 'Round up' auto-balance exist in code; nothing renders their buttons
- **#45 [R] RENTALS** — one driver, two towns, same 9 AM — silently allowed; machines flag, people don't
- **#139 [Y] Calendar/Driver** — driverRoster falls back to every employee when the role filter comes back empty
- **#167 [Y] RENTALS** — day-one dead end: the +Driver chip is suppressed and the hint lives behind it

## 24 · `whats-mine-today` — "Know what's mine to do today — and my next move" (n=4, damage 8)

- **#3 [R] Calendar/Driver** — 'the driver's day' renders every driver's trips plus the whole unassigned pool
- **#64 [R] Units** — assignedMechanic exists in 17 places and routes, filters or badges nothing
- **#165 [Y] RENTALS** — the next move is a status noun on a 22px pill; no verb, no CTA
- **#168 [Y] RENTALS** — no daily digest; a dispatcher assembles the day by scanning cards

## 25 · `whats-making-money` — "See what's making us money and what's bleeding us" (n=5, damage 7)

- **#76 [O] Categories** — the Time-Util denominator counts sold and inactive fleet
- **#77 [O] Categories** — revenue and ROI count cancelled and no-show rentals as collected money
- **#150 [Y] Categories** — '+Lost' demand logs locally and toasts the tapper; the rollup board was never built
- **#153 [Y] Categories** — a zero-unit category prints '0 HRS' and '$0' as if measured
- **#160 [Y] Categories** — the $ UTIL tab is an empty state in production; trueCost is unset

---

## Flat index (finding → job)

| # | job | # | job | # | job |
|---|---|---|---|---|---|
| 1 | run-my-route | 58 | spot-the-fire | 115 | works-in-gloves |
| 2 | run-my-route | 59 | work-the-wrench-job | 116 | no-surprises |
| 3 | whats-mine-today | 60 | get-to-it | 117 | work-the-wrench-job |
| 4 | get-it-back | 61 | get-it-back | 118 | get-to-it |
| 5 | get-it-back | 62 | clean-records | 119 | trust-the-screen |
| 6 | keep-my-place | 63 | clean-records | 120 | trust-the-screen |
| 7 | get-told | 64 | whats-mine-today | 121 | keep-the-keys |
| 8 | get-to-it | 65 | run-my-route | 122 | spot-the-fire |
| 9 | run-my-route | 66 | keep-my-place | 123 | spot-the-fire |
| 10 | trust-the-screen | 67 | get-told | 124 | work-the-wrench-job |
| 11 | keep-my-place | 68 | get-to-it | 125 | whats-next-to-wrench |
| 12 | log-it-from-the-field | 69 | run-my-route | 126 | trust-the-screen |
| 13 | log-it-from-the-field | 70 | get-to-it | 127 | keep-the-keys |
| 14 | trust-the-screen | 71 | field-trouble | 128 | get-to-it |
| 15 | log-it-from-the-field | 72 | trust-the-screen | 129 | get-told |
| 16 | quote-the-caller | 73 | clean-records | 130 | no-surprises |
| 17 | got-one-free | 74 | log-it-from-the-field | 131 | work-the-wrench-job |
| 18 | quote-the-caller | 75 | field-trouble | 132 | clean-records |
| 19 | got-one-free | 76 | whats-making-money | 133 | work-the-wrench-job |
| 20 | get-told | 77 | whats-making-money | 134 | work-the-wrench-job |
| 21 | keep-the-keys | 78 | spot-the-fire | 135 | no-surprises |
| 22 | keep-the-keys | 79 | keep-my-place | 136 | no-surprises |
| 23 | clean-records | 80 | keep-my-place | 137 | works-in-gloves |
| 24 | keep-my-place | 81 | spot-the-fire | 138 | trust-the-screen |
| 25 | keep-my-place | 82 | get-told | 139 | line-up-the-runs |
| 26 | reach-the-person | 83 | trust-the-screen | 140 | works-in-gloves |
| 27 | size-up-the-customer | 84 | get-to-it | 141 | no-surprises |
| 28 | size-up-the-customer | 85 | clean-records | 142 | reach-the-person |
| 29 | get-our-money | 86 | clean-records | 143 | trust-the-screen |
| 30 | get-our-money | 87 | get-to-it | 144 | get-told |
| 31 | spot-the-fire | 88 | works-in-gloves | 145 | quote-the-caller |
| 32 | spot-the-fire | 89 | got-one-free | 146 | quote-the-caller |
| 33 | size-up-the-customer | 90 | size-up-the-customer | 147 | got-one-free |
| 34 | no-fat-fingers | 91 | spot-the-fire | 148 | quote-the-caller |
| 35 | no-fat-fingers | 92 | no-fat-fingers | 149 | get-to-it |
| 36 | get-our-money | 93 | keep-the-keys | 150 | whats-making-money |
| 37 | size-up-the-customer | 94 | clean-records | 151 | no-surprises |
| 38 | get-to-it | 95 | keep-my-place | 152 | spot-the-fire |
| 39 | reach-the-person | 96 | trust-the-screen | 153 | whats-making-money |
| 40 | get-told | 97 | keep-my-place | 154 | quote-the-caller |
| 41 | spot-the-fire | 98 | reach-the-person | 155 | get-to-it |
| 42 | field-trouble | 99 | reach-the-person | 156 | keep-the-keys |
| 43 | get-our-money | 100 | get-told | 157 | get-told |
| 44 | line-up-the-runs | 101 | quote-the-caller | 158 | quote-the-caller |
| 45 | line-up-the-runs | 102 | spot-the-fire | 159 | quote-the-caller |
| 46 | log-it-from-the-field | 103 | spot-the-fire | 160 | whats-making-money |
| 47 | get-it-back | 104 | reach-the-person | 161 | spot-the-fire |
| 48 | get-it-back | 105 | hook-it-to-the-rental | 162 | get-to-it |
| 49 | no-fat-fingers | 106 | no-fat-fingers | 163 | no-surprises |
| 50 | hook-it-to-the-rental | 107 | keep-my-place | 164 | spot-the-fire |
| 51 | hook-it-to-the-rental | 108 | get-told | 165 | whats-mine-today |
| 52 | whats-next-to-wrench | 109 | reach-the-person | 166 | no-surprises |
| 53 | field-trouble | 110 | get-it-back | 167 | line-up-the-runs |
| 54 | whats-next-to-wrench | 111 | whats-next-to-wrench | 168 | whats-mine-today |
| 55 | whats-next-to-wrench | 112 | get-told | 169 | works-in-gloves |
| 56 | whats-next-to-wrench | 113 | work-the-wrench-job | 170 | get-told |
| 57 | hook-it-to-the-rental | 114 | works-in-gloves | 171 | no-surprises |
