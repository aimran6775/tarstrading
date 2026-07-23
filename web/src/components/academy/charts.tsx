"use client";

import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/*
  Teaching charts — small, deterministic SVGs that make one idea click, drawn in
  theme tokens (gain/loss/gold/ink) so they reverse on light/dark. Every chart
  is now driveable — a toggle or slider the learner controls — and every
  animation is silenced when the viewer prefers reduced motion.
*/

type Variant = "candle-anatomy" | "sma-cross" | "support-resistance" | "trend" | "spread";

export default function LessonChart({ variant, caption }: { variant: Variant; caption?: string }) {
  return (
    <figure className="card overflow-hidden p-4">
      {variant === "candle-anatomy" && <CandleAnatomy />}
      {variant === "sma-cross" && <SmaCross />}
      {variant === "support-resistance" && <SupportResistance />}
      {variant === "trend" && <TrendStructure />}
      {variant === "spread" && <Spread />}
      {caption && <figcaption className="mt-3 text-xs leading-relaxed text-ink-4">{caption}</figcaption>}
    </figure>
  );
}

/* ---------- 1 · Anatomy of a candlestick ---------- */
function CandleAnatomy() {
  const [bull, setBull] = useState(true);
  const rm = useReducedMotion();
  const open = bull ? 62 : 30;
  const close = bull ? 30 : 62;
  const bodyTop = Math.min(open, close);
  const bodyH = Math.abs(open - close);
  const tone = bull ? "var(--gain)" : "var(--loss)";
  const parts: [string, number][] = [
    ["High", 12], ["Low", 92],
    [bull ? "Close" : "Open", 30], [bull ? "Open" : "Close", 62],
  ];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Anatomy of a candle</p>
        <div className="flex rounded-full border border-hairline bg-bg2 p-0.5 text-[11px]">
          {([["Up day", true], ["Down day", false]] as const).map(([label, v]) => (
            <button key={label} onClick={() => setBull(v)}
              className={`rounded-full px-3 py-1 font-medium ${bull === v ? "bg-bg3 text-ink-1" : "text-ink-4"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 260 110" className="h-44 w-full" role="img"
        aria-label={`A single ${bull ? "up" : "down"} candle: body from open to close, wicks marking the high and low`}>
        <motion.line x1="130" x2="130" y1="12" y2="92" stroke={tone} strokeWidth="2"
          initial={rm ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: rm ? 0 : 0.6 }} />
        <motion.rect x="112" width="36" rx="3" fill={tone}
          initial={rm ? false : { y: 46, height: 0 }} animate={{ y: bodyTop, height: bodyH }} transition={{ duration: rm ? 0 : 0.5, delay: rm ? 0 : 0.3 }} />
        {parts.map(([label, y], i) => (
          <motion.g key={label + i} initial={rm ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: rm ? 0 : 0.7 + i * 0.12 }}>
            <line x1="148" x2="196" y1={y} y2={y} stroke="var(--hairline-strong)" strokeWidth="1" strokeDasharray="2 2" />
            <text x="200" y={y + 3} fontSize="9" fill="var(--ink-3)" className="tnum">{label}</text>
          </motion.g>
        ))}
        <text x="60" y="40" fontSize="9" fill="var(--ink-4)" textAnchor="end">the body =</text>
        <text x="60" y="52" fontSize="9" fill="var(--ink-4)" textAnchor="end">open→close</text>
        <text x="60" y="86" fontSize="9" fill="var(--ink-4)" textAnchor="end">wicks = the</text>
        <text x="60" y="98" fontSize="9" fill="var(--ink-4)" textAnchor="end">extremes</text>
      </svg>
      <p className="mt-1 text-center text-xs text-ink-4">
        {bull ? "Green: price closed higher than it opened." : "Red: price closed lower than it opened."} Same four numbers, every candle.
      </p>
    </div>
  );
}

/* ---------- 2 · Moving-average crossover (driveable periods) ---------- */
const PRICE = [40, 44, 42, 48, 52, 50, 55, 53, 58, 62, 60, 66, 70, 68, 74, 78, 76, 82, 80, 85];
function sma(arr: number[], p: number, i: number) {
  if (i < p - 1) return null;
  let s = 0; for (let k = i - p + 1; k <= i; k++) s += arr[k];
  return s / p;
}
function SmaCross() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const rm = useReducedMotion();
  const [fastP, setFastP] = useState(3);
  const [slowP, setSlowP] = useState(6);
  const fp = Math.min(fastP, slowP - 1); // fast must stay shorter than slow

  const W = 260, H = 120, n = PRICE.length;
  const min = 34, max = 90;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const line = (fn: (i: number) => number | null) =>
    PRICE.map((_, i) => { const v = fn(i); return v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`; })
      .filter(Boolean).join(" ");
  const price = line((i) => PRICE[i]);
  const fast = line((i) => sma(PRICE, fp, i));
  const slow = line((i) => sma(PRICE, slowP, i));
  let cross = -1;
  for (let i = slowP; i < n; i++) {
    const f0 = sma(PRICE, fp, i - 1), s0 = sma(PRICE, slowP, i - 1), f1 = sma(PRICE, fp, i), s1 = sma(PRICE, slowP, i);
    if (f0 != null && s0 != null && f1 != null && s1 != null && f0 <= s0 && f1 > s1) { cross = i; break; }
  }
  const anim = inView || rm;
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">The crossover signal</p>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img"
        aria-label={`Price with a ${fp}-period fast average and a ${slowP}-period slow average`}>
        <polyline points={price} fill="none" stroke="var(--ink-4)" strokeWidth="1.2" opacity="0.5" />
        <motion.polyline points={slow} fill="none" stroke="var(--gold)" strokeWidth="2"
          initial={rm ? false : { pathLength: 0 }} animate={anim ? { pathLength: 1 } : {}} transition={{ duration: rm ? 0 : 1.1 }} />
        <motion.polyline points={fast} fill="none" stroke="var(--gain)" strokeWidth="2"
          initial={rm ? false : { pathLength: 0 }} animate={anim ? { pathLength: 1 } : {}} transition={{ duration: rm ? 0 : 1.1, delay: rm ? 0 : 0.2 }} />
        {cross >= 0 && (
          <g>
            <circle cx={x(cross)} cy={y(sma(PRICE, fp, cross)!)} r="5" fill="none" stroke="var(--gain)" strokeWidth="2" />
            <text x={x(cross)} y={y(sma(PRICE, fp, cross)!) - 10} fontSize="9" fill="var(--gain)" textAnchor="middle">cross ↑</text>
          </g>
        )}
      </svg>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-4">
        <label className="flex-1">
          <span className="flex justify-between text-[11px] text-ink-4"><span className="text-gain">Fast average</span><span className="tnum">{fp}</span></span>
          <input type="range" min={2} max={8} value={fastP} onChange={(e) => setFastP(Number(e.target.value))}
            aria-label="Fast average period" className="mt-1 w-full accent-gain" />
        </label>
        <label className="flex-1">
          <span className="flex justify-between text-[11px] text-ink-4"><span className="text-gold">Slow average</span><span className="tnum">{slowP}</span></span>
          <input type="range" min={5} max={14} value={slowP} onChange={(e) => setSlowP(Number(e.target.value))}
            aria-label="Slow average period" className="mt-1 w-full accent-gold" />
        </label>
      </div>
      <p className="mt-2 text-center text-xs text-ink-4">
        {cross >= 0
          ? "The fast line crosses above the slow line — momentum turned up. Shorten the fast average and the cross fires earlier, but so do false alarms."
          : "No crossover in this window — the fast average never overtook the slow one. Widen the gap and watch the signal appear or vanish."}
      </p>
    </div>
  );
}

/* ---------- 3 · Support & resistance (holds vs. breaks) ---------- */
const SR_HOLD = [50, 44, 62, 46, 64, 45, 63, 47, 66, 52, 60, 48, 65];
const SR_BREAK = [50, 44, 62, 46, 64, 45, 63, 58, 66, 68, 72, 70, 78];
function SupportResistance() {
  const [mode, setMode] = useState<"holds" | "breaks">("holds");
  const rm = useReducedMotion();
  const data = mode === "holds" ? SR_HOLD : SR_BREAK;
  const W = 260, H = 120, n = data.length;
  const min = 40, max = 82;
  const x = (i: number) => 8 + (i / (n - 1)) * (W - 16);
  const y = (v: number) => H - 10 - ((v - min) / (max - min)) * (H - 20);
  const path = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Support &amp; resistance</p>
        <div className="flex rounded-full border border-hairline bg-bg2 p-0.5 text-[11px]">
          {([["Holds", "holds"], ["Breakout", "breaks"]] as const).map(([label, v]) => (
            <button key={v} onClick={() => setMode(v)}
              className={`rounded-full px-3 py-1 font-medium ${mode === v ? "bg-bg3 text-ink-1" : "text-ink-4"}`}>{label}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full" role="img"
        aria-label={`Price ${mode === "holds" ? "bouncing between support and resistance" : "breaking through resistance"}`}>
        <line x1="8" x2={W - 8} y1={y(64)} y2={y(64)} stroke="var(--loss)" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="8" x2={W - 8} y1={y(45)} y2={y(45)} stroke="var(--gain)" strokeWidth="1.5" strokeDasharray="4 3" />
        <motion.polyline key={mode} points={path} fill="none" stroke="var(--ink-2)" strokeWidth="1.6"
          initial={rm ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: rm ? 0 : 1.2 }} />
        <text x={W - 8} y={y(64) - 4} fontSize="9" fill="var(--loss)" textAnchor="end">resistance — sellers wake up</text>
        <text x={W - 8} y={y(45) + 12} fontSize="9" fill="var(--gain)" textAnchor="end">support — buyers step in</text>
      </svg>
      <p className="mt-1 text-center text-xs text-ink-4">
        {mode === "holds"
          ? "Prices remember. Levels that stopped price before tend to hold — buyers defend support, sellers guard resistance."
          : "Until they don't. When price punches through resistance with conviction, old resistance often becomes new support."}
      </p>
    </div>
  );
}

/* ---------- 4 · Trend structure ---------- */
function TrendStructure() {
  const [kind, setKind] = useState<"up" | "down" | "range">("up");
  const rm = useReducedMotion();
  const series: Record<typeof kind, number[]> = {
    up: [30, 42, 36, 52, 46, 64, 58, 76],
    down: [76, 60, 66, 48, 54, 36, 42, 26],
    range: [40, 60, 42, 58, 44, 60, 43, 59],
  };
  const data = series[kind];
  const W = 260, H = 100, n = data.length;
  const x = (i: number) => 8 + (i / (n - 1)) * (W - 16);
  const y = (v: number) => H - 8 - ((v - 20) / 60) * (H - 16);
  const path = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const tone = kind === "up" ? "var(--gain)" : kind === "down" ? "var(--loss)" : "var(--gold)";
  const label = kind === "up" ? "Uptrend: higher highs and higher lows."
    : kind === "down" ? "Downtrend: lower highs and lower lows."
    : "Range: bouncing between the same two levels.";
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Three market states</p>
        <div className="flex rounded-full border border-hairline bg-bg2 p-0.5 text-[11px]">
          {(["up", "down", "range"] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)}
              className={`rounded-full px-2.5 py-1 font-medium capitalize ${kind === k ? "bg-bg3 text-ink-1" : "text-ink-4"}`}>
              {k}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label={label}>
        <motion.polyline key={kind} points={path} fill="none" stroke={tone} strokeWidth="2"
          initial={rm ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: rm ? 0 : 0.9 }} />
      </svg>
      <p className="mt-1 text-center text-xs text-ink-4">{label}</p>
    </div>
  );
}

