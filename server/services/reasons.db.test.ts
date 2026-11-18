import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import type { ItunesClient } from "../itunes/client";
import type { LastfmClient } from "../lastfm/client";
import type { ReasonEntry, ReasonsInput } from "../utils/reasons-prompt";
import { streamReasons, type ReasonsEvent, type ReasonsWriter } from "./reasons";

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

// A writer that records what it was asked and streams "Like <seed>, but different." for each
// record. failAfter: throw after that many entries. hang: hand out nothing until the signal aborts.
// skip: leave those artists out, as the model may
function fakeWriter({ failAfter, hang = false, skip = [] as string[] }: { failAfter?: number; hang?: boolean; skip?: string[] } = {}) {
  const calls: ReasonsInput[] = [];
  const writer: ReasonsWriter = {
    async *stream(input, { signal } = {}) {
      calls.push(input);
      if (hang) {
        await new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new Error("aborted"))));
      }
      let sent = 0;
      for (const r of input.records) {
        if (failAfter !== undefined && sent === failAfter) throw new Error("API unavailable");
        if (skip.includes(r.artist)) continue;
        const entry: ReasonEntry = { artist: r.artist, reason: `Like ${r.sources[0]}, but different.` };
        yield entry;
        sent++;
      }
    },
  };
  return { writer, calls };
}

const deps = (writer: ReasonsWriter | null, { dailyLimit, timeoutMs }: { dailyLimit?: number; timeoutMs?: number } = {}) => ({
  db,
  lastfm,
  itunes,
  now,
  writer,
  dailyLimit,
  timeoutMs,
});

// Everything the page would receive, in order
async function collect(d: ReturnType<typeof deps>, query: Parameters<typeof streamReasons>[1]) {
  const events: ReasonsEvent[] = [];
  await streamReasons(d, query, (event) => events.push(event));
  return events;
}
const reasonsIn = (events: ReasonsEvent[]) =>
  Object.fromEntries(events.flatMap((e) => (e.type === "reason" ? [[e.artist, e.reason]] : [])));
const ending = (events: ReasonsEvent[]) => events.at(-1);

beforeEach(async () => {
  await db.execute(sql`truncate artists, tracks, reason_cache, rate_limits restart identity cascade`);
});

