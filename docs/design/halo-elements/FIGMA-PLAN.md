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

## Scope lock (0d) — decided 2026-08-03, **corrected 2026-08-03 in Phase 1**

**Both languages, as variable modes.** One component set, one geometry, one API. The colour
collection carries two modes and only the *values* differ:

| | `MOCKUP` | `CANON` |
|---|---|---|
| what it is | the uploaded design, byte-exact | the app's locked language |
| provenance | `parts/*.css`, all gated 0.000 | the decisions ledger + `wrangler-style` |

> ### ⚠ Correction — CANON is a TOKEN-LAYER reskin, not a full one
>
> This section originally claimed "flipping the mode re-skins all ten components at once."
> **That is not achievable, and the claim is withdrawn.** Phase 1 measured it: `tokens.css`
> parameterises **22 colours**, but everything actually visible on the card — every bevel,
> ramp, seam, well, rivet and glass tint — is a **hardcoded gradient stop**, hundreds of them,
> and `README.md` states they "survived on purpose."
>
> So a CANON flip changes the accent, the state colours, the ground and the chrome. It leaves
> the entire metal body in mockup colours. Anyone reading a CANON render as "the card in canon"
> would be reading a false picture, and deciding what of the Halo look to keep from a false
> picture is worse than not deciding.
>
> **The fix is honesty, not more tokens.** Making the measured stops variable was considered and
> rejected: rule #2 below forbids it precisely because a variable invites a change that silently
> breaks a byte-exact part. (Jac's call, 2026-08-03 — the alternative, dual-baking every stop,
> was offered and declined.)
>
> **What CANON mode therefore is:** an *accent / state / ground / chrome* reskin. It answers
> "what does canon's colour language do to this card", **not** "what does this card look like
> in canon". The two-mode split earns its keep for a second reason too — ledger **#214** warns
> the kit "is a separation, not a reconciliation… do not treat the kit as canon", and modelling
> the two languages as explicit modes is what keeps them from bleeding into each other.
>
> Where canon has **no** locked value for a role (the rim tones, the cavity darks, `silver`, and
> the whole emissive red family), CANON aliases the **mockup** primitive and the variable's
> description says so in the file. The gaps are visible in Figma rather than hidden behind a
> plausible-looking swatch.

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
- **1 · Foundations** — **done 2026-08-03.** File `cc3TcK2F2a8qSbCAstzcA5`. 2 collections,
  71 variables (43 primitives + 28 semantics), 44 aliases all resolving, 7 text styles with
  live mode bindings. Details below.
- **2 · File structure** — Cover, Getting Started, Foundations, Components, Utilities.
- **3 · Components** — one at a time, in the order above. Build, variant, bind, document,
  validate with a screenshot. Never batched.
- **4 · Integration + QA** — Code Connect mappings, accessibility, naming, unresolved-binding
  audit, final screenshots.

Figma writes are strictly sequential — never parallelised — because Figma state mutations
race. That is why this is a long run rather than a fan-out.

---

## Phase 1 output (2026-08-03)

**File:** `cc3TcK2F2a8qSbCAstzcA5` — *Rental Wrangler — Halo Elements Library*, drafts of
`Jac Rentals's team` (pro tier ⇒ **4 modes max** per collection; we use 2). Movable into a team
project later without changing the file key.

### Collections — two, not the five first sketched

| collection | modes | holds |
|---|---|---|
| `Halo Primitives` | `Value` | 43 raw colours — 22 `mockup/*` from `tokens.css`, 21 `canon/*` from `wrangler-style` §1. `scopes = []`, so they are hidden from every picker. |
| `Halo Language` | `MOCKUP` · `CANON` | 28 semantics — 22 colour + `finish/glow-opacity` + 5 type. Everything mode-varying lives here. |

Colour, type and finish share **one** collection rather than three, so flipping the language is
a **single** mode switch — which is the whole point of the scope lock. `MOCKUP` is mode 1 (the
default every new frame inherits) because the components are built byte-exact against the
mockup, so Phase 3's screenshot validation has to render the mockup skin.

### Two absences, deliberately left empty

1. **No geometry collection.** Created, found to have no legitimate content, removed. This kit
   has **no shared geometry scale** — every part carries its own measured geometry (`screen.css`
   alone has four measured `--cut` layers: 19/15/12/11.4px). Canon's control ladder exists but
   governs canon UI, not these parts, and is currently self-conflicted (ledger **#140** reverses
   **#131**). Per-part knobs become Figma **component properties** in Phase 3 — not variables.
2. **No effect styles.** Same reason: each part's blur radii are measured individually, so there
   is no shared glow ladder to name. Per-part effects land with their components in Phase 3.

Both were left empty on evidence. Inventing a spacing ladder or a shadow ramp here would have
produced a foundation that looks complete and quietly isn't.

### Type — both stamp voices resolved by the same rule

Neither language commits to a mono **webfont**; both name a system *stack*. So each mode takes
its stack's first entry that Figma actually has:

| | declared stack | Figma has | resolved |
|---|---|---|---|
| `MOCKUP` | `Consolas, "Cascadia Mono", …` (`tokens.css:48`) | ✗ Consolas · ✓ Cascadia Mono | **Cascadia Mono** |
| `CANON` | `ui-monospace, "Cascadia Code", "SF Mono", …` | ✓ Cascadia Code | **Cascadia Code** |

Body voice is Roboto → Archivo. Figma text will **not** be glyph-identical to the CSS — the
byte-exact implementation stays in `parts/*.css`, and Code Connect ties them in Phase 4.

The 7 text styles sit on **canon's** locked size ladder (28/15/13/12/11/10/9.5), the only locked
type scale this project has. The mockup's sizes (27.9 / 29.5 / 40.4 / 41.9 / 3.9px) are
**measured fits** and are deliberately absent — they are set on the component in Phase 3.
`line-height` is left AUTO throughout because canon specifies none for any step, and stamped
tracking is 4%, the middle of canon's stated 0.03–0.06em **range** — a chosen point, not a
found one, and flagged as such in each style's description.

### One real divergence worth knowing

`type/body-weight-regular` resolves to **Bold** in MOCKUP. That is not a mistake: every glyph in
the mockup is weight 700 — it has no regular weight at all — while canon reserves bold for the
name/value and sets prose in regular.
