# 生成泰国探索者素材：
#   1. 地图底图 = 参考稿，但把烘焙在上面的 5 处 UI 云团（罗盘/标题/路线栏/进度卡/提示条）
#      用「边界扩散 + 羽化合成」抹掉（比 ffmpeg delogo 平滑得多，云层上无硬边）；
#      九块城市标签**不抹**——真实标签会以地图坐标系贴在原位把它们完整盖住，
#      这样拖动/缩放时标签与地图始终同步。
#   2. 九座城市的圆形缩略图（从参考稿裁切真实场景，已避开标签）
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SRC = '/tmp/ref-map.png'
OUT = os.environ['ROOT'] + '/public/images/explorer'
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
W, H = im.size
arr = np.asarray(im, dtype=np.float32)

# 烘焙 UI 簇的矩形（左, 上, 右, 下）——比实际 UI 稍大一圈
CLUSTERS = [
    (25, 15, 190, 185),      # 罗盘
    (1158, 15, 1514, 218),   # THAILAND EXPLORER / 泰国探索者 标题块
    (1158, 224, 1488, 775),  # 探索路线栏
    (1158, 775, 1492, 918),  # 探索进度卡
    (14, 888, 484, 1002),    # 左下「点击城市开始探索」提示条
]

for (x0, y0, x1, y1) in CLUSTERS:
    pad = 26
    X0, Y0, X1, Y1 = max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad), min(H, y1 + pad)
    sub = arr[Y0:Y1, X0:X1].copy()
    h, w = sub.shape[:2]
    inner = np.zeros((h, w), dtype=bool)
    inner[pad: h - pad, pad: w - pad] = True
    # 初值：边界像素均值（云层这类平滑区域，扩散结果自然）
    fill = sub.copy()
    fill[inner] = sub[~inner].reshape(-1, 3).mean(axis=0)
    for _ in range(48):
        blur = np.asarray(
            Image.fromarray(fill.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.6)),
            dtype=np.float32,
        )
        fill[inner] = blur[inner]
    # 羽化合成，避免出现矩形硬边
    mask = Image.fromarray((inner * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7))
    m = (np.asarray(mask, dtype=np.float32) / 255.0)[..., None]
    arr[Y0:Y1, X0:X1] = sub * (1 - m) + fill * m

cleaned = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
cleaned.save('/tmp/map-final.png')
subprocess.run(['/Users/zhb/anaconda3/bin/cwebp', '-quiet', '-q', '84',
                '/tmp/map-final.png', '-o', OUT + '/thailand-map.webp'], check=True)
subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '84',
                '/tmp/map-final.png', '--out', OUT + '/thailand-map.jpg'],
               check=True, stdout=subprocess.DEVNULL)

centers = {
    'chiangmai': (390, 300, 176),
    'chiangrai': (500, 130, 176),
    'sukhothai': (600, 300, 176),
    'ayutthaya': (780, 480, 176),
    'isan': (1050, 490, 176),
    'bangkok': (400, 570, 176),
    'phuket': (200, 800, 176),
    'krabi': (480, 860, 176),
    'samui': (900, 935, 150),
}

tiles = []
for name, (cx, cy, size) in centers.items():
    half = size // 2
    x0 = max(0, min(W - size, cx - half))
    y0 = max(0, min(H - size, cy - half))
    crop = im.crop((x0, y0, x0 + size, y0 + size)).resize((256, 256), Image.LANCZOS)
    png = f'/tmp/thumb-{name}.png'
    crop.save(png)
    subprocess.run(['/Users/zhb/anaconda3/bin/cwebp', '-quiet', '-q', '82', png,
                    '-o', f'{OUT}/{name}.webp'], check=True)
    tiles.append((name, crop))

sheet = Image.new('RGB', (3 * 266, 3 * 266), (12, 16, 14))
d = ImageDraw.Draw(sheet)
for i, (name, tile) in enumerate(tiles):
    gx, gy = (i % 3) * 266 + 5, (i // 3) * 266 + 5
    sheet.paste(tile, (gx, gy))
    d.text((gx + 8, gy + 8), name, fill=(255, 240, 200))
sheet.save('/tmp/thumb-sheet.png')
cleaned.resize((1150, 767), Image.LANCZOS).save('/tmp/map-check.png')

print('map webp', os.path.getsize(OUT + '/thailand-map.webp'))
for name, _ in tiles:
    print(name, os.path.getsize(f'{OUT}/{name}.webp'))
