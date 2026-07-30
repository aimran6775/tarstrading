import "server-only";
import { db, schema } from "./db";
import { and, asc, eq, inArray, sql as dsql } from "drizzle-orm";
import { putQuotes, tryTakeToken, isUSMarketOpen, type Quote, type Provenance } from "./market";
import { fetchSnapshots } from "./marketstats";
import { ensureLiveFeed, setPriorityStocks } from "./live-feed";
import { FX_PAIRS, isFxSymbol, isFxOpen } from "./fx";

/*
  The feeds mesh — every market, live-feeling, on $0/month of data.

  The exchange is SIMULATED, so we don't need a licensed real-time feed; we
  need believable, honestly-labelled prices. Each source below is the best
  free tier for its asset class, and every price it writes carries provenance
  ('live' | 'delayed' | 'eod' | 'derived' | 'indicative') that the UI shows as
  a badge — the PAPER-banner principle applied to data.

  Sources (all verified against the live endpoints before this was written):
  - Equities/ETFs/crypto: Alpaca free, feed=delayed_sip — the CONSOLIDATED
    tape 15 minutes back (IEX-only saw ~4% of volume), batched 100/request.
    Crypto snapshots are genuinely real-time on the free tier.
  - Real-time accents: Alpaca's free IEX websocket allows 30 stock symbols;
    the console's `featured` flags choose which 30 (see syncLiveSlots).
  - FX: ECB reference rates via Frankfurter (keyless, unlimited, daily) —
    one call covers all 16 pairs.
  - Indices: FRED's public CSV for official closes (SPX/COMP/DJI/VIX), the
    Massive free tier for the tickers it allows (NDX/COMP), and intraday
    levels DERIVED from each index's ETF proxy calibrated at yesterday's
    close — labelled 'derived', never passed off as the real print.
  - Futures: Massive's free futures tier (session bars, CME/CBOT/NYMEX/COMEX),
    front month discovered from the contracts endpoint, paced inside the same
    5-req/min token bucket market.ts owns.

  Cadence: sweepBoard + syncLiveSlots run on a 60s beat (api/cron/feeds);
  FX / indices / futures ride the 5-minute heartbeat and no-op until stale.
  Everything runs on the backend service's in-process scheduler — 24/7, no
  browser required.
*/

// ---------- feed status (the console's health board) ----------

async function reportFeed(source: string, ok: boolean, covered: number, detail?: unknown) {
  try {
    const row = {
      lastRunAt: Date.now(), ok: ok ? 1 : 0, covered,
      detail: detail == null ? null : JSON.stringify(detail).slice(0, 4000),
    };
    await db.insert(schema.feedStatus).values({ source, ...row })
      .onConflictDoUpdate({ target: schema.feedStatus.source, set: row });
  } catch { /* health reporting never breaks the feed itself */ }
}

async function readFeedDetail<T>(source: string): Promise<T | null> {
  try {
    const [row] = await db.select().from(schema.feedStatus)
      .where(eq(schema.feedStatus.source, source));
    return row?.detail ? JSON.parse(row.detail) as T : null;
  } catch { return null; }
}

async function feedLastRun(source: string): Promise<number> {
  try {
    const [row] = await db.select().from(schema.feedStatus)
      .where(eq(schema.feedStatus.source, source));
    return row?.lastRunAt ?? 0;
  } catch { return 0; }
}

// ---------- the board (who we sweep) ----------

const isCrypto = (s: string) => s.includes("/") && !isFxSymbol(s);
const isIndex = (s: string) => s.startsWith("IDX:");
const isFuture = (s: string) => s.startsWith("FUT:");

/** Enabled board symbols that Alpaca can quote (equities, ETFs, crypto). */
async function sweepableSymbols(): Promise<string[]> {
  const rows = await db.select({ symbol: schema.platformSymbols.symbol })
    .from(schema.platformSymbols).where(eq(schema.platformSymbols.enabled, 1));
  return rows.map((r) => r.symbol)
    .filter((s) => !isFxSymbol(s) && !isIndex(s) && !isFuture(s));
}

