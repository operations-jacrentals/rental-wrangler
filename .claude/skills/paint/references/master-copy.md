# The master-copy workflow, translated to HTML/CSS

Jac's brief, 2026-08-02. The left-hand discipline is the copyist's; the
right-hand column is what it means when the "surface" is a `#stage` div and
the "paint" is stacked CSS layers.

**The central rule: copy the artwork's *relationships*, not its individual
objects.** Proportion first, then value, edges, color, and finally detail.
A perfectly rendered eye in the wrong location is still wrong.

---

## 1. Define the target

Before touching the surface, decide:

- Is this an **observational study** or an **extremely accurate reproduction**?
- Which transfer method: sight-size, comparative measurement, grid, projection,
  or tracing?
- Are you reproducing the original dimensions and medium?
- Which qualities matter most: composition, likeness, color, texture, or
  brushwork?

> **In CSS:** an exact copy means `#stage` at the mockup's **native pixel size
> and native aspect ratio**. If the ratio differs, the entire composition
> drifts and no per-element work recovers it. "Same medium" = build it with the
> same construction the real codebase would use (real borders, real gradients),
> not by slicing the mockup into images. Declare the target out loud in the
> first message so the stop condition is agreed before work starts.

## 2. Analyze the original

Study the artwork as an arrangement of abstract shapes.

**Composition** — the dominant directional lines; the large light and dark
masses; the focal point; repeated angles, curves and intervals; areas of visual
rest; the balance of positive and negative space. Reduce the artwork to three
values (light / middle / dark) — this "notan" reveals the underlying design
more clearly than the subject matter does.

**Drawing structure** — the outer envelope; centerlines and major axes; the
highest, lowest, leftmost and rightmost points; major intersections and
alignments; important negative shapes; relative widths, heights and distances.

**Value structure** — lightest light; darkest dark; the shadow family; the
light family; halftones; reflected light; cast shadows; where contrast is
strongest and weakest.

**Color structure** — hue; value; chroma/saturation; warmth vs coolness; local
color vs light-influenced color. *A color can have the correct hue and still
look wrong because it is too light, too dark, too saturated, or too cool.*

**Edge structure** — classify major edges as **hard / firm / soft / lost**.
Edge hierarchy is one of the most frequently missed qualities in copies. Not
every boundary should be equally sharp.

> **In CSS:** this is the PIL sampling pass (`scripts/probe-example.py`), and
> it is *measurement*, not looking. Produce, in writing, before any markup:
> the bbox of every major mass; the x/y of every alignment; a 3-value notan
> (`scripts/refs.py`); the lightest and darkest sampled hex; and an edge
> classification per boundary. The edge table drives `references/layering.md`
> § Edge hierarchy directly.

## 3. Prepare the reference and workspace

Use the highest-resolution reference available. Ideally obtain a full-color
image, a grayscale version, a cropped detail of the focal area, a three-value
or posterized version, and information about the original size and medium.
Work under neutral, consistent lighting. Prepare the surface according to the
medium — a lightly **toned ground** is easier to judge than brilliant white.

> **In CSS:** `python3 scripts/refs.py <mockup> <outdir>` generates the whole
> set. "Neutral lighting" = render and compare on a neutral dark backdrop, at
> 1:1, no browser zoom, no OS scaling — and never judge a color against a
> screenshot that has been resized. **Toned ground:** give `#stage` a mid-value
> steel base fill before anything else. A white or pure-black stage makes every
> value you lay on it read wrong.

## 4. Establish the composition

Transfer only the major structure at first. Methods: sight-size (copy and
reference at the same visual size), comparative measurement (everything
compared to one chosen unit), grid (for controlled enlargement/reduction),
proportional divider, tracing/projection (when the objective is surface and
color study rather than drawing practice).

Mark, in order: outer boundaries → major vertical and horizontal alignments →
primary diagonals → large negative spaces → centers of major forms. Keep the
lines light and easy to correct.

