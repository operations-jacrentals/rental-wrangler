# Jac Rentals — Cross-Role Design Framework

The backbone of the `/role` review. Source: role-research workflow `wf_93bd5fe5` (2026-06-20), grounded in the actual Rental Wrangler app/spec. Pair this with `roles.md` (per-role audit questions).

---

## Authority Hierarchy (who can do what)

- **Tier 0 — Backend/System (no human role):** Stripe secret keys, full PAN, HMAC price-lock seal, Sheets pricing tables, Drive ACLs. No frontend role ever sees these. Row-level isolation and gate enforcement live here, **not in the UI**.
- **Tier 1 — Owner/Admin (Jac):** the admin ceiling. Full view+edit on every entity. Sole authority to override any system block (no-card, blacklist, member-incomplete, invoice-required) via Admin-password gate; set/change pricing and the $150k goal; manage Stripe credentials; all back-office boards; blacklist/unblacklist. Every override is force-logged (actor+timestamp+reason).
- **Tier 2 — Office Manager (money authority):** the only non-owner role that can move money. Charge/partial/refund via Stripe, lock/unlock invoices, manage card-on-file, gate money-sensitive transitions, enforce PO + agreement hard gates. Admin-override only through a separate logged Admin-password gate. View-only on shop internals, unit specs, fleet financials.
- **Tier 3 — Operational editors (domain-scoped write, no money):** Dispatcher (status transitions, wash flags, driver tasks, Field Call), Fleet/Asset Manager (Fleet Status, current-hours, service logging, WO create/advance; Asset Mgr also purchase fields), Mechanic/M.Tech (Inspections, Work Orders, Service Orders, current-hours). Write only inside their board; view-only on invoices/pricing; cannot override blocks or process payments.
- **Tier 4 — Sales/CRM editors (customer + funnel write, no money, no margin):** Outside Sales, Inside Sales, Equipment Sales, Marketing. Edit customer contact, funnel pills, Activity Log, Schedule, interested categories; create rentals up to Reserved (Equipment Sales also flips its own units For Sale/Sold). View-only on financial totals; **walled off from margin floors** (Bottom Dollar/Ask/ROI) and from payments/card-gate override.
- **Tier 5 — View-only analysts:** Investment Manager (+ Marketing for fleet/utilization). Read all data for analysis; no edits, no pricing, no payments, no rental creation. Power = Board View formula engine, not write access.
- **Tier 6 — Field operator (Driver):** write scoped to own dispatch tasks only — On Rent/Off Rent/Returned, attach delivery/return media, set Wash Requested, trigger Field Call. No pricing, invoice, account-type, or override. Mobile-first reality despite a desktop-only app.
- **Tier 7 — Customer/Contractor (external, row-isolated):** view-only on their OWN account; edit limited to rental/extension requests, own card (selfie-gated), contact info, and paying own invoices. **Strict server-side row-level isolation** — never reaches another customer's data or any internal margin/maintenance/staff data.

---

## Data-Sensitivity Matrix (which roles may see each tier)

| Tier | Data | Allowed | Key note |
|---|---|---|---|
| **T0** | Secrets & crypto: Stripe secret key, full PAN/CVV, HMAC seed, Admin passcode, Drive ACLs | Backend only | No human role, not even Owner, sees raw secrets. Card stored only as brand+last4+exp+PM-id. |
| **T1** | **Margin & investment floors:** Bottom Dollar, Ask, MSRP markup, True Cost, ROI, Time/Dollar Util, Avg Rev/Expense, WO part cost & vendor markup | Owner, Asset Mgr, Investment Mgr, Fleet Mgr (asset layer), Marketing (aggregates only) | **The most over-shared-by-accident tier. RADIOACTIVE.** Forbidden to ALL customer-facing & shared-screen roles (Sales, Equipment Sales cost basis, Driver, Dispatcher, Mechanic/M.Tech, Customer). A rep's screen faces the contractor — exposing the floor destroys rate integrity. Must never render where a customer could see over a shoulder. |
| **T2** | Money & payment state: invoice line items, totals, aging, payment ledger, charge/refund, lock/unlock, card validity, PO, deposits, membership fees | Owner, Office Manager | Edit/action is Office+Owner only. Card-on-file **validity** (yes/no) is broader-read (Dispatcher/Sales/Customer need it to gate booking) but the ledger/line-items/charges stay T2. Every money action → append-only, attributed History. |
| **T3** | Customer PII & CRM: name, phone, address, selfie, signature, agreement text, funnel stage, interested categories, Activity Log, Active%, membership | Owner, Office, Outside/Inside/Equipment Sales, Marketing, Customer (own only) | Operational roles get only the **thin slice** for the job: Dispatcher/Driver need name/phone/address for delivery; Mechanic/M.Tech need name+account-type only (billability), NOT full contact. **Blacklist reasoning is Owner-only** (legal); others see only red styling. |
| **T4** | Transport & dispatch ops: Dispatch Time Grid, rental status, transport type, delivery address, drive time, city-lookup flat fee, Field Call flag, wash-requested, Round-Trip legs | Owner, Office, Dispatcher, Driver (own), Outside/Inside Sales, Customer (own transport) | Shared operational spine. Transport **flat fee** is visible (customer-facing charge) but its derivation/margin is not. |
| **T5** | Maintenance & asset condition: Inspection Status, Work Orders + journey/parts/labor, Service countdowns, current/purchase hours, GPS status, Total Repair Cost, FC WO type | Owner, Mechanic, M.Tech, Fleet Mgr, Asset Mgr, Investment Mgr (cost rollups, read) | Shop-owned. Office sees only the **billed WO total** (not shop margin/part/vendor). Dispatcher/Driver see only the Inspection **badge** (Ready/Not Ready/Failed) as a gate. Customer NEVER sees maintenance internals (only resulting availability), except an FC event on their live rental. |
| **T6** | HR & compliance: CDL/medical card, MVR result, equipment-type certs, training logs, I-9, incident log, dispatch-eligibility flag | Owner, HR | Net-new board, HR-only edit. Only the **derived dispatch-eligibility pill** (green/red) surfaces outward to the Dispatch Grid. Raw MVR/medical/incident records are need-to-know — not visible to peers or other operational roles. |
| **T7** | Owner-level aggregates: Revenue Goal ring, total AR exposure, fleet risk summary, override audit log, blended ROI, capital deployed | Owner (+ each role sees only ITS OWN KPI ring) | Each role sees its own ring (Sales→Revenue Goal/Pipeline; Mechanic→Renting/WO/Bill; Driver→On-Time/Wash) but NOT other rings' internals or the cross-role rollup. Override audit log is Owner-only. $150k goal is Owner-settable. |
| **T8** | Public/availability-only: unit availability for a window, published rates, category names | All internal roles + Customer | Only tier safe to expose externally. Customer sees **availability** (yes/no) + the **rate** they'll be charged — never WHY a unit is unavailable (Failed/Not Ready hidden; only "unavailable" shows). |

