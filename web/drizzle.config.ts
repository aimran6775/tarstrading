import { defineConfig } from "drizzle-kit";

/*
  drizzle-kit config for schema management against Supabase Postgres.
  DATABASE_URL is sourced from the environment (see .env.local); load it
  before running, e.g.  `set -a; . ./.env.local; set +a; npx drizzle-kit push`.
  Migrations use the DIRECT/session connection, not the transaction pooler,
  so DDL runs on a real session — DATABASE_URL points at the pooler for the
  app, and we accept it for push here too (drizzle-kit issues plain DDL).
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
