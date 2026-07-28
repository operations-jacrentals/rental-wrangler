# Labs — Prompt 0.1c · The Overlays (panel · popup · the ⋯ action menu)

**Tier 0.1 — containers, part three.** Everything that floats *above* the app: the panel, the popup,
and the overflow menu. These are the containers most likely to get improvised mid-screen — which is
exactly why they get designed once, here, before any screen needs one.

**Attach from the `rw-design-system` folder:** `elements/door.html` · `components/buttons.html` ·
`components/fields.html` · `elements/signal.html` · `elements/ref.html` · `elements/pin.html` ·
`foundations/spacing.html`.

**Reference (context, not canon):** `docs/design/reference/compose-dock.html` and
`docs/design/reference/get-told.html` — two floating surfaces already drafted.

---

## ⭐ North Star — the one thing this pass decides
**How the app talks over itself** — the one panel, the one popup, and the one action menu, so that
nothing floating above a screen is ever invented on the spot.

## 🚫 Out of scope (anti-objectives — do NOT critique or redesign here)
- **The atoms.** LOCKED 2026-07-25.
- **The card frame / header / row** (0.1a) and **the section plate** (0.1b). Locked. Overlays reuse
  them; they don't get their own variants.
- **What any specific popup contains.** No new-rental wizard, no payment form, no settings board.
  Creation flows and functional popups are **Tier 3**. Use generic placeholder content.
- **Toasts and notifications.** They float too, but they are a **Tier 3** surface with their own
  timing and stacking rules. Not here.
- **Mobile bottom sheets.** The phone reflow is Tier 3. Design for desktop; note anything that
  obviously will not survive the translation.
- **The shell's footer rail and its open chats.** Tier 0.2 / Tier 3.

## ♻️ Inherit (locked — reuse verbatim)
- **All eight atom families.**
- **The card frame, header and list row** (0.1a) and **the section plate** (0.1b) — a popup that
  shows a list shows *the* list row; a panel that groups fields uses *the* plate.
- **The four control shapes** and **`--radius: 14px`** for container corners.
- **Door taxonomy** — commit · +Add · money · destroy · ghost. A popup's footer is built from these
  and nothing else, and the pill silhouette stays Doors-only.

## The ask — four artifacts

### 0. The popover-above — a locked family, not a free design
Before the panel and the popup: there is a **third overlay shape already decided**, and it recurs
app-wide (ledger #58/#59/#60/#77). Design it once, here.

- **The hover-jump accelerator.** On hovering a list row, a popover **emerges from the row's top
  edge** with a **tail/notch**, exactly **one chip-line tall**, and **flips below** when the row sits
  near the top of the list. It is **instant — no dwell timer.** It is made mis-click-safe by
  **geometry** (a right-lane or whole-row hover target), *never* by a delay. A fallback was also
  approved if "above" proves too tight: a **left-stack** variant anchored on the item name.
- **The recent-search history popup** uses the **same principle** — it opens **ABOVE the search bar,
  app-wide** (#77), not below it as a normal dropdown would.

So this is a family: **things that open upward from their trigger, with a tail, and flip when
cornered.** Decide the tail geometry, the flip threshold, and how it differs on sight from the Field's
*downward* opener dropdown — because a user must never confuse "this opened up to help me jump" with
"this opened down to let me choose."

### 1. The panel
A persistent surface anchored to an edge or a record — it stays while you work in it. Decide: where
it attaches, how wide, whether the app behind it dims or stays live, how it is dismissed, and
whether it can be open alongside another panel. Design its header and its footer.

**⚠️ One panel is already specified: the compose dock** (ledger #78, spec §7.3). It **docks at the
footer on desktop and is minimizable**; on mobile it goes **full-screen**. It **never follows the
pointer and never pops mid-screen** — even when triggered by a right-click. Treat it as the worked
example your panel design has to accommodate: a footer-docked, minimizable, multi-instance surface.
Related context (not yours to design): comms live at **three altitudes** — the bell for alerts, this
footer dock for quick replies, and the Inbox card as the full workspace (#71).

### 2. The popup
A modal moment: it takes focus, asks one thing, and leaves. Design **three sizes** — a confirm, a
short form, and a full working surface — and prove they are the same object at different scales, not
three designs. Fix the parts that must never move: **title · body · footer**, with the commit Door
always in the same corner. Decide the scrim, the entry, the escape hatches (X, Esc, click-outside),
and what a **destructive** confirm looks like when it must not be clicked through on reflex.

### 3. The ⋯ action menu — the one this tier added
The atom pass **dropped `.menu`** as a status picker (that job now belongs to `.seg--stack`, a
stacked segmented toggle). What is left is a genuinely different container: a short list of
**unrelated verbs** hanging off a ⋯ trigger.

**⚠️ This menu is already half-decided — read before designing**
(`docs/superpowers/specs/2026-07-20-decisions-ledger.md` #79/#83,
`2026-07-20-list-views-inline-expand-design.md` §7.3–7.4):

- **It is the same surface as the R20 right-click menu.** Right-clicking a row and tapping its ⋯ must
  open **one menu**, not two designs of one. Design it once.
- **It carries a user-CUSTOMIZABLE quick-action set** — Hide · Mark unread/read · Star · Snooze ·
  Archive — surfaced **identically** as row actions (hover-reveal on desktop, **swipe** on mobile) and
  in this menu. *"One set, learned once, available everywhere."* So the menu is not a fixed list you
  get to author: design it to hold a **configurable** set, and decide what a user-ordered menu looks
  like and where a customize entry point lives.
- **Comms items stay in place.** "Text {name}…" / "Email {name}…" open compose **with the record
  pre-attached**, docked — they must **never teleport to the Inbox card**, and never pop mid-screen.
  A comms verb in this menu is a different animal from Duplicate/Delete; decide how it reads.

Design it as a container, and settle the questions that make it a menu rather than a list of chips:
- **The trigger.** What ⋯ looks like at rest, on hover, and while open — and where it sits on a row
  and on a card header without stealing a slot from either.
- **Item anatomy.** Icon? Label? Keyboard hint? Decide once. Menu items are **not** Doors — they are
  a plain list in the body voice — so decide what a menu item *is* and how it differs from a Door on
  sight.
- **The destructive item.** Delete lives in this menu and must be reachable but never fired by
  accident. Separator, colour, position, confirmation — decide all four.
- **Disabled items.** A verb that is unavailable right now should say *why*, not just gray out.
- **Placement.** Flipping near a viewport edge, and what happens inside a narrow column.
- **The boundary.** State plainly, in a note on the artifact, when a thing belongs in this menu
  versus being a visible Door on the row. If everything drains into ⋯, the row stops offering
  anything; if nothing does, the row drowns. Draw the line.

## The test the artifacts have to pass
Open a popup **from** a panel, and a ⋯ menu **from inside** that popup. Is the stacking order
obvious? Does Esc dismiss the right one? Does anything float above something it shouldn't? Three
overlay layers is the real-world case, and it is where improvised overlays fall apart.

## After you lock
These become Inherit items for every Tier 2 and Tier 3 surface — every wizard, every settings board,
every confirm in the app is built from them. Tell me what changed; I fold it into the kit and
re-sync, and **Tier 0.1 is closed.**
