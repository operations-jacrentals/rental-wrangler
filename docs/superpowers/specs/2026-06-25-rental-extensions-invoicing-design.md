# Rental Extensions + Invoicing — design spec

**Date:** 2026-06-25 · **Branch:** `claude/rental-extensions-invoicing-kvxso4`
**Areas touched:** `rentals-dispatch` (the lengthen-window flow) + `invoicing-payments` (the delta billing)

> ⚠️ **Decision log — made autonomously.** The interactive approval popup
> (`AskUserQuestion`) failed repeatedly this session (infra: "permission stream
> closed"), and Jac pre-approved ("I approve all permissions… you don't need to
> ask"). The three pivotal calls below were taken with the **recommended**
> defaults. **This spec is the review gate** — flag any you'd flip and it's a
> small change.
>
> | Decision | Chosen | Alt rejected |
> |---|---|---|
> | Extension pricing | **Admin setting — Retroactive Rental Pricing (default ON)** | (see §2.1) |
> | Where the charge lands | **Additive line on the rental's existing invoice** | new invoice per extension |
> | What's extendable | **Any *fragile* rental** (invoiced **or** out: On/End/Off Rent) | On-Rent-only |

---

## 1. Problem

There is **no rental-extension feature today** (grep: 0 hits for extend/renew on
rentals — `app.js:7530` is a Maps API call). Yet the window picker *already lets you
change a fragile rental's end date* and **silently fails to bill for it**:

- `rentalFragile(r)` (`app.js:13524`) = `r.invoiceId || status ∈ {On Rent, End Rent,
  Off Rent, Returned}`. Fragile rentals **stage** window edits behind an explicit Save.
- `winPickSave()` (`app.js:13549`) writes `r.endDate = staged.endDate` and logs it —
  **but never re-prices, never touches the invoice.** A 5-day rental pushed to 12 days
  bills the original 5 days. That's the bug/gap this feature closes.

The fix is **not** a brand-new subsystem; it's: *when a fragile, invoiced rental's
window lengthens, compute the price delta and append it to the invoice as a charge,
with a live preview so it's never a surprise.*

## 2.1 Retroactive Rental Pricing — admin setting (Jac 2026-06-25)

The pricing basis is an **admin toggle** in **Settings → Company**, `company.retroactivePricing`, **default ON**. It only changes how an extension's delta is computed — the cheapest-rate engine (`rentalPrice`) is **never touched**.

- **ON (retroactive):** extending bills the cheapest price for **all** the days rented, with what's already billed **counting toward it**. `delta = rentalPrice(full window) − alreadyBilled`. A week paid rolls into a month. (This is the §2 model below.)
- **OFF:** ignore prior days — bill the extension as a **fresh rental of just the added days**: `delta = rentalPrice(prevEnd → newEnd)`, original lines frozen. No retroactive re-blend; the customer doesn't get the weekly/monthly discount applied backward.

Invariant: ON total ≤ OFF total for the same extension (blending never costs more). Both still emit additive `extension` line(s); only the amount differs. The picker preview + the `Bill Extension` flow read the live setting and show the basis ("Cheapest price for all rental days…" vs "Billed as a fresh rental of the added days."). Stored in the `company` settings slice (persists via sync; resets with the Company tab). Helper: `retroPricingOn()`.

## 2. Pricing model — when Retroactive Pricing is ON (the default)

The rate engine `rentalPrice()` (`app.js:838`) already finds the cheapest blend of
4-Week / 7-Day / 1-Day rates (plus Member / Weekend specials) for **any** window. An
extension recomputes that for the **new, longer** window and bills only the increment:

```
per non-voided unit eu:
  newFull   = unitRentalPrice(r_withNewEnd, eu.unitId).price      // optimal blend, new window
  billedNow = Σ amount of invoice lines where ref==rentalId
                && unitId==eu.unitId && kind ∈ {'rental','extension'}
  delta     = round(newFull - billedNow, cents)
  if delta > 0.005 → append one extension line of `delta` for eu
```

- **Honors the optimizer:** extending 6→9 days auto-applies the cheaper 7-Day bracket;
  the customer is never billed 9× the day rate when a week is cheaper.
- **Composes across multiple extensions:** each pass diffs against *everything already
  billed for that unit* (`rental` + prior `extension` lines), so 5→8→12 days bills two
  clean deltas with no double-counting.
- **Monotonic / refund-first:** we bill **positive deltas only**. A *shortened* window
  (or a Member/Weekend boundary that lowers the optimum) yields `delta ≤ 0` → **no line
  is added and nothing is auto-credited.** Reducing a charge is a refund decision and
  stays manual, consistent with the codebase's "refund before re-price" rule
  (`syncTransportLine` comment, `app.js:948`).
- **Tax:** extension lines are taxable by default (no `taxExempt`), so `invoiceTotals()`
  (`app.js:1304`) applies the 10.75% exact-cent tax automatically. Customer/line tax
  exemption still flows through unchanged.

## 2.2 Multi-invoice billing series + 28-day cap (Jac 2026-06-25)

Rentals now link to **multiple invoices** (a billing series). Rules:

- **An invoice bills at most 28 rental-days per unit** (`INV_CAP_DAYS = 28`). Because the
  4-Week rate **is** 28 days, the cheapest-blend optimizer already seams at 28-day marks,
  so splitting there bills the **same total** as one blended invoice — it's purely
  organizational (Jac: "keeps long-term rentals from getting disorganized").
- **Applies everywhere, incl. the first invoice** (Jac): a rental created for >28 days
  emits a *series* of ≤28-day invoices at creation. ≤28-day rentals are **unchanged** —
  exactly one invoice (the common path; zero behavior change).
- **"Closed" = paid in full (balance $0).** Extending when the active invoice is closed →
  a **new** invoice (never reopen a settled one). A new invoice also opens when the active
  one has no 28-day room left.
- **Continuation invoices** carry `covOf` (the rental), `covStart`/`covEnd` (the day
  sub-window they bill), and `contOf` (the first invoice). Their rental-line labels read
  **"… · Ext of `<rental>` (`<first inv#>`)"** so the customer sees it's a continuation,
  not a surprise second rental.

**Model — each rental invoice is a contiguous ≤28-day chunk** (`covStart`→`covEnd`):
- `rentalInvoices(r)` = all invoices billing the rental, ordered by `covStart`.
- `rentalActiveInvoice(r)` = the latest chunk (where the next extension bills if it has
  room and is open).
- **Create** (`createInvoiceForRental`): chunk `[start, end]` into ≤28-day windows; one
  invoice per chunk, each priced `cheapest(chunk)`; transport on chunk 0 only.
- **Extend**: fill the active chunk toward its 28-day cap first (re-blend per the
  retroactive setting), then spill remaining days into fresh ≤28-day invoices. A
  closed/locked active chunk spills immediately. **Retro re-blend is UP *or* DOWN** for
  unpaid lines: extending 19→28 days unlocks the 4-Week rate, which can be *cheaper* than
  the 19-day blend, so the open chunk's line is re-priced down (no separate extension
  line — the rental line itself updates). Paid lines never drop (refund-first); they take
  only a positive top-up. `reconcileChunkRetro` does the in-place re-price. Boundaries land on 28-day marks (→ same
  total) except when a chunk was paid early then extended (the one acknowledged case where
  a non-28-day cut can total slightly more — unavoidable given "closed → new invoice").

