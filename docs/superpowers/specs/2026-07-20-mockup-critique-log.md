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
| 2 | 2026-07-20 | Inbox chrome | **"VIEWS & SORT" button looks VERY out of place** in the top chrome. Jac drafting alternatives on paper — DON'T rebuild yet. Ties to the parked all-cards Sort redesign. | Surface | Just here | Open — Jac redrafting |
| 3 | 2026-07-20 | Trips (dispatch) | **Overwhelming — trips blur together; a contrast/background problem.** Only the mobile "Next Up" focus felt right. Fix: stronger per-trip **separation** (distinct cards, breathing room, less uniform dark-on-dark) + borrow the driver "NOW / Next Up" focus. Don't rebuild until the Trips MODEL (§8) settles. | Surface | Just here | DONE — rebuilt as the **ETA-Tracker ledger** (`trips-ledger.html`, spec §8.5): register layout, soft-blue Gate chips, unit+customer Refs, `+MIN=ETA` line, departure-clock colour, numbered spine outside the card. Published. |

## Canon-compliance audit — build-first surfaces (2026-07-21)

Ran a canon-drift audit of `list-views.html` + `detail-views.html` (the surfaces slated to build first) against
`style` + `wrangler-style`. **These feed the build writing-plan — the fixes land in the BUILT code, not necessarily the
throwaway mockups.** Systemic patterns (fix everywhere at build):

- **Ref drift (the Trips miss, repeated).** Card **titles/headers** and unit/invoice **sub-rows** render linked records as
  **plain text**; a shared `ref()` **hardcodes the user icon** for every type. → Every linked record is a Ref with its
  **type icon**, everywhere (canon tightened in `wrangler-style` §3).
- **ONE chip radius, violated.** Ref/Signal/Gate carry 2–3 different radii (`6/8/5px`). → collapse to one shared chip-radius token.
- **Yellow token drift (detail-views).** `--yellow:#ffe14d` is the **rejected neon** (fails CVD); locked value is **`#eed44b`**.
  Footer even mislabels it. Every yellow Signal/Gate is off-canon. → swap to `#eed44b`.
- **Pure `#fff` ink (detail-views, real — not just light blocks).** `.sig.f.red`/`.door.save` use pure white. → `--onRedFill`/`--onCommit #fdfdfd`.
- **Number voice.** Dollar figures in body-sans instead of **mono/tabular**. → `var(--stamp)` + tabular-nums.
- **Toggle colour law (detail-views).** Insured/Uninsured active option paints plain accent-orange, discarding good/risk **state**.
  → route through state colour (orange fallback is only for no-status options).
- **Dead light-mode blocks** on both. → strip on build (dark-only rule now in `wrangler-style` §1).
- **Clean:** Gate chips (state colour + chevron, never `--commit`) and the two type voices are otherwise correct. Good sign —
  most drift is old mockups predating settled canon, not gaps in the canon itself.
