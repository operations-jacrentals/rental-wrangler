# Atom Rebuild — working backwards from Final Card

The final card mockup is the visual source of truth; it has moved ahead of the synced
Tier 0.1 kit. This document decomposes the card back into the kit's atom vocabulary and
states, per atom: what it is NOW (rebuild-ready), old → new, who asked for the change,
and what else in the card depends on it. Values are verbatim from the card source; the
full rule text lives in `Tier 0.1 CSS.css` (§ references below point there).

Shared vocabulary used throughout — the card added four **finishes** (not atoms, they
have no behavior; any atom can wear one):

- **machined ring** — `0 0 0 2px seam` (seam = `color-mix(in oklab, black 58–62%, var(--card-head))`) + lit hairline below (`0 3.4px 0 rgba(185,205,235,.13)`) + fainter hairline above (`0 -3.2px 0 rgba(185,205,235,.05)`). The 17px control size uses 1.5px/2.5px ring radii and `0 5px 0 -2px` under-edge on Signals.
- **well glass** — face `#050A10`, gradient `rgba(0,0,0,.38) → 0 55% → rgba(185,205,235,.04)`, press-in `inset 0 2px 3.5px rgba(0,0,0,.78)`, usually + scanline film `repeating-linear-gradient(180deg, transparent 0 2px, rgba(0,0,0,.20–.22) 2px 3px)`.
- **dark key** — face `#0A0F16` + scanlines + `inset 0 0 0 1px color-mix(in oklab, transparent 40%, <hue>)` ring + flat hue ink + `inset 0 -1.5px 2.5px rgba(0,0,0,.5)`.
- **pressed key** — darkened top gradient `rgba(0,0,0,.26) → 0 48%` + machined ring + `inset 0 1.5px 3px rgba(0,0,0,.5)`.

One global re-voicing that touches every atom: `button, input, .seg__opt, .door, .field,
.pin, .chip, .stamp, .ref, .ref__label { font-family: var(--font-mono) }` — Ref was the
only atom that spoke Archivo; it is now mono like everything else. And one global
demolition: `border-radius: 0 !important` on `.seg, .seg__opt, .signal, .pin, .field,
.ref` — the four-shape radius ladder does not survive at card level (exceptions noted
per atom below).

