# Card-Bound Agreements — design spec

**Date:** 2026-06-18 · **Branch:** `claude/customers-agreements-cloud-aropda` · **Status:** approved design, ready for implementation plan

## Problem

Today the signed agreement is a **customer-level** thing derived live from account type:
`c.agreementType` / `c.agreementSignedAt` / `c.signature`. Flipping the account-type pills
(Member ⇄ Non-Member) swaps the agreement *text*, but the single `agreementSignedAt` flag
keeps reading "signed" — so a customer can appear to have signed an agreement they never
actually accepted, and the record can be silently changed after signing. There is no
durable, immutable record of *what* they signed, and no per-card authorization.

The data model already half-anticipates the fix: every card in `c.cards[]` carries an
`agreement: { signedAt, version, signature, selfie }` (see the migration at `app.js:104`),
and ACH carries a parallel `mandate`. But the signing flow ignores it — `app.js:9746`
hardcodes `version: 'rental'` and reuses the customer-level signature. We promote the
**per-card** agreement to the source of truth and retire the mutable customer-level one
for gating.

## The model (decided with Jac)

1. **A signature is always attached to a card.** Adding a new card triggers a fresh signing
   for the customer's *current* account type. There is no customer-level "the agreement"
   anymore — agreements live on cards.
2. **Cards can be saved (and charged) without a signature.** A card taken over the phone is
   saved immediately and can be charged. It is simply **Unsigned** until someone signs.
3. **The gate — any unsigned card blocks the account.** The account cannot go **On Rent**
   and drivers cannot **log deliveries** while *any* active card on file lacks a valid signed
   agreement **matching the current account type**. This holds even if other cards are
   signed and even if a signed card was just charged. **Charging is never blocked.**
4. **Account-type change requires re-signing (must match current type).** If the customer's
   account type changes such that the required agreement changes (Member-ness flips), every
   card whose latest signing doesn't match goes **stale** and must be re-signed before
   on-rent/delivery is allowed again. Prior signings are **kept and archived** (still
   viewable / downloadable as PDF), never deleted.
5. **Each signing is immutable** and exportable as a **PDF** that cannot be edited.
6. **The packet is selfie + signature**, captured together, frozen onto the card at signing.

### Required agreement key
`requiredKey(accountType) = /member/i.test(accountType) ? 'membership' : 'rental'`
(Business-ness does not change the agreement; only Member-ness does — matches `app.js:6252`.)
Account types: `Non-Business`, `Business`, `Non-Business Member`, `Business Member`.

## Data model

Replace the single `card.agreement` object with an **append-only array of signing records**:

```js
card.agreements = [ {
  id,                      // 'SIG-<seq>'
  versionId,               // → AGREEMENT_VERSIONS registry (frozen text); see Immutability
  key,                     // 'rental' | 'membership'  (what was signed)
  title,                   // snapshot of the agreement title at signing
  accountType,             // the account type at signing time (audit)
  signedAt,                // ISO date
  signerName,              // fullName at signing (audit)
  signature,               // dataURL (JPEG 0.6) — already how the sigpad saves
  selfie,                  // dataURL (JPEG)
  driveFileId: null,       // reserved for later Drive archival (see Immutability)
  driveUrl: null
} ]
```

- **Migration:** fold any existing `card.agreement` into `card.agreements = [agreement]`
  (stamping `key` from the old `version`, `versionId` resolved by content match — see below).
  Also fold the legacy customer-level `c.agreementType/agreementSignedAt/signature` into the
  default card's first signing if a card exists. The customer-level fields stay readable for
  back-compat but are **no longer authoritative** and are not written going forward.
- **Sync:** agreements ride inside the `customers` entity, which is already in `PERSIST_KEYS`
  — **no new backend entity, no Code.gs change required** for the core feature.

### Derived helpers (new)
```
cardCurrentSigning(c, card)  // latest record in card.agreements with key === requiredKey(c.accountType)
cardAuthorized(c, card)      // !!cardCurrentSigning && card not removed   (expiry handled separately, as today)
cardSignState(c, card)       // 'authorized' | 'stale' (signed, wrong type) | 'unsigned'
accountAgreementsOk(c)       // customerCards(c).every(k => cardAuthorized(c, k))   ← THE GATE
```

## The gate (on-rent + delivery)

- **Booking** (`BOOKING_STATUSES` → On Rent / Reserved / Today / Tomorrow): extend the
  existing valid-card gate at `app.js:8713`. Today it blocks on `!hasValidCard`; add
  `|| !accountAgreementsOk(cust)`. Same Admin-override path (`requireAdmin`, `r.cardOverride`)
  and the same logged override.
