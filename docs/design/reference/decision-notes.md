# Running decision notes (lines 1-2000 of transcript)

## Phase 0 — research (lines 1-1390): no design decisions, pure audit gathering.
- 171 findings -> 25-job taxonomy -> ~399 findings total across list/phone/surfaces/traces/detail waves.
- Not relevant to ledger except as backdrop.

## Phase 1 — brainstorming begins (msg 93/94, line 1391+)
- Jac's ask: plot mockup of app's needs, "narrow DNA" - fewest builder functions/design elements to cover the ground.
- 5-part DNA proposed: WORD / NUMBER / SIGNAL / DOOR / PLACE (early names, from Bill-of-Materials artifact)
  - SIGNAL = urgency that climbs row->group->tab->yard count, ranks by severity
  - NUMBER = one honest owned figure, provenance/drill-through
  - DOOR = verb-first action + its own guards (reachability R5 + reversibility R4 merged into one part)
  - WORD = durable, addressed inbox (messaging)
  - PLACE = one grammar/kept-structure across cards
- Q&A (msg 102): Jac never explicitly answered Q1/Q2/Q3 directly via popup (dropped) - conversation moved on organically (kept 5 parts implicitly, confirmed via later "5+1" resolution documented in spec §5).
- DECISION (msg 117, Jac): "Keep the WHERE, reinvent the HOW" - do not redesign layout/structure (3 columns, mini-calendar rentals view, toggleable cards) but DO discard current colors/hierarchy/pills/buttons/text/components entirely. [DOCUMENTED - wrangler-style §4 "Keep where things are" + intro]
- DECISION (msg 117/123): Need isolated staging build wired to real backend data, read-only, must NOT touch trunk/live, must be revertible.
  - Q1 Home: Jac picked **B - reuse staging-2 slot** (not a dedicated new repo) "because we're going to merge cards we like into trunk possibly as we go" - hope is redesign simple enough to push to production piecemeal. [NOT in the 4 docs read]
  - Q2 Backend data: Jac picked **B - read-only on live data**, no separate sandbox copy/backend needed. "We're not changing the business/app or workflows. We're improving how workflows appear... We shouldn't need to write to the backend." [NOT documented in the 4 docs]
  - Q3 Look direction: Jac picked **ALL THREE (A+B+C combined)** - "cover as much ground with as few visual systems as possible without losing workload or quality... Too simple and users can't build muscle memory... too complicated = zoo of systems... Visuals should be recognizable across cards. Structures, popups, menus, toggles, pills, everything should be reusable... call on the same builders, references, tools, functions." [Partially documented as design philosophy generally, but this specific process decision/rationale is NOT captured]
- DECISION (msg 129/130): Rollback safety net -
  - Frontend: live production commit 0fac006 tagged/noted as restore point (revert = point production branch back at 0fac006)
  - Since view-layer only reads backend (no writes), reverting frontend automatically preserves all backend data (transactions/payments/history) - "already free" rollback
  - Redesign should ride behind existing FEATURES flag for instant runtime-toggle revert (generic FEATURES-flag practice IS documented in CLAUDE.md - but the SPECIFIC decision to apply it to THIS redesign is not written anywhere)
  - Backend data snapshot (private Drive copy of Live Database + Daily Category Report) - offered, pending Jac go [check later msgs for resolution]
- Visual direction chosen (msg 128, Jac): "Field Steel has the best text and shapes. The solid fills are good but maybe consider also using the no-fills of C [Signal]." + "I do like organizing by work like C. Using color for attention is a good move."
  -> synthesized as V3 Hybrid (msg 131): only the single WORST thing per card is solid; everything else needing attention is outlined. [DOCUMENTED conceptually via style.css fill=today function + wrangler-style Signal/Gate defs, but the ORIGIN story / the V1/V2/V3 hybrid naming is not captured]
