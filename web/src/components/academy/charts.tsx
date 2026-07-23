"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/*
  Teaching charts — small, deterministic, animated SVGs that make one idea
  click. Everything is drawn in theme tokens (gain/loss/gold/ink) so it
  reverses on light/dark, and each animates in when scrolled into view.
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
  // A single candle, big and labeled. Green = close above open, red = below.
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
      <svg viewBox="0 0 260 110" className="h-44 w-full">
        {/* wick */}
        <motion.line x1="130" x2="130" y1="12" y2="92" stroke={tone} strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6 }} />
        {/* body */}
        <motion.rect x="112" width="36" rx="3" fill={tone}
          initial={{ y: 46, height: 0 }} animate={{ y: bodyTop, height: bodyH }} transition={{ duration: 0.5, delay: 0.3 }} />
        {/* labels */}
        {parts.map(([label, y], i) => (
          <motion.g key={label + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 + i * 0.12 }}>
            <line x1="148" x2="196" y1={y} y2={y} stroke="var(--hairline-strong)" strokeWidth="1" strokeDasharray="2 2" />
            <text x="200" y={y + 3} fontSize="9" fill="var(--ink-3)" className="tnum">{label}</text>
          </motion.g>
        ))}
        <motion.text x="60" y="40" fontSize="9" fill="var(--ink-4)" textAnchor="end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>the body =</motion.text>
        <motion.text x="60" y="52" fontSize="9" fill="var(--ink-4)" textAnchor="end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>open→close</motion.text>
        <motion.text x="60" y="86" fontSize="9" fill="var(--ink-4)" textAnchor="end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>wicks = the</motion.text>
        <motion.text x="60" y="98" fontSize="9" fill="var(--ink-4)" textAnchor="end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>extremes</motion.text>
      </svg>
      <p className="mt-1 text-center text-xs text-ink-4">
        {bull ? "Green: price closed higher than it opened." : "Red: price closed lower than it opened."} Same four numbers, every candle.
      </p>
    </div>
  );
}

