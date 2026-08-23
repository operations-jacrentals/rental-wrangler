# Design reference — mockups & artifacts

These are the **design-authority mockups** for Rental Wrangler's Phase-2 redesign — the visual
source of truth for each surface, preserved from the design sessions. Read the relevant one before
building or reshaping that surface. Where a mockup and the spec / decisions-ledger disagree, the
**newer decision wins** (`docs/superpowers/specs/2026-07-20-decisions-ledger.md`).

**Sourcing rule:** design comes from these mockups + the `style`/`wrangler-style` canon + the specs
— never reverse-engineered from the live `app.js` / `style.css`.

| Mockup | Surface / spec section |
|---|---|
| `detail-views.html` | The three detail views (Units / Rentals / Customers) — the section plate-stack (§2) |
| `list-views.html` | The list / card views — "spot what's on fire" (§1–2) |
| `text-links-flags.html` | The "Words, links & flags" element vocabulary (Signal · Gate · Stamp · Ref · Door) |
| `trips-ledger.html` | Trips ETA-Tracker ledger (§8.5) |
| `trips-schedule.html` | Trips scheduling surface (§8.4) |
| `trips-card.html` | Trips card (§8) |
| `inbox-card.html` | Comms / Inbox workspace (§7) |
| `compose-dock.html` | Comms compose dock (§7.3) |
| `get-told.html` | The bell / notifications (§7) |
| `dashboard-card.html` | Role Dashboard (§5) |
| `funnel.html` | Customers funnel (§6) |
| `inspection.html` | Inspection checklist takeover (§6) |
| `yard-journey.html` | Yard-journey lifecycle timeline (§6) |
| `intake.html` | Intake flow |
| `decision-notes.md` | Running design-decision notes from the sessions |

The distilled UX research behind these decisions — the ~171-finding inventory, the job taxonomy,
and the flaws that drove the redesign — lives in `docs/research/`.

> Not captured here: Jac's hand-drawn sketches (the ETA-tracker, inspiration shots) were images in
> chat, not files, so they aren't in the repo. The spec describes them in words (e.g. the ledger at
> §8.5) and these mockups render the settled result.
