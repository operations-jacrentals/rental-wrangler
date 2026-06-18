# Claude Memory Files — New Machine Setup

These files live at:
`C:\Users\<you>\.claude\projects\<project-slug>\memory\`

The project slug matches the path: for `Desktop\Rental Wrangler\rental-wrangler` it will be
something like `C--Users-<you>-Desktop-Rental-Wrangler`.

Create the `memory\` folder if it doesn't exist, then create each file below.
Also create `MEMORY.md` as the index (last section in this file).

---

## user_profile.md

```markdown
---
name: user-profile
description: "User is the owner of JAC Rentals — smart, non-developer, building via AI-assisted vibe coding"
metadata:
  type: user
---

Owner/operator of **JAC Rentals** (jacrentals.com). Smart businessperson, not a developer.
Builds software by collaborating with AI tools ("vibe coding"). Cannot afford costly mistakes
from inexperience.

- Shared team login: operations@jacrentals.com (no individual user profiles needed)
- Previously used Monday.com — abandoned due to slowness
- Prefers simple, practical solutions over complex/overengineered ones
- Provides feedback via screenshots and plain language descriptions
- Responsive to honest assessments of risks and trade-offs

**How to apply:** Explain technical concepts in plain business terms. Don't over-engineer. Flag
risks clearly. Confirm before building complex automations. One feature at a time.
```

---

## feedback_skill_gate.md

```markdown
---
name: feedback-skill-gate
description: "Don't ask Jac whether to use a skill — decide and invoke autonomously"
metadata:
  type: feedback
---

Don't ask "Should we use a skill with this?" — check the available skills, decide which (if any)
applies, and invoke it silently.

**Why:** Jac finds the gate question interruptive; they want the skill decision made autonomously.

**How to apply:** On every task, assess relevance of jactec-ui / frontend / brainstorming / etc.
and invoke the right one without prompting for permission.
```

---

## deploy_cadence.md

```markdown
---
name: deploy-cadence
description: "STANDING RULE: ship every verified batch; main is branch-protected → deploy via feature branch → PR → squash-merge"
metadata:
  type: feedback
---

**Mechanism (current):** `main` is branch-protected (required `smoke` check). Deploy =
feature branch → PR → squash-merge. Run gates locally first: `node ci/smoke.mjs`,
`node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`.

**Autonomous deploy helper:** `node rw-automation/gh-api.mjs` reads the git credential
(never prints it) and exposes: `check · find-pr <branch> · create-pr <branch> '<title>'
· checks <ref> · wait-merge <branch> <pr#> · merge <pr#>`.
Correct syntax: `wait-merge <branch-name> <pr-number>` — both args required.

**Jac's standing rule:** push every VERIFIED batch so Jac always sees current work at
app.jacrentals.com. Verification-gated, not edit-count-triggered.

**Why:** Production is the app his staff use during the day — pushing unverified states
could break it mid-shift.
```

---

## ci_gates_port_gotcha.md

```markdown
---
name: ci-gates-port-gotcha
description: "CI gates hardcode port 8000 — if reserved on this machine, run via port-swapped copies"
metadata:
  type: reference
---

`node ci/smoke.mjs` and `node ci/logic-test.mjs` hardcode port 8000. On the OLD machine
this was reserved by Windows (`netsh interface ipv4 show excludedportrange protocol=tcp`).
CHECK on the new machine — it may not be an issue here.

Workaround if 8000 is blocked:
```
sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs
# run gates
git checkout -- ci/
```

`node ci/gen-rule-usage.mjs --check` is port-free, runs normally always.

Node_modules junction in worktrees: PowerShell
`New-Item -ItemType Junction -Path <wt>\node_modules -Target <main-checkout>\node_modules`.
Cleanup: `cmd /c rmdir node_modules` (link only — NEVER rm -rf) BEFORE `git worktree remove`.
```

---

## clasp_backend_deploy.md

```markdown
---
name: clasp-backend-deploy
description: "How to edit + deploy the JacTec Apps Script backend (Code.gs) via clasp"
metadata:
  type: reference
---

Backend = Google Apps Script **"Rental Wrangler Gate"**
(scriptId `1hw9A7Id3YIoiSCBkNFeDaKGRv-VtljFFIuBdQG5QULrgS0DjQhQ_2vyZ`)
owned by operations@jacrentals.com.
Data store = **"Rental Wrangler — Live Database"**
(sheet id `1gDlHSUF9YsJC_Kw15ZOGdDNnMsVWKeu9NroKlxRJG5g`).

