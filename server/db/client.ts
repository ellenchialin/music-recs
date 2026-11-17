import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseDbEnv } from "../utils/env";
import * as schema from "./schema";
import { timeQueries } from "./timed-client";

export type Db = ReturnType<typeof createDb>;

// Set by the request-timing plugin on the server; tests and scripts leave it unset
let queryListener: ((ms: number) => void) | null = null;
export function onDbQuery(listener: (ms: number) => void) {
  queryListener = listener;
}

function createDb() {
  const { DATABASE_URL } = parseDbEnv();
  // Prepared statements are off because Neon's pooled URL (PgBouncer in transaction mode) doesn't
  // support them. max 10, not 3: with Fluid compute one instance serves many requests at once, and
  // PgBouncer accepts thousands of client connections, so a burst shouldn't queue for three
  const sql = postgres(DATABASE_URL, { max: 10, idle_timeout: 20, prepare: false });
  return drizzle(timeQueries(sql, (ms) => queryListener?.(ms)), { schema });
}

// Connect lazily, so importing this module doesn't require DATABASE_URL
let db: Db | undefined;

export function getDb(): Db {
  db ??= createDb();
  return db;
}
