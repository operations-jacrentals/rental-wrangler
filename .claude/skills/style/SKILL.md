---
name: style
description: >-
  The MEASURABLE rulebook for UI — project-agnostic numerical rules and guidelines
  that any control, chip, section, form row, or layout must satisfy, so elements
  read as one family. It does NOT pick fonts or hex values (those are design
  decisions that live in a project's tokens and can change) — it gives the numbers
  those decisions must hit: one control height, one baseline, the size ladder,
  one shape per control family, weight-with-a-reason, WCAG contrast floors, the
  colour-blind separation threshold, the 60-30-10 accent budget, and the two
  state functions (colour = state, fill = today). Reach for it on "line these up",
  "is this readable", "which two colours are too close", "make this a proper
  chip/gate/stamp", "why does this look unaligned". The brand *decisions* (the
  specific typefaces, the accent hex, any signature) live in the project's tokens
  and are free to change; this skill only enforces the measurable constraints on
  them. For Rental Wrangler, pair it with `wrangler-style`, which holds those
  decisions.
---

# Style — numerical rules & guidelines

This skill is a **rulebook, not a decision-maker.** It never says "use this font"
or "use this orange" — those are design decisions that live in a project's tokens,
and they're allowed to change. This skill
says **what numbers any such decision has to satisfy** so the result reads as one
intentional system instead of chaos. Every rule below is checkable — with a ruler,
a ratio function, or a simulation — not by eye.

**It is deliberately project-agnostic.** Nothing here names a hex, a typeface, or a
product. The rules are guidelines that any UI can be held to; a project supplies the
values and its own component vocabulary.

**Division of labour:** the **brand decisions** — which typefaces, the palette, the
component looks, any signature, the voice — live in a project's decisions skill (for
Rental Wrangler that's **`wrangler-style`**, with `style.css` / `app.js` as the
implementation). **This skill** holds the measurable *constraints* those decisions
must pass. Run **both** on any UI; when a decision and a rule conflict, the decision
moves — not the rule.

---

## 1. Alignment — numbers, so a row can't go ragged

- **One control height `H`.** Every inline control — chip, gate, stamp, ref, add,
  button, toggle — is **exactly `H`** tall (pick `H` in 24–28px for desktop; **≥44px**
  hit-area on touch). Not "about the same" — the same number.
- **One baseline.** All inline controls **vertically centre** on the row axis
  (`align-items:center`); vertical deviation = **0**.
- **One size ladder.** Text sizes come from a fixed set only — e.g.
  **28 · 15 · 13 · 12 · 11 · 10 · 9.5 px** (value · title · content · field · label
  & every chip · small · finest). **No value off the ladder.** A badge is 11, always.
- **One shape per control family — and never shared.** Give each *family* of inline
  control its own radius, so a control's **silhouette** answers "what kind of thing is
  this?" before colour or text does. The rule is the **partition**, not the numbers:
  every family owns exactly one radius, no family borrows another's, and the count stays
  **small (3–5)** — past that, shape stops being a signal and becomes noise.
  A working set, by what the control *does*:
  | Family | Shape | Reads as |
  |---|---|---|
  | **State** you read | squared (~0–3) | a flat plate of information |
  | **Opener** that reveals something | top corners rounded, bottom square (~5 5 0 0) | the top half of an already-open panel |
  | **Record** you can open | rounded (~6–10) | an object with an identity |
  | **Action** you fire | pill (999) | a button, unmistakably |
  Which family takes which radius — and whether a project needs the opener at all — is a
  **decision**, not a rule. Two constraints bind it: the **container** radius (cards,
  panels, sheets) is a *separate* value that must not collide with any control radius, and
  a shape only earns a slot if it maps to a distinct **behaviour** — not a distinct look.
  *(Supersedes the earlier "exactly two radii — pill for actions, chip for statuses" line;
  that partition was too coarse once triggers and records both needed to be distinguishable
  from plain state.)*
- **Weight has a reason — cap the weights.** At most **three** used: **bold** = a
  name or a value you read · one **stamped** weight = labels · **regular** = the
  rest. If something's bold, it's because it carries meaning. Never "bold for feel."
