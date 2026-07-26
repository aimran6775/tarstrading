import "server-only";
import { db, schema } from "./db";
import { and, eq, sql as dsql } from "drizzle-orm";
import type { Timeframe } from "./market";

/*
  The FX desk — real spot currency data.

  Symbols carry an explicit `FX:` prefix (FX:EURUSD) rather than the slash
  convention, because BTC/USD already means "crypto" everywhere in the
  exchange and an ambiguous ticker in a trading engine is a bug waiting to
  happen. Display strips it back to EUR/USD.

  Data is Polygon/Massive forex aggregates — verified working on our tier,
  unlike futures, which that plan doesn't entitle us to at all.

  Market model: FX runs ~24/5, closing Friday evening ET and reopening Sunday
  evening. Both directions are natural here (every pair is long one currency
  and short the other), so shorting is allowed at the same 2:1 as equities —
  deliberately far below the 50:1 retail brokers offer, because teaching
  someone to take 50:1 risk is teaching them to blow up.
*/

const BASE = "https://api.polygon.io";
const KEY = process.env.MASSIVE_API_KEY ?? "";
export const fxReady = KEY.length > 0;

export const FX_PREFIX = "FX:";
export const isFxSymbol = (s: string) => s.toUpperCase().startsWith(FX_PREFIX);

/** FX:EURUSD → EUR/USD for display. */
export function fxDisplay(symbol: string): string {
  const p = symbol.toUpperCase().replace(FX_PREFIX, "");
  return p.length === 6 ? `${p.slice(0, 3)}/${p.slice(3)}` : p;
}

/** FX:EURUSD → C:EURUSD (Polygon's ticker form). */
const toPolygon = (symbol: string) => `C:${symbol.toUpperCase().replace(FX_PREFIX, "")}`;

/** The majors and the most-traded crosses — the pairs a macro desk watches. */
export const FX_PAIRS = [
  "FX:EURUSD", "FX:GBPUSD", "FX:USDJPY", "FX:USDCHF", "FX:AUDUSD", "FX:USDCAD",
  "FX:NZDUSD", "FX:EURGBP", "FX:EURJPY", "FX:GBPJPY", "FX:EURCHF", "FX:AUDJPY",
  "FX:USDMXN", "FX:USDSEK", "FX:USDNOK", "FX:USDSGD",
];

/**
 * Is the FX market open? Spot runs continuously from Sunday ~5pm ET to Friday
 * ~5pm ET. Approximated in ET, which is what the rest of the app speaks.
 */
export function isFxOpen(at = new Date()): boolean {
  const et = new Date(at.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();          // 0 Sun … 6 Sat
  const hour = et.getHours();
  if (day === 6) return false;                 // Saturday: shut
  if (day === 0) return hour >= 17;            // Sunday: opens 5pm ET
  if (day === 5) return hour < 17;             // Friday: closes 5pm ET
  return true;
}

type PolyBar = { t: number; o: number; h: number; l: number; c: number; v: number };

/** Daily bars for one pair over a window. */
async function fetchFxBars(symbol: string, fromMs: number, toMs: number): Promise<PolyBar[]> {
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const url = `${BASE}/v2/aggs/ticker/${toPolygon(symbol)}/range/1/day/${iso(fromMs)}/${iso(toMs)}`
    + `?adjusted=true&sort=asc&limit=50000&apiKey=${KEY}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`fx ${res.status}`);
  const json = await res.json() as { results?: PolyBar[]; status?: string; message?: string };
  if (json.status === "NOT_AUTHORIZED") throw new Error(json.message ?? "not entitled");
  return json.results ?? [];
}

/** Latest price for a set of pairs, from the freshest stored daily bar. */
export async function fxQuotes(symbols: string[]): Promise<Map<string, { price: number; prevClose: number }>> {
  const out = new Map<string, { price: number; prevClose: number }>();
  const list = symbols.filter(isFxSymbol);
  if (!list.length) return out;

  const rows = await db.execute<{ symbol: string; c: number; prev: number | null }>(dsql`
    select symbol, c, prev from (
      select b.symbol, b.c, b.t,
             lag(b.c) over (partition by b.symbol order by b.t) as prev,
             row_number() over (partition by b.symbol order by b.t desc) as rn
        from bars b
       where b.timeframe = '1Y'
         and b.symbol = any(${dsql.raw(`ARRAY[${list.map((s) => `'${s.replace(/'/g, "''")}'`).join(",")}]`)})
    ) x where rn = 1
  `);
  for (const r of Array.from(rows)) {
    out.set(r.symbol, { price: r.c, prevClose: r.prev ?? r.c });
  }
  return out;
}

export type FxFillReport = { pairs: number; requests: number; barsWritten: number; errors: string[] };

/**
 * Load history for the FX pairs. Polygon serves one ticker per request here
 * (unlike Alpaca's batched equities), and the free tier is 5 calls/minute — so
 * this paces itself and reports honestly rather than hammering and failing.
 */
export async function fillFxHistory(symbols = FX_PAIRS, years = 5): Promise<FxFillReport> {
  if (!fxReady) return { pairs: 0, requests: 0, barsWritten: 0, errors: ["No market-data key configured."] };

  const to = Date.now();
  const from = to - years * 365 * 86_400_000;
  let requests = 0, barsWritten = 0;
  const errors: string[] = [];

  for (const symbol of symbols) {
    try {
      const bars = await fetchFxBars(symbol, from, to);
      requests++;
      if (!bars.length) continue;

      // FX has no meaningful share volume; Polygon's `v` is a tick count, which
      // is still a useful activity proxy, so we keep it.
      const rows = bars.map((b) => ({
        symbol, timeframe: "1Y" as Timeframe,
        t: Math.floor(b.t / 1000), o: b.o, h: b.h, l: b.l, c: b.c, v: b.v ?? 0,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        await db.insert(schema.bars).values(rows.slice(i, i + 500))
          .onConflictDoUpdate({
            target: [schema.bars.symbol, schema.bars.timeframe, schema.bars.t],
            set: {
              o: dsql`excluded.o`, h: dsql`excluded.h`, l: dsql`excluded.l`,
              c: dsql`excluded.c`, v: dsql`excluded.v`,
            },
          });
      }
      barsWritten += rows.length;

      const [agg] = await db.select({
        n: dsql<number>`count(*)::int`,
        lo: dsql<number>`min(t)::bigint`,
        hi: dsql<number>`max(t)::bigint`,
      }).from(schema.bars)
        .where(and(eq(schema.bars.symbol, symbol), eq(schema.bars.timeframe, "1Y")));
      const state = {
        earliest: agg?.lo ?? null, latest: agg?.hi ?? null,
        barCount: agg?.n ?? rows.length,
        lastSyncAt: Date.now(), status: "ok" as const, lastError: null,
      };
      await db.insert(schema.syncState)
        .values({ id: `${symbol}:1Y`, symbol, timeframe: "1Y", ...state })
        .onConflictDoUpdate({ target: schema.syncState.id, set: state });

      // Pace for the 5-per-minute free tier.
      await new Promise((r) => setTimeout(r, 13_000));
    } catch (e) {
      errors.push(`${symbol}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  return { pairs: symbols.length, requests, barsWritten, errors };
}
