# Invoicing / Payments — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/invoicing-payments`
**Task branch:** `invoicing-payments/spec` (proposed)
**Maturity:** shipped
**Scope:** The full invoice lifecycle (creation, line items, tax, aging, locking, merging, 28‑day series splitting) and every payment path (Stripe card/ACH, manual cash/check, refunds, card‑on‑file) — documented AS CANON, with the parked/gated edges surfaced for decision.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions and amend §3 / §5 / §6 / §8.

- **D1 · Partial refunds — keep PARKED until a validated backend deploy (resolves Q1). [2026-07-09] FULFILLED / SHIPPED — see "Shipped status (2026‑07‑09)" below.** The over-refund risk exists **only** if the flag is flipped before the server cap ships. Done right it is safe: the server re-caps `amountCents` at the live remaining balance in **integer cents under a `LockService` lock**, so a client-invented over-cap is clamped, never honored; a zero-remaining invoice is rejected `nothing-to-refund`. **Keep `PARTIAL_REFUNDS_ENABLED = false` for now.** Ship only in a dedicated `/clasp` session: deploy the `amountCents` validation → verify on a real test invoice → *then* flip the flag + bump `?v=`. Never unattended. (Sequence is the risk, not the feature.)
- **D2 · Dual-approver refunds via a Settings toggle (resolves Q2/Q15, + Q3/Q16 reason).** Add **Settings → Company → "Require a second approver for refunds"**. When ON, confirming a refund opens a popup requiring a **second, *different* user** to enter their password (money-tier+); the server logs **both** the initiator (`role`, from the call password) and the **approver** on the ledger entry — a two-person, "both responsible" control. A **structured refund reason** (enum + optional note) is captured on the same step. Default **ON** recommended (Jac to confirm). New popup → `WINDOW_CATALOG` entry + `data-r` stamps.
- **D3 · No new retire statuses now (resolves Q6/Q14); uncollectables route to Collections (Jac, 2026-06-29).** An empty/zero invoice already "stealth-clears" a *never-paid mistake*, so no `Void` is added. For a *partially-paid uncollectable*, rather than a passive bad-debt write-off, the invoice is **sent to "Collections"** — a planned in-app feature integrating a **3rd-party collections service** (now its own roadmap area). A `Sent to Collections` status (gray-adjacent) marks it, the balance leaves active aging, and a recovery remits back through the payment path. Specced in the **Collections** area.
- **D4 · Deposits + surcharges as default-OFF Settings toggles (resolves Q11/Q12/Q20).** Add **Settings → Company** toggles, **both default OFF**: **"Damage deposit / hold"** and **"Card surcharge / convenience fee."** Enabling either introduces its own line type that MUST declare per Q20: (a) taxable vs exempt, (b) revenue/KPI netting, (c) **no cost/margin on the print doc** (§3.5). Confirm LA legality before enabling surcharge.

**Defaults adopted (no objection):** Q5 → collections threshold becomes a **Settings → Company** value (default 120d) · Q9 → keep unverified-bank charging **blocked** until the `SM…` verify · Q10 → add a **CI string-scan** asserting no `cost`/`margin`/`bottomDollar` token in the print/PDF/quote template · Q18 → **every AI-initiated payment requires an explicit human Apply (never auto)** · Q19 → a fully-paid invoice **auto-locks**, unlock stays money-tier. **Still standing:** Q17 (keep manual methods = cash/check only; revisit with `accounting` reconciliation) · Q7 invoice delivery (cross-area with `comms-notifications`).

---

## Shipped status (2026-07-09)

