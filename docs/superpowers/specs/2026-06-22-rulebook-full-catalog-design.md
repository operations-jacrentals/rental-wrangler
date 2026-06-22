# R-Rulebook "Windows" catalog — design spec

- **Date:** 2026-06-22
- **Status:** Approved design — ready for implementation plan (`/writing-plans`)
- **Branch:** `design-system/rulebook-full-catalog` (off `area/design-system`)
- **Area:** `area/design-system` (owns the R-Rulebook, popups/dialogs, the Design Inspector)

## Problem

The R-Rulebook today documents the *style rules* for a popup or dropdown (the
Containers tab's `overlay-popup` / `header-popup` / `menu-dropdown` foundation
rows; `R1` gate-pill dropdown, `R20` context menu, `R22` date picker). It does
**not** inventory the actual instances. There are ~28 distinct popup windows
(the `o.kind === '…'` render branches in `renderOverlay()`), plus the forms and
dropdowns inside them — none of which are listed. Jac uses the Rulebook as the
map he edits screens from, so the gap means he can't find/edit a given popup
quickly.

**Goal:** an admin-only catalog inside the R-Rulebook that lists *every* popup
window (forms + dropdowns nested), each with a live inline preview on
row-expand, its code location, and a one-click copy-for-Claude edit reference —
so any screen is fast to find and edit. It must stay current automatically.

## Decisions locked (with Jac, 2026-06-22)

1. **Full live previews** of each popup (not just a text listing) — the genuine
   rendered popup, inline.
2. **Admin-only** — rides the existing dev-tools gate; users never load it.
3. **Organized by window**, with each window's forms/dropdowns shown in its
   preview, plus a **standalone section** for surfaces not in a popup.
4. **Each entry carries**: name, derived field list, code location, AND a
   one-click "copy edit reference" (Claude-ready locator).
