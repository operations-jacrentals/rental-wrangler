# Pill / Button / Text Rulebook — App-Wide Application Spec

**Goal:** apply the new tier/color/text/motion rulebook to the *real app* (→ `area/design-system` → staging). **Textures are NOT part of this.**

**The cascade principle:** every visible element comes from one stamped builder (R0–R25). So we decide the treatment **once per builder**, and it lands on every instance — rows, detail sections, mini-cards, calendars, popups, boards — automatically. No per-screen decisions needed beyond the builder map below.

---

## Part A — The rules (decide once)

**A1 · Tiers (visual weight).**
- **Primary** — the one state/action the user advances on a surface. Solid fill, white ink. Red/yellow = hazard-striped (lighter charcoal `#14181d`). Parent-record icon. Chevron if it opens a menu.
- **Secondary** — supporting status/action. Outline, colored text (R/Y/G). Red/yellow = striped border (matches primary stripe). Parent icon. Hover → solid border.
- **Ghost / flag** — low-emphasis state, flag, or link. Parent icon + colored text, underline on hover; red/yellow = hazard underline.
- **Add** — create/link a record. Solid **blue** border (secondary style), `+Thing`.
- **Disabled** — checkerboard.

**A2 · Color = meaning (unchanged registry, one muting).** green = ready/done **(muted `#358a5d`, stays quiet — "nothing to do")** · yellow = caution/attention · red = danger/overdue · blue = commit/link/reserved · purple = scheduled/member · orange = ignition/selected/linked. White ink on green & yellow primaries.

**A3 · Type scale.** Title (record name) · Section (section header) · Label (field label) · Body (content) · Small (caption). Maps to the existing Saira-stamped / Geist-body split — no new fonts.

**A4 · Motion by date-proximity.** Any date-bearing element: **today = stripes scroll + glow-behind · ±1 day = scroll · 3+ days = static.** Respects reduced-motion.

**A5 · Icon = parent record's icon** on every status element and ghost link (unit category, customer person, invoice, WO wrench, etc.).

**A6 · One focal Primary per container (THE tier rule).** Exactly one **focal element** per *section / list-row / mini-card / mini-calendar* is **Primary** — the single status the user advances **or** the one action to take there (status OR action, whichever the container exists for; designated per container). Every other interactive element is **Secondary**; flags & quiet links are **Ghost**. A detail view therefore has *multiple* Primaries (one per section) — that's correct. Read-only badges that merely report are **never** the focal slot → Secondary. **Urgency is shown by color + motion, never by promoting something to Primary** (an overdue/No-Card exception glows/scrolls in place; it does not steal the focal slot). The calendar's focal Primary = the **today cell** (or the selected date).

---

## Part B — Builder → treatment map (THE cascade table)

This is the whole spec in one table. Change each builder once → it cascades everywhere.

