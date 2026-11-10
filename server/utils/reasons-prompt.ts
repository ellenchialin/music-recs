import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";

// The prompt for LLM-written recommendation reasons, and the checks on what comes back.
// Bump REASONS_PROMPT_VERSION whenever the prompt changes: it's part of the cache key, so old
// reasons are ignored rather than mixed with new ones
export const REASONS_PROMPT_VERSION = "2";

// The reason replaces the one-line "Similar to …" under the record. The prompt asks for
// TARGET_REASON_LENGTH so it fits one line; anything over MAX_REASON_LENGTH is dropped
export const TARGET_REASON_LENGTH = 60;
export const MAX_REASON_LENGTH = 80;

export type ReasonsInput = {
  seeds: { name: string; tags: string[] }[];
  records: { artist: string; sources: string[]; track: string | null }[];
};

export type ReasonsOutput = { reasons: { artist: string; reason: string | null }[] };

const SYSTEM = `You write one-line reasons for music recommendations. A listener picked some artists they like, and the site recommended other artists based on Last.fm's similar-artist data.

For each recommended artist, say why this listener might like it in ${TARGET_REASON_LENGTH} characters or fewer. Describe the music: its sound, genre, mood, texture or energy, and how it relates to what the listener likes. Be specific and plain, like a friend at a record shop.

Describe the sound, not the biography. Don't state hometowns, countries, instruments, labels, band members, collaborations, awards, quotes, chart history or dates unless they appear in the input. If you don't know an artist's music well enough to describe it, give null for it.

Don't name the recommended artist, don't start with "If you like", and don't use emojis or quotation marks. Write in English.`;

const listFormat = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

export function buildReasonsPrompt({ seeds, records }: ReasonsInput): { system: string; user: string } {
  const seedLines = seeds.map((s) => `- ${s.name}${s.tags.length ? ` (${s.tags.join(", ")})` : ""}`);
  const recordLines = records.map(
    (r) => `- ${r.artist}, similar to ${listFormat.format(r.sources)}${r.track ? `, track "${r.track}"` : ""}`,
  );
  const user = ["The listener likes:", ...seedLines, "", "Recommended artists:", ...recordLines].join("\n");
  return { system: SYSTEM, user };
}

// One entry per requested artist, keyed by normalized name: the reason, or null when the model
// gave none, gave an unusable one, or skipped the artist. Artists nobody asked about are ignored
export function pickReasons(output: ReasonsOutput, artists: string[]): Map<string, string | null> {
  const given = new Map(output.reasons.map((r) => [normalizeArtistName(r.artist), r.reason?.trim() ?? null]));
  return new Map(
    artists.map((artist) => {
      const key = normalizeArtistName(artist);
      const reason = given.get(key);
      const usable = reason && reason.length <= MAX_REASON_LENGTH && !reason.includes("\n");
      return [key, usable ? reason : null];
    }),
  );
}

// Seeds in any order or spelling share reasons
export function seedKey(seeds: string[]): string {
  return JSON.stringify([...new Set(seeds.map(normalizeArtistName))].sort());
}
