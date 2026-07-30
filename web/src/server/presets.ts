import "server-only";
import type { Strategy } from "./agents";

/*
  The bench — six analyst archetypes anyone can hire in one click.

  Each is a classic, well-understood discipline expressed in the rule engine,
  with a stop, a target or a cooldown already set — the discipline most people
  skip is the part that comes pre-installed. None of them promises anything:
  they get the same honest 70/30 backtest as a hand-built strategy, and the
  out-of-sample number is still the resume.

  The sigil is the analyst's mark (see components/analyst-sigil.tsx) — an
  original geometric identity, not an emoji and not a face.
*/

export type AnalystPreset = {
  key: string;
  name: string;
  sigil: string;
  /** One line for the card — what this desk believes, in plain English. */
  creed: string;
  /** What the rules literally do — for the person who wants to know. */
  method: string;
  strategy: Strategy;
  allocation: number;
  maxDrawdown: number;
};

export const ANALYST_PRESETS: AnalystPreset[] = [
  {
    key: "trend",
    name: "The Trend Rider",
    sigil: "trend",
    creed: "Markets drift longer than anyone expects. Ride the drift, leave when it bends.",
    method: "Buys SPY and QQQ when the 20-day average crosses above the 50-day; exits on the reverse cross or a 7% stop.",
    strategy: {
      universe: ["SPY", "QQQ"],
      entry: [{ lhs: { kind: "sma", period: 20 }, comparator: "crossesAbove", rhs: { kind: "sma", period: 50 } }],
      exit: [{ lhs: { kind: "sma", period: 20 }, comparator: "crossesBelow", rhs: { kind: "sma", period: 50 } }],
      risk: { stopLoss: 0.07 },
    },
    allocation: 5000,
    maxDrawdown: 0.15,
  },
  {
    key: "dip",
    name: "The Dip Buyer",
    sigil: "dip",
    creed: "Panic is a price. Buy fear, sell relief, never argue with a stop.",
    method: "Buys quality names when 14-day RSI sinks below 30; sells when it recovers past 55, cuts any 8% loss, rests 5 bars after one.",
    strategy: {
      universe: ["AAPL", "MSFT", "GOOG"],
      entry: [{ lhs: { kind: "rsi", period: 14 }, comparator: "lessThan", rhs: { kind: "constant", value: 30 } }],
      exit: [{ lhs: { kind: "rsi", period: 14 }, comparator: "greaterThan", rhs: { kind: "constant", value: 55 } }],
      risk: { stopLoss: 0.08, cooldownBars: 5 },
    },
    allocation: 5000,
    maxDrawdown: 0.2,
  },
  {
    key: "breakout",
    name: "The Breakout Hunter",
    sigil: "breakout",
    creed: "New highs are information. Strength that clears the channel tends to keep going.",
    method: "Buys when price clears its 55-bar high (the turtle channel); exits when it falls through the 20-bar low or a 10% stop.",
    strategy: {
      universe: ["NVDA", "AMD", "SMH"],
      entry: [{ lhs: { kind: "price" }, comparator: "crossesAbove", rhs: { kind: "highest", period: 55 } }],
      exit: [{ lhs: { kind: "price" }, comparator: "crossesBelow", rhs: { kind: "lowest", period: 20 } }],
      risk: { stopLoss: 0.1 },
    },
    allocation: 5000,
    maxDrawdown: 0.25,
  },
  {
    key: "reverter",
    name: "The Mean Reverter",
    sigil: "reverter",
    creed: "Rubber bands snap back. Stretch far enough below the band and the odds shift.",
    method: "Buys when price drops through the lower Bollinger band (20-day, 2 sigma); exits at the middle of the band, cuts 6% losses, rests 4 bars.",
    strategy: {
      universe: ["SPY", "DIA", "IWM"],
      entry: [{ lhs: { kind: "price" }, comparator: "crossesBelow", rhs: { kind: "bollLower", period: 20 } }],
      exit: [{ lhs: { kind: "price" }, comparator: "crossesAbove", rhs: { kind: "sma", period: 20 } }],
      risk: { stopLoss: 0.06, cooldownBars: 4 },
    },
    allocation: 5000,
    maxDrawdown: 0.15,
  },
  {
    key: "momentum",
    name: "The Momentum Desk",
    sigil: "momentum",
    creed: "Winners keep winning until they measurably stop. Own strength, exit weakness.",
    method: "Buys when 3-month momentum is positive and price sits above the 50-day; exits when momentum turns negative, banks 25% gains.",
    strategy: {
      universe: ["QQQ", "SMH", "XLK"],
      entry: [
        { lhs: { kind: "roc", period: 63 }, comparator: "greaterThan", rhs: { kind: "constant", value: 0 } },
        { lhs: { kind: "price" }, comparator: "greaterThan", rhs: { kind: "sma", period: 50 } },
      ],
      exit: [{ lhs: { kind: "roc", period: 63 }, comparator: "lessThan", rhs: { kind: "constant", value: 0 } }],
      risk: { takeProfit: 0.25, stopLoss: 0.1 },
    },
    allocation: 5000,
    maxDrawdown: 0.2,
  },
  {
    key: "sentinel",
    name: "The Sentinel",
    sigil: "sentinel",
    creed: "The first job is not losing. In the market above the long average; in cash below it.",
    method: "Holds SPY only while it trades above its 200-day average — the oldest risk filter there is. Steps aside beneath it.",
    strategy: {
      universe: ["SPY"],
      entry: [{ lhs: { kind: "price" }, comparator: "crossesAbove", rhs: { kind: "sma", period: 200 } }],
      exit: [{ lhs: { kind: "price" }, comparator: "crossesBelow", rhs: { kind: "sma", period: 200 } }],
    },
    allocation: 5000,
    maxDrawdown: 0.12,
  },
];

export const presetByKey = (key: string) =>
  ANALYST_PRESETS.find((p) => p.key === key);
