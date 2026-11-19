import { describe, expect, it } from "vitest";
import { TASTE_TOOLS } from "../utils/taste-agent";
import { TASTE_MODEL, createTasteModel } from "./taste-model";

// A message in the API's shape: one text block and one tool call
const reply = {
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: TASTE_MODEL,
  content: [
    { type: "text", text: "Checking Tame Impala." },
    { type: "tool_use", id: "toolu_1", name: "get_similar_artists", input: { name: "Tame Impala" } },
  ],
  stop_reason: "tool_use",
  stop_sequence: null,
  usage: { input_tokens: 900, output_tokens: 40 },
};

function fakeFetch(body: unknown = reply, status = 200) {
  const requests: Record<string, unknown>[] = [];
  const fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { fetch, requests };
}

const apiKey = "sk-ant-test-0000";
const messages = [{ role: "user" as const, content: "<description>Lazy jazz</description>" }];

describe("createTasteModel", () => {
  it("returns the model's text and tool calls", async () => {
    const { fetch } = fakeFetch();

    const turn = await createTasteModel({ apiKey, fetch }).next(messages, { mustFinish: false });

    expect(turn.content).toEqual(reply.content);
  });

  it("asks the cheap model to choose among the agent's tools, without thinking", async () => {
    const { fetch, requests } = fakeFetch();

    await createTasteModel({ apiKey, fetch }).next(messages, { mustFinish: false });

    expect(requests[0]).toMatchObject({
      model: TASTE_MODEL,
      messages,
      tools: TASTE_TOOLS,
      tool_choice: { type: "auto" },
      thinking: { type: "disabled" },
    });
    expect(requests[0]!.system).toEqual(expect.stringContaining("suggest_artists"));
  });

  it("makes the model answer with suggest_artists when it must finish", async () => {
    const { fetch, requests } = fakeFetch();

    await createTasteModel({ apiKey, fetch }).next(messages, { mustFinish: true });

    expect(requests[0]!.tool_choice).toEqual({ type: "tool", name: "suggest_artists" });
  });

  it("throws on an API error", async () => {
    const { fetch } = fakeFetch({ type: "error", error: { type: "invalid_request_error", message: "bad" } }, 400);
    await expect(createTasteModel({ apiKey, fetch }).next(messages, { mustFinish: false })).rejects.toThrow();
  });
});
