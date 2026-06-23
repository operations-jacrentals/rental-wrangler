# Flag-Driven Color System — SPEC v1

**Date:** 2026-06-23  
**Status:** APPROVED (questions answered by Jac, ready to build)  
**Area branch:** `area/design-system`  
**Task branch:** `design-system/flag-color-system`  
**Scope:** All entities — Rentals, Units, WOs, Invoices, Customers

---

## 1. Goal

Replace the current descriptive status-color system (purple = Reserved, pink = Off Rent, brown = Returned…) with a **prescriptive, flag-driven 3-color system** that answers one question:

> *What do I need to do right now with this record?*

The color signals **urgency of required action**, not lifecycle position.

---

## 2. The Four Color States

| Color | Meaning | CSS var |
|---|---|---|
| **Red** | Action Required — something is blocking or overdue; act now | `--red` |
| **Yellow** | Action Needed — something needs attention, not yet critical | `--yellow` |
| **Green** | Nothing To Do — all clear; no open flags | `--green` |
| **Gray** | Archived / Retired — voided or cancelled; record-keeping only | `--gray` |

**Rules:**
- Orange (`--accent #ff7a1a`) is **reserved for brand/UI chrome only** — never a status color.
- Gray is **not** part of the R/Y/G evaluation. It is a hard terminal class applied to specific archived status values (see §6).
- When multiple flags are active, the **highest severity wins** for the pill color.
- In the hover preview, **all active flags are shown stacked**, sorted severity-desc.

---

## 3. Pill Behavior

The status pill **keeps its lifecycle status label** (e.g., "On Rent", "Reserved", "Part Ordered"). Only the color changes from the old static per-status color to the computed flag color.

```
Before:  [  Reserved  ]  ← purple (static, descriptive)
After:   [  Reserved  ]  ← yellow (computed, prescriptive — starts today flag active)
         [  Reserved  ]  ← red    (computed — unit failed inspection)
         [  Reserved  ]  ← green  (computed — nothing to do)
```

The flag label is **never shown inside the pill**. It is only surfaced in the hover preview (§5).

---

## 4. Flag Architecture

### 4.1 Flag Definition Shape

Each flag is defined in `FLAG_CATALOG` in `config.js`:

```js
{
  id: 'fc',                      // unique key within entity type
  label: 'Field Call',           // shown in hover preview
  severity: 'red',               // 'red' | 'yellow' | 'green'
  condition: (rec, ctx) => bool  // evaluated at render time
}
```

### 4.2 Context Object

Flag `condition` functions receive a `ctx` object alongside the record itself. `ctx` carries data the individual record doesn't contain but which flags need:

```js
ctx = {
  unitMap,         // Map<unitId, unitRecord> — for rental flags needing unit state
  customerMap,     // Map<customerId, customerRecord> — for rental/invoice flags
  openWOsByUnit,   // Map<unitId, WO[]> — for rental/unit flags needing WO state
  rentalsByUnit,   // Map<unitId, rental[]> — for overbooking detection
  invoicesByCustomer, // Map<customerId, invoice[]> — for pay-status flags
}
```

This context is assembled once at render time (already available in `app.js` render functions) and passed into evaluation.

### 4.3 Core Functions (new, to add to `app.js`)

```js
// Returns all active flags for a record, sorted severity-desc (red first)
function getEntityFlags(entityType, rec, ctx) → Flag[]

// Returns the color for the pill: 'red' | 'yellow' | 'green' | 'gray'
function getEntityColor(entityType, rec, ctx) → string

// Returns the CSS class for a computed color: 'c-red' | 'c-yellow' | etc.
function flagColorClass(entityType, rec, ctx) → string
```

`getEntityColor` checks terminal/archived status first (returns `'gray'`), then delegates to `getEntityFlags` and returns the highest severity found, defaulting to `'green'` if no flags fire.

---

## 5. Hover / Preview Behavior

**No change to the existing preview feature's trigger or layout.** The preview already shows on hover/tap for records in cards and rows. The only addition: when flags are active, the preview gains a **Flags section** above or below the existing content.

### 5.1 Flags Section in Preview

```
┌─────────────────────────────┐
│  Bamba Construction         │  ← entity name (unchanged)
│  On Rent · Jun 20–Jun 25    │  ← existing preview content
│  ─────────────────────────  │
│  🔴  Field Call             │  ← flag row (red dot + label)
│  🔴  Unpaid Balance         │  ← flag row
│  🟡  Service Due Soon       │  ← flag row
└─────────────────────────────┘
```

