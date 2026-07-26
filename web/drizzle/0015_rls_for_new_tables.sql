-- RLS for the four tables that shipped without it.
--
-- Every other table gets ENABLE ROW LEVEL SECURITY in its own migration, but
-- platform_symbols (0013) and the three private-markets tables (0014) were
-- added without one. Supabase grants anon/authenticated access to `public`, so
-- until now anyone holding the public anon key could read every user's
-- commitments and cash flows — user_id-keyed financial records — and rewrite
-- the curated house board the product reads.
--
-- The app connects with a privileged role and enforces ownership in code, so
-- enabling RLS with no permissive policy closes the public door without
-- changing application behaviour.

ALTER TABLE "platform_symbols" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pe_funds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pe_commitments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pe_cashflows" ENABLE ROW LEVEL SECURITY;
