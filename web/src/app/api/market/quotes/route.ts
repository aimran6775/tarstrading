import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { getQuotes, hasLiveData, isUSMarketOpen } from "@/server/market";
import { ensureLiveFeed, hasLiveFeed, liveFeedStatus } from "@/server/live-feed";
import { checkAlerts } from "@/server/alerts";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(request.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 24);
  if (!symbols.length) return NextResponse.json({ ok: false, error: "No symbols." }, { status: 400 });

  // Keep the websocket feed covering exactly what users are watching.
  ensureLiveFeed(symbols);

  const quotes = await getQuotes(symbols);
  // Price alerts ride the poll the terminal already runs — no extra requests.
  const triggered = await checkAlerts(user.id, quotes);
  return NextResponse.json({
    ok: true,
    quotes,
    triggered,
    live: hasLiveData,
    liveFeed: hasLiveFeed,
    feed: liveFeedStatus(),
    marketOpen: isUSMarketOpen(),
    serverTime: Date.now(),
  });
}
