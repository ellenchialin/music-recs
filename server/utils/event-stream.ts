import type { H3Event } from "h3";

// Answers a request with Server-Sent Events. run gets send() and a signal that fires when the
// visitor goes away (closed page, Stop), so it can stop paying for work nobody will read.
// Events go out in order: one is never overtaken by a later one or by the end of the stream.
// onError: what to send when run throws, before the stream closes
export function sendEvents<E extends { type: string }>(
  event: H3Event,
  run: (send: (event: E) => void, signal: AbortSignal) => Promise<void>,
  { label, onError }: { label: string; onError?: (send: (event: E) => void) => void },
) {
  const stream = createEventStream(event);
  const left = new AbortController();
  stream.onClosed(() => left.abort());

  let sending = Promise.resolve();
  const send = ({ type, ...data }: E) => {
    sending = sending.then(() => stream.push({ event: type, data: JSON.stringify(data) }));
  };

  void (async () => {
    try {
      await run(send, left.signal);
    } catch (err) {
      console.error(`${label} failed:`, err instanceof Error ? err.message : err);
      onError?.(send);
    } finally {
      await sending;
      await stream.close();
    }
  })();

  return stream.send();
}
