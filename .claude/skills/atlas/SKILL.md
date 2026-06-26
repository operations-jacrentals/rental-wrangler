---
name: atlas
description: Map-first navigation of the Rental Wrangler codebase. Use whenever you need to FIND, SOURCE, EDIT, or DEBUG a specific piece of code — "where does X live", "which chapter owns the rental price", "where do clicks get handled", "find the Stripe code". Open docs/CODE-MAP.md FIRST to jump to the right chapter + file:line instead of grepping 15.7k lines of app.js blind, then narrow within that chapter. Also covers the duty to keep the map current (regenerate the index) after any change that adds, moves, or retitles a chapter. NOT for the app's own in-app search feature — that is a shipped runtime feature, not codebase navigation.
---

# Atlas — find code by the map, not by guessing

`app.js` is ~15,700 lines. Grepping it cold is slow and misses context. The
**Code Atlas** (`docs/CODE-MAP.md`) is a narrated chapter index over the whole
frontend — open it first and you land on the right `file:line` in one hop.

## When to use

Any task that means *locating* code: "where is the tax rate", "which chapter
builds the status pills", "find where a click becomes an action", "debug why a
ring shows the wrong %", "I need to edit the Shop card".

## The navigation loop

1. **Open `docs/CODE-MAP.md`.** Two fast ways in:
   - The **Reverse index** ("I want to change X → go here") — a direct lookup
     from a task/symptom to a chapter ID + `file:line`.
   - The **Acts** (Part I) — the reading-order story; skim to the Act that owns
     the concern (e.g. *Act II — Derivations* for any number, *Act VIII —
     Mutations* for what a click does).
2. **Jump to the chapter's `file:line`** and read the banner + key symbols.
3. **Narrow within the chapter only** — now a `Grep` scoped to that line range
   (or that symbol) is precise, not a 15k-line sweep.
4. For exact current line ranges + the full key-symbol list of any chapter, read
   the generated index **`docs/code-map.generated.md`**.

> Chapter **IDs** (`APP-01` … `APP-38`, `CFG`, `DATA`, …) are stable. Line
> numbers drift as code changes — trust the generated index for live lines, and
> the IDs / `§`-anchors / symbol names to navigate.

## Keep the map current (do this when you change chapter structure)

The map must never silently drift. After any edit that **adds, removes, moves, or
retitles a chapter banner** (the `═` banners in `app.js` / the module files):

```
node tools/gen-code-map.mjs           # regenerate docs/code-map.generated.md
node tools/gen-code-map.mjs --check    # drift gate — fails if the index is stale
```

Then update the narration in `docs/CODE-MAP.md` if a chapter's purpose changed
(its Act placement, "what happens here", or reverse-index entries). Run
`--check` before pushing — it is the gate that catches a forgotten regenerate.

- The generator is **dev-time only** — never served or imported, so it cannot
  affect runtime behavior. No network needed.
- You do **not** need to touch the map for ordinary edits *inside* a chapter
  (changing a function body, a value, a style) — only when the **chapter set**
  changes.

## Scope boundary

This skill governs navigating the **source**. It has nothing to do with the
app's own **in-app global search** (the `§5` search Rental Wrangler ships to
users) — that is a runtime feature, out of scope here.

## Reference

- `docs/CODE-MAP.md` — the narrated atlas (the story).
- `docs/code-map.generated.md` — the machine index (live lines + symbols).
- `tools/gen-code-map.mjs` — the generator + `--check` drift guard.
