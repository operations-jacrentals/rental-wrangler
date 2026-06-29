# HR / Compliance — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/hr-compliance`
**Task branch:** `hr-compliance/spec` (proposed)
**Maturity:** ⬜ Greenfield
**Scope:** A first-class **Employee** record plus a **credential/certification expiry engine** (CDL, DOT medical card, MVR, equipment-type certs, training) that turns "is this person legal to drive/operate today?" into a live, flag-colored signal the dispatcher and shop can see before they assign work.

---

## ✅ Decisions — 2026-06-29 critique (Jac) — ⚠️ MAJOR SCOPE TRIM

Jac trimmed this area hard. The **credential/compliance engine is dropped**; what remains is a lightweight **Employee roster in Settings** that serves as the identity hook for multi-driver dispatch + the Driving-Score KPI. The draft below over-builds; treat these decisions as authoritative and the credential/expiry/eligibility sections as **superseded**.

- **D1 · Drop credential & compliance tracking (resolves Q1/Q2/Q3 → "Drop This").** No CDL / DOT-medical-card / MVR / equipment-cert numbers, **no expiry-aging engine**, no hazard-stripe expiry banner, and **no dispatch eligibility block/warn**. The "Compliance" half of the area is removed for now. (This deletes draft §4.2 credentials, §4.3 training, §6.3 expiry banner, §7.1–7.3 aging/eligibility, and the credential-PII gate machinery.)
- **D2 · Employee roster lives in SETTINGS (resolves Q5 → "Settings").** Manage the employee list **in Settings** (alongside Roles & Logins) — **not** a back-office board and **not** a grid card. No `WINDOW_CATALOG` board entry; it's a Settings pane.
- **D3 · Area re-aims to a lightweight Employee roster — the identity hook.** What remains: a simple roster (name, job title/`roleLabel`, status, `assignableAs` lanes e.g. driver/mechanic) that provides the **driver/employee identity** for: (a) the **multi-driver dispatch assignment** (`rentals-dispatch` D4/D6 — per-stop `driverId`), and (b) the **per-driver Driving Score** (`gps-tracking` D1, the `null` KPI ring). Still an additive `employees` entity (the §4.1 sync wiring stays), seeded with fake names, with `assignedEmployeeId` linkable to units/WOs. **No credential PII, no compliance, no expiry.**

**Net effect:** "HR / Compliance" becomes essentially **"Employees"** — a small enabler for multi-driver + KPI identity, not a compliance system. The credential/compliance idea can return later as its own area if Jac revives it. The spec body's credential/aging/eligibility sections are retained only as a record of the dropped scope.

---

## 1. Goal & Problem

### The business problem
JacRentals dispatches operators and drivers to haul and run heavy equipment around Sulphur, LA. Several of those jobs carry **legal credential requirements**: a driver hauling a loaded lowboy across state lines needs a current **CDL** and a non-expired **DOT medical card**; an MVR (motor-vehicle record) check has a review cadence for insurance; some equipment classes (aerial lifts, excavators) have **operator certifications** with renewal dates. Today **none of this is tracked in the app at all.** The only place an employee name appears is the free-text `assignedMechanic` string on units and work orders (`app.js:5022`, `data.js:36`). There is no roster, no credential, no expiry, no "this person can't legally take this run" guard.

The north-star outcome: **a dispatcher can never unknowingly send an operator out with an expired credential**, and an admin can see at a glance who is coming due so they renew *before* a card lapses (and before insurance/DOT exposure). This is a compliance-risk problem first (a lapsed med card on an interstate haul is a real liability), and an operations-readiness problem second (the same "Action Required / Action Needed / All Clear" mental model the rest of the app already uses).

