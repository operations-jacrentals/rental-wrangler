# JacRentals — Build List (phased) — live tracker

Master queue. Status flags: 🆕 new · 🔧 partial/refine (some shipped) ·
✅ shipped last session (verify, don't rebuild) · ❓ decision/define needed.
We walk this **task by task via poll**; decisions get recorded inline.

## 📱 MOBILE (adaptive reflow) — ✅ M0–M3 SHIPPED + LIVE (2026-06-14)
Spec: `docs/superpowers/specs/2026-06-14-mobile-adaptive-design.md`. Field-ready goal; desktop untouched.
- **M0** — responsive columns 3→2→1 by width; viewport meta → device-width; body never side-scrolls; `is-phone`/`is-narrow` classes.
- **M1** — swipe between columns (scroll-snap) + 3-dot indicator; phone-only per-column bottom strips: Yard→internal chat · Rentals→tool bar · Customers→external-chats **shell** (awaits messaging backend).
- **M2** — drag on touch: dwell at L/R edge switches columns mid-drag; **bottom edge = start-a-chat** drop zone (cancel-arc hidden on phone).
- **M3** — touch gesture model: hold-still→context menu, horizontal→drag, vertical→scroll, tap→action (`openCtxMenuAt` shared mouse/touch). Desktop right-click unchanged.
- ⬜ Optional follow-ups (not built, "functional" scope): touch haptics, per-screen polish passes, external-chat backend.

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
> ✅ **BUILT + LIVE this session**: Clear footer button → R17 commit primary (was danger);
> Save still shows just left of Clear only on a staged change. Picker prompt centered.
> Picker is now NON-MODAL — drags arm while it's open (drag a unit/category into the
> rental), it stays open while working Units/Categories/Customers and closes only on a
> click truly outside them; opening it reveals Categories (list) + the availability lens.
> The "available" structured token was already shipped. Gates green.
- ✅ **Click-away should not force Save** — VERIFIED (Jac): `rentalFragile` rule (billed OR On/End/Off Rent/Returned) is correct. Normal = live-commit + click-away close; fragile = stage + explicit Save. Keep as-is.
- 🆕 **Clear vs Save buttons** — DECISION (Jac): **restyle only** (keep live-commit). Footer `Clear` becomes a primary **R17** button; `Save` (commit) appears just **left of Clear** only when a staged/fragile change exists (`wp.staged && winStagedChanged()`). Today Clear is `danger`-styled → change to R17.
- 🔧 **"Available" entry behavior + non-modal picker** — DECISION (Jac): make auto-entered "available" the **real structured token** (filtered through the picked window via `availWin`), not plain text. The picker becomes a **non-modal overlay, no modes**:
  - **On open** → default to the **Categories card, list view, availability lens** applied.
  - **Stays open** while interacting with the Units/Categories/Customers cards: category↔unit **toggles**, and **clicking a unit/cat/customer opens it in standard view** to inspect (learn before selecting). Selecting = **dragging** it into the rental (drag also keeps it open).
  - **Click-away** = any click *outside* those card interactions → closes the picker. (Implementation: click-away close skips clicks within `.card[data-card=units|categories|customers]`, the picker, and the trigger; drags never close it.)
- 🆕 **Center the picker pill** — DECISION (Jac): trivial style fix, center the left-aligned "Select a rental window" pill. No decision needed.
- 🆕 **Can't drag while the Rental Picker is open** — DECISION (Jac): ALLOW it. Today `dragDown` bails if `state.winpicker` is set (line ~4875) → let unit/customer/category drags arm & run while the picker is open; the drag must NOT trigger the click-away close. Core to the non-modal picker above.

