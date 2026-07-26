/* Shared trading types + formatters for the browse home, market pages, and tray. */

export type Quote = { symbol: string; price: number; previousClose: number; changePercent: number; asOf: number };
export type Account = { cash: number; equity: number; dayStartEquity: number };
export type Position = { id: string; symbol: string; qty: number; avgEntryPrice: number };
export type Order = {
  id: string; symbol: string; side: "buy" | "sell"; type: string; qty: number;
  limitPrice: number | null; stopPrice: number | null; status: string;
  filledPrice: number | null; rejectReason: string | null; createdAt: number;
};
export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";

export const usd = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
export const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;

/** The pills the browse page groups markets under. */
export type MarketCategory = "Crypto" | "ETFs" | "Stocks";

/** One row of the curated house board, as served to the client by the server. */
export type BoardEntry = { symbol: string; category: MarketCategory; featured: boolean };

const ETFS = new Set(["SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "GLD"]);

/** Shape-based fallback classification — used for off-board symbols (watchlist
    additions) and when the curated board is unavailable. */
export function categoryOf(symbol: string): MarketCategory {
  if (symbol.includes("/")) return "Crypto";
  if (ETFS.has(symbol)) return "ETFs";
  return "Stocks";
}

/*
  Where a position's symbol should link. An OCC option contract has no page of
  its own — the underlying's terminal is where its chain and its ticket live —
  so an option routes there with the Options tray open. Everything else links
  to itself. Client-safe (no server-only imports), so every surface that lists
  positions can use it.
*/
const OCC = /^([A-Z]{1,6})\d{6}[CP]\d{8}$/;
export function marketHrefFor(symbol: string): string {
  const m = OCC.exec(symbol.toUpperCase());
  return m
    ? `/app/m/${encodeURIComponent(m[1])}?tray=options`
    : `/app/m/${encodeURIComponent(symbol)}`;
}
