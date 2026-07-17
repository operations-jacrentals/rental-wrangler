# Cross-device user sync — design spec

**Date:** 2026-07-17 · **Status:** approved design, pre-implementation · **Author:** Claude (with Jac)
**Branch (when built):** a short feature branch off `trunk`.

## 1. Goal

A logged-in user's **settings, session, and comms follow the *person* across their
devices**, instead of living per-device in `localStorage`. Log in on your phone and
your tablet and you see the same prefs, the same saved searches, the same open
conversations, and you pick up roughly where you left off.

## 2. The load-bearing fact — identity

Sync requires a stable per-user key. That key is **`personId`** — resolved server-side
from the phone number under **phone-identity login** (`FEATURES.phoneIdentity`, the live
default). It is set at `pidAdopt()` alongside `currentRole` / `currentUser`.

The old **shared-password login has no verifiable user** (`currentUser` is a typed
string). Per Jac (2026-07-17) we do **not** build a shared-password fallback: phone-identity
is treated as universal. But the sync layer must **no-op gracefully** when `personId` is
absent (legacy login) — fall back to today's device-local `localStorage`, never write
un-keyed data, never crash.

## 3. Scope (approved 2026-07-17)

Follows the person across devices:

| Bucket | Contents | Today |
|---|---|---|
| **Display & sort prefs** | `previewsOff`, `hapticsOff`, `loginMuted`, per-card `sort`, `collapsedGroups`, `ruRange` (report window) | device-local `localStorage` |
| **Saved Searches (Views)** | `views.all` | device-local **by a 2026-06-29 decision — this reverses it** (backend `getViews`/`setViews` already exist, idle) |
| **Dispatcher route state** | `dispatchOrder` / `dispatchTimes` / `dispatchSchedule` / `dispatchLanes` | device-local (already flagged in-code as a sync candidate) |
| **Comms state** | `commsEnded` (ended conversations) **and the whole open comms rail** (`commsRail` sessions/tabs) | device-local; the open rail is deliberately empty on every login — **this reverses that** (Jac: sync the whole rail) |
| **Session resume** | last active card + `state.mobileCol` ("resume where you left off") | not persisted |
| **Mr. Wrangler AI + team-chat** | AI transcript history + team-chat attribution | synced today but **keyed to ROLE**, so people sharing a role login see each other's history — **re-key to `personId`** (fixes the leak *and* makes it follow the user) |

**Explicitly NOT synced:** `overbook` (a yard *policy*, not a personal display pref — leave
device-local for now; revisit as a company-wide setting separately). Ephemeral device caches
(`trips`, `tripsMap`, throttle counters), device credentials (`pidToken`, `scanDevice`), and
purely view-local collapsible state (`unitSecOpen` etc.) stay device-local by design.

## 4. Architecture — hybrid store (approved: Approach A hybrid)

Two mechanisms, both keyed on `personId`:

### 4.1 New per-user blob — the light state
A single additive backend action pair, mirroring `getConfig`/`getViews`:

- **`getUserPrefs`** `{ personId } -> { doc }`
- **`setUserPrefs`** `{ personId, doc }` (field-merged server-side; last-write-wins per field)

Storage: a new `UserPrefs` Sheet tab, one row per `personId` holding a JSON doc. Additive —
no change to `PERSIST_KEYS` or the 12 synced entities.

**Client:** `state.userPrefs` is loaded once in `finishLoad()` (after `pidAdopt` sets
`personId`). A debounced `flushUserPrefs()` — modelled on `flushSave` / `pushChatsSoon`
(imperative, render-independent) — writes on change. Every device reads the same person's doc.

