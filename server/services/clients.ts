import { getDb } from "../db/client";
import { createItunesClient } from "../itunes/client";
import { createLastfmClient } from "../lastfm/client";
import { createReasonsWriter } from "../llm/reasons-writer";
import { parseLastfmEnv, parseLlmEnv } from "../utils/env";
import type { ReasonsWriter } from "./reasons";
import { withItunesBudget, withLastfmBudget } from "./external-budget";

// Real clients, created on first use and wrapped in the site-wide budgets.
// Tests pass fakes to the services instead

let lastfm: ReturnType<typeof createLastfmClient> | undefined;
let itunes: ReturnType<typeof createItunesClient> | undefined;

const budgetDeps = () => ({ db: getDb(), now: () => new Date() });

export function getLastfmClient() {
  lastfm ??= withLastfmBudget(createLastfmClient({ apiKey: parseLastfmEnv().LASTFM_API_KEY }), budgetDeps());
  return lastfm;
}

export function getItunesClient() {
  itunes ??= withItunesBudget(createItunesClient(), budgetDeps());
  return itunes;
}

// null without ANTHROPIC_API_KEY: reasons are optional. The daily cap lives in getReasons
let reasonsWriter: ReasonsWriter | null | undefined;
export function getReasonsWriter(): ReasonsWriter | null {
  if (reasonsWriter === undefined) {
    const { apiKey } = parseLlmEnv();
    reasonsWriter = apiKey ? createReasonsWriter({ apiKey }) : null;
  }
  return reasonsWriter;
}

