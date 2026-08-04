# Chrome Spec — the Tier-01 card's three chrome elements, as Halo parts

**Scope.** The Halo kit (`docs/design/halo-elements/`) covers card *body* furniture only:
`housing`/`deck` (the row shell), `conduit` (the rail + elbows), `cartridge` (subitem
housing), `marks` (name/hexicon), `chip`/`screen` (glass readouts), `slots` (the tick
rack), `etch`, `bracket`. It does **not** cover the three pieces of *chrome* that sit
above and below that body on a Tier-01 card:

1. **Header tab bar** — the title pair `UNITS | CATEGORIES` (one segmented group) plus
   the filter trio `WORK | OPEN | DONE` (a second segmented group), active tab accented.
2. **Search bar** — a filter/sort-opener icon button + a search well with placeholder text.
3. **Footer** — a "▾ more below" terminal affordance + a gauge/striped block (scroll
   position) at the right.

This spec says how those three get built **as Halo parts**, reusing the kit's own
recipes rather than inventing a fourth visual language. It is a spec, not code — no CSS
below is meant to ship as-is; every number is a starting point for the pixel-gate
discipline the kit already runs on (`docs/design/halo-elements/README.md:93-107`).

**Sourcing boundary.** Everything cited below is either an existing Halo part sheet
(`docs/design/halo-elements/parts/*.css`, `ANATOMY.md`) or a row in the decisions
ledger (`docs/superpowers/specs/2026-07-20-decisions-ledger.md`, rows #101+ take
precedence over #1-100 per its own precedence rule). Where the Tier-0.1 handoff
(`docs/design/tier-01-handoff/atom-rebuild.md`) already specced the *functional*
version of one of these three elements (in the flat radius-0 language), that spec is
cited too — the job here is translating its geometry/behaviour onto Halo's steel/glass
vocabulary, not re-deciding what the element does.

---

## 1. Header tab bar

### Material family

**Mixed, split by piece, per the taxonomy ruling (ledger #211):** *"The slots are Steel
Elements… The buttons/gates are digital so they live in the message glass… Facts and
Names are also Steel elements because they don't change."*

- The **bar's own frame/strip** (the housing the two segmented groups sit in) is
  **STEEL** — it is structure, it does not change when a tab is clicked, only its
  contents' *selected* state does.
- **Each tab cell's face** is **GLASS** — a tab is a control the user *turns*
  (`atom-rebuild.md:133-165` already calls its cells "key"/"pressed key," i.e. a lit
  well-glass face inside a machined ring), and #211's operative test is exactly
  "changing/interactive." A tab bar cell is closer kin to a Gate than to a name plate.
- Per the emission fiction (#146: *"light is emitted BY GLASS, never applied TO
  STEEL"*), only the **active** cell's ring should carry any lit/glow treatment; the
  steel strip underneath stays matte.

### Parts reused

| Piece | Halo part | Why |
|---|---|---|
| Bar frame/strip | `parts/housing.css` `.halo-housing` (`.back`/`.face`/`.rim-t`/`.rim-b`) — housing.css:110-143 | The measured multi-stop steel gradient + rim-strip recipe is the kit's only "static steel bar" pattern; reuse its `.face` gradient stack and rim strips at reduced height rather than authoring a new steel bar from scratch. |
| Each tab cell | `parts/chip.css` `.halo-chip` (`.plate.oct`, `.inner.oct`, `.ringlayer`) — chip.css:174-253 | Chip is the kit's only "steel plate + lit ring around a glass cavity" recipe — structurally identical to what a toggle cell needs (dark key face + machined/lit ring). Its `.bloom` and `.cap` (chip.css:197-211, 258-265) are mockup-scale decoration specific to the *status-chip* reading and should be **dropped** for a tab cell — they read as a warning-light smear/end-cap rail, not a toggle. |
| Chamfer | `tokens.css` `.oct` (tokens.css:86-89; used today only by chip's `.plate`/`.inner`, ANATOMY.md:93) | TR+BL 45° cut — the same primitive already carrying the card's "radius 0 + chamfers" identity (ledger #140) into the Halo kit. Use `.oct`, not `.oct4` — a tab cell reads as one flat plate, not an all-corners cartridge. |
| Selected-cell highlight | Not a Halo part — the existing canon recipe (ledger #205) | *"ONE select highlight for every toggle, with a centered bump inside the bottom border"* — reuse this **verbatim** on top of the lit chip ring; do not invent a second selection language for the Halo version. |

### Geometry

- **Cell height = 24px** (`style` §1's one control height; ledger #143 — *"the 24px
  control law is HELD, not broken"*). This is well under any existing Halo chip
  instance (60.5–71px tall at mockup scale, ANATOMY.md:125-128) — a new, smaller
  variant class is required (see **Needs Jac** #1 for how faithfully it can scale).
- **Chamfer (`--pcut`)**: chip's four instances run 21–25px cut on 60–71px plates —
  roughly **33–35% of plate height**. Held at the same ratio, a 24px cell chamfers at
  **≈8px**. Flag for gate re-measurement, not a literal carry-over number.
- **Ring stroke**: chip.css:233-234 fixes halo-stroke `--hw:3.8` / core `--cw:2.8` on
  every one of the four mockup instances (chip.css:41-46 documents these as *never
  overridden*) — roughly **6% / 4.4% of plate height**. At a 24px cell that ratio gives
  **halo ≈1.5px / core ≈1.1px**. Below 1px risks disappearing on a standard display —
  flag as the geometry most likely to need a manual re-fit rather than a pure ratio
  carry-down.
- **Group gap**: the title pair and filter trio are two separate segmented groups on
  one strip; no Halo or canon source fixes the gap between them. Propose **8px**
  (Rentals/Units card gutters elsewhere in the design system use 8px multiples) —
  **unconfirmed, flag in Needs Jac**.
- **Bar strip height**: 24px cell + 4px top/bottom reveal of the steel frame (so the
  chamfered cell corners read as *seated into* the steel, per the seating law — ledger
  #229, *"seated or proud — pick one, never mix… a tight seam all round with no
  offset"*) → **strip height ≈32px**.

### Colour

- **OFF cell**: dark key face, matching `atom-rebuild.md:140-142`'s existing spec
  (`#050A10` face + scanlines) — reuse **screen.css**'s `.glass::after` scanline film
  (screen.css:130-133) inside the chip's `.inner` cavity rather than re-deriving a new
  scanline recipe. Ink `--txt-3`.
- **ON cell**: ring stroke = **`--accent` `#ff7e1f`**, *not* a status hue. Per the
  agency law (ledger #137, wrangler-style §3 preamble): *"Accent means USER AGENCY;
  status hues mean THE WORLD… the selected row, an active filter… is `--accent`."* A
  tab selection is exactly this — swap chip.css's mockup `--stroke:#f85a5c` default for
  `--accent`, and `--fill`/`--gt`/`--gb`/`--gs` (the inward glow, chip.css:247-252) mix
  toward `--on-orange` per wrangler-style §1 (*"Fills always take dark ink"*).
- **Frame/strip steel**: pull housing's `.face` gradient through `steel-skin.css`'s
  `--steel-h/-s/-tint` knobs (canon-colour-map.css:25-39; ledger #218/#222), so the tab
  bar's steel automatically matches whichever of the four colourways (#228) the host
  card is wearing — never a separately hand-picked grey.

### Type

- **Mono, 700-800 weight** — ledger #142, *"MONO on every control atom."*
- **11px / 0.05em tracking** — ledger #154 explicitly **REJECTED** the 10px/.09em
  card-density shrink Labs proposed (`atom-rebuild.md:137`) and **HELD the canonical
  11px/.05em `style` C5 pass rule ("one chip size")**. Cite #154, not
  `atom-rebuild.md`'s 10px figure — that number is superseded.
- Cell label: UPPERCASE (matches every other stamped/mono label in the system,
  wrangler-style §2).

---

## 2. Search bar

### Material family

**All glass.** A search well is the textbook case of #211's "changing/interactive" —
live typed text — and it is already specced in the flat-language kit as exactly that:
*"the search is a raw `<input>` inside a well div"* (`atom-rebuild.md:171-174`,
ledger #151). Nothing about it is static, so nothing about it is steel.

### Parts reused

| Piece | Halo part | Why |
|---|---|---|
| Well body + scanline + hairline ring | `parts/screen.css` `.halo-screen` (`.body`, `.glass`, `.glass::after`, `.hair`) — screen.css:114-144 | Screen's body/glass/hair stack **is** the well-glass recipe atom-rebuild.md:169 calls for on the funnel key: a machined dark frame around a tinted glass cavity with a scanline film and a thin hairline ring. Reuse it directly rather than authoring a new glass well. |
| Typed/placeholder text | `parts/screen.css` `.readout` pattern (screen.css:148-153) | Same construction (`position:absolute`, `var(--mono)`, weight 700) shrunk from the mockup's 40.4px readout down to input-field size — the pattern (mono, glow via `text-shadow`) carries, the literal size does not. |
| Filter/sort opener icon | `parts/chip.css` `.halo-chip`, compact + unlabelled, **or** `parts/marks.css` `.is-hexicon`'s stroke-only-SVG technique (marks.css:69-77) | The opener is itself a small interactive control (opens the sort tray, ledger #151), so per #211 it is glass, not steel — a small chip (plate + ring, no bloom/cap) reads as a "key" the same way a tab cell does. If a literal funnel/filter glyph is wanted instead of an octagon plate, marks' stroke-only SVG-in-a-fixed-box pattern (no fill, miter joins) is the reusable *construction*, not its hexagon shape. |

### Geometry

- **Height = 24px** (same control-height law as the tab bar).
- **Chamfers**, scaled from screen.css:66-68's fixed per-layer cuts (`.body` 19px,
  `.glass` 15px, `.hair` 12px, `.hair > i` 11.4px on a ~219px-tall plate — **≈8.7% of
  plate height** for `.body`): held at that ratio on a 24px well gives **body ≈2px,
  glass ≈1.6px, hair ≈1.3px, hair>i ≈1.2px**. These compress toward the resolution
  floor fast — this is the strongest candidate for "just author the small variant by
  eye and re-gate," not for a literal ratio carry-down.
- **Hairline ring** stays a genuinely thin 1px stroke (screen.css:136-140 already
  specs it as 1px-equivalent at any plate size — it does not scale with `--hw`/`--hh`,
  it is a measured, non-derived box per screen.css:47-55).
- **Caret**: reuse the existing canon spec verbatim, unchanged by the Halo pass — a
  **6×12px glowing block caret** on `termblink`, `text-shadow: 0 0 7px currentColor`
  (`atom-rebuild.md:172-174`). This is not a Halo geometry question; it is already settled.
- **Layout**: filter-icon button is **left-anchored, fixed 24×24px**; the well **takes
  the residual width** — this is the same edge-anchored/residual law #170 already locks
  for the slot rack (*"every other element in the head is edge-anchored… the slot rack
  is the one element that takes the RESIDUAL width"*), applied here to the well instead
  of a rack.

### Colour

- **Hairline ring / frame**: keep Screen's existing cyan tint
  (`rgba(90,160,190,.30)`, screen.css:139) — this is *structural* glass (the frame
  around the well), not the control content itself.
- **Caret + typed text + placeholder ink**: **`--accent` orange, NOT cyan** — ledger
  #197 is explicit and names this exact control: *"Glass surfaces retire the one-accent
  rule… display text on glass (boards, drawer, footer rail) reads cyan… but
  **controls** on glass (**the search field**, caret) read accent orange."* Do not
  reuse Screen's own cyan `.readout` colour (screen.css:151, `#f4595a` is
  mockup-specific anyway) for the typed text — that would violate #197's readout/control
  split inside a single element.
- **Well face**: Screen's `--glass` var (screen.css:159/164) run through
  `steel-skin.css` so the well's base tint tracks the card's colourway the same way the
  tab bar's steel does.

### Type

- **Mono, 10px / 800 / .09em uppercase**, per `atom-rebuild.md:171-173`'s existing
  spec — **this figure was never rejected** (ledger #154's rejection is scoped to the
  *seg cell* type only, not the search well). Keep it as-is.

---

## 3. Footer

### Material family

**Glass for the terminal strip; a steel-in-glass hybrid for the gauge**, again by
#211's own stamp table:

- **"▾ more below" terminal** = pure **GLASS**. This *is* card #150's "one voice":
  *"The footer terminal is the card's one voice, and it is WHY hover rings could be
  deleted: every hover explanation moved there… it is load-bearing, not decoration."*
  It is built to emit (#146) — glow, scanlines, marquee — never matte.
- **Gauge/grip rack** (the scroll-position striped block at the right) = **steel ticks
  seated inside a glass well.** `atom-rebuild.md:245-252` already describes it that way
  — *"8 skewed slots… in a chamfered glass well"* — and ledger #211 explicitly
  restamps the tick class itself to steel: *"`.rw-tick`… → steel (ticks now glisten on
  hover like other steel)."* So: **well = glass, ticks = steel**, matching the same
  split the row-level slot rack already uses.

### Parts reused

| Piece | Halo part | Why |
|---|---|---|
| Terminal glass strip | `parts/screen.css` `.halo-screen` (`.body`/`.glass`/`.glass::after`) — screen.css:114-133, stretched to a full-width strip instead of an octagon plate | Same well-glass recipe as the search well (§2) — one glass construction reused a third time, not a new one invented per surface. |
| Terminal groove/chamfer | `tokens.css` `.oct` (tokens.css:86-89) | The terminal sits in *"a chamfered groove"* (`atom-rebuild.md:235`) — `.oct`'s TR+BL cut is the kit's standing chamfer primitive; reuse it rather than a bespoke clip-path. |
| Gauge ticks | `parts/slots.css` `.halo-slots .b` (skew, radius, blur, gloss-cap) — slots.css:93-124 | Slots' bar recipe (`skewX(18deg); border-radius:13px; filter:blur(1.4px)` + the `::before` specular gloss cap) is exactly the tick geometry the grip rack needs, mirrored to `skewX(-19deg)` per `atom-rebuild.md:247`. |
| Gauge well | `parts/screen.css`'s `.oct4`-chamfered body/glass stack (via `tokens.css` `.oct4`, tokens.css:91-96), sized to a thin horizontal strip | The grip rack's well is chamfered on all corners (a self-contained pocket, not a plate edge), matching Screen's `.oct4` usage rather than `.oct`'s two-corner cut. |

### Geometry

- **Terminal strip height = 17px**, taken directly from `atom-rebuild.md:235`'s
  existing spec — this figure is not a Halo re-derivation, it's an already-settled
  measurement to carry forward unchanged.
- **Terminal chamfer**: held at Screen's ~8.7% height ratio (see §2) on a 17px strip
  gives **≈1.5px** — effectively a hairline notch rather than a visible chamfer. Flag:
  at this height the chamfer may read as noise; consider whether the terminal should
  chamfer at all, or take a plain rim like housing's `.rim-t`/`.rim-b` (1.6–1.8px,
  housing.css:138-139) instead. **Needs Jac** #6.
- **Gauge ticks**: `atom-rebuild.md:247` sizes them **8.5×15px**, 8 slots, in the
  flat-language kit — these are literal card-scale numbers (not mockup-scale), so
  unlike the tab bar / search well they need **no rescaling** to port onto Slots' `.b`
  recipe; only Slots' skew direction and fill logic need adjusting (see Colour below).
- **Gap between ticks**: Slots' own bar-to-bar spacing is a measured per-instance
  value baked into each `left` offset (slots.css:129-193), not a single knob — the
  grip rack should define its own fixed gap (`atom-rebuild.md` doesn't state one)
  rather than inherit Slots' three different mockup gaps. **Needs Jac** #6.
- **Layout**: terminal is left-anchored and takes the residual width; the gauge is
  right-anchored, fixed-width, and **shown only at card width ≥330px**
  (`atom-rebuild.md:248`, an already-settled breakpoint — carry forward, don't re-derive).

### Colour

- **Terminal text**: `color-mix(in oklab, var(--accent) 52%, #16202C)` for the
  dimmed idle "▾ more below" state (`atom-rebuild.md:239`), full `--accent` with
  `text-shadow: 0 0 7px currentColor` for live/urgent terminal states — carried
  forward from the existing spec unchanged; this is prose/readout content, so cyan
  does **not** apply here despite #197's readout=cyan default — #197 itself is scoped
  to *"boards, drawer, footer rail"* as cyan, so re-check this against #197 directly:
  **the footer rail is named IN #197 as a cyan readout**, which conflicts with
  `atom-rebuild.md:239`'s accent-dimmed spec. This conflict predates the Halo pass and
  is not something to resolve unilaterally here — see **Needs Jac** #7.
- **Gauge ticks**: steel base fill (glisten-on-hover per #211, not a lit colour at
  rest) — reuse Slots' `.b::before` specular gloss cap (slots.css:119-124) on a neutral
  steel gradient instead of `.b.r`/`.b.y`'s red/yellow fills. **Occupied-eighth tint**:
  each tick that falls in the scroll range a group occupies tints toward that group's
  `--row-hue` (canon-colour-map.css:59-71's laser system — *"the laser follows the
  signal, the body never does,"* ledger #217) via the same `color-mix(in oklch,
  var(--row-hue) …%, var(--txt))` formula the row-level laser already uses, so one hue
  formula serves both surfaces rather than a second one being invented for the footer.
- **Gauge well**: `.oct4` body/glass through `steel-skin.css`, same colourway
  inheritance as §1/§2.

### Type

- Terminal: **mono 10px / 800 / .09em uppercase**, `atom-rebuild.md:240` — unchanged,
  not subject to #154's rejection (scoped to seg cells only, see §1/§2).
- Gauge: no text — ticks are the only content; a group name only appears via the
  terminal on hover (`atom-rebuild.md:250-251`), never printed on the gauge itself.

---

## Needs Jac

These are the points this pass could **not** settle without guessing, and are flagged
rather than decided:

1. **The scale mismatch between the Halo kit's mockup-px geometry and the card's real
   24px control height.** Housing (1287×254), Deck (1268×116), and Chip
   (60.5–71px-tall plates) are all dimensioned for the 1292×635 showpiece canvas, not a
   ~380px-wide Tier-01 card (ledger #196/#210). Two ways to shrink them to chrome scale:
   - **(A) Author new, smaller variant classes** on the existing part sheets, using the
     SAME gradient-stop *ratios* scaled down (what this spec's geometry numbers above
     assume) — faithful to the "machined steel" read, but costs a fresh pixel-gate pass
     per the kit's own doctrine (every existing gate is proven only at its shipped size —
     README.md's "the stage width changes the pixels" section shows even a *same-size*
     re-host can shift sub-pixel rendering).
   - **(B) Wrap the full-size parts in `transform:scale()`.** Cheap, but the kit's own
     measurement (ANATOMY.md:633-659) shows a box-sized/rescaled render does **not**
     rasterise identically to a native-size one — a scaled chip would likely read
     visibly softer/different than a natively-small one, even though shipped UI doesn't
     require passing `check.py`.
   Which approach — and whether it's worth a formal pixel-gate pass for chrome at all,
   given chrome isn't the byte-faithful-to-a-mockup exercise the ten body parts were —
   is Jac's call.

2. **No existing Halo part models a two-state (OFF/ON) toggle cell with a press-inset.**
   `chip.css` is a static, always-lit readout with a fixed ring — it has no OFF state,
   no press animation, and its `.bloom`/`.cap` decorations (chip.css:197-211, 258-265)
   don't belong on a control at all. Should the tab-bar cell be built as a new
   `.halo-chip.is-key` variant (dropping bloom/cap, adding on/off + press), or does it
   deserve its own numbered part (the kit's own numbering skips c6–c8; the next free
   slot is c14, after c13 `marks`)?

3. **No existing Halo part owns a live text-input.** Screen's glass/scanline recipe is
   the nearest kin but has no typed-content slot, no caret, no placeholder state. Same
   question as #2: a `.halo-screen.is-well` variant, or a new part?

4. **Slots (c2) has only two status fills** (`.b.r` red / `.b.y` yellow — slots.css:102-117).
   The footer gauge needs a neutral steel fill plus a per-tick `--row-hue` tint. Confirm
   this is an in-place extension of Slots (`.b.steel` + a `--tick-hue` custom property)
   rather than a fork, since the two uses (row-level state distribution vs.
   footer-level scroll gauge) are visually similar but semantically different reads.

5. **Colourway inheritance.** Ledger #228 assigns one of four steel colourways (Deep
   Blued/Slate/Charcoal/Gunmetal) per *card* (Customers/Rentals/Units/Assembly). Chrome
   is card-level furniture shared by every row inside — confirm it inherits its host
   card's colourway (the geometry above assumes yes, via `steel-skin.css`'s
   `--steel-h/-s/-tint`) rather than staying on one fixed neutral colourway everywhere.

6. **Two genuinely unspecified numbers**, flagged inline above and repeated here:
   the **gap between the title-pair and filter-trio segmented groups** on the header
   bar (proposed 8px, unconfirmed), and the **gap between the 8 gauge ticks** in the
   footer (no source specifies one). Neither Halo nor the flat-language kit fixes
   either value.

7. **A real conflict between two already-locked rows, surfaced by this pass, not
   created by it.** Ledger #197 names *"the footer rail"* as a **cyan** readout
   surface (*"display text on glass (boards, drawer, footer rail) reads cyan"*), while
   `atom-rebuild.md:239`'s existing, already-shipped footer-terminal spec uses
   **accent-dimmed** text
   (`color-mix(in oklab, var(--accent) 52%, #16202C)`), not cyan. This predates the
   Halo translation — it is not introduced by reusing Halo parts — but building the
   Halo version of the footer terminal will force a pick between the two. Flagging
   rather than silently choosing one.
