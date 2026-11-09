import { describe, expect, it } from "vitest";
import { shareMeta } from "./share-meta";

describe("shareMeta", () => {
  const meta = shareMeta({
    origin: "https://musicrecs.ellenchen.dev",
    path: "/taste-check?seed=Tame+Impala",
    title: "Taste Check",
    description: "Do these picks fit your taste?",
  });

  it("gives Open Graph and Twitter the same title and description", () => {
    expect(meta).toMatchObject({
      ogTitle: "Taste Check",
      ogDescription: "Do these picks fit your taste?",
      twitterTitle: "Taste Check",
      twitterDescription: "Do these picks fit your taste?",
      description: "Do these picks fit your taste?",
      ogSiteName: "Music Recs",
      ogType: "website",
    });
  });

  // Link previews ignore relative URLs, so both must be absolute
  it("uses absolute URLs for the page and the preview image", () => {
    expect(meta.ogUrl).toBe("https://musicrecs.ellenchen.dev/taste-check?seed=Tame+Impala");
    expect(meta.ogImage).toBe("https://musicrecs.ellenchen.dev/og-image.png");
    expect(meta.twitterImage).toBe(meta.ogImage);
  });

  it("describes a large 1200×630 preview image", () => {
    expect(meta).toMatchObject({ ogImageWidth: 1200, ogImageHeight: 630, twitterCard: "summary_large_image" });
    expect(meta.ogImageAlt).toBeTruthy();
  });
});
