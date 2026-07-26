"use client";

import { Icon } from "@/components/icons";
import { usd, pct } from "@/components/trading/shared";

/*
  Key statistics — the numbers a desk reads before it clicks buy.

  Two range instruments (session and 52-week) sit on top: a hairline track,
  quarter ticks, a filled run up to a needle at the last price. Under them a
  dense mono grid of the session's facts. Every field is nullable — a missing
  number renders an em dash, never a zero that would read as real data.
*/

/** Mirror of the server's MarketStat (server module is server-only). */
export type SymbolStat = {
  symbol: string;
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  bid: number | null;
  ask: number | null;
  high52: number | null;
  low52: number | null;
  avgVolume: number | null;
  rangePosition: number | null;
  return1M: number | null;
  return1Y: number | null;
};

export type StatsState = "loading" | "ready" | "error";

const DASH = "—";
const money = (v: number | null | undefined) => (v == null ? DASH : usd(v));

/** Share counts read better compacted; a terminal never prints 12 digits. */
function compact(v: number | null | undefined): string {
  if (v == null) return DASH;
  const a = Math.abs(v);
  if (a >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Position of `value` inside [low, high], or null when the range isn't real. */
function positionIn(low: number | null, high: number | null, value: number | null): number | null {
  if (low == null || high == null || value == null || !(high > low)) return null;
  return clamp01((value - low) / (high - low));
}

// ---------------------------------------------------------------- range bar

function RangeBar({ label, low, high, value, position, note }: {
  label: string;
  low: number | null;
  high: number | null;
  value: number | null;
  /** Server-computed position wins when present (it knows the true last close). */
  position?: number | null;
  note?: string | null;
}) {
  const p = position ?? positionIn(low, high, value);
  const pctPos = p == null ? null : p * 100;

  return (
    <div
      role="img"
      aria-label={
        p == null
          ? `${label} unavailable`
          : `${label}: ${money(low)} to ${money(high)}, last ${money(value)}, ${Math.round(p * 100)} percent of range`
      }
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.18em] text-ink-4">{label}</span>
        {note ? (
          <span className="shrink-0 rounded-full border border-hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-2">
            {note}
          </span>
        ) : p != null ? (
          <span className="tnum shrink-0 text-[10px] text-ink-4">{Math.round(p * 100)}% of range</span>
        ) : null}
      </div>

      <div className="relative mt-2.5 h-1.5 rounded-full bg-bg3 ring-1 ring-inset ring-[var(--hairline)]">
        {pctPos != null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-[color-mix(in_oklab,var(--ink-2),transparent_55%)]"
            style={{ width: `${pctPos}%` }}
            aria-hidden
          />
        )}
        {[25, 50, 75].map((t) => (
          <span key={t} aria-hidden
            className="absolute top-1/2 h-2 w-px -translate-y-1/2 bg-[var(--hairline-strong)]"
            style={{ left: `${t}%` }} />
        ))}
        {pctPos != null && (
          <span aria-hidden
            className="absolute top-1/2 h-3.5 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-1 shadow-[0_0_0_2px_var(--bg1)]"
            style={{ left: `${pctPos}%` }} />
        )}
      </div>

      <div className="tnum mt-2 flex items-baseline justify-between text-[11px] text-ink-3">
        <span>{money(low)}</span>
        <span>{money(high)}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- stat cell

function Cell({ label, value, tone = "neutral", hint }: {
  label: string;
  value: string;
  tone?: "neutral" | "gain" | "loss";
  hint?: string | null;
}) {
  return (
    <div className="border-t border-hairline pt-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-4">{label}</dt>
      <dd className={`tnum mt-1 text-[13px] ${
        tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-1"
      }`}>
        {value}
        {hint ? <span className="ml-1.5 text-[10px] text-ink-4">{hint}</span> : null}
      </dd>
    </div>
  );
}

const toneOf = (v: number | null | undefined) =>
  v == null ? "neutral" : v > 0 ? "gain" : v < 0 ? "loss" : "neutral";

// ---------------------------------------------------------------- the panel

export default function KeyStatistics({ stat, state, livePrice, onRetry }: {
  stat: SymbolStat | null;
  state: StatsState;
  /** The streaming quote, when we have one — keeps the needles honest between polls. */
  livePrice?: number | null;
  onRetry?: () => void;
}) {
  const heading = (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">
        <Icon.Candles className="h-3.5 w-3.5 text-ink-4" />
        Key statistics
      </h2>
    </div>
  );

  if (state === "error" || (state === "ready" && !stat)) {
    return (
      <section className="raised p-4 md:p-5">
        {heading}
        <p className="flex flex-wrap items-center gap-3 text-xs text-ink-4">
          Statistics aren&apos;t available for this market right now.
          {onRetry && (
            <button onClick={onRetry}
              className="pressable min-h-11 rounded-full border border-hairline px-4 text-xs text-ink-2 hover:text-ink-1">
              Retry
            </button>
          )}
        </p>
      </section>
    );
  }

  if (state === "loading" || !stat) {
    return (
      <section className="raised p-4 md:p-5">
        {heading}
        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
          {[0, 1].map((i) => (
            <div key={i}>
              <span className="skeleton block h-2.5 w-24" />
              <span className="skeleton mt-3 block h-1.5 w-full" />
              <span className="skeleton mt-3 block h-2.5 w-32" />
            </div>
          ))}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="border-t border-hairline pt-2">
              <span className="skeleton block h-2 w-16" />
              <span className="skeleton mt-2 block h-3 w-20" />
            </div>
          ))}
        </dl>
      </section>
    );
  }

  const price = livePrice ?? stat.price;

  // 52-week annotations — only stated when they're true.
  const rp = stat.rangePosition;
  const note52 =
    rp == null ? null
    : rp >= 0.99 ? "At 52-week high"
    : rp >= 0.95 ? "Near 52-week high"
    : rp <= 0.01 ? "At 52-week low"
    : rp <= 0.02 ? "Near 52-week low"
    : null;

  const dayPos = positionIn(stat.dayLow, stat.dayHigh, price);
  const noteDay =
    dayPos == null ? null
    : dayPos >= 0.99 ? "At session high"
    : dayPos <= 0.01 ? "At session low"
    : null;

  const relVolume = stat.volume != null && stat.avgVolume ? stat.volume / stat.avgVolume : null;
  const spread = stat.bid != null && stat.ask != null && stat.ask >= stat.bid ? stat.ask - stat.bid : null;
  const spreadBps = spread != null && stat.bid != null && stat.ask != null
    ? (spread / ((stat.bid + stat.ask) / 2)) * 10_000
    : null;

  return (
    <section className="raised p-4 md:p-5">
      {heading}

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
        <RangeBar label="Day range" low={stat.dayLow} high={stat.dayHigh} value={price} note={noteDay} />
        <RangeBar label="52-week range" low={stat.low52} high={stat.high52} value={price}
          position={stat.rangePosition} note={note52} />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        <Cell label="Open" value={money(stat.open)} />
        <Cell label="Prev close" value={money(stat.prevClose)} />
        <Cell label="Day high" value={money(stat.dayHigh)} />
        <Cell label="Day low" value={money(stat.dayLow)} />
        <Cell label="Volume" value={compact(stat.volume)} />
        <Cell label="Avg volume" value={compact(stat.avgVolume)} hint={stat.avgVolume == null ? null : "52w"} />
        <Cell label="Rel. volume" value={relVolume == null ? DASH : `${relVolume.toFixed(2)}×`}
          hint={relVolume == null ? null : "avg"} />
        <Cell label="Spread" value={spread == null ? DASH : usd(spread)}
          hint={spreadBps == null ? null : `${spreadBps.toFixed(1)} bps`} />
        <Cell label="Bid" value={money(stat.bid)} />
        <Cell label="Ask" value={money(stat.ask)} />
        <Cell label="52w high" value={money(stat.high52)} />
        <Cell label="52w low" value={money(stat.low52)} />
        <Cell label="1M return" value={stat.return1M == null ? DASH : pct(stat.return1M)} tone={toneOf(stat.return1M)} />
        <Cell label="1Y return" value={stat.return1Y == null ? DASH : pct(stat.return1Y)} tone={toneOf(stat.return1Y)} />
      </dl>

      <p className="mt-4 text-[11px] text-ink-4">
        52-week extremes, average volume and trailing returns come from daily closes. A dash means
        the number isn&apos;t available for this market.
      </p>
    </section>
  );
}
