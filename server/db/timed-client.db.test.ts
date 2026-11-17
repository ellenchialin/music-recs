import { sql as rawSql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { parseDbEnv } from "../utils/env";
import { visitors } from "./schema";
import { timeQueries } from "./timed-client";

const client = postgres(parseDbEnv().DATABASE_URL, { max: 1, prepare: false });
const durations: number[] = [];
const db = drizzle(timeQueries(client, (ms) => durations.push(ms)));

afterAll(() => client.end());

describe("timeQueries", () => {
  it("reports each query's duration and still returns its rows", async () => {
    durations.length = 0;

    const rows = await db.execute(rawSql`select 1 as one, pg_sleep(0.05)`);
    // The query builder goes through postgres.js's .values(), unlike execute
    const values = await db.select({ two: rawSql<number>`2` }).from(visitors).limit(0);

    expect(rows[0]).toMatchObject({ one: 1 });
    expect(values).toEqual([]);
    expect(durations).toHaveLength(2);
    expect(durations[0]).toBeGreaterThanOrEqual(50);
  });

  it("reports failed queries too, and passes the error on", async () => {
    durations.length = 0;

    await expect(db.execute(rawSql`select * from no_such_table`)).rejects.toThrow(/no_such_table/);
    expect(durations).toHaveLength(1);
  });
});
