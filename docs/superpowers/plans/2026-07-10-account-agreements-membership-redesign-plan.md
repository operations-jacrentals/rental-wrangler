# Implementation Plan — Account/Agreements + Membership Auto-Enroll + Payment-Gate Hardening

**Spec:** `docs/superpowers/specs/2026-07-10-account-agreements-membership-redesign-design.md`
**Branch:** `customers-crm/account-agreements-redesign` (off `area/customers-crm`)
**Build discipline:** UI → `/jactec-ui` (yard data-plate); money/auth gates stay on main (CLAUDE.md
Auto-delegation); backend cron ships via `/clasp` (go-live is Jac's editor deploy). R-Rulebook +
`WINDOW_CATALOG` + `rule-usage.js` kept current; all five CI gates green before each area merge.

Phases are ordered so each is independently testable and the risky money/auth work lands on a stable
UI/data foundation. Delegation tier noted per phase.

---

## Phase 0 — Data model + pure helpers (no UI) · MAIN
Foundation the rest builds on. Pure, `logic-test.mjs`-covered.
- **Agreement record shape** (schema-less, on the customer): `{ id, accountType, startDate,
  signedAt, cardId, selfie, signature, terms, membershipPlan, membershipAddOns, status }`. One
  customer → many agreements (the current single-signing model generalizes to a list).
- **Block-state field**: `c.block = { type: 'no-card'|'failed-payment'|'blacklist'|'invoice-hold',
  invoiceIds?, setBy, setAt }` (or derived where possible to avoid stale state — prefer derivation
  for `no-card`/`failed-payment`, stored for the two manual types).
- **Membership status strings** for the collapsed row (D18): extend `membershipStatus()`
  (`app.js:3639`) consumers to surface `MEMBERSHIP PENDING` (signed, start-date future, uncharged),
  `MEMBERSHIP RENEWAL FAILED` (Past Due from a failed cron charge), etc.
- **Card indicator helper** (D18): `V-2261`/`M-2261` from brand+last4, plus status strings
  (`NO CARD`/`PAYMENT FAILED`/`EXPIRED`/`EXPIRING SOON`/`BANK BLOCKED`/`DISPUTED`) off existing
  `cardExpired`/`cardExpiringSoon` (`app.js:281-282`) + new charge-outcome state.
- **Tests:** logic-test cases for status derivation + block derivation + card-indicator mapping.
- **Acceptance:** no UI yet; `node ci/logic-test.mjs` green with new cases.

## Phase 1 — Account section UI rebuild · /jactec-ui, delegable to Sonnet against this spec
Replaces the `newCustomer` overlay account tab (`app.js:12554`, `openCustomerForm` `:18346`).
- Account fields inline on the customer card (name/company/phone/email/industry/PO·protection/
  DL/net-days), **+Notes as its own row under DL** (D15).
- **Agreements list** (scrollable) with **`+Agreement/Card` as the top add-row** (D16, mirror the
  `+Customer`/`+Rental` add-row markup).
- **Collapsed agreement rows** in D18 order; **inline push-down expand** reusing the Invoices
  section's row-expand mechanic.
- **Block Account button bottom-right** (D17).
- R-Rulebook stamps on every new element; `WINDOW_CATALOG` entry for the surviving **Add Card**
  modal; regen `rule-usage.js`.
- **Acceptance:** section renders, rows expand/collapse, add-row present; `smoke` + rule-usage +
  window-catalog gates green. No behavior wired yet (Phase 2).

## Phase 2 — Sign-is-enrollment + close the bypass · MAIN (money/gate)
- ACCOUNT TYPE **dropdown inside the expanded agreement**, live-updates type until saved (D4).
- **Start-Date gate**: for Member/Business Member, disable Sign until Start Date set (D6).
- **Atomic sign = enroll** (D5): signing creates the first invoice now (`membershipFee`
  `app.js:3620`, `buildMembershipInvoice`), sets cadence/commitment fields, **schedules** the
  charge for Start Date (D7) — does NOT charge at signing.
- **Remove the raw ACCOUNT TYPE control** (`NC_ACCOUNT_TYPES` `app.js:18372`, handler `:16072`,
  save `:18443`); retire/absorb `openMembershipEnroll` (`app.js:3771`).
- **Close siblings**: reject Member values in Wrangler `UPDATE` + CSV (`wrAccount` `app.js:13566`,
  `WR_EDITABLE.customers` `:13576`).
- **Unsaved-changes guard** (D10): "Save Changes?" on collapse/click-away.
- **Acceptance:** grep proves no path sets a Member `accountType` without a signed agreement +
  scheduled invoice; Wrangler/CSV reject Member; logic-test for the enroll path.

## Phase 3 — Account-block gate rework · MAIN (auth/gate)
Replaces `cardGateBlocked`/`accountAgreementsBlocked` (`app.js:343-356`).
- Typed block per spec §6 table. `no-card` → add-card clears; `failed-payment` → any successful
  account payment clears; membership charge failures **excluded**.
- **Manual Block button**: choose Blacklist (existing state + lift `app.js:16179`) or select
  invoice(s) (auto-unblock on pay). **Bare Blacklist → Owner password** (D13).
- **Rental attempt on a blocked account → Manager-password popup, per-action** (D14); **Blacklist
  NOT Manager-overridable**. Reuse `roleTier`/`canMoney` (`app.js:15890`); `WINDOW_CATALOG` entries
  for the password popups.
- **Acceptance:** each block type blocks/clears per table; Owner-pw enforced on bare Blacklist;
  per-action Manager re-prompt; membership failure does not block.

## Phase 4 — Backend `membershipBillingCron` · /clasp (Jac deploys go-live)
Additive Apps Script daily time-trigger (spec §5). Deferred first charge (startDate ≤ today,
uncharged) + recurring renewal (paidUntil ≤ today, not prepaid). Idempotent per cycle; atomic
lapse; system-actor authority; bounded retries; ambiguous-timeout re-check. Enroll action accepts
future `startDate` and schedules. **Must NOT set the delivery-block flag on membership failure.**
- **Acceptance:** dry-run in the GAS editor on a test row; STOP-gate before prod per `/clasp`.

## Phase 5 — KPI Member-Mode sales toggle + Invoices/Transactions toggle · /jactec-ui + MAIN math
- Remove always-on economics block; add **Member-Mode/Non-Member-Mode** button (spec §7b) —
  dollar tiles (Open/Paid YTD/Avg Pay) recompute to opposite rate via `membershipEconomics`
  (~`app.js:3208`); #Invoices unchanged. (Optional "you save $X" delta — confirm.)
- **Invoices/Transactions toggle** replacing the section title (§7a): Transactions = flattened
  payments across the customer's invoices.
- **Acceptance:** toggle math matches member/retail; logic-test for the recompute.

## Phase 6 — Design-system dot→background sweep · /jactec-ui (area/design-system conventions)
Every toggle using a colored status dot → red/green/yellow background (spec §7c). Enumerate
dot-bearing toggles; convert uniformly; preserve focus/AA/reduced-motion.
- **Acceptance:** no dot-toggles remain; visual self-critique per jactec-ui.

## Phase 7 — Close-out
Sync `docs/specs/customers-crm.md` + `memberships.md` to shipped reality; `/role` audit (delegable
to Sonnet to WRITE, call stays on main); regen code-map (`node tools/gen-code-map.mjs`) + rule-usage;
all five gates green; local area test (serve on 9147, Jac drives). Then the continue-or-archive fork,
and — when Jac promotes — the two-step staging deploy + Staging E2E.

---

---

## DETAILED TASKS — writing-plans grade (Phases 0–1)
Anchors corrected from recon (2026-07-10) — this branch's `app.js` is ~2600 lines offset from
earlier explorations. Each task: exact anchor, complete change, verify command, commit. Later
phases expand to this grade as we reach them (avoids stale exact-code across a 7-phase program).

### Reused patterns (recon facts the tasks build on)
- **Embedded accordion section to MIRROR for Agreements:** `customerInvoicesSection` (3717) →
  `invoiceExpandedHtml` (3707) → one-open state `state.custInvOpen` (2050); row toggle handler
  `js-inv-row` (14135), collapse `js-inv-collapse` (14133). Agreements get a parallel
  `customerAgreementsSection` + `state.custAgOpen`.
- **KPI row = `invSummaryStrip` (3667)** — the ONE function 7b's Member-Mode toggle wraps.
- **Member-vs-retail math already exists:** `membershipEconomics` (3473) → `{feeRevenue,
  memberRev, retailRev, discount, net}`.
- **Signing model (3291-3355):** cards carry append-only `agreements[]`; `requiredAgreementKey`
  (3297) picks rental|membership by account type; `cardCurrentSigning`/`cardComplete`/
  `cardAuthorized` gate authorization. The new per-agreement ACCOUNT TYPE dropdown must keep this
  invariant (changing type re-derives the required signing).
- **Bypass to remove:** `NC_ACCOUNT_TYPES` (15764) pills → `js-nc-acct` handler (14068) →
  `saveNewCustomer` writes `accountType` (15835/15851). Siblings: `wrAccount`/`WR_ACCT` (11668-72)
  + `WR_EDITABLE.customers` (11679).

### Phase 0 tasks (pure helpers + data model) · MAIN, logic-test-covered
- **T0.1 — Card-indicator helper.** Add `cardIndicator(c, k)` near the card helpers (after 314):
  returns `{ text, tone }` — `V-2261`/`M-2261` (brand-initial + `-` + last4) for a healthy card,
  else a status string (`EXPIRED`/`EXPIRING SOON` from existing `cardExpired`/`cardExpiringSoon`
  281-282; `NO CARD` when none). Failure states (`PAYMENT FAILED`/`BANK BLOCKED`/`DISPUTED`) read a
  new `k.lastChargeOutcome` field — **stub to healthy until Phase 3 writes that field** (documented
  coupling; don't fake it). Verify: `node ci/logic-test.mjs` new case maps brand→initial + states.
- **T0.2 — Membership row-status string.** Add `membershipRowStatus(c, ag)` → the D18 collapsed
  label: `MEMBERSHIP PENDING` (signed, `ag.startDate` future, uncharged), `MEMBERSHIP RENEWAL
  FAILED` (Past Due from cron), else `membershipStatus(c)` (3436). PENDING/RENEWAL-FAILED depend on
  the Phase-2 agreement/scheduled-charge fields — **gate those branches behind field presence** so
  the helper is correct now and lights up as data arrives. Verify: logic-test derivation cases.
- **T0.3 — Block-state model.** Add derivation `accountBlock(c)` → `{type, invoiceIds?, reason}`
  where `type ∈ no-card|failed-payment|blacklist|invoice-hold|null`. `no-card` derives from
  `!hasValidCard(c)`; `failed-payment` from any invoice with a failed-charge marker unpaid;
  `blacklist`/`invoice-hold` read stored `c.block`. Keep the two automatic types DERIVED (no stale
  state); persist only the two manual types. Do NOT wire it into the rental gate yet (Phase 3).
  Verify: logic-test cases for each branch + the membership-charge-failure EXCLUSION (D11).

### Phase 1 tasks (Account section UI) · /jactec-ui (UI code authored IN that skill, not here)
Structure + anchors are fixed here; the **markup/CSS is authored through `/jactec-ui`** (hard rule —
new UI). Each task ends by regenerating `rule-usage.js` + `WINDOW_CATALOG` as needed.
- **T1.1** — New `customerAgreementsSection(c)` mirroring `customerInvoicesSection` (3717): the
  scrollable list, `state.custAgOpen[c.customerId]` one-open state, collapsed rows in **D18 order**
  via T0.1/T0.2 helpers, `+Agreement/Card` as the **top add-row** (mirror `addBtn('Invoice',…)`
  3744 / the `+Customer`/`+Rental` add-rows).
- **T1.2** — Expanded agreement row (mirror `invoiceExpandedHtml` 3707): selfie + agreement + terms
  + signature + ACCOUNT TYPE dropdown + Start Date, reusing `agCaptureBlock`/`heldSignBlock`
  (referenced 10788/10810) capture UI.
- **T1.3** — Merge the account FIELDS (name/company/…/DL/net-days) inline into this section; **+Notes
  as its own row under Driver's License** (D15). Retire the `newCustomer` account-tab popup body
  (10744-10767); keep only the **Add Card** modal (10796-10814) → `WINDOW_CATALOG` entry.
- **T1.4** — **Block Account** button, bottom-**right** (D17).
- Verify each: `node ci/smoke.mjs`, `node ci/gen-rule-usage.mjs --check`,
  `node ci/check-window-catalog.mjs`.

## Build order rationale
0 → 1 give a stable data + UI base. 2 and 3 (the money/auth core, the actual bug closure) land next
on that base. 4 (backend) can proceed in parallel once 2 defines the contract. 5/6 are value/polish.
7 ships. Phases 2, 3, 4 stay on main (gates); 1, 5, 6 route through `/jactec-ui` and can delegate
well-scoped slices to Sonnet against this plan.
