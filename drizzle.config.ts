import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { parseDbEnv } from "./server/utils/env";

export default defineConfig({
  dialect: "postgresql",
  schema: "./server/db/schema.ts",
  out: "./server/db/migrations",
  dbCredentials: { url: parseDbEnv().DATABASE_URL },
  strict: true,
});
