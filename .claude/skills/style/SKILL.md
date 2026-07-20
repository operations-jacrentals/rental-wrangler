---
name: style
description: >-
  The alignment + colour standard for Rental Wrangler's UI system (the 2026
  redesign language). Use whenever you build, align, or review ANY control,
  chip, section, form row, or layout and need elements to read as ONE family —
  matched heights, one baseline, weight-with-a-reason, and the contrast-verified
  colour law (colour = state · orange = touchable · muted-blue = commit · fill =
  today). Covers the six alignment rules, the five named parts (Signal · Gate ·
  Stamp · Ref · Door), the AA-checked token values (deepened filled-red, muted
  blue, dark-ink law), the 60-30-10 accent budget, and the off-white/charcoal
  rule. Reach for it on: "why do these look unaligned", "make this a proper
  chip/button/gate", "which blue/red", "is this readable", "line these up". PAIRS
  WITH jactec-ui (the house yard-data-plate language + R0–R25 builders + hazard/
  rivet signature); style is the alignment & colour-discipline layer every UI
  must also satisfy. Not for the ranch/signature aesthetic or mobile reflow —
  that's jactec-ui.
---

# Style — the alignment & colour standard

The layer that makes the app read as **one intentional system** instead of a pile
of elements at different heights, weights, and saturations. It came out of the
2026 redesign work: the *alignment contract* (kills visual chaos) + a *colour
law* re-grounded on real WCAG numbers and the "good colour is not random"
fundamentals.

