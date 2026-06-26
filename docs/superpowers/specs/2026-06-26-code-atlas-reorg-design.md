# The Code Atlas — navigation-first reorganization (Tier 0)

**Date:** 2026-06-26
**Status:** Design — awaiting review
**Owner:** Jac
**Type:** Reorganization / renavigation only — **no behavior change**

---

## 1. Goal

Make any line of the Rental Wrangler codebase easy to **source, find, edit, and
debug** by laying a *narrative* navigation layer — a "chapter book" — over the
code that exists today. The reader should be able to open one map, find the
chapter that owns a feature, and jump straight to the right `file:line`.

This is **strictly a reorganization / renavigation**. It does **not** change any
feature, function, behavior, or styling. It is the lowest-risk tier of the idea
(Tier 0): the benefit comes from *navigation*, not from moving executable code.

### Non-goals (YAGNI — explicitly out of scope)

- **No physical code reordering** of `app.js` or any module (that is "Tier 1",
  deliberately deferred — see §8).
- **No splitting** `app.js` into separate module files ("Tier 2", not planned).
- **No renaming** of functions, variables, files that are served/imported.
- **No behavior, logic, or visual change** of any kind.
- **No `§`-renumbering.** The existing `§0–§28+` scheme is referenced throughout
  the code and ties to SPEC v8 — it is preserved verbatim.

---

## 2. The safety contract (the heart of this spec)

Jac's hard requirement is **zero risk to how the code works.** This spec earns
that with a mechanical, watchable proof — not "trust me."

1. **The core deliverable touches no code file.** `docs/CODE-MAP.md` and the
   generator are new files; shipping them cannot change runtime behavior.
2. **The one place we touch code is inert.** Banner standardization edits
   **comments only**. The proof obligation:
   > For every executable file (`app.js`, every `*.js`, `style.css`,
   > `index.html`, `ci/*.mjs`), a diff with **comments and whitespace stripped**
   > must be **empty**.
   If the stripped diff is not empty, the change is rejected and reverted.
3. **CI gates are the backstop.** All four existing gates must be green and
   **identical before vs. after** every commit:
   - `node ci/smoke.mjs`
   - `node ci/logic-test.mjs`
   - `node ci/gen-rule-usage.mjs --check`
   - `node ci/check-window-catalog.mjs`
   (Port-swap per CLAUDE.md: `sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`,
   run, then `git checkout -- ci/`.)
4. **File moves are limited to never-served, never-imported files** (§5.4),
   each grep-verified as unreferenced before it moves.

The stripped-comment diff is the spec's central guarantee. A reviewer can run it
by hand and see, byte for byte, that no executable code moved.

---

## 3. The "novel" — what the organization looks like

The codebase is narrated as a book in **Parts**, each Part a domain, each
**Chapter** a named grouping of the `§`-sections that already exist in the code.

- **Part I — The Frontend** (this spec, phase 1): `app.js` + the sibling modules
  + `style.css`.
- **Part II — The Workshop** (phase 2, outline only): `.github/`, `ci/`,
  `docs/`, `tools/`, root build/serve scripts.
- **Part III — The Backend** (phase 3, outline only): `Code.js` (gitignored,
  lives in `~/rw-backend`, ships via `/clasp`).

A **Chapter** is purely a *narrative grouping* — it never renumbers or moves the
`§`-sections it covers. Example mapping (illustrative; exact chapter list is
produced during build from the real banners):

| Chapter | Narrative title | Covers (existing anchors) | File |
|--------|------------------|---------------------------|------|
| CH00 | The Boot & the Black Box | §0.7 glitch capture, boot | app.js |
| CH01 | The Toolbox (utilities, formatting) | §1 | app.js |
| CH02 | The Card Catalog (indexes & search) | §2, §5 | app.js |
| CH03 | The State of the Yard (state & sessions) | §4 | app.js |
| CH04 | How Money Is Derived | §3, §10 | app.js |
| CH05 | Drawing the Yard (UI builders) | §5, §5a | app.js |
| … | … | … | … |

(The full, accurate chapter list is generated from the standardized banners in
build, not hand-guessed here.)

---

## 4. Deliverables (phase 1 — the Frontend)

### 4.1 `docs/CODE-MAP.md` — the table of contents that tells the story

The core deliverable. **Zero edits to any code file.** Structure:

- **Front matter:** one paragraph — what this app is; the data-flow story
  (`state → render → action → re-render`, reference-by-ID, derive-everything);
  and "how to read this map."
