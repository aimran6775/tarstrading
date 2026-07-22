import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { getQuotes, hasLiveData, isUSMarketOpen } from "@/server/market";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(request.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 24);
  if (!symbols.length) return NextResponse.json({ ok: false, error: "No symbols." }, { status: 400 });

  const quotes = await getQuotes(symbols);
  return NextResponse.json({
    ok: true,
    quotes,
    live: hasLiveData,
    marketOpen: isUSMarketOpen(),
    serverTime: Date.now(),
  });
}
