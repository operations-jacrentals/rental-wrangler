---
name: wrangler-fix
description: How the Wrangler auto-fix engine — and Claude triaging ANY "it's broken / not working" report (an in-app wrangler-fix/wrangler-request issue OR Jac just saying it in-session) — judges a reported glitch or request. Ground it in the project canon (the R-Rulebook, SPEC v8, docs, and code), trace the symptom UP to its root cause, prove the verdict with citations, fix only the proven cause, then re-reproduce and report the proof + a refresh note. Use whenever anything is reported broken before changing code.
---

# Wrangler Fix — prove it against the canon, fix the root cause, then report

A reported glitch or suggestion is a *claim*. Don't implement it on faith and don't
dismiss it on a hunch — **check it against the project's own canon, trace it to the real
cause, prove the verdict, and let the proof drive what you do.** The reporter was right
about the R5b buttons because the Rulebook said so; that's the bar.

**Two gates, same spirit:** prove the *cause* before you edit, and prove the report
*correct* before you ship. Patching where the symptom shows — not where the bad value was
born — just masks the defect. **No fix without a cited root cause.**

## When to use
- The auto-fix engine implementing a `wrangler-fix` issue (the issue body is the report).
- Claude triaging any in-app report (bug or suggestion) before touching code.
- **Any time Jac reports something "isn't working" / "is broken" in-session** — not just
  in-app issues. The prove-against-canon + root-cause loop runs first, every time.

## Root-cause discipline (before you touch code)
- **Quit guessing and look.** Observe the actual failing values — the report's
  console-error buffer, the element's `data-r="Rxx"` stamp, the real data flow — not what
  you assume the code does.
- **TRACE UP.** Symptom → immediate cause → "what called this?" → keep climbing the call
  chain → land on the **original trigger**. Never fix where the error appears when the
  cause is upstream; that just moves the symptom.
- **The tell you've slipped into guessing:** "let me just try X and see," or "I don't
  fully get it but this might work." Stop — go back and trace.
- **Rule of three:** three failed fixes means the mental model is wrong, not the detail —
  re-enter step 1 with fresh evidence (or escalate); don't swing a fourth time.

## Two triggers, two starting points
- **`wrangler-fix`** (a clear bug, or a request the developer already approved) → a **go**:
  fix it — still trace the root cause first.
- **`wrangler-request`** (a suggestion / opinion) → a **claim to test**: PROVE it first.
  **Prove it correct and you fix it right then — no approval needed.** Only what you
  *can't* prove stays in the developer's inbox for their call.

## Do it in this order

1. **Reproduce + locate.** Bracket the bug: make it fail on demand first. Find the exact
   code path — the console-error buffer and the `data-r="Rxx"` stamp usually point straight
   at the culprit. Then **trace up** from that symptom to where the data first went wrong
   (see Root-cause discipline). No reliable repro → you can't localize it or prove a fix.

2. **Ground it in the canon — BEFORE you decide.** Read the relevant parts of:
   - `CLAUDE.md` — deploy/gates, the design language, the **Don't** list;
   - the **R-Rulebook** — `RULE_META` + `CLASS_RULE` in `app.js`, and §1 of
     `JacTec-handoff/JacTec-SPEC-v8.md`;
   - the **SPEC** (`JacTec-handoff/JacTec-SPEC-v8.md`) for the system involved;
   - `docs/` (`wrangler-backlog.md` decisions, `wrangler-pipeline.md`);
   - and the actual code.

3. **Prove it right or wrong — with specific citations, naming the root cause.** State the
   verdict, the evidence, AND where the defect originates: a rule number, a SPEC section, or
   the line where the value first goes bad. The model to match:
   > "R5b = a blue dashed '+Thing' creates/links a record; 'No unit' **is** a link
   > action → it should be a blue add-button, not a gray R3b status pill → **the report
   > is correct.**"
   Never hand-wave. If you can't cite the rule *or* point to the originating cause, you
   haven't proven it. **"Reproduced" is not "understood"** — a green result after a guessy
   edit can still leave the cause live.

