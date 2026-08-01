# Claude Design Labs — Prompt 1 of N · Detail Views (Units / Rentals / Customers)

**Uploads for this session (attach both):**
1. `design-system.html` — the **Rental Wrangler Design System**. This is the locked ground truth: the steel palette + colour law, the two type voices, the size/control rules, and the five-part element vocabulary (**Signal · Gate · Stamp · Ref · Door**). Everything you build uses *only* these pieces, at these values. Do not invent new colours, new component types, or new type styles.
2. `detail-views.html` — the **current** detail-view mockup (the starting point you're evolving). It shows the three records — a **Unit**, a **Rental**, a **Customer** — each rendered as a vertical *plate-stack*: every section stacked open at once (Inspection, Services, Work Orders, Specs, GPS… then a History footer). It's built correctly to the design system — but stacking every section open makes the record **too tall**. Your job is to fix exactly that, without losing anything.

---

## The product, in one breath
Rental Wrangler is the yard-management app for **JacRentals**, a heavy-equipment rental company. A user clicks a row in a list (a unit, a rental, a customer) and it **expands in place** to reveal that record's detail. The look is a **dark industrial "yard data-plate"** — matte steel, one safety-orange accent, stamped condensed labels. It is **dark-theme only** (never emit a light mode).

## The one problem to solve
When a record expands inline, showing **all** its sections stacked open makes it **enormous** — the Customer record alone runs ~5 phone-screens tall. We want the richness of every section **without** the height. The settled answer is a **bounded, paging** detail view driven by a **section rail**. Build that.

## The target model — build this exactly

**1. Inline expand, bounded height.**
The detail lives *inside* an expanded list row (keep that — do not turn it into a separate full page). The expansion opens to **one fixed maximum height** that **every record obeys** — Units, Rentals, and Customers all expand to the same height envelope, so the list never jumps around unpredictably. Use a clamped target (e.g. `clamp(320px, 62vh, 660px)`) so it's generous on desktop and sane on a phone. **A single section that's taller than that envelope scrolls *inside its own pane*** — the record's outer height never grows past the envelope.

**2. A section RAIL across the top.**
Directly under the record's header, lay a **horizontal rail of section chips** — one chip per section (Inspection, Services, Work Orders, Specs, GPS, Investment, Notes… for a Unit; the Rental/Customer sets differ, see below). Each chip is the section's **at-a-glance summary**, and the rail is how you move between sections. Every chip carries **three things**:
   - **A rolled-up Signal** — the single worst state inside that section, as a **Signal** dot/chip from the vocabulary. (A Work-Orders section with one overdue WO rolls up **red**; a Services section with a wash due today rolls up **yellow**; an all-clear section rolls up **grey**.) This is the whole point: because the rail shows *every* section's rolled-up state at once, **paging hides nothing** — the user always sees where the trouble is, even on sections they haven't opened.
   - **Colour = state** — the chip's colour **is** that rolled-up Signal state (red > yellow > blue > green > grey, hottest wins). Never colour a chip by anything else.
   - **The section's primary action** — the one **Door** (verb action) that section most wants, sitting **on the rail chip itself** (e.g. Inspection → *Start inspection*; Work Orders → *New WO*; Payment → *Charge*). One primary Door per chip, not a menu.

**3. The rail PAGES — one section open at a time.**
Clicking a chip **pages** that section into the single content pane below the rail. Only **one** section's body is shown at a time; the rail stays fixed above it, always showing all sections' rolled-up signals. Moving between sections is a chip click — no long scroll, no accordion stack. The pane swaps content (a smooth, quick swipe-style transition is welcome, but subtle — matte, no glow, no bounce). The **first** section shown on open is the record's **Signal summary / most-urgent** section (land the user on what needs them).

**4. History, pinned as a footer.**
Return the **History footer** the current mockup already has (`12 Inspections · 3 WOs · 5 Rentals · 8 Washes`, etc.) — a thin, pinned strip at the **bottom** of the expanded record, always visible under the paging pane. It's a Ref-style set of counts that opens the record's history/search. It is **not** one of the rail's paging sections — it's a persistent footer.

**5. Normal section order.**
Keep the sections in their **natural, familiar order** on the rail (the order the current mockup uses per card). Don't re-sort by severity — the rail's *colour* already surfaces severity; the *order* stays stable so muscle memory holds.

## The three records to render (same model, three section sets)
Use the sections already in `detail-views.html`:
- **Unit:** Inspection · Services · Work Orders · Specs · GPS · Investment · Notes → History footer.
- **Rental:** Rental · (its sections per the mockup) → History footer.
- **Customer:** Account · Funnel · Invoices · Activity · Payment → History footer.
Render all three so the model is proven on the lightest (Unit) through the densest (Customer).

## Hard constraints (from the design system — do not drift)

**✅ Still honoured? (check before generating — locked canon, 2026-07-20 ledger)**
- [ ] Every control atom (Signal, Gate, Stamp, Ref) is **radius 0** — shape lives in **four finishes** (machined ring / well glass / pressed key / dark key), not a rounded-shape ladder (#140).
- [ ] **Ref speaks mono**, same as every other control atom — not Archivo (#142).
- [ ] `.ref__icon` and any tooltip/callout corner on a control atom is **0**, not a small rounded radius (#153).
- [ ] The attached `design-system.html` upload is a **current** export — reflects `tokens.css`'s `--well`, `--key`, `--ref-plate`, `--seam-1..5`, `--lit-rgb`, and the 10-colour steel accent-seed map; don't hand-roll equivalent hex values in the mockup (#152).
- [ ] **N/A here** — no Slot (formerly Pin) atom appears on this surface. If a later revision adds one (e.g. a rail-chip issue count), it's **"Slot"** — skewed stud face, numeral-only, hover/focus unfurls a tray — never "Pin" or a status word (#166/#177).
- [ ] **N/A here** — #170–179 (slot-rack 8-tick cap, 114px message-board width, two-level card housing/cartridge, click discriminator, verb-CTA width math, row order) are tier-01 **card** row/group mechanics; this is a detail-view surface, don't import them.

- **Only** the five vocabulary pieces: **Signal** (read-only state), **Gate** (turnable state), **Stamp** (quiet fact), **Ref** (linked record), **Door** (verb action). *Nothing does two jobs.* No new component types.
- **Colour = state; fill = today.** Status colours mean state only; **buttons/Doors carry no status colour** (actions are neutral — white/deep-action-blue commit, ghost secondary). Green = **Done today** only. Blue = **Waiting** (someone else's move). Red = bad. Yellow = your move now. Grey = nothing.
- **Two type voices:** stamped/condensed for labels, chips, IDs, and tabular numbers; body-sans for record names and prose. Dollar figures and counts use the stamped/tabular voice.
- **Matte.** No glow, no neon, no drop-shadow bloom. One safety-orange accent, kept under ~10% of the surface (icons, active toggle, gate mark).
- **Dark-theme only.** Emit no light-mode styles.

## Deliverable
**One** self-contained, iterable HTML artifact (inline CSS/JS, no external deps) that renders all **three** detail views to the target model above, so we can click the rail chips and watch sections page within the bounded height. Make the rail, the paging, the rolled-up signals, the on-chip primary Doors, the internal scroll of an over-tall section, and the pinned History footer all **real and clickable** — this is a working mockup we'll iterate on, not a static picture.

**When you're done,** give me a one-paragraph note on any place the target model and the design system pulled against each other and how you resolved it (e.g. where a primary Door wanted a status colour but the button rule forbids it).
