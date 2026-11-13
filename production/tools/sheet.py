# usage: python3 sheet.py out.jpg img1 img2 ...  -> side-by-side contact sheet (each image scaled to 480 px tall), with frame labels
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f).convert("RGB") for f in files]
ims = [i.resize((int(i.width * 480 / i.height), 480)) for i in ims]
s = Image.new("RGB", (sum(i.width for i in ims), 500), "white"); x = 0
d = ImageDraw.Draw(s)
for f, i in zip(files, ims):
    s.paste(i, (x, 20)); d.text((x + 4, 3), f.split("/")[-1], fill="black"); x += i.width
s.save(out, quality=85)
