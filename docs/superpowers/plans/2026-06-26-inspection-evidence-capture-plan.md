# Inspection evidence capture + fail-condition model — implementation plan

- **Spec:** [2026-06-26-inspection-evidence-capture-design.md](../specs/2026-06-26-inspection-evidence-capture-design.md)
- **Branch:** `claude/inspections-settings-status-9w3ro3`
- **Date:** 2026-06-26

Each phase is its own bisectable commit. **Gates before any push** (per CLAUDE.md):
`node ci/smoke.mjs`, `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`,
`node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`. Port 8000 is reserved —
`sed -i 's/8000/9147/g' ci/smoke.mjs ci/logic-test.mjs`, run, then `git checkout -- ci/`.
**Cache-bust** the shared `?v=` token on the final UI commit. **All UI phases run through `/jactec-ui` + `/frontend`**
(yard data-plate language, `data-r` stamps, screenshot + self-critique before showing Jac).

**Two builds, sequenced:** Build 1 (Track 1 — fail-condition model) is the foundation; Build 2 (Track 2 — evidence)
keys off Build 1's generalized `inspItemFails`. Build 3 (QC default content) is a separate sit-down with Jac.

---

## Phase 0 — Baseline (confirm green before touching anything)
- Run all five gates on the current branch; confirm pass. Establishes the "behavior unchanged" baseline.
- **Verify:** all gates green. No commit.

---

## BUILD 1 — Fail-condition model (Track 1)

### Phase 1 — Data + predicate (logic only, no UI)
**Why first + alone:** this is the money-adjacent core (it decides "did the item fail" → auto-WO). Isolating it makes the
behavior-parity proof a pure logic-test diff. **Stays on main session — never delegate.**
- `inspItemUnanswered` (`app.js:9327`/`2998` region): make **every** type required — toggle `!val`; select blank;
  number/date/text empty; file unattached. Remove the `required`-based optional branch.
- Generalize **`inspItemFails(it, val)`** (`app.js:2998`) to switch on `it.type` and read `it.fail`:
  - toggle → `(it.fail?.failWhen==='pass') ? val==='Pass' : val==='Fail'` (no `fail` ⇒ `'fail'`, today's behavior).
  - select → option matching `val` has `fail===true` (unchanged; incl. an N/A option if flagged).
  - number → `op` Above/`v>a` · Below/`v<a` · Outside/`v<a||v>b` · Inside/`a<=v&&v<=b` · none→false (coerce `Number`).
  - date → `op` Before/`d<ref` · After/`d>ref` (ref `today`→`TODAY_ISO` else the ISO) · none→false.
  - text → `op` empty/`!val` · contains/`val.includes(value)` · none→false.
- Stop reading/writing `it.required` anywhere; leave the field on old data (ignored).
- **Tests (`ci/logic-test.mjs`):** one case per operator (number above/below/outside/inside; date before/after; text
  empty/contains; toggle normal **and** inverted); back-compat (a `{type:'toggle'}` with no `fail` still fails on `'Fail'`,
  passes on `'Pass'`); all-required gate (an unanswered item of each type blocks Complete).
- **Verify:** logic-test green incl. the new cases; `completeChecklist` still rolls up via the **unchanged**
  `setInspResult` path (no edit to the cascade).
- **Model:** main session. **Commit:** "Inspections: generalized fail-condition predicate + all-required gate".

### Phase 2 — Builder fail-condition editor (UI)
- `settingsInspectionsPane` (`app.js:3460`): **remove** the Optional/Required segcontrol (`js-insp-itemreq`,
  `app.js:3502`).
- Add a **type-conditional fail editor** to the add-item row, swapping controls on `inspDraft.type` (mirror the existing
  Dropdown options sub-editor pattern, `app.js:3489-3492`):
  - toggle → "Fails when **Fail / Pass**" segcontrol → `inspDraft.fail.failWhen`.
  - number → Above/Below/Outside/Inside segcontrol + 1–2 threshold inputs (`a`, `b`).
  - date → Before/After segcontrol + **today / pick-a-date** (reuse `dateField`).
  - dropdown → existing per-option Fails flags + a **"+ N/A option"** affordance (option with `na:true`, flaggable).
  - text → None / Fails-if-blank / Fails-if-contains (+ value input).
- New delegated handlers near `js-insp-type`: `js-insp-failwhen`, `js-insp-failop`, `js-insp-faila`, `js-insp-failb`,
  `js-insp-failval`, `js-insp-opt-na`. Write into `ensureInspDraft(o,key)` like the existing item handlers.
- `js-insp-add` (`app.js:3504`) writes `fail` (per type default) instead of `required`.
- Row sub-label summarizes the config (e.g. *"Number · fails below 30"*).
- **Verify:** add one item of each type with a fail condition; reopen Settings → it round-trips through
  `draftInspCfg`/save; smoke green. Screenshot the editor for each type.
- **Model:** Sonnet (well-scoped UI against settled spec); the segcontrol/data-plate pass through `/jactec-ui`.
- **Commit:** "Settings → Inspections: per-type fail-condition editor (replaces Optional/Required)".

### Phase 3 — Editable existing rows
- The existing item **row** (`app.js:3484-3487`, currently remove-only) gains an **edit** affordance that expands it
  inline to edit label, type, fail condition (and, after Build 2, evidence) — reusing the Phase-2 controls bound to that
  item's draft entry rather than `inspDraft`. Changing type re-defaults `fail`.
- New `js-insp-row-edit` (toggle a per-row `o.inspEditId`); the pane renders the editor inline for that row.
- **Verify:** edit a seeded Excavator item's fail condition, Save, reopen — persists; the takeover then evaluates the new
  condition; old saved answers unchanged.
- **Model:** Sonnet. **Commit:** "Settings → Inspections: edit existing items inline (label/type/fail)".

---

## BUILD 2 — Evidence capture + WO linkage (Track 2)

### Phase 4 — Per-item evidence capture + builder policy (UI + data)
- Builder: add the **Evidence** segcontrol (`None · Optional · Fail photo · Always`) to the add-item row + the Phase-3
  inline editor → `js-insp-ev` → `it.evidence`.
- Takeover row (`renderOverlay` `kind:'checklist'`, `app.js:9329`): add the stamped **camera affordance** (Lucide camera
  glyph via `icons.js`; **image-only** `accept="image/*"`); attached evidence renders as a `.insp-photo` thumbnail strip.
  New handler `js-ck-evid` → `downscaleImage` → push `{kind:'image',url}` into `n.itemEvidence[id]` → `offloadPhoto`.
- **Audit (auto, no form):** `logAction(n, 'Evidence attached')` on capture.
- **Offline tolerance** (/role): capture queues locally + retries on reconnect; a failed upload never blocks Complete and
  never loses the dataURL. Large-tap, no hover-only.
- **Verify:** attach a photo to an item; it persists on `n.itemEvidence`; thumbnail shows; History logs it. jactec-ui
  screenshot. `rule-usage.js` regenerated for the new `data-r` stamps.
- **Model:** main session for the capture/offload plumbing (data-integrity); Sonnet for the static markup.
- **Commit:** "Inspections: per-item photo evidence + builder Evidence policy".

### Phase 5 — Completion gate + WO enrichment (logic, money-adjacent — main session)
- Completion gate: add `evidenceMissing(item, answer, ev)` (`always`→`!has`; `failphoto`→`inspItemFails && !has`;
  else false) to `allDone` in the takeover render + `completeChecklist` (`app.js:12465`). Required-but-missing ⇒ Complete
  disabled with a stamped reason; **"Keep as pending"** is the only escape (no override — D7).
- `autoWOFromInspection` (`app.js:14504`): `wo.evidence` **references the inspection's live evidence** (failed items'
  `itemEvidence` + `n.evidence`) so late-added evidence (Phase 4 / §12.8) reflects on the WO; enrich `wo.description` with
  failed labels. `logAction(wo, 'Inherited N evidence items')`.