// ---------- 1. the delayed-SIP sweep (equities + crypto, every minute) ----------

/**
 * Refresh the shared quote cache for the WHOLE board in ~17 batched calls.
 * After one sweep every getQuote in the app is an L2 hit — no user request
 * ever waits on an upstream quote again.
 */
export async function sweepBoard(): Promise<{ swept: number; calls: number }> {
  const symbols = await sweepableSymbols();
  if (!symbols.length) { await reportFeed("sweep", true, 0, { note: "empty board" }); return { swept: 0, calls: 0 }; }

  // Off-hours, equities barely move: sweep stocks every 5th beat but crypto
  // (24/7) every beat, so the quiet tape doesn't cost 17 calls a minute all night.
  const stocksDue = isUSMarketOpen() || Date.now() - (await feedLastRun("sweep-stocks")) > 5 * 60_000;
  const list = stocksDue ? symbols : symbols.filter(isCrypto);

  const snaps = await fetchSnapshots(list);
  const quotes: Quote[] = [];
  for (const symbol of list) {
    const s = snaps.get(symbol);
    const price = s?.latestTrade?.p ?? s?.dailyBar?.c;
    const prevClose = s?.prevDailyBar?.c;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;
    const pc = typeof prevClose === "number" && prevClose > 0 ? prevClose : price;
    const tradeAt = s?.latestTrade?.t ? Date.parse(s.latestTrade.t) : NaN;
    quotes.push({
      symbol, price, previousClose: pc,
      changePercent: pc > 0 ? price / pc - 1 : 0,
      asOf: Number.isFinite(tradeAt) ? tradeAt : Date.now(),
      provenance: isCrypto(symbol) ? "live" : "delayed",
    });
  }
  await putQuotes(quotes);

  const calls = Math.ceil(list.filter((s) => !isCrypto(s)).length / 100)
    + Math.ceil(list.filter(isCrypto).length / 100);
  await reportFeed("sweep", quotes.length > 0 || list.length === 0, quotes.length,
    { requested: list.length, stocksIncluded: stocksDue });
  if (stocksDue) await reportFeed("sweep-stocks", true, quotes.length);
  return { swept: quotes.length, calls };
}

// ---------- 2. the 30 real-time slots (featured, from the console) ----------

/**
 * Alpaca's free IEX websocket carries 30 stock symbols. The console decides
 * which: featured symbols first (rank order), then nothing — an explicit
 * budget beats a silent first-come free-for-all. Crypto streams are uncapped,
 * so every listed pair rides the live lane 24/7.
 */
export async function syncLiveSlots(): Promise<{ slots: string[]; crypto: number }> {
  const board = await db.select().from(schema.platformSymbols)
    .where(eq(schema.platformSymbols.enabled, 1))
    .orderBy(asc(schema.platformSymbols.rank), asc(schema.platformSymbols.symbol));

  const slots = board
    .filter((b) => b.featured === 1 && !isCrypto(b.symbol)
      && !isFxSymbol(b.symbol) && !isIndex(b.symbol) && !isFuture(b.symbol))
    .slice(0, 30)
    .map((b) => b.symbol);
  const crypto = board.filter((b) => isCrypto(b.symbol)).map((b) => b.symbol);

  setPriorityStocks(slots);
  ensureLiveFeed([...slots, ...crypto]);
  await reportFeed("live-slots", true, slots.length, { slots, cryptoStreams: crypto.length });
  return { slots, crypto: crypto.length };
}

// ---------- 3. FX daily (ECB reference rates, keyless) ----------

/** USD-per-unit rates from one Frankfurter response → our 16 pairs.
    Pure and exported for tests. Rates are "1 USD buys X of currency". */
