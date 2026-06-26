# Mr. Wrangler — Full Action Parity Design

**Date:** 2026-06-26
**Status:** Approved design — pending spec review before implementation
**Owner:** Jac
**Origin:** "Add a unit named Termite" was refused because Mr. Wrangler can only
create customers. Jac's direction: *Mr. Wrangler should be able to do anything a
money-permission user can do, except actually charge a credit card or run an ACH.*

---

## 1. Goal

Expand Mr. Wrangler's write surface from its current tiny safe-fields allowlist
(customers create-only; units/categories/rentals edit-only) to **full parity with
a money-permission operator** — creating, editing, and cancelling across every
business entity, billing, full rental flows, and settings — while preserving the
existing safety model and hard-blocking the few things even a money-user shouldn't
hand to an AI.

This is **not** a new UI surface. It rides the existing Mr. Wrangler dock and its
`wrangler-action` → preview → **Apply** pipeline. The work is widening that
pipeline's contract, validation, and apply layer.

## 2. The four boundary decisions (settled)

| Decision | Ruling |
|---|---|
| **Money line** | Only the two electronic rails are blocked: **charging a saved card** and **running an ACH**. Everything else a money-user can do is allowed — create/edit invoices, edit category rates & pricing, apply discounts, and record **cash/check** payments and refunds. |
| **Settings** | **DROPPED for Wrangler** (Jac, 2026-06-26). Settings persistence is gated behind the **admin password** (`setConfig` requires `adminPw`), which Wrangler must never hold — so settings stay in the admin screen, not in Wrangler. (Originally scoped as "all settings except auth"; the persistence gate makes Wrangler the wrong tool for any of them.) |
| **Destructive** | **Cancel only** (the reversible "removal" the app already models — cancel a rental, cancel a WO, retire a unit). **No permanent/hard delete.** Note: **invoices are NOT voidable** (Jac, 2026-06-26 — the app has no void concept), so there is no invoice-void operation. |
| **Composite ops** | **Full flow replication** — Wrangler drives multi-step flows end-to-end (e.g. start a rental incl. agreement + transport, bill a rental), stopping only at the e-payment. |
| **Rollout** | **Safe stages** — ship in risk order; each stage proven before the next. |

## 3. The write model — a `wrangler-action` block is the only thing that writes

> A `wrangler-action` block is the ONLY thing that triggers a write — Mr. Wrangler
> can never save by talking.
>
> **Apply is conditional, not 100% of the time (Jac, 2026-06-26).** A simple, single,
> safe edit (add one unit, fix a phone) applies the moment Wrangler emits the block —
> no Apply tap. The **preview → Apply** gate is reserved for the *consequential* ones:
> **bulk imports, money-sensitive changes (rates/pricing), named operations
> (billRental, payments…), and multi-record plans.** `wrPlanNeedsApply()` is the
> single decision point; the e-rail/auth/allowlist fences below apply either way.

This is the existing safety model (`app.js` §18, `applyWranglerData` at ~10252) and
it is **load-bearing** — the expansion scales it, never bypasses it.

## 4. Architecture — Hybrid (declarative ops + named operations)

The model keeps emitting a single `{"action":"data", ...}` block. Underneath, an op
is one of two kinds:

### 4a. Field-write ops (the bread-and-butter)
The existing shape, widened: `{op, entity, fields|rows|id}` over an expanded
`WR_EDITABLE` allowlist. Used for create / update / cancel on standalone entities
(units, vendors, parts, categories, customers) and simple field edits anywhere.

```jsonc
{"op":"create","entity":"units","fields":{"name":"Termite","categoryId":"…"}}
{"op":"update","entity":"vendors","id":"VEN-12","fields":{"phone":"…"}}
{"op":"cancel","entity":"rentals","id":"R-104"}            // reversible cancel, not delete
```

### 4b. Named operations (composite / money flows)
A new op verb `operate` dispatches to a **vetted handler** that calls the app's
*real* flow functions — the exact code path the human UI runs — so side-effects,
validation, pricing math, and guards are identical to doing it by hand.

```jsonc
{"op":"operate","name":"startRental","params":{"unitId":"U007","customerId":"C-3","start":"…","end":"…","transport":"…"}}
{"op":"operate","name":"createInvoice","params":{"customerId":"C-3","lines":[…]}}
{"op":"operate","name":"recordPayment","params":{"invoiceId":"INV-…","method":"cash|check","amount":…}}
{"op":"operate","name":"updateSetting","params":{"path":"company.name","value":"…"}}
```

Rationale: field-writes are clumsy for multi-entity flows (a rental touches the
rental record, pricing, agreement, transport); a named operation that wraps the
real handler keeps **one source of truth** for that logic and prevents a divergent
AI-only code path. Simple entities don't need that ceremony, so they stay
declarative. One contract the model sees; two mechanisms underneath.

### 4c. Why not "extend data-ops only" or "operation-registry only"
- *Data-ops only (A):* can't cleanly express the full rental/agreement flow without
  re-implementing it as field-sets — a second, drift-prone copy of business logic.
- *Operation-registry only (B):* forces every trivial field edit through a named
  wrapper and a big up-front headless-handler refactor before anything ships.
- *Hybrid (C, chosen):* simplest path for the 80% (field-writes) + correctness for
  the 20% (named ops), and it decomposes into shippable stages.

## 5. The hard blocks — defense in depth

