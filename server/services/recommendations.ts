import { getArtist, getSimilarArtists } from "../cache/lastfm";
import { getArtistTrack, getCachedArtistTrack, type ArtistTrack } from "../cache/tracks";
import type { Db } from "../db/client";
import type { ItunesClient } from "../itunes/client";
import { LastfmError, type LastfmClient } from "../lastfm/client";
import { toArtistSuggestions } from "../utils/artist-suggestions";
import { mapLimit } from "../utils/map-limit";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import { POPULARITY_POOL, rerankByPopularity } from "../utils/recommend/popularity";
import { RECOMMENDATION_LIMIT, recommend } from "../utils/recommend/recommend";
import type { Candidate, SeedSimilarity } from "../utils/recommend/types";
import { DEFAULT_POPULARITY, type Popularity } from "../../shared/types/popularity";
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
// Listener lookups are one light call each, so they can run at Last.fm's full rate
const LISTENERS_CONCURRENCY = 5;
const SUGGESTION_LIMIT = 5;

// previews: "wait" looks up every card's preview before answering (the Taste Check needs them all);
// "cached" answers right after the similar lists, with uncached previews left "pending"
export async function getRecommendations(
  deps: Deps,
  input: { seeds: string[]; exclude?: string[]; previews?: "wait" | "cached"; popularity?: Popularity },
): Promise<RecommendationsResult> {
  // The same artist entered twice would otherwise count double
  const seedNames = [...new Map(input.seeds.map((s) => [normalizeArtistName(s), s.trim()])).values()];

  const seeds = await mapLimit(seedNames, CONCURRENCY, async (name): Promise<SeedSimilarity> => {
    const artist = await getArtistOrSuggest(deps, name);
    const similar = await getSimilarArtists(deps, artist);
    return { seed: artist.name, seedMbid: artist.mbid, weight: 1, similar };
  });

  const exclude = (input.exclude ?? []).map((name) => ({ nameNorm: normalizeArtistName(name), mbid: null }));
  const popularity = input.popularity ?? DEFAULT_POPULARITY;
  const ranked = recommend({ seeds, exclude, limit: popularity === "balanced" ? RECOMMENDATION_LIMIT : POPULARITY_POOL });
  // Off the middle: re-order the most similar artists by listener count, then keep the usual ten.
  // Balanced skips this, so the default list makes no extra Last.fm calls
  const artists =
    popularity === "balanced"
      ? ranked.artists
      : rerankByPopularity(ranked.artists, await getListeners(deps, ranked.artists), popularity).slice(0, RECOMMENDATION_LIMIT);

  const recommendations = await mapLimit(artists, CONCURRENCY, async (candidate): Promise<RecommendationCard> => {
    const base = { artist: candidate.name, score: candidate.score, sources: candidate.sources };
    if (input.previews !== "cached") return { ...base, ...(await getPreview(deps, candidate.name)) };
    const cached = await getCachedArtistTrack(deps, candidate.name);
    return { ...base, ...(cached ? toCardPreview(cached) : { track: null, preview: { status: "pending" } }) };
  });

  return { algoVersion: ranked.algoVersion, popularity, seeds: seeds.map((s) => s.seed), recommendations };
}

// Each candidate's Last.fm listener count, through the same 30-day artist cache as seeds.
// A failed lookup gives null rather than failing the list (errors aren't cached, so it's retried)
async function getListeners(deps: Deps, candidates: Candidate[]): Promise<Map<string, number | null>> {
  const entries = await mapLimit(candidates, LISTENERS_CONCURRENCY, async (candidate): Promise<[string, number | null]> => {
    const listeners = await getArtist(deps, candidate.name).then(
      (artist) => artist.listeners,
      () => null,
    );
    return [candidate.nameNorm, listeners];
  });
  return new Map(entries);
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
