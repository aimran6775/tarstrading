import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { and, desc, eq, gt, isNull, lt, sql as dsql } from "drizzle-orm";

/*
  Notifications — what the platform tells you about while you weren't looking.

  Before this, a fill at 3am, a margin call, an analyst halting itself and a
  platform-wide trading halt all happened in total silence: the only way to
  learn was to open the page and infer it from a number that had changed.
  For a product whose whole claim is transparency, that was the largest
  honesty gap left.

  Deliberately simple: rows in a table, read state per row, polled with the
  data the app already fetches. No push, no email, no third party — those
  are consent decisions, and this platform doesn't have permission to reach
  into anyone's inbox.
*/

export type NotifyKind = "fill" | "margin" | "analyst" | "alert" | "system";

/** Record one notification. Never throws — a notice that fails to save must
    not roll back the trade or settlement that produced it. */
export async function notify(
  userId: string,
  kind: NotifyKind,
  title: string,
  opts: { body?: string; href?: string } = {},
): Promise<void> {
  try {
    await db.insert(schema.notifications).values({
      id: randomUUID(), userId, kind, title,
      body: opts.body ?? null, href: opts.href ?? null,
      readAt: null, createdAt: Date.now(),
    });
  } catch { /* the ledger is the source of truth; this is only the telling */ }
}

/** Recent notifications plus the unread count for the bell. */
export async function recentNotifications(userId: string, limit = 30) {
  const rows = await db.select().from(schema.notifications)
    .where(eq(schema.notifications.userId, userId))
    .orderBy(desc(schema.notifications.createdAt)).limit(limit);
  const [unread] = await db.select({ n: dsql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
  return { rows, unread: unread?.n ?? 0 };
}

export async function markAllRead(userId: string): Promise<void> {
  await db.update(schema.notifications).set({ readAt: Date.now() })
    .where(and(eq(schema.notifications.userId, userId), isNull(schema.notifications.readAt)));
}

/*
  The "since you left" digest. Reads what happened after lastSeenAt, then
  stamps the new visit. Returns null for a first visit or a quick return —
  a digest that fires every page load is noise, not news.
*/
export type Digest = {
  since: number;
  fills: number;
  notices: Array<{ kind: string; title: string; createdAt: number }>;
};

export async function sinceYouLeft(userId: string): Promise<Digest | null> {
  const [user] = await db.select({ lastSeenAt: schema.users.lastSeenAt })
    .from(schema.users).where(eq(schema.users.id, userId));
  const now = Date.now();
  const since = user?.lastSeenAt ?? 0;
  // Always stamp the visit, even when we return nothing.
  await db.update(schema.users).set({ lastSeenAt: now })
    .where(eq(schema.users.id, userId)).catch(() => {});
  // Under an hour away is not "away".
  if (!since || now - since < 3600_000) return null;

  const notices = await db.select().from(schema.notifications)
    .where(and(eq(schema.notifications.userId, userId), gt(schema.notifications.createdAt, since)))
    .orderBy(desc(schema.notifications.createdAt)).limit(8);
  const [filled] = await db.select({ n: dsql<number>`count(*)::int` })
    .from(schema.orders)
    .where(and(eq(schema.orders.userId, userId), eq(schema.orders.status, "filled"),
      gt(schema.orders.createdAt, since)));
  const fills = filled?.n ?? 0;
  if (!notices.length && !fills) return null;
  return {
    since, fills,
    notices: notices.map((n) => ({ kind: n.kind, title: n.title, createdAt: n.createdAt })),
  };
}

/** Retention: notifications are news, not an archive. Keep 30 days. */
export async function purgeOldNotifications(): Promise<void> {
  await db.delete(schema.notifications)
    .where(lt(schema.notifications.createdAt, Date.now() - 30 * 86_400_000))
    .catch(() => {});
}
