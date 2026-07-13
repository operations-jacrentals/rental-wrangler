# Domain map — frozen `area/*` branches (reference only)

**These are legacy labels, NOT routing targets.** The app used to be split into ~19 long-lived `area/*` branches, each owning a domain, and `/start` routed each session to a task branch off one. Under **trunk-based development** that routing is gone — all new work is a short feature branch (or worktree) off `main` (see the `start` skill §3).

The `area/*` branches are **frozen**: dormant, kept-not-deleted. They carry large unaudited divergence, and some still hold live content (e.g. `area/backend-data` had the backend deploy queue), so a "what's stranded / unmerged" audit must happen before any cleanup — do **not** bulk-delete them.

This file survives only as a **domain reference** — a map of which domain owns which surface, useful for reasoning about where a change belongs. It is not a branch you route to.

**Domain reference** — which domain owns which surface (the `area/*` name is just the label):

| Domain (`area/*`) | Covers | Signals / keywords |
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
| `area/hr-compliance` | Employee records, CDL/medical-card/MVR tracking, equipment-type certifications, dispatch-eligibility pill, training logs | "HR", "certification", "CDL", "MVR", "eligibility", "license", "training", "compliance" |
| `area/sales-growth` | Quotes, outside/inside sales, equipment/used-equipment sales, marketing, pipeline depth, lead handling | "quote", "sales", "equipment sale", "used sale", "marketing", "pipeline", "lead" |
| `area/maps-location` | Maps integration, the dispatch map/cockpit, address capture/geocoding, drive-time + city-lookup transport pricing | "map", "address", "drive time", "route", "geocode", "location", "cockpit" |
| `area/search-views` | Global search (incl. phone-number + natural-date tokens), filters/pinned chips, saved Views menu, anchored-card navigation, list/dispatcher rows, toolbar | "search", "filter", "find", "navigation", "list view", "saved view", "chip", "toolbar" |
| `area/session-ops` | The `/start` skill + session startup, the branch preflight (`tools/branch-preflight.mjs`), and other session-orchestration / dev-process tooling that no domain area owns | "start skill", "session startup", "branch preflight", "session tooling", "dev process", "deploy flow" |

> The retired GPS/wrangler-gps and other one-off `area/*` branches also exist as frozen labels; the list above is the durable domain set. When you need to reason about *where* a change belongs, use this map — then do the work on a feature branch off `main`, never on the `area/*` branch itself.
