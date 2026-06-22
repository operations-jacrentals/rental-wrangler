# Independent Capture — card · selfie · signature — design spec

**Date:** 2026-06-22 · **Branch:** `invoicing-payments/card-save-gate` · **Status:** approved design, ready for implementation plan

## Problem

Two things are broken/limited in the customer card-on-file + agreement flow:

1. **Card-save is dead for new customers (the reported bug).** The backend gates card-save
   on a *customer-level* selfie + signature: `stripeSetupIntent_` (`Code.gs:397`) and
   `stripeSaveCard_` (`Code.gs:424`) both `return { ok:false, error:'consent-required' }`
   unless `rec.signature && rec.selfie`. But the approved card-bound-agreements design
   (2026-06-18) made cards save **Unsigned** and capture consent *after* — so a fresh
   customer has no customer-level selfie/signature at save time, the gate fires, and the
   card never saves. The client even documents this contradiction at `app.js:11301`
   ("DON'T gate the save on a customer-level signature"). The server never got the memo.

2. **Selfie + signature are coupled.** Today they're one packet — *"Capture both to
   authorize"* — and the commit is a no-op unless **both** are present (`commitCapture`,
   `app.js:396`; the save-time sign at `app.js:11319`). You can't snap the selfie at the
   counter now and collect the signature later.

Jac's intent: **card, selfie, and signature are three independent pieces, saveable in any
order, any combination, finished later.** A card is fully usable for the yard only once all
three are present.

## The model (decided with Jac)

Each card collects three pieces **in any order, across as many days as it takes**, with
**no document and no dates shown** while it's in progress:

1. **In progress.** The card carries a mutable **selfie** slot and a mutable **signature**
   slot. Either, both, or neither may be filled; each saves on its own and can be redone.
   Nothing is locked, no PDF exists, and **no per-piece dates** are recorded anywhere the
   customer sees.
2. **Completion = card + selfie + signature all present**, with the signature matching the
   **current** account type's agreement. At that instant the agreement is **finalized** and
   stamped with **one** date — the completion date. That single date is the only timestamp
   and is what the PDF shows. (This is why we do *not* stamp the signature with its own early
   date: a three-different-days trail on the PDF is exactly what Jac rejected.)
3. **After completion the agreement is locked** (immutable — cannot be silently edited or
   back-dated). "⤓ PDF" regenerates identically from the locked bundle, showing the one date.
4. **Before any card exists**, a captured selfie and/or signature are **held on the account**
   and saddle onto the first card added (extends today's `pendingSigning` /
   `attachHeldSigning`). If adding the card completes all three, it finalizes right then.
5. **Account-type change** (Member-ness flips → the agreement text changes): the finalized
   agreement no longer matches → the card needs a **fresh signature**; the **selfie carries
   over** (same person, same card). Re-completing stamps a new single date; the prior locked
   copy is **archived for records but never shown on the current PDF** (no trail clutter).

A card is therefore always in exactly one state: **In progress** (missing ≥1 piece) or
**Complete** (all three, one date, PDF-ready).

## Data model

Building on the existing per-card shape (`c.cards[]`, each with `agreements[]`):

- **`card.selfie`** (+ `card.driveSelfieUrl`) — the durable per-card photo slot. Mutable
  while in progress; survives re-signs (carries over on account-type change).
- **`card.draftSignature`** — a held, mutable signature awaiting completion, with the
  `{ key, version, accountType, signerName }` it was signed against (so we can tell if it
  still matches the current type). Cleared at finalization.
- **`card.agreements[]`** — the existing **append-only, immutable** finalized records. A
  record is created **only at completion**, stamped `signedAt = <completion date>` (the one
  timestamp), snapshotting the frozen agreement `version`, `title`, `accountType`,
  `signerName`, `signature`, and `selfie`. Re-signs **append** a new record; prior records
  are kept/archived, never edited.
