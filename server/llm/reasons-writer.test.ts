import { describe, expect, it } from "vitest";
import recorded from "./fixtures/reasons-tame-impala.json";
import { REASONS_MODEL, createReasonsWriter } from "./reasons-writer";

// Replays the recorded response and keeps the request the SDK sent
function fakeFetch(body: unknown = recorded.response.body, status = recorded.response.status) {
  const requests: Record<string, unknown>[] = [];
  const fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { fetch, requests };
}

const apiKey = "sk-ant-test-0000";

describe("createReasonsWriter", () => {
  it("returns a reason for each record from the recorded response", async () => {
    const { fetch } = fakeFetch();
    const output = await createReasonsWriter({ apiKey, fetch }).write(recorded.input);
    expect(output.reasons.map((r) => r.artist)).toEqual(recorded.input.records.map((r) => r.artist));
    expect(output.reasons.every((r) => r.reason === null || typeof r.reason === "string")).toBe(true);
  });

  it("asks the cheap model for structured output, without thinking", async () => {
    const { fetch, requests } = fakeFetch();
    await createReasonsWriter({ apiKey, fetch }).write(recorded.input);
    expect(requests[0]).toMatchObject({
      model: REASONS_MODEL,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
  });

  // A cut-off answer may still be valid JSON with missing records; don't trust it
  it("throws when the answer was cut off", async () => {
    const { fetch } = fakeFetch({ ...recorded.response.body, stop_reason: "max_tokens" });
    await expect(createReasonsWriter({ apiKey, fetch }).write(recorded.input)).rejects.toThrow(/max_tokens/);
  });

  it("throws on an API error so nothing is cached", async () => {
    const { fetch } = fakeFetch({ type: "error", error: { type: "invalid_request_error", message: "bad" } }, 400);
    await expect(createReasonsWriter({ apiKey, fetch }).write(recorded.input)).rejects.toThrow();
  });
});
