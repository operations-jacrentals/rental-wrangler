# V2 card — the Figma card, running

Jac's Figma card `438:274` ("V2 · CARD — Tier-01 structure x Halo components")
rebuilt as live HTML/CSS. Serve this folder and open `card.html`; it renders two
stages from the same markup — 1500px (Figma scale) and 380px (the real card width).

```bash
cd docs/design/v2-card && python3 -m http.server 9147
```

## What it is

| Half | Source |
|---|---|
| Chrome — tab bar, search, card frame, footer | Shipping Tier-01 (`docs/design/tier-01-card/`), captured, not re-authored |
| Body — deck, housing, boards, hexicon, rail channel, elbow | Jac's new Figma assembly, exported as shared vector assets |

## The two rules that make it work

**Coordinate composition, not flex.** The assembly is a measured layout: rail at
(40,60), main item at (89,40) 1335x151, subitems at x=240.15 on a 156px pitch,
blocks at y 353/893/1433 inside a 1500-wide card. `layout.css` positions every
piece at its Figma coordinate and scales the whole thing as one unit, which is why
it holds at 380px. An earlier attempt approximated this with a responsive flex
layout and was rejected — the parts drift relative to each other.

**Shared assets, declared once.** Every piece of artwork is a data-URI in `:root`,
referenced by N elements. Marginal cost per row is ~0 bytes. Inline SVG per row was
measured at roughly 60x the weight (ledger #233's "unsustainable by quantity").

## Steel vs laser — ledger #217

Static multi-tone artwork is ONE z-ordered `background-image` with real fills baked
in, in Figma's paint order. Anything that changes with row state is a separate
`mask-image` filled with `var(--row-hue)`.

Do NOT build one mask per tone: roughly half the regions overlap deliberately
(darker/lighter patches painted over a base to fake bevels), so an order-blind
rebuild collapses the tones. And `mask-image` layers do not pair 1:1 with
`background-image` layers — they union via `mask-composite: add`, so only the
topmost background survives.

The elbow and the housing each need TWO layers: masking the element itself would
clip the steel along with the laser, so steel is the element background and the
tinted laser rides on a pseudo-element. The housing's laser is two masks — hot core
at `var(--row-hue)`, deep well at `hsl(from var(--row-hue) h s 31%)`. Lightness
only; mixing toward the background drifts grey and stops reading as one light
source (ledger #236).

## Traps that cost real time here

- **Frame bounds are not painted extent.** `429:53`'s frame is 40x158 while its
  child sits at absolute (40,158), outside it. `429:77`'s frame is 487x97, painted
  extent 683x97 offset 193.93px left. Render a node and LOOK at it before building
  from it — one pass built from a 41x158 sliver believing it was the elbow.
- **Sub-1% paths are not optional.** They are the bevels and grooves that separate
  the steel tones. Dropping ~40 of them collapsed the deck from 9 tones to 6. On the
  elbow, 32 of 33 sub-1% runs had a measurable visible cost.
- **Figma's PNG export quantizes translucent washes** into bands one channel value
  apart. Counting those as distinct design tones fails an asset for not reproducing
  a rasteriser artifact. Compare tones by distance, not by identity.
- **`438:315` is named "Main item · FAILED board" and is actually the GROUP NAME
  plate.** The layer name is stale.

## Known gaps

- Header/footer chrome are raster captures, not vectors.
- The bulb/slot gems are a raster crop composited inside the SVG — 357 fill regions
  made vector disproportionate. Hybrid, deliberate.
- Row/group counts are demo data, not wired to anything.
