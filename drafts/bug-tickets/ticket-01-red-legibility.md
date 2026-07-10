# BUG: Red (danger) palette is illegible / hard to see

**Reported by Jac (verbatim):** "Red Design is still not legable and is hard to see."

**Area:** design-system

**Symptom:** The danger/red treatment (red status pills, red text, the red hazard-stripe variant) is hard to read — low contrast between the red ink and its soft red background, and red glow/text-shadow effects that smear legibility.

**Suspected code locations:**
- `style.css:19` — dark-theme `--red:#ff1040; --red-bg:rgba(255,16,64,.18)`. The base red token and its 18%-opacity fill. The `.c-red` pill paints `--red` ink on `--red-bg` — a saturated-pink-red on a faint translucent red is the core contrast problem.
- `style.css:48,51` — light-theme overrides `--red:#d52a2a; --red-bg:rgba(213,42,42,.15)`. Same ink-on-tint pattern; needs its own contrast check.
- `style.css:973` — `.c-red { background: var(--red-bg); color: var(--red); border-color: color-mix(...) }` — the soft danger pill. This is where most "red text on red" renders (rental/inspection/invoice "bad" states).
- `style.css:636,1789` — `.disp-deadline.over` / `.gv-lead-c` use `-webkit-text-fill-color: color-mix(--red 65%, white)` plus double `text-shadow` red glow on red — the glow halo actively hurts legibility of overdue figures.
- `style.css:944,1541` — `.pill.c-danger { background: var(--red); color:#fff }` (solid red, readable) and the red hazard-stripe cap `repeating-linear-gradient(... var(--red,#ff4242) ...)`. Note the literal `#ff4242` fallback here disagrees with the `--red:#ff1040` token — two different reds ship in the same design.

**Root-cause hypothesis (hypothesis):** The danger style leans on `color: var(--red)` over `var(--red-bg)` (a low-opacity tint of the same hue), so foreground and background are near-isoluminant — a classic low-contrast pairing. Compounded by (a) the saturated `#ff1040` being hard to read at small pill sizes, (b) red text-shadow/glow effects, and (c) a token/fallback mismatch (`#ff1040` token vs `#ff4242` hardcoded fallback). Fix likely means a darker/denser red ink (or white ink on a solid red like `.c-danger`), a less transparent `--red-bg`, dropping the glow, and unifying the fallback to the token.

**Acceptance criteria:**
- [ ] Red pills/text meet WCAG AA (≥4.5:1 for text) against their actual rendered background in both dark and light themes.
- [ ] Overdue/"over" deadline figures (`.disp-deadline.over`, `.gv-lead-c`) are legible without relying on the glow text-shadow.
- [ ] The hazard-stripe red fallback (`#ff4242`) is reconciled with the `--red` token (one red, not two).
- [ ] Verified against `reduced-motion` and the yard/ranch themes (no theme regresses contrast).

**Notes / R-rulebook impact:** Touches R3/R3b status pills (`.pill[data-badge]`), R1 gate states, and S4 confirm-refund (`.pill.c-danger`). Run through `jactec-ui` (the red hazard-stripe is the designated danger signature). No `data-r` stamps change (token/CSS only), so `rule-usage.js`/`WINDOW_CATALOG` are unaffected; bump the shared `?v=` token on deploy.
