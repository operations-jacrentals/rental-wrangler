# Rental Wrangler — design-system preview package

This is a code-accurate design-system package for **Rental Wrangler** (JacRentals): 13 self-contained
preview cards under `foundations/`, `elements/`, and `components/` (including the **Pin** corner-marker
card added in the 2026-07-25 consistency pass), plus `tokens.css` (the raw
token stylesheet) — built from the **locked `html.dv2` redesign tokens** in `style.css` (not the
legacy `:root` values), rendering the **Signal · Gate · Stamp · Ref · Door · Pin** vocabulary from the
`wrangler-style` and `style` skills. Every file is **vanilla HTML + CSS only** (no React, no JS
framework) and renders standalone when opened directly or dragged into a prompt — that's also how to
use it: attach the files you need to a Claude Design Labs prompt to ground a generation, or sync the
whole folder as a design system via `/design-sync` in a local Claude Code session so Design Labs emits
code matching this idiom. Dark-only, matte, no glow — there is no light mode.

**The one rule underneath every file here: nothing does two jobs.** Signal reports state and nothing
else; Gate is the one Signal you can turn; Stamp is a plain fact with no colour; Ref is the only thing
that links to another record; Door is the only thing that carries an action colour — and it never
borrows a status hue to mean "click me."
