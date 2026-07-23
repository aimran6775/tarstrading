"use client";

import { useState } from "react";

/*
  The options payoff diagram — the one visual that makes options click. Pick
  call/put and long/short, drag the strike and premium, and watch the P&L
  curve, break-even, and max gain/loss respond. This is what a paragraph about
  "limited risk, unlimited upside" can never convey.
*/

type Kind = "call" | "put";
type Side = "long" | "short";

export default function PayoffDiagram() {
  const [kind, setKind] = useState<Kind>("call");
  const [side, setSide] = useState<Side>("long");
  const [strike, setStrike] = useState(100);
  const [premium, setPremium] = useState(5);

  // P&L at expiry for one contract's underlying, per share.
  function pnl(S: number): number {
    const intrinsic = kind === "call" ? Math.max(0, S - strike) : Math.max(0, strike - S);
    const long = intrinsic - premium;
    return side === "long" ? long : -long;
  }

  const lo = 60, hi = 140, W = 280, H = 150;
  const samples = Array.from({ length: 81 }, (_, i) => lo + i);
  const vals = samples.map(pnl);
  const maxAbs = Math.max(10, ...vals.map((v) => Math.abs(v)));
  const x = (S: number) => ((S - lo) / (hi - lo)) * W;
  const y = (v: number) => H / 2 - (v / maxAbs) * (H / 2 - 8);
  const path = samples.map((S) => `${x(S).toFixed(1)},${y(pnl(S)).toFixed(1)}`).join(" ");

  const breakeven = kind === "call" ? strike + premium : strike - premium;
  const maxGain = side === "long"
    ? (kind === "call" ? "Unlimited" : `$${((strike - premium)).toFixed(0)}`)
    : `$${premium.toFixed(0)}`;
  const maxLoss = side === "long"
    ? `$${premium.toFixed(0)}`
    : (kind === "call" ? "Unlimited" : `$${((strike - premium)).toFixed(0)}`);

  return (
    <div className="card p-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-agent">Payoff at expiry</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <Toggle value={kind} set={setKind} opts={[["call", "Call"], ["put", "Put"]]} />
        <Toggle value={side} set={setSide} opts={[["long", "Buy (long)"], ["short", "Sell (short)"]]} />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full">
        {/* zero P&L line */}
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--hairline-strong)" strokeWidth="1" />
        {/* strike marker */}
        <line x1={x(strike)} x2={x(strike)} y1="0" y2={H} stroke="var(--ink-4)" strokeWidth="1" strokeDasharray="3 3" />
        <text x={x(strike)} y={H - 2} fontSize="8" fill="var(--ink-4)" textAnchor="middle">strike {strike}</text>
        {/* break-even marker */}
        {breakeven >= lo && breakeven <= hi && (
          <line x1={x(breakeven)} x2={x(breakeven)} y1="0" y2={H} stroke="var(--gold)" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
        )}
        {/* the payoff line, split into loss (red) and profit (green) is hard;
            draw one line colored by the side's dominant tone */}
        <polyline points={path} fill="none" stroke="var(--ink-1)" strokeWidth="2" />
        {/* endpoints hint direction */}
        <circle cx={x(hi)} cy={y(pnl(hi))} r="2.5" fill={pnl(hi) >= 0 ? "var(--gain)" : "var(--loss)"} />
        <circle cx={x(lo)} cy={y(pnl(lo))} r="2.5" fill={pnl(lo) >= 0 ? "var(--gain)" : "var(--loss)"} />
      </svg>
      <div className="mt-1 flex justify-between px-1 text-[9px] text-ink-4">
        <span>underlying ${lo}</span><span>profit ↑ / loss ↓</span><span>${hi}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Slider label="Strike" value={strike} set={setStrike} min={80} max={120} fmt={(v) => `$${v}`} />
        <Slider label="Premium" value={premium} set={setPremium} min={1} max={15} fmt={(v) => `$${v}`} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Break-even" value={`$${breakeven.toFixed(0)}`} tone="gold" />
        <Stat label="Max gain" value={maxGain} tone="gain" />
        <Stat label="Max loss" value={maxLoss} tone="loss" />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        {side === "long" && kind === "call" && "Buying a call: you risk only the premium, but your upside grows as the stock climbs past the break-even. Limited risk, big upside."}
        {side === "long" && kind === "put" && "Buying a put: it pays off as the stock falls — portfolio insurance. Your loss is capped at the premium you paid."}
        {side === "short" && kind === "call" && "Selling a call: you collect the premium up front, but your loss is unlimited if the stock soars. The premium is the most you can make."}
        {side === "short" && kind === "put" && "Selling a put: you pocket the premium and hope the stock stays up. You're on the hook to buy if it falls below the strike."}
      </p>
    </div>
  );
}

function Toggle<T extends string>({ value, set, opts }: { value: T; set: (v: T) => void; opts: [T, string][] }) {
  return (
    <div className="flex rounded-full border border-hairline bg-bg2 p-0.5 text-[11px]">
      {opts.map(([v, label]) => (
        <button key={v} onClick={() => set(v)}
          className={`rounded-full px-3 py-1 font-medium ${value === v ? "bg-bg3 text-ink-1" : "text-ink-4"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Slider({ label, value, set, min, max, fmt }: {
  label: string; value: number; set: (n: number) => void; min: number; max: number; fmt: (n: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-3">{label}</span>
        <span className="tnum text-sm font-semibold text-ink-1">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))}
        className="mt-1.5 w-full accent-[var(--agent)]" />
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "gain" | "loss" | "gold" }) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-gold";
  return (
    <div className="rounded-lg bg-bg2 py-2">
      <p className="text-[10px] uppercase tracking-[0.15em] text-ink-4">{label}</p>
      <p className={`tnum text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}
