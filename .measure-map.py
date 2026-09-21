# 临时探针 v3：从药丸内部种子做连通域填充（宽窗口），量出完整药丸包围盒
from PIL import Image, ImageDraw

im = Image.open('/tmp/ref-map.png').convert('RGB')
W, H = im.size
px = im.load()

seeds = {
    'chiangmai': (350, 165),
    'chiangrai': (680, 72),
    'sukhothai': (800, 218),
    'ayutthaya': (836, 350),
    'isan': (1076, 352),
    'bangkok': (600, 424),
    'phuket': (270, 662),
    'krabi': (580, 735),
    'samui': (930, 817),
}


def pill(c):
    r, g, b = c
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    return lum < 52 and (g - r) < 12 and (b - r) < 15


out = {}
for name, (sx, sy) in seeds.items():
    x0w, x1w = max(0, sx - 300), min(W, sx + 300)
    y0w, y1w = max(0, sy - 130), min(H, sy + 130)
    seen = set()
    stack = [(sx, sy)]
    minx = maxx = sx
    miny = maxy = sy
    while stack:
        x, y = stack.pop()
        if (x, y) in seen:
            continue
        seen.add((x, y))
        minx, maxx = min(minx, x), max(maxx, x)
        miny, maxy = min(miny, y), max(maxy, y)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if x0w <= nx < x1w and y0w <= ny < y1w and (nx, ny) not in seen and pill(px[nx, ny]):
                stack.append((nx, ny))
    leak = "LEAK?" if len(seen) > 40000 else ""
    out[name] = (minx, miny, maxx, maxy)
    print(
        f'{name:12s} x={minx:4d}..{maxx:4d} y={miny:4d}..{maxy:4d} w={maxx-minx+1:4d} h={maxy-miny+1:4d}'
        f'  cx={(minx+maxx)/2/W*100:5.2f}% cy={(miny+maxy)/2/H*100:5.2f}% area={len(seen)} {leak}'
    )

vis = im.copy()
d = ImageDraw.Draw(vis)
for name, (x0, y0, x1, y1) in out.items():
    d.rectangle([x0, y0, x1, y1], outline=(255, 40, 40), width=3)
vis.save('/tmp/chip-rects3.png')
for name, (x0, y0, x1, y1) in out.items():
    vis.crop((max(0, x0 - 24), max(0, y0 - 20), x1 + 24, y1 + 20)).resize(
        ((x1 - x0 + 48) * 2, (y1 - y0 + 40) * 2)
    ).save(f'/tmp/chk3-{name}.png')
print('saved')
