import { NextResponse } from "next/server";
import { currentAdmin, confirmConsolePassword } from "@/server/auth";
import { setPlatformConfig, CFG } from "@/server/platform";
import { audit } from "@/server/admin-ops";

const ALLOWED = new Set<string>([CFG.HALT, CFG.PAUSE, CFG.ANNOUNCE]);
/* The two switches that reach every user at once. A 12-hour console session
   is fine for browsing; halting the whole platform deserves the password
   again at the moment of the act (gap 48). An announcement is reversible
   and harmless, so it stays a normal operator action. */
const NEEDS_CONFIRMATION = new Set<string>([CFG.HALT, CFG.PAUSE]);

/** Set one platform config key (kill switch or announcement). Admin-only, audited. */
export async function POST(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const key = String(body?.key ?? "");
  if (!ALLOWED.has(key)) return NextResponse.json({ ok: false, error: "Unknown key." }, { status: 400 });
  if (NEEDS_CONFIRMATION.has(key) && !(await confirmConsolePassword(body?.confirm))) {
    return NextResponse.json(
      { ok: false, error: "Confirm with the console password — this switch reaches every user.", needsConfirmation: true },
      { status: 401 });
  }
  const value = key === CFG.ANNOUNCE ? String(body?.value ?? "").slice(0, 240) : (body?.value ? "1" : "0");

  await setPlatformConfig(key, value, admin.id);
  await audit(admin.id, "config.set", { key, value });
  return NextResponse.json({ ok: true, key, value });
}
