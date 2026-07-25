import { describe, it, expect } from "vitest";
import { performanceMetrics } from "@/server/analytics";

const approx = (a: number, b: number, p = 4) => expect(a).toBeCloseTo(b, p);

describe("performanceMetrics", () => {
  it("total return and CAGR from a rising curve", () => {
    // 253 daily points, +100% over ~1 trading year → CAGR ≈ 100%.
    const eq = Array.from({ length: 253 }, (_, i) => 100_000 * (1 + i / 252));
    const m = performanceMetrics(eq, []);
    approx(m.totalReturn, 1, 3);
    expect(m.cagr).toBeGreaterThan(0.9);
    expect(m.maxDrawdown).toBe(0); // monotonic up
  });

  it("captures max drawdown peak-to-trough", () => {
    const eq = [100, 120, 90, 130]; // peak 120 → trough 90 = 25% DD
    const m = performanceMetrics(eq, []);
    approx(m.maxDrawdown, 0.25, 6);
  });

  it("trade stats: win rate, profit factor, expectancy", () => {
    const trades = [100, -50, 200, -100, 50]; // 3 wins / 2 losses
    const m = performanceMetrics([100_000, 100_200], trades);
    approx(m.winRate, 3 / 5, 6);
    approx(m.profitFactor, (100 + 200 + 50) / (50 + 100), 6); // 350/150
    approx(m.expectancy, (100 - 50 + 200 - 100 + 50) / 5, 6); // 40
    expect(m.best).toBe(200); expect(m.worst).toBe(-100);
  });

  it("flat curve → zero risk stats, no NaN", () => {
    const m = performanceMetrics([100_000, 100_000, 100_000], []);
    expect(m.sharpe).toBe(0); expect(m.sortino).toBe(0);
    expect(m.volatility).toBe(0); expect(m.maxDrawdown).toBe(0);
    expect(Number.isNaN(m.sharpe)).toBe(false);
  });

  it("positive, finite Sharpe for a noisy up-drift", () => {
    // varying daily returns that net positive → positive, finite Sharpe.
    // (A perfectly constant return has zero vol → Sharpe 0, correctly.)
    const eq = [100_000];
    const rets = [0.004, -0.001, 0.006, 0.002, -0.002, 0.005, 0.001, 0.003];
    for (let i = 0; i < 64; i++) eq.push(eq[eq.length - 1] * (1 + rets[i % rets.length]));
    const m = performanceMetrics(eq, []);
    expect(m.sharpe).toBeGreaterThan(0);
    expect(Number.isFinite(m.sharpe)).toBe(true);
    expect(Number.isFinite(m.sortino)).toBe(true);
  });
});
