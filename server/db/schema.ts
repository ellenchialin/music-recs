import { sql } from "drizzle-orm";
import { bigint, check, integer, pgTable, primaryKey, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// Anonymous visitors. The server generates the id for the cookie.
// Deliberately no IP or User-Agent: nothing identifies a person except this random id
export const visitors = pgTable("visitors", {
  id: uuid("id").primaryKey(),
  createdAt: createdAt(),
});

// Cached Last.fm artists, refetched after 30 days
export const artists = pgTable(
  "artists",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    // For display, in Last.fm's casing
    name: text("name").notNull(),
    // For matching: "Radiohead" and "radiohead " are the same artist
    nameNorm: text("name_norm").notNull().unique(),
    // MusicBrainz ID; many lesser-known artists have none, so it can't be the key
    mbid: text("mbid"),
    listeners: integer("listeners"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    // Similar artists come from another call; null = never fetched
    similarFetchedAt: timestamp("similar_fetched_at", { withTimezone: true }),
  },
  (t) => [check("artists_listeners_non_negative", sql`${t.listeners} >= 0`)],
);

// An artist's similar list, replaced as a whole when stale. The similar side stores only name and
// match, not a reference to artists, to avoid dozens of extra API calls
export const artistSimilar = pgTable(
  "artist_similar",
  {
    artistId: integer("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameNorm: text("name_norm").notNull(),
    mbid: text("mbid"),
    match: real("match").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.artistId, t.nameNorm] }),
    check("artist_similar_match_range", sql`${t.match} between 0 and 1`),
  ],
);

// One track per artist: Last.fm's top track plus the iTunes preview and cover. Keyed by name because
// recommended artists may not be in `artists`. A null preview means "checked, none found"
export const tracks = pgTable("tracks", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  artistName: text("artist_name").notNull(),
  artistNameNorm: text("artist_name_norm").notNull().unique(),
  title: text("title").notNull(),
  // iTunes trackIds are close to the int limit
  itunesId: bigint("itunes_id", { mode: "number" }),
  // iTunes preview URLs don't expire
  previewUrl: text("preview_url"),
  artworkUrl: text("artwork_url"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

// Rate-limit counts, one row per key ("api:ip hash") per window. In Postgres because serverless
// instances don't share memory. Only salted IP hashes are stored
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), check("rate_limits_count_positive", sql`${t.count} > 0`)],
);
