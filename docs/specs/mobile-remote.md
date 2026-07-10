# Mobile / Remote — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/mobile-remote`
**Task branch:** `mobile-remote/spec` (proposed)
**Maturity:** partial
**Scope:** Own the phone/tablet responsive layer (reflow, swipe nav, touch
gestures, haptics, bottom-sheets, safe-area, the PWA shell) **and** the future
row-isolated customer self-service portal — making Rental Wrangler usable in the
yard, in the cab, and (eventually) in the customer's hand.

## ✅ Decisions — 2026-06-29 critique (Jac)

- **D1 — `customer-portal` owns the portal; mobile-remote owns only the shell.** Half B (auth, customer isolation, data gates, screens, `customerPortal*` backend actions, the office "send link" dialog) is **moved to the `customer-portal` spec** as the single source of truth — so the two specs can't drift on the security model. mobile-remote keeps **only** the device layer: responsive reflow, bottom-sheets, gestures/haptics, safe-area, the PWA shell (manifest/service-worker/install), and the *mobile presentation* of whatever screens the portal defines. §3.2 and the §6.2 "half B" material below now read as **reference/pointer** to `customer-portal`; the canonical contract lives there.
- **D2 — Portal auth = magic link ONLY.** No OTP code-entry path. A texted/emailed one-tap URL (short expiry, single-use) → revocable session. (Recorded here for continuity; the authoritative auth spec now lives in `customer-portal`.)
- **D3 — Half A offline = shell-cache only (read-tolerant).** Ship A1 (install prompt) and A2 (service-worker shell) now — both are dependency-free. The SW caches the static app shell so a dead-zone load isn't blank; **cache version follows the `?v=` deploy token**; backend reads/writes stay **online-only** (no offline write queue in v1 — avoids merge hazards with the diff-sync engine). The "last synced HH:MM" stamp (§11.14) applies to any cached money figure.

---

## 1. Goal & Problem

Rental Wrangler is built for **JacRentals** as a desktop-first ops console (a
3-column yard grid: Units · Categories · Rentals / Shop · Invoices · Customers).
But the people who generate the data are rarely at a desk:

- **Yard/field hands** (mechanics, M.Tech, drivers) walk units, run inspections,
  open work orders, and post to the team chat **from a phone** in the gravel.
- **Office/Sales** quote, take a card, and check a customer on the road.
- **Customers** today have **zero** direct access — every status check, every
  "is my machine ready?", every receipt is a phone call or a text to the office.

The **north star**: a field hand can do a full day's real work on a 390px phone
without horizontal scroll, without hunting for a tap target, and without the app
feeling like a shrunk-down desktop site — AND a customer can self-serve the
read-only basics (active rentals, invoices, balance, "ready" status) from a link
without ever touching the internal console or seeing another customer's data.

Two halves, very different maturity:

| Half | Maturity | This spec's job |
|---|---|---|
| **A — Internal mobile reflow** (M0–M3) | substantially shipped | Document as **canon**, close the remaining gaps (offline/service-worker, tablet polish, gesture edge-cases). |
| **B — Customer self-service portal** | **unbuilt** | Greenfield design: data gates, auth model, screens, backend contract — the bulk of the open questions. |

Why it matters: half A is what keeps the field crew on the app at all; half B is a
**Want-tier** growth lever (deflect office phone calls, look modern to customers)
that is **blocked on auth + a messaging/notification backend** that don't exist yet.

---

## 2. Current State (Baseline)

### 2.1 Internal mobile reflow — SHIPPED (this is canon)

The adaptive-reflow approach (one set of width breakpoints + a thin JS gesture
layer, **no separate mobile render path**) from
`docs/superpowers/specs/2026-06-14-mobile-adaptive-design.md` is largely live.

| Piece | Where | State |
|---|---|---|
| Viewport meta (1:1 lock, `viewport-fit=cover`, `user-scalable=no`) | `index.html:5` | ✅ shipped |
| Breakpoint classes `is-phone` (≤640) / `is-narrow` (≤1024) on `<body>` | `applyViewportClass` app.js:16096; `boot` listeners app.js:16112 | ✅ shipped |
| Responsive grid 3 → 2 → 1 columns | `style.css §M0` (style.css:300+) | ✅ shipped |
| Single-column phone grid (no 3-wide scroll track; JS owns horizontal) | `style.css` `.is-phone .grid` | ✅ shipped |
| `state.mobileCol` (0 Yard · 1 Rentals · 2 Customers) | app.js:1920 | ✅ shipped |
| Per-column bottom dock + card-toggle bar + dot nav (`§M1`) | `style.css §M1`; dock app.js:7499–7522 | ✅ shipped |
| Swipe nav: footer swipe = change column; grid swipe = card Back/Forward | `boot` pointer listeners app.js:16118–16147 | ✅ shipped |
| Bottom-sheet overlays + winpicker/date-picker sheets (`§M3`) | `style.css §M3`; `dismissTopSheet`/popstate app.js:16115 | ✅ shipped |
| Touch-target floor (≥44px) on interactive controls (`§M-touch`) | `style.css §M-touch` | ✅ shipped |
| Safe-area insets (`env(safe-area-inset-*)`) on dock/sheets | `style.css §M0/§M1/§M3` | ✅ shipped |
| Double-tap-zoom kill + 16px input font (iOS no-zoom) | `body.is-phone { touch-action: manipulation }` style.css | ✅ shipped |
| Android hardware-back closes the topmost sheet (history-managed) | `popstate` handler app.js:16115 | ✅ shipped |
| **Drag gesture model**: move=drag, hold-still=menu, tap=action | drag engine §15c; `phoneDragEdge` app.js:12096 | ✅ shipped |
| **Zip-zones** mobile cross-column drag-link | app.js:12115–12158; `style.css §M` | ✅ shipped (per 2026-06-23 design) |
| `haptic(pattern)` — Vibration API, committed-gesture only, per-device toggle | `haptic` app.js:11807; `state.hapticsOff` app.js:1929; Settings toggle app.js:3509 | ✅ shipped |
| Phone header reflow (logo + 5 KPI rings + search + tool bar rows) | `style.css §M4` | ✅ shipped |
| Phone record-card fixes (drop operator name, timeline reflow, hide wr-rail) | `style.css §M5` | ✅ shipped |
| **PWA manifest** (standalone, theme-color, 192/512 + maskable icons) | `manifest.webmanifest`; `index.html:12` | ✅ shipped |

