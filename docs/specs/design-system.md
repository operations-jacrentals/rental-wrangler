# Design System — SPEC v1 (DRAFT)

**Date:** 2026-06-28
**Status:** DRAFT — for critique
**Area branch:** `area/design-system`
**Task branch:** `design-system/spec` (proposed)
**Maturity:** ✅ Shipped (deeply enforced)
**Scope:** The visual language of Rental Wrangler and the machinery that enforces it — the token/theme layer, the R0–R25 stamped rulebook + one builder per rule, the flag-driven color engine, the admin Rulebook overlay (now including the live Windows catalog), `DESIGN.md`, the three CI drift guards, and the `jactec-ui` skill that builds and polices all of it.

## ✅ Decisions — 2026-06-29 critique (Jac)

- **D1 — Ship the flag-settings UI fully; ALL flags toggleable (Q6).** The parked per-entity flag toggle + severity-override UI ships (persisted in `config.settings.flagOverrides` via existing `setConfig`). **No flag is hardcoded non-disableable** — an admin may toggle/re-severity *any* flag, including the money/credit/blacklist safety flags (`unpaid-balance`, `no-card`, `blacklist`). Jac accepts the trade-off (an admin can hide a credit/money signal). *Mitigation to bake in regardless:* turning off a safety flag is an `adminUnlocked()`-gated, server-`setConfig`-gated act and should `logAction` an audit line so a disabled safety flag is traceable; default state stays the hardcoded `FLAG_META` (all on).
- **D2 — Dark-only stays the brand stance; NO user-facing theme switcher (Q7).** "Steel yard at night" remains the single identity. The light theme (`[data-theme="light"]`) stays an internal/accessibility fallback only — not exposed as a user toggle. This closes Q7 **and** Q12 (no new theme-write path needed; `setConfig` gate untouched). The `config.settings.theme` proposed field (§4.3) is therefore **not** added in v1.
- **D3 — Promote token contrast to a hard, build-failing gate now (Q4).** `ci/check-design-md.mjs` contrast findings move from advisory (warn) to **ERROR-level (build-failing)**. Clear any existing warnings first, then flip the gate; a legitimate brand-orange ratio that trips it gets an explicit, reviewed allowlist entry rather than a silent pass. AC #4 updates accordingly.
- **D4 — Adopt the doc truth-ups as-is (Q1/Q2/Q5/Q9/Q11):** correct CLAUDE.md / roadmap / `rulebook.md` / `DESIGN.md` to **R0–R25** (sync banner counts) and to the **5-tier ladder** (dev tools = `devUnlocked` tier 5, Settings recolor = `adminUnlocked` tier 4, money = `canMoney` tier 2 — drop "15 roles"/"admin-gated" prose); mark the **Windows catalog SHIPPED**; add the **`RB_FOUNDATION` drift guard** (Q5) and a **prose-doc rule-count CI cross-check** (Q9) so the docs can't re-drift. Q3 (preview money/PII scrub) stays **gate-as-is, do not loosen** — scrubbing only becomes mandatory if a preview ever leaves the developer-only context. Q8 (Figma/DESIGN.md export) and Q10 (hard ranch-twist cap) deferred — keep ranch-twist voice-governed, no numeric cap yet.

---

## 1. Goal & Problem

### 1.1 What this area is for

Every other area (Rentals, Units, Invoicing, Shop, Customers, KPIs…) renders UI. **This area owns the question of how that UI is allowed to look and behave** — and, crucially, the enforcement so the answer can't drift. It is the "operating system" beneath the entity areas: they consume its builders, tokens, and color engine; it consumes none of them.

### 1.2 The business / user problem

A single-file vanilla-JS SPA grown to ~16k lines of `app.js`, edited by Jac and by AI agents, has exactly one failure mode that compounds: **drift**. A pill hand-rolled here, a hex code pasted there, a native `title=` tooltip, a popup that the Rulebook doesn't know about, a `DESIGN.md` token that no longer matches `style.css`. Each is individually harmless; together they turn a sharp, unmistakable interface into generic, AI-detectable "slop" — the exact thing Jac most wants to avoid.

The north star is therefore **two things at once**:

1. **Identity.** Every surface reads as *one shop* — the JacRentals yard data-plate: dark industrial steel, ONE safety-orange ignition accent, the hi-vis hazard stripe, stamped Saira Condensed labels, corner rivets, a light wrangler/ranch seasoning carried mostly in voice. If a glance reads "western" before it reads "industrial rental yard," it's wrong.
2. **Self-enforcement.** The system is built so that *the wrong thing is visibly wrong* — the R0 flash-lint pulses any un-stamped element red, three CI gates hard-stop a build on drift, and the in-app Rulebook documents itself from the same metadata the app renders from. The design system is not a doc you're asked to follow; it's a machine that catches you when you don't.

### 1.3 North star

> A new contributor (human or agent) cannot ship an element that looks foreign, because the only fast path to building anything is through a stamped builder, and anything that bypasses the builders flashes red on screen and fails CI.

---

## 2. Current State (Baseline) — DOCUMENTED AS CANON

This area is **shipped and deeply enforced**. Everything below is live on `main` and is treated as canon, not proposal. The only genuinely unbuilt items are called out in §2.7.

### 2.1 The token / theme layer ✅

`style.css:8–60` (`:root` + `[data-theme="light"]`). One stylesheet edit re-themes the whole app because render code **never hardcodes a color** — it resolves through `config.js` (`COLOR_TOKENS`, `colorVar()`, `colorBgVar()`) which only references CSS var *names*.

| Token family | Vars (dark default) | Notes |
|---|---|---|
| Accent | `--accent #ff7a1a`, `--accent-soft`, `--accent-line`, `--on-orange #1a1205` | ONE orange, three meanings (selected tab · ignition · linked record). Dark ink on orange, **never white**. |
| Surfaces | `--bg #0b0c0f`, `--bg-2`, `--panel`, `--panel-2`, `--card`, `--card-head` | Near-black → steel, all within ~12% lightness of each other. |
| Lines | `--line`, `--line-soft` | Delineate with borders, not big fills. |
| Text | `--txt`, `--txt-2`, `--txt-3`, `--track` | 3-step hierarchy; max contrast reserved for orange + data values. |
| Status registry | `--green #34d399`, `--yellow #ffe000`, `--red #ff1040`, `--blue`, `--navy`, `--purple`, `--pink`, `--brown`, `--gray`, `--orange` | Each hue means ONE thing everywhere. `-bg` soft-fill variant for each. |
| Mix tones | `--mix-green`…`--mix-orange` | Bolder proportional-mix viz fills (inspection mix / service tints). |
| Form | `--radius 16px`, `--chip-radius 12px`, `--shadow`, `--chip-shadow`, `--font "Geist"` | |
| Ranch | `--tan #c2925a`, `--tan-deep` (yard theme) | Saddle-stitch + tiny touches only. |

