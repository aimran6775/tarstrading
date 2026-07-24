import "server-only";
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "crypto";
import { cache } from "react";
import { db, schema } from "./db";
import { eq, and, gt, lt, sql } from "drizzle-orm";
import { etDay } from "./market";

/*
  Auth: scrypt-hashed passwords + opaque session tokens in an httpOnly cookie.
  No third-party auth service — the simulator holds no real money and no
  sensitive financial data, but we still treat credentials properly.
  Every new user's account is seeded with $100,000 simulated.
*/

const SESSION_COOKIE = "tars_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const STARTING_CASH = 100_000;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  // Guard the length (corruption/migration) so timingSafeEqual can't throw.
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

// A throwaway hash so a login for a non-existent email still does scrypt work,
// removing the timing oracle that reveals which emails are registered.
const DUMMY_HASH = hashPassword("tars-decoy-password");

export async function createUser(email: string, name: string, password: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("invalid-email");
  if (password.length < 8) throw new Error("weak-password");
  if (!name.trim()) throw new Error("missing-name");

  const [existing] = await db.select().from(schema.users)
    .where(eq(schema.users.email, normalized));
  if (existing) throw new Error("email-taken");

  const now = Date.now();
  const userId = randomUUID();
  await db.insert(schema.users).values({
    id: userId, email: normalized, name: name.trim(),
    passwordHash: hashPassword(password), createdAt: now,
  });

  // The $100k moment: every new trader starts with the same simulated stake.
  await db.insert(schema.accounts).values({
    userId, cash: STARTING_CASH, equity: STARTING_CASH,
    dayStartEquity: STARTING_CASH,
    dayStamp: etDay(),
    createdAt: now,
  });

  const defaults = ["AAPL", "NVDA", "TSLA", "SPY", "BTC/USD", "ETH/USD"];
  await db.insert(schema.watchlistItems).values(
    defaults.map((symbol, rank) => ({ id: randomUUID(), userId, symbol, rank })),
  );

  await db.insert(schema.equityHistory)
    .values({ id: randomUUID(), userId, time: now, equity: STARTING_CASH });

  return userId;
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.insert(schema.sessions).values({
    id: token, userId, expiresAt: Date.now() + SESSION_TTL_MS,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000, path: "/",
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = { id: string; email: string; name: string; role: "user" | "admin" };

// Request-memoized: a page + its layout + several server components all call
// currentUser() in one render; cache() collapses that to a single session join.
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db.select({
    id: schema.users.id, email: schema.users.email, name: schema.users.name,
    role: schema.users.role,
  })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, token), gt(schema.sessions.expiresAt, Date.now())))
    .limit(1);
  return row ?? null;
});

// ---- admin ----
// Admins are bootstrapped from ADMIN_EMAILS (comma-separated, case-insensitive):
// on every login, a matching account is promoted. No self-serve path to admin.
function adminEmails(): Set<string> {
  return new Set((process.env.ADMIN_EMAILS ?? "")
    .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export async function currentAdmin(): Promise<SessionUser | null> {
  const user = await currentUser();
  if (!user) return null;
  if (user.role === "admin") return user;
  // Bootstrap: whitelisted email that hasn't been promoted yet.
  if (adminEmails().has(user.email.toLowerCase())) {
    await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, user.id));
    return { ...user, role: "admin" };
  }
  return null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("unauthorized");
  return user;
}

export async function loginWithPassword(email: string, password: string): Promise<string> {
  const [user] = await db.select().from(schema.users)
    .where(eq(schema.users.email, email.trim().toLowerCase()));
  // Always run a scrypt comparison — constant work whether or not the email
  // exists — so response time doesn't leak account membership.
  const ok = verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new Error("bad-credentials");
  return user.id;
}

// ---- cross-instance auth throttle (per key: IP or email) ----
// Backed by Postgres so it holds across serverless instances, where an
// in-memory Map would be per-instance and barely throttle at all. One atomic
// upsert per check: within the window count increments; past it, the bucket
// resets. Returns true if the attempt is ALLOWED.
export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  try {
    const [row] = await db.insert(schema.rateLimits)
      .values({ key, count: 1, resetAt: now + windowMs })
      .onConflictDoUpdate({
        target: schema.rateLimits.key,
        set: {
          count: sql`case when ${schema.rateLimits.resetAt} <= ${now} then 1 else ${schema.rateLimits.count} + 1 end`,
          resetAt: sql`case when ${schema.rateLimits.resetAt} <= ${now} then ${now + windowMs} else ${schema.rateLimits.resetAt} end`,
        },
      })
      .returning({ count: schema.rateLimits.count });
    return (row?.count ?? 1) <= max;
  } catch {
    // Fail OPEN: a DB blip shouldn't lock every user out of signing in.
    return true;
  }
}

/** Sweep expired sessions — called opportunistically on login. */
export async function purgeExpiredSessions() {
  await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, Date.now()));
}
