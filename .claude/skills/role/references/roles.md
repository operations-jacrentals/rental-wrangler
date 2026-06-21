# Jac Rentals — Role Cards (audit lenses)

The 15 role lenses for the `/role` skill. Each card's **audit questions** are the core of step 12 of the checklist in `framework.md`. Full detail (jobs, priorities, pain points, features) is in `research-raw.json` — not loaded by default. Source: workflow `wf_93bd5fe5` (2026-06-20).

---

## Dispatcher (Operations)
> The Dispatcher is the air-traffic controller of the yard: they own the transport lifecycle from booking confirmation to wheels-rolling, hold real-time awareness of every unit's location and status, sequence driver routes to avoid conflicts, and serve as the first responder when a rental goes sideways mid-delivery.

- **Authority:** Operational-edit over rental status transitions (Reserved → On Rent, On Rent → Returned, triggering Field Call), unit wash-request flags, and driver task assignment; view-only on invoices, pricing, and customer financial history; cannot approve Admin-override of no-card-on-file block or process payments
- **Device:** Desktop — the Dispatch Time Grid requires horizontal screen real-estate; key status transitions must be reachable on a narrow viewport even if the full grid is desktop-only.
- **Must NOT see:**
  - Customer payment card details (brand/last4 is acceptable; full PAN never)
  - Invoice pricing, margins, and balance — the Dispatcher needs to know a rental exists and where it goes, not what it costs
  - Customer funnel stages (Used Sales / Membership) — sales pipeline data is irrelevant to logistics
  - Category ROI, Dollar Utilization, and investment-level financials — those are owner/sales metrics
  - Other drivers' personal performance metrics beyond what is needed to assign a run

**Audit questions:**
1. Does this feature update the Dispatch Time Grid in real time, or does the Dispatcher have to manually refresh to see a new delivery that was just booked?
2. When a rental transitions to On Rent, does the app surface the unit's current inspection status and wash-requested flag as a hard gate or just an advisory — and is an Admin override logged?
3. For Round-Trip rentals, does the feature expose BOTH the Delivery task and the Recovery task as separate actionable items, or does the Recovery leg only appear after the Delivery is marked complete?
4. If the customer address does not match a city in the §10 transport lookup table, does the feature fail silently (showing a dash for drive time) or alert the Dispatcher so they can resolve it before the driver leaves?
5. Does the feature allow the Dispatcher to trigger a Field Call, auto-create the linked Work Order, and log an Order Swap or Field Repair decision in three or fewer interactions — or does it require navigating to three separate cards?
6. When a unit returns late and a wash is needed before the next morning's delivery, does this feature surface that conflict (wash-requested + tomorrow delivery on the same unit) proactively, or does the Dispatcher have to catch it manually by cross-referencing the unit and rental cards?

---

## Office Manager (Operations/Admin)
> The Office Manager is the financial and contractual spine of Jac Rentals — she owns every invoice, payment, deposit, rental agreement, and customer account from first contact through collections, and is the only non-owner role with money-action authority in the system.

- **Authority:** Operational-edit and financial over customer records, invoices, and payment actions (charge, partial payment, refund, invoice lock/unlock, card-on-file management); view-only over unit specs, WO journey internals, and shop operations; cannot access Owner/Admin Settings board or override rental blocks without a separate Admin-password gate that is logged
- **Device:** Desktop — entirely office-based; she may occasionally hand a phone to a customer for selfie/signature capture during onboarding but she herself operates on a workstation.
- **Must NOT see:**
  - Mechanic-facing WO journey details (part costs, vendor contacts, repair labor hours) beyond what appears on a billed WO line item — she needs the billable total, not the shop margin
  - GPS placement details and unit hardware configuration (GPS Type/Placement/Status)
  - Driver performance scores and individual driving event logs
  - M.Tech field-call operational notes beyond what feeds the billed Field Call WO
  - Raw Stripe secret key or any backend credential (she operates through the frontend charge/refund flows only)
  - Owner-level passcode or Admin password (she holds Office role, not Admin/Owner)

**Audit questions:**
1. Does this feature touch invoice line items, totals, or payment state after a charge has been recorded — and if so, does it respect the price-lock HMAC seal and prevent silent edits to locked invoices?
2. When a customer's card-on-file is expired or missing, does this feature block or warn at the earliest possible moment (reservation creation, not delivery dispatch) — and is the Admin override logged with attribution?
3. Does this feature correctly apply the 10.75% tax rate, the city-lookup transport flat fee (no manual override), and the WO tiered-markup pricing — or does it introduce any path where those amounts can be freehandedly changed?
4. If this feature involves a membership customer, does it gate member-rate pricing and Unlimited-Transport on a completed agreement (signedAt + card on file) and refuse those entitlements to 'Member Incomplete' accounts?
5. Does this feature surface PO-required status before the invoice is sent, not after — and is the send blocked (hard gate) rather than warned (soft prompt) when PO is absent on a flagged account?
6. Is every money action (charge, refund, lock, unlock, override) written to an append-only, timestamped, attributed History entry that the Office Manager can produce verbatim if a customer disputes the transaction?

