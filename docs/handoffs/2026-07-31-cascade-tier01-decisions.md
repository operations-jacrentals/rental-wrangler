# Handoff — cascade the Tier-0.1 decisions + retyping into the rest of the design artifacts

> # ✅ DONE — THIS JOB IS COMPLETE. DO NOT RUN IT.
>
> **Superseded 2026-08-01 by PR #788 (`b35e4bb`), which a concurrent session shipped while this
> brief was being written.** The cascade described below has already happened:
>
> - the kit's `elements/pin.html` was **renamed to `slot.html`** (#177) and every element,
>   component and foundation page rebuilt;
> - `tier-01-handoff/atom-rebuild.md` now carries *"Retired 2026-07-31 (ledger #170)"* against the
>   8-tick cap and the fixed 114px board;
> - all six Labs prompts (`prompt-00`…`prompt-05`) were updated;
> - `docs/design/audit/prompt-b-tier-01-card.md` was **regenerated** and now indexes #172–#181, so
>   the "stale at #164" warning below is **no longer true**;
> - `tokens.css` took the #152 token pass, and `STALE-DESIGN-LANGUAGE-SWEEP.md` was folded in.
>
> **Two open items named below are also closed:** ledger **#180** closes **#156** (the laser frame
> carries the hue alone; the lit cartridge face does *not* also keep the group hue) and **#181**
> closes **#152**.
>
> **Kept, not deleted,** because the "Traps this session paid for" section is still accurate and
> still worth reading — and because deleting it would erase the record that two sessions worked the
> same job in parallel (a known failure mode: see `MEMORY.md`'s concurrent-duplicate gotcha).
> **Everything below is history. Verify against the ledger before acting on any of it.**


**Created 2026-07-31.** Self-contained. The prompt for the next session is at the bottom —
copy from `## THE PROMPT` down.

---

## The job in one line

Fourteen-plus decisions (**ledger #165–#179**) and a **retyping of the head/row grammar** were
settled and built into **one** artifact — `docs/design/tier-01-card/index.html`. **Every other
design artifact still teaches the superseded version.** Bring them to current canon.

## Why it matters

This repo's most expensive recurring failure is a **stale index cited as current** — it cost three
audits on 2026-07-26 (ledger #163, and the "stale INDEX" gotcha in `MEMORY.md`). Right now the
Tier-0.1 card is *ahead of* the kit, the prompts, and the handoff docs. Anyone building from those
today gets the **old** atom language: a Pin that #177 replaced with slots, a four-shape radius
ladder that #140 reversed, an 8-tick cap that #170 retired, and a row order that #176 superseded.

## What is now canon (the things that must cascade)

| # | Decision | What it invalidates elsewhere |
|---|---|---|
| **#166** | A collapsed slot shows a **numeral only** | any doc showing a status word in a collapsed slot |
| **#168** | **P1 two-level mechanic** — `GROUP = housing, opens by MOVING` (steel, mechanical, **no light**); `ROW = cartridge, opens by LIGHTING` (glass, terminal, emission). Invariant: **name right-aligned at both levels** | anything describing one shared open/shut treatment |
| **#169** | Laser drop moved **group → row** | `atom-rebuild.md`'s group-open boot theatre |
| **#170** | **Tick cap retired.** Every other element is edge-anchored, so the rack takes the **residual**; `+N` only when real width runs out | `atom-rebuild.md §1`'s 8-tick cap **and** the board's fixed 114px |
| **#171** | "Failed" drops from the group label, **kept as a filter term** | group-label lists |
| **#172** | Lit cartridge face is **neutral glass**; the **laser frame carries the hue alone** | narrows #156's open-row wash |
| **#173** | The **220ms click discriminator is untouched** — a P1 layer must add **no** click handler | any port that reimplements the click |
| **#174** | **MEASURED:** the verb conversion does **not** pay the width bill. #155's `max(66,…)` floor caps any verb set at **27px** vs a ~59px shortfall — **no wording makes facts fit at 380px** | design-log §2.6's original claim; any plan that "fits facts by shortening words" |
| **#175** | Verb **wording deferred** to a future Fable-5 pass over the backend — `JUMPWORD_BY_STATE` is an explicit placeholder, **do not polish it** | any doc treating those verbs as canon |
| **#176** | **Row order = `button · slots · board · name`** — the head's own right-to-left grammar (*name · board · slots*) plus a left-anchored button | R7's order, and every row diagram |
| **#177** | **Slots replace Pins EVERYWHERE**, including the filter chips, and **slots unfurl** | the kit's `elements/pin.html`, and every Pin reference |
| **#178** | Close-all = **click the Open chip**; #147's ✕-on-hover is **retired** | #147 as written |
| **#179** | Six bugs found by fresh-context review; two invalidated already-committed claims | see "Traps" below |

Also still canon from before, and still not reflected everywhere: **#140** (radius 0 + chamfers,
families told apart by **finish**, not radius), **#142** (**mono on every control**, Archivo for
prose only), **#153** (`.ref__icon` and the hint bubble zeroed).

## Where it has to land

Ordered by how badly each one currently misleads.

1. **`docs/design/rw-design-system/`** — the kit. **Worst offender.** `elements/pin.html` teaches an
   atom that #177 replaced; `elements/{signal,gate,ref,stamp,door}.html` and
   `components/{chips,fields,buttons,section-plate}.html` still carry the radius ladder and,
   in places, the Archivo control voice. Needs the **finish** vocabulary (dark key / pressed key /
   well glass / machined ring) instead of radii, mono on controls, and a **slot** element to replace
   Pin. `tokens.css` needs the ~20 `TOKEN-GAP:` markers from `tier-01-card.css` reconciled (#152),
   including the `#C28E54` vs `--tan #c2925a` near-miss.
2. **`docs/design/tier-01-handoff/atom-rebuild.md`** — states the **8-tick cap** and the **fixed
   114px board** as facts. Both are retired by #170, and §2.5/§5.7.2 of the design log now carry the
   measurement (racks run **138–243px**, i.e. 16–28 ticks of capacity).
3. **`docs/design/prompts/prompt-00-atoms.md`** and **`prompt-01`…`prompt-05`** — every one inherits
   the pre-#140/#176 atom language. Per **#134** a Labs prompt is blind to this repo, so anything a
   prompt omits *does not exist* to the model reading it; per **#145** each prompt needs an explicit
   **"still honoured?" checklist**, not just an Inherit list.
4. **`docs/design/audit/prompt-b-tier-01-card.md`** — regenerate; `/prompt-b` rebuilds from the live
   ledger, so re-run it rather than hand-editing.
5. **`docs/handoffs/STALE-DESIGN-LANGUAGE-SWEEP.md`** — the pre-existing ~30-doc sweep for the
   *older* language change (`#ff7a1a`, Saira, hazard stripes, the deleted `jactec-ui`). **Fold this
   cascade into that sweep** rather than running two passes over the same files.

## Traps this session paid for — do not re-learn them

- **`git rev-list` counts lie in this container** until the clone is deepened. The unpromoted-commit
  count read **1** on a shallow clone and **36** after `git fetch --deepen=400`. It has now misled in
  *both* directions. Always deepen before quoting a count.
- **dc-runtime RECYCLES row/head nodes positionally, it does not replace them.** A once-only "is it
  already built?" guard therefore reads a recycled node as correct, and the injected layer ends up
  describing a **different record**. Use a content signature.
- **`getComputedStyle` on a `display:none` element returns `transform: none`** whatever the inline
  value says. Reading state off an element your own CSS hides silently pins that state forever.
- **A measurement only proves something if the negative case can occur.** §5.7.1's "proof" of the
  two-register split measured a transform that never turned off.
- **`data-tip` does not exist in this build.** The issue list is the row's **`.pin[data-hint]`**,
  newline-separated `Source, State, Date`. The design log's §2.7 shorthand is wrong and flagged.
- **A row's centre point sits on the `.signal` chip**, which `stopPropagation`s per #67 — a scripted
  `click('[data-row]')` does **not** open a row. Click the row **body**.
- **The prototype's browser gates need `chromium_headless_shell-1194`** and port **9147**; a static
  `<style>` loses to the card's runtime-injected sheet on source order.

## State at handoff

- **PR #785** — open, **draft, not merged**, `mergeable_state: clean`, 12 commits. Carries the
  landed card, the design log, ledger #165–#179, and the MEMORY refresh. **The fresh-context review
  that gates the merge passed against an OLDER commit and then found six bugs; those are fixed in
  `d196df4` but the review has NOT been re-run against the fix.** Re-run it before merging.
- **36 commits sit on `trunk` unpromoted** (clean fast-forward; app.js +552, style.css +381).
  Deliberately deferred by Jac on 2026-07-31. `/promote` will need staging to serve trunk's bytes.
- **Still open by design:** **#156** — does the lit cartridge face keep the group hue, or does the
  frame carry it alone (currently the latter, per #172)? And a pre-existing prototype gap this
  surfaced but did not cause: the card's open-row wash never clears on a second body click, so a lit
  cartridge stays lit. That is the card's own contract and #173 says leave the click alone.

---

## THE PROMPT

Cascade the Tier-0.1 head/row decisions and the retyping into the rest of the design artifacts,
in repo `operations-jacrentals/rental-wrangler`.

READ FIRST, in this order:
  1. `docs/handoffs/2026-07-31-cascade-tier01-decisions.md` — this file. It is the brief: what
     cascades, where it lands, and the traps already paid for. Do not re-derive it.
  2. `docs/superpowers/specs/2026-07-20-decisions-ledger.md` — **read to the END.** #101+ supersede
     parts of the #1–100 snapshot; **#165–#179 are this session's** and are the payload.
  3. `docs/superpowers/specs/2026-07-31-tier-01-head-row-design-log.md` — the trail, the
     measurements, and three in-place **corrections** (§2.6, §2.7, §5.7.1/§5.8) that exist because
     the original claims were wrong. Carry the corrected versions, never the originals.
  4. `CLAUDE.md` + `MEMORY.md`.

THE JOB. One artifact — `docs/design/tier-01-card/index.html` — is current. Everything else still
teaches the superseded language. Bring the rest to canon, worst-offender first: the **kit**
(`docs/design/rw-design-system/` — `elements/pin.html` teaches an atom #177 replaced; the radius
ladder is reversed by #140; controls speak mono per #142; tokens need the #152 reconciliation), then
**`tier-01-handoff/atom-rebuild.md`** (its 8-tick cap and fixed-114px board are retired by #170),
then the **Labs prompts** (`docs/design/prompts/prompt-00`…`05`), then regenerate the audit doc via
`/prompt-b`. **Fold this into `docs/handoffs/STALE-DESIGN-LANGUAGE-SWEEP.md`** rather than making a
second pass over the same ~30 files.

HOW TO WORK.
- **A decision is not made until it has a ledger row** (#135). Add rows; never silently edit an old
  one — mark it superseded and write a new one (#163's rule).
- **Do NOT retro-edit the 07-20 records** (#163). They stay authoritative for group set and order.
- **Every Labs prompt needs an explicit "still honoured?" checklist** of inherited decisions, not
  just an Inherit list at the top (#145) — this session proved decisions drift *out of* a prompt
  even when they started in it.
- **Check the artifact, not the paperwork** (#164). Before re-imposing anything, confirm it is
  actually missing from the file you are about to change.
- Run any new or reshaped UI through **both** `style` and `wrangler-style`.
- **Every decision and question goes through an `AskUserQuestion` popup — ONE attempt, never retry a
  failed one, fall back to a lettered inline block (A/B/C + Other).** Batch related questions and
  favor multiSelect.

DO NOT.
- Do not polish the verb wording (#175) — a Fable-5 pass over the backend will derive the real
  library; `JUMPWORD_BY_STATE` is a deliberate placeholder.
- Do not plan to "fit the facts column by shortening words" — #174 measured that impossible at
  380px; it needs a wider column in Tier 0.2.
- Do not edit `docs/design/tier-01-card/index.html` to explore. It is the one current artifact.

FIRST, THOUGH — finish the open thread: **PR #785 is draft and unmerged**, and the fresh-context
review that gates its merge passed against an older commit *before* finding six bugs. Those are
fixed in `d196df4` but unreviewed. **Re-run a fresh-context review against the current head, then
merge if clean.** Also ask Jac about **#156** (does the lit cartridge face keep the group hue, or
does the laser frame carry it alone?) — it is the last P1 relocation still open.

Branch: work on `claude/tier-01-card-audit-crnxj3` if #785 is still open; otherwise cut a fresh
branch off `trunk`. Note that **36 commits sit on trunk unpromoted** — Jac deferred that
deliberately; do not promote without his explicit call.