/* ---------- 5 · The bid/ask spread (liquid vs. thin) ---------- */
function Spread() {
  const [liquid, setLiquid] = useState(true);
  const book = liquid
    ? { bids: [[100, "24.99"], [60, "24.98"], [140, "24.97"]], asks: [[80, "25.00"], [120, "25.01"], [50, "25.02"]], hi: "24.99", lo: "25.00", gap: "1¢" }
    : { bids: [[30, "24.90"], [15, "24.86"], [40, "24.80"]], asks: [[25, "25.05"], [20, "25.11"], [12, "25.18"]], hi: "24.90", lo: "25.05", gap: "15¢" };
  const maxSz = liquid ? 140 : 40;
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">The order book</p>
        <div className="flex rounded-full border border-hairline bg-bg2 p-0.5 text-[11px]">
          {([["Liquid", true], ["Thin", false]] as const).map(([label, v]) => (
            <button key={label} onClick={() => setLiquid(v)}
              className={`rounded-full px-3 py-1 font-medium ${liquid === v ? "bg-bg3 text-ink-1" : "text-ink-4"}`}>{label}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-gain">Bids · buyers</p>
          {book.bids.map(([sz, px]) => (
            <div key={px} className="relative mb-1 flex items-center justify-between rounded px-2 py-1">
              <div className="absolute inset-0 rounded bg-gain/12" style={{ width: `${(Number(sz) / maxSz) * 100}%` }} />
              <span className="relative tnum text-ink-2">{sz}</span>
              <span className="relative tnum text-gain">{px}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1 text-right text-[10px] uppercase tracking-wider text-loss">Asks · sellers</p>
          {book.asks.map(([sz, px]) => (
            <div key={px} className="relative mb-1 flex items-center justify-between rounded px-2 py-1">
              <div className="absolute inset-0 right-0 ml-auto rounded bg-loss/12" style={{ width: `${(Number(sz) / maxSz) * 100}%` }} />
              <span className="relative tnum text-loss">{px}</span>
              <span className="relative tnum text-ink-2">{sz}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-ink-4">
        Highest bid <span className="text-gain">{book.hi}</span> · lowest ask <span className="text-loss">{book.lo}</span> — the{" "}
        <span className="text-ink-2">{book.gap} gap is the spread</span>.{" "}
        {liquid ? "Deep and tight — cheap to trade." : "Thin and wide — every trade pays that gap. Illiquidity is a hidden tax."}
      </p>
    </div>
  );
}
