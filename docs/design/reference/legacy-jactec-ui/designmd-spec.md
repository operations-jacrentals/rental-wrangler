# DESIGN.md format — vendored reference (Google Labs `design.md`, alpha)

A `DESIGN.md` is **two layers in one file**:
1. **YAML front matter** — machine-readable design **tokens** (the normative values).
2. **Markdown body** — human-readable **rationale + rules** (`##` sections). The spec's
   own `PHILOSOPHY.md` calls the prose "the most vital part" — it's what an agent reasons
   from. Don't ship tokens with an empty body.

Front matter is fenced by a line that is **exactly** `---` open and **exactly** `---`
close. Status is `version: alpha` — pre-1.0, single-track (no v1/v2 split upstream).

## Front-matter keys

| Key | Status | Shape |
|---|---|---|
| `name` | **REQUIRED** | string |
| `colors` | **REQUIRED** (≥ `primary`) | `map<token, Color>` |
| `version` | optional | string (`"alpha"`) |
| `description` | optional | string |
| `typography` | contextual | `map<token, Typography>` |
| `rounded` | contextual | `map<scale, Dimension>` |
| `spacing` | contextual | `map<scale, Dimension \| number>` |
| `components` | contextual | `map<component, map<sub-token, value \| ref>>` |

### Token value types
- **Color** — any CSS color: `"#1A1C1E"`, `rgb()`, `hsl()`, `oklch()`, named. (Don't
  narrow to hex — the spec allows any CSS color.)
- **Dimension** — number + unit; units restricted to **`px | em | rem`**.
- **Typography** — object: `fontFamily`, `fontSize`, `fontWeight` (bare number or quoted
  string — equivalent), `lineHeight` (a Dimension **or** a unitless multiplier like
  `1.6`), `letterSpacing`, `fontFeature`, `fontVariation`.

### `components` — sub-tokens & references
- **Valid sub-tokens (only these; anything else is accepted but WARNs):**
  `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`,
  `width`.
- **Reference syntax:** `"{path.to.token}"` — e.g. `"{colors.primary}"`, `"{rounded.md}"`,
  `"{spacing.lg}"`.
- **Primitive vs composite:** *outside* `components`, a ref must resolve to a **primitive**
  (`{colors.primary-60}`), not a group (`{colors}`). *Inside* `components`, **composite
  refs are allowed** — `typography: "{typography.label-md}"` is legal.
- **Variants are sibling entries, not nesting:** `button-primary` and
  `button-primary-hover` are two top-level component keys (states: hover/active/pressed/
  disabled as related siblings).
- Safety limits: token nesting depth ≤ 20, reference depth ≤ 10 (cycles caught).

### Recommended token names (not required — convention)
- colors: `primary, secondary, tertiary, neutral, surface, on-surface, error`
  (roles: `primary, secondary, tertiary, neutral`)
- typography: `headline-display, headline-lg/md, body-lg/md/sm, label-lg/md/sm`
- rounded: `none, sm, md, lg, xl, full`

## Body sections — canonical order
Appear in **this order**; any may be **omitted**, none **reordered**; a **duplicate
heading is an ERROR** (file rejected). Aliases in parens.

1. **Overview** (or **Brand & Style**)
2. **Colors**
3. **Typography**
4. **Layout** (or **Layout & Spacing**)
5. **Elevation & Depth** (or **Elevation**)
6. **Shapes**
7. **Components**
8. **Do's and Don'ts**

Unknown heading → preserved (no error). Unknown color/type token → accepted if valid.
Unknown component property → accepted with WARN.

## Minimal valid example

```md
---
name: Heritage
version: alpha
description: Premium broadsheet — architectural minimalism, journalistic gravitas.
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#F7F5F2"
  on-tertiary: "#FFFFFF"
typography:
  h1: { fontFamily: Public Sans, fontSize: 48px, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em" }
  body-md: { fontFamily: Public Sans, fontSize: 16px, fontWeight: 400, lineHeight: 1.6 }
rounded: { sm: 4px, md: 8px }
spacing: { sm: 8px, md: 16px }
components:
  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.md}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
---

## Overview
Architectural minimalism meets journalistic gravitas — a premium matte broadsheet.

## Colors
High-contrast neutrals plus a single accent.
- **Primary (#1A1C1E):** deep ink for headlines and core text.
- **Tertiary (#B8422E):** the sole driver of interaction — keep it scarce.

## Typography
One family, modest sizes; trust small size differences over heavy weight.

## Do's and Don'ts
- **Do** keep the accent rare — its scarcity is its meaning.
- **Don't** add a hero moment to the title page.
```

## CLI quick-reference
- `npx @google/design.md lint|diff|export|spec`
- **Windows-safe:** `npx -p @google/design.md designmd <cmd>` (the bare `.md` form opens
  the file via association instead of running the bin).
- Source: https://github.com/google-labs-code/design.md (`docs/spec.md`, `PHILOSOPHY.md`,
  `examples/`).
