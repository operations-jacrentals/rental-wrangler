# Tokens — the only colors/sizes you may use

Every value below is a CSS custom property defined in `style.css`. **Use the token,
never the literal.** Dark `:root` is the default; `[data-theme="light"]` and
`[data-theme="yard"]` override the SAME names, so token-based CSS themes itself.
The literals are here only so you can reason about contrast/relationships — do not
paste hexes into markup or new CSS.

## Dark (`:root`, default)

**Surfaces** — `--bg #0b0c0f` · `--bg-2 #101216` · `--panel #15171c` ·
`--panel-2 #1b1e24` · `--card #14161b` · `--card-head #191c22`
**Lines** — `--line #262a31` · `--line-soft #1f232a`
**Text** — `--txt #e9edf4` · `--txt-2 #a7afbc` · `--txt-3 #6b7480` · `--track #22262e`
**Accent** — `--accent #ff7a1a` · `--accent-soft rgba(255,122,26,.14)` ·
`--accent-line rgba(255,122,26,.5)` · `--on-orange #1a1205` (ink on orange)
**Status (base ink / `-bg` soft fill ~.14)** — `--green #34d399` · `--yellow #f5c542`
· `--red #ff4242` (`-bg .18`) · `--blue #5b9dff` · `--navy #6f8bdb` · `--purple #b07cf5`
· `--pink #f06fb0` · `--brown #c79366` · `--gray #8b94a3` · `--orange #ff7a1a`
**Bold viz tones** — `--mix-green/-yellow/-red/-blue/-navy/-purple/-pink/-brown/-gray/-orange`
(stronger than the soft `-bg`; for mix bars / proportional fills)
**Form** — `--radius 16px` · `--chip-radius 12px` · `--shadow 0 18px 50px -24px rgba(0,0,0,.75)`
· `--chip-shadow 0 6px 16px -10px rgba(0,0,0,.7)` · `--anchor-section #23272e`
**Type** — `--font "Geist", -apple-system, "Segoe UI", sans-serif` (the only font
custom-prop; Saira Condensed + ui-monospace are named directly in the few stamped/code spots)
**Add-blue (neon)** — `#18b6ff` (R5b add ink + the anchored "you are here" ring)

## Light (`[data-theme="light"]`)

Surfaces flip bright: `--bg #eef1f6` · `--bg-2 #e6eaf1` · `--panel #ffffff` ·
`--panel-2 #eef1f6` · `--card #ffffff` · `--card-head #eef1f6` · `--line #cfd6e1` ·
`--line-soft #e1e6ee`. Text: `--txt #141821` · `--txt-2 #414b5a` · `--txt-3 #69727f`
· `--on-orange #2a1400`. **Status colors are intentionally DARKER** so pill text
reads on the soft fills: `--green #0c8f5f` · `--yellow #956f00` · `--red #d52a2a` ·
`--blue #1864d6` · `--navy #2f4496` · `--purple #7a37c9` · `--pink #c5337c` ·
`--brown #855526` · `--gray #566072` · `--orange #cf6000`. `--anchor-section #dde2ea`.
→ When you add or retune a status, re-check AA in light too; preserve this darkening.

## Yard (`[data-theme="yard"]`, the live look)

Gunmetal + deeper plate shadows: `--bg #0a0d11` · `--bg-2 #0f1318` · `--panel #171d25`
· `--panel-2 #1d242d` · `--card #12171e` · `--card-head #1a212b` · `--line #2c343f` ·
`--line-soft #212834`. Text: `--txt #eef2f7` · `--txt-2 #aab4c1` · `--txt-3 #717b89`.
Accent a hair punchier: `--accent #ff7e1f` · `--accent-soft rgba(255,126,31,.16)` ·
`--accent-line rgba(255,126,31,.55)`. `--radius 14px` · `--chip-radius 11px`.
**Yard-only helpers:** `--steel-1 #1b222c` · `--steel-2 #0d1116` (steel gradients) ·
`--rivet #4a525e` · `--rivet-pit #0b0f14` (corner rivets) · `--tan #c2925a` ·
`--tan-deep #8a5a2b` (the wrangler leather seasoning — saddle-stitch + tiny touches).
Status colors are NOT redefined here → they inherit the dark base values.

## Rules of use

- Status separation: each status hue means ONE thing everywhere (see SKILL §
  Requirements). Action intent (commit=blue · money=green · danger=red) is a
  SEPARATE axis — don't blend it into the status registry.
- Brightness discipline (dark): keep container-vs-background within ~12% lightness;
  delineate with `--line` borders (which contrast both surfaces), not big fills.
  Closer = lighter; no drop shadows on dark — use `--shadow`/`--chip-shadow` only
  where defined, plus the orange halo ring (menus/pop-ups) and `#18b6ff` ring (anchored).
- One spacing scale: grid 12 · list 7 · section pad 12 · row pad 9–11; radii from the
  `--radius`/`--chip-radius`/8–10/999 ladder. Outer padding ≥ inner. No one-off px.
- Type scale (px): 28 KPI/value · 15 popup title · 13 content · 12 fields · 11
  stamped micro-label & every status badge · 10 · 9.5 finest. Two voices only.
