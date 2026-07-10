# Manager metrics package — the boss's visualization list, mapped onto the Round-Up

- **Date:** 2026-07-03
- **Status:** Draft for Jac's (and his manager's) review
- **Branch:** `claude/units-card-graphs-review-n5c67n`
- **Directive:** Jac forwarded his manager's list of wanted visualizations, including a
  written Time-Utilization formula. Jac's calls (popup, 2026-07-03): **spec first**;
  "Units of Work" = *completed work of all the staff roles*; Active/Inactive = the
  **activity meter** on customer profiles (`_digest.activePct`); hours source =
  **proxy now + start backend hour snapshots** so the exact formula takes over.
- **Builds on:** `2026-07-03-roundup-reporting-board-design.md` (the board + §13.6 data
  assembly) and the §13.7 gauge strip (PR #468). New panels land on the **board
  sections** and join the matching card's **strip tabs** — one panel registry serves both.

---

## 1. Already covered today (no build needed — show the manager where)

| Manager ask | Where it lives now |
|---|---|
| Field Call Count | Round-Up · Shop — **Field Calls** trend + worst-offender leaderboard; also the Units strip's Field Calls tab |
| Spending on Parts | Round-Up · Money — **Expenses by Category** (WO part costs, range-scoped) |
| Cancellations/No Shows (revenue lens) | Round-Up · Money — **Revenue by Status** carries Cancelled / No Show bars |
| Units of Work (live lens) | The **§11 KPI rings** already track each role's completed work in real time — mechanic (units ready, WOs completed, billable WOs), driver (deliveries, washes), office (collected $, active rentals), sales (revenue, actives, members). Admin-definable via Settings → KPIs & Rings |
| Billed Work Orders (live lens) | Mechanic ring #3 counts billable WOs today |

## 2. New panels (computable from data we already have)

| # | Panel | Section / strip | Formula & source | Mark → nav |
|---|---|---|---|---|
| N1 | **Net Sales** | Money / Invoices strip | Σ payments − refunds per time bucket (`invoiceTotals(i).paid − refundedAmount`, bucketed by invoice date) | bar → Invoices, period pill |
| N2 | **Refunds** | Money / Invoices strip | Σ `refundedAmount` per bucket | bar → Invoices, `Refunded` |
| N3 | **Invoice Aging** | Money / Invoices strip | open balances bucketed 0–30 / 31–60 / 61–90 / 90+ days past `dueDate` | bar → Invoices, `Late` |
| N4 | **Cancellations & No-Shows (count)** | Rentals | count of rentals hitting Cancelled / No Show per bucket | dot → Rentals, status pill |
| N5 | **Successful Rentals** | Rentals | count of rentals reaching Returned (not voided) per bucket — overlay on the Bookings trend | dot → Rentals, `Returned` |
| N6 | **Active / Inactive customers** | Customers | donut: `activePct > 0` = Active (the profile activity meter, server digest), split Members vs non | slice → Customers, `Active %` sort |
| N7 | **Memberships** | Customers | funnel/status counts from the membership engine (`memberStatus()`): Active · Past Due · Lapsed · **Cancelled** (cancellation-invoice holders) | slice → Customers, stage pill |
| N8 | **Billed Work Orders** | Shop | count + $ of WOs with `billCustomer='Yes'` and billed lines, per bucket | bar → Shop, `Bill: Yes` |
| N9 | **Days Since Last Field Call** | Shop | stat tile (was on the pre-redesign dashboard; returns as a Today's-Reality tile) | tile → Rentals, `field call` |
| N10 | **Work by Role** | Shop | the manager's "Units of Work" over TIME: completed WOs, inspections, deliveries/returns, collected invoices per bucket, one line per role-metric (the rings' numerators, historized from record dates) | dot → the owning card |
| N11 | **Dollar Utilization / category** | Fleet | range revenue per category ÷ fleet cost basis (Σ unit `purchasePrice`), annualized to the range | bar → Units, category pill |
| N12 | **Unit Cost per Hour** | Fleet | per unit: Σ WO part/labor cost ÷ (`currentHours − purchaseHours`) — leaderboard of the worst, flagging "problem units to get rid of" | row → that unit |

## 3. Time Utilization — his formula, and the data gap

> Every category has a useful-life hour total and an end-of-life year count →
> **expected hours/month**. `(actual ÷ expected) × 100 = utilization %`, rolling 30
> days. >100% → buy/fix; <100% → drum up demand.

- **New category fields** (schema-less, additive): `usefulLifeHours`, `endOfLifeYears`.
  `expectedMonthlyHours = usefulLifeHours ÷ (endOfLifeYears × 12)`. Jac enters the
  numbers per category (same values as WranglerGPS).
- **The gap:** actual hours per rolling 30 days needs hour *history*; we store one
  lifetime `currentHours` per unit. **Decision (Jac): both paths.**
  - **Proxy now (T1):** classic time utilization = days-on-rent ÷ available days per
    category, from rentals — ships immediately, clearly labeled "on-rent basis".
  - **Exact later (T2):** a daily backend snapshot `{date, unitId, currentHours,
    fleetStatus}` — the SAME job fleet-history #454 needs (one time-driven GAS
    trigger serves both). Once ≥30 days accumulate, the panel switches to
    `(Δhours ÷ expectedMonthlyHours) × 100` per category, 100% target rule drawn on
    the chart. Backend is additive, deployed via `/clasp` with its STOP gate.

## 4. Sensitivity flag (role lens — decide before build)

N11/N12 and the cost basis expose **purchase price / true cost / margin-adjacent**
numbers, and the Round-Up + strips are currently visible to any logged-in role. The
board's $-section role-gating decision is still open with Jac — these Fleet panels
join that decision: **recommend Admin/Office-only** for N11/N12 (server-digest or
role-gated render) before they ship. The rest of the package is operational data
already visible in the app.

## 5. Build order

1. **Phase M1** — Money + Rentals + Customers panels (N1–N7): pure front-end, data
   already assembled in §13.6 (add refund/aging/membership assemblers).
2. **Phase M2** — Shop panels (N8–N10) + the Days-since-FC tile.
3. **Phase M3** — Fleet: category life fields (+ category editor inputs), proxy Time
   Utilization + Dollar Utilization + Cost per Hour — behind the role-gating call.
4. **Phase M4 (backend)** — the daily snapshot trigger (serves #454 + exact hours);
   swap Time Utilization to the exact formula when history suffices.

Each phase: gates + real-login screenshot audit + squash-merge, same loop as the
Round-Up phases. Every new panel registers in `RU_PANELS` once and appears on the
board section *and* the owning card's strip tabs.

## 6. Open items

- Manager's "Units of Work" — N10 charts completed work per role over time; confirm
  that matches his intent (Jac: "I think we may have this covered already").
- Role-gating for N11/N12 (§4) — Jac's call.
- `usefulLifeHours` / `endOfLifeYears` values per category — Jac to supply (or import
  from WranglerGPS).
