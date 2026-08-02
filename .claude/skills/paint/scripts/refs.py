# Reference set for a master copy: python3 refs.py <mockup> <outdir> [fx,fy,fw,fh]
# Produces: -color, -gray, -notan3 (light/mid/dark), -poster5, -focal (3x crop).
# Judge VALUE against -gray and -notan3. Never judge value from the color image.
from PIL import Image
import os, sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
base = os.path.join(out, os.path.splitext(os.path.basename(src))[0])
im = Image.open(src).convert('RGB')
im.save(base + '-color.png')

g = im.convert('L')
g.save(base + '-gray.png')

def posterize(gray, n):
    """Flatten to n evenly-spaced values — the notan."""
    step = 256 // n
    lut = [min(255, (v // step) * step + step // 2) for v in range(256)]
    return gray.point(lut)

posterize(g, 3).save(base + '-notan3.png')
posterize(g, 5).save(base + '-poster5.png')

if len(sys.argv) > 3:
    x, y, w, h = (int(v) for v in sys.argv[3].split(','))
    c = im.crop((x, y, x + w, y + h))
    c.resize((c.width * 3, c.height * 3), Image.NEAREST).save(base + '-focal.png')

# lightest / darkest, and the five value anchors to author as --v1..--v5
px = g.load()
vals = sorted(px[x, y] for y in range(im.height) for x in range(im.width))
print('size', im.size, 'ratio %.4f' % (im.width / im.height))
print('darkest', vals[len(vals) // 200], 'lightest', vals[-len(vals) // 200])
print('v1..v5', [vals[int(len(vals) * f)] for f in (.05, .27, .5, .73, .95)])
