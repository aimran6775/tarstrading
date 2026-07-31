import "server-only";

/*
  Transaction costs — the difference between a backtest and a brokerage
  statement (gaps 6 and 9).

  Two frictions, both previously missing or naive:

  1. COMMISSIONS. Every fill was free. Equities really are commission-free at
     most US brokers, so that part was accidentally right — but options carry
     ~$0.65/contract, futures ~$2.25/side, and crypto ~25bps. A futures
     round-turn that costs nothing teaches that scalping ES is free, which is
     the single most expensive lesson a new trader can be taught wrong.

  2. SLIPPAGE BY SIZE. A flat 5bps meant 1 share and 50,000 shares filled at
     the same price. Real impact grows with your size relative to what the
     market can absorb, so slippage here is a base spread cost plus an impact
     term that scales with the square root of participation — the standard
     shape, kept simple enough to explain in one screen of the Academy.

  Everything is pure and unit-tested. No I/O, no database.
*/

export type AssetClass = "equity" | "crypto" | "option" | "future" | "fx";

export function assetClassOf(symbol: string): AssetClass {
  const s = symbol.toUpperCase();
  if (s.startsWith("FUT:")) return "future";
  if (s.startsWith("FX:")) return "fx";
  if (/^[A-Z]{1,6}\d{6}[CP]\d{8}$/.test(s)) return "option";
  if (s.includes("/")) return "crypto";
  return "equity";
}

/**
 * Commission for one fill, in dollars. Schedules approximate the US retail
 * norm circa 2026 — the point is that costs EXIST and vary by venue, not
 * that we match any one broker's card.
 */
export function commissionFor(symbol: string, qty: number, fillPrice: number): number {
  const q = Math.abs(qty);
  switch (assetClassOf(symbol)) {
    case "equity":
      return 0;                       // genuinely free at US retail brokers
    case "option":
      return 0.65 * q;                // per contract
    case "future":
      return 2.25 * q;                // per contract per side
    case "crypto":
      return 0.0025 * q * fillPrice;  // 25 bps of notional
    case "fx":
      return 0;                       // cost lives in the spread, not a fee
  }
}

/** Base half-spread paid on any market order, by class. */
const BASE_SLIP: Record<AssetClass, number> = {
  equity: 0.0005,   // 5 bps — a liquid name's touch
  crypto: 0.0010,   // wider books
  option: 0.0030,   // option spreads are genuinely brutal
  future: 0.0002,   // the deepest books in the world
  fx: 0.0002,
};

/**
 * Slippage as a FRACTION of price, for a market order of this size.
 *
 * cost = base + impact · sqrt(participation), where participation is the
 * order's share of a typical session's volume. Without a volume estimate we
 * fall back to base alone — an unknown liquidity profile shouldn't invent a
 * penalty, and the honest default is the small one.
 */
export function slippageFor(
  symbol: string, qty: number, price: number, avgVolume?: number | null,
): number {
  const base = BASE_SLIP[assetClassOf(symbol)];
  if (!avgVolume || !Number.isFinite(avgVolume) || avgVolume <= 0) return base;
  const participation = Math.min(1, Math.abs(qty) / avgVolume);
  // 2% of a day's volume ≈ 14 bps of impact on an equity; 20% ≈ 45 bps.
  const impact = 0.01 * Math.sqrt(participation);
  return base + impact;
}

/** Total cost of a fill in dollars — what the journal should reflect. */
export function fillCost(
  symbol: string, qty: number, fillPrice: number, multiplier: number,
  avgVolume?: number | null,
): { commission: number; slippagePct: number } {
  return {
    commission: commissionFor(symbol, qty, fillPrice * multiplier),
    slippagePct: slippageFor(symbol, qty, fillPrice, avgVolume),
  };
}