> **Still current below, one rename aside:** this document predates 2026-07-31's Pin →
> Slot rename (ledger #166/#177) — every `.pin` reference below, including the whole
> **Pin — CHANGED** section, describes what is now called **Slot** (`.pin`→`.slot`,
> `.pin-wrap`→`.slot-wrap`), rebuilt with a skewed stud face and a hover-unfurl tray
> replacing the tooltip, and a numeral-only collapsed face (#166). The geometry,
> physicality and stud shadow this document records are otherwise still accurate — see
> `../rw-design-system/elements/slot.html` for the current write-up and demo.

---

## Signal — CHANGED

**Now, base (card-wide):** kit geometry (24px, mono 11px/800/.05em/uppercase) but
`border-radius: 0`; outline variant border thickens 1px → **1.5px**; filled variant wears
a glass cap (`linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.02) 45%,
rgba(0,0,12,.16))`) plus the machined ring (2px seam, `0 0 0 3px rgba(185,205,235,.09)`,
`0 5px 0 -2px rgba(185,205,235,.13)`, `inset 0 1px 0 rgba(255,255,255,.28)`, `inset 0
-1.5px 2.5px rgba(0,0,0,.32)`); outline variant same ring at lower alphas, no fill.

**Now, in rows (`[data-row] .pin-wrap > .signal`):** a second size — **17px tall, 9px
type, padding 0 7px**, fixed width = `max(66, round(longest-state-chars × 7.15) + 14)px`
(86px with current data), centered, so every key on the card shares one left and right
edge. It is an `<a>`, `cursor: pointer` — click teleports to the signal's source (stub).
**Cool tones (blue/green/gray) become dark keys**: near-black face, thin hue ring, flat
hue text (gray keys use `--txt-2` ink with the gray ring mixed at 45% transparent).
**Red and yellow keep their hue fill** under the glass cap — heat stays loud.

- Old → new: `border-radius 2px → 0`; outline `1px → 1.5px`; flat matte fill → glass cap
  + machined ring; one 24px size → 24px base + 17px/9px row key; blue/green/gray filled
  `hue bg + on-hue ink → #0A0F16 key + hue ring + hue ink`; cursor default → pointer (rows).
- Asked or needed? The ring-and-flat-text direction (state as thin hue rings + glowing
  text, not fills) was the session's user-steered direction. Exact alphas, the 17px/9px
  size, the 7.15px/char width formula, and keeping red/yellow filled are mine.
- Depends on it: the state-column alignment (stateW); slot-rack tick hues; message-board
  text hue; laser-beam hue (group's worst signal); the chip-teleports/row-expands click
  contract; mini-Pins sized to sit on a 17px corner.

## Gate — CHANGED

**Now:** **17px tall, 9px type, padding 0 7px 0 4px, radius 0** (opener shape gone);
glass cap + machined ring (1.5px/2.5px); chevron kept, rotates `-90°` when its group is
shut, `.25s cubic-bezier(.32,.72,0,1)`; hover = `brightness(1.12)`, no ring. Same
cool/hot split as Signal: `gate--blue/green/gray` are dark keys (hue ring + flat ink,
gray ink `--txt-2`), red/yellow keep the fill. Its one card job: the group's name in the
head, with the hot-count Pin riding its corner.

- Old → new: `24px → 17px`; `11px → 9px` type; `radius 5px 5px 0 0 → 0`; matte hue fill →
  key/fill split; hover ring → brightness.
- Asked or needed? Same as Signal — user-steered direction ("gate buttons styled as dark
  keys… not glossy plastic fills" was an explicit session decision); sizes mine.
- Depends on it: 30px head height assumes the 17px control; the Pin corner position;
  the head's whole-row click (gate itself doesn't stop propagation — the head toggles).

## Stamp — UNCHANGED (one usage-level exception)

Kit rule intact and used as-is in rows (`facts · +N` with `.stamp-sep` and
`.stamp--more`). One exception: the group-head count wears `height:auto; font-size:10px`
inline — an off-ladder size, not a rule change. The global mono rule is a no-op here
(Stamp was already mono). Rebuild from the kit verbatim.

## Ref — CHANGED

**Now:** square, borderless, **dark plate `#0B121B`** with a **45° notch cut off the
top-right corner** (`clip-path: polygon(-3px -3px, calc(100% - 13px) -3px, calc(100% +
3px) 13px, calc(100% + 3px) calc(100% + 3px), -3px calc(100% + 3px))` — the ±3px margins
let the ring shadow survive the clip on uncut edges); machined seam `0 0 0 1.5px
color-mix(in oklab, black 62%, var(--card-head))` + `0 2.5px 0 -1px rgba(185,205,235,.10)`
+ `inset 0 1px 0 rgba(185,205,235,.06)`; **mono** type now (was Archivo). Hover: ink
`--txt`, border stays put, no ring, no accent. **In rows: fixed slot 152×17px, 11px
type**; the name span (`.rmq`) ellipsizes, and hover marquees it (`refScroll 2.6s
ease-in-out infinite alternate`, translating `min(0px, calc(114px - 100%))`).
The `.ref__icon` holder is **unchanged kit** (18px, `--accent-soft` backing, 5px
radius) — one of two rounded survivors on the card.

- Old → new: `radius 8px → 0 + notch`; `1px --line border → none`; `transparent → #0B121B`;
  `Archivo 13px/600 → mono 11px` (in rows); hover `accent border + accent ink → --line
  border + --txt ink`; intrinsic width → fixed 152px slot.
- Asked or needed? Mine — rows needed a shared name-column edge and the plate had to
  read as a machined slot next to the new keys. The hover-ink reversal is part of the
  ruled hover doctrine (feedback moved to the footer terminal).
- Depends on it: row column rhythm (86px state + 152px ref); refScroll's 114px constant
  ≈ the visible text run inside 152px; the notch echoes the message board's notch corner
  language.

## Pin — CHANGED (geometry kept, physicality + a second size added)

**Now:** kit 13px corner-rider, `radius 0` (was 2px), outline variant border **1.5px**;
added shadow `0 1px 2px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.22)` (it reads
as a raised stud); **NEW mini size** — `10px tall, min-width 10px, 8px type, padding 0
2.5px` whenever a Pin rides a seg cell or a row's pin-wrap. Hover ring removed. The kit
`data-tip` tooltip **survives only here** (everything else routes through the new hint
layer / footer terminal). Usage expanded enormously: filter cells (Work/Open/Done),
group-head gate corners, picker rows (right-seated: `left:auto; right:9px; top:50%`),
jump-band cells, row-signal corners. Special behavior: the **Open filter's Pin becomes
`✕` and turns red on hover — clicking it closes every open row** (destructive of the
working set, so it takes the hot fill).

- Asked or needed? The ✕ close-all is a user-approved session decision. The mini size
  and stud shadow are mine (13px pins swallowed 17px controls).
- Depends on it: every count on the card; the close-all interaction; picker rollups;
  jump-band section counts.

## Door — UNCHANGED (two cascade side-effects)

Only `.door--ghost` appears (empty-state "Show all"). Rules untouched — **Door still
wears its pill radius**; it is deliberately absent from the radius-0 demolition list.
Side-effects it inherits: mono font (was already mono) and the hover ruling (`outline:
none !important` + `brightness(1.15)` instead of the C20 ring). Rebuild from kit.

## chips (segmented toggle `.seg` / `.seg__opt`) — CHANGED (most-changed atom)

**Now:** the track is **borderless and square** (`border:0; radius:0` — the 1px `--line`
box is gone; the well or plate behind provides the enclosure). Cell type is **10px /
800 / .09em** — this knowingly breaks pass rule C5 ("segment text is the ONE chip size",
11px/.05em) for card density. Cells:

- **OFF cell = dark key on well glass** (`#050A10` face + scanlines + machined ring +
  `inset 0 2px 3.5px rgba(0,0,0,.78)`), hover `brightness(1.15)` + ink stays `--txt-3`
  (kit's hover-ink-to-txt reversed).
- **ON cell = pressed key** (darkened gradient + machined ring + press inset). Status ON
  colours unchanged from kit (`--on-accent`, `--on-green`, `--on-red`, …).
- **Context strips:** inside the title pair (`[data-pair]`), the jump band
  (`[data-jump-band]`), and the picker stack (`.seg--stack`), cells flatten to
  `background: transparent; box-shadow: none` — the shared glass does the work; a
  `[data-pair]` ON cell keeps only the press inset + `0 1px 0 rgba(255,255,255,.05)`.
- The state-pair outline (M11) thickens to 1.5px to match the outline chips.
- A per-cell hover ring rule (`outline: 1.5px solid var(--accent); offset -1.5px` —
  finding #5's "ring the CELL not the track") exists in source but is **neutralized**
  by the later `outline: none !important` hover demolition; net hover is the brightness
  lift. Left as-is in source; it is information.

Where they appear, and what each is named: title pair **Units | Categories**; filter trio
**Your Work** (label shortens to "Work" below 420px card width) / **Open** / **Done**;
sort tray **Priority / Name / When / State** (active cell carries the ↑↓ pair, lit arrow
opacity 1 vs .32; clicking the active cell flips direction); the board picker (stacked);
the jump band's three cells (verb / Extend / Call).

- Asked or needed? The key/press physical language is the session's core direction; the
  10px/.09em size is mine (density); the C5 break is deliberate and flagged.
- Depends on it: every toggle on the card; the filter cells' Pins assume the 24px cell
  with mini-pins; jump band cells assume the flattened context strip.

## fields (`.field`) — CHANGED

**Now:** `radius 0 !important`, border 0, and in its one surviving use — the **funnel
key** (filter/sort opener) — it wears the full well-glass recipe + scanline film, ink
`--txt-3` → `--accent` whenever the sort tray is open or a non-default sort is live.
The other kit field uses are gone: the search is a raw `<input>` inside a well div
(24px, mono 10px/800/.09em uppercase, `color: var(--accent)`, `text-shadow: 0 0 7px
currentColor`, transparent native caret replaced by a 6×12px glowing block caret on
`termblink`), and the per-group quick-search is a raw input in the message board.
The opener shape family (5px 5px 0 0) is dead at card level.

- Asked or needed? Mine, following the well-glass direction; the search-well composition
  (ghost placeholder, measured caret position, globe toggle in the right edge) grew out
  of user-driven search-bar iterations early in the session.
- Depends on it: the caret position is measured off a hidden mirror span — font changes
  break caret tracking; the globe button (search-all toggle) nests inside the well.

---

# NEW atoms the kit has no equivalent for

## 1 · Slot rack — the multi-segment state-distribution bar (the candidate you named)

**What it is:** a rack of up to 8 skewed ticks in each group head, one tick per row of
that group, in the group's own row order. Geometry: ticks `slotH × slotH·0.55` (14×7.7px
at saved tweaks), `skewX(19deg)`, `radius 1.5px`, `gap 2.5px`; gloss gradient
(`rgba(255,255,255,.20) → .04 42% → rgba(0,0,0,.28)`) + stud shadow (`inset 0 1px 0
rgba(255,255,255,.24), inset 0 -1.5px 2px rgba(0,0,0,.45), 0 1px 2px rgba(0,0,0,.6)`).

**What it encodes:** each tick's fill = its row's state hue (`--red/--yellow/--blue/
--green`); **gray rows read as unlit sockets** (`#0A1017`, same gloss). A row currently
expanded on the card adds a hue glow to its tick (`0 0 6px color-mix(in oklab,
transparent 40%, hue)`) — the rack doubles as a map of your open rows. It is a
DISTRIBUTION read: severity mix and volume at a glance, in row order (not sorted, not
aggregated).

**Behavior:** empty group → no ticks render. **Retired 2026-07-31 (ledger #170) — no
tick cap, and the rack is not sized off a fixed board:** this section originally said
the message board's fixed 114px reserved the rack's width and capped it at 8 ticks.
Both were wrong about the *cause*, not just the number — freeing the board (P1 dropped
it from the head entirely, see the design log's §5.7) let the rack run the head's full
residual width. Measured on the landed P1 build (design-log §2.5/§5.7.2): the ten head
racks now run **138–243px**, i.e. **16–28 ticks** of real capacity, where this doc's own
math had reserved room for 8. `+N` overflow (mono 9px, `--txt-3`) still fires whenever a
group's row count actually exceeds its rack's current capacity — it just triggers far
less often now that the cap was never a ticks problem. Overflow of one state does NOT
merge ticks — the rack is per-row, never proportional. Hover: tick brightens ×1.5 and
**echoes its row onto the message board** (`name — state`, in the row's hue; long text
marquees). Click: stops the head toggle, expands the group if shut, scrolls to the row,
flashes the row's ring for 1.1s. Filters change the rack — it draws from the group's
*visible* rows.

**Kit relationship:** none. Nearest kin is a Slot (state + count, formerly named Pin —
ledger #177 renamed and rebuilt it, see `../rw-design-system/elements/slot.html`) but
the rack encodes per-row identity and order, which no kit atom does.

## 2 · Message board

A per-group glass board (114×19px, notched NE 11px / SW 8px corners with 45° seam
braces drawn across the cuts) using search-bar glass: well face + scanline film + `inset
0 0 0 1px` seam ring, NO outer machined ring. Idle: prints the group's worst state's
own text (e.g. "3D OVERDUE") in that state's hue, `--txt-3` when all-gray; 8.5px mono
800 .08em uppercase, centered. On slot-rack hover: becomes the echo display
(left-aligned, `bslide` marquee if long). On click: becomes a quick-search input scoped
to the group (accent ink + `0 0 7px` phosphor glow, block caret, tan ghost text
`#C28E54` — near-miss of `--tan`, flagged). Blur closes it and **clears the query**.

## 3 · Footer terminal (the rail)

The card's one voice, 17px glass strip in the footer chassis (chamfered groove +
`#050A10` glass, `inset 0 1.5px 3px rgba(0,0,0,.7)`, scanline film). Prints, in priority
order: grip-slot hover (group name in group hue) → head hover ("Expand X · N items") →
teleport flash ("Teleport → …", 1.7s) → "N hidden by filter" → "▾ more below" → "End of
list · N items" (dimmed accent `color-mix(in oklab, var(--accent) 52%, #16202C)`).
Everything else accent, mono 10px/800/.09em uppercase, `text-shadow: 0 0 7px
currentColor`. Text wider than the box duplicates with a 36px gap and loops (`termloop`,
duration `max(6, round((textW + 36) / 26))s` — constant px/s speed). This atom is WHY
hover rings could be deleted: hover explanation moved here.

## 4 · Grip rack

8 skewed slots (8.5×15px, `skewX(-19deg)` — mirror of the slot rack) in a chamfered
glass well, footer right, shown at card width ≥ 330px. Encodes scroll position (slots
fill left→right as you scroll, each slot tinted by the group occupying that eighth of
the scroll range) AND group nav: hover lights the slot + prints the group name to the
terminal; click scrolls that group into view (centered if it fits). Fat invisible hit
areas (`::before inset -6px -2px`).

## 5 · Roll marker

The card-level worst-state flag: a 16px-wide angled pennant clipped over the frame's
top-left edge, hue = worst state on the whole card (filter-independent), gloss +
`drop-shadow(1px 1.5px 1.5px rgba(0,0,0,.45))`, backed by a seam-dark border layer and
a faint lit halo layer (parallel 45° offsets — recompute the 1.414/0.414 offsets if the
border width tweak changes). Hover anywhere on it (or its 20px hit zone) prints the
Your-Work summary to the hint layer. It replaced the old header rollup chip.

## 6 · Laser frame

The cartridge's state-hued boundary: ONE polygon groove (`#04070C`) + ONE polygon beam
(group hue, 1.4px), wrapping down the left rail, across the bottom, up the right — with
a 45° chamfer at bottom-left and square 90° bends elsewhere. Open: wraps the whole
terminal; shut: retracts to stubs beside the head. Geometry hand-tuned to the 7px rails
(coordinates in CSS §4.7a); the old laser tweaks no longer drive it. Matte at saved
settings (`laserGlow 0`).

## 7 · Hint layer

One delegated tooltip for the whole card, driven by `[data-hint]` attributes: 540ms
dwell before first show, instant swap between targets once up, `data-hint-now` skips
the dwell (jump accelerators never wait), suppressed while a jump band is open (except
over the band's own Pins). Renders `--panel-2` / 1px `--line` / **9px radius** (the
second rounded survivor — an inconsistency preserved as information), 11.5px Archivo,
pre-line. Replaced native `title` and (almost everywhere) the kit Pin tooltip.

## 8 · Jump band (behavior atom)

The settle-armed section menu that slides under a row: 69% width, 24px, opaque wash
(`color-mix(in oklab, var(--txt) 5%, var(--card))`; `--panel-2` over an open row).
Three cells: leading **verb** in the row's hue (outline `inset 0 0 0 1.5px currentColor`;
verb by state: red Dispatch · yellow Return · blue Confirm · green Reopen · gray
Reserve) + Extend + Call, each with a mini Pin (that section's state + count). Arming
state machine: arms only inside the row's central 24px band after a 450ms settle; once
one band is up, row-to-row swaps are instant ("warm"); exiting through the band's bottom
quarter dismisses AND goes cold; row-leave closes after 320ms grace. An expanded row
holds its band open permanently.

## 9 · Tongues (dormant)

Hanging 45°-cut tabs under a collapsed head (18% width × 5px, groove + hue line + nub).
Built for the hanging-tongue collapse direction; the template still renders them but
their opacity is emitted `0` in every state since the retracting-stub laser superseded
them. Dormant, not deleted — see Decisions § Rejected alternatives.
