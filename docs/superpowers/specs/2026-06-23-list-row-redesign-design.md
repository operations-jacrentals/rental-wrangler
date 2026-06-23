# List-Row Redesign — Units · Rentals · Customers — SPEC v1

**Date:** 2026-06-23
**Status:** DRAFT — pending Jac's spec review
**Area branch:** `area/design-system`
**Task branch:** `design-system/flag-color-system`
**Related:** `docs/specs/flag-color-system.md` (the governing R/Y/G/Gray color model)
**Scope:** The three primary yard-grid columns — Units, Rentals, Customers — list-row layouts only.

---

## 1. Goal

Reshape the three main list rows into a single, recognizable family that reads at a
glance and speaks the yard data-plate language. One visual grammar across all three:

- **Numbers over text.** Where a number + color carries the meaning (money, hours,
  counts), show the number in the flag color — drop the descriptive word.
- **Severity by color, label by lifecycle.** Color always comes from the
  flag-color-system severity (Red = act now · Yellow = needs attention · Green = clear ·
  Gray = archived). Lifecycle words ("On Rent", "Reserved") stay as *labels*, never as
  the color source. Rows read `*.color` from the existing derived helpers, so they adopt
  flag colors for free the moment that system lands.
- **Same real estate.** Each redesign occupies the same total footprint the current rows
  do (the rentals grid is the one exception — see §3 — and is deliberately area-neutral).
- **Mobile reflow.** Secondary text (a unit's category, a customer's account type)
  reflows below the primary name on phone/narrow widths.

---

## 2. Shared design language (jactec-ui)

- **Header name** = stamped **Saira Condensed**, uppercase, ~0.7px tracking, weight 700
  — the data-plate label voice. Customer/record bodies stay Geist where they read as
  prose, but the row *name* is the stamped voice (consistent with `.disp-unit`,
  `.rtab-l`, etc.).
