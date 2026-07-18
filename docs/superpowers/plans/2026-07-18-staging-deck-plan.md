# Staging Deck — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-07-18-staging-deck-design.md`
**Grounded in:** `tools/deploy-staging.mjs`, `tools/lib/staging-git.mjs`, `tools/lib/staging-control.mjs`,
`tools/staging-lease.mjs`, `tools/promote.mjs`, `ci/lease-test.mjs`, `ci/lease-deploy-test.mjs`,
`app.js` (theme toggle + chrome), `style.css`, `.claude/skills/{start,deploy,merge,promote,end}/SKILL.md`.

**Ships by full `/live`** — the in-app switcher touches served files (`app.js`/`style.css`), so it needs
`/deploy → /merge → /promote` with a `?v=` bump. (The switcher is dev-gated to the staging host, so it
renders as *nothing* on production — but the bytes still change.) The tooling/tests/skills are config-only
and ride the same PR.

---

## 0. Resolved architecture

| Path | Status | Owns |
|---|---|---|
| `tools/lib/staging-deck.mjs` | **new** | Pure logic: `deckId(feature, manifest)`, `slugFeature(branch)`, `addDeploy`/`pruneDeploys` (cap 20), manifest parse/validate/serialize (canonical bytes), and a **git-runner seam** for the publish orchestration (mirrors `staging-control.mjs`'s injectable seam → pure-Node testable). |
| `tools/deploy-staging.mjs` | **edit** | Add the **deck path (default)**: compute id → write `d/<id>/` + rewrite `d/deploys.json` + prune → one commit → CAS-retry on push reject → verify the folder URL. Add `--label`. Keep `--slots` (unchanged lease path). |
| `tools/promote.mjs` | **edit** | Deck-aware freshness: content-hash `trunk` vs the **newest deck deploy's** served bytes (fall back to slot scan under `--slots`). |
| `app.js` | **edit** | The dev-gated `Staging ▾` switcher: gate, manifest fetch, menu render, navigate. One §5 builder + `data-r` stamp (jactec-ui). |
| `style.css` | **edit** | Switcher styling via tokens (theme-toggle family). |
| `ci/deck-test.mjs` | **new** | Pure-Node tests (logic-test reporting idiom): id/sequence, prune, CAS-retry, manifest round-trip. |
| `ci/lease-deploy-test.mjs` | **edit** | Add: deck path builds the right folder+manifest commit; `--slots` still routes to the lease path. |
| `.github/workflows/ci.yml`, `CLAUDE.md`, `.claude/skills/{start,deploy,merge,promote,end}/SKILL.md` | **edit** | Gate wiring + document the deck-default / slots-backup flow. |

**Resolutions (single source of truth):**
- **[R1] Deck and slot-1 share `rental-wrangler-staging` but never touch each other's paths.** The deck writes
  ONLY under `d/**` (folders + `d/deploys.json`) and never root. A `--slots` deploy to slot 1 must scope its
  `syncFiles` wipe to **root-level served files only, preserving `d/**`**. (Deck folders are immutable review
  artifacts; a backup slot deploy must not delete a deploy Jac is viewing.)
- **[R2] No lease in deck mode.** Immutable paths ⇒ no shared target ⇒ no contention except the manifest write,
  which is handled by push-reject CAS-retry (same primitive as the lease). `--slots` still acquires a lease.
- **[R3] Atomic manifest via git-CAS on the served `main` branch.** The new `d/<id>/` folder + `d/deploys.json`
  update + pruned folders go up as **one commit**; on non-fast-forward reject → re-fetch `main` → recompute id
  (another deploy may have taken `-n`) → re-apply → retry (≤5, short backoff). Reuse `staging-git.mjs`'s porcelain
  push classifier (`!` = rejected, `LC_ALL=C`, stdout with the PAT never logged).
- **[R4] `id = <slugFeature(branch)>-<n>`.** `slugFeature` = branch tail lowercased, non-`[a-z0-9-]`→`-`, collapsed.
  `n` = 1 + max `n` among manifest entries with the same feature (0 → 1). `label` from `--label`, default = HEAD
  commit subject (truncated ~60 chars).
- **[R5] Manifest `when` is an ISO string** stamped by the deploy tool (a normal Node process — real time is fine;
  the workflow-only `Date.now()` ban does not apply here). Deploys are newest-first, capped 20.
- **[R6] Retention never strands a promote target.** Promote (deck mode) re-deploys `trunk` to the deck immediately
  before go-live (same as today's funnel flow), so the promote target is always the newest deploy — never pruned.
  So `pruneDeploys` needs no special keep-set beyond "newest 20"; the plan records this reasoning, not extra code.
- **[R7] Switcher is dev-gated by host, not a secret.** `isStagingHost() = location.hostname ===
  'operations-jacrentals.github.io' && location.pathname.startsWith('/rental-wrangler-staging/')`. Renders the
  switcher only there — absent on `app.jacrentals.com` and `#local`. No auth/PII gated on it (R-rules).

---

## 1. Data shapes

**`d/deploys.json`** (served on `main`, canonical `JSON.stringify(m,null,2)+'\n'`):
```jsonc
{ "version": 1,
  "deploys": [                       // newest-first, length ≤ 20
    { "id": "work-queue-92oeso-3",   // <feature>-<n>
      "label": "dated-action polish",// --label or HEAD subject
      "feature": "work-queue-92oeso",
      "branch": "claude/work-queue-92oeso",
      "sha": "3dfc9f5",
      "when": "2026-07-18T01:14:40Z" }
  ] }
```
Served folder: `…github.io/rental-wrangler-staging/d/<id>/` (full self-contained site copy).

---

## 2. Phases (dependency-ordered)

### Phase 1 — Deck core (`tools/lib/staging-deck.mjs`) + tests
1. `slugFeature(branch)`, `deckId(feature, manifest)`, `parseManifest`/`serializeManifest`/`emptyManifest`,
   `addDeploy(manifest, entry)` (prepend + cap 20), `pruneDeploys(manifest)` → returns `{ manifest, dropIds }`.
2. A `publishDeck({ files, id, label, meta, git })` orchestrator that takes an **injected git seam** (clone/read/
   write/commit/push/refetch) so it is unit-testable with a fake git, exactly like `staging-control.mjs`.
3. **`ci/deck-test.mjs`** (pure-Node, no network): id from empty/existing manifest, per-feature `max(n)+1`,
   20-cap prune returns the right `dropIds`, canonical round-trip is byte-stable, CAS-retry recomputes id when the
   fake git reports a push reject then succeeds. Wire into `ci.yml` + CLAUDE.md gate list.
   **Verify:** `node ci/deck-test.mjs` all green.

### Phase 2 — Deck publish path in `deploy-staging.mjs`
1. Default → deck: reuse `deriveSiteFiles` + `bumpVersionToken`; copy the crawled set into `d/<id>/`; call
   `publishDeck` with the real `staging-git` seam (clone `main` `--single-branch`, apply folder+manifest+prune,
   commit, push, CAS-retry per [R3]).
2. **[R1]** scope: deck writes only `d/**`; refactor the slot `syncFiles` wipe to exclude `d/**`.
3. `--label "<text>"`; `--slots` → the existing lease path verbatim.
4. Verify step: poll `GET …/d/<id>/index.html` for the expected `?v=` (~1 min), non-zero on timeout. Print
   **id · label · folder URL**.
   **Verify:** `node ci/lease-deploy-test.mjs` (extended) green; a real `node tools/deploy-staging.mjs --label "deck smoke"`
   from a scratch branch lands `d/<id>/`, updates the manifest, and the URL serves the bytes (curl).

### Phase 3 — `promote.mjs` deck-freshness
1. Deck mode: hash `trunk`'s `app.js`/`style.css`/`rule-usage.js`; fetch the newest deploy's same three files
   from `d/<id>/`; compare. Green on match, refuse otherwise (message: "re-deploy trunk to the deck").
   `--slots` keeps the current slot scan.
   **Verify:** `node ci/promote-test.mjs` (extend with a deck-freshness case) green; a dry promote preview shows the
   deck freshness verdict.

### Phase 4 — The in-app `Staging ▾` switcher (`app.js` + `style.css`)
1. Run through **jactec-ui**. `isStagingHost()` gate ([R7]); a `Staging ▾` control in the theme-toggle chrome
   family, stamped `data-r` (extend `RULE_META`/`rule-usage.js`; add a `WINDOW_CATALOG` entry only if it renders
   as a popup kind).
2. On open: `fetch('../deploys.json')` relative to `/d/<id>/`; render rows **label · id(mono,dim) · age**; mark the
   current id (parsed from `location.pathname`) "here"; row tap → `location.assign('../'+id+'/')`.
3. Reduced-motion safe, visible focus, tokens only, dark+light. Never renders on production/`#local`.
   **Verify:** headless render — switcher present on a simulated staging host + manifest fixture, **absent** on the
   production host; `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`, zero R0 lint.

### Phase 5 — Skills + docs
Update `.claude/skills/{start,deploy,merge,promote,end}/SKILL.md` + `CLAUDE.md` per spec §"Skill updates":
deck default, id+label, `--slots` backup, no lease in deck mode, promote deck-freshness, ephemeral (no release).
**Verify:** `node tools/gen-code-map.mjs --check`; skills read correctly; CLAUDE.md deploy-&-gates section matches.

### Phase 6 — Ship
Full gate battery (port-swap for smoke/logic) → self-critique screenshot of the switcher (staging host sim) →
`/deploy` (dogfood the deck itself) → review the switcher on the deck URL → `/merge` → `/promote`.

---

## 3. Risks / notes
- **git history growth** in the staging repo (folders added/removed each deploy) — acceptable for a staging repo;
  a periodic `git gc`/squash is a future op, out of scope.
- **Bootstrapping:** first deck deploy inits an empty `d/deploys.json`; the repo root (slot-1 content) is untouched.
- **Switcher during the build:** until the deck publisher exists, stage the switcher for review via `--slots`
  (the current path); once Phase 2 lands, the deck dogfoods itself.
- **YAGNI:** no per-deploy expiry timers, no cross-repo spreading, no standalone index page (in-app switcher only).
</content>