**Relationship to `jactec-ui`:** jactec-ui is the house *voice* — the yard
data-plate look, the hazard-stripe/rivet signature, the R0–R25 stamped builders,
mobile reflow, the /role audit. **style** is the *grammar* underneath it: how any
element aligns, and exactly which colour/ink/shape it takes. Every UI must satisfy
BOTH. The five named parts below are just friendly handles for jactec-ui builders
(Signal≈R3 `statusPill`, Gate≈R1 `gatePill`, Stamp≈R3b `badge`, Ref≈R2 `refPill`,
Door≈R17 `actionPill`/R18 `ghostPill`). The token deltas here (deepened red, muted
blue) **refine** jactec-ui's registry — keep `references/tokens.md` in sync if they
ever land in the live app (that's a deliberate site-wide pass, not a silent edit).

---

## 1. The alignment contract — six rules, and every drift is a rule-break

The fix for "no matching heights, some text high, some bold for no reason." Once
these hold, a row **cannot** go ragged.

1. **One control height.** Every inline control — chip, gate, stamp, ref, add,
   button, toggle — is the **same height** (26–28px desktop; ≥44px touch targets
   on phones). Nothing is a different height, so nothing sinks or floats.
2. **One baseline.** They all **vertically centre** on the row axis (`display:flex;
   align-items:center`). Nothing sits high or low.
3. **Two type voices, never a third.** **Saira Condensed** (stamped, UPPERCASE,
   ~1.4px tracking, 700–800) for labels & chips; **Geist** (`--font`) for names &
   values you read. Record names are Geist **bold, not caps**. `ui-monospace` only
   for the inspector tag. (Numbers/IDs/timestamps ride Geist or mono, tabular.)
4. **Weight has a reason.** **Bold = a name or a value you read.** Stamped-caps = a
   label. Everything else is regular. If something's bold, it's because you read it
   for meaning — never "just because."
5. **One size ladder (px):** 28 value · 15 title · 13 content · 12 field · **11
   label & every chip** · 10 · 9.5 finest. A badge is 11, always. No one-off sizes.
6. **Two radii tell action from state.** **Actions are pills** (Save/Cancel/Add →
   999). **Statuses are chips** (Signal/Gate/Stamp → 8; sharper 5 for a flatter
   look). Shape signals action-vs-state before you read a word.

**Optically align glyphs** whose visual centre ≠ geometric (chevron, ▸): never a
raw `⌄` glyph — use a centred SVG `chevron-down`, hugging its text (≤2px gap).

---

## 2. The colour law — three jobs, and nothing does two

The trap that forced this: **blue is a status colour now (Waiting)**, so links/
commit can't casually be blue. Split colour into three non-overlapping jobs:

- **Status colours → STATE.** `red / yellow / blue / green / grey` say *what's
  going on*. Reserved for that. Never decorate with them.
- **Orange → TOUCHABLE.** The one accent (`--accent`) means *"you can act on
  this"* — selected tab, ignition/primary, linked-record (Ref), gate affordance.
  Never decorative, never a 2nd status colour.
- **Deep blue → COMMIT.** The button that *writes* (Save/confirm) and the `+Add`
  that *creates*. Rare, so it always reads "this commits."

### colour = state, assigned by ONE function (so it can't drift)
```
taskState(record) → 'blocked' | 'now' | 'later' | 'done' | 'none'
  blocked → red     bad / a wall / danger
  now     → yellow  your move, do it now
  later   → blue    waiting — not your move / pending on someone else
  done    → green   done today (ages to grey next day; can re-alarm to red)
  none    → grey    n/a
```
Buttons are **never** a status colour (only status carries state).

### fill = today, assigned by ONE function
```
fill = triggeredToday(record, ctx) → boolean   // filled if TRUE, else outline
```
A chip **fills only when a today-trigger actually fires** (or is actively
expected): due/dated today · overdue (re-fires daily) · gating a today action ·
needs-your-hands today · a coming-up clock that has reached today · in-flight/
expected (ACH, e-sign) · flagged-and-live · closed-today. **Outline = no live
trigger yet**: far-future, dormant flag, steady/idle, historical. Fill is the
"look here, something's live" bit — kept honest so a filled chip earns the eye.
Fill is a **meaning** bit, not loudness; priority still = colour + sort order.

Per-colour fill meaning: red filled=Blocking / outline=Fix-it · yellow filled=Must-
do / outline=Should-do · blue filled=Blocked-waiting / outline=Pending · green
filled=Closed / outline=Done-today · grey filled=N/A-confirmed / outline=Unknown
(the "$0 ≠ I don't know" fix).

### hover / click (progressive disclosure)
Colour+fill = instant read · the **word** on the chip = what it is (verbalise the
status) · **hover / Tab / long-press** = why & what it stops.
| Part | Hover | Click |
|---|---|---|
| **Signal** | explains the state + names its source | **teleports** to the source driving it |
| **Gate** | current state + "tap to change" | opens the status picker |
| **Stamp** | full label if abbreviated (else nothing) | inert — it's a fact |
| **Ref** | a peek at the linked record | opens / expands that record |
| **Door** | what it does, or why it's gated | runs the action (or shows the block) |

---

## 3. The five named parts

- **Signal** — coloured chip, **read-only** state (colour=state, fill=today). Tiny
  Saira caps + a verbalising word + parent-card icon. Clicking teleports to source.
- **Gate** — a Signal you can **turn**. Same coloured chip + a leading centred
  chevron (hugging), opens a status picker to advance the record. Where SIGNAL and
  the DOOR to change it merge.
- **Stamp** — a plain **fact** (`Non-member`, `Net 15`, `Excavator`). Chip *text*,
  **no box, no colour** — sits beside a Signal as its quiet sibling. Budgeted;
  overflow rolls to `+N`.
- **Ref** — a **linked record**. Square backing holding the **parent icon** (Lucide)
  + the name, orange-marked (touchable), *not* a status chip. Walks across cards.
- **Door** — a **verb action**. Ghost/outline normally; **deep-blue** when it
  commits or creates (`+Add`); **ghost** for the one quiet Cancel/Close.

Contact is a Door done honestly: show the **phone number itself** as the `tel:`
link (readable on desktop, tappable on mobile), never a "Call" verb hiding it.
**Honest-affordance rule:** if it looks tappable, it is; if not, it's plain text —
no decorative underlines, no dead `cursor:pointer`.

---

## 4. Colour standards (contrast-verified, 2026 pass)

Accessibility is a **gate**, checked with math, not eyeballed. AA = ≥4.5:1 text,
≥3:1 large/UI, in dark **and** light. Real ratios from our tokens:

- **Filled RED must deepen.** White on `#ff4242` = **3.44** → fails for 11px chips.
  Filled danger uses **`--red-strong #d63636`** (white ink = **4.73** ✓). Keep
  bright **`--red #ff4242`** for **outline** chips, status bars, and dots (red-on-
  dark clears AA on its own).
- **Blue never carries white.** White on blue = **2.72** (fail). Filled blue always
  takes **dark ink** (`#0a1220`).
- **Mute the blue** so it stops fighting the orange (soften-complements rule): 
  **`--blue #6394cc`** (was `#5b9dff`). Dark-ink filled = 5.93 ✓, blue-on-dark text
  = 6.15 ✓. Calmer blue also fits "waiting = passive."
- **Orange always carries dark ink** (`--on-orange`). White on orange = **2.54**
  (fail); dark ink = **7.29** ✓. Yellow/green filled also take dark ink (10.7 / 9.8).
- **60-30-10 accent budget.** ~60% steel base (bg/cards) · ~30% supporting (panels/
  lines/muted text) · **≤10% accent** (orange + active status). If orange creeps
  past 10% of the visual weight, pull it back.
- **Off-white / charcoal, never pure.** `--txt #eef2f7`, `--bg #0a0d11`. No `#fff`,
  no `#000` — anywhere.
- **Saturation discipline.** Neutrals stay desaturated steel. Status + accent are
  deliberately *loud* — a **justified override** of "muted = premium," because a
  rental yard wants hi-vis, not muted. Don't quiet the states; don't loud the greys.
- **Narrow palette.** One tight, named registry (base + a soft `-bg` fill each) —
  resist expanding toward a 30-swatch palette. Colour earns its place by meaning.

---

## 5. Tokens (dark base — the values this skill assumes)

```
Surfaces  --bg #0a0d11 · --panel #171d25 · --card #12171e · --card-head #1a212b
Lines     --line #2c343f · --line-soft #212834
Text      --txt #eef2f7 · --txt-2 #aab4c1 · --txt-3 #717b89
Accent    --accent #ff7e1f · --on-orange #1a1205 · --accent-line rgba(255,126,31,.55)
Status    --green #34d399 · --yellow #f5c542 · --red #ff4242 · --red-strong #d63636
          --blue #6394cc · --gray #8b94a3        (blue muted; red-strong for fills)
Leather   --tan #c2925a  (seasoning only — saddle-stitch + tiny touches)
Form      --radius 14–16 · --chip-radius 8 (or 5 flat) · pills 999 · control-h 26–28
```
Light theme darkens the status hues so pill text still reads on soft fills
(`--red #d52a2a`, `--blue ~#2f5fb0`, etc.) — preserve that when adding a status.
Never hardcode a hex in markup; derive from the token.

---

## 6. Pre-ship checklist

- [ ] Every inline control the **same height**, centred on **one baseline**.
- [ ] Two type voices only; **bold only on names/values**; sizes off the ladder.
- [ ] Actions are pills, statuses are chips; chevrons are centred SVGs, hugging.
- [ ] Colour only carries **state**; orange only marks **touchable**; commit is
      **deep blue**. No status colour on a button. No orange as decoration.
- [ ] Colour from `taskState`, fill from `triggeredToday` — nothing hand-set.
- [ ] **Contrast checked** in dark + light: filled red = `--red-strong`, blue/orange/
      yellow/green filled = **dark ink**. Run the ratio, don't eyeball.
- [ ] Facts are **Stamps** (no box/colour); links are honest (tappable ⇒ looks it);
      contact shows the **number**.
- [ ] Accent ≤ **10%** of the view; neutrals near-black/near-white, never pure.
- [ ] Then run **jactec-ui**'s gates (data-r stamps, signature, R0 flash-lint).