**Haptics detail (canon):** `haptic()` no-ops when `state.hapticsOff`, when
`'vibrate'` is absent (iOS — vibration is Android-only), or under
`prefers-reduced-motion`. One pulse on a committed action; `[12,30,12]` for a
success tick, `[35,25,35]` for an abort buzz, single short ticks (`8`/`10`) for
"armed" affordances (zip-zone, cancel-arc, new-chat pad). Default ON.

### 2.2 Internal mobile — PARTIAL / MISSING

| Gap | Evidence | Note |
|---|---|---|
| **No service worker** | no `serviceWorker.register` anywhere; manifest only | App is **online-only**. A dead-zone yard load = blank. The roadmap calls this out explicitly. |
| **External-chats strip is a shell** | 2026-06-14 design §M1 | Customer/vendor SMS/email slot exists but is dark — blocked on `comms-notifications` backend. |
| **No "Add to Home Screen" prompt / install affordance** | none found | Manifest exists but nothing surfaces install. |
| **Tablet (2-col) is "un-broken," not polished** | 2026-06-14 scope | Rentals/dispatch + Customers got no first-class phone polish by design. |
| **Push notifications** | none | Manifest + no SW = no Web Push. |

### 2.3 Customer self-service portal — UNBUILT (greenfield)

The only trace is a roadmap stub in the feature backlog: `'Customer self-service
portal', area: 'Mobile', type: 'Feature'` (app.js:7347). **No portal code, no
customer auth, no public route exists.** It must build on:

- **Customer records** (`data.js` — `customerId`, `name`, `company`, `phone`,
  `email`, `payStatus`, `cards[]`, `_digest`, …). These are the entities a portal
  would scope to.
- **Rentals / Invoices** keyed by `customerId` — the data a customer would read.
- The **single `backendCall(action, extra)`** entry point (app.js:15650), which
  POSTs `{action, password: backendPassword, …}` to one GAS web-app URL. **Today
  `backendPassword` is one shared internal secret** — there is no per-customer
  credential anywhere. This is the central blocker for half B (see §3, §5, §11).

---

## 3. Users, Roles & Data Gates

### 3.1 Internal roles — all touch this area (tier-gated, not name-gated)

Mobile reflow is **role-agnostic** — every authenticated role gets the same
responsive layer, so **all 15 roles** in the role universe touch this area on a
phone. Gating is **never** by role name; it rides the **tier ladder**
(`ROLE_TIERS`, config.js:326; `tierRank`, config.js:334), 5 ranks:

```
staff(1) · money(2) · manager(3) · admin(4) · developer(5)
```

Default tier per shipped built-in role (`BUILTIN_ROLE_TIERS`, config.js:340 —
the fallback when a backend predates `settings.roleMeta`):

| Role (built-in) | Default tier | Primary mobile use |
|---|---|---|
| Mechanic | staff | Shop card, WOs, inspections, team chat — **heaviest phone user** |
| M.Tech | staff | Inspections, ready-rate, units |
| Driver | staff | Rentals/dispatch read, wash, team chat |
| Office | money | Quotes, take-a-card, invoices, customers |
| Sales | money | Pipeline, customers, quotes |
| Manager | manager | All of the above + admin views |
| Admin / (legacy Owner) | admin | Everything incl. Settings/Rulebook |
| Developer | developer | Everything + dev tooling |

Custom roles map to one of these tiers at runtime via `settings.roleMeta`
(synced to every user in `loadFromBackend`, app.js:13051); an unknown/blank tier
resolves to **rank 0 — no privilege** (`tierRank`, config.js:334), which is the
correct fail-closed default.

**The mobile layer must NOT widen any gate.** Pricing/margin (`bottomDollar`,
unit cost) visibility and **money actions** (take payment, refund, lock invoice)
stay **`tierRank(role) ≥ money(2)`** exactly as on desktop. The phone UI calls
the **same builders** as desktop, so the gates ride along for free. **Rule:** no
mobile-specific gate code is added that could drift from the desktop gate — any
`is-phone` branch is **presentation only** (reflow/dock/sheet), never a
visibility or authorization decision. If a future phone-only surface ever needs
a gate, it reuses the existing `tierRank` check, never a new parallel one.

### 3.2 Customer self-service portal — NEW external persona (HARD GATE)

This is the area's central security problem and **every choice below is an Open
Question, decided conservatively in this draft.**

- The portal persona is **not** a Rental Wrangler role and **must never** receive
  `backendPassword` or any internal-tier credential.
