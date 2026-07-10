# Frontend Performance — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/frontend-performance`
**Task branch:** `frontend-performance/spec` (proposed)
**Maturity:** partial
**Scope:** The techniques and guardrails that keep the single-file SPA fast — render-budget enforcement, list windowing, image downscaling, debounced/diffed saves, the rAF drag loop, Drive-upload throttling, IndexedDB, cache-busting — plus the three missing legs (service worker / offline shell, code splitting, and Web Vitals instrumentation).

## ✅ Decisions — 2026-06-29 critique (Jac)

- **D1 — Stay buildless for v1; split via native `import()` only (Q1).** No bundler (Vite/esbuild) yet — keep the simple paste-and-`?v=` deploy ritual. Code-split the heaviest non-first-paint flows (Google-Maps transport editor + dispatch map, Stripe payments, Mr. Wrangler authoring) using the browser's native dynamic `import()`, riding the service-worker cache rather than the manual token. **Revisit a bundler only if Phase-0 vitals prove the first chunk is the bottleneck.** *(Adopted the recommended default after walking Jac through the terms; the popup tool was erroring at decision time — Jac was leaning this way and can flip to a bundler later without rework, since native splitting is forward-compatible.)*
- **D2 — Telemetry goes to the backend sink (Q2, Jac 2026-06-29).** Ship the additive **`perfReport`** GAS action into a dedicated **`_perf` Sheet tab** (password-gated, outside `PERSIST_KEYS`, fire-and-forget, sampled at `PERF_SAMPLE_RATE`) so Jac sees speed numbers across **all devices** in one place, not just per-device. Payload stays **metrics-only** (LCP/INP/CLS + render p50/p95/over-budget + build token + coarse device class + role *id* — never PII, dollars, or the password). A local dev-console getter + `localStorage` ring buffer still exist for live on-device debugging; the backend sink is the cross-device record. *(Supersedes the earlier client-only default.)*
- **D2b — Progressive ("first screen, then prefetch in order") loading is the target, build-step still open (Jac 2026-06-29).** Regardless of whether a bundler lands, the loading model is: **paint the first screen immediately** (login/auth → the visible column), then **prefetch the rest during idle in a defined priority order**. Jac's priority list: **Categories → Driver Schedule → Invoices → Logo-Menu (header/menu) stuff.** This is achievable buildless (native `import()` + idle prefetch) *or* with a bundler (cleaner automatic chunking + hashed caching); the bundler choice (D1) is a tooling decision, **not** a prerequisite for progressive load. **Open: Jac's final bundler call** — buildless idle-prefetch vs adopt a bundler for tidier chunks.
- **D3 — Offline writes OUT of scope for v1 (Q10).** The v1 service worker caches the app **shell only** (instant/offline open); offline edits still queue in memory and surface via the existing R25 "held, retrying" plate (lost on reload, as today). Persisting pending writes to IndexedDB is a real data-integrity design (must compose with diff-sync without resurrecting a stale edit over a newer remote row) — flagged a **strong Phase-3 candidate**, not built now.
- **D4 — Adopt the conservative draft leans for the remaining forks:** SW update = **prompt-to-reload toast**, never auto-yank a mid-edit page (Q5); **suppress the update toast while offline/R25 active** (Q12); SW registered **production-origin only**, not staging (Q4); SW as a **classic script**, not an ES module, for max device compatibility (Q11); **vendor a pinned `web-vitals` micro-lib** the way Lucide icons are vendored, no runtime CDN (Q8); **keep per-call image downscale** — evidence legibility is a hard floor (Q7); render budget stays **measure/report, never auto-drop a computed value** (Q6); report **both** `render()` time and true INP (Q9); first chunk stays **one shared, flow-split (not role-variant)** for v1 (Q13).

> **Note:** D1/D2 were taken as the recommended defaults during an AskUserQuestion outage. If Jac wants a bundler (D1→bundler) or a backend telemetry sink (D2→Sheet/external), both are clean swaps — flag for a quick confirm at next opportunity.

---

## 1. Goal & Problem

### 1.1 What this area is for

Rental Wrangler is **one `app.js` (~15.7k lines)** plus six ES-module siblings and one `style.css`, rendered into `#app` by a **single synchronous `render()`** that tears down and rebuilds the whole grid on every state mutation (`app.js:11618`). That architecture is dead simple to reason about (one state object → render → mutate → re-render) but it puts *all* interaction latency on one critical path. This area owns the discipline that keeps that path under budget on the real devices the yard uses: phones in trucks on LTE, an office desktop, a shop tablet.

There is **no framework** doing this work for us — no React reconciler, no virtual DOM diff, no Suspense, no route-level code splitting. Every performance primitive is hand-rolled and must be *kept* hand-rolled-correct as features pile onto `render()`. This spec's job is to (a) **document the shipped primitives as canon** so nobody removes a load-bearing throttle by accident, and (b) **spec the three missing legs** the roadmap calls out: service worker, code splitting, Web Vitals instrumentation.

### 1.2 The business/user problem

- **Field reality:** the people who most need the app (drivers, M.Techs, mechanics) are on phones with flaky LTE in the yard or on the road. A 700 KB+ `app.js` re-downloaded on every cold start, no offline shell, and a full-grid re-render on every tap is a tax paid in seconds-per-action across a workday.
- **Growth reality:** the diff-based sync note in code says the *whole-state* seed was "≈1.7 MB / 10 s at real volume" (`app.js:15683`). The list windowing cap (`VIRT_CAP = 60`, `app.js:6535`) and the render budget exist precisely because record counts grow. As JacRentals adds units, customers, and a multi-year invoice history, the un-windowed, un-instrumented paths are where the app will first feel slow — and we have **no telemetry today** to know *which* path, on *whose* device.
- **No measurement = no defensible decisions.** The only perf signal that exists is a `console.warn` over 100 ms (`app.js:11698`) that nobody sees in production. We can't currently answer "is the app fast on Jac's phone?" with anything but vibes.

### 1.3 North star

> **Every interaction lands under 100 ms on a mid-tier phone; a cold start over LTE shows the login plate in under 2 s; a returning user opens to a usable shell with zero network; and we have the numbers to prove it.**

