# Decisions Ledger — 2026-07-20 design session

**Purpose.** This is the flat, scannable index of every locked decision made during the
2026-07-20 UI-redesign brainstorming session, cross-checked against every doc it should
have landed in (`2026-07-20-list-views-inline-expand-design.md`, `wrangler-style`,
`style`, `2026-07-20-mockup-critique-log.md`). Some decisions never made it into a doc —
they lived only in the conversation. Those are rescued in full below. Everything else is
indexed with a pointer to where it already lives, so nothing has to be re-derived from the
raw transcript again.

Nothing below is invented — every row traces to a specific exchange in the session. Where
something was discussed but never actually settled, it's listed in **Still open**, not
presented as decided.

---

## ⏱ Precedence — newer beats older (Jac, 2026-07-20)

**When a rescued (older) decision conflicts with a newer one, the NEWER decision is canon.** This
ledger preserves history — including early framings that were later refined — for *context*, never to
override a current locked decision. Known refinements are flagged inline as **[refined → …]**. Do not
let an archived early decision overtake a newer locked one.

---

## ⚠ NEWLY CAPTURED — was not in any doc

### 1. The 5-part DNA: WORD · NUMBER · SIGNAL · DOOR · PLACE
The whole redesign started from a reduction exercise: 399 findings → 25 jobs → 6 root
problems → **5 behavioral parts**, each the single fix for a cluster of jobs. This is the
conceptual spine everything else (including the Signal/Gate/Stamp/Ref/Door *component*
vocabulary) hangs off, and it was never written down anywhere outside the conversation.
- **SIGNAL** — urgency that climbs (row → group → tab → whole-yard count) and ranks by
  severity. The fix for "spot the fire."
- **NUMBER** — one honest, owned figure per fact, with provenance and an honest "unknown"
  state (vs. a confident fake `$0`). The fix for "trust the screen."
- **DOOR** — a verb-first action that carries its own guard/reason, visible before you
  hit it. Notably, this single part was arrived at by **merging two root problems**
  (reachability and reversibility) — a control that publishes its own guard *is* its own
  door, which is the concrete "5 needs, 2 elements" example Jac asked for.
- **WORD** — a durable, addressed inbox (the seed of the whole comms/get-told work later
  in the session).
- **PLACE** — one grammar, kept structure, reused builders across every card (the
  "keep the WHERE" principle formalized).
Rationale for keeping 5 rather than folding SIGNAL into NUMBER: they do genuinely
different work (is-it-true vs. is-it-on-fire) and folding them would bury urgency inside
"a number." The component vocabulary (**Signal · Gate · Stamp · Ref · Door**, now in
`wrangler-style` §3) is this DNA's later, concrete on-screen incarnation — Gate is
SIGNAL+DOOR merged into one turnable control, Stamp is NUMBER's plain-fact sibling, Ref is
PLACE's cross-card link. That lineage — *why* the five components look the way they do —
was never written down; only the end state was.

### 2. The color system's full semantics and its origin story
`style.md` documents the *mechanism* (`taskState → blocked·now·later·done·none`) but not
the actual **meaning** Jac locked for each hue, nor the debate that produced it — and
`wrangler-style.md` lists the hexes without stating what they mean.
- Jac revealed the app's color system started as **his own invention** pre-dating this
  project: Red = blocking/a gate stops you, Yellow = needs doing, Green = nothing to do.
  He'd been tempted to launch a whole separate initiative around it, until this session's
  research showed *why* it broke in production (red wasn't rationed — 44/60 rows red;
  green was assigned by lifecycle, not health, so it lied over hidden fires).
