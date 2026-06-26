# Implementation Plan — Role System Redesign (customizable roles + tiers)

Spec: `docs/superpowers/specs/2026-06-26-role-system-redesign-design.md`
Branch: `claude/role-system-redesign-uayg4o`

Gates after every code phase (port 8000 reserved → swap to 9147, then restore):
```
sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs
node ci/smoke.mjs && node ci/logic-test.mjs && node ci/gen-rule-usage.mjs --check \
  && node ci/check-window-catalog.mjs && node tools/gen-code-map.mjs --check
git checkout -- ci/
```

---

## Phase 0 — `config.js`: the tier registry

- Add `ROLE_TIERS` — ordered ladder: `[{id:'staff',rank:1,label:'Staff'}, {id:'money',rank:2,…}, 'manager'(3), 'admin'(4), 'developer'(5)]`.
- Add `tierRank(tierId)` → integer (0 for unknown).
- Add `BUILTIN_ROLE_TIERS` — default tier per shipped role id:
  `mechanic/mtech/driver → staff`, `office/sales → money`, `manager → manager`,
  `admin → admin`, `developer → developer`.
- Leave `ROLES` (KPI rings) untouched.
- Export the three new symbols; add them to the `config.js` import in `app.js`.
- **Verify:** gates green. **Commit:** "Role tiers: ladder registry in config.js".

## Phase 1 — `app.js`: permission resolver + gate rewrite

- Add `roleTier(role)`:
  - normalize (`String(role||'').trim().toLowerCase()`),
  - resolve via `settings.roleMeta[id].tier` → `tierRank`, else
    `BUILTIN_ROLE_TIERS[id]`, else match against a role label, else `0`.
  - keep a tiny `rank(tierId)` shorthand for the gates.
- Rewrite the gates (exact sites):
  - `adminUnlocked()` (12212) → `roleTier(currentRole) >= rank('admin')`.
  - **New** `devUnlocked()` → `roleTier(currentRole) >= rank('developer')`.
  - `canMoney()` (13288) → `!currentRole || roleTier(currentRole) >= rank('money')`.
  - `canApproveRequests()` (10067) → `roleTier(currentRole) >= rank('manager')`.
- **Dev-tools split:** the 3-button block at **7171–7173** (`js-lint`,
  `js-inspect`, `js-rulebook`) switches its gate `adminUnlocked()` → `devUnlocked()`.
  Leave the other `adminUnlocked()` sites (10760 curate, 11988 pricing edit,
  15127 migration) as business-admin.
- Replace remaining `Admin || Owner` literals with `adminUnlocked()`:
  - `requireAdmin` pass-through (12216), Settings badge (13000),
    Settings `adminPw` (13015), Settings save role-pw sync (13045 — keep its
    `currentRole === 'Admin' ? admin : roles[currentRole]` shape, just generalize
    the guard to `adminUnlocked()`).
- Update the comments at 12205–12211 / 4925 / 5933 to say tier, not "Admin/Owner".
- **Grep guard:** `grep -n "'Owner'" app.js` returns only intentional/no hits;
  no live string-compare of `currentRole` against a tier literal survives.
- **Verify:** gates green. **Commit:** "Role tiers: tier-based permission gates + dev-tools split".

## Phase 2 — `roleMeta` plumbing (read + backfill)

- Add helpers near the config accessors: `roleMeta()` → `state/​o.config.settings.roleMeta || {}`,
  `roleLabel(id)`, `roleTierId(id)` (meta → builtin fallback).
- Confirm `setConfig` already round-trips `settings` (it does — `setConfig` calls
  pass `config.settings`); ensure the Settings save writes `settings.roleMeta`.
- **First-run backfill:** when an admin opens Settings and `roleMeta` is empty,
  seed it from `BUILTIN_ROLE_TIERS` for each existing `roles` key so the pane
  renders tiers immediately (in-memory draft; persisted on Save).
- **Verify:** gates green. **Commit:** "Role tiers: roleMeta read + first-run backfill".

## Phase 3 — Settings → Roles & Logins UI (`/jactec-ui` → `/frontend`)

- Reshape `settingsLoginsPane` (3317) — each role row gains, beside the password:
  - **Label** input → `roleMeta[id].label`.
  - **Tier** picker (stamped segmented control over `ROLE_TIERS`) → `roleMeta[id].tier`.
  - **Remove ✕** (guarded).
  - **"+ Add role"** button → new row (slug id from label, blank pw + tier picker).
- Wire events into the settings draft; **Save** (13031–13046 path) writes
  `roles` + `settings.roleMeta` via `setConfig`.
- **Guards in the save path:** ≥1 role of tier ≥ admin must remain; `admin` &
  `developer` built-ins not deletable; no empty password/label; unique `roleId`.
- **Design language:** run `/jactec-ui` then `/frontend`; stamp every new control
  `data-r`; `node ci/gen-rule-usage.mjs` (regen); confirm `check-window-catalog`
  (no new popup — pane lives in the existing Settings window). Screenshot +
  self-critique before showing Jac.
- **Verify:** all gates green. **Commit:** "Customizable roles: add/remove/rename/re-tier in Settings".

## Phase 4 — Runtime seeding (config data — never committed)

Done at runtime via the shipped UI (an Admin/Developer), **not** in any committed
file. Documented in the handoff:
1. **Owner → Manager:** re-key live `roles.Owner` → `roles.manager` (password
   retained); `roleMeta.manager = {label:'Manager', tier:'manager'}`.
2. **Add Developer:** `roles.developer = <Jacob5133, entered in-app>`;
   `roleMeta.developer = {label:'Developer', tier:'developer'}`.
3. **Admin:** `roleMeta.admin = {label:'Admin', tier:'admin'}`.
> The Developer password is entered in the app / backend at runtime and is
> **never written to the repo** (public via Pages).

## Phase 5 — Deferred: backend `DEFAULT_CONFIG` (clasp)

Update the fresh-deploy seed in `Code.gs` (drop Owner default, add Manager +
Developer defaults) **when the RAPT-blocked clasp credential is re-minted**.
Non-blocking; live backend already seeded. Track in the handoff note.

## Phase 6 — Ship

- Bump the shared `?v=` cache-bust token on `style.css` / `rule-usage.js` /
  `app.js` in `index.html`.
- Final gates green → push `claude/role-system-redesign-uayg4o` → draft PR.
- Local test per `/start` §3 (serve on 9147, sign in at each tier, exercise the
  matrix in spec §8) before any promotion.