This keeps the §2/§2.1 per-unit delta math, just scoped to the active chunk's window and
routed across the series.

## 3. Where the charge lands (Decision 2: additive line on the existing invoice)

A new line-item **kind**: `'extension'`.

```js
{ kind:'extension', ref:r.rentalId, unitId:eu.unitId, lid:lineLid(),
  label:`${unit.name} · Extension → ${fmtShortDate(newEnd)} · ${newFull.rate}`,
  amount: delta }
```

Why a distinct kind on the **same** invoice (not a new invoice, not a re-priced
`rental` line):

- **Reuses all the money machinery for free** — `lid`-keyed allocation
  (`itemPaid`/`allocations`, lid-stable under reorder per `logic-test.mjs:40`), per-line
  partial refunds (`refundLines`), tax, the print ledger.
- **Never mutates a paid/locked line** — the original `rental` line is untouched, so
  prior payments keep their allocation. Adding a charge to a fully-paid invoice correctly
  flips it `Paid → Partial` and raises the balance due (that *is* the new money owed).
- **One rental → one invoice stays true.** `r.invoiceId` is 1:1 (a rental points at a
  single invoice); a "new invoice per extension" would break that link. Appending keeps
  the model intact.
- **Locked invoices:** if `inv.locked`, billing is blocked (server-owned seal). The
  extension Save surfaces "Unlock the invoice to bill this extension" rather than
  silently changing the date — pricing and date move together or not at all.
- **No invoice yet** (Reserved, never invoiced): extension is a pure date edit — the
  eventual `createInvoiceForRental` prices the full window. No extension line is created.

### Symmetric cleanup (small, correct touches)
`'extension'` lines must be swept like `rental`/`transport` lines when a unit leaves:
- `removeUnitInvoiceLine` (`app.js:11769`) — add `'extension'` to the dropped kinds
  (keep any **paid** extension line; refund-first).
- `healInvoiceLines` (`app.js:979`) — add `'extension'` to the orphan-kind sweep.

## 4. What's extendable (Decision 3: any fragile rental)

Extension billing fires for **fragile + invoiced** rentals — i.e. `rentalFragile(r)`
already gates the staged Save, and we additionally require `r.invoiceId` to bill. That
covers the real cases:

- **On Rent** — customer keeps the machine longer (the headline use case).
- **Reserved + invoiced** — push out a booked return before it goes out.
- **End/Off Rent** — winding down but extended back out (rare; allowed).

