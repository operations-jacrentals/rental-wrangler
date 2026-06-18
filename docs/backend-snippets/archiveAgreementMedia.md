# Backend handler — `archiveAgreementMedia` (Drive offload for signed agreements)

The frontend (`signCardAgreement` → `archiveAgreementMedia` in `app.js`) freezes a
signing onto a card with the selfie + signature **inline as data-URLs**, then immediately
calls the backend action `archiveAgreementMedia`. Until this handler is deployed the call
just returns `{ ok:false }` and the images stay inline (harmless). Once deployed, the
images move to Drive and the heavy data-URLs are dropped from the synced customer record
(keeps each customer well under the ~50k-char Sheets cell cap).

**This is `backend/Code.gs` (gitignored, deployed by paste via clasp / the Apps Script
editor — Claude can't deploy it). Add the function and wire it into your action
dispatcher next to the existing `uploadCapture` case.**

## Request the frontend sends
```json
{ "action": "archiveAgreementMedia", "password": "…",
  "customerId": "C0009", "cardId": "CARD-…", "signingId": "SIG-…",
  "signerName": "Devin Lyles", "signedAt": "2026-06-18",
  "signature": "data:image/jpeg;base64,…", "selfie": "data:image/jpeg;base64,…" }
```

## Response the frontend expects
```json
{ "ok": true,
  "signatureUrl": "https://drive.google.com/uc?export=view&id=…",
  "selfieUrl":    "https://drive.google.com/uc?export=view&id=…",
  "folderId": "…" }
```
Either URL may be omitted if that image wasn't sent; the frontend only clears the inline
copy for the URLs it gets back.

## Handler
```javascript
// Root folder for all signed-agreement media. Create once, paste its id here, OR let
// the helper create/find it by name on first use.
var AGREEMENTS_ROOT_NAME = 'Rental Wrangler — Signed Agreements';

function archiveAgreementMedia(p) {
  // p.password is already verified by your dispatcher (same as uploadCapture).
  var root = getOrCreateFolder_(DriveApp, AGREEMENTS_ROOT_NAME);
  var custFolder = getOrCreateChildFolder_(root, String(p.customerId || 'unknown'));

  var out = { ok: true, folderId: custFolder.getId() };
  var base = [p.customerId, p.cardId, p.signingId].filter(String).join('_');

  if (p.signature) out.signatureUrl = saveDataUrl_(custFolder, base + '_signature', p.signature);
  if (p.selfie)    out.selfieUrl    = saveDataUrl_(custFolder, base + '_selfie',    p.selfie);
  return out;
}

// data:<mime>;base64,<data>  ->  a shared Drive file -> a viewable URL
function saveDataUrl_(folder, name, dataUrl) {
  var m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return '';
  var mime = m[1], bytes = Utilities.base64Decode(m[2]);
  var ext = mime.indexOf('png') >= 0 ? '.png' : '.jpg';
  var blob = Utilities.newBlob(bytes, mime, name + ext);
  var file = folder.createFile(blob);
  // Anyone-with-link view so the app + the PDF print view can <img src> it.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function getOrCreateFolder_(drive, name) {
  var it = drive.getFoldersByName(name);
  return it.hasNext() ? it.next() : drive.createFolder(name);
}
function getOrCreateChildFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
```

## Wire it into the dispatcher
In your `doPost` action switch (where `uploadCapture` already lives):
```javascript
case 'archiveAgreementMedia': return json_(archiveAgreementMedia(body));
```
(Use whatever your existing `json_`/response helper is — match `uploadCapture`.)

## Notes
- **Immutability:** the signing's `version` id + the frozen text registry in
  `agreements.js` keep the legal text immutable; this handler only relocates the images.
- **Backfill (optional):** existing inline signings offload themselves the next time
  that customer is signed/edited (the frontend retries on each sign). A one-time sweep
  isn't required.
- **Sharing scope:** `ANYONE_WITH_LINK · VIEW` is needed for `<img>` embedding. If that's
  too open for your Drive policy, store the file id instead and proxy the bytes through a
  separate authenticated `getAgreementMedia` action — tell Claude and we'll wire that path.