4. **Pattern pass — does this bug have relatives?** Turn the named cause into a searchable
   signature (the bad idiom, the missing guard, the wrong builder) and `Grep` the tree for
   siblings of the same class. Compare the broken path against a known-good sibling and note
   what differs. Sweep the pattern in this one fix rather than rediscovering it as a "new"
   bug next week — but match on the *confirmed* cause, not a superficial text look-alike.

5. **Decide from the proof:**
   - **Proven correct → fix it NOW at the root cause. Proof replaces approval — do NOT wait
     for the developer.** Implement the **minimal** fix that satisfies the cited rule and
     kills the originating cause (match the surrounding code + the design language). Holds
     even for a `wrangler-request` — a proven request gets fixed immediately, NOT shelved.
   - **Can't prove it (subjective, no rule backing) →** it needs the developer. A
     `wrangler-request` stays as-is in their inbox; comment what you found + what you'd need.
     A `wrangler-fix` → relabel `wrangler-request` to move it into the inbox.
   - **Contradicts the canon →** do NOT implement. Comment the conflict, cite the rule it
     would break + the trade-off, move it to `wrangler-request`, and stop.
   - **Ambiguous / underspecified →** ask ONE specific question in a comment; don't guess.
   - **Touches money / card / auth / WO-completion →** extra caution; never weaken those;
     flag loudly in the PR if the fix genuinely must touch them.
   - **Three failed fixes → STOP** (rule of three) — re-investigate or escalate.

6. **Validate by re-reproducing.** Re-run the exact failing case: confirm it **failed
   before, passes after** — that bracket is the only proof the change (not coincidence)
   fixed it. Then run all 3 gates (`node ci/smoke.mjs`, `node ci/logic-test.mjs`,
   `node ci/gen-rule-usage.mjs --check`), regenerate `rule-usage.js` if rule usage changed,
   confirm any sibling fixes from step 4 hold, and remove any temporary probes you added.

7. **Report back on the issue** — this comment reaches the user (via the notification bell /
   Mr. Wrangler), so write it in Mr. Wrangler's voice (plain, confident, light wrangler
   tone). Include:
   - the **verdict + proof** ("You're right — per R5b, those are link actions, so they
     should be blue buttons, not gray pills");
   - **what changed**, in 1–2 plain sentences (the root cause, not just the symptom);
   - and, once it ships, **"refresh the page to see it."**

8. **Ship it** the usual way: minimal PR to `main`, title `Wrangler fix: <short summary>`,
   body with the root cause + `Closes #<n>`, then `gh pr merge --auto --squash` so it
   goes live when CI is green.

## Guardrails
- **Ask yourself first: "Should I use one of our skills for this?"** Reach for the fitting
  skill before you freehand — `jactec-ui` for ANY UI element (screen, column, card, pill,
  flag, button, field, popup, menu), the `mobile-*` skills for phone layout/touch/viewport,
  `frontend` for new visual design, `webapp-testing` to verify in a real browser. Skip only
  when none genuinely apply.
- **No fix without a cited root cause** — trace up to the origin before you edit, never guess.
- One report, one targeted fix at the cause — don't refactor adjacent code (a proven pattern
  sweep of the *same* bug class is the one allowed exception; scope creep is not).
- If the fix changes UI, run it through the design language (yard data-plate; the
  per-card stripe palette; Saira stamps; the light ranch twist) — see CLAUDE.md.
- **Proof is the gate, not the developer's tap.** Cite the canon to prove a report correct
  and fix it immediately — the inbox is only for what you genuinely *cannot* prove.

## /start hook
This bullet lives in the `/start` working-rules list so every session routes broken-reports
here first:
> **Something reported broken → `wrangler-fix` first.** Anything reported not-working or
> broken — an in-app `wrangler-fix`/`wrangler-request` issue OR Jac just saying it
> in-session — runs through the `wrangler-fix` skill before any code change: prove the claim
> against the canon (R-Rulebook, SPEC v8, docs, code) with citations, trace the symptom UP
> to its root cause, sweep for sibling bugs of the same class, fix only what's proven at the
> cause, then re-reproduce to confirm it failed-before/passes-after. No fix without a cited
> root cause.
