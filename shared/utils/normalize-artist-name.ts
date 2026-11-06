// Matching key for artist names (artists.name_norm). Never shown; display uses the original name
export function normalizeArtistName(name: string): string {
  return (
    name
      // NFKC: "o" + diaeresis → ö, full-width Ｒ → R; accents and CJK stay
      .normalize("NFKC")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
  );
}
