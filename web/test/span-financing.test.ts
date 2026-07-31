import { describe, it, expect } from "vitest";
import { portfolioMargin } from "@/server/span";
import { dailyAccrual } from "@/server/financing";
import { FUTURES_SPECS } from "@/server/futures";

/*
  The margin desk's arithmetic, checked by hand. Every expected number here
  is derivable from the spec sheet with a pencil — that recomputability is
  the product's whole claim.
*/

describe("portfolioMargin (SPAN-lite)", () => {
  const IM = (root: keyof typeof FUTURES_SPECS) => FUTURES_SPECS[root].im;

  it("a lone outright margins at full spec IM", () => {
    const r = portfolioMargin([{ symbol: "FUT:ESU6", qty: 1 }]);
    expect(r.im).toBe(IM("ES"));
    expect(r.naiveIm).toBe(IM("ES"));
    expect(r.intraCredit).toBe(0);
    expect(r.interCredits).toEqual([]);
  });

  it("a calendar spread margins at the residual, not two outrights", () => {
    // Long Sep, short Oct crude: same product, opposite months.
    const r = portfolioMargin([
      { symbol: "FUT:CLU6", qty: 1 },
      { symbol: "FUT:CLV6", qty: -1 },
    ]);
    const naive = 2 * IM("CL");
    expect(r.naiveIm).toBe(naive);
    // Fully offset: only the 5% residual — but never below the 25% floor.
    expect(r.im).toBeCloseTo(Math.max(0.05 * naive, 0.25 * naive), 6);
  });

  it("10 micros against 1 full E-mini net to (almost) nothing", () => {
    // MES im is exactly one-tenth of ES im, so IM-dollar netting cancels.
    const r = portfolioMargin([
      { symbol: "FUT:MESU6", qty: 10 },
      { symbol: "FUT:ESU6", qty: -1 },
    ]);
    expect(r.naiveIm).toBe(10 * IM("MES") + IM("ES"));
    expect(r.im).toBeCloseTo(0.25 * r.naiveIm, 6); // floored, not free
  });

  it("long S&P / short Nasdaq earns the equity inter-commodity credit", () => {
    const r = portfolioMargin([
      { symbol: "FUT:ESU6", qty: 1 },
      { symbol: "FUT:NQU6", qty: -1 },
    ]);
    const es = IM("ES"), nq = IM("NQ");
    // Credit = 70% of the smaller leg; both legs are pure outrights.
    expect(r.im).toBeCloseTo(es + nq - 0.7 * Math.min(es, nq), 6);
    expect(r.interCredits).toEqual([{ group: "equity", credit: 0.7 * Math.min(es, nq) }]);
  });

  it("same-direction positions earn NO credit — correlation only helps hedges", () => {
    const r = portfolioMargin([
      { symbol: "FUT:ESU6", qty: 1 },
      { symbol: "FUT:NQU6", qty: 1 },
    ]);
    expect(r.im).toBe(IM("ES") + IM("NQ"));
    expect(r.interCredits).toEqual([]);
  });

  it("credits never cross groups — gold does not hedge crude", () => {
    const r = portfolioMargin([
      { symbol: "FUT:GCQ6", qty: 1 },
      { symbol: "FUT:CLU6", qty: -1 },
    ]);
    expect(r.im).toBe(IM("GC") + IM("CL"));
  });

  it("the floor holds: no book margins below 25% of naive", () => {
    // A perfectly offset book everywhere would love to margin at ~5%; the
    // floor says correlation is a fair-weather friend.
    const r = portfolioMargin([
      { symbol: "FUT:ESU6", qty: 5 },
      { symbol: "FUT:ESZ6", qty: -5 },
    ]);
    expect(r.im).toBeGreaterThanOrEqual(0.25 * r.naiveIm - 1e-9);
  });

  it("an empty or non-futures book margins at zero", () => {
    expect(portfolioMargin([]).im).toBe(0);
    expect(portfolioMargin([{ symbol: "AAPL", qty: 100 }]).im).toBe(0);
  });
});

describe("dailyAccrual (financing)", () => {
  const rates = { fedFunds: 0.0433, marginLoan: 0.0583, cashSweep: 0.0383, borrowGC: 0.003 };

  it("a debit balance pays margin interest at FF + 150bps, actual/360", () => {
    const a = dailyAccrual(-50_000, 0, rates);
    expect(a.debitInterest).toBeCloseTo(-(50_000 * 0.0583) / 360, 6);
    expect(a.sweepInterest).toBe(0);
    expect(a.net).toBeCloseTo(a.debitInterest, 9);
  });

  it("idle cash EARNS the sweep rate — the anti-GS clause", () => {
    const a = dailyAccrual(100_000, 0, rates);
    expect(a.sweepInterest).toBeCloseTo((100_000 * 0.0383) / 360, 6);
    expect(a.net).toBeGreaterThan(0);
  });

  it("shorts pay borrow on their market value", () => {
    const a = dailyAccrual(0, 30_000, rates);
    expect(a.borrowFee).toBeCloseTo(-(30_000 * 0.003) / 360, 6);
  });

  it("a short seller's cash pile earns sweep WHILE the borrow accrues", () => {
    // Selling short raises cash: both legs are real and they partially offset.
    const a = dailyAccrual(130_000, 30_000, rates);
    expect(a.sweepInterest).toBeGreaterThan(0);
    expect(a.borrowFee).toBeLessThan(0);
    expect(a.net).toBeCloseTo(a.sweepInterest + a.borrowFee, 9);
  });
});
