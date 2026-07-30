import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { and, eq, desc } from "drizzle-orm";
import { getBars, getQuote, getQuotes, isUSMarketOpen, type BarPoint } from "./market";
import { getPlatformConfig } from "./platform";
import { placeOrder } from "./exchange";

/*
  The agent engine. An agent is a junior analyst with exactly one idea,
  executed with perfect discipline and zero imagination:
  - Strategy = { universe, entry rules, exit rules } — ALL entry rules must
    agree to buy; ANY exit rule fires a sell. Nothing hidden.
  - Backtests are honest: indicators are computed over the full series, but
    the grade is reported separately for the first 70% (in-sample) and the
    last 30% (out-of-sample). The out-of-sample number is the resume.
  - Runtime: agents evaluate when the desk ticks, place TAGGED orders
    through the same exchange humans use (same slippage, same rejections),
    narrate every decision, and halt themselves at their drawdown limit.
*/

// ---------- strategy model ----------

export type IndicatorRef =
  | { kind: "price" }
  | { kind: "sma"; period: number }
  | { kind: "ema"; period: number }
  | { kind: "rsi"; period: number }
  /** Rate of change over N bars, in percent — momentum's native unit. */
  | { kind: "roc"; period: number }
  /** Bollinger bands: SMA(N) ± 2σ — the mean-reversion desk's rails. */
  | { kind: "bollUpper"; period: number }
  | { kind: "bollLower"; period: number }
  /** Highest/lowest close of the PREVIOUS N bars (current bar excluded), so
      "price crosses above highest(55)" is a genuine breakout, not a tautology
      (any bar is trivially >= a window that includes itself). */
  | { kind: "highest"; period: number }
  | { kind: "lowest"; period: number };

export type Comparator = "crossesAbove" | "crossesBelow" | "greaterThan" | "lessThan";

export type Rule = {
  lhs: IndicatorRef;
  comparator: Comparator;
  rhs: IndicatorRef | { kind: "constant"; value: number };
};

/** The discipline block — what separates a desk from a coin flip. All
    optional; all enforced identically in the backtest and live. */
export type RiskBlock = {
  /** Exit any position down this fraction from entry (0.02–0.5). */
  stopLoss?: number;
  /** Bank any position up this fraction from entry (0.02–2). */
  takeProfit?: number;
  /** After a LOSING exit in a symbol, sit out this many bars before
      re-entering it (0–30). Stops churn on a chopping tape. */
  cooldownBars?: number;
};

export type Strategy = {
  universe: string[];
  entry: Rule[];
  exit: Rule[];
  risk?: RiskBlock;
};

export function describeIndicator(ref: IndicatorRef | { kind: "constant"; value: number }): string {
  switch (ref.kind) {
    case "price": return "price";
    case "sma": return `SMA(${ref.period})`;
    case "ema": return `EMA(${ref.period})`;
    case "rsi": return `RSI(${ref.period})`;
    case "roc": return `${ref.period}-bar momentum`;
    case "bollUpper": return `upper band(${ref.period})`;
    case "bollLower": return `lower band(${ref.period})`;
    case "highest": return `${ref.period}-bar high`;
    case "lowest": return `${ref.period}-bar low`;
    case "constant": return String(ref.value);
  }
}

const COMPARATOR_TEXT: Record<Comparator, string> = {
  crossesAbove: "crosses above",
  crossesBelow: "crosses below",
  greaterThan: "is above",
  lessThan: "is below",
};

const VALID_KINDS = new Set([
  "price", "sma", "ema", "rsi", "roc", "bollUpper", "bollLower", "highest", "lowest", "constant",
]);
const PERIOD_KINDS = new Set(["sma", "ema", "rsi", "roc", "bollUpper", "bollLower", "highest", "lowest"]);
const VALID_COMPARATORS = new Set(["crossesAbove", "crossesBelow", "greaterThan", "lessThan"]);

/** Validate untrusted strategy input (from the UI or the analyst LLM) into a
    clean Strategy, or null. The single gate everything passes through. */
