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
    thumb_char  : 美咲の立ち絵画像パス（ROOTからの相対、任意）。指定時のみ右上に
                  大きく合成し、セリフは顔まわりに寄せたレイアウトに切り替わる
    thumb_char2 : 拓也の立ち絵画像パス（ROOTからの相対、任意）。指定時は右下に
                  控えめなサイズで合成する（thumb_char とセットで使う想定）

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
# サブ領域（中分類）の日本語表記。episodes/epNNN.md 末尾の「この記事は...」表記と揃えてある。
SUBDOMAIN_JA = {
    'security': 'セキュリティ', 'network': 'ネットワーク', 'database': 'データベース',
    'basic_theory': '基礎理論', 'algorithm': 'アルゴリズム', 'software': 'ソフトウェア',
    'computer_components': 'コンピュータ構成要素', 'system_components': 'システム構成要素',
    'hardware': 'ハードウェア', 'information_design': '情報デザイン',
    'information_media': '情報メディア',
    'service_mgmt': 'サービスマネジメント', 'project_mgmt': 'プロジェクトマネジメント',
    'system_audit': 'システム監査', 'software_dev_mgmt': 'システム開発技術',
    'development_tech': '開発技術',
    'legal': '法務', 'business_industry': '産業と業種', 'corporate_activity': '企業活動',
    'system_strategy': 'システム戦略', 'management_strategy': '経営戦略マネジメント',
    'technology_strategy': '技術戦略マネジメント', 'system_planning': 'システム企画',
}


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


