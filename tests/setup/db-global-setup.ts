import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Vitest's DB project: the test database comes from vitest.config.ts
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see vitest.config.ts)");
  await prepareDatabase(url);
}

// Creates the database if needed and applies all migrations. Also used by the E2E setup
export async function prepareDatabase(url: string) {
  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const adminSql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    const exists = await adminSql`select 1 from pg_database where datname = ${dbName}`;
    if (exists.length === 0) await adminSql.unsafe(`create database "${dbName}"`);
  } catch (err) {
    throw new Error(`Cannot reach Postgres at ${admin.host}. Is it running? Try \`pnpm db:up\`.`, { cause: err });
  } finally {
    await adminSql.end();
  }

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "server/db/migrations" });
  } finally {
    await sql.end();
  }
}
