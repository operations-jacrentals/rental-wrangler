# Role System Redesign — customizable roles + tiers

**Owner:** Jac
**Date:** 2026-06-26
**Status:** Design — awaiting review
**Branch:** `claude/role-system-redesign-uayg4o`

## 1. Problem

Today the app has two disconnected notions of "role":

1. **Login roles** — a `{ RoleName: password }` map plus a separate `admin`
   password, stored in the **backend** config (Google Sheet), fetched via
   `getConfig`, and edited in **Settings → Roles & Logins**. On sign-in,
   `backendCall('auth')` returns the matched role string into `currentRole`.
   The Settings pane only lets you **edit each role's password** — there is no
   add / remove / rename.
2. **Permission logic** — hardcoded to role-name strings in `app.js`:
   - `adminUnlocked()` = `currentRole === 'Admin' || currentRole === 'Owner'`
   - `canMoney()` = `!currentRole || Admin || Owner || Office`
   - `canApproveRequests()` = `currentRole === 'Owner' || currentRole === 'Admin'`
   - shop-landing checks `'mechanic'` / `'mtech'` (lowercase)
   - plus `config.js ROLES` — a separate hardcoded list of the 5 operational
     KPI roles (mechanic, mtech, driver, office, sales).

Jac wants to: **remove Owner, add Manager, add a Developer role (with its own
password), keep Admin — and make roles + labels customizable** (admins can add,
remove, and rename roles). The blocker is item 2: the moment roles are
customizable, name-matched permission checks break. Custom roles need a
**permission model**.

## 2. Goals

- Admins can **add, remove, rename, and re-tier** roles from Settings.
- A small, fixed **permission-tier ladder** governs what every role can do —
  built-in or custom — so a new role is safe by construction (you can't
  accidentally grant a security gate by typing a name).
- **Manager** role exists (tier Manager).
- **Developer** role exists (tier Developer; its password is seeded at runtime,
  never committed).
- **Admin** kept (tier Admin).
- **Owner** is **converted to Manager** — the existing Owner password keeps
  working and now signs in as the Manager role. No login is lost.

### Non-goals (YAGNI)

- No per-role free-form permission matrix. Tiers only.
- No new KPI rings for Manager / Admin / Developer (they carry none today, same
  as Admin/Owner).
- No backend `Code.gs` rewrite of `auth` / `getConfig` / `setConfig`. The
  feature rides on the **already round-tripped** config `settings` blob (below).

## 3. The tier ladder

A strict **superset ladder** — each tier includes every power below it. Stored
as ascending integer ranks so checks are simple comparisons.

| Rank | Tier id | Powers (cumulative) | Built-in roles |
|---|---|---|---|
| 1 | `staff` | Operational only: units, Shop/WOs, rentals, inspections. No money, settings, dev. | Mechanic, M.Tech, Driver |
| 2 | `money` | + see pricing/margin, take payments, invoices | Office, Sales |
| 3 | `manager` | + approve `wrangler-request`s, override blocks (no-card / blacklist / member-incomplete) | **Manager** (new) |
| 4 | `admin` | + Settings (Roles & Logins, KPIs, Company), category/pricing edits, migrations, curate shared sets | Admin |
| 5 | `developer` | + dev tools: Design Lint, Inspector, Rulebook | **Developer** (new) |

Owner's old powers (it was the admin ceiling: `adminUnlocked`, `canMoney`,
`canApproveRequests`) are now covered by Admin/Developer; the Owner *login*
becomes a Manager (§6).

## 4. Data model

### 4.1 Backend config (unchanged shape, enriched `settings`)

The backend config is `{ roles: { id: password }, admin: password, settings: {…} }`,
read by `getConfig` and written by `setConfig` (both already exist; `settings`
is already a free-form blob that round-trips). We **do not** change the backend
code. We add one key inside `settings`:

```
settings.roleMeta = {
  "<roleId>": { "label": "Manager", "tier": "manager", "color": "navy" },
  …
}
```

- `roles` stays the source of truth for **login identity + password**, keyed by a
  stable **`roleId`** (e.g. `manager`, `developer`, `office`). `auth` returns the
  matched key into `currentRole` exactly as today.
- `roleMeta[roleId]` holds the **display label**, **tier**, and optional color.
- **Renaming** a role changes only `roleMeta[id].label` — the `roleId` (login
  key) and password are untouched, so no one's login breaks.
