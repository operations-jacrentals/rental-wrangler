# CUSTOMERS card — audit backlog

Source: `/lazy-audit` persona walkthrough (persona: **Robin**, front-desk / counter sales rep),
two live drives against **production** (`origin/production` @ `0fac006`, `?v=20260718i`),
six lens agents, 22 adversarial refute agents, 3 gap critics.
Audit artifact: *Customers Card Audit — as Robin sees it* (private artifact).

**Verdict key** — `✓` refute pass confirmed · `≈` confirmed but narrowed · `✦` found by a gap critic ·
`▣` measured live on production · `!` self-corrected during the audit.

**Status key** — `PARKED` needs a product decision from Jac · `SAFE` no behaviour/UI/process change.

> Nothing in this file has been built. Each item ships as its own branch through
> `/build → /deploy → /merge → /promote`, wrangler-fix verified. Do not bundle.

---

## Tier 0 — Money & authority (a misclick costs real money or real data)

| # | Item | Where | Verdict | Status |
|---|---|---|---|---|
| A1 | **Card/bank remove + make-default are ungated and unconfirmed.** `Add` card is gated to Office/Admin with a toast; `remove`/`make-default` have no `canMoney()` check and no confirm, 12 lines below the sibling that does. Any role — mechanic, driver — can wipe a customer's only card in one click. `removeCard` fires a live Stripe detach, so it is not locally reversible. Only **124 cards exist across 2,265 customers**, so each one is scarce. | `app.js:858-876`, `18468-18473`, `803-822`; detach `820` | ✦ | PARKED |
| A2 | **"Pay Cancellation" charges the saved card in full on a single tap** — no review overlay, unlike every other money action which routes through `openPayInvoice`. | `app.js:4100`, `18452`, `4975-4989`; contrast `21392` | ✦ | PARKED |
| A3 | **"Cancel Membership" commits on first click** — expires the membership and raises a cancellation invoice for the remaining term, with no confirm. An arm-to-confirm pattern already exists on the blacklist button. | `app.js:4099`, `18451`, `4945-4974`; pattern `18639` | ✦ | PARKED |
| A4 | **Money masking is defeated on the same screen.** History masks `$` to `•••` for non-money roles; the invoice list, open-balance strip, Transactions tab and "total paid" directly above it print live amounts with no role check — and the card has no role gate at all. | masked `app.js:22582`, `9165`; unmasked `4685-4693`, `4780-4808`, `4887`, `4892`, `4813-4824` | ✦ | PARKED |

## Tier 1 — Correctness (the numbers are wrong or contradict each other)

