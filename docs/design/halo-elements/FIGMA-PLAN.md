# Halo → Figma library — Phase 0 output

The parts kit is ten origin-relative components, each gated byte-exact against the source
canvas. This is the plan for turning them into a Figma component library, so that new cards
get **assembled** from components instead of recreated from screenshots.

Run id: `halo-ds-2026-08-03`

**State ledger: `docs/design/halo-elements/figma-state.json` — in the repo, committed, on
purpose.** The Figma skill's default is `/tmp/design-system-state-<RUN_ID>.json`, and that is
wrong for this project: cloud sessions run in containers that are reclaimed after inactivity,
so a `/tmp` ledger is gone by the next session and the resume starts blind — creating duplicate
components and orphaned nodes, which is exactly what the ledger exists to prevent. Keep it in
the repo and **commit it after every phase**.

Re-read it at the start of every turn. Conversation context truncates; the file does not.

### Resuming in a fresh session

> "I'm continuing a design system build. Run ID: `halo-ds-2026-08-03`. Load the
> figma-generate-library skill and resume from the last completed step."

Then: read this file, read `figma-state.json`, load `figma-generate-library` **and** `figma-use`
together, and run the skill's resume protocol — a read-only `use_figma` scan of all pages,
components, variables and styles by name to reconstruct the `{name → id}` map before writing
anything. Never trust a remembered node ID.

---

## Scope lock (0d) — decided 2026-08-03

**Both languages, as variable modes.** One component set, one geometry, one API. The colour
collection carries two modes and only the *values* differ:

| | `MOCKUP` | `CANON` |
|---|---|---|
| what it is | the uploaded design, byte-exact | the app's locked language |
| provenance | `parts/*.css`, all gated 0.000 | the decisions ledger + `wrangler-style` |

Flipping the mode re-skins all ten components at once. That gives a side-by-side of the two
languages on identical bones — which is the comparison needed to decide what of the Halo look
is actually worth keeping, rather than deciding it in the abstract.

---

## Token map (0e) — every conflict, resolved

The kit's `tokens.css` is the mockup's palette. Canon values come from `wrangler-style`, not
from taste.

### Colour

| semantic | `MOCKUP` | `CANON` | note |
|---|---|---|---|
| `state/hot` | `#f95a5c` (`--neon`) | `#ff4242` (`--red`) | chip outline — a state indicator both ways |
| `state/hot-fill` | `#ff433e` (`--bar-red`) | `#d63636` (`--red-fill`) | filled red; canon pairs it with near-white ink |
| `state/warn` | `#fff252` (`--bar-yel`) | `#eed44b` (`--yellow`) | **the ledger already ruled this exact swap** — neon `#ffe14d` was dimmed to `#eed44b` for colour-blind separation, and `#eed44b` is called the floor. The mockup's `#fff252` is the neon that was rejected. |
| `accent` | `#f95a5c` | `#ff7e1f` | canon has ONE accent; the mockup has a red family |
| `tan` | `#7c401f` (`--amber`) | `#c2925a` (`--tan`) | restrained leather touch |
| `metal/chrome` | `#aebac6` | `#aab4c1` | near-identical; canon value wins |
| `metal/rim-*` | 4 rim tones | keep | structural, not brand |
| `ground/*` | `#0a0c10` `#1e202c` `#221a25` `#070e16` `#0d1218` | keep | the dark industrial ground is shared |

### Finish

| | `MOCKUP` | `CANON` |
|---|---|---|
| glow | on — SVG halo, blurs, inward cavity glow | **none — matte** |

This is the one difference that is not a value swap. Canon is explicitly *matte, no glow*, and
the mockup's identity is substantially its glow. Modelled as a `finish/glow-opacity` variable
so CANON can zero it without deleting the geometry.

### Type

| role | `MOCKUP` | `CANON` |
|---|---|---|
| body | Roboto | Archivo |
| stamp | Consolas | mono |

---

## Component list (0d) — the ten, in dependency order

Atoms before molecules. Node counts are measured per card.

| # | component | variants | knobs | nodes | gate |
|---|---|---|---|---|---|
| 1 | `Conduit` | 2 | 3 | 2 | 0.000 |
| 2 | `Bracket` | 1 | 2 | 5 | 0.000 in assembly |
| 3 | `Marks` | 3 | 2 | 8 | 0.000 in assembly |
| 4 | `Screen` | 2 | 9 | 6 | 0.000 |
| 5 | `Housing` | 1 | 2 | 7 | 0.000 in assembly |
| 6 | `Slots` | 3 | 7 | 14 | 0.000 |
| 7 | `Chip` | 4 | 36 | 18 | 0.000 |
| 8 | `Deck` | 1 | 23 | 25 | 0.000 in assembly |
| 9 | `Cartridge` | 2 | 3 | 29 | 0.000 |
| 10 | `Etch` | 2 | 17 | 76 | 0.000 |

Then two molecules assembled from them: `Main Item` and `Subitem`, and one organism:
`Card` (= Housing + both rows).

---

## What Figma cannot carry, and what to do about it

Being honest up front, because a library that quietly drops things is worse than no library.

1. **The SVG-only effects.** The chip's ring is a stroked octagon with an `feGaussianBlur`
   shoulder, and the source explains why it *must* be SVG: Chrome pixel-snaps a CSS div's
   paint box, so a 4px stroke centred at y=34.87 renders 33..37 with no antialiasing. Figma
   draws the vector natively and well — but the Figma component is a *design* artifact; the
   byte-exact implementation stays in `parts/chip.css`. Code Connect is what keeps them tied.
2. **Fitted sub-pixel measurements.** Several values per part are measured fits, not settings.
   They are deliberately not exposed as knobs in the workbench and must not become Figma
   variables either — a variable invites a change, and changing one silently breaks a part
   that is currently byte-exact.
3. **The conduit's 18-gradient art.** Lives once in shared `<defs>`; each instance is a
   `<use>`, which is why it costs 2 nodes a card. In Figma it becomes one component, instanced
   — the same idea, natively.

---

## Phases

- **0 · Discovery** — done. This document is its output.
- **1 · Foundations** — collections, modes, primitives, semantics, scopes, code syntax,
  effect + text styles. Nothing else until every token exists.
- **2 · File structure** — Cover, Getting Started, Foundations, Components, Utilities.
- **3 · Components** — one at a time, in the order above. Build, variant, bind, document,
  validate with a screenshot. Never batched.
- **4 · Integration + QA** — Code Connect mappings, accessibility, naming, unresolved-binding
  audit, final screenshots.

Figma writes are strictly sequential — never parallelised — because Figma state mutations
race. That is why this is a long run rather than a fan-out.
