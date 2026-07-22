import { pgTable, text, integer, bigint, doublePrecision, index } from "drizzle-orm/pg-core";

/*
  Tars Trading data model — Postgres (Supabase).

  Two deliberate type choices carried over from the SQLite phase:
  - Money and quantities are `double precision`. This is SIMULATED capital;
    every mutation goes through the exchange, never raw SQL, and floats keep
    all the arithmetic in the app as plain JS numbers (no string-decimal
    churn). If this ever settles real money, move these to `numeric`.
  - Timestamps are unix epoch MILLISECONDS in `bigint` (mode: number). ms
    overflows int32, and values stay well under 2^53 so JS numbers are exact.
*/

/** Epoch-milliseconds column as a JS number. */
const epochMs = (name: string) => bigint(name, { mode: "number" });

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: epochMs("created_at").notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: epochMs("expires_at").notNull(),
}, (t) => [index("sessions_user").on(t.userId)]);

/** One simulated account per user. Everyone starts with $100,000. */
export const accounts = pgTable("accounts", {
  userId: text("user_id").primaryKey().references(() => users.id),
  cash: doublePrecision("cash").notNull(),
  /** Sum of |position value| at last mark. Derived but cached for speed. */
  equity: doublePrecision("equity").notNull(),
  dayStartEquity: doublePrecision("day_start_equity").notNull(),
  dayStamp: text("day_stamp").notNull(),
  createdAt: epochMs("created_at").notNull(),
});

export const positions = pgTable("positions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  qty: doublePrecision("qty").notNull(),
  avgEntryPrice: doublePrecision("avg_entry_price").notNull(),
  updatedAt: epochMs("updated_at").notNull(),
}, (t) => [index("positions_user").on(t.userId)]);

export type OrderStatus = "accepted" | "filled" | "canceled" | "rejected";
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop";

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  side: text("side").$type<OrderSide>().notNull(),
  type: text("type").$type<OrderType>().notNull(),
  qty: doublePrecision("qty").notNull(),
  limitPrice: doublePrecision("limit_price"),
  stopPrice: doublePrecision("stop_price"),
  status: text("status").$type<OrderStatus>().notNull(),
  filledPrice: doublePrecision("filled_price"),
  filledAt: epochMs("filled_at"),
  /** Set when an agent placed this order — every agent action is tagged. */
  agentId: text("agent_id"),
  rejectReason: text("reject_reason"),
  createdAt: epochMs("created_at").notNull(),
}, (t) => [index("orders_user").on(t.userId), index("orders_status").on(t.status)]);

export const watchlistItems = pgTable("watchlist_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  rank: integer("rank").notNull(),
}, (t) => [index("watchlist_user").on(t.userId)]);

/** Agents run exactly the rules the user programs — nothing hidden. */
export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🤖"),
  /** JSON: { universe: string[], entry: Rule[], exit: Rule[] } */
  strategy: text("strategy").notNull(),
  allocation: doublePrecision("allocation").notNull(),
  /** Max drawdown fraction (e.g. 0.15) before auto-halt. */
  maxDrawdown: doublePrecision("max_drawdown").notNull().default(0.2),
  status: text("status").$type<"draft" | "backtested" | "running" | "paused" | "killed">().notNull(),
  /** JSON backtest result — an agent must pass an honest backtest to run. */
  backtest: text("backtest"),
  /** Peak book value reached while running — drives drawdown-FROM-PEAK. */
  peakValue: doublePrecision("peak_value"),
  createdAt: epochMs("created_at").notNull(),
}, (t) => [index("agents_user").on(t.userId)]);

export const agentActivity = pgTable("agent_activity", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  agentId: text("agent_id").notNull().references(() => agents.id),
  agentName: text("agent_name").notNull(),
  text: text("text").notNull(),
  createdAt: epochMs("created_at").notNull(),
}, (t) => [index("activity_user").on(t.userId)]);

export const equityHistory = pgTable("equity_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  time: epochMs("time").notNull(),
  equity: doublePrecision("equity").notNull(),
}, (t) => [index("equity_user_time").on(t.userId, t.time)]);

export const journalEntries = pgTable("journal_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  qty: doublePrecision("qty").notNull(),
  entryPrice: doublePrecision("entry_price").notNull(),
  exitPrice: doublePrecision("exit_price"),
  pnl: doublePrecision("pnl"),
  thesis: text("thesis"),
  agentId: text("agent_id"),
  createdAt: epochMs("created_at").notNull(),
}, (t) => [index("journal_user").on(t.userId)]);

export const lessonProgress = pgTable("lesson_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  lessonId: text("lesson_id").notNull(),
  completedAt: epochMs("completed_at").notNull(),
  xp: integer("xp").notNull(),
}, (t) => [index("progress_user").on(t.userId)]);

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role").$type<"user" | "tars">().notNull(),
  text: text("text").notNull(),
  createdAt: epochMs("created_at").notNull(),
}, (t) => [index("chat_user_time").on(t.userId, t.createdAt)]);

/** Tars's long-term memory of each trader: a distilled, evolving summary. */
export const tarsMemory = pgTable("tars_memory", {
  userId: text("user_id").primaryKey().references(() => users.id),
  summary: text("summary").notNull(),
  messageCount: integer("message_count").notNull().default(0),
  updatedAt: epochMs("updated_at").notNull(),
});

/** Shared L2 quote cache — one row per symbol, read by every instance so
    upstream (Massive) is hit at most once per symbol per TTL, fleet-wide. */
export const quoteCache = pgTable("quote_cache", {
  symbol: text("symbol").primaryKey(),
  price: doublePrecision("price").notNull(),
  previousClose: doublePrecision("previous_close").notNull(),
  changePercent: doublePrecision("change_percent").notNull(),
  asOf: epochMs("as_of").notNull(),
  updatedAt: epochMs("updated_at").notNull(),
});

/** Cross-instance rate-limit buckets (auth throttle). Keyed by e.g.
    "login:<ip>"; the app upserts atomically so serverless instances share it. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: epochMs("reset_at").notNull(),
});

export const priceAlerts = pgTable("price_alerts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  /** Fire when price crosses this level in `direction`. */
  price: doublePrecision("price").notNull(),
  direction: text("direction").$type<"above" | "below">().notNull(),
  triggeredAt: epochMs("triggered_at"),
  createdAt: epochMs("created_at").notNull(),
}, (t) => [index("alerts_user").on(t.userId)]);