Concretely: keep the existing **100 ms interaction budget** real (not just warned), add an **offline-first shell** so the app opens instantly for returning users, and add **lightweight Web Vitals instrumentation** so regressions are caught by data, not by Jac noticing lag.

---

## 2. Current State (Baseline)

This documents the **live system as canon**. Anchors are `file:line` against the current tree.

### 2.1 Shipped primitives (in active use)

| # | Primitive | What it does | Anchor | Tunable |
|---|---|---|---|---|
| P1 | **Render budget warn** | After each `render()`, if wall-time > `PERF_BUDGET_MS` (100), `console.warn('[perf] render N took …ms')` | `config.js:558`, `app.js:11696–11698` | `CFG.PERF_BUDGET_MS = 100` |
| P2 | **List windowing** | Lists paint at most `cs.listLimit \|\| VIRT_CAP` (60) rows on first paint; a real **"Show more"** button reveals `SHOW_MORE_BATCH` (200) more per click — every match stays reachable | `app.js:6535–6551` | `VIRT_CAP = 60`, `SHOW_MORE_BATCH = 200` |
| P3 | **Single-rAF drag loop** | One `requestAnimationFrame` loop per drag does **one** `elementFromPoint` per frame to feed both hot-target highlight and edge auto-scroll; `pointermove` never hit-tests | `app.js:12080–12100` | — |
| P4 | **`saveSoon` debounce** | Coalesces rapid edits into one backend write after a 1200 ms idle gap; suppressed while `booting` or unauthenticated | `app.js:15851` | default `1200` ms |
| P5 | **Diff-based sync** | `computeChanges()` sends only upserts/deletes vs the last-saved snapshot — a one-field edit is a sub-second few-hundred-byte call, not a 1.7 MB whole-state seed | `app.js:15682–15704`, `flushSave` `15919` | — |
| P6 | **Client-side image downscale** | `downscaleImage(dataUrl, maxDim, quality, cb)` canvas-rescales every captured image to a JPEG before it's stored/synced; per-call dims range 340 px (selfies) → 1400 px (file uploads) | `app.js:14027–14038` | per-call `maxDim`/`quality` |
| P7 | **Drive-upload throttle (≤3 concurrent)** | The base64→Drive sweep runs exactly **three** worker coroutines over a shared cursor so one session doesn't hammer Drive; idempotent + resumable | `app.js:13383–13400` | hardcoded 3 workers |
| P8 | **Sync photo offload** | Before each sync, base64 photos on dirty records are uploaded to Drive (`offloadDirtyPhotos`) so a ≤50 KB cell never has to carry a ~2 MB image; oversized records are held out of the batch (fault isolation) | `app.js:15869–15887`, `holdOversized` | — |
| P9 | **IndexedDB rail** | `wrStore` persists Mr. Wrangler chat blobs/chats in IndexedDB (`WR_DB`), with an eviction budget sweep, so large chat images live off the synced JSON | `app.js:7707–7890` | `WR_LOCAL_BUDGET` |
| P10 | **Manual `?v=` cache-bust** | One shared token on `style.css`, `rule-usage.js`, `app.js` in `index.html`; bumped every deploy because Pages serves `max-age=600` with no per-file hashing | `index.html:21,40,41` | token string |
| P11 | **Refresh-poll guards** | The 18 s multi-user refresh poll (`refreshFromBackend`) **skips** when already `refreshing`/`booting`, unauthenticated, mid-`saving`, with a `savePending` dirty flush, before first `lastSaved`, or when `document.hidden`, `DRAG.active/armed`, an overlay/`winEdit` is open, a `hoverNode` preview is up, or the focused element is an `INPUT`/`TEXTAREA`/contentEditable — so background sync never steals a frame from active work or clobbers an unsaved edit. **The same guard set is the model for when the §6.1 update-toast may appear** | `app.js:15713–15753` | `18000` ms |
| P12 | **Scroll-memo + single DOM swap** | `render()` snapshots each card's scroll, builds the new grid **off-screen**, swaps in ONE `replaceChildren` (no blank frame), then restores scroll per view | `app.js:11616–11669` | — |
| P13 | **Render-time `ctx` reuse** | The flag-color engine assembles `unitMap`/`customerMap`/etc. **once per render** and passes it into every evaluation rather than re-deriving per row | flag-color-system.md §4.2; `app.js:3700` | — |

### 2.2 PWA surface that exists (but is incomplete)

- `index.html:12` links `manifest.webmanifest`; the manifest declares `display: standalone`, scope `./`, theme color, and 192/512 icons (incl. maskable). **The app is installable** ("Add to Home Screen") today.
- **But there is NO service worker.** Grep confirms zero `navigator.serviceWorker` / `sw.js` / `workbox` references in `app.js`, `index.html`, or `config.js`. So an installed PWA is a *thin wrapper around the network*: every cold start re-fetches `app.js`/`style.css`/`rule-usage.js` over the wire, and **offline = blank**.

### 2.3 Missing (per roadmap "Today")

| Leg | State | Why it matters |
|---|---|---|
| **Service worker / offline shell** | ❌ absent | Returning users re-download the whole app on every cold start; offline shows nothing. The biggest cold-start win available. |
| **Code splitting** | ❌ absent | `app.js` is one ~15.7k-line module loaded up-front. The login plate, Stripe-heavy payment flows, the Google-Maps transport editor, the dispatch map, and Mr. Wrangler all load before first paint even for a driver who'll never touch them. |
| **Web Vitals instrumentation** | ❌ absent | The 100 ms budget only `console.warn`s locally. We have no LCP/INP/CLS, no render-time histogram, no field data. We're flying blind on whether the app is fast in the field. |

### 2.4 Adjacent code this area must build on

- **Boot sequence** (`app.js:16014` neighborhood): `startRefreshPoll()` and friends fire after auth. A perf-vitals reporter and SW registration slot in here.
- **`backendCall(action, extra)`** (`app.js:15650`): the single GAS entry point. Any backend-side perf telemetry sink is a new **additive action** on this.
- **`render()`** (`app.js:11618`): the one place to hook a render-time histogram.
- **`index.html`** (`index.html`): where SW registration and any module-split `<script>`/preload tags land.

---

## 3. Users, Roles & Data Gates

