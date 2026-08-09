#!/usr/bin/env node
/**
 * episodes/epNNN.md を、画像埋め込み済みの静的HTMLに変換する。
 *
 *   node scripts/build-html.mjs 1
 *
 * 出力先: web/{20話区切りのレンジ}/epNNN.html （例: web/1-20/ep001.html）
 * 画像は web/images/ に一本化してコピーされ、HTMLからは ../images/... の相対パスで参照する
 * （file://で直接開いても、静的ホスティングにwebごとアップロードしても同じ相対構造なので動く）。
 * フレームワーク不要・HTML/CSSのみの自己完結ファイル。Cloudflare Pagesにそのまま置ける想定。
 *
 * このスクリプトはこの記事シリーズの本文フォーマット（幕構成・セリフ・引用ブロックの問題文・
 * 表・番号リストなど）に合わせた専用パーサーであり、汎用のMarkdown変換ではない。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupDirName } from './lib/groups.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// web/ 配下は20話ごとのサブフォルダにまとめて運用する（1-20, 21-40, ...）。グループ計算は
// scripts/lib/groups.mjs に集約し、build-index.mjs（一覧ページ生成）と共有している。
// HTMLは常に web/{range}/epNNN.html という1階層のサブフォルダに出力する。
// 画像パスは「../images/...」の相対パスで参照する（file://で直接ダブルクリックしても、
// 静的ホスティングにそのままアップロードしても、どちらでも同じ相対構造なら正しく解決できるため）。
const IMG_PREFIX = '../images/';
// 場所（meta.location）→ public/image/Illustration/ 内のファイル名。
// 該当する挿絵がない場所（データセンター見学・ネットカフェ・試験会場前・電話）は意図的に未対応（挿絵なし）。
const LOCATION_ILLUSTRATION = {
  'ファミレス': 'ファミレス.png',
  '就活イベント': '就職説明会.png',
  '美咲のバイト先': 'バイト先.png',
  '美咲の家': '美咲の部屋.png',
  'カフェ': 'カフェ.png',
  '家電量販店': '家電量販店.png',
  '銀行・ATM': '銀行.png',
  '図書館': '図書館.png',
  '拓也の家': '拓也の部屋.png',
  'スーパー・商店街': '商店街.png',
  '大学の講義棟・学食': '大学食堂.png',
  'コンビニ': 'コンビニ.png',
  '母校の高校': '高校.png',
  'カラオケ': 'カラオケ.png',
  '公園': '公園.png',
  '病院': '病院.png',
  '祖父母の家・田舎': '田舎.png',
  '海': '海.png',
  '動物園': '動物園.png',
  '猫カフェ': '猫カフェ.png',
  '遊園地': '遊園地.png',
  '学園祭': '学園祭.png',
  '神社・初詣': '神社.png',
  'トレーニングジム': 'トレーニングジム.png',
  '銭湯': '銭湯.png',
  '終電を逃す': '駅.png',
  'コインランドリー': 'コインランドリー.png',
  '雨宿り': '雨宿り.png',
  '卒業式': '卒業式.png',
  '看病': '看病.png',
  '引っ越し・新生活の準備': '引っ越し.png',
  'エレベーターに二人きり': 'エレベータ.png',
  '電車内': '電車内.png',
  '東大の研究室': '大学研究室.png',
  'プール': 'プール.png',
  '山': '山.png',
  'データセンター見学': 'データセンター.png',
  'ネットカフェ': 'ネットカフェ.png',
  '試験会場前': '試験会場.png',
  '電話（美咲の家／拓也の家）': '電話.png',
};
// 話ごとの例外（同じ場所でも話によって使う挿絵が違うもの）
const ILLUSTRATION_OVERRIDE = {
  1: 'ファミレス第1話.png',
  4: 'バイト先裏.png',
  16: 'バイト先.png',
  27: 'バイト先.png',
  28: '試験会場.png',
  58: 'バイト先.png',
};

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineFormat(s) {
  return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function readMeta(md) {
  const m = md.match(/<!--\s*meta([\s\S]*?)-->/);
  const meta = {};
  if (!m) return { meta, body: md };
  for (const line of m[1].trim().split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: md.slice(m.index + m[0].length) };
}

// セリフの内容から表情差分を選ぶ（ファイル名に表情・仕草が入っている前提）。
// 上から順に判定し、最初にマッチしたものを採用。どれにも当たらなければ既定の顔。
// 美咲は衣装（public/image/misaki/<衣装フォルダ>/faces/）ごとに揃っている画像が違うので、
// 衣装フォルダ名をキーにルール・既定ローテーションを分けて持つ。
const MISAKI_OUTFITS = {
  '女性普段着': {
    rules: [
      [/怒|バカにして|気持ち悪い|なっ、なんで|うるさい|くっ……/, '女性怒っている.png'],
      [/……っ、|べ、別に|恥ずかし|照れ|嬉しくないから|びっくりしてる』が余計/, '女性照れ.png'],
      [/泣|悲し/, '女性泣いている.png'],
      [/ふん|ふふん|そこまで言うなら|もういいわ|くだらな/, '女性ツンとしている.png'],
    ],
    defaults: ['女性.png', '女性2.png', '女性3.png', '女性4.png'],
  },
  '女性スーツ': {
    rules: [
      [/怒|バカにして|気持ち悪い|なっ、なんで|うるさい|くっ……/, '女性怒っている.png'],
      [/……っ、|べ、別に|恥ずかし|照れ|嬉しくないから|びっくりしてる』が余計/, '女性照れている.png'],
      [/泣|悲し/, '女性泣いている.png'],
    ],
    defaults: ['女性スーツ2.png', '女性右向き.png', '女性右斜め向き.png', '女性全身1.png'],
  },
  '女性水着': {
    rules: [
      [/……っ、|べ、別に|恥ずかし|照れ|嬉しくないから|びっくりしてる』が余計/, '女性照れている.png'],
    ],
    defaults: ['女性.png', '女性2.png', '女性3.png', '女性4.png'],
  },
};
const misakiDefaultIdx = { '女性普段着': 0, '女性スーツ': 0, '女性水着': 0 };

const TAKUYA_FACE_RULES = [
  [/ごめん|すみません|悪かった|軽率|申し訳/, '男性謝る.png'],
  [/ぶふっ|新鮮|笑った|嬉し/, '男性嬉しい顔.png'],
  [/え、|え！|えっ|!\?|えっ？/, '男性驚く.png'],
  [/その通り|完璧|いい質問|正解|そういうこと|さすが/, '男性自信顔.png'],
  [/あ……|しまった|頭を掻/, '男性頭を掻く.png'],
];
const TAKUYA_FACE_DEFAULT = '男性斜め左向き.png';

function pickFace(speaker, text, misakiOutfit) {
  if (speaker === '美咲') {
    const outfit = MISAKI_OUTFITS[misakiOutfit] ? misakiOutfit : '女性普段着';
    const { rules, defaults } = MISAKI_OUTFITS[outfit];
    const hit = rules.find(([re]) => re.test(text));
    const file = hit ? hit[1] : defaults[misakiDefaultIdx[outfit]++ % defaults.length];
    return `${IMG_PREFIX}faces/misaki/${outfit}/${file}`;
  }
  const hit = TAKUYA_FACE_RULES.find(([re]) => re.test(text));
  const file = hit ? hit[1] : TAKUYA_FACE_DEFAULT;
  return `${IMG_PREFIX}faces/takuya/${file}`;
}

function renderDialogue(speaker, text, isThought, avatarSrc) {
  const side = speaker === '美咲' ? 'misaki' : 'takuya';
  return `<div class="bubble-row ${side}">
  <img class="avatar" src="${avatarSrc}" alt="${speaker}">
  <div class="bubble ${side}${isThought ? ' thought' : ''}">
    <p class="speaker-name">${speaker}${isThought ? '<span class="thought-tag">心の声</span>' : ''}</p>
    <p>${inlineFormat(text)}</p>
  </div>
</div>`;
}

function renderCharacterCard(name, avatarSrc, kana, desc) {
  const side = name === '美咲' ? 'misaki' : 'takuya';
  return `<div class="character-card ${side}">
  <img src="${avatarSrc}" alt="${name}">
  <div>
    <p class="character-name">${name}<span>（${kana}）</span></p>
    <p class="character-desc">${inlineFormat(desc)}</p>
  </div>
</div>`;
}

function renderBlockquote(rawLines, kicker = '今日の問題', isRecap = false) {
  const cleaned = rawLines.map((l) => l.replace(/^>\s?/, '').replace(/\s+$/, ''));
  const nonEmpty = cleaned.filter((l) => l.length > 0);
  const isQuiz = nonEmpty.some((l) => /^（[アイウエ]）/.test(l));
  if (isQuiz) {
    const question = nonEmpty[0].replace(/^\*\*(.+)\*\*$/, '$1');
    const choices = nonEmpty.filter((l) => /^（[アイウエ]）/.test(l));
    const choiceHtml = choices
      .map((c) => {
        const m = c.match(/^（([アイウエ])）(.+)$/);
        return `<li><span class="choice-label">${m[1]}</span><span>${inlineFormat(m[2])}</span></li>`;
      })
      .join('\n');
    return `<div class="quiz-card${isRecap ? ' recap' : ''}">
  <p class="quiz-kicker">${esc(kicker)}</p>
  <p class="quiz-question">${inlineFormat(question)}</p>
  <ul class="quiz-choices">
${choiceHtml}
  </ul>
</div>`;
  }
  return `<blockquote class="callout">${nonEmpty.map((l) => `<p>${inlineFormat(l)}</p>`).join('\n')}</blockquote>`;
}

function renderTable(rawLines) {
  const isSeparator = (l) => /^[\-\|:\s]+$/.test(l);
  const rows = rawLines.filter((l) => !isSeparator(l));
  const cellsOf = (l) =>
    l
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
  const [headerCells, ...bodyRowsRaw] = rows.map(cellsOf);
  const thead = `<tr>${headerCells.map((h) => `<th>${inlineFormat(h)}</th>`).join('')}</tr>`;
  const tbody = bodyRowsRaw
    .map((r) => {
      const isCorrect = r.some((c) => c.includes('**') || c.includes('正解'));
      const cells = r.map((c) => `<td>${inlineFormat(c)}</td>`).join('');
      return `<tr class="${isCorrect ? 'correct-row' : ''}">${cells}</tr>`;
    })
    .join('\n');
  return `<div class="table-wrap"><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`;
}

function build(ep) {
  const mdPath = path.join(ROOT, 'episodes', `ep${String(ep).padStart(3, '0')}.md`);
  const md = fs.readFileSync(mdPath, 'utf8');
  const { meta, body } = readMeta(md);

  const epStr = String(ep).padStart(3, '0');
  const outDir = path.join(ROOT, 'web', groupDirName(ep));
  // 画像はグループフォルダごとに分けず、web/images/ に一本化する（ルート相対パスで参照するため、
  // どのサブフォルダのHTMLからでも同じ場所を指せる）。
  const imgDir = path.join(ROOT, 'web', 'images');
  const epImgDir = path.join(imgDir, `ep${epStr}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(epImgDir, { recursive: true });

  // 立ち絵（thumb_char/thumb_char2）は元の public/image/ 以下のフォルダ構成をそのまま
  // web/images/characters/ 配下に写す共有素材として扱う。同じポーズを使う話が多いため、
  // 話ごとに複製せず1枚だけ持たせ、リポジトリの肥大化を防ぐ（顔差分の faces/ と同じ考え方）。
  function copyCharShared(relPath) {
    if (!relPath) return null;
    const src = path.join(ROOT, relPath);
    if (!fs.existsSync(src)) return null;
    const rel = relPath.replace(/^public\/image\//, '');
    const dest = path.join(imgDir, 'characters', rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return `${IMG_PREFIX}characters/${rel}`;
  }

  const misakiSrc = copyCharShared(meta.thumb_char) ?? '';
  const takuyaSrc = copyCharShared(meta.thumb_char2) ?? '';
  const misakiOutfit = MISAKI_OUTFITS[meta.misaki_outfit] ? meta.misaki_outfit : '女性普段着';

  // 会話の場所に対応する挿絵（public/image/Illustration/）。立ち絵と同じく共有素材としてコピーする。
  function copyIllustration() {
    const file = ILLUSTRATION_OVERRIDE[ep] ?? LOCATION_ILLUSTRATION[meta.location];
    if (!file) return null;
    const src = path.join(ROOT, 'public', 'image', 'Illustration', file);
    if (!fs.existsSync(src)) return null;
    const dest = path.join(imgDir, 'illustrations', file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return `${IMG_PREFIX}illustrations/${file}`;
  }
  const illustrationSrc = copyIllustration();

  // 表情差分（顔アップ画像）一式をコピーする。scripts/crop_faces.py で事前生成したもの。
  // 美咲は衣装フォルダの下に faces/ があるので、その回で使う衣装分だけコピーする。
  // 全話共通の素材なので web/images/faces/ に一本化し、話ごとには複製しない。
  function copyFaces(who, outfit) {
    const src = outfit
      ? path.join(ROOT, 'public', 'image', who, outfit, 'faces')
      : path.join(ROOT, 'public', 'image', who, 'faces');
    const dest = outfit
      ? path.join(imgDir, 'faces', who, outfit)
      : path.join(imgDir, 'faces', who);
    fs.mkdirSync(dest, { recursive: true });
    if (!fs.existsSync(src)) return;
    for (const f of fs.readdirSync(src)) {
      const srcFile = path.join(src, f);
      if (fs.statSync(srcFile).isDirectory()) continue; // old/ などのサブフォルダはスキップ
      fs.copyFileSync(srcFile, path.join(dest, f));
    }
  }
  copyFaces('misaki', misakiOutfit);
  copyFaces('takuya');
  // thumbs/out/ もユーザー運用で 1-20 などのサブフォルダに分かれているため、
  // グループ化後のパスとフラットな旧パスの両方を試す。
  const thumbCandidates = [
    path.join(ROOT, 'thumbs', 'out', groupDirName(ep), `ep${epStr}.png`),
    path.join(ROOT, 'thumbs', 'out', `ep${epStr}.png`),
  ];
  const thumbPath = thumbCandidates.find((p) => fs.existsSync(p)) ?? thumbCandidates[0];
  let ogImage = '';
  if (fs.existsSync(thumbPath)) {
    fs.copyFileSync(thumbPath, path.join(epImgDir, 'thumb.png'));
    ogImage = `${IMG_PREFIX}ep${epStr}/thumb.png`;
  }

  const lines = body.split('\n');
  const hero = [];
  const main = [];
  let sectionOpen = false;
  let currentSectionTitle = '';
  let i = 0;
  let quizCount = 0;

  function pushToCurrent(html) {
    (sectionOpen ? main : hero).push(html);
  }

  function closeSectionIfOpen() {
    if (!sectionOpen) return;
    // 「登場人物」セクションの末尾（次の見出しの直前）に、会話の場所の挿絵を差し込む
    if (currentSectionTitle === '登場人物' && illustrationSrc) {
      main.push(`<img class="location-illustration" src="${illustrationSrc}" alt="${esc(meta.location || '')}">`);
    }
    main.push('</section>');
  }

  while (i < lines.length) {
    const line = lines[i];
    let m;

    if (line.trim() === '') { i++; continue; }
    if (line.trim() === '---') { i++; continue; }

    if ((m = line.match(/^# (.+)$/))) {
      hero.push(`<h1>${inlineFormat(m[1])}</h1>`);
      i++; continue;
    }
    if ((m = line.match(/^～(.+)～$/))) {
      hero.push(`<p class="tagline">～${inlineFormat(m[1])}～</p>`);
      i++; continue;
    }
    if ((m = line.match(/^\*\*第\d+話.*\*\*$/))) {
      hero.push(`<p class="ep-badge">${inlineFormat(line.replace(/\*\*/g, ''))}</p>`);
      i++; continue;
    }

    if ((m = line.match(/^## (.+)$/))) {
      closeSectionIfOpen();
      main.push(`<section class="scene"><h2>${inlineFormat(m[1])}</h2>`);
      sectionOpen = true;
      currentSectionTitle = m[1].trim();
      i++; continue;
    }
    if ((m = line.match(/^### (.+)$/))) {
      pushToCurrent(`<h3>${inlineFormat(m[1])}</h3>`);
      i++; continue;
    }

    if ((m = line.match(/^\*\*[AＡ][：:]美咲（みさき）\*\*$/))) {
      const desc = (lines[i + 1] || '').trim();
      pushToCurrent(renderCharacterCard('美咲', misakiSrc, 'みさき', desc));
      i += 2; continue;
    }
    if ((m = line.match(/^\*\*[BＢ][：:]拓也（たくや）\*\*$/))) {
      const desc = (lines[i + 1] || '').trim();
      pushToCurrent(renderCharacterCard('拓也', takuyaSrc, 'たくや', desc));
      i += 2; continue;
    }

    if (line.startsWith('>')) {
      const raw = [];
      while (i < lines.length && lines[i].startsWith('>')) { raw.push(lines[i]); i++; }
      quizCount++;
      const isRecap = quizCount > 1;
      const kicker = isRecap ? '問題文（再掲）' : '今日の問題';
      pushToCurrent(renderBlockquote(raw, kicker, isRecap));
      continue;
    }

    if (line.includes('|') && lines[i + 1] && /^[\-\|:\s]+$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const raw = [];
      while (i < lines.length && lines[i].includes('|')) { raw.push(lines[i]); i++; }
      pushToCurrent(renderTable(raw));
      continue;
    }

    if ((m = line.match(/^- (.+)$/))) {
      const items = [];
      while (i < lines.length && (m = lines[i].match(/^- (.+)$/))) { items.push(m[1]); i++; }
      pushToCurrent(`<ul class="plain-list">${items.map((it) => `<li>${inlineFormat(it)}</li>`).join('')}</ul>`);
      continue;
    }
    if ((m = line.match(/^\d+\. (.+)$/))) {
      const items = [];
      while (i < lines.length && (m = lines[i].match(/^\d+\. (.+)$/))) { items.push(m[1]); i++; }
      pushToCurrent(`<ol class="recap-list">${items.map((it) => `<li>${inlineFormat(it)}</li>`).join('')}</ol>`);
      continue;
    }

    if ((m = line.match(/^\*\*(美咲|拓也)\*\*[「（](.+)[」）]$/))) {
      const [, speaker, text] = m;
      const isThought = line.includes('（') && !line.includes('「');
      pushToCurrent(renderDialogue(speaker, text, isThought, pickFace(speaker, text, misakiOutfit)));
      i++; continue;
    }

    if ((m = line.match(/^\*\*答え[：:](.+)\*\*$/))) {
      pushToCurrent(`<p class="answer-callout"><span class="answer-kicker">答え</span>${inlineFormat(m[1])}</p>`);
      i++; continue;
    }

    if (!line.startsWith('**') && (m = line.match(/^\*(.+)\*$/))) {
      pushToCurrent(`<p class="footnote">${inlineFormat(m[1])}</p>`);
      i++; continue;
    }

    pushToCurrent(`<p class="narration">${inlineFormat(line)}</p>`);
    i++;
  }
  closeSectionIfOpen();

  const title = meta.thumb_title || `第${ep}話`;
  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>【第${ep}話】${esc(title)}｜ITパスポート ラブコメ解説</title>
<meta name="description" content="${esc(title)}｜ツンデレ女子大生と東大パソコンオタクの、ちょっと不器用な勉強会。">
${ogImage ? `<meta property="og:image" content="${ogImage}">` : ''}
<style>
${CSS}
</style>
</head>
<body>
<a class="back-to-index" href="index.html">← 一覧に戻る</a>
<header class="hero">
${hero.join('\n')}
</header>
<main>
${main.join('\n')}
</main>
<a class="back-to-index back-to-index-bottom" href="index.html">← 一覧に戻る</a>
<footer class="site-footer">
  <p>ITパスポート過去問 ラブコメ解説</p>
</footer>
</body>
</html>
`;

  const outPath = path.join(outDir, `ep${epStr}.html`);
  fs.writeFileSync(outPath, html, 'utf8');
  console.log(`生成しました: ${outPath}`);
}

