import { describe, expect, it } from "vitest";
import notFound from "./fixtures/similar-not-found.json";
import similar from "./fixtures/similar-radiohead.json";
import { LastfmError, createLastfmClient } from "./client";

const apiKey = "0123456789abcdef0123456789abcdef";

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

describe("createLastfmClient", () => {
  it("sends the method, artist, key, JSON format and autocorrect", async () => {
    const { fetch, calls } = fakeFetch(200, similar.body);
    const client = createLastfmClient({ apiKey, fetch });

    const artists = await client.getSimilar("radiohead", { limit: 10 });

    expect(artists[0]?.name).toBe("Thom Yorke");
    const params = Object.fromEntries(calls[0]?.searchParams ?? []);
    expect(params).toEqual({
      method: "artist.getSimilar",
      artist: "radiohead",
      limit: "10",
      autocorrect: "1",
      api_key: apiKey,
      format: "json",
    });
  });

  // Last.fm 找不到歌手時回 HTTP 200，錯誤放在 body 裡；只看 res.ok 會漏掉
  it("throws LastfmError for an error body even with HTTP 200", async () => {
    const { fetch } = fakeFetch(200, notFound.body);
    const client = createLastfmClient({ apiKey, fetch });

    const err = await client.getSimilar("zzqx no such artist").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(LastfmError);
    expect(err).toMatchObject({ code: 6, status: 200 });
  });

  it("throws LastfmError when the server returns something that is not JSON", async () => {
    const { fetch } = fakeFetch(503, "<html>Service Unavailable</html>");
    const client = createLastfmClient({ apiKey, fetch });

    const err = await client.searchArtists("radiohead").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(LastfmError);
    expect(err).toMatchObject({ status: 503 });
  });

  it("never puts the API key in error messages", async () => {
    const { fetch } = fakeFetch(503, "<html>Service Unavailable</html>");
    const client = createLastfmClient({ apiKey, fetch });

    const err = await client.searchArtists("radiohead").catch((e: unknown) => e);

    expect(String((err as Error).message)).not.toContain(apiKey);
  });
});
