import { sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { createDbWaker } from "../utils/db-waker";

// Runs before every request; on page renders it wakes the database in the background
const wakeDb = createDbWaker({
  // async, so a missing DATABASE_URL becomes a rejection the waker swallows, not a failed page
  wake: async () => getDb().execute(sql`select 1`),
  intervalMs: 60_000,
});

export default defineEventHandler((event) => {
  const waking = wakeDb(event.path, new Date());
  // Don't hold up the page; waitUntil keeps the query alive after the response is sent
  if (waking) event.waitUntil(waking);
});
