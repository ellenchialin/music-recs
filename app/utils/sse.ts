// Splits a Server-Sent Events stream into events as chunks arrive. A chunk can end anywhere, even
// mid-line, so whatever follows the last blank line waits for the next chunk.
// fetch + this parser rather than the browser's EventSource, which reconnects on its own and
// would ask for the reasons again after the stream ended

export type SseEvent = { event: string; data: string };

export function createSseParser() {
  let buffer = "";

  return {
    push(chunk: string): SseEvent[] {
      buffer += chunk.replace(/\r\n/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop()!;
      return blocks.flatMap((block) => {
        let event = "message";
        const data: string[] = [];
        for (const line of block.split("\n")) {
          // Lines starting with ":" are comments, often used as keep-alives
          if (!line || line.startsWith(":")) continue;
          const colon = line.indexOf(":");
          const field = colon < 0 ? line : line.slice(0, colon);
          const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
          if (field === "event") event = value;
          else if (field === "data") data.push(value);
        }
        return data.length ? [{ event, data: data.join("\n") }] : [];
      });
    },
  };
}

// Reads a response body to the end, handing each event to onEvent as soon as it's complete
export async function readSse(body: ReadableStream<Uint8Array>, onEvent: (event: SseEvent) => void) {
  const parser = createSseParser();
  // stream: true keeps a character split across chunks for the next one
  const decoder = new TextDecoder();
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const event of parser.push(decoder.decode(value, { stream: true }))) onEvent(event);
  }
}
