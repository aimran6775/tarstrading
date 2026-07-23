CREATE TABLE "game_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"variant" text NOT NULL,
	"correct" integer NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_attempts" ADD CONSTRAINT "game_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_attempts_variant" ON "game_attempts" USING btree ("variant");--> statement-breakpoint
CREATE INDEX "game_attempts_user" ON "game_attempts" USING btree ("user_id");--> statement-breakpoint
-- Deny-by-default RLS, same as every other table (the app connects as the owner
-- role, which bypasses it).
ALTER TABLE "game_attempts" ENABLE ROW LEVEL SECURITY;