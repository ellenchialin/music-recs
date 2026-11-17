import { getDb } from "../db/client";
import { getBlindTestStats, getPopularityStats } from "../services/blind-tests";
import type { StatsResult } from "../../shared/types/stats";
import { enforceRateLimit } from "../services/rate-limit";

// GET /api/stats → blind-test results per algorithm version and per popularity setting
export default defineEventHandler(async (event): Promise<StatsResult> => {
  await enforceRateLimit(event, "stats");
  const db = getDb();
  const [versions, settings] = await Promise.all([getBlindTestStats(db), getPopularityStats(db)]);
  return { versions, settings };
});
