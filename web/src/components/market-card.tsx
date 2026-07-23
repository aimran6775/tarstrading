"use client";

import Link from "next/link";
import { usd, pct, categoryOf, type Quote } from "./trading/shared";

/*
  A market card — the unit of the browse page. Sparkline from the bar vault,
  big tabular price, delta in P&L color, category eyebrow. The whole card is
  the link; inline Buy/Sell act without leaving the grid's flow.
*/

export function Spark({ points, className = "h-10 w-full" }: { points: number[]; className?: string }) {
  if (points.length < 2) return <div className={`${className} rounded bg-bg2`} aria-hidden />;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const W = 120, H = 36;
  const up = points[points.length - 1] >= points[0];
  const path = points.map((p, i) =>
    `${((i / (points.length - 1)) * W).toFixed(1)},${(H - 3 - ((p - min) / range) * (H - 6)).toFixed(1)}`).join(" ");
  const tone = up ? "var(--gain)" : "var(--loss)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden>
      <polyline points={path} fill="none" stroke={tone} strokeWidth="1.6" strokeLinejoin="round" />
      <circle
        cx={W} cy={H - 3 - ((points[points.length - 1] - min) / range) * (H - 6)}
        r="2.2" fill={tone}
      />
    </svg>
  );
}

export default function MarketCard({ symbol, name, quote, spark }: {
  symbol: string;
  name?: string;
  quote?: Quote;
  spark?: number[];
}) {
  const chg = quote?.changePercent ?? 0;
  return (
    <Link href={`/app/m/${encodeURIComponent(symbol)}`}
      className="pressable group flex flex-col gap-3 rounded-2xl border border-hairline bg-bg1 p-4 transition-colors hover:border-[var(--hairline-strong)] hover:bg-bg2/60">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-ink-4">{categoryOf(symbol)}</p>
          <p className="truncate text-sm font-semibold text-ink-1">{symbol}</p>
          {name && <p className="truncate text-[11px] text-ink-4">{name}</p>}
        </div>
        {quote ? (
          <span className={`tnum shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            chg > 0 ? "bg-gain/12 text-gain" : chg < 0 ? "bg-loss/12 text-loss" : "bg-bg3 text-ink-3"
          }`}>
            {pct(chg)}
          </span>
        ) : <span className="skeleton h-5 w-14 rounded-full" />}
      </div>

      <Spark points={spark ?? []} />

      <div className="flex items-baseline justify-between">
        {quote
          ? <span className="tnum text-lg font-semibold text-ink-1">{usd(quote.price)}</span>
          : <span className="skeleton h-6 w-20" />}
        <span className="text-[11px] text-ink-4 opacity-0 transition-opacity group-hover:opacity-100">Trade →</span>
      </div>
    </Link>
  );
}
