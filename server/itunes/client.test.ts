import { describe, expect, it } from "vitest";
import badRequest from "./fixtures/search-bad-request.json";
import utada from "./fixtures/search-utada-first-love.json";
import { ItunesError, createItunesClient } from "./client";

// 假的 fetch：記下被呼叫的網址，回傳指定的內容。測試因此不碰網路
function fakeFetch(status: number, body: unknown) {
  const calls: URL[] = [];
  const fetch = async (input: string | URL | Request) => {
    calls.push(new URL(String(input)));
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return new Response(text, { status });
  };
  return { fetch, calls };
}

describe("createItunesClient", () => {
  it("searches songs in the Taiwan store by default", async () => {
    const { fetch, calls } = fakeFetch(200, utada.body);
    const client = createItunesClient({ fetch });

    const tracks = await client.searchTracks("宇多田ヒカル First Love", { limit: 5 });

    expect(tracks[0]?.name).toBe("First Love");
    expect(calls[0]?.pathname).toBe("/search");
    expect(Object.fromEntries(calls[0]?.searchParams ?? [])).toEqual({
      term: "宇多田ヒカル First Love",
      entity: "song",
      limit: "5",
      country: "TW",
    });
  });

  it("can search another country's store", async () => {
    const { fetch, calls } = fakeFetch(200, utada.body);
    const client = createItunesClient({ fetch, country: "JP" });

    await client.searchTracks("First Love");

    expect(calls[0]?.searchParams.get("country")).toBe("JP");
  });

  it("throws ItunesError with the API's message for a 400", async () => {
    const { fetch } = fakeFetch(badRequest.status, badRequest.body);
    const client = createItunesClient({ fetch });

    const err = await client.searchTracks("x").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ItunesError);
    expect(err).toMatchObject({ status: 400 });
    expect((err as Error).message).toContain("Invalid value(s)");
  });

  // 速率限制時 iTunes 可能回 403/429 和一頁 HTML
  it("throws ItunesError when the server returns something that is not JSON", async () => {
    const { fetch } = fakeFetch(403, "<html>Forbidden</html>");
    const client = createItunesClient({ fetch });

    const err = await client.searchTracks("x").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ItunesError);
    expect(err).toMatchObject({ status: 403 });
  });
});
