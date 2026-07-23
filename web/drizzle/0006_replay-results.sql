CREATE TABLE "replay_results" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scenario_id" text NOT NULL,
	"player_return" double precision NOT NULL,
	"buy_hold_return" double precision NOT NULL,
	"completed_at" bigint NOT NULL,
	"xp" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "replay_results" ADD CONSTRAINT "replay_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "replay_results_user" ON "replay_results" USING btree ("user_id");--> statement-breakpoint
-- Deny-by-default RLS.
ALTER TABLE "replay_results" ENABLE ROW LEVEL SECURITY;
