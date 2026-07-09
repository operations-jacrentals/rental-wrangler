# Maintenance / Shop — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/maintenance-shop`
**Task branch:** `maintenance-shop/spec` (proposed)
**Maturity:** shipped
**Scope:** The merged Shop card (Work Orders, Service Orders, Inspections), the recurring-service countdown engine, WO lifecycle/parts/billing, the inspection → auto-WO cascade, and the parts/vendor back-office boards.

---

## ✅ Decisions — 2026-06-29 critique (Jac)

These resolve the §11 Open Questions and **supersede the §3 target-state money-gate table** for the WO-billing surfaces.

- **D1 · Shop WO billing stays OPEN to staff (resolves OQ-1; supersedes §3's gate table).** Keep the billed price (`woBillable`), markup tiers, the **Invoice** action, and **Bill: Yes/No** **visible and runnable by staff** — a mechanic billing the repair they did is "the only influence staff have on invoicing" and a legitimate part of the job (Jac). This **does** expose the marked-up price/margin to staff; accepted (trusted team). **No `canMoney()` gate is added to the Shop billing surfaces.** *(Contrast `rentals-dispatch` D1, which gated a Driver's silent window-extension billing — the distinction is workflow legitimacy: billing your own repair = yes; silently extending someone's rental = no.)*
- **D2 · Server-check money writes, but WO-billing is staff-allowed by design (resolves OQ-11; ties to `backend-data` Q13).** Add the server-side `roleMoneyOk_` mirror so a **forged / no-auth payload cannot move money** — but the **WO→invoice line-add and the `billCustomer` flip are permitted at staff tier** (per D1), while genuine fund movement (charge / refund / payment / `amountPaid` writes) stays **money-tier** server-gated. The server check here = authenticated-caller validation + protecting payment movement, **not** blocking staff WO-billing. *(Reconciles D1 with the "yes, server-check" answer — flag if Jac meant to gate WO-billing server-side too.)*
- **D3 · Service schedules — per-category manufacturer schedules + per-unit overrides (resolves OQ-2).** Replace the placeholder uniform `SERVICE_TASKS` with real **per-category** maker schedules (admin-editable in Settings) **plus per-unit overrides** for a specific machine. Task ids stay stable across the swap (§4.5 migration). **Production blocker** before relying on preventive maintenance.
- **D4 · Field Call billing defaults to No (resolves OQ-6).** A field-call WO defaults `billCustomer:'No'` — the shop eats it unless someone explicitly decides to bill (customer-relations-conservative).

**Defaults adopted:** OQ-7 → manager can override the photo-proof service completion · OQ-9 → confirm on a **backwards** hour-meter entry · OQ-10 → a cancelled WO with real work must be **reopened before billing** (no stranded cost) · OQ-8 → drivers can request a wash · OQ-4 → keep explicit Complete-WO (no auto-complete) · OQ-3 → 3-bar front page defaults for mechanic/M.Tech · OQ-5 → parts `partId` FK in Phase 3.

---

## 1. Goal & Problem

The Shop area is the **wrench side of the yard** — everything a mechanic, M.Tech, or driver does to keep the fleet rentable and to recover repair cost. It answers one operator question at a glance: **"What machine needs me, and what do I do to it next?"**

Three workstreams that the prototype kept on separate cards are merged into one **Shop card** so the crew works a single prioritized queue:

1. **Inspections** — gate a unit Ready/Failed before it can rent; a Fail cascades to a Work Order.
2. **Work Orders (WOs)** — the repair lifecycle: diagnose → source parts → fix → optionally bill the customer → Complete.
3. **Service Orders** — recurring, hour-metered preventive maintenance (oil, grease, filters, wash) driven by a pure countdown engine.

**North star.** A mechanic opens Shop, sees a 3-bucket "front page" (Not Ready · Services · Work Orders) sorted by urgency, taps the worst item, and the app walks them through the fix — including the money decision (bill the customer or eat it) gated to the right role. No machine silently rents while Failed; no recurring service silently lapses; every repair dollar is captured and recoverable.

**Why it matters.** Down units don't earn; a missed service turns a $200 oil change into a $20k engine; an un-billed field-call repair is pure margin lost. Shop is where fleet uptime and repair-cost recovery are won or lost.

---

## 2. Current State (Baseline)

Everything in this section is **shipped and live** unless tagged *(partial)* or *(missing/approved-unbuilt)*. It documents the real system as canon.

### 2.1 The merged Shop card — `APP-19` (`app.js:6848`)

- `SHOP_TYPES = ['inspections','workOrders','serviceOrders']` and `SHOP_SEGMENTS` (`config.js:363–370`) drive a single engine card (`shopCardEl`, `app.js:6911`). The three sub-types fold into **one** wrench "Shop" toggle in the left column (`colTabButtonsHtml`, `app.js:6655`); `COLUMN_OF` maps all three + `shop` to the `left` column (`config.js:390`).
- **Active queue vs completed archive** — `shopItemMode(ty, rec, complete)` (`app.js:6859`): default shows pending inspections, open WOs (`phase !== 'Complete' && !cancelled`), and all non-ok services; the "Completed" sort flips to resolved inspections + completed/cancelled WOs. Services are never archived (`return !complete`).
- **In-scope records** — `shopItemsByType(session)` (`app.js:6867`) resolves each type against search mode, anchor-cascade subset, browse-all, or full collection, then filters by queue/archive. `serviceOrders` indexes off the **units** search blob.
- **Urgency sort (default)** — `shopUrgency(it)` (`app.js:6889`): inspection Fail = 90; WO `Failed` type = 95, open = 60, complete = 10; service `past-due` = 100, `due-soon`/wash-requested = 70–85. `shopSort` (`app.js:6896`) also supports date/unit/type.
- **Segment bar + list rows** — `shopListView` (`app.js:6954`) renders the `SHOP_SEGMENTS` pills with counts; `shopRowEl(type, rec)` (`app.js:7027`) renders a unified row with a per-type colored glyph (`CARD_ICON.inspectionsPending` for pending inspections).
- **Standard/anchor/cascade plumbing** rides a `recType` thread so a Shop row opens its own entity detail (`DETAIL[cs.recType]`).

### 2.2 Service-countdown engine — `service-countdown.js` (pure, no DOM)

The **real** countdown logic (the prototype's synthetic `svcForUnit()` math is dead):

```
elapsed   = currentHours − lastServicedHours
remaining = intervalHours − elapsed
pct       = elapsed / intervalHours
status    = remaining < 0      → 'past-due'  (red)
            pct >= DUE_SOON_AT  → 'due-soon'  (yellow)   // DUE_SOON_AT = 0.9
            else               → 'ok'        (green)
```

- `SERVICE_TASKS` — 10 default recurring tasks with HOUR intervals (safety/grease/oil 250h, air/tire/battery/fuel 500h, annual/hydraulic 1000h) + a `parts[]` list each. **v1 placeholder** — flagged in-code to be replaced by real per-equipment manufacturer schedules (likely keyed by Category) before production.
- `serviceOrdersForUnit(unit, completions, opts)` builds one row per task, falling back to `unit.purchaseHours` as the baseline when a task was never completed; sorts most-urgent-first.
- App layer (`app.js:1746–1766`): `WASH_TASK` (every 100 engine-hours) is prepended as `svc-wash`; `SVC_OPTS` maps `hoursField:'currentHours'`, `baselineField:'purchaseHours'`. `topServiceForUnit(unit)` floats a pending wash request to the top; `svcPills(s)` renders status + countdown badges, or a single blue **"Wash Requested"** pill.
- **Completion** — `recordServiceCompletion(unitId, taskId, hours, date, note, photo)` (`app.js:15293`): resets the countdown via `completeService`, appends to `unit.serviceLog`, clears `washRequested` for `svc-wash`, logs to History. **Photo proof is required** to complete a service (gated in the `js-svc-save` handler, `app.js:12689`).

### 2.3 Work Order lifecycle, parts & billing

- **Phases** — `STATUS_META.woPhase` (`config.js:115–123`), with the **literal flag colors** (these are canon — the flag-color system reads them): `Part Needed?` (**purple**, decision pending) → `No Part Needed` (yellow) / `Part Needed` (**red**, blocking) → `Part is Local` (yellow) / `Part in Stock` (**green**) / `Part Ordered` (**blue**) → `Complete` (green). The `WO_SEV` severity order (§7.3) is independent of these colors.
- **Types** — `woType`: `Failed` (from a failed inspection, red), `Field Call` (red), `Manual` (gray).
- **Line items** — `addPartToWO(woId, part, cost, hours, phase)` (`app.js:15347`) appends `{part, cost, hours, phase, eta, vendor}` and advances the header phase to the latest open line.
- **Bottleneck** — `woBottleneck(w)` (`app.js:5191`) computes the worst open line via `WO_SEV` and shows "Ready to complete" when all lines are done; `unitWorstBottleneck` rolls up across a unit's open WOs.
- **Billable formula** — `woBillable(w)` (`app.js:1776`): tiered parts markup by each part's cost (`≤$50 ×2.0 · ≤$200 ×1.5 · ≤$1000 ×1.3 · >$1000 ×1.2`) plus **$150/hr** labor (`LABOR_RATE`), rounded. `unitRepairCost(unitId)` (raw Σ line costs) is the un-marked-up internal cost.
- **Complete gate** — only the blue **Complete WO** button (`js-wo-complete`, `actionPill`, `app.js:5490`) completes a WO; the `wodone` confirm popup (`app.js:9238`) gates it. **A WO part/task line going to Complete must NOT complete the work order** (CLAUDE.md "Don't").
- **Bill-to-invoice** — `billWOToInvoice(woId)` (`app.js:15530`) finds/creates the customer's open invoice and jumps to it; `billWOToInvoiceExplicit(woId, invoiceId)` (`app.js:15518`) is the **drag-to-invoice** path with locked-invoice, no-customer, and **customer-mismatch** guards (`woDroppableToInvoice`, `app.js:11788`); bill-once enforced by `addWOToInvoice` (`app.js:15576`, §7.6). The Invoice button handler is `js-bill-wo` (`app.js:12686`); the bill-to-customer toggle is `js-insp-bill` → `setInspBill` (`app.js:12773` / `15308`).
- **⚠️ Money-action gating is NOT enforced today (live gap).** `canMoney()` (`app.js:14166`) is used throughout Invoices / Cards / Memberships (14 call sites: `app.js:643/3263/6251/12417…`) but is **never called on any Shop/WO surface**. Concretely, in the live build a **staff-tier mechanic** can: see the `woBillable` customer price + margin (`woSectionHtml` foot `app.js:5487`; the "Price if billed" column `app.js:5021`; the WO detail journey `app.js:6308`), press **Invoice** (`js-bill-wo`, no gate), and set **Bill: Yes/No** (`js-insp-bill`, no gate). §3 specifies the conservative gate this area *should* have; §8 Phase 1 makes wiring it a launch task; §9 AC-5 tests it; §11.1 surfaces the policy fork. **Do not read §3's gate as already-shipped — it is the target state.**
- **Condition lock** — `unitCondLock(u)` (`app.js:5214`): a unit's condition is locked while a `Failed`- or `Field Call`-origin WO is open. Surfaces as `flashOr` on the Complete button (`app.js:13222`).

### 2.4 Inspection → auto-WO cascade

- **Birth** — inspections and WOs are **unit-born** (`startNewInspection`, `app.js:14786`; `startNewWorkOrder`, `app.js:14797`). No pick mode.
- **Checklist** — config-driven per category (`checklistFor`, `inspectionCfg`); typed items (`INSP_TYPES = toggle/file/select/number/date/text`, `app.js:3063`) with per-type fail conditions (`inspItemFails`, `app.js:3069`) and per-item photo-evidence policy (`inspEvidenceMissing`: none/optional/always/failphoto, `app.js:3103`). The `checklist` overlay (`app.js:9603`) gates "Complete inspection" until all items answered.
- **Result + cascade** — `setInspResult(id, val)` (`app.js:15276`): sets `n.checklist`, syncs `unit.inspectionStatus` (`Ready`/`Failed`), and on **Fail** calls `autoWOFromInspection(n)` (`app.js:15318`) → creates a `woType:'Failed'` WO that references the inspection's live evidence via `wo.inspectionId`, then opens the **failure report** popup. `setInspBill(id, val)` (`app.js:15308`) sets bill-to-customer and syncs the auto-WO's `billCustomer`/`customerId`.
- **Wash** — recurring 100-hr `svc-wash` interval; a Wash Request floats to the top and is cleared by a logged wash.

### 2.5 Parts & Vendor boards

- `BACKOFFICE_BOARDS` (`config.js:371`) includes `parts` and `vendors`, opened via the `board` overlay (`app.js:9811`).
- **Parts** record fields (`app.js:10325`): `partId, name, status, qtyOnHand, website, orderEmail, productNumber, vendorId, notes`. Detail renderer `DETAIL.parts` (`app.js:6033`). Vendors list their parts (`DETAIL.vendors`, `app.js:5950`).
- WO line `vendor` names link to the vendor detail (`js-vendor-open`, `app.js:12578`). Service tasks carry a `parts[]` name list.

### 2.6 Approved-unbuilt (per roadmap "Today")

- **Wrench Shop toggle + 3-bar graph** — the single wrench "Shop" front-page graph (Not Ready · Services · Work Orders, stacked by phase, drill-to-segment). Design approved: `docs/superpowers/specs/2026-06-23-shop-wrench-graph-design.md`. *(Toggle shipped; the dedicated 3-bar `graphViewsFor('shop')` view is the unbuilt piece — Shop currently falls back to the legacy combined `cardGraphBody('shop')` dashboard.)*
- **Per-item inspection evidence capture** — typed fields + per-item photo policy shipped (`app.js:3099–3110`); the richer capture flow is specced in `docs/superpowers/specs/2026-06-26-inspection-evidence-capture-design.md` and `2026-06-22-independent-capture-design.md`.

---

## 3. Users, Roles & Data Gates

15 customizable roles carry a **tier** (`ROLE_TIERS`, `config.js:326`; role-system redesign). Gates compare **tiers, never role names** — roles are renamable in Settings → Roles & Logins, so any name-matched check is a bug. The resolver is `roleTier(role)` (`app.js:13055`): it maps `currentRole` → rank 0–5 via `settings.roleMeta` (synced to every client in `loadFromBackend`), falling back to `BUILTIN_ROLE_TIERS` (`config.js:340`), with unknown/blank → **0 (no privilege)**. Ladder: `staff(1) < money(2) < manager(3) < admin(4) < developer(5)`.

The two shipped gate helpers this area must reuse (do **not** invent a parallel one):

```js
const canMoney   = () => !currentRole || roleTier(currentRole) >= tierRank('money');   // app.js:14166
const adminUnlocked = () => roleTier(currentRole) >= tierRank('admin');                 // app.js:13071
```

> **`!currentRole` short-circuit — read before gating.** `canMoney()` returns **true** when there is no logged-in role — the `#local` no-login demo deliberately shows the money UI. Every Shop money surface that adopts `canMoney()` inherits this: the gate hides money from a *staff*-tier login but NOT from the role-less demo. That is the existing project convention (mirrors Invoices); call it out, don't "fix" it silently (see §11.1). Handlers must **re-check `canMoney()` as defence-in-depth** (the project's stated pattern, `app.js:3262`) — never rely on hiding the button alone.

Shop is primarily a **staff**-tier surface; money decisions escalate to **money**+.

| Tier (rank) | Shop powers |
|---|---|
| `staff` (1) | View/work Shop queue; run inspections; create/advance WOs; add parts/labor lines; log service completions; request wash. **Operational only.** |
| `money` (2) | + (TARGET) see WO **billable price** (`woBillable` markup), bill a WO to an invoice, decide `billCustomer` Yes/No. *Today these are visible/runnable to ALL tiers — the gate is unwired (§2.3, §3 gate table).* |
| `manager` (3) | + override blocks (e.g. complete a WO with open guards), approve crew requests. |
| `admin` (4) | + edit service intervals / checklist config / category pricing in Settings, run migrations. |
| `developer` (5) | + Rulebook / Design-Lint / Inspector dev tools. |

Built-in role → default tier (`BUILTIN_ROLE_TIERS`, `config.js:340`): mechanic/mtech/driver = **staff**; office/sales = **money**; manager/admin/developer/owner as named. Role KPIs (`config.js:303`): Mechanic → *Healthy Fleet, WO Completion Rate, Parts Breakeven*; M.Tech → *Successful Rentals, Ready Rate, WO Rate (20% goal)*; Driver → *On-Time, Wash Completion, Driving Score*.

### Data gates — TARGET STATE (conservative). ⚠️ NOT enforced in code today; see §2.3 + §8 Phase 1.

The table below is the **conservative target**. Every row marked 🔴 is a *live gap* (the action/value is currently visible/runnable by **any** role). Resolve §11.1 before wiring; wire all 🔴 rows together in Phase 1 so the gate lands atomically.

| Gate | Target | Today | Mechanism to add |
|---|---|---|---|
| `woBillable` customer price (`app.js:5487`, `6308`) | **money**+ only | 🔴 visible to all | wrap render in `canMoney()` (else show "—" / "Billing: Office") |
| "Price if billed" WO column (`app.js:5021`) | **money**+ only | 🔴 visible to all | drop the column for non-money via the column-set gate |
| **Invoice** action (`js-bill-wo`, `app.js:12686`) | **money**+ only | 🔴 runnable by all | handler-level `if (!canMoney()) { toast('Billing is Office/Admin only.'); return; }` + hide button |
| **Bill: Yes/No** (`js-insp-bill` → `setInspBill`, `app.js:12773`) | **money**+ only | 🔴 runnable by all | same handler-level guard + hide toggle row |
| Drag-WO-to-invoice (`woDroppableToInvoice`, `app.js:11788`) | **money**+ only | 🔴 droppable by all | add `canMoney()` to the droppable predicate AND `billWOToInvoiceExplicit` |
| Raw line `cost` the mechanic entered | **staff** OK (own cost) | visible | leave — see fork below |
| Service interval / checklist / category-pricing config edit | **admin** (`adminUnlocked()`) | gated (Settings) | already correct — keep |

- **Pricing-floor / margin visibility.** `woBillable` (`app.js:1776`) is the **marked-up customer price**; `unitRepairCost(unitId)` / raw line `cost` is the **internal un-marked-up cost**. The *margin* (= billable − rawCost) and the *markup tiers* (`partMarkup`, `app.js:1775`) let any viewer infer the customer's price floor. Conservative default: hide the computed **billable** and the **markup** from `staff`; the raw line `cost` a mechanic typed in is theirs to see (it's their own number, not the customer's floor). **The exact staff cost-visibility line is §11.1.**
- **Bill-customer decision.** `setInspBill` / `billCustomer` Yes/Maybe/No is a **money decision** → **money**+. A staff mechanic runs the fix and marks line phases; *choosing to bill the customer* is gated. (Currently ungated — §2.3.)
- **Customer-isolation / PII.** A WO/inspection carries `customerId` only when bill-routed; the auto-WO pulls it from the active rental (`rentals-dispatch`). No customer PII renders on a Shop row beyond the standard linked-name pill. Inspection/WO photos are **unit evidence**, not customer documents — they don't widen the customer-isolation surface. A Shop row must never surface a customer's contact/payment fields; if a future field needs them, gate per `customers-crm`.
- **Field Call** is a red, customer-facing event (a machine broke on the customer's site). It surfaces the customer pill, but **billing still routes through the money gate** — the red flag must not become a billing back-door for staff.

---

## 4. Data Model

Schema-less Google Sheets (one tab per entity); the SPA holds `DATA.*` arrays indexed by `IDX.*` Maps. Additive fields are safe — unknown columns are ignored by old clients and persisted by the diff-sync layer (`backend-data`).

### 4.1 Inspection (`DATA.inspections`, `IDX.insp`, id `inspectionId`)

| Field | Type | Notes |
|---|---|---|
| `inspectionId` | id | `INS-…` |
| `unitId` | ref → units | unit-born |
| `date` | ISO | |
| `wash` | str | wash sub-result |
| `checklist` | `''`/`Pass`/`Fail` | `''` = Not Ready (pending) |
| `billCustomer` | `Yes`/`No` | money gate |
| `customerId` | ref → customers, nullable | set only when `Yes` |
| `woId` | ref → workOrders, nullable | set when Fail cascades |
| `photo`, `description` | str | failure report |
| `itemEvidence` | `{itemId: photo[]}` | per-item evidence |
| `mock` | bool | unsaved draft flag |

### 4.2 Work Order (`DATA.workOrders`, `IDX.wo`, id `woId`)

| Field | Type | Notes |
|---|---|---|
| `woId` | id | `WO-…` / `WO-INS…` (auto) / `WO-NEW…` (draft) |
| `unitId` | ref → units | |
| `inspectionId` | ref, nullable | back-ref for live evidence |
| `customerId` | ref, nullable | bill-to (money gate) |
| `woReport`, `description` | str | |
| `woType` | `Failed`/`Manual`/`Field Call` | |
| `phase` | woPhase enum | header bottleneck |
| `billCustomer` | `Yes`/`Maybe`/`No` | |
| `date`, `eta` | ISO | |
| `unitHoursAtCreation` | num | hour-meter snapshot |
| `assignedMechanic` | str | |
| `laborHours` | num | fallback when lines carry no hours |
| `lineItems[]` | `{part, cost, hours, phase, eta, vendor}` | |
| `cancelled` | bool | terminal, reopenable |

### 4.3 Service Order — **derived, not stored**

Service Orders are computed per-unit from the countdown engine. The **only** persisted state lives on the **unit**:

| Unit field | Type | Notes |
|---|---|---|
| `currentHours` | num | hour meter |
| `purchaseHours` | num | baseline for never-serviced tasks |
| `serviceCompletions` | `{taskId: hoursAtCompletion}` | resets each task's countdown |
| `serviceLog[]` | `{taskId, hours, date, note, photo}` | History |
| `washRequested` | bool | floats wash to top |
| `inspectionStatus` | `Ready`/`Not Ready`/`Failed` | set by `setInspResult` |

### 4.4 Part (`DATA.parts`, `IDX.part`, id `partId`) / Vendor (`DATA.vendors`, id `vendorId`)

Part: `partId, name, status, qtyOnHand, website, orderEmail, productNumber, vendorId, notes`. Vendor: `vendorId, name, phone, email, address, website, primaryContact, vendorType, notes`. **Relationship:** part → vendor by `vendorId`; WO line → part by name (currently free-text `part`, not an FK — see §11.5); service task → part by name in `task.parts[]`.

### 4.5 Migration concerns

- **No back-fill needed** for shipped fields. New additive fields (e.g. a WO-line `partId` FK, a per-category `serviceSchedule`) default-absent and degrade gracefully.
- Replacing the placeholder `SERVICE_TASKS` with per-category schedules (§11.2) is the one real migration: existing `serviceCompletions` keyed by `taskId` must keep matching, so task ids must be stable across the swap.

---

## 5. Backend / Integration Contract

Single GAS entry point `backendCall(action, payload)` over schema-less Sheets. New behavior = **additive** actions only; Code.gs is gitignored (don't assume it's readable). Shop today persists through the generic entity diff-sync (`backend-data` area) — every `DATA.*` mutation above syncs as a normal record upsert. No Shop-specific server logic exists yet.

### 5.1 Existing (generic) contract

- WO / inspection / unit upserts ride the 11-entity diff-sync (`computeChanges` upserts, `backend-data`). The countdown is **client-computed** — the server stores `serviceCompletions`/`serviceLog`/`currentHours`, never the derived status.
- **Server-side auth caveat (don't over-trust the client gate).** The §3 gates are **client-side visibility** gates. The diff-sync upsert path is generic and does **not** verify tier per-field — a hand-crafted payload could still set `billCustomer:'Yes'` or push a WO onto an invoice without a money tier. The backend already maps password→role (`roleTierRank_`, `docs/handoffs/role-tiers-backend.gs:20`; `roleMoneyOk_`). **Open Question §11.11** — does any Shop money write (`billCustomer` flip, WO→invoice line) need a *server-side* `roleMoneyOk_` check, mirroring how payments are server-gated, or is client-gating acceptable for an internal single-tenant tool? Conservative answer: at minimum, the WO→invoice **line-add** (which creates billable money) should be server-checked when invoicing already is.

### 5.2 Proposed additive actions (for later phases)

All actions go through the single `backendCall(action, payload)`; auth is the caller's password→role on the server (`roleTierRank_`). Each returns `{ok:true, …}` or `{ok:false, error}`; the client surfaces `error` as a toast and does NOT mutate local state on failure.

| Action | Payload | Returns | Auth (server-checked) | Failure handling |
|---|---|---|---|---|
| `partDecrementOnWO` (Ph 3) | `{woId, partId, qty}` | `{ok, qtyOnHand}` | `roleMoneyOk_` (money+) | reject if result `< 0` unless `manager+` override flag; on reject `{ok:false, error:'INSUFFICIENT_STOCK'}` — line still saved, stock not moved |
| `reorderPart` (Ph 3) | `{partId, qty, vendorId, note}` | `{ok, orderRef}` | money+ | email send is best-effort: on SMTP failure return `{ok:false, error:'SEND_FAILED'}`, do NOT mark reordered; client toasts + offers retry. Never silently drop. |
| `pushServiceSchedule` (Ph 2) | `{categoryId, tasks[]}` | `{ok, taskIdsChanged[]}` | `adminUnlocked` (admin+) | reject if any incoming `taskId` collides with a different task name across categories (stability guard, §4.5); return the diff so the client can warn before applying |
| `billWOServerCheck` (Ph 1, optional) | `{woId, invoiceId, role}` | `{ok}` | money+ | server mirror of the client money gate for the WO→invoice line-add (see §5.1 caveat / §11.11) |

**Idempotency / races.** `partDecrementOnWO` and `reorderPart` mutate shared counters — they must be **idempotent per `(woId, partId)`** (carry a client `opId`) so a double-tap or a sync retry can't double-decrement. The diff-sync's last-write-wins does NOT protect a counter; these go through dedicated actions precisely to avoid that.

### 5.3 External integrations (later phases, OQ-gated)

- **SMS/email to vendor** for `orderEmail` part reorders (Phase 3) — via the existing notification channel, not a new provider.
- **Telematics / hour-meter sync** — auto-update `currentHours` from a GPS/telematics feed so the countdown is live without manual entry (depends on `gps-tracking`). **Out of v1.**
- No Stripe/QuickBooks here — billing routes through `invoicing-payments` once a WO is on an invoice.

---

## 6. UX / UI

All new/changed UI runs through the **`jactec-ui`** skill in the **yard data-plate** language: dark steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`), **one** safety-orange `--accent #ff7a1a` for primary/ignition actions, the hi-vis hazard stripe for danger/abort, **Saira Condensed** stamped uppercase labels, corner **rivets**, and a **light** wrangler/ranch seasoning mostly in copy. Red hazard variant for Field Call / Failed / abort.

### 6.1 Shop card — the front page (3-bar graph, approved-unbuilt)

The wrench **"Shop"** toggle opens the card in graph view with a single `bars` view `key:'shopfront'`:

| Bar | Stacking | Count | Tap → drill |
|---|---|---|---|
| **Not Ready** | yellow | units `inspectionStatus === 'Not Ready'` | shop → inspections, Not-Ready filter |
| **Services** | red `past-due` + yellow `due-soon` | units whose `topServiceForUnit().status` is past-due/due-soon | shop → serviceOrders, `__svcstat` filter |
| **Work Orders** | stacked by `woPhase`, each in its phase color | open WOs | shop → workOrders, phase filter |

- **Yard voice:** header stamp "SHOP — ROUND UP THE YARD"; empty state "Corral's clear — nothing waiting." Bars carry stamped Saira labels; the active drill segment gets the orange accent rail.
- States: **empty** = all-clear plate; **loading** = skeleton bars; **error** = "Couldn't read the yard — pull to retry."
- **Mobile reflow:** the 3-column grid collapses to the single Shop entry in the phone footer (`MOBILE_CARDS`), `goToCard('shop')` opens graph view; bars stack vertically; bottom-sheet detail.

### 6.2 Shop list rows

Unified `shopRowEl` row: per-type colored glyph + record title + status badge(s) + urgency. Service rows show `svcPills` (status + "N HRS remaining/overdue", or blue "Wash Requested"). Saddle-stitch tan divider between sub-type groups when the segment is "all".

### 6.3 Popups (WINDOW_CATALOG — already catalogued)

These Shop popups **exist** in `WINDOW_CATALOG` (`app.js:9796`) and must stay registered (CI gate `check-window-catalog.mjs`):

| `kind` | label | tag |
|---|---|---|
| `checklist` | Inspection checklist | Inspection · checklist |
| `inspection` | Failure report | Inspection · failure |
| `service` | Complete service | Service · complete |
| `wodone` | Complete Work Order? | Work order · confirm |
| `partform` | Add / Edit Part · Task | Work order · line |
| `board` | Back-office board (parts/vendors) | Back office · records |

Any **new** Shop popup (e.g. a "Reorder part" dialog in Phase 3) **must** add a `WINDOW_CATALOG` entry with a `sample()` or CI fails. Design: danger popups (failure report, Complete WO confirm) top with the **red hazard stripe**; ignition primary buttons orange; "Keep as pending" is the ghost de-emphasized action.

### 6.4 R-Rulebook stamps

Every Shop UI element carries a `data-r="Rxx"` stamp; live examples: Complete WO `actionPill` (R17/R18 region, `app.js:5490`), checklist footer buttons R17/R18 (`app.js:9603`), badges R3 (`app.js:1756`), the rental WO pill R4 (`app.js:5237`). **Any new/changed Shop element gets a stamp**, then `ci/gen-rule-usage.mjs` is regenerated (`rule-usage.js`). The drift guard + duplicate-rule guard are CI-enforced.

---

## 7. Business Rules / Derivations / Money

### 7.1 Service countdown (canon — `service-countdown.js`)

`remaining = intervalHours − (currentHours − lastServicedHours)`; `pct = elapsed / intervalHours`; `past-due` if `remaining < 0`, `due-soon` if `pct ≥ 0.9`, else `ok`. `lastServicedHours` falls back to `purchaseHours` when a task was never completed. Wash = 100-hr interval, prepended.

### 7.2 WO billable (canon — `woBillable`, `app.js:1776`)

```
partMarkup(cost) = cost ≤ 50 ? 2.0 : cost ≤ 200 ? 1.5 : cost ≤ 1000 ? 1.3 : 1.2
parts  = Σ over lines  (line.cost × partMarkup(line.cost))
labor  = (Σ line.hours) || w.laborHours       // line hours preferred, else WO fallback
billable = round(parts + labor × 150)          // LABOR_RATE = $150/hr
```

`unitRepairCost(unitId)` = raw Σ line costs (internal, un-marked-up). Margin = `billable − rawCost`. **Visibility of margin/billable is the money-tier gate (§3).**

### 7.3 WO bottleneck (canon — `woBottleneck`, `app.js:5191`)

No lines → header phase. With lines → worst open line by `WO_SEV` (Part Needed 0 → Needed? 1 → Ordered 2 → Local 3 → in-Stock 3.5 → No Part 4), tie-broken by ETA. All lines done → "Ready to complete" (green). A WO **never auto-completes** — only the blue Complete WO button does.

### 7.4 Inspection result (canon — `inspResult`, `app.js:1789`)

`Pass` → green/Ready; `Fail` → red/Failed + auto-WO; `''` → yellow/Not Ready. A unit's `inspectionStatus` mirrors the latest result and gates rentability (`isUnitRentable`, `app.js:1808`).

### 7.5 Edge cases

- **Hour-meter rollback / re-entry:** if `currentHours < lastServicedHours`, `remaining` exceeds the interval (looks brand-new). Acceptable for v1; flag as data-entry risk (§10).
- **Never-serviced unit, high hours:** baseline = `purchaseHours`; if `purchaseHours` is 0 a high-hour used machine reads everything past-due day one. Real-schedule swap (§11.2) should set sensible baselines.
- **Bill-once:** `addWOToInvoice` enforces a WO bills to exactly one invoice; re-bill shows "Billed" badge.
- **Customer mismatch:** dragging a WO onto another customer's invoice is blocked (`billWOToInvoiceExplicit`).

---

## 8. Phasing & Milestones

**Phase 1 — Close the money-gate gap + ship the front page + evidence (MVP).**
- **🔴 WIRE THE MONEY GATE (security — do this first).** Today every 🔴 row in §3 is ungated. Add `canMoney()` to: the `woBillable`/markup render in `woSectionHtml` (`app.js:5487`) + WO detail journey (`app.js:6308`); the "Price if billed" column (`app.js:5021`); the `js-bill-wo` handler (`app.js:12686`) and `js-insp-bill` handler (`app.js:12773`) with a defence-in-depth toast; the `woDroppableToInvoice` predicate (`app.js:11788`) + `billWOToInvoiceExplicit`. Hide the buttons AND re-check in the handler. Resolve §11.1 (staff cost line) first. Land all changes atomically so a partial gate doesn't leak one surface.
- Build `graphViewsFor('shop')` 3-bar view (Not Ready · Services · Work Orders) per the approved design (`docs/superpowers/specs/2026-06-23-shop-wrench-graph-design.md`); retire the legacy combined `cardGraphBody('shop')` dashboard fallback. *(In scope.)*
- Finish per-item inspection evidence capture (typed fields + photo policy already shipped; richer flow specced in `2026-06-26-inspection-evidence-capture-design.md`).
- *(Out of scope v1: parts FK, telematics hour-sync, reorder workflow, server-side money write-check unless §11.11 says otherwise.)*

**Phase 2 — Real service schedules.** Per-category `serviceSchedule` (replace placeholder `SERVICE_TASKS`), admin-editable in Settings, with stable task ids + `pushServiceSchedule` action.

**Phase 3 — Parts inventory loop.** WO-line `partId` FK; `partDecrementOnWO` on parts used; low-stock flag on `qtyOnHand`; `reorderPart` email to vendor `orderEmail`.

**Phase 4 — Telematics hour sync.** Auto-update `currentHours` from `gps-tracking` so countdowns are live (depends on that area).

---

## 9. Acceptance Criteria

1. Shop card defaults to the 3-bar front page for staff roles; tapping a segment drills to the correct sub-type + filter; counts match `shopAlertCount`.
2. Service countdown matches the formula exactly for: fresh task (uses baseline), completed task (resets), past-due, due-soon at exactly 90%. (`ci/logic-test.mjs` covers the pure engine.)
3. A Fail on the checklist creates a `woType:'Failed'` WO, flips the unit to `Failed`, opens the failure report, and links `wo.inspectionId`.
4. `woBillable` returns the tiered-markup + $150/hr labor amount for a mixed parts/labor WO.
5. **Money gate (NEW enforcement — this is the regression-prevention AC).** With `currentRole` set to a **staff**-tier login: (a) `woBillable` / "Price if billed" / the WO-foot `= $billed` line do NOT render (show "—" or "Billing: Office"); (b) the **Invoice** button and **Bill: Yes/No** toggle are not shown; (c) invoking `js-bill-wo` or `js-insp-bill` programmatically still no-ops with the "Office/Admin only" toast (defence-in-depth); (d) a WO is not droppable onto an invoice. With a **money**+ login all four are available. With **no role** (`#local` demo) the money UI shows (documented `!currentRole` pass-through, §3). *(Pure-logic slice — `canMoney()` truth table by tier — testable in `ci/logic-test.mjs`; the DOM hide/show is a `ci/smoke.mjs` assertion.)*
6. Completing a part/task **line** (`js-wophase-line` → Complete) does NOT complete the WO; only the **Complete WO** button (`js-wo-complete`, with the `wodone` confirm) does. (CLAUDE.md "Don't".)
7. A service can't be completed without a photo (`js-svc-save` blocks on `!state.svcPhoto`, `app.js:12689`).
8. **CI gates pass (port-swap 8000→9147 first per CLAUDE.md):** `node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check` (regenerate `rule-usage.js` when any `data-r` stamp is added/changed — duplicate-rule guard included), `node ci/check-window-catalog.mjs` (any new Shop popup catalogued in `WINDOW_CATALOG` or CI fails), `node tools/gen-code-map.mjs --check` (regenerate the Code Atlas if an `APP-xx` chapter banner is added/moved/retitled — e.g. a new "Shop graph" chapter). Every new/changed Shop UI element carries a `data-r="Rxx"` stamp.

---

## 10. Risks & Edge Cases

- **🔴 SECURITY — margin/money-action leak is LIVE today (highest priority).** Per §2.3/§3, the money gate is *specified but not wired*: a **staff** mechanic sees the `woBillable` customer price + the markup tiers (can back-out the price floor) and can press **Invoice** / set **Bill: Yes/No** — money actions that should be Office/Admin. This is a real exposure on the shipped build, not a future risk. Phase 1 closes it; until then, treat any "staff can't see pricing" assumption as false. *Severity: margin/pricing-floor disclosure to operational staff + unauthorized money mutation.*
- **Server-trust gap** — even after the client gate lands, the generic diff-sync could accept a money write from a forged payload (§5.1). Decide §11.11 before assuming the gate is airtight.
- **Placeholder schedules ship to prod** — `SERVICE_TASKS` is flagged in-code as a v1 placeholder; the warning is easy to miss. Real per-equipment schedules (§11.2) are a launch blocker for any customer relying on preventive maintenance.
- **Hour-meter integrity** — `currentHours` is manual entry; a rollback/typo skews **every** countdown for that unit (and, post-Phase-4, would fight the telematics feed). No clamp/confirm today (§7.5, §11.9).
- **Multi-user race** — two mechanics advancing the same WO; diff-sync last-write-wins can drop a line item or clobber a phase. Counter mutations (parts stock) MUST use the idempotent actions in §5.2, not the generic upsert. (Shared concern with `backend-data`.)
- **Auto-WO duplication** — a unit failed twice before the first `Failed` WO closes → two open `Failed` WOs, both condition-locking the unit. Acceptable but noisy; `autoWOFromInspection` could dedupe against an existing open `Failed` WO for the same unit (§11.x).
- **Offline / multi-user** — the countdown is pure client-side so it reads correctly offline; service completions and WO edits queue through the sync layer and reconcile on reconnect (last-write-wins caveat above).
- **Cancelled-but-done WO** — a cancelled WO with real line items represents work actually performed whose cost is now uncaptured (billing routes off *open* WOs). Data-integrity + revenue-leak edge — see §11.10.

---

## 11. Open Questions

> **Resolved 2026-06-29:** OQ-1 → D1 (WO-billing stays OPEN to staff; §3 gate table superseded) · OQ-11 → D2 (server-check money writes, but WO-billing staff-allowed) · OQ-2 → D3 (per-category + per-unit service schedules) · OQ-6 → D4 (Field Call defaults to No). Adopted: OQ-7/8/9/10, OQ-3/4/5. See the Decisions block up top.

(No seed questions were captured; all below are generated from reading the live code. **OQ-1 and OQ-11 are gate decisions — keep them on the main session, don't delegate; they touch margin visibility and money writes.**)

1. **Margin/billable visibility for staff — and how far to gate.** *(Context: today this is UNENFORCED — §2.3/§3 — so resolving this is a Phase-1 security task, not a nicety.)* Three forks: **(a)** hide only the computed `woBillable` + markup tiers + the Invoice/Bill actions from `staff` (keep their own raw line cost visible — recommended conservative default); **(b)** also hide raw line `cost` from staff entirely (maximum protection, but a mechanic can no longer see what a part cost the shop — hurts triage and "is this even worth a line"); **(c)** leave it all open (status quo — rejected, leaks the price floor). *Trade-off: (a) protects the customer price floor while keeping the crew operational; (b) is airtight but blinds the wrench; (c) is the current leak.* Recommend **(a)**.
   - **Sub-fork:** keep the `!currentRole` `#local` pass-through (money UI shows with no login, matching Invoices) — or make Shop stricter and hide money even in the demo? *Consistency with the rest of the app argues keep it; a "never show pricing without an explicit money role" stance argues change it everywhere (a `design-system`/`backend-data` decision, not Shop-local).*
2. **Real service schedules — keyed by what?** Per-category (`categoryId`) manufacturer schedules, or per-unit overrides, or both? Where do they live — Settings sheet vs hardcoded? *Trade-off: per-category is simpler and matches the placeholder; per-unit is accurate for mixed fleets but heavier to maintain.*
3. **3-bar front page — default landing per role?** Should it be the default view for mechanic/M.Tech only, or all staff? Should `office`/`sales` land elsewhere? *No per-role default landing exists today.*
4. **WO auto-complete vs explicit.** Keep "never auto-complete" (current canon) even when every line is "Ready to complete"? Or offer a one-tap "Complete all" that still routes through the confirm? *Trade-off: explicit is safer (CLAUDE.md Don't), but adds friction on simple WOs.*
5. **Parts as FK vs free text.** Promote WO-line `part` from free-text to a `partId` FK so usage decrements `qtyOnHand`? *Trade-off: enables the inventory loop (Phase 3) but forces every line through the catalog; free-text is faster for one-offs.*
6. **Field Call billing default.** A Field Call is customer-caused-uptime-loss — should `billCustomer` default to `Yes`/`Maybe` (today it's `No` for manual, and inherits from inspection bill for Failed)? *Money-gate sensitive.*
7. **Service completion override.** The photo-proof requirement is hard. Should `manager`-tier be able to override (e.g. service logged retroactively without a photo)? 
8. **Wash request source.** Wash is a 100-hr service interval AND a manual request (`washRequested`). Should a driver be able to request a wash, or is that mechanic/M.Tech only? (Driver KPI includes "Wash Completion".)
9. **Hour-meter sanity guard.** Add a clamp/confirm when `currentHours` entry is lower than the last reading, to protect the countdown? 
10. **Cancelled WO billing.** A cancelled WO is terminal-but-reopenable and lives in the "done" list. Can a cancelled WO still be billed if work was actually done (real line items, real cost)? *Today bill routes off open WOs, so a cancelled WO's captured cost is stranded — revenue leak vs. the cleanliness of "cancelled = void." Option: require Reopen→bill→Complete, never bill-from-cancelled.*
11. **Server-side enforcement of Shop money writes.** Should the WO→invoice line-add and the `billCustomer` flip be checked *server-side* (`roleMoneyOk_`, mirroring how payments are gated), or is the client `canMoney()` gate sufficient for an internal single-tenant tool? *Trade-off: client-only is simpler and matches most of the app, but a forged diff-sync payload can still write billable money (§5.1); server-checking the line-add closes that at the cost of one additive action + a `backend-data` change.* **Money/auth gate — keep on main.**
12. **3-bar graph as a new Code-Atlas chapter?** Building `graphViewsFor('shop')` may warrant its own `APP-xx` chapter banner. If a banner is added/moved, `node tools/gen-code-map.mjs --check` will fail until regenerated — flag in the build PR so the drift guard passes.

---

## 12. Dependencies & Sequencing

| Area (slug) | Relationship |
|---|---|
| `units-fleet` | Service Orders are **derived from unit** fields (`currentHours`, `purchaseHours`, `serviceCompletions`, `inspectionStatus`). Shop has no service entity without the unit. Must land first (shipped). |
| `invoicing-payments` | WO billing terminates on an invoice (`billWOToInvoice*`, `addWOToInvoice`, bill-once, locked-invoice guard). |
| `backend-data` | Persistence + diff-sync of WO/inspection/unit/part/vendor records; any new GAS action is additive on `backendCall`. |
| `design-system` | The yard data-plate language, flag-color system (§7 of `flag-color-system.md` defines the WO/unit/inspection flags), R-rulebook, WINDOW_CATALOG. |
| `financials-kpi` | Mechanic/M.Tech/Driver role KPIs (Healthy Fleet, WO Completion, Ready Rate, Wash Completion) read Shop data. |
| `rentals-dispatch` | A Field Call originates from a unit on an active rental; `unitCondLock` and the rental WO pill couple the two. |
| `gps-tracking` | **Phase 4 only** — telematics hour-meter sync to drive live countdowns. |

**Sequencing.** Phase 1 (front page + money gate + evidence) depends only on shipped areas → buildable now. Phase 2 (schedules) is standalone. Phase 3 (parts loop) needs the parts-FK decision (OQ-5) first. Phase 4 waits on `gps-tracking`.