export function sanitizeStrategy(raw: unknown): Strategy | null {
  const s = raw as Strategy;
  if (!s || !Array.isArray(s.universe) || !Array.isArray(s.entry) || !Array.isArray(s.exit)) return null;
  const universe = s.universe.map((x) => String(x).toUpperCase().trim())
    .filter((x) => /^[A-Z.]{1,8}(\/[A-Z]{3,4})?$/.test(x)).slice(0, 6);
  if (!universe.length) return null;
  const cleanRules = (rules: unknown[]): Strategy["entry"] | null => {
    const out = [];
    for (const r of rules.slice(0, 4)) {
      const rule = r as Strategy["entry"][number];
      if (!rule?.lhs || !rule?.rhs || !VALID_KINDS.has(rule.lhs.kind) || !VALID_KINDS.has(rule.rhs.kind)) return null;
      if (!VALID_COMPARATORS.has(rule.comparator)) return null;
      for (const ref of [rule.lhs, rule.rhs] as Array<{ kind: string; period?: number; value?: number }>) {
        if (PERIOD_KINDS.has(ref.kind)) {
          if (!Number.isInteger(ref.period) || ref.period! < 2 || ref.period! > 200) return null;
        }
        if (ref.kind === "constant" && !Number.isFinite(ref.value)) return null;
      }
      out.push(rule);
    }
    return out;
  };
  const entry = cleanRules(s.entry);
  const exit = cleanRules(s.exit);
  if (!entry?.length || !exit?.length) return null;

  // The risk block: clamp into sane ranges, drop anything malformed. A risk
  // control that parses to nonsense must vanish, not half-apply.
  let risk: RiskBlock | undefined;
  if (s.risk && typeof s.risk === "object") {
    const r = s.risk as Record<string, unknown>;
    const stopLoss = Number(r.stopLoss);
    const takeProfit = Number(r.takeProfit);
    const cooldownBars = Number(r.cooldownBars);
    risk = {};
    if (Number.isFinite(stopLoss) && stopLoss >= 0.02 && stopLoss <= 0.5) risk.stopLoss = stopLoss;
    if (Number.isFinite(takeProfit) && takeProfit >= 0.02 && takeProfit <= 2) risk.takeProfit = takeProfit;
    if (Number.isInteger(cooldownBars) && cooldownBars >= 0 && cooldownBars <= 30) risk.cooldownBars = cooldownBars;
    if (!Object.keys(risk).length) risk = undefined;
  }
  return { universe, entry, exit, ...(risk ? { risk } : {}) };
}

/** The plain-English thesis — the product rule: every agent is explainable. */
export function describeStrategy(s: Strategy): string {
  const entry = s.entry.map((r) =>
    `${describeIndicator(r.lhs)} ${COMPARATOR_TEXT[r.comparator]} ${describeIndicator(r.rhs)}`).join(" AND ");
  const exit = s.exit.map((r) =>
    `${describeIndicator(r.lhs)} ${COMPARATOR_TEXT[r.comparator]} ${describeIndicator(r.rhs)}`).join(" OR ");
  const discipline: string[] = [];
  if (s.risk?.stopLoss) discipline.push(`cuts any loss at ${(s.risk.stopLoss * 100).toFixed(0)}%`);
  if (s.risk?.takeProfit) discipline.push(`banks gains at ${(s.risk.takeProfit * 100).toFixed(0)}%`);
  if (s.risk?.cooldownBars) discipline.push(`sits out ${s.risk.cooldownBars} bars after a loss`);
  return `Buys ${s.universe.join(", ")} when ${entry || "—"}. Exits when ${exit || "the position is closed manually"}.`
    + (discipline.length ? ` Discipline: ${discipline.join(", ")}.` : "");
}

// ---------- indicators (NaN-led series, same semantics as the iOS engine) ----------

