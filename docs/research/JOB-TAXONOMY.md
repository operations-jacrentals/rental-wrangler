# The Job Taxonomy

**25 jobs · every one of the 171 findings assigned to exactly one · built 2026-07-19**

The inventory's stated primary axis is *the work* — but the `job` field was collected as free
text, so all 171 findings were uniquely worded and never clustered. This document is the
controlled vocabulary that fixes that, and `FINDINGS-BY-JOB.md` is the full re-index against it.

## How the vocabulary was built

- Each finding's free-text `job` line was read against its evidence and collapsed to the real
  work it blocks, phrased the way the person doing it would say it.
- **15 jobs are business work** — a specific person doing a specific thing (quote a caller,
  run a route, wrench on a machine).
- **10 jobs are table stakes** — work every role does all day on every card (hear about
  things, trust the screen, keep your place, not wreck things). These are still jobs a yard
  worker would name — "I just need the thing to tell me when something needs me" — but they
  don't belong to any one card or role. Forcing them into business jobs would have been
  arbitrary: a screen-reader failure or a lying count blocks *all* work equally.
- **One assignment per finding.** When a finding could sit in two jobs, the specific business
  job won over the table-stakes job, and the *damaged work* won over the *mechanism*.
  Forced calls are listed at the bottom so nobody mistakes them for clean fits.

**Damage score = 3×red + 2×orange + 1×yellow.** Total damage across all 171 findings = 369.

## The headline numbers

- **The table-stakes layer carries 51% of all damage** (188 of 369, 93 of 171 findings).
  Before any specific job can be fixed, the app fails at hearing-about-it, trusting-it,
  finding-it, and not-wrecking-it. This matches the failure-mode table: `invisible` (45) is
  the largest mode, and only 20 findings are density/legibility.
- **The back half of the rental carries more damage than the front half.** Getting a machine
  back, deciding what to fix, and working the repair (get-it-back 17 + what's-next-to-wrench 16 +
  work-the-wrench-job 15 + field-trouble 10 + log-it-from-the-field 14 = **72**) outweighs
  quoting, stock, sizing-up, attaching and dispatching (56). The rental's *end* — the densest
  handoff in the business — is where the UI system loses the most.
- **The single most damaged business job is "get the machine back"** — overdue returns
  invisible to every count, recoveries with no bucket until the day *after* late, a return
  path that captures no hours, no condition, no damage.
- **The most systemic job is "hear about it"** — 11 of its 12 findings are systemic. The app
  has no delivery channel at all; every card rediscovered the same hole.

## The 25 jobs, ranked by damage

| # | Job | Said as | n | R/O/Y | Systemic | Damage |
|---|---|---|---|---|---|---|
| 1 | `spot-the-fire` | "Spot what's on fire without reading every row" | 14 | 4/7/3 | 10 | **29** |
| 2 | `get-told` | "Hear about it when something needs me — without staring at the screen" | 12 | 3/6/3 | 11 | **24** |
| 3 | `keep-my-place` | "Keep my place — my scroll, my filters, my view" | 10 | 4/6/0 | 2 | **24** |
| 4 | `get-to-it` | "Get to the thing — the record, the list, the button, the door" | 12 | 3/6/3 | 5 | **24** |
| 5 | `trust-the-screen` | "Trust what the screen says — the numbers, the counts, the freshness" | 10 | 2/6/2 | 3 | **20** |
| 6 | `clean-records` | "Get data in right, fix what got in wrong, don't lose anyone's work" | 8 | 3/5/0 | 2 | **19** |
| 7 | `get-it-back` | "Get the machine back when it's due — and take it in right" | 6 | 5/1/0 | 3 | **17** |
| 8 | `whats-next-to-wrench` | "Figure out which machine to wrench on next" | 6 | 4/2/0 | 4 | **16** |
| 9 | `work-the-wrench-job` | "Work a repair through — parts, progress, proof" | 7 | 1/6/0 | 1 | **15** |
| 10 | `reach-the-person` | "Call, text, or message the person this is about — from the thing itself" | 7 | 2/4/1 | 4 | **15** |
| 11 | `quote-the-caller` | "Work out what to charge this caller" | 9 | 2/1/6 | 1 | **14** |
| 12 | `size-up-the-customer` | "Size up this customer before I hand them iron" | 5 | 4/1/0 | 1 | **14** |
| 13 | `log-it-from-the-field` | "Log the job from the field and have it stick" | 5 | 4/1/0 | 1 | **14** |
| 14 | `run-my-route` | "Run my route — where to, when, how to get there" | 5 | 3/2/0 | 0 | **13** |
| 15 | `keep-the-keys` | "Keep money numbers and admin switches with the right people" | 6 | 2/3/1 | 5 | **13** |
| 16 | `no-fat-fingers` | "One stray tap can't wreck a charge, a record, or a job" | 5 | 3/2/0 | 5 | **13** |
| 17 | `get-our-money` | "Get our money — billed, chased, collected" | 4 | 4/0/0 | 2 | **12** |
| 18 | `hook-it-to-the-rental` | "Put a machine on the rental — and only one that's fit to go out the gate" | 4 | 3/1/0 | 3 | **11** |
| 19 | `no-surprises` | "Controls do what they look like they do — same on every card" | 9 | 0/2/7 | 5 | **11** |
| 20 | `field-trouble` | "Handle trouble in the field — breakdowns, delays, can't-complete" | 4 | 2/2/0 | 1 | **10** |
| 21 | `got-one-free` | "Find out if we've actually got one to rent" | 4 | 2/1/1 | 2 | **9** |
| 22 | `works-in-gloves` | "Works in my hands — touch, gloves, small screen, no hover, no eyes" | 6 | 0/3/3 | 3 | **9** |
| 23 | `line-up-the-runs` | "Line up today's hauls — who's driving what where" | 4 | 2/0/2 | 3 | **8** |
| 24 | `whats-mine-today` | "Know what's mine to do today — and my next move" | 4 | 2/0/2 | 3 | **8** |
| 25 | `whats-making-money` | "See what's making us money and what's bleeding us" | 5 | 0/2/3 | 0 | **7** |