- **Severity highlight** rides the **left border** of unit + rental rows
  (`border-left: 3px solid <flag color>`), the established "status spine." Customer rows
  carry severity on the **name text color** instead (Jac's call — see §4).
- All new pills/flags emit from a **§5 builder** with a `data-r` stamp; zero R0 flash-lint
  violations. No hand-rolled `.pill`/`.flag` markup.
- Tokens only — no literal hex/px/font in markup. Mirror dark + light + ranch.

---

## 3. Rental rows — "Window track" mini-calendar  ✅ direction A approved

Replace the flat elapsed-tint bar (`.rtl`) with a **2-column × 3-row grid of
mini-calendar cards** (`.rcc`). Six rentals occupy the same vertical real estate as the
old six rows (`grid-auto-rows` sized so 3 rows + gaps ≈ the old 6-row height).

**Each card:**

```
┌ (border-left = rental flag severity)
│ SK-75 SKID, LT-204   [2]          ← Saira header: unit name(s), comma-joined,
│                                      ellipsis + count tag for multi-unit
│   · · · ●━━●━━●━━●                 ← 3 weeks of 7 dots: last / THIS / next
│   ●━━●━━◍━ ─ ─ ─                    (Sunday-anchored). Window THREADS the dots:
│   ─ ─ ◐ · · · ·                      solid track = elapsed (start→today),
│                                      faint track = remaining (today→end).
│ Devin Lyles            $1,290      ← footer: customer (Geist) · balance ($ color)
└
```

- **Dots:** small, low-contrast filler; past days dimmed. **No numbers** (Jac).
- **Today** = orange dot (brand accent) with a soft halo, sitting *on* the window track
  ("you are here").
- **Start / end** = enlarged dot in the flag-severity color, carrying a transport glyph:
  - JacRentals delivers → **out-truck** on start; recovers → **in-truck** on end
    (Round-Trip = truck on both). Self pickup/return → **person** glyph (`I.user`).
  - Start-date **time** (`startTime`) floats above the start dot in condensed micro-type.
- **Window track** = the rental's flag color; elapsed portion solid, remaining portion at
  ~32% opacity. This recovers the old bar's "how far along" signal inside the calendar.
- **Footer balance** (`.rcc-bal`), numbers-over-text:
  - Fully paid → green **"Paid"**.
  - Owed → the **dollar amount**, **yellow** before the due date, **red** on/after it.
  - Refunded → muted "Refunded".
- **Quote (no window)** → compact card: header + "Set window" placeholder, no calendar.
- **Status gate:** **omitted for now** (Jac will plan placement after seeing the layout).
  No inline status-advance on the card; click opens the rental.

**Builder/CSS:** the `.rcc` renderer in `app.js` `rentals:` + an `.rcc*` block in
`style.css`. Calendar is informational (the card itself is the row click target → opens
the rental); only future interactive bits (a gate) would need pill builders.

---

## 3.5 Rental DETAIL — "standard mode" (the expanded card)

The opened rental record (`DETAIL.rentals`), distinct from the list row (§3). Same
window-track calendar language, scaled up for the room a detail view has.

**Empty rental (new) — a drop scaffold (IMG_2034):**
- A dotted-calendar header band with a **Customer** drop slot at top-left (drag a
  customer onto it).
- Below: **+Unit** and **+Invoice** dashed add/drop affordances (R5b) — drag a unit and
  an invoice onto the rental to link them.

**Filled rental (IMG_2035):**
- **Header:** customer name (top-left) · **balance/total** (top-right), flag-colored money
  (red when owed) — the same money grammar as the row footer.
- **Calendar:** the window-track calendar from §3, but **with numbered dates** (the detail
  has room) spanning as many weeks as the window needs. Start date boxed in the status
  color, end circled, today marked; the window threads the numbered grid.
- **Units (beneath the calendar)** — one row per unit on the rental:
  - unit name (left) ·
  - **transport journey** beside it — origin → site pin → destination (the R15
    mini-journey / transport timeline) ·
  - **rate · price** on the right of the unit row ("4 Days · $500") ·
  - **transport price** to the right of the journey ("$300").
- **Invoice total** at the bottom-right ("$1,000", underlined).

Build: reshape `DETAIL.rentals`. Reuses the calendar renderer (a numbered-date variant),
the R15 transport journey/`miniJourneyHtml`, R5b add/drop for unit + invoice, and the
flag-colored money. **Later slice** (after the list rows) — shares the calendar + money
grammar so it lands cheaply once those exist.

---

## 4. Customer rows — name · contact · pay-$ · funnel

Mirrors the unit row's shape **without a left icon**. Two-line left block, two values on
the right, vertically centered:

```
┌
│ Cameron Miller                    $4,820   ▸ Payment Discussed
│ 337-555-0192 · Business
└
```

- **Name** (top-left, Saira stamped) — **text color = the customer's flag color**
  (highest-severity active flag; Jac: "the name hosts the color of the flags"). No left
  icon, no border spine — the colored name *is* the severity signal for this column.
- **Sub-line:** phone · account type (Geist, `--txt-2`). Reflows below the name on phone.
- **Pay-status value** (numbers-over-text — replaces the old "New / Current" word pills):
  - Owes nothing / current → **rolling-12-month spend**, **green** (loyalty/value signal).
  - Owes → the **outstanding balance** as a bare dollar number, **yellow** before its due
    date, **red** on/after (same money grammar as the rental footer).
- **Rightmost = most-progressed funnel status** (`funnelPill` family, R1): of the
  customer's two funnel tracks (`usedSalesStage`, `membershipStage`), show whichever is
  **furthest along** the funnel progression. Hidden when both are `N/A`.
  - Progression order (most→least progressed): `Paid` > `Payment Discussed` > `Not A No!`
    > `Contacted` > `Outbound Lead` > `Inbound Lead` > `N/A`. `Don't Contact` is a
    terminal-negative state, ranked lowest (shown only if it's the sole non-N/A stage).

---

## 5. Unit rows — 5 elements, severity spine

Left→right, one row (current `units:` renderer is two-line; reshape to the agreed
5-element line + sub):

```
┌ (border-left = most-severe flag color)
│ [cat] BX-880 SKID STEER   [On Rent · grn]  [WO: Part Needed · red]
│       Skid Steer 75hp ← reflows below name on mobile
└
```

1. **Category icon** (left) — a library glyph representing the unit's *category*
   (excavator → backhoe, etc.). **Open item, see §7** (no category→icon map exists yet).
2. **Name + category** — Saira name; category label beside it on desktop, **reflowed
   below** on phone/narrow.
3. **Rental + Inspection pill** — **text = rental status**, **color = inspection status**
   (green Passed · yellow Not Ready), going **red only** for a Failed inspection or
   genuinely detrimental rental events (overbooked, overdue). When a window picker is
   open, shows **Available / Booked** for that window; when the unit has no active rental,
   falls back to the **inspection** label (Passed / Not Ready / Failed).
4. **WO + SO pill** — if an open work order exists, show its **journey bottleneck** phase;
   otherwise the **nearest service order** by hours remaining. WOs take precedence over SOs.
- **Row severity** = the most-severe flag among the unit's signals, on the **left border**
  (replaces the current row-background tint).

---

## 6. Implementation seams & guardrails

- **Color source is the flag seam.** Rows read `rentalStatusDisplay(r).color`,
  `getStatus('unitInspectionStatus', …).color`, customer flag color, etc. — never a
  hardcoded lifecycle hue — so the flag-color-system rollout recolors them automatically.
- **Icons from the library only** (`I.truck`, `I.user`, category glyphs via
  `tools/gen-icons.mjs`). No hand-authored `<path>`.
- **R-stamps + catalog:** any new pill/flag → §5 builder + `data-r` + `RULE_META`;
  regenerate `rule-usage.js` if usage changes; no popups added so `WINDOW_CATALOG`
  untouched.
- **Gates:** `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`; zero R0
  violations; self-critique screenshot in dark + light before showing Jac. (Port 8000 →
  9147 swap for the headless gates, then `git checkout -- ci/`.)

---

## 7. Resolved decisions & build order

1. **Per-category unit icon — RESOLVED (Jac):** build the **full category→icon map first**,
   sourced **entirely from a library** (Lucide via `tools/gen-icons.mjs`; the Tabler
   backhoe stays for excavators as the one existing bespoke-but-vendored mark). **Never
   hand-author a glyph.** The unit row waits on this map. Categories to map: Light Tower,
   Lift Scissor, Skid Steer, Excavator (8k/12k) — plus any others in the live category
   list — each to a representative Lucide name (e.g. scissor lift → a platform/lift glyph,
   light tower → lamp/lightbulb, skid steer → the backhoe/excavator family). Mapping is
   added to the `CARD_ICON`/new `CATEGORY_ICON` maps in `gen-icons.mjs`, regenerated
   offline; no raw `<path>` by hand.
2. **Rental status gate placement** — deferred by Jac; the calendar card ships without an
   inline gate; revisit where status-advance lives once the new layout is in hand.
3. **Flag-color-system FIRST — RESOLVED (Jac):** implement the R/Y/G/Gray severity color
   logic (`docs/specs/flag-color-system.md`) **before** the rows, so all three rows render
   flag colors from day one rather than today's lifecycle hues (avoids re-color churn).
4. **Build order (RESOLVED):**
   1. **Flag-color-system** — the severity color seam every row reads. ✅ engine landed.
   2. **Rentals row** → window-track calendar (direction A).
   3. **Customer rows**.
   4. **Category→icon library map**, then **Unit rows**.
   5. **Rental DETAIL (standard mode)** — §3.5; reuses the row's calendar + money grammar.
   Each is an independent, shippable slice on this branch.

---

## 8. Self-review

- Placeholders: none outstanding except the two flagged Open Items (§7), surfaced for
  Jac's decision rather than silently assumed.
- Consistency: all three rows source color from the flag seam (§6); money grammar is
  identical on rentals (§3) and customers (§4); Saira name voice is shared.
- Scope: three independent row slices on one branch; no backend/data-shape change.
- Ambiguity: "most progressed funnel" ranking made explicit (§4); pay-value semantics
  (rolling-12mo vs balance) made explicit (§4).
