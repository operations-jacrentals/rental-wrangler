# Backend / Data — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/backend-data`
**Task branch:** `backend-data/spec` (proposed)
**Maturity:** ✅ Shipped (documenting the live system as canon + the next hardening steps)
**Scope:** The data contract between the SPA and the Google Apps Script / Sheets backend — the 11-entity schema, the single `backendCall` entry point, the diff-sync engine, the live multi-user polling refresh, and the rules every future backend action must honor.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions and the §3 central gate question (D3).

- **D1 · Per-role passwords + server-side tier enforcement (resolves OQ-1 & OQ-13). ⭐ Keystone.** Move from the **single shared team password** to **per-role passwords**: each role (staff / money / manager / admin) has its own password; the server maps **password → tier** and **enforces money + admin actions server-side** (`stripe*`, `recordManualPayment`, the fund-movement part of WO→invoice billing, `setConfig`, `seed`, accounting period-close/export). Revocation = rotate one role's password (no team-wide disruption). The `auth` reply's role becomes **authoritative** (server-derived), not advisory. **This unblocks the decisions that were waiting on it:** the **dual-approver refund** (`invoicing-payments` D2, which needs a second role-password), the **server-checked money writes** (`maintenance-shop` D2), and **accounting's deferred Q13**. A real `Code.gs` change → `/clasp`, Phase 3 hardening. *(Consistent with the open-visibility posture: per-role passwords gate money/admin **actions** + revocation, not data **visibility** — all roles still load all data.)*
- **D2 · Drive media stays anyone-with-link (resolves OQ-7).** Keep `uc?export=view&id=` URLs for selfies/agreements (unguessable ids; accepted exposure). No signed-URL work.

**Defaults adopted:** OQ-2 → `backendVersion` + capability negotiation · OQ-3 → CI lint asserting `PERSIST_KEYS`/`PERSIST_ID`/`IDX_MAP` key-parity · OQ-5 → per-entity sync applied/rejected counts · OQ-14 → **Stripe idempotency keys** on `stripeChargeInvoice`/`recordManualPayment` · OQ-12 → fix the `wrangler-needs-jac` label drift via `/clasp` (Phase 1) · OQ-6 → pricing floors stay **client-hide** (per `units-fleet` D1; no server-redaction) · OQ-11 → record-level last-clean-writer-wins + invoice action-locks (no field-level merge) · OQ-9 → no always-on sync pulse (silence = saved) · OQ-10/OQ-4 → admin Health plate + `health` probe deferred (optional) · OQ-8 → server audit log deferred (revisit with compliance) · OQ-15 → durable offline queue is `frontend-performance` scope.

---

## 1. Goal & Problem

### What this area is for
Backend / Data is **the seam where the in-browser app and the real database meet.** Everything else in Rental Wrangler is a renderer or a derivation over one in-memory `state`/`DATA` object; this area owns *how that object is loaded, saved, kept in sync across multiple operators, and protected from corruption / loss.* It is the **single trust boundary** between a public, source-readable SPA (served by GitHub Pages) and the live customer database (a Google Sheet behind an Apps Script web app).

### The business / user problem
JacRentals runs the yard from phones and a desk at the same time — a driver marks a unit Off Rent on a tablet while Office takes a card payment on a laptop and the owner reviews margins on a phone. Without a reliable shared backend:
- edits made on one device never reach another (the original multi-user bug: a comment stayed invisible until the other user reloaded);
- a flaky cell connection silently drops a write and money/dispatch facts vanish with no warning;
- a 1.7 MB whole-state save on every keystroke is too slow to be usable at real volume.

This area exists so the answer to *"is my edit saved, and does everyone see it?"* is **always yes, or visibly no** — never silently lost.

### Why it matters
This is the **highest-blast-radius non-money area** in the app. A bug here doesn't mis-price one rental — it can lose or overwrite the whole database, leak the team password, or wedge the sync so the yard runs on stale data. It is also the **chokepoint every other area depends on** (see §12): every entity area persists *through* this contract, and every integration (Stripe, Maps, Wrangler AI, comms) routes through the one `backendCall` entry point.

### North star
> **One normalized state, one entry point, diff-synced, multi-user-live, never-silently-lost, and never a secret in the public bundle.** Every new backend behavior is an *additive* action on `backendCall` that preserves those five properties.

---

## 2. Current State (Baseline) — the live system AS CANON

The sync layer is **fully operational and shipped on `main`.** Anchors below are live `file:line` references (Code Atlas chapter `APP-38 · §18b`, `app.js:15628`+).

### 2.1 The one entry point — `backendCall` (shipped)
`backendCall(action, extra)` (`app.js:15650`) is the **only** function that talks to the backend.

```js
const BACKEND_URL = 'https://script.google.com/macros/s/…/exec';   // app.js:15637 (public by design; useless without the password)
async function backendCall(action, extra) {
  const payload = Object.assign({ action, password: backendPassword }, extra || {});
  const res = await fetch(BACKEND_URL, { method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },        // text/plain dodges the GAS CORS preflight
    body: JSON.stringify(payload) });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { ok:false, error: res.ok ? 'bad-json' : ('http-'+res.status) }; }
  if (!res.ok && body && body.ok === undefined) body = { ok:false, error: 'http-'+res.status };
  return body;   // ALWAYS {ok,...} — never throws a parse error up to callers
}
```

