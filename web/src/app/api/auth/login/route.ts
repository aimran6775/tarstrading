import { NextResponse } from "next/server";
import { loginWithPassword, startSession, rateLimit, purgeExpiredSessions } from "@/server/auth";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  // 10 attempts / 5 min per IP — throttles credential stuffing.
  if (!rateLimit(`login:${ip}`, 10, 5 * 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Wait a few minutes." }, { status: 429 });
  }
  try {
    const { email, password } = await request.json();
    const userId = await loginWithPassword(String(email ?? ""), String(password ?? ""));
    await purgeExpiredSessions();
    await startSession(userId);
    return NextResponse.json({ ok: true });
  } catch {
    // One message for both wrong-email and wrong-password: no account probing.
    return NextResponse.json(
      { ok: false, error: "Email or password didn't match." },
      { status: 401 });
  }
}
