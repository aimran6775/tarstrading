import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { reconcile } from "@/server/exchange";
import { performanceReport } from "@/server/analytics";

/*
  The performance & risk report — Sharpe/Sortino/Calmar, drawdown, trade stats,
  and live exposure. Reconciles first so the equity mark is current.
*/
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await reconcile(user.id).catch(() => { /* stale marks still worth reporting */ });
  const report = await performanceReport(user.id);
  return NextResponse.json({ ok: true, ...report });
}
