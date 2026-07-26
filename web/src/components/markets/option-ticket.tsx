"use client";

import { useMemo, useState } from "react";
import HoldButton from "@/components/hold-button";
import { useToast } from "@/components/toast";
import { usd, type Order } from "@/components/trading/shared";
import type { OptionRow } from "./option-chain";

/*
  The contract ticket — what opens when a strike is clicked in the chain.

  It is deliberately narrower in scope than the equity ticket: options here are
  LONG ONLY (buy to open, sell to close), whole contracts only, and one
  contract controls 100 shares. That multiplier is the thing beginners get
  wrong, so the arithmetic is printed in full — premium × 100 × contracts — and
  never collapsed into a single number.

  Every price is nullable. A missing quote renders an em dash and disables the
  submit rather than inventing a mark.
*/

const DASH = "—";
const CONTRACT_SIZE = 100;

const px2 = (v: number | null | undefined) => (v == null ? DASH : v.toFixed(2));

function dte(expiry: string): number {
  return Math.max(0, Math.ceil((new Date(`${expiry}T20:00:00Z`).getTime() - Date.now()) / 86_400_000));
}

function longDate(expiry: string): string {
  const [y, m, d] = expiry.split("-").map(Number);
  if (!y || !m || !d) return expiry;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

/** One greek, with the unit it's actually quoted in. */
function Greek({ label, value, unit, estimated }: {
  label: string; value: number | null; unit: string; estimated: boolean;
}) {
  return (
    <div className="border-t border-hairline pt-1.5">
      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4">{label}</dt>
      <dd className={`tnum mt-0.5 text-[13px] ${estimated ? "text-ink-2" : "text-ink-1"}`}>
        {value == null ? DASH : value.toFixed(value === 0 || Math.abs(value) >= 1 ? 3 : 4)}
      </dd>
      <dd className="font-sans text-[9px] leading-tight text-ink-4">{unit}</dd>
    </div>
  );
}

export default function OptionTicket({
  row, spot, held, marketOpen, buyingPower, cash, onPlaced, onDismiss,
}: {
  row: OptionRow;
  spot: number | null;
  /** Contracts of THIS OCC symbol already held — gates sell-to-close. */
  held: number;
  marketOpen: boolean | null;
  buyingPower: number | null;
  cash: number;
  onPlaced: () => void;
  onDismiss: () => void;
}) {
  const toast = useToast();
  // Mounted with key={contract} by the chain, so a new contract is a fresh
  // ticket — no reset effects, no stale limit price from the last strike.
  const [intent, setIntent] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState<"market" | "limit">("market");
  const [qty, setQty] = useState("1");
  const [limitPrice, setLimitPrice] = useState("");
  const [phase, setPhase] = useState<
    { kind: "idle" } | { kind: "sending" } | { kind: "done"; order: Order } | { kind: "error"; message: string }
  >({ kind: "idle" });

  // You can only sell what you hold — writing contracts is rejected by the
  // engine, so the UI never offers it (and a closed-out position falls back to
  // buy without a render loop).
  const canSell = held > 0;
  const side = intent === "sell" && !canSell ? "buy" : intent;
  const setSide = setIntent;

  const contracts = Math.floor(Number(qty) || 0);

  // The side you'd actually trade against: lift the ask to buy, hit the bid to
  // sell. Mid is the fallback when only one side is quoted.
  const marketPremium = side === "buy"
    ? (row.ask ?? row.mid ?? row.last)
    : (row.bid ?? row.mid ?? row.last);
  const limitNum = Number(limitPrice) || 0;
  const premium = type === "limit" ? (limitNum > 0 ? limitNum : null) : marketPremium;

  const estCost = premium != null ? premium * CONTRACT_SIZE * contracts : null;
  const power = buyingPower ?? cash;
  const overPower = side === "buy" && estCost != null && estCost > power + 1e-6;
  const overHeld = side === "sell" && contracts > held;

  const estimatedGreeks = row.iv == null && row.greeks != null;
  const expiresIn = dte(row.expiry);

  const valid = contracts > 0 && premium != null && !overPower && !overHeld
    && (type !== "limit" || limitNum > 0)
    && phase.kind !== "sending";

  const label = useMemo(
    () => `${side === "buy" ? "Buy" : "Sell"} ${contracts || ""} ${contracts === 1 ? "contract" : "contracts"}`.replace(/\s+/g, " "),
    [side, contracts],
  );

  async function submit() {
    if (!valid) return;
    setPhase({ kind: "sending" });
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: row.symbol, side, type, qty: contracts,
          limitPrice: type === "limit" ? limitNum : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        const order = data.order as Order;
        setPhase({ kind: "done", order });
        if (order.status === "filled") {
          toast({
            kind: side === "buy" ? "gain" : "loss",
            title: `${side === "buy" ? "Bought" : "Sold"} ${order.qty} × ${row.underlying} ${row.strike} ${row.type}`,
            body: `Filled @ ${usd(order.filledPrice ?? 0)} per share · ${usd((order.filledPrice ?? 0) * CONTRACT_SIZE * order.qty)} total`,
          });
        } else {
          toast({
            kind: "info",
            title: `${order.qty} × ${row.underlying} ${row.strike} ${row.type} resting`,
            body: "Options fill during market hours — it waits until then.",
          });
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

  const moneyness = spot == null ? null
    : row.type === "call"
      ? (row.strike < spot ? "In the money" : row.strike > spot ? "Out of the money" : "At the money")
      : (row.strike > spot ? "In the money" : row.strike < spot ? "Out of the money" : "At the money");

  return (
    <section className="raised relative overflow-hidden p-4">
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/45 to-transparent" />

      {/* ---- contract identity ---- */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-ink-1">{row.underlying}</span>
            <span className="tnum text-sm font-semibold text-ink-1">{row.strike}</span>
            <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] ${
              row.type === "call" ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
            }`}>
              {row.type}
            </span>
          </p>
          <p className="tnum mt-1 text-[11px] text-ink-3">
            {longDate(row.expiry)} · {expiresIn}d
            {moneyness ? ` · ${moneyness}` : ""}
          </p>
          <p className="tnum mt-0.5 truncate text-[10px] text-ink-4" title={row.symbol}>{row.symbol}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="sim-mark">SIMULATED</span>
          <button onClick={onDismiss}
            className="pressable min-h-11 px-1 text-[11px] text-ink-4 underline hover:text-ink-2">
            Close
          </button>
        </div>
      </div>

      {/* ---- the market ---- */}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-bg2 px-3 py-2.5">
        {([["Bid", row.bid], ["Ask", row.ask], ["Mid", row.mid]] as const).map(([k, v]) => (
          <div key={k}>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-4">{k}</p>
            <p className="tnum text-sm text-ink-1">{px2(v)}</p>
          </div>
        ))}
      </div>

      {/* ---- greeks, with their units spelled out ---- */}
      <dl className="mt-3 grid grid-cols-4 gap-x-2">
        <Greek label="Delta" value={row.greeks?.delta ?? null} unit="per $1" estimated={estimatedGreeks} />
        <Greek label="Gamma" value={row.greeks?.gamma ?? null} unit="per $1" estimated={estimatedGreeks} />
        <Greek label="Theta" value={row.greeks?.theta ?? null} unit="per day" estimated={estimatedGreeks} />
        <Greek label="Vega" value={row.greeks?.vega ?? null} unit="per 1% IV" estimated={estimatedGreeks} />
      </dl>
      <p className="tnum mt-2 text-[10px] text-ink-4">
        IV {row.iv != null ? `${(row.iv * 100).toFixed(1)}%` : "unsolved"}
        {estimatedGreeks
          ? " — the quoted mid sits below intrinsic, so these greeks are estimated at the chain's median volatility."
          : row.greeks == null ? " — no greeks for this contract." : ""}
      </p>

      {/* ---- intent ---- */}
      <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-hairline bg-bg2 p-1">
        {([["buy", "Buy to open"], ["sell", "Sell to close"]] as const).map(([s, text]) => (
          <button key={s} onClick={() => setSide(s)} disabled={s === "sell" && !canSell}
            title={s === "sell" && !canSell ? "You don't hold this contract. Writing options isn't supported here." : undefined}
            className={`pressable min-h-11 rounded-[9px] text-xs font-semibold transition-colors ${
              side === s
                ? s === "buy" ? "border border-gain/50 bg-gain/15 text-gain" : "border border-loss/50 bg-loss/15 text-loss"
                : s === "sell" && !canSell ? "cursor-not-allowed text-ink-4" : "text-ink-3 hover:text-ink-1"
            }`}
            aria-pressed={side === s}>
            {text}
          </button>
        ))}
      </div>

      {/* ---- quantity in contracts ---- */}
      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-hairline bg-bg2 px-2">
        <span className="pl-1 text-xs text-ink-3">Contracts</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setQty(String(Math.max(1, contracts - 1)))}
            className="pressable h-11 w-9 rounded-lg text-sm text-ink-3 hover:text-ink-1" aria-label="One fewer contract">−</button>
          <input value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
            inputMode="numeric"
            className="tnum w-14 bg-transparent py-2.5 text-center text-sm text-ink-1 outline-none"
            aria-label="Contracts" />
          <button onClick={() => setQty(String(contracts + 1))}
            className="pressable h-11 w-9 rounded-lg text-sm text-ink-3 hover:text-ink-1" aria-label="One more contract">+</button>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-ink-4">
        Whole contracts only. One contract controls {CONTRACT_SIZE} shares.
        {held > 0 ? ` You hold ${held}.` : ""}
      </p>

      {/* ---- order type ---- */}
      <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl border border-hairline bg-bg2 p-1">
        {(["market", "limit"] as const).map((t) => (
          <button key={t} onClick={() => {
            setType(t);
            if (t === "limit" && !limitPrice && row.mid != null) setLimitPrice(row.mid.toFixed(2));
          }}
            className={`pressable min-h-11 rounded-[9px] text-xs font-medium capitalize transition-colors ${
              type === t ? "bg-bg3 text-ink-1" : "text-ink-3 hover:text-ink-1"
            }`}
            aria-pressed={type === t}>
            {t}
          </button>
        ))}
      </div>

      {type === "limit" && (
        <label className="mt-2.5 flex min-h-11 items-center gap-2 rounded-xl border border-hairline bg-bg2 px-4 focus-within:border-gold/50">
          <span className="text-xs text-ink-3">Limit</span>
          <input value={limitPrice} onChange={(e) => setLimitPrice(e.target.value.replace(/[^\d.]/g, ""))}
            inputMode="decimal" placeholder={row.mid != null ? row.mid.toFixed(2) : ""}
            className="tnum w-full bg-transparent py-2.5 text-right text-sm text-ink-1 outline-none"
            aria-label="Limit price per share" />
          <span className="text-[10px] text-ink-4">/ share</span>
        </label>
      )}

      {/* ---- the multiplier, spelled out ---- */}
      <div className="mt-2.5 rounded-xl bg-bg2 px-4 py-3">
        <p className="tnum text-[11px] text-ink-3">
          {premium == null ? "No quote for this contract right now." : (
            <>
              {px2(premium)} <span className="text-ink-4">×</span> {CONTRACT_SIZE}{" "}
              <span className="text-ink-4">×</span> {contracts || 0}{" "}
              <span className="text-ink-4">=</span>{" "}
              <span className="text-sm font-semibold text-ink-1">{estCost != null ? usd(estCost) : DASH}</span>
            </>
          )}
        </p>
        <p className="mt-1 text-[10px] text-ink-4">
          {premium == null
            ? "Nothing will be sent until this contract has a market."
            : side === "buy"
              ? `Premium per share × ${CONTRACT_SIZE} shares per contract × contracts. Paid from your ${usd(power, 0)} buying power.`
              : `Premium per share × ${CONTRACT_SIZE} shares per contract × contracts. Credited when it fills.`}
        </p>
        {overPower && (
          <p className="mt-1.5 text-[11px] text-loss">That exceeds your buying power — reduce the contract count.</p>
        )}
        {overHeld && (
          <p className="mt-1.5 text-[11px] text-loss">You hold {held} — selling more would write contracts, which isn&apos;t allowed here.</p>
        )}
      </div>

      {/* ---- commit / result ---- */}
      <div className="mt-2.5">
        {phase.kind === "done" ? (
          <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-1 ${
            phase.order.status === "filled" ? "border-gain/40 bg-gain/10" : "border-gold/40 bg-gold/10"
          }`}>
            <span className={`tnum text-xs ${phase.order.status === "filled" ? "text-gain" : "text-gold"}`}>
              {phase.order.status === "filled"
                ? `Filled ${phase.order.qty} @ ${usd(phase.order.filledPrice ?? 0)} · ${usd((phase.order.filledPrice ?? 0) * CONTRACT_SIZE * phase.order.qty)}`
                : "Resting — options fill during market hours"}
            </span>
            <button onClick={() => setPhase({ kind: "idle" })}
              className="pressable min-h-11 shrink-0 px-2 text-xs text-ink-2 underline">New</button>
          </div>
        ) : phase.kind === "error" ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-loss/40 bg-loss/10 px-4 py-1">
            <span className="text-xs text-loss">{phase.message}</span>
            <button onClick={() => setPhase({ kind: "idle" })}
              className="pressable min-h-11 shrink-0 px-2 text-xs text-ink-2 underline">Adjust</button>
          </div>
        ) : (
          <HoldButton
            label={label}
            holdLabel="Keep holding…"
            tone={side === "buy" ? "gold" : "loss"}
            disabled={!valid}
            onCommit={submit}
          />
        )}
      </div>

      {marketOpen === false && (
        <p className="mt-2 text-center text-[11px] text-ink-4">
          Options trade during US market hours — an order placed now rests until the bell.
        </p>
      )}
    </section>
  );
}
