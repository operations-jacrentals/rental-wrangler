# DESIGN.md lint — vendored rules + two-linter reconciliation

Two linters exist. **The canonical `@google/design.md` CLI is authoritative** (npm,
v0.3.0, ships with the spec — `lint` outputs JSON findings + an `{errors,warnings,infos}`
summary, exits 1 on errors). `design-md-lint` is a stricter *third-party* "agent-readiness"
tool that is **NOT published to npm** (GitHub `outlookceo/design-md-lint` only) — so apply
its rules as a **manual advisory checklist**, after reconciling its required-section list
(below). When offline, check everything by hand against this file.

## A. Canonical `@google/design.md` rules

| Rule | Severity | Checks |
|---|---|---|
| `broken-ref` | **ERROR** | A `{ref}` resolves to no token; **circular refs**. (Also WARNs on unrecognized component sub-tokens.) |
| `missing-primary` | WARN | `colors` defined but no `primary`. |
| `contrast-ratio` | WARN | A component's `textColor` on its `backgroundColor` below **WCAG AA 4.5:1**. |
| `orphaned-tokens` | WARN | A token defined but never referenced by any component. |
| `missing-typography` | WARN | Colors defined but no typography tokens. |
| `section-order` | WARN | Body sections out of canonical order. |
| `unknown-key` | WARN | A top-level YAML key looks like a typo of a schema key ("did you mean…"). |
| `token-like-ignored` | WARN | A token-shaped string that won't be applied. |
| `token-summary` | INFO | Count of defined tokens. |
| `missing-sections` | INFO | Optional `spacing`/`rounded` absent → "falls back to agent defaults." |

**Parser-level hard fails (effectively ERROR — reject the file):** malformed `---`
fences · missing `name` · missing `colors.primary` · **duplicate section heading**.
The CLI exits 1 on any error and prints structured JSON (`severity`/`path`/`message` +
`{errors, warnings, info}` summary).

## B. `design-md-lint` (DSGN-001..016) — advisory, stricter, MANUAL (GitHub-only, not on npm)

| ID | Sev | Rule |
|---|---|---|
| DSGN-001 | ERROR* | Required sections missing. **\*Its** required set adds `responsive, interaction, accessibility` — *stricter than the canonical 8*. **Treat as WARN** so it can't reject a spec-valid file. |
| DSGN-002 | WARN | Visual spec with no interaction/state guidance. |
| DSGN-003 | WARN | Theme strategy (dark/light/density) unstated. |
| DSGN-004 | WARN | Vague adjectives ("modern, clean, elegant, premium, slightly rounded…") with no numbers/tokens. |
| DSGN-005 | WARN | Hardcoded raw values with no named token layer. |
| DSGN-006 | WARN | Inconsistent token-naming conventions. |
| DSGN-007 | WARN | "System claim too thin" — too few tokens for the claim. |
| DSGN-008 | WARN | Missing component states (hover/focus/active/disabled). |
| DSGN-009/010 | WARN | Missing / vague responsive strategy. |
| DSGN-011/012 | WARN | Missing a11y essentials; focus/label/contrast gaps. |
| DSGN-013 | ERROR | Deterministic self-contradiction (claims "flat / no shadows" then defines shadow tokens). |
| DSGN-014 | WARN | No concrete/executable examples. |
| DSGN-015/016 | INFO | No naming convention / no "don'ts" boundaries. |

`design-md-lint` is a TypeScript project on GitHub (`outlookceo/design-md-lint`), **not on
npm** — clone + build it only if you want these checks automated (it offers `--rule
ID:severity` overrides, `--fail-on-warnings`, `stylish`/`json` formatters, exit 0/1/2).
Otherwise the severities above are a **hand-applied checklist**.

## Deduped checklist — what to actually enforce

**Structure (ERROR)**
- [ ] Valid `---` fences (exact, top and bottom).
- [ ] `name` present; `colors.primary` present.
- [ ] No duplicate section heading.
- [ ] No self-contradicting claims (DSGN-013) — prose matches tokens.

**Token integrity (ERROR / WARN)**
- [ ] Every `{ref}` resolves; **no circular refs** (ERROR).
- [ ] Refs respect primitive-vs-composite (composite only inside `components`).
- [ ] Only valid component sub-tokens (others WARN).
- [ ] No orphaned tokens; consistent naming; named token layer, not raw values (WARN).

**Order & sections (WARN)**
- [ ] Canonical section order.
- [ ] Typography defined when colors are.

**Accessibility (WARN)**
- [ ] Component text/background ≥ WCAG AA 4.5:1.
- [ ] Focus/label coverage for interactive components.

**State & clarity (WARN)**
- [ ] Interactive components define hover/active/pressed/disabled variants.
- [ ] No vague adjectives without measurable values; theme + responsive strategy stated;
      concrete examples present.

**Completeness (INFO)**
- [ ] Naming convention + a "Do's and Don'ts" / no-go section documented.

## Reconciliation rule (don't trip yourself)
Run the **canonical CLI for spec conformance**, then apply the DSGN clarity/state/a11y
checks **by hand** (treating DSGN-001 as WARN). A file can be **spec-valid yet agent-thin**
— surface the DSGN findings as improvements, never as conformance failures.
