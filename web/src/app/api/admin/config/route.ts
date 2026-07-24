import { NextResponse } from "next/server";
import { currentAdmin } from "@/server/auth";
import { setPlatformConfig, CFG } from "@/server/platform";
import { audit } from "@/server/admin-ops";

const ALLOWED = new Set<string>([CFG.HALT, CFG.PAUSE, CFG.ANNOUNCE]);

/** Set one platform config key (kill switch or announcement). Admin-only, audited. */
export async function POST(request: Request) {
  const admin = await currentAdmin();
  if (!admin) return NextResponse.json({ ok: false }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const key = String(body?.key ?? "");
  if (!ALLOWED.has(key)) return NextResponse.json({ ok: false, error: "Unknown key." }, { status: 400 });
  const value = key === CFG.ANNOUNCE ? String(body?.value ?? "").slice(0, 240) : (body?.value ? "1" : "0");

  await setPlatformConfig(key, value, admin.id);
  await audit(admin.id, "config.set", { key, value });
  return NextResponse.json({ ok: true, key, value });
}
