# Parked follow-ups — ship-flow session (2026-07-13)

Deferred from the session that shipped the mobile Back/Forward jog chip (#610), the
staging-drift guardrails (#613), and the flow-aware gate skills (#614). Two threads worth
doing later; neither blocks anything live.

## 1. Dead-code cleanup — §M7 mobile fossils in `app.js`

The §M7 phone scroll-snap refactor (2026-07-12) left orphaned code behind:

- `renderResults()`'s phone branch (the old single-active-column + bottom-dock re-home) is
  **unreachable** — `renderResults()` returns early on phone (`if (is-phone) { render(); return; }`)
  *before* that block, so it never runs.
- Inside that dead block, `mobileDockEl()` is **called but no longer defined** anywhere — it
  would throw `ReferenceError` if the path were ever reached.
- The `.mobile-dock` CSS rule is unused on the live path (only that dead `querySelector` refers to it).

Harmless (dead) but confusing — these fossils misled the jog root-cause hunt this session.

**To do:** delete the unreachable `renderResults()` phone block + the `mobileDockEl` reference +
the dead `.mobile-dock` CSS. Confirm nothing live references them (`grep -n mobileDockEl app.js`,
`grep -n 'mobile-dock' app.js style.css`), run the gates, and render the phone view to confirm no
regression.

## 2. Promote-gate token wrinkle — exact `?v=` match vs content

`tools/promote.mjs`'s staging-freshness gate compares staging's live `app.js?v=` token to the
trunk commit's token, requiring an **exact match**. In the normal flow (deploy the feature branch
→ the `?v=` bump is committed → merge → promote) staging and trunk share the token, so it passes.

But if you ever need to **re-deploy trunk to staging AFTER a merge** (e.g. staging drifted, as it
did this session when the deploy PAT died), `deploy-staging.mjs` bumps the token again → staging's
token diverges from trunk's → the gate can't be satisfied without landing that new bump back on
trunk (an extra token-only PR) or using `--skip-staging-check`.

**To consider:** make the freshness check compare **content** (e.g. a hash of the served
`app.js`/`style.css` bytes, or the committed source) rather than the exact `?v=` token, so a
post-merge re-deploy that serves identical content passes cleanly. Weigh against the simplicity and
transparency of the current token comparison — the token is a single, human-readable marker.
