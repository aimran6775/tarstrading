"use client";

import { useId } from "react";
import Link from "next/link";
import { pct, displaySymbol, formatPrice, type Quote, type MarketCategory } from "./trading/shared";
import { instrumentOf } from "./markets/instrument";

/*
  A market card — the unit of the browse page. Sparkline from the bar vault,
  big tabular price, delta in P&L color, and an eyebrow that names what the
  thing IS (ADR, country fund, preferred, FX pair) rather than only where it
  sits. The whole card is the link; the card is a .raised material that .lifts
  on hover and reveals its "Trade" affordance.

  A currency pair reads as EUR/USD and prices to the pip without a dollar
  sign — the exchange's real ticker (FX:EURUSD) never reaches the reader,
  though it's what the link travels on.
*/

export function Spark({ points, className = "h-10 w-full", fill = false }: {
  points: number[]; className?: string; fill?: boolean;
}) {
  // Unique gradient id per instance so multiple filled sparks coexist.
  const gid = useId();
  if (points.length < 2) return <div className={`${className} rounded bg-bg2`} aria-hidden />;
  const min = Math.min(...points), max = Math.max(...points);
  /*
    Floor the domain relative to the series' own level. Pure auto-scaling drew
    a $3.21 move on a $99,997 account as a full-height cliff in loss red — the
    Floor hero showed what looked like a total collapse of the user's fund for
    a 0.003% day. A flat book must draw flat: the domain never spans less than
    0.5% of the mean, so small moves stay visually small.
  */
  const mean = points.reduce((a, b) => a + b, 0) / points.length;
  const range = Math.max(max - min, Math.abs(mean) * 0.005, 1e-9);
  const W = 120, H = 36;
  const up = points[points.length - 1] >= points[0];
  const coords = points.map((p, i) => [
    (i / (points.length - 1)) * W,
    H - 3 - ((p - (mean - range / 2)) / range) * (H - 6),
  ] as const);
  const path = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [ex, ey] = coords[coords.length - 1];
  const tone = up ? "var(--gain)" : "var(--loss)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} preserveAspectRatio="none" aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={tone} stopOpacity="0.28" />
              <stop offset="70%" stopColor={tone} stopOpacity="0.04" />
              <stop offset="100%" stopColor={tone} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,${H} ${path} ${W},${H}`} fill={`url(#${gid})`} stroke="none" />
        </>
      )}
      <polyline points={path} fill="none" stroke={tone} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      {/* endpoint held in a soft halo, then the crisp dot */}
      <circle cx={ex} cy={ey} r="4" fill={tone} opacity="0.18" />
      <circle cx={ex} cy={ey} r="2" fill={tone} />
    </svg>
  );
}

export default function MarketCard({ symbol, name, kind, quote, spark }: {
  symbol: string;
  name?: string;
  /** Curated category from the house board; falls back to the shape heuristic. */
  kind?: MarketCategory;
  quote?: Quote;
  spark?: number[];
}) {
  const chg = quote?.changePercent ?? 0;
  const instrument = instrumentOf(symbol, kind, name);
  return (
    <Link href={`/app/m/${encodeURIComponent(symbol)}`}
      className="raised lift group flex flex-col gap-3 p-4 active:scale-[0.98] active:brightness-95">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p title={instrument.title}
            className="truncate font-mono text-[10px] uppercase tracking-[0.24em] text-ink-4">
            {instrument.label}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold tracking-tight text-ink-1">{displaySymbol(symbol)}</p>
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

      <Spark points={spark ?? []} fill />

      <div className="flex items-baseline justify-between">
        {quote
          ? <span className="tnum text-lg font-semibold tracking-tight text-ink-1">{formatPrice(symbol, quote.price)}</span>
          : <span className="skeleton h-6 w-20" />}
        <span className="flex items-center gap-1 text-[11px] font-medium text-gold opacity-0 transition-all duration-200 [transition-timing-function:var(--ease-spring)] group-hover:translate-x-0 group-hover:opacity-100 -translate-x-1 [@media(hover:none)]:translate-x-0 [@media(hover:none)]:opacity-70">
          Trade
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
