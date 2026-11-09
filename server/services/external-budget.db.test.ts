import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { ItunesError, type ItunesClient } from "../itunes/client";
import { LastfmError, type LastfmClient } from "../lastfm/client";
import { withItunesBudget, withLastfmBudget } from "./external-budget";

const db = getDb();
const at = (iso: string) => new Date(`2026-11-09T${iso}Z`);

beforeEach(async () => {
  await db.execute(sql`truncate rate_limits`);
});

function fakeItunes(fail?: ItunesError) {
  const calls: string[] = [];
  const client: Pick<ItunesClient, "searchTracks"> = {
    searchTracks: async (term) => {
      calls.push(term);
      if (fail) throw fail;
      return [];
    },
  };
  return { client, calls };
}

// A site-wide cap, so no number of visitors can push us past iTunes' or Last.fm's limits
describe("withItunesBudget", () => {
  it("passes calls through until the site-wide budget is used up", async () => {
    let now = at("12:00:10");
    const { client, calls } = fakeItunes();
    const budgeted = withItunesBudget(client, { db, now: () => now, limit: 2 });

    await budgeted.searchTracks("a");
    await budgeted.searchTracks("b");
    await expect(budgeted.searchTracks("c")).rejects.toBeInstanceOf(ItunesError);
    expect(calls).toEqual(["a", "b"]);

    now = at("12:01:00");
    await budgeted.searchTracks("d");
    expect(calls).toEqual(["a", "b", "d"]);
  });

  // iTunes answering 403/429 means it's throttling us; keep away for a while instead of making it worse
  it("stops calling iTunes for five minutes after it throttles us", async () => {
    let now = at("12:00:10");
    const throttled = fakeItunes(new ItunesError("search: HTTP 403", 403));
    await expect(withItunesBudget(throttled.client, { db, now: () => now }).searchTracks("a")).rejects.toThrow();

    const { client, calls } = fakeItunes();
    const budgeted = withItunesBudget(client, { db, now: () => now });
    now = at("12:04:59");
    await expect(budgeted.searchTracks("b")).rejects.toBeInstanceOf(ItunesError);
    expect(calls).toEqual([]);

    now = at("12:05:11");
    await budgeted.searchTracks("c");
    expect(calls).toEqual(["c"]);
  });

  it("does not pause for other errors", async () => {
    const now = at("12:00:10");
    const broken = fakeItunes(new ItunesError("search: HTTP 500", 500));
    await expect(withItunesBudget(broken.client, { db, now: () => now }).searchTracks("a")).rejects.toThrow();

    const { client, calls } = fakeItunes();
    await withItunesBudget(client, { db, now: () => now }).searchTracks("b");
    expect(calls).toEqual(["b"]);
  });
});

describe("withLastfmBudget", () => {
  it("rejects with a LastfmError once the budget is used up", async () => {
    const now = at("12:00:10");
    let calls = 0;
    const client = {
      getInfo: async () => {
        calls++;
        return { name: "Pond", mbid: null, listeners: 1, tags: [] };
      },
    } as unknown as LastfmClient;
    const budgeted = withLastfmBudget(client, { db, now: () => now, limit: 1 });

    await budgeted.getInfo("Pond");
    await expect(budgeted.getInfo("Pond")).rejects.toBeInstanceOf(LastfmError);
    expect(calls).toBe(1);
  });
});
