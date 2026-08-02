# Part-vs-reference pixel check for the Halo elements kit.
#
#   python3 _ref/check.py <part.html> <W> <H> <refX> <refY> [outPrefix]
#
# Renders <part.html> at WxH (transparent-free, black canvas), crops the same
# WxH window out of _ref/original.png at (refX, refY), and reports how far the
# two are apart.  Writes <outPrefix>-part.png, <outPrefix>-ref.png and
# <outPrefix>-diff.png (stacked ref / part / amplified delta) next to the part.
#
# PASS BAR for an extraction: mean delta <= 1.0 and >=99.0% of pixels within 8.
# Anything worse means the part did not come out of the canvas cleanly — the
# usual cause is an origin offset that is off by a fraction of a pixel, or a
# rule that was left behind on the stage instead of moving with the part.
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
    if len(sys.argv) < 6:
        sys.exit(__doc__ or 'usage: check.py <part.html> <W> <H> <refX> <refY> [outPrefix]')
    html = os.path.abspath(sys.argv[1])
    w, h, rx, ry = (int(float(v)) for v in sys.argv[2:6])
    prefix = sys.argv[6] if len(sys.argv) > 6 else os.path.splitext(html)[0]

    part_png = prefix + '-part.png'
    ref_png = prefix + '-ref.png'
    diff_png = prefix + '-diff.png'

    render(html, part_png, w, h)

    ref = Image.open(REF).convert('RGB').crop((rx, ry, rx + w, ry + h))
    ref.save(ref_png)
    part = Image.open(part_png).convert('RGB')

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
    print(f'{verdict}  {os.path.basename(html)}  {w}x{h} @ ({rx},{ry})')
    print(f'  mean delta {mean:.3f}   max {max(worst)}   '
          f'within8 {within8:.2f}%   within16 {within16:.2f}%')
    print(f'  stacked ref/part/delta -> {diff_png}')
    sys.exit(0 if verdict == 'PASS' else 1)


main()
