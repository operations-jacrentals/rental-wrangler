# Board-buttons — the glass hosts the controls

**Approved by Jac, 2026-08-02** (four sections, popup sign-off). Builds on the
three-mockup design-dump rebuild (rows: name left · facts · slots · outlined
state board right; header: slots · large outlined board · name plate; screen
retired; tone frames; chunky ticks).

**Target:** `docs/design/tier-01-card/index.html`, the steel theme. The halo
skin, switch A, the lit-row laser/drawer/flicker, and the marquee are
invariants — none of them may regress.

## The ruling that drives this (Jac, mid-session)

> "The slots are Steel Elements. The buttons/gates are digital so they live in
> the message glass. Facts and Names are also Steel elements because they don't
> change."

Static things are steel: names, facts, slots. Interactive/changing things are
digital and live in glass: the boards. The board is each level's ONE digital
surface, so each level's button belongs inside it.

## §1 · One glass, two readings

The old problem: a single chip can't show the Present Condition ("PROMISED")
and the Next Action verb at once. Resolution by physics, not layout:

- **At rest** the board shows the present condition — the state word or
  messages, **marqueeing when too long** (existing `is-loop`/`termloop`
  machinery, untouched; the idle state owns the marquee).
- **On hover** the glass wakes (law 4) and the text swaps to the next-action
  verb with a terminal prompt: header `> SEARCH`, row `> OPEN LOG`
  (row verb may later vary by state; start with one verb).
- **On leave** it returns to the condition. One surface, both facts, never
  simultaneously.

## §2 · Header board = group search

- Click the board → search mode: the **original head board's proven input
  machinery** (`boardClick` / `boardEditing` / `boardQ`, retired by M1 via
  `.rw-off` but still live in the DOM with its React handlers) is revealed in
  the new board's position. No duplicate state; the M1 board is a click-proxy.
- Typing **live-filters the group's rows** (the original behaviour). Esc/blur
  exits and restores the condition word.
- On a **collapsed** group: clicking the board **opens the group AND enters
  search** in one motion (dispatch the gate toggle, then the board click).

## §3 · Row board = the gate

- Clicking the board — **or anywhere on the row body** (Jac's call: bigger
  target) — lights the row and drops the drawer. Because the board sits inside
  the row face, whose click handler already does this, the gate needs **no new
  wiring**; the board click simply bubbles. Slots keep their own clicks.
- **Press = light response, no travel:** a brief brightness dip + scanline
  flash — a terminal acknowledging input. Steel compresses (law 6); glass
  lights (law 4). Implemented as a CSS `:active` treatment on the board only.

## §4 · Materials restamp + pins

- Taxonomy table (law 7): `.rw-tick` restamps **steel** (was `slot`);
  names (`.rmq`) and facts (`.rw-facts`) stamp **steel**. Boards remain the
  only digital/glass surfaces at their levels.
- **All floating pins hide for now** — the WORK/DONE toggle counts, the
  name-plate alert counts, and the jump-band pins. They no longer make
  physical sense atop steel with the new taxonomy; Jac wants a cleverer
  rehoming designed later ("great feature, hide them for now"). Group counts
  remain visible in the head stamp, so triage info is not lost.
- Law 8 (slots break physics) narrows to: slots are mounted steel hardware —
  their colour is paint, not light; they may still sit proud of a panel edge.
  The floating-count-slot pattern is parked with the pins.

## Out of scope

- The B switch's row treatments stay quiet (its chip target merged into the
  board during the rebuild); a future ledger row settles B's fate.
- Row-state-specific action verbs (start with `> OPEN LOG`).
- Any backend/data change — this is presentation + interaction only.

## Risks

| Risk | Mitigation |
|---|---|
| Revealing the `.rw-off` original board fights M1's hide rule | Reveal via a scoped `:has(input)` state, not by removing `.rw-off` |
| Hover verb-swap breaks the marquee measurement | Verb swap must not touch the span the `boards()` measurer reads; use a separate overlay layer shown on hover |
| Click-proxy dispatch loops (proxy click re-triggers itself) | Guard: proxy listens on the M1 board only; original board is `pointer-events:none` until revealed |
| Row press flash misfires on drag/slot clicks | `:active` scoped to the board element itself, not the row |
