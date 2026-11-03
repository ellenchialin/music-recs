import { z } from "zod";

// iTunes Search API 回應的 zod schema：驗證 + 只留需要的欄位
// 和 Last.fm 不同：數字就是 number、陣列一定是陣列，不用額外處理

// 只給 30/60/100px 的封面，但網址最後的「100x100bb」可以改成想要的尺寸
const COVER_SIZE = "600x600bb";
const cover = z
  .url()
  .optional()
  .transform((url) => (url ? url.replace(/\/\d+x\d+bb\./, `/${COVER_SIZE}.`) : null));

const result = z.object({
  kind: z.string().optional(),
  trackId: z.number().int().positive(),
  trackName: z.string().min(1),
  artistName: z.string().min(1),
  collectionName: z.string().optional(),
  previewUrl: z.url().optional(),
  artworkUrl100: cover,
});

export const searchResponse = z
  .object({ results: z.array(z.looseObject({ kind: z.string().optional() })) })
  .transform((r) =>
    r.results
      // 先過濾再驗證：MV、Podcast 等欄位不同，不該讓整個回應失敗
      .filter((item) => item.kind === "song")
      .map((item) => {
        const t = result.parse(item);
        return {
          id: t.trackId,
          name: t.trackName,
          artist: t.artistName,
          album: t.collectionName ?? null,
          previewUrl: t.previewUrl ?? null,
          artworkUrl: t.artworkUrl100,
        };
      }),
  );

// 錯誤回應：{ "errorMessage": "Invalid value(s) for key(s): [resultEntity]", ... }
export const errorResponse = z.object({ errorMessage: z.string() });

export type ItunesTrack = z.output<typeof searchResponse>[number];
