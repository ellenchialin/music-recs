// 呼叫自己的 API 用的 $fetch。在瀏覽器就是一般的 $fetch；
// 伺服器端渲染（SSR）時，頁面查 API 不經過網路，API 看不到使用者的 IP，
// 所有人的 SSR 會被速率限制算成同一個「unknown」，大家一起被擋。
// 所以 SSR 時把使用者的 IP 放進 x-forwarded-for 帶給 API（server/services/rate-limit.ts 讀這個 header）。
// 部署在 Vercel 時，x-forwarded-for 由 Vercel 設定、會蓋掉使用者自己送的值，不能拿來假冒別的 IP
//
// 要在 setup 最上層呼叫（和其他 useXxx 一樣），不能在 await 之後才呼叫
export function useApiFetch(): typeof $fetch {
  if (import.meta.client) return $fetch;
  const fetch = useRequestFetch();
  const forwarded = useRequestHeaders(["x-forwarded-for"])["x-forwarded-for"];
  const ip = forwarded ?? useRequestEvent()?.node.req.socket?.remoteAddress;
  if (!ip) return fetch;
  // 包一層，每次請求都加上這個 header。
  // 不用 fetch.create：SSR 時 useRequestFetch 回的是普通函式，型別寫有 create，實際上沒有（呼叫會 500）。
  // 型別放寬再轉回 $fetch：照 $fetch 的泛型寫，TypeScript 會算到「型別太深」。這裡的呼叫只帶 query，不帶其他 header
  type Fetch = (request: string, options?: { headers?: Record<string, string> }) => Promise<unknown>;
  const base = fetch as unknown as Fetch;
  const withIp: Fetch = (request, options) =>
    base(request, { ...options, headers: { ...options?.headers, "x-forwarded-for": ip } });
  return withIp as unknown as typeof $fetch;
}