export function deriveFxPairs(rates: Record<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  const r = (ccy: string) => {
    const v = rates[ccy];
    return typeof v === "number" && v > 0 ? v : null;
  };
  // Direct: USDXXX = the rate itself; XXXUSD = its inverse.
  const direct: Array<[string, string, boolean]> = [
    ["FX:EURUSD", "EUR", true], ["FX:GBPUSD", "GBP", true], ["FX:AUDUSD", "AUD", true],
    ["FX:NZDUSD", "NZD", true],
    ["FX:USDJPY", "JPY", false], ["FX:USDCHF", "CHF", false], ["FX:USDCAD", "CAD", false],
    ["FX:USDMXN", "MXN", false], ["FX:USDSEK", "SEK", false], ["FX:USDNOK", "NOK", false],
    ["FX:USDSGD", "SGD", false],
  ];
  for (const [pair, ccy, invert] of direct) {
    const v = r(ccy);
    if (v) out.set(pair, invert ? 1 / v : v);
  }
  // Crosses: AAABBB = (USD→BBB) / (USD→AAA).
  const crosses: Array<[string, string, string]> = [
    ["FX:EURGBP", "EUR", "GBP"], ["FX:EURJPY", "EUR", "JPY"], ["FX:GBPJPY", "GBP", "JPY"],
    ["FX:EURCHF", "EUR", "CHF"], ["FX:AUDJPY", "AUD", "JPY"],
  ];
  for (const [pair, base, quote] of crosses) {
    const b = r(base), q = r(quote);
    if (b && q) out.set(pair, q / b);
  }
  return out;
}

/**
 * Once a day (ECB publishes ~16:00 CET on business days), refresh all pairs
 * from one keyless call. Writes the shared quote cache (provenance 'eod') and
 * appends the daily bar so charts and exchange marks stay continuous.
 */
export async function fxDailyTick(): Promise<{ pairs: number } | { skipped: string }> {
  const last = await feedLastRun("fx");
  if (Date.now() - last < 6 * 3600_000) return { skipped: "fresh" };

  let json: { date?: string; rates?: Record<string, number> };
  try {
    const res = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,JPY,CHF,CAD,AUD,NZD,MXN,SEK,NOK,SGD",
      { cache: "no-store" });
    if (!res.ok) throw new Error(`frankfurter ${res.status}`);
    json = await res.json();
  } catch (e) {
    await reportFeed("fx", false, 0, { error: e instanceof Error ? e.message : "fetch failed" });
    return { skipped: "fetch failed" };
  }
  const pairs = deriveFxPairs(json.rates ?? {});
  if (!pairs.size) { await reportFeed("fx", false, 0, { error: "no rates" }); return { skipped: "no rates" }; }

  // Previous stored close per pair, for an honest day-change anchor.
  const list = [...pairs.keys()];
  const prevRows = await db.execute<{ symbol: string; c: number }>(dsql`
    select distinct on (symbol) symbol, c from bars
     where timeframe = '1Y' and symbol = any(${dsql.raw(`ARRAY[${list.map((s) => `'${s}'`).join(",")}]`)})
     order by symbol, t desc
  `);
  const prev = new Map(Array.from(prevRows).map((r) => [r.symbol, r.c]));

  const asOf = json.date ? Date.parse(`${json.date}T15:00:00Z`) : Date.now(); // ~16:00 CET
  const quotes: Quote[] = list.map((symbol) => {
    const price = pairs.get(symbol)!;
    const pc = prev.get(symbol) ?? price;
    return { symbol, price, previousClose: pc,
      changePercent: pc > 0 ? price / pc - 1 : 0, asOf, provenance: "eod" };
  });
  await putQuotes(quotes);

  // The daily bar: a single reference print, o=h=l=c. onConflictDoNothing so a
  // real OHLC bar (Massive backfill) always wins over the flat ECB point.
  const dayT = json.date ? Math.floor(Date.parse(`${json.date}T00:00:00Z`) / 1000) : null;
  if (dayT) {
    await db.insert(schema.bars).values(list.map((symbol) => ({
      symbol, timeframe: "1Y" as const, t: dayT,
      o: pairs.get(symbol)!, h: pairs.get(symbol)!, l: pairs.get(symbol)!, c: pairs.get(symbol)!, v: 0,
    }))).onConflictDoNothing();
  }
  await reportFeed("fx", true, quotes.length, { date: json.date });
  return { pairs: quotes.length };
}