- **Customer isolation:** a portal session for customer `C0009` may read **only**
  `C0009`'s rentals, invoices, balance, and ready-status — never another
  customer's rows, never any unit cost/margin, never `bottomDollar`, never
  internal WO/inspection notes, never other customers' PII.
- **Money actions** (take payment) from the portal: **OUT of v1** (Open Q 11.4).
  If ever in, they route through Stripe, never expose internal pricing math, and
  never write an invoice's internal fields.
- **PII:** the portal exposes a customer **their own** contact info and rentals
  only. The repo is public via Pages, so **no customer PII, secrets, or
  `DEFAULT_CONFIG` values appear in any committed file** — the portal reads live
  data at runtime through a **new, separately-authenticated** backend action.

**Draft stance:** the portal is a **read-mostly, magic-link / OTP-authenticated,
server-filtered** view. The browser never holds the internal password; a portal
token authorizes a narrow set of new `customer*` actions that the GAS backend
**filters server-side by `customerId`** before returning anything.

---

## 4. Data Model

### 4.1 Existing entities (no schema change for half A)

Half A (reflow) adds **no** persisted fields. The only mobile state is **client
ephemeral / per-device**:

| Field | Where | Persist |
|---|---|---|
| `state.mobileCol` (0/1/2) | app.js:1920 | in-memory (session) |
| `state.hapticsOff` | app.js:1929 | `localStorage['jactec.hapticsOff']` (per device) |
| `is-phone` / `is-narrow` body classes | derived from `matchMedia` | not persisted |

### 4.2 Proposed — Portal access entities (half B, schema-less additive)

Backend is schema-less Sheets; new state is **additive** — new tab(s) and/or new
fields on `customers`, never a migration of existing columns.

**Option (draft): a new `portalGrants` tab** (one row per active customer-portal
credential), so customer PII rows aren't polluted with auth material:

```
portalGrants (proposed Sheets tab)
  grantId        // PG-xxxx
  customerId     // FK → customers.customerId  (isolation key)
  channel        // 'email' | 'sms'
  destination    // the email/phone the link/OTP was sent to (server-side only)
  tokenHash      // HASH of the magic-link/OTP token — NEVER the raw token
  issuedAt       // ISO
  expiresAt      // ISO (short — see §7)
  lastUsedAt     // ISO
  revoked        // bool
```

Rationale for hashing + a separate tab: the Sheet is the source of truth but is
**not** public, yet defense-in-depth says store only a **hash** of any token, and
keep auth material off the customer PII row. No raw token, password, or secret is
ever written to the repo (it lives only in the backend Sheet + transiently in the
sent link).

**Relationships:** `portalGrants.customerId → customers.customerId` is the single
isolation join. Every portal read action resolves the grant → its `customerId`,
then filters `rentals`/`invoices` to that id **server-side**.

### 4.3 Migration concerns

- Half A: none.
- Half B: purely additive (`portalGrants` tab + optionally a
  `customers.portalEnabled` boolean). A backend predating the tab simply has no
  grants → portal is dark for everyone (fail-closed). No existing field changes.

---

## 5. Backend / Integration Contract

### 5.1 Half A (reflow) — no backend change

Reflow rides the existing `backendCall` data path unchanged. **A service worker
(offline) is the only half-A backend-adjacent item** and it is a **static-asset**
concern, not a GAS action (§8 Phase A2).

### 5.2 Half B (portal) — NEW additive GAS actions on `backendCall`

All new actions are **additive** on the single `backendCall(action, extra)`
entry (app.js:15650). **They do NOT accept the internal `backendPassword`** —
they carry a **portal token** instead.

**Exact security hazard (cite the code):** the internal `backendCall` helper
hard-injects the secret on **every** call —
`Object.assign({ action, password: backendPassword }, extra)` (app.js:15652).
There is **no per-action opt-out**. So a portal action invoked through
`backendCall` would necessarily transmit `backendPassword` from the customer's
device — a live secret leak. Two ways out:

- **(a) — chosen.** A **separate** thin `portalCall(token, action, extra)`
  helper that NEVER references `backendPassword` (the symbol is not even imported
  into the portal bundle), sending `{ action, portalToken: token, … }` only.
- (b) The server ignores `password` for `customer*` actions and requires
  `portalToken`. **Rejected** — it still ships the secret to the customer device
  if the portal ever shares `backendCall`; defense should be that the secret is
  never *in scope*, not merely ignored.

**Draft: option (a)** — a standalone portal bundle (`portal.html` + thin JS,
§6.2) whose only network helper is `portalCall`; the internal secret, `app.js`,
and `config.js` (which holds `DEFAULT_CONFIG`) never ship to a customer. CI grep
of the built portal asset enforces this (§9 AC 9).

