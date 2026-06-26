# Phase 4 — Role data seeding (runtime, post-deploy)

> **STATUS (2026-06-26, verified against the live backend):**
> - ✅ **Owner → Manager is already staged** on the live backend via
>   `settings.roleMeta` (the Owner login's password is unchanged and becomes
>   Manager tier once the new frontend deploys). Dormant + safe on the old
>   frontend, which ignores `roleMeta`.
> - ❌ **Developer login + adding any custom role is BLOCKED.** The live backend
>   `roles` map is a **fixed 6-slot set** (Owner, Mechanic, Driver, M.Tech,
>   Sales, Office) + Admin; `setConfig` silently drops new keys, so the
>   `developer`/`Jacob5133` login won't persist or authenticate. This needs a
>   **`Code.gs` change** (accept arbitrary role keys) deployed via **clasp**,
>   which is currently **RAPT-blocked**. Step 4 below cannot succeed until then.

Phases 0–3 (the tier model + customizable Settings UI) ship via the frontend PR.
This runbook applies the **actual role changes** Jac asked for. It is a **runtime
config edit**, done **in the live app** by an Admin — **no passwords are ever
committed** (the repo is public via Pages).

> Prerequisite: the PR (`claude/role-system-redesign-uayg4o`) is merged and live
> (or being tested on a deploy that serves the new `app.js`). The new
> Settings → Roles & Logins UI must be present.

## Do it in the app

1. Sign in with the **Admin** password (the permanent admin-tier login).
2. Open the logo menu → **Settings** → **Roles & Logins**.
3. **Convert Owner → Manager:**
   - On the **Owner** card, change the **Label** to `Manager`.
   - Set its **Tier** to **Manager**.
   - Leave the password as-is (the existing Owner password keeps working — no one
     is locked out). *(Optional: change the password here too if desired.)*
4. **Add the Developer login:**
   - Click **+Role**. On the new card, set **Label** = `Developer`, **Tier** =
     **Developer**, and **Password** = `Jacob5133`.
   - Developer tier is what unlocks the dev tools (Design Lint / Inspector /
     Rulebook). Until this exists, **no login sees the dev tools** (they moved off
     Admin).
5. *(Optional)* Add any other custom roles you want (e.g. a second Manager, a
   Sales lead) — pick a Label, Password, and Tier for each.
6. Click **Save**. Changes apply at **next sign-in**.

## Verify

- Sign out, sign back in as **Developer** (`Jacob5133`): the bottom-bar dev tools
  (🔍 Inspector, lint eye, Rulebook doc) are visible.
- Sign in as **Admin**: business powers intact (Settings opens, pricing edits,
  approvals), but the raw dev tools are **not** shown.
- Sign in with the old **Owner** password: it now signs in as **Manager** — can
  approve requests and take money, but Settings is gated.
- Sign in as **Office/Sales** (Money): can take money, cannot approve requests.
- Sign in as a **Staff** role (Mechanic/M.Tech/Driver): none of the above.

## Notes

- **Tiers, not names.** A custom role gets exactly its tier's powers. To change
  what a role can do, change its **Tier** — never expect the name to matter.
- **Can't strand admin access.** The **Admin** field is permanent (admin-tier),
  and the **Developer** built-in can't be deleted, so you always retain a way in.
- **`roleMeta`** (labels + tiers) is stored in the backend config `settings` blob
  and syncs to every signed-in device on load — no `Code.gs` change needed.

## Deferred — `DEFAULT_CONFIG` (Phase 5)

The fresh-deploy seed in `Code.gs` still lists the old roles. Update it (drop the
Owner default, add Manager + Developer defaults) **when the clasp credential is
re-minted** (currently RAPT-blocked: `invalid_rapt`). This only affects a
brand-new backend; the live one is already seeded and unaffected.
