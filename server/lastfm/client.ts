import type { z } from "zod";
import {
  artistInfoResponse,
  artistSearchResponse,
  errorResponse,
  similarArtistsResponse,
  topTagsResponse,
  topTracksResponse,
} from "./schemas";

const BASE_URL = "https://ws.audioscrobbler.com/2.0/";

// https://www.last.fm/api/errorcodes (6 = not found, 29 = rate limit exceeded)
export class LastfmError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null = null,
  ) {
    super(message);
    this.name = "LastfmError";
  }
}

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createLastfmClient({ apiKey, fetch = globalThis.fetch }: { apiKey: string; fetch?: Fetch }) {
  async function call<T extends z.ZodType>(params: Record<string, string>, schema: T): Promise<z.output<T>> {
    const url = new URL(BASE_URL);
    url.search = new URLSearchParams({ ...params, api_key: apiKey, format: "json" }).toString();
    // Never put the URL in errors: it contains the API key
    const method = params.method ?? "unknown";

    const res = await fetch(url);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new LastfmError(`${method}: HTTP ${res.status}, response is not JSON`, res.status);
    }

    // Errors can arrive as HTTP 200 with an `error` field, so check the body, not just res.ok
    const error = errorResponse.safeParse(body);
    if (error.success) {
      throw new LastfmError(`${method}: ${error.data.message}`, res.status, error.data.error);
    }
    if (!res.ok) throw new LastfmError(`${method}: HTTP ${res.status}`, res.status);

    return schema.parse(body);
  }

  const byArtist = (method: string, artist: string, limit?: number) => ({
    method,
    artist,
    ...(limit === undefined ? {} : { limit: String(limit) }),
    autocorrect: "1",
  });

  return {
    searchArtists: (query: string, { limit = 10 } = {}) =>
      call({ method: "artist.search", artist: query, limit: String(limit) }, artistSearchResponse),
    getSimilar: (artist: string, { limit }: { limit?: number } = {}) =>
      call(byArtist("artist.getSimilar", artist, limit), similarArtistsResponse),
    getTopTags: (artist: string) => call(byArtist("artist.getTopTags", artist), topTagsResponse),
    getTopTracks: (artist: string, { limit }: { limit?: number } = {}) =>
      call(byArtist("artist.getTopTracks", artist, limit), topTracksResponse),
    getInfo: (artist: string) => call(byArtist("artist.getInfo", artist), artistInfoResponse),
  };
}

export type LastfmClient = ReturnType<typeof createLastfmClient>;
