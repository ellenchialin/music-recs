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

// Last.fm 的錯誤碼：https://www.last.fm/api/errorcodes（6 = 找不到、29 = 超過速率限制）
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

// fetch 可以換掉：正式環境用全域的 fetch，測試傳假的進來
export function createLastfmClient({ apiKey, fetch = globalThis.fetch }: { apiKey: string; fetch?: Fetch }) {
  async function call<T extends z.ZodType>(params: Record<string, string>, schema: T): Promise<z.output<T>> {
    const url = new URL(BASE_URL);
    url.search = new URLSearchParams({ ...params, api_key: apiKey, format: "json" }).toString();
    // 錯誤訊息只放 method，不放網址：網址裡有 API key
    const method = params.method ?? "unknown";

    const res = await fetch(url);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new LastfmError(`${method}: HTTP ${res.status}, response is not JSON`, res.status);
    }

    // 錯誤可能是 4xx，也可能是 HTTP 200 + error 欄位，所以看 body 而不是只看 res.ok
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
    // 讓 Last.fm 修正常見拼錯（例如 "radiohead" → "Radiohead"）
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
