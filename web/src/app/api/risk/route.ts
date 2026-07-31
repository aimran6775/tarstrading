import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { riskReport } from "@/server/risk";

/** Portfolio risk analytics. Window in days, 30–365. */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const raw = Number(new URL(request.url).searchParams.get("days") ?? 90);
  const days = Math.min(365, Math.max(30, Number.isFinite(raw) ? raw : 90));

  try {
    return NextResponse.json({ ok: true, report: await riskReport(user.id, days) });
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't compute risk." }, { status: 500 });
  }
}
