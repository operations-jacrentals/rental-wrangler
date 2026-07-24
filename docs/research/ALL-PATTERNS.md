# All 48 cross-card patterns

Sorted by how many cards each spans. ⁿ marks patterns only visible once RENTALS became real data.

## 1. Every number has two authors

**5 cards** · scope: `architecture` · UNITS, Customers, Categories, Calendar / Driver, RENTALS

The same fact is computed independently by two or more renderers with different predicates, and both results ship to the same screen. There is no single derive layer, so the app contradicts itself inside one viewport — and the drill-through from a number lands on a differently-filtered set than the number counted.

**Why it persists:** Derivation lives inside renderers instead of in a shared, named selector every surface must call. When someone corrects a definition they correct the renderer in front of them — the mini-card gets the fleetStatus fix, the detail does not — so each fix increases the number of disagreeing definitions rather than reducing it. Nothing in the codebase makes 'availability' or 'amount owed' a single addressable thing, and nothing fails when a fourth caller invents a fifth definition.

**The question a UI system must answer:** *Where does a derived fact live so that every surface showing it — tile, detail, header, graph, sort key, filter, drill-through — is forced to read the same function, and a click on a number is guaranteed to return exactly the rows that number counted?*

**Instances:**

- Customers: the row computes live owed/overdue from real invoices every render while the group header, sort, filter and pulsing detail flag all read a stored payStatus written once at signup — a repo-wide grep found zero write sites outside the five creation paths, and the team's own spec (docs/specs/customers-crm.md:642-650, dated nine days before the audit) already calls it an open question. Two contradictory answers to 'does this person owe us' sit inches apart.
- Categories: same category, same second — 12k Excavator mini-card reads 'NEXT MON' (zero free) while the detail reads '9 Available'; Lift Scissor 19ft reads '2 Avail' vs '5 Available', the 3 extra being sold machines. A comment at app.js:7212 shows this exact bug class was fixed on the mini-card on 2026-06-25 and the fix never reached the detail renderer.
- UNITS: the Worklist graph reads 'NOT READY 28' while the group bar ~40px below on the same screen reads 'NOT READY · 8' — the graph tallies all of DATA.units (app.js:12167-12170), the list excludes out-of-fleet and on-rent units first (app.js:9295), and unitsAlertCount (app.js:9479) holds a third, narrower definition.
- UNITS: the Work Orders bar counts one entry per open WO but the click-through filters units — a unit with 2 open WOs is one row and two counted, so the number structurally cannot match the rows beneath it.
- Customers: on one real account, a chart callout reading '$47,720 · BEST · APR' sat beside a Transactions tab reading '$2,834.84 collected, 1 payment, 0 refunds' — roughly 17x apart, different basis, different period, both on screen, nothing saying which to trust; the caption beneath still read 'No rental cadence yet.'
- Customers: on a live account carrying a $1,306.85 balance, the detail header displayed 'Member' while the AR block directly below displayed 'NON MEMBER MODE.'
- Categories: clicking the 'Off Fleet' stock-count segment routes to Units, but cardListEl strips every non-Active unit before the per-card filter runs — the segment produces a correct filter chip with no console errors and the list renders 'No Unit.'
- Calendar/Driver: the Trips tab badge counts only stops dated today-or-later that aren't done, so every undone past-day trip contributes zero to the one number the driver glances at.
- UNITS: WO phase pills render raw w.phase while the app's own comment (app.js:22610-22613) states the displayed status is meant to be derived — the Worklist graph (app.js:12170) and a list filter (app.js:3169) both bucket on the frozen raw value instead.

## 2. Nothing warns you before the point of no return

**5 cards** · scope: `interaction` · UNITS, Customers, Categories, Calendar / Driver, RENTALS

Preconditions and consequences are evaluated at commit time and nowhere before it. The UI never says an action is blocked, irreversible, or wrong until after you've taken it — and the app's own confirm/arm/review patterns are hand-applied conventions, so identical-looking controls a few lines apart behave completely differently.

**Why it persists:** Gates were written as guards inside commit handlers — the correct place to enforce them and the worst place to communicate them. Because the gate's answer is never computed at render time, the control cannot know it is disabled; and because confirm/arm/review are conventions applied by hand rather than properties of a destructive-action primitive, whether a given button asks first is decided one button at a time by whoever wrote it.

**The question a UI system must answer:** *How does an action publish its own preconditions and reversibility to the control that triggers it — so a blocked action renders blocked, a costly one renders armed, and the moment of commit stops being the first time anyone learns either?*

**Instances:**

- RENTALS: the invoice hard-gate fires only for val==='On Rent' (app.js:19911) and the blacklist/rules/card/account-block gates are all scoped to BOOKING_STATUSES ['On Rent','Reserved','Today','Tomorrow'] (app.js:19751) — 'Returned' is in none. The status dropdown is a free-jump timeline, every node a live button with no disabled state, so a fresh Reserved rental with invoiceId still null can be clicked straight to Returned and closed out unbilled.
- RENTALS: terminal jumps (Returned/Cancelled/No Show) sit stacked as the last rows of one dropdown (order app.js:16851), each a plain button calling setRentalStatus with zero intervening step; Cancel/No-Show strips billing in the same breath (app.js:19929) and the row drops instantly with no fade — while the app already owns a confirm pattern.
- RENTALS: a driver taps Log Delivery, the office-side booking gate refuses the status move, and the entire capture including recorded video is discarded — no queued retry, no visible block on the Trips side to clear (app.js:20256-20261).
- Calendar/Driver: the same class from the driver's seat — the log-gate ('no invoice on this rental') is evaluated only on tap, never at row render, so a stop blocked that morning shows no lock and no flag until he has driven the full distance. The check exists in the codebase; it simply runs at the wrong moment.
- Customers: removeCard fires a live Stripe detach — not locally reversible — with zero permission check and zero confirmation, twelve lines below the handler that does check. Of 2,265 customers only 124 have a card on file (94.5% do not), and a valid card is required before On Rent, so those 124 are effectively the entire float.
- Customers: 'Pay Cancellation' charges the saved card in full on tap while every other money action (pay balance, refund) opens a shared payment-review overlay first; 'Cancel Membership' ends billing and generates a cancellation invoice on the first click despite an arm-to-confirm pattern a few lines away in the same file.
- UNITS: the drag-drop attach filter checks fleetStatus==='Active' only (app.js:17568) while isUnitRentable (app.js:2251), which also excludes failed inspections, feeds only the availability count — a machine with a failed inspection and 2,882 hours overdue attached to a quote instantly, and a search of the whole rental detail for 'failed, not ready, overdue, service, inspect, warning, caution, unsafe' returned nothing.
- Categories: retagging a unit's category commits on change/blur from a bare, unconfirmed select and silently re-prices every open rental on that unit.

## 3. Severity dies on the row it's born on

**5 cards** · scope: `signal` · UNITS, Customers, Categories, Calendar / Driver, RENTALS

Urgency has no path upward. A flag can be true on a row while the group header above it, the tab beside it, and the global count at the top of the app all stay calm — because every level re-implements its own private subset of the flag registry instead of aggregating the level below it.

**Why it persists:** Flags were built as a per-entity registry but consumption was left to each renderer. There is no rollup contract requiring a container to expose the maximum severity of its contents, so every count and header was written by whoever needed one, at the granularity they needed. Severity therefore has no inheritance path, new entities (Categories) join the app without joining the registry, and nothing fails when they don't.

**The question a UI system must answer:** *What is the rollup rule that makes a group header, a tab, and a global count each a strict aggregation of the severity beneath them — and what forbids a container from rendering a count that ignores its own contents' flags?*

**Instances:**

- UNITS: unitsAlertCount ignores 5 of the 10 registered flag conditions — failed inspection, overbooked, GPS offline, coverage expired, uninsured-active — including the two that put an unsafe or uninsured machine on the road. The tab badge, card border, corner-flag pill and group bucket each reimplement a different subset, so four separate mechanisms disagree about what 'needs attention' means.
- RENTALS: an overdue return (off-rent-overdue, config.js:245) feeds only getEntityColor — it tints the row it already sits in and nothing else. commsBellCount = unseenNotifs()+visibleTransportAlerts()+wranglerRequests references it nowhere, and a past-endDate leg drops OUT of the forward-windowed transportAlerts so it isn't even indirectly counted. The rentals column tab's alert is hardcoded false (app.js:9601).
- RENTALS: GROUP_DEFS.rentals buckets on lifecycle status (app.js:1986-1990) and never consults a flag, unlike UNIT_SECTIONS (app.js:9279-9290) which has an explicit red 'Attention' bucket — so the header count never reflects severity and flagged rows aren't lifted within the group.
- Categories: zero entries in FLAG_META/FLAG_COND — a full grep of both registries and every call site finds no getEntityFlags('categories', …) anywhere — so no category condition (zero stock, negative ROI, unset pricing) can escalate past its own mini-card pill. No categoriesAlertCount function exists, and the column-tab alert glow is hardcoded to fire only for Units.
- Calendar/Driver: the 'Earlier' bucket — the only home for undone past-day trips — is the sole group on any card that defaults collapsed, and its colour is a hardcoded 'gray' literal that can never receive danger styling. Live: 4 undone runs inside a collapsed 'Earlier · 6 · 2 done', two of them 78 days late.
- Customers: grouping is by pay status only, so the header a person scans first carries no aggregate danger signal — a blacklisted or no-card customer at $0 owed sits under a calm green 'Current.'
- UNITS: group headers render a label and a raw count with no flagged sub-count, and once collapsed the state persists per device/account forever with no urgency floor to force a red-carrying group back open.

## 4. Nothing reaches you when you're not looking

**5 cards** · scope: `architecture` · UNITS, Customers, Categories, Calendar / Driver, RENTALS

The app has no delivery channel that survives the user not looking at the right pixel: no push, no OS badge, no durable inbox, no role-addressed message. Every alert it produces is a render-time paint on a surface someone must already be on, and the only confirmation primitive — the toast — self-clears in ~2.2 seconds with no trail.

**Why it persists:** Alerting was never modeled as a layer with an address ('who is this for?') and a lifetime ('how long does it stay?'). Each feature that needed to say something reached for the nearest render-time primitive — a colour, a count, a 2.2-second toast — because that is the only primitive the app has. Settings then grew toggles describing an alerting product nobody built, so the UI now promises delivery it structurally cannot perform, and the promise itself hides the gap.

**The question a UI system must answer:** *What is the app's addressable message object — who it is for, which surface it survives on, how long it lives, and what clears it — such that no flag condition can become true without producing one?*

**Instances:**

- RENTALS: sw.js is 47 lines documented 'OFFLINE SHELL ONLY' with no push/notificationclick listener and no showNotification; a grep of the 27,649-line app.js for Notification/requestPermission/setAppBadge/pushManager returns zero. Only two setInterval calls exist in the whole file — a GPS-view timer (app.js:24080) and an 18s backend poll (app.js:24796) — and neither scans flags to fire anything.
- Calendar/Driver: assignStopDriver's only effect on a successful assignment is a line pushed into a hidden per-rental audit array. All 3 call sites traced (single-stop picker, drag-drop, bulk 'Round up'); the one toast() anywhere in the chain fires in the DISPATCHER's own browser and is never addressed to or visible on the assigned driver's device.
- Calendar/Driver: Settings → Notifications → Crew Alerts already ships a toggle named 'Driver Assigned' — 'Texts a driver the moment a delivery or pickup is assigned to them' — scoped and named in the settings schema, defaulted off, and explicitly commented in-code as inert until a later phase.
- UNITS: all ten FLAG_COND.units predicates fire silently into data with no messenger; team chat only rings for human-typed messages; toasts are the only confirmation surface and self-clear in ~2.2 seconds with no durable trail — so an uninsured or overdue machine can go out the gate with nothing on the mechanic's tablet ever having said so.
- Categories: committing a rate edit (admin inline-edit or a Wrangler chat write) fires zero toast, dock ping, or push — not even to the person who made the edit; the commit path is reindex + logAction + render only, while js-lost-demand, js-spe-accept and js-blacklist all toast their actor.
- Customers: Settings has live, saveable toggles for customer reminders and dispatch ETAs; the toggle persists its own state and nothing acts on it.
- Customers: the notification bell holds engineering tickets addressed to the owner — pricing-engine internals with GitHub links, measured live as 53 literal ** markdown markers across 17 lines of unrendered text — with nothing customer-facing in it, plus a dispatch concern ('Transports due') in her alert count.
- RENTALS: there is no daily digest or morning brief; nothing composes returns due, field calls and unpaid balances into a start-of-shift view even though the data all exists.

## 5. Built but never doored; rendered but never wired

**5 cards** · scope: `architecture` · UNITS, Customers, Categories, Calendar / Driver, RENTALS

There is no binding between a capability and a control. Fully-built features sit in production with no button that reaches them, and fully-rendered buttons sit on screen with no live code behind them — and neither condition produces any signal, so the surface looks complete in both directions.

**Why it persists:** Cards were retired by unmounting a renderer, not by re-homing what they owned; and features were specced with their entry point as an afterthought. Nothing in the build fails when a handler has no call site or a control has no handler, so dead surface accumulates in both directions — and staff invent workarounds (voiding through the Sheets backend, typing state into name fields) that make the gap invisible to whoever measures whether the feature 'exists.'

**The question a UI system must answer:** *What makes a capability and its entry point a single unit that cannot ship half-present — and when a surface is retired, what forces every capability it hosted to declare a new home before the removal lands?*

**Instances:**

- Customers: send-to-collections and void-invoice are built end to end — manager gate, confirm popup with reason codes, overlay, auto-blacklist, audit-log entry, money-safe void handler — and their only trigger buttons render inside a retired standalone Invoices card. Verified live: the status menu on a real Late invoice offers exactly three items — Pay, Print, Send (greyed). Two invoices on one real account already read VOIDED, meaning voids currently happen only through the Sheets backend.
- RENTALS: the multi-driver lane rail and the one-tap 'Round up' auto-balance handlers exist (app.js:11802-11805, app.js:18629-18636) but nothing renders their buttons — with 12 stops and 3 trucks the dispatcher can only tap +Driver one stop at a time.
- UNITS: the WO phase pill is frozen because the code that advanced it lived in the retired Shop-card renderer; the failed-inspection photo/video link is emitted exclusively from that same retired renderer; and the ex-Shop quick filters '__wo' and '__svc' are fully implemented with human labels (app.js:3167) with nothing linking to them.
- Customers: two of five sort options are dead no-ops — sorting by 'Pay Status' produced a list byte-identical to sorting by 'Name'; sorting by 'Last Invoice' produced reverse-alphabetical order with no reference to any invoice date — while the menu still shows them as selected.
- Calendar/Driver: the Show More handler reads activeSession().cards[card] and bails unless truthy, but Calendar is deliberately card-stateless, so the click is a guaranteed no-op and everything past the 60-row cap is permanently unreachable.
- Customers: the per-customer comms conversation panel is fully built with zero call sites; the developer's own comment names where it should render, and a second comment listing it as a live comms entry point is stale for the same reason.
- Categories: the 'Lost Demand' rollup board specified in the product docs was never built, so +Lost logs to a private per-category array and toasts only the clicker; separately an 'Out of Fleet' section bucket exists in code and is never reached.
- UNITS: startHours/returnHours are seeded on every rental unit entry and humanized for the audit log (app.js:22577), but a grep for their assignment returns zero writers anywhere in the app.
- Customers: the Sales tab — named for the persona's job, one tap from her list — is a permanent 'Coming soon' placard.

## 6. Colour is the only channel, and it's saturated

**5 cards** · scope: `signal` · UNITS, Customers, Categories, Calendar / Driver, RENTALS

Distinct conditions requiring different responses are mapped onto one visual output — a single red — with no name, no legend, and a ranking that reflects source order rather than consequence. The channel is oversubscribed to the point where alarm is the default state, and the same glyph or colour means different things on different cards.

**Why it persists:** Severity was modeled as a colour rather than as a named condition with a required response. Once red is the only way to say 'important,' every team with something important adds red, and the encoding degrades monotonically — nothing ever removes a red, and nothing arbitrates between two reds, so ranking falls back to whatever order the flags happened to be pushed in.

**The question a UI system must answer:** *What must a condition declare — its name, its consequence, its required response, its priority against other conditions — before it is allowed to claim a colour, and how does a row show WHICH condition fired rather than only THAT one did?*

