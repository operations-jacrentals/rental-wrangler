# The four diagnostic checks. python3 diag.py <mode> <mockup> <recreation> <out.png>
#   --overlay  difference map + red-channel alignment flicker (WHERE the error is)
#   --squint   both blurred and downscaled to 25% (the across-the-room read; a GATE)
#   --flip     mirrored and 180-rotated pairs (exposes drawing errors the eye adapts to)
#   --values   both posterized to 5 values, side by side (value structure only)
# An overlay REVEALS an error; it does not replace understanding it. Read the
# mockup after locating a delta — never nudge blindly until the diff shrinks.
from PIL import Image, ImageChops, ImageFilter
import sys

mode, a_path, b_path, out = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
a = Image.open(a_path).convert('RGB')
b = Image.open(b_path).convert('RGB').resize(a.size)


def side_by_side(imgs, gap=8, bg=(10, 10, 10)):
    w = max(i.width for i in imgs)
    c = Image.new('RGB', (w, sum(i.height for i in imgs) + gap * (len(imgs) - 1)), bg)
    y = 0
    for i in imgs:
        c.paste(i.convert('RGB'), (0, y)); y += i.height + gap
    return c


def posterize(im, n=5):
    step = 256 // n
    lut = [min(255, (v // step) * step + step // 2) for v in range(256)]
    return im.convert('L').point(lut).convert('RGB')


if mode == '--overlay':
    diff = ImageChops.difference(a, b)
    boosted = diff.point(lambda v: min(255, v * 4))          # 4x so 2-value drifts show
    # alignment view: mockup in red, recreation in cyan — misregistration fringes
    r = a.convert('L'); c = b.convert('L')
    align = Image.merge('RGB', (r, c, c))
    side_by_side([boosted, align]).save(out)
    bbox = diff.convert('L').point(lambda v: 255 if v > 24 else 0).getbbox()
    print('worst-delta bbox', bbox)

elif mode == '--squint':
    def squint(im):
        s = im.filter(ImageFilter.GaussianBlur(2)).resize(
            (max(1, im.width // 4), max(1, im.height // 4)), Image.LANCZOS)
        return s.resize(im.size, Image.NEAREST)
    side_by_side([squint(a), squint(b)]).save(out)

elif mode == '--flip':
    side_by_side([
        a.transpose(Image.FLIP_LEFT_RIGHT), b.transpose(Image.FLIP_LEFT_RIGHT),
        a.rotate(180), b.rotate(180),
    ]).save(out)

elif mode == '--values':
    side_by_side([posterize(a), posterize(b)]).save(out)

else:
    sys.exit('mode must be --overlay | --squint | --flip | --values')

print(mode, '->', out)
