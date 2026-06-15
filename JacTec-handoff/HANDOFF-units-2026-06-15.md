# Handoff — Rental Wrangler (last 24h) + the Units problem

**Date:** 2026-06-15 ~01:00 UTC · **Live:** app.jacrentals.com (GitHub Pages from `main`)
**Repo:** operations-jacrentals/rental-wrangler · **Deploy:** branch → PR → **squash-merge** (`main` is branch-protected; Pages auto-builds on merge)
**This doc is internal** (gitignored — not served by Pages, not in the public repo).

---

## ⭐ START HERE — 2026-06-15 evening update (for the local session)

Everything from §0 down is the original units-migration handoff (still valid). This block is the
**current state + your forward actions** after a long evening session. Full record of what shipped:
the **SPEC v8.5 Built-State Delta** in `JacTec-SPEC-v8.md` (committed, travels with the repo).

**Deploy model changed:** `main` is **branch-protected** (required `smoke` check) — deploy via
**branch → PR → squash-merge** (GitHub MCP `merge_pull_request` with `squash`, or `gh`), NOT
`git push origin HEAD:main`. Run local gates first: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
`node ci/gen-rule-usage.mjs --check` (regenerate with no `--check` if rule usage changed).

**Your forward actions, in order:**
1. **Deploy the two backend handlers** (you have Drive + `Code.gs`/clasp; I didn't). Both
   **frontends are already LIVE** with graceful fallbacks until these land — paste into the
   `doPost` action switch + redeploy:
   - **`uploadFile`** — F2 file uploads → Google Drive (returns a share link). Spec: **§9** below.
   - **`saveSession` / `getSession`** — H1 session-sharing via the QR. Spec: **§10** below.
   Then test each end-to-end on the live site.
2. **Run `#migrate-units` on live** (signed in as Admin/Owner) and **verify in the Sheet** — the
   unrecorded-unit repair is built + deployed but **not yet run on production**. Full detail in
   §0–§6 below; the 48 phantom units + cleaned-name mapping are in §6.
3. **Finish A1** — the Categories **fleet-bar** (`state.fleetFilter`) is the ONE sticky filter not
   yet routed into the search bar. Do it like the footer chips / Not-Ready / Services: switch to the
   Units list + `addColFilter('units', <synthetic col>, …)` and add the match to `totColMatch`.
4. **I1** — wire Mr. Wrangler into the **New-Receipt** + **Part/Task photo** popups so a photo lets
   it fill the fields (the Wrangler backend exists per SPEC v8.2/8.3; reuse `backendCall('wrangler', …)`
   with an image content block).

**Shipped this evening (all live):** units migration + "All Units" view; **A1** (footer / "Not Ready"
/ Services sticky filters → removable search pills); 14 UI/interaction fixes — B1/B2/B4/B5/B6/B7,
D1/D2/E1/E2, C1/F1/F2/G1/H1. (`CLAUDE.md` also now records: **always ask via popups**.)

---

## 0. TL;DR for the next session

- The **"units that don't show up" problem is diagnosed and the fix is built + deployed** — but **NOT yet run on live**. Your job: run it (or guide Jac to), then verify against the Sheet.
- The fix is an in-app, admin-gated, preview-then-confirm migration reached at **`app.jacrentals.com/#migrate-units`**. It creates real unit records for ~48 imported "phantom" units and links every rental to them. It's **idempotent** (safe to re-run) and was tested end-to-end.
- You (local Claude Code) have **Google Sheets + Drive access**, which I did not have for writes — so you can **verify the result** in the Sheet, and optionally do direct spot-fixes.

---

## 1. What shipped in the last 24h (all on `main`, live)

Two sessions were working `main` concurrently (this one + a UI-overhaul session). Highlights:

| Commit | What |
|---|---|
| `398e800` | **Round up missing units** — the import-repair migration (the Units fix below) |
| `3b6db38` | **"All Units (any status)"** units view — show every fleet status at once |
| `98642c7` | Merge: Mr. Wrangler onto latest main |
| `ad2b987` | Live multi-user refresh (poll backend so open sessions see each other) |
| `a3a2d74` | Fix hover-preview persistence |
| `51ac7e7` | Fix right-click (lastCtx ReferenceError) |
| `76e3613` | **§18 Mr. Wrangler** — in-app AI assistant v1 (frontend; PR #6, merged) |
| earlier | "The Yard" theme lock, mobile reflow M0–M3, rulebook→design-system, customer activity charts |

### Open thread — Mr. Wrangler backend not deployed yet
The §18 **frontend** is live, but the panel calls the backend for real answers. Until the Apps Script `Code.gs` `wrangler` handler + `ANTHROPIC_API_KEY` (and optional `WRANGLER_MODEL`) Script Property are deployed, asking a question shows *"couldn't answer."* Backend handoff lives at `JacTec-handoff/mr-wrangler-codegs.md` (delivered separately). Default model `claude-sonnet-4-6`.

---

## 2. The Units problem — root cause

**Symptom (Jac):** real machines (Weatherman, Skyline, Smash, Everly, Whiskey, Donkey, Alabama…) don't appear in the Units list, even with the new "All Units" view.

**Cause:** these were **imported as rentals where the machine is only a free-text `legacyUnitName`** with **`unitId: null`** — they were **never created as unit records**. The Units list renders real unit *records* (`DATA.units`), so a name that exists only as a label on a rental is invisible. (The "All Units (any status)" view only un-hides records with a non-Active fleet status; it can't show a non-record.)

**Scope:** **48 distinct `legacyUnitName` values** with no matching unit record. Real inventory is **155 units, `U001`–`U155`**. (See the full list in §6.)

### Data model (how units link — confirmed in code + Sheet)
- **Rental** (legacy single-unit shape): top-level `unitId` (null), `legacyUnitName`, `categoryId`; **`units: []`** (empty array); **`invoiceId`** usually `null`.
  - The app synthesizes a unit entry from the top-level fields when `units[]` is empty (`legacyUnitEntry` / `rentalUnits` / `rentalUnitsLabel`, app.js ~83–125).
- **Customer link:** via `rental.customerId` → automatic once the rental has a unit.
- **Category link:** `unit.categoryId` (set on creation from the rental's `categoryId`).
- **Invoice link:** `invoice.rentalIds[]` + per-line `lineItems[].unitId` (`invoiceUnitIds`, app.js ~5528). Most legacy rentals have `invoiceId: null`, so little/none to relink.
- **Work order link:** WO has a direct `unitId`. None of the phantom units have WOs (they had no id to reference).

### The Sheet
- File: **"Rental Wrangler — Live Database"** (find via Drive search `title contains 'Rental Wrangler'`; owner operations@jacrentals.com). Created by the app's Apps Script setup.
- Per-entity tabs. **`units` tab** rows are **`[id, json]`** — col A = `unitId`, col B = the JSON record. Header row 1 = `id | json`. 155 unit rows (rows 2–156).
- `categories` tab: `CAT001`–`CAT046` (e.g. CAT003 Lift Boom 40ft, CAT004 Lift Scissor 26ft, CAT007 Lift Lull Forklift 5k, CAT009 Buggy, CAT038 Att Breaker Skid Exc).
- Unit record schema: `{unitId, name, categoryId, assignedMechanic, currentHours, inspectionStatus, fleetStatus, purchaseHours, serviceCompletions{}}` (+ optional serial/make/model/year/gps*/purchase*/notes).

---

## 3. The fix that's already built & deployed (`#migrate-units`)

Admin-gated, preview-first, idempotent. Code in `app.js`:
- `cleanUnitName(raw)` — **app.js:8481** — strips import cruft → clean name. Rules (in order): drop `❌`/`(❌)`; `_`→space; drop `(parenthetical notes)`; drop `BMT ONLY`; drop `Feb 22-23`-style date ranges; drop leading `Tool `; strip leading `?`/space; collapse whitespace.
- `planUnitMigration()` — **app.js:8495** — scans `DATA.rentals` for unresolved `legacyUnitName` (unitId null & no resolvable units[] entry), groups by **cleaned name**, dedupes, picks the **most-common category** among the group's rentals; if a real unit already has that name → **action `link`** (no duplicate), else **action `create`** with the next `U###` id. Skips names with no letters (e.g. `46\`). **Mutates nothing.**
- `applyUnitMigration(plan)` — **app.js:8520** — creates the records (fleetStatus `Active`, inspectionStatus `Not Ready`, 0 hrs), sets `rental.unitId` on every referencing rental (+ `units[]` entries, + any billed `invoice.lineItems[].unitId`), `reindex`es, then `saveSoon()` → the diff-sync (`backendCall('sync', …)`) persists to the Sheet.
- Preview overlay kind `'migrateUnits'` — **app.js:4357** · Confirm handler `.js-migrate-go` — **app.js:6199** · `#migrate-units` route in `finishLoad` — **app.js:8255** (gated by `adminUnlocked()`, self-clears the hash).
- Test seam exposes `cleanUnitName / planUnitMigration / applyUnitMigration / openMigrationPreview` on `window.__rw` (#local only).
- **Tests:** `ci/logic-test.mjs` check #12 (+7 assertions): cleaning, dedupe, link-not-duplicate (Worm→U003), idempotency. Suite is **28/28**.

**Decisions already baked in (per Jac):** treat them as **normal units** (no "legacy" framing); existing-name → **link not duplicate** (e.g. `(❌)Reptar`→ real Reptar `U005`, `(❌)Billy Cajun`→`U150`); junk skipped; no-category rentals → uncategorized unit.

---

## 4. ⭐ INSTRUCTIONS — finishing the Units problem

### Path A (recommended): run the in-app migration, then verify in the Sheet
This reuses the **tested** code + the app's own sync, so it can't diverge from app logic.
1. Have Jac open **`https://app.jacrentals.com/#migrate-units`** signed in as **Admin/Owner** (it's a browser/login action — the agent can't click Confirm headlessly).
2. The preview lists every unrecorded unit: cleaned **name**, **New `U###`** vs **Link `U###`**, **category**, **# rentals**. Review it (especially the cleaned names and the create/link split).
3. Click **"Create & link N."** Units appear in the Units list (Active) with rental history attached; the diff-sync writes them to the Sheet.
4. **You verify (you have Sheet/Drive access):** re-read the `units` tab — expect ~**155 + (number of `create` rows)** units; confirm the new names exist, none duplicated, and that previously-phantom rentals in the `rentals` tab now have a non-null `unitId`. Re-running `#migrate-units` should show **nothing** (idempotent).

### Path B (only if Jac wants the agent to do it directly, and you have Sheets WRITE)
Replicate `planUnitMigration`/`applyUnitMigration` exactly (see §3 rules) against the Sheet:
- For each **create**: append `[U###, json]` to the `units` tab (next id after the current max `U###`; schema in §2).
- For each rental referencing that cleaned name: set its `unitId` (col-B JSON) to the resolved id; if `invoiceId` set, patch matching `lineItems[].unitId`.
- For **link** names (existing unit by cleaned name): set the rentals' `unitId` to the existing id; **do not** create a unit.
- **Caution:** this hand-rolls the app's logic — easy to drift. Prefer Path A. Use B only for targeted spot-fixes or if Jac explicitly wants it automated.

### Still-open decisions to raise with Jac
- **Name quality:** cleaning is heuristic. A few keep descriptors (e.g. `Smash_Breaker_Exc/Skid_Combo_` → `Smash Breaker Exc/Skid Combo`; `Tool_Lil Jimmy 60#Jack Hammer` → `Lil Jimmy 60#Jack Hammer`). The preview shows them; rename in the Sheet if Jac wants tidier names. **There is no in-app unit-name editor yet** (see below).
- **3 names Jac listed that aren't in the data at all:** **Cocaine, Buster, Crack** — no record *and* no legacy rental. If real, add them as normal units (next free id `U156`+, e.g. Cocaine→CAT009 Buggy/Canycom SC75, etc.). **Do NOT** reuse the old "U156–U164 paste rows" I gave earlier in chat — that predates this migration and would duplicate.
- **No "Add Unit" UI exists.** Creation only happens via the Sheet, `#reseed`, or now `#migrate-units`. A proper **Add Unit + Add Category** form is a worthwhile next feature (the `+ New` menu currently covers only rentals/invoices/customers/inspections/WOs/receipts — `PLUS_NEW`, app.js ~3682).

---

## 5. Gates, deploy, conventions
- **Gates (must pass before push):** `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`.
- **Deploy:** `git push origin HEAD:main` (Pages builds). Two sessions share `main` — **always `git fetch origin main` + merge before pushing**, re-run gates.
- **Design:** new/changed UI runs through the `frontend` skill in the "Yard data-plate" language (hazard stripe, Saira Condensed stamps, safety-orange, rivets, light ranch/wrangler copy). The migration overlay reused existing dialog chrome + wrangler copy ("Round up missing units").
- **Don't commit:** model identifiers, secrets, `DEFAULT_CONFIG` passwords, real customer PII. `backend/Code.gs` stays gitignored.
- **Commit-badge note:** my commits show "Unverified" on GitHub (no GPG/SSH signing key available here). Identity is correct (`Claude <noreply@anthropic.com>`). Not fixed because it'd require force-pushing shared `main`. Cosmetic only.

---

## 6. The 48 phantom units (reference — name ×rentals · category)

`create` = no existing record; `link` = a real unit already has this (cleaned) name.

| legacyUnitName (raw) | ×rentals | category | note |
|---|---|---|---|
| Alabama | 22 | CAT014 (4k Excavator) | create |
| Everly | 13 | CAT007 (Lull Forklift 5k) | create — Jac spelled it "Everley" |
| (❌)Baba | 13 | CAT009 (Buggy) | create → "Baba" |
| Breaker Skid Blue | 12 | CAT038 (Att Breaker Skid Exc) | create |
| (❌)Missy | 12 | CAT013 (6k Excavator) | create → "Missy" |
| Forks Skid/Tractor | 8 | CAT037 (Att Forks Skid) | create |
| Austin | 7 | CAT022 (Trailer 3k) | create |
| Drill Clinton_Auger_Exc (exc/skid combo) | 7 | CAT039 (Att Auger Skid) | create → "Drill Clinton Auger Exc" |
| Whiskey | 7 | CAT009 (Buggy) | create |
| Tool_Lil Jimmy 60#Jack Hammer | 7 | CAT031 (Tool Jackhammer) | create → "Lil Jimmy 60#Jack Hammer" |
| Madam | 6 | CAT023 (Trailer 11k) | create |
| Mystic | 6 | CAT009 (Buggy) | create |
| Tool_BuzzCut_20'_WB_Concrete_Saw | 5 | CAT025 (Tool WB Saw 20in) | create → "BuzzCut 20' WB Concrete Saw" |
| (❌)Mercy | 5 | CAT008 (Skid Steer 75hp) | create → "Mercy" |
| Frankenstein | 5 | CAT021 (Trailer 7k) | create |
| Tumbler | 4 | CAT018 (3k Roller) | create |
| Beau | 4 | CAT008 (Skid Steer 75hp) | create |
| JackUp | 4 | CAT004 (Lift Scissor 26ft) | create |
| Landslide_BMT ONLY | 4 | CAT018 (3k Roller) | create → "Landslide" |
| Tool_60# Red31 Jack Hammer | 4 | CAT031 | create → "60# Red31 Jack Hammer" |
| 46\ | 3 | — | SKIP (no real name) |
| Tool_Tile Chipper #31 | 3 | CAT027 | create → "Tile Chipper #31" |
| Smash_Breaker_Exc/Skid_Combo_ | 3 | CAT038 | create → "Smash Breaker Exc/Skid Combo" |
| Brett | 3 | CAT041 (Lift Scissor 19ft) | create |
| Weatherman | 3 | CAT003 (Lift Boom 40ft) | create |
| Grant | 3 | CAT017 (Trencher) | create |
| Tool 3in Trash Pump Green #11 | 3 | CAT026 | create → "3in Trash Pump Green #11" |
| (❌)Yellow Exc 4k_Yanmar_BMT ONLY | 2 | CAT014 | create → "Yellow Exc 4k Yanmar" |
| MawMaw | 2 | CAT004 | create |
| Crawfish_BMT ONLY | 2 | CAT041 | create → "Crawfish" |
| Tool 18in Plate Tamper #11 | 2 | CAT034 | create → "18in Plate Tamper #11" |
| Skyline | 2 | CAT004 | create |
| (❌)Dragon | 2 | CAT016 (Stump Grinder) | create → "Dragon" |
| (❌)Elder Yellow | 2 | CAT023 | create → "Elder Yellow" |
| (❌)46\ | 1 | — | SKIP |
| Wheels | 1 | CAT013 | create |
| Donkey | 1 | CAT009 | create |
| (❌)Billy Cajun | 1 | CAT044 (Tractor 34hp) | **LINK → U150** (Billy Cajun exists) |
| (❌)Yoda | 1 | CAT022 | create → "Yoda" |
| (❌)Mom | 1 | CAT013 | create → "Mom" |
| ?Plumbing Snake_Roto Rooter #21 Feb 23-24 | 1 | — | create → "Plumbing Snake Roto Rooter #21" |
| Plumbing Snake | 1 | — | create (no category) |
| Tool_Bull Float 4ft | 1 | CAT034 | create → "Bull Float 4ft" |
| Trailer_9587_7k | 1 | CAT020 (Trailer Dump 10k) | create → "Trailer 9587 7k" |
| ❌Yaga Feb 22-23 | 1 | CAT009 | create → "Yaga" |
| (❌)Reptar | 1 | CAT011 (12k Excavator) | **LINK → U005** (Reptar exists) |
| Tool_Hammer Drill_Bosch #1 | 1 | — | create → "Hammer Drill Bosch #1" |
| Tool_Wacker Packer_Dynapac #11 | 1 | CAT029 | create → "Wacker Packer Dynapac #11" |

*(The live `#migrate-units` preview is the source of truth — it recomputes this list at run time; use this table to sanity-check completeness.)*

---

## 7. Quick orientation for the local session
- App is a single-file vanilla-JS SPA: `app.js` (~8800 lines), `style.css`, `index.html`, `config.js`, `data.js` (demo/seed only — live reads the Sheet).
- Run/inspect locally in demo mode: serve the dir and open `#local` (no backend; `window.__rw` test seam is live). `ci/logic-test.mjs` shows the harness.
- `CLAUDE.md` has the full project conventions (design language, gates, "don't" list).

---

## 8. NEW BACKLOG from Jac (2026-06-15 07:07) — 19 items, triaged

Jac walked the live app and reported these. Grouped by theme; **size** = rough effort/risk.
Several B-items are probably downstream of A1 (the "modes" removal) — investigate A1 first.

### A. Kill "modes" — search-bar only  *(size: L, architectural)*
- **A1** Footers still behave as persistent filters instead of the card's search filter. Remove *modes* across **every** card; all filtering goes exclusively through the search bar. Modes are "glitchy/clunky." This likely underlies B1/B2/B5.

### B. Interaction-layer bugs (right-click / drag / hover / comments)  *(size: M each)*
- **B1** Can't **right-click row names in list view** (context menu dead in list mode).
- **B2** **No hover preview on row names in list view** — want previews there.
- **B3** **No hover preview on badges/flags** in the Categories → **Investment** section.
- **B4** **Drag a pill from Categories → Investment onto a Rental doesn't drop.** Verified with **Shrek (Active)** — so it's NOT the §9 fleet-status gate. The investment-section pill drag→rental link path is broken. (Contrast: dragging from the Units list may work — compare the two drag sources.)
- **B5** **Right-click "back" navigation dies while the rental-window picker is open** (e.g., drill into 12k via the availability sort, or Units standard→list). Closing the picker restores right-click-back. Look at how the picker/`availWin` short-circuits the context-menu/back handler.
- **B6** **Comment marker (yellow dot) can't be opened** — e.g. Armando Garcia, in BOTH standard and list view. The marker renders but the open handler doesn't fire.
- **B7** The grayed **Complete-Rental** button (correctly inert when there's a customer but no unit + no invoice) **flashes the +PO and +notes pills** on click. Either that flash is the wrong signal (should point at the missing **unit/invoice**, not PO/notes) or it shouldn't flash at all. Clarify intent + fix.

### C. Search bar  *(size: S–M)*
- **C1** Add the **rulebook R24 close-all "X"** at the **start** of the search bar once **>1** entry has been added (mirror the existing R24 usage).
- **C2** **Can't add a 3rd search entry** — it caps at 2; the 3rd isn't logged. Find the filter-terms cap.

### D. Customer card  *(D1 size: S · D2 size: L)*
- **D1** **Reorder standard view:** move the activity graph to sit **below** the action row (log action / schedule / activity log) and **above the Account section**.
- **D2** **Make the activity graph interactive:** cursor-scrub so the graph follows the cursor and shows a tooltip with that day's/month's **revenue** AND **days rented**. Add a **second line = "days rented"** — total days the customer held equipment (a 7-day rental counts 7). Currently there's only one line and no day counter.

### E. Invoice card  *(E1 size: S · E2 size: M)*
- **E1** **Stack** the blue action buttons vertically instead of one row: customer pill, then **PO**, **Rental**, **Work Order**, **Custom**, and **Lock Price** underneath.
- **E2** Add a way to **log / change the invoice due date** (none exists today).

### F. Company files  *(F1 size: S · F2 size: M)*
- **F1** The Company Files board needs a **search bar**.
- **F2** **+File** currently only takes a name + URL link — add **photo/document upload** (cf. how capture/selfie/signature images are stored; files persist to the backend).

### G. Views  *(size: S)*
- **G1** No way to **remove a view** from the Views & sort menu. NOTE: a delete handler exists (`.js-delview`, app.js ~6226) but it's gated behind `adminUnlocked()`. If Jac isn't admin-unlocked the affordance never shows — decide whether to surface it for the operator or expose an admin-unlock path.

### H. Sessions  *(size: M)*
- **H1** **Share-session QR is broken** — it encodes `app.jacrentals.com/` with nothing after (the `qr` overlay encodes `location.href`, but there's no session id in the URL, and there's no session concept wired). Needs a real shareable session URL (mint/restore a session id) for cross-device handoff to work.

### I. Mr. Wrangler expansion  *(size: L, blocked)*
- **I1** Extend Mr. Wrangler into the **New Receipt** popup and the **Part/Task photo** popups, so when staff add a photo, Wrangler does the rest (read the receipt/part, fill the fields). **Blocked on the Wrangler backend (`Code.gs` + API key) being deployed** (see §1). Design the photo→Wrangler hook to reuse the §18 `backendCall('wrangler', …)` path with an image part.

**Suggested sequencing:** quick wins first (D1, E1, G1, C1/C2, F1, H1), then the interaction bugs (B6, B4, B5, B1/B2/B3, B7), then the big ones (A1 modes-removal, D2 interactive graph, E2 due date, F2 uploads, I1 Wrangler-in-popups — I1 after the backend lands).

---

## 9. BACKEND TODO — `uploadFile` handler for F2 (file uploads)

The **F2 frontend is live** (+File on the Company Files board now takes a photo/document).
On the live site it POSTs `{action:'uploadFile', name, mimeType, data}` to `BACKEND_URL`;
until `Code.gs` answers that action, an upload toasts *"Upload failed: backend not ready"*
(the demo/#local path keeps a downscaled image inline so the UI is reviewable). Add this
case to the `doPost` action switch in `Code.gs` (gitignored; paste-deploy like the rest):

```javascript
case 'uploadFile': {
  // body: { name, mimeType, data: "data:<mime>;base64,<...>" } → store in Drive, return a link
  const m = String(req.data || '').match(/^data:([^;]+);base64,(.*)$/);
  if (!m) { out = { ok: false, error: 'bad data url' }; break; }
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), req.mimeType || m[1], req.name || 'file');
  const folders = DriveApp.getFoldersByName('Rental Wrangler Files');
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('Rental Wrangler Files');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  out = { ok: true, url: file.getUrl(), fileId: file.getId() };
  break;
}
```

Frontend stores the returned `url` in `companyFiles.link` (+ `driveId`); "Open file" opens it.
Images are downscaled to ~1400px/0.72 before upload; non-images are sent as-is (12 MB cap).
The **local session has Drive write + Code.gs**, so it can deploy + test this end-to-end.

---

## 10. BACKEND TODO — `saveSession` / `getSession` for H1 (session sharing)

The **H1 frontend is live**. The Share-session QR (top bar) now stashes the operator's
open tabs in the backend and encodes `#s=<id>`; another device that opens that URL (and
signs in) restores the same open records. Until `Code.gs` answers these actions, the QR
falls back to the plain app URL (still useful — opens the app on the other device). Add
to the `doPost` action switch (a Script Property store is fine — sessions are ephemeral):

```javascript
case 'saveSession': {
  PropertiesService.getScriptProperties().setProperty('sess_' + req.sid, String(req.data || ''));
  out = { ok: true };
  break;
}
case 'getSession': {
  const d = PropertiesService.getScriptProperties().getProperty('sess_' + req.sid);
  out = d ? { ok: true, data: d } : { ok: false, error: 'not found' };
  break;
}
```

Frontend payload is `{ tabs:[{card,recId,recType}], activeIdx }`; restore re-opens each tab
via the existing `openInNewTab`. (Optional: prune old `sess_*` properties periodically.)
