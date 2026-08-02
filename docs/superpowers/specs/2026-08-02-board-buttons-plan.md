# Board-buttons — implementation plan

**Spec:** `2026-08-02-board-buttons-design.md` (approved by Jac, 2026-08-02)
**Target:** `docs/design/tier-01-card/index.html` — steel theme.
**Prerequisite:** the three-mockup design-dump rebuild must be landed and
verified first — its outlined boards ARE the surfaces these controls live in.
**Invariants across every phase:** the halo skin, switch A, the lit-row
laser/drawer/flicker, the marquee, and the sweep harness all keep passing.

Standing traps (all have bitten this session — re-read before each phase):

- The late CSS block is a JS **template literal**: a literal backtick anywhere
  inside it (comments included) kills the page. Audit after every edit.
- `boards()` measures marquee need as `clientWidth - 14`, assuming `0 7px`
  board padding. Do not change board padding; do not touch the span it
  measures.
- Row board text colour is set **inline** by JS — CSS overrides need
  `!important`.
- Specificity war: restate at matching specificity + `!important`, appended
  late in the block.

---

## P1 · The hover verb layer (spec §1)

1. Each board gets a verb overlay: a new absolutely-positioned child
   (`.rw-verb`, created in `stamp()`, idempotent like `.rw-screen`/`.rw-stud`)
   containing the action text — header `> SEARCH`, row `> OPEN LOG`. Hidden at
   rest (`opacity:0`), shown on `.rw-board:hover` while the condition
   span drops to `opacity:0`. The measured span's content is NEVER touched —
   hide/show is opacity-only, so the marquee measurement and the `data-dup`
   echo stay valid.
2. Wake: reuse the existing `rwWake` steps animation on hover-in.
3. Marquee interaction: `is-loop` boards pause their animation while hovered
   (`animation-play-state:paused`) so the swap doesn't fight the scroll.

**Verify:** hover a row board → verb shows, condition hidden; leave →
condition returns; a long-message board still marquees at rest and its span
still carries `data-dup`; `boards()` re-run (resize) does not false-trigger.

## P2 · Header search rehost (spec §2)

1. The original head board (`.rw-off`, still carrying `boardClick`/
   `boardEditing`/`boardQ` handlers) is the machinery. The M1 board becomes a
   click-proxy: a delegated listener (in the M1 script, not React) that on
   `.scp1 .rw-board` click dispatches a click to that group's hidden original
   board.
2. Reveal while editing via CSS state, not by removing `.rw-off`:
   `.scp1:has(.rw-off input)` → the original board displays, positioned and
   styled as the outlined board (ring in group hue, glass interior); the M1
   board goes `visibility:hidden` meanwhile. Original board is
   `pointer-events:none` except in this revealed state (loop guard).
3. Collapsed group: the proxy first dispatches the gate toggle
   (`g.toggle` via clicking the gate), waits a tick (~50ms, React state
   settle), then dispatches the board click — open + search in one motion.
4. Esc/blur exits editing (existing behaviour) → `:has` state clears → M1
   board returns.

**Verify:** click an open group's board → input appears inside the outlined
board with caret; typing filters that group's rows live; Esc restores the
condition word. Click a collapsed group's board → group opens AND input is
focused. No dispatch loop (count listener firings). Zero new console errors.

## P3 · Row gate press (spec §3)

1. No new wiring: the board click bubbles to the row face's existing handler.
   Confirm nothing calls `stopPropagation` on the board.
2. Press = light response on `.rw-board:active` (rows only): brief brightness
   dip + a one-shot scanline flash (steps animation), `transform:none` —
   no travel. Scoped to the board element, not the row.

**Verify:** click a row's board → row lights, drawer drops, flicker fires on
the drawer only (sweep asserts this); press visual fires on the board;
clicking a slot does NOT trigger the board press visual.

## P4 · Materials restamp + pins (spec §4)

1. Taxonomy table: `.rw-tick` → `steel` (was `slot`); add `.rmq` and
   `.rw-facts` → `steel`.
2. Hide all floating pins: the WORK/DONE toggle counts, the name-plate alert
   counts, the jump-band pins (`.seg__opt > .pin`, `.pin-wrap > .pin`,
   `[data-slotpin]` as applicable — verify each selector against the DOM
   before writing it).
3. Law-8 note recorded for the ledger: slots = mounted steel hardware; the
   floating-count-slot pattern is parked with the pins.

**Verify:** stamped materials read `steel` on ticks/names/facts; zero visible
`.pin` elements anywhere on the card; the head stamp still shows group counts.

## P5 · Close out

1. Full sweep + halo check + marquee sanity (no static double text).
2. Rebuild the standalone (`node tools/build-card-standalone.mjs`), assert
   zero off-page references, republish the artifact (same URL).
3. Ledger rows: batch with the eight already owed from steel-v2 plus the
   design-dump supersessions (#176 name-left, chip merger, screen retirement,
   steel restamp, pin parking, B-switch status) — one ledger pass, per Jac's
   "keep designing, batch at the end".
4. Commit + push.

---

## Risks

| Risk | Mitigation |
|---|---|
| `:has()` reveal misbehaving inside the M1 cascade | Verified in-browser during P2 before styling on top |
| React re-render replaces the M1 board mid-edit | `stamp()` is MutationObserver-driven and idempotent — the proxy listener is delegated, not per-node |
| Gate-toggle + board-click race on collapsed groups | 50ms settle between dispatches; verify with a filter/rebuild stress pass |
| Verb overlay upsetting board width/marquee | Overlay is absolute, outside flow; measured span untouched |
