import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { getHouseBoard } from "@/server/board";
import { getQuotes } from "@/server/market";
import { SYMBOLS } from "@/lib/symbols";

/*
  Symbol search across the WHOLE desk, not just the screenful a client
  happens to be holding.

  The board route caps at a few hundred rows for payload sanity, so a
  client searching its loaded rows tells you a market doesn't exist when
  it does — Global alone lists 719 names and the app was showing 250.
  This searches all 1,742 enabled symbols by ticker and by name, then
  prices only the handful it returns.

  Matching is deliberately simple and predictable: exact ticker first,
  then ticker prefix, then a substring anywhere in ticker or name. A
  trader typing "AAP" wants AAPL at the top, not an alphabetical accident.
*/
export const dynamic = "force-dynamic";

const LIMIT = 40;

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toUpperCase();
  if (q.length < 1) return NextResponse.json({ ok: true, rows: [], total: 0 });

  const board = await getHouseBoard();

  /*
    Names matter as much as tickers: nobody searching for Novo Nordisk
    types NVO. The curated name catalog is the same one the web's
    autocomplete uses, so both clients answer a name query identically.
  */
  const names = new Map(SYMBOLS.map((s) => [s.symbol.toUpperCase(), s.name.toUpperCase()]));

  // Rank, then cut. Score is small-is-better so a plain sort works.
  const scored = board
    .map((e) => {
      const sym = e.symbol.toUpperCase();
      const pretty = sym.replace(/^(IDX|FX|FUT):/, "");
      const name = names.get(pretty) ?? names.get(sym) ?? "";
      let score = Infinity;
      if (pretty === q || sym === q) score = 0;
      else if (pretty.startsWith(q)) score = 1;
      else if (name.startsWith(q)) score = 2;
      else if (sym.includes(q)) score = 3;
      else if (name.includes(q)) score = 4;
      return { entry: e, score };
    })
    .filter((s) => s.score < Infinity)
    .sort((a, b) => a.score - b.score || a.entry.symbol.localeCompare(b.entry.symbol));

  const total = scored.length;
  const top = scored.slice(0, LIMIT).map((s) => s.entry);

  // Price only what we return — searching must not cost a board sweep.
  let quotes: Awaited<ReturnType<typeof getQuotes>> = [];
  try {
    quotes = await getQuotes(top.map((e) => e.symbol));
  } catch {
    // A quote blip should still return the symbols; the row can show a
    // name without a price rather than claiming nothing was found.
  }
  const byS = new Map(quotes.map((qq) => [qq.symbol, qq]));

  const rows = top.map((e) => {
    const quote = byS.get(e.symbol);
    return {
      symbol: e.symbol,
      category: e.category,
      featured: e.featured,
      price: quote?.price ?? null,
      changePercent: quote?.changePercent ?? null,
      source: quote?.provenance ?? null,
      name: names.get(e.symbol.replace(/^(IDX|FX|FUT):/, "").toUpperCase()) ?? null,
    };
  });

  return NextResponse.json({ ok: true, rows, total, shown: rows.length });
}
