// Key for spotting lookalikes: strip accents (é → e, İ → I), treat dotless ı as i, lowercase, collapse spaces.
// Only for comparing, never stored: as a database key it would merge different artists
// (Sigur Rós and a band called Sigur Ros), which is why normalizeArtistName keeps accents
export function lookalikeKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
