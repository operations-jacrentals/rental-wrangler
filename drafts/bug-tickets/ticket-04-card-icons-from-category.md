# BUG: Unit card-row icons should be derived from the unit's category

**Reported by Jac (verbatim):** "The icons for the unit card rows should be derived from the categories."

**Area:** units-fleet

**Symptom:** A unit's row icon is chosen by fuzzy regex-matching the category *name* string, not from the category record's own icon, so a unit's glyph isn't reliably the icon that belongs to its category (and falls back to a generic excavator when no keyword matches).

**Suspected code locations:**
- `app.js:4828-4842` — `ROWS.units` renders the row icon as `categoryIconFor(cat && cat.name)` (the `.ur-cat` slot). The icon is derived from the category *name string*, not a per-category icon.
- `app.js:4616-4632` — `categoryIconFor(name)`: a chain of name-regexes (`/excavat|backhoe|dig.../` → `CATEGORY_ICON.excavator`, etc.) with a hardcoded `return CATEGORY_ICON.excavator` fallback. This is the "generic/hardcoded" fallback Jac is reacting to.
- `icons.js:92-109` — `CATEGORY_ICON` map (the vendored library glyphs incl. the Tabler backhoe via `CARD_ICON.categories` = `excavator`). This is the icon library the row icon should resolve through.
- `data.js:24-30` & `config.js` (Categories) — the category record shape (`categoryId`, `name`, rates, …). There is **no `icon` / `categoryIcon` field on a category today**, so "derive from the category" has nothing concrete to read yet.
- `app.js:4873` — `ROWS.categories` (the category mini-card) uses the same `categoryIconFor(c.name)`; aligning units to category icons should keep these two consistent.

**Root-cause hypothesis (hypothesis):** Row icons are derived from the category *name* via brittle string regexes rather than from the category itself. To make a unit's icon truly "come from its category," the category record needs an explicit icon key (e.g. `iconKey` selecting a `CATEGORY_ICON` entry), and `ROWS.units` should resolve `IDX.category.get(u.categoryId)` → that category's icon — falling back to `categoryIconFor(name)` only when unset, instead of always re-deriving from the name string.

**Acceptance criteria:**
- [ ] A unit's row icon resolves from its category (via `u.categoryId` → category icon), not from a generic/default glyph.
- [ ] Units in the same category always show the same icon as that category's mini-card icon.
- [ ] A category with no explicit icon still degrades gracefully (name-based fallback), never crashing or showing a wrong-domain glyph.

**Notes:** **Hard project rule — icons come from the library only:** every glyph must be an existing entry in `icons.js` (`CATEGORY_ICON`/`CARD_ICON`), vendored from Lucide via `tools/gen-icons.mjs`; never hand-draw a `<path>`. If a category needs a glyph that isn't in `CATEGORY_ICON` yet, add it through `tools/gen-icons.mjs`, not by pasting SVG. Adding an icon field to the category record is a data-shape change (`data.js`/`config.js` + possibly the category standard-view editor) — keep that contract decision on the main session. Run any new picker/affordance through `jactec-ui`; the `.ur-cat` slot carries the units row's `data-r` stamp — preserve it.
