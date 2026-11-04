import { getArtist, getSimilarArtists } from "../cache/lastfm";
import { getArtistTrack, type ArtistTrack } from "../cache/tracks";
import type { Db } from "../db/client";
import type { ItunesClient } from "../itunes/client";
import { LastfmError, type LastfmClient } from "../lastfm/client";
import { mapLimit } from "../utils/map-limit";
import { normalizeArtistName } from "../utils/normalize-artist-name";
import { recommend } from "../utils/recommend/recommend";
import type { SeedSimilarity } from "../utils/recommend/types";

// /api/recommendations 背後的流程：種子 → 快取拿相似清單 → 演算法 → 每張卡片補試聽
// 這一層負責串接和錯誤處理；規則在純函式（recommend），資料在快取（cache/）

type Deps = {
  db: Db;
  lastfm: Pick<LastfmClient, "getInfo" | "getSimilar" | "getTopTracks" | "searchArtists">;
  itunes: Pick<ItunesClient, "searchTracks">;
  now: Date;
};

// 試聽的三種狀態（docs/ai-log.md「歌曲快取」#5）
export type Preview = { status: "available"; url: string } | { status: "unavailable" } | { status: "error" };

export type RecommendationCard = {
  artist: string;
  score: number;
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

// 種子找不到時丟這個，route 把它轉成 404，前端顯示「你是不是要找…」
export class SeedNotFoundError extends Error {
  constructor(
    readonly seed: string,
    readonly suggestions: string[],
  ) {
    super(`Artist not found: ${seed}`);
    this.name = "SeedNotFoundError";
  }
}

// 同時最多打幾個外部 API：Last.fm 要求每秒不超過約 5 次，iTunes 每分鐘約 20 次
const CONCURRENCY = 3;
// 搜尋建議只列聽眾數夠多的，擋掉 radıohead 這種拼錯的分身
const SUGGESTION_MIN_LISTENERS = 1000;
const SUGGESTION_LIMIT = 5;

export async function getRecommendations(deps: Deps, input: { seeds: string[] }): Promise<RecommendationsResult> {
  // 同一位歌手輸入兩次只算一次，不然分數會加倍
  const seedNames = [...new Map(input.seeds.map((s) => [normalizeArtistName(s), s.trim()])).values()];

  const seeds = await mapLimit(seedNames, CONCURRENCY, async (name): Promise<SeedSimilarity> => {
    const artist = await getArtistOrSuggest(deps, name);
    const similar = await getSimilarArtists(deps, artist);
    return { seed: artist.name, seedMbid: artist.mbid, weight: 1, similar };
  });

  const { algoVersion, artists } = recommend({ seeds });

  // 每張卡片自己接住錯誤：一位歌手的試聽查詢失敗，不拖垮整份推薦
  const recommendations = await mapLimit(artists, CONCURRENCY, async (candidate): Promise<RecommendationCard> => {
    const base = { artist: candidate.name, score: candidate.score, sources: candidate.sources };
    try {
      const track = await getArtistTrack(deps, candidate.name);
      return { ...base, track: track && { title: track.title, artworkUrl: track.artworkUrl }, preview: toPreview(track) };
    } catch {
      // 錯誤沒有被快取（cache/tracks.ts），下次請求會再試
      return { ...base, track: null, preview: { status: "error" } };
    }
  });

  return { algoVersion, seeds: seeds.map((s) => s.seed), recommendations };
}

async function getArtistOrSuggest(deps: Deps, name: string) {
  try {
    return await getArtist(deps, name);
  } catch (err) {
    // 6 = 找不到歌手；其他錯誤（Last.fm 當機）照樣往上丟
    if (!(err instanceof LastfmError) || err.code !== 6) throw err;
    const results = await deps.lastfm.searchArtists(name);
    const suggestions = results
      .filter((r) => r.listeners >= SUGGESTION_MIN_LISTENERS)
      .slice(0, SUGGESTION_LIMIT)
      .map((r) => r.name);
    throw new SeedNotFoundError(name, suggestions);
  }
}

function toPreview(track: ArtistTrack | null): Preview {
  return track?.previewUrl ? { status: "available", url: track.previewUrl } : { status: "unavailable" };
}
