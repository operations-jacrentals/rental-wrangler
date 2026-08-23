# Tier 0.1 Labs handoff — 2026-07-28

**The Design Labs sessions are over.** Jac can't reach Labs from his phone, so the work was forced
to hand itself back. These four files are that handoff, landed **verbatim** — not edited, not
tidied, not summarised.

> **`final-card.html` is the visual source of truth for the redesign.** It is AHEAD of the atom kit
> in `docs/design/rw-design-system/`. When the kit and this card disagree, **the card is right and
> the kit is stale** — until the kit is rebuilt from it (see *What has to happen next*).

## The four files

| File | What it is | Trust it for |
|---|---|---|
| `final-card.html` | The finished card, interactive, self-contained (~463 KB) | **What the design IS.** Open it in a browser. |
| `tier-01-card.css` | 891 lines, unminified, every rule behind that card | Implementation. Every block is marked **NEW** / **INHERITED** / **CHANGED-ATOM**, and ~20 `TOKEN-GAP:` comments name the token each hard-coded value wants. |
| `atom-rebuild.md` | The decomposition — each of the eight atoms, what it is NOW, old → new | **Rebuilding the kit.** Written to be enough to rebuild each atom standalone without opening the card. |
| `labs-decisions.md` | ~39 decisions graded LOCKED / PROPOSED / ASSUMED, plus departures, rejected alternatives, still-open, and implementer notes | Knowing **what is actually settled** — and what only looks settled. |

## Read the status grades literally

Roughly **19 LOCKED · 14 PROPOSED · 6 ASSUMED**. Only LOCKED means Jac approved it.

**PROPOSED and ASSUMED rows are not canon just because they are written down and the card renders
them.** Labs graded itself honestly and marked its own execution details as unapproved — including
things that look load-bearing, like the fixed row-Signal column width and the whole jump-band
timing model. Do not promote a row by citing this file; promote it by getting Jac's ruling and
adding a ledger row.

## Jac's rulings, 2026-07-28 (ledger #140–#144)

| Question | Ruling |
|---|---|
| Radius 0 + chamfers as the card's identity | ✅ **LOCKED** — supersedes the four-shape ladder (#131) |
| Mono on every control atom, Archivo for prose | ✅ **LOCKED** — narrows #127 |
| The second 17px control size | ⏳ **DEFERRED** — the 24px law stands until Tier 0.2 (the shell) rules |
| Three locked decisions that vanished mid-session | ✅ **RE-IMPOSED**, all three |

## ⚠️ Three locked decisions vanished during the session

They were **in prompt 0.1a**, and the design lost them anyway across hours of visual iteration.
The handoff didn't flag them — a handoff reports what it decided and is blind to what it stopped
carrying. Found by grepping all four artifacts:

- **The click contract** (#50/#62/#63/#67) — single-click expands in place, double-click anchors and
  opens a tab, **220ms discriminator**, anchor icon top-right becoming **"+"** on other expanded
  rows. The card has **no double-click verb at all**.
- **The group taxonomy** (#31/#34/#35) — attention groups hidden entirely when empty; lifecycle
  groups always present and gray until a member triggers colour. **Neither behaviour implemented.**
- **The Dashboard, the 13th surface** (#44/#45/#86–89) — charts, not rows. **Absent.** This one has
  teeth: the slot rack (one tick per row), grip rack (scroll position) and message boards (worst
  state of contained rows) *all assume rows*. A chart card has none of them.

All three are re-imposed (#144) and **must appear in the next prompt's Inherit list.**

## What has to happen next

1. **Rule the leftovers.** ~20 PROPOSED/ASSUMED rows plus the three rounded survivors (#141).
2. **Rebuild the atom kit from this card**, not the reverse — `rw-design-system/` is now behind.
   Close the token gaps while doing it, starting with the `#C28E54` / `--tan` near-miss (#152).
3. **Tier 0.2, the shell** — it now also owns the 17px-vs-24px ruling (#143) and the
   Units∣Categories one-card conflict with #133 (#148).
4. **Re-impose #144's three decisions** in whatever comes next, Labs or not.

## A note on porting this

`labs-decisions.md` § *Notes to the implementer* is a fragility inventory, and it is accurate: the
laser polygon coordinates are hand-tuned against four other values, the `§3` cascade is
order-load-bearing, and both carets plus the footer loop depend on hidden mirror spans measured
after font load. **A font swap or a `letter-spacing` change silently breaks caret tracking.**

None of that is a reason to change the design. It is a reason to port it deliberately — with the
tweak panel intact — rather than reimplementing it from a screenshot.
