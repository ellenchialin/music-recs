import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../db/client";
import { artistSimilar, artists } from "../db/schema";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";
import { searchKnownArtists } from "./known-artists";

const db = getDb();

// Seeds people looked up (with listener counts), and the similar-artist lists they brought in
async function seed() {
  const rows = await db
    .insert(artists)
    .values(
      ["Tame Impala", "Kokoroko", "Radish"].map((name, i) => ({
        name,
        nameNorm: normalizeArtistName(name),
        listeners: [3_000_000, 200_000, 50_000][i]!,
      })),
    )
    .returning({ id: artists.id, name: artists.name });
  const id = (name: string) => rows.find((r) => r.name === name)!.id;
  const similar = (artist: string, names: string[]) =>
    names.map((name) => ({ artistId: id(artist), name, nameNorm: normalizeArtistName(name), match: 0.5 }));
  await db.insert(artistSimilar).values([
    ...similar("Tame Impala", ["Radiohead", "Pond", "Radio Dept.", "MGMT"]),
    ...similar("Kokoroko", ["Radiohead", "Ezra Collective", "100% Leather"]),
    ...similar("Radish", ["Radiohead"]),
  ]);
}

beforeEach(async () => {
  await db.execute(sql`truncate artists, artist_similar restart identity cascade`);
  await seed();
});

const names = async (typed: string) => (await searchKnownArtists(db, typed)).map((s) => s.name);

describe("searchKnownArtists", () => {
  it("finds names that start with what's typed, most often recommended first", async () => {
    expect(await names("radi")).toEqual(["Radiohead", "Radish", "Radio Dept."]);
  });

  it("matches the start of a later word, not the middle of one", async () => {
    expect(await names("collect")).toEqual(["Ezra Collective"]);
    expect(await names("head")).toEqual([]);
  });

  it("gives listener counts for artists people looked up, and null for the rest", async () => {
    const found = await searchKnownArtists(db, "ta");
    expect(found).toEqual([{ name: "Tame Impala", listeners: 3_000_000 }]);
    expect((await searchKnownArtists(db, "pon"))[0]).toEqual({ name: "Pond", listeners: null });
  });

  it("treats % and _ as plain characters", async () => {
    expect(await names("100%")).toEqual(["100% Leather"]);
    expect(await names("_")).toEqual([]);
  });

  it("needs at least two characters", async () => {
    expect(await names("r")).toEqual([]);
  });
});
