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
  Jac syncs it to Labs with `/design-sync` from a **local** Claude Code session. **A cloud/web session
  cannot do this** — verified 2026-07-25: `DesignSync` returns *"design-system authorization, but
  /design-login requires an interactive terminal and is not available in this environment."* That is
  expected, not a bug; don't burn a turn retrying it. The error names one untested alternative —
  Claude Design's **"Send to Claude Code Web"**, which seeds the project into the workspace — worth
  trying sometime, but the local `/design-sync` is the known-good path.
- **Implementation** = rewrite what the builders (`rowEl`, `cardEl`, chip helpers…) *emit*. The data
  plumbing (`IDX`, derivations) does not change; only the returned markup does. This is why the kit is
  built on our real tokens/classes — so approved mockups drop in rather than needing translation.

## Prompt framework — EVERY Labs prompt gets these three
1. **⭐ North Star** — one sentence: the single thing this screen decides.
2. **🚫 Out of scope (anti-objectives)** — an explicit "do not critique/redesign this here" list.
   This is the leash: without it, every screen tempts a full-app rescue and nothing ever locks.
3. **♻️ Inherit** — the already-locked components this mockup must reuse **verbatim**. Once a thing is
   locked it rides onto every later screen unchanged.

### ⛔ Before writing ANY prompt: mine the decisions ledger

**`docs/superpowers/specs/2026-07-20-decisions-ledger.md` is the index of every locked decision** —
grep it for the surface you are about to prompt, and put what you find in the **Inherit** list.
Its companion `2026-07-20-list-views-inline-expand-design.md` carries the same session's spec.

