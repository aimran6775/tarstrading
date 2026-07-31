import "server-only";

/*
  Reference rates — the price of money, from the Fed's own tap.

  FRED publishes the effective federal funds rate (DFF) as a public CSV, no
  key required — the same free discipline as the rest of the data mesh. Every
  financing number on the platform derives from it, so when the Fed moves,
  margin loans and cash sweep move the next session, exactly like a real desk.

  Spreads (annualised, simple):
  - Margin loans cost FF + 1.50% — well inside what retail brokers charge
    (many run FF + 4% and up), because the platform's job is teaching the
    MECHANISM, not maximising a spread.
  - Idle cash EARNS FF − 0.50%. The big houses famously sweep client cash at
    near zero; paying a real rate on it is the honest counterexample.
  - Short stock borrow: 0.30% general collateral. Real borrow desks price
    per-name (hard-to-borrow runs to double digits); GC is the teaching rate.
*/

export const MARGIN_SPREAD = 0.015;
export const SWEEP_HAIRCUT = 0.005;
export const BORROW_GC = 0.003;
/** Financing convention: simple interest, actual/360. */
export const DAYCOUNT = 360;

/** If FRED is unreachable, the last widely-known rate beats zero or a throw. */
const FALLBACK_FF = 0.0433;

let cache: { at: number; rate: number } | null = null;
const TTL = 12 * 3600_000;

/** Effective federal funds rate as a fraction (0.0433 = 4.33%). */
export async function fedFunds(): Promise<number> {
  if (cache && Date.now() - cache.at < TTL) return cache.rate;
  try {
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    // A hanging rates fetch must never hang the desk — same timeout
    // discipline the cron loopback learned the hard way.
    const res = await fetch(
      `https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFF&cosd=${since}`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`fred ${res.status}`);
    const lines = (await res.text()).trim().split("\n");
    // Last row with a numeric value wins (FRED pads recent days with ".").
    for (let i = lines.length - 1; i > 0; i--) {
      const v = Number(lines[i].split(",")[1]);
      if (Number.isFinite(v) && v > 0) {
        cache = { at: Date.now(), rate: v / 100 };
        return cache.rate;
      }
    }
    throw new Error("fred: no numeric rows");
  } catch {
    return cache?.rate ?? FALLBACK_FF;
  }
}

export type FinancingRates = {
  fedFunds: number;
  marginLoan: number;
  cashSweep: number;
  borrowGC: number;
};

export async function financingRates(): Promise<FinancingRates> {
  const ff = await fedFunds();
  return {
    fedFunds: ff,
    marginLoan: ff + MARGIN_SPREAD,
    cashSweep: Math.max(0, ff - SWEEP_HAIRCUT),
    borrowGC: BORROW_GC,
  };
}
