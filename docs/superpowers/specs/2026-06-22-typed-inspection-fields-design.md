# Typed inspection items — design spec

- **Date:** 2026-06-22
- **Status:** Approved design (pending written-spec review)
- **Area:** `area/units-fleet` (inspections)
- **Skill gate:** UI runs through `/jactec-ui` + `/frontend`; new elements get `data-r` stamps; `rule-usage.js` regenerated.

## Goal

Extend the **Settings → Inspections** checklist-item builder so each item can be a
**typed field** instead of only Pass/Fail. The admin picks a type per item:

`Toggle` · `Add File` · `Dropdown` (with custom options) · `Number` · `Date` · `Text`

This is a **generic builder upgrade** — a general capability for the inspection
form builder. It is *not* (yet) an effort to reproduce the QC CARDS as digital
forms; that is a separate, later task that will consume this capability.

## Non-goals

- Reproducing the QC CARDS (Beauty/Working) layouts or content.
- Touching the general **Custom Fields** tab (`settingsFieldsPane`, `CF_TYPES`) —
  it stays text/number for now.
- Number range / Date expiry fail conditions — explicitly a future extension.
- Any backend/GAS schema change.

## Data model

Each inspection item grows from `{ id, label }` to:

```js
{
  id,        // existing — stable item id
  label,     // existing — admin label
  type,      // 'toggle' (default) | 'file' | 'select' | 'number' | 'date' | 'text'
  required,  // bool — must be filled to Complete (applies to the 5 non-toggle types)
  options,   // [{ label, fail }]  — ONLY for type 'select'
}
```

- **Back-compat:** any existing item with no `type` is read as `'toggle'`
  (`it.type || 'toggle'`). No migration, no stored data is touched. Existing
  saved inspections (`n.items[id]` = `'Pass'`/`'Fail'`) keep working unchanged.
