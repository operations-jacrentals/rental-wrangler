# Parked: two-deck group header (slot rack in its own recessed tray)

**Deferred from** `claude/read-prompt-ls8uj8` (Tier 0.1 card, design-dump/paint
sessions) on 2026-08-02. **Needs:** Jac's call before building — this is a
structural layout decision, not a styling tweak.

## What the mockup shows

Jac's re-uploaded header+row mockup (uploads `600e3130-image.png`) draws the
group header as **two decks**, not the card's current single row:

- **Deck 1 (top):** the slot rack alone, sitting in its own recessed steel
  tray — a distinct sunken panel with its own bevel, separate from the
  message board.
- **Deck 2 (bottom):** the message board (the outlined "PROMISED" element)
  and the group name plate, on their own row.

The current card renders slots, board, and name plate all on ONE header row.
The `/paint` recreation (`docs/design/tier-01-card/` reference artifact,
scripts in `.claude/skills/paint/`) rebuilt the single-deck version pixel-true
against this same mockup, but never took on the two-deck restructure — that
was flagged mid-session as a real layout call, not a construction-recipe
port, and intentionally left for Jac.

## Why it's parked, not built

Splitting the header into two decks changes the header's height, its DOM
structure, and interacts with several already-settled ledger rows (#198's
"one etched-steel panel" head, #206's right-edge chamfer + stud, #209's
tone frame tracing the header's silhouette) — all of which currently assume
a single-row head. Building it needs a ruling on:

1. Does the two-deck head replace the current single-row head everywhere, or
   only in this mockup's context?
2. How does the tone frame (#209) trace a two-deck silhouette — one ring
   around both decks, or one per deck?
3. Does the group's open/collapse motion (the housing/cartridge physics,
   #168-#169) still apply cleanly to two stacked decks?

## What's left to finish it

- Jac's ruling on the three questions above (popup, when picked back up).
- A `/paint` grid pass isolating just the header region at native two-deck
  scale, since the six-cell grid pass done 2026-08-02 assumed one deck.
- Implementation in `docs/design/tier-01-card/index.html`, gated the same
  way as every other card change (backtick audit, sweep, ledger row).
