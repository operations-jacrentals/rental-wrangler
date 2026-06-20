# Offload record photos to Drive (de-bloat the payload)

**Date:** 2026-06-20
**Status:** Approved (design) — ready for implementation plan
**Surfaces:** inspection capture (`app.js:9694`), part-line photo save
(`savePartForm`, ~`app.js:9366`), the bulk sync (`computeChanges`,
`app.js:11245`), a new guarded admin **sweep** action.

## Summary

Captured photos ride the records as inline **base64**, so they bloat both the
Sheet and the bulk cold-load payload. This offloads them to **Drive URLs** —
the same treatment selfies and capture-videos already get — so a record carries
a ~60-byte URL instead of ~30–80 KB of image. Two parts:

1. **Forward offload** — new inspection/part photos upload to Drive at capture;
   the field swaps to the URL and the base64 is cleared.
2. **One-time migration** — a guarded, client-side **one-shot sweep** offloads
   every base64 photo already sitting in the Sheet.

## The problem (confirmed)

- `computeChanges()` (`app.js:11245`) sends each record as a full
  `JSON.stringify(r)` with **no media stripping**, and `refreshFromBackend`
  pulls the same back on every `load`. So a captured `inspection.photo`
  (~30–80 KB base64) and a part `li.photo` ride the **Sheet sync AND the bulk
  cold-load payload** — exactly the scaling risk the backdrop work surfaced.
- Capture **videos** already dodge this: `uploadCaptureMedia` (`app.js:9272`)
  uploads to Drive via the `uploadCapture` backend action and stores only the
  URL. Selfies too: `app.js:394` swaps `r.selfieUrl → driveSelfieUrl` and clears
  the base64. Inspection/part **photos were never given the same treatment.**
- Secondary risk: a Sheets cell caps at ~50 k chars (see the comments at
  `app.js:9278`, `:9888`). A large photo can be **truncated or rejected** — a
  correctness bug, not just bloat.

## Decisions (locked 2026-06-20)

| Question | Decision |
|---|---|
| Scope | **Forward + migrate existing** (both new captures and the backlog) |
| Migration mechanism | **Client one-shot sweep** — a guarded admin pass reusing `uploadCapture`; no new backend code if that action is already generic |
| Field convention | **Same-field swap** — `photo` / `li.photo` holds the URL afterward (they are already URL-or-base64), **not** a second `driveUrl` field |
| Photo-loss tolerance | **Never lose a photo** — keep base64 until Drive confirms, then clear |
| Part-photo AI autofill | Feed the in-memory base64 to Mr. Wrangler **before** offloading/clearing |
| Execution of the live migration | **Jac runs the sweep** in the authenticated live app; Claude builds it but cannot run it against production |

## Non-goals

- No change to the selfie / capture-video paths (already offloaded).
- No new backend action **if** `uploadCapture` already accepts a generic
  `{dataUrl, name}` → `{ok, url}` (it is used for videos today). If it needs a
  tweak, the spec ships a paste-in `Code.gs` snippet for Jac to deploy — but the
  default assumption is **reuse, no Code.gs change**.
- Not the Mr. Wrangler chat-rail IndexedDB refactor (separate parked spec).
- No re-encoding pipeline; photos are already downscaled at capture
  (600 px / 0.5 JPEG).

## Architecture

### A · `offloadPhoto(rec, field, name)` — the shared helper

```
offloadPhoto(rec, field, name):
  const v = rec[field];
  if (!v || !v.startsWith('data:')) return;          // idempotent: already a URL / empty
  if (!backendPassword) return;                       // demo/offline: leave base64
  backendCall('uploadCapture', { dataUrl: v, name })
    .then((res) => {
      if (res && res.ok && res.url && rec[field] === v) {   // unchanged since upload
        rec[field] = res.url; reindex(<coll>, rec); saveSoon();
      }
    });
  // on failure / offline: base64 stays; re-attempted next capture or next sweep
```

