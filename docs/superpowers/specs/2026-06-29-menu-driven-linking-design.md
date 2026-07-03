# Menu-driven record linking — design

**Date:** 2026-06-29
**Status:** Design (awaiting review) → `/role` audit → implementation plan
**Supersedes (mobile):** the drag-to-link gesture on phones (#408–#413, the
`2026-06-23-mobile-drag-zip-zones` direction). Desktop drag stays.

## 1. Problem & goal

Drag-to-link never became usable on a phone: a row is wall-to-wall pills, the
long-press fought text-selection, the context-menu timer, and direction
discrimination. After five rounds it still wasn't reliable on iOS.

**Pivot (Jac):** replace the drag with a **guided, menu-driven linking flow** —
long-press a record → pick a "+ ‹Target›" action → land on the target card to
search → tap the target → confirm. It is explicit, discoverable, and reuses the
real cards instead of fighting touch gestures.

**Success:** on a phone (and desktop), a user can link any record to a valid
target in: long-press → tap action → search/tap target → confirm — with no
gesture finesse, and money never added blindly.

## 2. Scope (settled with Jac)

- **Mobile drag: removed entirely.** Rip out the `is-phone` drag arming, phone
  touch-drag path, and phone-only zip-zones. Desktop **mouse** drag stays.
- **Menu linking actions: both platforms.** Desktop keeps drag *and* gains the
  menu actions; phone is menu-only.
- **Actions auto-derived from `DROP_MATRIX`** so they never drift from the rules.
- **Creates happen on the destination card** via its existing **+New** (no
  separate create flow), EXCEPT the unit **+Work Order** shortcut (§4).
- **`/role` audit runs before build** ("Add to an invoice" touches money).

## 3. Entry & gesture

- **Phone:** a long-press opens the R20 context menu (reverses #412's
  `armMenuTimer` no-op). No drag arming on `is-phone`.
- **Desktop:** unchanged — right-click opens the menu; mouse drag still links.
- The R20 menu (`openCtxMenu`) gains a **Link section** above the existing
  Cut/Copy/Search/Comment block, separated by a `menu-sep`.

## 4. Menu actions

For the record's entity type `src`, list one **"+ ‹Target›"** item per valid
`target` in `DROP_MATRIX[src]` — terse, matching the app's existing `+New` / R5b
"+Thing" add language:

| Source | Items (from DROP_MATRIX) |
|---|---|
| unit | **+ Rental**, **+ Invoice** (only when a billable open WO exists — the matrix gate), **+ Work Order** (§4a) |
| rental | **+ Unit**, **+ Invoice**, **+ Customer** |
| customer | **+ Rental**, **+ Invoice** |
| invoice | **+ Rental**, **+ Customer**, **+ Unit**, **+ Work Order** |
| workOrder | **+ Invoice** |

- Items whose matrix gate is impossible *right now* for this specific source
  (e.g. unit→invoice with no billable WO) are **omitted** (not shown dead).
- **🔴 Role-authority gate (from the `/role` audit).** `DROP_MATRIX` encodes data
  *validity*, NOT *who may act*. The action list is `DROP_MATRIX[src]` **∩ the
  acting role's capability**: **+ Invoice** (money, Tier 2) shows only for
  Office/Owner; **+ Customer** only for roles entitled to customer PII
  (Sales/Office/Owner — not Dispatcher/Mechanic/Driver); operational links stay
  within each role's tier. The mutation **re-checks authority server-side** — the
  menu omission is UX, not the security boundary.
- **§4a — unit "+Work Order":** a WO is *created for* a unit, not linked to an
  existing one, so this is **not** the search-link flow. It navigates straight to
  that unit's record (standard view) where WO creation already lives. (Only on a
  unit's menu.)

## 5. Linking mode

Selecting a "+ ‹Target›" action:

1. Sets transient `state.linking = { srcCard, srcId, srcType, targetCard }`.
2. Navigates to `targetCard` in **list + search** mode (search focused), on phone
   flips the active column to it.
3. Renders a **hazard-stripe banner** at the card top (new UI, `data-r` stamped):
   *"Linking ‹source title› → pick a ‹target› (or +New)"* with a **Cancel**
   (R18 ghost) that clears `state.linking`.
4. **Row behavior in linking mode:** tapping a target row opens the **confirm
   popup** (§6) instead of navigating into the record. Rows failing the
   `DROP_MATRIX[src][target]` gate are **dimmed**; tapping one shows the reason
   (toast) and does not proceed.
5. **+New auto-flow:** the card's existing **+New** creates a fresh target record
   and immediately routes it into the confirm popup (create → confirm → link, one
   flow).
6. Linking mode is cleared by: confirm-complete, Cancel, Esc/back, or navigating
   away via the dock.

## 6. Confirmation popup

A new catalogued popup (`WINDOW_CATALOG` entry; `data-r` stamped):

