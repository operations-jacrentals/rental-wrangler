# HANDOFF — continue here (`design-overhaul` branch)

> For the next Claude Code session (another machine). **Read this first.**

## Where we are
- Repo: `operations-jacrentals/rental-wrangler`. **Production = `main`** → app.jacrentals.com (GitHub Pages).
- **Active work is on branch `design-overhaul`** (pushed to origin). **`main`/production is UNTOUCHED — do NOT merge until Jac approves a full review.**
- We are porting an APPROVED design language + new features into the app in batches B1–B5. App boots clean, no console errors.

## How to run / preview
- Static site, no build. Serve the repo root on port 8000 (`.claude/launch.json` "rental-wrangler", or `python -m http.server 8000`). Open **`http://localhost:8000/#local`** for demo mode (renders from committed `data.js`; no backend needed).
- Verify visually in a real browser; the headless preview screenshot tool was flaky this session (eval works fine). If a change "doesn't show," hard-refresh (Ctrl+Shift+R) — the server sends no cache headers.

## Design source of truth
- **`drafts/site-shell-v2-yours.html`** — the APPROVED clickable mockup of the new design (Jac's vision). It is the spec for the look + the transport picker + every rule. Open it.
- `drafts/button-gallery-v2.html` — the button-system reference.
- **`drafts/units-rentals-v2.html`** (2026-06-11, AWAITING JAC'S REVIEW) — v1 + ALL of Jac's redlines applied. v1 kept for diffing only. New BINDING rules from the redline session:
  - ONE font size for all status badges (11px). **Gate pills**: any status DROPDOWN takes the big button shape (30px/10px-radius/12.5px bold) + chevron (chevron only on real dropdowns) — applies to WO line statuses etc.
  - **Destination icon**: anything that navigates leads with the icon of the card it goes TO (FC pill on a Unit wears the Rentals icon and vice-versa). No spacer.
  - **Derived pills** (depend on another pill in the same section, e.g. Ready←unit, Partial←invoice): NO background/border; keep color+icon+hover underline. Hyperlinks: blue, italic, NOT bold.
  - **Title flags**: ≤2 stacked mini-flags (14px) matching the 30px title chip height; show live condition + worst open-WO bottleneck. WO type/Open/Waiting pills are DELETED (date-only flag remains).
  - Units: condition toggle (Pass/Not Ready/Fail) FIRST then wash (Wash=yellow/Don't Wash=blue/Washed=green), centered, timestamp above; condition is LIVE but locked-with-explainer while an inspection-born WO is open; completed WOs = History links, open WOs = sections titled by WO NAME; +Part/Task above lines; totals right-aligned "$145 parts + 3.5 hrs"; +Invoice replaces Bill toggle with "Parts $x + Hrs $x = $y" beside it; Complete WO blocks until all lines Complete. Investment right column: Total Revenue/Monthly/Work Orders/Profit·(ROI%).
  - Notes = heading-only line (no boxed section), filled→top (above the rentals timeline), empty→bottom above the dotted line.
  - History: clickable count values anchored ABOVE a history search bar, filtering inline (no popups); only record-backed entries are links. List footers lose the total count.
  - Rentals: timeline labels only on first/last day, price·status·time centered; right column = category/invoice link/Partial(derived)/$paid; Complete Rental gate bottom-right (locked until Returned; Cancel/No Show → red Cancel Rental). Yard journey captures = BLUE; +FC red-outline→red-fill.

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
