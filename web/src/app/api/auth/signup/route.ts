import { NextResponse } from "next/server";
import { createUser, startSession, rateLimit, clientIp } from "@/server/auth";

const ERRORS: Record<string, string> = {
  "invalid-email": "That email doesn't look right.",
  "weak-password": "Password needs at least 8 characters.",
  "missing-name": "Tell us what to call you.",
  "email-taken": "That email already has an account. Log in instead.",
};

export async function POST(request: Request) {
  const ip = clientIp(request.headers);
  if (!await rateLimit(`signup:${ip}`, 5, 10 * 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many sign-ups from here. Wait a bit." }, { status: 429 });
  }
  try {
    const { email, name, password } = await request.json();
    const userId = await createUser(String(email ?? ""), String(name ?? ""), String(password ?? ""));
    await startSession(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const key = error instanceof Error ? error.message : "";
    return NextResponse.json(
      { ok: false, error: ERRORS[key] ?? "Couldn't create the account." },
      { status: 400 });
  }
}
