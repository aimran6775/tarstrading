import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { and, desc, eq, sql as dsql } from "drizzle-orm";
import { STARTING_CASH } from "./auth";
import { etDay } from "./market";
import { getAcademyProgress } from "./academy-progress";

/*
  The write side of the admin control-center. Every mutation here is scoped to a
  target user, performed by a verified admin (the routes guard with
  currentAdmin), and recorded in admin_audit. No arbitrary money levers — the
  strongest account action is a clean reset to the same $100k everyone starts
  with, so the leaderboard stays fair.
*/

export async function audit(adminId: string, action: string, detail?: unknown): Promise<void> {
  await db.insert(schema.adminAudit).values({
    id: randomUUID(), userId: adminId, action,
    detail: detail == null ? null : (typeof detail === "string" ? detail : JSON.stringify(detail)),
    createdAt: Date.now(),
  }).catch(() => { /* auditing must never break the action it records */ });
}

/** Suspend or restore a user; suspending also revokes their live sessions. */
export async function setSuspended(adminId: string, userId: string, suspended: boolean): Promise<void> {
  await db.update(schema.users).set({ suspended: suspended ? 1 : 0 }).where(eq(schema.users.id, userId));
  if (suspended) await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  await audit(adminId, suspended ? "user.suspend" : "user.restore", { userId });
}

/** Promote to admin or demote to user. */
export async function setRole(adminId: string, userId: string, role: "user" | "admin"): Promise<void> {
  await db.update(schema.users).set({ role }).where(eq(schema.users.id, userId));
  await audit(adminId, role === "admin" ? "user.promote" : "user.demote", { userId });
}

/** Sign a user out everywhere (revoke sessions) without suspending them. */
export async function forceLogout(adminId: string, userId: string): Promise<void> {
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
  await audit(adminId, "user.force_logout", { userId });
}

/** Correct a user's name and/or email. Email is unique — a clash throws
    "email_taken" for the route to translate. Empty fields are ignored. */
export async function editUser(
  adminId: string, userId: string, patch: { name?: string; email?: string },
): Promise<void> {
  const set: { name?: string; email?: string } = {};
  if (patch.name && patch.name.trim()) set.name = patch.name.trim().slice(0, 80);
  if (patch.email && patch.email.trim()) {
    const email = patch.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("bad_email");
    const [clash] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
    if (clash && clash.id !== userId) throw new Error("email_taken");
    set.email = email;
  }
  if (!set.name && !set.email) return;
  await db.update(schema.users).set(set).where(eq(schema.users.id, userId));
  await audit(adminId, "user.edit", { userId, ...set });
}

/** Set (or clear, with "") the free-text admin note on an account. */
export async function setNote(adminId: string, userId: string, note: string): Promise<void> {
  const clean = note.trim().slice(0, 500);
  await db.update(schema.users).set({ adminNote: clean || null }).where(eq(schema.users.id, userId));
  await audit(adminId, "user.note", { userId, note: clean });
}

/** Permanently delete a user and every row they own — irreversible. Children
    are removed before parents (agent_activity → agents → the rest → users) so
    foreign keys never block. Callers must guarantee userId !== the acting admin. */
export async function deleteUser(adminId: string, userId: string): Promise<void> {
  // Snapshot identity for the audit trail before the row is gone.
  const [victim] = await db.select({ email: schema.users.email, name: schema.users.name })
    .from(schema.users).where(eq(schema.users.id, userId));
  await db.transaction(async (tx) => {
    // agent_activity references agents.id, so it must go first.
    await tx.delete(schema.agentActivity).where(eq(schema.agentActivity.userId, userId));
    await tx.delete(schema.agents).where(eq(schema.agents.userId, userId));
    for (const t of [
      schema.positions, schema.orders, schema.watchlistItems, schema.equityHistory,
      schema.journalEntries, schema.lessonProgress, schema.quizAttempts, schema.practiceStreaks,
      schema.cardReviews, schema.replayResults, schema.missionProgress, schema.gameAttempts,
      schema.chatMessages, schema.agentChats, schema.tarsMemory, schema.priceAlerts,
      schema.sessions, schema.accounts, schema.adminAudit,
    ]) {
      await tx.delete(t).where(eq(t.userId, userId));
    }
    await tx.delete(schema.users).where(eq(schema.users.id, userId));
  });
  await audit(adminId, "user.delete", { userId, email: victim?.email, name: victim?.name });
}

/*
  Data census — a live count of every table we hold, grouped by domain. This is
  the "can we see everything we have" answer: one row per table, exact counts in
  a single round-trip (a 30-way UNION ALL), so nothing in the schema is dark.
*/
const CENSUS_GROUPS: { group: string; tables: string[] }[] = [
  { group: "Identity & access", tables: ["users", "sessions", "platform_config", "admin_audit"] },
  { group: "Trading book", tables: ["accounts", "positions", "orders", "watchlist_items", "price_alerts", "journal_entries", "equity_history"] },
  { group: "Analyst desk", tables: ["agents", "agent_activity", "agent_chats"] },
  { group: "Assistant", tables: ["chat_messages", "tars_memory"] },
  { group: "Academy", tables: ["lesson_progress", "quiz_attempts", "practice_streaks", "card_reviews", "replay_results", "mission_progress", "game_attempts"] },
  { group: "Market-data vault", tables: ["bars", "quote_history", "quote_cache", "sync_state", "api_calls", "tickers"] },
  { group: "Infrastructure", tables: ["cron_runs", "rate_limits"] },
];

