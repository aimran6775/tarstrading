import { describe, it, expect } from "vitest";
import { deriveFxPairs, parseFredCsv, pickFrontMonth } from "@/server/feeds";

/*
  The pure math of the feeds mesh. Each function turns a free source's raw
  shape into our own — and each has a way to be quietly wrong (an inverted
  pair, a stale FRED row, an expired contract), so the tests pin the semantics
  rather than just the plumbing.
*/

describe("deriveFxPairs", () => {
  // A real Frankfurter response shape (base=USD): 1 USD buys `rate` of each.
  const rates = {
    EUR: 0.87873, GBP: 0.7525, JPY: 163.68, CHF: 0.82004, CAD: 1.4105,
    AUD: 1.4409, NZD: 1.7319, MXN: 17.4755, SEK: 9.7127, NOK: 9.6643, SGD: 1.2926,
  };

  it("inverts the majors quoted as XXX/USD", () => {
    const p = deriveFxPairs(rates);
    // 1 USD = 0.87873 EUR → 1 EUR = 1.138 USD. An uninverted EURUSD of 0.88
    // would say the euro is worth less than the dollar — wrong direction.
    expect(p.get("FX:EURUSD")!).toBeCloseTo(1 / 0.87873, 6);
    expect(p.get("FX:EURUSD")!).toBeGreaterThan(1);
    expect(p.get("FX:GBPUSD")!).toBeGreaterThan(1);
  });

  it("passes USD-base pairs through unchanged", () => {
    const p = deriveFxPairs(rates);
    expect(p.get("FX:USDJPY")!).toBeCloseTo(163.68, 6);
    expect(p.get("FX:USDMXN")!).toBeCloseTo(17.4755, 6);
  });

  it("computes crosses as quote-per-base", () => {
    const p = deriveFxPairs(rates);
    // EURJPY = yen per euro = (USD→JPY)/(USD→EUR) ≈ 186 — sanity: a euro buys
    // MORE yen than a dollar does.
    expect(p.get("FX:EURJPY")!).toBeCloseTo(163.68 / 0.87873, 4);
    expect(p.get("FX:EURJPY")!).toBeGreaterThan(p.get("FX:USDJPY")!);
    // EURGBP < 1 (a euro buys less than a pound... no — MORE pence than a euro?)
    // Pin the arithmetic: GBP per EUR = 0.7525/0.87873 ≈ 0.856.
    expect(p.get("FX:EURGBP")!).toBeCloseTo(0.7525 / 0.87873, 6);
  });

  it("covers all 16 pairs, and drops pairs whose currency is missing", () => {
    expect(deriveFxPairs(rates).size).toBe(16);
    const partial = deriveFxPairs({ EUR: 0.9 });
    expect(partial.get("FX:EURUSD")).toBeDefined();
    expect(partial.get("FX:USDJPY")).toBeUndefined();  // no JPY rate → no pair
    expect(partial.get("FX:EURJPY")).toBeUndefined();  // cross needs both legs
  });

  it("never fabricates from zero or negative rates", () => {
    const p = deriveFxPairs({ EUR: 0, JPY: -5 });
    expect(p.size).toBe(0);
  });
});

describe("parseFredCsv", () => {
  it("takes the LAST valid observation per series, skipping blanks", () => {
    const csv = [
      "observation_date,SP500,DJIA",
      "2026-07-28,7428.78,52747.32",
      "2026-07-29,7316.15,",       // DJIA not yet published for the 29th
    ].join("\n");
    const m = parseFredCsv(csv);
    expect(m.get("SP500")).toEqual({ value: 7316.15, date: "2026-07-29" });
    // DJIA must NOT be dragged to the 29th with a missing value — it stays on
    // its own last real print.
    expect(m.get("DJIA")).toEqual({ value: 52747.32, date: "2026-07-28" });
  });

  it("survives junk rows and empty input", () => {
    expect(parseFredCsv("").size).toBe(0);
    const m = parseFredCsv("observation_date,VIXCLS\nnot-a-date,99\n2026-07-28,18.21");
    expect(m.get("VIXCLS")).toEqual({ value: 18.21, date: "2026-07-28" });
  });
});

describe("pickFrontMonth", () => {
  const contracts = [
    { ticker: "ESM6", last_trade_date: "2026-06-19" },  // expired
    { ticker: "ESU6", last_trade_date: "2026-09-18" },  // front
    { ticker: "ESZ6", last_trade_date: "2026-12-18" },
    { ticker: "ESH7", last_trade_date: "2027-03-19" },
  ];

  it("picks the nearest unexpired contract", () => {
    expect(pickFrontMonth(contracts, "2026-07-29")).toEqual(
      { ticker: "ESU6", lastTradeDate: "2026-09-18" });
  });

  it("rolls PAST a contract inside its final 3 days", () => {
    // Sep 16: ESU6 stops trading Sep 18 — inside the roll window, so the desk
    // is already on December. Quoting a dying contract as "the market" is how
    // you chart an expiry squeeze as if it were the asset.
    expect(pickFrontMonth(contracts, "2026-09-16")!.ticker).toBe("ESZ6");
  });

  it("returns null when everything is expired or undated", () => {
    expect(pickFrontMonth(contracts, "2027-04-01")).toBeNull();
    expect(pickFrontMonth([{ ticker: "X" }], "2026-01-01")).toBeNull();
  });
});
