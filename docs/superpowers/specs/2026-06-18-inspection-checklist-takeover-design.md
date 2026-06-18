# Inspection Checklist — required-takeover popup + cascade (design)

**Date:** 2026-06-18 · **Branch:** `claude/infrastructure-i5b4za` · **Follow-on to:** Settings Board (PR #157)
**Status:** spec for review — touches the inspection → auto-WO (money-adjacent) flow, so it wants Jac's OK before build.

Jac (2026-06-18, live): *"The Inspection checklist should be a popup and cascade the result onto the
current [inspection] section we already have. A '+Inspection' should replace the current sheet until
AFTER completion — that's only if a checklist inspection is required."*

## 1 · What exists today (grounded)

- **Inspection section** — on the **unit detail sheet** (`app.js:3886`): quick `✓ Pass · Not Ready · Fail`
  segmented toggles + Wash, timestamped. Toggling calls `setInspResult`.
- **The cascade** — `setInspResult(id, val)` (`app.js:11094`): sets `unit.inspectionStatus`
  (Pass→Ready, Fail→Failed), and **on Fail auto-creates a work order** (`autoWOFromInspection`,
  `app.js:11136`) + opens the failure photo/notes popup. **This is the cascade Jac means — we reuse it.**
- **"+Inspection"** — `startNewInspection(unitId)` (`app.js:10721`) makes a unit-born draft inspection.
- **Checklist data** — `config.js:85` `inspectionChecklist` is **only `{Pass, Fail}`**. There are **no
  item-level checklist templates** yet — those are the new thing.
- **Inspection record** (`data.js:142`): `{ inspectionId, unitId, date, wash, checklist:'Pass'|'Fail'|'',
  billCustomer, customerId, woId, photo, description }`.
- **Overlays** float over the sheet and close on backdrop click; the current `inspection` overlay
  (`app.js:6944`) is failure-notes only.

## 2 · The model (config.settings.inspections)

Per **category** (the unit's `categoryId`'s type), an admin defines a checklist template + whether it's
required. Stored via the existing `config.settings` path:

```js
config.settings.inspections = {
  '<categoryId or category-type>': {
    required: true,                       // gate for the takeover (Jac: "only if required")
    items: [ { id:'chk_brakes_a1', label:'Brakes & hydraulics' }, { id:'chk_lights_b2', label:'Lights' }, … ],
  },
};
```

Each item is a **Pass/Fail line** in the popup. **Any item Fail ⇒ overall Fail** (feeds the existing
Fail→Failed→auto-WO cascade); all Pass ⇒ overall Pass→Ready. Item results persist on the record as
`inspection.items = { chk_brakes_a1:'Pass', chk_lights_b2:'Fail', … }` (schema-less). Empty config ⇒ no
checklist anywhere ⇒ today's quick-toggle behavior, unchanged.

## 3 · Settings → Inspections tab (the foundation)

Mirrors the Statuses/Custom-Fields tabs: a **category picker** → for the selected category, a
**"Require a checklist inspection" Off/Required** toggle + an **item editor** (add / remove / relabel
checklist items, like Custom Fields' add-row). Live count + a note explaining the takeover only triggers
when Required. Low-risk (pure config).

## 4 · Runtime — the takeover (the part that needs care)

- **+Inspection on a unit** → look up the unit's category checklist. **If `required` and it has items**:
  open a NEW overlay **`kind:'checklist'`** that is a **full-sheet takeover** — modal, **no
  backdrop-dismiss, no ✕** until done (it "replaces the current sheet until AFTER completion"). It lists
  each item with Pass/Fail (R14 `segCtl`), a running summary, and a single **"Complete inspection"**
  ignition button (enabled once every item is marked).
- **On Complete** → write `inspection.items`, compute overall (`any Fail → 'Fail' else 'Pass'`), call the
  **existing `setInspResult(id, overall)`** so the cascade is identical to today: unit status flips, and a
  **Fail auto-creates the WO** (we enrich `woReport` with the failed item labels). The takeover closes and
  the result is now shown on the **existing inspection section** of the sheet — the "cascade onto the
  current section" Jac asked for.
- **If not required** (default / no template) → **nothing changes**: the quick Pass/Fail toggle on the
  inspection section stays exactly as it is today.
- **Abandon guard**: because the sheet is replaced until completion, the takeover offers only "Complete";
  a draft started but not completed is discarded (ghost `R18`-style "Cancel inspection" that removes the
  draft) — so we never strand a half-inspection. (Confirm with Jac: discard vs keep-as-pending.)

## 5 · Safety / gates

- **Zero-change default**: empty `settings.inspections` ⇒ the inspection flow is byte-for-byte today's.
  The takeover only engages when an admin marks a category's checklist Required with items.
- **Reuse, don't fork, the cascade**: overall result flows through `setInspResult` →
  `autoWOFromInspection`, so the money-adjacent WO behavior is unchanged except for a richer report.
- **Gates**: `node ci/logic-test.mjs` (new: overall-result rule = any-Fail→Fail; required-gate lookup;
  default→no takeover), smoke, rule-usage. jactec-ui screenshot pass for the takeover + tab. Cache-bust.

## 6 · Build order (when approved)

1. Settings → Inspections tab + `config.settings.inspections` model (safe foundation).
2. `checklistFor(unit)` + the `kind:'checklist'` takeover overlay (no-dismiss) + Complete → `setInspResult`.
3. Gate `+Inspection` / the inspection-section entry on `required`; enrich the Fail WO report with failed items.
4. Logic tests + screenshots + draft-PR update.

## 7 · One open question for Jac

- An incomplete required inspection (operator backs out): **discard the draft**, or **keep it as a
  pending inspection** the unit carries until finished? (Affects whether the unit can be used meanwhile.)
