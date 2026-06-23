---
name: Rental Wrangler — JacRentals Yard Data-Plate
version: alpha
description: >
  The design system for Rental Wrangler — a dense, dark, industrial heavy-equipment
  rental operations app for JacRentals (Sulphur, LA). A steel data-plate bolted to a
  machine in the yard: quiet steel surfaces, ONE safety-orange ignition accent, a hi-vis
  hazard-stripe signature, stamped Saira Condensed labels, corner rivets, and a light
  wrangler/ranch seasoning carried mostly in copy. This file is the portable, machine-
  readable projection of style.css :root + the app's RULE_META (R0–R24); jactec-ui is the
  enforcement layer that builds and polices it. Tokens below are the DARK default; the
  light / yard / ranch themes override the SAME names (see style.css).
colors:
  # — Accent: ONE orange, three meanings (selected tab · ignition action · linked record)
  primary: "#ff7a1a"
  on-primary: "#1a1205"          # dark ink on orange — ALWAYS, never white
  accent-soft: "rgba(255,122,26,0.14)"
  accent-line: "rgba(255,122,26,0.5)"
  # — Surfaces: near-black → steel, within ~12% lightness of each other
  bg: "#0b0c0f"
  bg-2: "#101216"
  panel: "#15171c"
  panel-2: "#1b1e24"
  card: "#14161b"
  card-head: "#191c22"
  anchor: "#23272e"              # anchored-card section surface
  # — Lines (delineate with borders, not big fills)
  line: "#262a31"
  line-soft: "#1f232a"
  # — Text: near-white → faint; reserve max contrast for orange + data values
  text: "#e9edf4"
  text-2: "#a7afbc"
  text-3: "#6b7480"
  track: "#22262e"
  # — Status registry: each hue means ONE thing everywhere
  ready: "#34d399"               # green  — ready / active
  caution: "#f5c542"             # yellow — caution
  danger: "#ff4242"              # red    — danger / overdue / failed
  link: "#5b9dff"               # blue   — link / commit action
  scheduled: "#b07cf5"           # purple — scheduled
  navy: "#6f8bdb"
  pink: "#f06fb0"
  brown: "#c79366"
  gray: "#8b94a3"                # plain fact
  add-blue: "#18b6ff"            # R5b add ink + the anchored "you are here" ring
  # — Ranch seasoning (yard theme): tiny touches + saddle-stitch only
  tan: "#c2925a"
  tan-deep: "#8a5a2b"
typography:
  # — Voice 1: STAMPED (Saira Condensed, uppercase) — labels, tabs, headers, buttons
  wordmark: { fontFamily: "Saira Condensed", fontSize: 18px, fontWeight: 800, letterSpacing: "2px" }
  label:    { fontFamily: "Saira Condensed", fontSize: 11px, fontWeight: 700, letterSpacing: "1.4px" }
  ignition: { fontFamily: "Saira Condensed", fontSize: 13px, fontWeight: 800, letterSpacing: "1px" }
  # — Voice 2: READ (Geist) — everything you read; record names are Geist bold, not caps
  value: { fontFamily: "Geist", fontSize: 28px, fontWeight: 700, lineHeight: 1.1 }
  title: { fontFamily: "Geist", fontSize: 15px, fontWeight: 700 }
  body:  { fontFamily: "Geist", fontSize: 13px, fontWeight: 400, lineHeight: 1.4 }
  field: { fontFamily: "Geist", fontSize: 12px, fontWeight: 400 }
  fine:  { fontFamily: "Geist", fontSize: 10px, fontWeight: 400 }
  # — Voice 3: CODE (mono) — Inspector tag + builder names only
  mono:  { fontFamily: "ui-monospace", fontSize: 11px, fontWeight: 400 }
rounded:
  control: 8px                   # buttons, fields, tabs
  chip: 12px                     # --chip-radius
  card: 16px                     # --radius
  pill: 999px
spacing:
  list: 7px                      # list gap
  row: 10px                      # row pad (9–11)
  section: 12px                  # section pad + grid gap
  card: 16px
