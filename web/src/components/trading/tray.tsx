"use client";

import { useCallback, useEffect, useState } from "react";
import HoldButton from "@/components/hold-button";
import AnalyticsBoard from "./analytics-board";
import { usd, contractSize, displaySymbol, isFutureSymbol, futuresUiSpec, type Quote, type Position, type Order } from "./shared";

/*
  The portfolio tray — the persistent bottom band of every market page.
  Positions, Orders, Alerts, and Performance as flat, dense panels (no outer
  card chrome; the tray provides the frame).
*/

export function Positions({ positions, quotes, onSelect, onClosed }: {
  positions: Position[];
  quotes: Map<string, Quote>;
  onSelect: (s: string) => void;
  onClosed: () => void;
}) {
  const [closing, setClosing] = useState<string | null>(null);

  async function close(p: Position) {
    setClosing(p.id);
    try {
      // Close by trading the opposite side: a long sells, a SHORT buys to cover.
      await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: p.symbol, side: p.qty < 0 ? "buy" : "sell", type: "market", qty: Math.abs(p.qty) }),
      });
    } finally {
      setClosing(null);
      onClosed();
    }
  }

  if (!positions.length) {
    return (
      <p className="px-6 py-10 text-center text-xs text-ink-4">
        No positions yet. Pick a market, size it modestly, and hold the gold button.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--hairline)]">
      {positions.map((p) => {
        const q = quotes.get(p.symbol);
        // An option contract covers 100 shares — see contractSize().
        const mult = contractSize(p.symbol);
        const value = (q?.price ?? p.avgEntryPrice) * p.qty * mult;
        const pnl = q ? (q.price - p.avgEntryPrice) * p.qty * mult : 0;
        /*
          Futures show MARGIN, not notional (gap 12). "1 ES = $372,000"
          beside a $100k account read as though the account held $372k of
          stock; what it actually holds is a $23,000 requirement controlling
          that notional. Both numbers appear, labelled, so leverage is
          legible rather than alarming.
        */
        const fut = isFutureSymbol(p.symbol) ? futuresUiSpec(p.symbol) : null;
        const margin = fut ? fut.im * Math.abs(p.qty) : 0;
        return (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-5">
            <button onClick={() => onSelect(p.symbol)} className="pressable min-h-11 min-w-[110px] text-left">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-1">
                {displaySymbol(p.symbol)}
                {p.qty < 0 && <span className="rounded bg-loss/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-loss">Short</span>}
              </p>
              <p className="tnum text-[11px] text-ink-3">{p.qty < 0 ? p.qty : `+${p.qty}`} @ {usd(p.avgEntryPrice)}</p>
            </button>
            <div className="min-w-[110px] text-right md:text-left">
              {fut ? (
                <>
                  <p className="tnum text-sm text-ink-1">{usd(margin)}<span className="ml-1 text-[10px] font-normal text-ink-4">margin</span></p>
                  <p className="tnum text-[10px] text-ink-4">{usd(Math.abs(value), 0)} notional</p>
                </>
              ) : (
                <p className="tnum text-sm text-ink-1">{usd(value)}</p>
              )}
              <p className={`tnum text-[11px] ${pnl > 0 ? "text-gain" : pnl < 0 ? "text-loss" : "text-ink-3"}`}>
                {pnl >= 0 ? "+" : ""}{usd(pnl)}
              </p>
            </div>
            <div className="ml-auto w-full sm:w-56">
              <HoldButton
                label={closing === p.id ? "Closing…" : "Close position"}
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
  );
}

export function Orders({ orders, onCanceled }: { orders: Order[]; onCanceled: () => void }) {
  /*
    Search and status filter (gap 29). The order list was an
    unsearchable, unfilterable 60-row wall — the moment a desk has any
    history, finding "that AAPL stop from Tuesday" meant scrolling and
    hoping. Both filters are client-side over the polled snapshot, so they
    cost nothing and feel instant.
  */
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "filled" | "accepted" | "rejected">("all");

  async function cancel(id: string) {
    try { await fetch(`/api/orders/${id}`, { method: "DELETE" }); }
    finally { onCanceled(); }
  }

  const shown = orders.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    const q = query.trim().toUpperCase();
    return !q || displaySymbol(o.symbol).includes(q) || o.type.toUpperCase().includes(q);
  });

  if (!orders.length) {
    return (
      <p className="px-6 py-10 text-center text-xs text-ink-4">
        No orders yet. Everything you place — filled, resting, or rejected — shows up here.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 md:px-5">
        <input value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by symbol or type…"
          aria-label="Filter orders"
          className="min-h-9 min-w-[160px] flex-1 rounded-lg border border-hairline bg-bg2 px-3 text-xs text-ink-1 outline-none focus:border-gold" />
        <div className="flex gap-1">
          {(["all", "filled", "accepted", "rejected"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={`pressable min-h-9 rounded-full px-3 text-[11px] capitalize transition-colors ${
                status === s ? "bg-gold/15 text-gold" : "text-ink-4 hover:text-ink-2"
              }`}>
              {s === "accepted" ? "resting" : s}
            </button>
          ))}
        </div>
        <span className="tnum ml-auto text-[10px] text-ink-4">{shown.length} of {orders.length}</span>
      </div>
      {shown.length === 0 && (
        <p className="px-6 py-8 text-center text-xs text-ink-4">Nothing matches that filter.</p>
      )}
    <ul className="max-h-[380px] divide-y divide-[var(--hairline)] overflow-y-auto">
      {shown.slice(0, 200).map((o) => (
        <li key={o.id} className="flex items-center justify-between px-4 py-2.5 md:px-5">
          <div>
            <p className="text-sm text-ink-1">
              <span className={o.side === "buy" ? "text-gain" : "text-loss"}>{o.side}</span>{" "}
              <span className="tnum">{o.qty}</span> {displaySymbol(o.symbol)}
            </p>
            <p className="tnum text-[11px] text-ink-4">
              {o.type}{o.limitPrice ? ` @ ${usd(o.limitPrice)}` : ""}{o.stopPrice ? ` stop ${usd(o.stopPrice)}` : ""}
              {" · "}{new Date(o.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </p>
            {o.status === "accepted" && (o.filledQty ?? 0) > 0 && (
              <p className="tnum text-[11px] text-gold">
                {o.filledQty} of {o.qty} filled{o.filledPrice ? ` at ${usd(o.filledPrice)} avg` : ""} — still working
              </p>
            )}
            {o.rejectReason && <p className="text-[11px] text-loss">{o.rejectReason}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className={`tnum text-[10px] uppercase tracking-[0.15em] ${
              o.status === "filled" ? "text-gain"
              : o.status === "accepted" ? "text-gold"
              : o.status === "rejected" ? "text-loss" : "text-ink-4"
            }`}>
              {o.status === "accepted"
                ? (o.filledQty && o.filledQty > 0 ? "working" : "resting")
                : o.status}
            </span>
            {o.status === "accepted" && (
              <button onClick={() => cancel(o.id)}
                className="pressable min-h-11 rounded-full border border-hairline px-3.5 text-[11px] text-ink-3 hover:text-loss"
                aria-label={`Cancel ${o.side} order for ${displaySymbol(o.symbol)}`}>
                Cancel
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
    </>
  );
}

type Alert = {
  id: string; symbol: string; price: number; direction: "above" | "below";
  triggeredAt: number | null; createdAt: number;
};

/** Price alerts — set a level on the current symbol; the quote poll fires it
    and toasts app-wide. */
export function Alerts({ symbol, quote }: { symbol: string; quote: Quote | undefined }) {
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
  useEffect(() => { load(); const id = setInterval(() => { if (typeof document !== "undefined" && document.hidden) return; load(); }, 20_000); return () => clearInterval(id); }, [load]);

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
    <div className="grid gap-0 md:grid-cols-[280px_1fr]">
      {/* Quick-set for the current symbol */}
      <div className="flex flex-col gap-2 border-b border-hairline p-4 md:border-b-0 md:border-r">
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-4">New alert · {symbol}</p>
        <div className="flex rounded-full border border-hairline bg-bg2 p-0.5">
          {(["above", "below"] as const).map((d) => (
            <button key={d} onClick={() => setDirection(d)}
              className={`pressable min-h-11 flex-1 rounded-full text-xs font-medium capitalize transition-colors ${
                direction === d ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
              }`}
              aria-pressed={direction === d}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal" placeholder="Price"
            className="tnum min-h-11 w-full rounded-full border border-hairline bg-bg2 px-4 text-xs text-ink-1 outline-none focus:border-gold"
            aria-label="Alert price" />
          <button onClick={add}
            className="pressable min-h-11 rounded-full border border-hairline px-4 text-xs text-ink-2 hover:text-ink-1">
            Set
          </button>
        </div>
      </div>

      {active.length === 0 && fired.length === 0 ? (
        <p className="px-6 py-10 text-center text-xs text-ink-4">
          No alerts yet. Set a level and we&apos;ll ping you when price crosses it.
        </p>
      ) : (
        <ul className="max-h-[300px] divide-y divide-[var(--hairline)] overflow-y-auto">
          {active.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-xs md:px-5">
              <span className="text-ink-1">
                {a.symbol} <span className="text-ink-4">{a.direction}</span>{" "}
                <span className="tnum">{usd(a.price)}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="tnum text-[10px] uppercase tracking-[0.15em] text-gold">armed</span>
                <button onClick={() => remove(a.id)}
                  className="pressable -my-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-4 hover:text-loss"
                  aria-label="Remove alert">×</button>
              </div>
            </li>
          ))}
          {fired.map((a) => (
            <li key={a.id} className="flex items-center justify-between px-4 py-2.5 text-xs opacity-60 md:px-5">
              <span className="text-ink-2">
                {a.symbol} crossed <span className="text-ink-3">{a.direction}</span>{" "}
                <span className="tnum">{usd(a.price)}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="tnum text-[10px] uppercase tracking-[0.15em] text-gain">fired</span>
                <button onClick={() => remove(a.id)}
                  className="pressable -my-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-4 hover:text-loss"
                  aria-label="Remove alert">×</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type JournalEntry = {
  id: string; symbol: string; side: string; qty: number;
  entryPrice: number; exitPrice: number | null; pnl: number | null; createdAt: number;
};

/** Your track record — equity curve + closed-trade journal. */
export function Performance() {
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
    <>
    <AnalyticsBoard />
    <div className="grid gap-0 border-t border-hairline md:grid-cols-[1fr_1fr]">
      <div className="border-b border-hairline p-4 md:border-b-0 md:border-r md:p-5">
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
          <div className="card py-2.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">Realized</p>
            <p className={`tnum text-sm font-semibold ${realized > 0 ? "text-gain" : realized < 0 ? "text-loss" : "text-ink-2"}`}>
              {realized >= 0 ? "+" : ""}{usd(realized)}
            </p>
          </div>
          <div className="card py-2.5">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">Win rate</p>
            <p className="tnum text-sm font-semibold text-ink-1">
              {closed ? `${Math.round((wins / closed) * 100)}%` : "—"}
              <span className="text-[10px] font-normal text-ink-4"> · {closed} closed</span>
            </p>
          </div>
        </div>
      </div>

      {journal.length > 0 ? (
        <ul className="max-h-[300px] divide-y divide-[var(--hairline)] overflow-y-auto">
          {journal.map((j) => (
            <li key={j.id} className="flex items-center justify-between px-4 py-2.5 text-xs md:px-5">
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
      ) : (
        <p className="px-6 py-10 text-center text-xs text-ink-4">Closed trades will journal themselves here.</p>
      )}
    </div>
    </>
  );
}

function EquitySpark({ points }: { points: { time: number; equity: number }[] }) {
  const vals = points.map((p) => p.equity);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const W = 300, H = 64;
  const up = vals[vals.length - 1] >= vals[0];
  const coords = points.map((p, i) => [
    (i / (points.length - 1)) * W,
    H - 2 - ((p.equity - min) / range) * (H - 4),
  ] as const);
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ex, ey] = coords[coords.length - 1];
  const tone = up ? "var(--gain)" : "var(--loss)";
  const gid = up ? "equity-grad-up" : "equity-grad-down";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" preserveAspectRatio="none" aria-label="Equity curve">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={tone} stopOpacity="0.24" />
          <stop offset="100%" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={`url(#${gid})`} stroke="none" />
      <polyline points={line} fill="none" stroke={tone} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ex} cy={ey} r="3.4" fill={tone} opacity="0.2" />
      <circle cx={ex} cy={ey} r="1.8" fill={tone} />
    </svg>
  );
}
