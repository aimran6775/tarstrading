"use client";

import Link from "next/link";
import { DASH, marketPath, money, pctOf, toneOf, type Breadth, type BoardRow } from "./board-types";

/*
  Market pulse — the line every terminal opens with.

  Four index proxies carry the tape's direction; the breadth meter carries its
  conviction (a wide advance with a thin decline is a different market from a
  narrow one, even at the same index print). Proxies are ETFs, and they say so:
  we never claim to print the index itself.
*/

const PROXIES: { symbol: string; name: string }[] = [
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "Nasdaq 100" },
  { symbol: "DIA", name: "Dow 30" },
  { symbol: "IWM", name: "Russell 2000" },
];

function ProxyTile({ symbol, name, row, loading }: {
  symbol: string; name: string; row?: BoardRow; loading: boolean;
}) {
  const chg = row?.changePercent ?? null;
  return (
    <Link href={marketPath(symbol)}
      className="group flex min-h-11 flex-col justify-center gap-0.5 rounded-[var(--r-s)] px-3 py-2 transition-colors hover:bg-bg2">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-semibold tracking-tight text-ink-1 transition-colors group-hover:text-gold">
          {symbol}
        </span>
        <span className="truncate text-[10px] text-ink-4">{name}</span>
      </div>
      {loading && !row ? (
        <span className="skeleton mt-1 h-4 w-20" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="tnum text-sm font-semibold text-ink-1">{money(row?.price)}</span>
          <span className={`tnum text-[11px] font-semibold ${toneOf(chg)}`}>{pctOf(chg)}</span>
        </div>
      )}
    </Link>
  );
}

/** Advancing vs declining as one proportional bar — market breadth at a glance. */
function BreadthMeter({ breadth }: { breadth: Breadth | null }) {
  const total = breadth ? breadth.advancing + breadth.declining + breadth.unchanged : 0;
  const adv = total ? ((breadth?.advancing ?? 0) / total) * 100 : 0;
  const dec = total ? ((breadth?.declining ?? 0) / total) * 100 : 0;
  const flat = Math.max(0, 100 - adv - dec);

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">Breadth</span>
        <span className="tnum text-[10px] text-ink-4">
          {total ? `${total} markets` : DASH}
        </span>
      </div>

      {total === 0 ? (
        <span className="skeleton mt-2.5 block h-1.5 w-full" />
      ) : (
        <div className="mt-2.5 flex h-1.5 overflow-hidden rounded-full bg-bg3 ring-1 ring-inset ring-[var(--hairline)]"
          role="img"
          aria-label={`${breadth?.advancing ?? 0} advancing, ${breadth?.declining ?? 0} declining, ${breadth?.unchanged ?? 0} unchanged`}>
          <span className="bg-gain/70" style={{ width: `${adv}%` }} aria-hidden />
          <span className="bg-bg3" style={{ width: `${flat}%` }} aria-hidden />
          <span className="bg-loss/70" style={{ width: `${dec}%` }} aria-hidden />
        </div>
      )}

      <div className="tnum mt-2 flex items-baseline justify-between text-[11px]">
        <span className="text-gain">{breadth ? `${breadth.advancing} adv` : DASH}</span>
        {breadth && breadth.unchanged > 0 && (
          <span className="text-ink-4">{breadth.unchanged} flat</span>
        )}
        <span className="text-loss">{breadth ? `${breadth.declining} dec` : DASH}</span>
      </div>
    </div>
  );
}

export default function PulseStrip({ rows, breadth, marketOpen, asOf, stale }: {
  rows: Map<string, BoardRow>;
  breadth: Breadth | null;
  marketOpen: boolean | null;
  asOf: number | null;
  stale: boolean;
}) {
  const loading = rows.size === 0;
  const stamp = asOf
    ? new Date(asOf).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <section className="raised mb-4 overflow-hidden" aria-label="Market pulse">
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-3 py-2">
        <span className="kicker">Market pulse</span>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1.5 text-ink-4">
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${
              marketOpen === null ? "bg-ink-4" : marketOpen ? "bg-gain" : "bg-ink-4"
            }`} />
            {marketOpen === null ? "Connecting" : marketOpen ? "US market open" : "US market closed"}
          </span>
          {stamp && (
            <span className={`tnum hidden sm:inline ${stale ? "text-warning" : "text-ink-4"}`}>
              {stale ? "stale " : ""}{stamp}
            </span>
          )}
        </div>
      </header>

      <div className="grid gap-x-2 gap-y-3 p-2 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(180px,1.15fr)] lg:items-center lg:gap-3">
        {PROXIES.map((p) => (
          <ProxyTile key={p.symbol} symbol={p.symbol} name={p.name} row={rows.get(p.symbol)} loading={loading} />
        ))}
        <div className="border-t border-hairline px-3 pb-1 pt-3 sm:col-span-2 lg:col-span-1 lg:border-l lg:border-t-0 lg:py-1 lg:pl-4">
          <BreadthMeter breadth={breadth} />
        </div>
      </div>
    </section>
  );
}
