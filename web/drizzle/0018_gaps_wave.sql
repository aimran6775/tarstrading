-- The 50-gap wave's schema. One migration, five concerns:
--
-- 1. Margin calls (gap 1): a Reg-T maintenance breach is a STATE, not an
--    instant liquidation. Real desks warn, give you sessions to cure, and
--    only then force. accounts.margin_call_at stamps when the breach began.
-- 2. Notifications (gap 28): fills, halts, margin calls and analyst actions
--    currently happen in silence. One table, read state per row.
-- 3. Last seen (gap 28): powers the "since you left" digest.
-- 4. Console re-auth (gap 48): destructive operator actions re-confirm.
-- 5. Watchdog (gap 45): feed_status already carries last_run_at; the alarm
--    reads it — no new column needed.

ALTER TABLE "accounts" ADD COLUMN "margin_call_at" bigint;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" bigint;--> statement-breakpoint

CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"read_at" bigint,
	"created_at" bigint NOT NULL
);--> statement-breakpoint
CREATE INDEX "notif_user" ON "notifications" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
