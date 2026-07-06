# Areas Roadmap — the master spec index

**Date:** 2026-06-28 (specs drafted 2026-06-29)
**Status:** LIVING INDEX — the table of contents for all per-area specs
**Owner:** Jac
**Scope:** The 24 original `area/*` domains of Rental Wrangler **+ 3 areas added 2026-06-29** (Customer Portal, Equipment Insurance, Collections) = **27 areas.** The public **marketing website** is explicitly a *separate* service (see "Out of scope").

> **All 27 area specs are ✅ critiqued** (linked in the **Spec** column). Each was authored
> against its live code baseline, then critiqued one-at-a-time with Jac on **2026-06-29** —
> every fork resolved via popup and recorded in a dated `## ✅ Decisions — 2026-06-29 critique (Jac)`
> block at the top of each spec, with a `> Resolved 2026-06-29:` pointer in its §11/Open-Questions.
> Remaining items are explicitly build-time calls or cross-area blockers (e.g. `backend-data`
> server-tier trust), noted in each spec — not open critique forks.

---

## What this is

Per-area specs are the unit of design work (one `docs/specs/<slug>.md` per area, written
one at a time and living on its `area/<slug>` branch). **This file is the thin index above
them** — it holds the priority order, a one-line scope per area, the *current code state*
(so each spec starts from a real baseline, not a guess), the key code anchors, and the
cross-area dependencies. As each per-area spec is written it gets linked from the **Spec**
column below.

Each area's "Today" line and anchors were mapped directly against the live codebase
(`app.js` / `config.js` / `data.js` / `docs/`) on 2026-06-28.

### Priority = Wants vs Needs

Ordering is **needs-first**: the systems the business cannot run without come before the
high-value "wants." Within each tier, ordering reflects how foundational the area is to the
ones below it. 🆕 marks an area added 2026-06-28 (no `area/` branch cut yet).

**Maturity:** ✅ Shipped · 🟡 Partial · ⬜ Greenfield

---

## At a glance

### NEEDS — can't run the business without these

| # | Area | Slug | Maturity | Spec |
|---|------|------|----------|------|
| 1 | Rentals / Dispatch | `rentals-dispatch` | ✅ Shipped | [✅ critiqued](./rentals-dispatch.md) |
| 2 | Units / Fleet | `units-fleet` | ✅ Shipped | [✅ critiqued](./units-fleet.md) |
| 3 | Invoicing / Payments | `invoicing-payments` | ✅ Shipped | [✅ critiqued](./invoicing-payments.md) |
| 4 | Customers / CRM | `customers-crm` | ✅ Shipped | [✅ critiqued](./customers-crm.md) |
| 5 | Accounting 🆕 | `accounting` | 🟡 Partial | [✅ critiqued](./accounting.md) |
| 6 | Maintenance / Shop | `maintenance-shop` | ✅ Shipped | [✅ critiqued](./maintenance-shop.md) |
| 7 | Backend / Data | `backend-data` | ✅ Shipped | [✅ critiqued](./backend-data.md) |

### WANTS — high-value growth & operations intel