Checksums: n sums to 171; R/O/Y sums to 64/70/37; systemic sums to 80; damage sums to 369.
All four match the inventory's own totals.

---

## The jobs, defined

### Business jobs (15) — 78 findings, 181 damage

**`quote-the-caller`** — Work out what to charge this caller, before they hang up. The counter
rep reading the card face they actually look at. Findings: 16, 18, 101, 145, 146, 148, 154,
158, 159. *The face shows the wrong number (member rate absent, 267% over), can't derive an
arbitrary-length total (59% over), and the correct answer sits behind a right-click.*

**`got-one-free`** — Find out if we've actually got one to rent. Stock truth. Findings: 17,
19, 89, 147. *Two availability counts disagree on the same screen; sold fleet still shows rack
rates; the click-through to see the machines lands empty.*

**`size-up-the-customer`** — Size up this customer before I hand them iron: member or not, lead
or renter, do-not-contact or fine, worth chasing or not. Findings: 27, 28, 33, 37, 90.
*Every signal that answers "who is this" is frozen, clamped, contradicted, or grey.*

**`get-our-money`** — Get our money: make sure the rental got billed, chase what's owed, send
the dead ones to collections. Findings: 29, 30, 36, 43. *All four red. A rental closes out
unbilled; collections and void are built with no door; the who-owes-most sorts are dead.*

**`hook-it-to-the-rental`** — Put a machine on the rental — and only one that's fit, insured,
and legal to go out the gate. The attach moment and its gates. Findings: 50, 51, 105, 57.
*One undiscoverable path per device (drag / long-press), and no fitness gate on either.*

**`line-up-the-runs`** — Line up today's hauls: who's driving what where, no one double-booked.
Findings: 44, 45, 139, 167. *The multi-truck tools exist unrendered; people can be
double-booked silently where machines can't.*

**`run-my-route`** — Run my route: where to, when it's due, how to get there, from the cab.
Findings: 1, 2, 9, 65, 69. *The map eats the screen; pickups can never carry a time; the
address is hover-only; the real deadline is a secret.*

**`log-it-from-the-field`** — Log the job from the field and have it stick: the capture, the
video, the proof. Findings: 12, 13, 15, 46, 74. *A failed upload stamps green; a blocked stop
discards the capture, video included; the pending write lives in RAM.*

**`field-trouble`** — Handle trouble in the field: a breakdown on a customer's site, running
late, can't complete. Findings: 42, 53, 71, 75. *The repair dispatches to the wrong machine;
the broken machine files under a calm bucket; the driver's row offers only 'Merge trip…'.*

**`get-it-back`** — Get the machine back when it's due — and take it in right: hours, condition,
damage, money. Findings: 4, 5, 47, 48, 61, 110. *Highest-damage business job. Overdue is
invisible to every count; recoveries have no bucket until after they're late; the return
captures nothing the next three cards need.*

**`whats-next-to-wrench`** — Figure out which machine to wrench on next, and get back to that
list after each job. Findings: 52, 54, 55, 56, 111, 125. *The correct prioritized landing
exists and dies on the first click; grouping beats the sort; a wash masks an overdue engine.*

**`work-the-wrench-job`** — Work a repair through: parts, progress, proof, and knowing when
it's actually done. Findings: 59, 113, 117, 124, 131, 133, 134. *The phase pill is frozen;
part ETA can never fire; stock counts are decorative; completing one WO hides the other.*

**`whats-mine-today`** — Know what's mine to do today — my queue, my day, my next move.
Findings: 3, 64, 165, 168. *No view is ever scoped to 'mine'; assignment fields route
nothing; there is no morning brief; the next move is a noun.*

**`whats-making-money`** — See what's making us money and what's bleeding us, well enough to
buy and sell fleet. Findings: 76, 77, 150, 153, 160. *Revenue counts phantom rentals;
utilization counts dead fleet; the lost-demand signal dead-ends at the tapper's own device.*