## Phase 3 — Drag-to-link engine
> ✅ **BUILT + LIVE this session**: removed the mid-drag card-swap trick (source card
> stays put; same-column links use the reverse drag direction via the bidirectional
> matrix); a STANDARD-view card is now a drag source (grab its empty space → its open
> record); the WO section is a drag source that bills straight onto an invoice
> (DROP_MATRIX workOrders↔invoices → billWOToInvoiceExplicit). Verified: WO→invoice
> billing + source resolution. Gates green.
> NOTE (also done): **Phase 1 follow-up** — overtake now seeds the new tab's card
> history so the Back/forward jog walks the whole overtake chain (C→B→A) in place.
- 🔧 **Dragging Customers/Rentals resets/closes the source card** — DECISION (Jac): **remove the mid-drag card-swap trick** (`startDrag` lines ~4928–4933 + `DRAG.restoreCols`/`swappedTo` + the `keepSwap` plumbing). Source card stays exactly as-is. Drop onto valid targets visible in OTHER columns; same-column links (customer↔invoice, which share the right column) use the **reverse drag direction**. Resolves the #9/#10 drag bug (no repro needed).
- 🆕 **Link by dragging empty space on a Standard View** — DECISION (Jac): a standard-view card becomes a drag SOURCE; grab **anywhere empty on the card** (body / padding / header), excluding interactive elements (buttons, pills, inputs, fields, links, rows). Payload = that card's open record. Drop side already handles standard-view cards.
- 🆕 **Drag the WO section onto an Invoice** — DECISION (Jac): make the WO section (`.section.wo-<woId>`) a drag SOURCE (entity `workOrders`, grab empty space per Task 2). Add `DROP_MATRIX.workOrders.invoices` (+ reverse `invoices.workOrders`); dropping on an invoice (row or open card) **bills immediately** via `billWOToInvoiceExplicit` (same bill-once + customer-scoping gates as the `+Invoice` / `js-bill-wo` button).