| # | Item | Where | Verdict | Status |
|---|---|---|---|---|
| B1 | **Two pay-status engines run at once.** The row computes a live, correct balance from real invoices. The group header, sort, Unpaid filter and pulsing detail flag all read `c.payStatus` — written once at creation as "New Customer" and never reassigned anywhere in client code (no in-app editor exists; only the Sheets backend can change it). A customer can sit under a green **Current** header while their own row glows red. Root cause of the 2,260-in-one-bucket grouping and the `N/A` pay pills. Your own spec flags this open: `docs/specs/customers-crm.md:642-650` (2026-07-09). | live `app.js:7149-7161`; stored `9317-9319`, `8351-8352`, `5886`, `5897`, `config.js:430`; writes `21102`, `21144`, `21238`, `21309`, `15804` | ✓✦ | PARKED |
| B2 | **"Don't Contact" is laundered into "Lead" in the detail view.** The row shows a red Don't-Contact pill; `funnelCurrentStage` clamps the off-vocabulary value to the entry stage, so opening the record makes the warning vanish. Reachable today via Wrangler chat and CSV import; the 17 Jul migration doesn't purge it. The Sales board renders it correctly — the customer detail is the only place that hides it. | row `app.js:7164-7167` + `config.js:157`; clamp `app.js:212-219`; writable `15556-15561`, `15672`; migration `326-334` | ✓ | PARKED |
| B3 | **Two of five sorts are dead no-ops.** Proven live: **Pay Status returns a list byte-identical to Name**; **Last Invoice returns reverse-alphabetical**. Both fall through to the name default; only the declared direction differs. The menu ticks them as selected. These are the only two sorts an AR chase needs. | `config.js:430` declares; `app.js:9223-9245` switch has neither; buttons `17145`, `19208` | ✓▣ | PARKED |
| B4 | **`New Customer` is a first-class blue pay status the grouping config forgot to declare**, so ~2,260 records fall into the unnamed leftover bin, appended last and hard-coded grey. | `app.js:9317-9319` vs `config.js:116-121`; fallback `9410-9411` | ✦ | PARKED |
| B5 | **No duplicate-customer check on any of five creation paths** — quick-add, full form, search-add, quick-add-from-search, and the AI create tool all mint an id unconditionally. A repeat customer typed slightly differently splits his history permanently. (A duplicate name pair was observed live.) | `app.js:21276-21320`, `21231-21250`, `21088-21111`, `21116-21150`, `15801-15807` | ✓▣ | PARKED |
| B6 | **The spend chart overstates by ~17×.** One account, same screen: chart `$47,720 BEST · APR`; Transactions `$2,834.84 collected`, 1 payment, 0 refunds; 1-yr avg `$236.24`; open `$13,240.52` — and the caption still reads "No rental cadence yet." The chart sums rental *list price* over 9 months; the stat is server-computed paid. Nothing labels either. | `app.js:4685-4693` vs `7769-7789` | ✓▣ | PARKED |
| B7 | **`payBad` tests for a `'Paid'` status a customer can never hold**, so every `New Customer` pulses like a debtor. Dead copy-paste branch. | `app.js:8351-8352`; legal values `config.js:116-121` | ✓ | PARKED |
| B8 | **`membershipBillingFlag` alert booleans are inverted** — "No Billing" (a setup gap, nothing late) pulses; "Payment Due" (genuinely overdue) sits calm. | `app.js:3989` vs `3992` | ✦ | PARKED |
| B9 | **`alert:true` is hardcoded on the rental-status flag**, so all seven active statuses pulse — none of which are red — beside a genuinely red No-Card flag. | `app.js:8360`; `ACTIVE_RENTAL` `1971`; CSS `style.css:3887` | ✓ | PARKED |
| B10 | **Non-Business Members never get the green member tint.** `const isMember = c.accountType === 'Member' \|\| c.accountType === 'Business Member'` — but bare `'Member'` is not a legal `customerAccountType`. The *key* is `'Non-Business Member'`; `'Member'` is only its **label**. So the first disjunct is always false and a Non-Business Member is treated as a non-member for the name colour. A dead-code sweep flagged the disjunct as "safe to delete" — deleting it would have **cemented the bug and erased the evidence of intent**. The fix is almost certainly `'Member'` → `'Non-Business Member'`, but that *changes* which customers render green, so it is a decision, not a cleanup. | `app.js:7145`; legal keys `config.js:122-129` | ✦ | PARKED |

## Tier 2 — Built but unreachable (the code works; nothing renders the button)

| # | Item | Where | Verdict | Status |
|---|---|---|---|---|
| C1 | **Send-to-Collections and Recall are unreachable.** Manager gate, reason-code confirm, overlay, auto-blacklist and audit-log all work; the only trigger markup renders inside the retired standalone Invoices card. **Confirmed live** — the reachable invoice menu offers only *Pay · Print · Send(disabled)*. The only visible alternative is raw Blacklist, which skips all record-keeping. | orphan `app.js:8974-8979`; live handlers `18671`, `18692`; retirement `config.js:421-426`; reachable menu `app.js:4842-4856` | ✦▣ | PARKED |
| C2 | **Void-invoice is unreachable for the same reason.** A mistyped or duplicate invoice can never be retired from the UI Robin has. | orphan `app.js:8991-8995`; handler `18712-18716` | ✦▣ | PARKED |
| C3 | **`commsCustSectionHtml()` has zero call sites.** The per-customer comms section was built and never wired in; the developer's own comment describes where it belongs. | def `app.js:27620-27637`; renderer `8826-8856`; comment `8839-8844` | ✓ | PARKED |
| C4 | **Dead config for the retired Invoices card** — `RUS_TABS.invoices`, `SORT_FIELDS.invoices`. Cannot render; maintenance trap. | `app.js:12937`, `config.js:434` | ✦ | **SAFE** |

