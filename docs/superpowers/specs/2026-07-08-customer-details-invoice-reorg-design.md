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
  3. **Fold the two funnels into one section** where **the centered segmented toggle is the header**, renamed **Rental | Equipment Sales** (each tab shows an RYG urgency dot — no count badge). Give **each funnel a running list of dated "Next Actions"** (RYG by date, "＋ Action" pill) that **replaces the schedule feature**; move the **top-right account button** onto the gate row (opens the existing agreements window, now home to the renewal / print-agreement / cancel pills); and make the **Action Log an expandable section beneath Next Actions, split per toggle** (Rental log + Equipment Sales log).
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

- **A single-row control header** (yard chrome) — kept deliberately minimal (Jac, 2026-07-08 redline):
  - left: invoice id + month pill;
  - right: **one status/action control** — the hazard-stripe **status pill doubles as the action menu**. Its fill communicates payment state (solid green = paid, yellow hazard-stripe = partial, red hazard-stripe = due); **while its menu is open the pill goes solid** (drops the stripe) as active-state feedback. Clicking it opens a small menu: **Pay · Print · Send · Refund**.
    - **Pay** → existing catalogued `payment` window (`app.js:10868`), unchanged.
    - **Print** → existing `printInvoice(id)`, unchanged.
    - **Send** → send the invoice to the customer (SMS/email) — reuses the comms path in `area/comms-notifications` (new wiring; see risk R6).
    - **Refund** → existing Stripe refund path.
  - collapse chevron.
  - **Dropped from the earlier draft:** the paid/remaining progress bar, the "days open" aging flag, and the standalone action-pill row. Rationale: **Balance Due already lives on the sheet** (`pr-due`), and consolidating the four actions behind the status pill keeps the header one clean line.
- **The white `.pr-doc` sheet rendered inline** — reuse the exact `printInvoice` markup builder, refactored so the DOM-building half is a pure `invoiceDocHtml(i)` that both `printInvoice` (into `#print-root`) and the inline view consume. **No divergence between screen and printout.**
- **Line items link back** to their source Rental / Journey / WO via the existing `refPill`/`data-pill-card` mechanism (now that those targets — rentals, WOs — are still real cards).
- **Inline PO edit** on the sheet (reuse the existing PO field/handler from `DETAIL.invoices`).
- **Full money-action parity** with old `DETAIL.invoices` — Pay/Refund/PO all preserved, just re-homed behind the menu; nothing regresses.

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

### 3.5 Rental / Equipment Sales toggle

Fold the two `.detail-cols` halves into one section with a segmented switch (`.seg`, reusing the R14 segmented-control language):
- **No section title, toggle CENTERED** (Jac, 2026-07-08): the "Programs" label is redundant — **the centered segmented switch IS the header**. Drop the `h4`; center the `.seg` with flanking dashed (tan) rules.
- Two tabs: **Rental** | **Equipment Sales** (Jac, 2026-07-08 — two mirrored pipelines). "Membership" is **renamed Rental** (the rental/membership relationship); "Used Sales" is **renamed Equipment Sales**. Active tab renders its existing body (`membershipSectionHtml(c)` under Rental / the used-sales block under Equipment Sales) — we're **re-parenting** them under a toggle, not rewriting their internals (except §3.6–§3.8).
- **Each tab shows an RYG status dot** (Jac, 2026-07-08 — *replaces* the count badge): a small red/yellow/green dot on each tab colored by that pipeline's **most-urgent open Next Action** (red = has a late one, yellow = due soon, green = clear). Conveys urgency, not just existence, so a lagging pipeline is visible without flipping.
- Default tab: **Rental** (the higher-frequency surface).
- Toggle state is view-local (mirror `session.cols` pattern — in-memory, snapshotted), **not** persisted to localStorage; resets to Rental on a fresh customer open.
- **Equipment Sales gains two buyer-criteria fields** (Jac, 2026-07-08): **Desired Age** and **Desired Hours** (alongside the existing interested-categories + est. budget), captured on the customer/used-sales record. These feed future equipment-sales matching; render as `fm-line` meta fields.
- **Interest is by Make OR Category** (Jac, 2026-07-08): the existing interested-categories list becomes a mixed list of **Make** and **Category** interests, and the add button reads **"＋ Make / Category"**. Each pill carries a small stamped type tag (Category = safety-orange, Make = leather-tan) so the two read distinctly. Extends `interestedCategoryIds` to hold typed interest entries (category-id or make), or a parallel makes list — settle at build; keep the icon/keyword matching for category pills working.
- Frees a full column of width → room for the Invoices section.

