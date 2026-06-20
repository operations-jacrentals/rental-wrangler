# Customer photo → Account-section backdrop

**Date:** 2026-06-20
**Status:** Approved (design) — ready for implementation plan
**Surface:** Customers card, standard view, Account section (`app.js:3830`)

## Summary

The most recent customer photo automatically becomes the **faded backdrop of
the Account section** in a customer's standard view. The photo is the selfie
captured during agreement signing — already stored on the customer's card-bound
agreements — so nothing new is captured. As newer agreements get signed, the
newest selfie wins automatically.

This replaces the tiny `cust-selfie` thumbnail that lives in the Account
section's right column today: the section *becomes* the photo instead of
carrying a small chip of it.

## Goals

- A customer's face gives their record an at-a-glance identity, in the
  "yard data-plate" language (the photo reads as a ghost behind the steel
  panel, never a glamour shot).
- Zero new capture, zero backend/schema change — read what's already on the
  record.
- Self-updating: the newest signing's selfie is always the one shown.

## Non-goals

- No new photo capture or upload flow.
- No toggle / hide control — the newest selfie always shows (decided 2026-06-20).
- No change to any card other than Customers, or any section other than
  Account.
- **Not** related to the IndexedDB chat-rail storage work (parked separately,
  see `## Relationship to the storage spec`). This feature reads record fields,
  not localStorage.

## Decisions (locked 2026-06-20)

| Question | Decision |
|---|---|
| Photo source | Newest agreement signing's selfie across all the customer's cards |
| Treatment | Full-bleed faded backdrop behind the Account section, steel scrim |
| Privacy / control | Always auto-show, no toggle |
| Existing thumb pill | Retired — the section is the photo now |

## Architecture

### 1 · Photo source — `latestCustomerSelfie(c)`

A new pure resolver (sits near the existing `signingSelfieSrc` /
`cardSignings` helpers, ~`app.js:258`–`289`):

```
latestCustomerSelfie(c) →
  1. collect every signing across the customer's cards:
       customerCards(c).flatMap(cardSignings)
  2. keep those with a selfie source (driveSelfieUrl || selfie)
  3. pick the one with the newest signedAt
  4. return signingSelfieSrc(newest)        // driveSelfieUrl || selfie
  5. fallback: legacy customer-level c.selfie
  6. else '' (no backdrop)
```

- **Prefer the Drive URL.** `signingSelfieSrc` already returns
  `driveSelfieUrl || selfie`, so a signed-and-uploaded agreement yields a light
  URL; only un-uploaded captures fall back to the base64 blob. This keeps the
  DOM light — a base64 image in a CSS background is re-parsed on every render.
- Pure function of the record; no I/O, independently testable. Add a case to
  `ci/logic-test.mjs` (newest-wins, drive-over-base64, legacy fallback, empty).

### 2 · Surface & DOM

In the customers standard view (`app.js:3830`), the `account` template gains a
backdrop layer and a marker class **only when a selfie exists**:

```
const selfie = latestCustomerSelfie(c);
const account = `<div class="section sec-account${selfie ? ' has-photo' : ''}">
  ${selfie ? `<div class="acct-photo" style="--acct-photo:url('${esc(selfie)}')"></div>` : ''}
  <h4>Account</h4>
  <div class="split"> … existing two columns, unchanged … </div>
</div>`;
```

- The `.acct-photo` layer is absolutely positioned and fills the section,
  sitting **behind** the content (the steel scrim + content render above it via
  stacking context). `.section` gets `position:relative` / `overflow:hidden` on
  the `.sec-account` variant only.
- `esc()` the URL inside the `url('…')` to neutralize quote/paren breakouts
  (selfie src is a data URL or a Drive URL; treat as untrusted).
- Empty source → no `has-photo`, no `.acct-photo` node → today's exact plain
  steel panel. Pure additive; nothing else moves.
- Retire the `selfieThumb` chip from the right column's `kvPills(...)` at
  `app.js:3839` (it becomes redundant). The `selfieThumb` const and its
  `.cust-selfie` rule are removed.

### 3 · Treatment — runs through `jactec-ui`

The visual is built and screenshot-reviewed through the `jactec-ui` skill before
showing Jac. Direction (not final CSS):

- The face sits **faded and desaturated** under a steel scrim
  (`linear-gradient(180deg, rgba(27,33,41,.86), rgba(12,14,17,.92))` over the
  image) so it reads as a ghost behind the data-plate — industrial first,
  never a portrait.
- Text contrast preserved (stamped `Account` label, fields, derived rows all
  stay legible against the scrim — quality-floor contrast check).
- Static — no parallax/animation; reduced-motion is a non-issue but respected.
- Rivets / stamped label / existing layout unchanged. The photo is a
  background, not a new component.

### 4 · Data flow

```
customer record (DATA)
  └─ cards[].agreements[]  ──cardSignings──▶ newest signing by signedAt
                                              └─ signingSelfieSrc → URL/blob
                                                  └─ inline --acct-photo var
                                                      └─ .acct-photo backdrop
```

No async, no fetch, no storage write. Render-time read only.

### 5 · Error / edge handling

- No agreements / no selfie → no backdrop (plain panel). Most-common new-customer
  state; must look intentional, not broken.
- Drive URL present but image 404s (deleted in Drive) → CSS background simply
  doesn't paint; the scrim + steel panel still render fine. No JS error path.
- Multiple cards, multiple signings → newest `signedAt` wins deterministically;
  ties broken by array order (last signed).
- Legacy customers with only `c.selfie` and no card agreements → fallback path
  shows the legacy selfie.

## Relationship to the storage spec

Separate feature. The earlier discussion (robust IndexedDB storage for the
Mr. Wrangler chat rail + feedback queue, hybrid Blob-now/Drive-on-file) is
**parked** as its own spec. This backdrop feature reads selfies straight off
the customer record and touches neither localStorage nor IndexedDB. They share
only a philosophy: prefer a Drive URL over an inline base64 blob.

## Testing

- `ci/logic-test.mjs`: `latestCustomerSelfie` — newest-wins across cards,
  drive-over-base64 preference, legacy `c.selfie` fallback, empty → ''.
- `ci/smoke.mjs`: customers standard view renders with and without a selfie
  (no thrown error, `has-photo` present only when a selfie exists).
- Manual: a customer with a signed agreement shows the faded face; a brand-new
  customer shows the plain panel; signing a newer agreement swaps the face.

## Gates (per CLAUDE.md)

- Build/review the visual through the `jactec-ui` skill; screenshot +
  self-critique before showing Jac.
- If any new affordance carries a `data-r` stamp, regenerate
  `rule-usage.js` (`node ci/gen-rule-usage.mjs`) — a pure backdrop likely adds
  none.
- Pass the three gates: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check` (port-swap 8000→9147 first, restore
  `ci/` after).
- Bump the shared `?v=` token on `style.css` / `app.js` / `rule-usage.js` in
  `index.html`.
- Ship via feature branch → PR → squash-merge (main is branch-protected).
