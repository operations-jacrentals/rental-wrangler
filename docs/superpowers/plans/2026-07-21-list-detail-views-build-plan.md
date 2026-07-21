# Implementation Plan — List Views + Detail views (Phase-2 UI system)

Spec: `docs/superpowers/specs/2026-07-20-list-views-inline-expand-design.md` (§1–4)
Canon: `.claude/skills/style` (numbers) + `.claude/skills/wrangler-style` (decisions)
Audit: `docs/superpowers/specs/2026-07-20-mockup-critique-log.md` (canon-compliance audit, 2026-07-21)
Mockups: `scratchpad/list-views.html`, `scratchpad/detail-views.html`
Branch: `claude/rental-wrangler-ui-research-rhd74v`

**Scope (Jac 2026-07-21 — "both, as one plan"):** List Views (spot-what's-on-fire cards) and the
three Detail views (Units / Rentals / Customers) ship as **one** build — they share the same element
layer (Signal · Gate · Stamp · Ref · Door), card grammar, and palette, so building them together keeps
the shared builders honest. Big *replacements* ride behind a `FEATURES` flag in `config.js` (`flagOn()`
reader) so backing the swap out is a runtime toggle.

**Not in this plan:** Comms/Inbox (§7), Trips ETA-Tracker (§8, mockup done), Dashboard/graphs (§5 —
Jac: "not ready for graphs"), the all-cards Sort redesign (Jac: after staging builds). Those get their
own plans when their turn comes.

---

## The element layer is the spine — build it ONCE, correctly

Everything below renders through five shared builders. Author these first; every surface consumes them.
The canon audit found the **same drift repeated** because these were hand-rolled per-spot instead of
centralised — so the plan is: **one builder per element, canon-correct, no per-spot variants.**

| Builder | Canon (wrangler-style §3 + style §7) | Audit fix baked in |
|---|---|---|
| `signal()` | coloured chip, read-only; **colour = `taskState()`**, **fill = `triggeredToday()`**; ONE chip radius; dark ink on fill (filled red = `--red-fill` + `--on-red-fill`) | status must route through `taskState`, **never hand-set** a colour (list-views `PROTECTION OFF` was hand-set yellow) |
| `gate()` | a Signal you can turn: same chip + **leading chevron**; **state colour, NEVER `--commit`** | clean in both mockups — keep it that way; `--commit` is Doors only |
| `stamp()` | plain fact: chip **text, no box, no colour** (`--txt-3`), stamped voice; overflow → `+N` | a fact must be a Stamp on BOTH polarities (list-views showed `PROTECTED` as Stamp but `PROTECTION OFF` as a boxed chip — pick one: both Stamp, or both real Signal state) |
| `ref(record, typeName)` | square accent-tinted backing + **the record's TYPE icon** + name (body voice); ONE chip radius; orange-marked = touchable | **every linked record is a Ref, everywhere** (incl. card **titles/headers**, unit/invoice sub-rows) — never plain text; **key the icon off `typeName`/`TYPE_ICON`, never a hardcoded user glyph** |
| `door()` | verb action, pill radius; commit/create → `--commit`; money → green; destructive → red; the one quiet Cancel = ghost; **toggle active segment = the filled Signal of the option's state**, orange only when the option carries no status | Insured/Uninsured toggle must show good/risk **state colour**, not plain accent-orange |

**Hard numeric rules (style):** one control height, one baseline, the size ladder, **ONE chip radius**
(collapse the `6/8/5px` split found in both mockups to a single token), WCAG floors (4.5 text / 3 UI),
the ≥90 CVD-separation floor, 60-30-10 accent budget. **colour = `taskState(record)`**, **fill =
`triggeredToday(record, ctx)`** — the two drift-proof functions; nothing hand-sets a status colour.

**Palette rules (frozen):** the ten locked tokens only, **no new colours**; **yellow = `#eed44b`** (NOT
the neon `#ffe14d` — CVD-rejected; detail-views had it wrong); **never pure `#fff`/`#000`** — on-fill inks
are `--on-red-fill`/`--on-commit` = `#fdfdfd`; **dark-only** — emit **no** `prefers-color-scheme:light`
or `[data-theme="light"]` blocks. Two type voices only (stamped mono for labels/chips/IDs/**numbers**
tabular; body-sans bold sentence-case for record names) — **dollar figures use the mono/tabular voice**
(detail-views had them in body-sans).

---

## Phases (app.js line-mapping = the atlas-grounded next step)

> The existing app is a single-file `app.js` with the R0–R25 `data-r` rulebook + CI guards. Exact
> `file:line` anchors per phase come from a **`/atlas` (CODE-MAP) pass** — the next step before coding, so
> the phases below are scoped by *concern*, not yet by line. Every UI element gets a `data-r` stamp;
> regen `rule-usage.js` (`node ci/gen-rule-usage.mjs`) when usage changes; new popups need a
> `WINDOW_CATALOG` entry. Cache-bust on any served-file change.

- **Phase 0 — `FEATURES` flag + shared chip-radius token.** Add the flag (default OFF); collapse the chip
  radii to one token in `style.css`. Verify: gates green.
- **Phase 1 — the element layer.** Author/normalise `signal()`, `gate()`, `stamp()`, `ref(record,
  typeName)`, `door()` to the table above; introduce `TYPE_ICON` and route `ref()` through it; ensure
  `taskState`/`triggeredToday` are the sole colour/fill source. This is where the audit fixes land once,
  for every surface.
- **Phase 2 — List Views.** The card grid (Units/Rentals/Customers/Trips/Categories + role Dashboard),
  the plate grammar (status-bar + stamped label + summary + rollup chip + chevron), Attention vs
  Lifecycle groups (never named after status), header colour = worst-item rollup (`red>yellow>blue>green>grey`),
  inline-expand + anchoring per spec §1–4.
- **Phase 3 — Detail views.** Units / Rentals / Customers plates + sections, all rendering through the
  Phase-1 builders; fix the specific drift (unit/invoice sub-rows → `ref()`; dollar figures → mono;
  Insured toggle → state colour; strip the light blocks).
- **Phase 4 — gates + ship prep.** `data-r` stamps + `rule-usage.js` regen; `WINDOW_CATALOG` for any new
  popup; full CI gate suite; cache-bust bump; then hand to `/deploy → /merge → /promote`.

## Open decisions (bring to Jac before/at build)
- **Invoice line-item IDs as Ref or Stamp?** detail-views shows `#4460/#4471` as plain IDs. Ref-wrap
  (walkable) vs an explicit "line-item IDs are Stamp-by-design" call. → Jac's call.
- Anything touching money/auth/PII/WO-completion stays on the main session (never delegated) per the
  build rules.
