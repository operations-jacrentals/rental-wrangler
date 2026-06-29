# Search / Views — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/search-views`
**Task branch:** `search-views/spec` (proposed)
**Maturity:** shipped
**Scope:** The app-wide find/filter/sort layer — the global search box, every card's mini-search, AND-narrowing filter chips (incl. NOT-terms and column-scoped chips), the availability live-token, the date/range picker, the cascade pill, per-card sort, and admin-curated Saved Views.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions and **change the Saved-Views model** (§2.10) from shared to personal.

- **D1 · Views capture sort (resolves 11.1).** `applyView` restores `cs.sort` (field + dir) when present; a legacy view with no `sort` **leaves the current sort alone** (backward-safe). Frontend-only; `setViews` round-trips the new field verbatim.
- **D2 · Replace shared Admin-curated Views with PERSONAL "my views" (resolves 11.4/11.6; reverses the §2.10 shared model).** Remove the single company-wide view set; **each login keeps its own private views.** Keyed by the logged-in identity: **per-role today** (per-role passwords — everyone sharing a role login shares its views), upgradable to **per-user** if individual logins arrive. Curating is open to the view's **owner** (no admin gate — they're personal). Backend: a per-identity views store (additive `getUserViews`/`setUserViews` keyed by the role/identity the server derives from the per-role password — `backend-data` D1). Migration: offer to seed each identity from the old shared set once, then they're personal (Jac to confirm seed-vs-drop). This also dissolves the shared-views LWW race (11.5) since views are per-identity.
- **D3 · Keep substring matching, no relevance ranking (resolves 11.2).** Works well at yard scale; predictable + fast.

**Defaults adopted:** 11.12 → keep the reverse-renter denorm capped at **name+company** (no phone/email/notes on fleet cards) · 11.14 → **add `ci/check-search-blob.mjs`** so a future blob edit can't silently fold a gated field (margin/`bottomDollar`/cost) — makes the §3.2 security invariant unskippable · 11.3 → defer `-prefix`/quoted text operators · 11.10 → defer index-scaling until felt · 11.7 → no margin/floor search column (money-gated `totColMatch` if ever) · 11.13 → search stays read-only (any bulk action re-asserts per-action gates).

---

## 1. Goal & Problem

**What this area is for.** Rental Wrangler is a three-column SPA that holds the entire yard — customers, rentals, units, categories, invoices, work orders, inspections, service, vendors, parts, receipts, files — on one screen. Search / Views is the connective tissue that lets a dispatcher, mechanic, or owner go from "show me everything" to "show me *exactly* the records I need to act on" without leaving the grid or opening a report builder.

**The business/user problem.** A yard hand on a phone in the dirt needs to type `bamba` and instantly see Bamba Construction's account, its open rentals, and the units they've got out — across cards. An Office user reconciling needs to pin `Unpaid` + `−Quote` and sort invoices by balance. An Admin wants to save "Units · available next week" once and have every device + login see it. The north star:

> **Type what you're thinking, narrow with chips, and the right records surface across every card — fast, offline-tolerant, and the same on every device.**

**Why it matters.** Search is the most-touched non-money surface in the app. It runs on every keystroke against ~150–500 records per card; a regression here makes the whole app feel broken even when the data is fine. It is also a *read* surface that fans out across all 11 entity types, so it inherits the visibility gates of each (customer isolation, pricing-floor, money) without being able to loosen them.

---

## 2. Current State (Baseline) — documents the LIVE system AS CANON

Everything in this section is **shipped** unless tagged *(partial)* or *(missing)*. Anchors are `APP-xx` Code-Atlas chapters + `file:line`.

### 2.1 The search index — `IDX.search` (shipped) — `APP-03` (`app.js:78`)

On boot, `buildIndexes()` (`app.js` ~690) builds `IDX.search`, a `Map` keyed `"<card>:<id>"` → a single **lowercased blob string** per record. The blob is the one source of truth for what's searchable; it is produced by `searchBlob(card, rec)` (`app.js:742`).

`searchBlob` emits, per entity type, **every raw field PLUS the foreign-key DISPLAY names PLUS the `getStatus(...).label` text** — so a search for the *visible* word (`Member`, `Past Due`, `Delivery`, `Bill: Yes`) matches, not just the stored key. Examples of what's folded in:

| Card | Notable blob contents |
|---|---|
| `customers` | name/first/last/company/phone/email/address/industry, account-type + label, pay-status + label, both funnel-stage labels, sales action, account notes, interested-category names, **every activity-log line** |
| `rentals` | rental name, dates (ISO **and** human `fmtShortDate` "Jun 18"), PO, notes, `field call fc` token, status + label, transport-type + label, the unit `name/make/model/serial`, category name, **customer name + company** |
| `units` | name, mechanic, serial, year/make/model/weight, gps fields, inspection + fleet + gps status labels, category name, `Wash Requested wash` token, **reverse renter names** (see §2.2) |
| `categories` | name, fuel, description, notes, **reverse renter names** |
| `invoices` | id, PO, notes, customer name/company, status + label, **every line-item label** |
| `workOrders` | report, description, notes, mechanic, phase + label, type + label, bill-customer + label, ETA, unit name, customer name, **per-line part/vendor/eta/phase** |
| `inspections`, `parts`, `files`, `expenses`, `vendors` | full field set incl. money-as-text (`money(rec.amount)`), status labels, vendor names, type tokens (`receipt expense`, `part`, `file`) |

`reindex(card, rec)` (`app.js:827`) rebuilds one record's blob after any create/edit and calls `saveSoon()`. A rental edit additionally triggers `reindexRentalLinks()`.

### 2.2 Reverse renter-name denormalization (shipped, #267) — `app.js:712`

