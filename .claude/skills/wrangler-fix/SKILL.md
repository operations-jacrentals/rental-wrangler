---
name: wrangler-fix
description: How the Wrangler auto-fix engine — and Claude triaging any in-app report — judges a reported glitch or request. Ground it in the project canon (the R-Rulebook, SPEC v8, docs, and code), PROVE it right or wrong with citations, fix only what's proven, and report the proof + a refresh note back on the issue. Use whenever implementing a `wrangler-fix` issue or triaging a bug/suggestion before changing code.
---

# Wrangler Fix — prove it against the canon, then fix + report

A reported glitch or suggestion is a *claim*. Don't implement it on faith and don't
dismiss it on a hunch — **check it against the project's own canon, prove the verdict,
and let the proof drive what you do.** Jac was right about the R5b buttons because the
Rulebook said so; that's the bar.

## When to use
- The auto-fix engine implementing a `wrangler-fix` issue (the issue body is the report).
- Claude triaging any in-app report (bug or suggestion) before touching code.

## Two triggers, two starting points
- **`wrangler-fix`** (a clear bug, or a request Jac already approved) → it's a **go**:
  fix it.
- **`wrangler-request`** (a suggestion / opinion) → it's a **claim to test**: PROVE it
  first. **If you prove it correct, fix it right then — no approval needed.** Only if
  you *can't* prove it does it stay in Jac's inbox for his call.

## Do it in this order

1. **Reproduce + locate.** Find the exact code path. The report's console-error buffer
   and the element's `data-r="Rxx"` stamp usually point straight at the culprit.

2. **Ground it in the canon — BEFORE you decide.** Read the relevant parts of:
   - `CLAUDE.md` — deploy/gates, the design language, the **Don't** list;
   - the **R-Rulebook** — `RULE_META` + `CLASS_RULE` in `app.js`, and §1 of
     `JacTec-handoff/JacTec-SPEC-v8.md`;
   - the **SPEC** (`JacTec-handoff/JacTec-SPEC-v8.md`) for the system involved;
   - `docs/` (`wrangler-backlog.md` decisions, `wrangler-pipeline.md`);
   - and the actual code.

3. **Prove it right or wrong — with specific citations.** State the verdict and the
   evidence: a rule number, a SPEC section, or the code. The model to match:
   > "R5b = a blue dashed '+Thing' creates/links a record; 'No unit' **is** a link
   > action → it should be a blue add-button, not a gray R3b status pill → **the report
   > is correct.**"
   Never hand-wave. If you can't cite something, you haven't proven it.

4. **Decide from the proof:**
   - **Proven correct → fix it NOW. Proof replaces approval — do NOT wait for Jac.**
     Implement the **minimal** fix that satisfies the cited rule (match the surrounding
     code + the design language), run all 3 gates (`node ci/smoke.mjs`,
     `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`), regenerate
     `rule-usage.js` if rule usage changed, and ship. This holds even for a
     `wrangler-request` — a proven request gets fixed immediately; it does NOT sit in the
     inbox.
   - **Can't prove it (subjective, no rule backing) →** it needs Jac. If the issue is a
     `wrangler-request`, leave it as-is (it stays in his inbox) and comment what you found
     + what you'd need. If it's a `wrangler-fix`, relabel it `wrangler-request` to move it
     into the inbox.
   - **Contradicts the canon →** do NOT implement. Comment the conflict, cite the rule it
     would break + the trade-off, move it to `wrangler-request` for Jac, and stop.
   - **Ambiguous / underspecified →** ask ONE specific question in a comment; don't guess.
   - **Touches money / card / auth / WO-completion →** extra caution; never weaken those;
     flag loudly in the PR if the fix genuinely must touch them.

5. **Report back on the issue** — this comment is what reaches the user (via the
   notification bell / Mr. Wrangler), so write it in Mr. Wrangler's voice (plain,
   confident, light wrangler tone). Include:
   - the **verdict + proof** ("You're right — per R5b, those are link actions, so they
     should be blue buttons, not gray pills");
   - **what changed**, in 1–2 plain sentences;
   - and, once it ships, **"refresh the page to see it."**

6. **Ship it** the usual way: minimal PR to `main`, title `Wrangler fix: <short summary>`,
   body with the root cause + `Closes #<n>`, then `gh pr merge --auto --squash` so it
   goes live when CI is green.

## Guardrails
- One report, one targeted fix — don't refactor adjacent code.
- If the fix changes UI, run it through the design language (yard data-plate; the
  per-card stripe palette; Saira stamps; the light ranch twist) — see CLAUDE.md.
- **Proof is the gate, not Jac's tap.** If you can cite the canon to prove a report
  correct, fix it immediately — the inbox is only for the things you genuinely *cannot*
  prove and that need his judgment.
