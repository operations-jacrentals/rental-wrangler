# DESIGN.md — scaffold & lint guide (Google Labs spec)

Full procedure for the DESIGN.md sub-capability of `jactec-ui` (folded from the former
`design-md` skill). `DESIGN.md` is the **third instruction layer** for coding agents:
`AGENTS.md` (project rules — for us that's `CLAUDE.md`) / `SKILL.md` (capabilities) /
**`DESIGN.md` (visual identity)**. It's a single self-contained file — **YAML design
tokens up top, markdown rationale below** — that any agent (this one, Cursor, Codex,
Gemini CLI) reads to keep generated UI on-brand across sessions and tools. This
sub-capability **scaffolds** one and **lints** one against the canonical spec. It does
not restyle the app — the rest of `jactec-ui` owns that.

Canonical spec: `google-labs-code/design.md` (status: **alpha / pre-1.0**). The full
format + lint rules are vendored offline in `designmd-spec.md` and `designmd-lint.md`
so this works with no network. Marketing (getdesign.md, designmd.app) sometimes says
"v2 / Google Stitch alignment" — the upstream repo is single-track **alpha**; trust
`designmd-spec.md`, not the catalog copy.

## ⛔ Rails — read every time
1. **Review gate before propagation.** Scaffolding/linting a DESIGN.md is safe. But the
   moment its tokens would fan out into real files (`style.css`, `app.js`, components) —
   **STOP, surface the file, get Jac's OK first.** One token edit becomes dozens of UI
   edits; that's a job for the R-rulebook + §5 builders + CI gates (the rest of this
   skill), not a silent rewrite. (Baby steps — see CLAUDE.md.)
2. **Don't fork our canon.** DESIGN.md is *additive tooling*. Today the source of truth is
   `CLAUDE.md` (design language) + `jactec-ui` (tokens/recipes) + the R-rulebook. A
   JacTec `DESIGN.md` is a *projection* of that, not a competing canon. If Jac ever
   promotes it to the source, `jactec-ui` stays the **enforcer** pointing at it — never
   two rulebooks.
3. **Not a CI gate.** Like `tools/gen-icons.mjs`, the official CLI needs network (npx),
   which CI doesn't have. This is a **dev-time** capability. Validate by hand (the
   embedded checklist) when offline.
4. **DESIGN.md is safe to commit** — it's design tokens + prose, no PII/secrets. (Unlike
   `Code.gs`.) Still: never paste real customer data into the rationale.

## When to use
- "Make / scaffold a DESIGN.md" for a surface, a brand, or for JacTec itself.
- "Lint / validate this DESIGN.md" — check it conforms before an agent consumes it.
- "Extract the design.md of <site>" — capture an existing system as tokens + rationale.
- "Turn our design language into a DESIGN.md" — project the yard data-plate into the spec.
- Do **NOT** use this path to actually build or restyle app UI — route that to the core
  `jactec-ui` build language + the R-rulebook. This path stops at the file + review gate.

## Modes

### A. Scaffold
1. **Pick the source.** Greenfield (from a written brief) · **Extract** (from existing code
   — read the real tokens) · **From a reference** (mimic a named system's feel).
2. **JacTec path — extract, don't invent.** If the target is Rental Wrangler, pull the
   *actual* values, never guess:
   - Tokens from `style.css` `:root` — `--accent #ff7a1a`, `--yellow #f5c542`,
     `--red #ff4242`, steel panel `linear-gradient(180deg,#1b2129,#0c0e11)`, leather tan
     `~#c2925a` / deep `#8a5a2b`, fonts **Saira Condensed** (stamped labels/buttons) +
     **Geist** (body), the hazard-stripe motif.
   - Rules/rationale from `CLAUDE.md` → "Design language" and this skill:
     ONE safety-orange accent, rivets, stamped condensed labels, the *subtle* ranch
     seasoning, anti-AI-slop. These become the markdown body + the **Do's and Don'ts**.
   - A ready JacTec stub lives in `jactec.design.md` — start from it, refresh
     the values against the live `style.css`, don't trust it blind.
3. **Author to the spec** (`designmd-spec.md`): `---` fences, **required** `name` +
   `colors.primary`; tokens as `colors / typography / rounded / spacing / components`;
   body sections in canonical order (Overview → Colors → Typography → Layout → Elevation →
   Shapes → Components → Do's and Don'ts). Reference tokens with `"{colors.primary}"`;
   variants are **sibling keys** (`button-primary` + `button-primary-hover`), not nesting.
4. **Use the official CLI when network's available** (verified v0.3.0), else author by hand
   from the embedded spec. Subcommands: `lint` (validate) · `spec` (print the format) ·
   `diff` (compare two files) · `export` (emit tokens — `css-tailwind` → Tailwind v4
   `@theme`, `json-tailwind` → v3 `theme.extend`, `dtcg` → W3C Design Tokens):
   ```
   npx -p @google/design.md designmd spec
   npx -p @google/design.md designmd export DESIGN.md --format css-tailwind
   ```
   **Windows gotcha (this machine):** the bare `npx @google/design.md …` form collides with
   the `.md` file association and opens the file instead of running. **Always** use the
   `-p @google/design.md designmd` bin form above (the package ships both a `design.md` and a
   `designmd` bin — use `designmd`).
5. **Lint it (Mode B). Then hit the review gate (Rail 1).**

### B. Lint
1. **Spec conformance — authoritative.** Run the canonical linter, or check by hand
   against `designmd-lint.md`:
   ```
   npx -p @google/design.md designmd lint DESIGN.md     # Windows-safe form
   ```
   Hard fails (ERROR): malformed `---` fences · missing `name` · missing `colors.primary`
   · a `{ref}` that resolves to nothing · circular refs · **duplicate section heading**.
   Warns: section order, missing typography, WCAG-AA contrast (<4.5:1) on a component's
   text/background, orphaned tokens, unknown top-level keys.
2. **Agent-readiness — optional, stricter, MANUAL.** The `design-md-lint` project
   (DSGN-001..016) adds clarity/state/a11y checks — bans vague adjectives, demands
   hover/focus/active/disabled, requires a responsive + a11y strategy. **It is NOT on npm**
   (GitHub only) — so apply its rules as the **advisory checklist in `designmd-lint.md`**,
   not an `npx` command. **Reconcile:** its "required sections" (responsive, interaction,
   accessibility) are stricter than the canonical 8 — surface those as *improvements*, never
   as conformance failures on a spec-valid file.
3. **Report** ERROR/WARN/INFO with file+path+fix, like `designmd-lint.md` lays out. Fix
   ERRORs before anyone consumes the file.

## Hand-off
After a clean lint, surface the file and **one line**: what it captures, where it lives,
and the explicit choice — *consume it as-is*, or *propagate its tokens into UI* (which
escalates to the core `jactec-ui` build language + the R-rulebook, never silent). Then wait.

## References
- `designmd-spec.md` — the format: required/optional keys, token types, reference
  syntax, canonical body-section order. Read before authoring.
- `designmd-lint.md` — the deduped, severity-tagged rule set + the two-linter
  reconciliation. Read before validating.
- `jactec.design.md` — a JacTec yard-data-plate DESIGN.md to start from
  (refresh values against live `style.css`).