- **Adding** a role writes a new `roles[id] = password` **and**
  `roleMeta[id] = {label, tier}`.
- **Removing** deletes both entries.
- The `admin` password field is retained as the bootstrap Admin login (back-compat).

### 4.2 Frontend registry (`config.js`)

- `ROLES` (the 5 operational KPI roles) is **unchanged** — KPI rings, chat
  rolebar, and KPI authoring keep working as-is.
- Add `ROLE_TIERS` — the ordered ladder (`[{id, rank, label}]`) from §3.
- Add `BUILTIN_ROLE_TIERS` — the default tier for each shipped role id
  (`mechanic→staff`, `office→money`, `manager→manager`, `admin→admin`,
  `developer→developer`, …). Used as the fallback when `roleMeta` is absent
  (e.g. an older backend that predates `roleMeta`).

## 5. Permission functions (`app.js`)

Add one resolver and rewrite the gates. The resolver is **case-insensitive and
id-or-label tolerant**, which also fixes today's `'mechanic'` vs `'Admin'` vs
`'Office'` inconsistency in how `currentRole` is compared.

```
roleTier(role)  // → integer rank 0..5
  // 1. normalize: trim + lowercase the incoming string
  // 2. match against roleMeta tier, else BUILTIN_ROLE_TIERS, else label match
  // 3. unknown / empty role → 0 when a backend is connected; demo/no-backend
  //    keeps today's "no role = full access" behavior (see canMoney note)
```

| Function | Was | Becomes |
|---|---|---|
| `adminUnlocked()` | `Admin \|\| Owner` | `roleTier(currentRole) >= rank('admin')` |
| `devUnlocked()` *(new)* | — | `roleTier(currentRole) >= rank('developer')` |
| `canMoney()` | `!role \|\| Admin \|\| Owner \|\| Office` | `!currentRole \|\| roleTier(currentRole) >= rank('money')` |
| `canApproveRequests()` | `Owner \|\| Admin` | `roleTier(currentRole) >= rank('manager')` |

**Dev-tools split.** `adminUnlocked()` today gates *both* business-admin actions
(category/pricing inline edit, migrations, curate shared sets, open Settings)
**and** the raw dev tools (Design Lint, Inspector, Rulebook). Implementation
will grep every `adminUnlocked()` call site and reclassify the **dev-tool
buttons** (Lint / Inspector / Rulebook) to `devUnlocked()`. Everything else
stays on `adminUnlocked()` (now tier ≥ admin), so **Admin keeps all business
powers**; only the raw dev tools move up to Developer.

**Call sites to update** (verify exhaustively with grep during implementation):
- `adminUnlocked()` definition + the Lint/Inspector/Rulebook button gates → `devUnlocked()`
- `canMoney()`, `canApproveRequests()` definitions
- `requireAdmin(...)` / the Admin-password prompt path (`backendCall` role check,
  Settings `adminPw`, Settings save role-pw sync) → use `adminUnlocked()`/tier
- Settings dropdown "Admin" badge → tier ≥ admin
- shop-landing `'mechanic'`/`'mtech'` → unchanged (still id checks; `roleTier`
  not needed there)

## 6. Seeding & migration (runtime config, never committed)

Because the live backend config is already seeded and `auth` matches the stored
`roles` map dynamically, the role changes are **config data**, applied at
runtime via the new UI / `setConfig` — **no `Code.gs` change required** for the
feature:

1. **Owner → Manager:** re-key the live `roles` entry `Owner` to `manager`
   (same password retained), and set `roleMeta.manager = {label:'Manager',
   tier:'manager'}`. The existing Owner password now signs in as Manager.
2. **Add Developer:** `roles.developer = <password set at runtime>` +
   `roleMeta.developer = {label:'Developer', tier:'developer'}`. **The password
   value is provided out-of-band and is never written to any committed file**
   (public repo — see CLAUDE.md "Don't").
3. **Admin:** unchanged; `roleMeta.admin = {label:'Admin', tier:'admin'}`.
4. Existing operational roles get `roleMeta` entries at their built-in tiers
   (defaulted from `BUILTIN_ROLE_TIERS` if absent, so this is lazy/optional).

These three writes happen through the new Settings UI by an Admin/Developer once
the frontend ships (or a one-off `setConfig`). A small **first-run migration**
in the frontend will, when an Admin opens Settings and `roleMeta` is missing,
backfill `roleMeta` from `BUILTIN_ROLE_TIERS` so the pane renders tiers
immediately.

