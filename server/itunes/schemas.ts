import { z } from "zod";

// Validates iTunes Search API responses and keeps only the fields we use

// These end up in <img> and <audio>: anything but a valid https URL becomes null.
// (z.url() alone accepts javascript: and data:)
const httpsUrl = z
  .string()
  .optional()
  .transform((url) => (url && url.startsWith("https://") && URL.canParse(url) ? url : null));

// iTunes only lists 30/60/100px covers, but the size in the URL can be changed
const COVER_SIZE = "600x600bb";
const cover = httpsUrl.transform((url) => url?.replace(/\/\d+x\d+bb\./, `/${COVER_SIZE}.`) ?? null);

const result = z.object({
  kind: z.string().optional(),
  trackId: z.number().int().positive(),
  trackName: z.string().min(1),
  artistName: z.string().min(1),
  collectionName: z.string().optional(),
  previewUrl: httpsUrl,
  artworkUrl100: cover,
});

export const searchResponse = z
  .object({ results: z.array(z.looseObject({ kind: z.string().optional() })) })
  .transform((r) =>
    r.results
      // Filter before validating: music videos have other fields and shouldn't fail the response
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

// e.g. { "errorMessage": "Invalid value(s) for key(s): [resultEntity]" }
export const errorResponse = z.object({ errorMessage: z.string() });

export type ItunesTrack = z.output<typeof searchResponse>[number];
