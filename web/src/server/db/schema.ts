import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

/*
  Tars Trading data model. Money is stored as floating dollars for the
  simulator (this is simulated capital — auditability beats precision here,
  and every mutation goes through the exchange, never raw SQL).
  All timestamps are unix epoch milliseconds.
*/

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
}, (t) => [index("sessions_user").on(t.userId)]);

/** One simulated account per user. Everyone starts with $100,000. */
export const accounts = sqliteTable("accounts", {
  userId: text("user_id").primaryKey().references(() => users.id),
  cash: real("cash").notNull(),
  /** Sum of |position value| at last mark. Derived but cached for speed. */
  equity: real("equity").notNull(),
  dayStartEquity: real("day_start_equity").notNull(),
  dayStamp: text("day_stamp").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const positions = sqliteTable("positions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  qty: real("qty").notNull(),
  avgEntryPrice: real("avg_entry_price").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [index("positions_user").on(t.userId)]);

export type OrderStatus = "accepted" | "filled" | "canceled" | "rejected";
export type OrderSide = "buy" | "sell";
export type OrderType = "market" | "limit" | "stop";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  side: text("side").$type<OrderSide>().notNull(),
  type: text("type").$type<OrderType>().notNull(),
  qty: real("qty").notNull(),
  limitPrice: real("limit_price"),
  stopPrice: real("stop_price"),
  status: text("status").$type<OrderStatus>().notNull(),
  filledPrice: real("filled_price"),
  filledAt: integer("filled_at"),
  /** Set when an agent placed this order — every agent action is tagged. */
  agentId: text("agent_id"),
  rejectReason: text("reject_reason"),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("orders_user").on(t.userId), index("orders_status").on(t.status)]);

export const watchlistItems = sqliteTable("watchlist_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  rank: integer("rank").notNull(),
}, (t) => [index("watchlist_user").on(t.userId)]);

/** Agents run exactly the rules the user programs — nothing hidden. */
export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🤖"),
  /** JSON: { universe: string[], entry: Rule[], exit: Rule[] } */
  strategy: text("strategy").notNull(),
  allocation: real("allocation").notNull(),
  /** Max drawdown fraction (e.g. 0.15) before auto-halt. */
  maxDrawdown: real("max_drawdown").notNull().default(0.2),
  status: text("status").$type<"draft" | "backtested" | "running" | "paused" | "killed">().notNull(),
  /** JSON backtest result — an agent must pass an honest backtest to run. */
  backtest: text("backtest"),
  /** Peak book value reached while running — drives drawdown-FROM-PEAK. */
  peakValue: real("peak_value"),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("agents_user").on(t.userId)]);

export const agentActivity = sqliteTable("agent_activity", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  agentId: text("agent_id").notNull().references(() => agents.id),
  agentName: text("agent_name").notNull(),
  text: text("text").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("activity_user").on(t.userId)]);

export const equityHistory = sqliteTable("equity_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  time: integer("time").notNull(),
  equity: real("equity").notNull(),
}, (t) => [index("equity_user_time").on(t.userId, t.time)]);

export const journalEntries = sqliteTable("journal_entries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  qty: real("qty").notNull(),
  entryPrice: real("entry_price").notNull(),
  exitPrice: real("exit_price"),
  pnl: real("pnl"),
  thesis: text("thesis"),
  agentId: text("agent_id"),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("journal_user").on(t.userId)]);

export const lessonProgress = sqliteTable("lesson_progress", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  lessonId: text("lesson_id").notNull(),
  completedAt: integer("completed_at").notNull(),
  xp: integer("xp").notNull(),
}, (t) => [index("progress_user").on(t.userId)]);

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role").$type<"user" | "tars">().notNull(),
  text: text("text").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("chat_user_time").on(t.userId, t.createdAt)]);

/** Tars's long-term memory of each trader: a distilled, evolving summary. */
export const tarsMemory = sqliteTable("tars_memory", {
  userId: text("user_id").primaryKey().references(() => users.id),
  summary: text("summary").notNull(),
  messageCount: integer("message_count").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const priceAlerts = sqliteTable("price_alerts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  /** Fire when price crosses this level in `direction`. */
  price: real("price").notNull(),
  direction: text("direction").$type<"above" | "below">().notNull(),
  triggeredAt: integer("triggered_at"),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("alerts_user").on(t.userId)]);
