CREATE TABLE "tag_charts" (
	"tag_key" text PRIMARY KEY NOT NULL,
	"artists" text[] NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL
);