**Instances:**

- RENTALS: FLAG_COND.rentals defines 7 conditions (fc, overbooked, unpaid-balance, no-card, unsigned-card, unit-failed, off-rent-overdue), ALL severity:'red', and getEntityColor collapses to fl[0].severity so the row renders one uniform red. The flag's NAME never appears on the row, and 2 of the 7 (no-card, unsigned-card) are genuinely unidentifiable without the desktop hover-preview or a hop to the customer record.
- Categories: eight-plus distinct unavailability reasons (N/A, Sold, For Sale, Inactive, Failed, Overdue, End Dates?, Off fleet, plus Purchased/Onboard) all render through one identical red pill with no legend anywhere — an actionable 'Overdue' (a customer is late returning our machine) is pixel-identical to an inert 'N/A' (we never stocked the class).
- Customers: measured live, 44 of 60 rendered rows were red and 11 of the first 12 in the default view; inspecting a red row's DOM found no flag word in its text and no title attribute — the only tooltip on the row belongs to an unrelated eye-preview toggle. 'Hasn't rented since spring' and 'has no card and is about to take a machine' render identically.
- UNITS: flag ranking is by colour rank tie-broken by hardcoded push order — GPS is pushed second, service fourth — so a dead GPS antenna always outranks a seizing engine when both are red; the worst machine in the yard (2,882 hrs past service) displays as 'No GPS +1'. Separately 'Part Needed,' 'Part Ordered,' 'Part Needed?' sit side by side with the question-mark variant rendering red on one tile and amber on the next.
- Calendar/Driver: the I.graph glyph means 'graph view / stats' in the first toolbar slot on every other card and means 'hide the live map' in the identical slot on Trips; and 'Today' is hardcoded red every day regardless of contents (app.js:9337), so red already carries no signal on that card before 'Earlier' is even considered.
- Categories: a brand-new category is born with every rate at 0 and zero units, rendering it in the single most alarming state the card has — identical to a genuinely dead one; and the tab badge for an open Categories record shows a fixed navy fuel-type chip instead of the status-derived badge every sibling card (rentals/units/workOrders/invoices/customers) uses.
- Customers: three alert-pulse mechanisms are inverted or hardcoded — the rental-status badge pulses for all seven active statuses (none red), the pay-status pulse tests a 'Paid' value customers can never hold so every New Customer throbs like a debtor, and the membership billing flag has its booleans swapped so 'No Billing' pulses while 'Payment Due' sits calm.

## 7. View state is scratch paper

**5 cards** · scope: `architecture` · UNITS, Customers, Categories, Calendar / Driver, RENTALS

Sort, filter, grouping, scroll position and navigation history are re-implemented per card with different semantics and different persistence, and none of them is anchored to a record. The list is not a stable addressable thing — it silently reorders, silently combines with filters from ten minutes ago, and silently loses your place.

**Why it persists:** The list is treated as a render output rather than a state object with an owner. Each card grew the scoping controls its first users asked for, keyed to whatever local variable was handy, so there is no shared vocabulary for 'what am I looking at.' And because position is remembered as pixels rather than as a record, any re-sort silently invalidates the only breadcrumb the app keeps — which means the more the app updates itself, the more reliably it loses you.

**The question a UI system must answer:** *What is the single view-state object — scope, order, grouping, anchor record, history — that every card must own, so a list is addressable, a filter is visibly scoped to what produced it, and 'where I was' survives a re-sort, a background poll and a reload?*

**Instances:**

- UNITS: grouping beats sorting. Measured live with sort explicitly set to Service Due — position 1 was 440 hrs overdue, position 2 was 2,882 hrs overdue, position 3 was 2,025, positions 4-8 were five machines with nothing wrong at all, and position 9 was Dirt Dauber at 1,139 hrs overdue, filed under the green AVAILABLE bucket. Buckets are decided by inspection status alone; service urgency never enters bucket assignment.
- RENTALS: scrollMemo is keyed only by card|view and restored by raw pixel (save app.js:17185-17190, restore app.js:17229-17234) — the key never includes the acted-on record id, and list mode always restores the saved value even when the list re-sorted underneath (status is a selectable sort field, config.js:431). Acting on a row lands the viewport on a different rental, and the toast says only 'Status → X'.
- Calendar/Driver: the app-wide scroll memory reads and writes .card-body's scrollTop across 5 call sites while the real scroller on Trips is the nested .cal-scroll — a live control test showed position 120→0 — and the 18-second background poll triggers the same render with no user action at all.
- Categories: filters set from one category persist and silently intersect with a filter clicked on a different one later. Live: two chips ('Not Ready · Light…' + 'Ready · 12k Exca…') intersected with Back/Forward vanished — the result looked like a normal list, just of the wrong machine.
- Categories: two lookalike pills an inch apart produce opposite navigation outcomes — the availability pill pushes history and Back restores sort/scroll/panel state; the status-tally pill wipes backStack/fwdStack outright and the Back/Forward arrows vanish from the toolbar entirely.
- Categories: the leading circle on a filter chip looks like a clear control and actually inverts the filter — live, the chip turned red ('excluding') and the list changed, so the natural read is 'it worked' while the user now views the exact complement of what they asked for.
- Customers: only 60 of 2,265 rows load and 'Show more' re-renders the entire list every press — timed 547ms → 658ms → 803ms → 1,044ms for identical 200-row additions (~1.1ms/row, tracking total row count). Reaching the end of the book is ~eleven presses and over twelve seconds of frozen screen, each requiring a manual scroll back to the button.
- Categories: every fresh session and every reload lands the left column on Units regardless of where the user was working — live-confirmed, after an entire session in Categories a reload dropped straight back to a card that carries no rate field at all.
- Calendar/Driver: Trips' listbar is empty — no sort, no global search, no stats toggle — while Units and Customers both carry a 'Name ▲▼' control and a graph toggle; and tripMatches does one contiguous blob.includes(q) instead of the AND-term matching every other card uses, so 'lake pick' returns zero rows against a row literally reading 'Pick up' at 'Lake Charles.'

## 8. The label layer is hover

**5 cards** · scope: `density` · UNITS, Customers, Categories, Calendar / Driver, RENTALS

The app has no naming layer. Controls ship as bare glyphs and the text that would explain them — plus, routinely, the operative data itself — is stored in a title/data-tip attribute, a gesture that does not exist on touch, in gloves, or in a screen reader. Where text does render, it truncates at exactly the character carrying the meaning.

**Why it persists:** Every card face is over-subscribed and hover was available and free. Because a tooltip is a per-element decision rather than a naming contract, what gets demoted is chosen locally and always sacrifices the long string — which is usually the noun carrying the meaning. No layout rule reserves space by importance, so truncation order is an accident of source order, and touch/gloved/assistive use was never a rendering mode the layout had to satisfy.

**The question a UI system must answer:** *What is the naming and overflow contract — every control has a rendered name, every datum has a declared priority, nothing that determines an action lives only in a hover — and how does a card face decide what to drop when it runs out of room?*

**Instances:**

- UNITS: a full inventory of the mechanic's screen found 86 interactive elements, 58 (67%) with no visible text label, 52 of those 58 labelled only by a title-attribute hover tooltip, and not one aria-label in the set — even though the repo already pairs aria-label with data-tip in 69 other places, so the pattern is known and simply unapplied here.
- Categories: a live full accessibility-tree read found refs ref_1826 through ref_1859 plus the entire block ref_2305–ref_2328 (the category pills) all reading as bare 'button', and the filter-term chips — both the pill and its nested negate-icon button — do not appear in the accessibility tree at all: unreadable and unremovable by a screen-reader user.
- Calendar/Driver: the row prints a town, 'Lake Charles', while the live DOM shows data-tip holding the full '1700 11th St, Lake Charles, LA 70601, US' as an unused hover-only attribute — for a driver in a truck wearing a glove.
- UNITS: the worst machine in the yard, 2,882 hours past service, renders on its tile as 'No GPS +1' with the service number existing nowhere on the tile face, only inside the data-tip string; and service-flag text truncates at roughly 9px so '73 HRS…' could mean overdue or remaining.
- Customers: the money pill and the phone number share one line and money wins the truncation. Measured across 400 production rows: 96% of rows carrying a balance had a clipped phone (22 of 23) vs 25% of rows without one; a customer owing $13,240.52 rendered a phone of '(337) …' — the exact accounts she most needs to call are the ones she can't read.
- RENTALS: on a phone the entire link-a-record system is reachable only through an unsignposted 500ms long-press — touch drag was retired 2026-06-29 (app.js:17813) and a finger-drag is silently disarmed — while six empty-slot toasts still instructed the user to 'drag' with no is-phone branch. The anchor-clear control is real but hover-revealed and unlabeled.
- Categories: the tab renders truncated to 'CATEG…' whenever it isn't the active column; the identical rule truncates Trips to a single character 'T' with the full word only in a tooltip. Hovering a category row pops an eye icon and a + icon directly over the 1-Day rate value the card exists to show.
- Calendar/Driver: the back control is an unlabeled bare chevron — verified to function correctly, round-trip with state restored — that gives a driver no textual cue it is his way back.

## 9. The cards narrate; they don't act

**5 cards** · scope: `architecture` · UNITS, Customers, Categories, Calendar / Driver, RENTALS

Surfaces are built to report state, not to advance work. The record tells you what is true and offers no next move, no way to reach the person involved, and no queue of what is yours — so every real action is a multi-screen detour or a phone call the app never sees.

**Why it persists:** The app's unit of design is the record, not the task. Each card was built to answer 'what is the state of this thing,' and the actions that follow from that state belong to other systems — comms, dispatch, billing — living on other surfaces, so nobody owned the join. Assignment fields exist because records need attributes, not because anyone modeled a person's queue; and when the system offers no place to put an intention, staff put it in the name field.

**The question a UI system must answer:** *What is the app's action layer — the set of next moves a record can offer, addressed to a named person, reachable in one tap from where the state is read — and what makes 'whose is this and what do I do about it' a first-class property of every record rather than a stored attribute nothing consumes?*

**Instances:**

- Customers: no call, text, charge, or follow-up control exists anywhere on a customer row or in the detail record — the card only ever states facts. There is no tap-to-call at all, and the only real text/email action hides behind an undiscoverable right-click/long-press context menu which itself has no 'Call' option.
- RENTALS: the 'next move' on an open rental is a status noun on a 22px pill — 'Off Rent' reads like routine progress even when it means the machine is 3 days overdue — with no verb and no primary CTA. Every outreach to the driver or customer about a specific rental is a 2-3 screen detour; the nearest one-tap contact is the roster-wide 'Text the Crew' broadcast buried in Settings.
- Calendar/Driver: the row's entire overflow menu contains exactly one item — 'Merge trip…', a dispatcher concept. No 'running late,' 'can't complete,' or 'on my way' exists anywhere on a driver's own row, even though the capability sits one card over: the Unit card carries a working '+FC' Field Call button at app.js:7736 that simply isn't wired onto the row where the driver is standing. There is also no standing pre-populated dispatch thread to tap into.
- UNITS: assignedMechanic appears 17 times — stored, displayed, edited, searched — and is never once used to route, filter, badge, or scope a view. Every auto-created work order is born with it blank (app.js:20009, 22445, 23005), and no 'assigned to me' filter or badge keyed off the logged-in identity exists anywhere.
- Categories: the +Lost demand-tracking button logs to a private per-category array and toasts only the person who clicked — nobody in purchasing or fleet planning is ever told. Meanwhile Mr. Wrangler holds the fully correct live rate sheet and computes the real blended price via find_categories/price_rental, but is pull-only, never volunteered, and reachable only through a right-click.
- RENTALS: there is no 'here's your day' surface — a dispatcher assembles the shift by scanning multiple cards; the information all exists in the data and is never composed into a start-of-shift view.
- Customers: the improvisation proves the gap — counter staff type business state directly into the customer NAME field (balances, do-not-rent flags, credits, escalation contacts) and prefix 23 of 25 with punctuation specifically because punctuation sorts above letters in the one sort that isn't broken; the same improvisation appears in free-text notes as an ad hoc, undated follow-up tracker.

## 10. Writes have no integrity layer

**5 cards** · scope: `architecture` · UNITS, Customers, Categories, Calendar / Driver, RENTALS

Records can be created, edited and closed out without the app checking the result is coherent. Nothing dedupes on create, nothing validates magnitude or format on entry, nothing captures the fields the business needs at the moment they exist, and nothing can delete or merge what got made wrong — so bad data is permanent and silently authoritative.

**Why it persists:** Writes were added one form at a time to satisfy one screen's need, and the schema is treated as append-only storage rather than a model with invariants. Validation, dedupe and lifecycle (merge/retire) are each a feature someone would have to request, and nobody requests them until the bad data is already load-bearing — at which point deleting it is more dangerous than living with it, so the workaround (a second record, a 'Unknown category' string) becomes permanent.

**The question a UI system must answer:** *What invariants must a record satisfy before it can be created, advanced or closed — and where do dedupe, magnitude/format validation, required-at-this-moment capture, and merge/retire live so that no single form can decide to skip them?*

**Instances:**

- UNITS: the only field writing the hour meter is `const v = Number(input.value); u.currentHours = v` — no range check, no order-of-magnitude guard, no monotonic check. Live production history on unit SPEECHLESS: 'Jun 17 — Hours: 1732.3 → 17385.5' (Cameron), corrected 'Jul 13 — 17385.5 → 1738.5' (Bri) — a 10x typo that stood 26 days feeding every service countdown, the fleet hours average, category ROI and $/Hr computations, permanently stamped onto every work order opened in that window. Separately, a blank 'hours at completion' records as 0 and sets a false countdown baseline.
- RENTALS: 'Log Recovery' stamps only {date, video, driver} and sets Returned — no condition capture, no inspection opened, no damage line (app.js:20259-20261) — so the Rental Protection $1,000 cap (app.js:4410-4411) can never be exercised from the return path.
- UNITS: the same gap upstream — startHours/returnHours exist on every rental unit entry, are seeded with real values and are humanized for the audit log, but have zero writers, so a unit goes out for three weeks, comes back 180 hours older, and its service countdown does not move by one hour.
- Calendar/Driver: uploadCaptureMedia posts the walkaround video once; on network failure the catch toasts 'saved without it' for two seconds and the row still stamps green 'Logged' — a failed upload and a successful one are visually identical afterward, and that video is the only defense against a later damage claim. A failed sync holds the pending write only in RAM while the R25 banner instructs a phone user 'Don't close the app.'
- Customers: all five creation paths mint via nextCustomerId() unconditionally with no lookup against existing phone, email or name — a captured production sort-order snapshot showed the identical customer name rendered twice.
- Categories: nothing in the app ever deletes, merges, retires or splits a category — DATA.categories is push/read/index-only — so a typo'd or duplicate category pollutes every grid, sort and picker forever, and a unit pointing at a nonexistent categoryId renders as literal text 'Unknown category' and '—', neither actionable nor filterable. Models are append-only via two independent creation paths, neither doing a name lookup, despite one path's own comment claiming it mirrors a find-or-create idiom.
- Calendar/Driver: timeToMin accepts colon-formatted times only — '9am', '9 AM', '0900', '9' and 'noon' all parse to null, never surfaced as an error, silently inheriting the invisible 5PM AUTORUN_EOD_DEADLINE_SEC cutoff.

## 11. One Bell, Owned By Billing And Transport

**5 cards** · scope: `signal` · RENTALS, UNITS, Customers, Categories, Calendar / Driver

There is exactly one proactive alert channel and its payload was claimed by the invoice and transport subsystems; every other subsystem's urgency — overdue returns, failed machines, expired insurance, category stockouts — has no route into it, and one card is hardcoded as the only tab allowed to glow.

**Why it persists:** The bell was built as a feature of the billing rollout and the transport rollout, each appending its own count to one expression, rather than as a subscriber to a severity bus. Because the flag engine and the alert engine were never connected, registering a new red flag is free and produces nothing — the flag author gets a colored border and reasonably assumes the alerting was handled by whoever owns the bell.

**The question a UI system must answer:** *What is the single path from 'a condition became true' to 'a specific person is told', and what forces every registered flag to declare its destination on that path — including which role hears it and what happens when the app is closed?*

**Instances:**

