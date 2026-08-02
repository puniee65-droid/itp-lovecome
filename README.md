# ITパスポート ラブコメ解説シリーズ

全108話。ITパスポート過去問を、ツンデレ女子大生と東大パソコンオタクの対話で解説する連載。

## セットアップ

```bash
npm install
cp .env.example .env   # SUPABASE_URL / SUPABASE_KEY を記入
```

## 使い方

```bash
npm run pick                        # 次話の候補を3件表示
npm run pick -- --domain strategy   # 分野を指定
npm run pick -- --subdomain legal   # 中分類を指定

# 記事を episodes/epNNN.md に書いたあと
npm run verify 3                    # 技術検証
python3 thumbs/thumb.py 3           # サムネイル生成

# 記録して次話へ
npm run pick -- --commit r06 12 --location 就活イベント \
  --metaphor "名刺交換＝プロトコル" --blunder 先回り
```

## ファイル

| パス | 役割 |
|---|---|
| `CLAUDE.md` | Claude Code が毎回読む作業ルール |
| `docs/series-bible.md` | シリーズ設定書（全108話の構成） |
| `state/series-state.json` | 話数・場所・比喩・失言の管理 |
| `scripts/lib/plan.mjs` | 部・季節・分野配分・場所マッピング |
| `episodes/` | 完成した記事 |

## 注意

- `correct_index` は **0起点**
- DBの `explanation` は参考であって根拠ではない。**踏み込んだ説明は必ず人間が確認する**
- 全自動生成・自動投稿はしない
