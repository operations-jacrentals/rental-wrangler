# Rental Wrangler â€” project notes for Claude

Heavy-equipment rental management SPA for **JacRentals** (Sulphur, LA).
Vanilla-JS single-file app (`app.js`), `style.css`, `index.html`, `config.js`,
`data.js`; Google Apps Script backend (schema-less Sheets, deployed by paste â€”
`backend/` is gitignored, never served by Pages).

## Interaction (Jac, 2026-06-15)

- **Always ask questions via popups** â€” use the AskUserQuestion tool for any
  question or decision, never inline in the chat text.

## Design language â€” RUN ALL NEW/CHANGED UI THROUGH THIS (Jac, 2026-06-13)

Jac loves the "yard data-plate" direction from the login + cancel-arc redesign
and wants **every future UI edit run through the `jactec-ui` skill** in this same
language (the former `frontend` aesthetic-direction skill is now folded into
`jactec-ui` — see `references/frontend-design.md`). Scope: apply to **new or
reshaped UI going forward**. Do **NOT**
retroactively restyle the whole existing site yet â€” only touch what an edit
already touches, unless Jac asks for a site-wide pass.

**The system â€” "the JacRentals yard, with a light wrangler/ranch twist":**
ground every surface in the heavy-equipment-rental world so screens read as one
shop. The industrial steel-yard core below is the **foundation and stays
dominant**; the ranch twist is a light seasoning on top (see "Ranch twist"),
never a full western theme.

- **Signature motif:** hi-vis **hazard stripe** â€” `repeating-linear-gradient(135deg,
  var(--yellow,#f5c542) 0 13px, #14181d 13px 26px)`. Red variant
  (`var(--red,#ff4242)`) for danger/abort states.
- **Type:** **Saira Condensed** for stamped labels, wordmarks, and primary
  buttons (uppercase, letter-spaced ~2px, weight 600â€“800). **Geist** for body.
  Both loaded in `index.html`.
- **Palette:** industrial steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`),
  **safety-orange** accent (`--accent #ff7a1a`) for primary/ignition actions,
  caution-yellow (`--yellow #f5c542`), danger-red (`--red #ff4242`).
- **Devices:** corner **rivets**, stamped condensed labels, ignition-style
  primary buttons (orange gradient, dark `#1a1205` ink), yard/operator copy
  ("Clock In", "Operator", "Release to cancel").
- **Ranch twist (SUBTLE â€” a seasoning, never the meal):** "Rental Wrangler"
  earns a light cowboy/ranch flavor on top of the steel yard. Lean on it mostly
  through **voice/copy** â€” wrangler/ranch vernacular used naturally, never campy
  ("Wrangle", "Round up", "Corral", "Brand" (great double meaning for a stamp/
  logo), "Saddle up", "Tack", "Rein in"); operator copy may lean "hand/wrangler".
  Restrained **visual** cues only: a worn-**leather tan** tertiary accent
  (`~#c2925a`, deep `#8a5a2b`) for tiny touches; **saddle-stitch** dashed lines
  (tan) as the occasional divider/border, pairing naturally with the rivets;
  optionally a small **brand/star** marker, used rarely. Rule of thumb: if a
  glance reads "western" before it reads "industrial rental yard," dial it back.
- **Process (from the `jactec-ui` skill / its `references/frontend-design.md`):** plan a token system first, avoid the 3 AI
  defaults (cream+serif+terracotta / near-black+acid-green / broadsheet
  hairlines), spend boldness in ONE place, build, **screenshot + self-critique
  before showing Jac**. Quality floor: responsive, visible focus, reduced-motion
  respected.

Reference implementations: `.login-*` and `.cancel-arc` blocks in `style.css`.

## Deploy & gates

- **Deploy to live** (app.jacrentals.com via Pages): `main` is **branch-protected**
  (required `smoke` CI check). Deploy path: feature branch -> PR -> squash-merge.
  NEVER `git push origin HEAD:main` directly -- it will be rejected.
- **Gates (must pass before push):** `node ci/smoke.mjs`,
  `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`,
  `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`
  (the Code-Atlas drift guard — regenerate with `node tools/gen-code-map.mjs`
  when a chapter banner is added/moved/retitled).
  Port 8000 is reserved on this machine -- swap to 9147 before running gates:
  `sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, then `git checkout -- ci/`
- **Cache-bust on every deploy:** bump the `?v=` token on `style.css`, `rule-usage.js`,
  and `app.js` in `index.html` (one shared token) so a release loads immediately --
  Pages serves `max-age=600` with no per-file hashing, so without this a phone/desktop
  keeps the stale cached files. Don't add `?v=` to the ES-module imports inside `app.js`
  (relative imports drop the query -> a sub-module loaded both versioned and unversioned
  would instantiate twice); the module graph revalidates within the 10-min window.
- **Staging needs an EXTRA deploy step (this has bitten us):** the preview site is a
  SEPARATE mirror repo that re-clones `staging` only on a 10-min cron. After pushing
  `staging`, (1) make sure the `?v=` token is *newer than staging's current*
  (`git show origin/staging:index.html | grep '?v='` first), and (2) force the sync
  now instead of waiting: `gh workflow run sync-staging.yml --repo operations-jacrentals/rental-wrangler-staging`,
  then VERIFY the live site serves the new bytes
  (`curl -s https://operations-jacrentals.github.io/rental-wrangler-staging/app.js | grep <new-only marker>`).
  The mirror can serve an OLD file under a NEW token — a stale snapshot **no browser
  refresh fixes**, only a re-sync does. Then hard-refresh (Ctrl/Cmd+Shift+R).

