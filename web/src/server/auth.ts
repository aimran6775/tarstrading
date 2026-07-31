import "server-only";
import { cookies, headers } from "next/headers";
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

/** The session cookie's Domain attribute, decided PER REQUEST from the Host:
    on tarstrading.com hosts we scope to COOKIE_DOMAIN (.tarstrading.com) so
    one login spans the frontend and admin.tarstrading.com; on any other host
    (Railway's built-in *.up.railway.app URLs, localhost) a domain attribute
    would make the browser REJECT the cookie, so we omit it (host-only). */
async function cookieDomain(): Promise<string | undefined> {
  const want = process.env.COOKIE_DOMAIN; // e.g. ".tarstrading.com"
  if (!want) return undefined;
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  const bare = want.replace(/^\./, "");
  return host === bare || host.endsWith("." + bare) ? want : undefined;
}

export async function startSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  await db.insert(schema.sessions).values({
    id: token, userId, expiresAt: Date.now() + SESSION_TTL_MS,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS / 1000, path: "/", domain: await cookieDomain(),
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
  // Clearing must carry the SAME domain attribute the cookie was set with.
  jar.set(SESSION_COOKIE, "", { maxAge: 0, path: "/", domain: await cookieDomain() });
}

export type SessionUser = { id: string; email: string; name: string; role: "user" | "admin"; fundName: string | null };

// Request-memoized: a page + its layout + several server components all call
// currentUser() in one render; cache() collapses that to a single session join.
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db.select({
    id: schema.users.id, email: schema.users.email, name: schema.users.name,
    role: schema.users.role, fundName: schema.users.fundName,
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

/*
  ---- The control console ----
  admin.tarstrading.com is its own product: a branded sign-in, its own session
  cookie (tars_console, distinct from the product's), and a surface confined to
  /admin by the edge Worker. Credentials come from env (CONSOLE_USER /
  CONSOLE_PASS) — no console account exists in the product's user flow.
*/
const CONSOLE_COOKIE = "tars_console";
const CONSOLE_TTL_MS = 12 * 60 * 60 * 1000; // a working day; consoles shouldn't linger

/** Constant-time string compare (avoids leaking the password by timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function consoleCredentialsOk(username: string, password: string): boolean {
  const u = process.env.CONSOLE_USER, p = process.env.CONSOLE_PASS;
  if (!u || !p) return false;
  // Always compare both so a wrong username costs the same as a wrong password.
  const okU = safeEqual(username, u), okP = safeEqual(password, p);
  return okU && okP;
}

/** Mint a console session (rows live in `sessions`, owned by the console user). */
export async function startConsoleSession(): Promise<boolean> {
  const consoleId = process.env.CONSOLE_USER_ID;
  if (!consoleId) return false;
  const token = randomBytes(32).toString("hex");
  await db.insert(schema.sessions).values({
    id: token, userId: consoleId, expiresAt: Date.now() + CONSOLE_TTL_MS,
  });
  const jar = await cookies();
  jar.set(CONSOLE_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    maxAge: CONSOLE_TTL_MS / 1000, path: "/",
  });
  return true;
}

export async function endConsoleSession() {
  const jar = await cookies();
  const token = jar.get(CONSOLE_COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
  jar.set(CONSOLE_COOKIE, "", { maxAge: 0, path: "/" });
}

/** The console operator, if a valid console session cookie is present. */
export async function consoleUser(): Promise<SessionUser | null> {
  const consoleId = process.env.CONSOLE_USER_ID;
  if (!consoleId) return null;
  const jar = await cookies();
  const token = jar.get(CONSOLE_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db.select({
    id: schema.users.id, email: schema.users.email, name: schema.users.name,
    role: schema.users.role, fundName: schema.users.fundName,
  })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, token), gt(schema.sessions.expiresAt, Date.now())))
    .limit(1);
  return row && row.id === consoleId ? row : null;
}

export async function currentAdmin(): Promise<SessionUser | null> {
  // A console session authenticates the control center outright.
  const op = await consoleUser();
  if (op) return op;

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
  if (user.suspended) throw new Error("suspended");
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

/*
  The client's real IP, for throttling.

  NOT the left-most X-Forwarded-For hop: that value is supplied by the client,
  and Cloudflare APPENDS the true address rather than replacing the header. So
  a caller who sends their own X-Forwarded-For lands in a fresh rate-limit
  bucket on every request — which silently defeated login, signup AND console
  throttling, leaving the operator password brute-forceable at full speed.

  CF-Connecting-IP is set by Cloudflare and cannot be forged through it. We fall
  back to the RIGHT-most forwarded hop (the one our own edge appended) and only
  then to a constant, so a misconfiguration throttles everyone together rather
  than nobody at all.
*/
export function clientIp(h: Headers): string {
  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return h.get("x-real-ip")?.trim() || "unknown";
}

/*
  Step-up confirmation for destructive operator actions (gap 48).

  A 12-hour console session is convenient for browsing but too generous for
  the handful of actions that reach every user at once — halting trading,
  pausing every analyst, rewriting the house board. A borrowed laptop or an
  unlocked screen shouldn't be able to do those. This asks for the console
  password again at the moment of the action; it never creates or extends a
  session, so it can't be used as a login side-door.
*/
export async function confirmConsolePassword(password: unknown): Promise<boolean> {
  const expected = process.env.CONSOLE_PASS;
  if (!expected) return false;
  if (typeof password !== "string" || !password) return false;
  // Constant-time compare, same discipline as the login path.
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