- **Optical-align glyphs.** Chevrons/arrows whose visual centre ≠ geometric are
  centred and hug their text (≤2px gap) — use a real SVG, never a stray glyph.

## 2. Type — structural (which fonts is NOT this skill's call)

- **Exactly two type families:** one *stamped/condensed* voice for labels & chips,
  one *readable* voice for names & values. A monospace face is allowed for **one**
  purpose only (a code/inspector tag). **Never a third family.**
- **Record names** ride the readable voice, **bold, sentence-case** (not caps).
- *Which* typefaces fill those two roles is a project decision (in the app tokens),
  not a rule here.

## 3. Contrast — hard floors, checked with math

- **AA is a gate:** text **≥4.5:1**, large text (≥18px, or ≥14px bold) and UI
  elements **≥3:1** — in **every** theme (dark, light, any variant).
- **Verify with a ratio function, never eyeball.** (WCAG relative-luminance ratio.)
- **A coloured fill that carries text must clear the floor** — deepen the fill or
  switch to dark ink. Rule of thumb this catches: white on a mid orange/blue/red
  lands ≈ **2.5–3.4** and **fails** — so those fills take dark ink, or the fill
  darkens until white passes. (The specific hexes are the decision; the ≥4.5 is the rule.)
- **Never encode meaning in colour alone** — always **colour + label + icon**.

## 4. Colour-blind separation — the co-occurrence threshold

Any two status colours that can appear **together** must stay distinguishable under
colour-vision deficiency (≈8% of men). Test it, don't trust normal-vision eyes:

- Simulate **deuteranopia + protanopia** (Machado-2009 severity-1.0 matrices,
  applied to sRGB) and require **Euclidean RGB distance ≥ 90** between the pair,
  under **both** simulations.
- Data point that set the line: a real amber-yellow vs orange pair scored **77** — reported
  as confusable by a colour-blind user — and the fix landed at **103**. So: **77 fails,
  ≥90 is the floor, ~100+ is comfortable.**
- Prefer separating by **lightness** as well as hue — lightness survives CVD; hue
  often doesn't.

```
// Machado-2009, severity 1.0 (multiply the sRGB 0–255 vector)
deuter = [[0.367,0.861,-0.228],[0.280,0.673,0.047],[-0.012,0.043,0.969]]
protan = [[0.152,1.053,-0.205],[0.115,0.786,0.099],[-0.004,-0.048,1.052]]
// distinguishable if euclidean(sim(A), sim(B)) >= 90 under both
```

## 5. Accent budget & surfaces — proportions

- **60-30-10.** ~**60%** base surface · ~**30%** supporting (panels, lines, muted
  text) · **≤10%** accent. If the accent exceeds ~10% of the visual weight, pull back.
- **Never pure.** No `#000`, no `#fff`, anywhere — near-black / near-white only.
- **Saturation split.** Neutrals stay desaturated; status + accent may be *loud* —
  a deliberate, allowed override of "muted = premium," because ops wants hi-vis.

## 6. State & fill — two functions, so they can't drift

- **`colour = taskState(record) → state-bucket`** (blocked · now · later · done ·
  none). One function assigns it; never hand-set a status colour. Buttons carry
  **no** status colour.
- **`fill = triggeredToday(record, ctx) → boolean`** — filled only when a *today*
  trigger actually fires (due/overdue/gating-now/needs-hands/near-clock/in-flight/
  flagged-live/closed-today); otherwise outline. Fill is a *meaning* bit, not
  loudness — priority still = colour + sort order.
- **Rollup precedence, hottest wins.** When multiple task-states combine into one summary
  (a group header, a card cap, a rolled-up count), the winner is fixed, never resolved ad
  hoc per renderer: **red > yellow > blue > green > grey.**
- The bucket→colour mapping and trigger list are **guidelines** (adjust per app);
  the **"one function, no drift"** structure is the rule.
