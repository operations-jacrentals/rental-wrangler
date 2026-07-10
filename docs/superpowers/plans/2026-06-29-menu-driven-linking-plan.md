# Menu-driven record linking — implementation plan

**Spec:** `docs/superpowers/specs/2026-06-29-menu-driven-linking-design.md` (approved,
`/role`-audited). Build on `claude/mobile-drag-rows-items-8jooau`.

**Real hooks already in the code** (verified):
- `cardRecordAt(el)` (app.js ~2161) — element → `{card, recId, recType}`.
- `canMoney()` (~14257) = `!currentRole || roleTier(currentRole) >= tierRank('money')`
  — the exact Office/Owner gate; reuse for **+ Invoice**.
- `roleTier(currentRole)` / `tierRank(...)` — tier system for the **+ Customer** gate.
- `DROP_MATRIX` (~11826) + `dispatchDrop(payload, target)` (~12290) — validity gates
  + every link mutation, reusable outside a drag.
- `openCtxMenu(e, hit)` (~4231), `openCtxMenuAt` (~4254), `runCtxAction` (~4281).
- `I.*` library icons (`icons.js`); `tools/gen-icons.mjs` to add glyphs.

Each phase ends green on `node ci/smoke.mjs` + `node ci/logic-test.mjs` and a
Playwright drive at phone (390×844, hasTouch) + desktop.

---

