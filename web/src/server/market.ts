import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { and, asc, eq, inArray, sql as dsql } from "drizzle-orm";
import { livePrice, ensureLiveFeed } from "./live-feed";

/*
  Market data service. Massive (formerly Polygon.io) proxied server-side ONLY —
  the API key never reaches the client. Free tier is 5 req/min EOD, so the
  architecture is "fetch once, keep forever":

  - HISTORICAL BARS ARE STORED, NOT CACHED. Chart reads hit Postgres; only the
    missing tail of a series ever goes upstream. After first backfill a symbol
    costs ~zero API calls until new bars exist.
  - Quotes: L1 in-memory (instance) → L2 Postgres quote_cache (fleet) → Massive.
  - Every fresh quote is also appended to quote_history, so intraday charts get
    denser over time even on an EOD data plan.
  - Every upstream request is logged to api_calls — the admin dashboard's feed.
  - Token bucket (never 429 by design); request handlers never block on it.
  Without a key, a deterministic demo market takes over (same shapes).
*/

/** Where a price came from — carried to the UI as a badge, same honesty
    principle as the PAPER banner. */
export type Provenance = "live" | "delayed" | "eod" | "derived" | "indicative";

export type Quote = {
  symbol: string;
  price: number;
  previousClose: number;
  changePercent: number;
  asOf: number; // epoch ms
  provenance: Provenance;
};

export type BarPoint = {
  time: number; // epoch seconds (lightweight-charts convention)
  open: number; high: number; low: number; close: number; volume: number;
};

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";

const BASE = "https://api.massive.com";
const KEY = process.env.MASSIVE_API_KEY ?? "";
export const hasLiveData = KEY.length > 0;

const QUOTE_TTL = 5 * 60_000;

/*
  Mesh-fed symbols (FX / indices / futures) update on their own slower clocks —
  daily ECB rates, official closes, session bars. Judging their cache rows by
  the equity 5-minute rule made every index quote "stale" all night: getQuote
  rejected the perfectly good close, burned a Massive token on a ticker Massive
  can't quote, and served null — a blank price over a real number.
*/
const MESH_RE = /^(FX|IDX|FUT):/;
const MESH_TTL = 4 * 86_400_000; // rides out weekends and holidays
const cacheTtlFor = (symbol: string) => (MESH_RE.test(symbol) ? MESH_TTL : QUOTE_TTL);

// ---------- rate limiter (token bucket: 5/min, leave 1 in reserve) ----------
const stamps: number[] = [];

/** Take a token if one is free right now. Never waits. */
export function tryTakeToken(): boolean {
  const now = Date.now();
  while (stamps.length && now - stamps[0] > 60_000) stamps.shift();
  if (stamps.length < 4) { stamps.push(now); return true; }
  return false;
}

/** Tokens currently free — the backfill worker only spends leftovers. */
export function freeTokens(): number {
  const now = Date.now();
  while (stamps.length && now - stamps[0] > 60_000) stamps.shift();
  return Math.max(0, 4 - stamps.length);
}

/** Wait for a token — background warmers only, NEVER request handlers. */
async function takeToken() {
  for (;;) {
    if (tryTakeToken()) return;
    const now = Date.now();
    await new Promise((r) => setTimeout(r, Math.max(1_000, 61_000 - (now - stamps[0]))));
  }
}

// ---------- L1 in-memory cache ----------
const cache = new Map<string, { at: number; data: unknown }>();
function cached<T>(key: string, ttlMs: number): T | undefined {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data as T;
  return undefined;
}
function store(key: string, data: unknown) {
  cache.set(key, { at: Date.now(), data });
}

function massiveTicker(symbol: string): string {
  // Crypto → X:BTCUSD, FX → C:EURUSD, everything else is already the ticker.
  // Without the FX branch a pair reached upstream as "FX:EURUSD" and 404'd, so
  // resting FX orders could never be priced and never filled.
  if (symbol.startsWith("FX:")) return "C:" + symbol.slice(3);
  return symbol.includes("/") ? "X:" + symbol.replace("/", "") : symbol;
}

// ---------- upstream, instrumented ----------
async function logCall(endpoint: string, status: number, ms: number) {
  try {
    await db.insert(schema.apiCalls).values({
      id: randomUUID(), provider: "massive", endpoint, status, ms, createdAt: Date.now(),
    });
  } catch { /* the ledger never breaks the request */ }
}

