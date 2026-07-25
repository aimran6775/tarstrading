"use client";

import { useEffect, useState } from "react";
import { usd } from "./shared";

/*
  The performance & risk board — the numbers a fund reports about a track
  record. Risk-adjusted returns, drawdown, live exposure, and trade quality,
  from /api/analytics. Metrics glow by meaning: green good, gold caution.
*/

type Metrics = {
  days: number; totalReturn: number; cagr: number; sharpe: number; sortino: number;
  calmar: number; volatility: number; maxDrawdown: number; trades: number; winRate: number;
  profitFactor: number; avgWin: number; avgLoss: number; expectancy: number; best: number; worst: number;
};
type Risk = { equity: number; longValue: number; shortValue: number; gross: number; net: number; buyingPower: number; marginUsedPct: number };

const pctFmt = (n: number) => `${(n * 100).toFixed(1)}%`;
const num = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : "∞");

type Tone = "ink-1" | "gain" | "loss" | "gold";
const TONE: Record<Tone, string> = { "ink-1": "text-ink-1", gain: "text-gain", loss: "text-loss", gold: "text-gold" };

/** Sharpe/Sortino read: <0 poor, 0–1 ok, 1+ good. */
const ratioTone = (n: number): Tone => (n <= 0 ? "loss" : n < 1 ? "ink-1" : "gain");

function Stat({ label, value, tone = "ink-1", hint }: { label: string; value: string; tone?: Tone; hint?: string }) {
  return (
    <div className="raised p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-4">{label}</p>
      <p className={`tnum mt-1 text-lg font-semibold ${TONE[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-ink-4">{hint}</p>}
    </div>
  );
}

export default function AnalyticsBoard() {
  const [m, setM] = useState<Metrics | null>(null);
  const [r, setR] = useState<Risk | null>(null);
  const [state, setState] = useState<"load" | "ok" | "err">("load");

  useEffect(() => {
    let alive = true;
    fetch("/api/analytics").then((x) => x.json()).then((d) => {
      if (!alive) return;
      if (d?.ok) { setM(d.metrics); setR(d.risk); setState("ok"); } else setState("err");
    }).catch(() => alive && setState("err"));
    return () => { alive = false; };
  }, []);

  if (state === "load") return <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-16" />)}</div>;
  if (state === "err" || !m || !r) return null;

  const thin = m.days < 5;
  return (
    <div className="flex flex-col gap-4 p-4 md:p-5">
      {/* Risk-adjusted returns */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-4">Risk-adjusted returns {thin && <span className="text-gold">· thin history</span>}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total return" value={pctFmt(m.totalReturn)} tone={m.totalReturn > 0 ? "gain" : m.totalReturn < 0 ? "loss" : "ink-1"} />
          <Stat label="Sharpe" value={num(m.sharpe)} tone={ratioTone(m.sharpe)} hint="ann." />
          <Stat label="Sortino" value={num(m.sortino)} tone={ratioTone(m.sortino)} hint="downside" />
          <Stat label="Max drawdown" value={pctFmt(m.maxDrawdown)} tone={m.maxDrawdown > 0.2 ? "loss" : m.maxDrawdown > 0.1 ? "gold" : "ink-1"} />
          <Stat label="Calmar" value={num(m.calmar)} />
          <Stat label="Volatility" value={pctFmt(m.volatility)} hint="ann." />
          <Stat label="CAGR" value={pctFmt(m.cagr)} tone={m.cagr > 0 ? "gain" : m.cagr < 0 ? "loss" : "ink-1"} />
          <Stat label="Trading days" value={String(m.days)} />
        </div>
      </div>

      {/* Live exposure — the margin desk's book */}
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-4">Exposure</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Gross" value={usd(r.gross, 0)} />
          <Stat label="Net" value={usd(r.net, 0)} tone={r.net >= 0 ? "gain" : "loss"} />
          <Stat label="Long / Short" value={`${usd(r.longValue, 0)} / ${usd(r.shortValue, 0)}`} />
          <Stat label="Margin used" value={pctFmt(r.marginUsedPct)} tone={r.marginUsedPct > 0.75 ? "loss" : r.marginUsedPct > 0.4 ? "gold" : "ink-1"} hint={`${usd(r.buyingPower, 0)} BP left`} />
        </div>
      </div>

      {/* Trade quality */}
      {m.trades > 0 && (
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink-4">Trade quality · {m.trades} closed</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Win rate" value={pctFmt(m.winRate)} tone={m.winRate >= 0.5 ? "gain" : "ink-1"} />
            <Stat label="Profit factor" value={num(m.profitFactor)} tone={m.profitFactor >= 1.5 ? "gain" : m.profitFactor < 1 ? "loss" : "ink-1"} />
            <Stat label="Expectancy" value={usd(m.expectancy)} tone={m.expectancy > 0 ? "gain" : "loss"} hint="per trade" />
            <Stat label="Avg win / loss" value={`${usd(m.avgWin, 0)} / ${usd(Math.abs(m.avgLoss), 0)}`} />
            <Stat label="Best" value={usd(m.best, 0)} tone="gain" />
            <Stat label="Worst" value={usd(m.worst, 0)} tone="loss" />
          </div>
        </div>
      )}
    </div>
  );
}