**Deploy flow:** edit `backend/Code.js` → `clasp push -f` → `clasp version "<desc>"`
→ `clasp redeploy <LIVE_DEPLOYMENT_ID> -V <n> -d "<desc>"`.
LIVE web-app deployment id = `AKfycbzHahzgJqOYe9o4GKlRVGh-A7USRn1k4Dvyy4ajLh8EYCqVxofouM28qs8trNlObZw`
(this is `BACKEND_URL` in app.js). Currently at **@19**.

Re-auth each session: `clasp login --no-localhost`.
NEVER commit `backend/` — `DEFAULT_CONFIG` holds role passwords, repo is public.
Secrets (STRIPE_SECRET, ANTHROPIC_API_KEY, GITHUB_TOKEN) live ONLY in Script Properties.
```

---

## kpi_blur_mask.md

```markdown
---
name: kpi-blur-mask
description: "KPI ring blur mask — TEMPORARY, intentionally live; do NOT remove until Jac says so"
metadata:
  type: project
---

**KPI rings are currently blurred — Jac asked for this, leave it.**

Block at the very end of `style.css`:
```css
/* ── KPI MASK — remove this block to restore ring visibility (Jac) ── */
.kpi-ring, .big-ring, .menu-team-ring { filter: blur(12px); pointer-events: none; }
/* ── END KPI MASK ── */
```

Shipped as PR #133 (2026-06-18). To restore: delete only those 3 lines. No other changes.

**Why:** Jac is not ready to show KPI metrics to others yet.
**How to apply:** Never remove this block without Jac's explicit instruction.
```

---

## blued_steel_theme.md

```markdown
---
name: blued-steel-theme
description: "Blued Steel theme — complete card-plate CSS suite (PRs #60–#99); formula + center flip texture + milled recess"
metadata:
  type: project
---

Blued Steel suite COMPLETE as of 2026-06-18. All surfaces = one cohesive plate.

**Card plate (left + right columns):**
```css
[data-theme="bluedsteel"] .col > .card {
  background:
    linear-gradient(180deg, rgba(58,80,118,.34), rgba(8,11,18,.68)),
    url('assets/tex-metal-blued.jpg');
  background-size: cover, 340px;
  background-repeat: no-repeat, repeat;
  --stripe: var(--yellow, #f5c542);
}
```

**Center column (mirrored texture):** `assets/tex-metal-blued-flip.jpg`
(horizontal mirror via PowerShell RotateNoneFlipX — breaks the "same pattern repeating" look).

**Milled-panel recess (sections, rows):**
```css
background: rgba(11,15,24,.36);
box-shadow: inset 0 1px 0 rgba(150,178,222,.12), 0 2px 8px -3px rgba(0,0,0,.55);
border-color: rgba(150,178,222,.16);
```

**Toggle gap formula:** `.card > .tabrow { margin: 13px 8px 8px; }`
(13 = desired_gap 8 + stripe_height 6 - border 1; gives equal 8px above + below).
```

---

## no_captures_tracking.md

```markdown
---
name: no-captures-tracking
description: "STANDING RULE: never surface 'Captures' tracking/counts on any card"
metadata:
  type: feedback
---

**NEVER show a "Captures" count or "captures owed" tally anywhere** — not in round-up/status
bars, not in history count chips, not in footers.

KEEP the per-leg `+Log Delivery` / `+Log Recovery` capture *actions* — only the
counting/nagging is banned.

**Why:** Jac (2026-06-15): "Captures is a thing that shouldn't be used on ANY CARD.
We don't care about tracking captures."
```

---

## no_board_view.md

```markdown
---
name: no-board-view
description: "STANDING RULE: never add a Board/Sheets/spreadsheet view toggle to the grid cards"
metadata:
  type: feedback
---

