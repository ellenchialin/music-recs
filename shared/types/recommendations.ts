// GET /api/recommendations response, shared by server and client

// "error" isn't cached and may work on retry; "unavailable" means no store has a preview;
// "pending" means not looked up yet: the page asks /api/previews for it
export type Preview =
  | { status: "available"; url: string }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "pending" };

export type RecommendationCard = {
  artist: string;
  score: number;
  // Seeds this artist came from
  sources: string[];
  // null when the lookup failed or hasn't happened yet
  track: CardTrack | null;
  preview: Preview;
};

export type CardTrack = { title: string; artworkUrl: string | null };

// GET /api/previews response: one card's track and preview
export type CardPreview = { track: CardTrack | null; preview: Preview };

export type RecommendationsResult = {
  algoVersion: string;
  seeds: string[];
  recommendations: RecommendationCard[];
};

// The 404 error's data
export type SeedNotFoundData = { seed: string; suggestions: string[] };