## Phase 1 — Remove mobile drag (subtractive, isolated)
1. Delete the `is-phone` record-grab branch in `dragDown` (#408).
2. Delete the `armMenuTimer` `is-phone` no-op (#412) → the long-press menu fires on
   phone again.
3. Gate the touch-arm paths (`dragDown`/`dragMove` touch branch, `armReadyTimer`,
   the `ghostLift` pop + pickup `haptic`) to **non-phone** only; remove phone
   zip-zones (`buildZipZones`, `phoneDragEdge`) and the `.is-phone .grid` selection
   suppression (#411) if nothing else needs it. Keep the desktop **mouse** path
   intact.
**Verify:** desktop mouse-drag still links; phone long-press opens the R20 menu;
no console errors; smoke + logic green.

## Phase 2 — Role-gated link-action derivation (pure fn, unit-testable)
1. `linkActionsFor(srcCard, rec)` → array of `{target, label, icon, gate}`:
   - base = `Object.keys(DROP_MATRIX[srcCard] || {})`.
   - omit a target type if its source-level precondition can't hold now (e.g.
     unit→invoice needs `unbilledOpenWOForUnit(rec)`).
   - **role gate (B1):** `invoices` target → `canMoney()`; `customers` target →
     customer-PII capability (`roleTier ≥ tierRank('sales')` or the customer-card
     entitlement — confirm the exact rank at build); operational targets → their
     tier. Drop any the role can't perform.
   - labels: terse `+ Rental` / `+ Invoice` / `+ Customer` / `+ Unit`; icons `I.*`.
2. Unit special: append **`+ Work Order`** only for `srcCard === 'units'` (create,
   not link).
**Verify:** add a `window.__rw` seam assertion in logic-test — `linkActionsFor`
returns the right set per type and is empty/trimmed for low-tier roles.

## Phase 3 — Surface actions in the R20 menu
1. In `openCtxMenu`, resolve the record via `cardRecordAt(hit.el)`; if it resolves
   and `linkActionsFor` is non-empty, render a **Link section** at the top
   (`data-ctx="link:<target>"`), `menu-sep`, then the existing items.
2. `runCtxAction`: handle `link:<target>` → `enterLinking(...)`;
   `link:workOrder` on a unit → navigate to that unit's record (standard view).
**Verify:** right-click each record type shows the correct actions; low-tier role
(simulate via `currentRole`) hides + Invoice/+ Customer.

## Phase 4 — Linking mode (state + banner + target-card behavior)
1. `state.linking = { srcCard, srcId, srcType, targetCard }`; `enterLinking()` sets
   it, navigates to `targetCard` in list+search (phone: flip active column), focuses
   search, `render()`.
2. **Banner** at the target card top while linking (hazard-stripe, `data-r`
   stamped): *"Linking ‹src title› → pick a ‹target› (or +New)"* + Cancel (R18
   ghost → clears `state.linking`).
3. **Row tap interception:** in the click handler, if `state.linking` and the row's
   card === `targetCard`, a row tap → `openLinkConfirm(targetRec)` instead of
   navigating. Per-row `DROP_MATRIX` gate → invalid rows get `is-disabled` + a
   reason toast on tap.
4. **+New auto-flow:** when `state.linking` is active, the card's +New create path
   routes the new record into `openLinkConfirm`.
5. Clear linking on: confirm done, Cancel, Esc/back, dock nav away.
**Verify:** action → lands on target card with banner + search; valid row →
confirm; invalid dimmed; +New → confirm; Cancel/Esc clears.

## Phase 5 — Confirmation popup
1. `openLinkConfirm(targetRec)`: `openOverlay({kind:'linkConfirm', ...})`. Body names
   both records; **invoice target → show customer-facing PRICE only** (compute via
   the same path the mutation bills — `addRentalLineToInvoice`/`extensionPreview`
   preview; **never** cost/floor — B2). Confirm = `actionPill` (R17, *green* when it
   takes money else blue) / Cancel = `ghostPill` (R18).
2. On confirm: `dispatchDrop({entity:srcCard, id:srcId, rec:srcRec}, {entity:targetCard, rec:targetRec})`
   → reuses every hard gate + History log. Then `toast` + R19 `attnFlash` the new
   pill; clear `state.linking`.
3. **`WINDOW_CATALOG`** entry for `linkConfirm`.
**Verify:** invoice confirm shows the right price; locked/cross-customer/double-bill
blocked with a clear message; History entry written.

## Phase 6 — Icons (de-emoji)
1. Map the menu glyphs (cut/copy/paste/clear/search/globe/replace/comment/thread/
   wrangler + the link/target icons) → Lucide names in `tools/gen-icons.mjs`; run it
   (needs network; dev-time). Replace emoji in `openCtxMenu` with `I.*`.
**Verify:** `node tools/gen-icons.mjs --check`; no emoji left in the menu markup.

## Phase 7 — jactec-ui stamps + CI gates
- `data-r` stamps on the banner + confirm popup; add `RULE_META`/`RB_*` rows if a
  new rule is introduced; `node ci/gen-rule-usage.mjs` (regen); `WINDOW_CATALOG`
  (`node ci/check-window-catalog.mjs`); `node tools/gen-code-map.mjs` (regen).
- AA contrast, `:focus-visible`, reduced-motion on the banner/popup.

## Phase 8 — Self-driven verification (the click-through Jac asked for)
Playwright (#local) at phone + desktop, plus role simulation via `currentRole`:
- long-press → menu actions correct per type & role; select → linking mode (banner,
  search); tap valid target → confirm → link committed (assert the data link);
  invalid target blocked; +New auto-flow; Cancel/Esc clears; desktop drag still
  links (regression). Screenshots at each step for the handoff.
- All five gates green.

## Phase 9 — Ship
- Bump the shared `?v=` cache token; commit per-phase; open a **draft** PR; the
  `/role` audit is already on file in the spec. Drive the live deploy + on-device
  check before marking ready.

---

## Delegation (model-triage)
- **Main session (keep):** Phase 2 role gate + Phase 5 money/price + the `/role`
  re-check — security/money, never delegate.
- **Sonnet subagents (well-scoped):** Phase 1 drag removal, Phase 6 icon mapping,
  Phase 4 banner/markup from this spec — settled contracts.
- Phase 8 verification stays on main (it's the proof).

## Resolve-at-build unknowns
- Exact `tierRank` name for the customer-PII capability (+ Customer gate).
- The cleanest invoice-price preview call for the confirm popup.
- Whether `dispatchDrop` needs any tiny guard to run cleanly outside a live drag
  (it takes plain payload/target objects — expected fine).
