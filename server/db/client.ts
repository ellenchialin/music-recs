import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseDbEnv } from "../utils/env";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

function createDb() {
  const { DATABASE_URL } = parseDbEnv();
  return drizzle(postgres(DATABASE_URL), { schema });
}

// 延遲建立連線：import 時不需要 DATABASE_URL，方便測試純函式
let db: Db | undefined;

export function getDb(): Db {
  db ??= createDb();
  return db;
}