### Deferred: `DEFAULT_CONFIG` (backend `Code.gs`)

The shipped fresh-deploy seed in `Code.gs` (`DEFAULT_CONFIG`) still lists the old
role set. Updating it (drop Owner default, add Manager + Developer defaults)
matters only for a **brand-new** backend, and requires a **clasp** deploy.
clasp's Google credential is currently **RAPT-blocked** (`invalid_rapt`), so this
is **deferred and non-blocking** — tracked in the handoff note. The live backend
is unaffected (already seeded).

## 7. Customization UI — Settings → Roles & Logins

Reshaped UI → runs through `/jactec-ui` (yard data-plate language) then
`/frontend`, and is stamped per the **R-Rulebook** (`data-r`), with
`rule-usage.js` regenerated and `WINDOW_CATALOG` kept current (the pane is part
of the existing Settings window; no new popup is expected, but verify the
window-catalog gate).

- Each role **row** gains, alongside the existing password input:
  - **Label** — editable text (writes `roleMeta[id].label`).
  - **Tier** — a stamped segmented/picker control listing the §3 tiers (writes
    `roleMeta[id].tier`).
  - **Remove (✕)** — deletes the role (guarded, below).
- **"+ Add role"** button → a new row (new `roleId` slug derived from the label;
  blank password + tier picker).
- **Reveal/hide passwords** toggle — unchanged.

### Guards (enforced in the save path)

- **At least one role of tier ≥ admin must always exist** — block removing or
  demoting the last one (prevents locking everyone out of Settings).
- **Developer and Admin built-ins cannot be deleted** (they can be re-tiered
  only within the admin/developer guard above).
- **No empty passwords** (existing rule) and **no empty labels**.
- **Unique `roleId`** — adding a role whose slug collides appends a suffix.
- Renaming never changes the `roleId`/password, so it can never lock a user out.

## 8. Testing

- **`node ci/smoke.mjs`** — app boots, login renders.
- **`node ci/logic-test.mjs`** — money/multi-unit regression unaffected.
- **`node ci/gen-rule-usage.mjs --check`**, **`node ci/check-window-catalog.mjs`**,
  **`node tools/gen-code-map.mjs --check`** — Rulebook/window/atlas drift gates.
- **Manual (local serve, §3 of /start):** sign in at each tier and assert:
  - Developer sees Lint/Inspector/Rulebook; Admin does **not** (but still sees
    Settings + pricing edits); Manager can approve + take money but not open
    Settings; Money can take money but not approve; Staff sees none of the above.
  - Add a custom role at a chosen tier → it appears at next sign-in with exactly
    that tier's powers.
  - Rename a role → login still works with the same password.
  - Try to delete the last admin-tier role → blocked with a clear message.
  - Owner password now signs in as Manager.

## 9. Risks / assumptions

- **⚠ VERIFIED 2026-06-26 — the backend rejects NEW role keys.** A live probe
  (`getConfig`/`setConfig`/`auth` against prod) showed the `roles` map is a
  **fixed 6-slot set** (Owner, Mechanic, Driver, M.Tech, Sales, Office) + the
  separate `admin` field. `setConfig` silently **drops** any unknown key — adding
  a `developer` login returned `ok` but did not persist, and `auth` for it is
  `unauthorized`. Consequences:
  - **Relabel + re-tier of EXISTING slots works with no backend change** —
    `settings.roleMeta` persists fine, so **Owner → Manager is live** (the Owner
    slot's password keeps working and becomes Manager tier on the new frontend).
  - **Adding the Developer login AND the whole "add custom roles" feature require
    a `Code.gs` change** so `setConfig`/`auth` accept arbitrary role keys. This is
    **load-bearing, not deferred**: until it lands, the frontend "+Role" UI saves
    the label/tier but the new login cannot authenticate.
  - That `Code.gs` change needs **clasp**, currently **RAPT-blocked**
    (`invalid_rapt`); the source can't be read in-session to pre-write a precise,
    security-safe patch. Unblock path: re-mint `CLASPRC_JSON_B64`, then pull →
    patch the role-key restriction + seed Developer → deploy.
- **Case/id normalization** is centralized in `roleTier()`; no other code should
  string-compare `currentRole` against a literal tier — only ids (like the shop
  landing) remain as direct id checks.
- Removing Owner-as-a-name is safe because nothing keys off the literal
  `'Owner'` after the gate rewrite (verify via grep that no stray `'Owner'`
  comparison survives).