Three things are **never exposed to the model AND re-blocked at the apply layer** as
a backstop (so even a malformed/hallucinated op can't slip through):

1. **Charge a saved card / run an ACH** — no `chargeCard`/`runACH` operation exists
   in the registry; the apply layer rejects any op whose effect is an electronic
   charge. Cash/check payment + refund recording are allowed (they don't move money
   through a rail — they record a settlement).
2. **Auth settings** — `updateSetting` rejects any `path` under roles / permission
   tiers / passwords. These keys are also absent from the settings allowlist.
3. **Hard delete** — no `delete` op verb exists; only `cancel`, which sets the
   app's existing reversible flags (e.g. `rental.cancelled`, `wo.cancelled`,
   unit retired), never splices a record out of `DATA`. Invoices have no
   void/cancel concept in this app, so there is no invoice-removal operation.

The system prompt states the two "can't" items plainly; the validation + apply
layers enforce them regardless of what the model emits.

## 6. Components to change

| Layer | File / anchor | Change |
|---|---|---|
| **System prompt** | `WRANGLER_SYSTEM` (`app.js:9867`) | Rewrite the "ACTING ON DATA" section: describe the broad new powers, the `operate` op, and the two hard "can't"s (e-rails, auth) + no-delete. Keep the preview/Apply framing and the "never claim a save you didn't emit" rule. |
| **Allowlist** | `WR_EDITABLE` (`app.js:10142`) | Add every entity (vendors, parts, invoices, work orders, settings) with `create`/`update`/`cancel` flags + per-entity safe-field lists. Flip `create:true` where now allowed. Money/pricing fields now permitted; auth keys never listed. |
| **Index map** | `WR_IDX` (`app.js:10148`) | Add `vendors`, `parts`, `invoices`, `workOrders` → their `IDX.*` maps. |
| **Validation** | `wrValidatePlan` (`app.js:10175`) | Handle new op verbs (`cancel`, `operate`); validate `operate` params against each operation's contract; enforce the §5 blocks. |
| **Apply / dispatch** | `applyWranglerData` (`app.js:10252`) | Replace the customers-only create branch with a per-entity dispatch table; route `operate` ops to their vetted handlers, which call the app's **real** functions (rental create ~`14273`, invoice create, `openPayInvoice`/`refundInvoiceFlow`, cancel-rental `~12221`, vendor/part create). |
| **Preview summary** | `wrPlanSummary` (`app.js:10240`) + dock preview (`app.js:7608`+) | Render the richer ops in human terms ("start rental · U007 for C-3", "record $420 cash payment", "invoice rental R-104"). |
| **Operations registry** | new, near §18 | A small map: `name → { validate(params), summarize(params), apply(params) }`. Each `apply` is a thin wrapper over the existing handler. The registry IS the exposed surface; anything not in it can't run. |

## 7. Rollout stages

Each stage keeps the **same contract** (§4) and the **same invariant** (§3); risk
rises per stage, so they're vetted and shipped in order.

1. **Stage 1 — Everyday records.** create/update/cancel for units, vendors, parts,
   categories; customers gain cancel. Pure field-writes + reversible cancel. Lowest
   risk; unblocks the original "add a unit named Termite" ask immediately.
2. **Stage 2 — Billing.** `createInvoice` (+ lines), edit pricing/rates/discounts,
   `recordPayment` (cash/check). Money-sensitive — e-rail block proven here.
   (Refunds and invoice-void are out — see §0 addendum below.)
3. **Stage 3 — Rentals.** `startRental` creates a **Reserved booking** (customer +
   units + window + optional transport), priced by the engine, with the human-flow
   gates (fleet-Active, blacklist, overbooking, valid window). Rental billing reuses
   `billRental`. **The agreement *signature* stays a human step** (an AI can't sign
   for the customer), and going truly "On Rent" uses the existing invoice /
   start-logging flow — so "full flow" here means *everything up to* those two
   inherently-human/handoff points, not replacing them. The composite-flow proof.
4. **Stage 4 — Settings. DROPPED (Jac, 2026-06-26).** Settings persistence is gated
   behind the admin password (`setConfig` requires `adminPw`), which Wrangler must
   never hold. Settings stay in the admin screen — Wrangler is the wrong tool for
   them. Stages 1–3 deliver the full intended surface.

## 8. Testing & gates

- **Logic tests** (`ci/logic-test.mjs`): extend with Wrangler-action cases —
  validate that each new op produces the expected plan, that the §5 blocks reject
  e-rail/auth/delete attempts, and that a `startRental` op yields the same record
  shape as the human flow. Money + multi-unit regressions must still pass.
- **Validation unit tests:** `wrValidatePlan` over malformed/hostile ops (unknown
  entity, off-allowlist field, blocked path) → dropped with a clear issue, never
  applied.
- **Smoke** (`ci/smoke.mjs`): app still boots.
- **R-rulebook / window-catalog / code-map / rule-usage** `--check` gates: any UI
  touch (richer preview rows) stays stamped and catalogued; regenerate as needed.
- **Backend:** none. This is entirely front-end (`app.js`); the existing
  `wrangler` backend action (Claude call) is unchanged — only the system prompt
  text it carries changes.

## 9. Out of scope (this spec)

- Charging saved cards / ACH via Wrangler (permanent — the hard line).
- Editing roles, permission tiers, or passwords via Wrangler (permanent).
- Permanent record deletion via Wrangler (permanent — cancel only; no hard delete).
- Invoice void (the app has no void concept — Jac, 2026-06-26).
- Refunds of any kind (deferred — Jac, 2026-06-26); cash/check *payments* are still in for Stage 2.
- Settings of any kind (dropped — Jac, 2026-06-26 — admin-password-gated persistence).
- Any change to the backend `Code.gs` contract or the data sync.
- Reworking the dock's visual design beyond richer preview rows.

## 10. Open questions

None blocking. Per-stage field-allowlist details (exactly which fields per entity)
and per-operation param contracts are settled during each stage's implementation
plan, not here.
