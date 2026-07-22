import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

/*
  Dev database: SQLite file next to the app (gitignored). Opened LAZILY on
  first query — never at module import — so build-time page-data collection
  (which imports route modules in parallel workers) doesn't contend for the
  file. WAL is preferred; on filesystems that can't lock properly (exFAT
  external drives) we fall back to rollback journal. Production moves to
  Postgres with generated migrations (Phase 30).
*/

const DB_PATH = process.env.DATABASE_PATH ?? path.join(process.cwd(), ".data", "tars.db");

type DrizzleDb = ReturnType<typeof createDb>;

declare global {
  var __tarsDb: DrizzleDb | undefined;
}

function createDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH, { timeout: 5000 });
  try {
    sqlite.pragma("journal_mode = WAL");
  } catch {
    sqlite.pragma("journal_mode = DELETE");
  }
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  bootstrap(sqlite);
  return drizzle(sqlite, { schema });
}

function bootstrap(sqlite: Database.Database) {
  sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS accounts (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    cash REAL NOT NULL, equity REAL NOT NULL,
    day_start_equity REAL NOT NULL, day_stamp TEXT NOT NULL,
    created_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    symbol TEXT NOT NULL, qty REAL NOT NULL, avg_entry_price REAL NOT NULL,
    updated_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS positions_user ON positions(user_id);
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    symbol TEXT NOT NULL, side TEXT NOT NULL, type TEXT NOT NULL,
    qty REAL NOT NULL, limit_price REAL, stop_price REAL,
    status TEXT NOT NULL, filled_price REAL, filled_at INTEGER,
    agent_id TEXT, reject_reason TEXT, created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
  CREATE TABLE IF NOT EXISTS watchlist_items (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    symbol TEXT NOT NULL, rank INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS watchlist_user ON watchlist_items(user_id);
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL, emoji TEXT NOT NULL DEFAULT '🤖',
    strategy TEXT NOT NULL, allocation REAL NOT NULL,
    max_drawdown REAL NOT NULL DEFAULT 0.2,
    status TEXT NOT NULL, backtest TEXT, created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS agents_user ON agents(user_id);
  CREATE TABLE IF NOT EXISTS agent_activity (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    agent_id TEXT NOT NULL REFERENCES agents(id), agent_name TEXT NOT NULL,
    text TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS activity_user ON agent_activity(user_id);
  CREATE TABLE IF NOT EXISTS equity_history (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    time INTEGER NOT NULL, equity REAL NOT NULL);
  CREATE INDEX IF NOT EXISTS equity_user_time ON equity_history(user_id, time);
  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    symbol TEXT NOT NULL, side TEXT NOT NULL, qty REAL NOT NULL,
    entry_price REAL NOT NULL, exit_price REAL, pnl REAL,
    thesis TEXT, agent_id TEXT, created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS journal_user ON journal_entries(user_id);
  CREATE TABLE IF NOT EXISTS lesson_progress (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    lesson_id TEXT NOT NULL, completed_at INTEGER NOT NULL, xp INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS progress_user ON lesson_progress(user_id);
  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS chat_user_time ON chat_messages(user_id, created_at);
  CREATE TABLE IF NOT EXISTS tars_memory (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    summary TEXT NOT NULL, message_count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL);
  `);
}

function getDb(): DrizzleDb {
  return (globalThis.__tarsDb ??= createDb());
}

/** Lazy proxy: the underlying database opens on first property access. */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