| R | Builder | Today | New treatment | Motion? |
|---|---|---|---|---|
| **R1** | `gatePill` (advance dropdown — rental/WO/fleet/invoice/funnel/bill status) | status-color pill + chevron | **PRIMARY** — solid, white ink, status color, striped red/yellow, chevron, parent icon | ✅ when date-bound (On Rent→due, Late, etc.) |
| **R3** | `statusPill` (read-only status badge) | colored fill pill | **SECONDARY** — outline + colored text + parent icon | ✅ when date-bound |
| **R3b** | `badge` (plain fact "480 HRS") | gray chip | *unchanged* (facts aren't status) | — |
| **R4 / R4b** | `dPill` (derived pill riding parent) | ink+icon | *unchanged*; parent icon; R4b pulse → **glow-behind** | ✅ (R4b) |
| **R2** | `refPill` (linked record) | orange outline | *unchanged* — keep the "orange = linked" law (NOT folded into R/Y/G) | — |
| **R5b** | `addBtn(link/line)` | **blue dashed** | **ADD** — **solid** blue border | — |
| **R5c** | `addBtn()` (empty field) | gray dashed | *unchanged* (it's a field, not an action) | — |
| **R6** | `reqBtn` (required) | white loud | *unchanged* | — |
| **R7** | `linkName` (hyperlink) | blue italic underline | **GHOST-link** — parent icon + text + underline (folds flags & links into one ghost look) | — |
| **R8** | `kv({derived})` | italic | **Body/Small** italic (type scale) | — |
| **R9 / R9b** | `flagEl` (title flags) | mini stacked flags | **GHOST/flag** — parent icon + colored text; red/yellow hazard underline; R9b pulse → **glow-behind** | ✅ date flags (Starts Today, Returning Today, Overdue) |
| **R10** | `.c-titlecard` | dark chip | **Title** type; record icon | — |
| **R11** | `.section` | status-tinted header+border | header = **Section** type; border = status color (muted green) | — |
| **R12** | `notesSection` | boxless | **Body** type | — |
| **R13** | `historySection` | count chips + log | chips = **Secondary**; links = **Ghost**; Label/Small type | — |
| **R14** | `segCtl` (3-state toggle: condition/wash/transport) | segmented | selected segment = **Primary color fill**; others quiet | — |
| **R15** | `yardToolHtml` (journey) | timeline nodes | nodes = add/ghost; status color per node; **Section/Label** text | ✅ a node due today |
| **R16** | `winPickerEl` (rental calendar) | month grid | **today cell glows; in-window = status color; selected = orange; unavailable = red** | ✅ today cell |
| **R17** | `actionPill` (commit/money/danger) | blue/green/red | the prominent action = **PRIMARY** (intent color, solid); danger red = striped + motion when urgent; lesser actions = Secondary | ✅ urgent danger |
| **R18** | `ghostPill` (quiet action) | muted | **GHOST** (no parent icon — it's an action, not a record) | — |
| **R22** | `dateField` (date picker) | calendar | today cell glows; same calendar treatment as R16 | ✅ today cell |
| **R24** | `closeX` | red ✕ | *unchanged* | — |
| **R25** | sync banner | red hazard cap | *unchanged* (already the signature) | — |

R0 (lint), R19 (attn-flash), R20 (ctx menu), R21 (file-drop), R23 (tooltip) — **no change**.

---

## Part C — Applied per surface (verification the table covers everything)

**List rows (every card):** headline status (R1/R3) → Primary/Secondary; flags (R9) → ghost; refs (R2) → orange; facts (R3b) → gray; date-bound overdue/late → motion. *Covered by R1/R3/R9/R3b/R2.*

**Units detail:** Yard tool (R15), Condition/Wash (R14), WO sections (R1 gates→Primary, R5b adds, R17 actions), Specs/GPS/Investment (R5c/R8/R3→Secondary, R1 fleet gate→Primary), Notes (R12), History (R13). *Covered.*

**Rentals detail:** Status gate (R1→Primary), Customer/Invoice pills (R2 orange), balance (R8), calendar (R16 motion), unit rows (R2/R4/R8), transport rail (R15/R14), Complete/Cancel (R17 Primary/danger), notes/history. *Covered.*

**Customers detail:** account fields (R5c), account-type/agreement status (R3→Secondary), PO/protection facts (R3b), funnel gates (R1→Primary), cards-on-file (R3/R17), activity chart (no rule — left as-is), notes/history. *Covered.*

**Invoices detail:** status gate (R1→Primary), customer link (R2), line links (R7→ghost), totals (R8), pay/charge/refund (R17 money/danger), notes/history. *Covered.*

**Shop (WO / Service / Inspection):** phase gates (R1→Primary, striped when red/yellow + motion on ETA), flags (R9 ghost), adds (R5b), Complete/Cancel (R17), inspection result (R3→Secondary or R14 toggle), bill-customer gate (R1→Primary), service countdown (R8 + motion when due). *Covered.*

**Mini / member cards (R10 + abbreviated):** title chip = Title; the one headline status = Primary; rest Secondary/ghost. *Covered by tier rules.*

**Calendars (R16 window + R22 date picker):** today glow, in-window status color, selected orange, unavailable red, near-term scroll. *Covered.*

**KPI ring tiles:** band color keeps registry; ≥95% halo stays; Label type. *Covered (color/type only).*

**Back-office boards (Parts/Vendors/Expenses/Files):** same builders → inherit automatically. *Covered.*

---

## Part D — Decisions (LOCKED 2026-06-30)

1. **Tier rule = one focal Primary per container** (A6). Focal = the status the user advances **or** the one action — designated per container. All other interactive = Secondary; flags & quiet links = Ghost. Multiple Primaries across a detail view (one per section) is correct.
2. **Read-only status (R3)** = **Secondary outline** by default; it's only Primary when it IS the section's designated focal element.
3. **Motion = full** — date-proximity motion runs in **rows AND detail** (overdue/late, service-due, payment-due, scheduled follow-ups, and date flags like Starts/Returning Today).
4. **Hyperlinks stay separate** — R7 hyperlinks remain blue-italic-underline; **only R9 flags** adopt the ghost look. (No fold.)
5. **Urgency = color + motion, never tier promotion.** **Calendar focal = today cell.** **Green muted** (`#358a5d`); white ink on green/yellow Primary; red/yellow striped with charcoal `#14181d`; Secondary stripe matches Primary; striped Secondary → solid border on hover.

## Part E — Delivery

Updated **R-Rulebook (R0–R25)** = builders re-treated per Part B + `RULE_META` / `RB_FOUNDATION` / `RB_TABS` text refreshed + `rule-usage.js` regenerated + admin Rulebook overlay updated. Branch **`area/design-system`** → CI gates green (`smoke`, `logic-test`, `gen-rule-usage --check`, `check-window-catalog`, `check-design-md`, code-map) → **`staging`** → **`main`**. Textures/skinner excluded.
