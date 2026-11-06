import { errorResponse, searchResponse, type ItunesTrack } from "./schemas";

const BASE_URL = "https://itunes.apple.com/search";

export class ItunesError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ItunesError";
  }
}

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

// No API key needed. The store (country) changes the catalog, name spellings and previews
export function createItunesClient({ fetch = globalThis.fetch, country = "TW" }: { fetch?: Fetch; country?: string } = {}) {
  async function searchTracks(
    term: string,
    { limit = 10, country: store = country }: { limit?: number; country?: string } = {},
  ): Promise<ItunesTrack[]> {
    const url = new URL(BASE_URL);
    url.search = new URLSearchParams({ term, entity: "song", limit: String(limit), country: store }).toString();

    const res = await fetch(url);
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ItunesError(`search: HTTP ${res.status}, response is not JSON`, res.status);
    }

    // Unlike Last.fm, iTunes errors use HTTP status codes
    if (!res.ok) {
      const error = errorResponse.safeParse(body);
      throw new ItunesError(`search: ${error.success ? error.data.errorMessage : `HTTP ${res.status}`}`, res.status);
    }
    return searchResponse.parse(body);
  }

  return { searchTracks };
}

export type ItunesClient = ReturnType<typeof createItunesClient>;
