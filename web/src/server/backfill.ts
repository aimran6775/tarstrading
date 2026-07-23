import "server-only";
import { db, schema } from "./db";
import { syncSeries, freeTokens, type Timeframe, type SyncResult } from "./market";

/*
  The background librarian. Each cron tick it walks every symbol anyone cares
  about — watchlists, open positions, agent universes, plus the house list —
  and heals the bar store: series that were never fetched get backfilled,
  stale tails get topped up. It only ever spends LEFTOVER rate-limit tokens
  (always keeping one for a live user), so it can never starve the terminal.
  Over time the vault converges on "everything anyone looks at, always warm."
*/

const HOUSE_SYMBOLS = ["AAPL", "NVDA", "TSLA", "SPY", "MSFT", "AMZN", "META", "GOOG", "BTC/USD", "ETH/USD"];

/** Timeframes in the order users actually hit them. */
const PRIORITY: Timeframe[] = ["3M", "1Y", "1D", "1M", "1W", "5Y"];

/** Every symbol the platform currently cares about, deduped. */
export async function gatherSymbols(): Promise<string[]> {
  const out = new Set<string>(HOUSE_SYMBOLS);
  try {
    const [watch, pos, agents] = await Promise.all([
      db.selectDistinct({ s: schema.watchlistItems.symbol }).from(schema.watchlistItems),
      db.selectDistinct({ s: schema.positions.symbol }).from(schema.positions),
      db.select({ strategy: schema.agents.strategy }).from(schema.agents),
    ]);
    for (const r of watch) out.add(r.s);
    for (const r of pos) out.add(r.s);
    for (const a of agents) {
      try {
        const u = (JSON.parse(a.strategy) as { universe?: string[] }).universe ?? [];
        for (const s of u) out.add(s.toUpperCase());
      } catch { /* malformed strategy never halts the sweep */ }
    }
  } catch { /* fresh DB — house list is enough */ }
  return [...out];
}

export type BackfillReport = {
  considered: number;
  synced: number;
  fresh: number;
  errors: number;
  stoppedForTokens: boolean;
};

/**
 * One healing pass. Spends at most `maxSpend` upstream calls and never the
 * last free token. Series order: first timeframe priority, then symbols —
 * so every symbol gets its 3M chart before any symbol gets its 5Y.
 */
export async function backfillTick(maxSpend = 3): Promise<BackfillReport> {
  const report: BackfillReport = { considered: 0, synced: 0, fresh: 0, errors: 0, stoppedForTokens: false };
  const symbols = await gatherSymbols();
  let spent = 0;

  for (const tf of PRIORITY) {
    for (const symbol of symbols) {
      if (spent >= maxSpend || freeTokens() <= 1) {
        report.stoppedForTokens = freeTokens() <= 1;
        return report;
      }
      report.considered++;
      const r: SyncResult = await syncSeries(symbol, tf);
      if (r === "synced") { report.synced++; spent++; }
      else if (r === "fresh") report.fresh++;
      else if (r === "error") { report.errors++; spent++; }
      else { report.stoppedForTokens = true; return report; } // no-token
    }
  }
  return report;
}
