# Implementation Plan — Account/Agreements + Membership Auto-Enroll + Payment-Gate Hardening

**Spec:** `docs/superpowers/specs/2026-07-10-account-agreements-membership-redesign-design.md`
**Branch:** `customers-crm/account-agreements-redesign` (off `area/customers-crm`)

**⚠ Cross-session overlap flag (Jac, 2026-07-10):** a separate concurrent debug session is touching
GPS + invoice + refund code. Phase 3 (T3.2) of THIS branch also touches `applyPayment`/
`chargeInvoiceFlow` (adds `markChargeFailed()` + the `chargeFailedAt` clear-on-payment logic,
`app.js` ~L390-405 and inside `applyPayment`). **Check for merge conflicts or semantic overlap in
those two functions specifically before merging either branch into `area/customers-crm`.**
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

**STATUS (2026-07-10): DONE, LIVE.** Recon corrected an earlier stale assumption —
`membershipBillingCron`/`installMembershipBillingCron`/`membershipDailySweep` already existed
and correctly handle recurring renewals; the actual gap was narrower: `membershipEnroll_` always
charged immediately regardless of `startDate`, and the cron never picked up a first charge (it
always skipped records with no `paidUntil`). Additive patch: `membershipEnroll_` gets a new
`start > today` branch that lands the member account-type + commitment fields immediately without
charging (logs `membership-enroll-deferred`); `membershipBillingCron` now distinguishes
first-charge-due (`!paidUntil && commitmentStart ≤ today`) from not-yet-started from
already-paid-ahead, and bases the resulting `paidUntil` off `commitmentStart` (not `today`) for
that first charge. Both reuse existing fields — no invented schema. Pushed via the
service-account script (`gas-deploy-service-account.mjs push`, content-only/safe), Jac redeployed
from the Apps Script editor, verified live (anonymous `/exec` still answers correctly post-deploy).

## Phase 5 — KPI Member-Mode sales toggle + Open/All/Transactions toggle · /jactec-ui + MAIN math

**STATUS (2026-07-10): DONE, commit `28c84da`.** Built against the approved v6 mockup
(`docs/specs/assets/member-mode-mock.html`) — see spec §7a/§7b for the final (mockup-corrected)
design: the tile NUMBER never changes; Member-Mode only adds an arrow (green savings / red
penalty) + an inline delta. `kpiModeDelta()` is a documented approximation (proportional ratio
from `membershipEconomics`), not an audited per-invoice reconciliation. Open/All/Transactions
(R14 segCtl) replaces the "Invoices" title; Transactions flattens `inv.payments[]` (with the
existing legacy fallback) into its own KPI row. Math verified in a standalone harness.

## Phase 6 — Design-system dot→background sweep · /jactec-ui (area/design-system conventions)
Every toggle using a colored status dot → red/green/yellow background (spec §7c). Enumerate
dot-bearing toggles; convert uniformly; preserve focus/AA/reduced-motion.
- **Acceptance:** no dot-toggles remain; visual self-critique per jactec-ui.
- **Scoping note (2026-07-10):** the spec explicitly says this sweep is "not scoped to this
  card" — it's a codebase-wide design-system pass, not specific to Account/Agreements. Given the
  size of this PR already, recommend this ships as its OWN follow-up task/PR against
  `area/design-system`, rather than further expanding this one.

