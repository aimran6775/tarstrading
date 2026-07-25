import "server-only";
import { db } from "./db";
import { sql as dsql } from "drizzle-orm";

/*
  Market statistics — the numbers a real terminal shows next to a price.

  Two sources, deliberately split:
  - Alpaca SNAPSHOTS give the live session in one batched call per 100 symbols:
    last trade, today's open/high/low/volume, and the previous close.
  - Our own 5-year bar vault gives the context Alpaca doesn't hand out cheaply:
    52-week high/low, average volume, and range position.

  Everything degrades gracefully: if the snapshot call fails we still return
  vault-derived stats, and vice versa. A missing field is null, never a zero
  that would read as real data.
*/

const DATA = "https://data.alpaca.markets";
const KEY = process.env.ALPACA_KEY_ID ?? "";
const SECRET = process.env.ALPACA_SECRET_KEY ?? "";

const headers = () => ({
  "APCA-API-KEY-ID": KEY,
  "APCA-API-SECRET-KEY": SECRET,
  accept: "application/json",
});

const isCrypto = (s: string) => s.includes("/");

export type MarketStat = {
  symbol: string;
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  bid: number | null;
  ask: number | null;
  /** From the bar vault. */
  high52: number | null;
  low52: number | null;
  avgVolume: number | null;
  /** 0..1 — where price sits inside the 52-week range. */
  rangePosition: number | null;
  /** Percentage return over the trailing window, from stored daily bars. */
  return1M: number | null;
  return1Y: number | null;
};

type Snap = {
  latestTrade?: { p: number };
  latestQuote?: { bp: number; ap: number };
  dailyBar?: { o: number; h: number; l: number; c: number; v: number };
  prevDailyBar?: { o: number; h: number; l: number; c: number; v: number };
};