---

## Owner (Leadership)
> Jac himself — the single decision-maker who owns the revenue goal, sets every price, absorbs every liability, and needs the whole operation visible at a glance so he can redirect people, approve exceptions, and know exactly whether the month is winning or losing.

- **Authority:** Full admin over all entities and all scopes: can view and edit any record, approve any status transition, override any system block (no-card, blacklist, member-incomplete) via Admin-password gate, change pricing in the Sheets backend, manage Stripe credentials and payment settings, and access all back-office boards (Parts / Vendors / Expenses / Company Files). The only actions gated above 'Admin' do not exist in this app — Owner IS the admin ceiling.
- **Device:** Desktop — the app is intentionally desktop-only (min-width 1180px, never reflows). Occasional phone pan is possible but not a success metric for this role.
- **Must NOT see:**
  - Individual employee performance details that are not already surfaced in role KPI rings (e.g., raw driver GPS logs)
  - Customer credit card numbers, full PANs, or Stripe secret keys — the app correctly stores only brand+last4+exp+PM-id
  - Other tenants' data (not applicable — single-store, but worth noting if multi-location is ever added)

**Audit questions:**
1. Does this feature expose margin (revenue minus parts cost, transport cost, or WO cost) per unit or category, or only gross rental revenue? An Owner cannot make pricing or disposal decisions from top-line numbers alone.
2. Is every exception or override this feature enables logged with actor, timestamp, and reason to a permanent, append-only History entry? The Owner needs a full audit trail for liability and disputed-charge situations.
3. Does this feature affect the Revenue Goal calculation or any KPI ring formula — and if so, is the impact documented so the Owner is not surprised by a ring moving unexpectedly?
4. If this feature blocks or gates a rental transition (no card, blacklist, member-incomplete, invoice required), does the Admin-password override path exist, and is the override itself blocked from going unlogged?
5. Can the Owner change the business parameter this feature depends on (rate, goal amount, transport price tier, service interval) without a code change — either via the Sheets backend or a future Settings board — or is it hardcoded?
6. Does this feature surface fleet-risk information (Field Call history, uninspected returned units, expired card on file, lapsed agreements) in a way the Owner can act on during a daily 60-second scan, or is it buried three clicks deep in individual records?

---

## Asset Manager (Finance/Assets)
> The financial conscience of the fleet — this person tracks every dollar spent acquiring, repairing, and maintaining each piece of iron, then decides whether a unit is earning its keep or should be sold before it becomes a liability.

- **Authority:** View-only over all unit, category, work order, service order, and inspection data; operational-edit over Fleet Status (Active / For Sale / Sold / Inactive) and unit purchase fields (Purchase Price, True Cost, Purchase Date, Purchase Hours, Current Hours); no financial authority over invoice payments or Stripe actions; no authority to create or close rentals
- **Device:** Desktop — asset analysis requires side-by-side comparison of multiple units and categories with dense financial data; occasional mobile pan when walking the yard to verify unit condition.
- **Must NOT see:**
  - Individual customer PII beyond what is needed to understand billing patterns (name, contact details not needed for fleet analysis)
  - Customer payment ledger details, Stripe card data, and per-invoice payment method — asset analysis does not require payment instrument visibility
  - Employee performance data at the individual level (Driver scores, individual Mechanic WO completion rates) beyond what impacts unit condition
  - Sales funnel stages and membership negotiation details for individual customers

**Audit questions:**
1. Does this feature update or depend on Total Repair Cost, and if so, does it source that figure from all closed Work Order journey line items (including labor at the configured rate) or only from parts — because understated repair cost produces inflated ROI?
2. If this feature touches Fleet Status (Active / For Sale / Sold / Inactive), does it enforce the block that prevents For-Sale and Inactive units from appearing as available in the rental availability window?
3. Does this feature expose per-unit financial data (Purchase Price, True Cost, repair history) or only category-level aggregates — and if per-unit, is the data completeness visible so the user knows when a field is missing and the derived ROI number is unreliable?
4. When this feature modifies unit hours (manually or via GPS sync), does it immediately cascade to all service order countdowns and the availability derivation, or is there a stale-read window where the old hours still drive decisions?
5. Does this feature surface the distinction between a unit's annualized ROI (which requires Purchase Date and normalizes for age) and its raw revenue-minus-cost figure — and does it handle the missing-Purchase-Date fallback in a way that makes the assumption visible rather than silent?
6. If this feature creates or closes a Work Order, does it update the unit's Total Repair Cost in real time, and does it correctly attribute Field Call WOs separately so the Asset Manager can distinguish damage-driven costs from normal maintenance when evaluating a unit's risk profile?

