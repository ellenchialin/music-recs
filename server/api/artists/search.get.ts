import { z } from "zod";
import { LastfmError } from "../../lastfm/client";
import { getLastfmClient } from "../../services/clients";
import { toArtistSuggestions } from "../../utils/artist-suggestions";
import { normalizeArtistName } from "../../../shared/utils/normalize-artist-name";

// GET /api/artists/search?q=tame → [{ name, listeners }]，給種子輸入框的自動完成
const query = z.object({ q: z.string().trim().min(1).max(100) });

// Nitro 的快取：同樣的關鍵字一天內直接回上次的結果，不再打 Last.fm
// key 用正規化後的字：「Tame」「tame 」算同一個
export default defineCachedEventHandler(
  async (event) => {
    const { q } = await getValidatedQuery(event, (input) => query.parse(input));
    try {
      return toArtistSuggestions(await getLastfmClient().searchArtists(q, { limit: 15 }));
    } catch (err) {
      if (err instanceof LastfmError) {
        throw createError({ statusCode: 502, statusMessage: "Music data is unavailable, try again later" });
      }
      throw err;
    }
  },
  {
    maxAge: 60 * 60 * 24,
    getKey: (event) => normalizeArtistName(String(getQuery(event).q ?? "")),
  },
);