Light theme (`[data-theme="light"]`) overrides the **same names** with darker, saturated status hues so pill text still reads on the soft `-bg` fills. The page frame: `html` scrolls horizontally / never vertically; `body` holds a `min-width:1180px` desktop floor (`style.css:64–77`).

### 2.2 The R0–R27 stamped rulebook + one builder per rule ✅

**`APP-10 · §5 UI Builders** (`app.js:3897`+). The law: every lint-family UI element is produced by exactly ONE builder function that stamps `data-r="Rxx"`. You extend the builder; you never hand-roll the markup. Debug language is rule-first: *"that pill violates R4 — fix `dPill`."*

| R | Name | Builder(s) | Law |
|---|---|---|---|
| R0 | Flash-lint | `body.rw-lint` CSS | Any un-stamped pill/add/flag/link/req/seg/file-drop/datefield (or a native `title`) pulses red. **Build target = ZERO.** |
| R1 | Gate pill | `gatePill`/`gatePillRaw`/`funnelPill`/`masterGate`/`unitStatusGate` | The status DROPDOWN that moves a record forward — big shape + chevron. The only "pressable status." |
| R2 | Linked pill | `refPill`/`unitPill` | Opens another record. Orange outline + destination-card icon; optional ✕ to unlink. |
| R3 | Status badge | `statusPill` | Informational status only: registry color + parent-card icon + hover underline. Never an action. |
| R3b | Data chip | `badge` | A plain FACT (`480 HRS`, `No GPS`): gray, no icon, no hover. |
| R4 / R4b | Derived pill / flashing | `dPill` / `dPill({alert})` | Rides another pill: ink + icon only, no bg/border; sits right of its parent (left if parent is right-aligned). `{alert}` pulses. |
| R5 | *retired* | → R5b | Nothing stamps R5. |
| R5b / R5c | Blue add / Empty field | `addBtn({link\|line\|anchor})` / `addBtn()` | Blue dashed `+Thing` links/creates a record OR adds a line; gray dashed `+Thing` is a normal empty field. |
| R6 | Required | `reqBtn` / `.req` | White + dark ink until entered/captured — stays loud. |
| R7 | Hyperlink | `linkName` / `.inv-line-link` | Blue · italic · NOT bold · permanent underline. |
| R8 | Derived value | `kv({derived})` / `.derived` | Italic = the app computed it. |
| R9 / R9b | Title flags / flashing | `flagEl` / `flagsStack` / `flagEl({alert})` | ≤2 stacked 14px mini-flags beside a title — no backgrounds; `alert` pulses, `sect` scrolls to a section. |
| R10 | S1 title chip | `.c-titlecard` (`cardEl`) | Dark chip · white bold label · plain orange icon · permanent orange border. |
| R11 | Section | `.section` + `sec-green/yellow/red` | Centered header; header + border follow the LIVE status. |
| R12 | Notes line | `notesSection` | Boxless, label-less; filled→top, empty→bottom above history. |
| R13 | History | `historySection` | Count chips above the search filter inline; record-backed links only. |
| R14 | Seg toggle | `segCtl` | 3-state segmented control. |
| R15 | Journey | `yardToolHtml` / `miniJourneyHtml` | Yard +Start/+FC/+End + Jac─Site─Jac transport; white = video owed. Per-unit. |
| R16 | Window calendar | `rdcal-edit` / `winPickerEl` (inline) | The rental window — an inline editable month calendar in the detail (popup retired 2026-06-25). |
| R17 | Action pill | `actionPill` | commit = blue · money = green · danger = solid red; `.locked` = gated. |
| R18 | Ghost | `ghostPill` | The ONE quiet action — Cancel / Close / Exit / Clear. |
| R19 | Attention flash | `attnFlash` / `flashOr` | A glow that points AT the on-screen fix instead of an error message. |
| R20 | Context menu | `openCtxMenu` (right-click · long-press) | Cut/Copy/Paste/Clear/Search/Replace/Add Comment/Start chat/Ask Mr. Wrangler. Never on bare `.row`/dead space. |
| R21 | File drop | `fileDrop` | The MASSIVE popup add-file zone — R5b blue dashed at full size. |
| R22 | Date picker | `dateField` | The ONE app-styled calendar for a single date/time (NOT the rental-window timeline). Native pickers banned. |
| R23 | Tooltip | `data-tip` attribute | Every hover hint goes through `data-tip`; a native `title=` is an R0 violation. |
| R24 | Close ✕ | `closeX` | Red circle · white ✕ — the deliberate close/remove; hover-reveal variant on tabs. |
| R25 | Sync banner | `renderSyncBanner` / `#sync-banner` | The persistent "Not saving" plate — red hazard-stripe danger cap; the ONE non-toast alert; lives on `<body>` outside `#app`. |
| R26 | Manual link | `sourceLinkBtn` | Ghost-circle external-link icon beside a service task — opens its cited OEM manual page (`task.sourceUrl`) in a new tab; renders only when the task carries one. (units-fleet, shipped 2026-07-08.) |
| R27 | Due-Today banner | `renderSchedBanner` / `#sched-banner` | Top-of-screen reminder plate — caution-YELLOW hazard-stripe cap; lists the scheduled actions due today; manual-X dismiss (session-sticky). Lives on `<body>` outside `#app`, like R25. (invoicing-payments, shipped 2026-07-08.) |

`RULE_META` (`app.js:4351–4383`) is the machine-readable mirror of this table; the in-app Rulebook + Design Inspector render from it. **Note:** the roadmap/CLAUDE.md still say "R0–R24"; the live `RULE_META` now carries through **R27** (R25 sync banner, R26 manual-link, R27 Due-Today banner — the last two promoted to staging 2026-07-08). This drift between docs and code is logged as an Open Question (§11 Q1); whether R25+ "count" as per-element stamps is the same open debate.

### 2.3 The flag-driven color engine ✅