## Tier 3 — Comms, alerts & the team ("the silent yard")

| # | Item | Where | Verdict | Status |
|---|---|---|---|---|
| D1 | **Nothing on the customers surface is tappable to call or text.** Measured three ways on production — record open; 71 customer + 34 rental rows; a rental detail with **59 phone numbers on screen** — always **zero** `tel:`/`sms:`/`mailto:`. The `telHref()` helper ships and is unused here. Only non-context-menu send path in the app is the invoice detail's ghost pills. | phone as text `app.js:7147`, `8359`, `4395-4404`; helper `11742`; ctx-menu-only `6377`, `6351-6389` | ✓▣ | PARKED |
| D2 | **The 18-second poll never refreshes comms threads** — it pulls app data, team chat and the Wrangler rail only. An inbound reply won't surface until she manually reopens that category. | `app.js:24796`, `24752-24794` | ✓ | PARKED |
| D3 | **A comms fetch failure is silent** — the catch resets a loading flag nothing renders. A dead backend looks like a quiet day. | `app.js:26942` | ✓ | PARKED |
| D4 | **Failed sends leave no trace** — one 2.2s toast that overwrites in place; the invoice quote paths log nothing to history while successes do. | `app.js:17527-17530`; failures `22336-22344`, `22397-22407`, `27605-27617` | ✓ | PARKED |
| D5 | **Quiet-hours message is hardcoded `8pm–8am`** though the window is admin-configurable, and there is no pre-send hint. | `app.js:22402`, `27611`; real window `5147`, `5311-5312` | ✓ | PARKED |
| D6 | **The notification centre is a developer inbox.** Live: engineering tickets addressed to the owner, GitHub links, and **53 literal `**` markers across 17 lines** of unrendered markdown. Nothing customer-facing. "Transports due" — a dispatch concern — sits in the front-desk alert count. | observed live; render path TBD | ▣ | PARKED |
| D7 | **No customer-linked way to notify the team.** The labelled tool is a manager-gated crew blast carrying no customer context; the only path that carries it is an undiscoverable drag gesture. | blast `app.js:18665`; drag `17875-17882`, `11234-11241` | ✓ | PARKED |
| D8 | **Customer-reminder and dispatch-ETA toggles are live but inert** — Phase A saves the toggle, no engine acts. Anyone enabling them reasonably believes the app is chasing customers. | `app.js:5134-5141` | ✓ | PARKED |
| D9 | **No delivery or read receipts** — green means the provider accepted the outbound call, nothing more. | `app.js:26957-26965` | ✓ | PARKED |

## Tier 4 — Information design & layout

