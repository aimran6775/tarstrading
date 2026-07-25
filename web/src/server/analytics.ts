import "server-only";
import { db, schema } from "./db";
import { eq, asc } from "drizzle-orm";
import { etDay } from "./market";
import { accountRisk } from "./exchange";

/*
  The performance & risk desk. Everything a fund reports about a track record,
  computed from data already in Supabase — the equity curve (equity_history)
  and the closed-trade journal — plus live exposure from the margin engine.
  The math kernel is pure and unit-tested; the wrapper just gathers the series.

  Honest labeling: daily returns are bucketed by ET trading day (last equity of
  each day), then risk stats are annualized at 252 — the standard convention.
  With few days the numbers are noisy and the UI says so.
*/

const ANN = 252;

export type PerfMetrics = {
  days: number; totalReturn: number; cagr: number;
  sharpe: number; sortino: number; calmar: number; volatility: number; maxDrawdown: number;
  trades: number; winRate: number; profitFactor: number;
  avgWin: number; avgLoss: number; expectancy: number; best: number; worst: number;
};

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const std = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

/** Pure metrics from an end-of-day equity series + realized trade P&Ls. */
export function performanceMetrics(dailyEquity: number[], tradePnls: number[]): PerfMetrics {
  const n = dailyEquity.length;
  const rets: number[] = [];
  for (let i = 1; i < n; i++) {
    const prev = dailyEquity[i - 1];
    if (prev > 0) rets.push(dailyEquity[i] / prev - 1);
  }
  const m = mean(rets);
  const sd = std(rets);
  const downside = std(rets.filter((r) => r < 0));

  const first = dailyEquity[0] || 0;
  const last = dailyEquity[n - 1] || 0;
  const totalReturn = first > 0 ? last / first - 1 : 0;
  const cagr = first > 0 && n > 1 ? Math.pow(last / first, ANN / (n - 1)) - 1 : 0;

  // Max drawdown over the full curve (peak-to-trough).
  let peak = -Infinity, maxDD = 0;
  for (const e of dailyEquity) {
    if (e > peak) peak = e;
    if (peak > 0) maxDD = Math.max(maxDD, (peak - e) / peak);
  }

  const sharpe = sd > 0 ? (m / sd) * Math.sqrt(ANN) : 0;
  const sortino = downside > 0 ? (m / downside) * Math.sqrt(ANN) : 0;
  const calmar = maxDD > 0 ? cagr / maxDD : 0;
  const volatility = sd * Math.sqrt(ANN);

  const wins = tradePnls.filter((p) => p > 0);
  const losses = tradePnls.filter((p) => p < 0);
  const grossWin = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));

  return {
    days: n, totalReturn, cagr, sharpe, sortino, calmar, volatility, maxDrawdown: maxDD,
    trades: tradePnls.length,
    winRate: tradePnls.length ? wins.length / tradePnls.length : 0,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? Infinity : 0),
    avgWin: wins.length ? mean(wins) : 0,
    avgLoss: losses.length ? mean(losses) : 0,
    expectancy: tradePnls.length ? mean(tradePnls) : 0,
    best: tradePnls.length ? Math.max(...tradePnls) : 0,
    worst: tradePnls.length ? Math.min(...tradePnls) : 0,
  };
}

/** Gather the series for a user and compute the full report (metrics + live risk). */
export async function performanceReport(userId: string) {
  const hist = await db.select().from(schema.equityHistory)
    .where(eq(schema.equityHistory.userId, userId))
    .orderBy(asc(schema.equityHistory.time));

  // Bucket to the last equity of each ET trading day.
  const byDay = new Map<string, number>();
  for (const h of hist) byDay.set(etDay(new Date(h.time)), h.equity);
  const dailyEquity = [...byDay.values()];

  const journal = await db.select().from(schema.journalEntries)
    .where(eq(schema.journalEntries.userId, userId));
  const tradePnls = journal.map((j) => j.pnl).filter((p): p is number => p != null);

  const [metrics, risk] = await Promise.all([
    Promise.resolve(performanceMetrics(dailyEquity, tradePnls)),
    accountRisk(userId),
  ]);
  return { metrics, risk };
}
