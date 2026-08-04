# Next session — start here

Copy the block below as your opening message. Everything after it is reference.

---

## THE PROMPT

> Continue the Version2 build on branch `claude/design-system-phase-1-vcgald` (PR #798).
>
> **Version2 = the Halo assembly combined with the Tier-01 card.** I've already built the
> assembly half on a fresh Figma page; the remaining job is the Tier-01 half.
>
> Read `docs/design/halo-elements/NEXT-SESSION.md` first — it has the node IDs, the
> gotchas, and the open decisions. Then read `OPEN-QUESTIONS.md` in the same folder for
> the four things waiting on my ruling.
>
> Immediate task: duplicate the Tier-01 card structure onto the V2 page and replace its
> elements with the Halo components, per my 2026-08-04 instruction (which overrides the
> "NOT a build source" note sitting on that frame). Show me a render before you go deep.

---

## Where things stand

**Figma** — file `cc3TcK2F2a8qSbCAstzcA5` ("Rental Wrangler — Halo Elements Library")

| What | Where |
|---|---|
| **V2 page (built)** | page `V2 — Assembly x Tier-01`, frame `429:33` |
| ├ 01 · MAIN ITEM | deck + boards, FAILED board |
| ├ 02 · CONDUIT RAIL + ELBOWS | channel upper run + 3 elbows + subitem elbow instance |
| ├ 03 · SUBITEM 1 | housing · name · hexicon · message board |
| └ 04 · SUBITEM 2 | housing · name · hexicon · message board |
| **Tier-01 target** | page `Reference — tier-01` (`44:2`) → **`208:822`** is 133 FLAT, UNNAMED vector outlines (every child literally named "Vector"), covering only the card's top ~250px (tab bar + search bar). It is NOT the whole card and carries NO structure; individual letters are separate outlines. `42:2` is a flat image + annotation, also not structurally usable. The REAL structural source is the repo: `docs/design/tier-01-card/index.html`. |
| **V2 card (built)** | page `V2 — Assembly x Tier-01`, frame **`438:274`** "V2 · CARD — Tier-01 structure x Halo components", 1500x2140. Contains three cloned Halo assembly blocks (`438:275`, `438:326`, `438:377`) plus placeholder chrome frames for header tab bar, search bar, and footer (all named with "[PENDING Halo component]" suffix). |
| Jac's working assembly | `Frame 1` `418:7027` on page `MAIN+SUB ASSEMBLY` — he reorganised it himself; the V2 page is a **clone**, so his edits there do not propagate to it (component-level edits still do, via instances). |
| Bulb variants | COMPONENT_SET `158:2192`, five states, on another page |
| Colourway drafts | `354:2` gunmetal · `354:128` blued · `354:251` slate · `354:374` charcoal |

Layout on the V2 frame, verified by absolute coordinates: main `89,40`, subitem 1
`240,196`, subitem 2 `240,352` — left-aligned, 156px row pitch.

**Repo** — everything committed and pushed. CSS kit at `docs/design/halo-elements/`:
`conduit-channel.css` (13 measured strips), `conduit-cap.css`, `conduit-rail.css`,
`bulb.css` (texture + tint), `subitem-anim.css` (the three animation beats),
`steel-skin.css` (colourways, seating, wells, `--row-hue`).

**Not done in CSS:** `assembly/main-plus-subitem.html` still renders the OLD inline-SVG
conduit, which is why the elbow there looks pink. The swap to the new part sheets is the
first CSS job. The artifact `MAIN ITEM + SUBITEM — the full card`
(`77fc1ea2-87e4-44d5-9067-a61208739239`) has not been republished since.

## Gotchas learned the hard way — do not rediscover these

1. **The Figma GROUP bounds trap.** Appending a node to a GROUP changes the *group's own*
   origin, so any offset you computed a line earlier is already stale. An elbow drifted
   49,-9 this way. Always re-measure `absoluteTransform` in a loop until the delta is 0.
2. **A vector REGION fill beats its node fill.** Merged artwork stores paint per region;
   `node.fills` reports `figma.mixed`. Recolour via `setVectorNetworkAsync`. Also: a
   node carrying a SHADER fill alongside a solid will defeat a naive
   `JSON.stringify` equality check — two overrides hid from a bulk pass that way.
3. **Never `git add -A` a directory while a subagent is writing in it.** A half-finished
   `subitem-anim.css` got committed and it had a real bug in it.
4. **`@property` + a captured helper colour = circular dependency.** Animating toward a
   captured `--row-hue` silently collapsed every row to one colour, no console error.
5. **A published artifact runs under a CSP that blocks external requests**, and Chromium
   refuses `file://` textures in CSS as cross-origin. Inline assets as data URIs.
6. **`steel-skin.css` must be linked after `tokens.css`** or every treatment silently
   does nothing and the card just looks old.
7. Playwright 1.48 wants `chromium-1140`; the image ships `1194`, and 1194's chrome
   dropped `--headless=old`. Symlink `chromium-1140/chrome-linux/chrome` at the
   `chromium_headless_shell-1194` binary.
8. **Tier-01 card scale and row rhythm alignment.** The Tier-01 card is 380x540; its Figma render `42:2` is 760x1080 (2x). Scaling that 2x render by ~1.97 makes Tier-01's row pitch land at ~154px, matching the Halo subitem height of 151px almost exactly — V2 card was built at 1500px wide and both systems' row rhythms line up without fighting. Trap: `208:822` looks like a usable card node and is not (see Tier-01 target row above).

## Waiting on Jac — do not guess these

1. **The bulb fails a CVD gate.** Five states in one row, distinguished by colour alone;
   blue/gray measures 46-48, green/gray 31-69, blue/green 72, against a floor of 90.
   wrangler-style accepts those palette collisions *only* when disambiguated by label +
   icon + position, and the bulb has none. Jac is colour-blind. Options in
   `OPEN-QUESTIONS.md`; recommendation is a state glyph, possibly plus a per-state mottle.
2. **The bulb's 13px radius contradicts ledger #140** (`border-radius: 0` for the
   redesign). The artwork and the rule are both Jac's.
3. **Which card gets Gunmetal.** Assumed Assembly/default.
4. **Three near-miss steel ladders** coexist — `canon-colour-map.css` hexes, the
   knob-driven ladder, the Figma colourways. It has already caused one wrong "fix".

## Ledger

Rows **#226-#237** were added this session (`docs/superpowers/specs/2026-07-20-decisions-ledger.md`).
#226 is the load-bearing one: the conduit/deck mismatch was a **seat** mismatch, not a
colour one, which is why every earlier recolour failed to fix it.
