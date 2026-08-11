#!/usr/bin/env python3
"""Shape-match a reference typeface against a candidate library, by per-glyph IoU.

Built 2026-08-10 to identify the FIELD CALLS wordmark (ledger #276 — Rajdhani Bold,
0.905) and reused to compare the HUD pair (#277). Lives here because the pipeline is
worth more than the answers it produced, and a session scratchpad does not survive.

    python3 tools/design/font-match.py --fetch                     # build the candidate cache
    python3 tools/design/font-match.py ref.ttf ABCDEFGHIJKLM       # rank candidates
    python3 tools/design/font-match.py -a A.ttf -b B.ttf ABCDEFG   # compare two directly

HOW TO READ A SCORE — calibrated on this project's own runs:
    0.90+        an identification. Rajdhani Bold scored 0.905 on the wordmark.
    0.75 - 0.89  same genre, very close cousin. Quantico 0.84 against that wordmark.
    0.70         the same-typeface threshold. Above it, do not expect a reader to tell them apart.
    0.60 - 0.75  same genre, different face. Chakra Petch Bold vs Oxanium Bold = 0.751 (#277).
    0.16 - 0.24  the noise floor. Unrelated faces live here.

THE TWO THINGS THAT MAKE IT WORK, both learned the hard way:

1. CAP-HEIGHT NORMALISATION FIRST. Every face is scaled so its `H` matches a common cap
   before any glyph is compared. Skip it and you are measuring point size, not shape, and
   every condensed face wins by accident.

2. Weight is part of identity, not a free variable. A family differs from its OWN bold by
   more than it differs from another family's bold — measured: Chakra Petch 400 vs 700 =
   0.582, while ChakraPetch-700 vs Oxanium-700 = 0.751. Always compare like weight to like,
   and never conclude "different family" from a score that could be a weight mismatch.

Google Fonts serves TTF instead of WOFF2 to an old User-Agent, which is what makes the
candidate cache buildable without a font binary on disk. That trick is `--fetch` below.
"""
import sys, os, glob, argparse, urllib.request
from PIL import Image, ImageDraw, ImageFont
import numpy as np

CAP = 200                                    # common cap height, in px, for all comparisons
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fontcache")

# The 2026-08-10 sweep set: squarish/techno/industrial faces plus enough neutrals to
# establish a noise floor. Weighted pairs where the family ships a bold.
CANDIDATES = """Aldrich:400 Anta:400 Audiowide:400 BigShouldersDisplay:400,700 BrunoAce:400
ChakraPetch:400,700 Doto:400 Electrolize:400 Exo2:400,700 Federo:400 Genos:400 Gruppo:400
Iceland:400 Jura:400,700 Kanit:400,700 Khand:400,700 KronaOne:400 Michroma:400 NovaSquare:400
Orbitron:400,700 Oxanium:400,700 Play:400,700 Quantico:400,700 Rajdhani:400,700 Saira:400,700
SairaCondensed:400,700 SairaSemiCondensed:400 Sarpanch:400,700 ShareTech:400 ShareTechMono:400
Syncopate:400,700 Teko:400,700 TitilliumWeb:400,700 Tomorrow:400,700 UnicaOne:400 Wallpoet:400
ZenDots:400""".split()


def fetch():
    """Populate the candidate cache. Google Fonts hands TTF to an old User-Agent."""
    os.makedirs(CACHE, exist_ok=True)
    got = skip = fail = 0
    for spec in CANDIDATES:
        fam, weights = spec.split(":")
        for w in weights.split(","):
            dest = os.path.join(CACHE, f"{fam}-{w}.ttf")
            if os.path.exists(dest):
                skip += 1
                continue
            css = f"https://fonts.googleapis.com/css?family={fam.replace('_', '+')}:{w}"
            try:
                req = urllib.request.Request(css, headers={"User-Agent": "Mozilla/4.0"})
                body = urllib.request.urlopen(req, timeout=30).read().decode()
                url = body.split("url(")[1].split(")")[0].strip("'\"")
                urllib.request.urlretrieve(url, dest)
                got += 1
            except Exception as e:
                print(f"  ! {fam}-{w}: {e}", file=sys.stderr)
                fail += 1
    print(f"cache {CACHE}: +{got} fetched, {skip} already present, {fail} failed")


