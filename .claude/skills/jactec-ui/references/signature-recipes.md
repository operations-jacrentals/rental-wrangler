# Signature recipes — copy these, don't reinvent

The canonical implementations live in `style.css` (the `.login-*` block, the
`.cancel-arc` block, and the `[data-theme="yard"] .col > .card` block). Match them.
Spend boldness in ONE place (the hazard stripe); keep everything else quiet.

## Blued Steel card plate (the `[data-theme="bluedsteel"]` surface system)

Three-part system: the plate itself, the milled-panel recess, and the center-column flip.

**The plate** (all cards — left + right columns):
```css
[data-theme="bluedsteel"] .col > .card {
  position: relative;
  background:
    linear-gradient(180deg, rgba(58,80,118,.34), rgba(8,11,18,.68)),
    url('assets/tex-metal-blued.jpg');
  background-size: cover, 340px;
  background-repeat: no-repeat, repeat;
  --stripe: var(--yellow, #f5c542);   /* cap hazard stripe is yellow, not orange */
}
```

**Center-column flip** (breaks the "same texture repeating" perception for frequent users):
```css
[data-theme="bluedsteel"] .col[data-col="middle"] > .card,
[data-theme="bluedsteel"] .col[data-col="middle"] > .card.anchored {
  background:
    linear-gradient(180deg, rgba(58,80,118,.34), rgba(8,11,18,.68)),
    url('assets/tex-metal-blued-flip.jpg');   /* horizontal mirror of the plate */
  background-size: cover, 340px;
  background-repeat: no-repeat, repeat;
}
```
`tex-metal-blued-flip.jpg` is `tex-metal-blued.jpg` mirrored via PowerShell
`RotateNoneFlipX` — same color/family, different grain direction.

**Milled-panel recess** (sections, rows, any dark sub-panel on the plate):
```css
background: rgba(11,15,24,.36);
box-shadow: inset 0 1px 0 rgba(150,178,222,.12), 0 2px 8px -3px rgba(0,0,0,.55);
border-color: rgba(150,178,222,.16);   /* for rows/borders */
```
Use this on `.section`, `.row`, and any surface that should read as machined into the plate.
Keep DATA on these calm fields — never put the texture behind text.

---

## Hi-vis hazard stripe (the signature)

The one bold motif. Use as plate CHROME — never behind text.

```css
/* yellow caution band (default) */
background: repeating-linear-gradient(135deg, var(--yellow, #f5c542) 0 13px, #14181d 13px 26px);
/* red abort/danger variant */
background: repeating-linear-gradient(135deg, var(--red, #ff4242) 0 13px, #1a0808 13px 26px);
```
Uses today: the card's top cap (`.col > .card::before`, ~5px tall), the login band,
file drop zones, the R4b flashing-pill cap (2px, animated as a barber-pole via
`background-position`). Keep DATA + reading content on calm fields beside it.

## Corner rivets (bolt the plate down)

```css
.plate { position: relative; }
.plate .rivet {
  position: absolute; width: 6px; height: 6px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, var(--rivet, #6b7480), var(--rivet-pit, #191c22) 70%);
  box-shadow: 0 0 0 1px rgba(0,0,0,.5), inset 0 0 1px rgba(255,255,255,.4);
}
.plate .rivet.tl{top:12px;left:12px} .rivet.tr{top:12px;right:12px}
.plate .rivet.bl{bottom:12px;left:12px} .rivet.br{bottom:12px;right:12px}
```

## Ignition button (the ONE primary action)

```css
background: linear-gradient(180deg, #ff9038, var(--accent));
color: var(--on-orange);              /* dark ink on orange, ALWAYS */
box-shadow: 0 6px 16px -6px var(--accent), inset 0 1px 0 rgba(255,255,255,.4);
font-family: 'Saira Condensed', system-ui, sans-serif;
text-transform: uppercase; letter-spacing: 1px; font-weight: 800;
```
Armed/secondary state = orange OUTLINE (`border:1px solid var(--accent); color:var(--accent); background:transparent`), never a fill.

## Elevation rings (depth on dark = light + ring, not shadow)

```css
/* pop-up / menu — orange halo */
border: 1px solid var(--accent);
box-shadow: 0 0 0 2px var(--accent-line), 0 0 20px -6px var(--accent);
/* anchored "you are here" record — neon blue (distinct from orange selection) */
box-shadow: 0 0 0 2px rgba(24,182,255,.55);   /* #18b6ff */
```
For cards/chips use only the defined `var(--shadow)` (float) and `var(--chip-shadow)`
(lift). Do NOT add new drop shadows on dark — step lightness instead (closer = lighter).

## Saddle-stitch divider (the ranch seasoning — restrained)

```css
border-top: 1px dashed var(--tan, #c2925a);   /* a quiet leather-stitch line */
```
Tan is for tiny touches + the occasional divider only. If a glance reads "western"
before "industrial rental yard," remove it.

## Accessibility patterns (required on everything interactive)

```css
.thing:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) {
  /* every pulse/barber-pole freezes to a steady, still-meaningful state */
  .flag.alert, .pill.alert { animation: none; }
  .pill.dvd.alert::before { animation: none; }   /* hazard cap stays, stops sliding */
}
```

## The named keyframes (use these, invent none)

`attnGlow` — the R19 attention flash that REPLACES an error by glowing the on-screen
fix · `plateIn` — the login plate entrance · `flagPulse` — R9b/R4b alert breathe ·
`rwLint` — the R0 lint red pulse. Durations: **.12s** controls · **.15s** surfaces ·
**.5s** rings/timeline. Crisp ease-out. FORBIDDEN: `transition: all .2s ease`,
bouncy/overshoot easing, scattered ambient micro-interactions.
