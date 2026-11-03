CREATE TABLE "artists" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "artists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"name_norm" text NOT NULL,
	"mbid" text,
	"listeners" integer,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artists_name_norm_unique" UNIQUE("name_norm"),
	CONSTRAINT "artists_listeners_non_negative" CHECK ("artists"."listeners" >= 0)
);
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
