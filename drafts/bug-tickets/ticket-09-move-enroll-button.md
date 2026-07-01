# BUG: The "Saddle Up — Enroll" blue button is wrongly rendered inside the membership section of the customer standard view

**Reported by Jac (verbatim):** "I also noticed that the sign up enroll blue button is inside the membership section of the customer standard mode. This is incorrect. Signing up a customer should be done from the add card, selfie, and agreement window."

**Area:** memberships

**Symptom:** The enroll/signup blue button appears inside the Membership section of the customer standard-mode detail view; signup belongs to the onboarding (card/selfie/agreement) window, not the membership section.

**Suspected code locations:**
- `app.js:3264` — `const enrollBtn = (!isMem && mayMoney) ? actionPill('commit', status === 'Incomplete' ? 'Complete Enrollment' : 'Saddle Up — Enroll', { js: 'js-mem-enroll', ... })` inside `membershipSectionHtml(c)`. This is the offending button.
- `app.js:3268-3277` — `const actions = [enrollBtn, cancelBtn, payCxlBtn, printBtn]...` then the section markup `<div class="section"><h4>Membership</h4>...${actions...}</div>` that renders it into the membership section.
- `app.js:11873` — the click handler `if (closest('.js-mem-enroll')) { ... return openMembershipEnroll(...) }` (event tree); and `app.js:3298-3301` `openMembershipEnroll` which opens the `membershipEnroll` overlay.
- `app.js:6276`+ (`APP-16` detail renderers) — where `membershipSectionHtml` is invoked into the customer standard-view body (the "Account"/sections stack around `app.js:6085-6110`).

**Root-cause hypothesis (hypothesis):** `membershipSectionHtml` conflates membership *lifecycle management* (Cancel, Pay Cancellation, Print Agreement — correct to keep) with *signup/enrollment* (the enroll button — wrong here). The enroll affordance should be removed/relocated so customer signup is initiated only from the card+selfie+agreement onboarding window, leaving the membership section to manage an already-enrolled member.

**Acceptance criteria:**
- [ ] The "Saddle Up — Enroll" / "Complete Enrollment" blue button no longer renders inside the customer standard-mode Membership section.
- [ ] Enrollment/signup is reachable from the onboarding (card/selfie/agreement) window instead.
- [ ] Cancel / Pay Cancellation / Print Agreement membership-lifecycle actions remain unaffected.
- [ ] The `canMoney()` Office/Admin gate on enrollment is preserved wherever the button relocates (`app.js:11873`).

**Notes:** Money-gated action (Office/Admin via `canMoney()`); keep the gate intact when relocating — do not weaken auth. `membershipEnroll` is catalogued in `WINDOW_CATALOG` (`app.js:9803`); the overlay itself isn't being removed, only its launch button moves, so the catalog likely stays. Overlaps BUG 8 / BUG 10 (the onboarding-window convergence). jactec-ui: `actionPill('commit', ...)` is the blue commit pill — any new placement runs through `/jactec-ui`.
