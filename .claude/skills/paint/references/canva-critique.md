# The Canva critique — the friction report

Station S3. Read the Canva design as a structured document and be genuinely
critical of it, because Canva is where Jac is fastest and therefore where a
structural problem is cheapest to fix. The same problem found in Figma costs an
hour; found in code it costs a day; found after ship it costs a rewrite.

Every item below is grounded in something measured on this project, not in general
advice. Cite the evidence when you raise it — "blur is expensive" gets ignored,
"840 compositing layers at your sixty-row first paint" does not.

---

## What you can actually read

    mcp__Canva__read-design
      design_id: <D...>
      open_transaction: true
      filter: { fields: [design_metadata, page_metadata, design_content] }

With a transaction open you get the full page document as markdown. Measured on a
real single-page design: **52,275 characters**, containing per element —

```
## TEXT [PBQQ2blH22gMyjB0-LBtSmPRH50WXWFZF]
pos: 1709,4  size: 1068×74.56  rotation: 0  opacity: 1
regions:
  [0] "…" fontSize=12 fontWeight=bold color=#c2925a textAlign=start
      lineHeight=1.6 letterSpacing=0 fontRef=…
```

— element type, a stable locator id, position, size, rotation, opacity, fills,
strokes, and complete typography. Page dimensions and background come from
`page_metadata`.

Two cautions. A **plain read without a transaction returns only text**, which is
not enough to critique. And the coordinate convention should be sanity-checked
against the page dimensions on first use of any new design before you quote
numbers back at Jac.

---

## A · Blocking — these make extraction impossible

Lead with these. They are not "nice to fix"; nothing downstream works without them.

**A1 · Raster where structure is needed.**
An AI-generated PNG pasted in and drawn over is one opaque blob. Nothing beneath it
survives, and nothing inside it can be styled, re-coloured, or turned into a
component. If the design's substance is inside an imported image, the pipeline
stops here.
→ *Ask:* which parts of this need to change independently later? Those must be
rebuilt as real shapes over the reference, not painted onto it.

**A2 · Text baked into an image.**
Not text. Cannot be restyled, cannot become a component text property, cannot
change length, will not reflow. Every label, name, number and status word must be a
real text element.
→ *Detect:* count `## TEXT` elements against the words visible in the thumbnail. A
gap is baked text.

**A3 · Flattened groups where variants are needed.**
If two states are drawn as two flat pictures rather than two arrangements of the
same objects, they cannot become one component with two variants — they become two
unrelated components that drift apart.

---

## B · Library — these silently produce a wrong component set

**B1 · Unnamed elements.**
Canva element names become Figma component and layer names, which become code
names. `Rectangle 47` produces a library nobody can navigate.
→ *Ask for:* meaningful names on anything that will become a component, a variant,
or a bound property. Decorative one-offs can stay unnamed.

**B2 · Repeated things not grouped.**
Five segment bars drawn as five unrelated rectangles cannot become one component
with a count. Grouped and named, they become `slots` with a variable number of ticks.
→ *Detect:* elements with near-identical `size:` and a regular `pos:` progression.

**B3 · The same thing drawn twice, differently.**
The Halo card carries two PROMISED chips — one wide, one narrow. Same component,
two variants, *provided they were drawn consistently*. If their fills, strokes,
type or proportions disagree by small amounts, they read as two components and the
library forks.
→ *Detect:* compare fills, stroke widths, corner treatment and type between
lookalikes. Report every disagreement and ask which is correct.

**B4 · Missing states.**
A row usually needs default, hover, open and selected; a list needs empty; a field
needs error. A state not drawn is a variant not built and it returns as rework.
This is the single most common thing Jac has not considered — ask at S0 and again
here.
→ *Also ask:* what does this look like with a forty-character name? With no data?

---

## C · Cost — measured, against the row count from S0

The app's first paint is capped at **60 rows** (`app.js` → `VIRT_CAP = 60`), with
"Show more" adding 200 at a time. Everything below is per-card cost multiplied by
that.

Measured on the Halo card (real DOM, Playwright):

