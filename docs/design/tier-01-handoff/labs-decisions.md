# Tier 0.1 Decisions — session ledger

Status meanings, applied strictly:
**LOCKED** — explicitly approved in-session (your words, your dial, or your ruling ledger).
**PROPOSED** — designed by me, never signed off. **ASSUMED** — I needed an answer to
proceed and picked one. Where a direction was approved but my execution details inside
it were not individually reviewed, the direction row is LOCKED and the detail rows are
PROPOSED. Rows unnumbered for your ledger merge.

**Ruled 2026-07-28 (session 2):** every PROPOSED/ASSUMED row below now carries its ledger
disposition inline (LOCKED / REJECTED / DROPPED / PROVISIONAL / CONFIRMED + a `#`). See
`docs/superpowers/specs/2026-07-20-decisions-ledger.md` #153–#162 for the full rulings —
this file's own status column is left stale on purpose as a record of what Labs proposed;
the ledger is the actual source of truth.

| Decision | Why | Status |
|---|---|---|
| Panel seams are the 3-layer hairline recipe (dark groove + bright lit-side hairline + faint far-side hairline, lit side ~2× brighter) | A bare dark line reads as a drawn border, not two metal parts meeting; the asymmetry is what sells machining | LOCKED |
| Kit hover overrides of 2026-07-26 (ring the cell not the track; no hover ink change) — finding #5 | Pseudo-class rules on kit classes can't be expressed inline; ruled and filed in the container document §5 | LOCKED |
| Filter-cell hue follows its TARGET: Done wears green, Your Work falls back to accent (#137 carve-out) | Your Work spans red∪yellow∪blue — no single status hue is honest | LOCKED |
| All hover rings subsequently removed card-wide; hover feedback = brightness lift + print to footer terminal | Orange outlines everywhere made hover the loudest thing on a dense card; accent must mean "turnable", not "pointed at" | LOCKED |
| Cool-tone controls (blue/green/gray Gates and row Signals) are dark keys: near-black face, thin hue ring, flat hue ink. Red/yellow keep the hue fill | Filled cool chips read as glossy candy against steel; heat must stay the loudest thing on the card | LOCKED |
| Groups are cartridges that own their frame edges (rails, laser groove+beam, retract-to-stub when shut) rather than floating headers on a background | The card is a machine; a group is an inserted unit, and its state boundary should be part of its body | LOCKED |
| Laser frame: hue beam wraps the open terminal with a 45° chamfer at bottom-left, square bends elsewhere; collapsed = stubs beside the head | Continuous physical circuit; the chamfer echoes the card's corner language | LOCKED |
| Terminal interior is near-black glass (termDark 85) with the scanline film OFF (termStyle flat) | Dialed and saved by you | LOCKED |
| Message board on every group head: worst state's text in its hue; echoes row name on slot hover; click = group-scoped quick search | The head should tell you what's wrong before you open it; search-bar glass, no scanlines, keeps it an instrument not a control | LOCKED |
| Slot rack in every head: one tick per row, row order, hue = state, capped at 8 + "+N" | Distribution at a glance; per-row identity makes ticks jumpable | LOCKED |
| Heads carry a strong lit top hairline + the state hue bleeding ~11px down from the top edge | Light from above; the bleed lets a shut cartridge still radiate its state | LOCKED |
| Groups sit inset from the card frame (groupInset 1.5px, groupGap 3.4px saved) | Dialed and saved by you | LOCKED |
| OPEN filter's Pin becomes ✕ (red) on hover; clicking it closes all open rows | You asked for a fast way to shed the working set | LOCKED |
| Three steel tiers + hue tinting per family (chassis/plates/frame/cartridge; saved: navy/graphite/navy/navy, hueStrength 30, contrast 100) | Dialed and saved by you | LOCKED |
| Corner roll marker geometry (x1, w16, top 0, bottom 37, cap 2, border 2 @ tone 45) | Dialed and saved by you | LOCKED |
| Radius ladder off at card level: radius 0 on seg/signal/pin/field/ref; chamfers and notches carry the shape language | Radii read as plastic against the machined frame; shape semantics moved into finishes (key/press/well) | **LOCKED — ledger #140** |
| Door keeps its pill (only atom exempt from radius 0); ref icon 5px and hint bubble 9px also survive rounded | Never discussed; the demolition list simply never included them | **RULED — ledger #153.** Door's pill CONFIRMED (predates this session, ledger #15); ref icon 5px and hint bubble 9px ZEROED to 0 |
| Seg cell type 10px/.09em (breaks pass rule C5, 11px/.05em, "one chip size") | Card density at 380px; 11px cells overflowed the plates | **REJECTED — ledger #154.** Holds canonical 11px/.05em; overflow solved another way in Tier 0.2 |
| Head controls are a second 17px/9px size (Gate, row Signals, Ref plates) — off the 24px ladder | 24px controls swallowed the 30px rows and heads | **DEFERRED to Tier 0.2 — ledger #143** |
| Row Signal column fixed-width: max(66, longest-state × 7.15 + 14)px, all keys share edges | Ragged chip widths made the state column unscannable | **LOCKED — ledger #155.** 7.15px/char constant flagged for re-measurement |
| Ref re-cut: dark plate #0B121B, NE 45° notch, borderless, mono, fixed 152×17 slot in rows, hover marquee for long names | Rows needed one name-column edge; the notch ties Refs to the board's corner language | **LOCKED — ledger #155** |
| Mono voice on every control atom incl. Ref (kit Ref was Archivo) | One instrument voice inside the machine; Archivo stays for prose (hints, empty state) | **LOCKED — ledger #142** |
| Pin: stud shadow + 10px mini size on seg cells / row corners; kit data-tip tooltip survives only on Pins | 13px pins overpowered 17px controls; counts had to ride everything | **LOCKED — ledger #155** |
| Row hover/flash washes mix from --txt over #101921 (off-white), never accent; open-row wash = group hue at 16% | Orange is reserved for controls you turn and live info | **SPLIT — ledger #156/#157.** Open-row wash LOCKED (#156); the off-white hover wash itself is REJECTED and replaced by a three-way material hover system (#157) |
| Jump band: settle-armed (450ms) in the row's central 24px, warm-swap between rows, cold on dismiss-through-bottom, 320ms leave grace; expanded rows hold their band | Sweeping a list must never flicker menus; paying the settle once keeps it an accelerator | **LOCKED — ledger #161** |
| Jump verbs by state: red Dispatch · yellow Return · blue Confirm · green Reopen · gray Reserve; cells are verbs (no fills), leading verb outlined in row hue | A menu of verbs, nothing "selected"; verb copy invented to demo the pattern | **REJECTED — ledger #158.** Matches nothing in the shipped app; Tier 0.2 designs against the real status-dropdown mechanism instead |
| Hint layer: 540ms dwell, instant swap once up, data-hint-now bypass, suppressed under open jump bands | A tooltip explains so it waits; an accelerator accelerates so it never does | **LOCKED — ledger #161** |
| Footer terminal is the card's one voice (scroll state, filter counts, hovers, teleports; loops long text at constant speed) | One place to look; lets every other surface stay quiet | LOCKED |
| Grip rack: 8 slots = scroll position + group nav, group-hued, shown ≥330px width | The scrollbar was invisible and groups needed a jump control that shows where the heat is | **PROVISIONAL — ledger #162.** Re-verify in Tier 0.2 |
| Title is a recessed glass board holding the Units∣Categories pair; tapping the active side opens the picker to reseat that half | The title IS the toggle; a slot machine metaphor — boards seat into the card | LOCKED |
| Picker rows carry each board's rollup Pin (worst hue + count) | Choose a board knowing what's in it | **LOCKED — ledger #156** |
| Sort lives behind the funnel key; the tray stays open whenever a non-default sort is live | Sort is rare; a live non-default sort must stay visible or it silently lies | **LOCKED — ledger #156** |
| Search-all globe toggle inside the search well | You asked for cross-board search reach from this card | LOCKED |
| Boot theatre: crtWake flicker, laser drop, per-row type-in + caret sweep (steps(16), .07s stagger) on group open | The terminal fiction needs a power-on; durations tuned to stay under ~.6s | **LOCKED — ledger #161** |
| Density compact=30px rows saved; standard 44 / roomy 52 retained as tweaks | 30px dialed and saved by you; the other stops kept from the kit-era ladder | LOCKED |
| Dispatcher group order: Field Calls, On Rent, Reserved, Available, Returned Today | Attention first, then lifecycle in dispatch reading order | **REJECTED — ledger #159.** Matches nothing in the shipped app; Tier 0.2 uses the real GROUP_DEFS/UNIT_SECTIONS order |
| Yard role order variant (field, avail, onrent, reserved, returned) | Needed a second role to prove the ORDER mechanism; never confirmed | **DROPPED — ledger #159.** Was a stub only; the real reorder mechanism already ships |
| Breakpoints: facts shown ≥440, "Your Work"→"Work" <420, grip ≥330, when-column 96px ≥440 | Needed values to keep 380px clean; never reviewed at other widths | **PROVISIONAL — ledger #162.** Re-verify in Tier 0.2 |
| All row/rollup data (names, S/Ns, ROLLUP counts, sigCount = 3/2/1/0 by tone, jump-cell counts) | Placeholder demo data; Tier 2 owns the real numbers | **CONFIRMED — ledger #160.** No ruling needed |

## Departures from the synced design system

Reported, not defended. Each needs individual sign-off.

**Glow / bloom / halo (system: matte, no glow).** The steel and the chips stay matte —
no atom fill glows. But the card commits to an *emission* fiction for glass and
phosphor: `text-shadow: 0 0 7px currentColor` on all terminal text (search input, footer
rail, board text/ghost); glowing block carets (search, boards); slot-rack ticks of
currently-open rows glow in their hue (`0 0 6px`); grip slots glow when filled/hovered
(`0 0 5px/8px`); the head's hue bleed washes 11px down from the top edge; a laser-glow
tweak exists but is saved at 0 (beams are matte). Rationale on record: light may be
*emitted by glass*, never *applied to steel*.

**Corner treatment (system: 4-shape radius ladder — 2px chips / 5px-top openers / 8px
records / pill actions / 14px containers).** Radius 0 across seg, signal, pin, field,
ref; containers are chamfer-clipped polygons (card 16px top / 10px bottom-left; plates
8–9px; footer 14/8px), Refs and boards take 45° notches, braces cross the notches at
45°. Rounded survivors: Door's pill, `.ref__icon` 5px, hint bubble 9px, tick/board 1–1.5px
softening. The opener shape (5px 5px 0 0) is dead at card level. **Ruled (ledger #153):**
Door's pill CONFIRMED as pre-existing canon (not this session's exception); `.ref__icon`
and the hint bubble are ZEROED to 0.

**Card header.** The system-era card had a left-aligned title (board toggle) with a
one-line description under it. The description was removed in the container-document era
("sort and the description have since left the band"); this session replaced the whole
band-1 layout with: centered recessed title board (Units∣Categories pair + picker) on
its own mounted plate, filter trio on a second plate to its right, corner roll marker at
the far left. No description anywhere; its context job migrated to the footer terminal
and the message boards. (A `showDesc` computation survives in logic, consumed by
nothing — fossil.)

**Filter chips: three, named Your Work · Open · Done.** The synced-era header had two
(Your Work, Done) sharing one seg. *Open* (everything you've expanded here; hover turns
it into Shut/close-all with the red ✕ Pin) was added this session. Each cell carries a
Pin: colour = worst state in that bucket (Done: green; Open: gray, red on ✕-hover),
number = count, hidden at zero. Sort is not a chip — it lives behind the funnel key.

**Diagonal / hazard striping.** Nothing hazard-striped exists in the final card. The
`fireTreatment: stripe` option survives as a tweak but is inert (computed, never
rendered — §6 of the CSS). Diagonals that DO exist: 19° skew on slot-rack ticks and grip
slots, 45° chamfers/notches/braces, the angled roll marker. The kit's 3px solid plate
stripe is gone — attention groups signal via laser hue, head bleed, and board text
instead.

**UNITS and CATEGORIES: one card.** A single card owns one slot with a two-board pair
seated in it; the title toggle switches instantly between the pair, and tapping the
active side opens the picker, which reseats that half of the pair from the full board
list (each row showing its own rollup Pin). They are not two cards and there is no
second frame.

## Rejected alternatives

- **C20 hover rings (kit) / orange outlines on rows** — at card density hover became the
  loudest signal on screen and accent stopped meaning "turnable". Replaced by brightness
  lifts + footer-terminal print. The per-cell ring ruling (finding #5) was itself later
  neutralized by the blanket `outline:none` pass — the rule text survives in source.
- **Native `title` / kit Pin tooltips as the general feedback channel** — slow, unstyled,
  or (Pin's) too narrow in reach. Replaced by the delegated hint layer + terminal. Pin
  keeps its own tooltip as the one survivor.
- **Glossy hue fills on cool-tone Gates/Signals** — read as plastic candy against the
  steel; kept only for red/yellow where loudness is the point.
- **Hanging-tongue collapse** (tabs slide out under a shut head) — superseded by the
  laser stubs, which say "retracted" with less furniture. The tongues still render at
  opacity 0; delete or revive consciously.
- **Dry-rail laser housings** (per-group segmented rail cartridges; the `dryStyle`,
  `railFrameW/Pad/Radius` tweak family) — too much furniture per group; beams integrated
  into the cartridge body won. Tweaks remain in the panel, inert.
- **Laser as inset box-shadow frame** (`frameShadow`/`laserShadow` fossils) — box-shadows
  can't chamfer or retract; polygon groove+beam replaced them.
- **laserStyle chunky / core-bloom with glow** — you dialed glow to 0 and kept thin-glow
  geometry: a matte 1.4px beam.
- **Header rollup chip** (card-level worst-state chip in band 1) — its two jobs moved to
  the filter cells' Pins (zero slots consumed); the roll marker took the "worst state at
  a glance" job at card level.
- **Hot-row stripe / permanent hot-row tint** (`fireTreatment`) — rows stay quiet;
  the state key carries the heat. The tweak path is inert in the final template.
- **Accent row-hover wash** — off-white `--txt` wash won (orange discipline). **Superseded
  (ledger #157):** the off-white wash itself is now rejected too, replaced by a three-way
  material hover system (steel = elevation lift, open-group terminal rows = an animated
  light-beam wrap, message-board glass = a cursor-following gradient).
- **Terminal scanline film** — built, tweakable, saved OFF; the ultra-faint 3px raster
  on the terminal body stayed.
- **Jump band above expanded rows** (`jumpPos` fossil) — band now always hangs below.

## Still open

- **Tier 1 drawer** is a parked placeholder (label + three skeleton bones). Nothing
  about the expanded record view is designed.
- **Teleport is a stub**: state-chip / board-name clicks flash "Teleport → …" on the
  terminal and go nowhere. Destination UX unanswered; the click-swallowing contract
  (chip teleports, row expands) is load-bearing and settled, the destination isn't.
- **Globe (search every board)** toggles its own state and tip only — cross-board search
  behavior, result presentation, and scope persistence were never specified.
- **Board quick-search persistence**: I asked whether a group query should survive blur;
  no answer — current behavior clears it on blur, so the board never silently filters.
- **Inert tweak sections** (fireTreatment, slotOverlay, laserStyle/laserW/laserGlow,
  dryStyle + the three rail sliders): remove, or rewire to the polygon laser? Never
  settled; they sit in the panel doing nothing. The polygon geometry they should drive
  is hard-coded (CSS §4.7a).
- **Density standard/roomy**: row height scales (44/52px) but the 17px control size,
  racks, and head height don't — never reviewed off `compact`.
- ~~**Yard role ordering** and the whole second role's reality: assumed to exercise the
  ORDER mechanism.~~ **Ruled (ledger #159): dropped.** The dispatcher order and this variant
  both matched nothing in the shipped app; Tier 0.2 uses the real GROUP_DEFS/UNIT_SECTIONS
  order, and this stub is discarded.
- **Width breakpoints** (330/420/440) and behavior below ~300px: my numbers, unreviewed.
  **Ruled (ledger #162): accepted provisionally**, re-verify against real column widths in
  Tier 0.2.
- **stateW calibration**: 7.15px/char was measured against 11px mono; row keys now
  render 9px. It works because the width is generous, but the formula's premise is stale.
- **`groupGap` first-group special case**: logic emits `4px` base top pad before group 1
  vs `0px` for the first cartridge's own margin — two constants doing one job; which is
  intended was never discussed.

## Notes to the implementer

**Least confident, and why:**
- **Laser polygon geometry** (CSS §4.7a): every coordinate is hand-tuned against 7px
  rails, 5px groove offset, 30px head, current chamfer runs. Change any of those and
  both groove and beam polygons (open AND shut variants) must be re-derived — the tweaks
  that pretend to control this are disconnected.
- **The §3 cascade**: the override block is order-load-bearing (e.g. the per-cell hover
  ring is later neutralized by `outline:none !important`; `.ref` hover rules fire before
  the blanket kill). Reordering "tidier" will change behavior.
- **Measured-text machinery**: footer loop and both carets depend on hidden mirror spans
  measured after font load; a font swap or `letter-spacing` change silently breaks caret
  position and loop duration.
- **Roll-marker math**: the border/halo layers stay parallel only via the `1.414 ×
  borderW` / `0.414 × borderW` offsets; hand-editing one polygon corrupts the 45° edges.
- **Scanline pitch (3px) vs odd control heights** (17/19px glass): the film aligns
  because heights were chosen against the pitch; changing either causes visible beat
  patterns.

**Do not change without understanding why it's that way:**
- **`rgba(185,205,235, …)`** is the single light source. Every lit hairline derives from
  it; changing one alpha breaks the light model's asymmetry (lit side ~2× the far side —
  CLAUDE.md recipe, user-approved).
- **Radius 0 + chamfers** is the identity of the card; "restoring" the kit ladder
  un-machines it. Equally: Door's pill and the hint's 9px radius are *knowing*
  survivors — zeroing them was never ruled.
- **Red/yellow stay filled** while cool tones go dark-key: the heat hierarchy is the
  point, not an inconsistency.
- **Accent discipline**: orange = turnable controls and live terminal info only. No
  hover orange, no status orange. The Done cell is green and the open-row wash is the
  group hue for this reason (#137).
- **The footer terminal is the feedback channel** — removing or demoting it re-orphans
  every hover that used to have a ring.
- **Jump-band timings** (450ms settle / warm-swap / 320ms grace / central-24px arming /
  bottom-quarter dismissal): each number closes a specific flicker or reach failure;
  they were tuned together.
- **`!important` density in §3** exists to beat kit specificity without editing the
  synced bundle — the bundle stays pristine on purpose (it is the shared kit).
- **Vestigial code is documentation**: the inert tweaks, dormant tongues, and unused
  renderVals are the fossil record of the rejected alternatives above. Strip them only
  after this ledger is merged.
