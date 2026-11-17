import type { Popularity } from "./popularity";

// GET /api/stats response: blind-test results, shared by server and client

export type RatingStats = {
  visitors: number;
  ratings: number;
  recommendedMean: number;
  controlMean: number;
  // All three are means over visitors, so difference = recommendedMean − controlMean
  difference: number;
  // 95% confidence interval for `difference`; null with fewer than two visitors
  ci: [number, number] | null;
};

export type VersionStats = RatingStats & { algoVersion: string };
export type PopularityStats = RatingStats & { popularity: Popularity };

export type StatsResult = {
  // Per algorithm version, oldest first; Balanced rounds only
  versions: VersionStats[];
  // The current version's rounds per slider setting, in slider order; settings nobody played are left out
  settings: PopularityStats[];
};
