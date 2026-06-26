# Inspection evidence capture + fail-condition model — design spec

- **Date:** 2026-06-26
- **Status:** Spec for review — touches the inspection → auto-WO (money-adjacent) cascade, so it wants Jac's OK before any build.
- **Two tracks (interlocked):** **(1) Fail-condition model** — every field is answer-required, the per-item
  Optional/Required toggle is replaced by a per-type *fail condition* the admin can edit anytime; **(2) Evidence capture**
  — per-item + walkaround photo/video that flows into the auto-Work-Order. Track 1 is the foundation (its generalized
  fail predicate is what Track 2's "require a photo on fail" keys off).
- **Branch:** `claude/inspections-settings-status-9w3ro3`
- **Area:** `area/units-fleet` (inspections)
- **Follow-on to:** Inspection checklist takeover (`2026-06-18`) + Typed inspection fields (`2026-06-22`).
- **Skill gate:** ALL new/reshaped UI runs through `/jactec-ui` + `/frontend` (the camera affordance, the evidence
  gallery, the takeover row) — yard data-plate language, `data-r` stamps, `rule-usage.js` regenerated, any new popup
  added to `WINDOW_CATALOG` + `ci/check-window-catalog.mjs`. This gate was the thing missed on the first pass.

## The gap (what Jac flagged, grounded)

Jac, 2026-06-26 (live): *"there's no add photo options like our workflow needs to generate Work Orders."*

Verified against the code:

1. **The 21 default checklists are pure Pass/Fail toggles** (`INSP_DEFAULTS`, `app.js:2638`). An inspector running a
   seeded QC checklist (e.g. Excavator's 17 items) has **zero** places to attach a photo/video — even though the QC
   cards themselves say things like *"Hoses Ran Correctly; **Scuffs Shown In Video**"*, i.e. the paper workflow already
   expects camera evidence per the unit.
2. **Only one after-the-fact photo reaches the Work Order.** On any Fail, `setInspResult` (`app.js:14462`) calls
   `autoWOFromInspection` (`app.js:14504`) and then opens the §12.8 failure report (`kind:'inspection'`, render
   `app.js:9364`), which captures a **single** photo/video + notes onto `n.photo`. That is the *only* evidence that ever
   reaches the WO, it is captured *after* the inspection is already failed, and it is not tied to *which* item failed.

So the inspector cannot document the unit as they inspect, and the mechanic opening the auto-WO sees a label list but no
proof of the specific failure.

## What exists today (reuse surface)

- **Item types** `toggle | file | select | number | date | text` (`INSP_TYPES`, `app.js:2996`). The `file` type renders an
  image-only capture tile (`js-ck-file`, render `app.js:9343-9346`); its *answer* is a photo. This is **not** the same as
  evidence — `file` makes the photo the question; we want evidence *attached to* a Pass/Fail (or any) answer.
- **Checklist takeover** `kind:'checklist'` (render `app.js:9323`): per-item rows, header `done/total` progress,
  "Complete inspection" (R17) / "Keep as pending" (R18). Completion gate `inspItemUnanswered` (`app.js:9327`).
- **Fail rollup** `completeChecklist` (`app.js:12465`) → `setInspResult(Fail|Pass)`; `inspItemFails` (`app.js:2998`).
- **Cascade** `setInspResult` → `autoWOFromInspection` (WO `woReport:'From failed inspection'`, links `n.woId`) → §12.8
  failure report popup. **We reuse this whole chain unchanged except for enrichment.**
- **Capture plumbing** `downscaleImage` (`app.js:13224`), the `js-insp-photo` handler (`app.js:13039`, image+video,
  downscale → `n.photo` → `offloadPhoto(...,'inspections')` to Drive). Image downscaled; video kept inline.
- **Inspection record** (`data.js:142`): `{ inspectionId, unitId, date, wash, checklist, billCustomer, customerId, woId,
  photo, description, items }` — schema-less Sheets, so new fields are additive with no backend change.

## Decisions (made; flagged for Jac's redline in §"Open decisions")

**D1 — Capture model = both depths (the "C" option).** Two orthogonal evidence surfaces:
  - **Per-item evidence** — any checklist row can carry attached photo/video, surfaced and (optionally) *required* when
    that item is marked **Fail**. This is the core of "evidence that generates the Work Order."
  - **Walkaround evidence** — one unit-level photo/video set captured on the takeover, matching the "Shown In Video" card
    language. **Off by default** (Jac 2026-06-26); an admin opts a family in (Off / Optional / Required).
  **Both surfaces ship together as one build** (Jac, 2026-06-26); the QC-default content pass is the only separate phase.

**D2 — Evidence is orthogonal to item type.** It is an *attachment on the answer*, not a new item type. A `toggle`
  "Brakes & hydraulics" item stays a toggle and *also* can hold a failure photo. (The existing `file` type is unchanged.)

**D3 — Per-item evidence policy, set in the Settings builder per item:**
  `None` (default — today's behavior) · `Optional` · `Required-on-Fail` · `Always`.
  `Required-on-Fail` is the workflow lever Jac wants: marking that item **Fail** blocks **Complete inspection** until a
  photo/video is attached — guaranteeing the auto-WO is born with proof.

**D7 — Required-gate escape = "Keep as pending," no override** (Jac, 2026-06-26). If a required photo can't be captured
  (dead camera, etc.), the inspector taps the existing R18 **"Keep as pending"** and finishes later — the inspection
  simply cannot **Complete** without the required evidence. We deliberately add **no** Admin override here: nothing
  reaches Ready/Failed (and no auto-WO fires) without the proof the policy demands.

**D4 — Media (Jac 2026-06-26):** per-item evidence is **image-only** (`accept="image/*"`, downscaled via `downscaleImage`)
  to keep records small. **Video** is reserved for the unit **walkaround** and the existing §12.8 failure report
  (`accept="image/*,video/*"`, kept inline like today).

**D5 — WO enrichment:** `autoWOFromInspection` inherits the **failed items' evidence + the walkaround** onto the WO so the
  mechanic sees exactly what failed, with proof. The §12.8 failure report still runs (it owns the bill-customer decision)
  but is now **pre-populated**, not the sole evidence path.

**D6 — Zero-change default:** with no evidence policy set and no walkaround requirement, the inspection flow is
  **byte-for-byte today's**. Old saved inspections are untouched (new fields additive).

## Track 1 — Fail-condition model (replaces the per-item "Required" toggle)

**Directive (Jac, 2026-06-26, live):** *"all fields are required regardless"* → drop the Optional/Required toggle.
*"replace that with a context option for what fails or not … Fail may = pass and Pass may = Fail … numbers: a range?
above? below? … dropdowns like Pass if blank … these followup context should be changeable even after the field has
been created."*

### A. Every item is answer-required
The Optional/Required segcontrol (`js-insp-itemreq`, builder `app.js:3502`) and the item `required` flag are **removed**.
`inspItemUnanswered` (`app.js:9327`/`2998` region) becomes "must be answered" for **every** type — toggle: pick a side;
select: choose an option; number/date/text: filled; file: attached. Old `required:false` items are simply read as
required now (no migration; the flag is ignored).

### B. Each item carries a typed fail condition (`it.fail`)
A generalized `inspItemFails(it, val)` (`app.js:2998`) switches on `it.type` and reads `it.fail`. The failing answer still
flows `completeChecklist → setInspResult('Fail') → autoWOFromInspection` **unchanged** — only the *predicate that decides
"did it fail"* gets richer.

| Type | Fail config (builder) | Predicate | Default |
|---|---|---|---|
| **Toggle** | "Fails when…" → **Fail** (normal) or **Pass** (inverse — "passing by inverse") | `failWhen==='pass' ? val==='Pass' : val==='Fail'` | `fail` (today's behavior) |
| **Dropdown** | per-option **Fails** flag (today) + an optional **blank/N-A** option that can itself be flagged pass or fail | option matching `val` has `fail===true` | per-option |
| **Number** | operator **Above / Below / Outside / Inside** + threshold(s) | above→`v>a`; below→`v<a`; outside→`v<a||v>b`; inside→`a≤v≤b`; none→never | none |
| **Date** | operator **Before / After** + ref **today** or a fixed date | before→`d<ref`; after→`d>ref`; none→never | none |
| **Text** | optional admin fail condition — **none** (default) / **fails if blank** / **fails if contains** `value` | per `op` | none |
| **Add File** | n/a — the answer is the photo; never fails | none | — |

```js
// it.fail descriptor on each item (schema-less, additive):
toggle  → { failWhen:'fail'|'pass' }
select  → options:[{ label, fail }]                       // unchanged from typed-fields spec
number  → { op:'none'|'above'|'below'|'outside'|'inside', a:Number, b:Number }
date    → { op:'none'|'before'|'after', ref:'today'|'<ISO>' }
text    → { op:'none'|'empty'|'contains', value:'<str>' }   // admin-optional; default none
```

**Back-compat is automatic:** a `toggle` with no `it.fail` reads as `failWhen:'fail'`, so every existing item — including
all 21 default families — behaves exactly as today. Existing saved answers (`n.items[id]`) are untouched.

### C. Editable after creation (Jac: "so the user doesn't have to work as hard")
Today an existing item row is **remove-only** (`app.js:3484-3487`). The builder gains **inline editing** of each existing
row's **label, type, and fail condition**, reusing the same draft plumbing (`ensureInspDraft` / `draftInspCfg` /
`o.draftSettings.inspections`) — no new persistence surface. Changing a fail condition does **not** rewrite saved history;
it only changes how *future* completions evaluate. Changing a row's *type* re-defaults its `fail` to that type's default.

### D. Composition with evidence
Track 2's `failphoto` evidence policy keys off this **generalized** `inspItemFails`, so "require a photo when this item
fails" now also fires for an out-of-range number or an expired date — not just a toggle Fail.

## Track 2 — Data model (additive, schema-less)

```js
// on the inspection record (data.js shape) — both new, both optional:
n.itemEvidence = { '<itemId>': [ { kind:'image'|'video', url:'data:...'|driveUrl } , … ] };  // per-item
n.evidence     = [ { kind:'image'|'video', url:'…' }, … ];                                    // unit walkaround

// on each checklist item in config.settings.inspections[famKey].items[]:
{ id, label, type, options,                          // 'required' REMOVED (Track 1) — all items answer-required
  fail,                                              // NEW (Track 1) — typed fail descriptor above
  evidence: 'none'|'optional'|'failphoto'|'always'   // NEW (Track 2) — default 'none' (read as it.evidence || 'none')
}
```

Back-compat: `it.evidence || 'none'` and `it.fail`-defaults ⇒ existing items need no migration; existing `n.items[id]`
answers unchanged.

## Completion-gate generalization (`app.js:9327`, `completeChecklist` `app.js:12465`)

Today: `allDone = items.every(it => !inspItemUnanswered(it, n.items[it.id]))`. Per Track 1.A, `inspItemUnanswered` now
treats **every** type as required (toggle picked / select chosen / number-date-text filled / file attached) — the
Optional path is gone.

Add an **evidence gate** alongside the answer gate:

```
evidenceMissing(item, answer, ev):
  policy = item.evidence || 'none'
  has    = (ev && ev.length > 0)
  always       → !has
  failphoto    → inspItemFails(item, answer) && !has   // the workflow lever (helper at app.js:2998)
  optional/none→ false
allDone = items.every(it => !inspItemUnanswered(it, n.items[it.id])
                         && !evidenceMissing(it, n.items[it.id], n.itemEvidence?.[it.id]))
+ if walkaround policy === 'required' → require n.evidence.length > 0
```

`completeChecklist` is otherwise unchanged: it still computes `failed`, writes `n.description`, and calls the **same**
`setInspResult(n.inspectionId, failed.length ? 'Fail' : 'Pass')`. The money-adjacent downstream is untouched.

## WO enrichment (`autoWOFromInspection`, `app.js:14504`)

When the auto-WO is created, copy the evidence so it travels with the work order:

```
failedEv = failed.flatMap(it => n.itemEvidence?.[it.id] || [])
wo.evidence = [ ...n.evidence||[], ...failedEv ]      // additive WO field; shown on the WO detail sheet
wo.description = `Auto-created from inspection ${n.inspectionId}. Failed: ${failed.map(failLabel).join(', ')}`
```

The WO detail sheet (`app.js:6134` region) gains a small evidence strip reusing the `.insp-photo` thumbnail pattern.
The §12.8 report's single `n.photo` keeps working and is shown alongside.

## UI — through the yard data-plate language (`/jactec-ui`)

1. **Settings builder** (`settingsInspectionsPane`, `app.js:3460`):
   - **Remove** the Optional/Required segcontrol (`js-insp-itemreq`, `app.js:3502`).
   - **Add a per-type Fail-condition editor** that swaps its controls on the selected type (mirrors how the Dropdown
     options sub-editor already conditionally appears, `app.js:3489-3492`): toggle → a *"Fails when Fail / Pass"*
     segcontrol; number → an *Above/Below/Outside/Inside* segcontrol + threshold input(s); date → a *Before/After*
     segcontrol + *today / pick-a-date*; dropdown → the existing per-option Fails flags (+ optional blank/N-A option);
     text → none. New handlers `js-insp-failop` / `js-insp-faila` / `js-insp-failb` beside `js-insp-type`.
   - **Add the Evidence segcontrol** (`None · Optional · Fail photo · Always`), new `js-insp-ev` handler.
   - **Make existing rows editable** (Jac's "work less hard"): a row expands inline to edit label, type, fail condition,
     and evidence — not just remove. Reuses the draft plumbing; the row sub-label summarizes the config
     (e.g. *"Number · fails below 30 · Fail photo"*).
2. **Takeover row** (`kind:'checklist'`, `app.js:9329`): each row gets a stamped **camera affordance** — a rivet-framed
   icon button (Lucide camera glyph via `icons.js`, never hand-drawn) opening an **image-only** capture
   (`accept="image/*"`); attached evidence shows as a small thumbnail strip reusing `.insp-photo`. When an item fails
   (per the generalized `inspItemFails`) with `failphoto` policy and no photo yet, the affordance gets the caution-yellow
   "required" treatment (mirrors `.insp-photo.empty.req`, `app.js:9395`) and Complete stays disabled with a stamped reason.
3. **Walkaround tile** (Build 2; **off unless the family opts in**): a header tile on the takeover ("Walkaround video /
   photos", `accept="image/*,video/*"`) capturing `n.evidence`. Hidden entirely when the family's walkaround = Off.
4. All new elements get `data-r` stamps; `rule-usage.js` regenerated (`ci/gen-rule-usage.mjs`, drop `--check`). If the
   capture/gallery is a popup, it joins `WINDOW_CATALOG` (+ `ci/check-window-catalog.mjs`). Screenshot + self-critique
   before showing Jac, per the skill.

## Default-checklist seeding (`INSP_DEFAULTS`, `app.js:2638`)

Phase 3: set sensible evidence defaults on the seeded QC items so a fresh Reset reflects the real workflow — e.g. mark
leak/hydraulic/brake/structural lines as `failphoto`, and (if D-W below = required) turn the walkaround on for the
families whose cards reference video. Exact per-family/per-item policy is a **content pass to do with Jac** (see open
decisions). De-dupe the known repeated lines (Power Trowel / Concrete Saw "Leveler Not Broken") in the same pass.

## Build order

1. **Build 1 — Fail-condition model (Track 1, the foundation).** Remove the `required` toggle + all-required gate;
   `it.fail` descriptor + generalized `inspItemFails`; the per-type builder fail-editor; inline-editable existing rows.
   Independently valuable and required before evidence-on-fail is meaningful. Logic tests for each fail operator +
   back-compat (old toggle still fails on Fail).
2. **Build 2 — Evidence capture + WO linkage (Track 2).** `n.itemEvidence` / `n.evidence`; builder Evidence segcontrol;
   takeover per-row camera affordance + header walkaround tile; `failphoto`/`always`/walkaround completion gate;
   `"Keep as pending"` as the only escape; `autoWOFromInspection` enrichment + WO-detail evidence strip. jactec-ui pass.
3. **Build 3 — QC default content pass** in `INSP_DEFAULTS` (with Jac): per-family fail conditions + evidence policy +
   walkaround flags, and de-dupe the repeated lines (Power Trowel / Concrete Saw "Leveler Not Broken").

## Safety / gates

- **Zero-change default** (D6): no policy set ⇒ identical to today; old records untouched.
- **Reuse, don't fork, the cascade:** overall result still flows `completeChecklist → setInspResult →
  autoWOFromInspection`; the only money-path change is *more* evidence on the WO, never different billing logic.
- **Gates (all must pass):** `node ci/smoke.mjs`, `node ci/logic-test.mjs` (new: `failphoto` gate blocks Complete;
  WO inherits failed-item evidence; default→no gate), `node ci/gen-rule-usage.mjs --check`,
  `node ci/check-window-catalog.mjs`, `node tools/gen-code-map.mjs --check`. Cache-bust `?v=` on deploy.
- **Storage:** reuse `downscaleImage` + `offloadPhoto` (Drive). No backend/GAS schema change.

## /role audit — findings folded in (audited 2026-06-26)

The audit cleared the core architecture (no margin-floor/PAN/customer-surface leak; cascade + 1-inspection→1-WO
preserved). The following hardening is now part of the spec; one item is a **pre-build verification gate**.

- **🔴-class verification gate — Drive ACL on evidence.** Evidence offloaded via `offloadPhoto(...,'inspections')`
  produces a Drive link. Before build, **confirm that link is server-side ACL-gated to shop/owner sessions** and is never
  minted into a customer-reachable or public URL. Evidence may show a customer's jobsite (T5); "the UI hides it" is not
  isolation. The feature must inherit the existing failure-photo ACL and never weaken it.
- **Offline-tolerant capture (M.Tech field-call reality).** Capture must **queue locally and retry on reconnect** (shop
  wifi dead zones, no-signal field calls) and must never lose evidence or block Complete on a failed upload. The camera
  affordance is **large-tap, no hover-only** (mirror the Driver delivery-photo pattern).
- **Audit trail (auto, no form).** Attaching evidence logs an attributed History entry on the inspection
  (`logAction(n, 'Evidence attached')`), and `autoWOFromInspection` logs that the WO inherited N evidence items.
- **Late-added evidence propagation.** Damage is often unclear until mid-repair, so the WO must reflect evidence added
  *after* its creation: the WO **references the inspection's live evidence** (or re-syncs on §12.8 report save), not a
  one-time copy at creation. (Resolves Mechanic Q5.)
- **Surface scoping.** The WO-detail evidence strip renders for shop/Fleet/Owner; Office sees it only as billing
  justification (same exposure as today's §12.8 photo); the badge consumers (Dispatcher/Driver) and the Customer portal
  **never** receive evidence. The future printed-doc extension must gate evidence out of any customer-handed document.
- **Settings authority.** The Evidence policy is an Owner-settable business parameter; confirm the Settings → Inspections
  tab (`settingsInspectionsPane`) is gated to Owner/Admin, not Office/Mechanic.

## Open decisions (Jac to redline — defaults chosen so build isn't blocked)

1. **D1 depth** — ✅ **RESOLVED (Jac 2026-06-26): ship both per-item + walkaround together as one build.**
2. **D-W walkaround requirement** — ✅ **RESOLVED (Jac 2026-06-26): Off by default**; admin opts a family in per family.
3. **Per-item video** — ✅ **RESOLVED (Jac 2026-06-26): image-only per item**; video stays on the walkaround + §12.8
   failure report.
4. **`Always` policy** — do we need "evidence required even on Pass" for any item, or is `Optional` + `Fail photo`
   enough? *(Default: include `Always` in the model; seed nothing with it.)*
5. **Pending/abandon** — if an inspector attaches partial evidence then hits "Keep as pending," evidence persists on the
   pending record (no loss). *(Default: persist.)*
6. **Build 3 content** — which exact default items get which fail condition / `failphoto` / walkaround — a sit-down
   content pass with Jac against the QC cards.
7. **Required-gate escape (from /role)** — ✅ **RESOLVED (Jac 2026-06-26): "Keep as pending" is the escape; NO override.**
   See D7. Nothing reaches Ready/Failed (no auto-WO) without the required proof.

### Track-1 fail-model — open follow-ups (Jac to confirm)
8. **Text fail condition** — ✅ **RESOLVED (Jac 2026-06-26): optional admin setting** — default `none`; admin may set
   *fails-if-blank* or *fails-if-contains*.
9. **Date reference** — Before/After **today** only, or also a **fixed admin-picked date**? *(Default: offer both — `ref`
   = `today` or a chosen ISO date; expiry = Before/today.)*
10. **Dropdown blank/N-A** — ✅ **RESOLVED (Jac 2026-06-26): allow an optional N/A option** the admin flags pass-or-fail.
11. **Removing `required` — behavior change** — old items saved `required:false` become answer-required. Confirm that's
    intended for existing configs (it matches "all fields required regardless"). *(Default: yes; flag ignored, all
    required.)*

## Future extensions (out of scope now)

- Per-item *required notes* alongside the photo.
- Pushing evidence into the printed inspection/WO document.
- Authoring each family's evidence policy directly from the QC CARDS index.
- Bringing the typed fail-conditions to the general **Custom Fields** tab (unify the type model).
