# R-Rulebook Audit — 2026-07-17

**What this is.** A full census of every UI element the app serves, checked against the
R-Rulebook (R0–R33 + `RB_FOUNDATION`): what **has a home** (a builder + `data-r` stamp or
`CLASS_RULE` class) and what **hasn't**. Scope was everything served — `app.js` (all 25,326
lines, chapter by chapter), `index.html`, `style.css` — including, per Jac's mandate, every
popup, dropdown, menu, right-click menu, chat, notification, header, footer, and invoice.

**This audit fixes NOTHING.** It documents. Every finding is a candidate for a future,
separately-approved change.

**Method.** Three rounds: (0) mechanical extraction — stamp census, builder call counts,
CI gates, window-catalog diff, CSS defined-vs-used cross-reference; (1) eleven parallel
judgment sweeps covering every line of `app.js` plus `index.html`/`style.css`; (2) an
adversarial verification round — every "dead CSS" candidate re-checked by hand, plus four
fresh-lens hunters (native controls, emission-site coverage, other served files, and a
completeness critic against Jac's "check everything" list), looped until dry.

**Verdict vocabulary**

| Verdict | Meaning |
|---|---|
| **Branded** | Has a home: emitted by a canon builder / carries the right `data-r` or `CLASS_RULE` class |
| **Stray** | Has a home but doesn't live in it: hand-rolled markup duplicating an existing rule's element |
| **Maverick** | No home exists: a real, designed, recurring element with no fitting rule — a candidate new rule |
| **Ghost** | Dead weight: CSS nothing wears anymore (verified, not just parser-flagged) |

---

## 1 · Executive summary

**The canon itself is mechanically clean.** Both CI gates pass; all 47 popup kinds are in
`WINDOW_CATALOG` with zero drift (verified twice, independently); every one of the 37
builders has live call sites; there are zero unknown `data-r` stamps. The enforcement
machinery works — for everything it can see.

**The drift is in what the machinery can't see.** The R0 flash-lint polices six element
families (`.pill .add-field .flag .linkname .inv-line-link .req`). Everything outside those
families can be hand-rolled invisibly — and it is. The census found roughly **65 stray
sites** (elements that duplicate an existing rule by hand), **~35 mavericks** (designed
elements with no rule at all), and **~18 repeated patterns** (the same markup hand-built at
2–22 sites that one builder each would collapse).

**Headline findings**

1. **The ignition button has no builder.** The signature primary CTA — named in CLAUDE.md
   itself — is hand-rolled `.pill.ignition` at ~22 sites, stamped `R17` even though
   `actionPill()` cannot emit an ignition variant.
2. **`toast()` has no rule.** The app's most-used feedback surface (100+ call sites) is
   absent from `RULE_META` and `RB_FOUNDATION` entirely; R25's own definition ("the ONE
   non-toast alert") references it without ever numbering it.
3. **The invoice document has no home.** `invoiceDocHtml` (app.js:20815) builds the
   customer-facing invoice/quote for print, PDF, email, and the inline sheet — a fully
   designed `.pr-*` component family with zero Rulebook presence.
4. **`.dd-item` dropdown rows are hand-rolled at 13+ sites** — no `ddItem()` builder exists
   despite the shared dropdown being a documented foundation.
5. **`pillS()` is a shadow builder** (app.js:6944): it duplicates R3b's `badge()` unstamped
   and feeds every badge column of every List-View render — high traffic, invisible to lint.
6. **Passwords via `window.prompt`.** The Admin override (app.js:18778, 19872) collects a
   credential in an unmasked native OS dialog, while the same app ships a styled, masked
   `managerPw` popup for the identical job.
7. **RB_TABS omits R27 and R30** — both rules exist and are stamped live, but neither is
   reachable from the in-app Rulebook's tabs.
8. **The banner family has ~6 members but only 2 rules** — R25 (sync) and R27 (due-today)
   are canon; toast, the SW-update banner, the link-picker banner, and the env badge are
   siblings with no rule.

**What this buys.** Fixing the top repeated patterns (ignition builder, popup foot/head
pass-through, `ddItem()`, `statusDot()`, ref-chip consolidation) would collapse ~90
hand-rolled sites into ~6 builders — less bytes served, and every future restyle of those
elements becomes a one-builder edit instead of a hunt.

---

## 2 · Canon consistency (the registry auditing itself)

| Finding | Where | Detail |
|---|---|---|
| RULE_META builder lists incomplete | app.js:6080–6081 | `masterGate`/`unitStatusGate` stamp R1, `entityPill` stamps R2 — none are named in the registry |
| RB_TABS misses two rules | app.js:6228–6249 | **R27** (Due-Today banner) and **R30** (Paused banner) appear in no tab — unreachable from the in-app Rulebook UI |
| Stale rule-number comments | style.css:193, app.js:5674 | Both label `closeX` "R22" (canon: R24; R22 is `dateField`). Live stamps are correct — only docs drifted |
| Stale rule-number comment | style.css:5043 | Due-Today banner block commented "R26" — should read R27 (app.js side was already corrected) |
| APP-10 header conflates R3/R3b | app.js:5385–5394 | "R3 statusPill / badge" — `badge()` actually stamps R3b, a separate rule |
| Six builders live outside APP-10 | app.js:2736, 3963, 4463, ~10255, 23708, 23761 | `cardJog`, `acctBtn`, `invoiceStatMenu`, `.wr-paused`, `renderSyncBanner`, `renderSchedBanner` — RULE_META catalogs them as §5 builders but they're defined elsewhere |
| Rulebook's own R25 example is faked | app.js:13036 | The catalog's sync-banner demo is inline-styled HTML, breaking the file's own "every example is emitted by the REAL builder" claim (13001–13002) |
| CLASS_RULE redundancy | app.js:6254 | `.kv.derived`→R8 listed before the broader `.derived`→R8 (harmless) |

---

## 3 · Strays — has a home, doesn't live in it

Consolidated from all sweeps, grouped by the rule each site belongs to.

### R22 `dateField` — raw native `<input type="date">`
| Site | Context |
|---|---|
| app.js:4184 | agreement new-form |
| app.js:5145 | inspection fail-editor |
| app.js:8543 | invoice due-date field |
| app.js:13760 | 'service' popup "Date completed" (every sibling popup uses `dateField()` correctly) |

### Native dialogs — bypass R19/R22/the popup system entirely
| Site | What |
|---|---|
| app.js:4147 | `window.confirm` in `guardAgLeave` (self-acknowledged scoping call) |
| app.js:18202 | `prompt()` to name a saved view |
| app.js:18778 | **`window.prompt` for the Admin password override** — unmasked OS dialog for a credential; the styled masked `managerPw` overlay (app.js:17563) exists for the identical manager-tier job |
| app.js:19872 | second `window.prompt` Admin-password gate (Settings) |
| app.js:21629–21646 | `prompt()` fallbacks for custom invoice line + WO part/labor — dead code today (UI callers supply values), but money-adjacent landmines |
| app.js:24747, 24760–24773 | `prompt()` + 3× `alert()` in the `#reseed` dev hatch |

### R3/R3b `statusPill`/`badge` — hand-rolled status/fact pills
| Site | What |
|---|---|
| app.js:6944 | **`pillS()` shadow builder** — duplicates `badge()` minus stamp; feeds every badge-type column via 6954, 6994, 7004, 7035 |
| app.js:6833 | inspections row result pill (no `data-r` at all) |
| app.js:7563 | WO footer "Cancelled" gray pill |
| app.js:8620 | serviceOrders detail-head "Wash Requested" pill (stamped twin exists at 7636) |
| app.js:8636, 8642 | inspections result pill · "No unit" pill |
| app.js:12434 | migrateUnits plan-table New·/Link· pills |

### R24 `closeX` — hand-rolled close/remove ✕ (12 JS sites + 6 CSS recipes)
| Site | What |
|---|---|
| app.js:3937 | nextActions dismiss ✕ |
| app.js:9274, 9280 | fleet-chip / pay-method clear (`class="x"`) |
| app.js:10064, 10178, 10233 | held-chip ✕ · wr-focus ✕ · attachment ✕ (×2) |
| app.js:15890, 15910 | Board-View column/row remove `×` |
| app.js:16217 | delete-view ✕ nested **inside** another button (also an a11y smell) |
| app.js:24949 | comms-rail tab-hide `×` (literal text char) |
| app.js:25058 | conversation "tuck away" ✕ (right icon, no stamp) |
| style.css:575, 607, 1320, 1453, 1515, 2184 | six separate circular-✕ CSS recipes (`.card-row .x`, `.fb-shot-x`, `.wr-thumb-x`, `.crail-x`, `.cp-x`, `.ck-evrm`) each redefining what `.close-x` already is |

`.close-x` is not in the R0 lint families — this whole class of drift is invisible to CI.

### R2 `refPill` — the record-reference chip, rebuilt three ways
| Site | What |
|---|---|
| app.js:10046 | `.chip-ref` chat reference chip (icon+label+chevron, opens record) |
| app.js:10064 | `.held-chip` pasted/held element chip |
| app.js:10178 | `.wr-focus-chip` Wrangler focused-record chip |
| app.js:8648 | inspections "Failure report →" button (`pill ref`, unstamped) |

### R5b/R5c `addBtn` — hand-rolled dashed adds
| Site | What |
|---|---|
| app.js:708 | `+Nickname` inlined by hand (correct stamp, no builder) |
| app.js:1939 | `lostDemandBtn` nested hand-build |
| app.js:9327, 9336, 9345 | the `.bigbtn` "+New Rental / +New Customer / +New Unit" family |
| app.js:13913 | payment foot `+Card` fallback (`add-field anchor` + inline disabled/style) |

### R17/R18 `actionPill`/`ghostPill` — hand-rolled action buttons
| Site | What |
|---|---|
| app.js:12439, 13388, 13551, 13570, 13587, 13650, 13798, 13811, 13823, 13841, 13865 | popup foot "ghost Cancel + primary Save" pairs hand-rolled (builders used correctly elsewhere in the same function) |
| app.js:13910–13919 | payment popup Refund/Charge/Record/Check-ACH buttons |
| app.js:7985 | rental "dates" split button (inline SVG) |
| app.js:8579 | legacy WO partForm Add line/Cancel |
| app.js:8791, 8959 | "Show more" button (both list paths) |
| app.js:6552, 6553 | row eye-preview / open-new-tab icon buttons |
| app.js:15687 | signature-popout "Clear" (inline-styled ghost pill) |
| app.js:4724–4738 | Team-Roster `.emp-act` plain buttons |
| style.css:1345 etc. | `.wr-actbtn`/`.wr-askbtn` duplicate the R17/ignition gradient by hand |

### R1 / R7 / R14 — one-off bypasses
| Site | What |
|---|---|
| app.js:7633 | service-task complete button → belongs to R1 `gatePillRaw` |
| app.js:8067 | GPS map link `<a target="_blank">` → R7 `linkName` |
| app.js:10198 | `.wr-goto` "label →" jump → R7 |
| app.js:8644, 8646 | inspections Wash and Pass/Fail gates hand-rolled → R14 `segCtl` (units detail uses `segCtl` for the *same semantics* at 8167) |

### Icon-law strays (`.claude/rules/icons.md`)
| Site | What |
|---|---|
| app.js:4471–4473 | R29 menu items use literal emoji ($, 🖨, ✉, ↩) |
| app.js:4109 | literal 🔒 where the vendored `AG_LOCK` SVG is used 2 lines away |
| app.js:3957 | unicode ▾/▸ where siblings use `I.chev` |
| app.js:5876–5879, 5904–5908 | R20 context-menu emoji icons |
| app.js:11565–11566 | carousel chevrons hand-paste raw SVG paths duplicating vendored `I.chevL/R` |

### CSS recipe duplication (strays in the stylesheet)
| Site | What |
|---|---|
| style.css:3792–3810, 3675–3680 | `.ag-tab.ok/mid/bad` + `.type-chip.ok/warn/pend/bad` reimplement the soft-bg+ink status recipe that `.c-green/.c-yellow/.c-red` provide (ag-tab documented as deliberate 2026-07-10; type-chip also uses a divergent ok/warn/bad vocabulary vs the registry's green/yellow/red) |
| style.css:1345, 1361, 1917, 3055, 4644, 4792, 4903 | ignition gradient `linear-gradient(180deg,#ff9038,var(--accent))` as a literal ×7 — never tokenized |

---

## 4 · Mavericks — no home exists (candidate new rules)

Grouped by **nearest family** (this grouping is also the Figma placement, per Jac:
outliers ride with the elements they're most like).

### Pills & Flags
| Element | Sites | Why homeless |
|---|---|---|
| **Status dot** (`cc-dot`/`cp-dot`/`ag-dot`) | app.js:24936, 25001, 25014, 25026, 25033, 25305, 23582 | bare colored dot carrying category-worst status; no rule covers a dot. Candidate `statusDot(color)` |
| `filterTermPill` search chip | app.js:3061 | pinned filter chip w/ negate toggle + remove; invisible to R0 lint (`.filt-term` in no family) |
| `cr-pay` owed/spend value chip | app.js:6676 | status-colored money chip, not a pill |
| `trip-seq-n` stop-sequence chip | app.js:6880, 6919 | numbered route chip, duplicated |
| Count-badge overlay | app.js:9095, 9794, 9802 | numeric unread/count bubble, built 3 ways |
| Tri-state Yes/No/Required toggle (`nc-po`/`nc-rp`) | app.js:13518–13519 | neither R31 (binary) nor R6 (single state) fits |

### Fields & Adds
| Element | Sites | Why homeless |
|---|---|---|
| **Admin-field family** (`.co-fld`/`.co-in`/`.set-input`) | app.js:4994–5042, 4717–4722, 5141–5163, 5225 + KPI pane | the dominant unhomed pattern in Settings — dozens of labeled text/number fields, no rule. One new stamped rule homes them all |
| `.set-pick` chip picker | app.js:5184, 5210, 5233, 5295 | option-chip picker; nearest R14 |
| Color-swatch + icon-tray pickers | app.js:5234–5250 | no rule for a swatch/glyph picker |
| **Inline-edit affordance** (`.inline-edit`/`.inline-input`) | app.js:18631–18744 | click-value→input for hours, PO, nickname, category… pervasive, consistently styled, absent from canon |
| Hover-reveal insert "+" (col/row) | app.js:15885, 15902 | Board-View structural insert; R5c is a different shape/interaction |
| Payment/refund allocation panels (`.alloc-*`) | app.js:20211, 20284 | designed money-entry surface; only its shortcut is stamped |
| Trips `dt-time` free-text time input | app.js:6924 | always-visible time field, distinct from R22 |
| `rr-star` star-rating | style.css:2070–2096 | single-use today; flag if a second rating surface appears |
| Mobile card-switch chips (`.mcard-tog`) | style.css:339–359 (+§M7) | a designed segmented toggle that never touches R14 `segCtl` — mobile's ONE recurring homeless pattern |

### Actions
| Element | Sites | Why homeless |
|---|---|---|
| **Ignition button** | ~22 popup sites (12439, 13388, 13551, 13587, 13662, 13718, 13733, 13755, 13782, 13798, 13811, 13823, 13841, 13865, 14141, 14241 + ~6 app-wide) | the signature primary CTA has NO builder; mislabeled R17 (`actionPill` can only emit commit/money/danger/blue). Candidate: `actionPill('ignition')` or `primaryPill()` |
| **Icon-only chrome button** | `.iconbtn` (9747, 9781, 9802, 10160…), `.hbtn` (9106), `.rail-ico` (10117–10122), `.cp-gear` (25014) | the same species under ≥4 class names; R18's icon mode exists but is unused here |
| `actionPill` has no `disabled` param | def app.js:6027 | forces hand-rolls at 12919, 13479, 13718, 14141, 14241 |
| Trips `trip-town` nav button · `trip-more` kebab | app.js:6883, 6901 | no rule for plain-text nav trigger or generic overflow kebab |
| `wr-askbtn` quick-reply chips | app.js:10224 | Wrangler suggested-answer chips |
| Inline ✓ "mark done" icon button | app.js:3936 | no fitting rule |

### Containers
| Element | Sites | Why homeless |
|---|---|---|
| **`collapseSection()`** | def app.js:7481; calls 7657, 8049, 8084, 8154, 8608 | a shared, widely-reused collapsible summary bar (label+summary+status chip+chevron) — already ONE function, just unruled. Strongest "stamp an existing builder" candidate |
| **Tab-button family** | coltab 9087 · mcard-tog 9076 · header `.tab` 10662 · `.crail-tab` 9826 · `.pm-tabs` (css) | navigation tabs reinvented 4–5 ways; R14 is a toggle, not navigation — no tab rule exists |
| `grp-hd` list-group header | app.js:8943–8949 | grip + chevron + live count on every grouped list; not in CLASS_RULE |
| Health-border mini-cards (rcc/ucard/catr) | app.js:6651, 6711, 6789 | three independent hand-rolled implementations, each its own class prefix + `--*-hl` var |
| Popup-head hand-rolls | app.js:13121, 13422, 13426, 13433, 13444, 13468, 13710 | 7 popup kinds rebuild the head `popupShell()` already parameterizes (clean uses at 13282, 13315) |
| Notifications collapsible cards · Action-Log accordion | app.js:4860 · 3942 | same shape, unstamped |
| `popupShell` lacks a "no-close" option | app.js:14118 (returnRating) | the one required modal must hand-roll a full custom shell |

### Data & Behaviors
| Element | Sites | Why homeless |
|---|---|---|
| **`toast()`** | app.js:16576 (+`#toast` index.html:40; 100+ call sites) | the app's ubiquitous transient message — no rule, despite R25 defining itself against it |
| Chart-mark-as-filter idiom | app.js:11567–11616, 11719–11724, 11960–11989, 12009–12012, 12673–12683 | click a bar/slice/dot/tile → toggles a search pill or navigates; a consistent novel interaction spanning the Round-Up system |
| `customerActivityChart` | app.js:7312–7387 | bespoke SVG chart + scrub tooltip; also hardcodes `#c2925a` twice (token `--tan` exists) |
| `mixSeg`/`mixBar`/`rentBar` | app.js:8387–8393 | proportional clickable status bar-as-filter |
| Rentals-row 3-week mini-timeline | app.js:6572–6656 | row-embedded elapsed-tint timeline; R16 covers only the detail calendar |
| GPS event feed row | app.js:23002 | bespoke alert/event feed row |
| Trips/dispatch day-timeline (`.disp-*`) | style.css:680–830 | large bespoke surface over route concepts R15 owns |
| Route-rail stepper (`.rtrail2`) | style.css §20 | linear stepper conceptually near R15, separate implementation |

### Windows / Surfaces
| Element | Sites | Why homeless |
|---|---|---|
| **Invoice/quote document** (`invoiceDocHtml`, `.pr-*`) | app.js:20815 (~90 lines) | THE customer-facing document (print/PDF/email/inline) — fully designed, zero Rulebook presence (its paper palette is a documented token exception; the *component* still has no rule) |
| Comms toolbar chips + session tabs | app.js:24927–24939, 24943–24969 | icon-chrome-with-status-dot + closeable rail tabs; not R14 |
| Chat bubble shell ×2 | `.cbub` 10068–10077 · `.wr-msg/.wr-bub` 10227 | Team vs Wrangler bubbles built independently |
| Conversation/thread list row | `.cm-row` 25033 · `.wrops-row` 23578–23586 | dot+title+snippet+meta row, built twice |
| Banner family gaps | `.sw-toast` 16505 · `linkBanner` 16749 · env badge 24185 · GPS degraded banners 12589/12636/12690 (copy-pasted ×3) | siblings of R25/R27 with no rule; the drag chrome (`.drag-ghost` 16977, `.cancel-arc` 16805, `.chat-drop` 16810, `.zip-zone` 17167) is likewise blessed (CLAUDE.md reference) but unnumbered |
| "Coming 2026" roadmap plate · Sales "Coming soon" placard | app.js:9694 · 9116 | morale/teaser plates, no rule |
| Header & bottom-bar chrome | app.js:9686, 9809, 9930 | logo, tabstrip, hello-name, tool clusters — structural chrome, unhomed (KPI rings ARE canon via `RB_FOUNDATION`) |

### Upload & Capture
| Element | Sites | Why homeless |
|---|---|---|
| Selfie + signature capture panel (`agCaptureBlock`) | app.js:430–446 (+15620–15726 wiring) | live camera + signature pad; R21 covers only the drop zone |
| `.insp-thumb` photo/video thumbnail | app.js:8258, 8295, 8654, 8655 | the captured-result thumbnail, duplicated verbatim ×4 |
| `capProgress` 3-piece strip | app.js:421–424 | documented intentional exception (kept outside lint on purpose) |

---

## 5 · Repeated patterns — the streamlining board

Ranked by consolidation payoff (sites × traffic). **One builder each.**

| # | Pattern | Sites | Candidate |
|---|---|---|---|
| 1 | Ignition primary CTA hand-rolled | ~22 | `actionPill('ignition')` |
| 2 | Popup foot "Cancel + primary" pairs | ~19 | route through `ghostPill()`+`actionPill()` |
| 3 | Hazard-stripe gradient literal | ~20 (css) | one `--hazard` token/mixin (`#14181d` gap never tokenized) |
| 4 | `.dd-item` dropdown row | 13+ | `ddItem()` |
| 5 | Dock plate gradient `#1b2129→#0c0e11` | ~9 (css) | `--dock-bg` token |
| 6 | Hand-rolled close-✕ | 12 js + 6 css | `closeX()` everywhere; add `.close-x` to lint families |
| 7 | Ignition gradient literal | 7 (css) | same `--ignition` token as #1 |
| 8 | Status dot | 7 | `statusDot(color)` |
| 9 | Popup head hand-rolls | 7 | `popupShell({headRight/headRail})` pass-through |
| 10 | Icon-only chrome button (4 class names) | ~10 | one icon-button mode |
| 11 | `.lf-in`/`.lineform` inline add-line inputs | 5 | `lineFormHtml()` |
| 12 | `collapseSection()` (exists, unruled) | 5+ | stamp it — new R-id |
| 13 | Tab-button shape | 4–5 shapes | one tab builder/rule |
| 14 | `.insp-thumb` thumbnail | 4 | `captureThumb()` |
| 15 | Record-ref chip (chat/held/focus) | 3 | extend `refPill()` |
| 16 | Month day-grid generation | 3 (21368, 21408, 21519) | one shared grid helper (date-search copies R16's look but not its code) |
| 17 | Health-border mini-card | 3 | one mini-card renderer |
| 18 | Count badge · chat bubbles · conversation rows · GPS degraded banner · tri-state toggle · charge/refund alloc mirrors · insert/remove affordances | 2–3 each | one builder each |

---

## 6 · Ghost CSS (verified)

> **PENDING ROUND 2** — the mechanical pass flagged 284 candidates out of 1,268 defined
> classes, but sample checks already caught false positives (dynamically-composed class
> names). Verified dead / alive / uncertain counts and the confirmed-dead list land here
> when the adversarial verification completes.

Confirmed dead weight found by inspection (independent of the class list):

| Item | Where | Weight |
|---|---|---|
| **Rye font loaded, never referenced** | index.html:18 | dead network request on every page load |
| APP-23 retired graph view | app.js:11445–11449 | comment-only banner (already gutted — confirm and drop the banner) |
| `prompt()` money-line fallbacks | app.js:21629–21646 | unreachable dead code (see Strays) |
| `.ru-plate` | style.css:2297 | referenced only by a "retired" comment — already fully removed |
| **KPI MASK** | style.css:5007–5009 | `blur(12px)` unconditionally masks `.kpi-ring/.big-ring/.menu-team-ring` app-wide — presumably the "Coming 2026" hold, but it also blanks the standalone KPI popup and logo-menu Team ring. Needs Jac's confirmation that all three are intentionally on ice |

---

## 7 · Round-2 fresh-lens findings

> **PENDING ROUND 2** — native-control sweep (beyond the strays above), emission-site
> coverage cross-check, other served files (icons.js, config.js, data.js…), and the
> completeness critic's verdict land here.

---

## 8 · Surface census — Jac's "check everything" list

| Surface | Verdict |
|---|---|
| **Popups** (47 kinds) | All cataloged in `WINDOW_CATALOG`, zero drift (verified twice). Shells homed via `popupShell`; ~19 hand-rolled foot pairs + 7 hand-rolled heads (Strays); `returnRating` custom shell is a documented exception |
| **Dropdowns** | `openDropdown`/`menu-dropdown` is a documented foundation (not R-numbered); gate-timeline (R1) homed; `.dd-item` rows hand-rolled 13+ sites; view-menu ✕ nested in a button |
| **Menus** (logo, tools, bell, ALL) | Ride `openDropdown` — homed at foundation level; triggers (`.iconbtn`) unhomed |
| **Right-click menu** | R20 `openCtxMenu` — homed; emoji icons violate icons.md |
| **Chats** | Team dock + Wrangler dock + comms conversation windows: action buttons branded (R17/R18/R30 stamped); bubbles, ref-chips, tabs, dots, gear/✕ unhomed (Strays/Mavericks above) |
| **Notifications** | Bell overlay + requests + transport-alerts popups BRANDED (clean `popupShell` uses); the transient `toast()` and `.sw-toast` are unhomed; comms status dots unhomed |
| **Headers** | App header: KPI rings canon (`RB_FOUNDATION`), chrome (logo/tabstrip/user) structural-unhomed; section headers R11 homed; 7 popup heads hand-rolled |
| **Footers** | Bottom bar `.iconbtn` family unhomed; footer jog R32 homed; popup foots — see Strays |
| **Invoices** | Embedded invoice card homed (R29 `invoiceStatMenu` + R2/R7/R17/R18); **the printable/emailable document itself (`invoiceDocHtml`) has no home** — headline maverick; one raw date input; payment-foot buttons hand-rolled |
| **Login screens** | Both (classic + phone-identity) are documented canon references (`.login-*`); `#reseed` recovery screen drifts from that canon and hides native dialogs |
| **Mobile** | Exactly ONE recurring homeless pattern (`.mcard-tog` card-switcher); everything else extends stamped rules or is legitimately out of scope |

---

## 9 · Notes for the fix queue (NOT fixed in this audit)

- Token discipline: hazard-stripe (~20×), dock gradient (~9×), ignition gradient (7×)
  literals; `.ca-panel` runs a bespoke un-themed palette; `#c2925a` raw where `--tan`
  exists; pervasive inline `style="font-size:…px"` in Settings/popup bodies. Documented
  exceptions stay: `.login-*`, `.pr-doc` paper palette, `.cmt-card` pastels, Stripe iframe.
- Two destructive-confirm idioms coexist (password gate vs arm-twice button, app.js:17658
  vs 17598) — needs a canon decision, not a silent fix.
- `select.lf-in` strips the native chevron without drawing a replacement (style.css:585) —
  possible zero-affordance dropdown; `select.inline-input` does it right.
- No `<noscript>` fallback in index.html (blank page if JS blocked — minor for an internal
  tool).
- `transportEditorHtml` stamps a whole panel `data-r="R5b"` (app.js:1521) — legal but odd
  Inspector labeling.
- `.bv-mini` "+Col" carries R5b's stamp without R5b's visual — stamp/visual mismatch.

---

## 10 · How this maps to the Figma Rulebook

The Figma reference catalog mirrors `RB_TABS` (the app's own IA): **Foundations · Surfaces ·
Containers · Pills & Flags · Fields & Adds · Actions · Upload & Capture · Data & Behaviors ·
Windows**. Every canon rule gets a plate (visual, R-id, builder, one-liner, do/don't, live
usage count from `rule-usage.js`). Every **maverick** from §4 rides its nearest family's
page wearing a hi-vis **NO HOME YET** flag; every rule plate lists its known **stray**
count ("hand-rolled twins: N") so the drift is visible next to the canon it drifts from.
