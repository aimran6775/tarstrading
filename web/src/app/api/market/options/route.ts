import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { getQuote } from "@/server/market";
import { listExpiries, optionChain, optionsReady } from "@/server/options";

/*
  The option chain for one underlying: real listed contracts, live quotes, and
  greeks computed from each row's implied volatility.

  GET ?symbol=AAPL             → expiries + the nearest chain
  GET ?symbol=AAPL&expiry=…    → that expiry's chain
*/
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ ok: false }, { status: 401 });
  if (!optionsReady) {
    return NextResponse.json({ ok: false, error: "Options data isn't configured." }, { status: 503 });
  }

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "").toUpperCase().trim();
  if (!symbol || symbol.includes("/")) {
    return NextResponse.json({ ok: false, error: "A US equity symbol is required." }, { status: 400 });
  }

  try {
    const quote = await getQuote(symbol);
    if (!quote) return NextResponse.json({ ok: false, error: `No market data for ${symbol}.` }, { status: 404 });

    const expiries = await listExpiries(symbol);
    if (!expiries.length) {
      return NextResponse.json({ ok: true, symbol, spot: quote.price, expiries: [], expiry: null, rows: [] });
    }
    const wanted = url.searchParams.get("expiry");
    const expiry = wanted && expiries.includes(wanted) ? wanted : expiries[0];
    const rows = await optionChain(symbol, expiry, quote.price);

    return NextResponse.json({
      ok: true, symbol, spot: quote.price, expiries, expiry, rows, asOf: Date.now(),
    });
  } catch (e) {
    return NextResponse.json({
      ok: false, error: e instanceof Error ? e.message : "Couldn't load the chain.",
    }, { status: 502 });
  }
}
