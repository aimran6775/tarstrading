import "server-only";
import { db, schema } from "./db";
import { inArray } from "drizzle-orm";

/*
  The futures margin desk — contract specs and marks.

  Futures are not purchases. Opening a position moves NO principal; it posts
  INITIAL MARGIN (IM) as a good-faith requirement against account equity,
  holds the position against MAINTENANCE MARGIN (MM), and settles VARIATION
  MARGIN (VM) — the day's mark-to-market — to cash every session. Those three
  numbers are the whole product, so they live here as first-class data.

  Margins below are educational approximations of the exchange schedules
  (real ones move with volatility, sometimes weekly). Multipliers are exact
  contract specs — those are definitional, not market data.
*/

export type FuturesSpec = {
  name: string;
  /** Dollars per 1.0 of quoted price (the contract multiplier). */
  multiplier: number;
  /** Initial margin per contract, dollars — required to OPEN. */
  im: number;
  /** Maintenance margin per contract, dollars — required to HOLD. */
  mm: number;
};

export const FUTURES_SPECS: Record<string, FuturesSpec> = {
  // Equity index (CME) — quoted in index points
  ES:  { name: "E-mini S&P 500",      multiplier: 50,        im: 23000, mm: 21000 },
  NQ:  { name: "E-mini Nasdaq 100",   multiplier: 20,        im: 26000, mm: 24000 },
  YM:  { name: "E-mini Dow",          multiplier: 5,         im: 12000, mm: 11000 },
  RTY: { name: "E-mini Russell 2000", multiplier: 50,        im: 9500,  mm: 8600 },
  // Micros — one-tenth the E-minis: the honest fit for a $100k account
  MES: { name: "Micro E-mini S&P 500",      multiplier: 5,   im: 2300, mm: 2100 },
  MNQ: { name: "Micro E-mini Nasdaq 100",   multiplier: 2,   im: 2600, mm: 2400 },
  MYM: { name: "Micro E-mini Dow",          multiplier: 0.5, im: 1200, mm: 1100 },
  M2K: { name: "Micro E-mini Russell 2000", multiplier: 5,   im: 950,  mm: 860 },
  // Rates — the Treasury curve (CBOT), quoted in points of par
  ZT: { name: "2-Year T-Note",  multiplier: 2000, im: 2200, mm: 2000 },
  ZF: { name: "5-Year T-Note",  multiplier: 1000, im: 2700, mm: 2500 },
  ZN: { name: "10-Year T-Note", multiplier: 1000, im: 3600, mm: 3300 },
  ZB: { name: "30-Year T-Bond", multiplier: 1000, im: 5200, mm: 4700 },
  // Energy (NYMEX) — $/bbl, $/MMBtu, $/gal
  CL: { name: "Crude Oil (WTI)", multiplier: 1000,  im: 12000, mm: 11000 },
  NG: { name: "Natural Gas",     multiplier: 10000, im: 6500,  mm: 5900 },
  RB: { name: "RBOB Gasoline",   multiplier: 42000, im: 9500,  mm: 8600 },
  HO: { name: "Heating Oil",     multiplier: 42000, im: 9500,  mm: 8600 },
  MCL: { name: "Micro Crude Oil", multiplier: 100, im: 1200, mm: 1100 },
  // Metals (COMEX / NYMEX) — $/oz, $/lb
  GC:  { name: "Gold",        multiplier: 100,   im: 26000, mm: 24000 },
  SI:  { name: "Silver",      multiplier: 5000,  im: 32000, mm: 29000 },
  HG:  { name: "Copper",      multiplier: 25000, im: 11000, mm: 10000 },
  PL:  { name: "Platinum",    multiplier: 50,    im: 6500,  mm: 5900 },
  PA:  { name: "Palladium",   multiplier: 100,   im: 12000, mm: 11000 },
  MGC: { name: "Micro Gold",  multiplier: 10,    im: 2600,  mm: 2400 },
  // Grains & oilseeds (CBOT) — cents/bushel ($50 per cent on 5,000 bu)
  ZC: { name: "Corn",         multiplier: 50,  im: 2300, mm: 2100 },
  ZS: { name: "Soybeans",     multiplier: 50,  im: 4600, mm: 4200 },
  ZW: { name: "Wheat",        multiplier: 50,  im: 3300, mm: 3000 },
  ZL: { name: "Soybean Oil",  multiplier: 600, im: 3300, mm: 3000 },
  ZM: { name: "Soybean Meal", multiplier: 100, im: 3100, mm: 2800 },
  // Livestock (CME) — cents/lb, $400 per point on 40,000 lb
  LE: { name: "Live Cattle", multiplier: 400, im: 7500, mm: 6800 },
  HE: { name: "Lean Hogs",   multiplier: 400, im: 5200, mm: 4700 },
  // Currency futures (CME) — dollars per unit of foreign currency
  "6E": { name: "Euro FX",           multiplier: 125_000,    im: 3600, mm: 3300 },
  "6B": { name: "British Pound",     multiplier: 62_500,     im: 2900, mm: 2700 },
  "6J": { name: "Japanese Yen",      multiplier: 12_500_000, im: 4100, mm: 3800 },
  "6A": { name: "Australian Dollar", multiplier: 100_000,    im: 2700, mm: 2500 },
  "6C": { name: "Canadian Dollar",   multiplier: 100_000,    im: 2100, mm: 1900 },
};

