CREATE TABLE "tickers" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'CS' NOT NULL,
	"exchange" text,
	"active" integer DEFAULT 1 NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tickers_name" ON "tickers" USING btree ("name");--> statement-breakpoint
ALTER TABLE "tickers" ENABLE ROW LEVEL SECURITY;
