import type { Db } from "../db/client";
import type { LastfmClient } from "../lastfm/client";
import type { DescribeEvent } from "../../shared/types/describe";
import { checkSuggestion, describeStep, seenNames } from "../utils/taste-agent";
import { hitRateLimit } from "./rate-limit";
import { runTasteTool } from "./taste-tools";

// The taste agent: turns a description ("like Tame Impala, but for running") into 1–3 seed
// artists. Claude decides which Last.fm lookups to make; this loop runs them, reports each step to
// the page as it happens, and only accepts artists those lookups returned. Limits keep it cheap
// and bounded: a few lookups per run, a deadline, and a daily cap on runs

// Messages in the Anthropic API's shape: text, tool calls and tool results as content blocks
export type AgentMessage = { role: "user" | "assistant"; content: string | unknown[] };
export type AgentBlock = { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown };
export type AgentTurn = { content: AgentBlock[] };

// One model turn. mustFinish: the model has to answer with suggest_artists now
export type TasteModel = {
  next(messages: AgentMessage[], options: { mustFinish: boolean; signal?: AbortSignal }): Promise<AgentTurn>;
};

export type TasteAgentEvent = DescribeEvent;

type Deps = {
  db: Db;
  lastfm: Pick<LastfmClient, "getInfo" | "getSimilar" | "searchArtists" | "getTagTopArtists">;
  now: Date;
  model: TasteModel | null;
  dailyLimit?: number;
  timeoutMs?: number;
};

// Each run makes several model calls, so fewer runs a day than reasons (300)
const DAILY_RUNS = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
// Lookups before the model must answer; enough to look up an artist, its neighbours and a tag or two
export const MAX_LOOKUPS = 6;
// Answers naming artists no lookup returned before giving up; the first one gets a second chance
const MAX_REJECTED = 2;
const MAX_TURNS = MAX_LOOKUPS + MAX_REJECTED + 2;
const TIMEOUT_MS = 30_000;

export async function runTasteAgent(
  deps: Deps,
  description: string,
  emit: (event: TasteAgentEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!deps.model) return emit({ type: "stopped", why: "off" });
  const allowed = await hitRateLimit({ db: deps.db, now: deps.now }, "daily:llm-agent", {
    limit: deps.dailyLimit ?? DAILY_RUNS,
    windowMs: DAY_MS,
  });
  if (!allowed.allowed) return emit({ type: "stopped", why: "limit" });

  const call = new AbortController();
  const onLeave = () => call.abort("left");
  if (signal?.aborted) onLeave();
  signal?.addEventListener("abort", onLeave);
  const timer = setTimeout(() => call.abort("timeout"), deps.timeoutMs ?? TIMEOUT_MS);
  // Nothing more goes to a visitor who left
  const send = (event: TasteAgentEvent) => {
    if (call.signal.reason !== "left") emit(event);
  };
  const aborted = new Promise<never>((_, reject) => {
    const fail = () => reject(new Error(`aborted: ${call.signal.reason}`));
    if (call.signal.aborted) fail();
    else call.signal.addEventListener("abort", fail);
  });
  aborted.catch(() => {});

  try {
    const messages: AgentMessage[] = [{ role: "user", content: `<description>${description}</description>` }];
    const seen = seenNames();
    let lookups = 0;
    let rejected = 0;
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const reply = await Promise.race([
        deps.model.next(messages, { mustFinish: lookups >= MAX_LOOKUPS, signal: call.signal }),
        aborted,
      ]);
      messages.push({ role: "assistant", content: reply.content });
      const calls = reply.content.filter((b): b is Extract<AgentBlock, { type: "tool_use" }> => b.type === "tool_use");
      // Answered in words instead of with suggest_artists
      if (calls.length === 0) break;

      const results: unknown[] = [];
      for (const use of calls) {
        if (use.name === "suggest_artists") {
          const checked = checkSuggestion(use.input, seen);
          if (checked.ok) {
            send({ type: "suggestion", artists: checked.artists });
            send({ type: "done" });
            return;
          }
          rejected++;
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: checked.error });
          continue;
        }
        if (lookups >= MAX_LOOKUPS) {
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: "No lookups left. Suggest artists now." });
          continue;
        }
        lookups++;
        const label = describeStep(use.name, (use.input ?? {}) as Record<string, unknown>);
        send({ type: "step", id: use.id, label, status: "running" });
        try {
          const outcome = await Promise.race([runTasteTool(deps, use.name, use.input), aborted]);
          seen.add(outcome.names);
          send({ type: "step", id: use.id, label, status: "done", summary: outcome.summary });
          results.push({ type: "tool_result", tool_use_id: use.id, content: JSON.stringify(outcome.result) });
        } catch (err) {
          if (call.signal.aborted) throw err;
          console.error(`Taste agent lookup ${use.name} failed:`, err instanceof Error ? err.message : err);
          send({ type: "step", id: use.id, label, status: "failed" });
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: "This lookup failed. Try another." });
        }
      }
      if (rejected >= MAX_REJECTED) break;
      messages.push({ role: "user", content: results });
    }
    send({ type: "stopped", why: "nothing" });
  } catch (err) {
    if (call.signal.reason === "left") return;
    if (call.signal.reason === "timeout") return send({ type: "stopped", why: "timeout" });
    console.error("Taste agent failed:", err instanceof Error ? err.message : err);
    send({ type: "stopped", why: "failed" });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onLeave);
  }
}
