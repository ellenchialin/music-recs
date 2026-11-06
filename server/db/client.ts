import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseDbEnv } from "../utils/env";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

function createDb() {
  const { DATABASE_URL } = parseDbEnv();
  return drizzle(postgres(DATABASE_URL), { schema });
}

// Connect lazily, so importing this module doesn't require DATABASE_URL
let db: Db | undefined;

export function getDb(): Db {
  db ??= createDb();
  return db;
}
