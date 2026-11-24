// Nitro's event.waitUntil only collects promises unless event.context.waitUntil is set, and its
// Vercel (Node) preset never sets it. Without this, Vercel freezes the instance as soon as the
// response is sent and background work (the Neon wake) stalls until the next request

type WaitUntil = (promise: Promise<unknown>) => void;
export type WaitUntilContext = { waitUntil?: WaitUntil };

export function bridgeWaitUntil(context: WaitUntilContext, platformWaitUntil: WaitUntil) {
  context.waitUntil ??= platformWaitUntil;
}