### 3.6 Next Actions — a per-funnel list that replaces the schedule feature (Jac, 2026-07-08)

Drop the static badge chips (the earlier "Transport waived / Auto-renew" idea). Instead, **each funnel keeps a running LIST of dated "Next Actions"** — the scheduled steps a rep wants to track for that relationship — rendered with the **red/yellow/green urgency system keyed off each action's date**, the same visual language as the invoice status and rental flags. This is effectively the schedule feature re-homed inline, per funnel.

- **Render:** a `.na-list` inside each funnel body; each entry is a **single-row** `.nextact` — `[dot] [date chip, FIRST] [action text, one line ellipsized] [✓ / ✕]` — with a left rail + dot colored by urgency: **green** = comfortably ahead, **yellow** = due soon, **red** = due today / overdue. The **date sits in front of the text** (not a stacked label + second line). No "NEXT ACTION" stamp label on each row. **Overdue wording:** the red chip reads **"Late: Nd"** (e.g. "Late: 2d"), not "Nd overdue" (Jac, 2026-07-08).
- **Add more:** a secondary **blue "＋ Action" pill** (`.na-addbtn`, add-blue language) sits **under the last row**. Clicking it adds another dated action → the list grows into a per-relationship to-do set. Empty list = just the "＋ Action" pill.
- **No separate "+Log" affordance (Jac, 2026-07-08):** manual after-the-fact logging is intentionally dropped — it's redundant with the flow "＋ Action → ✓ Done", which logs it in two clicks. The Action Board's old free-text Log input is gone; the Action Log fills from done/cancelled Next Actions (+ legacy entries).
- **Done / Cancel (Jac, 2026-07-08):** each action row carries a simple **✓ (Done, green) / ✕ (Cancel, red)** control. Either one **closes the action out of the open list and logs the outcome** to that toggle's Action Log — Done logs it completed, Cancel logs it cancelled (both preserved in history; neither silently disappears). Clicking the row body still edits it.
- **Urgency tiers:** reuse the existing date-proximity → severity machinery rather than inventing a helper — `dayDiff(TODAY, when)` (`app.js:4185`) feeding the same red/yellow thresholds the flag system uses (`config.js:225-229`, `getEntityFlags` `app.js:4240`). Thresholds finalized at build; start from: red ≤ 0 days, yellow ≤ 2 days, else green.
- **This replaces the "schedule feature."** Today's schedule is the right-hand half of the **Action Board** in `DETAIL.customers` (`app.js:6569-6579`): a "Schedule Actions" button → schedule popup (`openOverlay{kind:'schedule'}`, `app.js:10690-10701`) → writes `{when, text:'Scheduled: …'}` into the customer's `activityLog` (`app.js:13983`), and feeds the "Due Today" banner (`schedActionsDueToday`, `app.js:17344-17362`).
  - **Remove:** the "Schedule Actions" button + the scheduled column of the Action Board. **Keep:** the logged-actions column (the activity log of what happened) — only the *forward-looking* scheduling moves into the funnel Next-Action lists.
  - **Storage (recommended, flag for review):** keep persisting each action to `activityLog` — no new backend columns, and the Due-Today banner keeps working — but **tag scheduled entries by funnel** (a `scope:'membership'|'usedSales'` field, or a text-prefix convention consistent with the existing `Scheduled:` parse). Each funnel's list = **all its open scheduled entries**, sorted by date; completing one logs a normal activity entry. Adding/editing reuses the existing schedule popup, now scoped to the funnel it was opened from.
  - **Rewire the Due-Today banner** (`schedActionsDueToday`) to read the funnel-scoped Next Actions so it stays accurate after the Action Board's schedule column is gone.

