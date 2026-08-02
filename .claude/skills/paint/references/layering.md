# Layering — how a pixel-perfect surface is actually built

> "A single one-layer element does not need to bear the weight of accuracy —
> using opacity and stacking elements can achieve it." — Jac, 2026-08-02

The failure mode this file exists to kill: staring at one `background:` or one
`box-shadow:` and tuning its numbers harder and harder, trying to make a single
declaration do the work of six. It never converges. The mockup's surface was
*accumulated*, so the recreation has to be accumulated too.

---

## 1. The stack model

Build every non-trivial surface as an ordered pile. Cheapest and broadest at
the bottom, fewest and hardest at the top.

| # | Layer | Job | Typical alpha |
|---|---|---|---|
| 1 | **Base fill** | the local color, at the correct **value** | 1.0 |
| 2 | **Form modeling** | which way the surface turns toward the light | 0.04 – 0.18 |
| 3 | **Edge construction** | bevels, plate rings, cut corners | 0.10 – 0.35 |
| 4 | **Etching / incised marks** | engraved lines, stamps, scribes | 0.12 – 0.30 |
| 5 | **Texture / grain** | the material's tooth | 0.03 – 0.06 |
| 6 | **Temperature wash** | warm/cool shift over the whole plate | 0.03 – 0.08 |
| 7 | **Accents** | the few opaque, hard marks | 0.7 – 1.0 |

Rules of the stack:

- **One job per layer.** If you can't name a layer's single job in four words,
  split it or delete it.
- **Never re-cover the whole element to fix one thing.** That is the painting
  equivalent of a full repaint, and it buries everything underneath.
- **Lean-to-fat.** Broad, thin, low-alpha layers underneath; small, opaque,
  decisive marks on top. Reversing this makes the surface read plastic.
- **Add, don't tune.** When something is 90% right, the last 10% is a new
  layer at 6–10% alpha, not a bigger number on an existing one.
- **Layer count is not a cost you're paying.** Six background layers on one
  element is normal and cheap; six extra DOM nodes is also fine in a
  recreation. Accuracy first — the *port* is where you decide what's worth
  carrying into the real codebase.

### Where the layers live

Three carriers, in order of preference:

1. **Multiple `background-image` layers on one element** — comma-separated
   gradients composite bottom-to-top-of-list = front-to-back. Free, no DOM.
2. **`::before` / `::after`** — when a layer needs its own blend mode,
   clipping, transform, or `filter`.
3. **Extra absolutely-positioned `<span>`/`<i>` children** — when you need
   more than two extra layers, or independent z-order between siblings.

```css
/* one element, five layers, no extra DOM */
.plate {
  background:
    /* 6 grain          */ url("data:image/svg+xml,…") ,
    /* 5 corner falloff */ radial-gradient(120% 100% at 8% 0%, #fff2 0%, #fff0 42%),
    /* 4 top sheen      */ linear-gradient(#ffffff14, #ffffff00 38%),
    /* 3 bottom shade   */ linear-gradient(#00000000 62%, #0000001f),
    /* 1 base fill      */ linear-gradient(#232830, #232830);
}
```

---

## 2. Recipes

### Bevel / raised plate edge

Two **clipped solid rings**, not `inset box-shadow`. (This is the recipe the
origin session proved — inset shadows blur across the corner cut and read
mushy at 3x.)

```css
.plate { position: relative; background: #232830; }
.plate::before,               /* light ring, top-left */
.plate::after {               /* dark ring, bottom-right */
  content: ""; position: absolute; inset: 0; pointer-events: none;
  border: 1px solid transparent;
}
.plate::before { border-top-color: #ffffff2e; border-left-color: #ffffff1c; }
.plate::after  { border-bottom-color: #00000059; border-right-color: #0000003d; }
```

Recessed/engraved plate = swap the two (dark on top-left, light on
bottom-right). A **thicker** bevel is two rings of *each*, the outer at half
the alpha of the inner — not one 2px ring.

### Etching / incised line

An incised line is never one line. It is a **dark line plus a light line
offset by 1px** — the light one on the side the light comes from.

```css
/* horizontal scribe across a plate, light from top-left */
.scribe {
  height: 2px;
  background:
    linear-gradient(#00000000 0 1px, #ffffff22 1px 2px),  /* lower lip, lit */
    linear-gradient(#0000006b 0 1px, #00000000 1px 2px);  /* the cut itself */
}
```

Engraved **text** is the same trick with `text-shadow`:
`text-shadow: 0 -1px 0 #00000080, 0 1px 0 #ffffff1f;` — dark above, light
below for incised; reverse for embossed. Keep both under 0.35 alpha or it
reads as a drop shadow.

### Shading / form turning

Layer **transparent-to-alpha gradients**, one per direction the form turns.
A cylinder is not one gradient — it is a light-side gradient, a core-shadow
band, and a reflected-light band that must stay **darker than the lightest
halftone**.