| # | Area | Slug | Maturity | Spec |
|---|------|------|----------|------|
| 8 | GPS / Tracking 🆕 | `gps-tracking` | 🟡 Partial (seam) | [✅ critiqued](./gps-tracking.md) |
| 9 | Automated Pricing 🆕 | `automated-pricing` | ⬜ Greenfield | [✅ critiqued](./automated-pricing.md) |
| 10 | Market Research 🆕 | `market-research` | ⬜ Greenfield | [✅ critiqued](./market-research.md) |
| 11 | Fleet Spread 🆕 | `fleet-spread` | ⬜ Greenfield | [✅ critiqued](./fleet-spread.md) |
| 12 | Financials / KPI | `financials-kpi` | ✅ Shipped | [✅ critiqued](./financials-kpi.md) |
| 13 | Search / Views | `search-views` | ✅ Shipped | [✅ critiqued](./search-views.md) |
| 14 | Memberships | `memberships` | ✅ Shipped | [✅ critiqued](./memberships.md) |
| 15 | Comms / Notifications | `comms-notifications` | 🟡 Partial | [✅ critiqued](./comms-notifications.md) |
| 16 | HR / Compliance | `hr-compliance` | ⬜ Greenfield | [✅ critiqued](./hr-compliance.md) |
| 17 | Maps / Location | `maps-location` | ✅ Shipped | [✅ critiqued](./maps-location.md) |
| 18 | Sales / Growth | `sales-growth` | 🟡 Partial | [✅ critiqued](./sales-growth.md) |
| 19 | Marketing 🆕 | `marketing` | ⬜ Greenfield | [✅ critiqued](./marketing.md) |
| 20 | Security Cameras 🆕 | `security-cameras` | ⬜ Greenfield | [✅ critiqued](./security-cameras.md) |
| 21 | Mobile / Remote | `mobile-remote` | 🟡 Partial | [✅ critiqued](./mobile-remote.md) |
| 22 | Wrangler AI | `wrangler-ai` | ✅ Shipped | [✅ critiqued](./wrangler-ai.md) |
| 23 | Design System | `design-system` | ✅ Shipped | [✅ critiqued](./design-system.md) |
| 24 | Frontend Performance | `frontend-performance` | 🟡 Partial | [✅ critiqued](./frontend-performance.md) |

### 🆕 Added 2026-06-29 (Jac) — all Wants; placement set 2026-06-29

| Area | Slug | Maturity | Priority (Jac) | Spec |
|------|------|----------|----------------|------|
| Customer Portal | `customer-portal` | ⬜ Greenfield | **Mid-Wants** (after core internal ops) | [✅ critiqued](./customer-portal.md) |
| Equipment Insurance | `equipment-insurance` | ⬜ Greenfield | **Later-Wants** | [✅ critiqued](./equipment-insurance.md) |
| Collections | `collections` | ⬜ Greenfield | **Later-Wants** (with the invoicing/accounting cluster) | [✅ critiqued](./collections.md) |

