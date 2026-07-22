"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Quote = {
  symbol: string; price: number; previousClose: number;
  changePercent: number; asOf: number;
};
type Account = {
  cash: number; equity: number; dayStartEquity: number;
};

const usd = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
const pct = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;

export default function Terminal({ userName }: { userName: string }) {
  return (
    <Suspense>
      <TerminalInner userName={userName} />
    </Suspense>
  );
}

function TerminalInner({ userName }: { userName: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const welcome = search.get("welcome") === "1";

  const [account, setAccount] = useState<Account | null>(null);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
  const [rolledEquity, setRolledEquity] = useState(0);
  const watchlistRef = useRef<string[]>([]);

  const loadAccount = useCallback(async () => {
    const res = await fetch("/api/account");
    if (res.status === 401) { router.push("/login"); return; }
    const data = await res.json();
    if (data.ok) {
      setAccount(data.account);
      setWatchlist(data.watchlist);
      watchlistRef.current = data.watchlist;
    }
  }, [router]);

  const loadQuotes = useCallback(async () => {
    const symbols = watchlistRef.current;
    if (!symbols.length) return;
    const res = await fetch(`/api/market/quotes?symbols=${symbols.join(",")}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) {
      setQuotes(new Map((data.quotes as Quote[]).map((q) => [q.symbol, q])));
      setMarketOpen(data.marketOpen);
    }
  }, []);

  useEffect(() => {
    loadAccount().then(loadQuotes);
    const quotesTimer = setInterval(loadQuotes, 30_000);
    const accountTimer = setInterval(loadAccount, 60_000);
    return () => { clearInterval(quotesTimer); clearInterval(accountTimer); };
  }, [loadAccount, loadQuotes]);

  // The $100k welcome roll: equity counts up from 0 on first arrival.
  useEffect(() => {
    if (!welcome || !account) return;
    const target = account.equity;
    const t0 = performance.now();
    const duration = 1_600;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setRolledEquity(target * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [welcome, account]);

  const equity = account ? (welcome && rolledEquity < (account.equity - 1) ? rolledEquity : account.equity) : null;
  const dayPnL = account ? account.equity - account.dayStartEquity : 0;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Simulated badge — always visible, never diluted */}
      <div className="glass sticky top-0 z-50 flex items-center justify-between px-4 py-2.5 md:px-8">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-1">Tars Trading</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-amber">
            <span className="badge-dot h-1.5 w-1.5 rounded-full bg-amber" />
            SIMULATED · NO REAL MONEY
          </span>
          {marketOpen === false && (
            <span className="hidden rounded-full border border-hairline bg-bg2 px-3 py-1 text-[11px] text-ink-3 sm:inline">
              US market closed
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="hidden text-sm text-ink-2 sm:inline">{userName}</span>
          <button
            onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/"); }}
            className="pressable rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-2 hover:text-ink-1"
          >
            Log out
          </button>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-8">
        {/* Equity hero */}
        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Portfolio equity</p>
          {equity == null ? (
            <div className="skeleton mt-2 h-14 w-64" />
          ) : (
            <p className="tnum mt-1 text-5xl font-bold tracking-tight text-ink-1 md:text-6xl">
              {usd(equity, 0)}
            </p>
          )}
          {account && (
            <p className={`tnum mt-2 text-sm font-medium ${dayPnL > 0 ? "text-gain" : dayPnL < 0 ? "text-loss" : "text-ink-3"}`}>
              {usd(dayPnL)} today
            </p>
          )}
          {welcome && (
            <p className="mt-3 inline-block rounded-full border border-gain/30 bg-gain/10 px-4 py-1.5 text-sm text-gain">
              Your simulated $100,000 is live. Spend it on lessons, not luck.
            </p>
          )}
        </section>

        {/* Watchlist */}
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Watchlist</h2>
            {marketOpen === false && (
              <span className="text-[11px] text-ink-4">Prices from last session</span>
            )}
          </div>
          <ul>
            {watchlist.length === 0 && (
              <li className="px-5 py-6"><div className="skeleton h-5 w-full" /></li>
            )}
            {watchlist.map((symbol) => {
              const q = quotes.get(symbol);
              return (
                <li key={symbol} className="flex min-h-12 items-center justify-between border-b border-hairline px-5 py-3 last:border-0">
                  <span className="text-sm font-semibold text-ink-1">{symbol}</span>
                  {q ? (
                    <span className="flex items-baseline gap-4">
                      <span className="tnum text-sm font-medium text-ink-1">{usd(q.price)}</span>
                      <span className={`tnum w-20 text-right text-sm ${q.changePercent > 0 ? "text-gain" : q.changePercent < 0 ? "text-loss" : "text-ink-3"}`}>
                        {pct(q.changePercent)}
                      </span>
                    </span>
                  ) : (
                    <span className="skeleton h-4 w-36" />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <p className="mt-8 text-center text-xs text-ink-4">
          Education, not investment advice. Every fill here is simulated.
        </p>
      </main>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme ?? "auto");
  }, []);
  function cycle() {
    const next = theme === "dark" ? "light" : theme === "light" ? "auto" : "dark";
    setTheme(next);
    if (next === "auto") {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem("tars-theme");
    } else {
      document.documentElement.dataset.theme = next;
      localStorage.setItem("tars-theme", next);
    }
  }
  return (
    <button
      onClick={cycle}
      className="pressable rounded-full border border-hairline px-3 py-1.5 text-xs text-ink-2 hover:text-ink-1"
      title="Theme: dark → light → auto"
    >
      {theme === "dark" ? "◐ Dark" : theme === "light" ? "◑ Light" : "◒ Auto"}
    </button>
  );
}
