# Rental Wrangler — logo drafts · round 1 (2026-07-13)

Three brand-mark directions drawn from the intro-video script (sci-fi western:
purple space sky, massive moon, yellow excavators grazing like cattle, Mr.
Wrangler's lasso and glowing-orange duster), all grounded in the yard
data-plate design language (CLAUDE.md + the `jactec-ui` skill). Status:
**drafts — direction pending Jac's pick.** Light-surface and one-color
variants come after a direction is chosen.

Open `drafts.html` for the review sheet (self-contained — fonts inlined).

## The three concepts

| File | Concept | One-liner |
|---|---|---|
| `logo-1-brand.svg` | **The Brand** | Branding-iron RW monogram inside a rope lasso ring with a hanging coil tail — "brand" both ways. Leather tan (`--tan`), Zilla Slab wordmark, saddle-stitch divider. The ranch-leaning option. |
| `logo-2-dataplate.svg` | **The Data-Plate** | Steel plate, hazard-stripe cap (`#f5c542`/`#14181d`), corner rivets, tan horseshoe stamp, Saira Condensed 800 lockup with WRANGLER as the one safety-orange ignition word. Closest to the app; could double as the login/header mark. |
| `logo-3-badge.svg` | **The Frontier Badge** | The video distilled into a round badge: purple space sky, massive moon, star field, mesa horizon, a yellow excavator grazing (boom down) with a smaller one on the ridge, a quiet orange laser fence, rope + saddle-stitch rings, arced wordmark. The cinematic option. |

## Provenance & regeneration

- All wordmarks are **library fonts converted to vector paths** (no font
  dependency in the SVGs): Saira Condensed (stamped voice) + Zilla Slab
  (ranch voice, sanctioned via the `[data-theme="ranch"]` block). Fetched
  from Google Fonts (OFL) at build time — not committed.
- All other geometry is simple computed shapes (the bespoke brand-mark
  exception in CLAUDE.md → Icons). Nothing is freehand-drawn; the horseshoe
  is the existing `icons.js` mark verbatim.
- Colors are the `style.css` tokens: `--accent #ff7a1a`, hazard `#f5c542` on
  `#14181d`, `--tan #c2925a` / `--tan-deep #8a5a2b`, `--purple #b07cf5`,
  steel `#1b2129→#0c0e11`, text `#e9edf4`/`#a7afbc`.
- Regenerate: put the five TTFs in `fonts/` (see `gen-logos.mjs` header),
  then `node gen-logos.mjs && node build-sheet.mjs`. Deterministic — no
  randomness, no timestamps.
