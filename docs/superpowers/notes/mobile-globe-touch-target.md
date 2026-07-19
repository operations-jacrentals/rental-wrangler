# Parked: mobile globe touch target (< 44px)

**Parked from** the card-search global-mode build (session 2026-07-13), off `trunk`.
**Status:** idea/known-fix, not yet implemented — this note is the artifact.

## What
The R33 card-search **global-mode globe** (`.mini-globe`, `globeToggle()` in `app.js`)
renders at **24×24px**. On phones that's **below the 44×44px touch-target floor** the
jactec-ui mobile rules require. The mobile CSS bumps the *other* in-bar controls
(`.is-phone .bv-btn`, `.is-phone .mini-search`, `.is-phone .sort .dir`, etc.) to ≥44px,
but the globe was missed.

## Why parked
Surfaced during the globe build but wasn't the reported issue at the time (that was the
mobile footer-jog regression), so it was deferred rather than folded into the ship.

## The fix (what's left)
- In `style.css`, in the `.is-phone` mobile block (next to the other 44px touch-target
  bumps, ~`.is-phone .bv-btn { min-width:44px; min-height:44px }`), add:
  ```css
  .is-phone .mini-globe { min-width: 44px; min-height: 44px; }
  ```
- Verify at a 390px phone viewport (Playwright, `deviceScaleFactor:2`, `isMobile:true`):
  the globe tap target is ≥44px, still right-aligned in the `.mini-searchwrap`, and the
  bar's `min-height: 48px` still looks right (the 44px control shouldn't overflow it).
- Run it through `/jactec-ui` (mobile reference) + the usual gates before shipping.

## Ship
Small, low-risk CSS-only change → normal feature branch → PR to `trunk` → promote when Jac calls it.
