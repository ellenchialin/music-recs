CREATE TABLE "artist_similar" (
	"artist_id" integer NOT NULL,
	"name" text NOT NULL,
	"name_norm" text NOT NULL,
	"mbid" text,
	"match" real NOT NULL,
	CONSTRAINT "artist_similar_artist_id_name_norm_pk" PRIMARY KEY("artist_id","name_norm"),
	CONSTRAINT "artist_similar_match_range" CHECK ("artist_similar"."match" between 0 and 1)
);
--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "similar_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "artist_similar" ADD CONSTRAINT "artist_similar_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE no action;