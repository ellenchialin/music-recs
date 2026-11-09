import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseDbEnv } from "../utils/env";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

function createDb() {
  const { DATABASE_URL } = parseDbEnv();
  // Serverless-friendly: each function instance keeps only a few connections, and prepared
  // statements are off because Neon's pooled URL (PgBouncer in transaction mode) doesn't support them
  return drizzle(postgres(DATABASE_URL, { max: 3, idle_timeout: 20, prepare: false }), { schema });
}

// Connect lazily, so importing this module doesn't require DATABASE_URL
let db: Db | undefined;

export function getDb(): Db {
  db ??= createDb();
  return db;
}