The forward `rentals` blob already embeds each rental's unit + category names. `buildRentalLinkIndex()` builds the **mirror**: `IDX.unitRenters: Map<unitId, Set<renterTag>>` and `IDX.catRenters: Map<categoryId, Set<renterTag>>`, where `renterTag = "<name> <company>"`. The `units` and `categories` blobs spread these Sets, so **a customer-name search ALSO surfaces the units/categories that customer has rented**, and a unit/category search surfaces its renters. `reindexRentalLinks()` rebuilds the maps + the (small, fixed) unit/category blobs whenever a rental's links change.

### 2.3 The matcher — `blobMatches` / `rowMatches` (shipped) — `app.js:2343`

```js
function blobMatches(blob, query, terms) {
  const b = blob || '';
  const q = (query || '').trim().toLowerCase();
  if (q && !b.includes(q)) return false;                       // live text = substring AND
  return (terms || []).every((ft) => (ft.neg ? !b.includes(ft.t) : b.includes(ft.t)));
}
```

- **Live query** = a single case-insensitive **substring** test against the blob. (No tokenization, no fuzzy, no relevance ranking — substring only.)
- **Filter terms** (`{ t, neg, col?, value? }`) AND-narrow: a positive term must be present, a `neg` (NOT) term must be absent.
- `matchesSearch(blob)` is the global-scope wrapper (`state.query` + `state.filterTerms`).
- `rowMatches(card, rec, query, terms)` (`app.js:2374`) is the per-card matcher and is where the special tokens layer on (availability + column-scoped + date).

### 2.4 Column-scoped exact terms (shipped) — `totColMatch` (`app.js:2403`)

