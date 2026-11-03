import type { ItunesTrack } from "../itunes/schemas";
import { normalizeArtistName } from "./normalize-artist-name";

// 歌名後面接這些，才算同一首歌的其他版本："Creep (Acoustic)"、"Creep [Live]"、"First Love - From THE FIRST TAKE"
// 前面都有空白，所以 "Creeping Death"、"Creep-Show" 不算
const VERSION_SEPARATORS = [" (", " [", " - "];

// 從 iTunes 的搜尋結果挑出「這位歌手的這首歌」，給推薦卡片用。挑不到就回 null（卡片不顯示播放鈕）
// 規則（優先順序由高到低）：
// 1. 歌手要對、要有試聽：其他歌手的同名歌、沒有試聽的結果都不算
// 2. 歌名完全相同的優先（原版）
// 3. 沒有原版，才接受「歌名 + 版本說明」，例如 "Creep (Acoustic)"、"First Love - From THE FIRST TAKE"
// 同一級有好幾首時，取 iTunes 排在前面的
// 比對歌手和歌名時都不分大小寫、不管前後空白
export function pickTrack(tracks: ItunesTrack[], want: { artist: string; title: string }): ItunesTrack | null {
  // normalizeArtistName 只做 NFKC、trim、小寫、合併空白，歌名也適用
  const artist = normalizeArtistName(want.artist);
  const title = normalizeArtistName(want.title);

  // 規則 1：先過濾出有資格的候選
  const candidates = tracks.filter((t) => t.previewUrl !== null && normalizeArtistName(t.artist) === artist);

  // 規則 2、3：先找原版，找不到再找版本；find 找不到回 undefined，剛好接 ??
  return (
    candidates.find((t) => normalizeArtistName(t.name) === title) ??
    candidates.find((t) => {
      const name = normalizeArtistName(t.name);
      return VERSION_SEPARATORS.some((sep) => name.startsWith(title + sep));
    }) ??
    null
  );
}
