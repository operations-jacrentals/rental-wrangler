# BUG: Card / selfie / agreement are a sequential flow instead of one window completable in any order

**Reported by Jac (verbatim):** "I actually just clicked save card, and after I saved the card, it's now displaying the selfie and agreement signature options. This is incorrect. It should all be in one window together. so that I can add a selfie and sign the agreement without a card if that's the order I'd like to complete all of this in."

**Area:** customers-crm

**Symptom:** Saving the card first, then revealing selfie + agreement signature on a separate card "signing" tab, forces an order. Card + selfie + agreement should sit in one window, each independently completable in any order (e.g. selfie/agreement before any card).

**Suspected code locations:**
- `app.js:13898-13901` — `saveCardFlow` post-save navigation: `if (sub) { o.cardSub = false; o.tab = newCardId; renderOverlay(); } ... else { closeOverlay(); openCustomerForm(...); state.overlay.tab = newCardId; }` — this is what flips the UI to the new card's **signing tab** after the card saves, producing the sequential reveal.
- `app.js:9465-9486` — the per-card signing-tab body (selfie/signature `capProgress` + `agCaptureBlock`) shown only once a card exists and its tab is active.
- `app.js:9493-9511` — the `newCustomer` `cardSub` panel: it renders card + `heldSignBlock` together when `noCardYet` (the closest existing "one window" surface), but signing is otherwise split onto the post-save card tab.
- `app.js:375-387` (`heldSignBlock`) and `app.js:449-471` (`captureCtx`/`captureSelfie`/`captureSignature`) — the pre-card "held" capture machinery: selfie/signature already CAN be captured with no card (held on `c.pendingCapture`, then `saddlePendingCapture` at `app.js:13890`). The pieces exist; the *window layout* enforces order.
- `app.js:434-441` (`maybeFinalizeCard`) — finalize-on-complete: card finalizes once all three present in any order; confirms order-independence is intended at the data layer.

**Root-cause hypothesis (hypothesis):** The data model already supports any-order, independent capture (held `pendingCapture` + `maybeFinalizeCard`), but the *presentation* is staged: the standalone `addCard` overlay and the `newCustomer` flow reveal the selfie/agreement only on the card's signing tab after `saveCardFlow` switches `o.tab` to the new card. The fix is a single window presenting all three capture slots simultaneously, with no card required first, removing the post-save tab-switch that creates the sequence.

**Acceptance criteria:**
- [ ] Card, selfie, and agreement signature are all present in one window at once.
- [ ] A selfie can be captured and the agreement signed with no card saved yet (held, then saddled onto the first card).
- [ ] Any completion order works; the card finalizes once all three exist (via `maybeFinalizeCard`).
- [ ] Saving the card does not navigate to a separate signing step (`saveCardFlow` no longer forces a tab switch that hides the other slots).

**Notes:** Overlaps BUG 8 and BUG 9 — all three point at converging the onboarding surfaces (`addCard` overlay `app.js:9651`, `newCustomer` `cardSub` `app.js:9493`) into one window; fix together. `WINDOW_CATALOG`: `addCard` (`app.js:9799`) / `newCustomer` (`app.js:9792`) — update if a kind is merged/removed (`ci/check-window-catalog.mjs`). jactec-ui: the combined onboarding popup (`nc-popup`, the `ag-cam-feed`/signature-pad capture block) is reshaped UI — run through `/jactec-ui`; respect reduced-motion on the live selfie cam, keep `data-r` stamps current (`ci/gen-rule-usage.mjs --check`).
