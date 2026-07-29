---
name: prompt-a
description: >-
  Surfaces the STATIC standards-brief message — the first half of the two-message audit handoff
  used to hand a Rental Wrangler design prototype (a Tier-0.x card, a Design Labs mockup) to an
  outside model (Codex, a fresh Claude session, etc.) for a usability + design pass. This message
  is the fixed bar — the eight standing questions, the measurable rules (control heights, type
  ramp, contrast floors, CVD separation, the 60-30-10 budget, the Signal/Gate/Stamp/Ref/Door
  archetypes) — and it does not change between runs. One canonical copy lives at
  `docs/design/audit/prompt-a-standards.md`; this skill never restates or duplicates it inline —
  a duplicate is how the bar quietly forks from what the file says. Use when Jac wants to run or
  re-run the audit prompt pair, asks for "prompt A" / "the standards message", or is about to hand
  a prototype to an external model for review. Always paired with `/prompt-b`, which generates the
  second, task-specific message.
---

# /prompt-a — the standards brief (static)

Prompt A is the half of the two-message audit handoff that **doesn't move**. It sets the bar an
outside model judges a design prototype against: the eight standing questions, the measurable
rules, the report shape, and the honesty rails. It never names a colour, a typeface, or a
component design — it judges *structure*, so it stays valid no matter how the redesign's actual
decisions keep changing underneath it.

## What this skill does

1. **Read `docs/design/audit/prompt-a-standards.md` fresh, right now.** Don't answer from memory
   or from a cached copy in this conversation — if Jac or a prior session edited that file, an
   inline recollection would silently serve the stale bar.
2. **Output everything below its `---` divider, verbatim**, as the block Jac pastes into the
   auditing AI as the *first* message. Don't summarize it, don't reorder it, don't "helpfully"
   annotate it — the file is beat for beat what the auditing AI needs to read.
3. Remind Jac of the sequencing this message itself states: **send this first, wait for the
   auditing AI's confirmation reply, then send Prompt B** (run `/prompt-b` to generate it fresh).

## The one hard rule this skill exists to protect

**The standards live in exactly one place** — `docs/design/audit/prompt-a-standards.md` — **with
two delivery paths**: pasting the file directly, or invoking this skill. Both paths must produce
the identical text. Never copy the rubric, the measurable rules, or the report shape into this
`SKILL.md`, into `/prompt-b`, or into any other skill (`/lazy-audit` included) — a second copy is
how the bar drifts out of sync with itself, and nobody notices until two audits disagree about
what "consistent" means.

If a decision needs to change what counts as a violation, that's an edit to
`docs/design/audit/prompt-a-standards.md` itself, made deliberately, not a local override
anywhere else.

## The failure mode to watch for

Prompt A ends by telling the auditing AI to **reply only with a short confirmation** and wait for
Prompt B before starting. Watch the first exchange of every run for the AI skipping that and
auditing off Prompt A alone — it has the standards but none of the exemptions, so it will report
things like the missing hover rings or the square corners (both deliberate, both in Prompt B's
exemption table) as defects.

**If that happens, the fix is a stronger stop instruction in `prompt-a-standards.md`** (its §0 or
its closing confirmation line), not a workaround added to Prompt B or to this skill. Prompt B
supplies context; it cannot be made to compensate for Prompt A being ignored.

## Sibling

`/prompt-b` generates the paired task message — surface, persona, exemptions, and known-open
items, rebuilt fresh from the decisions ledger every run.