| # | Item | Where | Verdict | Status |
|---|---|---|---|---|
| E1 | **The more they owe, the less of their phone she can read.** Measured over 400 rows: **96% of rows with a money pill have a clipped phone** vs **25%** without. A `$13,240.52` account shows `(337) …`. Precisely inverted. | `app.js:7147`, `7152-7160` | ▣ | PARKED |
| E2 | **Red is the default state of the screen and never explains itself.** 44 of 60 rendered rows red; 11 of the first 12. A red row's DOM carries no flag word, no title attribute — the only tooltip belongs to the unrelated eye-preview. Flag label text exists only in the hover preview. *(Self-corrected: "every customer is red" was overstated — a name search returned 4 red of 19.)* | `5885-5900`, `5934-5938`, `7144-7146`; hover-only text `3009-3013` | ✓!▣ | PARKED |
| E3 | **Several red conditions render identically.** Narrowed on verify: it tints the *name text*, not the row; only three of five (no-card, lost, inactive) are truly indistinguishable — blacklisted and unpaid carry their own badges. | `config.js:284-296`; `app.js:5934-5938` | ≈ | PARKED |
| E4 | **Only 60 customers load; 2,200 sit behind a button that slows down every press.** Timed live: **547 → 658 → 803 → 1,044 ms** for the same 200 rows. Cost tracks *total* rows (~1.1 ms/row) ⇒ full list re-render each press. Reaching the end of the book ≈ 11 presses and >12 s of frozen screen. | `js-showmore` render path | ▣ | PARKED |
| E5 | **The balance is below the fold.** Detail order is identity → funnel → actions → action log → AR tiles → invoices. A `$13,240.52` account's header shows only *New Customer · Member · No Show*. | `app.js:8826-8856` | ▣ | PARKED |
| E6 | **The row's stage pill ignores the Rental funnel**, reading only `usedSalesStage`/`membershipStage` — so a customer reserved or on rent right now still prints a grey `N/A`. | `app.js:7162-7167` vs `147-159`, `197-199` | ✓ | PARKED |
| E7 | **Group headers carry no aggregate danger signal** — grouping is by pay status only, so a blacklisted or no-card customer at $0 sits under a green *Current* header. *(Narrowed: the red name tint still fires on the row.)* | `app.js:9317-9319` | ≈ | PARKED |
| E8 | **The account section is collapsed by default** — address, ID and notes hide behind a bar. *(Narrowed: the summary line does show company/phone/email.)* | `app.js:4714-4728` | ≈ | PARKED |
| E9 | **The desktop funnel shows one tab's body at a time**; the inactive tab is a colour dot with no text. | `app.js:4304-4307`, `4129-4134` | ✓ | PARKED |
| E10 | **An unarmed funnel layer reads `+ action` regardless of urgency** — a fresh lead looks identical to one gone cold. | `app.js:4233-4235` | ✓ | PARKED |
| E11 | **Row-hover actions (eye / +) overlay the row's right-hand pills** rather than sitting clear of them. | row actions `app.js:7033-7037` | ▣ | PARKED |

## Tier 5 — Navigation

| # | Item | Where | Verdict | Status |
|---|---|---|---|---|
| F1 | **A cross-customer invoice click silently spawns a new session tab** and swaps all three columns. Verified *intentional* — but ships with no cue distinguishing "new tab" from "view updated," and the way back is an unlabelled chip. | `app.js:2718-2727`, `2608-2625` | ✓ | PARKED |
| F2 | **A dead invoice link is a silent no-op** — no toast, no feedback. She clicks again and assumes the app froze. | `app.js:3064` | ✓ | PARKED |
| F3 | **`pillTo` doesn't guard an unresolved customer**, so `openInvoice` presses on and fires its scroll+glow on whichever record is already open — animating a decoy. | `app.js:3057`, `3066-3075` | ✓ | PARKED |
| F4 | **The Sales tab is a "Coming soon" placard sharing Robin's column.** Returning from it restores the record scrolled to the top, re-burying the balance. | `app.js:9617-9631`; tap reset `10462-10468` | ✓▣ | PARKED |
| F5 | **On phone, tapping a column tab resets the card to list view while swiping preserves it** — same destination, two outcomes. | `app.js:10462-10468` vs `26261-26284` | ✓ | PARKED |
| F6 | **Modifier-click on an invoice pill bypasses the retirement redirect** and anchors a tab on a card no column renders. | `app.js:2796-2801`, `18329-18332` vs guard `3042` | ✓ | PARKED |

## Tier 6 — Glitch & polish

