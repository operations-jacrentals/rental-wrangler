---
name: paint
description: The guided design pipeline — Gemini inspiration → Canva composition → a critical read of that Canva file through the MCP → Figma components → gated code. Drives the whole run station by station and ALWAYS ends every turn by telling Jac the single next thing to do. Reach for it whenever a new card, screen, row, popup or visual element is being designed, whenever Jac has a mockup image or a Canva design he wants turned into real UI, whenever he asks "what's next" mid-design, or on an explicit /paint. Its centre of gravity is the CANVA CRITIQUE: Canva is Jac's most fluent tool, so the big structural decisions get made and challenged THERE — where he can fix them in seconds — instead of surviving into Figma or code where they cost hours. Carries the old pixel-recreation method as a FALLBACK lane for images with no editable source. NOT for building UI from a text spec (wrangler-style + style) and NOT for triaging a functional bug (wrangler-fix).
---

# /paint — the guided run, station by station

Rewritten 2026-08-03. The old `/paint` was a pixel-recreation method: take a PNG,
rebuild it in CSS, chase the diff. It worked — the Halo card came out byte-exact,
`mean delta 0.000` — and it cost **103 minutes, 1,587 model turns and ~2M tokens**
to recover structure *that was never in the file*.

Jac's diagnosis of why:

> "I've been working on this UI stuff for over a week, burning tokens, and not
> making progress."

The break was never `/paint` and never the inspiration. It was that Jac makes real
structural decisions in Canva — what groups with what, relative sizes, where things
sit — and then **exports a PNG, which destroys every one of them**. Recreation then
pays, forensically, to guess back what he already knew.

So the method inverts. Canva stops being a step that throws work away and becomes
the step where the design is *interrogated*, because it is the tool Jac is fastest
in and the one whose output can actually be read.

## The one hard rule

**Every turn ends by naming the single next action, and whose it is.**

Not a status report. Not options. One line, at the bottom, in this shape:

> **Next — you:** in Canva, name the five bar rects `bar-1`…`bar-5` and group them
> as `slots`. Tell me when done.

or

> **Next — me:** building the Chip component in Figma. Nothing needed from you.

If a turn ends without that line, the skill has failed. Jac should never have to
ask "what now".

## The stations

| | station | whose hands | gate to leave |
|---|---|---|---|
| **S0** | Frame the job | both | the card, its states, and the row count are written down |
| **S1** | Gather inspiration | Jac | 1–3 references on disk, opened |
| **S2** | Compose in Canva | Jac | he says it's laid out |
| **S3** | **Read + critique** | me | the friction report is delivered |
| **S4** | Fix in Canva | Jac | every finding answered or waived |
| **S5** | Handoff gate | me | all gate criteria pass — I say "ready", explicitly |
| **S6** | Build in Figma | me | components exist with variants + bound variables |
| **S7** | Nudge in Figma | Jac | he says it's right |
| **S8** | Code + gate | me | pixel gate green, committed |

S3↔S4 loops. Nothing else does.

### S0 — Frame the job

Before any picture exists, get three things on the record, because every one of
them changes what gets drawn:

1. **What is it** — a card, a row, a popup, a whole screen.
2. **Which states** — default, hover, open, selected, empty, error. A state not
   drawn is a variant not built, and it comes back as rework. Ask explicitly.
3. **How many on screen at once** — this sets the node and effect budget (see
   `references/canva-critique.md` → *cost*). A design that is fine once can be
   unusable at sixty.

### S1 — Gather inspiration

Gemini or any image model. This step does **not** change and is not the problem.

What changes is the picture's job: **it is a reference, not a specification.** AI
images depict interfaces that often cannot exist — text that isn't text, spacing off
any grid, lighting no CSS produces. Matching one pixel-for-pixel means inheriting an
image model's mistakes as requirements. Take the two or three ideas that are good.

Say this out loud when handing back references. Jac has lost weeks to treating a
depiction as a spec.

### S2 — Compose in Canva

Jac's hands, Jac's pace. Do not hover. He is faster here than anywhere else and the
whole point of the pipeline is to use that.

One thing to tell him before he starts, because it is cheap up front and expensive
later: **drop the reference in as a locked, dimmed underlay and build over it with
real objects.** Tracing produces structure; pasting produces a blob.

### S3 — Read the Canva file and be critical

**This is the station the whole skill exists for.**

    mcp__Canva__search-designs   → find it
    mcp__Canva__read-design      → design_id, open_transaction: true,
                                   fields: [design_metadata, page_metadata, design_content]

With a transaction open, `design_content` is the full document as markdown: every
element with a `[locator_id]`, its `pos:` and `size:`, rotation, opacity, fills,
strokes, and complete typography. A single page of a real design ran **52,275
characters**. That is a structured document — critique it like one.

Then deliver a **friction report**. Full checklist and the measured evidence behind
each item: `references/canva-critique.md`. The five families:

- **Blocking** — raster where structure is needed, text baked into an image,
  flattened groups. These make extraction impossible, not merely awkward.
