"use client";

import { useState } from "react";

/*
  Portfolio-risk widgets. Per-trade sizing (Stage 4) answers "how big is THIS
  trade?" These answer the question that actually blows accounts: "how much am I
  risking across EVERYTHING at once?" Heat sums it; Correlation shows why three
  positions can secretly be one bet.
*/

/* ---------------- Portfolio heat: total open risk ---------------- */

export function PortfolioHeat() {
  const [positions, setPositions] = useState(4);
  const [riskEach, setRiskEach] = useState(1); // % of account per position

  const heat = positions * riskEach; // total % at risk if every stop hits
  const tone = heat <= 4 ? "gain" : heat <= 6 ? "gold" : "loss";
  const verdict = heat <= 4 ? "Comfortable" : heat <= 6 ? "Getting warm" : "Too hot";

  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-3">Portfolio heat</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Each position risks a little. Together they can risk a lot. &ldquo;Heat&rdquo; is the sum — what you
        lose if every stop gets hit at once (a bad day where everything goes wrong together).
      </p>

      <label className="mt-4 block">
        <span className="flex items-center justify-between text-xs text-ink-4">
          <span>Open positions</span><span className="tnum text-ink-2">{positions}</span>
        </span>
        <input type="range" min={1} max={10} value={positions}
          onChange={(e) => setPositions(Number(e.target.value))}
          aria-label="Number of open positions" className="mt-2 w-full accent-gold" />
      </label>
      <label className="mt-3 block">
        <span className="flex items-center justify-between text-xs text-ink-4">
          <span>Risk per position</span><span className="tnum text-ink-2">{riskEach}%</span>
        </span>
        <input type="range" min={0.5} max={3} step={0.5} value={riskEach}
          onChange={(e) => setRiskEach(Number(e.target.value))}
          aria-label="Risk per position, percent of account" className="mt-2 w-full accent-gold" />
      </label>

      <div className="mt-5 h-3 overflow-hidden rounded-full bg-bg3">
        <div className={`h-full rounded-full bg-${tone} transition-[width] duration-300`}
          style={{ width: `${Math.min(100, heat * 8)}%` }} aria-hidden />
      </div>
      <p className="mt-3 text-sm" aria-live="polite">
        <span className={`tnum text-2xl font-semibold text-${tone}`}>{heat.toFixed(1)}%</span>
        <span className="ml-2 text-ink-3">total heat — {verdict}</span>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-ink-4">
        {heat > 6
          ? "Over ~6% and one bad day can gut the account. Most desks cap total heat well before this — the fix is fewer positions or smaller size, not a bigger stomach."
          : "A common rule of thumb: keep total heat under ~6%. It means even a day where every trade hits its stop is a survivable dent, not a disaster. Survival first."}
      </p>
    </div>
  );
}

/* ---------------- Correlation: when many positions are secretly one ---------------- */

// Fixed pseudo-random walks so the lesson is deterministic (no Math.random).
const SHARED = [0, 6, 3, 9, 14, 11, 17, 13, 19, 24, 21, 27];
const OWN = [0, -5, 2, -8, 3, 7, -2, 6, -9, 1, 8, -3];

export function CorrelationViz() {
  const [corr, setCorr] = useState(80); // −100…+100

  const c = corr / 100;
  const base = 100;
  const a = SHARED.map((s) => base + s);
  // B blends the shared factor (scaled by correlation) with its own noise.
  const b = SHARED.map((s, i) => base + c * s + (1 - Math.abs(c)) * OWN[i]);

  const W = 320, H = 120, pad = 16;
  const all = [...a, ...b];
  const lo = Math.min(...all) - 4, hi = Math.max(...all) + 4;
  const xs = (i: number) => pad + (i / (SHARED.length - 1)) * (W - 2 * pad);
  const ys = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
  const line = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");

  const label = corr >= 60 ? "highly correlated" : corr >= 20 ? "loosely linked" : corr > -20 ? "independent" : "inversely correlated";

  return (
    <div className="card p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-ink-3">Correlation · one bet or many?</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        Diversification only works if your positions move differently. Two tech stocks in the same selloff
        aren&apos;t two bets — they&apos;re one. Slide the correlation and watch the two positions converge.
      </p>

      <label className="mt-4 block">
        <span className="flex items-center justify-between text-xs text-ink-4">
          <span>Correlation</span><span className="tnum text-ink-2">{corr > 0 ? "+" : ""}{(c).toFixed(2)} · {label}</span>
        </span>
        <input type="range" min={-100} max={100} value={corr}
          onChange={(e) => setCorr(Number(e.target.value))}
          aria-label="Correlation between the two positions" className="mt-2 w-full accent-agent" />
      </label>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 w-full" role="img"
        aria-label={`Two position lines, ${label}`}>
        <path d={line(a)} fill="none" stroke="var(--gold)" strokeWidth="2" />
        <path d={line(b)} fill="none" stroke="var(--agent)" strokeWidth="2" />
      </svg>

      <p className="mt-2 text-xs leading-relaxed text-ink-4">
        {corr >= 60
          ? "Moving together, these two positions double your exposure to the same story. In a shock they fall as one — the diversification is an illusion, and your real risk is twice what it looks like."
          : corr > -20 && corr < 20
            ? "Independent lines: when one zigs the other might zag. This is real diversification — a bad outcome in one needn't sink the other, so the portfolio is steadier than any single name."
            : corr <= -20
              ? "Inversely correlated: one rises as the other falls — a hedge. It smooths the ride, but stacking too many cancels out your edge along with your risk."
              : "Loosely linked — some shared drift, some independence. Better than identical twins, not as clean as true diversification."}
      </p>
    </div>
  );
}
