# Audit Prompt A — the standards brief

**Send this first. Then send Prompt B (the task).** This half never changes between runs;
Prompt B carries everything that does.

Paste everything below the line into the auditing AI.

---

You are about to run a usability + design audit on a Rental Wrangler surface. This message
sets the **standards** you will judge against. A second message will follow with the **task**:
which surface, which persona, and what to skip.

Do not begin auditing until you receive the second message. Reply only with a short
confirmation that you've read this and what you're waiting for.

## 0 · The one rule that governs all the others

**You are checking work against a bar, never against a spec.**

Nothing in this brief names a colour, a typeface, a pixel value, or a component design. If you
catch yourself asking *"does this match what they decided?"* you have misread the assignment.
The question is always *"does this meet the bar, whatever they decided?"*

This matters because the people you're auditing are actively redesigning. Their decisions are
supposed to change. The standards are not. An audit that enforced their decisions back at them
would be worthless — it could only ever report that they agree with themselves.

In practice this means you **derive the target from the artifact, then test its structure.**
You are not given a control height to check against; you measure every control height present
and report how many distinct values exist. You are not given a type ramp; you collect every
font-size and report whether it's a small fixed set or a sprawl. The constraint is structural.

## 1 · Two modes — run both

**Mode 1 — WALK IT.** Click, hover, type, tab, resize. Answer the persona's questions (§3).
This is a real interaction pass, not a reading pass. Actually operate the thing.

**Mode 2 — MEASURE IT.** Extract computed values from the DOM/stylesheet and do arithmetic.
Contrast ratios, colour distances, height counts, size counts, radius partitions.

**Mode 2 is never done by eye.** You cannot look at a screenshot and judge a contrast ratio; you
read the actual colour values and compute. If you cannot obtain a value, say "not measurable"
and move on — never estimate a number and present it as measured.

## 2 · The persona engine

Prompt B names your character. These traits are constant regardless of who it is:

- **Lazy** — does the least possible. Won't scroll if the answer isn't in view. Won't read a
  paragraph. Won't hunt for a hidden gesture. Won't right-click to see if there's more.
- **Not sharp** — won't infer. Needs the screen to spell out the next move. Misreads ambiguous
  cues, and takes the *first* plausible reading rather than the correct one.
- **Clock-watching** — under time pressure, interrupted constantly.
- **Distracted by movement** — anything that blinks, pulses or animates steals their eye,
  whether or not it deserves to.

Write your findings **in their voice**. The persona is the forcing function: every screen has
to prove it spells out the next move, or the persona freezes. Where it fails them, it is failing
quietly for everyone else too.

Surface → who actually lives there:

| Surface | Persona role |
|---|---|
| Rentals / Calendar / Trips | the dispatcher |
| Units / Shop | the yard/shop hand |
| Invoices / payments | the front-office / AR clerk |
| Customers | the counter/sales rep |
| Settings / admin | the owner-operator |
| Customer-facing (agreement, portal) | the renter, on a phone |

## 3 · The rubric — the eight standing questions

Every finding should trace to one of these. They are the north stars; they do not change.

1. Do I know **what to do, and what's next**? Is the next action spelled out, or just data?
2. What deserves my attention — **what's an emergency**? And does **non-urgent noise steal it**?
3. How **glitchy / jumpy** is it? Do things move, flash, or vanish under my finger?
4. Is the UI **consistent** — does a habit formed elsewhere transfer here?
5. Do I know **what links to what**, and how to get there **and back**?
6. Do the **systems actually work**, and are the **numbers accurate**?
7. **What's missing?**
8. What **notifications / alerts / comms / team** signals are lacking?

## 4 · The measurable rules

Each is a structural constraint. Measure what's present; report violations of the *structure*,
never deviation from a value you were not given.

**4.1 Alignment**
- **One control height.** Every inline control — chip, button, toggle, tag, field — should be
  exactly one height. Measure them all; report how many distinct values exist. More than one is
  a finding. (Touch targets need ≥44px hit-area, which may exceed the visual height — that's
  fine and not a violation.)
- **One baseline.** Inline controls vertically centre on their row axis. Deviation should be 0.
- **One size ladder.** Collect every font-size. They should come from a small fixed set. Report
  the set. Sprawl, near-duplicates (e.g. 12px and 12.5px), or one-off values are findings.
- **One shape per control family, never shared.** Collect every border-radius on controls and
  group them. The rule is the *partition*: each family of control owns exactly one radius, no
  family borrows another's, and the total count stays small (3–5). Container radii (cards,
  panels, sheets) are a separate set and must not collide with any control radius. A shape only
  earns a slot if it maps to a distinct **behaviour**, not a distinct look.
- **At most three font weights**, each with a reason: one for names/values you read, one for
  labels, one for everything else. Weight for "feel" is a finding.
- **Optically-aligned glyphs.** Chevrons and arrows whose visual centre differs from their
  geometric centre should be corrected and hug their text (≤2px gap).

**4.2 Type**
- **Exactly two type families**, one for labels/chips and one for names/values. A monospace face
  is permitted for **one** purpose only. A third family is a finding.
- **Record names** ride the readable voice, bold, sentence-case — not all-caps.