| | per card | at 60 rows |
|---|--:|--:|
| DOM nodes | **193** | ~11,600 |
| gradient-painted elements | 78 | 4,680 |
| CSS blur filters | 14 | **840 compositing layers** |
| SVG `feGaussianBlur` | 2 | 120 |
| shared `<defs>` | 603 nodes | **603 — paid once** |

Scroll held 60fps median at 60 cards, but the p90 frame went **16.8ms → 54ms**.
Visible stutter, not a freeze.

**C1 · Effects repeated per row.** Blur is the expensive one — each one forces its
own compositing layer. Twelve of the Halo card's fourteen blurs are on the segment
bars alone.
→ *Ask:* does this effect need to be on every row, or only the lit/open one? The
locked two-level mechanic (ledger #168) says `ROW = cartridge, opens by LIGHTING` —
so the expensive glow belongs to the open row, which is one at a time.

**C2 · Static art repeated per row.** The conduit costs **2 nodes** a card because
its 18 gradients live once in shared `<defs>` and each instance is a `<use>`. The
circuit field costs **76** because it does not.
→ *Flag:* any elaborate decorative element that is identical on every row is a
shared-defs candidate, worth roughly 40% of per-card nodes at zero visual cost.

**C3 · Node budget.** If a design is heading past ~200 nodes a card, say so while
it is still a Canva file.

---

## D · Fragility — these make the code brittle

**D1 · Fractional geometry.**
A fractionally-sized box carrying a clip-path rasterises against its *enclosing
stage*, so the same markup lands on a different pixel grid at different container
widths. Measured: the original's own untouched markup scored **mean 0.288 / max 84**
in a 944-wide stage and **0.000 / max 0** in the real 1292-wide one.
→ *Ask:* is this 914.5px width meaningful, or would 914 do? Whole pixels where the
value is arbitrary.

**D2 · Near-miss values.**
Halo's five bars sit at gaps of 32.4, 32.3, 34.4, 34.8. Deliberate widening, or
drift? **Only Jac knows, and a PNG can never ask.** This is the highest-value
question the whole station produces.
→ *Report the numbers and ask.* Never silently regularise — a mockup's accident
becoming canon is exactly how the ledger's near-misses happened.

**D3 · Near-miss colours.**
Ledger #152 records `#C28E54` against `--tan #c2925a` — two colours that should
have been one. Check every fill against the canon palette in `wrangler-style` and
flag anything close-but-not-equal.

**D4 · Contrast and colour-blind floors.**
Check text against its ground for WCAG, and red/yellow pairs for CVD separation.
Real failures found on this project: a gate badge at **2.4:1**, and the ledger's own
ruling that neon yellow `#ffe14d` had to be dimmed to `#eed44b` — *"`#eed44b` is the
floor"*. A design using brighter yellow than that is already outside canon.

---

## E · Order and alignment

**E1 · Stacking is paint order.**
The Halo canvas contains **zero `z-index`** — every overlap resolves by document
order alone. Canva's layer order therefore *is* the specification, and reordering
two layers changes the picture.
→ *Confirm* the intended front-to-back for every overlap, and record it. It is not
recoverable later from a flat image.

**E2 · Nearly-aligned things.**
Shared left edges, baselines, consistent gutters. Report anything within a few
pixels of aligning but not aligned, and ask which it should be.

---

## Writing the report

- **Rank by cost of being wrong**: blocking → library → cost → fragility → order.
  Never lead with a hairline while a plate is 6px off.
- **Numbers, not adjectives.** Quote the actual `pos:` and `size:` values.
- **Every finding is a question or an action**, never an observation. "The five bars
  have uneven gaps" helps nobody; "gaps are 32.4, 32.3, 34.4, 34.8 — deliberate
  widening or drift?" gets an answer.
- **Separate what you found from what you think.** Findings are read off the file.
  Recommendations are yours and should be labelled as such.
- **Then hand back a numbered action list** for S4 — what to change, where, and what
  it costs downstream if it isn't changed.
- **A waived item is fine and gets recorded.** Silence is not.
