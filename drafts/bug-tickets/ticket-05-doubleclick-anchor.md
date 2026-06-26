# BUG: Desktop double-click-to-anchor no longer works

**Reported by Jac (verbatim):** "I can no longer double click to anchor on desktop. I've lost that ability."

**Area:** search-views

**Symptom:** On desktop, double-clicking a row, a link pill, or an open card's detail no longer anchors (or un-anchors/toggles) the record. The anchor → cascade mechanic that should fire on the second click within the window is dead.

**Suspected code locations:**
- `app.js:2256` — `deferOrAnchor(key, singleFn, anchor)`, the shared single-vs-double click discriminator. The 2nd click within `DBL_MS` is supposed to call `anchorOrToggle`. This is the primary desktop anchor path for rows and pills.
- `app.js:2246` — `const DBL_MS = 220;` the discriminator window. If the second `click` arrives outside 220 ms (or a re-render between clicks resets `pendingRowClick`), the anchor never fires and you just get two single-opens.
- `app.js:12342-12351` — the row branch in the event tree that wires the row click into `deferOrAnchor('row:'…, () => rowOpen(...), {card,recId,recType})`. A re-render replacing the row node mid-pair, or an early `return`/`stopPropagation` above this, would break the pairing.
- `app.js:12330-12340` — the pill branch (`deferOrAnchor('pill:'…)`), same discriminator for link pills.
- `app.js:15715-15723` — the separate `document` `dblclick` listener for a card's open *detail* dead-space (`cardRecordAt` → `anchorOrToggle`). Note `hotkeyGuard` (15716) bails on `.pill, button, .x, input, …` and line 15719 hands `.row` back to the discriminator, so this listener only covers detail dead-space; if rows/pills regressed, the cause is the discriminator path, not here.
- `app.js:1995` — `anchorOrToggle`, the terminal action (sound; toggles off when re-anchoring the current anchor).

**Root-cause hypothesis (hypothesis):** A recent change to pointer/touch/click handling broke the two-click pairing in `deferOrAnchor` — most likely the first click now triggers a `render()` that replaces the row/pill DOM node (so the second click lands on a fresh node and `pendingRowClick.key` never matches), or an added `e.stopPropagation()`/early return upstream swallows the second click, or `DBL_MS` (220 ms) is now too tight against added latency. The `selected`-class add at 12349 forcing a re-render is a prime suspect.

**Acceptance criteria:**
- [ ] On desktop, double-clicking a list row anchors that record (cascade fires across the other cards).
- [ ] Double-clicking an already-anchored record un-anchors it (toggle), per `anchorOrToggle`.
- [ ] Double-clicking a link pill anchors its target record.
- [ ] Double-clicking a card's open detail dead-space still anchors (the `dblclick` listener path).
- [ ] Single-click behavior (deferred open / pill-navigate) is unchanged; no double-open regressions.
- [ ] Touch/mobile tap-to-anchor (second tap = anchor) still works and isn't broken by the fix.

**Notes:** Anchor/cascade mechanic is documented in `cascade.js` (chapter `CASC`) and `setAnchor`/`anchorRecord` (APP-07, `app.js:1953`). This is interaction logic (APP-32/APP-33), not a visual change — but any UI tweak made while fixing must still run through `jactec-ui`. No `WINDOW_CATALOG` impact. Worth bisecting recent commits touching pointer/touch handling (e.g. the inline-window-edit / draggable-popup work, PR #356).
