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

/*
  One shared in-process cache for the assembled payload. The board is the same
  for every user, yet uncached this route measured ~165ms of Postgres CPU per
  call — at 100 open tabs polling, ~83% of a database core spent recomputing
  identical JSON. 15 seconds is far fresher than the data behind it (15-min
  delayed SIP + 60s sweep) so nobody sees older prices, just cheaper ones.
*/
const TTL_MS = 15_000;
const boardCache = new Map<string, { at: number; body: unknown }>();

export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(req.url);
  const category = url.searchParams.get("category");        // stocks | etf | crypto
  const limit = Math.min(600, Math.max(1, Number(url.searchParams.get("limit") ?? 250)));

  const cacheKey = `${category ?? "*"}:${limit}`;
  const hit = boardCache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

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

  const body = {
    ok: true,
    marketOpen: isUSMarketOpen(),
    count: rows.length,
    rows,
    movers: moversFrom(stats),
    asOf: Date.now(),
  };
  boardCache.set(cacheKey, { at: Date.now(), body });
  return NextResponse.json(body);
}
