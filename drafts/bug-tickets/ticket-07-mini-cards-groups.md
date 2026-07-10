# BUG: Mini cards should be grouped into category sections with header rows

**Reported by Jac (verbatim):** "We need the categories, mini card to be... I'm sorry. Mini cards, plural, should be organized into groups. For example, excavators should all be in a section, and you can just add a row between these sections with the section title."

**Area:** units-fleet

**Symptom:** The mini-card list renders as one flat, sorted stream with no grouping. Jac wants the mini cards grouped by category, with a lightweight section-title row inserted between groups (e.g. all excavators under an "Excavators" header).

**Suspected code locations:**
- `app.js:6799-6830` — `listView`: builds `const list = el('div', 'list')`, sorts a single flat `rows` array (`sortRows`, line 6789), then `appendWindowed(list, rows, cs, card, (rec) => list.appendChild(rowEl(card, rec)))` (line 6829). This is the one place rows are appended — the natural seam to interleave category section-header rows.
- `app.js:6530-6539` — `appendWindowed`: the windowed paint loop (`rows.slice(0, limit).forEach(renderRow)`) that grouping must respect (headers can't break the 60-row window/"Show more" math).
- `app.js:4666-4683` — `rowEl` / the per-row `.row` template; a sibling "section-header row" element would be appended here-style into the same `.list`.
- `app.js:4828-4842` — `ROWS.units` (the unit mini-card `.ur`), each carrying `u.categoryId` → `IDX.category.get(u.categoryId)` — the grouping key. (`ROWS.categories` at 4844 is itself a category, so grouping most likely targets the **units** list of mini-cards.)
- `style.css` — `.list` / `.row` / `.ur` rules; a new `.list-section`/section-header row style would live alongside (grep `.list `, `.row`, `.ur`).

**Root-cause hypothesis (hypothesis):** No grouping logic exists anywhere (`grep` for `groupBy`/`section-head` returns nothing). The list is intentionally a flat sorted stream. Implementing this means, in `listView`, partitioning `rows` by `categoryId` (ordered, e.g. by category name), and emitting a non-selectable section-header row (`el('div','list-section', categoryName)`) before each group's mini-cards — while keeping `appendWindowed`'s window/"Show more" counting correct and not letting headers count as data rows.

**Acceptance criteria:**
- [ ] Mini cards in the targeted card are grouped by category, with a section-title row between groups (e.g. all excavators contiguous under an "Excavators" header).
- [ ] Section headers are display-only — not clickable/openable as records, and don't get an eye/+tab affordance.
- [ ] Windowing ("Show more", the 60-row cap) and search/filter still behave correctly; empty categories produce no stray header.
- [ ] Interaction with active sort/availability ordering is defined (grouping either replaces or composes with sort predictably, not both silently fighting).

**Notes:** Run the new section-header row through `jactec-ui` (yard data-plate language — a stamped Saira Condensed section label fits the "data-plate" idiom; consider a saddle-stitch divider as the light ranch seasoning, used sparingly). The header row is **new UI**, so it needs a `data-r` stamp and a `rule-usage.js` regenerate (`ci/gen-rule-usage.mjs`); confirm `node ci/gen-rule-usage.mjs --check` passes. No new icons required, but if a header shows a category glyph it must come from `CATEGORY_ICON` in `icons.js` (library-only rule). Decide grouping-vs-sort composition on the main session — it changes list semantics.
