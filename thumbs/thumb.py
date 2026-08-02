#!/usr/bin/env python3
"""
記事のメタ情報から note 用サムネイル（1280x670）を生成する。

    python3 thumbs/thumb.py 3

episodes/epNNN.md 先頭のメタブロックから読む項目:
    episode / part / year / number / domain / location
    thumb_title : 大見出し（無ければ H1 から推定）
    thumb_a     : 美咲のセリフ（ピンクの吹き出し）
    thumb_b     : 拓也のセリフ（ブルーの吹き出し）
    thumb_sub   : 拓也の吹き出しの下の一言（任意）
    choices     : 選択肢ピル。'ア XXX / イ YYY / ...' 形式（任意・正解は割らない）

部ごとに背景色が変わるので、サムネの色だけで進行度がわかる。
"""
import sys, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import numpy as np

W, H = 1280, 670
ROOT = Path(__file__).resolve().parent.parent
BLACK_F = '/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc'
MED_F   = '/usr/share/fonts/opentype/noto/NotoSansCJK-Medium.ttc'
REG_F   = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'

INK, INK_SOFT = (31, 35, 55), (95, 103, 130)
PINK, PINK_BG, PINK_LN = (255, 107, 138), (255, 231, 237), (255, 176, 195)
BLUE, BLUE_BG, BLUE_LN = (47, 111, 237), (226, 236, 255), (163, 193, 255)
MARKER, GOLD = (255, 224, 102), (198, 154, 42)

PART_BG = {
    1: ((255, 243, 246), (233, 240, 255)),
    2: ((226, 242, 255), (214, 231, 250)),
    3: ((255, 240, 226), (255, 231, 236)),
    4: ((232, 236, 250), (219, 226, 245)),
    5: ((240, 250, 242), (255, 247, 230)),
}
SPECIAL = {29, 33, 103, 108}
DOMAIN_JA = {'technology': 'テクノロジ系', 'strategy': 'ストラテジ系',
             'management': 'マネジメント系'}


def f(path, size):
    return ImageFont.truetype(path, size, index=0)


def read_meta(ep):
    path = ROOT / 'episodes' / f'ep{ep:03d}.md'
    if not path.exists():
        sys.exit(f'見つかりません: {path}')
    md = path.read_text(encoding='utf-8')
    m = re.search(r'<!--\s*meta(.*?)-->', md, re.S)
    if not m:
        sys.exit('先頭の <!-- meta --> ブロックがありません')
    meta = {}
    for line in m.group(1).strip().splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            meta[k.strip()] = v.strip()
    if 'thumb_title' not in meta:
        h1 = re.search(r'^#\s*【第\d+話】(.+?)(?:[｜|]|$)', md, re.M)
        meta['thumb_title'] = h1.group(1).strip() if h1 else '（タイトル未設定）'
    return meta


def wrap(draw, text, font, max_w):
    lines, cur = [], ''
    for ch in text:
        if ch == '\n':
            lines.append(cur); cur = ''; continue
        if cur and draw.textlength(cur + ch, font=font) > max_w:
            lines.append(cur); cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return lines


