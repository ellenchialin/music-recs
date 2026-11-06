import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "./client";
import { artistSimilar, artists, tracks, visitors } from "./schema";

const db = getDb();

// Drizzle wraps the Postgres error in `cause`. SQLSTATE 23505 = unique, 23514 = check
function pgCode(err: unknown): string | undefined {
  const cause = (err as { cause?: { code?: string } }).cause;
  return cause?.code;
}

beforeEach(async () => {
  await db.execute(sql`truncate artists, tracks, visitors restart identity cascade`);
});

describe("visitors", () => {
  it("only needs an id; created_at is filled by the database", async () => {
    const id = randomUUID();
    const [row] = await db.insert(visitors).values({ id }).returning();
    expect(row?.id).toBe(id);
    expect(row?.createdAt).toBeInstanceOf(Date);
  });
});

describe("artists", () => {
  it("fills fetched_at so the 30-day cache can expire", async () => {
    const [row] = await db.insert(artists).values({ name: "Radiohead", nameNorm: "radiohead" }).returning();
    expect(row?.fetchedAt).toBeInstanceOf(Date);
    expect(row?.tags).toEqual([]);
  });

  it("rejects the same artist written differently", async () => {
    await db.insert(artists).values({ name: "Radiohead", nameNorm: "radiohead" });
    const err = await db
      .insert(artists)
      .values({ name: "radiohead ", nameNorm: "radiohead" })
      .catch((e: unknown) => e);
    expect(pgCode(err)).toBe("23505");
  });

  it("rejects negative listener counts", async () => {
    const err = await db
      .insert(artists)
      .values({ name: "Nobody", nameNorm: "nobody", listeners: -1 })
      .catch((e: unknown) => e);
    expect(pgCode(err)).toBe("23514");
  });
});

describe("artist_similar", () => {
  async function radiohead() {
    const [row] = await db.insert(artists).values({ name: "Radiohead", nameNorm: "radiohead" }).returning();
    return row!.id;
  }

  it("starts with similar_fetched_at empty", async () => {
    const [row] = await db.insert(artists).values({ name: "Radiohead", nameNorm: "radiohead" }).returning();
    expect(row?.similarFetchedAt).toBeNull();
  });

  it("stores each similar artist once per source artist", async () => {
    const artistId = await radiohead();
    await db.insert(artistSimilar).values({ artistId, name: "Thom Yorke", nameNorm: "thom yorke", match: 1 });
    const err = await db
      .insert(artistSimilar)
      .values({ artistId, name: "thom yorke", nameNorm: "thom yorke", match: 0.5 })
      .catch((e: unknown) => e);
    expect(pgCode(err)).toBe("23505");
  });

  it("rejects a match outside 0 to 1", async () => {
    const artistId = await radiohead();
    const err = await db
      .insert(artistSimilar)
      .values({ artistId, name: "Thom Yorke", nameNorm: "thom yorke", match: 1.5 })
      .catch((e: unknown) => e);
    expect(pgCode(err)).toBe("23514");
  });

  it("is deleted with its artist", async () => {
    const artistId = await radiohead();
    await db.insert(artistSimilar).values({ artistId, name: "Thom Yorke", nameNorm: "thom yorke", match: 1 });
    await db.delete(artists);
    expect(await db.select().from(artistSimilar)).toEqual([]);
  });
});

describe("tracks", () => {
  it("stores one track per artist", async () => {
    await db.insert(tracks).values({ artistName: "Radiohead", artistNameNorm: "radiohead", title: "Creep" });
    const err = await db
      .insert(tracks)
      .values({ artistName: "radiohead", artistNameNorm: "radiohead", title: "Karma Police" })
      .catch((e: unknown) => e);
    expect(pgCode(err)).toBe("23505");
  });

  it("allows a track with no iTunes match", async () => {
    const [row] = await db
      .insert(tracks)
      .values({ artistName: "Utada", artistNameNorm: "utada", title: "Simple And Clean" })
      .returning();
    expect(row).toMatchObject({ itunesId: null, previewUrl: null, artworkUrl: null });
    expect(row?.fetchedAt).toBeInstanceOf(Date);
  });

  // iTunes trackIds are close to the int limit (2,147,483,647)
  it("stores iTunes ids beyond the int range", async () => {
    const [row] = await db
      .insert(tracks)
      .values({ artistName: "Radiohead", artistNameNorm: "radiohead", title: "Creep", itunesId: 3_000_000_000 })
      .returning();
    expect(row?.itunesId).toBe(3_000_000_000);
  });
});
