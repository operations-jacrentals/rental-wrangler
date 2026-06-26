# BUG: Transport journey — drop the under-labels, swap end icons to the Jac Brundle logo, center icon to a map icon

**Reported by Jac (verbatim):** "We should remove the labels beneath the transport journey and the labels I referred to are jack, job, or site, and then jack. Instead, we should replace the jack icons with the Jack Brundle's logo asset, which you already have. And then replace the center icon with a map icon. instead of what's there now."

**Area:** rentals-dispatch

**Symptom:** The 3-stop transport journey (Jac yard → Job Site → Jac yard) shows text labels under each stop ("Jac", "Job Site"/"Site", "Jac"). Jac wants those labels removed, the two end "Jac" icons replaced with the existing JacRentals (Jac Brundle) logo asset, and the center stop icon replaced with a map icon from the library.

**Suspected code locations:**
- `app.js:5617-5661` — `stallRouteHtml(r, eu)`, the §20 per-unit "stall route rail" (R15). The stops: `stop('jacL', ICO_HOUSE, 'Jac', …)` (5656), `stop('site', ICO_USER, 'Job Site', …)` (5658), `stop('jacR', ICO_HOUSE, 'Jac', …)` (5660). The label text is the 3rd `stop()` arg, rendered as `.rtname` (5638).
- `app.js:5580-5607` — `miniJourneyHtml(r2, eu)`, the compact "Jac ─ Site ─ Jac" journey under an invoice rental line (also R15). `jacNode` (5600) uses `ICO_STORE` + `<span class="jlbl">Jac</span>`; `siteNode` (5601) uses `ICO_STORE` + `<span class="jlbl">Site</span>`. (Note: this variant currently uses `ICO_STORE` for both ends *and* the center — verify which renderer Jac is looking at; both carry under-labels.)
- `app.js:1203` / `1207` / `1208` — the inline SVG glyphs in use: `ICO_STORE` (storefront), `ICO_HOUSE`, `ICO_USER` (person, the current center icon).
- `icons.js:33` — `bluesteel`: the bespoke JacRentals steel logo asset (`I.bluesteel`), the existing brand mark to use for the two end "Jac" stops.
- `style.css` — `.rtname` / `.jlbl` (the under-label classes) and `.rtwell`/`.jbox` (icon wells). Grep these to hide/remove the labels and resize the icon wells. (journey styles under R15.)

**Root-cause hypothesis (hypothesis):** Straightforward UI change, not a defect. Remove the `.rtname`/`.jlbl` label spans (or stop passing the label arg) in `stallRouteHtml` and `miniJourneyHtml`; swap the two end-stop icons to `I.bluesteel` (the Jac Brundle logo from `icons.js`); replace the center stop's icon with a **library map icon** (must come from Lucide via `tools/gen-icons.mjs`, not a hand-drawn SVG and not the existing inline `ICO_PIN`).

**Acceptance criteria:**
- [ ] The "Jac" / "Job Site" / "Site" text labels beneath the transport journey stops are removed (both `stallRouteHtml` and `miniJourneyHtml`).
- [ ] Both end stops render the JacRentals/Jac Brundle logo (`I.bluesteel`) instead of `ICO_HOUSE`/`ICO_STORE`.
- [ ] The center stop renders a map icon sourced from the library (Lucide via `tools/gen-icons.mjs`), not a hand-authored SVG.
- [ ] The route still functions: tapping two stops sets Delivery/Recovery/Round-Trip; armed/locked (orange outline/fill) states intact; accessible labels/`aria-label` preserved even though visible text labels are gone.
- [ ] Reduced-motion / focus-visible quality floor respected.

**Notes:** **Icons-from-library rule (CLAUDE.md → Icons):** never hand-draw a glyph. The map icon must be added by mapping `name → lucide-icon-name` in `tools/gen-icons.mjs` and running it; `I.bluesteel` is the sanctioned bespoke brand mark and is fine to reuse. Run the visual change through `jactec-ui` (yard data-plate language; R15 journey) and screenshot + self-critique before showing Jac. Removing the visible labels but keeping `aria-label` matters for the accessibility floor. No `WINDOW_CATALOG` change; confirm `ci/gen-rule-usage.mjs --check` still passes if any `data-r="R15"` stamps shift.
