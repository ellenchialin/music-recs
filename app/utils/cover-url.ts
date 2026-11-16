// iTunes serves a cover at any size and format named at the end of its URL (…/600x600bb.jpg).
// WebP is about a third of the JPEG at 300–600 px; at 1×1 its header makes it four times bigger
const ITUNES_SIZE = /\/\d+x\d+bb\.\w+$/;

export function coverUrl(url: string, px: number, format: "webp" | "jpg"): string {
  return url.replace(ITUNES_SIZE, `/${px}x${px}bb.${format}`);
}
