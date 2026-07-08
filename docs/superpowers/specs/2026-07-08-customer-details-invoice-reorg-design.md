# Customer Details reorg — retire the Invoice card, embed invoices, funnel toggle

**Date:** 2026-07-08
**Area:** `area/customers-crm` · task branch `claude/customer-details-card-reorg-4hyb5l`
**Status:** Design — awaiting Jac's review
**Mockup:** https://claude.ai/code/artifact/45c45b59-10fa-4efb-93be-22f85cdf6fa6

---

## 1. Summary

Three related changes to the Customer Details surface, shipped as **two PRs**:

- **PR 1 (this branch):**
  1. **Retire the standalone Invoice card.** Convert its list into a scrollable **Invoices section inside Customer Details**, filtered to that customer. Clicking an invoice **expands it in place** (accordion) into an improved, interactive version of the print invoice.
  2. **Redirect every cross-link** that pointed at the old Invoice card so it lands inside Customer Details, scrolled to and expanding the target invoice.
  3. **Fold Membership + Used Sales into one "Programs" section** with a segmented toggle (off-tab keeps its count).
- **PR 2 (separate, later):** add a **Sales card** in the slot the Invoice card vacated — a dashboard/work-manager card modeled on the driver Calendar card (bespoke body, no list→detail drill-down). Out of scope here except to confirm PR 1 leaves a clean slot for it.

**Why now:** the Invoice card duplicates data that only ever matters *per customer*, and the print invoice we built is currently a dead-end (print-only). Embedding makes invoices live where they belong and turns the pretty sheet into an interactive view.

---

## 2. Current-state facts (grounding)

Card registry & layout:
- `GRID_CARDS` — `config.js:354-361`; invoices is entry 5 (`config.js:359`).
- `COLUMNS` (3-column layout) — `config.js:384-388`; invoices is a member of the **right** column alongside `customers` (`config.js:387`). `COLUMN_OF` maps `invoices:'right'` (`config.js:391`).
- `columnEl` paints **one active member per column** (`app.js:7185`); tabs come from `col.members` (`colTabButtonsHtml`, `app.js:7212-7229`). **Removing `invoices` from that members list drops its tab and the column keeps showing `customers` — no hole in the grid.**
- `memberCardEl` router (`app.js:7241-7246`) special-cases `calendar`/`shop`; everything else (incl. invoices) is generic `cardEl` (`app.js:7257-7296`), data-driven via `DETAIL[card]` / `listView`.
- Active-member-per-column is in-memory `session.cols`, defaulted in `freshSession` (`app.js:2002`), snapshotted via `viewSnap` (`app.js:2375/2382`) — **not** localStorage. Card order is the static `GRID_CARDS`/`COLUMNS` constants.

Invoice detail & print:
- `DETAIL.invoices(i,cs)` — `app.js:6660-6731` (PO field, paid/refund chips R4, line-item link R7, continuation chip R2, Print pill).
- `printInvoice(invoiceId)` — `app.js:16007-16051` — builds a `.pr-doc` document into `#print-root`, toggles `body.printing`, calls `window.print()`. CSS `style.css:3779+`. **Bypasses `WINDOW_CATALOG` entirely** (not a popup).

Customer Details & funnels:
- `DETAIL.customers(c,cs)` — `app.js:6516-6597`; one scrollable `.detail` panel. Membership + Used Sales sit side-by-side in `.detail-cols` (`style.css:1067`): `membershipSectionHtml(c)` (`app.js:3481`, called `6561`) + inline Used Sales block (`app.js:6556-6559`).
- Funnel pills share `funnelPill()` (`app.js:4293-4300`) + `openFunnelDropdown()`. Only existing collapse pattern is `.js-group-toggle`/`toggleGroupCollapsed()` (`app.js:7035`) — collapses row *groups*, not sibling sections. **The toggle is net-new.**

Cross-links into invoices (must be redirected — 3 rendered sources):
- `app.js:6885` — `refPill('invoices', inv.invoiceId, …)` in the rental history/timeline.
- `app.js:6183` — inline `data-pill-card="invoices"` (rental→invoice pill, with unlink ✕; `inv-remove` handler same line).
- `app.js:6724` — inline `data-pill-card="invoices"` (invoice "Cont. of" continuation chip).
- Nav path today: grid click handler (`app.js:14201-14209`) → `pillTo(pc,prec)` (`app.js:2527-2539`) → `revealCol(card)` + `openStandard(card,recId)`. `pillTo('invoices',…)` **breaks once invoices isn't a column member.**
- `scrollToSect(card,sect)` (`app.js:2520-2526`) scrolls to a named section *class* within a card and `attnFlash`es it — reusable, but it targets a section, **not a per-record row**. No existing "scroll to invoice row N" primitive.

