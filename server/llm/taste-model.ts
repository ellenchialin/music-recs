import Anthropic from "@anthropic-ai/sdk";
import type { AgentBlock, TasteModel } from "../services/taste-agent";
import { TASTE_SYSTEM, TASTE_TOOLS } from "../utils/taste-agent";

// Claude Haiku 5.5 as the taste agent's model: choosing lookups and a few artists needs no more,
// and each run makes several calls
export const TASTE_MODEL = "claude-haiku-5-5";

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createTasteModel({ apiKey, fetch }: { apiKey: string; fetch?: Fetch }): TasteModel {
  // The agent's own deadline covers the whole run, so one retry is enough
  const client = new Anthropic({ apiKey, fetch, maxRetries: 1, timeout: 15_000 });
  return {
    async next(messages, { mustFinish, signal }) {
      const response = await client.messages.create(
        {
          model: TASTE_MODEL,
          max_tokens: 1024,
          system: TASTE_SYSTEM,
          tools: TASTE_TOOLS,
          // Out of lookups: the only move left is to answer
          tool_choice: mustFinish ? { type: "tool", name: "suggest_artists" } : { type: "auto" },
          thinking: { type: "disabled" },
          messages: messages as Anthropic.MessageParam[],
        },
        { signal },
      );
      // Only text and tool calls matter to the loop
      const content = response.content.flatMap((block): AgentBlock[] =>
        block.type === "text"
          ? [{ type: "text", text: block.text }]
          : block.type === "tool_use"
            ? [{ type: "tool_use", id: block.id, name: block.name, input: block.input }]
            : [],
      );
      return { content };
    },
  };
}
