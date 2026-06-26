# BUG: "Add card" from the account menu has no agreement attached, and signup doesn't generate the first invoice

**Reported by Jac (verbatim):** "When I click add a card from the account menu, pop up, it just lets me add a card and click save card. It does not have another agreement attached to it." AND "Signing up a customer should be done from the add card, selfie, and agreement window And upon completion, should generate the first invoice for that agreement for the day marked, the start day marked in the agreement."

**Area:** customers-crm

**Symptom:** The standalone "Add card" popup (opened from the account menu) lets the user save a card with no agreement/selfie capture bundled in, and completing customer signup never auto-generates a first invoice dated to the agreement's marked start day.

**Suspected code locations:**
- `app.js:9651-9666` — the standalone `o.kind === 'addCard'` overlay body. It builds the Stripe card field and currently appends `${heldSignBlock(o, c, {})}` (line 9665), but the footer (9657) is just Cancel / Save card. This is the "add card from the account menu" popup Jac describes; note the live-branch code *does* include `heldSignBlock`, so the report may reflect a deployed/older state OR the agreement block isn't rendering — confirm against what Jac sees.
- `app.js:13661` — `openAddCard(customerId, opts)`: opens that standalone `addCard` overlay (the account-menu / payment-row entry point).
- `app.js:13838-13903` — `saveCardFlow`: the Save-card handler. On success it saddles held selfie/signature onto the new card and toasts, but **never generates any invoice**. This is where a "first invoice on signup completion" hook would be missing.
- `app.js:999-1006` (`createContinuationInvoice`) and `app.js:3292-3297` (`buildMembershipInvoice`) — the existing invoice-builder patterns (`nextInvoiceId()` + push to `DATA.invoices` + `reindex`) a new "first agreement invoice" generator would follow, dated to the agreement's marked start day (note `dueForCustomer`, `TODAY_ISO` usage).
- `app.js:9425-9512` — the `newCustomer` onboarding window with the `cardSub` card panel (the intended combined card+selfie+agreement surface, lines 9493-9511); compare against the standalone `addCard` popup.

**Root-cause hypothesis (hypothesis):** Two divergent add-card surfaces exist: the rich onboarding `newCustomer` `cardSub` panel (card + `heldSignBlock`) vs. the standalone `addCard` overlay reached from the account menu via `openAddCard`. Signup completion is treated purely as "card saved" in `saveCardFlow` — there is no post-save step that creates the agreement's first invoice dated to its start day. The account-menu path needs to converge on the combined window, and `saveCardFlow` (or the agreement-finalize path `maybeFinalizeCard`/`signCardAgreement`) needs an invoice-generation hook keyed to the agreement start date.

**Acceptance criteria:**
- [ ] Signing a customer up is driven from the single card + selfie + agreement window (not a bare card-only popup).
- [ ] On signup completion, a first invoice is auto-generated for that agreement.
- [ ] That invoice's date equals the agreement's marked start day (not necessarily TODAY).
- [ ] The standalone account-menu "Add card" entry either routes into the combined window or carries the agreement, so a card can never be saved without its agreement when it's a signup.

**Notes:** `WINDOW_CATALOG` entries: `addCard` (`app.js:9799`) and `newCustomer` (`app.js:9792`) — any merge/removal of a popup kind must update the catalog or `ci/check-window-catalog.mjs` fails. Invoice-generation precedent: `createContinuationInvoice` (`app.js:999`), `buildMembershipInvoice` (`app.js:3292`); both use `nextInvoiceId()`. Overlaps BUG 10 (onboarding-single-window) — converge the surfaces together. jactec-ui: the combined window is the onboarding `nc-popup` surface — any reshaping runs through `/jactec-ui` (stamped `data-r`, rivets, hazard-stripe, Saira labels).
