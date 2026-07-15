# Customer Portal — SPEC v1 (DRAFT)

**Date:** 2026-06-29
**Status:** DRAFT — for critique
**Area branch:** `area/customer-portal` — FROZEN legacy branch (not a routing target); this spec's authoritative copy lives in `docs/` on `trunk`.
**Task branch:** `customer-portal/spec` (proposed)
**Maturity:** greenfield
**Scope:** An external, row-isolated, separately-authenticated self-service portal where a JacRentals customer signs in and sees ONLY their own account — live on-rent units on a Google Map, order/spend history, available units to book (incl. "feature rentals"), and a "flag for a field call" (pickup/delivery) request — without ever touching the internal console, another customer's data, or any internal pricing/PII.

## ✅ Decisions — 2026-06-29 critique (Jac)

- **D1 — Auth = magic link only (carried from `mobile-remote` D2).** No OTP code-entry path. A texted/emailed one-tap link (15-min, single-use) → 24h revocable session, server-enforced token resolving to exactly one `customerId`. The server-side per-customer isolation + bundle secret-isolation (§3) remain the load-bearing precondition (still gated on the `backend-data` external-auth contract + the `comms-notifications` send path). *(OQ-1/OQ-2 resolved; OQ-3 abuse thresholds adopt the draft: OTP-less so only the link-issuance throttle applies — 3/hr per destination + per-IP, unconditional `{ok:true}` on request.)*
- **D2 — "Spend history" — there is NO separate 'spin' feature.** "Spin history" in the request was a typo for **spend history** (dollars-spent / payment history). The §6.2 "Order & Spend History" card covers it; no rewards/spin mechanic to spec.
- **D3 — Pay-from-portal IS in v1 (OQ-4 = YES).** Phase 3 (B6) folds into the v1 build: customers pay their own invoices via the existing **server-side Stripe path** from launch. The amount is **server-computed from the invoice balance** (a client amount is rejected as a tamper vector), `invoice.customerId === token.customerId` is server-verified, internal margin/cost never crosses the boundary, and the **authoritative paid state arrives via Stripe's existing webhook to GAS** — the portal never writes `invoiceStatus`. Reuse the internal money-action discipline (no auto-retry a charge, Stripe idempotency key) to prevent double-charge (R9). The S5 Pay sheet ships in v1, not deferred.
- **D4 — Booking = a Settings toggle; default SELF-RESERVATION, but internally still accept/decline (OQ-6).** Add a Settings switch (`portalBookingMode: 'self-reserve' | 'request'`), **default `self-reserve`**. Even in self-reserve mode the reservation is **only customer-facing-instant** — on the internal side it still lands as an office **accept/decline** step (the booking hard gates — invoice-before-On-Rent, blacklist, card-signed — stay on the trusted side). On **decline (or any non-acceptance), the portal communicates back to the customer** (via the comms send path — "we couldn't confirm that booking, the office will reach out"). So `customerPortalBook` always appends a `portalRequests` row; the *difference* the toggle makes is purely the **customer-facing framing** (instant "Reserved — pending confirmation" vs explicit "Request submitted") + a **mandatory outbound status comm** on accept/decline. This makes `comms-notifications` a hard dep for booking too (not just auth).
- **D5 — Hosting: same Pages site under `/portal` (OQ-13).** One origin, simplest deploy. The separate-bundle + `portalCall` secret-isolation (§3.3) and the CI grep (AC-4) carry the security weight that a subdomain would otherwise add; revisit a subdomain only if origin/cookie isolation or branding later demands it. Widen the Maps referrer key allow-list to `app.jacrentals.com/portal*` (OQ-9).
- **D6 — Adopt the conservative drafts for the rest:** office-issued links at tier ≥ money in Phase 1, public self-request later (OQ-5); feature rentals = a `featured`+`featureBlurb` tag on categories, admin-curated (OQ-7); a field-call request becomes a **Field-Call WO + sets `r.fieldCall`** on office review (OQ-8); same GAS web app, separate `customerPortal*` action namespace + `portalToken` gate (OQ-10); lighter customer-facing ranch voice (OQ-11); portal bundle reuses R0–R24 under a `portal/` scope + a minimal portal smoke (OQ-12); `mobile-remote` half B reduces to a pointer here (OQ-14); `portalEnabled` opt-in, fail-closed (OQ-15).

## 0. Reconciliation note (read first)

`mobile-remote.md` §2.3/§3.2/§5.2/§11 already names "a separate row-isolated build
for external customers" and sketches its auth/isolation stance as **half B** of that
area. **THIS spec is that build, promoted to its own area.** Where the two overlap,
this spec is authoritative for the portal; `mobile-remote` remains authoritative for
the **internal** phone reflow (half A) and for the shared design-token shell the
portal borrows. Concretely:

- `mobile-remote` half B (portal screens, `portalGrants` tab, `customerPortal*`
  actions, `portalCall` bundle-isolation, the office "Send link" dialog) is **moved
  here** and expanded. `mobile-remote` should, on its next revision, replace its §B
  detail with a one-line pointer to this spec (tracked as **OQ-14**).
- The portal's **auth/isolation/server-trust model is the load-bearing design**
  (§3) and the **top Open Questions** (§11) — conservative by default, nothing ships
  until Jac signs off the gate.
- This area is **blocked** on two things that do not exist yet: a server-side
  **outbound send** path (`comms-notifications`, for magic links/OTP) and a resolved
  **external-auth contract** in `backend-data` (today every `backendCall` ships the
  internal team password — see §3.3). Neither is this area's to build; this spec
  defines the contract it needs from them.

---

## 1. Goal & Problem

### 1.1 What this area is for

Today a JacRentals customer has **zero** direct access to their own account. Every
"is my machine ready?", "what's my balance?", "can I get another light tower this
weekend?", and "come pick this up" is a phone call or a text to the office
(`mobile-remote.md` §1 names this exact gap; the only outbound channel that exists is
`sendInvoiceText()`, an `sms:` deep-link, with **no server-side send** —
`comms-notifications.md`). The Customer Portal is the **big external surface**: a
customer-facing app, separate from the internal ops console, that lets a customer
self-serve the things they call the office for.

The customer can:

1. **See their live fleet on a map** — every unit they currently have on rent, drawn
   on a Google Map (their delivery pins), with a customer-safe status pill.
2. **See their account** — order history, spend history, open invoices + balance,
   contact info, membership/terms — everything a typical customer account shows.
3. **Book** — request available units for a window, and book **feature rentals**
   (a curated/promoted set — see §4.4).
4. **Flag a unit for a field call** — request a **pickup** or **delivery**, which
   lands as a dispatch-actionable request on the internal side.

### 1.2 The business / user problem

JacRentals is a relationship business in a small market (Sulphur / Lake Charles, LA)
where the same construction and industrial outfits rent repeatedly
(`customers-crm.md` §1.2). The office spends real hours on status-check and
"can-I-book" calls. A portal **deflects those calls**, looks modern to a B2B renter,
and shortens the booking loop — a **Want-tier growth lever**, not a survival need
(roadmap tier: **Want**). It is explicitly *not* a replacement for the office;
high-trust, money-moving, and exception work stays a human conversation.

