from PIL import Image
import sys
CELLS = {
 'c1': (0,0,350,100),    # header-left: frame corner, ticks, etched circuit
 'c2': (330,5,895,100),  # header board
 'c3': (880,0,1098,100), # FAILED plate + frame right end
 'c4': (20,95,340,217),  # row-left: frame corner, hex icon, name, facts start
 'c5': (300,100,710,217),# facts tail + row ticks
 'c6': (680,95,1098,217),# row board + right frame + bottom rails
}
src, prefix = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
for k,(x0,y0,x1,y1) in CELLS.items():
    c = im.crop((x0,y0,x1,y1))
    c.resize((c.width*3, c.height*3), Image.NEAREST).save(f'grid/{prefix}-{k}.png')
print('cut', prefix)