Reality-check pass against the batch promoted `staging` → `main` today (PR #552, plus the
pre-promotion audit fix batches #554/#556/#557/#559 and the Customer Details reorg #566).
Cross-checked against live `app.js`/`config.js`. Inline `[2026-07-09]` notes are dropped at
the specific sections below; this is the fast-scan summary.

- **SHIPPED — Invoice-id format v2 (month-first + per-month counter).** `invoiceId()` now
  emits `##MMDDYY` (e.g. `228JY0826`, pill `228JY`) — **not** the `INV.06.07.26.001` example
  in §4.1, which is now stale. Counter resets per calendar month (`invoiceSeq`/
  `invoiceSeqMonth`, `maxInvoiceSeq()` `app.js:2248`, `nextInvoiceId()` `app.js:2263`). Legacy
  `##iDDMmmYY` ids still parse (`invoiceShort`, `config.js:555`).
- **SHIPPED — Invoice-id collision prevention + repair.** `mintedInvoiceIds`,
  `isInvoiceIdCollision`, `healInvoiceIdCollision` all live (`app.js:21784` export list) — a
  collided id can be detected and repaired, with an honest failure path if it can't be.
- **SHIPPED — Full-bleed kraft printable invoice.** The print doc dropped the flat white
  ledger look for a full-bleed kraft "yard log" page (`@page` margin 0, kraft carried on the
  root canvas + body, its own inner padding instead of page margin). Not described anywhere
  in §6 yet — read §6.2's "Print / PDF" line as covering this new treatment.
- **SHIPPED — `invoiceDocHtml(inv, {interactive})` shared render (`app.js:18403`).** Extracted
  from the former `printInvoice` so the screen (embedded, interactive) and print (byte-
  identical, no opts) views can never diverge. Not mentioned anywhere in the spec below —
  it's the mechanism behind the Customer Details reorg (next item).
- **SHIPPED — Retro re-tier fix (#425).** Extending a rental across a rate-tier boundary now
  re-tiers correctly even when the active invoice is already PAID IN FULL — previously a paid
  1-day→7-day extension billed daily+weekly instead of just the weekly rate (over-charged).
  `billSpillRetro` now credits everything already billed for the unit across the whole series;
  mirrored in `previewExtensionDelta`; never reopens/re-prices the settled paid line (§7.4's
  refund-first rule intact). Locked by `ci/logic-test.mjs` §32c.
- **SHIPPED — Empty->28-day-rental invoice fix (#537/#538).** Billing an all-No-Show rental
  now REFUSES instead of minting a silent invoice with no line items (`createInvoiceForRental`
  counts billable lines, not just units); re-dating a rental now restores missing unit lines on
  its invoice.
- **MAJOR STATUS FLIP — Partial / per-line refunds are LIVE, not gated.**
  `PARTIAL_REFUNDS_ENABLED = true` at `app.js:6702` (was `false` when this spec was written).
  The additive backend contract in `docs/handoffs/partial-refunds-backend.md` is deployed;
  `refundInvoiceFlow` (`app.js:18184`) now sends a cap-validated `amountCents` + the per-line
  `refundAlloc` split whenever the flag is on. **This flips §2.2, §2.3 ("No partial refund in
  production"), §5.1/§5.3 ("today; full only" / "Proposed ADDITIVE actions"), §8 Phase 2,
  Decision D1, and Open Q1 from PLANNED/PARKED to SHIPPED** — see the inline annotation at
  each. Caveat: no separate "verified on a real test invoice" writeup was found in this repo
  confirming D1's deploy→verify→flip sequence was followed in that order — worth a quick
  confirmation from whoever flipped the flag.
- **ARCHITECTURE CHANGE — the standalone Invoice card is RETIRED; invoices now live embedded
  in Customer Details.** `'invoices'` is dropped from `config.js` `COLUMNS.right`/`COLUMN_OF`
  (data model / `ROW_META` / `DETAIL.invoices` all kept — this is a UI re-home, not a data
  change). A scrollable `customerInvoicesSection(c, cs)` (`app.js:3905`) renders inside
  Customer Details: a manager summary strip + accordion rows that expand (one at a time) into
  the interactive `invoiceDocHtml` sheet. Every invoice cross-link now routes through one
  `pillTo('invoices')` special-case → `openInvoice(invId)` (`app.js:2742`), which reveals the
  customer, scrolls to the section, and expands the row. **§6 and §6.1 below still describe the
  retired standalone-grid-card architecture ("Surfaces live on the Invoices grid card") — read
  that as historical.** The money-actions row, ledger block, status pill, and payment-popup
  content they describe are still accurate; only the surface they're mounted on changed.
- **NOT independently verifiable here — backend security-audit fixes on invoices.** Reported
  shipped as part of today's promotion: (1) an idempotent no-op guard on `recordCharge_`
  against duplicate PaymentIntent recording, (2) the price-lock seal freezing the customer's
  tax-exempt flag at lock time instead of re-reading live customer state, (3)
  `stripeRefundInvoice_` walking ALL charges on a multi-charge invoice instead of only the
  last one, (4) refund `amountCents` validation rejecting an explicit non-positive value
  instead of silently treating it as "refund everything." `backend/Code.gs` is gitignored and
  never committed, so none of these four are directly checkable from this repo. The closest
  tracked evidence is `docs/handoffs/stripe-actions-backend.gs` (an AS-BUILT reference pulled
  from live Code.gs on 2026-07-09), which documents idempotency-keyed charge calls and an
  `invoiceSealOk_` integrity re-check on `stripeChargeInvoice_` — consistent with (1)/(2) — but
  it explicitly does **not** reproduce `stripeRefundInvoice_` verbatim, so (3)/(4) have no
  citable source in this repo. **Gap: no handoff doc captures the refund-side fixes** — worth
  asking for one (or a live Code.gs diff) before treating them as fully proven here.

---

## 1. Goal & Problem

**What this area is for.** Invoicing/Payments is the money spine of Rental Wrangler. Every other card (Rentals, Shop/WOs, Memberships, Customers) eventually *bills into* an invoice, and an invoice is the only place money is collected, recorded, or returned. It turns the priced rental window, the billable work order, and the membership enrollment into a single customer‑facing document with a subtotal, Louisiana sales tax, a due date, an aging status, and a payment/refund history.

**The business problem.** JacRentals is a heavy‑equipment yard in Sulphur, LA. Office staff need to (a) quote a job fast, (b) take a card or ACH payment without ever handling a PAN, (c) record the cash/check that still walks in the door, (d) chase the late ones via the aging tiers, and (e) refund cleanly when a machine goes back early or a charge was wrong — all from a phone in the yard or a desk in the office. Getting a single cent wrong here is a real‑money, real‑customer incident (the `#false-charge` and `#116 balance‑springback` notes in code are scars from exactly that).

**Why it matters / north star.** *The invoice the customer sees and the dollars Stripe moves must always agree, the server must always be the one source of truth for money totals, and no role below Office/Admin can ever move a dollar.* The client computes and previews; the **backend owns the money math**. Where the client *does* send an amount (`amountCents` on a partial charge/payment/refund), it sends a *cap‑validated* figure that the **server re‑checks and re‑caps against the live balance** — a client‑invented over‑cap value can never move more money than the invoice owes. `amountCents:null` means "charge the full balance," and the server resolves the balance itself. No client write to a money total (`amountPaid`/`refundedAmount`) survives a sync — those fields are server‑owned (#177).

---

## 2. Current State (Baseline) — CANON

Anchors: `APP-04` (`app.js:841`, derivations/pricing), `APP-05` (`app.js:942`, extensions + 28‑day series), `APP-35` (`app.js:14143`, Stripe/payments client), `invoiceTotals` (`app.js:1602`), `TAX_RATE` (`app.js:1602`/config), invoice seed (`data.js:78`), `invoiceId()` formatter (`config.js:540`). **[2026-07-09] Some line numbers have drifted** after today's promotion (the Customer Details reorg + rulebook work shifted code around) — e.g. Stripe/Payments is now chapter `APP-34` at `app.js:13339` per `docs/CODE-MAP.md`, and `TAX_RATE`/`invoiceTotals` are now at `app.js:1689`/`1695`. Not re‑verified line‑by‑line in this pass; treat cited line numbers throughout this doc as approximate and re‑grep the symbol name if a cite doesn't land.

### 2.1 Shipped (live, canon)

| Capability | Where | Notes |
|---|---|---|
| **Invoice totals / tax / aging / status** | `invoiceTotals` `app.js:1603` | subtotal → tax → total → paid → balance → derived `status`. |
| **10.75% sales tax, exact‑cent** | `TAX_RATE = 0.1075` `app.js:1602` | per‑line `li.taxExempt`, invoice `inv.taxExempt`, customer `salesTaxExempt`. |
| **Six aging tiers** | `invoiceTotals` status block | `Not Due` → `Unpaid` → `Late` → `Late+30/60/90` → `Collections` (120d). |
| **Per‑unit line items** | `rentalLineItems` / `transportLineItems` `app.js:884/928` | one `rental` + one `transport` line PER UNIT; `ref=rentalId`, `li.unitId` identifies. |
| **28‑day multi‑invoice series** | `APP-05`, `INV_CAP_DAYS=28` `app.js:962` | long rentals split into ≤28‑day chunk invoices (`covStart/covEnd/contOf`). |
| **Rental extensions billing** | `billExtension`/`previewExtensionDelta` `app.js`§ | retroactive‑pricing setting (`retroPricingOn()`), positive‑delta‑only, live preview. |
| **Stripe card‑on‑file** | `saveCardFlow` `app.js:14384` | SetupIntent → `confirmCardSetup` → persist; PAN/CVC only in Stripe iframe. |
| **Stripe ACH (bank) on file + verify** | `saveAchFlow`/`verifyAchFlow` `app.js:14456/14501` | micro‑deposit `SM…` descriptor‑code verify; `verified:false` until then. |
| **Charge an invoice** | `chargeInvoiceFlow` `app.js:14535` | client sends a cap‑validated `amountCents` (`null`=full balance) + picked `paymentMethodId`; server re‑caps; off_session → 3DS fallback (`confirmCardPayment`) → `stripeFinalizeInvoice` re‑verify; per‑line allocation (§19). |
| **ACH processing poll** | `checkAchStatus` `app.js:14523` | reconciles a pending PaymentIntent (settles or bounces). |
| **Full refund (card + manual)** | `refundInvoiceFlow`/`applyPayment` `app.js:14582/14615` | settled model — refund never springs the balance back; logs `Refunded $X` to the invoice history. |
| **Manual cash/check payment** | `recordManualPayment`/`postManualPayment` `app.js:14656/14637` | server‑authoritative, capped at live balance, exact cents, cash/check only. |
| **Lock / unlock pricing** | `lockInvoiceFlow` `app.js:14772` | `inv.locked` (Office/Admin); locked invoice blocks line edits + drops. |
| **Merge unpaid invoices** | `invoiceMergeable` `app.js:15593` + `mergeInvoiceInto` `app.js:15598` | fold a $0‑paid, unlocked, un‑refunded, same‑customer invoice into another. |
| **Print / PDF + email/SMS quote** | `printInvoice` / `sendInvoiceEmail` / `sendInvoiceText` `app.js:14684/14746/14757` | customer‑facing white doc; mailto/sms deep links (no server send). |
| **Money gate** | `canMoney()` `app.js:14166` | `!currentRole || roleTier(currentRole) >= tierRank('money')`. |
| **Invoice flag colors** | flag‑color‑system §7.4 | R/Y/G prescriptive pill driven by `invoiceTotals().status`. |

### 2.2 Partial / parked

> **[2026-07-09] STATUS FLIP — SHIPPED, not parked.** `PARTIAL_REFUNDS_ENABLED = true` as of
> today (`app.js:6702`); the backend now honors `amountCents` per
> `docs/handoffs/partial-refunds-backend.md`. The row below is left as written (it accurately
> describes the pre‑flip state) with the flip called out here rather than rewritten — see
> "Shipped status (2026‑07‑09)" above for the full picture and the one open caveat (no tracked
> "verified on a real invoice" writeup).

| Capability | State | Where |
|---|---|---|
| **Per‑line / partial refunds** | ~~Built client‑side, GATED OFF~~ **SHIPPED LIVE (2026‑07‑09)** | `PARTIAL_REFUNDS_ENABLED = true` `app.js:6702` (was `false` `app.js:5548` when this spec was written). The refund‑allocation UI (`refundSectionHtml`, `setupRefundAlloc`, `resolveRefund`, `itemRefunded/itemRefundable/lineFullyRefunded`) is live; `refundInvoiceFlow` (`app.js:18184`) now sends the cap‑validated `amountCents` + per‑line split to `recordManualRefund` / `stripeRefundInvoice`. |
| **Per‑line payment allocation** | **Shipped** | `allocLines`/`allocSectionHtml`/`setupPayAlloc`/`allocCharge`; `inv.allocations { lid: preTaxDollars }`. |
| **ACH micro‑deposit verify** | Shipped, but "store now / verify later" | bank lands `verified:false`; charging gated on `verified`. |

### 2.3 Missing (not built)

- No customer‑self‑service payment portal (all collection is staff‑initiated).
- No server‑side invoice *delivery* (email/SMS are device deep‑links; no PDF attachment, no delivery receipt).
- No scheduled/auto‑charge (every charge is a manual Office/Admin tap).
- No dunning automation (aging tiers are computed + colored, but no automated reminders — see `comms-notifications`).
- No write‑off / bad‑debt status (an invoice can sit in `Collections` forever; nothing retires it short of refund).
- ~~No partial **refund** in production (gated, §2.2).~~ **[2026-07-09] SHIPPED** — see §2.2 and "Shipped status (2026‑07‑09)" above; `PARTIAL_REFUNDS_ENABLED = true`.

---

## 3. Users, Roles & Data Gates

### 3.1 Roles touching this area

The role system has 15 named roles mapped to five **tiers** (`config.js:326` `ROLE_TIERS`): `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`. Built‑in mapping (`BUILTIN_ROLE_TIERS`): `office`/`sales` → **money**; `manager` → manager; `admin`/`owner` → admin; `mechanic`/`mtech`/`driver` → staff.

| Role / tier | May see invoices | May edit lines / lock / merge | May take/charge/refund money, manage cards |
|---|---|---|---|
| staff (mechanic, driver, mtech…) | yes (read) | no money buttons render | **no** — every handler re‑checks `canMoney()` |
| money (Office, Sales) | yes | yes | **yes** |
| manager+ (Manager, Admin, Owner, Developer) | yes | yes | yes |
| `#local` demo (no role) | yes | yes (UI shown) | yes in UI; backend still gates server‑side |

### 3.2 The money gate — `canMoney()` (CANON, do not loosen)

```js
const canMoney = () => !currentRole || roleTier(currentRole) >= tierRank('money');
```

- Gates: Pay / Charge / Refund, Add‑Card, Add‑Bank, Lock/Unlock, Merge, Membership billing.
- **Three layers of defence (all must hold):**
  1. **Render gate** — money buttons are *not emitted into the DOM* below money tier (`canMoney()` in the renderers, e.g. `app.js:3263/643`). A non‑money role never sees a Charge/Refund control.
  2. **Handler re‑check** — every money handler re‑checks `canMoney()` before doing anything (defence against a forged click / console call; e.g. `openAddCard` toasts "Cards on file are Office/Admin only").
  3. **Server gate (final + authoritative)** — **every `backendCall` ships `password: backendPassword`** (`app.js:15652`), and `backendPassword` is **the signed‑in role's password** (set per role at login, `app.js:13923`). The backend maps that password → role → tier and **independently rejects a non‑money caller with the typed error `forbidden`**. The client gate is a courtesy; the server gate is the one that actually protects money. A spoofed front‑end with the buttons forced visible still cannot move a dollar without a money‑tier password.
- **The role on the wire is the password, not a `role` string** — so the client cannot lie about its tier by sending `role:'admin'`; it must possess the money‑tier password. (Open Q 11.15 — should money actions additionally require a *step‑up* re‑auth, independent of the session password?)
- `!currentRole` (the `#local` demo) shows the UI but has **no `backendPassword`**, so `backendCall` is never wired to a live money backend — the UI moves "fake" `mock:true` records, never real money.

### 3.3 Customer‑isolation & PII

- An invoice is keyed to `inv.customerId`; **merge is hard‑constrained to the same customer** (`o.customerId === i.customerId` in `invoiceMergeable`) — you can never fold one customer's invoice into another's, so a merge can't cross‑contaminate billing between customers.
- **Raw PAN/CVC never touch our code or backend** — entered only in Stripe's iframe / Card Element (`APP-35` header, mounted at `#sl-card-element`). We persist only `brand/last4/exp/fingerprint/stripePmId` — never the full number, never the CVC.
- ACH routing/account numbers go **straight to Stripe** at `confirmUsBankAccountSetup`; we store `bankName/last4/accountType` only, never the full routing/account number.
- The Stripe **secret key** lives only as a backend Script Property (named, never in repo); the **publishable** key (`pk_live_…`, public by design) is in `config.js` and may be overridden by the backend per‑mode (`stripePubKey` action so the client runs the *same* mode as the secret — a test secret would otherwise mismatch a live publishable key and silently fail). **Never** add the secret key, any role password, the `DEFAULT_CONFIG`, or real customer PII to the repo (public via Pages — see CLAUDE.md "Don't").
- **Customer card/selfie/signature agreements** (`card-bound-agreements`) are PII; their media offloads to Drive (`photo-offload-drive`) and is referenced, not embedded. Removing a card detaches the Stripe PM (`stripeRemoveCard`) and may archive the agreement media (`archiveAgreementMedia`).
- **Server‑side audit (`inv.payments[]`, ledger sheet)** records each money event with the actor's `role` (derived from the call password) and `at` timestamp — a tamper‑resistant who/when/how‑much trail the client cannot forge (it never sees the ledger sheet).

### 3.4 Mr. Wrangler (AI agent) money fence — CANON, do NOT loosen

The in‑app AI (`wrangler-ai`) can write data through the single `apply_changes`/`operate` path, and that path is the **only** AI write surface. Its money fence is hard‑coded in both the system prompt (`WRANGLER_SYSTEM` `app.js:9890`) **and** the `apply_changes` allowlist/validator (`app.js:10107`), so a prompt‑injected or hallucinated instruction can't widen it:

| AI may do (money‑adjacent) | AI may NEVER do |
|---|---|
| `billRental` — build an invoice from the **live pricing engine** (never invents line items/amounts) | **Charge a card or run an ACH** (`stripeChargeInvoice`) |
| `recordPayment` — record a **cash/check** payment (server‑capped at balance, like the human path) | **Refund** anything (`stripeRefundInvoice`/`recordManualRefund`) |
| | **Touch a balance / `amountPaid` / `refundedAmount` directly** |
| | **Create a from‑scratch/standalone invoice** (only `billRental` off a real rental) |
| | **Change roles / permissions / passwords**, hard‑delete, or **complete a WO** |

- The AI's `recordPayment` op routes through the **same** `postManualPayment` backend call as the human button (`app.js:10673`), so it inherits the cash/check enforcement, the balance cap, and the server `forbidden` gate — the AI gets no privileged money path.
- Consequential ops (billing, payments, bulk) are **staged for a human Apply**, never auto‑applied. (Open Q 11.18 — should the AI's `recordPayment` be *fully* gated behind a human Apply, never auto, even for a tiny amount?)

### 3.5 Pricing‑floor / margin visibility

Invoicing displays *prices*, not *margin/bottom‑dollar*. The `bottomDollar`/margin/cost gate lives in the pricing/`units-fleet` areas; **this area must never surface cost, margin, or bottom‑dollar on an invoice, a line item, the payment popup, or the customer‑facing print/PDF/quote doc.** The print doc is *customer‑facing* and the repo is public via Pages, so a leak here is both an internal‑margin leak and a public one. The invoice line `amount` is always the **sell price** (`unitRentalPrice` / `woBillable` output), never a cost basis. A future line‑item type (deposit, surcharge, write‑off) MUST be reviewed against this rule before it can render on the print doc. (Open Q 11.10 asks for a CI/test assertion that pins this so a future line addition can't leak it.)

---

## 4. Data Model

### 4.1 Invoice entity (`DATA.invoices`, seed `data.js:78`)

Schema‑less Sheets row mirrored as a JS object. Fields observed in live code/seed:

| Field | Owner | Type | Meaning |
|---|---|---|---|
| `invoiceId` | id | string | `invoiceId(iso, seq)` → e.g. `INV.06.07.26.001`; seed uses short `NNiDDMmYY`. **[2026-07-09] STALE EXAMPLE** — live format is now `##MMDDYY` (e.g. `228JY0826`, pill `228JY`), month‑first with a per‑month counter; legacy ids still parse (`invoiceShort`, `config.js:555`). See "Shipped status (2026‑07‑09)" above. |
| `customerId` | client | string | FK → customer (nullable on a fresh draft). |
| `rentalIds` | client | string[] | FKs → rentals billed (a series chunk lists one). |
| `date` | client | ISO | invoice date. |
| `dueDate` | client | ISO | `dueForCustomer(customerId)` (`app.js:3397`). |
| `po` | client | string | customer PO. |
| `lineItems` | client | object[] | see §4.2. |
| `amountPaid` | **server** | number $ | sync‑protected — total collected. |
| `paid` | server | bool | convenience. |
| `paidAt` | server | ISO | last payment. |
| `paymentMethod` | server | string | `Card` / `Cash` / `Check…` / `ACH`. |
| `payments` | server | object[] | `{ type, amountCents, at, checkNum? }` ledger. |
| `allocations` | client | `{lid:$}` | §19 per‑line PRE‑TAX paid split. |
| `refunded` | **server** | bool | fully refunded (`refundedAmount ≥ amountPaid`). |
| `refundedAmount` | **server** | number $ | running refunded total. |
| `refundAllocations` | client | `{lid:$}` | §19b per‑line refunded split (gated). |
| `locked` | server | bool | pricing sealed (lock/unlock via backend). |
| `taxExempt` | client | bool | invoice‑level exemption. |
| `covStart` / `covEnd` | client | ISO | series chunk window. |
| `covOf` / `contOf` | client | string | first‑rental / continuation‑of links. |
| `achProcessing` | server | bool | a pending ACH PaymentIntent. |
| `pendingPaymentIntentId` | server | string | for `checkAchStatus`. |
| `membership` / `membershipCancellation` | client | bool/obj | membership‑billed invoice. |
| `mock` | client | bool | created client‑side, not yet round‑tripped. |

### 4.2 Line item (`inv.lineItems[]`)

| Field | Meaning |
|---|---|
| `kind` | `rental` · `transport` · `extension` · `WO` · `Custom` (+ membership). |
| `ref` | source id (`rentalId` / `woId`); ref→record nav + unlink lock group key. |
| `unitId` | which unit (multi‑unit rentals). |
| `lid` | **stable per‑line id** (`lineLid()`); allocations key on this, NEVER the array index (indices shift on splice/No‑Show). |
| `label` | display string (unit · rate · tail). |
| `amount` | pre‑tax dollars. |
| `taxExempt` | per‑line tax suppression (transport/custom can be exempt). |

### 4.3 Card / bank on file (on the **customer**, see `customers-crm`)

`customer.cards[]` `{ id:'CARD-'+stripePmId, stripePmId, fingerprint, brand, last4, expMonth, expYear, nickname, isDefault, status, selfie, agreements[] }`; `customer.achAccounts[]` `{ id, stripePmId, setupIntentId, bankName, last4, accountType, holder, verified, mandate{signedAt,version,signature,selfie} }`; `customer.stripeId`. Detail spec: `2026-06-18-card-bound-agreements-design.md`.

### 4.4 Schema‑less / migration notes

- New fields are **additive** — `m({...})` defaults missing keys; readers tolerate absence (`Number(inv.amountPaid) || 0`).
- `lid` backfill is lazy: `lineKey()` stamps a `lid` on any line missing one.
- Any *new* money field (e.g. a write‑off marker, §11.6) must declare its **owner** (client‑synced vs server‑sync‑protected). Money totals stay server‑owned (#177).

---

## 5. Backend / Integration Contract

Backend = Google Apps Script + schema‑less Sheets, deployed by clasp (`Code.gs` gitignored). The single entry point is `backendCall(action, payload)`. **All money math is the server's; the client never invents a charge amount.**

### 5.1 Existing actions (observed in client calls — CANON)

| Action | Payload | Returns (applied via `applyPayment`) | Notes |
|---|---|---|---|
| `stripePubKey` | — | `{ ok, pubKey }` | client runs same mode as secret. |
| `stripeSetupIntent` | `{ customerId }` | `{ ok, clientSecret, stripeId }` | card‑on‑file. |
| `stripeSaveCard` | `{ customerId, paymentMethodId, setupIntentId }` | `{ ok, card:{ brand,last4,expMonth,expYear,fingerprint } }` | server verifies SetupIntent. |
| `stripeSetDefault` / `stripeRemoveCard` | `{ customerId, paymentMethodId }` | `{ ok }` | default / detach. |
| `stripeBankSetupIntent` | `{ customerId }` | `{ ok, clientSecret, stripeId }` | ACH. |
| `stripeSaveBank` | `{ customerId, paymentMethodId, setupIntentId }` | `{ ok, bank:{ bankName,last4,accountType } }` | |
| `stripeVerifyBank` | `{ customerId, setupIntentId, descriptorCode }` | `{ ok }` | micro‑deposit `SM…`. |
| `stripeChargeInvoice` *(via `chargeInvoiceFlow` `app.js:14557`)* | `{ invoiceId, amountCents, paymentMethodId? }` — **`amountCents` is `null` ⇒ charge the full balance**; a number ⇒ a cap‑validated partial. `paymentMethodId` is the picked card/verified‑bank Stripe PM (absent ⇒ server's default PM). | `{ ok, status:'succeeded'|…, amountPaid, paid, paidAt, paymentMethod, locked? }`, or `{ ok, processing, paymentIntentId }` (ACH initiated), or `{ ok, requiresAction, clientSecret, paymentIntentId }` (3DS). | **The client sends an amount, but the SERVER is authoritative — it re‑caps `amountCents` at the live balance and ignores any over‑cap value** (the north‑star contract, §1). 3DS → client `confirmCardPayment` → `stripeFinalizeInvoice` re‑verify. |
| `stripeFinalizeInvoice` | `{ invoiceId, paymentIntentId }` | `{ ok, amountPaid, … }` / `{ error:'ach-failed' }` | ACH settle/poll + 3DS re‑verify (after the client confirms the SCA challenge). |
| `recordManualPayment` | `{ invoiceId, amountCents, method:'cash'|'check', checkNum }` | `{ ok, amountPaid, paymentMethod, paidAt }` | server caps at live balance. |
| `stripeRefundInvoice` | `{ invoiceId, amountCents? }` *(**[2026-07-09] SHIPPED** — optional partial, was "today; full only")* | `{ ok, refunded, refundedAmount, refundedCents }` | card refund; `amountCents` omitted = full refund (legacy behavior kept). |
| `recordManualRefund` | `{ invoiceId, amountCents? }` *(**[2026-07-09] SHIPPED** — optional partial, was "today; full only")* | `{ ok, refunded, refundedAmount }` | cash/check refund; `amountCents` omitted = full refund. |
| `stripeLockInvoice` / `stripeUnlockInvoice` | `{ invoiceId }` | `{ ok, locked }` | pricing seal. |

### 5.2 Failure handling (CANON)

- Every flow uses `withTimeout` (30s server; **180s** for the interactive 3DS confirm `app.js:14377`) so a hung Apps Script call can't spin "Saving…" forever.
- **`backendCall` never throws on a backend error page** (`app.js:15658`): a GAS 500/quota/auth HTML body is not JSON, so it's parsed defensively into `{ ok:false, error:'http-NNN'|'bad-json' }` — a real card failure can never be masked as a generic "Network error," and a failure is *never* coerced into a success (#220).
- Typed server errors map to friendly copy via `friendlyPayErr` (`app.js:14186`): `card_declined`, `over-ceiling`, `consent-required`, `invoice-integrity`, `amount-mismatch`, `ach-failed`, `pm-customer-mismatch`, **`forbidden`** (caller's password is below money tier), `nothing-to-refund` (Phase 2), `stripe-not-configured`, …. Any unmapped `error` falls back to a generic retry toast.
- `live()` guard: every async flow bails its mutation/toast if the overlay closed mid‑flight (so a slow charge can't write into a since‑closed/replaced overlay).
- **Integrity gate:** the server rejects `invoice-integrity` if a locked invoice changed since lock; `amount-mismatch` if the charge total drifted during payment (a benign re‑price race surfaces as a flag, not a wrong charge).
- **Authority gate:** every money action re‑derives the caller's tier from the call password and returns `forbidden` for a non‑money caller — the same gate, server‑side, regardless of what the client rendered.
- **Concurrency:** the refund handlers (and any money mutation) take a `LockService` script lock so two simultaneous taps/devices serialize against the same invoice row (prevents a double‑refund / lost‑update on the shared Sheet).

### 5.3 ~~Proposed~~ SHIPPED ADDITIVE actions (partial refunds)

> **[2026-07-09]** This section was written when `PARTIAL_REFUNDS_ENABLED` was `false`; the
> flag is now `true` (`app.js:6702`) and the contract below is the LIVE contract, not a
> proposal — see "Shipped status (2026‑07‑09)" above. Left otherwise unchanged since the
> mechanics described (clamp, lock, ledger write) still match `docs/handoffs/partial-refunds-backend.md`.

To flip `PARTIAL_REFUNDS_ENABLED` true, two existing actions learn an **optional** `amountCents` (backward‑compatible — `0`/absent ⇒ legacy full refund of the whole remaining). The full server‑side contract is specced in `docs/handoffs/partial-refunds-backend.md` (the deploy‑by‑clasp handoff) and the design `2026-06-23-invoice-partial-refunds-design.md`:

```
recordManualRefund({ invoiceId, amountCents? })   // cash/check partial
stripeRefundInvoice({ invoiceId, amountCents? })   // card → Stripe partial refund (Stripe refunds support a partial `amount`)
```

Both handlers run the **identical cent‑accurate clamp under a `LockService.getScriptLock()`** (serializes concurrent refunds on the same invoice):

```
paidCents      = round(amountPaid     * 100)
prevCents      = round((refundedAmount||0) * 100)
remainingCents = paidCents − prevCents
if remainingCents <= 0           → { ok:false, error:'nothing-to-refund' }
req            = round(amountCents || 0)          // 0/absent → full remaining
refundCents    = req > 0 ? min(req, remainingCents) : remainingCents   // server RE-CAPS an over-cap request
refundedAmount = (prevCents + refundCents) / 100
refunded       = (prevCents + refundCents) >= paidCents − 1            // fully refunded within a cent
// amountPaid is KEPT (settled model → balance stays $0)
```

- **Server validates + re‑caps** `amountCents ≤ remainingCents` in **integer cents** (never floats), so a client‑invented over‑cap is clamped, not honored; a zero‑remaining invoice is rejected `nothing-to-refund`.
- **Audit trail (server‑written):** each refund event appends to `inv.payments[]` (`{ type:'manual-refund'|'stripe-refund', amountCents, at, role }`) and to the server **ledger sheet** (`[at, invoiceId, customerId, −refundCents, '', role, 'manual-refund']`) — the `role` is derived from the call's password, so the ledger records *who* refunded. (Supports Open Q 11.3's reason‑code ask and the `accounting` reconciliation.)
- Returns `refundedCents` (THIS event, for the history line) + `refunded` + `refundedAmount` + `amountPaid`; `status:'partial-refund'` while `< amountPaid`, `'refunded'` when full.
- Per‑line split (`refundAllocations`) is **client‑owned** + synced exactly like `inv.allocations`; the **server never reads or writes it** (it owns only the money totals). (Open Q 11.1, 11.8.)

### 5.4 External integrations

Stripe (cards, ACH, refunds, 3DS). Google Maps feeds transport *pricing* upstream (priced into `transport` lines, not a payment integration). No QuickBooks/Xero/accounting export here — that's the `accounting` area, layered above (roadmap §5).

---

## 6. UX / UI — yard data‑plate language

> **[2026-07-09] ARCHITECTURE CHANGE — read this before the paragraph below.** The standalone
> Invoices grid card is **retired**; `'invoices'` no longer sits in `config.js` `COLUMNS.right`/
> `COLUMN_OF` (the `GRID_CARDS` catalog entry + `DETAIL.invoices`/`ROW_META` are kept for the
> flag/status‑pill system, just not as a navigable column). Invoices now render inside a
> scrollable `customerInvoicesSection` embedded in **Customer Details**, reached via
> `pillTo('invoices')` → `openInvoice()`. See "Shipped status (2026‑07‑09)" above for the full
> mechanism. The design‑language description below (steel panels, orange accent, rivets,
> hazard stripe, payment popup) is still accurate for the content — only its host surface moved.

Surfaces live on the **Invoices** grid card (`config.js GRID_CARDS` id `invoices`) and one popup (`payment`). Design language: dark steel panels, **one** safety‑orange `--accent #ff7a1a` accent reserved for the primary ignition action (here: **Take payment / Charge**), corner rivets, **Saira Condensed** stamped labels, hi‑vis hazard stripe for danger (refund/abort), subtle leather‑tan saddle‑stitch divider + wrangler voice in copy.

### 6.1 Invoice row / detail (existing, canon)

> **[2026-07-09]** Written for the standalone card; the same content now renders inside the
> embedded `customerInvoicesSection` accordion rows via `invoiceDocHtml(inv, {interactive:true})`
> instead of a dedicated grid‑card row. Status pill, ledger block, money‑actions row, line
> editing, lock state, and series chips described below are all still live as described.

- **Status pill** keeps the lifecycle/aging label and takes the **flag color** (R/Y/G, flag‑color‑system §7.4). `Refunded` → gray (archived). Pill stamped `data-r="R1"` (status pill rule).
- **Ledger block** (`ledgerRow`): Subtotal · Tax (10.75% or "Exempt") · Total · Paid · Balance.
- **Money actions row** (Office/Admin only, `canMoney()`): `Take payment` / `Pay ` / `Pay balance ` (orange `actionPill('money', …)`), with the default card label muted beside it.
- **Line editing** (unlocked): add‑buttons `Rental` / `WO` / `Custom` (`addBtn`, stamped `data-r="R5"`), `🔒 Lock price` (`actionPill('commit', …)`), `Merge invoice`.
- **Locked state:** "🔒 Pricing locked." + `Unlock to edit` (Office/Admin). Locked blocks line edits, drops, and extension auto‑bill.
- **Series chips:** `Cont. of …` ref‑pill (R2) links a continuation back to the first chunk.
- **Ranch‑twist copy** is already live in the print footer ("much obliged… give the yard a holler") and SMS ("your quote… is ready").

### 6.2 Payment popup (`kind:'payment'`, WINDOW_CATALOG `Take Payment`, `app.js:9729/9825`)

One popup with three modes — **Charge** (card on file), **Record** (cash/check), **Refund**:

- **Charge / allocation:** when >1 line, the **Apply to line items** allocation section (`allocSectionHtml`) shows per‑line `/ remaining` + a `$` input; a `Pay in full` shortcut (`R5b`); a live foot read‑out `pre + tax = gross · charge (balance)` and a `Charge $X` orange button. Live DOM recompute keeps focus (no re‑render).
- **Record (cash/check):** amount field (exact cents, capped at balance), check‑number field for checks, `Record payment` button.
- **ACH processing banner:** "🏦 ACH payment processing…" + `Check ACH status` (`R17`).
- **Refund:** today a single full‑invoice `Refund` danger action. When `PARTIAL_REFUNDS_ENABLED` flips on, the mirror **Refund by line item** section (`refundSectionHtml`) appears — per‑line `paid` / `↩ refunded` tallies, capped `$` inputs, `Refund in full` shortcut, `Refund $X`. Danger actions ride the **red hazard variant**, not orange.
- States: **busy** (buttons disabled + label "Saving…/Charging…/Recording…"), **error** (`o.error` inline + loud toast), **empty** ("Nothing is due on this invoice").

**R‑rulebook + WINDOW_CATALOG:** the `payment` popup is **already catalogued** (`WINDOW_CATALOG`, `app.js:9825`) and its controls already carry `data-r` stamps (R5/R5b/R17). **Any new** control (e.g. a write‑off button, a "Send invoice" server action) MUST get a `data-r` stamp and, if a NEW popup, a `WINDOW_CATALOG` entry — or `ci/gen-rule-usage.mjs --check` and `ci/check-window-catalog.mjs` fail CI. No silent additions.

### 6.3 Mobile reflow

The 3‑column yard grid reflows per `2026-06-14-mobile-adaptive-design.md`; the payment popup becomes a bottom sheet. Allocation rows must stay tap‑legible at phone width (the `$` input is the hit target). Reduced‑motion + visible‑focus are the quality floor.

### 6.4 Add‑card / Add‑bank / Verify‑ACH popups (existing)

`addCard`, `addAch`, `verifyAch` — all catalogued, all Office/Admin gated. The Stripe Card Element mounts into `#sl-card-element` (DOM‑driven, never wiped mid‑entry); the signing tab captures selfie + signature per card (`card-bound-agreements`).

---

## 7. Business Rules / Derivations / Money

### 7.1 Totals (CANON — `invoiceTotals`, exact cents)

```
subtotal = Σ li.amount
exempt   = inv.taxExempt || customer.salesTaxExempt
taxBase  = exempt ? 0 : Σ (li.taxExempt ? 0 : li.amount)        // per-line exemptions honored
tax      = round(taxBase * 0.1075, cents)                        // NEVER round to whole dollar
total    = subtotal + tax
paid     = inv.amountPaid
balance  = total − paid
```
The exact‑cent rule is load‑bearing: `$500 @ 10.75% = $53.75`, not `$54` — rounding up overcharges.

### 7.2 Aging / status derivation (CANON)

```
if inv.refunded                         → 'Refunded'   (gray/archived)
else if total>0 && paid>=total          → 'Paid'       (green)
else if paid>0                          → 'Partial'    (yellow)
else if dueDate>TODAY                   → 'Not Due'     (yellow)
else daysPast = dayDiff(due, TODAY):
   >=120 'Collections' | >=90 'Late+90' | >=60 'Late+60' | >=30 'Late+30' | >=1 'Late' | else 'Unpaid'  (all red)
```

### 7.3 Per‑unit line generation

`rentalLineItems(r)` emits one `rental` line per **non‑voided** unit, priced by that unit's own category over the shared window (`unitRentalPrice`). `transportLineItems(r)` emits one `transport` line per unit with a non‑Self journey. Voided (No‑Show/Cancel) units are not billed.

### 7.4 28‑day series + extensions (CANON, `APP-05`)

- An invoice bills **≤28 rental‑days per unit** (`INV_CAP_DAYS`); longer rentals split into a series of chunk invoices (`createContinuationInvoice`, `covStart/covEnd/contOf`). Because the 4‑Week rate IS 28 days, the cheapest‑blend optimizer seams at 28‑day marks, so the split bills the **same total** — purely organizational.
- **Retroactive Rental Pricing** (`company.retroactivePricing`, default ON, `retroPricingOn()`): ON ⇒ extension `delta = rentalPrice(full new window) − alreadyBilled` (a week rolls into a month); OFF ⇒ extension is a fresh rental of just the added days.
- **Positive deltas only** (`isWindowExtension`). A shortened/moved window is a refund decision, kept manual (refund‑first). `previewExtensionDelta` is a pure, non‑mutating mirror of `billExtension`, kept in lockstep by `ci/logic-test.mjs` (the preview MUST equal the posting).

### 7.5 Payment allocation (CANON — §19)

`allocCharge` resolves gross from the per‑line PRE‑TAX inputs `o.alloc`, caps each at the line's remaining and the invoice balance, adds tax on the taxable share, and the gross is `min(pre+tax, balance)`. The split accumulates into `inv.allocations` (client‑owned) via `applyPayment`; money totals come back from the server.

### 7.6 Refund model (CANON + gated)

- **Settled model:** a refund **never re‑bills**. Refunding $40 of a fully‑paid $100 invoice returns $40 and leaves the **balance at $0** (it does NOT spring a balance back — the #116 bug). `amountPaid` is unchanged; `refundedAmount` accumulates; `refunded = refundedAmount ≥ amountPaid`.
- `itemPaid` / `itemRefunded` / `itemRefundable` mirror each other; a fully‑refunded line drops out of both panels and "locks by absence."
- Cash/check refund → `recordManualRefund`; card → `stripeRefundInvoice`. Server owns totals (sync‑protected, #177).

### 7.7 Merge (CANON)

`invoiceMergeable(i)` = has a customer, **not** locked, **not** refunded, **not** ACH‑processing, and `amountPaid === 0`. Merge folds another mergeable invoice **for the same customer** into the keeper (lines move over; original removed). Restricting to $0‑paid avoids re‑allocating settled money.

### 7.8 Edge cases (money)

- Exempt customer **and** exempt line → no double‑count (taxBase already 0).
- Overpay impossible: manual capped server‑side at balance; charge gross capped at balance.
- Cents drift mid‑payment → server `amount-mismatch` (flagged for review).
- A locked invoice that changed → server `invoice-integrity` (must unlock/review/re‑lock).

---

## 8. Phasing & Milestones

Maturity = **shipped**, so phasing is about *closing the parked edges*, not greenfield.

**Phase 1 — Documentation‑as‑canon (this spec).** Ratify the live behavior above. No code. In scope: §2–§7 as the single source of truth. Out of scope: any behavior change.

**Phase 2 — Ship partial refunds (flip `PARTIAL_REFUNDS_ENABLED`). [2026-07-09] SHIPPED.** Deploy the additive backend (`amountCents` on both refund actions, server‑validated), then flip the flag. In scope: per‑line refund UI (already built), refund netting on the rental/unit (strikethrough marker), audit log. Out of scope: any payment‑side change. — **Done**: flag is `true` live (`app.js:6702`); see "Shipped status (2026‑07‑09)" above for the one open caveat (no tracked deploy‑verification writeup).

**Phase 3 — Invoice delivery & dunning (candidate).** Server‑side invoice send (PDF + delivery receipt) and aging‑driven reminders. **Cross‑area** with `comms-notifications`. Out of scope for v1 unless Jac pulls it in.

**Phase 4 — Write‑off / bad‑debt + collections workflow (candidate).** A terminal `Written Off` status to retire uncollectable invoices without a refund. (Open Q 11.6.)

**Explicit v1 OUT‑of‑scope:** customer self‑pay portal, auto/scheduled charging, QuickBooks/Xero export (that's `accounting`), multi‑currency, surcharge/convenience fees, deposits/holds.

---

## 9. Acceptance Criteria

Phase‑1 (canon ratification) is met when this doc accurately matches code at the cited anchors; reviewers can verify each §2.1 row against the line numbers.

For any code change (Phase 2+):

1. `node ci/smoke.mjs` and `node ci/logic-test.mjs` pass (port 9147 swap per CLAUDE.md). `logic-test` must keep `previewExtensionDelta` ≡ `billExtension` and assert the totals/tax/aging tables in §7.
2. `node ci/gen-rule-usage.mjs --check` passes — every new/changed control carries a unique `data-r` stamp.
3. `node ci/check-window-catalog.mjs` passes — any added/removed popup updates `WINDOW_CATALOG`.
4. `node tools/gen-code-map.mjs --check` passes — any new/moved/retitled chapter banner regenerates the Code Atlas.
5. **Money invariants under test (`ci/logic-test.mjs`):** exact‑cent tax (`$500 → $53.75`, never `$54`); per‑line + invoice + customer exemption all zero the tax base without double‑counting; overpay impossible (manual + charge both cap at balance); refund never springs the balance back (#116); merge gated to `amountPaid===0` AND same customer AND not locked/refunded/ACH‑processing; `lid`‑keyed allocations survive a line splice/No‑Show without orphaning.
6. **Gate invariants (manual review + any test harness that can mock a role/password):** below‑money‑tier renders **no** money control (render gate); a forced/forged money handler call re‑checks `canMoney()` and no‑ops; the server returns `forbidden` for a non‑money call password (the authoritative gate — can't be unit‑tested against live Stripe, so it's a deploy‑verify on a staged non‑money password, documented in the partial‑refunds handoff style). The customer‑facing print/PDF/quote contains **no** cost/margin/`bottomDollar` token (Open Q 11.10 — add a string‑scan assertion over the print template).
7. **AI money fence (`wrangler-ai`):** the `apply_changes` validator rejects any op that would charge/refund/touch a balance/change a password (§3.4); `recordPayment` only ever reaches `postManualPayment` with `method ∈ {cash,check}`; `billRental` builds from the pricing engine and never carries client‑supplied amounts.
8. **Partial refund (Phase 2):** with the flag ON and the additive backend deployed, a partial refund of one line grows `refundedAmount` by exactly the refunded cents, leaves `amountPaid`/balance unchanged, returns `status:'partial-refund'` while `< amountPaid`, flips `Refunded` when the remainder is refunded, and the server **re‑caps** an over‑cap `amountCents` (rejects `nothing-to-refund` on a zero‑remaining invoice) — verified on a real test invoice per the handoff before the flag flips.
9. **No new CI chapter drift:** if a money flow's chapter banner moves/retitles, `node tools/gen-code-map.mjs --check` is regenerated.
10. Cache‑bust `?v=` token bumped on deploy (`style.css`/`rule-usage.js`/`app.js` in `index.html`).

---

## 10. Risks & Edge Cases

| Risk | Mitigation (live or proposed) |
|---|---|
| **Shared backend over‑refunds real money** if partial flag flips before backend ships | `PARTIAL_REFUNDS_ENABLED=false` default; flip ONLY after deploy + handoff (`docs/handoffs/partial-refunds-backend.md`). |
| **Money written client‑side reverts on sync** | Money totals are server‑owned / sync‑protected (#177); client must apply server result via `applyPayment`, never write `amountPaid` directly. |
| **Index‑keyed allocation orphans on splice** | Allocations key on stable `lid`, never array index. |
| **3DS / hung Stripe call** spins forever | `withTimeout` (180s interactive, 30s server) + `live()` guards. |
| **Wrong‑card charge across sessions** | Card id anchored to globally‑unique Stripe PM id, not per‑session seq. |
| **Locked invoice charged after edit** | Server `invoice-integrity` rejection. |
| **Multi‑user concurrent payment / double‑refund** | Server is authoritative + caps at live balance; the refund/money mutations take a `LockService` script lock so two devices serialize against the same invoice row (no lost‑update on the shared Sheet); client cap is advisory only. |
| **Offline / demo (`#local`)** | No `backendPassword` ⇒ UI shown, no real money; `mock:true` records re‑sync. A money tap with no backend can't reach Stripe. |
| **Stale read → wrong‑balance charge** | The polling refresh (`backend-data`) re‑syncs; the server re‑resolves the live balance at charge time, so a client showing a stale balance still can't over‑ or under‑charge (server caps + `amount-mismatch` flag on drift). |
| **Backend error page masked as success** | `backendCall` parses defensively (`app.js:15658`) → `{ok:false,error}`, never coerces a failure to success (#220); a card failure surfaces as the real typed error. |
| **PII / PAN leak** | PAN/CVC + ACH numbers never reach our code; only tokens/last4 stored; secret key backend‑only; agreement media offloaded to Drive by reference; repo is public via Pages. |
| **Margin/cost leak onto an invoice or public print doc** | Invoices show **sell price** only; print/PDF/quote must not carry cost/margin/`bottomDollar` (Open Q 11.10 + a CI string‑scan assertion). |
| **AI agent moves/leaks money** | Hard money fence in the `WRANGLER_SYSTEM` prompt AND the `apply_changes` validator (§3.4): no card charge, no ACH, no refund, no balance write, no password change; consequential ops stage for human Apply. |
| **Refund tax under/over‑refunded** | Refund split is PRE‑TAX per line with tax on top, mirroring payment; the server refunds the **gross** (pre+tax) cents it computes, never the bare pre‑tax (Open Q 11.8 pins this). |
| **Forged tier / spoofed front‑end** | The wire carries the role **password**, not a `role` string (`app.js:15652`); a console‑forced UI can't manufacture a money‑tier password, and the server gate rejects `forbidden`. |

---

## 11. Open Questions

> **Resolved 2026-06-29:** Q1 → D1 (keep parked; ship only via a validated clasp deploy) · Q2/Q15/Q3/Q16 → D2 (dual-approver refund Settings toggle + reason) · Q6/Q14 → D3 (no new statuses; bad-debt Write-off deferred to `accounting`) · Q11/Q12/Q20 → D4 (deposit + surcharge as default-off Settings toggles). Adopted: Q5 (Settings value), Q9 (keep blocked), Q10 (CI margin-scan), Q18 (AI payment always needs human Apply), Q19 (auto-lock paid). Q17/Q7 stand. See the Decisions block up top.

1. **Ship partial refunds now?** ~~The UI is built and gated.~~ **[2026-07-09] RESOLVED / SHIPPED** — `PARTIAL_REFUNDS_ENABLED = true` live; backend deployed per `docs/handoffs/partial-refunds-backend.md`. Flip `PARTIAL_REFUNDS_ENABLED` after deploying the additive `amountCents` backend — or leave parked? Trade‑off: real customer value vs. the shared‑backend over‑refund risk until the server validates the cap.
2. **Refund authority.** Should refunds (especially > $X, or a *full* refund) require **manager+** tier rather than the same `money` tier as taking a payment? Trade‑off: friction vs. blast radius of an erroneous/abusive refund. (Today refund == money tier.)
3. **Refund reason + audit.** Capture a required refund **reason** code/note (logged) before confirming? Helps the future `accounting` reconciliation and dispute defense; adds a field + a UI step.
4. **Aging reminders / dunning.** Should `Late/Late+30/60/90/Collections` trigger automated customer reminders, or stay a passive color? Owner is `comms-notifications`, but the *trigger* is this area's aging. Decide ownership of the cadence.
5. **Collections threshold.** `Collections` fires at **120 days** past due (hard‑coded `invoiceTotals`). Make it a Settings → Company value, or keep fixed?
6. **Write‑off / bad‑debt status.** Add a terminal `Written Off` (gray, like Refunded) to retire uncollectable invoices without a refund? It changes the status enum, the flag catalog, and KPI revenue netting (`financials-kpi`).
7. **Server‑side invoice delivery.** Replace the `mailto:`/`sms:` deep links with a backend send (PDF attachment + delivery receipt)? Pulls in email infra + a new action; today's deep links need no server but can't attach a PDF or confirm receipt.
8. **Partial‑refund tax handling.** Refund split is PRE‑TAX per line, tax riding on top (mirrors payment). Confirm the server refunds **gross** (pre+tax) and never the bare pre‑tax — over/under‑refunding tax is a real‑money error.
9. **ACH verification UX.** Banks land `verified:false` ("store now, verify later"). Should an *unverified* bank be chargeable at all, or hard‑blocked until the `SM…` code verifies? (Today charging is gated on `verified`.)
10. **Margin on the print doc.** Confirm the customer‑facing print/PDF + quote summary must NEVER show cost/margin/bottom‑dollar — and add a CI/test assertion so a future line addition can't leak it.
11. **Surcharge / convenience fee.** Pass Stripe processing fees to the customer as a line (legal in LA?), or absorb? Affects `invoiceTotals` and tax base.
12. **Deposits / security holds.** Heavy equipment often takes a damage deposit. Model as a non‑revenue hold (Stripe manual capture) or a refundable line item? Currently absent.
13. **Merge of partially‑paid invoices.** Today merge requires `amountPaid===0`. Is there a real need to merge a partially‑paid invoice (re‑allocating settled money), or is the $0 constraint permanent?
14. **Invoice voiding.** There is no "void an invoice" path distinct from refund/merge. Is one needed (e.g. a mistaken draft that was never sent), and what status does it take? Trade‑off: a `Void` terminal status (gray, like `Refunded`, but with **no money movement**) cleanly retires a never‑paid mistake without a refund record polluting the ledger — but it adds a status to the enum + flag catalog + KPI netting, and an audit question (who can void a $0 vs. a partially‑paid invoice?). A void on a *paid* invoice must be blocked (that's a refund).
15. **Step‑up re‑auth on money actions.** Today the money gate is the *session* password (the role password captured at login) — once an Office user is signed in, every Charge/Refund goes through with no further prompt. Should a high‑blast‑radius action (any refund, or a charge/refund over `$X`) require a **fresh password re‑entry** (step‑up), independent of the session, so a walked‑away unlocked device can't be used to move money? Trade‑off: real protection against an unattended terminal in a busy yard vs. friction on the most common office task. (Interacts with 11.2 refund authority.)
16. **Audit reason capture is server‑written but client‑optional.** The server already stamps `role`+`at` on every `payments[]` / ledger entry. Should the *client* additionally be **required** to attach a structured reason on a refund/void/manual‑adjustment (vs. free‑text or nothing)? Pins 11.3 to a concrete enum and a required UI step; the trade‑off is a mandatory field on a path that's sometimes a fast "machine came back early, refund the day."
17. **Manual payment method enum is hard‑limited to cash/check.** `recordManualPayment` enforces `method ∈ {cash, check}` both client‑ and server‑side (`app.js:10638`). Do we need a third manual method (wire/ACH‑by‑hand/"other") for money that arrives outside Stripe, or does that risk an un‑reconciled hole vs. the Stripe path? (Affects the `paymentMethod` enum and `accounting` reconciliation.)
18. **AI `recordPayment` auto‑apply vs. always‑Apply.** Mr. Wrangler can `recordPayment` (cash/check, server‑capped) — staged for a human Apply for consequential cases today. Should *every* AI‑initiated payment require an explicit human Apply (never auto), since it moves money on the ledger even if capped? Trade‑off: one‑tap "log the cash Cameron just handed me" speed vs. a hard rule that no money event ever lands without a human confirming the AI read it right. (Charges/refunds are already fully fenced off from the AI — §3.4.)
19. **Lock authority + auto‑lock on payment.** Lock/unlock is `money` tier today; `stripeChargeInvoice` can return `locked` (a paid invoice may auto‑lock). Should a *paid* invoice **auto‑lock** to prevent post‑payment line edits drifting the total, and should *unlock* require manager+ (vs. the same money tier that locked it)? Trade‑off: protects a settled total from a later edit vs. office friction re‑opening a genuinely wrong line.
20. **Surcharge/deposit tax + margin interaction.** If 11.11 (surcharge) or 11.12 (deposit) lands, each new line type must declare (a) taxable vs. exempt, (b) whether it counts toward revenue/KPI netting, and (c) that it carries **no cost/margin** onto the print doc (§3.5). Resolve these per‑type before any such line can render.

---

## 12. Dependencies & Sequencing

**Upstream (must price/produce before invoicing bills):**
- `rentals-dispatch` — the priced rental window + per‑unit journeys feed `rentalLineItems`/`transportLineItems`; the extension/window‑edit flow triggers `billExtension`.
- `units-fleet` / `automated-pricing` — `rentalPrice` cheapest‑blend + per‑unit category rates.
- `maintenance-shop` — billable WO lines (`woBillable`, drag‑to‑invoice) become `WO` line items.
- `memberships` — membership‑billed invoices (`membership`, cancellation) and member rate/$0‑transport gates.
- `customers-crm` — card/bank on file, exemption flag, `dueForCustomer`, customer isolation.

**Downstream (consume invoicing output):**
- `financials-kpi` — revenue/aging rollups read `invoiceTotals`; partial refunds must net revenue.
- `accounting` — the expense/P&L/QuickBooks layer sits **above** invoicing; export is its concern, not this area's.
- `comms-notifications` — aging‑driven reminders + invoice delivery channel.
- `backend-data` — the GAS `backendCall` entry point + sync‑protected money fields (#177).

**Sequencing for Phase 2 (partial refunds):** (1) deploy additive backend (`amountCents` validation) via `/clasp` with the STOP gate; (2) verify on a test invoice; (3) flip `PARTIAL_REFUNDS_ENABLED`; (4) bump `?v=`; (5) confirm `financials-kpi` netting. Do NOT flip the flag before step 1 lands (shared backend).