```css
.barrel {
  background:
    linear-gradient(90deg, #00000000 78%, #ffffff12 96%),   /* reflected light */
    linear-gradient(90deg, #00000000 52%, #00000047 74%),   /* core shadow     */
    linear-gradient(90deg, #ffffff1a 6%,  #ffffff00 34%),   /* light family    */
    #2b3038;
}
```

The value check that catches 90% of shading errors: **reflected light inside a
shadow must never be lighter than a halftone in the lit area.** Run
`diag.py --values` — if the reflected-light band jumps a value bracket, drop
its alpha.

### Matte — no glow

The house language is matte. A colored blurred `box-shadow` around an accent
is banned. Build the same "it's lit" read with:

```css
/* WRONG: box-shadow: 0 0 12px #ff7e1f80; */
.signal {
  background: #ff7e1f;
  box-shadow: 0 0 0 1px #ff7e1f2e;            /* one hard hairline halo */
}
.signal-bed { background: #ff7e1f0f; }         /* a low-alpha wash behind */
```

Hairline + wash, both hard-edged. The perceived brightness comes from the
*value gap* to its surround, not from a blur.

### Gradients that don't band

Two fixes, both layer-shaped:

1. Add a **third stop** at the midpoint with a slightly off-linear alpha
   (a 0.5 stop at 0.42 alpha instead of 0.5 reads far smoother).
2. Put a **3–5% grain layer on top** — noise dithers the banding away. This is
   the single highest-value cheap layer in the whole stack.

### Grain / texture

```css
.grain::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  opacity: .045; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,\
<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>\
<filter id='n'><feTurbulence baseFrequency='.9' numOctaves='3'/></filter>\
<rect width='120' height='120' filter='url(%23n)'/></svg>");
}
```

Brushed metal = `repeating-linear-gradient(90deg, #fff0 0 2px, #ffffff08 2px 3px)`
at ~0.05 with `overlay`. Keep grain **under 6% alpha** — above that it stops
being material and starts being noise. Describe texture through changes in
value, edge, direction and rhythm — never by drawing every particle.

### Temperature and saturation — without white

White lightens, **but it also cools and desaturates**. Three correct moves:

| Want | Do |
|---|---|
| Lighter, same warmth | layer the **lighter neighboring hue** at low alpha, not `#fff` |
| Warmer | `linear-gradient(#c2925a12, #c2925a00)` over it, `mix-blend-mode: soft-light` |
| Cooler | same with a steel-blue, e.g. `#7d94ad14` |
| Less chromatic | a low-alpha **neutral gray** wash at the same value, `soft-light` |
| More chromatic | repeat the base hue at 8–12% with `mix-blend-mode: color` |

A wash is reversible and composable; editing the base hex is neither. Reach
for the wash.

---

## 3. Edge hierarchy

Not every boundary is equally sharp. This is the most frequently missed
quality in a copy — and it is a *composition* tool: edges route the eye.

| Edge | Reads as | CSS |
|---|---|---|
| **Hard** | focal point, cut metal, type | `1px solid` at ≥0.45 alpha, or a clipped solid ring |
| **Firm** | secondary plate boundary | `1px solid` at 0.18–0.30, no gradient |
| **Soft** | a form turning away | a 2–4px transparent-to-alpha gradient band instead of a border |
| **Lost** | value merge — deliberate | **no border at all**; the two fills sit within ~4% lightness |

Method: sharpen near the focal point, soften every turning form, and lose the
edges where adjacent values merge in the mockup. If your recreation looks
"cut out" or "sticker-like" compared to the mockup, you have too many hard
edges — that is almost always the diagnosis.

---

## 4. Blend modes — which one, when

| Mode | Use for |
|---|---|
| `soft-light` | temperature washes, gentle shading — the default, safest |
| `overlay` | grain and texture; punchier than soft-light |
| `multiply` | shadows, cast shadows, dirt in recesses |
| `screen` | small lights, sheen, specular ticks |
| `color` | shifting chroma while holding value |
| `luminosity` | shifting value while holding hue |
| *(none)* | anything where a plain alpha composite already matches |

Blend modes need a stacking context to behave — if a blended `::after` bleeds
past its plate, give the parent `isolation: isolate`.

---

## 5. Debugging a stack

- **Toggle one layer at a time.** Comment a single background layer out,
  re-shoot, diff. If nothing changed, the layer is dead weight — delete it.
- **Alpha-hunt from below.** When a stack is close but flat, raise the *lowest*
  suspect layer's alpha until it's visibly wrong, then halve it twice.
- **Check in grayscale.** `#stage { filter: grayscale(1) }` — most "the color
  is off" reports are actually value errors and vanish when you fix the value.
- **Squint before you zoom.** `diag.py --squint`. A stack that fails at 25%
  scale cannot be rescued by another layer at 100%.
- **Count your hard edges.** More than a handful per element cluster and the
  edge hierarchy has collapsed.
