# R-Rulebook "Windows" catalog — implementation plan

- **Spec:** [2026-06-22-rulebook-full-catalog-design.md](../specs/2026-06-22-rulebook-full-catalog-design.md)
- **Branch:** `design-system/rulebook-full-catalog`
- **Date:** 2026-06-22

Each phase is its own commit so the history is bisectable and the risky refactor
is isolated from the additive feature work. **Gates** before any push (per
CLAUDE.md): `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
`node ci/gen-rule-usage.mjs --check` — port 8000 is reserved, so
`sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, then
`git checkout -- ci/`.

---

## Phase 0 — Baseline (confirm green before touching anything)
- Run all three gates on the current branch; confirm pass. Establishes the
  "behavior unchanged" baseline for the refactor.
- **Verify:** all gates green. No commit.

## Phase 1 — Extract `buildPopupEl(o)` (the enabler; pure refactor, no feature)
**Why first + alone:** `renderOverlay` is central; isolating the extraction in its
own commit makes any regression trivially bisectable.
- Move the builder chain (app.js ~7002–7670) into
  `function buildPopupEl(o)`; each branch's `overlay.appendChild(pop)` → `return pop`.
- `renderOverlay()` keeps its pre/post phases; body becomes
  `const pop = buildPopupEl(o); overlay.appendChild(pop);` then the unchanged
  post-mount side-effects.
- Add an optional `opts.preview` param to `buildPopupEl`; guard in-branch
  focus/`setTimeout` side-effects (e.g. `comment` at ~7046) on `!opts.preview`.
- **Verify:** smoke + logic-test pass; manually open ≥6 varied popups (partform,
  payment, newCustomer, inspection, settings, qr) — identical behavior, Stripe
  mount + signature pad + camera + autofocus all still fire on the real overlay.
- **Model:** main session (central refactor, parity-critical).
- **Commit:** "Refactor: extract buildPopupEl(o) from renderOverlay (no behavior change)".

## Phase 2 — Admin gate → role-only
- `adminUnlocked()` → `return currentRole === 'Admin' || currentRole === 'Owner';`
- Remove `ADMIN_HASH`, `_cyrb53`, `_adminUnlock`, `toggleAdminLock`, the
  `js-adminlock` bottom-bar button (app.js:5723) **and its click handler** (grep
  `js-adminlock` to find the dispatch). Leave `requireAdmin()` untouched.
- Bottom-bar reshape is UI → quick pass through `/jactec-ui` + `/frontend`.
- **Verify:** Admin/Owner login shows Lint/Inspector/Rulebook; a non-admin role
  shows none; card-override `requireAdmin` still prompts/verifies.
- **Model:** main session (auth-sensitive — never delegate the gate logic).
- **Commit:** "Admin tools gate is role-only (Admin/Owner); drop the passphrase".

## Phase 3 — `WINDOW_CATALOG` registry + sample resolver
- Author the registry: one `{ kind, label, tag, sample() }` per `renderOverlay`
  builder branch (~28). `sample()` returns args from `DATA.*` demo seed (or `{}`).
- Helper `previewOverlayFor(kind)` → builds `{ kind, ...sample(), preview:true }`
  and returns `buildPopupEl(...)`, or `null` when `sample()` yields no usable
  record.
- **Verify:** in console, every catalog entry either returns a `.popup` element or
  a clean "no record" null — no throws.
- **Model:** Sonnet-delegable (well-scoped, spec-defined) with main review of the
  sample picks; keep money/auth kinds (payment/addCard) reviewed on main.
- **Commit:** "Add WINDOW_CATALOG registry + preview resolver".

## Phase 4 — "Windows" tab + row render (NEW UI → `/jactec-ui` then `/frontend`)
- New `RB_TABS` entry `{ id:'windows', label:'Windows', intro, items }`.
- Row builder: collapsed (`label · tag · 📋 copy-ref`) → click expands to the
  inert preview well (`pointer-events:none` + "PREVIEW — not live" stamp), the
  runtime-derived field list (introspect the built `pop`: `.lf-in`/`input`/
  `textarea`/`select`/`.file-drop`/add-buttons/gate-pills), the code location,
  and the copy-ref button (reuse the Inspector's clipboard mechanism).
- Lazy: build the preview on first expand only.
- Standalone section: inline card forms, global search + filter/sort + saved
  Views, context menu (R20), gate-pill dropdowns (R1) — location + copy-ref, with
  a live preview where cheap.
- `data-r` stamps on new stamped elements; `rb-*` styling; reduced-motion + focus
  visible per the quality floor.
- **Verify:** screenshot + self-critique (per `/jactec-ui`) before showing Jac;
  previews render inert (a payment preview's charge button does nothing);
  copy-ref copies the right locator.
- **Model:** main session drives the design-language pass.
- **Commit:** "Windows catalog tab: by-window inventory + inert live previews".

## Phase 5 — CI drift guard
- Extend `ci/gen-rule-usage.mjs` (or add `ci/gen-window-catalog.mjs`) to scan
  `renderOverlay` for `o.kind === '…'` builder branches and fail if any lacks a
  `WINDOW_CATALOG` entry. Wire a `--check` step into `.github/workflows/ci.yml`
  beside the existing "Rulebook field catalog is current" step.
- **Verify:** guard passes as-is; temporarily delete one registry entry → guard
  FAILS; restore.
- **Model:** Sonnet/Haiku-delegable (mechanical source scan), main wires CI.
- **Commit:** "CI: guard every popup kind is catalogued in WINDOW_CATALOG".

## Phase 6 — Stay-current docs (the standing rule)
- `CLAUDE.md`: generalize the R-rulebook gate line → emphatic *"ANY new/changed
  UI must keep the R-Rulebook current (data-r stamps + regenerated catalogs); the
  CI drift guards enforce it."*
- `.claude/skills/start/SKILL.md`: one-line pointer to that rule in §4 / gates.
- **Verify:** wording is unambiguous; gate commands listed match reality.
- **Model:** Sonnet-delegable (doc edit from a settled spec).
- **Commit:** "Docs: standing rule — any UI change keeps the R-Rulebook current".

## Phase 7 — Regenerate, gates, cache-bust
- If rule usage changed, `node ci/gen-rule-usage.mjs` (no `--check`) to regen
  `rule-usage.js`; run the new window-catalog generator if it emits a file.
- Run all gates green.
- Bump the shared `?v=` token on `style.css` / `rule-usage.js` / `app.js` in
  `index.html`.
- **Commit:** "Regenerate catalogs + cache-bust".

## Phase 8 — Manual verification + promotion (Jac's call)
- Manual: Admin/Owner → Rulebook → Windows tab → expand partform/payment/
  newCustomer/inspection → inert previews, fields listed, copy-ref correct;
  non-admin sees no dev tools.
- Propose promotion hops — `design-system/rulebook-full-catalog` →
  `area/design-system` → `staging` (phone QA) → PR `staging` → `main`. **Never
  auto-promote to `main`** — always Jac's explicit call.

---

## Sequencing notes
- Phases 1–2 are safe to land early (refactor + gate) and unblock everything.
- Phase 4 is the bulk of the new UI and the only part that must run through
  `/jactec-ui` + `/frontend`.
- Phases 5–6 make "stay current" real; do them before promotion so the guard
  ships with the feature.

## Open items to resolve during build (not blockers)
- Final `sample()` record pick per kind (use the first demo record that satisfies
  each branch's needs).
- Exact standalone-section membership (start list in spec §5; adjust with Jac).
- Whether the window-catalog guard lives in `gen-rule-usage.mjs` or its own
  script (decide by how much scan logic it shares).