const CSS = `
:root {
  --ink: #1f2337;
  --ink-soft: #5f6782;
  --pink: #ff6b8a;
  --pink-bg: #ffe7ed;
  --pink-ln: #ffb0c3;
  --blue: #2f6fed;
  --blue-bg: #e2ecff;
  --blue-ln: #a3c1ff;
  --marker: #ffe066;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
  color: var(--ink);
  background: linear-gradient(135deg, #fff3f6 0%, #e9f0ff 100%);
  line-height: 1.85;
}
main, header.hero, footer.site-footer {
  max-width: 720px;
  margin: 0 auto;
  padding: 0 20px;
}
.back-to-index {
  display: flex;
  width: fit-content;
  align-items: center;
  gap: 6px;
  margin: 18px auto 0;
  padding: 10px 22px;
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: bold;
  color: #fff;
  background: var(--blue);
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(47,111,237,0.3);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.back-to-index:hover, .back-to-index:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(47,111,237,0.4);
}
.back-to-index-bottom {
  margin: 32px auto 40px;
}
header.hero {
  padding-top: 16px;
  text-align: center;
}
header.hero h1 {
  font-size: 1.7rem;
  margin: 0 0 12px;
}
.tagline { color: var(--ink-soft); font-size: 0.9rem; margin: 0 0 8px; }
.ep-badge {
  display: inline-block;
  background: var(--ink);
  color: #fff;
  padding: 6px 18px;
  border-radius: 999px;
  font-weight: bold;
  font-size: 0.85rem;
}
section.scene {
  background: rgba(255,255,255,0.6);
  border-radius: 18px;
  padding: 28px 24px;
  margin: 28px 0;
}
section.scene h2 {
  font-size: 1.15rem;
  margin: 0 0 20px;
  padding-left: 14px;
  border-left: 6px solid var(--pink);
}
h3 { font-size: 1rem; margin: 20px 0 10px; }

.character-card {
  display: flex;
  gap: 16px;
  align-items: center;
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  margin: 14px 0;
  border: 2px solid var(--pink-ln);
}
.character-card.takuya { border-color: var(--blue-ln); }
.character-card img {
  width: 216px; height: 216px;
  border-radius: 50%;
  object-fit: cover;
  object-position: top center;
  flex: none;
}
.character-name { margin: 0 0 4px; font-weight: bold; }
.character-name span { font-weight: normal; color: var(--ink-soft); font-size: 0.85rem; margin-left: 4px; }
.character-desc { margin: 0; font-size: 0.9rem; color: var(--ink-soft); }

.location-illustration {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto;
  border-radius: 16px;
  margin: 18px 0 6px;
  box-shadow: 0 6px 20px rgba(31,35,55,0.12);
}

.quiz-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 16px rgba(31,35,55,0.08);
}
.quiz-kicker { color: var(--pink); font-weight: bold; font-size: 0.8rem; margin: 0 0 8px; }
.quiz-card.recap {
  border: 3px solid #e0203c;
}
.quiz-card.recap .quiz-kicker { font-size: 1.15rem; }
.quiz-question { font-weight: bold; margin: 0 0 16px; }
.quiz-choices { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.quiz-choices li {
  display: flex; gap: 10px; align-items: baseline;
  background: #f7f8fb; border-radius: 10px; padding: 10px 14px;
}
.choice-label {
  font-weight: bold; color: var(--pink); flex: none;
}

blockquote.callout {
  background: var(--marker);
  border-radius: 12px;
  padding: 14px 18px;
  margin: 16px 0;
  font-weight: bold;
}
blockquote.callout p { margin: 0; }

.bubble-row { display: flex; gap: 10px; margin: 14px 0; align-items: center; }
.bubble-row.takuya { flex-direction: row-reverse; }
.bubble-row .avatar {
  width: 192px; height: 192px; border-radius: 50%; object-fit: cover; object-position: center center; flex: none;
  border: 3px solid rgba(255,255,255,0.9); box-shadow: 0 2px 6px rgba(31,35,55,0.12);
}
.bubble {
  background: var(--pink-bg);
  border: 2px solid var(--pink-ln);
  border-radius: 16px;
  padding: 10px 16px;
  max-width: calc(100% - 220px);
}
.bubble.takuya { background: var(--blue-bg); border-color: var(--blue-ln); }
.bubble.thought { border-style: dashed; opacity: 0.9; }
.bubble p { margin: 0; }
.bubble .speaker-name { font-size: 0.75rem; font-weight: bold; color: var(--ink-soft); margin: 0 0 2px; }
.thought-tag {
  font-weight: normal; font-size: 0.7rem; margin-left: 6px;
  border: 1px solid var(--ink-soft); border-radius: 999px; padding: 0 6px;
}

.narration {
  text-align: center;
  color: var(--ink-soft);
  font-style: italic;
  font-size: 0.9rem;
  margin: 18px 0;
}

.plain-list, .recap-list { padding-left: 1.4em; }
.plain-list li, .recap-list li { margin: 6px 0; }

.table-wrap { overflow-x: auto; margin: 16px 0; }
table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
th, td { border: 1px solid #dfe3ee; padding: 8px 10px; text-align: left; }
th { background: #f2f4fa; }
tr.correct-row { background: var(--pink-bg); }

.answer-callout {
  background: var(--ink);
  color: #fff;
  border-radius: 14px;
  padding: 16px 20px;
  font-weight: bold;
  font-size: 1.05rem;
}
.answer-kicker {
  display: inline-block;
  background: var(--marker);
  color: var(--ink);
  border-radius: 999px;
  padding: 2px 12px;
  font-size: 0.8rem;
  margin-right: 10px;
}

.footnote { color: var(--ink-soft); font-size: 0.8rem; text-align: center; }

footer.site-footer {
  text-align: center;
  color: var(--ink-soft);
  font-size: 0.8rem;
  padding: 24px 20px 60px;
}
@media (max-width: 480px) {
  .bubble-row .avatar { width: 108px; height: 108px; }
  .bubble { max-width: calc(100% - 130px); }
  header.hero h1 { font-size: 1.35rem; }
}
`;

const ep = Number(process.argv[2]);
if (!ep) { console.error('使い方: node scripts/build-html.mjs <話数>'); process.exit(1); }
build(ep);
