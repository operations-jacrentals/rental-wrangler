# Mockup critique log — Phase 2 review

**Opened:** 2026-07-20 · **Status:** open, receiving notes
**Covers:** the Phase-2 mockups under review on staging — List Views v2, Yard Journey,
Funnel, the three Detail views, and get-told (incoming). All run through `style` (numbers)
+ `wrangler-style` (decisions).

## Purpose

Jac reviews the mockups and gives notes; this log captures each note **tagged** so the fix
lands in the right place and nothing is lost between review and build. The concepts are
settled — critique now targets *does each surface do its job, and does it hold the system.*

## How a note is tagged

Every note gets a **type** (where the fix lives) and a **scope** (how far it reaches):

**Type**
- **Rule** — a number/law (a control height, a contrast floor, the CVD threshold). Rare;
  moves only deliberately. Home: `style`.
- **Decision** — a colour, font, component look, or word. Free to change. Home:
  `wrangler-style` — and it propagates to every surface at once.
- **Surface** — one screen's execution ("the funnel's action column is cramped"). Fixed in
  that mockup only.
- **Gap** — the surface doesn't do its job, or something's missing.

**Scope**
- **Everywhere** — a system change; one skill edit ripples to all surfaces.
- **Just here** — a one-off on this surface.

## The critique lenses (how a note is aimed)

1. **Job test** — does a *tired* worker finish the surface's one job in ~3s? where does the
   eye land first — is that the fire?
2. **Ugly-state test** — what does it look like at its worst (40 red rows, an empty day, a
   failed sync, 200 invoices)?
3. **Motion test** — imagine the thumb: tap → expand → is the thing right there → get back fast?
4. **Missing test** — walk a real day; where are you still stuck / still working outside the screen?

## The one job each surface owes (the yardstick)

| Surface | Its one job |
|---|---|
| List Views | Spot what's on fire without reading every row |
| Yard Journey | Know my next move on this machine |
| Funnel | Who's worth chasing, and what's the next touch |
| Units / Rentals / Customers detail | Trust what the screen says |
| get-told (incoming) | Hear about it when something needs me — without staring at the screen |

## Log

_Disposition: open → queued → done (with where it was fixed: skill / mockup / spec)._

| # | Date | Surface | Note | Type | Scope | Disposition |
|---|------|---------|------|------|-------|-------------|
| 1 | 2026-07-20 | Intake | **Parked** — Jac isn't worried about intake as a feature until much later, if ever. Mock kept for reference; don't re-surface it as "the next gap." | Gap | Just here | Parked |
