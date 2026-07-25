import "server-only";
import { db, schema } from "./db";
import { and, eq, sql as dsql } from "drizzle-orm";
import type { Timeframe } from "./market";

/*
  The historian — bulk historical loader on Alpaca's market-data API.

  Why a second source: the Massive/Polygon free tier allows 5 requests/minute,
  one symbol at a time, which makes filling a 50-symbol board take days. Alpaca
  (whose keys we already hold for trading) allows ~200 requests/minute AND
  returns MANY SYMBOLS PER REQUEST — so the whole board's 5-year daily history
  is a handful of calls instead of thousands.

  Division of labour:
  - historian (this file)  → deep history, run on demand from the control center
  - market.ts syncSeries   → the live tail, kept fresh by the 5-min heartbeat
  Both write the same `bars` table and `sync_state`, so charts don't care which
  filled them.
*/

const DATA = "https://data.alpaca.markets";
const KEY = process.env.ALPACA_KEY_ID ?? "";
const SECRET = process.env.ALPACA_SECRET_KEY ?? "";
export const historianReady = KEY.length > 0 && SECRET.length > 0;

/** Alpaca's bar shape. */
type AlpacaBar = { t: string; o: number; h: number; l: number; c: number; v: number };

/** Timeframes we deep-fill, and how Alpaca names them + how far back to go. */
const DEEP: Record<string, { alpaca: string; days: number; tf: Timeframe }> = {
  // Five years of daily bars backs 1M / 3M / 1Y views (they window the store).
  daily: { alpaca: "1Day", days: 1830, tf: "1Y" },
  // Weekly bars for the 5Y view.
  weekly: { alpaca: "1Week", days: 1830, tf: "5Y" },
};

const headers = () => ({
  "APCA-API-KEY-ID": KEY,
  "APCA-API-SECRET-KEY": SECRET,
  accept: "application/json",
});

const isCrypto = (s: string) => s.includes("/");
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Fetch bars for MANY symbols in one call (paging through next_page_token).
 * Returns symbol → bars. Stocks and crypto use different endpoints.
 */
async function fetchBatch(
  symbols: string[], alpacaTf: string, startMs: number, endMs: number,
): Promise<Map<string, AlpacaBar[]>> {
  const out = new Map<string, AlpacaBar[]>();
  if (!symbols.length) return out;

  const crypto = isCrypto(symbols[0]);
  const base = crypto
    ? `${DATA}/v1beta3/crypto/us/bars`
    : `${DATA}/v2/stocks/bars`;

  let pageToken: string | null = null;
  do {
    const qs = new URLSearchParams({
      symbols: symbols.join(","),
      timeframe: alpacaTf,
      start: iso(startMs),
      end: iso(endMs),
      limit: "10000",
    });
    // Split/dividend-adjusted prices for equities — charts should be continuous.
    if (!crypto) { qs.set("adjustment", "split"); qs.set("feed", "iex"); }
    if (pageToken) qs.set("page_token", pageToken);

    const res = await fetch(`${base}?${qs}`, { headers: headers(), cache: "no-store" });
    if (!res.ok) throw new Error(`alpaca ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const json = await res.json() as { bars?: Record<string, AlpacaBar[]>; next_page_token?: string | null };

    for (const [sym, bars] of Object.entries(json.bars ?? {})) {
      const prev = out.get(sym) ?? [];
      out.set(sym, prev.concat(bars ?? []));
    }
    pageToken = json.next_page_token ?? null;
  } while (pageToken);

  return out;
}

/** Write bars for one symbol/timeframe and refresh its sync_state row. */
async function store(symbol: string, tf: Timeframe, bars: AlpacaBar[]) {
  if (!bars.length) return 0;
  const rows = bars.map((b) => ({
    symbol, timeframe: tf,
    t: Math.floor(new Date(b.t).getTime() / 1000),
    o: b.o, h: b.h, l: b.l, c: b.c, v: b.v,
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

  const [agg] = await db.select({
    n: dsql<number>`count(*)::int`,
    lo: dsql<number>`min(t)::bigint`,
    hi: dsql<number>`max(t)::bigint`,
  }).from(schema.bars)
    .where(and(eq(schema.bars.symbol, symbol), eq(schema.bars.timeframe, tf)));

  const state = {
    earliest: agg?.lo ?? null, latest: agg?.hi ?? null,
    barCount: agg?.n ?? rows.length,
    lastSyncAt: Date.now(), status: "ok" as const, lastError: null,
  };
  await db.insert(schema.syncState)
    .values({ id: `${symbol}:${tf}`, symbol, timeframe: tf, ...state })
    .onConflictDoUpdate({ target: schema.syncState.id, set: state });
  return rows.length;
}

export type DeepFillReport = {
  ok: boolean;
  symbols: number;
  requests: number;
  barsWritten: number;
  errors: string[];
  skipped?: string;
};

/**
 * Deep-fill history for the given symbols (default: the whole enabled board).
 * Batches by asset class, 100 symbols per request, both deep timeframes.
 */
export async function deepFill(symbols?: string[], years = 5): Promise<DeepFillReport> {
  if (!historianReady) {
    return { ok: false, symbols: 0, requests: 0, barsWritten: 0, errors: [], skipped: "Alpaca keys not configured." };
  }

  let list = symbols?.map((s) => s.toUpperCase());
  if (!list?.length) {
    const board = await db.select({ symbol: schema.platformSymbols.symbol })
      .from(schema.platformSymbols).where(eq(schema.platformSymbols.enabled, 1));
    list = board.map((b) => b.symbol);
  }
  if (!list.length) return { ok: true, symbols: 0, requests: 0, barsWritten: 0, errors: [] };

  const end = Date.now();
  const start = end - years * 365 * 86_400_000;
  const stocks = list.filter((s) => !isCrypto(s));
  const cryptos = list.filter(isCrypto);

  let requests = 0, barsWritten = 0;
  const errors: string[] = [];

  for (const { alpaca, tf } of Object.values(DEEP)) {
    for (const group of [stocks, cryptos]) {
      // Alpaca accepts many symbols per call; 100 keeps URLs sane.
      for (let i = 0; i < group.length; i += 100) {
        const chunk = group.slice(i, i + 100);
        if (!chunk.length) continue;
        try {
          const batch = await fetchBatch(chunk, alpaca, start, end);
          requests++;
          for (const [sym, bars] of batch) barsWritten += await store(sym, tf, bars);
        } catch (e) {
          errors.push(`${alpaca}/${chunk[0]}…: ${e instanceof Error ? e.message : "failed"}`);
        }
      }
    }
  }

  return { ok: errors.length === 0, symbols: list.length, requests, barsWritten, errors };
}

/*
  Which board symbols still have no stored bars — the console's cold list.
  Deliberately ONE anti-join in SQL: an earlier two-query version (fetch board,
  fetch distinct warm symbols, diff in JS) under-reported and called a cold
  board clean, which is the worst failure mode for a health check.
*/
export async function coldSymbols(): Promise<string[]> {
  const rows = await db.execute<{ symbol: string }>(dsql`
    select p.symbol
      from platform_symbols p
      left join (select distinct symbol from bars) b on b.symbol = p.symbol
     where p.enabled = 1 and b.symbol is null
     order by p.symbol
  `);
  return Array.from(rows).map((r) => r.symbol);
}
