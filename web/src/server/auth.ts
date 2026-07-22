import "server-only";
import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "crypto";
import { db, schema } from "./db";
import { eq, and, gt } from "drizzle-orm";

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
  return timingSafeEqual(candidate, Buffer.from(hash, "hex"));
}

export async function createUser(email: string, name: string, password: string) {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("invalid-email");
  if (password.length < 8) throw new Error("weak-password");
  if (!name.trim()) throw new Error("missing-name");

  const existing = db.select().from(schema.users)
    .where(eq(schema.users.email, normalized)).get();
  if (existing) throw new Error("email-taken");

  const now = Date.now();
  const userId = randomUUID();
  db.insert(schema.users).values({
    id: userId, email: normalized, name: name.trim(),
    passwordHash: hashPassword(password), createdAt: now,
  }).run();

  // The $100k moment: every new trader starts with the same simulated stake.
  db.insert(schema.accounts).values({
    userId, cash: STARTING_CASH, equity: STARTING_CASH,
    dayStartEquity: STARTING_CASH,
    dayStamp: new Date().toISOString().slice(0, 10),
    createdAt: now,
  }).run();

  const defaults = ["AAPL", "NVDA", "TSLA", "SPY", "BTC/USD", "ETH/USD"];
  defaults.forEach((symbol, rank) => {
    db.insert(schema.watchlistItems)
      .values({ id: randomUUID(), userId, symbol, rank }).run();
  });

  db.insert(schema.equityHistory)
    .values({ id: randomUUID(), userId, time: now, equity: STARTING_CASH }).run();

  return userId;
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  db.insert(schema.sessions).values({
    id: token, userId, expiresAt: Date.now() + SESSION_TTL_MS,
  }).run();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000, path: "/",
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) db.delete(schema.sessions).where(eq(schema.sessions.id, token)).run();
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = { id: string; email: string; name: string };

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = db.select({
    id: schema.users.id, email: schema.users.email, name: schema.users.name,
  })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, token), gt(schema.sessions.expiresAt, Date.now())))
    .get();
  return row ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new Error("unauthorized");
  return user;
}

export function loginWithPassword(email: string, password: string): string {
  const user = db.select().from(schema.users)
    .where(eq(schema.users.email, email.trim().toLowerCase())).get();
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("bad-credentials");
  }
  return user.id;
}
