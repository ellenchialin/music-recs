import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import type { ItunesClient } from "../itunes/client";
import type { LastfmClient } from "../lastfm/client";
import type { ReasonsInput, ReasonsOutput } from "../utils/reasons-prompt";
import { getReasons, type ReasonsWriter } from "./reasons";

const db = getDb();
const now = new Date("2026-11-10T12:00:00Z");

// Tame Impala → Pond, MGMT, Khruangbin; Kokoroko → Ezra Collective, Khruangbin
const similar: Record<string, [string, number][]> = {
  "Tame Impala": [["Pond", 0.9], ["MGMT", 0.6], ["Khruangbin", 0.5]],
  Kokoroko: [["Ezra Collective", 0.8], ["Khruangbin", 0.4]],
};
const tags: Record<string, string[]> = { "Tame Impala": ["psychedelic rock"], Kokoroko: ["afrobeat", "jazz"] };
const lastfm: Pick<LastfmClient, "getInfo" | "getSimilar" | "getTopTracks" | "searchArtists"> = {
  getInfo: async (name) => ({ name, mbid: null, listeners: 1000, tags: tags[name] ?? [] }),
  getSimilar: async (name) => (similar[name] ?? []).map(([n, match]) => ({ name: n, mbid: null, match })),
  getTopTracks: async () => [],
  searchArtists: async () => [],
};
const itunes: Pick<ItunesClient, "searchTracks"> = { searchTracks: async () => [] };

// A writer that records what it was asked and answers "<artist> fits." (or fails)
function fakeWriter({ fail = false }: { fail?: boolean } = {}) {
  const calls: ReasonsInput[] = [];
  const writer: ReasonsWriter = {
    write: async (input): Promise<ReasonsOutput> => {
      calls.push(input);
      if (fail) throw new Error("API unavailable");
      return { reasons: input.records.map((r) => ({ artist: r.artist, reason: `Like ${r.sources[0]}, but different.` })) };
    },
  };
  return { writer, calls };
}

const deps = (writer: ReasonsWriter | null, dailyLimit?: number) => ({ db, lastfm, itunes, now, writer, dailyLimit });

beforeEach(async () => {
  await db.execute(sql`truncate artists, tracks, reason_cache, rate_limits restart identity cascade`);
});

describe("getReasons", () => {
  it("writes a reason for every record in one call", async () => {
    const { writer, calls } = fakeWriter();

    const reasons = await getReasons(deps(writer), { seeds: ["Tame Impala"] });

    expect(reasons).toEqual({
      Pond: "Like Tame Impala, but different.",
      MGMT: "Like Tame Impala, but different.",
      Khruangbin: "Like Tame Impala, but different.",
    });
    expect(calls).toHaveLength(1);
  });

  it("gives the model the seeds' tags and where each record came from", async () => {
    const { writer, calls } = fakeWriter();

    await getReasons(deps(writer), { seeds: ["Tame Impala", "Kokoroko"] });

    expect(calls[0]!.seeds).toEqual([
      { name: "Tame Impala", tags: ["psychedelic rock"] },
      { name: "Kokoroko", tags: ["afrobeat", "jazz"] },
    ]);
    expect(calls[0]!.records.find((r) => r.artist === "Khruangbin")?.sources).toEqual(["Tame Impala", "Kokoroko"]);
  });

  it("answers from the cache for the same seeds in any order", async () => {
    const { writer, calls } = fakeWriter();
    await getReasons(deps(writer), { seeds: ["Tame Impala", "Kokoroko"] });

    const again = await getReasons(deps(writer), { seeds: ["kokoroko", "Tame Impala"] });

    expect(calls).toHaveLength(1);
    expect(Object.keys(again)).toHaveLength(4);
  });

  it("asks only about records it has no reason for yet", async () => {
    const { writer, calls } = fakeWriter();
    await getReasons(deps(writer), { seeds: ["Tame Impala"], exclude: ["MGMT"] });

    await getReasons(deps(writer), { seeds: ["Tame Impala"] });

    expect(calls.map((c) => c.records.map((r) => r.artist))).toEqual([["Pond", "Khruangbin"], ["MGMT"]]);
  });

  it("returns no reasons without an API key", async () => {
    expect(await getReasons(deps(null), { seeds: ["Tame Impala"] })).toEqual({ Pond: null, MGMT: null, Khruangbin: null });
  });

  it("stops asking the model once the day's calls are used up", async () => {
    const { writer, calls } = fakeWriter();
    await getReasons(deps(writer, 1), { seeds: ["Tame Impala"] });

    const reasons = await getReasons(deps(writer, 1), { seeds: ["Kokoroko"] });

    expect(calls).toHaveLength(1);
    expect(reasons).toEqual({ "Ezra Collective": null, Khruangbin: null });
  });

  // Not cached, so the next visit tries again
  it("returns no reasons when the model fails, and asks again next time", async () => {
    await getReasons(deps(fakeWriter({ fail: true }).writer), { seeds: ["Tame Impala"] });
    const { writer, calls } = fakeWriter();

    const reasons = await getReasons(deps(writer), { seeds: ["Tame Impala"] });

    expect(calls).toHaveLength(1);
    expect(reasons.Pond).toBe("Like Tame Impala, but different.");
  });
});
