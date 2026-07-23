import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/*
  Postgres (Supabase) client. The schema is owned by drizzle-kit migrations,
  not created here. Opened LAZILY as a global singleton so Next's dev HMR and
  parallel route workers reuse ONE connection pool instead of leaking one per
  reload.

  DATABASE_URL points at Supabase's connection pooler (port 6543, transaction
  mode). Transaction-mode pooling can't hold server-side prepared statements,
  so `prepare: false` is required — postgres-js falls back to simple/extended
  protocol per query. `max` is kept small because the pooler multiplexes.
*/

const connectionString = process.env.DATABASE_URL;

type DrizzleDb = ReturnType<typeof createDb>;

declare global {
  var __tarsSql: ReturnType<typeof postgres> | undefined;
  var __tarsDb: DrizzleDb | undefined;
}

function createDb() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your Supabase Postgres connection " +
      "pooler URL (Project → Settings → Database → Connection pooling, Transaction mode).",
    );
  }
  const sql = globalThis.__tarsSql ??= postgres(connectionString, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    // Recycle sockets before the pooler can silently drop them — a query on a
    // half-dead connection hangs forever, which reads as a stuck page.
    max_lifetime: 10 * 60,
    connect_timeout: 10,
    ssl: "require",
  });
  return drizzle(sql, { schema });
}

function getDb(): DrizzleDb {
  return (globalThis.__tarsDb ??= createDb());
}

/** Lazy proxy: the pool opens on first property access, never at import. */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
