import type { ArtistSearchResult } from "../lastfm/schemas";

export type ArtistSuggestion = { name: string; listeners: number };

// 聽眾太少的通常是拼錯的分身（例如 radıohead 只有 117 位），不列出
const MIN_LISTENERS = 1000;

// 比對「是不是同一個名字」用：去掉重音（é → e、İ → I），土耳其文沒有點的 ı 也當成 i，再轉小寫、合併空白
// 只用來判斷重複，不改顯示的名字
function lookalikeKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Last.fm 的搜尋結果 → 自動完成和「你是不是要找」的建議清單
// 保留 Last.fm 的順序（它已經依相關程度排好）；名字看起來一樣的只留聽眾最多的那位
export function toArtistSuggestions(results: ArtistSearchResult[], limit = 8): ArtistSuggestion[] {
  const byKey = new Map<string, ArtistSuggestion>();
  for (const { name, listeners } of results) {
    if (listeners < MIN_LISTENERS) continue;
    const key = lookalikeKey(name);
    const existing = byKey.get(key);
    // Map 保留第一次 set 的位置；之後換成聽眾更多的那位，位置不變
    if (!existing || listeners > existing.listeners) byKey.set(key, { name, listeners });
  }
  return [...byKey.values()].slice(0, limit);
}