**`APP-11** (`app.js:3917`+). Specced fully in `docs/specs/flag-color-system.md` (APPROVED). A record's pill *label* stays its lifecycle status; its *color* is computed: **gray if formally archived, else the highest active-flag severity (red > yellow > green), else green.** Conditions live in `FLAG_COND` (`app.js:3934`); labels/severities in `config.js` `FLAG_META` (`config.js:217`) + `FLAG_SEVERITY_RANK` (`config.js:278`). Only the 5 PRIMARY status sets are flag-colored (`PRIMARY_SET_ENTITY`, `app.js:4024`): `rentalStatus`→rentals, `unitFleetStatus`→units, `woPhase`→workOrders, `invoiceStatus`→invoices, `customerPayStatus`→customers. Secondary sets keep their registry color. Core functions: `getEntityFlags(entityType, rec)`, `entityArchived(...)`, `getEntityColor(...)`, consumed by `statusPill()` (`app.js:4026`).

### 2.4 The admin Rulebook overlay + Windows catalog ✅

**`APP-12 · Design-System Catalog** (`app.js:4384`+). The tabbed in-app Rulebook that documents the whole system, rendering from `RULE_META`, `RB_FOUNDATION` (the un-stamped primitives — type/color/form/surfaces/motion/data-viz), and `RB_TABS` (`app.js:4493`). The **Windows catalog** described in `docs/superpowers/specs/2026-06-22-rulebook-full-catalog-design.md` is now **built and shipped**, not planned (the roadmap's "planned-unbuilt" note is stale — Open Question §11 Q2):

- `buildPopupEl(o, holder, { preview })` is extracted (the enabler refactor).
- `WINDOW_CATALOG` (`app.js:9796`) — one entry per popup `kind` (~30 entries) with a `sample()` arg resolver built from demo `DATA.*`.
- `previewOverlayFor(kind)` (`app.js:9831`) renders an **inert** preview into a throwaway holder (no live overlay, no side-effects, `pointer-events:none`).
- `STANDALONE_SURFACES` (`app.js:9844`) lists the non-popup forms/dropdowns (gate pill, R20 menu, R22 date field, notes line, global search).
- **Gate is DEVELOPER-tier, not admin** (corrected against the live role-tier redesign of 2026-06-26 — see the explicit comment at `app.js:13065–13073`). The three design-system author tools — R0 flash-lint (`js-lint`), Design Inspector (`js-inspect`), and the Rulebook overlay / Windows catalog (`js-rulebook` → `o.kind === 'rulebook'`) — are gated by **`devUnlocked()`** = `roleTier(currentRole) >= tierRank('developer')` (`app.js:13073`), the top tier (rank 5). They are NOT gated by `adminUnlocked()`. A business **Admin no longer sees the raw dev tools** — the redesign deliberately moved them UP so the design system's own surfaces are developer-only. `adminUnlocked()` (`app.js:13071`, rank ≥ 4) still gates the *Settings* panes (Statuses/KPIs/Fields recolor·rename·icon) and category/pricing edits, which is a separate, lower gate. This admin-vs-developer split is the corrected baseline; §3 specs it conservatively.

### 2.5 `DESIGN.md` — the portable token projection ✅

`/DESIGN.md` (root) — a Google-Labs-style YAML-frontmatter file that projects `style.css :root` + `RULE_META` into a portable, machine-readable design spec (colors, typography, the R-catalog). It is **not** the source of truth; `style.css` + `RULE_META` are. `DESIGN.md` is kept *true to source* by a CI guard (§2.6).

### 2.6 The three CI drift guards ✅

| Gate | File | What it enforces |
|---|---|---|
| Rule-usage / duplicate-rule | `ci/gen-rule-usage.mjs --check` | Regenerates `rule-usage.js` (per-rule field catalog scanned from `app.js`) and fails on drift; ALSO hard-fails on any duplicate key in `RULE_META` (the R22 collision must never recur). |
| Window catalog | `ci/check-window-catalog.mjs` | Scans `buildPopupEl` for every `o.kind === '…'` branch and fails if any kind is missing from / stale in `WINDOW_CATALOG`. |
| DESIGN.md drift | `ci/check-design-md.mjs` | Three jobs: (1) spec-lint `DESIGN.md`; (2) **token drift vs `style.css :root` → ERROR** (fails build); (3) R-catalog cross-check vs `RULE_META` + contrast/orphan findings → **advisory (warn only)**. Pure Node, zero-dep, no network (the upstream `@google/design.md` CLI can't run in CI). |

Plus the shared gates `node ci/smoke.mjs`, `node ci/logic-test.mjs`, and `node tools/gen-code-map.mjs --check`. (Port 8000 reserved → swap to 9147 per CLAUDE.md, then `git checkout -- ci/`.)

### 2.7 The `jactec-ui` skill ✅

The single design skill (`.claude/skills/jactec-ui/`) that builds/reshapes/restyles ANY UI and folds in: aesthetic direction / anti-slop, mobile reflow, `DESIGN.md` scaffolding/linting, and the `/role` audit (15 role lenses + authority/data-sensitivity/gate checklist). References: `frontend-design.md`, `rulebook.md`, `tokens.md`, `signature-recipes.md`, `anti-slop.md`, `mobile.md`, `role-roles.md`, `designmd-*.md`.

### 2.8 What's actually unbuilt / partial

| Item | State |
|---|---|
| Windows catalog popup inventory | **SHIPPED** (roadmap "planned-unbuilt" note is stale). |
| Doc/code rule-count agreement (R24 vs R25) | Drift — docs lag code. |
| Light/yard/ranch theme switcher UI | `[data-theme]` exists; user-facing theme toggle is minimal/absent. |
| Token contrast automation | `check-design-md` flags contrast as *advisory*, not enforced. |
| Foundation-row (`RB_FOUNDATION`) drift guard | Foundations are not stamped → not covered by `gen-rule-usage`; only `check-design-md`'s token cross-check partially covers them. |

---

## 3. Users, Roles & Data Gates

The design system is **chrome and tooling**: the *visible UI* it renders is seen by every role, but the design system's own author-facing surfaces are gated at the **top (developer) tier**, with the Settings recolor/rename panes one rung lower at **admin**.

### 3.1 The tier ladder (corrected against the 2026-06-26 role redesign)

Permissions no longer key off role NAMES (roles are now admin-renamable) — every role carries one **TIER** and all gates compare tier ranks. The ladder is a strict superset (`config.js:315–344`):

| Tier | rank | Powers (cumulative) | Built-in roles defaulting here |
|---|---|---|---|
| `staff` | 1 | Operational only (units/shop/rentals/inspections). | mechanic, mtech, driver |
| `money` | 2 | + see pricing/margin, take payments, invoices. | office, sales |
| `manager` | 3 | + approve requests, override blocks. | (manager) |
| `admin` | 4 | + Settings, category/pricing edits, migrations, curate shared sets. | (admin / legacy Owner) |
| `developer` | 5 | + dev/design tools: **R0 Lint · Design Inspector · R-Rulebook + Windows catalog**. | (developer) |

> CLAUDE.md still speaks of "15 roles"; the *gate model* is this 5-tier ladder. Built-in role count is **5** (`ROLES`, `config.js:302`). The spec keys every gate on **tier rank**, never role name.

### 3.2 Who touches each design-system surface

| Surface | Gate fn | Tier | Notes |
|---|---|---|---|
| All stamped UI (pills, sections, popups, the rendered app) | none | every tier (incl. logged-out boot) | It *is* the app. The design system renders it; visibility of the *data inside* is each entity area's gate, not this area's. |
| R0 flash-lint toggle (`js-lint`) | `devUnlocked()` | **developer (5)** | `app.js:7425`, `app.js:13073`. |
| Design Inspector (`js-inspect`) | `devUnlocked()` | **developer (5)** | `app.js:7426`. |
| Rulebook overlay + **Windows catalog** + inert previews (`js-rulebook` → `o.kind==='rulebook'`) | `devUnlocked()` | **developer (5)** | `app.js:7427`, `app.js:9046`, `app.js:9800`. **NOT admin.** Business admins do not see it. |
| Settings → Statuses/KPIs/Fields/Inspections (recolor·rename·icon) | `adminUnlocked()` | admin (4) | `persistAdminSettings` → `backendCall('setConfig', {password,…})`; **password-gated server-side**, not just client-hidden. |
| Category / pricing inline edits | `requireAdmin()` (backend-verified pw) | admin (4) | `app.js:12831`; the override is **re-verified on the backend**, defence-in-depth. |

The key correction: the design system's *own* tooling is **developer-only**; a business Admin sees Settings (recolor) but not the raw Lint/Inspector/Rulebook. Client-side hiding (`devUnlocked()`/`adminUnlocked()` returning a button or not) is a **convenience gate**, not a security boundary — the security boundary for any *write* is the server-side `setConfig` password and `requireAdmin` re-verify. The design system must never assume the client gate alone protects a money/config write.

### 3.3 Data-gate interactions the design system must respect (and NOT loosen)

- **Money / pricing-floor visibility.** Money values are gated by the `money` tier via `canMoney()` / `mayMoney` (`app.js:643`, `:3263`, `:6251`): only `money`+ tiers see card-add, pay/charge/refund, and pricing edits. The pricing FLOOR — `cat.bottomDollar` and derived margin/ROI (`app.js:1852`) — is the most sensitive value in the app. **The design system renders pills/values but must never inject a money or `bottomDollar`/margin value into a surface whose host gate is below `money`.** A status PILL is colour+label only and carries no dollar figure, so the flag-colour engine is money-safe by construction — but any *new* derived chip that would print a dollar amount inherits the host card's `canMoney()` gate; it does not get its own looser one.
- **The Windows-catalog preview surface is the one real exposure.** `previewOverlayFor(kind)` (`app.js:9831`) re-runs the REAL `buildPopupEl` with `{preview:true}` into a throwaway holder. Two independent guarantees keep it safe: (1) **action-inert** — `pointer-events:none` on the well + the `{preview:true}` branch skips focus/timers/Stripe-mount/camera side-effects, so a `payment` or `wo-complete` preview's charge/commit button can NEVER fire; (2) **developer-gated** — the catalog only renders for `devUnlocked()`. BUT a developer-tier preview of, say, the `payment` or invoice popup will still **render real-looking totals**, and a unit/category preview can render `bottomDollar`/margin into the DOM. Today that is acceptable because (a) it never leaves the developer-only context and (b) developer ≥ money, so the viewer is already money-entitled. **Open Question §11 Q3** asks whether previews should additionally *scrub* money/margin fields, which becomes mandatory the moment a preview can be screenshotted/shared/exported below developer tier. Conservative stance: do NOT loosen the gate; if a "share preview" feature is ever proposed, scrubbing is a prerequisite, surfaced as a gate decision rather than silently allowed.
- **Customer isolation / PII.** Previews build against demo `DATA.*` seed via each entry's `sample()` resolver, which can contain real-looking customer records (names/phones). Because the catalog is developer-only and inert, isolation holds today. Any future "share a preview" / screenshot-export / external-Figma-sync path (§8 Phase 3, Q8) MUST re-run an isolation + PII check before it ships — flagged as a hard constraint, not loosened.
- **No secrets in chrome.** Tokens, themes, `DESIGN.md`, and `RULE_META` never carry secrets. `STRIPE_PUBLISHABLE_KEY` / `GOOGLE_MAPS_KEY` (`config.js`) are public-by-design (publishable / referrer-locked) and may appear in client bundles; the Admin password, backend **script id**, and any Apps Script **Script Property** must NEVER be surfaced by any design-system surface, copy-ref, or `DESIGN.md` export. The repo is public via Pages — treat every design-system artifact as world-readable.

---

## 4. Data Model

The design system is mostly *code constants*, not persisted entities. The persisted slice is the admin theme/status overrides.

### 4.1 Code-resident registries (existing)

| Registry | File / anchor | Shape |
|---|---|---|
| `COLOR_TOKENS` | `config.js:22` | `string[]` of color names. |
| `RAW_STATUS` / `STATUS` | `config.js:50`+ | `STATUS[set][value] = { label, color }`. |
| `FLAG_META` / `FLAG_SEVERITY_RANK` | `config.js:217` / `:278` | `{ entity: [{id,label,severity}] }`; `{red:3,yellow:2,green:1}`. |
| `RULE_META` | `app.js:4351` | `Rxx: [name, builder, one-liner]`. |
| `RB_FOUNDATION` | `app.js:4392` | `key: [tag, name, spec, when/why, exampleHTML]`. |
| `RB_TABS` | `app.js:4493` | Tab IA grouping rules + foundations + Windows. |
| `WINDOW_CATALOG` | `app.js:9796` | `{ kind, label, tag, sample() }`. |
| `STANDALONE_SURFACES` | `app.js:9844` | `{ label, tag, loc, preview() }`. |
| `SET_CARD` / `PRIMARY_SET_ENTITY` | `app.js:3915` / `:4024` | status-set → owning card / entity. |

### 4.2 Persisted (Sheets-backed, schema-less, additive)

Admin design overrides ride the existing `config` blob. The persistence path is **two-layer**: `persistAdminSettings(s)` (`app.js:2608`) mirrors to `localStorage('jactec.settings')` and calls `applySettings(s)` to apply live *immediately*, then best-effort pushes to the backend via `backendCall('setConfig', { password, config:{ roles, admin, settings } })`. At boot, `loadAdminSettings()` (`app.js:2576`) reads the **localStorage mirror** (not a blocking backend round-trip), and the authoritative blob arrives with the normal `getConfig` boot load. The `password` field on `setConfig` is the **server-side admin gate** — a write without it is rejected by Apps Script:

```
config.settings = {
  statuses: { [set]: { [value]: { color?, icon?, label? } } },   // Settings → Statuses & Icons
  kpis:     { [roleId]: [ring, ring, ring] },                     // Settings → KPIs & Rings
  customFields, inspections, …                                    // other admin panes
}
```

This is **additive and schema-less** — new override keys append without migration. No new top-level Sheet tab is required for any v1 proposal in §8.

### 4.3 Proposed additions (only if §8 phases adopt them)

| Field/key | Where | Migration |
|---|---|---|
| `config.settings.theme` (`'dark'\|'light'\|'yard'`) | settings blob | Additive; default `'dark'`. |
| `config.settings.flagOverrides` (per-flag on/off + severity) | settings blob | Additive; the PARKED flag-settings UI from `flag-color-system.md §8`. Default = hardcoded `FLAG_META`. |

---

## 5. Backend / Integration Contract

The design system is overwhelmingly **client-side**. Its only backend touch is the admin config persistence.

### 5.1 Existing GAS actions (no change)

| Action | Payload | Returns | Use |
|---|---|---|---|
| `setConfig` | `{ password, config: { roles, admin, settings } }` | `{ ok: bool }` | Persist status/KPI/theme overrides. **Admin password is the real gate** — Apps Script rejects the write if `password` is absent/wrong, regardless of any client-side `adminUnlocked()`. Never log or echo the password value. |
| `getConfig` (boot) | `{}` (read path, no secret) | `{ config }` | Load overrides at startup; `applySettings` applies them over the hardcoded `style.css`/`RULE_META`/`FLAG_META` defaults. |

**Gate posture (conservative):** the design system performs NO new server-side gate. It piggybacks on the existing admin-password gate. If a future phase (§8) adds a write that a *non-admin* could trigger (e.g. a user-facing theme toggle, Q7), that write must NOT reuse the admin-password path with a relaxed gate — it needs its own decision (per-user localStorage-only? a new lower-tier action? — surfaced as Q7), never a silent loosening of `setConfig`.

### 5.2 Proposed additive actions

**None required for the core design system.** If the PARKED flag-settings UI (§4.3) or a theme override ship, they ride the **existing** `setConfig`/`getConfig` blob — no new action. This keeps the backend contract untouched, consistent with "ADDITIVE actions on the single `backendCall` entry point" and avoids new server-side gates.

### 5.3 External integrations

None owned by this area. (Fonts — Saira Condensed + Geist — load from the font CDN via `index.html`; icons are vendored verbatim into `icons.js` by `tools/gen-icons.mjs`, never live-fetched.)

### 5.4 Failure handling

- `setConfig` failure → the existing pattern: persist locally + toast "saved on this device — sync retry needed" (see `lockKpiFromWrangler`, `app.js:3888`). The design override applies live regardless; sync is best-effort.
- Boot `getConfig` failure → fall back to hardcoded defaults (tokens in `style.css`, `RULE_META`, `FLAG_META`). The app must always render with zero backend.

---

## 6. UX / UI — yard data-plate language

All design-system *author* surfaces already exist and are built through their own builders. New/changed surfaces in §8 must obey the language and carry their stamps.

### 6.1 The signature treatments (canon)

- **Hazard stripe** — `repeating-linear-gradient(135deg, var(--yellow,#f5c542) 0 13px, #14181d 13px 26px)`; red variant for danger/abort. Lives on the card top-edge and the R25 sync banner cap.
- **Corner rivets** — `.pl-rivet tl/tr/bl/br` on every popup plate (`popupShell`, `app.js:4335`).
- **Stamped Saira head** — popup header = accent ignition icon · 15px uppercase title · micro tag (`.pl-tag`).
- **Ignition buttons** — orange gradient, `--on-orange #1a1205` ink, never white.
- **Ranch seasoning** — saddle-stitch dashed tan dividers + occasional brand/star, restrained; mostly voice ("Wrangle", "Round up", "Corral", "Brand").

### 6.2 The Rulebook overlay (shipped, canon)

Tabs from `RB_TABS`: Foundations · the R-rule groups · **Windows**. Each rule row shows name · builder · one-liner · a live inline example built from the real builder. The Windows tab: collapsed `label · tag · 📋 copy-ref`; expand → derived field list (read off the built DOM) + inert live preview in a bordered well stamped "PREVIEW — not live" (`pointer-events:none`) + code location + Claude-ready copy-ref. Empty/no-demo-record state: row shows location + copy-ref + muted "No demo record to preview."

### 6.3 States

- **Empty:** a status set with no overrides shows defaults; the Windows catalog shows the muted no-preview note.
- **Loading:** previews render lazily on first row-expand (no spinner needed — synchronous DOM build).
- **Error:** a builder that throws inside `previewOverlayFor` is caught → returns `null` → row degrades to location + copy-ref. A live render error anywhere flips R0 lint visible (the alarm).

### 6.4 Mobile reflow

The Rulebook overlay and Settings panes are popups → they ride the shared bottom-sheet reflow (M0–M3, `mobile-remote` area). No bespoke mobile work for the design system beyond honoring the existing overlay reflow + touch-target floors + `prefers-reduced-motion`.

### 6.5 R-rulebook + WINDOW_CATALOG obligations for §8

Any new element in §8 MUST: (a) be produced by a stamped builder (`data-r`), regenerating `rule-usage.js`; (b) if it introduces a new popup `kind`, get a `WINDOW_CATALOG` entry (else `check-window-catalog` fails); (c) if it adds a new R-rule, get a `RULE_META` row + `DESIGN.md` R-catalog entry (else `check-design-md` flags). A new chapter banner → regenerate the Code Atlas (`tools/gen-code-map.mjs`).

---

## 7. Business Rules / Derivations

The design system carries no money math of its own, but it is the *renderer* of money/status, so its derivation rules are about correctness of display, not dollars.

### 7.1 Color derivation (the one real formula)

```
getEntityColor(entityType, rec):
  if entityArchived(entityType, rec):  return 'gray'
  flags = getEntityFlags(entityType, rec)        // active conditions, severity-desc
  return flags.length ? flags[0].severity : 'green'
```

- `entityArchived`: rentals → `rec.completed === true`; invoices → `rec.refunded === true || invoiceTotals(rec).status === 'Refunded'`; others → false.
- Highest-severity-wins via `FLAG_SEVERITY_RANK`.
- Only `PRIMARY_SET_ENTITY` sets are flag-colored and only when a `recId` is in scope; otherwise the registry color (`STATUS[set][value].color`) is used.

### 7.2 Token resolution

Render → `getStatus(set, value)` → `{ label, color }` → CSS class `c-<color>` → CSS var `--<color>` / `--<color>-bg`. **No hex anywhere in render code.** This indirection is what makes a theme a single stylesheet edit.

### 7.3 The "flagging-red" treatment (`ec-red`)

Every flagging-red signal (names, pills, flags, headers, borders, dots/bars) uses the official `.ec-red` treatment (`RB_FOUNDATION 'color-ec-red'`): fill `color-mix(--red 65%, white)` + inner glow 3px + outer halo 7px/60%. **Never pure `--red` alone on flagging text.** Three tunable knobs live in `style.css .ec-red`.

### 7.4 Edge cases

- A status value with no `STATUS[set][value]` entry → `getStatus` must return a safe default (label = value, color = gray) rather than throw.
- A flag condition that throws → caught in `getEntityFlags` (`try/catch`, treated as inactive). A bad flag must never break a render.
- Light theme: status hues are re-saturated so pill text reads on `-bg` fills — any new status color must define BOTH dark and light values.

---

## 8. Phasing & Milestones

The area is shipped; phasing here is **hardening + the few open items**, not a greenfield build.

### Phase 1 — Truth-up (MVP, low-risk)

- Reconcile the **R24 vs R25** doc/code drift: update CLAUDE.md, the roadmap, `rulebook.md`, and `DESIGN.md` to say R0–R25 (or wherever the real ceiling lands). (Open Question §11 Q1.)
- Reconcile the **gate-model drift**: update CLAUDE.md / roadmap to the 5-tier ladder and the fact that Lint/Inspector/Rulebook are **developer-tier** (`devUnlocked`), Settings recolor is **admin** (`adminUnlocked`), money is **`canMoney`** — not "admin-gated" / "15 roles." (Q11.)
- Mark the Windows catalog **shipped** in the roadmap (remove "planned-unbuilt"). (Q2.)
- Add a one-line "design system = R-rulebook + tokens + CI gates" pointer wherever the area is referenced.

**In scope:** doc edits, no code behavior change.
**Out of scope:** any new builder or token.

### Phase 2 — Enforcement hardening

- Promote token **contrast** from advisory to a real (or opt-in-strict) gate in `check-design-md`. (Q4.)
- Add a `RB_FOUNDATION` drift guard so foundation rows can't silently diverge from `style.css` (today only partially covered). (Q5.)
- Optional: a `--check` that asserts every `c-<color>` class used in `app.js` has a matching token in both themes.

### Phase 3 — Author ergonomics (Wants)

- The PARKED **flag-settings UI** (`flag-color-system.md §8`): per-entity flag toggle + severity override, persisted in `config.settings.flagOverrides` via existing `setConfig`. (Q6.)
- A user-facing **theme switcher** (dark/light/yard) persisted in `config.settings.theme`. (Q7.)
- Optional: "copy DESIGN.md token" / export the portable design file for external tools (Figma sync). (Q8.)

**Explicitly out of scope for all phases:** a CSS framework migration, a component library rewrite, runtime theming of arbitrary tokens by non-admins, or any change that weakens the R0/CI enforcement.

---

## 9. Acceptance Criteria

Concrete, testable. CI-gate impact noted.

1. **No un-stamped lint-family element exists.** Toggling `body.rw-lint` (R0) on any screen shows **zero** red-pulsing elements. *(Manual; the standing build target.)*
2. `node ci/gen-rule-usage.mjs --check` passes — `rule-usage.js` matches source; **no duplicate `RULE_META` keys**.
3. `node ci/check-window-catalog.mjs` passes — every `buildPopupEl` `o.kind` has a `WINDOW_CATALOG` entry and vice-versa. *(Verify it trips when a kind is removed.)*
4. `node ci/check-design-md.mjs` passes — every `DESIGN.md` token equals its `style.css :root` value (**ERROR-level**, build-failing). *Note:* the R-catalog vs `RULE_META` cross-check and contrast/orphan findings are **advisory (warn)** today, not build-failing — promoting them is Q4/Q5/Q9.
5. `node ci/smoke.mjs` + `node ci/logic-test.mjs` pass — overlays open/behave identically (guards the `buildPopupEl` parity).
6. `node tools/gen-code-map.mjs --check` passes — Code Atlas chapters (`APP-10/11/12`) not drifted.
7. **Theme parity:** every status color resolves in both `:root` and `[data-theme="light"]`; no `c-<color>` used in `app.js` lacks a token.
8. **Preview safety:** opening any Windows-catalog preview fires NO live side-effect — no Stripe mount, no camera, no money/commit action (`pointer-events:none` + `{preview:true}` guards). *Verify by opening the `payment` and `wo-complete` previews and confirming no network/charge call and no overlay state change.*
9. **Gate correctness:** the Lint / Inspector / Rulebook buttons appear ONLY for `devUnlocked()` (developer tier 5), NOT for an admin-tier (4) login; the Settings recolor panes appear for `adminUnlocked()` (4). A `staff`/`money` login sees none of these. *Manual, per role; this is the §3 correction made testable.*
10. **No money/PII below tier:** no design-system surface renders a `bottomDollar`/margin or invoice-total value into a host gated below `money` (2). The flag-colour pill carries no dollar value (assert pill DOM has no `$`). *Manual + a grep that no `c-<color>` pill template interpolates a `money(...)` value.*
11. **Offline render:** with the backend unreachable (demo seed, no `getConfig`), every screen renders from code-resident defaults (`style.css`, `RULE_META`, `FLAG_META`, `FLAG_COND`) — no blank pills, no thrown render. *Covered by `ci/smoke.mjs` running against the static seed.*
12. **Doc/code agreement (Phase 1):** the rule-count claimed in CLAUDE.md/roadmap/`DESIGN.md` equals the live `RULE_META` ceiling (today **R25**; CLAUDE.md/roadmap still say R24 — Q1).
13. **Reduced motion:** every keyframe animation (`attnGlow`, `flagPulse`, `rwLint`, `plateIn`) is suppressed under `prefers-reduced-motion` (quality floor per CLAUDE.md).

**CI-gate impact summary:** the standing gates that guard this area on every push are `node ci/gen-rule-usage.mjs --check` (rule-usage drift + duplicate-`RULE_META`-key), `node ci/check-window-catalog.mjs` (every `buildPopupEl` `o.kind` ↔ `WINDOW_CATALOG`), `node ci/check-design-md.mjs` (`DESIGN.md` token/R-catalog drift), `node ci/smoke.mjs` + `node ci/logic-test.mjs` (overlay parity incl. preview build), and `node tools/gen-code-map.mjs --check` (Code-Atlas `APP-10/11/12` chapter drift). Port 8000 is reserved → `sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, then `git checkout -- ci/`.

---

## 10. Risks & Edge Cases

| Risk | Detail | Mitigation |
|---|---|---|
| **Drift between docs and code** | Already live (R24 vs R25; "planned" Windows catalog). The system's whole premise is "no silent drift," yet the *docs about it* drifted. | Phase 1 truth-up; treat CLAUDE.md/roadmap as code that the CI map should ideally cross-check. |
| **`buildPopupEl` blast radius** | `renderOverlay` is central; the preview refactor reuses the real builder. A regression breaks every popup. | Covered by smoke + logic-test; previews are inert (`{preview:true}` skips focus/timers/side-effects). |
| **Preview leaks money/PII** | Previews build against demo `DATA.*` which can hold real-looking records; a `payment`/invoice preview renders real-looking totals, a unit/category preview can render `bottomDollar`/margin. Developer-only + inert today, but exportable later (Q8). | `pointer-events:none` + `{preview:true}` (no side-effect) + **developer-tier gate** (≥ money, so viewer is already money-entitled). Q3: scrub money/margin if a preview ever leaves the developer context. |
| **Gate confusion (admin vs developer vs money)** | Three distinct gates (`adminUnlocked` 4 / `devUnlocked` 5 / `canMoney` 2) are easy to swap; using `adminUnlocked()` where `devUnlocked()` is meant would expose dev tools to business admins, or vice-versa. Docs (incl. an earlier draft of this spec and CLAUDE.md) already conflated them. | Spec'd explicitly in §3.2; the canonical comment at `app.js:13065–13073` is the source of truth. Any UI touching these gates cites the tier by rank, not by name. |
| **Client gate is not a boundary** | `devUnlocked()`/`adminUnlocked()` only hide a button. A crafted client could call a write handler directly. | The real boundary for any *write* is the server-side `setConfig` password + `requireAdmin` re-verify — never rely on the hidden button alone. No design-system write bypasses that. |
| **Theme half-defined color** | A new status color defined only for dark → unreadable pill in light (contrast/data-integrity). | Phase-2 token parity `--check` (AC #7); `check-design-md` token cross-check today. |
| **Flag condition throws** | A bad condition could blank a render (data-integrity / availability). | `getEntityFlags` try/catch per condition (already in place); a render error flips R0 lint visible as the alarm. |
| **Foundation rows un-guarded** | `RB_FOUNDATION` examples can diverge from real CSS without a gate (silent drift). | Phase-2 foundation drift guard (Q5). |
| **Performance** | Building ~30 inert previews up front would be heavy; the Rulebook overlay is itself a large DOM. | Already lazy: previews build on **first row-expand only** (`app.js:12508`); the overlay rides the `frontend-performance` render-budget + windowing. |
| **Multi-user race on config blob** | Admin theme/status/KPI overrides sync via `setConfig`; two admins editing Settings could race; localStorage mirror could disagree with backend after a failed push. | Last-write-wins on the `settings` blob (existing diff-sync semantics); overrides are low-churn; a failed push toasts "saved on this device — sync retry needed" and the live render is unaffected. Risk: a stale device keeps an override the others dropped — acceptable for low-churn chrome, but a per-key merge (not whole-blob LWW) is a future hardening if churn rises. |
| **Offline / zero-backend boot** | The app must render with NO backend (demo/offline). If the design system depended on a backend fetch for tokens/rules it would blank. | All design-system primitives are code-resident defaults (`style.css :root`, `RULE_META`, `FLAG_META`, `FLAG_COND`); `getConfig` failure falls back to them. AC #11: app renders identically with the backend unreachable. |
| **R0 false-negative (un-stamped element ships)** | A hand-rolled pill that bypasses a builder is the core failure mode; if it also dodges the lint family it could ship un-flagged. | R0 lint pulses any un-stamped lint-family element red; CI `gen-rule-usage --check` + the duplicate-key guard backstop it. Standing build target = ZERO red under `body.rw-lint`. |

---

## 11. Open Questions

> **Resolved 2026-06-29:** Q6 → **D1** (ship flag-settings UI, ALL flags toggleable incl. safety flags; add an audit line on disable). Q7/Q12 → **D2** (dark-only brand stance, no user theme switcher, no new theme-write path). Q4 → **D3** (contrast → hard build-failing gate). Q1/Q2/Q5/Q9/Q11 → **D4** (adopt doc truth-ups: R0–R25, 5-tier ladder, Windows-catalog shipped, add `RB_FOUNDATION` drift guard + prose rule-count cross-check). Q3 → keep preview gate as-is, no scrub/loosening. Q8/Q10 → deferred.

Seed questions: **none provided** for this area. The following 12 are all generated from reading the live code — each is a real fork for Jac, phrased as a question with its trade-off and a conservative default where one exists.

1. **Rule ceiling drift — R24 or R25?** Live `RULE_META` includes **R25** (sync banner) but CLAUDE.md, the roadmap, `rulebook.md`, and likely `DESIGN.md` still say "R0–R24." *Decision:* truth-up the docs to R25 (and add a guard so the count can't drift again), or is R25 considered "not a stamped element" and excluded from the count? **Trade-off:** consistency vs. the semantic argument that the sync banner isn't a per-element rule.
2. **Windows catalog status.** The roadmap calls it "planned-unbuilt" but it is **shipped** (`WINDOW_CATALOG`, `buildPopupEl`, `check-window-catalog.mjs`). Confirm we flip it to shipped and retire the design doc's "planned" framing — any remaining gaps (e.g. standalone-surface coverage) worth tracking separately?
3. **Should inert previews scrub money / margin / PII, or is `pointer-events:none` + admin-gate enough?** A `payment` or invoice preview renders real-looking totals; a unit preview could surface `bottomDollar`/margin. **Trade-off:** scrubbing adds a "preview-safe" render path (complexity, possible divergence from the real popup) vs. relying on the admin gate + no-action guarantee. **Conservative default:** keep the gate, do NOT loosen; decide scrubbing only if previews ever leave the admin-only context.
4. **Promote contrast from advisory to enforced in `check-design-md`?** Today contrast findings are warnings. **Trade-off:** enforcing catches unreadable pairings at CI but could block legitimate brand choices (orange ink ratios). Option: a strict opt-in flag.
5. **Add a `RB_FOUNDATION` drift guard?** Foundations aren't `data-r`-stamped so `gen-rule-usage` doesn't cover them; their example HTML can diverge from real CSS. **Trade-off:** a new guard adds maintenance but closes the last drift hole.
6. **Ship the PARKED flag-settings UI (per-flag toggle + severity override)?** Stored in `config.settings.flagOverrides` via existing `setConfig`. **Trade-off:** admin power vs. the risk that an admin turns OFF a safety flag (e.g. `unpaid-balance`, `no-card`) and hides a real money/credit risk. **Gate concern:** should certain flags be **non-disableable** (money/credit/blacklist)? Surfaced rather than decided.
7. **User-facing theme switcher (dark/light/yard)?** `[data-theme]` exists; expose a toggle persisted in `config.settings.theme`, or keep dark-only as the brand stance? **Trade-off:** light theme already maintained in `style.css` (cost paid) vs. dilution of the "steel yard at night" identity.
8. **Export `DESIGN.md` / Figma sync?** Worth a one-click portable-token export for external design tools, or out of scope (YAGNI)?
9. **Should CLAUDE.md/roadmap rule references be CI-cross-checked** the way `DESIGN.md` is, so prose docs can't drift from `RULE_META` either? **Trade-off:** more guards vs. brittle prose matching.
10. **Ranch-twist budget.** Is the current saddle-stitch/tan usage at the right level, or should `DESIGN.md` encode a hard cap (e.g. "tan touches ≤ N per screen") to prevent western creep? Voice-only vs. a measurable limit.
11. **Gate-doc reconciliation — `developer` vs `admin` vs "15 roles."** The live code gates the design system's OWN tools (Lint/Inspector/Rulebook) at **`devUnlocked()` (developer, tier 5)**, the Settings recolor panes at **`adminUnlocked()` (admin, 4)**, and money at **`canMoney()` (money, 2)** — yet CLAUDE.md and earlier docs say "admin-gated" and "15 roles." *Decision:* truth-up CLAUDE.md / roadmap / `rulebook.md` to the 5-tier ladder and the dev-tier dev-tools gate, and add a guard (Q9) so the prose can't re-drift? **Trade-off:** consistency + fewer mis-gates vs. the churn of correcting prose across several docs. **Conservative stance:** the *code* (`app.js:13065–13073`) is canon; this spec already follows it — the open part is only how aggressively to police the prose.
12. **Should a future user-facing theme toggle (Q7) reuse the admin-password `setConfig` path, or get its own non-privileged store?** A per-user dark/light preference is NOT an admin act — routing it through `setConfig` would either require an admin password (wrong UX) or loosen that gate (security smell). *Options:* (a) per-device localStorage only, no backend (simplest, no gate touched); (b) a new additive low-tier action scoped to `settings.theme` only. **Trade-off:** cross-device persistence vs. not punching a hole in the admin write gate. **Conservative default:** localStorage-only until a real cross-device need is shown — surfaced rather than decided.

---

## 12. Dependencies & Sequencing

This area sits **beneath** the entity areas — they depend on it; it depends on almost nothing. Per the roadmap, its declared dependencies are `search-views`, `frontend-performance`, `wrangler-ai`. *(Roadmap anchor note: the roadmap's `design-system` row says "R0–R24" and "Planned-unbuilt: Windows Catalog"; both are stale against live code — R25 ships and the Windows catalog ships. Phase 1 truth-up corrects the roadmap row; the anchors `APP-10/11/12` + `style.css:8` + `DESIGN.md` remain accurate.)*

| Dependency | Direction | Why |
|---|---|---|
| `wrangler-ai` | Design ← uses | Mr. Wrangler authors KPI rings (`openWranglerForKpi`) and powers the R20 "Ask Mr. Wrangler" + the catalog copy-ref Claude locators. |
| `frontend-performance` | Design ← uses | Lazy preview render + render-budget; the Rulebook/Windows catalog must respect windowing/budget. |
| `search-views` | Design ← uses | The standalone-surface catalog lists the search/filter/Views dropdowns; their R-stamps live here. |
| `mobile-remote` | Design → provides; ← reflows | The overlay reflow (M0–M3) carries the Rulebook/Settings popups; the design system supplies the tokens/touch-target floors mobile consumes. |
| ALL entity areas (`rentals-dispatch`, `units-fleet`, `invoicing-payments`, `customers-crm`, `maintenance-shop`, `financials-kpi`, `memberships`, `accounting`) | → consume | Every card/pill/section/popup is built from this area's builders + flag engine. Changes here ripple everywhere — which is the point. |
| `backend-data` | ← persists | Admin theme/status/KPI overrides ride `setConfig`/`getConfig` on the single `backendCall`. |

**Sequencing for the phases:** Phase 1 (truth-up) lands first and standalone — it's doc-only. Phase 2 (enforcement hardening) can follow independently. Phase 3 (author ergonomics) should only follow a `/role` audit of the flag-settings gate question (Q6) because of the money/credit-flag safety concern. Nothing here blocks an entity-area spec; entity specs should cite this area's builders/flag engine rather than re-spec them.

---

*End of DRAFT — every numbered decision above is open to Jac's critique. The §11 questions are the live forks; the §2 baseline is documented as canon and should be corrected if any anchor is found inaccurate against the running code.*
