# Tier-0.1 card — group head + item row design log (2026-07-31)

Full trail for the head/row redesign session: what was tried, what was **rejected and why**,
what was **measured**, and the CSS for every state so any of them can be re-injected or
reverted to. The work was explored by runtime CSS/JS injection against the prototype and is
recorded here because the scratchpad that held it is ephemeral. **R2→P1 has since been landed
in the prototype itself (§5.8)** — so the artifact and the ledger now agree, which they did not
for most of this session.

Prototype: `docs/design/tier-01-card/index.html`. Ledger:
`docs/superpowers/specs/2026-07-20-decisions-ledger.md` (read to the end — #101+ supersede
parts of the #1–100 snapshot).

---

## 0 · Revert points

Each state is additive on the one above. **R2→P1 are all in the prototype now (§5.8)** — the §5
CSS blocks below stay authoritative for *reverting to an intermediate state*, which is still done by
injecting up to the named stage against a `git checkout`-clean prototype.

| # | State | Where it lives |
|---|---|---|
| **R0** | Prototype as it stands on `trunk` — old head (chevron + corner Pin), old rows (pins) | `origin/trunk` |
| **R1** | + group rename `Not Ready/Failed+Reserved` → `Reserved: Not Ready` | **committed** — PR #785, branch `claude/tier-01-card-audit-crnxj3` |
| **R2** | + etched title panel at 17px / 9.5px type, chevron dropped | §5.1 |
| **R3** | + deep milled pocket at 26px / 12.5px type, 2px right gap | §5.2 |
| **R4** | + hue-carrying letter faces, open/shut on the pocket floor | §5.3 — **the settled head** |
| **R5** | + pins removed for slots; collapsed slot opens LEFT; no brackets | §5.4 |
| **R6** | + row slot rack and row message board | §5.5 |
| **R7** | + row order `message board · button · slots · facts · name` | §5.6 |
| **P1** | Two-level housing/cartridge architecture | §5.7 — **RULED AND BUILT** (ledger #168–#173) |
| **L** | R2→P1 **landed in the prototype** — the only state other than R1 that is in git | §5.8 — **latest state; `git checkout` the prototype to revert** |

To revert to any state, apply §5 blocks up to that row and stop.

---

## 1 · What was rejected, and why

Recorded so none of it gets re-proposed.

| Rejected | Reason |
|---|---|
| **Digital-box row buttons** (opaque fill in the signal hue, "AI-slop screen" look) | Jac: *"I don't like the new buttons so keep our current design with pins."* Also broke a locked state function — see §3.1. |
| **Domed / bubble lamp** open-shut indicator on the head | Jac: *"the bubble light indicator is cool but too distractor."* |
| **Chevron** on the group head | Dropped when the title became an etched panel. The open/shut read moved to the pocket floor tint. |
| **Incised (cut-in) letter faces** | Jac's reference showed the opposite physics — see §3.2. |
| **Brackets `[ ]` around the slot rack** | Jac: *"Drop the []."* The [Bracket] idea was liked but has no home yet. |
| **Head corner Pin** | Duplicated the count already stamped beside the rack. |
| **Row pins** | Superseded by the slot rack, which shows the same issues separated by hue instead of summed to a numeral. |
| **Collapsed slot opening RIGHT** | Jac: opens **LEFT**. Right-opening ran off the card edge. |
| **Laser frame as the open/shut indicator** | Proved not to carry it — see §2.1. |

---

## 2 · Measurements and proofs

These are the load-bearing facts. Each one closed a question that argument alone couldn't.

### 2.1 The laser frame does not carry open/shut
It wraps the band whether the group is open or shut, so it cannot signal state. Open/shut is
already evident from whether rows are visible. **The indicator's job is affordance, not
status** — that reframing is what let the chevron and the lamp both go.

### 2.2 Hue cannot also carry open/shut
With the letter faces taking the state hue, brightness was the obvious open/shut channel.
It doesn't have the range: **red fails 4.5:1 below ~76%** of its open value. Every other hue
has more headroom, but the shut set has to be uniform, so the binding constraint is the
**maximum** across hues (red's 76%), not the minimum. 76% is too shallow to read as a state
change on its own — hence open/shut moved to the **pocket floor** tint (§5.3), which is
non-text and only owes 3:1.

> Got this wrong twice mid-session by taking the *minimum* (57%). The shared factor is set by
> the **worst-case** hue, so it is always the max.

### 2.3 The message board needs steel under it
The board is a well — it only reads as one against a lighter ground. Measured:
- vs head steel: **4.64× darker** → reads correctly as a recess
- vs the open-row ground: **1.38× lighter** → inverts, and disappears

So a row message board requires the row to keep a steel ground, or the board needs a
different material treatment entirely. This is the open question behind Jac's *"Do we change
the message board style even tho it's in the dropdown digital screen?"*

### 2.4 The row budget is oversubscribed
The card is locked at **380px** (357px interior) at **every** viewport from 440–560px — it
does not flex. All five row elements do not fit. **Facts drop first**, which is already the
specced behaviour (#162 makes them width-conditional).

### 2.5 The head rack's 8-tick cap is not about ticks
`atom-rebuild.md §1`: *"the message board still sits beside the empty rack space (rack width
is reserved by the board's fixed 114px, not by ticks)."* The cap exists because the board
reserves fixed width. **Free the board and the cap goes** — which is what makes the
right-condensed head in §6 able to run slots at full width.

### 2.6 Converting the button to a verb reclaims ~22px — but NOT enough to fit facts
#155 sizes the state chip to the longest **state** — `Service due`, 11 characters, 93px.
Verbs are shorter (`Reassign`, 8ch). That's roughly **22px** back.

> ⚠️ **CORRECTED 2026-07-31 by measurement — the second half of this claim was wrong.** It read
> *"which is most of what the facts column needs… the cheapest way to fit the row."* It is not.
>
> | Measured | Result |
> |---|---|
> | #155's formula reproduced | `max(66, 11 × 7.15 + 14)` = **93px** — exactly what the card renders ✅ |
> | Swapping chip **text** to verbs | **0px reclaimed.** The chip is an inline `width:93px; flex:0 0 auto` — a *fixed column*. The saving is only real if `stateW` is **recomputed** against the verb set. |
> | `stateW` recomputed for verbs (8ch) | **71px — 22px reclaimed** ✅ the arithmetic holds |
> | Name column with facts restored at 71px | **40–48px** |
> | Width `Excavator 12k` actually needs | **103px** |
>
> So facts still cannot come back: the name would be cut to **under half** of what it needs.
> And there is a **hard ceiling** — #155's own `max(66, …)` floor means the chip can never go
> below **66px**, so the largest possible reclaim from *any* verb set is **27px**, against a
> ~59px shortfall. **No choice of wording makes facts fit at 380px.**
>
> **Consequence: do the verb conversion on its own merit** — it is the locked #158 pattern and it
> removes the §5.7.3 duplication — **not as a width fix.** Facts stay dropped at 380px, which is
> what #162 already specifies. Fitting facts needs a wider column (Tier 0.2), not shorter words.

### 2.7 Row issue data already exists
No new data model is needed for row slots. The issues are already in the old pin's tooltip.

> ⚠️ **The `data-tip || data-hint` shorthand here is NOT literally true of this build — see §5.7.**
> `data-tip` does not exist at all (`querySelectorAll('[data-tip]').length === 0`); all 66 hints are
> `data-hint`, and the issue **list** is on the row's **`.pin[data-hint]`**, newline-separated as
> `Source, State, Date`. Building against this sentence as written yields a one-tick rack.

---

## 3 · Mistakes made, and the corrections

Logged because two of them are easy to repeat.

### 3.1 A hue-keyed fill silently deleted a locked state function
The first digital-box cut coloured the box by hue alone. That made `signal--filled` and
`signal--outline` render identically — deleting **`colour = state, fill = today`**, which is
locked. Fix: change only `--filled` (hue tint), leave `--outline` untouched.
**Any treatment that keys on hue must be checked against the fill channel.**

### 3.2 Raised vs incised is decided by the *outer* shadow
Built the letters cut INTO the plate; Jac's reference (the footer scroll pips) showed the
opposite — **letter faces stay at the original steel level, the steel around them is etched
away**. The proof is in the pip's own recipe: an outer `0 1px 2px rgba(0,0,0,.6)` cast
shadow. **A recess cannot cast a shadow outward.**
- **Raised** = highlight ABOVE + cast shadow BELOW
- **Incised** = shadow ABOVE + highlight BELOW

### 3.3 Environment and CSS gotchas
| Symptom | Cause | Fix |
|---|---|---|
| Row rack renders empty | Read only `data-tip`; rows use `data-hint` | `data-tip \|\| data-hint` |
| Inline `display:none` ignored | Lost to a stylesheet `!important` | Use a class (`.pin-gone`), not inline style |
| `.ref` stuck at 152px | Card ships `.ref{width:152px!important;flex:none!important}` from a **runtime-injected** sheet that lands *after* the injected one — equal specificity loses on source order | Out-specify: `[data-row] .ref` |
| `+N` read backwards | Left-opening tray inverts reading order | Put `+N` on the slot-side end |
| Wrong pixels sampled when measuring | Sampled by coordinate | Sample by element bounding rect |
| Shell dies, exit 144 | `pkill -f "serve.mjs"` matches its own command string | `fuser -k 9147/tcp` |

---

## 4 · Harness

- Serve the prototype on **port 9147** (8000 is reserved).
- Playwright **must** use
  `executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'`
  — the plain chromium-1194 removed `--headless=old` and dies. Environment quirk; never
  modify a `ci/` file for it.
- Viewport `440×1700`; `deviceScaleFactor: 3.4` for detail crops, `1.5` for full-card.
- Wait ~2600ms after `networkidle` before injecting — the card boots asynchronously.
- Iterate by **injection only**. Do not edit the prototype to explore.

Hue map used throughout:

```js
function hue(label){ const s = label.toLowerCase();
  if (/overdue|failed|fail|damage|breakdown/.test(s)) return '#ff4242';
  if (/service due|needs wash|open|promised|due/.test(s)) return '#eed44b';
  if (/transport|truck|pickup|reserved/.test(s))     return '#6394cc';
  if (/available|complete|passed|paid/.test(s))       return '#34d399';
  return '#8a94a2'; }
```

Marking open/shut (the prototype has no attribute for it — derive from the chevron transform
before hiding it):

```js
document.querySelectorAll('.gate').forEach(g => {
  const c = g.querySelector('.gate__chev');
  const t = c ? getComputedStyle(c).transform : 'none';
  g.setAttribute('data-open', (t !== 'none' && !/^matrix\(1,\s*0,\s*0,\s*1/.test(t)) ? '0' : '1');
});
```

---

## 5 · The CSS, by revert point

Common preamble (name treatment + row height) used by every state from R2 on:

```css
.ref{background:none!important;background-color:transparent!important;background-image:none!important;
     box-shadow:none!important;border:0!important;clip-path:none!important;width:auto!important;
     flex:1 1 auto!important;min-width:0!important;padding-left:0!important;}
.ref__icon{width:12px!important;height:12px!important;background:transparent!important;opacity:.45!important;}
.rmq{font-family:'Archivo',sans-serif!important;font-weight:700!important;font-size:15px!important;
     letter-spacing:-.005em!important;color:#eef2f7!important;}
[data-row]>div{height:34px!important;}
```

### 5.1 R2 — etched panel, 17px
The first correct-physics state: raised faces in an etched-away field, chevron gone. Fits 25
characters, so it clears every group name. Superseded by R3 on Jac's *"increase the milled
space… near the full height of the group."* Kept as a revert point because it is the only
size that never needed the rename.

Same recipe as §5.2 with `height:17px`, `font-size:9.5px`, `padding:0 8px`, and the clip-path
corners at `5px`.

### 5.2 R3 — deep milled pocket, 26px
Near the full height of the group head, with a thick bevel top/right/bottom. Chosen from a
22 / 26 / 29px trial. Fits 19 characters — which is exactly why R1 (the rename) had to land
first.

```css
.scp1{padding-right:2px!important;}            /* right gap matched to the 2px above/below */
.scp1 .pin{display:none!important;}            /* head corner Pin — duplicated the count */
.gate{height:26px!important;padding:0 11px!important;margin-right:0!important;
  background:linear-gradient(#080d14 0%, #0b111a 62%, #0d141d 100%)!important;
  background-color:#0a0f16!important;
  clip-path:polygon(8px 0,100% 0,100% calc(100% - 8px),calc(100% - 8px) 100%,0 100%,0 8px)!important;
  box-shadow:
    inset 0 6px 7px -1px rgba(0,0,6,.96),      /* deep top shade — the pocket's back wall */
    inset 0 2px 0 rgba(0,0,8,.9),
    inset -3px 0 0 rgba(0,0,8,.72),            /* right wall */
    inset -8px 0 9px -4px rgba(0,0,6,.85),
    inset 0 -8px 9px -5px rgba(0,0,6,.5),
    inset 0 -2px 0 rgba(198,218,248,.22),      /* bottom rim catches light = floor is BELOW */
    inset -3px -2px 0 rgba(198,218,248,.10)!important;
  border:0!important;display:inline-flex!important;align-items:center!important;
  overflow:hidden!important;}
.gate__chev{display:none!important;}
.gate .sc-interp{font-family:ui-monospace,'Cascadia Code',Menlo,Consolas,monospace!important;
  font-size:12.5px!important;font-weight:800!important;letter-spacing:.04em!important;
  text-transform:uppercase!important;overflow:hidden!important;
  text-overflow:ellipsis!important;white-space:nowrap!important;}
```

### 5.3 R4 — hue faces + floor tint (the settled head)
Faces take the state hue. The top rim highlight is tinted toward each hue's light end so it
reads as **painted steel**, not white text in colour. Open/shut lives on the pocket floor
(§2.2).

```css
/* letter faces — OPEN */
.gate--red    .sc-interp{color:#ff8080!important;text-shadow:0 -1px 0 rgba(255,196,196,.30), 0 1px 2px rgba(0,0,4,.95)!important;}
.gate--yellow .sc-interp{color:#f2dc6a!important;text-shadow:0 -1px 0 rgba(255,244,190,.30), 0 1px 2px rgba(0,0,4,.95)!important;}
.gate--blue   .sc-interp{color:#9dbfe4!important;text-shadow:0 -1px 0 rgba(206,228,250,.30), 0 1px 2px rgba(0,0,4,.95)!important;}
.gate--green  .sc-interp{color:#5ee0ab!important;text-shadow:0 -1px 0 rgba(186,246,220,.30), 0 1px 2px rgba(0,0,4,.95)!important;}
.gate--gray   .sc-interp{color:#c2ccd8!important;text-shadow:0 -1px 0 rgba(226,236,248,.28), 0 1px 2px rgba(0,0,4,.95)!important;}

/* letter faces — SHUT, at 76% (red sets the floor, see §2.2) */
.gate--red[data-open="0"]    .sc-interp{color:#c26161!important;}
.gate--yellow[data-open="0"] .sc-interp{color:#b8a751!important;}
.gate--blue[data-open="0"]   .sc-interp{color:#7791ad!important;}
.gate--green[data-open="0"]  .sc-interp{color:#47aa82!important;}
.gate--gray[data-open="0"]   .sc-interp{color:#939ba4!important;}

/* pocket floor — carries OPEN (non-text, owes 3:1 not 4.5:1) */
.gate--red[data-open="1"]   {background:linear-gradient(rgba(255,66,66,.26),rgba(255,66,66,.09))!important;}
.gate--yellow[data-open="1"]{background:linear-gradient(rgba(238,212,75,.24),rgba(238,212,75,.08))!important;}
.gate--blue[data-open="1"]  {background:linear-gradient(rgba(99,148,204,.28),rgba(99,148,204,.10))!important;}
.gate--green[data-open="1"] {background:linear-gradient(rgba(52,211,153,.24),rgba(52,211,153,.09))!important;}
.gate--gray[data-open="1"]  {background:linear-gradient(rgba(170,180,193,.20),rgba(170,180,193,.07))!important;}
```

Three variants were rendered; **C3** (faces dim AND floor tints) was the one carried forward.
C1 = floor only, C2 = faces only.

### 5.4 R5 — pins out, slots in; collapsed slot opens LEFT

```css
.seg,.seg__opt,[data-row],[data-row]>div{overflow:visible!important;}

/* the tick — the slot atom */
.rw-tick{flex:0 0 auto;width:6px;height:12px;transform:skewX(19deg);border-radius:1.5px;cursor:pointer;
  background-image:linear-gradient(rgba(255,255,255,.20), rgba(255,255,255,.04) 42%, rgba(0,0,0,.28));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.24), inset 0 -1.5px 2px rgba(0,0,0,.45),
             0 1px 2px rgba(0,0,0,.6);}   /* the outer shadow is what makes it RAISED */
.rw-rack{flex:0 0 auto!important;display:flex!important;align-items:center!important;
  gap:2.5px!important;margin-left:2px!important;}
.rw-more{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:9px;color:#838e9c;margin-left:1px;}

/* collapsed slot — a skewed cell that unfurls LEFT on hover, up to 10 ticks */
.pin{width:auto!important;min-width:17px!important;height:13px!important;border-radius:1.5px!important;
  transform:skewX(19deg)!important;padding:0 3px!important;cursor:pointer!important;
  display:inline-flex!important;align-items:center!important;justify-content:center!important;
  background-image:linear-gradient(rgba(255,255,255,.20),rgba(255,255,255,.04) 42%,rgba(0,0,0,.28))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.24),inset 0 -1.5px 2px rgba(0,0,0,.45),0 1px 2px rgba(0,0,0,.6)!important;}
.pin .sc-interp{display:inline-block!important;transform:skewX(-19deg)!important;   /* counter-skew the numeral */
  font-family:ui-monospace,Menlo,Consolas,monospace!important;font-size:8.5px!important;
  font-weight:800!important;line-height:1!important;color:#0a0f14!important;}
.pin--red .sc-interp,.pin--blue .sc-interp{color:#fff!important;}
.pin.pin-gone{display:none!important;}     /* class, not inline — see §3.3 */

.pin-open{position:absolute;display:flex;align-items:center;gap:2.5px;height:16px;z-index:40;
  pointer-events:none;background:#070c11;box-shadow:0 0 0 1px #1d2630, 0 3px 10px rgba(0,0,0,.72);padding:0 5px;}
.pin-open .more{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:9px;color:#838e9c;margin-left:3px;}
```

Positioning — always leftward, and `+N` on the slot-side end so reading order survives:

```js
box.style.top  = (pin.offsetTop - 2) + 'px';
box.style.left = (pin.offsetLeft + pin.offsetWidth - box.getBoundingClientRect().width) + 'px';
```

**Click contract:** clicking a collapsed slot filters to those rows / jumps to the reference
points. Not yet reconciled with #147 (the Open chip's ✕-on-hover) — see §7.

### 5.5 R6 — row message board
Same atom as the head's board, cast on tick hover. **Requires a steel row ground** (§2.3):

```css
/* the row must keep steel under it or the board inverts and vanishes */
[data-row]{background:linear-gradient(rgba(185,205,235,.085),rgba(185,205,235,.02) 45%,rgba(0,0,12,.16)),
           #171F2A !important;
  box-shadow:inset 0 1px 0 rgba(185,205,235,.13)!important;}

.rw-board{background:#050A10;display:flex;align-items:center;padding:0 7px;
  clip-path:polygon(5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%,0 5px);
  box-shadow:inset 0 1px 2px rgba(0,0,6,.8), inset 0 -1px 0 rgba(190,210,240,.10);}
.rw-board span{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:8.5px;font-weight:700;
  letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.rw-tick.hot{filter:brightness(1.5);}   /* the tick being pointed at */
```

The hovered tick's label prints on the board in that tick's hue; the resting board shows the
row's first issue in a neutral `#6a7684`.

### 5.6 R7 — row order: message board · button · slots · facts · name
Jac's directive. Same grammar as the head — readouts left, identity right.

```css
[data-row]>div{height:34px!important;display:flex!important;align-items:center!important;
  gap:6px!important;position:relative!important;padding-left:8px!important;padding-right:8px!important;}
.pin{display:none!important;}

.rw-board          {order:1!important;flex:0 0 auto!important;width:76px!important;height:19px!important;}
[data-row] .pin-wrap{order:2!important;flex:0 0 auto!important;width:auto!important;margin-left:0!important;}
.rw-rack           {order:3!important;flex:0 0 auto!important;margin-left:0!important;}
[data-row] > div > span.rw-facts{order:4!important;flex:0 0 auto!important;width:52px!important;
  text-align:right!important;font-size:9.5px!important;
  display:none!important;}      /* §2.4 — does not fit at 380px; #162 already makes it conditional */
[data-row] .ref    {order:5!important;flex:1 1 0!important;min-width:0!important;width:auto!important;
  display:flex!important;align-items:center!important;gap:5px!important;
  justify-content:flex-end!important;height:auto!important;
  background:none!important;box-shadow:none!important;border:0!important;clip-path:none!important;}
[data-row] .rmq    {overflow:hidden!important;text-overflow:ellipsis!important;
  white-space:nowrap!important;min-width:0!important;}
```

Note the `[data-row] .ref` selector — plain `.ref` loses to the card's injected sheet (§3.3).

### 5.7 P1 — the two-level architecture (ledger #168–#171)

Jac ruled **build it** (2026-07-31), took the **laser-drop trade** (#169), **retired the tick cap**
(#170), and settled that **"Failed" drops from the label but stays a filter term** (#171). Built by
injection on top of R7 and verified; script + screenshots were session-scratch, the CSS is here.

**Three DOM facts had to be established first — §2.7's shorthand is not literally true of this
build,** and getting them wrong is what made the first cut overflow by ~90px:

| §2.7 says | What the DOM actually has |
|---|---|
| "heads expose `data-tip`" | **`data-tip` does not exist** — `document.querySelectorAll('[data-tip]').length === 0`. All 66 hints are `data-hint`. |
| "read `data-tip \|\| data-hint`" | The issue **list** is on the row's **`.pin[data-hint]`**, newline-separated, one issue per line as `Source, State, Date` — the **state is the middle field**. The `.signal`'s own `data-hint` is a sentence, not a list. |
| (unstated) | A row's content div is **`children[1]`** — `children[0]` is the absolutely-positioned accent caret `<span>`. `row.firstElementChild` returns the caret and silently injects into the wrong node. |

**The load-bearing lesson: REPLACE, don't ADD.** The 380px budget (§2.4) is already fully spent —
the head's own message board is a **114px `<div>` child of `.scp1`** and the row's `Mar 14` column is
a **72px `<span>`**. Injecting a board and rack *alongside* them overflowed both levels off the card
edge (the group names rendered `FIELD CA`, `RESERVED: NO`, and every row name was pushed out
entirely). Retiring the head's original board/stamp/spacers and the row's date column — the date **is**
the facts column, so dropping it is exactly what R7/#162 already specify — is what makes P1 fit with
**zero overflow**.

```css
/* #169 — the laser drop/frame comes OFF the group. A housing never emits. */
.rw-noframe{display:none!important;}
.rw-off{display:none!important;}          /* retired originals — see REPLACE-don't-ADD above */

/* LEVEL 1 · THE HOUSING — right-condensed at .scp1, NOT inside .gate:
   [ slots ....residual.... ][ board ][ NAME ]                                */
.scp1 .rw-rack {order:1!important;flex:1 1 auto!important;min-width:0!important;
  margin-left:0!important;overflow:hidden!important;justify-content:flex-start!important;}
.scp1 .rw-board{order:2!important;flex:0 0 auto!important;width:auto!important;
  max-width:118px!important;height:17px!important;}
.scp1 .pin-wrap{order:3!important;flex:0 1 auto!important;min-width:0!important;
  margin-left:auto!important;overflow:hidden!important;}
.gate{max-width:100%!important;
  transition:transform .26s cubic-bezier(.32,.72,0,1), box-shadow .26s cubic-bezier(.32,.72,0,1)!important;}

/* the housing's OPEN state is MOTION. Nothing emits: the only things that
   change are WHERE the steel sits and WHICH WAY its shadow falls.            */
.gate[data-open="1"]{
  transform:translateY(-1.5px)!important;
  box-shadow:
    inset 0 3px 5px -1px rgba(0,0,6,.80), inset 0 1px 0 rgba(0,0,8,.7),
    inset -3px 0 0 rgba(0,0,8,.72), inset -8px 0 9px -4px rgba(0,0,6,.62),
    inset 0 -1px 0 rgba(198,218,248,.30), inset -3px -1px 0 rgba(198,218,248,.14),
    0 3px 0 -1px rgba(0,0,5,.92),        /* the bay mouth it lifted out of */
    0 5px 7px -3px rgba(0,0,4,.75)!important;}
.gate[data-open="0"]{transform:translateY(0)!important;}

/* LEVEL 2 · THE CARTRIDGE — the inner div carries an INLINE background,
   so every one of these needs !important to land.                           */
[data-row][data-lit="1"] > div{
  background:
    radial-gradient(120% 180% at 50% 0%, rgba(120,190,255,.11), transparent 62%),
    linear-gradient(#04080e 0%, #061019 62%, #040a11 100%)!important;
  box-shadow:inset 0 1px 2px rgba(0,0,6,.9), inset 0 -1px 0 rgba(190,215,245,.13)!important;}

/* the laser frame — now a ROW event (#139/#140 relocated by #168/#169) */
[data-row][data-lit="1"] > div::before{
  content:'';position:absolute;inset:0;pointer-events:none;z-index:3;
  transform-origin:top;animation:rwLaserDrop .24s cubic-bezier(.32,.72,0,1) both;}
[data-row][data-lit="1"][data-tone="red"]    > div::before{box-shadow:inset 2px 0 0 #ff4242, inset -2px 0 0 #ff4242, inset 0 -2px 0 #ff4242, 0 0 9px rgba(255,66,66,.30);}
[data-row][data-lit="1"][data-tone="yellow"] > div::before{box-shadow:inset 2px 0 0 #eed44b, inset -2px 0 0 #eed44b, inset 0 -2px 0 #eed44b, 0 0 9px rgba(238,212,75,.30);}
[data-row][data-lit="1"][data-tone="blue"]   > div::before{box-shadow:inset 2px 0 0 #6394cc, inset -2px 0 0 #6394cc, inset 0 -2px 0 #6394cc, 0 0 9px rgba(99,148,204,.30);}
[data-row][data-lit="1"][data-tone="green"]  > div::before{box-shadow:inset 2px 0 0 #34d399, inset -2px 0 0 #34d399, inset 0 -2px 0 #34d399, 0 0 9px rgba(52,211,153,.30);}
[data-row][data-lit="1"][data-tone="gray"]   > div::before{box-shadow:inset 2px 0 0 #8b94a3, inset -2px 0 0 #8b94a3, inset 0 -2px 0 #8b94a3, 0 0 9px rgba(139,148,163,.26);}

/* the lit face emits; the name stays right-aligned (the invariant) */
[data-row][data-lit="1"] .rmq{color:#dcecff!important;text-shadow:0 0 7px rgba(150,205,255,.42)!important;}
[data-row][data-lit="1"] .rw-board{background:#02060b!important;
  box-shadow:inset 0 1px 3px rgba(0,0,6,.92), inset 0 -1px 0 rgba(190,215,245,.16)!important;}
[data-row][data-lit="1"] .rw-board span{color:#8fd8ff!important;text-shadow:0 0 6px rgba(80,190,255,.45)!important;}

/* CRT flicker on power-on (#161, relocated to row-open) */
@keyframes rwCrtOn{
  0%{opacity:.16;filter:brightness(2.6) saturate(.4)} 12%{opacity:1;filter:brightness(1.5)}
  22%{opacity:.55;filter:brightness(.8)} 34%{opacity:1;filter:brightness(1.28)}
  52%{opacity:.86;filter:brightness(.97)} 100%{opacity:1;filter:brightness(1)}}
[data-row][data-lit="1"] > div > *{animation:rwCrtOn .34s steps(16,end) both;}

/* the drawer the cartridge drops — the terminal body */
.rw-cart{overflow:hidden;background:linear-gradient(#04080e,#03070c);
  box-shadow:inset 0 1px 0 rgba(150,200,255,.14), inset 0 -1px 0 rgba(0,0,6,.9);
  animation:rwCartDrop .26s cubic-bezier(.32,.72,0,1) both;}
@keyframes rwCartDrop{from{height:0}to{height:var(--cart-h,58px)}}
.rw-cart .l{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:9px;letter-spacing:.05em;
  color:#7fd0ff;text-shadow:0 0 6px rgba(80,190,255,.40);padding:3px 10px;white-space:nowrap;overflow:hidden;}
.rw-cart .l b{color:#cfe9ff;font-weight:800;}
.rw-cart .l.dim{color:#4d6d86;text-shadow:none;}
```

The head rack aggregates its group's real issues (hottest-first per `style` §6 rollup precedence),
and the board rests on `N OPEN`, swapping to the hovered tick's label in that tick's hue.

#### 5.7.1 Measured — the two registers actually separate

Computed-style samples, not eyeballing:

| Probe | Housing (group) | Cartridge (row, lit) | Row, unlit |
|---|---|---|---|
| outer glow | **none** | laser frame + `0 0 9px` hue | none |
| transform | **`translateY(-1.5px)`** — it moved | none | none |
| name text-shadow | R4's *cast* shadow (raised steel) | **`0 0 7px` emission** | **`none`** — matte |
| face | steel gradient | `radial-gradient` glass | steel gradient |

**No light on steel, no motion on glass** — the split holds under measurement, and the name is
right-aligned at both levels (the invariant). **Overflow: none** — every element sits inside the
380px card at 440px viewport.

#### 5.7.2 #170 verified — the cap really was the board

With the head's fixed 114px board retired, the ten head racks now measure **138–243px** of run.
At ~8.5px per tick that is **16–28 ticks** of capacity where the spec allowed 8. §2.5's inference
is confirmed by measurement: the 8-cap was the board reserving width, never the ticks.

#### 5.7.3 A finding that argues for #158 — the board and the button say the same word

At rest the row reads `[ 3D OVERDUE ][ 3D OVERDUE ][ slots ][ Excavator 12k ]` — the message board
and the state chip print **the identical string**, because the board rests on the row's first issue
and the chip shows the worst state, which for most rows is the same issue. This is Jac's *"what is
the row button for?"* question showing up as a visible duplication rather than an argument.
**Converting the button to a verb (#158) removes it**: board = the issue, button = the action. Until
that lands, the row spends ~93px saying one thing twice.

### 5.8 LANDED — R2→P1 is now in the prototype (2026-07-31)

Everything above was injection-only; the prototype in git showed R0 + the rename. It now carries
**R2→P1** as a self-contained block appended before `</body>` in
`docs/design/tier-01-card/index.html`. **`git checkout` of that file is the revert.**

**Why a runtime block and not a static `<style>`.** The card ships its own runtime-injected
stylesheet, which lands after anything static, so an equal-specificity rule loses on source order
(§3.3). The block appends its `<style>` from JS — guaranteed last — and the DOM work has to wait for
the component to mount anyway. A `MutationObserver` (disconnected during its own writes, re-armed
after) re-applies on every re-render, because the runtime replaces the nodes it owns.

**Why it hooks the card's own open state.** #173 keeps the 220ms discriminator untouched, so the
block adds **no click handler at all**. The card marks an open row by writing an inline `color-mix`
wash; the block detects that and re-skins it. Two things fell out of building it that way:

- **The row's centre point sits on the `.signal` chip**, which `stopPropagation`s per #67 — so
  `page.click('[data-row]')` does *not* open a row. That is the click contract working, not a bug;
  a test must click the row **body**. This cost one wrong "it doesn't work" diagnosis.
- **The card already renders the drawer.** The row's *third* child is a
  `Tier 1 · detail view (parked)` panel carrying the **#63 anchor icon**. That panel **is** the
  cartridge's drawer slot, so the terminal lines are appended **inside** it and its label is left
  alone — Tier 1 genuinely is still parked. The first cut appended a second drawer element and the
  laser frame was drawn on `> div`, which framed each child separately: the card rendered as **two
  stacked panels**. Fixed by moving the frame to the **row** (`[data-row][data-lit="1"]::before`)
  so it wraps the whole cartridge as one object.

**Verified with zero injection** — 10 housings, 20 cartridges, 10 head racks, 20 row racks, one
drawer, one frame, no stray elements, `housingGlow: none`, `overflow: NONE`, `scrollWidth 440`. The
only console output is the two `{{ p.icon }}` / `{{ c.icon }}` SVG parser warnings that the
prototype's own `README.md` already documents as expected and puts on the audit ignore-list.

**One pre-existing gap surfaced, deliberately not fixed:** the card's open-row wash does **not**
clear on a second body click — open, click, click again, and it stays open. The P1 layer mirrors
that state faithfully, so the cartridge stays lit. This is the card's own contract (and ties to the
parked Tier 1 drawer), and #173 says leave the click alone — so it is reported, not patched.

---

## 6 · P1 — the two-level architecture (RULED: BUILD IT — ledger #168)

Jac's proposal, from the last message of the session:

> *"Maybe the rows adopt the cartridge design and drop down for details (digital terminal).
> And then the group headers condense to the right. Right to left could be Group Name,
> Message Board, Slots (up to full width now instead of limited)… maybe we build a mini
> cartridge or headless container or maybe a combo? Mechanically it likely has to be
> something that houses the collapsed row cartridges and then animates open to reveal those
> cartridges. I want to be careful not to break plot."*

**The slot-width instinct is confirmed** by §2.5 — the 8-cap is the board's fixed 114px, not
the ticks. Freeing the board does let slots run full width.

**The plot risk is specific:** two nested open/shut mechanisms in the same visual language
collapse the level distinction. If a group opens like a cartridge and a row opens like a
cartridge, the hierarchy is lost.

**The fix is already canon — #146 (light is emitted BY glass, never applied TO steel):**

```
GROUP  =  housing        opens by MOVING     steel · mechanical · no light
          └── face plate, right-aligned: [ slots ......... ][ board ][ NAME ]

ROW    =  cartridge      opens by LIGHTING   glass · terminal · emission
          ├── seated shut: [ board ][ btn ][ slots ][ NAME ]
          └── opened: the face powers on into a terminal
```

Group = motion. Row = emission. **Invariant to hold at both levels: name right-aligned.**
Middles may differ (heads have no button and no facts).

**On the row button** — Jac asked what it's for, if slots are portals and the board narrates.
It isn't redundant, it's **unfinished**: #158 already locked the verb-CTA pattern
(gate = state button = next action; from Trips §8.5, recommended for Units/Rentals by the
07-19 dispatcher audit), with only per-transition wording open. Scope separation:

| Element | Reads/acts on |
|---|---|
| slots | issues |
| board | the hovered issue |
| name | the unit |
| **button** | **the unit — the row's only actuator** |

Three readouts, one actuator. And converting it pays the §2.4 width bill via §2.6.

**Ledger cost — six rows relocate, none break. Status after the 07-31 build:**

| Row | Move | Status |
|---|---|---|
| #146 | holds; its *application* drops a level | ✅ done — §5.7.1 measures the split holding |
| #161 | boot theatre (CRT flicker, laser drop, per-row type-in) moves group-open → **row-open** | ✅ done — `rwCrtOn` + `rwLaserDrop` fire on `[data-lit]` |
| #139 / #140 | laser frame moves group → row | ✅ done — `.rw-noframe` off the group, `::before` on the lit row |
| #156 | open-row wash (group hue at 16%) needs revisiting — may become the cartridge's lit face | ⏳ **still open** — the lit face is currently a neutral blue-glass gradient, not the group hue at 16%. Needs Jac: does the cartridge's lit face keep the group's hue, or is the hue now carried only by the laser frame? |
| #67 / #164 | click contract: single-click becomes "power on this cartridge", a far larger event than the 220ms discriminator was designed around | ⏳ **still open** — the build wires a plain click to `rwLight`; the 220ms single/double discriminator is **not** re-tested against it |
| `atom-rebuild §1` | the rack's 8-cap and the board's fixed 114px both go | ✅ done — §5.7.2 measures 138–243px of rack run |

---

## 7 · Still open — needs Jac

**Six of the original eight closed on 2026-07-31.** Struck through with the row that closed them:

1. ~~**Build P1 or not.**~~ → **RULED: build it** (#168). Built — §5.7.
2. **Rack placement on rows** — settled order is R7, but placement within the head is not.
   ⏳ **Still open.** Deliberately not asked in the same batch: it is downstream of #168, which
   reshapes the row, so ruling it first would have settled a layout that was about to change.
3. **#147 collision** — the Open chip's ✕-on-hover vs the collapsed slot's expand-on-hover.
   Two hover behaviours on one element. ⏳ **Still open**, held back for the same reason as 2.
4. ~~**8-vs-10 tick cap.**~~ → **RULED: no cap at all** (#170), and §5.7.2 measured the result.
5. ~~**Collapsed slot overhangs its chip cell** (`OPEN` → `PEN`).~~ → dissolved by #166: the
   collapsed slot carries a **numeral**, so the wide status word is gone from that state.
6. ~~**Does the collapsed slot keep its numeral?**~~ → **RULED: numeral only** (#166).
7. ~~**The laser-drop trade.**~~ → **RULED: taken** (#169) — laser moves group → row.
8. ~~**`Reserved: Not Ready` leaves "Failed" implied.**~~ → **RULED** (#171): the word drops from
   the label but is **kept as a filter term**, so a Failed-but-Reserved unit is still findable by
   searching "Failed" without the head growing a third word.

**Added by the P1 build** (§5.7.3): the row's message board and its state chip currently print the
same string at rest. Finishing #158's verb conversion resolves it — that is now the next row-level
decision, and it also pays the §2.4 width bill via §2.6.

---

## 8 · Repo state at session end

- **PR #785** — the rename (R1) + this log. Draft, `smoke` green, `mergeable_state: clean`.
  Branch `claude/tier-01-card-audit-crnxj3`.
- **1 commit on `trunk` awaiting `/promote`** — `d633a1e` (#784, `/prompt-a` + `/prompt-b`).
- Per ledger **#163**, the 07-20 records (ledger §3/§4, `decision-notes.md`,
  `list-views.html`) were **not** retro-edited by the rename. Row #165 supersedes the label
  only; those lists stay authoritative for group set and order.