- RENTALS: commsBellCount = unseenNotifs() + visibleTransportAlerts() + wranglerRequests (app.js:10342-10343) — none of the three reference the flag system, and a past-endDate leg drops OUT of the forward-windowed transportAlerts, so an overdue return isn't even indirectly counted. off-rent-overdue is a registered red flag (config.js:245) that feeds only getEntityColor, tinting the row it's already sitting in. The rentals column tab's alert is hardcoded false (app.js:9601).
- Categories / all cards: the column-tab alert glow is literally `alert: m === 'units' && unitsAlertCount() > 0` (app.js:9644-9655) — a string match on one card name; unitsAlertCount() is the only such function that exists anywhere in the file, so no other column can ever light up no matter its internal state.
- UNITS: the one alert indicator visible before opening the card watches only 3 of the 10 registered flag conditions (app.js:9479), and the bell itself shows 'Transports due' — a dispatch concern — while every item in the Notifications panel is invoices or card payments, none of it role-filtered (app.js:14050).
- Customers: the same bell holds engineering tickets addressed to the owner — pricing-engine internals with GitHub links, rendered as raw unparsed markdown so authored **Verdict:** shows its literal asterisks — with nothing customer-facing in it at all.
- Categories: has zero entries in the shared flag registry — FLAG_META (config.js:237-297) and FLAG_COND (app.js:5833-5924) both carry 5 entity keys and categories is not one, so getEntityFlags returns [] and no category condition (zero stock, unset pricing, negative ROI) can ever escalate past its own mini-card pill.
- Every card: no OS-level channel exists — sw.js is 47 lines with no push/notificationclick/showNotification, and a grep of the 27,649-line app.js for Notification / requestPermission / setAppBadge / pushManager returns zero. Toasts self-clear in ~2.2s with no durable trail.

## 12. One Red Pill, Eight Meanings

**5 cards** · scope: `signal` · Categories, RENTALS, Customers, UNITS, Calendar / Driver

Distinct conditions from different subsystems are funneled through the same visual channel and the same words, so the pixel a user reads is a collision site: pricing, fleet, dispatch and AR each mean something different by 'red', 'available', 'member', and the row cannot say which one fired.

**Why it persists:** Color and pill shape are the only severity channels the design language exposes, and every subsystem that needed to say 'important' had exactly one way to say it, so red accreted meanings without any of them being wrong. The flag registry stores severity but not identity, so getEntityColor can only return a color — the name of the condition that fired has nowhere to render on a row. And because each card's vocabulary was authored locally, the same word ('available', 'member', 'weekend') was defined independently three times.

**The question a UI system must answer:** *What is the shared vocabulary — of words, colors, and glyphs — that every card must speak, and where does a condition's NAME live on a row so that severity and identity are never collapsed into a single pixel?*

**Instances:**

- Categories: eight distinct unavailability reasons — N/A, Sold, For Sale, Inactive, Failed, Overdue, End Dates?, Off fleet — all render through one identical single-color red pill with no legend, via a single badge(...,'red') call (app.js:2281-2297). An actionable 'Overdue' (a customer is late returning our machine) is pixel-identical to an inert 'N/A' (we never stocked the class).
- RENTALS: FLAG_COND.rentals defines 7 conditions — fc, overbooked, unpaid-balance, no-card, unsigned-card, unit-failed, off-rent-overdue — ALL at severity 'red' (config.js:239-253), and getEntityColor collapses to fl[0].severity (app.js:5834-5854), so the row is one uniform red. Verified scope: 3 of 7 get a distinct on-row echo, but no-card and unsigned-card are genuinely unidentifiable without a desktop hover-preview or a hop to the customer record.
- Categories: member day-rate ($120) is a stored, first-class, edited field that the mini-card never renders — the face shows only the four retail tiers (1-Day $440 etc.) while rentalPrice() short-circuits to days × memberDaily for a member, skipping all four displayed tiers (app.js:7271-7275 vs 8876-8879 vs 1078). A rep reading the face he actually looks at overquotes a member by 267%.
- Customers: on a live production record the account header read 'Member' while the AR block on the same screen read 'NON MEMBER MODE' for the same account. Separately, a stored 'Don't Contact' stage renders as a red pill on the row but the detail popup clamps off-vocabulary values to a calm blue 'Lead' (app.js:212-219) — opening the record to check the warning makes the warning disappear.
- Calendar / Driver: the I.graph glyph means 'Graph view / stats' in the first toolbar slot on every other card and means 'hide the live map' in the identical first slot on Trips (app.js:9647). Categories: a rate set to 0 renders as '—' on the mini-card and '$0' in the detail (app.js:7271-7275 vs 8876-8879) — the same stored value reading as 'no tier' or 'free' depending on the surface. UNITS: 'Part Needed', 'Part Ordered', 'Part Needed?' sit side by side, and the question-mark variant renders red on one tile and amber on the next.
- The consequence is documented on Customers: because pay status never updates, red never says why, and only one sort works, counter staff have been typing business state into the customer NAME field — balances, do-not-rent flags, credits, escalation contacts — prefixing 23 of 25 with punctuation specifically because punctuation sorts above letters in the one sort that isn't broken.

## 13. Doors Walled Over

**5 cards** · scope: `architecture` · UNITS, Customers, RENTALS, Categories, Calendar / Driver

When a card was retired, the capabilities that lived on it stayed fully built underneath but lost their only entry point, and no other card adopted the step — so a whole job in the chain has working code, gates, confirms and audit entries, and no button.

**Why it persists:** Cards were retired by deleting a renderer, not by re-homing the jobs that renderer hosted. Because the handlers, permission gates, confirm dialogs and audit writes all survive, every grep and every code review says the feature is present — the only missing piece is a button, which is invisible in the diff. Nothing in the codebase maps a job to the card that owns it, so retiring a surface has no checklist and no failing test.

**The question a UI system must answer:** *When a surface is retired, what names the jobs it was carrying and forces each one to be re-homed to a specific card — and what makes an implemented-but-unreachable capability show up as broken rather than as present?*

**Instances:**

- UNITS: the Shop card is retired and work orders now live inside each unit, so there is no fleet-wide open-jobs view. Merle, driving it live: "the Shop card's gone. Work orders live down inside each unit now. So there's no one place I can stand and see every open job. I gotta open machines one at a time." The ex-Shop quick filters '__wo' (WOs Open / Parts Ordered) and '__svc' (Service Due) are fully implemented with human labels and nothing links to them (app.js:3167); completed and cancelled work orders have no home anywhere (app.js:7669).
- UNITS: every work order's phase pill is frozen at its creation value because the code that advanced it lived in the retired Shop-card renderer and is unreachable from Units (app.js:6978).
- UNITS: js-open-insp — the only link to a failed inspection's photo/video report — is emitted exclusively by the dead Shop renderer (app.js:9127); the unit's own Inspection section renders no thumbnail or link.
- UNITS: the only ETA editor for an ordered part lives on the retired workOrders detail renderer, which app.js:3052 unconditionally redirects away from. The partform has no date input, savePartForm initializes eta:'' and never touches it — so part-ordered-eta can never fire and its sibling part-ordered-no-eta is permanently true (app.js:5874, 8016).
- Customers: Send to Collections and Void Invoice are built end to end — manager gate, confirm popup with reason codes, overlay, auto-blacklist, audit-log entry, money-safe void handler (app.js:18671, 18692, 18712-18716) — but their only trigger buttons render inside the retired Invoices card (app.js:8974-8979, 8991-8995). Verified live: the status menu on a real Late invoice offers exactly Pay, Print, and Send (greyed). Two invoices on one real account already read VOIDED, so the capability was in use.
- RENTALS: the multi-driver lane rail and the one-tap 'Round up' auto-balance handlers exist (app.js:11802-11805, 18629-18636) but nothing renders their buttons — with 12 stops and 3 trucks a dispatcher can only tap +Driver one stop at a time, with no 'who's carrying what' load view.
- Customers: commsCustSectionHtml() — the per-customer conversation panel — has zero call sites, and a stale in-code comment still names where it renders.
- Calendar / Driver: dead .js-disp-day / .js-disp-today day-reset handlers exist (commented Phase 6) and are emitted by no template, which is why a map stuck on a future day has no recovery but a full page reload (app.js:11796).
- Categories: the '+Lost' demand button logs to a private per-category array and toasts only the clicker; the 'Lost Demand' rollup board specified in docs/specs/market-research.md §6.3 was never built, so purchasing is never told.

## 14. No One Gets Told

**5 cards** · scope: `architecture` · RENTALS, UNITS, Categories, Calendar / Driver, Customers

The app has no messenger. Every state change writes to data and stops there — nothing crosses to the person on the other card, on the other device, or off the screen — and four independent audits found the same void from four different seats.

**Why it persists:** Notification was scoped as a channel feature (web push, SMS) rather than as the required completion of a write, so it sat behind a phase gate while the writes themselves shipped card by card. Every handler's definition of done is 'the record changed' — logAction + saveSoon — and there is no shared commit path that asks who else is affected. The Settings toggles prove the intent was captured; what is missing is the obligation.

**The question a UI system must answer:** *For every write in the app, who else is affected — and what makes 'the affected party was told' part of the commit itself rather than a separable channel feature that can be deferred indefinitely?*

**Instances:**

- RENTALS: sw.js is 47 lines, documented 'OFFLINE SHELL ONLY' — install/activate/fetch/message listeners only, no push, no notificationclick, no showNotification, no pushManager.subscribe. A grep of the 27,649-line app.js for Notification / requestPermission / setAppBadge / pushManager returns zero. Close or background the app and zero alerts reach the dispatcher. UNITS, Categories and Calendar each rediscovered this independently — four cards, one hole.
- Calendar / Driver: assignStopDriver()'s only effect on a successful assignment is pushing a line into a hidden per-rental audit array (app.js:11341-11352, 22575). All three call sites traced (single-stop picker, drag-and-drop, bulk 'Round up'); the one toast() anywhere in the chain fires in the DISPATCHER's own browser. The driver is never told he has a job.
- Calendar / Driver: Settings → Notifications → Crew Alerts already ships a toggle literally named 'Driver Assigned' — 'Texts a driver the moment a delivery or pickup is assigned to them' — defaulted off (app.js:5161) and explicitly commented inert until a later phase ships the SMS path (app.js:5282, 5291). The product already named the fix.
- Customers: live, saveable Settings toggles for customer reminders and dispatch ETAs whose engines are inert — the toggle only persists its own state, so anyone flipping it on reasonably believes the app is now chasing customers.
- Categories: committing a rate edit — admin inline-edit or a Mr. Wrangler chat write — fires zero toast, team-dock ping or push, not even to the person who made the edit; the shared efld() 'field' commit closure (app.js:19658-19668) is the one edit path in the app silent to its own author, while js-lost-demand, js-spe-accept and js-blacklist all toast the actor.
- RENTALS / Customers: refreshCommsThreads appears in neither of the app's only two setInterval calls (GPS timer app.js:24080; 18s backend poll app.js:24796) and refreshFromBackend never calls it — a customer's text or email reply can sit unseen until someone manually clicks a comms chip or reloads. A dead comms backend renders identically to a quiet day.
- UNITS: all ten FLAG_COND.units predicates — service-past-due, inspection-failed, uninsured-active, coverage-expired, wash-requested — fire silently into data with no messenger, and toast confirmations self-clear in ~2.2 seconds with no durable trail.

## 15. Lifecycle Sorts The List, Danger Doesn't

**4 cards** · scope: `architecture` · RENTALS, UNITS, Customers, Calendar / Driver

Two taxonomies contest the vertical axis of every list — a lifecycle/stage grouping that owns the buckets and headers, and a flag/severity system that owns the colors — and the grouping never consults the flags, so the emergency is filed under whatever calm stage it happens to be in.

**Why it persists:** Grouping, sorting and flagging were built as three independent registries — GROUP_DEFS / UNIT_SECTIONS, SORT_FIELDS, FLAG_META+FLAG_COND — with no contract between them, and grouping is applied before sorting in the render pipeline so it structurally outranks any sort the user picks. Each card's group definition was authored by whoever built that card, against its own domain vocabulary, and nothing forces a group definition to declare how severity affects it.

**The question a UI system must answer:** *Does severity outrank taxonomy in a list — and if so, what single composition rule governs how a flag promotes a row, colors its bucket, and forces a collapsed group back open, so that no card can define a grouping that a red condition cannot escape?*

**Instances:**

- RENTALS: GROUP_DEFS.rentals keys buckets off lifecycle status via rentalRevStatus (app.js:9312-9316, app.js:1986-1990) and never consults a flag — unlike UNIT_SECTIONS (app.js:9279-9290) which has an explicit red 'Attention' bucket fed by unitStageKey. There is no 'Needs Attention' bucket on Rentals, the header count never reflects severity, and flagged rows aren't lifted within their group. Verifier: PARTIAL — the row itself does render red, so the gap is specifically at header/count/sort level.
- UNITS: setting the sort to 'Service Due' does not sort by service due — grouping wins, so the sort only reorders within a bucket. A machine 1,139 hours overdue sits at position 9, filed under the green 'AVAILABLE' bucket (app.js:9294, 9304). And a machine that fails inspection while actively on rent never reaches 'Needs Attention' at all (app.js:9294-9307).
- Customers: grouping is by pay status only (app.js:9317-9319), so a blacklisted, no-card customer at $0 owed sits under a calm green 'Current' header — the header a person scans first carries no aggregate danger signal.
- Calendar / Driver: 'Earlier' — the only bucket where undone past-day trips live — is the sole default-collapsed group on any card (app.js:9358) and its color is a hardcoded 'gray' literal (app.js:9333, 9340) that can never receive sec-danger styling, which only fires on color==='red' (app.js:9423).
- RENTALS: recoveries get no forward-looking bucket at all — a unit due back today sits in 'On Rent' with no distinguishing signal, and the first time it is grouped as urgent is after off-rent-overdue trips, i.e. the day after it's late (app.js:2016-2017).

## 16. Retired Cards Left Their Work Behind

**4 cards** · scope: `architecture` · UNITS, Customers, RENTALS, Categories

Whole subsystems were retired by deleting their renderer while leaving their handlers, gates, buckets and confirm flows live — so fully built, fully gated capabilities now sit unreachable inside the surface that won the real estate, and the stranded copy still instructs users in the retired idiom.

**Why it persists:** Cards are retired by removing them from the COLUMNS/board config, which unrenders the surface but leaves every delegated click handler, gate, and helper live in the same 27,649-line file. Nothing links a handler to the renderer that was its only entry point, so retirement produces no error, no dead-code warning, and no inventory of what just became unreachable. The receiving card then absorbs the orphaned domain without inheriting its controls.

**The question a UI system must answer:** *When a surface is retired, what forces an explicit disposition for every capability it hosted — rehomed, deliberately dropped, or blocked — so that a card cannot silently inherit a domain without inheriting the controls that domain needs?*

**Instances:**

- Customers: sending an account to collections and voiding a bad invoice are built end-to-end — manager gate, confirm popup with reason codes, overlay, auto-blacklist, audit-log entry, money-safe void handler (live handlers at app.js:18671, 18692, 18712-18716) — but their only trigger buttons render inside a standalone Invoices card that was retired (config.js:421-426) and never renders anywhere; the reachable menu at app.js:4842-4856 lacks them.
- UNITS: every work order's phase pill is frozen at its creation value on the tile, because the code that ever advanced it lived in the retired Shop-card renderer and is unreachable from Units (app.js:6978). Likewise a failed inspection's photo/video report has no door from the unit's own record — the only link to it is emitted exclusively from the retired Shop renderer (app.js:9127). And with Shop gone there is no place to see every open work order across the fleet, while completed and cancelled WOs have no home at all.
- RENTALS: touch drag-to-link was retired 2026-06-29 (app.js:17813) and a phone finger-drag is now silently disarmed (ready stays false, app.js:17892-17904) — no link, no ghost, no feedback — while six empty-slot toasts (app.js:19046, 19054, 19082, 19574, 19579, 19592) kept telling the user to 'drag' with no is-phone branch. Copy fixed in PR #740; the unsignposted 500ms long-press is still the only path.
- Categories: clicking an 'Off Fleet' stock segment routes to Units, but cardListEl strips every non-Active unit before the per-card filter runs (app.js:9884 vs 9898), so the click lands on an empty state — even though a correct 'Out of Fleet' section bucket exists in the code at app.js:9332-9348 and is never reached, and rentalsVisible already has the reveal-when-filtered pattern this doesn't mirror (app.js:6825-6828).
- Customers: a fully built per-customer comms panel with zero call sites; Categories: a '+Lost' demand button that logs to a private array because the 'Lost Demand' rollup board specified in docs/specs/market-research.md §6.3 was never built (config.js:403-410 has no 'demand' entry).

