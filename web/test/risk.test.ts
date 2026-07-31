import { describe, it, expect } from "vitest";
import {
  returnsOf, covariance, variance, correlation, beta,
  annualVol, maxDrawdown, herfindahl,
} from "@/server/risk";

/*
  Risk arithmetic, checked against cases with known answers. These are the
  numbers a user is invited to trust about their own book, so each one is
  pinned to something independently derivable rather than a golden value.
*/

describe("returns", () => {
  it("converts closes to simple returns", () => {
    expect(returnsOf([100, 110, 99])).toEqual([0.10000000000000009, -0.09999999999999998]);
  });
  it("survives a series too short to have returns", () => {
    expect(returnsOf([100])).toEqual([]);
    expect(returnsOf([])).toEqual([]);
  });
  it("skips a zero close rather than dividing by it", () => {
    expect(returnsOf([0, 50]).length).toBe(0);
  });
});

describe("correlation and beta", () => {
  it("a series is perfectly correlated with itself", () => {
    const a = [0.01, -0.02, 0.03, 0.005, -0.01];
    expect(correlation(a, a)).toBeCloseTo(1, 12);
  });

  it("a mirrored series is perfectly anti-correlated", () => {
    const a = [0.01, -0.02, 0.03, 0.005, -0.01];
    const b = a.map((x) => -x);
    expect(correlation(a, b)).toBeCloseTo(-1, 12);
  });

  it("beta of a 2x-levered clone is exactly 2", () => {
    const bench = [0.01, -0.02, 0.03, 0.005, -0.01];
    const asset = bench.map((x) => 2 * x);
    expect(beta(asset, bench)).toBeCloseTo(2, 12);
  });

  it("beta against a flat benchmark is zero, not NaN", () => {
    expect(beta([0.01, 0.02], [0, 0])).toBe(0);
    expect(correlation([0.01, 0.02], [0, 0])).toBe(0);
  });

  it("covariance uses the overlapping tail when lengths differ", () => {
    const a = [0.5, 0.01, -0.02, 0.03];
    const b = [0.01, -0.02, 0.03];
    // The leading 0.5 in `a` is outside the overlap and must not count.
    expect(covariance(a, b)).toBeCloseTo(variance(b), 12);
  });
});

describe("volatility and drawdown", () => {
  it("annualises daily vol by root-252", () => {
    const daily = [0.01, -0.01, 0.01, -0.01, 0.01, -0.01];
    const expected = Math.sqrt(variance(daily)) * Math.sqrt(252);
    expect(annualVol(daily)).toBeCloseTo(expected, 12);
  });

  it("measures the deepest peak-to-trough fall, not the last one", () => {
    // 100 → 50 is a 50% fall; the later 80 → 72 is only 10%.
    expect(maxDrawdown([100, 50, 80, 72, 90])).toBeCloseTo(0.5, 12);
  });

  it("a monotonically rising curve never drew down", () => {
    expect(maxDrawdown([100, 101, 102, 103])).toBe(0);
  });
});

describe("concentration", () => {
  it("one position is total concentration", () => {
    expect(herfindahl([1])).toBeCloseTo(1, 12);
  });

  it("ten equal positions behave like ten", () => {
    const h = herfindahl(Array(10).fill(0.1));
    expect(h).toBeCloseTo(0.1, 12);
    expect(1 / h).toBeCloseTo(10, 10); // effective positions
  });

  it("size dominates count — 90/10 across two names is nearly one bet", () => {
    const h = herfindahl([0.9, 0.1]);
    expect(1 / h).toBeCloseTo(1.2195, 3);
  });

  it("a short counts as exposure, not as an offset", () => {
    // Two positions of equal SIZE in opposite directions are still two bets
    // by this measure; netting them would understate concentration risk.
    expect(herfindahl([0.5, -0.5])).toBeCloseTo(0.5, 12);
  });

  it("an empty book has no concentration", () => {
    expect(herfindahl([])).toBe(0);
    expect(herfindahl([0, 0])).toBe(0);
  });
});