---

## Investment Manager (Finance)
> The person who decides whether to buy the next excavator or walk away — tracking every dollar from purchase price through repair bills to rental revenue to determine whether the fleet is earning its keep or bleeding capital.

- **Authority:** View-only over all fleet, category, unit, rental, invoice, and WO data for financial analysis; no authority to edit unit records, create rentals, approve invoices, or change pricing (category pricing is backend-only per spec). May need read access to Expenses board for cost basis verification. No Stripe or payment-processing authority.
- **Device:** Desktop — works with multi-column comparative data that requires the full 1180px fixed layout; the Board View spreadsheet popup with formula columns is the primary analysis surface. No meaningful mobile use case.
- **Must NOT see:**
  - Individual customer payment details and card-on-file data (Stripe PM IDs, last4, agreement signatures) — those are finance-operational, not investment-analytical
  - Driver-level operational data (wash completion logs, GPS driving events, route details)
  - Internal staff KPI rings for Mechanic / M.Tech / Driver roles — workforce performance metrics are outside the investment mandate
  - Customer funnel stages and sales pipeline data (Used Sales funnel, membership funnel activity log) — CRM data is outside investment scope unless aggregated into revenue projections

**Audit questions:**
1. Does this feature affect how Total Repair Cost is calculated per unit — and if so, does it capture ALL WO spend (billed and unbilled) or only customer-billed lines? Unbilled internal repair is still a real capital cost.
2. Does this feature touch category pricing fields (Bottom Dollar, Ask, MSRP, daily rates)? If so, who can edit them and is the change auditable? Pricing changes directly affect ROI and payback models.
3. Does this feature surface utilization data (time utilization % or dollar utilization %) — and if so, is the time window clearly labeled (30-day rolling per spec, or all-time)? Mixing windows invalidates cross-category comparison.
4. If this feature adds or modifies unit records (purchase price, purchase date, true cost, purchase hours), does it update the annualized ROI formula — specifically the DaysOwned denominator — without requiring a manual refresh?
5. Does this feature expose fleet-level aggregate figures (total capital deployed, blended fleet ROI), or only per-unit/per-category numbers? Portfolio-level views are what ownership actually needs for capital allocation decisions.
6. If this feature involves disposing of or selling a unit (fleet status change to Sold), does it capture the final sale price so realized gain/loss against True Cost can be computed — or does the financial outcome of the sale disappear from the record?

---

## Fleet Manager (Operations/Assets)
> The Fleet Manager is the asset P&L owner who treats every piece of iron as a revenue-generating investment — they obsess over what each unit earned vs. what it cost to own, which yard slots are cold, and whether the right mix of heavy vs. light equipment is available to take tomorrow's calls.

- **Authority:** Operational-edit over fleet asset records (unit fleet status, inspection status escalation, service completion logging, WO creation and phase advancement); read-only over rental records and invoices; no financial authority to charge customers, issue refunds, or alter pricing
- **Device:** Desktop — fleet management is a planning and analysis task done at a desk with multiple data points in view simultaneously; a tablet may be used when walking the yard for a physical inventory check.
- **Must NOT see:**
  - Customer payment card numbers, Stripe payment method IDs, or partial card details beyond last-4
  - Customer PII beyond what is needed to identify who is currently using a specific unit (name, company, rental status)
  - Invoice aging, collection status, or AR balances — that is the Office/Finance role's domain
  - Employee wages, commission structures, or HR data
  - Owner-level margin breakdowns or company P&L beyond the fleet asset layer

**Audit questions:**
1. Does this feature surface utilization rate (rented days ÷ available days) at both the unit and category level, or only raw rental counts? Raw counts hide the difference between a busy low-rate unit and a high-rate unit that books every time it is offered.
2. If a unit is currently on rent when a new service interval comes due, does the feature give the Fleet Manager advance warning before the rental ends — not just a Past Due flag after the unit returns?
3. Can the Fleet Manager see, in a single view, every unit that is Active in fleet status but currently earning nothing (Ready + not on any open rental) — i.e., provable idle iron — without manually cross-referencing the Rentals card?
4. Does this feature account for repair expense accumulation when computing or displaying asset value? A unit at $86k purchase price with $24k in WO repairs has a very different ROI story than one with $1k in repairs.
5. When a category shows '0 Available' for a requested window, does the feature tell the Fleet Manager WHY each unit is blocked (on rent, Failed inspection, Not Ready, Inactive/Sold) so they can decide if any blocker is recoverable before turning away the booking?
6. Does this feature create or surface any data that helps capture lost-demand signals — i.e., when a customer asks for equipment we cannot provide, is there anywhere to record that miss so fleet purchasing decisions can be data-driven?

