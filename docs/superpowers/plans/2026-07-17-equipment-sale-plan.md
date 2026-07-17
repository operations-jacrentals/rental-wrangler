# Equipment Sale — Implementation Plan

- **Spec:** [`docs/superpowers/specs/2026-07-17-equipment-sale-design.md`](../specs/2026-07-17-equipment-sale-design.md) (approved 2026-07-17)
- **Prereq:** the customer-funnel redesign (PR #693) — this build extends Track B, `FUNNELS`,
  `migrateCustomers`, and the auto-stage guard shipped there, and completes the TODO its own
  comment left at config.js:334-336 ("wire an auto trigger later and move Paid into auto").
  Build stacked on / after #693.
- **Anchor verification:** all file:line anchors below were verified by a 5-scout sweep
  (2026-07-17); line numbers drift as app.js grows — re-grep symbols before editing.

## Guardrails (every phase)

- New/reshaped UI → `/jactec-ui`; stamp `data-r`; the new popup kind gets a `WINDOW_CATALOG`
  entry (CI: `ci/check-window-catalog.mjs` diffs `buildPopupEl` branches vs catalog rows
  **both directions** — retire kinds in lockstep).
- `/role` audit before ship. Money surface: **cost/MSRP basis and the suggested bottom must
  never render customer-facing** — the invoice shows the price only. `categoryCostBasis`
  (app.js:2027) is the radioactive internal number.
- Gates before each push: smoke · logic · `gen-rule-usage --check` · `check-window-catalog` ·
  `gen-code-map --check`. Port swap 8000→9147 + Playwright `executablePath` injection on
  smoke/logic only (lease suites are pure-Node — excluded), revert `ci/` after.
- Defence-in-depth gating convention: hide the affordance when the tier check fails AND
  re-check in the click handler AND re-check inside the mutation (matches `js-open-sell` →
  overlay → `sellUnit` today). New manager gates use the ad-hoc convention
  `!currentRole || roleTier(currentRole) < tierRank('manager')` (no-login/dev bypass), NOT
  `canApproveRequests`'s stricter form.

## Phase 1 — Vocabulary: `Paid` → `Purchased`

1. **config.js:161** — ADD `'Purchased': { label: 'Purchased', color: 'green' }` to
   `STATUS.funnelStage`. **Keep `'Paid'` registered** (legacy data mid-migration + admin
   status-overrides in Settings are keyed by the raw value string — `SETTINGS_STATUS_SETS`
   app.js:3283).
2. **config.js:337** — `FUNNELS.equipment.stages[4]` → `'Purchased'`; `auto` → `['Purchased']`.
   This single edit ripples correctly through `isAutoStage`, `pickFunnelStage`'s manual-pick
   guard (app.js:16446), `funnelMenuStageRow`'s locked rendering, `funnelTrackEquip`, and
   `toggleFunnelMembership`'s terminal-wipe guard (app.js:16434 — derives the terminal from
   `stages[len-1]`) with **zero code changes** in those functions. Update the stale comment
   block (config.js:334-336) — this feature IS the flagged trigger.
3. **app.js:272** — migration: add the bare mirror line next to the membership one, same shape
   (NOT inside the `funnelNAApplied`-gated block):
   `if (c.usedSalesStage === 'Paid') { c.usedSalesStage = 'Purchased'; migrationDirty = true; }`
4. **app.js:6908 `FUNNEL_RANK`** — hand-add `'Purchased': 6` (keep `'Paid': 6` defensively) —
   this map is NOT registry-derived and silently ranks unknown keys 0.
5. **Wrangler/CSV bypass closure** — `wrCleanFields` (app.js:15156) normalizes via
   `wrFunnel(v) || v`: the `|| v` fallback writes RAW unmatched values straight to
   `membershipStage`/`usedSalesStage`, bypassing the auto-stage guard. Fix: after
   normalization, validate the value against the funnel's **manual** stages (+ `'N/A'`,
   + legacy values that migration remaps); DROP the field otherwise — auto terminals
   (`Signed`, `Purchased`) can never arrive via chat/CSV. Add `'Purchased'`→ no,
   deliberately DON'T add it to `WR_FUNNEL`; update the wrFunnel test (logic-test:867).
6. Cosmetic: funnelRung doc comment (app.js:4126) "…Signed/Paid" → "…Signed/Purchased".
7. **Dead code, do NOT touch for function**: `GATE_TL.funnelStage` + the funnelStage-keyed
   `GATE_ICON` slice (app.js:16270/16275) are unreachable post-redesign (gateTimeline is only
   ever called with rentalStatus/woPhase). Leave, or delete the slice in a separate tidy
   commit — never "fix" them for Purchased.
