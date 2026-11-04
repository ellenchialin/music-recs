// GET /api/recommendations 的回應形狀。前端和後端共用，改一邊另一邊的型別檢查會跟著報錯

// 試聽的三種狀態（docs/ai-log.md「歌曲快取」#5）
export type Preview = { status: "available"; url: string } | { status: "unavailable" } | { status: "error" };

export type RecommendationCard = {
  artist: string;
  score: number;
  // 推薦這位歌手的種子，卡片顯示「和 A、B 相似」
  sources: string[];
  // Last.fm 的代表歌；查詢失敗時是 null
  track: { title: string; artworkUrl: string | null } | null;
  preview: Preview;
};

export type RecommendationsResult = {
  algoVersion: string;
  seeds: string[];
  recommendations: RecommendationCard[];
};

// 404 時 data 的形狀：找不到的種子和建議的名字
export type SeedNotFoundData = { seed: string; suggestions: string[] };
