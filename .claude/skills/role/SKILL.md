---
name: role
description: Audit a feature spec, design, or screen through all 15 Jac Rentals role lenses + a 12-step authority / data-sensitivity / gate checklist. Use right after generating or reviewing a SPEC, a new feature, a new screen, or a permissions change — to catch role gaps, margin/PII leaks, missing gates, and broken audit trails BEFORE building. Invoke with /role (optionally /role <path-to-spec>).
---

# /role — Role-Lens Spec Audit

Reviews a spec/design against the real Jac Rentals org: 15 roles (Dispatcher → Customer/Contractor) and a cross-role authority + data-sensitivity framework grounded in the actual Rental Wrangler app. Catches the leaks and gaps that a single-perspective spec misses.

## When to run
- Right after a SPEC doc is generated, or before building a new feature/screen.
- After any change to permissions, pricing visibility, customer-facing surfaces, or status/gate logic.
- Anytime the user types `/role` (with no spec named, audit the most recently generated spec or the feature under discussion).

## Inputs
- **Target:** the spec/feature to audit. If the user passed a path (`/role docs/spec-x.md`), read it. Otherwise use the most recent spec doc generated this session, or the feature currently under discussion — if genuinely ambiguous, ask which.
- **Reference (always load before auditing):**
  - `references/framework.md` — authority hierarchy, the 9-tier data-sensitivity matrix, shared views, cross-role conflicts, design principles, and the 12-step checklist.
  - `references/roles.md` — the 15 role cards with each role's `spec_audit_questions` (the crown jewel).
  - `references/research-raw.local.json` — full source research (gitignored, local-only; not present in cloud sessions). Do NOT load by default (it's large); consult only when a card lacks the depth a specific question needs.

## Steps
1. **Read** `references/framework.md` and `references/roles.md`. (Token note: these two are enough — do not pull `research-raw.json` unless a specific gap requires it.)
2. **Run the 12-step checklist** from `framework.md` against the target spec, in order. Steps 3 (data-sensitivity) and 4 (customer isolation) are HARD-FAIL gates — a violation there is a blocker, not a suggestion.
3. **For every role flagged in step 1**, run that role's `spec_audit_questions` from `roles.md` and record pass / fail / gap for each.
4. **Output the report** (below). Lead with blockers. Be specific and cite the role + the exact field/flow — never generic.

## Output format
```
# /role audit — <spec name>

## Roles touched
<primary actor(s)> · <incidental readers> — one line each on their lens

## 🔴 Blockers (HARD-FAIL)
- <data-sensitivity / isolation / authority violation> — role, field, why, fix

## 🟡 Gaps
- <missing gate / audit trail / cascade / mobile / KPI issue> — role, why, fix

## Per-role audit questions
**<Role>** — ✅/❌/⚠️ per question, one line each

## ✅ Clears
- <what the spec already handles well>

## Recommended fixes (ordered)
1. <concrete change>
```

## Rules
- **Silence = pass.** If a role has no issue, don't pad the report — list it under Clears in one line.
- **Margin floors are radioactive** (Bottom Dollar, True Cost, ROI, part cost): any appearance on a Sales-shared or customer-facing surface is an automatic 🔴.
- **Customer isolation and gates are server-side concerns** — "the UI hides it" is never an acceptable answer; flag it.
- Keep it tight and actionable. This skill is a scalpel, not an essay — the user reads blockers first and wants the fix, not a lecture.
- This audit does not write code or change the spec; it produces findings. Offer to apply fixes only after presenting them.
