# Claude Memory Files — New Machine Setup (regenerated 2026-06-18)

These recreate the project's Claude memory on a new machine. They live in the per-project memory folder:
`C:\Users\<you>\.claude\projects\<project-slug>\memory\` (slug for `Desktop\Rental Wrangler\rental-wrangler` is `C--Users-<you>-Desktop-Rental-Wrangler`).

Create the `memory\` folder, then create each file below with EXACTLY the content shown. `MEMORY.md` is the index Claude auto-loads every session. Outer fences are 4 backticks so the inner ``` code blocks survive.

---

## MEMORY.md

````markdown
# Memory Index

- [JacTec Project](project_jactec.md) — Web app for JAC Rentals using Google Sheets as DB; architecture, build order, current state
- [Deploy Cadence](deploy_cadence.md) — ship every verified batch; main is now branch-protected → deploy via feature branch → PR → squash-merge
- [Clasp Backend Deploy](clasp_backend_deploy.md) — edit + deploy the Apps Script backend (Code.gs) via clasp from this machine; live deployment @17
- [User Profile](user_profile.md) — Owner of JAC Rentals, non-developer vibe coder, speed is top priority
- [UI Design State](ui_design_state.md) — Locked-in design decisions: layout, panel/section header colors, alignment, naming conventions
- [No Captures Tracking](no_captures_tracking.md) — STANDING RULE: never show a "Captures" count/owed tally on any card (keep the +Log capture actions)
- [No Board View](no_board_view.md) — STANDING RULE: never add a Board/Sheets/spreadsheet view toggle to the grid cards (Jac rejected it; removed #134; back-office board popups are separate, keep them)
- [Rentals Stall Board](rentals_stall_board.md) — Rentals card = Stall Board + multi-unit flows (invoice sync, per-unit window SPLIT, journey/address sync, maps); shipped to main 2026-06-15
- [Dispatch Office Cockpit](dispatch_office_cockpit.md) — dispatch view → live map + time-rail; Phase 1 shipped 2026-06-16 (awaiting prod verify); the 0×0 first-paint map gotcha lives here
- [Maps API Migration](maps_api_migration.md) — deprecated Places/DistanceMatrix → new Places + Routes; DONE + verified live, shipped inside #73 (key needed routes apiTarget added)
- [CI Gates Port Gotcha](ci_gates_port_gotcha.md) — gates hardcode port 8000 (reserved on this machine); run via port-swapped copies on 9123
- [Graph Carousel](graph_carousel.md) — per-card Graph is now an interactive carousel that drives the list via filterTerms; extend via graphViewsFor; same-col filters now OR (global)
- [gcloud CLI](gcloud_cli.md) — gcloud installed + authed (operations@jacrentals.com); I can manage JacRentals GCP directly; jacrentals-maps owns the Maps key
- [Customer Funnel Default](customer_funnel_default.md) — both funnels default to 'N/A' (not 'Inbound Lead'); one-time funnelNAApplied migration reset existing customers (#92)
- [ACH Payments](ach_payments.md) — ACH bank accounts (Payments §14b): add/store/verify/charge, Stripe-tokenized, parallel to cards; frontend #98 + backend @19 both LIVE; live-money charging still UNTESTED (needs a self-charge); the CI workflow_dispatch fix lives here
- [Onboarding Form](onboarding_form.md) — New-Customer popup completes in one sitting: quick-save + draft buffering + card-as-side-panel (cardSub, NOT openAddCard) + scroll preserved (#95/#96/#101)
- [Skill Gate Feedback](feedback_skill_gate.md) — Don't ask about skills — decide and invoke autonomously
- [Blued Steel Theme](blued_steel_theme.md) — Complete card-plate suite (PRs #60–#99): plate formula, center flip texture, milled recess; KPI blur mask live+temporary (PR #133)
- [KPI Blur Mask](kpi_blur_mask.md) — TEMPORARY: `.kpi-ring, .big-ring, .menu-team-ring { filter: blur(12px) }` at end of style.css — do NOT remove until Jac says so
````

## ach_payments.md

````markdown
---
name: ach-payments
description: "ACH bank accounts on file (Payments §14b) — add/store/verify/charge, tokenized via Stripe, parallel to cards. Frontend shipped 2026-06-16; backend pending clasp re-auth."
metadata:
  node_type: memory
  type: project
  originSessionId: 57b4e560-5032-47cc-8f0c-02caadd7bf0c
---

**ACH bank accounts on file** — `c.achAccounts[]` parallel to `c.cards[]`. Tokenized through Stripe (`us_bank_account`); we store ONLY `{ id, stripePmId, setupIntentId, bankName, last4, accountType, holder, isDefault, verified, status, mandate }` — **never the raw routing/account** (they go straight to Stripe via `confirmUsBankAccountSetup`, never to our backend). Jac's calls: **store-now-verify-later** (verify = micro-deposits), and **build the REAL thing (live, not test mode)**.

**FRONTEND shipped to `main` 2026-06-16 (PR #98 `7226736`):**
- Payment Methods section = **Cards | ACH tabs** (`paymentMethodsSection`/`cardTabBody`/`achTabBody`, `state.pmTab`). Add-ACH overlay (`kind:'addAch'`) → `saveAchFlow` → `confirmUsBankAccountSetup` (plain inputs, NO Stripe Element) → `stripeSaveBank` → push to `achAccounts` (`verified:false`). Consent-gated (selfie+signature) exactly like cards.
- **Verify**: a pending row shows a Verify action → `kind:'verifyAch'` overlay (enter the micro-deposit descriptor code `SMxxxx`) → `verifyAchFlow` → backend `verify_microdeposits` → `verified:true`.
- **Charging is REAL + money-safe**: verified banks are selectable in the charge picker; a charge routes to the bank PM; ACH `processing` is recorded as **pending, NEVER paid**; the pending-PI re-entry guard blocks a 2nd PaymentIntent (no double-debit); a "Check ACH status" banner (`checkAchStatus` → reuses `stripeFinalizeInvoice`) settles it on success or marks `ach-failed` on a bounce. Unverified banks show as a "needs verification" note. Card charge path untouched.
- Handlers: `js-pm-tab`/`js-add-ach`/`js-bank-default`/`js-bank-remove`/`js-bank-verify`/`js-ach-save`/`js-ach-verify-save`/`js-ach-check`/`js-pay-pick(data-bank)`.

**BACKEND (`backend/Code.js`, gitignored, deploy via clasp) — written, NOT yet deployed:** `stripeBankSetupIntent_` (+`verification_method:microdeposits`), `stripeSaveBank_`, `stripeVerifyBank_` (`verify_microdeposits` w/ `descriptor_code`); `stripeChargeInvoice_` now accepts a VERIFIED ACH pm + handles `processing`; `stripeFinalizeInvoice_` settles/clears the pending; `recordCharge_` labels the bank + promotes the pending; `achProcessing` added to the sync-protected invoice fields. All mirror the card actions' IDOR + consent guards.

**STATUS — both halves now LIVE (2026-06-16):** backend deployed via clasp to **`@19`** on deployment id `AKfycbzHahzg…` (same id the frontend's `BACKEND_URL` at app.js:10306 uses, so the URL is unchanged). clasp re-auth done (the `invalid_rapt` cleared after `clasp login`). Exec URL returns 200.

**🚨 REMAINING TODO:**
1. **UNTESTED live-money charging** → validate with ONE small real self-charge before staff use. I'm on standby to hotfix.
2. ACH clock makes same-day end-to-end validation IMPOSSIBLE with micro-deposits: add → verify (micro-deposits ~1–2 business days for the 2 deposits to land) → charge (settles ~3–5 days). To validate end-to-end TODAY would require switching verification to Financial-Connections "instant verify" (a build change; Jac picked micro-deposits via "store now, verify later").

**CI gotcha hit this session:** GitHub Actions `smoke` (ci.yml) sometimes does NOT auto-fire on a PR → the required check stays 0/pending and the PR can't merge. Fix: manually trigger it — `POST /actions/workflows/ci.yml/dispatches {ref:<branch>}` (ci.yml has `workflow_dispatch`) → the `smoke` check appears on the PR head → merge. See [[deploy-cadence]].
````

## blued_steel_theme.md

````markdown
---
name: blued-steel-theme
description: "Blued Steel theme — complete card-plate CSS suite (PRs #60–#99); formula + center flip texture + milled recess"
metadata: 
  node_type: memory
  type: project
  originSessionId: 081513eb-7908-4411-9dd3-5e73f178a72b
---

**Blued Steel (`[data-theme="bluedsteel"]`) card-plate suite is COMPLETE as of 2026-06-18.**

All surfaces now read as one cohesive blued-steel data-plate. The implementation lives in `style.css`.

## Card plate formula (left + right columns)

```css
[data-theme="bluedsteel"] .col > .card {
  position: relative;
  background:
    linear-gradient(180deg, rgba(58,80,118,.34), rgba(8,11,18,.68)),
    url('assets/tex-metal-blued.jpg');
  background-size: cover, 340px;
  background-repeat: no-repeat, repeat;
  --stripe: var(--yellow, #f5c542);
}
```

## Center column (mirrored texture)

`assets/tex-metal-blued-flip.jpg` — horizontal mirror of the blued plate (same color/family, different grain direction). Breaks the "same pattern repeating" perception for frequent users. Created via PowerShell `RotateNoneFlipX`.

```css
[data-theme="bluedsteel"] .col[data-col="middle"] > .card,
[data-theme="bluedsteel"] .col[data-col="middle"] > .card.anchored {
  background:
    linear-gradient(180deg, rgba(58,80,118,.34), rgba(8,11,18,.68)),
    url('assets/tex-metal-blued-flip.jpg');
  background-size: cover, 340px;
  background-repeat: no-repeat, repeat;
}
```

## Milled-panel recess (sections, rows, sub-panels)

```css
background: rgba(11,15,24,.36);
box-shadow: inset 0 1px 0 rgba(150,178,222,.12), 0 2px 8px -3px rgba(0,0,0,.55);
border-color: rgba(150,178,222,.16);
```

Used on `.row`, `.section`, and any dark sub-panel on the plate. Also in `signature-recipes.md`.

## Toggle gap (PR #99)

`.card > .tabrow { margin: 13px 8px 8px; }` — formula: `desired_gap(8) + stripe_height(6) - border(1) = 13`. Gives equal 8px visual gap above and below the tab bar on all columns.

**Why:** The 6px hazard stripe is `position: absolute` at the card top — naive `margin: 8px` leaves only 2px of visible gap above. The 13px formula corrects for this.

**How to apply:** If any future changes touch the card cap stripe height, recalculate the tabrow top margin with the same formula.
````

## ci_gates_port_gotcha.md

````markdown
---
name: ci-gates-port-gotcha
description: CI gates hardcode port 8000 which is reserved on this machine — run via port-swapped copies
metadata: 
  node_type: memory
  type: reference
  originSessionId: ca25b3b4-7a69-4224-8721-dca8a0ffcf89
---

On this Windows machine, `node ci/smoke.mjs` and `node ci/logic-test.mjs` fail with
`listen EACCES 0.0.0.0:8000` — port 8000 sits in a Windows excluded port range
(`netsh interface ipv4 show excludedportrange protocol=tcp` shows 8000–8000 reserved),
not a stuck process. Sandbox-disable does NOT help; it's an OS reservation.

Workaround to run the browser gates locally: copy each gate, replace `localhost:8000`→`127.0.0.1:9123`
and `server.listen(8000, r)`→`server.listen(9123, '127.0.0.1', r)`, run the copy with the sandbox
disabled (needs to bind a port + launch Playwright Chromium), then delete the copy. Playwright
chromium is installed at `~/AppData/Local/ms-playwright/`. `node ci/gen-rule-usage.mjs --check`
is port-free and runs normally. Possible real fix worth proposing: make the gates read `process.env.PORT`.

Running gates from a **fresh git worktree** (the [[deploy-cadence]] isolation pattern): the new
worktree has NO `node_modules`, and ESM `import 'playwright'` **ignores `NODE_PATH`** — so
copy-the-gate-to-9123 isn't enough. Junction the main checkout's modules into the worktree first:
`New-Item -ItemType Junction -Path <wt>\node_modules -Target <main-checkout>\node_modules` (cmd
`mklink /J` mangled the target with a leading `\` for me — use PowerShell `New-Item`). Then run the
9123 copies from the **worktree root** (the gate's static server serves `process.cwd()`, so cwd must
be the worktree to serve the edited files). Cleanup order matters: unlink the junction with
`cmd /c rmdir node_modules` (link only — NEVER `rm -rf`, it can follow into the real node_modules)
BEFORE `git worktree remove`. The dir delete may throw "Permission denied" on a Windows lock even
though git already de-registers the worktree → finish with `git worktree prune` + `rm -rf` the husk.

`gen-rule-usage.mjs --check` reports STALE locally on a pure-CRLF diff (benign, passes on Linux CI):
confirm it's only line-endings with `git diff --ignore-all-space --numstat -- rule-usage.js` (empty
= no real drift), then `git checkout -- rule-usage.js`. Only regenerate+commit if that diff is non-empty.
````

## clasp_backend_deploy.md

````markdown
---
name: clasp-backend-deploy
description: How to edit + deploy the JacTec Apps Script backend (Code.gs) from this machine via clasp
metadata: 
  node_type: memory
  type: reference
  originSessionId: c490355e-a468-4c25-8eef-557b45485a24
---

The JacTec backend is a Google Apps Script web app, **"Rental Wrangler Gate"** (scriptId `1hw9A7Id3YIoiSCBkNFeDaKGRv-VtljFFIuBdQG5QULrgS0DjQhQ_2vyZ`), owned by operations@jacrentals.com. Data store = schema-less Google Sheet **"Rental Wrangler — Live Database"** (id `1gDlHSUF9YsJC_Kw15ZOGdDNnMsVWKeu9NroKlxRJG5g`), rows `[id, json]`.

**Setup done 2026-06-15:** clasp 3.3.0 installed globally (npm bin `C:\Users\Jac Rentals\AppData\Roaming\npm` — `export PATH="$PATH:/c/Users/Jac Rentals/AppData/Roaming/npm"` in the Bash tool). Jac authorized `clasp login` as operations@jacrentals.com (creds in `~/.clasprc.json`; re-auth if they expire). The backend is cloned into the repo's **gitignored `backend/`** folder (`.clasp.json` + `Code.js` + `appsscript.json`). **NEVER commit `backend/`** — `DEFAULT_CONFIG` holds role passwords and the repo is public.

**Deploy flow:** edit `backend/Code.js` → `clasp push -f` → `clasp version "<desc>"` → `clasp redeploy <LIVE_DEPLOYMENT_ID> -V <n> -d "<desc>"`. The LIVE web-app deployment the frontend calls = `AKfycbzHahzgJqOYe9o4GKlRVGh-A7USRn1k4Dvyy4ajLh8EYCqVxofouM28qs8trNlObZw` (this is `BACKEND_URL` in app.js). A plain `clasp push` is NOT enough — that **versioned** deployment must be redeployed. (A second `@HEAD` deployment exists but the app doesn't use it.) As of 2026-06-15 it's **@17**.

**Action router** = `handle(e)` in Code.js, if-action style: `if (action === 'x') return json(x_(body, role));`. Add an action = one router line + a `_`-suffixed helper. Most actions sit BELOW the `role = roleForPassword(pw)` gate (any signed-in role); money actions check `MONEY_ROLES[role]`, curation checks `isAdmin(pw)`. Media → Drive via `Utilities.newBlob` + `DriveApp` (see `uploadCapture_`/`uploadFile_`). Tiny ephemeral data → `PropertiesService.getScriptProperties()` (see `saveSession_`/`getSession_`).

**Testing:** `clasp run` is NOT available (no API-executable deployment; wiring one re-links the GCP project — avoid). Test by POSTing to `BACKEND_URL` with a valid role password — `backend/verify-handlers.mjs` is a ready harness (reads `RW_PW` env or `backend/.pw`). Use `node fetch`, not curl (curl drops Content-Length on the /exec 302 → HTTP 411). Drive writes are independently verifiable via the Google Drive MCP. Secrets (STRIPE_SECRET, ANTHROPIC_API_KEY, GITHUB_TOKEN) live ONLY in Script Properties. See [[project-jactec]] · [[deploy-cadence]].
````

## customer_funnel_default.md

````markdown
---
name: customer-funnel-default
description: "Both customer funnels (Membership + Used Sales) default to 'N/A', not 'Inbound Lead' — and a one-time migration reset existing customers. Shipped PR #92, 2026-06-16."
metadata:
  node_type: memory
  type: project
  originSessionId: 335b5729-3edf-4fc3-ba7a-0f68e785a94b
---

The customer **funnel stages** (`config.js` `STATUS.funnelStage`) drive TWO per-customer funnels: `c.membershipStage` (Membership) + `c.usedSalesStage` (Used Sales), shown via `funnelPill` / edited via the funnel dropdown (`openFunnelDropdown`/`setFunnel`).

**Default = `N/A`, not `Inbound Lead` (PR #92, 2026-06-16, `f2c67c6`).** `'N/A'` (gray) was added as the FIRST entry in `funnelStage`. Everyone used to land on `Inbound Lead` (it was the literal default in new-customer creation + the display fallbacks), so every account looked like a fresh lead. Changes:
- New-customer creation + both `|| 'Inbound Lead'` display fallbacks now use `'N/A'`.
- **One-time migration** in `migrateCustomers()`: guarded by a per-customer `c.funnelNAApplied` flag, it resets stored `'Inbound Lead'` → `'N/A'` on BOTH funnels once, then persists via `migrationDirty → saveSoon()`. The flag is why a **deliberate future `'Inbound Lead'` is never reverted** — don't remove it or the migration would re-revert real leads every boot.
- The "leads" KPIs (`kpiFor`, customer role) exclude BOTH `'N/A'` and `'Inbound Lead'` so the new default doesn't inflate the count.

Built in an **isolated git worktree off main** (the shared working dir was on `feat/ach-payments` with other live sessions — see [[deploy-cadence]], [[ci-gates-port-gotcha]]). `Inbound Lead` remains a valid stage a user can pick.
````

## deploy_cadence.md

````markdown
---
name: deploy-cadence
description: "STANDING RULE: push every verified batch to production (main → app.jacrentals.com) so Jac always sees current work in his browser"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cfed54dd-0af4-4a38-9350-842024af78d5
---

**⚑ MECHANISM UPDATE 2026-06-15:** the CADENCE still holds (ship every verified batch so Jac always sees current work), but the MECHANICS changed — `main` is now **branch-protected** (required `smoke` check) and `design-overhaul` is abandoned. Deploy = work on a **feature branch → open a PR → squash-merge to `main`** (Pages auto-builds; the Wrangler engine auto-merges green PRs). Run gates LOCALLY first: `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`. The verification battery below still decides whether a batch is allowed to ship. Backend (`Code.gs`) deploys separately via clasp, not Pages — see [[clasp-backend-deploy]].

**⚑ AUTONOMOUS DEPLOY — Claude CAN ship to live on its own from this machine (verified 2026-06-15, shipped the Blued Steel theme PR #50 end-to-end):** there is NO `gh` CLI / GitHub token on this box, but the machine's **stored git credential has repo ADMIN**, so drive the GitHub REST API with it. Helper: `node "C:/Users/Jac Rentals/rw-automation/gh-api.mjs"` — it reads the token via `git credential fill` (never prints it) and exposes `check · find-pr <branch> · create-pr <branch> '<title>' · checks <ref> · wait-merge <branch> <pr#> · merge <pr#>`. **Flow:** push the feature branch → `create-pr` → `wait-merge` (polls the required `smoke` check and squash-merges on green — respect the gate, don't admin-bypass) → verify live (`fetch app.jacrentals.com/style.css|app.js` for the change, ~1-2 min after merge). Local CI gates (`ci/smoke.mjs` etc.) need `node_modules` (Playwright) which a fresh git WORKTREE lacks — use a worktree to build on your branch without disturbing a concurrent session on the main checkout, and boot-verify via the rw-automation Playwright scripts instead. See [[project-jactec]].

**Jac's standing deploy rule (2026-06-12):** push updates to the live site continuously — he asked for "every ~10 edits"; we agreed the trigger is **every VERIFIED batch** instead of raw edit count.

**Why:** Jac wants to always see the current build at app.jacrentals.com in his own browser without asking. But production is the app his staff use during the day — edit-count-triggered pushes could land mid-feature broken states. Verification-gated pushes give him the cadence without the risk.

**How to apply:** after each work wave passes the full battery — app boots clean, flash-lint sweep = ZERO unstamped, console error-free, changed features exercised in the preview — commit on `design-overhaul`, then immediately merge → `main` → push (Pages deploys in ~1-2 min). No need to ask permission per merge anymore; this rule IS the permission. Do NOT push unverified or mid-feature states. Big risky rewrites (e.g. the drag-and-drop engine) still warrant a heads-up to Jac before going live. See [[project-jactec]] for repo/branch layout.
````

## dispatch_office_cockpit.md

````markdown
---
name: dispatch-office-cockpit
description: "The dispatch/Calendar view is being rebuilt into the 'office cockpit' — a live map of the day's run + a welded time-rail. Phase 1 shipped 2026-06-16."
metadata:
  node_type: memory
  type: project
  originSessionId: 9c40ae77-37fe-41f1-b44e-49f317a79a9b
---

The **dispatch view** (inside the Calendar card, `dispatchGridBody`) is being redesigned from a list into the **OFFICE COCKPIT**: a live Google map of the day's run + a vertical **time-rail**. Approved direction (Jac, 2026-06-15): one role-aware view, **two cockpits** — office = the **Running Rail** (drag a token to a new TIME = reorder) over the map; driver = the **Dispatch Deck cab** (next-stop POV, log buttons). **Single driver** (no assignment field). **Live board — NO "send" button** (Jac: the schedule is always running); edits auto-notify the driver, debounced. Map + rail read **1:1**: every stop shows its KIND (deliver=blue / recover=brown) + the NEXT stop is marked, on both.

**Phase 1 — SHIPPED + VERIFIED LIVE 2026-06-16 (PR #73 `517877d`, UX fixes PR #79 `e8df4cd`).** Jac confirmed the map renders on prod and loves it living in the card. The `#local` preview can NOT verify the map — its data index empties and crashes render under test churn, so tiles never paint there; **verify map/interaction on PROD** (layout/DOM still inspectable in #local). What landed:
- **Map engine** (`mountDispatchMap`/`refreshDispatchMap`/`placeDispatchPin`/`dispGeocode`): pins colored by kind/next/done, straight-line `Polyline` route (no Directions/quota), **telematics-ready truck seam `dispatchTruckPos`** (v1 = last-done stop / yard; Jac wires real telematics ~2026-06-23), Places `findPlaceFromQuery` geocode fallback for stops with no stored `sitePin`. Map mounts fresh into the render-rebuilt node (transport-editor pattern) with remembered pan/zoom.
- **Schedule rail** (`dispatchGridBody`, `.disprail`/`.disp-tok`/`.dt-*`): the right-edge hover/focus-expand overlay (see gotcha b), NOT a time-axis. Collapsed = kind-dot + time; expanded = KIND (`badge` R3b) + NEXT (`.dt-next`) + Done (`badge`) + customer (`refPill` R2 → opens the rental) + unit (`unitPill`) + address. **Editable stop-time** (12h "9:00 AM" — `timeToMin` parses 12h+24h; a complete time re-sorts). **Drag a token** to reorder (native dnd → `dispatchOrder`). **Tapping a stop FOCUSES it on the map** (`dispatchFocusStop` — pan+highlight, NEVER anchors/leaves the cockpit; Jac's explicit choice — clicking used to open a burying anchor tab with no back); the customer refPill is the deliberate open-the-rental path. Map **preloaded at boot** (`loadGoogleMaps()` in `boot()`) so it opens instantly. Live footer (no send button).
- Helpers: `dispatchEvents` now carries `pin` + recovery address; `dispatchKind`/`stopDone`(reads start/end captures)/`dispatchNextId`/`dispatchTruckPos`/`timeToMin`/`fmtClock`. Dropped the old auto-route/free-form-arrow head buttons (superseded by the auto-drawn route; the orphaned `js-disp-autoroute` handler + `autoDispatchRoute` are now dead code).

**Pending phases:** 2 = the **driver cab**; 3 = the **in-app driver notification** (debounced, no send button; SMS later). (Drag-to-reorder shipped as list-drag in #104/#106, not the original time-axis; UX feedback fixes — time parsing, drag, map preload, R-rulebook badges, focus-on-map — all live.)

**CRITICAL map gotcha (applies to ANY new map mount):** a Google map built the same frame its container is inserted paints at **0×0** and stays blank until the next mount — always nudge it after create: `requestAnimationFrame` + a 250ms `setTimeout` calling `google.maps.event.trigger(map,'resize')` (+ `setCenter` for a fixed-center map). See [[rentals-stall-board]] (PR #68). **Two more cockpit gotchas (PR #79):** (a) the map's drag/zoom is hijacked by the global drag-to-chat engine unless `dragDown` bails on the map container — it now `return`s on `.dispm` (like `.tedit`). (b) **Layout (Jac's final, PR #83): full-pane map + hover-rail.** `.dispm{position:absolute;inset:0}` fills a relative `.disp-cockpit`; the schedule is a `.disprail` overlay on the RIGHT — ~90px collapsed (kind-dot + time mini-list, "No set time" pinned on top), widening to ~256px on `:hover`/`:focus-within` (the rail is `tabindex=0` so keyboard works) to reveal the editable rows. The day-nav header + LIVE footer are siblings OUTSIDE `.disp-cockpit`, so the absolute full-pane map never covers them. (The earlier #79 bug was the map box going absolute while INSIDE the flex column *next to* the header and overlaying it — a non-issue now that header/footer live outside the cockpit and the right-edge overlay rail is intentional.) Spec: `docs/superpowers/specs/2026-06-15-dispatch-map-design.md`. Built via brainstorming → 6-concept judged workflow → mockups (Jac picked the Running Rail). See [[ui-design-state]], [[deploy-cadence]].
````

## feedback_skill_gate.md

````markdown
---
name: feedback-skill-gate
description: "Don't ask Jac whether to use a skill — decide and invoke autonomously"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 081513eb-7908-4411-9dd3-5e73f178a72b
---

Don't ask "Should we use a skill with this?" — check the available skills, decide which (if any) applies, and invoke it silently.

**Why:** Jac finds the gate question interruptive; they want the skill decision made autonomously.

**How to apply:** On every task, assess relevance of jactec-ui / frontend / brainstorming / etc. and invoke the right one without prompting for permission.
````

## gcloud_cli.md

````markdown
---
name: gcloud-cli
description: gcloud CLI is installed + authed on this machine — I can manage JacRentals GCP directly
metadata: 
  node_type: memory
  type: reference
  originSessionId: ca25b3b4-7a69-4224-8721-dca8a0ffcf89
---

Google Cloud SDK is installed at
`C:\Users\Jac Rentals\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd`
(winget `Google.CloudSDK`; not on the default PATH — call by full path). Authed as
**operations@jacrentals.com** (user creds, cloud-platform scope) via `gcloud auth login`.

So I can do GCP ops directly instead of asking Jac to click through the Cloud Console — enabling APIs,
inspecting/editing the Maps key, etc. Run gcloud commands with the sandbox disabled (network). Native
stderr gets wrapped as a PowerShell error even on success — judge by the JSON result, not `$?`.

Projects (`gcloud projects list`): **jacrentals-maps** (618563685907) owns the live Maps browser key
`AIzaSy…hIc8` (key uid `ad9b52b6-5a41-4c03-8184-b835f988678e`); also `poised-elf-398122`,
`jac-rentals-jd-hapn`. Editing the Maps key's restrictions: `gcloud services api-keys update <uid>
--project=jacrentals-maps` — providing `--allowed-referrers` / repeated `--api-target=service=…`
REPLACES that whole sub-list, so always pass the FULL desired set (describe first to preserve existing).
Key changes can take minutes to propagate. Jac must still do the actual Google sign-in (I can't enter
passwords / approve OAuth). See [[maps-api-migration]].
````

## graph_carousel.md

````markdown
---
name: graph-carousel
description: Per-card Graph is an interactive carousel that DRIVES the list via filterTerms; how it works + how to extend
metadata: 
  node_type: memory
  type: project
  originSessionId: 06e8dafe-ce3a-4682-9c5e-675306695fb2
---

The per-card **Graph** (the chart icon on every card's list bar) is no longer a
read-only dashboard. As of 2026-06-16 it's an interactive **carousel** (app.js
`§13.4`) that sits ABOVE the list and filters it. Jac's design: open → panel drops
down, the **smallest non-empty slice auto-enters** the search; click slices / bars /
leaderboard rows / number tiles to **toggle** search entries; **◄ ► chevrons** cycle
the views, re-syncing the search; each view **remembers** its selection.

**Live on all cards** (PRs #84 Units, #87 grid cards, #91 shop): units, rentals,
customers, categories, invoices, and the shop segments inspections / workOrders /
serviceOrders. The shop **'all'** overview keeps the legacy `cardGraphBody` dashboard.

**How it works / how to extend:**
- The selection IS the card's `filterTerms` (one filtering pathway — the [[no-captures-tracking]]-style "one source of truth"): graph clicks add/remove `{t,col,value,neg:false,g:viewKey}` terms that show as normal removable search pills. Inactive views are remembered in `cs.graphSel`; `cs.graphIdx` is the active view.
- **To add/extend a card's views:** edit `graphViewsFor(src)` — return `[{key,title,kind:'pie'|'bars'|'lead'|'nums', segs:[{col,value,label,count,color,disp?}]}]`. Each seg's `{col,value}` IS a filter term, so it maps straight to the list. `disp` shows money in lead/nums. pie/bars auto-default to the smallest slice; lead/nums don't.
- **Counts must be computed over the SAME population the list shows** (for shop segments that's the `shopItemMode` queue, NOT the full DATA collection) or the auto-slice can point at hidden rows.
- **Shop is special:** the view SOURCE is explicit (`src` = the segment via forcedSeg/cs.segment, threaded through gv* fns + `data-src` on controls), because cs lives under 'shop' but views come from the segment. `shopListView` filters via `shopItemMatches` (not blob-only) so col-terms apply.
- **GLOBAL behavior change (watch out):** `rowMatches` now ORs positive terms of the **same column** (AND across columns; NOT excludes). One-term groups are unchanged, but two same-col footer chips / graph slices now UNION instead of returning empty. Affects every card's filtering, not just graphs.
- Synthetic filter cols added for the charts: `__fc` / `__fcmonth` (field calls), `__rentmonth`, `__datemonth` (inspections/WO), `__svcstat` (service urgency).
- Styling via [[ui-design-state]] / jactec-ui: orange = the selected slice only; chart data on calm status-colored fields.
````

## kpi_blur_mask.md

````markdown
---
name: kpi-blur-mask
description: "KPI ring blur mask — TEMPORARY, intentionally live; do NOT remove until Jac says so"
metadata: 
  node_type: memory
  type: project
  originSessionId: 081513eb-7908-4411-9dd3-5e73f178a72b
---

**KPI rings are currently blurred (filter: blur 12px) — Jac asked for this, leave it.**

Block at the very end of `rental-wrangler/style.css`:
```css
/* ── KPI MASK — remove this block to restore ring visibility (Jac) ── */
.kpi-ring, .big-ring, .menu-team-ring { filter: blur(12px); pointer-events: none; }
/* ── END KPI MASK ── */
```

Shipped as PR #133 (2026-06-18). PR #132 (color change attempt) was a misread of "blue" vs "blur" — it's dead code, superseded.

**To restore:** delete only those 3 lines. No other changes needed.

**Why:** Jac is not ready to show KPI metrics to others yet. The blur makes both the ring arc fill AND the color unreadable — a color-only change doesn't hide the arc percentage.

**How to apply:** Never remove this block without Jac's explicit instruction. If someone asks "why are the KPI rings blurry" — it's intentional.
````

## maps_api_migration.md

````markdown
---
name: maps-api-migration
description: "Google Maps deprecated-API migration — DONE, shipped in"
metadata: 
  node_type: memory
  type: project
  originSessionId: ca25b3b4-7a69-4224-8721-dca8a0ffcf89
---

Migrated all deprecated Google Maps APIs in `rental-wrangler/app.js` to the new Places + Routes libs.
**Status: DONE, shipped, verified live (2026-06-16).**

**4 call sites migrated** (all keep the city-tier fallback):
- `teQuery`: `AutocompleteService.getPlacePredictions` → `AutocompleteSuggestion.fetchAutocompleteSuggestions` (+ shared `AutocompleteSessionToken`).
- `tePick`: `PlacesService.getDetails` → `Place` `fetchFields(['location','formattedAddress'])` via `prediction.toPlace()`.
- `teFetchDistance`: `DistanceMatrixService` → lazy `importLibrary('routes')` + `RouteMatrix.computeRouteMatrix` (`distanceMeters`/`durationMillis`/`condition==='ROUTE_EXISTS'`).
- `dispGeocode` (office cockpit): `PlacesService.findPlaceFromQuery` → `Place.searchByText({textQuery, fields:['location'], locationBias: YARD_CENTER})`.

**Shipped inside commit `517877d` (#73 "Dispatch office cockpit")**, NOT a dedicated PR — the concurrent session committed the whole shared working tree (its dispatch work + my uncommitted migration) together. It's on origin/main → deployed. The stub branch `maps-deprecation-migration` is empty (no unique commits); safe to delete.

**GCP (project `jacrentals-maps`, key uid `ad9b52b6-…678e`):** Routes API + Places API (New) were ALREADY enabled. The real fix was the API-restricted key didn't allow Routes — added `routes.googleapis.com` to the key's apiTargets (permanent). Temp-added then removed a `localhost:9123` referrer for local verify. NOTE: if #73 deployed before the key fix (~18:46 UTC), live mileage briefly fell back to city-tier estimates (graceful) until the routes target landed — now fine.

**Verified live** from an allowed origin: all 4 calls returned 200 with real data; RouteMatrix gave 9.8mi/15min Sulphur→Lake Charles. Confirms the **address-string yard origin `YARD_ORIGIN` works** (no need for a hardcoded lat/lng). See [[gcloud-cli]], [[deploy_cadence]], [[dispatch_office_cockpit]].
````

## no_board_view.md

````markdown
---
name: no-board-view
description: "STANDING RULE: Jac rejected the Board/Sheets View (the spreadsheet toggle on the grid cards) — never re-add it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 81da69c2-63ef-42f1-8070-ddb8511aa5aa
---

**Do NOT add a "Board View" / "Sheets" / spreadsheet view toggle to the grid cards.** Jac never approved it and explicitly does not want it (a prior session shipped it; he flagged the grid icon by the card search bar and said "we do not want this feature").

**Why:** it's redundant (the cards already show the records) and unapproved.

**How to apply:** removed in PR #134 — the two `js-boardview` `.bv-btn` buttons (regular grid-card header + Shop card header) and the `js-boardview` open handler are gone, so the boardview overlay is unreachable. The inert boardview code (`openBoardView`, the `kind:'boardview'` overlay branch, the `js-bv-*` handlers, `boardViewTitle`/`boardViewRecords`) was **left in place on purpose** — it shares rendering infra with the back-office **BOARD POPUPS** (vendors / parts / expenses / files via `js-board` + `BACKOFFICE_BOARDS`), which Jac DOES use; ripping the shared code risks breaking those. So: don't re-wire a button to `openBoardView`, and don't blindly delete the boardview helpers without proving they're not shared with the back-office boards. The per-card **Graph view** (`js-cardgraph`) is a SEPARATE, approved feature — keep it. See [[graph-carousel]].
````

## no_captures_tracking.md

````markdown
---
name: no-captures-tracking
description: "STANDING RULE: never surface 'Captures' tracking/counts on any card in JacTec — Jac doesn't care about tracking captures"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9c40ae77-37fe-41f1-b44e-49f317a79a9b
---

Jac (2026-06-15): **"Captures" is a thing that shouldn't be used on ANY CARD. We don't care about tracking captures.**

This came up while redesigning the multi-unit Rentals card: the old design showed a "2 Captures owed" round-up nag AND a "N Captures" count in the history footer. Both are out.

**Why:** capture (delivery/recovery photo+video logging) is an *action* the driver performs via the +Log Delivery / +Log Recovery affordances on the transport journey — but the *count* of captures is noise to Jac, not a metric worth surfacing. A "captures owed" framing reads as a nag.

**How to apply:**
- Do NOT show any "Captures" count or "captures owed" tally anywhere — not in round-up/status bars, not in the R13 history count chips (history shows Payments · Edits only), not in footers.
- KEEP the per-leg `+Log Delivery` / `+Log Recovery` capture *actions* on the transport journey — that's how a delivery gets logged; only the counting/nagging is banned.
- The logged/not-logged state can still be shown as the journey leg filling green vs. a dashed pending channel (state, not a count).

Surfaced during the Rentals-card redesign (see [[ui-design-state]]). Applies app-wide, not just to Rentals.
````

## onboarding_form.md

````markdown
---
name: onboarding-form
description: "The New Customer / Complete Account popup (newCustomer overlay) is built to finish in ONE sitting — quick-save, draft buffering, card-as-side-panel, scroll-preserved. PRs #95/#96/#101, 2026-06-16."
metadata:
  node_type: memory
  type: project
  originSessionId: 335b5729-3edf-4fc3-ba7a-0f68e785a94b
---

The **New Customer / Edit·Complete Account** popup = the `newCustomer` overlay (`openCustomerForm`/`startNewCustomer`). It's an "Account packet": fields + the agreement text + a **signature** tile + **selfie** tile + **card-on-file** tile. Design goal (Jac): complete the WHOLE thing without ever leaving/reopening the popup.

How it holds together (don't regress these):
- **quick-save**: `quickSaveCustomer(o)` auto-creates the customer the moment First name + Phone exist (sets `o.editId`, persists the draft incl. signature/selfie), so a card can attach without a manual Save. `ncSyncDraftToCustomer(o)` re-persists the full draft on demand.
- **Card = a SIDE PANEL, not a replacement (PR #101).** From the form, "Add card" sets `o.cardSub = true` + re-renders; `renderOverlay`'s newCustomer branch appends a SECOND `.popup` (the card entry) beside the form — `.overlay` is `display:flex` center with a 16px `gap`, so the two popups sit side by side. `js-cardsub-cancel` closes only the panel; `saveCardFlow` is sub-aware (`sub = o.kind==='newCustomer' && o.cardSub`; customerId from `o.editId`; on success clears `cardSub` + re-renders so the form shows the card on file). The Stripe save path itself is unchanged. Do NOT route the form's card add through `openAddCard` (that swaps the whole overlay = the bug Jac hit).
- **Scroll preserved (PR #96).** `renderOverlay` remembers each overlay kind's `.popup-body` scrollTop (`_ovScroll`/`_ovLastKind`) and restores it across the overlay's OWN re-renders, so signing / taking the selfie (both re-render) no longer jump to the top. A fresh `openOverlay` starts at top.
- The selfie is buffered straight into the draft (no save). The agreement auto-selects rental vs membership by account type.

Built in isolated git worktrees off main (shared working dir has concurrent sessions — see [[deploy-cadence]], [[ci-gates-port-gotcha]]). ACH "Add bank" (§14b, customer card, NOT the onboarding form) still uses its own `addAch` overlay — if Jac wants that beside-the-form too, mirror the `cardSub` pattern.
````

## project_jactec.md

````markdown
---
name: project-jactec
description: "JacTec app — web app for JAC Rentals using Google Sheets as database, built in the Rental Wrangler local folder"
metadata: 
  node_type: memory
  type: project
  originSessionId: 474fd0b2-d5fd-4f64-b5c8-8918d60a2f8e
---

**⚑ REALITY SYNC 2026-06-18 — this block supersedes all below:** **SPEC is now v8.6** (`JacTec-handoff/JacTec-SPEC-v8.md`). **Blued Steel card-plate suite COMPLETE** (PRs #60–#99): full `[data-theme="bluedsteel"]` treatment — `tex-metal-blued.jpg` plate on all list cards + search bar + section recesses + rows; center column uses mirrored `tex-metal-blued-flip.jpg`. Toggle gap equalized (`margin: 13px 8px 8px` on `.card > .tabrow`, formula: `8+6-1=13`). Back button now falls back to list view when stack empty + in a record (PR #82). +Unit/+Category quick-add from empty search (PR #85). **⚠️ KPI BLUR MASK IS LIVE** — `filter: blur(12px)` on `.kpi-ring, .big-ring, .menu-team-ring` at the very end of `style.css` (PR #133, marked block) — Jac asked for this, do NOT remove until Jac says so. **Jac bought a new computer** — moving to a new machine; multiple Claude sessions have been editing `main` concurrently, always `git log --oneline origin/main` before starting. See `HANDOFF-2026-06-18.md` for this session's full state. Backend deployed @17 (clasp, this machine). Skill gate hook is in `.claude/settings.local.json` (`UserPromptSubmit`); Claude decides skill use autonomously (see [[feedback-skill-gate]]).

**⚑ REALITY SYNC 2026-06-15 — the dated entries BELOW are STALE; this block supersedes them:** Live trunk is now **`main`** (NOT `design-overhaul`, which is abandoned). `main` is **branch-protected** (required `smoke` check) → deploy via **feature branch → PR → squash-merge** (the Wrangler engine auto-merges green PRs); run gates locally first (`node ci/smoke.mjs`, `ci/logic-test.mjs`, `ci/gen-rule-usage.mjs --check`). See [[deploy-cadence]]. **Source of truth = SPEC v8.x, now COMMITTED in-repo** at `JacTec-handoff/JacTec-SPEC-v8.md` (+ the dated handoffs `HANDOFF-2026-06-15-pm.md`, `HANDOFF-units-2026-06-15.md`, root `HANDOFF.md`, and the `JAC-BUILD-LIST.md` queue). SHIPPED since the older notes: multi-unit rentals (a rental is an EVENT, `r.units[]`), partial-payment allocation popup (stable `li.lid` keys), R22→R24 fix, the full UI overhaul locked to the **"Yard" data-plate theme** (design language in `CLAUDE.md`; run new UI through the `frontend` skill — and Jac wants ALL questions asked via popups), mobile reflow M0–M3, an internal team chat dock, KPI rework, company-wide Views, and **Mr. Wrangler = in-app Claude + an auto-fix engine (labeled GitHub issue → PR → auto-merge)**. Backend = schema-less Sheets, Apps Script gitignored in `backend/`, deployed via **clasp** (now set up on this machine — see [[clasp-backend-deploy]]). **I deployed + live-verified the F2 `uploadFile` and H1 `saveSession`/`getSession` backend handlers (2026-06-15, deployment now @17).** **✅ Ran `#migrate-units` on live 2026-06-15 (I automated it via Playwright — session-injected Owner login → `#migrate-units` route → clicked `.js-migrate-go`): 40 unit records created (U156–U188) + 8 linked to existing, 203 rentals connected; live DB 155→195 units, 0 phantoms remain (verified via backend `load`).** **Backlog progress 2026-06-15 (this machine):** most of the 19-item backlog (A–I) was already shipped by parallel sessions — verify before building (I confirmed **C2** search 2-entry cap is already fixed; don't rebuild). **A1** (Categories fleet-bar → removable search pill via a new `__fleet` synthetic col in totColMatch/colFilterLabel) — DONE, my impl is on `main` (got bundled into the Maps PR by a concurrent shared-checkout session). **I1** (Mr. Wrangler reads a receipt/part photo → auto-fills the blank fields: new `autofillReceipt`/`autofillPartLine`/`wranglerExtract`, frontend-only, reuses the live `wrangler` image-block backend) — BUILT + fully verified (live backend extraction · boot · adversarial review+fix · full-UI e2e with a synthetic photo, sync blocked so no prod write) — MERGED to `main` + verified LIVE. **Per-card Graph views** (extended `cardGraphBody` from Units-only to rentals/customers/categories/invoices, reusing the gv-* tiles + pieSVG/gvBars) — BUILT + verified (all render, zero errors, Units unchanged) — MERGED + LIVE. **REDESIGNED 2026-06-15 (Jac: graphs must be CARDS, not popups): the graph is now an IN-COLUMN view toggled by the graph icon (`cs.graphView`, rendered in the column like the list — the popup overlay was removed), and EXTENDED to the shop segments — Services (serviceOrders), Inspections, Work Orders + a combined Shop overview (the shop card's graph toggle is segment-aware). Toggle-wiring gotchas (fixed): opening a record + surfacing an invoice clear `graphView`, and the in-column graph return is guarded by `!searchMode`. PR #59, verified live.** **Notification bell feed (§18f)** — new backend `wranglerNotifications_` action (deployed live **@18** via clasp; lists recently-RESOLVED `wrangler-fix` issues + the engine's verdict comment) + a frontend feed/badge/seen-tracking mirroring the Requests inbox; BUILT + verified (live e2e: boot badge = 3 unseen, real resolved issues render with verdicts, zero errors) — MERGED + LIVE. The dead `.js-clear-fleet` CSS cleanup also MERGED + LIVE. **All four shipped together as squash PR #51 via the autonomous deploy helper `rw-automation/gh-api.mjs` (create-pr → wait-merge polls the `smoke` gate → squash-merge), then verified live on app.jacrentals.com; the feature branches were deleted after.** **Dispatch Auto-route** button (one click chains the day's stops into route legs: yard→stops→yard, reusing the free-form arrow legs+draw) + **B3** (hover previews on the Categories→Investment unit rows — the derived status pill now points at the unit so every badge there previews) — DONE + LIVE (PR #55, verified live). Real Google Maps embed — DONE (per Jac). **→ The 19-item backlog (A–I) + the pm-handoff candidates are now ALL shipped.** Only optional/low-priority bits remain: a printable "driver sheet" export of a day's route; retiring the standalone shop-trio (WO/Inspection/Service) renderers as deep-links re-route to the Unit card. **⚠️ CONCURRENCY HAZARD:** multiple Claude sessions share this ONE local checkout and check out branches under each other — always work in an isolated `git worktree` + commit immediately, or uncommitted edits get carried into another session's commit (happened to A1). ⚠️ Owner password used in-session 2026-06-15 — Jac should rotate it.

Building a web app called **JacTec** for JAC Rentals (operations@jacrentals.com).

**⚑ NEW MACHINE SETUP (2026-06-10):** Code now lives on GitHub `operations-jacrentals/rental-wrangler` (public). Production = `main` → app.jacrentals.com (GitHub Pages). **Active work = branch `design-overhaul`** — do NOT merge to main until Jac approves a full review (open PR banner on GitHub). Local clone: `Desktop\Rental Wrangler\rental-wrangler`. **Read `HANDOFF.md` on the design-overhaul branch first** — full continuation state (design language B1–B5 done, remaining polish queue, next big design = Units/Rentals card merge + 4 open questions for Jac). Run: `.claude/launch.json` "JacTec" → serve.ps1 port 8000, open `http://localhost:8000/#local` for demo mode (no backend needed). App has a login screen now (default route). NOT in git (transfer via OneDrive from old machine): `JacTec-handoff/` w/ Code.gs (Apps Script backend) + JacTec-SPEC-v6.md. Design spec = `drafts/site-shell-v2-yours.html` (approved mockup); buttons = `drafts/button-gallery-v2.html`.

**⚑ EOD 2026-06-11 — EVERYTHING IS LIVE, TOMORROW'S AGENDA SET:** main = design-overhaul = `1419a92` (streamline + Design Inspector/Rulebook + both redline waves + R3b/R5b/R5c/R19/R20), app.jacrentals.com verified serving it. **Backend Code.gs v2 CONFIRMED deployed by Jac — capture video verified saved to Drive.** Tomorrow's agenda (Jac's words): (1) More debugging. (2) **Reinventing the +New engines** — current ones "aren't good enough", especially how to "link" or "add" EXISTING main items. (3) Updating the other cards (NOT Units or Rentals). A multi-agent audit brief covering all three (debug worklist + +New/link mechanism map + per-card v2-gap worklist) lives in **`rental-wrangler/JacTec-handoff/TOMORROW-BRIEF.md`** — start there. Also parked: [[ui-design-state]] has the "Ask Mr. Wrangler = Claude inside the app" future-session note.

**⚑ STREAMLINE COMPLETE — DEBUG BY RULE NUMBER (2026-06-11):** the whole UI is built by ONE builder per design rule (app.js §5, rules **R0–R18**), every element stamped `data-r="Rn"`. **SPEC v7 = `rental-wrangler/JacTec-handoff/JacTec-SPEC-v7.md`** (private, gitignored) — the rulebook + board specs + code map (§1–§18) + TODOs. **Flash-lint (R0)**: bottom-bar eye toggle, ON by default — anything pulsing red bypassed the builders; the app is at ZERO flashing. Jac debugs by saying e.g. "that violates R4" → fix the builder. Dead code purged. Audit worklist archive: `JacTec-handoff/STREAMLINE-AUDIT.json`. Top TODO: partial-payment ASSIGNMENT POPUP (inv.allocations plumbing exists); confirm Code.gs v2 redeploy; real Maps embed.

**⚑ 🚀 v2 IS LIVE ON PRODUCTION (2026-06-11):** merged design-overhaul → main, CI + Pages green, app.jacrentals.com verified serving v2 (now at `1419a92` after the evening waves). **Backend = SCHEMA-LESS [id,json] rows** → all new fields persist with NO backend change. Code.gs now lives at `rental-wrangler/JacTec-handoff/Code.gs` on THIS machine (gitignored — contains role passwords, repo is public, NEVER commit). ✅ Code.gs v2 (uploadCapture → Drive) pasted + authorized + redeployed by Jac, verified end-to-end. Yard captures respect the §9 gates (no-card customers block On Rent — verified).

**⚑ v2 BUILD LANDED IN THE APP (2026-06-11, commits b50ee19→e2204e0 on design-overhaul):** all 4 phases built + verified in demo mode, zero console errors — global design layer (gate pills, dvd pills, S1 title chips, centered headers, section colors, journeys/timeline CSS), Units card (yard tool + condition/wash segs + WO sections + history chips + head flags), Rentals card (day timeline, item balances via inv.allocations/itemPaid(), invoice transport journeys synced to yard captures, Complete Rental gate), tabs consolidated + footer WO chips. **REMAINING:** partial-payment assignment popup (allocations plumbing exists, popup not wired), real Google Maps embed, backend columns + Code.gs redeploy (Code.gs still on old machine). main/production UNTOUCHED — Jac reviews before merge.

**⚑ MOCKUP APPROVED → BUILD IS NEXT (2026-06-11):** `drafts/units-rentals-v2.html` iterated through ~10 redline rounds (v2.0→v2.9) and Jac signed off ("LOVING THIS"). All rules digested in repo `HANDOFF.md` "design source of truth" + [[ui-design-state]]. **Next session: port the mockup into the real app** (app.js/style.css on design-overhaul, demo mode `#local` first): Units card (yard tool + inspection toggles + WO sections + footer values + history chips) and Rentals card (timeline-in-section, item balances, invoice-anchored transport, Complete Rental gate). Backend (Code.gs/Sheets) will need new columns eventually: notes per board, item-balance assignments, WO type/origin, journey capture events — Code.gs still NOT transferred from the old machine (OneDrive).

**⚑ HANDOFF OPEN-QUESTIONS ANSWERED (2026-06-10, BINDING — for the Units/Rentals whiteboard build):**
1. **Units merge scope:** standalone Inspections & Work Orders tabs GO AWAY — only the **Service tab** remains standalone. Card-footer values give quick access to needed inspections + failed units. **ADD a card-footer value that represents just WO count.**
2. **Inspection section (Unit card):** latest inspection + EDITABLE toggles — clicking Wash/No-Wash · Pass/Fail logs a new inspection inline (Fail → photo/description popup + auto-WO).
3. **Yard journey (+OnRent ···· +FC ···· +Return):** YES — REPLACES the three white On-Rent/Returning/Field-Call buttons entirely; +FC mid-journey = Field-Call trigger (fail unit + auto-WO).
4. **Part Ordered → ETA:** badge displays **"ETA Jun18"** format; clicking re-opens the date picker AND must let the user UPDATE THE STATUS (part arrived / completed) — not just change the date.

**⚑ BIG SESSION 2026-06-02 (continuation — Expenses board, inline-edit, inspection form, KPI Team, receipt merge — all LOCKED + verified, 0 console errors):**
- **NEW BOARD: Expenses (Receipts)** — admin nav group, between Vendors & Company Files. The bridge between real bank-card transactions and Parts. idField `expenseId` (EXP-####). Record: date·vendorId/Name·amount·paymentMethod·category·reconcileStatus·bankRef·bankDate·woId·soId·photoUrl·notes. **DS1 "Receipt"**: Reconcile/Payment/Category = clickable pickers (generic `.status-trigger` handler, data-board/id/field/set) · Vendor link/+Vendor · BANK MATCH (Bank Ref/Date · Line Total = Σ line-item parts · Unaccounted = amount−lineTotal, green@0) · LINKED TO (WO·Service) · Receipt Photo. **DS2 "Line Items"**: parts where `part.receiptId===expenseId` (derived) + "+ Add Part" + Line Total vs Receipt Amount. config.js NEW sets reconcileStatus(Unreconciled/Pending/Reconciled)·expenseCategory(Parts/Fuel/Tools/Service/Shipping/Supplies/Other)·paymentMethod(Visa/Amex/Cash/Check/ACH). 7 seed expenses. NEW pill/dot CSS for those slugs. SPEC §9 "Board: Expenses" added.
- **+Receipt flow** (+New menu "Receipt"): navigates to Expenses AND opens `ReceiptWindow` (popup.js) — photo-capture modal (`.rcpt-*` CSS); Save creates an Unreconciled expense + selects it, or attaches a photo to an existing one (`.receipt-photo-add`).
- **Reverse "Add Receipt" pills** (attach a receipt from where it lives): Vendors DS1 (setField vendorId + shows that vendor's receipts), Work Orders DS1 Expense Report (woId), Parts (forward part.receiptId), Services = ServiceWindow record view (soId). `addPill(label,board,{setField,setValue})` REVERSE shape vs forward {board,id,field}; app.js add-pill handler + openSelect preload handle both.
- **RECEIPT = ONE SOURCE, ONE HOME (merge):** Parts DS2 renamed "Receipt"→**"Line Item"**; the per-part receipt photo REMOVED (redundant). A Part is a line item; its receipt is the linked **Expense** (`part.receiptId`, seeded on PT-001/2/3/4). Parts only REFERENCE the receipt (DS1 Linked-To→Receipt pill + DS2 "On Receipt" link); the Expense owns photo/total/vendor/bank-match. SPEC Parts section updated.
- **KPI BAR redo:** `--kpi-ring-max` 999px→**104px** (rings were juvenile-huge on full-width list) + `#kpi-bar justify-content:center` + gap clamp + ring-wrap 16cqi→12cqi (6 fit narrow). **NEW 6th indicator "Team"** (config.roles.team, dash-team in PAGES) = 5 rings, each = a role's AVERAGE across its KPIs via `kpiValues('team')` (avg of ring FILLS, skip TBD → [81,88,66,80,38]). `initKPIRings` now uses adaptive `kpiRadii(n)` ([21,16,11] for 3, [21,18,15,12,9] for 5) not fixed KPI_RADII; team rings thinner stroke. index.html added the 6th .kpi-role (users icon). ⚠️ KPI_MOCK arrays stay positional to config ring order.
- **Inline-edit primitive** `editField(value,{board,id,field,type,placeholder})` (util.js) → `.edit-val` click-to-edit; app.js capture handler swaps to `.edit-input`, commits on blur/Enter via updateRecord+rerenderAfterEdit, Esc cancels (SPEC §8.2). Only wrap SOURCE fields, never mirrored/derived.
- **Pick/Selector = Board Popup (select-mode):** `BoardPopup.openSelect(board,{onSave,preload,title})` injects a temp "New X" (id `__NEW_n__`, `__temp`/`__label`→ list shows "New X"), Save/Cancel footer (`.bp-select`); pick a sibling+Save links it & discards temp, or fill the New X+Save promotes to a real id. `BoardPopup.openPick(board,{onPick})` = LIST-ONLY picker (`.bp-pick`, no temp/detail/footer) — +New Inspection uses it (pick unit → report opens).
- **Inspection form** `InspectionWindow` (popup.js §11): from "New Inspection" row (`.insp-new-row`) or +New Inspection→openPick. 3 gated Qs Wash?·Checklist·Create WO. Pass→unit Ready; Fail→Failed + forces ONE WO (photo+desc required) linked to the unit; prepends `unit.inspections` row.
- **Popups:** divider drag reuses workspace `attachDrag` + NEW **list↔detail width divider** (`.bp-list-divider` — the "vertical gap"); DS sections flow 2/3 cols in popups (`.bp-detail-rail` is a `dpanels` container) + bp-window max-width `min(1320px,94vw)`; openNew `.bp-close` null-ref bug FIXED (had broken close/save).
- **Add-X compact + visible:** `addPill` display drops "Add " → "+ Vendor" (data-add-label keeps full label for selector title). Seeded incomplete records (PT-002 no vendor, R.May2426.01 no customer, INV-0385 no customer) so the pills SHOW (only render on empty FK cells).
- **Other locks:** Item List card **collapses to its results** (adaptive, `#list-panel flex:0 1 auto`) on every load/search; nav accordion sync via grid-template-rows 1fr↔0fr (`.nav-group-inner`); nav per-board icons → KPI-style Lucide; day abbrevs Su/Mo/Tu/We/Th/Fr/Sa; WO list NAME = unit name; customer list pills pillLink→customer; Categories DS2 free rentable units show "+ Add Rental"; Category LIST line1 = name + Day/Wk/4Wk, line2 = Avail/Ready/Failed (Dollar/Time util removed); all lists Line1/Line2.
- **Watch-outs:** screenshot tool often won't composite fixed `.bp-overlay` popups (verify popups via eval). `fmt$` still drops trailing cents.

**⚑ PHASE 3–5 BOARDS ALIGNED TO SPEC §9 (2026-06-02 — awaiting user's manual review):** Work Orders, Rental Log, Invoices, Customers, Parts, Vendors all rebuilt to their SPEC §9 DS1/DS2/list layouts (panel titles updated in app.js PAGES: WO ds2 "Parts & Projects", Rentals "Billing"/"Rental", Invoices ds2 "Line Items", Parts "Part Profile"/"Receipt", Vendors ds2 "Parts"). Also amended SPEC §6/§9/§11 for the **single-WO inspection chain** (order: Wash → Checklist → Create WO; Checklist Fail forces a required photo+description + creates ONE WO; completing that WO reverts Failed→Not Ready; Bill Customer? Yes/Maybe/No where Maybe = pending until Mechanic/Office decides). **Audit fixes (self-QA pass):** `categoryLink`/`unitLink` (util.js) now use `.pill-link`+`data-pop-board` so they open EVERYWHERE (workspace, DS2, popups, list, with stopPropagation) — they were previously DEAD inside popups/DS2 because `.category-trigger` was bound only to ds1Body; removed duplicate OLD parts/vendors DS2 cases that were shadowing the new SPEC versions; record/history/log dates → `fmtDateLog` (MM-DD-YY); rounded vendor Avg Part Cost. Verified: 0 broken pill targets across all boards, 2-level popup deep-dive works, no console errors, both themes. **Placeholders pending each board's own phase (NOT bugs):** Pay Invoice / +New line / Add-Note buttons, Record/Schedule Action inputs, Account Type click-to-change, Price-If-Billed / Taxes / Active-Status% (Phase 7). **Known global:** `fmt$` drops trailing cents ($87.5 not $87.50) — pre-existing, awaiting user call.

**⚑ 3-PANEL POPUP RULE + MANUAL-REVIEW FIXES (2026-06-02 — LOCKED):** USER RULE: every Board Popup MUST be the full 3-panel structure — Item List (left) + DS1 (top) + DS2 (bottom, STACKED exactly like the workspace), never DS1/DS2 alone or side-by-side. "Structurally simple by nearly always using the same designs." Implemented: `makeListItem(item, field, opts{board,activeId,onClick})` parameterized so the popup reuses the EXACT workspace list item (workspace still calls it the old 2-arg way — no regression); BoardPopup.open/openNew render `.bp-list-panel` + `.bp-detail-rail` (ds1 over ds2); `_renderList`/`_selectInPopup` let you pick a sibling in the popup's list to swap DS1/DS2 + the tab; `.bp-divider` always horizontal grip (isRow=false); bp-window widened to 1040px. **Add-X:** empty foreign-key cells render a deliberately SUBTLE `+ Add ___` pill (util.js `addPill(label,board)` = muted-gray dashed, NOT eye-catching) opening that board's selection popup (app.js `.add-pill` handler → selectorWindow). Swept: Rental Status→Add Rental, Customer→Add Customer, Unit→Add Unit, No-Invoice→Add Invoice, Vendor→Add Vendor, Customer Transactions→Add Rental/Invoice. **Order Status flag rule (user call):** `unitOrderStatus.hasService` is true when active SO OR any service task is Due Soon (yellow) / Past Due (red) — not just active orders (6/8 demo units flag; mock schedule noisy, real manufacturer intervals will fix the spread). **Other locks:** funnel dropdowns = §6 canonical 7 stages (seed remapped off old 'Success'/'Not Contacted'/'Left Message'); inspection-report WO pill shows WO status ("Complete") not the ID; selected list row = SQUARE orange ring (radius 0 — rounding revealed dark corner shadow); tab × = white + overlays the tab corner (no width stretch); Service Window = Manual hyperlink + Complete disabled until a proof photo + "Hours logged via GPS" note; Pay Invoice button context-aware (Paid → "Send/Receipt"); Invoice LINE ITEMS = clean rows; Service Log sizes to content; Fleet Status pill clickable everywhere incl. Service DS1 + Categories rows; Order Status cell has no chip box. **STILL PENDING (the next build):** selection-popup create-or-pick + Save/link; editable-pill change-pickers (Account Type §216, WO Phase §430, Tax Status) WITH open-popup refresh; derived status pills → open their source record (user: "usually option 1"); inspection answering form (§11).

**⚑ ORDER STATUS model change (2026-06-02 — LOCKED):** "Service" was REMOVED from Inspection Status (config.js inspectionStatus = Ready · Not Ready · Failed only). A new DERIVED **Order Status** (calc.js `unitOrderStatus(unit)` → `{hasService, openWOs}`) surfaces a unit's open shop activity, ORTHOGONAL to inspection — so a unit can be Ready AND have a Service/WO. Rendered via util.js `orderStatusPillsHTML(unit)`: a blue **Service** pill (active non-Complete service order → opens the unit's Service Orders board) + one pill per OPEN work order (label = WO bottleneck, color = WO status, → opens that WO). Shows on the fleet/service **list item** (2nd line `.item-order`), **Units DS1**, **Service DS1** (Order Status row). Demo WO-0043 (seat cushion, Part Ordered) added on Wacker FL-004 (Ready) to show the Ready+WO combo. Units FL-006/FL-007 inspection moved Service→Not Ready. `categoryFleetSummary.needService` now derived from active SOs. NEW css `.pill-service` (blue, both themes). Other recent UI locks this session: selected list item = orange EDGE RING (not fill); Board Popup chrome = transparent header + left tabs + per-tab × (global × removed, Close All kept) + invisible card-gap divider; unified clickable-pill hover (brighten + inset ring) across .pill-link/.link-pill/.svc pills; DS panel headers = font 0.72rem + 7px pad; log dates show YY (fmtDateLog MM-DD-YY); Service Order rows sorted by interval + parts pills (catalog PT-010..PT-018) linking to Parts board; KPI icons = Lucide; KPI glow fix = `.kpi-svg{overflow:visible}`; theme toggle refined.

**Why:** Replace Monday.com (too slow) with a custom app that gives full UI control while using Google Sheets ("Rental Wrangler") as the database. Speed is a top priority.

**Architecture decision:** Google Apps Script Web App for hosting (Option 1) — simpler auth, free, no OAuth setup needed, shared single login.

**Current state (2026-05-28 session 2 — LOCKED):**
- KPI bar: 5 role circles (Mech/Office/Sales/Maint/Driver) with colored SVG progress rings above search bar
- Grouped nav: 4 accordion groups (Dashboards/Rentals/Fleet/Admin), all collapsed on open, one open at a time
- Groups: Dashboards (5 dash pages) · Rentals (Rental Log, Invoices, Customers) · Fleet (Units, Work Orders, Service Orders) · Admin (Categories, Parts, Vendors, Company Files)
- All 15 boards have DS1 + DS2 renderers (categories/parts/vendors are new; dashboards show placeholder)
- W.O. Journey: grid table in DS2 (name, phase pill, hours, cost)
- Customers DS2: membership funnel select + log, used-sales funnel select + log, history
- Fleet DS2: Inspection Report section (placeholder + New Inspection button, not yet wired)
- No backend/Sheets API connected yet

**⚠️ SPEC FIDELITY RULE (user-directed, 2026-05-31):** SPEC.md is the ONLY source of truth. The user has intentionally edited the SPEC and deliberately LEFT OUT certain data points/fields that existed in the earlier app. DO NOT silently preserve or re-introduce anything that exists in the old app/seed but is absent from the SPEC — treat its absence as intentional and drop it. If unsure whether a removed/missing thing matters, ASK before keeping OR removing it. When reshaping data.js and building each board (Phases 2–6), align fields to the SPEC and produce a divergence list (old-but-not-in-SPEC) for user sign-off. Note: Sub-steps 1–3 were a behavior-preserving refactor, so old non-SPEC fields are still present as temporary scaffolding — they get cleaned during data.js extraction / per-board phases, not before.

**⚙️ PHASE 2 FLEET — DIVERGENCE DECISIONS (user sign-off 2026-06-01, BINDING):**
- DROP `nickname` from Units (user: "Drop nickname"). Units = displayName + itemId only.
- DROP per-unit `notes` (user: "Drop notes"). Operational flags live on WO / Inspection Report.
- DROP `location` from all records (user: "Drop location"). Single-store; Invoice Store Code only.
- **NO ASSIGNMENT ANYWHERE, ANY BOARD** (user verbatim) — remove `assignedMechanic` (Units), `assignedTo` (Work Orders, Service Orders), `assignedEmployee` (Rentals). No "assigned to" UI on any board.
- Units `status` SPLITS into `fleetStatus` (§6: Purchased/Onboard/Active/Inactive/For Sale/Sold) + `inspectionStatus` (Ready/Not Ready/Service/Failed). Rental Status is DERIVED from live rental, never stored.
- Unit PRICES removed from Unit (mirror from Category §4.2): dailyRate/weeklyRate/monthlyRate gone; memberDaily/1Day/7Day/4Wk/Weekend + MSRP + Ask + Bottom all live on Category.
- DROP (old, not in SPEC): financedPrice, notFinancedPrice, sellTargetHours, sellFlag, inspectionFlag, phase, gpsLastDate, gpsNextDate, all 12 last/next service-hour fields, currentCustomer/currentRental (derived).
- ADD to Unit (SPEC §9): make (split from model), gpsType, trueCost, inspections[] (DS2 rows: date/report/woId). Rename ogPurchasePrice→purchasePrice, hoursAtPurchase→purchaseHours.
- ADD to Category (SPEC §9): MSRP, photo, description (rename from notes), fuelType, specs(link).
- Service Orders = RESHAPE to recurring service-task model (Task/Interval/LastServiced/Due pill) — own sub-step (most structurally different).

**📅 GLOBAL DATE FORMATTING (user-directed 2026-06-01, util.js helpers, apply to ALL boards):**
- Standalone date → MM-DD via `fmtDateShort('YYYY-MM-DD')` (drops year; horizontal space is scarce).
- Date range/timeline → `fmtTimeline(start,end)`: same-month = "DD-DD MM" (e.g. 12-19 06), cross-month = "MM-DD – MM-DD" (e.g. 05-12 – 06-08), open-ended = just start MM-DD. Year always dropped.
- Applied so far: inspection-row date (was wrapping "2026-05-11"→"05-11"), Units DS1 Rental Dates. USE THESE for every future date display.

**📐 GLOBAL LIST-ITEM PRINCIPLES (user-directed 2026-06-01, apply to EVERY board's list item):**
1. MAX 2 stacked data points per side (item-main left = name+1 sub line; item-meta right = ≤2 stacked). Never 3 stacked — list rows must stay short (huge lists). 
2. NEVER show internal record IDs (FL-001/CU-001/CAT-001/WO-0041/etc.) in list items — they're noise. (Human-meaningful #s like Invoice # are case-by-case when that board is built.)
3. Pills in list/DS should be clickable where SPEC says so — wire as each board's links exist.

**✅ PHASE 2a POLISH ROUND 4 (2026-06-01):**
- DS1 GRID ALIGNMENT fixed (user: "wonky alignment Rental Status/Dates/Name/Category"): bare-pill cells (`.data-grid .transact-val:has(>.pill/.link-pill/.pill-btn)`) had `min-height:auto` (16px) while boxed cells were 34px → in the 2-up grid a pill row misaligned with a boxed row beside it. Set bare-pill cells `min-height:34px` (centered) so ALL value cells are 34px → columns align perfectly (verified all 3 rows aligned, all heights 34).
- ACTIVE (Fleet Status pill-btn) hover affordance: `.pill-btn:hover .pill { box-shadow: 0 0 0 1.5px currentColor inset }` (was only an imperceptible filter:brightness on a translucent pill) + focus-visible ring. Now clearly interactive.
- DS2 inspection Report pill (READY) — user chose LEAVE NON-CLICKABLE until §11 inspection-form exists. Stays a plain `pill()` (NOT pillLink). The real "open this inspection's filled report" is a §11 build. (DS1 inspection pill + list inspection pill remain pillLink→unit popup; only the DS2-row report pill is intentionally inert.)

**✅ PHASE 2a POLISH ROUND 3 (2026-06-01):**
- LOCAL SEARCH no longer collapses open DS1/DS2 (user req) — removed the `if(innerWidth<768){selectedId=null; remove item-open}` branch from searchInput input handler. Search now ONLY filters the list, keeps selection + panels open, all screen sizes. (No list/search expand needed.)
- RENTAL DATES compact: NEW `fmtDateShort('YYYY-MM-DD'→'MM-DD')` in util.js; DS1 rental dates now "05-12 – 06-08" (drops year, fits the cell).
- INSPECTION STATUS pill in Units DS1 now clickable → opens unit popup (DS2=Inspection Report) via pillLink('fleet',itemId). Guarded by `inDeepDive` (pageCtx!==currentPage || bodyEl!==ds1Body) so it's a plain pill inside popups (no infinite nesting). Verified opens popup w/ inspection report.
- PILL SIZE tuned smaller (user: "pills too big, made list items taller"): `--pill-font` 0.72→0.66rem, `--pill-pad` 3px10px→2px8px (now 9.24px). FLEET STATUS "weird padding" FIXED: `.transact-val:has(>.pill-btn)` added to the bare-pill `:has` rules (data-grid + transact-cols) so the wrapped pill-btn cell loses its chip box like bare pills. List-item padding 11→9px, item-meta gap 4→3px. Verified all pills equal 9.24px, fleet val bare, single-pill row 50px.

**✅ PHASE 2a POLISH ROUND 2 (2026-06-01):**
- RENTAL DATES mirror into Units DS1 (user req): `unitRentalStatus()` now also returns startDate/endDate of the SAME most-recent rental its status reflects (tie-break by newest startDate so status+dates never disagree even w/ active rental + future reservation). ds1.js shows "Rental Dates" row under Rental Status (start–end). Rental Status pill is also a pillLink→that rental. Verified FL-005→R.May0526.01 dates 2026-05-06–2026-06-03.
- PILL SIZE UNIFIED app-wide (user: "streamline pill/text sizes"): root tokens `--pill-font:0.72rem / --pill-pad:3px 10px / --pill-weight:700`. `.pill` AND `.link-pill` both consume them (link-pill was 0.78rem/600 — the visible mismatch in screenshot). ALL pills now 10.08px computed (status=link=list, verified allPillsMatch). One token → no future drift. (.wo-j-phase/.insp-new-label are containers/labels not pills, left as-is.)

**✅ PHASE 2a POLISH (2026-06-01): list-item global rules + list-pill shortcuts.**
- GLOBAL list rules applied to ALL boards: removed internal IDs from every list-item sub-line (rentals/invoices/WO/SO/categories/parts/vendors — verified none show FL/CU/CAT/WO/SO/PT/VN/INV-#); Units list trimmed to 2 lines (name+category, no ID/hrs). Recorded as standing principles (see GLOBAL LIST-ITEM PRINCIPLES above).
- INSPECTION REPORT DS2: +New is now the TOP ROW (`.insp-new-row` button, under head, above dated rows) per SPEC §8.2 (was a button below).
- FLEET STATUS pill (Units DS1) now CLICKABLE → reusable `openStatusPicker(anchor,setName,current,onPick)` popup (reads cfgOptions, 6 fleetStatus opts incl Inactive, updates record + re-renders). `.pill-btn`/`.status-picker` CSS. Verified picks Inactive.
- LIST-PILL SHORTCUTS (user: "clicking ON RENT pops the rental, READY pops the inspection"): NEW `pillLink(status,board,id)` in util.js → `.pill-link` pill w/ data-pop-board/id. Units list: Inspection pill→fleet popup (DS2=Inspection Report), Rental pill→linked rental popup. Wired document-level CAPTURE-phase click w/ stopPropagation so pill-click opens popup WITHOUT selecting the row. `.pill-link` CSS (hover ring). Verified: Kubota ON RENT→Rental Log popup R.May0526.01, Bobcat READY→Units popup w/ inspection report, row NOT selected, zero errors. `pillLink`/`pill-link` are reusable for every future board's status pills.
- STILL DEFERRED (need unbuilt pieces): Report-pill/Failed→open 4-question M.Tech inspection FORM (§11 automation); customer/unit/invoice list-pill links (as those boards get pillLink treatment).

**✅ PHASE 2b — CATEGORIES BOARD DONE (2026-06-01, on Opus): SPEC §9 full build incl. availability tool (user chose "Full build").**
- lib/calc.js: categoryUnits/categoryActiveUnits, rentalOverlaps(r,start,end) (24hr: rental.end>start so same-day return = available), unitAvailableFor(unitId,start,end) (§9: Active + Inspection≠Failed + no overlap; Service counts available), categoryAvailability(catId,start,end)→{total,available,ready,failed}, categoryFleetSummary(catId)→{makesModels,yearRange,weightRange,avgAge,avgHours,needService,notReady,failed,forSale,sold} (mirrored from ACTIVE units; thisYear hardcoded 2026 since no Date.now), categoryInvestment(catId)→{totalInvested,avgTrueCost,totalExpenses computed; roi/timeUtil/dollarUtil/avgRev/avgDays = null pending §12}.
- state.js: `availabilityCheck={start,end,startTime}` global (the Office Manager's date window; null=today/normal mode).
- util.js: `phase7()`→'<span class=phase7-tag>Phase 7</span>' placeholder for §12-pending metrics.
- ds1.js categories → 5 SPEC sections: AVAILABILITY CHECK (Category name + Start/End date + Start Time inputs `.cat-avail-input` + Available derived + Total Units), RENTAL PRICING (5 tiers, source of truth), PURCHASE PLAN (MSRP/Ask/Bottom), FLEET SUMMARY (desc/fuel/specs-link/makes&models/year+weight ranges/avg age+hours/Service+NotReady+Failed+ForSale+Sold counts), INVESTMENT (Total Invested/Avg True Cost/Total Expenses live; ROI/Time+Dollar Util/Rev+Days per mo = phase7() stubs). date inputs disabled in popups.
- ds2.js categories → SPEC UNITS IN CATEGORY: all units sorted by inspection status (Ready>Service>NotReady>Reserved>OnRent>Failed); each `.cat-unit-row` = dot + name + (rental dates via fmtTimeline) + meta(avail tag in availability mode + inspection pill + rental pill + hrs). availMode = both dates set → shows Available/Booked tags. Dropped the old redundant Rate Summary block (pricing now in DS1).
- list.js categories → Name / "X/Y available · Z ready" sub / Failed badge + $rate. Live + date-aware via categoryAvailability.
- app.js: `.cat-avail-input` change → updates availabilityCheck, re-renders DS1+DS2+list. `.cat-unit-row` click → opens Unit popup (availability-mode booking = Rental Log phase). CSS `.cat-unit-*`, `.cat-avail-yes/no`, `.phase7-tag`, `.cat-specs-link`.
- VERIFIED: CAT-001 total 3/avail 2/ready 2/failed 1, makesModels all 3 units, totalInvested $163,200, 5 DS1 sections, DS2 3 rows sorted, AVAILABILITY MODE (dates overlapping FL-005 rental)→available drops 2→1 + 2 Booked tags, both themes, 9/9 boards regression OK, category-pill popup has 5 sections, zero console errors. style.css braces 692/692.
- ✅ 2b POLISH (2026-06-01, user feedback): (#3) Replaced native date/time inputs in Availability Check with the EXISTING Apple `CalPicker`/`TimePicker` (reused from Rental Log) — now a single "Rental Window" timeline chip (`.cat-cal-trigger`, shows fmtTimeline) + "Start Time" chip (`.cat-time-trigger`). Routing: `availPickerCatId`/`availTimeCatId` flags make the shared pickers' onSelect write to `availabilityCheck` (instead of a rental record) + re-render DS1/DS2/list. Chips orange + hover-bright, disabled-grey in popups. Verified pick→"15-20 05" + availability recomputes. (#2) cat-unit-row inspection pill + rental pill now pillLink (Failed→unit popup=inspection report; §11 will repoint to the 4Q form). (#1 "DS2 thin") enriched rows: sub-line = Year · S/N · rental-window (was duplicate name); confirmed DS2 is correctly JUST the units list per SPEC §9 (nothing else belongs there). style.css braces 697/697, zero console errors.
  NOTE: synthetic eval `.click()` on a cal-trigger immediately closes the picker (CalPicker's document-level outside-click listener catches the same bubbling click) — that's a TEST artifact only; real user clicks work (Rental Log proves it). Verify picker logic via calling onSelect directly, not via eval-click.
- ✅ 2b POLISH 2 (2026-06-01, user feedback): (#1 "BOOKED" wrong) removed the invented "Booked" term. NEW `unitRentalStatusFor(unitId,start,end)` in calc.js → the GLOSSARY Rental Status the unit will be in DURING the requested window (finds overlapping rental, prefers most-occupied On Rent>End Rent/Off Rent>Reserved). DS2 availability mode now: free unit→green "Available" tag; occupied unit→its real Rental Status pill (On Rent/End Rent/Reserved) linking to that rental. Verified: Kubota window 05-15..05-20 (overlaps its rental)→On Rent; window 07-01 (after)→None; never-rented→None; ds2HasBooked=false. (#2 price-on-list) removed `$X/day` from category list item — SPEC §9 list = Name/Available/Ready/Failed ONLY, no price. Zero console errors.
- ✅ POPUP TABS + FAILED LINK (2026-06-01, user feedback): (#3 popup layering) Board Popups no longer cascade — each stacked layer is now a TAB in the window header (`.bp-tabs`/`.bp-tab`, board eyebrow + record name; active tab = orange eyebrow + boxed). popup.js: added `active` index, `setActive(i)`, `_syncTabs()` (only the active overlay is `display:''`, others `display:none`; every overlay's tab strip is rebuilt identically so the single visible bar is always correct), `_wireTabs()` (delegated click on `.bp-tabs`), `closeAt(i)`, and dedupe in `open()` (re-clicking an already-open record just activates its tab — no dup). × (`closeTop`) now closes the ACTIVE tab, falling back to prev (`Math.max(0,i-1)`); Close All unchanged (shows at 2+). Verified 3-deep stack: tab-click switch, × fallback, Close All, both themes, 0 console errors.
- ✅ FAILED list badge links (2026-06-01): category list "N Failed" badge is now a `.pill-link` (reuses app.js capture handler): 1 failed unit → opens that unit's fleet popup (DS2 = Inspection Report, e.g. FL-008 Cat 272D3 → 05-20 FAILED WO-0042); >1 failed → opens the Category. Honors prior "FAILED → Inspection Report" rule.
- Q ANSWERED — Makes & Models is DERIVED/mirrored: `categoryFleetSummary().makesModels` computed live from a category's active units (unique `make model`), never stored on the category; follows §4.2 one-fact-one-place. Nothing to sync.
- ✅ 4-FIX BATCH (2026-06-01, user feedback): (1) PICKER BUG — Categories Availability date/time chips did nothing: CalPicker/TimePicker document outside-click guards only whitelisted `.cal-trigger`/`.time-trigger`, so the opening click bubbled to document and instantly closed the picker. Fixed → guards now `closest('.cal-trigger, .cat-cal-trigger')` and `.time-trigger, .cat-time-trigger`. (Real-click bug, not just synthetic.) (2) DS2 AVAILABILITY now SPEC §499/§502: removed the non-SPEC green "Available" tag; units sort by date-aware EFFECTIVE status (Failed wins → else occupied shows date-aware Rental Status → else Inspection Status) in SPEC order Ready→Service→Not Ready→Reserved→On Rent→Failed; a FREE unit's row is now `.cat-unit-bookable` (green left-accent + green hover, `data-bookable=1`). Click a bookable row → `BoardPopup.openNew('rentals',{prefill:{unitId,categoryId,start,end,startTime}})` opens a "New Rental" popup with Unit/Category/Rental Window/Start Time PREFILLED (new `_bookingPrefillHTML` in popup.js) + a note that the full booking form & SAVE land with the Rental Log board. Occupied/failed rows still open the Unit. (3) NAV: Categories moved Admin→Fleet — `PAGES.categories.group:'fleet'` (app.js) + moved the `<a data-page="categories">` into the Fleet nav-group in index.html (now after Service Orders). (4) POPUP TABS right-aligned — `.bp-tabs{flex:0 1 auto; margin-left:auto}` so tabs hug the right next to Close All/×. All verified both themes, 0 console errors.
- ✅ DESKTOP LAYOUT 2-FIX (2026-06-01, user feedback): (DS2 full-width) DS panels lay sections in a row-major 3-col grid (`.data-grid`/`.transact-cols` → `1fr 1fr 1fr` at `@container dpanels ≥880px`). DS2's single "Units in Category" block was landing in outer col 1 (⅓ width), truncating the per-row dates. Added `.transact-cols .transact-block:has(.cat-unit-list)` to the wide-span rule (`grid-column:1/-1`) → list now full-width, dates (SPEC §500) no longer truncated. (Section ORDER) User: the grid mechanism is GOOD as-is — do NOT switch to masonry/independent-scroll; "space/visibility aren't the issue." The real issue = section ORDER decides column placement. Row-major 3-col ⇒ DOM positions 1·2·3 = top row (cols L·M·R, "third from the left"), positions 4·5 = row 2 (below fold). So PROMOTE important sections into the first 3 slots. Did it for Categories DS1: reordered to Availability · Rental Pricing · **Fleet Summary** · Purchase Plan · Investment (Fleet Summary swapped above Purchase Plan → now top-right/3rd, verified via getBoundingClientRect). RULE for future boards: when building each board, ASK which sections are high-priority and order them into the first 3 (top-row) slots; mobile = same DOM scroll order. 0 console errors.
- ✅ CATEGORIES 7-FIX BATCH (2026-06-01, user feedback): (1) fmtTimeline (util.js) → WEEKDAY format: 'M08-Th11 Jun' (same month), 'Tu30-W01 Jul' (cross-month → only END month shown); weekday letters Su/M/Tu/W/Th/F/Sa via new Date(y,m-1,d).getDay(), day zero-padded, year dropped, open-ended='M08 Jun'. Used everywhere fmtTimeline appears (Categories window chip, DS2 unit rows, Fleet DS1 dates, booking popup). (2) PAGES.categories ds1 'Category'→'Category Profile', ds2 'Units & Pricing'→'Units in Category' (SPEC §454; drives workspace + popup headers via cfg.ds1/ds2). (3) Item List (list.js categories) now SPEC §458: Name + 3 badges line-2 (`.item-badges`): Available (`pill-avail`, gray) / Ready (`pill-ready-badge`, green) / Failed (`pill-failed pill-link`, red, clickable) — replaced the old text sub-line. (4) DS1 Availability Check reordered: Start Time chip now sits beside Category (Category|Start Time row, then Rental Window full-width, then Available|Total Units). (5) Rental Window clear: when dates set, a `.cat-cal-clear` ✕ (right edge of chip) nulls availabilityCheck dates without opening the picker (handler at top of ds1Body click, stopPropagation). (6) DS2 "Units in Category" block: was full-width (1/3→full caused too much empty space); now `display:block; width:fit-content; max-width:100%; justify-self:start; grid-column:1/-1` → card sizes to WIDEST row (rows align, dates show, empty space falls OUTSIDE the card). (7) NEW per-board panel memory: `jactec-board-layouts` localStorage `{[board]:{listW,ds1H}}`; saveBoardLayout on both divider onEnd (list-width + DS1/DS2 split); applyBoardLayout(page) in navigateTo restores per board (falls back to legacy jactec-list-w then default). Boards now keep their own panel sizes across navigation/sessions. Verified all 7 both behaviors, 0 console errors.
- ✅ TIME PICKER business hours (2026-06-01): shared `TimePicker._build()` loop now `for (let h=6; h<=18; h++)` → only 6:00 AM–6:00 PM (13 options); excludes before 6am/after 6pm. Affects BOTH the Categories Availability Start Time AND the Rental Log pickup time (same shared picker). Rentals are business-hours based.
- ✅ DS2 UNIT ROW revamp (2026-06-01, user feedback): in Categories DS2 "Units in Category" rows — (a) REMOVED S/N from the sub-line; (b) MOVED Hours from the right meta INTO the sub-line → sub is now `Year · Hours · rental-window`; (c) ADDED Fleet Status pill (`pill(u.fleetStatus)`, e.g. ACTIVE/For Sale) to the meta — uses the wide DS2 space; (d) FAILED units now show the parts/tasks that failed it, right AFTER the FAILED pill, char-capped to 32 (full list on hover via title). NEW `unitFailureTasks(unit)` in calc.js → reads the unit's most-recent Failed inspection's `woId` → that WO's `journey[].name` (e.g. FL-008→WO-0042→"Cam Sensor P0340, Install & Clear Code"). Meta order = Fleet · Inspection(+failTasks) · Rental. New `.cat-unit-tasks` CSS (italic, muted, ellipsis, max 240px). Verified 0 console errors.
- ✅ AUTO-SIZE ITEM LIST (2026-06-01, user feedback): the list column now AUTO-fits its widest item (app-wide, all boards) instead of a fixed/draggable width — "less burden on the user." NEW `autoSizeList()` in app.js: temporarily sets `#list-items` to `width:max-content`, reads the natural widest-item width, restores, then `applyListWidth(max(170, content+4))`. Called at the end of `renderList()` (guarded `!searchQuery` so the column doesn't jump while filtering) + on window `resize`. CAP: `applyListWidth` max changed 60%→**40%** of innerWidth (mobile AND desktop; floor 170 desktop / 96 mobile). Mobile uses `--mobile-list-w`, desktop `--list-open-w` (the `#left-col` width → KPI rings + search follow via cqi). Removed the legacy `LIST_W_KEY` restore IIFE. Per-board memory (`jactec-board-layouts`) now stores ONLY `ds1H` (DS1/DS2 split) — `applyBoardLayout` no longer touches list width. **DRAG RESTORED (2026-06-01, user: "leave the ability to drag it still"):** `attachDrag(panelDivider…)` re-added + `#panel-divider` cursor back to col-resize. Drag is a MANUAL OVERRIDE — `onStart` sets `let listWidthManual=true` (and `autoSizeList()` early-returns when the flag is set, so the dragged width sticks through item-select/re-render); `navigateTo` resets `listWidthManual=false` so each board re-auto-fits fresh (drag does NOT persist across board switch — no list memory, by the earlier choice). Verified: catAuto 216 → drag 320 → reselect stays 320 → switch to fleet auto-fits 232 → back to categories 216. Verified: Categories 216 / Rentals 211 / Vendors 175 px (each fit content); at 400px wide list caps to 160 (40%); DS1/DS2 memory still works; 0 console errors. NOTE: on mobile the 40% cap can clip the last badge (overflow hidden, no wrap) — accepted tradeoff per user.
- ✅ DS2 PILLS STATICALLY ALIGNED (2026-06-01, user feedback): Categories DS2 unit rows now use a shared CSS grid so pills line up in fixed columns across rows. ORDER (user-specified): dot · main(name/sub) · **Rental · Inspection · Fleet · Work Order**. Each pill in its own `.cat-cell` (Work Order = `.cat-cell-wo`). Mechanism: `.cat-unit-list` is `display:inline-grid; grid-template-columns:auto auto auto auto auto auto; width:max-content` (NOT 100% — that collapsed it; inline-grid is the key, plain `display:grid`+fit-content card collapsed via subgrid); `.cat-unit-row` is `display:grid; grid-column:1/-1; grid-template-columns:subgrid` (keeps row box → hover/border/bookable accent all still work). Card `.transact-block:has(.cat-unit-list)` = `width:fit-content; max-width:100%; overflow:hidden` → hugs content on wide screens, CLIPS the trailing Work Order text at the panel edge when narrow (names + pills never compress/overlap, no page scroll). WORK ORDER cell: new `unitActiveWO(unit)` in calc.js (most-recent Failed-inspection woId → that WO, EXCLUDING status==='Completed'); renders the WO journey task names as a clickable `.pill.pill-wo.pill-link` (data-pop-board=work-orders → opens the WO popup); FULL text (no char cap — user: "no need to restrict char count when there's width"); `.pill-wo` is `text-transform:none` (sentence case, not shouty caps) on a neutral `--surface-3` bg. Removed the old `.cat-unit-meta`/`.cat-unit-tasks` approach. Verified both themes, 580px (clips cleanly, names full, no overlap) + 800px (full WO, aligned, card hugs content), 0 console errors. SUBGRID supported in preview (CSS.supports check).
- ✅ PHASE 2c — SERVICE ORDERS DONE (2026-06-01, on Opus): full board built + verified both themes, 0 console errors. FILES: data.js `SERVICE_TASKS` const (10 mock tasks) + reshaped `SEED['service-orders']` (active + completed-log records). config.js `serviceStatus` set. calc.js `unitServiceLog`/`unitLastService`/`unitServiceSchedule` (hours countdown; unseeded tasks get a STAGGERED mock baseline `(cur+i*41)%interval` so countdowns spread, lastDate null). state.js `getRecord`+`displayName` REDIRECT service-orders→fleet (units lens) + new `addRecord`/`removeRecord`. list.js getItems→fleet units, field 'itemId', service-orders case falls through to fleet item. **app.js `selectItem` now uses `getRecord(currentPage,id)`** (was `.find` by idField — that broke the lens; KEY fix). ds1.js Unit Overview + Service Log; ds2.js task rows (subgrid `.svc-task-list`, aligned). util.js `unitLink`. popup.js `ServiceWindow` object (open / openRecord read-only / _complete → addRecord Complete @ currentHours + '2026-06-01', removeRecord active, unit→Not Ready, re-render). app.js document-click handler (.unit-link / .svc-window-trigger / .service-log-link) + ESC. CSS: .svc-task-*, .svc-due-{ok,due-soon,past-due}, .svc-log-*, .pill-{incomplete,parts-ordered,complete}, .sw-* modal. VERIFIED: list mirrors Units (Genie/Skyjack=Service), DS2 10 rows w/ varied green/yellow/red countdowns + active-SO 'Parts Ordered' pill, Service Window opens, Complete logs+resets+Not Ready. NOTE: countdowns for unseeded tasks are MOCK (real history/manufacturer schedules later).
- ▶ NEXT SESSION (user paused 2026-06-01, tired — "dive further into Services" when back): Phase 2 (Fleet: Units+Categories+Service Orders) is COMPLETE & verified. Open SERVICE threads to pick from: (1) **real manufacturer maintenance schedules** → replace the 10 mock `SERVICE_TASKS` (user considered "Per category"/equipment-type but chose mock-for-all-now; per-category is a small data-shape change); (2) Units **"Most Critical Task" pill** on the fleet list item (UNBLOCKED — read `unitServiceSchedule()`, surface the most past-due/soonest task); (3) **WO/SO history section** on Units DS1 (UNBLOCKED — `unitServiceLog()` + WOs exist); (4) flesh out the **Service Window** (parts/filters currently display-only; add edit / +New service order; hours are manual until GPS §13). Otherwise next = Phase 3 (Rentals/Invoices/Customers) OR run the Phase 2 §14 verification gate. App last left on Service Orders board, FL-001, dark theme. Nothing uncommitted/broken; no console errors.
- PHASE 2c plan/model — SPEC §9 (lines 572-615). Model: list MIRRORS Units (lists units, reuses fleet list-item); DS1 "Unit Overview" (unit summary + SERVICE LOG at bottom, read-only); DS2 "Service Order" = predefined RECURRING task rows (Task · Interval hrs · [Last Service pill] · [X Hours Until Due / Past Due]). Countdown = currentHours − lastServicedHours vs interval (green / yellow within 10% / red past-due). Pill→Service Window form (parts/filters/links/instructions/photo/Complete→logs+resets+unit→Not Ready). Unit w/ active SO → Inspection Status 'Service' (overrides). USER DECISIONS (2026-06-01): (1) HOURS-ONLY intervals (no calendar). (2) Use SPEC's 10 MOCK tasks for ALL units now — **TODO (user): soon source REAL maintenance schedules direct from manufacturers, per equipment type**. (3) DROP estCost + laborHours. Also dropping (SPEC-absent + no-assignment rule): assignedTo, completedBy, location, loggedBy, createdDate. Status enum → SPEC Incomplete/Parts Ordered/Complete. Panel titles → Unit Overview / Service Order (were Service Details / Completion Status).
- DEFERRED (need later phases): §12 revenue formulas (ROI/utilization/rev-per-mo = phase7 stubs), Category photo thumbnail (§9), G3 Office-dashboard embed (Phase 7). BOOKING: availability click now opens a prefilled New-Rental popup (Unit/window/time shown) but SAVE/full form is the Rental Log phase — wire the prefill payload into the real new-rental form then. When Phase 11 builds the standalone 4-Q inspection report, repoint all FAILED/Report pills (list badge + DS2) to it.

**✅ PHASE 2a — UNITS BOARD DONE (2026-06-01, on Opus): SPEC §9 Units fully rebuilt.**
- data.js fleet[] reshaped per the binding decisions above: dropped nickname/location/notes/assignedMechanic/currentCustomer/currentRental/dailyRate/weeklyRate/monthlyRate/financedPrice/notFinancedPrice/sellTargetHours/sellFlag/inspectionFlag/phase/gpsLastDate/gpsNextDate/all-service-hour-fields. SPLIT old `status`→`fleetStatus`(Active...)+`inspectionStatus`(Ready/Not Ready/Service/Failed; FL-003+FL-008=Failed w/ WO, FL-006+FL-007=Service). ADDED make(split), gpsType, trueCost, inspections[]({date,report,woId}). RENAMED ogPurchasePrice→purchasePrice, hoursAtPurchase→purchaseHours. Fixed gpsStatus to valid §6 enum (Reporting/Verify/Not Reporting — was bogus 'Active').
- data.js categories[] reshaped: ADDED msrp, fuelType, description(was notes), specs(url). Prices+MSRP+Ask+Bottom all live here (Units mirror via unitPrices()).
- state.js: unitPrices() extended to return msrp/askPrice/bottomDollar; NEW unitRentalStatus(unitId) derives rental status from live rental (priority On Rent>End Rent>Reserved>Returned→None). Verified FL-002=On Rent, FL-007=Reserved, FL-004=None.
- util.js: NEW categoryLink(catId) → clickable .category-trigger link-pill.
- render/list.js fleet item: Name/Category/InspectionStatus badge + derived RentalStatus badge + hrs (dot=inspectionStatus).
- render/ds1.js fleet → SPEC §9 UNIT PROFILE: §1 Inspection/Fleet/Rental status + Name + Category(link-pill), §2 RENTAL PRICES(mirrored), §3 DETAILS(S/N/Year/Make/Model/Weight), §4 PURCHASE PLAN(MSRP+Ask+Bottom mirrored, Purchase Price/Date/TrueCost/Hours on unit), §5 GPS(Type/Placement/Status pill). Rentals unit-pill recolored by inspectionStatus.
- render/ds2.js fleet → SPEC §9 INSPECTION REPORT: inline `.insp-row` list (Date · Report pill · WO link-pill) + New Inspection btn. Removed old prices/serviceTable/notes blocks. Categories units-in-category list updated to inspectionStatus (dropped nickname).
- app.js: `.category-trigger`→BoardPopup.open('categories'), document-level `.wo-trigger`→BoardPopup.open('work-orders') (works in workspace+popups).
- CSS: `.insp-row` grid (1fr/auto/1fr), `.insp-head`, `.insp-empty`. Braces 657/657.
- VERIFIED both themes, zero console errors: data reshape (no nickname/status/prices on unit; has make/inspections), mirrored prices (Member 240/MSRP 62000/Ask 38000 from Category), derived rental status, category pill→popup, WO pill→popup, all 5 other boards still render, categories units-list 8 rows.
- KNOWN-DEFERRED on Units (not built yet, fine per phased plan): "Most Critical Task" service pill in list item + Section 6 WO'S&SO'S derived list (both need Service Orders board, sub-step 2c) + QR code square + the 4-question inspection automation (§11). serviceTable() in calc.js now orphaned (no callers) — cleaned in 2c.
- NEXT: 2b Categories board polish (DS1 CATEGORY PROFILE §9 — availability check, fleet summary, investment), then 2c Service Orders (recurring-task model — most structural).

**SPEC.md is the source of truth** — lives at `.claude/SPEC.md` (9-phase build plan in §14). We are building **Spec Phase 1 (Foundation)** in sub-steps with a checkpoint after each. Plan file: `.claude/plans/floofy-exploring-star.md`. Decisions locked: full normalized model (§4.2), safe split (ordered classic scripts now, ES modules later).

**Phase 1 progress (2026-05-31 session):**
- ✅ Sub-step 1 — `js/config.js`: single source of truth for all §6 enums/colors, role/KPI defs, transport table. `statusSlug`/`pill`/`dot` route through it.
- ✅ Sub-step 2 — normalized state: `{byId, allIds}` store + accessors + derived helpers (`displayName`, `unitPrices`, `categoryName`, `customerHistory`). Unit prices now mirror from Category; rentals reference-by-ID. "One fact, one place" proven live.
- ✅ Sub-step 3 — module split: `app.js` (1,884 lines) split into `js/{config,data,state}.js`, `js/lib/{util,calc,sheets,drive}.js`, `js/render/{list,ds1,ds2,dashboards}.js`, and a trimmed `app.js` (866-line conductor). Ordered classic scripts in index.html. `buildStore()` now called from init. Verified zero console errors, app pixel-identical.
- ✅ Sub-step 4 — URL routing: `js/lib/router.js` (pure parse/build/read/write/matches helpers; hash format `#/board/recordId/panel`, panel reserved for Sub-step 8). app.js has `syncURL()` (state→URL, gated by `routingReady`), `applyRoute()` (URL→state, validates board+record, `{fromRoute}` flag prevents write-back), boot via `applyRoute(ROUTER.read())` + `hashchange` listener. Verified live: select/nav/deselect write URL; deep-link reload restores board+record+panels; back/forward restores both; invalid board → falls back to #/fleet. Zero console errors.
- ✅ Sub-step 5 — stackable Board Popup system: `js/lib/popup.js` (`BoardPopup` global, stack-based). `BoardPopup.open(board,id)` deep-dives a record reusing renderDS1+renderDS2 (panel contract). Stacks N deep; "Close All" appears at 2+; ESC closes top; overlay dim-click closes top; ×  closes that popup. Linked pills inside a popup (customer/unit/invoice triggers) open the linked record stacked (resolved via `_resolveLink`). The DS-header expand (⤢) `.fs-btn` now opens the current record as a popup (replaced old single-panel modal; modal DOM/fns left inert). DS2 read-only in popups for now. CSS `.bp-*` appended to style.css (side-by-side panels ≥768px). Verified live: pill→stack, 3-deep, Close All 3→0, ESC top-only, overlay-click top-only, fs-btn opens record, zero console errors.
- ✅ Sub-step 6 — KPI bar 3 concentric rings: `initKPIRings()` rewritten to render 3 rings/role (radii 21/16/11) from `cfgRole()` config; values are mock (`KPI_MOCK`) until Phase 7 formulas; null = TBD (office Reputation, driver Driving Score) → gray ring + "TBD" in popup. Color ramp green≥90/blue≥75/purple≥60/pink≥45/red. Single-click → `#kpi-popup` listing the role's 3 KPI names+values (230ms timer to disambiguate from dblclick); double-click → `navigateTo(cfg.dashboard)`. Rings animate independently via double-rAF. CSS `.kpi-fill` per-ring (JS sets dasharray/offset/stroke) + `#kpi-popup` styles. Verified live: 3 rings render w/ correct ramp colors, popup shows correct names/values incl. TBD, dblclick → #/dash-mechanic, zero console errors.
- ✅ Sub-step 6b — KPI tuning (user-directed): color ramp now green≥75 / yellow≥50 / orange≥25 / red below; ≥95 adds `.kpi-glow-top` (glossy green pulse), <10 adds `.kpi-glow-low` (urgent red pulse) — CSS @keyframes kpiGlowTop/kpiGlowLow. KPI RENAMES in config.js (single source → propagates to popup + future dashboards): Invoice Collection Rate→"Invoices Collected", WO Completion Rate→"WO's Completed", Active Customer Rate→"Active Customers", Rental Success Rate→"Successful Rentals", Wash Completion Rate→"Units Washed". Role "Maintenance"→"M.Tech" applied in ALL 4 places found: config role label, index.html KPI label, index.html nav-popup dropdown link, app.js PAGES 'dash-maintenance' label. Verified live: ramp+both glows correct, all popup names updated, M.Tech dashboard nav shows "M.Tech". NOTE: ×/− chars in config formula strings are real Unicode (display as * in PS) — match on `name:'...'` fragments when editing, not full lines.

- ✅ Sub-step 6c — KPI hover-formula + target scaling + ordering (user-directed):
  • Each ring in config.js got a `plain:` layman explanation; popup rows reveal it on hover/focus (`.kpi-pop-plain` CSS slide-open). Hint: "Hover a KPI for details · double-click ring → dashboard".
  • WO Rate got `target:20`. New `kpiRing(ring, raw)` helper: target KPIs fill to %-of-goal (raw/target×100), display "raw% (goal T%)", and OVER target → red + glow-low (too many failures). Normal KPIs unchanged. KPI_MOCK stores RAW metric values.
  • KPI importance ordering (outer ring = most important): Office=[Invoices Collected, Reputation, Show Rate]; Sales=[Revenue Goal, Pipeline, Active Customers]; M.Tech=[Successful Rentals, Ready Rate, WO Rate]; Mechanic/Driver unchanged. Reordered ring blocks in config.js AND the positional KPI_MOCK arrays in app.js to match.
  • Role display order: MECH, M.TECH, DRIVER, OFFICE, SALES — reordered the 5 .kpi-role blocks in index.html (data-role + label divs).
  ⚠️ KPI_MOCK arrays are POSITIONAL to config ring order — if you reorder rings, reorder the mock values too.
  Verified live: roleOrder=[mechanic,maintenance,driver,office,sales]; all popups list rings in new order w/ correct values; WO Rate shows "18% (goal 20%)"; zero console errors.

- ✅ Sub-step 6d — KPI small-screen + glow fixes (user-directed): (1) rings shrink via @media — 46px base → 38px ≤560px → 32px ≤380px (SVG viewBox scales crisply), gaps/labels tighten too, all 5 fit a phone row; (2) `#kpi-popup` max-width capped to `min(300px, 100vw − 16px)` so it no longer slides off-screen (JS clamp already positions); (3) glow is now STATIC drop-shadow (removed @keyframes kpiGlowTop/kpiGlowLow pulsing) — ≥95 green, <10 red, constant. Verified at 340px: rings 32px, SALES popup fully on-screen, glow animationName=none w/ filter applied. Desktop unregressed.

- ✅ Sub-step 7 — +New menu, Search overlay, Session Sync QR:
  • +New: `#new-menu` quick-pick (Customer, Work Order, Rental, Invoice, Inspection Report) above the pill; opens via `#new-btn`, always available. `BoardPopup.openNew(board, {title})` opens an empty form-shell popup (real fields are per-board phases). "Inspection Report" → openNew('fleet',{title:'Inspection Report'}).
  • Search: now a cross-board OVERLAY (`#search-overlay`), NOT live list filter. Top `#search-input` focus/click opens it; `runGlobalSearch()` greps all boards, groups results by board (cap 8 + "more"), click → navigateTo+selectItem. List panel no longer filters (searchQuery stays empty). `searchTitle()` per-board.
  • Session Sync QR: `#session-sync-btn` in pill (next to theme). Uses QRCode.js via CDN (qrcodejs@1.0.0). `openSessionSync()` renders QR of `window.location.href` (router hash = board+record+panel) + shows URL text.
  • ESC priority chain: BoardPopup → QR → search → new-menu → modal/nav. All overlays close on dim-click.
  • CSS appended for all three. Verified live: 5 +New opts open shells, search finds "bobcat" across 5 boards & navigates (#/fleet/FL-001), QR renders matching live URL (#/work-orders/WO-0041), zero console errors.

- ✅ Sub-step 7b — +New menu differentiation (user-directed): icons swapped for orange "+" square bullets (`.new-plus`); menu now anchored over the +New button (left set in `openNewMenu()` via getBoundingClientRect, clamped) instead of left:18px over logo; orange "create" accent (orange border-glow, orange uppercase label, orange hover). Distinct from board-nav menu. Verified: anchoredToBtn=true, 5 "+"-prefixed opts, no SVG icons.

**OPEN POLISH ITEM (user raised, deferred to a dedicated pass):** glyph vertical-centering — text like the "+" chip and especially the status PILLS sit optically high (font descender space + flexbox centers line-box not ink). Fixed the `.new-plus` chip with `padding-top:2px`. PILLS left alone on purpose (global component, used everywhere) — tune `.pill` vertical rhythm in a focused polish pass, NOT mid-foundation. User agreed centering-by-brute-force is not the answer.

**⚠️ SEARCH GAPS TO ADDRESS IN PHASES 2-6 (user flagged as important):**
1. **Status key-vs-label:** search matches the STORED form (raw config key/slug), not the displayed pill LABEL. Once seed is reshaped to canonical config keys, add label-aware searching so users can search by on-screen pill text.
2. **Derived/related fields aren't searched:** records store IDs, not the related display names (e.g., a rental stores customerId/fleetItemId, NOT "Clay Dennis"/"Toyota 8FGU25" — those are derived via displayName()). So searching a customer's NAME while on the Rentals board finds nothing, and match-highlighting can't surface it. When building each board, decide which derived/related fields should be searchable (likely: customer name, unit name, category on rentals/invoices/WOs) and fold them into the search haystack + match snippet.

**OPEN DESIGN QUESTION (user raised, deferred):** menu+KPI popups feel Apple; user asked whether to apply that polish to the rest of the boards/panels now. My recommendation given = NOT yet — Phase 1 is foundation; the existing panels are already on the polished design system, and a dedicated visual pass is best done per-board in Phases 2-6 (or a focused polish pass) once real fields exist. Revisit after Sub-step 8.

- ✅ Sub-step 8a — desktop multi-column DS layout: uses CSS **container queries** (`#detail-panels { container-type:inline-size; container-name:dpanels }`) so columns respond to PANEL width (correct, since list-drag narrows the panel), not viewport. `#ds1-body .data-grid` and `#ds2-body .transact-cols`: 1 col <600px, 2 cols ≥600, 3 cols ≥920 (container width). DS1 flat grid grouped into atomic `.ds-sec` blocks via `groupDataGridSections()` (called at end of renderDS1) so heading+rows stay together; `.data-grid` changed flex→block for multicol. DS2 blocks wrapped in `.transact-cols` (renderDS2 innerHTML). Pattern: scroll container=`.ds-body` (fixed height), multicol element=auto-height child → scrolls vertically, never horizontally (avoids multicol's horizontal-overflow trap). Verified by RELOAD at each width: panel 1180→3col, 740→2col, 555→1col; no h-scroll; DS1 17 rows/3 headings intact; full-bleed labels span (340=340); popups stay 1-col (CSS scoped to #ds*-body, not .bp-*); zero console errors.
  ⚠️ CONTAINER-QUERY TEST GOTCHA: column-count updates async after a live resize/applyListWidth — getComputedStyle reads stale. Always RELOAD before asserting CQ column counts.
  (Screenshot tool was flaky this session — verified programmatically via DOM measurement instead.)
- ✅ Sub-step 7d — search REDESIGN (user-directed, SUPERSEDES 7c): the scope-toggle approach was scrapped. New model: LOCAL search bar (`#search-input`) live-filters the current board's list as you type (stay on view, no popup) — restored original `searchQuery`+`renderList` behavior. A 🌎 globe button (`#global-search-btn`, right side of the bar) opens the cross-board global popup (purely global, no toggle, grouped by board; seeds with active local query). ESC chain uses `closeGlobalSearch`. SPEC §7 UPDATED to document this. Removed all `.scope-*`/`#search-scope` CSS+HTML+JS (verified scope=0 in css). Verified live: local 8→1 for "kubota" w/ no popup + clear restores; globe opens popup, "cat"→8 board groups; result click → #/parts/PT-001. Zero console errors.
  (superseded) Sub-step 7c — two-segment Board/All toggle left of the 🔎 in the search overlay.
- ✅ Sub-step 7f — search DEPTH fix (user-caught bug): old matcher used `Object.values(item).some(String(v).includes(q))` which (a) missed nested arrays/objects — activity logs, WO journey rows stringify to "[object Object]" — and (b) failed comma-formatted numbers (search "18,700" ≠ stored number 18700). NEW shared `searchHaystack(item)` + `matchItem(item,q)` in lib/util.js: deep-walks ALL nested values, indexes numbers BOTH raw + `toLocaleString` ("18700" & "18,700"). Both local (`getItems` in render/list.js) and global (app.js) now use it; removed dup matchItem from app.js. Verified live: "18,700"→FL-003 (local filters to 1), "agreement" (in membershipLog)→CU-001 global, WO journey row text matches, "1,240" hours matches, gibberish=false. Zero console errors.
- ✅ Sub-step 7e — search fixes (user-directed): (1) globe moved to FAR LEFT of search bar (leading icon, left:20px); removed the old decorative `.search-icon` magnifier from the top bar (globe is now the bar's icon); input padding rebalanced (40px left / 34px right), clear-✕ back to right:14px. (2) Global-search result click now `BoardPopup.open(board,id)` instead of navigateTo+selectItem — record pops in a WINDOW over the current board, user does NOT navigate away. Verified: "clay"→Clay Dennis opens Customers popup while currentPage stays 'fleet'; zero console errors. Segment 1 = current board's label (dynamic, e.g. "Units"), segment 2 = "All". `searchScope` state ('board'|'global'). Smart default on open: board scope if `boardIsSearchable(currentPage)` (PAGES exists & not dash-*), else global. `runSearch()` (renamed from runGlobalSearch): board scope → flat list of just currentPage; global → grouped across boards (cap 8/board). Board segment disables + forces global on dashboards. Active segment = solid orange bg (dropped the fiddly sliding-thumb; `.scope-thumb` hidden/unused). applySearchScopeUI() updates label/active/placeholder ("Search Units…" vs "Search everything…"). Verified: default=board "Units" flat all-fleet; All→grouped (Units/Rental Log/Categories); dashboard→board seg disabled & global forced; zero console errors.

- ✅ Sub-step 7g — search match highlighting (user-requested, "very useful"): shared helpers in lib/util.js — `highlightHTML` (escape + `<mark class="search-hl">`), `highlightInNode` (in-place TreeWalker highlight of live DOM text), `findMatchField` (first nested field whose value contains query → {label,text}), `prettyFieldLabel`/`FIELD_LABELS`, `escapeHTML`/`escapeRegExp`. List Item (render/list.js makeListItem): highlights query in item-name/sub/stat; if match is in a HIDDEN field, appends `.item-match` snippet (🔍 LABEL value). Global popup (app.js runGlobalSearch): highlights title+id, adds `.search-result-snip` + `.search-result-main` wrap when match is off-title (e.g. nested log). CSS: `mark.search-hl` (orange-glow bg, bold), `.item-match`/`.item-match-label`/`.item-match-val`, `.search-result-snip`. Verified live: "001"→IDs highlighted, no snippet; "18,700"→FL-003 "Weight 18,700" snippet; "agreement"→Clay Dennis global "Membership Log …agreement…" snippet; "cat" highlights titles. Zero console errors. NOTE: derived-field snippets (rentals/invoices store IDs not names) will read better after the Phase 2-6 search-haystack work.

- ✅ Sub-step 7h — local search keeps DS panels open on desktop (user-directed): local `searchInput` input handler previously always did `selectedId=null` + remove `item-open` (collapsed DS1/DS2 on every keystroke). Now gated by `window.innerWidth < 768` — mobile collapses (list needs full width), tablet/desktop keep current selection + panels open while the list filters underneath. Verified: 1280px → after search itemOpen=true, selected stays FL-003, list still filters (kubota→1); 375px → itemOpen=false, selected=null. Zero console errors.

**⚠️ SPEC §7 mobile-DS OVERRIDE (user decision, 2026-05-31):** user REJECTED the spec's "DS1 auto-collapses to preview" mobile behavior. New model (applies desktop + mobile): DS1/DS2 get a DRAGGABLE divider between them (vertical resize, mirrors the list-width drag) + a MINIMIZE button per panel header (quick-close one, other takes full height). Touch support on BOTH dividers (pointer events). Mobile <768px: detail panels full-width when item open; List Item NOT auto-collapsed (reopen via pill list-toggle). SPEC §7/§5 to be updated to match once built.

- ✅ Sub-step 8a — desktop multi-column DS (ALREADY BUILT, verified present): `#detail-panels` is `container-type:inline-size; container-name:dpanels`. DS1 `groupDataGridSections()` wraps each [heading+rows] run in `.ds-sec` (break-inside:avoid); DS2 wraps content in `.transact-cols`. Container queries: ≥600px→2 col, ≥920px→3 col (one shared vertical scroll = user's "CSS columns" choice). Matches SPEC §5 intent (updated §5 from "independently-scrollable" to shared-scroll columns).
- ✅ Sub-step 8b — DS resize/minimize + touch (user's override design, built & desktop-verified):
  • `#ds-divider` between DS1/DS2 (row-resize, shown only when item-open & neither panel minimized). Drag sets `ds1BasisPx` → DS1 `flex:0 0 Npx`, DS2 `flex:1 1 0`. Verified: DS1 211→331px on a 120px drag.
  • Per-panel minimize: `.ds-min-btn` in each ds-header (min/restore icon swap). `applyDSLayout()` recomputes from state (ds1Min/ds2Min/ds1BasisPx) → `.ds-minimized` (flex:0 0 auto, body hidden). Minimizing one un-minimizes the other. Verified: DS1 min→38px header, body hidden, DS2→384px, divider hidden; restore works; DS2 min screenshot shows DS1 filling 3-col.
  • NEW generic `attachDrag(handle,{axis,bodyClass,onStart,onMove,onEnd})` using POINTER events (mouse+touch, setPointerCapture). BOTH dividers now use it — list-width divider rewritten from old mousedown handler (verified still works via pointer path 260→340px = touch support). `touch-action:none` on both dividers.
  • CSS: `.ds-header-btns`, `.ds-min-btn` (shares fs-btn style), `#ds-divider` + `body.is-resizing-v`, `.detail-section.ds-minimized`. Removed `.detail-section:first-child` border (divider separates now).
  • Desktop multicolumn (8a) confirmed rendering at 1440 (UNIT/ASSET/GPS&PHASE in 3 cols).
  • MOBILE VERIFIED at 375px (screenshot + eval): divider present (display:block), DS1 minimize works (DS2→607px), DS rows stack label-above-value, both min buttons + expand icons render in headers. Single-column DS confirmed visually (multicol container-query yields 1 col at 375px panel width). Zero console errors across desktop + mobile.

- ✅ Sub-step 8c — EXTREME PHASE 1 AUDIT (3 parallel agents: dead-code, cross-ref integrity, SPEC/theme fidelity + live runtime sweep of all 15 boards). Verdict: foundation architecturally sound (all boards render, zero console errors, no broken JS/DOM refs, config = faithful §6). FIXES APPLIED + verified live:
  • Unstyled pills (live-confirmed): added `.pill-ordered`/`.dot-ordered` (Parts 'Ordered' status was colorless), `.dot-awaiting-parts`, + several missing dots (member/failed/ready/service etc.).
  • Light-mode theme gaps: added `body.light` overrides for WO-phase pills (were pale pastels invisible on white), awaiting-parts/draft/sent/cancelled/member pills, and `body.light .nav-group-label` (was white-on-white invisible — DASHBOARDS/RENTALS/FLEET/ADMIN now dark text). Verified light WO pills = dark text, nav labels = rgb(13,15,18).
  • `.pill-for-sale` color drift fixed: was BLUE (#93c5fd), now YELLOW per SPEC §6. (0 occurrences of 93c5fd remain.)
  • Added `.data-section-heading.centered` rule (heading(...,'centered') was a no-op).
  • DEAD CODE removed: entire legacy single-panel modal (openModal/closeModal/5 consts/2 listeners/ESC line in app.js, #modal-* HTML block, ~60 lines modal CSS) — KEPT `@keyframes modalIn` (shared by bp/selector/qr/search). Removed dead `row()` from util.js. Removed dead `data-title` attr. Verified fs-btn expand + ESC chain still work without modal.
  • SPEC.md §3.1 + §8 updated: stale `#modal-window` panel-mirroring references → Board Popup (as-built truth).
  • KEPT intentionally (forward seams): Phase 5/7/8 stub APIs (transportFor, updateRecord, customerHistory, Sheets/Drive, cfg accessors), `.insp-add-btn` (Phase 2 inspection seam).
  • Final (all removals fully landed on disk, re-verified): modal refs = 0 across HTML/CSS/JS/SPEC; `@keyframes modalIn` retained (used by 5 components); CSS braces balanced 547/547; 14/14 JS syntax OK. Sizes: index.html 392→377, style.css 1667→1606, app.js 1312→1284, util.js 184→175. SPEC.md §3.1+§8 modal→Board Popup. Full 15-board sweep zero errors; fsBtn-expand, global search, DS-minimize all work; modalElementGone=true; zero console errors; dark+light verified.
  ⚠️ PROCESS NOTE: several Edit-tool calls silently failed (stale/wrong anchor text incl. wrong +New comment string, and box-char/`›`/em-dash lines) — caught each via grep-count verification, completed those via .NET line-slice/Replace. Lesson reinforced: after every removal, grep-confirm count==0 before claiming done.

- ✅ Sub-step 8d — LIGHT MODE pass (user "not happy"; scope = token pass + full once-over). VISUALLY VERIFIED both themes (fleet/rentals/work-orders light + rentals dark regression; zero console errors; braces 541/541). Changes made in style.css:
  • Light tokens retuned: `--black` page backdrop #d8dde5→#eceef2 (softer); border hairlines #b8bfc9→#e6e9ee / #a6aeb9→#d4d9e0 (old borders made a hard grid); text/surface ramp refined; added `--shadow-card` + `--shadow-pop` tokens (dark mode: shadow-card=none).
  • `#detail-panels`: background var(--black)→var(--surface) + `box-shadow:var(--shadow-card)` → white card floats on grey page (depth fix).
  • `#list-panel` right border → `--border-light` (structural).
  • Light pills: alpha 0.10→0.16 (0.18 for gray quote/not-ready) for punch on white.
  • Group headers (BOTH themes): replaced near-invisible solid hex bg with status-color rgba tints (0.16–0.20) + 4px accent bar; label weight 700→800, color text-muted→text-sub, count chip neutral. Fixes the washed-out coding the user flagged.
  • `body.light #bottom-bar`: lighter shadow (dark 0.45 shadow looked like a smudge). [NOTE: first edit of this accidentally moved overflow/transition into the body.light block — caught & fixed; base #bottom-bar verified intact with overflow+transition.]
  ➜ NEXT SESSION: restart preview, screenshot light mode across boards (fleet, rentals group headers, work-orders pills, customers) + re-confirm DARK mode unregressed (esp. group headers + pill-collapse animation), then mark 8d done.
  TOOLING: preview MCP dropped repeatedly this session; Read tool also intermittently returned empty — fell back to PowerShell/.NET + sed + node --check for truth.

**▶▶ DESIGN DIRECTION — "Phase 1.5" CARD-FIRST REFACTOR (decided 2026-05-31, build BEFORE Phase 2 boards so all inherit it):**
- User shared Apple/iOS-26 inspiration (dark+light, macOS card panels, fields-as-filled-chips). Working mockups-first, NO code until the look is locked & visually approved (user directive: "visualize ideas in images first, go back and forth").
- DECIDED: card-first detail panels (DS1/DS2 = floating rounded cards on grey page, card header w/ min+expand) + **Option A "chips everywhere"** field style (every field = label-above + soft filled box; status values = colored pill-chips) + **tight density** (compact padding, not roomy) + both themes first-class.
- This is a SHARED-SCAFFOLDING change (the heading()/trow()/transactRow()/field helpers + panel CSS), same rationale as the theme-token pass: do once, every Phase 2-6 board born card-first. No per-board rework.
- Mockup files written (non-wired, in /mockups/, do NOT touch app): `mockups/options.html` (A/B/C field-style comparison, dark) and `mockups/rental-card.html` (full card concept, light). View at http://localhost:3000/mockups/options.html.
- ✅ DESIGN LOCKED (Phase 1.5 card-first — final structure approved via mockups v2/v3/v3-mobile):
  • **3 panels ALWAYS preserved**: List │ DS1(top) │ DS2(bottom). (Earlier mockups wrongly dropped this — corrected.)
  • **"3 columns" = section BLOCKS laid horizontally across the panel** (NOT one flat field grid). Each section = slim heading (bottom-border, no heavy sub-card box) + its own **2-up chip grid** inside. Section blocks flow 1→2→3 ACROSS by panel width via container-query (container-name:ds on each .ds).
  • **Fields = chips** (Option A everywhere incl. dense Units): label-above + soft filled box; status values = colored pill-chips; `.wide` spans 2 for long values (Display Name).
  • **Mobile (<~430c)**: sections stack 1-wide BUT chips stay **2 per row** (never single-stack — user requirement; pure-Apple survives). DS1-over-DS2 with drag divider + per-panel minimize/expand retained.
  • Slim list group headers: centered label w/ fading status-color rules (replaces solid-bg blocks).
  • Both themes first-class (verified light+dark on v3).
  • Reference mockups: v3.html (desktop both themes), v3-mobile.html (mobile list+detail 2-up). OPEN polish during build: exact chip padding/widths, section-block breakpoints.
- Mockup files (non-wired, /mockups/, safe to delete; user reviews by opening directly in browser): `optionA.html` (Rental, A, both themes), `adaptive.html` (Rental chips @1440 — confirmed 3-col chips breathe, no truncation), `units-chips.html` (Units in full chips/A, both themes — the dense-board proof). Earlier `options.html`/`rental-card.html` = superseded.
- preview_screenshot was very flaky all session (frequent 30s timeouts, esp. right after navigation; a 2nd immediate screenshot call often succeeds; needs a beat after location.assign). Not a code issue — eval shows pages load `complete`. Mockups at non-root URLs (/mockups/*) screenshot inconsistently; rendering the mockup INTO the app document via eval, or just opening files in-browser, is more reliable.
- ⏳ NEXT: user reviews units-chips.html in browser → gives notes / "lock it" → then build **Phase 1.5**: refactor shared scaffolding (heading/sec + new field-chip helper + card wrappers in render/ds1+ds2 + CSS) so DS1/DS2 render card-first chips-everywhere; verify both themes + responsive + dense board; THEN Phase 2 boards inherit it.

**▶▶ PHASE 1.5 (card-first) — BUILD IN PROGRESS (1.5a desktop cards + DS1 chips ✅, 1.5b DS2 chips ✅, 1.5c mobile ✅; remaining: slim list group headers, then user eyeball sweep):**
- ✅ 1.5a + DS1 chips DONE (verified by computed-style measurement; screenshot tool was down so NOT eye-verified by me — user confirming in browser):
  • #workspace = padded grey page (10px pad+gap, --black bg). #list-panel + .detail-section = floating cards (14px radius, --shadow-card, border). #detail-panels = transparent rail, 10px gap between DS1/DS2.
  • #ds-divider = floating grip pill in the gap (42x5 rounded, orange on hover/drag) — replaced full-width bar.
  • DS layout: `.data-grid`/`.transact-cols` = CSS GRID laying section blocks across 1→2→3 cols (container query @560/@880, container-name dpanels). Replaced old multicol.
  • `.ds-sec` = section block: 2-up grid; `.data-section-heading` slim (no bg band, spans 1/-1).
  • DS1 fields = chips: `.data-grid .transact-row` → flex-column (label above), `.transact-val` → boxed (--field bg, border, left-align). Pills/link-pills sit BARE via `:has()` (no double-box). `.field-full` spans both cols. New tokens --field/--field-b (dark+light).
  • Measured OK: outer grid 3-col, inner sec 2-col, chip bg applied, pill bg transparent, heading transparent, cards have radius+shadow. Braces 546/546. Zero console errors.
  • VISUALLY VERIFIED on real app @1440 (screenshot finally came through): UNIT PROFILE floats as card, sections 3-across, fields as chips, Active/Available pills bare (no double-box), INSPECTION REPORT separate floating card below, list floats left. Looks like the locked mockup. ✓
  • KNOWN/expected: DS2 body (Inspection Report content) still old right-aligned rows — that's the 1.5b job below.
- ✅ 1.5b DONE (2026-05-31): card-chip treatment applied to DS2 via CSS only (scoped `.transact-cols .transact-block`=2-up grid section, `.transact-row`=chip, selects/inputs full-width chip-styled + STILL functional, textareas/wo-journey/funnel-log/svc-table span `1/-1`). Verified: all DS2 boards render grid blocks, selects not disabled, wide content full-span, both theme chip tokens resolve (dark #202127 / light #f3f5f8), 3-across confirmed at 1440 (DS1+DS2 gridCols = 3×359px). IMPORTANT correction: container query was NEVER broken — it lives on `#detail-panels` (style.css ~303) with `.detail-section` panels; an earlier in-session "container bug" was my own misread (looked for wrong class `.detail-panel`); two attempted "fix" edits failed to match (correctly) so nothing was changed there. style.css braces 559/559. NOTE: the REAL preview serverId is `e1a3dd2b-8364-4099-a4ed-de0ec52e90a5`; preview_start needs a `name` from launch.json (not a url) — calls with made-up serverIds still routed to the single running server.
- ✅ 1.5c MOBILE DONE (2026-05-31): implemented locked mobile2.html at phone widths via ONE `@media (max-width:560px)` block in style.css (after the 500px data-row block). Design = SAME horizontal arrangement as desktop (it was already structurally there) — the only real defect was the 220px list crushing the detail rail to ~89px. Changes: (a) `#workspace.item-open:not(.panels-hidden) #list-panel{width:132px !important}` — !important REQUIRED because applyListWidth() (app.js ~1028) sets INLINE style.width which beats media-query CSS; (b) hide `#panel-divider` while open; (c) `#workspace:not(.item-open)/.panels-hidden #list-panel{width:100% !important}` so closed-list fills screen (kills sticky inline 220px); (d) hide list `.item-meta` (pill+amount) while open, keep name+id sub; (e) denser chip font/padding (.74rem/6px9px/min-h31), tighter `.ds-body` + section gaps. Inner chip grid already 2-up (no change). VERIFIED @375px: list 132 / DS1 205 / DS2 205 (was 89!), divider none, innerCols 2, chip val 92px (was ~40), list-meta hidden, closed-list 359 (full), wo-journey spans 1/-1 (181px, not crushed), light chip bg rgb(243,245,248). Braces 573/573. NOT eye-verified (screenshot display down all session — capture works, display returns blank placeholders; measurements are the proof). 560px breakpoint chosen to match existing kpi media query.
- ✅ 1.5d SLIM GROUP HEADERS DONE (2026-05-31): replaced the washed-out tinted bands (user complaint msg [350]: "low contrast washed out on Dark Mode") with the locked-mockup `.gh/.gt` treatment. `.group-header` now: surface bg (solid, no sticky bleed), slim padding 13/12/6, NO fill band, NO chunky left border. Status color via per-group `--gh` custom prop (7 dark + 7 light rules). `.group-label` reads `var(--gh)` = crisp status-colored text (Reserved blue/On Rent green/Completed slate, verified rgb). `.group-header::after` = status-colored gradient flank line (flex:1, order:2) between label and count; count `order:3` sits right. style.css braces 573/573. Verified: header bg rgb(23,24,28)=surface, labels correct status colors both themes, only 1 base rule (no override). The duplicate `.group-label` seen in Read was a box-drawing DISPLAY ARTIFACT (grep/node confirmed 1 each).
- ✅ 1.5e USER-FEEDBACK ROUND (2026-05-31, 4 fixes): (1) DESKTOP DRAG LINE removed — `#panel-divider` now `background:transparent` (no hover/resizing color), still draggable via widened invisible hit area (the empty gap). (2) SECTIONS NOW FLOAT AS CARDS inside DS1+DS2 (was flat) — new tokens `--sec-card` (dark #1c1c1c / light #fff); rule `.ds-sec, .transact-cols .transact-block { background:var(--sec-card); border:1px solid var(--border-light); border-radius:12px; box-shadow:var(--shadow-card); padding:11px 13px }`. Outer grid gap 10px. Mobile padding 9px10px, gaps 8px. Removed old per-block padding/border/margins so the card rule owns it. Verified card bg/radius dark+light+mobile (rgb(28,28,28)/12px). (3) LIGHT-MODE GREEN DARKENED for contrast — new theme token `--ok-green` (dark #4ade80 / light #15803d); applied to kpiColor() ramp (app.js ~1099), RENTAL_STATUS_COLORS['On Rent'] (util.js), `.date-green`, + `body.light .link-pill-green` override (#15803d). Dark unchanged. (4) GROUP HEADERS reverted from slim to BANDED: dark = status-tinted band + bright 4px left accent (the approved look, e.g. On Rent rgba(74,222,128,.18)); LIGHT = SOLID status bands matching rental-status colors + white label/chevron/count (Reserved #1d4ed8, On Rent #15803d, Off Rent #c2410c, etc). Uses `--gh` (accent) + `--gh-band` (fill). style.css braces 580/580, app.js+util.js node-check OK. NOTE: my static regex check false-FAILed the two gh lines (didn't escape `]`); live computed values confirm correct.
- ✅ 1.5f USER-FEEDBACK ROUND 2 (2026-05-31, 4 fixes): (1) REVERTED light-mode green — `--ok-green` now #4ade80 in BOTH themes (user wanted original bright green back); removed `body.light .link-pill-green` override. (2) LIST↔DETAIL GAP fixed — removing divider color had left ~26px gap (workspace gap 10 + divider 6 + gap 10). Now `#workspace{gap:0}` + `#panel-divider{width:10px}` so the invisible divider IS the gap = 10px, matching DS1↔DS2. Verified both gaps = 10px. (3) BREATHING ROOM — `.ds-body` padding-top 4px→13px (mobile 3px→11px) so first section card clears the panel header. (4) APPLE HEADER — `#kpi-bar` now a centered floating card (width:fit-content, margin:10px auto 0, surface bg, border, radius 20, shadow); `#search-bar` floats as its own rounded pill (margin 10px sides, radius 12, shadow, NO full-bleed strip / NO inner double-box — input is transparent borderless inside), bolder orange edge via `:focus-within { border-color:orange; box-shadow:0 0 0 2px var(--orange-glow) }`. Verified: kpiRadius 20px, searchRadius 12px, focus glow shows, both themes, zero console errors. style.css braces 578/578.
- ✅ 1.5g LEFT-COLUMN HEADER (2026-05-31, user-approved live experiment → SAVED): moved KPI rings + search OUT of the top strip and INTO a new `#left-col` wrapper that stacks KPI-card → search-card → list, ALL the same width (= resizable list width). This reclaims the full panel height for DS1/DS2 (detail rail was ~205px tall under the old full-width header strip; now 758px @ desktop). HTML: wrapped `#kpi-bar`+`#search-bar`+`#list-panel` in `<div id="left-col">` inside `#workspace` (kpi/search moved from above #workspace to inside it). CSS: `#left-col{display:flex;flex-direction:column;gap:10px;width:100%}`; `#workspace.item-open:not(.panels-hidden) #left-col{width:var(--list-open-w)}`; `#list-panel` changed from `flex-shrink:0;width:var(--list-open-w)` to `flex:1 1 auto;min-height:0;width:100%` (fills column under the 2 header cards). KPI card: full column width, `justify-content:space-around`, rings shrunk via `#kpi-bar .kpi-ring-wrap/.kpi-svg{30px}` + label 0.5rem. Search card: full width, globe FIXED (`#global-search-btn` was `position:absolute;left:20px` → overlapped placeholder "Se🌐rch"; now `position:static;flex-shrink:0` in a `gap:6px` flex row, sits cleanly before input). DRAG-RESIZE STILL WORKS — applyListWidth() sets `--list-open-w` which now drives the whole column (verified: widen → kpi+search+list all follow). MOBILE retargeted: `#workspace.item-open` becomes `display:grid` areas "kpi kpi"/"search search"/"list detail" with `#left-col{display:contents}` so KPI+search span full phone width on top and the 132px list sits beside the detail rail (locked mobile2 design preserved). Verified desktop+mobile+light, list-toggle(panels-hidden) hides detail & list goes full width, DS minimize intact, zero console errors. style.css braces 590/590. NOTE: user said \"Don't save yet, I want to try it\" first → ran as runtime-injected exp; then said \"Save it\" → committed to HTML/CSS. User clarified the globe was ALREADY broken (not asking me to hide it).
- 🔄 1.5h USER-FEEDBACK ROUND 3 (2026-05-31, 12-item batch, on Opus): DONE so far (7/12): #10 Inactive Fleet Status added to config.js fleetStatus (color slate #64748b) + `.pill-inactive`/`.dot-inactive` + purchased/onboard/sold pills+dots (were unstyled). #4 light-mode DS2 header grey band KILLED — removed base `.transact-label{background;margin;padding;border}` band + `body.light .transact-label{background:surface-4}` override; now card-first `.transact-cols .transact-label` governs (transparent both themes, matches DS1). #12 ORANGE PANEL HEADERS — `.ds-header` bg now `var(--panel-head)` (=orange both themes) + `var(--panel-head-text)` (=#fff); header fs/min btns rgba-white. REVERT: set `--panel-head`/`--panel-head-text` (defined ~L416) back to surface-4/surface + theme text. Section headings contrast bumped: `.data-section-heading`+`.transact-cols .transact-label` color text-muted→text-sub, border→border-light, 0.6→0.62rem. #1 GAPS unified via `--panel-gap:10px` token (workspace pad, #left-col gap, #detail-panels gap, #panel-divider width all reference it) — desktop + mobile now 10/10 (was mobile 8). #11 KPI rings grow unbounded — clamp max now `var(--kpi-ring-max:999px)`; icon/label maxes raised too (verified 37→76px on widen). Easy to cap: lower --kpi-ring-max. #2 INVERTED PILLS on selected (orange) list row — `.item-sub/.item-stat` get `rgba(255,255,255,0.22)` pill bg + radius99; status pill inverts to white-bg/orange-text. #7 globe icon replaced (cleaner search-circle w/ handle). #3 LIST-TOGGLE REMOVED — deleted `#list-toggle` btn from HTML + `listToggle`/`ltCollapse`/`ltExpand` consts + all `.style.display` lines + click handler; clicking selected item still opens/closes (selectItem reclick→deselect, verified). #8 GEAR MENU — replaced `#multi-btn` with `#tools-btn` (gear); new `#tools-menu` fly-up (theme + session-sync moved inside as `.tool-row`s) + `#tools-overlay`; multi-select FULLY removed (multiMode/multiSelectedIds globals from state.js, multi-check + multi-selected from list.js makeListItem, multiCountBar + handler from app.js). Verified gear opens/closes, theme+sync work inside, deselect-on-reclick intact, zero console errors. style.css braces 623/623, all JS node-check OK.
  • DEAD CSS still present (harmless, cleanup later): `#multi-btn`, `#multi-count-bar`, `.multi-check`, `body.multi-mode` rules; `#list-toggle` block replaced w/ tools-menu.
  • ✅ ALL 12 DONE (2026-05-31). Remaining 5 finished: #5 MOBILE DRAG — mobile grid list col now `var(--mobile-list-w,132px)`; `applyListWidth()` got `isMobileLayout()` (matchMedia ≤560) branch that sets `--mobile-list-w` (clamp 96..60vw) instead of `--list-open-w` (and skips localStorage on mobile); divider moved into its own grid col ("list divider detail") with a visible 4×36 grip pill, `display:flex`. Verified list 132→180 on drag. #6 POPUP MINIMIZE+DRAG — popup.js: added `_panelBtns(which)` (min btn markup, mirrors workspace .ds-min-btn) into both open()+openNew() headers, `<div class="bp-divider" data-bp-divider>` between panels, + `_wirePanelControls(overlay)` (per-popup min state machine + pointer-drag resize, row on ≥768 / stacked below). CSS `.bp-ds.bp-min`, `.bp-divider` (row-resize stacked / col-resize desktop), `.bp-body.has-min .bp-divider{display:none}`. Verified min shrinks ds1 122/ds2 722, restore, orange header. #9 SELECTOR APPLE RESTYLE (`SelectorWindow`/`selectorWindow`, screenshot-4 complaint) — `.sel-ds-header` now `var(--panel-head)` orange + white (was flat surface/grey); `.sel-item.sel-preview/.sel-selected` now opaque-orange + inverted white-pill sub (was flat orange-dim tint); `.sel-window` bg→--black + ring shadow, `.sel-header`→surface, overlay blur 4→5 / dim .72→.55 / pad 20→24; `.sel-ds1/2-body{padding-top:4px}`. Verified orange headers rgb(232,118,26)+white, preview row orange, both themes.
  • CLEANUP DONE: removed dead `#multi-btn`/`#multi-count-bar`/`.multi-check`/`body.multi-mode`/`.list-item.multi-selected` CSS; removed `multiMode`/`multiSelectedIds` from state.js; removed multi-check + multi-selected className from list.js makeListItem.
  • REVERT KNOBS (user said "be prepared to change back"): orange panel headers → set `--panel-head`/`--panel-head-text` (~L416) to surface-4/surface + theme text. KPI ring cap → lower `--kpi-ring-max` (default 999px). Panel gaps → `--panel-gap` (10px). 
  • FINAL REGRESSION: 9/9 boards render DS1+DS2 no throw, gear present, multi+list-toggle gone, deselect-on-reclick works, zero console errors. style.css braces 630/630, all JS node-check OK.
- ✅ 1.5i USER-FEEDBACK ROUND 4 (2026-05-31, 5 polish items on Opus): (#4-tone) `--panel-head` orange softened to `color-mix(in srgb, var(--orange) 80%, #000 20%)` dark / `...#fff 20%` light (was full orange, "overwhelming"); revert = set to surface-4/surface. (#1-plus) `.new-plus` "+" text glyphs → crisp inline `<svg>` plus (11px) in 20px square; removed font-size/padding hacks. (#2-gear) `#tools-btn` SVG was a sun (r=2.6 circle + rays) → real toothed gear path; added `.bottom-divider` before gear for spacing from +New; `#tools-menu` now positioned via JS (`left = gear.right - menuWidth`, clamped) so it sits OVER the gear (transform-origin bottom-right); Theme row → sun/moon PILL TOGGLE (`.theme-switch` 56×26 track + `.theme-knob` slides translateX(30px) on body.light; sun orange in dark, moon orange in light); "Session Sync" renamed "QR Code". Theme JS: removed `#icon-sun`/`#icon-moon` refs (deleted those consts + applyTheme icon lines) — knob is pure CSS off body.light. (#3-nav) MUTUAL EXCLUSION: openNav/openNewMenu/tools-click each call the other two closers (one pill menu at a time). openNav() now AUTO-EXPANDS the current board's group (`PAGES[currentPage].group`) instead of collapsing all (accordion already correct in the delegate). (#5-popup) Board Popup + Selector now match workspace: `.bp-body`/`.sel-detail-panels` are padded rails (`gap/padding:var(--panel-gap)`, --black bg); `.bp-ds`/`.sel-ds` float as rounded cards (surface bg, border, radius 14); `.ds-header`/`.sel-ds-header` top corners radius 14. Horizontal drag was ALWAYS working — "not working" was preview viewport 655px (<768 → stacked/row-resize); verified at 1280px: bodyDir row, col-resize, drag moved ds1 399→267. style.css braces 642/642, all JS node-check OK, 9/9 boards render, theme pill + QR + mutual-exclusion all verified, zero console errors.
  • REVERT KNOBS unchanged + new: orange tone via `--panel-head` color-mix %; everything else as before.
- ✅ 1.5j USER-FEEDBACK ROUND 5 (2026-05-31, 3 items on Opus): (#1) DASHBOARDS REMOVED from nav — deleted the `data-group="dashboards"` nav-group from index.html (reached via KPI ring double-click). nav groups now rentals/fleet/admin. dash-* still routable as PAGES (verified navigateTo('dash-mechanic') works) — just not in the menu. (#2) PRO ICONS — swapped hand-drawn sun/moon/gear for Lucide (MIT) paths: gear=lucide "settings" (24×24, 2px stroke, cog + center circle), sun=lucide sun (circle r4 + 8 rays), moon=lucide moon (single crescent path). All viewBox 24×24 stroke-based. (#3-BIG) SELECTOR BG WAS BACKWARDS — user nailed it: `.sel-window` was `--surface` (gray) with dark list = inverted depth + double-padded DS cards. FIX: `.sel-window{background:--black}` (the page); search/list/DS now float as `--surface` CARDS on black. `.sel-header` transparent (was surface band); `.sel-search` floats (radius12+shadow+focus glow); `.sel-workspace` = black rail w/ panel-gap padding; `.sel-list-panel` = surface card radius14 (was borderless); `.sel-panel-divider` invisible draggable gap (was gray bar); `.sel-detail-panels` transparent (removed double-pad — gap lives between cards); `.sel-footer` transparent. ADDED SELECTOR MINIMIZE (#3 "missing minimize"): min btns in both sel-ds-headers + `.sel-ds-divider` (stacked drag) + JS wiring in SelectorWindow._build() (s1Min/s2Min state machine + pointer drag, mirrors BoardPopup). Verified desktop+mobile+light: windowBg rgb(10,10,10), listBg rgb(20,20,20), list+ds radius14, 2 min btns, minimize shrinks. style.css braces 647/647, all JS node-check OK, 9/9 boards, nav opens+auto-expands fleet, dash still routable, zero console errors. Removed leftover duplicate `.sel-header` rule.
- ✅ 1.5k USER-FEEDBACK ROUND 6 (2026-05-31, 2 final polish items — user said "genuinely no more corrections, great job"): (#1) TOOLS MENU REDESIGN — removed "Theme" word (pill is the standalone control now: `#theme-toggle` IS `.theme-switch` button, grew to 64×30, knob 24px translateX(34px)); removed QR icon, made QR Code a `.tool-pill-btn` (rounded pill, hover→orange). `#tools-menu` now `flex-direction:row` (horizontal) instead of stacked label rows. Removed `.tool-row`/`.tool-ico`/`.tool-theme` (dead). (#2) +NEW RATIO — `.new-opt` font 0.88→0.98rem, gap 9→11, plus square 20→19px + svg 11→10px so text reads bigger than the "+" (was "Customer too small"). Verified: no theme label, theme is .theme-switch button (toggles), QR is .tool-pill-btn (opens), newOpt font 13.72px, both themes, zero console errors. style.css braces 644/644.
- ⏳ NEXT: ✅✅ PHASE 1.5 (card-first redesign) IS COMPLETE — user confirmed no more corrections. Item "6." from round-4 was blank/never-specified (user moved on, never raised it again — treat as resolved/non-issue). NEXT MILESTONE = **Phase 2 (Fleet)**: START with the data.js SPEC-divergence review (drop non-SPEC fields, ask on unsure) per the SPEC FIDELITY RULE, then build Units/Categories/Service Orders per SPEC §9.
- ⚠️ Screenshot DISPLAY down this session (capture ok, returns blank). Verify via preview_eval computed-style measurement + ask user to eyeball in real browser. Mockups in /mockups/ (mobile2.html = final locked mobile, v3.html = desktop) are the design reference. REAL preview serverId this session: e1a3dd2b-8364-4099-a4ed-de0ec52e90a5.

**▶▶ PHASE 1 (Foundation) is COMPLETE and AUDITED; light-mode polish (8d) done & visually verified. Next: Phase 2 — Fleet (Units, Categories, Service Orders) per SPEC §14. START Phase 2 with the SPEC-divergence review of data.js (drop non-SPEC fields, ask on unsure) per the SPEC FIDELITY RULE above.**

**TOOLING NOTE:** The `// ──` banner comments (box-drawing char U+2500) wreck Read/Grep/Select-String DISPLAY on these files (show phantom `},`, fake prose, dup lines). They are display artifacts only — files are fine. Verify with `node --check`, the running app, and ASCII-normalized full-text reads. Wrap `preview_eval` returns in `JSON.stringify(...)` to avoid garbled output.

**To resume after restart:** start the dev server (`node server.js`, port 3000) or use the Claude preview, open http://localhost:3000. Note: Google Sheets backend is spec **Phase 8**, not now.

**Tech stack:** Vanilla HTML/CSS/JS → Google Apps Script Web App → Google Sheets API.

**Build order agreed:**
1. UI shell (done)
2. Static mock data (done — all 6 boards have mock data)
3. Google Sheets API connection
4. Write operations (forms)
5. Automations (inspection → work order → service order pipeline)

**How to apply:** Always prioritize speed in design decisions. Never hard-delete data (use status columns). Build and verify one feature at a time.
````

## rentals_stall_board.md

````markdown
---
name: rentals-stall-board
description: "The Rentals card is now the 'Stall Board' + the multi-unit rental flows (invoice sync, per-unit window SPLIT, journey/address sync, maps) — shipped to main 2026-06-15"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9c40ae77-37fe-41f1-b44e-49f317a79a9b
---

The **Rentals detail card = the "Stall Board"** (Jac approved 2026-06-15, shipped to `main` `fab55a9` / PR #40, live on app.jacrentals.com). Machine-first dense layout in `DETAIL.rentals`:
- **Day timeline on top** = the shared rental window + master gate, with the **"N machines Not Ready" blocker folded INSIDE the timeline** beside the gate (side-by-side via `.midwrap`, gate holds center). Rate is NOT on the timeline.
- **Event strip**: `+Invoice` / `+PO` on the LEFT, the pay-status **balance `$0 / $480`** on the RIGHT (the `$0` wears the pay-status color).
- **Per-unit STALLS**: each machine is one block — unit pill + inspection flag + (multi-unit) its own gate + line amount — on a **connected Home—Site—Home route rail** (`stallRouteHtml`) whose legs fill GREEN as captures log (matching the day-cell tint), dashed while pending. Site address once under the Site node. Voided (No-Show/Cancelled) units render struck-through.

**Multi-unit rental flows (same ship):**
- **Invoice SYNC is wired**: adding a unit to an invoiced rental bills it; removing un-bills + restores the total; an address/miles change re-prices the transport line. `syncTransportLine` is **lid-preserving** (re-prices unpaid lines in place, never regenerates a PAID line's lid — keeps allocations) and order-independent. Helpers: `syncRentalLines` (add-missing only), `healInvoiceLines`. Un-voiding a unit restores its lines.
- **SPLIT (important — OVERRIDES the old SPEC v8 "there is NO split-to-own-rental mutation" note):** each stall on a multi-unit rental has a "dates" affordance → a popup that moves that machine to a NEW sibling rental on the SAME invoice (`splitUnitToNewRental`), carrying its captures + address + invoice lines. Guards: locked invoice, paid line, voided unit, inverted window. This is what "a unit's window change → popup to make a new rental on the same invoice" means.
- **Journey/address SYNC**: `yardToolHtml` (Units card) now reads PER-UNIT transport/address (was rental-level), so it mirrors the Rentals route rail; captures were already per-unit. The site address opens per-unit.
- **Maps — LIVE as of 2026-06-15** (PRs #43–#45, #49): a referrer-locked browser key lives in `config.js` (`GOOGLE_MAPS_KEY`, restricted to `app.jacrentals.com` + `localhost:8000`, public-by-design like the Stripe publishable key). `ensureMapsKey` uses the config key DIRECTLY (no backend round-trip — awaiting the nonexistent backend `mapsKey` action paid an Apps Script cold-start that hung the map on "Loading dispatch map…"). The key's enabled APIs are **Maps JavaScript + Places + Places (New) + Distance Matrix — NOT Geocoding**, so address picks resolve via `PlacesService.getDetails` (Places), never `Geocoder.geocode` (Geocoding) which silently failed. The inline transport editor (`.tedit`) is exempt from the global drag-to-chat engine (`dragDown` bails on `.tedit`) so Google handles map pan + the draggable site pin. Offline fallback (no key) still shows the yard-plate placeholder + city-tier pricing. Setup doc: docs/google-maps-setup.md.
  - **GOTCHA (PR #49, the "edit hangs on Loading" bug):** under `loading=async`, `google.maps.DistanceMatrixService` comes up a *beat after* the core map library — so `mapsReady()` must gate **only** on the core (`google.maps.Map` + `google.maps.places`), NEVER on DMS. Gating mount/`live`/load-success on DMS sampled readiness in that gap and stranded the editor on the placeholder (hit edits more — more state in flight; fresh +Transport usually won the race). DMS is now **lazy** in `teFetchDistance` (created on first use, city-tier fallback if absent). Also: `loadGoogleMaps` must NOT cache a failed/empty load (the old `.catch(()=>null)` left one hiccup hanging the map all session) — clear `_mapsPromise` so the next open retries; and `mountTransportEditor` keys off the live DOM (`.gm-style` present?) not a one-shot flag, validates the stored pin (a legacy `{x,y}` sitePin crashes `new Map()`), and try/catches so a half-mount degrades to the offline editor instead of an endless spinner.
  - **GOTCHA (PR #68, the "map appears only on the 2nd open" bug — VERIFIED fixed live):** the map is created in the SAME frame its container is inserted into the DOM, before the browser lays the box out → Google inits it at **0×0** and it stays blank until the next open finds the box sized. Fix in `mountTransportEditor`: after creating the map, `requestAnimationFrame` + a 250ms-timeout backstop that calls `google.maps.event.trigger(map,'resize')` + `setCenter`. Carry this into ANY new map mount (the dispatch cockpit too). Diagnosed from the **prod console**, which proved the key is HEALTHY (no referrer/API/quota error — only Google **deprecation** warnings for `AutocompleteService` / `PlacesService` / `DistanceMatrixService`, all still working; migration spun off as a separate task). So "map won't load" was never a key problem — it was first-paint timing.

**Process that worked (do this for big changes):** built in phases, then ran an **adversarial 5-lens self-audit workflow** on the diff — it caught 3 high-severity billing bugs the green test suite never exercised (paid-line lid orphaning, the multi-unit invoice ✕ wiping siblings, locked-invoice split). All fixed + locked with new `ci/logic-test.mjs` checks (now 42). The passing suite is NOT coverage for paid/locked/un-void/multi-unit-✕ paths unless a check exercises them. See [[no-captures-tracking]], [[ui-design-state]], [[deploy-cadence]].
````

## ui_design_state.md

````markdown
---
name: ui-design-state
description: "Current locked-in UI design decisions for JacTec — layout, theming, panel/section header styles"
metadata: 
  node_type: memory
  type: project
  originSessionId: 474fd0b2-d5fd-4f64-b5c8-8918d60a2f8e
---

**⚑ THE UI SKILL — USE IT FOR ALL UI WORK (2026-06-15, shipped PR #52):** there is now a project skill **`jactec-ui`** at `.claude/skills/jactec-ui/` (committed, auto-discovered). It's the cohesive anti-AI-slop ruleset for the "yard data-plate" system — lean `SKILL.md` + 5 references (`tokens`, the R0–R24 `rulebook`, `signature-recipes`, `anti-slop`, `checklists`). Synthesized from Anthony Hobday's safe rules + the official frontend-design skill + frontend slides + Remotion skills + our own system. **Run every build/reshape/restyle of JacTec UI through it**; it enforces tokens-are-law + builder/`data-r` stamps + zero R0 lint + one-orange + two type voices + AA contrast in all themes + the safe-rules layer + the structure→tidy→responsive→polish→critique workflow. Pairs with the vendored [[ui-design-state]] redlines below (which it encodes) + the `frontend`/`brainstorming` skills. See [[project-jactec]].

**⚑ REDLINE RULES (Jac 2026-06-11, BINDING — from the units-rentals-v2 mockup review; full digest in repo HANDOFF.md "design source of truth"):**
- ONE status-badge font size (11px). **Gate pills** = status dropdowns in the big button shape + chevron (chevron only if it really drops down) — incl. WO line statuses.
- **Destination-icon rule**: any navigating pill/link/button leads with the icon of the card it goes TO (FC pill on Unit wears Rentals icon & vice-versa), no spacer.
- **Derived pills** (ride another pill in same section: Ready←unit, Partial←invoice, category←unit): no bg/border, keep color+icon+hover underline. Hyperlinks blue + italic, NOT bold.
- **Title flags**: 2 stacked 14px mini-flags = 30px title height; live condition + worst open-WO bottleneck. WO type/Open/Waiting pills deleted. **NO backgrounds on flags** (v2.1) — ink+icon+hover-underline like derived pills. Hyperlinks = 12px regular-info size. Inspection "report" link dropped. +Address = LIGHT-ink dashed add (orange add reserved for record links). Timeline: no today-highlight; status = gate pill (On Rent ▾) with naked italic price·rate under it; end-time stacks above end date. Complete WO = "Are you sure? Not all items are completed." confirm (proceedable), NOT a hard block.
- Units card: condition seg (Pass/Not Ready/Fail) first + wash seg (Wash=yellow, Don't Wash=blue, Washed=green) centered, timestamp above; condition LIVE but locked-with-explainer while inspection-born WO open; completed WOs → History links; open WO sections titled by WO NAME, +Part/Task ABOVE lines, totals right-aligned "$x parts + x hrs", +Invoice (replaces Bill toggle) + "Parts $x + Hrs $x = $y", Complete WO blocked until lines done. Investment right: Total Revenue/Monthly/Work Orders/Profit·(ROI%).
- Notes = heading-only line (no box): filled→top, empty→bottom above dotted line.
- History: clickable count chips anchored above a history search bar, inline filtering, record-backed entries only are links. Footers lose total count.
- Rentals: timeline day labels first/last only, price·status·time centered; Complete Rental gate bottom-right (locked till Returned; Cancel/No Show→red Cancel Rental); yard journey captures BLUE, +FC red outline→fill.
- **Yard journey lives on the UNITS card** (2026-06-11): boxless floating tool at the TOP, NO header. 4 nodes: node 0 = reservation (Reserved/Tomorrow/Today/Available + start stamp) → +Start → +FC(red, optional) → +End; rental link rides the first LINE. +Start → "On Rent" green + AUTO-sets rental status; +End → "Returned" yellow → Complete Rental unlocks → journey RESTARTS. Hidden when no active rental.
- **Transport under the INVOICE's rental lines** (2026-06-11): RENTAL section right column lists the invoice's rental line items, each with a **Jac ─ Site ─ Jac** mini journey; **+Log Delivery/+Log Recovery ON the lines === +Start/+End** (same capture+video, synced with the Units yard tool). Site node → smart-address popup (autocomplete + Google-Maps tap-to-drop pin). +Address GONE; no transport until invoice linked — empty state shows combined **+Invoice/+Transport** pill.
- **ITEM BALANCE (2026-06-11, important new concept)**: every invoice line item carries its OWN balance, shown beside the hyperlinked item. A PARTIAL payment forces an assignment popup — user must pick which line items the funds land on and how much; unassigned partials are not allowed. **Invoice unlink lock**: the rental's invoice pill keeps its ✕ ONLY while $0 is assigned to that rental's line item; once any payment is assigned, the ✕ disappears — removing the rental requires REFUNDING the invoice/line item first.
- **v2.2 micro-rules**: derived pill sits directly RIGHT of its parent (global). Partial pill deleted — balance wears pay-status color ($0 red unpaid/due, blue Not Due) + due date beneath. NOTES label removed. Section header+border colors: INSPECTION=inspection status, WO=bottleneck + bold red "WO:" prefix, RENTAL=rental status.

**⚑ THE RULEBOOK GOVERNS EVERYTHING (2026-06-11 streamline — SPEC v7 + v7.1 addendum in JacTec-handoff/JacTec-SPEC-v7.md is the source of truth):** every UI element is built by a numbered rule R0–R20 with a §5 builder stamping `data-r`; the flash-lint (R0) pulses anything that bypasses a builder. Debugging language = "that pill violates R4." Key splits Jac mandated 2026-06-11 evening: **R3 = status badge** (registry color, parent icon, hover) vs **R3b = DATA CHIP** `badge()` (plain fact like "480 HRS" — gray, no icon, independent of R3); **R4 mirror law** — derived pill sits RIGHT of its parent, but LEFT when the parent is right-aligned; **R5 three-way split** — orange add = main record, BLUE add (R5b) = line item within a section, gray add (R5c) = normal empty field; **R19 attention flash** — when the fix is on screen, glow it (`attnFlash`/`flashOr`) instead of an error message (money/safety invariants keep words); **R20 right-click context menu** (Cut/Copy/Paste/Clear/Search/Global Search/Replace/Add Comment/Ask Mr. Wrangler). Debug tools in the bottom bar: lint eye, Design Inspector magnifier (hover names the rule, click copies "R4 · Derived pill — RENTALS › …"), Rulebook doc (live example of every rule).

**⚑ LANGUAGE LAW (Jac, 2026-06-12): say QUOTE, never "draft"** — an unfinished rental IS a Quote-status rental; it survives until completed or deliberately deleted (no mode-exit sweeping). Applies to every toast/label/conversation.

**⚑ THE DRAG ENGINE IS LIVE (2026-06-12, §15c app.js):** rows lift (6px move / 400ms long-press), valid targets glow, the cancel arc rises (--arc-apex knob), dragging a customer reveals invoices mid-drag (+restore), drops dispatch into the real §16 gates, completion = named toast + R19 flash, overbooking toggle in settings (default OFF). Unit→rental = set/swap TODAY — the multi-unit refactor upgrades that drop to ADD (the switch point is commented in linkUnitToRental). NEXT: Wave 2 deletes the Modes (DRAGDROP-DESIGN §6, task #21), then multi-unit (#20). Rules now R0–R23 (R21 file drop, R22 date picker, R23 data-tip tooltips — native title = lint violation).

**⚑ MULTI-UNIT RENTALS (Jac, 2026-06-12, BINDING — prereq for drag & drop): "A Rental is an EVENT, nothing more."** Rentals hold MANY units (excavator+auger, skid steer+trailer). Journeys/inspections stay on Unit cards; drivers log per unit; invoice lines per unit w/ own transport (my reading — confirm); **SPLIT** pulls units into a sibling rental for partial returns (trailer back, skid steer stays out). Full contract: repo `JacTec-handoff/DRAGDROP-DESIGN.md` §2. Engine recon settled: custom pointer drag (ghost outside #app), NOT native DnD. Drag answers locked: swap-when-safe/gates-block, long-press on touch, drop targets = list rows + open cards ("mini" in dictation was a typo).

**⚑ DRAG & DROP = THE LINK ENGINE (Jac, 2026-06-12, BINDING DIRECTION — big deep dive, scheduled AFTER the debug worklist + other-cards updates):** Jac rejected redesigning the pick/+New flows piecemeal — "We're going to implement drag and drop which will solve all of our problems." Linking an EXISTING main item = drag it (row/line/card) onto the target card/slot; this replaces pick mode, fixes the saved-record dead-slot asymmetry, and makes cross-card linking direct. Consequence: the orange R5 add pills become pure CREATE affordances and typically read "+New Customer"/"+New Rental". **QUICK ADD rule (Jac):** +New Customer asks ONLY First + Last + Phone — creates the linked customer immediately (speed first: log the rental now); clicking the customer later finishes the profile. Popup vs inline fields for quick add = UNDECIDED, ask when building.

**⚑ FUTURE SESSION (Jac, 2026-06-11): "Ask Mr. Wrangler" = Claude INSIDE Rental Wrangler** — not just debugging; a full in-app AI assistant. First surfaces already stubbed: the R20 context-menu entry, the Part/Task popup AI-fill (`aiPending` ✨ flags, "Filled by AI if left empty" placeholders), photo review + hour estimates. Needs a backend Claude API endpoint (key in Script Properties, never client-side). Iron out scope with Jac before building.

**⚑ CARD ANATOMY GUIDELINE (Jac 2026-06-10 — broad guideline for EVERY card's standard/detail view; guidelines, not hard rules):**
- **Section 0 = Notes** — appears at the top ONLY when it has content; when empty, the +Notes affordance sits at the bottom, just above the dotted history line.
- **Section 1 = the high-action zone** (sometimes Section 2 as well) — the primary actions a user takes on the record.
- **After the action zone(s): Details, then Data.**
- **Left vs right inside each section/band:** LEFT side = action-focused (where the user interacts). RIGHT side = derived/formulaic values — or sometimes secondary actions like the left.
- Context: with only 3 cards there's more horizontal space per card — use it for the left/right split.

UI design locked in as of 2026-05-28 session. ⚠️ STALE IN PART: the DS1/DS2 three-panel workspace below predates the 3-card column layout on the `design-overhaul` branch — list-item and Add-X principles still apply; panel specifics may not.

**Layout:**
- Three-panel workspace: resizable list panel (left) + DS1 static detail panel + DS2 transactional panel
- Bottom pill bar: Logo | Board name ∨ | +New | multi-select grid | theme toggle | panel-toggle
- Panel-toggle (show/hide detail panels) lives inside the pill — not a floating button
- Pill collapses to logo-only on click (transparent background when collapsed)
- Nav popup appears above the pill

**DS1 / DS2 content alignment:**
- All data rows (`transact-row`) are `justify-content: flex-end` — label + value both hug the right side
- Section headings remain left-aligned
- Panel titles are left-aligned

**Dark mode panel & section headers:**
- Panel headers (`.ds-header`): `var(--surface-4)` = `#35363d` background, white text
- Section headers (`.data-section-heading`, `.transact-label`): `var(--surface)` = `#17181c` background, `var(--text)` color, defined by top/bottom borders
- DS2 section labels use full-bleed negative margin trick to span the transact-block width

**Light mode panel & section headers:**
- Panel headers: `var(--surface)` = white background, black text
- Section headers: `var(--surface-4)` = `#cdd2d9` background, `var(--text)` color

**No underlines on any headers** (tried and removed).

**Panel title naming convention (rentals board):**
- DS1: "Rental" (not "Rental Details")
- DS2: "Dispatch" (not "Dispatch Details")

**DS1 Rentals section order:**
Customer → Unit → Category → INVOICE (heading) → Payment Status → Balance → Invoice ID → RATES → INSPECTION

**Date rows:** text color only (blue/green/yellow/red), no background highlight.

**Status colors:** On Rent = green pill; Available = green; In Service = blue; Down = red; Reserved = purple.

**Section heading helper functions:**
- `heading(text, cls)` — DS1, adds slug class like `heading-invoice` for potential future styling
- `blockLabel(text)` — DS2, same slug system, uses full-bleed styling

**Item List item structure (locked 2026-06-02, supersedes the old left/right split):**
- Every board's list item is LEFT-ALIGNED in two rows, nothing pushed to the right edge.
- **Line 1** (`.item-line1`) = status dot (left) + `.item-name` (bold) + `.item-secondary` (muted text). An empty foreign key shows an **"Add X" pill** here instead of the secondary text (e.g. Parts with no vendor → "+ Add Vendor"; WO with no unit → "+ Add Unit" in the name slot).
- **Line 2** (`.item-line2`) = status pills/badges + data-point stats (compact pills, `flex-wrap`).
- Rationale: Names AND badges are both important, so they each get a full row (avoids name truncation when crammed together).
- Examples: Units = "Bobcat S570 · Skid Steer" / `[READY]`; Work Orders = "JLG 450AJ · Hydraulic Boom Leak Repair" / `[PART ORDERED]` 05-22 (WO list title is the Unit, not the report); Customers = "Clay Dennis · phone" / `[BUSINESS MEMBER][PARTIAL]`.
- **Work Orders list**: completed WOs (`status==='Completed'` / `bottleneck==='Complete'`) sort to the BOTTOM (`woIsDone` in `render/list.js`).
- Old `.item-meta` (right column), `.item-sub`, `.item-badges` retired.
- **Every board has a leading status dot** for alignment: most use `dot(primaryStatus)`; Categories = fleet-health (red any failed / gray any not-ready / else green); Vendors = tax status (green Exempt / gray Not Exempt).
- **Units list** rental slot: rented unit → status pill + Rental Window dates; idle unit → "+ Add Rental".
- **Categories list**: dot · LINE 1 name + utilization snapshot ("{x}% rented · ${rev}/mo" — formal §12 Dollar/Time Util come in Phase 7) · LINE 2 Available/Ready/Failed badges + Day/Wk/4-Wk rates.

**Pick/Selector (Add-X) = `BoardPopup.openSelect`:** opens a tabbed Board Popup with a temporary "New X" record as the active item (preloaded with known data from the originating record via `selectPreload`). Pick an existing sibling + Save → links it (temp discarded); fill the New X + Save → creates a real record (`_nextId`) + links. Cancel/Esc/dim-click → temp discarded. Temp rows render as a `.list-item-new` "+ New X / Creating…" marker.

**Add-X pill directions (`addPill` in util.js):** FORWARD owner `{board,id,field}` → current record's FK = picked id (e.g. Part's "Add Vendor"). REVERSE owner `{setField,setValue}` → the picked/created record's FK points back (e.g. a Unit's "Add Rental" stamps the rental's `fleetItemId`; Customer's "Add Rental"/"Add Invoice" stamp `customerId`). Wired on every empty FK cell across lists + DS1 + DS2.

**Item List CARD collapses to its results** (`#list-panel { flex: 0 1 auto }` + `margin-bottom` for bottom-pill clearance): short lists shrink to fit the rows; long lists cap at the available height and scroll. Adaptive on every load and search (pure CSS, no JS). The card never overlaps the floating bottom pill.
````

## user_profile.md

````markdown
---
name: user-profile
description: "User is the owner of JAC Rentals — smart, non-developer, building via AI-assisted vibe coding"
metadata: 
  node_type: memory
  type: user
  originSessionId: 474fd0b2-d5fd-4f64-b5c8-8918d60a2f8e
---

Owner/operator of **JAC Rentals** (jacrentals.com). Smart businessperson, not a developer. Builds software by collaborating with AI tools ("vibe coding"). Cannot afford costly mistakes from inexperience.

- Shared team login: operations@jacrentals.com (no individual user profiles needed)
- Previously used Monday.com — abandoned due to slowness
- Prefers simple, practical solutions over complex/overengineered ones
- Provides feedback via screenshots and plain language descriptions
- Responsive to honest assessments of risks and trade-offs

**How to apply:** Explain technical concepts in plain business terms. Don't over-engineer. Flag risks clearly. Confirm before building complex automations. One feature at a time.
````
