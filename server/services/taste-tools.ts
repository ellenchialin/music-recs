import { z } from "zod";
import { getArtist, getSimilarArtists } from "../cache/lastfm";
import { getTagChart } from "../cache/tag-charts";
import type { Db } from "../db/client";
import { LastfmError, type LastfmClient } from "../lastfm/client";
import { searchArtistSuggestions } from "./artist-search";

// Runs one of the taste agent's lookups. Everything goes through the same caches and Last.fm
// budget as the rest of the site. Each answer has three parts: what the model reads, a short
// summary for the page, and the artist names the model may now suggest

type Deps = {
  db: Db;
  lastfm: Pick<LastfmClient, "getInfo" | "getSimilar" | "searchArtists" | "getTagTopArtists">;
  now: Date;
};

export type ToolOutcome = { result: unknown; summary: string; names: string[] };

// Enough to choose from without filling the model's context
const LIST_LIMIT = 20;
const TAGS_SHOWN = 6;

const nameInput = z.object({ name: z.string().trim().min(1).max(200) });
const compact = new Intl.NumberFormat("en", { notation: "compact" });
const found = (n: number) => (n ? `${n} found` : "None found");

export async function runTasteTool(deps: Deps, tool: string, input: unknown): Promise<ToolOutcome> {
  switch (tool) {
    case "search_artists": {
      const { query } = z.object({ query: z.string().trim().min(1).max(200) }).parse(input);
      const results = await searchArtistSuggestions((q, limit) => deps.lastfm.searchArtists(q, { limit }), query);
      return {
        result: { artists: results.map((r) => ({ name: r.name, listeners: r.listeners })) },
        summary: found(results.length),
        names: results.map((r) => r.name),
      };
    }
    case "get_artist": {
      const { name } = nameInput.parse(input);
      const artist = await findArtist(deps, name);
      if (!artist) return notFound(name);
      const tags = artist.tags.slice(0, TAGS_SHOWN);
      const listeners = artist.listeners === null ? "" : ` · ${compact.format(artist.listeners)} listeners`;
      return {
        result: { name: artist.name, listeners: artist.listeners, tags },
        summary: `${tags.slice(0, 3).join(", ") || "No tags"}${listeners}`,
        names: [artist.name],
      };
    }
    case "get_similar_artists": {
      const { name } = nameInput.parse(input);
      const artist = await findArtist(deps, name);
      if (!artist) return notFound(name);
      const similar = (await getSimilarArtists(deps, artist)).slice(0, LIST_LIMIT).map((a) => a.name);
      return { result: { artist: artist.name, similar }, summary: found(similar.length), names: [artist.name, ...similar] };
    }
    case "get_top_artists_for_tag": {
      const { tag } = z.object({ tag: z.string().trim().min(1).max(100) }).parse(input);
      const artists = (await getTagChart(deps, tag)).slice(0, LIST_LIMIT);
      return { result: { tag, artists }, summary: found(artists.length), names: artists };
    }
    default:
      throw new Error(`Unknown tool: ${tool}`);
  }
}

// null when Last.fm doesn't know the name; other errors (Last.fm down) fail the step
async function findArtist(deps: Deps, name: string) {
  try {
    return await getArtist(deps, name);
  } catch (err) {
    if (err instanceof LastfmError && err.code === 6) return null;
    throw err;
  }
}

const notFound = (name: string): ToolOutcome => ({
  result: { error: `No artist called ${name} on Last.fm` },
  summary: "Not found",
  names: [],
});
