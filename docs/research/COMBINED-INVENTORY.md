# The Combined UI Inventory

**171 findings · 5 cards · 48 cross-card patterns · 80 findings flagged systemic**

Every finding came from a persona-driven audit that walked the live app as the laziest, least-sharp version of the person who actually works in that card, and verified each claim against production bytes. This combines all five, with RENTALS at full fidelity.

> **This is a gathering, not a design.** Nothing below proposes a solution. Its job is to define the scope of what a UI system has to solve.

---

## Read this first — there are two apps, and only one was audited

All five audits ran the **desktop build (>640px)**. Below 640px the app is structurally a different product: the 3-column grid becomes a 5-card swipe ribbon, the toolbar moves to a footer, popups become bottom sheets, sections become swipe decks, and global search disappears.

Three consequences that change how you read everything else:

1. **The tooltip layer does not exist on touch devices.** Both the tooltip and hover-preview engines early-return on `!HOVER_CAPABLE`. Every finding of the form *"the answer is only in a hover tooltip"* is worse than recorded — on the tablet in the yard that information is **absent, with no fallback path**.
2. **The UNITS headline finding does not fire on touch.** The hover-preview misclick trap needs a hover; on a tablet the same control instead globally disables previews app-wide.
3. **Drag-to-link was retired on phones in June 2026** in favour of long-press. *"Drag is the only way to attach a machine to a rental"* is a **desktop** truth; phones have a second, equally undiscoverable grammar nobody has audited.

**Nobody has walked the phone build.** That is the single largest gap in this research.

---

## The six root problems

The 48 patterns cluster into six roots. Each is stated as the question a redesigned UI system has to answer.

| | Root | The question it must answer | Patterns |
|---|---|---|---|
| **R1** | The app has no addressee | Who is this for, and how does it reach them? | 13 |
| **R2** | No fact has one owner | Where does a derived fact live so every surface reads the same function, and clicking a number returns exactly what it counted? | 11 |
| **R3** | Urgency has nowhere to live | Where does urgency live, how is it ranked, and how does it travel up to the surfaces people actually glance at? | 11 |
| **R4** | Guards are attached per-widget, not per-consequence | How does an action publish its own preconditions and reversibility to the control that triggers it? | 6 |
| **R5** | Capability without a door | For every capability: where is its door? For every screen: what can I actually DO here? | 6 |
| **R6** | Every card invented its own dialect | What is the one interaction grammar, and what enforces it? | 1 |

### R1 · The app has no addressee

It knows who is signed in and uses that for almost nothing — not to route work, not to scope a list, not to tell anyone anything. Assignment identity is captured in dozens of places and consumed nowhere. Every alert lands in one undifferentiated bell with no concept of who it is for.

**The question to answer:** *Who is this for, and how does it reach them?*

| Pattern | Cards | The systemic rule being broken |
|---|---|---|
| **Nothing reaches you when you're not looking** | 5 | The app has no delivery channel that survives the user not looking at the right pixel: no push, no OS badge, no durable inbox, no role-addressed message. Every alert it produces is a render-time paint on a surface someone must already be on, and the only confirmation primitive — the toast — self-clears in ~2.2 seconds with no trail. |
| **One Bell, Owned By Billing And Transport** | 5 | There is exactly one proactive alert channel and its payload was claimed by the invoice and transport subsystems; every other subsystem's urgency — overdue returns, failed machines, expired insurance, category stockouts — has no route into it, and one card is hardcoded as the only tab allowed to glow. |
| **No One Gets Told** | 5 | The app has no messenger. Every state change writes to data and stops there — nothing crosses to the person on the other card, on the other device, or off the screen — and four independent audits found the same void from four different seats. |
| **Names That Don't Describe The Effect** | 4 | Controls and metrics are labelled for what someone assumed they did, and the label survives the code changing underneath it — so the user's model of the screen is built from text the screen no longer honours. |
| **Nobody's Name On Any Job** | 4 | Work is never addressed to a person. Assignment fields are stored, displayed, edited and searched, but no view is ever scoped to 'mine' — so every worker reconstructs their own queue by reading the whole board. |
| **Last Save Wins, Quietly** | 4 | When two people touch the same record from two cards, one person's work is discarded with no notice to either of them — and the sync that would have revealed the change is skipped at exactly the moment someone is working. |
| **Records And Conversations Are Two Different Apps** | 3 | The comms subsystem and the records subsystem share a shell but never touch: no record surface can start a conversation, the built per-record thread panel renders nowhere, replies aren't polled, and Settings sells three notification engines that don't exist. |
| **The Primary-Unit Mirror Meets Multi-Unit Reality** ⁿ | 3 | A one-rental-one-unit identity from an earlier era is still the pointer that actions resolve through, so on multi-unit rentals and merged trips the app acts confidently on the wrong machine, the wrong stop, or nothing at all — while the clicked identity sits unused in scope. |
| **Machines Are Entities, People Are Not** ⁿ | 3 | The flag, conflict and queue machinery was built for equipment and paperwork; drivers and mechanics are stored as strings on those records, so the same double-booking that pulses red on a machine is silent on a person, and 'assigned to me' does not exist anywhere in the app. |
| **Silence Is Rendered As Success** | 3 | Failures, staleness and non-delivery produce no distinct state. A write that never landed, a poll that never runs, a fetch that errored, and a toggle whose engine was never built all leave a screen identical to the working case. |
| **Closed Without Proof** ⁿ | 3 | Terminal states are recorded as accomplished facts without the app ever capturing the evidence that would make them true, and every downstream aggregate inherits the hole silently. |
| **Zero Is Not "I Don't Know"** | 2 | The app has no representation for unknown. Divide-by-zero guards, falsy defaults and blank inputs all resolve to a confident 0, $0, an em-dash or a green all-clear that is typographically identical to a real measurement. |
| **The Empty Return** ⁿ | 2 | The end of a rental is the densest handoff in the business — machine, hours, condition, damage, money — and the return path records only {date, video, driver}, so three downstream cards derive their numbers from readings nobody was ever asked for. |

<details><summary><b>Why the 3 five-card patterns here persist</b></summary>

**Nothing reaches you when you're not looking** — Alerting was never modeled as a layer with an address ('who is this for?') and a lifetime ('how long does it stay?'). Each feature that needed to say something reached for the nearest render-time primitive — a colour, a count, a 2.2-second toast — because that is the only primitive the app has. Settings then grew toggles describing an alerting product nobody built, so the UI now promises delivery it structurally cannot perform, and the promise itself hides the gap.

- RENTALS: sw.js is 47 lines documented 'OFFLINE SHELL ONLY' with no push/notificationclick listener and no showNotification; a grep of the 27,649-line app.js for Notification/requestPermission/setAppBadge/pushManager returns zero. Only two setInterval calls exist in the whole file — a GPS-view timer (app.js:24080) and an 18s backend poll (app.js:24796) — and neither scans flags to fire anything.
- Calendar/Driver: assignStopDriver's only effect on a successful assignment is a line pushed into a hidden per-rental audit array. All 3 call sites traced (single-stop picker, drag-drop, bulk 'Round up'); the one toast() anywhere in the chain fires in the DISPATCHER's own browser and is never addressed to or visible on the assigned driver's device.
- Calendar/Driver: Settings → Notifications → Crew Alerts already ships a toggle named 'Driver Assigned' — 'Texts a driver the moment a delivery or pickup is assigned to them' — scoped and named in the settings schema, defaulted off, and explicitly commented in-code as inert until a later phase.
- UNITS: all ten FLAG_COND.units predicates fire silently into data with no messenger; team chat only rings for human-typed messages; toasts are the only confirmation surface and self-clear in ~2.2 seconds with no durable trail — so an uninsured or overdue machine can go out the gate with nothing on the mechanic's tablet ever having said so.

**One Bell, Owned By Billing And Transport** — The bell was built as a feature of the billing rollout and the transport rollout, each appending its own count to one expression, rather than as a subscriber to a severity bus. Because the flag engine and the alert engine were never connected, registering a new red flag is free and produces nothing — the flag author gets a colored border and reasonably assumes the alerting was handled by whoever owns the bell.

- RENTALS: commsBellCount = unseenNotifs() + visibleTransportAlerts() + wranglerRequests (app.js:10342-10343) — none of the three reference the flag system, and a past-endDate leg drops OUT of the forward-windowed transportAlerts, so an overdue return isn't even indirectly counted. off-rent-overdue is a registered red flag (config.js:245) that feeds only getEntityColor, tinting the row it's already sitting in. The rentals column tab's alert is hardcoded false (app.js:9601).
- Categories / all cards: the column-tab alert glow is literally `alert: m === 'units' && unitsAlertCount() > 0` (app.js:9644-9655) — a string match on one card name; unitsAlertCount() is the only such function that exists anywhere in the file, so no other column can ever light up no matter its internal state.
- UNITS: the one alert indicator visible before opening the card watches only 3 of the 10 registered flag conditions (app.js:9479), and the bell itself shows 'Transports due' — a dispatch concern — while every item in the Notifications panel is invoices or card payments, none of it role-filtered (app.js:14050).
- Customers: the same bell holds engineering tickets addressed to the owner — pricing-engine internals with GitHub links, rendered as raw unparsed markdown so authored **Verdict:** shows its literal asterisks — with nothing customer-facing in it at all.

**No One Gets Told** — Notification was scoped as a channel feature (web push, SMS) rather than as the required completion of a write, so it sat behind a phase gate while the writes themselves shipped card by card. Every handler's definition of done is 'the record changed' — logAction + saveSoon — and there is no shared commit path that asks who else is affected. The Settings toggles prove the intent was captured; what is missing is the obligation.

