import { describe, it, expect } from "vitest";
import {
  parseOptionSymbol, isOptionSymbol, blackScholes, impliedVol, yearsToExpiry,
} from "@/server/options";

/*
  The options pricing kernel. These are numbers users trade on, so the tests
  pin real properties — put-call parity, monotonicity, the greeks' signs — not
  just "it returns something".
*/

describe("parseOptionSymbol (OCC)", () => {
  it("parses a call", () => {
    const leg = parseOptionSymbol("AAPL260727C00205000");
    expect(leg).not.toBeNull();
    expect(leg!.underlying).toBe("AAPL");
    expect(leg!.expiry).toBe("2026-07-27");
    expect(leg!.type).toBe("call");
    expect(leg!.strike).toBe(205);
  });

  it("parses a put with a fractional strike", () => {
    const leg = parseOptionSymbol("SPY260919P00612500");
    expect(leg!.type).toBe("put");
    expect(leg!.strike).toBe(612.5);
    expect(leg!.underlying).toBe("SPY");
  });

  it("rejects plain equities and crypto — the exchange relies on this", () => {
    expect(parseOptionSymbol("AAPL")).toBeNull();
    expect(parseOptionSymbol("BTC/USD")).toBeNull();
    expect(isOptionSymbol("NVDA")).toBe(false);
    expect(isOptionSymbol("AAPL260727C00205000")).toBe(true);
  });
});

describe("blackScholes", () => {
  const S = 100, K = 100, T = 1, vol = 0.2, r = 0.04;

  it("prices an at-the-money call in the known range", () => {
    const c = blackScholes("call", S, K, T, vol, r);
    // Textbook value for these inputs is ≈ 9.925
    expect(c.price).toBeGreaterThan(9.5);
    expect(c.price).toBeLessThan(10.4);
  });

  it("respects put-call parity: C - P = S - K·e^(-rT)", () => {
    const c = blackScholes("call", S, K, T, vol, r).price;
    const p = blackScholes("put", S, K, T, vol, r).price;
    expect(c - p).toBeCloseTo(S - K * Math.exp(-r * T), 6);
  });

  it("greeks carry the right signs", () => {
    const c = blackScholes("call", S, K, T, vol, r);
    const p = blackScholes("put", S, K, T, vol, r);
    expect(c.delta).toBeGreaterThan(0);      // calls gain with the underlying
    expect(p.delta).toBeLessThan(0);         // puts lose
    expect(c.gamma).toBeGreaterThan(0);      // gamma is positive for long options
    expect(c.theta).toBeLessThan(0);         // long options decay
    expect(c.vega).toBeGreaterThan(0);       // and gain with volatility
    expect(c.gamma).toBeCloseTo(p.gamma, 9); // identical for call and put
    expect(c.vega).toBeCloseTo(p.vega, 9);
  });

  it("an ATM call delta sits near 0.5", () => {
    const c = blackScholes("call", 100, 100, 0.25, 0.2, r);
    expect(c.delta).toBeGreaterThan(0.45);
    expect(c.delta).toBeLessThan(0.62);
  });

  it("is worth exactly intrinsic at expiry", () => {
    const itm = blackScholes("call", 120, 100, 0, 0.2, r);
    expect(itm.price).toBe(20);
    expect(itm.delta).toBe(1);
    expect(itm.theta).toBe(0);

    const otm = blackScholes("call", 90, 100, 0, 0.2, r);
    expect(otm.price).toBe(0);
    expect(otm.delta).toBe(0);

    const putItm = blackScholes("put", 90, 100, 0, 0.2, r);
    expect(putItm.price).toBe(10);
    expect(putItm.delta).toBe(-1);
  });

  it("price rises with volatility and with time", () => {
    const lo = blackScholes("call", S, K, T, 0.1, r).price;
    const hi = blackScholes("call", S, K, T, 0.4, r).price;
    expect(hi).toBeGreaterThan(lo);

    const near = blackScholes("call", S, K, 0.1, vol, r).price;
    const far = blackScholes("call", S, K, 2, vol, r).price;
    expect(far).toBeGreaterThan(near);
  });
});

describe("impliedVol", () => {
  it("round-trips: price at a vol, solve it back", () => {
    for (const vol of [0.12, 0.25, 0.6, 1.2]) {
      const price = blackScholes("call", 100, 105, 0.5, vol).price;
      const solved = impliedVol("call", price, 100, 105, 0.5);
      expect(solved).not.toBeNull();
      expect(solved!).toBeCloseTo(vol, 3);
    }
  });

  it("round-trips for puts too", () => {
    const price = blackScholes("put", 250, 240, 0.25, 0.35).price;
    const solved = impliedVol("put", price, 250, 240, 0.25);
    expect(solved!).toBeCloseTo(0.35, 3);
  });

  it("returns null for impossible prices rather than a wrong number", () => {
    // Below intrinsic — no volatility can produce it.
    expect(impliedVol("call", 1, 150, 100, 0.5)).toBeNull();
    // Zero/negative price.
    expect(impliedVol("call", 0, 100, 100, 0.5)).toBeNull();
    // Already expired.
    expect(impliedVol("call", 5, 100, 100, 0)).toBeNull();
  });
});

describe("yearsToExpiry", () => {
  it("is positive before expiry and zero after", () => {
    const now = new Date("2026-07-26T12:00:00Z").getTime();
    expect(yearsToExpiry("2026-08-26", now)).toBeGreaterThan(0);
    expect(yearsToExpiry("2026-07-01", now)).toBe(0);
  });

  it("a year out is about one year", () => {
    const now = new Date("2026-07-26T20:00:00Z").getTime();
    expect(yearsToExpiry("2027-07-26", now)).toBeCloseTo(1, 2);
  });
});