Proposed actions (contracts; Code.gs is gitignored — describe, don't assume):

```
// 1) Request access — office or customer initiates; sends a magic link / OTP
customerPortalRequest
  in:  { customerId | email | phone }          // internal (office) form carries customerId
  out: { ok: true }                            // never reveals whether the contact exists
  side: creates a portalGrants row, dispatches link/OTP via comms backend

// 2) Exchange a magic-link token / OTP for a short-lived session token
customerPortalAuth
  in:  { token | (channel, destination, otp) }
  out: { ok: true, sessionToken, expiresAt, customer: {name, company} }  // minimal identity only
  fail:{ ok: false, error: 'expired' | 'invalid' | 'revoked' }

// 3) Read THIS customer's dashboard — server filters by the token's customerId
customerPortalLoad
  in:  { sessionToken }
  out: { ok: true, customer:{name,company,phone,email}, rentals:[…safe fields…],
         invoices:[…safe fields…], balanceCents }    // NO margin/cost/bottomDollar, NO other customers
  fail:{ ok: false, error: 'auth' }

// 4) (Phase 3, gated) start a Stripe payment for one of THIS customer's invoices
customerPortalPayIntent
  in:  { sessionToken, invoiceId }               // server verifies invoice.customerId === token.customerId
  out: { ok: true, clientSecret, amountCents }   // Stripe PaymentIntent; amount = server-computed balance
  fail:{ ok: false, error: 'auth' | 'not-yours' | 'paid' | 'stripe-down' }
  side: creates a PaymentIntent for THIS invoice only; webhook (existing internal
        stripe* path) reconciles paid status — the portal NEVER writes invoice fields

// 5) (Phase 3) confirm/return — the portal confirms client-side via Stripe.js;
// the AUTHORITATIVE paid state arrives via Stripe's existing webhook to the GAS
// backend, not from the portal. The portal then re-runs customerPortalLoad to
// reflect the new balance. No portal action sets invoiceStatus directly.
```

**Stripe payload shape (Phase 3, reuse the internal `stripe*` server path,
app.js:577).** The portal sends only `{ sessionToken, invoiceId }`; the **server**
looks up the invoice, re-verifies `invoice.customerId === token.customerId`,
computes the amount from the invoice balance (NOT a client-supplied amount — a
client amount would be a tamper vector), and creates the PaymentIntent with
metadata `{ invoiceId, customerId, source: 'portal' }`. The portal receives only
the `clientSecret` + display `amountCents`. **No card PAN, no internal pricing
math, no `bottomDollar`/margin ever crosses to the client.** Stripe publishable
key (referrer-locked, like the Maps key) is the only Stripe credential the portal
holds; the secret key stays server-side.

**Server-side gate (non-negotiable, spec it explicitly):** every `customerPortal*`
read/write action MUST (1) resolve `sessionToken → grant → customerId`, (2)
reject if `revoked` or past `expiresAt`, and (3) **filter every returned row by
that `customerId`** — the front-end is never trusted to scope. The "safe fields"
projection is a server-side allowlist (see §7.3) so margin/cost can't leak even
by accident.

### 5.3 External integrations touched

| Integration | Half | Use | Status |
|---|---|---|---|
| **comms-notifications** backend | A (external-chat strip) + B (magic link/OTP delivery) | SMS/email send | **blocked / unbuilt** — hard dependency |
| **Stripe** | B Phase 3 (optional) | customer pays own invoice via PaymentIntent | exists for internal `stripe*` actions (app.js:577) — reuse server-side |
| **Web Push** | A (push notifications) | notify field hand / customer | needs service worker + a push backend (none today) |
| **Service worker / Cache API** | A (offline shell) | cache the static SPA shell | none today |

### 5.4 Failure handling

Reuse the canon defensive pattern: `backendCall` already never throws — it parses
defensively and ALWAYS returns `{ok:false,error}` even on a GAS 500/quota/auth
HTML page (app.js:15659–15660, the #220 fix; `error` ∈ `'bad-json'`,
`'http-<status>'`, or an action-specific string). `portalCall` mirrors this exact
contract.

**Fail-closed everywhere** (the security default, not just a UX nicety):

| Failure | Portal behavior |
|---|---|
| Auth token expired/invalid/revoked | Locked landing: "That link expired — ask the office to re-send." No data, no hint another account exists. |
| `customerPortalLoad` returns `{ok:false}` | Locked card, never a partial render, never cached-from-another-session data. |
| Stripe down (`stripe-down`) | "Payment's temporarily unavailable — call the office." Invoice stays unpaid; no optimistic mark-paid. |
| GAS 500 / quota (`http-5xx`) | Generic retry; never surfaces backend internals. |
| Tampered `customerId`/`invoiceId` | Server rejects (`not-yours`); portal shows the locked state. **Never trusts the client filter.** |

Offline (half A) shows the cached SW shell + a clear "offline" banner, never a
blank screen and never stale money figures presented as current (the balance
plate shows a "last synced" timestamp).

---

## 6. UX / UI

All UI is in the **yard data-plate** language: dark steel panels
(`linear-gradient(180deg,#1b2129,#0c0e11)`), **one** safety-orange accent
(`--accent #ff7a1a`) for ignition/primary, hi-vis **hazard stripe** signature,
**Saira Condensed** stamped uppercase labels, corner **rivets**, and a light
leather-tan ranch seasoning mostly in copy. Every new interactive element needs a
`data-r` stamp (R0–R24) + `rule-usage.js` regen; every new popup needs a
`WINDOW_CATALOG` entry.

### 6.1 Half A — internal reflow (mostly shipped; gaps to fill)

These are **canon, documented here so Jac can critique the live behavior**:

- **Single column on phone**; swipe the **footer dock** to change column
  (Yard ↔ Rentals ↔ Customers), swipe the **grid** for card Back/Forward, with a
  `haptic(8)` tick on each.
- **Per-column bottom dock** = the relocated search/sort row + a segmented
  card-toggle bar (selected toggle goes **ignition orange** `--accent` with dark
  `--on-orange` ink) + dot nav. Saira labels on toggles.
- **Overlays → bottom sheets**: full-width, rounded top, slide up
  (`@keyframes sheetUp`), backdrop-tap + Android-back close, `92dvh` cap,
  safe-area padding, reduced-motion disables the animation.
- **Zip-zones** on a live phone drag: steel tabs on the screen edge bearing the
  target card's icon + Saira label and a thin **per-card hazard stripe** (the
  documented, scoped exception to "one orange"), `.hot` arm + `haptic(8)`.