5. **Click a row to expand** → the preview renders on demand (lightest).
6. **Inline preview via refactor** — extract `buildPopupEl(o)` and reuse it
   (true single-source; previews can't drift).
7. **Admin gate simplified to role-only** — drop the passphrase path.
8. **Stay-current enforced in three layers** — CI drift guard (hard stop),
   CLAUDE.md standing rule (always loaded), `/start` pointer.

## Architecture

### 1. `buildPopupEl(o)` refactor — the enabler

`renderOverlay()` (app.js:6991) is already three phases:

- **Pre** (6992–7000): `syncBackGuard`, scroll-save into `_ovScroll`,
  `destroyCardElement`, clear `#overlay-root`, early-return if no overlay,
  create the `.overlay` div + its backdrop `mousedown`→`closeOverlay` handler.
- **Builder** (7002–7670): the `if (o.kind === …)` chain — each branch builds a
  `.popup` element (`pop`) and does `overlay.appendChild(pop)`.
- **Post** (7671–7679): `root.appendChild(overlay)`, scroll-restore, set
  `_ovLastKind`, then the **live side-effects**: `partform` autofocus,
  `newCustomer`→`setupSignaturePad`, `payment`→`setupPayAlloc`,
  `addCard`/`newCustomer.cardSub`→`mountCardElement` (Stripe), `.ag-cam-feed`→
  `startAgCam`.

**Change:** extract the Builder chain into a pure
`function buildPopupEl(o) { … return pop; }` — every `overlay.appendChild(pop)`
becomes `return pop`. `renderOverlay()` becomes:

```js
const pop = buildPopupEl(o);
overlay.appendChild(pop);
// …unchanged post phase (root.appendChild, scroll-restore, live side-effects)…
```

`buildPopupEl` only reads data + builds DOM — **no global side-effects**. The
live side-effects (Stripe mount, camera, autofocus, scroll-restore) stay in
`renderOverlay`'s post phase and therefore **never run for an inert preview**.
Behavior of the real overlay is byte-for-byte unchanged — guarded by
`node ci/smoke.mjs` + `node ci/logic-test.mjs`.

**Edge case — in-branch focus side-effects.** A few branches call
`setTimeout(() => pop.querySelector(...).focus(), 0)` inline (e.g. `comment`,
app.js:7046). `buildPopupEl` takes an optional `{ preview: true }` flag; in
preview mode those inline focus/timer calls are skipped (guard the call sites on
`!opts.preview`). Default (real overlay) behavior is unchanged.

### 2. `WINDOW_CATALOG` registry + sample resolver

A small registry, one entry per popup kind:

```js
const WINDOW_CATALOG = [
  { kind: 'partform',    label: 'Add / Edit Part · Task', tag: 'Work order · line',
    sample: () => ({ woId: DATA.workOrders[0]?.woId }) },
  { kind: 'payment',     label: 'Take Payment',          tag: 'Invoice · payment',
    sample: () => ({ invoiceId: DATA.invoices[0]?.invoiceId }) },
  // …one line per kind (~28)…
];
```

- `sample()` returns the **args** for a representative `o` built from demo seed
  data (`DATA.*`). The preview builds `o = { kind, ...sample() }`.
- `sample()` is the only hand-authored part. It is allowed to return `{}` for
  kinds that need no record (e.g. `qr`, `hotkeys`, `feedback`).
- **No suitable demo record** → `sample()` returns a value that the row treats
  as "not previewable here"; the row still shows label + location + copy-ref,
  with a muted "No demo record to preview" note instead of the well. (No popup
  kind is omitted from the catalog — the guard in §6 enforces that.)

### 3. Runtime-derived field list (drift-proof by construction)

The per-window **fields / forms / dropdowns** are NOT stored. When a row's
preview is built, introspect the built `pop` element and enumerate:

- inputs/forms: `.lf-in`, `input`, `textarea`, `.file-drop`, the add-buttons
  (`.add-field` etc.);
- dropdowns: `select`, plus gate-pills (`R1`) / menus present in the popup.

Render that as the field index for the row. Because it's read off the real
rendered popup, it can never disagree with what the popup actually shows.

### 4. The "Windows" tab + row anatomy

- New `RB_TABS` entry appended after "Data & Behaviors":
  `{ id: 'windows', label: 'Windows', intro: '…', items: [...] }`. (Label is
  easy to change.)
- **Collapsed row:** `label · tag · 📋 copy-ref`. (No field count here — the
  field list is derived from the built preview DOM per §3, which only exists once
  the row is expanded; counting it for a collapsed row would mean building every
  popup up front, defeating lazy render.)
- **Expanded row** adds:
  - **Derived field list** (§3) — fields/forms/dropdowns read off the built
    preview DOM.
  - **Live inline preview** — `buildPopupEl({ kind, ...sample(), preview: true })`
    mounted in a bordered "well," rendered on first expand only, then cached for
    that open of the Rulebook.
  - **Inert + safe:** the well is `pointer-events: none` with a small
    "PREVIEW — not live" stamp, so a `payment` preview's charge button (or any
    destructive/money/auth action) can NEVER fire. This is a hard safety
    requirement, not cosmetic.
  - **Code location:** `app.js · renderOverlay → o.kind === '<kind>'`.
  - **Copy edit reference (📋):** writes a Claude-ready locator to the
    clipboard, e.g. `Edit the "Add / Edit Part · Task" popup (renderOverlay →
    o.kind === 'partform') in app.js`. Reuses the Inspector's existing
    copy-to-clipboard mechanism.
- Lazy render: the preview for a row is built the first time it is expanded
  (matches "click a row to expand"); collapsing keeps the built node or drops it
  (implementation detail — default: keep until the Rulebook closes).

### 5. Standalone section (surfaces not in a popup)

A second group under the "Windows" tab for forms/dropdowns that aren't popups:

- inline card forms (e.g. Account edit fields, notes line),
- the global **search** box + **filter/sort** dropdowns + **saved-Views** menu,
- the right-click **context menu** (`R20`),
- **gate-pill status dropdowns** (`R1`).

Each gets label + code location + copy-ref, and a live preview where it is cheap
to render (a gate-pill or context menu renders trivially; inline card forms may
show location + copy-ref only). Exact membership is finalized during
implementation by scanning for these builders; the set above is the starting
list and Jac can adjust.

### 6. Admin gate → role-only

Simplify the dev-tools gate (app.js:10061–10078):

- **Remove:** `ADMIN_HASH`, `_cyrb53`, `_adminUnlock`, `toggleAdminLock`, and
  the `js-adminlock` lock/unlock bottom-bar button (app.js:5723).
- **`adminUnlocked()` becomes:** `return currentRole === 'Admin' || currentRole === 'Owner';`
- All dev-tool buttons (Lint, Inspector, Rulebook, Windows catalog) render only
  when that's true; normal accounts get nothing (already the case — this just
  removes the redundant passphrase path).
- **Untouched:** `requireAdmin()` (app.js:10081) — the backend-verified admin
  check for card/price overrides — is a different mechanism and stays.
