# Chrome Spec — the V2 card's chrome, as a MERGE

## Premise (read this before anything below)

**Halo was a skin on Tier-01, not a second design system.** Whatever was worth keeping
about Halo's look is *already inside* default Tier-01 — Jac: *"I see you mentioning
'Halo' a lot. Halo was a skin on Tier-01. Don't follow that because what I liked about
that skin I've already implimented on the default Tier-01."* The Halo kit
(`docs/design/halo-elements/parts/*.css`) covers exactly **ten body-furniture parts** —
c1 status chip, c2 segment bars, c3 conduit elbow, c4 panel frame, c5 display plate, c9
circuit field, c10 banner top row, c11 L bracket, c12 marks, c13 banner shell
(README.md's own part list) — and **nothing else**. It never modelled a header tab bar,
a search bar, or a footer. **There is no c14 or c15 to invent, and this spec does not
invent them.** That was the previous version's mistake and it is retracted, not patched.

**How V2 gets assembled, in Jac's own words:** *"What we've built in Figma wins. But
everything else in default Tier-01 needs importing. Then merge them."* Ledger **#240**
already rules this exact shape: *"V2 keeps Tier-01's skeleton (header tab bar, search
bar, grouped rows, footer) and swaps the body elements for Halo components (deck/main
item, conduit rail + elbows, subitem housing, name, hexicon, message board)."* Two
sources, two jobs:

| Side | Source | Scope | Status |
|---|---|---|---|
| **Body** | The Figma build | deck/main item, conduit rail + elbows, subitem housing, name, hexicon, message board, bulb | **Built. Stays as built — Figma wins here.** |
| **Chrome** | Default Tier-01 (`docs/design/tier-01-card/index.html`) | header tab bar, search bar, footer (terminal rail + scroll gauge), and anything else the card needs that Halo never touched | **Imported, not re-authored.** |

So this document's only job is to describe **the seam** — what gets pulled in verbatim
from Tier-01, what stays from the Figma body, and the handful of numbers that have to
change (only) at the point where the two meet: scale, margins, colourway, type. It is a
spec, not code — every number below is a starting point for a pixel-gate/visual-diff
pass once V2 is actually assembled, not a literal CSS drop-in.

**What's salvaged from the previous (rejected) draft.** The old draft's *architecture* —
building the tab bar out of `chip.css`, the search well out of `screen.css`, the footer
out of `screen.css` + `slots.css` — is discarded wholesale; none of that reuse is needed
because the real chrome markup and CSS already exist, in Tier-01, and just need
importing. Three things it got right survive into this rewrite:
1. The **scale-mismatch observation** (Halo's parts are dimensioned for a 1292×635
   mockup canvas; a card is ~380–1500px) — restated below in §4, because it still
   applies at the *body*-to-*chrome* seam even though nothing needs re-deriving from
   Halo ratios anymore.
2. The **two genuinely unspecified numbers** it flagged (see #240's own supporting
   measurement in §4) are gone as open questions — real Tier-01 chrome already has
   concrete values for everything the old draft was guessing at (see §1–§3) — so this
   category is now empty, noted for the record.
3. The **footer-text-colour conflict** it surfaced (#197 cyan vs. the shipped
   accent-dimmed idle string) was real and is **resolved below, not re-opened** — see
   §3.

---

## 1 · Header tab bar

**Import verbatim from Tier-01.** Source: `docs/design/tier-01-card/index.html:1010-1046`
— the title-pair segmented group (`UNITS | CATEGORIES`, `.seg[data-pair="1"]`) and the
filter trio (`WORK | OPEN | DONE`, plain `.seg`), both built on the card's own `.seg` /
`.seg__opt` classes (defined at `index.html:602-610`, restyled by the P1/M1 passes
further down the same file). This is not a Halo recipe standing in for a tab bar — it
**is** the tab bar, already built, already shipped in the reference card.