## Phase 4 — Invoices & Work Orders
> ✅ **BUILT + LIVE this session**: the Invoice **+WO** button now opens the invoice's
> LINKED unit(s) in a filtered Units list (transient `state.unitPick`, removable chip) —
> the list IS the picker; the operator opens a unit and uses its own + Work Order. The
> other three Phase 4 items were already shipped/confirmed. Verified. Gates green.
- ✅ **+Invoice/+Transport opens the new invoice on the Invoice card** — shipped (`createInvoiceForRental`); CONFIRMED (Jac): working.
- ✅ **Delete empty records on click-away** — shipped (`sweepEmptyDrafts`, invoices + rentals); CONFIRMED (Jac): working.
- ✅ **(PAY) bottom-right of the Invoice section** — shipped (`payCell`); CONFIRMED (Jac): working.
- 🆕 **+WO from an Invoice opens the linked unit(s)** — DECISION (Jac): **repurpose** the invoice's existing `+WO` (today `js-add-line` kind `WO` adds a blank line — replace that). New behavior: open the invoice's **currently-linked unit(s) in LIST view** (Units card filtered to just those units), uniform for one or many — the list IS the picker; operator opens a unit and uses its own +Work Order. (Resolve linked units via the invoice's rental lines / `li.unitId`.)

## Phase 5 — Search & filters
> ✅ **BUILT + LIVE this session**: the orange glow now PERSISTS on both the global
> Search and the per-card mini-search whenever they hold typed text or a pinned term
> (clears only when emptied) via a `.has-query` class. The "footer filters → search
> entries" item was already shipped (verified — the search/filter system works). Gates green.
- ✅ **Replace persisting footer filters with search entries** — shipped ("dropped the modes"). VERIFY.
- 🆕 **Persist the orange glow behind Search while it's in use** — DECISION (Jac): applies to **BOTH** the global top Search (`.searchwrap`, line 204) AND the per-card mini-search (`.mini-searchwrap`, line 230). "In use" = **any text typed OR any pinned filter term** (even an unsubmitted half-typed query) — glow stays even after focus leaves, clears only when emptied. Today the orange glow is `:focus-within`-only on `.searchwrap`; add a state class (e.g. `.has-query`) toggled on input/terms and give both wraps the same `box-shadow: 0 0 0 3px var(--accent-soft)` glow.

## Phase 6 — Indicators (flags, flashes, comments, status)
> ✅ **BUILT + LIVE this session**: (a) **bipolar Active gauge** (−100…+100, cadence-relative
> per Jac's spec: +100% just-rented → 0 at avgFrequencyDays → −100% at 2× overdue) with five
> stages Active/Renting Soon/Action Required/Inactive/Lost Customer on a steel data-plate;
> (b) **colored comments** — composer with red/yellow/green swatches; a marker that FLASHES
> until the viewing user opens the record (per-user ack on currentUser, already wired to the
> signed-in user → Phase 7 "Logins" comment-ack item DONE), resting on the most-urgent unread
> color; still logs to History. Verified per-user flow + UI. Gates green.
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
> **Progress this session** — ✅ LIVE: Notes moved above the funnels; Logins comment-ack
> wired to the signed-in user (done in Phase 6); History/logging audit (funnel moves +
> interested-category removal now log). ✅ already settled: +Customer Quick Add, Membership
> monthly+yearly. ⬜ REMAINING: **Schedule → surface when due** (+ the future Company/Sales
> Calendar + dashboard it feeds); **Tabbed message dock** — internal side buildable now, the
> external customer/vendor SMS/email side is BLOCKED on a backend messaging integration that
> doesn't exist in this repo.
- 🆕 **Move Notes above the Funnel sections** — DECISION (Jac): on the **customer** card, render **filled** Notes directly under the title, ABOVE both funnel columns (`detail-cols`, `app.js:2649`); **empty** Notes keep their current bottom slot (above History) per R12. (Move `notes.top` ahead of `detail-cols`.)
- ✅ **Equal-width +X buttons** — shipped (#12). VERIFY.
- 🆕 **Tabbed message convos in the bottom tool bar** — DECISION (Jac): a tabbed conversation dock along the bottom tool bar, split by side:
  - **LEFT side = external** — Customer/Vendor chats **& emails** (threads per customer/vendor).
  - **RIGHT side = internal** — internal team/operator chats (keyed to the signed-in role/user).
  - Tabs open/minimize like chat heads. NOTE: external customer SMS/email needs a **backend messaging integration** (separate dependency); the internal side is self-contained.
  - 🆕 **INTERNAL side — enriched concept (Jac, 2026-06-14):** the internal chat is a **live feed of the Phase-6 record comments** ("what's flagged"), repliable. Layered on top:
    - (a) **role buttons along the bottom** — toggle a role to include/exclude them from the conversation;
    - (b) **taggable elements** — pull records (units/customers/rentals/WOs/invoices…) INTO a chat; add/remove them so **one thread persists while jumping task to task** (the conversation carries its own mutable context set). The tagged items render as **TABS in a rail that floats across the TOP of the chat, each in its selected color** (red/yellow/green).
    - (c) **comment card** (the composer) = a SIMPLE color-flooded sticky note — traffic-light dots pick the color, the card floods solid, selected dot glows with a white ring. ✅ BUILT + LIVE.
    - ✅ **v1 BUILT + LIVE (§17):** launcher in the bottom bar (unread badge) → floating dock; live flagged-comment FEED (+ team messages), the colored TAGGED-element rail up top (add by **dragging a record** into the dock — wired into the §15c drag engine — remove with ×), ROLE toggle buttons (on = in the chat), compose bar (Enter sends). Verified drag-to-tag end to end.
    - ✅ **GRANULAR DRAG + DROP PAD BUILT + LIVE (Jac, 2026-06-14):** elements marked `[data-chat-el]` (label/color/ref) arm a **chat-tag drag** (tap unaffected; drag/long-press tags) — disambiguation is free because the drag engine already excludes granular elements from record links. A **"drop to start a chat" PAD** (cancel-arc sibling) pins bottom-right during a drag when the dock is closed (steel + tan saddle-stitch + hazard edge + stamp; hot = orange ignition glow). Drop a record OR a granular element → new chat seeded with it. **All four element types stamped + live:** status badges (statusPill), people/links (refPill + unitPill), prices (rental rate + invoice balance), line items (invoice rental lines). **+ categories & services:** `categories`+`serviceOrders` added to DRAG_SOURCES (rows/cards chat-draggable, NOT in DROP_MATRIX so chat-only); category pill (inline) + dPill (R4 derived pills) stamped. **CLICK-THROUGH VERIFIED on live site (2026-06-14):** rate, line item, invoice balance, status badge, category row, and service row all drag → pad → new chat with correct refs. **Service fix:** shop rows render `data-card="shop"`, so dragSourceAt now resolves them via the pinned `cards.shop.segment` (services drag on the Service board; the mixed "all" view declines — ambiguous, no regression). Verified record / synthetic element / real status-badge / real link-pill → pad → new chat; rate/line/balance are attribute-only additions to existing render lines (appear on priced rentals).
    - ✅ **DOCK REDESIGN BUILT + LIVE (Jac inspiration + frontend skill, 2026-06-14):** **headerless** — colored tagged-element PILL RAIL on top; thread is **chat bubbles** (steel incoming w/ avatar+stamped name, **safety-orange "you"** bubbles); flagged comments thread in as tappable context; **role tab-bar** at the bottom (colored dot + stamped label, lit when in). Quality floor: input focus ring, reduced-motion guard, near-full-width under 560px.
    - ✅ **LIFECYCLE + PERSISTENCE BUILT + LIVE (Jac, 2026-06-14):** chats are a **persistent list** (`state.chat.chats`) and are **NEVER lost**. Each has its own tags/participants/messages/seen. "Everyone leaves" just makes a chat **dormant** (participants 0) — tags + messages stay. **Right-click a record → "🧵 Start chat"** OPENS the element's existing chat (rejoining with your role) or starts fresh — so you **find a chat again through any element it tagged**; deselect your role to leave again. A tagged element **re-flashes** when ANY chat tagging it has unseen messages (per-user `seen`; opening clears it). Dock shows the active chat with a back arrow to the all-flags overview. Verified persistence + reopen-via-element.
    - ⬜ **Next layers:** (1) granular drag sources — drag a *line item / WO / part / status pill / price* (not just whole records) into the chat; (2) per-tag color picker (today a tag inherits the record's flag color); (3) persistence — `state.chat` is in-memory; needs a PERSIST_KEY + backend to survive reloads; (4) external (customer/vendor SMS+email) left side — still blocked on a backend messaging integration.
- 🔧 **History / logging audit** — Clear Unit + draft date now logged; review EVERY action type that should log. DECISION (Jac): **log everything meaningful** — every state-changing action (creates, edits, links/unlinks, status changes, deletes) writes to History; skip only no-op/noise. Build-time: walk the §16 mutations block and ensure each path logs.
- ✅ **+Customer = Quick Add** — shipped (name + phone); CONFIRMED (Jac): name + phone is the right scope.
- 🆕 **Logins** — DECISION (Jac): role-based logins already exist (named roles, each with a password, Admin-managed in Settings via `manageLogins` `app.js:6189`; `currentRole` + switch-user). Scope = **mostly done**: VERIFY the flow, and **wire the per-user comment-acknowledgment (Phase 6) to the signed-in role**. (Per-individual accounts NOT needed now — roles are enough.)
- ✅ **DECISION:** Membership billing — RESOLVED (Jac): support **BOTH monthly and yearly** plans; the customer picks. (Ties into the membership funnel / account type.)
- 🆕 **Schedule Actions → make scheduled follow-ups actionable** — DECISION (Jac): Schedule already adds a dated follow-up to the customer Activity Log (`app.js:4211`, `6387`). Next: (1) **surface scheduled actions when due** — on a Today/agenda view or as a flash/reminder on the customer, not just sitting in the log; (2) **FUTURE NOTE** — scheduled actions ultimately point to a **Company Calendar / Sales Calendar** plus **graphs/dashboard**; the schedule is the feeder for that. (Calendar/dashboard = its own later phase.)