- RENTALS: sw.js is 47 lines, documented 'OFFLINE SHELL ONLY' — install/activate/fetch/message listeners only, no push, no notificationclick, no showNotification, no pushManager.subscribe. A grep of the 27,649-line app.js for Notification / requestPermission / setAppBadge / pushManager returns zero. Close or background the app and zero alerts reach the dispatcher. UNITS, Categories and Calendar each rediscovered this independently — four cards, one hole.
- Calendar / Driver: assignStopDriver()'s only effect on a successful assignment is pushing a line into a hidden per-rental audit array (app.js:11341-11352, 22575). All three call sites traced (single-stop picker, drag-and-drop, bulk 'Round up'); the one toast() anywhere in the chain fires in the DISPATCHER's own browser. The driver is never told he has a job.
- Calendar / Driver: Settings → Notifications → Crew Alerts already ships a toggle literally named 'Driver Assigned' — 'Texts a driver the moment a delivery or pickup is assigned to them' — defaulted off (app.js:5161) and explicitly commented inert until a later phase ships the SMS path (app.js:5282, 5291). The product already named the fix.
- Customers: live, saveable Settings toggles for customer reminders and dispatch ETAs whose engines are inert — the toggle only persists its own state, so anyone flipping it on reasonably believes the app is now chasing customers.

</details>

### R2 · No fact has one owner

The same business fact is re-derived at every render site, each encoding its own filters and window. Nothing carries provenance, freshness or authority — so the screen contradicts itself inside one viewport, and a count does not return the rows it counted.

**The question to answer:** *Where does a derived fact live so every surface reads the same function, and clicking a number returns exactly what it counted?*

| Pattern | Cards | The systemic rule being broken |
|---|---|---|
| **Every number has two authors** | 5 | The same fact is computed independently by two or more renderers with different predicates, and both results ship to the same screen. There is no single derive layer, so the app contradicts itself inside one viewport — and the drill-through from a number lands on a differently-filtered set than the number counted. |
| **Desktop Pointer And Gloved Thumb On One Surface** | 4 | The same screen is authored for a mouse with hover and a precise click, and used by a driver in a cab and a tech on a yard tablet — so the meaning of the screen lives in hover states, and the destructive actions live where the hand is already travelling. |
| **Two Truths, One Screen** | 4 | The same fact is computed independently at every place it appears — live from source records here, from a stored field or a differently-scoped tally there — so two answers to one question render inches apart with nothing marking which is authoritative. |
| **The Number Doesn't Own Its List** | 4 | A count is tallied over one population and then used as the label for a click that produces a different population — or for a list it does not scope at all — so tapping a number is the most reliable way to discover the number was wrong. |
| **Every Card Grades Its Own Homework** | 4 | 'Is this OK / available / attention-worthy' is recomputed independently on every card from a different subset of the same shared flag registry, so the same machine or customer answers differently depending on which card you are standing on. |
| **Everything still assumes one record per thing** ⁿ | 3 | The data model grew multi-unit rentals and merged multi-stop trips; the UI and its logic did not. Wherever a container holds more than one child, the app silently substitutes the primary child for the whole — acting on the wrong record, hiding the worse one, and counting progress as zero until everything is done. |
| **The Status Field Has Two Owners** ⁿ | 3 | One status control is simultaneously dispatch's lifecycle timeline and accounting's authority gate, and the money system only guards the four statuses that mean 'going out' — so every exit path from a rental closes the job with no billing check at all. |
| **Every Renderer Computes Its Own Truth** | 3 | There is no shared definition of 'available', 'owed', or 'how many' — each renderer derives the number inline against its own filter, so two subsystems print contradictory answers to the same question inches apart on the same screen. |
| **The Truck Loses To The Desk** ⁿ | 2 | Field capture and office bookkeeping share one status action, and when they disagree the office wins by destroying the field's work — the driver's evidence is thrown away, the block is invisible on his surface, and no queue holds the write. |
| **The Parallel Ledger** | 2 | Where the official number cannot be trusted, staff have rebuilt it by hand in free-text fields — which is simultaneously the strongest proof the trust failures are real and a second, unvalidated source of truth the redesign now has to absorb rather than delete. |
| **The Name Field Ledger** | 2 | Where the system drops the baton, staff have already built a replacement by hand — typing business state into free-text fields and exploiting sort order to make it surface — which is the sharpest available map of what the handoff is missing. |

<details><summary><b>Why the 1 five-card pattern here persists</b></summary>

**Every number has two authors** — Derivation lives inside renderers instead of in a shared, named selector every surface must call. When someone corrects a definition they correct the renderer in front of them — the mini-card gets the fleetStatus fix, the detail does not — so each fix increases the number of disagreeing definitions rather than reducing it. Nothing in the codebase makes 'availability' or 'amount owed' a single addressable thing, and nothing fails when a fourth caller invents a fifth definition.

- Customers: the row computes live owed/overdue from real invoices every render while the group header, sort, filter and pulsing detail flag all read a stored payStatus written once at signup — a repo-wide grep found zero write sites outside the five creation paths, and the team's own spec (docs/specs/customers-crm.md:642-650, dated nine days before the audit) already calls it an open question. Two contradictory answers to 'does this person owe us' sit inches apart.
- Categories: same category, same second — 12k Excavator mini-card reads 'NEXT MON' (zero free) while the detail reads '9 Available'; Lift Scissor 19ft reads '2 Avail' vs '5 Available', the 3 extra being sold machines. A comment at app.js:7212 shows this exact bug class was fixed on the mini-card on 2026-06-25 and the fix never reached the detail renderer.
- UNITS: the Worklist graph reads 'NOT READY 28' while the group bar ~40px below on the same screen reads 'NOT READY · 8' — the graph tallies all of DATA.units (app.js:12167-12170), the list excludes out-of-fleet and on-rent units first (app.js:9295), and unitsAlertCount (app.js:9479) holds a third, narrower definition.
- UNITS: the Work Orders bar counts one entry per open WO but the click-through filters units — a unit with 2 open WOs is one row and two counted, so the number structurally cannot match the rows beneath it.

</details>

### R3 · Urgency has nowhere to live

Every list has one grouping slot and a lifecycle taxonomy already claimed it. The only thing anyone scans for — what is on fire — is left to a single colour channel with no ranking and no complete registry, and severity has no path upward from the row it is born on.

**The question to answer:** *Where does urgency live, how is it ranked, and how does it travel up to the surfaces people actually glance at?*

| Pattern | Cards | The systemic rule being broken |
|---|---|---|
| **Severity dies on the row it's born on** | 5 | Urgency has no path upward. A flag can be true on a row while the group header above it, the tab beside it, and the global count at the top of the app all stay calm — because every level re-implements its own private subset of the flag registry instead of aggregating the level below it. |
| **Colour is the only channel, and it's saturated** | 5 | Distinct conditions requiring different responses are mapped onto one visual output — a single red — with no name, no legend, and a ranking that reflects source order rather than consequence. The channel is oversubscribed to the point where alarm is the default state, and the same glyph or colour means different things on different cards. |
| **The label layer is hover** | 5 | The app has no naming layer. Controls ship as bare glyphs and the text that would explain them — plus, routinely, the operative data itself — is stored in a title/data-tip attribute, a gesture that does not exist on touch, in gloves, or in a screen reader. Where text does render, it truncates at exactly the character carrying the meaning. |
| **One Red Pill, Eight Meanings** | 5 | Distinct conditions from different subsystems are funneled through the same visual channel and the same words, so the pixel a user reads is a collision site: pricing, fleet, dispatch and AR each mean something different by 'red', 'available', 'member', and the row cannot say which one fired. |
| **Lifecycle Sorts The List, Danger Doesn't** | 4 | Two taxonomies contest the vertical axis of every list — a lifecycle/stage grouping that owns the buckets and headers, and a flag/severity system that owns the colors — and the grouping never consults the flags, so the emergency is filed under whatever calm stage it happens to be in. |
| **The Blink Points At The Calm One** | 3 | Attention signals are wired to the wrong side of their own condition — pulses that fire unconditionally, predicates tested against values the data can never hold, booleans swapped — so the loudest thing on the screen is reliably the least urgent thing on it. |
| **The Confirmation Doesn't Name The Record** ⁿ | 3 | Actions commit against a record other than the one clicked, and the receipt — a toast, a highlight, a restored scroll position — is generic enough to endorse the wrong one. |
| **Order Is A Claim Too** | 3 | Sorting and grouping are presented as the answer to "what is most urgent", but the sort either doesn't run, is silently overridden by grouping, or is keyed on something that isn't time — and the control still reads as applied. |
| **Late Is the First Warning** ⁿ | 3 | Urgency is computed from deadlines that have already passed. Nothing buckets, counts or signals work that is due — only work that is overdue, and often not even that. |
| **One Red For Seven Reasons** | 2 | Severity is stored per-condition but rendered as a single collapsed value, so a row can say "something is wrong" and not what — and each surface independently picks its own subset of the condition registry, so the surfaces disagree about whether anything is wrong at all. |
| **The Mirror Unit** ⁿ | 2 | A rental's identity as a set of machines is stored twice — the real units[] array and a scalar r.unitId 'primary' mirror — and every cross-card consumer reads the mirror, so work aimed at machine #2 or #3 silently lands on machine #1. |

<details><summary><b>Why the 4 five-card patterns here persist</b></summary>

**Severity dies on the row it's born on** — Flags were built as a per-entity registry but consumption was left to each renderer. There is no rollup contract requiring a container to expose the maximum severity of its contents, so every count and header was written by whoever needed one, at the granularity they needed. Severity therefore has no inheritance path, new entities (Categories) join the app without joining the registry, and nothing fails when they don't.

