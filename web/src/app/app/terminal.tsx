"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import HoldButton from "@/components/hold-button";
import AppNav from "@/components/app-nav";
import GettingStarted from "@/components/getting-started";
import { useToast } from "@/components/toast";
import SymbolInput from "@/components/symbol-input";
import type { ChartBar } from "@/components/price-chart";

const PriceChart = dynamic(() => import("@/components/price-chart"), {
  ssr: false,
  loading: () => <div className="skeleton m-4 h-[300px] md:h-[404px]" />,
});

/*
  The terminal. One workspace: chart hero + ticket on the left, the rail
  (watchlist / positions / orders) on the right. Simulated marker always in
  the header. Staleness and market-closed states always honest.
*/

type Quote = { symbol: string; price: number; previousClose: number; changePercent: number; asOf: number };
type Account = { cash: number; equity: number; dayStartEquity: number };
type Position = { id: string; symbol: string; qty: number; avgEntryPrice: number };
type Order = {
  id: string; symbol: string; side: "buy" | "sell"; type: string; qty: number;
  limitPrice: number | null; stopPrice: number | null; status: string;
  filledPrice: number | null; rejectReason: string | null; createdAt: number;
};
type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "5Y";

const usd = (v: number, digits = 2) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits });
const pct = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2)}%`;

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
  const initialSymbol = (search.get("symbol") || "AAPL").toUpperCase();
  const initialPerf = search.get("perf") === "1";

  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [orders, setOrders] = useState<Order[]>([]);
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);

  const [symbol, setSymbol] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState<Timeframe>("3M");
  const [bars, setBars] = useState<ChartBar[]>([]);
  const [barsError, setBarsError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [accountError, setAccountError] = useState(false);
  const [quotesStale, setQuotesStale] = useState(false);
  const [rail, setRail] = useState<"watch" | "positions" | "orders" | "perf" | "alerts">(initialPerf ? "perf" : "watch");
  const [chartHeight, setChartHeight] = useState(420);


  const watchlistRef = useRef<string[]>([]);
  const positionsRef = useRef<Position[]>([]);
  const toast = useToast();

  useEffect(() => {
    const fit = () => setChartHeight(window.innerWidth < 768 ? 300 : 420);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // Terminal hotkeys (ignored while typing or with a modifier held — ⌘K owns that).
  useEffect(() => {
    const TF: Record<string, Timeframe> = { "1": "1D", "2": "1W", "3": "1M", "4": "3M", "5": "1Y", "6": "5Y" };
    const RAIL: Record<string, "watch" | "positions" | "orders" | "alerts" | "perf"> =
      { w: "watch", p: "positions", o: "orders", a: "alerts", e: "perf" };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      if (TF[ev.key]) setTimeframe(TF[ev.key]);
      else if (RAIL[ev.key.toLowerCase()]) setRail(RAIL[ev.key.toLowerCase()]);
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
      ...watchlistRef.current,
      ...positionsRef.current.map((p) => p.symbol),
    ]));
    if (!symbols.length) return;
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
          toast({ kind: "info", title: `Alert · ${t.symbol}`,
            body: `Crossed ${t.direction} ${usd(t.price)}` });
        }
      } else setQuotesStale(true);
    } catch { setQuotesStale(true); }
  }, []);

  const loadOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) setOrders(data.orders);
  }, []);

  useEffect(() => {
    loadAccount().then(() => { loadQuotes(); loadOrders(); });
    const q = setInterval(loadQuotes, 20_000);
    const a = setInterval(loadAccount, 45_000);
    const o = setInterval(loadOrders, 45_000);
    return () => { clearInterval(q); clearInterval(a); clearInterval(o); };
  }, [loadAccount, loadQuotes, loadOrders]);

  // Chart bars per symbol/timeframe.
  useEffect(() => {
    let alive = true;
    setBarsError(null);
    setBars([]);
    (async () => {
      try {
        const res = await fetch(`/api/market/bars?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`);
        const data = await res.json();
        if (!alive) return;
        if (data.ok) setBars(data.bars);
        else setBarsError(data.error ?? "Couldn't load history.");
      } catch { if (alive) setBarsError("Couldn't reach the data service. Check your connection."); }
    })();
    return () => { alive = false; };
  }, [symbol, timeframe, reloadNonce]);

  const refreshAfterTrade = useCallback(() => {
    loadAccount().then(() => { loadQuotes(); loadOrders(); });
  }, [loadAccount, loadQuotes, loadOrders]);

  const quote = quotes.get(symbol);
  const dayPnL = account ? account.equity - account.dayStartEquity : 0;
  const openOrders = orders.filter((o) => o.status === "accepted");

  const equityStrip = account ? (
    <div className="flex items-baseline gap-2 tnum" aria-label="Account equity and day change">
      <span className="text-sm font-semibold text-ink-1">{usd(account.equity, 0)}</span>
      <span className={`text-xs ${dayPnL > 0 ? "text-gain" : dayPnL < 0 ? "text-loss" : "text-ink-3"}`}>
        {pct(account.dayStartEquity > 0 ? dayPnL / account.dayStartEquity : 0)}
      </span>
      {marketOpen === false && (
        <span className="hidden text-[11px] text-ink-4 md:inline">· closed</span>
      )}
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
      {accountError && (
        <p role="alert" className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-lg border border-loss/40 bg-loss/10 px-4 py-2.5 text-sm text-loss md:mx-6">
          Couldn&apos;t reach your account. Your positions are safe — retrying.
          <button onClick={() => loadAccount()} className="pressable rounded-full border border-loss/40 px-3 py-1 text-xs">Retry now</button>
        </p>
      )}
      {quotesStale && (
        <p className="mx-4 mt-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning md:mx-6">
          Prices paused — reconnecting to the data feed. The numbers below may be a moment behind.
        </p>
      )}

      <main className="grid flex-1 gap-4 p-4 pb-20 md:grid-cols-[1fr_340px] md:p-6 md:pb-6">
        {/* ---------- left: chart + ticket ---------- */}
        <div className="flex min-w-0 flex-col gap-4">
          <section className="panel overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
              <div className="flex items-baseline gap-3">
                <h1 className="font-display text-lg font-bold tracking-wide text-ink-1">{symbol}</h1>
                {quote ? (
                  <>
                    <span className="tnum text-lg text-ink-1">{usd(quote.price)}</span>
                    <span className={`tnum text-sm ${quote.changePercent > 0 ? "text-gain" : quote.changePercent < 0 ? "text-loss" : "text-ink-3"}`}>
                      {pct(quote.changePercent)}
                    </span>
                    {Date.now() - quote.asOf > 5 * 60_000 && (
                      <span className="text-[11px] text-ink-4">
                        as of {new Date(quote.asOf).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="skeleton h-5 w-28" />
                )}
              </div>
              <div className="flex gap-1">
                {(["1D", "1W", "1M", "3M", "1Y", "5Y"] as Timeframe[]).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`pressable tnum rounded-full px-3 py-1.5 text-xs ${
                      tf === timeframe ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {barsError ? (
              <div className="flex h-[300px] flex-col items-center justify-center gap-3 px-6 text-center md:h-[420px]">
                <p className="text-sm text-ink-2">{barsError}</p>
                <button
                  onClick={() => setReloadNonce((n) => n + 1)}
                  className="pressable rounded-full border border-hairline px-4 py-2 text-xs text-ink-2"
                >
                  Retry
                </button>
              </div>
            ) : bars.length ? (
              <PriceChart bars={bars} height={chartHeight} />
            ) : (
              <div className="skeleton m-4 h-[300px] md:h-[404px]" />
            )}
          </section>

          <Ticket
            symbol={symbol}
            quote={quote}
            cash={account?.cash ?? 0}
            marketOpen={marketOpen}
            onPlaced={refreshAfterTrade}
          />
        </div>

        {/* ---------- right rail ---------- */}
        <aside className="flex min-w-0 flex-col gap-4">
          <nav className="flex gap-1 rounded-full border border-hairline bg-bg1 p-1">
            {([["watch", "Watch"], ["positions", `Pos${positions.length ? ` ${positions.length}` : ""}`], ["orders", `Ord${openOrders.length ? ` ${openOrders.length}` : ""}`], ["alerts", "Alerts"], ["perf", "Perf"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRail(key)}
                className={`pressable flex-1 rounded-full px-3 py-2 text-xs font-medium ${
                  rail === key ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {rail === "watch" && (
            <Watchlist
              symbols={watchlist}
              quotes={quotes}
              selected={symbol}
              marketOpen={marketOpen}
              onSelect={setSymbol}
              onChange={(w) => { setWatchlist(w); watchlistRef.current = w; loadQuotes(); }}
            />
          )}
          {rail === "positions" && (
            <Positions
              positions={positions}
              quotes={quotes}
              onSelect={setSymbol}
              onClosed={refreshAfterTrade}
            />
          )}
          {rail === "orders" && (
            <Orders orders={orders} onCanceled={refreshAfterTrade} />
          )}
          {rail === "alerts" && <Alerts symbol={symbol} quote={quote} />}
          {rail === "perf" && <Performance />}
        </aside>
      </main>

      <p className="pb-6 text-center text-xs text-ink-4">
        Education, not investment advice. Every fill here is simulated.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Ticket({ symbol, quote, cash, marketOpen, onPlaced }: {
  symbol: string;
  quote: Quote | undefined;
  cash: number;
  marketOpen: boolean | null;
  onPlaced: () => void;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit" | "stop">("market");
  const [qty, setQty] = useState("1");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [phase, setPhase] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "done"; order: Order } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const toast = useToast();

  const isCrypto = symbol.includes("/");
  const qtyNum = Number(qty) || 0;
  const estPrice = type === "limit" ? Number(limitPrice) || quote?.price || 0 : quote?.price || 0;
  const estCost = qtyNum * estPrice;
  const capacity = cash > 0 ? estCost / cash : 0;
  const blocked = side === "buy" && estCost > cash;
  const valid = qtyNum > 0 && estPrice > 0 && !blocked
    && (type !== "limit" || Number(limitPrice) > 0)
    && (type !== "stop" || Number(stopPrice) > 0);

  useEffect(() => { setPhase({ kind: "idle" }); }, [symbol]);

  async function submit() {
    if (!valid) return;
    setPhase({ kind: "sending" });
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol, side, type, qty: qtyNum,
          limitPrice: type === "limit" ? Number(limitPrice) : undefined,
          stopPrice: type === "stop" ? Number(stopPrice) : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPhase({ kind: "done", order: data.order });
        const o = data.order;
        if (o.status === "filled") {
          toast({ kind: side === "buy" ? "gain" : "loss",
            title: `${side === "buy" ? "Bought" : "Sold"} ${o.qty} ${symbol}`,
            body: `Filled @ ${usd(o.filledPrice ?? 0)}` });
        } else {
          toast({ kind: "info", title: `${side === "buy" ? "Buy" : "Sell"} ${o.qty} ${symbol} resting`,
            body: "It'll fill when price agrees." });
        }
        onPlaced();
      } else {
        const message = data.order?.rejectReason ?? data.error ?? "Order didn't go through.";
        setPhase({ kind: "error", message });
        toast({ kind: "loss", title: "Order rejected", body: message });
      }
    } catch {
      setPhase({ kind: "error", message: "Couldn't reach the exchange. Nothing was placed — try again." });
    }
  }

  return (
    <section className="panel p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">
          Ticket · {symbol}
        </h2>
        {!isCrypto && marketOpen === false && (
          <span className="text-[11px] text-ink-4">Market closed — orders rest until the bell</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Side */}
        <div className="flex rounded-full border border-hairline bg-bg2 p-1">
          {(["buy", "sell"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)}
              className={`pressable flex-1 rounded-full py-2 text-sm font-semibold capitalize ${
                side === s
                  ? s === "buy" ? "bg-gain/20 text-gain" : "bg-loss/20 text-loss"
                  : "text-ink-3"
              }`}>
              {s}
            </button>
          ))}
        </div>

        {/* Type */}
        <div className="flex rounded-full border border-hairline bg-bg2 p-1">
          {(["market", "limit", "stop"] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={`pressable flex-1 rounded-full py-2 text-xs font-medium capitalize ${
                type === t ? "bg-bg3 text-ink-1" : "text-ink-3"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Qty */}
        <label className="flex items-center gap-2 rounded-full border border-hairline bg-bg2 px-4">
          <span className="text-xs text-ink-3">Qty</span>
          <input
            value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            className="tnum w-full bg-transparent py-2 text-right text-sm text-ink-1 outline-none"
            aria-label="Quantity"
          />
        </label>

        {/* Conditional price */}
        {type === "limit" ? (
          <label className="flex items-center gap-2 rounded-full border border-hairline bg-bg2 px-4">
            <span className="text-xs text-ink-3">Limit</span>
            <input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal" placeholder={quote ? quote.price.toFixed(2) : ""}
              className="tnum w-full bg-transparent py-2 text-right text-sm text-ink-1 outline-none"
              aria-label="Limit price" />
          </label>
        ) : type === "stop" ? (
          <label className="flex items-center gap-2 rounded-full border border-hairline bg-bg2 px-4">
            <span className="text-xs text-ink-3">Stop</span>
            <input value={stopPrice} onChange={(e) => setStopPrice(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal" placeholder={quote ? quote.price.toFixed(2) : ""}
              className="tnum w-full bg-transparent py-2 text-right text-sm text-ink-1 outline-none"
              aria-label="Stop price" />
          </label>
        ) : (
          <div className="flex items-center justify-end gap-2 px-2 text-right">
            <span className="text-xs text-ink-3">Est.</span>
            <span className="tnum text-sm text-ink-1">{estCost > 0 ? usd(estCost) : "—"}</span>
          </div>
        )}
      </div>

      {/* Capacity + submit */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-bg3">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                capacity > 1 ? "bg-loss" : capacity > 0.5 ? "bg-gold" : "bg-gain"
              }`}
              style={{ width: `${Math.min(capacity * 100, 100)}%` }}
            />
          </div>
          <p className="tnum mt-1.5 text-[11px] text-ink-3">
            {blocked
              ? "Exceeds your buying power — reduce quantity."
              : `Uses ${(capacity * 100).toFixed(0)}% of ${usd(cash, 0)} buying power`}
          </p>
        </div>
        <div className="sm:w-64">
          {phase.kind === "done" ? (
            <FillResult order={phase.order} onReset={() => setPhase({ kind: "idle" })} />
          ) : phase.kind === "error" ? (
            <div className="flex items-center justify-between gap-3 rounded-full border border-loss/40 bg-loss/10 px-4 py-2.5">
              <span className="text-xs text-loss">{phase.message}</span>
              <button onClick={() => setPhase({ kind: "idle" })} className="text-xs text-ink-2 underline">Adjust</button>
            </div>
          ) : (
            <HoldButton
              label={`${side === "buy" ? "Buy" : "Sell"} ${qtyNum || ""} ${symbol}`}
              holdLabel="Keep holding…"
              tone={side === "buy" ? "gold" : "loss"}
              disabled={!valid || phase.kind === "sending" || !quote}
              onCommit={submit}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function FillResult({ order, onReset }: { order: Order; onReset: () => void }) {
  const filled = order.status === "filled";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-full border px-4 py-2.5 ${
      filled ? "border-gain/40 bg-gain/10" : "border-gold/40 bg-gold/10"
    }`}>
      <span className={`tnum text-xs ${filled ? "text-gain" : "text-gold"}`}>
        {filled
          ? `Filled ${order.qty} @ ${usd(order.filledPrice ?? 0)}`
          : "Order resting — it'll fill when price agrees"}
      </span>
      <button onClick={onReset} className="text-xs text-ink-2 underline">New</button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Watchlist({ symbols, quotes, selected, marketOpen, onSelect, onChange }: {
  symbols: string[];
  quotes: Map<string, Quote>;
  selected: string;
  marketOpen: boolean | null;
  onSelect: (s: string) => void;
  onChange: (w: string[]) => void;
}) {
  const [adding, setAdding] = useState("");
  const [view, setView] = useState<"list" | "heat">("list");

  async function add(raw: string) {
    const symbol = raw.trim().toUpperCase();
    if (!symbol) return;
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();
      if (data.ok) { onChange(data.watchlist); setAdding(""); }
    } catch { /* transient — user can retry */ }
  }

  async function remove(symbol: string) {
    await fetch("/api/watchlist", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    onChange(symbols.filter((s) => s !== symbol));
  }

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Watchlist</h2>
        <div className="flex items-center gap-2">
          {marketOpen === false && <span className="text-[10px] text-ink-4">Last session</span>}
          <div className="flex rounded-full border border-hairline bg-bg2 p-0.5">
            {(["list", "heat"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-medium capitalize ${
                  view === v ? "bg-bg3 text-ink-1" : "text-ink-4"
                }`}
                aria-pressed={view === v}>
                {v === "heat" ? "Heatmap" : "List"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "heat" ? (
        <div className="grid grid-cols-2 gap-1.5 p-2 sm:grid-cols-3">
          {symbols.map((s) => {
            const q = quotes.get(s);
            const chg = q?.changePercent ?? 0;
            // Intensity saturates at ±3%; green up, red down, neutral bg when flat/unknown.
            const mag = Math.min(Math.abs(chg) / 0.03, 1);
            const bg = !q ? "var(--bg2)"
              : chg >= 0 ? `oklch(from var(--gain) l c h / ${(0.10 + mag * 0.32).toFixed(2)})`
              : `oklch(from var(--loss) l c h / ${(0.10 + mag * 0.32).toFixed(2)})`;
            return (
              <button key={s} onClick={() => onSelect(s)}
                style={{ backgroundColor: bg }}
                className={`flex flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left transition-transform hover:scale-[1.02] ${
                  s === selected ? "ring-1 ring-gold" : ""
                }`}>
                <span className="text-xs font-semibold text-ink-1">{s}</span>
                {q ? (
                  <span className={`tnum text-[11px] ${chg > 0 ? "text-gain" : chg < 0 ? "text-loss" : "text-ink-3"}`}>
                    {pct(chg)}
                  </span>
                ) : <span className="skeleton h-3 w-10" />}
              </button>
            );
          })}
        </div>
      ) : (
      <ul>
        {symbols.map((s) => {
          const q = quotes.get(s);
          return (
            <li key={s}
              className={`group flex min-h-11 cursor-pointer items-center justify-between px-4 py-2.5 transition-colors ${
                s === selected ? "bg-bg2" : "hover:bg-bg2/50"
              }`}
              onClick={() => onSelect(s)}
            >
              <span className="flex items-center gap-2">
                <span className={`h-4 w-0.5 rounded-full ${s === selected ? "bg-gold" : "bg-transparent"}`} />
                <span className="text-sm font-semibold text-ink-1">{s}</span>
              </span>
              <span className="flex items-center gap-3">
                {q ? (
                  <>
                    <span className="tnum text-xs text-ink-1">{usd(q.price)}</span>
                    <span className={`tnum w-16 text-right text-xs ${q.changePercent > 0 ? "text-gain" : q.changePercent < 0 ? "text-loss" : "text-ink-3"}`}>
                      {pct(q.changePercent)}
                    </span>
                  </>
                ) : (
                  <span className="skeleton h-3.5 w-24" />
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); remove(s); }}
                  className="pressable flex h-9 w-9 items-center justify-center text-ink-4 hover:text-loss"
                  aria-label={`Remove ${s} from watchlist`}
                >
                  ×
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      )}
      <div className="flex gap-2 border-t border-hairline p-3">
        <SymbolInput value={adding} onChange={setAdding} onSubmit={add} />
        <button type="button" onClick={() => add(adding)}
          className="pressable rounded-full border border-hairline px-4 text-xs text-ink-2 hover:text-ink-1">
          Add
        </button>
      </div>
    </section>
  );
}

function Positions({ positions, quotes, onSelect, onClosed }: {
  positions: Position[];
  quotes: Map<string, Quote>;
  onSelect: (s: string) => void;
  onClosed: () => void;
}) {
  const [closing, setClosing] = useState<string | null>(null);

  async function close(p: Position) {
    setClosing(p.id);
    try {
      await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: p.symbol, side: "sell", type: "market", qty: p.qty }),
      });
    } finally {
      setClosing(null);
      onClosed();
    }
  }

  if (!positions.length) {
    return (
      <section className="panel flex flex-col items-center gap-2 px-6 py-12 text-center">
        <p className="text-sm text-ink-2">No positions yet.</p>
        <p className="text-xs text-ink-4">Pick a symbol, size it modestly, and hold the gold button.</p>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-hairline px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Positions</h2>
      </div>
      <ul>
        {positions.map((p) => {
          const q = quotes.get(p.symbol);
          const value = (q?.price ?? p.avgEntryPrice) * p.qty;
          const pnl = q ? (q.price - p.avgEntryPrice) * p.qty : 0;
          return (
            <li key={p.id} className="border-b border-hairline px-4 py-3 last:border-0">
              <div className="flex items-center justify-between">
                <button onClick={() => onSelect(p.symbol)} className="pressable text-left">
                  <p className="text-sm font-semibold text-ink-1">{p.symbol}</p>
                  <p className="tnum text-[11px] text-ink-3">
                    {p.qty} @ {usd(p.avgEntryPrice)}
                  </p>
                </button>
                <div className="text-right">
                  <p className="tnum text-sm text-ink-1">{usd(value)}</p>
                  <p className={`tnum text-[11px] ${pnl > 0 ? "text-gain" : pnl < 0 ? "text-loss" : "text-ink-3"}`}>
                    {pnl >= 0 ? "+" : ""}{usd(pnl)}
                  </p>
                </div>
              </div>
              <div className="mt-2">
                <HoldButton
                  label={closing === p.id ? "Closing…" : `Close position`}
                  holdLabel="Keep holding to close…"
                  tone="loss"
                  disabled={closing === p.id}
                  onCommit={() => close(p)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Orders({ orders, onCanceled }: { orders: Order[]; onCanceled: () => void }) {
  async function cancel(id: string) {
    try { await fetch(`/api/orders/${id}`, { method: "DELETE" }); }
    finally { onCanceled(); }
  }

  if (!orders.length) {
    return (
      <section className="panel flex flex-col items-center gap-2 px-6 py-12 text-center">
        <p className="text-sm text-ink-2">No orders yet.</p>
        <p className="text-xs text-ink-4">Everything you place — filled, resting, or rejected — shows up here.</p>
      </section>
    );
  }

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-hairline px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Orders</h2>
      </div>
      <ul className="max-h-[480px] overflow-y-auto">
        {orders.slice(0, 40).map((o) => (
          <li key={o.id} className="flex items-center justify-between border-b border-hairline px-4 py-2.5 last:border-0">
            <div>
              <p className="text-sm text-ink-1">
                <span className={o.side === "buy" ? "text-gain" : "text-loss"}>{o.side}</span>{" "}
                <span className="tnum">{o.qty}</span> {o.symbol}
              </p>
              <p className="tnum text-[11px] text-ink-4">
                {o.type}{o.limitPrice ? ` @ ${usd(o.limitPrice)}` : ""}{o.stopPrice ? ` stop ${usd(o.stopPrice)}` : ""}
                {" · "}{new Date(o.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </p>
              {o.rejectReason && <p className="text-[11px] text-loss">{o.rejectReason}</p>}
            </div>
            <div className="flex items-center gap-2">
              <span className={`tnum text-[10px] uppercase tracking-[0.15em] ${
                o.status === "filled" ? "text-gain"
                : o.status === "accepted" ? "text-gold"
                : o.status === "rejected" ? "text-loss" : "text-ink-4"
              }`}>
                {o.status === "accepted" ? "resting" : o.status}
              </span>
              {o.status === "accepted" && (
                <button onClick={() => cancel(o.id)}
                  className="pressable rounded-full border border-hairline px-2.5 py-1 text-[11px] text-ink-3 hover:text-loss"
                  aria-label={`Cancel ${o.side} order for ${o.symbol}`}>
                  Cancel
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

type Alert = {
  id: string; symbol: string; price: number; direction: "above" | "below";
  triggeredAt: number | null; createdAt: number;
};

/** Price alerts — set a level on the current symbol; the quote poll fires it
    and toasts app-wide. TradingView's Ctrl+A, made simple. */
function Alerts({ symbol, quote }: { symbol: string; quote: Quote | undefined }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [price, setPrice] = useState("");
  const [direction, setDirection] = useState<"above" | "below">("above");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      if (data.ok) setAlerts(data.alerts);
    } catch { /* transient */ }
  }, []);
  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  // Default the level + direction to the current price when the symbol changes.
  useEffect(() => {
    if (quote) {
      setPrice(quote.price.toFixed(2));
      setDirection("above");
    }
  }, [symbol, quote?.price]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    const p = Number(price);
    if (!(p > 0)) return;
    try {
      const res = await fetch("/api/alerts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, price: p, direction }),
      });
      if ((await res.json()).ok) load();
    } catch { /* transient */ }
  }
  async function remove(id: string) {
    try { await fetch(`/api/alerts/${id}`, { method: "DELETE" }); } finally { load(); }
  }

  const active = alerts.filter((a) => a.triggeredAt == null);
  const fired = alerts.filter((a) => a.triggeredAt != null);

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-hairline px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Alerts · {symbol}</h2>
      </div>

      {/* Quick-set for the current symbol */}
      <div className="flex flex-col gap-2 border-b border-hairline p-3">
        <div className="flex rounded-full border border-hairline bg-bg2 p-0.5">
          {(["above", "below"] as const).map((d) => (
            <button key={d} onClick={() => setDirection(d)}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium capitalize ${
                direction === d ? "bg-bg3 text-ink-1" : "text-ink-3"
              }`}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal" placeholder="Price"
            className="tnum w-full rounded-full border border-hairline bg-bg2 px-4 py-2 text-xs text-ink-1 outline-none focus:border-gold"
            aria-label="Alert price" />
          <button onClick={add}
            className="pressable rounded-full border border-hairline px-4 text-xs text-ink-2 hover:text-ink-1">
            Set
          </button>
        </div>
      </div>

      {active.length === 0 && fired.length === 0 ? (
        <p className="px-5 py-8 text-center text-xs text-ink-4">
          No alerts yet. Set a level above or below and we&apos;ll ping you when price crosses it.
        </p>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto">
          {active.map((a) => (
            <li key={a.id} className="flex items-center justify-between border-b border-hairline px-4 py-2.5 text-xs last:border-0">
              <span className="text-ink-1">
                {a.symbol} <span className="text-ink-4">{a.direction}</span>{" "}
                <span className="tnum">{usd(a.price)}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="tnum text-[10px] uppercase tracking-[0.15em] text-gold">armed</span>
                <button onClick={() => remove(a.id)} className="pressable text-ink-4 hover:text-loss" aria-label="Remove alert">×</button>
              </div>
            </li>
          ))}
          {fired.map((a) => (
            <li key={a.id} className="flex items-center justify-between border-b border-hairline px-4 py-2.5 text-xs last:border-0 opacity-60">
              <span className="text-ink-2">
                {a.symbol} crossed <span className="text-ink-3">{a.direction}</span>{" "}
                <span className="tnum">{usd(a.price)}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="tnum text-[10px] uppercase tracking-[0.15em] text-gain">fired</span>
                <button onClick={() => remove(a.id)} className="pressable text-ink-4 hover:text-loss" aria-label="Remove alert">×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type JournalEntry = {
  id: string; symbol: string; side: string; qty: number;
  entryPrice: number; exitPrice: number | null; pnl: number | null; createdAt: number;
};

/** Your track record — the equity curve and closed-trade journal that the
    app records on every fill but never showed until now. */
function Performance() {
  const [history, setHistory] = useState<{ time: number; equity: number }[] | null>(null);
  const [journal, setJournal] = useState<JournalEntry[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/portfolio");
        const data = await res.json();
        if (alive && data.ok) { setHistory(data.history); setJournal(data.journal); }
        else if (alive) setHistory([]);
      } catch { if (alive) setHistory([]); }
    })();
    return () => { alive = false; };
  }, []);

  const realized = journal.reduce((s, j) => s + (j.pnl ?? 0), 0);
  const wins = journal.filter((j) => (j.pnl ?? 0) > 0).length;
  const closed = journal.filter((j) => j.pnl != null).length;

  return (
    <section className="panel overflow-hidden">
      <div className="border-b border-hairline px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Performance</h2>
      </div>

      <div className="p-4">
        {history == null ? (
          <div className="skeleton h-16 w-full" />
        ) : history.length >= 2 ? (
          <EquitySpark points={history} />
        ) : (
          <p className="py-6 text-center text-xs text-ink-4">
            Your equity curve draws itself as you trade. Make a move on the desk.
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-bg2 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">Realized</p>
            <p className={`tnum text-sm font-semibold ${realized > 0 ? "text-gain" : realized < 0 ? "text-loss" : "text-ink-2"}`}>
              {realized >= 0 ? "+" : ""}{usd(realized)}
            </p>
          </div>
          <div className="rounded-lg bg-bg2 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">Win rate</p>
            <p className="tnum text-sm font-semibold text-ink-1">
              {closed ? `${Math.round((wins / closed) * 100)}%` : "—"}
              <span className="text-[10px] font-normal text-ink-4"> · {closed} closed</span>
            </p>
          </div>
        </div>
      </div>

      {journal.length > 0 && (
        <ul className="max-h-[300px] overflow-y-auto border-t border-hairline">
          {journal.map((j) => (
            <li key={j.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
              <span className="text-ink-1">
                {j.symbol} <span className="tnum text-ink-4">{j.qty} @ {usd(j.entryPrice)}
                {j.exitPrice != null ? ` → ${usd(j.exitPrice)}` : ""}</span>
              </span>
              {j.pnl != null && (
                <span className={`tnum font-medium ${j.pnl > 0 ? "text-gain" : j.pnl < 0 ? "text-loss" : "text-ink-3"}`}>
                  {j.pnl >= 0 ? "+" : ""}{usd(j.pnl)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EquitySpark({ points }: { points: { time: number; equity: number }[] }) {
  const vals = points.map((p) => p.equity);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const W = 300, H = 64;
  const up = vals[vals.length - 1] >= vals[0];
  const path = points.map((p, i) =>
    `${((i / (points.length - 1)) * W).toFixed(1)},${(H - ((p.equity - min) / range) * H).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" preserveAspectRatio="none" aria-label="Equity curve">
      <polyline points={path} fill="none" stroke={up ? "var(--gain)" : "var(--loss)"} strokeWidth="1.5" />
    </svg>
  );
}

