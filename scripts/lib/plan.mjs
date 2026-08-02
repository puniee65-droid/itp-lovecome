// シリーズ計画の定数。設定書 §1〜§3 をコード化したもの。

export const PARTS = [
  { part: 1, from: 1,   to: 28,  name: 'はじめての勉強会', quota: { strategy: 8,  management: 4, technology: 16 } },
  { part: 2, from: 29,  to: 50,  name: '不合格',           quota: { strategy: 12, management: 5, technology: 5  } },
  { part: 3, from: 51,  to: 78,  name: '二人の距離',       quota: { strategy: 8,  management: 6, technology: 14 } },
  { part: 4, from: 79,  to: 100, name: '合格へ',           quota: { strategy: 7,  management: 5, technology: 10 } },
  { part: 5, from: 101, to: 108, name: 'それから',         quota: { strategy: 0,  management: 0, technology: 0  } },
];

// 話数 → 月（設定書 §1-2 の季節表）
export function monthOf(ep) {
  const table = [
    [1, 10, '4月'], [11, 18, '5月'], [19, 24, '6月'], [25, 28, '7月'],
    [29, 40, '8月'], [41, 50, '9月'],
    [51, 58, '10月'], [59, 66, '11月'], [67, 74, '12月'], [75, 78, '1月'],
    [79, 90, '2月'], [91, 100, '3月'],
    [101, 108, '3〜4月'],
  ];
  for (const [a, b, m] of table) if (ep >= a && ep <= b) return m;
  return '不明';
}

export function partOf(ep) {
  return PARTS.find(p => ep >= p.from && ep <= p.to) ?? PARTS[0];
}

// デレ度（設定書 §2-3）
export function tsundereRatio(ep) {
  if (ep <= 28) return '8:2';
  if (ep <= 35) return '3:7';
  if (ep <= 50) return '6:4';
  if (ep <= 78) return '5:5';
  if (ep <= 100) return '4:6';
  return '2:8';
}

// 部ごとに使ってよい場所（設定書 §3-3）
export const PART_LOCATIONS = {
  1: ['拓也の家', '美咲の家', 'ファミレス', 'カフェ', '図書館', '公園', '大学の講義棟・学食',
      'コンビニ', '家電量販店', '母校の高校', '就活イベント', '電車内', 'スーパー・商店街',
      '銀行・ATM', '美咲のバイト先', 'ネットカフェ', 'カラオケ'],
  2: ['祖父母の家・田舎', '海', '山', 'プール', '公園', 'カフェ', '図書館', '拓也の家',
      '美咲の家', 'ファミレス', '電車内', 'コンビニ', '病院'],
  3: ['東大の研究室', 'データセンター見学', '遊園地', '動物園', '猫カフェ', '学園祭',
      'カフェ', '図書館', 'ファミレス', 'スーパー・商店街', '電車内', '家電量販店',
      '大学の講義棟・学食', 'カラオケ', 'コンビニ', '銀行・ATM', '美咲のバイト先'],
  4: ['図書館', '拓也の家', 'カフェ', '神社・初詣', '美咲の家', 'ファミレス',
      '大学の講義棟・学食', '公園', '就活イベント'],
  5: ['拓也の家', 'カフェ', '公園', '母校の高校', '大学の講義棟・学食'],
};

// subdomain → 相性の良い場所（設定書 §3-2 をコード化）
export const SUBDOMAIN_LOCATIONS = {
  // technology
  security:            ['データセンター見学', '銀行・ATM', 'カフェ', 'ネットカフェ', '美咲の家', '祖父母の家・田舎', '病院', '美咲のバイト先'],
  network:             ['公園', '山', '海', '電車内', 'カフェ', '祖父母の家・田舎'],
  database:            ['図書館', '動物園', 'コンビニ', '美咲のバイト先'],
  basic_theory:        ['東大の研究室', '大学の講義棟・学食', '神社・初詣'],
  algorithm:           ['東大の研究室', '遊園地', '大学の講義棟・学食'],
  software:            ['拓也の家', '家電量販店', '大学の講義棟・学食'],
  computer_components: ['拓也の家', '家電量販店'],
  system_components:   ['データセンター見学', '拓也の家', '家電量販店'],
  hardware:            ['家電量販店', '拓也の家', 'プール'],
  information_design:  ['カフェ', '図書館', '祖父母の家・田舎'],
  information_media:   ['カラオケ', '学園祭', '猫カフェ'],
  // management
  service_mgmt:        ['データセンター見学', '美咲のバイト先', 'コンビニ', 'ファミレス'],
  project_mgmt:        ['学園祭', '東大の研究室', '大学の講義棟・学食'],
  system_audit:        ['就活イベント', '銀行・ATM', '病院'],
  software_dev_mgmt:   ['東大の研究室', '拓也の家'],
  development_tech:    ['東大の研究室', '学園祭', '拓也の家'],
  // strategy
  legal:               ['就活イベント', '図書館', 'カラオケ', '病院', '母校の高校'],
  business_industry:   ['スーパー・商店街', 'コンビニ', '祖父母の家・田舎', '遊園地'],
  corporate_activity:  ['就活イベント', 'ファミレス', '学園祭', '美咲のバイト先'],
  system_strategy:     ['就活イベント', 'ファミレス', 'カフェ'],
  management_strategy: ['ファミレス', 'スーパー・商店街', 'カフェ'],
  technology_strategy: ['東大の研究室', 'データセンター見学'],
  system_planning:     ['学園祭', '東大の研究室', '就活イベント'],
};

// 会話形式に向かない問題を弾くためのキーワード
export const AVOID_PATTERNS = [
  /次の.*を.*小さい順|大きい順/,
  /求めよ|いくらか|何通り|何個|何秒|何ビット/,
  /表\s*の|下figure|図\s*の|次の図/,
  /a[,，]\s*b[,，]\s*c.*組合せ/,
];
