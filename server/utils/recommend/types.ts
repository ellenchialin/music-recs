// Plain data for the algorithm. It never touches the database or APIs; the caller loads and maps the cache

export type SeedSimilarity = {
  seed: string;
  // Used to exclude the seed when it appears under another name
  seedMbid: string | null;
  // 1 for seeds the user picked
  weight: number;
  similar: SimilarArtistInput[];
};

export type SimilarArtistInput = {
  name: string;
  nameNorm: string;
  mbid: string | null;
  // Last.fm similarity, 0–1
  match: number;
};

export type Candidate = {
  name: string;
  nameNorm: string;
  mbid: string | null;
  // Sum of rank scores across seeds (see merge-candidates.ts)
  score: number;
  // Seeds this artist came from, in seed order
  sources: string[];
};

// Artists to leave out: the seeds and, when exploring, artists already shown
export type ExcludedArtist = {
  nameNorm: string;
  mbid: string | null;
};