---

## HR (Support)
> The keeper of who is legally cleared to operate what — HR owns operator certifications, CDL records, training logs, and OSHA compliance so that every Driver and M.Tech on the road or on a site is qualified, documented, and not a liability.

- **Authority:** Operational-edit over the HR/People board only (employee records, certifications, training logs, incident log, dispatch-eligibility flag). View-only on Units (to read category type and determine required certs), View-only on the Office Dispatch Time Grid (to see who is scheduled and cross-check against eligibility). No access to financial records, customer payment data, or invoice/pricing boards. HR cannot change rental statuses, create work orders, or modify equipment records.
- **Device:** Desktop — HR work is document-heavy (uploading CDL scans, reviewing expiry grids, completing onboarding checklists) and happens at a desk. Occasional mobile need: a field supervisor snapping a photo of a Driver's renewed CDL to upload.
- **Must NOT see:**
  - Customer payment card data (Stripe PM ids, last4, card-on-file status) — PCI scope, HR has no need
  - Customer PII beyond what is incidentally visible in a rental record they happen to open (phone, address, company) — HR does not work customer accounts
  - Invoice line items, rental pricing, category ROI, and revenue KPIs — financial performance data belongs to Owner and Sales
  - Work Order part costs, markup tiers, and vendor pricing — margin data
  - Sales funnel stages and membership pipeline for customers — Sales-owned data
  - Other employees' compensation details — if payroll is ever integrated, compensation is strictly need-to-know

