# Claude Design Labs — Prompt 2 · The App Shell (the 3-column yard frame)

**Design system:** Rental Wrangler Design System (already in place — build only from it).
**Optional reference:** you may be shown the detail-view draft. If so, treat it as a **black-box payload** — the content that appears when a row expands. Do **NOT** restyle or redesign its internals here.

---

## ⭐ North Star — the one thing this screen decides
Design the **app shell**: the 3-column yard frame every other screen lives inside — *and* decide **how a list row expands within it.**

## 🚫 Out of scope (do NOT touch here — locked elsewhere or a later screen)
- The **detail-view internals** — the section rail, the section bodies, the History footer. Separate, in-progress screen. Treat an expanded detail as an opaque block; don't restyle it.
- **Per-card content** — the actual groups and rows inside Units vs Rentals vs Customers, and their section sets. Later screens.
- **Notifications, toasts, settings, open comms threads, creation popups.** Later screens.
- **New colours or components.** Everything comes from the design system — nothing invented.

## ♻️ Inherit (reuse verbatim)
- The **Rental Wrangler Design System** — tokens, palette, the two type voices, and the Signal·Gate·Stamp·Ref·Door vocabulary. Every chip, label, and action uses these.

---

## The frame to render
Rental Wrangler is a heavy-equipment rental-yard app (JacRentals). The home screen is a **3-column grid, side by side**, dark data-plate look, matte, desktop-first:

- **Column 1 — Units** · title toggles **Units ↔ Categories**
- **Column 2 — Rentals** · title toggles **Rentals ↔ Calendar**, with a **Trips** sibling tab in the header
- **Column 3 — Customers** · title toggles **Customers ↔ Sales**

Each column is a **card**:
- a **header** — left-aligned title-toggle · a search field · filter chips (e.g. **To-Do** / **Done**) · a sort control · a small **graph** button;
- above a **scrolling list of rows** (render a few realistic collapsed rows per column — name, category/meta, a rolled-up Signal, a primary action).

Around the grid:
- a **top bar** — brand mark, current role, global chrome;
- a **footer rail** — a slim comms / notifications / quick-action rail (just the rail, not open threads).

## ⚖️ The one hard decision — row expansion
When a user clicks a row to open its detail, the detail uses a **horizontal section rail** that does **not** fit a ⅓-width column. So the frame must give it room. **Render 2–3 honest treatments of what happens on expand, side by side or toggleable, so we can pick one:**

1. **Break-out wider** — the expanded row grows in place to span ~2 columns (or full width); the other column(s) compress or dim behind it.
2. **Anchor panel** — clicking a row pins it and opens a wider detail panel docked beside/over the grid; the list stays visible, the detail gets real width.
3. **In-column (the honest worst case)** — the row expands inside its own ⅓ column with the rail wrapping/scrolling, so we can see exactly how cramped it gets and rule it out on sight.

Use a realistic expanded record in each so the width tradeoff is visible. Keep the collapsed 3-column state as the baseline in every treatment.

## Deliverable
**One** iterable HTML artifact: the collapsed 3-column shell (top bar + three card headers + a few rows each + footer rail) **plus** the 2–3 expansion treatments, all built from the design system. Note any place the frame and the design system pulled against each other.