Performance work is **infrastructure** — it is largely invisible to roles and must stay so. The 5 built-in operational roles (`ROLES`, `config.js:302`: mechanic, M.Tech, driver, office, sales — and any admin-defined custom roles) each carry one **tier** on the `ROLE_TIERS` ladder (`config.js:326`: `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`; gates compare *tiers*, never role names — role-system redesign 2026-06-26). All roles benefit equally from perf work; **none should *see* a behavioral difference** from caching, splitting, or instrumentation. The point of this area is speed that is felt, not seen.

**Money-action gating is out of scope to change but must be preserved.** Money actions (charge/refund/lock, margin-floor visibility) gate on the **money tier and up** (`rank ≥ 2`, with Office/Admin doing the actual money work). This area must not move a money action behind a lazily-loaded chunk in a way that lets the chunk *load* stand in for the *tier check* — see §3.1. The gate still runs at the action, regardless of when the code arrived.

### 3.1 Role/visibility rules

| Concern | Rule |
|---|---|
| Offline shell content | The cached shell is **app code + chrome only** — `app.js`, `style.css`, `rule-usage.js`, fonts, icons. It must **never** cache role-gated *data* responses (the `load`/`sync` payloads carry pricing, margin, PII). See §3.2. |
| Perf overlay / vitals readout (if surfaced) | Any in-app vitals/diagnostics panel is **developer-tier only** (`rank ≥ 5`), alongside Design Lint / Inspector / Rulebook. It is a dev tool, not an operator surface. |
| Code-split chunks | A lazily-loaded chunk must **re-assert the same gate** its eager code did. Splitting must not become an auth bypass — e.g. the payments chunk loading does not grant payment rights; the existing tier check still runs at the action. |

### 3.2 Customer-isolation, PII, and pricing-floor gating — the hard line

This is the one place a perf feature can leak data, so it is specced conservatively:

- **The service worker MUST NOT cache, read, or store any authenticated data response — and the exclusion is matched by a default-deny, not an allowlist of "things to skip."** The SW caches **only** an explicit, hardcoded allowlist of **static, public app assets** (the same files already public via Pages: `index.html`, `app.js`, `style.css`, `rule-usage.js`, the vendored fonts, icons, manifest). Anything not on that allowlist is **passed straight to the network and never written to a cache** — there is no "cache by default, exclude data" path. Concretely the fetch handler:
  - **Allowlists by same-origin GET + known asset path** (the Pages-served files above). Only these are ever `cache.put()`.
  - **Hard-rejects (network-only, no `cache.put`) any of:** (a) a request whose method is **not GET** — `backendCall` is always a `POST` (`app.js:15653`), so every data write is excluded by method alone; (b) a request to the **`BACKEND_URL` origin** (`script.google.com` / `*.googleusercontent.com`, `app.js:15637`); (c) any request with `Content-Type: text/plain` (the `backendCall` content-type chosen to dodge CORS preflight, `app.js:15651`); (d) Stripe / Google-Maps third-party origins.
  - These are **belt-and-suspenders**: a `backendCall` is excluded three independent ways (POST, backend origin, text/plain) so a refactor that changes one can't silently start caching PII. The `load`/`sync` payloads carry `password`, customer PII, `bottomDollar`/margin, and card metadata — none of it may ever touch the Cache Storage API, IndexedDB-via-SW, or the navigation-fallback path.
  - **Navigation fallback is shell-only.** The offline navigation fallback serves the cached **`index.html` shell** — never a cached *data* document (there are none cached). The data layer then surfaces its own offline state (R25). The SW never fabricates or replays a data response.
- **No PII in telemetry.** Web Vitals / render-time samples carry **metrics only** (timings, route/view name, coarse device class, build token, and the ROLE *id* for operational segmentation) — **never** record IDs, customer names, addresses, phone/email, dollar amounts, `bottomDollar`/margin, card metadata, or the `password`. The `role` field is the role **identifier** (`'driver'`, `'admin'`), explicitly **not** the role password. This is a public-via-Pages repo and a shared backend; a leak here is a live-PII incident. The payload is audited against an allowlist of exactly the §4.3 fields (acceptance test §9.3).
- **Pricing-floor visibility is unaffected** — perf work touches *when* and *how fast* code/assets load, never *what* a role is allowed to compute or see. The `bottomDollar`/margin-floor gates in the money engine are untouched by this area, and telemetry must never carry a dollar figure that could reconstruct them.
- **Code-split chunks carry no relaxation of gates** (§3.1): a lazily-imported flow re-runs the same `ROLE_TIERS` tier check at the action that its eager code did. Loading the chunk is not authorization.

> **Open Question (see §11):** should there be *any* in-app vitals readout at all, or do we ship telemetry purely to a backend sink and a dev-console? Surfacing it is a new dev surface + gate; not surfacing keeps the attack surface minimal.

---

## 4. Data Model

Performance is mostly behavioral, so the data-model footprint is small and **additive**. No existing record shape changes.

### 4.1 New client-side constants (config.js)

```js
// config.js — perf tunables, co-located with PERF_BUDGET_MS (config.js:558)
export const PERF_BUDGET_MS    = 100;     // (existing)
export const PERF_SAMPLE_RATE  = 0.1;     // fraction of renders/sessions sampled for vitals (proposed)
export const PERF_VITALS_ON    = true;    // master kill-switch for instrumentation (proposed)
export const SW_CACHE_VERSION  = '20260628a'; // bumped in lockstep with index.html ?v= (proposed)
```

### 4.2 New static asset: the service worker

