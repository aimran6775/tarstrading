-- The free-feeds mesh: every price knows where it came from.
--
-- quote_cache.source is the provenance tag ('live' | 'delayed' | 'eod' |
-- 'derived' | 'indicative') that flows through to the UI badges — the same
-- honesty principle as the PAPER banner, applied to data. Default 'eod'
-- matches what every existing row actually is (a Massive prev-day close).
--
-- feed_status is the console's per-source health board: one row per feed
-- (sweep, fx, indices, futures, live-slots) with its last run and coverage.

ALTER TABLE "quote_cache" ADD COLUMN "source" text NOT NULL DEFAULT 'eod';--> statement-breakpoint
CREATE TABLE "feed_status" (
	"source" text PRIMARY KEY NOT NULL,
	"last_run_at" bigint,
	"ok" integer NOT NULL DEFAULT 1,
	"covered" integer NOT NULL DEFAULT 0,
	"detail" text
);--> statement-breakpoint
ALTER TABLE "feed_status" ENABLE ROW LEVEL SECURITY;