**What ports as-is:**
- Control height: **`--h: 24px`** (`index.html:78`) — the same 24px control law the rest
  of the system uses (ledger #143: *"the 24px control law is HELD, not broken"*).
- Cell material/finish: `.seg__opt` steel-well recipe — `#050A10` face,
  `background-image: repeating-linear-gradient(...)` scanline film, machined ring via
  `box-shadow` stack (`index.html:884-889`), radius-0 + chamfer identity (ledger #140).
- Selected-cell tell: `[class*="seg__opt--on"]` gets an inset gradient + lit ring
  (`index.html:884`); off-state keeps the scanline/steel well.
- Type: **mono, 11px, 0.05em tracking, weight per `.seg__opt` base** (`index.html:935`
  is the live, final override — `font-size:11px !important; letter-spacing:.05em
  !important`), matching ledger #154's held 11px/.05em rule. The previous draft's guess
  at "8.7% chamfer ratio" etc. is unnecessary — the real chamfer geometry already ships
  in `index.html`'s clip-paths for the surrounding `.seg` containers.

**What changes at the seam:**
- **Colourway inheritance.** Tier-01's header steel currently reads off `--card-head`
  directly. In V2 it reads off the *host card's* colourway via `steel-skin.css`'s
  `--steel-h/-s/-tint` (see §5 — this is a locked ruling, not new work invented here).
- **Scale**, if the header sits inside a body built at Figma's 1500px-wide V2 canvas
  (ledger #240) rather than Tier-01's native 380px card — see §4.

**Not needed:** any Halo chip/plate mechanics. The previous draft's `.halo-chip.is-key`
proposal (its own "Needs Jac" #2) is moot — Tier-01 already has a working two-state
toggle cell; there is nothing to build.

---

## 2 · Search bar

**Import verbatim from Tier-01.** Source: `index.html:1055-1067` — the filter/sort
opener button (`.field`, 24×24px, left-anchored) plus the search well (`data-glass`
wrapper, raw `<input>` inside, `index.html:1057`), exactly as `atom-rebuild.md:169-174`
already specced the flat-language version. Ledger #151 calls this out directly: *"the
search is a raw `<input>` inside a well div"* — nothing about it is a Halo `screen.css`
stand-in, it's a real control that already exists.

**What ports as-is:**
- Height 24px, same control law as §1.
- Well finish: `#050A10` face + scanline film + machined ring, identical recipe to the
  tab cells (`index.html:1056`) — one steel/glass well construction reused across the
  header, not two different recipes.
- Caret: 6×12px block, `termblink` animation, `text-shadow: 0 0 7px currentColor`
  (`index.html:1063`) — unchanged, already correct.
- Layout: filter icon fixed 24×24px, left-anchored; well takes residual width
  (`index.html:1055-1056`) — the same edge-anchored/residual law #170 already locks for
  the row-level slot rack, already applied here in the source.
- Type: mono, 10px / 800 / .09em uppercase (`index.html:1057`) — matches
  `atom-rebuild.md:171-173`'s spec, confirmed live in the shipped card.

**Colour — already correct, cite don't re-derive:**
- Caret + typed text + placeholder: **`--accent` orange** (`index.html:1057`,
  `color:var(--accent)`), matching ledger #197's control-on-glass rule exactly. The
  well's hairline/frame stays on the neutral steel-well recipe, same as every other well
  on the card.

**What changes at the seam:** colourway inheritance (§5) and scale (§4) — same two knobs
as the header, nothing else.

---

## 3 · Footer

**Import verbatim from Tier-01.** Source: `index.html:1196-1223` — the terminal rail
(`index.html:1201-1210`, glass well + scrolling/looping text, described in full at
`atom-rebuild.md:233-241`) and the scroll gauge / grip rack (`index.html:1213-1222`, 8
skewed ticks in a chamfered well, `atom-rebuild.md:245-252`). Both are shipped,
functioning elements — not a `screen.css` + `slots.css` recreation.

**What ports as-is:**
- Terminal strip height **17px** (`atom-rebuild.md:235`), `#050A10` glass, scanline film,
  chamfered groove seat.
- Gauge ticks **8.5×15px**, `skewX(-19deg)`, 8 slots, shown at card width ≥330px
  (`atom-rebuild.md:245-248`, confirmed live at `index.html:1213/1958`).
- Ticks are steel per ledger #211's restamp (*"`.rw-tick`… → steel, ticks now glisten on
  hover like other steel"*) sitting inside a glass well — the well is glass, the ticks
  are steel, matching the row-level slot rack's own split.
- Type: mono 10px/800/.09em uppercase, `text-shadow: 0 0 7px currentColor` on lit states.

**Colour — RULED, not open:**

The previous draft correctly caught a real conflict and is right to have flagged it —
but the ruling now exists, so it is recorded here, not re-litigated. Ledger **#197**:
*"GLASS GETS TWO COLOURS: READOUTS CYAN, CONTROLS ORANGE… display text on glass (boards,
drawer, **footer rail**) reads cyan `#8fd8ff`-family."* The footer rail is *named
explicitly* in #197 as a cyan readout. The shipped value the old draft was citing —
`atom-rebuild.md:239`'s dimmed-idle string,
`color-mix(in oklab, var(--accent) 52%, #16202C)` — predates #197 and loses to it.

**Action for V2 (and worth back-porting to `atom-rebuild.md:239` / `index.html`'s live
`railHue`/terminal-text logic when that work is scheduled):** the footer terminal's idle
"▾ more below" colour moves from the accent-dimmed mix to a cyan value at equivalent
dimming, e.g. `color-mix(in oklab, #8fd8ff 52%, #16202C)`, or simply the existing dimmed
cyan already used elsewhere on lit rows (`index.html`'s `[data-row][data-lit="1"] .rw-board
span{color:#8fd8ff}` is the live precedent for the exact hex to reuse). Full-brightness /
urgent terminal states keep whatever glow treatment they already have, recoloured
cyan-family to match. This is a **value swap on an existing rule**, not new geometry —
#197 stands, the shipped value moves to match it.

**What changes at the seam:** colourway inheritance (§5) and scale (§4).

---

## 4 · Scale — the one real seam-geometry question

Tier-01's native card is 380×540 (its own `liveWidth` default,
`index.html:1238`). Its own Figma render is 2× (760×1080). Ledger **#240** already did
the load-bearing measurement for the V2 merge: scaling that render **~1.97×** puts
Tier-01's row pitch at ~154px against the Halo subitem's shipped height of ~151px — the
two row rhythms **already align** without distorting either side. That is why V2 is
being built at **1500px wide** (Figma node `438:274`, page `V2 — Assembly x Tier-01`) —
not a fresh scale decision this spec is making, a measurement #240 already settled.

**Ruling carried over from the previous draft, now settled, not proposed:** the chrome
is NOT reused via `transform: scale()`. New, smaller (or in this case, larger — Tier-01
chrome is native at 380px-card scale, and V2's body is ~1.97× that) **variant classes**
get authored, using the SAME gradient-stop *ratios* as the 380px-native Tier-01 chrome,
scaled to the ~1.97× factor #240 measured. This preserves the "machined steel" read at
native resolution instead of risking the soft/blurred look a CSS-transform scale
produces (the same rasterisation risk the Halo kit's own `ANATOMY.md` documents for its
ten parts). Concretely: every px value cited in §1–§3 above (24px control height, 11px
tab type, 17px terminal strip, 8.5×15px gauge ticks, etc.) is the **380px-native**
figure; the V2 variant multiplies geometry by ~1.97×, re-measures, and re-gates rather
than transform-scaling the DOM.

**Margins.** Where the chrome's own edge padding meets the Figma body's edge padding
(header strip to deck top, footer strip to last subitem, left/right card frame gutters),
use whichever of the two sides' existing values is *larger*, so the chrome's machined
frame reads as one continuous chassis around the Figma body rather than either side's
furniture visually colliding with the other's. This is a starting rule, not a measured
number — confirm against the actual 1500px assembly once header/footer are dropped in,
flag any visible seam as a build-time fix, not a design question.

---

## 5 · Colour — RULED

**Chrome inherits its host card's colourway.** Tier-01's chrome (header steel, well
faces, footer chassis) currently reads a single fixed neutral off `--card-head`. In V2,
every chrome surface reads through `steel-skin.css`'s `--steel-h` / `--steel-s` /
`--steel-tint` custom properties (`docs/design/halo-elements/steel-skin.css:27-56`) —
the same mechanism the Figma body already uses — so the header/search/footer steel
automatically matches whichever of the four Figma colourways (below) the card is
wearing. Never a separately hand-picked grey.

**The four Figma colourways stay exactly as built — this spec does not touch their
appearance.** Ledger #228: Gunmetal (Assembly/default), Deep Blued (Customers), Slate
(Rentals), Charcoal (Units). Which card gets which is settled by #228 with one open leg
(#241: the Gunmetal↔Assembly pairing is Jac's own placeholder wording, not a real
open decision about the *look*).

**Accent budget, readout-vs-control split — already ruled, carried forward unchanged:**
- Steel stays on the single `--accent` (#ff7e1f) law — the tab bar's selected-cell ring
  and any steel-family "user agency" tell (ledger #137).
- Glass splits by role per #197: **controls on glass read accent orange** (search
  caret/typed text — already correct in Tier-01, see §2), **readouts on glass read
  cyan** (boards, drawer, **footer rail** — corrected in §3 above).

---

## Needs Jac

Genuinely unresolved items only — the four rulings above (footer cyan, scale-via-
variant-classes, colourway inheritance, the four colourways staying as-is) are **settled
and not relisted here.**

1. **Chrome variant-class scale factor, final number.** §4 uses #240's ~1.97× body
   measurement as the working assumption for chrome too. Confirm the header/search/
   footer read correctly at that factor once actually dropped into the 1500px V2
   assembly — it may want a slightly different multiplier than the body's, since chrome
   carries finer detail (11px type, 1px hairlines) that degrades faster under scaling
   than the body's larger steel panels.
2. **Where exactly chrome margins meet body margins** (header-to-deck, footer-to-last-
   subitem, left/right frame gutters) — §4 proposes "use the larger of the two," but
   this is a placeholder rule pending the actual assembly, not a measured value.
3. **Whether the footer-terminal cyan fix (§3) ships to production `atom-rebuild.md` /
   `index.html` now, alongside V2, or waits** — the value swap is small and low-risk,
   but it's a change to an already-shipped surface outside this spec's own V2 scope, so
   scheduling it is Jac's call, not assumed here.
