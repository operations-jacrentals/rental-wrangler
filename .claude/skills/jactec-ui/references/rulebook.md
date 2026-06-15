# The R0–R24 rulebook (mirror of `RULE_META`, SPEC v8)

Every lint-family UI element is built by ONE `§5` builder in `app.js` that stamps
`data-r="Rxx"`. Match intent → rule → builder here; extend the builder, never
hand-roll the markup. The in-app Rulebook overlay + Design Inspector render from
this same metadata, so keep `RULE_META` / `RB_FOUNDATION` / `RB_TABS` in sync when
you change a rule. Debug in this language: "that pill violates R4 — fix `dPill`."

| R | Name | Builder | What it is / the law |
|---|------|---------|----------------------|
| **R0** | Flash-lint | `body.rw-lint` CSS | Any un-stamped pill/add/flag/link/req/seg/file-drop/datefield (or a native `title`) pulses red. The alarm. **Build target = ZERO.** |
| **R1** | Gate pill | `gatePill`/`gatePillRaw`/`funnelPill`/`masterGate`/`unitStatusGate` | A status DROPDOWN that moves the record forward — big shape + chevron. The only "pressable status." |
| **R2** | Linked pill | `refPill` / `unitPill` | Opens another record. Orange outline + DESTINATION-card icon; optional ✕ to unlink. |
| **R3** | Status badge | `statusPill` | Informational STATUS only: registry color + parent-card icon + hover underline. NEVER an action. |
| **R3b** | Data chip | `badge` | A plain FACT (`480 HRS`, `No GPS`): gray, no icon, no hover. Independent of R3. |
| **R4** | Derived pill | `dPill` | Rides another pill: no bg/border, ink + icon only; sits RIGHT of its parent (LEFT if the parent is right-aligned). |
| **R4b** | Flashing pill | `dPill({alert})` | A derived pill that PULSES for attention (e.g. `Overbooked`). |
| **R5** | _retired_ | — | RETIRED → record-linking adds now wear R5b. Nothing stamps `R5`. |
| **R5b** | Blue add | `addBtn({link\|line\|anchor})` | BLUE dashed `+Thing` — links/creates a record OR adds a line item. One blue add language. |
| **R5c** | Empty field | `addBtn()` | GRAY dashed `+Thing` — a normal empty field (`+Serial`, `+Email`, `+PO`). |
| **R6** | Required | `reqBtn` / `.req` | White + dark ink until entered/captured — stays loud. |
| **R7** | Hyperlink | `linkName` / `.inv-line-link` | Blue · italic · NOT bold · permanent underline. |
| **R8** | Derived value | `kv({derived})` / `.derived` | Italic = the app computed it; you don't type it. |
| **R9** | Title flags | `flagEl` / `flagsStack` | ≤2 stacked 14px mini-flags beside a title — no backgrounds. `alert` pulses; `sect` scrolls to a section. |
| **R9b** | Flashing flag | `flagEl({alert})` | A title flag that PULSES (No Card, Overbooked, bad pay status). |
| **R10** | S1 title chip | `.c-titlecard` (`cardEl`) | Dark chip · white bold label · plain orange icon · permanent orange border. |
| **R11** | Section | `.section` + `sec-green/yellow/red` | Centered header; header + border follow the LIVE status. |
| **R12** | Notes line | `notesSection` | Boxless, label-less; filled → top of the card, empty → bottom above history. |
| **R13** | History | `historySection` | Count chips above the search bar filter inline; record-backed links only. |
| **R14** | Seg toggle | `segCtl` | 3-state segmented control (condition · wash). |
| **R15** | Journey | `yardToolHtml` / `miniJourneyHtml` | Yard +Start/+FC/+End + Jac─Site─Jac transport; white = video owed. Per-unit. |
| **R16** | Day timeline | the rentals `timeline` | The rental window in day cells; centered gate + naked price·rate; cells tint by status. |
| **R17** | Action pill | `actionPill` | commit = blue · money = green · danger = solid red; `.locked` = gated. |
| **R18** | Ghost | `ghostPill` | The ONE quiet action — Cancel / Close / Exit / Clear. |
| **R19** | Attention flash | `attnFlash(sel)` / `flashOr(sel,msg)` | A glow that points AT the on-screen fix instead of an error message. |
| **R20** | Wrangler menu | `openCtxMenu` / `runCtxAction` | Right-click / long-press a REAL control → Cut/Copy/Paste/Clear/Search/Replace/Add Comment/Ask Mr. Wrangler. Never on bare `.row`/dead space. |
| **R21** | File drop | `fileDrop` | The MASSIVE popup add-file zone — R5b blue dashed at full size. |
| **R22** | Date picker | `dateField` | The ONE app-styled calendar for a single date/time (NOT the rental-window timeline). Native pickers are banned. |
| **R23** | Tooltip | `data-tip` attribute | Every hover hint goes through `data-tip`; a native `title=` is an R0 violation. |
| **R24** | Close ✕ | `closeX` | Red circle · white ✕ — the deliberate close/remove; hover-reveal variant on tabs. |

**Placement laws:** derived pills sit right of their parent (R4; left when the parent
is right-aligned) · left of a section = actions, right = derived · Section 0 = Notes ·
Section 1(–2) = high-action zone, then Details, then Data · line-row pills share a
min-width + centered label so the column edge aligns down a stack; everything else
keeps intrinsic width (only height/font/padding/radius are uniform) · body-wide
`tabular-nums`.

**Foundations** (the `RB_FOUNDATION` tab — primitives, not `data-r` stamped): type
(display/body/mono/scale/weight), color (accent/status/semantic/neutral/tan), form
(radius/elevation/spacing/motion), surfaces (bg/panel/card/section/anchored/row),
containers (section + popup headers, overlay, menu, grid), data-viz (KPI rings,
activity gauge), behaviors (hover previews). These are the tokens + guidelines the
rules are built FROM — see `tokens.md` + `signature-recipes.md`.
