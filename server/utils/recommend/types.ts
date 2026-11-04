// 推薦演算法的資料形狀。演算法只吃這些普通物件，不碰資料庫和 API：
// 呼叫的人（之後的 /api/recommendations）負責從快取把資料拿出來，轉成這個形狀

// 一位種子歌手和他的相似清單（來自 artist_similar）
export type SeedSimilarity = {
  seed: string;
  // 使用者直接選的種子是 1；之後「喜歡」加進來的種子權重比較低（SPEC：回饋）
  weight: number;
  similar: SimilarArtistInput[];
};

export type SimilarArtistInput = {
  name: string;
  nameNorm: string;
  mbid: string | null;
  // Last.fm 的相似度，0～1
  match: number;
};

// 合併後的候選歌手
export type Candidate = {
  name: string;
  nameNorm: string;
  mbid: string | null;
  // 分數：每位種子的 weight × match 加總，越高越前面
  score: number;
  // 跟哪幾位種子相似，依種子的順序；推薦理由沒做時顯示「和 A、B 相似」
  sources: string[];
};

// 要從結果排除的歌手：種子本身、按過不喜歡的
export type ExcludedArtist = {
  nameNorm: string;
  mbid: string | null;
};