**Audit questions:**
1. Does this feature respect the equipment-authorization boundary — specifically, if a Driver is not certified on the unit type being rented (e.g., CDL-B holder dispatched on a CDL-A load, or uncertified operator on an aerial work platform), does the system surface a hard warning or block rather than just silently allowing the assignment?
2. When a certification, CDL, or medical card expires, does this feature automatically flip the employee's dispatch-eligibility flag and propagate that block to the Office Dispatch Time Grid before the next booking can be created — or does HR have to manually catch it?
3. Does this feature create or modify any employee-facing data that could be visible to the employee themselves or to other non-HR roles (e.g., a Mechanic seeing another Mechanic's MVR result or incident record)? If so, what is the access control?
4. If a Driver is terminated mid-rental-window (i.e., they have an active delivery or recovery task on the Dispatch Grid today), what does this feature do — does it flag the open task as unassigned and alert Office, or does the task silently stay assigned to a terminated employee?
5. Does this feature store or display the physical CDL document scan, medical card scan, or signed training record in Google Drive via the app's wrapped viewer (per §18), and is that file access gated so only HR-role sessions can open the link — or is the Drive link accessible to any authenticated session?
6. When the spec references 'Round-Trip auto-creates two Driver tasks' or 'Wash flow: Driver logs washed', does this feature assume any Driver is eligible for any task, or does it check the operator-authorization matrix first — and if a qualified Driver is not available, how does that surface to the dispatcher?

---

## Marketing (Growth)
> The person (likely doubling as or directing the Sales function at a single-yard independent rental) who turns fleet utilization data, customer history, and seasonal construction demand into bookings — running promotions on slow categories, driving membership enrollment, and making sure Jac Rentals wins the quote before United Rentals even gets the call.

- **Authority:** View-only over all customer records, rental history, funnel stages, and category/unit utilization data. Operational-edit over customer funnel stage pills (Used-Sales and Membership), Activity Log recorded actions, and Schedule entries on customer records. No financial authority — cannot edit rates, apply discounts, create invoices, or trigger payments. Cannot edit category pricing (backend-only per spec). Cannot change rental status or approve card overrides.
- **Device:** Desktop — the app is desktop-only (1180px fixed, §4.4), and Marketing's work (building campaign lists, reviewing pipeline, writing activity log notes) is desk-based. Phone panning tolerated per spec but not a success metric.
- **Must NOT see:**
  - Individual customer payment method details (card brand/last4 is fine; full Stripe payment method IDs are not needed)
  - Invoice line-item pricing details beyond totals — Marketing needs aggregate revenue, not per-transaction margin forensics that belong to Owner/Office
  - Work Order journey details, parts costs, labor hours — internal shop data irrelevant to demand generation
  - Mechanic, Driver, and M.Tech role KPI details (WO completion rates, wash logs, field calls) — operational data outside Marketing's domain
  - Unit GPS placement and GPS status — equipment tracking is a Shop/M.Tech function
  - Admin override logs and card-on-file override history — financial compliance data, not marketing data

**Audit questions:**
1. Does this feature tell Marketing WHICH categories are underutilized right now — not just per-customer, but as a ranked fleet list — so we can decide what to promote before the month's idle days are sunk?
2. Can Marketing pull a list of all customers interested in a specific equipment category (via the Used-Sales 'Interested Categories' pills) without clicking through individual records, and can that list be used to trigger outreach or export a contact list?
3. Does this feature affect the Revenue Goal ring calculation, and if so, does it preserve the distinction between new-customer revenue and repeat-customer revenue so Marketing can measure acquisition impact separately from retention?
4. If this feature involves a discount, rate change, or promotional pricing, does it flow correctly through the rental price formula and invoice line items without requiring Marketing to touch backend Category pricing (which is admin-only in Sheets)?
5. Does this feature expose membership value quantitatively — specifically the dollar savings from Unlimited Transport — in a way Marketing can show a prospect during the 'Payment Discussed' funnel conversation?
6. When a customer's Active% drops below a threshold or their funnel stage has been stale for N days, does this feature surface that as an actionable signal (an alert, a sorted list, a badge) rather than burying it in per-record detail views that Marketing must manually patrol?

---

## Sales (Outside) (Growth)
> The field-facing revenue hunter who builds contractor relationships on job sites, converts quotes to signed agreements, and owns the customer from first call through active account health — measured every month against a $150k revenue goal.

- **Authority:** Operational-edit over customer funnel fields (stage pills, Activity Log entries, Schedule, interested Categories, Account Notes), rental creation (Quote and Reserved status), and customer contact/profile fields. View-only on financial totals, invoice line items, and payment records. Cannot approve Admin overrides (card-on-file bypass), change invoice status, process payments, edit category pricing, or access the Expenses board.
- **Device:** Mobile (phone pan) for on-site lookups — contractors expect instant answers in the field; desktop is the primary device for end-of-day funnel updates and pipeline review back at the yard.
- **Must NOT see:**
  - Stripe secret keys, payment processing credentials, and raw Stripe account details
  - Admin-override logs showing which bookings were forced through despite no card on file (audit trail for Owner/Admin only)
  - Unit Purchase Price, True Cost, Bottom Dollar, Ask price, and ROI — margin data the rep should not disclose to customers or use as negotiating floor without Owner authorization
  - Other employees' personal data or compensation details
  - Blacklist reasons beyond the visual red styling (legal sensitivity)
  - Expense & Receipts board: vendor costs, part costs, and internal markup rates that inform WO billing are not for customer-facing conversations

**Audit questions:**
1. Can a Sales rep produce a credible quote — rate tier, total price, transport cost, and unit availability for a given window — in a single card view without navigating to three separate cards or making a phone call? If the answer requires anchoring a unit, opening a rental draft, and then reading three different sections, the flow is too slow for a job-site conversation.
2. Does the feature expose unit cost, purchase price, true cost, bottom dollar, or markup rates anywhere a Sales rep (or a customer looking over their shoulder) could see them? Margin data must never surface on a customer-facing screen or in a role that regularly shares their screen.
3. When the feature changes rental status to Reserved or On Rent, does it enforce the 'no valid card on file blocks booking' rule — and if so, does it give the Sales rep a clear, actionable next step (e.g., 'Ask customer to call Office to add a card') rather than a dead-end error that kills the deal?
4. Does the feature keep the Used-Sales and Membership funnel stages and the Activity Log writable from a phone-panned view? Any funnel update that requires precise desktop interaction will be deferred until the rep is back at the yard, meaning the funnel data is always stale.
5. If a customer's Active Status % has dropped to near zero, does the feature surface that signal on the customer list row or in a ring/dashboard view so the rep can prioritize re-engagement without running a manual report? Or does the rep have to open each record individually to discover churn risk?
6. Does the feature correctly handle the Unlimited Transport flag on Member accounts — auto-pricing transport at $0 in the quote — so the rep never tells a Member they owe transport and then has Office correct it, which destroys the membership value proposition in that conversation?

---

## Inside Sales (Growth)
> The phone-and-screen rep who converts inbound calls into rentals, moves leads through the funnel, owns quoting and availability, and enters the order before the yard ever touches equipment.

- **Authority:** Operational-edit over Customers (create, edit contact/funnel fields), Rentals (create, enter window/transport/address, cycle status up to Reserved), and Invoices (create, add lines). View-only over Categories and Units (no price editing — that is backend/Owner only). Cannot approve card-override bookings (Admin gate). Cannot edit category rates or unit specs in-app.
- **Device:** Desktop — this is a phone-at-ear, keyboard-at-hand workflow; the app's 1180px fixed desktop frame is the natural fit.
- **Must NOT see:**
  - Category pricing fields below Ask (Bottom Dollar is the negotiating floor — should not be visible to Sales without an explicit override, as it undermines rate integrity on calls)
  - WO journey line-item cost details and vendor names (cost-of-repair data is Mechanic/Owner territory)
  - Expense & Receipt board data (internal cost accounting)
  - Other customers' full contact and payment details when not relevant to the current call
  - Admin password or override logs (card-override audit trail is Owner/Admin territory)

**Audit questions:**
1. When the customer gives me a date window on the phone, how many taps does it take to see which categories have units available for that exact window — and does the UI show me the count, the conflicting rental status, and sort available units to the top without leaving the Rentals creation flow?
2. Does the rental price and transport cost auto-compute the moment I set the window and address, or do I have to save and re-open the record to see the quote — because I need to read the number to the customer while they are still on the line?
3. If a returning customer calls in and they are Late+60 or have no valid card on file, does the UI surface that warning before I confirm a reservation, or only at the On Rent gate when the Driver is already loading the unit?
4. When I log a funnel touchpoint or advance a lead's stage, is the Activity Log entry automatic (zero extra steps) or does it require a separate save action — and does it timestamp who made the change?
5. Does the Membership funnel enforce that 'Member Incomplete' blocks member-rate pricing on new rentals, and is that block visible to me as the rep taking the order (not just to an Admin after the fact)?
6. If I quote a round-trip delivery to a city not in the transport lookup table, does the app tell me immediately that the city is unresolved (showing a dash or alert) rather than silently quoting $0 transport and letting the order go through at wrong margin?

---

## Equipment Sales (Growth)
> The person who converts idle or retiring fleet assets into revenue by selling used/retired construction equipment outright — working a 7-stage prospect funnel, quoting against MSRP/Ask/Bottom-Dollar price anchors, and managing the unit disposition from For Sale through Sold.

- **Authority:** Operational-edit over the Used Sales funnel (stage, action, interested categories, activity log) and unit Fleet Status transitions to For Sale / Sold on their own assigned units; view-only over Category pricing anchors (MSRP/Ask/Bottom Dollar are backend-only edits per spec §7.2); no financial authority over invoices, payments, or Stripe charges
- **Device:** Desktop — the app is desktop-only (fixed 1180px, never reflows to mobile per spec §4.4); Equipment Sales is a desk/office role working the funnel and preparing quotes.
- **Must NOT see:**
  - Stripe secret keys and backend payment credentials
  - Other customers' card-on-file details, payment methods, or Stripe IDs
  - Admin override logs (card-block overrides, admin password usage) on other customers
  - Mechanic-internal WO cost details on units not currently For Sale — exposing full repair-cost history on active fleet could create competitive intelligence leaks
  - Employee-level operational data from other roles (Driver dispatch queue, Mechanic service schedules) beyond what is needed to confirm unit availability for a sale

**Audit questions:**
1. Does this feature capture a CLOSED SALE price per unit — or only funnel stage? A 'Paid' funnel stage tells us we won the deal but not what we sold for relative to Ask vs Bottom Dollar. Equipment sales margin is the whole point.
2. When a unit flips to For Sale, does the feature immediately block new rental reservations on that unit AND surface it to the Sales role as an available listing — or are those two state changes manual and unconnected?
3. Does this feature make used-sales revenue visible in the Sales KPI ring, or will it continue to be excluded from the Revenue Goal? Right now the role's biggest wins are invisible to the one ring they watch.
4. If a prospect is interested in a specific unit (e.g. a 2019 12k Excavator with 1,800 hours), can the feature capture unit-level interest rather than only category-level — so when that exact unit becomes For Sale we can notify the right lead?
5. Does this feature support scheduling a follow-up from the Activity Log in a single action that creates a visible reminder — or does the salesperson have to remember to come back manually after entering a Schedule date?
6. When a deal closes and Fleet Status changes to Sold, does the feature atomically remove the unit from rental availability, close any open For-Sale inquiry, and record the sale price — or does closing a used-equipment deal require touching three separate cards with no guided workflow?

---

## Mechanic (Technical)
> The Mechanic is the hands-on equipment fixer whose diagnostic decisions directly control what units the fleet can rent — every hour a Failed unit sits uninspected is revenue the company cannot book.

- **Authority:** Operational-edit over Work Orders (create, phase-advance, add journey lines), Service Orders (complete and reset countdown), and Inspections (conduct the 3-step gate, record Pass/Fail, attach photo). View-only over Rentals, Categories, Invoices, and Customers. Cannot change unit pricing, cannot approve invoices, cannot override the 'On Rent requires invoice' gate, cannot perform Admin-password overrides for card-on-file blocks.
- **Device:** Desktop (shop PC or a fixed workstation in the service bay). A tablet propped near the lift would be ideal in practice, but the app does not currently optimize for touch.
- **Must NOT see:**
  - Customer payment details, card numbers, Stripe payment method IDs, and invoice financial ledger data
  - Customer PII beyond what is needed to decide billability on a WO (name and account type sufficient; full contact info, address, membership fees not needed)
  - Sales funnel stage and membership payment data for any customer
  - Invoice line-item pricing, transport costs, and rate calculations — the Mechanic's output is cost and hours, not the rental price structure
  - Revenue Goal, Active Customer Rate, and Pipeline KPIs (Sales role metrics)
  - Office collection-rate and reputation metrics

**Audit questions:**
1. When a WO phase changes to 'Part Ordered' and an ETA is picked, does that ETA date surface on the Unit card and the Shop list row so dispatch can tell at a glance when the unit is expected back — or is it buried inside the WO detail only?
2. After a Failed inspection auto-creates a WO and the WO is marked Complete, the spec says the unit reverts to Not Ready. Does the app visibly prompt for a new inspection immediately (e.g. a pending-inspection entry in the Shop list), or does the Mechanic have to remember to go trigger one manually?
3. The Service Order countdown is driven by Current Hours, which are a manual edit on the Unit. If a Mechanic forgets to update hours after a job, every countdown for that unit is silently wrong. Is there any staleness indicator or last-updated timestamp on the Current Hours field so the Mechanic can spot drift?
4. On the Shop card's merged list, when a unit has both an open WO (stalled on Part Needed) AND an overdue Service Order, do both items appear as separate rows for that unit, or does only the most urgent surface? If both appear, can the Mechanic act on each independently without losing their place?
5. The 'Bill To Customer' determination on a WO is required at creation time, but damage vs. normal wear is often unclear until mid-repair. Does the spec allow the Mechanic to change Bill To Customer (and the linked Customer pill) after the WO is in progress, or is it locked once an invoice line has been added?
6. A Field Call WO is type 'Field Call' and looks identical in the list to a shop repair except for the badge. When the Mechanic opens the Shop queue first thing in the morning, is there a filter or segment that separates Field Call jobs (may need road deployment or a loaner unit) from in-shop repairs so they can be routed without reading every WO description?

---

## Maintenance Tech (M.Tech) (Technical)
> The M.Tech is the unit's last line of defense before it goes back on rent — inspecting, servicing, and clearing equipment so it is provably rental-ready, not just assumed to be.

- **Authority:** Operational-edit over Shop entities (Inspections, Work Orders, Service Orders) and Unit current-hours field. View-only over Rentals, Customers, Categories, and Invoices. Cannot change rental status, approve bookings, process payments, or access back-office financial boards (Expenses and Receipts).
- **Device:** Desktop — the app is desktop-only at 1180px min-width. M.Tech typically accesses it from an office terminal or a laptop in the shop. In-field (Field Call) access is via phone panning the fixed-width layout, which is tolerated but not a success metric.
- **Must NOT see:**
  - Customer payment details, card-on-file data, Stripe payment method IDs, or invoice payment ledger entries
  - Customer PII beyond what is needed to bill an inspection back to them (name + account type is sufficient; full address/phone/email are unnecessary)
  - Invoice pricing internals, margin data, or the Bottom Dollar / Ask pricing thresholds on categories
  - Sales funnel stages, membership status, or activity log entries for customers
  - Admin password gate or override logs

**Audit questions:**
1. Does this feature require the M.Tech to update unit hours before it functions correctly — and if GPS is not yet live, what happens when hours are stale or zero?
2. If this feature changes a unit's Inspection Status or Service Order completion, does it correctly trigger the downstream cascade: service-complete → Not Ready → new inspection required → Ready only after passing the 3-step gate?
3. Can the M.Tech complete the critical action (log inspection result, mark service done with photo proof, advance WO phase) in under 5 taps on a shop floor, without needing to navigate away from the Shop card?
4. Does this feature distinguish between 'inspection pass/fail' and 'service completion' — two separate flows with different outcomes — or does it blur them in a way that lets a unit skip back to Ready without a clean inspection?
5. When a unit is currently On Rent, does the Service Order list or this feature make it unambiguous that service cannot be performed yet, and does it show the return date so the M.Tech can plan the maintenance window?
6. Does this feature respect the 1-inspection-to-1-WO constraint on Fail (not allowing multiple open WOs from one failed inspection), and does the WO completion correctly feed back to the inspection record via the linked WO pill?

---

## Driver (Operations)
> The Driver is the last physical touchpoint before and after a unit earns revenue — they move iron from the yard to the customer's site, verify condition at handoff, capture proof of delivery and damage documentation, and bring equipment back, all from a phone with gloves on and sometimes no signal.

- **Authority:** Operational-edit scoped to their own dispatch tasks: can mark a rental On Rent / Off Rent / Returned, attach on-rent and returning videos, set Wash Requested, and trigger a Field Call. Cannot change rental pricing, customer account type, invoice status, or any financial record. Cannot approve an Admin override for a blocked booking.
- **Device:** Mobile — the Driver is always in a truck or on a job site. In practice, any Driver-facing feature must work in the minimum-tap panning mode: large tap targets, no hover-only affordances, and offline-tolerant capture.
- **Must NOT see:**
  - Invoice dollar amounts, line-item pricing, or invoice balance — pricing is an Office/Sales function
  - Customer payment method, Stripe card details, or payment status
  - Category cost and investment data (MSRP, Ask, Bottom Dollar, ROI, Avg Revenue/Unit)
  - Other employees' KPI ring details beyond their own Driver ring
  - Admin-override logs or the admin password gate
  - Funnel stage or membership sales data on customers

**Audit questions:**
1. Can the Driver see their full day's run — every Delivery, Recovery, and Round-Trip task in time order — in a single glance without opening individual rentals?
2. Can a Driver capture a delivery photo and customer signature in under 3 taps while wearing gloves, and does the capture queue locally if LTE drops before the upload completes?
3. Does the feature expose the unit's current Inspection Status before the Driver loads the truck, so a Failed unit is never dispatched without an explicit override?
4. For a Round-Trip rental, does the app show BOTH the outbound Delivery task AND the future Recovery task on the same screen, so the Driver knows to come back without a separate reminder?
5. When a Driver triggers a Field Call mid-rental, does the flow auto-create the Work Order and set the unit Failed in a single action, or does it require the Driver to navigate to two separate cards in the field?
6. Does the Wash Requested tap happen at the same moment as the return photo capture — one workflow, not two — so it actually gets logged every time a unit comes back to the yard?

---

## Customer (Contractor) (External)
> A contractor — running a jobsite in Sulphur or SE Texas — who rents excavators and heavy equipment from Jac, manages their own account digitally, and needs instant clarity on what they owe, what they have out, and how long they have it.

- **Authority:** View-only over their own account data (rentals, invoices, card on file, agreement). Operational-edit limited to: submitting rental requests/extensions, updating their card on file (requires selfie per Section 13 of the agreement), updating contact info. No ability to change rental status, pricing, transport routing, or invoice line items. Financial scope limited to initiating payment on their own invoices only.
- **Device:** Mobile (phone), secondary desktop. Contractors check status from job trucks and trailers; quick lookups (return dates, balances) happen on a phone; invoice review and agreement signing may happen on desktop.
- **Must NOT see:**
  - Other customers' rental records, invoices, contact info, or account details (strict row-level isolation)
  - Internal pricing floors: Bottom Dollar, Ask price, MSRP markup, Category ROI, Dollar Utilization, Avg Revenue/Unit, Avg Expenses/Unit — these are internal margin data
  - Unit inspection status internals: whether a unit is Not Ready or Failed for internal reasons should not be shown (only availability matters to them)
  - Work order details on equipment they're currently renting (unless it's a field-call event that directly affects their rental)
  - Service order countdowns and maintenance schedules
  - Other staff roles' KPIs, Dispatch Time Grid, Sales funnel data
  - Payment ledger entries from other customers
  - Internal history log entries that contain staff notes about the customer (e.g., 'Blacklisted' reasoning, internal account flags)
  - Stripe secret keys, backend configuration, any internal admin overrides logged to history
  - Driver schedules beyond their own delivery/recovery

**Audit questions:**
1. Does this feature expose the return-date countdown in a way that makes the rental-period-ends-at-yard-return rule unambiguous — so a contractor knows their liability doesn't end when they stop using the unit, but when Jac physically has it back?
2. If the contractor's card on file is expired or missing, does this feature surface a clear, actionable warning BEFORE they're blocked from a new booking, or does it only surface the block at reservation time?
3. Can the contractor see the exact rate they'll be charged (member vs. retail, day/7-day/4-week tier) BEFORE they commit to a rental request — and does the rate shown match what will actually appear on the invoice?
4. Does this feature reveal any internal pricing floor (Bottom Dollar, Ask, Category ROI, margin data) or inspection/maintenance status that Jac intends to keep internal?
5. If a contractor needs to update their card on file from a phone in a truck, can they complete the selfie + card capture flow in under 2 minutes on a mobile browser without the 1180px desktop constraint breaking the UI?
6. Does this feature create any path — direct or indirect — where one customer can see another customer's rental, invoice, or account data; and is row-level isolation enforced server-side, not just by the frontend hiding fields?