**`keep-the-keys`** — Keep money numbers and admin switches with the right people — and let
the boss configure the shop without breaking it. Findings: 21, 22, 93, 121, 127, 156.
*Authority is inverted (anyone can mint a rentable class, only admin can price it), margin
leaks through ungated columns, and a role rename silently kills a tailored landing.*

### Table-stakes jobs (10) — 93 findings, 188 damage

**`get-told`** — Hear about it when something needs me — without staring at the screen.
Findings: 7, 20, 40, 67, 82, 100, 108, 112, 129, 144, 157, 170. *The app has no messenger:
no push, no badge, no durable inbox. Settings sells three notification engines that don't
exist. 11 of 12 systemic — every card found the same void.*

**`reach-the-person`** — Call, text, or message the person this thing is about — from the
thing itself. Findings: 26, 39, 98, 99, 104, 109, 142. *No tap-to-call anywhere; the built
per-record thread panel renders nowhere; replies are never polled.*

**`spot-the-fire`** — Spot what's on fire without reading every row. Findings: 31, 32, 41,
58, 78, 81, 91, 102, 103, 122, 123, 152, 161, 164. *Highest-damage job in the app. Red is
the default state and never says why; severity dies on the row it's born on; the blinks
point at the calm ones. Includes the name-field ledger — staff hand-building the signal
system the app doesn't have.*

**`trust-the-screen`** — Trust what the screen says: the number is right, tapping it shows
what it counted, the data is current, the history is in order. Findings: 10, 14, 72, 83,
96, 119, 120, 126, 138, 143. *Counts disagree inches apart; the sync footer lies in both
directions; history renders as a shuffled deck.*

**`keep-my-place`** — Keep my place: my scroll, my filters, my view, the record I was on.
Findings: 6, 11, 24, 25, 66, 79, 80, 95, 97, 107. *View state is scratch paper — renders,
polls, taps and reloads all silently move, stack, or wipe what I was looking at.*

**`get-to-it`** — Get to the thing: the record past the cutoff, the linked record, the door
to the capability. Findings: 8, 38, 60, 68, 70, 84, 87, 118, 128, 149, 155, 162. *Show More
is a no-op; links land at the generic top; whole capabilities have no entry point; the QR
decal — the yard's most obvious affordance — hijacks the app.*

**`no-surprises`** — Controls do what they look like they do, and the same thing on every
card. Findings: 116, 130, 135, 136, 141, 151, 163, 166, 171. *Filters live under SORT; the
same glyph means opposite things; Escape works everywhere except menus; a habit learned on
one card is wrong on the next.*

**`works-in-gloves`** — Works in the hands that actually hold it: touch, gloves, small
screens, no hover, screen readers. Findings: 88, 114, 115, 137, 140, 169. *67% of controls
have no visible name; the label layer is hover; menus clip at tablet heights. The phone walk
(07-phone-walk/) tests how much worse this is below 640px.*

**`no-fat-fingers`** — One stray tap can't wreck a charge, a record, or a job — and the app
warns me before the point of no return. Findings: 34, 35, 49, 92, 106. *Card removal, full
charges, membership cancellation and terminal status jumps all commit on first tap while the
reversible actions carry the confirms.*

**`clean-records`** — Get data in right, fix what got in wrong, and don't lose anyone's work.
Findings: 23, 62, 63, 73, 85, 86, 94, 132. *No dedupe, no validation, no merge, no delete —
and last-write-wins sync silently throws away a coworker's entries.*

---

## Forced calls — read before re-using the taxonomy

Single-assignment forces judgment where a finding genuinely spans jobs. The material ones:

- **4 and 5** (badge excludes past-day undone stops; the collapsed gray 'Earlier' bucket) are
  filed under `get-it-back`, not `trust-the-screen`/`spot-the-fire` — the damaged work is
  overdue recoveries (two stops were 78 days old), and they travel with 48/110.
- **41** (the name-field ledger) is filed under `spot-the-fire`: it is the staff's hand-built
  replacement for the surfacing the flag system doesn't do. It is equally evidence for
  `clean-records` (free text in the name field) and `size-up-the-customer`.
- **165** ("next move is a noun") is filed under `whats-mine-today` — the job is knowing and
  taking your next move — though its example (Off Rent = 3 days overdue) touches `get-it-back`.
- **17** (two availability counts) sits in `got-one-free`, not `trust-the-screen`, because the
  damaged work is a stock answer; the same two-authors mechanism appears in `trust-the-screen`
  findings 120/126.
- **63** (last-write-wins) is filed under `clean-records` ("don't lose anyone's work") rather
  than a separate two-people-one-yard job; the *Last Save Wins* pattern says four cards share
  the mechanism, so the redesign should treat it as bigger than its single-finding count here.
- **100** (the bell full of engineering tickets) is `get-told`, not `spot-the-fire` — the bell
  is the delivery channel, not the scan surface.
- Cross-cutting jobs would multiply-index if allowed: nearly every business-job finding also
  damages `trust-the-screen` or `get-told`. The single-assignment rule keeps the damage sums
  honest; the pattern layer (ALL-PATTERNS.md, the six roots) is where the overlaps live.
