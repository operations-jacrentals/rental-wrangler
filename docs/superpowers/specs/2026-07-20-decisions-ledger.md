# Decisions Ledger — 2026-07-20 design session (extended to 2026-07-28)

> **⏱ READ FIRST — this file has two halves.** Everything up to **#100** is a **2026-07-20
> snapshot**. Decisions made on **07-21, 07-25, 07-26 and 07-28** are indexed in the
> **[EXTENSION section](#extension--decisions-after-2026-07-20-101)** at the bottom, starting at
> **#101** — including **two reversals of the section model** and, on **07-28, a reversal of the
> control-shape ladder itself**, where a 07-20 row is no longer current.
> **Do not cite a row from the first half without checking for a superseding row in the extension.**
> Grepping this file and stopping at the first hit is exactly how a superseded decision got cited as
> canon on 2026-07-26.
>
> ⚠️ **If you are writing a Labs prompt or touching UI, start at [#139](#2026-07-28--the-labs-handoff-a-new-design-language-not-just-containers).**
> The 07-28 handoff replaced the atom language: radius 0 + chamfers, mono controls, nine new
> components. Anything written against the four-shape ladder now contradicts the approved card.

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

**[refined → current: `style` §6 / `triggeredToday`, see "Final correction" bullet below]:**
neither of the two bullets above is current canon — **fill = the generous "curiosity
magnet" rule** (`triggeredToday`: due/overdue/gating-now/needs-hands/near-clock/in-flight/
flagged-live/closed-today), not "Filled = Blocking" (1st proposal) and not narrowly
"Filled = Today" (2nd proposal). Both are the ancestors, kept for context, and do **not**
override the final generous fill rule.

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
| 53 | Multi-section cards page via section chips living in the item's own top row on expand | ⚠️ reversed twice — see **#101** then **#121**; the paging model is current but the rail's form changed [doc: spec §2] |
| 54 | Landing section = the Signal summary, labelled "To Do" on the section chips (internal name stays "Signal") | ⚠️ the "To Do" label was retired on desktop by #101 and returns with paging — see **#123** [doc: spec §2] |
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
| 74 | Channel toggle top-right: ALL·TEAM·TEXTS·EMAIL·WRANGLER·CALLS, swipeable on mobile **[refined → NOT fully locked: the WRANGLER segment is still OPEN (Claude's recommendation only, per spec §7.1 and "Still open" below) — only ALL·TEAM·TEXTS·EMAIL·CALLS + the swipeable top-toggle placement are decided]** | [doc: spec §7.1] |
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
  itself already flags this OPEN. (See item 74's annotation above — the mock shipping it
  is not the same as it being locked.)
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

---

## Promotion recommendations — ledger-only decisions that should become enforced canon

These are load-bearing rules this reconciliation pass found living **only** in this
ledger's rescued sections — never actually written into `wrangler-style`/`style` — even
though other locked decisions already depend on them (e.g. "header colour = worst item
inside" needs a *worst* to be defined; it isn't, anywhere but here). Recommended only —
**Jac promotes on his go**; this ledger is not the place to change `wrangler-style`/`style`
themselves.

### (a) Rollup precedence — `style` §6 (State & fill)

Add as a new bullet after the `fill = triggeredToday(...)` line:

```
- **Rollup precedence, hottest wins.** When multiple task-states combine into one summary
  (a group header, a card cap, a rolled-up count), the winner is fixed, never resolved ad
  hoc per renderer: **red > yellow > blue > green > grey.**
```

### (b) No status colour on buttons, ever — already canon; recommend a cross-reference only

This one is **already** stated verbatim in `style` §6 ("Buttons carry **no** status
colour") and the §8 checklist ("no status colour on a button"). Nothing to promote there.
The gap is that `wrangler-style` — the skill that actually defines Door's action colours —
never says the negative rule out loud. Recommend appending to the **Door** bullet in
`wrangler-style` §3:

```
  (Commit/money/destructive are action colours, never status colours — no Door, chip, or
  button ever repurposes a status hue to mean "click me"; see `style` §6.)
```

### (c) The three-way colour-role split — `wrangler-style` §3 (Components), as a preamble

Add before the component bullet list:

```
**The one rule underneath every component below:** status colour = *what* it is · orange
= *touchable* · deep-blue `--commit` = *commit* · everything else = plain honest text.
Nothing ever does two jobs — that's the whole reason Signal, Ref, and Door don't collide.
```

### (d) Group taxonomy — `wrangler-style` §4 (Layout & structure)

Add as new bullets:

```
- **Group taxonomy.** Every card's list groups are one of two kinds: **Attention groups**
  (e.g. Field Calls, Failed) exist and are coloured only because something is wrong —
  hidden entirely when empty. **Lifecycle groups** (e.g. On Rent, Reserved, Available) are
  always present, grey by default, and take colour only when a member inside triggers it —
  no group ever carries a fixed/native colour.
- **Groups are never named after status** ("Bad"/"To-Do") — that double-encodes what
  colour already says; a group name says *where* in the workflow, colour says *how much*
  it needs you.
```

### (e) The 3-tier Signal/Gate hover contract — `wrangler-style` §3, extend the Signal bullet

Current Signal bullet only says "hover → explain + name the source." Extend it:

```
  Three-tier read: **(1) colour + fill** = the instant at-a-glance state, **(2) the word
  on the chip** = what it is, **(3) hover / Tab-focus / long-press** = *why* and *what it
  stops*. Click → teleport to source.
```

### (f) Internal vocabulary vs. user-facing labels — `wrangler-style` §5 (Voice)

Add as a new bullet:

```
- **Component names are internal vocabulary, never user-facing.** Signal/Gate/Stamp/Ref/
  Door are how *we* talk about the pieces; the person using the app always sees plain task
  language (e.g. the Signal-summary landing tab reads **"To Do"**, never "Signal").
```

---

# EXTENSION — decisions after 2026-07-20 (#101+)

**Why this exists.** Everything above is a **2026-07-20 snapshot** that stops at #100. Decisions kept
being made on 07-21, 07-25 and 07-26 — but none were indexed here, so this file quietly became a
*stale* authority: a reader would grep it, find a 07-20 answer, and cite a decision that had since
been reversed. That happened on 2026-07-26 and cost three audits.

**The rule going forward: a decision is not made until it has a row in this table.** If you reverse
something, add a new row rather than editing the old one, and mark the old one superseded — the
history is what lets a future reader tell "settled" from "settled twice."

> ⏱ **Precedence reminder:** rows are dated. **Newer wins.** The 07-20 tables above are *not*
> automatically current — check for a superseding row down here before citing one of them.

## 2026-07-21 — Trips ETA-Tracker, detail-view build, section model (first reversal)

| # | Decision | Status |
|---|---|---|
| 101 | Section model → **accordion plate stack on desktop, page on mobile** (spec §2.0); chosen because the stack renders every section's state at rest | ⛔ **SUPERSEDED by #121 (07-25)** |
| 102 | Trips ETA-Tracker renders as a **dispatch-book ledger** — a list of stop rows joined by a connector spine — not a ticket card | [spec §8.5, supersedes §8.4's framing] |
| 103 | The Houston multi-route map was **inspiration only — do NOT build a multi-truck board.** Row-click opens the single trip's route on the Dashboard map; that is the only map surface in scope | [spec §8.5] |
| 104 | **"DEPARTURE" spelled out** on the ledger's left prefix — never OUT/DEP/RTN abbreviations | [spec §8.5.1] |
| 105 | **No per-trip header or footer** — the ledger is just its rows; the driver-reassign Gate rides the START (store) row; group headers stay | [spec §8.5.1] |
| 106 | Stop-type glyph (`HQ`/`↓`/`↑`) sits **left of the Gate** | [spec §8.5.1] |
| 107 | **ETA clock behaviour:** shows the scheduled departure time until it arrives, then **counts UP** until Start is clicked. A missed departure is a **heavy escalation** — notifies dispatch **plus manager and sales**, because it is a business problem, not a quiet flag | [spec §8.5.1, style §6] |
| 108 | **Drive folds into the ETA line** as a first-class figure — `+42MIN = 8:22 ETA`, no separate Drive column | [spec §8.5.1 pt5, supersedes the "own column" round-2 line] |
| 109 | Town links **column-align with the Deadline chips** (an aligned right-hand pair) | [spec §8.5.1] |
| 110 | **Connector = the stop's ORDER NUMBER** (1·2·3…) once tripped; an untripped/loose stop keeps a **BOX**; Start/End anchors are **inert** | [spec §8.5.1 pt7, supersedes §8.5's "square box + inert circles"] |
| 111 | **Untrip by DRAGGING the row away** — the box is not a click-to-untrip control | [spec §8.5.1] |
| 112 | Town = the **"True hyperlink ↗"** — ink + accent underline + trailing arrow, opening Google Maps off-app | [spec §8.5.1] |
| 113 | The **customer rides as a Ref** between the Town and the Deadline | [spec §8.5.1 pt10] |
| 114 | The Trips **Gate is a canon Gate chip** — soft Waiting `--blue` + leading chevron — **not** a `--commit` affirm pill. The chevron is what keeps a blue Gate distinct from a blue Waiting Signal | [spec §8.5.1 pt11] |
| 115 | **Source every element from the artifacts + `wrangler-style` + `style` — never the live app.** If canon is missing something, stop and ask | [spec §8.5.1 pt9] |
| 116 | **Invoice line-item IDs = Ref (walkable).** May revert to Stamp later — keep the render routed through the element layer so the flip is one line, not a sweep | [build plan Decisions] |
| 117 | Trips row has **three non-overlapping click targets**: row-body → trip map on the Dashboard · town → Google Maps · gate → advance the state machine | [spec §8.5] |
| 118 | **List Views + the three Detail views ship as ONE build plan** — they share the element layer and card grammar, so building them together keeps the shared builders honest | [build plan Scope] |
| 119 | The `.plate`/accordion/KPI-grid/mini-calendar **structural reshape of the Detail views is DEFERRED** — an information-architecture decision that needs its own reviewed mockup pass, not a blind build | [build plan, "NOT built this run"] |
| 120 | Plate grammar ships as a **3px coloured LEFT-BORDER stripe** on both existing field-group containers (`.acct`, `.section`); the base theme's glow is dropped (matte, no glow) | [build plan Slice 4] |

## 2026-07-25 — the Labs pipeline, the atoms lock, section model (second reversal)

| # | Decision | Status |
|---|---|---|
| 121 | **Section model → PAGING, via a section rail.** *"The settled answer is a bounded, paging detail view driven by a section rail… no long scroll, no accordion stack."* The accordion lost because stacking every section open made a Customer record run **~5 phone-screens** | ✅ **CURRENT — supersedes #101 and #53** [`docs/design/prompts/prompt-01-detail-views.md`] |
| 122 | Each **rail chip carries three things**: the section's rolled-up Signal (worst state inside), colour = that state, and the section's **one primary Door** — so paging hides nothing | [prompt-01] |
| 123 | The **first section shown on open is the Signal summary / most-urgent** one — land the user on what needs them | [prompt-01; decision-notes.md:169] |
| 124 | **History is a pinned footer**, always visible under the paging pane — explicitly **not** one of the rail's paging sections | [prompt-01] |
| 125 | **Section order stays natural and familiar** — never re-sorted by severity; the rail's *colour* carries severity, the *order* holds muscle memory | [prompt-01] |
| 126 | **One fixed maximum height envelope** every record obeys, so the list never jumps; a section taller than the envelope **scrolls inside its own pane** | [prompt-01] |
| 127 | **Atoms LOCKED** — the consistency pass: four control shapes, Archivo body voice, true-outline chips + `--red-line`, `.menu` dropped as a picker in favour of `.seg--stack`, the new **Pin** atom, and uniform hover/focus/press with real `<button>`s | [LABS-PIPELINE, `wrangler-style` §3.0/§3.1] |
| 128 | **The Labs prompt framework** — every prompt carries a North Star, explicit anti-objectives, and an Inherit list; **one screen = one Labs session = one artifact** | [LABS-PIPELINE] |
| 129 | The **shell must resolve the rail-vs-⅓-column tension** — the detail's horizontal rail does not fit a third-width column, so the shell picks break-out-wider vs anchor-panel vs in-column | [prompt-02-shell] |
| 130 | The design system reaches Labs via **`/design-sync` from a LOCAL session** — a cloud session cannot authorize it | [LABS-PIPELINE] |

## 2026-07-26 — the opener shape, the card inventory, the process fixes

| # | Decision | Status |
|---|---|---|
| 131 | **The opener — a fourth control shape.** Top corners rounded, bottom square (`5px 5px 0 0`), earned only by **Gate** and **Field**, so a trigger reads as the top half of an already-open menu. Rejected on purpose: `.plate` (a container, not a control), `.door` (actions never open), `.seg` (a toggle switches) | ✅ supersedes the "two radii / one 7px chip" line [`style` §1, `wrangler-style` §3.0] |
| 132 | **Trips IS a card** — the card anatomy serves it, and it is the useful stress test for the row grammar because it is time-anchored | [Jac, LABS-PIPELINE] |
| 133 | **The base five are Units · Rentals · Customers · Trips · Categories**, plus the role **Dashboard** as a 6th. **Invoices is NOT a base card** — it becomes a back-office board. Confirms #44 over the shipped code, so **`config.js` → `GRID_CARDS` needs updating in Tier 2** (queued app work, not a design task) | ✅ **CURRENT** [Jac] |
| 134 | **Every Labs prompt must inherit this ledger, never re-derive from scratch.** Labs is blind to the repo, so anything absent from a prompt does not exist to it — a prompt that re-derives settled ground silently undoes it | [LABS-PIPELINE] |
| 135 | **A decision is not made until it has a row in this table.** The 07-20 snapshot going un-extended for six days is what let a superseded decision be cited as current | [this section] |
| 136 | **A Labs prompt MAY ask for several artifacts in one session, and container mockups STAY interactive** — both deliberate, both accepted as slower. Reviewed 2026-07-26 after Jac asked why one artifact takes so long: prompt-03 asks a single session for frame + header + row across ~17 rendered states, with live JS. Kept because designing the three **against each other** stops them drifting, and because clicking a row and watching it expand catches what a static state grid cannot. **Cost accepted:** slower builds, and a wrong part means re-running the whole prompt. **Do not "fix" the apparent conflict with "one screen = one Labs session = one artifact" by splitting these prompts** — the rule is about *scope of subject*, not count of rendered pieces | ✅ **CURRENT** [Jac] |
| 137 | **ACCENT ≠ STATUS — accent means USER AGENCY, status hues mean THE WORLD.** Selected row, active filter, hover ring, focus ring — anything that says *"you did this"* — is `--accent`. A status hue (red/yellow/blue/green/gray) always describes the **record's** condition, never the user's choice. Raised by the Tier 0.1a card artifact, which needed a colour for "you did this" that could not be mistaken for the world being on fire. **Accepted as a law** (Jac, 2026-07-26). Sharpens the existing "orange = touchable" line in `wrangler-style` §3: touchable is the affordance, agency is the *state* of having acted | ✅ **CURRENT** [Jac] |
| 138 | **Two atom gaps found by the 0.1a card artifact — real, not workarounds to keep.** (a) The kit has **no real text input** — Search is currently faked with a `.field`, which is an *opener* (it opens something) and therefore the wrong shape for free typing. (b) The **Pin's ring colour is hard-coded** to `--panel`, so a Pin breaks on any surface that isn't a panel. Both need fixing in the kit and re-syncing | ⏳ **OPEN — queued for the kit** |

## 2026-07-28 — the Labs handoff: a NEW DESIGN LANGUAGE, not just containers

The Tier 0.1a Labs session ended and handed back four artifacts, landed verbatim in
**`docs/design/tier-01-handoff/`** (`final-card.html` · `tier-01-card.css` · `atom-rebuild.md` ·
`labs-decisions.md`). **That folder is the detail; these rows are the index.** Labs' own table
carries ~39 rows at its own status grades — the rows below are the ones with blast radius, plus
Jac's rulings on the four that gated everything else.

⚠️ **Read #139 before any later prompt.** The session did not stay inside Tier 0.1: it replaced
the atom language underneath it. Prompts written against the old kit will now contradict the card.

| # | Decision | Status |
|---|---|---|
| 139 | **The 0.1a session produced a NEW DESIGN LANGUAGE, not a container pass.** Nine new components (slot rack · message board · footer terminal · grip rack · roll marker · laser frame · hint layer · jump band · dormant tongues), four new *finishes* (machined ring · well glass · dark key · pressed key), the radius ladder demolished, every control re-voiced to mono, hover rings deleted card-wide. **File it as Tier 0.0-replacement + 0.1, not "containers"** — the atom kit is now BEHIND the card and must be rebuilt from it | ✅ **CURRENT** [`tier-01-handoff/atom-rebuild.md`] |
| 140 | **RADIUS 0 + CHAMFERS IS THE CARD'S IDENTITY.** `border-radius:0` on seg/signal/pin/field/ref; containers are chamfer-clipped polygons; Refs and boards take 45° notches. **Supersedes the four-shape control ladder (#131, #127).** Reason: radii read as plastic against a machined frame; shape semantics moved into the finishes (key/press/well) instead | ✅ **LOCKED — Jac, 2026-07-28.** Reverses #131 |
| 141 | **The three rounded survivors are UNRULED, not decided** — Door keeps its pill, `.ref__icon` keeps 5px, the hint bubble keeps 9px. Labs marked these ASSUMED: *"never discussed; the demolition list simply never included them."* **Do not cite them as intentional** until Jac rules | ⏳ **OPEN — needs a ruling** |
| 142 | **MONO on every control atom; Archivo for prose only.** Ref was the last control speaking Archivo and is now mono. Archivo survives in hint bubbles and empty states. One instrument voice inside the machine | ✅ **LOCKED — Jac, 2026-07-28.** Narrows #127's "Archivo body voice" to prose |
| 143 | **The 24px control law is HELD, not broken — the shell decides.** The card introduces a second 17px/9px control size to serve 30px compact rows. **Do not treat the 17px tier as canon**: real column width (Tier 0.2) decides whether compact density is even necessary, and that ruling comes first | ⏳ **DEFERRED to Tier 0.2 — Jac, 2026-07-28** |
| 144 | **Three LOCKED decisions silently vanished during the session and are RE-IMPOSED as hard requirements on the next pass** (Jac, 2026-07-28): the **click contract** (#50/#62/#63/#67 — single-click expands in place, double-click anchors, 220ms discriminator, anchor icon → "+" on other expanded rows), the **group taxonomy** (#31/#34/#35 — attention groups hidden when empty, lifecycle groups always present and gray), and the **Dashboard as the 13th surface** (#44/#45/#86–89 — charts, not rows). All three were *in* prompt 0.1a and were still dropped | ✅ **RE-IMPOSED — must appear in the next prompt's Inherit list** |
| 145 | **New failure mode: DRIFT, not omission.** #134 assumed the danger was a prompt that never carried a decision. This session carried all three of #144's decisions in the prompt and lost them anyway, across hours of visual iteration — and the handoff did not notice, because a handoff reports what it *did* decide and is blind to what it stopped carrying. **Mitigation: an explicit "still honoured?" checklist of inherited decisions in every handoff prompt**, not just an Inherit list at the start | ✅ **CURRENT** |
| 146 | **The emission fiction — light is emitted BY GLASS, never applied TO STEEL.** Steel and chips stay matte (canon holds); terminal text, carets, open-row rack ticks and filled grip slots glow. This is how the card honours "matte — no glow" while still reading as an instrument | ✅ **LOCKED — Jac's dial, saved** [labs-decisions.md § Departures] |
| 147 | **Three filter chips, not two — Your Work · Open · Done.** *Open* (everything expanded here) is new; hovering its Pin turns it into a red ✕ that closes every open row. Each cell carries a Pin: hue = worst state in that bucket, number = count, hidden at zero. **Done wears green, Your Work falls back to accent** — Your Work spans red∪yellow∪blue, so no single status hue is honest (the #137 carve-out). Sort is not a chip; it lives behind the funnel key | ✅ **LOCKED.** Extends #37 |
| 148 | **UNITS and CATEGORIES are ONE card with a two-board pair seated in it** — the title *is* the toggle; tapping the active side opens a picker that reseats that half from the full board list, each row showing its own rollup Pin. Not two cards, no second frame. **This changes the grid inventory and must be reconciled with #133 in Tier 0.2** | ✅ **LOCKED — but flags a #133 conflict** |
| 149 | **The card header lost its description line.** Its context job migrated to the footer terminal + the per-group message boards. A `showDesc` computation survives in logic consumed by nothing — fossil. **Supersedes the locked description-line slot** in prompt 0.1a's header contents | ✅ **CURRENT.** Reverses part of §5 |
| 150 | **The footer terminal is the card's one voice**, and it is WHY hover rings could be deleted: every hover explanation moved there. Removing or demoting it re-orphans every hover that used to have a ring — it is load-bearing, not decoration | ✅ **LOCKED** |
| 151 | **#138(a) is SOLVED differently — the text-input gap closed by abandoning `.field` for search.** Search is now a raw `<input>` inside a well div with a measured glowing block caret; the funnel key is `.field`'s one surviving use. **#138(b) — the Pin's hard-coded `--panel` ring — is NOT addressed** and stays open | ⏳ **#138(a) closed · #138(b) still OPEN** |
| 152 | **A near-miss token was caught and must be unified: `#C28E54` vs the real `--tan` `#c2925a`.** Labs flagged it rather than shipping a second tan. ~20 further `TOKEN-GAP:` markers sit inline in `tier-01-card.css` naming the token each hard-coded value wants | ⏳ **OPEN — token pass queued with the kit rebuild** |

### 2026-07-28 (session 2) — ruling the ~20 PROPOSED/ASSUMED rows in `labs-decisions.md`

⚠️ **Drift caught before ruling, not after.** Grepping `labs-decisions.md`'s own status column
against this ledger found three rows still marked PROPOSED there that are **already ruled**: the
radius-ladder-off direction (labs row 27) is `#140` LOCKED, mono-on-every-control (labs row 33) is
`#142` LOCKED, and the 17px control tier (labs row 30) is `#143` DEFERRED. Those three needed no
fresh ruling — the file just wasn't updated after the ledger was. **Read the ledger, not a handoff
doc's own status column, for what's actually settled.** That leaves 17 rows ruled below (#153–#162).

| # | Decision | Status |
|---|---|---|
| 153 | **The three rounded survivors (#141), ruled.** Door's pill is **CONFIRMED, not an exception** — it predates Tier 0.1 (`#15`, wrangler-style's pill-action shape) and radius-0 (`#140`) never named Door in the first place, only seg/signal/pin/field/ref. `.ref__icon` (5px) and the hint bubble (9px) are **ZEROED to 0** — no prior lock, no reason to carve a new one now that radius-0 is the card's explicit identity | ✅ **RULED — Jac, 2026-07-28.** Resolves #141 |
| 154 | **Seg cell type HOLDS the canonical 11px/.05em — the 10px/.09em card-level shrink is REJECTED.** Per this project's own precedent ("when a decision and a rule conflict, the decision moves, not the rule"), `style`'s C5 pass rule ("one chip size") wins. The 380px overflow that motivated the shrink must be solved another way (shorter labels, tighter seg padding) in the Tier 0.2 rebuild | ❌ **REJECTED as designed — Jac, 2026-07-28** |
| 155 | **Three implementation-detail designs LOCKED as designed:** Ref re-cut (dark plate `#0B121B`, NE 45° notch, borderless, mono, fixed 152×17 slot, hover marquee for long names); the row-Signal fixed-width column formula (`max(66, longest-state × 7.15 + 14)px`); Pin's stud shadow + 10px mini size, with the kit's `data-tip` tooltip surviving only on Pins. **Flag:** the signal-column formula's 7.15px/char constant was measured against 11px mono and needs re-measuring now that row keys render at 9px, and again once #154 is implemented | ✅ **LOCKED — Jac, 2026-07-28** |
| 156 | **Three row-grammar mechanics LOCKED as designed:** open-row wash = group hue at 16% (a #137 application — an open row shows the group's state, not the user's click); picker rows carry each board's own rollup Pin (worst hue + count); sort lives behind the funnel key and the tray stays open whenever a non-default sort is live | ✅ **LOCKED — Jac, 2026-07-28** |
| 157 | **The flat off-white row-hover wash is REJECTED and REPLACED with a three-way, material-based hover system.** Steel (plates, controls, ordinary rows) gets a brightness/elevation lift only — no colour wash at all. Open-group terminal rows get an animated light-beam that wraps around the row on hover. Message-board glass (search well, footer terminal, group message board) gets a cursor-following gradient. This extends the card's existing finish vocabulary (steel vs. glass/terminal) and the already-locked emission fiction (`#146` — light is emitted BY glass, never applied TO steel). **Exact animation parameters (duration, easing, gradient formula) are OPEN** — to be prototyped in the atom-kit rebuild, not specified here | ✅ **LOCKED (direction) — Jac, 2026-07-28.** Supersedes labs-decisions.md's off-white hover-wash row; details open |
| 158 | **CORRECTED (see #163) — the jump-verb menu's DIRECTION is validated, not invented.** A "Gate = state button = next action, replacing a passive status chip" pattern is already LOCKED for Trips (`2026-07-20-list-views-inline-expand-design.md` §8.5, Jac 2026-07-21: Start → Arrived? → Dropped?/Picked Up?), and the 2026-07-19 dispatcher audit separately recommends the same for Rentals/Units (`docs/handoffs/audit-2026-07-19-rentals-dispatcher-remaining-work.md` §3, Bucket-B item 2: "make CTAs verbs"). Neither locks the SPECIFIC five words (Dispatch/Return/Confirm/Reopen/Reserve) — Trips' own verbs (Start/Arrived/Dropped/Picked Up) are trip-specific and don't transfer. **The verb-CTA pattern is LOCKED; the exact Units/Rentals wording per transition is OPEN**, deferred to Tier 0.2 alongside the real transition design | ⏳ **DIRECTION LOCKED, wording OPEN — Jac, 2026-07-28 (corrects the same day's earlier ruling)** |
| 159 | **CORRECTED (see #163) — the dispatcher group order is substantially REAL, not invented.** Jac supplied the literal per-card lifecycle group lists in the 2026-07-20 session (this ledger §3/§4, rows #31–35; also `2026-07-20-list-views-inline-expand-design.md`): Units (staff/mechanic) = Field Calls, Not Ready/Failed+Reserved, Not Ready, Failed, Transport, Reserved, On Rent, End Rent, Available, Incomplete (Office Work Needed); Units (office+) = same set reordered — Field Calls, Not Ready/Failed+Reserved, Transport, Reserved, On Rent, End Rent, Available, Incomplete, Not Ready, Failed; role-scoped reordering per #35. The Labs mockup's 5-group set is a simplified demo subset of this real list (not a fabrication — "Field Calls" first is correct), but incomplete and missing "Returned Today" isn't real anywhere. **Tier 0.2 wires the COMPLETE real list above** — not the demo's shorthand, and not `app.js`'s current `UNIT_SECTIONS`/`GROUP_DEFS` (`app.js:9158-9202`), which **predates and has not yet been updated to implement this 07-20 decision** (queued app work, like #133's `GRID_CARDS`). **The "Yard role" order variant is still DROPPED** — the two real roles are staff/mechanic and office+, not "Yard"; the drag-reorder mechanism itself already ships (`GROUP_ORDER`/`customGroupOrder`, `app.js:9248-9265`) | ⏳ **REAL LIST IDENTIFIED, Tier 0.2 wires it — Jac, 2026-07-28 (corrects the same day's earlier ruling)** |
| 160 | **All placeholder row/rollup data (names, S/Ns, rollup counts, sigCount) is CONFIRMED as demo filler only** — Tier 2 wires the real numbers, per the mockup's own note. No further ruling needed | ✅ **CONFIRMED — no ruling required** |
| 163 | **New failure mode: treating stale `app.js` as the source of truth for what's DECIDED.** #158 and #159 were first ruled by checking the Labs mockup's group order and jump verbs against shipped `app.js`/`config.js`, and rejecting both because they didn't match. **Wrong test.** `app.js` had not been updated to implement the 07-20/07-21 decisions (per-card group lists §3/§4; the Trips gate-verb pattern §8.5) or acted on the 07-19 dispatcher audit's Bucket-B recommendations — it lags the decision trail, not the other way around. Jac caught this same-day: *"Not the production. It is not up to date on our decisions."* **Corollary to #134/#145:** a prompt or ruling can drift not just by omitting a locked decision, but by consulting the wrong artifact for what's locked — checking shipped code instead of the spec/ledger/audit trail. When production and a design decision disagree, check which one is stale before assuming the newer artifact is wrong | ✅ **CURRENT — Jac, 2026-07-28** |
| 164 | **#144 is WRONG about the card — the click contract was never dropped from it.** #144 records three re-imposed decisions as having "silently vanished during the session," but building the rulings into the card found the click contract present **in full**: the 220ms single/double discriminator, single-click expand-in-place, double-click anchor, state chips calling `stopPropagation` so the row contract can't fire underneath (#67), and **both** anchor-icon branches — `isAnchorIcon` when nothing else is anchored, `isPlusIcon` when something is, which is #63 exactly. What vanished was the decision's presence in the **prompt**, not in the **artifact**; the handoff reported on the prompt and could not tell the two apart. **This is the third instance of #163's failure mode** (checking the wrong artifact for what's true) and the second where the mistake ran in the pessimistic direction — assuming work was lost when it was already done. **Before re-imposing a decision, check the artifact, not the paperwork.** The group taxonomy (#31/#34/#35) was likewise found already implemented as `kind:'attention'` vs `kind:'lifecycle'`. Only the Dashboard-as-13th-surface leg of #144 remains genuinely unaddressed | ✅ **CORRECTS #144 — 2026-07-28** |
| 161 | **Timing tunables LOCKED as designed:** jump band (450ms settle-armed, warm-swap between rows, 320ms leave grace); hint layer (540ms dwell, instant re-hover swap, suppressed under open jump bands); boot theatre (CRT flicker + laser drop + per-row type-in, `steps(16)` .07s stagger, on group open) — confirmed fine as designed, ties to the already-locked emission fiction (#146) | ✅ **LOCKED — Jac, 2026-07-28** |
| 162 | **Width breakpoints ACCEPTED PROVISIONALLY, not locked permanently:** grip rack shown ≥330px; facts column shown ≥440px; "Your Work"→"Work" label shrink <420px; when-column (96px) shown ≥440px. These are Labs' own untested numbers — re-verify against real column widths once Tier 0.2 settles the shell | ⏳ **PROVISIONAL — re-verify in Tier 0.2** |
| 165 | **The `collision` group's DISPLAY LABEL is renamed `Not Ready/Failed+Reserved` → `Reserved: Not Ready`** (25 chars → 19). **The bucket is unchanged** — same `id:'collision'`, same membership: (Not Ready OR Failed) AND Reserved, the broken-machine-promised-to-a-customer collision (decision-notes finding #51). Only the words on the head change. This closes the card's own KNOWN-OPEN comment, which called it correctly: the label overran the head at the locked 380px compact width, a max-width clamp would not hold inside the head's flex row, and *"the fix is a decision, not CSS."* **Supersedes the label only** in #159's per-card group lists and in §3/§4 — those lists stay authoritative for group SET and ORDER; do not retro-edit the 07-20 records, per #163. **Flag:** the new label names the *reserved* leg and leaves *Failed* implied under "Not Ready". That is correct if Failed ⊂ Not Ready in the yard's usage; if a Failed-but-Reserved unit must read as Failed on the head, the label needs a third word | ✅ **LOCKED — Jac, 2026-07-30** |

## 2026-07-31 — the row-button/two-level-mechanic thread

Jac's architecture proposal (group = housing that racks open, mechanical/steel/no light; row =
cartridge that lights up, glass/terminal/emission — `#146`'s emission fiction applied at a second
level) was put to him via popup alongside the collapsed-slot numeral question that fell out of the
GROUP HEAD slot-rack work (pins retired in favour of skewed-tick slots this session, not yet in the
repo).

| # | Decision | Status |
|---|---|---|
| 166 | **A collapsed slot shows a numeral only — no status word.** The status word is what overhung the cell (rendering "OPEN" as "PEN"); dropping to a compact numeral while collapsed removes the wide text entirely, and the full word is deferred to the hover-unfurl | ✅ **LOCKED — Jac, 2026-07-31** |
| 167 | **The two-level mechanic (group = racking housing, row = lighting cartridge) is NOT yet ruled — Jac wants a non-destructive prototype first.** Do not relocate #146/#161/#139/#140/#156/#67/#164 or drop the head rack's 8-tick cap until Jac sees it in motion and rules go/no-go. Build via Playwright CSS/JS injection against the sandboxed prototype, never by editing `docs/design/tier-01-card/index.html` directly | ⛔ **SUPERSEDED by #168 (same day) — Jac ruled BUILD** |

### 2026-07-31 (session 2) — P1 ruled, and the three calls that came with it

Put to Jac as one batched set (the popup was declined; delivered inline as lettered options, per
the single-attempt fallback rule). All four answered. **`docs/superpowers/specs/2026-07-31-tier-01-head-row-design-log.md`
is the trail** — revert points R0–R7, the CSS for each, the rejection table, and the measurements
these rulings lean on.

| # | Decision | Status |
|---|---|---|
| 168 | **P1 IS BUILT — the two-level architecture is LOCKED.** `GROUP = housing, opens by MOVING` (steel · mechanical · **no light**); `ROW = cartridge, opens by LIGHTING` (glass · terminal · emission). This is `#146`'s emission fiction applied at a second level, and it is the fix for the *"don't break plot"* risk: two nested open/shut mechanisms in one visual language collapse the level distinction, so the two levels are given **different physics** rather than different amounts of the same physics. **Invariant that holds at BOTH levels: the name is right-aligned.** Middles may differ (heads have no button and no facts). **Six rows relocate, none break:** `#146` holds but its *application* drops a level · `#161` boot theatre (CRT flicker, laser drop, per-row type-in) moves group-open → **row-open** · `#139`/`#140` laser frame moves group → row · `#156`'s open-row wash needs revisiting and may become the cartridge's lit face · `#67`/`#164`'s 220ms click discriminator must be re-checked against a much larger expand event · `atom-rebuild §1`'s 8-cap and fixed 114px board both go (see #170) | ✅ **LOCKED — Jac, 2026-07-31.** Supersedes #167 |
| 169 | **The laser-drop trade is TAKEN — the laser drop moves from groups to open items.** Groups get a purely mechanical opener; rows take the laser drop and keep the message board. Jac had flagged this proposal unread; it reaches #168's conclusion from the *opposite* direction (from the opener rather than from `#146`'s emission fiction), which is corroboration, not coincidence — two independent routes to the same steel/glass split. Implements the `#161`/`#139`/`#140` legs of #168 | ✅ **LOCKED — Jac, 2026-07-31** |
| 170 | **The tick cap is RETIRED — and the reason generalises into a layout law.** Jac: *"No need for a cap if the slots are the last thing while all elements are left or right aligned."* **The law: every other element in the head is edge-anchored (left or right), so the slot rack is the one element that takes the RESIDUAL width.** A cap is therefore meaningless — the rack simply fills what is actually left, and `+N` appears only when real width runs out, never at an arbitrary count. This retires **both** the head spec's 8 and R5's rendered 10, and confirms §2.5's measurement: the 8-cap was never about ticks, it was the message board's fixed 114px reserving the space. Freeing the board is what makes the right-condensed head of #168 able to run slots at full width | ✅ **LOCKED — Jac, 2026-07-31.** Retires `atom-rebuild §1`'s 8-cap |
| 171 | **"Failed" is DROPPED from the group-head label but KEPT AS A FILTER TERM.** Closes #165's flag. The head reads `Reserved: Not Ready` (19 chars) and does **not** grow a third word — so the width problem #165 solved stays solved — but *Failed* must remain reachable as a **filter/search term** against the same `collision` bucket. The distinction is display vs. addressability: a word can stop being *shown* without ceasing to be *findable*, and a Failed-but-Reserved unit is still retrieved by searching "Failed". The bucket itself is unchanged for the third time — same `id:'collision'`, same `(Not Ready OR Failed) AND Reserved` membership | ✅ **LOCKED — Jac, 2026-07-31.** Resolves #165's open flag |

### 2026-07-31 (session 3) — P1 landed in the prototype

Jac's call was **land R2→P1 in the prototype** — the ledger said P1 was locked while the artifact in
git still showed R0 + the rename, and that decided-vs-shown gap is the exact failure mode of #163,
#144/#164 and the stale-ledger episode. Two rulings came with it.

| # | Decision | Status |
|---|---|---|
| 172 | **The lit cartridge's face is NEUTRAL glass; the laser frame carries the state hue alone.** One hue channel per level: the frame says *which* state, the glass says *this one is powered on*. **Supersedes `#156`'s open-row wash for the LIT row** — the group-hue-at-16% wash and a hue frame on the same element stated the hue twice. #156 still stands for anything that is not a lit cartridge | ✅ **LOCKED — Jac, 2026-07-31.** Narrows #156 |
| 173 | **The 220ms single/double click discriminator is KEPT EXACTLY AS IS** (`#67`/`#164`), even though a single click now powers on a whole cartridge rather than expanding a row. **Consequence for the build: P1 must not add a competing click handler.** The card signals an open row by writing an inline `color-mix` wash; the P1 layer *detects that and re-skins it*, so the click contract is untouched and the discriminator keeps working underneath. Verified: the row's centre point sits on the `.signal` chip, which `stopPropagation`s per #67 — clicking there correctly does **not** open the row | ✅ **LOCKED — Jac, 2026-07-31** |

**Landed, not just designed.** `docs/design/tier-01-card/index.html` now carries R2→P1 as a runtime
block (design log §5.8). Verified with **zero injection**: 10 housings, 20 cartridges, no light on
steel, no overflow at 380px, and the only console output is the two SVG parser warnings the
prototype's own README already puts on the ignore-list.

| 174 | **MEASURED CORRECTION — the verb conversion does NOT pay the width bill.** Design-log §2.6 claimed the #158 verb-CTA conversion reclaims ~22px, *"which is most of what the facts column needs… the cheapest way to fit the row."* **The first half is right, the second is wrong.** Measured against the landed card: #155's formula reproduces exactly (`max(66, 11 × 7.15 + 14)` = 93px, matching what renders); swapping the chip **text** to verbs reclaims **0px**, because the chip is an inline `width:93px; flex:0 0 auto` **fixed column** — the saving only exists if `stateW` is *recomputed*; recomputed for an 8-character verb set it is **71px**, so **22px is real**. But with facts restored at 71px the name column gets **40–48px**, while `Excavator 12k` needs **103px**. And #155's own `max(66, …)` floor caps the chip at 66px, so the **largest possible reclaim from any verb set is 27px** against a ~59px shortfall. **No choice of wording makes facts fit at 380px.** Consequence: do the verb conversion for its own merit (it is #158's locked pattern and it removes the §5.7.3 board/button duplication), **not as a width fix**. Facts stay dropped per #162; fitting them needs a wider column in Tier 0.2, not shorter words | ✅ **MEASURED — 2026-07-31.** Corrects design-log §2.6 |

| 175 | **The verb WORDING is deferred to a future Fable-5 pass that reads the BACKEND and derives the full verb library.** Jac, 2026-07-31: *"Verbs accuracy does not matter because someday I will use fable five to read the back end and come up with the full library of verbs."* **Consequence — do not spend effort on word accuracy.** The card's `JUMPWORD_BY_STATE` map (`index.html` ~1234) is an explicit **placeholder**, correctly self-marked *"PROPOSED, NOT RULED"*; it exists so the pattern can be judged, and it should not be polished, audited, or debated word-by-word. What IS settled and must survive that pass: the map is keyed by **STATE, not tone** (tone-keying made every red row say the same verb whether it was an overdue field call or a failed hydraulic), and #158's verb-CTA **pattern** stays locked. This narrows #158's open leg — the wording is not merely "open", it has a **named owner and mechanism** | ✅ **DEFERRED WITH A MECHANISM — Jac, 2026-07-31.** Refines #158 |

| 176 | **ROW ORDER RULED — the row is the HEAD's grammar plus a left-anchored button.** Jac, 2026-07-31: *"From right to left: Name, Message board, slots. Then aligned to the left is the button."* Left-to-right that is **`button · slots · board · name`**. **Supersedes R7's order** (`board · button · slots · facts · name`) for the P1 era; R7's CSS block in the design log is deliberately **not** rewritten, because it is a revert point. Why this is more than a reshuffle: the head already reads *name · board · slots* right-to-left, so the row now carries **the same grammar**, and the button — the one element a head does not have — becomes the row's left anchor. That is exactly what P1 meant by *"middles may differ (heads have no button and no facts)"*, resolved in the direction of maximum shared structure. **#170's residual law now applies at BOTH levels:** every other element is edge-anchored, so the slot rack takes what is left, on a row as on a head. Rejected en route: slots-third (R7 as built — legal under P1's invariant, but it parked the rack 199px from the head's) and slots-first-at-both-levels (aligned the two racks to 18px but put the button in the middle) | ✅ **LOCKED — Jac, 2026-07-31.** Supersedes R7's order |
| 177 | **SLOTS REPLACE PINS EVERYWHERE, AND SLOTS UNFURL — so #147's ✕-on-hover has to move.** Jac, 2026-07-31: *"The slots SHOULD unfurl tho. So the directly replace pins."* This **rejects** the reading that a filter chip's marker is a `Pin` (count, does not unfurl) while only a group/row carries a `slot` rack — there is no such split. The slot **is** the pin's replacement on every host, including the three filter chips, and unfurl-on-hover is the slot's universal behaviour. **Consequence: the collision in `#147` is real, not dissolved** — the Open chip's slot unfurls on hover, so the red **✕ close-all cannot also live on hover**. The ✕ needs a different affordance; that placement is the one piece still open | ✅ **LOCKED — Jac, 2026-07-31.** Forces a change to #147 |

| 178 | **CLOSE-ALL MOVES TO A CLICK ON THE OPEN CHIP ITSELF — the ✕-on-hover is retired.** Resolves the collision `#177` forced. Hovering the Open chip's slot **unfurls** it, like every other slot on every other host, so the red ✕ cannot share that gesture; instead, **clicking the Open chip while it is the active filter closes every open row.** Chosen over the alternatives because it adds **no new element, no new hover behaviour, and no control the other two filter chips lack** — the chip already means *"everything expanded here"*, so acting on it is the honest place to close them. **Amends `#147`**, whose "hovering its Pin turns it into a red ✕" clause is now dead: the Pin is a slot (#177), and its hover is spoken for | ✅ **LOCKED — Jac, 2026-07-31.** Amends #147, closes #177's open piece |

| 179 | **FRESH-CONTEXT REVIEW CAUGHT SIX REAL BUGS IN THE LANDED P1 BLOCK — two of them invalidated claims this ledger had already made.** Logged because both failures are *classes*, not one-offs. **(a) The housing mechanic was DEAD.** The block appended its stylesheet — containing `.gate__chev{display:none}` — *before* its first build, and `getComputedStyle` on a `display:none` element returns `transform:none` regardless of the inline value, so every gate was pinned to `data-open="1"`: the `translateY(-1.5px)` never turned **off** and all five dimmed shut-face colours were dead CSS. **The §5.7.1 "measured proof" of the two-register split was therefore measuring a state that never un-measures** — a reminder that *a measurement only proves something if the negative case can occur.* Fix: read the chevron's **inline** transform, which survives hiding. **(b) dc-runtime RECYCLES row/head nodes rather than replacing them**, so the once-only "a rack already exists here" guards left racks, boards and `data-tone` describing a **different unit** after any filter or search — and a wrong `data-tone` mis-colours the laser frame that #172 makes the sole hue carrier. Fix: a `data-rwsig` content signature, rebuilt on change. Also fixed: the sweep permanently hid the jump band on a row that unmounted while open; `.rw-noframe` hid five chassis elements beyond the laser (#169 takes only the laser — the side rails, U-groove and tongues are steel the housing keeps); lifecycle groups with nothing open read `N OPEN` because head counts fell back to member **state** text rather than real issues (now `NOMINAL`); and `+N` was specified by #170 but never emitted, so excess ticks clipped silently (now implemented). **Verified after fixing:** 10/10 frames hidden and all genuinely frames, collapse→`data-open="0"`+`#c26161`, reopen→`-1.5px`+`#ff8080`, all Done-filter rows match their own record, all 10 heads correct, jump band survives remount, zero emissive shadows on the housing, no overflow, no page errors | ✅ **FIXED AND RE-VERIFIED — 2026-07-31** |

| 180 | **#156 CLOSED — the laser frame carries the hue alone; the lit cartridge face does NOT also keep the group hue.** Confirmed by Jac, 2026-08-01, ahead of cascading Tier-0.1 into the kit/atom-rebuild/Labs prompts: asked directly whether the lit face should keep the group hue in addition to the frame (which would state the hue twice, the thing #172 was written to avoid) or the frame alone (#172 as written). Jac chose the frame alone. **This makes #172's resolution final, not provisional** — the "still open by design" note in `docs/handoffs/2026-07-31-cascade-tier01-decisions.md`'s "State at handoff" section is resolved. #156 itself still stands for anything that is not a lit cartridge (picker-row hue, per #172) | ✅ **CLOSED — Jac, 2026-08-01.** Finalizes #172, resolves the last open P1 relocation |

| 181 | **#152 CLOSED — the token pass landed.** All ~20 `TOKEN-GAP:` markers in `tier-01-card.css` now have a named token in `tokens.css` (`--lit-rgb`, `--seam-1..5`, `--well`, `--key`, `--ref-plate`, `--steel`, `--steel-plate`, the 10-colour steel accent-seed map, `--lit-cool-rgb`, `--tray`, `--void-rgb`/`--void-solid`, `--groove`, `--slot-off`, `--row-hover-base`, `--term-dim-base`). The `#C28E54` near-miss **unifies** to the existing `--tan` (`#c2925a`) rather than becoming a second tan — #152's own text already called this outcome ("must be unified"), so no fresh ruling was needed. Landed as part of cascading #140/#142/#152/#153/#177 into `docs/design/rw-design-system/` (the kit) | ✅ **CLOSED — 2026-08-01.** Resolves #152 |

| 182 | **THE GATE SHOWS THE ITEM'S BIGGEST LEVER, AS STATE — and it is "a big expanded slot."** Jac, 2026-08-01: *"the one button at the row level should always be the biggest lever that item has… Colour still carries signal. A gate bares that colour. Hover the gate and the message board tells you the signal just like for slots. Basically the gate is a big expanded slot."* This gives the row ONE state ladder with ONE interaction contract instead of three unrelated parts: **slots** = the *many* issues (numeral-only collapsed, #166) · **gate** = the *one* biggest lever (the word, permanently expanded) · **board** = the why. Point at any of the three and the board narrates it. The gate stays a **lever, not a readout** — the kit's own law is *"Gate is the one Signal you can turn"*, so clicking it turns the state (opens the picker); that IS its actuation. **Verbs do NOT move onto the gate — they already live in the jump band** (`atom-rebuild §8`: settle-armed band, leading verb cell in the row's hue, + Extend + Call), so a verb gate would duplicate the band exactly as design-log §5.7.3's board-vs-chip collision duplicated the state. Final split: **gate = what it is · board = why it matters · jump band = what to do.** **Rejected en route:** gate-as-verb, argued from the 07-19 dispatcher audit's Bucket-B item 2 (*"Status pills read as nouns; the next action isn't obvious. Make CTAs verbs"*). It lost on three grounds — (a) a verb in the row's **status hue** is, by the kit's own taxonomy, *a Door wearing a Signal's colour*, the one combination the vocabulary forbids (*"Door… never borrows a status hue to mean 'click me'"*); (b) a verb is **recoverable-forward but not backward** — `Return` gives the move but discards the condition a dispatcher needs to judge it, and the audit asked "what's urgent" and "what next" as **two** findings, so answering the second by deleting the first is not a fix; (c) the width case for verbs was already dead (`#174`) | ✅ **LOCKED — Jac, 2026-08-01** |

| 183 | **`#158` is NARROWED, NOT REVERSED — gate-as-verb survives exactly where the lever is LINEAR.** Trips (`list-views §8.5`) reads `Start → Arrived? → Dropped?` and was the precedent `#158` cited. It is **not** a counterexample to `#182`: for a trip stop the biggest lever *is* its progress through a linear state machine, so the state and the next action are the same fact. One rule covers both — **the gate shows the item's biggest lever; where that lever is a linear progression it surfaces as a verb, where it is a condition it surfaces as a state.** So Trips keeps its verb gate (and its action-blue `--commit`, distinct from state-blue `--blue`, per §8.5's "two distinct blues"); Units/Rentals/Customers take state gates. `#158`'s "verb-CTA pattern is LOCKED" stands **for linear-lever items only**; its implied application to Units/Rentals is superseded by `#182`. Per `#163` this is a new row, not an edit to `#158` — grep `#158` and you land here | ✅ **LOCKED — Jac, 2026-08-01.** Narrows #158 |

| 184 | **The per-card GATE AXIS is DEFERRED — deliberately out of scope for the design project.** Jac, 2026-08-01: *"Can we decide the axis later? This project is about design. Not speccing the app."* `#182` fixes the **rule** (the gate shows the biggest lever, as state, bearing its colour, narrated by the board on hover); **which** field is the biggest lever per card is product content, not design language. Jac's working sketch — Units = inspection status *(staff/mechanic)* or availability/rental status *(office+)*, Rentals = rental status, Customers = account status — is **an illustration of the rule, NOT a ruling**; do not cite it as locked. Note it would make the gate the first atom whose *content* is role-scoped (precedent exists at `#35` for role-scoped group ordering), which is itself a reason to rule it deliberately later rather than let it arrive by inheritance | ⏳ **DEFERRED — Jac, 2026-08-01** |

**Still needing Jac after this set** (§7 of the design log, minus what #166/#168–#171 closed):
**rack placement on rows** (§7.2) and **the `#147` collision** — the Open chip's ✕-on-hover vs the
collapsed slot's expand-on-hover, two hover behaviours on one element (§7.3). Both were deliberately
held back rather than asked blind: they are downstream of #168, which reshapes the row, so ruling
them before the cartridge exists would have settled a layout that is about to change.

## Still open after 07-20 (do not treat as locked)

- **`labs-decisions.md`'s remaining open items** not covered above: the Tier 1 drawer is a
  placeholder, teleport is a stub, cross-board search (globe) is unspecified, board quick-search
  persistence was asked and never answered, density standard/roomy was never reviewed off compact,
  and `stateW`'s 7.15px/char formula needs re-measuring (see #155's flag).
- **The card header's seating — 1a / 1b / 1c** (Tier 0.1a artifact §2.2). Two bands (identity over
  controls, the artifact's recommendation), one band, or identity-cap + filter rail in the body.
  **Jac has not chosen.** Do not treat 1a as settled just because it is marked RECOMMENDED.
- **The drop order under narrowing** — the artifact proposes *glance frequency*
  (sort → search → description → chip words, with title Ref / rollup / Door never dropping).
  **Jac has not ruled.** Undecided.

- **The Detail-view structural reshape** (#119) — deferred pending its own reviewed pass.
- **Invoice line-item IDs as Ref vs Stamp** (#116) — shipped as Ref, explicitly flagged as revertible.
- **Everything in the 07-20 "Still open" list above** — signature motif, commit-blue shade, Mr.
  Wrangler's channel placement, KPI rings, the all-cards Sort redesign, the fill-rule edge case.
  None of these were settled since; **do not promote them into a prompt as if locked.**
