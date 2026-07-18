# Equipment Sale — Implementation Plan

- **Spec:** [`docs/superpowers/specs/2026-07-17-equipment-sale-design.md`](../specs/2026-07-17-equipment-sale-design.md)
  (approved 2026-07-17; see its **Build amendments** section — two mechanics the spec asserted
  were refuted against the code during plan review and corrected without changing Jac's
  decisions).
- **Prereq:** the customer-funnel redesign (PR #693) — this build extends Track B, `FUNNELS`,
  `migrateCustomers`, and the auto-stage guard shipped there, and completes the TODO its own
  comment left at config.js:334-336. Build stacked on / after #693.
- **Verification trail:** anchors verified by a 5-scout sweep, then the assembled plan was
  adversarially critiqued by a 3-lens panel (spec-fidelity · codebase-correctness ·
  risk/completeness, 2026-07-17) — 2 blockers + 6 majors folded in below. Line numbers drift;
  re-grep symbols before editing.

## Guardrails (every phase)

- New/reshaped UI → `/jactec-ui`; stamp `data-r`; the new popup kind gets a `WINDOW_CATALOG`
  entry (CI diffs `buildPopupEl` branches vs catalog rows both directions — retire kinds in
  lockstep).
- `/role` audit before ship. Money surface: **cost/MSRP basis and the suggested bottom must
  never render customer-facing**; `categoryCostBasis` (app.js:2027) is the radioactive number.
  **Sub-money roles must not see sale dollars anywhere** (see Phase 5).
- Gates before each push: smoke · logic · `gen-rule-usage --check` · `check-window-catalog` ·
  `gen-code-map --check` (port swap + `executablePath` on smoke/logic only; lease suites
  excluded; revert `ci/` after).
- Defence-in-depth gating: hide the affordance + re-check in the handler + re-check in the
  mutation. Manager gates use the ad-hoc `!currentRole || roleTier(currentRole) <
  tierRank('manager')` convention.

## Phase 0 — Backend verification (NEW — critique blocker-adjacent)

The GAS backend is server-authoritative for invoice money: `amountPaid`/`paymentMethod`/
`paidAt`/payments are **sync-PROTECTED** (client writes stripped, app.js:21232-21234), and
`stripeChargeInvoice`/manual payments cap at a **server-computed balance** (app.js:21210) that
has never seen `sale`/`saleTransport` kinds or `inv.plan`. Before any Phase 2+ code:

1. Pull the current backend (`/clasp` service-account path) and read: the invoice
   field-protection list, and the server balance/total computation.
2. Confirm: `inv.sale`, `inv.plan`, `unit.soldToCustomerId` are NOT stripped; the new line
   kinds flow through the server's total/cap math; **`inv.dueDate` is client-writable** —
   `syncSaleDueDate` writes it, and if it's protected every sync would silently revert the
   installment due-date sync. If any of these fail → a backend handler change rides the
   `/clasp` queue BEFORE the client work that depends on it.
3. Staging round-trip check once Phase 3 exists: commit a sale, hard-reload, assert the fields
   survived.

## Phase 1 — Vocabulary: `Paid` → `Purchased`

1. **config.js:161** — ADD `'Purchased': { label: 'Purchased', color: 'green' }` to
   `STATUS.funnelStage`; **keep `'Paid'` registered** (legacy data + admin status-overrides
   key by raw value — `SETTINGS_STATUS_SETS` app.js:3283).
2. **config.js:337** — `FUNNELS.equipment.stages[4]` → `'Purchased'`; `auto` → `['Purchased']`.
   Ripples through `isAutoStage`/`pickFunnelStage` (app.js:16446), `funnelMenuStageRow`,
   `funnelTrackEquip`, and the terminal-wipe guard (app.js:16434) with zero code changes.
   Update the stale TODO comment (config.js:334-336).
3. **app.js:272** — migration mirror line, bare shape beside the membership one:
   `if (c.usedSalesStage === 'Paid') { c.usedSalesStage = 'Purchased'; migrationDirty = true; }`
4. **app.js:6908 `FUNNEL_RANK`** — hand-add `'Purchased': 6` (keep `'Paid': 6`).
5. **Wrangler/CSV hardening** (`wrCleanFields` app.js:15156):
   - funnel stages: the `wrFunnel(v) || v` raw fallback bypasses the auto-stage guard —
     validate the final value against the funnel's **manual** stages (+ `'N/A'` + legacy);
     drop the field otherwise. `Signed`/`Purchased` can never arrive via chat/CSV. Don't add
     `'Purchased'` to `WR_FUNNEL`. Update the wrFunnel test (logic-test:867).
   - **`fleetStatus` (critique major):** `WR_EDITABLE.units.fields` includes `fleetStatus`
     with NO value validation and no money-preview gate — Wrangler chat/CSV can stamp
     `'Sold'` raw (no sale fields → categoryStats silently falls back to assumed
     bottomDollar). Validate against allowed TARGET values with `'Sold'` excluded — reaching
     Sold goes through `commitEquipmentSale` only. Test beside the funnel-stage-drop test.
6. Cosmetic: funnelRung doc comment (app.js:4126) "…Signed/Paid" → "…Signed/Purchased".
7. **Dead code — don't touch for function:** `GATE_TL.funnelStage` + funnelStage-keyed
   `GATE_ICON` (app.js:16270/16275) are unreachable post-redesign.
8. logic-test updates (CI won't catch these as stale): flip 1571-1572 to assert the
   `'Purchased'` auto-guard REJECTS a manual pick (mirror 1565-1567; note `isAutoStage`
   doesn't validate membership in `.stages`, so the old `'Paid'` pick would still silently
   write — test the new value specifically); adjust 1577; new migration test via exported
   `migrateCustomers` (post-boot fixtures never migrate).

## Phase 2 — Sale-invoice data layer

1. **Marker:** `inv.sale = { unitId }` — mirror `inv.membership` (`buildMembershipInvoice`
   app.js:4740: client-side mint, push + `IDX.invoice.set` + `reindex`). Mint via
   `nextInvoiceId()` (app.js:2485); `dueDate` per plan sync below.
2. **Line kinds:** machine = `{ kind: 'sale', unitId, lid: lineLid(), label, amount }` (every
   line needs a `lid` — allocations key off it, app.js:7891). Transport =
   `kind: 'saleTransport'` — NOT `'transport'`: rental machinery keys `transport` lines by
   `ref=rentalId` (verified app.js:1112/1457/7971/18988/19359), a distinct kind keeps sale
   lines out of every rental sync path. **Recorded as a spec amendment** (spec's literal block
   said `'transport'`).
   Tax needs nothing: `invoiceTotals` (app.js:1879) computes exempt-aware `taxBase` over all
   non-`li.taxExempt` lines at `TAX_RATE`.
3. **Plan model:** `inv.plan = { down, cadence: 'weekly'|'monthly', n, start, installments: [{ due, amount }] }`.
   - `buildSalePlan(total, down, cadence, n, startISO)` — equal cents-exact splits of
     `total − down`, penny remainder on the LAST installment; weekly via `addDays(+7)`;
     monthly via `addMonthsISO` **with an end-of-month clamp** (critique: Jan 31 + 1mo
     overflows to Mar 3 — clamp day to `min(startDay, daysInMonth(target))`; test a Jan-31
     fixture).
   - **Deposit + balance (`n: 1`) — balance due at the PICKUP DATE** (critique: spec says
     pickup date; cadence math would compute start+7d/+1mo). The Deposit wizard shape
     collects deposit amount + a pickup-date `dateField` (no cadence/N) and sets
     `installments[0].due` = pickup date. Test asserts exactly that. Full payment = no `plan`.
   - `planInstallmentsPaid(inv)` — installments whose cumulative scheduled amount
     (down + installments[0..i]) ≤ `amountPaid` (+ 0.005).
   - `syncSaleDueDate(inv)` — `dueDate` = next unpaid installment's `due` (down due at mint ⇒
     initial dueDate = mint date), else the last installment's `due`.
4. **Status logic — NEW logic is required (critique BLOCKER).** `invoiceTotals` returns
   `'Partial'` whenever `paid > 0` (app.js:1902) BEFORE the dueDate aging ladder — so a
   financed sale would read Partial forever and a lapsed buyer never surfaces. Amend
   `invoiceTotals` (the one chokepoint): for a plan-carrying invoice with `paid > 0`,
   `balance > 0`, and `dueDate < TODAY` → derive the aging ladder (Late tiers/Collections)
   instead of flat Partial; otherwise Partial as today. Non-plan invoices: behavior unchanged
   (pin with a regression test). This replaces the spec's "no new status logic" claim
   (spec-amended).
5. **Mutation closures (critique major — the plan invariant `down + Σinstallments = total`
   must survive):**
   - `invoiceMergeable` → false when either side carries `inv.sale`.
   - Line ✕ / `inv-line-remove` (app.js:18986): the `kind: 'sale'` line is NOT removable
     while the unit is Sold; `saleTransport` removal/edit routes through the manager
     `tierAuth` gate (note: the ✕ currently renders for every kind except `'transport'` —
     `'saleTransport'` would get one by default; suppress it).
   - `addRentalLineToInvoice` (app.js:22485) / `addWOToInvoice` (app.js:22505) / the
     drag-link resolvers (app.js:17610/17641): refuse targets where `inv.sale` is set.
   - `addCustomLine` (app.js:22259) on a sale invoice: manager `tierAuth`; any approved
     lineItems change on a plan-carrying invoice rebuilds the remaining (unpaid) installments
     equally over the remaining schedule, then `syncSaleDueDate`.

## Phase 3 — Lifecycle: commit · Purchased · un-sell

1. **`commitEquipmentSale({ customerId, unitId, price, transport, shape, planCfg, po })`**
   (beside `sellUnit` app.js:19539):
   - re-check `canMoney()`; validate unit is `'For Sale'`, price > 0;
   - **active-rental guard (critique major):** `activeRentalForUnit(unitId)` (app.js:1937 —
     covers live rentals AND future reservations, `ACTIVE_RENTAL` includes `Reserved`) →
     hard-block the commit with a toast naming the rental; the picker badges such units
     instead of listing them clean. Test: commit refused for an on-rent/reserved unit.
   - mint the sale invoice (Phase 2) + `syncSaleDueDate`;
   - unit: `fleetStatus='Sold'` + `salePrice` (machine-line amount) **in the same mutation**
     (categoryStats app.js:2287 needs both together) + `saleDate` + `soldToCustomerId`
     (new field; `soldNote` legacy, zero readers);
   - `logAction` on unit AND customer (**never `inv.actions`** — invoice actions print
     customer-facing, see Phase 4b); `reindex` both.
   - PO gate: `invoicePoBlocked` (app.js:21096) blocks all payment for `requiresPO` customers
     with no `inv.po` — wizard collects a PO up front for those customers.
   - **Concurrency (v1 = warn, noted):** the 18s refresh is suppressed while an overlay is
     open, so re-check the unit via a one-shot backend load at commit where a backend is
     present; on later sync, detect a conflicting `soldToCustomerId` and surface a loud toast.
2. **`markEquipmentPurchased(c)`** — 1:1 mirror of `markMembershipSigned` (app.js:588):
   idempotency guard, `usedSalesStage='Purchased'`, `ensureFunnels(c).equipment = true`,
   `logAction`.
3. **First-money hook — `applyPayment` (app.js:21186), the single money chokepoint** (Stripe,
   ACH settle, refund, manual cash/check all land here; refund distinguished via
   `r.refundedCents`, app.js:21204): after `amountPaid` updates —
   `if (inv.sale) { syncSaleDueDate(inv); if (!isRefund && amountPaid > 0) markEquipmentPurchased(customer); }`.
   `markInvoicePaidLocal` (app.js:4738) stays membership-demo-only for real data — pinned by
   test; the sale **demo carve-out** (below) goes through `applyPayment` instead.
4. **Un-sell — REDESIGNED (critique BLOCKER; the spec'd "refund first, then void" was a dead
   end):** a refund sets `inv.refunded = true` and deliberately KEEPS `amountPaid`
   (app.js:21167-21169), while `invoiceVoidable` (app.js:22533) requires `!i.refunded &&
   amountPaid === 0` — a paid sale could never be voided, the unit stuck Sold forever. Fix:
   - `invoiceVoidable` gains a sale carve-out: an `inv.sale` invoice is ALSO voidable when
     **fully refunded** (`refunded && refundedAmount >= amountPaid`), keeping $0-paid
     immediate voids working as today.
   - `voidInvoice` (app.js:22539) gains the `inv.sale` branch: unit back to `'For Sale'`,
     clear `salePrice`/`saleDate`/`soldToCustomerId`; funnel: if `usedSalesStage ===
     'Purchased'` and no OTHER non-voided money-in sale invoice exists → revert to
     `'Payment Discussed'`.
   - Void stays the **explicit, manager-visible act**; a refund alone never un-sells (partial
     / goodwill refunds are normal). UI copy: "Refund in full, then Void to un-sell."
5. **Demo mode (decided, not omitted):** `#local` payments hard-require `backendCall`, so the
   Purchased arc would be undemoable. Mirror the membership `memIsDemo` carve-out for sale
   invoices — demo-only, and route it through `applyPayment` with a synthetic response object
   (NOT `markInvoicePaidLocal`) so the Phase 3.3 hooks fire identically in demo.
6. **`markChargeFailed` decision (flag to Jac):** sale invoices keep the customer-level
   `chargeFailedAt` on decline (membership is carved out; a bounced machine payment IS a real
   signal). Veto in PR review if unwanted.
7. **Generic fleet-dropdown (flag to Jac):** remove `'Sold'` as a pickable TARGET in
   `openFleetDropdown` (app.js:16355) — entering Sold goes through the sale flow; leaving
   Sold stays possible for legacy corrections.

## Phase 4 — The sale wizard (UI)

1. **ONE popup kind `'equipmentSale'`** with an `o.step` machine (`gpsConnect` app.js:12737
   precedent; steps branch by payment shape — Full: none; Deposit: deposit + pickup-date;
   Financed: down/cadence/N/start). `buildPopupEl` branch + `WINDOW_CATALOG` row (same
   literal string, graceful `sample()`); **retire `'sellUnit'` — branch (14063) AND catalog
   row (14254) in the same commit**.
2. **Unit picker step:** searchable pick-list (gpsConnect 'identify' pattern, app.js:12765)
   filtered `fleetStatus === 'For Sale'`; on-rent/reserved units badged un-pickable (Phase
   3.1). Empty state links to flipping a unit For Sale.
3. **Price step:** prefill `salePriceSuggest(IDX.category.get(unit.categoryId))`
   (app.js:2032). Below suggested bottom → `tierAuth` manager approval (shell app.js:13844
   via the generic `azAction`+`onOk` seam, `accountBlockOverride` precedent app.js:19262;
   azAction `'saleBottomOverride'`). Suggestion visible to the operator; basis/bottom
   internals never in customer-visible copy.
4. **Transport step:** optional `saleTransport` line; amount editable but manager-locked —
   `.acct-lock` icon + R23 tip (app.js:4249 pattern), edits via `tierAuth`
   (`'saleTransportUnlock'`). PO input here for `requiresPO` customers.
5. **Payment-shape step:** `segCtl` Full · Deposit · Financed; per-shape reveals (Phase 2.3);
   live schedule preview.
6. **Schedule widget = R36** (bespoke installment rows): `data-r="R36"`, RULE_META + RB_TABS
   entries by hand, CLASS_RULE if it gets a container class. Reused in three homes: wizard
   preview, Track B inline (Phase 5), invoice popup (Phase 4b).
7. Commit = `actionPill('commit', 'Finalize Sale')` (R17 blue); Cancel = ghost (R18).
   jactec-ui pass; zero R0 violations.

## Phase 4b — Money surfaces: printed doc + payment popup (critique majors)

1. **Printed/customer-facing invoice** (`invoicePrintGroups` app.js:21293, `prLineParts`
   app.js:21320, `invoiceDocHtml` app.js:21451):
   - sale lines currently land in the trailing `'Other'` group — add an `inv.sale` group
     titled "Equipment Purchase — <unit>";
   - `prLineParts` branch for `'sale'`/`'saleTransport'` (transport meta today keys
     `kind === 'transport'` only);
   - when `inv.plan` exists: render the schedule + "Next payment due" framing instead of the
     full-balance-due-on-next-date read;
   - extend the `invoiceAmendments` DENY regex (app.js:21340) with `bottom|suggest|approv`
     so no pricing-internal log line can print; sale-side `logAction` stays on unit/customer
     (Phase 3.1);
   - test: render `invoiceDocHtml` for a financed sale, assert schedule present and no
     basis/bottom text.
2. **On-screen invoice popup:** subtotal grouping (app.js:8703 keys
   `['rental','transport','parts','labor']`) gets the two new kinds; schedule (R36) block
   when `inv.plan`.
3. **Payment popup** (app.js:14171-14193): defaults charge the FULL balance — one un-edited
   click would charge a financed buyer the whole machine. When `inv.plan`: show
   "Next due: $X by <date>" and default amount/alloc to the currently-due amount (full
   balance stays one click away). Test the default.

## Phase 5 — Equipment track integration

1. Track B (`funnelSectionHtml` app.js:4169-4180): inline = sale summary **with the R36
   schedule + next-due** (the spec's "renders the schedule + next-due inline" — restored per
   critique; heavy ACTIONS stay in the invoice/wizard per the `membershipActionsHtml`
   precedent). **Money figures (price/paid/owed/schedule) render only when `canMoney()`**
   (critique major — house convention hides `salePrice` from sub-money roles, app.js:8353);
   sub-money sees unit + stage only. "View sale" → the invoice.
2. **`+Sale` reach (critique):** gated on `canMoney()` ONLY — render in `bInner` AND in the
   `ftk-empty` branch beside the join button, so a not-yet-in-funnel customer can be sold to
   (funnel joins automatically at first money). Multiple sales per customer: list open sale
   invoices.
3. Pipeline board: registry-driven, verify only.
4. **data.js seed:** one unit `fleetStatus: 'For Sale'` (none exists — picker/staging would
   be empty).

## Phase 6 — Absorb the unit-side flow

- `js-open-sell` (app.js:18544) → `openOverlay({ kind: 'equipmentSale', unitId, … })`, unit
  pre-picked + a customer-pick step prepended. Sell pill visibility unchanged.
- `sellUnit()` becomes the internal fleet-mutation helper of `commitEquipmentSale` (extended
  for `soldToCustomerId`); the D3 logic-test (1687-1712) is rewritten against the NEW commit
  path so categoryStats ROI behavior is pinned to fields, not entry path.

## Phase 7 — Tests · audit · gates · ship

- **New logic-test blocks** (fixtures: bespoke invoice + IDX registration per logic-test:84;
  snapshot/restore per :55; category+units teardown per :1687; `T.setRole` for gates):
  1. `buildSalePlan` — equal splits, penny remainder, weekly dates, monthly **EOM clamp
     (Jan-31 fixture)**, deposit `n:1` **due at pickup date**, zero-down financed.
  2. `planInstallmentsPaid` + `syncSaleDueDate` across partial payments via `T.applyPayment`;
     dueDate advances installment-by-installment.
  3. **New status logic:** plan-invoice with `paid > 0` + lapsed installment reads Late
     tiers; not-past-due reads Partial; NON-plan invoices unchanged (regression pin).
  4. First money → `markEquipmentPurchased` (join + Purchased, idempotent); refund does NOT
     trigger; `markInvoicePaidLocal` never fires for `inv.sale`; demo carve-out routes
     through `applyPayment`.
  5. Manual `'Purchased'` pick rejected; terminal-wipe guard; Wrangler drops auto terminals
     AND a raw `fleetStatus:'Sold'` write.
  6. `commitEquipmentSale` — mutations set together; PO honored; **active/reserved rental
     blocks commit**; categoryStats residual via the new path.
  7. **Un-sell:** full refund → voidable → `voidInvoice` un-sells (fields cleared, For Sale
     restored) + funnel reverts; a second money-in sale blocks the revert; a PARTIAL refund
     does not make it voidable.
  8. Mutation closures: `invoiceMergeable` false; sale-line ✕ blocked; rental/WO line add
     refused; custom-line rebuild recomputes installments.
  9. Migration `'Paid'`→`'Purchased'` via exported `migrateCustomers`.
  10. Print doc: financed sale renders schedule, "Equipment Purchase" group, no
      basis/bottom text; payment-popup default = currently-due.
- **`__rw` additions** (app.js:25652): `buildSalePlan`, `planInstallmentsPaid`,
  `syncSaleDueDate`, `commitEquipmentSale`, `markEquipmentPurchased`, `migrateCustomers`.
- `/role` audit (sale dollars behind `canMoney` everywhere incl. Track B; basis/bottom never
  customer-facing; tierAuth gates) → fixes → full gate suite → `/deploy` staging (incl. the
  Phase 0 round-trip check) → `/merge` → `/promote` (Jac's calls).

## Flagged decisions (surface in the PR body for Jac)

1. **Naming collision:** `unitFleetStatus` already has an unrelated `'Purchased'` (navy,
   unit-intake, config.js:87). Different STATUS namespace, no code collision — but two
   identically-labeled pills with different meanings. OK, or relabel the funnel terminal?
2. `markChargeFailed`: a declined sale charge sets the customer-level block (unlike
   membership). Kept — veto if unwanted.
3. Generic fleet dropdown loses `'Sold'` as a pickable target (sale flow owns entering Sold);
   Wrangler chat/CSV likewise can no longer stamp `'Sold'`.
4. Void revert lands on `'Payment Discussed'` (last manual stage), not `'N/A'`.
5. **Un-sell mechanics (spec-amended):** "refund in full → Void un-sells" — the spec's
   original text assumed a refund zeroes `amountPaid`; it doesn't (house rule keeps it and
   derives from `inv.refunded`), so voidability for sale invoices keys on fully-refunded
   instead. Same user-visible behavior Jac approved (void un-sells), corrected mechanism.
6. **Financed-sale lateness (spec-amended):** surfacing a lapsed installment as Late requires
   a new `invoiceTotals` branch for plan-carrying invoices (the existing ladder only ran at
   $0 paid). Without it a buyer who stops paying never surfaces — treated as required, not
   optional.
7. Demo mode gets a sale-payment carve-out (mirrors membership's) so the Purchased arc is
   demoable in `#local`/staging.