- WO detail (`app.js:6134` region): add a small evidence strip (`.insp-photo` thumbnails), shop/Fleet/Owner + Office
  (billing justification); **not** customer-reachable.
- **Tests:** `failphoto` blocks Complete when the (generalized) fail fires without a photo; WO inherits failed-item
  evidence; default (no policy) ⇒ no gate, unchanged.
- **Verify:** logic-test green; fail an item with `failphoto` → can't Complete until a photo is on; WO opens carrying it.
- **Model:** main session (cascade + gate). **Commit:** "Inspections: evidence completion gate + auto-WO inherits evidence".

### Phase 6 — Walkaround tile (off by default)
- Family setting: walkaround `Off / Optional / Required` in the builder header (default **Off**).
- Takeover header tile ("Walkaround video / photos", `accept="image/*,video/*"`) → `n.evidence`; **hidden** when Off.
  Required ⇒ part of `allDone`.
- **WINDOW_CATALOG:** if the capture/gallery is its own popup, add it + update `ci/check-window-catalog.mjs`.
- **Verify:** Off family shows no tile (byte-for-byte today); Required family blocks Complete until captured; gates incl.
  window-catalog + code-map green; cache-bust `?v=`.
- **Model:** Sonnet (UI) + main for the gate wiring. **Commit:** "Inspections: optional per-family walkaround capture".

---

## BUILD 3 — QC default content pass (separate, with Jac)
- In `INSP_DEFAULTS` (`app.js:2638`): set per-family fail conditions (leak/hydraulic/brake/structural → meaningful fails),
  `failphoto` on the high-risk lines, walkaround flags where the cards reference video; **de-dupe** the repeated lines
  (Power Trowel / Concrete Saw "Leveler Not Broken").
- Reset-only seeding path is `pageDefaultSlice('inspections')` (`app.js:2555`) — a fresh **Reset page** picks these up.
- **Model:** content decisions with Jac; the mechanical edit can drop to Sonnet once the table is agreed.
- **Commit:** "Inspections: QC-card fail conditions + evidence defaults + de-dupe".

---

## Pre-build verification gate (must clear before Phase 4)
- **🔴-class — Drive ACL on evidence:** confirm `offloadPhoto(...,'inspections')` mints a link that is **server-side
  ACL-gated to shop/owner sessions**, never customer-reachable/public (evidence may show a customer jobsite, T5). Inherit
  the existing failure-photo ACL; do not weaken it. If this can't be confirmed, evidence stays inline-dataURL only until it
  can.

## Risk / parity notes
- **Behavior parity:** every change defaults to today's behavior (toggle no-`fail` ⇒ fails on Fail; `evidence` no-policy ⇒
  no gate; walkaround Off). The 21 default families are untouched until Build 3.
- **Removing `required`** flips old `required:false` items to answer-required — intended per Jac ("all fields required").
- **No backend/GAS schema change** — all new fields are schema-less and ride the existing inspection sync.