- **Customer Portal** — external, customer-facing self-service: customers log in (a *separate, row-isolated* auth surface), see their on-rent units **live on a Google Map**, view order/spend history, **book** available + feature rentals, and **flag a unit for a field call** (pickup/delivery). Supersedes the "customer self-service portal" placeholder in `mobile-remote`. The load-bearing problem is external-customer auth + strict per-customer **data isolation** (the current single-team-password model doesn't provide it).
- **Equipment Insurance** — a service JacRentals provides: an **owner-side** UI to select **which units are insured** and **which coverage/service types** each unit gets. Must be reconciled against the existing membership **"Rental Protection"** (the customer-facing damage-cap add-on) — related but distinct.
- **Collections** — turns the existing 120-day **Collections** aging tier into an actionable feature: route an uncollectable invoice to a **3rd-party collections service** (outbound integration), track status, and reconcile recoveries back. Resolves the invoicing/accounting "uncollectable" thread.

### Out of scope — separate services (not `area/*` in this project)

- **Marketing website** — JacRentals' public website carries many tools that **do not need to be linked into this software project** (Jac, 2026-06-29). Tracked as a separate service, not an area here.

---

# NEEDS

## 1 · Rentals / Dispatch — `rentals-dispatch` ✅
**Scope.** Owns the full rental lifecycle (Quote → Return): multi-unit event modelling, the
rental-window picker, extension billing, transport/delivery legs with inline Google Maps, and
the dispatch cockpit (Calendar card) showing the day's run as a live map + reorderable rail.

**Today.** Substantial shipped feature set on `main`: multi-unit event model, the rate-blend
money engine (`rentalPrice`), the 28-day extension/invoice series, the inline transport editor,
and the dispatch cockpit (live Google map + DnD rail + editable stop-times + telematics seam).
*Unbuilt:* Phase 2 driver cab, Phase 3 live auto-notify.

**Anchors.** `APP-04` (app.js:836), `APP-05` (app.js:930), `APP-06` (app.js:1290), dispatch cockpit app.js:8032–8300, `winPickSave` app.js:14984.
**Depends on.** `invoicing-payments`, `units-fleet`, `customers-crm`, `maps-location`, `gps-tracking`, `automated-pricing`, `comms-notifications`, `backend-data`.

## 2 · Units / Fleet — `units-fleet` ✅
**Scope.** Owns the unit and category records, their fleet/inspection/GPS statuses,
availability-window logic, the Add Unit/Category quick-create, the fleet migration tool, and the
unit detail card (Specs, GPS, Investment, Inspection).

**Today.** Full Units + Categories cards live: status registries, `isUnitAvailableFor` /
`categoryAvailableCount` availability, inline-editable detail sections, `quickAddUnitFromSearch`,
and the `#migrate-units` admin tool. *Open task branch:* `units-fleet/category-rows-scroll-group`.

**Anchors.** unit detail app.js:5854, availability app.js:1702, fleet dropdown app.js:11462, migration app.js:8481, data.js:34, config.js:72/77.
**Depends on.** `rentals-dispatch`, `maintenance-shop`, `automated-pricing`, `gps-tracking`, `financials-kpi`, `backend-data`.

## 3 · Invoicing / Payments — `invoicing-payments` ✅
**Scope.** Owns the invoice lifecycle (creation, line items, tax, aging, locking, merging, 28-day
series splitting) and every payment path (Stripe card/ACH, manual cash/check, refunds, card-on-file).

**Today.** Shipped: `invoiceTotals` (10.75% tax, six aging tiers), the 28-day `INV_CAP_DAYS`
series, and the full Stripe client (charge/finalize/refund/lock + manual cash/check). *Gated off:*
per-line partial refunds (`PARTIAL_REFUNDS_ENABLED` flag, app.js:5548).

**Anchors.** `APP-04` (app.js:841), `APP-05` (app.js:942), `APP-35` (app.js:14143), app.js:1602, config.js:29.
**Depends on.** `rentals-dispatch`, `customers-crm`, `backend-data`, `units-fleet`, `memberships`, `accounting`.

## 4 · Customers / CRM — `customers-crm` ✅
**Scope.** Owns the Customer lifecycle: creation, contact/account details, dual sales funnels,
the activity-cadence engine, payment-method management, agreement/selfie capture, and the new/edit form.

**Today.** Full Customers card: rich detail renderer, new/edit overlay with selfie+signature
capture, dual funnel pills, a 5-stage cadence engine + 9-month spend chart, payment methods, flag-driven
row colors, and Mr. Wrangler create/edit. Seed `_digest` history is currently static.

**Anchors.** `APP-16` (app.js:6087), new/edit app.js:9448/14017, cadence app.js:5261, funnels app.js:11383, data.js:54.
**Depends on.** `invoicing-payments`, `memberships`, `rentals-dispatch`, `design-system`, `backend-data`, `wrangler-ai`.

## 5 · Accounting — `accounting` 🆕 🟡
**Scope.** Owns the expense ledger, vendor spend, and any future accounting-system integration
(P&L, QuickBooks/Xero export, tax reporting, chart of accounts) above the invoicing/payments layer.

**Today.** An Expenses & Receipts board is shipped — expense records (reconcile status, method,
category, WO link, receipt photo) and `vendorTotals` spend rollups. *Nothing else exists:* no P&L,
export, chart of accounts, budget, or accounting-system integration anywhere.

**Anchors.** expenses data.js:184, index app.js:691, detail app.js:5993, `vendorTotals` app.js:11138, categories config.js:150.
**Depends on.** `invoicing-payments`, `financials-kpi`, `maintenance-shop`, `units-fleet`, `backend-data`.

## 6 · Maintenance / Shop — `maintenance-shop` ✅
**Scope.** Owns the merged Shop card (Work Orders, Service Orders, Inspections), the
recurring-service countdown engine, WO lifecycle/parts/billing, the inspection→auto-WO cascade, and
the parts-inventory & vendor boards.

**Today.** The merged Shop card is shipped (three sub-types, urgency sort, detail views), with the
service-countdown engine, WO phases + billable formula + drag-to-invoice, and the inspection
wash→checklist→auto-WO flow. *Approved-unbuilt:* wrench Shop toggle + 3-bar graph; per-item inspection
evidence capture.

**Anchors.** `APP-19` (app.js:6848), service-countdown.js, `woBillable` app.js:1776, `startNewInspection` app.js:14786, config.js:115/363.
**Depends on.** `units-fleet`, `invoicing-payments`, `backend-data`, `design-system`, `financials-kpi`, `rentals-dispatch`.

## 7 · Backend / Data — `backend-data` ✅
**Scope.** Owns the data contract between the SPA and the Google Apps Script / Sheets backend: the
entity schemas, the 11-entity diff-sync layer, the single `backendCall` entry point, the full action
catalog, and the live multi-user polling refresh.

**Today.** Sync is fully operational: `PERSIST_KEYS` (11 entities), `backendCall`, `loadFromBackend`,
`computeChanges` diff upserts/deletes, and the `refreshFromBackend` polling loop. `Code.gs` is gitignored,
deployed via `/clasp`; contract documented in `CODE-MAP.md` Part III. *Known drift:* the `wranglerComment`
resume path doesn't clear the `wrangler-needs-jac` label.

**Anchors.** `APP-38` (app.js:15637), data.js, docs/CODE-MAP.md:391, docs/backend-clasp-setup.md, docs/wrangler-inbox-backend.md.
**Depends on.** all entity areas + `wrangler-ai`, `comms-notifications`, `memberships`, `security-cameras`.

---

# WANTS

## 8 · GPS / Tracking — `gps-tracking` 🆕 🟡 (seam only)
**Scope.** Live GPS/telematics integration: real-time unit location, geofencing, driver scoring, and
offline/stray alerting.

**Today.** Only metadata + seams exist: per-unit `gpsType/Placement/Status` fields + a 3-value
`gpsStatus` registry + two flag colors; the dispatch map's `dispatchTruckPos` is an explicit v1
placeholder ("swapped for live telematics ~next week"); the Driving Score KPI ring is null; Settings has a
telematics-feed stub. *No live feed, geofencing, or webhooks.* (GPSWOX appears as a seed device type.)

**Anchors.** GPS section app.js:5873, `dispatchTruckPos` app.js:8114, flags app.js:3956, config.js:145.
**Depends on.** `units-fleet`, `maps-location`, `rentals-dispatch`, `financials-kpi`, `backend-data`.

## 9 · Automated Pricing — `automated-pricing` 🆕 ⬜
**Scope.** An engine that proposes or applies rate changes automatically — occupancy surge, seasonal
rules, competitor benchmarking, or AI-suggested adjustments — vs. the static manual rates today.

**Today.** Pricing is fully static: five per-category rate fields and `rentalPrice()` picking the
cheapest blend, with `catRatesUnset()` guarding unset rates. *No automation, demand signal, or
recommendation code exists anywhere.*

**Anchors.** `APP-04` `rentalPrice` app.js:836, `catRatesUnset` app.js:873, rate fields data.js:25, config.js:491.
**Depends on.** `units-fleet`, `rentals-dispatch`, `market-research`, `financials-kpi`, `backend-data`.

## 10 · Market Research — `market-research` 🆕 ⬜
**Scope.** Capture, store, and surface external market intelligence — competitor/MSRP/auction/rental
pricing, regional benchmarks, lost-demand signals, and demand trends — to inform purchasing and pricing.

**Today.** Nothing in code. The only adjacent reference is a lost-demand audit question in the Fleet
Manager role doc — an aspiration, not implemented.

**Anchors.** (none) · role doc role-roles.md:132.
**Depends on.** `units-fleet`, `automated-pricing`, `financials-kpi`, `backend-data`.

## 11 · Fleet Spread — `fleet-spread` 🆕 ⬜
**Scope.** Strategic expansion beyond the single yard — geographic/market entry, partner/co-owner
arrangements, multi-location fleet coordination, and the tooling to manage dispersed equipment.

**Today.** Nothing. The app is single-location by design — one Sheets DB, one password gate, one set of
`PERSIST_KEYS`. A role-doc note explicitly confirms "single-store … if multi-location is ever added."

**Anchors.** (none) · role doc role-roles.md:60.
**Depends on.** `units-fleet`, `rentals-dispatch`, `financials-kpi`, `maps-location`, `backend-data`.

## 12 · Financials / KPI — `financials-kpi` ✅
**Scope.** Owns the role-based KPI ring dashboard, the admin-definable KPI metric engine (DSL + Mr.
Wrangler authoring), per-card graph overlays, and the Revenue Goal — *not* general ledger/accounting.

**Today.** Shipped: 5 role KPI rings, the KPI metric engine with a ratio/count/goal/sum DSL + score-pops
+ a Settings authoring pane, an admin-settable Revenue Goal, and per-card graph overlays. *Null
placeholders:* Driving Score (needs GPS) and Reputation (needs email).

**Anchors.** `APP-20` (app.js:7042), `APP-21` (app.js:7166), `APP-24` (app.js:8321), config.js:301/557.
**Depends on.** `rentals-dispatch`, `units-fleet`, `invoicing-payments`, `customers-crm`, `maintenance-shop`, `gps-tracking`, `wrangler-ai`, `accounting`.

## 13 · Search / Views — `search-views` ✅
**Scope.** Owns global + per-card search, AND-narrowing filter chips, the date/range picker, the cascade
pill, per-card sort, and saved Views (admin-curated, backend-synced).

**Today.** Fully working: `IDX.search` per-record blobs (incl. reverse renter-name denorm), NOT-terms,
col-scoped filters, an availability live-token, the `APP-36` date picker, and Saved Views synced via
`getViews/setViews`. *Note:* Views capture search + chips but **not** sort.

**Anchors.** `APP-03` (app.js:78), `APP-36` (app.js:15187), match app.js:2343, views app.js:11532, cascade.js.
**Depends on.** all entity cards + `design-system`, `frontend-performance`, `backend-data`.

## 14 · Memberships — `memberships` ✅
**Scope.** Owns the subscription lifecycle: enrollment, Monthly/Annual billing, add-ons (Unlimited
Transport, Rental Protection), the Active/Past-Due/Lapsed/Incomplete state machine, member-rate +
transport entitlement gates, the funnel, economics, and cancel/reactivate.

**Today.** Shipped across PRs #338/#342/#344: the pricing + fee calculator, the 5-state lifecycle, the
entitlement gate, economics, the enroll overlay, and backend-wired enroll/cancel/reactivate. *Deferred:*
auto-renewal cron and the $2,000/mo Rental Protection damage-claim accounting.

**Anchors.** engine app.js:3131–3389, `isActiveMember` app.js:3185, enroll UI app.js:8989, agreements.js:71.
**Depends on.** `invoicing-payments`, `customers-crm`, `rentals-dispatch`, `automated-pricing`, `backend-data`, `financials-kpi`, `maps-location`.

## 15 · Comms / Notifications — `comms-notifications` 🟡
**Scope.** Owns all comms channels — internal team chat, operator notifications (resolved-fix bell), and
outbound customer messaging (SMS/email quotes, reminders, dispatch alerts, reputation requests).

**Today.** Shipped *internally:* the team-chat dock (`getChats/setChats`) and the Wrangler notification
bell. The only outbound customer channel is `sendInvoiceText()`, an `sms:` deep-link — **no server-side
send.** The Notifications settings tab is a stub; the Reputation KPI is null pending an email backend.

**Anchors.** team chat `APP-23` app.js:7541, bell app.js:10915, `sendInvoiceText` app.js:14756.
**Depends on.** `rentals-dispatch`, `customers-crm`, `invoicing-payments`, `wrangler-ai`, `backend-data`, `mobile-remote`.

## 16 · HR / Compliance — `hr-compliance` ⬜
**Scope.** Owns employee records, CDL/medical-card/MVR credential tracking, equipment-type
certifications, dispatch-eligibility signaling, and training/compliance logs.

**Today.** Nothing. Closest is the `ROLES` registry + the `ROLE_TIERS` permission ladder and the null
Driving Score ring. No employee entity, credentials, or training records exist.

**Anchors.** `ROLES` config.js:302, `ROLE_TIERS` config.js:326, Driving Score app.js:7123.
**Depends on.** `rentals-dispatch`, `units-fleet`, `gps-tracking`, `maintenance-shop`, `backend-data`, `security-cameras`.

## 17 · Maps / Location — `maps-location` ✅
**Scope.** Owns all Google Maps integration: the inline transport editor (autocomplete, minimap,
drive-distance), the dispatch cockpit map (route arrows, stop ordering), and the transport-pricing bridge.

**Today.** Shipped: the inline transport editor (`APP-06`) with Places autocomplete + RouteMatrix
distance + offline city-tier fallback, and the dispatch cockpit map with drag-reorder, route arrows,
geocode cache, and a truck-position marker seamed to future telematics. Maps key is referrer-locked.

**Anchors.** `APP-06` app.js:1290, dispatch map app.js:8029, `computeTransportPrice` config.js:491, docs/google-maps-setup.md.
**Depends on.** `rentals-dispatch`, `units-fleet`, `invoicing-payments`, `gps-tracking`, `backend-data`.

## 18 · Sales / Growth — `sales-growth` 🟡
**Scope.** Owns the customer sales pipeline (used-equipment sales + membership sign-ups), next-action
scheduling, sales KPI rings, and future growth tools (quoting, campaigns, referrals).

**Today.** Live: the dual funnels (`usedSalesStage` + `membershipStage`) on each customer, a `salesAction`
field + `activityLog` + a date/time follow-up popup, and a dedicated Sales KPI ring (Revenue Goal, Active
Rate, Pipeline). *No dedicated chapter/board;* the ROADMAP area has zero items.

**Anchors.** funnels config.js:134, pills app.js:11492, schedule popup app.js:9649, Sales KPI app.js:7132, data.js:60.
**Depends on.** `customers-crm`, `memberships`, `financials-kpi`, `invoicing-payments`, `comms-notifications`.

## 19 · Marketing — `marketing` 🆕 ⬜
**Scope.** Tools that turn fleet utilization, customer history, and seasonal demand into bookings —
promotions, membership-enrollment drives, outreach lists, and acquisition-vs-retention measurement.

**Today.** No dedicated feature. Adjacent: 'Marketing'-grouped company-file links (QR/banner/logos), the
funnel registry it would read, and a Marketing role doc. *The branch-map currently routes "marketing" →
`sales-growth`* — whether Marketing stays its own area is an open question.

**Anchors.** files data.js:174, funnel config.js:134, role doc role-roles.md:159, branch-map.md:27.
**Depends on.** `customers-crm`, `sales-growth`, `units-fleet`, `financials-kpi`, `comms-notifications`, `memberships`.

## 20 · Security Cameras — `security-cameras` 🆕 ⬜
**Scope.** Embed and surface live/recorded yard & property camera feeds inside the app so staff can
monitor the lot, verify unit positions, and review footage without leaving the system.

**Today.** Nothing. The only "camera" code is the selfie/inspection **device-camera** capture
(`startAgCam`) — document capture, not surveillance. No stream URLs, RTSP/HLS, or NVR integration exist.

**Anchors.** device cam app.js:11037 (not surveillance).
**Depends on.** `maps-location`, `units-fleet`, `mobile-remote`, `backend-data`, `frontend-performance`.

## 21 · Mobile / Remote — `mobile-remote` 🟡
**Scope.** Owns the phone/tablet responsive layer (reflow, swipe nav, touch gestures, haptics,
bottom-sheets, safe-area, PWA manifest) and the future customer self-service portal (row-isolated build).

**Today.** The internal mobile reflow (M0–M3) is substantially shipped: 3→2→1 breakpoints, bottom-sheet
overlays, touch-target floors, safe-area insets, swipe boot, `haptic()`, and the zip-zone drag engine +
PWA manifest. *No service worker;* the customer self-service portal is unbuilt.

**Anchors.** CSS style.css:300–456, `mobileCol` app.js:1920, dock app.js:7499, zip-zones app.js:12120, swipe app.js:16095.
**Depends on.** `rentals-dispatch`, `comms-notifications`, `customers-crm`, `design-system`, `frontend-performance`, `backend-data`.

## 22 · Wrangler AI — `wrangler-ai` ✅
**Scope.** Owns Mr. Wrangler — the chat dock, system prompt, agentic read/write tool loop, the action
parse/apply/preview pipeline, the Track B self-healing auto-fixer (issue → agent → PR → CI → Pages), and
the wrangler rail cross-device sync.

**Today.** Shipped agentic feature: the multi-turn agent loop (`wrRunAgent`, 8 turns) over 9 read tools +
the `apply_changes` write tool, the create/update/import/operate action pipeline, the requests inbox,
Track B bug-filing, and IndexedDB rail persistence. *Specced/partial:* cross-device sync; full-action-parity
Stages 2–3.

**Anchors.** `APP-28` (app.js:9885), `APP-29` (app.js:10300), tools app.js:10023/10096, docs/wrangler-pipeline.md.
**Depends on.** `backend-data`, `rentals-dispatch`, `units-fleet`, `invoicing-payments`, `customers-crm`, `maintenance-shop`, `accounting`, `frontend-performance`.

## 23 · Design System — `design-system` ✅
**Scope.** Owns the visual language + enforcement: the R0–R25 stamped rulebook, the token/theme CSS, the
per-rule builders, the admin Rulebook overlay, `DESIGN.md`, the CI guards, and the `jactec-ui` skill.

**Today.** Deeply enforced and shipped: the full token layer, one builder per rule (`APP-10`), the
flag-color engine (`APP-11`), `RULE_META` + the admin Rulebook (`APP-12`), `DESIGN.md`, three CI gates,
and the `jactec-ui` skill. *Windows Catalog: SHIPPED* (`WINDOW_CATALOG` + `check-window-catalog.mjs` CI guard).

**Anchors.** `APP-10` (app.js:4040), `APP-11` (app.js:3700), `APP-12` (app.js:4349), style.css:8, DESIGN.md.
**Depends on.** `search-views`, `frontend-performance`, `wrangler-ai`.

## 24 · Frontend Performance — `frontend-performance` 🟡
**Scope.** Owns the techniques + guardrails that keep the SPA fast: render-budget enforcement, list
windowing, image downscaling, debounced saves, the rAF drag loop, Drive-upload throttling, IndexedDB, and
cache-busting.

**Today.** Shipped primitives in active use: the 100ms render-budget warn, 60-row list windowing
(`VIRT_CAP` + "Show more"), the single-rAF drag loop, 1200ms `saveSoon` debounce, client-side
`downscaleImage`, 3-concurrent Drive-upload throttle, the IndexedDB rail, and manual `?v=` cache-busting.
*Missing:* service worker, code splitting, Web Vitals instrumentation.

**Anchors.** budget config.js:558 + app.js:11619, windowing app.js:6535, drag app.js:12080, `saveSoon` app.js:15851.
**Depends on.** `design-system`, `backend-data`, `wrangler-ai`, `maps-location`.

---

## How we spec from here

1. Pick the next area (Jac's call — usually top-of-priority or whatever's most pressing).
2. Run it through `/brainstorming` → an approved `docs/specs/<slug>.md` (house template:
   see `docs/specs/flag-color-system.md`), seeded from that area's **Today** baseline,
   dependencies, and the open questions surfaced during mapping.
3. Offer the `/role` audit (folded into `/jactec-ui`) on the finished spec.
4. Link the spec from the **Spec** column above and flip its checkbox.
5. New 🆕 areas get their `area/<slug>` branch cut off `staging` when build work begins.
