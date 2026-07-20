# List Views + Inline-Expand — design

**Date:** 2026-07-20 · **Status:** design in progress (brainstorming; no build until approved)
**Renders through:** `wrangler-style` (values) + `style` (rules). This doc holds the
*interaction & feature architecture* only — not colours/type/numbers.

## Goal

Kill the commitment of "click into a detail view." Accessing an item's detail becomes
**expanding it in place in the list**. The list is the home; detail is a reveal, not a
navigation.

## 1. Inline-expand model

- **Trigger:** tap/click a list row · tile · mini-card → it expands.
- **Desktop:** expands **in place to a fixed target** size/position (grows downward in
  its column; siblings push down; opened Units/Rentals items may break out to span the
  full grid-row width so labels don't truncate). Animate with the **mobile-swipe easing/
  timing** (that gesture is the quality bar). `prefers-reduced-motion` → no motion.
- **Mobile / coarse-pointer:** the tap opens a **focused full-screen mode**, **reusing
  the comms full-screen gesture system** — there, horizontal **swipe pages sections**,
  so swipe never competes with the toggle/card gestures. Close via ✕.
- Re-tap / ✕ collapses and cleanly releases the inline height.

## 2. Sections & paging

- Multi-section cards (**Units, Customers**) page their sections.
- **Section chips live in the item's OWN top row** — on expand, the top row of the item
  becomes the section rail (tab chips), plus ‹ › chevrons + a dot indicator. (This is
  distinct from the page-level item tab rail in §5.)
- **Landing section = the SIGNAL summary** ("what's hot / your move") on the user's own
  taps — **labelled "To Do" on the section chips** (the user-facing name for the Signal-
  summary tab; "Signal" stays the internal component name). A **link/transfer lands on its
  target section instead** (see §4).
- **Role sets the default landing + section order**; user can **drag-resort**, persisted
  per record-type.
- **Persistent History-search footer:** every expanded item keeps a `History: [ …search… ]`
  bar pinned at the **bottom**, present on ALL sections (does not page away). Focusing the
  search **expands a history log downward** (card grows taller, siblings push further
  down) + reveals **quick-filter chips** (Payments·Edits for rentals, Inspections·WOs·
  Washes for units, …). History is NOT a paged tab.
- **Tall sections scroll internally.** Fixed outer height; a section that overflows
  (esp. Customers' **Invoices**) scrolls within its own body — never blows out the card.
- **Hover-jump (desktop enhancement):** hovering a *collapsed* row/mini-card pops up a
  **compact section-chip menu ABOVE the item** — emerging from *behind* it like a popover,
  **one chip-line tall** so it never covers the legibility of the item above. It's the same
  section rail that takes the item's top line on expand, previewed. Click a chip → open on
  that section; click the item → open on the default / Signal landing.
  - **Frees the row surface entirely.** The menu floats *above*, so the row's own elements
    keep their tooltips and the row stays "click = open" — **no aiming at a sub-element**,
    no occlusion, and **whole-row hover** triggers it (fast, nothing to target).
  - **Instant, no dwell. Mis-click-safe by geometry:** the chips sit ABOVE the row, off the
    click-path to open — click the row → expand; to use a chip you move *up* into the menu.
  - **Connected + reachable:** the popover emerges from the item's **top edge** (a small
    tail/notch) so it (a) clearly belongs to THIS item, not the row above, and (b) forms one
    **contiguous hover zone** with the row — move up into it without it dismissing (no
    dead-gap). Near the list top, **flip it to appear below**.
  - **Alt placement if "above" is too tight:** hover the item's **name** → the chips appear
    as a **vertical stack to the LEFT** of the item (may extend *off the card/column* — that's
    fine). Same off-the-row-surface logic; a candidate to prototype against the above-popover
    and pick by feel.
  - **Lit sections first** (tight, 1–3 chips). **Desktop-only** (no hover on touch). Rentals
    (no sections) has no menu.
  - Feel-test in the prototype: positioning, reaching into it, flicker between adjacent rows.

## 3. Rentals is the exception — no sections

The Rental card is **one view anchored on the calendar**:
- The mini-card **adopts the detail window-picker calendar, condensed** to mini-card
  width (drops its own mini-calendar).
- That calendar is the **constant anchor** — collapsed and expanded it stays the **exact
  same size and position**; it must not move, resize, or reflow on expand.
- On expand, the calendar stays put and the rest is **revealed around it, all at once**
  (not paged): customer Ref · status Gate · balance (owed) · per-unit rows (unit Ref +
  rate + per-unit gate) · PO / protection-off. Keeps the History footer.

## 4. Anchoring, item tab rail, links, cascade  *(grounded on the existing system — recon 2026-07-20)*

The app already has every primitive; the new model mostly **re-maps single-click to
inline-expand** and leaves anchoring / rail / cascade / links intact.

- **Single vs double (reuse the existing `deferOrAnchor`, 220 ms discriminator):**
  **single-click/tap → inline-expand** (the new low-commitment primary; **no cascade**).
  **Double-click → anchor** (existing behaviour: opens a foreground **tab**, sets
  `session.anchor`, cascades the other two cards to the related subset, paints the
  `#18b6ff` ring).
- **Anchor UI on an expanded item:** **top-right anchor icon = anchor** (= `anchorRecord`
  / foreground tab + cascade). If something is **already anchored**, that icon becomes a
  **`+`** on *other* expanded items = **add to the rail without changing the anchor**
  (= existing `openInNewTab` / ctrl-click background tab). De-anchor: double-tap the
  anchor, the rail ✕, hotkeys — and now this button.
- **Cascade fires on ANCHOR only**, never on inline-expand — that's what keeps expand
  cheap. Cascade engine unchanged (`cascade.js`: FK-walk → related subset → hard-filter
  the sibling cards to it).
- **Item tab rail unchanged** (`tabStrip`: one tab per anchored/open record; header-right
  on desktop, bottom-dock above the toolbar on phone; active-tab click re-cascades).
- **Tabs are SESSIONS, not just items** (Chrome-tab style): a tab holds the anchored
  record **plus the whole 3-card state** (cascade, sibling filters, scroll) at that moment;
  switching tabs restores that entire context. This is the natural unit for **transferable
  sessions / send-to-coworker** (§Open) — you hand over a *tab* = a working context, not one
  record.
- **Links jump precisely (generalise the existing `pillTo`):** a link-click **reveals the
  target's card column, opens the record in place, scrolls to + inline-expands it on the
  correct section** — exactly the pattern the retired-Invoice case (`openInvoice`) already
  runs (reveal customer → scroll to the Invoices section → expand the row → glow). Own
  taps land on the SIGNAL summary; links land on their subject section. (Double-clicking a
  link still anchors, as today.)
- **Preview tool retired.** The hover-preview + the row/bottom-bar **eye** toggles go away
  — inline-expand is the peek now.

## 5. KPI Rings → left vertical rail  *(OPEN — dangerous tradeoff)*

Candidate: move the **KPI Rings from the top to a left-hand vertical rail**, freeing the
top for a **single item tab rail** (the anchored/open items — nothing more).
- **Only do this if the horizontal real-estate given up is worth less than the vertical
  space gained.** Measure before committing (mock top-KPI vs left-KPI side by side).
- **SUPERSEDING IDEA — the graph becomes a role-home *card*, not an inline pop-down (Jac,
  2026-07-20).** Instead of a graph that "pops down" inside an expanded item (which fought the
  inline-expand vertical budget), the analytics get their **own card: a role-home dashboard.**
  The seed: the sales card already *is* a dashboard — the sales job laid out as graphs — so
  generalise it. **Every role gets a home card that is its job's native shape:** analytical roles
  (sales, owner, dispatch) → an **interactive graph dashboard**; field roles (driver, mechanic) →
  their live timeline (the Yard-Journey / route already set as their default). One pattern, two forms.
  - **The chart is a control, not a dead-end read-out.** A graph mark is a **link**: click a wedge
    → **zip to the target list card with the filter applied** (sales clicks a customer-split slice
    → Customers filtered to them; a mechanic clicks down-vs-rented → Units/Categories filtered to
    the down fleet). This is the grounded primitives re-aimed — `pillTo` (reveal → filter → scroll)
    + `cascade` (FK-walk filter) fired from a chart mark instead of a text link.
  - **One colour law across chip and chart** — the dashboard uses the same status palette as the
    Signals (down = red, rented = green…), so a chart is a spatial aggregation of the same Signal
    language: the wedge you tap is the colour of the chip you land on.
  - **This resolves the KPI-rings-to-left tradeoff above** — the role-home dashboard *is* that
    left/home surface; the KPI rings are its simplest cell.
  - **Home, not lockout** — the dashboard is the role's **default landing, not its only card** (the
    drill *into* the other cards is the whole point, so they stay reachable). **Which cards/numbers
    a role may *access* is a separate security / data-gate call** (`keep-the-keys` / `canMoney`):
    the dashboard is the natural place to make that gate *visible* (owner sees the money dashboard,
    the mechanic doesn't), but a hard access-lockout goes through the security review — never a
    design toggle. (Bonus: this gives the coverage map's `keep-the-keys` gap a home.)
  - **Feasible now** — the app already ships a plotting lib (`vendor/d3-shape`, `vendor/plot.min.js`).
  - **RESOLVED (Jac, 2026-07-20):**
    - **Shape = 5 + 1.** Every role keeps the **five base cards — Units · Rentals · Customers ·
      Trips · Categories** — and gets a **6th card: the Dashboard, role-dependent** (what the Sales
      card is today, generalised per role). It is an *added* card whose content is tailored to the
      role — **not** a landing/lockout, and not a replacement for anything.
    - **The base surfaces stay put — the dashboard drills TO them, never replaces them.** Yard
      Journey stays a **Units** section; driver routes stay on the **Trips** card. The dashboard is
      the overview/aggregate layer whose marks *link into* those base cards.
    - **Drill = filter now, tab on double.** Single-click a graph mark → filter the target base
      card in place; double-click / anchor → open that filtered view as a **session tab**
      (tabs-as-sessions). Mirrors the existing single-vs-double discriminator.
    - **Access-gating stays separate.** Hiding a card or a number by role (`keep-the-keys` /
      `canMoney`) remains a security-review call, not part of this dashboard structure — though the
      role Dashboard is the natural place to *surface* a gated number where the role is allowed it.

## 6. Section content the extra room unlocks  *(Units — early ideas, not locked)*

Inline-expand gives sections real estate the cramped detail view never had. Two Units
sections to rethink with it:
- **Inspection** (current design is outdated): if an inspection needs a checklist, keep the
  **checklist open live in the section** — answers fill in place; the inspection only flips
  to **done when it's actually done**, not on a separate screen. A live capture surface, not
  a button that launches a form.
- **Yard journey → its OWN Units section** (chosen 2026-07-20): replaces the cramped
  horizontal node-rail with a **live vertical lifecycle timeline** — stages Reserved → Out
  → On Rent → Field calls → End Rent → Recovery → Returned, each a **row** with a state dot
  (done / current / upcoming) + timestamp/who + its **captured evidence**, the current stage
  carrying the one next **Door** — led by a compact **"NOW + next"** header; inline **route
  strip** when transport applies.
  - It is the **role-default landing section for drivers + maintenance techs** (unless the
    user reorders). Because its NOW header answers "what's my move," it **doubles as their
    SIGNAL summary** — so "land on SIGNAL first" still holds; field roles just land on the
    section whose header *is* their signal. Office roles get the generic rollup summary.
  - Dormant when the unit has no active rental (shows "Available", not an empty rail).
- **Funnel** (Customers — concept loved, execution poor): run it through `style` +
  `wrangler-style`. Keep the Rental | Equipment-Sales toggle + the dated funnel + the
  next-actions list + action log, but rebuilt on the locked components (Signal / Gate /
  Stamp / Door, one height + baseline, the palette). Mock + review.

## 7. Comms architecture — one system, three altitudes  *(Jac, 2026-07-20)*

The bell and the inbox felt the same because they're the **same system at different altitudes**.
Split them by **verb**: a notification's verb is *go to the record*; a message's verb is *read & reply*.

- **The bell = alerts.** The app → you, about records (a today-trigger fired, a payment's overdue,
  *and* "you got a message"). Glanceable, a pointer back to a source. Stays a **badge + drawer**,
  never a card. (This is `get-told`.)
- **The footer comms rail = the quick dock.** Active/pinned threads + compose, minimized along the
  bottom so you can fire a reply or keep a conversation going **without leaving the card you're on**.
  This is **exactly Gmail desktop's docked compose/chat windows** — we are **NOT** ditching it; we're
  naming its job as the middle tier.
- **The Inbox card = the full workspace.** A first-class card in the pool — a **near-duplicate of
  Gmail** (search + recent searches, category bundles, labels: Inbox/Starred/Snoozed/Sent/Drafts +
  **Customers** and **Team**, thread list, reading pane, compose, filter chips) so the office keeps
  its muscle memory. Rendered in wrangler-style, theme-aware — **Gmail's bones, RW's skin** (not a
  light Gmail clone; flip only if Jac asks for the literal look).
  - **The value Gmail can't give:** every thread is **threaded to the record it's about** (a **Ref**)
    — sender → matched to a customer → the conversation hangs off that customer/rental/unit and also
    surfaces *on* its card. "Gmail, but every email already knows which machine and rental it's about."
  - **Unifies email + SMS** per contact (Twilio SMS + email in one thread).
- **Internal team comms = the Team stream** in the same Inbox card — staff-to-staff, much of it
  **record-attached** (`@Trey the hydraulics on RC-4700 need a second look`, posted on the WO → pings
  Trey's bell → threads on the record → lands in his Team inbox). This is also the home for
  **send-to-coworker / session hand-off** (hand a tab/record to a teammate with a note), which
  **partly resolves the cross-user open problem** below.

One flow: **alert (bell) → quick-dock (footer rail) → full workspace (Inbox card)** — a message can be
handled at whichever altitude fits, exactly like Gmail's badge → docked window → full inbox.

## Open problems

- **Cross-user:** transferable sessions, send-to-coworker (Teams), other linking systems
  — how the section/anchor state travels. Firm up the Teams/linking model first.
- **Mobile focused-mode** should reuse the real **comms full-screen gestures**; the mockup
  ships a placeholder overlay until that integration.
- **KPI tradeoff (§5)** — decide by measurement, not feel.
