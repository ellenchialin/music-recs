import { describe, expect, it } from "vitest";
import recorded from "./fixtures/reasons-tame-impala.json";
import { REASONS_MODEL, createReasonsWriter } from "./reasons-writer";

// The recorded message, replayed as the event stream the API sends when asked to stream (no real
// call). The answer's text is cut into small pieces, as the API sends it
type Message = typeof recorded.response.body;
function eventStream(message: Message, { pieceSize = 25, stopReason = message.stop_reason } = {}) {
  const text = message.content.map((block) => block.text).join("");
  const event = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const pieces = Array.from({ length: Math.ceil(text.length / pieceSize) }, (_, i) => text.slice(i * pieceSize, (i + 1) * pieceSize));
  return [
    event("message_start", { message: { ...message, content: [], stop_reason: null } }),
    event("content_block_start", { index: 0, content_block: { type: "text", text: "" } }),
    ...pieces.map((piece) => event("content_block_delta", { index: 0, delta: { type: "text_delta", text: piece } })),
    event("content_block_stop", { index: 0 }),
    event("message_delta", { delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: message.usage.output_tokens } }),
    event("message_stop", {}),
  ].join("");
}

// pnpm record:reasons now saves the raw event stream; this fixture predates it and holds the
// whole message, which eventStream() replays
const recordedEvents = (recorded.response as { events?: string }).events ?? eventStream(recorded.response.body);

// Answers with an event stream (or an error) and keeps the request the SDK sent
function fakeFetch(answer: () => Response = () => new Response(recordedEvents, { headers: { "content-type": "text/event-stream" } })) {
  const requests: Record<string, unknown>[] = [];
  const fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    requests.push(JSON.parse(String(init?.body)));
    return answer();
  };
  return { fetch, requests };
}

const apiKey = "sk-ant-test-0000";
const collect = async (entries: AsyncIterable<unknown>) => {
  const out: unknown[] = [];
  for await (const entry of entries) out.push(entry);
  return out;
};

describe("createReasonsWriter", () => {
  it("hands out each record's reason as the answer streams in", async () => {
    const { fetch } = fakeFetch();

    const entries = await collect(createReasonsWriter({ apiKey, fetch }).stream(recorded.input));

    const answer = JSON.parse(recorded.response.body.content[0]!.text) as { reasons: unknown[] };
    expect(entries).toEqual(answer.reasons);
    expect(entries.map((e) => (e as { artist: string }).artist)).toEqual(recorded.input.records.map((r) => r.artist));
  });

  it("asks the cheap model to stream structured output, without thinking", async () => {
    const { fetch, requests } = fakeFetch();
    await collect(createReasonsWriter({ apiKey, fetch }).stream(recorded.input));
    expect(requests[0]).toMatchObject({
      model: REASONS_MODEL,
      stream: true,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema" } },
    });
  });

  // Entries already handed out stay usable; the caller decides what a cut-off means
  it("throws after the last complete entry when the answer was cut off", async () => {
    const { fetch } = fakeFetch(
      () => new Response(eventStream(recorded.response.body, { stopReason: "max_tokens" }), { headers: { "content-type": "text/event-stream" } }),
    );
    const seen: unknown[] = [];

    const run = async () => {
      for await (const entry of createReasonsWriter({ apiKey, fetch }).stream(recorded.input)) seen.push(entry);
    };

    await expect(run()).rejects.toThrow(/max_tokens/);
    expect(seen).toHaveLength(recorded.input.records.length);
  });

  it("throws on an API error", async () => {
    const { fetch } = fakeFetch(
      () => new Response(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "bad" } }), { status: 400 }),
    );
    await expect(collect(createReasonsWriter({ apiKey, fetch }).stream(recorded.input))).rejects.toThrow();
  });

  it("stops when the caller gives up", async () => {
    const { fetch } = fakeFetch();
    const controller = new AbortController();
    controller.abort();
    await expect(collect(createReasonsWriter({ apiKey, fetch }).stream(recorded.input, { signal: controller.signal }))).rejects.toThrow();
  });
});
