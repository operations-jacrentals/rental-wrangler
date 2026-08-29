# Codex onboarding — study this project before you build

Welcome. You're taking over Rental Wrangler. Work in **two phases**: set up *with* Jac, then study
the project *on your own*, then confirm your understanding with Jac before writing any feature code.

---

## Phase A — set up (walk Jac through it)
Follow **`docs/CODEX-HANDOFF.md`** end to end. **Most of it is already done:** same GitHub repo,
`AGENTS.md`, the npm scripts (`gates`, `deploy:staging`, `promote`, `cachebust`), and the Codex
plugin all exist. What is still open is the §7 checklist tail — **re-provision the secrets**, **swap
`wrangler-fix.yml`** off Claude, and **split `app.js`**.

**Walk Jac through each secret** — he provisions the values from his own vault; you never handle or
echo a secret value, and nothing secret ever enters the repo or chat. **Do not touch feature code
until `npm run gates` (the full CI suite) is green.**

## Phase B — study & understand (before any feature code)
Read the sources below **in order**, then **write Jac a short "here's my understanding of where the
project is and what I'd do next"** and confirm it before building. The goal is to understand: the
current state, the research, the flaws, the docs, the findings, Jac's ideas, the prior agent's
ideas, what's been done, and what's next.

### 1. What this project is
Heavy-equipment rental-management **single-page app** for **JacRentals** (Sulphur, LA). Vanilla JS,
single-file frontend: `app.js` (~27.8k lines), `style.css`, `index.html`, `config.js`, `data.js`.
**Google Apps Script backend** (schema-less Google Sheets; gitignored `Code.gs`, deployed by clasp).
Ships on a **trunk → staging → production** flow. Currently mid a **Phase-2 UI redesign**.

### 2. The brain (read first)
- **`AGENTS.md`** — **your instruction file, and the one to trust.** It already carries the ship
  flow, the backend runbook, the design canon and the Codex command list.
- **`CLAUDE.md`** — the Claude-side equivalent. Useful as a cross-check, but where the two disagree,
  `AGENTS.md` and the decisions ledger win. Do not seed anything from it — it is already seeded.
- **`MEMORY.md`** (repo root) — cross-session memory / durable context.
- **`.claude/rules/`** — path-scoped rules (e.g. icons: never hand-draw, source from Lucide).
- **`docs/CODE-MAP.md`** — the navigation map. **Open this FIRST before any code dive** and jump to
  `file:line` rather than scanning `app.js` blind. (Regenerate with `node tools/gen-code-map.mjs`.)

### 3. The design canon (the UI standard)
- **`.claude/skills/style/`** — the measurable spec: one control height, one baseline, the size
  ladder, contrast floors, colour-blind separation, and the two state functions (**colour = state**,
  **fill = today**).
- **`.claude/skills/wrangler-style/`** — the decisions: the locked steel palette, the two type
  voices, the button taxonomy, the **Signal · Gate · Stamp · Ref · Door** component vocabulary, and
  the restrained wrangler/ranch voice.
- **`docs/superpowers/specs/2026-07-20-decisions-ledger.md`** — the running ledger of locked design
  decisions (what was decided and why; newer decisions supersede older ones). **Read it to the
  END** — rows #1–100 are a 2026-07-20 snapshot and #101+ supersede some of them. Rows **#238–#261**
  are the current design-system run. A decision is not made until it is a row here, so **add one**
  when something is settled.
- **A canon trap worth knowing before you trip it:** `CLAUDE.md` and `wrangler-style` compress the
  rule to "**Matte — no glow**," which reads as a total ban and is not what canon says. Ledger #251
  is operative: light is emitted **by glass, never applied to steel**. Glass emitting (terminal
  text, carets, a lit interactive control) is correct; steel emitting (decks, housings, the card
  frame) is the violation. Check the material before removing a glow.
- **CRITICAL sourcing rule:** design comes from the **canon + specs + mockups + research** —
  **never reverse-engineered from the live `app.js`/`style.css`.** This is a hard rule from Jac
  (a controlled design environment); honor it.

### 4. The research & findings (why the design is what it is)
- **`docs/specs/market-research.md`** — market research.
- **`docs/handoffs/dispatch-ux-research-2026-07-06.md`** — dispatch UX research.
- **`docs/superpowers/specs/2026-07-20-mockup-critique-log.md`** — the canon-compliance audit of the
  redesign mockups: the concrete **flaws** found and their fixes.
- **`docs/handoffs/audit-2026-07-19-rentals-dispatcher-remaining-work.md`** and
  **`audit-2026-07-09-parked-findings.md`** — audit findings and parked work.
- The broad UX-research corpus (a ~171-finding inventory + taxonomy) was worked *in a prior
  session*; its conclusions are folded into the specs in §5. The raw inventory is **not in the
  repo** — see §9.

