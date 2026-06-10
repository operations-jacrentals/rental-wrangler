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

## The design language (now in the app)
- **One orange, one meaning:** solid orange + DARK ink (`--on-orange #1a1205`) = SELECTED tab only · orange OUTLINE (`.pill.ref.link`) = LINKED record · soft-orange (`.iconbtn.on` outline) = armed · warm border = hover.
- **Blue** (`.pill.c-commit`) = Done/Save/commit · **green** (`.pill.c-money`) = money/charge · **solid red** (`.pill.c-danger`) = confirm-destructive.
- **Derived/formulaic values = italic** (`.kv.derived` / `.derived`). **Required-until-entered = white bg + dark ink** (`.req`). **Dashed `+X`** add-affordance (`.add-field`) — no "Add", no space after `+`.
- **Status badges** keep their color + carry the parent-card icon (`SET_CARD` map) + hover highlight/underline (`data-badge`). **Linked pills** carry the entity icon. **Item tabs** carry an entity icon.
- **Bottom bar:** every create action is a labeled button (icon leads label), Wash on the left of the divider; theme/qr/previews/feedback/hotkeys icon-only on the right. No `+New` collapse.
- Live date: `TODAY_ISO` = real local date.

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

## Remaining small polish (was queued next)
- Anchored standard-mode **TITLE → orange-outline chip** (currently flat orange text — style `.c-titlecard` / `.d-title`).
- Remaining **derived → italic** in Work Order / Customer / Category detail views.
- **Conditional PO** → white `.req` only when the account requires a PO.
- **Notes** field → 3-color dot tagging (white/red/green) on entry.

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

### Open questions for Jac (answer before building Units/Rentals):
1. **Units merge scope** — do the standalone Inspections & Work Orders tabs go away entirely (fully absorbed into Units), or remain as separate lists too?
2. **Inspection section** — latest inspection only? Are Wash/Pass-Fail toggles editable (log a new inspection) or display-only?
3. **Yard journey** — confirm it replaces the three capture buttons; `+FC` mid-journey = Field-Call trigger (fail unit + auto-WO).
4. **"Part Ordered → ETA"** — once picked, the status pill shows the date (e.g. `Jun 18`); picking again re-opens the date picker?

## Files NOT in git (transfer via OneDrive or copy manually)
- **`JacTec-handoff/`** (gitignored) — **`Code.gs`** (the Apps Script backend — paste + deploy manually) and **`JacTec-SPEC-v6.md`** (the spec; has a "v6.1 Built-State Delta" at the top documenting the live app).
- `.claude/` (auto-memory + `launch.json`) · `JacTec-standalone.html` · `data.generated.js` / `data.demo-backup.js`.
- **`config.js` IS committed** (publishable Stripe key only). The Stripe **SECRET** lives ONLY in the Apps Script Script Property — never in the repo/chat.

## Deploy (only when Jac says go-live)
- Merge `design-overhaul` → `main`, push. CI = "CI — boot check" (Playwright smoke) + "pages build and deployment". `gh.exe` at `C:\Program Files\GitHub CLI\gh.exe`.
- Re-paste/redeploy `Code.gs` if backend actions changed (feedback / card-management / `authorize` already deployed).
