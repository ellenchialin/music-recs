import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { LastfmError, type LastfmClient } from "../lastfm/client";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import { runTasteTool } from "./taste-tools";

const db = getDb();
const now = new Date("2026-11-18T12:00:00Z");

// Tame Impala with tags and three similar artists; a "jazz" chart; search finds Tame Impala.
// Counts calls, to show lookups go through the cache
const calls = { getInfo: 0, getSimilar: 0 };
const lastfm: Pick<LastfmClient, "getInfo" | "getSimilar" | "searchArtists" | "getTagTopArtists"> = {
  getInfo: async (name) => {
    calls.getInfo++;
    if (normalizeArtistName(name) !== "tame impala") throw new LastfmError("The artist you supplied could not be found", 200, 6);
    return { name: "Tame Impala", mbid: null, listeners: 8_500_000, tags: ["psychedelic", "dreamy", "indie", "rock", "australian", "pop", "synth"] };
  },
  getSimilar: async () => {
    calls.getSimilar++;
    return [
      { name: "Pond", mbid: null, match: 1 },
      { name: "MGMT", mbid: null, match: 0.8 },
      { name: "GUM", mbid: null, match: 0.6 },
    ];
  },
  searchArtists: async (q) => (q.toLowerCase().includes("tame") ? [{ name: "Tame Impala", mbid: null, listeners: 8_500_000 }] : []),
  getTagTopArtists: async () => [
    { name: "Kamasi Washington", mbid: null },
    { name: "Nubya Garcia", mbid: null },
  ],
};
const deps = { db, lastfm, now };

beforeEach(async () => {
  await db.execute(sql`truncate artists, tag_charts restart identity cascade`);
  calls.getInfo = 0;
  calls.getSimilar = 0;
});

describe("runTasteTool", () => {
  it("searches artists by name", async () => {
    const out = await runTasteTool(deps, "search_artists", { query: "tame imp" });

    expect(out.result).toEqual({ artists: [{ name: "Tame Impala", listeners: 8_500_000 }] });
    expect(out.summary).toBe("1 found");
    expect(out.names).toEqual(["Tame Impala"]);
  });

  it("looks up an artist's tags and listeners, through the cache", async () => {
    const out = await runTasteTool(deps, "get_artist", { name: "tame impala" });
    await runTasteTool(deps, "get_artist", { name: "Tame Impala" });

    expect(out.result).toEqual({ name: "Tame Impala", listeners: 8_500_000, tags: ["psychedelic", "dreamy", "indie", "rock", "australian", "pop"] });
    expect(out.summary).toBe("psychedelic, dreamy, indie · 8.5M listeners");
    expect(out.names).toEqual(["Tame Impala"]);
    expect(calls.getInfo).toBe(1);
  });

  // A wrong name is an answer the model can act on, not a failed step
  it("says when Last.fm doesn't know an artist", async () => {
    const out = await runTasteTool(deps, "get_artist", { name: "Nobody Here" });

    expect(out.result).toEqual({ error: "No artist called Nobody Here on Last.fm" });
    expect(out.summary).toBe("Not found");
    expect(out.names).toEqual([]);
  });

  it("finds similar artists, most similar first", async () => {
    const out = await runTasteTool(deps, "get_similar_artists", { name: "Tame Impala" });

    expect(out.result).toEqual({ artist: "Tame Impala", similar: ["Pond", "MGMT", "GUM"] });
    expect(out.summary).toBe("3 found");
    expect(out.names).toEqual(["Tame Impala", "Pond", "MGMT", "GUM"]);
  });

  it("finds a tag's top artists", async () => {
    const out = await runTasteTool(deps, "get_top_artists_for_tag", { tag: "jazz" });

    expect(out.result).toEqual({ tag: "jazz", artists: ["Kamasi Washington", "Nubya Garcia"] });
    expect(out.summary).toBe("2 found");
    expect(out.names).toEqual(["Kamasi Washington", "Nubya Garcia"]);
  });

  it("refuses a tool it doesn't have, or input without what it needs", async () => {
    await expect(runTasteTool(deps, "delete_everything", {})).rejects.toThrow(/Unknown tool/);
    await expect(runTasteTool(deps, "get_artist", {})).rejects.toThrow();
  });
});