export const isFuturesSymbol = (s: string) => s.toUpperCase().startsWith("FUT:");

/** FUT:ESU6 / FUT:NGU26 → "ES" / "NG". Null when the shape isn't an outright. */
export function productOf(symbol: string): string | null {
  const t = symbol.toUpperCase().replace(/^FUT:/, "");
  const m = /^([A-Z0-9]{1,3}?)[FGHJKMNQUVXZ]\d{1,2}$/.exec(t);
  return m ? m[1] : null;
}

/** The spec behind a contract symbol, or null for products we don't clear. */
export function futuresSpec(symbol: string): FuturesSpec | null {
  const code = productOf(symbol);
  return code ? FUTURES_SPECS[code] ?? null : null;
}

/*
  The futures session (approximate CME Globex): Sunday 6pm ET through Friday
  5pm ET, with a 5–6pm ET maintenance break each day. Saturdays are silent.
*/
export function isFuturesOpen(at = new Date()): boolean {
  const et = new Date(at.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay(), hour = et.getHours();
  if (day === 6) return false;                 // Saturday
  if (day === 5 && hour >= 17) return false;   // Friday close
  if (day === 0 && hour < 18) return false;    // Sunday pre-open
  return hour !== 17;                          // daily maintenance break
}

/** Marks for futures contracts from the shared quote cache (the mesh writes
    them from real session bars). EOD-provenance rows may honestly be a day
    old; anything older than 4 days is a dead feed, not a price. */
export async function futuresMarks(symbols: string[]): Promise<Map<string, number>> {
  const list = symbols.filter(isFuturesSymbol);
  if (!list.length) return new Map();
  const rows = await db.select().from(schema.quoteCache)
    .where(inArray(schema.quoteCache.symbol, list));
  const now = Date.now();
  return new Map(rows
    .filter((r) => now - r.updatedAt < 4 * 86_400_000)
    .map((r) => [r.symbol, r.price]));
}

/*
  Margin-call triage — pure and unit-tested. Given the futures book and how
  many dollars of maintenance shortfall must be freed, pick contracts to
  liquidate: biggest margin consumer first (freeing the most requirement per
  order), whole positions at a time, until the shortfall is covered.
*/
export function pickLiquidations(
  book: Array<{ symbol: string; qty: number }>,
  shortfall: number,
): Array<{ symbol: string; qty: number }> {
  const ranked = book
    .map((p) => ({ ...p, mm: (futuresSpec(p.symbol)?.mm ?? 0) * Math.abs(p.qty) }))
    .filter((p) => p.mm > 0)
    .sort((a, b) => b.mm - a.mm);
  const out: Array<{ symbol: string; qty: number }> = [];
  let freed = 0;
  for (const p of ranked) {
    if (freed >= shortfall) break;
    out.push({ symbol: p.symbol, qty: p.qty });
    freed += p.mm;
  }
  return out;
}
