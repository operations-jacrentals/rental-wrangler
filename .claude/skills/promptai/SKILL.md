---
name: promptai
description: >-
  Write a well-formed prompt for Jac to hand to ANOTHER AI — a fresh Claude session, Codex,
  ChatGPT, Gemini, or anything else — about whatever he names: a question to ask it, a task to
  hand it, a topic to have it explore. General-purpose prompt-writing, not tied to any one
  workflow. Reach for this on "write me a prompt for X", "draft a prompt to ask [AI] about Y",
  "help me prompt [platform] to do Z", "I need to hand this to Codex/ChatGPT/Gemini — write the
  prompt", or an explicit /promptai. NOT for the design-prototype audit handoff — that fixed,
  recurring two-message pair is `/prompt-a` + `/prompt-b`; if what Jac wants is actually that
  shape (standards message + task message for auditing a Tier-0.x card or mockup), redirect to
  those instead of freelancing a substitute here.
---

# /promptai — write a prompt for another AI

A general prompt-writing assistant. Jac names a topic, a task, or something he wants explored,
and names (or implies) which AI he's about to hand it to — this skill turns that into a
well-structured prompt ready to paste there.

## Step 0 — is this actually the audit handoff?

If what Jac's describing is the design-prototype audit pair — a standards message + a
task/exemptions message for handing a Tier-0.x card or Labs mockup to an outside model — stop and
point at `/prompt-a` + `/prompt-b` instead. Don't hand-roll a substitute; that's exactly the kind
of duplicate that forks the bar (see `/prompt-a`'s hard rule). Everything else below is for
one-off or occasional prompts outside that fixed shape.

## Step 1 — figure out what's actually known vs missing

From what Jac says, identify:

- **The goal type** — answer a question, complete/build a task, or open-ended exploration/research.
  These want different shapes (a question wants a direct ask + constraints; a task wants scope +
  done-criteria; exploration wants a starting angle + what "useful" looks like, not a rigid
  spec).
- **The target AI/platform**, if named or obviously implied (a coding task reads differently for
  Codex than a research question reads for a general chat model).
- **Depth/format** — quick answer vs thorough, prose vs structured, any length or output-format
  constraint.
- **Hard constraints** — anything the destination AI must or must not do, must know going in, or
  should be blocked from touching.

**If any of these is genuinely unclear and would change what you'd write, ask — once, via the
popup, batched, with your own recommendation on each (this project's standing interaction rule).
If that one popup fails, fall back to the same questions inline as lettered choices.** If Jac's
ask is already unambiguous (platform named, goal clear, scope clear), skip the popup and draft
directly — don't manufacture a question just to ask one.

## Step 2 — pull repo context only when the topic is actually about this repo

If the topic is clearly about Rental Wrangler itself — a feature, a bug, a design decision, a
piece of the codebase — go get the grounding facts the destination AI will need, the same
drift-avoidance instinct `/prompt-b` uses for the audit:

- Check the decisions ledger (`docs/superpowers/specs/2026-07-20-decisions-ledger.md`, **read to
  the end** — #101+ supersedes parts of the #1-100 snapshot) for anything already settled that the
  prompt would otherwise contradict or need to re-derive.
- Use the Code Atlas (`docs/CODE-MAP.md`, `grep APP-NN`) to point at the right file/chapter
  instead of making the destination AI grep blind.
- Pull in only what's load-bearing for THIS prompt — cite it, don't dump it. A prompt bloated with
  every tangentially-related fact is worse than a lean one; the destination AI still has to read
  the actual code/docs itself for anything genuinely deep.

**If the topic has nothing to do with this repo** (general research, a question about an
unrelated tool, brainstorming for its own sake), skip this step entirely — don't force Rental
Wrangler framing or repo boilerplate into a prompt about something else.

## Step 3 — draft the prompt

Shape it to the goal type identified in Step 1:

- **A question to ask** — state it directly up front, give only the context needed to answer it
  correctly, name any constraint on the answer (length, format, must/must-not cover).
- **A task to complete** — state the deliverable, the scope (what's in/out), any done-criteria or
  acceptance check, and constraints the destination AI must respect (don't touch X, must use Y).
- **Something to explore** — name the starting angle and what "useful" looks like, but don't
  over-specify the path; exploration wants room, not a rigid spec pretending to be open-ended.

Keep it as short as it can be while still being unambiguous — no boilerplate that doesn't earn
its place, no re-explaining things the destination AI doesn't need. If the destination AI will
have its own access to the repo (like Codex cloning it for the audit runs), say what it should
go verify itself rather than restating file contents; if it won't, include what it actually
needs.

## Step 4 — output

Print the finished prompt in chat, in a fenced code block, ready to copy-paste. Only **also**
write it to a file (session-output folder) when it's long or clearly meant to be reused/handed
off more than once — a short one-off stays chat-only.

Don't add a header, a signature, or meta-commentary INSIDE the prompt block itself unless Jac
asked for one — the block is exactly what gets pasted elsewhere, so anything in it should be
addressed to the destination AI, not to Jac.