Do NOT add a "Board View" / "Sheets" / spreadsheet view toggle to the grid cards.
Jac never approved it and explicitly does not want it (removed in PR #134).

**Why:** redundant and unapproved. The inert boardview code was left in place because it
shares rendering infrastructure with the back-office board popups (vendors/parts/expenses/
files) — don't delete those helpers. Don't re-wire a button to `openBoardView`.

The per-card **Graph view** (`js-cardgraph`) is a SEPARATE, approved feature — keep it.
```

---

## graph_carousel.md

```markdown
---
name: graph-carousel
description: "Per-card Graph is an interactive carousel that drives the list via filterTerms; how to extend"
metadata:
  type: project
---

The per-card Graph (chart icon on every card) is an interactive carousel (app.js §13.4)
that sits above the list and filters it. Smallest non-empty slice auto-enters search on open;
click slices/bars/rows to toggle filter terms; ◄ ► cycle views.

**Live on all cards** (PRs #84/#87/#91): units, rentals, customers, categories, invoices,
and shop segments.

**To extend:** edit `graphViewsFor(src)` — return `[{key,title,kind,segs:[{col,value,...}]}]`.
Each seg's `{col,value}` maps straight to a filter term on the list.

**Global filter change (watch out):** `rowMatches` now ORs positive terms of the SAME column
(AND across columns; NOT excludes). Same-col footer chips / graph slices now UNION.
```

---

## customer_funnel_default.md

```markdown
---
name: customer-funnel-default
description: "Both customer funnels default to 'N/A', not 'Inbound Lead' — one-time migration reset existing customers. PR #92."
metadata:
  type: project
---

Both funnels (`c.membershipStage` + `c.usedSalesStage`) default to `'N/A'` (gray), not
`'Inbound Lead'`. Changed in PR #92.

A one-time `migrateCustomers()` migration guards on a per-customer `c.funnelNAApplied` flag
and resets stored `'Inbound Lead'` → `'N/A'` once. **Do NOT remove the flag** — it prevents
re-reverting deliberate future `'Inbound Lead'` assignments on every boot.

The "leads" KPIs exclude BOTH `'N/A'` and `'Inbound Lead'` so the new default doesn't inflate counts.
```

---

## onboarding_form.md

```markdown
---
name: onboarding-form
description: "New-Customer popup completes in one sitting — quick-save, draft buffering, card-as-side-panel, scroll-preserved. PRs #95/#96/#101."
metadata:
  type: project
---

The `newCustomer` overlay (`openCustomerForm`/`startNewCustomer`) is an "Account packet"
designed to complete in ONE sitting. Key behaviors — don't regress:

- **quick-save:** `quickSaveCustomer(o)` auto-creates customer the moment First + Phone exist
  (sets `o.editId`, persists draft incl. signature/selfie).
- **Card = SIDE PANEL, not replacement (PR #101):** "Add card" sets `o.cardSub = true` →
  re-renders with a second `.popup` beside the form (`.overlay` is `display:flex` + gap).
  `js-cardsub-cancel` closes only the panel. Do NOT route through `openAddCard` (swaps the
  whole overlay — that's the bug Jac hit).
- **Scroll preserved (PR #96):** `renderOverlay` restores each overlay's scrollTop (`_ovScroll`)
  across its own re-renders, so signing/selfie doesn't jump to top.
```

---

## ach_payments.md

```markdown
---
name: ach-payments
description: "ACH bank accounts (Payments §14b) — add/store/verify/charge, Stripe-tokenized. Frontend #98 + backend @19 both LIVE. Live-money charging UNTESTED."
metadata:
  type: project
---

`c.achAccounts[]` parallel to `c.cards[]`. Stripe-tokenized (`us_bank_account`).
NEVER store raw routing/account — goes straight to Stripe.

**Both halves LIVE as of 2026-06-16 (backend @19).**

**🚨 REMAINING TODO:** live-money charging UNTESTED. Validate with ONE small real
self-charge before staff use.

ACH micro-deposit timeline makes same-day end-to-end validation impossible (~1–2 business
days for deposits to land, ~3–5 days to settle after charge).

**CI gotcha:** GitHub Actions `smoke` sometimes doesn't auto-fire on a PR. Fix:
manually trigger via `POST /actions/workflows/ci.yml/dispatches {ref:<branch>}`.
```

---

## rentals_stall_board.md

```markdown
---
name: rentals-stall-board
description: "Rentals card = Stall Board + multi-unit flows — shipped to main 2026-06-15"
metadata:
  type: project
---

The Rentals detail card = the **"Stall Board"** (shipped PR #40). Dense machine-first layout:
day timeline on top + event strip + per-unit stall blocks on connected Home—Site—Home rail.

**Multi-unit flows:**
- Invoice SYNC is wired (add/remove unit → bill/un-bill; address change re-prices transport).
- **SPLIT** is live: per-stall dates popup → `splitUnitToNewRental` (moves unit to new sibling
  rental on same invoice, carrying captures + address + invoice lines).
- Maps LIVE (browser key in `config.js`, restricted to app.jacrentals.com + localhost).

**Map gotcha (PR #68):** map created in same frame as container → 0×0 first paint.
Fix: `requestAnimationFrame` + 250ms timeout → `trigger(map,'resize')` + `setCenter`.
Apply this to ANY new map mount (including dispatch cockpit).
```

---

## gcloud_cli.md

```markdown
---
name: gcloud-cli
description: "gcloud installed + authed on OLD machine; jacrentals-maps owns the Maps key. Needs re-auth on new machine."
metadata:
  type: reference
---

Google Cloud SDK was at:
`C:\Users\Jac Rentals\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`
on the OLD machine. **Re-install and re-auth on new machine.**

Auth: `gcloud auth login` as operations@jacrentals.com.

Projects: **jacrentals-maps** (618563685907) owns the live Maps browser key.
Key uid `ad9b52b6-5a41-4c03-8184-b835f988678e`.

To edit key restrictions:
`gcloud services api-keys update <uid> --project=jacrentals-maps`
(providing `--allowed-referrers` / `--api-target` REPLACES the whole sub-list —
always describe first to preserve existing entries).
```

---

## MEMORY.md (the index — create this file)

```markdown
# Memory Index

- [JacTec Project](project_jactec.md) — Web app for JAC Rentals using Google Sheets as DB; architecture, build order, current state
- [Deploy Cadence](deploy_cadence.md) — ship every verified batch; main is branch-protected → deploy via feature branch → PR → squash-merge
- [Clasp Backend Deploy](clasp_backend_deploy.md) — edit + deploy the Apps Script backend (Code.gs) via clasp; live deployment @19
- [User Profile](user_profile.md) — Owner of JAC Rentals, non-developer vibe coder, speed is top priority
- [UI Design State](ui_design_state.md) — Locked-in design decisions: layout, panel/section header colors, alignment, naming conventions
- [No Captures Tracking](no_captures_tracking.md) — STANDING RULE: never show a "Captures" count/owed tally on any card
- [No Board View](no_board_view.md) — STANDING RULE: never add a Board/Sheets/spreadsheet view toggle to the grid cards
- [Rentals Stall Board](rentals_stall_board.md) — Rentals card = Stall Board + multi-unit flows; shipped to main 2026-06-15
- [Dispatch Office Cockpit](dispatch_office_cockpit.md) — dispatch view → live map + time-rail; the 0×0 first-paint map gotcha
- [Maps API Migration](maps_api_migration.md) — deprecated Places/DistanceMatrix → new Places + Routes; DONE + verified live
- [CI Gates Port Gotcha](ci_gates_port_gotcha.md) — gates hardcode port 8000; check if reserved on new machine
- [Graph Carousel](graph_carousel.md) — per-card Graph is an interactive carousel that drives the list via filterTerms
- [gcloud CLI](gcloud_cli.md) — re-install + re-auth on new machine; jacrentals-maps owns the Maps key
- [Customer Funnel Default](customer_funnel_default.md) — both funnels default to 'N/A'; one-time migration reset existing customers
- [ACH Payments](ach_payments.md) — ACH bank accounts LIVE (frontend #98 + backend @19); live charging still UNTESTED
- [Onboarding Form](onboarding_form.md) — New-Customer popup completes in one sitting; card-as-side-panel pattern
- [Skill Gate Feedback](feedback_skill_gate.md) — Don't ask about skills — decide and invoke autonomously
- [Blued Steel Theme](blued_steel_theme.md) — Complete card-plate suite (PRs #60–#99); formula, center flip, milled recess
- [KPI Blur Mask](kpi_blur_mask.md) — TEMPORARY: blur(12px) on ring containers — do NOT remove until Jac says so
```

---

> Note: `project_jactec.md`, `ui_design_state.md`, `dispatch_office_cockpit.md`, and
> `maps_api_migration.md` are very long. They should be restored from the old machine
> or from the Claude Code session transcript if needed. The entries above are the
> critical operational ones.
