// GET /api/recommendations response, shared by server and client

// "error" isn't cached and may work on retry; "unavailable" means no store has a preview
export type Preview = { status: "available"; url: string } | { status: "unavailable" } | { status: "error" };

export type RecommendationCard = {
  artist: string;
  score: number;
  // Seeds this artist came from
  sources: string[];
  // null when the lookup failed
  track: { title: string; artworkUrl: string | null } | null;
  preview: Preview;
};

export type RecommendationsResult = {
  algoVersion: string;
  seeds: string[];
  recommendations: RecommendationCard[];
};

// The 404 error's data
export type SeedNotFoundData = { seed: string; suggestions: string[] };
