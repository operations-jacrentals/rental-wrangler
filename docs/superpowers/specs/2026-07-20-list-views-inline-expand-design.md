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

### 7.1 How far to take the Messages/Messenger feel — RESOLVED: unified triage, native conversation  *(Jac, 2026-07-20)*

The team already runs ops in **Messenger group chats by workflow** (Reservations · On Rent/Delivery/Recovery ·
Office · Transport/Field Calls · the crew chat) + Apple Messages for 1:1 — so their *chat* muscle memory is
Messenger/Messages, **not** Gmail. Split **finding** from **talking**:

- **Triage = ONE surface (the Gmail layout).** Every channel — email, texts, team — lands in one inbox list
  (rows: avatar · name · snippet · time · unread · **Ref** · **Signal**), each row carrying a small **channel
  glyph** (✉ email / SMS / # team / 🔧 Mr. Wrangler) so the medium is always clear. This is the muscle-memory streamline (one place
  to scan "what needs me") and it uses **our own search + sort**, not Gmail's (see 7.2).
- **Channels = a top segmented toggle, not a left-rail list (Jac, 2026-07-20).** The channel selector
  moves OUT of the buried bottom-left "Streams" list UP to a **top toggle** (channels are the primary
  axis — which conversation world you're in). Left→right: **ALL · TEAM · TEXTS · EMAIL · CALLS** (CALLS
  = future in-app calling, a placeholder "soon" segment). On **mobile the toggle is swipeable** (swipe
  = change channel). The **left rail keeps only the Gmail folders** (Inbox/Starred/Snoozed/Sent/
  Scheduled/Drafts/All mail/Spam/Trash). Active segment = **orange** (channels aren't a status → the
  fallback, not a filled Signal); each segment carries its unread count. **OPEN — where Mr. Wrangler
  sits:** its own 6th segment (ALL·TEAM·TEXTS·EMAIL·**WRANGLER**·CALLS) vs. living inside ALL + the bell
  — recommend a **segment**, since its whole problem is invisibility.
- **Talking = native to the medium.** Opening a thread renders in that medium's form:
  - **Email** → reading-pane thread (Gmail).
  - **Text (SMS/customer)** → **Apple-Messages bubbles** (sent/received, delivered receipts, inline media).
  - **Team** → **Messenger-style channels** — bubbles + sender names + **presence dots** + reactions + @mentions,
    carrying the existing workflow channels (Reservations, On Rent/Delivery/Recovery, Office, Transport/Field
    Calls), now **record-aware** (a message attaches to the unit/rental it names; the "On Rent/Delivery/Recovery"
    channel *is* the Yard Journey lifecycle).
  - **Mr. Wrangler** → its own **bot channel** of threads (report a bug/request → it replies:
    investigating → fixed / needs-you). Today it **barely signals a reply or a fix — annoying** — so on
    reply/fix/needs-you it fires a **loud, distinct bell alert** + a clear unread thread in the inbox, and
    it **stops clogging the bell** with the raw engineering feed (surface *resolutions addressed to you*,
    not every ticket). This is the existing `wrangler` comms cat, made legible.
- **Why not all-Gmail:** forcing a live chat into an email-quote-thread reads worse AND spends the Messenger
  muscle memory the crew already has. Streamline the *triage*, keep bubbles where bubbles belong.

### 7.2 Chrome = the app's own search + sort (not Gmail's)

The Inbox card reuses the existing **card search bar** (`mini-search` — filters are removable **pills in the bar**,
one filtering pathway, plus the **globe** per-card↔whole-yard scope toggle) and the **"Views & sort" menu** (sort
fields + saved Views) — same as every card (`no-surprises`). Gmail's chrome maps straight onto ours: filter chips
(From/To/Attachment/Starred/Unread) → our filter pills; labels + date sort → Views & sort + saved Views;
all-accounts scope → the globe. So it's **Gmail's layout wearing RW's search/sort chrome.**