### 5. The CURRENT design work (what we're building now) — read closely
*This section was rewritten 2026-08-10. It previously described the `dv2` inline-expand redesign as
the active build; that shipped and landed on `trunk` (#766), and its `FEATURES.designV2` flag was
retired. The frontier moved.*

The live work is the **design system / V2 card**, landed as **#798**. This is **illustrated UI** —
the interface *is* artwork, sourced from Figma — which makes the working method different from
ordinary component work. Read in this order:

- **`.claude/skills/art-pipeline/SKILL.md`** — **the method, and the most important thing here.**
  Export from Figma with `exportAsync({format:'SVG_STRING'})`; **never recreate art in CSS**
  (a hand-rebuilt elbow failed the bar, and the export beat it immediately). Static art bakes as
  one z-ordered `background-image`; anything state-coloured rides as a white-silhouette
  `mask-image` filled with `var(--row-hue)`. Panels that must fit any width use `border-image`
  9-slice. It also carries eight measured traps that have each cost this project real time.
- **`docs/design/SLICE-SPEC.md`** — the 9-slice bands per panel, measured per-pixel and
  adversarially re-rendered at six widths. **Do not re-derive these.** Four of five panels failed
  first-pass verification, which is why the re-render step is mandatory rather than optional.
- **`docs/design/HANDOFF-2026-08-05.md`** — the latest session state, and the explicit list of what
  is **blocked on Jac's Figma work and must not be fixed in CSS**.
- **`docs/design/v2-card/`** — the Figma card `438:274` running as live HTML/CSS. Serve the folder
  and open `card.html`. **`docs/design/tier-01-card/`** is the card V2 is assembled on.

**Background, not a build target:** `2026-07-20-list-views-inline-expand-design.md`,
`2026-07-20-mockup-critique-log.md`, and `2026-07-21-list-detail-views-build-plan.md` describe the
inline-expand model that already shipped. Read for history and for the Trips ETA-Tracker / Comms /
Dashboard ideas that are still unbuilt — not to decide what to do next.

### 6. What's been done so far (current build state)
The V2 card runs as code. Jac's verdict: **"it's a start"** — not at fidelity.

**Working:** measured coordinate composition (a flex approximation was built and *rejected*); the
assets pass the tone gate; rows are fused to their elbows (#256) and hide behind the group header,
riding the channel down as it reveals; per-state lasers red/blue/yellow with steel never tinting;
`LayoutCount: 0` at ~60fps across 96 elbows.

**Not done:** the build still uses fixed-size scaled art, **not** `border-image` 9-slice. The spec
exists; nothing is wired to it yet.

**Blocked on Jac redrawing artwork — do not attempt these in CSS:**
- `asm-deck` cannot 9-slice below **1316px** — its chips, nameplate and "PROMISED" are frozen in a
  1100px fixed corner and the widest uniform corridor in the whole panel is 19px. The fix is to pull
  those elements out of the art into live DOM.
- `asm-housing`'s interior staircase is a **near-rhythm** (pitch 460/440/459) — it can neither
  `stretch` nor `round`.
- `asm-headboard` / `asm-rowboard` need **text-free** plate re-exports.
- The conduit rail export has three defects (#259), including an accent that is **red, not the canon
  `#ff7e1f`**. Author it neutral and tint per state.

**`asm-headboard`, `asm-rowboard` and `asm-channel` slice cleanly today.** Start there.

### 7. What's next (the roadmap)
Immediate, per `docs/design/NEXT-SESSION-PROMPT.md`: **prove the pipeline is fast.** Take ONE
component (one of the three clean-slicing panels) from Figma all the way to a published,
interactive, resizable artifact — export → split static/state-coloured → 9-slice → publish — and
**report the wall-clock time.** If it runs past ~30 minutes, stop and report *which step ate it*;
Jac wants the diagnosis, not a heroic recovery. The last card took hours, almost all of it rework,
and `art-pipeline` exists so that does not repeat.

After that: wire the rest of the panels to `SLICE-SPEC.md` as their artwork is redrawn, then carry
the V2 assembly across the remaining cards. Still unbuilt from the older spec and worth keeping in
view: the **Trips ETA-Tracker ledger**, **Comms/Inbox**, the role **Dashboard**, the all-cards
**Sort redesign**, and the extra-colour **palette collapse** into the frozen set.

### 8. How work ships here
Feature branch **`codex/<slug>`** → `npm run deploy:staging` (review on the deck URL) → **`/merge`**
(PR → `trunk`, gates must pass) → **`/promote`** (`trunk` → production — **a human call, the only
step that goes live**). **Never push to `trunk`/`production` directly** (branch-protected). Keep a
big replacement additive behind its own `FEATURES` flag so production stays byte-identical until Jac
flips it; small changes skip the flag and merge plainly. (If Claude is also running: see
`CODEX-HANDOFF.md` §8 for branch namespacing + the `docs/WIP.md` work ledger so the two agents don't
collide.)

### 9. Gaps to close with Jac (NOT in the repo — you can't see these yet)
- **Much of this gap has since closed.** `docs/design/reference/` now holds the exported mockups —
  `list-views.html`, `detail-views.html`, `trips-ledger.html`, `inbox-card.html`, `funnel.html`,
  `dashboard-card.html` and more, plus `decision-notes.md`. `docs/design/tier-01-card/` and
  `docs/design/v2-card/` hold the current cards as runnable HTML. Look there before asking.
- **Still not in the repo:** Jac's hand-drawn sketches and the raw inspiration images, which live in
  chat. The Figma file (`cc3TcK2F2a8qSbCAstzcA5`) is the source for the V2 artwork and needs a Figma
  connector to reach. Ask Jac if you need either.
- **The raw UX-research finding inventory (~171 findings + taxonomy)** was worked in a prior
  session. Its conclusions are folded into the spec + the critique log (§4). Ask Jac whether the raw
  inventory should be committed.

### 10. Your first deliverable
After reading the above and skimming the live staging build: **write Jac a short summary — "here's
my understanding of the current state and what I'd do next" — and confirm it before building.** Then
pick up the timed one-component pipeline test (§7), the open §7 handoff-checklist items (the
`wrangler-fix.yml` swap, the `app.js` split), or whatever Jac prioritizes.
