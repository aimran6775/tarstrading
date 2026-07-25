import { describe, it, expect } from "vitest";
import { applyFill } from "@/server/exchange";

/*
  The signed-position kernel — every trading case, no DB. This is the math that
  makes short selling + margin correct: buys debit cash, sells credit it, and
  reducing an existing position realizes P&L in the right direction.
*/
const approx = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe("applyFill — signed position accounting", () => {
  it("opens a long from flat", () => {
    const r = applyFill(0, 0, "buy", 100, 50);
    expect(r.q1).toBe(100); approx(r.avg, 50); approx(r.cashFlow, -5000);
    expect(r.realized).toBe(0); expect(r.flat).toBe(false);
  });

  it("adds to a long (blended average)", () => {
    const r = applyFill(100, 50, "buy", 100, 60);
    expect(r.q1).toBe(200); approx(r.avg, 55); approx(r.cashFlow, -6000);
    expect(r.closedQty).toBe(0);
  });

  it("reduces a long and realizes gain", () => {
    const r = applyFill(100, 50, "sell", 40, 70);
    expect(r.q1).toBe(60); approx(r.avg, 50); approx(r.cashFlow, 2800);
    expect(r.closedQty).toBe(40); approx(r.realized, (70 - 50) * 40); // +800
  });

  it("closes a long exactly (flat)", () => {
    const r = applyFill(100, 50, "sell", 100, 45);
    expect(r.flat).toBe(true); approx(r.realized, (45 - 50) * 100); // -500 loss
    approx(r.cashFlow, 4500);
  });

  it("opens a SHORT from flat (sell credits cash)", () => {
    const r = applyFill(0, 0, "sell", 100, 50);
    expect(r.q1).toBe(-100); approx(r.avg, 50); approx(r.cashFlow, 5000);
    expect(r.realized).toBe(0);
  });

  it("adds to a short (blended average)", () => {
    const r = applyFill(-100, 50, "sell", 100, 40);
    expect(r.q1).toBe(-200); approx(r.avg, 45); approx(r.cashFlow, 4000);
  });

  it("covers part of a short and realizes gain (price fell)", () => {
    const r = applyFill(-100, 50, "buy", 40, 30);
    expect(r.q1).toBe(-60); approx(r.avg, 50); approx(r.cashFlow, -1200);
    expect(r.closedQty).toBe(40); approx(r.realized, (50 - 30) * 40); // +800 short gain
  });

  it("covers a short at a loss (price rose)", () => {
    const r = applyFill(-100, 50, "buy", 100, 60);
    expect(r.flat).toBe(true); approx(r.realized, (50 - 60) * 100); // -1000
    approx(r.cashFlow, -6000);
  });

  it("crosses zero: long → short in one sell", () => {
    // long 100 @ 50, sell 150 @ 70 → close 100 (realize +2000), open short 50 @ 70
    const r = applyFill(100, 50, "sell", 150, 70);
    expect(r.q1).toBe(-50); approx(r.avg, 70); approx(r.cashFlow, 150 * 70);
    expect(r.closedQty).toBe(100); approx(r.realized, (70 - 50) * 100);
  });

  it("crosses zero: short → long in one buy", () => {
    const r = applyFill(-100, 50, "buy", 150, 40);
    expect(r.q1).toBe(50); approx(r.avg, 40); approx(r.cashFlow, -150 * 40);
    expect(r.closedQty).toBe(100); approx(r.realized, (50 - 40) * 100); // +1000 short gain
  });
});