- UNITS: unitsAlertCount ignores 5 of the 10 registered flag conditions — failed inspection, overbooked, GPS offline, coverage expired, uninsured-active — including the two that put an unsafe or uninsured machine on the road. The tab badge, card border, corner-flag pill and group bucket each reimplement a different subset, so four separate mechanisms disagree about what 'needs attention' means.
- RENTALS: an overdue return (off-rent-overdue, config.js:245) feeds only getEntityColor — it tints the row it already sits in and nothing else. commsBellCount = unseenNotifs()+visibleTransportAlerts()+wranglerRequests references it nowhere, and a past-endDate leg drops OUT of the forward-windowed transportAlerts so it isn't even indirectly counted. The rentals column tab's alert is hardcoded false (app.js:9601).
- RENTALS: GROUP_DEFS.rentals buckets on lifecycle status (app.js:1986-1990) and never consults a flag, unlike UNIT_SECTIONS (app.js:9279-9290) which has an explicit red 'Attention' bucket — so the header count never reflects severity and flagged rows aren't lifted within the group.
- Categories: zero entries in FLAG_META/FLAG_COND — a full grep of both registries and every call site finds no getEntityFlags('categories', …) anywhere — so no category condition (zero stock, negative ROI, unset pricing) can escalate past its own mini-card pill. No categoriesAlertCount function exists, and the column-tab alert glow is hardcoded to fire only for Units.

**Colour is the only channel, and it's saturated** — Severity was modeled as a colour rather than as a named condition with a required response. Once red is the only way to say 'important,' every team with something important adds red, and the encoding degrades monotonically — nothing ever removes a red, and nothing arbitrates between two reds, so ranking falls back to whatever order the flags happened to be pushed in.

- RENTALS: FLAG_COND.rentals defines 7 conditions (fc, overbooked, unpaid-balance, no-card, unsigned-card, unit-failed, off-rent-overdue), ALL severity:'red', and getEntityColor collapses to fl[0].severity so the row renders one uniform red. The flag's NAME never appears on the row, and 2 of the 7 (no-card, unsigned-card) are genuinely unidentifiable without the desktop hover-preview or a hop to the customer record.
- Categories: eight-plus distinct unavailability reasons (N/A, Sold, For Sale, Inactive, Failed, Overdue, End Dates?, Off fleet, plus Purchased/Onboard) all render through one identical red pill with no legend anywhere — an actionable 'Overdue' (a customer is late returning our machine) is pixel-identical to an inert 'N/A' (we never stocked the class).
- Customers: measured live, 44 of 60 rendered rows were red and 11 of the first 12 in the default view; inspecting a red row's DOM found no flag word in its text and no title attribute — the only tooltip on the row belongs to an unrelated eye-preview toggle. 'Hasn't rented since spring' and 'has no card and is about to take a machine' render identically.
- UNITS: flag ranking is by colour rank tie-broken by hardcoded push order — GPS is pushed second, service fourth — so a dead GPS antenna always outranks a seizing engine when both are red; the worst machine in the yard (2,882 hrs past service) displays as 'No GPS +1'. Separately 'Part Needed,' 'Part Ordered,' 'Part Needed?' sit side by side with the question-mark variant rendering red on one tile and amber on the next.

**The label layer is hover** — Every card face is over-subscribed and hover was available and free. Because a tooltip is a per-element decision rather than a naming contract, what gets demoted is chosen locally and always sacrifices the long string — which is usually the noun carrying the meaning. No layout rule reserves space by importance, so truncation order is an accident of source order, and touch/gloved/assistive use was never a rendering mode the layout had to satisfy.

- UNITS: a full inventory of the mechanic's screen found 86 interactive elements, 58 (67%) with no visible text label, 52 of those 58 labelled only by a title-attribute hover tooltip, and not one aria-label in the set — even though the repo already pairs aria-label with data-tip in 69 other places, so the pattern is known and simply unapplied here.
- Categories: a live full accessibility-tree read found refs ref_1826 through ref_1859 plus the entire block ref_2305–ref_2328 (the category pills) all reading as bare 'button', and the filter-term chips — both the pill and its nested negate-icon button — do not appear in the accessibility tree at all: unreadable and unremovable by a screen-reader user.
- Calendar/Driver: the row prints a town, 'Lake Charles', while the live DOM shows data-tip holding the full '1700 11th St, Lake Charles, LA 70601, US' as an unused hover-only attribute — for a driver in a truck wearing a glove.
- UNITS: the worst machine in the yard, 2,882 hours past service, renders on its tile as 'No GPS +1' with the service number existing nowhere on the tile face, only inside the data-tip string; and service-flag text truncates at roughly 9px so '73 HRS…' could mean overdue or remaining.

**One Red Pill, Eight Meanings** — Color and pill shape are the only severity channels the design language exposes, and every subsystem that needed to say 'important' had exactly one way to say it, so red accreted meanings without any of them being wrong. The flag registry stores severity but not identity, so getEntityColor can only return a color — the name of the condition that fired has nowhere to render on a row. And because each card's vocabulary was authored locally, the same word ('available', 'member', 'weekend') was defined independently three times.

- Categories: eight distinct unavailability reasons — N/A, Sold, For Sale, Inactive, Failed, Overdue, End Dates?, Off fleet — all render through one identical single-color red pill with no legend, via a single badge(...,'red') call (app.js:2281-2297). An actionable 'Overdue' (a customer is late returning our machine) is pixel-identical to an inert 'N/A' (we never stocked the class).
- RENTALS: FLAG_COND.rentals defines 7 conditions — fc, overbooked, unpaid-balance, no-card, unsigned-card, unit-failed, off-rent-overdue — ALL at severity 'red' (config.js:239-253), and getEntityColor collapses to fl[0].severity (app.js:5834-5854), so the row is one uniform red. Verified scope: 3 of 7 get a distinct on-row echo, but no-card and unsigned-card are genuinely unidentifiable without a desktop hover-preview or a hop to the customer record.
- Categories: member day-rate ($120) is a stored, first-class, edited field that the mini-card never renders — the face shows only the four retail tiers (1-Day $440 etc.) while rentalPrice() short-circuits to days × memberDaily for a member, skipping all four displayed tiers (app.js:7271-7275 vs 8876-8879 vs 1078). A rep reading the face he actually looks at overquotes a member by 267%.
- Customers: on a live production record the account header read 'Member' while the AR block on the same screen read 'NON MEMBER MODE' for the same account. Separately, a stored 'Don't Contact' stage renders as a red pill on the row but the detail popup clamps off-vocabulary values to a calm blue 'Lead' (app.js:212-219) — opening the record to check the warning makes the warning disappear.

</details>

### R4 · Guards are attached per-widget, not per-consequence

Whoever wrote a control decided its guard, so the confirmation lands on the reversible action while the irreversible one beside it commits on first tap. Preconditions are evaluated at commit time and nowhere before it, so the control cannot render blocked.

**The question to answer:** *How does an action publish its own preconditions and reversibility to the control that triggers it?*

| Pattern | Cards | The systemic rule being broken |
|---|---|---|
| **Nothing warns you before the point of no return** | 5 | Preconditions and consequences are evaluated at commit time and nowhere before it. The UI never says an action is blocked, irreversible, or wrong until after you've taken it — and the app's own confirm/arm/review patterns are hand-applied conventions, so identical-looking controls a few lines apart behave completely differently. |
| **Writes have no integrity layer** | 5 | Records can be created, edited and closed out without the app checking the result is coherent. Nothing dedupes on create, nothing validates magnitude or format on entry, nothing captures the fields the business needs at the moment they exist, and nothing can delete or merge what got made wrong — so bad data is permanent and silently authoritative. |
| **Gates are attached to controls, not to data** | 3 | Permission is enforced wherever someone remembered to enforce it — on a specific button, inside a specific renderer — never on the datum itself. So the same value is masked on one surface and printed on the next, and the authority to create a record is decoupled from the authority to make the created thing safe. |
| **Permission Is A Per-Renderer Opinion** | 3 | Authority is enforced at individual widgets rather than at the data, so the same value is masked on one strip and printed plainly on the next, and the two gate functions in the app disagree about who an unassigned user even is. |
| **Locks on Doors, Not on Jobs** | 3 | Permission is attached to individual controls rather than to the job those controls perform, so the same job is gated on one card, ungated on another, and inverted within a single file — and the gate does not travel with the work. |
| **The Gate Fires in the Field** ⁿ | 2 | Office-side booking gates are evaluated at the instant of the field action, in the field worker's browser, against data he cannot see or fix — so the block destroys the field work instead of preventing the trip. |

<details><summary><b>Why the 2 five-card patterns here persist</b></summary>

**Nothing warns you before the point of no return** — Gates were written as guards inside commit handlers — the correct place to enforce them and the worst place to communicate them. Because the gate's answer is never computed at render time, the control cannot know it is disabled; and because confirm/arm/review are conventions applied by hand rather than properties of a destructive-action primitive, whether a given button asks first is decided one button at a time by whoever wrote it.

- RENTALS: the invoice hard-gate fires only for val==='On Rent' (app.js:19911) and the blacklist/rules/card/account-block gates are all scoped to BOOKING_STATUSES ['On Rent','Reserved','Today','Tomorrow'] (app.js:19751) — 'Returned' is in none. The status dropdown is a free-jump timeline, every node a live button with no disabled state, so a fresh Reserved rental with invoiceId still null can be clicked straight to Returned and closed out unbilled.
- RENTALS: terminal jumps (Returned/Cancelled/No Show) sit stacked as the last rows of one dropdown (order app.js:16851), each a plain button calling setRentalStatus with zero intervening step; Cancel/No-Show strips billing in the same breath (app.js:19929) and the row drops instantly with no fade — while the app already owns a confirm pattern.
- RENTALS: a driver taps Log Delivery, the office-side booking gate refuses the status move, and the entire capture including recorded video is discarded — no queued retry, no visible block on the Trips side to clear (app.js:20256-20261).
- Calendar/Driver: the same class from the driver's seat — the log-gate ('no invoice on this rental') is evaluated only on tap, never at row render, so a stop blocked that morning shows no lock and no flag until he has driven the full distance. The check exists in the codebase; it simply runs at the wrong moment.

**Writes have no integrity layer** — Writes were added one form at a time to satisfy one screen's need, and the schema is treated as append-only storage rather than a model with invariants. Validation, dedupe and lifecycle (merge/retire) are each a feature someone would have to request, and nobody requests them until the bad data is already load-bearing — at which point deleting it is more dangerous than living with it, so the workaround (a second record, a 'Unknown category' string) becomes permanent.