// ---------- 4. indices (FRED closes + Massive where entitled + ETF-derived intraday) ----------

type IndexDef = {
  symbol: string; name: string;
  fred?: string;      // FRED series id for the official close
  massive?: string;   // Massive index ticker the FREE tier is entitled to
  proxy?: string;     // ETF whose intraday move drives the derived level
};

/** The reference indices. Verified entitlements: Massive free allows I:NDX and
    I:COMP but NOT SPX/DJI/RUT/VIX; FRED publishes SP500/NASDAQCOM/DJIA/VIXCLS.
    RUT has no free official source at all — its level is proxy-derived from a
    calibration seed and always wears the DERIVED badge. */
export const INDICES: IndexDef[] = [
  { symbol: "IDX:SPX", name: "S&P 500", fred: "SP500", proxy: "SPY" },
  { symbol: "IDX:NDX", name: "Nasdaq 100", massive: "I:NDX", proxy: "QQQ" },
  { symbol: "IDX:COMP", name: "Nasdaq Composite", fred: "NASDAQCOM", massive: "I:COMP" },
  { symbol: "IDX:DJI", name: "Dow Jones Industrial Average", fred: "DJIA", proxy: "DIA" },
  { symbol: "IDX:RUT", name: "Russell 2000", proxy: "IWM" },
  { symbol: "IDX:VIX", name: "CBOE Volatility Index", fred: "VIXCLS" },
];

/** Fallback index/ETF ratios, used only until a real close calibrates them.
    Approximate by nature — which is exactly what the DERIVED badge admits. */
const SEED_RATIOS: Record<string, number> = {
  "IDX:SPX": 10.02, "IDX:NDX": 41.3, "IDX:DJI": 100.3, "IDX:RUT": 9.94,
};

type IndexCal = { ratios: Record<string, number>; closes: Record<string, { price: number; date: string }> };

/** Parse a FRED fredgraph.csv body into series → latest value + date.
    Pure and exported for tests. */
export function parseFredCsv(csv: string): Map<string, { value: number; date: string }> {
  const out = new Map<string, { value: number; date: string }>();
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return out;
  const header = lines[0].split(",").map((h) => h.trim());
  for (const line of lines.slice(1)) {
    const cells = line.split(",");
    const date = cells[0]?.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) continue;
    for (let i = 1; i < header.length; i++) {
      const v = Number(cells[i]);
      // Last valid observation wins (rows are chronological; gaps are blank).
      if (Number.isFinite(v) && v > 0) out.set(header[i], { value: v, date: date! });
    }
  }
  return out;
}

/**
 * Daily: pull official closes (FRED + entitled Massive tickers), recalibrate
 * each index's ETF ratio at that close, and list the indices on the board.
 * Intraday levels come from indicesIntradayTick using those ratios.
 */