- `n.items[id]` (the inspector's answer, stored on the inspection record) holds:
  - toggle → `'Pass'` / `'Fail'`
  - select → the chosen option **label** (string)
  - file → a `data:` URL
  - number → numeric value (stored as string, like other inputs)
  - date → ISO date string
  - text → string

## The 6 types

| Type | Settings builder | Inspector (takeover) renders | Stored | Can fail? |
|---|---|---|---|---|
| **Toggle** | default; no extra config | ✓ Pass / ✕ Fail segcontrol (today's UI) | `'Pass'`/`'Fail'` | **Yes** — Fail trips WO |
| **Add File** | Required toggle | photo/video/file capture tile (reuses the failure-photo `<input type=file>` → dataURL pattern) | `data:` URL | no |
| **Dropdown** | options sub-editor; each option has a "fails" flag | the admin's options (segcontrol or `<select>`) | chosen label | **Yes** — if chosen option is flagged `fail` |
| **Number** | Required toggle | numbers-only input (`inputmode=numeric`) | number | no |
| **Date** | Required toggle | date picker (reuse `dateField`) | ISO date | no |
| **Text** | Required toggle | free-text input | string | no |

## Fail + completion semantics

Today (`completeChecklist`, app.js:10282): every item must be answered, then
`failed = items where n.items[id] === 'Fail'`; `setInspResult(n, failed.length ?
'Fail' : 'Pass')` cascades to the §12.8 failure report + auto work-order.

This generalizes to two helpers:

**Fail predicate** — which items count as a failure:
```
itemFails(item, val):
  toggle  → val === 'Fail'
  select  → option matching val has fail === true
  else    → false        // file / number / date / text never fail
```

**Completion gate** — what must be answered before "Complete inspection" enables:
```
unanswered(item, val):
  toggle           → !val                       // must pick Pass or Fail (as today)
  required & other → val == null || val === ''   // required non-toggle must be filled
  else             → false                       // optional fields may be left blank
allDone = items.every(it => !unanswered(it, n.items[it.id]))
```

`completeChecklist` then sets:
```
failed = items.filter(it => itemFails(it, n.items[it.id]))
n.description = failed.length
  ? 'Failed checklist: ' + failed.map(failLabel).join(', ')   // toggle → label; select → "label: chosenOption"
  : (unchanged)
setInspResult(n.inspectionId, failed.length ? 'Fail' : 'Pass')   // UNCHANGED downstream — auto-WO path intact
```

Net effect: the §12.8 failure report + auto-WO trigger exactly as today, now
fired by **either** a Toggle Fail **or** a failing Dropdown selection. The
overall `inspResult` (`Pass`/`Fail`/`Not Ready`) and every consumer of it are
untouched.

## Settings builder UI (Settings → Inspections)

`settingsInspectionsPane` (app.js:2271) "+ Add item" row gains, mirroring the
Custom Fields tab's existing segcontrol pattern (`settingsFieldsPane`, app.js:2293):

1. **Label** input (as today).
2. **Type picker** — segcontrol of the 6 types.
3. **Optional / Required** toggle (segcontrol) — meaningful for the 5 non-toggle
   types; hidden/no-op for Toggle (always answered).
4. **Dropdown options sub-editor** — appears only when type = Dropdown:
   add/remove option chips; each option has a small **"fails"** flag so the admin
   can mark which selections trip the WO. Cannot add a Dropdown item with zero
   options.

Existing item **rows** change from the hard-coded "Pass / Fail line" sub-label to
show the item's **type** (and, for Dropdown, its options with failing ones
marked) — same `rule-row` layout, same remove button.

Draft/save plumbing reuses the existing `ensureInspDraft` / `draftInspCfg` /
`o.draftSettings.inspections[catId]` path — no new persistence surface.

## Inspector takeover rendering (app.js:7488, `o.kind === 'checklist'`)

Replace the single Pass/Fail `segCtl` per row with a per-type renderer keyed on
`it.type`:

- toggle → Pass/Fail segcontrol (unchanged markup)
- file → capture tile reusing the `.insp-photo` empty/filled pattern; on change,
  FileReader → dataURL → `n.items[id]`
- select → the option set (segcontrol for ≤~4 options, else `<select>`); failing
  options may carry a subtle danger affordance
- number → `<input type=number inputmode=numeric>`
- date → `dateField(...)`
- text → `<input>` / small textarea

Each writes `n.items[id]` via a handler analogous to the existing `js-ck-item`
(app.js:9772). Header progress (`done/total`) uses the new completion gate.

## File storage

Reuse the existing **`data:` URL on the record** mechanism (FileReader →
dataURL), identical to the §12.8 failure photo (app.js:7518) and the agreement
selfie. The value lives in `n.items[id]` and persists through the same inspection
sync — **no backend change**. Constraint: large videos = large dataURLs, the same
trade-off already accepted for failure-report videos.

## Validation / edge cases

- Dropdown must have ≥1 option to be added.
- Number coerces non-numeric to empty; `inputmode=numeric`.
- Optional non-toggle fields may be blank and still allow Complete.
- Old (untyped) items render as Toggle; old saved answers unchanged.
- Removing an item: existing remove path (`js-insp-remove`) unchanged.

## Affected code (anchors)

- `settingsInspectionsPane` — builder UI — app.js:2271
- Add-item handlers (`js-insp-add`, `js-insp-label`, `js-insp-req`, new type/option handlers) — search `js-insp-` in the delegated click handler
- Inspection takeover render — app.js:7488
- Item-answer handler `js-ck-item` — app.js:9772
- `completeChecklist` — fail/complete rollup — app.js:10282
- `inspResult` / `setInspResult` — downstream, **unchanged** — app.js:1319
- Pattern references: Custom Fields type segcontrol — app.js:2293; `cfSectionHtml` typed render — app.js:8210

## Future extensions (out of scope now)

- Number range / Date expiry fail conditions.
- Bringing the 6 types to the general Custom Fields tab (unify the type model).
- Per-item evidence prompts feeding the failure report.
- Authoring each category's form from the QC CARDS index.