---

## Shared Views (build once, project per role)

1. **Office Dispatch Time Grid** — Dispatcher, Office, Driver, Outside/Inside Sales, HR (read), Owner. The most cross-consumed screen. Build one data layer with role-scoped overlays (Office $-overlay, Sales rate context, HR eligibility pill each appear only for the entitled role) — not five separate grids.
2. **Rental detail + status bar / transport journey picker** — Dispatcher, Driver, Office, Outside/Inside Sales, Customer (own, read-mostly). Same record, sharply different write scopes; gate the action affordances on the same surface.
3. **Units list + Board View** — Fleet/Asset/Investment Mgr, Owner, Mechanic/M.Tech (condition columns only). Shared analytical surface; gate write access and which columns render (margin columns hidden from shop).
4. **Shop card (Inspections / WOs / Service Orders, urgency-sorted)** — Mechanic, M.Tech, Fleet Mgr (read), Owner (read). True single-cluster surface; no customer/sales role belongs here. Field-Call jobs need a filter.
5. **Customer card (funnel + Activity Log + account snapshot)** — Outside/Inside/Equipment Sales, Marketing, Office (financial sections). Card SPLITS: Sales/Marketing own funnel top; Office owns ledger/agreement bottom. Margin floors + ledger internals gated even within the shared card.
6. **KPI ring header strip** — every role, but each sees only its own ring(s). Treat as a per-role projection, never a shared dashboard.
7. **Customer self-service portal** — Customer (own only). The ONE view that must NOT share a surface with internal roles: separate, mobile-responsive, row-isolated build. The one place the desktop-only 1180px rule has to break.
8. **HR / People board** — HR (own), Owner. Net-new, HR-private. Only outward projection is the dispatch-eligibility pill.

---

## Cross-Role Conflicts (and their resolution patterns)

1. **Speed vs. audit trail** — Dispatcher/Driver want one-tap transitions; Owner/Office require every transition logged. → One tap acts; the system *silently* writes the attributed History entry. Never make the actor fill a form; never let speed skip the log.
2. **Margin concealment vs. quoting speed** — Sales needs an instant rate on a customer-visible screen that must never expose Bottom Dollar/True Cost/ROI. → Compute the customer-facing price from floor data the rep can't see; floor stays server-side.
3. **Hard gate vs. deal momentum** — Office/Owner want card/agreement/PO as hard blocks; Sales loses the deal on a dead-end error mid-close. → Gate fires EARLY (quote/reservation, not delivery morning), gives an actionable next step, plus an Owner-only logged override.
4. **One inspection badge, two truths** — Dispatcher/Driver want the badge as a hard gate; Mechanic/M.Tech own the WO internals and need the badge live. → Badge derives live from shop state, no manual refresh (kill the stale-read window).
5. **Current-hours, cascading blast radius** — Mechanic/M.Tech edit hours; Asset/Investment/Fleet ROI, utilization, and countdowns all derive from it. → Show a last-updated/staleness indicator; cascade edits immediately to countdowns + availability.
6. **Field Call: fast action vs. clean 5-place record** — one tap must atomically create a WO, set unit Failed, flag the rental, maybe trigger a swap. → One action fans out transactionally; never touch five cards; never leave a partial write.
7. **Transport flat fee: authoritative lookup vs. silent failure** — unresolved city must ALERT the quoting role (not quote $0/dash); flat fee must never be hand-editable.
8. **HR eligibility vs. dispatch assumption** — Round-Trip auto-assigns Driver tasks assuming anyone can take any task; HR needs cert enforcement. → The derived eligibility pill gates assignment; uncertified-operator assignment surfaces a hard warning sourced from HR data the Dispatcher can't otherwise see.
9. **Equipment Sales close vs. fleet availability** — a For Sale flip must *atomically* block rental availability; closing to Sold must capture sale price (for realized gain/loss). Used-sale revenue currently excluded from the Sales ring.
10. **Member Unlimited-Transport: $0 promise vs. invoice truth** — the $0-transport entitlement must flow automatically from a COMPLETE membership into both the quote AND the invoice line, and be refused to Incomplete accounts in both places consistently.

