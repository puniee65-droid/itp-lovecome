#!/usr/bin/env node
/**
 * 書き上げた記事を検証する。
 *   node scripts/verify.mjs 3
 *
 * 検証するのは「機械的に確認できること」だけ。
 * 踏み込んだ説明の正しさは検証できないので、必ず人間が読むこと。
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { partOf, monthOf, tsundereRatio } from './lib/plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const LABELS = ['ア', 'イ', 'ウ', 'エ'];

const ep = Number(process.argv[2]);
if (!ep) { console.error('使い方: node scripts/verify.mjs <話数>'); process.exit(1); }

const file = path.join(ROOT, 'episodes', `ep${String(ep).padStart(3, '0')}.md`);
if (!fs.existsSync(file)) { console.error(`見つかりません: ${file}`); process.exit(1); }
const md = fs.readFileSync(file, 'utf8');

// --- メタ情報を読む ---
const metaBlock = md.match(/<!--\s*meta([\s\S]*?)-->/);
if (!metaBlock) { console.error('✗ 先頭の <!-- meta --> ブロックがありません'); process.exit(1); }
const meta = Object.fromEntries(
  metaBlock[1].trim().split('\n').map(l => {
    const i = l.indexOf(':');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);

const errors = [], warns = [], oks = [];

// --- DBと突き合わせ ---
const { data: q, error } = await sb
  .from('questions')
  .select('body, choices, correct_index, domain, subdomain, image_url')
  .eq('year', meta.year).eq('number', Number(meta.number)).single();
if (error) { console.error(`✗ DB取得失敗: ${error.message}`); process.exit(1); }

const choices = Array.isArray(q.choices) ? q.choices : JSON.parse(q.choices);
const correctLabel = LABELS[q.correct_index];
const correctText = choices[q.correct_index];

// 1) 正解表記（★最重要）
const ansLine = md.match(/\*\*答え[：:]\s*([アイウエ])/);
if (!ansLine) errors.push('「**答え：◯ …**」の行が見つかりません');
else if (ansLine[1] !== correctLabel)
  errors.push(`正解が違います。記事=${ansLine[1]} / DB=${correctLabel}（${correctText}）`);
else oks.push(`正解一致: ${correctLabel} ${correctText}`);

// 2) 選択肢が4つとも本文に含まれるか
const missing = choices.filter(c => !md.includes(c.trim().slice(0, 12)));
if (missing.length) errors.push(`本文に無い選択肢: ${missing.join(' / ')}`);
else oks.push('選択肢4つを記載');

// 3) 問題文の改変チェック（先頭30字）
const head = q.body.trim().slice(0, 30);
if (!md.includes(head)) warns.push(`問題文が原文と違う可能性: 「${head}…」`);
else oks.push('問題文が原文どおり');

// 4) 図表問題でないか
if (q.image_url) errors.push('図表つき問題です。会話形式には使えません');

// 5) 物語の整合
const p = partOf(ep);
if (meta.part && Number(meta.part) !== p.part) errors.push(`部が違います。記事=${meta.part} / 計画=${p.part}`);
if (meta.month && meta.month !== monthOf(ep)) warns.push(`季節が計画とずれています。記事=${meta.month} / 計画=${monthOf(ep)}`);

// 6) 重複チェック
const st = JSON.parse(fs.readFileSync(path.join(ROOT, 'state', 'series-state.json'), 'utf8'));
const recent = st.used_questions.filter(u => u.episode >= ep - 10).map(u => u.location);
if (meta.location && recent.includes(meta.location)) errors.push(`場所が直近10話と重複: ${meta.location}`);
if (meta.blunder && st.used_blunders.includes(meta.blunder)) errors.push(`失言パターンが使用済み: ${meta.blunder}`);
if (meta.metaphor && st.used_metaphors.some(m => m.includes(meta.metaphor.slice(0, 6))))
  warns.push(`比喩が既出に近い: ${meta.metaphor}`);

// 7) 物語ルール
if (ep >= 29 && ep <= 35 && meta.blunder && meta.blunder !== 'なし')
  errors.push('第29〜35話は拓也が失言しない区間です');
if (ep < 108 && /好きだ|付き合って|愛して/.test(md))
  warns.push('告白めいた表現があります。第108話まで温存する設計です');

// 8) フォーマット
for (const [label, re] of [
  ['まとめ表', /\|\s*選択肢\s*\|/],
  ['覚え方のコツ', /##\s*覚え方のコツ/],
  ['エピローグ', /##\s*エピローグ/],
  ['ポイントおさらい', /##\s*今日のポイントおさらい/],
]) if (!re.test(md)) warns.push(`${label} のセクションがありません`);

// --- 出力 ---
console.log(`\n=== 第${ep}話 検証 [${meta.year} 問${meta.number}] ${q.domain}/${q.subdomain} ===`);
oks.forEach(m => console.log(`  ✓ ${m}`));
warns.forEach(m => console.log(`  ⚠ ${m}`));
errors.forEach(m => console.log(`  ✗ ${m}`));

console.log(`\nデレ度の目安: ${tsundereRatio(ep)} / 場所: ${meta.location ?? '未記入'}`);
console.log('\n【機械では検証できないもの】以下は必ず人間が読んでください:');
console.log('  ・不正解3つの説明が正しいか');
console.log('  ・「なぜそうなるか」の踏み込んだ説明に事実誤認がないか');
console.log('  ・DBのexplanationの誤りをそのまま写していないか');

process.exit(errors.length ? 1 : 0);