> **`personId` in the request body is a HINT, never authority** (🟡 /role Gap 3). The backend
> resolves the caller via `pidResolveCaller_(sessionToken)` and validates any body `personId`
> against it (mirroring `authSetPin_`'s `caller.personId !== body.personId → unauthorized`); it
> never selects the storage row from a client value alone. Same rule for the §4.2 re-keyed actions.

Doc shape (`v` = schema version for forward migration):
```
{
  v: 1,
  prefs:    { previewsOff, hapticsOff, loginMuted, sort:{<card>:{field,dir}}, collapsedGroups:{}, ruRange },
  views:    [ ...saved searches... ],
  dispatch: { order, times, schedule, lanes },
  comms:    { ended:[...], rail:{ sessions... } },
  session:  { col, mobileCol },   // top-level column only — never a specific record (§5)
  updatedAt
}
```

### 4.2 Re-key the two existing heavy stores (surgical, no new blob)
The Wrangler transcripts and group-order already have dedicated, deployed actions and can be
large — keep their own storage, just change the key:

- **`getWranglerRail`/`setWranglerRail`** — key `personId` (was role). It sends no identity payload today → the backend derives `personId` **server-side from the session token**, NOT a new client-trusted `personId` field (🟡 /role Gap 4 — same rule as §4.1).
- **`getGroupOrder`/`setGroupOrder`** — key `personId` (was `currentRole`).
- **Team-chat attribution** — `commentUserKey()` / `chatSyncIdentity()` switch from the free-text `currentUser`/`currentRole` to `personId`.

## 5. Data flow

- **Load** (`finishLoad`, per login, once `personId` known): fetch `getUserPrefs`; hydrate the
  in-memory prefs/session/comms from the doc; **fall back to `localStorage`** if the fetch fails
  or the doc is empty (offline-safe). Group-order / Wrangler-rail load via their re-keyed actions.
- **Write**: each place that writes one of the synced `localStorage` keys today *also* stamps
  `state.userPrefs` + calls `flushUserPrefs()` (debounced ~1–2s). `localStorage` is kept as the
  **offline mirror** so the app still works with no backend.
- **Shared-device scoping (🔴 /role Blocker 1 — required):** the local mirror MUST be scoped to the
  current device-trust token exactly as `dataCache` already is (`cacheDeviceOk()` +
  `cacheTokenTag(pidLocalToken())`, app.js:23518-23532). On login/logout the sync-target keys
  (`jactec.commsRail`, `commsEnded`, `dispatch*`, `previewsOff`, `hapticsOff`, `loginMuted`,
  `collapsedGroups`, `ruRange`, `sort.<card>`, `views.all`) are **wiped** (extend
  `pidTokenClear()`/`pidAdopt()`, app.js:24402-24408) or namespaced by a token-tag suffix — so
  Person B on a shared shop PC can never paint Person A's stale state before B's `getUserPrefs`
  resolves. Without this the offline mirror is itself a cross-operator leak.
- **Session resume (resolved, Jac 2026-07-17):** persist ONLY the **top-level column** (Yard /
  Rentals / Customers) + the phone **`mobileCol`** — never a specific open record (`recId`). On
  each view change record `{col, mobileCol}` into `state.userPrefs.session`; on login,
  `applyRoleLanding()` yields to the saved column **if present**, else the role landing is the
  default. Because no specific customer/invoice record is ever restored, the customer-facing-screen
  risk (Sales-Outside / Driver on a phone) is designed out. (Jac: "top level plus mobile landing.")
- **Conflict**: last-write-wins per field (server field-merges the doc). Two devices editing the
  *same* field within the debounce window is the only lossy case — rare for one person, acceptable.

## 6. Migration on the re-keys (resolved, Jac 2026-07-17)

The role-keyed stores are **commingled** (multiple people share one role bucket), so how each
re-key handles the legacy data is decided per store by content-sensitivity — this resolves
/role Blocker 2 (no silent cross-person fan-out):

- **Group-order** → **seed from the role default.** On a person's first login the role-keyed
  arrangement becomes their *starting* column order; they then customize their own per-`personId`
  copy, which diverges from there. Arrangement only, no content → no leak. (Jac: "starts as a role
  default, but users can customize it after that.")
- **Mr. Wrangler AI rail** → **start fresh — do NOT migrate.** The old role-keyed rail is
  commingled chat content; copying it would hand one person other people's AI history. So a
  person's per-`personId` rail begins **empty**; the legacy role-keyed rail is abandoned, never
  copied. Zero cross-person leak, at the cost of pre-cutover AI history (convenience data that was
  never cleanly per-person anyway). (Jac: "start fresh.")
- **Team-chat** → only *attribution* changes going forward (`commentUserKey → personId`); the chat
  *content* is a separate multi-member store (`getChats`) and is untouched, so nothing is lost.

Net: no silent cross-person fan-out, and no meaningful data loss (group-order seeds, team-chat
content stays; only the convenience AI-rail resets).

## 7. Reversals being made deliberately (all Jac-approved)

1. **Views** become per-user (undoes the 2026-06-29 device-local decision).
2. **Comms rail** follows the user (undoes "login = empty rail").
3. **Wrangler AI + team-chat** go person-keyed (undoes role-scoped, fixing the cross-person leak); the commingled legacy AI rail is **not migrated** (start-fresh per person, §6) so the fix can't re-leak.

These are documented here so a future reader knows they were intentional, not drift.

## 8. Safety / gates

- **No new PII or pricing surface.** The doc holds innocuous prefs/UI state keyed on `personId`,
  behind the authed backend — no customer data, no margin/cost. (A `/role` audit will confirm
  before build — data-sensitivity + isolation are the hard-fail gates.)
- **Customer isolation is unaffected** — this is operator prefs, not customer data.
- **Operator isolation (the real gate — SERVER-SIDE):** `getUserPrefs`/`setUserPrefs` (and the
  re-keyed `getWranglerRail`/`getGroupOrder`) MUST resolve `personId` from the **authenticated
  session token on the backend**, never trusting a client-supplied `personId` — otherwise operator
  A could read/write operator B's prefs (and AI history) by passing B's id. Any client `personId`
  is a hint the server validates against the session, never authority. "The client keys correctly"
  is not acceptable — isolation is enforced in `Code.gs`.
- **Defensive under legacy login**: no `personId` → sync layer no-ops to device-local; never
  writes un-keyed; never blocks boot.
- Backend `Code.gs` changes are **additive** (`getUserPrefs`/`setUserPrefs` + the re-key params)
  and ship via `/clasp`; go-live is Jac's Apps Script editor deploy.

## 9. Testing

- **Unit/logic:** field-merge in `setUserPrefs`; hydrate-vs-fallback precedence (server doc beats
  stale `localStorage`, but `localStorage` fills in when offline); migration seeding fires only on
  empty; `personId`-absent no-op path.
- **Two-device (manual, Jac):** log in on two devices as the same person — change a sort/pref on
  one, confirm it appears on the other after a reload; end a conversation on one, confirm ended on
  the other; confirm two people sharing a role no longer see each other's Wrangler history.
- CI gates unchanged (this is additive client + backend).

## 10. Open risks / notes

- **Blob growth:** the light-state doc stays small by keeping transcripts/group-order out of it
  (§4.2). Watch `comms.rail` size if a user hoards many open threads; cap if needed.
- **Debounce vs. rapid multi-device edits:** last-write-wins is the accepted trade-off; revisit
  with per-field timestamps only if it bites.
- **`overbook`** parked as a policy question, not synced here.
- Phase 2 candidate (not this spec): **Task 2 — role-specific UX** (home card / list-group order
  per role) reads whatever this store lands, so it comes after.

## 11. Audit status

`/role` audit **done** (2026-07-17) — 2 blockers + 3 gaps, all folded in (§4.1, §5, §6, §8).
No margin/PII/customer-isolation issues. Residual required work is captured in §12.

## 12. Implementation plan (build-ready; Ultracode → drive as a Workflow)

Ordered, each step independently verifiable:

1. **Backend (`Code.gs`, additive — `/clasp` push; go-live is Jac's Apps Script editor deploy).**
   Add `getUserPrefs`/`setUserPrefs` — `personId` from `pidResolveCaller_(token)` (never the body),
   field-merge the doc, new `UserPrefs` sheet tab (one row/personId). Re-key `getGroupOrder`/
   `setGroupOrder` + `getWranglerRail`/`setWranglerRail` to resolve `personId` server-side; enforce
   `caller.personId !== body.personId → unauthorized` on writes.
2. **Client store.** `state.userPrefs`; `loadUserPrefs()` in `finishLoad()` (only when `personId`
   is set — else the layer no-ops to device-local); `flushUserPrefs()` debounced (mirror
   `flushSave`/`pushChatsSoon`); hydrate = server doc beats stale `localStorage`, `localStorage`
   fills in offline.
3. **Mirror scoping (Blocker 1).** Extend `pidTokenClear()`/`pidAdopt()` to wipe the sync-target
   `localStorage` keys on login/logout (or token-tag namespace them) — no cross-operator paint on
   a shared device.
4. **Wire each bucket (fan-out unit).** At every synced `localStorage` write site (~13: previews,
   haptics, loginMuted, `sort.<card>`, collapsedGroups, ruRange, views.all, dispatch*, commsRail,
   commsEnded) also stamp `state.userPrefs` + `flushUserPrefs()`; hydrate from the doc on load. One
   independent wiring task per bucket → parallelizable.
5. **Re-keys.** groupOrder/wranglerRail/team-chat client calls → `personId`; group-order seeds the
   role default on first login (then diverges); Wrangler rail starts fresh (no migrate); team-chat
   attribution `commentUserKey → personId`.
6. **Session resume.** Record `{col, mobileCol}` on view change; `applyRoleLanding()` yields to the
   saved column if present (role landing stays the default).
7. **Tests.** `logic-test` additions — field-merge, hydrate-vs-fallback precedence, `personId`-
   absent no-op, mirror-wipe-on-login; plus Jac's two-device manual pass (§9).
8. **Ship.** Feature branch off `trunk` → `/deploy` (served files change) → `/merge` → `/promote`;
   backend via `/clasp` (Jac's editor deploy for go-live).

**Workflow shape (Ultracode):** step 4 fans out one agent per bucket (worktree-isolated so they
don't collide on `app.js`), each wiring + self-verifying its bucket; steps 1-3/5-6 are the shared
scaffold; a final adversarial-verify pass re-checks isolation + the mirror-wipe + no-orphan re-keys.