- **Final locked meanings** (superseding several intermediate proposals mid-session):
  - **Grey = N/A / nothing** — the silent default.
  - **Blue = Waiting** — "the ball's not in your court" (vendor, customer, the clock,
    another department). Chosen specifically because the app had *no* representation for
    in-flight/pending states (an ACH mid-settlement rendered identically to a stone-cold
    overdue invoice). Confirmed by "Reserved = Waiting" (waiting on the pickup).
  - **Yellow = your move, now** — kept to exactly this one meaning once Blue absorbed
    "waiting" and routine work, which is what fixed Jac's "does yellow feel negative?"
    worry (yellow only fires when it's genuinely urgent, never for routine to-dos).
  - **Red = Bad** — deliberately widened by Jac from his original "blocked-only" meaning
    to a general "wrong/bad," with the blocking-specific nuance recovered later via the
    **fill bit** instead of spending a sixth hue.
  - **Green = Done (today)** — a completion/recency state, not a permanent badge. Ages to
    Grey the next day ("settles," becomes ambient). "Done re-alarms": if a completed
    item reverts to bad, it snaps straight back to Red.
  - **One function assigns color, always** — no renderer improvises its own (this was
    the literal root cause of the original R/Y/G system's failure, per the research: every
    card/renderer computed color independently).
- **Rollup precedence, hottest wins: `red > yellow > blue > green > grey`.** This exact
  order is never written in `style.md` (which only lists bucket names, no ordering).
- **Buttons carry no status color, full stop** — made deliberately neutral (white "click
  me" / ghost secondary) specifically to stop Blue doing double duty as both a
  button-affirm color and a status color at the same time.

### 3. Group taxonomy: Attention groups vs. Lifecycle groups
A structural rule for every card's list groups, arrived at while designing Rentals'
groups, never written to any doc:
- **Attention groups** (e.g. Field Calls, Failed) exist and are colored *only* because
  something is wrong — **hidden entirely when empty.**
- **Lifecycle groups** (e.g. On Rent, Reserved, Available, End Rent) are **always
  present**, grey by default, and take color *only* when a member inside triggers it. No
  group is ever given a fixed/native color — this was an explicit rejection (to stop the
  "green lied" bug from recurring at the group level, not just the row level).
- **End Rent is inherently yellow** because its very membership means "due back today" —
  this is how the corpus's "no forward-looking due-back bucket" finding (#110) got fully
  solved, replacing an earlier, more awkward idea of encoding "due back" as a color
  *inside* On Rent.
- A "first-match cascade" model (a record could match multiple groups) was floated and
  then explicitly dropped: Today/Tomorrow/This Week are **reservation start dates**, not
  return dates, so it's a clean single-stage lifecycle timeline with no cascade needed.

### 4. The real per-card lifecycle group lists
Jac supplied these as the literal starting groups for each card's list view — never
recorded in a doc, and they're the concrete instance of the taxonomy above:
- **Customers:** Past Due, Not Due, Reserved, On Rent, Members, Non-Members.
- **Rentals:** Today, Tomorrow, This Week, On Rent, Off Rent, End Rent, Returned, Quote,
  No Show, Cancelled.
- **Units (staff/mechanic view):** Field Calls, Not Ready/Failed+Reserved, Not Ready,
  Failed, Transport, Reserved, On Rent, End Rent, Available, Incomplete (Office Work
  Needed).
- **Units (office+ view):** same set, reordered — Field Calls, Not Ready/Failed+Reserved,
  Transport, Reserved, On Rent, End Rent, Available, Incomplete, Not Ready, Failed.
- "Not Ready/Failed+Reserved" as its own top bucket is the dedicated home for the
  broken-machine-promised-to-a-customer collision (finding #51).
- **Groups must never be named after status** ("Bad"/"To-Do") — that double-encodes what
  color already says; groups say *where* in the workflow, color says *how much* it needs
  you. (Claude's own early mistake, corrected by Jac.)
- **Role-scoped group order**: the same group set, reordered per role (mechanic floats
  Not-Ready/Failed to the top, office sinks them) — one universal grouping engine, role
  only supplies the priority. Role sets defaults, never walls a role off from other
  cards' alerts (a mechanic still gets pinged if a rental he's on goes overdue).

### 5. Quick-filter chips: "Your Work" and "Done"
Header-level filters, distinct from groups, locked over several rounds — not written to
any doc:
- **"Your Work"** — hides any group holding only Green/Grey (all-clear); shows only
  groups containing Red/Yellow/Blue. Does **not** re-bucket items, only hides/shows whole
  groups; carries a rolled-up count. Deliberately chosen over four separate time-based
  chips (Today/Tomorrow/Week/Done) because those are Rentals/Calendar-specific words that
  don't fit Units (service language) or Customers (money/lead language) — a per-card
  filter set would have broken "same builder everywhere."
- **"Done"** — a sibling/opposite filter showing only items in the Green "done today"
  state, so a user can re-find and re-touch what they just did. Explicitly *not* a group
  (Jac: listing an item in multiple groups is "just wrong for our system") — it's a
  filter over the item's one true group placement, same mechanism as Your Work, opposite
  end.
- The card-title toggle moved from **center to left-aligned** specifically to free header
  space for these chips (plus the graph/search/sort) — Jac's own proposal, confirmed
  useful for mobile too (frees room even for a single chip).

### 6. The fill-bit's full debate history and the 3-tier hover contract
`style.md` documents the final trigger list, but not how it got there or the hover
contract layered on top:
- **1st proposal (Jac): Filled = Blocking**, outline = "fix it but not gated." Claude
  generalized this to all five hues and built an 11-example "real gates" artifact
  (failed inspection, no card on file — 94.5% of the book has none, unsigned agreement,
  ACH-in-flight, blacklist, part-on-order, overbook…).
- **2nd proposal (Jac): Filled = Today** instead. Claude's honest compare showed
  "Today" mostly repeats what groups+color already carry, while "Blocking" catches
  something nothing else does — Claude recommended keeping Blocking, but Jac overruled
  and locked Fill = Today.
- **Final correction (Jac), reached by explicitly rejecting Claude's own narrower
  reading:** fill should be a **generous "look here"/curiosity magnet** — Jac wanted
  future-dated items, in-flight/self-resolving items (ACH, e-sign), and dormant flags to
  **all** fill too, because they "touch Today" in some live sense: *"I want users' eyes
  to trigger special curiosity upon seeing a filled."* Only genuinely at-rest records
  (idle unit, mid-rental with nothing due, plain member) stay hollow. This is the
  decision the current `triggeredToday` trigger list encodes — the debate that produced
  it wasn't written down.
- **The 3-tier hover contract for a Signal/Gate chip** (locked alongside fill): (1)
  color+fill = an instant read, (2) the word on the chip = what it is (Signal already
  verbalizes it), (3) hover / Tab / long-press = *why* and *what it stops*. `wrangler-
  style` only says "hover → explain + name the source" — the 3-tier breakdown and the
  keyboard/touch equivalents (Tab, long-press) aren't recorded.

### 7. The three-way color-role split that organized the whole "connective layer"
The rule that unlocked text/links/flags design (born from a blue-collision trap): **status
colors = what · orange = touchable · white = commit · everything else = plain honest
text.** Nothing ever does two jobs. `wrangler-style` shows the resulting Signal/Ref/Door
components but never states this organizing one-liner, which is the reason those three
things don't collide.

**[refined → §8 / `wrangler-style` §3]:** current canon is **commit = deep-blue `#2f6fd0` with white
INK on it** — *not* "white = commit." White is the ink *on* the deep-blue commit pill; the early
"white = commit" phrasing here is the ancestor, kept for context, and does **not** override the
deep-blue-commit decision.

### 8. The two-blues collision and its pill-shape resolution
Blue was already spoken for as the *Waiting* status color, so a commit/save button
couldn't reuse it. Resolution: commit got its **own** deep, more-saturated blue
(`#2f6fd0`, distinct from status blue `#6394cc`) and is **always rendered as a solid pill
shape**, so the two blues never read as the same control even though both are
technically "blue." Jac confirmed this explicitly and asked for the pill shape to be
pushed further ("maybe consider a true pill to differentiate it even more") — which is
the origin of Doors generally being pill-radius. `wrangler-style` states the two hexes
exist and flags one as revisit-worthy, but never explains *why* two blues exist or that
the pill shape is the thing keeping them apart.

### 9. Sandbox/staging architecture decisions and their rationale
Three explicit architecture calls Jac made when scoping how the redesign would get built
and reviewed, never written to any doc:
- **Home: reuse the staging-2 slot**, not a dedicated new repo — specifically *because*
  Jac wants finished cards to merge into trunk piecemeal as they're approved ("my hope is
  that our system improvement is so simple that it is a piece of cake to soon push to
  production").
- **Backend data: read-only on live data**, no sandbox copy/backend needed — because
  this is explicitly scoped as a **view-layer-only redesign**: "we're not changing the
  business/app or workflows... we're improving how those workflows appear to humans...
  we shouldn't need to write to the backend." This is *why* rollback is "free" (see
  below) and is the reason the whole redesign carries almost no data risk.
- **Look direction: use all three explored directions together (A+B+C)**, not pick one —
  "cover as much ground with as few visual systems as possible without losing workload or
  quality... too simple and users can't build muscle memory... too complicated and we get
  a zoo of systems." This sentence is the actual rationale behind "one small kit of
  reusable builders," which downstream docs state as a rule but don't attribute to this
  reasoning.
- **Rollback safety net:** the live production commit (`0fac006`) was noted as a restore
  point; because the redesign is read-only on the backend, reverting the *frontend* alone
  automatically preserves every transaction/payment/record accumulated in the meantime —
  an "already free" rollback. The redesign was also slated to ride the existing `FEATURES`
  flag for an instant runtime-toggle revert if users hate it.

### 10. Funnel redesign specifics
Jac's five corrections to the Funnel mockup (after saying "I LOVE IT") landed in the
build but only partly made it into the spec's terse Funnel bullet:
- **Icons instead of plain checkmarks** on stepper stage markers (pulled from the app's
  own `GATE_ICON` set).
- **Real estate to the right of each checkpoint holds that checkpoint's own actions** —
  not a single generic action list below the stepper.
- **Rename "Next Actions" → "More Actions"** (now explicitly the overflow bucket for
  items with no stage tag).
- **Inline action-adding, no popup** — the one tolerated exception is a small
  calendar+time picker that appears just above whatever was clicked.
- **Must use Jac's real funnel steps, never invented ones** — pulled verbatim from
  `config.js`'s actual `FUNNELS` (Rental: Lead → Reserved → Rented, stacked with the
  Member ladder Lead → Contacted → Not A No! → Payment Discussed → Signed; Equipment:
  Lead → Contacted → Not A No! → Payment Discussed → Paid).
- The **vertical** (not horizontal) stepper was chosen because a 5-stage horizontal
  dated track got cramped at customer-section width.
- The current-stage marker was made color-blind-safe **three separate ways** at once (a
  diamond glyph in the dot, a matte offset ring, and literal text "· now") — a concrete,
  reusable technique for "never color alone" that isn't written down as guidance
  anywhere, only demonstrated once in this one mockup.

---

## Full ledger, by area

Status tags: `[doc: …]` = already captured · `[⚠ NEW — captured here]` = rescued above,
first written down in this ledger.

### Design system — palette, type, contrast, components

| # | Decision | Status |
|---|---|---|
| 1 | Dark palette hexes locked (steel surfaces, safety-orange accent, status colors) | [doc: wrangler-style §1] |
| 2 | Light theme palette locked | [doc: wrangler-style §1] |
| 3 | Filled red deepened `#ff4242→#d63636` (white text 3.44→4.73, AA-forced) | [doc: wrangler-style §1] |
| 4 | Blue muted `#5b9dff→#6394cc` (softens vs. orange, keeps 5.93:1) | [doc: wrangler-style §1] |
| 5 | Yellow dimmed twice: neon→`#ffe14d` (CVD sim, 103 sep.)→final `#eed44b` (dimmest point holding ≥90 from both orange and green) | [doc: wrangler-style §1] |
| 6 | Jac is color-blind — CVD separation floor (≥90 under deuter+protan sim) is a hard gate, not a taste call | [doc: wrangler-style §1, style §4] |
| 7 | Two type voices: stamped/mono for labels+chips, system sans for names/values; record names bold sentence-case | [doc: wrangler-style §2, style §2] |
| 8 | One control height, one baseline, ≤3 weights, one size ladder (28·15·13·12·11·10·9.5) | [doc: style §1] |
| 9 | Two radii only: pill(999) for actions, one chip radius for statuses | [doc: style §1] |
| 10 | Signal · Gate · Stamp · Ref · Door named as the component vocabulary | [doc: wrangler-style §3] |
| 11 | Signal: colour=state, fill=today, teleport-on-click, name-source-on-hover | [doc: wrangler-style §3] |
| 12 | Gate: Signal + leading centered chevron hugging text, no orange dot, opens status picker | [doc: wrangler-style §3] |
| 13 | Stamp: plain fact, no box/color, quiet sibling to Signal, `+N` overflow budget | [doc: wrangler-style §3] |
| 14 | Ref: square accent-tinted backing + parent's Lucide icon + name, walks across cards | [doc: wrangler-style §3] |
| 15 | Door: pill radius; commit=deep blue, money=green, destructive=red, cancel=ghost | [doc: wrangler-style §3] |
| 16 | Toggle active segment = filled Signal chip of the option's status; falls back to plain orange only if no status; applies to every toggle incl. funnel tabs | [doc: wrangler-style §3] |
| 17 | Contact affordance shows the real phone number/email as the `tel:`/`mailto:` link, not a verb like "Call" | [doc: wrangler-style §3] |
| 18 | Honest-affordance rule: tappable ⇒ looks it, not ⇒ plain text (kills fake hover-underlines) | [doc: wrangler-style §3] |
| 19 | "Keep where things are" — reinvent look & function only, never the map | [doc: wrangler-style §4] |
| 20 | Plate grammar: left status-bar + stamped label + summary + chip + chevron → body; header colour = worst item inside | [doc: wrangler-style §4] |
| 21 | Restrained wrangler/ranch voice; litmus = "western before industrial" means dial it back | [doc: wrangler-style §5] |
| 22 | 60-30-10 accent budget adopted as a written rule | [doc: style §5] |
| 23 | Never pure `#000`/`#fff` anywhere | [doc: style §5] |
| 24 | `colour = taskState(record)` / `fill = triggeredToday(record, ctx)` — the two state functions, one owner each | [doc: style §6] |
| 25 | Space-cowboy/"Duster Wrangler"/laser-lasso direction explored in depth, then explicitly rejected by Jac ("Nah. Toss this.") — app stays matte, no glow | [doc: wrangler-style intro] |
| 26 | jactec-ui deleted at Jac's explicit request; replaced by the `style`/`wrangler-style` split, both mandatory together | [doc: wrangler-style intro, CLAUDE.md] |
| 27 | The 5-part DNA: WORD · NUMBER · SIGNAL · DOOR · PLACE, and DOOR = the merge of the reachability + reversibility root problems | [⚠ NEW — captured here, §1] |
| 28 | Full color semantics (Grey/Blue/Yellow/Red/Green meanings) and their origin in Jac's own pre-project R/Y/G system | [⚠ NEW — captured here, §2] |
| 29 | Rollup precedence order: red > yellow > blue > green > grey | [⚠ NEW — captured here, §2] |
| 30 | Buttons carry no status color, ever — a deliberate rule to stop blue double-duty | [⚠ NEW — captured here, §2] |
| 31 | Group taxonomy: Attention groups (hidden when empty) vs. Lifecycle groups (always present, grey-until-triggered, no native color) | [⚠ NEW — captured here, §3] |
| 32 | End Rent is inherently yellow by definition (closes finding #110 without a separate bucket) | [⚠ NEW — captured here, §3] |
| 33 | The real per-card lifecycle group lists (Customers/Rentals/Units-staff/Units-office) | [⚠ NEW — captured here, §4] |
| 34 | Groups must never be named after status; color and group naming are separate axes | [⚠ NEW — captured here, §4] |
| 35 | Role-scoped group *order* on list cards (same set, reordered by role) — distinct from the section-order-by-role rule inside an expanded item | [⚠ NEW — captured here, §4] |
| 36 | "Your Work" and "Done" quick-filter chips, and why 4 time-based chips were rejected in favor of one universal filter | [⚠ NEW — captured here, §5] |
| 37 | Card-title toggle moved center→left-aligned to free header room for the quick-filter chips | [⚠ NEW — captured here, §5] |
| 38 | The fill-bit's full debate (Blocking → Today → the final generous "curiosity magnet" rule) | [⚠ NEW — captured here, §6] |
| 39 | The 3-tier hover contract for Signal/Gate chips (instant read → the word → hover/Tab/long-press for why) | [⚠ NEW — captured here, §6] |
| 40 | The three-way color-role split principle organizing text/links/flags | [⚠ NEW — captured here, §7] |
| 41 | The two-blues collision (status-Waiting vs. commit) and the pill-shape resolution | [⚠ NEW — captured here, §8] |
| 42 | Chip radius unified to one value (7px) for Signal/Gate/Stamp-box/Ref-square, resolving an internal wrangler-style/style conflict | [doc: wrangler-style §3, confirmed consistent] |
| 43 | Current-stage marker made CVD-safe three independent ways at once (glyph + ring + text), demonstrated on the Funnel | [⚠ NEW — captured here, §10] |

### DNA & component vocabulary

| # | Decision | Status |
|---|---|---|
| 44 | 5+1 card shape: every role keeps the five base cards (Units · Rentals · Customers · Trips · Categories) plus a 6th role-dependent Dashboard card | [doc: spec §5 RESOLVED] |
| 45 | Dashboard is a landing, never a lockout — the base cards stay reachable; access-gating is a separate security call | [doc: spec §5] |
| 46 | Drill = filter-in-place on single click, tab-on-double-click (mirrors the existing anchor discriminator) | [doc: spec §5] |
| 47 | Yard Journey stays a Units section; driver routes stay on the Trips card — the dashboard drills TO them, never replaces them | [doc: spec §5] |
| 48 | One colour law shared by chip and chart — a graph wedge is the same colour as the Signal chip it lands on | [doc: spec §5] |
| 49 | The 5-part DNA framework itself (WORD/NUMBER/SIGNAL/DOOR/PLACE) as the conceptual ancestor of Signal/Gate/Stamp/Ref/Door | [⚠ NEW — captured here, §1] |

### Interaction architecture

| # | Decision | Status |
|---|---|---|
| 50 | Inline-expand replaces detail-view navigation; single-click/tap expands in place, no cascade | [doc: spec §1] |
| 51 | Desktop expand animates with the mobile-swipe easing/timing, fixed target size, siblings push down | [doc: spec §1] |
| 52 | Mobile expand opens a focused full-screen mode reusing the comms full-screen gesture system | [doc: spec §1] |
| 53 | Multi-section cards page via section chips living in the item's own top row on expand | [doc: spec §2] |
| 54 | Landing section = the Signal summary, labelled "To Do" on the section chips (internal name stays "Signal") | [doc: spec §2] |
| 55 | Role sets the default landing + section order inside an expanded item; drag-resort persists per record-type | [doc: spec §2] |
| 56 | Persistent History-search footer on every expanded item, all sections, not paged away | [doc: spec §2] |
| 57 | Tall sections (e.g. Customers' Invoices) scroll internally, never blow out the card | [doc: spec §2] |
| 58 | Hover-jump popover-above accelerator: emerges from the item's top edge with a tail/notch, one chip-line tall, flips below near the list top | [doc: spec §2] |
| 59 | Hover-jump is instant/no-dwell, mis-click-safe by geometry (right-lane / whole-row hover), not by a timer | [doc: spec §2] |
| 60 | Hover-jump left-stack alternative (hover the item name) as a fallback if "above" is too tight | [doc: spec §2] |
| 61 | Rentals is the sections exception — one calendar-anchored view; the calendar itself never moves/resizes on expand | [doc: spec §3] |
| 62 | Single-vs-double click discriminator (220ms) reused: single = inline-expand (no cascade), double = anchor (cascade + tab) | [doc: spec §4] |
| 63 | Anchor icon top-right on an expanded item; becomes "+" on other expanded items if something's already anchored | [doc: spec §4] |
| 64 | Cascade fires on anchor only, never on inline-expand | [doc: spec §4] |
| 65 | Tabs are sessions, not just items — a tab holds the whole 3-card cascade/filter/scroll context | [doc: spec §4] |
| 66 | Links jump precisely: reveal target card → scroll → inline-expand on the correct section; own taps land on Signal, links land on their subject | [doc: spec §4] |
| 67 | Preview tool (hover-eye) retired — inline-expand is the new peek | [doc: spec §4] |
| 68 | Inspection checklist becomes a live, in-place capture surface, not a separate form | [doc: spec §6] |
| 69 | Yard Journey becomes its own Units section: vertical lifecycle timeline, "NOW + next" header doubles as field-role's To Do summary | [doc: spec §6] |
| 70 | Funnel: concept kept, execution rebuilt on the locked components | [doc: spec §6] |
| 71 | Comms: three altitudes — bell (alerts) / footer dock (quick-dock) / Inbox card (full workspace) | [doc: spec §7] |
| 72 | Every comms thread is Ref-linked to the record it's about | [doc: spec §7] |
| 73 | Unified triage (one Gmail-style list) + native conversation per medium (email=reading pane, texts=Messages bubbles, team=Messenger channels) | [doc: spec §7.1] |
| 74 | Channel toggle top-right: ALL·TEAM·TEXTS·EMAIL·WRANGLER·CALLS, swipeable on mobile | [doc: spec §7.1] |
| 75 | Mr. Wrangler is its own channel; stops clogging the bell, fires a loud distinct alert on reply/fix | [doc: spec §7.1] |
| 76 | Inbox reuses the app's own search bar + Views&sort (not Gmail's chrome) | [doc: spec §7.2] |
| 77 | Recent-search history popup opens ABOVE the bar app-wide, same principle as the hover-jump popover | [doc: spec §7.2] |
| 78 | Compose docks at the footer (desktop, minimizable) or full-screen (mobile), never follows the pointer | [doc: spec §7.3] |
| 79 | Right-click comms action opens compose in place with the record pre-attached; never teleports to the Inbox card | [doc: spec §7.3] |
| 80 | Comms-rail tab popups rebuilt on the locked system, modeled on Messenger/Messages/Gmail rather than the current (undisclosed) design | [doc: spec §7.3] |
| 81 | Responsive space model: Roomy (3 panes + draggable divider) / One-card (menu-list-email hamburger dance) / Narrow (fully mobile) | [doc: spec §7.4] |
| 82 | Hamburger choreography: hover = overlay-covers-list; click = trades places with the email; list is the anchor, never pushed | [doc: spec §7.4] |
| 83 | Customizable quick-actions (Hide/Mark-unread/Star/Snooze/Archive) surfaced identically as row actions and right-click | [doc: spec §7.4] |
| 84 | Drag-to-resort threads and folders/labels | [doc: spec §7.4] |
| 85 | "Sort" flagged as weak, parked for a future all-cards redesign | [doc: spec Open problems] |

### Cards & Dashboard

| # | Decision | Status |
|---|---|---|
| 86 | Sales card generalizes into the role Dashboard idea (chart-as-control, not a dead-end readout) | [doc: spec §5] |
| 87 | Chart marks are links (pillTo + cascade fired from a wedge instead of text) | [doc: spec §5] |
| 88 | Field roles get their live timeline (Yard Journey/route) as the analogous dashboard-shape; analytical roles get graphs — one pattern, two forms | [doc: spec §5] |
| 89 | KPI-rings-to-left tradeoff resolved by the Dashboard-as-6th-card idea rather than measured directly | [doc: spec §5] |

### Comms (see Interaction architecture above — comms items 71–85 are grouped there)

### Process / workflow

| # | Decision | Status |
|---|---|---|
| 90 | Two-skill split: `style` = measurable rulebook only; `wrangler-style` = hard decisions; both run on any UI change, decision moves when it conflicts with a rule | [doc: wrangler-style + style intros, CLAUDE.md] |
| 91 | jactec-ui deleted outright at Jac's request (recoverable via git history only) | [doc: CLAUDE.md, wrangler-style intro] |
| 92 | "Gmail's bones, RW's skin" — not a literal Gmail clone; flip only if Jac asks for the literal look | [doc: spec §7] |
| 93 | Current comms rail screenshot deliberately withheld from Claude so the weak existing design can't bias the rebuild | [doc: spec §7.3] |
| 94 | Critique-log tagging scheme: Rule / Decision / Surface / Gap × Everywhere / Just-here, judged by 4 lenses (job/ugly-state/motion/missing) | [doc: mockup-critique-log.md] |
| 95 | Popup-first interaction rule (single-attempt, inline fallback, batched multiSelect) — reused throughout this whole session | [doc: CLAUDE.md] |
| 96 | This is a VIEW-LAYER-ONLY redesign — same data/logic/workflows, only how they appear changes | [⚠ NEW — captured here, §9] |
| 97 | Read-only-on-live-data architecture, chosen specifically so rollback needs zero data migration | [⚠ NEW — captured here, §9] |
| 98 | Staging home = reuse staging-2 slot (not a dedicated repo), chosen so approved cards can merge to trunk piecemeal | [⚠ NEW — captured here, §9] |
| 99 | Explored-all-three-visual-directions rationale (narrow-DNA vs. muscle-memory vs. zoo-of-systems tradeoff) | [⚠ NEW — captured here, §9] |
| 100 | Rollback safety net: `0fac006` tagged as the live restore point; redesign to ride the existing `FEATURES` flag for instant runtime revert | [⚠ NEW — captured here, §9] |

---

## Still open (discussed, not decided — do not treat as locked)

- **Backend data snapshot.** Claude offered to make a dated private Drive copy of the
  Live Database (+ optionally the Daily Category Report) as an extra safety net. Jac
  never said "go" on this in the session — it's an offered-but-unactioned safety step,
  not a decision.
- **Whether analytical-role dashboard charts (funnel trend, revenue trend) should carry
  more Signal status color, or stay neutral blue as non-enum data.** Raised as an open
  judgment call on the Dashboard mock; never answered.
- **Mr. Wrangler's exact channel placement** — its own 6th toggle segment (Claude's
  recommendation, since shipped in the mock) vs. living only inside ALL + the bell. Spec
  itself already flags this OPEN.
- **KPI Rings → left vertical rail** — superseded in practice by the Dashboard-card idea,
  but the underlying measure-don't-guess tradeoff was never directly tested (mock
  top-KPI vs. left-KPI side by side), per the spec's own note.
- **Signature motif** — whether the app gets one bold signature beat now that jactec-ui's
  hazard-stripe+rivets weren't re-adopted. Flagged open in `wrangler-style` §6.
- **Commit-blue exact shade** — `#2f6fd0` chosen, but flagged for revisit if it ever reads
  too close to status-blue. Flagged open in `wrangler-style` §6.
- **Cross-user / transferable sessions / send-to-coworker linking model** — acknowledged
  as needing the Teams/linking model firmed up first. Flagged open in the spec.
- **"Sort" all-cards redesign** — parked explicitly as future work, not this slice.
- **Fill rule's one remaining edge case** — whether a waiting-on-vendor gate (WO
  closeable today but the part's on order) fills as "today's blocker you're tracking" or
  stays outline until the part lands; superseded in spirit by the final generous-fill
  rule but never explicitly re-confirmed for this specific case.