## 17. Desktop Pointer And Gloved Thumb On One Surface

**4 cards** · scope: `interaction` · UNITS, Calendar / Driver, RENTALS, Customers

The same screen is authored for a mouse with hover and a precise click, and used by a driver in a cab and a tech on a yard tablet — so the meaning of the screen lives in hover states, and the destructive actions live where the hand is already travelling.

**Why it persists:** Hover was treated as free display surface because it costs no layout, so density problems were solved by moving meaning into tooltips — which is an invisible decision on a desktop and a total loss of information on touch. The same reasoning made the hover panel reuse the real detail renderer rather than a read-only summary, since reuse looked like the disciplined choice. Nothing in the codebase distinguishes 'reveal' from 'commit' as classes of interaction, so both live in the same panel.

**The question a UI system must answer:** *What information is allowed to exist only on hover — and what separates a surface that reveals from a surface that commits, given the same screen is used by a mouse at a desk and a glove in a cab?*

**Instances:**

- UNITS: the hover-preview panel that looks like a tooltip is the full live DETAIL.units() markup with pointer-events:auto explicitly set (style.css:825, app.js:3008), positioned 10px right of and centred on the cursor (app.js:3021-3028) — 13 live controls, none disabled, at z-index 9000, including '✕ Fail' which fails the machine and opens a work order in one click. Live repro: hovered a tile to look at it, clicked once, got 'Wash logged — countdown reset' — a real production write, no confirmation.
- UNITS: 58 of 86 interactive controls on the mechanic's screen carry no visible name; 52 of those are explained only by a hover tooltip; zero aria-label exists anywhere in the set. Meanwhile the Tools menu opens downward from a bottom-bar button with no viewport-collision detection and no internal scroll — at a 576px-tall viewport it clips 6 of its 10 items, including the one switch that disables the hover-preview trap.
- Calendar / Driver: the row prints a town name ('Lake Charles') while the full street address exists in the DOM only as a hover data-tip (app.js:7366, 9670) — a driver in a truck with a glove will never trigger it. 'Open in Google Maps' only renders once a stop is focused inside the collapsible map panel (app.js:9660-9673). The map itself is hardcoded 260px inside the card's 333px scroll region (style.css:903), occupying 78% of first paint before a single trip row appears.
- RENTALS: on a phone the entire link-a-record system is reachable only through an unsignposted 500ms long-press → context menu → '+ Rental'/'+ Unit', with nothing signposting it (app.js:19046/19054/19082 vs app.js:17813-17826).
- UNITS: attaching a machine to a rental has exactly one path — drag-and-drop; the +Unit button opens no picker, it toasts 'Drag a unit from the Units card onto this rental' (app.js:17568). A user who will not drag cannot build a rental at all.
- UNITS: a pill tap gives no feedback while the 220ms double-click discriminator resolves, so an impatient second tap silently forks a new browser tab instead of registering the intended action.

## 18. Two Truths, One Screen

**4 cards** · scope: `signal` · Customers, Categories, UNITS, Calendar / Driver

The same fact is computed independently at every place it appears — live from source records here, from a stored field or a differently-scoped tally there — so two answers to one question render inches apart with nothing marking which is authoritative.

**Why it persists:** Facts in this app have no owner. There is no single named derivation for "does this customer owe us", "is this unit rentable", or "what phase is this WO in" — each render site computed what it needed at the moment it was written, and a canonical helper existing (isUnitRentable, app.js:2251) does not stop the next surface from re-deriving beside it. Because the duplication is invisible in the code and invisible on the screen, fixes land on exactly one surface: the fleetStatus availability fix reached the mini-card and never travelled the ~5,000 lines to the detail. Nothing makes a second definition visible as a second definition, to a reviewer or to a user.

**The question a UI system must answer:** *What is the one named, single-sourced derivation for each business fact the UI is permitted to display, and how does a surface render a fact it does not own — so that writing a divergent second computation is structurally impossible rather than merely discouraged?*

**Instances:**

- Categories — same category, same second: the 12k Excavator mini-card reads "NEXT MON" (zero free) while the detail reads "9 Available" (11 units minus 2 on rent, nothing excluded for Sold/For Sale/Inactive). Lift Scissor 19ft: mini-card "2 Avail", detail "5 Available" — the 3 extra are sold machines. A comment at app.js:7212 shows this exact bug class was fixed on the mini-card 2026-06-25; the fix never reached the detail renderer (unitRentalBucket, app.js:2300-2305, has no fleetStatus check).
- Customers — the row computes an accurate live owed/overdue figure from real invoices every render (app.js:7149-7161) while the group header, the sort field, the filter and the pulsing detail flag all read a stored payStatus written once at signup (app.js:9317-9319, 8351-8352, config.js:430). Two contradictory answers to "does this person owe us" sit inches apart.
- Customers — on one real account, simultaneously on screen: spend-chart callout "$47,720 · BEST · APR" (rental list price over a 9-month window) versus Transactions tab "$2,834.84 collected, 1 payment, 0 refunds", 1-year average $236.24, open balance $13,240.52 — roughly a 17x overstatement, different basis, different period, neither labelled, and the caption beneath still read "No rental cadence yet."
- Customers — a live production account carrying a $1,306.85 balance showed "Member" in the detail header and "NON MEMBER MODE" in the AR block directly below it (observed live in session; flagged as not independently re-verified by the adversarial pass).
- Customers — a stored "Don't Contact" stage renders as a red pill on the row and on the Sales pipeline board, but the detail popup clamps off-vocabulary values to a calm blue "Lead" (app.js:212-219), so opening the record to check the warning is what makes the warning disappear.
- UNITS — every work order's phase pill on the tile reads raw w.phase, frozen at creation, while the unit's own accordion below shows the live derived woBottleneck. Two definitions of "what phase is this WO in" coexist on one screen; the code's own comment (app.js:22610-22613) says the displayed status is meant to be derived.

## 19. The Number Doesn't Own Its List

**4 cards** · scope: `signal` · UNITS, Categories, Calendar / Driver, RENTALS

A count is tallied over one population and then used as the label for a click that produces a different population — or for a list it does not scope at all — so tapping a number is the most reliable way to discover the number was wrong.

**Why it persists:** Counts are written as display strings at the point of render, not as queries over a named record set. A tally and its drill-through are two separate pieces of code with no shared predicate, so agreement is a coincidence that must be re-achieved by hand every time either side changes scope, and nothing tests it. Worse, badges and bells are aggregates of hand-listed sources — adding a condition to the flag registry adds it to no count — so the registry grows and the numbers on the chrome silently keep their old meaning.

**The question a UI system must answer:** *Must every displayed count be the literal length of the exact record set its own click produces — and where a number cannot own a list (a bell, a tab badge), what states on the number itself which population it covers and which it excludes?*

**Instances:**

- UNITS — the Worklist graph reads "NOT READY 28" while the group bar roughly 40px below on the same screen reads "NOT READY · 8", same label. The graph tallies every unit in DATA.units unconditionally (app.js:12167-12170); the list grouping excludes out-of-fleet and on-rent units first (app.js:9295). A third, narrower definition lives in unitsAlertCount (app.js:9479) — three definitions of "needs attention" on one card.
- UNITS — the Work Orders bar counts one entry per open work order but the click-through filters the unit list, so a unit carrying 2 open WOs is counted twice on the bar and appears once beneath it. The number structurally cannot match its own rows.
- Categories — clicking an "Off Fleet" stock-count segment routes to Units, where cardListEl strips every non-Active unit before the per-card filter runs, so the click lands on an empty "No Unit" state even though an "Out of Fleet" section bucket exists in code and is never reached.
- Calendar / Driver — the Trips tab badge read 4 while the collapsed "Earlier" group held 6 stops / 2 done = 4 more undone, two of them 78 days old, none of which touch the badge (app.js:9471-9472). Separately, the group header's "· N done" counts whole trips, so a 4-stop run with 3 logged contributes zero.
- RENTALS — an overdue return contributes to no count anywhere: commsBellCount = unseenNotifs + visibleTransportAlerts + wranglerRequests (app.js:10342-10343), none of which reference the off-rent-overdue flag, and a past-endDate leg drops OUT of the forward-windowed transportAlerts so it isn't even indirectly counted. The rentals column tab alert is hardcoded false (app.js:9601). The flag tints only the row it is already sitting in.

## 20. A Stored Mirror Nobody Re-Derives ⁿ

**4 cards** · scope: `architecture` · RENTALS, Customers, UNITS, Calendar / Driver

Denormalized fields — a primary-unit pointer, a pay status, a WO phase, an on-hand quantity, an hour meter, a sync flag — are written once and then read as current everywhere, with no invalidation, no re-derive pass, and nothing in the UI distinguishing a mirror from a measurement.

**Why it persists:** Each mirror was introduced for read speed or cross-card convenience, and keeping it fresh was the private responsibility of whatever feature created it. When that feature moved (Shop card retired), was never built (returns capture, hour-meter rollup), or lives only in the backend (payStatus), the mirror keeps rendering its last value at full confidence — a stale field and a live one are byte-identical on screen and nearly identical in code. There is no ownership record saying who re-derives what and on what trigger, so no reviewer can see a mirror going stale, and the app's own spec can document the gap without any surface changing.

**The question a UI system must answer:** *Which values are allowed to be stored rather than derived, what re-derives each one and on what trigger — and how does the UI itself mark a mirror as a mirror, so a value that has not been re-checked can never read as a fresh measurement?*

**Instances:**

- RENTALS — markFieldCall(rentalId) reads only r.unitId, documented as the PRIMARY-unit mirror (app.js:345-349, resynced every load at 368) and never the clicked unitId, which is in scope at both call sites (app.js:20045, 20264). The genuinely broken non-primary machine never gets inspectionStatus='Failed', so isUnitAvailableFor (app.js:2064-2067) keeps it bookable, while the untouched primary is flagged Failed and receives the work order. CONFIRMED; fixed in PR #740 — the mirror pattern it exploited is untouched.
- Customers — repo-wide grep found zero writes to payStatus outside the five creation paths, all of which set 'New Customer', and there is no in-app editor for the field at all (the column that looks editable is read-only display). The team's own spec, docs/specs/customers-crm.md:642-650, dated nine days before this audit, already records: no derive-from-open-invoices pass exists, "STILL an open question."
- UNITS — startHours / returnHours exist on every rental unit entry, are seeded with real values and are humanized for the audit log (app.js:22577), but grep for their assignment returns zero sites and nothing rolls returnHours into unit.currentHours. A machine goes out three weeks, comes back 180 hours older, and every service countdown derived from that meter moves by zero unless someone hand-types it into the one manual field that writes currentHours (app.js:19644).
- UNITS — the WO phase pill is frozen at creation because the only code that advanced it lived in the retired Shop-card renderer; and qtyOnHand renders as live stock on a work-order line but is never decremented when a part is consumed. Merle works a job all day and his tile never changes.
- Calendar / Driver — state.tripsSyncStatus starts null and only flips to 'synced' after a push/pull succeeds, so the pinned footer reads "Offline — cached" regardless of real connectivity on first paint, and nothing re-checks after that first success, so it reads "Synced" just as readily after signal is lost (app.js:2502, 11390/11413, 11499).

## 21. Names That Don't Describe The Effect

**4 cards** · scope: `interaction` · Categories, UNITS, Calendar / Driver, RENTALS

Controls and metrics are labelled for what someone assumed they did, and the label survives the code changing underneath it — so the user's model of the screen is built from text the screen no longer honours.

**Why it persists:** Labels are string literals at the render site with no link to the predicate, formula, or handler behind them, so changing a behaviour costs nothing and updating its words is a separate act of memory that nothing enforces or tests. Metric names in particular were chosen from the business question the owner asks ('On-Time') rather than from the formula that was actually available, and once shipped the name became the spec that nobody re-read against the code.

**The question a UI system must answer:** *What binds a control's label to the operation it performs and a metric's label to its formula — including its population and its period — so that changing the behaviour forces the words to change with it?*

**Instances:**

- Categories — the circular icon on a filter chip reads as a clear/remove control and actually negates the filter. Live-confirmed: clicking it turned the chip red ("excluding") and the list visibly changed, so the natural read is "it worked" — while the user is now viewing the exact complement of what they asked for. No remove control appears on hover either (app.js:3287-3297 + 19041, which checks .js-ft-neg first and returns before reaching the actual remove path).
- UNITS — 'Sold/Inactive' and 'All Units (any status)', two controls that change which machines exist, sit under a menu header reading SORT alongside controls that only reorder, with no visual distinction between the two kinds. Picking one expecting a reorder gets a scope change.
- Calendar / Driver — the KPI labelled 'On-Time' (config.js:311) is computed as delivered-or-handled ÷ scheduled (app.js:10015): a completion rate with no comparison to t.time or the implicit 5PM deadline anywhere in the formula. A driver late on every stop who eventually finishes them all scores 100% on the metric the app grades him on.
- RENTALS — six empty-slot toasts (app.js:19046, 19054, 19082, 19574, 19579, 19592) instructed the user to 'drag', a touch gesture retired 2026-06-29 (app.js:17813), with no is-phone branch — while a phone finger-drag was silently disarmed and the only real path was an unsignposted 500ms long-press. Copy fixed in PR #740; the label-outlives-behaviour mechanism did not change.
- Categories — the sort menu offers ROI, Unit Count and Avg Hours as sort fields, none of which the default mini-card face renders, so choosing one reshuffles the entire grid on a criterion the user cannot see.

## 22. Every Card Grades Its Own Homework

**4 cards** · scope: `signal` · UNITS, Categories, RENTALS, Customers

'Is this OK / available / attention-worthy' is recomputed independently on every card from a different subset of the same shared flag registry, so the same machine or customer answers differently depending on which card you are standing on.

**Why it persists:** The flag registry is a shared vocabulary but not a shared computation. Each surface builds its own predicate at the point of render, and each one is individually correct for the question its author had in mind. Nothing forces a new consumer to declare which definition of 'OK' it means, and no test ever compares two surfaces' answers about the same record — so divergence is invisible until two of them appear on screen 40 pixels apart.

**The question a UI system must answer:** *What is the single authority that answers 'can this go out / does this need attention,' and how does every surface — badge, bucket, drag target, count, graph, sort — become a view of that one answer instead of its own private copy?*

**Instances:**

- UNITS: the drag-drop filter that governs what can actually attach to a customer rental checks only fleetStatus==='Active' (app.js:17568). Worm — failed inspection, 2,882 hrs overdue on service — attached instantly, and a search of the entire rental detail for 'failed, not ready, overdue, service, inspect, warning, caution, unsafe' returned nothing. isUnitRentable (app.js:2251) DOES exclude failed inspections but only feeds the availability COUNT. Two competing definitions of rentable, one of which never touches the gate.
- UNITS: unitsAlertCount (app.js:9479) watches 3 of the 10 registered flag conditions, ignoring failed inspection, overbooked, GPS offline, coverage-expired and uninsured-active — including the two that put an unsafe or uninsured machine on the road. The tab badge, card border, corner-flag pill and group bucket each reimplement their own different subset of the same 10-flag registry.
- UNITS: the Worklist graph reads 'NOT READY 28' while the group bar roughly 40px below it on the same screen reads 'NOT READY · 8' — the graph tallies every unit in DATA.units (app.js:12167-12170), the list excludes out-of-fleet and on-rent units first (app.js:9295), and a third narrower definition lives elsewhere.
- Categories: same category, same second — the 12k Excavator mini-card reads 'NEXT MON' (zero free) while the detail reads '9 Available', because unitRentalBucket (app.js:2300-2305) has no fleetStatus check and the mini-card (app.js:7216-7225) restricts to Active. Lift Scissor 19ft: mini-card '2 Avail' vs detail '5 Available' — the 3 extra are sold machines.
- Categories: Categories has ZERO entries in the shared flag engine (FLAG_META config.js:237-297, FLAG_COND app.js:5833-5924, both carrying the same 5 entity keys) — no getEntityFlags('categories', ...) call exists anywhere, so no condition on a category can ever escalate past its own mini-card pill.
- RENTALS: GROUP_DEFS.rentals keys buckets off lifecycle status (rentalRevStatus, app.js:1986-1990) and never consults a flag, unlike UNIT_SECTIONS which has an explicit red 'Attention' bucket fed by unitStageKey (app.js:9312-9316 vs 9279-9290).
- Customers: the row computes an accurate live owed/overdue figure from real invoices every render, while the group header, the sort field, the filter and the pulsing detail flag all read payStatus — a stored field with zero write sites outside the five creation paths, all of which set 'New Customer'. 2,260 of 2,265 customers therefore fall into an unnamed grey leftover bucket; only 5 sit under 'Current'.

