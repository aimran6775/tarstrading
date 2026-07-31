import { describe, it, expect } from "vitest";
import { isRegularSession, provenanceLabel } from "@/components/trading/shared";

/*
  Session-aware provenance (gap 15). A delayed-SIP print at 2am wore the same
  DELAYED 15M badge as one at 2pm, so an overnight price looked as current as
  a live session quote. The distinction is the SESSION, not the feed.
*/

const at = (iso: string) => new Date(iso);

describe("isRegularSession", () => {
  it("knows the US cash session", () => {
    expect(isRegularSession(at("2026-07-30T17:00:00Z"))).toBe(true);   // Thu 13:00 ET
    expect(isRegularSession(at("2026-07-30T13:00:00Z"))).toBe(false);  // Thu 09:00 ET, pre-market
    expect(isRegularSession(at("2026-07-30T21:30:00Z"))).toBe(false);  // Thu 17:30 ET, after hours
    expect(isRegularSession(at("2026-08-01T17:00:00Z"))).toBe(false);  // Saturday
  });

  it("opens at 9:30 and closes at 16:00 ET exactly", () => {
    expect(isRegularSession(at("2026-07-30T13:29:00Z"))).toBe(false);  // 09:29 ET
    expect(isRegularSession(at("2026-07-30T13:30:00Z"))).toBe(true);   // 09:30 ET
    expect(isRegularSession(at("2026-07-30T19:59:00Z"))).toBe(true);   // 15:59 ET
    expect(isRegularSession(at("2026-07-30T20:00:00Z"))).toBe(false);  // 16:00 ET
  });
});

describe("provenanceLabel", () => {
  it("leaves every non-delayed provenance alone", () => {
    expect(provenanceLabel("live")).toBe("LIVE");
    expect(provenanceLabel("eod")).toBe("EOD");
    expect(provenanceLabel("derived")).toBe("DERIVED");
    expect(provenanceLabel("indicative")).toBe("INDICATIVE");
  });

  it("never mislabels 24/7 venues as after-hours", () => {
    // Crypto and FX don't have a US cash session to be outside of.
    expect(provenanceLabel("delayed", "BTC/USD")).toBe("DELAYED 15M");
    expect(provenanceLabel("delayed", "FX:USDJPY")).toBe("DELAYED 15M");
  });
});
