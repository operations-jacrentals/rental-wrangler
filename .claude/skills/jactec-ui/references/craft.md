# craft.md — composition, the safe-rules layer, motion, ranch

Load for any NEW or RESHAPED section, screen, or popup (alongside `taste.md` and
`anti-slop.md`). This is the depth behind SKILL.md's laws: how to compose surfaces
that read as one shop.

## The objective safe-rules layer (apply unless you name a reason to override)

Anthony Hobday's near-always-safe visual rules, adapted for a dense dark ops UI:

- **Near-black, near-white, never pure.** `--bg #0b0c0f` / `--txt #e9edf4` already
  satisfy this — never introduce `#000` or `#fff`. Reserve max contrast for orange.
- **Saturate neutrals one temperature.** Keep new neutrals on the existing yard
  cast; never a dead `#888`, never warm + cool mixed.
- **High contrast only for what leads.** Lines, `--txt-3` micro-labels, and panel
  edges stay low-contrast; spend high contrast on data values, status, and orange.
  Avoid the even-grey soup and the low-contrast fad both.
- **Depth by lightness, not shadow, on dark.** Closer = lighter. Only the two
  defined elevations (`--shadow` floats cards/popups; `--chip-shadow` lifts
  chips/rows), the orange halo ring on menus/popups, and the `#18b6ff` anchored
  ring. No new drop shadows on dark cards; don't mix shadow/border/flat across
  sibling panels. Delineate with `--line` borders, not big fills.
- **One math spacing scale.** Grid 12 · list 7 · section pad 12 · row pad 9–11;
  radius `--radius 14–16` / `--chip-radius 11–12` / 8–10 controls / 999 pills. No
  one-off 13px/7px values. **Outer padding ≥ inner.**
- **Nest radii properly** (inner = outer − gap). **Dim icons** to the text weight
  beside them. **Collapse redundant dividers** — one divide per boundary.
  **Optical-align** glyphs whose visual center ≠ geometric (chevron, ▸).
- **The named deviation: density.** We deliberately override the 16px-body /
  ~70-char-line marketing rules — a dense yard grid runs the
  28/15/13/12/11/10/9.5px scale, 11px badges, narrow numeric columns. Enforce a
  minimum LEGIBLE size and split into more views rather than shrink past it;
  density must never become cramped.

## Accessibility & contrast (hard gate, verify — don't eyeball)

- AA (≥4.5:1 text, ≥3:1 large/UI) in dark **and** light **and** yard/ranch. Light
  theme darkens status colors so pill text reads on the soft `-bg` fills —
  preserve that when touching a status.
- Orange surfaces carry dark `--on-orange` ink, never `--txt`.
- Never meaning by color alone — color + label + parent-card icon, always.
- Visible `:focus-visible` on every interactive element
  (`outline: 2px solid var(--accent); outline-offset: 2px`).
- `prefers-reduced-motion`: every pulse/barber-pole freezes to a steady,
  still-meaningful state.
- Nothing that matters is hover-only; long-press (R20) + tap reach it too.

## Layout

- **The yard grid is fixed 3-equal-column** (Units / Rentals / Customers), 12px
  gap, desktop floor. Below the floor the page **pans** horizontally — it never
  squishes columns, and the body never scrolls vertically. Don't introduce a
  vertical-scroll page.
- **Modern layout only:** CSS Grid + container queries for anything that adapts —
  never a 12-col bootstrap clone. Section headers are centered Saira caps with
  flags pinned absolutely so the title stays true-center.
- **Recognition over recall.** Reuse established shapes; repeat the exact
  treatment for related items rather than improvising a variant. Consistency IS
  grouping.
- **Button order & flow.** Confirm/cancel keep the established order; the
  ignition/commit action gets the weight, the ghost (R18) stays quiet; heaviest
  toward the outer edge. Minimize clicks — a one-gate move never becomes a
  multi-step dialog.

## Signature devices — OPT-IN ONLY

The hazard stripe, rivets, detent wells, and plate texture are **structural
chrome** that already lives where it belongs (card caps, the login plate, drop
zones, the R4b cap). **Never add a signature device to new work unless Jac
explicitly asks for it.** They are not a fix for "looks plain" — inside data
surfaces, quiet is correct, and identity comes from the tokens, the type voices,
and the builders, which every element already wears. When Jac does ask, copy the
canonical recipes (`signature-recipes.md`) — don't reinvent.

## Motion

Fast + functional, ONE orchestrated moment. **.12s** controls · **.15s** surfaces
· **.5s** rings/timeline; crisp ease-out; the named keyframes only (`attnGlow`,
`plateIn`, `flagPulse`, `rwLint`). Forbidden: `transition: all .2s ease`,
bouncy/overshoot easing, scattered ambient micro-interactions — those read
consumer-marketing. The one beat worth spending: the attnGlow that REPLACES an
error by pointing at the fix.

## Ranch — a seasoning, never the meal

Carry it through VOICE/COPY in the wrangler register (Wrangle · Round up · Corral
· Brand · Saddle up · Rein in), used naturally, never campy. Visual cues stay
restrained: leather-tan (`--tan`) tiny touches, the saddle-stitch dashed divider,
a rare brand/star mark. **Litmus: if a glance reads "western" before "industrial
rental yard," dial it back.** Never wood/rope/saloon-serif as a skin.

## Copy is design material

Active voice; an action keeps its name through the whole flow ("Release to
cancel" → matching toast). Errors say what's wrong and how to fix it in the
interface's voice — never apologize, never vague. Empty states invite action.
Record names are Geist bold, not caps; stamped labels are Saira, short, and
factual.

## Build order: structure → tidy → responsive → polish → self-critique

1. **Structure** — right builders, right stamped elements, correct rules + data.
   Correct in rule language before styling.
2. **Tidy** — one spacing scale, align everything to something, nested radii,
   collapsed dividers, outer ≥ inner, weight ordering. A reason for every choice.
3. **Responsive** — grid pans (never squishes); container queries where a piece
   adapts; minimum-legible-size honored (split, don't shrink); touch reaches
   every action.
4. **Polish** — dim icons, optical-align glyphs, tune the one motion moment, wire
   halo/anchored rings, mirror into light (+ ranch).
5. **Self-critique screenshot** — the procedure in SKILL.md's options-first loop
   (serve on 9147, headless Chromium at 1440×900). Review against `taste.md` +
   `anti-slop.md`; remove one accessory; then the gates.