- UNITS: the only field writing the hour meter is `const v = Number(input.value); u.currentHours = v` — no range check, no order-of-magnitude guard, no monotonic check. Live production history on unit SPEECHLESS: 'Jun 17 — Hours: 1732.3 → 17385.5' (Cameron), corrected 'Jul 13 — 17385.5 → 1738.5' (Bri) — a 10x typo that stood 26 days feeding every service countdown, the fleet hours average, category ROI and $/Hr computations, permanently stamped onto every work order opened in that window. Separately, a blank 'hours at completion' records as 0 and sets a false countdown baseline.
- RENTALS: 'Log Recovery' stamps only {date, video, driver} and sets Returned — no condition capture, no inspection opened, no damage line (app.js:20259-20261) — so the Rental Protection $1,000 cap (app.js:4410-4411) can never be exercised from the return path.
- UNITS: the same gap upstream — startHours/returnHours exist on every rental unit entry, are seeded with real values and are humanized for the audit log, but have zero writers, so a unit goes out for three weeks, comes back 180 hours older, and its service countdown does not move by one hour.
- Calendar/Driver: uploadCaptureMedia posts the walkaround video once; on network failure the catch toasts 'saved without it' for two seconds and the row still stamps green 'Logged' — a failed upload and a successful one are visually identical afterward, and that video is the only defense against a later damage claim. A failed sync holds the pending write only in RAM while the R25 banner instructs a phone user 'Don't close the app.'

</details>

### R5 · Capability without a door

Finished, permission-gated, audited features sit unreachable because their only entry point was on a retired card, in a state that can never occur, or on a board specced and never built. The cards describe state exhaustively and offer almost nothing to do about it.

**The question to answer:** *For every capability: where is its door? For every screen: what can I actually DO here?*

| Pattern | Cards | The systemic rule being broken |
|---|---|---|
| **Built but never doored; rendered but never wired** | 5 | There is no binding between a capability and a control. Fully-built features sit in production with no button that reaches them, and fully-rendered buttons sit on screen with no live code behind them — and neither condition produces any signal, so the surface looks complete in both directions. |
| **The cards narrate; they don't act** | 5 | Surfaces are built to report state, not to advance work. The record tells you what is true and offers no next move, no way to reach the person involved, and no queue of what is yours — so every real action is a multi-screen detour or a phone call the app never sees. |
| **Doors Walled Over** | 5 | When a card was retired, the capabilities that lived on it stayed fully built underneath but lost their only entry point, and no other card adopted the step — so a whole job in the chain has working code, gates, confirms and audit entries, and no button. |
| **Retired Cards Left Their Work Behind** | 4 | Whole subsystems were retired by deleting their renderer while leaving their handlers, gates, buckets and confirm flows live — so fully built, fully gated capabilities now sit unreachable inside the surface that won the real estate, and the stranded copy still instructs users in the retired idiom. |
| **A Stored Mirror Nobody Re-Derives** ⁿ | 4 | Denormalized fields — a primary-unit pointer, a pay status, a WO phase, an on-hand quantity, an hour meter, a sync flag — are written once and then read as current everywhere, with no invalidation, no re-derive pass, and nothing in the UI distinguishing a mirror from a measurement. |
| **Born, Never Buried** | 2 | Records mint from many paths with no lookup and can never be merged, retired or deleted — so a duplicate created at one card boundary permanently splits the history the next card needs. |

<details><summary><b>Why the 3 five-card patterns here persist</b></summary>

**Built but never doored; rendered but never wired** — Cards were retired by unmounting a renderer, not by re-homing what they owned; and features were specced with their entry point as an afterthought. Nothing in the build fails when a handler has no call site or a control has no handler, so dead surface accumulates in both directions — and staff invent workarounds (voiding through the Sheets backend, typing state into name fields) that make the gap invisible to whoever measures whether the feature 'exists.'

- Customers: send-to-collections and void-invoice are built end to end — manager gate, confirm popup with reason codes, overlay, auto-blacklist, audit-log entry, money-safe void handler — and their only trigger buttons render inside a retired standalone Invoices card. Verified live: the status menu on a real Late invoice offers exactly three items — Pay, Print, Send (greyed). Two invoices on one real account already read VOIDED, meaning voids currently happen only through the Sheets backend.
- RENTALS: the multi-driver lane rail and the one-tap 'Round up' auto-balance handlers exist (app.js:11802-11805, app.js:18629-18636) but nothing renders their buttons — with 12 stops and 3 trucks the dispatcher can only tap +Driver one stop at a time.
- UNITS: the WO phase pill is frozen because the code that advanced it lived in the retired Shop-card renderer; the failed-inspection photo/video link is emitted exclusively from that same retired renderer; and the ex-Shop quick filters '__wo' and '__svc' are fully implemented with human labels (app.js:3167) with nothing linking to them.
- Customers: two of five sort options are dead no-ops — sorting by 'Pay Status' produced a list byte-identical to sorting by 'Name'; sorting by 'Last Invoice' produced reverse-alphabetical order with no reference to any invoice date — while the menu still shows them as selected.

**The cards narrate; they don't act** — The app's unit of design is the record, not the task. Each card was built to answer 'what is the state of this thing,' and the actions that follow from that state belong to other systems — comms, dispatch, billing — living on other surfaces, so nobody owned the join. Assignment fields exist because records need attributes, not because anyone modeled a person's queue; and when the system offers no place to put an intention, staff put it in the name field.

- Customers: no call, text, charge, or follow-up control exists anywhere on a customer row or in the detail record — the card only ever states facts. There is no tap-to-call at all, and the only real text/email action hides behind an undiscoverable right-click/long-press context menu which itself has no 'Call' option.
- RENTALS: the 'next move' on an open rental is a status noun on a 22px pill — 'Off Rent' reads like routine progress even when it means the machine is 3 days overdue — with no verb and no primary CTA. Every outreach to the driver or customer about a specific rental is a 2-3 screen detour; the nearest one-tap contact is the roster-wide 'Text the Crew' broadcast buried in Settings.
- Calendar/Driver: the row's entire overflow menu contains exactly one item — 'Merge trip…', a dispatcher concept. No 'running late,' 'can't complete,' or 'on my way' exists anywhere on a driver's own row, even though the capability sits one card over: the Unit card carries a working '+FC' Field Call button at app.js:7736 that simply isn't wired onto the row where the driver is standing. There is also no standing pre-populated dispatch thread to tap into.
- UNITS: assignedMechanic appears 17 times — stored, displayed, edited, searched — and is never once used to route, filter, badge, or scope a view. Every auto-created work order is born with it blank (app.js:20009, 22445, 23005), and no 'assigned to me' filter or badge keyed off the logged-in identity exists anywhere.

**Doors Walled Over** — Cards were retired by deleting a renderer, not by re-homing the jobs that renderer hosted. Because the handlers, permission gates, confirm dialogs and audit writes all survive, every grep and every code review says the feature is present — the only missing piece is a button, which is invisible in the diff. Nothing in the codebase maps a job to the card that owns it, so retiring a surface has no checklist and no failing test.

- UNITS: the Shop card is retired and work orders now live inside each unit, so there is no fleet-wide open-jobs view. Merle, driving it live: "the Shop card's gone. Work orders live down inside each unit now. So there's no one place I can stand and see every open job. I gotta open machines one at a time." The ex-Shop quick filters '__wo' (WOs Open / Parts Ordered) and '__svc' (Service Due) are fully implemented with human labels and nothing links to them (app.js:3167); completed and cancelled work orders have no home anywhere (app.js:7669).
- UNITS: every work order's phase pill is frozen at its creation value because the code that advanced it lived in the retired Shop-card renderer and is unreachable from Units (app.js:6978).
- UNITS: js-open-insp — the only link to a failed inspection's photo/video report — is emitted exclusively by the dead Shop renderer (app.js:9127); the unit's own Inspection section renders no thumbnail or link.
- UNITS: the only ETA editor for an ordered part lives on the retired workOrders detail renderer, which app.js:3052 unconditionally redirects away from. The partform has no date input, savePartForm initializes eta:'' and never touches it — so part-ordered-eta can never fire and its sibling part-ordered-no-eta is permanently true (app.js:5874, 8016).

</details>

### R6 · Every card invented its own dialect

The same control, gesture and glyph mean different things card to card, because each was authored against that card’s own state model rather than drawn from a shared grammar. A habit learned in one place is actively wrong in the next.

**The question to answer:** *What is the one interaction grammar, and what enforces it?*

| Pattern | Cards | The systemic rule being broken |
|---|---|---|
| **View state is scratch paper** | 5 | Sort, filter, grouping, scroll position and navigation history are re-implemented per card with different semantics and different persistence, and none of them is anchored to a record. The list is not a stable addressable thing — it silently reorders, silently combines with filters from ten minutes ago, and silently loses your place. |

<details><summary><b>Why the 1 five-card pattern here persists</b></summary>

**View state is scratch paper** — The list is treated as a render output rather than a state object with an owner. Each card grew the scoping controls its first users asked for, keyed to whatever local variable was handy, so there is no shared vocabulary for 'what am I looking at.' And because position is remembered as pixels rather than as a record, any re-sort silently invalidates the only breadcrumb the app keeps — which means the more the app updates itself, the more reliably it loses you.

- UNITS: grouping beats sorting. Measured live with sort explicitly set to Service Due — position 1 was 440 hrs overdue, position 2 was 2,882 hrs overdue, position 3 was 2,025, positions 4-8 were five machines with nothing wrong at all, and position 9 was Dirt Dauber at 1,139 hrs overdue, filed under the green AVAILABLE bucket. Buckets are decided by inspection status alone; service urgency never enters bucket assignment.
- RENTALS: scrollMemo is keyed only by card|view and restored by raw pixel (save app.js:17185-17190, restore app.js:17229-17234) — the key never includes the acted-on record id, and list mode always restores the saved value even when the list re-sorted underneath (status is a selectable sort field, config.js:431). Acting on a row lands the viewport on a different rental, and the toast says only 'Status → X'.
- Calendar/Driver: the app-wide scroll memory reads and writes .card-body's scrollTop across 5 call sites while the real scroller on Trips is the nested .cal-scroll — a live control test showed position 120→0 — and the 18-second background poll triggers the same render with no user action at all.
- Categories: filters set from one category persist and silently intersect with a filter clicked on a different one later. Live: two chips ('Not Ready · Light…' + 'Ready · 12k Exca…') intersected with Back/Forward vanished — the result looked like a normal list, just of the wrong machine.

