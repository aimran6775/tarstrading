"use client";

import { useState } from "react";
import { motion } from "framer-motion";

/*
  Two teaching widgets for the Trading-with-AI stage.

  RuleBuilder — a read-only "what the assistant compiles" panel: pick an
  indicator/comparator and see the plain-English rule + the JSON the engine
  actually runs. Demystifies the pipeline from "what you say" to "what runs."

  OverfitDemo — drag the number of knobs a strategy is allowed to tune and
  watch in-sample results soar while out-of-sample collapses. The single most
  important lesson about trusting a backtest, made visceral.
*/

export function RuleBuilder() {
  const [ind, setInd] = useState<"sma" | "rsi" | "price">("sma");
  const [cmp, setCmp] = useState<"crossesAbove" | "greaterThan" | "lessThan">("crossesAbove");
  const lhs = ind === "sma" ? { kind: "sma", period: 10 } : ind === "rsi" ? { kind: "rsi", period: 14 } : { kind: "price" };
  const rhs = ind === "sma" ? { kind: "sma", period: 30 } : ind === "rsi" ? { kind: "constant", value: 70 } : { kind: "constant", value: 100 };
  const english = ind === "sma"
    ? `Buy when the 10-day average crosses above the 30-day average`
    : ind === "rsi"
      ? `Sell when RSI(14) ${cmp === "lessThan" ? "drops below" : "rises above"} 70`
      : `Act when price ${cmp === "greaterThan" ? "is above" : cmp === "lessThan" ? "is below" : "crosses"} 100`;
  const json = JSON.stringify({ lhs, comparator: cmp, rhs }, null, 0);
  return (
    <div className="card p-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-agent">What your words compile to</p>
      <div className="flex flex-wrap gap-2">
        <Pills value={ind} set={setInd} opts={[["sma", "Moving avg"], ["rsi", "RSI"], ["price", "Price"]]} />
        <Pills value={cmp} set={setCmp} opts={[["crossesAbove", "crosses above"], ["greaterThan", "is above"], ["lessThan", "is below"]]} />
      </div>
      <div className="mt-4 rounded-lg border border-hairline bg-bg2 p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">You say</p>
        <p className="mt-1 text-sm text-ink-1">&ldquo;{english}.&rdquo;</p>
      </div>
      <div className="mt-2 rounded-lg border border-hairline bg-bg2 p-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">The engine runs</p>
        <p className="tnum mt-1 overflow-x-auto whitespace-pre text-[11px] text-gain">{json}</p>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink-4">
        Nothing hidden. Your plain English becomes a transparent rule the engine can check on every bar — and you can read exactly what it&apos;s doing.
      </p>
    </div>
  );
}

function Pills<T extends string>({ value, set, opts }: {
  value: T; set: (v: T) => void; opts: [T, string][];
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-hairline bg-bg2 p-0.5">
      {opts.map(([v, label]) => (
        <button key={v} onClick={() => set(v)}
          className={`rounded-full px-3 py-1 text-[11px] font-medium ${value === v ? "bg-bg3 text-ink-1" : "text-ink-4"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function OverfitDemo() {
  const [knobs, setKnobs] = useState(2);
  // As "knobs" (free parameters) rise, in-sample fit improves toward perfect,
  // but out-of-sample degrades — the curve of overfitting.
  const inSample = Math.min(0.5 + knobs * 0.06, 0.99);
  const outSample = Math.max(0.55 - Math.pow(Math.max(0, knobs - 3), 1.6) * 0.05, 0.05);
  const overfit = knobs > 4;
  const W = 260, H = 90;
  const pts = (fn: (k: number) => number) =>
    Array.from({ length: 11 }, (_, k) => `${(k / 10 * W).toFixed(0)},${(H - fn(k) * H).toFixed(1)}`).join(" ");
  const inLine = pts((k) => Math.min(0.5 + k * 0.045, 0.99));
  const outLine = pts((k) => Math.max(0.55 - Math.pow(Math.max(0, k - 3), 1.6) * 0.04, 0.05));
  return (
    <div className="card p-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.25em] text-agent">The overfitting trap</p>
      <label className="block">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-ink-3">Parameters the strategy can tune</span>
          <span className="tnum text-sm font-semibold text-ink-1">{knobs}</span>
        </div>
        <input type="range" min={1} max={10} value={knobs} onChange={(e) => setKnobs(Number(e.target.value))}
          className="mt-1.5 w-full accent-[var(--agent)]" />
      </label>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 h-24 w-full">
        <polyline points={inLine} fill="none" stroke="var(--gain)" strokeWidth="2" opacity="0.35" />
        <polyline points={outLine} fill="none" stroke="var(--loss)" strokeWidth="2" opacity="0.35" />
        <motion.line x1={knobs / 10 * W} x2={knobs / 10 * W} y1="0" y2={H} stroke="var(--ink-4)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>

      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-bg2 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-ink-4">In-sample (past)</p>
          <p className="tnum text-lg font-semibold text-gain">{(inSample * 100).toFixed(0)}%</p>
        </div>
        <div className="rounded-lg bg-bg2 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-ink-4">Out-of-sample (new)</p>
          <p className={`tnum text-lg font-semibold ${outSample > 0.4 ? "text-gain" : "text-loss"}`}>{(outSample * 100).toFixed(0)}%</p>
        </div>
      </div>
      <p className={`mt-3 text-xs leading-relaxed ${overfit ? "text-loss" : "text-ink-4"}`}>
        {overfit
          ? "Overfit. The strategy has memorized the past — it looks brilliant on old data and falls apart on data it's never seen. A great backtest that fails live."
          : "Add knobs and the in-sample result climbs toward perfect. But watch the out-of-sample number — the only one that predicts the future — start to crumble."}
      </p>
    </div>
  );
}
