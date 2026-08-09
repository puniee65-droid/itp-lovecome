// web/ 配下のページ分割（20話ごとのグループ）に関する共通ロジック。
// build-html.mjs と build-index.mjs の両方から参照する。

export const TOTAL_EPISODES = 108;
export const GROUP_SIZE = 20;

export function groupDirName(ep) {
  const start = Math.floor((ep - 1) / GROUP_SIZE) * GROUP_SIZE + 1;
  const end = Math.min(start + GROUP_SIZE - 1, TOTAL_EPISODES);
  return `${start}-${end}`;
}

// 各グループの { dir, start, end, episodes: [1,2,...] } を順番に返す
export function allGroups() {
  const groups = [];
  for (let start = 1; start <= TOTAL_EPISODES; start += GROUP_SIZE) {
    const end = Math.min(start + GROUP_SIZE - 1, TOTAL_EPISODES);
    const episodes = [];
    for (let ep = start; ep <= end; ep++) episodes.push(ep);
    groups.push({ dir: `${start}-${end}`, start, end, episodes });
  }
  return groups;
}

// グループの index.html が web/ からどのパスにあるか（1番目のグループだけ web/index.html 直下）
export function indexPathFor(groupIndex, groups) {
  return groupIndex === 0 ? 'index.html' : `${groups[groupIndex].dir}/index.html`;
}