export async function indicesDailyTick(): Promise<{ indices: number } | { skipped: string }> {
  const last = await feedLastRun("indices-daily");
  if (Date.now() - last < 6 * 3600_000) return { skipped: "fresh" };

  const cal: IndexCal = (await readFeedDetail<IndexCal>("indices-daily")) ?? { ratios: {}, closes: {} };
  let ok = true;

  // FRED: one CSV for every series we use.
  try {
    const ids = INDICES.map((i) => i.fred).filter(Boolean).join(",");
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    const res = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ids}&cosd=${since}`,
      { cache: "no-store" });
    if (!res.ok) throw new Error(`fred ${res.status}`);
    const latest = parseFredCsv(await res.text());
    for (const def of INDICES) {
      const hit = def.fred ? latest.get(def.fred) : undefined;
      if (hit) cal.closes[def.symbol] = { price: hit.value, date: hit.date };
    }
  } catch { ok = false; }

  // Massive: only the entitled tickers, inside the shared 5/min budget.
  for (const def of INDICES) {
    if (!def.massive || cal.closes[def.symbol]) continue;
    if (!tryTakeToken()) break;
    try {
      const key = process.env.MASSIVE_API_KEY ?? "";
      const res = await fetch(
        `https://api.massive.com/v2/aggs/ticker/${def.massive}/prev?apiKey=${key}`, { cache: "no-store" });
      const json = await res.json() as { results?: { c: number; t: number }[] };
      const bar = json.results?.[0];
      if (bar?.c) cal.closes[def.symbol] = { price: bar.c, date: new Date(bar.t).toISOString().slice(0, 10) };
    } catch { /* next daily tick retries */ }
  }

  // Recalibrate ratios where we hold both the official close and the proxy's
  // close for the same day (from our own bar vault).
  const proxies = INDICES.map((i) => i.proxy).filter((p): p is string => !!p);
  const proxyRows = await db.select().from(schema.bars)
    .where(and(eq(schema.bars.timeframe, "1Y"), inArray(schema.bars.symbol, proxies)))
    .orderBy(asc(schema.bars.t));
  const proxyCloseByDay = new Map<string, number>();
  for (const r of proxyRows) {
    proxyCloseByDay.set(`${r.symbol}:${new Date(r.t * 1000).toISOString().slice(0, 10)}`, r.c);
  }
  for (const def of INDICES) {
    const close = cal.closes[def.symbol];
    if (!def.proxy || !close) continue;
    const proxyClose = proxyCloseByDay.get(`${def.proxy}:${close.date}`);
    if (proxyClose && proxyClose > 0) cal.ratios[def.symbol] = close.price / proxyClose;
  }

  // Publish EOD quotes and make sure each index is listed on the board.
  // An index with no official source at all (RUT — no free feed anywhere)
  // still gets an overnight level: ratio × its proxy's last close, wearing
  // DERIVED. Without this it would sit priceless every night and weekend.
  const proxyLastClose = new Map<string, { price: number; date: string }>();
  for (const r of proxyRows) {
    proxyLastClose.set(r.symbol, { price: r.c, date: new Date(r.t * 1000).toISOString().slice(0, 10) });
  }
  const quotes: Quote[] = [];
  for (const def of INDICES) {
    const close = cal.closes[def.symbol];
    if (close) {
      quotes.push({
        symbol: def.symbol, price: close.price, previousClose: close.price,
        changePercent: 0, asOf: Date.parse(`${close.date}T21:00:00Z`), provenance: "eod",
      });
      continue;
    }
    const proxy = def.proxy ? proxyLastClose.get(def.proxy) : undefined;
    const ratio = cal.ratios[def.symbol] ?? SEED_RATIOS[def.symbol];
    if (proxy && ratio) {
      quotes.push({
        symbol: def.symbol, price: ratio * proxy.price, previousClose: ratio * proxy.price,
        changePercent: 0, asOf: Date.parse(`${proxy.date}T21:00:00Z`), provenance: "derived",
      });
    }
  }
  await putQuotes(quotes);
  await db.insert(schema.platformSymbols).values(INDICES.map((def, i) => ({
    symbol: def.symbol, category: "indices", rank: 5 + i, featured: 0, enabled: 1,
    note: def.name, addedAt: Date.now(),
  }))).onConflictDoNothing();

  await reportFeed("indices-daily", ok, quotes.length, cal);
  return { indices: quotes.length };
}

/**
 * Intraday (each fast beat during market hours): level = ratio × proxy price.
 * The proxy quote is itself 15-min-delayed SIP, so the derived level inherits
 * that honesty; provenance says 'derived' because the NUMBER is computed, not
 * printed by any exchange.
 */
export async function indicesIntradayTick(): Promise<number> {
  if (!isUSMarketOpen()) return 0;
  const cal = await readFeedDetail<IndexCal>("indices-daily");
  const proxies = INDICES.map((i) => i.proxy).filter((p): p is string => !!p);
  const proxyQuotes = await db.select().from(schema.quoteCache)
    .where(inArray(schema.quoteCache.symbol, proxies));
  const bySymbol = new Map(proxyQuotes.map((q) => [q.symbol, q]));

  const quotes: Quote[] = [];
  for (const def of INDICES) {
    if (!def.proxy) continue; // no proxy → EOD-only (COMP without QQQ, VIX)
    const ratio = cal?.ratios[def.symbol] ?? SEED_RATIOS[def.symbol];
    const proxy = bySymbol.get(def.proxy);
    if (!ratio || !proxy || Date.now() - proxy.updatedAt > 10 * 60_000) continue;
    const price = ratio * proxy.price;
    const prevClose = cal?.closes[def.symbol]?.price ?? ratio * proxy.previousClose;
    quotes.push({
      symbol: def.symbol, price, previousClose: prevClose,
      changePercent: prevClose > 0 ? price / prevClose - 1 : 0,
      asOf: proxy.asOf, provenance: "derived",
    });
  }
  await putQuotes(quotes);
  return quotes.length;
}