async function massive<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("apiKey", KEY);
  // Log the path only — never the key.
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch (e) {
    void logCall(path, -1, Date.now() - t0);
    throw e;
  }
  void logCall(path, res.status, Date.now() - t0);
  if (res.status === 401 || res.status === 403) throw new Error("market-unauthorized");
  if (res.status === 429) throw new Error("market-rate-limited");
  if (!res.ok) throw new Error(`market-http-${res.status}`);
  return res.json() as Promise<T>;
}

// In-flight background warmers, deduped per cache key.
const warming = new Map<string, Promise<void>>();
function warm(key: string, job: () => Promise<void>) {
  if (warming.has(key)) return;
  warming.set(key, job().catch(() => {}).finally(() => warming.delete(key)));
}

type PrevReply = { results?: { o: number; c: number; t: number }[] };
type AggsReply = { results?: { t: number; o: number; h: number; l: number; c: number; v: number }[] };

// ---------- L2: shared Postgres quote cache ----------
function rowToQuote(r: typeof schema.quoteCache.$inferSelect): Quote {
  return { symbol: r.symbol, price: r.price, previousClose: r.previousClose,
    changePercent: r.changePercent, asOf: r.asOf, provenance: r.source };
}

/** Read fresh (< TTL) quotes from the shared cache for the given symbols. */
async function readQuoteCacheBatch(symbols: string[]): Promise<Map<string, Quote>> {
  if (!symbols.length) return new Map();
  try {
    const rows = await db.select().from(schema.quoteCache)
      .where(inArray(schema.quoteCache.symbol, symbols));
    const now = Date.now();
    const map = new Map<string, Quote>();
    for (const r of rows) if (now - r.updatedAt < cacheTtlFor(r.symbol)) map.set(r.symbol, rowToQuote(r));
    return map;
  } catch { return new Map(); } // cache is an optimization — never fail the request on it
}

/** Upsert a freshly fetched quote into the shared cache + tick history. */
async function writeQuoteCache(q: Quote): Promise<void> {
  try {
    const now = Date.now();
    await db.insert(schema.quoteCache)
      .values({ symbol: q.symbol, price: q.price, previousClose: q.previousClose,
        changePercent: q.changePercent, asOf: q.asOf, updatedAt: now, source: q.provenance })
      .onConflictDoUpdate({
        target: schema.quoteCache.symbol,
        set: { price: q.price, previousClose: q.previousClose,
          changePercent: q.changePercent, asOf: q.asOf, updatedAt: now, source: q.provenance },
      });
    // The tick log: intraday charts grow denser with every fresh quote.
    await db.insert(schema.quoteHistory)
      .values({ symbol: q.symbol, t: now, price: q.price })
      .onConflictDoNothing();
  } catch { /* best-effort */ }
}

/**
 * The feeds mesh's write path (see feeds.ts): store many quotes in L1 + L2
 * with their provenance, in a handful of batched statements — the whole-board
 * sweep runs every minute, and 1,700 per-symbol round trips to Postgres per
 * minute would be its own denial of service. No quote_history append here:
 * the sweep is mostly unchanged prices (retention noise, not chart density);
 * history still grows from the websocket/getQuote path.
 */
export async function putQuotes(quotes: Quote[]): Promise<void> {
  if (!quotes.length) return;
  const now = Date.now();
  for (const q of quotes) store(`q:${q.symbol}`, q);
  try {
    for (let i = 0; i < quotes.length; i += 500) {
      await db.insert(schema.quoteCache)
        .values(quotes.slice(i, i + 500).map((q) => ({
          symbol: q.symbol, price: q.price, previousClose: q.previousClose,
          changePercent: q.changePercent, asOf: q.asOf, updatedAt: now, source: q.provenance,
        })))
        .onConflictDoUpdate({
          target: schema.quoteCache.symbol,
          set: {
            price: dsql`excluded.price`, previousClose: dsql`excluded.previous_close`,
            changePercent: dsql`excluded.change_percent`, asOf: dsql`excluded.as_of`,
            updatedAt: dsql`excluded.updated_at`, source: dsql`excluded.source`,
          },
        });
    }
  } catch { /* best-effort — the sweep retries next tick */ }
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const reply = await massive<PrevReply>(`/v2/aggs/ticker/${massiveTicker(symbol)}/prev`);
  const bar = reply.results?.[0];
  if (!bar) return null;
  const quote: Quote = {
    symbol,
    price: bar.c,
    previousClose: bar.o,
    changePercent: bar.o > 0 ? bar.c / bar.o - 1 : 0,
    asOf: bar.t,
    provenance: "eod", // Massive prev-day aggregate — a close, not a tick
  };
  store(`q:${symbol}`, quote);     // L1 (this instance)
  await writeQuoteCache(quote);    // L2 (shared) — so other instances skip the fetch
  return quote;
}