Full `'invoices'`-as-kind surface to audit (retiring touches all): `config.js:359,387,391,400`; `app.js:84,753/754,2578/2581,4213,4828,5307,5431,5506,6148/6661,6930,7029,7824,8093,9797,12364,12708,12953/12957/12962/12964/12971,12995,13407,17013,17037`, plus `INV_METHOD_LABEL` in `listView` (`app.js:7337-7340`). This breadth is why the change is "massive."

---

## 3. Design

### 3.1 Retire the Invoice card (config)

- Remove `'invoices'` from `COLUMNS[right].members` (`config.js:387`) and from `COLUMN_OF` (`config.js:391`). The right column keeps `customers` as sole member → grid reflows cleanly, no placeholder needed.
- **Keep** the `GRID_CARDS` entry, `ROW_META.invoices`, `DEFAULT_LAYOUT.invoices`, `IDX_MAP`, `PERSIST_ID`, sort/date/entity-label config, and `DETAIL.invoices` **intact** — they're still needed to render invoices *inside* Customer Details and for data integrity. We are removing the invoice card's **column membership / standalone entry point**, not its data model. (This keeps the diff surgical and lets `listFor`, roundup charts, search, etc. keep working.)
- Audit each site in the §2 surface list: confirm none assumes invoices is reachable as a standalone card tab. Anything that navigates the *user* to the invoices card (vs. reads its data) gets redirected per §3.4.

### 3.2 The embedded Invoices section

New section in `DETAIL.customers`, placed after the account/payment block (order finalized at build in `/jactec-ui`). Built by a new `customerInvoicesSection(c, cs)`:

- **Data:** `DATA.invoices` filtered to `c.id` (reuse the existing customer↔invoice index), newest first, grouped by open/scheduled/paid the way the mockup's status rail shows.
- **Summary strip** (manager glance): Open $ · invoice count · Paid-YTD $ · avg-days-to-pay. KPI-chip styling (`.kchip`).
- **Rows:** invoice id + month pill, one-line description, issued/due date, amount + status word, chevron. Status color rail on the left edge (red=due, yellow=partial, green=paid).
- **Scroll:** the section is a bounded scroll region inside the `.detail` panel (max-height + `overflow:auto`), so a customer with 40 invoices doesn't blow out the panel.

### 3.3 Inline expand → interactive invoice

