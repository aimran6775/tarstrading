import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { marketStats } from "@/server/marketstats";
import { isUSMarketOpen } from "@/server/market";

/*
  Statistics for a handful of named symbols — the same depth the board serves,
  but scoped to what a symbol page actually needs. One snapshot call plus one
  vault query, no matter how many symbols are asked for.

  GET /api/market/stats?symbols=AAPL,BTC/USD
*/
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(req.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 24);
  if (!symbols.length) return NextResponse.json({ ok: false, error: "No symbols." }, { status: 400 });

  const stats = await marketStats(symbols);

  return NextResponse.json({
    ok: true,
    marketOpen: isUSMarketOpen(),
    stats,
    asOf: Date.now(),
  });
}
