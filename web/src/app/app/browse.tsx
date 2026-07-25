"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import AppNav from "@/components/app-nav";
import GettingStarted from "@/components/getting-started";
import SymbolInput from "@/components/symbol-input";
import MarketCard from "@/components/market-card";
import { SYMBOLS } from "@/lib/symbols";
import { usd, pct, categoryOf, type Quote, type Account } from "@/components/trading/shared";

/*
  Browse — the markets-first home. A category strip up top, the day's biggest
  mover as a featured hero, then the grid of market cards. The watchlist is a
  first-class category, not a sidebar. Sparklines come from the bar vault;
  quotes ride the shared poll.
*/

/* The house board — a real desk's watch universe, not just the Mag 7.
   Backfill + the 5-min heartbeat keep charts warm for everything listed. */
const HOUSE = [
  // Mega-cap tech
  "AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GOOG", "AMD", "NFLX", "AVGO",
  // Blue chips & industrials
  "JPM", "V", "WMT", "JNJ", "PG", "DIS", "BA", "CAT", "XOM", "CVX",
  // Growth & momentum
  "PLTR", "COIN", "SQ", "SHOP", "UBER", "ABNB", "SNOW", "CRWD", "PANW", "SMCI",
  // Semis & AI complex
  "INTC", "MU", "TSM", "ARM", "QCOM",
  // ETFs — index, sector, vol
  "SPY", "QQQ", "DIA", "IWM", "XLF", "XLE", "XLK", "SMH", "GLD", "TLT",
  // Crypto — 24/7
  "BTC/USD", "ETH/USD", "SOL/USD", "DOGE/USD", "AVAX/USD", "LINK/USD",
];

type Category = "Trending" | "Stocks" | "Crypto" | "ETFs" | "Watchlist";
const CATEGORIES: Category[] = ["Trending", "Stocks", "Crypto", "ETFs", "Watchlist"];

const NAME = new Map(SYMBOLS.map((e) => [e.symbol, e.name]));