Clicking a row expands it **accordion-style, one open at a time** (matches the app's single-open detail convention). Expanded state = a new `.inv-open` block containing:

- **Dark control bar** (yard chrome) hosting the interactive controls so the white sheet stays print-clean:
  - status pill (Paid / Partial hazard-stripe / Due),
  - **live paid/remaining progress bar** (computed from `invoiceTotals(i)` + payment ledger),
  - **aging flag** (days open vs. terms),
  - action pills: **Take Payment** (green; triggers the existing catalogued `payment` window), **Print** (calls existing `printInvoice(id)` unchanged), **Refund** (existing Stripe refund path).
- **The white `.pr-doc` sheet rendered inline** — reuse the exact `printInvoice` markup builder, refactored so the DOM-building half is a pure `invoiceDocHtml(i)` that both `printInvoice` (into `#print-root`) and the inline view consume. **No divergence between screen and printout.**
- **Line items link back** to their source Rental / Journey / WO via the existing `refPill`/`data-pill-card` mechanism (now that those targets — rentals, WOs — are still real cards).
- **Inline PO edit** on the sheet (reuse the existing PO field/handler from `DETAIL.invoices`).
- **Full action parity** with old `DETAIL.invoices` — nothing regresses.

**Refactor discipline:** rather than fork `DETAIL.invoices`, extract its body into `invoiceDetailBody(i, cs, {inline:true})` so the same builder serves both the (soon-removed-from-nav) card detail and the embedded expand. One source of truth for invoice rendering.

### 3.4 Redirect cross-links

New navigation primitive `openInvoice(invId, {expand:true})`:
1. resolve `invId → customerId` (existing index),
2. `pillTo('customers', customerId)` to reveal + open that customer,
3. after render, scroll the Invoices section into view and **expand the target invoice row** (extend `scrollToSect` with an optional record anchor, or add `expandInvoiceRow(invId)` that sets the section's open-row state before paint + `attnFlash`es it).

Rewire the 3 sources:
- `app.js:6885` `refPill('invoices',…)` → emit a pill that routes to `openInvoice` (either a dedicated `data-open-invoice` attr consumed in the grid click handler, or keep `refPill` but special-case `card==='invoices'` in `pillTo` to delegate to `openInvoice`). **Recommend** the `pillTo` special-case — smallest surface, keeps existing pill markup/`refPill` call sites unchanged.
- `app.js:6183` rental→invoice pill and `app.js:6724` continuation chip → same `pillTo('invoices',…)` special-case catches both automatically since they carry `data-pill-card="invoices"`.
- The `inv-remove` unlink ✕ (`app.js:6183`) is a data action, not navigation — unchanged.

This means **one interception point** (`pillTo`, `app.js:2527`) redirects all three, rather than editing each call site — lower risk.

### 3.5 Membership / Used Sales toggle

Fold the two `.detail-cols` halves into one **"Programs"** section with a segmented switch (`.seg`, reusing the R14 segmented-control language):
- Two tabs: **Membership** | **Used Sales**. Active tab renders its existing body (`membershipSectionHtml(c)` / the Used-Sales block) unchanged — we're **re-parenting** them under a toggle, not rewriting their internals.
- **Off-tab shows its count/status** (`Used Sales · 2`) so a lead/enrollment is never invisible.
- Default tab: **Membership** (the higher-frequency surface).
- Toggle state is view-local (mirror `session.cols` pattern — in-memory, snapshotted), **not** persisted to localStorage; resets to Membership on a fresh customer open.
- Frees a full column of width → room for the Invoices section.

---

## 4. R-Rulebook & WINDOW_CATALOG

- **New UI elements get `data-r` stamps** (run through `/jactec-ui` at build). Candidates: the Programs segmented toggle, the invoices summary strip, invoice rows, the expand control bar, the progress bar, the aging flag. Regenerate `rule-usage.js` (`node ci/gen-rule-usage.mjs`, `--check` in CI).
- **WINDOW_CATALOG:** the inline expanded invoice is a **section state, not a popup** — it opens in place, no shell/overlay — so it needs **no** `WINDOW_CATALOG` entry (consistent with `printInvoice` already bypassing the popup system). The **Take Payment** action it triggers is the *already-catalogued* `payment` window (`app.js:10868`) — unchanged, still valid. **No catalog additions or removals in PR 1**, so `ci/check-window-catalog.mjs` stays green.
- If the Sales card (PR 2) introduces any popup, that PR owns its catalog entry.

---

## 5. Rollout & risk

**Sequence (PR 1):**
1. Config: drop invoices from column membership (§3.1). Verify grid reflow + that no smoke test expects an invoices tab.
2. Refactor: extract `invoiceDocHtml(i)` (shared print/screen builder) and `invoiceDetailBody(i,cs,opts)` (shared detail builder). Prove `printInvoice` output is byte-identical after extraction.
3. Build `customerInvoicesSection` + accordion expand + control bar inside `DETAIL.customers`.
4. Redirect: `pillTo` special-case + `openInvoice` + row-expand-on-arrival.
5. Programs toggle (re-parent membership/used-sales).
6. `/jactec-ui` pass: stamp `data-r`, self-critique screenshot, verify tokens/focus/reduced-motion.
7. Gates: `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node ci/logic-test.mjs`, `node ci/smoke.mjs`, `node tools/gen-code-map.mjs --check` (regenerate if a chapter banner moves).

**Top risks:**
- **R1 — orphaned nav to a dead card.** Any missed site that does `pillTo('invoices',…)`/`revealCol('invoices')` will silently no-op after retirement. *Mitigation:* the `pillTo` special-case is a catch-all — even a missed call site gets redirected. Grep for `'invoices'` navigation one more time at build.
- **R2 — print/screen divergence.** If the inline view and print drift, the customer sees one thing and prints another. *Mitigation:* single `invoiceDocHtml` builder; a logic-test assertion that both render the same totals.
- **R3 — money-action parity.** Take Payment / Refund must keep every gate they have today (canMoney, price-lock HMAC). *Mitigation:* re-host the *existing* triggers, don't reimplement; this is a security-sensitive line — keep it on the main session, not delegated.
- **R4 — scroll/expand-on-arrival jank.** Landing on a customer then scrolling+expanding a specific invoice is a two-phase paint. *Mitigation:* set the open-row state *before* the customer detail paints, then `scrollIntoView` + `attnFlash`, mirroring `deferOrAnchor`'s existing deferral.
- **R5 — Sales-card coupling.** PR 2 must not be blocked by PR 1. *Mitigation:* §3.1 leaves the right column valid with `customers` alone; PR 2 adds `sales` as a new member additively.

**Testing:** area-level local serve (`localhost:9147`, log in with `$RW_PW`), exercise: open a customer with mixed invoice states → scroll section → expand one → Take Payment → Print → verify print matches → click a rental's invoice pill from the Rentals card and confirm it lands+expands inside Customer Details → flip the Programs toggle both ways → confirm off-tab count.

---

## 6. Out of scope (PR 2)

The **Sales card** — dashboard/work-manager modeled on `calendarCardEl` (bespoke body, no `ROW_META`/`DETAIL` drill-down). Added as a new `GRID_CARDS` entry + `COLUMNS` member, filling the slot vacated here. Its own spec, its own `/jactec-ui` pass, its own `WINDOW_CATALOG` entries if it opens popups.
