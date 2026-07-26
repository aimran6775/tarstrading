CREATE TABLE "pe_cashflows" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"commitment_id" text NOT NULL,
	"kind" text NOT NULL,
	"amount" double precision NOT NULL,
	"quarter" integer NOT NULL,
	"note" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pe_commitments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"fund_id" text NOT NULL,
	"committed" double precision NOT NULL,
	"called" double precision DEFAULT 0 NOT NULL,
	"distributed" double precision DEFAULT 0 NOT NULL,
	"nav" double precision DEFAULT 0 NOT NULL,
	"quarters" integer DEFAULT 0 NOT NULL,
	"outcome_multiple" double precision NOT NULL,
	"status" text DEFAULT 'investing' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pe_funds" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"strategy" text NOT NULL,
	"vintage" integer NOT NULL,
	"term_years" integer DEFAULT 10 NOT NULL,
	"mgmt_fee" double precision DEFAULT 0.02 NOT NULL,
	"carry" double precision DEFAULT 0.2 NOT NULL,
	"hurdle" double precision DEFAULT 0.08 NOT NULL,
	"target_multiple" double precision DEFAULT 2.2 NOT NULL,
	"volatility" double precision DEFAULT 0.35 NOT NULL,
	"min_commitment" double precision DEFAULT 25000 NOT NULL,
	"blurb" text,
	"enabled" integer DEFAULT 1 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pe_cashflows" ADD CONSTRAINT "pe_cashflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pe_cashflows" ADD CONSTRAINT "pe_cashflows_commitment_id_pe_commitments_id_fk" FOREIGN KEY ("commitment_id") REFERENCES "public"."pe_commitments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pe_commitments" ADD CONSTRAINT "pe_commitments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pe_commitments" ADD CONSTRAINT "pe_commitments_fund_id_pe_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."pe_funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pe_flows_user" ON "pe_cashflows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pe_flows_commit" ON "pe_cashflows" USING btree ("commitment_id");--> statement-breakpoint
CREATE INDEX "pe_commit_user" ON "pe_commitments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pe_funds_enabled" ON "pe_funds" USING btree ("enabled");