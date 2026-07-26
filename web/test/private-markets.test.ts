import { describe, it, expect } from "vitest";
import { irrOf, peMetrics, callSchedule, advanceQuarter } from "@/server/private-markets";

/*
  The private-markets math. The J-curve is the lesson, so these tests pin the
  SHAPE — capital called before value returns, an early dip, TVPI above 1 for a
  good fund — not just that numbers come out.
*/

describe("irrOf", () => {
  it("solves a simple doubling over 5 years (~14.9%)", () => {
    const yr = 365 * 86_400_000;
    const irr = irrOf([
      { amount: -100, atMs: 0 },
      { amount: 200, atMs: 5 * yr },
    ]);
    expect(irr).not.toBeNull();
    expect(irr!).toBeCloseTo(Math.pow(2, 1 / 5) - 1, 4);
  });

  it("is negative when you get back less than you put in", () => {
    const yr = 365 * 86_400_000;
    const irr = irrOf([{ amount: -100, atMs: 0 }, { amount: 60, atMs: 3 * yr }]);
    expect(irr!).toBeLessThan(0);
  });

  it("returns null rather than a fake rate when flows can't support one", () => {
    // Only outflows — no rate explains this yet.
    expect(irrOf([{ amount: -50, atMs: 0 }, { amount: -50, atMs: 1000 }])).toBeNull();
    expect(irrOf([{ amount: -100, atMs: 0 }])).toBeNull();
  });
});

describe("peMetrics", () => {
  it("computes TVPI / DPI / RVPI off CALLED capital, not committed", () => {
    const m = peMetrics({ committed: 100_000, called: 60_000, distributed: 30_000, nav: 45_000 });
    expect(m.unfunded).toBe(40_000);
    expect(m.dpi).toBeCloseTo(30_000 / 60_000, 6);   // 0.5× returned so far
    expect(m.rvpi).toBeCloseTo(45_000 / 60_000, 6);  // 0.75× still held
    expect(m.tvpi).toBeCloseTo(75_000 / 60_000, 6);  // 1.25× total value
  });

  it("is zero-safe before the first call", () => {
    const m = peMetrics({ committed: 50_000, called: 0, distributed: 0, nav: 0 });
    expect(m.tvpi).toBe(0);
    expect(m.unfunded).toBe(50_000);
    expect(Number.isNaN(m.dpi)).toBe(false);
  });
});

describe("callSchedule", () => {
  it("calls the whole commitment across the investment period", () => {
    let total = 0;
    for (let q = 0; q < 20; q++) total += callSchedule(q, 20);
    expect(total).toBeCloseTo(1, 6);
  });

  it("is front-loaded — early quarters call more than late ones", () => {
    expect(callSchedule(0, 20)).toBeGreaterThan(callSchedule(10, 20));
    expect(callSchedule(10, 20)).toBeGreaterThan(callSchedule(19, 20));
  });

  it("calls nothing outside the investment period", () => {
    expect(callSchedule(20, 20)).toBe(0);
    expect(callSchedule(-1, 20)).toBe(0);
  });
});

describe("advanceQuarter — the J-curve", () => {
  const fund = {
    committed: 100_000, termYears: 10, mgmtFee: 0.02,
    carry: 0.2, hurdle: 0.08, outcomeMultiple: 2.0,
  };

  /** Run a full fund life and record the LP's position each quarter. */
  function runFund(outcomeMultiple = 2.0) {
    let called = 0, distributed = 0, nav = 0;
    const path: { q: number; called: number; distributed: number; nav: number; value: number }[] = [];
    for (let q = 0; q < fund.termYears * 4; q++) {
      const step = advanceQuarter({ ...fund, outcomeMultiple, called, distributed, nav, quarter: q });
      called += step.call;
      distributed += step.distribution;
      nav = step.nav;
      path.push({ q, called, distributed, nav, value: distributed + nav });
    }
    return path;
  }

  it("calls capital before it returns any — the defining shape", () => {
    const path = runFund();
    const firstCall = path.find((p) => p.called > 0)!;
    const firstDist = path.find((p) => p.distributed > 0);
    expect(firstCall.q).toBe(0);
    expect(firstDist).toBeDefined();
    expect(firstDist!.q).toBeGreaterThan(firstCall.q);
  });

  it("draws the whole commitment down over the investment period", () => {
    const path = runFund();
    expect(path[path.length - 1].called).toBeCloseTo(fund.committed, -2);
  });

  it("dips underwater early, then recovers — the J", () => {
    const path = runFund(2.0);
    // Net position = value held/returned minus capital paid in.
    const net = path.map((p) => p.value - p.called);
    const earlyTrough = Math.min(...net.slice(0, 8));
    const finish = net[net.length - 1];
    expect(earlyTrough).toBeLessThan(0);   // underwater at first
    expect(finish).toBeGreaterThan(0);     // above water by the end
  });

  it("winds up with nothing left in NAV at the end of the term", () => {
    const path = runFund();
    expect(path[path.length - 1].nav).toBe(0);
  });

  it("a good fund returns more than called; a bad one returns less", () => {
    const good = runFund(2.5);
    const bad = runFund(0.6);
    const goodLast = good[good.length - 1];
    const badLast = bad[bad.length - 1];
    expect(goodLast.distributed).toBeGreaterThan(goodLast.called);
    expect(badLast.distributed).toBeLessThan(badLast.called);
  });

  it("never calls more than was committed", () => {
    const path = runFund();
    for (const p of path) expect(p.called).toBeLessThanOrEqual(fund.committed + 1e-6);
  });
});
