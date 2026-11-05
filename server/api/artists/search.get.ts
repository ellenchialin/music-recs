import { z } from "zod";
import { LastfmError } from "../../lastfm/client";
import { getLastfmClient } from "../../services/clients";
import { enforceRateLimit } from "../../services/rate-limit";
import { toArtistSuggestions } from "../../utils/artist-suggestions";
import { normalizeArtistName } from "../../../shared/utils/normalize-artist-name";

// GET /api/artists/search?q=tame → [{ name, listeners }]，給種子輸入框的自動完成
const query = z.object({ q: z.string().trim().min(1).max(100) });

// Nitro 的快取：同樣的關鍵字一天內直接用上次的結果，不再打 Last.fm。
// key 用正規化後的字：「Tame」「tame 」算同一個。
// 只快取「打 Last.fm」這一步，不快取整個 route：速率限制要每個請求都算到，
// 整個 route 快取的話，快取命中時不會經過限制，還會把第一個人的回應 header 重播給別人
const searchArtists = defineCachedFunction(
  async (q: string) => toArtistSuggestions(await getLastfmClient().searchArtists(q, { limit: 15 })),
  { name: "artist-search", maxAge: 60 * 60 * 24, getKey: (q: string) => normalizeArtistName(q) },
);

export default defineEventHandler(async (event) => {
  // 每個 IP 每分鐘的上限，超過回 429（快取命中也算一次：限制的是「打這個 API」）
  await enforceRateLimit(event, "search");
  const { q } = await getValidatedQuery(event, (input) => query.parse(input));
  try {
    return await searchArtists(q);
  } catch (err) {
    if (err instanceof LastfmError) {
      throw createError({ statusCode: 502, statusMessage: "Music data is unavailable, try again later" });
    }
    throw err;
  }
});