def build(ep, meta):
    part = int(meta.get('part', 1))
    c1, c2 = (np.array(x, dtype=float) for x in PART_BG.get(part, PART_BG[1]))
    yy, xx = np.mgrid[0:H, 0:W]
    t = np.clip(xx / W * 0.72 + yy / H * 0.28, 0, 1)[..., None]
    img = Image.fromarray((c1 * (1 - t) + c2 * t).astype(np.uint8), 'RGB')
    d = ImageDraw.Draw(img, 'RGBA')

    for i in range(0, W, 44):
        for j in range(0, H, 44):
            d.ellipse([i - 2, j - 2, i + 2, j + 2], fill=(120, 140, 200, 22))
    for k, sx in enumerate((880, 960, 1040)):
        d.line([(sx, -40), (sx, 70 + k * 26), (1300, 70 + k * 26)],
               fill=(150, 170, 220, 34), width=3)
    d.ellipse([-160, -190, 260, 230], fill=(*PINK, 45))
    d.ellipse([1010, 430, 1440, 860], fill=(*BLUE, 40))

    badge_f = f(BLACK_F, 30)
    label = f'第 {ep} 話'
    bb = d.textbbox((0, 0), label, font=badge_f)
    bw, bh = bb[2] - bb[0], bb[3] - bb[1]
    bx, by, px, py = 72, 56, 26, 16
    d.rounded_rectangle([bx, by, bx + bw + px * 2, by + bh + py * 2],
                        radius=(bh + py * 2) // 2,
                        fill=GOLD if ep in SPECIAL else INK)
    d.text((bx + px, by + py - bb[1]), label, font=badge_f, fill=(255, 255, 255))
    d.text((bx + bw + px * 2 + 22, by + py + 2),
           'ITパスポート過去問  ラブコメ解説', font=f(MED_F, 27), fill=INK_SOFT)

    tx, ty = 72, 168
    title = meta['thumb_title']
    for size in (78, 70, 62, 54, 48):
        t_f = f(BLACK_F, size)
        lines = wrap(d, title, t_f, 690)
        if len(lines) <= 2:
            break
    lines = lines[:3]
    lh = int(size * 1.34)
    d.rounded_rectangle([tx, ty - 34, tx + 92, ty - 24], radius=5, fill=PINK)

    last = lines[-1].rstrip('？?。は')
    hl_w = d.textlength(last, font=t_f) if last else 0
    hl_y = ty + (len(lines) - 1) * lh
    if hl_w:
        d.rounded_rectangle([tx - 10, hl_y + size * 0.34, tx + hl_w + 10, hl_y + size * 1.28],
                            radius=8, fill=(*MARKER, 145))
    for i, ln in enumerate(lines):
        d.text((tx, ty + i * lh), ln, font=t_f, fill=INK)

    s_f = f(BLACK_F, 32)
    sy = ty + len(lines) * lh + 26
    d.text((tx, sy), 'ツンデレ女子大生', font=s_f, fill=PINK)
    w1 = d.textlength('ツンデレ女子大生', font=s_f)
    d.text((tx + w1 + 14, sy), '×', font=s_f, fill=INK_SOFT)
    d.text((tx + w1 + d.textlength('× ', font=s_f) + 22, sy),
           '東大パソコンオタク', font=s_f, fill=BLUE)

    yr = re.sub(r'^r0?(\d+)$', r'令和\1', meta.get('year', ''))
    foot = f"{yr}年度 問{meta.get('number', '')}"
    if DOMAIN_JA.get(meta.get('domain', '')):
        foot += f" ／ {DOMAIN_JA[meta['domain']]}"
    if meta.get('location'):
        foot += f" ／ {meta['location']}"
    d.text((tx, H - 96), foot, font=f(MED_F, 25), fill=INK_SOFT)

    if meta.get('choices'):
        cf = f(BLACK_F, 26)
        cx = tx
        for c in [s.strip() for s in meta['choices'].split('/')][:4]:
            cw = d.textlength(c, font=cf)
            if cx + cw + 30 > 790:
                break
            d.rounded_rectangle([cx, H - 58, cx + cw + 30, H - 14], radius=22,
                                fill=(255, 255, 255, 235), outline=(206, 214, 232), width=2)
            d.text((cx + 15, H - 50), c, font=cf, fill=INK_SOFT)
            cx += cw + 42

    bf, nf, sf = f(MED_F, 27), f(BLACK_F, 26), f(REG_F, 21)
    bx0, bw0 = 812, 400

    def bubble(x, y, lines, fill, outline, name, name_col, sub=None):
        lh_ = bf.size + 14
        h = len(lines) * lh_ + 44
        d.rounded_rectangle([x, y, x + bw0, y + h], radius=26,
                            fill=(*fill, 255), outline=outline, width=3)
        d.polygon([(x + 6, y + h - 46), (x - 26, y + h - 8), (x + 44, y + h - 20)],
                  fill=fill, outline=outline)
        d.line([(x + 8, y + h - 44), (x + 42, y + h - 22)], fill=fill, width=4)
        for i, ln in enumerate(lines):
            d.text((x + 28, y + 22 + i * lh_), ln, font=bf, fill=INK)
        d.text((x + bw0 - d.textlength(name, font=nf) - 6, y - 40), name, font=nf, fill=name_col)
        if sub:
            d.text((x + 6, y + h + 12), sub, font=sf, fill=INK_SOFT)
        return y + h

    a = wrap(d, meta.get('thumb_a', '……'), bf, bw0 - 56)[:3]
    b = wrap(d, meta.get('thumb_b', '……'), bf, bw0 - 56)[:3]
    end = bubble(bx0, 176, a, PINK_BG, PINK_LN, '美咲', PINK)
    bubble(bx0 - 6, end + 96, b, BLUE_BG, BLUE_LN, '拓也', BLUE, meta.get('thumb_sub'))
    return img


def main():
    if len(sys.argv) < 2:
        sys.exit('使い方: python3 thumbs/thumb.py <話数>')
    ep = int(sys.argv[1])
    meta = read_meta(ep)
    out = ROOT / 'thumbs' / 'out'
    out.mkdir(parents=True, exist_ok=True)
    path = out / f'ep{ep:03d}.png'
    build(ep, meta).save(path, 'PNG')
    print(f'生成しました: {path}')
    print(f'  第{ep}話 / 第{meta.get("part", "?")}部 / {meta["thumb_title"]}')


if __name__ == '__main__':
    main()