- **Part I chapters**, each with:
  - **Narrative title** (e.g. *"Chapter 4 — How Money Is Derived"*).
  - **Location:** `file:line` range + the `§`-anchors it covers (clickable).
  - **What happens here:** 1–2 sentences.
  - **Key symbols:** the important functions/constants with their `file:line`.
  - **"Edit here when…"** and **"Debug here when…"** — the find-and-fix payoff
    that turns the map into a debugging tool, not just an index.
- **Modules covered:** `app.js` (the bulk), `config.js`, `data.js`,
  `cascade.js`, `icons.js`, `agreements.js`, `service-countdown.js`,
  `style.css`.
- **Reverse index ("Where do I go to change X?"):** a flat lookup table from a
  task/symptom to a chapter + `file:line` — e.g. *"Tax rate → CH04 /
  app.js:1528"*, *"A status pill's color → CH05 + style.css §…"*.

### 4.2 `docs/code-map.generated.md` + `tools/gen-code-map.mjs` — the drift guard

Mirrors the house pattern (`gen-rule-usage.mjs`, `check-window-catalog.mjs`,
`gen-icons.mjs`): the parts of the map that can be **derived from the code** are
generated, so the map can never silently drift.

- `tools/gen-code-map.mjs` scans the **standardized banners** (§4.4) across the
  frontend files and emits `docs/code-map.generated.md` — a machine index of
  every chapter: `{ id, title, anchors, file, startLine, endLine }`. This is the
  auto-derivable skeleton; the hand-narrated prose ("what happens / edit when /
  debug when") lives in `CODE-MAP.md`, which references the generated index.
- `node tools/gen-code-map.mjs --check` re-derives the index and **fails on
  drift** (a banner added/removed/retitled, or a chapter in the index with no
  banner in code, or vice-versa). Dev-time, no network — safe to run locally and
  as an optional CI gate.
- The generator is a **dev-time tool, never served/imported** by the app (like
  `tools/gen-icons.mjs`). It cannot affect runtime behavior.

**Decoupling rule:** `CODE-MAP.md` = the *story* (hand-written narration).
`code-map.generated.md` = the *index* (machine-owned, never hand-edited). The
narration references chapter IDs; `--check` keeps the two honest.

### 4.3 `/atlas` skill — the map as a living, used tool

A CODE-MAP nobody consults will rot. The `/atlas` skill makes the map the
*default* way sessions locate code, and keeps it honest. It is **instructions
only** — never served or imported, zero runtime risk.

- **Location:** `.claude/skills/atlas/SKILL.md` (house pattern).
- **Triggers:** any "where does X live / find / source / edit / debug this code"
  task — the skill says: open `docs/CODE-MAP.md` + the reverse index FIRST,
  locate the chapter, jump to the `file:line`, *then* grep only within that
  chapter's range. (Map-first beats grepping 15k lines blind.)
- **Keep-current duty:** after any change that adds, moves, or retitles a
  chapter/banner, run `node tools/gen-code-map.mjs` to refresh the generated
  index and update the `CODE-MAP.md` narration; `--check` is the gate that
  catches a forgotten update.
- **Scope boundary:** governs *navigating the source*. It does **not** touch the
  app's own in-app global search (`§5`) — that is a shipped runtime feature, out
  of scope for this reorg.

### 4.5 Static dead-code scan (added mid-phase — Jac 2026-06-26)

A conservative, **zero-runtime-cost** dead-code finder, grouped by Code-Atlas
chapter. Replaces the tempting-but-wrong idea of runtime usage counters (which
would inject executable code into `app.js`, add render-loop overhead, and only
prove "didn't run *this week*").

- `tools/dead-code-scan.mjs` → `docs/dead-code-report.md`. A module-scope symbol
  is flagged **only if its name appears exactly once in the entire frontend**
  (its definition) — counting string occurrences too, so it is deliberately
  conservative and won't flag string-dispatched (`data-act`) handlers.
- **Candidates for human review, never an auto-delete list.** Removal is out of
  scope for this reorg (it would be a behavior change).
- **Future follow-up (own small spec):** harvest real JS **coverage** from the
  Playwright CI runs (`smoke`/`logic-test`) to show which chapters actually
  executed — real "active vs. cold" data, zero production overhead, nothing
  injected into `app.js`.

### 4.4 Standardized chapter banners — inert comments (a separate, proven commit)

The existing banners are half-present and inconsistent (`§`-headers in box-draw
rules, plus ad-hoc inserts like `RENTAL EXTENSIONS`, `INLINE TRANSPORT EDITOR`,
`COMING 2026`, `Mr. Wrangler ACTS`). We normalize them to **one greppable
format** with a stable chapter ID, so one `grep` jumps to any chapter and the
map ↔ code agree:

```
/* ═══════════════════════════════════════════════════════════════════════
   CH04 · DERIVATIONS — how money, availability & statuses are derived
   Anchors: §3, §10        Map: docs/CODE-MAP.md#ch04
   ═══════════════════════════════════════════════════════════════════════ */
```

- **Comments only.** No code statement moves. Proven by the §2 stripped-comment
  diff (must be empty).
- Existing `§n` markers inside the section bodies are **left as-is** — the new
  banner sits at the chapter boundary and *names* the chapter; it does not
  replace the `§`-anchors.
- Same convention applied to the sibling modules and `style.css` where a chapter
  boundary exists.
- Shipped as its **own commit, after** `CODE-MAP.md`, with the stripped-diff
  proof shown in the commit/PR. Individually approvable and revertible.

---

## 5. Build sequence (phase 1)

Ordered so the highest-value, zero-code-edit piece lands first.

### 5.1 Step A — `docs/CODE-MAP.md` (zero code edits)
Read the frontend files, build the chapter groupings over the existing
`§`-sections, write the narrated map + reverse index. No code file is touched.
**Proof:** `git diff --stat` shows only `docs/` added.

### 5.2 Step B — the generator + generated index, then standardize banners
1. Add `tools/gen-code-map.mjs` and commit the first `code-map.generated.md`.
2. Standardize the banners (inert comments) so the generator's index is
   complete and `--check` passes.
3. **Proof:** stripped-comment diff of every executable file is **empty**; all
   four CI gates green and unchanged; `node tools/gen-code-map.mjs --check`
   passes. Show the proof in the PR.

### 5.3 Step C — the `/atlas` skill
Add `.claude/skills/atlas/SKILL.md` (§4.3). Instructions only — no code file
touched. **Proof:** `git diff --stat` shows only `.claude/skills/` added.

### 5.4 Step D — tidy non-executed clutter
Move never-served, never-imported items into `docs/` (candidates:
`NEW COMPUTER HANDOFF/`, `JacTec-handoff/`, `HANDOFF.md`, the dated session
folder `2026-06-21 Start+Wrapup Test/`, `drafts/`). **Before each move**, grep
the repo to confirm it is unreferenced by `index.html`, `app.js`, any `*.js`,
`ci/`, `.github/`, and the build/serve scripts. Anything referenced stays put.
**Proof:** moved paths are not in any import/served path; CI green.

Each step is its own commit on `claude/code-org-restructure-qcj3vc`; the work
goes up as a **draft PR**.

---

## 6. Acceptance criteria

- [ ] `docs/CODE-MAP.md` exists and covers every frontend file, with chapters,
      `file:line` anchors, "edit/debug here when" hints, and a reverse index.
- [ ] `tools/gen-code-map.mjs --check` passes and is wired to fail on drift.
- [ ] `.claude/skills/atlas/SKILL.md` exists: map-first navigation + keep-current
      duty; triggers correctly on "find/source/edit/debug code" tasks.
- [ ] Stripped-comment diff of `app.js` and every executable file is **empty**
      after the banner commit (no logic moved).
- [ ] All four CI gates green and **identical** before vs. after.
- [ ] Moved files are confirmed unreferenced; app boots and behaves identically.
- [ ] No `§`-section was renumbered; no function/variable renamed.

---

## 7. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| A banner edit accidentally deletes/alters a code line | Low | Stripped-comment diff must be empty; reject if not |
| Map line numbers drift as code evolves | Medium | `gen-code-map.mjs --check` drift guard |
| A "non-served" file is actually referenced | Low | Grep-verify each file before moving (§5.4) |
| Banner comment lands inside a template literal / regex and changes output | Low | Banners go only at top-level chapter boundaries; CI + stripped diff catch it |
| Scope creep into reordering/refactor | Medium | Hard non-goals (§1); reordering is a separate, later, opt-in Tier 1 |

---

## 8. The deferred path (Tier 1 — for the record, NOT in this spec)

If, after living with the map, Jac wants specific chapters **physically
reordered** into reading order, that is a separate future effort done **one
chapter at a time**, each: (a) moved as a self-contained block, (b) guarded
against module-load/TDZ ordering by running the full CI suite + a before/after
rendered-output equivalence check, (c) individually revertible. This spec
deliberately does **not** do that — it only makes Tier 1 *possible and obvious*
by establishing the chapter boundaries first.

---

## 9. Later phases (outline only — own specs when reached)

- **Phase 2 — Part II (The Workshop):** atlas + banners + tidy for `.github/`,
  `ci/`, `docs/`, `tools/`, root scripts. Same safety contract.
- **Phase 3 — Part III (The Backend):** atlas + banners for `Code.js`. Read via
  the Drive connector / clasp; backend is gitignored and ships via `/clasp`,
  **never git**. Banner edits deploy through `/clasp` (additive, STOP-gated),
  not a git push.
