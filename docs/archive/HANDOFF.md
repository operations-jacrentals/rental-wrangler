# HANDOFF — continue here

> For the next Claude Code session (another machine, the web, or Jac's phone).
> **Read this first.**

## ▶▶▶ STATE AS OF 2026-06-14 (supersedes everything below)

**Baseline (known-good):** branch `claude/handoff-continuation-q442qm` @ **`08f9da8`**
(code + the SPEC v8.1 delta + the mobile spec + the build-list tracker); live **`main`**
@ **`d11e1e3`**. Working tree clean, everything pushed. Gates: `node ci/smoke.mjs`,
`node ci/logic-test.mjs` (a long-standing 20/21 — pre-existing, unrelated), and
`node ci/gen-rule-usage.mjs --check`.

**Shipped this session (all LIVE, details in `JacTec-handoff/JacTec-SPEC-v8.md` §v8.1):**
1. **§17 Internal team dock (Phase 7)** — color-flooded comment composer; headerless
   floating chat dock (tagged-element pill rail · chat bubbles · role tab-bar); PERSISTENT
   multi-chat (never lost, reopen via a tagged element, re-flash on unseen); drag-to-chat
   via the bottom-right drop pad; all four granular element types + categories + services
   stamped `[data-chat-el]`.
2. **§M0–M3 Mobile adaptive reflow** — responsive 3→2→1 columns; swipe nav + per-column
   bottom strips; touch drag edge-switch + bottom-edge chat; long-press = context menu.
   Spec: `docs/superpowers/specs/2026-06-14-mobile-adaptive-design.md`. Desktop untouched.
3. **Skills added** (`.claude/skills/`): `webapp-testing`, `mobile-viewport`,
   `mobile-navigation`, `mobile-touch`.

### ▶ START HERE — the UI DESIGN OVERHAUL (this is the next session's job)
**Goal:** overhaul how the design ELEMENTS *look* — colors, surfaces, type, texture —
**NOT the layout or where anything lives.** The 3-column structure, the M0–M3 mobile
reflow, the drag engine, and the chat dock plumbing all STAY PUT. Restyle, don't relayout.

**1. Branch from the known-good baseline:**
```sh
git fetch origin
# branch tip has the code + these updated docs (SPEC v8.1, mobile spec, this handoff):
git checkout -b claude/ui-overhaul origin/claude/handoff-continuation-q442qm
# (or branch from origin/main for just the deployed code — docs are on the branch)
```
**2. Do it the REVERSIBLE way — build the new look as a PARALLEL THEME.** The app already
has a dark/light toggle (`data-theme`); add the new look as another selectable theme / CSS
token-set ALONGSIDE the current one. The current look stays one tap away, so "if I hate
it" = flip the toggle back. Do NOT overwrite the existing tokens; do NOT merge to `main`
until Jac signs off.
**3. Tools:** run every visual change through the vendored **`frontend` skill** (CLAUDE.md
requires it), working in the CSS **design-token layer** in `style.css` (`--accent`,
`--panel`, the data-plate vars). Screenshot + self-critique before showing Jac.
**4. Don't touch:** the column grid/reflow (§M0–M3), the drag/cancel-arc/drop-pad engine,
the chat dock structure. Those are layout/behavior, not look.
**5. Gates before any push** (same as above). Keep the R-rulebook `data-r` stamps intact;
regenerate `rule-usage.js` (drop `--check`) only if rule USAGE changes.

---

## ▶▶ STATE AS OF 2026-06-12 EVENING (historical — superseded above)

**Everything is LIVE on app.jacrentals.com** (main = design-overhaul; the standing
rule: every VERIFIED batch merges → main → Pages, no per-merge ask).

**Today's giants, all shipped + verified:**
1. **🐉 THE DRAG & DROP ENGINE** (§15c app.js): press a row 6px (or long-press on
   phones) → ghost chip lifts; valid targets glow (`.drop-ok`/`.drop-hot`); the
   dark CANCEL ARC rises bottom-center (`--arc-apex`); Esc cancels; dragging a
   customer reveals invoices in the right column (and vice versa) w/ restore;
   drops dispatch into the REAL §16 gates (blacklist/Sold/locked/paid all hold);
   completion = plain-English toast + R19 flash. Overbooking = settings toggle
   (default OFF) + pulsing red Overbooked flag when ON.
2. **WAVE 2 — THE MODES ARE DEAD**: pick mode fully demolished (−440 lines).
   **LANGUAGE LAW: say QUOTE, never "draft."** +Rental = a Quote appears anchored,
   side cards stay live, you DRAG a unit + customer on (toast teaches this).
   Quotes SURVIVE (no sweeping) and sync to the backend. The +Customer slot on a
   Quote/invoice opens QUICK-ADD (First+Phone) which AUTO-LINKS on save.
3. **Rentals list = the dispatcher row**: each row is a living day-timeline
   (elapsed tint, no color wash), R1 status gate w/ truck inline, stacked R8
   Balance w/ due-context ("$X · Due Jun 18" blue · bare red $X = late, no
   words · Paid green), Today/Tomorrow labels, category flag, two-row footer
   (Billing / Rental Status, registry order).
4. **Cards done**: Vendors · Expenses (+Receipt popup reconciling PARTS w/
   Unaccounted math) · Parts · Files all have v2 in-popup details; Customers
   got the action board (Log/Schedule columns), quick-add, flags+R1 account
   gate, merged Account section, rented-category flags; Categories got header
   flags + units-in-INVESTMENT (R2+R4 mirror); Invoices = ONE section (ledger
   right).
5. **New rules**: R21 file-drop · R22 date picker (native pickers gone) ·
   R23 tooltips (data-tip only; native title = lint violation). Rulebook R0–R23.
   Preview eye system (pills-only hovers, row eye, red No-Preview mode).

**NEXT UP (Jac's queue):** the partial-payment allocation popup (#19 — line
items above the payment section, counter to zero, then charge) · the
MULTI-UNIT RENTALS refactor (#20 — "a Rental is an EVENT"; upgrades the
unit-drop from swap to ADD; per-unit invoice lines; the SPLIT feature; rental
name = "Window: Unit, Unit" w/ customer as flag) · the shop trio cards (WOs/
Inspections/Service) · "Ask Mr. Wrangler" (in-app Claude) parked for its own
session. Full contracts in `JacTec-handoff/DRAGDROP-DESIGN.md` + SPEC v7
(gitignored — on the main machine; ask Jac if working remotely without them).

**Working remotely (phone/web):** this repo is the whole frontend — no build
step. Verify by serving the root + opening `#local` (demo mode). The gitignored
`JacTec-handoff/` docs live only on Jac's main machine; HANDOFF.md (this file)
carries enough to continue. NEVER commit Code.gs (role passwords; repo PUBLIC).

---

## ▶ TOMORROW (2026-06-12) — Jac's agenda, in his words
1. **More debugging.**
2. **Reinventing the +New engines** — the current ones "aren't good enough", especially how to **"link" or "add" EXISTING main items**.
3. **Updating the other cards** (NOT Units or Rentals).

**Start at `JacTec-handoff/TOMORROW-BRIEF.md`** (gitignored, on the main machine / OneDrive) — a 24-agent, citation-verified audit prepared overnight: a 30-item debug worklist, the full map of every create/link mechanism with pain points + 8 design questions for Jac, and a worst-first per-card worklist (129 findings across Vendors · Expenses · Parts · Files · Work Orders · Inspections · Customers · Service Orders · Categories · Invoices).

State as of EOD 2026-06-11: **main = design-overhaul = `1419a92`, live + verified** (streamline, Design Inspector + visual Rulebook, both redline waves, R3b/R5b/R5c splits, R19 flash conversions, R20 context menu). **Backend Code.gs v2 CONFIRMED deployed by Jac — capture video verified saved to Drive.** Rulebook now R0–R20 (SPEC v7 + v7.1 addendum in `JacTec-handoff/JacTec-SPEC-v7.md`). Parked for a future session (Jac): **"Ask Mr. Wrangler" = Claude inside Rental Wrangler** — full in-app AI, not just debugging.

## Where we are
- Repo: `operations-jacrentals/rental-wrangler`. **Production = `main`** → app.jacrentals.com (GitHub Pages).
- **🚀 v2 WENT LIVE 2026-06-11** and the evening waves followed it: main is at **`1419a92`** (CI + Pages green, live site verified). Work continues on `design-overhaul` → merge to main per Jac's go-ahead each time ("Merge or do whatever you need" granted for the 06-11 batch).
- **Backend storage is SCHEMA-LESS** ([id, json] per row — see JacTec-handoff/Code.gs, now ON THIS MACHINE, gitignored, NEVER commit: it contains the role passwords and the repo is public). All new v2 fields persist with no backend change. ✅ **Code.gs v2 (`uploadCapture` → Drive) pasted, authorized, and redeployed by Jac 2026-06-11 — verified end-to-end (capture saved to Drive).**
- We are porting an APPROVED design language + new features into the app in batches B1–B5. App boots clean, no console errors.
- **✅ v2 BUILD LANDED (2026-06-11, 4 phases, commits b50ee19→):** the units-rentals-v2 mockup is IN THE APP. Phase 1 = global layer (gate pills w/ chevrons, derived `.dvd` pills, S1 title chip, centered section headers, section status colors, boxless notes, timeline/journey/seg CSS, permanent-underline italic hyperlinks). Phase 2 = Units card (yard journey tool w/ capture+site popups, live condition/wash segs w/ lock rule, open-WO sections w/ bottleneck colors + type flags + ETA-as-status gates + Complete-WO confirm, Investment left/right, history filter chips, head title-flags). Phase 3 = Rentals card (headerless status-colored RENTAL section w/ day timeline, derived pills, invoice unlink-lock, ITEM BALANCES via `inv.allocations` + `itemPaid()`, Jac─Site─Jac journeys under invoice lines synced to the yard captures, +Invoice/+Transport pill, Complete Rental gate; old white req buttons + rental Inspection section REMOVED). Phase 4 = Inspections/WO tabs hidden (Service stays; hidden tab shows only while active so deep-links work), footer total-count dropped, units footer gains clickable "N WOs Open"/"N Parts Ordered" chips (synthetic `__wo` filter).
- **STILL TODO for the v2 feature set:** the partial-payment ASSIGNMENT POPUP (forces allocating funds to line items — `inv.allocations` plumbing exists, popup not yet wired into the pay flow); real Google Maps embed in the site popup (placeholder grid now); AI-fill endpoint for the Part/Task popup (`aiPending` lines wait on it — part of the future "Ask Mr. Wrangler" work).

## How to run / preview
- Static site, no build. Serve the repo root on port 8000 (`.claude/launch.json` "rental-wrangler", or `python -m http.server 8000`). Open **`http://localhost:8000/#local`** for demo mode (renders from committed `data.js`; no backend needed).
- Verify visually in a real browser; the headless preview screenshot tool was flaky this session (eval works fine). If a change "doesn't show," hard-refresh (Ctrl+Shift+R) — the server sends no cache headers.

## Design source of truth
- **`drafts/site-shell-v2-yours.html`** — the APPROVED clickable mockup of the new design (Jac's vision). It is the spec for the look + the transport picker + every rule. Open it.
- `drafts/button-gallery-v2.html` — the button-system reference.
- **`drafts/units-rentals-v2.html`** (2026-06-11, **DIRECTION APPROVED** — Jac iterated ~10 redline rounds through v2.9 and signed off "loving this". NEXT STEP = build this into the real app on this branch. Any GZ-n notes Jac never overruled stand as decided.) — v1 + ALL of Jac's redlines applied. v1 kept for diffing only. New BINDING rules from the redline session:
  - ONE font size for all status badges (11px). **Gate pills**: any status DROPDOWN takes the big button shape (30px/10px-radius/12.5px bold) + chevron (chevron only on real dropdowns) — applies to WO line statuses etc.
  - **Destination icon**: anything that navigates leads with the icon of the card it goes TO (FC pill on a Unit wears the Rentals icon and vice-versa). No spacer.
  - **Derived pills** (depend on another pill in the same section, e.g. Ready←unit, Partial←invoice): NO background/border; keep color+icon+hover underline. Hyperlinks: blue, italic, NOT bold.
  - **Title flags**: ≤2 stacked mini-flags (14px) matching the 30px title chip height; show live condition + worst open-WO bottleneck. WO type/Open/Waiting pills are DELETED (date-only flag remains).
  - Units: condition toggle (Pass/Not Ready/Fail) FIRST then wash (Wash=yellow/Don't Wash=blue/Washed=green), centered, timestamp above; condition is LIVE but locked-with-explainer while an inspection-born WO is open; completed WOs = History links, open WOs = sections titled by WO NAME; +Part/Task above lines; totals right-aligned "$145 parts + 3.5 hrs"; +Invoice replaces Bill toggle with "Parts $x + Hrs $x = $y" beside it; Complete WO blocks until all lines Complete. Investment right column: Total Revenue/Monthly/Work Orders/Profit·(ROI%).
  - Notes = heading-only line (no boxed section), filled→top (above the rentals timeline), empty→bottom above the dotted line.
  - History: clickable count values anchored ABOVE a history search bar, filtering inline (no popups); only record-backed entries are links. List footers lose the total count.
  - Rentals: timeline labels only on first/last day, price·status·time centered; right column = category/invoice link/Partial(derived)/$paid; Complete Rental gate bottom-right (locked until Returned; Cancel/No Show → red Cancel Rental).
  - **Yard journey lives on the UNITS card** (Jac 2026-06-11): boxless floating TOOL at the very top, NO header label. 4 nodes: **node 0 = the reservation** (label = Reserved/Tomorrow/Today/Available + the reservation start stamp underneath) → **+Start** → **+FC** (red, optional) → **+End**. The rental link rides ON the first line. **+Start logged → label becomes "On Rent" (green) and AUTO-sets the rental's status**; **+End → "Returned" (yellow), Complete Rental unlocks, then the journey RESTARTS** for the next rental. Tool hides with no active rental.
  - **Transport lives under the INVOICE's rental line items** (Jac 2026-06-11): in the RENTAL section's right column show the linked invoice's RENTAL lines (incl. this one), each with its own **Jac ─ Site ─ Jac** journey (keep the building icons). **+Log Delivery / +Log Recovery ride the lines and ARE the same captures as +Start/+End** (one event, synced both ways, shared video). Site node → smart-address popup (autocomplete + Google Map tap-to-drop pin for dispatch). +Address is GONE; no transport until an invoice is linked — the empty state shows a combined **+Invoice/+Transport** pill (functions exactly like +Invoice).
  - **+Part/Task = the ANCHOR treatment** (Jac 2026-06-11): keeps the dashed add size/font but wears the anchored-card neon blue (#18b6ff ink, blue dashed border, NO glow — Jac cut it).
  - **v2.10+ (Jac 2026-06-11, BUILD GREENLIT)**: hyperlinks get a PERMANENT underline (not hover-only). The RENTAL section has NO header label (the timeline opens the section; status color stays on the border). Jac said **"BUILD IT"** — port the mockup into the real app.
  - **v2.8/v2.9 (Jac 2026-06-11)**: ALL section headers CENTERED (right-side flag stacks pin absolutely so titles stay true-center). Every WO carries a **WO TYPE flag** in the top-right stack alongside the date — values: **Field Call** (red, rentals icon → the rental), **Failed Inspection** (red, inspection icon → the report), or the **mechanic's name** (gray, person icon). This replaces the deleted Repair/Service type pills as the WO's origin/type signal.
  - **v2.7 (Jac 2026-06-11)**: DAY TIMELINE lives INSIDE the RENTAL section, directly under its header. Invoice link sits below the unit row (left column). **ITEM BALANCE (new, important term)**: every hyperlinked invoice line item shows its own balance; a PARTIAL payment FORCES an assignment popup — the user picks which line items the funds land on and how much (no unassigned partials). **Invoice unlink lock (Jac 2026-06-11, IMPORTANT)**: the RENTAL section's invoice pill keeps its ✕ ONLY while $0 is assigned to that rental's line item — once ANY payment is assigned, the ✕ disappears and removing the rental from the invoice requires REFUNDING the invoice/line item first. WO footer order: formula → +Invoice → Complete WO (right-aligned cluster). WO red section border brightened (rgba .8). Title chip: icon ring removed (plain orange icon), the orange hover border is now PERMANENT.
  - **v2.5/v2.6 (Jac 2026-06-11)**: RENTAL line items = full-width CENTERED band (names 13.5px, 34px journey nodes); +Log labels bold WHITE not blue. Item-card TITLE = **S1 chip** (dark bg, white bold label, orange-RINGED leading icon) — replaces the orange-outline title. Inspection timestamp rides the section header. **"WO:" prefix follows the bottleneck color** (not locked red). +Part/Task (anchor blue, no glow) shares the totals row above the line statuses. Truncated ADDRESS under each +Log line (Rentals) and on the yard line (Units — replaced the site icon) with a small "DELIVERY · RECOVERY" kind label beneath; address text opens the site popup.
  - **Yard line context + log popups (v2.4, Jac 2026-06-11)**: the rental context on the first yard line = truncated CUSTOMER NAME above the line, RENTAL WINDOW below it, SITE icon (same address popup as the Rental card) under that. Delivery rentals relabel +Start/+End as **+Log Delivery/+Log Recovery** (same capture either way). Every log opens a capture popup; when the rental has transport, the popup TOPS with the address + map pin so the driver sees the destination. The inspection timestamp = when the latest inspection was logged.
  - **More v2.2 rules**: derived pill sits directly RIGHT of its parent pill (global rule, e.g. Updog → Ready → category). Partial pill deleted — the balance wears the pay-status color ($0 red = unpaid&due, blue = Not Due) with the due date beneath. NOTES label removed (just dot+text / bare +Notes). **Section colors**: INSPECTION follows inspection status, WO follows its bottleneck + bold red "WO:" title prefix, RENTAL follows rental status (`.sec-green/.sec-yellow/.sec-red`).

## The design language (now in the app)
- **One orange, one meaning:** solid orange + DARK ink (`--on-orange #1a1205`) = SELECTED tab only · orange OUTLINE (`.pill.ref.link`) = LINKED record · soft-orange (`.iconbtn.on` outline) = armed · warm border = hover.
- **Blue** (`.pill.c-commit`) = Done/Save/commit · **green** (`.pill.c-money`) = money/charge · **solid red** (`.pill.c-danger`) = confirm-destructive.
- **Derived/formulaic values = italic** (`.kv.derived` / `.derived`). **Required-until-entered = white bg + dark ink** (`.req`). **Dashed `+X`** add-affordance (`.add-field`) — no "Add", no space after `+`.
- **Status badges** keep their color + carry the parent-card icon (`SET_CARD` map) + hover highlight/underline (`data-badge`). **Linked pills** carry the entity icon. **Item tabs** carry an entity icon.
- **Bottom bar:** every create action is a labeled button (icon leads label), Wash on the left of the divider; theme/qr/previews/feedback/hotkeys icon-only on the right. No `+New` collapse.
- Live date: `TODAY_ISO` = real local date.

### Card anatomy (Jac 2026-06-10 — broad guideline for every card's standard view; guidelines, not hard rules)
- **Section 0 = Notes** — appears at the top ONLY when it has content; when empty, the `+Notes` affordance sits at the bottom, just above the dotted history line.
- **Section 1 = the high-action zone** (sometimes Section 2 as well) — the primary actions a user takes on the record.
- **After the action zone(s): Details, then Data.**
- **Left vs right inside each section/band:** LEFT = action-focused (the user interacts here). RIGHT = derived/formulaic — or sometimes secondary actions like the left.
- With only 3 cards there's more horizontal space per card — use it for the left/right split.

**✅ Section 0 Notes = IMPLEMENTED on ALL 8 standard views (2026-06-10, Jac: "Every Standard view should have a +Notes section"):** `notesSection(card, rec, idField, field)` helper (app.js, next to `efld`) returns `{top, bottom}` — filled → section at top, empty → `+Notes` above the dotted history line; every renderer places both. Notes carry the 3-color dot everywhere. serviceOrders shares the UNIT's notes (one fact, one place, two lenses); customers reuses `accountNotes` (the old Account-section entry was removed; the account popup clears `accountNotesColor` when notes are wiped). notes added to categories/invoices/workOrders/inspections searchBlobs.
**⚠️ BACKEND DEPENDENCY (before relying on notes live):** notes/notesColor are NEW runtime fields for categories/invoices/workOrders/inspections (+notesColor on rentals/units, accountNotesColor on customers). If Code.gs/Sheet tabs use fixed columns, these will silently NOT round-trip — verify with a 30-second live test (note on a Category → sign out/in → still there?) and add the columns / redeploy Code.gs if needed. Also: `tools/import-real-data.ps1` + `#reseed` regenerates records WITHOUT notes — reseeding after go-live wipes typed notes.

## Done & committed (B1–B5)
- **B1** token layer (`--on-orange`) + tab/coltab/alert/armed restyles.
- **B2a** linked pills (`.link`) + tab icons. **B2b** status-badge icons + hover.
- **B3** bottom-bar reorg + money/commit/danger re-class + removed "no card on file".
- Derived → italic (invoice totals/balance/due-date; rental drive time/price/balance). `efld()` drops "Add" + space.
- **Transport journey-picker** (Yard·Truck·Customer-site) in the rental detail, shown when address set; `js-tnode` handler; `syncTransportLine()` (also fixes a real invoice-desync bug).
- Required-attachment white buttons (`.req`): On-Rent / Returning / Field-Call.

## Decisions already made (don't re-litigate)
- Unit pill = **orange outline** (rule 10 wins over inspection color).
- `+New` collapse button = **dropped**; all create buttons always shown.
- All invoice line names = **blue hyperlinks** (navigable or not).
- Status-badge icons = **YES** (every badge). Orange linked pills in list rows = **YES** (keep).

## Remaining small polish — ✅ ALL DONE (2026-06-10)
- ✅ Anchored standard-mode **TITLE → orange-outline chip** (`.card.anchored .c-titlecard` — accent-soft bg + accent-line border + 999px radius, per mockup `.cardhead .link`).
- ✅ **Derived → italic** in Work Order (parts cost/labor/if-billed), Customer (digest stats line), Category (avg hours/ROI/per-unit rev+exp/util stub) — plus Units investment (repairs / mo avg / total revenue), same rule.
- ✅ **Conditional PO** — white `.req` "PO #" chip only when `cust.requiresPO && !i.po`; entered → normal "PO {n}" pill; not required → subtle "Add PO" pill. Yellow "PO required" badge removed (the white chip IS the signal). Demo seed: HD Services (C0033) now `requiresPO: true` so it's visible for review.
- ✅ **Notes 3-color dot tagging** — `efld(..., { dot: true })` on Rentals + Units notes; editing swaps in input + white/red/green `.dotpick` dots (mousedown so no blur-commit); picked color saved as `{field}Color` on the record; saved note shows a `.note-dot`.

## NEXT BIG DESIGN — from Jac's whiteboards (confirmed "mostly correct")

### UNITS card — merge Inspections + Work Orders INTO the Unit standard view
Top → bottom sections:
1. **Inspection** (latest): `Wash | No Wash` toggle · `Pass | Fail` toggle · Time-Stamp · hyperlink · Description. **Fail → pop-up** (capture photo/description + spins up the WO); the hyperlink ↔ that pop-up/report.
2. **Work Order:** WO Name · Type · Date · **(Totals = derived Hrs/Cost/Price)** · **`+ Part/Task`** lines, each = status **Needed**(red)/**Complete**(green) · Part Name · Hrs, Cost, Price · Hours · **Bill To Customer?** toggle. **"Part Ordered" status → opens an ETA date-picker; the chosen ETA date then displays AS the status** (same "picker becomes the value" trick as the transport picker).
3. **Multiple WOs** repeat as multiple Section-2 blocks.
4. Then the existing Unit content: **SPECS | GPS** (2-col) · **Investment** · **Notes / History**.
→ Net: the Shop sub-types (Inspections + Work Orders) now live INSIDE the Unit.

### RENTALS card
- **Status bar = window timeline:** Mo01 (start) → Mo07 (end), **split into day segments**, with a **Price/Rate** marker + live status + time ("On Rent · 4pm").
- **Rental section:** +Customer · +Unit (+ its Ready inspection badge) · Pay Status · Category · **+Address → the transport journey-picker (ALREADY BUILT)** · +Invoice · `$0 / $1,000` paid/total.
- **Yard section** = a journey widget **`+OnRent ···· +FC ···· +Return`** (rental physical lifecycle, same picker aesthetic). **This REPLACES the current white On-Rent/Returning/Field-Call buttons.**

### Open questions — ✅ ANSWERED by Jac (2026-06-10, BINDING):
1. **Units merge scope** — Inspections & Work Orders standalone tabs GO AWAY; only the **Service tab** remains standalone. Card-footer values give quick access to needed inspections + failed units. **ADD a card-footer value that represents just WO count.**
2. **Inspection section** — latest inspection + **editable** toggles (clicking Wash/No-Wash · Pass/Fail logs a new inspection inline; Fail → photo/description popup + auto-WO).
3. **Yard journey** — YES, replaces the three white capture buttons entirely; `+FC` mid-journey = Field-Call trigger (fail unit + auto-WO).
4. **"Part Ordered → ETA"** — badge displays **"ETA Jun18"**; clicking re-opens the picker AND must let the user **update the status** (part arrived / completed), not just the date.

## Files NOT in git (transfer via OneDrive or copy manually)
- **`JacTec-handoff/`** (gitignored) — **`Code.gs`** (the Apps Script backend — paste + deploy manually) and **`JacTec-SPEC-v6.md`** (the spec; has a "v6.1 Built-State Delta" at the top documenting the live app).
- `.claude/` (auto-memory + `launch.json`) · `JacTec-standalone.html` · `data.generated.js` / `data.demo-backup.js`.
- **`config.js` IS committed** (publishable Stripe key only). The Stripe **SECRET** lives ONLY in the Apps Script Script Property — never in the repo/chat.

## Deploy (only when Jac says go-live)
- Merge `design-overhaul` → `main`, push. CI = "CI — boot check" (Playwright smoke) + "pages build and deployment". `gh.exe` at `C:\Program Files\GitHub CLI\gh.exe`.
- Re-paste/redeploy `Code.gs` if backend actions changed (feedback / card-management / `authorize` already deployed).

## STREAMLINE CAMPAIGN (2026-06-11, ✅ COMPLETE — Jac's pre-debug consolidation)
- **THE RULEBOOK + DEBUGGING LANGUAGE = `JacTec-handoff/JacTec-SPEC-v7.md`** (private). Rules R0–R18, builders in app.js §5, every element stamped `data-r`. Flash-lint (R0) ON by default — ZERO flashing across boards/tabs/details/popups as of completion. app.js carries a clean §1–§18 section index. Dead code purged (audit-evidenced). Debug by rule number: "that violates R4".
- **Done:** A) full-app audit (worklist: `JacTec-handoff/STREAMLINE-AUDIT.json` — violations w/ line numbers, dead-code w/ grep evidence, section-reorg plan). B) **UI BUILDER layer** (§5 of app.js): one function per rule, each stamps `data-r="Rn"` — R1 gatePill/gatePillRaw/funnelPill · R2 refPill/unitPill · R3 statusPill/badge · R4 dPill · R5 addBtn · R6 reqBtn · R7 linkName · R9 flagEl/flagsStack · R14 segCtl · R17 actionPill · R18 ghostPill (the ONE Cancel/Close). **R0 FLASH-LINT**: anything matching pill/add/flag/link/req/seg WITHOUT a data-r stamp pulses red — bottom-bar eye toggle, ON by default. C1+C2) all DETAIL renderers, head flags, row badges routed through builders — **lint = ZERO flashing on boards + every tab + rental/unit/customer/category/service details.**
- **All phases A–E complete** (chrome batch, Phase D dead-code purge, §1–§18 banners, SPEC v7). Since then: **Design Inspector + visual Rulebook** debug tools (bottom-bar magnifier hovers any element → names its rule; click copies a "R4 · Derived pill — RENTALS › …" reference; doc icon opens a live example of every rule) and the **v7.1 rule changes** (R3b data chip, R4 mirror placement, R5/R5b/R5c add-color split, R19 attention flash replacing on-screen-fix error toasts, R20 right-click context menu). The 06-12 audit found a NEW crop of unstamped emissions on the shop/back-office cards — they're itemized in TOMORROW-BRIEF.md §1/§3, mostly absorbed by the coming card rebuilds.
