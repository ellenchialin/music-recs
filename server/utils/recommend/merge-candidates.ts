import type { Candidate, SeedSimilarity } from "./types";

// 把每位種子的相似清單合併成一份候選清單（SPEC：推薦第 2 點）
// - 同一位歌手（nameNorm 一樣）只出現一次，分數是每位種子的 weight × match 加總
// - name、mbid 取第一次出現的
// - sources 是推薦這位歌手的種子名稱，依種子的順序
// - 依分數由高到低排；分數一樣時依 nameNorm 排，讓順序固定
export function mergeCandidates(seeds: SeedSimilarity[]): Candidate[] {
  // key 是 nameNorm：同一位歌手不管出現在幾位種子的清單裡，都累加到同一筆
  const byName = new Map<string, Candidate>();

  for (const { seed, weight, similar } of seeds) {
    for (const artist of similar) {
      // 第一次看到這位歌手就建一筆新的；之後看到就拿原本那筆來改
      const candidate = byName.get(artist.nameNorm) ?? {
        name: artist.name,
        nameNorm: artist.nameNorm,
        mbid: artist.mbid,
        score: 0,
        sources: [],
      };
      candidate.score += weight * artist.match;
      // 同一位種子的清單裡重複出現時，sources 不重複記
      if (!candidate.sources.includes(seed)) candidate.sources.push(seed);
      byName.set(artist.nameNorm, candidate);
    }
  }

  // 分數一樣時 b.score - a.score 是 0，|| 就改比名字
  return [...byName.values()]
    .map((c) => ({ ...c, score: roundScore(c.score) }))
    .sort((a, b) => b.score - a.score || a.nameNorm.localeCompare(b.nameNorm));
}

// 浮點數加法有誤差（0.1 + 0.2 = 0.30000000000000004），排序前四捨五入到小數 6 位，
// 差不到百萬分之一的分數當成一樣、改依名字排。Last.fm 的 match 最多 6 位小數，這麼小的差別對推薦沒有意義
function roundScore(score: number): number {
  return Math.round(score * 1e6) / 1e6;
}
