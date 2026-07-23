CREATE TABLE "agent_chats" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_chats" ADD CONSTRAINT "agent_chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_chats_user_time" ON "agent_chats" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "agent_chats" ENABLE ROW LEVEL SECURITY;
