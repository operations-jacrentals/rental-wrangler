# JacRentals — Build List (phased) — live tracker

Master queue. Status flags: 🆕 new · 🔧 partial/refine (some shipped) ·
✅ shipped last session (verify, don't rebuild) · ❓ decision/define needed.
We walk this **task by task via poll**; decisions get recorded inline.

## Phase 0 — Carry-over ("cute items")
- 🆕 **Ask Mr. Wrangler** — Claude-API proxy so the app can call Claude (e.g. auto-suggest WO parts; the "Mr. Wrangler will add the parts for you" hook is already wired in copy).
- 🔧 **#9/#10 drag bugs** — awaiting Jac's repro (what was grabbed, where dropped, what happened). Overlaps Phase 3.

## Phase 1 — Navigation & Tabs
- 🆕 **Back buttons** — DECISION (Jac): hosted **per-card**, not global/tab. A back/forward **chevron** appears on a card *only* when that card has changed this session, and the chevrons walk **that card's own view history** (its sequence of records/views shown this session).
- 🔧 **Right-click → list view when anchored** — DECISION (Jac): right-click on a card = **equivalent to that card's Back chevron** (step that single card back one in its own history; works even in anchored-cascade mode).
- 🆕 **Anchoring creates a new item tab** — DECISION (Jac): tab strip already exists (above global search). Anchoring must **ALWAYS open a NEW tab** (duplicates allowed), freezing the current; only the tab **X** clears it. New tab **inherits the current cards' searches** (don't reset them). CODE: today `anchorRecord` overwrites the active tab via `Object.assign` → change to create+switch (like `openInNewTab`); per-card `ccs.backStack` already exists (feeds Task 1 chevrons); `setAnchor` currently clears cascaded-card searches (line ~777) → must preserve them for the new tab.
- 🆕 **Global Search + select opens a new tab** — DECISION (Jac): same model as anchoring — selecting a global-search result freezes the current session and opens a **new tab (foreground)**.
- 🆕 **Overtaking an open card → new tab** — DECISION (Jac): same model. Clicking an element whose standard view would overtake a card already open in standard (different record) freezes the session and opens a **new tab (foreground)** with the new card in standard view. Includes +Rental (new).

**Phase 1 cross-cutting:** new tabs always open **foreground (switch to it)**. One shared "freeze current session → makeTab → switch" code path serves anchor / search-pick / overtake / +Rental.

## Phase 2 — Rental Window & picker
- ✅ **Click-away should not force Save** — VERIFIED (Jac): `rentalFragile` rule (billed OR On/End/Off Rent/Returned) is correct. Normal = live-commit + click-away close; fragile = stage + explicit Save. Keep as-is.
- 🆕 **Clear vs Save buttons** — DECISION (Jac): **restyle only** (keep live-commit). Footer `Clear` becomes a primary **R17** button; `Save` (commit) appears just **left of Clear** only when a staged/fragile change exists (`wp.staged && winStagedChanged()`). Today Clear is `danger`-styled → change to R17.
- 🔧 **"Available" entry behavior + non-modal picker** — DECISION (Jac): make auto-entered "available" the **real structured token** (filtered through the picked window via `availWin`), not plain text. The picker becomes a **non-modal overlay, no modes**:
  - **On open** → default to the **Categories card, list view, availability lens** applied.
  - **Stays open** while interacting with the Units/Categories/Customers cards: category↔unit **toggles**, and **clicking a unit/cat/customer opens it in standard view** to inspect (learn before selecting). Selecting = **dragging** it into the rental (drag also keeps it open).
  - **Click-away** = any click *outside* those card interactions → closes the picker. (Implementation: click-away close skips clicks within `.card[data-card=units|categories|customers]`, the picker, and the trigger; drags never close it.)
- 🆕 **Center the picker pill** — DECISION (Jac): trivial style fix, center the left-aligned "Select a rental window" pill. No decision needed.
- 🆕 **Can't drag while the Rental Picker is open** — DECISION (Jac): ALLOW it. Today `dragDown` bails if `state.winpicker` is set (line ~4875) → let unit/customer/category drags arm & run while the picker is open; the drag must NOT trigger the click-away close. Core to the non-modal picker above.

## Phase 3 — Drag-to-link engine
- 🔧 **Dragging Customers/Rentals resets/closes the source card** — DECISION (Jac): **remove the mid-drag card-swap trick** (`startDrag` lines ~4928–4933 + `DRAG.restoreCols`/`swappedTo` + the `keepSwap` plumbing). Source card stays exactly as-is. Drop onto valid targets visible in OTHER columns; same-column links (customer↔invoice, which share the right column) use the **reverse drag direction**. Resolves the #9/#10 drag bug (no repro needed).
- 🆕 **Link by dragging empty space on a Standard View** — DECISION (Jac): a standard-view card becomes a drag SOURCE; grab **anywhere empty on the card** (body / padding / header), excluding interactive elements (buttons, pills, inputs, fields, links, rows). Payload = that card's open record. Drop side already handles standard-view cards.
- 🆕 **Drag the WO section onto an Invoice** — DECISION (Jac): make the WO section (`.section.wo-<woId>`) a drag SOURCE (entity `workOrders`, grab empty space per Task 2). Add `DROP_MATRIX.workOrders.invoices` (+ reverse `invoices.workOrders`); dropping on an invoice (row or open card) **bills immediately** via `billWOToInvoiceExplicit` (same bill-once + customer-scoping gates as the `+Invoice` / `js-bill-wo` button).

## Phase 4 — Invoices & Work Orders
- ✅ **+Invoice/+Transport opens the new invoice on the Invoice card** — shipped (`createInvoiceForRental`). VERIFY.
- ✅ **Delete empty records on click-away** — shipped (`sweepEmptyDrafts`, invoices + rentals). VERIFY.
- ✅ **(PAY) bottom-right of the Invoice section** — shipped. VERIFY.
- 🆕 **+WO from an Invoice opens the linked unit** — opens that invoice's currently-linked unit in standard view.

## Phase 5 — Search & filters
- ✅ **Replace persisting footer filters with search entries** — shipped ("dropped the modes"). VERIFY.
- 🆕 **Persist the orange glow behind Search while it's in use.**

## Phase 6 — Indicators (flags, flashes, comments, status)
- ✅ **Rulebook R4b + R9b** (which elements flash) — shipped. VERIFY.
- ✅ **Two flashes on linking** (was 3 → 2) — shipped. VERIFY.
- 🆕 **Comment feature: flash until toggled.**
- 🆕 **Active bar = tiered messages** — change the text per activity-% tier, not just "Active 92%."
- ✅ **Team KPI → one "Sulphur Team" row + ring layout matches role count** — shipped (Team KPI redesign + N-ring). VERIFY.

## Phase 7 — Layout, entry & open decisions
- 🆕 **Move Notes above the Funnel sections** (currently above account).
- ✅ **Equal-width +X buttons** — shipped (#12). VERIFY.
- 🆕 **Tabbed message convos, bottom-right.**
- 🔧 **History / logging audit** — Clear Unit + draft date now logged; review EVERY action type that should log and add what's missing.
- 🔧 **+Customer = Quick Add** — shipped (name + phone). Confirm it matches the "speed up logging a new rental" intent.
- 🆕 **Logins** — passwords managed in Settings (today: single shared password + admin gate).
- ❓ **DECISION:** Membership billing — monthly vs yearly.
- ❓ **DEFINE:** "Schedule Actions → Schedule?" — needs a spec.