**New for half A (these need stamps/critique):**

| New surface | Design | R-stamp / catalog |
|---|---|---|
| **Offline banner** | a thin hazard-stripe (yellow) bar pinned under the header: "Working offline — last synced 9:14 AM." Steel, stamped Saira. | reuse the existing toast/banner stamp if one exists; else stamp + regen `rule-usage.js`. **Not a popup** → no `WINDOW_CATALOG`. |
| **Install / Add-to-Home-Screen nudge** | a one-time dismissible **bottom sheet** (steel, rivets, orange "Saddle up — add to home screen" primary). Honors `beforeinstallprompt` on Android; iOS shows a stamped illustration of the Share→Add flow. | **New popup → `WINDOW_CATALOG` entry required** + `check-window-catalog` update; `data-r` on its buttons. |

### 6.2 Half B — customer self-service portal (greenfield)

A **separate, minimal bundle** (its own `portal.html` + small JS), NOT the
internal `app.js`, so the internal console and its secret never ship to a
customer. Same design tokens (a shared trimmed `style.css` subset) so it reads as
**one shop** — steel, orange, Saira, rivets, a friendlier ranch voice.

**Screens (all mobile-first bottom-sheet-friendly):**

1. **Landing / Auth** — JacRentals steel wordmark, hazard-stripe header, one
   field ("Enter the code we texted you" / or arrive via magic link), an ignition
   **"Wrangle my account"** primary. Empty/error: "That code's expired — ask the
   office to re-send." No customer list, no hint of other accounts.
2. **My Yard (dashboard)** — stamped header `WELCOME, <company>`; cards:
   - **Active Rentals** — per rental: unit name/category, dates, a **ready/status
     pill** (reuse the flag-color R/Y/G semantics but **only the safe statuses**),
     delivery address (their own). Tan saddle-stitch divider between rows.
   - **Invoices & Balance** — open invoices, amounts, due dates, a big stamped
     **balance** plate. Pay button only if Phase 3 + gate ON.
   - **Contact / Help** — their info + a "Text the office" deep-link.
3. **(Phase 3, gated) Pay** — Stripe Elements sheet; never shows internal margin.

**States:** empty ("No active rentals — call to round one up"), loading (steel
skeleton plates, no spinner-slop), error (fail-closed locked card), offline (the
portal is online-only in v1 — show a clean retry).

