"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AppNav from "@/components/app-nav";
import GettingStarted from "@/components/getting-started";
import SymbolInput from "@/components/symbol-input";
import MarketCard, { Spark } from "@/components/market-card";
import { SYMBOLS } from "@/lib/symbols";
import { usd, pct, categoryOf, type Quote, type Account } from "@/components/trading/shared";

/*
  Browse — the markets-first home. A category strip up top, the day's biggest
  mover as a featured hero, then the grid of market cards. The watchlist is a
  first-class category, not a sidebar. Sparklines come from the bar vault;
  quotes ride the shared poll.
*/

const HOUSE = ["AAPL", "NVDA", "TSLA", "MSFT", "AMZN", "META", "GOOG", "AMD",
  "NFLX", "SPY", "QQQ", "DIA", "BTC/USD", "ETH/USD"];

type Category = "Trending" | "Stocks" | "Crypto" | "ETFs" | "Watchlist";
const CATEGORIES: Category[] = ["Trending", "Stocks", "Crypto", "ETFs", "Watchlist"];

const NAME = new Map(SYMBOLS.map((e) => [e.symbol, e.name]));

export default function Browse({ userName, welcome }: { userName: string; welcome: boolean }) {
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

      {/* Category strip — markets are the content */}
      <div className="sticky top-14 z-40 border-b border-hairline bg-bg0/85 px-4 backdrop-blur-md md:px-6">
        <nav className="flex gap-1 overflow-x-auto py-2" aria-label="Market categories">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`pressable shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
                category === c ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
              }`}
              aria-pressed={category === c}>
              {c}{c === "Watchlist" && watchlist.length ? ` ${watchlist.length}` : ""}
            </button>
          ))}
          {marketOpen === false && (
            <span className="ml-auto hidden shrink-0 items-center text-[11px] text-ink-4 sm:flex">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {gridSymbols.map((s) => (
              <div key={s} className="relative">
                <MarketCard symbol={s} name={NAME.get(s)} quote={quotes.get(s)} spark={sparks[s]} />
                {category === "Watchlist" && (
                  <button onClick={() => removeFromWatchlist(s)}
                    className="pressable absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-bg3/80 text-ink-4 hover:text-loss"
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
    <Link href={`/app/m/${encodeURIComponent(symbol)}`}
      className="pressable mb-6 grid gap-4 rounded-2xl border border-hairline bg-bg1 p-5 transition-colors hover:bg-bg2/60 md:grid-cols-[1fr_380px] md:items-center md:p-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-ink-4">
          Featured · {categoryOf(symbol)} · biggest move
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-1 md:text-3xl">
          {name ?? symbol}
        </h2>
        <div className="mt-2 flex items-baseline gap-3">
          {quote ? (
            <>
              <span className="tnum text-3xl font-semibold text-ink-1 md:text-4xl">{usd(quote.price)}</span>
              <span className={`tnum text-lg font-semibold ${chg > 0 ? "text-gain" : chg < 0 ? "text-loss" : "text-ink-3"}`}>
                {pct(chg)}
              </span>
            </>
          ) : <span className="skeleton h-9 w-40" />}
        </div>
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold/10 px-4 py-1.5 text-xs font-semibold text-gold">
          Trade {symbol} →
        </span>
      </div>
      <Spark points={spark} className="h-24 w-full md:h-28" />
    </Link>
  );
}