> **In CSS:** sight-size is free — render at native size and stack-compare
> (`scripts/compare.py`). The **grid** is Phase 2's cell cut. "Light and easy
> to correct" = flat blocked-in rectangles with a single `background`, no
> gradients, no text, no borders yet. Resist adding a border to a block-in
> rectangle: a border reads as a finished edge and hides a placement error.

## 5. Construct the drawing

Work from large forms toward smaller ones: overall envelope → major masses →
axes and gesture → large internal landmarks → negative-space comparison →
refined contours → principal shadow shapes.

**Do not begin with facial features, fingers, ornament, foliage, or texture.**
These details can make an inaccurate drawing feel temporarily convincing and
therefore harder to correct.

Check the drawing by stepping several feet away; viewing it in a mirror;
turning both reference and copy upside down; comparing vertical and horizontal
alignments; and photographing and overlaying the images. *An overlay should
reveal errors; it should not replace understanding them.*

> **In CSS:** the banned-until-later list is **icons, glyphs, ticks, hairlines,
> micro-labels, grain, and any `text-shadow`**. Every one of them makes a
> misplaced plate look plausible.
> The four checks are `scripts/diag.py`:
> `--squint` (step back), `--flip` (mirror + 180°), `--overlay` (the difference
> map), `--values` (posterized pair). Run `--overlay` to *locate* the error,
> then go read the mockup to *understand* it — a blind nudge-until-the-diff-
> shrinks loop produces a file nobody can maintain.

## 6. Make a clean value map

Before full rendering, establish a simple three- or five-value design:

1. Paper or ground → 2. light halftone → 3. dark halftone → 4. general shadow
→ 5. dark accent

Keep the light and shadow families clearly separated. Reflected light inside a
shadow should generally remain **darker than halftones in the illuminated
area**. At this stage the work should already read correctly from across the
room.

> **In CSS:** name five literal hexes — `--v1`…`--v5` — sampled from the
> mockup's posterized version, and build the entire block-in from *only* those
> five. Any sixth value has to earn its place. The across-the-room test is
> `diag.py --squint`; it is a **gate**, not advice — do not proceed to color
> while it fails.

## 7. Build the monochrome underpainting

The grisaille. A reliable order: thin overall tone → draw major forms with
diluted paint → mass in the shadow family → wipe/paint out the largest lights
→ model major planes with middle values → a few dark accents → refine
transitions and edges.

The underpainting solves **proportion, volume, lighting, value relationships,
and major edges**. Avoid polishing it into a finished black-and-white
painting — excessive monochrome detail gets buried, or makes the final color
look lifeless.

> **In CSS:** set `#stage { filter: grayscale(1) }` and work there until the
> grayscale recreation matches the grayscale mockup. This is the single
> highest-leverage step in the whole workflow and the one most often skipped.
> "Don't over-polish" translates exactly: no grain, no etching, no accents
> during grisaille — those are layers 4–7 and they go on *after* color.

## 8. Plan the palette

Mix organized color strings before painting: shadow mixtures, dark halftones,
middle halftones, light-facing planes, highlights, warm and cool variations.
Compare mixtures against the reference through a viewing aperture or a small
neutral-gray card. **Judge value first, then temperature, then saturation.**

Avoid using white merely to lighten — white also cools and desaturates.
Sometimes a lighter neighboring pigment produces a cleaner result.

> **In CSS:** a `:root` token block, authored *before* the color pass and not
> improvised mid-build — `--shadow`, `--halftone-d`, `--halftone-m`,
> `--plane-lit`, `--highlight`, plus `--wash-warm` / `--wash-cool` as the two
> temperature washes. The "viewing aperture" is a PIL point-sample of both
> images at the same coordinate, compared as hex pairs — never an eyeball
> judgement across two windows. The no-white rule is a hard one; see
> `references/layering.md` § Temperature and saturation.

## 9. Lay in the first color pass

Place the largest color families first: background → large shadow masses →
large light masses → major local colors → broad temperature shifts. Keep this
pass thin and relatively simple, and preserve the value structure underneath.
Do not chase small color variations yet — the purpose is to establish the
painting's overall **color climate**.

