import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ReasonsWriter } from "../services/reasons";
import { buildReasonsPrompt } from "../utils/reasons-prompt";

// Claude Haiku 5.5 (as the spec decides: short copy, cheapest and fastest), structured output so
// the answer can only come back in this shape, and our own zod check on top as for every API
export const REASONS_MODEL = "claude-haiku-5-5";

const reasonsOutput = z.object({
  reasons: z.array(z.object({ artist: z.string(), reason: z.string().nullable() })),
});

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export function createReasonsWriter({ apiKey, fetch }: { apiKey: string; fetch?: Fetch }): ReasonsWriter {
  // The page shows "Similar to …" meanwhile, so don't keep a request waiting long
  const client = new Anthropic({ apiKey, fetch, maxRetries: 1, timeout: 20_000 });
  return {
    async write(input) {
      const { system, user } = buildReasonsPrompt(input);
      const response = await client.messages.parse({
        model: REASONS_MODEL,
        max_tokens: 2000,
        system,
        messages: [{ role: "user", content: user }],
        // A line of copy needs no reasoning: thinking off (allowed at effort high or below) and low effort
        thinking: { type: "disabled" },
        output_config: { effort: "low", format: zodOutputFormat(reasonsOutput) },
      });
      if (response.stop_reason !== "end_turn" || !response.parsed_output) {
        throw new Error(`No reasons: stop_reason ${response.stop_reason}`);
      }
      return reasonsOutput.parse(response.parsed_output);
    },
  };
}
