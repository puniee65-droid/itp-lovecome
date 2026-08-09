#!/usr/bin/env node
/**
 * 全108話のサムネイル一覧ページ（LP）を、20話区切りで生成する。
 *
 *   node scripts/build-index.mjs
 *
 * 出力:
 *   web/index.html         … 第1話〜第20話（サイトのトップページ、直接アクセス用）
 *   web/1-20/index.html    … 同内容（web/1-20/epNNN.html から「一覧に戻る」で戻れるように）
 *   web/21-40/index.html
 *   ...
 *   web/101-108/index.html
 *
 * note.com のような、サムネイルが並ぶカードグリッド＋下部に「前の20話／次の20話」ボタン。
 * PC・スマホ両対応のレスポンシブグリッド（CSS Gridのauto-fillのみで実現、メディアクエリ不要）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { allGroups } from './lib/groups.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readMeta(ep) {
  const mdPath = path.join(ROOT, 'episodes', `ep${String(ep).padStart(3, '0')}.md`);
  const md = fs.readFileSync(mdPath, 'utf8');
  const m = md.match(/<!--\s*meta([\s\S]*?)-->/);
  const meta = {};
  if (m) {
    for (const line of m[1].trim().split('\n')) {
      const i = line.indexOf(':');
      if (i === -1) continue;
      meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return meta;
}

/**
 * 1ページ分のHTMLを組み立てる。
 * depth: 0 なら web/index.html（画像は images/...）、1 なら web/{range}/index.html（画像は ../images/...）
 */
