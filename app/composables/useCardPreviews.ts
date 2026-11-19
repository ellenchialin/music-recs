import type { CardPreview, RecommendationCard } from "~~/shared/types/recommendations";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";
import { previewQueue } from "~/utils/card-previews";
import { readSse } from "~/utils/sse";

// The recommendations list arrives before previews that weren't cached. This asks /api/previews
// for all of a page's missing ones in one streamed request, nearest record first, and keeps each as
// it arrives, by artist, so going back to a level doesn't fetch them again. Merge them into cards
// with withPreviews().
// One request, not several at once: right after a deploy, Vercel starts a new instance (about 2 s)
// for requests that arrive together, and the record on screen was often the one that waited

const ERROR: CardPreview = { track: null, preview: { status: "error" } };

export function useCardPreviews() {
  const loaded = useState<Record<string, CardPreview>>("card-previews", () => ({}));
  const api = useApiFetch();
  const inFlight = new Set<string>();
  // Stops the stream when the page goes away
  const leaving = new AbortController();
  onScopeDispose(() => leaving.abort());

  // onFirst runs once: when the first preview arrives, or when there's nothing to wait for
  async function fetchPreviews(artists: string[], onFirst?: () => void) {
    let first = onFirst;
    const settle = () => {
      first?.();
      first = undefined;
    };
    const wanted = artists.filter((artist) => {
      const key = normalizeArtistName(artist);
      return !loaded.value[key] && !inFlight.has(key);
    });
    if (wanted.length === 0) return settle();
    for (const artist of wanted) inFlight.add(normalizeArtistName(artist));
    try {
      const body = await api<ReadableStream<Uint8Array>>("/api/previews", {
        query: { artist: wanted },
        responseType: "stream",
        signal: leaving.signal,
      });
      await readSse(body, ({ event, data }) => {
        if (event !== "preview") return;
        const { artist, ...preview } = JSON.parse(data) as { artist: string } & CardPreview;
        const key = normalizeArtistName(artist);
        loaded.value[key] = preview;
        // Done with this one now, so a Retry on it works while the rest are still coming
        inFlight.delete(key);
        settle();
      });
    } catch {
      // Includes 429 (after $fetch's own retry) and a dropped connection; handled below
    } finally {
      // Anything the stream didn't deliver becomes an error, so its card offers Retry
      for (const artist of wanted) {
        const key = normalizeArtistName(artist);
        if (!inFlight.has(key)) continue;
        inFlight.delete(key);
        if (!leaving.signal.aborted) loaded.value[key] ??= ERROR;
      }
      settle();
    }
  }

  // onFirst: see fetchPreviews. The page waits for it before asking for reasons, so the record on
  // screen gets its preview without another request arriving alongside
  function load(cards: RecommendationCard[], active: number, onFirst?: () => void) {
    return fetchPreviews(previewQueue(cards, active), onFirst);
  }

  // The tapped card first, then every other card of the page that failed, in one request
  function retry(artist: string, cards: RecommendationCard[] = []) {
    const failed = cards
      .map((card) => card.artist)
      .filter((name) => name !== artist && loaded.value[normalizeArtistName(name)]?.preview.status === "error");
    const again = [artist, ...failed];
    const keys = new Set(again.map(normalizeArtistName));
    loaded.value = Object.fromEntries(Object.entries(loaded.value).filter(([key]) => !keys.has(key)));
    void fetchPreviews(again);
  }

  return { loaded, load, retry };
}
