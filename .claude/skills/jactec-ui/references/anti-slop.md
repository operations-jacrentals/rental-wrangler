# Anti-slop — how to not look AI-generated

"AI slop" is UI anyone can tell was generated: generic defaults, no point of view,
inconsistent details. Our defense is a strong, specific identity (the yard
data-plate) plus the discipline below. The goal isn't novelty for its own sake — it's
that every element is **deliberate** and **part of one system**.

## The three banned AI-default looks

Current generated design clusters around three looks. We are **none** of them:

1. **Cream + serif + terracotta** — warm `#F4F1EA` background, high-contrast serif
   display, terracotta accent. (We're dark steel + condensed sans + safety-orange.)
2. **Near-black + one acid accent** — flat near-black with a single
   acid-green/vermilion pop doing all the work. (We carry a full *semantic* status
   registry; orange is reserved for selected/ignition/linked, not a lone neon.)
3. **Broadsheet** — hairline rules, zero border-radius, dense newspaper columns.
   (We use radii, soft fills, a tactile elevation language, and the hazard signature.)

Where a brief explicitly asks for one of these, the brief wins. Ours never does.

## The specific tells (and the fix)

- **Unstamped lint-family element** — a pill/flag/add/button/field with no
  `data-r`. The #1 tell it bypassed the builders; R0 pulses it red. → route through a `§5` builder.
- **Pure `#000` / `#fff`** — the amateur/AI default. → near-black `--bg`, near-white
  `--txt`; reserve max contrast for orange only.
- **Dead `#888` greys / mixed-temperature neutrals** — generated palettes default to
  hueless grey. → use the token neutrals (one temperature, faint cast).
- **Drop shadows on dark cards / mixed elevation** — invisible-or-muddy on dark, and
  alternating shadow/border/flat across siblings screams generic dashboard. → one
  elevation language: lightness + the two defined shadows + the rings.
- **Everything at medium contrast (grey soup)** — nothing leads. → spend high
  contrast on data/status/accent; let structure recede. (And avoid the low-contrast fad.)
- **Body in a condensed/stamped face, or labels in a system sans** — Inter / Roboto /
  Arial / system-ui / Space Grotesk for labels is a tell. → two voices only: Saira
  Condensed (stamped) vs Geist (read).
- **Arbitrary spacing (13px, 7px) / inner padding tighter than outer** → one math
  scale; outer ≥ inner.
- **Mismatched nested radii · full-strength icon out-shouting its label · stacked
  redundant dividers · mathematically-centered chevron that looks off** → inner =
  outer − gap; dim icons to text weight; one divide per boundary; optical-align glyphs.
- **Native `title=` / native date picker / `alert()` / raw error string** → R23
  `data-tip` / R22 `dateField` / R19 attention-flash pointing at the fix.
- **Generic motion** — `transition: all .2s ease`, bouncy/overshoot easing, scattered
  ambient micro-interactions. → fast crisp ease-out, the named keyframes, ONE
  orchestrated beat.
- **Template tropes** — the hero "big number + small label + gradient accent",
  ornamental `01 / 02 / 03` markers that don't encode a real sequence, decorative
  glassmorphism/gradients. → cut them; structure must encode something true.
- **Ranch reading western-first** — wood/rope/saloon-serif as a dominant skin. → keep
  it copy + a little leather-tan; litmus: industrial-rental-yard before western.
- **Shipped in one theme only** / **a new rule with no `RULE_META`** / **missing
  `:focus-visible`** / **contrast under AA** / **meaning in color alone** → all
  incomplete work.

## Deviations we make ON PURPOSE (name them, don't drift into them)

- **Density over Hobday's 16px-body / ~70-char-line.** A dense ops grid runs the
  28/15/13/12/11/10/9.5px scale and narrow numeric columns deliberately. Enforce a
  minimum *legible* size and **split into more views rather than shrink past it** —
  density must never become cramped. This is the ONE place we deviate from the safe rules.

## Process gates (from `brainstorming` + CLAUDE.md)

- If `brainstorming` is opted in, its HARD-GATE forbids writing code before a design
  + spec is presented, approved, and saved to `docs/superpowers/specs/`.
- **Ask Jac any decision via the `AskUserQuestion` popup, never inline** (CLAUDE.md).
- Plan the token system FIRST (vendored `frontend` skill), then build, then
  **self-critique with a screenshot** and "remove one accessory" before showing Jac.
