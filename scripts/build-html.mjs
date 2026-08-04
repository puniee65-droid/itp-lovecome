#!/usr/bin/env node
/**
 * episodes/epNNN.md を、画像埋め込み済みの静的HTMLに変換する。
 *
 *   node scripts/build-html.mjs 1
 *
 * 出力先: web/epNNN.html （画像は web/images/ にコピーされる）
 * フレームワーク不要・HTML/CSSのみの自己完結ファイル。Cloudflare Pagesにそのまま置ける想定。
 *
 * このスクリプトはこの記事シリーズの本文フォーマット（幕構成・セリフ・引用ブロックの問題文・
 * 表・番号リストなど）に合わせた専用パーサーであり、汎用のMarkdown変換ではない。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
};
const misakiDefaultIdx = { '女性普段着': 0, '女性スーツ': 0 };

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
    return `images/faces/misaki/${outfit}/${file}`;
  }
  const hit = TAKUYA_FACE_RULES.find(([re]) => re.test(text));
  const file = hit ? hit[1] : TAKUYA_FACE_DEFAULT;
  return `images/faces/takuya/${file}`;
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

function renderBlockquote(rawLines) {
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
    return `<div class="quiz-card">
  <p class="quiz-kicker">今日の問題</p>
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

  const outDir = path.join(ROOT, 'web');
  const imgDir = path.join(outDir, 'images');
  fs.mkdirSync(imgDir, { recursive: true });

  function copyChar(relPath, destName) {
    if (!relPath) return null;
    const src = path.join(ROOT, relPath);
    if (!fs.existsSync(src)) return null;
    fs.copyFileSync(src, path.join(imgDir, destName));
    return `images/${destName}`;
  }

  const misakiSrc = copyChar(meta.thumb_char, 'misaki.png') ?? '';
  const takuyaSrc = copyChar(meta.thumb_char2, 'takuya.png') ?? '';
  const misakiOutfit = MISAKI_OUTFITS[meta.misaki_outfit] ? meta.misaki_outfit : '女性普段着';

  // 表情差分（顔アップ画像）一式をコピーする。scripts/crop_faces.py で事前生成したもの。
  // 美咲は衣装フォルダの下に faces/ があるので、その回で使う衣装分だけコピーする。
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
      fs.copyFileSync(path.join(src, f), path.join(dest, f));
    }
  }
  copyFaces('misaki', misakiOutfit);
  copyFaces('takuya');
  const thumbPath = path.join(ROOT, 'thumbs', 'out', `ep${String(ep).padStart(3, '0')}.png`);
  let ogImage = '';
  if (fs.existsSync(thumbPath)) {
    fs.copyFileSync(thumbPath, path.join(imgDir, 'thumb.png'));
    ogImage = 'images/thumb.png';
  }

  const lines = body.split('\n');
  const hero = [];
  const main = [];
  let sectionOpen = false;
  let i = 0;

  function pushToCurrent(html) {
    (sectionOpen ? main : hero).push(html);
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
      if (sectionOpen) main.push('</section>');
      main.push(`<section class="scene"><h2>${inlineFormat(m[1])}</h2>`);
      sectionOpen = true;
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
      pushToCurrent(renderBlockquote(raw));
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
  if (sectionOpen) main.push('</section>');

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
<header class="hero">
${hero.join('\n')}
</header>
<main>
${main.join('\n')}
</main>
<footer class="site-footer">
  <p>ITパスポート過去問 ラブコメ解説</p>
</footer>
</body>
</html>
`;

  const outPath = path.join(outDir, `ep${String(ep).padStart(3, '0')}.html`);
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
header.hero {
  padding-top: 48px;
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

.quiz-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 16px rgba(31,35,55,0.08);
}
.quiz-kicker { color: var(--pink); font-weight: bold; font-size: 0.8rem; margin: 0 0 8px; }
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