A new top-level **`sw.js`** (served by Pages, NOT a module import — SWs can't be modules in all targets without `{type:'module'}`, decide in §11). It is **public app code**, contains no secrets, and is registered from `index.html`. It owns a versioned cache name keyed to `SW_CACHE_VERSION`.

### 4.3 Proposed telemetry payload (client → backend, ephemeral)

Not a persisted *entity* in `DATA`/`PERSIST_KEYS` — a fire-and-forget metric blob. Shape (metrics only, no PII):

```js
{
  action: 'perfReport',           // new additive GAS action (§5)
  build: '20260628a',             // the ?v= / SW_CACHE_VERSION token
  device: 'phone'|'tablet'|'desktop',  // from body.is-phone + UA class, coarse only
  role: 'driver',                 // ROLE id (operational segmentation; NOT the password)
  vitals: { lcp: 1820, inp: 64, cls: 0.02 },   // ms / unitless, sampled
  renders: { p50: 14, p95: 88, over: 3 },      // render-time ms percentiles + over-budget count this session
  ts: 1751155200000
}
```

Where it lands backend-side is an Open Question (a `_perf` Sheet tab vs. a no-op accept-and-drop vs. an external analytics endpoint) — see §11. **Schema-less note:** if stored, it goes in a dedicated tab outside `PERSIST_KEYS` so it never rides the diff-sync or pollutes record data.

### 4.4 Migration concerns

- **None for records.** No existing field changes; no `data.js` shape change; no `PERSIST_KEYS` (`app.js:15638`) change.
- **SW lifecycle is the migration risk.** A stale SW serving an old cache after a deploy is the classic PWA footgun — the `SW_CACHE_VERSION` bump + `skipWaiting`/`clients.claim` discipline (§5.2) is the migration story, and it must compose with the existing manual `?v=` cache-bust, not fight it (§10 risk).

---

## 5. Backend / Integration Contract

### 5.1 Existing actions touched (read-only awareness)

- `backendCall('load')` / `backendCall('sync', {upserts, deletes})` — the data path. **Untouched in shape.** The only interaction is that the SW must NOT cache them (§3.2).
- `backendCall('uploadCapture' | 'uploadFile')` — Drive offload (`app.js:13355,13603`). Untouched; the ≤3 throttle (P7) stays.

### 5.2 Service worker contract (client-only, no GAS change)

The SW is a **client artifact**; it needs no backend cooperation. Strategy (proposed, all subject to §11):

| Asset class | Strategy | Rationale |
|---|---|---|
| App shell (`index.html`, `app.js`, `style.css`, `rule-usage.js`, icons, manifest) | **Stale-while-revalidate**, keyed to `SW_CACHE_VERSION` | Instant open from cache; background-refresh picks up new bytes within a cycle. Pairs with the existing `max-age=600` + `?v=`. |
| Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) | **Cache-first** with long TTL | Saira/Geist rarely change; offline must keep the stamped look. |
| Stripe.js, Google Maps JS | **Network-only (pass-through)** | Third-party, PCI/ToS-sensitive (`index.html:23`); never cache. |
| `backendCall` POSTs + any data | **Network-only, never intercepted** | Hard data-isolation line (§3.2). |
| Navigation requests offline | **App-shell fallback** to cached `index.html` | Returning user opens to the login/app shell with zero network; the data layer then shows the R25 "Not saving"/offline state it already has. |

**Activation discipline (the migration footgun):** on a new `SW_CACHE_VERSION`, the new SW `skipWaiting()`s, deletes old caches in `activate`, and `clients.claim()`s — so a deploy can't strand users on stale code. This must be sequenced with the existing `?v=` bump (§10).

### 5.3 Proposed additive GAS action: `perfReport` (OPTIONAL — gated by §11)

If we sink telemetry to the backend, it is **one new additive action** on the single `backendCall` entry point. Contract:

```
Request:  { action:'perfReport', password, build, device, role, vitals, renders, ts }
            • password — the existing role password gate (server-side check, same as
              every action). NEVER logged or stored; used only to authenticate the call.
            • role     — ROLE *id* string for segmentation. NOT the password.
            • vitals / renders — metrics-only blobs (§4.3). No PII, no dollars, no ids.
Response: { ok:true }            // accept-and-drop or accept-and-append; never blocks the UI
Auth:     same password gate as every other action (server REJECTS unauthenticated;
          an attacker can't anonymously spam the sink). Reuses backendCall's gate —
          no new auth surface.
Failure:  fire-and-forget — a non-200 / !ok / network error is swallowed client-side;
          telemetry NEVER surfaces an error to the operator, NEVER raises R25, and
          does NOT retry aggressively (at most a single best-effort attempt per
          session flush). A failed perfReport must be indistinguishable from "no
          telemetry" — it can never degrade the actual app.
Rate:     client samples at PERF_SAMPLE_RATE and batches per session, so this adds
          at most ~1 tiny POST per session, well under the existing sync volume.
          It piggybacks on an idle moment, never on the critical save path.
Storage:  if appended (vs. accept-and-drop), it lands in a DEDICATED tab OUTSIDE
          PERSIST_KEYS (§4.3) so it never rides diff-sync, never loads into DATA,
          and a runaway sink can't bloat the cold-load payload.
```

**Conservative default:** ship instrumentation **client-only first** (console getter + an optional `localStorage` ring buffer for a dev panel), and treat the backend sink as a Phase 2, opt-in decision. We do **not** assume we can read `Code.gs` (it is gitignored, clasp-deployed); the action above is a **contract** for whoever deploys it via `/clasp` — additive only, never altering an existing action's shape.

### 5.4 External integrations affected

- **Stripe.js** (`index.html:23`) and **Google Maps JS** (lazy-loaded via `loadGoogleMaps`, `app.js` APP-06): both are **network-only** in the SW and are prime **code-split** candidates (only the office/transport flows need Maps; only payment flows need Stripe).
- No telematics / NVR / QuickBooks integration touched by this area.

---

## 6. UX / UI

Performance is mostly **invisible** — the best outcome is the user noticing nothing except speed. The few visible surfaces are specced in the yard data-plate language.

### 6.1 Update-ready toast (when a new SW version is waiting)

When the SW has fetched a new app version in the background, prompt — don't force — a reload, so we never yank the page out from under an operator mid-edit.

- **Form:** a single-line **toast** (reuse `#toast`, `index.html:29`) — *not* a popup, so **no new WINDOW_CATALOG entry**. Dark steel panel, **hi-vis yellow hazard-stripe** left edge (the signature `repeating-linear-gradient(135deg, var(--yellow) 0 13px, #14181d 13px 26px)`), **Saira Condensed** stamped label, one corner rivet.
- **Copy (ranch-twist, subtle):** `FRESH SUPPLIES IN` · "A newer build's saddled up — reload when you're ready." with a single **ignition-orange** "Reload" action pill (`actionPill`, the R17 builder) and a dismiss ✕.
- **States:**
  - **Idle (no waiting SW):** the toast never renders.
  - **Waiting SW + active work:** suppressed (see the P11 guard set above) — it queues and re-offers on the next idle tick.
  - **Shown:** stamped panel slides in; **reduced-motion** → no slide, just appears (CLAUDE.md quality floor). Auto-dismiss after a generous timeout (it re-offers later); never blocks input behind it.
  - **Reload pressed:** `skipWaiting` → the waiting SW activates → `location.reload()`.
  - **✕ pressed:** dismissed for this idle window; re-offers next idle. Never nags mid-action.
