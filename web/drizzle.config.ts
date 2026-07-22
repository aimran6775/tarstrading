import { defineConfig } from "drizzle-kit";

/*
  drizzle-kit config for schema management against Supabase Postgres.
  DATABASE_URL is sourced from the environment (see .env.local); load it with
  `set -a; . ./.env.local; set +a` first. Use the SESSION pooler (port 5432)
  for migration commands.

  WORKFLOW: `db:generate` then `db:migrate`. Migrations carry the RLS lockdown
  (drizzle/0000_baseline.sql), so a fresh deploy is secure from step one.

  ⚠️  DO NOT run `drizzle-kit push` against a real database. RLS is not part of
  the Drizzle schema, so push treats enabled RLS as drift and DISABLES it —
  silently reopening the public REST data leak. If you ever must push, re-run
  db/enable-rls.sql immediately afterward.
*/
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
