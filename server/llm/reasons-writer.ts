import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ReasonsWriter } from "../services/reasons";
import { buildReasonsPrompt } from "../utils/reasons-prompt";
import { createReasonsParser } from "../utils/reasons-stream-parser";

// Claude Haiku 5.5 (as the spec decides: short copy, cheapest and fastest), structured output so
// the answer can only come back in this shape, and our own zod check on each entry as for every API
export const REASONS_MODEL = "claude-haiku-5-5";

const reasonEntry = z.object({ artist: z.string(), reason: z.string().nullable() });
const reasonsOutput = z.object({ reasons: z.array(reasonEntry) });

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createReasonsWriter({ apiKey, fetch }: { apiKey: string; fetch?: Fetch }): ReasonsWriter {
  // No retries: entries already handed out would come again. The caller sets the overall deadline
  const client = new Anthropic({ apiKey, fetch, maxRetries: 0, timeout: 20_000 });
  return {
    // Streams the answer and hands out each entry as soon as it's complete, so the first reason
    // shows while the rest are being written
    async *stream(input, { signal } = {}) {
      const { system, user } = buildReasonsPrompt(input);
      const stream = client.messages.stream(
        {
          model: REASONS_MODEL,
          max_tokens: 2000,
          system,
          messages: [{ role: "user", content: user }],
          // A line of copy needs no reasoning: thinking off (allowed at effort high or below) and low effort
          thinking: { type: "disabled" },
          output_config: { effort: "low", format: zodOutputFormat(reasonsOutput) },
        },
        { signal },
      );
      const parser = createReasonsParser();
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          for (const entry of parser.push(event.delta.text)) yield reasonEntry.parse(entry);
        }
      }
      // A cut-off answer ends with complete entries too; say so, so the caller doesn't take the
      // missing records as "the model had nothing"
      const message = await stream.finalMessage();
      if (message.stop_reason !== "end_turn") throw new Error(`No reasons: stop_reason ${message.stop_reason}`);
    },
  };
}
