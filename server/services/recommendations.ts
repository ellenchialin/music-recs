import { getArtist, getSimilarArtists } from "../cache/lastfm";
import { getArtistTrack, getCachedArtistTrack, type ArtistTrack } from "../cache/tracks";
import type { Db } from "../db/client";
import type { ItunesClient } from "../itunes/client";
import { LastfmError, type LastfmClient } from "../lastfm/client";
import { toArtistSuggestions } from "../utils/artist-suggestions";
import { mapLimit } from "../utils/map-limit";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import { recommend } from "../utils/recommend/recommend";
import type { SeedSimilarity } from "../utils/recommend/types";
import type { CardPreview, Preview, RecommendationCard, RecommendationsResult } from "../../shared/types/recommendations";

export type { CardPreview, Preview, RecommendationCard, RecommendationsResult };

// Seeds → cached similar lists → recommend() → a preview for each card.
// This layer wires things together and handles errors; the rules live in recommend()

type Deps = {
  db: Db;
  lastfm: Pick<LastfmClient, "getInfo" | "getSimilar" | "getTopTracks" | "searchArtists">;
  itunes: Pick<ItunesClient, "searchTracks">;
  now: Date;
};

export class SeedNotFoundError extends Error {
  constructor(
    readonly seed: string,
    readonly suggestions: string[],
  ) {
    super(`Artist not found: ${seed}`);
    this.name = "SeedNotFoundError";
  }
}

// Last.fm allows about 5 requests a second, iTunes about 20 a minute
const CONCURRENCY = 3;
const SUGGESTION_LIMIT = 5;

// previews: "wait" looks up every card's preview before answering (the Taste Check needs them all);
// "cached" answers right after the similar lists, with uncached previews left "pending"
export async function getRecommendations(
  deps: Deps,
  input: { seeds: string[]; exclude?: string[]; previews?: "wait" | "cached" },
): Promise<RecommendationsResult> {
  // The same artist entered twice would otherwise count double
  const seedNames = [...new Map(input.seeds.map((s) => [normalizeArtistName(s), s.trim()])).values()];

  const seeds = await mapLimit(seedNames, CONCURRENCY, async (name): Promise<SeedSimilarity> => {
    const artist = await getArtistOrSuggest(deps, name);
    const similar = await getSimilarArtists(deps, artist);
    return { seed: artist.name, seedMbid: artist.mbid, weight: 1, similar };
  });

  const exclude = (input.exclude ?? []).map((name) => ({ nameNorm: normalizeArtistName(name), mbid: null }));
  const { algoVersion, artists } = recommend({ seeds, exclude });

  const recommendations = await mapLimit(artists, CONCURRENCY, async (candidate): Promise<RecommendationCard> => {
    const base = { artist: candidate.name, score: candidate.score, sources: candidate.sources };
    if (input.previews !== "cached") return { ...base, ...(await getPreview(deps, candidate.name)) };
    const cached = await getCachedArtistTrack(deps, candidate.name);
    return { ...base, ...(cached ? toCardPreview(cached) : { track: null, preview: { status: "pending" } }) };
  });

  return { algoVersion, seeds: seeds.map((s) => s.seed), recommendations };
}

// One card's track and preview. Catches its own error so one failed preview doesn't fail a whole list
export async function getPreview(deps: Omit<Deps, "lastfm"> & { lastfm: Pick<LastfmClient, "getTopTracks"> }, artist: string): Promise<CardPreview> {
  try {
    return toCardPreview(await getArtistTrack(deps, artist));
  } catch {
    // Errors aren't cached, so the next request retries
    return { track: null, preview: { status: "error" } };
  }
}

function toCardPreview(track: ArtistTrack | null): CardPreview {
  return { track: track && { title: track.title, artworkUrl: track.artworkUrl }, preview: toPreview(track) };
}

async function getArtistOrSuggest(deps: Deps, name: string) {
  try {
    return await getArtist(deps, name);
  } catch (err) {
    // 6 = artist not found; anything else is rethrown
    if (!(err instanceof LastfmError) || err.code !== 6) throw err;
    const results = await deps.lastfm.searchArtists(name);
    const suggestions = toArtistSuggestions(results, SUGGESTION_LIMIT).map((s) => s.name);
    throw new SeedNotFoundError(name, suggestions);
  }
}

function toPreview(track: ArtistTrack | null): Preview {
  return track?.previewUrl ? { status: "available", url: track.previewUrl } : { status: "unavailable" };
}