- **Time-derived state — the schedule/ETA formula.** Applies to any **deadline-vs-estimate**
  signal: an ordered run of steps, each with a duration, measured against a promised time.
  Two measurable rules so a countdown can't be hand-tuned:
  - **Cumulative cascade.** For an ordered run of stops: `departure₀ = tripStart`;
    `ETAᵢ = departureᵢ + driveᵢ`; `departureᵢ₊₁ = ETAᵢ + loadᵢ` with **load = 20 min/stop**
    default. Every estimate sums **all** prior drive + load — one slip re-times everything
    below it. (Not a per-row constant.)
  - **Departure clock.** The active row's ETA cell reads the **scheduled departure time until
    `now ≥ departure`**; after that it **counts up** `now − departure` until the go-action
    (the go-action) fires. **Miss threshold:** `now > departure` with no go-action = an
    **escalation** event, not a quiet colour flip — the notify audience widens beyond the
    operator, because a missed start is a business problem, not a display state. (Who gets
    notified is a decision; the `now > departure ⇒ escalate` trigger is the rule.)
  - **One ladder, two clocks.** The SAME state ladder colours **two** facts against **two**
    targets: the **start time** (slack vs *leave-time* → "should I go?") and the
    **deadline** (slack vs *deadline* → "will it make it?"). Same colours, same meanings,
    different targets = not double-encoding. Restraint rule: at most **one "next" (blue)** per
    run — everything ahead is grey (not-yet), everything behind green (done).
  - **Deadline slack → colour** — the **standard state buckets**, no reassignment, from
    `slack = deadline − ETA` (live, recomputed on every change): **Done** (gate closed) →
    green (overrides all) · `slack < 0` → red (late/overdue) · `0 ≤ slack ≤ 2h` → yellow
    (near/due) · `slack > 2h` → **blue = Waiting** (incomplete, on-time). Maps 1:1 onto the
    buckets above (waiting=blue, due=yellow, overdue=red, done=green) — **green stays Done
    only**, an on-time pending stop is blue, never green. Still one function; rolls up
    `red > yellow > blue > green`.

## 7. Control archetypes — structural definitions, not a naming mandate

These are the **roles** an inline control can play. A project names them and decides how
each one *looks* (for Rental Wrangler, in `wrangler-style`); what's structural — and what
this skill holds you to — is that **each role is exactly one thing and never does two jobs.**
That single-responsibility split is what lets shape, colour, and fill each stay a reliable
signal. The set below is a proven partition, not the only possible one.


- **Signal** — coloured chip, **read-only** state (colour=state, fill=today) + a
  verbalising word + parent-card icon. Click → teleport to source.
- **Gate** — a Signal you can **turn**: same chip + a leading centred chevron;
  opens a status picker. (SIGNAL and its DOOR-to-change, merged.)
- **Stamp** — a plain **fact**: chip *text*, **no box, no colour**; sits beside a
  Signal as its quiet sibling. Budgeted, overflow → `+N`.
- **Ref** — a **linked record**: square backing with the parent icon + name,
  accent-marked (touchable), never a status chip. Walks across cards.
- **Door** — a **verb action**: quiet/ghost normally; the *commit/create* and
  *money* intents each get their own action colour (a decision, not a rule); one
  quiet **ghost** for Cancel/Close. Honest-affordance: tappable ⇒ looks it; not ⇒
  plain text. Contact shows the **number itself** as the link.

## 8. Pre-ship checklist — every item measurable

- [ ] Every inline control the **same height**; baseline deviation **0**.
- [ ] All sizes on the **ladder**; **≤3** weights; every control's radius is **its family's**
      — no family borrows another's, and the container radius collides with none of them.
- [ ] **Two** type families (+mono for the one tag); names bold, sentence-case.
- [ ] Every text/fill pair **≥4.5** (or ≥3 large/UI), computed — in dark **and** light.
- [ ] Co-occurring status colours **≥90** apart under deuter+protan sim.
- [ ] Accent **≤10%**; no pure `#000`/`#fff`; meaning never colour-alone.
- [ ] Colour from `taskState`, fill from `triggeredToday`; no status colour on a button.
- [ ] Then run the app's CI gates (data-r rule stamps, R0 flash-lint).



