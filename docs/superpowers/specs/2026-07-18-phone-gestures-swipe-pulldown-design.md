# Phone gestures — swipe-to-toggle · pull-down-to-close · edge-back

**Date:** 2026-07-18
**Branch:** `claude/toggle-section-swiping-ipu032`
**Status:** Design — approved in brainstorming, pending written-spec review.

## Summary

Bring three native-app phone gestures to Rental Wrangler, borrowing the feel of
the shipped 5-card swipe rail. All three are **phone-only** (touch); desktop is
unchanged. They are three independent modules that happen to co-exist on one
surface (the comms sheet), so the bulk of the design is keeping their gestures
from fighting each other or the parent rail.

- **A · Swipe-to-toggle** — on `segCtl`-headed *view-switch* sections, swipe the
  body sideways to change tabs, with the orange R14 toggle riding the finger.
- **B · Pull-down-to-close** — drag a full-pane phone sheet down to dismiss it,
  scroll-aware so it never fights an inner list.
- **C · Left-edge back (comms)** — an iOS-style edge swipe steps the comms
  back-chain (chat → chat menu → exit).

Non-goals: desktop behavior (untouched), the graph-view chevron deck, small
centered confirm/color cards, and any `segCtl` that *sets a value or takes an
action* (see the exclusion list in §A.1). iOS has no Vibration API, so haptics
are best-effort reinforcement only, never the sole signal.

---

## A · Swipe-to-toggle

### A.1 Scope — which toggles

A swipe attaches **only** to `segCtl`-headed sections whose toggle switches which
*view/content* is shown — never to controls that set a value or fire an action.

**In scope (three):**

| Builder | Section | Tabs | State key |
|---|---|---|---|
| `funnelSectionHtml` | Customer funnel | Rental · Equipment Sales | `state.funnelTab[custId]` (`rental`/`usedSales`) |
| `customerInvoicesSection` | Customer invoices | Open · All · Transactions | `state.custInvView[custId]` (`open`/`all`/`transactions`) |
| comms customer sheet | Comms | Text · Email | `commsCustCh` (`text`/`email`) |

**Explicitly excluded** (share the `.seg` shape but are controls, not views — a
swipe must never trigger them): transport leg type (`js-ttype`), inspection
Pass/Not Ready/Fail (`js-cond`), vendor Exempt/Taxed, coverage Insured/Uninsured,
KPI band, checklist Pass/Fail, and every Settings on/off toggle. The mechanism is
**opt-in per section**, so no `.seg` is swept in automatically. The GPS Round-up /
Fleet-map / Utilization and Transport-Alerts window toggles are *eligible* view-
switches but were deferred (Jac, 2026-07-18) — keep the first cut to the three.

### A.2 Mechanism — render-all-panes carousel

Desktop stays byte-identical to today: one active pane, tap the toggle
(`render()`). On phone the section becomes a **swipe deck**:

- A reusable builder emits `.funnel-body`→`.swipe-deck` wrapping a `.swipe-track`
  (nested horizontal `scroll-snap-type: x mandatory`, scrollbar hidden) that holds
  **all** panes as `.swipe-pane` (`flex: 0 0 100%; scroll-snap-align: start`).
  Rendering all panes is what makes the slide real; verified safe — the funnel's
  next-actions are scope-independent, and `.inv-sec` stays a single instance (the
  deck wraps its sub-bodies, and the `+Invoice` drag-pill is emitted once, outside
  the panes).
- The R14 toggle becomes a **thumb variant** (`.seg.swipe-seg` + one `.seg-thumb`).
  The orange fill is the thumb, width `calc(100% / var(--seg-n))`; a scroll listener
  sets `thumb.style.transform = translateX(ratio * (n-1) * 100%)` where
  `ratio = scrollLeft / (scrollWidth - clientWidth)`. Buttons carry no per-button
  fill; they flip ink (`on-accent`) at the rounded index. This keeps the ONE-orange
  law (R3): the thumb is the single selected-tab fill.
