import { describe, expect, it } from "vitest";
import type { CardPreview, RecommendationCard } from "~~/shared/types/recommendations";
import { previewQueue, withPreviews } from "./card-previews";

const card = (artist: string, preview: RecommendationCard["preview"] = { status: "pending" }): RecommendationCard => ({
  artist,
  score: 0.2,
  sources: ["Tame Impala"],
  track: null,
  preview,
});
const found = (title: string): CardPreview => ({
  track: { title, artworkUrl: null },
  preview: { status: "available", url: `https://audio.example/${title}.m4a` },
});

describe("previewQueue", () => {
  const cards = ["A", "B", "C", "D", "E"].map((name) => card(name));

  it("starts with the record being viewed, then works outwards, next before previous", () => {
    expect(previewQueue(cards, 2)).toEqual(["C", "D", "B", "E", "A"]);
  });

  it("only includes cards still pending", () => {
    const mixed = [card("A", { status: "unavailable" }), card("B"), card("C", { status: "available", url: "x" })];
    expect(previewQueue(mixed, 0)).toEqual(["B"]);
  });
});

describe("withPreviews", () => {
  it("fills cards in from the loaded previews, matching names loosely", () => {
    const [pond, mgmt] = withPreviews([card("Pond"), card("MGMT")], { pond: found("Paint Me Silver") });
    expect(pond).toMatchObject({ artist: "Pond", ...found("Paint Me Silver") });
    expect(mgmt?.preview).toEqual({ status: "pending" });
  });

  // A retried preview replaces the card's own error
  it("prefers a loaded preview over the card's own", () => {
    const [pond] = withPreviews([card("Pond", { status: "error" })], { pond: found("Paint Me Silver") });
    expect(pond?.preview.status).toBe("available");
  });

  it("returns the same cards when nothing has loaded", () => {
    const cards = [card("Pond")];
    expect(withPreviews(cards, {})).toEqual(cards);
  });
});
