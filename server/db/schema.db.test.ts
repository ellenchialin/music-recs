import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "./client";
import { artists, visitors } from "./schema";

const db = getDb();

// drizzle 把 Postgres 的錯誤包在 cause 裡；SQLSTATE 23505 = 違反 unique，23514 = 違反 check
function pgCode(err: unknown): string | undefined {
  const cause = (err as { cause?: { code?: string } }).cause;
  return cause?.code;
}

beforeEach(async () => {
  await db.execute(sql`truncate artists, visitors restart identity cascade`);
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