- **Library** — unnamed elements, repeated things ungrouped, one component drawn
  twice inconsistently, missing states. These produce a wrong library, silently.
- **Cost** — effect and node budget against S0's row count.
- **Fragility** — fractional geometry, near-miss values, near-miss colours,
  contrast and colour-blind separation floors.
- **Order** — stacking is paint order; alignment that nearly lines up.

Rules for the report itself:

1. **Quantitative, never vibes.** "Your five bars sit at x = 215.0, 247.4, 279.7,
   314.1, 348.9 — gaps of 32.4, 32.3, 34.4, 34.8. Is the widening deliberate?" A
   PNG can never prompt that question; this is the entire value of reading the
   source.
2. **Ask, don't assume.** Every near-miss is either intent or drift and only Jac
   knows which. Guessing is how a mockup's accident becomes canon.
3. **Say what it will cost, in the currency of this project.** Not "blur is
   expensive" — "each bar carries a blur; at sixty rows that is 840 compositing
   layers, and the measured p90 frame went 16.8ms → 54ms."
4. **Surface what he has not considered.** Missing states, the second breakpoint,
   what an empty list looks like, what happens when the name is forty characters.
   This is the part he explicitly asked for and it is the part a checklist alone
   will not produce — read the design as someone who will have to build every state
   of it.
5. **Rank by cost of being wrong**, worst first — blocking, then library, then
   cost, then fragility, then order. Never lead with a hairline.

### S4 — Fix in Canva

Hand back a numbered list of *actions*, not observations. Each one: what to change,
where, and why it matters downstream. Then wait.

Re-read after he's done and diff against the previous read. Say plainly what got
fixed and what is still open. Loop until the gate passes or he waives an item —
a waiver is fine and gets recorded, silence is not.

### S5 — The handoff gate

Do not advance on a feeling. Every one of these must be true, and I say so item by
item:

- [ ] Every element that needs independent styling is a real object, not inside a raster
- [ ] All text is text
- [ ] Repeated things are grouped and meaningfully named
- [ ] Every component that needs variants has all its states drawn
- [ ] No unanswered "deliberate or drift?" question
- [ ] Node and effect budget reviewed against S0's row count
- [ ] Paint order confirmed for every overlap

Then say it explicitly: **"Ready to move to Figma."** That sentence is the gate.

### S6 — Build in Figma

My hands, not his. He has said plainly he has no Figma experience — creating
components is the hard half and it is mine. Load `figma-generate-library` **and**
`figma-use` together and follow their phases. Figma writes are strictly sequential;
never parallelise them.

### S7 — Nudge in Figma

His hands, and this is the easy half: pick a variant from a dropdown, drag a number,
move a box. If he is having to draw anything, S6 was done badly — go back and build
the component properly rather than asking him to compensate.

### S8 — Code, then gate

`get_design_context` on the frame, generate against the existing parts kit, then
prove it: `docs/design/halo-elements/_ref/check.py` with `--full`. The pixel gate is
not ceremony — it caught a wrong `clip-path` that no part-level test could see,
because the broken variant was the one its own gate didn't cover.

## The fallback lane — no editable source

When Jac is handed an image with no Canva or Figma behind it, the old recreation
method is still right and still the best tool for it. It is a lane, not the road.

Its full text — the eight iron rules, the diagnostic ranking, the phases, the grid
pass — is `references/recreation.md`. The two that generalise beyond it:

1. **The target image lives ON DISK and you have OPENED it.** Two full rebuild
   passes were once wasted working from a remembered description while the mockup
   sat unopened in the uploads folder.
2. **Relationships, not objects.** A perfectly rendered element in the wrong place
   is still wrong. Match intervals, proportions and value gaps before perfecting
   anything.

And the layering doctrine — no single element bears the accuracy, stack thin
translucent layers — remains how any surface gets built, in either lane:
`references/layering.md`.

## Scripts

| script | use |
|---|---|
| `scripts/shot.mjs` | render an HTML file at native size (never resized) |
| `scripts/refs.py` | full-colour / grayscale / posterised / crop reference set |
| `scripts/cut.py` | element-aligned grid cut, same cells on both images |
| `scripts/compare.py` | stack two renders for eyeballing |
| `scripts/diag.py` | numeric diff diagnostics |
| `scripts/probe-example.py` | PIL geometry sampling |

The kit's own gate, `docs/design/halo-elements/_ref/check.py`, supersedes
`compare.py` for anything that must be *proven* rather than eyeballed — it prints
mean/max delta and a pass verdict. Use `--full`: a box-sized verify page has a
measurable rasterisation floor (0.288 mean on a fractional clipped box) that will
hide a real 1px defect.

## Score honestly

Report the number the gate printed, never a rounded impression of it. If a residual
is the harness rather than the work, prove that with a control — render the
*original's own untouched markup* through the same harness and show it scores the
same. That exact control saved a byte-perfect part from being "fixed" into a broken
one.