---

## Design Principles

1. **Gate at the earliest possible moment, never the last.** Card/agreement/PO/cert/inspection blocks fire at quote/reservation/loading — not at the yard gate with a crew waiting.
2. **Same data, role-scoped projection.** Build the surface once; project role-specific overlays/columns/affordances. Don't fork parallel screens that drift.
3. **Margin floors are radioactive** on shared & customer-facing screens. Compute customer prices from floor data the requesting role can't see.
4. **One action, full fan-out, full audit — automatically.** High-friction actions complete in one tap while transactionally writing every linked record + an attributed History entry. Speed and traceability are not a trade-off.
5. **Derive the gate, surface only the verdict.** Expose a single derived pill/badge (eligibility, availability, member entitlement), never the underlying records.
6. **Stale-read is a correctness bug, not a UX nit.** Any cascading field updates downstream live + shows staleness where the source is a manual edit.
7. **Mobile reality for field roles**, even in a desktop-first app. Driver (gloves, dead zones), Outside Sales (jobsite), Customer (truck) need pan/large-tap, offline capture with queued retry, no hover-only affordances. The customer portal needs its own responsive, row-isolated build.
8. **Enforce isolation and gates server-side.** UI hiding a field is not security. Row-isolation, price-lock HMAC, override gates, and the data-sensitivity tiers are an access-control spec, not styling.
9. **Make business parameters Owner-settable, not hardcoded.** Rates, $150k goal, transport tiers, tax, service intervals route through the Sheets backend / Settings board, with KPI-ring impact documented.

---

## The 12-Step Role Checklist (the engine `/role` runs)

1. **Identify roles touched** — which of the 15 roles create / read / edit / are gated by this feature? List primary actor(s) + every incidental reader. For a shared screen, name each role and its lens.
2. **Authority check** — does each role's action stay within its tier? Flag any path where a role gains write/money/override/pricing power above its tier. Only Owner overrides blocks; only Office+Owner move money.
3. **Data-sensitivity check** — map every rendered field to the matrix. **HARD-FAIL** if margin floors appear on a Sales-shared/customer surface, if full PAN/Stripe secret surfaces anywhere, if HR raw docs reach a peer/operational role, or if customer PII beyond the thin operational slice reaches Dispatcher/Driver/Mechanic/M.Tech.
4. **Customer isolation check** — any customer-reachable surface: row-level isolation enforced SERVER-SIDE, no path to another customer's data, internal-only reasons (Failed/Not Ready, blacklist reasoning, staff notes) hidden — only availability/own-data shows.
5. **Gate timing + override check** — every block fires at the EARLIEST point, gives an actionable next step (not a dead end), and exposes an Owner-only override that is force-logged.
6. **Audit-trail check** — every money action, override, status transition, and gate bypass writes an append-only, timestamped, attributed History entry *automatically* (no form). Speed doesn't skip the log.
7. **Atomicity + cascade check** — if it fans out to linked records (Field Call, For Sale→block, hours→countdowns/ROI/availability, WO phase→badge), ONE action completes all writes transactionally with no partial/stale state. Derived badges/pills are live, not manual-refresh.
8. **Shared-surface projection check** — multiple consumers → ONE data layer with role-scoped overlays/columns/affordances (not a forked screen), each overlay gated to the entitled role only.
9. **Field/mobile + offline check** — field role (Driver, Outside Sales) or Customer: works in pan/large-tap, tolerates offline capture with queued retry, no hover-only affordances, critical action in ~3–5 taps.
10. **Rental-domain integrity check** — honors the invariants: transport flat-fee from the authoritative city lookup (no hand-edit, alert on unresolved city), 10.75% tax, member Unlimited-Transport=$0 only when complete, For-Sale/Inactive/Failed units blocked from availability, Round-Trip surfaces BOTH legs, price-lock HMAC respected on locked invoices.
11. **KPI + parameter check** — does it move any KPI ring formula (each role limited to its own ring)? Are business parameters Owner-settable, with ring impact documented?
12. **Run role-specific audit questions** — for each role flagged in step 1, run its `roles.md` audit questions against the spec; record pass/fail/gap. Output the consolidated failures, tier/isolation violations, and concrete fixes.