8. logic-test updates (deliberate — CI will NOT catch these as stale):
   - Flip 1571-1572: `pickFunnelStage('C-SIGN','equipment','Purchased')` must be REJECTED
     (mirror the Signed-rejection at 1565-1567); adjust 1577's fixture value.
   - `isAutoStage` doesn't validate stage ∈ stages, so a stale `'Paid'` pick would still
     silently write — the rewritten test must assert the `'Purchased'` guard specifically.
   - New migration test: raw customer with `usedSalesStage:'Paid'` through `migrateCustomers`
     (export `migrateCustomers` on `__rw` — fixtures created post-boot never migrate).

## Phase 2 — Sale-invoice data layer

1. **Marker:** `inv.sale = { unitId }` — mirror of `inv.membership`
   (`buildMembershipInvoice` app.js:4740 is the mint precedent: client-side mint, `mock: true`,
   push + `IDX.invoice.set` + `reindex`). Mint via `nextInvoiceId()` (app.js:2485 — never
   `.length`); `dueDate` via `dueForCustomer` initially, then plan-synced.
2. **Line kinds:** machine price = `{ kind: 'sale', unitId, lid: lineLid(), label, amount }` —
   every line MUST carry a `lid` (allocations/refunds key off `li.lid`, app.js:7891).
   Transport = `kind: 'saleTransport'` (NOT `'transport'` — rental transport machinery
   (`transportLineItems`/`syncRentalLines`) keys `kind==='transport'` lines by `ref=rentalId`;
   a distinct kind keeps the sale line out of every rental sync path by construction).
   Tax: existing exempt-aware path needs nothing — `invoiceTotals` (app.js:1879) computes
   `taxBase` from all non-`li.taxExempt` lines at `TAX_RATE` (0.1075) with
   `inv.taxExempt || cust.salesTaxExempt` honored.
3. **Plan model:** `inv.plan = { down, cadence: 'weekly'|'monthly', n, start, installments: [{ due, amount }] }`.
   - `buildSalePlan(total, down, cadence, n, startISO)` — equal cents-exact splits of
     `total − down`, penny remainder onto the LAST installment; weekly via `addDays(+7)`,
     monthly via `addMonthsISO`. Deposit+balance = `n: 1`; full payment = no `plan`.
   - `planInstallmentsPaid(inv)` — count installments whose cumulative scheduled amount
     (down + installments[0..i]) ≤ `inv.amountPaid` (+ 0.005 epsilon).
   - `syncSaleDueDate(inv)` — `inv.dueDate` = the next unpaid installment's `due` (down
     payment = due at mint ⇒ initial dueDate = mint date), or the last installment's `due`
     when all are covered. With that sync, the existing status ladder (Not Due / Late tiers /
     Collections off `dueDate`, app.js:1890) works on financed sales with **zero** new status
     logic.
4. **Merge closure:** block `invoiceMergeable` when either side carries `inv.sale` (silent-gap
   found in scouting — merged sale invoices would corrupt `sale`/`plan` semantics). Test it.

## Phase 3 — Lifecycle: commit · Purchased · void

1. **`commitEquipmentSale({ customerId, unitId, price, transport, shape, planCfg, po })`**
   (new, lives beside `sellUnit` app.js:19539 — same chapter, no new banner):
   - re-check `canMoney()`; validate unit is `'For Sale'`, price > 0;
   - mint the sale invoice (Phase 2), `syncSaleDueDate`;
   - unit: `fleetStatus='Sold'`, `salePrice` = machine-line amount **set in the same mutation**
     (categoryStats' residual at app.js:2287 needs `Sold` AND truthy `salePrice` together —
     a gap silently reverts ROI to assumed bottomDollar), `saleDate` = today,
     `soldToCustomerId` = buyer (new field; `soldNote` has zero readers — leave legacy);
   - `logAction` on unit AND customer; `reindex` both.
   - PO gate: `invoicePoBlocked` (app.js:21096) blocks ALL payment on a `requiresPO` customer
     with no `inv.po` — the wizard collects a PO up front for those customers.
2. **`markEquipmentPurchased(c)`** — 1:1 mirror of `markMembershipSigned` (app.js:588):
   idempotency guard, `usedSalesStage='Purchased'`, `ensureFunnels(c).equipment = true`,
   `logAction`.
