import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";

export type Song = { artist: string; title: string; previewUrl: string };
export type RoundSong = Song & { isRecommended: boolean };

// Last.fm tags are user-entered; these describe the listener, not the music
const NOT_GENRES = new Set(["seenlive", "favorites", "favourites", "favorite", "favourite", "albumsiown", "spotify"]);
const tagKey = (tag: string) => tag.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// The genre the control songs come from: the tag shared by the most seeds, counting spellings
// like "j-pop" and "JPop" as one. Ties go to the first seed's order
export function pickTopTag(seedTags: string[][]): string | null {
  const counts = new Map<string, { tag: string; seeds: number }>();
  for (const tags of seedTags) {
    for (const key of new Set(tags.map(tagKey))) {
      if (!key || NOT_GENRES.has(key)) continue;
      const first = tags.find((t) => tagKey(t) === key)!;
      const entry = counts.get(key) ?? { tag: first, seeds: 0 };
      entry.seeds++;
      counts.set(key, entry);
    }
  }
  let best: { tag: string; seeds: number } | null = null;
  for (const entry of counts.values()) if (!best || entry.seeds > best.seeds) best = entry;
  return best?.tag ?? null;
}

function takeRandom<T>(items: T[], count: number, random: () => number): T[] {
  const pool = [...items];
  const taken: T[] = [];
  while (taken.length < count && pool.length) taken.push(pool.splice(Math.floor(random() * pool.length), 1)[0]!);
  return taken;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

// Three songs, one or two of them recommended, in random order. Randomness is passed in for tests.
// null when there aren't enough songs with previews
export function pickRound({
  recommended,
  control,
  random,
}: {
  recommended: Song[];
  control: Song[];
  random: () => number;
}): RoundSong[] | null {
  const wanted = random() < 0.5 ? 1 : 2;
  const fromRecommended = takeRandom(recommended, Math.min(wanted, recommended.length), random);
  const taken = new Set(fromRecommended.map((s) => normalizeArtistName(s.artist)));
  const fromControl = takeRandom(
    control.filter((s) => !taken.has(normalizeArtistName(s.artist))),
    3 - fromRecommended.length,
    random,
  );
  if (fromRecommended.length === 0 || fromRecommended.length + fromControl.length < 3) return null;
  return shuffle(
    [...fromRecommended.map((s) => ({ ...s, isRecommended: true })), ...fromControl.map((s) => ({ ...s, isRecommended: false }))],
    random,
  );
}

export type RatedItem = { visitorId: string; algoVersion: string; isRecommended: boolean; rating: number };

export type VersionStats = {
  algoVersion: string;
  visitors: number;
  ratings: number;
  recommendedMean: number;
  controlMean: number;
  // Mean over visitors of (their recommended average − their control average)
  difference: number;
  // 95% confidence interval for `difference`; null with fewer than two visitors
  ci: [number, number] | null;
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Two-sided 95% Student's t critical values for 1–30 degrees of freedom; beyond that ≈ 1.96
const T_95 = [
  12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11,
  2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042,
];

function confidenceInterval(values: number[]): [number, number] | null {
  if (values.length < 2) return null;
  const m = mean(values);
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
  const t = T_95[values.length - 2] ?? 1.96;
  const half = (t * sd) / Math.sqrt(values.length);
  return [m - half, m + half];
}

// Each visitor counts once: average their own ratings per kind first, so one heavy player
// can't outweigh everyone. Visitors who rated only one kind are left out
export function computeStats(items: RatedItem[]): VersionStats[] {
  const byVersion = new Map<string, Map<string, RatedItem[]>>();
  for (const item of items) {
    const visitors = byVersion.get(item.algoVersion) ?? new Map<string, RatedItem[]>();
    visitors.set(item.visitorId, [...(visitors.get(item.visitorId) ?? []), item]);
    byVersion.set(item.algoVersion, visitors);
  }

  return [...byVersion.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([algoVersion, visitors]) => {
      const included = [...visitors.values()].filter((v) => v.some((i) => i.isRecommended) && v.some((i) => !i.isRecommended));
      if (included.length === 0) return [];
      const ratings = included.flat();
      const ratingsOf = (rec: boolean, list: RatedItem[]) => list.filter((i) => i.isRecommended === rec).map((i) => i.rating);
      const differences = included.map((v) => mean(ratingsOf(true, v)) - mean(ratingsOf(false, v)));
      return [
        {
          algoVersion,
          visitors: included.length,
          ratings: ratings.length,
          recommendedMean: mean(ratingsOf(true, ratings)),
          controlMean: mean(ratingsOf(false, ratings)),
          difference: mean(differences),
          ci: confidenceInterval(differences),
        },
      ];
    });
}
