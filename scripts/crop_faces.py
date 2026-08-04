#!/usr/bin/env python3
"""
public/image/{misaki,takuya}/ 配下の立ち絵から顔を検出し、
表情が分かりやすい正方形の「顔アップ」画像を切り出す。

    python3 scripts/crop_faces.py

misaki のように衣装ごとにサブフォルダ（女性普段着/ 女性スーツ/ など）が
分かれている場合は、サブフォルダごとに faces/ を作る。
takuya のようにフラット構造の場合は従来どおり直下に faces/ を作る。
（old/ サブフォルダは対象外。透過は維持する）

出力例:
  public/image/misaki/女性普段着/faces/<元のファイル名>.png
  public/image/misaki/女性スーツ/faces/<元のファイル名>.png
  public/image/takuya/faces/<元のファイル名>.png

正面顔カスケードで見つからない場合は横顔カスケード（左右反転も試す）にフォールバックし、
それでも信頼できる大きさの検出が無ければ MANUAL_CROP の手動指定、
それも無ければ画像上部中央を使う。
"""
import sys
from pathlib import Path

import cv2

ROOT = Path(__file__).resolve().parent.parent
FRONTAL = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
PROFILE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')

TARGET_SIZE = 480
MARGIN_TOP = 1.1
MARGIN_SIDE = 0.9
MARGIN_BOTTOM = 1.3
MIN_AREA_RATIO = 0.02  # 画像全体に対してこれ未満の検出結果は信用しない

# 自動検出が信頼できなかったファイル向けの手動クロップ（画像サイズに対する比率で指定）
# (left_frac, top_frac, side_frac)
MANUAL_CROP = {
    'takuya/男性謝る.png': (0.22, 0.05, 0.56),
}


def biggest(faces):
    return max(faces, key=lambda f: f[2] * f[3]) if len(faces) else None


def area_ratio(face, w, h):
    return (face[2] * face[3]) / (w * h)


def detect_face(gray, w, h):
    faces = FRONTAL.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    best = biggest(faces)
    if best is not None and area_ratio(best, w, h) >= MIN_AREA_RATIO:
        return best

    faces_p = PROFILE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    best_p = biggest(faces_p)

    flipped = cv2.flip(gray, 1)
    faces_pf = PROFILE.detectMultiScale(flipped, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
    best_pf = biggest(faces_pf)
    if best_pf is not None:
        fx, fy, fw, fh = best_pf
        best_pf = (w - fx - fw, fy, fw, fh)  # 反転画像の座標を元画像に戻す

    candidates = [f for f in (best, best_p, best_pf) if f is not None]
    if not candidates:
        return None
    top = max(candidates, key=lambda f: f[2] * f[3])
    return top if area_ratio(top, w, h) >= MIN_AREA_RATIO else None


def crop_face(src_path, dst_path, rel_key):
    img = cv2.imread(str(src_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        print(f'! 読み込み失敗: {src_path}')
        return False
    h, w = img.shape[:2]

    if rel_key in MANUAL_CROP:
        lf, tf, sf = MANUAL_CROP[rel_key]
        side_len = int(max(w, h) * sf)
        left = int(w * lf)
        top = int(h * tf)
        bottom = min(h, top + side_len)
        right = min(w, left + side_len)
    else:
        gray = cv2.cvtColor(img[:, :, :3], cv2.COLOR_BGR2GRAY)
        face = detect_face(gray, w, h)
        if face is None:
            print(f'! 顔検出できず（中央上部を使用）: {src_path.name}')
            side = min(w, h)
            cx, cy = w // 2, int(h * 0.28)
            fw = fh = int(side * 0.55)
        else:
            fx, fy, fw0, fh0 = face
            cx, cy = fx + fw0 // 2, fy + fh0 // 2
            fw, fh = fw0, fh0

        box_h_top = fh * MARGIN_TOP
        box_h_bottom = fh * MARGIN_BOTTOM
        top = max(0, int(cy - fh / 2 - box_h_top))
        bottom = min(h, int(cy + fh / 2 + box_h_bottom))
        side_len = bottom - top
        left = max(0, int(cx - side_len / 2))
        right = min(w, left + side_len)
        left = max(0, right - side_len)

    crop = img[top:bottom, left:right]
    if crop.shape[0] != crop.shape[1]:
        s = min(crop.shape[0], crop.shape[1])
        crop = crop[:s, :s]

    crop = cv2.resize(crop, (TARGET_SIZE, TARGET_SIZE), interpolation=cv2.INTER_LANCZOS4)
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(dst_path), crop)
    return True


def main():
    targets = sys.argv[1:] or ['misaki', 'takuya']
    for who in targets:
        who_dir = ROOT / 'public' / 'image' / who
        outfit_dirs = [
            d for d in sorted(who_dir.iterdir())
            if d.is_dir() and d.name not in ('old', 'faces')
        ]
        if outfit_dirs:
            # 衣装ごとにサブフォルダが分かれている（misaki など）
            for outfit_dir in outfit_dirs:
                dst_dir = outfit_dir / 'faces'
                for f in sorted(outfit_dir.glob('*.png')):
                    rel_key = f'{who}/{outfit_dir.name}/{f.name}'
                    ok = crop_face(f, dst_dir / f.name, rel_key)
                    print(f'{"OK " if ok else "!! "}{rel_key}')
        else:
            # フラット構造（takuya など）
            dst_dir = who_dir / 'faces'
            for f in sorted(who_dir.glob('*.png')):
                rel_key = f'{who}/{f.name}'
                ok = crop_face(f, dst_dir / f.name, rel_key)
                print(f'{"OK " if ok else "!! "}{rel_key}')


if __name__ == '__main__':
    main()
