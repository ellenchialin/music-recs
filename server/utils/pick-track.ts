import type { ItunesTrack } from "../itunes/schemas";
import { normalizeArtistName } from "../../shared/utils/normalize-artist-name";

// A version is the title followed by one of these: "Creep (Acoustic)", "Creep [Live]",
// "First Love - From THE FIRST TAKE". The leading space rules out "Creeping Death" and "Creep-Show"
const VERSION_SEPARATORS = [" (", " [", " - "];

// Picks this artist's song from iTunes results, or null (the card then has no play button).
// 1. Right artist with a preview; 2. exact title; 3. otherwise a version of the title.
// Ties go to iTunes' order. Case and surrounding spaces are ignored
export function pickTrack(tracks: ItunesTrack[], want: { artist: string; title: string }): ItunesTrack | null {
  // The artist-name normalization (NFKC, trim, lowercase, spaces) works for titles too
  const artist = normalizeArtistName(want.artist);
  const title = normalizeArtistName(want.title);

  const candidates = tracks.filter((t) => t.previewUrl !== null && normalizeArtistName(t.artist) === artist);

  return (
    candidates.find((t) => normalizeArtistName(t.name) === title) ??
    candidates.find((t) => {
      const name = normalizeArtistName(t.name);
      return VERSION_SEPARATORS.some((sep) => name.startsWith(title + sep));
    }) ??
    null
  );
}