## 23. Nobody's Name On Any Job

**4 cards** · scope: `architecture` · UNITS, Calendar / Driver, RENTALS, Customers

Work is never addressed to a person. Assignment fields are stored, displayed, edited and searched, but no view is ever scoped to 'mine' — so every worker reconstructs their own queue by reading the whole board.

**Why it persists:** The app is modelled as a set of entity browsers — units, customers, categories, rentals, trips — where a person is an attribute on an entity rather than a lens over the board. ROLE_LANDING sets a starting view but never a filter, so 'who is this for' has nowhere to live in the render path. Assignment therefore reads as documentation rather than as routing, and nobody's screen changes when it is set.

**The question a UI system must answer:** *What does 'my work' mean for each role, and which surface is authoritative for it — so that assigning a job is a routing decision that changes another person's screen, not a text field on a record?*

**Instances:**

- UNITS: assignedMechanic appears 17 times across the codebase — stored, displayed, edited, searched — and is never once used to route, filter, badge or scope a view. Every auto-created work order is born with it blank (app.js:20009, 22445, 23005). There is no 'assigned to me' filter or badge keyed off the field and the logged-in identity anywhere in the app.
- Calendar / Driver: tripsFor() / dispatchEvents() apply ZERO identity filtering — every driver's trips plus the entire unassigned pool render on one shared list, even though the code's own landing comment calls this screen 'the driver's day' (app.js:11285-11302, 9674; comment at 25636-25644). myRosterId() already exists (app.js:10582) and is used to scope team-chat visibility, and is never wired into the Trips list.
- UNITS: the one proactive notification bell a mechanic sees reads 'Transports due · 2' — a dispatch concern — and the panel holds exactly 6 items, all invoices and card payments, none role-filtered for a mechanic.
- RENTALS: no per-rental 'text driver' or 'text customer' action exists on the row or the detail; reaching a thread is a 2-3 screen detour, and the nearest one-tap contact is the roster-wide 'Text the Crew' broadcast buried in Settings.
- RENTALS: there is no daily digest or morning brief — nothing summarizes returns due, field calls and unpaid balances at clock-in. The data all exists and is never composed into a start-of-shift view.
- RENTALS: on a day-one empty roster the +Driver chip is suppressed, and the 'add drivers first' hint fires only FROM that suppressed chip (app.js:7356/7359, 18614/18618) — the guidance is gated behind the control that hides when the precondition is true.
- Customers: across 400 rendered production rows, 96% of rows carrying a balance had a clipped phone number (22 of 23) versus 25% of rows without one — a customer owing $13,240.52 rendered as '(337) …'. The accounts she most needs to call are precisely the ones whose number she cannot read.

## 24. Last Save Wins, Quietly

**4 cards** · scope: `interaction` · UNITS, Categories, Customers, RENTALS

When two people touch the same record from two cards, one person's work is discarded with no notice to either of them — and the sync that would have revealed the change is skipped at exactly the moment someone is working.

**Why it persists:** The sync layer was built to keep ONE person's screen fresh, not to arbitrate between two people's edits, so its only concept of conflict is 'local is dirty, keep local.' Because the loser is never told and the winner never knows they won, the failure produces no report at all — it reads as somebody forgetting to save, which is why it has survived.

**The question a UI system must answer:** *When two people work the same record from different cards, what does each of them see — and what is the app obliged to say when their edits collide, instead of picking a winner silently?*

**Instances:**

- UNITS: sync is whole-record last-write-wins with no field-level merge and no conflict notice of any kind. If the local copy of a unit has any unsaved edit, the incoming remote version is discarded entirely and the local record is pushed over it on the next flush; the only reconciliation branch in the whole 18-second poll is a narrow invoice-id collision heal — units get none (app.js:24778). Concretely: Merle types an hour-meter reading in the yard while Dale completes the 250-hour service in the shop, and one of the two entries is silently destroyed.
- Categories: refreshFromBackend patches remote data into local records with a plain Object.assign + render() and no changed-key capture; no 'recently changed' CSS class, flag or highlight logic exists anywhere in the file (app.js:24823-24866, 24848, 24863). A rate can change under a rep mid-shift with zero visual cue — including the rate he is about to quote out loud.
- Categories: the same poll is guarded at app.js:24825 on document.hidden / DRAG / overlay / hoverNode — so with any popup open (a rental, Mr. Wrangler, Settings, all common) the refresh does not run at all and the user silently stops receiving updates for as long as he is working.
- Customers: clicking an invoice belonging to a different customer than the one currently open silently spawns a whole new session tab and swaps all three columns, with no cue distinguishing 'a new tab opened' from 'the view updated' (app.js:2718-2727, 2608-2625) — confirmed intentional in a 'Task 5' comment, shipped with no signal.
- RENTALS: scroll 'preservation' is positional, not record-anchored — scrollMemo is keyed only by card|view and restored by raw pixel offset (app.js:17185-17190, 17229-17234), and status is a selectable sort field (config.js:431). Acting on a row re-sorts the list and lands the viewport on a DIFFERENT rental, while the toast says only 'Status → X' with no cue about who was hit. Verifier CONFIRMED.
- Calendar / Driver: the app-wide scroll memory reads/writes .card-body's scrollTop across 5 call sites, but on Trips .card-body is overflow:hidden and the real scroller is .cal-scroll — so a driver reading his list is snapped to the top by an 18-second background poll triggered purely by office activity elsewhere, with zero visible cause (style.css:900-901; app.js:17186-17190, 17229-17233, 24792).

## 25. Gates are attached to controls, not to data

**3 cards** · scope: `architecture` · UNITS, Customers, Categories

Permission is enforced wherever someone remembered to enforce it — on a specific button, inside a specific renderer — never on the datum itself. So the same value is masked on one surface and printed on the next, and the authority to create a record is decoupled from the authority to make the created thing safe.

**Why it persists:** There is no classification on the data — no 'this field is money/margin/PII tier' property that every renderer, column definition, sort key, chart and export must consult. Gating is therefore a per-call-site decision made by whoever wrote that call site, and every new surface reading the same field starts ungated by default. The create/edit asymmetry is the identical absence seen from the other side: authority was assigned to handlers, so no one ever compared two handlers on the same object.

**The question a UI system must answer:** *What marks a field as money/margin/PII-tier at the data layer so every surface that can display, sort, chart or export it inherits the gate automatically — and what forces the authority to create a record and the authority to make it safe to use to be the same authority?*

**Instances:**

- Customers: dollar figures are deliberately masked to $••• in the History log for roles without money permission, while the invoice list, open-balance strip, Transactions tab and 'total paid' stat on the very same customer screen render live amounts with no role check at all — and the Customers card has no role gate on opening it, so a mechanic or driver login sees every customer's live balances and payment history in full.
- Categories: ROI/margin is money-tier-gated in the detail view, but the same categoryStats().roi value is registered as an ungated list column with a coloured pill in the card's default layout AND as an ungated sort key — a below-money-tier user can read the exact percentage off the list or infer the whole fleet's profitability ranking just by sorting on it.
- UNITS: the Round-Up Reports board's Money section — revenue, net sales, top customers, open account balances — renders unconditionally for every signed-in role with no permission check.
- Categories: the authority matrix is inverted — creating a category is completely ungated (no admin check anywhere on the create handler) while editing a rate field on that same category is explicitly admin-gated. A non-admin can mint unlimited live categories but cannot price any of them, which is plausibly how the observed unpriced live LIFT SCISSOR 19FT record came to exist and show a bright green availability pill over $0 rates.
- Customers: adding a card on file is gated to Office/Admin with a toast; removing one, or changing which card is the default, has zero permission check twelve lines below.
- Categories: the same absence over-gates in the other direction — the Category field on a Unit renders as an admin-gated reassignment select rather than the ordinary navigable pill Rentals and Work Orders use for the identical reference; and the audit-log redaction blanks the entire line ('1-Day rate: $••• → $•••') so a lower-tier viewer cannot even see THAT a rate changed.

## 26. Everything still assumes one record per thing ⁿ

**3 cards** · scope: `architecture` · UNITS, Calendar / Driver, RENTALS

The data model grew multi-unit rentals and merged multi-stop trips; the UI and its logic did not. Wherever a container holds more than one child, the app silently substitutes the primary child for the whole — acting on the wrong record, hiding the worse one, and counting progress as zero until everything is done.

**Why it persists:** Multi-unit rentals and merged trips were introduced as a data change with a compatibility shim — a scalar primary mirrored off the array and resynced every load. Every consumer written before the change kept reading the shim, and because the shim is always populated, nothing ever throws: the wrong record is simply acted on. The failure only becomes visible out in the physical world (the wrong machine gets the truck), which is why it survived until RENTALS was walked against real multi-unit data.

**The question a UI system must answer:** *When a record contains many, what is the rule for which one an action targets, which one a summary reports, and how progress across the set is displayed — and what makes the legacy primary-scalar shim unreadable to new code so this class cannot be reintroduced?*

**Instances:**