def draw_italic_centered(img, center_x, top_y, text, font_path, size, fill):
    """疑似イタリック体でテキストを描画する（日本語フォントに斜体がないため、
    通常のグリフをせん断変形して傾ける）。center_x を中心にセンタリングして img に貼り付ける。
    戻り値は描画した高さ（次の要素を配置する際の目安）。
    """
    shear = 0.22
    tmp_font = f(font_path, size)
    probe = ImageDraw.Draw(Image.new('RGBA', (1, 1)))
    bbox = probe.textbbox((0, 0), text, font=tmp_font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x = int(h * shear) + 6
    pad_y = 6
    txt_img = Image.new('RGBA', (w + pad_x * 2, h + pad_y * 2), (0, 0, 0, 0))
    td = ImageDraw.Draw(txt_img)
    td.text((pad_x - bbox[0], pad_y - bbox[1]), text, font=tmp_font, fill=fill)
    sheared = txt_img.transform(
        txt_img.size, Image.AFFINE,
        (1, shear, -shear * txt_img.height * 0.5, 0, 1, 0),
        resample=Image.BICUBIC,
    )
    paste_x = int(center_x - sheared.width / 2)
    img.paste(sheared, (paste_x, top_y), sheared)
    return h + pad_y * 2


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


def build(ep, meta, bake_char=True, bake_chat=True):
    """サムネイルを描画する。

    bake_char / bake_chat を False にすると、立ち絵の画素・吹き出しの描画を
    スキップし、その代わり座標情報を layout として返す（pptx 編集用）。
    通常の CLI 利用（bake_char=bake_chat=True）では見た目は変わらない。
    """
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
    d.ellipse([-160, -190, 260, 230], fill=(214, 42, 90, 120))
    d.ellipse([1010, 430, 1440, 860], fill=(*BLUE, 40))

    layout = {'char_box': None, 'char_box2': None, 'rows': [], 'sub': None}

    def load_char(key):
        path = meta.get(key)
        if not path:
            return None
        p = ROOT / path
        return Image.open(p).convert('RGBA') if p.exists() else None

    char_left, char_img = W, load_char('thumb_char')
    if char_img:
        ch_w, ch_h = char_img.size
        tgt_h = int(H * 1.12)
        tgt_w = int(ch_w * tgt_h / ch_h)
        max_char_w = 472  # 正方形に近い立ち絵で高さ基準にすると幅が出過ぎるための上限
        if tgt_w > max_char_w:
            tgt_w = max_char_w
            tgt_h = int(ch_h * tgt_w / ch_w)
        char_x, char_y = W - tgt_w + 24, -int(tgt_h * 0.03)  # 右上へわずかにはみ出させる
        layout['char_box'] = (char_x, char_y, tgt_w, tgt_h)
        char_left = char_x - 60  # 写真に重ならないための右端制限
        if bake_char:
            char_resized = char_img.resize((tgt_w, tgt_h), Image.LANCZOS)
            img.paste(char_resized, (char_x, char_y), char_resized)

    char_img2 = load_char('thumb_char2')
    char2_box = None
    if char_img2:
        ch_w2, ch_h2 = char_img2.size
        tgt_h2 = int(H * 0.385)
        tgt_w2 = int(ch_w2 * tgt_h2 / ch_h2)
        max_char2_w = 260  # 拓也は美咲より控えめなサイズに収める
        if tgt_w2 > max_char2_w:
            tgt_w2 = max_char2_w
            tgt_h2 = int(ch_h2 * tgt_w2 / ch_w2)
        char2_x, char2_y = W - tgt_w2 - 14, H - tgt_h2  # 右下に据え置き
        char2_box = (char2_x, char2_y, tgt_w2, tgt_h2)
        layout['char_box2'] = char2_box
        if bake_char:
            char2_resized = char_img2.resize((tgt_w2, tgt_h2), Image.LANCZOS)
            img.paste(char2_resized, (char2_x, char2_y), char2_resized)

    badge_f = f(BLACK_F, 30)
    label = f'第 {ep} 話'
    bb = d.textbbox((0, 0), label, font=badge_f)
    bw, bh = bb[2] - bb[0], bb[3] - bb[1]
    bx, by, px, py = 72, 56, 26, 16
    d.rounded_rectangle([bx, by, bx + bw + px * 2, by + bh + py * 2],
                        radius=(bh + py * 2) // 2,
                        fill=GOLD if ep in SPECIAL else INK)
    d.text((bx + px, by + py - bb[1]), label, font=badge_f, fill=(255, 255, 255))
    sub_label = 'ITパスポート過去問  ラブコメ♥解説'
    sub_label_f = f(MED_F, 41)
    sub_label_x = bx + bw + px * 2 + 22 + 41
    sub_label_y = by + py - 8
    d.text((sub_label_x, sub_label_y), sub_label, font=sub_label_f, fill=INK_SOFT)

    # 改題した話は、このラベルの直下に旧タイトルを疑似イタリックでセンタリング表示する
    old_title = meta.get('thumb_title_old')
    if old_title and old_title != meta.get('thumb_title'):
        label_bbox = d.textbbox((sub_label_x, sub_label_y), sub_label, font=sub_label_f)
        label_center_x = (label_bbox[0] + label_bbox[2]) / 2
        old_title_size = round(41 * 0.8)
        draw_italic_centered(
            img, label_center_x, label_bbox[3] + 6,
            f'〜{old_title}〜', MED_F, old_title_size, INK_SOFT,
        )

    tx, ty = 72, 168
    title = meta['thumb_title']
    title_max_w = (char_left - tx - 30) if char_img else 690
    for size in (78, 70, 62, 54, 48):
        t_f = f(BLACK_F, size)
        lines = wrap(d, title, t_f, title_max_w)
        if len(lines) <= 2:
            break
    lines = lines[:3]
    lh = int(size * 1.34)
    d.rounded_rectangle([tx, ty - 34, tx + 92, ty - 24], radius=5, fill=PINK)

    # マーカーの黄色いハイライトは、全ての行の下に敷く（最終行だけは末尾の句読点類を除いて敷く）
    for i, ln in enumerate(lines):
        hl_text = ln.rstrip('？?。は') if i == len(lines) - 1 else ln
        hl_w = d.textlength(hl_text, font=t_f) if hl_text else 0
        hl_y = ty + i * lh
        if hl_w:
            d.rounded_rectangle([tx - 10, hl_y + size * 0.34, tx + hl_w + 10, hl_y + size * 1.28],
                                radius=8, fill=(*MARKER, 145))
    for i, ln in enumerate(lines):
        d.text((tx, ty + i * lh), ln, font=t_f, fill=INK)

    title_bottom = ty + len(lines) * lh
    s_f = f(BLACK_F, 32)
    sy = title_bottom + 26
    d.text((tx, sy), 'ツンデレ女子大生', font=s_f, fill=PINK)
    w1 = d.textlength('ツンデレ女子大生', font=s_f)
    d.text((tx + w1 + 14, sy), '×', font=s_f, fill=INK_SOFT)
    d.text((tx + w1 + d.textlength('× ', font=s_f) + 22, sy),
           '東大パソコンオタク', font=s_f, fill=BLUE)
    tagline_bottom = sy + int(s_f.size * 1.3)

    yr = re.sub(r'^r0?(\d+)$', r'令和\1', meta.get('year', ''))
    foot = f"{yr}年度 問{meta.get('number', '')}"
    if DOMAIN_JA.get(meta.get('domain', '')):
        foot += f" ／ {DOMAIN_JA[meta['domain']]}"
    if SUBDOMAIN_JA.get(meta.get('subdomain', '')):
        foot += f" ／ {SUBDOMAIN_JA[meta['subdomain']]}"
    if meta.get('location'):
        foot += f" ／ {meta['location']}"
    # サブ領域・場所が長い話（複合ロケーションなど）でもはみ出さないよう、収まる最大サイズまで縮める
    foot_max_w = (char_left - tx - 20) if char_img else 1000
    for foot_size in (25, 22, 19, 16, 14):
        foot_f = f(MED_F, foot_size)
        if d.textlength(foot, font=foot_f) <= foot_max_w:
            break
    d.text((tx, H - 96), foot, font=foot_f, fill=INK_SOFT)

    # 選択肢ピルは画面下側の帯。その高さまで実際に写真が届いている場合だけ幅を制限する
    pill_band_top = H - 58
    char1_blocks_pills = char_img and (char_y + tgt_h) > pill_band_top
    if char2_box:
        bottom_right_limit = char2_box[0]
    elif char1_blocks_pills:
        bottom_right_limit = char_left
    else:
        bottom_right_limit = W
    pill_max_x = (bottom_right_limit - 20) if char_img else 790
    if meta.get('choices'):
        cf = f(BLACK_F, 26)
        cx = tx
        for c in [s.strip() for s in meta['choices'].split('/')][:4]:
            cw = d.textlength(c, font=cf)
            if cx + cw + 30 > pill_max_x:
                break
            d.rounded_rectangle([cx, H - 58, cx + cw + 30, H - 14], radius=22,
                                fill=(255, 255, 255, 235), outline=(206, 214, 232), width=2)
            d.text((cx + 15, H - 50), c, font=cf, fill=INK_SOFT)
            cx += cw + 42

    if char_img:
        # 立ち絵ありのときは、タグラインの下・フッターの上の帯に、
        # 写真に一切かからない横並びチップ＋吹き出しを積む
        row_f, name_f, sub_f = f(MED_F, 22), f(BLACK_F, 20), f(REG_F, 17)
        row_x, row_max_w = tx, char_left - tx

        def chat_row(y, name, name_col, bg, ln_col, text, draw):
            lines_ = wrap(d, text, row_f, row_max_w - 116)[:2]
            lh_ = row_f.size + 8
            rh = len(lines_) * lh_ + 14
            nb = d.textbbox((0, 0), name, font=name_f)
            nw, nh = nb[2] - nb[0], nb[3] - nb[1]
            chip_w = nw + 28
            chip_h = max(rh, nh + 14)
            bx = row_x + chip_w + 12
            bw = row_x + row_max_w - bx
            if draw:
                d.rounded_rectangle([row_x, y, row_x + chip_w, y + chip_h],
                                    radius=chip_h // 2, fill=name_col)
                d.text((row_x + (chip_w - nw) // 2 - nb[0], y + (chip_h - nh) // 2 - nb[1]),
                       name, font=name_f, fill=(255, 255, 255))
                d.rounded_rectangle([bx, y, bx + bw, y + chip_h], radius=chip_h // 2,
                                    fill=(*bg, 248), outline=ln_col, width=2)
                ty_ = y + (chip_h - len(lines_) * lh_) // 2
                for i, ln in enumerate(lines_):
                    d.text((bx + 20, ty_ + i * lh_), ln, font=row_f, fill=INK)
            layout['rows'].append({
                'name': name, 'name_col': name_col, 'bg': bg, 'ln_col': ln_col,
                'text': text, 'chip_box': (row_x, y, chip_w, chip_h),
                'bubble_box': (bx, y, bw, chip_h),
            })
            return y + chip_h

        row_y = tagline_bottom + 8
        row_y = chat_row(row_y, '美咲', PINK, PINK_BG, PINK_LN, meta.get('thumb_a', '……'), bake_chat) + 4
        row_y = chat_row(row_y, '拓也', BLUE, BLUE_BG, BLUE_LN, meta.get('thumb_b', '……'), bake_chat)
        if meta.get('thumb_sub'):
            sub_pos = (row_x + 18, row_y + 4)
            layout['sub'] = {'pos': sub_pos, 'text': meta['thumb_sub']}
            if bake_chat:
                d.text(sub_pos, meta['thumb_sub'], font=sub_f, fill=INK_SOFT)
        return img, layout

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
    return img, layout


TOTAL_EPISODES = 108
GROUP_SIZE = 20


def group_dir_name(ep: int) -> str:
    # web/ 側のフォルダ分け（1-20, 21-40, ...）に合わせる。build-html.mjs の groupDirName と揃えること。
    start = (ep - 1) // GROUP_SIZE * GROUP_SIZE + 1
    end = min(start + GROUP_SIZE - 1, TOTAL_EPISODES)
    return f'{start}-{end}'


def main():
    if len(sys.argv) < 2:
        sys.exit('使い方: python3 thumbs/thumb.py <話数>')
    ep = int(sys.argv[1])
    meta = read_meta(ep)
    out = ROOT / 'thumbs' / 'out' / group_dir_name(ep)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f'ep{ep:03d}.png'
    img, _ = build(ep, meta)
    img.save(path, 'PNG')
    print(f'生成しました: {path}')
    print(f'  第{ep}話 / 第{meta.get("part", "?")}部 / {meta["thumb_title"]}')


if __name__ == '__main__':
    main()
