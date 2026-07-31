"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { pct, displaySymbol, marketHrefFor } from "@/components/trading/shared";

/*
  Risk — the desk's own read on your book.

  Two things live here that most retail platforms won't show you:

  1. CONCENTRATION, stated as an effective number of positions. "You own six
     things" is comforting; "your book behaves like 1.4 positions" is true.
  2. THE BENCHMARK. Your return against simply buying SPY over the same days.
     For most traders most of the time the index wins, and a platform whose
     brand is honesty has to say so — that comparison is the single most
     useful number a new trader can see about their own results.
*/

type Report = {
  beta: number | null;
  annualVol: number | null;
  benchVol: number | null;
  maxDrawdown: number | null;
  concentration: number | null;
  effectivePositions: number | null;
  largestWeight: { symbol: string; weight: number } | null;
  correlations: { symbol: string; toBench: number | null; weight: number }[];
  benchmark: { yours: number | null; bench: number | null; excess: number | null; days: number };
  window: { days: number; from: number | null; to: number | null };
};

const WINDOWS = [30, 90, 180, 365];

export default function RiskView() {
  const [report, setReport] = useState<Report | null>(null);
  const [days, setDays] = useState(90);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");

  const load = useCallback(async (d: number) => {
    setPhase("loading");
    try {
      const res = await fetch(`/api/risk?days=${d}`);
      const data = await res.json();
      if (!res.ok || !data.ok) { setPhase("error"); return; }
      setReport(data.report);
      setPhase("ready");
    } catch { setPhase("error"); }
  }, []);

  useEffect(() => { load(days); }, [load, days]);

  const b = report?.benchmark;
  const beat = b?.excess != null && b.excess > 0;

  return (
    <main className="relative isolate mx-auto w-full max-w-4xl flex-1 px-5 pb-24 pt-10 md:px-8 md:pb-10">
      <div className="aura aura-gold" aria-hidden />
      <div className="relative z-10 rise-in">
        <p className="kicker">The desk&apos;s read on your book</p>
        <h1 className="display mt-3 text-balance text-4xl text-ink-1 md:text-5xl">Risk.</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-2">
          What your positions actually expose you to — how much of the market you&apos;re
          carrying, how concentrated you are, how far you&apos;ve fallen from a peak, and
          the comparison nobody volunteers: what buying the index instead would have done.
        </p>
      </div>

      <div className="relative z-10 mt-6 flex gap-1">
        {WINDOWS.map((d) => (
          <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
            className={`pressable min-h-10 rounded-full px-4 text-xs transition-colors ${
              days === d ? "bg-gold/15 text-gold" : "text-ink-4 hover:text-ink-2"
            }`}>
            {d}d
          </button>
        ))}
      </div>

      {phase === "loading" && <div className="skeleton relative z-10 mt-4 h-56" />}
      {phase === "error" && (
        <p className="relative z-10 mt-4 rounded-xl border border-loss/30 bg-loss/10 px-5 py-4 text-sm text-loss">
          Couldn&apos;t compute risk. Refresh to retry.
        </p>
      )}

      {phase === "ready" && report && (
        <>
          {/* The benchmark — the headline, because it's the honest one */}
          <section className="raised relative z-10 mt-4 px-5 py-5">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
              You vs. buying the index
            </h2>
            {b?.yours == null || b?.bench == null ? (
              <p className="mt-3 text-sm text-ink-3">
                Not enough history yet — this needs a few days of equity curve and a
                benchmark series. Keep trading; it fills in.
              </p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-10 gap-y-3">
                  <Stat label="Your return" value={pct(b.yours)}
                    tone={b.yours > 0 ? "gain" : b.yours < 0 ? "loss" : undefined} big />
                  <Stat label="SPY, same days" value={pct(b.bench)}
                    tone={b.bench > 0 ? "gain" : b.bench < 0 ? "loss" : undefined} big />
                  <Stat label="Difference" value={pct(b.excess ?? 0)}
                    tone={beat ? "gain" : "loss"} big />
                </div>
                <p className="mt-3 max-w-2xl text-xs leading-relaxed text-ink-3">
                  {beat
                    ? `You're ahead of the index by ${pct(b.excess ?? 0)} over this window. Worth knowing whether that came from skill or from carrying more risk — check your beta and volatility below.`
                    : `The index is ahead of you by ${pct(Math.abs(b.excess ?? 0))} over this window. That is the ordinary result, not a failing — most professional managers don't beat it either. The question worth asking is whether your trades are earning their risk.`}
                </p>
              </>
            )}
          </section>

          {/* The risk numbers */}
          <section className="raised relative z-10 mt-4 grid grid-cols-2 gap-x-8 gap-y-4 px-5 py-4 sm:grid-cols-4">
            <Stat label="Beta to SPY"
              value={report.beta == null ? "—" : report.beta.toFixed(2)}
              sub={report.beta == null ? undefined
                : report.beta > 1.1 ? "amplifies the market"
                : report.beta < 0.5 ? "moves largely on its own" : "tracks the market"} />
            <Stat label="Your volatility"
              value={report.annualVol == null ? "—" : pct(report.annualVol).replace("+", "")}
              sub="annualised" />
            <Stat label="SPY volatility"
              value={report.benchVol == null ? "—" : pct(report.benchVol).replace("+", "")}
              sub="annualised" />
            <Stat label="Max drawdown"
              value={report.maxDrawdown == null ? "—" : pct(report.maxDrawdown).replace("+", "")}
              tone={(report.maxDrawdown ?? 0) > 0.2 ? "loss" : undefined}
              sub="peak to trough" />
          </section>

          {/* Concentration */}
          <section className="raised relative z-10 mt-4 px-5 py-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
              Concentration
            </h2>
            {report.concentration == null ? (
              <p className="mt-3 text-sm text-ink-3">No positions to measure.</p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-10 gap-y-3">
                  <Stat label="Effective positions"
                    value={(report.effectivePositions ?? 0).toFixed(1)}
                    tone={(report.effectivePositions ?? 0) < 2 ? "warning" : undefined} />
                  {report.largestWeight && (
                    <Stat label="Largest position"
                      value={`${displaySymbol(report.largestWeight.symbol)} ${pct(Math.abs(report.largestWeight.weight)).replace("+", "")}`} />
                  )}
                </div>
                <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-4">
                  You hold {report.correlations.length} position{report.correlations.length === 1 ? "" : "s"},
                  but weighted by size the book behaves like about{" "}
                  {(report.effectivePositions ?? 0).toFixed(1)}. Diversification is about
                  weight, not count.
                </p>
              </>
            )}
          </section>

          {/* Correlations */}
          {report.correlations.length > 0 && (
            <section className="raised relative z-10 mt-4 overflow-hidden">
              <h2 className="px-5 pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-4">
                How each position moves with the market
              </h2>
              <ul className="mt-2 divide-y divide-[var(--hairline)]">
                {report.correlations.map((c) => (
                  <li key={c.symbol} className="flex items-center gap-4 px-5 py-2.5">
                    <Link href={marketHrefFor(c.symbol)}
                      className="pressable min-w-[100px] text-sm font-semibold text-ink-1 hover:text-gold">
                      {displaySymbol(c.symbol)}
                    </Link>
                    <span className="tnum w-20 text-right text-xs text-ink-3">
                      {pct(c.weight)}
                    </span>
                    <div className="flex-1">
                      {c.toBench == null ? (
                        <span className="text-[11px] text-ink-4">no overlapping history</span>
                      ) : (
                        <CorrBar r={c.toBench} />
                      )}
                    </div>
                    <span className="tnum w-12 text-right text-xs text-ink-2">
                      {c.toBench == null ? "—" : c.toBench.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="px-5 py-3 text-xs leading-relaxed text-ink-4">
                Correlation to SPY over the window. Near 1.0 means it rises and falls with
                the market — several of those together is one bet wearing different names.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}

/** A signed correlation bar: right of centre is positive, left is negative. */
function CorrBar({ r }: { r: number }) {
  const w = Math.abs(r) * 50;
  return (
    <div className="relative h-1.5 w-full rounded-full bg-bg3" role="img"
      aria-label={`Correlation ${r.toFixed(2)}`}>
      <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-[var(--hairline)]" />
      <span aria-hidden
        className={`absolute inset-y-0 rounded-full ${r >= 0 ? "bg-gain/70" : "bg-loss/70"}`}
        style={r >= 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }} />
    </div>
  );
}

function Stat({ label, value, sub, tone, big }: {
  label: string; value: string; sub?: string;
  tone?: "gain" | "loss" | "warning"; big?: boolean;
}) {
  const color = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss"
    : tone === "warning" ? "text-warning" : "text-ink-1";
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-ink-4">{label}</p>
      <p className={`tnum mt-0.5 font-semibold ${big ? "text-2xl" : "text-lg"} ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-4">{sub}</p>}
    </div>
  );
}
