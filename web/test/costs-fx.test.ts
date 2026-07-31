import { describe, it, expect } from "vitest";
import { assetClassOf, commissionFor, slippageFor } from "@/server/costs";
import { quoteCurrency, toUsd } from "@/server/fx";

/*
  Transaction costs and currency conversion — two places where the engine was
  quietly wrong in a way that flatters the trader. Costs make results worse;
  currency conversion made 12 of 17 FX pairs wrong by an exchange rate.
*/

describe("assetClassOf", () => {
  it("reads the shape, not a lookup table", () => {
    expect(assetClassOf("AAPL")).toBe("equity");
    expect(assetClassOf("BTC/USD")).toBe("crypto");
    expect(assetClassOf("FX:USDJPY")).toBe("fx");
    expect(assetClassOf("FUT:ESU6")).toBe("future");
    expect(assetClassOf("AAPL260918C00250000")).toBe("option");
  });
});

describe("commissions", () => {
  it("equities are genuinely free; contracts are not", () => {
    expect(commissionFor("AAPL", 100, 250)).toBe(0);
    expect(commissionFor("AAPL260918C00250000", 5, 4.2)).toBeCloseTo(3.25, 6); // 5 × $0.65
    expect(commissionFor("FUT:ESU6", 2, 7400)).toBeCloseTo(4.5, 6);            // 2 × $2.25
  });

  it("crypto charges basis points of notional, not a flat fee", () => {
    // 0.5 BTC at 64,000 = $32,000 notional → 25 bps = $80.
    expect(commissionFor("BTC/USD", 0.5, 64_000)).toBeCloseTo(80, 6);
  });

  it("a futures round-turn is no longer free — the lesson that was missing", () => {
    const open = commissionFor("FUT:MESU6", 1, 7400);
    const close = commissionFor("FUT:MESU6", 1, 7410);
    expect(open + close).toBeCloseTo(4.5, 6);
  });
});

describe("slippage by size", () => {
  it("without a volume profile it stays at the base spread — no invented penalty", () => {
    expect(slippageFor("AAPL", 100, 250)).toBeCloseTo(0.0005, 9);
    expect(slippageFor("AAPL", 1_000_000, 250, null)).toBeCloseTo(0.0005, 9);
  });

  it("grows with participation, and size stops being free", () => {
    const small = slippageFor("AAPL", 1_000, 250, 10_000_000);
    const large = slippageFor("AAPL", 2_000_000, 250, 10_000_000);
    expect(large).toBeGreaterThan(small);
    // 20% of a day's volume should cost real money — tens of bps, not 5.
    expect(large).toBeGreaterThan(0.004);
  });

  it("prices each venue's own liquidity", () => {
    // Futures books are deeper than option books, and the base reflects it.
    expect(slippageFor("FUT:ESU6", 1, 7400)).toBeLessThan(slippageFor("AAPL260918C00250000", 1, 4.2));
  });
});

describe("FX quote-currency P&L", () => {
  // "USD buys N of this currency" — the ECB convention the platform stores.
  const rates = new Map([["USD", 1], ["JPY", 157.0], ["CHF", 0.82], ["GBP", 0.75]]);

  it("names the currency a pair actually settles in", () => {
    expect(quoteCurrency("FX:EURUSD")).toBe("USD");
    expect(quoteCurrency("FX:USDJPY")).toBe("JPY");
    expect(quoteCurrency("FX:EURGBP")).toBe("GBP");
  });

  it("leaves USD-quoted pairs alone", () => {
    expect(toUsd("FX:EURUSD", 1234.5, rates)).toBeCloseTo(1234.5, 6);
  });

  it("converts yen P&L instead of counting yen as dollars", () => {
    // 157,000 yen is about $1,000 — the old code added it as $157,000.
    expect(toUsd("FX:USDJPY", 157_000, rates)).toBeCloseTo(1000, 6);
  });

  it("converts a cross's own quote currency", () => {
    expect(toUsd("FX:EURGBP", 750, rates)).toBeCloseTo(1000, 6);
  });

  it("returns null on an unknown rate rather than guessing", () => {
    expect(toUsd("FX:USDMXN", 5000, rates)).toBeNull();
    expect(toUsd("FX:USDJPY", 100, new Map([["JPY", 0]]))).toBeNull();
  });
});
