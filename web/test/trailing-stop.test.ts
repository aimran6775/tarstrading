import { describe, it, expect } from "vitest";
import { trailingStop } from "@/server/exchange";

/*
  Trailing-stop kernel. A sell trail protects a long: the anchor rides the HIGH
  and fires when price retraces `pct` below it. A buy trail protects a short:
  anchor rides the LOW and fires when price rallies `pct` above it.
*/
describe("trailingStop", () => {
  it("sell trail: anchor climbs with price, does not fire while rising", () => {
    const t = trailingStop("sell", 100, 110, 0.05);
    expect(t.newAnchor).toBe(110);
    expect(t.stop).toBeCloseTo(104.5, 6);
    expect(t.triggered).toBe(false);
  });

  it("sell trail: fires when price falls to the trailed stop", () => {
    const t = trailingStop("sell", 110, 104, 0.05); // stop = 110*0.95 = 104.5
    expect(t.newAnchor).toBe(110); // price 104 < anchor, anchor holds
    expect(t.triggered).toBe(true); // 104 <= 104.5
  });

  it("sell trail: does not fire on a shallow dip above the stop", () => {
    const t = trailingStop("sell", 110, 106, 0.05);
    expect(t.triggered).toBe(false); // 106 > 104.5
  });

  it("buy trail: anchor drops with price, does not fire while falling", () => {
    const t = trailingStop("buy", 100, 90, 0.05);
    expect(t.newAnchor).toBe(90);
    expect(t.stop).toBeCloseTo(94.5, 6);
    expect(t.triggered).toBe(false);
  });

  it("buy trail: fires when price rallies to the trailed stop", () => {
    const t = trailingStop("buy", 90, 95, 0.05); // stop = 90*1.05 = 94.5
    expect(t.newAnchor).toBe(90);
    expect(t.triggered).toBe(true); // 95 >= 94.5
  });
});
