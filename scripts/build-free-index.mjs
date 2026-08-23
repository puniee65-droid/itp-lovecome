#!/usr/bin/env node
/**
 * 無料会員向けサイト（web_free/）のトップページを生成する。
 *
 *   node scripts/build-free-index.mjs
 *
 * web/ 側の一覧ページ（build-index.mjs）と表示ルールは同じ（サムネイルグリッド、
 * サムネの縦横比を保ったまま画面幅に応じて1〜3列に自動調整、クリックで各話へ）。
 * ページ送りはなく、代わりに指定話数を「点線区切り」で2グループに分けて1ページに表示する。
 *
 * 出力: web_free/index.html （画像は web_free/images/... フラット構成、ep*.htmlはbuild-html.mjsで
 * 事前に `node scripts/build-html.mjs <話数> --out=web_free --flat` を実行して生成しておくこと）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STRIPE_PURCHASE_URL, PRICE_LABEL, CONTACT_MAILTO, WEB_ANALYTICS_SNIPPET_FREE, FREE_BASE_URL, SITE_NAME, GOOGLE_SITE_VERIFICATION_FREE } from './lib/links.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = 'web_free';

// note側の無料公開記事と1対1で揃える（note記事→該当話のCloudflareページへ直リンクできるように）。
// note無料記事を増やしたら、ここも同じ話数まで伸ばすこと。
const SECTIONS = [
  { episodes: Array.from({ length: 20 }, (_, i) => i + 1) },
];

// 無料で本文を読めるのはこの話数まで（現在は全20話とも無料公開）。
const FREE_READABLE_UP_TO = 20;

const PURCHASE_URL = STRIPE_PURCHASE_URL;

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

function renderCard(ep) {
  const meta = readMeta(ep);
  const epStr = String(ep).padStart(3, '0');
  const title = meta.thumb_title || `第${ep}話`;
  const href = ep <= FREE_READABLE_UP_TO ? `ep${epStr}.html` : PURCHASE_URL;
  return `<a class="ep-card" href="${esc(href)}">
  <img class="ep-card-thumb" src="images/ep${epStr}/thumb.png" alt="第${ep}話　${esc(title)}" loading="lazy">
</a>`;
}

function renderPurchaseButton(extraClass = '') {
  // 決済導線はStripeに一本化（note有料記事とStripeの二重導線は読者を迷わせるだけなので廃止）。
  return `<div class="purchase-block ${extraClass}">
  <p class="purchase-copy">二人の関係が気になる！　恋のシーソーゲームをお楽しみください！</p>
  <a class="purchase-btn" href="${PURCHASE_URL}">全108話見る（Stripeで購入）</a>
  <p class="purchase-price">${PRICE_LABEL}</p>
</div>`;
}

function renderSections() {
  return SECTIONS.map((section, i) => {
    const cards = section.episodes.map(renderCard).join('\n');
    const divider = i > 0
      ? '<div class="section-divider"><span class="section-divider-label">（第7話以降で2話をピックアップ）</span></div>'
      : '';
    return `${divider}
<div class="ep-grid">
${cards}
</div>`;
  }).join('\n');
}

const CSS = `
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
  padding: 8px 20px 40px;
}

/* サムネ本来の縦横比（1280:670）を常に保つ。引き伸ばし・トリミング過多は行わない。
   スマホは1列。PCなど幅に余裕がある画面では、1個あたり最低500px幅を確保できる列数まで
   自動的に増やす（auto-fillにより、だいたい2〜3列になる）。 */
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

.section-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 32px 0;
}
.section-divider::before,
.section-divider::after {
  content: '';
  flex: 1 1 auto;
  border-top: 6px dashed var(--blue);
}
.section-divider-label {
  flex: none;
  color: var(--blue);
  font-weight: bold;
  font-size: 0.85rem;
  white-space: nowrap;
}

.purchase-block {
  text-align: center;
  margin: 0 auto 24px;
}
.purchase-block.purchase-top { margin: 16px auto 24px; }
.purchase-block.purchase-bottom { margin: 40px auto 8px; }
.purchase-copy {
  margin: 0 0 12px;
  color: var(--pink);
  font-weight: bold;
  font-size: clamp(0.95rem, 2.6vw, 1.15rem);
}
.purchase-btn {
  display: inline-block;
  padding: 16px 36px;
  border-radius: 999px;
  font-weight: bold;
  font-size: 1.05rem;
  text-decoration: none;
  color: #fff;
  background: var(--blue);
  box-shadow: 0 6px 18px rgba(47,111,237,0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.purchase-btn:hover, .purchase-btn:focus-visible {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(47,111,237,0.45);
}
.purchase-price {
  margin: 8px 0 0;
  color: var(--ink-soft);
  font-size: 0.85rem;
}

.site-footer {
  text-align: center;
  color: var(--ink-soft);
  font-size: 0.8rem;
  padding: 12px 20px 40px;
}
.contact-link {
  color: var(--ink-soft);
  text-decoration: underline;
}
`;

const FREE_PAGE_TITLE = 'ITパスポート過去問 ラブコメ♥解説｜無料公開分';
const FREE_PAGE_DESC = 'ツンデレ女子大生と東大パソコンオタクの、ちょっと不器用な勉強会。ITパスポート過去問を実際の過去問で解説するラブコメ連載、無料公開分。';

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(FREE_PAGE_TITLE)}</title>
<meta name="description" content="${esc(FREE_PAGE_DESC)}">
<link rel="canonical" href="${FREE_BASE_URL}/">
${GOOGLE_SITE_VERIFICATION_FREE ? `<meta name="google-site-verification" content="${GOOGLE_SITE_VERIFICATION_FREE}">` : ''}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${esc(FREE_PAGE_TITLE)}">
<meta property="og:description" content="${esc(FREE_PAGE_DESC)}">
<meta property="og:url" content="${FREE_BASE_URL}/">
<meta property="og:image" content="${FREE_BASE_URL}/images/ep001/thumb.png">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(FREE_PAGE_TITLE)}">
<meta name="twitter:description" content="${esc(FREE_PAGE_DESC)}">
<meta name="twitter:image" content="${FREE_BASE_URL}/images/ep001/thumb.png">
<style>
${CSS}
</style>
${WEB_ANALYTICS_SNIPPET_FREE}
</head>
<body>
<header class="lp-hero">
  <p class="lp-kicker">ITパスポート過去問 ラブコメ♥解説</p>
  <h1>ツンデレ女子大生 <span class="x">×</span> 東大パソコンオタク</h1>
  <p class="lp-sub">全108話。ちょっと不器用な二人の会話でITパスポート過去問を解説。</p>
</header>
${renderPurchaseButton('purchase-top')}
<main>
${renderSections()}
</main>
${renderPurchaseButton('purchase-bottom')}
<footer class="site-footer">
  <p><a class="contact-link" href="${CONTACT_MAILTO}">お問い合わせ</a>　<a class="contact-link" href="tokushoho.html">特定商取引法に基づく表記</a>　<a class="contact-link" href="privacy.html">プライバシーポリシー</a></p>
</footer>
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, OUT_ROOT), { recursive: true });
fs.writeFileSync(path.join(ROOT, OUT_ROOT, 'index.html'), html, 'utf8');
console.log(`生成しました: ${OUT_ROOT}/index.html`);
