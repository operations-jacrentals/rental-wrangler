# Customer Funnel Redesign — Implementation Plan

- **Spec:** [`docs/superpowers/specs/2026-07-17-customer-funnel-redesign-design.md`](../specs/2026-07-17-customer-funnel-redesign-design.md)
- **Status:** Ready to build — **after** PR #675 merges to trunk
- **Prereq:** #675 (the work-queue batch) on trunk. The funnel **extends the same quick-add "Lead?"
  pill** shipped in #675, so building before it merges would tangle two in-flight edits to the same
  code. Cut the funnel branch off the **post-#675 trunk**.

## Guardrails (every phase)

- New/reshaped UI → **`/jactec-ui`**: emit through §5 builders, stamp `data-r`, tokens only, add a
  `WINDOW_CATALOG` entry if a new popup window appears.
- **`/role` audit** on the customer-facing funnel surface **before** it ships (data-sensitivity +
  gate lenses). Expected low-risk (lead-stage data, not pricing/margin) — confirm no
  membership-economics detail leaks onto a customer-visible surface.
- Gates before each push: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`,
  `node tools/gen-code-map.mjs --check`.
- Ship on Jac's say-so: feature branch → `/deploy` → `/merge` → `/promote`.

## Phase 1 — Data model + config

- **`config.js`:** define the three funnels, each with its allowed stages, order, and auto flags:
  ```
  FUNNELS = {
    rental:    { stages: ['Lead','Reserved*','Rented*'] },
    member:    { stages: ['Lead','Contacted','Not A No!','Payment Discussed','Signed*'] },
    equipment: { stages: ['Lead','Contacted','Not A No!','Payment Discussed','Paid*'] },
  }   // * = auto (locked); order is the ladder order
  ```
  `STATUS.funnelStage` already carries every stage value (config.js:150) — this adds the per-funnel
  **membership** to each set.
- **Customer model:** add **explicit** membership — `funnels: { rental, member, equipment }`
  (booleans). Keep `membershipStage` (→ **Member** stage) and `usedSalesStage` (→ **Equipment**
  stage) as the stored stages.
- **Migration** (one-time, in the index build alongside the existing customer/rental migrations):
  - `membershipStage ≠ N/A` today → `funnels.member = true`.
  - `usedSalesStage ≠ N/A` → `funnels.equipment = true`.
  - any reservation/rental history → `funnels.rental = true`.
  - No data loss; no stage values change.

## Phase 2 — Derivations (APP-04 neighborhood)

- `rentalFunnelStage(customer)` — **derived**: On Rent → `Rented`; a future reservation →
  `Reserved`; else `Lead` (when in the rental funnel). Built on the customer's own rental records
  (mirror `activeRentalForUnit`'s shape).
- `funnelStageOf(customer, funnel)` — Rental = derived (above); Member = `membershipStage`;
  Equipment = `usedSalesStage`.
- **Auto-join:** treat `funnels.rental` as **true when the customer has any reservation/rental**
  (derive at read time) OR was explicitly forked into Rental. Simplest: `inRental =
  funnels.rental || hasAnyRentalActivity(customer)`.

## Phase 3 — The adaptive menu (R1)

- Extend the R1 gate machinery (`openFunnelDropdown` / `gateTimeline` / `setFunnelStage`) into a
  **`funnelMenu`**:
  - `N/A` at top.
  - **Leads** section — the 3 funnel chips (toggle `funnels.*`). Multi-select in the detail view;
    **single-select at quick-add** (Jac).
  - **Stages** section — only the stages applicable to the customer's current memberships +
    activity (per the spec's visibility rules). Auto stages render **locked** (status), never a
    manual pick — same guard as today's `Signed`/`Paid` lock.
- Stamp `data-r`; `WINDOW_CATALOG` entry if it becomes its own popup window.

## Phase 4 — Quick-add integration (extends #675)

- Update `custQuickAddFunnelPill` / `openCustQuickAddFunnelDropdown` (shipped in #675) to drive the
  new selection: the "Lead?" pill picks **one** funnel → sets that `funnels.*` = true + its stage =
  `Lead`, then creates + opens (the existing `custQuickAddCreate` flow).

## Phase 5 — Customer-detail two-track section

- Replace the current 2-tab `funnelSectionHtml` (Rental / Equipment Sales) with the **two-track**
  view:
  - **Track A — Rental → Member:** the combined ladder — activity-gated Reserved/Rented + the
    Member continuation reveal.
  - **Track B — Equipment:** the equipment-sales ladder.
- Each track edits its membership/stage through the Phase-3 `funnelMenu`.
- (The mockup at `funnel-mockup` artifact is the visual reference for this layout.)

## Phase 6 — Auto-stage wiring

- Reserved/Rented derive from live rentals — render as status, never selectable.
- `Signed` auto-locks on the membership agreement sign (existing F3 guard); `Paid` auto-locks on a
  paid sale invoice. `setFunnelStage` rejects manual picks of any auto stage.

## Phase 7 — Audit, gates, ship

- `/role` audit → fix any finding → regenerate `rule-usage.js` + code map → smoke + logic →
  `/deploy` staging review → `/merge` → `/promote` (Jac's calls).

## Decisions still to make during build

- Membership storage shape: `funnels{}` object vs. a `funnelsIn[]` set (Phase 1).
- Whether the detail "Leads" multi-select allows every combination or constrains any (e.g.,
  Equipment-only is fine; is "no funnel + a stage" ever valid? — no, stage implies a funnel).
