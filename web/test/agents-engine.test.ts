import { describe, it, expect } from "vitest";
import { roc, bollBand, rollingExtreme, sanitizeStrategy, describeStrategy } from "@/server/agents";
import { ANALYST_PRESETS } from "@/server/presets";

/*
  The analyst engine's new depth: momentum, bands, channels, and the risk
  block. These are the gears every archetype turns on — each has a way to be
  quietly wrong (a channel that includes today, a band with a zero sigma, a
  risk value that half-parses), so the tests pin semantics, not plumbing.
*/

describe("roc", () => {
  it("measures percent change over N bars", () => {
    const r = roc([100, 110, 121, 133.1], 2);
    expect(r[0]).toBeNaN();
    expect(r[1]).toBeNaN();
    expect(r[2]).toBeCloseTo(21, 6);        // 121/100 - 1
    expect(r[3]).toBeCloseTo(21, 6);        // 133.1/110 - 1
  });

  it("stays NaN across a zero base rather than exploding", () => {
    const r = roc([0, 10, 20], 1);
    expect(r[1]).toBeNaN();                 // base 0 → undefined, not Infinity
    expect(r[2]).toBeCloseTo(100, 6);
  });
});

describe("bollBand", () => {
  it("rails sit 2 sigma either side of the mean", () => {
    // Alternating 90/110: mean 100, population sigma 10 → bands at 80 and 120.
    const vals = [90, 110, 90, 110, 90, 110];
    const upper = bollBand(vals, 4, 1);
    const lower = bollBand(vals, 4, -1);
    expect(upper[5]).toBeCloseTo(120, 6);
    expect(lower[5]).toBeCloseTo(80, 6);
  });

  it("collapses onto the mean when the tape is flat", () => {
    const vals = new Array(10).fill(50);
    expect(bollBand(vals, 5, 1)[9]).toBeCloseTo(50, 6);
    expect(bollBand(vals, 5, -1)[9]).toBeCloseTo(50, 6);
  });
});

describe("rollingExtreme", () => {
  it("excludes the current bar — a breakout compares against YESTERDAY's channel", () => {
    const vals = [1, 2, 3, 10];
    const hi = rollingExtreme(vals, 3, "max");
    // At i=3 the previous-3 high is 3; the current 10 is NOT in its own window,
    // otherwise "price > highest" could never fire and the hunter never hunts.
    expect(hi[3]).toBe(3);
    expect(hi[2]).toBeNaN(); // not enough prior bars
  });

  it("min side mirrors", () => {
    const lo = rollingExtreme([5, 4, 3, 1], 3, "min");
    expect(lo[3]).toBe(3);
  });
});

describe("sanitizeStrategy risk block", () => {
  const base = {
    universe: ["SPY"],
    entry: [{ lhs: { kind: "price" }, comparator: "greaterThan", rhs: { kind: "sma", period: 50 } }],
    exit: [{ lhs: { kind: "price" }, comparator: "lessThan", rhs: { kind: "sma", period: 50 } }],
  };

  it("keeps a sane risk block and describes it", () => {
    const s = sanitizeStrategy({ ...base, risk: { stopLoss: 0.08, takeProfit: 0.25, cooldownBars: 5 } })!;
    expect(s.risk).toEqual({ stopLoss: 0.08, takeProfit: 0.25, cooldownBars: 5 });
    expect(describeStrategy(s)).toContain("cuts any loss at 8%");
    expect(describeStrategy(s)).toContain("banks gains at 25%");
  });

  it("drops out-of-range values instead of half-applying them", () => {
    // stopLoss 0.001 would exit on noise; 5 would be nonsense. Both vanish.
    const s = sanitizeStrategy({ ...base, risk: { stopLoss: 0.001, takeProfit: 5, cooldownBars: 99 } })!;
    expect(s.risk).toBeUndefined();
  });

  it("accepts the new indicator kinds", () => {
    const s = sanitizeStrategy({
      universe: ["QQQ"],
      entry: [
        { lhs: { kind: "roc", period: 63 }, comparator: "greaterThan", rhs: { kind: "constant", value: 0 } },
        { lhs: { kind: "price" }, comparator: "crossesAbove", rhs: { kind: "highest", period: 55 } },
      ],
      exit: [{ lhs: { kind: "price" }, comparator: "crossesBelow", rhs: { kind: "bollLower", period: 20 } }],
    });
    expect(s).not.toBeNull();
  });

  it("still rejects malformed rules wholesale", () => {
    expect(sanitizeStrategy({ ...base, entry: [{ lhs: { kind: "vibes" }, comparator: "greaterThan", rhs: { kind: "price" } }] })).toBeNull();
    expect(sanitizeStrategy({ ...base, entry: [{ lhs: { kind: "highest", period: 1 }, comparator: "greaterThan", rhs: { kind: "price" } }] })).toBeNull();
  });
});

describe("the bench", () => {
  it("every preset survives its own sanitizer — the gate the UI trusts", () => {
    for (const p of ANALYST_PRESETS) {
      const s = sanitizeStrategy(p.strategy);
      expect(s, p.key).not.toBeNull();
      expect(s!.universe.length, p.key).toBeGreaterThan(0);
    }
  });

  it("keys and sigils are unique and named", () => {
    const keys = ANALYST_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of ANALYST_PRESETS) {
      expect(p.name.length).toBeGreaterThan(3);
      expect(p.creed.length).toBeGreaterThan(10);
    }
  });

  it("no preset ships without discipline or with reckless limits", () => {
    for (const p of ANALYST_PRESETS) {
      // Either a stop-loss or a structural exit filter (the Sentinel's 200-day).
      const hasStop = p.strategy.risk?.stopLoss != null;
      const structural = p.strategy.exit.length > 0;
      expect(hasStop || structural, p.key).toBe(true);
      expect(p.maxDrawdown, p.key).toBeLessThanOrEqual(0.25);
      expect(p.allocation, p.key).toBeLessThanOrEqual(10000);
    }
  });
});