/* ---------- 2 · Moving-average crossover ---------- */
const PRICE = [40, 44, 42, 48, 52, 50, 55, 53, 58, 62, 60, 66, 70, 68, 74, 78, 76, 82, 80, 85];
function sma(arr: number[], p: number, i: number) {
  if (i < p - 1) return null;
  let s = 0; for (let k = i - p + 1; k <= i; k++) s += arr[k];
  return s / p;
}
function SmaCross() {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const W = 260, H = 120, n = PRICE.length;
  const min = 34, max = 90;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - ((v - min) / (max - min)) * H;
  const line = (fn: (i: number) => number | null) =>
    PRICE.map((_, i) => { const v = fn(i); return v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`; })
      .filter(Boolean).join(" ");
  const price = line((i) => PRICE[i]);
  const fast = line((i) => sma(PRICE, 3, i));
  const slow = line((i) => sma(PRICE, 6, i));
  // Find the fast-crosses-above-slow point.
  let cross = -1;
  for (let i = 6; i < n; i++) {
    const f0 = sma(PRICE, 3, i - 1), s0 = sma(PRICE, 6, i - 1), f1 = sma(PRICE, 3, i), s1 = sma(PRICE, 6, i);
    if (f0 != null && s0 != null && f1 != null && s1 != null && f0 <= s0 && f1 > s1) { cross = i; break; }
  }
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">The crossover signal</p>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-40 w-full">
        <polyline points={price} fill="none" stroke="var(--ink-4)" strokeWidth="1.2" opacity="0.5" />
        <motion.polyline points={slow} fill="none" stroke="var(--gold)" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : {}} transition={{ duration: 1.1 }} />
        <motion.polyline points={fast} fill="none" stroke="var(--gain)" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : {}} transition={{ duration: 1.1, delay: 0.2 }} />
        {cross >= 0 && (
          <motion.g initial={{ opacity: 0, scale: 0 }} animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 1.4, type: "spring" }} style={{ transformOrigin: `${x(cross)}px ${y(PRICE[cross])}px` }}>
            <circle cx={x(cross)} cy={y(sma(PRICE, 3, cross)!)} r="5" fill="none" stroke="var(--gain)" strokeWidth="2" />
            <text x={x(cross)} y={y(sma(PRICE, 3, cross)!) - 10} fontSize="9" fill="var(--gain)" textAnchor="middle">cross ↑</text>
          </motion.g>
        )}
      </svg>
      <div className="mt-2 flex justify-center gap-4 text-[11px]">
        <span className="text-gain">■ fast (short) average</span>
        <span className="text-gold">■ slow (long) average</span>
      </div>
      <p className="mt-1 text-center text-xs text-ink-4">When the fast line crosses above the slow line, momentum has turned up. It&apos;s a signal — not a promise.</p>
    </div>
  );
}

/* ---------- 3 · Support & resistance ---------- */
const SR = [50, 44, 62, 46, 64, 45, 63, 47, 66, 52, 60, 48, 65];
function SupportResistance() {
  const W = 260, H = 120, n = SR.length;
  const min = 40, max = 70;
  const x = (i: number) => 8 + (i / (n - 1)) * (W - 16);
  const y = (v: number) => H - 10 - ((v - min) / (max - min)) * (H - 20);
  const path = SR.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">Support & resistance</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-40 w-full">
        {/* resistance ~64, support ~45 */}
        <motion.line x1="8" x2={W - 8} y1={y(64)} y2={y(64)} stroke="var(--loss)" strokeWidth="1.5" strokeDasharray="4 3"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
        <motion.line x1="8" x2={W - 8} y1={y(45)} y2={y(45)} stroke="var(--gain)" strokeWidth="1.5" strokeDasharray="4 3"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.2 }} />
        <motion.polyline points={path} fill="none" stroke="var(--ink-2)" strokeWidth="1.6"
          initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.4 }} />
        <text x={W - 8} y={y(64) - 4} fontSize="9" fill="var(--loss)" textAnchor="end">resistance — sellers wake up</text>
        <text x={W - 8} y={y(45) + 12} fontSize="9" fill="var(--gain)" textAnchor="end">support — buyers step in</text>
      </svg>
      <p className="mt-1 text-center text-xs text-ink-4">Prices remember. Levels that stopped price before tend to matter again — until they break.</p>
    </div>
  );
}

/* ---------- 4 · Trend structure ---------- */
function TrendStructure() {
  const [kind, setKind] = useState<"up" | "down" | "range">("up");
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
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full">
        <motion.polyline key={kind} points={path} fill="none" stroke={tone} strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
      </svg>
      <p className="mt-1 text-center text-xs text-ink-4">{label}</p>
    </div>
  );
}

/* ---------- 5 · The bid/ask spread ---------- */
function Spread() {
  const bids = [[100, "24.98"], [60, "24.97"], [140, "24.96"]] as const;
  const asks = [[80, "25.02"], [120, "25.03"], [50, "25.04"]] as const;
  const maxSz = 140;
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">The order book</p>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-gain">Bids · buyers</p>
          {bids.map(([sz, px]) => (
            <div key={px} className="relative mb-1 flex items-center justify-between rounded px-2 py-1">
              <div className="absolute inset-0 rounded bg-gain/12" style={{ width: `${(sz / maxSz) * 100}%` }} />
              <span className="relative tnum text-ink-2">{sz}</span>
              <span className="relative tnum text-gain">{px}</span>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-1 text-right text-[10px] uppercase tracking-wider text-loss">Asks · sellers</p>
          {asks.map(([sz, px]) => (
            <div key={px} className="relative mb-1 flex items-center justify-between rounded px-2 py-1">
              <div className="absolute inset-0 right-0 ml-auto rounded bg-loss/12" style={{ width: `${(sz / maxSz) * 100}%` }} />
              <span className="relative tnum text-loss">{px}</span>
              <span className="relative tnum text-ink-2">{sz}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-ink-4">
        Highest bid <span className="text-gain">24.98</span> · lowest ask <span className="text-loss">25.02</span> — the{" "}
        <span className="text-ink-2">4¢ gap is the spread</span>, the cost of crossing the market.
      </p>
    </div>
  );
}