- **A11y / quality floor:** the toast gets `role="status"` (polite live region) so a screen reader announces it without stealing focus; the Reload pill is keyboard-focusable with a **visible focus ring**; `prefers-reduced-motion` is respected. (CLAUDE.md "Quality floor: responsive, visible focus, reduced-motion respected.")
- **R-rulebook:** the toast's Reload action pill is an existing **R17** (`actionPill`) element; the dismiss ✕ is **R24** (`closeX`, per `RULE_META` `app.js:4381` — note the `closeX` doc-comment mislabels it R22; the authoritative `RULE_META`/`rule-usage.js` catalogs it as R24). If the **hi-vis hazard-stripe left edge** on the toast is a genuinely new stamped visual element (the existing `#toast` has no stripe), it needs its own `data-r` stamp and a **regenerated `rule-usage.js`** (`node ci/gen-rule-usage.mjs`, drop `--check`). Reusing only R17 + R24 inside the existing `#toast` element → **no `rule-usage.js` change**; adding the stripe → regenerate. Either way **no `WINDOW_CATALOG` entry** — a toast is not a popup window.

### 6.2 Offline indicator (reuse, don't invent)

The app already has the **R25 "Not saving"** plate (`app.js:15953`, red hazard-stripe, mounted on `<body>` outside `#app`). Offline-shell boot should reuse that exact signal — when the SW serves the shell but the data layer can't reach the backend, the existing R25 state communicates "held, retrying." **No new offline UI** beyond confirming R25 fires correctly from a cold offline open.

### 6.3 Dev-only vitals panel (OPTIONAL, developer-tier)

If we surface vitals in-app (§11 decision), it is a **developer-tier** readout living beside the existing dev tools (Design Lint / Inspector / Rulebook, `config.js:324`).

- **If it's a popup window** (overlay), it **MUST** get a `WINDOW_CATALOG` entry (`ci/check-window-catalog.mjs` fails CI otherwise) and `data-r` stamps via `popupShell`.
- **If it's a strip inside the existing Rulebook overlay** (preferred — no new window), it inherits that window's catalog entry; only its new rows need `data-r` stamps.
- **Look:** a stamped "RENDER BUDGET" data-plate — Saira labels, a tiny p50/p95/over-budget readout, the 100 ms budget line drawn as a yellow hazard tick. One orange accent max; the rest is steel + readout.

### 6.4 Empty / loading / error states

- **Cold start, cached shell, no network:** shell paints instantly → login plate → R25/offline state from the data layer. No spinner over a blank screen.
- **Cold start, no cache, slow network:** unchanged from today (network fetch) — but the SW install on *that* visit primes the cache for next time.
- **Code-split chunk loading:** a lazily-loaded flow (e.g. transport editor, payments) shows a minimal stamped "loading" affordance only if the chunk isn't already warm; on repeat use it's instant. Reduced-motion respected (no spinner animation when `prefers-reduced-motion`).

### 6.5 Mobile reflow

No new layout. The point of this area is that the **existing** phone reflow (`body.is-phone`, single active column, `app.js:11637`) gets *faster* (smaller initial JS via splitting, instant open via SW), not restructured.

---

## 7. Business Rules / Derivations / Money

This area computes **no money**. It must, however, respect and not disturb the money/derivation engine:

- **Render budget is wall-clock, not a money rule.** `dt = performance.now() - t0 > PERF_BUDGET_MS` (`app.js:11696`). The proposal (§8) is to *measure and report* it, never to *skip work* to hit it — we must never drop a derivation (price, tax, status) to make a frame faster. Correctness beats speed; windowing (P2) is the sanctioned way to bound work, not silently truncating computed values.
- **Diff-sync correctness is sacred.** `computeChanges()` (`app.js:15693`) is what makes saves cheap; any perf change near the save path must preserve "send only what changed, never lose a mid-flight edit" (the `savePending` re-flush, `app.js:15944`). A perf optimization that drops a dirty record is a data-loss bug, not a win.
- **Downscale quality floor.** `downscaleImage` (P6) trades pixels for bytes. The per-call dims are tuned per capture site against the live code:

  | Capture site | `maxDim` / `quality` | Anchor |
  |---|---|---|
  | New-customer selfie | `340 / 0.5` | `app.js:13806,13814` |
  | Inspection photo / checklist item / part / receipt | `600 / 0.5` | `app.js:13833,13839,13741,13750` |
  | Customer agreement scan | `1200 / 0.7` | `app.js:9933` |
  | Feedback screenshot | `1000 / 0.6` | `app.js:13768` |
  | Generic file upload | `1400 / 0.72` | `app.js:13725` |

  Any global "make images smaller for perf" change must not drop **inspection/agreement evidence** below legibility — those are quasi-legal records (an inspection is the basis of a damage claim; an agreement scan is a signed contract). Evidence legibility is a **hard floor**; selfies/thumbnails can go smaller. A single global quality knob is an Open Question (§11.7) precisely because it risks this floor.

No tax/aging/entitlement formula is in scope.

---

## 8. Phasing & Milestones

### Phase 0 — Canonize + instrument (measure before optimizing)

**In scope:**
1. **Web Vitals (client-only).** A tiny reporter (no library if avoidable; or a pinned micro-lib): capture LCP, INP, CLS via `PerformanceObserver`, plus a **render-time histogram** hooked at `app.js:11696` (already computes `dt`). Buffer in a `localStorage` ring + expose to a dev-console getter.
2. **Make the budget warn actionable:** keep `PERF_BUDGET_MS`, add p50/p95/over-budget counters so we see *distribution*, not one-off warns.
3. **No behavioral change** to render, sync, or UI. Pure observability.

**Out of scope (Phase 0):** any backend sink, any SW, any split.

### Phase 1 — Offline shell (the biggest cold-start win)

