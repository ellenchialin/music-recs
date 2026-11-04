import type { Candidate, ExcludedArtist } from "./types";

// 從候選清單拿掉種子本身和按過不喜歡的歌手，保留原本的排序
// 名字（正規化後）一樣，或 MusicBrainz ID 一樣，都算同一位
export function excludeArtists(candidates: Candidate[], excluded: ExcludedArtist[]): Candidate[] {
  // 先做成 Set：每個候選只要查一次，不必每次都掃整個排除清單
  const names = new Set(excluded.map((e) => e.nameNorm));
  // null 不放進來：沒有 MBID 的兩位歌手不能因為「都沒有」就被當成同一位
  const mbids = new Set(excluded.flatMap((e) => (e.mbid ? [e.mbid] : [])));

  return candidates.filter((c) => !names.has(c.nameNorm) && !(c.mbid && mbids.has(c.mbid)));
}
