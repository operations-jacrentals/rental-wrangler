# Next session — paste everything below the rule

*(Supersedes the 2026-08-05 prompt for the design-system-phase-1 branch; that work's deep
context is still in `docs/design/HANDOFF-2026-08-05.md`.)*

---

Read `docs/design/HANDOFF-2026-08-11-scifi-hud-desktop.md` first — all of it. Then ledger rows
**#262, #263, #264, #268, #273, #274, #277** in
`docs/superpowers/specs/2026-07-20-decisions-ledger.md`. Don't skim them: three of the four
jobs below already have a decided recipe in there, and re-deriving one is how a day gets lost.

Branch `claude/scifi-hud-subitem-connect-wqzm3i`, PR **#806**, draft and unmerged. Nothing is
live. The branch is Figma + ledger only — **no `app.js` / `style.css` change exists for the
HUD yet.**

Figma file `cc3TcK2F2a8qSbCAstzcA5`. The header I'm working on is **`987:1726`** —
`Card Header`, 1077 × 243.94. There are **two near-identical copies** on that canvas
(`987:1728` and `987:1957`); ask me which one I'm looking at before you edit either.

## Today's four jobs

**1 · The search bar is way too big.** `Field · Search` = `987:1936`, 762.76 × 59.05.
Measured off the render: the placeholder cap is ~48px against ~34–38px toggle labels above it,
in a well that owns ~45% of the card. It's a *proportion* problem — fix the ratio, don't just
scale the frame.

⚠️ **Before you change a single size, settle the canvas scale.** `1077 = 3 × 359` exactly, and
359 is the locked card anchor (#273). If this is the @3x copy, the search field is already
**19.7 CSS px** tall — below the 24px Door floor (#274) and far below the 44px touch floor, and
shrinking it breaks both. But the header height disagrees (243.94/3 = 81.3 vs the 44.0 that
#273 measured), so it may not be 3:1 at all. Resolve that first, then tell me which it is.
My expectation: the **type and the well's share of the height** come down, the hit box stays
≥44px CSS.

**2 · Stretch the background hex to the full card.** The field is #262. Regenerate the single
vector's path data — **one vector per role, never one node per cell** (#263) — and **track
`minX`/`minY` per chain**, or you'll silently hide one chain under another exactly like the
cyan-over-red bug that cost a rebuild. If the card's rhythm sets a pitch, derive `R` from it
(#264: `R = py/√3`); never pick `R` and make the content move.

**3 · Inverted grey hex grid behind WORK / OPEN / DONE.** **The recipe already exists — #268.
Use it, don't invent a second one.** Cells filled, gutters read as the lines; pitch exactly
half the backdrop's (`py = 287/6`, `R = 27.617`); clipped frame with an **opaque ground** — with
`fills = []` it's a hole and the backdrop shows through, which is the Window option I already
rejected. Keep it neutral grey so the bars keep the accent budget. Status slab is `987:1764`,
labels `987:1940/1941/1942`.

**4 · Start building the full desktop screen.** Greenfield. The thing to design against:
**the desktop card is one of three columns, not the viewport** — `style.css:322-325` gives
`card = (viewport − 48) / 3`, so **377px at the 1180 floor**, 464 at 1440, 624 at 1920.
That 377 is within 5% of the 359px phone card, and the 1077px header art is ~2.9× it.
**Design for the floor.** Breakpoints: ≤1024 → 2 columns, ≤640 → 1.

Start with 1–3 on the existing header, show me the result, and don't start 4 until I've seen
them — 4 is a much bigger job and I want the header settled first.

## How to work with me

- **Popup once, then inline.** Every question goes through `AskUserQuestion` a single time; if
  that attempt fails, ask the same question inline as A/B/C + Other. Never retry the popup.
  Batch up to 4 questions, favour multiSelect.
- **Show, don't describe.** Anything comparative or visual → an artifact. A localhost preview
  doesn't render for me in the cloud app.
- **`style` + `wrangler-style`, both, every time.** And **add a ledger row when something is
  settled** — it isn't decided until it's in the table.
- Measure the **render**, not the frame (#263). Judge **sizes at 100%, sub-pixel finish at
  ~300%** (#273).
- Ultracode is on, but ask before fanning out agents or workflows.

## Two loose ends from last session

- **A Figma edit I approved never landed** — six labels on `948:2914` (page *Experiment 1*),
  nodes `952:545/546/547` and `952:549/550/551`, Oxanium Bold → **Chakra Petch Bold**, sizes
  stay 13 and 52. The write was denied at the permission prompt and not retried. The frame's
  caption still says "Oxanium Bold 13px" and needs updating with it. Pick this up if I say so —
  don't do it silently as part of something else.
- **Open question from #277:** the FIELD CALLS wordmark is Rajdhani Bold, which is now a third
  family outside the Chakra Petch + Oxanium pair. Move it onto the pair, or keep it as a
  wordmark-only exception? Don't decide this alone — ask me.