- **Delivery logging — the yard journey, everywhere it renders** (the "start" capture —
  `js-yard data-cap="start"`, the **+Log Delivery** node). The yard journey (R15 —
  `yardToolHtml` / `miniJourneyHtml`, `app.js:2845`/`2858`) shows on the **rental day
  timeline AND on the unit card**, so we gate at the **capture handler** (one place) which
  covers every render site. When `!accountAgreementsOk(cust)`: block the capture, same Admin
  override, and a toast that explains why and deep-links to the customer's Cards (like the
  existing `No Card → Cards on File` jump). The journey node also reads visibly **locked**
  (not silently dead) wherever it renders, including on the unit card.
- **Charging** (payment / Stripe flows): **unchanged** — never gated on signature.
- **Flag:** the customer card's `No Card` red flag pattern (`flagEl`, R9b) gains a sibling
  **"Unsigned card"** flag when `!accountAgreementsOk(c)` so it pulses for attention and
  jumps to the Cards section.

## Immutability + PDF

- **Frozen text snapshot (shipped).** Each signing record stores the **full agreement
  title + text** as it read at signing, alongside the signature + selfie. Editing
  `agreements.js` later never touches a past signing — it already carries its own copy.
  This is simpler and more robust than a separate version registry (no manual versioning
  discipline, no lookup indirection); the tradeoff is ~3–4 KB of text per signing inside the
  synced customer record (small next to the signature/selfie images, which already rode
  along). The 50k-char-per-cell watch-item below still applies.
- **PDF (client-side, immutable).** "⤓ PDF" renders the frozen signing (title + frozen text +
  signature + selfie + signer + date) into a print-styled, read-only view and produces a PDF
  via the browser print pipeline (no new dependency, no backend). The content is regenerated
  identically from the frozen record every time, so it can't drift.
- **Drive-ready, not Drive-now.** `driveFileId/driveUrl` are reserved on each signing so a
  future Apps Script Drive handler can archive the PDF to a per-customer Drive folder and
  backfill the link — **deferred** (that handler needs a clasp deploy, which can't be done
  from the cloud session; it would ship as a paste snippet later). Perks of doing it later:
  system-of-record separation, off-app sharing, and offloading image weight from Sheets cells.

## UI — tabbed Account + per-card (approved v3 mock)

The New/Edit Customer popup (`renderOverlay` `newCustomer` branch, `app.js:6243`) is reshaped.
Run all of it through the **jactec-ui** language; the mock was built on the real `style.css`
(hazard cap, rivets, stamped Saira, orange ignition, steel panels). New stamped classes
(`ag-*`) get **R-rulebook** stamps and the `rule-usage` regen.

- **The card rail *is* the header.** No "Edit / Complete Account" title and no icon chip.
  A tab rail sits on the header baseline: **Account** · one tab per card (each with a status
  dot — 🟢 authorized, 🔴 unsigned/stale) · a dashed **＋ Card**. The active tab carries the
  2.5px orange underline.
- **Account tab (data).** Reworked grid: a single **Name \*** field (everything after the
  first space is the last name — reuse `parseCustomerName`/`fullName`), **Name + Company on
  one half-width row**, then Phone / Email / Industry / Notes paired into halves, and
  **Account type pills full-width across the last row**. A short red summary banner appears
  when blocked: *"N card needs signing — On-Rent & delivery blocked."*
- **Card tab — signed/locked.** Slim meta line (`Default · exp 08/27` + green **Authorized**
  pill, no duplicate card number), a green **lock** row (*"Business Rental · signed
  06/12/26"*) with **⤓ PDF**, then the **selfie + signature** side by side, and a
  *"Read the signed agreement"* link to the frozen full text. Stale (post type-change) shows
  the same as unsigned but keeps the archived prior signing's PDF link.
- **Card tab — unsigned (sign to authorize).** Meta line + red **Unsigned** pill; one calm
  gate line: *"Sign to allow On-Rent & delivery. Card can still be charged."*; the agreement
  reference (*Business Rental Agreement · Read ↗*); a **"Capture both to authorize"** row with
  a **Selfie** tile and a **BIG sign pad**; **Accept & Sign** (disabled until both selfie and
  signature are present) + **Clear**.
- **Add Card** no longer forces signing at save — the card lands **Unsigned** (enables phone
  capture); signing is the per-card step above.

## Out of scope / non-goals

- No Drive archival in this pass (reserved fields only).
- No change to charging, Stripe, or ACH mandate flows beyond reading the new shape.
- No retroactive restyle of unrelated UI (only what this edit touches).
- ACH `mandate` is left as-is this pass (the same pattern could follow later).

## Risks / watch-items

- **Sheets 50k-char-per-cell** weight: pre-existing (selfie+signature already per card). The
  versioned-registry choice keeps agreement *text* out of the synced record; images stay
  JPEG-compressed as today. Note in testing if multi-card customers approach the cap.
- **Migration correctness** for legacy single-card + customer-level signature → first signing.
- **Override audit**: blocked on-rent and blocked delivery must both log the Admin override.
- Gates (`smoke`, `logic-test`, `gen-rule-usage --check`) must pass; new `ag-*` UI must be
  stamped (R0 flash-lint) and `rule-usage.js` regenerated.