- **State syncs on snap, no re-render** — exactly how `syncMobileColFromScroll`
  keeps `mobileCol` honest. An rAF-throttled listener (class-filtered to
  `.swipe-track`) computes the index; on change it writes the section's state key
  (via a small `swipeDeckCommit(kind, recId, idx)` dispatcher) and fires
  `haptic(8)`. No `render()` — the target pane is already visible via scroll.
- **Tab tap** (`js-swipe-tab`, phone-only class) smooth-scrolls the track to that
  pane (`scrollTo({behavior:'smooth'})`); the snap listener then commits state.
  Desktop buttons keep their existing `js-funnel-tab`/`js-inv-view`/comms handlers.
- **On render**, position each `.swipe-track` to its active pane instantly
  (`scrollLeft = activeIdx * clientWidth`) and paint the thumb — mirrors the rail's
  post-render `scrollLeft` set.

### A.3 Nesting inside the 5-card rail

The phone grid is itself a native scroll-snap rail. A `.swipe-track` nests inside
one card and must not move it:

- The rail's scroll-sync listener is **class-filtered to `.grid`**
  (`e.target.classList.contains('grid')`), so a `.swipe-track` scroll never
  triggers `syncMobileColFromScroll`. Our listener is symmetrically filtered to
  `.swipe-track`.
- Native nested scrolling: the inner track consumes the horizontal pan while it can
  scroll; at its edge the parent rail takes over on the next gesture. Panes of
  differing heights are acceptable (track height = tallest pane; the card body
  scrolls vertically as today).

### A.4 Rulebook

New **R36 — "Swipe-toggle deck"**: the phone-only carousel that turns a view-switch
`segCtl` section into a swipeable deck (thumb rides the scroll; state on snap;
nests in the rail). Stamp the deck root `data-r="R36"`. Update `RULE_META`,
`RB_TABS`, and add a presence-detector to `ci/gen-rule-usage.mjs`. `.seg` keeps its
R14 stamp. No new popup → no `WINDOW_CATALOG` change.

---

## B · Pull-down-to-close

### B.1 Scope

Every **full-pane phone sheet**: the comms full-screen (`.mcomms`), full-pane
overlays (`.overlay .popup` in phone sheet mode), the winpicker, and the
chat/wrangler dock sheets. Not small centered cards.

### B.2 Mechanism

A pointer handler on the §15 conventions (tap-vs-drag threshold preserved):

- The sheet **follows the finger**: `transform: translateY(dy)`, rubber-banded
  (`dy * ~0.7`), only downward. Under a distance threshold (~120px) **and** without
  a downward flick, it snaps back (`translateY(0)`, transition on). Past the
  threshold **or** on a downward velocity flick, it commits.
- **Commit = close the surface outright** via a new `closePhoneSheet()` that fully
  dismisses the top sheet (for comms, exit the category regardless of thread/inbox
  level — distinct from the step-back chain). It respects `overlayLocked()` — a
  required modal (e.g. rate-the-return) refuses and snaps back with the existing
  `attnFlash`.
- No visible grabber handle, no haptic (Jac's picks).

### B.3 Scroll-arbitration (both ways)

The drag engages when **either**:
1. it starts on the sheet's **header/title chrome** (always — the header is the
   implicit grab zone), **or**
2. it starts in the body **and** the active scroll region is at the top
   (`scrollTop <= 0`) and the motion is downward.

Otherwise the touch is left to native vertical scroll. Once engaged from the body,
if the user reverses upward the drag releases back to scroll. `touch-action` on the
sheet vs. its scroller is load-bearing (own the sheet drag; leave `pan-y` on the
list).

---

## C · Left-edge back (comms)

> **Implementation update (2026-07-18, device review).** A *custom* edge-swipe
> handler was built as below but fought iOS Safari's native edge-swipe (which
> fires a browser `back`) — on device it went to the Home Screen **then** the
> chat menu (double action + history over-pop). It was **removed**: the app
> already traps the browser back-swipe via `syncBackGuard`'s pushed history
> entry + the `popstate` handler → `dismissTopSheet` (thread→inbox→exit), which
> **is** exactly iOS's native left-edge-swipe. So Feature C now rides that
> existing guard — no custom gesture, no OS conflict. The C.2 design below is
> retained for the record.