- DECISION (msg 133, Jac corrections applied verbatim, all accepted by Claude):
  1. Customers = strict ONE-LINE row rule (kept, not 2-line) [existing structural fact, arguably "keep-the-map" already covers implicitly, not explicit]
  2. Units & Rentals KEEP their mini-cards (week-grid calendar for Rentals w/ route rail; tiles w/flags for Units) - restated/reconfirmed
  3. Card titles ARE toggles (Units<->Categories, Rentals<->Calendar, Customers<->Sales) - kept
  4. "Chip" made an explicit, unmistakable component (predecessor of Signal/Gate/Stamp)
  5. COLOR RULE LOCKED: "color = attention only." Red = needs-you-now, amber = needs-you-soon (real time-sensitive, e.g. wash due). Healthy/neutral states (reserved, new lead, on-rent, current) are neutral/monochrome/grey, NEVER orange/amber. This directly kills "amber meaning 3 unrelated things." [This is essentially the ancestor of style §6 colour=state / fill=today, but the explicit LOCK MOMENT and the "amber ban on healthy states" phrasing / examples aren't in the docs]

## Section: color/groups system (lines 2000-2570) — MAJOR undocumented area
This entire "Groups + Color + Role + Quick-filter" design thread is NOT in any of the 4 read docs
(confirmed: only 2026-07-20-list-views-inline-expand-design.md + critique-log exist for 07-20; neither
mentions groups/color-semantics/Your-Work/Done chips). Style.md's §6 taskState/triggeredToday is the
generic MECHANISM (documented) but the actual CONTENT of the decision (which color means what, the
group taxonomy, the filter chips) is not written anywhere.

- Jac revealed HIS ORIGINAL R/Y/G system predates this project: Red=blocking/gates, Yellow=needs doing,
  Green=nothing to do. Considered launching a whole separate project around it (msg 142/144).
- Claude's research-grounded critique: red wasn't rationed (finding #31, 44/60 rows red) and green lied
  by being assigned via lifecycle not health (findings #54/#102/#53, e.g. 1,139hr-overdue machine shown
  green "Available"). Fix = SIGNAL rollup (a group is only green if truly all-clear).
- FINAL LOCKED COLOR SEMANTICS (evolved over msgs 144-193, superseding several intermediate proposals):
  - Grey = N/A / nothing (silent, quiet default)
  - Blue = **Waiting** — "the ball's not in your court" (someone else's move: vendor, customer, clock,
    another dept). Explicitly chosen over "routine/do-later" (msg 167-170) because the app had NO
    representation for in-flight/pending states (ACH mid-settlement rendering identically to overdue —
    S13/S14; part-on-order; quote awaiting signature). Confirmed via "Reserved = Waiting" (waiting on
    pickup) and proven on all 3 cards (part-on-order/Units, awaiting-sign/Rentals, ACH-processing/Customers).
  - Yellow = **your move, now** (do-now / needs action) — kept clean/singular meaning once blue absorbed
    "waiting" and routine work; this fixed Jac's "does yellow feel negative" worry.
  - Red = **Bad** (expanded from Jac's original "blocked only" to general "bad/wrong") — Jac explicitly
    widened it in msg 146: "Red = Bad, Yellow = Need To Do, Green = Done, Grey = N/A." Blocking-specific
    meaning was recovered via the FILL bit instead of spending a 6th hue (see below).
  - Green = **Done (today)** — a completion/recency state, not a permanent badge. Ages to Grey the next
    day ("settles," "handled, ambient"). "Done re-alarms": if a completed item reverts to bad, it snaps
    back to Red directly (not amber/yellow first). Recency window = calendar-day ("Done today"), same
    rule on every card (serviced unit / returned rental / called customer all "settle" identically).
  - ONE function assigns color: no renderer improvises its own color (root cause of the original R/Y/G
    system's failure per the research — each card/renderer computed its own color independently).
  - Rollup precedence, hottest wins: **red > yellow > blue > green > grey** (msg 162/164) — EXPLICIT
    ORDER, not written in style.md (style.md only lists bucket names, no explicit precedence order).
  - Buttons carry NO status color — made neutral (white/ink primary "click me," ghost secondary,
    "never a status color") specifically to stop blue doing double duty as both a button-affirm color
    AND a status color (msg 152-153, "Status is a thermometer, actions are neutral" artifact). This is
    the origin story for wrangler-style §3 Door's "no status colour on a button" rule.
- GROUP TAXONOMY (two flavors of ONE rule: header color = worst item inside, i.e. rollup) — msg 162:
  - **Attention groups** (e.g. Field Calls, Failed) — exist/appear ONLY when something's wrong; HIDDEN
    WHEN EMPTY. Colored because membership itself IS the bad state.
  - **Lifecycle groups** (e.g. On Rent, Reserved, Available, End Rent) — ALWAYS present, grey-by-default,
    take color only when a member inside triggers it. NO group has a fixed/native color (explicitly
    rejected a "native color" for On Rent, msg 162, to prevent green-lying repeat of findings #102/#54).
  - **End Rent is inherently yellow** (its membership = due-back-today by definition) until a red inside
    overtakes it — this is how finding #110 (no forward-looking "due-back" bucket) got fully solved,
    replacing an earlier idea of encoding "due back" only via color inside On Rent (msg 163-164 correction).
  - Initially explored "first-match cascade" (a record could match multiple groups, land in first match)
    — Jac clarified this was a misunderstanding: Today/Tomorrow/This Week are RESERVATION START dates,
    not return dates, so it's a clean single-stage lifecycle timeline, NO cascade logic needed (msg 165).
  - Real group lists Jac supplied as the starting point (msg 154), to be used as the actual per-card
    lifecycle groups:
    - Customers: Past Due, Not Due, Reserved, On Rent, Members, Non-Members
    - Rentals: Today, Tomorrow, This Week, On Rent, Off Rent, End Rent, Returned, Quote, No Show, Cancelled
    - Units (Staff/mechanic view): Field Calls, Not Ready/Failed+Reserved, Not Ready, Failed, Transport,
      Reserved, On Rent, End Rent, Available, Incomplete (Office Work Needed)
    - Units (Office+ view): Field Calls, Not Ready/Failed+Reserved, Transport, Reserved, On Rent,
      End Rent, Available, Incomplete, Not Ready, Failed
  - "Not Ready/Failed+Reserved" as its OWN top bucket = the broken-machine-promised-to-a-customer
    collision (finding #51) getting a dedicated home.
  - Groups must NOT be named after status ("Bad"/"To-Do") — that double-encodes what color already
    says. Groups say WHERE in the workflow; color says HOW MUCH it needs you (msg 154-155 correction
    of Claude's own earlier "Bad/To-Do" group naming mistake).
  - Role-scoped group ORDER (not different groups, same set reordered): mechanic floats Not-Ready/
    Failed to top; Office sinks them, floats dispatch/billing to top instead — proven via a live "Units,
    two roles" artifact (msg 155-156). General principle stated: **"Your Work" grouping/filter engine is
    universal; role supplies the priority/definition — role sets defaults, never walls off** (a mechanic
    must still get pinged if a rental he's on goes overdue — cross-role taps still fire). This is a
    DIFFERENT "role sets order" decision than the one already documented in the inline-expand spec §2
    (which is about SECTION order inside an EXPANDED item) — this one is about LIST-CARD GROUP order.
- QUICK-FILTER CHIPS (header-level, not a group) — msg 146-160:
  - **"Your Work"** chip: hides any group holding only Green/Grey (all-clear); shows only groups
    containing Red/Yellow/Blue. Does NOT re-bucket items — only hides/shows whole groups. Carries a
    rolled-up count. The ONE filter that means the same thing on every card ("hide what's handled, show
    what needs me") — deliberately chosen over 4 separate time-based chips (Today/Tomorrow/Week/Done)
    because those are Rentals/Calendar-specific words that don't fit Units (service-language) or
    Customers (money/lead-language) — would have broken "same builder everywhere."
  - **"Done"** chip: a sibling/opposite filter — shows only items in the Green "done today" state (so a
    user can re-touch what they just did). Explicitly NOT a group (would require listing an item in
    multiple groups, which Jac called "just wrong for our system") — it's a FILTER over the existing
    single-group placement, same mechanism as Your Work, opposite end.
  - Card-title toggle moves from CENTER to LEFT-ALIGNED specifically to free header space for these
    chips (+ graph + search + sort) — Jac's own proposal (msg 146), confirmed useful for mobile too
    (frees room even for one chip).
- FILL BIT — separate axis from hue, extensive back-and-forth, ENDED IN A DIFFERENT PLACE than either
  of Jac's two proposals, msg 171-193:
  1st proposal (Jac, msg 171): filled=Blocking / outline=Fix-it (soft), generalized by Claude across
    all 5 hues (filled=hard/binding/gating, outline=soft/advisory) — built out with an 11-example
    "real gates" artifact (failed inspection, no card on file [94.5% of the book has none], unsigned
    agreement, PO-required, ACH-in-flight, blacklist, part-on-order, overbook, etc.) plus a "look-alike
    that stays outline" companion column.
  2nd proposal (Jac, msg 174/179/186): filled=**Today** instead — Claude compared "ground covered" by
    each rule side by side; recommended keeping Blocking (novel signal) over Today (redundant with
    groups+color) but Jac overruled, locking **Fill = Today**.
  FINAL correction (Jac, msg 189, overriding Claude's own narrower first cut of "Fill=Today"): fill
    should be a **generous "look here" / curiosity magnet** — Jac explicitly rejected Claude's proposed
    outline-list (future-dated, in-flight/self-resolving, dormant flags, done-today) and said ALL of
    those should ALSO fill because they "touch Today" in some live-thread sense — "I want users' eyes
    to trigger special curiosity upon seeing a filled." Only genuine steady-state/at-rest records (idle
    unit, mid-rental with nothing due, plain member) stay hollow/outline.
  RESULT matches style.md §6's trigger list (due/overdue/gating-now/needs-hands/near-clock/in-flight/
    flagged-live/closed-today) — so the MECHANISM is documented, but the DECISION NARRATIVE (why fill
    ended up this generous, the Blocking-vs-Today debate, the two rejected intermediate designs) is not.
  - Fill correctly framed as a MEANING bit, not a loudness bit — priority still comes from color +
    sort order (already in style.md, confirmed origin here).
  - **Hover layer locked** (msg 186/188): three-tier read — (1) color+fill = instant read, (2) the
    word on the chip = what it is (Signal already verbalizes), (3) hover/Tab/long-press = why & what
    it stops. This 3-tier hover contract for Signal chips is NOT spelled out anywhere in the 4 docs
    (wrangler-style just says "hover -> explain + name the source" for Signal, missing the 3-tier
    breakdown and the Tab/long-press keyboard-touch equivalents).
  - One item Claude flagged as still open and never explicitly re-confirmed: whether a
    waiting-on-vendor gate (WO closeable today but part on order) should fill as "today's blocker
    you're tracking" or stay outline until the part lands — superseded by the msg 189 generous-fill
    rule (everything touching today fills), so likely resolved as FILLED, but not explicitly re-stated.

## Detail-view extraction (msg 193-194, line 2570+): Claude pulled real code structure of
Units/Rentals/Customers detail views via subagent, to keep "where things are" while laying the new
system on. This grounds the later spec's §2/§3/§6 sections.

## Section: fill-rule finalization + detail views + button taxonomy (lines 2660-2770)
- fill rule tightened one more notch (msg 196-198): "eligible categories are many, but each stays
  hollow until its trigger actually FIRES (or is actively expected)" — a category being eligible isn't
  enough. Re-locked as `fill = triggeredToday(record)`. [Mechanism documented in style.md §6, this
  narrative/refinement moment is not]
- Button taxonomy locked precisely (msg 200, confirming/refining the earlier msg 200 note): **toggle-
  active = ORANGE (accent)**, white reserved for confirm/save ONLY, ghost neutral verbs, status gates
  keep status color. [NOTE: this literally conflicts with the CURRENT wrangler-style §3 Door rule
  "Toggle active segment -> the filled Signal chip of the selected option's status ... Falls back to
  orange when the option carries no status" — i.e., the doc's current rule is a LATER refinement
  (status-colored toggles, orange only as fallback) that supersedes this simpler "always orange" rule.
  Both are real decisions at different points in time; only the latest (already in wrangler-style) is
  binding, so no ledger action needed except noting the evolution exists.]
- Kept/confirmed, not touched: Rentals' condensed TWO-WEEK calendar (Jac: "that's all the window ever
  needs"), the `+Unit` line style, Customers' collapsed-section stack. [general "kept structure"
  principle documented; the specific "two-week is enough" observation is a minor undocumented detail]
- Pressure-test done on Customers (densest card, all 7 sections open = ~5 phone-screens tall) —
  validated the need for one-section-at-a-time paging idea. Landing section must be a SIGNAL summary
  (now in spec §2). The "~70% of viewport" expand-height number Jac proposed (msg 199.3) evolved into
  the shipped mockup's `clamp(260px, 70vh, 680px)` — the spec doc itself doesn't state a percentage,
  just "grows downward... fixed target size" — so the concrete size formula is a minor undocumented detail.

## Section: the "connective layer" — text/links/flags/naming (lines 2727-2930) — MOSTLY DOCUMENTED
via wrangler-style, with these narrative/process points NOT captured anywhere:
- Three-way color-role split that unlocked the whole layer (msg 208): **"status colors = what ·
  orange = touchable · white = commit · everything else = plain honest text."** This explicit rule
  statement (the organizing principle behind Signal/Ref/Door separation) is not written as such in
  wrangler-style — it only shows the resulting components, not this unifying one-liner.
  [NEW-CAPTURE CANDIDATE]
  - The trace-across-cards demo (Duhon -> Rental #4471 -> Skid Steer -> Invoice #4460, overdue chip
    lights at the end) proving Ref "walks across cards" — illustrative example, minor.
- The blue collision + resolution (msg 209-213): blue already = Waiting (status), so a commit button
  can't reuse status-blue. Resolution: commit gets its OWN deep, more-saturated blue (`#2f6fd0`,
  distinct from status blue `#6394cc`), rendered ALWAYS as a solid pill shape, so the two blues never
  read as the same control even though both are "blue." Jac confirmed: "I like the new blue save
  button. The shape helped too. Maybe consider a true pill to differentiate it even more" -> pill
  shape adopted for Doors generally. [The specific two-blues collision/resolution NARRATIVE is a
  genuine NEW-CAPTURE candidate — wrangler-style states the two hex values and that they're "revisit
  if it reads too close" but doesn't explain WHY two blues exist or the pill-shape-as-differentiator
  reasoning.]
- Jac Q (msg 212.5) re: "the blue DOOR we had before helped the eye see where to create new stuff or
  add... understand if research found it overkill" -> Claude's answer (msg 215): NOT overkill — blue
  dashed +Add is canon (R5b), confirmed sanctioned, kept. [minor, implicitly covered by Door's "+Add
  dashed outline" in wrangler-style]
- Signal/Gate/Stamp/Ref/Door NAMED here for the first time (msg 211, "I named the pieces... Signal
  Gate Stamp Ref Door") — already fully documented in wrangler-style §3.
- Gate visual settled: NO orange dot (Jac rejected it, msg 212.1 "orange thing on gates is weird");
  leading centered chevron, hugging text, no gap, chevron sits in FRONT of text not behind (Jac's
  explicit correction) — [DOCUMENTED: wrangler-style §3 Gate "leading, optically-centred SVG chevron
  that hugs the text (<=2px gap). No orange dot."] Good, already captured.
- Cancel button = the one quiet ghost (answers Jac's msg 212.7 "what does a cancel button look like")
  [DOCUMENTED].
- Signal hover = teleport to source + name it (confirmed, msg 217/188) [DOCUMENTED].

## Section: jactec-ui replaced by style + wrangler-style (lines 3268-3707) — CONFIRMED ALREADY DOCUMENTED
- Reference-material critique session (msg 228-241): Jac shared external UI-inspiration screenshots;
  Claude extracted 3 real changes (deepen red to `#d63636` for AA, mute blue to `#6394cc` vs orange,
  adopt 60-30-10) - all now in wrangler-style/style. The "space-cowboy / Duster Wrangler / laser lasso
  cyborg horse" direction was explored in depth (msg 230-236: intro-video character described in
  detail — orange laser rim-lighting, matte-serious steel, "only the laser glows" rule, three visual
  families mocked: Field Steel / Duster Wrangler / Dispatch) then explicitly TOSSED by Jac (msg 238,
  "Nah. Toss this. Let's get back to work.") [ALREADY DOCUMENTED — wrangler-style intro provenance
  note: "The space-cowboy / laser direction was explored and dropped: the app is matte, no glow."
  Confirmed accurate, no new capture needed, though the ledger should note this explored-and-rejected
  direction explicitly per instructions on "not inventing" — this IS a real decision (to reject) so
  it's fine to list as documented.]
- CVD/colorblind methodology (msg 256-266): Jac disclosed being colorblind; Claude ran deuteranopia+
  protanopia simulation math; picked `#ffe14d` (103 separation) over `#f5c542`(77) initially, later
  further dimmed to final `#eed44b` per wrangler-style (a later request "dimmed... on request" per
  wrangler-style's own note — the FURTHER dimming below ffe14d must happen later in transcript, watch
  for it in remaining unread lines). [DOCUMENTED in wrangler-style + style CVD rule]
- Skill split finalized: `style` = numerical rulebook only, hard decisions stripped out (Saira/Geist
  mandate, hex table removed); `wrangler-style` created as the NEW decisions-home, explicitly "the true
  replacement to jactec-ui," both to be run together on any UI change (msg 286-290). jactec-ui DELETED
  from the working tree (recoverable via git history) per Jac's explicit instruction (msg 279, "delete
  it please"). CLAUDE.md repointed from jactec-ui to style+wrangler-style. [ALL ALREADY DOCUMENTED —
  wrangler-style intro provenance note + CLAUDE.md "Design language" section confirm this exact
  history.]
- Jac also asked (msg 256) to make the rental mini-calendar colored ORANGE like the toggle — small
  surface tweak, applied; not really ledger-worthy on its own (folded into general "calendar keeps its
  shape" observations already covered).

## Section: inline-expand refinements + anchoring/rail/cascade recon (lines 3709-3945)
Jac's 6-point note (msg 293) + Claude's response (msg 294-296) — ALL folded into the spec doc I
already read (2026-07-20-list-views-inline-expand-design.md §1-§4) essentially verbatim:
- Persistent History-search footer (spec §2) - DOCUMENTED
- Swipe-smooth fixed-target expand animation (spec §1) - DOCUMENTED
- Rentals de-paged to calendar-anchored single view, calendar itself never resizes (spec §3) -
  DOCUMENTED
- Transferable sessions / send-to-coworker open problem (spec "Open problems") - DOCUMENTED
- Tall sections (Invoices) scroll internally (spec §2) - DOCUMENTED
- Mobile gesture-tolerance fear -> resolved as focused full-screen mode reusing comms gestures (spec
  §1) - DOCUMENTED
- Anchoring/rail/cascade recon (msg 305, the deep code-grounded doc) -> folded into spec §4 nearly
  verbatim (deferOrAnchor 220ms, anchorRecord, cascade.js FK-walk, tabStrip, pillTo, openInvoice special
  case) - DOCUMENTED
- Tabs-as-sessions (a tab = the whole 3-card cascade/filter/scroll context, not just one record) -
  DOCUMENTED (spec §4)
- Hover-jump / dwell-delay accelerator (msg 312): THREE explicit guards proposed — (1) ~300ms dwell
  delay before chips appear (the "main fix" separating fast-open from deliberate-pick gestures),
  (2) reserved lane / chips slide in from a dedicated edge zone, never under the name/primary body,
  (3) desktop-only (no touch mis-tap risk). Bonus: chips can be "signal-forward" (colored by which
  section is lit) turning hover into a triage glance, not just a shortcut. [PARTIALLY DOCUMENTED — spec
  §2 hover-jump bullet covers the geometry/reserved-lane/desktop-only guards well, but the SPECIFIC
  ~300ms DWELL-DELAY NUMBER and the "two gestures separated by time" framing is NOT in the spec (spec
  only says "Instant, no dwell" for the FINAL shipped version — wait, let me double check: spec says
  "Instant, no dwell. Mis-click-safe by geometry" — this literally CONTRADICTS the 300ms dwell-delay
  proposal! Need to check later transcript for whether dwell was explicitly dropped in favor of
  pure-geometry mis-click-safety. FLAG for verification in remaining read.]
- Yard Journey becoming its own Units section (msg 309-310) - DOCUMENTED (spec §6, "chosen 2026-07-20")
- Role-default landing severed correctly: field roles (driver/mech) land on Journey (doubles as their
  Signal summary); office roles get generic rollup - DOCUMENTED (spec §6)
- Funnel flagged as "concept loved, execution poor," to be rebuilt on locked components - DOCUMENTED
  (spec §6)
- KPI Rings -> left vertical rail tradeoff flagged OPEN/dangerous, to be measured not felt - DOCUMENTED
  (spec §5, later superseded/resolved by the Dashboard-as-6th-card idea also in spec §5 "RESOLVED")

## IMPORTANT DISCREPANCY TO VERIFY: hover-jump dwell timing
Spec doc §2 says: "Instant, no dwell. Mis-click-safe by geometry" — but msg 312 (this section)
proposed ~300ms dwell AS the main mis-click guard. These read as contradictory. Need to find where/if
Jac or Claude walked back the dwell-delay to "instant + geometry-only" — search forward in remaining
transcript (lines 3945-5295).

## RESOLVED: hover-jump dwell discrepancy
Confirmed NOT a discrepancy — full evolution, all now matching the spec doc:
1. Jac (msg 321): "Drop the 300ms thing... let's see if we can solve without the pause" — power
   users want chips instantly.
2. Claude's geometry-only fix (msg 322): absolutely-positioned right-lane strip, zero layout shift,
   never covers name/body; graceful degradation backstop (worst case = opens on the wrong-but-
   adjacent section, never destructive); lit-sections-first keeps the strip short. [Reasoning/
   narrative NOT in spec, but the resulting rule IS: spec §2 "Instant, no dwell. Mis-click-safe by
   geometry"]
3. Jac (msg 324): flagged that hovering the row for the strip conflicts with hovering individual
   row elements for THEIR OWN tooltips.
4. Claude's fix attempt (msg 325): trigger only from the summary-Signal zone, not the whole row —
   REJECTED by Jac (msg 327): "aiming for a certain element is slower and more annoying than just
   clicking."
5. FINAL (msg 328-329, Jac-steered): popover emerges from BEHIND the card, above it, on WHOLE-ROW
   hover (nothing to aim at) — off the click-path entirely, so element tooltips AND click-to-open
   both stay intact. Refinements: emerges from the item's TOP EDGE with a small tail/notch (shows
   ownership + keeps one contiguous hover zone so moving up into it doesn't dismiss it — solves the
   classic hover-menu "dead gap" problem), one chip-line tall, flips to appear below near the list
   top. [FULLY DOCUMENTED — spec §2 hover-jump bullets match this almost verbatim]

## Section: Funnel redesign details + toggle/label locks (lines 4137-4247)
- Funnel v1 built by subagent, reviewed, Jac: "I LOVE IT" but gave 5 corrections (msg 343), of which
  only some made it into the terse spec §6 Funnel bullet ("keep toggle + dated funnel + next-actions
  list + action log, rebuilt on locked components... Mock + review") — the SPECIFICS below are
  NOT reflected in the current spec doc:
  - **Icons instead of plain checkmarks** for stepper stage markers. [NOT in spec §6]
  - **Real estate to the right of checkpoints should hold PER-CHECKPOINT ACTIONS** (not just a
    generic list below). [NOT in spec §6]
  - **Rename "Next Actions" -> "More Actions."** [NOT in spec §6 — spec still says "next-actions list"]
  - **Inline action-adding, no popup** — the ONE tolerated exception is a small calendar+time popup
    that appears just above whatever was clicked (for date/time entry specifically). [NOT in spec §6]
  - Funnel must use **Jac's actual real funnel steps**, not invented ones (Rental: Lead -> Quoted ->
    Reserved -> On Rent -> Member; Equipment Sales: Lead -> Quoted -> Demo -> Negotiation -> Won) —
    these exact step names given to the rebuild agent. [NOT captured anywhere in the 4 docs]
  - Current-stage marker made color-blind-safe THREE ways deliberately (not color alone): a diamond
    glyph in the dot (vs check for done, empty for upcoming), a matte offset ring (no glow/blur), and
    literal text "· now" — Jac didn't ask for this explicitly but praised it when he saw it applied.
    [NOT captured in docs — a good concrete illustration of the "never colour alone" style.md rule
    but the specific 3-way technique isn't written down anywhere as reusable guidance]
  - Vertical (not horizontal) stepper chosen because a 5-stage horizontal dated track got cramped at
    customer-section width — vertical scales without forcing sideways scroll. [NOT documented]
  - Chip radius unified to ONE value (7px) for Signal/Gate/Stamp-box/Ref-square, resolving an
    internal conflict where wrangler-style had listed Signal-radius 8 and Ref-radius 6 separately —
    "the decision moves, not the rule" (style's one-chip-radius rule wins). [DOCUMENTED — current
    wrangler-style §3 already says "radius 7 (the ONE chip radius — see note)" for Signal and
    matches for Ref too, so this got folded in; good, no new capture needed, confirms consistency]
- **"To Do" label locked** (msg 343.2/351.1): the Signal-summary tab is user-facing-labeled "To Do"
  on section chips; "Signal" remains the internal/dev name only. [DOCUMENTED — spec §2]
- **Toggle rule, FINAL, locked** (msg 343.4/351.4): every toggle's active segment = the FILLED Signal
  chip of the selected option's status (colour=state); falls back to plain orange only when the
  option carries no status. Explicitly stated to apply to "every toggle, funnels included" — later
  generalized in wrangler-style to "every toggle, incl. funnel tabs and the yard/staff segmented
  controls." [DOCUMENTED — wrangler-style §3 Door]
- **Yellow dimming tension discovered and resolved with real math** (msg 344-347): dimming yellow by
  DARKENING (lightness) shrinks its CVD separation from ORANGE; dimming by DESATURATING (softening)
  shrinks its CVD separation from GREEN. `#ffe14d` was the "vivid corner" scoring 103 from both.
  `#eed44b` is the dimmest point on the frontier that still holds ≥90 from BOTH (93 vs orange, 95 vs
  green) — established as the honest ceiling / floor, "don't dim past it." [DOCUMENTED in wrangler-
  style §1 forced-picks note — matches well, though the SPECIFIC discovery narrative (darken-hurts-
  orange vs desaturate-hurts-green trade-off) is a nice piece of reasoning not spelled out, low
  priority to add]
- Housekeeping principle stated (msg 351): when a locked value changes (like the yellow), do NOT
  hand-recolor every already-published mockup on the main thread — let each pick up the new value
  next time it's naturally revised. [process habit, not really a design decision — skip]

## Continue reading from line 4247 to end (5295).

