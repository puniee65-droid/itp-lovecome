#!/usr/bin/env node
/**
 * 次の話に使う問題の候補を3件出す。
 *
 *   node scripts/pick-question.mjs
 *   node scripts/pick-question.mjs --domain strategy
 *   node scripts/pick-question.mjs --subdomain legal
 *   node scripts/pick-question.mjs --commit r06 12 --location 就活イベント \
 *        --metaphor "名刺交換＝プロトコル" --blunder 先回り
 */
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PARTS, partOf, monthOf, tsundereRatio,
  PART_LOCATIONS, SUBDOMAIN_LOCATIONS, AVOID_PATTERNS,
  DOMAIN_OF_SUBDOMAIN,
} from './lib/plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATE = path.join(ROOT, 'state', 'series-state.json');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, { realtime: { transport: ws }, auth: { persistSession: false, autoRefreshToken: false } });

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const readState = () => JSON.parse(fs.readFileSync(STATE, 'utf8'));
const writeState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2) + '\n');

// ---------- commit モード ----------
if (args.includes('--commit')) {
  const i = args.indexOf('--commit');
  const [year, number] = [args[i + 1], Number(args[i + 2])];
  const st = readState();
  const ep = st.next_episode;

  const { data, error } = await sb
    .from('questions')
    .select('domain, subdomain')
    .eq('year', year).eq('number', number).single();
  if (error) { console.error(error.message); process.exit(1); }

  st.used_questions.push({
    episode: ep, year, number,
    domain: data.domain, subdomain: data.subdomain,
    location: flag('location') ?? '未記録',
  });
  if (flag('metaphor')) st.used_metaphors.push(flag('metaphor'));
  if (flag('blunder'))  st.used_blunders.push(flag('blunder'));
  if (flag('gag'))      st.used_epilogue_gags.push(flag('gag'));
  st.next_episode = ep + 1;

  writeState(st);
  console.log(`第${ep}話を記録しました。次は第${st.next_episode}話です。`);
  process.exit(0);
}

// ---------- 候補提示モード ----------
const st = readState();
const ep = Number(flag('episode') ?? st.next_episode);
const p = partOf(ep);

// 1) この部で残っている分野クォータを計算
const usedInPart = st.used_questions.filter(q => q.episode >= p.from && q.episode <= p.to);
const remaining = { ...p.quota };
for (const q of usedInPart) if (remaining[q.domain] != null) remaining[q.domain] -= 1;

// 明示指定がなければ、残りが最も多い分野を選ぶ
const domain = flag('domain')
  ?? (flag('subdomain') ? DOMAIN_OF_SUBDOMAIN[flag('subdomain')] : null)
  ?? Object.entries(remaining).sort((a, b) => b[1] - a[1])[0][0];

// 2) 直近10話で使った場所
const recentLocations = st.used_questions
  .filter(q => q.episode >= ep - 10)
  .map(q => q.location);
const allowed = (PART_LOCATIONS[p.part] ?? []).filter(l => !recentLocations.includes(l));

// 3) 候補取得（図表問題・使用済みを除外）
let q = sb.from('questions')
  .select('id, year, number, domain, subdomain, body, choices, correct_index')
  .eq('domain', domain)
  .is('image_url', null)
  .neq('choices_in_figure', true);
if (flag('subdomain')) q = q.eq('subdomain', flag('subdomain'));

const { data: rows, error } = await q;
if (error) { console.error(error.message); process.exit(1); }

// 未解決の誤り報告がある問題を除外
const { data: reports } = await sb
  .from('question_reports').select('question_id').eq('resolved', false);
const reported = new Set((reports ?? []).map(r => r.question_id));
const usedKeys = new Set(st.used_questions.map(u => `${u.year}-${u.number}`));

const pool = rows.filter(r =>
  !usedKeys.has(`${r.year}-${r.number}`) &&
  !reported.has(r.id) &&
  !AVOID_PATTERNS.some(re => re.test(r.body))
);

console.log(`DB取得 ${rows.length} 件 → 除外後 ${pool.length} 件` +
  (rows.length === 0 ? '（0件ならRLSポリシーを疑う）' : ''));

// 4) スコアリング：この部で使える場所と結びつく subdomain を優遇
const scored = pool.map(r => {
  const locs = (SUBDOMAIN_LOCATIONS[r.subdomain] ?? []).filter(l => allowed.includes(l));
  let score = locs.length * 10;
  if (r.body.length < 90) score += 6;                    // 短い問題文は会話に載せやすい
  if (/スマートフォン|SNS|パスワード|メール|クレジット|コンビニ|会社|従業員/.test(r.body)) score += 8;
  return { ...r, locs, score: score + Math.random() * 3 };
}).sort((a, b) => b.score - a.score);

// 5) subdomain が散らばるように上位から3件
const picked = [];
for (const c of scored) {
  if (picked.length >= 3) break;
  if (picked.some(x => x.subdomain === c.subdomain) && scored.length > 20) continue;
  picked.push(c);
}

const LABELS = ['ア', 'イ', 'ウ', 'エ'];
console.log(`\n=== 第${ep}話 / 第${p.part}部「${p.name}」/ ${monthOf(ep)} / デレ度 ${tsundereRatio(ep)} ===`);
console.log(`分野: ${domain}（この部の残り ${JSON.stringify(remaining)}）`);
console.log(`使える場所: ${allowed.join('、') || '（要見直し）'}`);
if (ep >= 29 && ep <= 35) console.log('⚠ 第29〜35話は拓也が失言しない区間です');
console.log(`候補 ${pool.length} 件から3件:\n`);

picked.forEach((c, i) => {
  const ch = Array.isArray(c.choices) ? c.choices : JSON.parse(c.choices);
  console.log(`--- 候補${i + 1} [${c.year} 問${c.number}] ${c.domain}/${c.subdomain}`);
  console.log(c.body.trim());
  ch.forEach((t, j) => console.log(`  ${LABELS[j]} ${t}`));
  console.log(`  正解: ${LABELS[c.correct_index]}（correct_index=${c.correct_index}／0起点）`);
  console.log(`  推奨の場所: ${c.locs.join('、') || '（要検討）'}\n`);
});