export default function Browse({ userName, welcome }: { userName: string; welcome: boolean }) {
  const rm = useReducedMotion();
  const [category, setCategory] = useState<Category>("Trending");
  const [account, setAccount] = useState<Account | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [sparks, setSparks] = useState<Record<string, number[]>>({});
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
  const [stale, setStale] = useState(false);
  const [adding, setAdding] = useState("");
  const watchRef = useRef<string[]>([]);

  const allSymbols = useMemo(
    () => Array.from(new Set([...HOUSE, ...watchlist])),
    [watchlist]);

  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/account");
      const data = await res.json();
      if (data.ok) {
        setAccount(data.account);
        setWatchlist(data.watchlist);
        watchRef.current = data.watchlist;
      }
    } catch { /* banner below covers it */ }
  }, []);

  const loadQuotes = useCallback(async () => {
    const symbols = Array.from(new Set([...HOUSE, ...watchRef.current])).slice(0, 24);
    try {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
      if (!res.ok) { setStale(true); return; }
      const data = await res.json();
      if (data.ok) {
        setQuotes((prev) => {
          const next = new Map(prev);
          (data.quotes as Quote[]).forEach((q) => next.set(q.symbol, q));
          return next;
        });
        setMarketOpen(data.marketOpen);
        setStale(false);
      } else setStale(true);
    } catch { setStale(true); }
  }, []);

  const loadSparks = useCallback(async () => {
    const symbols = Array.from(new Set([...HOUSE, ...watchRef.current])).slice(0, 32);
    try {
      const res = await fetch(`/api/market/sparks?symbols=${encodeURIComponent(symbols.join(","))}`);
      const data = await res.json();
      if (data.ok) setSparks(data.sparks);
    } catch { /* sparklines are decoration — cards still work */ }
  }, []);

  useEffect(() => {
    loadAccount().then(() => { loadQuotes(); loadSparks(); });
    const q = setInterval(loadQuotes, 20_000);
    const s = setInterval(loadSparks, 5 * 60_000);
    return () => { clearInterval(q); clearInterval(s); };
  }, [loadAccount, loadQuotes, loadSparks]);

  async function addToWatchlist(raw: string) {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) return;
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      if (data.ok) {
        setWatchlist(data.watchlist); watchRef.current = data.watchlist;
        setAdding(""); loadQuotes(); loadSparks();
      }
    } catch { /* retryable */ }
  }
  async function removeFromWatchlist(symbol: string) {
    await fetch("/api/watchlist", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    const next = watchlist.filter((s) => s !== symbol);
    setWatchlist(next); watchRef.current = next;
  }

  // Category filtering + trending sort (by |move|, quoted first).
  const visible = useMemo(() => {
    const base = category === "Watchlist" ? watchlist : allSymbols;
    const filtered = category === "Trending" || category === "Watchlist"
      ? base
      : base.filter((s) => categoryOf(s) === category);
    return [...filtered].sort((a, b) => {
      const qa = quotes.get(a), qb = quotes.get(b);
      if (!qa && !qb) return 0;
      if (!qa) return 1;
      if (!qb) return -1;
      return Math.abs(qb.changePercent) - Math.abs(qa.changePercent);
    });
  }, [category, allSymbols, watchlist, quotes]);

  // Featured hero: the biggest mover we have a quote for.
  const featured = category === "Trending" ? visible.find((s) => quotes.get(s)) : undefined;
  const gridSymbols = featured ? visible.filter((s) => s !== featured) : visible;

  const dayPnL = account ? account.equity - account.dayStartEquity : 0;
  const equityStrip = account ? (
    <div className="flex items-baseline gap-2 tnum" aria-label="Account equity and day change">
      <span className="text-sm font-semibold text-ink-1">{usd(account.equity, 0)}</span>
      <span className={`text-xs ${dayPnL > 0 ? "text-gain" : dayPnL < 0 ? "text-loss" : "text-ink-3"}`}>
        {pct(account.dayStartEquity > 0 ? dayPnL / account.dayStartEquity : 0)}
      </span>
    </div>
  ) : null;

  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active="terminal" right={equityStrip} />
      <GettingStarted />

      {welcome && (
        <p className="mx-4 mt-4 rounded-lg border border-gold/25 bg-gold/8 px-4 py-2.5 text-sm text-gold md:mx-6">
          Your simulated $100,000 is live, {userName.split(" ")[0]}. Spend it on lessons, not luck.
        </p>
      )}
      {stale && (
        <p className="mx-4 mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning md:mx-6">
          Prices paused — reconnecting to the data feed.
        </p>
      )}

      {/* Category strip — a segmented scroller; the thumb slides between rooms */}
      <div className="sticky top-14 z-40 border-b border-hairline bg-bg0/85 px-4 backdrop-blur-md md:px-6">
        <nav
          className="-mx-4 flex items-center overflow-x-auto px-4 py-2 [scrollbar-width:none] md:-mx-6 md:px-6 [&::-webkit-scrollbar]:hidden"
          aria-label="Market categories">
          <div className="flex shrink-0 gap-0.5 rounded-full border border-hairline bg-bg1 p-1">
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setCategory(c)}
                className={`pressable relative min-h-9 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
                  category === c ? "text-gold" : "text-ink-3 hover:text-ink-1"
                }`}
                aria-pressed={category === c}>
                {category === c && (
                  <motion.span layoutId="browse-category-thumb" aria-hidden
                    transition={rm ? { duration: 0 } : { type: "spring", bounce: 0.18, duration: 0.45 }}
                    className="absolute inset-0 rounded-full border border-gold/40 bg-gold/12 shadow-[0_0_18px_-6px_var(--gold)]" />
                )}
                <span className="relative">
                  {c}{c === "Watchlist" && watchlist.length ? ` ${watchlist.length}` : ""}
                </span>
              </button>
            ))}
          </div>
          {marketOpen === false && (
            <span className="ml-auto hidden shrink-0 items-center pl-4 text-[11px] text-ink-4 sm:flex">
              US market closed
            </span>
          )}
        </nav>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:px-6 md:pb-10">
        {/* Featured hero — the day's biggest mover */}
        {featured && (
          <FeaturedCard symbol={featured} name={NAME.get(featured)}
            quote={quotes.get(featured)} spark={sparks[featured] ?? []} />
        )}

        {/* Watchlist management row */}
        {category === "Watchlist" && (
          <div className="mb-4 flex gap-2">
            <SymbolInput value={adding} onChange={setAdding} onSubmit={addToWatchlist} />
            <button type="button" onClick={() => addToWatchlist(adding)}
              className="pressable rounded-full border border-hairline px-5 text-xs text-ink-2 hover:text-ink-1">
              Add
            </button>
          </div>
        )}

        {gridSymbols.length === 0 && category === "Watchlist" ? (
          <p className="rounded-2xl border border-hairline bg-bg1 px-6 py-14 text-center text-sm text-ink-4">
            Nothing on your watchlist yet. Add a ticker above and it follows you everywhere.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {gridSymbols.map((s, i) => (
              <div key={s} className="rise-in relative" style={{ "--i": Math.min(i, 8) } as CSSProperties}>
                <MarketCard symbol={s} name={NAME.get(s)} quote={quotes.get(s)} spark={sparks[s]} />
                {category === "Watchlist" && (
                  <button onClick={() => removeFromWatchlist(s)}
                    className="pressable absolute right-1.5 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-bg3/80 text-ink-4 hover:text-loss"
                    aria-label={`Remove ${s} from watchlist`}>
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <p className="pb-6 text-center text-xs text-ink-4">
        Education, not investment advice. Every fill here is simulated.
      </p>
    </div>
  );
}

function FeaturedCard({ symbol, name, quote, spark }: {
  symbol: string; name?: string; quote?: Quote; spark: number[];
}) {
  const chg = quote?.changePercent ?? 0;
  return (
    <div className="rise-in relative mb-6">
      {/* ambient light in the room — a single gold aura behind the hero */}
      <div aria-hidden className="aura aura-gold" />
      {/* the display ticker, ghosted huge behind the exhibit */}
      <span aria-hidden className="ghost absolute -top-2 right-4 z-0 hidden select-none text-[7rem] leading-none sm:block md:text-[9rem]">
        {symbol.replace("/", "")}
      </span>
      <Link href={`/app/m/${encodeURIComponent(symbol)}`}
        className="raised raised-2 edge-gold lift group relative z-10 block overflow-hidden">
        <div className="grid gap-4 p-5 md:grid-cols-[1fr_400px] md:items-center md:p-6 lg:p-7">
          <div className="min-w-0">
            <p className="kicker">Featured · {categoryOf(symbol)} · biggest move</p>
            <h2 className="display mt-2 break-words text-[2.25rem] text-ink-1 sm:text-5xl md:text-6xl">
              {name ?? symbol}
            </h2>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              {quote ? (
                <>
                  <span className="lumina tnum text-5xl font-semibold tracking-tight text-ink-1 md:text-7xl">
                    {usd(quote.price)}
                  </span>
                  <span className={`tnum text-lg font-semibold md:text-2xl ${chg > 0 ? "text-gain" : chg < 0 ? "text-loss" : "text-ink-3"}`}>
                    {pct(chg)}
                  </span>
                </>
              ) : <span className="skeleton h-12 w-52" />}
            </div>
            <span className="mt-6 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-5 text-xs font-semibold text-gold transition-colors group-hover:bg-gold/20">
              Trade {symbol}
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
          <HeroSpark points={spark} up={chg >= 0} />
        </div>
      </Link>
    </div>
  );
}

/** The hero's sparkline as an exhibit — gradient-tinted area under the line,
    endpoint held in a soft halo. Decorative; the price above is the data. */
function HeroSpark({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return <div className="h-28 w-full rounded-xl bg-bg2 md:h-32" aria-hidden />;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const W = 400, H = 128;
  const coords = points.map((p, i) => [
    (i / (points.length - 1)) * W,
    H - 8 - ((p - min) / range) * (H - 16),
  ] as const);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ex, ey] = coords[coords.length - 1];
  const tone = up ? "var(--gain)" : "var(--loss)";
  const gid = up ? "hero-spark-gain" : "hero-spark-loss";
  const glow = up ? "hero-glow-gain" : "hero-glow-loss";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full md:h-32" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.30" />
          <stop offset="72%" stopColor={tone} stopOpacity="0.04" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
        <filter id={glow} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gid})`} stroke="none" />
      <polyline points={line} fill="none" stroke={tone} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" filter={`url(#${glow})`} />
      {/* the live endpoint, held in a phosphor halo */}
      <circle cx={ex} cy={ey} r="9" fill={tone} opacity="0.12" />
      <circle cx={ex} cy={ey} r="5" fill={tone} opacity="0.22" />
      <circle cx={ex} cy={ey} r="2.6" fill={tone} />
    </svg>
  );
}
