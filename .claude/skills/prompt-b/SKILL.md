---
name: prompt-b
description: >-
  GENERATES the task-specific second message of the two-message audit handoff (paired with
  `/prompt-a`) used to send a Rental Wrangler design prototype to an outside model for a
  usability + design pass. Every run it rebuilds itself from LIVE sources — reads the decisions
  ledger for what's currently LOCKED (→ the "deliberate, don't report" table) and what's
  currently OPEN/DEFERRED/PROVISIONAL (→ the "known-open, don't re-litigate" list), and inventories
  the target artifact for stubs, dead ends, and demo data — never reuses the previous run's file.
  Use when Jac wants to run or re-run the audit prompt pair against a design prototype (e.g. "run
  prompt-b against the Units card", "regenerate prompt B", "audit-prep the tier-01 card before I
  paste it into Codex"), or before any external-model audit of a Tier-0.x card or Labs mockup.
---

# /prompt-b — the task message (generative, rebuilt every run)

Prompt B is the half of the audit handoff that **always changes**. It names the surface, the
persona, and — critically — which of Prompt A's findings would-be violations are actually
**deliberate design decisions** the auditing AI shouldn't report as bugs. Because the underlying
design keeps moving (that's the whole point of an active redesign), **a stored copy of this file
rots exactly the way `labs-decisions.md`'s own status column rotted**: it starts defending
decisions that have since been reversed, and it stays silent about ones that just landed.

**Never treat an existing `docs/design/audit/prompt-b-*.md` as reusable.** Read it only to see
what the previous run scoped (surface, persona, output path) — every table inside it gets rebuilt
from scratch.

## Inputs

- **Target artifact** — the folder/path being audited. Default `docs/design/tier-01-card/` unless
  Jac names another.
- **Surface + persona** — default per Prompt A §2's surface→role table (Units/Shop → the yard/shop
  hand, Rentals/Calendar/Trips → the dispatcher, etc.); Jac may override with a specific named
  persona.
- **Dimensions** — default all six of Prompt A's lenses. When the target is a single card audited
  in isolation (no surrounding app to navigate to or notify from), re-aim `wayfinding` and
  `notifications-comms-team` the way the existing tier-01 run does (§3 of that file) — ask what the
  card *hands off* rather than report the absence of destinations it was never meant to have.
- **Output path** — default `docs/design/audit/prompt-b-<surface-slug>.md`. Regenerating for the
  same surface **overwrites** that file (git history keeps the prior snapshot) — don't create
  `-v2` variants.

## Process — run every step fresh, every time

1. **Read the full decisions ledger**, `docs/superpowers/specs/2026-07-20-decisions-ledger.md`,
   **to the end**. Rows #1–100 are a 2026-07-20 snapshot; #101+ supersedes some of them — check
   each row's date and status, not just its number, before citing it. A row you cite as LOCKED
   that was actually reversed three sections later is the exact failure this skill exists to
   prevent.

2. **Build the "Deliberate — do NOT report as defects" table.** Pull every LOCKED ledger row whose
   effect is *visibly present on the target artifact* and would read as a bug to a model holding
   only Prompt A's standards (removed radii, deleted hover rings, a colour-fill rule, a control
   smaller than the standard height, etc.). One row per item: what the auditor will see, why it's
   deliberate, cited to its ledger `#`. This table is what stops the failure Jac has flagged
   before: an auditing AI with the standards but no exemptions reports square corners and missing
   hover rings as defects.

3. **Build the "Known-open — don't re-litigate" list.** Pull every OPEN / DEFERRED / PROVISIONAL
   row relevant to the target artifact, cited to its ledger `#`, each with a one-line note on what
   NOT to re-report versus what's still fair game (e.g. "the label is known to overrun at 380px —
   report only a *consequence* we haven't already named, not the overrun itself").

4. **Inventory the target artifact itself for stubs and demo data.** Actually open/grep it — search
   for dead-end interactions ("Teleport", console-only toasts), placeholder markup
   (`placeholder`, `skeleton`, `TODO`, `stub`), and anything a design-time harness leaves inert on
   purpose. Don't guess: if something looks inert but you can't trace *why*, leave it off this list
   — it should surface as fair game (or a QUERY) in the audit itself, not get pre-excused here.

5. **Carry forward only sourced, benign console warnings.** If the artifact's own README or a code
   comment documents a known-harmless warning (e.g. the tier-01-card's two SVG template-parse
   warnings), note it in the message so it doesn't get reported as a defect. Never invent an excuse
   for a warning you haven't actually traced to its cause.

6. **Assemble the message** using Prompt A §7's required shape — surface (+ how to reach/serve it),
   persona, exemptions, deliberate choices, known-open items, dimensions to cover — following the
   section order the existing `prompt-b-tier-01-card.md` uses as the template: Surface → Persona →
   Dimensions → Deliberate (§4) → Stubs/demo data (§5) → Known-open (§6) → "What we most want to
   know" (§7) → Output instructions (§8, pointing back at Prompt A's report shape).

7. **Stamp the header.** `*Snapshot taken: <today's date>, against trunk <short commit hash>.*` Get
   the hash live — `git rev-parse --short HEAD` on the commit you're actually building against
   (say plainly if that's a feature branch rather than `trunk`, since the snapshot is only honest
   about what it was built against).

8. **Write the file**, overwriting the prior snapshot at the same output path.

## The hard constraint — repeat this, don't assume it survives implicitly

**The audit always judges against Prompt A's standards, never against this ledger.** Sections §4
(Deliberate) and §6 (Known-open) exist *only* to keep the auditing AI from re-litigating settled
ground — they are context for what to skip, not a second bar layered on top of the first. Do not
restate Prompt A's rubric, measurable rules, or report shape inside the generated file — link back
to Prompt A (run `/prompt-a`) instead. Jac needs to keep iterating on decisions without the audit
enforcing yesterday's decision back at him; a Prompt B that quietly became its own standards
document would defeat that.

## QUERY is the safety valve — thin beats wrong

When you're not sure a ledger row or a stub is current or relevant enough to assert as deliberate,
**leave it out** rather than over-claim. An under-populated Prompt B just costs the run a few extra
QUERY findings from the auditing AI (cheap — Prompt A tells it to use QUERY freely); a Prompt B
that confidently exempts something that isn't actually settled produces a confident **wrong**
finding, which costs more trust than a missed one. A thin, honest Prompt B degrades gracefully;
don't pad it to look complete.

## After generating

Hand Jac both messages ready to paste — Prompt A's file (or run `/prompt-a`), then this file, in
that order, with a reminder to wait for the auditing AI's confirmation reply between them. If the
first exchange shows the auditing AI starting to audit off Prompt A alone (skipping the wait), that
is a signal to strengthen Prompt A's own stop instruction — not something to patch here.

## Sibling

`/prompt-a` emits the paired standards message — static, one canonical copy, never restated here.
