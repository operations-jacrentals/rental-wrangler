# JacRentals — Build List (phased) — live tracker

Master queue. Status flags: 🆕 new · 🔧 partial/refine (some shipped) ·
✅ shipped last session (verify, don't rebuild) · ❓ decision/define needed.
We walk this **task by task via poll**; decisions get recorded inline.

## Phase 0 — Carry-over ("cute items")
- 🆕 **Ask Mr. Wrangler** — Claude-API proxy so the app can call Claude (e.g. auto-suggest WO parts; the "Mr. Wrangler will add the parts for you" hook is already wired in copy).
- 🔧 **#9/#10 drag bugs** — awaiting Jac's repro (what was grabbed, where dropped, what happened). Overlaps Phase 3.

## Phase 1 — Navigation & Tabs
> ✅ **BUILT this session** (branch `claude/handoff-continuation-q442qm`): (a) one shared
> `openInTab` foreground-new-tab path now serves anchor / global-search pick / standard-view
> overtake — explicit +newtab/ctrl-click stays background; (b) a real per-card view-history
> engine (`backStack`/`fwdStack` — was a stub) with a stamped-steel back/forward **jog** in
> the standard header + list-bar; (c) single right-click = that card's Back. Gates green
> (smoke + rule-usage; the 20/21 logic failure is pre-existing on main). Pending Jac's
> live review.
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
- ✅ **+Invoice/+Transport opens the new invoice on the Invoice card** — shipped (`createInvoiceForRental`); CONFIRMED (Jac): working.
- ✅ **Delete empty records on click-away** — shipped (`sweepEmptyDrafts`, invoices + rentals); CONFIRMED (Jac): working.
- ✅ **(PAY) bottom-right of the Invoice section** — shipped (`payCell`); CONFIRMED (Jac): working.
- 🆕 **+WO from an Invoice opens the linked unit(s)** — DECISION (Jac): **repurpose** the invoice's existing `+WO` (today `js-add-line` kind `WO` adds a blank line — replace that). New behavior: open the invoice's **currently-linked unit(s) in LIST view** (Units card filtered to just those units), uniform for one or many — the list IS the picker; operator opens a unit and uses its own +Work Order. (Resolve linked units via the invoice's rental lines / `li.unitId`.)

## Phase 5 — Search & filters
- ✅ **Replace persisting footer filters with search entries** — shipped ("dropped the modes"). VERIFY.
- 🆕 **Persist the orange glow behind Search while it's in use** — DECISION (Jac): applies to **BOTH** the global top Search (`.searchwrap`, line 204) AND the per-card mini-search (`.mini-searchwrap`, line 230). "In use" = **any text typed OR any pinned filter term** (even an unsubmitted half-typed query) — glow stays even after focus leaves, clears only when emptied. Today the orange glow is `:focus-within`-only on `.searchwrap`; add a state class (e.g. `.has-query`) toggled on input/terms and give both wraps the same `box-shadow: 0 0 0 3px var(--accent-soft)` glow.

## Phase 6 — Indicators (flags, flashes, comments, status)
- ✅ **Rulebook R4b + R9b** (which elements flash) — shipped. VERIFY.
- ✅ **Two flashes on linking** (was 3 → 2) — shipped. VERIFY.
- 🆕 **Comment feature: flash until acknowledged (per-user)** — DECISION (Jac): a comment drops a **flashing colored marker** on the record AND still logs to History (today's behavior, `app.js:1338`). When entering the comment the user **picks a color — red / yellow / green** (the marker + flash use it). The marker flashes until the **viewing user has acknowledged/viewed** it; acknowledgment is **per-user** (NOT global) — store an `acknowledgedBy` user-id list on the comment so it's ready for the upcoming password/multi-user system (Phase 7 Logins). The comment/marker **stays** after acknowledgment (static colored marker, still readable) — only the flashing stops. Flashes again for any user who hasn't viewed it. NOTE: with a single shared user today, key the seen-state by the active user id so it carries forward when logins land.
- 🆕 **Active bar → bipolar "in pattern / out of pattern" gauge** — DECISION (Jac): replace the single `"X% Active"` label (`app.js:2615`, `activePct` 0–100) with a **two-directional bar centered at 0**, range **−100% … +100%**, tracking how long the customer is **in pattern** (right, positive) vs **out of pattern** (left, negative). Color sweep: **green (high +) → yellow (→0) → orange (just −) → red (deep −)**. Five labeled stages:
  - **Active** — +50% … +100% (green)
  - **Renting Soon** — 0% … +50% (yellow)
  - **Action Required** — 0% … −50% (orange)
  - **Inactive** — −50% … −80% (red)  *(Jac said −50→−100; the deep end is taken by Lost Customer below — confirm at build)*
  - **Lost Customer** — −80% … −100% (deep red)
  - OPEN (confirm at build): how ± % is computed from the customer's rental cadence — proposed: `activePct` derives from days-since-last-rental vs `_digest.avgFrequencyDays` (within window → positive share remaining; overdue → negative overage). Needs its own small spec.
- ✅ **Team KPI → one "Sulphur Team" row + ring layout matches role count** — shipped (Team KPI redesign + N-ring). VERIFY.

## Phase 7 — Layout, entry & open decisions
- 🆕 **Move Notes above the Funnel sections** — DECISION (Jac): on the **customer** card, render **filled** Notes directly under the title, ABOVE both funnel columns (`detail-cols`, `app.js:2649`); **empty** Notes keep their current bottom slot (above History) per R12. (Move `notes.top` ahead of `detail-cols`.)
- ✅ **Equal-width +X buttons** — shipped (#12). VERIFY.
- 🆕 **Tabbed message convos in the bottom tool bar** — DECISION (Jac): a tabbed conversation dock along the bottom tool bar, split by side:
  - **LEFT side = external** — Customer/Vendor chats **& emails** (threads per customer/vendor).
  - **RIGHT side = internal** — internal team/operator chats (keyed to the signed-in role/user).
  - Tabs open/minimize like chat heads. NOTE: external customer SMS/email needs a **backend messaging integration** (separate dependency); the internal side is self-contained.
- 🔧 **History / logging audit** — Clear Unit + draft date now logged; review EVERY action type that should log. DECISION (Jac): **log everything meaningful** — every state-changing action (creates, edits, links/unlinks, status changes, deletes) writes to History; skip only no-op/noise. Build-time: walk the §16 mutations block and ensure each path logs.
- ✅ **+Customer = Quick Add** — shipped (name + phone); CONFIRMED (Jac): name + phone is the right scope.
- 🆕 **Logins** — DECISION (Jac): role-based logins already exist (named roles, each with a password, Admin-managed in Settings via `manageLogins` `app.js:6189`; `currentRole` + switch-user). Scope = **mostly done**: VERIFY the flow, and **wire the per-user comment-acknowledgment (Phase 6) to the signed-in role**. (Per-individual accounts NOT needed now — roles are enough.)
- ✅ **DECISION:** Membership billing — RESOLVED (Jac): support **BOTH monthly and yearly** plans; the customer picks. (Ties into the membership funnel / account type.)
- 🆕 **Schedule Actions → make scheduled follow-ups actionable** — DECISION (Jac): Schedule already adds a dated follow-up to the customer Activity Log (`app.js:4211`, `6387`). Next: (1) **surface scheduled actions when due** — on a Today/agenda view or as a flash/reminder on the customer, not just sitting in the log; (2) **FUTURE NOTE** — scheduled actions ultimately point to a **Company Calendar / Sales Calendar** plus **graphs/dashboard**; the schedule is the feeder for that. (Calendar/dashboard = its own later phase.)