> **Storage decision — RESOLVED (Jac, 2026-07-08):** reuse the funnel-tagged `activityLog` (no new schema, preserves Due-Today + history, naturally supports a list). No user-facing difference vs. dedicated fields; chosen for lower backend risk.

### 3.7 Membership lifecycle actions move INTO the existing agreements window (Jac, 2026-07-08)

**Correction from an earlier draft — do NOT create a new "Account · Agreement" section.** The **agreements window already exists**: it opens from the button in the **top-right corner of Customer Details** today (the user's access to agreements). The membership lifecycle pills currently in `membershipSectionHtml` (`app.js:3500-3512`) — **Take Renewal**, **Print Agreement**, **Cancel Membership** — move **into that existing agreements window, attached to the agreement**, because they act on the agreement.

- The Rental funnel body then shows only: the centered toggle header, the funnel status pill, the account button (§3.8), the meta lines, its Next-Action list, and its Action Log (§3.8) — **no lifecycle buttons inline**.
- Relocate the *existing* action handlers/pills into the agreements window; don't reimplement. **Take Renewal is a money action** — it keeps its `canMoney` gate and price-lock/HMAC path intact at the new location (security-sensitive; keep on the main session, per R3 risk).
- **No "Transfer" action** (Jac, 2026-07-08). Instead, a **"Merge" account action** is desirable — let users merge duplicate / related accounts — but it is a **careful, separate build-out**, not part of this PR. Merging re-parents invoices, rentals, `activityLog`, agreements, memberships, and card-on-file across two customer records; it needs its own spec, dedup/conflict rules, an undo/confirm path, and backend work. **Tracked as a follow-up (see §6); do not scope it into PR 1.**

### 3.8 Account-type button + per-toggle Action Log (Jac, 2026-07-08)

**Account button:** move the **existing top-right account button** out of the Customer Details title bar and onto the **funnel-pill row**, to the **right of the gate pill**. Its label is the **account type** (e.g. "Contractor"); clicking it **opens the agreements window** exactly as the top-right button does today — same handler, new location. **Shown on BOTH tabs** (Jac, 2026-07-08 — it's the user's account-wide access to agreements, so it stays available regardless of which pipeline is active).

**Action Log → expandable, under Next Actions, one PER toggle (Jac, 2026-07-08):** today's action history is the logged-actions column of the Action Board — `activityLog` entries **not** prefixed `Scheduled:`, rendered at `app.js:6577` via `hit(a)` (the activity chart `customerActivityChart` / `activeBar` is a separate widget at `app.js:5727`/`6554`). Renamed **"Action Log."** Move the logged list into each funnel body, **beneath its Next-Action list, as a collapsible section** (`.acthist`): a header row toggles it open; open state **scrolls internally** (bounded `max-height` + `overflow:auto`) and, being in normal flow, **pushes the sections below it down**. Default collapsed. Reuses the existing collapse convention (`.js-group-toggle`/`toggleGroupCollapsed`, `app.js:7035`) or a local open-state flag.

- **Separate log per toggle:** the **Rental** tab shows rental-scoped logged entries; the **Equipment Sales** tab shows sales-scoped logged entries — each its own Action Log. This means **logged `activityLog` entries carry the same funnel scope** as the scheduled ones (§3.6): the funnel tag drives both the Next-Action list *and* the Action Log filter for that tab. Legacy untagged logged entries surface under a default bucket (see R7) and are never dropped.
- **✓/✕ prefix, not prose (Jac, 2026-07-08):** entries that came from a completed/cancelled Next Action render with a **green ✓ / red ✕ prefix** on the log row instead of spelling out "Completed"/"Cancelled". Manually-logged actions render without a prefix. Keeps rows terse and scannable.
- **The Action Log is NOT the card History section (Jac, 2026-07-08 — do not conflate).** The Action Log contains **only** funnel-scoped *action* entries: manually-logged actions + done/cancelled Next Actions (i.e. the `activityLog` action stream). It is **distinct from the date-derived History section** at the bottom of the card (`historySection`/`historyFor`, the merge point at `app.js:6862`), which lists records/events — rentals, payments, deliveries, invoice cross-links. **The two data sources stay separate and never share entries:** payments/deliveries/rentals belong to History, not the Action Log; logged calls/notes/next-action outcomes belong to the Action Log, not History. Build the Action Log strictly off the funnel-scoped `activityLog` action entries — do not pull from `historyFor`.

---

## 4. R-Rulebook & WINDOW_CATALOG

- **New UI elements get `data-r` stamps** (run through `/jactec-ui` at build). Candidates: the centered Rental/Equipment-Sales toggle (now the header), the account button on the gate row, the per-funnel Next-Action rows (incl. the ✓/✕ done/cancel control) + "＋ Action" pill, the per-toggle collapsible Action Log, the relocated lifecycle pills in the agreements window, the invoices summary strip, invoice rows, the expand control header, the status/action menu (incl. its solid open-state). Regenerate `rule-usage.js` (`node ci/gen-rule-usage.mjs`, `--check` in CI).
- **WINDOW_CATALOG:** the inline expanded invoice and the status/action menu are **section/menu state, not popups** — they open in place, no shell/overlay — so they need **no** `WINDOW_CATALOG` entry (consistent with `printInvoice` already bypassing the popup system). The **Pay** action triggers the *already-catalogued* `payment` window (`app.js:10868`) — unchanged. **If the Send action introduces a send-confirm popup**, that popup gets a `WINDOW_CATALOG` entry (and `ci/check-window-catalog.mjs` will enforce it); if Send fires inline without a shell, no entry needed. The schedule popup (`openOverlay{kind:'schedule'}`) is **retained** (now funnel-scoped for Next Action), so its catalog entry stays. Net: no *removals*; a possible single *addition* for Send-confirm.
- If the Sales card (PR 2) introduces any popup, that PR owns its catalog entry.

---

## 5. Rollout & risk

**Sequence (PR 1):**
1. Config: drop invoices from column membership (§3.1). Verify grid reflow + that no smoke test expects an invoices tab.
2. Refactor: extract `invoiceDocHtml(i)` (shared print/screen builder) and `invoiceDetailBody(i,cs,opts)` (shared detail builder). Prove `printInvoice` output is byte-identical after extraction.
3. Build `customerInvoicesSection` + accordion expand + control bar inside `DETAIL.customers`.
4. Redirect: `pillTo` special-case + `openInvoice` + row-expand-on-arrival.
5. Programs toggle (re-parent membership/used-sales).
6. Next Actions (§3.6): add the per-funnel `.na-list` (single-row, date-first entries, RYG tiers) + "＋ Action" pill + done/complete; remove the Action Board's schedule column + "Schedule Actions" button; funnel-scope scheduled `activityLog` entries; rewire `schedActionsDueToday`. §3.7: relocate the three lifecycle pills INTO the existing agreements window (preserve `canMoney`/HMAC on Take Renewal); no Transfer. §3.8: move the top-right account button onto the gate row (both tabs); move the logged Action Log (`app.js:6577`) into a collapsible `.acthist` under Next Actions, **scoped per toggle** (funnel-tag the logged entries too).
7. `/jactec-ui` pass: stamp `data-r`, self-critique screenshot, verify tokens/focus/reduced-motion.
8. Gates: `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node ci/logic-test.mjs`, `node ci/smoke.mjs`, `node tools/gen-code-map.mjs --check` (regenerate if a chapter banner moves).

**Top risks:**
- **R1 — orphaned nav to a dead card.** Any missed site that does `pillTo('invoices',…)`/`revealCol('invoices')` will silently no-op after retirement. *Mitigation:* the `pillTo` special-case is a catch-all — even a missed call site gets redirected. Grep for `'invoices'` navigation one more time at build.
- **R2 — print/screen divergence.** If the inline view and print drift, the customer sees one thing and prints another. *Mitigation:* single `invoiceDocHtml` builder; a logic-test assertion that both render the same totals.
- **R3 — money-action parity.** Take Payment / Refund must keep every gate they have today (canMoney, price-lock HMAC). *Mitigation:* re-host the *existing* triggers, don't reimplement; this is a security-sensitive line — keep it on the main session, not delegated.
- **R4 — scroll/expand-on-arrival jank.** Landing on a customer then scrolling+expanding a specific invoice is a two-phase paint. *Mitigation:* set the open-row state *before* the customer detail paints, then `scrollIntoView` + `attnFlash`, mirroring `deferOrAnchor`'s existing deferral.
- **R5 — Sales-card coupling.** PR 2 must not be blocked by PR 1. *Mitigation:* §3.1 leaves the right column valid with `customers` alone; PR 2 adds `sales` as a new member additively.
- **R6 — Send action crosses into comms.** "Send invoice" is new and touches `area/comms-notifications` (SMS/email templates, consent, delivery). *Mitigation:* if the comms send path isn't ready, ship the menu with **Send disabled/"coming soon"** rather than a half-wired send; the customer-facing send is not a blocker for the embed/toggle work. Keep any consent/opt-in gate intact — do not send without it.
- **R7 — schedule → Next Action migration.** Existing customers already have `Scheduled:` entries in `activityLog` with no funnel scope. *Mitigation:* untagged legacy scheduled entries surface under a sensible default (e.g. Membership, or a general bucket) and are never dropped; the Due-Today banner rewrite must still count them. Verify with a customer that has pre-existing scheduled entries.

**Testing:** area-level local serve (`localhost:9147`, log in with `$RW_PW`), exercise: open a customer with mixed invoice states → scroll section → expand one → open the status-pill menu → Pay → Print → verify print matches the inline sheet → click a rental's invoice pill from the Rentals card and confirm it lands + expands inside Customer Details → flip the Rental/Equipment-Sales toggle both ways → confirm each tab's RYG dot reflects its most-urgent action (no count badge) → confirm the Equipment Sales tab shows Desired Age + Desired Hours fields → add several Next Actions on each funnel via "＋ Action", confirm each row's RYG tier matches its date (past = red "Late: Nd", ≤2d = yellow, else green) and the date sits in front of the text → hit ✓ Done on one and ✕ Cancel on another; confirm both leave the open list and each logs its outcome to that toggle's Action Log with a ✓/✕ prefix (not prose) → confirm the Due-Today banner still fires → confirm the toggle reads Rental | Equipment Sales, centered → click the account button on both tabs and confirm it opens the same agreements window the old top-right button did, and Take Renewal / Print Agreement / Cancel now live there (with Take Renewal's money gate intact) → expand the Action Log on each toggle and confirm it scrolls internally, pushes content below it down, and shows only that tab's scoped *action* entries (no rentals/payments/deliveries — those stay in the bottom History section, which must still render its own separate entries) → open a customer with a pre-existing legacy scheduled/logged entry (R7).

---

## 6. Out of scope (follow-ups)

- **PR 2 — the Sales card.** Dashboard/work-manager modeled on `calendarCardEl` (bespoke body, no `ROW_META`/`DETAIL` drill-down). Added as a new `GRID_CARDS` entry + `COLUMNS` member, filling the slot vacated here. Its own spec, its own `/jactec-ui` pass, its own `WINDOW_CATALOG` entries if it opens popups.
- **Make-interest → Units filter (future; Jac, 2026-07-08).** A Make interest pill currently doesn't navigate (there's no Make record). Some leads want a specific unit/make; a later build could make the Make pill open a Units view filtered to that manufacturer (and possibly track interest in exact units). Deferred a few weeks — leave the pill non-navigating for now.
- **Merge accounts (careful build-out; Jac, 2026-07-08).** A "Merge" action in the agreements window to combine duplicate / related customer accounts. High-risk data operation — re-parents invoices, rentals, `activityLog` (incl. funnel-scoped Next Actions + logs), agreements, memberships, and card-on-file across two records; needs a dedicated spec, dedup + field-conflict resolution rules, a preview/confirm + undo path, and backend work. **Own PR, own spec — explicitly NOT in PR 1.**
