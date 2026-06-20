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
| WO photo source | The WO's first EXISTING photo — the linked failed-inspection photo, else the earliest part-line photo. **No new upload UI or stored field** (Jac, 2026-06-20): photos already arrive via Failed Inspections or a part's photo upload, so the resolver only references them. |
| WO lifecycle | Deterministic first-photo (inspection origin wins); backdrop dropped when the WO is Complete |
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

**Surface** — in the `account` template, add the backdrop layer + marker class
only when a source exists:

```
const acctSelfie = latestCustomerSelfie(c);
const account = `<div class="section${acctSelfie ? ' has-photo' : ''}">${
  acctSelfie ? `<div class="sec-photo" style="--photo:url('${esc(acctSelfie)}')"></div>` : ''
}<h4>Account</h4>
  <div class="split"> … existing columns, unchanged … </div>
</div>`;
```

Retired the `selfieThumb` chip + `.cust-selfie` rule — the section is the photo
now.

### B · Work Order backdrop

**No new field, no new UI** (Jac, 2026-06-20). WO photos already exist on the
records — the linked failed-inspection's `photo`, or a part line's `li.photo`
(captured for Mr. Wrangler's photo-autofill). The backdrop only *references* the
first such photo, so it adds **zero new storage** and honors the "no new base64
path" rule by construction.

**Source resolver — `woBackdrop(w)`:**

```
if (!w || w.phase === 'Complete') return '';          // dropped on completion
const insp = w.inspectionId && IDX.insp.get(w.inspectionId);
if (insp && insp.photo) return insp.photo;            // origin: the failed inspection
for (const li of (w.lineItems || [])) if (li.photo) return li.photo;  // else first part photo
return '';
```

- **Deterministic "first photo":** for a Failed WO the inspection photo predates
  any part work, so it wins (the genuine first photo); a Manual WO falls to its
  earliest part-line photo. Both are stable, so the backdrop is effectively
  frozen without a stored field.
- **Dropped on Complete:** the resolver returns `''` for a completed WO → the
  section reverts to plain steel. Only **open** WOs carry a live backdrop — the
  working set stays small by design.

**Surface** — the WO section template (`app.js:3227`) gets the same
`has-photo` + `.sec-photo` backdrop-layer pattern, driven by `woBackdrop(w)`.

### Shared treatment — `.sec-photo` (built + screenshot-reviewed via `jactec-ui`)

One shared backdrop layer for both surfaces (`style.css`, by the `.section` rule):

- The image sits **faded and desaturated** (`filter: grayscale(.5) contrast(.96)`)
  under a **fully tokenized** steel scrim —
  `linear-gradient(180deg, color-mix(in srgb, var(--panel) 82%, transparent),
  color-mix(in srgb, var(--bg) 91%, transparent))` — so it reads as a ghost
  behind the data-plate (industrial first) **and themes itself** for dark /
  light / yard / ranch with no per-theme CSS. Verified: dark = light text on a
  dark scrim, light = dark text on a light scrim, both AA-legible.
- Static; nothing for `prefers-reduced-motion` to disable. Rivets / layout
  unchanged. The backdrop is a background, **not** a lint-family element, so it
  carries **no `data-r`** and adds nothing to `rule-usage.js`.
- Layer is `position:absolute; inset:0; z-index:0; pointer-events:none`; the
  `.section.has-photo` gets `position:relative; overflow:hidden` and its content
  children ride `z-index:1`. Tooltips/menus are `position:fixed` at body level,
  so `overflow:hidden` clips nothing real.
- `esc()` the URL inside `url('…')` — treat the src as untrusted (data-URLs and
  Drive URLs carry no single-quote, so quoting holds).

### Data flow

```
record (DATA)
  ├─ customer: cards[].agreements[] → newest signedAt → signingSelfieSrc → URL
  └─ work order: inspection.photo ?? first lineItems[].photo, gated by phase
        └─ inline --photo var → .section.has-photo .sec-photo backdrop (lazy CSS bg)
```

No async at render; the browser lazy-fetches the referenced URL on view.

### Error / edge handling

- No source → no `has-photo` → today's plain panel (looks intentional).
- URL 404 (deleted) → CSS bg simply doesn't paint; scrim + panel still render;
  no JS error path.
- Customer: multiple signings → newest `signedAt` wins deterministically.
- WO: inspection photo wins over a part photo; completion hides the backdrop.
- Legacy customer with only `c.selfie` → fallback path renders it.

## Testing — DONE

- `ci/logic-test.mjs` (now 68/68): `latestCustomerSelfie` — newest-wins,
  drive-over-base64, multi-card newest, legacy fallback, empty → '';
  `woBackdrop` — first part photo, inspection-photo precedence, Complete → '',
  no source → ''.
- `ci/smoke.mjs`: app boots clean (both templates render without throw).
- Visual self-critique: dark + light Account-backdrop screenshots reviewed
  against `jactec-ui` (ghost-behind-plate, AA contrast, tokenized scrim). The WO
  section reuses the identical `.sec-photo` layer.

## Gates (per CLAUDE.md) — PASSED

- Three gates green: `node ci/smoke.mjs`, `node ci/logic-test.mjs` (68/68),
  `node ci/gen-rule-usage.mjs --check` (current — no `data-r` change).
- Shared `?v=` token bumped `20260619n → 20260620a` on `style.css` /
  `rule-usage.js` / `app.js` in `index.html`.
- Ship via feature branch → PR → squash-merge (main is branch-protected).
