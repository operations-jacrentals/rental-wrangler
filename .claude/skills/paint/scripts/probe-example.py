# PIL sampling patterns proven on 2026-08-02. Adjust predicates/regions per image.
from PIL import Image
im = Image.open('MOCKUP.png').convert('RGB'); px = im.load()
def isred(c): r,g,b=c; return r>150 and g<90 and b<90

# 1) element bbox: scan a bounded region for a color family
# 2) stroke width: count consecutive hits walking inward from an edge
# 3) LEAN DIRECTION (settles skew disputes): x-centers of blobs at two heights;
#    centers shifting RIGHT at larger y == bottom-right lean == CSS skewX(+deg)
def centers(y, x0, x1):
    runs=[]; s=None
    for x in range(x0,x1):
        h=isred(px[x,y])
        if h and s is None: s=x
        if not h and s is not None: runs.append(((s+x-1)//2, x-1-s)); s=None
    return [c for c,w in runs if w>6]
print(centers(30,105,340), centers(60,105,340))