- **Same-field swap:** because `inspection.photo` and `li.photo` are already
  URL-or-base64, every reader — the `woBackdrop` resolver (PR #179), the
  inspection thumb (`app.js:4131`), the part-form preview — keeps working with
  **zero changes**. No regression to the backdrop feature.
- **Never lose a photo:** base64 is cleared only after Drive returns a URL; a
  failed/offline upload leaves the record exactly as-is.

### B · Forward call sites

- **Inspection capture** — after `n.photo = out` (`app.js:9694`), call
  `offloadPhoto(n, 'photo', 'insp_' + n.inspectionId)`.
- **Part-line photo** — in the `savePartForm` → autofill flow: the AI autofill
  (`autofillPartLine`, `app.js:9321`) reads the **in-memory base64 first**; then
  `offloadPhoto(li, 'photo', 'wopart_' + w.woId + '_' + li.lid)` swaps the line's
  photo to a URL. Order matters: vision read before clear.

### C · The one-shot sweep (migration)

A guarded admin action (behind the operator/settings gate, `data-r` stamped):

```
sweepPhotosToDrive():
  collect targets = [
    ...DATA.inspections where photo.startsWith('data:'),
    ...DATA.workOrders.flatMap(w => w.lineItems where li.photo.startsWith('data:')) ]
  run offloadPhoto over targets with concurrency ≤ 3 (throttle Drive)
  live progress "offloaded N / total"; abortable; idempotent on re-run
  normal saveSoon/flushSave persists the swapped URLs (no special write path)
```

- **Idempotent / resumable:** re-running skips anything already a URL, so a
  mid-sweep close just resumes next run.
- **Throttled:** small concurrency so one browser session doesn't hammer Drive.
- **Abortable:** a stop control; partial progress is already persisted.

### Data flow

```
capture → rec.photo = base64
   ├─ (part) → Mr. Wrangler reads base64 → autofill
   └─ offloadPhoto → uploadCapture → Drive URL → rec.photo = url → saveSoon
backlog → sweep → offloadPhoto per base64 photo → URLs → sync
result → records carry ~60-byte URLs; bulk payload stops shipping image data
```

## Failure & edge handling

- Upload fails / offline → base64 untouched; retried on next capture or sweep.
  **A photo is never lost or blanked.**
- `uploadCapture` non-ok → toast, leave base64, count as "skipped".
- Mid-sweep close → idempotent; re-run resumes.
- Already-URL photos (mock / legacy monday.com URLs) → skipped, untouched.
- `rec[field]` changed during the in-flight upload (re-captured) → the guard
  `rec[field] === v` aborts the stale swap.
- Backdrop (PR #179) and thumbs read the same field → no regression.

## Testing

- `ci/logic-test.mjs` (stub `backendCall`):
  - `offloadPhoto` — no-op on a URL / empty; swaps a `data:` value to the
    returned URL on ok; leaves base64 on a failure; honors the
    `rec[field] === v` stale-guard.
  - sweep target-collection counts only `data:` photos (inspections + nested
    `lineItems`); a second pass finds zero (idempotent).
- `ci/smoke.mjs`: app boots; the sweep action renders behind its gate without
  throwing.
- Manual (Jac, live): capture a new inspection photo → the Sheet cell holds a
  **URL**, not base64; run the sweep once and watch the count drain to zero.

## Gates (per CLAUDE.md)

- The sweep control is an admin-toolbar **`iconbtn`** matching its siblings
  (`js-lint` / `js-inspect` / `js-rulebook`) — those carry **no `data-r`**
  (iconbtn isn't a lint-family element), so the sweep button doesn't either and
  `rule-usage.js` is unchanged. (Corrects this spec's earlier §5-builder
  assumption — the established pattern is the plain admin iconbtn.)
- Three gates: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check` (port-swap 8000→9147 first, restore `ci/`).
- Bump the shared `?v=` token in `index.html`.
- Ship via feature branch → PR → squash-merge (main is branch-protected).

## Open item for Jac

`Code.gs` is gitignored, so confirm `uploadCapture` accepts a generic
`{dataUrl, name}` and returns `{ok, url}` (it is wired for videos). If it does,
**no backend change** is needed. If it's video-specific, the appendix below has a
paste-in handler.

## Appendix — `Code.gs` paste-in (ONLY if `uploadCapture` isn't already generic)

The frontend already calls `backendCall('uploadCapture', { dataUrl, name })` and
expects `{ ok: true, url }`. The capture-video path proves an action like this
exists; it most likely already accepts an arbitrary `dataUrl` + `name`. Paste/
adapt this **only if** the existing action rejects a non-video payload. Reconcile
the folder + auth bits with the real file (this is gitignored and not in the repo,
so the exact helpers here are illustrative):

```javascript
// uploadCapture: decode a base64 data URL, save it to the media Drive folder,
// return a shareable URL. Generic over {dataUrl, name} — photos and videos alike.
function uploadCapture_(p) {
  if (!p || !p.dataUrl) return { ok: false, error: 'no dataUrl' };
  var m = String(p.dataUrl).match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return { ok: false, error: 'not a base64 data URL' };
  var mime = m[1];
  var bytes = Utilities.base64Decode(m[2]);
  var ext = (mime.split('/')[1] || 'bin').replace('jpeg', 'jpg');
  var safe = String(p.name || 'capture').replace(/[^A-Za-z0-9_\-]/g, '_');
  var blob = Utilities.newBlob(bytes, mime, safe + '.' + ext);
  var folder = getMediaFolder_();                 // reuse the existing capture/Drive folder helper
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // Match whatever URL shape the app already stores for capture videos / selfies:
  return { ok: true, url: 'https://drive.google.com/uc?export=view&id=' + file.getId() };
}
```

Notes: `name` already arrives collision-resistant from the client
(`insp_<id>`, `wopart_<woId>_<lid>`). If the existing action returns a different
URL shape, keep that shape — the app just stores the string and renders it as an
`<img>`/CSS background, so any link Drive serves inline works.
