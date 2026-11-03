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

// 不需要 API key。country 決定查哪一國的商店：曲目、歌手名的寫法、能不能試聽都會不同
export function createItunesClient({ fetch = globalThis.fetch, country = "TW" }: { fetch?: Fetch; country?: string } = {}) {
  // country 可以每次指定，覆蓋建立 client 時的預設
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

    // 和 Last.fm 不同，iTunes 出錯時 HTTP 狀態就是 4xx，所以看 res.ok 就夠
    if (!res.ok) {
      const error = errorResponse.safeParse(body);
      throw new ItunesError(`search: ${error.success ? error.data.errorMessage : `HTTP ${res.status}`}`, res.status);
    }
    return searchResponse.parse(body);
  }

  return { searchTracks };
}

export type ItunesClient = ReturnType<typeof createItunesClient>;
