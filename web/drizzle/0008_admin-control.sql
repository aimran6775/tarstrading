CREATE TABLE "platform_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_by" text,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_config" ENABLE ROW LEVEL SECURITY;
