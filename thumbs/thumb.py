from PIL import Image, ImageDraw, ImageFont
import numpy as np

W, H = 1280, 670

BLACK_F = '/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
MED_F   = '/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc'
REG_F   = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'


def f(path, size):
    return ImageFont.truetype(path, size, index=0)


# ---------- colors ----------
INK      = (31, 35, 55)
INK_SOFT = (95, 103, 130)
PINK     = (255, 107, 138)
PINK_BG  = (255, 231, 237)
PINK_LN  = (255, 176, 195)
BLUE     = (47, 111, 237)
BLUE_BG  = (226, 236, 255)
BLUE_LN  = (163, 193, 255)
MARKER   = (255, 224, 102)

# ---------- diagonal gradient background ----------
c1 = np.array([255, 243, 246], dtype=float)   # pink tint
c2 = np.array([233, 240, 255], dtype=float)   # blue tint
yy, xx = np.mgrid[0:H, 0:W]
t = (xx / W * 0.72 + yy / H * 0.28)
t = np.clip(t, 0, 1)[..., None]
arr = (c1 * (1 - t) + c2 * t).astype(np.uint8)
img = Image.fromarray(arr, 'RGB')
d = ImageDraw.Draw(img, 'RGBA')

# ---------- subtle circuit decoration ----------
for i in range(0, W, 44):
    for j in range(0, H, 44):
        d.ellipse([i - 2, j - 2, i + 2, j + 2], fill=(120, 140, 200, 22))

# faint chip trace lines (top-right area)
trace = (150, 170, 220, 34)
for k, (sx, sy) in enumerate([(880, -40), (960, -40), (1040, -40)]):
    d.line([(sx, sy), (sx, 70 + k * 26), (1300, 70 + k * 26)], fill=trace, width=3)

# corner blobs
d.ellipse([-160, -190, 260, 230], fill=(255, 200, 214, 60))
d.ellipse([1010, 430, 1440, 860], fill=(180, 205, 255, 65))

# ---------- top badge row ----------
badge_f = f(BLACK_F, 30)
label = '第 1 話'
bb = d.textbbox((0, 0), label, font=badge_f)
bw, bh = bb[2] - bb[0], bb[3] - bb[1]
bx, by = 72, 56
pad_x, pad_y = 26, 16
d.rounded_rectangle([bx, by, bx + bw + pad_x * 2, by + bh + pad_y * 2],
                    radius=(bh + pad_y * 2) // 2, fill=INK)
d.text((bx + pad_x, by + pad_y - bb[1]), label, font=badge_f, fill=(255, 255, 255))

kicker_f = f(MED_F, 27)
kx = bx + bw + pad_x * 2 + 22
d.text((kx, by + pad_y + 2), 'ITパスポート過去問  ラブコメ解説', font=kicker_f, fill=INK_SOFT)

# ---------- main title ----------
t_f = f(BLACK_F, 78)
line1 = '電源を切ると'
line2 = '消えるメモリは？'
tx, ty = 72, 168
lh = 104

# marker highlight behind line2 (蛍光ペン風)
w2 = d.textlength('消えるメモリ', font=t_f)
d.rounded_rectangle([tx - 10, ty + lh + 26, tx + w2 + 10, ty + lh + 100],
                    radius=8, fill=MARKER + (145,))

d.text((tx, ty), line1, font=t_f, fill=INK)
d.text((tx, ty + lh), line2, font=t_f, fill=INK)

# accent bar
d.rounded_rectangle([tx, ty - 34, tx + 92, ty - 24], radius=5, fill=PINK)

# ---------- subtitle ----------
s_f = f(BLACK_F, 32)
sy_ = ty + lh + 128
d.text((tx, sy_), 'ツンデレ女子大生', font=s_f, fill=PINK)
xw = d.textlength('ツンデレ女子大生', font=s_f)
d.text((tx + xw + 14, sy_), '×', font=s_f, fill=INK_SOFT)
xw2 = d.textlength('× ', font=s_f)
d.text((tx + xw + 14 + xw2 + 8, sy_), '東大パソコンオタク', font=s_f, fill=BLUE)

# ---------- footer ----------
ft = f(MED_F, 25)
d.text((tx, H - 96), '令和6年度 問56 ／ テクノロジ系・コンピュータ構成要素', font=ft, fill=INK_SOFT)

ans_f = f(BLACK_F, 26)
choices = ['ア DVD-RAM', 'イ DRAM', 'ウ ROM', 'エ フラッシュメモリ']
cx = tx
for i, c in enumerate(choices):
    cw = d.textlength(c, font=ans_f)
    fill = (255, 255, 255, 235)
    line = (206, 214, 232)
    tcol = INK_SOFT
    d.rounded_rectangle([cx, H - 58, cx + cw + 30, H - 14], radius=22,
                        fill=fill, outline=line, width=2)
    d.text((cx + 15, H - 50), c, font=ans_f, fill=tcol)
    cx += cw + 30 + 12


# ---------- speech bubbles ----------
def bubble(x, y, w, lines, font, fill, outline, tail='left', name=None,
           name_col=INK_SOFT, name_font=None, sub=None, sub_font=None):
    lh_ = font.size + 14
    h = len(lines) * lh_ + 44
    d.rounded_rectangle([x, y, x + w, y + h], radius=26, fill=fill,
                        outline=outline, width=3)
    if tail == 'left':
        d.polygon([(x + 6, y + h - 46), (x - 26, y + h - 8), (x + 44, y + h - 20)],
                  fill=fill, outline=outline)
        d.line([(x + 8, y + h - 44), (x + 42, y + h - 22)], fill=fill, width=4)
    for i, ln in enumerate(lines):
        d.text((x + 28, y + 22 + i * lh_), ln, font=font, fill=INK)
    if name:
        d.text((x + w - d.textlength(name, font=name_font) - 6, y - 40),
               name, font=name_font, fill=name_col)
    if sub:
        d.text((x + 6, y + h + 12), sub, font=sub_font, fill=INK_SOFT)
    return y + h


bf = f(MED_F, 27)
nf = f(BLACK_F, 26)
sf = f(REG_F, 21)

bx0, bw0 = 812, 400
end1 = bubble(bx0, 176, bw0,
              ['フラッシュって', 'パッと消えそう', じ := 'じゃない？'],
              bf, PINK_BG + (255,), PINK_LN, tail='left',
              name='美咲', name_col=PINK, name_font=nf)

bubble(bx0 - 6, end1 + 96, bw0,
       ['……ぶふっ'],
       bf, BLUE_BG + (255,), BLUE_LN, tail='left',
       name='拓也', name_col=BLUE, name_font=nf,
       sub='（この直後、怒られる）', sub_font=sf)

img.save('/mnt/user-data/outputs/note_thumb_ep1_dram.png', 'PNG')
print('saved', img.size)