- **No new backend entity** — selfie, signature, draft, and records all ride inside the
  `customers` record already in `PERSIST_KEYS`, so they sync with no `Code.gs` change beyond
  the gate removal (matches the 2026-06-18 design's "no Code.gs change for the core feature").

### Derived helpers (revised)
```
cardComplete(c, k)        // latest agreements record matches requiredKey(c.accountType)
cardAuthorized(c, k)      // cardComplete(c, k) && card not removed   (expiry handled as today)
cardCaptureState(c, k)    // 'complete' | 'in-progress'   (in-progress = card exists but not complete)
accountAgreementsOk(c)    // validCards(c).every(cardAuthorized)      ← THE GATE (unchanged shape)
```
`cardAuthorized` no longer means "has any signing"; it means "has a **completed** agreement
for the current type" — which, by construction, required both selfie and signature present
at completion.

## The gate (on-rent + delivery)

Mechanical change only: **"blocked until Complete"** replaces **"blocked until signed."**

| | **In progress** | **Complete** |
|---|---|---|
| Charge the card | ✅ allowed | ✅ allowed |
| Go On-Rent | 🚫 blocked | ✅ allowed |
| Log a delivery | 🚫 blocked | ✅ allowed |

- **Charging is never gated** — a phone card with no agreement yet can still be charged.
  (Unchanged; the Stripe/charge code is untouched.)
- **The account is blocked from On-Rent/delivery if *any* valid card is In progress**
  (`accountAgreementsOk` = every valid card Complete). One finished card doesn't unblock the
  account if another is half-done.
- **Admin override** still forces past the block and is **logged**, exactly as today
  (`requireAdmin`, `r.cardOverride`, the existing logged override at `app.js:8713` + the
  delivery capture handler).
- **Expired cards don't block** (gate scoped to `validCards`); **no card at all** blocks the
  yard as now.
- **Flags:** the customer card's `No Card` flag pattern keeps its sibling incomplete-card flag
  (today "Unsigned card"); wording shifts to reflect "Card incomplete — finish to authorize"
  and still jumps to the Cards section.

## UI — the 3-piece checklist (runs through /jactec-ui + /frontend)

This section is *interaction*; the visual language (steel panels, hazard cap, Saira, rivets,
the `ag-*` stamped classes, R-rulebook stamps) is built via **/jactec-ui** then **/frontend**
after this spec. New elements get `data-r` stamps and `rule-usage.js` is regenerated.

The per-card tab (and the pre-card +Card panel) becomes a **3-piece checklist**, fillable in
any order:

- **Progress header** — "Card ✓ · Selfie ✓ · Signature —" with a plain "Finish 1 more to
  authorize" line. Tab status dot: 🟡 In progress → 🟢 Complete.
- **Three independent rows**, each actionable and re-doable while in progress:
  - **Card** — the Stripe field + its own **Save card** button (Stripe requires the
    SetupIntent round-trip). Shows •••• 3144 once saved.
  - **Selfie** — camera/upload tile. **Auto-saves on capture** (persists to the record +
    sync), with a small "Saved ✓". Retake anytime until complete.
  - **Signature** — agreement reference (Terms ↗) + sign pad. **Auto-saves on sign**, with
    "Saved ✓". Re-sign anytime until complete.
- **No premature document** — no PDF, no visible dates while In progress (Jac's rule).
- **On completion** the tab flips to the **Complete** view: slim meta line + green
  **Authorized** pill, a lock row with the **single completion date**, **⤓ PDF**, and the
  selfie + signature shown side by side. Locked from there.
- **Pre-card** (+Card panel, no card yet): selfie and signature capture the same way and are
  **held**, saddling onto the first card added.

### Save mechanics
- Selfie & signature **auto-save the instant they're captured** (no separate Save tap).
- The card keeps its explicit **Save card** (Stripe).
- Finalization is automatic: when the third piece lands (and the signature matches the
  current type), the record is created, stamped with the completion date, and the tab flips
  to Complete.

## Backend fix (ships first, via /clasp)

Standalone and minimal — **delete the two consent gates**:
- `Code.gs:397` in `stripeSetupIntent_`
- `Code.gs:424` in `stripeSaveCard_`

This alone makes card-save work again under the *current* client, ahead of the UI reshape.
The `cardMandate` evidence block (`Code.gs:437-441`) stays (harmless metadata; `selfiePresent`
/ `signaturePresent` will simply read false at save time, which is correct under the new
model). Deployed via `/clasp` — additive/behavioral; **stops for explicit confirmation before
the prod push**, and we pull/diff to confirm the local `Code.gs` matches live first (the
backend was historically "deployed by paste," so drift is possible).

## Migration

- **Existing Complete cards keep their status.** A card whose latest `agreements` record
  matches the current type is already Complete — keep its existing `signedAt` date; it stays
  Authorized. Lift that record's `selfie` onto `card.selfie` (durable slot) for back-compat;
  a `cardSelfie(k)` helper prefers `card.selfie`, falls back to the latest record's selfie.
- **Legacy customer-level** `selfie`/`signature`/`agreementSignedAt` continue to fold onto the
  first card (as the current migration already does), as a completed record with that date.
- **No partial cards existed before**, so there is nothing half-done to convert.

## Immutability + PDF

- **PDF generates client-side, only when Complete**, from the locked record — showing the one
  completion date. Regenerated identically every time, so it can't drift. (Same print-pipeline
  approach as today; no new dependency, no backend.)
- **Image offload to Drive** (`archiveAgreementMedia`) runs **at completion** (graceful: images
  stay inline until the backend handler exists). The selfie is downscaled (~380px) as today.
- **Gate scoped to non-expired cards** — an expired, in-progress card no longer blocks the yard.

## Rollout

1. **Backend gate removal** (this branch) → `/clasp` deploy (explicit-confirm gate). Card-save
   works immediately under the current client.
2. **Client 3-piece reshape** (data model + helpers + gate wording + UI) on the same branch,
   built through /jactec-ui + /frontend, with R-rulebook stamps + `rule-usage.js` regen.
3. Gates: `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`
   (swap port 8000→9147 first per CLAUDE.md). Promote `invoicing-payments/card-save-gate` →
   `area/invoicing-payments` → `staging` (preview) → PR `staging` → `main`.

## Out of scope / non-goals

- No change to charging, refunds, price-lock, or ACH mandate flows beyond reading the new shape.
- No Drive archival changes beyond firing the existing handler at completion.
- No retroactive restyle of unrelated UI (only what this edit touches).
- ACH `mandate` parallel left as-is this pass (the same independent-pieces pattern could follow).

## Risks / watch-items

- **Sheets ~50k-char-per-cell** weight: selfie + signature already per-card; the
  versioned-registry choice keeps agreement *text* out of the synced record. Watch multi-card
  customers approaching the cap.
- **Backend drift**: local `Code.gs` may differ from the pasted-live version — pull/diff before
  the `/clasp` push.
- **Migration correctness** for legacy single-card + customer-level signature → first completed
  record; and lifting `selfie` onto `card.selfie`.
- **Override audit**: blocked on-rent and blocked delivery must both still log the Admin override.
- **Type-change edge**: a draft signature captured against the old type before a type change
  must be treated as not-matching (stale) at completion — re-sign required.
- Gates (`smoke`, `logic-test`, `gen-rule-usage --check`) must pass; new `ag-*` UI stamped
  (R0 flash-lint) and `rule-usage.js` regenerated.
