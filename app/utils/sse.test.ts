import { describe, expect, it } from "vitest";
import { createSseParser, readSse, type SseEvent } from "./sse";

describe("createSseParser", () => {
  it("reads named events with JSON-ready data, across chunk boundaries", () => {
    const parser = createSseParser();

    const first = parser.push('event: reason\ndata: {"artist":"Po');
    const second = parser.push('nd","reason":null}\n\nevent: done\ndata: {}\n\n');

    expect(first).toEqual([]);
    expect(second).toEqual([
      { event: "reason", data: '{"artist":"Pond","reason":null}' },
      { event: "done", data: "{}" },
    ]);
  });

  it("calls an event without a name a message, joins multi-line data and ignores comments", () => {
    const parser = createSseParser();

    expect(parser.push(": keep-alive\n\ndata: a\ndata: b\n\n")).toEqual([{ event: "message", data: "a\nb" }]);
  });

  it("accepts Windows line endings", () => {
    expect(createSseParser().push("event: done\r\ndata: {}\r\n\r\n")).toEqual([{ event: "done", data: "{}" }]);
  });
});

describe("readSse", () => {
  // Bytes can split a character, like the "é" in Beyoncé here
  it("hands out each event as its bytes arrive, even when a chunk splits a character", async () => {
    const bytes = new TextEncoder().encode('event: reason\ndata: {"artist":"Beyoncé"}\n\nevent: done\ndata: {}\n\n');
    const split = bytes.indexOf(0xc3) + 1;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, split));
        controller.enqueue(bytes.slice(split));
        controller.close();
      },
    });
    const events: SseEvent[] = [];

    await readSse(body, (event) => events.push(event));

    expect(events).toEqual([
      { event: "reason", data: '{"artist":"Beyoncé"}' },
      { event: "done", data: "{}" },
    ]);
  });
});

