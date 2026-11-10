import type { CardPreview, RecommendationCard } from "~~/shared/types/recommendations";
import { normalizeArtistName } from "~~/shared/utils/normalize-artist-name";

// The list arrives before most previews; these decide which to fetch first and merge them back in

// Pending cards' artists, nearest to the record being viewed first. Next before previous, since
// visitors flip forward more than back
export function previewQueue(cards: RecommendationCard[], active: number): string[] {
  return cards
    .map((card, index) => ({ card, offset: index - active }))
    .filter(({ card }) => card.preview.status === "pending")
    .sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset) || b.offset - a.offset)
    .map(({ card }) => card.artist);
}

// loaded is keyed by normalized artist name. A loaded preview wins over the card's own, so a
// retried error is replaced too
export function withPreviews(cards: RecommendationCard[], loaded: Record<string, CardPreview>): RecommendationCard[] {
  return cards.map((card) => {
    const preview = loaded[normalizeArtistName(card.artist)];
    return preview ? { ...card, ...preview } : card;
  });
}
