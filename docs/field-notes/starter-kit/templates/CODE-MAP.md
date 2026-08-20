# The code map — the story half

> **What this is.** A narrated table of contents for the codebase. It doesn't change how
> anything works; it says *where* things live and *why they're there*.
>
> **Two files, one map.** This file is the **story** (hand-written, stable). Its companion
> `code-map.generated.md` is the **index** (machine-owned — live line numbers and symbols,
> produced by `tools/gen-code-map.mjs`, kept honest by a CI `--check`).
> When code moves, regenerate the index. **The chapter IDs below never change.**

## The one rule that explains the whole app

<One paragraph. If a reader knows only this, they should be able to guess which of three or
four places to look for any given change. Example: "UI renders from state; an action mutates
state; the app re-renders. Records reference each other by ID; everything else is derived,
never stored." That sentence saves more time than the rest of the document.>

## How to use it

- Find the chapter here → jump to the `file:line` in the generated index.
- Every chapter ID is **stamped into the source** as a banner comment, so `grep APP-19` lands
  on it from a cold start with no context loaded.
- **IDs are handles, not addresses.** Never renumber them, even when chapters end up out of
  order on disk. Renumbering silently invalidates every reference in every doc and every past
  decision.

## Chapters

### Act I — <the first grouping, in *reading* order, not file order>

- **`APP-01` — <title>.** What it owns, and the one thing to know before editing it.
- **`APP-02` — <title>.** …

### Act II — <…>

…

## Where to change what

| I want to change… | Look for a… | Which lives in… |
|---|---|---|
| what's shown | builder / renderer | Act … |
| a number | derivation | Act … |
| what a click does | action or handler | Act … |
