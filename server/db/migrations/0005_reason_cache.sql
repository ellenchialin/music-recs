CREATE TABLE "reason_cache" (
	"seed_key" text NOT NULL,
	"artist_norm" text NOT NULL,
	"prompt_version" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reason_cache_seed_key_artist_norm_prompt_version_pk" PRIMARY KEY("seed_key","artist_norm","prompt_version")
);