export async function dataCensus() {
  const names = CENSUS_GROUPS.flatMap((g) => g.tables);
  // One query, exact counts: SELECT 'users' t, count(*) n FROM users UNION ALL …
  const union = names.map((n) => `select '${n}'::text as t, count(*)::int as n from "${n}"`).join(" union all ");
  const rows = await db.execute<{ t: string; n: number }>(dsql.raw(union));
  const counts = new Map((rows as unknown as { t: string; n: number }[]).map((r) => [r.t, r.n]));
  const groups = CENSUS_GROUPS.map((g) => ({
    group: g.group,
    tables: g.tables.map((t) => ({ table: t, rows: counts.get(t) ?? 0 })),
    total: g.tables.reduce((s, t) => s + (counts.get(t) ?? 0), 0),
  }));
  const total = groups.reduce((s, g) => s + g.total, 0);
  return { groups, total, tableCount: names.length };
}

/** Wipe a user's trading artifacts and restore the $100k starting sandbox.
    Academy progress and chats are kept — this resets the book, not the person. */
export async function resetSandbox(adminId: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    for (const t of [schema.positions, schema.orders, schema.journalEntries,
      schema.equityHistory, schema.priceAlerts, schema.agentActivity, schema.agents]) {
      await tx.delete(t).where(eq(t.userId, userId));
    }
    await tx.update(schema.accounts).set({
      cash: STARTING_CASH, equity: STARTING_CASH, dayStartEquity: STARTING_CASH, dayStamp: etDay(),
    }).where(eq(schema.accounts.userId, userId));
  });
  await db.insert(schema.equityHistory)
    .values({ id: randomUUID(), userId, time: Date.now(), equity: STARTING_CASH }).catch(() => {});
  await audit(adminId, "user.reset_sandbox", { userId });
}

/** The 360° view for the per-user drill-down. */
export async function userDetail(userId: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) return null;
  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  const [positions, orders, agents, journal, watchlist, streak, sessions, academy, counts] = await Promise.all([
    db.select().from(schema.positions).where(eq(schema.positions.userId, userId)),
    db.select().from(schema.orders).where(eq(schema.orders.userId, userId)).orderBy(desc(schema.orders.createdAt)).limit(12),
    db.select().from(schema.agents).where(eq(schema.agents.userId, userId)),
    db.select().from(schema.journalEntries).where(eq(schema.journalEntries.userId, userId)).orderBy(desc(schema.journalEntries.createdAt)).limit(12),
    db.select().from(schema.watchlistItems).where(eq(schema.watchlistItems.userId, userId)).orderBy(schema.watchlistItems.rank),
    db.select().from(schema.practiceStreaks).where(eq(schema.practiceStreaks.userId, userId)),
    db.select({ count: dsql<number>`count(*)::int` }).from(schema.sessions).where(and(eq(schema.sessions.userId, userId))),
    getAcademyProgress(userId),
    // Every remaining per-user table, counted in one round-trip. Conversation
    // bodies are deliberately NOT read here — counts only, to respect privacy.
    db.execute<{
      trades: number; alerts: number; missions: number; quizzes: number; drills: number;
      cards: number; replays: number; tars_msgs: number; desk_msgs: number; memory: number;
    }>(dsql`
      select
        (select count(*)::int from journal_entries where user_id = ${userId} and pnl is not null) as trades,
        (select count(*)::int from price_alerts    where user_id = ${userId}) as alerts,
        (select count(*)::int from mission_progress where user_id = ${userId}) as missions,
        (select count(*)::int from quiz_attempts    where user_id = ${userId}) as quizzes,
        (select count(*)::int from game_attempts    where user_id = ${userId}) as drills,
        (select count(*)::int from card_reviews     where user_id = ${userId}) as cards,
        (select count(*)::int from replay_results   where user_id = ${userId}) as replays,
        (select count(*)::int from chat_messages    where user_id = ${userId}) as tars_msgs,
        (select count(*)::int from agent_chats      where user_id = ${userId}) as desk_msgs,
        (select count(*)::int from tars_memory      where user_id = ${userId}) as memory
    `),
  ]);
  const c = counts[0] ?? {} as Record<string, number>;
  return {
    user: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      suspended: !!user.suspended, adminNote: user.adminNote ?? "", createdAt: user.createdAt,
    },
    account, positions, orders, agents, journal, watchlist,
    streak: streak[0] ? { current: streak[0].current, longest: streak[0].longest } : { current: 0, longest: 0 },
    sessions: sessions[0]?.count ?? 0,
    academy: { lessonsDone: academy.lessonsDone, totalLessons: academy.totalLessons, xp: academy.xp, stagesCleared: academy.stagesCleared },
    counts: {
      trades: c.trades ?? 0, alerts: c.alerts ?? 0, missions: c.missions ?? 0,
      quizzes: c.quizzes ?? 0, drills: c.drills ?? 0, cards: c.cards ?? 0, replays: c.replays ?? 0,
      tarsMsgs: c.tars_msgs ?? 0, deskMsgs: c.desk_msgs ?? 0, memory: c.memory ?? 0,
    },
  };
}
