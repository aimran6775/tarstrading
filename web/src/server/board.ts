import "server-only";
import { db, schema } from "./db";
import { eq } from "drizzle-orm";
import { categoryOf, type BoardEntry, type MarketCategory } from "@/components/trading/shared";

/*
  The house board — the market universe the product shows on /app.

  Curated in the admin control center (platform_symbols) and read here on every
  Markets view, so an operator's edit flows straight into the product. One query,
  no per-symbol round trips.

  Two safety properties matter more than freshness:
    1. The board is cached in-process for a few seconds. A control-center change
       lands within the TTL — short enough to feel immediate, long enough that a
       busy Markets page doesn't hammer Postgres.
    2. If the table is empty or the query fails, we serve HOUSE_FALLBACK below.
       Markets must never render an empty room.
*/

/** The documented fallback universe — the board we shipped before curation moved
    into the control center. Used verbatim whenever the DB can't answer. */
export const HOUSE_FALLBACK = [
  // Mega-cap tech
  "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GOOG", "AMD", "NFLX", "AVGO",
  // Blue chips & industrials
  "JPM", "V", "WMT", "JNJ", "PG", "DIS", "BA", "CAT", "XOM", "CVX",
  // Growth & momentum
  "PLTR", "COIN", "SQ", "SHOP", "UBER", "ABNB", "SNOW", "CRWD", "PANW", "SMCI",
  // Semis & AI complex
  "INTC", "MU", "TSM", "ARM", "QCOM",
  // ETFs — index, sector, vol
  "SPY", "QQQ", "DIA", "IWM", "XLF", "XLE", "XLK", "SMH", "GLD", "TLT",
  // Crypto — 24/7
  "BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD", "AVAX/USD", "LINK/USD",
];

/** Fallback entries: category inferred from the symbol's shape, nothing featured
    — which reproduces the pre-curation behavior exactly (hero = biggest mover). */
function fallbackBoard(): BoardEntry[] {
  return HOUSE_FALLBACK.map((symbol) => ({
    symbol, category: categoryOf(symbol), featured: false,
  }));
}

/** DB section → the pill a symbol lives under. */
function toCategory(section: string, symbol: string): MarketCategory {
  switch (section.toLowerCase()) {
    case "crypto": return "Crypto";
    case "etf": case "etfs": return "ETFs";
    case "stocks": case "stock": return "Stocks";
    default: return categoryOf(symbol); // unknown section → infer, never drop
  }
}

const TTL_MS = 15_000;
let cached: { at: number; board: BoardEntry[] } | null = null;

/**
 * The enabled board, ordered by rank then symbol — the order the product
 * renders before it re-sorts by the day's move.
 */
export async function getHouseBoard(): Promise<BoardEntry[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.board;
  let board: BoardEntry[];
  try {
    const rows = await db.select({
      symbol: schema.platformSymbols.symbol,
      category: schema.platformSymbols.category,
      featured: schema.platformSymbols.featured,
    })
      .from(schema.platformSymbols)
      .where(eq(schema.platformSymbols.enabled, 1))
      .orderBy(schema.platformSymbols.rank, schema.platformSymbols.symbol);
    board = rows.map((r) => ({
      symbol: r.symbol,
      category: toCategory(r.category, r.symbol),
      featured: r.featured === 1,
    }));
    // An empty board is a curation accident, not an instruction to show nothing.
    if (board.length === 0) board = fallbackBoard();
  } catch {
    board = fallbackBoard(); // DB blip → the product still has a market to show
  }
  cached = { at: Date.now(), board };
  return board;
}
