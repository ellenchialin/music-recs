CREATE TABLE "blind_test_items" (
	"test_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"artist" text NOT NULL,
	"title" text NOT NULL,
	"preview_url" text NOT NULL,
	"is_recommended" boolean NOT NULL,
	"rating" integer,
	CONSTRAINT "blind_test_items_test_id_position_pk" PRIMARY KEY("test_id","position"),
	CONSTRAINT "blind_test_items_rating_range" CHECK ("blind_test_items"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "blind_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visitor_id" uuid NOT NULL,
	"seeds" text[] NOT NULL,
	"algo_version" text NOT NULL,
	"control_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "blind_test_items" ADD CONSTRAINT "blind_test_items_test_id_blind_tests_id_fk" FOREIGN KEY ("test_id") REFERENCES "public"."blind_tests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blind_tests" ADD CONSTRAINT "blind_tests_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "public"."visitors"("id") ON DELETE cascade ON UPDATE no action;