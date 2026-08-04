# ITパスポート ラブコメ解説シリーズ｜作業ルール

全108話の連載を書き継ぐプロジェクト。**このファイルの指示は毎回必ず守ること。**

---

## 1. 新しい話を書く前に必ず読むファイル

1. `docs/series-bible.md` … シリーズ設定書（**全文を読む**。抜粋で済ませない）
2. `state/series-state.json` … 話数・場所・比喩・失言の管理状態
3. `episodes/ep{N-1}.md`, `episodes/ep{N-2}.md` … 直近2話（文体維持のため）

**全話は読まないこと。** コンテキストが膨らみ、品質もコストも悪化する。文体は直近2話で十分維持できる。

---

## 2. 標準ワークフロー

```
1. node scripts/pick-question.mjs          → 候補3件が出る
2. 人間が1件を選ぶ（または --auto で先頭を採用）
3. 記事を書く（フォーマットは設定書§4）
4. episodes/ep{N}.md に保存
5. node scripts/verify.mjs {N}             → 技術検証
6. python3 thumbs/thumb.py {N}             → サムネイル生成
7. node scripts/pick-question.mjs --commit {year} {number} …  → state.json 更新
8. git commit
```

**5をスキップして先に進まないこと。**

---

## 3. 記事ファイルの先頭に必ずメタ情報を書く

`verify.mjs` がこれを読む。書式厳守。

`verify.mjs` と `thumb.py` の両方がこれを読む。書式厳守。

```markdown
<!-- meta
episode: 3
year: r06
number: 12
part: 1
domain: strategy
location: 就活イベント
month: 4月
metaphor: 名刺交換＝プロトコル
blunder: 先回り
thumb_title: 名前を消せば、個人情報じゃない？
thumb_a: 名前さえ隠しちゃえば個人情報じゃないでしょ？
thumb_b: ……それ、一番危ないやつ
thumb_sub: （このあと真顔で説明が始まる）
choices: ア 匿名加工情報 / イ 個人識別符号 / ウ 要配慮個人情報 / エ 仮名加工情報
thumb_char: public/image/misaki/女性普段着/女性.png
thumb_char2: public/image/takuya/男性斜め左向き.png
misaki_outfit: 女性普段着
-->

# 【第3話】…
```

### thumb_* の書き方

- `thumb_title` … 大見出し。**20字以内**が読みやすい。省略するとH1から自動抽出
- `thumb_a` … 美咲の迷言。**その回の誤答**をそのまま使うのが最も効く
- `thumb_b` … 拓也の短い反応。**5〜10字**が理想。長いと画面が重くなる
- `thumb_sub` … 落ちの一言（任意）
- `choices` … `/` 区切りで4つ。**正解を割らないよう、順序も装飾も変えない**
- `thumb_char` / `thumb_char2` … 美咲／拓也の立ち絵画像パス（`public/image/`配下、ROOTからの相対）。**毎話必ず両方指定する**。表情差分がある場合はシーンに合う画像を選ぶ
- `misaki_outfit` … 美咲の衣装フォルダ名（`public/image/misaki/`配下のサブフォルダ名をそのまま書く。現状 `女性普段着` / `女性スーツ`）。`scripts/build-html.mjs` が本文中のセリフごとの表情差分をこのフォルダの `faces/` から選ぶために使う。**省略時は `女性普段着` 扱い**

---

## 4. 絶対に守ること

### 技術
- **`correct_index` は0起点**。`choices[correct_index]` が正解。ア=0, イ=1, ウ=2, エ=3
- DBの `explanation` は**参考にしてよいが、根拠にしてはいけない**。AI生成の誤りが混じりうる
- 踏み込んだ説明（なぜそうなるか）を書いたら、**その部分は必ず人間の確認に回す**。自信がなければ書かずに指摘する
- 試験制度の記述は正確に（1000点満点／総合600点以上**かつ**各分野300点以上／CBT随時実施）

### 物語
- **第108話より前に告白させない**
- **第29〜35話（不合格直後）は拓也が失言しない**。この区間だけの例外
- 拓也の好意は**心の声と行動のみ**で表現。セリフで直接言わせない（終章まで）
- 美咲を本気で無能に描かない（地頭は良い設定）
- デレ度は設定書§2-3の表に従う

### 重複防止
- 比喩・失言・場所は `state/series-state.json` の使用済みリストと重複させない
- 場所は**直近10話で使ったものを避ける**
- 使ったネタは**必ず state.json に追記**する（`--commit` が自動でやるが、比喩と失言は手で渡す）

---

## 5. やってはいけないこと

- ❌ 全話を一括生成して自動投稿する（技術検証が追いつかない）
- ❌ `image_url` が非NULLの問題を選ぶ（会話形式で図を提示できない）
- ❌ 過去問の問題文を改変する（IPA公表問題は原文どおり）
- ❌ サムネイルで正解を割る
- ❌ 幕タイトルを「導入」「解説」など機械的な名前にする

---

## 6. DBスキーマ（questions テーブル）

| カラム | 型 | 備考 |
|---|---|---|
| id | uuid | |
| year | text | `r06` 形式 |
| number | integer | 問番号 |
| domain | text | `technology` / `strategy` / `management` |
| subdomain | text | `security`, `network`, `legal` など |
| body | text | 問題文 |
| choices | jsonb | **ラベルなしの配列**。ア〜エは位置で決まる |
| correct_index | integer | **0起点** |
| explanation | text | AI生成の可能性あり。根拠にしない |
| image_url | text | 非NULLなら**選択対象外** |
| choices_in_figure | boolean | trueなら選択対象外 |
| use_static_only | boolean | 全件trueのため**判定に使わない** |

`question_reports` テーブルに `resolved = false` の報告がある問題も除外する。

---

## 7. 使える問題の母数（図表問題を除く）

| 分野 | 使える | 必要 | 余裕 |
|---|---|---|---|
| technology | 159 | 45話 | 3.5倍 |
| strategy | 132 | 35話 | 3.8倍 |
| management | 65 | 20話 | 3.3倍 |

**余裕があるので選り好みしてよい。** 計算問題や細かい語句の言い換え問題など、会話形式に向かないものは遠慮なく捨てる。
