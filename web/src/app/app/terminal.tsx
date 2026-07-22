"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import HoldButton from "@/components/hold-button";
import AppNav from "@/components/app-nav";
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

  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [orders, setOrders] = useState<Order[]>([]);
  const [marketOpen, setMarketOpen] = useState<boolean | null>(null);

  const [symbol, setSymbol] = useState("AAPL");
  const [timeframe, setTimeframe] = useState<Timeframe>("3M");
  const [bars, setBars] = useState<ChartBar[]>([]);
  const [barsError, setBarsError] = useState<string | null>(null);
  const [rail, setRail] = useState<"watch" | "positions" | "orders">("watch");
  const [chartHeight, setChartHeight] = useState(420);


  const watchlistRef = useRef<string[]>([]);
  const positionsRef = useRef<Position[]>([]);

  useEffect(() => {
    const fit = () => setChartHeight(window.innerWidth < 768 ? 300 : 420);
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  // ---------- data loops ----------
  const loadAccount = useCallback(async () => {
    const res = await fetch("/api/account");
    if (res.status === 401) { router.push("/login"); return; }
    const data = await res.json();
    if (data.ok) {
      setAccount(data.account);
      setPositions(data.positions);
      positionsRef.current = data.positions;
      setWatchlist(data.watchlist);
      watchlistRef.current = data.watchlist;
    }
  }, [router]);

  const loadQuotes = useCallback(async () => {
    const symbols = Array.from(new Set([
      ...watchlistRef.current,
      ...positionsRef.current.map((p) => p.symbol),
    ]));
    if (!symbols.length) return;
    const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.ok) {
      setQuotes((prev) => {
        const next = new Map(prev);
        (data.quotes as Quote[]).forEach((q) => next.set(q.symbol, q));
        return next;
      });
      setMarketOpen(data.marketOpen);
    }
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
      const res = await fetch(`/api/market/bars?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}`);
      const data = await res.json();
      if (!alive) return;
      if (data.ok) setBars(data.bars);
      else setBarsError(data.error ?? "Couldn't load history.");
    })();
    return () => { alive = false; };
  }, [symbol, timeframe]);

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

      {welcome && (
        <p className="mx-4 mt-4 rounded-lg border border-gold/25 bg-gold/8 px-4 py-2.5 text-sm text-gold md:mx-6">
          Your simulated $100,000 is live, {userName.split(" ")[0]}. Spend it on lessons, not luck.
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
                  onClick={() => setTimeframe((t) => t)}
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
            {([["watch", "Watchlist"], ["positions", `Positions${positions.length ? ` · ${positions.length}` : ""}`], ["orders", `Orders${openOrders.length ? ` · ${openOrders.length}` : ""}`]] as const).map(([key, label]) => (
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
      onPlaced();
    } else {
      setPhase({ kind: "error", message: data.order?.rejectReason ?? "Order didn't go through." });
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const symbol = adding.trim().toUpperCase();
    if (!symbol) return;
    const res = await fetch("/api/watchlist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    });
    const data = await res.json();
    if (data.ok) { onChange(data.watchlist); setAdding(""); }
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
        {marketOpen === false && <span className="text-[10px] text-ink-4">Last session</span>}
      </div>
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
      <form onSubmit={add} className="flex gap-2 border-t border-hairline p-3">
        <input
          value={adding} onChange={(e) => setAdding(e.target.value)}
          placeholder="Add symbol — e.g. MSFT or SOL/USD"
          className="w-full rounded-full border border-hairline bg-bg2 px-4 py-2 text-xs text-ink-1 outline-none focus:border-gold"
          aria-label="Add symbol to watchlist"
        />
        <button type="submit" className="pressable rounded-full border border-hairline px-4 text-xs text-ink-2 hover:text-ink-1">
          Add
        </button>
      </form>
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
    await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: p.symbol, side: "sell", type: "market", qty: p.qty }),
    });
    setClosing(null);
    onClosed();
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
    await fetch(`/api/orders/${id}`, { method: "DELETE" });
    onCanceled();
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