**The ledger now runs to 2026-07-26.** Rows **#1–100** are the 07-20 snapshot; **#101+** is the
EXTENSION covering 07-21 → 07-26, including the reversals. **Read to the end** — a 07-20 row may have
a superseding row in the extension. And when you settle something new, **add a row**: a decision is
not made until it is in that table (#135).

This is not optional politeness — **it is the step that was skipped once and caused a real
regression** (2026-07-26): the card-header prompt derived its own slot list (name · count · rollup ·
filter · verb) instead of inheriting the ledger's, and Labs faithfully designed a header with **no
"Your Work" chip, no "Done" chip, a centred title, and no description line** — all four of which
were decided months earlier. Labs is blind to our repo; **anything not in the prompt does not exist
to it.** A prompt that re-derives what was already settled *will* silently undo it.

Watch especially for decisions marked **`⚠ NEW — captured here`** in the ledger's index table: those
exist in the ledger and **nowhere else** — not in a skill, not in a spec — so they are exactly the
ones a from-scratch prompt will miss.

### ⏱ And check the DATE — some decisions reversed more than once

The ledger is dated **2026-07-20**. Several decisions were revisited on **07-21** (in the spec) and
again on **07-25** (in `prompts/`). **The ledger is not automatically the newest thing.** Grepping it
and stopping is how you end up confidently citing a superseded decision — which happened on 2026-07-26.

**Known reversal chains — settle these by the newest entry, not the first one you find:**

| Question | 07-20 (ledger) | 07-21 (spec) | **07-25 (prompts) — CURRENT** |
|---|---|---|---|
| Section model | paging via chips (#53) | accordion plate stack on desktop, page on mobile (§2.0) | **paging via a section rail, "no accordion stack"** (`prompt-01-detail-views.md`) |

The accordion lost on the second reversal for a concrete reason worth keeping: stacking every section
open made a Customer record run **~5 phone-screens**. Paging costs nothing in awareness **because**
every rail chip shows its rolled-up Signal at rest — which was the accordion's whole argument.

**If you reverse one of these, add a row here with the date and the reason.** Two flips already
happened without a written trail, which is why an audit had to reconstruct it from file dates.

**One screen = one Labs session.** Consistency comes from the synced design system + the Inherit
list, NOT from session continuity. Start a fresh Labs session per screen.

The rule is about the **scope of the subject**, not the count of rendered pieces: a session covers
**one subject**, but that subject may need several artifacts to express (prompt-03 covers the card as
frame + header + row, because designing the three *against each other* is what stops them drifting).
**Container mockups also stay interactive** — clicking a row and watching it expand catches what a
static state grid cannot. Both are deliberate, both are accepted as slower (ledger **#136**);
**do not "streamline" them by splitting prompts or dropping the JS.**

## Build order (foundations first)
- **Tier 0.0 — Atoms** ✅ **LOCKED 2026-07-25** (see decisions below). The approved consistency pass
  is **applied to the kit itself** — `rw-consistency-pass.css` stays as the record of what was
  decided, but the kit files no longer need it layered on.
- **Tier 0.1 — Containers** ← **CURRENT.** Prompts are **written**; none has been run in Labs yet.
  Run them in this order, each its own Labs session:
  1. `prompts/prompt-03-container-card.md` — **card frame · header · list row.** The most
     load-bearing prompt in the build order: twelve surfaces share this anatomy.
     > ⚠️ **The FIRST 0.1a run is a DRAFT, not a lock (Jac, 2026-07-26).** It was run against the
     > prompt *before* the canon corrections (#770–#772), so its header lacks **"Your Work"**,
     > **"Done"**, the left-aligned **Ref** title and the description line, and its row lacks the
     > click contract and the group taxonomy. Jac deliberately chose not to restart that session —
     > the corrections land on the **next** run. **Do not treat that artifact as the locked card
     > container, and do not build Tier 0.2 on it.** Its frame, list row and Trips stress-test work
     > are sound and carry forward.
  2. `prompts/prompt-04-container-section.md` — **section.** A detail view is a rail of these paged
     one at a time, so it must lock before Tier 1 can.
  3. `prompts/prompt-05-container-overlay.md` — **panel · popup · ⋯ action menu.**
- **Tier 0.2 — App shell** — 3-column yard grid, top bar, footer rail; decides how a row-expansion
  relates to the columns. *A first draft exists (parked) — it revealed the real tension: the detail
  view's horizontal section rail does NOT fit a ⅓-width column, so the shell must decide
  break-out-wider vs anchor-panel vs in-column.*
- **Tier 1 — Detail view** — bounded height + section rail that pages one section at a time, each rail
  chip carrying its rolled-up Signal + primary Door, History pinned. *A first draft exists (parked)
  and PROVED the model works; it locks once it sits inside the approved shell.*
- **Tier 2 — Per-card content** — the twelve surfaces: the base five (Units · Rentals
  calendar-anchored · Customers · Trips · Categories), the role Dashboard, and the six back-office
  boards (Invoices now among them — see Settled + carried).
- **Tier 3 — Cross-cutting** — item/comms tabs · footer-rail open chats · notifications/toasts ·
  settings boards · creation flows/wizards · empty+loading+login+mobile reflow.

## Locked decisions (do not reopen)
- **The palette/type tokens** — the `html.dv2` redesign set in `style.css` (CVD-tuned; `--yellow:#eed44b`,
  `--red:#ff4242`, `--blue:#6394cc`, `--commit:#2f6fd0`, `--accent:#ff7e1f`).
- **Atoms consistency pass (2026-07-25)** — applied to the kit from Jac's Labs review:
  - **Four control shapes, one per family** — state chips **squared** (`--chip-radius:2px`), openers
    **top-rounded** (`5px 5px 0 0` — Gate and Field only, so a trigger reads as the top half of an
    open menu), records **rounded** (`--item-radius:8px`), actions **pill** (Doors only). ⚠️ This
    SUPERSEDES the old "two radii / one 7px chip radius" line in the `style` skill — that canon is
    now stale. Rejected on purpose: `.plate` (a container, not a control), `.door` (actions never
    open), `.seg` (a toggle switches, it does not open).
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
  **This is what gets `/design-sync`'d to Labs.** 13 preview cards — the consistency pass is applied,
  and `elements/pin.html` is the new eighth atom.
- `docs/design/atoms-canvas.html` — all atom families on one editable page (the review surface),
  now including a Pins section.
- `docs/design/prompts/` — the Labs prompts. `00` atoms · `01` detail views · `02` shell ·
  `03/04/05` the three container prompts. Note the numbers are **creation order, not tier order** —
  the tier sequence is in `labs-build-order.md`.
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
1. **`/design-sync` from a LOCAL session** (`/design-sync docs/design/rw-design-system/`) against the
   patched kit. **This gates everything else** — Labs is still grounded on the PRE-pass atoms, so
   running a container prompt before syncing composes containers out of 7px chips, Geist and tinted
   outlines, and the work has to be redone. Labs has never seen `elements/pin.html` at all.
2. **Run `prompts/prompt-03-container-card.md`** in a fresh Labs session. Then 04, then 05.
3. As each locks, fold the result into the kit, re-sync, and append it to the locked-elements
   registry in `labs-build-order.md`.

## Settled + carried
- **The base five are Units · Rentals · Customers · Trips · Categories** (Jac, 2026-07-26, confirming
  ledger #44 over the shipped code). **Invoices is NOT a base card** — it moves to a back-office
  board. The shipped `config.js` → `GRID_CARDS` still has Invoices in and Trips out, so **`config.js`
  needs updating in Tier 2** — that is queued app work, not a design task. Plus the role **Dashboard**
  as a 6th, role-dependent card.
- **Trips IS a card** (Jac, 2026-07-25). The card anatomy serves **twelve** surfaces: 5 grid cards +
  6 back-office boards + Trips. Trips has no `GRID_CARDS` / `BACKOFFICE_BOARDS` entry yet — only its
  three reference mockups — so **adding the registry row is queued app work for Tier 2**, not part
  of the Labs pass. It is the useful stress test for the row grammar: time-anchored, so its rows
  carry *when* as prominently as *what*.

## Open questions for Jac
- **Archivo needs one line in `index.html`** whenever the redesign ships — adding it to the existing
  Google Fonts `<link>`. Nothing in the kit change touches the live app, so this is a Tier-2/ship
  concern, not a blocker now.
