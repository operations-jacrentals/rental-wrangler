# BUG: Plan needed — displaying multiple invoices on the rental standard view

**Reported by Jac (verbatim):** "What is the plan for displaying multiple invoices on the rental standard mode?"

**Area:** invoicing-payments

**Status:** DESIGN/PLANNING question — not a regression. Resolve via the `brainstorming` skill into an approved spec before any code.

**Symptom:** With the 28-day invoice series, a single rental can now own multiple invoices, but the rental standard-mode detail was built around one canonical invoice. We need an agreed plan for how the standard view presents the full invoice series.

**Suspected code locations:**
- `app.js:5719-5721` — `DETAIL.rentals` (the §12.2 standard-mode renderer for a rental). This is where the invoice presentation is built.
- `app.js:5724-5725` — `const invs = rentalInvoices(r);` then `const inv = invs[0] || …`. The series is fetched, but `inv` (the *first*) is still treated as the canonical invoice for downstream display.
- `app.js:5733-5737` — the invoice pill builder: it already `invs.map(...)` to render one pill per invoice (so multiple pills do show), with an "Invoice k of N — continuation (28-day cap)" tip. This is the current extent of multi-invoice display.
- `app.js:5726` / `5739-5744` — `invT = invoiceTotals(inv)` (first invoice only) and the header balance, which sums `eventTotal`/`eventPaid` across the whole series — i.e. totals are series-aware but the status/`invT` anchor is single-invoice.
- `app.js:967` — `rentalInvoices(r)` (APP-05), the source of truth for a rental's ≤28-day invoice series; `INV_CAP_DAYS`/`invoiceChunks` nearby (APP-05, `app.js:942`).

**Root-cause hypothesis (hypothesis):** Not a bug — a design gap. The standard view renders a pill per invoice and sums balances across the series, but still leans on `invs[0]` for the canonical status/`invoiceTotals` and the balance-line anchor. The open question is how to surface a *series* of invoices (continuation chunks) clearly: e.g. a compact per-invoice ledger/list with status + balance each, vs. the current pill row + summed header.

**Acceptance criteria:**
- [ ] A written design/spec for multi-invoice display in rental standard mode is produced.
- [ ] The spec defines: layout of the invoice series (pills vs. mini-ledger), which totals are per-invoice vs. summed, how continuation/28-day-cap chunks are labeled, and how each invoice is opened/anchored from the rental.
- [ ] The spec is reviewed through `jactec-ui` (yard data-plate language) and the `/role` lens for any margin/PII/data-sensitivity concerns before any build.
- [ ] Jac approves the design before implementation begins.

**Notes:** Use the `brainstorming` skill to turn the question into an approved design before any code. Run the resulting UI through `jactec-ui`. If new popups/columns result, they must update `WINDOW_CATALOG` (APP-27) and the R-rulebook `data-r` stamps. Money/status are derived in Act II (`invoiceTotals`, APP-04) — display only, do not store derived figures.