### 1.3 The hard part (and the north star)

The portal inverts the app's entire trust model. The internal app is a **single
trusted team behind one shared password** that **loads the whole database** for every
operator (`backend-data.md` §2.2/§3.2). A portal customer is **untrusted, external,
and must see exactly one customer's rows** — the opposite of "load everything." The
current single-team-password model **does not provide** per-customer isolation, and
the one `backendCall` entry point **hard-injects the internal secret on every call**
(`app.js:15652`). So the load-bearing design is **not the screens** — it's the
**external auth + strict server-side per-customer isolation + bundle secret-isolation**
that has to exist before a single customer row crosses the boundary.

> **North star.** A customer opens a link, proves they're customer `C0xxx`, and sees a
> live, friendly, read-mostly view of **only** `C0xxx`'s yard — units on a map,
> history, balance, book, and "come get it" — while the server **filters every row by
> `C0xxx` and the customer's browser never holds the team password, internal code,
> margin math, or another customer's anything.** Isolation is a server guarantee, never
> a front-end filter.

---

## 2. Current State (what exists to build on)

**Greenfield.** There is **no portal code, no customer auth, no public customer
route** today. `mobile-remote.md` §2.3 confirms the only trace is a roadmap backlog
stub. Everything below is **internal** infrastructure the portal reads *through a new
isolation boundary* — it is the baseline, not the portal.

### 2.1 The data the portal would scope to (exists, internal)

| Entity | Id (PERSIST_ID) | Portal reads | Anchor |
|---|---|---|---|
| `customers` | `customerId` | the account identity + contact + terms + `_digest` spend | `data.js:58`; record shape `customers-crm.md` §4.1 |
| `rentals` | `rentalId` | the customer's rentals (live + history), each unit's status/dates/site pin | `data.js:107`; `rentalUnits(r)` `app.js:202` |
| `invoices` | `invoiceId` | open invoices, amounts, due dates, balance | `invoicing-payments` |
| `units` / `categories` | `unitId` / `categoryId` | **availability to book** + display name/category | `isUnitAvailableFor` `app.js:1702`, `categoryAvailableCount` |

All are keyed by `customerId` (`rental.customerId`, `invoice.customerId`), which is the
**single isolation join** the server filters on.

### 2.2 Live-units-on-a-map machinery (exists, internal — the model to mirror)

The internal **dispatch cockpit** already derives "units in motion" and plots them on
a live Google Map: `dispatchEvents()` (`app.js:8032`) walks `rentalUnits(r)`, reads
each unit's `sitePin` (`{lat,lng}`, geocoded at save), and `placeDispatchPin()` draws
them (`app.js:8277`); `YARD_CENTER = {lat:30.2366,lng:-93.3774}` (Sulphur, LA,
`app.js:1346`). The browser Maps key is **referrer-locked + API-restricted** and safe
to ship (`maps-location.md` §2.1; `GOOGLE_MAPS_KEY` `config.js:44`) — but it is
**referrer-locked to `app.jacrentals.com/*`**, so a portal on a different
origin/path needs that referrer allow-list widened or its own key (§5.4, **OQ-9**).
**Determinism rule (load-bearing, inherited):** Google is called only at address-save
time, never at render/billing (`maps-location.md` §5.1) — the portal map must read the
**cached** `sitePin`, never geocode on the client.

> **PII boundary already stated:** `maps-location.md` §3.1 declares site addresses/pins
> **internal-only** and says explicitly "a future self-service portal under
> `mobile-remote` MUST row-isolate so customer A never sees customer B's job-site pin."
> This spec honors that: the portal map shows **only the signed-in customer's own pins.**

### 2.3 Field-call mechanism (exists, internal — what a portal request feeds)