- **R-rulebook — ANY new or changed UI MUST keep it current (Jac, 2026-06-22).** Every
  UI element is stamped with `data-r="Rxx"`; `rule-usage.js` is generated by
  `ci/gen-rule-usage.mjs` (a `--check` drift guard + duplicate-rule guard) — regenerate
  (drop `--check`) when rule usage changes. Every popup window is also catalogued in
  `WINDOW_CATALOG` (the admin Rulebook's "Windows" tab); `ci/check-window-catalog.mjs`
  fails CI if a popup is added or removed without updating it. These CI guards are the
  enforcement — they can't be skipped, so the Rulebook can never silently drift.

## Icons (Jac, 2026-06-19)

- **Never hand-draw / hand-author icons.** Every glyph comes from a library.
  Generic glyphs are vendored **verbatim from Lucide** (ISC, pinned) into
  `icons.js` (`I`, `CARD_ICON`, `RING_ICON`) by `tools/gen-icons.mjs`. To add or
  change one, map `name -> lucide-icon-name` in that script and run
  `node tools/gen-icons.mjs` (needs network, dev-time only) — never paste raw
  `<path>` data by hand. It's NOT a required CI gate (no external CDN in CI);
  use `node tools/gen-icons.mjs --check` locally to catch drift.
- **Bespoke marks are the only exception** and stay in `icons.js`: the steel
  logo (`bluesteel`), `horseshoe`, `hardhat`/`mtech`, the `mark`, the rounded
  `circle` placeholder, the Tabler **backhoe** excavator (`categories`), the
  `clipboard-question` (`inspectionsPending`, no Lucide equivalent), and the
  gate-timeline status glyphs (`GATE_ICON`, still in `app.js`). Don't replace
  these with library icons without asking.

## Don't

- Never put the model identifier, secrets, or `DEFAULT_CONFIG` passwords in the
  repo (it's public via Pages). Backend `Code.gs` stays gitignored.
- Changing a WO part/task line to Complete must NOT complete the work order â€”
  only the blue **Complete WO** button does.
- Never hand-roll an icon (see **Icons** above) — source it from the library.

## Auto-delegation — model triage (Jac, 2026-06-21)

You can pick a **subagent's** model; you can't change your own. So push cheap work down and keep the hard calls up. **Heuristic:** if you could hand it to an intern with a checklist, delegate it — and delegate by the *cost of being wrong*, not by how simple it looks.

- **Haiku subagent — pure mechanical / IO, no judgment.** git/gh plumbing (branch create/delete after merge, PR creation, `log`/`status`/`diff --stat` probes); `Grep`/`Glob` sweeps to locate before editing; bulk rename/move/reformat; extracting a known field (the script id from `backend-ids.local.md`, names from `roles.md`); running a script with known inputs and reporting its output (the `/audit` analyzer, seeds, builds — the script does the math, Haiku writes the terse report).
- **Sonnet subagent — well-scoped implementation against a settled spec.** A UI/CSS change from a written spec; an **additive** `Code.js` GAS handler whose contract is already defined; a new `SKILL.md` / role-lens card (the `jactec-ui` `/role`-audit cards) from a template; a PR body from a diff; converting a dump into schema-shaped seed JSON; one isolated bug with a clear repro.
- **Keep on the main session — never delegate.** Authoring/revising a SPEC; security / auth / data gates (role-password, customer isolation, margin-floor visibility, any server-side gate — wrong = live PII or pricing leak); the `jactec-ui` `/role`-audit lens selection and its data-sensitivity / customer-isolation calls (*writing* the report can drop to Sonnet, the *call* can't); cross-system architecture (GAS ↔ front-end contract, data-shape changes); irreversible ops (the `/clasp` prod-deploy STOP gate, force-push, secret handling); and any bug that already resisted ≥2 fixes.
- **Fan-out → use a Workflow.** When the same mechanical step repeats across many similar items (delete N branches, regen M cards, patch a token across the tree), drive it as a Workflow that fans out Haiku/Sonnet agents — don't loop on main.
- **Escalate UP when warranted.** Delegation isn't only downshifting — you can spawn an *Opus* subagent too. Worth it when the main session is on a cheaper model and hits a hard sub-problem, or when one Workflow stage needs deep reasoning while others stay cheap. If the main session is already Opus, the hard work just stays on main.
- **Offload long / independent work to the BACKGROUND** so the main chat stays free for new input: run heavy or independent delegated tasks as **background** agents/workflows (they notify on completion) instead of blocking the thread, or split genuinely parallel work across separate cloud sessions / area task-branches. Keep in the foreground only what needs Jac's next reply.
- **Guard rails:** anything touching role visibility, pricing floors, or auth looks simple and isn't — don't downgrade it; a subagent that reads secrets is Sonnet-minimum and must never echo secret values; "the spec is clear" doesn't authorize delegation if the spec has gaps (resolve on main first, then delegate the mechanical output); if the output ships with no human review step, keep it on main.
