import { getDb } from "../db/client";
import { getBlindTestStats } from "../services/blind-tests";
import { enforceRateLimit } from "../services/rate-limit";

// GET /api/stats → blind-test results per algorithm version
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, "stats");
  return { versions: await getBlindTestStats(getDb()) };
});
