import { formatPrice, formatSignedPrice, type MarketCategory } from "@/components/trading/shared";

/*
  The Markets board — shapes and formatters shared by the pulse strip, the
  movers rails and the board table.

  Mirrors GET /api/market/board (server modules are server-only, so the client
  carries its own copy of the row shape). EVERY numeric field is nullable: a
  closed market, a thin symbol or a vault gap all produce nulls, and a null
  must render as an em dash — never a zero that would read as real data.
*/

export type BoardRow = {
  symbol: string;
  /** Curated category from the control center; null for uncurated rows. */
  category: MarketCategory | null;
  featured: boolean;
  price: number | null;
  prevClose: number | null;
  change: number | null;
  /** Fraction, not percent: 0.0142 = +1.42%. */
  changePercent: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  bid: number | null;
  ask: number | null;
  high52: number | null;
  low52: number | null;
  avgVolume: number | null;
  /** 0..1 — where the last price sits inside the 52-week range. */
  rangePosition: number | null;
  return1M: number | null;
  return1Y: number | null;
};

export type Breadth = { advancing: number; declining: number; unchanged: number };

export type Movers = {
  gainers: BoardRow[];
  losers: BoardRow[];
  actives: BoardRow[];
  breadth: Breadth;
};

export type BoardPayload = {
  ok: boolean;
  marketOpen: boolean;
  count: number;
  asOf: number;
  rows: BoardRow[];
  movers: Movers;
};

export const DASH = "—";

/*
  Prices carry their symbol so the instrument decides its own units: a security
  prints in dollars to the cent, a currency pair prints to the pip with no
  dollar sign at all (EUR/USD is a ratio, not an amount). Passing no symbol
  keeps the old dollar behaviour, which is what every equity row wants.
*/

/** A price, or an em dash. Never a zero standing in for "unknown". */
export const money = (v: number | null | undefined, symbol = "") =>
  v == null ? DASH : formatPrice(symbol, v);

/** A signed percentage from a fraction. */
export const pctOf = (v: number | null | undefined) =>
  v == null ? DASH : `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;

/** A signed absolute change, in the instrument's own units. */
export const signedMoney = (v: number | null | undefined, symbol = "") =>
  v == null ? DASH : formatSignedPrice(symbol, v);

/** Share counts read better compacted; a terminal never prints 12 digits. */
export function compact(v: number | null | undefined): string {
  if (v == null) return DASH;
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** P&L tone — reserved for change values, never for identity or structure. */
export const toneOf = (v: number | null | undefined) =>
  v == null ? "text-ink-3" : v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-ink-3";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Position of `value` inside [low, high], or null when the range isn't real. */
export function positionIn(
  low: number | null | undefined,
  high: number | null | undefined,
  value: number | null | undefined,
): number | null {
  if (low == null || high == null || value == null || !(high > low)) return null;
  return clamp01((value - low) / (high - low));
}

/** Crypto symbols carry a slash — the route segment has to be encoded. */
export const marketPath = (symbol: string) => `/app/m/${encodeURIComponent(symbol)}`;

/** Movers + breadth over an arbitrary slice — used when a category pill narrows
    the universe and the server's whole-market movers would be the wrong story. */
export function moversFromRows(rows: BoardRow[], take = 8): Movers {
  const moved = rows.filter((r) => r.changePercent != null);
  const byMove = [...moved].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const byVolume = rows.filter((r) => r.volume != null)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));

  let advancing = 0, declining = 0, unchanged = 0;
  for (const r of moved) {
    const c = r.changePercent ?? 0;
    if (c > 0.0001) advancing++;
    else if (c < -0.0001) declining++;
    else unchanged++;
  }

  return {
    gainers: byMove.slice(0, take),
    losers: byMove.slice(-take).reverse(),
    actives: byVolume.slice(0, take),
    breadth: { advancing, declining, unchanged },
  };
}
