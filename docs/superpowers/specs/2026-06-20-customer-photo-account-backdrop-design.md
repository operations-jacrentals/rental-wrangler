# Photo backdrops — Account + Work Order (scale-safe)

**Date:** 2026-06-20
**Status:** Approved (design, v2) — ready for implementation plan
**Surfaces:** Customers standard view → Account section (`app.js:3830`);
Work Orders standard view → WO section (`app.js:3227`)

## Summary

A record's most relevant photo becomes the **faded backdrop of its section**,
in the "yard data-plate" language (a ghost behind the steel panel, never a
glamour shot):

- **Customer Account section** — the newest agreement selfie. Self-updating:
  a newer signing's selfie wins automatically.
- **Work Order section** — the WO's **first** photo, **frozen** (never changes).
  The backdrop is **dropped once the WO is Complete**, so only open WOs ever
  carry one.

The unifying constraint — and the reason this is a single spec — is **scale
safety**: at thousands of customers and a long tail of work orders, a backdrop
must cost a lazy-loaded Drive URL per *viewed* card, never inline image data in
the bulk payload.

## The scaling problem (why this is one spec, not cosmetics)

The danger is **not** localStorage — these photos aren't stored there. They ride
on records in `DATA`, which the app pulls **in bulk on every cold load**. So the
real failure mode at thousands of customers is an **inline base64 selfie**
(~30–80 KB) on every record: opening the app would download every face every
load — tens to hundreds of MB of payload, fat Sheet cells, slow boot, memory
pressure. A background viewed one-at-a-time must never cost shipping all of them
to every device at startup.

**The discipline (load-bearing, not optional):**

1. **Reference, don't embed.** The backdrop source must be a **Drive URL**
   (~60 bytes on the record), never inline base64 in the bulk payload.
2. **Lazy-load per view.** The browser fetches the one image only when that
   card is actually rendered (CSS background on a `.section` that exists only
   for the open record). One face on demand, not thousands at boot.
3. **No new path may re-embed base64** into a record that loads in bulk.

The selfie path already enforces this: `app.js:394` —
`if (r.selfieUrl) { sig.driveSelfieUrl = r.selfieUrl; sig.selfie = ''; }` swaps
the Drive URL in and **clears** the base64 on sync. base64 exists only in the
brief pre-upload window; the steady state is a URL.

## Decisions (locked 2026-06-20)

| Question | Decision |
|---|---|
| Customer photo source | Newest agreement signing's selfie across the customer's cards |
| WO photo source | First photo uploaded to the WO; else the linked inspection's photo |
| WO lifecycle | Frozen on first set; backdrop dropped when the WO is Complete |
| Treatment (both) | Full-bleed faded backdrop behind the section, steel scrim |
| Privacy / control | Always auto-show, no toggle |
| Source representation | Drive URL preferred (lazy-loaded); base64 only as transient fallback |
| Existing selfie thumb | Retired — the section is the photo now |

## Non-goals

- No change to localStorage / IndexedDB. The Mr. Wrangler **chat-rail** storage
  refactor (hybrid Blob-now / Drive-on-file in IndexedDB) is a **separate,
  parked spec** — different problem (local device history), not this.
- No backdrop on the compact/grid card face — standard view sections only.
- No toggle / hide control (decided).
- No re-encoding or thumbnail-derivative pipeline; the existing downscaled
  capture (selfie ≈ 1200px / 0.6 JPEG) is enough for a faded background.

## Architecture

### A · Customer Account backdrop

**Source — `latestCustomerSelfie(c)`** (pure resolver near `signingSelfieSrc` /
`cardSignings`, ~`app.js:258`–`289`):

```
1. customerCards(c).flatMap(cardSignings)          // every signing
2. keep those with a selfie source                  // driveSelfieUrl || selfie
3. pick newest by signedAt                           // ties → last in order
4. return signingSelfieSrc(newest)                   // PREFERS driveSelfieUrl
5. fallback: legacy customer-level c.selfie
6. else '' → no backdrop
```

**Surface** — in the `account` template (`app.js:3830`), add a backdrop layer
and marker class only when a source exists:

```
const selfie = latestCustomerSelfie(c);
const account = `<div class="section sec-account${selfie ? ' has-photo' : ''}">
  ${selfie ? `<div class="acct-photo" style="--photo:url('${esc(selfie)}')"></div>` : ''}
  <h4>Account</h4>
  <div class="split"> … existing columns, unchanged … </div>
</div>`;
```

