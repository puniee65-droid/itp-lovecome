#!/usr/bin/env python3
"""
Impress で位置調整した pptx を、サムネイル本番用の PNG に書き戻す。

    python3 thumbs/pptx_to_png.py 3

thumbs/pptx/epNNN.pptx を LibreOffice のヘッドレス変換で 1280x670 の PNG にし、
thumbs/out/epNNN.png に保存する（note にアップロードする最終ファイルと同じ場所）。
先に thumbs/pptx/epNNN.pptx を Impress で編集・上書き保存しておくこと。
"""
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    if len(sys.argv) < 2:
        sys.exit('使い方: python3 thumbs/pptx_to_png.py <話数>')
    ep = int(sys.argv[1])
    pptx_path = ROOT / 'thumbs' / 'pptx' / f'ep{ep:03d}.pptx'
    if not pptx_path.exists():
        sys.exit(f'見つかりません: {pptx_path}（先に thumb_pptx.py で生成してください）')

    if not shutil.which('soffice'):
        sys.exit('soffice（LibreOffice）が見つかりません')

    with tempfile.TemporaryDirectory() as tmp:
        r = subprocess.run(
            ['soffice', '--headless', '--convert-to', 'png', '--outdir', tmp, str(pptx_path)],
            capture_output=True, text=True, timeout=120,
        )
        if r.returncode != 0:
            sys.exit(f'変換に失敗しました:\n{r.stdout}\n{r.stderr}')
        produced = Path(tmp) / f'ep{ep:03d}.png'
        if not produced.exists():
            sys.exit(f'出力が見つかりません: {produced}\n{r.stdout}')

        out_dir = ROOT / 'thumbs' / 'out'
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f'ep{ep:03d}.png'
        shutil.copy(produced, out_path)

    print(f'書き戻しました: {out_path}')


if __name__ == '__main__':
    main()
