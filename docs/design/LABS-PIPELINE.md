# Design Labs pipeline — continuation doc

**Read this first in a new session.** Everything needed to continue the redesign is in files;
nothing important lives only in a chat. Started 2026-07-25.

## The plan in one line
Jac approves **every inch** of the site by designing it in **Claude Design Labs**, screen by screen,
foundations first — then Claude Code implements it by **rewriting the builder functions** in `app.js`
to emit the approved markup. (Codex is NOT in use.)

## How the pieces fit
- **Design Labs** = where each screen is designed + approved. It is blind to our code; it only knows
  the synced design system. It emits static HTML/CSS in our idiom.
- **`docs/design/rw-design-system/`** = the code-accurate kit (the design system's source of truth).
  Jac syncs it to Labs with `/design-sync` from a **local** Claude Code session (a cloud/web session
  cannot authorize — that's expected, not a bug).
- **Implementation** = rewrite what the builders (`rowEl`, `cardEl`, chip helpers…) *emit*. The data
  plumbing (`IDX`, derivations) does not change; only the returned markup does. This is why the kit is
  built on our real tokens/classes — so approved mockups drop in rather than needing translation.

## Prompt framework — EVERY Labs prompt gets these three
1. **⭐ North Star** — one sentence: the single thing this screen decides.
2. **🚫 Out of scope (anti-objectives)** — an explicit "do not critique/redesign this here" list.
   This is the leash: without it, every screen tempts a full-app rescue and nothing ever locks.
3. **♻️ Inherit** — the already-locked components this mockup must reuse **verbatim**. Once a thing is
   locked it rides onto every later screen unchanged.

**One screen = one Labs session = one artifact.** Consistency comes from the synced design system +
the Inherit list, NOT from session continuity. Start a fresh Labs session per screen.

## Build order (foundations first)
- **Tier 0.0 — Atoms** ✅ **LOCKED 2026-07-25** (see decisions below).
- **Tier 0.1 — Containers** ← **NEXT.** Card frame · card header · list row · section/plate ·
  panel/popup · **action/overflow menu**. Design each as its own artifact and lock BEFORE anything
  composes them.
- **Tier 0.2 — App shell** — 3-column yard grid, top bar, footer rail; decides how a row-expansion
  relates to the columns. *A first draft exists (parked) — it revealed the real tension: the detail
  view's horizontal section rail does NOT fit a ⅓-width column, so the shell must decide
  break-out-wider vs anchor-panel vs in-column.*
- **Tier 1 — Detail view** — bounded height + section rail that pages one section at a time, each rail
  chip carrying its rolled-up Signal + primary Door, History pinned. *A first draft exists (parked)
  and PROVED the model works; it locks once it sits inside the approved shell.*
- **Tier 2 — Per-card content** — Units · Rentals (calendar-anchored) · Customers · Trips · Invoices…
- **Tier 3 — Cross-cutting** — item/comms tabs · footer-rail open chats · notifications/toasts ·
  settings boards · creation flows/wizards · empty+loading+login+mobile reflow.

## Locked decisions (do not reopen)
- **The palette/type tokens** — the `html.dv2` redesign set in `style.css` (CVD-tuned; `--yellow:#eed44b`,
  `--red:#ff4242`, `--blue:#6394cc`, `--commit:#2f6fd0`, `--accent:#ff7e1f`).
- **Atoms consistency pass (2026-07-25)** — applied to the kit from Jac's Labs review:
  - **Three control shapes, one per family** — state chips **squared** (`--chip-radius:2px`), records
    **rounded** (`--item-radius:8px`), actions **pill** (Doors only). ⚠️ This SUPERSEDES the old
    "two radii / one 7px chip radius" line in the `style` skill — that canon is now stale.
  - **Body voice = Archivo** (mono voice unchanged). Loaded via the Google Fonts `<link>` in
    `index.html` (fonts are CDN-loaded, NOT bundled — adding Archivo is a one-line change).
  - **Outline chips are TRUE outlines** — transparent bg + 1px border in the status hue (the ten
    `--*-bg` tint backfills were deleted; the tokens remain for plates). New `--red-line` keeps red
    legible on dark once the tint is gone.
  - **`.menu` DROPPED entirely.** The status *picker* is now `.seg--stack` (the segmented toggle,
    stacked). A menu of unrelated **actions** (⋯ → Duplicate/Export/Archive/Delete) is a DIFFERENT
    job and is queued as a **container**, not an atom.
  - **New atom: Pin** (`.pin`) — universal corner marker, colour=state/fill=today like a Signal,
    13px, zero layout footprint, hover explains, click teleports.
  - Universal hover ring (outside the element, no layout shift), one focus ring, real `<button>`s for
    every tappable atom, no atom shrinks/wraps in a flex row.

## Files (all in the repo — durable)
- `docs/design/rw-design-system/` — the kit: `tokens.css`, `foundations/`, `elements/`, `components/`.
  **This is what gets `/design-sync`'d to Labs.**
- `docs/design/atoms-canvas.html` — all atom families on one editable page (the review surface).
- `docs/design/prompts/` — the Labs prompts written so far (atoms, detail views, shell).
- `docs/design/labs-build-order.md` — the framework + full build order.
- `docs/design/reference/` — the ~16 earlier mockups (list views, trips, inbox, dashboard, funnel,
  inspection, intake…) + `decision-notes.md`. Still valid as design references.
- `docs/research/` — the ~171-finding UX research corpus behind the redesign.

## Ship state (2026-07-25)
- **production is FROZEN** at `0fac006` and Jac is deliberately holding it there. Do **not** promote
  without his explicit say-so.
- **trunk** is ahead of production by ~21 commits: the app.js module split (#767), the dv2 redesign
  scaffolding (inert — gated behind `FEATURES.designV2`, off in production), docs/research, and some
  RENTALS/Trips bugfixes. A promote would be a clean fast-forward; the only user-visible change would
  be those bugfixes.
- The container clones **shallow** — if git reports trunk/production as "diverged" with no common
  ancestor, run `git fetch --deepen=200 origin trunk` before believing it.

## Next action
Design the **containers** (Tier 0.1) in Labs, starting with the **card frame + header + list row** —
the anatomy shared by all 7 cards. Write the prompt with the three-part framework above, and put the
locked atoms in its **Inherit** list.
