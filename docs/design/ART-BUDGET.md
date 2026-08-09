# The Artwork Budget — measured limits for illustrated UI

**Date:** 2026-08-09 · **Status:** PROPOSED — awaiting Jac's ruling on §7 (delivery mechanism)
**Method:** the running app booted headless and measured live; the shipped payload measured on the
live host with `curl`; formats measured by re-encoding this project's own art; browser ceilings read
from Blink/WebKit source and adversarially re-verified (9 of 14 checked numeric claims were
corrected or refuted — see §10).

> **Why this exists.** Ledger open-question (A): *"There is NO byte budget anywhere. Neither `style`
> nor `wrangler-style` carries a single weight, byte, or frame-rate rule."* The `frontend-performance`
> spec predates all artwork work (2026-06-28) and budgets render milliseconds, row caps and photo
> dimensions — it never contemplated an asset layer. This document is that missing budget.

---

## 1. The headline

**Rental Wrangler's artwork budget is negative today.** First load is **6.02 MB on the wire**, of
which **5.00 MB (83%) is media** — and none of that media is artwork.

| | wire bytes | share |
|---|---:|---:|
| Code + CSS (15 files, gzipped by Pages) | 1,019,517 | 17% |
| `assets/login-intro.mp4` | 2,505,986 | 42% |
| `assets/jac-rentals-logo.jpg` | 1,694,934 | 28% |
| `assets/tex-metal-blued.jpg` | 798,155 | 13% |
| `assets/favicon-32.png` | 2,601 | <1% |
| **First-load total** | **6,021,193** | |

Against the 2026 P75 field baseline (Samsung Galaxy A24 4G on 9 Mbps / 100 ms RTT LTE), the
published transfer budget for a JS-heavy app is **1.2 MiB for a 3-second load** or **2.3 MiB for
five seconds**. This app is at **6.02 MB** — 2.5× over even the loose bar, before a single pixel of
artwork ships.

**The good news is that the overspend is three files, and none of them is load-bearing:**

| File | Problem | Recoverable |
|---|---|---:|
| `login-intro.mp4` | 2.5 MB fetched `preload="auto"` on **both** login screens, **before auth**. Its hand-written `?v=20260708a` is a month stale and no tooling will ever move it. | 2,505,986 |
| `jac-rentals-logo.jpg` | **4800×4800, 1.65 MB**, displayed at 62 px (login), 82 px (header chip), 46 px (print). ~58× oversampled per axis at the largest use. | ~1,690,000 |
| `tex-metal-blued.jpg` | 798 KB / 1024², tiled at **three different `background-size` values** (520 / 340 / 300 px) — three separate decode-cache entries of the same texture. | ~750,000 |

Fixing those three frees **≈ 4.9 MB** — more than five times the entire artwork envelope proposed
below. **Do them first; the budget is not real until they land.**

Dead weight also present in the repo (not deployed, but carried): `assets/jac-rentals-logo.svg`
(2,102,184 bytes, referenced by nothing) and five `tex-*` ranch-theme textures (161,179 bytes,
shipped but unreachable — `[data-theme="ranch"]` is not selectable at runtime).

---

## 2. The three denominators

Artwork is not one budget. It is three, and they have different units and different multipliers.
Confusing them is how every "it's only 40 KB" argument goes wrong.

| Budget | Unit | What multiplies it | What does NOT |
|---|---|---|---|
| **B1 · Wire** | gzipped bytes on first load | number of **unique assets** | instance count — Blink's `StyleImageCache` holds one `ImageResourceContent` per resolved URL, so 96 elements sharing one `:root` asset cost the bytes once |
| **B2 · Memory** | decoded bytes resident | number of **distinct rasterized sizes** — Chromium's decode-cache key is `{image, mip level, filter quality, color space}`, with no element identity | instance count, again |
| **B3 · Frame** | ms per frame | **instance count × per-element paint ops** | asset size — a 2 KB mask on 260 rows costs more frame time than a 200 KB panel on 3 cards |

**The one-line version:** bytes scale with *how many different pictures*, memory scales with *how many
different sizes you draw them at*, and frame time scales with *how many elements draw them*. The
Halo pipeline's "one shared asset, declared once, referenced N times" wins B1 and B2 outright. It
does nothing for B3 — B3 is where a row-level artwork decision can still kill the app.

---

## 3. What actually multiplies — the measured surface census