**In scope:**
1. Add `sw.js` with the §5.2 strategy table (SWR shell, cache-first fonts, network-only third-party + backend).
2. Register it from `index.html` (guarded to non-dev or all — see §11), version it via `SW_CACHE_VERSION`, wire `skipWaiting`/`clients.claim`/old-cache-purge.
3. Add the §6.1 **update-ready toast** (no new window).
4. Verify the existing **R25** offline state fires from a cold offline open (§6.2).

**Out of scope (Phase 1):** code splitting; backend telemetry sink.

### Phase 2 — Code splitting + (optional) telemetry sink

**In scope:**
1. **Split the heaviest non-first-paint flows** behind dynamic `import()`: candidates ranked by "loaded eagerly but rarely needed first" — the Google-Maps transport editor + dispatch map (APP-06), the payments/Stripe flow, Mr. Wrangler's heavier authoring paths. **Honor the cache-bust note:** dynamic imports drop the `?v=` query (relative), and the module graph revalidates within the 10-min window — so splits ride the SW cache, not the manual token.
2. **Optional `perfReport` GAS action** (§5.3) if Jac wants field data — deployed additively via clasp.

**Out of scope (Phase 2 / explicitly deferred):** a framework migration; a build step / bundler (the app ships as hand-authored ES modules with no build — introducing Vite/esbuild is a separate, large decision, **flagged in §11**); server-rendering; HTTP/2 push.

### v1 line (what "this spec shipped" means)

**v1 = Phase 0 + Phase 1** (instrument + offline shell). Phase 2 (splitting + telemetry sink) is the same area, next spec iteration. Stated so Jac can scope the first PR.

---

## 9. Acceptance Criteria

Concrete + testable. CI-gate impact called out.

### 9.1 Phase 0 (instrumentation)

- [ ] After boot, a dev-console getter (e.g. `window.__perf()`) returns `{ lcp, inp, cls, renders:{p50,p95,over} }` with live numbers.
- [ ] The render hook at `app.js:11696` feeds the histogram on **every** render with no measurable added cost (the hook is arithmetic, not DOM work).
- [ ] `PERF_VITALS_ON = false` fully disables capture (kill-switch verified).
- [ ] **No new popup** → `ci/check-window-catalog.mjs` unaffected. **No new `data-r`** in Phase 0 → `ci/gen-rule-usage.mjs --check` passes unchanged.
- [ ] `node ci/smoke.mjs` still boots clean (the reporter must not throw on a browser lacking a given `PerformanceObserver` entry type — feature-detect each).

### 9.2 Phase 1 (offline shell)

