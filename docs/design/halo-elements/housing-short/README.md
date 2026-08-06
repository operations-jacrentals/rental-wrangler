# `asm-housing-short` — the 117px subitem row, and how it was verified

Backs **SLICE-SPEC §7** and **ledger #283**. The decision and the numbers live there; this
folder holds the art either side of the cut and the three scripts that measured it.

| file | what it is |
|---|---|
| `housing-151.png` | the original housing, native 1171×151 |
| `housing-117.png` | the short variant, native 1171×117 |
| `rowscan.mjs` | finds which rows are real detail and which are near-flat |
| `bevel-identity.mjs` | whole-band pixel diff of both bevels |
| `bevel-diff.mjs` | localises band differences by column |

Chromium comes from `/opt/pw-browsers/chromium_headless_shell-1194` — the **headless shell**,
not `chromium-*/chrome`, which errors with *"Old Headless mode has been removed"*.

```sh
node rowscan.mjs         housing-151.png
node bevel-identity.mjs  housing-151.png housing-117.png
node bevel-diff.mjs      housing-151.png housing-117.png
```

## What they establish

`rowscan.mjs` on the 151 gives the band structure the cut depends on — **top bevel y 0–24** and
**bottom bevel y 126–150** are dense (1000+ of 1171 columns change per row), while the interior
**y 25–125** is near-flat (16–40 columns per row, all slowly-travelling diagonals).

`bevel-identity.mjs` reports the bevels are **not** identical end-to-end — ~4% of the top band and
~0.9% of the bottom. **That is the expected result, not a failure.** `bevel-diff.mjs` says why: the
differing columns are the three staircase diagonals (x 67–269, 537–730, 977–1149) and the left-end
groove (x 6–65), which are *interior* features that extend up into the bevel band and so
legitimately moved. Everywhere the bevel is just frame — top columns 270–536, 731–976, 1150–1164 —
the diff is **zero**.

The real guarantee is structural rather than pixel-wise: the vertex map is the identity below
y 28 and a pure −34 translation above y 126.38, so **no bevel geometry is distorted, only moved.**
The pixel checks are corroboration.

Both scripts abort if a compared crop has fewer than 3–4 distinct colours — **ledger #282**,
blank-vs-blank reports a perfect 0% match and is the most dangerous possible false pass.