> **In CSS:** base fills only (stack layer 1). No gradients, no rings, no
> etching. Re-run `diag.py --values` after this pass: if any value bracket
> moved, the color pass broke the value structure and that is fixed *now*,
> not later.

## 10. Model form with successive layers

Refine the major planes and transitions using the technique that resembles the
original: **glazing** (transparent dark or saturated color over a dry layer),
**scumbling** (thin lighter opaque paint dragged over darker), **wet-into-wet**
(soft transitions), **opaque placement** (solid lights, decisive corrections),
**broken color** (separate strokes that mix optically at a distance).

Each layer should have a specific job. Avoid repeatedly covering the entire
painting without a clear reason. Leaner/thinner layers underneath; richer or
thicker layers above.

> **In CSS — the five techniques have exact analogues:**
>
> | Technique | CSS |
> |---|---|
> | Glazing | a low-alpha overlay with `mix-blend-mode: multiply` or `color` |
> | Scumbling | a low-alpha **lighter** overlay, `soft-light` or `screen`, often over grain |
> | Wet-into-wet | a `transparent → alpha` gradient band instead of a border |
> | Opaque placement | a full-alpha layer or a hard 1px ring — the accents |
> | Broken color | a `repeating-linear-gradient` or tiled noise that mixes optically |
>
> "Lean to fat" = broad low-alpha layers at the bottom of the stack, small
> opaque marks at the top. Full recipes: `references/layering.md`.

## 11. Reconstruct the edge hierarchy

Once the forms are established, deliberately organize the edges: sharpen near
the focal point; soften turning forms; lose edges where adjacent values merge;
keep secondary areas quieter; **avoid outlining every object**. Edges guide the
eye — they are part of the composition, not just boundaries around objects.

> **In CSS:** a dedicated pass, not a side effect. Walk the edge table from
> § 2 and set each boundary to its class per `references/layering.md`
> § Edge hierarchy. If the recreation reads "cut out" or "sticker-like" next
> to the mockup, the diagnosis is nearly always *too many hard edges*.

## 12. Add selective details

Details come late because they depend on everything beneath them: essential
features, material-specific texture, small reflected lights, accents in hair /
fabric / metal / foliage / architecture, and the distinctive marks that
establish likeness or character.

Describe texture through changes in **value, edge, direction and rhythm** — not
by drawing every visible particle. The focal area can support the greatest
detail; peripheral areas should stay broader and quieter.

> **In CSS:** now — and only now — the glyphs, ticks, hairlines, micro-labels,
> stamped mono text, grain and `text-shadow` etching. Detail density is a
> gradient across the frame: full at the focal element, deliberately reduced at
> the periphery. Matching peripheral detail 1:1 is usually *over*-copying — the
> mockup is quieter there than you think.

## 13. Perform a final comparison

Compare in this order:

1. Overall silhouette → 2. placement and proportion → 3. large value masses →
4. focal contrast → 5. color temperature → 6. saturation → 7. edge hierarchy →
8. detail

**Correct the largest discrepancy first.** A small highlight should never take
priority over a misplaced head, an incorrect shadow mass, or an overly bright
background.

> **In CSS:** this is the ordering the Phase-2 analysts report against (the
> `rank` field) and the order the applier merges in. Full-frame, your own eyes,
> at 1:1 — cell agents structurally cannot see silhouette or cross-cell
> placement.

## 14. Finish and unify

The final pass may deepen a few dark accents, restore selected highlights,
soften overactive passages, glaze an area to adjust temperature, scumble to
create atmosphere, repeat key colors across the composition, and **remove
unnecessary detail**.

Stop when additional marks no longer improve the larger relationships.

> **In CSS:** deliberately repeat two or three accent hexes across distant
> elements — it is what makes a frame cohere — and delete the layers that
> toggle-testing proved dead. The stop condition is Jac's read, not a score.

---

## Order of importance — the diagnostic hierarchy

When diagnosing a copy:

1. Composition and placement
2. Proportion and drawing
3. Value structure
4. Edge hierarchy
5. Color temperature and saturation
6. Surface handling
7. Fine detail