function renderPage({ groups, groupIndex, depth }) {
  const group = groups[groupIndex];
  const imgPrefix = depth === 0 ? 'images/' : '../images/';
  const epLinkPrefix = depth === 0 ? `${group.dir}/` : '';
  const otherGroupPrefix = depth === 0 ? '' : '../';

  const cards = group.episodes.map((ep) => {
    const meta = readMeta(ep);
    const epStr = String(ep).padStart(3, '0');
    const title = meta.thumb_title || `第${ep}話`;
    return `<a class="ep-card" href="${epLinkPrefix}ep${epStr}.html">
  <img class="ep-card-thumb" src="${imgPrefix}ep${epStr}/thumb.png" alt="第${ep}話　${esc(title)}" loading="lazy">
</a>`;
  }).join('\n');

  function hrefForGroup(gi) {
    if (gi === 0 && depth === 1) return '../index.html';
    return `${otherGroupPrefix}${groups[gi].dir}/index.html`;
  }

  const rangeNav = `<nav class="pager">
  ${groups.map((g, gi) => (
    gi === groupIndex
      ? `<span class="pager-btn pager-active">${g.start}〜${g.end}話</span>`
      : `<a class="pager-btn" href="${hrefForGroup(gi)}">${g.start}〜${g.end}話</a>`
  )).join('\n  ')}
</nav>`;

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ITパスポート過去問 ラブコメ♥解説｜第${group.start}〜${group.end}話</title>
<meta name="description" content="ツンデレ女子大生と東大パソコンオタクの、ちょっと不器用な勉強会。ITパスポート過去問を全108話で解説。第${group.start}話〜第${group.end}話。">
<style>
${INDEX_CSS}
</style>
</head>
<body>
<header class="lp-hero">
  <p class="lp-kicker">ITパスポート過去問 ラブコメ♥解説</p>
  <h1>ツンデレ女子大生 <span class="x">×</span> 東大パソコンオタク</h1>
  <p class="lp-sub">全108話。ちょっと不器用な二人の会話でITパスポート過去問を解説。</p>
</header>
${rangeNav}
<main>
  <div class="ep-grid">
${cards}
  </div>
</main>
${rangeNav}
</body>
</html>
`;
}

const INDEX_CSS = `
:root {
  --ink: #1f2337; --ink-soft: #5f6782;
  --pink: #ff6b8a; --pink-bg: #ffe7ed; --pink-ln: #ffb0c3;
  --blue: #2f6fed; --blue-bg: #e2ecff;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
  color: var(--ink);
  background: linear-gradient(135deg, #fff3f6 0%, #e9f0ff 100%);
  line-height: 1.4;
}
.lp-hero {
  max-width: 2000px; margin: 0 auto; width: 100%;
  padding: 20px 20px 8px; text-align: center;
}
.lp-kicker { color: var(--ink-soft); font-weight: bold; letter-spacing: 0.02em; margin: 0; line-height: 1.2; font-size: 0.85rem; }
.lp-hero h1 { font-size: clamp(1.2rem, 3.2vw, 2rem); margin: 4px 0; line-height: 1.2; }
.lp-hero h1 .x { color: var(--ink-soft); font-weight: normal; margin: 0 6px; }
.lp-sub {
  color: var(--ink-soft); margin: 0; line-height: 1.2;
  white-space: nowrap; font-size: clamp(0.65rem, 2.1vw, 0.95rem);
}

main {
  max-width: 2000px; margin: 0 auto; width: 100%;
  padding: 8px 20px 20px;
}

/* サムネ本来の縦横比（1280:670）を常に保つ。引き伸ばし・トリミング過多は行わない
   （＝ブラウザ幅がサムネの整数倍でなくても、1個ずつが欠けずにしっかり表示される）。
   スマホ（狭い画面）は1列。PCなど幅に余裕がある画面では、1個あたり最低560px幅を
   確保できる列数まで自動的に増やす（auto-fillにより、だいたい2〜3列になる）。
   全部を1画面に収めることより、サムネ1個の大きさ・読みやすさを優先し、縦スクロールは許容する。 */
.ep-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
}
@media (min-width: 800px) {
  .ep-grid { grid-template-columns: repeat(auto-fill, minmax(500px, 1fr)); }
}
.ep-card {
  display: block;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 4px 16px rgba(31,35,55,0.08);
  border: 1px solid rgba(31,35,55,0.05);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.ep-card:hover, .ep-card:focus-visible {
  transform: translateY(-3px);
  box-shadow: 0 10px 26px rgba(31,35,55,0.14);
}
.ep-card-thumb {
  display: block;
  width: 100%;
  aspect-ratio: 1280 / 670;
  object-fit: cover;
  background: #f0f2f8;
}

.pager {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  flex-wrap: wrap;
  max-width: 2000px; margin: 0 auto; width: 100%;
  padding: 8px 20px;
}
.pager-btn {
  display: inline-flex; align-items: center;
  padding: 7px 16px; border-radius: 999px; font-weight: bold; text-decoration: none;
  font-size: 0.85rem; line-height: 1.6;
  background: #fff; color: var(--ink); border: 2px solid var(--pink-ln);
  box-shadow: 0 2px 8px rgba(31,35,55,0.06);
  transition: transform 0.15s ease;
}
.pager-btn:hover, .pager-btn:focus-visible { transform: translateY(-2px); }
.pager-active {
  background: var(--blue); color: #fff; border-color: var(--blue);
  box-shadow: 0 2px 10px rgba(47,111,237,0.3);
}
`;

function main() {
  const groups = allGroups();
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    // web/{range}/index.html （depth 1）
    const depth1Html = renderPage({ groups, groupIndex: gi, depth: 1 });
    const depth1Dir = path.join(ROOT, 'web', group.dir);
    fs.mkdirSync(depth1Dir, { recursive: true });
    fs.writeFileSync(path.join(depth1Dir, 'index.html'), depth1Html, 'utf8');
    console.log(`生成しました: web/${group.dir}/index.html`);

    if (gi === 0) {
      // web/index.html （depth 0、サイト直アクセス用のトップページ）
      const depth0Html = renderPage({ groups, groupIndex: gi, depth: 0 });
      fs.writeFileSync(path.join(ROOT, 'web', 'index.html'), depth0Html, 'utf8');
      console.log('生成しました: web/index.html');
    }
  }
}

main();
