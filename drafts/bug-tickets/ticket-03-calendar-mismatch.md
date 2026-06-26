# BUG: Standard-view calendar doesn't match the mini-calendar card rows

**Reported by Jac (verbatim):** "the standard view calendar does not match the mini calendar card rows."

**Area:** units-fleet

**Symptom:** The full calendar shown in a record's standard (detail) view uses a different grid than the compact "mini calendar" baked into the rentals card rows, so the two read as two unrelated calendars instead of one consistent component.

**Suspected code locations:**
- `app.js:4743-4780` — the **mini calendar** inside the rentals mini-card row (`ROWS.rentals`, the `.rcc` block). It is a **3-week × 5-weekday (Mon–Fri) dot track**: `for (let w=0; w<3; w++) for (let dow=0; dow<5; dow++)` = 15 cells, weekends deliberately closed ("Mon–Fri calendar (closed weekends, Jac 2026-06-23)"), anchored to prev/this/next week's Monday, header `M T W T F`.
- `app.js:14559-14623` — the **standard-view calendar** `winPickerEl` (the inline window picker, `.winpicker`/`.wp-grid`). It is a **full 7-column month grid (Su–Sa, weekends included)**: leading empty cells `for (i<startDow)`, then `for (day=1..daysIn)`, header `Su Mo Tu We Th Fr Sa`.
- `app.js:14670+` — `openDateSearch`/the date-search picker also reuses the `.wp-*` 7-col month grid (same family as the standard view), reinforcing the mismatch with the 5-col mini track.
- `style.css` — `.rcc-*` rules (mini-card dot calendar) vs `.wp-*`/`.winpicker` rules (standard month grid); grep `.rcc-body`, `.rcc-dow`, `.wp-grid`, `.wp-dow`.

**Root-cause hypothesis (hypothesis):** The two calendars were authored independently. The mini-card calendar (`.rcc`) is a fixed 3-week Mon–Fri *progress track* (15 weekday dots, no weekends, no month navigation), while the standard view (`winPickerEl`/`.wp-grid`) is a navigable full 7-column monthly grid that includes weekends. They diverge on column count (5 vs 7), weekend handling (closed vs shown), and span/anchoring (fixed 3-week window vs full month). Jac wants them visually reconciled.

**Acceptance criteria:**
- [ ] The standard-view calendar and the mini-calendar card rows present a consistent day grid (same week start, same weekend treatment, same column model) so they read as one component.
- [ ] Whichever convention is chosen (Mon–Fri vs Su–Sa), both surfaces agree on it; window/start/end highlighting maps the same way in both.
- [ ] No regression to the inline window-edit flow (`winPickerEl` staging/confirm panel) or to availability greying (`dayBlocked`).

**Notes:** Pure layout/structure reconciliation — keep the decision (which grid wins) on the main session since it's a shared UI contract. Run the changed calendar through `jactec-ui` (yard data-plate language; reduced-motion + visible focus quality floor). Both calendars carry `data-r` stamps (R16 "Window calendar" per `app.js:4373`, R22 date picker) — preserve/update stamps and regenerate `rule-usage.js` if rule usage changes. No new icons needed; any glyphs come from `icons.js`.