- **Recent-search history — ALL card search bars, app-wide (Jac, 2026-07-20).** Focusing any search
  bar shows a **recent-searches** dropdown (like Gmail's "Recent mail searches"), opening **ABOVE the
  bar, never below**, so it never covers the live-filtering results underneath. Same principle as the
  §2 hover-jump popover — **floating menus emerge above to keep the content below legible** (near the
  top edge it overlays upward out of the card head). Applies everywhere, not just the Inbox; the Inbox
  mock adopts it.

### 7.3 Compose & the comms rail — quick-dock, never a teleport  *(Jac, 2026-07-20)*

Grounded on the existing **D8/D9 comms rail** (`state.commsRail`, cats **team · text · email ·
wrangler**) and the **R20 right-click** comms items ("Text {name}…" / "Email {name}…" →
`commsOpenConv`).

- **Compose opens in the dock, not the card.** Desktop → a **docked footer-rail tab** (Gmail-desktop
  compose window, minimizable, several at once). Mobile → **full-screen**. It does **NOT follow the
  pointer or pop up mid-screen** — even a right-click trigger sends the compose to the footer dock /
  full-screen, never a floating box at the cursor.
- **A comms action from a record stays in place.** Right-click / +Team / +Gmail / Text…/Email… →
  opens the **new compose** (footer tab / full-screen) with **the record pre-attached** — it does
  **NOT** navigate to the Inbox card. Zipping the user to the inbox mid-task is disorienting,
  **especially on mobile.** The full Inbox card is **opt-in** (you go there when you want the
  workspace), never a side effect of starting a message.
- **Redesign the comms-rail tab popups.** The current tab popups are weak; rebuild them in the locked
  system (Signal/Ref/Stamp/Door, one control height, the palette) as part of the Inbox v2 pass.
  **Model the redesign on the best-in-class references — duplicate Facebook Messenger (team) + Apple
  Messages (texts) + Gmail (email), in RW's skin — NOT the incumbent comms rail.** (Jac deliberately
  withholds a screenshot of the current one so the weak design can't bias/corrupt the rebuild.)
- This is the **quick-dock tier** (§7) doing its job: fire a reply or start a thread without leaving
  the card you're on — bell alerts, dock handles the quick turn, the Inbox card is the full workspace.

### 7.4 Fitting the inbox in one card — responsive space + quick actions  *(Jac, 2026-07-20)*

The Inbox is a Gmail-scale workspace in a **width-constrained card**, so it adapts by width — ONE
interaction model that just adds panes when there's room (desktop = "the mobile model with more space"):

- **Roomy (inbox focused / broken out wide):** folder rail + thread list + reading pane, all three; a
  **draggable divider** between list and reading pane resizes them — the "vertical expand line", **only
  here**, where there's room for it.
- **One-card width (the constrained default):** the card only ever shows **two of the three** panes, and
  the **thread list is the anchor — the menu never overtakes or pushes it.** The **left folder menu and
  an open email are mutually exclusive** (no room for both):
  - **Reading (email open):** the menu is hidden behind a **hamburger**; the card shows **list + open
    email**, neither moving. **Hover the hamburger → the menu pops out as an OVERLAY *covering* the
    list** — a transient peek, nothing underneath reflows; move off and it retracts.
  - **Browsing (click the hamburger):** the **open email closes**, the **list slides over into its
    place**, and the **left menu pins on the left** (persistent) → **menu + list**, no email.
  - **Click a thread → the email opens → back to Reading** (menu collapses to the hamburger). The dance
    repeats.
  So the menu either **overlays** the list (hover peek) or **trades places with the email** (click) — it
  never overtakes it. Channels stay up top on the toggle throughout.

**Inbox expand — the OUTER width lever (Jac, 2026-07-20; INBOX-ONLY).** Office roles need a big Gmail
workspace or they'll leave the app, so the Inbox card can **expand, shrinking its siblings** — but this
expand is **exclusive to the Inbox**, never a generic "resize any card" feature (Jac's hard constraint).
**Key unification: expanding the Inbox just moves it UP its own responsive ladder above** — at ⅓ width
it's the collapse/swap mode; expanded to ½–full it becomes the **roomy 3-pane Gmail workspace** (folder
rail + list + reading pane + draggable divider). Expand and the internal space model are ONE lever — no
new internal behaviour. **Recommended shape (①):** a **stepped "Focus" toggle** on the Inbox (⅓ → ½ →
full); as it grows the **other two cards collapse to slim, clickable spines** (card title + unread/alert
dot) so the yard context is peekable/one-click-restorable, never lost; **office roles default to a wide
Inbox**, field roles default balanced (role-default *sizing*, extending role-default landing).
Alternatives: ② an **overlay/breakout** that floats over the cards (no resize, more modal); ③ a coarse
draggable card boundary (deprioritised — fiddly drags). The expand control lives **only** on the Inbox;
siblings collapsing is a *consequence*, not a feature they own.

**No heart attack — sibling interactions cleanly EXIT inbox-focus (Jac's concern, 2026-07-20).** The
danger exists only if the expanded inbox and the yard cards are both "live" and fight for the same
gestures (cascade / anchor / click). The fix: inbox-expand is a **first-class focus STATE** with one
rule — **any sibling-directed action gracefully exits it**, reusing the left-menu choreography:
- **Hover a collapsed sibling spine → transient peek** (overlay, nothing commits).
- **Click it** (or a cross-card link, or a Ref pointing at a yard card) → **the inbox collapses back to
  balanced thirds and that sibling comes forward, ready to work.**
There is never an ambiguous "both expanded" state. Example — click Customers while the inbox is
expanded → read as "switch to Customers": inbox drops to its ⅓, layout rebalances, Customers focuses.
This is **why expand stays inbox-only**: the state machine is just `{balanced} ↔ {inbox-focused}`
(tractable); a generic "any card expands/shrinks any other" is the real N×N heart attack. And
**yard → comms actions never expand the inbox** — they open the **dock** (compose, §7.3), so the two
worlds don't collide.
- **Narrow / phone:** fully **mobile** — list only; tap a thread → it **swaps** to the reading view
  full-width (back returns); swipe the top toggle to change channel; folders behind a hamburger. The
  draggable divider is dropped here (not plausible in the tight space — collapse+swap is the robust answer).

**Quick actions — a customizable set, two entry points:**
- A user-**customizable** quick-action set — **Hide · Mark unread/read · Star · Snooze · Archive** (like
  Gmail's configurable swipe actions) — surfaced identically as **row actions** (hover-reveal on desktop,
  **swipe** on mobile) AND in the **right-click (R20) menu**. One set, learned once, available everywhere.
- **Drag-to-resort** threads (manual order) and reorder folders/labels.

### 7.5 Inbound routing — where a NEW message lands, by medium  *(Jac, 2026-07-20)*

"Better than a notification" for a live chat is the message **arriving on the footer rail itself** —
actionable (reply-in-place), not a notification you chase. So inbound delivery altitude depends on the
medium's tempo:

- **Texts & Team chats (high-frequency back-and-forth) → the footer rail.** A new message **raises its
  rail tab with the new text truncated into the tab** (glanceable). If a tab for that thread already
  exists → **bump to front + flash + preview + unread dot**; else a tab **slides in**. Non-modal (never
  steals focus). Also logs in the bell as the durable catch-all.
- **Emails (low-frequency) → bell + inbox, calm.** **No footer pop** — UNLESS that email thread is
  **already docked on the rail**, in which case update that existing tab; never spawn a new pop for email.
- **Gate the aggressiveness by recency/activity:** only auto-pop **recent/active** threads; a text on a
  cold thread stays quiet (bell + inbox + a silent tab) so the rail isn't hijacked by every stray message.
- **Team nuance (Messenger/Slack):** a **@mention or DM always pops**; general channel chatter is a
  **quiet count** on the channel, not a full pop. Any thread/channel can be **muted → count only**.
- **Mobile:** no persistent footer rail, so a high-freq inbound = an **OS-style banner/toast + badge**
  (tap → full-screen thread); email = **badge only**.
- **Mr. Wrangler** keeps its own loud, distinct bell alert on reply/fix (§7.1).

Net: the bell stays the durable everything-log; **high-frequency chat gets a faster, reply-in-place lane
(the footer rail); email stays calm** unless you've already pulled it onto the rail.

## Open problems

- **"Sort" needs an all-cards redesign (Jac, 2026-07-20 — "our Sort sucks").** The current Views &
  sort menu is weak; a future pass redesigns sort/views across **every** card, and the comms work
  (filter-pills-in-the-bar, saved Views, one filtering pathway) may seed it. Parked — not this slice.

- **Cross-user:** transferable sessions, send-to-coworker (Teams), other linking systems
  — how the section/anchor state travels. Firm up the Teams/linking model first.
- **Mobile focused-mode** should reuse the real **comms full-screen gestures**; the mockup
  ships a placeholder overlay until that integration.
- **KPI tradeoff (§5)** — decide by measurement, not feel.
