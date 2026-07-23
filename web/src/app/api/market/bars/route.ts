import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { getBars, getSeriesMeta, hasLiveData, type Timeframe } from "@/server/market";

const TIMEFRAMES = new Set(["1D", "1W", "1M", "3M", "1Y", "5Y"]);

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase();
  const tf = url.searchParams.get("tf") ?? "3M";
  if (!symbol || !TIMEFRAMES.has(tf)) {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  try {
    const bars = await getBars(symbol, tf as Timeframe);
    const meta = hasLiveData ? await getSeriesMeta(symbol, tf as Timeframe) : null;
    return NextResponse.json({
      ok: true,
      bars,
      // Honesty header: where this series came from and how fresh it is.
      source: !hasLiveData ? "demo" : meta ? "store" : "live",
      syncedAt: meta?.lastSyncAt ?? null,
      coverage: meta ? { earliest: meta.earliest, latest: meta.latest, count: meta.barCount } : null,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Couldn't load history — the data tier may be rate-limited. Try again shortly." },
      { status: 502 });
  }
}
