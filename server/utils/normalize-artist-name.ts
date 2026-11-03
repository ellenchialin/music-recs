// 把歌手名稱轉成比對用的 key（存進 artists.name_norm）。
// 顯示一律用原本的名稱，這個值只拿來判斷「是不是同一位歌手」
export function normalizeArtistName(name: string): string {
  return (
    name
      // NFKC：「o + 兩點」合成一個 ö，全形 Ｒ 變成 R；重音和中日文不動
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      // 中間連續的空白、Tab 合成一個空格
      .replace(/\s+/g, " ")
  );
}
