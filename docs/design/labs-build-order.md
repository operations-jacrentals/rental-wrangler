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
- ⏳ **Bounded-detail + section-rail model** — the current screen; locks on approval.
- _(each approved screen appends its components here, so later prompts inherit them)_

## Build order (dependency-driven — foundations first, then fill)
**Tier 0.0 — ATOMS (the builder elements — review the kit, refine, LOCK):**
0. **Texts · flags · chips · buttons** — Signal·Gate·Stamp·Ref·Door + Buttons/Chips/Fields/Stamps.
   Already drafted in the design-system kit on our real tokens. Review deliberately, refine, LOCK.

**Tier 0.1 — CONTAINERS (the reusable shells everything is poured into — design, LOCK):**
1. **Card frame · card header · list row · section/plate · panel/popup · action-menu** — the shells,
   designed as their own artifacts and approved BEFORE anything composes them. (Header + row shared
   by all 7 cards.)
   - **action / overflow menu** — added 2026-07-25. `.menu` was DROPPED from the atoms (the status
     *picker* is now `.seg--stack`). A menu of unrelated **actions** (⋯ → Duplicate · Export ·
     Archive · Delete) is a different job and a *container*, not an atom — design it here so it
     never gets improvised mid-screen.

**Tier 0.2 — THE SHELL (composes the locked containers):**
2. **App shell** — 3-column yard grid, top bar, footer rail. Decides column widths AND *how a
   row-expansion relates to the columns* (the 3-col question). ← current draft parks here.

**Tier 1 — INTERACTION MODEL:**
3. **Bounded detail + section rail** — expand-in-place (already drafted; locks once it sits in the shell).

**Tier 2 — PER-CARD CONTENT (inherits Tiers 0–1):**
4. Units · 5. Rentals (calendar-anchored) · 6. Customers · 7. remaining cards (Trips, Invoices…)
   — each card's list groups + its section set.

**Tier 3 — CROSS-CUTTING SURFACES (inherit the frame):**
8. Item tabs / Comms tabs · 9. footer-rail open chats · 10. notifications / toasts / popup
   notifications · 11. settings boards · 12. creation flows / functional popups / wizards ·
   13. states — empty/loading, login, mobile reflow.

## Note on sequencing
We started at **Tier 1** (detail view) before **Tier 0** (shell). The detail *model* is proven —
keep it. Next we lock the **shell**, which also resolves the 3-column-vs-rail tension (below), and
becomes the first frame every later screen inherits.