A "field call" is already a first-class concept: a rental carries `r.fieldCall`
(boolean) + an `fcCapture`, set by `markFieldCall(rentalId)` (`app.js:13197`) and
cleared by `clearFieldCall` (`app.js:13209`); an open **Work Order of `woType ===
'Field Call'`** raises the red `fc` flag (`app.js:3936`, `flag-color-system.md` §7.1).
The portal's "flag for a field call / request pickup" feature **creates a request that
the office turns into** this internal field-call state — the portal **never** writes
`r.fieldCall` directly (it's untrusted; see §5.2 `customerPortalFieldCall`).

### 2.4 Auth + the single-team-password baseline (exists — the thing being inverted)

`attemptLogin` (`app.js:16060`) sends `auth` → adopts a returned `role` (advisory
only); `loadFromBackend` validates the **single team password** stored in
`sessionStorage['jactec.pw']`. `backendCall(action, extra)` then injects
`{ action, password: backendPassword }` on **every** call (`app.js:15652`).
`backend-data.md` §3.2 (D3) is explicit: **authorization is client-side today**, the
returned role is advisory, and "a determined user who has the password can craft any
`backendCall` directly." There is **no per-customer credential anywhere.** This is the
central blocker the portal's §3 must solve from scratch — it cannot reuse any of it.

### 2.5 Stripe path (exists, internal — relevant only if Phase 3 pay-from-portal)

The internal `stripe*` actions (charge/finalize/refund + `recordManualPayment`) and
the referrer-locked **publishable** key (`stripePubKey`, secret key server-side only)
exist (`backend-data.md` §5.4, `invoicing-payments`). The portal would **reuse the
server-side charge path**, never the internal money UI — and only if pay-from-portal
is approved (a money gate, **OQ-4**).

### 2.6 What does NOT exist (and blocks this area)

| Missing | Owner | Blocks |
|---|---|---|
| Server-side **outbound send** (SMS/email) for magic link / OTP | `comms-notifications` (today: only `sendInvoiceText` `sms:` deep-link, no server send) | **all of auth** |
| A resolved **external-auth contract** (per-customer credential, not the team password) | `backend-data` (OQ-1 there) | **all portal reads** |
| Any **row-isolation / server-side filtering** in the backend | `backend-data` (loads everything today) | **the core safety property** |
| A separate **portal bundle** with no internal secret in scope | this area (§6.2) | **secret-leak safety** |

---

## 3. Users, Roles, Gates & Isolation  ← the centerpiece

The portal introduces a **new external persona that is NOT a Rental Wrangler role**
and **never** receives `backendPassword`, any tier credential, or any internal
bundle. Every decision below is conservative and surfaced as an Open Question; nothing
loosens silently.

### 3.1 The two sides

| Side | Who | Auth | Trust |
|---|---|---|---|
| **Internal** (issue + fulfill) | Office / Sales / Manager / Admin (tier ≥ `money`) | existing team password + role tier (`canMoney()` `app.js:14166`) | trusted team |
| **External** (the portal) | a **customer** (one `customerId`) | a **portal token** (magic link / OTP) — never the team password | **untrusted**, row-isolated |

The internal "Send portal link" action is a **controlled, tier-gated** action (it
hands a customer access to their own data): **tier ≥ `money`** (Office/Sales/Manager/
Admin), matching how `customers-crm` gates money/PII surfaces. **OQ-5.**

### 3.2 Customer isolation — the non-negotiable

A portal session for `C0009` may read **only**:

- `C0009`'s rentals (live + history), each unit's **safe** status, dates, and **its
  own** delivery pin/address;
- `C0009`'s invoices, amounts, due dates, and computed balance;
- `C0009`'s own contact info, terms, and spend digest;
- the **shared** bookable catalog (available units / feature rentals) — which is *not*
  customer-specific and carries no margin (§4.4).

It may **never** see: another customer's rows, any **margin/cost/`bottomDollar`**
(category floors `data.js:25`; unit `trueCost`/`purchasePrice`), internal WO/inspection
notes or line items, vendor names, `_digest` of others, internal staff/yard data, or
any other customer's pins/PII. **Isolation is enforced server-side by filtering every
returned row on the token's `customerId` — the front-end is NEVER the only line of
defense** (mirrors `backend-data.md` §3.3's "true row-level isolation, which the
current load-everything model does not provide").

### 3.3 The bundle / secret-isolation problem (cite the code)

`backendCall` hard-injects the secret on every call —
`Object.assign({ action, password: backendPassword }, extra)` (`app.js:15652`) — with
**no per-action opt-out**. Any portal action routed through `backendCall` would ship
the **internal team password from a customer's phone** = a live secret leak. Two ways
out (the same fork `mobile-remote.md` §5.2 raised, kept here as the decision of
record):

- **(a) — chosen.** A **separate portal bundle** (`portal.html` + a thin
  `portal.js`) whose ONLY network helper is `portalCall(token, action, extra)` — it
  **never references `backendPassword`**, never imports `app.js`/`config.js`
  (`config.js` holds `DEFAULT_CONFIG`), sends `{ action, portalToken } ` only. The
  symbol is not even *in scope* in the portal bundle.
- (b) Server ignores `password` for `customer*` actions. **Rejected** — defense should
  be "the secret is never in scope," not "merely ignored," and (b) still ships the
  secret if the portal ever shares `backendCall`.

A **CI grep over the built portal asset** enforces (a): zero `backendPassword`, zero
`DEFAULT_CONFIG` value, zero `BACKEND_URL` secret material, zero margin/cost field
(§9 AC-9).

### 3.4 Server-trust model (the auth contract this area needs)

Conservative posture (every `customerPortal*` action MUST):

1. **Resolve** `sessionToken → grant → customerId` server-side (a `portalGrants`
   lookup, §4.5);
2. **Reject** if the grant is `revoked` or past `expiresAt` → `{ok:false}` + the
   locked state (fail-closed);
3. **Filter** every returned row by that `customerId` — never trust a client-supplied
   id;
4. **Project** through a server-side **safe-field allowlist** (§7.3) so margin/cost
   can't leak even by accident;
5. **Never** accept a client-supplied money amount or status mutation — a pay amount is
   server-computed from the invoice balance; a field-call request is a **request**, not
   a write to `r.fieldCall`.

This is a **new server-side authorization layer the backend does not have today**
(`backend-data` D3 / OQ-1). It is the precondition for the whole area — **OQ-1 here +
`backend-data` OQ-1 must land first** (§12).

### 3.5 Money / pricing-floor gating

- **Pay-from-portal is OUT of v1** (read-only portal, **OQ-4**). If ever in (Phase 3),
  it routes through the existing server-side Stripe path, the **amount is
  server-computed** from the invoice balance (a client amount is a tamper vector), and
  it **never** exposes internal pricing math or writes invoice fields — the
  authoritative paid state arrives via Stripe's existing webhook to the GAS backend
  (`backend-data.md` §5.4), not from the portal.
- **No floor ever crosses the boundary.** Booking shows the customer **their** price
  (the same rates an office quote would show — `rentalPrice` reads only the four rate
  fields, **never** `bottomDollar`/`msrp`/`askPrice`, `rentals-dispatch.md` §3.3), with
  **no margin, no cost, no floor**. The booking quote is computed **server-side** so no
  pricing formula or floor ships in the portal bundle.

### 3.6 PII & the public-repo rule

The repo is public via Pages, so **no customer PII, secrets, `DEFAULT_CONFIG`, OAuth/
API tokens, or the model id appear in any committed file** — the portal reads live data
at runtime through the new separately-authenticated actions. The demo seed (`data.js`)
uses authentic-*shaped* but non-production rows; this spec reproduces **none** of them.
Selfies/agreement media stay Drive-offloaded and are **never** surfaced in the portal
(they're the office's evidence, not the customer's view).

---

## 4. Data Model

Backend is **schema-less Sheets**; all new state is **additive** — a new tab and/or new
absent-tolerant fields, never a migration of existing columns (`backend-data.md` §4.2).
Relationships are **by id**; `customerId` is the isolation key on every read.

### 4.1 No change to existing entities (reads only)

The portal **reads** `customers`, `rentals`, `invoices`, `units`, `categories` — it
adds **no** persisted field to them in Phase 1 except (optionally) a single flag:

| Field | Entity | Type | Purpose |
|---|---|---|---|
| `portalEnabled` | `customers` | bool (optional) | office can enable/disable a customer's portal access without revoking individual grants. Absent = disabled (fail-closed). |

### 4.2 `portalGrants` (NEW Sheets tab) — the auth/isolation store

One row per active portal credential, kept **off** the customer PII row (defense in
depth, mirrors `mobile-remote.md` §4.2):

```
portalGrants (proposed Sheets tab — server-side only, NEVER in the repo)
  grantId        // PG-xxxx
  customerId     // FK → customers.customerId   (THE isolation key)
  channel        // 'email' | 'sms'
  destination    // the email/phone the link/OTP went to (server-side only)
  tokenHash      // HASH of the magic-link/OTP token — NEVER the raw token
  sessionHash    // HASH of the active session token (set on exchange)
  issuedAt       // ISO
  expiresAt      // ISO (short — §7.1)
  sessionExpires // ISO (session cap — §7.1)
  lastUsedAt     // ISO
  attempts       // int — OTP attempt counter (abuse cap, §7.4)
  revoked        // bool
```

**Why hashed + separate tab:** the Sheet is the source of truth but is not public;
defense-in-depth says store only a **hash** of any bearer token and keep auth material
off the PII row. No raw token, password, or secret is ever written to the repo or the
bundle.

### 4.3 `portalRequests` (NEW Sheets tab) — customer-initiated requests

Customer actions that need office action (field-call pickup/delivery, booking
requests) are **requests**, not direct writes to internal records — the portal is
untrusted:

```
portalRequests (proposed Sheets tab)
  requestId      // PR-xxxx
  customerId     // FK (isolation key; server-stamped from the token, NOT client)
  kind           // 'fieldCall' | 'booking'
  // fieldCall:
  rentalId       // FK → rentals (server-verifies rental.customerId === token.customerId)
  unitId         // which unit
  legType        // 'pickup' | 'delivery'
  note           // free text from the customer
  // booking:
  categoryId/unitId, startDate, endDate, transportType, featureRentalId?
  status         // 'new' | 'acknowledged' | 'converted' | 'declined'
  createdAt      // ISO (server)
  handledBy      // internal role/user once an office hand acts
```

The office sees these in an internal **Portal Requests** inbox (§6.3) and converts a
`fieldCall` request → `markFieldCall(rentalId)` / a Field-Call WO (§2.3), or a
`booking` request → a real Quote/rental. **The portal never sets `r.fieldCall` or
creates a rental directly.**

### 4.4 Feature rentals (NEW — bookable promo set)

"Feature rentals" = a curated/promoted bookable set (e.g. a weekend light-tower
package, a seasonal special). Open shape question (**OQ-7**): a tagged subset of
existing `categories`/`units` (e.g. a `featured: true` flag + a `featureBlurb`) vs a
small new `featureRentals` config list. Either way it carries **only** customer-safe
display + a customer-facing price (server-computed), **never** margin/floor.

### 4.5 Relationships (by id)

```
portalGrants.customerId   → customers.customerId    (isolation join — every read)
portalRequests.customerId → customers.customerId    (server-stamped, not client)
portalRequests.rentalId   → rentals.rentalId        (server re-verifies ownership)
booking.featureRentalId   → the feature set (OQ-7)
```

### 4.6 Migration concerns

Purely additive: two new tabs (`portalGrants`, `portalRequests`) + an optional
`customers.portalEnabled` boolean. A backend predating the tabs has **no grants → the
portal is dark for everyone** (fail-closed). No existing field changes; no id-field
rename. Adding the tabs is the one coordinated front+back step (`backend-data.md` §4.2,
OQ-3 there about an entity-add guard).

---

## 5. Backend / Integration Contract

> Backend = Google Apps Script + schema-less Sheets, deployed by `clasp`; `Code.gs` is
> gitignored and **not assumed readable**. New behavior = **ADDITIVE actions**; the
> contracts below are the interface, not a claim about server internals. Every secret
> (team password, Stripe secret key, any send-provider token) stays **server-side,
> named only.**

### 5.1 The portal transport — `portalCall`, NOT `backendCall`

```js
// portal.js — the ONLY network helper in the portal bundle.
// NEVER references backendPassword / BACKEND_URL secret material / DEFAULT_CONFIG.
async function portalCall(token, action, extra) {
  const payload = Object.assign({ action, portalToken: token }, extra || {});
  // mirrors backendCall's DEFENSIVE PARSE: always returns {ok,...}, never throws
  // on a GAS 500/quota/auth HTML page (backend-data.md §5.1, the #220 contract).
}
```

`portalCall` carries a **portal token**, never the team password. Same fail-closed
defensive-parse contract as `backendCall` (`{ok:false,error}` on `bad-json` /
`http-<status>` / action-specific). **Endpoint:** likely the **same** GAS web-app
(one `doPost`, action-routed) so there's one backend to deploy — the action name
namespaces it (`customerPortal*`) and the server requires a `portalToken`, never the
team password, for those actions (**OQ-10** — same web app vs a separate deployment).

### 5.2 Proposed additive actions (all OQ-gated; contracts only)

```
// AUTH ───────────────────────────────────────────────────────────────────────
// 1) Office (or customer) requests access → server sends a magic link / OTP
customerPortalRequest
  in:  { customerId }            // internal/office form (carries the team password via backendCall)
       | { email | phone }       // public self-request form (NO team password)
  out: { ok: true }              // UNCONDITIONAL ok — never reveals whether a contact exists
  side: create a portalGrants row, dispatch link/OTP via the comms send path
  abuse: issuance throttle per destination + per IP (§7.4)

// 2) Exchange a magic-link token / OTP for a short-lived session token
customerPortalAuth
  in:  { token } | { channel, destination, otp }
  out: { ok:true, sessionToken, sessionExpires, customer:{ name, company } }   // minimal identity only
  fail:{ ok:false, error:'expired'|'invalid'|'revoked'|'locked' }              // 'locked' = OTP attempt cap hit
  rule: single-use exchange; bump portalGrants.attempts on a bad OTP, lock after N (§7.4)

// READ (server filters by token.customerId) ──────────────────────────────────
// 3) The dashboard — account, live rentals (+pins), invoices, balance
customerPortalLoad
  in:  { sessionToken }
  out: { ok:true,
         customer: { name, company, phone, email },          // their own contact only
         rentals:  [ { rentalId, displayName, unitOrCategoryName, startDate, endDate,
                       startTime, safeStatus, deliveryAddress, sitePin, invoiceId } ],
         invoices: [ { invoiceId, date, dueDate, amountDueCents, amountPaidCents, po } ],
         balanceCents }                                        // server-computed
  fail:{ ok:false, error:'auth' }
  // NEVER returns: bottomDollar/cost/margin, unit hours/trueCost, _digest internals beyond
  //                spend display, WO/inspection notes, vendor names, ANY other customer's row

// 4) Bookable catalog — available units + feature rentals (shared, NOT customer-specific)
customerPortalCatalog
  in:  { sessionToken, startDate, endDate }
  out: { ok:true,
         available: [ { categoryId, categoryName, availableCount, customerPriceCents } ],
         featured:  [ { featureRentalId, name, blurb, customerPriceCents } ] }   // server-priced, NO floor
  fail:{ ok:false, error:'auth' }

// WRITE-AS-REQUEST (never mutates an internal record directly) ────────────────
// 5) Flag a unit for a field call — request a pickup/delivery
customerPortalFieldCall
  in:  { sessionToken, rentalId, unitId, legType:'pickup'|'delivery', note }
  out: { ok:true, requestId }
  fail:{ ok:false, error:'auth'|'not-yours' }                  // server verifies rental.customerId===token.customerId
  side: append a portalRequests row (kind:'fieldCall', status:'new'); office converts it
        to markFieldCall()/a Field-Call WO. Portal NEVER sets r.fieldCall.

// 6) Request a booking (available unit or a feature rental)
customerPortalBook
  in:  { sessionToken, categoryId|unitId|featureRentalId, startDate, endDate, transportType }
  out: { ok:true, requestId }
  fail:{ ok:false, error:'auth'|'unavailable' }                // server re-checks availability
  side: append a portalRequests row (kind:'booking', status:'new'); office turns it into a Quote.

// MONEY (Phase 3, gated — OQ-4) ───────────────────────────────────────────────
// 7) Pay one of THIS customer's invoices via Stripe (amount server-computed)
customerPortalPayIntent
  in:  { sessionToken, invoiceId }                             // server verifies invoice.customerId===token.customerId
  out: { ok:true, clientSecret, amountCents }                  // PaymentIntent; amount = server balance
  fail:{ ok:false, error:'auth'|'not-yours'|'paid'|'stripe-down' }
  // metadata { invoiceId, customerId, source:'portal' }; authoritative paid state arrives
  // via Stripe's EXISTING webhook to GAS — the portal NEVER writes invoiceStatus.
```

### 5.3 External integrations

| Integration | Phase | Use | Secret (named only) | Status |
|---|---|---|---|---|
| **comms-notifications** send path | 1 (auth) | dispatch magic link / OTP via SMS/email | send-provider token, **server-side** | **HARD BLOCKER — unbuilt** (`comms-notifications.md`: only `sendInvoiceText` `sms:` deep-link, no server send) |
| **Google Maps** | 1 (live map) | render the customer's own pins | browser key referrer-locked (**not a secret**, named only) | exists internally; **referrer allow-list must widen for the portal origin/path** (OQ-9) |
| **Stripe** | 3 (optional pay) | customer pays own invoice via PaymentIntent | secret key **server-side only**; publishable key referrer-locked | server path exists (`stripe*`); reuse server-side |

**Integration trust posture (explicit, non-negotiable — mirrors `backend-data.md` §5).**
Every third-party here (the comms send provider, Google Maps, Stripe) follows the same
three rules so no credential or PII ever crosses the public boundary:

1. **Server-held token, named-only.** Any provider secret (the SMS/email send-provider
   token, the Stripe **secret** key) lives **only** server-side as a GAS Script Property,
   is referenced in this spec and the code **by name only**, and **never** appears in the
   repo, the internal bundle, or — especially — the public portal bundle (AC-4). The two
   *referrer-locked* keys (Maps browser key, Stripe **publishable** key) are not secrets
   but are still named-only here and restricted to the portal origin (§5.4, OQ-9).
2. **Server role-trust, not client-asserted.** The server alone decides a provider call
   is authorized: a send goes out only for a grant the server minted; a PaymentIntent is
   created only after the server re-verifies `invoice.customerId === token.customerId` and
   computes the amount itself. The portal client never tells the server "I'm allowed" —
   the resolved `portalToken → customerId` is the only authority (§3.4).
3. **No PII/secret round-trips through the client.** Send `destination` (the customer's
   email/phone) stays server-side in `portalGrants` and is **never** returned to the
   portal; only the bare `{lat,lng}` reaches the Maps SDK (no customer-identifying
   metadata, §5.4); Stripe gets only `{invoiceId, customerId, source:'portal'}` metadata,
   never internal pricing. The authoritative paid state arrives via Stripe's **existing
   server webhook** to GAS, not from the portal (§5.2 `customerPortalPayIntent`).

### 5.4 Maps specifics (inherit the determinism + no-PII rules)

- The portal map reads the **cached** `sitePin` (`{lat,lng}`) off each of the
  customer's rental units — **never geocodes on the client** (the determinism rule,
  `maps-location.md` §5.1). If a live rental has no pin, it renders **listed but
  unplaced** (no client geocode), exactly like the internal cockpit's pinless fallback
  — or the server supplies a cached geocode in the `customerPortalLoad` projection
  (**OQ-9**).
- **No customer-identifying metadata** is ever attached to a Google request — only the
  bare `{lat,lng}` reaches the Maps SDK (mirrors `maps-location.md` §3.1).
- The **referrer-locked key** is currently restricted to `app.jacrentals.com/*`; the
  portal's origin/path (§6.1, OQ-13) must be added to the key's referrer allow-list (or
  get its own restricted key). Named only — no key value in this spec.

### 5.5 Failure handling (fail-closed everywhere — it's a security default, not just UX)

| Failure | Portal behavior |
|---|---|
| Token expired / invalid / revoked / locked | Locked landing: "That link expired — ask the office to re-send." No data, no hint another account exists. |
| `customerPortalLoad` `{ok:false}` | Locked card; never a partial render; never cached-from-another-session data. |
| Tampered `customerId`/`rentalId`/`invoiceId` | Server rejects (`not-yours`); portal shows the locked state. **Client filter is never the only defense.** |
| Comms send down (auth can't deliver) | "Couldn't send your code — try again or call the office." No enumeration leak. |
| Maps SDK fails | Map degrades to a **list** of the customer's units + statuses (no blank); the dashboard still works. |
| Stripe down (Phase 3) | "Payment's temporarily unavailable — call the office." Invoice stays unpaid; no optimistic mark-paid. |
| GAS 500 / quota (`http-5xx`) | Generic retry; never surfaces backend internals. |

The portal does **NOT** join the internal multi-user poller (`refreshFromBackend`,
`app.js:15713`) — it has no internal session. It reads a **one-shot snapshot** via
`customerPortalLoad` and re-fetches on user pull-to-refresh.

---

## 6. UX / UI

All UI is the **yard data-plate** language (`CLAUDE.md`): dark steel panels
(`linear-gradient(180deg,#1b2129,#0c0e11)`), **one** safety-orange accent
(`--accent #ff7a1a`) for ignition/primary, the hi-vis **hazard-stripe** signature
(`repeating-linear-gradient(135deg, var(--yellow) 0 13px, #14181d 13px 26px)`),
**Saira Condensed** stamped uppercase labels, **Geist** body, corner **rivets**, a
light **leather-tan** ranch seasoning mostly in voice. Every new interactive element
needs a `data-r` stamp; every new **popup** needs a `WINDOW_CATALOG` entry. Run all of
it through the **`jactec-ui`** skill (incl. its mobile sub-capability) before showing
Jac.

### 6.1 The portal is a separate, minimal bundle

`portal.html` + a thin `portal.js`, **NOT** `app.js`, sharing a **trimmed `style.css`
subset** so it reads as **one shop** (steel, orange, Saira, rivets) without importing
the 15.7k-line console or its secret/config. Mobile-first (most customers are on a
phone). **Performance:** stays tiny — no `app.js`, no Maps SDK until the dashboard
mounts, no Stripe SDK unless Phase 3 (soft dep on `frontend-performance`).

### 6.2 Screens (mobile-first)

**S1 — Landing / Auth.** JacRentals steel wordmark, hazard-stripe header, one field
("Enter the code we texted you" / or arrive via the magic link), an ignition primary
**"Wrangle my account"**. Empty/error: "That code's expired — ask the office to
re-send." **No customer list, no hint of other accounts.**

**S2 — My Yard (dashboard).** Stamped header `WELCOME, <company>`; cards:

- **My Fleet (live map)** — a Google Map with the customer's **own** on-rent unit
  pins, plus a safe **status pill** per unit (R/Y/G semantics, **safe labels only**,
  §7.2) and the unit/category name + dates. Map fails → a clean **list** fallback. Tan
  saddle-stitch divider between rows. *(Reads cached `sitePin`; never geocodes
  client-side.)*
- **Order & Spend History** — past rentals + a spend summary (their `_digest` spend
  display only — never cost/margin). A "Round up another" CTA into Book.
- **Invoices & Balance** — open invoices, amounts, due dates, a big stamped **balance**
  plate. **Pay** button only if Phase 3 + the money gate is ON (else "Call the office
  to pay" deep-link).
- **Contact / Help** — their own info + a "Text the office" `sms:` deep-link.

**S3 — Book.** Pick a window → see **available** categories + **feature rentals** with
**their** price (server-computed, no floor) → submit a **booking request** (S6 backend
= `customerPortalBook`). Copy: "Request a rental — the office confirms availability."

**S4 — Flag a field call.** From a live unit on S2: a small sheet — **Pickup** /
**Delivery** + a note + an ignition **"Send the request"**. Copy makes clear it's a
**request** the office acts on, not an instant dispatch.

**S5 — (Phase 3, gated) Pay.** Stripe Elements sheet; never shows internal margin;
amount is the server-computed balance.

**States:** empty ("No active rentals — call to round one up"), loading (steel skeleton
plates, no spinner-slop), error (fail-closed locked card), offline (portal is
online-only in v1 — clean retry, never a stale money figure presented as live).

### 6.3 Internal-side popups (these live INSIDE `app.js` → catalog + stamps required)

| Internal popup | Where | Catalog + stamp |
|---|---|---|
| **Send self-service link** | from the Customer card — channel (email/SMS) + a ranch primary **"Brand & send"** (issues a grant) | **NEW `WINDOW_CATALOG` entry** in the real entry shape — `{ kind, label, tag, sample }` (e.g. `{ kind:'portalLink', label:'Send self-service link', tag:'Customer · portal', sample: () => ({ customerId: ((DATA.customers||[])[0]||{}).customerId }) }`, `app.js:9796`) + `data-r` stamps + `check-window-catalog` + `gen-rule-usage` regen |
| **Portal Requests inbox** | an internal board listing `portalRequests`; convert a field-call request → `markFieldCall`/WO, a booking → Quote | if it's a popup window → **NEW `WINDOW_CATALOG` entry** (same `{kind,label,tag,sample}` shape) + stamps; if an inline card chapter → a Code-Atlas banner → `gen-code-map --check`. Model on the existing `{ kind:'requests', label:'Requests inbox', tag:'Mr. Wrangler · approvals' }` internal-approvals board (`app.js:9806`) — but a **portal-requests** board is distinct: it lists customer-filed `portalRequests`, not the internal Mr. Wrangler approval queue. |

The **portal's own** screens are a separate bundle (§6.1), so their rulebook
discipline is **OQ-12**: reuse R0–R24 + `rule-usage.js` under a `portal/` scope, or a
tiny parallel mini-rulebook (its surface is small). Either way, the **internal**
popups above are non-negotiably catalogued + stamped.

### 6.4 Ranch-twist dosage (customer-facing)

Lighter than internal — it's a B2B equipment renter, not a theme park. One or two
touches in voice ("Wrangle my account", "Round up another", "the office will brand &
send it"), stay professional. If a glance reads "western" before "industrial rental
yard," dial it back (`CLAUDE.md`). **OQ-11.**

---

## 7. Business Rules / Money

### 7.1 Token & session lifetime (conservative defaults)

| Rule | Default (override-able by Jac) |
|---|---|
| Magic-link / OTP validity | **15 minutes**, **single-use** exchange |
| Session lifetime after exchange | **24 hours**, revocable |
| Token at rest | **hashed** in `portalGrants` (never raw) |
| Revocation | flip `portalGrants.revoked` (office) or `customers.portalEnabled=false` (disables all grants) |

### 7.2 Customer-safe status projection (server-side; never expose internal flags)

The portal **never** receives the raw flag set (`flag-color-system.md` §7). The server
projects a **safe** pill (extends `mobile-remote.md` §7.2):

| Internal state | Customer-safe label | Pill |
|---|---|---|
| Reserved, upcoming | "Reserved — <date>" | yellow |
| On Rent | "On Rent — due back <date>" | green |
| End Rent (final day) | "Due back today" | yellow |
| Returned | "Returned" | gray |
| Quote | "Quote — pending" | yellow |
| **Any internal red flag** (failed inspection, field call, off-rent dispute, unpaid-internal) | **"In progress — we'll update you"** (no detail) | yellow |

A field-call **request the customer themselves filed** may show a benign "Pickup
requested" confirmation on their own unit (it's their action) — but **internal**
field-call/inspection state stays masked.

### 7.3 Money / safe-field allowlist (server-side projection)

`customerPortalLoad` / `customerPortalCatalog` return **ONLY**:

```
rentals:  rentalId, displayName, unit/category display name, startDate, endDate,
          startTime, safeStatus, deliveryAddress (their own), sitePin (their own), invoiceId
invoices: invoiceId, date, dueDate, amountDueCents, amountPaidCents, po
balance:  server sum of (amountDue − amountPaid) across THIS customer's open invoices
catalog:  categoryName, availableCount, customerPriceCents (server-computed), feature name/blurb
```

**Never** returned: `bottomDollar`/`msrp`/`askPrice`/margin/cost, unit `trueCost`/
hours, internal notes, WO/inspection line items, vendor names, `_digest` internals
beyond a spend display, other customers' anything, Stripe customer secrets. **Balance
and booking price are computed server-side** so no internal pricing/floor formula ever
crosses the boundary.

### 7.4 Abuse / brute-force hardening (auth is public-facing — launch blocker)

Magic-link/OTP **issuance** and **exchange** are public endpoints — they invite
OTP-guessing, contact-enumeration, and SMS/email spam (toll-fraud on paid SMS). GAS has
no native rate-limiter, so counters live in `portalGrants` (or a script-property
store):

| Control | Default (confirm with Jac — **OQ-3**) |
|---|---|
| OTP attempt cap | **5 attempts / 15 min**, then `locked` |
| Issuance throttle | **3 / hour per destination** + a per-IP cap |
| Enumeration defense | `customerPortalRequest` returns `{ok:true}` **unconditionally** (never reveals if a contact exists) |

### 7.5 Booking is a request, field-call is a request

Neither portal write mutates an internal record. `customerPortalBook` and
`customerPortalFieldCall` **append a `portalRequests` row**; the office converts it
(Quote / `markFieldCall`). This keeps the **untrusted** side from ever writing a
billed/dispatch fact directly, and keeps all the internal **booking hard gates**
(invoice-before-On-Rent, blacklist block, card-signed gate — `rentals-dispatch.md`
§3.5) on the trusted side where they belong.

---

## 8. Phasing & Milestones

> **Nothing in any phase ships until (a) Jac signs off the §3 auth/isolation gate
> (OQ-1) and (b) the `comms-notifications` server-side send path exists.** This is a
> Want-tier area gated on two unbuilt foundations.

### Phase 0 — Spec & gate sign-off (this doc) — IN SCOPE NOW
- Resolve §11 (auth model, isolation, money gate, abuse thresholds, hosting).
- Confirm the **`backend-data` external-auth contract** (OQ-1 there) and the
  **`comms-notifications` send path** timeline. No portal code until both are settled.

### Phase 1 — Read-only portal (the MVP)
- **B1 — Backend:** `portalGrants` + `portalRequests` tabs; `customerPortalRequest`/
  `Auth`/`Load`/`Catalog` actions; server-side isolation + safe-field projection +
  abuse caps. Additive, `/clasp`-deployed (prod-deploy STOP gate applies).
- **B2 — Portal bundle:** `portal.html` + `portal.js` + trimmed `style.css`; S1 Auth +
  S2 My Yard (live map, history, invoices/balance — **read-only**).
- **B3 — Internal:** the office **"Send self-service link"** popup + the **Portal
  Requests** inbox (catalogued + stamped).

### Phase 2 — Self-service requests (write-as-request)
- **B4 — Field call:** S4 + `customerPortalFieldCall` → `portalRequests` → office
  converts to `markFieldCall`/WO.
- **B5 — Book:** S3 + `customerPortalBook` + `customerPortalCatalog` + feature-rentals
  (OQ-7) → `portalRequests` → office converts to a Quote.

### Phase 3 — Pay-from-portal (only behind a money gate)
- **B6 — Pay:** S5 + `customerPortalPayIntent` via the existing server-side Stripe
  path; authoritative paid state via the existing webhook. **OUT** unless OQ-4 = yes.

**v1 recommendation:** Phase 0 now; Phase 1 when both blockers clear. Phases 2–3 follow.

---

## 9. Acceptance Criteria (testable + CI gates)

Run gates per `CLAUDE.md` (swap `8000→9147`, run, `git checkout -- ci/`).

| # | Criterion | Verify |
|---|---|---|
| AC-1 | **Customer isolation (server-side).** A session for X returns ONLY X's rentals/invoices/balance/pins. A request that *names* customer Y (tampered `customerId`/`rentalId`/`invoiceId`) returns **zero Y rows** and `{ok:false,error:'not-yours'}` for a Y pay-intent/field-call. The front-end filter is **never** the only defense. | `ci/logic-test.mjs` isolation fixture (2 customers) |
| AC-2 | **Fail-closed auth.** A stale/revoked/expired/locked token returns `{ok:false}` + the locked state; no partial render; no other-account data. | `logic-test` over the grant resolver |
| AC-3 | **Safe-field projection.** `customerPortalLoad`/`Catalog` responses contain **none** of: `bottomDollar`/`msrp`/`askPrice`, cost/`trueCost`/margin, unit hours, internal notes, WO/inspection line items, vendor names, other customers' ids — even if those fields exist on the source rows. Adding a field to the projection requires updating this test. | `logic-test` against the §7.3 allowlist |
| AC-4 | **No secret in the portal bundle.** The built portal asset contains **no** `backendPassword`, no `BACKEND_URL` secret material, no `DEFAULT_CONFIG` value, no margin/cost field, no model id, no real PII. | CI grep over the built portal file (fail = block) |
| AC-5 | **No client geocode.** No Maps geocode/Distance call enters a portal render path; the map reads cached `sitePin` only (determinism rule). | `logic-test` / grep over `portal.js` |
| AC-6 | **Write-as-request.** `customerPortalFieldCall`/`Book` append a `portalRequests` row and do **NOT** set `r.fieldCall` or create a rental directly. | `logic-test` |
| AC-7 | **Abuse caps.** OTP locks after N attempts; issuance throttles per destination; `customerPortalRequest` returns `{ok:true}` regardless of contact existence (no enumeration). | `logic-test` over the counters |
| AC-8 | **Internal popups catalogued + stamped.** "Send self-service link" + "Portal Requests" (if popups) appear in `WINDOW_CATALOG`; all new elements carry `data-r`. | `ci/check-window-catalog.mjs`, `ci/gen-rule-usage.mjs --check` |
| AC-9 | **Money gate (Phase 3).** `customerPortalPayIntent` computes the amount **server-side** from the invoice balance (rejects a client-supplied amount), verifies `invoice.customerId===token.customerId`, and the portal never writes `invoiceStatus`. | `logic-test` + manual against a mocked Stripe |
| AC-10 | **Code-Atlas drift.** If a new internal chapter banner is added (e.g. `§Portal Requests`), the Code-Atlas index regenerates clean. | `node tools/gen-code-map.mjs --check` |
| AC-11 | **Boot/smoke.** Internal app still boots/smokes with the additive popups; the portal bundle loads its Auth screen on a phone viewport with zero horizontal scroll. | `ci/smoke.mjs` (+ a portal smoke, OQ-12) |

---

## 10. Risks & Edge Cases

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Customer-isolation leak** — a portal action trusts a front-end `customerId` → live PII/data breach. | **Critical** | Server-side filter on `token.customerId` + safe-field allowlist + fail-closed; the §3 gate is Jac's call, never silently loosened. |
| R2 | **Secret in a public bundle** — the portal imports `app.js`/`config.js` and ships `backendPassword`/`DEFAULT_CONFIG` to customers. | **Critical** | Separate bundle + `portalCall` (no secret in scope) + CI grep (AC-4). |
| R3 | **Token theft / link forwarding** — a magic link is a bearer credential. | High | Short expiry, single-use exchange, hashed-at-rest, revocable grant, 24h session cap; no money action on a stolen *read* session unless Phase 3 + gate on. |
| R4 | **Auth abuse** — OTP-guessing, contact-enumeration, SMS toll-fraud. | High | Attempt cap + issuance throttle + unconditional `{ok:true}` on request (§7.4). Launch blocker. |
| R5 | **Pricing-floor leak via booking** — a customer-facing quote exposes margin/`bottomDollar`. | High | Server-computed price, floor never in the projection or bundle (§3.5/§7.3). |
| R6 | **Site-pin / PII leak** — another customer's job-site pin shows on the map. | High | Map plots **only** the signed-in customer's cached pins; server-filtered (`maps-location.md` §3.1 honored). |
| R7 | **Stale money offline** — a cached balance shown as current. | Medium | Portal is online-only v1; never present a cached figure as live; show "last synced" if ever cached (mirrors `mobile-remote.md` OQ 11.14). |
| R8 | **Maps referrer mismatch** — the key is locked to `app.jacrentals.com/*`; the portal origin/path isn't on the list → map silently fails. | Medium | Widen the referrer allow-list (or own key) for the portal origin (OQ-9/OQ-13); list fallback if it fails (R6 still holds). |
| R9 | **Double-charge (Phase 3)** — an ambiguous Stripe result re-fires. | Critical (Phase 3) | Reuse the internal money-action discipline: never auto-retry a charge; surface to the customer; Stripe idempotency key (`backend-data.md` OQ-14). |
| R10 | **Comms dependency blocks the whole area** — no server send = no auth. | High | Phase 0 confirms the `comms-notifications` timeline; nothing ships before it. |
| R11 | **Request spam** — a customer floods `portalRequests` with bookings/field-calls. | Low/Medium | Rate-limit the write actions per session; office triages the inbox. |
| R12 | **Backend has no isolation today** — the load-everything model can't row-scope. | Critical | The new `customerPortal*` actions are the *only* path the portal uses; they filter server-side. The portal **never** calls `load`. |

---

## 11. Open Questions

> **Resolved 2026-06-29:** OQ-1/OQ-2/OQ-3 → **D1** (magic-link only, 15-min→24h, issuance-throttle only). OQ-4 → **D3** (pay-from-portal IS in v1, server-computed amount, webhook-authoritative). OQ-6 → **D4** (Settings toggle `portalBookingMode`, default self-reserve, internal accept/decline always + outbound comm on decision). OQ-13 → **D5** (same site `/portal`). 'Spin history' → **D2** (typo for spend history, no new feature). OQ-5/OQ-7/OQ-8/OQ-9/OQ-10/OQ-11/OQ-12/OQ-14/OQ-15 → **D6** (adopt conservative drafts). Note: D3 + D4 both make `comms-notifications` a hard dep beyond auth.

*(Every fork below is phrased for Jac with a conservative draft. Anything touching auth,
isolation, money, or PII keeps its conservative default until Jac overrides — these are
the load-bearing decisions.)*

**OQ-1 — External-auth model (THE gate).** Magic link vs short OTP vs both? And does
the **backend** enforce the per-customer token server-side (it must — there's no
per-customer credential today, §2.4)? Trade-off: link = one tap but forward-able; OTP =
friction but harder to forward. **Draft: magic link, 15-min single-use, OTP fallback;
server-enforced token resolving to one `customerId`.** *This + `backend-data` OQ-1 must
land before any portal code.*

**OQ-2 — Token/session lifetime.** 15-min link → 24h session, revocable? Or a longer
"remember this device"? Trade-off: convenience vs blast radius on a lost phone.
**Draft: 15-min single-use → 24h session.**

**OQ-3 — Abuse thresholds.** OTP attempt cap (draft **5 / 15 min**) + issuance throttle
(draft **3 / hour per destination** + per-IP). Where does the counter live without
bloating the Sheet — `portalGrants` rows or a script-property store? **Draft: counters
on `portalGrants`; confirm thresholds.**

**OQ-4 — Pay-from-portal in v1?** A **money gate**. Pro: real collection lift + call
deflection. Con: Stripe surface, refund/dispute flows, the pricing boundary. **Draft:
NO for v1 (read-only); revisit as Phase 3 / B6.**

**OQ-5 — Who can issue a portal link?** It exposes a customer's data to that customer →
controlled. **Draft: tier ≥ `money` (Office/Sales/Manager/Admin).** Should a **customer
self-request** form exist too (public `customerPortalRequest` by email/phone with the
enumeration defense), or office-issued only? **Draft: office-issued in Phase 1; public
self-request later behind the abuse caps.**

**OQ-6 — Booking is a *request* (office converts) vs a *direct* reservation?** Draft
(§7.5) is **request-only** — the office turns it into a Quote, keeping every booking
hard gate (invoice/blacklist/card) on the trusted side. Direct-reserve is a much bigger
trust + gate surface. **Draft: request-only for v1.** Does Jac want instant
self-reserve later?

**OQ-7 — "Feature rentals" shape.** A `featured`+`featureBlurb` tag on existing
categories/units, or a small new `featureRentals` config list? Who curates it (admin
Settings)? **Draft: a `featured` tag + blurb on categories, admin-curated.**

**OQ-8 — Field-call request → which internal artifact?** Convert a portal field-call
request to `markFieldCall(rentalId)` (sets `r.fieldCall`), to a **Field-Call WO**
(`woType:'Field Call'`), or both? They're related but distinct (§2.3). **Draft: office
review creates the WO (the dispatch-actionable artifact) and sets `r.fieldCall` for the
flag — keep the human in the loop.**

**OQ-9 — Maps key & client geocode.** Widen the existing referrer-locked key's
allow-list to the portal origin, or issue a separate restricted key? And: does the
server include a cached geocode in `customerPortalLoad` (so the portal never geocodes),
or does the portal lazily geocode pinless units (breaks the determinism rule)? **Draft:
widen the allow-list; server supplies cached pins only, portal never geocodes.**

**OQ-10 — Same GAS web app or a separate deployment?** Route `customerPortal*` through
the **same** `doPost` (one backend to deploy, action-namespaced, `portalToken`-gated)
vs a separate GAS deployment for the external surface (cleaner blast-radius isolation).
**Draft: same web app, separate action namespace + token gate; revisit if isolation
demands a split.**

**OQ-11 — Customer-facing ranch-voice dosage.** "Wrangle my account" / "Round up
another" — charming or too cute for a B2B equipment renter? **Draft: lighter than
internal — one or two touches, stay professional.**

**OQ-12 — Portal rulebook + smoke discipline.** Does the separate portal bundle reuse
R0–R24 + `rule-usage.js` (under a `portal/` scope) + a portal smoke test, or get a tiny
parallel mini-rulebook? **Draft: reuse with a `portal/` scope + a minimal portal smoke;
internal popups stay in the main R-rulebook + WINDOW_CATALOG regardless.**

**OQ-13 — Hosting / route.** Same Pages site under `/portal` (one origin, simplest) vs
a subdomain (`my.jacrentals.com`, cleaner origin/cookie isolation + its own deploy)?
Trade-off: deploy simplicity vs isolation. **Draft: separate path/bundle now, subdomain
if isolation or branding wants it.**

**OQ-14 — Reconcile `mobile-remote`.** On its next revision, replace `mobile-remote`
half B with a one-line pointer here, and keep `mobile-remote` authoritative for the
internal reflow + the shared token shell. Confirm that division. **Draft: yes.**

**OQ-15 — `portalEnabled` default + bulk control.** Should the portal be opt-in
per-customer (`portalEnabled` absent = off, fail-closed) with an office toggle, or
on-by-default once a customer has a verified email/phone? **Draft: opt-in,
fail-closed.**

---

## 12. Dependencies & Sequencing

| Depends on (roadmap slug) | Why | Blocking? |
|---|---|---|
| `comms-notifications` | server-side SMS/email send for magic links / OTP | **Hard blocker for ALL auth** (unbuilt today) |
| `backend-data` | a **new external-auth + isolation contract** (per-customer token, server-side row filtering) + the additive `customerPortal*` actions + the two new tabs; the load-everything model can't row-scope today (D3/OQ-1 there) | **Hard blocker** |
| `customers-crm` | the customer entity + `customerId` isolation key + spend `_digest` the portal reads | Yes (portal reads it) |
| `invoicing-payments` | invoices/balance the portal reads; Stripe path for Phase 3 | Yes (read; Phase 3 needs Stripe) |
| `rentals-dispatch` | the customer's rentals + safe status the portal surfaces; field-call requests feed dispatch; booking requests become Quotes | Yes (read + request-fulfillment) |
| `maps-location` | the live Google Map + cached `sitePin` + the determinism + no-PII rules + the referrer-locked key | Yes (the map) |
| `units-fleet` | available units / categories + `isUnitAvailableFor` for the bookable catalog | Yes (booking) |
| `mobile-remote` | the responsive/portal shell + the shared trimmed design tokens; reconcile half B → here | Yes (shell) + reconcile |
| `design-system` | R0–R24 stamps, tokens, CI guards every new element must satisfy | Yes (every element) |
| `frontend-performance` | the portal bundle stays tiny on a customer's phone | Soft |

**Sequencing:**

1. **Phase 0 (now):** lock §11 — especially **OQ-1 (auth/isolation)** + the
   `backend-data` external-auth contract + the `comms-notifications` send timeline.
   **No portal code until all three are settled.**
2. **When `comms-notifications` send + the `backend-data` external-auth contract
   exist:** Phase 1 (B1 backend isolation + projection, B2 read-only portal, B3 office
   send-link + requests inbox).
3. **Then:** Phase 2 (field-call + booking requests).
4. **Only behind a money gate (OQ-4):** Phase 3 (pay-from-portal).

---

*End of DRAFT — every numbered decision in §11 is open for Jac's critique. The auth +
isolation + secret-isolation model (§3) is the load-bearing design; nothing in §5/§6
ships until OQ-1, the `backend-data` external-auth contract, and the
`comms-notifications` send path are settled.*