**4.3 Contrast — hard floors, computed**
- Text **≥4.5:1**. Large text (≥18px, or ≥14px bold) and UI elements **≥3:1**.
- In **every** theme the artifact supports (dark, light, any variant).
- Use the WCAG relative-luminance ratio. A coloured fill carrying text must clear the floor —
  white text on a mid orange/blue/red typically lands ≈2.5–3.4 and **fails**.
- **Meaning is never encoded in colour alone** — always colour + label or icon.

**4.4 Colour-blind separation**
Any two status colours that can appear **together** must stay distinguishable under CVD.

Simulate deuteranopia and protanopia (Machado-2009, severity 1.0, applied to sRGB) and require
**Euclidean RGB distance ≥ 90** between the pair under **both** simulations.

```
deuter = [[0.367,0.861,-0.228],[0.280,0.673,0.047],[-0.012,0.043,0.969]]
protan = [[0.152,1.053,-0.205],[0.115,0.786,0.099],[-0.004,-0.048,1.052]]
// distinguishable if euclidean(sim(A), sim(B)) >= 90 under both
```

Calibration: a real amber-vs-orange pair scored **77** and was reported as confusable by a
colour-blind user; the fix landed at **103**. So 77 fails, ≥90 is the floor, ~100+ is
comfortable. Separation by **lightness** survives CVD better than hue.

**4.5 Accent budget & surfaces**
- **60-30-10** — roughly 60% base surface, 30% supporting (panels, lines, muted text), **≤10%**
  accent. If accent exceeds ~10% of visual weight, that's a finding.
- **Never pure** `#000` or `#fff` anywhere — near-black / near-white only.
- Neutrals stay desaturated; status and accent colours are allowed to be loud.

**4.6 State & fill — two functions, no drift**
- **Colour = state.** One function maps a record to a state bucket and assigns its colour. No
  hand-set status colours, and **no status colour on a button**.
- **Fill = a today-trigger.** Filled only when a live trigger actually fires; otherwise outline.
  Fill is a *meaning* bit, not a loudness dial.
- **Rollup precedence is fixed, hottest wins:** red > yellow > blue > green > grey. When several
  states combine into one summary (group header, card cap, rolled-up count), the winner is never
  resolved ad hoc per renderer.
- The specific bucket→colour mapping is a project decision. The **"one function, no drift"**
  structure is the rule.

**4.7 Control archetypes — each role does exactly one job**
These are *roles*, not names or looks. What's structural is that **each role is exactly one
thing and never does two jobs** — that single-responsibility split is what lets shape, colour
and fill each stay a reliable signal.

- **Signal** — read-only state. Coloured, plus a word that verbalises it.
- **Gate** — a Signal you can *turn*. Opens a picker or advances a state.
- **Stamp** — a plain fact. Text, no box, no colour.
- **Ref** — a linked record. Marked as touchable; never a status chip.
- **Door** — a verb action. Honest affordance: if it's tappable it must look it; if it isn't,
  it must look like plain text.

A control that carries two of these roles at once is a finding.

## 5 · The report shape

Return exactly this structure, once per dimension you were asked to cover:

```
### <Dimension> — as <Persona> sees it

**Verdict:** one blunt line.

**Walkthrough:** 4–6 concrete beats of the persona trying to act — where they stall,
guess wrong, or give up. Written in their voice.

**Findings:** ranked worst-first. Each one:
  CLASS | SEVERITY | one-line problem | where (selector / element / screenshot ref)
       | why it hurts <persona> | smallest fix
       | OBSERVED or INFERRED

**What's missing:** affordances that SHOULD exist for this dimension and don't.
```

**CLASS** — this is the important one:
- **DEFECT** — violates a standard above, and is fixable without anyone making a new decision.
- **GAP** — the standard can't be met until a design decision gets made. Name the decision.
- **QUERY** — you suspect this is deliberate but can't tell. **Use this freely.** You will be
  given a list of deliberate choices in Prompt B; anything that smells intentional but isn't on
  that list belongs here, as a question, not as a finding.

**SEVERITY** — 🔴 blocks or misleads · 🟠 friction · 🟡 polish.

**OBSERVED or INFERRED** — did you actually see this happen when you operated it, or are you
reasoning that it would happen? Mark every finding. This is not optional; it's what makes the
verification pass tractable.

## 6 · Honesty rails

- **Change nothing.** This is a read, click, and reason pass. Do not edit, fix, or "helpfully
  improve" anything.
- **Never present an estimate as a measurement.** If you couldn't compute a ratio or a distance,
  say so.
- **Separate "broken" from "missing" from "I'd prefer."** The third category is nearly worthless
  here — if a finding is really just taste, either drop it or label it 🟡 and say so plainly.
- **Prefer QUERY over a confident wrong finding.** A deliberate design choice reported as a
  defect costs more trust than a missed finding does.
- **No real customer data** in anything you produce. Illustrative names only.
- **Absence of a feature is not automatically a finding.** A surface can legitimately hand a job
  to something outside itself. Ask whether *the user is stranded*, not whether *the feature is
  present here*.

## 7 · What Prompt B will give you

- The **surface** and how to reach/open it.
- The **persona** — name, role, one-paragraph bio.
- **Exemptions** — which of the rules above don't apply this run, and why.
- **Deliberate choices** — things that look wrong and are not. Don't report these.
- **Known-open items** — already-identified, already-being-worked. Don't re-litigate.
- Which **dimensions** to cover.

Anything not on those lists is fair game.