**STATUS (2026-07-10): DONE.** Shipped as its own PR (#588, `design-system/dot-to-background-toggles`
→ `area/design-system`, merged) → `staging` (live, verified via curl against the mirror site).
Scope was narrowed with Jac first: of 6 dot-bearing interactive families found, only the 2 genuine
3-state red/yellow/green **status** toggles converted — the customer funnel toggle's next-action
urgency (`funnelSectionHtml`, was `seg-dot`) and the card-capture signing-progress tabs (`.ag-tab`,
was `ag-dot`). The other 4 (chat-rail tabs, chat-member toggle buttons, the note color-tag picker,
the comment-flag picker) use dots for 6-color category coding, not status, and were left alone.
Both converted components use the existing soft-bg + solid-ink convention
(`--red-bg`/`--yellow-bg`/`--green-bg`, matching `.c-green`/`.c-yellow`/`.c-red`); the selected
funnel segment stays solid orange (rule #3) with a thin inset ring for `due` so it isn't lost when
that segment is also active. Self-critiqued via screenshots (dark theme, the app's only theme) —
all states legible, no visual bugs.

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

### Phase 2 tasks (sign-is-enrollment + close the bypass) · MAIN (money/gate)
Depends on Phase 1's agreement record + sign action. Anchors marked `⟶P1` bind once Phase 1 lands.
The **Phase 2↔Phase 4 seam** (deferred-charge markers) is defined here and consumed by the cron.

- **T2.1 — Sign = enroll (atomic).** In Phase 1's agreement sign handler `⟶P1`, when the agreement's
  `accountType` is a Member type:
  1. Require `startDate` (server-authoritative echo of the D6 button gate).
  2. Fee via `membershipFee({plan, addOns})` (`app.js:3417`).
  3. Create the first invoice via `buildMembershipInvoice(c, lines, {date:startDate, due:startDate})`
     (`app.js:3765`), `membership:true`, `kind:'membership'` lines (mirror `membershipEnrollCommit`
     lines, `app.js:3798-3800`).
  4. **Deferred-charge seam (Phase-4 cron consumes this):** stamp the invoice
     `inv.scheduledChargeDate = startDate; inv.chargeScheduled = true; inv.chargeCardId = <agreement card>`.
  5. Apply membership fields (mirror `memApplyActive`, `app.js:3778`): `paidCadence`, `commitmentStart/End`,
     `addOns`, `autoRenew`, `unlimitedTransport`/`rentalProtection` per add-ons — **but leave `paidUntil`
     empty** so pricing isn't granted before the charge clears.
  6. **Charge timing — CONFIRMED (Jac, 2026-07-10):** the card is NOT charged until the start date; if the
     start date is **today**, charge **now**. So `startDate <= today` → charge immediately at sign (reuse the
     `stripeChargeInvoice` money path, same as `membershipEnrollCommit`); `startDate` future → defer to the
     cron. Both write the SAME invoice + markers; the cron is idempotent (never re-charges a paid invoice).
- **T2.5 — `membershipStatus` gains `Pending`** (`app.js:3436`). Add, right after the `Member` check:
  a scheduled-but-uncharged future enrollment (`commitmentStart > TODAY_ISO && !paidUntil`) → `'Pending'`.
  `isActiveMember` (`app.js:3450`) stays `Active|Past Due` only → **Pending grants NO member pricing** until
  the cron charges on the start date and sets `paidUntil` → `Active`. Update the status→label maps
  (incl. Phase-0 `membershipRowStatus`). Verify: logic-test — a future-start signed member reads Pending,
  gets retail pricing, then Active after a simulated charge.
- **T2.2 — Remove the raw account-type bypass** (closes the original bug). Account type is no longer
  directly settable:
  - Remove the `js-nc-acct` pills from the account UI (`acctPills`/`NC_ACCOUNT_TYPES`, `app.js:10734`/`15764`)
    and neuter the handler (`app.js:14068`) + the `saveNewCustomer` writes (`app.js:15835`/`15851`).
  - New/edited customers **derive** non-member type: `company ? 'Business' : 'Non-Business'` (reuse the
    existing company→Business auto-promote, `app.js:17104`/`18148`). **Member types ONLY via a signed
    agreement (T2.1).**
  - Retire `openMembershipEnroll` (`app.js:3771`) + the `membershipEnroll` overlay (`app.js:10207`) —
    absorbed into the agreement sign flow; removing it kills the second enroll surface (a second bypass).
- **T2.3 — Close the Wrangler/CSV siblings.** In `wrAccount` (`app.js:11669`), clamp to **non-member only**:
  a `/member/i` input returns `''` (dropped), never maps to a Member value. Result: `wrCleanFields`
  (`app.js:11766`) refuses `accountType: "Business Member"` from chat + CSV. Verify: an UPDATE/import with a
  member value leaves `accountType` unchanged (skipped), not silently granted.
- **T2.4 — Unsaved-changes guard (D10).** On collapsing an open agreement or leaving the customer card with a
  dirty agreement draft (`state.custAgOpen` + a dirty flag `⟶P1`), intercept with "Save Changes?"
  (Save / Discard / stay). Reuse the existing `backGuard`/`syncBackGuard` machinery (`app.js` §12,
  ~`10090`). Contextual prompt, not a permanent bar (D27).
- **T2.6 — Retire the overlapping old sections (Jac decision, 2026-07-10).** Once the new section is
  functional (T2.1–T2.4 wired), remove the old `account` section's duplicated editable fields (`app.js:7045`,
  the `.split` LEFT column) and the standalone `paymentMethodsSection` (`app.js:668`, now represented as the
  Agreements accordion) from `DETAIL.customers` (`app.js:7081-7082`). **Fold the derived stats** the old
  right column carried (Total paid, Visits, Customer-for, Rents-every-N-days, rented-category flags,
  `app.js:7053-7059`) into the new Account section so nothing is lost. Do NOT do this before the new section
  is functional (would replace working card management with a read-only shell).
- **Acceptance (Phase 2 = the bug is CLOSED):** `grep` proves no path sets a Member `accountType` except the
  agreement-sign handler; Wrangler + CSV reject Member; a future-start signed member reads **Pending** with
  **retail** pricing until charged; logic-test covers enroll→pending→active + the two sibling refusals.

**STATUS (2026-07-10) — T2.1/T2.5 built (2b), T2.2/T2.3 built (2a); T2.4/T2.6 still open:**
- **T2.1 (Phase 2b, done):** `agreementSignCommit()` is the ONE write site for a signed account-type change.
  Signature via the existing popout window (generalized target only); selfie via the existing file-picker
  fallback (same, generalized target only) — the **live-camera-preview tile was deliberately left
  untouched** (deeply `state.overlay`-bound, shared with the working +Card flow; flagged as a follow-up, not
  rushed blind). **Two open items needing Jac's product input, not invented silently:**
  1. No Annual-vs-Monthly / Transport-add-on picker in the inline panel (defaults: Monthly + inherits the
     account's existing Rental Protection toggle) — the approved mockup didn't show one; add later if wanted.
  2. The live-camera selfie tile (vs. the file-picker fallback currently wired) — a scoped follow-up.
- **T2.2/T2.3 (Phase 2a, done):** bypass + siblings closed (see commit `4bc2430`).
- **T2.5 (done):** `Pending` status (commit `c097a9b`).
- **T2.4 (done, commit `7a0316c`):** unsaved-changes guard via `guardAgLeave`/`agDraftDirty`. Uses
  `window.confirm` (OK saves + proceeds, Cancel keeps editing) — deliberately simpler than a custom
  3-button Save/Discard/Stay popup; loses a true "discard and leave anyway" option. Flagged, not hidden.
- **T2.6 (done, commit `97ce018`) — with a correction to this plan's own wording:** the old account
  fields are retired and their derived stats (Total paid/Visits/Customer-for/rented-flags) are folded
  in, plus the `address` field that Phase 1 had missed (would've been silently dropped). **BUT
  `paymentMethodsSection` was deliberately KEPT, not retired** — it carries real functionality
  (ACH/bank-account management, card nickname/make-default/remove) the new Agreements accordion
  doesn't replicate (still a read-only viewer). Retiring it as originally planned would have been a
  functional regression, not just de-duplication — this plan's T2.6 wording undersold that risk.
- **Phase 2 (T2.1-T2.6) and Phase 3 (T3.1-T3.4) are now FULLY BUILT.** Two Sonnet browser-verification
  agents are running (Phase 3 gate, Phase 2b sign=enroll, both worktree-isolated) — do not
  merge/promote until BOTH come back clean.

### Phase 3 tasks (account-block delivery gate) · MAIN (auth/gate — build WITH Jac's live verification)
Recon (2026-07-10): the On-Rent/delivery gate ALREADY exists — `cardGateBlocked(cust)` (`app.js:365`)
enforced at booking (`app.js:15163`, `15193`) + delivery (`app.js:15328`), with an existing per-rental
override: `requireAdmin(reason, onOk)` (`app.js:15115`) sets `r.cardOverride` and proceeds
(`app.js:15127-29`). Phase 3 EXTENDS this proven pattern — it does not invent a new gate. **Mirror
`cardGateBlocked` exactly** to keep the risk low; the only genuinely new bits are the block-type data,
the Owner-vs-Manager tier, and the per-action (non-persistent) override.

- **T3.1 — Block-type picker (replaces the Phase-1 `js-block-account` → `managerPw` stub, `app.js:14450`).**
  On Block Account, open a picker: **Blacklist** (bare, no invoice) or **Invoice-hold** (select which of the
  customer's open invoices must be paid). Writes `c.block = {type, invoiceIds?, setBy, setAt}` (the shape
  `accountBlock()` already reads, `app.js:381`). **Bare Blacklist requires the OWNER tier** (D13) — gate it
  through the existing admin/role machinery (`requireAdmin`/`adminUnlocked`, `app.js:15115`/`14850`), escalated
  to Owner; invoice-hold is a lower staff tier.
- **T3.2 — `chargeFailed` marker (makes `accountBlock`'s failed-payment branch live, D11).** Where a card
  charge fails (`friendlyPayErr` sites: `app.js:16442`/`16452`/`16516`/`16525`), set `inv.chargeFailed = true`
  on the rental invoice; **clear it on any successful payment** on the account. **Membership invoices are
  EXCLUDED** (accountBlock already filters `!i.membership`, D11) — a failed membership charge never trips the
  delivery block.
- **T3.3 — Extend the gate (the high-stakes change — verify live).** At the 3 gate points (`15163`/`15193`/
  `15328`), add `accountBlock(cust)` alongside `cardGateBlocked`. On a block:
  - `blacklist` → **hard stop, Owner-only override** (NOT Manager — D14); surface the reason, no per-action
    Manager bypass.
  - `no-card` / `failed-payment` / `invoice-hold` → **Manager-password per-action override** (D14): prompt via
    the `requireAdmin` machinery escalated to Manager tier, **but do NOT persist** the override (unlike
    `r.cardOverride`) — each attempt re-prompts. Use a transient (non-stored) pass, or clear it immediately
    after the one action.
  - **Fail-safe:** if the block state is ambiguous, block (don't allow). Never weaken the existing
    `cardGateBlocked` conditions — only ADD to them.
- **T3.4 — Auto-unblock (derived, no code needed for two types).** `no-card` clears when a valid card is added,
  `failed-payment` clears when any account payment succeeds, `invoice-hold` clears when the selected invoices
  are paid — all already derived by `accountBlock()`. Only `blacklist` is a stored state lifted by an
  Owner-tier action (add a lift control near the block button, Owner-gated).
- **Acceptance:** a blacklisted account's rental attempt is a hard stop (only Owner overrides); a no-card /
  failed-payment / invoice-hold account re-prompts a Manager EVERY attempt; a clean account books normally
  (no regression — verify the existing card-gate still behaves); a failed MEMBERSHIP charge does NOT block
  delivery. **Drive all of these in the browser before merging** (this gate can't be unit-tested alone).

**STATUS (2026-07-10) — T3.1-T3.4 built, on `customers-crm/account-agreements-redesign`:**
- T3.1: `blockPicker` popup shipped — Blacklist (`requireAdmin`, Admin/Owner tier) / Invoice-hold (staff-tier,
  pick open invoices). `verifyTierOrPassword(minTier, pw)` added (reuses the existing tier ladder + the ONE
  backend admin password — **no separate Manager/Owner password was built**, per Jac's confirmed call).
- T3.2: **corrected before wiring** — `accountBlock`'s failed-payment check was originally per-invoice; fixed
  to a customer-level `c.chargeFailedAt` flag so ANY successful payment anywhere clears it (Jac's Q3 answer).
  `markChargeFailed()` fires only on a DEFINITE decline (never network/timeout), never on a membership invoice.
- T3.3: wired into `setRentalStatus`/`setUnitStatus`/`yardCapture`. Blacklist hard-stop REACTIVATES a
  pre-existing, previously-dormant `/Blacklist/i` check (nothing wrote that string before T3.1). **no-card was
  deliberately left on the existing Admin-tier/persistent card gate** (stricter than D14's Manager-tier ask —
  extending it would have weakened a working control). New Manager-tier/non-persistent coverage added only for
  failed-payment/invoice-hold via `accountBlockGate()`/`accountBlockOverride()`.
- T3.4: no extra code needed — already satisfied by derivation (accountBlock recomputes fresh) + T3.1's lift
  control.
- **A Sonnet browser-verification agent is driving the 9-step test plan above right now** (worktree-isolated).
  Do not merge/promote until that report comes back clean — this is the core rental gate.

## Build order rationale
0 → 1 give a stable data + UI base. 2 and 3 (the money/auth core, the actual bug closure) land next
on that base. 4 (backend) can proceed in parallel once 2 defines the contract. 5/6 are value/polish.
7 ships. Phases 2, 3, 4 stay on main (gates); 1, 5, 6 route through `/jactec-ui` and can delegate
well-scoped slices to Sonnet against this plan.