### C.1 Scope

While a **comms** surface is open on phone (any type — Team · Customers · Mr.
Wrangler), a swipe **from the left screen edge** = back one step. In addition to
pull-down (which closes outright); the edge swipe *navigates*.

### C.2 Mechanism

- A left **edge-zone** (~24px from the screen's left) arms the gesture on
  `pointerdown`; a rightward drag past a small threshold (or flick) commits.
- Commit calls the existing **`dismissTopSheet()`** step-chain: a thread backs to
  its inbox (`s.lastOpen = null; s.menuOpen = true`), and from the inbox it exits
  the category (`commsLeaveCat`). "Do it again and you've exited" falls out for
  free.
- The edge-zone reservation is what disambiguates C from A on the comms **menu**
  (where the Text/Email carousel is live): a swipe that *starts* in the left ~24px
  is back; a swipe starting mid-screen is the channel carousel.

---

## Gesture arbitration (the comms sheet is the crucible)

One surface, four gestures — resolved by **start position + axis**:

| Gesture | Trigger | Result |
|---|---|---|
| **Edge-back (C)** | pointerdown in left ~24px, drag right | step back (`dismissTopSheet`) |
| **Channel swipe (A)** | horizontal drag starting mid-screen (on the deck) | Text ↔ Email |
| **List scroll** | vertical drag, list not at top | native scroll |
| **Pull-close (B)** | vertical drag down from header, or from body at `scrollTop<=0` | `closePhoneSheet` |

Priority on `pointerdown`: edge-zone → (then by dominant axis) horizontal =
carousel, vertical-down eligible = pull-close, else = scroll. A gesture locks to
one interpretation once its axis/threshold resolves, so they never interleave.

---

## Data / state

No persisted-schema changes. Reuses existing keys: `state.funnelTab`,
`state.custInvView`, `commsCustCh`/`commsRail`. New in-memory only: transient drag
state for B/C. `swipeDeckCommit` writes the same keys the tap handlers already do,
so cross-device resume and everything keyed off them stays honest.

## Rulebook / CI / gates

- Add **R36** (`RULE_META` + `RB_TABS` + `gen-rule-usage.mjs` detector); regenerate
  `rule-usage.js`.
- Gates: `node ci/smoke.mjs`, `node ci/logic-test.mjs`,
  `node ci/gen-rule-usage.mjs --check`, `node ci/check-window-catalog.mjs`,
  `node tools/gen-code-map.mjs --check`, plus the pure-Node lease/promote suites.
  Zero R0 lint. Cache-bust `?v=` on deploy.

## Verification

- `webapp-testing` at a phone context (390×844, `hasTouch`, `isMobile`) + 320px:
  assert a tap still fires the toggle; a horizontal drag switches the pane and the
  thumb tracks; a vertical drag scrolls; a header pull-down dismisses; an at-top
  body pull-down dismisses but a mid-list one scrolls; a left-edge swipe steps the
  comms back-chain. Assert no horizontal page overflow, visible focus, reduced-
  motion steady states, and that `haptic()` calls exist + are guarded.
- Cloud can't drive github.io headless — staging verification is served-bytes
  (`curl … | grep ?v=`) + the phone-context `webapp-testing` drive on a local/mock
  backend; the real on-device swipe/pull is Jac on a phone.

## Risks / open questions

- **Nested scroll-snap on the comms sheet** (horizontal carousel + vertical list +
  pull-down) is the highest-risk interaction; budget for a `webapp-testing` pass
  and a Jac on-device check before promote.
- **Differing pane heights** in the funnel/invoices decks leave blank space under
  the shorter pane — acceptable; revisit an animated deck height only if it reads
  wrong.
- **Pull-down from an open comms chat** closes the whole surface (not back to the
  menu) — by design (pull = dismiss, edge = navigate). Flag for Jac to confirm on
  device.
