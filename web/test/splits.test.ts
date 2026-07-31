import { describe, it, expect } from "vitest";
import { splitRatio } from "@/server/dividends";

/*
  The split invariant: a split changes the SHARE COUNT and the COST BASIS,
  and leaves position VALUE exactly where it was. That invariant is the whole
  point — the price on the chart drops by the ratio, and if the book doesn't
  adjust in the same breath, a 10:1 split reads as a 90% loss and the
  maintenance sweep liquidates real positions over arithmetic.
*/

/** The adjustment as applySplits performs it, isolated for testing. */
function adjust(qty: number, avg: number, ratio: number) {
  const raw = qty * ratio;
  const newQty = qty > 0 ? Math.floor(raw) : -Math.floor(-raw);
  const newAvg = avg / ratio;
  const fractional = Math.abs(raw) - Math.abs(newQty);
  return { newQty, newAvg, cashInLieu: fractional * newAvg };
}

describe("splitRatio", () => {
  it("reads a forward split", () => {
    expect(splitRatio({ new_rate: 10, old_rate: 1 })).toBe(10);
    expect(splitRatio({ new_rate: 3, old_rate: 2 })).toBe(1.5);
  });

  it("reads a reverse split", () => {
    expect(splitRatio({ new_rate: 1, old_rate: 10 })).toBeCloseTo(0.1, 12);
  });

  it("refuses nonsense rather than corrupting a book", () => {
    expect(splitRatio({ new_rate: 0, old_rate: 1 })).toBeNull();
    expect(splitRatio({ new_rate: 1, old_rate: 0 })).toBeNull();
    expect(splitRatio({ new_rate: -2, old_rate: 1 })).toBeNull();
  });
});

describe("the split invariant — value is unchanged", () => {
  it("10:1 forward split: 100 @ $900 becomes 1000 @ $90", () => {
    const { newQty, newAvg, cashInLieu } = adjust(100, 900, 10);
    expect(newQty).toBe(1000);
    expect(newAvg).toBeCloseTo(90, 10);
    expect(cashInLieu).toBe(0);
    // The invariant, stated directly:
    expect(newQty * newAvg + cashInLieu).toBeCloseTo(100 * 900, 6);
  });

  it("1:10 reverse split: 1000 @ $0.90 becomes 100 @ $9", () => {
    const { newQty, newAvg, cashInLieu } = adjust(1000, 0.9, 0.1);
    expect(newQty).toBe(100);
    expect(newAvg).toBeCloseTo(9, 10);
    expect(newQty * newAvg + cashInLieu).toBeCloseTo(1000 * 0.9, 6);
  });

  it("a 3-for-2 split pays cash for the fractional share, value still held", () => {
    // 101 shares × 1.5 = 151.5 → 151 shares + half a share in cash.
    const { newQty, newAvg, cashInLieu } = adjust(101, 60, 1.5);
    expect(newQty).toBe(151);
    expect(newAvg).toBeCloseTo(40, 10);
    expect(cashInLieu).toBeCloseTo(0.5 * 40, 10);
    expect(newQty * newAvg + cashInLieu).toBeCloseTo(101 * 60, 6);
  });

  it("holds for a SHORT position too — the direction survives", () => {
    const { newQty, newAvg, cashInLieu } = adjust(-50, 400, 4);
    expect(newQty).toBe(-200);
    expect(newAvg).toBeCloseTo(100, 10);
    expect(newQty * newAvg - cashInLieu).toBeCloseTo(-50 * 400, 6);
  });

  it("a reverse split can wipe out a dust position entirely", () => {
    // 5 shares through a 1-for-10 reverse: half a share, no whole shares left.
    const { newQty, cashInLieu } = adjust(5, 2, 0.1);
    expect(newQty).toBe(0);
    expect(cashInLieu).toBeCloseTo(0.5 * 20, 10); // paid out at post-split basis
  });
});