/** Alpaca snapshots for many symbols (batched by asset class, 100 per call). */
async function fetchSnapshots(symbols: string[]): Promise<Map<string, Snap>> {
  const out = new Map<string, Snap>();
  if (!KEY || !SECRET || !symbols.length) return out;

  const stocks = symbols.filter((s) => !isCrypto(s));
  const cryptos = symbols.filter(isCrypto);

  const jobs: Promise<void>[] = [];
  for (let i = 0; i < stocks.length; i += 100) {
    const chunk = stocks.slice(i, i + 100);
    jobs.push((async () => {
      try {
        const qs = new URLSearchParams({ symbols: chunk.join(","), feed: "iex" });
        const res = await fetch(`${DATA}/v2/stocks/snapshots?${qs}`, { headers: headers(), cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json() as Record<string, Snap>;
        for (const [sym, snap] of Object.entries(json)) out.set(sym, snap);
      } catch { /* vault stats still stand */ }
    })());
  }
  for (let i = 0; i < cryptos.length; i += 100) {
    const chunk = cryptos.slice(i, i + 100);
    jobs.push((async () => {
      try {
        const qs = new URLSearchParams({ symbols: chunk.join(",") });
        const res = await fetch(`${DATA}/v1beta3/crypto/us/snapshots?${qs}`, { headers: headers(), cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json() as { snapshots?: Record<string, Snap> };
        for (const [sym, snap] of Object.entries(json.snapshots ?? {})) out.set(sym, snap);
      } catch { /* as above */ }
    })());
  }
  await Promise.all(jobs);
  return out;
}

type VaultRow = {
  symbol: string; high52: number | null; low52: number | null;
  avg_volume: number | null; last_close: number | null;
  close_1m: number | null; close_1y: number | null;
};

/**
 * Context from our own daily bars: 52-week extremes, average volume, and the
 * closes 1 month / 1 year back (for trailing returns). One query for the whole
 * list — no per-symbol round trips.
 */
async function vaultStats(symbols: string[]): Promise<Map<string, VaultRow>> {
  const out = new Map<string, VaultRow>();
  if (!symbols.length) return out;
  const now = Math.floor(Date.now() / 1000);
  const y = now - 365 * 86_400;
  const m = now - 30 * 86_400;

  const rows = await db.execute<VaultRow>(dsql`
    with win as (
      select symbol, t, c, v
        from bars
       where timeframe = '1Y'
         and symbol = any(${dsql.raw(`ARRAY[${symbols.map((s) => `'${s.replace(/'/g, "''")}'`).join(",")}]`)})
         and t >= ${y}
    )
    select w.symbol,
           max(w.c)                                              as high52,
           min(w.c)                                              as low52,
           avg(w.v)                                              as avg_volume,
           (array_agg(w.c order by w.t desc))[1]                 as last_close,
           (array_agg(w.c order by abs(w.t - ${m})))[1]          as close_1m,
           (array_agg(w.c order by abs(w.t - ${y})))[1]          as close_1y
      from win w
     group by w.symbol
  `);
  for (const r of Array.from(rows)) out.set(r.symbol, r);
  return out;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Prices that must be > 0 to be real. Outside RTH the IEX feed reports a 0
    bid or ask; showing that as a quote would be a lie, so it becomes null. */
const px = (v: unknown): number | null => {
  const n = num(v);
  return n != null && n > 0 ? n : null;
};

/** Full stats for a symbol list — live session + vault context, merged. */
export async function marketStats(symbols: string[]): Promise<MarketStat[]> {
  const list = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const [snaps, vault] = await Promise.all([fetchSnapshots(list), vaultStats(list)]);

  return list.map((symbol) => {
    const s = snaps.get(symbol);
    const v = vault.get(symbol);

    const price = num(s?.latestTrade?.p) ?? num(s?.dailyBar?.c) ?? num(v?.last_close);
    const prevClose = num(s?.prevDailyBar?.c) ?? num(v?.close_1m) ?? null;
    const change = price != null && prevClose != null ? price - prevClose : null;
    const changePercent = change != null && prevClose ? change / prevClose : null;

    const high52 = num(v?.high52);
    const low52 = num(v?.low52);
    const rangePosition = price != null && high52 != null && low52 != null && high52 > low52
      ? Math.min(1, Math.max(0, (price - low52) / (high52 - low52)))
      : null;

    const c1m = num(v?.close_1m), c1y = num(v?.close_1y);
    return {
      symbol,
      price, prevClose, change, changePercent,
      open: num(s?.dailyBar?.o),
      dayHigh: num(s?.dailyBar?.h),
      dayLow: num(s?.dailyBar?.l),
      volume: num(s?.dailyBar?.v),
      bid: px(s?.latestQuote?.bp),
      ask: px(s?.latestQuote?.ap),
      high52, low52,
      avgVolume: num(v?.avg_volume),
      rangePosition,
      return1M: price != null && c1m ? price / c1m - 1 : null,
      return1Y: price != null && c1y ? price / c1y - 1 : null,
    };
  });
}

export type Movers = {
  gainers: MarketStat[];
  losers: MarketStat[];
  actives: MarketStat[];
  breadth: { advancing: number; declining: number; unchanged: number };
};

/** Movers + breadth across a universe — the market's story at a glance. */
export function moversFrom(stats: MarketStat[], take = 8): Movers {
  const withMove = stats.filter((s) => s.changePercent != null);
  const sorted = [...withMove].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0));
  const byVolume = [...stats].filter((s) => s.volume != null)
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));

  let advancing = 0, declining = 0, unchanged = 0;
  for (const s of withMove) {
    const c = s.changePercent ?? 0;
    if (c > 0.0001) advancing++;
    else if (c < -0.0001) declining++;
    else unchanged++;
  }

  return {
    gainers: sorted.slice(0, take),
    losers: sorted.slice(-take).reverse(),
    actives: byVolume.slice(0, take),
    breadth: { advancing, declining, unchanged },
  };
}
