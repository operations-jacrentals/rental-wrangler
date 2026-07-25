# Labs — Prompt 0.0 · Lock the Atoms (the builder elements)

**This is a review-and-refine pass, not a regenerate.** The atoms already exist in the kit,
code-accurate on our real tokens. Open them, scrutinize every inch, refine what's off, LOCK.

**Canvas — open these atom cards from the `rw-design-system` folder** (they each render one atom
with its variants):
- `foundations/type.html` — **texts** (the two voices: stamped-mono vs body-sans)
- `elements/stamp.html` — **quiet facts / IDs / numbers**
- `elements/signal.html` — **flags** (read-only state, filled vs outline, all state colours)
- `elements/gate.html` — **turnable state** (the chevron)
- `elements/ref.html` — **linked records**
- `components/chips.html` — the **chip** matrix
- `elements/door.html` + `components/buttons.html` — **buttons / actions** (commit · +Add · money · destroy · ghost · cancel · active-toggle)
- `components/fields.html` — **inputs / contact links**

---

## ⭐ North Star — the one thing this pass decides
Scrutinize, refine, and **LOCK** the builder atoms — the smallest pieces every screen is made of.
Once locked, no later screen gets to re-open them.

## 🚫 Out of scope (NOT here)
- **Containers** — the card frame, card header, list row, section/plate, panel/popup. That's the very
  next tier; don't design them here.
- **Any screen layout** — shell, detail view, per-card content. Later.
- **The palette / type / token VALUES** — settled canon. The hexes are CVD-tuned and locked from prior
  colour work; don't reopen them unless one is genuinely broken (tell me if so).

## ♻️ Inherit (settled — do not redesign)
- The **palette, the two type voices, and the tokens.** The atoms are built *on* these; they're the
  ground floor and they're already locked.

## The ask
Judge the atoms as **one family**: do the chips, buttons, flags, stamps, refs read as siblings — same
control height, same baseline, same radii, same weight logic? Walk each atom's variants and refine
spacing / weight / size / states until each is *exactly* right. Note any inconsistency across the set.
When an atom is right, it's **locked** — it becomes a carried-forward element on every screen after.

## After you lock
Tell me what (if anything) you changed. I fold your changes into the code-accurate kit and **re-sync
the design system**, so the grounding every later screen reads = your locked atoms. Then we design the
**containers** on top of them.
