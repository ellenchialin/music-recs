import { sql } from "drizzle-orm";
import { getDb } from "../../server/db/client";
import type { ItunesClient } from "../../server/itunes/client";
import { createLastfmClient } from "../../server/lastfm/client";
import info from "../../server/lastfm/fixtures/info-radiohead.json" with { type: "json" };
import similar from "../../server/lastfm/fixtures/similar-radiohead.json" with { type: "json" };
import { getRecommendations } from "../../server/services/recommendations";
import { prepareDatabase } from "../setup/db-global-setup";
import { E2E_DATABASE_URL, FAKE_LASTFM_API_KEY, assertLocalDatabase, previewUrl } from "./outside-world";

// Fills the cache tables by running the real getRecommendations against fake clients, so the
// server under test finds everything in Postgres and never needs Last.fm or iTunes
export default async function setup() {
  assertLocalDatabase(E2E_DATABASE_URL);
  await prepareDatabase(E2E_DATABASE_URL);
  // getDb() reads this lazily, on first use below
  process.env.DATABASE_URL = E2E_DATABASE_URL;
  const db = getDb();
  try {
    // Start clean each run, including rate-limit counts. Every table in public, so new tables are
    // emptied too; drizzle's migration journal lives in its own schema and is kept
    await db.execute(sql`
      do $$ declare names text;
      begin
        select string_agg(format('%I', tablename), ', ') into names from pg_tables where schemaname = 'public';
        if names is not null then execute 'truncate ' || names || ' cascade'; end if;
      end $$`);

    const { recommendations } = await getRecommendations({ db, lastfm, itunes, now: new Date() }, { seeds: ["Radiohead"] });
    // getRecommendations turns a failed preview into a card with an error instead of throwing, so
    // check here rather than let the test fail later with a confusing symptom
    const missing = recommendations.filter((r) => r.preview.status !== "available").map((r) => r.artist);
    if (recommendations.length === 0 || missing.length > 0) {
      throw new Error(`E2E seed incomplete: ${recommendations.length} cards, no preview for ${missing.join(", ") || "-"}`);
    }
  } finally {
    await db.$client.end();
  }
}

// Radiohead's info and similar artists come from the recorded fixtures, through the real client
// and its zod schemas
const fixtures: Record<string, unknown> = {
  "artist.getInfo": info.body,
  "artist.getSimilar": similar.body,
};
const recorded = createLastfmClient({
  apiKey: FAKE_LASTFM_API_KEY,
  fetch: async (input) => {
    const method = new URL(String(input)).searchParams.get("method")!;
    if (!(method in fixtures)) throw new Error(`No E2E fixture for ${method}`);
    return Response.json(fixtures[method]);
  },
});

// There are no fixtures for every recommended artist's top track, so each gets one made-up
// song whose preview is served by the tests
const TITLE = "E2E Song";
const lastfm = {
  getInfo: recorded.getInfo,
  getSimilar: recorded.getSimilar,
  getTopTracks: async () => [{ name: TITLE, mbid: null, playcount: 1, listeners: 1 }],
  searchArtists: async () => [],
};

const itunes: Pick<ItunesClient, "searchTracks"> = {
  // The term is "<artist> <title>"
  searchTracks: async (term) => {
    const artist = term.slice(0, -TITLE.length - 1);
    return [{ id: 1, name: TITLE, artist, album: null, previewUrl: previewUrl(artist), artworkUrl: null }];
  },
};