- **Accepted caveat (Jac OK'd):** a no-login / demo session can no longer "peek"
  via passphrase; dev tools require an Admin/Owner login everywhere.

### 7. CI drift guard + the standing rule

- **New CI check** (extend `ci/gen-rule-usage.mjs`, or a sibling
  `ci/gen-window-catalog.mjs` wired into `.github/workflows/ci.yml` next to the
  existing "Rulebook field catalog is current" step): scan `renderOverlay` for
  every `o.kind === '…'` builder branch and **fail** if any kind has no
  `WINDOW_CATALOG` entry. Same `--check` drift-guard pattern already in use. This
  makes "every popup is listed" literally enforced over time.
- **CLAUDE.md:** generalize the existing R-rulebook gate line to an emphatic
  standing rule — *"ANY new or changed UI must keep the R-Rulebook current
  (data-r stamps + regenerated catalogs); the CI drift guards enforce it."*
  CLAUDE.md is auto-loaded every session, so this reaches all sessions/agents.
- **`/start`:** add a one-line pointer to that rule in its §4 working-rules /
  gate list.

### 8. Design-language pass

The new tab, rows, preview wells, and copy buttons are new UI → built through
`/jactec-ui` then `/frontend`, following the existing `rb-*` Rulebook styling
(dark steel, one orange accent, Saira Condensed stamps, rivets). New stamped
elements get `data-r` attributes per the rulebook; `rule-usage.js` regenerated
if rule usage changes.

## Data flow

1. Admin (role Admin/Owner) opens the Rulebook → "Windows" tab.
2. Tab renders the collapsed list from `WINDOW_CATALOG` + the standalone set.
3. Admin clicks a row → `o = { kind, ...sample(), preview: true }` →
   `buildPopupEl(o)` → inert preview mounted in the well; fields derived from the
   built DOM; location + copy-ref shown.
4. 📋 copy-ref → clipboard locator the admin pastes to Claude (or uses to open
   app.js directly).

## Error handling / edge cases

- **Inert previews:** `pointer-events: none` on the well — no real action can
  fire from a preview (money/auth safety).
- **No demo record for a kind:** row shows location + copy-ref + "No demo record
  to preview"; never omitted from the catalog.
- **In-branch focus/timers:** suppressed under `{ preview: true }`.
- **Demo vs backend:** previews build against `DATA.*` demo seed (always
  present); no backend call is made to render a preview.
- **`buildPopupEl` parity:** the only risk surface; covered by smoke +
  logic-test (real overlays must open/behave identically post-refactor).

## Testing

- `node ci/smoke.mjs` and `node ci/logic-test.mjs` pass (overlay behavior
  unchanged post-refactor). Port 8000 is reserved → swap to 9147 per CLAUDE.md
  before running, then `git checkout -- ci/`.
- `node ci/gen-rule-usage.mjs --check` passes; new window-catalog `--check`
  passes (and fails when a kind is removed from the registry — verify the guard
  actually trips).
- Manual: open Rulebook as Admin/Owner → Windows tab → expand several rows
  (partform, payment, newCustomer, inspection) → previews render inert, fields
  listed, copy-ref copies the right locator. Confirm a non-admin login shows no
  dev-tool buttons at all.

## Out of scope (YAGNI)

No search/filter inside the catalog, no editing from the catalog, no preview
thumbnails or always-on rendering, no per-field deep links. Just: list →
on-demand inert live preview → location → copy-ref.

## Files touched (anticipated)

- `app.js` — extract `buildPopupEl(o)`; `WINDOW_CATALOG` + sample resolver; the
  "Windows" `RB_TABS` entry + row/preview render; runtime field derivation;
  copy-ref handler; admin-gate simplification; bottom-bar button removal.
- `ci/gen-rule-usage.mjs` (or new `ci/gen-window-catalog.mjs`) + `.github/workflows/ci.yml`
  — the drift guard.
- `CLAUDE.md` — generalized standing rule.
- `.claude/skills/start/SKILL.md` — one-line pointer.
- `index.html` — `?v=` cache-bust bump on deploy (per CLAUDE.md).

## Risks

- **Refactor blast radius (primary):** `renderOverlay` is central; the extraction
  must preserve the pre/post phases exactly. Mitigated by the seam already being
  clean (post side-effects isolated at the tail) and by the CI gates.
- **Standalone-section scope creep:** keep it to the listed surfaces; expand only
  if Jac asks.