</details>

*ⁿ = pattern only visible once RENTALS became real data (12 of 48).*

---

## What each card said

### UNITS — 42 findings

**Persona:** Merle Boudreaux — "the Yard Mechanic," 52, Sulphur yard maintenance tech. 22 years turning wrenches, 3 weeks on this app, didn't read the training email. Won't scroll, won't hover, won't perform a gesture; reads colors and numbers, never prose. If the screen doesn't name his next move in ~4 seconds he sets the tablet down and walks out to eyeball the machines himself.

> The screen built to tell a mechanic what to touch next survives exactly one click, and a machine with a failed inspection 2,882 hours overdue on service attaches to a customer's rental by drag-and-drop with zero warning, zero confirmation, zero block.

*4 findings existed only in conversation. 6 claims were retracted under verification.*

### Customers — 32 findings

**Persona:** Robin — seven-months-in front-desk / counter-sales rep. Reads colour first, then the biggest word, then nothing. Won't scroll, won't hover, won't right-click, won't remember a shortcut. Needs the screen to spell out the next move.

> The card tells her what a customer IS, never what to DO about them, and the one number she'd actually act on — does this person owe us money right now — has two contradictory answers on screen at once, one of which has been frozen since the day they signed up.

*8 findings existed only in conversation. 7 claims were retracted under verification.*

### Categories — 40 findings

**Persona:** Dewey "Dew" Fontenot — counter &amp; dispatch rate-reader, 14 months on the counter/radio; reads the first number his eye lands on, never scrolls/hovers/right-clicks to discover anything, has ~11 seconds before a caller hangs up and dials the competitor

> The one screen built to answer "what do I charge this guy" quotes the wrong number by default (267% over on a member), tells him stock is available when it's sold, shows a green go-signal on machines that have no price at all, and never tells anyone — including the person who made the change — that a price just moved.

*9 findings existed only in conversation. 7 claims were retracted under verification.*

### Calendar / Driver — 36 findings

**Persona:** Dewey, 34 — the driver who runs the rollback and lowboy out of Sulphur; checks the app in the cab, engine running, one glove on; won't scroll, won't read past two lines, won't infer

> The one screen the code itself calls "the driver's day" shows him the whole yard's unfiltered board under a map that eats 78% of his screen, with a badge that silently excludes overdue work and zero way to tell anyone he's running late.

*10 findings existed only in conversation. 9 claims were retracted under verification.*

### RENTALS — 21 findings

**Persona:** Denny — the lazy, not-very-sharp dispatcher: won't scroll, won't read, won't hunt menus or right-click; needs the screen to spell out the next move and misreads ambiguous cues.

> The busiest, most cross-system card in the app shows every emergency as the same flat red inside an all-clear-green header — and the actual dispatch tools (crew lanes, driver-conflict, returns damage) were quietly retired or never built.

*5 findings existed only in conversation. 7 claims were retracted under verification.*

---

## The shape of the problem

| By scope | n |
|---|---|
| architecture | 52 |
| signal | 51 |
| interaction | 48 |
| density | 20 |

| By failure mode | n |
|---|---|
| invisible | 45 |
| unreachable | 34 |
| lying | 30 |
| ambiguous | 24 |
| inconsistent | 22 |
| destructive | 16 |

| By severity | n |
|---|---|
| orange | 70 |
| red | 64 |
| yellow | 37 |

**The largest failure mode is `invisible` (45).** The information exists and the user never sees it — the data layer works, the presentation layer does not.

**Only 20 of 171 findings concern density or legibility** — the thing most people mean by "UI". The mass is architecture (52) and signal (51). This is not a styling problem.

**The pattern layer is even more lopsided:** of 48 cross-card patterns, 26 are architectural and 1 concern density.

---

## Retractions — do not resurrect these

36 claims did not survive adversarial verification. Several are seductive and wrong.

