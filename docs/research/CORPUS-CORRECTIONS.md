# Corpus corrections & retractions — the detail-audit wave

**2026-07-19.** The four detail-view audits (and their v2 persona-seat passes) corrected the
existing corpus in ways a reader must honor. Retractions are load-bearing here exactly as they were
in round one: a resurrected wrong claim costs more than a missing one.

## Retract from the existing 171-finding inventory

- **Finding #130 — "Clicking a unit's own name does not open its detail record" — FALSE at
  `0fac0069`. RETRACT.** Left-click resolves at `app.js:19525-19539` with no `.r-title` exclusion
  and calls `openStandard()`; the `.r-title` leaf at `app.js:6425` belongs to the *right-click*
  context-menu path. Verified live at the mechanic seat: clicking a unit's name opened the record.
  **What survives** (do not lose it): the eye/plus row icons are unlabeled (supports #114), and the
  eye's click is a global app-wide preview toggle, not a row action — re-filed as **UNITS UD-070**.

## Re-file within the corpus (right finding, wrong location)

- **Findings #27 and #32 are DETAIL-view-resident, not row/list problems.** Both cite lines inside
  `headFlagsHtml`, which has one render site — `app.js:9718`, inside `if (inStandard)`. List mode
  renders no card header at all (`app.js:9705`). The customer billing/pay-status warning they
  describe is a standard-view-only signal. The list audit filed them as row problems; whoever
  consolidates the axis should move them to the detail surface.
- **Finding #18's mechanism is wrong.** It states the app "internally knows and labels the record
  `STUB — fill in pricing`." It does not — a *person* typed that text into the category
  `description`, a field the detail view cannot even edit (CATEGORIES F-02). The $0-rentable
  exposure is real (and re-confirmed live: two categories quotable at $0 today); the "app knows"
  framing is not.

## A corpus-wide measurement warning — re-measure before trusting

**Any density / "% below the fold" number taken through the Chrome-extension browser tool is
suspect.** That tool runs a viewport locked short (≈640px tall) and silently ignores resize calls.
Two independent sessions filed a "~58–68% of the record is below the fold" finding through it, and
both **retracted it** on Playwright re-measurement of the same bytes:

- **CATEGORIES F-14 — RETRACTED.** Pass-1 "58% below fold" was the viewport artifact. Playwright:
  60.6% visible at 1366×768 with *zero* section headers below the fold; 100% at 2560×1440.
- **CUSTOMERS** self-corrected the identical artifact (its first "21.5% visible / 68% below fold").
  What survives is narrower and data-dependent: record height scales with content, so the
  customers with the most invoices/cards/history are the ones that overflow — not a fixed layout
  fact.

Corollary the sessions themselves drew, worth adopting as corpus method: **DOM-present ≠
user-visible, and rulebook-registered ≠ rendered.** CUSTOMERS nearly filed "a card-detach control
is clickable" — both remove buttons measure **0px wide** on production (the unclickability
accidentally does the gating the code forgot to). CUSTOMERS also found two R-rulebook-registered
components on one card (`js-view-agreement`, and the comms panel) that *never render*.
`querySelectorAll().length` is not evidence a user can see or reach something. Measure the app, not
the instrument.

## Claims killed before filing (recorded so they are not re-derived)

- **CUSTOMERS** — "the three invoice view tabs render identical content" and "the Transactions tab
  is dead": both were an instrumentation bug (a cached node reference reading a detached tree after
  `render()` swapped the card). Re-tested against a freshly-queried live node, the tabs work.
- **UNITS** — an hour-meter "renders as unlabeled `— HRS` on a machine with no reading": the
  no-reading state is unreachable (all creation paths default `currentHours: 0`; the editor refuses
  an empty commit). What renders on a new unit is a plausible `0 HRS`, a milder defect overlapping
  existing findings.
- **CATEGORIES** — "the 18s poll clobbers an open rate editor mid-edit": refuted, it returns early
  on a focused `INPUT` (`app.js:24756`). Filed as a *win*, not a defect.

## Scope corrections carried in the findings themselves

- **The `canMoney()` blank-role fail-open** was first written as red / "sees every money figure."
  Held at **orange** after verification: only 2 of 6 money figures on a category are gated at all,
  and two of the three paths to a blank role are documented intent (`#local` demo; pre-roles
  single-password mode). The genuine defect is the third — a swallowed `auth` failure on a
  role-aware backend leaves a *fully-authenticated* session silently degraded to single-password
  privileges. Verified live on three surfaces (UNITS, CATEGORIES, CUSTOMERS).
- **The Beau "field call" contradiction** between the UNITS and RENTALS folders is resolved, and it
  is a real finding: `app.js:6944` prints "Field Call" purely from `inspectionStatus === 'Failed'
  while on rent` and never reads `r.fieldCall` — so the mechanic sees a field call the dispatcher on
  the same job does not.