- [ ] Second visit (after one online load) **opens offline**: airplane-mode cold start paints the app shell + login plate from cache, zero network.
- [ ] The SW **never** caches a `backendCall` response: a network panel / unit check shows POSTs to `BACKEND_URL` are network-only and absent from caches (the §3.2 data-isolation guarantee).
- [ ] A deploy with a bumped `SW_CACHE_VERSION` purges the old cache and serves new bytes within one SWR cycle; no stale-code stranding.
- [ ] The §6.1 update toast appears only when a waiting SW exists and no overlay/drag/typing is active; "Reload" applies the new version; ✕ dismisses without reload.
- [ ] If the toast introduces a new visual element, `rule-usage.js` is regenerated and `node ci/gen-rule-usage.mjs --check` passes; `node ci/check-window-catalog.mjs` passes (no new window — it's a toast).
- [ ] `node ci/smoke.mjs` passes **with the SW present** (note: smoke serves over HTTP on a port — confirm SW registration doesn't break headless boot; register may be no-op'd in CI/localhost per §11).
- [ ] Cold offline open shows the existing **R25** "Not saving"/held state correctly (not a blank or a crash).

### 9.3 Phase 2 (splitting / telemetry)

- [ ] Initial JS transferred for a **driver** cold start is measurably smaller than today (split-out Maps/Stripe/Wrangler not in the first chunk); verified via network transfer size.
- [ ] A split chunk **re-asserts its gate**: loading the payments chunk does not grant payment rights; the tier check (`ROLE_TIERS`) still runs at the action.
- [ ] If `perfReport` ships: it's a single additive `backendCall` action, fire-and-forget, never raises R25, samples at `PERF_SAMPLE_RATE`, and **rejects when unauthenticated** (reuses the password gate).
- [ ] **Payload allowlist audit:** the `perfReport` body is asserted (in a logic-test fixture) to contain *only* the §4.3 keys (`build, device, role, vitals, renders, ts`) — no record id, customer name, address, phone/email, dollar amount, `bottomDollar`/margin, or the role password. A new key in the payload fails the test.
- [ ] If a **dev-tier vitals panel** is surfaced as its own popup window, `WINDOW_CATALOG` gains an entry and `node ci/check-window-catalog.mjs` passes; if it's a strip inside the existing Rulebook overlay, no new window → `check-window-catalog` unchanged, only its new rows carry `data-r` and `gen-rule-usage.mjs --check` reflects them.
- [ ] A dev-tier-only surface is **not reachable below `rank ≥ 5`** (developer) — asserted by gate, not just hidden by CSS.

### 9.4 Standing CI gates (all phases)

`node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check` must all pass. Port-8000 swap-to-9147 dance applies before running the smoke/logic gates (CLAUDE.md → Deploy & gates). If a Code-Atlas chapter banner is added (e.g. a new "Perf / Service Worker" chapter in `app.js`), regenerate `code-map.generated.md`.

---

## 10. Risks & Edge Cases

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Stale-SW strands users on old code** — the classic PWA footgun; an old SW keeps serving stale `app.js` no refresh fixes | High | `SW_CACHE_VERSION` bump in lockstep with `?v=`; `skipWaiting`+`clients.claim`+old-cache-purge on activate; the update toast nudges reload. This is the #1 thing to get right. |
| R2 | **SW caches a data response → PII / pricing leak** | Critical | Hard rule (§3.2): SW fetch handler excludes `BACKEND_URL` + `text/plain` POSTs; data is network-only, never stored. Acceptance test asserts it. |
| R3 | **SW + the staging mirror** — staging is a separate cron-synced mirror repo (CLAUDE.md); a SW there could pin an even staler snapshot | High | Scope SW to **production origin** initially, or version it so staging's bump forces re-sync; verify on staging with the documented `curl`-for-new-bytes check before trusting it. **Flag as Open Question.** |
| R4 | **Telemetry leaks PII** | Critical | Metrics-only payload (§4.3); audit asserts no record IDs / names / dollars / password; client-only by default. |
| R5 | **Code-split chunk becomes an auth bypass** | High | Splitting moves *code*, not *gates*; every lazy flow re-asserts its tier check at the action (§3.1/§9.3). |
| R6 | **Dynamic `import()` + the `?v=` rule** — relative imports drop the query → double-instantiation if mixed versioned/unversioned (CLAUDE.md warns of exactly this) | Medium | Splits ride the **SW cache**, not the manual token; never add `?v=` to module imports. Verify no module loads twice. |
| R7 | **A perf "optimization" drops a derivation or a dirty record** — skipping work to hit the budget loses a price/status or a save | High | §7 rule: correctness > speed; windowing is the only sanctioned work-bounding; the `savePending` re-flush invariant is untouchable. |
| R8 | **Instrumentation cost > savings** — a heavy reporter adds latency to the path it measures | Medium | Sampling (`PERF_SAMPLE_RATE`), feature-detect observers, kill-switch (`PERF_VITALS_ON`); the render hook is arithmetic only. |
| R9 | **SW breaks the dev-reload loop** (`index.html:45` localhost `dev-version.txt` poller) or headless smoke | Medium | Don't register the SW on `localhost`/`127.0.0.1` (mirror the existing dev-only guard), or no-op it in CI; acceptance test confirms smoke still boots. |
| R10 | **Offline shell shows but data is empty/confusing** — user thinks records vanished | Medium | Lean on the existing R25 plate (§6.2) so "held/offline" reads clearly; don't paint an empty grid as if it were real data. |
| R11 | **Multi-user refresh poll fights the SWR** — 18 s data poll vs. asset cache | Low | They're orthogonal (poll = data via network-only `backendCall`; SWR = static assets). No interaction by design (§5.2). |
| R12 | **Fonts cache-first → a font swap never lands** | Low | Tie font cache to `SW_CACHE_VERSION` so a deploy can bust it; fonts change rarely. |
| R13 | **SW caches a `?v=`-tokened asset, then `?v=` bumps → version skew** — the SWR cache key includes the query string, so `app.js?v=OLD` and `app.js?v=NEW` are *different* cache entries; a half-busted deploy could serve `app.js?v=NEW` from network but `style.css?v=OLD` from cache | Medium | Key the cache to `SW_CACHE_VERSION` and **purge ALL prior-version entries on activate** (don't rely on query-string match); bump `SW_CACHE_VERSION` in the SAME commit as the `?v=` token so they can never diverge. Acceptance §9.2 asserts one SWR cycle fully swaps. |
| R14 | **Telemetry sink becomes an unauthenticated DoS / PII funnel** — a public endpoint accepting arbitrary blobs | Medium | `perfReport` reuses the **password gate** (rejects anonymous, §5.3); payload is allowlist-audited to metrics-only; sampling caps volume; sink tab is outside `PERSIST_KEYS`. |
| R15 | **`web-vitals` micro-lib (if vendored) drifts or pulls a CDN in CI** | Low | Vendor pinned + verbatim like Lucide icons (CLAUDE.md Icons rule); never a runtime CDN import (would break offline + the no-external-CDN-in-CI constraint); a `--check` drift guard mirrors `gen-icons.mjs`. |
| R16 | **First-ever visit pays a one-time SW-install cost** while priming the cache, on the exact slow-LTE cold start we're trying to help | Low | SW install is async/non-blocking — it primes the cache *after* first paint, so the first visit is no slower than today; the win is on the *second* visit. Acceptance §9.2 measures the second-visit open. |

---

## 11. Open Questions

> **Resolved 2026-06-29:** Q1 → **D1** (stay buildless, native `import()` splitting). Q2 → **D2** (telemetry client-only first). Q10 → **D3** (offline writes out of v1). Q4/Q5/Q6/Q7/Q8/Q9/Q11/Q12/Q13 → **D4** (adopt conservative draft leans). Q3 (in-app vitals readout) → defer; if surfaced, a strip inside the Rulebook overlay, no new window.

These are the unresolved forks for Jac. Each is phrased as a decision with trade-offs.

1. **Build step — yes or never?** The app ships as hand-authored ES modules with **no bundler**. Real code-splitting, tree-shaking, and a hashed-filename cache story all get dramatically easier *with* a build (Vite/esbuild) — but that's a big architectural shift and contradicts the current "deploy by paste / `?v=` token" simplicity.
   - **(a)** Stay buildless: split via native dynamic `import()` only, keep `?v=` + SW for caching. *(Simplest, honors current deploy; limited optimization ceiling.)*
   - **(b)** Introduce a minimal build for hashed assets + true splitting. *(Bigger win, but new toolchain, new CI, retires the manual `?v=` ritual.)*
   - **Lean:** (a) for v1; revisit (b) only if vitals prove the first chunk is the bottleneck.

2. **Telemetry sink — where do field numbers go?** (a) client-only console/`localStorage` + a dev panel (no backend, zero leak risk); (b) the additive `perfReport` GAS action into a `_perf` Sheet tab; (c) an external analytics endpoint (Plausible/self-hosted). **Lean:** (a) for v1, decide (b) once we know *what* we want to watch. Surfacing any of these touches the PII line — keep metrics-only regardless.

3. **In-app vitals readout — surface it or not?** A developer-tier panel helps Jac/devs see live numbers, but it's a new dev surface (new `data-r` stamps, possibly a `WINDOW_CATALOG` entry). Alternatively keep it console-only. **Trade-off:** visibility vs. surface area. *(If surfaced, prefer a strip inside the existing Rulebook overlay — no new window.)*

4. **SW registration scope — production-only, or staging too?** Staging is a separate cron-synced mirror (R3). A SW on staging could pin a stale snapshot that "no browser refresh fixes." **(a)** Register only on `app.jacrentals.com`; **(b)** register everywhere but version aggressively. **Lean:** (a) until the staging-mirror interaction is proven safe.

5. **SW update model — auto-reload or prompt?** (a) Silent `skipWaiting` + reload on next navigation (freshest, but can yank a mid-edit page); (b) the §6.1 prompt-to-reload toast (safer, but a user can sit on stale code). **Lean:** (b) — never reload out from under an operator mid-edit; the refresh-poll guards (P11) already model "don't disrupt active work."

6. **Render-budget — warn-only forever, or ever enforce?** Today it's a `console.warn` (P1). Do we ever want a *hard* path (e.g. auto-shrink `VIRT_CAP` when p95 blows the budget on a slow device), or is windowing-by-hand enough? **Lean:** measure first (Phase 0); never auto-drop computed values (§7).

7. **Downscale tuning — global or per-call?** P6 dims are tuned per capture site. Do we want a single global quality knob (easier to dial for slow networks) or keep per-call (protects evidence legibility)? **Lean:** keep per-call; evidence legibility is a hard floor (§7).

8. **Library vs. hand-rolled vitals.** Pull a pinned micro-lib (`web-vitals`, ~2 KB) for correct LCP/INP/CLS, or hand-roll `PerformanceObserver`? Hand-rolling INP correctly is genuinely fiddly. **Trade-off:** a new dependency (vendored, pinned, no CDN per the icons precedent) vs. getting the metrics subtly wrong. **Lean:** vendor a pinned micro-lib the way Lucide icons are vendored.

9. **What counts as "the interaction" for INP/budget?** The 100 ms budget measures `render()` wall-time, but INP measures input→next-paint including event handling + layout. Do we align the in-app budget to true INP (more honest, harder) or keep measuring `render()` only (cheap, partial)? **Lean:** report both; treat `render()` time as a *component* of INP, not the whole thing.

10. **Offline writes — in scope?** Today offline = R25 "held, retrying" (writes queue in memory, lost on reload per the `beforeunload` guard, `app.js:15978`). A true offline-first SW invites the question: do we persist *pending writes* to IndexedDB so a reload-while-offline doesn't lose them? That's a meaningful reliability upgrade but a real data-integrity design (it must compose with diff-sync's "send only what changed" without resurrecting a stale edit over a newer remote one). **Lean:** **out of scope for v1** (shell-caching only); flag as a strong Phase 3 candidate.

11. **SW as classic script or ES module?** `sw.js` can be registered classic (`importScripts`-style) or as `{ type:'module' }` (cleaner `import`s, but not supported on every target/older WebView a yard phone might run). The SW is small and self-contained, so the module ergonomics buy little. **(a)** Classic script (max compatibility, the conservative default); **(b)** `{type:'module'}` (cleaner, narrower support). **Lean:** (a) — a perf feature must not *reduce* the device matrix it runs on; the SW has no dependency that needs `import`.

12. **Update model interplay with the data-layer offline state.** When the update toast offers a reload but the device is *also* offline (R25 showing), reloading would drop the user into the offline shell. Do we **suppress the reload offer while offline** (don't strand the operator), or allow it (they explicitly chose to reload)? **Lean:** suppress the update toast while R25 is active — never offer a reload that lands on a worse state. Surfaced because it's a subtle multi-state edge the SW + R25 interaction creates.

13. **Per-role first chunk, or one shared first chunk?** Code-splitting could go further than "split rarely-used flows" — it could ship a **driver-minimal** first chunk vs. an **office-full** one, keyed off the authenticated tier. That maximizes the driver cold-start win but couples the split graph to the role gate (a place §3.1 warns about) and complicates caching (the SW now has role-variant shells). **(a)** One shared first chunk, split only by *flow* (simpler, gate-safe); **(b)** role-variant first chunks (bigger driver win, riskier). **Lean:** (a) for v1 — keep splits gate-agnostic; revisit (b) only if vitals show the driver first chunk is dominated by office-only code.

---

## 12. Dependencies & Sequencing

### 12.1 Upstream (this area depends on)

Per the roadmap, Frontend Performance **depends on** `design-system`, `backend-data`, `wrangler-ai`, `maps-location`:

| Dependency (slug) | Why | What must hold |
|---|---|---|
| `design-system` | The update toast, the offline (R25) reuse, and any dev panel must speak the yard data-plate language + carry `data-r` stamps | Stable R-rulebook builders (`actionPill` R17, close R22, `popupShell`); `rule-usage.js` generator. |
| `backend-data` | The SW's hard "never cache `backendCall`" line, the diff-sync invariants, and the optional `perfReport` action all sit on the `backendCall` contract (`app.js:15650`) | The single-entry-point sync contract + `BACKEND_URL` origin are stable; new actions stay additive. |
| `wrangler-ai` | Mr. Wrangler is a heavy, lazily-relevant code path (a prime split candidate) and owns the IndexedDB rail (P9) | Don't break `wrStore`/blob eviction when splitting or caching. |
| `maps-location` | The Google-Maps transport editor + dispatch map (APP-06) are the top code-split candidates (eagerly loaded, office/transport-only) | `loadGoogleMaps` already lazy-loads the Maps JS; splitting the *editor* code composes with that. |

### 12.2 Downstream (areas that depend on this)

Several areas list `frontend-performance` as a dependency — they inherit its guardrails:

- **`search-views`** and the wrangler-driven views (roadmap #... "Depends on … `frontend-performance`") rely on windowing (P2) + render budget staying healthy as result sets grow.
- The **dispatch / cockpit** and **reporting** areas (roadmap lines 299/310/323/334) lean on this area to keep their data-heavy screens under budget.
- **Net:** this area is **horizontal infrastructure** — it should land its guardrails *before* those data-heavy areas scale up, so they're built against a measured, cached, windowed baseline rather than retrofitting perf later.

### 12.3 Sequencing within this area

```
Phase 0 (instrument, client-only)         ← do FIRST: measure before optimizing
        │  (no SW, no split, no gate change)
        ▼
Phase 1 (service worker + offline shell)  ← biggest cold-start win; depends on design-system toast
        │  (R25 reuse, update toast, SW_CACHE_VERSION lockstep with ?v=)
        ▼
Phase 2 (code splitting + optional perfReport sink)
           depends on maps-location / wrangler-ai split seams + backend-data additive action
```

**Land Phase 0's numbers before committing to Phase 1/2 priorities** — the whole north star is "decide by data, not vibes," so we should not pick *which* code to split until the vitals say where the time goes.

---

*End of DRAFT — every numbered decision above is open for Jac's critique; §11 is the priority read.*