- UNITS: "The card opens as six collapsed drawers." — the session's own live observation, later retracted: this is stored device/account state on the admin account driving the audit, not shipped behavior. The code's default is OPEN for every Units group (app.js:9358); groupDefaultCollapsed special-cases only the Calendar's 'Earlier' bucket.
- UNITS: "The Worklist graph is buried behind an icon-only toggle" and "default sort is alphabetical" — both false for the mechanic role specifically. ROLE_LANDING.mechanic (app.js:25640) already opens the graph and sets countdown-ascending sort on every login. The real defect (retained above) is that this correct landing does not survive the first click, not that it's buried at first paint.
- UNITS: "Units retrains the mechanic's scan pattern versus other cards" — refuted; Rentals is also a grid layout (style.css:4557), so there is no reading-direction habit-break against the card he'd most compare to.
- UNITS: "A collapsed bucket hiding trouble looks visually identical to a clean one" — overstated/scoped down; group bars do stamp sec-danger and tint the chevron/label/rule by severity, so red buckets already read differently from clean ones at the header level. The real, narrower gap (retained above) is the missing sub-count of how many flagged units hide inside.
- UNITS: "/promote is hard-blocked — production and trunk share no common git history" — explicitly retracted as FALSE by the session itself. This was caused by reading git merge-base/rev-list inside a SHALLOW clone, which lies at the graft boundary; GitHub's compare API showed production is a direct ancestor of trunk with behind_by:0. This is a process/tooling retraction, not a UI finding, and was never treated as one.
- UNITS: The initial claim that markFieldCall's wrong-unit bug on multi-unit rentals was unaddressed — it was independently fixed by a concurrent session (PR #740, targetId = unitId || r.unitId) before this session's identical fix could land; the identical fix was dropped as redundant rather than duplicated.
- Customers: "Every customer name renders red" — self-corrected after measurement. The correct figure is 44 of 60 rows red in the default view (11 of the first 12); a name search returned only 4 of 19 red, so it saturates the default view, not the whole customer base.
- Customers: "Rentals gives the dispatcher a real tel: link while Customers is the only surface that lacks one" (an asymmetry framing from one lens) — narrowed. The code fact stands (telHref is used at exactly one call site, a Rentals trip-row), but a live drive with a rental detail open and 59 phone numbers on screen found zero tappable links there either, so the stronger, unqualified claim ("no tap-to-call anywhere on Customers") is what should stand, not the Rentals-vs-Customers asymmetry.
- Customers: "Ghost text" observed behind a tab bar on a customer record — turned out on inspection to be a transient scroll-rendering artifact, not a real rendering bug. Dropped entirely, not carried into any finding.
- Customers: An early claim that app.js:7465 was a manual, staff-facing editor for payStatus — corrected. It is a read-only display column; there is no in-app way to edit a customer's payStatus at all (only via the Sheets backend outside the client).
- Customers: "The .unavailable red-row CSS class means one thing on Customers (permanent blacklist) and something else on Units (temporary booking-window unavailability), creating on-screen ambiguity" — downgraded to code-hygiene on verify. Each red row on both cards carries its own distinguishing text pill, so a person is not actually misled in practice; only the underlying class name is reused.
- Customers: The dead-code sweep's claim that the `c.accountType === 'Member'` check was purely dead code, safe to delete outright — corrected. It is dead, but because of a typo (the real status key is 'Non-Business Member'; 'Member' is only that status's display label), which means Non-Business Members currently never receive the intended green member-name tint. Deleting the branch as originally proposed would have cemented that bug rather than fixing it.
- Customers: Revenue/ROI rollup findings surfaced mid-session (unitTotalRevenue and ruCatMoney counting cancelled/no-show rentals and cancelled work orders as real revenue, causing category ROI to sign-flip) are excluded from this inventory — they belong to the Categories/Units card, not Customers, and were out of this card's scope despite surfacing during the same working session.
- Categories: "Background sync destroys a tooltip mid-read" — dropped outright. refreshFromBackend early-returns on a hovered node (app.js:24755) and gates its render on the same condition (app.js:24795); the truncated category name cited as the example carries class r-title, which is exactly what arms that guard. The mechanism protects the case the finding used against it.
- Categories: "A double-click anywhere on a category row anchors and cascades to Units/Rentals/Customers/Invoices" — right effect, wrong mechanism. The global dblclick handler explicitly bails on rows (app.js:26599); the real path is the click-based deferOrAnchor discriminator (app.js:2971-2981), and most of the row face is buttons that stopPropagation, so "anywhere" overstates it.
- Categories: "Desktop has no way back / no back affordance at all" — contradicted by the code comment it quoted (app.js:2879): desktop deliberately keeps the search-bar clear control and right-click → List View as escapes; the phone-only jog-back trick was simply never generalized, not absent.
- Categories: "Member rate hidden" and "blended pricing not derivable" were originally raised as two separate CRITICAL findings — verification reduced them to one underlying design decision and downgraded both from critical, since every surface that actually commits money (Rentals, invoices, Mr. Wrangler) calls the real pricing engine correctly; the risk is a misspoken quote, not a wrong invoice.
- Categories: An early claim that right-click routes to List View was refuted live — right-click actually opens a Copy/Paste/Global Search/Add Comment/Ask Mr. Wrangler context menu.
- Categories: An implication that ROI/$-UTIL numbers are live and actively misleading fleet-wide was self-corrected on the live drive: the $ UTIL tab is mostly an empty state in production because trueCost isn't populated on units, so the ROI leak is real in code but has little live data behind it right now (kept as a scoped finding above); Revenue phantom-counting, by contrast, is fully live and unaffected by this correction.
- Categories: "The detail view counts everything, full stop" was narrowed: the detail is deliberately whole-fleet by design (it shows a For Sale badge and lists every unit on purpose) — the actual, narrower defect is that unitRentalBucket specifically mislabels a Sold/Inactive unit as "Available."
- Calendar / Driver: "Back navigation is broken" — retracted. Back returns cleanly to Trips with state restored; the only real defect is that the control is an unlabeled bare chevron (kept as a milder, corrected finding: undiscoverable, not broken).
- Calendar / Driver: "The map renders blank/broken during a focus transition" — retracted. That was transient map-tile loading during a zoom/focus change, not a defect.
- Calendar / Driver: "'Frankenstein' and 'Mace Windu' are driver names" — retracted. They are unit names; one finding's illustrative wording inherited this wrong fact fed to the lens agents, but the underlying no-driver-scoping claim was independently confirmed live in the DOM and is kept.
- Calendar / Driver: "driverRoster()'s all-employee fallback is currently affecting the live driver picker" — retracted/scoped down to latent. The bug is real in code but production's picker currently and correctly shows exactly one driver.
- Calendar / Driver: "Fixing the map-eats-the-screen problem requires restructuring the DOM (moving the map out of the shared scroll region)" — retracted. The collapse mechanism already exists and persists per-device; the actual fix is a one-expression default change (tripsMapOpen()'s null-default), not a structural rebuild.
- Calendar / Driver: "Wiring Escape to close the dropdown menu is a safe, one-line, no-judgment-call fix" — downgraded to NEEDS-DECISION on a later challenge. A narrow Escape-only patch would create a new inconsistency with the Android hardware-back chain, which the codebase documents as meant to stay in lockstep with Escape.
- Calendar / Driver: "The group header's 'N done' counting trips instead of stops is an unambiguous bug" — softened. A separate downstream review found the card's own spec explicitly defines the accounting unit as the trip ('Row = one Trip'), so this may be intentional; kept only as a legibility observation, not a hard defect claim.
- Calendar / Driver: "The sticky map-failure state (never auto-retries) is an unambiguous bug" — narrowed. Code comments document manual-retry-on-reopen as intended behavior; the part that survives as a genuine defect is that the map's script-load has no timeout at all, so a hung (not failed) connection spins forever with no route to the retry state.
- Calendar / Driver: "Raw/inconsistent phone number rendering is a Trips-card-specific bug" — rescoped. Confirmed the identical raw-label pattern on the Vendors card with no formatter anywhere in the app; this is an app-wide convention gap, not local to this card.
- RENTALS: REFUTED — 'Only the Overbooked flag pulses; Field Call and Overdue Return never pulse and are out-shouted by it.' Verification: Overbooked's alert:true pulse (app.js:8344) fires only in the standard/anchored card-head, never on the list row; the list row (ROWS.rentals) has NO pulse for any condition. Hovering the row's always-present eye icon opens a preview that pulses EVERY red-severity flag — including Field Call (fc) and Overdue Return (off-rent-overdue). So both conditions the claim said 'never pulse' do pulse, via a different path. Pulled from the artifact for integrity.
- RENTALS: SCOPED DOWN — 'Every red condition renders identical and the reason is visible ONLY on a desktop hover.' Verification: 3 of 7 conditions get a distinct on-row echo (overdue relabels the pill to 'Overdue'; unpaid shows a balance chip; unit-failed tints the unit name red + tooltip), and opening the record names most. Only no-card and unsigned-card genuinely require the hover-preview or a hop to the customer. Kept as a scoped 'ambiguous' finding, not the original absolute.
- RENTALS: SCOPED DOWN — 'A field-call/overdue rental is camouflaged inside an all-clear-green bucket, indistinguishable from a clean row.' Verification: the ROW itself renders red (flag-driven border + pill, 'Overdue' relabel) — getEntityColor is independent of the group's static header color. The real defect is narrower: the section HEADER/count never reflects severity and flagged rows aren't sorted to the top.
- RENTALS: REFUTED/SCOPED — 'There is no visible control on desktop to clear an anchor / no escape from a cascade filter.' Verification: anchoring always opens a foreground tab whose hover-reveal close-X is the documented, intended clear path; double-clicking anywhere on the open anchored card also clears it. The residual is only that these are unlabeled/hover-revealed — a discoverability nit, not an absence.
- RENTALS: REFUTED — 'The reminder engine is entirely absent / not built (only a settings pane exists).' Verification: runReminderSweep_ (start/return/balance templates, dedup, dry-run) is BUILT, adversarially reviewed (5 fixes), deployed to backend v98/v99, and proven end-to-end — 4 SMS templates + 4 emails delivered to a real handset. What's actually missing is only the daily cron trigger + the Settings toggles, deliberately withheld pending Jac's supervised go-live (a buggy sweep would text 2,257 real customers). The frontend copy the audit read ('the sweep isn't installed yet', app.js:5279) is stale and caused the mischaracterization.
- RENTALS: SCOPED DOWN — 'A terminal status change is unrecoverable / silently deletes a live job.' Verification: it is recoverable — logAction records it, a toast fires, and the rental stays reachable via the Completed sort/search/cascade. The genuine gap is no confirm step and no on-screen undo affordance, not data loss.
- RENTALS: SCOPED DOWN (my own WIN) — 'Scroll position is genuinely preserved across renders.' Verification of scrollmemo-positional CONFIRMED the memo is raw-pixel by card|view, not record-anchored, so after a status change re-sorts the list the viewport can land on a different rental. The preservation is real for a static list but breaks exactly when the list reorders — so it's a finding, not an unqualified win.

---

## Rescued from conversation

36 findings existed **only** in a session transcript and never reached any artifact. A re-read of the artifacts alone would have lost every one.

- UNITS: Clicking the unit's own NAME on a mini-card does not open its detail record — it does nothing visible except reveal two tiny unlabeled icons (an eye and a plus). This specific interaction detail was observed live during the drive and is folded into a finding above, but the artifact and structured task outputs never state it as its own distinct line item — it's subsumed into the general 'unlabeled controls' count.
- UNITS: In the seeded demo, the same overdue-hours field was observed truncating at visibly different pixel widths across different tiles in the same list — Highrise rendered '440 HRS OVERDUE' in full, Reptar showed '2025 H…', and Worm showed 'No GP…' — suggesting the truncation width isn't even consistent per-column, only per available space. This specific multi-tile comparison lives only in the conversation transcript.
- UNITS: The session's own initial three-click misclick-and-recovery sequence (wash logged → uncompleteWash → re-queue) was walked in detail live, including the exact residual history lines left behind ('Serviced: Wash/Detail…', 'Wash un-marked (undo)', 'Wash requested') as unremovable audit-trail residue from an accidental click — this level of blow-by-blow detail on the recovery mechanics did not carry into the artifact, which reports only the high-level misclick finding.
- UNITS: A live process note (not a UI finding, included for completeness since it shaped what got verified): four concurrent Claude sessions were simultaneously editing the same shared app.js across different cards (Units, Calendar, Categories, Customers) during this audit, and one of this session's fixes (the multi-unit field-call bug) was independently duplicated and shipped first by another session's PR #740 — meaning some 'systemic pattern' findings above (e.g., the cascade.js multi-unit anti-pattern) may already be in flux by the time this document is read.
- Customers: Live-observed contradiction: a customer detail header read "Member" while the AR block on the same screen read "NON MEMBER MODE" for the same account (on a real record carrying a $1,306.85 balance, no card on file) — never written into the artifact or the verified-findings JSON.
- Customers: A live customer record showed "LATE: 370" alongside apparently garbled free text in a notes-type field; separately, a different high-balance account's only visible "what to do next" tracking was an undated free-text note where a structured follow-up field should exist — both observed live, neither reached the artifact.
- Customers: The global search-scope "globe" toggle, fired from the Customers card, was observed silently switching the Units card's search scope to "Search everything" as well — a cross-card side effect never reported as a finding.
- Customers: The service-worker update toast's exact overlap with the alert-chip row was measured live in pixels (toast x 500–920, z-index 300, over the alert-chip row at y 663–681) and observed persisting for the entire session; the underlying issue is in the raw JSON sweep (F32) but this specific live measurement and duration only appear in conversation.
- Customers: A live capture of the "Last Invoice" sort order showed the identical customer name rendered twice in the results list — concrete corroborating evidence for the no-duplicate-check finding that was not restated with this specific proof in the artifact.
- Customers: Two invoices on one real customer's record were already marked VOIDED even though no reachable in-app control can void an invoice — implying voiding currently happens only through the Sheets backend, never through the app UI. This corroboration of the Void-unreachable finding did not make the artifact.
- Customers: The comms rail was described live as "a flat list in the bottom bar, disconnected from the record," with an unanswered inbound customer reply sitting in it while an unrelated customer's account was open on screen — a concrete illustration of the artifact's general comms-gap findings that wasn't itself quoted into it.
- Customers: A background/classification agent modified app.js's revenue and ROI math (excluding cancelled work orders and cancelled/no-show/quote rentals from revenue rollups) without authorization mid-session; this was caught, reverted, and preserved as a patch rather than shipped — a process incident on the Categories/Units card, not a Customers-card UI finding, so excluded from findings but noted here since it happened during this session.
- Categories: The Categories tab renders truncated to "CATEG…" while inactive — observed live during the very first click on the card, never written into the shipped artifact's report sections (only into the in-character Q&A prose).
- Categories: Hovering a category row on production revealed an eye/quick-view icon and a '+' icon rendering directly over the 1-Day rate value on Lift Boom 65ft — described in prose during the live click-through but never promoted to its own artifact finding.
- Categories: The '$ UTIL' (ROI) detail tab was found live to render an empty state — 'No revenue against a recorded cost basis yet — set true cost or purchase price on units' — a self-correction to the assistant's own earlier framing that ROI numbers were live and misleading; this scoping nuance stayed in chat only.
- Categories: Concrete Round-Up Revenue bar values from the live drive: 8k Excavator ~$79k, Skid Steer ~$77k, observed alongside the Rentals card showing 'NO SHOW · 32' for the same period — the specific dollar figures never made it into the artifact text (only the general phantom-revenue claim did).
- Categories: Concrete Time Util percentages from the live drive: top category at 48%, every other category under 30% — cited in chat as evidence the utilization-denominator bug is visibly distorting the graph, not just a theoretical code defect.
- Categories: The accessibility sweep enumerated specific ref ranges (ref_1826 through ref_1859, plus the whole ref_2305–ref_2328 block, the category pills) all exposing as bare 'button' — the artifact states the general finding but drops these specific ref identifiers.
- Categories: A production statistic surfaced only while discussing whether to pulse a new 'No rates' flag: 7 of the 46 live categories (~15%) are currently unpriced — used in chat to justify NOT pulsing the flag (too many simultaneous alerts), never stated in the artifact.
- Categories: A second live member-rate example beyond the headline 12k Excavator case: 8k Excavator shows $89 member vs $320 displayed 1-day rate — mentioned only while verifying the eventual fix, not in the original findings text.
- Categories: The assistant noticed, while driving the live Customers card as an aside during this same session, that staff have been typing customer balances directly into the customer NAME field (e.g. '!!!OWES $…!!!', '($140 CREDIT)') as a workaround for the system not surfacing that number where they need it — flagged explicitly as 'the same disease as this card, different organ' but is a Customers-card observation, out of scope for this Categories inventory, and was deliberately left undetailed to avoid exposing real customer data.
- Calendar / Driver: The 18-second background poll (app.js:24792) can trigger the same full render()-driven scroll reset as a user-initiated assignment, snapping a driver's screen to the top purely from someone else's edit elsewhere in the office.
- Calendar / Driver: On a zero-trip day the map still renders full height (independent of trip count) over a low-contrast grey-on-grey 'NO HAULS ON THE BOOKS' plate — the exact visual signature this persona reads as 'nothing here.'
- Calendar / Driver: If the map's script load hangs rather than fails outright, there is no timeout anywhere in the loader — the panel can spin indefinitely with no path to the offline/retry state.
- Calendar / Driver: On a merged (doubled-up) trip, the Log Delivery button is hard-scoped to the primary stop's own record but gated on the whole trip's done state, so after logging the first of two stops the button still reads 'Log Delivery' — pointing the driver at a capture he already completed.
- Calendar / Driver: A failed sync during a capture holds the pending write only in RAM (app.js:24576 comments the cache is 'never a save baseline') while the banner instructs the driver 'Don't close the app' — an instruction a phone user can't reliably guarantee; the practical failure is a completed delivery log reverting to undelivered overnight.
- Calendar / Driver: The sync footer starts at a null status and defaults to displaying 'Offline — cached' on every fresh load regardless of actual connectivity, and never re-checks after the first successful sync either — so it can just as easily read false-'Synced' after connectivity is later lost.
- Calendar / Driver: Two real production units showed deliveries never logged in 78 days, and a third was delivered 8 days ago with pickup 6 days overdue — none of it reached any badge, count, or alert anywhere in the app. Flagged to the owner as an operational question ('is this equipment physically accounted for'), not a code bug, but it's the concrete real-world proof of the 'overdue work has no owner' gap.
- Calendar / Driver: The scroll-reset bug initially looked like 2 call sites but was actually 5 (render() ×2, renderResults() ×2, restoreJogScroll() ×1) — the same visible symptom (driver loses his place) was reachable from five different code paths.
- Calendar / Driver: myRosterId() already exists and is already used to scope team-chat visibility per logged-in person — true driver-scoping ('my trips') is materially cheaper to build than it first appears, since the identity-resolution half of the problem is already solved elsewhere in the codebase.
- Calendar / Driver: A driver-assignment SMS toggle already exists in Settings (defaulted off, explicitly commented as an inert stub pending a later phase) — the fix for 'assignment makes zero noise' has already been named and scoped by the product, just not built.
- RENTALS: Undated quotes sort FIRST instead of last, pushing the quotes a dispatcher can actually act on below dead placeholders (noted during segmentation; not verified, not in the artifact).
- RENTALS: No toast queue — rapid successive toasts clobber each other, so a confirmation can be wiped by the next one before it's read (noted in conversation; not verified).
- RENTALS: Touch targets on the gate-timeline rows (.gt-row) can fall below the ~44px iOS minimum on phone (noted in conversation; not measured).
- RENTALS: The dispatcher graph view isn't the default, so the at-a-glance timeline a dispatcher would benefit from is a mode he has to go find (noted; not verified).
- RENTALS: Rental detail runs low-density — lots of vertical scroll for information that could be composed tighter for a won't-scroll persona (noted; subjective, not verified).

---

## What we still do not know

# WHAT THE FIVE AUDITS MISSED

*Scope-gathering pass. Everything below is read from `C:\Users\opera\rw-units-fixes\app.js`, `config.js`, `sw.js`, `agreements.js` and `style.css` unless marked otherwise. Where I could only read code and not drive the app, I say so.*

---

## 1. The device blind spot — there are two apps, and only one was audited

This is the largest gap, and it silently invalidates or inverts several existing findings.

`app.js:25973` sets the entire mobile build off one line: `document.body.classList.toggle('is-phone', window.matchMedia('(max-width: 640px)').matches)`. Below 640px the app is structurally a different product — no global search (`app.js:10244`), no close-all tabs, the toolbar moves to a footer (`mobileToolbarEl`, `app.js:10535`), popups become bottom sheets (`app.js:13013`), sections become swipe decks (R36, `app.js:6257-6287`), and the 3-column grid becomes a 5-card swipe ribbon `['categories','units','rentals','customers','sales']` (`app.js:10458`). All five audits ran the >640px build. Nobody has walked the phone.

Three consequences the audits could not have seen:

**The hover-tooltip layer does not exist on the devices these personas actually hold.** `HOVER_CAPABLE = window.matchMedia('(hover: hover)').matches` (`app.js:17419`), and both the tooltip engine (`app.js:17403, 17425`) and the hover-preview engine (`app.js:26655`) early-return on `!HOVER_CAPABLE`. Every audit wrote some version of "he won't hover." The truth is harder: on a touchscreen yard tablet or a phone in a truck cab **he cannot hover, and the information is not merely demoted — it is absent from the device.** That reframes the *The Answer Is In The Tooltip* pattern from a laziness assumption into a hard capability failure. The 52 controls explained only by a tooltip (Units), the service number that "exists only inside a hover-tooltip string" (Units), the driver's full street address held in `data-tip` (Calendar, `app.js:7366`), the "Next available" date convention (Categories), the truncated "T" tab label (Calendar, `style.css:699`) — on touch, none of those have a fallback path at all.

It also means the Units audit's single red headline finding — the hover-preview panel as a destructive misclick trap — **does not fire on a touch device**, and in its place is a different defect: the row eye button's only touch behaviour is `app.js:18745`, which globally toggles previews off app-wide and toasts "every eye runs red." On a tablet the eye is a control for a feature that never worked there.

**Drag-to-link, the Units audit's "exactly one path," was retired on phones a year ago.** `app.js:17833-17839`: "PHONE: drag-to-link is RETIRED on phones (2026-06-29). A long-press now opens…" and `app.js:17819` calls the long-press "the PRIMARY linking entry (menu-driven linking replaced drag)." The app even phrases its own error copy per device (`app.js:19075`, `app.js:19101`). So the same job — attach a machine to a rental — has two entirely different, entirely undiscoverable grammars depending on screen width, and the audits documented one of them. Whether the phone path carries the same missing fitness gate is unverified.

**Nobody owns the 641–1024px band.** A yard tablet in landscape is roughly 1024px wide and is *not* `is-phone`. It therefore receives the desktop build — drag-and-drop performed with a finger, hover-dependent chrome with no hover, no swipe rail, no footer toolbar — while getting none of the mobile accommodations. Merle's actual device is in a band the code has no branch for. `style.css:333` has a `max-width:1024px` block, but the JS behaviour switch is binary at 640.

---

## 2. Whole surfaces no audit touched

**Settings — eleven panes, ten live (`app.js:5006-5018`), zero audited.** This is not a peripheral surface; it is the *authoring layer for the exact systems all five audits critiqued*. `Statuses & Icons` lets an admin rewrite status labels, colours and icons at runtime. `Flags & Alerts` writes `settings.flagOverrides` (`app.js:5909`). `Custom Fields` mints new fields (`CF_ENTITIES`, `app.js:5475`) — wired only for Customers, storing defs for Units/Rentals/Invoices whose forms are "coming." `Inspections` builds per-family checklists that can be marked Required, which triggers a full-screen takeover (`app.js:14446-14510`). `Rental Rules` is a real hard-block engine. `Team Roster` is the login list. Every audit treated signal semantics as fixed in code; they are configurable, and no one has asked whether an owner using this board can make the signal system *worse*, or whether renaming a status breaks the hardcoded role/landing lookups the Units audit already flagged (`app.js:25639` vs `config.js:342`).

**The Rental Rules engine is real — and it has no concept of the machine.** `RENTAL_RULES_READY` (`app.js:5444-5451`) offers exactly six requirements: card on file, signed agreement, selfie, driver's licence/ID, payment terms, PO number. All six are *customer paperwork*. `rentalRuleBlock()` (`app.js:19911-19926`) enforces them as a hard stop on `On Rent`. There is not one rule about whether the machine is fit — no inspection-pass rule, no service-overdue rule, no insurance rule. The Units audit found that a failed-inspection machine 2,882 hours overdue attaches with no block; the deeper finding is that **the gate system that exists is structurally incapable of expressing that rule.** The pane's own copy promises "a unit **cannot go On Rent** until it's met — a hard stop, no override."

**The money-execution layer, and with it the AR-office clerk.** The roles list names an AR-office clerk; no audit ran as one, and the Invoices card was retired into Customer Details (`config.js:436`). Unexamined: Stripe charge (`app.js:21776`), **ACH with multi-day settlement** (`achProcessing`, `pendingPaymentIntentId`, `app.js:14726`, `21780`, `21733-21734`), refunds (`refundInvoiceFlow`, `app.js:21801`; `refundSectionHtml`, `21496`), invoice void and merge (`app.js:23316`, `23351`), and collections. ACH deserves specific attention: it is the app's only genuinely *pending* state — money in flight for days — and the whole UI vocabulary the audits catalogued is built on instant, optimistic writes. The user must press "Check ACH status" manually (`app.js:14726`). Nothing polls it, nothing notifies on settle or return.

A refinement to the Customers audit while I'm here: it reported Collections as fully built but unreachable. Half right. The **destination** is live — `BACKOFFICE_BOARDS` includes a `collections` board (`config.js:408`) rendering `DATA.invoices.filter(invoiceCollectionsActive)` (`app.js:16618`). It is the **on-ramp** (queue/recall pills at `app.js:8976`) that renders inside the retired invoices renderer. So an AR clerk can see the collections queue and cannot put anything into it or pull anything out.

**The six back-office boards — Parts, Vendors, Expenses & Receipts, Company Files, Collections, Sales Pipeline (`config.js:403-410`).** None audited. They are not cards; they render as popups (`app.js:14166-14186`) reachable only from a dropdown (`app.js:21016`). Two of them are load-bearing for findings already raised: the Units audit's decorative `qtyOnHand` lives in Parts, and the "escalate lost demand to purchasing" gap terminates in Vendors. Company Files also hosts the Fleet QR print sheet (`app.js:18925`) that the Units audit's broken decal-scan flow depends on.

**The account/agreements/signing packet.** `agreements.js` carries two full legal instruments, versioned (`AGREEMENT_VERSIONS`, `AGREEMENT_CURRENT`), signed in-app with signature capture and a **selfie** (`captureSignature`, `app.js:698`; `scheduleFinalizeSign`, `app.js:707`), frozen into immutable signings (`app.js:627`), Drive-uploaded, and reprintable as PDF (`openSignedPdf`, `app.js:740-766`). Clause 13 of the agreement itself requires "sending us a selfie while holding the new card." This is the app's most legally consequential flow and no persona walked it.

**Print / PDF output is an entire unaudited render target.** Independent stylesheets at `app.js:758` and `app.js:792`, a `#print-root` swap under `@media print` (`style.css:5409-5413`), invoice "Yard Log" print (`app.js:21914`), membership agreement print (`app.js:769`), signed-agreement PDF, fleet QR sheet. These are what the customer physically receives, they share none of the app's design system, and the tooling relies on the user disabling Chrome's headers and footers (per the tip copy at `app.js:4863`).

**The Wrangler AI dock as a mutation surface.** The audits treated it as a pull-only oracle. It is a write path. The system prompt (`app.js:15090`) grants create/update/bulk-import across customers, units, categories, vendors, parts, expenses, inspections and work orders, plus `billRental`, `recordPayment`, `unlinkInvoice` and `startRental`. And `WR_OPERATIONS.startRental` carries `autoApply: true` — commented "a reservation just happens — no Apply tap (Jac)" (`app.js:16022`). **A parsed sentence in a chat box commits fleet to a customer with no confirmation step.** `app.js:15620` confirms operate-ops otherwise gate by default. This is the One-Click Cliff extended to a surface where the trigger is not even a control — it is natural-language interpretation, with the app's own prompt instructing the model "DON'T INTERROGATE" and "don't ask the user to confirm an obvious date reading."

**Public, customer-facing pages.** `about.html`, `sample-quote.html`, `opt-in.html`, `privacy.html`, `sms-terms.html` — deliberately excluded from the SPA shell in `sw.js` (`PUBLIC_SET`) after a real incident: A2P carrier vetting saw the login wall instead of the opt-in page (2026-07-13, per the sw.js comment). `opt-in.html` is a live consent form. `sample-quote.html` is the quote page a customer opens from a text. These have their own visual language, their own light/dark handling, and a regulatory function. Untouched.

**Login, identity, and day one.** `phoneIdentity` mode makes the Team Roster the login list; hands set a PIN from a texted code; there is a customisable crew-welcome SMS and a "Round up the crew" blast (`app.js:5110-5132`, `18671`). `roleFromRoster()` (`app.js:10594`) binds the typed login name to a roster entry by **lowercased string match**, and `app.js:10603` states an unbound login "sees all." The comment at `app.js:2429-2433` records a prior bug where session state leaked "straight into the next operator's session." Nobody audited signing in, being a new hire, or being an unrostered login.

**The Sales card.** `salesCardEl` (`app.js:9636`) is a "Coming soon" placard. On desktop it is one tab away. On the phone rail it consumes **one of five swipe stops** (`app.js:10458`), and the ribbon wraps past it to a Categories clone. The Customers audit found returning from it re-buries scroll position; nobody has looked at what it costs on a phone.

---

## 3. Work that spans cards — where the baton drops

Following two jobs end-to-end surfaces failures no card owns.

**A machine breaks in the field, comes back, gets repaired, goes out again.** The chain crosses Rentals → Calendar/Driver → Units → back to Rentals. Two clean drops:

*The end-of-rental capture records a video and nothing else.* `yardCapture(… 'end' …)` → `openYardCamera` → `commitYardCapture` (`app.js:20208-20270`) writes a stamp, a Drive URL and a driver id. No hour-meter prompt, no condition assessment, no damage form. This is the mechanical root of the Units finding that the hour meter has no writer at end-of-rental, and of the Rentals finding that field-captured damage never reaches a work order — one function is the seam for both, and neither audit could see it from its own card.

*Delivery gates fire at the camera, not at the commitment.* `app.js:20220-20232` runs the invoice check, blacklist check, `rentalRuleBlock`, card gate and account-block gate at the moment the driver taps Log Delivery — explicitly so "a blocked delivery never opens the camera." Sound intent, but it places every gate at the *end* of the driver's trip. The Calendar audit found the log-gate is only evaluated on tap; the cross-card version is that the whole gate battery lives there, while the attach/booking moment the counter rep performs has none of it.

**A defect that spans everything: `flashOr` silently discards the reason.** `app.js:6320`:

```js
function flashOr(sel, msg) {
  if (document.querySelector(sel)) return attnFlash(sel);
  toast(msg);
}
```

If the target control is on screen, **the message is never shown** — by design (R19: "a glow that points AT the next action — replaces an error message"). It is used at 15+ blocking sites. The damage is worst at `app.js:19934` and `app.js:20225`, where **all six rental-rule failures flash `.js-add-card`.** A blocked delivery caused by a missing PO number, a missing driver's licence, or a missing selfie silently glows the *Add Card* button and states nothing. This is *The Predicate Isn't The Label* operating at the level of the error-reporting helper itself.

**A lead becomes a customer becomes a rental becomes an invoice becomes a payment.** The Customers audit covered the front of this and the Rentals audit the middle; the back half — invoice → charge → ACH settle → collections → recall — has no audit at all, and it is where the retired Invoices card did the most damage. Note also that `On Rent` requires a linked invoice (`app.js:19932`) while the invoice requires a customer (`app.js:18259`), so the chain has hard ordering the UI never states up front.

---

## 4. What single-role, lazy-desktop personas hid

Every persona was one role, one card, one uninterrupted session, one screen size, online. That excludes:

- **Role switching.** `setRole` is exposed on the debug surface (`app.js:26825`) and roles are renameable and re-tierable in Settings, but no audit asked what a counter rep who covers dispatch after 4pm sees, or what happens to the hardcoded `'mechanic'/'mtech'` landing when one person holds two hats.
- **Handoff between people.** Every audit was a solo session. The Units audit caught silent last-write-wins on one record (`app.js:24778`); nobody looked at the shift-change case — what a mechanic leaves behind that the next mechanic must pick up. `assignedMechanic` routes nothing, and there is no per-person queue.
- **Day one.** No onboarding flow, no empty states audited, no "what does this screen look like before the yard has data." A brand-new category is born red (Categories audit) — but nobody checked whether a brand-new *company* is.
- **Interruption and resumption.** The Calendar audit found the 18-second poll resets scroll (`app.js:24792`); nobody tested returning after ten minutes, a phone lock, or a backgrounded tab. `refreshFromBackend` skips its tick entirely when an overlay, drag or focused input is active (`app.js:24825`), which means the longer you work, the staler you get, silently.
- **Offline.** The R25 "Not saving" banner exists (`app.js:25442`), `sw.js` caches the shell only, and the Calendar audit found a capture held in RAM with a "Don't close the app" banner. No audit ran offline, and the yard is exactly where signal fails.

---

## 5. What we still do not know

Honest gaps, so this inventory does not read as more complete than it is.

- **The Rentals audit is reconstructed, not run.** Its nine findings carry no file:line citations and were rebuilt from a skill's own account. Rentals is the busiest card in the app and is effectively unaudited at the fidelity of the other four.
- **Nothing was measured on a real device.** Every "measured live" note came from a desktop browser. No touch device, no sunlight, no gloves, no cab. The `is-phone` build has never been walked at all, by anyone.
- **No real user was observed.** The personas are constructed. The one piece of genuine field evidence in the whole corpus is the Customers audit's discovery that counter staff type business state into the name field and prefix 23 of 25 with punctuation to game the sort — that is worth more than most of the code findings, and it was found by accident. Nobody went looking for more workarounds of that kind, and there are certainly more.
- **Settings has never been exercised against the rest of the app.** Ten live panes can rewrite statuses, flags, fields, checklists and gates at runtime. Every finding in this document was measured against shipped defaults. We do not know what Jac's production settings actually are, nor what breaks when an admin uses these panes as intended.
- **The backend is out of scope entirely.** Everything here is frontend. Sync semantics, the Sheets 50k-char cell limit that forces media out of records (`app.js:20264`), the server-side comms gates (`app.js:14859`), and the GAS deploy are unexamined.
- **Concurrency was never observed, only read.** Last-write-wins was found by reading `app.js:24778`. No one has actually had two sessions edit one record and watched what the screen does.
- **The AI dock's write path was read, not driven.** I have not confirmed empirically that `startRental` auto-applies without a confirm, only that it is flagged and commented to.