components:
  # Each maps to a §5 builder in app.js stamped data-r="Rxx". Borders/dashes/gradients
  # that aren't color/type/radius tokens are described in the Components body section.
  card:            { backgroundColor: "{colors.card}", textColor: "{colors.text}", rounded: "{rounded.card}" }                                            # surface
  title-card:      { backgroundColor: "{colors.card}", textColor: "{colors.text}", typography: "{typography.title}", rounded: "{rounded.chip}" }           # R10
  tab-selected:    { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.label}", rounded: "{rounded.control}" } # R1 selected
  tab-armed:       { backgroundColor: "{colors.panel}", textColor: "{colors.primary}", typography: "{typography.label}", rounded: "{rounded.control}" }     # armed = orange OUTLINE
  gate-pill:       { backgroundColor: "{colors.panel-2}", textColor: "{colors.text}", typography: "{typography.label}", rounded: "{rounded.pill}" }        # R1 status dropdown
  ref-pill:        { backgroundColor: "{colors.card}", textColor: "{colors.primary}", typography: "{typography.label}", rounded: "{rounded.pill}" }        # R2 linked record
  status-ready:    { backgroundColor: "{colors.panel-2}", textColor: "{colors.ready}", typography: "{typography.label}", rounded: "{rounded.pill}" }       # R3
  status-caution:  { backgroundColor: "{colors.panel-2}", textColor: "{colors.caution}", typography: "{typography.label}", rounded: "{rounded.pill}" }     # R3
  status-danger:   { backgroundColor: "{colors.panel-2}", textColor: "{colors.danger}", typography: "{typography.label}", rounded: "{rounded.pill}" }      # R3
  data-chip:       { backgroundColor: "{colors.panel-2}", textColor: "{colors.text-3}", typography: "{typography.label}", rounded: "{rounded.pill}" }      # R3b plain fact
  add-link:        { backgroundColor: "{colors.card}", textColor: "{colors.add-blue}", typography: "{typography.label}", rounded: "{rounded.control}" }    # R5b blue dashed
  add-field:       { backgroundColor: "{colors.card}", textColor: "{colors.text-3}", typography: "{typography.label}", rounded: "{rounded.control}" }      # R5c gray dashed
  req-field:       { backgroundColor: "{colors.text}", textColor: "{colors.on-primary}", typography: "{typography.label}", rounded: "{rounded.control}" }   # R6 near-white until entered
  ignition:        { backgroundColor: "{colors.primary}", textColor: "{colors.on-primary}", typography: "{typography.ignition}", rounded: "{rounded.control}", padding: 13px } # R17 primary
  action-commit:   { backgroundColor: "{colors.link}", textColor: "{colors.bg}", typography: "{typography.label}", rounded: "{rounded.control}" }          # R17 commit
  action-money:    { backgroundColor: "{colors.ready}", textColor: "{colors.bg}", typography: "{typography.label}", rounded: "{rounded.control}" }         # R17 money
  action-danger:   { backgroundColor: "{colors.danger}", textColor: "{colors.text}", typography: "{typography.label}", rounded: "{rounded.control}" }      # R17 danger
  ghost:           { backgroundColor: "{colors.card}", textColor: "{colors.text-2}", typography: "{typography.label}", rounded: "{rounded.control}" }       # R18 quiet action
  link-name:       { backgroundColor: "{colors.card}", textColor: "{colors.link}", typography: "{typography.body}" }                                       # R7 hyperlink
  close-x:         { backgroundColor: "{colors.danger}", textColor: "{colors.text}", rounded: "{rounded.pill}" }                                           # R24 red circle
---

## Overview

Rental Wrangler is a **dense, dark, industrial equipment-rental operations app — not a
marketing site.** Every screen reads like a steel **data-plate** bolted to a machine in
the yard: quiet steel surfaces, one safety-orange ignition accent, the hi-vis hazard
stripe as the signature, stamped condensed labels, a light wrangler twist in the copy.

The system is already encoded in the codebase — this file is its **portable projection**,
not a second canon. Tokens here mirror `style.css :root`; the component catalog mirrors
the app's `RULE_META` (R0–R24). **Extend the system, never invent a parallel one.** When
in doubt, match what's there and speak in rule numbers.

## Colors

**One orange, one meaning.** `primary #ff7a1a` (ink `on-primary #1a1205`) is reserved for
exactly three things: the **selected tab**, the **ignition/primary action**, and
**linked-record** affordances. Never decorative, never a second status color, never a
hero gradient. Selected = solid orange + dark ink; armed = orange **outline**, not fill.
Orange surfaces always carry dark ink, never white.

**Surfaces stay near-black, never pure.** `bg #0b0c0f` → `panel #15171c` → `card #14161b`
sit within ~12% lightness of each other; delineate with `line #262a31` borders that
contrast both surfaces, not big fills. Never `#000` or `#fff` — reserve maximum contrast
for orange and data values.

**Status registry is fixed and one-meaning-everywhere:** `ready` (green) · `caution`
(yellow) · `danger` (red) · `link` (blue) · `scheduled` (purple) · `gray` (plain fact).
**Action intent is a SEPARATE axis:** commit = `link` blue · money = `ready` green ·
destructive-confirm = `danger` red. Never blend the two or repurpose a hue.

## Typography