Non-fragile/un-invoiced rentals: the window picker stays *live* (no staging, no billing)
exactly as today.

## 5. UX — reuse the window picker, add a preview + a discoverable entry

No new popup *type* — we enhance the existing rental-window picker (`winPickerEl`,
`app.js:13669`; catalogued as the win-picker window) so the feature is one coherent
surface. Three changes:

1. **Discoverable "Extend" affordance.** In the rental detail (`EngineCard.rentals`,
   `app.js:5025`), for fragile + invoiced rentals, a stamped **`＋ EXTEND`** control near
   the window calendar opens the same picker (`openWinPicker`). For non-fragile rentals
   nothing changes. Final placement + styling go through `/jactec-ui` then `/frontend`
   (yard data-plate: stamped Saira Condensed label, a hazard-stripe accent on the commit
   action; ranch-voice tooltip e.g. *"Keep 'er out longer — rebill the added days."*).

2. **Live extension-preview banner** inside the picker, shown only when the staged
   `endDate` is **later** than the saved one **and** the rental is invoiced. It reads the
   per-unit delta sum and renders:
   ```
   EXTENSION  +7 days · Ju12 → Ju19
   Added charge   $1,290.00      (re-priced full window, less billed)
   Tax (10.75%)   $138.68
   New balance due  $3,196.70   ($1,766.70 → … )
   ```
   When the staged change is a *shorten* (delta ≤ 0) the banner instead notes
   "Window shortened — no auto-credit; refund manually if owed."

3. **Context-relabel the Save** to **`BILL EXTENSION`** when a positive billable delta
   exists (else it stays "Save"). On commit, `winPickSave()`:
   - writes the new window (as today),
   - if invoiced + delta>0 + not locked → appends the per-unit `extension` line(s),
   - `logAction(r, …)` and `logAction(inv, …)` (worded to land under the History
     **Payments** chip, regex `/…|invoice|charge|…/`, `app.js:5117`),
   - toasts `Extension billed — +$X added to invoice ####`,
   - re-renders; the invoice already on screen reflects the new balance.

### New money function
```js
function billExtension(r, prevEndDate) {
  // called from winPickSave after the date is written; r.endDate is the NEW end.
  // returns { lines:[…], subtotalDelta } or null when nothing to bill.
}
function extensionPreview(r, stagedEndDate) {
  // pure, no mutation — drives the banner. days delta, per-unit deltas, tax, new balance.
}
```
Both live beside `rentalLineItems` (`app.js:888`) in the §3 derivations block.

## 6. R-rulebook + window catalog

- The `＋ EXTEND` control and the preview banner get `data-r` stamps (new R-rules in the
  rulebook); `node ci/gen-rule-usage.mjs` regenerated (no `--check`).
- The win-picker popup is already in `WINDOW_CATALOG`; we're enhancing it, not adding a
  new window, so the catalog check should stay green. If `/jactec-ui` decides the extend
  flow warrants its own catalog note, we add it and re-run `check-window-catalog.mjs`.

## 7. Backend

**None required.** Extension lines are ordinary invoice line items; they persist through
the existing Sheets sync (§18b diff). `amountPaid`/payment recording is unchanged and
stays server-owned. No `Code.js` change, so no `/clasp` deploy.

## 8. Role gating

Extension billing is **not** behind `canMoney` — consistent with `createInvoiceForRental`
and `addCustomLine`, which any dispatch role can already use (dragging a unit on an
invoiced rental already adds a `rental` line). Editing the fragile window is itself the
gate. **Collecting payment** stays `canMoney`-gated (unchanged). *(Flag if you want
extension billing gated tighter — it's a one-line guard.)*

## 9. Testing

- **`ci/logic-test.mjs`** (money + multi-unit regression) gains cases:
  1. 5→12 day extension on a single-unit invoiced rental → one `extension` line equal to
     `rentalPrice(12d) − rentalPrice(5d)`; tax recomputed on new subtotal.
  2. Two-step 5→8→12 → two extension lines, no double-count, total == `price(12d) −
     price(5d)`.
  3. Multi-unit: each non-voided unit gets its own delta; voided unit gets none.
  4. Shorten (12→8) on an invoiced rental → **no** line added, balance unchanged.
  5. Allocation stability: a prior payment allocated to the `rental` line is untouched
     after an `extension` line is appended (lid-keyed).
  6. Locked invoice → extension blocked, date unchanged.
- **`ci/smoke.mjs`** boot check unaffected.
- Gates to run before push (port-swap 8000→9147): `smoke`, `logic-test`,
  `gen-rule-usage --check`, `check-window-catalog`.

## 10. Out of scope (YAGNI)

- Auto-credit / auto-refund on shorten (manual refund flow already exists).
- Extension-specific notifications/SMS (lives in `comms-notifications`).
- A separate "extensions" report/ledger (the invoice History + action log already record
  every extension).
- Per-unit *independent* extension dates (that's the existing **Split** flow,
  `app.js:5084` — extend the split rental separately).
