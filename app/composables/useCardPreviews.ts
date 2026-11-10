import type { CardPreview, RecommendationCard } from "~~/shared/types/recommendations";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";
import { previewQueue } from "~/utils/card-previews";

// The recommendations list arrives before previews that weren't cached. This fetches them from
// /api/previews, nearest record first, a few at a time, and keeps them by artist so going back to a
// level doesn't fetch them again. Merge them into cards with withPreviews()

// The server looks each one up on Last.fm and iTunes; more at once would just queue on its budgets
const CONCURRENCY = 3;

export function useCardPreviews() {
  const loaded = useState<Record<string, CardPreview>>("card-previews", () => ({}));
  const api = useApiFetch();
  const inFlight = new Set<string>();

  async function fetchOne(artist: string) {
    const key = normalizeArtistName(artist);
    if (loaded.value[key] || inFlight.has(key)) return;
    inFlight.add(key);
    try {
      loaded.value[key] = await api<CardPreview>("/api/previews", { query: { artist } });
    } catch {
      // Includes 429: the card offers Retry
      loaded.value[key] = { track: null, preview: { status: "error" } };
    } finally {
      inFlight.delete(key);
    }
  }

  async function load(cards: RecommendationCard[], active: number) {
    const queue = previewQueue(cards, active);
    const worker = async () => {
      for (let artist = queue.shift(); artist !== undefined; artist = queue.shift()) await fetchOne(artist);
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  }

  function retry(artist: string) {
    const { [normalizeArtistName(artist)]: _, ...rest } = loaded.value;
    loaded.value = rest;
    void fetchOne(artist);
  }

  return { loaded, load, retry };
}