def size_for_cap(path, cap=CAP):
    """Point size at which this face's cap height equals `cap` px. Rule 1 above."""
    base = 100
    f = ImageFont.truetype(path, base)
    im = Image.new("L", (600, 400), 0)
    ImageDraw.Draw(im).text((50, 300), "H", font=f, fill=255, anchor="ls")
    ys = np.where((np.array(im) > 100).any(axis=1))[0]
    return None if not len(ys) else base * cap / (ys.max() - ys.min() + 1)


def glyph(path, ch, size):
    """One glyph as a tight-cropped boolean mask."""
    f = ImageFont.truetype(path, size)
    W = H = int(size * 3)
    im = Image.new("L", (W, H), 0)
    ImageDraw.Draw(im).text((W * 0.25, H * 0.7), ch, font=f, fill=255, anchor="ls")
    a = np.array(im) > 100
    if not a.any():
        return None
    ys, xs = np.where(a.any(axis=1))[0], np.where(a.any(axis=0))[0]
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def iou(m1, m2):
    """Intersection-over-union of two masks, centred on a common canvas."""
    h, w = max(m1.shape[0], m2.shape[0]) + 8, max(m1.shape[1], m2.shape[1]) + 8
    def place(m):
        c = np.zeros((h, w), bool)
        y, x = (h - m.shape[0]) // 2, (w - m.shape[1]) // 2
        c[y:y + m.shape[0], x:x + m.shape[1]] = m
        return c
    a, b = place(m1), place(m2)
    u = (a | b).sum()
    return (a & b).sum() / u if u else 0.0


def profile(path, chars):
    s = size_for_cap(path)
    if not s:
        return None
    out = {}
    for ch in chars:
        g = glyph(path, ch, int(round(s)))
        if g is not None:
            out[ch] = g
    return out


def compare(ref, cand):
    ks = [k for k in ref if k in cand]
    if len(ks) < 8:                       # too few shared glyphs to mean anything
        return None, 0
    return float(np.mean([iou(ref[k], cand[k]) for k in ks])), len(ks)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fetch", action="store_true", help="build/refresh the candidate cache, then exit")
    ap.add_argument("-a", help="compare this face directly against -b instead of ranking")
    ap.add_argument("-b", help="the other face for a direct comparison")
    ap.add_argument("ref", nargs="?", help="reference .ttf to rank candidates against")
    ap.add_argument("chars", nargs="?", default=None,
                    help="glyphs to compare. Use only glyphs the reference actually has. "
                         "Defaults to upper+lower+digits; pass a subset for a baked wordmark.")
    ap.add_argument("--chars", dest="chars_opt", default=None,
                    help="same as the positional, for use alongside -a/-b")
    args = ap.parse_args()

    # Widest default: caps ALONE overstate similarity, because the squarish techno faces
    # this project shortlists diverge mostly in their lowercase. Measured on the same pair:
    # A-Z gives ChakraPetch-700 vs Oxanium-700 = 0.805, the full 62 glyphs gives 0.751.
    # Always say which set a quoted score came from.
    DEFAULT_CHARS = ("ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                     "abcdefghijklmnopqrstuvwxyz0123456789")
    if args.a and args.b:
        # in direct-compare mode the lone positional is the charset, not a font path
        args.chars = args.chars_opt or args.chars or args.ref or DEFAULT_CHARS
    else:
        args.chars = args.chars_opt or args.chars or DEFAULT_CHARS

    if args.fetch:
        return fetch()

    if args.a and args.b:
        m, n = compare(profile(args.a, args.chars), profile(args.b, args.chars))
        print(f"{m:.3f}  ({n} glyphs)  {os.path.basename(args.a)} vs {os.path.basename(args.b)}")
        return

    if not args.ref:
        ap.error("give a reference .ttf, or -a/-b for a direct comparison, or --fetch")

    pool = sorted(glob.glob(os.path.join(CACHE, "*.ttf")))
    if not pool:
        ap.error(f"candidate cache is empty — run:  {sys.argv[0]} --fetch")

    ref = profile(args.ref, args.chars)
    rows = []
    for p in pool:
        c = profile(p, args.chars)
        if not c:
            continue
        m, n = compare(ref, c)
        if m is not None:
            rows.append((m, os.path.basename(p)[:-4], n))
    rows.sort(reverse=True)

    for m, name, n in rows[:14]:
        print(f"{m:.3f}  {name:32} ({n} glyphs)")
    print("---- noise floor (worst 3), for calibration")
    for m, name, n in rows[-3:]:
        print(f"{m:.3f}  {name:32}")


if __name__ == "__main__":
    main()