3. **First-money hook — in `applyPayment` (app.js:21186), the single money choke point** (all
   4 payment paths — Stripe, ACH settle, refund, manual cash/check — land here): after
   `inv.amountPaid` updates, `if (inv.sale) { syncSaleDueDate(inv); if (!isRefund && amountPaid > 0) markEquipmentPurchased(customer); }`.
   Known bypass: `markInvoicePaidLocal` (app.js:4738) — membership-demo-only, sale invoices
   never route there; pin that with a test, not code.
4. **Void / un-sell — refund-first, by design:** `invoiceVoidable` (app.js:22532) hard-requires
   `amountPaid === 0`, so a paid sale can only be voided AFTER a full refund zeroes it. Keep
   that gate (it's the correct money-safety order); add the `inv.sale` branch to `voidInvoice`
   (app.js:22539): unit back to `'For Sale'`, clear `salePrice`/`saleDate`/`soldToCustomerId`;
   funnel: if `usedSalesStage === 'Purchased'` and no OTHER non-voided sale invoice with
   money-in exists for the customer → revert to `'Payment Discussed'` (the last manual stage).
   The Equipment track surfaces "refund first, then void" in the sale actions so the two-step
   isn't a dead end.
5. **`markChargeFailed` decision (flag to Jac):** membership invoices are carved out
   (app.js:513); sale invoices are NOT — a declined sale charge sets customer-level
   `chargeFailedAt`. KEEP as-is (a bounced machine payment IS a real customer signal) — noted
   in the PR body for Jac's veto.
6. **Generic fleet-dropdown loophole (flag to Jac):** `openFleetDropdown`/`setUnitFleet`
   (app.js:16355) lets any role stamp `fleetStatus='Sold'` ungated, bypassing the whole flow
   and writing no sale fields. v1: remove `'Sold'` as a pickable TARGET in that dropdown
   (reaching Sold now goes through the sale flow); leaving Sold stays possible (legacy
   corrections). Noted in the PR body.

## Phase 4 — The sale wizard (UI)

1. **ONE new popup kind `'equipmentSale'`** with an `o.step` state machine —
   `gpsConnect` (app.js:12737) is the house precedent (steps branch by earlier choices:
   full = no plan step; deposit/financed add plan config). Steps: pick-unit → price →
   transport+PO → payment-shape → review/commit.
   - `buildPopupEl` branch + `WINDOW_CATALOG` row (same literal kind string; graceful
     `sample()`); **retire `'sellUnit'` kind — branch (app.js:14063) AND catalog row
     (app.js:14254) in the same commit** (check-window-catalog fails on either orphan).
2. **Unit picker step:** searchable pick-list (the `gpsConnect` 'identify' pattern,
   app.js:12765), filtered `fleetStatus === 'For Sale'` — NOT the default units list (Sold/For
   Sale units are hidden from it, app.js:6533). Empty state links to flipping a unit For Sale.
3. **Price step:** prefill from `salePriceSuggest(IDX.category.get(unit.categoryId))`
   (category-keyed, app.js:2032; `$25`-step rounding). Editable. **Below suggested bottom →
   `tierAuth` manager approval** — reuse the shell (kind `'tierAuth'`, app.js:13844) via the
   generic `azAction`+`onOk` seam (`accountBlockOverride` precedent app.js:19262; any
   non-`'netTerms'` azAction needs ZERO `tierAuthApply` changes). azAction:
   `'saleBottomOverride'`. **Show the suggestion, never the basis/bottom internals, in any
   copy a customer could see** (printed invoice shows price only).
4. **Transport step:** optional `saleTransport` line; amount editable but **manager-locked** —
   `.acct-lock` icon + R23 tip inline (app.js:4249 pattern; an always-locked field, unlike the
   threshold-triggered price gate), edit routes through the same `tierAuth` shell
   (azAction `'saleTransportUnlock'`). PO input surfaced here for `requiresPO` customers.
5. **Payment-shape step:** `segCtl` (R14) Full · Deposit · Financed; financed reveals down
   (money input), cadence `segCtl` weekly|monthly, N, start `dateField` (R22 — own overlay
   field name); live schedule preview.
6. **Schedule widget = new R36** (bespoke — installment rows): stamp `data-r="R36"`, add
   RULE_META (app.js:6303) + RB_TABS entry by hand (neither is CI-enforced for coverage —
   manual discipline), CLASS_RULE if it gets a container class.
7. Commit = `actionPill('commit', 'Finalize Sale', …)` (R17 blue — finalizing commits the
   deal; taking money later is the green path); Cancel = ghost (R18). jactec-ui pass over the
   whole window (steel panel, hazard cap, stamped labels, zero R0 violations).

## Phase 5 — Equipment track integration

1. Track B (`funnelSectionHtml` app.js:4169-4180): follow the house precedent AGAINST heavy
   money actions inline (`membershipActionsHtml` lives in the agreement popup, not the track
   card): inline = **compact summary only** — unit refPill, price, paid/owed (from
   `invoiceTotals`), next-due + overdue tone, "View sale" → the invoice; `+Sale` `addBtn`
   (R5b, `js-open-sale`) in `bInner` (matching the Interested-in row's addBtn idiom), rendered
   only when `canMoney()`. Multiple sales per customer allowed — list open sale invoices.
2. Pipeline board: no code change needed for the rename (registry-driven via `funnelPill`);
   verify only.
3. **data.js seed:** add ONE unit with `fleetStatus: 'For Sale'` (no seed has it today — the
   picker and any staging click-through would be empty otherwise).

## Phase 6 — Absorb the unit-side flow

- `js-open-sell` (app.js:18544) → `openOverlay({ kind: 'equipmentSale', unitId, … })` with the
  unit pre-picked and a customer-pick step prepended (same wizard, entered at a different
  step). The unit-card Sell pill's visibility rule (canMoney + not Sold) is unchanged.
- `sellUnit()` becomes the internal fleet-mutation helper called by `commitEquipmentSale`
  (extended for `soldToCustomerId`) or is folded in — the existing D3 logic-test
  (logic-test:1687-1712, salePrice→categoryStats residual) must keep passing: rewrite it
  against the new commit path so ROI behavior is pinned to the fields, not the entry path.

## Phase 7 — Tests · audit · gates · ship

- **New logic-test blocks** (fixture patterns: bespoke invoice+IDX registration per
  logic-test:84; seeded-invoice snapshot/restore per :55; category+units teardown per :1687;
  `T.setRole('office')`/`T.setRole('')` for gate paths):
  1. `buildSalePlan` math — equal splits, penny remainder on last, weekly vs monthly dates,
     `n:1` deposit shape, zero-down financed.
  2. `planInstallmentsPaid` + `syncSaleDueDate` across partial payments via
     `T.applyPayment` (fixture invoice IDX-registered); dueDate advances installment by
     installment; status ladder reads Late correctly when an installment lapses.
  3. First money → `markEquipmentPurchased`: funnel joins + `Purchased` set, idempotent on
     second payment; refund does NOT trigger it; `markInvoicePaidLocal` bypass never fires
     for `inv.sale`.
  4. Manual `'Purchased'` pick rejected (`pickFunnelStage`), terminal-wipe guard holds,
     Wrangler/CSV path drops auto terminals (`wrCleanFields`).
  5. `commitEquipmentSale` mutations (fleetStatus/salePrice/saleDate/soldToCustomerId set
     together, invoice minted with lids, PO required honored) + categoryStats residual via
     the NEW path.
  6. Refund-to-zero → `voidInvoice` un-sells (fields cleared, back to For Sale) + funnel
     reverts; a second money-in sale invoice blocks the revert.
  7. `invoiceMergeable` false for sale invoices.
  8. Migration: raw `usedSalesStage:'Paid'` → `'Purchased'` (via exported
     `migrateCustomers`).
- **`__rw` additions** (app.js:25652 literal — the ONLY test seam): `buildSalePlan`,
  `planInstallmentsPaid`, `syncSaleDueDate`, `commitEquipmentSale`, `markEquipmentPurchased`,
  `migrateCustomers`.
- `/role` audit (money lenses: basis/bottom never customer-facing; tierAuth gates
  server-side-shaped) → fixes → full gate suite → `/deploy` staging review → `/merge` →
  `/promote` (Jac's calls).

## Flagged decisions (surface in the PR body for Jac)

1. **Naming collision:** `unitFleetStatus` already has an unrelated `'Purchased'` (navy,
   unit-intake state, config.js:87). Different STATUS namespace — no code collision — but two
   identically-labeled pills with different meanings now exist. OK, or rename the funnel
   terminal's label?
2. `markChargeFailed` treats a declined sale charge as a customer-level block (unlike
   membership). Kept — veto if unwanted.
3. Generic fleet dropdown loses `'Sold'` as a pickable target (sale flow owns entering Sold).
4. Void revert lands on `'Payment Discussed'` (the last manual stage) — not `'N/A'`.