**R-rulebook:** the portal is a separate bundle, so it has its **own** stamp
discipline — **Open Q 11.7**: does the portal reuse R0–R24 + `rule-usage.js`, or
get a parallel mini-rulebook? Any portal popup that lands inside the **internal**
app (e.g. the office's "Send portal link" dialog) **does** need a
`WINDOW_CATALOG` entry + `data-r` stamps.

**Internal-side popup (office sends the link):** a small steel sheet from the
Customer card — "Send self-service link" with channel (email/SMS) + a ranch
primary "**Brand & send**." This is **inside app.js** → **new `WINDOW_CATALOG`
entry + `data-r` stamps + `check-window-catalog` + `gen-rule-usage` regen.**

### 6.3 Mobile reflow rules for any NEW UI

Anything added here runs through the **`jactec-ui`** skill (mobile sub-capability):
phone reflow of the 3-column grid, bottom sheets, `dvh`/safe-area sizing, the
tap/long-press/drag/swipe disambiguation, and `haptic()` only on **committed**
actions. Quality floor: responsive, visible focus, reduced-motion respected.

---

## 7. Business Rules / Derivations / Money

### 7.1 Half A — gesture disambiguation (the load-bearing rule, canon)

One touch resolves to exactly one of: **scroll · column-swipe · card-swipe ·
item-drag · element-action · context-menu**:

- Vertical-first → native scroll.
- Footer horizontal swipe (≥55px, and `|dx| ≥ |dy|·1.3`) → change column.
- Grid horizontal swipe → card Back/Forward.
- Horizontal on a draggable element (long-press then move) → drag (zip-zones).
- Hold-still ≥~500ms → context menu. Quick tap → element action.
- A fired swipe swallows the trailing click (`swipeFired`); a real drag is not a
  swipe (`DRAG.active`/`DRAG.suppressClick` guards, app.js:16135).

### 7.2 Portal status derivation (half B)

The customer-facing **ready/status pill** must be derived from a **safe subset**
of the internal flag system — never expose internal flags like "failed
inspection," "field call," cost/margin, or another customer's state. Draft
mapping:

| Internal state | Customer-safe label | Pill |
|---|---|---|
| Reserved, dates upcoming | "Reserved — <date>" | yellow |
| On Rent | "On Rent — due back <date>" | green |
| Returned | "Returned" | gray |
| Quote | "Quote — pending" | yellow |
| Any internal red flag (failed insp, WO block, off-rent dispute) | **"In progress — we'll update you"** (no detail) | yellow |

The server projects the pill; the portal never receives the raw flags.

### 7.3 Money / safe-field projection (half B, server-side allowlist)

Portal `customerPortalLoad` returns ONLY:

```
rentals:  rentalId, rentalName, unit/category display name, startDate, endDate,
          startTime, status→safeLabel, deliveryAddress (their own), invoiceId
invoices: invoiceId, date, dueDate, amountDueCents, amountPaidCents, po
balance:  sum of amountDue − amountPaid across THIS customer's open invoices
```

**Never** returned: `bottomDollar`/margin/cost, unit hours, internal notes, WO
line items, vendor names, `_digest`, other customers' anything, Stripe customer
secrets. Money math (balance) is computed **server-side** so no internal pricing
formula crosses the boundary.

---

## 8. Phasing & Milestones

### Phase A — Internal mobile (mostly done; finish it)

- **A0 — Document canon (this spec).** No code; ratify M0–M3 + zip-zones +
  haptics as shipped behavior.
- **A1 — Install affordance.** `beforeinstallprompt` capture + the
  Add-to-Home-Screen bottom sheet (Android) and the iOS Share→Add illustration.
  *In scope.*
- **A2 — Offline shell (service worker).** Register a SW that caches the static
  SPA shell (`index.html`, `app.js`, `style.css`, `config.js`, `data.js`, fonts,
  icons) for an instant + dead-zone-tolerant load; an **offline banner**; a
  cache-version keyed to the `?v=` deploy token so a release still busts cleanly.
  **Read-through to the live backend stays online-only in v1** (no offline
  writes). *In scope, high-value.*
- **A3 — Tablet (2-col) polish + Rentals/dispatch phone pass.** *Out of v1*
  unless Jac pulls it in.
- **A4 — Push notifications.** *Out of v1* (needs SW + push backend).

### Phase B — Customer self-service portal (greenfield, gated on deps)

- **B1 — Spec & gate sign-off.** Resolve §11 auth/isolation questions with Jac.
  **Nothing ships until the gate model is approved.**
- **B2 — Backend actions** (`customerPortal*`) + `portalGrants` tab, server-side
  isolation + safe-field projection. Additive, clasp-deployed.
- **B3 — Portal bundle** (`portal.html` + thin JS) — Auth + My Yard (read-only:
  rentals, invoices, balance, status). Office-side "Send link" dialog in app.js.
- **B4 — (optional) Pay-my-invoice** via Stripe PaymentIntent, **only** behind a
  money gate decision.

**In scope for v1 (this spec's recommendation):** A0, A1, A2; B1 (the spec/gate
work). **Out of v1:** A3, A4, B2–B4 build (blocked on auth decision + comms
backend), portal payments.

---

## 9. Acceptance Criteria

### Half A

1. At 390×844 (`isMobile, hasTouch`) there is **zero horizontal scroll** on every
   column and every bottom-sheet.
2. Footer swipe changes column; grid swipe does card Back/Forward; each fires one
   `haptic` tick; a swipe never also triggers the row/toggle click.
3. Overlays render as bottom sheets; backdrop-tap and Android-back close the top
   sheet only; reduced-motion disables `sheetUp`.
4. Touch targets ≥44px on all `.is-phone` interactive controls; iOS field-focus
   never zooms.
5. **A1:** the install sheet appears once, is dismissible, never re-nags, and is
   stamped + catalogued (`check-window-catalog` passes).
6. **A2:** with the network killed after first load, the app shell loads from
   cache and shows the offline banner; a new deploy (`?v=` bump) still serves new
   bytes (cache version follows the token).

### Half B

7. **Customer isolation (server-side).** A portal session for customer X returns
   **only** X's rentals/invoices/balance. A logic-test asserts: given a grant for
   X and a request that *names* customer Y (tampered `customerId`/`invoiceId`),
   the response contains zero Y rows and `{ok:false, error:'not-yours'}` for a Y
   invoice pay-intent. A stale/revoked/expired token returns `{ok:false}` + the
   locked state. The front-end filter is **never** the only line of defense.
8. **Safe-field projection.** `customerPortalLoad`'s response object, asserted by a
   logic-test against the allowlist (§7.3), contains **none** of:
   `bottomDollar`, `cost`, margin, unit hours, `_digest`, internal notes, WO line
   items, vendor names, or any other customer's id — even if those fields exist on
   the source rows. Adding a field to the projection requires updating this test.
9. **No secret in the portal bundle.** The built portal asset contains **no**
   `backendPassword`, no internal-tier credential, no `DEFAULT_CONFIG` value, and
   no margin/cost field — enforced by a CI grep over the built file (fail = block).
10. The office "Send portal link" dialog is `data-r`-stamped, appears in
    `WINDOW_CATALOG`, and passes `check-window-catalog` + `gen-rule-usage --check`.

### CI-gate impact

| Gate | Impact |
|---|---|
| `ci/smoke.mjs` | Add phone-context (390×844) smoke: no-overflow, swipe, sheet. |
| `ci/logic-test.mjs` | Add gesture-disambiguation + (B) safe-field-projection / isolation unit tests. |
| `ci/gen-rule-usage.mjs --check` | Regen after any new stamped element (install sheet, send-link dialog). |
| `ci/check-window-catalog.mjs` | New popups (install sheet, send-link dialog) MUST be catalogued or CI fails. |
| `tools/gen-code-map.mjs --check` | If a new chapter banner is added (e.g. a `§Portal` chapter), regen the Code Atlas. |

---

## 10. Risks & Edge Cases

- **Customer-isolation leak (highest).** Any portal action that trusts a
  front-end `customerId` is a live PII/data breach. Mitigation: server-side
  filtering + allowlist projection + fail-closed; the gate is an Open Question
  for Jac, never silently loosened.
- **Secret in a public bundle.** The portal MUST be a separate bundle; if it ever
  imported `app.js` it could ship `backendPassword` to customers. Mitigation:
  separate `portalCall`, no shared module that holds the secret, CI grep.
- **Service-worker staleness.** A SW that out-caches the `?v=` token would pin a
  stale app no refresh fixes (the staging-mirror lesson). Mitigation: cache
  version = the deploy token; `skipWaiting`/`clients.claim` on activate; never
  cache the backend POST.
- **Gesture ambiguity** (the one hard problem flagged in the 2026-06-14 design):
  scroll vs swipe vs drag vs menu. Already tuned (thresholds in app.js:16135);
  any change re-tests on a real touch device.
- **iOS has no Vibration API** — `haptic()` is a silent no-op; don't design any
  feedback that *depends* on a buzz.
- **dvh / safe-area** on notched phones + the home indicator — sheets and docks
  must keep CTAs above the indicator (already handled via `env(safe-area-inset-*)`
  + `dvh`); re-verify on new sheets.
- **Offline writes** are explicitly out of v1 — a queued-write sync engine is a
  big, separate effort; v1 SW is read-shell-only to avoid conflict/merge hazards
  with the existing diff-sync.
- **Comms dependency blocks B entirely** — magic links/OTP need the
  `comms-notifications` send path; without it the portal can't authenticate.
- **Multi-user / live refresh** already exists internally (poll + adopt clean
  remote rows, never delete on refresh, app.js:15713 `refreshFromBackend`); the
  portal must NOT join the internal poller (it has no internal session) — it reads
  its own one-shot snapshot via `customerPortalLoad` and re-fetches on user pull.
  A field hand and the office editing the **same** record on phones at once is the
  existing diff-sync's job, not new mobile code; the reflow layer adds no write
  path, so it can't introduce a new merge hazard.
- **Portal auth abuse (security).** Public issuance/exchange endpoints invite
  OTP-guessing and SMS/email spam; unmitigated they enable contact-enumeration or
  toll-fraud (paid SMS). Mitigation: rate-limit + attempt-cap + uniform
  `{ok:true}` on request (§11.13). Treat as a launch blocker for half B.
- **Token theft / link forwarding.** A magic link is a bearer credential — if
  forwarded or intercepted it grants that customer's read view. Mitigation: short
  expiry, single-use exchange, hashed-at-rest token, revocable grant, 24h session
  cap (§11.1/11.2). No money action is reachable on a stolen *read* session unless
  Phase 3 is on AND the money gate is approved.
- **Performance — separate bundle weight.** The portal must stay tiny (it loads
  on a customer's possibly-slow phone). It does NOT import `app.js` (15.7k lines)
  or the Maps/Stripe SDKs unless Phase 3; the shared `style.css` subset is trimmed.
  Soft dependency on `frontend-performance`.

---

## 11. Open Questions

> **Resolved 2026-06-29:** 11.1 (auth model) → **D2**: magic link **only**, no OTP. 11.4/11.5/11.7/11.11/11.12/11.13 (pay-from-portal, who-can-issue, portal rulebook discipline, hosting/route, customer voice, brute-force hardening) → **moved to `customer-portal`** per **D1** — mobile-remote no longer owns the portal's security/feature model, only its mobile shell; resolve those in `customer-portal`. 11.6/11.14 (offline depth & money freshness) → **D3**: shell-cache only, online-only backend, "last synced" stamp on cached money. 11.8 (install nudge — once after 2nd session, dismissible) and 11.15 (`mobileCol` integer-normalize in A1) → **adopt the conservative draft as-is**. 11.9/11.10 (push, tablet polish) stay parked / deferred per draft.

*(No seed questions were supplied for this area; every question below was surfaced
from reading the live code + the security gates. Each carries a draft answer Jac
can accept or override — the draft is conservative wherever a gate is involved.)*

**11.1 — Portal auth model.** Magic link (emailed/texted URL) vs short OTP code
vs both? Trade-off: magic link = one tap, but link-forwarding risk; OTP = phone
re-entry friction but harder to forward. **Draft: magic link with a short
expiry + single-use, OTP fallback.** Which does Jac want?

**11.2 — Token lifetime & session.** How long is a portal session valid (1 hour?
24 hours? 30 days "remember me")? Single-use exchange token → short session
token, or long-lived bearer? Trade-off: convenience vs blast radius if a phone is
lost. **Draft: 15-min single-use link/OTP → 24-hour session, revocable.**

**11.3 — Where do grants live?** Separate `portalGrants` tab (this draft) vs
fields on the `customers` row vs a backend-only store. Trade-off: isolation/
defense-in-depth vs one fewer tab. **Draft: separate tab, hashed token.**

**11.4 — Can a customer PAY from the portal in v1?** This is a **money gate**.
Pro: real call-deflection + faster collection. Con: Stripe surface area, refund/
dispute flows, and it touches the pricing boundary. **Draft: NO for v1 (read-only
portal); revisit as B4.** Does Jac want pay-from-portal sooner?

**11.5 — Who can issue a portal link?** Office/Sales (tier ≥ money) only, or any
staff? It exposes a customer's data to that customer, so it's a controlled
action. **Draft: tier ≥ money (Office/Sales/Manager/Admin).**

**11.6 — Offline depth for half A.** SW shell-cache only (read-blank-tolerant) vs
a full offline-write queue that syncs on reconnect? The latter is a large effort
and risks conflicts with the diff-sync engine. **Draft: shell-cache only in v1.**

**11.7 — Portal rulebook discipline.** Does the separate portal bundle reuse
R0–R24 + `rule-usage.js` + the CI guards, or get a parallel mini-rulebook (its
surface is tiny)? Trade-off: one enforcement system vs not bloating the internal
rulebook with customer-only elements. **Draft: tiny parallel set, OR reuse with a
`portal/` scope — Jac picks.**

**11.8 — Install nudge aggressiveness.** Show the Add-to-Home-Screen sheet once
per device automatically, only after N visits, or only from a Tools menu entry?
Trade-off: discoverability vs nag. **Draft: once, after the 2nd authenticated
session, dismissible forever.**

**11.9 — Push notifications priority.** Worth building Web Push (needs SW + a push
backend) for field hands ("WO assigned," "inspection due") and/or customers
("your machine is ready")? It's a multi-area effort. **Draft: out of v1, parked
behind comms-notifications.**

**11.10 — Tablet treatment.** Is the 2-col tablet "un-broken but unpolished" state
acceptable indefinitely, or does Office want a first-class tablet dispatch view
(it's the natural counter device)? **Draft: defer (A3) unless Jac prioritizes.**

**11.11 — Portal hosting/route.** Same Pages site under `/portal` (one origin,
simplest) vs a separate subdomain (`my.jacrentals.com`, cleaner isolation, own
deploy)? Trade-off: deploy simplicity vs origin/cookie isolation from the
internal app. **Draft: separate path/bundle now, subdomain later if needed.**

**11.12 — Customer-facing voice.** How heavy is the ranch seasoning for
customers vs internal? "Wrangle my account," "round up a rental" — charming or
too cute for a B2B equipment renter? **Draft: lighter than internal — keep one
or two ranch touches, stay professional.**

**11.13 — Brute-force / abuse hardening on portal auth.** Magic-link/OTP issuance
and exchange are public-facing — they need server-side rate-limiting (per
destination + per IP), an OTP attempt cap (lock after N bad codes), and an
issuance throttle so the portal can't be used to spam a customer's phone/email
(or to enumerate which contacts exist — hence `customerPortalRequest` returns
`{ok:true}` unconditionally). Trade-off: friction/lockout vs abuse surface. GAS
has no native rate-limiter, so this is a counter in the `portalGrants` tab or a
script-property store. **Draft: cap OTP at 5 attempts/15 min, throttle issuance to
3/hour per destination — confirm thresholds with Jac.** Unanswered: where the
counter lives without bloating the Sheet.

**11.14 — Money-figure freshness offline.** The SW shell-cache (A2) is read-only,
but if a customer/field hand sees a **cached balance or invoice total** while
offline, that's a stale money figure. Show it with a "last synced HH:MM" stamp
(draft), hide money fields entirely when offline, or block the money cards behind
a "reconnect to view" gate? Trade-off: usefulness vs the risk of someone acting
on a stale balance. **Draft: show with a prominent "last synced" stamp; never
present a cached figure as live.**

**11.15 — `state.mobileCol` type inconsistency (pre-existing, flag for the
maintainer).** `mobileCol` initializes to the integer `0` (app.js:1920) and the
dock indexes `COLUMNS[Math.max(0, Math.min(2, state.mobileCol))]` (app.js:7500),
but a demo-reset path assigns the **string** `'units'` (app.js:2142). A string
clamps to `COLUMNS[NaN→0]` so it happens to work, but it's a latent type bug any
new phone-column code could trip on. Should this spec's A-phase work normalize
`mobileCol` to always be an integer index (with a `COLUMN_OF`/name→index helper
at the reset site)? **Draft: yes — normalize to an integer in A1, it's a cheap
de-risk; surface to Jac since it touches shipped canon.**

---

## 12. Dependencies & Sequencing

| Depends on (roadmap slug) | Why | Blocking? |
|---|---|---|
| `comms-notifications` | SMS/email send for magic links/OTP **and** the external-chat strip + any push | **Hard blocker for half B**; also lights up the half-A external-chat shell |
| `customers-crm` | customer entity + `customerId` isolation key the portal scopes to | Yes (portal reads it) |
| `invoicing-payments` | invoices/balance the portal reads; Stripe path for B4 | Yes (portal reads it; B4 needs Stripe) |
| `rentals-dispatch` | rentals + safe status the portal surfaces | Yes (portal reads it) |
| `backend-data` | the `backendCall` entry, schema-less Sheets, diff-sync the new actions/tab live alongside | Yes (new additive actions/tab) |
| `design-system` | R0–R24 stamps, tokens, CI guards the new UI must satisfy | Yes (every new element) |
| `frontend-performance` | the SW/offline shell + bundle size for the portal | Soft (A2 quality) |

**Sequencing:**

1. **Now:** ratify half-A canon (A0); build A1 (install) + A2 (offline shell) —
   these have **no external dependency**.
2. **Gate first:** B1 — get Jac's §11 auth/isolation/money decisions **before any
   portal code.**
3. **When `comms-notifications` lands:** B2 (backend actions + `portalGrants`),
   then B3 (portal bundle + office send-link dialog).
4. **Optional, behind a money gate:** B4 (pay-from-portal via Stripe).

Nothing in half B ships until (a) the auth/isolation gate is approved and (b) the
comms send path exists. Half A (A1/A2) can proceed immediately.
