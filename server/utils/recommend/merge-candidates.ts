import type { Candidate, SeedSimilarity } from "./types";

// 把每位種子的相似清單合併成一份候選清單（SPEC：推薦第 2 點）
// - 同一位歌手（nameNorm 一樣）只出現一次，分數是每位種子給的分數加總
// - v2：每位種子給的分數只看名次，第 rank 名得 weight / (RANK_K + rank)（Reciprocal Rank Fusion）。
//   v1 直接加 match，前段分數密的種子會佔掉大部分名額；只看名次，每位種子的第 1 名一樣重
// - name、mbid 取第一次出現的
// - sources 是推薦這位歌手的種子名稱，依種子的順序
// - 依分數由高到低排；分數一樣時依 nameNorm 排，讓順序固定

// 越大，名次之間的差距越小、「被好幾位種子推薦」越佔優勢。
// 5：兩位種子各排第 5 名（2/10）贏過一位種子的第 1 名（1/6）；各排第 10 名（2/15）則落在第 2、3 名之間
export const RANK_K = 5;

export function mergeCandidates(seeds: SeedSimilarity[]): Candidate[] {
  // key 是 nameNorm：同一位歌手不管出現在幾位種子的清單裡，都累加到同一筆
  const byName = new Map<string, Candidate>();

  for (const { seed, weight, similar } of seeds) {
    // 名次依 match 決定，不依輸入順序；match 一樣時依名字，讓名次固定
    const ranked = [...similar].sort((a, b) => b.match - a.match || a.nameNorm.localeCompare(b.nameNorm));
    for (const [index, artist] of ranked.entries()) {
      // 第一次看到這位歌手就建一筆新的；之後看到就拿原本那筆來改
      const candidate = byName.get(artist.nameNorm) ?? {
        name: artist.name,
        nameNorm: artist.nameNorm,
        mbid: artist.mbid,
        score: 0,
        sources: [],
      };
      candidate.score += weight / (RANK_K + index + 1);
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

// 浮點數加法有誤差（1/7 + 1/8 和 1/8 + 1/7 不一定完全相等），排序前四捨五入到小數 6 位，
// 差不到百萬分之一的分數當成一樣、改依名字排。名次分數之間的差距遠大於這個，不會因此失去真正的差別
function roundScore(score: number): number {
  return Math.round(score * 1e6) / 1e6;
}
