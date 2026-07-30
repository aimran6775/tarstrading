"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import HoldButton from "@/components/hold-button";
import { useToast } from "@/components/toast";
import LearnLink from "@/components/academy/learn-link";
import { usd, isQuoteOnly, isIndexSymbol, displaySymbol, type Quote, type Order } from "./shared";

/*
  The order ticket, right-rail edition: a vertical card that lives beside the
  chart. Same engine as always — segmented side/type, live cost preview,
  buying-power meter, and the hold-to-submit gold button. `presetSide` lets
  inline Buy/Sell buttons elsewhere open the ticket pre-armed.
*/
export default function Ticket({ symbol, quote, cash, buyingPower, held = 0, marketOpen, onPlaced, presetSide }: {
  symbol: string;
  quote: Quote | undefined;
  cash: number;
  /** Reg-T buying power (margin). Falls back to cash until the account loads. */
  buyingPower?: number | null;
  /** Current signed position in this symbol — lets the ticket say Short / Cover. */
  held?: number;
  marketOpen: boolean | null;
  onPlaced: () => void;
  presetSide?: "buy" | "sell" | null;
}) {
  const rm = useReducedMotion();
  const quoteOnly = isQuoteOnly(symbol);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit" | "stop" | "stop_limit" | "trailing_stop">("market");
  const [trailPct, setTrailPct] = useState("");
  const [qty, setQty] = useState("1");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [phase, setPhase] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "done"; order: Order } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const toast = useToast();

  const qtyNum = Number(qty) || 0;
  const estPrice = (type === "limit" || type === "stop_limit") ? Number(limitPrice) || quote?.price || 0 : quote?.price || 0;
  const estCost = qtyNum * estPrice;
  // Buying power (margin) drives the buy limit; fall back to cash pre-load.
  const power = buyingPower ?? cash;
  const capacity = power > 0 ? estCost / power : 0;
  const blocked = side === "buy" && estCost > power + 1e-6;
  // Intent labels: a sell beyond what you hold OPENS a short; a buy against a
  // short COVERS it. Pure labeling — the engine enforces the margin.
  const opensShort = side === "sell" && !symbol.includes("/") && qtyNum > Math.max(0, held);
  const coversShort = side === "buy" && held < -1e-9;
  const actionLabel = side === "buy" ? (coversShort ? "Cover" : "Buy") : (opensShort ? "Short" : "Sell");
  const valid = qtyNum > 0 && estPrice > 0 && !blocked
    && ((type !== "limit" && type !== "stop_limit") || Number(limitPrice) > 0)
    && ((type !== "stop" && type !== "stop_limit") || Number(stopPrice) > 0)
    && (type !== "trailing_stop" || Number(trailPct) > 0);

  useEffect(() => { setPhase({ kind: "idle" }); }, [symbol]);
  useEffect(() => { if (presetSide) { setSide(presetSide); setPhase({ kind: "idle" }); } }, [presetSide]);

  async function submit() {
    if (!valid) return;
    setPhase({ kind: "sending" });
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol, side, type, qty: qtyNum,
          limitPrice: (type === "limit" || type === "stop_limit") ? Number(limitPrice) : undefined,
          stopPrice: (type === "stop" || type === "stop_limit") ? Number(stopPrice) : undefined,
          trailPercent: type === "trailing_stop" ? Number(trailPct) / 100 : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPhase({ kind: "done", order: data.order });
        const o = data.order as Order;
        if (o.status === "filled") {
          const past = { Buy: "Bought", Sell: "Sold", Short: "Shorted", Cover: "Covered" }[actionLabel];
          toast({ kind: side === "buy" ? "gain" : "loss",
            title: `${past} ${o.qty} ${symbol}`,
            body: `Filled @ ${usd(o.filledPrice ?? 0)}` });
        } else {
          toast({ kind: "info", title: `${actionLabel} ${o.qty} ${symbol} resting`,
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

  const isCrypto = symbol.includes("/");

  /*
    Quote-only instruments: an index is a NUMBER (you'd trade SPY, not the
    S&P 500 itself) and the futures desk has no margin model yet, so neither
    gets an order form. The server rejects these symbols too — this panel just
    explains why instead of letting a dead ticket 400.
  */
  if (quoteOnly) {
    return (
      <section className="raised relative overflow-hidden p-4">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Trade</h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-2">
          {isIndexSymbol(symbol)
            ? <>{displaySymbol(symbol)} is an index — a reference level, not a security. To take this exposure, trade its ETF (for example SPY tracks the S&amp;P&nbsp;500, QQQ the Nasdaq&nbsp;100).</>
            : <>{displaySymbol(symbol)} is a futures contract, shown for reference. Futures trading isn&apos;t on the desk yet — it needs its own margin model.</>}
        </p>
      </section>
    );
  }

  return (
    <section className="raised relative overflow-hidden p-4">
      {/* the signature thread — the same gold hairline that runs under the masthead */}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent" />
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Trade</h2>
          <LearnLink concept="orders" />
          <LearnLink concept="tilt" />
        </div>
        <span className="sim-mark">SIMULATED</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {/* Side — a true segmented control; the thumb slides between conviction states */}
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-hairline bg-bg2 p-1">
          {(["buy", "sell"] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)}
              className={`pressable relative min-h-11 rounded-[9px] text-sm font-semibold capitalize transition-colors ${
                side === s
                  ? s === "buy" ? "text-gain" : "text-loss"
                  : "text-ink-3 hover:text-ink-1"
              }`}
              aria-pressed={side === s}>
              {side === s && (
                <motion.span layoutId="ticket-side-thumb" aria-hidden
                  transition={rm ? { duration: 0 } : { type: "spring", bounce: 0.18, duration: 0.4 }}
                  className={`absolute inset-0 rounded-[9px] border ${
                    s === "buy" ? "border-gain/50 bg-gain/15" : "border-loss/50 bg-loss/15"
                  }`} />
              )}
              <span className="relative">{s}</span>
            </button>
          ))}
        </div>

        {/* Order type — a select scales to the full order book (and options later) */}
        <label className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-hairline bg-bg2 px-4 transition-colors [transition-timing-function:var(--ease-spring)] focus-within:border-gold/50">
          <span className="text-xs text-ink-3">Order type</span>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}
            className="tnum bg-transparent py-2.5 text-right text-sm font-medium text-ink-1 outline-none"
            aria-label="Order type">
            <option value="market">Market</option>
            <option value="limit">Limit</option>
            <option value="stop">Stop</option>
            <option value="stop_limit">Stop-limit</option>
            <option value="trailing_stop">Trailing stop</option>
          </select>
        </label>

        {/* Qty */}
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-hairline bg-bg2 px-4 transition-colors [transition-timing-function:var(--ease-spring)] focus-within:border-gold/50 focus-within:bg-bg2/60">
          <span className="text-xs text-ink-3">Qty</span>
          <input
            value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal"
            className="tnum w-full bg-transparent py-2.5 text-right text-sm text-ink-1 outline-none"
            aria-label="Quantity"
          />
        </label>

        {(type === "stop" || type === "stop_limit") && (
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-hairline bg-bg2 px-4 transition-colors [transition-timing-function:var(--ease-spring)] focus-within:border-gold/50 focus-within:bg-bg2/60">
            <span className="text-xs text-ink-3">Stop</span>
            <input value={stopPrice} onChange={(e) => setStopPrice(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal" placeholder={quote ? quote.price.toFixed(2) : ""}
              className="tnum w-full bg-transparent py-2.5 text-right text-sm text-ink-1 outline-none"
              aria-label="Stop price" />
          </label>
        )}
        {(type === "limit" || type === "stop_limit") && (
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-hairline bg-bg2 px-4 transition-colors [transition-timing-function:var(--ease-spring)] focus-within:border-gold/50 focus-within:bg-bg2/60">
            <span className="text-xs text-ink-3">Limit</span>
            <input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal" placeholder={quote ? quote.price.toFixed(2) : ""}
              className="tnum w-full bg-transparent py-2.5 text-right text-sm text-ink-1 outline-none"
              aria-label="Limit price" />
          </label>
        )}
        {type === "trailing_stop" && (
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-hairline bg-bg2 px-4 transition-colors [transition-timing-function:var(--ease-spring)] focus-within:border-gold/50 focus-within:bg-bg2/60">
            <span className="text-xs text-ink-3">Trail %</span>
            <input value={trailPct} onChange={(e) => setTrailPct(e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal" placeholder="5"
              className="tnum w-full bg-transparent py-2.5 text-right text-sm text-ink-1 outline-none"
              aria-label="Trail percent" />
            <span className="text-xs text-ink-4">%</span>
          </label>
        )}

        {/* Cost + capacity */}
        <div className="rounded-xl bg-bg2 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-ink-3">Est. cost</span>
            <span className="tnum text-sm font-semibold text-ink-1">{estCost > 0 ? usd(estCost) : "—"}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg3">
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
              : side === "sell"
                ? (opensShort ? "Opens a short — margin, not cash." : `Uses ${(capacity * 100).toFixed(0)}% of ${usd(power, 0)} buying power`)
                : `Uses ${(capacity * 100).toFixed(0)}% of ${usd(power, 0)} buying power`}
          </p>
        </div>

        {phase.kind === "done" ? (
          <FillResult order={phase.order} onReset={() => setPhase({ kind: "idle" })} />
        ) : phase.kind === "error" ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-loss/40 bg-loss/10 px-4 py-1">
            <span className="text-xs text-loss">{phase.message}</span>
            <button onClick={() => setPhase({ kind: "idle" })}
              className="pressable min-h-11 shrink-0 px-2 text-xs text-ink-2 underline">Adjust</button>
          </div>
        ) : (
          <HoldButton
            label={`${actionLabel} ${qtyNum || ""} ${symbol}`}
            holdLabel="Keep holding…"
            tone={side === "buy" ? "gold" : "loss"}
            disabled={!valid || phase.kind === "sending" || !quote}
            onCommit={submit}
          />
        )}

        {!isCrypto && marketOpen === false && (
          <p className="text-center text-[11px] text-ink-4">Market closed — orders rest until the bell.</p>
        )}
      </div>
    </section>
  );
}

function FillResult({ order, onReset }: { order: Order; onReset: () => void }) {
  const filled = order.status === "filled";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-1 ${
      filled ? "border-gain/40 bg-gain/10" : "border-gold/40 bg-gold/10"
    }`}>
      <span className={`tnum text-xs ${filled ? "text-gain" : "text-gold"}`}>
        {filled
          ? `Filled ${order.qty} @ ${usd(order.filledPrice ?? 0)}`
          : "Order resting — it'll fill when price agrees"}
      </span>
      <button onClick={onReset} className="pressable min-h-11 shrink-0 px-2 text-xs text-ink-2 underline">New</button>
    </div>
  );
}
