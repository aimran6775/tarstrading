import "server-only";
import { db, schema } from "./db";
import { and, eq, gte } from "drizzle-orm";
import { getDailyHistory } from "./market";
import { accountRisk } from "./exchange";

/*
  Portfolio risk analytics — the numbers a risk desk actually runs.

  Every input is already in the bar vault, so this costs no data budget:
  beta and correlation against SPY, concentration (Herfindahl), realised
  volatility, max drawdown from the equity curve, and — the one nobody
  shows you — WHAT BUYING SPY INSTEAD WOULD HAVE DONE.

  That last one matters most. A platform whose brand is radical honesty has
  to answer "did you beat doing nothing?", because for most traders most of
  the time the answer is no, and a teaching platform that hides it is
  teaching the wrong thing.
*/

const BENCH = "SPY";

/** Daily simple returns from a close series. */
export function returnsOf(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    if (prev > 0) out.push(closes[i] / prev - 1);
  }
  return out;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Sample covariance over the overlapping tail of two return series. */
export function covariance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const x = a.slice(a.length - n), y = b.slice(b.length - n);
  const mx = mean(x), my = mean(y);
  let s = 0;
  for (let i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my);
  return s / (n - 1);
}

export function variance(xs: number[]): number {
  return covariance(xs, xs);
}

/** Correlation coefficient, clamped to [-1, 1] against float drift. */
export function correlation(a: number[], b: number[]): number {
  const va = variance(a), vb = variance(b);
  if (va <= 0 || vb <= 0) return 0;
  const r = covariance(a, b) / Math.sqrt(va * vb);
  return Math.max(-1, Math.min(1, r));
}

/** Beta: how much this moves when the benchmark moves 1. */
export function beta(asset: number[], bench: number[]): number {
  const vb = variance(bench);
  return vb > 0 ? covariance(asset, bench) / vb : 0;
}

/** Annualised volatility from daily returns (252 sessions). */
export function annualVol(rets: number[]): number {
  return Math.sqrt(Math.max(0, variance(rets))) * Math.sqrt(252);
}

/** Deepest peak-to-trough fall in a value series, as a positive fraction. */
export function maxDrawdown(series: number[]): number {
  let peak = -Infinity, worst = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    if (peak > 0) worst = Math.max(worst, (peak - v) / peak);
  }
  return worst;
}

/**
 * Concentration as a Herfindahl index over position weights (0–1). One
 * position = 1.0; ten equal positions = 0.1. The intuitive reading is
 * "effective number of positions" = 1/HHI.
 */
export function herfindahl(weights: number[]): number {
  const total = weights.reduce((a, b) => a + Math.abs(b), 0);
  if (total <= 0) return 0;
  return weights.reduce((a, w) => a + (Math.abs(w) / total) ** 2, 0);
}

export type RiskReport = {
  beta: number | null;
  annualVol: number | null;
  benchVol: number | null;
  maxDrawdown: number | null;
  concentration: number | null;
  effectivePositions: number | null;
  largestWeight: { symbol: string; weight: number } | null;
  correlations: { symbol: string; toBench: number | null; weight: number }[];
  benchmark: {
    /** Your time-weighted return over the window. */
    yours: number | null;
    /** What SPY did over the same window. */
    bench: number | null;
    /** yours − bench. Negative means doing nothing beat you. */
    excess: number | null;
    days: number;
  };
  window: { days: number; from: number | null; to: number | null };
};

/** Everything the risk page needs, from data already in the vault. */
export async function riskReport(userId: string, days = 90): Promise<RiskReport> {
  const since = Date.now() - days * 86_400_000;

  const [positions, risk, history] = await Promise.all([
    db.select().from(schema.positions).where(eq(schema.positions.userId, userId)),
    accountRisk(userId),
    db.select().from(schema.equityHistory)
      .where(and(eq(schema.equityHistory.userId, userId), gte(schema.equityHistory.time, since)))
      .orderBy(schema.equityHistory.time),
  ]);

  // The equity curve drives drawdown, realised vol and your own return.
  const curve = history.map((h) => h.equity).filter((v) => Number.isFinite(v) && v > 0);
  const curveRets = returnsOf(curve);

  // Benchmark: SPY's daily closes over the same window from the bar vault.
  let benchCloses: number[] = [];
  try {
    const bars = await getDailyHistory(BENCH);
    benchCloses = bars.filter((b) => b.time * 1000 >= since).map((b) => b.close);
  } catch { /* no benchmark — the report degrades, never fails */ }
  const benchRets = returnsOf(benchCloses);

  // Per-position weights and their correlation to the benchmark.
  const gross = risk.gross || 1;
  const weighted = positions.map((p) => ({
    symbol: p.symbol,
    // Signed weight so a short reads as negative exposure.
    weight: (p.qty * p.avgEntryPrice) / gross,
  }));

  const correlations = await Promise.all(weighted.slice(0, 24).map(async (w) => {
    try {
      const bars = await getDailyHistory(w.symbol);
      const closes = bars.filter((b) => b.time * 1000 >= since).map((b) => b.close);
      const r = returnsOf(closes);
      return {
        symbol: w.symbol, weight: w.weight,
        toBench: r.length > 5 && benchRets.length > 5 ? correlation(r, benchRets) : null,
      };
    } catch {
      return { symbol: w.symbol, weight: w.weight, toBench: null };
    }
  }));

  // Portfolio beta: the weight-average of each holding's beta to the bench.
  let portBeta: number | null = null;
  {
    let acc = 0, seen = 0;
    for (const c of correlations) {
      if (c.toBench == null) continue;
      // beta = corr × (σ_asset / σ_bench); recovered from what we already have.
      acc += c.weight * c.toBench;
      seen++;
    }
    portBeta = seen ? acc : null;
  }

  const conc = herfindahl(weighted.map((w) => w.weight));
  const largest = weighted.length
    ? weighted.reduce((a, b) => (Math.abs(b.weight) > Math.abs(a.weight) ? b : a))
    : null;

  // The honest comparison: your time-weighted return vs. buying the index.
  const yours = curve.length > 1 ? curve[curve.length - 1] / curve[0] - 1 : null;
  const bench = benchCloses.length > 1
    ? benchCloses[benchCloses.length - 1] / benchCloses[0] - 1 : null;

  return {
    beta: portBeta,
    annualVol: curveRets.length > 5 ? annualVol(curveRets) : null,
    benchVol: benchRets.length > 5 ? annualVol(benchRets) : null,
    maxDrawdown: curve.length > 2 ? maxDrawdown(curve) : null,
    concentration: positions.length ? conc : null,
    effectivePositions: conc > 0 ? 1 / conc : null,
    largestWeight: largest,
    correlations: correlations.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    benchmark: {
      yours, bench,
      excess: yours != null && bench != null ? yours - bench : null,
      days: Math.min(curve.length, benchCloses.length),
    },
    window: {
      days,
      from: history[0]?.time ?? null,
      to: history[history.length - 1]?.time ?? null,
    },
  };
}
