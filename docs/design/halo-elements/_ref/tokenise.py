#!/usr/bin/env python3
"""Rewrite the part sheets' literal colours into knob-driven hsl().

WHY
The kit painted every surface as a literal hex — 934 of them, mostly gradient
stops. That is where the machined texture lives, so the colours cannot be
collapsed onto a handful of named tokens without flattening the sculpt. Instead
each literal is rewritten as a function of the steel knobs while keeping its
OWN character:

    hsl(calc(var(--steel-h) + <dh>) calc(var(--steel-s) * <ks>)
        calc(<L>% * var(--steel-tint)))

  dh  this colour's hue offset from the 212deg reference axis
  ks  this colour's saturation as a ratio of the 30% reference
  L   this colour's own lightness, untouched

LOSSLESS BY CONSTRUCTION
--steel-spread scales dh. At spread 1 / h 212 / s 30% / tint 1 every colour
resolves back to exactly what it was, so the render is pixel-identical to the
original and the kit's own pixel gate still passes. At spread 0 the hue scatter
(197-283deg, the thing that read as "the conduit and housing don't match")
collapses onto one axis. The knob is the fix AND the proof.

Saturated status colours — the reds, yellows, greens, blues — are NOT touched
here; they are signal, not steel, and they follow --row-hue instead.

    python3 _ref/tokenise.py --dry     report only
    python3 _ref/tokenise.py           rewrite in place
"""
import re, sys, glob, colorsys, pathlib, collections

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent

REF_HUE = 212.0     # the axis every steel colour is measured against
REF_SAT = 30.0      # the saturation --steel-s is expressed in
SAT_CEILING = 0.34  # outside the cool band, above this is signal not steel
COOL_BAND = (170.0, 265.0)   # hues that are steel whatever their saturation

# Saturation alone cannot tell steel from signal: a very dark blued groove such
# as #070e16 measures sat .52 purely because it is dark, and a naive threshold
# throws it out as if it were a red. Hue decides first — anything already on the
# cool band IS steel — and saturation only arbitrates outside that band.

LIGHT_CEILING = 0.92  # near-white is type/specular highlight, leave it literal
DARK_FLOOR = 0.02     # pure black carries no hue to move

TARGETS = sorted(glob.glob(str(ROOT / "parts" / "*.css")) +
                 glob.glob(str(ROOT / "assembly" / "*.css")))

HEX = re.compile(r'#([0-9a-fA-F]{6})\b')


def to_hsl(h):
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    return hh * 360, s, l


def convert(hexbody):
    """literal -> knob-driven hsl(), or None to leave it alone."""
    hue, sat, lig = to_hsl(hexbody)
    if lig > LIGHT_CEILING or lig < DARK_FLOOR:
        return None                      # type / specular / pure black
    in_cool = COOL_BAND[0] <= hue <= COOL_BAND[1]
    if not in_cool and sat > SAT_CEILING:
        return None                      # signal colour, follows --row-hue
    if sat < 0.012:
        # effectively neutral: no meaningful hue to preserve, ride the axis
        dh, ks = 0.0, 0.0
    else:
        dh = ((hue - REF_HUE + 180) % 360) - 180     # shortest way round
        ks = (sat * 100) / REF_SAT
    l_pct = lig * 100

    hue_expr = "var(--steel-h)" if abs(dh) < 0.05 else \
               "calc(var(--steel-h) + %s)" % _num(dh * 1.0)
    if abs(dh) >= 0.05:
        hue_expr = "calc(var(--steel-h) + %s * var(--steel-spread))" % _num(dh)
    sat_expr = "0%" if ks == 0 else (
        "var(--steel-s)" if abs(ks - 1) < 0.005 else
        "calc(var(--steel-s) * %s)" % _num(ks))
    return "hsl(%s %s calc(%s%% * var(--steel-tint)))" % (hue_expr, sat_expr, _num(l_pct))


def _num(v):
    s = ("%.3f" % v).rstrip("0").rstrip(".")
    return s if s not in ("", "-0") else "0"


def main():
    dry = "--dry" in sys.argv
    seen = collections.Counter()
    skipped = collections.Counter()
    touched = 0

    for path in TARGETS:
        src = pathlib.Path(path).read_text()

        def sub(m):
            nonlocal touched
            body = m.group(1).lower()
            out = convert(body)
            if out is None:
                skipped[body] += 1
                return m.group(0)
            seen[body] += 1
            touched += 1
            return out

        new = HEX.sub(sub, src)
        if new != src and not dry:
            pathlib.Path(path).write_text(new)

    print("files scanned      : %d" % len(TARGETS))
    print("literals rewritten : %d  (%d distinct)" % (touched, len(seen)))
    print("left as signal     : %d  (%d distinct)" % (sum(skipped.values()), len(skipped)))
    if skipped:
        print("  e.g. " + ", ".join("#" + k for k in sorted(skipped)[:8]))
    print("mode               : %s" % ("DRY RUN — nothing written" if dry else "written in place"))


if __name__ == "__main__":
    main()