**Two voices, strictly separated.** `Saira Condensed` (UPPERCASE, 1.4–2px tracking,
weight 600–800) is the **stamped** voice — wordmarks, column/section tabs, KPI/micro
labels, section headers, ignition buttons ONLY. `Geist` is **read** — everything you read;
record names are Geist bold, not caps. `ui-monospace` is only the Inspector tag + builder
names. Body in the condensed face reads shouty; a stamped label in a neutral sans reads
generic. Type scale (px): **28** value · **15** title · **13** body · **12** field · **11**
stamped micro-label & every status badge · **10** fine. Under `ranch` the stamped voice
swaps to `Zilla Slab` via the theme block.

## Layout

The yard grid is a **fixed 3-equal-column** frame (Units / Rentals / Customers), `section`
12px gap, with a desktop floor. Below the floor the page **pans** horizontally — it never
squishes the columns, and the body never scrolls vertically. CSS Grid + container queries
(`@container`) for anything that adapts; never a 12-col bootstrap clone. **One math spacing
scale:** `list 7` · `row 9–11` · `section 12` · grid 12; radii from `control 8` → `chip 12`
→ `card 16` → `pill 999`. **Outer padding ≥ inner; nested radius = outer − gap.** No
one-off 13px/7px values. Recognition over recall: repeat the exact treatment for related
items rather than improvising a variant.

## Elevation & Depth

**Depth by lightness, not shadow, on dark — closer = lighter.** Use only the two defined
elevations (`--shadow` floats cards/popups; `--chip-shadow` lifts chips/rows) plus two
rings: the orange halo on menus/pop-ups and the `add-blue #18b6ff` neon ring for an
anchored "you are here" record. **No new drop shadows on dark cards;** never mix
shadow/border/flat across sibling panels.

## Shapes

Radii ladder: `control 8` · `chip 12` · `card 16` · `pill 999`. Pills are fully round;
cards and chips carry the soft radius; controls the tight one. Nest radii properly (inner
= outer − gap). Optical-align glyphs whose visual center ≠ geometric center (chevrons, ▸).

## Components

Every lint-family element is emitted by ONE `§5` builder stamped `data-r="Rxx"`. Match
intent → rule → builder; **extend the builder, never hand-roll markup.** The full catalog:

| R | Element | Builder | Law |
|---|---|---|---|
| **R0** | Flash-lint | `body.rw-lint` CSS | Any un-stamped pill/add/flag/link/req/seg/file-drop/datefield (or native `title`) pulses red. **Build target = ZERO.** |
| **R1** | Gate pill | `gatePill` family | Status DROPDOWN that advances a record — big shape + chevron. The only "pressable status." |
| **R2** | Linked pill | `refPill` / `unitPill` | Opens another record. Orange outline + destination-card icon; optional ✕ to unlink. |
| **R3** | Status badge | `statusPill` | Informational status only: registry color + parent-card icon. NEVER an action. |
| **R3b** | Data chip | `badge` | Plain fact (`480 HRS`): gray, no icon, no hover. |
| **R4 / R4b** | Derived pill | `dPill` / `dPill({alert})` | Rides its parent: ink+icon only, right of parent; `alert` pulses. |
| **R5b / R5c** | Add | `addBtn({link})` / `addBtn()` | Blue dashed `+Thing` (links/creates) · gray dashed `+Thing` (empty field). |
| **R6** | Required | `reqBtn` | Near-white bg + dark ink until entered — stays loud. |
| **R7** | Hyperlink | `linkName` | Blue · italic · NOT bold · permanent underline. |
| **R8** | Derived value | `kv({derived})` | Italic = the app computed it. |
| **R9 / R9b** | Title flags | `flagEl` | ≤2 stacked 14px mini-flags, no backgrounds; `alert` pulses. |
| **R10** | S1 title chip | `cardEl` | Dark chip · white bold label · plain orange icon · permanent orange border. |
| **R11** | Section | `.section` | Centered header; header + border follow live status. |
| **R12** | Notes line | `notesSection` | Boxless; filled → top, empty → bottom. |
| **R13** | History | `historySection` | Count chips above an inline filter; record-backed links. |
| **R14** | Seg toggle | `segCtl` | 3-state segmented control. |
| **R15** | Journey | `yardToolHtml` | Yard +Start/+FC/+End + transport; per-unit. |
| **R16** | Day timeline | rentals `timeline` | Rental window in day cells; cells tint by status. |
| **R17** | Action pill | `actionPill` | commit = blue · money = green · danger = red; `.locked` = gated. |
| **R18** | Ghost | `ghostPill` | The ONE quiet action — Cancel / Close / Exit / Clear. |
| **R19** | Attention flash | `attnFlash` | A glow that points AT the on-screen fix instead of an error message. |
| **R20** | Wrangler menu | `openCtxMenu` | Right-click / long-press a real control. Never on bare rows. |
| **R21** | File drop | `fileDrop` | The massive popup add-file zone — R5b blue dashed at full size. |
| **R22** | Date picker | `dateField` | The ONE app-styled calendar. Native pickers are banned. |
| **R23** | Tooltip | `data-tip` | Every hover hint; a native `title=` is an R0 violation. |
| **R24** | Close ✕ | `closeX` | Red circle · white ✕. |

