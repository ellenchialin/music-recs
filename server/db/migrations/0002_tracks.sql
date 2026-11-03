CREATE TABLE "tracks" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tracks_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"artist_name" text NOT NULL,
	"artist_name_norm" text NOT NULL,
	"title" text NOT NULL,
	"itunes_id" bigint,
	"preview_url" text,
	"artwork_url" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracks_artist_name_norm_unique" UNIQUE("artist_name_norm")
);
