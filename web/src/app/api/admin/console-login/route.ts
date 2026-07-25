import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { consoleCredentialsOk, startConsoleSession, endConsoleSession, rateLimit } from "@/server/auth";

/*
  Control-console sign-in. Credentials live in env (never in the DB, never in
  the repo) and are compared in constant time. Throttled per-IP so the console
  can't be brute-forced, and every failure is deliberately vague.
*/
export async function POST(req: Request) {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const allowed = await rateLimit(`console:${ip}`, 8, 10 * 60_000);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Wait a few minutes." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!consoleCredentialsOk(username, password)) {
    return NextResponse.json({ ok: false, error: "Those credentials weren't accepted." }, { status: 401 });
  }
  const started = await startConsoleSession();
  if (!started) {
    return NextResponse.json({ ok: false, error: "Console isn't configured on this server." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Sign out of the console. */
export async function DELETE() {
  await endConsoleSession();
  return NextResponse.json({ ok: true });
}
