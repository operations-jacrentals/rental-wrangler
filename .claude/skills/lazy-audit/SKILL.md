---
name: lazy-audit
description: >-
  Persona-driven, source-grounded UX audit of a Rental Wrangler card or surface — walk it as a
  lazy, not-very-smart embodiment of a real role ("Denny" the dispatcher on the RENTALS card by
  default) to expose where the UI fails to say what to do next, buries the real emergency under
  noise, glitches, drifts out of consistency, strands navigation, computes the wrong number, or
  lacks the alerts/comms/notifications the role needs. Reach for this WHENEVER Jac wants to
  audit / review / critique / "walk through" the usability of any card, screen, popup, or flow
  (RENTALS, Units, Invoices, Customers, Calendar, Settings, the Wrangler inbox…) through the eyes
  of a specific role — phrasings like "audit the X card as a dispatcher", "do a Denny audit on
  Units", "walk the invoices card as an AR clerk", "how easy is X to use / what's confusing /
  what's missing / what would trip someone up", "is this obvious enough for a tired shop hand",
  or an explicit /lazy-audit. It fans out lens-agents, ADVERSARIALLY VERIFIES every finding
  against the byte-identical-to-production code, hunts the flows the lenses missed, and delivers a
  yard-data-plate artifact plus a summary. NOT for building/restyling UI (that's /jactec-ui), and
  NOT for triaging a single specific "X is broken" report (that's wrangler-fix) — this is a broad,
  role-lens usability sweep of a whole surface.
---

# /lazy-audit — the "Denny" persona audit

A usability audit that judges a surface the way its **weakest realistic user** would — not an
expert who already knows the shortcuts, but a **lazy, not-very-smart person doing that job**. The
premise: if the UI holds up for someone who won't scroll, won't read, won't infer, and won't hunt
for a hidden gesture, it holds up for everyone. Where it fails *them*, it's failing quietly for
everyone else too.

Three things make the verdict trustworthy instead of vibes:

1. **A persona engine** — a named character with a real role and real limits. The persona is the
   forcing function: every screen has to *prove* it spells out the next move, or the persona
   freezes. This surfaces problems an expert reviewer glazes past.
2. **Source-grounded** — every claim is cited to a live `file:line`, and the audited code is
   confirmed **byte-for-byte identical to production** first, so findings describe what the
   dispatcher's browser *actually runs*, not a stale working tree.
3. **Adversarially verified** — findings are handed to independent skeptics who try to *refute*
   them against the code, and to completeness critics who hunt what every lens missed. This is not
   ceremony: on the first run it flipped a centerpiece finding to REFUTED, corrected a "this is
   missing" claim that was actually built on the backend, and demoted several overstated
   severities. Ship the *verified* set, not the raw set.

The output is a **show-don't-describe artifact** (a mock of the real card with problems pinned to
it, and a "should-be" beside it), not a wall of prose — because a dispatcher problem is a *visual*
problem.

---

## Step 0 — Scope: pick the surface and the persona

**Surface.** One card/screen/flow. Default: the **RENTALS card**. If Jac names another (Units,
Invoices, Customers, Calendar/Trips, Settings…), audit that instead.

**Persona.** A lazy, not-sharp embodiment of the role that *lives* in that surface. Default is
**"Denny" the dispatcher** for RENTALS. Match the persona to whoever actually uses the surface:

| Surface | Persona (lazy + not-sharp version of…) | What they care about |
|---|---|---|
| Rentals / Calendar / Trips | **Denny**, the dispatcher | what's next, what's on fire, who has which truck |
| Units / Shop | **Merle**, the yard/shop hand | is it ready, what's broken, what's due for service |
| Invoices / payments | **Pat**, the front-office / AR clerk | who owes, did it go through, is it signed |
| Customers | **Robin**, the counter/sales rep | is this a lead or a live account, can they rent |
| Settings / admin | **Sam**, the owner-operator | did my change stick, what did it break |
| Customer-facing (agreement, portal) | **Casey**, the actual renter on a phone | sign it, pay it, done |

Keep the traits constant: **lazy** (does the least; won't scroll/read/hunt/right-click),
**not sharp** (won't infer; needs the screen to spell out the next move; misreads ambiguous cues),
**clock-watching**, **distracted by anything that blinks**. Give them a name and a one-paragraph
bio — the audit is written in their voice, so they need to feel like a person.

**The rubric — the persona's questions.** Every lens answers a slice of these (they are Jac's
standing audit questions):

- Do I know **what to do, and what's next**? Is the next action spelled out, or just data?
- What deserves my attention — **what's an emergency**? And does **non-urgent noise steal it**?
- How **glitchy / jumpy** is it? Do things move/flash/vanish under my finger?
- Is the UI **consistent** — does the habit I formed on one card transfer to this one?
- Do I know **what links to what** and **how to get there and back**?
- Do the **systems actually work, and are the numbers accurate**?
- **What's missing?**
- What **notifications / alerts / comms / team** signals are lacking?

---

## Step 1 — Make it faithful (audit production, not a stale tree)

The whole method rests on auditing what the user *actually runs*. Before anything else:

```
git fetch origin production --quiet
git diff --stat origin/production...HEAD -- app.js style.css config.js index.html
grep -o 'app.js?v=[0-9a-z]*' index.html                 # working-tree cache token
git show origin/production:index.html | grep -o 'app.js?v=[0-9a-z]*'   # production token
```

If the served files show **no diff** and the tokens match, say so plainly — "byte-for-byte
identical to production (`?vXXXX`)" — and that guarantee is what lets every finding stand as a
real production claim. If they *differ*, either audit `origin/production`'s bytes directly, or
scope the audit to the working tree and state the caveat loudly.

**Why not just drive the live site?** From a cloud session you can't: headless Chromium can't reach
`github.io` through the agent proxy, and the live login is SMS-gated (per-person `phoneIdentity`).
So a **source-grounded cognitive walkthrough is the faithful substitute**, not a downgrade — you're
reading the exact code that renders the screen. If Jac wants a *live* drive too, that needs his
connected Claude-in-Chrome (his real browser); offer it, don't fake it.

Use the Code Atlas (`docs/CODE-MAP.md`, `grep APP-NN`) to find the surface's builders, rows,
columns, detail renderer, actions, flags, and comms — hand those anchors to the lens-agents so they
don't grep 25k lines blind.

---

## Step 2 — Fan out the lenses (background Sonnet agents)

Spawn one agent per lens, **in parallel, in the background**, each a persona walkthrough of one
dimension. These are well-scoped code-tracing passes against a settled target → **Sonnet** is the
right tier; keep the synthesis + judgment on the main (Opus) thread. Tell Jac in one line which
agents + model you launched.

**Shared persona brief** (paste into every lens prompt): the character + traits from Step 0, the
byte-identical-to-production guarantee ("what you read is EXACTLY what the live user runs — cite
`file:line`"), and **"do NOT change any code — this is a read-and-reason audit."**

**The six canonical lenses:**

| Lens | The persona's question it owns | Where it looks (Rentals example — remap per surface) |
|---|---|---|
| **task-clarity** | what do I do / what's next? | rows (APP-14), columns (APP-15), detail (APP-16), actions (APP-33), status pills |
| **emergency-triage** | what's on fire / does noise steal my eye? | flag→color engine (APP-11), `FLAG_META`/`FLAG_SEVERITY_RANK`, statuses, alert/pulse flags |
| **wayfinding** | what links to what / how do I get around? | cascade.js, drag-link (APP-32), refPills (APP-10), 3-col layout (APP-18), back/jog |
| **correctness** | do the systems work / are they accurate? | derivations (APP-04/05), actions + persistence (APP-33), save/sync (APP-37), toasts |
| **notifications-comms-team** | what alerts/comms/team are lacking? | comms rail (APP-39), team dock (APP-22), toast (APP-30), sw.js, wrangler inbox, poll |
| **glitch-consistency** | how jumpy / is it consistent? | render pipeline (APP-30), scrollMemo/restore, always-on animations, cross-card diff |

**The fixed report shape** each lens returns (so synthesis is clean) — require exactly this:

```
### <Lens> — as <Persona> sees it
**Verdict:** one blunt line.
**Walkthrough:** 4–6 concrete beats of the persona trying to act, where they stall/guess wrong.
**Findings:** ranked worst-first. Each = `SEVERITY | one-line problem | file:line | why it hurts <persona> | smallest fix`.
                SEVERITY ∈ 🔴 (blocks/misleads) / 🟠 (friction) / 🟡 (polish). Mark provable-from-code vs would-need-a-live-drive.
**What's missing:** bullets — affordances that SHOULD exist for this dimension but don't.
```

Ask lenses to separate **"provably broken in code"** from **"looks risky / needs a live drive"** —
that honesty is what makes the verify pass tractable.

---

## Step 3 — Verify the findings + hunt the gaps (Workflow)

Do **not** ship the raw lens output. Run `scripts/verify-findings.template.mjs` (a Workflow):

- **Adversarial verifiers** — one independent Sonnet skeptic per actionable finding, prompted to
  *refute* it by reading the cited `file:line` + context; returns
  `CONFIRMED / PARTIAL / REFUTED`, `isRealBug` (code defect vs UX/design gap vs opinion), a
  dispatcher-severity, the evidence it actually saw, a correction if partial/refuted, and the
  smallest fix. Default to skepticism.
- **Completeness critics** — one or two agents that read the surface fresh and ask *"what whole
  flow did every lens miss?"* and *"do any findings contradict each other or the code?"* On the
  RENTALS run this is where the biggest issues surfaced (multi-driver dispatch coordination being
  unreachable; drivers double-bookable with no warning; a field-delivery capture silently
  discarded when the booking gate blocks) — the lenses were each too zoomed-in to see them.

**GOTCHA that will bite you:** pass the findings **embedded as a `const` in the workflow script**,
not through the Workflow `args` field. On the first run, args arrived empty and the verify pipeline
silently spawned **zero** agents (`verified: []`) while the gap critics ran fine. Embed the claims;
`agent_count` in the completion notification tells you how many actually ran — if it's smaller than
your claim count, the pipeline got an empty list.

Then **fold the verdicts back in**: drop REFUTED findings, soften PARTIAL ones to their true
scope, re-rank by the *verified* severity, and promote the completeness-critic finds into the
report. The corrections are the point — they're what separate this from a confident-but-wrong LLM
review.

---

## Step 4 — Deliver: the artifact + a summary

**Artifact** (load the `artifact-design` skill first, as its tool requires). Build it in the house
**yard data-plate** language — reuse the `<style>` block in `assets/audit-report.template.html`
**verbatim** (it's the tokenized, theme-aware, on-brand design system: dark steel, one
safety-orange accent, hazard-stripe, stamped condensed labels, rivets, RYG severity kept *separate*
from the accent) and re-author only the body for this audit. Structure:

1. **Riveted masthead** — "The <surface>, as <persona> sees it" + the faithfulness/verification chips.
2. **Persona ID badge** — the character + the 3 things they need.
3. **The centerpiece: "As it ships" vs "Should-be"** — a *faithful mock* of the real card (built
   from the code, since you can't screenshot the SMS-gated live app), problems pinned with numbered
   markers, and the same data re-stacked to fix them beside it. Tie problem→fix by number.
4. **Report card** — findings grouped by the persona's questions, severity-tagged, cited. Mark
   verify verdicts (✓ confirmed / ≈ partial / �added-by-critic).
5. **"The silent yard" placard** — the missing alerts/comms/team.
6. **If you fix N things** — ranked by help-per-hour, smallest-contained-change first.

Redeploy the **same file path** to update the same artifact URL as verification lands — don't mint
a new one.

**Honesty rails (non-negotiable):**
- The card mock is a **reconstruction, not a screenshot** — say so; the live login can't be driven
  from here.
- **Illustrative names only.** The live DB holds real customer PII — never render, commit, or paste
  a real record into the artifact, the repo, or the summary. Keep specific app-weakness findings in
  the (private) artifact + chat, **not** in committed skill/repo files (this repo is public).

**Summary** in chat: the headline findings grouped by Jac's questions, the verified bugs vs the
design gaps vs the missing capabilities, and a clear "top 5 to fix." Lead with the emergency-blind
and the confirmed correctness bugs — those are what actually hurt.

---

## Why the method works (keep these instincts, not the letter)

- **The lazy + not-sharp persona is the engine.** Drop it and you get an expert review that
  forgives everything a real tired dispatcher won't. Keep the character vivid and in-voice.
- **Faithfulness first.** A cited `file:line` on stale code is a confident lie. Prove
  byte-identity to production before you believe your own findings.
- **Verify adversarially or don't ship it.** LLM reviews are plausible-but-wrong at a scary rate;
  the refute-pass is cheap and it *will* catch centerpiece errors. The first run REFUTED one and
  corrected several — that's the value, not the ceremony.
- **The completeness critic earns its keep.** Per-lens focus is exactly what makes each lens blind
  to a whole missing flow. Always ask "what did all of you miss?"
- **Show, don't describe.** A pinned mock of the real card lands harder than any list. The artifact
  is the deliverable.

## Shipping this audit's output

An audit is a report, not a code change — the **artifact is private on claude.ai** and the summary
lives in chat. If the audit spawns fixes (it usually does — the RENTALS run found real bugs), those
are *separate* feature branches through the normal `/build → /deploy → /merge → /promote` flow,
each `wrangler-fix`-verified. Don't bundle fixes into the audit itself.
