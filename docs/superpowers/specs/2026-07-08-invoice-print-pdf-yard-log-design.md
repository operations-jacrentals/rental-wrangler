# Invoice Print / PDF — "Yard Log" redesign — design spec

**Date:** 2026-07-08 · **Branch:** `claude/invoice-print-pdf-styling-i0n2ll` → `area/invoicing-payments`
**Areas touched:** `invoicing-payments` (the customer-facing invoice print/PDF)

> Built through `/jactec-ui`. Two pivotal calls were made via `AskUserQuestion`
> popups (Jac chose the **recommended** option each time); the rest were iterated
> live against Jac's red-mark screenshots. **This spec is the review gate.**
>
> | Decision | Chosen | Alt rejected |
> |---|---|---|
> | Visual direction | **Yard-log PAGE** (kraft page, ledger lines, machine glyphs, stamps — prints clean) | Faithful skeuomorphic wood-desk / coffee-stain repro |
> | Actions log content | **Customer-safe, scrubbed** (no staff names / internal jargon) | Full internal action log, verbatim |

---

## 1. Problem

`printInvoice()` (`app.js`, APP-35 Stripe/Payments neighborhood) rendered a flat
white ledger: one undifferentiated line-item table, a plain subtotal/tax/total, and
**no action history at all**. On a multi-rental invoice you couldn't tell which unit
belonged to which rental, what each rental's window/duration/provenance was, or what
had been amended. Jac wanted it to read like a JacRentals **"yard log"** — grouped,
stamped, on-brand — and to carry the amendment history.

## 2. What it does now

The doc renders into `#print-root`; `@media print` swaps the dark app out for it, and
the browser's dialog handles paper / "Save as PDF". Colors are a self-contained PAPER
palette (kraft `#f7f2ea`, ink `#14181d`, tan saddle-stitch) forced to render with
`print-color-adjust: exact` — deliberately **outside** the dark-app tokens because
this is white-paper output.

### 2.1 Structure — grouped by rental
- **`invoicePrintGroups(inv)`** buckets `inv.lineItems` by `li.ref` (the rentalId),
  sorted **newest → oldest** by rental window (`startDate` desc). Unlinked/manual
  lines fall to a trailing **"Other"** group (no window/duration).
- Each rental is a **soft card** (`.pr-card`) with a **single-line header**: the bold
  **RENTAL** title first, then `window · duration · provenance`, and the **per-rental
  subtotal** pinned right.
- **Duration** — `prDuration(days)`: `28d → "1 Month"`, `÷7 → "N Weeks"`, else
  `"N Days"` (matches the 4-Week = 28-day rate).
- **Provenance** — `prGroupProvenance()`: **"Merged from 216i"** (lines carry a
  `fromInv` tag stamped by `mergeInvoiceInto`), **"Extension of 216i"** (a line's
  "Ext of NNN" tail, or `inv.contOf` when this is the covered rental), or
  **"Extension"** (grow-in-place).
- **Line rows** — `prLineParts(li)`: unit glyph (`categoryIconFor`) + unit name +
  **category** (e.g. `White · Mini Excavator`). The per-day rate/qty is intentionally
  dropped (the card header carries the window/duration). **Transport** lines show
  `Type · delivery address · mileage` from the unit entry.
- **Grand Subtotal** (renamed from "Subtotal"), Tax, Total, payment rows, **Balance Due**.

### 2.2 Status-colored accent ink
`prInvoiceInk(inv, t)` → `.is-paid` / `.is-open` / `.is-due` modifier on `.pr-doc`,
driving `--pr-accent` + `--pr-stripe` on the date stamp, hazard stripe, Balance Due
and the PAID stamp:
- **green** — paid in full (`balance ≤ 0.005`)
- **red** — past due (`invoiceTotals().status` ∈ `Late*` / `Collections`)
- **amber/gold** — open, not yet due (everything else)

Colors are vibrant on purpose (Jac); a deliberate override of strict AA on the light
kraft, justified because they only apply to large bold display text.

### 2.3 Amendment logs — SEPARATED + customer-safe
`invoiceAmendments(inv)` returns `{ invoiceLog, rentalLog }`, rendered as two columns:
**Invoice Log** (the invoice's own `actions`) and **Rental Log** (its rentals'
`actions`, tagged with the rental name), each sorted **most-recent → oldest**.

**Data-sensitivity gate (customer-facing surface):** the scrub drops internal ops
detail — a DENY regex removes `pricing locked`, `Mr. Wrangler`, `Added by`, card/ACH,
mechanic/GPS/hours lines, and the staff `by` field is never emitted — and translates
internal-but-relevant wording to plain language (`Merged in invoice 214i…` →
"Combined with a prior ticket"; `Continuation…` → "Continued on a new ticket").

### 2.4 Yard-log furniture
- Our real **logo** (`assets/jac-rentals-logo.jpg`) + the wordmark rendered proper-case
  and spaced ("Jac Rentals").
- Hi-vis **hazard-stripe** signature rule (status-colored).
- The customer's **account photo** (`latestCustomerSelfie`) beside the totals, muted
  with a grayscale/sepia filter so it blends into the kraft page; the **PAID IN FULL**
  stamp overlays it when the invoice is settled.

## 3. Supporting changes
- `mergeInvoiceInto` stamps a `fromInv` tag on moved lines so **"Merged from"**
  provenance is reliable going forward (additive; does not affect totals or existing
  behavior; pre-existing merges simply show no merge note).
- `printInvoice` / `invoicePrintGroups` / `invoiceAmendments` are exposed on the
  `window.__rw` test seam for headless screenshot / e2e.

## 4. Non-goals / notes
- The print doc has **no `data-r` stamped elements** (it's a print artifact, not
  interactive app UI), so the R-Rulebook / `WINDOW_CATALOG` are unaffected.
- Not tokenized against the dark-app `:root` on purpose — a paper surface needs its
  own palette; it themes itself via the three `.is-*` accent classes only.
- If an account has no photo on file, the photo slot is simply empty (fallback to
  initials/silhouette is an open follow-up if Jac wants one).

## 5. Files touched
- `app.js` — `printInvoice` + helpers (`prDuration`, `prGroupProvenance`,
  `invoicePrintGroups`, `prLineParts`, `invoiceAmendments`, `prInvoiceInk`),
  `mergeInvoiceInto` (`fromInv` tag), `exposeTestApi`.
- `style.css` — the `.pr-*` "yard log" print block.
- `docs/code-map.generated.md` — regenerated.

## 6. Gates (all green)
`node ci/smoke.mjs` · `node ci/logic-test.mjs` (408/408) ·
`node ci/gen-rule-usage.mjs --check` · `node ci/check-window-catalog.mjs` ·
`node tools/gen-code-map.mjs --check`.
