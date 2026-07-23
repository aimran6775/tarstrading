CREATE TABLE "mission_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mission_id" text NOT NULL,
	"completed_at" bigint NOT NULL,
	"xp" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mission_progress" ADD CONSTRAINT "mission_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_progress_user" ON "mission_progress" USING btree ("user_id");--> statement-breakpoint
-- Deny-by-default RLS, same as every other table.
ALTER TABLE "mission_progress" ENABLE ROW LEVEL SECURITY;