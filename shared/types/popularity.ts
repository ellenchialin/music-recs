// The mainstream ↔ obscure slider's three stops. "balanced" is the plain similarity ranking
export const POPULARITY_SETTINGS = ["obscure", "balanced", "mainstream"] as const;
export type Popularity = (typeof POPULARITY_SETTINGS)[number];
export const DEFAULT_POPULARITY: Popularity = "balanced";