/** Overlay the freshest websocket tick on top of a baseline quote — price and
    asOf go live, previousClose (and so day-change %) stays from the daily
    tier, which is exactly the anchor a change number needs. */
function withLive(q: Quote): Quote {
  const t = livePrice(q.symbol);
  if (!t) return q;
  return {
    ...q,
    price: t.price,
    changePercent: q.previousClose > 0 ? t.price / q.previousClose - 1 : q.changePercent,
    asOf: t.at,
    provenance: "live", // a real trade tick beat the baseline
  };
}

/**
 * Never blocks on the rate limiter: cache hit wins; a free token fetches
 * inline (fast); otherwise a background warmer is scheduled and the caller
 * gets null NOW — the UI shows an honest gap and the next poll fills it.
 */
export async function getQuote(symbol: string): Promise<Quote | null> {
  // Subscribe the symbol to the live tick stream on EVERY request — even a cache
  // hit — so anything we price (a held position, a marked account) keeps getting
  // real-time ticks, not just symbols on the watchlist poll. Cheap + deduped.
  ensureLiveFeed([symbol]);
  const key = `q:${symbol}`;
  const hit = cached<Quote>(key, cacheTtlFor(symbol));
  if (hit) return withLive(hit);             // L1 (+ live tick overlay)
  if (!hasLiveData) return withLive(demoQuote(symbol));
  const l2 = (await readQuoteCacheBatch([symbol])).get(symbol);
  if (l2) { store(key, l2); return withLive(l2); } // L2 (shared)
  // Indices and futures are priced ONLY by the feeds mesh — Massive's
  // stock-quote path can't answer for them, so a miss is a miss.
  if (/^(IDX|FUT):/.test(symbol)) return null;
  if (tryTakeToken()) {
    try {
      const q = await fetchQuote(symbol);
      return q ? withLive(q) : null;
    } catch {
      return null; // one bad symbol never sinks a batch
    }
  }
  warm(key, async () => {
    await takeToken();
    await fetchQuote(symbol);
  });
  return null;
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  // Keep every requested symbol subscribed to the live feed — this is what makes
  // markEquity/reconcile mark held positions to the real-time tick, not the EOD
  // close. The feed dedupes and no-ops without a key.
  ensureLiveFeed(symbols);
  const out: Quote[] = [];
  const need: string[] = [];
  for (const s of symbols) {
    const l1 = cached<Quote>(`q:${s}`, cacheTtlFor(s));
    if (l1) out.push(withLive(l1)); else need.push(s);
  }
  if (!need.length) return out;
  if (!hasLiveData) { for (const s of need) out.push(withLive(demoQuote(s))); return out; }

  // One batched L2 read for the whole watchlist instead of N round-trips.
  const l2 = await readQuoteCacheBatch(need);
  const miss: string[] = [];
  for (const s of need) {
    const q = l2.get(s);
    if (q) { store(`q:${s}`, q); out.push(withLive(q)); } else miss.push(s);
  }
  // Only genuine misses reach the upstream (rate-limited) path.
  for (const s of miss) {
    const q = await getQuote(s);
    if (q) out.push(q);
  }
  return out;
}

// ---------- the bar store: fetch once, keep forever ----------

const TF: Record<Timeframe, { mult: number; span: string; days: number }> = {
  "1D": { mult: 5, span: "minute", days: 1 },
  "1W": { mult: 30, span: "minute", days: 7 },
  "1M": { mult: 1, span: "day", days: 31 },
  "3M": { mult: 1, span: "day", days: 92 },
  "1Y": { mult: 1, span: "day", days: 366 },
  "5Y": { mult: 1, span: "week", days: 1830 },
};

/** How stale a series' tail may get before we refresh it. Intraday series
    move all session; daily series only grow after the close. */
const TAIL_TTL: Record<Timeframe, number> = {
  "1D": 10 * 60_000,
  "1W": 30 * 60_000,
  "1M": 6 * 3600_000,
  "3M": 6 * 3600_000,
  "1Y": 12 * 3600_000,
  "5Y": 24 * 3600_000,
};

const seriesId = (symbol: string, tf: Timeframe) => `${symbol}:${tf}`;

export type SeriesMeta = typeof schema.syncState.$inferSelect;