- Flags listed in severity order: red first, then yellow.
- No flags → no Flags section in preview (Green items show the existing preview as-is).
- Gray (archived) items: existing preview shows normally; no flags section (flags don't evaluate for archived records).

### 5.2 Flag Dot Colors

Use the existing `.c-red` / `.c-yellow` pill-dot pattern or a small colored indicator (design-system pass will finalize exact rendering per `/jactec-ui`). The label is the flag's `label` string.

---

## 6. Terminal & Archived State Handling

### 6.1 Archived (Gray) — Triggered by Completion Action, Not Status

Gray is **not** automatically assigned by a status value. It fires when a record has been **formally completed** by a user action. Until that action fires, even voided/returned records stay in R/Y/G.

**Rental records:** Gray fires when `r.completed === true`. The "Complete Rental" button in the rental detail (available once all units reach a terminal status: Returned, Cancelled, or No Show) sets `r.completed = true`. Code reference: `app.js:10264–10272`.

| Entity | Gray condition |
|---|---|
| Rentals | `r.completed === true` (set by "Complete Rental" button; available only when `allUnitsTerminal(r)`) |
| Invoices | `invoiceStatus === 'Refunded'` |
| WOs | *(none — WOs don't have a separate archive step; Complete is Green)* |
| Units | *(none — fleet status colors handled separately; see §6.3)* |

**`getEntityColor` short-circuits to `'gray'`** when the archived condition is met. No flag evaluation runs for archived records.

### 6.2 Pre-Completion Terminal States (Always R/Y or Red)

Rentals in terminal lifecycle positions (`Returned`, `Cancelled`, `No Show`) that have **not yet been completed** (`r.completed === false/undefined`) are never Green. They are Yellow at minimum because a completion action is still required.

| Rental Status | Default pre-completion color | Red override condition |
|---|---|---|
| `Returned` | Yellow (`complete-rental` flag fires) | Unpaid balance, FC, or other Red flags |
| `Cancelled` | Yellow (`complete-rental` flag fires) | Unpaid balance or other Red flags |
| `No Show` | Yellow (`complete-rental` flag fires) | Unpaid balance or other Red flags |

The `complete-rental` flag condition: `allUnitsTerminal(rec) && !rec.completed`

After `r.completed = true` → Gray (see §6.1).

### 6.3 Fleet Status — All Enter R/Y/G

All unit fleet statuses (Purchased, Onboard, Active, Inactive, For Sale, Sold) enter the flag evaluation system. Static per-status colors (navy, blue, gray, etc.) for fleet status are **retired**. The pill still shows the fleet status label; the color is computed from flags.

For non-operational fleet statuses (Sold, For Sale, Inactive), most operational flags will not fire (e.g., overbooked cannot fire if the unit isn't available), so they typically default to Green.

### 6.4 Other Terminal States

| Status | Color treatment |
|---|---|
| WO `Complete` | Green (unless `bill-maybe` flag fires → Yellow) |
| Invoice `Paid` | Green (no flags fire for Paid) |
| Invoice `Refunded` | Gray (archived) |

---

## 7. Flag Catalog — Default Rules

All conditions are **evaluated at render time** against live record + ctx data.  
Severity column: 🔴 = red, 🟡 = yellow.

---

### 7.1 Rentals

| id | Label | Sev | Condition |
|---|---|---|---|
| `fc` | Field Call | 🔴 | An open WO of type `Field Call` is linked to this rental's unit |
| `overbooked` | Overbooked | 🔴 | Same unit has another active rental overlapping this window |
| `unpaid-balance` | Unpaid Balance | 🔴 | Customer's payStatus is `Unpaid` |
| `no-card` | No Card | 🔴 | Customer has no payment method on file |
| `unsigned-card` | Unsigned Card | 🔴 | Card on file but not yet signed |
| `unit-failed` | Unit Failed Inspection | 🔴 | The rented unit's `unitInspectionStatus` is `Failed` |
| `off-rent-overdue` | Overdue Return | 🔴 | Rental status is `Off Rent` (window ended, unit not yet back) |
| `starts-today` | Starts Today | 🟡 | Status is `Reserved` and start date is today |
| `starts-tomorrow` | Starts Tomorrow | 🟡 | Status is `Reserved` and start date is tomorrow |
| `end-rent` | Returning Today | 🟡 | Status is `End Rent` (final day of rental window) |
| `unit-due-soon` | Service Due Soon | 🟡 | Rented unit's `serviceStatus` is `due-soon` |
| `partial-payment` | Partial Payment | 🟡 | Customer's payStatus is `Partial` |
| `card-expiring` | Card Expiring | 🟡 | Payment card expires within 30 days |
| `complete-rental` | Complete Rental | 🟡 | `allUnitsTerminal(rec) && !rec.completed` — all units are terminal but the rental hasn't been formally archived yet. Fires for Returned, Cancelled, and No Show alike. |

**Note on derived statuses:** The old derived statuses `Today` and `Tomorrow` are retired as distinct status values. The status remains `Reserved`; the `starts-today` and `starts-tomorrow` flags carry the urgency signal. The displayed pill still reads `Reserved`.

**Note on `complete-rental`:** This flag fires for ALL terminal-status rentals (Returned, Cancelled, No Show) that haven't been completed. It ensures no rental is ever Green before it's formally archived. Red overrides Yellow if other critical flags (unpaid, FC, etc.) also fire.

---

### 7.2 Units

| id | Label | Sev | Condition |
|---|---|---|---|
| `inspection-failed` | Failed Inspection | 🔴 | `unitInspectionStatus` is `Failed` |
| `service-past-due` | Service Past Due | 🔴 | `serviceStatus` is `past-due` |
| `overbooked` | Overbooked | 🔴 | Unit has two or more active rentals simultaneously |
| `gps-offline` | GPS Offline | 🔴 | `gpsStatus` is `Not Reporting` |
| `inspection-not-ready` | Not Ready | 🟡 | `unitInspectionStatus` is `Not Ready` |
| `service-due-soon` | Service Due Soon | 🟡 | `serviceStatus` is `due-soon` |
| `wash-requested` | Wash Requested | 🟡 | `washRequested` flag is true |
| `gps-verify` | GPS Verify | 🟡 | `gpsStatus` is `Verify` |

---

### 7.3 Work Orders

| id | Label | Sev | Condition |
|---|---|---|---|
| `part-needed` | Part Needed | 🔴 | `woPhase` is `Part Needed` (blocking — can't start work) |
| `field-call` | Field Call | 🔴 | `woType` is `Field Call` |
| `failed-origin` | From Failed Inspection | 🔴 | `woType` is `Failed` |
| `no-lines` | No Line Items | 🔴 | WO has zero line items (stale/incomplete) |
| `part-unknown` | Part Needed? | 🟡 | `woPhase` is `Part Needed?` (decision pending) |
| `part-ordered-no-eta` | No ETA | 🟡 | `woPhase` is `Part Ordered` with no ETA date set |
| `part-ordered-eta` | ETA: [date] | 🟡 | `woPhase` is `Part Ordered` with ETA date set |
| `part-local` | Pick Up Part | 🟡 | `woPhase` is `Part is Local` |
| `bill-maybe` | Bill Customer? | 🟡 | `billCustomer` is `Maybe` |

**WO Green states** (no flags fire): `No Part Needed`, `Part in Stock`, `Complete`.

---

### 7.4 Invoices

| id | Label | Sev | Condition |
|---|---|---|---|
| `unpaid` | Unpaid | 🔴 | `invoiceStatus` is `Unpaid` |
| `late` | Late | 🔴 | `invoiceStatus` is `Late`, `Late+30`, `Late+60`, or `Late+90` |
| `collections` | Collections | 🔴 | `invoiceStatus` is `Collections` |
| `partial` | Partial Payment | 🟡 | `invoiceStatus` is `Partial` |
| `not-due` | Balance Due | 🟡 | `invoiceStatus` is `Not Due` (balance exists, due date not yet passed) |
| `unreconciled` | Unreconciled | 🟡 | `expenseReconcile` is `Unreconciled` |

**Invoice Green states:** `Paid`. Archived: `Refunded` (gray).

---

### 7.5 Customers

| id | Label | Sev | Condition |
|---|---|---|---|
| `unpaid-balance` | Unpaid Balance | 🔴 | `customerPayStatus` is `Unpaid` |
| `blacklisted` | Blacklisted | 🔴 | `customerAccountType` is `Blacklisted` |
| `no-card` | No Card | 🔴 | No payment method on file |
| `customer-lost` | Lost | 🔴 | ACT_STAGE is `Lost` (>100% past expected cadence) |
| `customer-inactive` | Inactive | 🔴 | ACT_STAGE is `Inactive` (50–100% past expected cadence) |
| `partial-balance` | Partial Balance | 🟡 | `customerPayStatus` is `Partial` |
| `member-incomplete` | Member Incomplete | 🟡 | `customerAccountType` is `Member Incomplete` |
| `action-required` | Action Required | 🟡 | ACT_STAGE is `Action Required` (25–50% past cadence) |
| `check-in` | Due for Check-In | 🟡 | ACT_STAGE is `Check-in` (0–25% past cadence) |
| `card-expiring` | Card Expiring | 🟡 | Payment card expires within 30 days |

---

## 8. Settings UI — PARKED

The Settings UI panel that lets Admins toggle flags on/off or adjust severity is **explicitly deferred**. The flag catalog in §7 ships as hardcoded defaults in `config.js`. No runtime configuration for v1.

When Settings UI is built (future spec), the shape will be:
- Per entity type: list of flag definitions
- Per flag: toggle (on/off) + severity override (Red → Yellow or off)
- Stored in a backend GAS config Sheet; loaded at boot alongside other config

---

## 9. What Does NOT Change

- **Pill label** — always the lifecycle status name. Flag labels do not appear in pills.
- **Hover trigger** — no change to what element triggers the preview or how it opens.
- **Preview layout** — existing preview content is untouched. Flags section is additive.
- **WO bottleneck summary** — the existing severity-based WO header color logic is superseded by the new `getEntityColor` function (same output, unified source).
- **R-Rulebook** — any new UI elements (flag rows, dot indicators) get `data-r` stamps. `rule-usage.js` regenerated after implementation.
- **WINDOW_CATALOG** — no new popup windows in v1; catalog unchanged.

---

## 10. Migration Map — Old Colors → New

| Old status | Old color | New color (default, no flags) | Overrides |
|---|---|---|---|
| Quote | gray | green | Red if no-card, overbooked |
| Reserved | purple | green | Red/yellow per flag |
| Today (derived) | blue | **retired** — Reserved + starts-today flag (🟡 yellow) | |
| Tomorrow (derived) | purple | **retired** — Reserved + starts-tomorrow flag (🟡 yellow) | |
| On Rent | green | green | Red if fc, overbooked, unpaid, etc. |
| End Rent | yellow | **always yellow** (end-rent flag always fires) | Red if fc, unpaid, etc. |
| Off Rent | pink | **always red** (off-rent-overdue flag always fires) | |
| Returned | brown | **yellow** (complete-rental flag fires until `r.completed`) | Red if unpaid, fc, etc. |
| Cancelled | orange | **yellow** (complete-rental flag fires until `r.completed`) | Red if unpaid, etc. |
| No Show | orange | **yellow** (complete-rental flag fires until `r.completed`) | Red if unpaid, etc. |
| *(any, after completion)* | — | **gray** (`r.completed === true`) | — |

---

## 11. Build Checklist

- [ ] Add `FLAG_CATALOG` to `config.js` with all §7 flags
- [ ] Add `archived: true` to `STATUS_META` for Cancelled, No Show, Refunded
- [ ] Implement `getEntityFlags(entityType, rec, ctx)` in `app.js`
- [ ] Implement `getEntityColor(entityType, rec, ctx)` in `app.js`
- [ ] Build `ctx` assembly helper (or inline at each render site) with unitMap, customerMap, openWOsByUnit, rentalsByUnit, invoicesByCustomer
- [ ] Update `statusPill()` to use `getEntityColor` instead of static `STATUS_META.color`
- [ ] Update preview render to include Flags section (active flags stacked, severity-sorted)
- [ ] Retire `Today` and `Tomorrow` as distinct derived status values (fold into Reserved + flags)
- [ ] Stamp new UI elements with `data-r` — regenerate `rule-usage.js`
- [ ] Run all CI gates: `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`
- [ ] Local area test: serve on `localhost:9147`, exercise all 5 entity types, verify colors + hover flags

---

## 12. Open Questions / TBDs

All questions locked via Jac (2026-06-23). No open TBDs.

| # | Question | Answer |
|---|---|---|
| 1 | `End Rent` always Yellow? | ✅ Always Yellow — end-rent flag always fires |
| 2 | `Off Rent` always Red? | ✅ Always Red — off-rent-overdue flag always fires |
| 3 | `complete-rental` trigger? | ✅ `r.completed` boolean (`app.js:10264–10272`); fires when `allUnitsTerminal(r) && !r.completed` |
| 4 | `card-expiring` threshold? | ✅ 30 days |
| 5 | ACT_STAGE `Inactive` — Red or Yellow? | ✅ Red (action required) |
| 6 | Fleet statuses in R/Y/G? | ✅ All fleet statuses enter R/Y/G; static colors retired |
