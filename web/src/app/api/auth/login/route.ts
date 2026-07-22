import { NextResponse } from "next/server";
import { loginWithPassword, startSession } from "@/server/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const userId = loginWithPassword(String(email ?? ""), String(password ?? ""));
    await startSession(userId);
    return NextResponse.json({ ok: true });
  } catch {
    // One message for both wrong-email and wrong-password: no account probing.
    return NextResponse.json(
      { ok: false, error: "Email or password didn't match." },
      { status: 401 });
  }
}
