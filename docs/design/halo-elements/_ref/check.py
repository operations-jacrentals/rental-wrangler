# Part-vs-reference pixel check for the Halo elements kit.
#
#   python3 _ref/check.py <part.html> <W> <H> <refX> <refY> [outPrefix] [--full]
#
# Crops a WxH window out of _ref/original.png at (refX, refY) and reports how
# far the part's own render is from it.  Writes <outPrefix>-part.png,
# <outPrefix>-ref.png and <outPrefix>-diff.png (stacked ref / part / amplified
# delta) next to the part.
#
# PASS BAR for an extraction: mean delta <= 1.0 and >=99.0% of pixels within 8.
# Anything worse means the part did not come out of the canvas cleanly — the
# usual cause is an origin offset that is off by a fraction of a pixel, or a
# rule that was left behind on the stage instead of moving with the part.
#
# --------------------------------------------------------------------------
# TWO RENDER MODES, and you want --full
#
#   default : render the page at WxH and compare from (0,0). The verify page
#             carries a WxH stage and the part rebased into it.
#   --full  : render the page at the canvas's own 1292x635 and crop the SAME
#             (refX, refY, W, H) window out of the render. The verify page
#             carries a full 1292x635 stage and the part at its TRUE canvas
#             coordinates — no rebase arithmetic, so one less thing to get
#             wrong.
#
# --full exists because the default mode has a measurable floor. Chrome
# rasterises a fractionally-sized box — especially one carrying a clip-path —
# against the enclosing stage, so the SAME markup lands on a different pixel
# grid in a 944-wide stage than in a 1292-wide one. Measured on c4-panel-frame,
# whose body is 914.5px wide and clipped: the original's own untouched markup
# scores mean 0.288 / max 84 in a 944-wide stage and mean 0.000 / max 0 in the
# real 1292-wide one. That 0.288 is the harness, not the part — and a floor
# like that is exactly where a real 1px defect would hide. Prefer --full.
FULL_W, FULL_H = 1292, 635
import os
import subprocess
import sys

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
SHOT = os.path.join(REPO, '.claude', 'skills', 'paint', 'scripts', 'shot.mjs')
REF = os.path.join(HERE, 'original.png')


def render(html, out, w, h):
    r = subprocess.run(['node', SHOT, html, out, str(w), str(h)],
                       capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stdout, r.stderr)
        sys.exit('render failed: ' + html)


def main():
    args = [a for a in sys.argv[1:] if a != '--full']
    full = '--full' in sys.argv
    if len(args) < 5:
        sys.exit('usage: check.py <part.html> <W> <H> <refX> <refY> [outPrefix] [--full]')
    html = os.path.abspath(args[0])
    w, h, rx, ry = (int(float(v)) for v in args[1:5])
    prefix = args[5] if len(args) > 5 else os.path.splitext(html)[0]

    part_png = prefix + '-part.png'
    ref_png = prefix + '-ref.png'
    diff_png = prefix + '-diff.png'

    if full:
        render(html, part_png, FULL_W, FULL_H)
        part = Image.open(part_png).convert('RGB').crop((rx, ry, rx + w, ry + h))
        part.save(part_png)
    else:
        render(html, part_png, w, h)
        part = Image.open(part_png).convert('RGB')

    ref = Image.open(REF).convert('RGB').crop((rx, ry, rx + w, ry + h))
    ref.save(ref_png)

    delta = ImageChops.difference(ref, part)
    r, g, b = delta.split()
    worst = ImageChops.lighter(ImageChops.lighter(r, g), b).tobytes()
    n = len(worst)
    mean = sum(worst) / n
    within8 = 100.0 * sum(1 for v in worst if v <= 8) / n
    within16 = 100.0 * sum(1 for v in worst if v <= 16) / n

    stack = Image.new('RGB', (w, h * 3 + 16), (10, 10, 10))
    stack.paste(ref, (0, 0))
    stack.paste(part, (0, h + 8))
    stack.paste(delta.point(lambda v: min(255, v * 6)), (0, h * 2 + 16))
    stack.save(diff_png)

    verdict = 'PASS' if (mean <= 1.0 and within8 >= 99.0) else 'FAIL'
    print(f'{verdict}  {os.path.basename(html)}  {w}x{h} @ ({rx},{ry})'
          f'{"  [full-canvas render]" if full else ""}')
    print(f'  mean delta {mean:.3f}   max {max(worst)}   '
          f'within8 {within8:.2f}%   within16 {within16:.2f}%')
    print(f'  stacked ref/part/delta -> {diff_png}')
    sys.exit(0 if verdict == 'PASS' else 1)


main()