Retire the `selfieThumb` chip + `.cust-selfie` rule (`app.js:3823`, `:3839`) —
the section is the photo now.

### B · Work Order backdrop

**New persisted field:** `w.bgPhotoUrl` — a Drive URL, **written once** when the
WO's first photo is attached, then immutable.

**New capability:** attach a photo to a WO. Reuse the existing Drive upload
infra (`uploadCapture` backend action / `uploadCaptureMedia`, `app.js:9272`):
the file uploads to Drive, the returned URL is stored in `w.bgPhotoUrl` (and may
also feed an attachments list later — out of scope here). The upload affordance
lives in the WO section header (an `addBtn`/icon, `data-r` stamped).

**Source resolver — `woBackdrop(w)`:**

```
if (w.phase === 'Complete') return '';          // dropped on completion
if (w.bgPhotoUrl) return w.bgPhotoUrl;          // frozen first upload
const insp = w.inspectionId && IDX.insp.get(w.inspectionId);
if (insp && insp.photo) return insp.photo;      // fallback: spawning inspection
return '';
```

- **Frozen:** once `w.bgPhotoUrl` is set it never changes (the first photo wins;
  later uploads don't replace the backdrop).
- **Dropped on Complete:** the resolver returns `''` for a completed WO → the
  section reverts to plain steel. The stored `w.bgPhotoUrl` is *kept* (cheap, a
  URL) so the field is stable, but it's simply not rendered. Only **open** WOs
  carry a live backdrop — the working set stays small by design.

**Surface** — the WO section template (`app.js:3227`) gets the same
`has-photo` + `.acct-photo`/`.wo-photo` backdrop-layer pattern, driven by
`woBackdrop(w)`.

### Shared treatment — runs through `jactec-ui`

Built and screenshot-reviewed through the `jactec-ui` skill before showing Jac.
Direction (not final CSS):

- The image sits **faded and desaturated** under a steel scrim
  (`linear-gradient(180deg, rgba(27,33,41,.86), rgba(12,14,17,.92))`) so it
  reads as a ghost behind the data-plate — industrial first.
- Text contrast preserved (stamped label, fields, derived rows stay legible —
  quality-floor contrast check).
- Static; reduced-motion respected. Rivets / layout unchanged. The backdrop is
  a background, not a new component.
- Backdrop layer is absolutely positioned, `inset:0`, behind content; the
  `.section` variant gets `position:relative; overflow:hidden`.
- `esc()` the URL inside `url('…')` — treat the src as untrusted.

### Data flow

```
record (DATA)
  ├─ customer: cards[].agreements[] → newest signedAt → signingSelfieSrc → URL
  └─ work order: w.bgPhotoUrl (frozen) ?? inspection.photo, gated by phase
        └─ inline --photo var → .section.has-photo backdrop (lazy CSS bg)
```

No async at render; the browser lazy-fetches the referenced URL on view.

### Error / edge handling

- No source → no `has-photo` → today's plain panel (must look intentional).
- Drive URL 404 (deleted) → CSS bg simply doesn't paint; scrim + panel still
  render; no JS error path.
- Customer: multiple signings → newest `signedAt` wins deterministically.
- WO: first upload frozen; completion hides (not deletes) the backdrop.
- Legacy customer with only `c.selfie` → fallback path renders it (transient
  base64 until/unless migrated to a Drive URL).

## Testing

- `ci/logic-test.mjs`:
  - `latestCustomerSelfie` — newest-wins, drive-over-base64, legacy fallback,
    empty → ''.
  - `woBackdrop` — frozen `bgPhotoUrl` wins; inspection-photo fallback; Complete
    → ''; no source → ''.
- `ci/smoke.mjs`: customer + WO standard views render with and without a source
  (no throw; `has-photo` present only when a source exists; completed WO shows
  no backdrop).
- Manual: signed customer shows faded face; new customer shows plain panel;
  signing a newer agreement swaps the face. Open WO with a photo shows the
  backdrop; completing it reverts to steel; a second upload does not change it.

## Gates (per CLAUDE.md)

- Build/review the visual through the `jactec-ui` skill; screenshot +
  self-critique before showing Jac.
- The WO upload affordance carries a `data-r` stamp → regenerate `rule-usage.js`
  (`node ci/gen-rule-usage.mjs`). A pure backdrop adds none.
- Pass the three gates: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check` (port-swap 8000→9147 first, restore
  `ci/` after).
- Bump the shared `?v=` token on `style.css` / `app.js` / `rule-usage.js` in
  `index.html`.
- Ship via feature branch → PR → squash-merge (main is branch-protected).
