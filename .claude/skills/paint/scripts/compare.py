# stack mockup over recreation: python3 compare.py <mockup> <recreation> <out>
from PIL import Image; import sys
a = Image.open(sys.argv[1]).convert('RGB'); b = Image.open(sys.argv[2]).convert('RGB')
c = Image.new('RGB',(max(a.width,b.width), a.height+b.height+8),(10,10,10))
c.paste(a,(0,0)); c.paste(b,(0,a.height+8)); c.save(sys.argv[3])
