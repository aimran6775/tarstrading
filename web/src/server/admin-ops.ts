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
  const [positions, orders, agents, journal, sessions, academy, counts] = await Promise.all([
    db.select().from(schema.positions).where(eq(schema.positions.userId, userId)),
    db.select().from(schema.orders).where(eq(schema.orders.userId, userId)).orderBy(desc(schema.orders.createdAt)).limit(12),
    db.select().from(schema.agents).where(eq(schema.agents.userId, userId)),
    db.select().from(schema.journalEntries).where(eq(schema.journalEntries.userId, userId)).orderBy(desc(schema.journalEntries.createdAt)).limit(12),
    db.select({ count: dsql<number>`count(*)::int` }).from(schema.sessions).where(and(eq(schema.sessions.userId, userId))),
    getAcademyProgress(userId),
    db.execute<{ trades: number; alerts: number; missions: number }>(dsql`
      select
        (select count(*)::int from journal_entries where user_id = ${userId} and pnl is not null) as trades,
        (select count(*)::int from price_alerts where user_id = ${userId}) as alerts,
        (select count(*)::int from mission_progress where user_id = ${userId}) as missions
    `),
  ]);
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, suspended: !!user.suspended, createdAt: user.createdAt },
    account, positions, orders, agents, journal,
    sessions: sessions[0]?.count ?? 0,
    academy: { lessonsDone: academy.lessonsDone, totalLessons: academy.totalLessons, xp: academy.xp, stagesCleared: academy.stagesCleared },
    counts: counts[0] ?? { trades: 0, alerts: 0, missions: 0 },
  };
}
