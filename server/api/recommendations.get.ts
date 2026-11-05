import { getDb } from "../db/client";
import { LastfmError } from "../lastfm/client";
import { getItunesClient, getLastfmClient } from "../services/clients";
import { enforceRateLimit } from "../services/rate-limit";
import { SeedNotFoundError, getRecommendations } from "../services/recommendations";
import { recommendationsQuery } from "../services/recommendations-query";

// GET /api/recommendations?seed=Tame%20Impala&seed=Kokoroko（往下挖時加 &exclude=…）
// route 只做四件事：速率限制、驗證輸入、呼叫 service、把錯誤轉成 HTTP 狀態碼
export default defineEventHandler(async (event) => {
  // 每個 IP 每分鐘的上限，超過回 429
  await enforceRateLimit(event, "recommendations");
  // 格式不對時 h3 回 400
  const { seeds, exclude } = await getValidatedQuery(event, (query) => recommendationsQuery.parse(query));

  try {
    return await getRecommendations(
      { db: getDb(), lastfm: getLastfmClient(), itunes: getItunesClient(), now: new Date() },
      { seeds, exclude },
    );
  } catch (err) {
    // 種子找不到：404，附上相近的歌手名讓前端建議使用者
    if (err instanceof SeedNotFoundError) {
      throw createError({
        statusCode: 404,
        statusMessage: "Artist not found",
        data: { seed: err.seed, suggestions: err.suggestions },
      });
    }
    // Last.fm 當機或速率限制：502，不把 Last.fm 的原始訊息傳給前端
    if (err instanceof LastfmError) {
      throw createError({ statusCode: 502, statusMessage: "Music data is unavailable, try again later" });
    }
    throw err;
  }
});
