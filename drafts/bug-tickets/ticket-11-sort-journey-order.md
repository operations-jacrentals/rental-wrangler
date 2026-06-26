# BUG: Status sort should follow the rental-journey lifecycle order, not alphabetical

**Reported by Jac (verbatim):** "We need to do a lot of work on our sort features. They pretty much suck. For example, when I sort by status and click the arrows, I can either sort from cancel back or I can sort from return back. when, really, I should be able to sort and it give me the rental statuses in order of the rental journey from front to back or back to front."

**Area:** search-views

**Symptom:** Sorting rentals by Status orders the status strings alphabetically (so the two directions are "Cancelled-first" and "Returned-first"), instead of following the natural rental lifecycle (Quote → Reserved → On Rent → … → No Show) front-to-back or back-to-front.

**Suspected code locations:**
- `app.js:6487-6520` — `sortRows(card, rows, sort)`, the sort comparator. Line `6494`: `case 'status': return rec.status || '';` returns the raw status **string**, so the final comparison at 6519 (`va < vb`) sorts alphabetically.
- `app.js:230` — `const STATUS_ORDER = ['Quote','Reserved','Tomorrow','Today','On Rent','End Rent','Off Rent','Returned','Cancelled','No Show'];` — the existing canonical journey order. This is already used at `app.js:241` for unit-status ordering; the status sort should key off `STATUS_ORDER.indexOf(...)` the same way.
- `config.js:54-65` — `RAW_STATUS.rentalStatus`, declared in journey order (the authoritative lifecycle sequence; mirrors `STATUS_ORDER`).
- `config.js:398` — `SORT_FIELDS.rentals` includes `{ field: 'status', label: 'Status', dir: 'asc' }` — the sort option being invoked.
- Also relevant: `invoices`/`serviceOrders` status sorts (`config.js:401`, `:403`) hit the same `case 'status'` string path and would benefit from a status-set-aware ordering (their lifecycle orders live in `RAW_STATUS.invoiceStatus`, etc.).

**Root-cause hypothesis (hypothesis):** The status comparator sorts on the raw string instead of the position within the defined lifecycle. Fix: in `sortRows`, for `case 'status'` return the index of `rec.status` within the relevant ordered status set (`STATUS_ORDER` for rentals — derivable generically from `RAW_STATUS` key order so each card's sort respects its own status set), so ascending = journey front→back and the dir arrow flips to back→front.

**Acceptance criteria:**
- [ ] Sorting rentals by Status (asc) orders rows Quote → Reserved → … → Cancelled → No Show (journey order), not alphabetical.
- [ ] The direction arrow reverses it to journey back→front.
- [ ] The ordering is driven by the canonical status order (`STATUS_ORDER` / `RAW_STATUS` key order), so adding/reordering a status updates the sort with no extra wiring.
- [ ] Derived display states (Tomorrow/Today) sort sensibly within the sequence (or map to their stored `Reserved` slot).
- [ ] `node ci/logic-test.mjs` passes; ideally add a regression asserting journey-order status sort.

**Notes:** Jac framed this as the *first* example of a broader "sort features suck" effort — scope this ticket to the status-sort journey-order fix, but flag that a wider sort overhaul is wanted (a possible follow-up area pass). Status registry edits live in `config.js` (CFG); `STATUS_ORDER` already encodes the lifecycle so reuse it rather than hard-coding a new list. No UI/`WINDOW_CATALOG` change expected.
