// $fetch for our own API. During SSR the request doesn't go over the network, so the API sees no
// client IP and every visitor would share one rate-limit bucket. Forward the IP in x-forwarded-for
// (Vercel overwrites that header, so clients can't spoof it). Call at the top of setup
export function useApiFetch(): typeof $fetch {
  if (import.meta.client) return $fetch;
  const fetch = useRequestFetch();
  const forwarded = useRequestHeaders(["x-forwarded-for"])["x-forwarded-for"];
  const ip = forwarded ?? useRequestEvent()?.node.req.socket?.remoteAddress;
  if (!ip) return fetch;
  // Not fetch.create: during SSR useRequestFetch returns a plain function with no `create`.
  // Loosely typed because $fetch's generics hit "type instantiation is excessively deep"
  type Fetch = (request: string, options?: { headers?: Record<string, string> }) => Promise<unknown>;
  const base = fetch as unknown as Fetch;
  const withIp: Fetch = (request, options) =>
    base(request, { ...options, headers: { ...options?.headers, "x-forwarded-for": ip } });
  return withIp as unknown as typeof $fetch;
}