- RENTALS: markFieldCall(rentalId) reads only r.unitId — documented as the PRIMARY-unit mirror (app.js:345-349, resynced every load at app.js:368) — and never the clicked unitId, which IS in scope at both call sites (setUnitCondition's Fail path app.js:20045, and the +FC yard capture app.js:20264). The broken non-primary unit never gets inspectionStatus='Failed', so isUnitAvailableFor (app.js:2064-2067) keeps it bookable, while the untouched primary is wrongly flagged Failed and receives the work order (wo.unitId:r.unitId, app.js:20009).
- UNITS: cascade.js's addRental still matches rentals by the legacy scalar r.unitId only, ignoring the units[] array real multi-unit rentals carry — explicitly noted as the same anti-pattern as markFieldCall. Anchoring unit #2 or #3 of a multi-unit rental finds nothing and cascades to an empty Rentals column.
- Calendar/Driver: on a merged trip the Log Delivery button is hard-scoped to the primary stop's own record but gated on the whole trip's done state — after logging the first of two stops it still reads 'Log Delivery,' pointing at a capture already completed, so the driver either re-records a video for nothing or stops mid-run to puzzle out which stop it means.
- Calendar/Driver: a merged trip is marked done only when every one of its stops is done, and the group header's '· N done' suffix counts whole trips rather than stops — four stops with three logged contributes zero to 'done.'
- UNITS: the same collapse inside a single record — a unit's tile surfaces only its newest open work order with no total count, so an older and more severe WO alongside it is entirely masked; and completing one blocking work order while a second remains open reports plain success with no explanation for why the unit is still red.

## 27. The Status Field Has Two Owners ⁿ

**3 cards** · scope: `architecture` · RENTALS, Calendar / Driver, Customers

One status control is simultaneously dispatch's lifecycle timeline and accounting's authority gate, and the money system only guards the four statuses that mean 'going out' — so every exit path from a rental closes the job with no billing check at all.

**Why it persists:** There is no state machine — status transitions are a list of buttons rendered from an order array (app.js:16851) with the gates hand-written at individual call sites. BOOKING_STATUSES is a booking-team constant that the billing gates borrowed as a convenient scope, which encodes 'protect the front door' as a permanent architectural fact. Every new status added later inherits zero gates by default, because a gate only exists where someone remembered to type one.

**The question a UI system must answer:** *Who owns a status transition — the subsystem that names the status, or every subsystem with a stake in it — and where does a transition's full precondition set live so that adding a new status cannot silently inherit an empty gate list?*

**Instances:**

- RENTALS: the invoice hard-gate fires only for val==='On Rent' (app.js:19911); blacklist / rental-rules / card / account-block gates are all scoped to BOOKING_STATUSES = ['On Rent','Reserved','Today','Tomorrow'] (app.js:19751). 'Returned' is in none of them, and the status dropdown is a free-jump timeline where every node is a live button with no disabled state — so a dispatcher opens a fresh Reserved rental with invoiceId still null, clicks 'Returned', and the job closes out unbilled. Verifier: CONFIRMED, critical.
- RENTALS: Cancel / No-Show strips billing in the same click that moves the lifecycle (app.js:19929) — one dispatch gesture silently executing an accounting decision, no confirm, no undo affordance, and rentalCleared+rentalsVisible (app.js:442-443, 6802-6807) drop the row instantly with no fade.
- Calendar / Driver: the log-gate ('no invoice on this rental') is evaluated only when the driver taps Log Delivery, never when the row renders (app.js:20198) — an accounting precondition is enforced at the moment of physical work, hundreds of miles from the person who can satisfy it.
- Customers: 'Pay Cancellation' charges the saved card in full on tap (button app.js:4100 → handler app.js:18452 → charges at app.js:4975-4989), the only money action on the card that skips the shared payment-review overlay every other charge uses (app.js:21392).

## 28. Every Renderer Computes Its Own Truth

**3 cards** · scope: `signal` · Customers, Categories, UNITS

There is no shared definition of 'available', 'owed', or 'how many' — each renderer derives the number inline against its own filter, so two subsystems print contradictory answers to the same question inches apart on the same screen.

**Why it persists:** The app has no selector or derivation layer. isUnitRentable / RENTABLE_SKIP_FLEET exists at app.js:2251 as a root definition, but nothing obliges a renderer to use it, so each card's author re-derived availability inline against the filter that made their own view look right. Once two inline derivations exist, the divergence is invisible in code review because neither is wrong locally — only the pair is wrong, and the pair only meets on screen.

**The question a UI system must answer:** *Where does a business quantity get defined exactly once — and what makes it structurally impossible for a renderer to compute 'available' or 'owed' itself rather than asking for it?*

**Instances:**

- Customers: the row computes an accurate live owed/overdue $ from real invoices every render (app.js:7149-7161), while the group header, the sort field, the filter, and the pulsing detail-view flag all read a separate stored field written once at signup and never updated by any client code (app.js:9317-9319, 8351-8352, 5886, 5897, config.js:430; the only writes are at app.js:21102, 21144, 21238, 21309, 15804). Two contradictory answers to 'does this person owe us' sit inches apart.
- Categories: the detail availability count and the mini-card availability count disagree — unitRentalBucket files any unit with no active rental as 'Available' regardless of fleetStatus (app.js:2300-2305), while the mini-card correctly restricts to fleetStatus==='Active' (app.js:7216-7225). Dispatch's 'available' and the counter's 'available' are different words spelled the same.
- UNITS: the mechanic's Worklist graph tallies the whole fleet (app.js:12167) while the list it filters into hard-filters to Active first (app.js:9295) — tapping a segment yields fewer rows than the number promised, with no explanation. Separately the Work Orders bar counts open WOs but its click filters by unit (app.js:12170), so a unit carrying 2 open WOs is one row and two counts: the bar structurally cannot match the rows beneath it.
- Customers: the spend chart sums rental list price over a 9-month window (app.js:4685-4693) while the account stat beside it shows the server-computed amount actually paid (app.js:7769-7789) — different basis, different period, neither labeled.
- Categories: the Time Utilization denominator counts every unit ever assigned to a category including Sold / For Sale / Inactive (app.js:12740-12741), and revenue/ROI still counts the derived price of Cancelled and No-Show rentals (app.js:2227 unitTotalRevenue, app.js:12396 ruCatMoney) — while ruCatUtilProxy, in the same file, already excludes them.

## 29. Permission Is A Per-Renderer Opinion

**3 cards** · scope: `architecture` · Customers, Categories, UNITS

Authority is enforced at individual widgets rather than at the data, so the same value is masked on one strip and printed plainly on the next, and the two gate functions in the app disagree about who an unassigned user even is.

**Why it persists:** Gating is a call-site decorator (admin:true on a field, canMoney() around a block) rather than a property of the data being read. A value therefore carries no classification with it, so the moment the same value appears in a second surface — a list column, a sort key, a chart, an audit line — that surface starts from ungated by default. There is no inventory of where a sensitive value is rendered, so leaks are additive with every new view.

**The question a UI system must answer:** *Does sensitivity attach to the value or to the widget — and if a field is money-tier, what makes it impossible to surface that field in a column, a sort, a graph, or an export without inheriting the gate?*

**Instances:**

- Customers: dollar figures are deliberately masked to $••• in the History log for roles without money permission (app.js:22582, 9165), while the invoice list, open-balance strip, Transactions tab and 'total paid' stat on the very same screen render live amounts with no role check (app.js:4685-4693, 4780-4808, 4887, 4892, 4813-4824).
- Categories: ROI is money-tier-gated with canMoney() in the detail (app.js:8916), but the identical categoryStats().roi is an ungated list column with a colored pill in the default layout (app.js:7487, 7562) and an ungated sort key (config.js:432, app.js:9239, 19208) — a below-money-tier user reads the exact percentage off the list, or infers the whole fleet's profitability ranking just by sorting. And the two gates disagree at the root: canMoney() (app.js:21348) is permissive on a blank role while adminUnlocked() (app.js:19776) is restrictive on the same blank role.
- Customers: adding a card on file is gated to Office/Admin with a toast, while removing one or changing the default card has zero permission check and zero confirmation — the ungated X sits at app.js:871, twelve lines above the gated Add at app.js:875, and reaches a live Stripe detach at app.js:820. Any logged-in role, including a mechanic or driver, can fire it.
- Categories: creating a category is completely ungated (app.js:19008/18946, no requireAdmin) while editing a rate on that same category is explicitly admin-gated (app.js:19213, app.js:8876-8931) — the authority matrix is inverted, and it is the exact mechanism that mints unpriced-but-instantly-rentable $0 records via quickAddCategoryFromSearch (app.js:21174-21251, all rates hardcoded 0).
- UNITS: the Round-Up Reports Money section — revenue, net sales, top customers, open account balances — renders to every signed-in role with no permission gate at all (app.js:12972).

## 30. Records And Conversations Are Two Different Apps

**3 cards** · scope: `architecture` · Customers, RENTALS, Calendar / Driver

The comms subsystem and the records subsystem share a shell but never touch: no record surface can start a conversation, the built per-record thread panel renders nowhere, replies aren't polled, and Settings sells three notification engines that don't exist.

**Why it persists:** Comms arrived as a self-contained dock with its own fetch, its own render, and its own state — never as a property of a record. Because no record type declares 'this entity has a conversation', wiring a thread into a card is bespoke work each time, and the one place it was done (the trip row) has stayed the only one. Settings toggles were shipped ahead of the engines to 'lock in intent', which means the UI now asserts capabilities the system does not have.

**The question a UI system must answer:** *Is a conversation a first-class attribute of a customer / rental / trip — and if it is, what one component makes 'contact the human attached to this record' available wherever the record is, so that a settings toggle can never describe an engine that isn't wired?*

**Instances:**

- Customers: no call, text, charge, or follow-up control exists anywhere on a customer row or in the detail (row app.js:7141-7183, funnel layer app.js:4233-4235, detail app.js:8826-8856) — the card only ever states facts. telHref is normalized at app.js:11742 and its only call site in the entire app is app.js:7368, the Rentals trip-row.
- Customers: commsCustSectionHtml() — a fully built per-customer conversation panel — has zero call sites anywhere in app.js, including a stale in-code comment claiming it renders.
- RENTALS: every outreach to a driver or customer about a specific rental is a 2-3 screen detour; the only one-tap contact in the app is 'Text the Crew', a whole-roster broadcast buried in Settings.
- RENTALS: refreshCommsThreads (app.js:26925) appears in neither of the only two setInterval calls in the codebase — a GPS-view timer (app.js:24080) and the 18s backend poll (app.js:24796) — and refreshFromBackend never calls it, so a customer reply sits unseen until someone manually clicks a comms chip or reloads. A failed comms fetch is fully silent: the catch resets a loading flag nothing reads.
- Calendar / Driver: assignStopDriver()'s only effect on success is pushing a line into a hidden per-rental audit array (app.js:11341-11352, 22575) — no toast, no badge, no message to the driver being assigned. And there is no standing dispatch channel to reply on: every new Team chat starts with members: [] (app.js:10569-10570).
- Settings promises what doesn't exist: 'Driver Assigned' ('Texts a driver the moment a delivery or pickup is assigned to them') ships defaulted off with an in-code comment that it's inert until a later phase (app.js:5161, 5282, 5291), and the customer-reminder and dispatch-ETA toggles persist and save while their engines do nothing.

## 31. The Primary-Unit Mirror Meets Multi-Unit Reality ⁿ

**3 cards** · scope: `architecture` · RENTALS, UNITS, Calendar / Driver

A one-rental-one-unit identity from an earlier era is still the pointer that actions resolve through, so on multi-unit rentals and merged trips the app acts confidently on the wrong machine, the wrong stop, or nothing at all — while the clicked identity sits unused in scope.

**Why it persists:** r.unitId was never retired when multi-unit rentals shipped; it was kept as a denormalized mirror and is resynced on every load, which makes it permanently correct-looking and permanently available. Any handler written since then that needs 'the unit for this rental' finds a field with exactly that name and uses it, and the code reads fine because the mirror is real data — the bug only appears when the rental has a second unit. The same shape recurs wherever a container has a designated primary member: rentals→units, merged trips→stops.

**The question a UI system must answer:** *When one record contains many members, what identity does an action carry — and what makes it structurally impossible for a handler to reach for the container's primary when the user clicked a specific member?*

**Instances:**

- RENTALS: markFieldCall(rentalId) only ever reads r.unitId — documented as the PRIMARY-unit mirror (app.js:345-349, resynced every load at app.js:368) — and never the clicked unitId, which IS in scope at both call sites (setUnitCondition's Fail path app.js:20045, and the +FC yard capture app.js:20264). The broken non-primary unit never gets inspectionStatus='Failed', so isUnitAvailableFor (app.js:2064-2067) keeps it bookable, while the untouched primary is wrongly flagged Failed and receives the work order (wo.unitId: r.unitId, app.js:20009). Verifier: CONFIRMED. Fixed in PR #740 — the mirror remains.
- UNITS: the same legacy assumption trips the cross-card cascade — anchoring the non-primary unit of a multi-unit rental cascades to an empty Rentals column instead of the rental the unit is actually on (cascade.js:101).
- Calendar / Driver: on a merged trip the Log Delivery button is hard-scoped to the primary stop's record (app.js:7376-7380) but gated on the whole trip's done state (app.js:11586) — after logging the first of two stops it still reads 'Log Delivery', pointing at a capture already completed.
- Calendar / Driver: the group header's '· N done' suffix counts whole trips, not stops (app.js:11586, 9343) — four stops with three logged contributes zero to 'done'.

## 32. Machines Are Entities, People Are Not ⁿ

**3 cards** · scope: `architecture` · RENTALS, UNITS, Calendar / Driver

The flag, conflict and queue machinery was built for equipment and paperwork; drivers and mechanics are stored as strings on those records, so the same double-booking that pulses red on a machine is silent on a person, and 'assigned to me' does not exist anywhere in the app.

**Why it persists:** FLAG_META and FLAG_COND enumerate five entity keys — rentals, units, workOrders, invoices, customers — and a person is not one of them, so there is no place to register a person-level condition even if someone wanted to. Staff exist as free-text role strings and name fields on other records, which means every people-shaped question (is this driver free, whose queue is this, is this person actually a driver) has to be answered by string matching at a call site, and usually isn't answered at all.

**The question a UI system must answer:** *Are staff first-class entities with their own capacity, queue, and flag conditions — and what does a person's schedule collide against, given that the conflict engine currently only understands equipment?*

**Instances:**

- RENTALS: units get a pulsing 'Overbooked' flag when double-booked; drivers get nothing. Assign or 'Round up' writes a driver onto a transport leg with no time-conflict check at all (app.js:11341-11352, 18636) — one driver, two towns, same 9 AM, silently allowed. The asymmetry with the unit flag is the tell.
- UNITS: assignedMechanic is stored, displayed, searched and editable in 17 places across the codebase (app.js:20009, 22445, 23005 among them) and is never once used to route, filter, or badge anything — no per-mechanic queue of 'these are yours' exists in any form.
- Calendar / Driver: tripsFor() / dispatchEvents() apply zero identity filtering (app.js:11285-11302, 9674) — every driver's trips plus the entire unassigned pool render on one shared list, even though the code's own landing comment at app.js:25636-25644 calls this screen 'the driver's day'.
- Calendar / Driver: driverRoster() filters employees by /driver/i on the role field then falls back to returning every employee if that filter comes back empty (app.js:11281) — one blank or mistyped role makes bookkeepers assignable as drivers.
- RENTALS: the multi-driver lane rail and the one-tap 'Round up' auto-balance are still in the code (app.js:11802-11805, 18629-18636) but nothing renders their buttons, so with 12 stops and 3 trucks a dispatcher can only tap +Driver one stop at a time, with no 'who's carrying what' load view.
- UNITS: the mechanic's whole tailored landing is keyed off the hardcoded role strings 'mechanic'/'mtech' (app.js:25639) even though config.js:342 states role names are renameable and permissions must not key off them.

## 33. The Blink Points At The Calm One

**3 cards** · scope: `signal` · Customers, UNITS, Categories

Attention signals are wired to the wrong side of their own condition — pulses that fire unconditionally, predicates tested against values the data can never hold, booleans swapped — so the loudest thing on the screen is reliably the least urgent thing on it.

**Why it persists:** Alert conditions are ad-hoc booleans written inline at the render site, so no predicate is ever exercised against real values before it ships, and no test asks the only question that catches this class: does anything on this screen ever NOT pulse? An always-on animation looks correct in a screenshot and correct in review; it takes watching a whole list of production records to learn it means nothing. The same absence of a shared predicate layer means an inversion is a one-character mistake with no second reader.

**The question a UI system must answer:** *What is the single predicate registry that decides urgency, and what evidence must exist — that a predicate can both fire and not fire against production data — before any surface is allowed to animate, tint, or pulse on it?*

**Instances:**

- Customers — three separate pulse mechanisms are inverted or hardcoded backwards on one card: the rental-status badge pulses unconditionally for all seven active statuses, none of them red (app.js:8360); the pay-status pulse tests for a 'Paid' value customers can never hold, so every New Customer throbs like a debtor (app.js:8351-8352); and the membership billing flag has its booleans swapped, so "No Billing" (a setup gap) pulses while "Payment Due" (genuinely overdue) sits calm (app.js:3989 vs 3992).
- Customers — the red name tint saturates the default view at 44 of 60 rows (11 of the first 12), while a name search returned only 4 of 19 red. Where red is densest it carries the least information.
- UNITS — a pending wash unconditionally substitutes for the real worst service task in topServiceForUnit() (app.js:2206), poisoning five surfaces at once: card border colour, the WO/Service pill, the red service-past-due predicate itself, the countdown sort key, and two KPI tallies which explicitly skip wash-flagged units. A unit 40 hrs overdue on engine oil with a wash also requested shows a calm yellow "Wash Due" everywhere. The unit's own detail page (app.js:8134) gets it right by excluding wash — the correct pattern exists one function away.
- Categories — SKID STEER MINI shows "NONE · SOLD" directly above $280/1-day and $790/7-day, and the card border isn't even red in that state (it falls to neutral, because the Active-only free set is empty), so a single pill is the only warning against quoting a machine the yard no longer owns.

## 34. The Confirmation Doesn't Name The Record ⁿ

**3 cards** · scope: `interaction` · RENTALS, Customers, Categories

Actions commit against a record other than the one clicked, and the receipt — a toast, a highlight, a restored scroll position — is generic enough to endorse the wrong one.

**Why it persists:** Actions are addressed by whatever id is nearest in scope at the call site — rentalId when unitId was also available — and feedback is written as a state string rather than as a statement about a record, so a receipt can never contradict the action even when the action was wrong. Positional rather than identity-based view restoration is the same mistake one layer up: the app remembers where the user was looking instead of what they were looking at. Both survive review because the happy path (single-unit rental, unsorted list, resolvable target) is the path anyone testing takes.

**The question a UI system must answer:** *What forces every mutation and every confirmation to carry the identity of the record it actually touched — the clicked id, not an ambient one — so that "which one did I just change" is always answerable from the screen alone?*

**Instances:**

- RENTALS — flagging a Field Call on a non-primary unit of a multi-unit rental dispatches the mechanic and the work order to the rental's PRIMARY unit (wo.unitId: r.unitId, app.js:20009) and leaves the machine that actually broke down bookable, because it never receives inspectionStatus='Failed'. The clicked unitId was in scope at both call sites and was never read. CONFIRMED.
- RENTALS — scroll "preservation" is positional: scrollMemo is keyed by card|view and restored by raw pixel (app.js:17185-17190, 17229-17234), never by record id. Status is a selectable sort field (config.js:431), so changing a status from the row re-sorts the list and lands the viewport on whatever rental now occupies that offset — while the confirmation toast reads only "Status → X" (app.js:19940), naming no rental. The one cue that would catch the substitution is the one that was never written. CONFIRMED.
- Customers — openInvoice() guards only the invoice's customerId being null (app.js:3057), then unconditionally mutates state, scrolls and glow-flashes even when the target customer record does not resolve — animating whatever decoy record already happens to be on screen (app.js:3066-3075).
- Categories — a filter chip set on one category persists and silently intersects with a pill clicked on a different category later: clicking a status pill on 12k Excavator returned a Light Tower, with two chips ("Not Ready · Light…" + "Ready · 12k Exca…") stacked and Back/Forward vanished. Live-confirmed. The result "looked like a normal list, just of the wrong machine."

## 35. Order Is A Claim Too

**3 cards** · scope: `signal` · UNITS, Customers, RENTALS

Sorting and grouping are presented as the answer to "what is most urgent", but the sort either doesn't run, is silently overridden by grouping, or is keyed on something that isn't time — and the control still reads as applied.

**Why it persists:** Grouping and sorting were built as two independent layers that were never given a precedence rule, so the one the user chose loses to the one they didn't. And sort keys are registered in config.js separately from the switch that implements them, which means a key can be advertised in the menu with no case behind it and fall through to the default in perfect silence. Nothing in the UI ever states the effective order, so a wrong order is visually indistinguishable from a right one — the only way to catch it is to already know the correct answer.

**The question a UI system must answer:** *What makes the effective ordering of a list legible and checkable on screen — including which axis won when grouping and sorting disagree — and what structurally prevents a sort option from being offered that no code implements?*

**Instances:**

- UNITS — measured live with sort explicitly set to Service Due: position 1 Highrise (440 hrs overdue), position 2 Worm (2,882 hrs overdue, shown only as "No GPS +1"), position 3 Reptar (2,025 hrs overdue), positions 4-8 five machines with nothing wrong at all, and only at position 9 Dirt Dauber at 1,139 hrs overdue — sitting inside the green AVAILABLE bucket. Grouping wins; buckets are decided by inspection status alone and service urgency never enters bucket assignment.
- UNITS — a machine that fails inspection mid-rental never reaches the Failed check at all, because unitStageKey() returns on the rental-stage branch (app.js:9296-9303) before line 9304 ever runs. It sits inside the collapsed "On Rent · 21" bar, indistinguishable at the header from 21 healthy rentals — the single scenario the mechanic role exists for.
- UNITS — the unit history log sorted on a module-level counter that resets to 0 on every page load (app.js:9153, 22568), so on production unit SPEECHLESS entries rendered Jun 17, Jun 17, Jul 18, Jun 22, Jul 18, Jul 13 — a shuffled deck, with real when+clock timestamps sitting unused in every record. Fixed in PR #741; the class of question it raises (does this sort key survive a reload?) applies to every other log view.
- Customers — measured element by element: sorting by "Pay Status" produced a list byte-identical to sorting by "Name"; sorting by "Last Invoice" produced reverse-alphabetical order with a duplicate customer name appearing twice and no reference to any invoice date. Both are declared in config.js:430, neither has a case in the switch at app.js:9223-9245, and both render as real, selectable buttons.
- RENTALS — flagged rows are never pulled or sorted to the top of their group, so a dispatcher skimming section headers on a busy "On Rent" section has no ordering signal pointing at the fire.

## 36. Silence Is Rendered As Success

**3 cards** · scope: `architecture` · Calendar / Driver, RENTALS, Customers

Failures, staleness and non-delivery produce no distinct state. A write that never landed, a poll that never runs, a fetch that errored, and a toggle whose engine was never built all leave a screen identical to the working case.

**Why it persists:** Error handling was written to the standard of "don't crash the render", and the app has no vocabulary for degraded state — no per-value freshness stamp, no queued/failed/confirmed distinction, no visual difference between "loaded" and "loaded a long time ago." Optimistic UI without a reconciliation channel means the happy path is the only path the screen can draw. The Settings toggles are the same failure one level up: intent shipped as UI against a pipeline that was never built, and because a toggle that does nothing looks exactly like a toggle that works, nobody could tell from the screen which kind they had.

**The question a UI system must answer:** *What does every value on screen carry to say when it was last known good and whether the last write to it was confirmed, queued or lost — and what is the single visual grammar for degraded, so that no failure anywhere in the app can render as a success?*

**Instances:**

- Calendar / Driver — uploadCaptureMedia posts the walkaround video once; on network failure the catch toasts "saved without it" for two seconds and the row still stamps green "Logged", visually identical afterward to a delivery whose video landed (app.js:20280, 25426). That video is the only defence against a later damage claim.
- Calendar / Driver — the pinned, non-scrolling sync footer is one of the few things visible on first paint, and it reads "Offline — cached" before any real connectivity check and "Synced" indefinitely after the first success, including after signal is later lost. No code path checks connectivity before a write at all, so a held or failed write in a dead zone produces no distinct signal either.
- RENTALS — a driver's field delivery blocked by an office-side booking gate silently discards the entire capture, recorded video included, with no queued retry and no visible block on the Trips side to see or clear (app.js:20256-20261, 529).
- RENTALS — refreshCommsThreads (app.js:26925) appears in neither of the only two setInterval calls in the entire 27,649-line app.js (a GPS timer at 24080 and the 18s backend poll at 24796) and is never reached from refreshFromBackend, so a customer's text or email reply can sit unseen until someone manually clicks a comms chip or reloads.
- Customers — a failed comms fetch resets a loading flag nothing reads and leaves stale cached state on screen with no error; and Settings ships live, saveable toggles for customer reminders and dispatch ETAs whose engines are inert, so the toggle persists its own state and nothing is ever sent to anyone.

## 37. Closed Without Proof ⁿ

**3 cards** · scope: `architecture` · RENTALS, UNITS, Categories

Terminal states are recorded as accomplished facts without the app ever capturing the evidence that would make them true, and every downstream aggregate inherits the hole silently.

**Why it persists:** Status is modelled as a free enum on a record rather than as a transition with preconditions and required artifacts, so every value is one click from every other value, and the gates that do exist were bolted onto the single transition someone remembered ('On Rent') rather than onto the state machine. Nothing binds "this rental is closed" to "these things were captured", so a close is cheap, unverified and instantaneous — and every aggregate downstream is summing records that were never substantiated, with no way to tell a real close from an empty one.

**The question a UI system must answer:** *What must be captured and true before a record is allowed into a terminal state, and where does the UI show a close that is missing its evidence — rather than counting it, billing from it, and reporting it as complete?*

**Instances:**

- RENTALS — the invoice hard-gate fires only for val==='On Rent' (app.js:19911), and the blacklist/rental-rules/card/account-block gates are all scoped to BOOKING_STATUSES ['On Rent','Reserved','Today','Tomorrow'] (app.js:19751), which does not include 'Returned'. The status dropdown is a free-jump timeline with every node a live button and no disabled state, so a fresh Reserved rental with invoiceId still null can be clicked straight to 'Returned' — units flip and the job closes out, never billed. CONFIRMED, critical.
- RENTALS — 'Log Recovery' flips the unit to Returned stamping only {date, video, driver} (app.js:20259-20261): no condition capture, no inspection opened, no damage line. The Rental Protection $1,000 cap (app.js:4410-4411) can therefore never be exercised from the return path at all.
- RENTALS — the three terminal jumps (Returned / Cancelled / No Show) sit stacked as the last rows of one dropdown (order app.js:16851), each a plain button calling setRentalStatus with zero intervening step and no undo affordance, with Cancel/No-Show stripping billing in the same breath (app.js:19929) and the row dropping instantly from the list. The app already has a confirm precedent for WO completion (app.js:20648) that was never extended here.
- UNITS — because the hour meter is never captured on return, a rental can close as complete while the service countdown that governs whether that machine is safe to send out again has not moved by a single hour.
- Categories — nothing filters Cancelled and No-Show rentals out of revenue, so Round-Up Revenue reads 8k Excavator $79k and Skid Steer $77k while the Rentals card beside it shows "NO SHOW · 32" for the same period; unitRepairCost summed cancelled work orders on the expense side (app.js:2227, 12396, 2212), even though ruCatUtilProxy at app.js:12740 already excludes Cancelled/No-Show/Quote correctly.

## 38. Late Is the First Warning ⁿ

**3 cards** · scope: `signal` · RENTALS, Calendar / Driver, UNITS

Urgency is computed from deadlines that have already passed. Nothing buckets, counts or signals work that is due — only work that is overdue, and often not even that.

**Why it persists:** Grouping is keyed off lifecycle status — the noun a record currently is — and lifecycle status has no clock inside it. Deadlines live in date fields read only by the row renderer, so the only place time can express itself is a tint on a row someone is already looking at. Every card independently chose status as its grouping axis because status is the field that is always present; time is the field that requires a comparison.

**The question a UI system must answer:** *What is the app's model of 'due' as distinct from 'late,' and which surface is obliged to show it before the deadline rather than after — uniformly across returns, trips, services and inspections?*

**Instances:**

- RENTALS: an overdue return is invisible to every count, badge and toast in the app. off-rent-overdue is a red flag (config.js:245) that feeds only getEntityColor (row pill/border); commsBellCount = unseenNotifs() + visibleTransportAlerts() + wranglerRequests references none of it, and a past-endDate leg drops OUT of the forward-windowed transportAlerts so it is not even indirectly counted. The rentals column tab's alert is hardcoded false (app.js:9601) — only units get unitsAlertCount. No poll scans flags to fire a toast. Verifier CONFIRMED.
- RENTALS: recoveries get no bucket or signal until the day AFTER they are late — lifecycle grouping keys off status/start-date (app.js:2016-2017, 9312-9316), so a unit due back today sits in 'On Rent' with no distinguishing signal. The single most predictable dispatcher task of the day has no forward-looking bucket.
- Calendar / Driver: the Trips tab badge read 4 while the collapsed 'Earlier · 6 · 2 done' group held 4 more undone stops, two of them 78 days old — the badge counts only stops dated today-or-later (app.js:9471-9472). Nothing distinguishes 'history' from 'never got done.'
- Calendar / Driver: 'Earlier' is the only default-collapsed group/card combination in the entire app (app.js:9358) and its color is a hardcoded 'gray' literal that can never receive danger styling, since sec-danger only fires on color==='red' (app.js:9333, 9340, 9423). 'Today' is separately hardcoded red every day regardless of contents (app.js:9337), so red already carries no reliable signal.
- UNITS: a machine that breaks down mid-rental never lands in 'Needs Attention' — unitStageKey() returns on the rental-stage branch (app.js:9296-9303) before it ever reaches the inspectionStatus==='Failed' check on line 9304, which only fires for units with no active rental. The field-broken machine sits inside the collapsed 'On Rent · 21' bar, indistinguishable at the header from 21 healthy rentals.
- Calendar / Driver: a blank time box reads as 'nothing due' but the code silently treats it as a hard 5:00 PM cutoff (AUTORUN_EOD_DEADLINE_SEC) that never reaches the row unless a dispatcher has already run Auto-Run for that day (app.js:11906, 11929-11935, 7407).

## 39. Locks on Doors, Not on Jobs

**3 cards** · scope: `architecture` · Customers, Categories, UNITS

Permission is attached to individual controls rather than to the job those controls perform, so the same job is gated on one card, ungated on another, and inverted within a single file — and the gate does not travel with the work.

**Why it persists:** Gates are written at the call site by whoever builds the control, so the authority model is the sum of many local decisions with no registry of which JOBS are privileged. A job reachable from two cards gets two independent answers, and reaching it from a third is a fresh judgement call every time. Because the additive path (add a card, create a category) feels like the risky one, the gates land there and the destructive path a dozen lines below is left open.

**The question a UI system must answer:** *What is the enumerated list of privileged jobs — take money, remove a payment method, change a price, see margin, retire a record — and how does the gate travel with the job to every surface that can trigger it, including surfaces built later?*

**Instances:**

- Customers: adding a card on file is gated to Office/Admin with a toast; removing one — a live Stripe detach, not locally reversible — has zero permission check and zero confirmation, twelve lines below the gated Add (app.js:858-876, ungated X at 871 vs gated Add at 875, detach at 820). Measured off the card-health ring: 124 of 2,265 customers have a card and 2,141 do not (94.5%), and since a valid card is required before On Rent, those 124 are effectively the entire float — deletable by any logged-in role including a mechanic or driver.
- Categories: creating a category is completely ungated (app.js:19008/18946, no requireAdmin) while editing a rate on that same category is explicitly admin-gated (app.js:19213, admin:true on every rate field at 8876-8931). A non-admin can mint unlimited instantly-live rentable classes and price none of them — 7 of 46 live categories (~15%) are currently unpriced this way, and LIFT SCISSOR 19FT shows a bright green '2 AVAIL' pill above five em-dash rate tiles.
- Categories: ROI is canMoney()-gated in the detail (app.js:8916) but ungated as a list column (7487), included in the default layout (7562), and ungated as a sort key (config.js:432 / app.js:9239 / 19208) — a below-money-tier user can read the exact percentage or infer the whole fleet's profitability ranking by sorting. canMoney() (app.js:21348) is permissive on a blank role while adminUnlocked() (app.js:19776) is restrictive on the same blank role: the two gates disagree about who a no-role user is.
- UNITS: the Round-Up Reports Money section — revenue, net sales, top customers, open account balances — renders unconditionally for every signed-in role with no money-permission check (app.js:12972).
- Customers: dollar figures are deliberately masked to $••• in the History log for roles without money permission (app.js:22582, 9165), while the invoice list, open-balance strip, Transactions tab and 'total paid' stat on the very same screen render live amounts with no role check (app.js:4685-4693, 4780-4808, 4887, 4892). The Customers card has no role gate on opening it at all.
- Customers: 'Pay Cancellation' charges the saved card in full the instant it is tapped — the one control most in need of review is the only money action that skips the shared payment-review overlay every other charge uses (app.js:4100/18452/4975-4989 vs the 21392 overlay pattern). 'Cancel Membership' ends billing and generates a real cancellation invoice on the first click, despite an arm-to-confirm pattern sitting a few lines away on the same card's blacklist button (app.js:18639).

## 40. The Truck Loses To The Desk ⁿ

**2 cards** · scope: `interaction` · RENTALS, Calendar / Driver

Field capture and office bookkeeping share one status action, and when they disagree the office wins by destroying the field's work — the driver's evidence is thrown away, the block is invisible on his surface, and no queue holds the write.

**Why it persists:** The capture flow was built as a thin client of the office's write path rather than as its own durable system with its own queue. Because the gate is evaluated inside the status-setter and not before the capture UI opens, the only place it can fail is after the driver has already done the physical work — and the failure branch returns rather than persisting, since there is no offline write queue anywhere in the app (sw.js is 47 lines, documented 'OFFLINE SHELL ONLY').

**The question a UI system must answer:** *When a field action and an office precondition conflict, which one is allowed to lose — and what durable object holds the field's work, plus a visible block the field can see before loading the trailer, until the office clears it?*

**Instances:**

- RENTALS: a driver taps 'Log Delivery'; if the office never finished the card/invoice, the booking gate refuses the status move and the entire capture — recorded video included — is discarded (app.js:20256-20261, app.js:529). No queued retry, no visible block on the Trips side to clear, no way to even see the block from the field.
- Calendar / Driver: a failed sync during capture holds the pending write only in RAM while the banner instructs the driver 'Don't close the app' (in-RAM hold app.js:25405-25411, banner copy app.js:25426), against a code comment stating the local cache is never a save baseline (app.js:24576) — an instruction a phone user cannot honor, since the OS backgrounds and locks apps on its own.
- Calendar / Driver: uploadCaptureMedia posts the walkaround video once; on network failure the catch toasts 'saved without it' for two seconds and the row still stamps green 'Logged', visually identical to a delivery whose video actually landed (app.js:20280, 25426).
- RENTALS: the return path is worse — 'Log Recovery' stamps only {date, video, driver} and sets Returned (app.js:20259-20261), with no condition capture, no inspection open, no damage line, so the $1,000 Rental Protection cap can never be exercised from the return path at all (app.js:4410-4411).

## 41. Zero Is Not "I Don't Know"

**2 cards** · scope: `signal` · Categories, UNITS

The app has no representation for unknown. Divide-by-zero guards, falsy defaults and blank inputs all resolve to a confident 0, $0, an em-dash or a green all-clear that is typographically identical to a real measurement.

**Why it persists:** Falsy-coalescing (`|| 0`, `|| 1`, `v ? money(v) : '—'`) is the cheapest way to stop a renderer crashing on missing data, and it silently converts every absence into a value. Because it lives inside formatting helpers rather than at the data boundary, "we don't have this" never survives far enough to reach a surface — and the choice of which falsy shorthand to use is made independently at each render site, which is why the same 0 becomes "—" on one card face and "$0" on another. No reviewer sees a formatter inventing a number; the screen looks complete either way.

**The question a UI system must answer:** *What is the app-wide representation of "not known" and "not applicable", distinct from zero and from each other, and at what point in the pipeline is absence required to survive — so that a formatter can never manufacture a number the data does not contain?*

**Instances:**

- Categories — a category with zero units prints "0 HRS" avg hours and "$0" avg revenue/expense as if measured, because the guard `n = us.length || 1` makes 0/1 = 0 (app.js:2345, 2368-2370). ROI sitting right beside it correctly returns null and renders blank in the identical situation (app.js:2363). The app already knows how to say "no data" one line away from where it doesn't.
- Categories — a rate explicitly set to 0 renders as an em-dash "—" on the mini-card (truthy check, app.js:7271-7275) and as "$0" in the detail (efld's has-check treats 0 as present, app.js:8876-8879). The same stored value reads as two different things depending which surface you are on, and the data model has no distinct "no such tier" state at all.
- Categories — 7 of 46 live categories (about 15%) have every rate field unset and still show a bright green availability pill: LIFT SCISSOR 19FT reads "2 AVAIL" with both units inspection-passed and every rate tile an em-dash. The app internally labels the record "STUB — fill in pricing" (catRatesUnset, app.js:1113-1115) but that text lives only in a detail nobody opens.
- UNITS — a blank "hours at completion" when logging a service silently records the service at 0 hours, corrupting the countdown baseline for that task, with no reject and no default to the unit's current reading.
- UNITS — the "N on hand" part quantity on a work-order line is rendered as live stock but was never a measurement of anything: qtyOnHand is set once and never moves with usage.

## 42. One Red For Seven Reasons

**2 cards** · scope: `signal` · RENTALS, UNITS

Severity is stored per-condition but rendered as a single collapsed value, so a row can say "something is wrong" and not what — and each surface independently picks its own subset of the condition registry, so the surfaces disagree about whether anything is wrong at all.

**Why it persists:** A flag registry exists (config.js FLAG_COND) but it is a source of colours, not a source of truth: every consumer reads it through a hand-written filter, and severity is a flat enum per condition with no notion of which condition won or why it won. Because adding a condition to the registry adds it to no count, no badge and no bucket, the registry can grow indefinitely while the indicators keep their original, narrower meaning — and each new surface author, seeing four existing subsets, has no basis to pick one, so they write a fifth.

**The question a UI system must answer:** *When more than one condition is true on a record, what decides which the user is shown and how the record names its own reason — and what guarantees every count, badge, bucket and border across every card reads the same condition set, so that "no flag" means the same thing everywhere?*

**Instances:**

- RENTALS — FLAG_COND.rentals defines 7 conditions (fc, overbooked, unpaid-balance, no-card, unsigned-card, unit-failed, off-rent-overdue), ALL severity 'red'; getEntityColor collapses to fl[0].severity so the row renders one uniform red and the flag's name never appears on it (app.js:5834-5854, config.js:239-253). Verification scoped this honestly: 3 of 7 do get a distinct on-row echo (overdue relabels the pill, unpaid shows a coloured balance chip, unit-failed tints the unit name red), and 2 of 7 — no-card and unsigned-card — are genuinely unidentifiable without a desktop hover-preview or a hop to the linked customer.
- UNITS — unitsAlertCount, the only indicator visible before the card is opened, watches 3 of the 10 registered flag conditions (app.js:9479), ignoring failed inspection, overbooked, GPS offline, coverage expired and uninsured-active — including the two that can put an unsafe or uninsured machine on the road. The tab badge, the card border, the corner-flag pill and the group bucket each reimplement a different subset of the same 10-flag registry, so four mechanisms on one card disagree about "needs attention."
- RENTALS — GROUP_DEFS.rentals buckets on lifecycle status via rentalRevStatus (app.js:1986-1990, 9312-9316), which never consults a flag, unlike UNIT_SECTIONS (app.js:9279-9290) which has an explicit red "Attention" bucket fed by unitStageKey. Header counts never reflect severity and flagged rows are not lifted within their group. The Units card having the bucket and Rentals not is the systemic tell.
- UNITS — collapsed group headers render a label and a raw count only, with no red/yellow flagged sub-count, and collapse state persists per device/account indefinitely with no urgency floor to force a group carrying red back open (app.js:9429, 9358).

## 43. The Parallel Ledger

**2 cards** · scope: `architecture` · Customers, RENTALS

Where the official number cannot be trusted, staff have rebuilt it by hand in free-text fields — which is simultaneously the strongest proof the trust failures are real and a second, unvalidated source of truth the redesign now has to absorb rather than delete.

**Why it persists:** Every trust failure above has a cheap manual workaround available in some text field, and the workaround is completely invisible to the system: it throws no error, fails no validation, and appears in no metric. The defect therefore generates zero pressure — the app's own instrumentation reports a healthy screen while the real ledger migrates into strings. Over time the improvisation becomes infrastructure, which inverts the risk: fixing the broken sort or normalising the name field would now break the mechanism people actually depend on.

**The question a UI system must answer:** *For each state staff are currently encoding by hand, what is the structured, sortable, first-class field that replaces it — and how does the system detect that a workaround is forming, so a trust failure surfaces as a signal instead of quietly becoming someone's daily routine?*

**Instances:**

- Customers — of 860 rendered customer names on production, 25 carry business state typed into the name field: 13 owed-amount flags (e.g. "!!!Owes $X!!!"), 7 do-not-rent flags, 3 account-credit notes, 2 escalation-contact routings. This is not sloppiness — it is staff routing around three specific defects (two dead sorts, the frozen pay status, the vanishing Don't-Contact flag) by hand, every day.
- Customers — 23 of those 25 are prefixed with punctuation specifically because punctuation sorts above letters in alphabetical order, the one sort on the card that isn't broken. The workaround is load-bearing: it is a manual priority-sort mechanism built out of the name field.
- Customers — free-text note fields on individual accounts are used as an undated, ad-hoc "next follow-up" tracker, because no structured field for it exists anywhere on the card.
- RENTALS — the dispatcher assembles the day by scanning multiple cards because no daily digest or start-of-shift summary exists, even though every input (returns due, field calls, unpaid balances) is already in the data; and every outreach about a specific rental is a 2-3 screen detour whose nearest one-tap alternative is a Settings-buried whole-roster "Text the Crew" broadcast.

## 44. The Mirror Unit ⁿ

**2 cards** · scope: `architecture` · RENTALS, UNITS

A rental's identity as a set of machines is stored twice — the real units[] array and a scalar r.unitId 'primary' mirror — and every cross-card consumer reads the mirror, so work aimed at machine #2 or #3 silently lands on machine #1.

**Why it persists:** The scalar mirror was the original data model and is kept resynced on every load, so it is always non-null and always looks correct. Every new cross-card consumer reaches for the guaranteed-populated field instead of the array, which would force a loop and an explicit which-one decision. Nothing in the UI ever renders a rental as more than one machine, so the wrong answer never looks wrong to the person who caused it.

**The question a UI system must answer:** *When a rental holds more than one machine, which machine is the user pointing at — and how does that choice travel with every cross-card action (flag, work order, cascade, availability) instead of being re-derived from a mirror field?*

**Instances:**

- RENTALS: markFieldCall(rentalId) reads only r.unitId — documented as the PRIMARY-unit mirror (app.js:345-349, resynced every load at 368) — and never the clicked unitId, which is in scope at BOTH call sites (setUnitCondition's Fail path app.js:20045; the +FC yard capture app.js:20264). Flagging a Field Call on a non-primary unit fails the wrong machine, opens the work order against it (wo.unitId:r.unitId, app.js:20009), and leaves the actually-broken machine bookable because isUnitAvailableFor (app.js:2064-2067) never sees inspectionStatus='Failed'. Verifier CONFIRMED; fixed in PR #740.
- UNITS: cascade.js:101 addRental still matches rentals by the legacy scalar r.unitId, ignoring units[] — anchoring unit #2 or #3 of a multi-unit rental cascades to an EMPTY Rentals column. Explicitly noted as the same anti-pattern as markFieldCall, and parked pending the RENTALS audit.
- The boundary is UNITS→RENTALS→work order: the mechanic flags the machine he is standing at, and the repair is dispatched against a different machine, on a different card, with no on-screen contradiction anywhere.

## 45. The Empty Return ⁿ

**2 cards** · scope: `architecture` · RENTALS, UNITS

The end of a rental is the densest handoff in the business — machine, hours, condition, damage, money — and the return path records only {date, video, driver}, so three downstream cards derive their numbers from readings nobody was ever asked for.

**Why it persists:** The return is modelled as a status change on the rental, not as a data-collection event jointly owned by Rentals, Units and Invoices. The fields the next three cards need already exist in the schema and are even formatted for display — they were designed as read surfaces with no writer, because no screen ever asks the person physically standing at the returning machine for them. Status transitions are cheap to add; capture moments require deciding whose screen owns them.

**The question a UI system must answer:** *What single moment does the system treat as 'the machine came back,' and what is the complete set of readings — hours, condition, damage, invoice state — it must refuse to close without, regardless of which card or device the person is standing on?*

**Instances:**

- RENTALS: 'Log Recovery' stamps only {date, video, driver} and sets the unit Returned (app.js:20259-20261). No condition capture, no inspection opened, no damage line — so the Rental Protection $1,000 cap (app.js:4410-4411) can never be exercised from the return path at all.
- UNITS: startHours / returnHours exist on every rental unit entry, are seeded with real values and are humanized for the audit log (app.js:22577) — but a grep for 'startHours =' / 'returnHours =' across app.js returns ZERO assignments, and nothing rolls returnHours into unit.currentHours (app.js:23088). A unit goes out for three weeks, comes back 180 hours older, and its service countdown does not move by one hour.
- UNITS: the one field that does write the hour meter has zero validation — const v = Number(input.value); u.currentHours = v (app.js:19644). Live production on unit SPEECHLESS: Jun 17, 1732.3 → 17385.5 (Cameron); corrected Jul 13, 17385.5 → 1738.5 (Bri). A 10x typo stood for 26 days feeding every service countdown, the fleet hours average, category ROI and $/Hr, and got permanently stamped onto work orders.
- UNITS: a blank 'hours at completion' when logging a service records 0 with no reject and no default to the unit's current reading, permanently falsifying that task's countdown baseline (service-countdown.js:135).
- RENTALS: a rental can be jumped straight to 'Returned' having never been invoiced — the invoice hard-gate fires only for val==='On Rent' (app.js:19911), and the blacklist/rental-rules/card/account-block gates are all scoped to BOOKING_STATUSES = ['On Rent','Reserved','Today','Tomorrow'] (app.js:19751), which does not include 'Returned'. The job closes out unbilled. Verifier CONFIRMED, critical.
- UNITS: qtyOnHand is rendered on a work-order line as if it were live stock but is never decremented when a part is actually consumed (app.js:6169) — the same missing-write pattern one link further down the parts chain.

## 46. The Gate Fires in the Field ⁿ

**2 cards** · scope: `interaction` · RENTALS, Calendar / Driver

Office-side booking gates are evaluated at the instant of the field action, in the field worker's browser, against data he cannot see or fix — so the block destroys the field work instead of preventing the trip.

**Why it persists:** Gates were written as guards on a status transition rather than as preconditions on a job, so the only moment they can speak is the instant of the transition — by which point the driver is at the site with the capture already in memory. Office and field share one status machine but not one view of why it is blocked, and the field surface has no representation for 'blocked, and here is who clears it.'

**The question a UI system must answer:** *Where does a blocking condition become visible — at the moment of the block or at the moment the trip is planned — who owns clearing it, and what guarantees that field capture is never the thing discarded when a gate fires?*

**Instances:**

- RENTALS: a driver taps 'Log Delivery'; if the office never finished the card or invoice, the booking gate refuses the status move and the ENTIRE capture — including the recorded proof-of-delivery video — is discarded. No queued retry, no visible block on the Trips side to clear (app.js:20256-20261, 529).
- Calendar / Driver: the log-gate ('no invoice on this rental') is only evaluated when the driver taps Log Delivery, never when the row renders (app.js:20198) — a stop already blocked that morning shows no lock, no red flag, nothing, until he has driven the full distance. The information is computed; it is simply computed at the wrong moment.
- Calendar / Driver: uploadCaptureMedia posts the walkaround video once; on network failure the catch toasts 'saved without it' for two seconds and the row still stamps green 'Logged' — visually identical to a delivery whose video actually landed (app.js:20280, 25426). That video is the only defense against a later damage claim.
- Calendar / Driver: a failed sync during a capture holds the pending write in RAM only — a code comment states the local cache is never a save baseline — while the R25 banner instructs 'Don't close the app,' an instruction a phone OS will not honour (app.js:25405-25411, 25426, 24576). The practical result is a completed delivery log reverting to undelivered overnight.
- Calendar / Driver: state.tripsSyncStatus starts null and only flips to 'synced' after a push/pull succeeds, so the pinned, non-scrolling footer reads 'Offline — cached' regardless of real connectivity, and nothing re-checks after the first success — so it can equally read a false 'Synced' after signal is lost (app.js:2502, 11390/11413, 11499).
- RENTALS: the same gate family scoped to BOOKING_STATUSES lets a rental jump to 'Returned' with no gate at all — so the gates are simultaneously too aggressive in the field and absent at the close-out.

## 47. Born, Never Buried

**2 cards** · scope: `architecture` · Customers, Categories

Records mint from many paths with no lookup and can never be merged, retired or deleted — so a duplicate created at one card boundary permanently splits the history the next card needs.

**Why it persists:** Creation was added wherever a user hit a dead end — search-add, quick-add, chat-add — and each path was built to unblock that specific moment, not to reconcile with the book. Because a duplicate is a perfectly valid record, nothing ever errors; the cost lands weeks later on a different card, where a balance or a service schedule is simply missing rather than wrong.

**The question a UI system must answer:** *What is the identity rule for each entity — what makes two records the same thing — and where does a person go to reconcile, retire or merge when that rule was broken?*

**Instances:**

- Customers: no creation path — quick-add, full form, search-add, or the AI's create tool — checks for an existing phone, email or name before minting an id; all five mint via nextCustomerId() unconditionally (app.js:21276-21320, 21231-21250, 21088-21111, 21116-21150, 15801-15807). A captured production sort snapshot showed the identical customer name rendered twice, which means the rental attaches to one record and the payment history lives on the other.
- Categories: nothing in the app ever deletes, merges, retires or splits a category — DATA.categories is push/read/index-only. A typo'd or duplicate category is permanent and pollutes every grid, sort and picker forever. The de-facto workaround is retagging units one at a time through a bare <select> that commits on change/blur with no confirm and silently re-prices every open rental on that unit, since unitRentalPrice reads categoryId live (app.js:19669-19679, 1119-1123). A unit pointing at a nonexistent categoryId renders as literal text 'Unknown category' and '—' — neither actionable nor filterable.
- Categories: Models — the sub-entity carrying per-model maintenance schedules that OVERRIDE the generic service countdown — are append-only with no rename, delete or re-parent, and two independent creation paths neither of which does a name lookup, despite one path's own comment claiming it 'mirrors' find-or-create (app.js:19682-19683, 19708). Typing the same model name from two screens produces two divergent maintenance schedules with no way to merge them.
- The same codebase demonstrably knows how: Invoices ships a full merge flow (app.js:9000, 19098-19100, mergeInvoiceInto) and resolveOrCreateVendorByName (app.js:20483-20488) does a proper name-match lookup before creating. The entities built first got identity rules; the entities built later did not.
- Customers: 'New Customer' is a declared first-class blue pay-status in config (config.js:116-121) but the grouping list only names Unpaid/Partial/Current (app.js:9317-9319), so 2,260 of 2,265 customers fall into an unnamed hard-coded-grey leftover bucket appended last (app.js:9410-9411) — including customers who have rented for years and owe money right now.

## 48. The Name Field Ledger

**2 cards** · scope: `signal` · Customers, Categories

Where the system drops the baton, staff have already built a replacement by hand — typing business state into free-text fields and exploiting sort order to make it surface — which is the sharpest available map of what the handoff is missing.

**Why it persists:** Each card was built to display its own entity well. The state that spans cards — this customer is a credit risk, this account is escalated, this quote needs a blended rate — has no field anywhere, and no card claims it. The name field is the only thing that appears on every surface, in every sort, in every search result and in every picker, so it became the shared channel by default. The workaround is stable and effective, which is exactly why it will outlast any fix that does not replace it.

**The question a UI system must answer:** *What is the surface for state that belongs to no single card — the standing warning, the running note, the 'handle this one carefully' — and how does it travel with the record onto every card that displays it?*

**Instances:**

- Customers: of 860 rendered production customer names, 25 carried business state typed directly into the NAME field — 13 owed-amount flags (e.g. '!!!Owes $X!!!'), 7 do-not-rent flags, 3 account-credit notes, 2 escalation-contact routings — and 23 of the 25 were punctuation-prefixed specifically because punctuation sorts above letters in the one sort (alphabetical) that isn't broken. Free-text note fields on individual accounts are used as an undated 'next follow-up' tracker because no structured field exists.
- Customers: they are routing around three separate defects simultaneously — payStatus frozen at signup (the team's own spec, docs/specs/customers-crm.md:642-650 dated 2026-07-09, already documents it as 'STILL an open question'); red never saying why (44 of 60 rendered rows red, 11 of the first 12); and two of five sorts being dead no-ops that silently fall through to name order while the menu still shows them selected — 'Pay Status' produced a list byte-identical to 'Name', 'Last Invoice' produced reverse-alphabetical order.
- Customers: a customer's stored 'Don't Contact' stage renders as a red pill on the row and on the Sales pipeline board, but the customer-detail popup clamps the off-vocabulary value to a calm blue 'Lead' (app.js:212-219) — so opening the record to check the warning makes the warning disappear, which is precisely the kind of vanishing signal that pushes state into the name field.
- Categories: Mr. Wrangler has carried the correct answer the whole time — wranglerDigest bakes the live rate sheet into context (app.js:15092-15093) and find_categories / price_rental run the real blended pricing engine (app.js:15259-15262, 15320-15330) — but it is pull-only, never volunteered, and reachable only through a right-click, a gesture the counter persona has never performed. Meanwhile a 10-day rental that actually bills a blended $2,270 gets quoted at $3,600 off the four flat tiles, a $1,330 / 59% overquote, and 'nobody ever tells me I was wrong.'
- Categories: member day-rate ($120 on the 12k Excavator, $89 on the 8k) is a first-class stored, admin-editable field that is never rendered on the mini-card face — which shows only the four retail tiers ($440, $320) — so a rep reading the surface he actually looks at overquotes a member by 267%.
- Categories: every fresh session and every reload lands the left column on Units (config.js:419, app.js:2386), a card that carries no rate field at all, with no session-position memory and no role landing for a rate-facing role — so every price call begins on a screen that structurally cannot answer it.