export function sma(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (period <= 0 || values.length < period) return out;
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  out[period - 1] = seed / period;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

export function rsi(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (values.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period, avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

/** Rate of change over N bars, in percent. */
export function roc(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  for (let i = period; i < values.length; i++) {
    if (values[i - period] > 0) out[i] = (values[i] / values[i - period] - 1) * 100;
  }
  return out;
}

/** Rolling population stddev — the width of the Bollinger rails. */
function rollingStd(values: number[], period: number): number[] {
  const out = new Array(values.length).fill(NaN);
  if (period <= 1 || values.length < period) return out;
  let sum = 0, sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i]; sumSq += values[i] * values[i];
    if (i >= period) { sum -= values[i - period]; sumSq -= values[i - period] * values[i - period]; }
    if (i >= period - 1) {
      const mean = sum / period;
      out[i] = Math.sqrt(Math.max(0, sumSq / period - mean * mean));
    }
  }
  return out;
}

export function bollBand(values: number[], period: number, side: 1 | -1): number[] {
  const mid = sma(values, period);
  const sd = rollingStd(values, period);
  return mid.map((m, i) => Number.isNaN(m) || Number.isNaN(sd[i]) ? NaN : m + side * 2 * sd[i]);
}

/** Extreme of the PREVIOUS N bars — current bar excluded, so a breakout rule
    compares today against yesterday's channel, not against itself. */
export function rollingExtreme(values: number[], period: number, side: "max" | "min"): number[] {
  const out = new Array(values.length).fill(NaN);
  for (let i = period; i < values.length; i++) {
    let ext = side === "max" ? -Infinity : Infinity;
    for (let j = i - period; j < i; j++) {
      ext = side === "max" ? Math.max(ext, values[j]) : Math.min(ext, values[j]);
    }
    out[i] = ext;
  }
  return out;
}

function series(ref: IndicatorRef | { kind: "constant"; value: number }, closes: number[]): number[] {
  switch (ref.kind) {
    case "price": return closes;
    case "sma": return sma(closes, ref.period);
    case "ema": return ema(closes, ref.period);
    case "rsi": return rsi(closes, ref.period);
    case "roc": return roc(closes, ref.period);
    case "bollUpper": return bollBand(closes, ref.period, 1);
    case "bollLower": return bollBand(closes, ref.period, -1);
    case "highest": return rollingExtreme(closes, ref.period, "max");
    case "lowest": return rollingExtreme(closes, ref.period, "min");
    case "constant": return new Array(closes.length).fill(ref.value);
  }
}

/* Series memo: ruleFires runs once per BAR in a backtest, and recomputing a
   full indicator series per bar made the whole thing O(n²). Keyed by the
   closes array's identity, so a fresh array (every backtest, every tick)
   gets a fresh cache and nothing leaks across runs. */
const seriesMemo = new WeakMap<number[], Map<string, number[]>>();
function memoSeries(ref: IndicatorRef | { kind: "constant"; value: number }, closes: number[]): number[] {
  let byRef = seriesMemo.get(closes);
  if (!byRef) { byRef = new Map(); seriesMemo.set(closes, byRef); }
  const key = JSON.stringify(ref);
  let s = byRef.get(key);
  if (!s) { s = series(ref, closes); byRef.set(key, s); }
  return s;
}

function ruleFires(rule: Rule, closes: number[], i: number): boolean {
  const L = memoSeries(rule.lhs, closes);
  const R = memoSeries(rule.rhs, closes);
  const l = L[i], r = R[i], lp = L[i - 1], rp = R[i - 1];
  if ([l, r].some(Number.isNaN)) return false;
  switch (rule.comparator) {
    case "greaterThan": return l > r;
    case "lessThan": return l < r;
    case "crossesAbove": return !Number.isNaN(lp) && !Number.isNaN(rp) && lp <= rp && l > r;
    case "crossesBelow": return !Number.isNaN(lp) && !Number.isNaN(rp) && lp >= rp && l < r;
  }
}

// ---------- honest backtest ----------

export type SegmentStats = {
  return: number;       // fractional
  maxDrawdown: number;  // fractional, positive number
  trades: number;
  winRate: number;      // fractional of closed trades
};

export type BacktestResult = {
  symbolCount: number;
  barsUsed: number;
  splitIndex: number;
  inSample: SegmentStats;
  outOfSample: SegmentStats;
  equityCurve: { t: number; v: number }[]; // normalized, starts at 1
  verdict: "pass" | "overfit-warning" | "no-trades";
};

const BT_SLIPPAGE = 0.0005;

export async function backtest(strategy: Strategy): Promise<BacktestResult | null> {
  const perSymbol: { closes: number[]; times: number[] }[] = [];
  for (const symbol of strategy.universe) {
    const bars: BarPoint[] = await getBars(symbol, "1Y");
    if (bars.length >= 60) {
      perSymbol.push({ closes: bars.map((b) => b.close), times: bars.map((b) => b.time * 1000) });
    }
  }
  if (!perSymbol.length) return null;

  const n = Math.min(...perSymbol.map((s) => s.closes.length));
  const split = Math.floor(n * 0.7);
  const weight = 1 / perSymbol.length;

  // Equal-weight portfolio equity, normalized to 1. Each symbol trades its
  // sleeve independently: long on entry, flat on exit, slippage both ways.
  const equity = new Array(n).fill(0);
  let totalTradesIn = 0, winsIn = 0, totalTradesOut = 0, winsOut = 0;

  const risk = strategy.risk;
  for (const { closes } of perSymbol) {
    const offset = closes.length - n;
    let inPos = false, entryPx = 0, sleeve = 1;
    let cooldownUntil = -1; // bar index before which re-entry is blocked
    const sleeveCurve = new Array(n).fill(1);
    for (let i = 1; i < n; i++) {
      const gi = i + offset;
      if (!inPos && i > cooldownUntil
        && strategy.entry.length && strategy.entry.every((r) => ruleFires(r, closes, gi))) {
        inPos = true;
        entryPx = closes[gi] * (1 + BT_SLIPPAGE);
      } else if (inPos) {
        // The risk block exits on the same bar-close information the live desk
        // sees; rule exits and risk exits share one close-out path.
        const px = closes[gi];
        const stopHit = risk?.stopLoss != null && px <= entryPx * (1 - risk.stopLoss);
        const tpHit = risk?.takeProfit != null && px >= entryPx * (1 + risk.takeProfit);
        const ruleExit = strategy.exit.some((r) => ruleFires(r, closes, gi));
        if (stopHit || tpHit || ruleExit) {
          const exitPx = px * (1 - BT_SLIPPAGE);
          const tradeReturn = exitPx / entryPx - 1;
          sleeve *= 1 + tradeReturn;
          const win = tradeReturn > 0;
          if (i < split) { totalTradesIn++; if (win) winsIn++; }
          else { totalTradesOut++; if (win) winsOut++; }
          inPos = false;
          if (!win && risk?.cooldownBars) cooldownUntil = i + risk.cooldownBars;
        }
      }
      sleeveCurve[i] = inPos ? sleeve * (closes[gi] / entryPx) : sleeve;
    }
    for (let i = 0; i < n; i++) equity[i] += sleeveCurve[i] * weight;
  }

  const segStats = (from: number, to: number, trades: number, wins: number): SegmentStats => {
    const base = equity[from] || 1;
    let peak = -Infinity, maxDD = 0;
    for (let i = from; i < to; i++) {
      peak = Math.max(peak, equity[i]);
      maxDD = Math.max(maxDD, 1 - equity[i] / peak);
    }
    return {
      return: (equity[to - 1] ?? base) / base - 1,
      maxDrawdown: maxDD,
      trades,
      winRate: trades > 0 ? wins / trades : 0,
    };
  };

  const inSample = segStats(0, split, totalTradesIn, winsIn);
  const outOfSample = segStats(split, n, totalTradesOut, winsOut);
  const times = perSymbol[0].times.slice(perSymbol[0].times.length - n);

  const totalTrades = totalTradesIn + totalTradesOut;
  const verdict: BacktestResult["verdict"] =
    totalTrades === 0 ? "no-trades"
    : inSample.winRate >= 0.6 && outOfSample.winRate <= 0.5 && totalTradesOut >= 4 ? "overfit-warning"
    : "pass";

  return {
    symbolCount: perSymbol.length,
    barsUsed: n,
    splitIndex: split,
    inSample,
    outOfSample,
    equityCurve: equity.map((v, i) => ({ t: times[i], v })),
    verdict,
  };
}

// ---------- runtime ----------

type AgentRow = typeof schema.agents.$inferSelect;

async function narrate(userId: string, agent: AgentRow, text: string) {
  await db.insert(schema.agentActivity).values({
    id: randomUUID(), userId, agentId: agent.id, agentName: agent.name,
    text, createdAt: Date.now(),
  });
}

type Holding = {
  qty: number; cost: number;
  /** The most recent completed exit — feeds the loss cooldown without any
      extra state: the order ledger already remembers everything. */
  lastExit?: { at: number; wasLoss: boolean };
};

/** Agent's holdings per symbol, derived from its tagged filled orders. */
async function agentHoldings(userId: string, agentId: string): Promise<Map<string, Holding>> {
  const rows = await db.select().from(schema.orders).where(and(
    eq(schema.orders.userId, userId),
    eq(schema.orders.agentId, agentId),
    eq(schema.orders.status, "filled"),
  ));
  rows.sort((a, b) => a.createdAt - b.createdAt);
  const holdings = new Map<string, Holding>();
  for (const o of rows) {
    const h = holdings.get(o.symbol) ?? { qty: 0, cost: 0 };
    const px = o.filledPrice ?? 0;
    if (o.side === "buy") { h.qty += o.qty; h.cost += o.qty * px; }
    else {
      const avg = h.qty > 0 ? h.cost / h.qty : 0;
      h.cost -= avg * o.qty;
      h.qty -= o.qty;
      if (h.qty <= 1e-9) h.lastExit = { at: o.createdAt, wasLoss: px < avg };
    }
    holdings.set(o.symbol, h);
  }
  return holdings;
}

/** Realized + unrealized P&L of the agent's book, for the drawdown guard. */
export async function agentPnL(userId: string, agentId: string): Promise<number> {
  const rows = await db.select().from(schema.orders).where(and(
    eq(schema.orders.userId, userId),
    eq(schema.orders.agentId, agentId),
    eq(schema.orders.status, "filled"),
  ));
  let cash = 0;
  const qty = new Map<string, number>();
  for (const o of rows) {
    const px = o.filledPrice ?? 0;
    if (o.side === "buy") { cash -= o.qty * px; qty.set(o.symbol, (qty.get(o.symbol) ?? 0) + o.qty); }
    else { cash += o.qty * px; qty.set(o.symbol, (qty.get(o.symbol) ?? 0) - o.qty); }
  }
  const held = [...qty.entries()].filter(([, q]) => q > 1e-9);
  // One batched quote fetch instead of N sequential round trips (this runs
  // per agent in a fan-out, so the N+1 was O(agents × symbols)).
  const quotes = held.length ? await getQuotes(held.map(([s]) => s)) : [];
  const price = new Map(quotes.map((qt) => [qt.symbol, qt.price]));
  let value = 0;
  for (const [symbol, q] of held) value += q * (price.get(symbol) ?? 0);
  return cash + value;
}

/**
 * Evaluate every running agent for this user. Called on desk ticks — v1's
 * honest contract: agents trade while your desk is open (server cron comes
 * with deploy). Idempotent per bar because entries require crosses or flat.
 */
// Per-user in-flight lock: two overlapping ticks (two tabs, a double-click,
// or account-reconcile racing a tick) must not both read held=0 and both buy.
const ticking = new Set<string>();

export async function tickAgents(userId: string): Promise<number> {
  if (ticking.has(userId)) return 0;
  ticking.add(userId);
  try {
    return await runTick(userId);
  } finally {
    ticking.delete(userId);
  }
}

/**
 * Server-side tick for EVERY user who has a running agent — the engine behind
 * "agents run 24/7," independent of whether anyone's browser is open. Called by
 * the cron endpoint. Ticks users sequentially to stay within the market-data
 * rate limit; each user's tick keeps its own in-flight lock.
 */
export async function tickAllRunningAgents(): Promise<{ users: number; actions: number }> {
  // Admin pause switch — freeze every analyst platform-wide without killing them.
  if ((await getPlatformConfig()).agentsPaused) return { users: 0, actions: 0 };
  const rows = await db.selectDistinct({ userId: schema.agents.userId })
    .from(schema.agents).where(eq(schema.agents.status, "running"));
  let actions = 0;
  for (const { userId } of rows) {
    try { actions += await tickAgents(userId); }
    catch { /* one user's failure never halts the desk-wide tick */ }
  }
  return { users: rows.length, actions };
}

async function runTick(userId: string): Promise<number> {
  const running = await db.select().from(schema.agents).where(and(
    eq(schema.agents.userId, userId),
    eq(schema.agents.status, "running"),
  ));
  let actions = 0;

  for (const agent of running) {
    const strategy = JSON.parse(agent.strategy) as Strategy;

    // Drawdown-FROM-PEAK guard: book value = allocation + realized/unrealized
    // P&L; we track the high-water mark and halt on the fall from it, so an
    // agent that ran up then gave it back still trips the limit.
    const pnl = await agentPnL(userId, agent.id);
    const book = agent.allocation + pnl;
    const peak = Math.max(agent.peakValue ?? agent.allocation, book);
    if (peak !== agent.peakValue) {
      await db.update(schema.agents).set({ peakValue: peak }).where(eq(schema.agents.id, agent.id));
    }
    const drawdown = peak > 0 ? (peak - book) / peak : 0;
    if (drawdown > agent.maxDrawdown) {
      await db.update(schema.agents).set({ status: "killed" }).where(eq(schema.agents.id, agent.id));
      await narrate(userId, agent,
        `Halted itself: drawdown ${(drawdown * 100).toFixed(1)}% from its peak breached the ${(agent.maxDrawdown * 100).toFixed(0)}% limit. Positions kept — closing them is your call.`);
      actions++;
      continue;
    }

    const holdings = await agentHoldings(userId, agent.id);
    const perSymbolBudget = agent.allocation / strategy.universe.length;

    for (const symbol of strategy.universe) {
      const isCrypto = symbol.includes("/");
      if (!isCrypto && !isUSMarketOpen()) continue;

      const bars = await getBars(symbol, "1Y").catch(() => []);
      if (bars.length < 60) continue;
      const quote = await getQuote(symbol);
      if (!quote) continue;

      const closes = [...bars.map((b) => b.close), quote.price];
      const i = closes.length - 1;
      const holding = holdings.get(symbol);
      const held = holding?.qty ?? 0;
      const risk = strategy.risk;

      if (held <= 1e-9) {
        // Loss cooldown: after a losing exit, the desk sits out. A bar is a
        // day here — the same unit the backtest counted.
        if (risk?.cooldownBars && holding?.lastExit?.wasLoss
          && Date.now() - holding.lastExit.at < risk.cooldownBars * 86_400_000) continue;
        if (strategy.entry.length && strategy.entry.every((r) => ruleFires(r, closes, i))) {
          const qty = isCrypto
            ? Number((perSymbolBudget / quote.price).toFixed(6))
            : Math.floor(perSymbolBudget / quote.price);
          if (qty > 0) {
            const order = await placeOrder(userId, { symbol, side: "buy", type: "market", qty, agentId: agent.id });
            await narrate(userId, agent, order.status === "filled"
              ? `Entered ${symbol}: ${qty} @ ${order.filledPrice?.toFixed(2)}. Thesis: ${strategy.entry.map((r) => `${describeIndicator(r.lhs)} ${COMPARATOR_TEXT[r.comparator]} ${describeIndicator(r.rhs)}`).join(" and ")}.`
              : `Tried to enter ${symbol} but the order ${order.status}: ${order.rejectReason ?? "resting"}.`);
            actions++;
          }
        }
      } else {
        // Risk exits and rule exits share one close-out path — exactly like
        // the backtest, so the resume and the job are the same job.
        const avgEntry = holding && holding.qty > 0 ? holding.cost / holding.qty : 0;
        const stopHit = risk?.stopLoss != null && avgEntry > 0 && quote.price <= avgEntry * (1 - risk.stopLoss);
        const tpHit = risk?.takeProfit != null && avgEntry > 0 && quote.price >= avgEntry * (1 + risk.takeProfit);
        const ruleExit = strategy.exit.some((r) => ruleFires(r, closes, i));
        if (stopHit || tpHit || ruleExit) {
          const order = await placeOrder(userId, { symbol, side: "sell", type: "market", qty: held, agentId: agent.id });
          const why = stopHit ? `Stop-loss at −${((risk!.stopLoss!) * 100).toFixed(0)}% — the loss is cut, not debated`
            : tpHit ? `Take-profit at +${((risk!.takeProfit!) * 100).toFixed(0)}% — banked, not hoped bigger`
            : "An exit rule fired — no second-guessing";
          await narrate(userId, agent, order.status === "filled"
            ? `Exited ${symbol}: ${held} @ ${order.filledPrice?.toFixed(2)}. ${why}.`
            : `Tried to exit ${symbol} but the order ${order.status}: ${order.rejectReason ?? "resting"}.`);
          actions++;
        }
      }
    }
  }
  return actions;
}

export async function recentActivity(userId: string, limit = 40) {
  return db.select().from(schema.agentActivity)
    .where(eq(schema.agentActivity.userId, userId))
    .orderBy(desc(schema.agentActivity.createdAt)).limit(limit);
}