export async function getSeriesMeta(symbol: string, tf: Timeframe): Promise<SeriesMeta | null> {
  const [row] = await db.select().from(schema.syncState)
    .where(eq(schema.syncState.id, seriesId(symbol, tf)));
  return row ?? null;
}

async function readStored(symbol: string, tf: Timeframe): Promise<BarPoint[]> {
  const rows = await db.select().from(schema.bars)
    .where(and(eq(schema.bars.symbol, symbol), eq(schema.bars.timeframe, tf)))
    .orderBy(asc(schema.bars.t));
  return rows.map((r) => ({ time: r.t, open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v }));
}

/** Idempotent write: the most recent bar keeps changing until its period
    closes, so conflicts update from EXCLUDED instead of being ignored. */
async function upsertBars(symbol: string, tf: Timeframe, bars: BarPoint[]) {
  if (!bars.length) return;
  const rows = bars.map((b) => ({
    symbol, timeframe: tf, t: b.time, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume,
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
}

async function writeSyncState(symbol: string, tf: Timeframe,
  patch: Partial<Omit<SeriesMeta, "id" | "symbol" | "timeframe">>) {
  await db.insert(schema.syncState)
    .values({ id: seriesId(symbol, tf), symbol, timeframe: tf, barCount: 0, status: "pending", ...patch })
    .onConflictDoUpdate({ target: schema.syncState.id, set: patch });
}

async function fetchRange(symbol: string, tf: Timeframe, fromMs: number, toMs: number): Promise<BarPoint[]> {
  const { mult, span } = TF[tf];
  const d = (x: number) => new Date(x).toISOString().slice(0, 10);
  const reply = await massive<AggsReply>(
    `/v2/aggs/ticker/${massiveTicker(symbol)}/range/${mult}/${span}/${d(fromMs)}/${d(toMs)}`,
    { adjusted: "true", sort: "asc", limit: "5000" });
  return (reply.results ?? []).map((r) => ({
    time: Math.floor(r.t / 1000),
    open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v,
  }));
}

export type SyncResult = "synced" | "fresh" | "no-token" | "error";

/**
 * Bring one series up to date, spending at most one upstream call.
 * - empty store → fetch the timeframe's whole window
 * - stale tail  → fetch only from the last stored bar (with 1-bar overlap)
 * - fresh       → no call at all
 */
export async function syncSeries(symbol: string, tf: Timeframe): Promise<SyncResult> {
  if (!hasLiveData) return "fresh";
  // Mesh-owned series: the feeds mesh writes index and futures bars itself
  // (FRED history, Massive futures sessions). Massive's stock-aggs path knows
  // nothing about these tickers, so an upstream call here could only burn a
  // token to fetch a 404.
  if (symbol.startsWith("IDX:") || symbol.startsWith("FUT:")) return "fresh";
  const meta = await getSeriesMeta(symbol, tf);
  const now = Date.now();
  if (meta?.lastSyncAt && now - meta.lastSyncAt < TAIL_TTL[tf] && (meta.barCount ?? 0) > 0) {
    return "fresh";
  }
  if (!tryTakeToken()) return "no-token";

  const windowStart = now - TF[tf].days * 86_400_000;
  // Overlap one bar so the still-forming last bar gets corrected.
  const from = meta?.latest ? Math.max(windowStart, meta.latest * 1000 - 86_400_000) : windowStart;
  try {
    const fetched = await fetchRange(symbol, tf, from, now);
    await upsertBars(symbol, tf, fetched);
    const earliest = Math.min(meta?.earliest ?? Infinity, fetched[0]?.time ?? Infinity);
    const latest = Math.max(meta?.latest ?? 0, fetched[fetched.length - 1]?.time ?? 0);
    const [cnt] = await db.select({ n: dsql<number>`count(*)::int` }).from(schema.bars)
      .where(and(eq(schema.bars.symbol, symbol), eq(schema.bars.timeframe, tf)));
    await writeSyncState(symbol, tf, {
      earliest: Number.isFinite(earliest) ? earliest : null,
      latest: latest || null,
      barCount: cnt?.n ?? 0,
      lastSyncAt: now, status: "ok", lastError: null,
    });
    return "synced";
  } catch (e) {
    await writeSyncState(symbol, tf, {
      lastSyncAt: now, status: "error",
      lastError: e instanceof Error ? e.message : "unknown",
    }).catch(() => {});
    return "error";
  }
}

/**
 * Read-through history. Postgres first; upstream only for the missing tail.
 * Never blocks a request on the token bucket: if the store has bars but the
 * tail is stale and no token is free, serve what we have and heal in the
 * background. Throws only when there is NOTHING to show.
 */
export async function getBars(symbol: string, timeframe: Timeframe): Promise<BarPoint[]> {
  if (!hasLiveData) return demoBars(symbol, timeframe);

  const l1key = `b:${symbol}:${timeframe}`;
  const l1 = cached<BarPoint[]>(l1key, 60_000);
  if (l1) return l1;

  const result = await syncSeries(symbol, timeframe);
  let stored = await readStored(symbol, timeframe);

  if (!stored.length && timeframe !== "1Y") {
    /*
      Fall back to windowing the 1Y daily store. Mesh-fed series (indices,
      futures, FX) only ever WRITE daily bars under 1Y, so without this every
      shorter view rendered an empty chart over a vault holding decades of
      real closes. Daily granularity on a 1W/1M view is honest — sparse beats
      blank, and the badge already says the data is EOD.
    */
    const daily = await readStored(symbol, "1Y");
    if (daily.length) {
      const cutoff = Math.floor((Date.now() - TF[timeframe].days * 86_400_000) / 1000);
      const windowed = daily.filter((b) => b.time >= cutoff);
      stored = windowed.length ? windowed : daily;
    }
  }

  if (!stored.length) {
    if (result === "no-token") {
      warm(l1key, async () => { await takeToken(); await syncSeries(symbol, timeframe); });
      throw new Error("market-rate-limited");
    }
    if (result === "error") throw new Error("market-fetch-failed");
    return stored; // genuinely no data (unknown symbol)
  }
  if (result === "no-token") {
    warm(l1key, async () => { await takeToken(); await syncSeries(symbol, timeframe); });
  }
  // Serve only the timeframe's window (the store may hold more history).
  const cutoff = Math.floor((Date.now() - TF[timeframe].days * 86_400_000) / 1000);
  const windowed = stored.filter((b) => b.time >= cutoff);
  const out = windowed.length ? windowed : stored;
  store(l1key, out);
  return out;
}

// ---------- US market clock (approximate, ET regular session) ----------

/** The trading day as YYYY-MM-DD in US Eastern time — the anchor for day P&L.
    en-CA formats as ISO, so this is the ET calendar date, not UTC's. */
export function etDay(at = new Date()): string {
  return at.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export function isUSMarketOpen(at = new Date()): boolean {
  const et = new Date(at.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  if (day === 0 || day === 6) return false;
  const mins = et.getHours() * 60 + et.getMinutes();
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

// ---------- deterministic demo market (no key configured) ----------
const DEMO_BASE: Record<string, number> = {
  AAPL: 229.5, NVDA: 134.4, TSLA: 255.2, SPY: 606.4, MSFT: 424.8, AMZN: 186.3,
  META: 512.7, GOOG: 172.1, "BTC/USD": 97_088, "ETH/USD": 3_429,
};

function seededNoise(seed: number): number {
  const x = Math.sin(seed) * 10_000;
  return x - Math.floor(x);
}

function demoQuote(symbol: string): Quote {
  const base = DEMO_BASE[symbol] ?? 100 + (symbol.charCodeAt(0) % 40) * 7;
  const day = Math.floor(Date.now() / 86_400_000);
  const drift = (seededNoise(day + symbol.length) - 0.5) * 0.04;
  const price = base * (1 + drift);
  return {
    symbol,
    price,
    previousClose: base,
    changePercent: drift,
    asOf: Date.now() - 60_000,
    provenance: "indicative", // the keyless demo market is openly synthetic
  };
}

function demoBars(symbol: string, timeframe: Timeframe): BarPoint[] {
  const { days } = TF[timeframe];
  const n = Math.min(160, Math.max(48, days));
  const base = DEMO_BASE[symbol] ?? 100;
  const out: BarPoint[] = [];
  let price = base * 0.9;
  const now = Math.floor(Date.now() / 1000);
  const step = (days * 86_400) / n;
  for (let i = 0; i < n; i++) {
    const t = now - Math.floor((n - i) * step);
    const wave = Math.sin(i / 9) * 0.012 + (seededNoise(i * 7 + symbol.length) - 0.5) * 0.02;
    const open = price;
    const close = price * (1 + wave);
    const high = Math.max(open, close) * (1 + seededNoise(i) * 0.008);
    const low = Math.min(open, close) * (1 - seededNoise(i + 3) * 0.008);
    out.push({ time: t, open, high, low, close, volume: 1e6 * (0.5 + seededNoise(i + 5)) });
    price = close;
  }
  return out;
}
