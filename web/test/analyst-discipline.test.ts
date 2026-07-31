import { describe, it, expect } from "vitest";
import { tradingDaysSince, ANALYST_VENUE_NOTE, sanitizeStrategy } from "@/server/agents";

/*
  Analyst discipline details that were quietly inconsistent between the
  backtest and the live desk — the two must be the same job, or the resume
  is describing a different analyst than the one working.
*/

describe("tradingDaysSince (gap 24)", () => {
  // Thursday 2026-07-30 12:00Z is the reference point in each case.
  const thu = Date.parse("2026-07-30T12:00:00Z");

  it("counts sessions, not calendar days, across a weekend", () => {
    // Thu → the following Monday is 2 trading days (Fri, Mon), not 4.
    const mon = Date.parse("2026-08-03T12:00:00Z");
    expect(tradingDaysSince(thu, mon)).toBe(2);
  });

  it("a 5-bar cooldown set on Thursday clears the NEXT Thursday", () => {
    const nextThu = Date.parse("2026-08-06T12:00:00Z");
    expect(tradingDaysSince(thu, nextThu)).toBe(5);
    // The old calendar arithmetic would have called this 7 — ~40% more
    // sit-out than the backtest promised.
  });

  it("is zero for the same day and never negative", () => {
    expect(tradingDaysSince(thu, thu)).toBe(0);
    expect(tradingDaysSince(thu, thu - 86_400_000)).toBe(0);
    expect(tradingDaysSince(0, thu)).toBe(0);
  });
});

describe("the venue boundary is stated, not silent (gap 21)", () => {
  it("FX and futures are filtered out of an analyst's universe", () => {
    const s = sanitizeStrategy({
      universe: ["AAPL", "FX:EURUSD", "FUT:ESU6", "BTC/USD"],
      entry: [{ lhs: { kind: "price" }, comparator: "greaterThan", rhs: { kind: "sma", period: 50 } }],
      exit: [{ lhs: { kind: "price" }, comparator: "lessThan", rhs: { kind: "sma", period: 50 } }],
    });
    expect(s!.universe).toEqual(["AAPL", "BTC/USD"]);
  });

  it("carries an explanation the UI and assistant can quote", () => {
    expect(ANALYST_VENUE_NOTE).toMatch(/stocks, ETFs and crypto/);
    expect(ANALYST_VENUE_NOTE).toMatch(/roll a contract/);
  });
});
