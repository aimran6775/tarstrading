import { describe, it, expect } from "vitest";
import { FUTURES_SPECS, productOf, futuresSpec, pickLiquidations, isFuturesOpen } from "@/server/futures";
import { applyFill } from "@/server/exchange";
import { futuresUiSpec, contractSize } from "@/components/trading/shared";

/*
  The futures margin desk. IM gates entry, MM gates holding, VM moves the
  cash — and every one of those is arithmetic that can be quietly wrong, so
  the kernel is pinned here without a database in sight.
*/

describe("contract identity", () => {
  it("parses outrights in both year formats", () => {
    expect(productOf("FUT:ESU6")).toBe("ES");
    expect(productOf("FUT:NGU26")).toBe("NG");
    expect(productOf("FUT:6EQ6")).toBe("6E");
    expect(productOf("FUT:M2KU6")).toBe("M2K");
  });

  it("refuses spreads and junk", () => {
    expect(productOf("FUT:ESU6-ESZ6")).toBeNull();
    expect(productOf("FUT:CL:SA 02M U6")).toBeNull();
    expect(futuresSpec("FUT:XXQ6")).toBeNull(); // unknown product → no spec → rejected at order time
  });

  it("every spec is internally sane: MM below IM, positive multiplier", () => {
    for (const [code, s] of Object.entries(FUTURES_SPECS)) {
      expect(s.mm, code).toBeLessThan(s.im);
      expect(s.mm, code).toBeGreaterThan(0);
      expect(s.multiplier, code).toBeGreaterThan(0);
    }
  });

  it("server and client spec sheets agree — the ticket shows what the desk enforces", () => {
    for (const [code, s] of Object.entries(FUTURES_SPECS)) {
      const ui = futuresUiSpec(`FUT:${code}U6`);
      expect(ui, code).not.toBeNull();
      expect(ui!.multiplier, code).toBe(s.multiplier);
      expect(ui!.im, code).toBe(s.im);
      expect(ui!.mm, code).toBe(s.mm);
    }
  });

  it("contractSize carries the multiplier to display math", () => {
    expect(contractSize("FUT:ESU6")).toBe(50);
    expect(contractSize("FUT:MESU6")).toBe(5);
    expect(contractSize("AAPL")).toBe(1);
  });
});

describe("variation margin arithmetic (via the fill kernel)", () => {
  it("a long ES contract up 10 points realizes $500 on close", () => {
    // Bought 1 ES at 7400 (basis), sold at 7410: realized 10 pts × $50 = $500.
    const r = applyFill(1, 7400, "sell", 1, 7410);
    expect(r.realized * 50).toBeCloseTo(500, 6);
    expect(r.flat).toBe(true);
  });

  it("a short profits when price falls — sign discipline", () => {
    // Short 2 MES at 7400, covered at 7380: (7400−7380) × 2 × $5 = $200.
    const r = applyFill(-2, 7400, "buy", 2, 7380);
    expect(r.realized * 5).toBeCloseTo(200, 6);
  });

  it("overnight VM: (settle − basis) × qty × mult, then basis resets", () => {
    // The sweep's arithmetic, stated as the numbers a statement would show:
    // long 3 MGC, basis 4000, settles 4025 → cash +3 × 25 × $10 = $750,
    // and tomorrow's basis is 4025 — the P&L has MOVED to cash, not vanished.
    const settle = 4025, basis = 4000, qty = 3, mult = 10;
    const vm = (settle - basis) * qty * mult;
    expect(vm).toBe(750);
    // Next session from the new basis: a fall back to 4000 takes it OUT of cash.
    expect((4000 - settle) * qty * mult).toBe(-750);
  });
});

describe("pickLiquidations — the margin call's triage", () => {
  const book = [
    { symbol: "FUT:MESU6", qty: 2 },  // MM 2×2100 = 4,200
    { symbol: "FUT:ESU6", qty: 1 },   // MM 21,000
    { symbol: "FUT:MGCQ6", qty: -1 }, // MM 2,400 (shorts count absolutely)
  ];

  it("frees the biggest margin consumer first", () => {
    const picks = pickLiquidations(book, 5000);
    expect(picks[0].symbol).toBe("FUT:ESU6"); // 21k freed ≥ 5k shortfall in one order
    expect(picks).toHaveLength(1);
  });

  it("keeps closing until the shortfall is covered", () => {
    const picks = pickLiquidations(book, 24000);
    expect(picks.map((p) => p.symbol)).toEqual(["FUT:ESU6", "FUT:MESU6"]); // 21k + 4.2k ≥ 24k
  });

  it("closes whole positions with their real signed qty", () => {
    const picks = pickLiquidations(book, 30000);
    const short = picks.find((p) => p.symbol === "FUT:MGCQ6");
    expect(short?.qty).toBe(-1); // a short liquidates by BUYING back
  });

  it("no shortfall, no liquidation", () => {
    expect(pickLiquidations(book, 0)).toHaveLength(0);
  });
});

describe("the Globex clock", () => {
  const at = (iso: string) => new Date(iso);
  it("closed Saturday, closed Friday evening, opens Sunday 6pm ET", () => {
    expect(isFuturesOpen(at("2026-08-01T16:00:00Z"))).toBe(false);  // Saturday
    expect(isFuturesOpen(at("2026-07-31T22:30:00Z"))).toBe(false);  // Friday 18:30 ET
    expect(isFuturesOpen(at("2026-08-02T21:00:00Z"))).toBe(false);  // Sunday 17:00 ET
    expect(isFuturesOpen(at("2026-08-02T22:30:00Z"))).toBe(true);   // Sunday 18:30 ET
  });
  it("observes the daily 5pm ET maintenance break", () => {
    expect(isFuturesOpen(at("2026-07-29T21:30:00Z"))).toBe(false);  // Wed 17:30 ET
    expect(isFuturesOpen(at("2026-07-29T22:30:00Z"))).toBe(true);   // Wed 18:30 ET
    expect(isFuturesOpen(at("2026-07-30T17:00:00Z"))).toBe(true);   // Thu 13:00 ET
  });
});