The `components` tokens above carry each element's color/type/radius; borders, dashes, and
gradients (the orange ref-pill outline, blue/gray add dashes, the ignition gradient face)
live in the builders. If an element genuinely has no rule, that's a decision to make WITH
a new builder + `RULE_META` row + `data-r` stamp — never raw markup.

## Do's and Don'ts

**The three banned AI-default looks — we are none of them:** ① cream `#F4F1EA` + serif +
terracotta · ② near-black + one acid-green/vermilion accent · ③ broadsheet hairlines +
zero radius + dense columns.

- **Do** spend boldness in ONE place — the hi-vis hazard stripe as plate chrome — and keep
  everything around it quiet (simple-on-complex: never texture behind text).
- **Do** keep every lint-family element `data-r`-stamped from a `§5` builder (the #1 tell
  it bypassed the system is a missing stamp — R0 pulses it red).
- **Do** lean the ranch flavor into copy first (Wrangle · Round up · Corral · Brand ·
  Saddle up · Rein in), visuals second (a worn-tan touch, a rare brand/star mark).
- **Do** write measurable specs — name hex/px/token values, never vague adjectives
  ("modern, clean, premium, slightly rounded"); document every interactive state.
- **Don't** add a second accent, decorative orange, a hero gradient, or `#000`/`#fff`.
- **Don't** drop a dead `#888` gray, a new drop shadow on a dark card, or mixed elevation
  across siblings.
- **Don't** set body in Saira Condensed or a label in a system sans (Inter/Roboto/Arial/
  system-ui/Space Grotesk are banned for labels).
- **Don't** use a native `title=`, native date picker, or `alert()` → R23 / R22 / R19.
- **Don't** ship `transition: all .2s`, bouncy easing, scattered micro-interactions, or
  ornamental `01·02·03` markers that don't encode a real sequence.
- **Don't** let the ranch read western before industrial — seasoning, not the meal.

## Signature & Motion

The one bold motif is the **hi-vis hazard stripe** —
`repeating-linear-gradient(135deg, var(--yellow) 0 13px, #14181d 13px 26px)` (red variant
for danger/abort). Apply it as plate **chrome** (card cap, login band, drop zones, the R4b
hazard cap), never behind reading content. Supporting devices: corner **rivets**, recessed
detent wells, stamped labels, the ignition button (gradient face, dark ink). Saddle-stitch
dashed `tan` lines are the occasional ranch divider.

**Motion is fast + functional, one orchestrated moment.** Durations: **.12s** controls ·
**.15s** surfaces · **.5s** rings/timeline. Named keyframes only — `attnGlow` (the R19
flash that REPLACES an error by glowing the on-screen fix) · `plateIn` · `flagPulse` ·
`rwLint`. **Forbidden:** generic `transition: all .2s ease`, bouncy/overshoot easing,
scattered ambient micro-interactions.

## Accessibility

A gate, not a nicety. **WCAG AA in dark AND light AND yard/ranch** — ≥4.5:1 text, ≥3:1
large/UI. Status colors darken in the light theme so pill TEXT reads on the soft `-bg`
fills; the registry/danger hues that sit at the AA edge as bright text on dark are always
paired with a **label + parent-card icon** (never color alone) and meet AA on their soft
fills and in light. Every interactive element carries a visible `:focus-visible`
(`outline: 2px solid var(--accent); outline-offset: 2px`). Every animation degrades to a
steady, still-meaningful state under `prefers-reduced-motion`. Critical info is never
hover-only — long-press (R20) + tap reach it too.

## Themes & how this file stays true

Frontmatter tokens are the **dark default** (`:root`). `[data-theme="light"]`,
`[data-theme="yard"]`, and `[data-theme="ranch"]` override the **same token names**, so a
treatment expressed in tokens themes itself for free — mirror every new treatment across
themes and confirm parity. Yard adds steel-gradient + rivet + tan helpers.

**Anti-drift:** this file is a *projection* of `style.css :root` + `RULE_META`, meant to be
generated and drift-checked from them (the way `ci/gen-rule-usage.mjs` guards the rulebook)
— not hand-maintained as a second canon. `jactec-ui` remains the enforcement layer (the
`§5` builders, the R0 flash-lint, the CI gates) and points at this file as the token +
rationale source.
