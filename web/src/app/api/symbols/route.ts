import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { searchTickers, countTickers } from "@/server/tickers";
import { searchSymbols } from "@/lib/symbols";

/*
  Symbol search over the full tradable universe (the tickers directory —
  every active US-listed stock/ETF plus crypto). Falls back to the curated
  static list until the directory's first sync lands, so autocomplete always
  answers something.
*/
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.slice(0, 40) ?? "";
  if (!q.trim()) return NextResponse.json({ ok: true, results: [] });

  try {
    const hits = await searchTickers(q, 8);
    if (hits.length > 0) return NextResponse.json({ ok: true, results: hits });
    // Empty could mean "no match" or "directory not synced yet" — only fall
    // back to the static list in the latter case, so real misses stay honest.
    if (await countTickers() < 1000) {
      return NextResponse.json({ ok: true, results: searchSymbols(q, 8) });
    }
    return NextResponse.json({ ok: true, results: [] });
  } catch {
    return NextResponse.json({ ok: true, results: searchSymbols(q, 8) });
  }
}