describe("streamReasons", () => {
  it("sends each record's reason as it is written, then says it's done", async () => {
    const { writer, calls } = fakeWriter();

    const events = await collect(deps(writer), { seeds: ["Tame Impala"] });

    expect(events).toEqual([
      { type: "reason", artist: "Pond", reason: "Like Tame Impala, but different." },
      { type: "reason", artist: "MGMT", reason: "Like Tame Impala, but different." },
      { type: "reason", artist: "Khruangbin", reason: "Like Tame Impala, but different." },
      { type: "done" },
    ]);
    expect(calls).toHaveLength(1);
  });

  it("gives the model the seeds' tags and where each record came from", async () => {
    const { writer, calls } = fakeWriter();

    await collect(deps(writer), { seeds: ["Tame Impala", "Kokoroko"] });

    expect(calls[0]!.seeds).toEqual([
      { name: "Tame Impala", tags: ["psychedelic rock"] },
      { name: "Kokoroko", tags: ["afrobeat", "jazz"] },
    ]);
    expect(calls[0]!.records.find((r) => r.artist === "Khruangbin")?.sources).toEqual(["Tame Impala", "Kokoroko"]);
  });

  // The record on screen gets its reason first
  it("asks about the record the visitor is looking at first", async () => {
    const { writer, calls } = fakeWriter();

    const events = await collect(deps(writer), { seeds: ["Tame Impala"], first: "khruangbin" });

    expect(calls[0]!.records.map((r) => r.artist)).toEqual(["Khruangbin", "Pond", "MGMT"]);
    expect(events[0]).toMatchObject({ type: "reason", artist: "Khruangbin" });
  });

  it("answers from the cache for the same seeds in any order, without asking the model", async () => {
    const { writer, calls } = fakeWriter();
    await collect(deps(writer), { seeds: ["Tame Impala", "Kokoroko"] });

    const again = await collect(deps(writer), { seeds: ["kokoroko", "Tame Impala"] });

    expect(calls).toHaveLength(1);
    expect(Object.keys(reasonsIn(again))).toHaveLength(4);
    expect(ending(again)).toEqual({ type: "done" });
  });

  it("sends cached reasons first and asks only about the rest", async () => {
    const { writer, calls } = fakeWriter();
    await collect(deps(writer), { seeds: ["Tame Impala"], exclude: ["MGMT"] });

    const events = await collect(deps(writer), { seeds: ["Tame Impala"] });

    expect(calls.map((c) => c.records.map((r) => r.artist))).toEqual([["Pond", "Khruangbin"], ["MGMT"]]);
    expect(events.map((e) => (e.type === "reason" ? e.artist : e.type))).toEqual(["Pond", "Khruangbin", "MGMT", "done"]);
  });

  // Saved as null too, so we don't pay to ask about them again
  it("sends no reason for records the model skipped, and doesn't ask about them again", async () => {
    const { writer } = fakeWriter({ skip: ["MGMT"] });
    const events = await collect(deps(writer), { seeds: ["Tame Impala"] });
    expect(reasonsIn(events).MGMT).toBeNull();

    const next = fakeWriter();
    await collect(deps(next.writer), { seeds: ["Tame Impala"] });
    expect(next.calls).toHaveLength(0);
  });

  it("ignores reasons for artists it didn't ask about", async () => {
    const writer: ReasonsWriter = {
      async *stream() {
        yield { artist: "Someone Else", reason: "Great band." };
      },
    };

    const events = await collect(deps(writer), { seeds: ["Tame Impala"] });

    expect(Object.keys(reasonsIn(events)).sort()).toEqual(["Khruangbin", "MGMT", "Pond"]);
  });

  it("says reasons are off without an API key", async () => {
    expect(await collect(deps(null), { seeds: ["Tame Impala"] })).toEqual([{ type: "stopped", why: "off" }]);
  });

  it("stops asking the model once the day's calls are used up, and says so", async () => {
    const { writer, calls } = fakeWriter();
    await collect(deps(writer, { dailyLimit: 1 }), { seeds: ["Tame Impala"] });

    const events = await collect(deps(writer, { dailyLimit: 1 }), { seeds: ["Kokoroko"] });

    expect(calls).toHaveLength(1);
    expect(events).toEqual([
      // Khruangbin was written for Tame Impala alone, a different seed set, so it isn't reused
      { type: "stopped", why: "limit" },
    ]);
  });

  // Reasons written before the failure are kept, so a retry asks only about the rest
  it("keeps what was written when the model fails partway, and asks only about the rest next time", async () => {
    const events = await collect(deps(fakeWriter({ failAfter: 1 }).writer), { seeds: ["Tame Impala"] });
    expect(events).toEqual([
      { type: "reason", artist: "Pond", reason: "Like Tame Impala, but different." },
      { type: "stopped", why: "failed" },
    ]);

    const { writer, calls } = fakeWriter();
    const retry = await collect(deps(writer), { seeds: ["Tame Impala"] });

    expect(calls.map((c) => c.records.map((r) => r.artist))).toEqual([["MGMT", "Khruangbin"]]);
    expect(Object.keys(reasonsIn(retry))).toHaveLength(3);
  });

  it("gives up and says it took too long when the model doesn't answer in time", async () => {
    const { writer } = fakeWriter({ hang: true });

    const events = await collect(deps(writer, { timeoutMs: 20 }), { seeds: ["Tame Impala"] });

    expect(events).toEqual([{ type: "stopped", why: "timeout" }]);
  });

  // The visitor left: nobody is listening, so stop paying for tokens and send nothing more
  it("stops quietly when the visitor goes away", async () => {
    const { writer } = fakeWriter({ hang: true });
    const left = new AbortController();
    const events: ReasonsEvent[] = [];

    const run = streamReasons(deps(writer), { seeds: ["Tame Impala"] }, (event) => events.push(event), left.signal);
    setTimeout(() => left.abort(), 10);
    await run;

    expect(events).toEqual([]);
  });
});