A term with a `col` does an **exact column match** (so `Ready` can't also catch `Not Ready`) instead of a blob substring. Many `col` values are *virtual* columns produced by footer chips and graph-slice taps:

`__date`, `__wo`, `__cond`, `__svc`, `__fleet`, `__fc`, `__fcmonth`, `__rentmonth`, `__datemonth`, `__rstat`, `__rentrange`, `__daterange`, `__fcrange`, `__svcstat`, `__wophase`, plus any real registry column key via `cardColumns(...)`.

Same-column positive terms OR together (toggle several graph slices = match any); different columns AND; a NOT term on any column excludes on its own (`app.js:2393–2399`).

### 2.5 The availability live-token (shipped, §10) — `AVAIL_RE` (`app.js:2355`)

`available` / `unavailable` are **not** static blob text — they are computed against the real availability lens for the in-scope rental window (`availWin`, recomputed each render). On `units`/`categories` only, `rowMatches` calls `isUnitAvailableFor(...)` / `categoryAvailableCount(...) > 0` and filters live; the token is stripped from the text query so the rest still matches; it's a no-op on other cards. The rental-window picker auto-fills the token, but you can type it anytime. `availSearchActive()` (`app.js:2356`) reports whether any scope has it on.

### 2.6 The date/range picker — `__date` term (shipped) — `APP-36` (`openDateSearch` `app.js:15187`)

Typing `date` or `dates` → Enter opens a **standalone floating calendar** (`dateSearchEl()` `app.js:15227`) that reuses the rental-window `.wp-*` grid styling. It is NOT an overlay-kind popup — it's `state.datesearch` floated under the search bar via `.datesearch-float` (`app.js:11674`), positioned by `positionDateSearch` (desktop) or as a bottom sheet on phones. `dsPickDay` (`app.js:15200`) supports a single day or a click-drag range (either direction); `dsDone` (`app.js:15210`) pins a `{ t: label, col: '__date', value }` term where `value` is `ISO` or `ISO..ISO`. The pinned chip is **edit-on-click** (`js-date-edit` reopens the picker), not remove (`app.js:2494`).

Matching (`recordDateMatch` `app.js:2367`): **rentals** match by **window overlap** (`s <= qTo && e >= qFrom`); point-dated cards (`invoices` test issued OR due, `files` test review-by, others test `date`) match if any date lands in range. `DATE_CARDS` (`app.js:2366`) = `rentals, invoices, workOrders, inspections, expenses, files`; on a date-less card the `__date` term is stripped (`dateScopedTerms`), so it filters neither in nor out.

### 2.7 The cascade pill (shipped, §0.1) — `app.js:6753`

When a session is **anchored** (an item opened with cascade), every *non-anchor* card shows a `🔗 <anchor name>` chip at the front of its mini-search. The chip's ✕ (`js-uncascade`) "releases" the card to its full list so a new item can be added. Cascaded cards reset their `search`/`filterTerms` on re-cascade (`app.js:1975`). This is display + scope, owned jointly with `cascade.js` (the cross-card membership engine).

### 2.8 The search bar AS the filter builder (shipped, §5.4)

- **Global** (`#globalsearch`, `app.js:7392`) and **per-card** (`.mini-search[data-card=…]`, `app.js:6761`) inputs both: type → live substring filter; **Enter** pins the current text as an AND-narrowing chip and clears the input (`addFilterTerm`, `app.js:2477`); **Backspace-on-empty** pops the last chip (`app.js:16243`/`16261`).
- A pinned chip (`filterTermPill`, `app.js:2493`) has a leading ○ **NOT toggle** (`toggleFilterNeg`) and is click-to-remove. **NOT is set by the toggle, not a `-` prefix** — there is no `-term` parse today.
- Footer chips / graph slices add **exact** column chips via `addColFilter` (`app.js:2451`); their labels are derived in `colFilterLabel` (`app.js:2456`).
- Typing `date`/`dates` → Enter is intercepted to open the picker instead of pinning the word.
- `customers` Enter has a **two-entry quick-add**: a staged name pill + a second Enter with the phone calls `quickAddCustomerFromSearch` (`app.js:16251`). An empty-result `customers`/`units`/`categories` search offers a **+New “query”** affordance (`js-new-cust-search` `app.js:6824`; `quickAddUnitFromSearch` for fleet).

### 2.9 Per-card sort (shipped) — `SORT_FIELDS` (`config.js:396`), `sortRows`

Each card has a fixed sort-field list in `SORT_FIELDS` (e.g. rentals: Start date / End date / Status / Customer / Rental Price; invoices: Due Date / Date / Balance / Status / Customer). The sort menu (`openViewMenu`, `app.js:11582`) shows Views + Sort (+ a Payment-Method filter on invoices, #337). `cs.sort = { field, dir }` is per-card; `loadSort` re-derives the label from `SORT_FIELDS` so it can't drift (`app.js:1884`). The direction toggle is `js-sortdir`.

### 2.10 Saved Views (shipped, GLOBAL) — `app.js:11527`

Views are **company-wide / one shared set** (Jac 2026-06-13), synced to the backend so they follow every device + login; localStorage mirror keeps demo/offline working.

- A View captures **search text + pinned chips** (`{ name, search, terms }`) — `viewSig` (`app.js:11561`) signs search + sorted terms; `applyView` (`app.js:11574`) restores both. **A View does NOT capture sort** (the roadmap note — confirmed in code: `applyView` never touches `cs.sort`).
- `VIEW_CARDS` (`app.js:11533`) = `units, categories, rentals, customers, invoices, shop, expenses`.
- `loadGlobalViews()` pulls via `backendCall('getViews')` at boot; `saveViews`→`pushViewsToBackend()` mirrors up via `backendCall('setViews', { views })`. Both no-op without a backend password (demo).
- **Curating** (Add/Delete a view) is gated to `adminUnlocked()` (`js-addview`/`js-delview` `app.js:12825`/`12823`); **applying** a view is open to everyone.
- The View button (`js-sortmenu`) shows the active view's name when one matches, else the current sort-field label (`app.js:6764`).

### 2.11 Search-mode rendering (shipped)

`recomputeSearchMode()` (`app.js:2339`) sets `state.searchMode` from `state.query`/`state.filterTerms` and resets every card's `listLimit` (so a new query restarts each card at its 60-row window). In search mode each card filters its own collection by `matchesSearch`; the Shop card fans across its sub-types (`shopItemsByType` `app.js:6867`). A global search therefore shows cross-card results **in place** — there is no separate dedicated results screen.

### 2.12 Known gaps (partial / missing)

- *(missing)* **No relevance ranking** — substring match is binary; sort order is whatever the card's `cs.sort` says, not match quality.
- *(missing)* **Views don't capture sort** (see §2.10) — re-applying a saved view leaves whatever sort was active.
- *(missing)* **No per-user / private views** — only the one shared Admin-curated set.
- *(missing)* **No `-prefix` NOT syntax** — NOT is the chip toggle only.
- *(partial)* **No quoted-phrase / OR text operators** — multi-word query is one substring; the only OR is via same-column chips.
- *(missing)* **No global search history / recents**, no typeahead suggestions.

---

## 3. Users, Roles & Data Gates

There are **15 roles** (`ROLES`, tiered by `ROLE_TIERS`/`tierRank`). Search is a **read** surface every role touches; it must not become a back-door around the gates each entity already enforces. The governing principle: **search may surface a record a role can already see, in a way that role can already see it — and nothing more.** The blob is a *public-to-every-team-member* string; the gate lives in what we put INTO the blob, not in who reads it.

### 3.1 Gate matrix

| Concern | Today's rule | This area's obligation |
|---|---|---|
| **Apply search/filter/sort** | All roles | No new gate. Read-only narrowing; surfaces nothing a role can't already open. |
| **Curate Saved Views (add/delete)** | `adminUnlocked()` only (`openViewMenu` app.js:11588; `js-addview`/`js-delview` handlers) | **Keep, conservatively.** A non-admin who builds a filter can apply it live but **cannot persist a shared view**. The gate is **client-side only today** (the backend `setViews` does not check role — §5.1) → **Open Q 11.6**. Do NOT loosen the client gate to "any logged-in user" without first answering 11.6. |
| **Availability token** | All roles (read-only lens, `isUnitAvailableFor`/`categoryAvailableCount`) | No money/PII/floor exposed — it returns a boolean/count, never a price. Safe. |
| **Customer-isolation** | Single-tenant internal tool — every authenticated team member sees all customers (no per-customer tenant boundary). | **No cross-customer leak *within* the team**, but blob denormalization (renter names on units/categories, #267) means a **unit/category search reveals customer name + company** even to a role that lives mostly on the fleet cards. That is shipped + intended. **Hard obligation:** flag any change that would push a customer field **beyond name/company** (phone, email, address, account notes, spend) into a `units`/`categories` blob — those cards are reachable by fleet/mechanic roles who would not otherwise open the Customers card. → **Open Q 11.12**. |
| **Pricing-floor (`bottomDollar`/margin/true-cost)** | `bottomDollar` + margin are Admin/Office-visible only, and only inside detail views. | **Search blobs MUST NOT embed `bottomDollar`, margin, true-cost, or any cost-floor.** Verified today: `searchBlob` (app.js:742–822) omits all of them. **Caveat — money DOES appear in two blobs and that is intended:** `parts` folds `money(rec.priceEach)` and `expenses` folds `money(rec.amount)` (app.js:807, 813). These are **list-cost / receipt-amount fields already shown on the card face to every role that can open Parts/Expenses** — they are NOT a margin or a floor. The rule is precise: *card-visible* money may be in a blob; *role-gated* money (margin, bottomDollar, cost) may not. Any future "search by margin / below-floor" must be an exact-column `totColMatch` chip gated to the money tier, never a blob token. → **Open Q 11.7**. |
| **Money actions** | `canMoney()` = Office/Admin | Search never *takes* a money action — it only surfaces records; the action buttons inside a surfaced record keep their own `canMoney()` gate. Untouched. **Obligation:** any future "act on all matched rows" / bulk affordance off a search result would BE a money/mutation path and must re-assert the per-action gate, not inherit "you could see it" → **Open Q 11.13**. |
| **PII in transit** | Customer name/company/phone/email live in the customer record; the blob is in-memory only. | The blob is **never persisted to the backend** — only the *derived* Saved-View artifact (`{name, search, terms}`) is synced, and **a view stores the user's typed query/chip labels, not record data**. A view named/filtered on a customer name will carry that string to the Views Sheet. Acceptable (team-internal, already in the customer record) but **noted**: do not let a future view capture *resolved record IDs or blob fragments* — keep views to query text + chips only. → reinforced in §4.2. |

### 3.2 The hard rule (restated, load-bearing)

> **Nothing role-restricted — margin, bottom-dollar, true-cost, secrets, or any field gated below the card it lives on — may enter a `searchBlob`.** Role-sensitive search MUST go through `totColMatch` exact-column chips that carry their own visibility gate (checked at chip-offer time AND at match time), never the free-text blob. When in doubt, surface the field as an Open Question and keep it OUT of the blob until Jac rules.

This rule is **not CI-enforced today** — there is no automated guard that a new `searchBlob` case omits a gated field. → **Open Q 11.14** asks whether to add a lint. Until then it is a **review-gate**: any PR touching `searchBlob` must be read against this rule by a human (per CLAUDE.md auto-delegation, a `searchBlob` change is a data-gate edit and **stays on the main session**, not delegated).

---

## 4. Data Model

### 4.1 Existing entities (no change to stored records)

Search/Views adds **no new persisted entity fields** today. It reads the 11 entity collections and derives:

| Structure | Where it lives | Shape | Lifecycle |
|---|---|---|---|
| `IDX.search` | in-memory (`app.js`) | `Map<"card:id", lowercased blob>` | rebuilt on boot; per-record via `reindex` |
| `IDX.unitRenters` / `IDX.catRenters` | in-memory | `Map<id, Set<renterTag>>` | rebuilt via `buildRentalLinkIndex` on any rental link change |
| `cs.search` | `state` session, per card | string | volatile (per session/tab) |
| `cs.filterTerms` | `state` session, per card | `[{ t, neg, col?, value? }]` | volatile |
| `cs.sort` | `state` session, per card | `{ field, dir }` | persisted per-card via `loadSort` (localStorage) |
| `state.query` / `state.filterTerms` | global `state` | string / `[{t,neg,...}]` | volatile |
| `state.datesearch` | global `state` | `{ scope, monthISO, anchor, start, end, editIndex }` | volatile (open picker only) |

### 4.2 Saved Views — the one persisted Search artifact

```js
// GLOBAL_VIEWS  (one shared object, synced)
{
  units:     [ { name, search, terms:[{t,neg,col?,value?}] }, … ],
  rentals:   [ … ],
  customers: [ … ],
  // … one array per VIEW_CARDS entry
}
```

- Stored in `localStorage['jactec.views.all']` (`VIEWS_LS_ALL`) and mirrored to the backend Views Sheet (`getViews`/`setViews`).
- A one-time migration folds legacy per-card keys (`jactec.views.<card>`) into the unified map (`app.js:11539`).
- **Schema-less / additive note:** because the backend stores the whole `views` object opaquely (a JSON blob in a Sheet cell), adding a field to a saved view (e.g. `sort`, `owner`) is a **frontend-only** change — `setViews` already round-trips the object verbatim. No backend migration needed for Open Q 11.1/11.4.
- **PII boundary (from §3.1):** a view captures **only the user's typed query string + chip labels** (`{ name, search, terms }`), never resolved record IDs, never blob fragments, never a customer record. A view named/filtered "bamba" carries the literal string "bamba" to the Views Sheet — acceptable (team-internal, already in the customer record). **Invariant to preserve:** no phase may extend the view shape to capture record content (IDs, denormalized renter tags, money). Sort (Phase 1) and owner (Phase 4) are query-state, not record-state — they keep the invariant.

### 4.3 Migration concerns

- Adding `sort` to saved views: old views (no `sort`) must apply cleanly — treat missing `sort` as "leave current sort" (don't reset). Backward-safe.
- Adding `owner`/private views: would require a per-user identity that the single-team-password model doesn't have today (see backend-data D3). **Blocked on identity — Open Q 11.4.**

---

## 5. Backend / Integration Contract

Search itself is **client-side**; the only backend touchpoints are the two Views actions on the single `backendCall` entry point (`app.js:15650`, see `backend-data` §2).

### 5.1 Existing actions (shipped)

| Action | Direction | Payload | Returns | Auth | Failure handling |
|---|---|---|---|---|---|
| `getViews` | pull (boot) | `{ action, password }` | `{ ok:true, views:{…} }` or `{ ok:false }` | team password (the single `backendPassword`) | unknown-action / offline / `!ok` / non-object `views` → **keep the localStorage mirror, surface no error** (`loadGlobalViews` app.js:11551–11553). The app is always usable from the mirror; the server is an enhancement, never a hard dependency. |
| `setViews` | push (on any curate) | `{ action, password, views }` | `{ ok:true }` (ignored) | team password | offline / throw → **silent catch**; the local write already landed and `pushViewsToBackend` re-fires on the *next* curate (`app.js:11555–11557`). A view created offline survives in localStorage and syncs up on the next change while online. |

**Contract details & failure modes (be conservative):**

- **No partial / no patch.** `setViews` always pushes the **entire** `GLOBAL_VIEWS` object — last-write-wins, no field-level merge (`pushViewsToBackend` app.js:11557). Two admins curating on two devices race; the last `setViews` wins and silently overwrites the other's add/delete. → **Open Q 11.5** (accept LWW for a single team, or add a merge/version token?).
- **Curate gate is client-side ONLY.** `adminUnlocked()` guards `js-addview`/`js-delview` in the UI (`openViewMenu` app.js:11588), but **the backend `setViews` does not check role** — a crafted `backendCall('setViews', …)` from the console would persist. Consistent with the whole backend (no server-side role enforcement anywhere today, backend-data D3), so closing it *here only* would be inconsistent and out of this area's blast radius. → **Open Q 11.6** (carry role on `setViews` for server enforcement, or leave it to a backend-wide gate effort?). **Do not silently rely on the client gate as a security boundary** — it is a UX gate; treat the Views Sheet as tamperable by anyone with the team password.
- **Dropped/duplicate sync.** `setViews` is fire-and-forget (no ack used). If a push silently fails *and no further curate happens*, the server stays stale until the next change or the next boot's `getViews` (which would then *pull the stale server over the good local* if the server were the one that's fresh — but here the local is the fresh side, so the next curate re-pushes). Net: eventual consistency, LWW, no data loss locally. Acceptable for a single team; flagged for multi-device → 11.5.
- **Offline boot.** With no `backendPassword` (demo) `getViews`/`setViews` both no-op (`app.js:11552`/`11556`) and the app runs entirely off the localStorage mirror — Views still apply, just don't sync.
- **Payload size.** The whole views object travels on every curate. At realistic counts (a handful of views per card) this is small; if Views ever balloon, revisit a delta action (not needed Phase 1).

### 5.2 Proposed additive actions (only if a phase needs them)

None required for Phase 1 (sort-in-views is frontend-only per §4.2). If per-user/private views ship (Open Q 11.4), a `setUserViews`/`getUserViews` pair keyed by an authenticated user id would be the additive contract — **defer until identity exists**.

### 5.3 External integrations

None. Search does not call Stripe / Maps / Wrangler AI. (The Wrangler AI assistant has its own search-like retrieval; out of scope here — owned by `wrangler-ai`.)

---

## 6. UX / UI — yard data-plate language

All search UI lives in the toolbar + each card's list-bar and already reads in the house language: dark steel panels, the search glyph stamped in, Saira-condensed chip labels, the safety-orange `--accent` reserved for chrome (the focused-card border, the active-view "viewing" state). New/changed UI below MUST be run through `/jactec-ui` and stamped per the R-rulebook.

### 6.1 Global search bar (shipped) — `headerEl` `app.js:7387`

`.searchwrap` carries the stamped search icon, the pinned `filterTermPill`s, the `#globalsearch` input ("Search everything…" / "Add filter — type, Enter to pin…"), and a clear-X. `has-terms`/`has-query` classes drive the lit state. **R-stamp:** "Global search + filters" is already a catalogued toolbar element (`app.js:9855`). Any reshape re-stamps `data-r` and regenerates `rule-usage.js`.

### 6.2 Per-card list-bar (shipped) — `app.js:6749`

Cascade chip (`🔗`), pinned chips, mini-search input, the Views & Sort button, the asc/desc toggle. Empty state: a card filtered to zero shows the `.empty` plate; `customers`/`units`/`categories` add the **+New “query”** big button (a yard "round one up" affordance — ranch-twist copy candidate, **Open Q 11.8**).

### 6.3 Filter-term chip (shipped) — `filterTermPill` `app.js:2493`

A stamped pill: leading ○ NOT-toggle (→ red `−` when excluding), label, whole-pill click-to-remove. Date chips (`is-date`) re-open the picker on click instead of removing. Severity/leather-tan accents not used here (chips stay neutral steel; the NOT state borrows `--red`).

### 6.4 Date/range picker (shipped) — `dateSearchEl` `app.js:15227`

A floating `.winpicker.datesearch` plate: "Filter by date" kicker, selected-range read-out, month nav `‹ ›`, the `.wp-grid` day grid (reuses the rental-window grid styling — rivets/hazard not added; it inherits the window picker's plate), and a foot row of `Today` / `Clear` ghost pills + a `Done` action pill. **On phones** it mounts as a bottom sheet (`sheet-open`, tap-backdrop to dismiss). States: empty ("Pick a day · or a range"), single-day, range (drag either direction).

> **WINDOW_CATALOG:** the date picker is a `state.datesearch` **float, not an overlay `kind`**, so it is intentionally **absent from `WINDOW_CATALOG`** (which catalogs `buildPopupEl` overlays). `ci/check-window-catalog.mjs` only guards overlay kinds, so this is correct today. **If any future change converts the picker to an overlay `kind`, it MUST be added to `WINDOW_CATALOG`** or CI fails. (Open Q 11.9 asks whether to catalog it anyway as a "window" for the Rulebook's Windows tab.)

### 6.5 Views & Sort dropdown (shipped) — `openViewMenu` `app.js:11582`

A right-aligned dropdown: an "Add view “…”" row (Admin + filter-active + not-already-a-view), a **Views** section (each `js-applyview`, with a ✓ when active and an Admin delete-X), a **Sort** section (every `SORT_FIELDS[card]` entry), and on invoices a **Payment Method** section. Stamped dropdown items.

### 6.6 Proposed UI (per phase — all subject to `/jactec-ui`)

- **Sort-in-Views (Phase 1):** add a "↕ Sort: <field> <dir>" hint line under the Add-view row so the curator sees that sort will be captured. **R-stamp + no new popup.**
- **Mobile reflow:** the global bar already collapses into the phone header; chips wrap. No new mobile work for Phase 1 beyond verifying chip-wrap + the date sheet (already shipped per `2026-06-14-mobile-adaptive-design.md`).

### 6.7 States

| State | Treatment |
|---|---|
| Empty (no query) | full lists, no chips, placeholder "Search everything…" |
| Typing | live substring filter, list re-windows from top |
| Zero results | `.empty` plate; quick-add affordance on customer/unit/category |
| Loading | N/A — index is in-memory, synchronous; no spinner |
| Error | search never errors; a stale blob (missing reindex) is the only failure mode → §10 |
| Offline | search fully works (in-memory); Views fall back to localStorage |

---

## 7. Business Rules / Derivations

Search has **no money math**, but it has precise derivation rules that must not drift:

1. **Blob = lowercased join of `searchBlob(card,rec)` parts**, `.filter(Boolean).join(' ').toLowerCase()` (`app.js:822`). Order is irrelevant (substring match). Falsy parts dropped.
2. **Live query** = one trimmed lowercased substring. Empty query matches all.
3. **Chip AND**: every positive chip present, every NOT chip absent (`blobMatches`).
4. **Column chip exact-match** (`totColMatch`): `String(col.get(rec)) === String(value)` for real columns; virtual `__*` columns have bespoke predicates (§2.4). Same-column positives OR; cross-column AND; any-column NOT excludes.
5. **Availability token** (`rowMatches`): evaluated against `availWin` via the live availability lens, NOT blob text; stripped from the residual text query; units/categories only.
6. **Date term** (`recordDateMatch`): rentals = window overlap `start <= qTo && end >= qFrom`; point-dated cards = any owned date in `[qFrom,qTo]`; invoices test issued OR due; stripped on date-less cards.
7. **Reverse renters** (#267): `IDX.unitRenters`/`IDX.catRenters` keep unit/category blobs current with renter names; rebuilt on any rental link change.
8. **Views capture** = `viewSig(search, terms)` = `JSON.stringify([trimmed-lowercased search, sorted (neg-prefixed) term tokens])`. **Sort is excluded today** (the canon gap this spec proposes to close — §8).
9. **List windowing**: any search/filter change resets `listLimit` to the default 60-row window (`resetListLimits`).

**Edge cases (current behavior, documented as canon):**
- A query that is purely the availability/date keyword filters by the live lens, not text.
- A blob can be stale if a derived label changes without a `reindex` (e.g. status flips via a path that forgets to reindex) — see §10.
- Two views with the same sig but different names can both exist (dedup is by name on add, not by sig).

---

## 8. Phasing & Milestones

Because this area is **shipped**, "phasing" = the backlog of confirmed-or-proposed improvements, not a greenfield build. **Phase 1 is the only build proposed for v1; the rest are deferred pending Jac.**

### Phase 1 — MVP (the one confirmed gap): **Views capture sort**
- Add `sort: { field, dir }` to the saved-view shape when an Admin adds a view.
- `applyView` restores `cs.sort` when present; **missing `sort` = leave current sort** (backward-safe, §4.3).
- Update `viewSig`? **No** — keep the sig keyed on search+terms only so a view still "matches" regardless of sort (the active-view ✓ shouldn't drop just because the user nudged sort). Surfacing sort in the menu hint per §6.6.
- Frontend-only; `setViews` round-trips the new field verbatim (§4.2). No backend change.
- **In scope:** the shape change, apply logic, menu hint, CI gates.
- **Out of scope for v1:** per-user views, relevance ranking, text operators, search history, `-prefix` NOT.

### Phase 2 — Relevance ordering *(proposed, Open Q 11.2)*
Optional match-quality sort in *global* search mode (exact-name > field-start > substring), without disturbing per-card explicit sort.

### Phase 3 — Text operators *(proposed, Open Q 11.3)*
Quoted phrases and a `-prefix` NOT in free text, to reduce reliance on the chip toggle.

### Phase 4 — Per-user / private views *(proposed, Open Q 11.4)*
Blocked on user identity (single team password today). Additive backend action when unblocked.

---

## 9. Acceptance Criteria

Phase 1 (Views capture sort) — each criterion is independently testable:

1. **Capture + restore.** Admin builds a filter, sorts a card (e.g. invoices by Balance ↓), "Add view" → reopening that view on a fresh session restores **search + chips + sort field + direction** together.
2. **Backward-safe.** A **legacy view with no `sort` key** applies without error and **does not reset** the current sort (missing `sort` = "leave current sort", per §4.3). Assert in a logic-test against a fixture view lacking `sort`.
3. **Curate gate held.** A non-admin (`adminUnlocked()===false`) can **apply** the view incl. its sort but sees **no Add/Delete affordance** (`js-addview`/`js-delview` absent in `openViewMenu` output). A direct `saveViews(...)` from a non-admin path must not exist in the UI wiring.
4. **Backend round-trip, zero backend change.** `getViews`/`setViews` round-trip the new `sort` field verbatim (the object survives a save→reload) with **no Code.gs edit** — proves the schema-less/additive claim (§4.2).
5. **Sig stability.** The active-view ✓ still lights when search+terms match, **regardless of sort** — nudging sort after applying a view does NOT drop the ✓ (`viewSig` unchanged, keyed on search+terms only, app.js:11561).
6. **Offline.** Applying a view (incl. sort) works from the localStorage mirror with no network.
7. **No floor/PII regression (standing criterion, every phase).** A grep/inspection of every `searchBlob` case confirms no `bottomDollar`/margin/true-cost/cost token entered any blob, and no customer field beyond name/company reached a `units`/`categories` blob. (Manual review gate per §3.2 until 11.14 lands a lint.)

**CI-gate impact:**

- `ci/gen-rule-usage.mjs --check` — **regenerate** `rule-usage.js` (drop `--check`) if the Views menu / the new "↕ Sort: …" hint line gains any `data-r`-stamped element; the drift + duplicate-rule guard fails CI otherwise.
- `ci/check-window-catalog.mjs` — **no change expected** (no new `buildPopupEl` overlay kind; the date picker stays a `state.datesearch` float). If any phase converts the date picker to an overlay `kind`, this gate fires — add the `WINDOW_CATALOG` entry in the same PR.
- `tools/gen-code-map.mjs --check` — **regenerate** only if an `APP-xx` chapter banner is added/moved/retitled (none planned for Phase 1).
- `ci/logic-test.mjs` — **add** a logic-test asserting `applyView` (a) restores `cs.sort.field`/`dir` when present and (b) tolerates a missing `sort` without touching the current sort. Port-swap `8000→9147` per CLAUDE.md before running, then `git checkout -- ci/`.
- `ci/smoke.mjs` — must stay green (search bar renders, a query filters, a view applies). Port-swap as above.

**CI-gate impact:**
- `ci/gen-rule-usage.mjs --check` — regenerate `rule-usage.js` if the Views menu / hint gains any `data-r`-stamped element.
- `ci/check-window-catalog.mjs` — **no change expected** (no new overlay kind). If a phase converts the date picker to an overlay, this gate fires — add the entry.
- `tools/gen-code-map.mjs --check` — regenerate if an `APP-xx` chapter banner moves/retitles (none planned for Phase 1).
- `ci/smoke.mjs` / `ci/logic-test.mjs` — add a logic-test asserting `applyView` restores sort and tolerates a missing `sort` (port-swap 8000→9147 per CLAUDE.md before running).

---

## 10. Risks & Edge Cases

| Risk | Class | Detail | Mitigation |
|---|---|---|---|
| **Stale blob** | data-integrity | A field/label changes via a mutation path that forgets `reindex`/`reindexRentalLinks` → search silently misses (or wrongly surfaces) the record. The blob is denormalized cache; any un-reindexed write diverges it from truth. | Every create/edit site must call `reindex(card, rec)`; `buildIndexes()` on load is the full-rebuild backstop. **Standing audit:** when adding a mutation path, confirm a `reindex` follows. Reverse-renter blobs (units/categories) depend on `reindexRentalLinks` firing on rental link changes (`reindex` calls it for `rentals` unless `suppressLinkReindex`). Debug entry: `APP-03`. |
| **Margin / cost-floor leak into a blob** | **security** | A future "search by X" tempts adding `bottomDollar`/true-cost/margin to a blob → instantly readable by **every team member + every role** via free text, bypassing the detail-view gate. | **Hard rule §3.2**: role-gated money goes through gated `totColMatch` exact-column chips (gate at offer + at match), never the blob. `searchBlob` changes stay on the main session (not delegated) and are reviewed against §3.2. No CI lint today → **Open Q 11.14**. |
| **Customer field over-exposure on fleet cards** | **security / PII** | Reverse denorm puts customer **name+company** on units/categories (intended, #267); a careless extension could push phone/email/address/notes there, exposing them to fleet/mechanic roles that never open Customers. | Cap the reverse tag at name+company (the current `renterTag`); any widening is an explicit gate decision → **Open Q 11.12**. |
| **Views last-write-wins race** | multi-user | Two admins curate on two devices; `setViews` overwrites the whole object — silent loss of the other's add/delete. | Phase-defer a merge/version token (Open Q 11.5); today accept LWW (low contention, single team). No data loss locally (the local mirror is the fresh side). |
| **Client-only curate gate tampering** | security | `setViews` is unguarded server-side; the Admin gate is UX-only. Anyone with the team password could persist views from the console. | Documented as a UX gate, not a security boundary (§5.1). Server enforcement is a backend-wide effort → Open Q 11.6. Blast radius is low (views are query-state, not money/record data). |
| **Performance at scale** | performance | Substring scan over every record's (long) blob per keystroke — activity logs + line items make blobs large; fine at ~150–500 records. | In-memory `Map`; `render()` re-windows each card to a 60-row limit on every query change (`resetListLimits`). The scan is O(records × blob-len) per keystroke with no debounce on the filter itself. If records grow 10×, revisit (pre-tokenize / trie / input debounce) → Open Q 11.10 (cross-ref `frontend-performance`). |
| **Availability token cost** | performance | When the token is active, the avail lens runs `isUnitAvailableFor`/`categoryAvailableCount` **per row, per render** under the in-scope window. | Bounded to units/categories under one window; acceptable now. Each is itself a scan over rentals — watch if both fleet and rental volume grow together. |
| **Multi-user / offline divergence** | multi-user / offline | A device edits a view offline; on reconnect its next curate overwrites the server, or another device's later curate overwrites it. | localStorage mirror + push-on-next-change; eventual LWW. No local loss; cross-device loss is the 11.5 trade. |
| **Sort-restore stomps a deliberate sort (Phase 1)** | data-integrity / UX | Applying a view that carries `sort` will overwrite a sort the user just set by hand — surprising if they applied the view only for its filter. | Spec'd behavior: applying a view IS "restore the saved state," sort included; legacy (no-sort) views never stomp (criterion 2). If the stomp proves annoying, a future "apply filter only" modifier is the escape — not in v1. |
| **NOT-toggle discoverability** | UX | NOT is a chip ○-toggle, not a `-` prefix — users may not find it. | Phase 3 text operators (Open Q 11.3); the toggle tooltip ("Including — click to exclude") explains it inline today. |
| **Date-term silent no-op confuses** | UX / correctness | A `__date` chip on a date-less card is *stripped* (filters neither in nor out) — a user may expect it to exclude undated rows. | Documented canon (§2.6/§7); intentional. If users read it as a bug, surface the stripped-card list in the chip tooltip → minor follow-up, not v1. |

---

## 11. Open Questions (for Jac)

> **Resolved 2026-06-29:** 11.1 → D1 (views capture sort) · 11.4/11.6 → D2 (personal "my views", shared set removed, server-keyed by per-role identity) · 11.2 → D3 (keep substring). Adopted: 11.3/11.5/11.7/11.10/11.12/11.13/11.14. See the Decisions block up top.

> No seed questions were captured for this area; all below are generated from reading the code. 11.12–11.14 are the gate/security forks surfaced while hardening §3/§5/§10 — answer these before any blob, view-shape, or bulk-action change ships.

| # | Question | Trade-offs |
|---|---|---|
| 11.1 | **Should Views capture sort?** (Phase 1) | The roadmap flags it as the one gap. **Pro:** a saved view is "complete" — same rows AND same order. **Con:** changes the saved shape (backward-safe per §4.2) and raises 11.2 (does sig include sort?). *Spec's lean: yes, capture sort, sig unchanged.* |
| 11.2 | **Relevance ranking in global search?** | Substring match is binary today; results show in each card's `cs.sort` order. **Pro:** exact-name hits float to top. **Con:** competes with explicit per-card sort; needs a scoring pass per keystroke. Scope to *global* mode only? Or skip entirely? |
| 11.3 | **Add `-prefix` NOT + quoted phrases in free text?** | **Pro:** power users type `unpaid -quote "lake charles"` in one go. **Con:** a real `-` or `"` in a name now means something; needs an escape rule; the chip toggle already covers NOT. Worth the parser? |
| 11.4 | **Per-user / private views vs. the one shared set?** | **Pro:** a mechanic's "my open WOs" doesn't clutter everyone. **Con:** blocked on user identity (single team password, backend-data D3) and a new backend action. Defer until identity ships, or build a localStorage-only "my views" now? |
| 11.5 | **`setViews` race — last-write-wins or merge?** | Today whole-object overwrite. **Pro of merge:** two admins don't clobber. **Con:** merge logic + conflict rules for same-named views. Given one team, is last-write-wins acceptable indefinitely? |
| 11.6 | **Server-side gate on `setViews`?** | Curate is Admin client-side only (D3). **Pro:** server enforcement closes a tamper path. **Con:** the backend has no role enforcement anywhere today; doing it here is inconsistent and out of this area's blast radius. Leave client-side? |
| 11.7 | **Any role-gated search columns (e.g. "by margin", "below bottom-dollar")?** | If yes, they MUST be exact-column `totColMatch` chips gated to money/admin — **never** blob tokens (§3). Does Jac want margin/bottom-dollar as a *filter* at all, and if so for which roles? |
| 11.8 | **Ranch-twist copy on the quick-add affordance?** | "+New “query”" could read "Round up “query”" / "Rope in “query”". **Pro:** on-brand voice. **Con:** less literal. Apply the wrangler vernacular here, or keep it plain? |
| 11.9 | **Catalog the date picker as a "Window" in the Rulebook?** | It's a float, not an overlay `kind`, so it's correctly absent from `WINDOW_CATALOG` and uncovered by `check-window-catalog`. **Pro of listing:** the Rulebook's Windows tab shows every screen. **Con:** it isn't a `buildPopupEl` overlay; cataloging it needs a synthetic entry. List it, or leave it as a documented exception? |
| 11.10 | **Index strategy if record count grows 10×?** | Substring-over-full-blob is fine now. At thousands of records the long blobs (activity logs, line items) could lag per-keystroke. Pre-tokenize / trie / debounce — worth speccing now or wait for the symptom? (Cross-ref `frontend-performance`.) |
| 11.11 | **Should the availability token also work on `rentals`?** | Today it's units/categories only. A dispatcher might want "rentals … available" to mean something — but availability is a unit/category property. Likely no, but confirm the scope is intentional. |
| 11.12 | **Cap the reverse-renter denorm at name+company?** | Today `renterTag` = `"<name> <company>"` on unit/category blobs (#267), so a fleet/mechanic role searching the Units card surfaces customer name+company. **Pro of holding the cap:** mechanics get a "who's had this unit" search without phone/email/address/notes leaking to a role that never opens Customers. **Con of widening:** richer cross-search (search a unit by a customer's phone) — but that pushes PII onto fleet cards. *Spec's lean: keep the cap at name+company; widening is a deliberate gate decision, not a convenience tweak.* |
| 11.13 | **Will any "act on all matched rows" / bulk affordance ever hang off a search result?** | Search is read-only today; the gate lives in each surfaced record's own buttons (`canMoney()` etc.). **Pro of a bulk action:** "select all unpaid → remind" is powerful. **Con:** it would be a money/mutation path that must re-assert the per-action gate (Office/Admin), NOT inherit "you could see these rows." If yes, spec the gate explicitly before building; if no, keep search strictly read-only. |
| 11.14 | **Add a CI lint that a `searchBlob` case never folds a gated field?** | The §3.2 hard rule (no margin/bottomDollar/true-cost/cost in any blob; customer fields on units/categories capped) is a **human review-gate today** — nothing fails CI if a future blob folds `rec.bottomDollar`. **Pro of a lint:** the security invariant becomes unskippable like the R-rulebook gates. **Con:** a denylist is brittle (must enumerate every gated field name) and may false-positive on legitimately-card-visible money (`priceEach`, `amount`). Worth a `ci/check-search-blob.mjs`, or keep it review-only with the §3.2 rule as the standing instruction? |

---

## 12. Dependencies & Sequencing

**Depends on** (roadmap): all entity cards (each `searchBlob` case), **`design-system`** (the yard data-plate chip/picker styling + R-rulebook), **`frontend-performance`** (the in-memory index + render windowing), **`backend-data`** (the `getViews`/`setViews` actions + the single `backendCall` entry, diff-sync, offline mirror).

**Tightly coupled to:**
- `cascade.js` / the anchor engine — the cascade pill is jointly owned; a change to cascade scoping changes what a per-card search filters.
- **`flag-color-system`** (`docs/specs/flag-color-system.md`) — search surfaces records but does NOT compute their pill color; that's the flag system. No conflict, but the two are read together in list rows.

**Must land first for each phase:**
- Phase 1 (sort-in-views): nothing — frontend-only, `setViews` already round-trips opaquely.
- Phase 4 (per-user views): **user identity** must exist first (currently a single team password — see `backend-data` D3 and the `role-system-redesign` design doc). Block until then.

**Downstream consumers:** the roadmap notes `wrangler-ai` and `frontend-performance` depend on `search-views` (the assistant reuses the index concept; perf owns its speed). Coordinate any index-shape change with both.
