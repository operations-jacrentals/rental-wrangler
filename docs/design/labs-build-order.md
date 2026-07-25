# Labs pipeline — prompt framework + build order

**Pipeline: option C.** Every screen goes through Design Labs; Jac approves every inch.
Two rules keep it focused instead of redundant.

## Rule 1 — North Star per prompt (objective + anti-objectives)
Every prompt opens with:
- **North Star (objective):** ONE sentence — what this screen is deciding. The only thing to approve here.
- **Out of scope (anti-objectives):** an explicit list of what NOT to critique or redesign in this
  prompt — because it's already locked, or it belongs to a later screen. This is the leash on the
  "save the whole app from everything wrong" urge. If it's on this list, it doesn't matter *here*.

## Rule 2 — Inherit locked elements (carry-forward)
Every prompt names the already-approved components it MUST reuse **verbatim** (not redesign). Once
the card header is locked, it appears unchanged on every later mockup. Labs is told to embed them;
Jac is reminded they're decided. Each screen approved adds its components to the registry below.

## Locked-elements registry (grows as we approve)
- ✅ **Design system** — tokens, palette, type, Signal·Gate·Stamp·Ref·Door (synced to Labs).
- ✅ **Atoms — LOCKED 2026-07-25.** All eight families, including the new **Pin**. The approved
  consistency pass is applied to the kit itself (`rw-consistency-pass.css` stays as the record of
  what was decided): three control shapes, Archivo body voice, true-outline chips, `.menu` dropped
  as a picker, uniform hover/focus/press, real `<button>`s.
- ⏳ **Containers (Tier 0.1)** — prompts written, not yet run. Card frame · header · list row →
  section plate → panel · popup · ⋯ menu.
- ⏳ **Bounded-detail + section-rail model** — drafted and parked; locks once it sits in the shell.
- _(each approved screen appends its components here, so later prompts inherit them)_

## Build order (dependency-driven — foundations first, then fill)
**Tier 0.0 — ATOMS (the builder elements — review the kit, refine, LOCK):**
0. **Texts · flags · chips · buttons** — Signal·Gate·Stamp·Ref·Door + Buttons/Chips/Fields/Stamps.
   Already drafted in the design-system kit on our real tokens. Review deliberately, refine, LOCK.

**Tier 0.1 — CONTAINERS (the reusable shells everything is poured into — design, LOCK):**
1. **Card frame · card header · list row** → `prompts/prompt-03-container-card.md`. The anatomy
   shared by every card surface, designed and approved BEFORE anything composes it.
2. **Section / plate** → `prompts/prompt-04-container-section.md`. The container *inside* a record;
   a detail view is a stack of these, and the Tier 1 rail is built from their rolled-up states.
3. **Panel · popup · ⋯ action menu** → `prompts/prompt-05-container-overlay.md`. Everything that
   floats above the app.
   - **action / overflow menu** — added 2026-07-25. `.menu` was DROPPED from the atoms (the status
     *picker* is now `.seg--stack`). A menu of unrelated **actions** (⋯ → Duplicate · Export ·
     Archive · Delete) is a different job and a *container*, not an atom — designed here so it
     never gets improvised mid-screen.

> **Card count correction (2026-07-25).** The "all 7 cards" line above was stale. The shipped
> registry (`config.js` → `GRID_CARDS`, `BACKOFFICE_BOARDS`) is **5 grid cards** — Units ·
> Categories · Rentals · Invoices · Customers — plus **6 back-office boards** — Parts · Vendors ·
> Expenses & Receipts · Company Files · Collections · Sales Pipeline. The Shop card was retired
> 2026-07-07. **Trips** has three reference mockups but is *not* in the registry — confirm with Jac
> whether it becomes a twelfth surface before Tier 2 starts.

**Tier 0.2 — THE SHELL (composes the locked containers):**
4. **App shell** → `prompts/prompt-02-shell.md`. 3-column yard grid, top bar, footer rail. Decides
   column widths AND *how a row-expansion relates to the columns* (the 3-col question).
   ← the earlier draft parks here.

**Tier 1 — INTERACTION MODEL:**
5. **Bounded detail + section rail** → `prompts/prompt-01-detail-views.md`. Expand-in-place
   (already drafted; locks once it sits in the shell).

**Tier 2 — PER-CARD CONTENT (inherits Tiers 0–1):**
6. Units · 7. Rentals (calendar-anchored) · 8. Customers · 9. remaining surfaces (Invoices,
   Categories, the six back-office boards, and Trips if it's in) — each surface's list groups +
   its section set.

**Tier 3 — CROSS-CUTTING SURFACES (inherit the frame):**
10. Item tabs / Comms tabs · 11. footer-rail open chats · 12. notifications / toasts / popup
    notifications · 13. settings boards · 14. creation flows / functional popups / wizards ·
    15. states — empty/loading, login, mobile reflow.

## Note on sequencing
We started at **Tier 1** (detail view) before **Tier 0** (shell). The detail *model* is proven —
keep it. The atoms are now locked, so the order from here is **containers (0.1) → shell (0.2) →
detail view locks (1) → per-card content (2) → cross-cutting (3)**. The three container prompts run
in their own order too: the **card** first (the shell needs to know what it's arranging), then the
**section** (the detail view is a stack of them), then the **overlays** (everything else builds on
the first two).
