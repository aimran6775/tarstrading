CREATE TABLE "admin_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"detail" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_calls" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"endpoint" text NOT NULL,
	"status" integer NOT NULL,
	"ms" integer NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bars" (
	"symbol" text NOT NULL,
	"timeframe" text NOT NULL,
	"t" bigint NOT NULL,
	"o" double precision NOT NULL,
	"h" double precision NOT NULL,
	"l" double precision NOT NULL,
	"c" double precision NOT NULL,
	"v" double precision NOT NULL,
	CONSTRAINT "bars_symbol_timeframe_t_pk" PRIMARY KEY("symbol","timeframe","t")
);
--> statement-breakpoint
CREATE TABLE "cron_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"users" integer DEFAULT 0 NOT NULL,
	"actions" integer DEFAULT 0 NOT NULL,
	"ms" integer NOT NULL,
	"ok" integer DEFAULT 1 NOT NULL,
	"detail" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_history" (
	"symbol" text NOT NULL,
	"t" bigint NOT NULL,
	"price" double precision NOT NULL,
	CONSTRAINT "quote_history_symbol_t_pk" PRIMARY KEY("symbol","t")
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" text NOT NULL,
	"earliest" bigint,
	"latest" bigint,
	"bar_count" integer DEFAULT 0 NOT NULL,
	"last_sync_at" bigint,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_time" ON "admin_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "api_calls_time" ON "api_calls" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bars_series" ON "bars" USING btree ("symbol","timeframe","t");--> statement-breakpoint
CREATE INDEX "cron_time" ON "cron_runs" USING btree ("created_at");--> statement-breakpoint
-- RLS: deny-by-default for the public PostgREST roles; app's owner role bypasses.
ALTER TABLE "bars" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "api_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_audit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cron_runs" ENABLE ROW LEVEL SECURITY;
