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

## The ask — three artifacts

### 1. The panel
A persistent surface anchored to an edge or a record — it stays while you work in it. Decide: where
it attaches, how wide, whether the app behind it dims or stays live, how it is dismissed, and
whether it can be open alongside another panel. Design its header and its footer.

### 2. The popup
A modal moment: it takes focus, asks one thing, and leaves. Design **three sizes** — a confirm, a
short form, and a full working surface — and prove they are the same object at different scales, not
three designs. Fix the parts that must never move: **title · body · footer**, with the commit Door
always in the same corner. Decide the scrim, the entry, the escape hatches (X, Esc, click-outside),
and what a **destructive** confirm looks like when it must not be clicked through on reflex.

### 3. The ⋯ action menu — the one this tier added
The atom pass **dropped `.menu`** as a status picker (that job now belongs to `.seg--stack`, a
stacked segmented toggle). What is left is a genuinely different container: a short list of
**unrelated verbs** hanging off a ⋯ trigger — Duplicate · Export · Archive · Delete.

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