| # | Item | Where | Verdict | Status |
|---|---|---|---|---|
| G1 | **The update toast overlaps the bottom alert-chip row.** Measured: toast `position:fixed`, `z-index:300`, box x500–920 y646–684; chip row y663–681; the chip at x438–588 is ~60% covered. Persisted all session. | toast render path | ▣ | PARKED |
| G2 | **One `.unavailable` class, two unrelated meanings** — permanent blacklist on customers, temporary window-unavailability on units. *(Downgraded to polish: units use a separate class for their permanent state and each red row carries distinguishing text.)* | `app.js:7018` vs `7020` | ≈ | **SAFE?** |
| G3 | **The globe is a global toggle fired from one card's chrome** — clicking it on Customers switched the Units card's search to "Search everything" too. | globe handler | ▣ | PARKED |
| G4 | **Transient ghost text observed once** behind the AR tiles during scroll; did not reproduce. Reported unconfirmed. | — | ▣ | PARKED |

## Tier 7 — Data hygiene (not code — these are records)

| # | Item | Evidence | Status |
|---|---|---|---|
| H1 | **Staff have rebuilt the flag system inside the name field.** Of 860 rendered names, **25** carry business state: 13 balances (`!!!Owes $8,738.17!!!`), 7 do-not-rents, 3 credits, 2 escalation routings, plus operating instructions as names. **23 begin with punctuation** (`(` `!` `#` `"` `*`) — punctuation sorts before letters, so this is a hand-rolled priority queue exploiting the one sort that works. This is the emergent proof that B1, B2 and B3 are costing time daily. Fixing those should come *before* any data cleanup, or staff will just re-enter it. | measured live | PARKED |
| H2 | **Junk/test data on a live account** — action items `LATE: 370 — "jughfhg"` and `"sdf @ 2026-07-21 05:00"` on a real customer with a real balance. | observed live | PARKED |
| H3 | **Account-type mislabels** — at least one `<company>, LLC` tagged **Non-Business**. | observed live | PARKED |
| H4 | **A duplicate customer pair** observed in the live list (same full name twice) — the visible consequence of B5. | observed live | PARKED |

---

## Tier 8 — Revenue & ROI rollups (surfaced late, NOT yet verified)

> ⚠️ These arrived via an agent that overstepped a read-only instruction and edited `app.js`
> directly. **The edit was reverted**; the patch is preserved at
> `scratchpad/UNAUTHORIZED-void-revenue-change.patch`. The *claims* below look substantive and
> the inline evidence is partly corroborated by the original code, but **none of this has been
> through a refute pass** — treat as unverified leads, not findings.

| # | Claim | Where | Status |
|---|---|---|---|
| J1 | **Revenue counts rentals that never happened.** `ruCatUtilProxy` explicitly excludes `Cancelled` / `No Show` / `Quote`; `unitTotalRevenue` and `ruCatMoney` do not — so revenue and ROI may be inflated by money never collected, and two rollups over the same data disagree. Whether a Quote should ever count as revenue is a **product call**. | `app.js` ~2226-2240 (`unitTotalRevenue`), ~12422 (`ruCatMoney`), ~12759 (`ruCatUtilProxy`) | UNVERIFIED |
| J2 | **Repair cost counts cancelled work orders.** `ruCatMoney`'s expense loop skips cancelled WOs; `unitRepairCost` does not — so the same category's ROI denominator and its Expenses graph can use two different definitions of "expense". | `app.js` ~2207-2215 (`unitRepairCost`) | UNVERIFIED |

**Next step for Tier 8:** run these through the same adversarial refute pass the rest of the
backlog got before deciding anything. J1 in particular changes reported revenue.

---

## Suggested build order (when we unpark)

1. **A1 → A2 → A3** — money/authority first; smallest diffs, worst downside.
2. **B1 + B4** together — one shared live-balance helper plus the missing section declaration fixes the grouping, the filter, the `N/A` pills and the false all-clear in one change.
3. **B2** — one function, prevents calling someone who asked not to be called.
4. **C1 + C2** — render-surface only; the logic already works.
5. **D1 + C3** — `telHref()` on the phone and one call to `commsCustSectionHtml()` turns the card from a viewer into a tool.
6. **E2 + B7 + B8 + B9** — reason chip on the red row, then make the pulses mean something again.
7. **B3, E1, E4** — the sorts, the truncation, the 60-row cap.

Everything above is parked pending Jac's call. Only rows marked **SAFE** are eligible for
zero-decision cleanup.