### Why it matters / why now
- **GPS / Driving Score** (`gps-tracking`) and the Driver KPI ring's third value are already a `null` placeholder pending a per-driver identity to attach a score to (`app.js:7123`). An Employee entity is the missing hook.
- The **role-system redesign** (2026-06-26) already split *login roles* from *people* — a login is a shared password+tier, **not** a person. So there is deliberately no "who is signed in as a human" concept yet. HR fills that gap.
- This is a **Want / greenfield** area (priority #16, Want tier). It is *not* load-bearing for daily operations, so v1 should be a tight, additive, low-risk slice — a roster + credential-expiry tracker — not a full HRIS (payroll, PTO, scheduling, benefits are explicitly out).

### North star
> Every person who can be assigned work has a record; every legal credential that person holds has an expiry; and the app flashes **red before that expiry bites**, using the exact yard data-plate language (hazard stripe, stamped labels, R/Y/G) the rest of the app already speaks.

---

## 2. Current State (Baseline)

**Nothing for HR exists.** This is greenfield. What follows is the adjacent code an HR build must sit *on top of*, with anchors verified against the live tree on 2026-06-28.

| Concern | State | Anchor |
|---|---|---|
| Employee entity | ❌ Missing — no `employees` array, no `employeeId`, not in `PERSIST_KEYS` | `app.js:15638` |
| "Who works here" data | 🟡 Free-text only — `assignedMechanic` is a plain string on units (`data.js:36`) and WOs; the unit field-editor offers it as a sfx-tagged text input | `app.js:5022`, `app.js:6331`, `app.js:10322` |
| Login *roles* (≠ people) | ✅ Shipped — `{ RoleName: password }` map + tier ladder; a login is a **shared credential**, not an individual | `config.js:302/326`, role-redesign spec |
| Permission tiers | ✅ Shipped — `ROLE_TIERS` (staff < money < manager < admin < developer), `tierRank()` | `config.js:326–337` |
| KPI roles | ✅ Shipped — 5 operational roles (mechanic, mtech, driver, office, sales) | `config.js:302` |
| Driver "Driving Score" | 🟡 `null` placeholder — KPI ring's 3rd value, "needs GPS backend" | `app.js:7123` |
| Mechanic assignment | 🟡 `assignedMechanic` aggregated into the Shop roster graph (`app.js:8364`) and WO author flag (`app.js:5463`) — but keyed by *string name*, not an id | `app.js:8364`, `app.js:5463` |
| Credentials / certs / training | ❌ Missing entirely | — |
| Expiry / aging engine for people | ❌ Missing (the aging machinery exists only for invoices and service countdowns) | `service-countdown.js`, `app.js:1602` |

**The two seams HR must respect:**
1. `assignedMechanic` is a **string** everywhere. HR introduces an Employee record with an id; the migration question (link by id vs keep the string and denormalize) is an Open Question (§11), not silently decided.
2. The flag-color system (`docs/specs/flag-color-system.md`) is the house pattern for "what do I need to do with this record." A new Employee entity should slot into `getEntityFlags` / `getEntityColor` rather than invent a parallel coloring scheme.

---

## 3. Users, Roles & Data Gates

### Who touches this
HR data is **sensitive PII** (names, license numbers, medical-card status, MVR results). The repo is public via Pages, so **no real employee PII ever enters `data.js` seeds or the repo** — the seed roster uses obviously-fake names (the same hygiene as the customer seed, `data.js:21` `mock:true`).

All 15 configurable roles map to one of the 5 **tiers** (`ROLE_TIERS`, `config.js:326`); HR gates compare **tiers**, never role *names* (the role-redesign canon — a name-matched check would break the moment an admin renames a role in Settings → Roles & Logins). `tierRank(currentTier)` is the single comparison key, exactly as pricing-floor / money-action gates already work.

| Tier (rank) | Can see roster | Can see credential **numbers** (CDL #, med-card #) | Can add/edit employee | Can edit credentials | Notes |
|---|---|---|---|---|---|
| `staff` (1) | ✅ names + **readiness color only** | ❌ never | ❌ | ❌ | A mechanic/driver sees *who* is assignable and whether they're clear — not anyone's license number, expiry date, or doc scan |
| `money` (2) | ✅ | ❌ | ❌ | ❌ | Same as staff for HR (money tier is about *pricing*, not *people* — it adds no HR power) |
| `manager` (3) | ✅ | 🟡 **see** masked (last-4 only) | ✅ | ✅ | Front-line who manages the crew |
| `admin` (4) | ✅ | ✅ full (only if full numbers are stored at all — see §5.2 / Open Q 1) | ✅ | ✅ | |
| `developer` (5) | ✅ | ✅ full | ✅ | ✅ | |

**Where the gate is enforced — and the hard rule.** All three of these surfaces gate on `tierRank`:
1. **Roster visibility** — the Crew board entry is absent from the Tools tray below the roster-floor tier (Open Q 2 sets the floor; conservative proposal = **staff+ may see readiness**, since a driver legitimately needs to know who's assignable).
2. **Credential numbers** — the gate is enforced **at render time, by omission from the DOM**, not by CSS. A `staff`/`money` session's HTML **must never contain** the last-4 or full number string — not hidden, not `display:none`, not a `data-*` attribute, not in a hover-preview payload. (The repo is public via Pages and the rendered DOM is inspectable; "visually hidden" is not a security boundary.) Acceptance §9.3 tests the DOM, not the pixels.
3. **Write actions (add/edit employee, add/edit/verify credential)** — gated `manager+`. The ignition (orange) save buttons are absent below that tier; the Add/Edit forms never render. This mirrors the **money-action gate** pattern (Office/Admin-only payment actions): a sensitive *write* is gated by tier at the action surface, conservatively.

**Gate decisions surfaced as Open Questions (§11), not silently set:** the exact tier floors — roster-view (proposed staff+), edit (proposed manager+), full-number view (proposed admin+, manager last-4) — are a **conservative proposal**; Jac confirms in §11 Q2. The rule when uncertain: **hide, don't show.** No HR field is ever rendered "open by default."

**No money / pricing-floor interaction.** HR touches **no** `bottomDollar`, margin, rate, or invoice data; the pricing-floor visibility gate and the money-action (payment) gate are **untouched** — HR neither reads nor weakens them. The *only* gate this area *adds* is the new credential-PII visibility gate above. (Explicitly noted so a reviewer can confirm HR introduces no new money surface to leak.)

**PII handling (this is the high-risk axis here).** HR data is **sensitive employee PII** — names, license/medical-card numbers, MVR results, medical-card *status*. Hard rules:
- **No real employee PII in the repo, ever.** `data.js` seeds use obviously-fake demo names with `mock:true`, identical hygiene to the customer seed (`data.js` `mock:true` rows). The repo is world-readable via Pages.
- **Number minimization at rest** — see §5.2: the synced record holds **`numberLast4` only** by default; full numbers (if ever needed) live as a Drive-offloaded scan, never a plaintext Sheet cell.
- **Audit trail on credential edits** — `verifiedBy` / `verifiedDate` stamp who last touched a credential (the *login tier/role-key*, not a guessed person), so a compliance edit is attributable. This is record-keeping, not a security control, but it deters silent tampering.

**Customer isolation:** N/A for the *internal* app — employees are not customers, so there is no cross-customer row-leak surface here. **But** HR data is exactly the kind of record that must be **hard-excluded** from the future customer self-service portal (`mobile-remote`, a separate row-isolated build): a customer must never see any `employees` row, credential, or readiness signal. This is a build-time exclusion (the portal whitelists customer-owned entities; `employees` is never on that list) and is tracked as Open Q 11 + a §12 dependency.

---

## 4. Data Model

### 4.1 New entity: `employees`
A new top-level array, the **12th** entity in the sync layer. Three one-line additive edits wire it into the existing diff-sync (`app.js:15638/15687/15711`), with **no change to any of the 11 existing entities**:

```js
// app.js:15638 — add the key (12th)
const PERSIST_KEYS = [ /* …11… */ , 'expenses', 'employees' ];
// app.js:15687 — declare its id field (used by computeChanges / refreshFromBackend)
const PERSIST_ID  = { /* … */ , expenses: 'expenseId', employees: 'employeeId' };
// app.js:15711 — its IDX short-key (the in-memory id→record index)
const IDX_MAP     = { /* … */ , expenses: 'expense',  employees: 'employee' };
```

Once those three lines land, `load` hydrates `employees`, `computeChanges` diffs it, and `refreshFromBackend` adopts other users' employee edits **for free** — the same machinery every other entity rides (verified at `app.js:15663–15749`). Schema-less Sheets means this is **purely additive**: a new tab `employees`, one row per record, no migration or reshape of existing tabs.

```js
// data.js — new section (fake demo names only, mock:true)
m({
  employeeId: 'E001',
  name: 'Cameron Hebert',          // display name
  status: 'Active',                // Active | On Leave | Inactive  (employment status)
  roleLabel: 'Mechanic',           // free-text job title (NOT a login role/tier — see §4.4)
  phone: '(337) 555-0100',
  hireDate: '2022-03-14',
  assignableAs: ['mechanic','driver'],   // which KPI-role lanes this person can fill (informational)
  credentials: [ /* see 4.2 */ ],
  trainingLog: [ /* see 4.3 */ ],
  notes: '',
})
```

### 4.2 Credential sub-records (`employee.credentials[]`)
Each credential is a typed expiry-bearing object. **Numbers are PII** (gated, §3).

```js
{
  id: 'CR-001',
  type: 'CDL',                     // see CREDENTIAL_TYPES below
  numberLast4: '4821',            // ONLY the last-4 ever enters the synced record (see §5.2/§10/§11)
  issuedDate: '2023-05-01',
  expiryDate: '2027-05-01',       // the value the engine ages against (date-only ISO, no time)
  issuingBody: 'Louisiana OMV',
  restrictions: '',               // e.g. CDL class + endorsements/restrictions text
  docUrl: '',                     // Drive-offloaded scan via uploadCapture → driveViewUrl (optional)
  verifiedBy: '',                 // login tier/role-key that last verified — audit trail (§3)
  verifiedDate: '',               // date-only ISO
}
```

**`numberLast4` derivation — never derive on the server.** The full number is **never** persisted. When a manager enters a number in the Add/Edit Credential form, the **client** truncates to the last 4 digits *before* the record enters `DATA.employees` (and therefore before `computeChanges` can sync it). The full string lives only in the transient input field and is discarded on submit. This guarantees the full number is never in `lastSaved`, never in a `sync` payload, never in a Sheet cell. (If full numbers are ever required for a DOT audit — Open Q 1 — they ride the Drive-scan path, §5.2, not a Sheet column.)

Proposed `CREDENTIAL_TYPES` (in `config.js`, alongside `ROLES`):

| type id | Label | Has expiry? | Renewal cadence (default warn) | Notes |
|---|---|---|---|---|
| `CDL` | Commercial Driver's License | ✅ | 60 days | class + endorsements in `restrictions` |
| `MEDCARD` | DOT Medical Card | ✅ | 60 days | the high-risk one for hauls |
| `MVR` | MVR Review | ✅ (review-due, not "expires") | 30 days | a *review cadence*, set by insurance |
| `CERT-AERIAL` | Aerial Lift Cert | ✅ | 45 days | maps to equipment categories |
| `CERT-EARTH` | Earthmoving / Excavator Cert | ✅ | 45 days | |
| `DRUG` | Drug/Alcohol Clearinghouse | ✅ | 30 days | optional in v1 |

Cadences are **defaults in `config.js`**; an admin-editable override is a later phase (mirrors how the flag catalog parked its Settings UI, flag-color-system §8).

### 4.3 Training log (`employee.trainingLog[]`)
Append-only, low-ceremony:
```js
{ id:'TR-001', when:'2026-04-02', topic:'Lowboy securement refresher', by:'Manager', docUrl:'' }
```
Training entries have **no expiry by default** (informational), but a topic *may* reference a credential type to satisfy a recurring requirement — deferred to a later phase (§8).

### 4.4 Relationships (by id)
- **Employee ↔ login role:** **decoupled.** `roleLabel` is a job title string; it is *not* a `ROLE_TIERS` tier and grants no permission. Logins remain shared-password+tier (role-redesign canon). An optional `linkedLogin` field (the role-key string a person usually signs in as) is an Open Question (§11) — useful for "who did this" but risks conflating people with shared logins.
- **Employee ↔ unit/WO (`assignedMechanic`):** today a string. Proposed: keep the string for display but add an optional `assignedEmployeeId` alongside, so existing data never breaks and HR readiness can resolve by id. Migration approach is an Open Question (§11).
- **Employee ↔ credential ↔ equipment category:** `CERT-AERIAL`/`CERT-EARTH` map to `category` ids (e.g. CAT004 scissor lift ↔ aerial). This lets a future dispatch guard ask "is the assigned operator certified for *this unit's category*?" Mapping table lives in `config.js`; v1 may ship the mapping but not yet the hard dispatch block (§8).

### 4.5 Migration concerns
- **Additive only.** New `employees` tab, new `employeeId` in `PERSIST_ID`/`IDX_MAP`/`IDX_MAP` reverse index (`app.js:15687`, `15711`) — no change to any existing entity's shape is *required* for v1.
- `assignedMechanic` strings stay valid. A one-time, opt-in admin tool ("Round up crew from work orders", mirroring `#migrate-units` at `app.js:8481`) can seed Employee rows from the distinct `assignedMechanic` names already in the data. This is a *proposed* helper, not required.
- Adding `employees` to `PERSIST_KEYS` means the diff-sync (`computeChanges`, `app.js:15693`) and live refresh (`refreshFromBackend`, `app.js:15713`) pick it up for free — **provided** the backend Sheet has the tab (an additive backend deploy, §5).

---

## 5. Backend / Integration Contract

### 5.1 The cheap path — ride the existing sync (preferred for v1)
Because persistence is **diff-based over `PERSIST_KEYS`**, adding `employees` as the 12th key means **no new GAS action is strictly required** for CRUD: `load` hydrates it, `sync` upserts/deletes it, exactly like the other 11 entities. The only backend change is **additive**: the `Code.gs` `load`/`sync`/`seed` handlers must know about an `employees` tab (a one-line tab-name addition to whatever tab list the backend iterates). This is an **additive deploy via `/clasp`** — no rewrite of `auth`/`getConfig`.

> **Contract note (cannot read `Code.gs`):** the spec assumes `load`/`sync`/`seed` iterate a server-side tab list. If they hardcode the 11 tabs, the additive change is "add `employees` to that list." Confirm against the live backend before building (Drive connector / clasp), and treat the exact mechanism as a build-time detail, not a frontend assumption.

### 5.2 PII at rest — the real backend decision
Storing full CDL / medical-card numbers in the Sheet DB (which holds real customer PII already, CODE-MAP `⚠️ PII guard`) raises the sensitivity bar. **Proposed conservative default:** the synced record stores only **`numberLast4`** + expiry + issuing body; the full number, if ever needed, is captured as a **Drive-offloaded scan** (`uploadCapture` → `docUrl`, the same media-offload path the agreements/selfies use, CODE-MAP "Files & media") and never lives in a Sheet cell as plain text. Whether full numbers are needed at all is an Open Question (§11).

### 5.3 Proposed *additive* GAS actions (only if §5.1's free-ride is insufficient)
Only introduce these if Jac wants employee writes gated server-side beyond the shared team password:

Every action posts through the single `backendCall(action, extra)` entry point (`app.js:15650`): JSON body `{ action, password, …extra }`, `text/plain` content-type (avoids the GAS CORS preflight), and **always** resolves to `{ ok, … }` or `{ ok:false, error }` — never throws (the defensive contract at `app.js:15658–15661`).

| Action | Payload (`extra`) | Returns | Why |
|---|---|---|---|
| `hrUpsertEmployee` | `{ employee: {…employeeId, name, status, credentials:[…last4-only…], … } }` | `{ ok:true, employeeId }` / `{ ok:false, error }` | server re-checks the caller's tier (from the shared password's mapped role) before a write touches the HR tab — a hard server gate, not just the client gate |
| `hrVerifyCredential` | `{ employeeId, credId, verifiedBy, verifiedDate }` | `{ ok:true }` / `{ ok:false, error }` | stamps the audit trail **server-side** so it can't be back-dated/spoofed by a tampered client |

**Payload guarantee (both actions):** the `credentials[]` array in any payload carries **`numberLast4` only** — the full number is truncated client-side (§4.2) so it physically cannot reach the wire even via these explicit actions. A server-side assert that rejects any credential field looking like a full license/med-card number (length/shape check) is a cheap belt-and-suspenders guard worth specifying if these actions ship.

**Default recommendation:** *don't* add these for v1 — the existing `sync` path + the client-side tier gate is consistent with how every other entity persists, and a parallel server gate is gold-plating *unless* Jac wants a hard server-side PII enforcement that a tampered client can't bypass. Because the shared-team-password model means the backend can't strongly distinguish a `staff` from an `admin` caller without `settings.roleMeta`, a true server gate has limited extra strength here — surface this nuance as **Open Q 8**, recommendation: ride `sync`.

### 5.4 External integrations
- **None required for v1.** No MVR-pull API, no DOT verification service, no payroll system. All credential data is **hand-entered** by a manager/admin.
- **Future seams (out of v1):** an MVR-monitoring vendor webhook (auto-update `MVR` review-due), a DOT Clearinghouse query — both would be additive GAS actions later. Telematics/Driving-Score (`gps-tracking`) attaches a per-driver score once Employee ids exist; that's the `gps-tracking` area's job, HR just provides the id.

### 5.5 Failure handling
Reuses `backendCall`'s defensive contract (`app.js:15650–15661`): a GAS error page (500/quota/auth HTML) is **not** JSON, so the parser coerces it to `{ ok:false, error:'http-NNN' | 'bad-json' }` rather than throwing — callers always get a mappable result. HR-specific failure behavior:

| Failure | Behavior |
|---|---|
| `sync` upsert of an employee fails (network/quota) | Record stays in `DATA.employees` locally and `lastSaved` is **not** advanced for it, so the next `saveSoon` flush retries it automatically — identical to a failed unit/customer save. No data loss, no toast spam. |
| `load` returns no `employees` array (backend tab not deployed yet) | The Crew board renders **empty**, not broken — `refreshFromBackend` guards `if (!Array.isArray(data[k])) return`. This is the §10 "backend tab missing" risk; the prerequisite §5.1 `/clasp` deploy must precede the frontend ship. |
| `hrUpsertEmployee`/`hrVerifyCredential` (if added) return `{ok:false}` | The form surfaces a stamped inline error ("Couldn't save — try again"), keeps the unsaved draft, and does **not** clear the input. No silent success. |
| A scan upload (`uploadCapture`) for a credential doc fails | Drive offload throttles at 3-concurrent (`frontend-performance`); a failed upload leaves `docUrl:''` and the credential still saves (the scan is optional). |

No new *class* of failure surface — HR reuses the existing sync/upload error paths verbatim.

---

## 6. UX / UI

All UI in the **yard data-plate** language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), corner rivets, **Saira Condensed** stamped uppercase labels, the **single safety-orange `#ff7a1a`** accent reserved for primary/ignition actions only, R/Y/G for status, hi-vis **hazard stripe** for the danger/expiry-imminent banner, and a **light ranch seasoning in copy** ("Crew", "Round up the crew", "Hand", "Tack" used naturally — never campy, never a western skin). Every new visible element needs a `data-r` stamp; every new popup needs a `WINDOW_CATALOG` entry (`app.js:9796`).

### 6.1 The "Crew" board (entry point)
HR lives as a **back-office board**, the same class as Parts / Vendors / Expenses / Company Files (`config.js:371` `BACKOFFICE_BOARDS`). Proposed new entry:
```js
{ id: 'crew', title: 'Crew' }   // ranch-flavored label for the Employees board
```
- Reachable from the Tools tray, gated to the roster-visible tiers (§3).
- Renders through the existing `board` popup machinery (`WINDOW_CATALOG` kind `board`, `app.js:9811`) so it inherits search/sort/windowing for free — **no new popup kind needed for the board itself.**
- **Row layout** (mirrors the list-row redesign, `2026-06-23-list-row-redesign-design.md`): stamped name (Saira), a **readiness pill** (R/Y/G computed, §7), and a compact "next due" chip (e.g. `MED CARD · 41d`). Credential numbers never appear in a row.

### 6.2 Employee detail popup — **NEW window** `kind: 'employee'`
A new popup → **requires a `WINDOW_CATALOG` entry** (CI gate `ci/check-window-catalog.mjs` fails otherwise) and `data-r` stamps on its sections.
```js
{ kind:'employee', label:'Crew member', tag:'Crew · profile', sample:()=>({ employeeId:((DATA.employees||[])[0]||{}).employeeId }) }
```
Sections (each a riveted steel panel with a stamped header):
1. **Identity plate** — name, job title, employment status pill, hire date. A small **brand/star** marker (the rare ranch cue) may stamp the active employee.
2. **Credentials** — one row per credential: type label, **expiry date + a countdown chip** colored R/Y/G by §7. Credential *numbers* render **masked** (•••• last-4) and only for the gated tier (§3); below the gate they're absent, not redacted-with-asterisks-revealable. An **Add / Edit Credential** sub-popup (a small form, ranch copy "Add tack") — also a new `WINDOW_CATALOG` kind `credentialform`.
3. **Training log** — append-only list, newest first.
4. **Assignments** (read-only) — units/WOs whose `assignedMechanic`/`assignedEmployeeId` resolve to this person (derived, not stored).

### 6.3 The expiry banner — the signature moment
When a credential is **past-due or imminent**, the detail header wears the **hazard stripe** (`repeating-linear-gradient(135deg, var(--yellow) 0 13px, #14181d 13px 26px)`; **red variant** for already-expired). Stamped copy: `MED CARD EXPIRED` / `CDL DUE IN 12 DAYS`. This is the one place to **spend boldness** (jactec-ui "spend boldness in ONE place").

### 6.4 Flag integration (no new color system)
Employees join the **existing** flag-color engine — `getEntityFlags(entityType, rec)` (`app.js:4000`) and `getEntityColor` (`app.js:4017`) — by adding an `employees` branch, **not** a parallel coloring scheme. Inherited rules from the flag-color spec: **highest-severity flag wins** the pill color; the hover preview stacks all active flags severity-desc; **orange `#ff7a1a` is reserved for brand/ignition chrome and is NEVER a status color** (status is only R/Y/G/gray); **gray is a terminal class** (archived/inactive), evaluated *before* R/Y/G and short-circuiting it. Proposed `employees` flags:

| id | Label | Sev | Condition |
|---|---|---|---|
| `cred-expired` | Credential Expired | 🔴 | any credential `expiryDate < today` |
| `cred-imminent` | Credential Due | 🟡 | any credential within its type's warn window (default 30–60d) |
| `no-credentials` | No Credentials | 🟡 | an employee `assignableAs` a driver with zero `CDL`/`MEDCARD` on file |
| (Active/clear) | — | 🟢 | nothing due |
| `inactive` | — | ⚪ gray | `status === 'Inactive'` (archived; flags don't evaluate) |

### 6.5 States
- **Empty:** "No crew yet — round up your hands." with an **Add Crew Member** ignition button (orange) + an optional "Round up from work orders" link (the §4.5 migration helper).
- **Loading:** standard skeleton (shared with other boards).
- **Error:** standard board error; a failed save is silent-retry (§5.5).

### 6.6 Mobile reflow
Inherits the board → bottom-sheet reflow (`mobile-remote`, `2026-06-14-mobile-adaptive-design.md`): the Crew board and Employee popup become full-height bottom sheets at the 1-col breakpoint; touch-target floors and safe-area insets apply. Countdown chips stay legible (the readiness pill is the priority element at narrow width).

### 6.7 New windows / R-stamp summary (CI impact)
| New surface | data-r needed | WINDOW_CATALOG entry |
|---|---|---|
| Crew board | yes (reuses board chrome rules) | rides existing `board` kind (no new entry) — **confirm** |
| Employee detail | yes | **new** `employee` |
| Add/Edit Credential | yes | **new** `credentialform` |
| Add/Edit Employee form | yes | **new** `employeeform` (or reuse a generic create overlay) — Open Q |

---

## 7. Business Rules / Derivations / Money

**No money in this area.** No pricing, tax, margin, or invoice math. The only derivations are **date aging**, computed live (never stored — "one fact, one place", data.js §2 doctrine).

### 7.1 Credential aging (the core formula)
For a credential with `expiryDate`:
```
daysLeft = floor( (parseISO(expiryDate) - TODAY) / 86_400_000 )   // TODAY per app.js global
warn     = CREDENTIAL_TYPES[type].warnDays                         // default per §4.2
state =
  daysLeft < 0            → 'expired'   (🔴)
  daysLeft <= warn        → 'due'       (🟡)
  else                    → 'clear'     (🟢)
```
- Mirror the existing aging precedent: invoice aging tiers (`app.js:1602`) and the service countdown (`service-countdown.js`) already age by date/hours — reuse `parseISO` and the `TODAY`/`TODAY_ISO` globals, don't reinvent date math.
- **MVR** is a *review cadence* not a hard expiry, but the same formula applies against `expiryDate` (= next-review-due date). Labeling differs ("review due" vs "expires") — copy only.

### 7.2 Employee readiness (rollup)
`employeeColor(emp) = highest-severity credential state` (red > yellow > green), short-circuiting to **gray** if `status==='Inactive'`. This is exactly `getEntityColor`'s contract (flag-color-system §4.3) — implement as an `employees` entry in the flag engine, not a bespoke function.

### 7.3 Dispatch eligibility (signal, not block — v1)
`canDriverHaul(emp)` = has a non-expired `CDL` **and** non-expired `MEDCARD`. In v1 this **surfaces** as the readiness color + a dispatch-side warning chip; it does **not** hard-block assignment (Open Question §11: signal vs hard gate). Edge cases:
- Employee with no credentials at all → `no-credentials` yellow (not green) so they're never silently "clear."
- A credential expiring *during* a multi-day rental window → flag against the **window end**, not just today (matches how rental flags consider the window, flag-color-system §7.1). v1 may simplify to today-only and note the gap.

### 7.4 Edge cases
- Multiple credentials of the same type (renewed early, old one lingering) → age against the **latest** `expiryDate`.
- Missing `expiryDate` (a non-expiring training entry mis-typed as a credential) → treated as `clear`, never `expired` (don't flash red on bad data).
- Timezone: all dates are date-only ISO strings (no time component) — consistent with every other date field in the app; no TZ math.

---

## 8. Phasing & Milestones

### Phase 1 — MVP (this spec's target)
**In scope:**
- `employees` entity in `data.js` (fake seed) + `PERSIST_KEYS`/`PERSIST_ID`/`IDX_MAP`.
- Additive backend tab (`employees`) deployed via `/clasp`.
- The **Crew board** (list, search, readiness pill).
- The **Employee detail** popup (identity, credentials w/ countdown, training log, derived assignments).
- **Add/Edit Employee** + **Add/Edit Credential** forms.
- Credential **aging engine** + **flag-catalog** integration (R/Y/G readiness).
- The **expiry hazard-stripe banner**.
- Tier-gated PII (credential numbers masked/hidden per §3).

**Out of scope (v1):**
- Payroll, PTO, time-clock, benefits, scheduling, shift rosters.
- MVR/DOT/Clearinghouse API integrations (hand-entry only).
- Hard **dispatch block** on expired credentials (v1 warns; blocking is Phase 2).
- Admin-editable warn-window cadences (defaults hardcoded in `config.js`, like flag-color §8).
- Linking `assignedMechanic` strings to ids automatically (the migration helper is optional; auto-link is Phase 2).
- Per-driver Driving Score wiring (belongs to `gps-tracking`).

### Phase 2 — Compliance enforcement
- Hard dispatch eligibility gate (block assigning an interstate haul to an expired-med-card driver), surfaced at the dispatch cockpit (`rentals-dispatch`).
- `assignedEmployeeId` backfill + the unit/WO editors pick from the roster instead of free text.
- Admin Settings pane for warn windows + credential-type catalog (the parked Settings UI).
- Equipment-category cert matching at assignment time.

### Phase 3 — Integrations & people-ops
- MVR-monitoring vendor webhook; DOT Clearinghouse.
- Per-driver Driving Score (joint with `gps-tracking`).
- Document-vault scans, audit/export for insurance.

---

## 9. Acceptance Criteria

Concrete + testable. CI gates that **must** stay green (run with port 8000→9147 per CLAUDE.md): `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check` (the HR engine's new `APP-xx` chapter banner trips the Code-Atlas drift guard — regenerate with `node tools/gen-code-map.mjs`).

**Behavior / aging (logic-test territory):**
1. A seeded fake employee with a CDL expiring in 12 days renders a **yellow** readiness pill on the Crew board and a yellow countdown chip `CDL · 12d`. *(aging formula §7.1)*
2. A seeded employee with a med card dated yesterday renders **red**, and the detail header wears the **red hazard stripe** with `MED CARD EXPIRED`. *(expired branch §7.1)*
8. An employee with `status:'Inactive'` renders **gray** and runs **no** flag evaluation (terminal class, §6.4). 
9. A credential with no/unparseable `expiryDate` never renders red — falls to `clear`, never `expired` (bad-data safety, §7.4). A `logic-test` case should assert this explicitly so a future refactor can't regress it to a false red.
12. `employeeColor(emp)` returns the highest-severity credential state (red > yellow > green), and an `assignableAs:['driver']` employee with zero CDL/MEDCARD returns **yellow `no-credentials`**, never green. *(rollup §7.2/§7.3)*

**Data gates (the security-critical ones — these are the must-not-regress tests):**
3. A `staff`-tier session sees the roster + readiness colors but **no credential numbers anywhere** — assert the **serialized DOM string contains neither the last-4 nor full number** (not merely `display:none`); also absent from any `data-*` attr and any hover-preview payload (§3).
4. A `manager` session sees masked last-4 (`•••• 4821`); an `admin` session sees full numbers *only if* full numbers are stored at all (§5.2 / Open Q 1). Below `manager`, the Add/Edit forms and ignition save buttons do not render (write gate §3).
13. No HR field surfaces in any customer-facing render path (guards the future `mobile-remote` portal exclusion, Open Q 11).

**CI-gate-specific (these directly make a named gate pass/fail):**
5. Adding an employee in one session and waiting one poll cycle shows the new record in another open session — proves the diff-sync free-ride (`refreshFromBackend`, `app.js:15713`). *(exercises `smoke.mjs` load/render path; no logic-test math)*
6. The new `employee` **and** `credentialform` (and `employeeform` if chosen) popups appear in `WINDOW_CATALOG` (`app.js:9796`) and render an inert preview in the admin Rulebook → **`ci/check-window-catalog.mjs` passes** (it fails CI if a `renderOverlay` kind is missing a catalog entry).
7. Every new visible element carries a unique `data-r="Rxx"` stamp and `rule-usage.js` is regenerated → **`ci/gen-rule-usage.mjs --check` passes** (no drift, no duplicate-rule collision).
14. The HR engine chapter banner is registered → **`tools/gen-code-map.mjs --check` passes** (regenerate the map after adding the banner).

**UX quality floor:**
10. Mobile (1-col): the Crew board opens as a full-height bottom sheet, the readiness pill stays the priority element and legible, touch targets ≥ the floor.
11. `prefers-reduced-motion` respected on the hazard-stripe banner (no animation; the stripe is static under reduced-motion — jactec-ui quality floor).

---

## 10. Risks & Edge Cases

| Risk | Severity | Mitigation |
|---|---|---|
| **PII leak via public Pages** — real CDL/med-card numbers in a Sheet that backs a public SPA | 🔴 High | §5.2: store last-4 only by default; full scans go to Drive (`uploadCapture`), never a Sheet cell; tier-gate the number in the DOM (absent, not CSS-hidden); **never** seed real names/numbers in `data.js` |
| Conflating people with shared logins | 🟡 Med | `roleLabel` is a title, not a tier; logins stay shared-password (role-redesign canon); `linkedLogin` deferred as Open Q |
| `assignedMechanic` string ↔ employee id drift (renames, typos) | 🟡 Med | keep the string for display; add optional id alongside; no hard auto-link in v1 |
| Backend tab missing → `load` returns no `employees` and the board is empty | 🟡 Med | additive `/clasp` deploy of the `employees` tab is a **prerequisite**; verify before frontend ships (§5.1 contract note) |
| False "clear" on bad date data | 🟡 Med | missing/unparseable `expiryDate` → `clear`, never `expired` (§7.4) — but log/surface so it's not invisible |
| Stale credential after expiry but person still legally assignable elsewhere | 🟢 Low (v1) | v1 only **signals**; no hard block, so a false-positive can't strand a dispatch |
| Multi-user edit collision on the same employee | 🟢 Low | inherits the diff-sync clean/dirty rule (`refreshFromBackend`, `app.js:15732`): a record the local user hasn't touched adopts the remote version; a dirty local edit is kept and pushed on next flush. **Last-writer-wins per record** — same as every entity. Two managers editing *different credentials of the same employee* simultaneously is the one genuine collision: because the unit of sync is the whole `employee` record, the later flush clobbers the earlier credential edit. v1 accepts this (low frequency); note it. |
| Offline / mid-edit refresh | 🟢 Low | `refreshFromBackend` already bails while typing (`activeElement` is INPUT/TEXTAREA) and while an overlay/drag is active (`app.js:15714–15717`), so a manager mid-credential-entry is never yanked. Offline edits queue in `DATA` and flush on reconnect via `saveSoon` — no HR-specific offline handling needed. |
| Performance — roster + per-credential aging on every render | 🟢 Low | Aging is O(employees × credentials) cheap date math; the crew is dozens of people, not thousands. Reuses the 60-row list windowing (`VIRT_CAP`) and the 100ms render budget (`frontend-performance`) for free. No new perf surface; if the roster ever balloons, windowing already caps it. |
| Credential-doc scan bloats the Sheet / sync payload | 🟡 Med | Scans go to **Drive** (`uploadCapture` → `docUrl`), never a Sheet cell — the record stores only a Drive URL, keeping the diff payload small (the agreements/selfies precedent). Never inline base64 into `DATA`. |
| Scope creep into full HRIS | 🟡 Med | §8 hard out-of-scope list; v1 is a credential tracker, not payroll/PTO/scheduling |

---

## 11. Open Questions

> Seed questions: none were captured in the code-grounding map for this greenfield area, so all of the below were generated from the code + gates.

1. **Credential-number storage.** Store **only last-4** in the synced Sheet (full number, if ever needed, as a Drive scan)? Or is no full number needed at all (last-4 + expiry suffices for an internal readiness tracker)? *Trade-off:* full numbers = real DOT-audit value but a serious PII liability on a public-Pages-backed Sheet; last-4-only = safe, slightly less useful for an official audit. **Recommendation: last-4 only for v1.**
2. **Edit/view gate tiers.** Confirm the §3 ladder: edit employees at **manager+**, see full credential numbers at **admin+**, manager sees last-4, staff/money see readiness color only? *Trade-off:* looser = crew can self-update; tighter = compliance integrity. Defaulting conservative.
3. **Dispatch eligibility: signal or hard block (v1)?** v1 proposes a **warning chip only** (never blocks assignment). Should an expired CDL/med-card **hard-block** assigning that person to a transport leg in the dispatch cockpit, with a manager override? *Trade-off:* blocking is the real compliance win but couples HR to `rentals-dispatch` and risks stranding a job on bad data. **Recommendation: signal in v1, block in Phase 2.**
4. **`assignedMechanic` migration.** Keep the free-text string and add an optional `assignedEmployeeId` beside it (no data breaks), or convert the unit/WO editors to a roster picker now? *Trade-off:* additive-id = zero risk, two sources of truth temporarily; picker-now = clean but a bigger blast radius across `app.js:5022/6331/10322`. **Recommendation: additive id in v1, picker in Phase 2.**
5. **Is HR a back-office *board* or a top-level grid card?** Proposed: a **Crew board** alongside Parts/Vendors/Expenses (low footprint, inherits board chrome). Or does Jac want it in the 6-card grid? *Trade-off:* board = cheaper, less prominent; grid card = first-class but crowds the 3×2 grid (`config.js:355`).
6. **`linkedLogin` field?** Should an employee optionally record which shared login they usually use (for "who did this")? *Trade-off:* useful audit signal vs re-conflating people with shared logins (the exact thing the role redesign separated).
7. **Warn-window defaults.** Confirm the §4.2 cadences (CDL 60d, med-card 60d, MVR 30d, certs 45d). Are these right for JacRentals' insurer? Admin-editable now or parked (like flag-color §8)? **Recommendation: hardcode defaults v1, Settings pane Phase 2.**
8. **Server-side write gate.** Add additive `hrUpsertEmployee`/`hrVerifyCredential` GAS actions for a hard server-side PII gate, or ride the existing `sync` path + client tier gate (consistent with every other entity)? **Recommendation: ride `sync`; don't add actions for v1.**
9. **Training expiry.** Do any training topics need their own renewal cadence (recurring), or is the training log purely informational in v1? **Recommendation: informational in v1.**
10. **Naming/voice.** "Crew" board, "hand", "round up the crew", "tack" for credentials — is the ranch seasoning right here, or does Jac want it plainer ("Employees", "Staff")? (jactec-ui: voice is the main ranch lever; confirm before stamping labels.)
11. **Self-service portal exposure.** When the customer self-service portal (`mobile-remote`) ships, employee data must be entirely absent from that row-isolated build — confirm HR is hard-excluded from any customer-facing surface.
12. **PII-gate strength under the shared password.** The credential-number gate is **client-side tier enforcement** (the strongest the current model affords, since the backend authenticates by one shared team password and can't strongly prove the caller's tier without `settings.roleMeta`). Is client-side omission-from-DOM an acceptable boundary for last-4 credential data, or does Jac want full numbers kept *only* in Drive scans behind Drive's own ACL (so the Sheet never holds even last-4)? *Trade-off:* DOM-omission is consistent with every other tier gate in the app and good enough for last-4; Drive-only is maximally safe but adds a fetch + an ACL to manage. **Recommendation: last-4 in the gated DOM is fine; full numbers (if ever) Drive-only.**
13. **Seeding the roster from `assignedMechanic`.** Ship the optional "Round up crew from work orders" migration helper (§4.5, mirrors `#migrate-units`) in v1, or start the roster empty and let admins hand-add? *Trade-off:* helper = instant useful roster but may create dupes from typo'd name strings; empty start = clean but more manual entry. **Recommendation: ship the helper as opt-in, with a dedupe confirm step.**

---

## 12. Dependencies & Sequencing

### Must land / be confirmed first
- **`backend-data`** ✅ — the diff-sync + `PERSIST_KEYS` machinery HR rides on already exists. The only prerequisite is an **additive `employees` tab** deployed via `/clasp` (§5.1) before the frontend can persist.
- **`design-system`** ✅ — the flag-color engine (`getEntityFlags`/`getEntityColor`), R-rulebook stamps, and `WINDOW_CATALOG` are the surfaces HR plugs into. HR adds an `employees` flag-catalog entry; it does not modify the engine.
- **Role-system redesign** ✅ (shipped) — the tier ladder (`ROLE_TIERS`/`tierRank`) is the gate HR's PII visibility keys off. HR must **not** reintroduce name-matched permission checks.

### Cross-area dependencies (roadmap slugs)
| Area | Relationship |
|---|---|
| `rentals-dispatch` | Phase 2 dispatch-eligibility block lives at the dispatch cockpit; HR provides the readiness signal |
| `units-fleet` | `assignedMechanic` → `assignedEmployeeId` link; cert↔category mapping reads `categories` |
| `gps-tracking` | Provides the per-driver **Driving Score** (`app.js:7123` null today) once Employee ids exist — HR supplies the id, not the score |
| `maintenance-shop` | The Shop mechanic-roster graph (`app.js:8364`) and WO author flag (`app.js:5463`) currently key off the name string; a future id-link improves both |
| `security-cameras` | (roadmap-listed dep) — only relevant if footage is ever attached to an incident/employee record; out of v1 |
| `mobile-remote` | Board → bottom-sheet reflow; **and** the hard exclusion of HR data from the future customer self-service portal (Open Q 11) |

### Sequencing summary
1. Confirm Open Questions §11 (esp. PII storage, gate tiers, board-vs-card, naming) with Jac.
2. Additive `/clasp` deploy: add the `employees` tab to the backend.
3. Frontend: entity + sync wiring → Crew board → Employee/Credential popups → flag-catalog + aging engine → hazard banner.
4. Run all five CI gates; regenerate `rule-usage.js` and the code map; verify multi-user sync.
5. Offer the `/role` audit (jactec-ui) on the built feature — specifically the PII-gate and data-sensitivity calls.

---

*End of DRAFT — every numbered decision above is open to Jac's critique. The conservative default throughout: when a gate is uncertain, the sensitive data is hidden, not shown.*
