# Branch map — area branches off `staging`

**How branching works here**
- The app is divided into long-lived **area branches** (`area/*`), each owning one domain — think of an area as a *chapter*.
- You don't work on an area branch directly. For each task you branch a short-lived **task branch off it** (`<domain>/<task>`), so multiple sessions can work the SAME area **in parallel without colliding** (3 payment ideas = `invoicing-payments/idea-a`, `/idea-b`, `/idea-c` — three sessions, zero stepping on each other).
- Flow: **`<domain>/<task>` → `area/<domain>` → `staging`** (integration + preview/debug) → after debugging, **`staging` → `main`** (live at app.jacrentals.com).
- `/start` reads this map, matches what you describe to the best area, and (with your OK) cuts a task branch off the **latest** of that area — every session starts current.
- Naming: task branch is `<domain>/<task>` (e.g. `invoicing-payments/refund-rounding`), **NOT** `area/<domain>/<task>` — git won't nest a branch under an existing branch's name.
- `main` is protected (PR + CI required); never commit straight to it. `staging` is where areas converge and get debugged before promotion.

**Routing table** — match the user's described work to an area:

| Area branch | Covers | Route here when they say… |
|---|---|---|
| `area/rentals-dispatch` | Rental lifecycle, dispatch time grid, transport journeys (Yard→Truck→Site), driver tasks, round-trip delivery/recovery, field calls, no-show + per-unit status engine, multi-unit rentals | "dispatch", "rental status", "delivery", "pickup", "field call", "transport", "round trip", "multi-unit" |
| `area/invoicing-payments` | Invoices, line items, Stripe charge/refund, card-on-file picker, payment ledger, aging/collections ladder, PO gate, price-lock HMAC, partial-payment allocation, cash refunds, tax (10.75%) | "invoice", "payment", "refund", "billing", "collections", "PO", "price lock", "cash" |
| `area/customers-crm` | Customer accounts, onboarding (selfie/signature/agreement packet), card-on-file consent, funnel stages, activity log, blacklist, quick-add | "customer", "onboarding", "agreement", "card on file", "funnel", "activity log", "blacklist" |
| `area/memberships` | Membership state machine (Incomplete→Paid), unlimited-transport entitlement, renewals/Paid-Until, member pricing gating | "membership", "member rate", "renewal", "unlimited transport" |
| `area/units-fleet` | Units, categories, fleet status (Active/For Sale/Sold/Inactive), inspections (Ready/Not Ready/Failed), GPS status, purchase/cost data, availability window/calendar | "unit", "category", "fleet", "inspection", "availability", "GPS", "purchase cost" |
| `area/maintenance-shop` | Work orders (journey/phases/parts), service orders + countdowns, mechanic/M.Tech queues, the merged Shop card, parts inventory, vendors | "work order", "WO", "maintenance", "service", "mechanic", "M.Tech", "parts", "vendor", "shop" |
| `area/financials-kpi` | KPI rings, ROI/annualization, time + dollar utilization, $150k revenue goal, owner dashboard, Board View formula engine, gamification score pops, expenses/receipts | "KPI", "ROI", "revenue goal", "dashboard", "board view", "utilization", "expenses", "gamification" |
| `area/backend-data` | clasp/GAS backend, Google Sheets sync + persistence, saved Views/searches store, data import/migration, real-data vs demo seed | "backend", "clasp", "sheets", "persistence", "sync", "import", "migration", "views", "saved search" |
| `area/design-system` | The R-rulebook (R-rules), `jactec-ui` tokens/recipes, cards/pills/flags, popups & dialogs (tiers/shell), anti-slop, Design Inspector/Lint | "design", "rulebook", "R-rule", "pill", "flag", "card style", "popup", "dialog", "tokens", "theme" |
| `area/mobile-remote` | Mobile navigation/touch/viewport, responsive reflow, the customer self-service portal (row-isolated), phone/remote ergonomics | "mobile", "phone", "responsive", "touch", "viewport", "customer portal", "self-service" |
| `area/comms-notifications` | In-app notifications + outbound customer communication (SMS text + email): message templates, send triggers/scheduling, delivery status, alerts/reminders | "notification", "alert", "remind", "text", "SMS", "email", "communication", "message customer" |
| `area/hr-compliance` | Employee records, CDL/medical-card/MVR tracking, equipment-type certifications, dispatch-eligibility pill, training logs (net-new domain) | "HR", "certification", "CDL", "MVR", "eligibility", "license", "training", "compliance" |
| `area/sales-growth` | Quotes, outside/inside sales, equipment/used-equipment sales, marketing, pipeline depth, lead handling | "quote", "sales", "equipment sale", "used sale", "marketing", "pipeline", "lead" |
| `area/maps-location` | Maps integration, the dispatch map/cockpit, address capture/geocoding, drive-time + city-lookup transport pricing (§10) | "map", "address", "drive time", "route", "geocode", "location", "cockpit" |
| `area/search-views` | Global search (incl. phone-number + natural-date tokens), filters/pinned chips, saved Views menu, anchored-card navigation, list/dispatcher rows, toolbar | "search", "filter", "find", "navigation", "list view", "saved view", "chip", "toolbar" |

**Rules for routing**
- Pick the single best area. If two genuinely overlap (e.g. a dispatch feature that's mostly a map), name both and let Jac choose via `AskUserQuestion`.
- Cross-cutting design tweaks (pills, R-rules) → `area/design-system` even if they touch another area's screen.
- If nothing fits, propose a NEW `area/<slug>` off `staging` (don't force a bad match).
- Never route onto `main` directly — it's protected and live.
