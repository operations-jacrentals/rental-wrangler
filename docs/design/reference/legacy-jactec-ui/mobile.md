# Mobile — viewport, reflow & touch (Rental Wrangler SPA)

Everything for making `index.html` / `app.js` / `style.css` work on a phone. Three
domains, folded from the former `mobile-viewport`, `mobile-navigation`, and
`mobile-touch` skills. Mobile is a **reflow of the yard data-plate language, not a
re-theme** — keep tokens, rules, and the signature intact. Verify every change with the
`webapp-testing` skill at a phone context.

---

# 1 · Viewport & Ratio

Rules for making the app sit correctly inside a phone's *actual* usable rectangle — not
the lie that is `100vh`.

## The viewport meta (do this first)
`index.html` must declare:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```
`viewport-fit=cover` is required or `env(safe-area-inset-*)` is always `0`. Check it's
present before touching CSS.

## Height: never `100vh` on mobile
Mobile browser toolbars expand/collapse, so `100vh` is taller than the visible area —
fixed/full-height surfaces get clipped under the URL bar.
- Full-height surfaces (login, overlays, the chat dock sheet, the winpicker): use
  **`100dvh`** (dynamic viewport height).
- `svh` (smallest) for things that must never be hidden by chrome; `lvh` (largest)
  rarely. Pattern: `min-height: 100svh;` for a hero, `height: 100dvh;` for a sheet.
- Provide a fallback: `height: 100vh; height: 100dvh;` (older engines take the first).

## Safe-area insets (notch + home indicator)
Anything pinned to an edge must pad by the inset or it lands under the notch / home bar.
- Bottom bar (`.bottombar`), chat dock (`.chat-dock`), drop pad (`.chat-drop`),
  cancel-arc: add `padding-bottom: max(<base>, env(safe-area-inset-bottom));` and offset
  `bottom:` by the inset.
- Use `max()` so desktop (inset 0) keeps the base padding.
- Top sticky headers: `padding-top: env(safe-area-inset-top)`.

## Aspect-ratio (kill layout shift)
Use the `aspect-ratio` property for any media/thumbnail/avatar box so it reserves space
before content loads — never hard-code height that breaks at another width. Example:
`.cav { aspect-ratio: 1; }` (already square via width/height — prefer `aspect-ratio`
when only one dimension is known).

## Orientation
Landscape phones are *short*. Anything capped by height (the chat dock uses
`max-height: min(74vh,660px)`) should use `dvh` and stay scrollable. Don't lock
orientation. Test both.

## No horizontal overflow
The 3-column `.grid` cannot fit a phone — it MUST reflow to one column (see §2). Until it
does, a phone shows a sideways-scrolling mess. Guard fl/grid children with
`min-width: 0` so long text/pills wrap instead of pushing width. Add a debug check:
nothing should make `document.scrollingElement.scrollWidth > clientWidth`.

## Touch-target floor
Interactive elements need ≥ **44×44 px** (Apple) / 48 (Material) hit area, even if the
glyph is smaller (use padding or a `::before` expander). Audit on phone: `.iconbtn`,
`.pill.gate`, `.row .rbtn`, the chat `.rtab`, tag `×` buttons, the `.cmt-dot` pickers.

## Verify
Drive the `webapp-testing` skill at a phone context, e.g.
`browser.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:3, isMobile:true,
hasTouch:true })`, then assert no horizontal scroll, screenshot portrait + landscape,
and confirm the bottom bar clears the home indicator.

## Don't
- Don't use `vh` for sheets/overlays. Don't pin to an edge without a safe-area pad.
- Don't gate actions behind `:hover` (no hover on touch — see §3).
- Keep the yard data-plate language; mobile is a reflow, not a re-theme.

---

# 2 · Navigation & Reflow

How the desktop "yard" reshapes onto one narrow screen without losing the model.

## The core problem: 3 columns → 1
Desktop shows `COLUMNS` (left/middle/right) side by side, each painting one active
member card (`columnEl`). A phone fits **one column at a time**.

**Recommended model — single active column + a switcher** (reuses the existing
column-member concept, so the engine/anchor/cascade stay untouched):
- Render only the active column on phones; the other two collapse.
- Add a top **segmented switcher** (Left · Middle · Right, or icons:
  Yard · Rentals · Office) that sets which column is visible. State lives next to
  `activeSession().cols`.
- A link pill that targets another column switches to it (the `revealCol` path already
  exists — extend it to also flip the visible column on mobile).
- Keep within-column tabs (the `.js-tab` strip) for switching the member/record.

Avoid a long vertical stack of all three columns — it buries the middle/right work and
loses the "three workstations" mental model.

## Bottom bar (`.bottombar`)
Stays a bottom nav. On phone: icon-only (drop the labels on the left actions), allow it
to wrap or horizontally scroll if it overflows, and pad it by
`env(safe-area-inset-bottom)` (see §1). The chat launcher + badge stay.

## Overlays, winpicker, chat dock → sheets
Floating popups don't work at 360px. On phones:
- **Overlays** (`.popup` in `.overlay`): become a full-screen or bottom sheet
  (`height: 100dvh` or `max-height: 92dvh; border-radius: 18px 18px 0 0`). The comment
  color-flood card can stay a centered card (it's small).
- **Winpicker** (calendar): full-screen sheet — the day grid needs the width.
- **Chat dock** (`.chat-dock`): already goes near-full-width under 560px; on phones make
  it a **bottom sheet** that slides up to ~92dvh, with the tag rail pinned top and the
  role tab-bar + compose pinned bottom. The drop-pad / cancel-arc already live at the
  bottom — keep them above the safe-area inset.

## Back / dismiss behavior
One predictable "back" affordance. The Esc/back chain should close in order:
overlay → winpicker → open sheet/dock → (then a browser back leaves). Wire the Android
back gesture / a top-left chevron to the same chain. Don't trap the user in a sheet with
no visible close.

## Scroll discipline
- One primary scroll region per screen (the active card body). Avoid nested scrollers
  that fight; if a sheet scrolls, the page behind must not (`overflow:hidden` on body
  while a sheet is open).
- Sticky section headers inside long cards so context survives scrolling.

## Quality floor
Responsive down to 320px, visible focus, reduced-motion respected, every action
reachable by tap (nothing hover-only). Keep the data-plate language and verify with
`webapp-testing` at 390×844 + 320px.

---

# 3 · Touch & Haptics

Input (gestures) and feedback (haptics) for the phone. The app already has a pointer-
based drag engine in `app.js` (§15) — extend its conventions, don't reinvent them.

## Gesture model (already in place — follow it)
- **Tap vs drag.** A press *arms* a drag; it only *starts* past a threshold:
  mouse = move > 6px (`dragMove`), touch = a **400ms long-press** (`dragDown` sets
  `armed.lp`). A tap (no move / released early) falls through to the element's click.
  So every interactive element is **tap = its action, long-press/drag = grab**. New
  draggables (`[data-chat-el]`, rows) inherit this for free.
- **`touch-action` is load-bearing.** Rows are `touch-action: pan-y` so vertical
  scrolling stays native and only a *lifted* row drags. Set `touch-action` deliberately:
  `pan-y` for vertical lists, `none` only on elements you fully own, `manipulation` on
  buttons to kill the 300ms double-tap-zoom delay.
- **Don't let the browser steal it.** A touch-scroll fires `pointercancel` → the drag
  must cancel cleanly (already wired in `initDrag`). The first `touchmove` after a
  long-press lift is `preventDefault`-ed (passive:false), gated on `DRAG.active`, so the
  page doesn't pan mid-drag. Preserve this when adding gestures.
- **Long-press also pops the native context menu** — it's suppressed during
  `DRAG.active || DRAG.armed` (`contextmenu` capture handler). Keep that.
- **No hover.** Touch has no hover. Never hide an action behind `:hover` (row actions,
  previews, the `×` on tags must be tap-visible). Hover previews are a desktop bonus.

## Swipe (optional, additive)
- Swipe left/right on the column area → the column switcher (see §2).
- Swipe-down on a sheet/dock header → dismiss. Implement on top of the pointer stream
  (track dx/dy from `pointerdown`; commit past ~60px), and respect `touch-action` so it
  doesn't fight the scroll.

## Haptics (Vibration API)
Feedback for committing gestures. **Best-effort only** — `navigator.vibrate` works on
Android/Chrome; **iOS Safari does not support it**, so never rely on it for meaning.

Add one guarded helper to `app.js` and call it from action sites:
```js
// state.hapticsOff defaults to false; gate behind support + reduced-motion + setting
function haptic(p) {
  if (state.hapticsOff || !('vibrate' in navigator)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { navigator.vibrate(p); } catch (e) {}
}
```
Vocabulary (keep it subtle — a tick, not a buzz):
- `haptic(8)` — light tap: ignition button press, status pill advance.
- `haptic([12, 30, 12])` — success: chat posted, record completed, drop accepted.
- `haptic([35, 25, 35])` — abort/danger: "release to cancel" on the cancel-arc.
- `haptic(10)` — drop-pad "release to start a chat" arm, tag added.

Hook points: `dragUp` (distinguish cancel vs drop vs new-chat), the cancel-arc/drop-pad
`hot` transition (a tick when it lights), `chatSend`, `Complete WO/Rental`, ignition
primary buttons. Give the user an off switch (a `state.hapticsOff` toggle in the bottom
bar or settings) and persist it.

## Don't
- Don't add a haptic to passive/scroll events or fire on every pointermove (annoying +
  battery). One pulse per committed action.
- Don't assume haptics fired (iOS) — they're reinforcement, never the only signal.
- Don't break the tap-vs-drag threshold; test that a quick tap still triggers the click.

## Verify
With `webapp-testing`, use a `hasTouch: true, isMobile: true` context and drive
`page.touchscreen` / pointer events: assert a tap fires the click, a long-press starts a
drag, and a scroll does NOT. Haptics can't be asserted headless — verify the `haptic()`
calls exist at the right sites and are guarded.
