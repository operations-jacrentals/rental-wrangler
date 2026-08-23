# Codex onboarding — study this project before you build

Welcome. You're taking over Rental Wrangler. Work in **two phases**: set up *with* Jac, then study
the project *on your own*, then confirm your understanding with Jac before writing any feature code.

---

## Phase A — set up (walk Jac through it)
Follow **`docs/CODEX-HANDOFF.md`** end to end: same GitHub repo, create `AGENTS.md`, add the npm
scripts, and re-provision secrets. **Walk Jac through each secret** — he provisions the values from
his own vault; you never handle or echo a secret value, and nothing secret ever enters the repo or
chat. Swap the two LLM-calling GitHub Actions to OpenAI. **Do not touch feature code until
`npm run gates` (the full CI suite) is green.**

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
- **`CLAUDE.md`** — the project operating rules (seed your `AGENTS.md` from it).
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
  decisions (what was decided and why; newer decisions supersede older ones).
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

### 5. The CURRENT redesign (what we're building now) — read closely
- **`docs/superpowers/specs/2026-07-20-list-views-inline-expand-design.md`** — **THE current spec.**
  The whole Phase-2 model: inline-expand (detail is a reveal *in the list*, not a card-swap), the
  section **plate-stack**, the Rentals calendar-anchor exception, links-land-on-section, mobile
  paged sections, Comms/Inbox (§7), the **Trips ETA-Tracker ledger** (§8 — includes Jac's
  hand-drawn ledger, described in detail at §8.5), and the role **Dashboard** (§5). Jac's ideas are
  captured throughout; the §2.0 block records the plate-stack-vs-paging decision.
- **`docs/superpowers/plans/2026-07-21-list-detail-views-build-plan.md`** — the build plan for the
  list + detail views: the shared element layer, the phases, and a **running build log** of what's
  been shipped slice by slice.

### 6. What's been done so far (current build state)
The Phase-2 **`dv2`** redesign is being built **incrementally on staging**, gated behind
`FEATURES.designV2` (`config.js`) + the `html.dv2` class (set in `app.js`). It is **additive and
scoped `html.dv2 …`** — auto-on on staging/local, **production frozen** until the flag flips, so the
base look is byte-identical when off. On branch **`claude/rental-wrangler-ui-research-rhd74v`
(PR #752)**:
- **Palette/voice + element slices** — steel palette under `html.dv2`, section state stripes
  (left-border, matte), Ref icon plates, unit names routed through the shared `unitPill` builder,
  mono-tabular numbers, group-count voice.
- **Inline-expand Step 1** — single-click **reveals a record IN the list** (the row expands),
  **height-capped to the column** (the item scrolls internally, never blows out), full-width
  **grid-row breakout**.
- **Inline-expand Step 2** — reshaped to the **section plate-stack**: the header is the close
  control (the ✕ was dropped), Inspection collapses to a one-line plate, History collapses to its
  count chips, a swipe-easing reveal, and it scroll-anchors to the column top. **Units only so far.**
- **Study the built design two ways:** open the live staging build (the `/d/` launcher → newest
  deck, or the in-app **Staging ▾** switcher), and read the `html.dv2` blocks in `style.css` +
  the inline-expand code in `app.js` (`rowEl` / `cardEl` / `openStandard`, and the
  `INLINE_EXPAND_CARDS` / `dv2On` helpers).

### 7. What's next (the roadmap)
Immediate — finish the inline-expand rollout (agreed build order):
3. role default landing + drag-resort section order
4. Rentals calendar-anchor exception (no section tabs)
5. persistent History-search footer (bring the log back on demand)
6. single/double-click remap (largely done — single = expand, double = anchor)
7. links land on the correct **section** (generalize the existing `pillTo`)
8. mobile full-screen **paged** sections + a **To-Do** landing page
9. hover-jump popover (lowest priority)
10. retire the legacy card-swap detail once 1–7 cover all three cards
Also: **carry the plate-stack reshape into Rentals + Customers** (Units is done).
Then, per the spec: the **Trips ETA-Tracker ledger** (§8, mockup iterated with Jac), **Comms/Inbox**
(§7), the role **Dashboard** (§5 — Jac: "after the staging builds"), the **all-cards Sort redesign**,
and the extra-colour **palette collapse** into the frozen set.

### 8. How work ships here
Feature branch **`codex/<slug>`** → `npm run deploy:staging` (review on the deck URL) → **`/merge`**
(PR → `trunk`, gates must pass) → **`/promote`** (`trunk` → production — **a human call, the only
step that goes live**). **Never push to `trunk`/`production` directly** (branch-protected). Keep dv2
changes additive and `html.dv2`-scoped so production stays byte-identical until Jac flips the flag.
(If Claude is also running: see `CODEX-HANDOFF.md` §8 for branch namespacing + the `docs/WIP.md`
work ledger so the two agents don't collide.)

### 9. Gaps to close with Jac (NOT in the repo — you can't see these yet)
- **The visual mockups + photos + artifacts.** The 3-detail-views mockup, the `list-views` /
  `detail-views` HTML, Jac's hand-drawn sketches (e.g. the ETA-tracker), and the inspiration images
  live in the **chat / on claude.ai — not the repo**. `scratchpad/` is empty. If you want them, ask
  Jac to export the key ones into `docs/design/reference/`. The design is otherwise fully captured
  in the spec (§5) + the **live staging build** + the canon skills — start there.
- **The raw UX-research finding inventory (~171 findings + taxonomy)** was worked in a prior
  session. Its conclusions are folded into the spec + the critique log (§4). Ask Jac whether the raw
  inventory should be committed.

### 10. Your first deliverable
After reading the above and skimming the live staging build: **write Jac a short summary — "here's
my understanding of the current state and what I'd do next" — and confirm it before building.** Then
pick up the inline-expand rollout (step 3), the Rentals/Customers plate-stack reshape, or whatever
Jac prioritizes.
