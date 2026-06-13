# Rental Wrangler — project notes for Claude

Heavy-equipment rental management SPA for **JacRentals** (Sulphur, LA).
Vanilla-JS single-file app (`app.js`), `style.css`, `index.html`, `config.js`,
`data.js`; Google Apps Script backend (schema-less Sheets, deployed by paste —
`backend/` is gitignored, never served by Pages).

## Design language — RUN ALL NEW/CHANGED UI THROUGH THIS (Jac, 2026-06-13)

Jac loves the "yard data-plate" direction from the login + cancel-arc redesign
and wants **every future UI edit run through the `frontend` skill** in this same
language. Scope: apply to **new or reshaped UI going forward**. Do **NOT**
retroactively restyle the whole existing site yet — only touch what an edit
already touches, unless Jac asks for a site-wide pass.

**The system — "the JacRentals yard":** ground every surface in the
heavy-equipment-rental world so screens read as one shop.

- **Signature motif:** hi-vis **hazard stripe** — `repeating-linear-gradient(135deg,
  var(--yellow,#f5c542) 0 13px, #14181d 13px 26px)`. Red variant
  (`var(--red,#ff4242)`) for danger/abort states.
- **Type:** **Saira Condensed** for stamped labels, wordmarks, and primary
  buttons (uppercase, letter-spaced ~2px, weight 600–800). **Geist** for body.
  Both loaded in `index.html`.
- **Palette:** industrial steel panels (`linear-gradient(180deg,#1b2129,#0c0e11)`),
  **safety-orange** accent (`--accent #ff7a1a`) for primary/ignition actions,
  caution-yellow (`--yellow #f5c542`), danger-red (`--red #ff4242`).
- **Devices:** corner **rivets**, stamped condensed labels, ignition-style
  primary buttons (orange gradient, dark `#1a1205` ink), yard/operator copy
  ("Clock In", "Operator", "Release to cancel").
- **Process (from the skill):** plan a token system first, avoid the 3 AI
  defaults (cream+serif+terracotta / near-black+acid-green / broadsheet
  hairlines), spend boldness in ONE place, build, **screenshot + self-critique
  before showing Jac**. Quality floor: responsive, visible focus, reduced-motion
  respected.

Reference implementations: `.login-*` and `.cancel-arc` blocks in `style.css`.

## Deploy & gates

- **Deploy to live** (app.jacrentals.com via Pages): `git push origin HEAD:main`.
  Also develop on the session's feature branch and open a **draft PR**.
- **Gates (must pass before push):** `node ci/smoke.mjs`,
  `node ci/logic-test.mjs`, `node ci/gen-rule-usage.mjs --check`.
- **R-rulebook:** UI is stamped with `data-r="Rxx"`; `rule-usage.js` is generated
  by `ci/gen-rule-usage.mjs` (has a `--check` drift guard + duplicate-rule guard).
  Regenerate (drop `--check`) when rule usage changes.

## Don't

- Never put the model identifier, secrets, or `DEFAULT_CONFIG` passwords in the
  repo (it's public via Pages). Backend `Code.gs` stays gitignored.
- Changing a WO part/task line to Complete must NOT complete the work order —
  only the blue **Complete WO** button does.