// ---------- 5. futures (Massive free tier — session bars, front month) ----------

type FuturesProduct = { code: string; name: string };

/** The majors across CME/CBOT/NYMEX/COMEX — index, energy, metals, grains, rates, FX. */
export const FUTURES_PRODUCTS: FuturesProduct[] = [
  { code: "ES", name: "E-mini S&P 500" }, { code: "NQ", name: "E-mini Nasdaq 100" },
  { code: "YM", name: "E-mini Dow" }, { code: "RTY", name: "E-mini Russell 2000" },
  { code: "CL", name: "Crude Oil (WTI)" }, { code: "NG", name: "Natural Gas" },
  { code: "GC", name: "Gold" }, { code: "SI", name: "Silver" }, { code: "HG", name: "Copper" },
  { code: "ZC", name: "Corn" }, { code: "ZS", name: "Soybeans" }, { code: "ZW", name: "Wheat" },
  { code: "ZN", name: "10-Year T-Note" }, { code: "6E", name: "Euro FX" },
];

type FuturesState = {
  /** product code → current front-month contract ticker (e.g. ES → ESU6). */
  front: Record<string, { ticker: string; lastTradeDate: string }>;
};

const MASSIVE = "https://api.massive.com";

/** Pick the front month from a contract list: nearest last_trade_date that is
    at least 3 days out (roll before expiry week chaos). Pure, for tests. */
export function pickFrontMonth(
  contracts: Array<{ ticker: string; last_trade_date?: string }>, todayIso: string,
): { ticker: string; lastTradeDate: string } | null {
  const floor = new Date(Date.parse(todayIso) + 3 * 86_400_000).toISOString().slice(0, 10);
  const live = contracts
    .filter((c) => typeof c.last_trade_date === "string" && c.last_trade_date >= floor)
    .sort((a, b) => a.last_trade_date!.localeCompare(b.last_trade_date!));
  const f = live[0];
  return f ? { ticker: f.ticker, lastTradeDate: f.last_trade_date! } : null;
}

/**
 * Budgeted futures refresh: discovery and session-bar pulls both ride the
 * shared Massive token bucket (max 4/min), so a full pass over 14 products
 * spreads across a few heartbeats — fine for EOD-provenance data.
 */
