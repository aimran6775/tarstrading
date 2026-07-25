"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AppNav from "@/components/app-nav";
import Ticket from "@/components/trading/ticket";
import { Positions, Orders, Alerts, Performance } from "@/components/trading/tray";
import { useToast } from "@/components/toast";
import { SYMBOLS } from "@/lib/symbols";
import { usd, pct, categoryOf, type Quote, type Account, type Position, type Order, type Timeframe }
  from "@/components/trading/shared";
import LearnLink from "@/components/academy/learn-link";
import type { ChartBar } from "@/components/price-chart";

const PriceChart = dynamic(() => import("@/components/price-chart"), {
  ssr: false,
  loading: () => <div className="skeleton m-4 h-[300px] md:h-[420px]" />,
});

/*
  The market page: chart-first. Header is the headline number (huge tabular
  price + delta under the category eyebrow), the chart runs full-bleed with
  its timeframe tabs tucked into the chart footer, the ticket lives in the
  right rail with a context card, and the portfolio tray runs full-width
  underneath. Hotkeys: 1–6 timeframes, P/O/A/E tray tabs.
*/

const NAME = new Map(SYMBOLS.map((e) => [e.symbol, e.name]));
type TrayTab = "positions" | "orders" | "alerts" | "perf";

export default function MarketView({ symbol, initialTray, initialSide }: {
  symbol: string;
  initialTray?: string;
  initialSide?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [orders, setOrders] = useState<Order[]>([]);
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);
  const [quotesStale, setQuotesStale] = useState(false);
  const [accountError, setAccountError] = useState(false);

  const [timeframe, setTimeframe] = useState<Timeframe>("3M");
  const [bars, setBars] = useState<ChartBar[]>([]);
  const [barsError, setBarsError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [tray, setTray] = useState<TrayTab>(
    initialTray === "perf" || initialTray === "orders" || initialTray === "alerts" ? initialTray as TrayTab : "positions");
  const [presetSide, setPresetSide] = useState<"buy" | "sell" | null>(
    initialSide === "sell" ? "sell" : initialSide === "buy" ? "buy" : null);
  // Lazy-init to the correct height so mobile doesn't render 420 then snap to
  // 300 after hydration. The chart is client-only (dynamic ssr:false), so window
  // is defined on the first render that mounts it — no layout shift.
  const [chartHeight, setChartHeight] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768 ? 300 : 420);

  const watchlistRef = useRef<string[]>([]);
  const positionsRef = useRef<Position[]>([]);

  useEffect(() => {
    const fit = () => setChartHeight(window.innerWidth < 768 ? 300 : 420);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Hotkeys: 1-6 timeframe, P/O/A/E tray (never while typing / with modifiers).
  useEffect(() => {
    const TF: Record<string, Timeframe> = { "1": "1D", "2": "1W", "3": "1M", "4": "3M", "5": "1Y", "6": "5Y" };
    const TRAY: Record<string, TrayTab> = { p: "positions", o: "orders", a: "alerts", e: "perf" };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      if (TF[ev.key]) setTimeframe(TF[ev.key]);
      else if (TRAY[ev.key.toLowerCase()]) setTray(TRAY[ev.key.toLowerCase()]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------- data loops ----------
  const loadAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/account");
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (data.ok) {
        setAccount(data.account);
        setPositions(data.positions);
        positionsRef.current = data.positions;
        setWatchlist(data.watchlist);
        watchlistRef.current = data.watchlist;
        setAccountError(false);
      } else setAccountError(true);
    } catch { setAccountError(true); }
  }, [router]);

  const loadQuotes = useCallback(async () => {
    const symbols = Array.from(new Set([
      symbol,
      ...watchlistRef.current,
      ...positionsRef.current.map((p) => p.symbol),
    ])).slice(0, 24);
    try {
      const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
      if (!res.ok) { setQuotesStale(true); return; }
      const data = await res.json();
      if (data.ok) {
        setQuotes((prev) => {
          const next = new Map(prev);
          (data.quotes as Quote[]).forEach((q) => next.set(q.symbol, q));
          return next;
        });
        setMarketOpen(data.marketOpen);
        setQuotesStale(false);
        for (const t of (data.triggered ?? []) as { symbol: string; price: number; direction: string }[]) {
          toast({ kind: "info", title: `Alert · ${t.symbol}`, body: `Crossed ${t.direction} ${usd(t.price)}` });
        }
      } else setQuotesStale(true);
    } catch { setQuotesStale(true); }
  }, [symbol, toast]);

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) setOrders(data.orders);
  }, []);

  useEffect(() => {
    loadAccount().then(() => { loadQuotes(); loadOrders(); });
    // 4s poll: the server reads live websocket ticks from memory, so a fast
    // poll costs nothing upstream and the tape actually moves.
    const q = setInterval(loadQuotes, 4_000);
    const a = setInterval(loadAccount, 45_000);
    const o = setInterval(loadOrders, 45_000);
    return () => { clearInterval(q); clearInterval(a); clearInterval(o); };
  }, [loadAccount, loadQuotes, loadOrders]);

  // Bars from the vault.
  useEffect(() => {
    let alive = true;
    setBarsError(null);
    setBars([]);
    (async () => {
      try {
        const res = await fetch(`/api/market/bars?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`);
        const data = await res.json();
        if (!alive) return;
        if (data.ok) { setBars(data.bars); setSyncedAt(data.syncedAt ?? null); }
        else setBarsError(data.error ?? "Couldn't load history.");
      } catch { if (alive) setBarsError("Couldn't reach the data service. Check your connection."); }
    })();
    return () => { alive = false; };
  }, [symbol, timeframe, reloadNonce]);

  const refreshAfterTrade = useCallback(() => {
    loadAccount().then(() => { loadQuotes(); loadOrders(); });
  }, [loadAccount, loadQuotes, loadOrders]);

  async function toggleWatch() {
    const on = watchlist.includes(symbol);
    const next = on ? watchlist.filter((s) => s !== symbol) : [...watchlist, symbol];
    setWatchlist(next); watchlistRef.current = next;
    await fetch("/api/watchlist", {
      method: on ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    }).catch(() => {});
  }

  const quote = quotes.get(symbol);
  const chg = quote?.changePercent ?? 0;
  const position = positions.find((p) => p.symbol === symbol);
  const openOrders = orders.filter((o) => o.status === "accepted");
  const dayPnL = account ? account.equity - account.dayStartEquity : 0;
  const watched = watchlist.includes(symbol);

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

      {accountError && (
        <p role="alert" className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-loss/40 bg-loss/10 px-4 py-2.5 text-sm text-loss md:mx-6">
          Couldn&apos;t reach your account. Your positions are safe — retrying.
          <button onClick={() => loadAccount()} className="pressable min-h-11 shrink-0 rounded-full border border-loss/40 px-4 text-xs">Retry now</button>
        </p>
      )}
      {quotesStale && (
        <p className="mx-4 mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning md:mx-6">
          Prices paused — reconnecting to the data feed.
        </p>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 md:px-6 md:pb-8">
        {/* ---------- headline: the number IS the header ---------- */}
        <header className="rise-in relative mb-4 flex flex-wrap items-end justify-between gap-4 overflow-hidden">
          {/* the ticker echoed huge behind the price — editorial, aria-hidden */}
          <span aria-hidden className="ghost pointer-events-none absolute -top-4 right-0 z-0 hidden select-none text-[6.5rem] leading-none sm:block md:text-[8.5rem]">
            {symbol.replace("/", "")}
          </span>
          <div className="relative z-10 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.25em] text-ink-4">
              <button onClick={() => router.push("/app")} className="pressable hover:text-ink-2">Markets</button>
              {" · "}{categoryOf(symbol)}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink-1 md:text-3xl">
              {NAME.get(symbol) ?? symbol}
              <span className="ml-2 align-middle text-sm font-semibold text-ink-4">{symbol}</span>
            </h1>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-3">
              {quote ? (
                <>
                  <span className="lumina tnum text-4xl font-semibold tracking-tight text-ink-1 md:text-5xl">
                    {usd(quote.price)}
                  </span>
                  <span className={`tnum text-lg font-semibold ${chg > 0 ? "text-gain" : chg < 0 ? "text-loss" : "text-ink-3"}`}>
                    {chg > 0 ? "▲" : chg < 0 ? "▼" : ""} {pct(chg)}
                  </span>
                  {Date.now() - quote.asOf < 90_000 ? (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-gain">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gain opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-gain" />
                      </span>
                      Live
                    </span>
                  ) : Date.now() - quote.asOf > 5 * 60_000 ? (
                    <span className="text-[11px] text-ink-4">
                      as of {new Date(quote.asOf).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="skeleton h-10 w-48" />
              )}
            </div>
          </div>
          <button onClick={toggleWatch}
            className={`pressable relative z-10 flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium ${
              watched ? "border-gold/40 bg-gold/10 text-gold" : "border-hairline text-ink-3 hover:text-ink-1"
            }`}
            aria-pressed={watched}>
            {watched ? "★ Watching" : "☆ Watch"}
          </button>
        </header>

        <div className="rise-in grid gap-4 lg:grid-cols-[1fr_340px]" style={{ "--i": 1 } as CSSProperties}>
          {/* ---------- the chart, framed like an instrument ---------- */}
          <section className="raised overflow-hidden">
            <div className="relative">
              {/* bezel — an inner hairline and four corner ticks, like a scope face */}
              <span aria-hidden className="pointer-events-none absolute inset-1.5 z-10 rounded-[10px] border border-hairline" />
              {(["left-1.5 top-1.5 border-l-2 border-t-2 rounded-tl-[10px]",
                 "right-1.5 top-1.5 border-r-2 border-t-2 rounded-tr-[10px]",
                 "left-1.5 bottom-1.5 border-l-2 border-b-2 rounded-bl-[10px]",
                 "right-1.5 bottom-1.5 border-r-2 border-b-2 rounded-br-[10px]"] as const
              ).map((cls) => (
                <span key={cls} aria-hidden
                  className={`pointer-events-none absolute z-10 h-4 w-4 border-[var(--hairline-strong)] ${cls}`} />
              ))}
              {barsError ? (
                <div className="flex h-[300px] flex-col items-center justify-center gap-3 px-6 text-center md:h-[420px]">
                  <p className="text-sm text-ink-2">{barsError}</p>
                  <button onClick={() => setReloadNonce((n) => n + 1)}
                    className="pressable min-h-11 rounded-full border border-hairline px-5 text-xs text-ink-2">
                    Retry
                  </button>
                </div>
              ) : bars.length ? (
                <PriceChart bars={bars} height={chartHeight} />
              ) : (
                <div className="skeleton m-4 h-[300px] md:h-[420px]" />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-4 py-1.5">
              <span className="flex items-center gap-2">
                <span className="tnum text-[11px] text-ink-4">
                  {bars.length ? `${bars.length} bars` : "—"}
                  {syncedAt ? ` · synced ${new Date(syncedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : ""}
                  {marketOpen === false && !symbol.includes("/") ? " · market closed" : ""}
                </span>
                <LearnLink concept="chart" className="hidden sm:inline-flex" />
              </span>
              <div className="flex gap-1">
                {(["1D", "1W", "1M", "3M", "1Y", "5Y"] as Timeframe[]).map((tf) => (
                  <button key={tf} onClick={() => setTimeframe(tf)}
                    className={`pressable tnum min-h-11 rounded-full px-3 text-xs ${
                      tf === timeframe ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
                    }`}
                    aria-pressed={tf === timeframe}>
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- right rail: ticket + context ---------- */}
          <aside className="flex min-w-0 flex-col gap-4">
            <Ticket
              symbol={symbol}
              quote={quote}
              cash={account?.cash ?? 0}
              marketOpen={marketOpen}
              onPlaced={refreshAfterTrade}
              presetSide={presetSide}
            />

            <section className="panel p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Context</h2>
                <LearnLink concept="sizing" />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                <dt className="text-ink-4">Prev close</dt>
                <dd className="tnum text-right text-ink-1">{quote ? usd(quote.previousClose) : "—"}</dd>
                <dt className="text-ink-4">Day change</dt>
                <dd className={`tnum text-right ${chg > 0 ? "text-gain" : chg < 0 ? "text-loss" : "text-ink-2"}`}>
                  {quote ? pct(chg) : "—"}
                </dd>
                <dt className="text-ink-4">Session</dt>
                <dd className="text-right text-ink-1">
                  {symbol.includes("/") ? "24/7 (crypto)" : marketOpen == null ? "—" : marketOpen ? "Open" : "Closed"}
                </dd>
                {position && (
                  <>
                    <dt className="text-ink-4">Your position</dt>
                    <dd className="tnum text-right text-ink-1">{position.qty} @ {usd(position.avgEntryPrice)}</dd>
                    <dt className="text-ink-4">Unrealized</dt>
                    <dd className={`tnum text-right ${quote && (quote.price - position.avgEntryPrice) * position.qty > 0
                      ? "text-gain"
                      : quote && (quote.price - position.avgEntryPrice) * position.qty < 0 ? "text-loss" : "text-ink-2"}`}>
                      {quote ? `${(quote.price - position.avgEntryPrice) * position.qty >= 0 ? "+" : ""}${usd((quote.price - position.avgEntryPrice) * position.qty)}` : "—"}
                    </dd>
                  </>
                )}
              </dl>
              {position && (
                <button onClick={() => setPresetSide("sell")}
                  className="pressable mt-3 min-h-11 w-full rounded-full border border-loss/40 text-xs font-medium text-loss hover:bg-loss/10">
                  Sell this position
                </button>
              )}
            </section>
          </aside>
        </div>

        {/* ---------- the portfolio tray ---------- */}
        <section className="panel mt-4 overflow-hidden">
          <nav className="flex gap-1 overflow-x-auto border-b border-hairline px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:shrink-0" aria-label="Portfolio tray">
            {([
              ["positions", `Positions${positions.length ? ` · ${positions.length}` : ""}`],
              ["orders", `Orders${openOrders.length ? ` · ${openOrders.length}` : ""}`],
              ["alerts", "Alerts"],
              ["perf", "Performance"],
            ] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTray(key)}
                className={`pressable relative min-h-11 rounded-t-lg px-4 py-2.5 text-xs font-medium transition-colors ${
                  tray === key ? "text-gold" : "text-ink-3 hover:text-ink-1"
                }`}
                aria-selected={tray === key}>
                {label}
                {/* the gold active underline — the same tape that runs under the app nav */}
                <span aria-hidden className={`absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-gold transition-opacity ${
                  tray === key ? "opacity-100 shadow-[0_0_10px_-1px_var(--gold)]" : "opacity-0"
                }`} />
              </button>
            ))}
          </nav>
          {tray === "positions" && (
            <Positions positions={positions} quotes={quotes}
              onSelect={(s) => router.push(`/app/m/${encodeURIComponent(s)}`)}
              onClosed={refreshAfterTrade} />
          )}
          {tray === "orders" && <Orders orders={orders} onCanceled={refreshAfterTrade} />}
          {tray === "alerts" && <Alerts symbol={symbol} quote={quote} />}
          {tray === "perf" && <Performance />}
        </section>
      </main>

      <p className="pb-6 text-center text-xs text-ink-4">
        Education, not investment advice. Every fill here is simulated.
      </p>
    </div>
  );
}