Measured live at `#local`, 1440×900 and 390×844, headless Chromium.

| Surface | Selector | Default viewport | Worst case | Multiplies? |
|---|---|---:|---|---|
| Card frame | `.col > .card` | 3 | 3 desktop / 7 phone (5 rail panels + 2 inert clones) | no |
| Card header | `.card-head` | **0** (list mode paints none) | 3 | no |
| Column tab strip | `.tabrow` | 3 | 3 desktop / 0 phone | no |
| List bar | `.listbar` | 3 | 3 desktop / 7 phone | no |
| Group header | `.grp-hd` | 10 (6 DOM nodes each, uniform) | 23 fixed (units 10 + rentals 10 + customers 3); **Trips is unbounded** — 60 trips on 60 distinct days = 62 headers | mildly |
| **List row** | `.row` | 20 | **60 per card at first paint (`VIRT_CAP`), +200 per "Show more" click (`SHOW_MORE_BATCH`), unbounded** | **YES** |
| Footer | `.bottombar` / `.mobile-toolbar` | 1 | 1 | no |
| Graph frame | `.gv-panel`, `.ca-chart`, `canvas` | **0** — closed by default | 1–2 when opened | no |

**Only rows multiply.** Everything else is capped at ≤ 23 instances and can afford expensive
technique. That single fact drives every per-surface rule in §5.

Measured per-row marginal cost (synthetic 300-unit seed, 69 → 269 rows):

- **65.2 DOM nodes** per row
- **4.82 KB** JS heap per row
- **3.7** compositing-promoting elements per row
- full-document reflow **9.0 ms → 103.7 ms** (default grid → 269 rows)
- at 269 rows only **31 of 269 rows intersect the viewport (11.5%)** — 238 off-screen rows still pay
  full style, layout and compositing

Two structural findings worth keeping:

1. **Opening a record REDUCES total DOM** (1390 → 783 nodes), because the session cascade collapses
   the sibling cards. **Detail artwork is not additive to grid artwork — budget the max of the two
   states, not the sum.**
2. **`will-change` and `backdrop-filter` are at zero app-wide**, and there are no 3D transforms. The
   entire compositing-hint budget is unspent. 82 of 1390 elements (5.9%) currently promote, all of
   it incidental SVG transforms and 9 icon drop-shadows.

---

## 4. The device the budget is held against