export async function futuresTick(): Promise<{ updated: number } | { skipped: string }> {
  const key = process.env.MASSIVE_API_KEY ?? "";
  if (!key) return { skipped: "no key" };
  const last = await feedLastRun("futures");
  if (Date.now() - last < 3600_000) return { skipped: "fresh" };

  const state: FuturesState = (await readFeedDetail<FuturesState>("futures")) ?? { front: {} };
  const today = new Date().toISOString().slice(0, 10);
  let updated = 0;
  let ok = true;

  for (const product of FUTURES_PRODUCTS) {
    // 1. Front-month discovery — refresh when unknown or within the roll window.
    let front = state.front[product.code];
    if (!front || front.lastTradeDate <= new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10)) {
      if (!tryTakeToken()) break;
      try {
        const res = await fetch(
          `${MASSIVE}/futures/v1/contracts?product_code=${product.code}&active=true&limit=50&apiKey=${key}`,
          { cache: "no-store" });
        const json = await res.json() as { results?: Array<{ ticker: string; last_trade_date?: string }> };
        const picked = pickFrontMonth(json.results ?? [], today);
        if (picked) { front = picked; state.front[product.code] = picked; }
      } catch { ok = false; continue; }
    }
    if (!front) continue;

    const symbol = `FUT:${front.ticker}`;

    // 2. Skip contracts whose stored quote is already fresh enough (12h).
    const [cached] = await db.select().from(schema.quoteCache)
      .where(eq(schema.quoteCache.symbol, symbol));
    if (cached && Date.now() - cached.updatedAt < 12 * 3600_000) continue;

    // 3. Session bars — one call returns the contract's whole life (~750 max).
    if (!tryTakeToken()) break;
    try {
      const res = await fetch(
        `${MASSIVE}/futures/v1/aggs/${front.ticker}?resolution=1session&limit=750&sort=window_start.asc&apiKey=${key}`,
        { cache: "no-store" });
      const json = await res.json() as {
        results?: Array<{ window_start: number; session_end_date: string;
          open: number; high: number; low: number; close: number; volume: number }>;
      };
      const bars = (json.results ?? []).filter((b) => b.close > 0);
      if (!bars.length) continue;

      await db.insert(schema.bars).values(bars.map((b) => ({
        symbol, timeframe: "1Y" as const,
        t: Math.floor(b.window_start / 1e9), // ns → s
        o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume,
      }))).onConflictDoUpdate({
        target: [schema.bars.symbol, schema.bars.timeframe, schema.bars.t],
        set: { o: dsql`excluded.o`, h: dsql`excluded.h`, l: dsql`excluded.l`,
          c: dsql`excluded.c`, v: dsql`excluded.v` },
      });

      const lastBar = bars[bars.length - 1];
      const prevBar = bars[bars.length - 2];
      const pc = prevBar?.close ?? lastBar.close;
      await putQuotes([{
        symbol, price: lastBar.close, previousClose: pc,
        changePercent: pc > 0 ? lastBar.close / pc - 1 : 0,
        asOf: Date.parse(`${lastBar.session_end_date}T21:00:00Z`), provenance: "eod",
      }]);
      await db.insert(schema.platformSymbols).values({
        symbol, category: "futures", rank: 20, featured: 0, enabled: 1,
        note: `${product.name} — front month`, addedAt: Date.now(),
      }).onConflictDoNothing();
      updated++;
    } catch { ok = false; }
  }

  // Only mark the pass complete when every product got a look; a token-starved
  // partial pass reruns next heartbeat instead of sleeping an hour.
  const complete = FUTURES_PRODUCTS.every((p) => state.front[p.code]);
  if (complete) await reportFeed("futures", ok, updated, state);
  else await db.insert(schema.feedStatus)
    .values({ source: "futures", lastRunAt: last || null, ok: ok ? 1 : 0, covered: updated,
      detail: JSON.stringify(state).slice(0, 4000) })
    .onConflictDoUpdate({ target: schema.feedStatus.source,
      set: { ok: ok ? 1 : 0, covered: updated, detail: JSON.stringify(state).slice(0, 4000) } });
  return { updated };
}

// ---------- the two beats ----------

/** The 60-second beat: whole-board quotes + the live-slot roster. */
export async function feedsFastTick() {
  const [sweep, slots] = await Promise.allSettled([sweepBoard(), syncLiveSlots()]);
  const intraday = await indicesIntradayTick().catch(() => 0);
  return {
    sweep: sweep.status === "fulfilled" ? sweep.value : { swept: 0, calls: 0 },
    liveSlots: slots.status === "fulfilled" ? slots.value.slots.length : 0,
    indicesDerived: intraday,
  };
}

/** The 5-minute beat (rides the platform heartbeat): the slow feeds, each of
    which no-ops until it's actually stale. */
export async function feedsSlowTick() {
  const [fx, idx, fut] = await Promise.allSettled([
    fxDailyTick(), indicesDailyTick(), futuresTick(),
  ]);
  const val = <T,>(r: PromiseSettledResult<T>) => r.status === "fulfilled" ? r.value : { error: true };
  return { fx: val(fx), indices: val(idx), futures: val(fut) };
}

/** Note FX open state for the FX card refresh choices upstream. */
export { isFxOpen, FX_PAIRS };
