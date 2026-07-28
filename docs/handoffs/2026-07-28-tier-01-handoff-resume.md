# Resume note — Tier 0.1 redesign, parked 2026-07-28

**Session archived deliberately; nothing is lost or half-done.** Everything below is in tracked,
pushed files. This note exists so you don't have to re-derive the state.

## ▶ START HERE — Jac's chosen resume point

**Rule the ~20 open rows in `docs/design/tier-01-handoff/labs-decisions.md`, plus the three unruled
rounded survivors (ledger #141).**

Jac picked this over the kit rebuild because everything downstream inherits these rulings — rebuilding
the kit first would bake in ~20 unratified decisions.

- **The ~20:** every row in `labs-decisions.md` graded **PROPOSED** (~14) or **ASSUMED** (~6).
  Roughly 19 more are LOCKED and need nothing.
- **The three survivors (#141):** Door keeps its pill · `.ref__icon` keeps 5px · the hint bubble
  keeps 9px — in an otherwise `border-radius: 0` design. Labs marked them ASSUMED with the reason
  *"never discussed; the demolition list simply never included them."* **They are accidents, not
  decisions.** Keep them as knowing exceptions, or zero them for consistency.
- **How to run it:** batch into `AskUserQuestion` popups, favour `multiSelect`, group by subject
  (row grammar · timings · breakpoints · shapes). Do **not** ask them one at a time.
- **A ruling isn't made until it has a ledger row** (#135). Next free number is **#153**.

## State at park

| | |
|---|---|
| Branch | `claude/rental-wrangler-redesign-tier-01-73qiof` — pushed, clean |
| PR | **#780**, draft, open. CI was `pending` at park. Docs-only; all ten gates passed locally |
| Also open | **PR #779** (accent-law). Its commit is *already merged into* this branch — either merge order works, nothing to reconcile |
| trunk → production | 1 commit behind (#777, docs-only). Production deliberately frozen |
| Uncommitted / stashed / worktrees | none · none · none |

**First move on resume:** re-check #780's CI, then merge it (`/merge`) so the ledger rows and MEMORY
refresh land on trunk before new work stacks on them.

## What happened this session

Design Labs is **retired as the design venue** — Jac can't reach it from his phone. The Tier 0.1a
session was forced to hand its work back; four artifacts landed verbatim in
**`docs/design/tier-01-handoff/`** (start at its `README.md`).

The session **replaced the atom language** rather than just building containers: nine new components,
four new finishes, radius ladder demolished, mono on every control, hover rings deleted card-wide.
Ledger rows **#139–#152**.

**Jac's four rulings (#140–#144):** radius 0 + chamfers **LOCKED** · mono-on-controls **LOCKED** ·
the 17px control tier **DEFERRED to Tier 0.2** · three drifted decisions **RE-IMPOSED**.

## After the rulings, in order

1. **Rebuild the atom kit FROM the card** — `rw-design-system/` is stale. Use `atom-rebuild.md`;
   close the ~20 inline `TOKEN-GAP:` markers, starting with `#C28E54` vs `--tan` `#c2925a` (#152)
   and #138(b), the Pin's hard-coded `--panel` ring (#151).
2. **Tier 0.2, the shell** — now also owns the 17px ruling (#143) and the Units∣Categories
   one-card conflict with #133 (#148).
3. **Carry #144's three re-imposed decisions** into whatever comes next: the click contract, the
   group taxonomy, the Dashboard as the 13th surface.

**Independent of all of the above:** the stale design-language sweep, self-contained at
`docs/handoffs/STALE-DESIGN-LANGUAGE-SWEEP.md`. Good fill-in work for a separate session.

## Two traps

- **#144's decisions drifted once already.** They were *in* prompt 0.1a and were lost anyway across
  hours of iteration, and the handoff couldn't see it. Add an explicit **"still honoured?" checklist**
  to any future handoff (#145), and **grep returned work against the ledger before reading it.**
- **Rendering is not ratification.** The card renders all ~39 decisions including the unratified
  ones. Cite `labs-decisions.md` for *what was designed*, never for *what was approved*.