- Title/body: *"Add ‹unit Beacon› to ‹rental 6/29–7/2›?"* naming both records.
- **Money:** for **Add to an invoice**, show the **price impact** — the rental/
  line/WO amount that will be billed (pulled from the same pricing the mutation
  uses) — so money is never added blindly. **🔴 Show the customer-facing PRICE
  only — never cost / Bottom Dollar / Ask / ROI / part-cost** (margin floors are
  radioactive on any shared/over-the-shoulder surface; `/role` step-3 hard-fail).
- Buttons: **Confirm** (R17 — *green* when it takes money, *blue* otherwise) /
  **Cancel** (R18 ghost).
- On confirm: call the **existing `dispatchDrop(payload, target)`** path so every
  hard gate re-fires server-consistently (locked invoice, customer-scoping,
  double-bill, blacklist, overbooking). Then toast + R19-flash the new pill, and
  clear `state.linking`.

## 7. Reuse & isolation

- **Mutations:** no new linking logic — build a `{entity,id,rec}` payload + a
  `{entity,rec}` target and hand them to `dispatchDrop`, which already owns all
  links and gates. (One small refactor: ensure `dispatchDrop` is callable outside
  a drag — it already takes plain payload/target objects.)
- **Action derivation:** a single `linkActionsFor(srcCard, rec)` reads
  `DROP_MATRIX` + per-pair gates → the menu item list. One source of truth.
- **Banner + confirm popup:** small, self-contained; keyed off `state.linking`.

## 8. Drag cleanup (mobile)

Remove, gated on `is-phone`:
- the `is-phone` branch in `dragDown` (#408),
- the `armMenuTimer` no-op (#412) — the menu fires on phone again,
- phone touch-arming in `dragDown`/`dragMove` and the `ghostLift`/pickup haptic
  is desktop-only now,
- phone-only **zip-zones** (`buildZipZones`, `phoneDragEdge`) and the
  `.is-phone .grid .row/.card` selection-suppression (#411) if no longer needed.

Keep desktop mouse drag + its ghost untouched. Net: the touch drag engine paths
are deleted; the mouse path is unchanged.

## 9. Design language (jactec-ui)

- New UI elements (Link menu items, linking banner, confirm popup) are emitted
  through builders / stamped `data-r`; the banner uses the **hazard-stripe** motif
  (active, attention) per the yard data-plate language.
- **🔴 Icons: library glyphs only (no emoji).** The live R20 menu currently uses
  emoji (✂️📋🔎🤠…) — an icon-rule violation. New linking items use `I.*` (Lucide,
  via `icons.js`); migrate the existing emoji items to library glyphs in the same
  pass (or, at minimum, never add more emoji).
- New popup → **`WINDOW_CATALOG`** entry (CI-enforced).
- `rule-usage.js` regenerated; `code-map` regenerated; AA contrast + focus +
  reduced-motion respected.

## 10. Roles / data-sensitivity — `/role` audit results (2026-06-29)

Audit run against the full R20 menu + the new linking actions. Findings folded in:

**🔴 Blockers (binding):**
- **B1 — role-authority gate (§4):** action list = `DROP_MATRIX[src]` ∩ acting
  role's capability; **+ Invoice** Office/Owner-only (Tier 2 money), **+ Customer**
  PII-entitled roles only. Mutation re-checks **server-side**.
- **B2 — confirm popup shows PRICE only (§6):** never cost / Bottom Dollar / Ask /
  ROI / part-cost (radioactive margin floors).

**🟡 Gaps (address in build):**
- Cut/Clear/Replace must inherit each field's write-gate (route through
  `startInlineEdit`, don't bypass).
- Every link (esp. + Invoice) auto-writes an attributed History entry (reuse
  `dispatchDrop` logging — verify).
- "Ask Mr. Wrangler" must not ship margin/PII context for low-tier roles.

**✅ Clears:** Search/Global Search (read-only); Add Comment/Start chat (internal);
`dispatchDrop` reuse keeps §7.5/§7.6 locked/customer-scoping/double-bill gates; not
a customer-facing surface (no T7 portal isolation), provided B2 holds.

## 11. Verification

- Phone-context (390×844, hasTouch) + desktop Playwright: long-press → menu shows
  the correct derived actions per type; selecting one enters linking mode (banner,
  search); tapping a valid target opens confirm; confirm runs the link; invalid
  targets are blocked with a reason; +New auto-flows; Cancel/Esc clears.
- Money: add-to-invoice confirm shows the right amount; gates block locked/
  cross-customer/double-bill.
- Regression: desktop drag still links; the rest of the R20 menu unchanged.
- Gates: smoke, logic-test, gen-rule-usage --check, check-window-catalog,
  gen-code-map --check.

## 12. Out of scope (YAGNI)

- No multi-select / batch linking.
- No new link *types* beyond `DROP_MATRIX`.
- No reordering / removing the existing menu items (Cut/Copy/etc.).
- Desktop drag is not removed or changed.