| | Figure | Source |
|---|---|---|
| P75 field phone | **Samsung Galaxy A24 4G** (Helio G99, 4/6/8 GB, 6.5" 1080×2340 **90 Hz**) | Performance Inequality Gap 2026 |
| P75 network | **9 Mbps down / 3 Mbps up / 100 ms RTT** | ibid. |
| Browser-work multiplier vs a fast laptop | **4.4×** (mid-tier) / **7.4×** (low-tier) — Speedometer 3: 12.0 and 7.07 runs/min vs ~52 | CSS Wizardry 2026 device guide |
| Frame budget | **11.1 ms at 90 Hz** (not 16.67), of which ~6 ms is browser overhead → **~5 ms for app work** | RAIL + device panel spec |
| DPR range to serve | **1 → 3, fractional** (A17 = 2.75, A56 = 2.63, iPhone 17 Pro = 3) | ibid. |
| Sustained vs peak under heat | **64–75% average, 48–64% worst**, measured at only 28 °C ambient | GSMArena throttling test |
| Truck cab | Apple's stated operating range **stops at 35 °C** and names parked cars as exceeding it | Apple support |

**The office desktop is not automatically the fast seat.** The P75 desktop baseline (HP 14, Celeron
N4500, ~480 Geekbench 6 single-core) is *slower single-core than the P75 phone* (712).

**Plan for ~50% of benchmarked speed** on a dashboard-mounted phone in a Louisiana summer. That is a
derived planning number — no published measurement exists of thermal throttling under a *web*
workload on a mid-tier Android in a vehicle.

---

## 5. The budget

### 5.1 Wire (B1) — 900 KB gzipped, first load

Chosen so that first load lands at **1,019 KB code + 900 KB art + ~15 KB icons ≈ 1.93 MB** — inside
the 2.3 MiB five-second field budget, and a 3× improvement on today's 6.02 MB. It is *only*
available after the three §1 fixes land.

| Surface | Worst-case instances | Unique assets | Budget (gz wire) | Technique |
|---|---:|---:|---:|---|
| Card frame | 7 | 1 (+1 phone variant) | **180 KB** | 9-slice, `stretch`, fixed-height corners |
| Card header | 3 | 1 | **120 KB** | 9-slice, `stretch` |
| Group header | 23+ | 1 | **90 KB** | 9-slice; `round` permitted on the fixed axis |
| **List row** | **260+** | 1 | **60 KB** | 9-slice `stretch` **only**; ≤1 mask layer |
| Footer | 1 | 1 | **120 KB** | single background, any technique |
| Graph frame | 0 until opened | 1 | **120 KB** | **lazy — must not load before a chart opens** |
| Textures | app-wide | ≤3 tiles | **90 KB** | ≤512² tiles, ≤3 `background-size` values |
| Reserve | — | — | **120 KB** | new surfaces, unbudgeted |
| **Total** | | **~10 assets** | **900 KB** | |

Calibration against art this project has already built: `asm-housing-image` 20.8 KB, `asm-deck-image`
58.4 KB, `asm-rowboard-image` 45.5 KB, `elbow-steel-image` 20.6 KB, the whole elbow+housing mask set
33 KB. Every row and panel asset the Halo kit has produced fits comfortably.

**One existing asset is already over budget: `--fc-footer-image` at 140 KB** — a 4× raster capture
(ledger #244/#246). At 2× as WebP q90 it would be a small fraction of that. Re-export before it ships.

### 5.2 Memory (B2) — ≤ 16 MB decoded, artwork total

The honest position: **no public figure exists** for safe texture memory on a mid-tier Android, and
the widely-quoted per-device iOS Safari heap tables (300–450 MB) trace to no primary source. The
defensible proxies are Chromium's own constants:

- decoded-image working set on Android: **128 MiB, flat** — it does *not* scale up on a flagship
- discardable pool: **128 MB Android / 512 MB desktop / ÷8 on low-end → ~16 MB**
- decoded bytes ≈ **rendered** w × h × bytes-per-pixel, where bpp is **1.5–8**, not a fixed 4
  (JPEG is retained as YUV 4:2:0 planes; HDR lands in RGBA_F16)
- dimensions track the **rendered** size, not the intrinsic size — Chromium stores a 1000×1000 image
  shown at 240×240 as 250×250

**Budget artwork to ≤ 16 MB decoded** so it never competes for eviction with the app's own captured
evidence images (which `downscaleImage` already produces at up to 1400 px). Enforce it structurally:

- **Fix panel heights.** SLICE-SPEC's 151 / 151 / 97 px heights are a *performance* decision as well
  as a fidelity one: with height fixed, only the stretched middle varies with width, so the corner
  art — the bulk of the pixels — rasterizes once instead of once per mip level.
- **Cap distinct rasterized sizes at 3 per asset.** The same panel drawn at five widths costs five
  decode-cache entries. Today's `tex-metal-blued.jpg` at three `background-size` values is already
  paying this three times over.
- **Author one 2× raster. Never a 3× ladder.** Heavily-compressed 2× imagery beats uncompressed 1×,
  and 3× phones downscale acceptably.

### 5.3 Frame (B3) — the per-instance rules

The binding constraint. Only **`transform` and `opacity`** are compositor-only; every other tool in
the artwork kit (`border-image`, `mask-image`, stacked backgrounds, `filter`, `backdrop-filter`,
`background-clip`) is paint work. **Static paint is cached and paid once; animated paint is paid per
element per frame.**

Measured costs:

| Technique | Cost | Source |
|---|---|---|
| `background-image`, stacked layers | N draw ops in one paint chunk, **0 extra composited layers** — the cheapest way to build up artwork | Blink paint architecture |
| `border-image` `stretch` | up to **9 draw ops/element/paint** (vs 1), tile params recomputed every paint, no memoization — but `stretch` takes the plain `DrawImage` path | `nine_piece_image_painter.cc` |
| `border-image` `round` / `repeat` / `space` | routes to `DrawImageTiled`; `round` adds a **per-tile rescale** | ibid. |
| `mask-image` | **slowest of 11 techniques measured** — 148.87 ms / 1,000 icons ≈ **0.149 ms/element**, ~35% worse than the same art as a background; forces an intermediate render surface | Cloud Four 1,000-icon benchmark |
| `backdrop-filter` | **1 texture readback + 1 filter pass + 1 clip per element** | Chromium implementer's design doc |
| animated `filter: drop-shadow` / `blur` | re-convolved **every frame per element**; static is rasterized once into the parent texture and reused | Chrome DevRel, "animated blur" |

This project's own 96-elbow measurement (**60 → 48 fps**, ledger #254) is exactly what that last row
predicts: 16.67 → 20.83 ms = +4.17 ms over 96 instances ≈ **43 µs per instance per frame**.

**The rules that follow:**

| # | Rule | Why |
|---|---|---|
| A1 | **One asset, N references.** Every repeated surface declares its art once in `:root`. | Marginal cost per instance ≈ 0 bytes; one decode. |
| A2 | **`stretch` only on any surface that can exceed 24 instances.** `round`/`repeat`/`space` are permitted on card frames, headers, group headers and the footer — never on rows. | `round` adds a per-tile rescale that multiplies by instance count. |
| A3 | **≤ 1 mask layer per row.** | 60 rows × 0.149 ms ≈ **8.9 ms** — the entire 90 Hz frame, on desktop-class hardware, before the phone's 4.4× multiplier. |
| A4 | **Animate only `transform` and `opacity`.** No animated filter, shadow, blur, mask or background. | The only two compositor-only properties. A static glow on glass stays fine (#251); animating one across many instances does not (#254). |
| A5 | **No `backdrop-filter` on any repeated surface.** Single instances only, kept small. | Per-element readback; cost scales with filtered area. |
| A6 | **Never `will-change` in a static stylesheet.** Toggle it in script around the change, or not at all. | A stylesheet `will-change` holds the optimization indefinitely; overlap promotion cascades one promoted element into every overlapping sibling above it. |
| A7 | **Lazy-load art for surfaces closed by default** (graph frames). | Measured: `.gv-panel` / `.ca-chart` / `canvas` are all 0 at the default grid. Free win. |
| A8 | **Keep decorative SVG paths convex where practical.** | Chromium can veto GPU rasterization on pages with many non-convex SVG paths, dropping the whole page to the ~20× slower software raster path. |

---

## 6. Texture assets specifically

Textures are the dangerous addition, because they are photographic (they do not compress like flat
panel art) and they tile (large decoded bitmaps that fork per `background-size`).

| Rule | Number | Basis |
|---|---|---|
| **Tile, never full-bleed.** | A 2000×1200 stretched background = **9.6 MB decoded**; a 128² tile = 64 KB decoded and covers any area. | 4 B/px arithmetic |
| **Max tile 512², prefer 256².** | Chromium's software raster tile is 256×256; `max_untiled_layer_size` is 512×512. | `layer_tree_settings.cc` |
| **≤ 3 tiles app-wide, ≤ 3 `background-size` values each.** | Each distinct rasterized size is its own decode-cache entry. | `gpu_image_decode_cache.h` |
| **Total texture wire budget** | **90 KB gzipped** | §5.1 |
| **Export undithered.** | ±1 LSB of dither grew a clean 800×400 panel from **2,701 B to 301,066 B — 111×**. | measured, this project's art |
| **Never re-encode a JPEG master.** | The AVIF advantage inverts on double-compressed sources. Re-encode from the lossless master. | measured on `tex-metal-blued.jpg` |

### Format, measured on this project's own art

| Content | Winner | Measured |
|---|---|---|
| Flat UI panel, gradients, **undithered** | **WebP lossless** | 850 B vs 2,701 B PNG (**0.31×**). Lossy WebP is 20% *larger* than the PNG here — do not use it. |
| Exported panel art (`halo-steel.png` 512²) | **WebP q90** | **4,896 B** vs 24,474 B AVIF q90 vs 210,541 B PNG. AVIF holds higher SSIM (0.987 vs 0.973) — eyeball for banding before committing. |
| Photographic metal grain, from a **lossless** master | **AVIF** | −37% vs WebP at matched SSIM; −47% at matched quality setting *and* higher SSIM. |
| **Alpha masks** | **WebP lossless or AVIF — never lossy WebP** | Lossy WebP discards RGB under transparent pixels: PSNR **15.5 dB** vs AVIF's 53.6 dB. This destroys any mask+texture tint pipeline. |
| AVIF lossless | **never** | Lost to WebP lossless on every asset tested (0.54–0.97× PNG vs WebP's 0.31–0.77×). |

Support: WebP **96.18%**, AVIF **94.67%**, SVG **96.69%** (global, 2026).

### SVG vs raster — the threshold ledger open-question (D) asked for

Measured on a real 898-path export: **~187 bytes per path gzipped**.

> **Crossover ≈ 26 paths** against a 4.9 KB lossy-WebP render, or **≈ 4.5 paths** against an 850 B
> lossless-WebP flat panel, at a fixed display size.

**Under ~26 paths → SVG. Over it → raster** — *unless* the art must recolour at runtime or serve
many sizes, in which case SVG wins back on flexibility regardless of bytes.

Two project-specific facts that push harder toward raster than they would elsewhere:

- **GitHub Pages serves gzip only — brotli is not offered.** Measured: `Accept-Encoding: br` alone
  returns the file *uncompressed*. That 898-path SVG costs **168 KB** on the wire here where a
  brotli host would charge 37.6 KB. Never budget SVG against brotli numbers.
- **Coordinate precision is the only SVG lever worth pulling.** 3dp → 1dp cut gzip by **28.9%**.
  Collapsing whitespace cut **0.01%** — worthless. Set precision in the exporter; skip minification.

### data: URI encoding

| | Penalty |
|---|---|
| SVG **percent-encoded** into CSS | **+0.24%** gzipped vs a separate file |
| SVG **base64** into CSS | **+431%** gzipped (168 KB → 891 KB) — base64 destroys gzip on text |
| PNG/JPEG/WebP base64 into CSS | +0.8% to +4.3% gzipped — nearly free on the wire; the real cost is render-blocking and cacheability, not bytes |

**Rule: percent-encode SVG data-URIs. Never base64 them.**

---

## 7. Delivery — the one call that is Jac's

Ledger open-question (B) is still open, and the service worker makes it consequential. The two paths
are genuinely different, not stylistic:

| | Inline (data-URI in `style.css`) | Separate files under `assets/` |
|---|---|---|
| Offline | ✅ rides the SW `SHELL` precache | ❌ **network-only** — `sw.js` hard-rejects anything off its 13-path allowlist |
| Requests | 0 extra | 1 each (fine on HTTP/2 — Chrome measured no difference from 5 → 15 initial requests) |
| Cost cadence | **paid every deploy** — a `?v=` bump refetches all 509 KB of `style.css` | **paid once ever** |
| Revalidation | 0 | one conditional GET per file per 10-minute window (`max-age=600` + ETag → 304, no body) |
| Cache-busting | automatic via `?v=` | **impossible via `?v=`** — `tools/lib/cachebust.mjs` versions exactly three files and never rewrites `url()` inside CSS. Version must live in the **filename**. |

At the proposed 900 KB envelope, inlining adds roughly **900 KB to every deploy for every active
user**; separate files cost 900 KB once and then ~10 revalidation round-trips per 10 minutes.

**Recommendation: separate files under `assets/halo/`, versioned in the filename**
(`asm-housing.20260809.webp`), **added to `sw.js`'s `SHELL`.** The deploy cadence on this project is
high enough that "paid every deploy" is the worse of the two costs.

**Two things must land with that choice:**

1. `sw.js`'s `SHELL` is **already stale** — it omits four modules `app.js` statically imports
   (`icons-frames.js`, `vendor/plot.min.js`, `vendor/d3-shape.min.js`, `vendor/qrcode.min.js`). The
   offline shell **cannot boot offline today.** Fix it in the same pass, and note `cache.addAll` is
   all-or-nothing — one failed fetch and the SW never activates.
2. `vendor/plot.min.js` is **134 KB wire loaded at boot** for charts that are closed by default.
   Dynamic-`import()` it and the artwork envelope grows by 143 KB for free.

---

## 8. The check-before-you-ship list

Every new or changed artwork asset:

- [ ] Declared **once** in `:root`, referenced N times (A1)
- [ ] Panel **height fixed**; only width stretches (§5.2)
- [ ] `stretch` if the surface can exceed 24 instances; `round` only for a countable rhythm on a
      capped surface (A2, ledger #257)
- [ ] **≤ 1 mask layer** on any row-level element (A3)
- [ ] No animated filter/shadow/blur/mask — `transform` and `opacity` only (A4)
- [ ] No `backdrop-filter` on a repeated surface (A5); no stylesheet `will-change` (A6)
- [ ] Exported **undithered**; **one 2× raster**, no 3× ladder
- [ ] Format per §6; masks are lossless WebP or AVIF, never lossy WebP
- [ ] SVG only under ~26 paths; coordinate precision set at export
- [ ] SVG data-URIs **percent-encoded**, never base64
- [ ] Added to `sw.js`'s `SHELL`, with the version **in the filename**
- [ ] Surface-level budget from §5.1 not exceeded; running total still ≤ 900 KB

**Verify on a real device, not headless.** MEMORY.md records a `transform` + `will-change` element
that painted over its label on iOS Safari only — headless Chromium never promoted the layer, so it
looked correct locally and broke on device. Both of this project's existing frame-rate measurements
(~60 fps at 96 elbows, ~48 fps with the animated shadow) were taken headless and are therefore
*directional*, not device truth.

---

## 9. What this budget does NOT resolve

Carried forward from the ledger, unchanged by this document:

- **Four of five Halo panels need an art re-export before they can resize** (#258/#260). `asm-deck`
  cannot be 9-sliced below **1316 px** — the widest uniform corridor in its 1294 px painted area is
  19 px. `asm-housing`'s interior staircase is a near-rhythm (pitch 460/440/459) that can neither
  stretch nor round. `asm-headboard` and `asm-rowboard` have wordmarks baked into the stretch zone.
- **The conduit rail's export has three defects** (#259) and should ship as a 41×4 `repeat-y` tile,
  not a 9-slice.
- **The slot/bulb art fails the CVD separation floor** (#238/#248) — measured 31–72 against a floor
  of 90. That is a gate, not a preference.
- **`FEATURES.designV2` does not exist.** Four documents claim the redesign is behind it; `grep` of
  `config.js` finds zero occurrences. **There is currently no runtime kill switch for the redesign
  or its artwork** — which CLAUDE.md requires for a replacement of this size.

---

## 10. Provenance and corrections

Nine of fourteen adversarially re-checked numeric claims were corrected or refuted. The ones that
would have changed this budget if left standing:

| Claim as first sourced | Verdict |
|---|---|
| "Mobile Safari pages crash at ~100 MB (iPhone SE 3)" | **REFUTED — unit error.** The source's 100 MB / 200 MB are array *element counts*, not megabytes; the real allocation is ~800 MiB / ~1.6 GiB. Budgeting artwork against 100 MB would have been absurdly conservative. |
| "Decoded bytes = w × h × 4, always, regardless of format" | **REFUTED.** bpp spans **1.5–8** (JPEG kept as YUV planes; HDR in RGBA_F16), and dimensions are the **rendered** size, not intrinsic — Chromium stores a 1000² image shown at 240² as 250². Off by 16× in the common case. |
| "Chromium checkers any image ≥ 1 MB decoded (512×512)" | **REFUTED.** `enable_checker_imaging` is `false` everywhere outside cc unit tests; the threshold is never consulted in shipping Chrome. Dropped from this budget. |
| "Safari caps total canvas memory at 384 MB" | **REFUTED — removed from WebKit in 2023.** iOS canvas max is now 8192×8192 (raised from 4096² in 2024). |
| "Edge fleet: low-end ≤4 GB = 30% of the Android fleet" | **REFUTED — scope error.** That table is Windows **desktop** telemetry, not Android. The article gives no per-RAM Android split. |
| "`LOW_MEMORY_DEVICE_THRESHOLD_MB` = 512 MB" | **CORRECTED** — 2048 MB desktop, 1024 MB Android/iOS. |
| "iOS Safari runs graduated 50%/65% memory-pressure passes" | **CORRECTED** — that is macOS (33%/50%); `PERIODIC_MEMORY_MONITOR` is off for iOS, where the kill is jetsam-delegated. |
| "iPhone 12 jetsam limit = 2098 MB" | **REFUTED** — an uncorroborated 2021 forum post, not a crash log or an Apple figure. |
| "iOS jetsam fallback = 840 MB" | **CORRECTED** — the 840 literal is real but rounds up to **896 MB**, and it is per *process*, not per device. |

Numbers used here that could **not** be sourced, and are labelled as derived planning figures rather
than facts: safe texture memory on mid-tier Android; the script/layout vs paint/composite split of
the ~5 ms frame budget; thermal throttling under a web workload in a vehicle; and any cold-start or
memory-budget difference between an installed PWA and a browser tab.

No per-component KB budget for illustrated/skeuomorphic design systems exists in any published
guidance — web.dev, Chrome for Developers, Smashing, Web Performance Calendar all stop at the page
and resource-type level. §5.1 is derived by dividing a page budget, not cited.
