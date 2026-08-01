import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  loginWithPassword, startDeviceSession, revokeDeviceSession,
  currentUser, rateLimit, clientIp,
} from "@/server/auth";

/*
  Device token auth — the native clients' door.

  POST {email, password} → { token } exactly once; the device stores it in
  the Keychain and sends `Authorization: Bearer <token>` from then on. The
  token is a long-TTL row in the same sessions table browsers use, so expiry,
  cleanup and revocation are the one code path that already exists.

  DELETE with the Bearer header revokes THAT token — sign-out on the device
  kills the credential server-side, not just locally.

  Same login rate limit as the web form: this endpoint must not be a cheaper
  place to guess passwords than the page is.
*/
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const h = await headers();
  const allowed = await rateLimit(`login:${clientIp(h)}`, 10, 10 * 60_000);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again shortly." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Email and password required." }, { status: 400 });
  }

  try {
    const userId = await loginWithPassword(email, password);
    const token = await startDeviceSession(userId);
    return NextResponse.json({ ok: true, token });
  } catch {
    // One message for wrong-email and wrong-password alike — no probing.
    return NextResponse.json({ ok: false, error: "Email or password didn't match." }, { status: 401 });
  }
}

export async function DELETE(request: Request) {
  // Only the holder of a valid token can revoke it; the token itself is the proof.
  const user = await currentUser();
  const auth = request.headers.get("authorization");
  if (!user || !auth?.startsWith("Bearer ")) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await revokeDeviceSession(auth.slice(7).trim());
  return NextResponse.json({ ok: true });
}
