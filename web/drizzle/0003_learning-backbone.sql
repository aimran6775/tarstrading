CREATE TABLE "card_reviews" (
	"user_id" text NOT NULL,
	"card_key" text NOT NULL,
	"box" integer DEFAULT 1 NOT NULL,
	"due_at" bigint NOT NULL,
	"reps" integer DEFAULT 0 NOT NULL,
	"lapses" integer DEFAULT 0 NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "card_reviews_user_id_card_key_pk" PRIMARY KEY("user_id","card_key")
);
--> statement-breakpoint
CREATE TABLE "practice_streaks" (
	"user_id" text PRIMARY KEY NOT NULL,
	"day" text NOT NULL,
	"current" integer DEFAULT 0 NOT NULL,
	"longest" integer DEFAULT 0 NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lesson_id" text NOT NULL,
	"quiz_index" integer NOT NULL,
	"choice" integer NOT NULL,
	"correct" integer NOT NULL,
	"tries" integer DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_reviews" ADD CONSTRAINT "card_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_streaks" ADD CONSTRAINT "practice_streaks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_reviews_due" ON "card_reviews" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "quiz_attempts_lesson" ON "quiz_attempts" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user" ON "quiz_attempts" USING btree ("user_id");--> statement-breakpoint
-- Row Level Security: same deny-by-default lockdown as the baseline. These
-- tables hold per-user learning data; the app connects as the postgres owner
-- (which bypasses RLS), so only the public anon/authenticated roles are denied.
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "practice_streaks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "card_reviews" ENABLE ROW LEVEL SECURITY;