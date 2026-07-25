ALTER TABLE "orders" ADD COLUMN "trail_percent" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "trail_anchor" double precision;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "triggered" integer DEFAULT 0 NOT NULL;