import { z } from "zod";
import { getDb } from "../../../db/client";
import { BlindTestNotFoundError, BlindTestRatedError, rateBlindTest } from "../../../services/blind-tests";
import { enforceRateLimit } from "../../../services/rate-limit";
import { assertSameOrigin, getVisitorId } from "../../../services/visitor";

// POST /api/blind-tests/:id/ratings { ratings: [1–5, 1–5, 1–5] } → the revealed songs
const params = z.object({ id: z.uuid() });
const body = z.object({ ratings: z.array(z.number().int().min(1).max(5)).length(3) });

export default defineEventHandler(async (event) => {
  assertSameOrigin(event);
  await enforceRateLimit(event, "blindTest");
  const { id } = await getValidatedRouterParams(event, (input) => params.parse(input));
  const { ratings } = await readValidatedBody(event, (input) => body.parse(input));
  const visitorId = getVisitorId(event);
  if (!visitorId) throw createError({ statusCode: 404, statusMessage: "Blind test not found" });

  try {
    return await rateBlindTest({ db: getDb(), now: new Date() }, { visitorId, testId: id, ratings });
  } catch (err) {
    if (err instanceof BlindTestNotFoundError) throw createError({ statusCode: 404, statusMessage: "Blind test not found" });
    if (err instanceof BlindTestRatedError) throw createError({ statusCode: 409, statusMessage: "Already rated" });
    throw err;
  }
});