**Canon properties (do not regress):**
- **POST `text/plain`** — deliberately avoids the CORS preflight that GAS web apps can't answer.
- **Password on every call** — `backendPassword` (from `sessionStorage['jactec.pw']`) rides every request. The URL alone is inert.
- **Defensive parse** — a GAS error page (500 / quota / auth HTML) is *not JSON*; `backendCall` catches it and hands the caller `{ok:false, error}` (mappable via `friendlyPayErr`) rather than throwing. A real card/charge failure must never be masked as a generic "Network error" (#220).
- **Never coerce failure into success** — `ok === undefined` becomes `{ok:false}`.

### 2.2 The persistence model — diff-based sync (shipped)
| Constant | Value | Where |
|---|---|---|
| `PERSIST_KEYS` | 11 entities: `categories, units, customers, invoices, rentals, workOrders, inspections, vendors, parts, companyFiles, expenses` | `app.js:15638` |
| `PERSIST_ID` | id field per entity (`categories→categoryId`, `units→unitId`, … `companyFiles→fileId`, `expenses→expenseId`) | `app.js:15687` |
| `IDX_MAP` | entity key → in-memory index name (`workOrders→wo`, `companyFiles→file`, …) | `app.js:15711` |

Whole-state seed doesn't scale (~1.7 MB / ~10 s at real volume), so:
- `snapshotSaved()` (`app.js:15689`) caches *what the backend last held* as `{entity: Map(id → JSON)}` (`lastSaved`).
- `computeChanges()` (`app.js:15693`) diffs live `DATA` against `lastSaved` → `{upserts, deletes, n}`. A one-field edit becomes a few-hundred-byte, sub-second call. Empty mock drafts are held out (`isEmptyMockDraft`, `app.js:2080`) until they earn content (#227).
- `flushSave()` (`app.js:15919`) is the debounced writer: offload base64 photos → re-diff → hold oversized records → `backendCall('sync', {upserts, deletes})` → commit **only what was sent** to `lastSaved` (mid-flight edits stay dirty and re-flush).
- `saveSoon(ms)` (`app.js:15851`) debounces at 1200 ms; `logAction` and `reindex` paths call it.

### 2.3 Load & seed (shipped)
- `loadFromBackend()` (`app.js:15664`) hydrates all `PERSIST_KEYS` on sign-in. **Never auto-seeds on empty** — a transient blank read can't overwrite real data; it also adopts server-shipped `settings` (admin customizations sync to every role; an empty server is left alone).
- `seed` is fired **only** from `#reseed` (`reseedFromFile`, `app.js:16482`), an admin recovery path that REPLACES the whole DB from `data.js` — guarded by the password, an explicit confirm, AND a **shrink-refusal** (refuses to overwrite a populated live DB with a smaller file, `app.js:16494`).

### 2.4 Live multi-user refresh (shipped)
`refreshFromBackend()` (`app.js:15713`) + `startRefreshPoll()` (18 000 ms interval, `app.js:15753`):
- Polls `load`; for each record, **adopts the remote version only if the local copy is CLEAN** (`saved.get(id) === JSON.stringify(local)`); a record with unsaved local edits is kept and pushes on the next save.
- **Never deletes on refresh** (a blip can't wipe data) and **never disrupts active work** — bails if `document.hidden`, a drag is live, an overlay/picker is open, the user is mid-hover, or focus is in an INPUT/TEXTAREA.
- Also pulls shared team-chat threads (`getChats`, union-merge by id) and the per-role Mr. Wrangler rail.

### 2.5 Sync-health safety net (shipped — R25)
- `SYNC = {failing, fails, backoff}` (`app.js:15858`). A failed flush retries with **exponential backoff** (1200 ms → ×2, capped 30 s). After **≥2 consecutive fails** it raises the **R25 "Not saving"** banner (`renderSyncBanner`, `app.js:15956`) — a red hazard-stripe plate mounted on `<body>` (outside `#app` so `render()` can't wipe it) with a **Retry now** action; clears + toasts "Back online" on recovery.
- `beforeunload` (`app.js:15978`) kicks a final flush and triggers the browser's unsaved-changes prompt if anything is un-persisted (#164).

### 2.6 Oversized-record fault isolation (shipped)
A Google Sheets cell is hard-capped at **50 000 chars** and the backend writes each record's full JSON into one cell. So:
- `offloadDirtyPhotos()` (`app.js:15869`) pushes inline base64 (inspection photos, WO-part photos, customer selfies/agreement media, durable-card selfies) to **Drive** *before* the JSON rides the sync — via `uploadCapture` / `offloadPhotoNow` / `archiveAgreementMedia`.
- `holdOversized()` (`app.js:15899`) holds any record still >49 000 chars OUT of the batch so it can't abort the whole sync (#251), warns **once** per record (persisted in `localStorage['jactec.oversizeWarned']`), and forgives a record that later shrinks.

### 2.7 The action catalog (shipped — full list in CODE-MAP Part III)
`backendCall` makes ~40 distinct actions today, grouped: **auth/session** (`auth, saveSession, getSession`), **data sync** (`load, seed, sync`), **config/views** (`getConfig, setConfig, getViews, setViews`), **team chat** (`getChats, setChats`), **wrangler rail** (`getWranglerRail, setWranglerRail`), **Wrangler AI** (`wrangler`), **wrangler inbox** (`wranglerRequests, wranglerThread, wranglerComment, wranglerApprove, wranglerDismiss, wranglerFile, wranglerNotifications`), **files/media** (`uploadFile, uploadCapture, archiveAgreementMedia`), **Stripe cards/bank** (`stripePubKey, stripeSetupIntent, stripeSaveCard, stripeSetDefault, stripeRemoveCard, stripeBankSetupIntent, stripeSaveBank, stripeVerifyBank`), **Stripe charging** (`stripeChargeInvoice, stripeFinalizeInvoice, recordManualPayment`), **membership** (`membershipEnroll, membershipCancel, membershipReactivate`), **misc** (`mapsKey, feedback`).

### 2.8 Deploy & source (shipped)
- `Code.gs` is **gitignored** (the public repo is served by Pages and the source holds passwords / `DEFAULT_CONFIG`). It ships via **`/clasp`** (additive, STOP-gated) from a private mirror repo, never git. See `docs/backend-clasp-setup.md`.
- The frontend↔backend boundary is documented in **CODE-MAP.md Part III** (the authoritative contract).

### 2.9 Known drift / partial (carry into this spec)
| # | Drift | Status | Ref |
|---|---|---|---|
| D1 | `wranglerComment` resume path ADDs `wrangler-fix` but does **not** remove `wrangler-needs-jac` → answered cards stay stuck "Needs your answer". Frontend `wranglerClearNeedsAnswer` is a local-only stopgap; a hard refresh re-surfaces it. | Open (needs `Code.gs` redeploy) | `docs/wrangler-inbox-backend.md:176` |
| D2 | Backend has no schema/version stamp — the frontend can't detect "this backend predates action X" except by probing for an "unknown action" reply (see `attemptLogin` `auth` fallback, `app.js:16076`). | Open | §5.6 |
| D3 | No server-side enforcement of role tiers — the password is a **single team password**; the `auth` action *returns* a role but no action is gated on it server-side. All authorization is client-side today. | Open / by-design? | §3 |

---

## 3. Users, Roles & Data Gates

### 3.1 Who touches this area
**All 15 roles touch the backend transitively** — every signed-in user loads, edits, and syncs through it. But **no role interacts with this area directly**; it is plumbing. The *direct* operators of backend-area surfaces are:
| Surface | Tier required (today) | Notes |
|---|---|---|
| Sign-in (any read/write) | any — single **team password** | one password for the whole team |
| `#reseed` (replace DB) | **admin** (`adminUnlocked()`) + password re-prompt + confirm | recovery only |
| `#migrate-units`, Settings sync (`setConfig`) | **admin** | writes config |
| R25 "Retry now" / sync banner | any (it's a safety net, not a privilege) | |
| Money actions (Stripe charge, manual payment) | **money** tier (`canMoney`, Office/Admin) | gated client-side in `APP-35` |

Tiers come from the role-system redesign (`ROLE_TIERS`, `config.js:326`): `staff < money < manager < admin < developer`, compared by `tierRank`.

### 3.2 The central gate question — authorization is CLIENT-SIDE today (D3)
**This is the single most important open decision in this spec.** Today:
- A **single shared team password** gates *all* `backendCall`s. Anyone with it can call any action.
- The `auth` action *returns* the caller's role (`attemptLogin`, `app.js:16076`) but the server does **not** refuse a `sync`/`stripeChargeInvoice`/`setConfig` based on tier — the *frontend* hides the affordance (`canMoney`, `adminUnlocked()`).
- Because the bundle is public and the password is shared, **a determined user who has the password can craft any `backendCall` directly** (e.g. a `staff`-tier device could POST `stripeChargeInvoice`).

This is acceptable for a small trusted team behind one password, but it means **the client-side gates are UX, not security.** Any tightening (per-role passwords, server-side tier checks) is a backend change and is surfaced as **OQ-1**. This spec does **not** silently loosen or assume-tighten it.

**Conservative posture this spec ratifies (do NOT regress without an OQ-1 decision):**
- The shared team password is the *only* server-enforced credential. Treat every `backendCall` as if it could be crafted by any password-holder regardless of UI tier.
- Therefore **no new sensitive action may rely on client-side gating as its sole protection** if it moves money, exposes a pricing floor, or mutates config/auth. If a new action needs real authorization, it MUST land *with* an OQ-1 resolution (per-role password or server-side `tierRank` check), not ship "client-gated for now."
- The `auth` reply's `role` is **advisory** (drives which affordances render); it is **never** a security boundary today. A spec that treats the returned role as authorization is wrong until OQ-1 lands.
- Because the bundle is public, **assume the `BACKEND_URL` and every action name are known to an attacker.** The only secret protecting the DB is the team password. Rotating it is the only revocation mechanism today (OQ-13).

### 3.3 Customer isolation & PII handling
- The **live DB holds real customer PII** (names, phones, emails, addresses, Stripe customer ids, card last-4, selfies, signed agreements). The public repo and any spec/commit/seed must **never** contain it (CODE-MAP Part III PII guard).
- `data.js` is **demo seed only** — names/pricing are authentic-shaped but not real live customers; still treat `tools/import-real-data.ps1` output as PII (never paste into the repo).
- Media (photos, selfies, agreement signatures) is offloaded to **Drive** with anyone-with-link view URLs (`uc?export=view&id=…`). **OQ-7** asks whether link-shared Drive media is an acceptable exposure for signed agreements / selfies, or whether it should move to a signed/expiring URL scheme.
- There is **no customer self-service / row-isolated tenant build today** — the whole DB loads for every signed-in operator. A customer portal (out of scope here; `mobile-remote` area) would need true row-level isolation, which the current "load everything" model does not provide.

### 3.4 Money / pricing-floor gating at the data layer
- `bottomDollar` and `msrp`/`askPrice` (category pricing floors, `data.js:25`) ride in the `categories` entity and are **loaded for every role** — visibility is gated *only* client-side (the margin/floor display gate lives in the rendering areas, not here). The backend ships them to everyone. **OQ-6:** should the floor fields be stripped from the `load` payload for sub-`money` tiers (server-side redaction), or is client-side hide sufficient given §3.2?
- Money-moving actions (`stripeChargeInvoice`, `recordManualPayment`, …) are gated by `canMoney` client-side. Per §3.2, server-side enforcement is OQ-1.

**PII / floor field map — what rides the wire today (so the gate is auditable):**
| Field(s) | Entity | Sensitivity | On the `load` payload to every role? | Gate today |
|---|---|---|---|---|
| `bottomDollar`, `msrp`, `askPrice` | `categories` | pricing-floor / margin | **Yes** | client-hide only (OQ-6) |
| `trueCost`, `purchasePrice` | `units` | cost / margin | **Yes** | client-hide only (OQ-6) |
| `name, company, phone, email, address` | `customers` | PII | **Yes** | none (all roles see customers) |
| `stripeId`, `cards[]` (pm ids, last4) | `customers` | payment PII | **Yes** | client gates card *actions*, not visibility |
| selfies / agreement media (Drive URLs) | `customers`, `rentals`, `inspections` | PII / signature | **Yes** (as anyone-with-link URLs) | OQ-7 |

The hard constraint: **none of these values may appear in this spec, a commit, a seed, or the public bundle.** They are listed here by *field name only* to make the exposure surface explicit. Whether any should be server-redacted for sub-`money` tiers is OQ-6 (and depends on OQ-1, because redaction needs server-side tier knowledge).

---

## 4. Data Model

### 4.1 The 11 persisted entities (shipped shape, schema-less)
The Sheet is **one tab per entity**; each row is **one record stored as JSON in a single cell** (schema-less — adding a field needs no migration). The frontend `DATA[key]` array is the source shape (`data.js`). Id field per entity = `PERSIST_ID`.

| Entity | Id field | Key fields (abridged — see `data.js`) | Cross-refs (by id) |
|---|---|---|---|
| `categories` | `categoryId` | name, memberDaily, rate1Day, rate7Day, rate4Wk, weekend, msrp, askPrice, **bottomDollar** (floor), fuelType, description | — (units → categoryId) |
| `units` | `unitId` | name, categoryId, fleetStatus, inspectionStatus, currentHours, serviceCompletions, gpsType/Placement/Status, purchasePrice, trueCost | `categoryId` |
| `customers` | `customerId` | name, company, phone, email, address, accountType, payStatus, **stripeId**, cards[] (pm ids, last4), `_digest`, funnels, membership fields, agreements | — |
| `invoices` | `invoiceId` | customerId, rentalIds[], date, dueDate, amountPaid, allocations, lineItems[], covOf/contOf (28-day series), locked, refunded | `customerId`, `rentalIds` |
| `rentals` | `rentalId` | customerId, unitId, categoryId, startDate/endDate, status, transportType, deliveryAddress, invoiceId, units[] (multi-unit), captures | `customerId`, `unitId`, `invoiceId` |
| `workOrders` | `woId` | unitId, customerId, woReport, woType, phase, billCustomer, lineItems[] (parts), inspectionId | `unitId`, `customerId`, `inspectionId` |
| `inspections` | `inspectionId` | unitId, date, wash, checklist, billCustomer, woId, photo, description, items{} | `unitId`, `woId` |
| `vendors` | `vendorId` | name, phone, email, address, website, vendorType, salesTaxExempt | — |
| `parts` | `partId` | name, status, priceEach, qtyOnHand, vendorId, productNumber | `vendorId` |
| `companyFiles` | `fileId` | name, group, type, reviewByDate, link | — |
| `expenses` | `expenseId` | vendorId, date, amount, reconcile, method, category, woId, notes | `vendorId`, `woId` |

**Non-`PERSIST_KEYS` server state** (stored in dedicated cells/tabs, not in the entity diff): `settings` (admin config blob), `_chats` (team chat), wrangler rail (per-role), saved Views, device sessions. These sync via their own actions (§2.7), not `computeChanges`.

### 4.2 Schema-less additive notes
- **Adding a field** to any entity = edit `data.js` shape + use it; the cell is JSON, so it round-trips with no backend change. (This is why most entity-area features need *zero* backend work.)
- **Adding a whole entity** = the only structural change: add to `PERSIST_KEYS`, `PERSIST_ID`, `IDX_MAP`, the index builder, and a new Sheet tab on the backend. This is the one place a coordinated front+back change is required (OQ-3 proposes a checklist/guard).
- **Renaming an id field** is a breaking migration — avoid; prefer additive.

### 4.3 Migration concerns (shipped behavior)
- `migrateCustomers()` parses legacy free-text names into first/last on boot; it **dirties the record**, so `finishLoad` does a one-shot `saveSoon()` (`app.js:16015`) to push the parsed fields up. This is the realistic source of the "re-warned on every login" oversize bug (#251b) the offload fixes.
- Quote ids embed a time salt (`R-NEW…`, `app.js:14826`) so a reloaded app's seq counter can't mint a colliding id across devices — **id-collision safety is a real concern at the sync layer.**

---

## 5. Backend / Integration Contract

> Backend = Google Apps Script + schema-less Sheets, deployed by `clasp`. `Code.gs` is **unreadable from this repo**; the contract below is the boundary the frontend depends on. New behavior = **ADDITIVE action** on the single `backendCall` entry point, defined here, deployed via `/clasp`.

### 5.1 The wire contract (canon)
- **Request:** `POST {action, password, …extra}` as `text/plain;charset=utf-8` to `BACKEND_URL`.
- **Response:** always `{ ok: true, … }` or `{ ok: false, error: '<code>' }`. Errors the frontend maps: `unauthorized`, `bad-json`, `http-<status>`, `busy` (lock contention), action-specific.
- **Idempotency:** `sync` upserts/deletes are id-keyed and idempotent (re-sending an upsert is a no-op if unchanged). Media offload handlers are idempotent (no-op once the field is a Drive URL).

### 5.2 The `sync` action (the workhorse)
```
→ { action:'sync', password, upserts: { <entity>: [rec, …] }, deletes: { <entity>: [id, …] } }
← { ok:true }   |   { ok:false, error:'busy' }   (lock contention → frontend backs off)
```
Backend behavior (contract, per CODE-MAP): batched I/O writing each record's JSON into its row cell; `tryLock_` → `'busy'` on contention; all-or-nothing per call (so the frontend's `holdOversized` must keep any 50k-cell-buster out, else the whole call throws).

### 5.3 Proposed-additive actions (this spec's candidates — all OQ-gated)
| Action | Purpose | Shape (proposed) | Gate |
|---|---|---|---|
| `backendVersion` (OQ-2) | Let the client read the deployed schema/action version instead of probing "unknown action". | `← {ok, version, actions:[…]}` | none (read) |
| `syncResult` enrichment (OQ-5) | Return per-entity applied counts so the client can detect partial writes. | `← {ok, applied:{…}, rejected:[…]}` | none |
| `health` (OQ-4) | Cheap liveness probe for the R25 banner instead of a full `load`. | `← {ok, t}` | none |
| `auditLog` append (OQ-8) | Server-side append-only audit of who-changed-what (today the audit trail lives only in each record's `actions[]`, which a bad sync could overwrite). | `→ {action:'auditLog', entries:[…]}` | manager+ to read |

**None of these are committed** — they are the forks §11 asks Jac to settle.

### 5.4 External integrations routed through this seam
| Integration | Action family | Secret location | Failure handling |
|---|---|---|---|
| **Stripe** (cards/ACH/charging) | `stripe*`, `recordManualPayment` | secret key **server-side only** | `friendlyPayErr` maps `{ok:false,error}`; never masks a decline as "Network error" (#220) |
| **Google Drive** (media offload) | `uploadFile, uploadCapture, archiveAgreementMedia` | GAS runs as the owner account | failed offload leaves base64 → held back by `holdOversized`, retries; never poisons the batch |
| **Google Maps** | `mapsKey` (hands the referrer-locked key to the client) | key referrer-locked (public-safe) | client falls back to offline city-tier pricing |
| **Claude (Wrangler AI)** | `wrangler` (proxy) | **`ANTHROPIC_API_KEY` server-side only** | best-effort; chat degrades |
| **GitHub Issues** (wrangler inbox / auto-fix) | `wranglerFile/Comment/Thread/Requests/Notifications` | `GITHUB_TOKEN` Script Property | graceful skip if handler absent |

**Hard rule:** every secret (Stripe secret key, Anthropic key, GitHub token, team password, `DEFAULT_CONFIG`) lives **server-side in `Code.gs` or Script Properties only** — never in the bundle, the repo, a commit, or this spec.

**Payload shapes & failure handling per integration (the contract the frontend depends on):**

Stripe charge (the money-critical path — `stripeChargeInvoice`):
```
→ { action:'stripeChargeInvoice', password, invoiceId, amount, customerId, paymentMethodId? }
← { ok:true, charge:{ id, status:'succeeded', amountReceived }, invoice:{ amountPaid, allocations } }
← { ok:false, error:'card_declined'|'insufficient_funds'|'expired_card'|'processing_error'|… }   // Stripe's decline code, passed through
```
Failure contract: the **Stripe decline code must survive** to the client unchanged so `friendlyPayErr` can phrase it ("Card was declined" vs a generic "Network error", #220). A 500/quota HTML page from GAS becomes `{ok:false,error:'http-500'}` via `backendCall`'s defensive parse — the client MUST distinguish "the charge was declined" (do not retry, tell the operator) from "we never reached the backend" (safe to retry). **A charge action is NEVER auto-retried by the sync backoff** — only an idempotent `sync` is; a money action that returns a non-`ok` ambiguous error (e.g. `http-500` mid-charge) must surface to the operator, not silently re-fire, to avoid a double-charge (R12).

Drive media offload (`uploadCapture` / `uploadFile` / `archiveAgreementMedia`):
```
→ { action:'uploadCapture', password, kind:'inspection'|'wo'|'selfie'|'agreement', recId, fieldPath, dataUrl }   // dataUrl = base64
← { ok:true, url:'https://drive.google.com/uc?export=view&id=…' }
← { ok:false, error:'drive_quota'|'too_large'|… }
```
Failure contract: a failed offload **leaves the inline base64 in the record**; `holdOversized` then keeps that record out of the next `sync` batch (so it can't blow the 50k cell cap and abort the whole batch) and retries on a later flush. Offload is **idempotent** — once `fieldPath` holds a Drive URL, re-running is a no-op.

Wrangler AI proxy (`wrangler`):
```
→ { action:'wrangler', password, messages:[…], context:{…} }
← { ok:true, reply:'…' }   |   { ok:false, error:'busy'|'rate_limited'|… }
```
Failure contract: best-effort — chat degrades gracefully (the rail shows a retry, no data is lost). The Anthropic key never leaves the server.

GitHub inbox (`wranglerFile/Comment/Thread/Requests/Notifications`):
Failure contract: **graceful skip if the handler or `GITHUB_TOKEN` is absent** — the inbox features no-op rather than erroring the whole app. This is the `unknown action` / missing-property tolerance that lets an older backend run the rest of the app (ties to D2/OQ-2).

### 5.5 Auth flow (shipped)
`attemptLogin` (`app.js:16060`): sends `auth` → if `{ok}` adopts `a.role`; if the backend predates roles it replies "unknown action" → proceed in single-password mode; `unauthorized` → reject. Then `loadFromBackend` validates the password regardless. The password is stored in `sessionStorage['jactec.pw']` (cleared on failure).

### 5.6 Versioning / capability negotiation (gap — D2)
Today the client detects backend capability by **probing** ("unknown action" → fall back). A `backendVersion` action (OQ-2) would make this explicit and let the frontend show "your backend is out of date, redeploy via /clasp" instead of silently degrading.

---

## 6. UX / UI — yard data-plate language

This area is **mostly invisible plumbing**, but it surfaces three real UI moments. All must run through `/jactec-ui` and carry `data-r` stamps; any new popup needs a `WINDOW_CATALOG` entry (`ci/check-window-catalog.mjs`).

### 6.1 The R25 "Not saving" banner (shipped — keep)
A top-of-viewport **red hazard-stripe** plate (`repeating-linear-gradient(135deg, var(--red) …)`), Saira Condensed stamp **"⚠ Not saving"**, a body line ("Can't reach the yard — your changes are held and keep retrying. Don't close the app."), and a **Retry now** ignition-style action pill (built via `actionPill('commit', …)`, which stamps the inner button `data-r="R17"` — so the plate is `R25` and its retry control is `R17`; `gen-rule-usage.mjs --check` must see both). Mounted on `<body>` (outside `#app`, alongside `#toast` and the drag layer) so `render()` can't wipe it; `renderSyncBanner` drives it imperatively (`app.js:15956`). Reserves a top band via `body.sync-failing` so it never covers the grid. Stamped `role="alert"`, `aria-live="assertive"`. **Reduced-motion:** the stripe must not animate when `prefers-reduced-motion`. It is **not** a popup (no overlay, no focus trap) → **no `WINDOW_CATALOG` entry needed** (the catalog gate only fires for popup windows).

### 6.2 Proposed: a quiet **sync-status pulse** (OQ-9)
A tiny, ambient indicator (a single rivet-dot near the header wordmark) that breathes on a successful flush and goes amber while a flush is in flight — the positive counterpart to R25's alarm, answering "is it saving *right now*?" at a glance. **Restrained** (one dot, no text), leather-tan idle tint, safety-orange never used for status. Would need a `data-r` stamp. *Open question:* does Jac want any always-on indicator, or is "silence = saved, banner = broken" the right contract? (Most operators prefer no chrome until something's wrong.)

### 6.3 Proposed: an admin **Backend Health plate** (OQ-4 / OQ-10)
A small read-only board in Settings (admin tier) showing: last successful sync time, pending-diff count, consecutive-fail count, deployed `backendVersion`, and a "Force flush" / "Reseed (danger)" affordance. Yard data-plate: dark steel panel, corner rivets, stamped condensed labels, a **saddle-stitch** tan divider between the safe rows and the danger row. Would be a **new popup → needs a `WINDOW_CATALOG` entry** + `data-r` stamps. *Open:* is this worth building, or does `#reseed` + console suffice for a 1-admin shop?

### 6.4 States
- **Empty:** a fresh backend loads zero records → the grid shows each card's existing empty state; this area adds nothing (it must NOT auto-seed, §2.3).
- **Loading:** the login "Clock In" → "Signing in…" → the Mr. Wrangler intro video rolls behind the box during the (slow) load (`attemptLogin`, `app.js:16066`).
- **Error:** unauthorized → "That password wasn't recognized."; unreachable → "Couldn't reach the database. Check your connection and try again."; mid-session outage → R25 banner.
- **Mobile reflow:** R25 must respect the safe-area inset (it already reserves a band); the health plate (if built) reflows to a bottom-sheet on phones (`is-phone`).

### 6.5 Ranch-twist copy
Lean on voice, not visuals: "held and keep retrying" / "Back online — changes saved" already read as yard copy. A health plate could use "Last round-up" (last sync), "Waiting to be wrangled" (pending diffs) — sparingly, and only if it reads industrial-first.

---

## 7. Business Rules / Derivations / Money

This area stores facts; it derives almost nothing itself (derivations live in `APP-04`). The **rules it DOES own** are integrity invariants:

### 7.1 Diff correctness
- A record is an **upsert** iff `JSON.stringify(rec) !== lastSaved[entity].get(id)`. A record is a **delete** iff its id was in `lastSaved` but is no longer present in `DATA`.
- **Commit-only-what-was-sent:** after a successful `sync`, only the records in *that* batch update `lastSaved` — edits made mid-flight stay dirty (`flushSave`, `app.js:15935`). This prevents a slow flush from swallowing a concurrent edit.
- **Empty mock drafts** (`isEmptyMockDraft`, `app.js:2080`: an invoice with no lines & $0 paid, or a totally blank rental) are **never synced** — they self-destruct locally (`sweepEmptyDrafts`).

### 7.2 Multi-user merge rule (the conflict policy)
- On refresh, a remote record overwrites local **iff local is clean** (`saved.get(id) === JSON.stringify(local)`). If local has an unsaved edit, **local wins** and pushes on next save. This is **last-clean-writer-wins at record granularity** — there is **no field-level merge** (OQ-11: is record-level last-writer-wins acceptable for invoices/payments, or do money records need field-level or lock-based merge?).
- **Never delete on refresh** — only an explicit local delete + successful `sync` removes a record.

### 7.3 Oversize rule
- Any record whose JSON exceeds **49 000 chars** is held out of the batch (50k cell cap, `holdOversized`, `app.js:15906`). Photos must offload to Drive first. A record that can't shrink (offline / handler absent) warns **once** and retries silently.

### 7.4 Reseed safety rule
- `seed` from `#reseed` **refuses to shrink** a populated DB (live customers > file customers → blocked, `app.js:16494`). This is the only guard against the public demo file overwriting real data.

### 7.5 No money math here
All money (tax 10.75%, aging tiers, 28-day series, allocations) is derived in `APP-04`/`APP-05` and stored as plain fields. This area only guarantees those fields **save and sync faithfully** — it must never re-derive or mutate a money field.

---

## 8. Phasing & Milestones

### Phase 1 — Document & lock the canon (this spec) — IN SCOPE for v1
- Ratify §2 as the canonical description of the live system.
- Settle the open questions (§11), especially the **authorization gate (OQ-1)** and the **conflict policy (OQ-11)**.
- Fix **D1** (the `wranglerComment` label drift) via a `/clasp` redeploy — a clean, additive backend fix already specced in `docs/wrangler-inbox-backend.md:176`.

### Phase 2 — Observability & integrity (additive, low-risk)
- `backendVersion` (OQ-2) + capability negotiation (replace "unknown action" probing).
- Per-entity `sync` result counts (OQ-5) → client can detect partial writes.
- Optional `health` probe (OQ-4) for the R25 banner.
- Optional ambient sync pulse (OQ-9) and/or admin Health plate (OQ-10).

### Phase 3 — Hardening (only if Jac wants the trust boundary tightened)
- Server-side tier enforcement and/or per-role passwords (OQ-1).
- Server-side floor-field redaction for sub-`money` tiers (OQ-6).
- Append-only server audit log (OQ-8).
- Signed/expiring Drive media URLs (OQ-7).
- Field-level / lock-based merge for money records (OQ-11).

### Explicitly OUT OF SCOPE for v1
- Multi-location / multi-tenant DB (single Sheet by design — `fleet-spread` area).
- Customer self-service row isolation (`mobile-remote` portal).
- Switching off Apps Script / Sheets to a real DB (a rewrite, not this spec).
- Offline-first / service-worker write queue (`frontend-performance` area).

---

## 9. Acceptance Criteria

Concrete, testable. CI-gate impact noted; recall port 8000 → **9147** before running browser gates.

| # | Criterion | Verify |
|---|---|---|
| A1 | `backendCall` always returns `{ok,…}` — never throws on a non-JSON GAS error page. | `ci/logic-test.mjs` unit over a mocked 500 HTML body |
| A2 | `computeChanges` emits only changed records as upserts and vanished ids as deletes; an unchanged record yields nothing. | `ci/logic-test.mjs` (the big money/state harness) |
| A3 | An empty mock draft is never included in a sync batch. | `ci/logic-test.mjs` over `isEmptyMockDraft` |
| A4 | `refreshFromBackend` adopts a remote change for a clean local record and KEEPS a dirty one. | scripted two-state diff in `logic-test` |
| A5 | A record >49 000 chars is held out of the batch and the rest still send. | `logic-test` over `holdOversized` |
| A6 | `#reseed` refuses when live customers > file customers. | manual / `logic-test` over the guard |
| A7 | No secret, password, `DEFAULT_CONFIG` value, real PII, or model id appears in any committed file. | grep guard + review (and `ci/smoke.mjs` boots without them) |
| A8 | R25 banner raises after ≥2 consecutive fails, clears on recovery, respects reduced-motion, carries `data-r="R25"`. | `ci/smoke.mjs` boot + manual; `ci/gen-rule-usage.mjs --check` |
| A9 | Any NEW popup (e.g. Health plate) appears in `WINDOW_CATALOG`. | `ci/check-window-catalog.mjs` |
| A10 | If a new chapter banner is added (e.g. `APP-39 Backend Health`), the Code Atlas index regenerates clean. | `node tools/gen-code-map.mjs --check` |
| A11 | D1 fix: answering a `wrangler-needs-jac` issue removes that label server-side (no stale "Needs your answer" after a hard refresh). | manual against a test issue post-`/clasp` |
| A12 | A money action (`stripeChargeInvoice`) that returns an ambiguous failure (`http-500`) is NOT auto-retried by the sync backoff — it surfaces to the operator. | `ci/logic-test.mjs` asserts the charge path is off the retry loop; manual against a mocked 500 |
| A13 | A Stripe decline code survives `backendCall` and reaches `friendlyPayErr` unmasked (a decline is never shown as "Network error"). | `ci/logic-test.mjs` over `friendlyPayErr` mapping (#220) |
| A14 | `PERSIST_KEYS`, `PERSIST_ID`, and `IDX_MAP` share an identical key set (no half-wired entity). | proposed `ci/logic-test.mjs` assertion (OQ-3); fails if the three maps diverge |
| A15 | The `load` payload's floor/PII fields (§3.4 table) match the documented exposure surface — no new sensitive field is silently added to the wire without a §3.4 + OQ entry. | review gate against the §3.4 table |

---

## 10. Risks & Edge Cases

| # | Risk / edge case | Severity | Mitigation (shipped or proposed) |
|---|---|---|---|
| R1 | **Whole-DB overwrite** by a stray `seed`/reseed. | Critical | shrink-refusal guard (§7.4); password + confirm; never auto-seed on empty load |
| R2 | **Secret leak** into the public bundle/repo. | Critical | secrets server-side only; `.gitignore` for `Code.gs`; PII guard in CODE-MAP; A7 |
| R3 | **Silent write loss** on a flaky connection. | High | exponential backoff + R25 banner + `beforeunload` flush (§2.5) |
| R4 | **Lost concurrent edit** — last-clean-writer-wins drops a field another user set on the same record. | High | record-level clean-check; OQ-11 (field-level merge for money) |
| R5 | **50k cell jam** — one bloated record aborts the all-or-nothing `sync`. | High | offload-to-Drive + `holdOversized` (§2.6) |
| R6 | **Id collision** across devices (two offline quotes minting the same id). | Medium | time-salted ids (`R-NEW…`, `app.js:14826`); reindex by id |
| R7 | **Authorization bypass** — a password-holder POSTs a money/admin action their UI hides. | Medium (by-design today) | client gates are UX; OQ-1 for server enforcement |
| R8 | **GAS quota / cold-start latency** stalls login or sync. | Medium | defensive parse; backoff; `health` probe (OQ-4) |
| R9 | **Backend/frontend version skew** after a partial deploy. | Medium | probe fallback today; `backendVersion` (OQ-2) |
| R10 | **Audit trail loss** — a record's `actions[]` is overwritten by a sync, losing who-did-what. | Low/Medium | append-only server audit (OQ-8) |
| R11 | **Refresh disrupts active work** (mid-drag/mid-type adoption). | Low | extensive guards in `refreshFromBackend` (§2.4) — keep them |
| R12 | **Double-charge** — a money action returns an *ambiguous* failure (`http-500` mid-charge) and the client re-fires it. | Critical | money actions are NEVER on the sync-backoff retry path (§5.4); an ambiguous charge result surfaces to the operator, who confirms before re-charging; Stripe idempotency keys (OQ-14) would harden this |
| R13 | **Password compromise** — the single shared password leaks; the only revocation is rotating it for the whole team. | High | rotate-and-redeploy (OQ-13); no per-device revocation today |
| R14 | **Offline write queue is in-memory only** — un-flushed dirty edits live in JS memory; a tab crash (not a clean close) before `beforeunload` fires loses them. | Medium | `beforeunload` flush + unsaved-changes prompt (§2.5) covers clean close; a true offline-durable queue (IndexedDB) is `frontend-performance` scope, OQ-15 |
| R15 | **`migrateCustomers` boot-storm** — a legacy DB dirties many records on first load, triggering one large `sync` that could brush the 50k/batch limits. | Low | one-shot `saveSoon` (§4.3) + `holdOversized` isolation; warned-once oversize tracking |

---

## 11. Open Questions

> **Resolved 2026-06-29:** OQ-1 + OQ-13 → **D1 (per-role passwords + server-side tier enforcement — the keystone)** · OQ-7 → D2 (keep anyone-with-link). Adopted: OQ-2, OQ-3, OQ-5, OQ-14, OQ-12, OQ-6, OQ-11, OQ-9; deferred: OQ-10, OQ-4, OQ-8, OQ-15. See the Decisions block up top.

> Seed list: none captured in the code-grounding map — all questions below were generated from the live code. Each is a real fork with trade-offs for Jac to settle.

**OQ-1 — Authorization: keep the single team password (client-side gates only), or enforce tiers server-side?**
Today one password gates everything and the server trusts the client to hide money/admin actions (§3.2, D3). Options: (a) **keep as-is** — simplest, fine for a small trusted team, but client gates are UX not security; (b) **per-role passwords** — the `auth` action returns a tier, each action checks it server-side; (c) **a single password + server-side tier check on sensitive actions only** (`stripe*`, `setConfig`, `seed`). Trade-off: (b)/(c) are real security but add `Code.gs` complexity and a credential-management burden. *Recommend surfacing before any "wants" area assumes the gate.*

**OQ-2 — Add an explicit `backendVersion`/capability action, or keep probing "unknown action"?**
Probing works but degrades silently on skew (D2). A version stamp lets the app warn "redeploy the backend." Cost: one additive action + a frontend banner.

**OQ-3 — Should adding a new entity be guarded by a checklist or a CI lint?**
Adding an entity touches `PERSIST_KEYS`, `PERSIST_ID`, `IDX_MAP`, the index builder, AND a new Sheet tab (§4.2) — easy to half-wire (e.g. forget `IDX_MAP` → refresh can't index it). Options: (a) a documented checklist; (b) a CI lint that asserts the three maps share the same keys. Recommend (b) — cheap and catches a real footgun.

**OQ-4 — Add a cheap `health` probe, or keep using a full `load` for liveness?**
A full `load` is heavy to use as a heartbeat. A `health` action is cheap but is one more handler. Only worth it if we add proactive liveness UI (OQ-9/10).

**OQ-5 — Should `sync` return per-entity applied/rejected counts?**
Today `sync` returns `{ok:true}` and the client *assumes* everything applied. Per-entity counts would let the client detect a partial server-side reject (e.g. a record the backend refused). Cost: additive response field, no breaking change.

**OQ-6 — Server-side redaction of pricing floors (`bottomDollar`, `msrp`, `askPrice`) for sub-`money` tiers?**
Today the `load` payload ships floor fields to every role and the client hides them. A determined staff-tier user could read the bundle and see floors. Redacting server-side is real protection but (a) requires server-side tier knowledge (ties to OQ-1) and (b) breaks the "load everything once" simplicity. *Conservative default: leave as client-hide and flag the exposure, do NOT silently loosen.*

**OQ-7 — Are anyone-with-link Drive URLs acceptable for signed agreements / selfies, or move to signed/expiring URLs?**
Offloaded media uses `uc?export=view&id=…` (anyone-with-link). For a signed rental agreement or a customer selfie that's a small PII exposure if a URL leaks. Signed/expiring URLs are safer but add complexity and break `<img src>` simplicity.

**OQ-8 — Add an append-only server-side audit log, or rely on per-record `actions[]`?**
The audit trail (who/when/what) lives in each record's `actions[]` today (`logAction`, `app.js:14911`) — which a sync could overwrite (R10). A server-side append-only log is tamper-resistant but is real backend work. Worth it only if compliance ever matters (ties to `hr-compliance`).

**OQ-9 — Do operators want any always-on sync indicator (the §6.2 pulse), or is "silence = saved, R25 = broken" the contract?**
Most yards prefer no chrome until something's wrong. A pulse reassures but adds visual noise.

**OQ-10 — Build the admin Backend Health plate (§6.3), or is `#reseed` + console enough for a 1-admin shop?**
A health plate is a nice ops surface but a new popup (WINDOW_CATALOG + R-stamps + a build). For one admin it may be over-build.

**OQ-11 — Conflict policy for money records: keep record-level last-clean-writer-wins, or add field-level/lock merge for invoices & payments?**
Record-level last-writer-wins (§7.2) is fine for most entities but two operators editing the same invoice could clobber a field. Invoices already guard money operations (locked/refunded/ACH-in-flight) at the action layer; the question is whether the *sync* layer needs finer merge for them specifically.

**OQ-12 — Fix D1 (the `wranglerComment` label drift) in this area's spec, or defer to `wrangler-ai`?**
It's a backend `Code.gs` fix (remove `wrangler-needs-jac` on answer) that lives at this seam but belongs conceptually to `wrangler-ai`. Recommend fixing here (it's small, additive, and this area owns `Code.gs` deploy) but tracking it under both.

**OQ-13 — Password lifecycle: is rotate-and-redeploy an acceptable revocation story, or do we need per-device/per-role credentials?**
Today the only way to revoke access (a lost phone, a departed hand) is to change the single team password and have everyone re-enter it. There is no per-device session kill. Options: (a) **keep rotate-only** — dead simple, fine until headcount/turnover grows; (b) **per-role passwords** (ties OQ-1) — lets you revoke a role without disrupting others; (c) a **device-session registry** (`saveSession`/`getSession` already exist) with a server-side revoke list. Trade-off: (b)/(c) are real `Code.gs` work and a credential-management burden for a 1-admin shop. *Surface before any field-device rollout.*

**OQ-14 — Should money actions carry a Stripe idempotency key to make a retry safe?**
Today money actions are simply kept off the auto-retry path (R12) and an ambiguous result surfaces to the operator. A Stripe **idempotency key** (a per-charge nonce the backend forwards to Stripe) would make even an accidental re-fire a no-op, hardening against double-charge at the source. Cost: the frontend mints a nonce per charge attempt and the `Code.gs` charge handler forwards it; small, additive, and strictly safer. *Recommend yes for `stripeChargeInvoice` / `recordManualPayment` if/when the charge path is next touched.*

**OQ-15 — Do we want a durable (IndexedDB) offline write queue, or is the in-memory queue + `beforeunload` prompt enough?**
Un-flushed dirty edits live only in JS memory; a clean close is covered by the `beforeunload` flush + browser prompt, but a hard tab crash or OS kill before that fires loses them (R14). A durable queue would survive a crash and enable true offline-first writes. This is **`frontend-performance` scope** (service-worker / IndexedDB), cross-listed here because it changes the sync contract's durability guarantee. Trade-off: real robustness vs. a meaningfully more complex sync engine and conflict surface.

---

## 12. Dependencies & Sequencing

### 12.1 Who depends on this area
**Everything.** Per the roadmap, `backend-data` is a declared dependency of **every entity area** (`rentals-dispatch`, `units-fleet`, `invoicing-payments`, `customers-crm`, `accounting`, `maintenance-shop`) and of `wrangler-ai`, `comms-notifications`, `memberships`, `security-cameras`, `search-views`, `financials-kpi`, `maps-location`, `gps-tracking`, `mobile-remote`, `frontend-performance`. A change to the sync contract ripples to all of them.

### 12.2 What this area depends on
- **`wrangler-ai`** — shares the `Code.gs` deploy surface and owns the inbox actions (D1/OQ-12); the `wrangler` proxy action lives here but is authored there.
- **`comms-notifications`** — the team-chat (`getChats/setChats`) and wrangler-rail sync ride this layer; any new outbound channel (server-side SMS/email) is a new additive action here.
- **`memberships`** — `membershipEnroll/Cancel/Reactivate` are additive actions on this seam.
- **`security-cameras`** — if camera stream URLs/credentials are ever stored, they pass through this contract (and raise a fresh secret-handling question).
- **`design-system`** — the R25 banner and any new plate must run through `/jactec-ui` + the R-rulebook.

### 12.3 What must land first
- **Before any "wants" area assumes a security posture:** settle **OQ-1** (the authorization gate). Areas like `gps-tracking` (telematics webhooks) and a future customer portal can't be designed until we know whether the backend enforces tiers.
- **Before adding any new entity:** decide **OQ-3** (the entity-add guard).
- **D1** is independent and can ship immediately via `/clasp` (Phase 1).

---

*End of DRAFT — every numbered decision in §11 is open for Jac's critique. Nothing in §5.3 / §6.2–6.3 is committed; they are candidates pending the open questions.*
