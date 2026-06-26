# BUG: Save/Complete/Done buttons aren't blue (rendered orange "ignition" instead of blue "commit")

**Reported by Jac (verbatim):** "Save Settings buttons arent blue, and many other complete/done buttons arent either."

**Area:** design-system

**Symptom:** The rulebook says affirmative commit actions (Done/Save) are blue (`.pill.c-commit`), but the "Save settings" button and many other save/done/complete buttons render as the orange `ignition` primary instead of blue.

**Suspected code locations:**
- `app.js:9419` — Settings Board footer: `Save settings` is built as `class="pill ignition js-settings-save"` (orange), not `c-commit` (blue). This is the exact button Jac names.
- `style.css:942` — `.pill.c-commit { background: var(--blue); color:#fff }` with the comment "rule 17: Done/Save = blue". The intended blue affirmative-action style already exists.
- `style.css:1552` — `.pill.ignition { ... }` orange/Saira primary (the "ONE ignition/primary action, rule 3"). This is what those save buttons are getting instead.
- `app.js:4320` — `actionPill(kind, ...)` builds `pill c-${kind}`; calls with `'commit'` correctly produce the blue button (e.g. `app.js:5490` Complete WO, `app.js:5810` Complete Rental, `app.js:9161/9182` Save-line). The inconsistency is the foots that bypass `actionPill` and hardcode `pill ignition`.
- `app.js:9489, 9595, 9617, 9633, 9657, 9675, 9699` — more save/done buttons stamped `pill ignition` (Save account, Done, Record completion, Save card, Save ACH, Verify account) — the "many other" buttons Jac means. Contrast with `app.js:9508` which *does* use `pill c-commit` for "Save card" — so the codebase is already inconsistent between the two card popups.

**Root-cause hypothesis (hypothesis):** There's an unresolved design-language tension. The yard language reserves ONE accent — safety-orange `ignition` — for the single primary/commit action per surface (rule 3), so popup foots adopted `pill ignition` for their Save/Done. But R17's `.pill.c-commit` is defined as blue ("Done/Save = blue"), and Jac now wants save/complete/confirm actions specifically to read blue. The two conventions collide, applied inconsistently popup-by-popup. Resolution is a design call (not purely mechanical): decide that affirmative save/complete = blue `c-commit`, then sweep the hardcoded `pill ignition` save/done foots to `c-commit` (or route them through `actionPill('commit', …)`).

**Acceptance criteria:**
- [ ] "Save settings" renders blue (`c-commit`/blue), not orange.
- [ ] Save / Done / Complete / Confirm-style buttons across popups are consistently blue (no stray `pill ignition` on a save/done action).
- [ ] The orange `ignition` primary is reserved for genuinely non-commit "ignition" affordances (or a deliberate, documented exception) — decided with Jac, since it changes the "ONE orange accent" rule.
- [ ] CI gates pass (`gen-rule-usage --check`): these stay `data-r="R17"`, so the rulebook catalog shouldn't drift.

**Notes / R-rulebook impact:** All affected buttons are R17 (commit) — confirm the R17 definition in the Rulebook catalog (`app.js:4167`+, `RB_FOUNDATION`) matches the decision; `style.css:942` comment already states "rule 17: Done/Save = blue", so the spec and code disagree. This needs the `jactec-ui` skill because it changes how the single-accent rule is applied. Bump shared `?v=` on deploy.
