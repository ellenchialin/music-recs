// Link previews (Open Graph, Twitter cards) for a page. Previews ignore relative URLs, so the
// page and image URLs are built from the request's origin
export const OG_IMAGE = { path: "/og-image.png", width: 1200, height: 630, alt: "Music Recs: a teal sun with a spinning record on pink" };

export function shareMeta({ origin, path, title, description }: { origin: string; path: string; title: string; description: string }) {
  const image = `${origin}${OG_IMAGE.path}`;
  return {
    description,
    ogTitle: title,
    ogDescription: description,
    ogSiteName: "Music Recs",
    ogType: "website" as const,
    ogUrl: `${origin}${path}`,
    ogImage: image,
    ogImageWidth: OG_IMAGE.width,
    ogImageHeight: OG_IMAGE.height,
    ogImageAlt: OG_IMAGE.alt,
    twitterCard: "summary_large_image" as const,
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
  };
}
