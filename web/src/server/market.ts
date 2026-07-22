import "server-only";

/*
  Market data service. Massive (formerly Polygon.io) proxied server-side ONLY —
  the API key never reaches the client. Free tier is 5 req/min EOD, so:
  - token-bucket rate limiter (never 429 by design)
  - layered in-memory cache (quotes 5 min, bars 30 min)
  - crypto pairs map to Massive's "X:BTCUSD" ticker form
  - every payload carries `asOf` so the UI can be honest about staleness
  Without a key, a deterministic demo market takes over (same shapes).
*/

export type Quote = {
  symbol: string;
  price: number;
  previousClose: number;
  changePercent: number;
  asOf: number; // epoch ms
};

export type BarPoint = {
  time: number; // epoch seconds (lightweight-charts convention)
  open: number; high: number; low: number; close: number; volume: number;
};

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";

const BASE = "https://api.massive.com";
const KEY = process.env.MASSIVE_API_KEY ?? "";
export const hasLiveData = KEY.length > 0;

// ---------- rate limiter (token bucket: 5/min, leave 1 in reserve) ----------
const stamps: number[] = [];
async function takeToken() {
  for (;;) {
    const now = Date.now();
    while (stamps.length && now - stamps[0] > 60_000) stamps.shift();
    if (stamps.length < 4) { stamps.push(now); return; }
    await new Promise((r) => setTimeout(r, 61_000 - (now - stamps[0])));
  }
}

// ---------- cache ----------
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
  return symbol.includes("/") ? "X:" + symbol.replace("/", "") : symbol;
}

async function massive<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("apiKey", KEY);
  await takeToken();
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401 || res.status === 403) throw new Error("market-unauthorized");
  if (res.status === 429) throw new Error("market-rate-limited");
  if (!res.ok) throw new Error(`market-http-${res.status}`);
  return res.json() as Promise<T>;
}

type PrevReply = { results?: { o: number; c: number; t: number }[] };
type AggsReply = { results?: { t: number; o: number; h: number; l: number; c: number; v: number }[] };

export async function getQuote(symbol: string): Promise<Quote | null> {
  const key = `q:${symbol}`;
  const hit = cached<Quote>(key, 5 * 60_000);
  if (hit) return hit;
  if (!hasLiveData) return demoQuote(symbol);
  try {
    const reply = await massive<PrevReply>(`/v2/aggs/ticker/${massiveTicker(symbol)}/prev`);
    const bar = reply.results?.[0];
    if (!bar) return null;
    const quote: Quote = {
      symbol,
      price: bar.c,
      previousClose: bar.o,
      changePercent: bar.o > 0 ? bar.c / bar.o - 1 : 0,
      asOf: bar.t,
    };
    store(key, quote);
    return quote;
  } catch {
    // One bad symbol never sinks a batch — callers get null and show a gap.
    return null;
  }
}

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const out: Quote[] = [];
  for (const s of symbols) {
    const q = await getQuote(s);
    if (q) out.push(q);
  }
  return out;
}

const TF: Record<Timeframe, { mult: number; span: string; days: number }> = {
  "1D": { mult: 5, span: "minute", days: 1 },
  "1W": { mult: 30, span: "minute", days: 7 },
  "1M": { mult: 1, span: "day", days: 31 },
  "3M": { mult: 1, span: "day", days: 92 },
  "1Y": { mult: 1, span: "day", days: 366 },
  "5Y": { mult: 1, span: "week", days: 1830 },
};

export async function getBars(symbol: string, timeframe: Timeframe): Promise<BarPoint[]> {
  const key = `b:${symbol}:${timeframe}`;
  const hit = cached<BarPoint[]>(key, 30 * 60_000);
  if (hit) return hit;
  if (!hasLiveData) return demoBars(symbol, timeframe);
  const { mult, span, days } = TF[timeframe];
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const d = (x: Date) => x.toISOString().slice(0, 10);
  const reply = await massive<AggsReply>(
    `/v2/aggs/ticker/${massiveTicker(symbol)}/range/${mult}/${span}/${d(from)}/${d(to)}`,
    { adjusted: "true", sort: "asc", limit: "5000" });
  const bars = (reply.results ?? []).map((r) => ({
    time: Math.floor(r.t / 1000),
    open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v,
  }));
  store(key, bars);
  return bars;
}

// ---------- US market clock (approximate, ET regular session) ----------
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
