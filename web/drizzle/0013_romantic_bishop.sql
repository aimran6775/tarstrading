CREATE TABLE "platform_symbols" (
	"symbol" text PRIMARY KEY NOT NULL,
	"category" text DEFAULT 'stocks' NOT NULL,
	"rank" integer DEFAULT 100 NOT NULL,
	"featured" integer DEFAULT 0 NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	"note" text,
	"added_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "psym_enabled" ON "platform_symbols" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "psym_category" ON "platform_symbols" USING btree ("category");