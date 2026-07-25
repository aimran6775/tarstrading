import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { getHouseBoard } from "@/server/board";
import { marketStats, moversFrom } from "@/server/marketstats";
import { isUSMarketOpen } from "@/server/market";

/*
  The market board with real depth: every curated symbol carrying last price,
  day change, day range, volume, bid/ask, 52-week range and trailing returns —
  plus movers and breadth computed across the whole universe.

  One request powers a terminal-grade Markets view. Also the shape a native
  iOS/Android client would consume.
*/
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(req.url);
  const category = url.searchParams.get("category");        // stocks | etf | crypto
  const limit = Math.min(600, Math.max(1, Number(url.searchParams.get("limit") ?? 250)));

  const board = await getHouseBoard();
  const scoped = category
    ? board.filter((b) => b.category.toLowerCase().startsWith(category.toLowerCase().slice(0, 3)))
    : board;

  const symbols = scoped.slice(0, limit).map((b) => b.symbol);
  const stats = await marketStats(symbols);

  // Decorate with the curation the control center set.
  const meta = new Map(board.map((b) => [b.symbol, b] as const));
  const rows = stats.map((s) => ({
    ...s,
    category: meta.get(s.symbol)?.category ?? null,
    featured: meta.get(s.symbol)?.featured ?? false,
  }));

  return NextResponse.json({
    ok: true,
    marketOpen: isUSMarketOpen(),
    count: rows.length,
    rows,
    movers: moversFrom(stats),
    asOf: Date.now(),
  });
}
