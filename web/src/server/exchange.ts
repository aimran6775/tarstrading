import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { and, eq, desc } from "drizzle-orm";
import { getQuote, getQuotes, isUSMarketOpen, etDay } from "./market";
import { getPlatformConfig } from "./platform";
import { isOptionSymbol, parseOptionSymbol, optionQuotes, CONTRACT_SIZE } from "./options";
import { isFxSymbol, isFxOpen, fxQuotes } from "./fx";

/*
  The simulated exchange. Every user trades an isolated $100k account.
  Honest microstructure without pretending to be a real venue:
  - market orders fill at quote ± slippage (5 bps against you)
  - limit orders fill only if the quote satisfies the limit, else rest
  - stop orders trigger at/through the stop, then fill like market
  - equities only trade while the US session is open; crypto trades 24/7
    (resting orders are re-checked on every quote refresh)
  - buying-power and inventory checks reject bad orders with plain reasons
  All simulated. No real money anywhere. Orders are the ONLY thing that
  mutates cash/positions.

  Concurrency: on SQLite a synchronous transaction serialized everything.
  On Postgres we take a row lock on the user's account (SELECT … FOR UPDATE)
  at the top of every settling transaction, so all of a user's concurrent
  order placement and reconciliation serialize on that one row — N pending
  buys can't collectively overspend and a resting sell can't be double-sold.
  Quote fetches (network) always happen BEFORE the transaction opens, so we
  never hold a row lock across I/O.
*/

const SLIPPAGE = 0.0005;

/*
  Margin model (Reg-T, educational). Positions are SIGNED: qty > 0 is long,
  qty < 0 is short. Shorting is allowed on equities/ETFs; crypto stays cash,
  long-only (crypto shorting is exotic and we keep the sim honest about it).

  - Equities: 50% initial margin → up to 2:1 gross leverage. 25% maintenance.
  - Crypto:   100% — full cash, no leverage, no short.
  Buying power and requirements are computed from account EQUITY (which already
  includes unrealized P&L, marked live), exactly as a real margin desk does.
*/
const isCryptoSym = (s: string) => s.includes("/");
/* Options are cash-secured here (long only), so they carry a 100% initial
   requirement like crypto — you pay the premium, full stop. */
const initialRate = (s: string) => (isCryptoSym(s) || isOptionSymbol(s) ? 1 : 0.5);
const maintRate = (s: string) => (isCryptoSym(s) || isOptionSymbol(s) ? 1 : 0.25);
/* FX is a 24/5 venue of its own; crypto never closes; everything else follows
   the US equity session. Options list on the equity session too. */
const venueOpenFor = (s: string) =>
  isCryptoSym(s) ? true : isFxSymbol(s) ? isFxOpen() : isUSMarketOpen();

/** Contract multiplier: an option covers 100 shares, everything else is 1:1. */
export const multiplierFor = (s: string) => (isOptionSymbol(s) ? CONTRACT_SIZE : 1);

/** Any drizzle executor — the base db or a transaction handle. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PlaceOrderInput = {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
  /** Trailing stop: trail as a fraction, e.g. 0.05 = 5%. */
  trailPercent?: number;
  agentId?: string;
};

/*
  Trailing-stop math (pure, unit-tested). The anchor tracks the best price seen
  since placement — the HIGH for a sell (protecting a long), the LOW for a buy
  (protecting a short). The stop trails the anchor by `pct`; it fires when price
  retraces to the stop.
*/
export function trailingStop(side: "buy" | "sell", anchor: number, price: number, pct: number) {
  const newAnchor = side === "sell" ? Math.max(anchor, price) : Math.min(anchor, price);
  const stop = side === "sell" ? newAnchor * (1 - pct) : newAnchor * (1 + pct);
  const triggered = side === "sell" ? price <= stop : price >= stop;
  return { newAnchor, stop, triggered };
}

export type PlacedOrder = typeof schema.orders.$inferSelect;

export async function placeOrder(userId: string, input: PlaceOrderInput): Promise<PlacedOrder> {
  const symbol = input.symbol.toUpperCase();
  const isCrypto = symbol.includes("/");
  const now = Date.now();
  const id = randomUUID();

  const reject = async (reason: string): Promise<PlacedOrder> => {
    const row = {
      id, userId, symbol, side: input.side, type: input.type, qty: input.qty,
      limitPrice: input.limitPrice ?? null, stopPrice: input.stopPrice ?? null,
      trailPercent: null, trailAnchor: null, triggered: 0,
      status: "rejected" as const, filledPrice: null, filledAt: null,
      agentId: input.agentId ?? null, rejectReason: reason, createdAt: now,
    };
    await db.insert(schema.orders).values(row);
    return row;
  };

  const isOption = isOptionSymbol(symbol);
  if (!Number.isFinite(input.qty) || input.qty <= 0) return reject("Quantity must be positive.");
  // Equities trade in whole shares and options in whole contracts; only crypto
  // is fractional.
  if (!isCrypto && !Number.isInteger(input.qty)) {
    return reject(isOption ? "Options trade in whole contracts." : "Stocks trade in whole shares.");
  }
  if (isOption) {
    const leg = parseOptionSymbol(symbol)!;
    // Expired contracts are history, not orders.
    if (new Date(`${leg.expiry}T20:00:00Z`).getTime() < now) {
      return reject(`That contract expired on ${leg.expiry}.`);
    }
  }
  if (input.type === "limit" && !(input.limitPrice && input.limitPrice > 0))
    return reject("Limit orders need a limit price.");
  if (input.type === "stop" && !(input.stopPrice && input.stopPrice > 0))
    return reject("Stop orders need a stop price.");
  if (input.type === "stop_limit" && !(input.stopPrice && input.stopPrice > 0 && input.limitPrice && input.limitPrice > 0))
    return reject("Stop-limit orders need both a stop and a limit price.");
  if (input.type === "trailing_stop" && !(input.trailPercent && input.trailPercent > 0 && input.trailPercent < 1))
    return reject("Trailing stops need a trail between 0% and 100%.");

  // Platform kill switch — admins can halt all order flow.
  if ((await getPlatformConfig()).tradingHalted) return reject("Trading is temporarily halted by the platform.");

  // Fetch the quote BEFORE the transaction — never hold a lock across network.
  // Options price from the chain; everything else from the tape.
  let quote: { symbol: string; price: number } | null;
  if (isOption) {
    const marks = await optionQuotes([symbol]);
    const px = marks.get(symbol);
    quote = px != null ? { symbol, price: px } : null;
    if (!quote) return reject(`No live market for ${symbol} right now.`);
  } else if (isFxSymbol(symbol)) {
    const marks = await fxQuotes([symbol]);
    const px = marks.get(symbol)?.price;
    quote = px != null ? { symbol, price: px } : null;
    if (!quote) return reject(`No market data for ${symbol}.`);
  } else {
    quote = await getQuote(symbol);
    if (!quote) return reject(`No market data for ${symbol}.`);
  }

  const row = {
    id, userId, symbol, side: input.side, type: input.type, qty: input.qty,
    limitPrice: input.limitPrice ?? null, stopPrice: input.stopPrice ?? null,
    // Trailing stop starts its anchor at the current price and tracks from there.
    trailPercent: input.type === "trailing_stop" ? (input.trailPercent ?? null) : null,
    trailAnchor: input.type === "trailing_stop" ? quote.price : null,
    triggered: 0,
    status: "accepted" as const, filledPrice: null as number | null,
    filledAt: null as number | null,
    agentId: input.agentId ?? null, rejectReason: null as string | null, createdAt: now,
  };
  const venueOpen = venueOpenFor(symbol);

  // Atomic check → insert → (maybe) settle, serialized per user by the account
  // row lock. Accounts for capital and inventory already committed to resting
  // orders.
  return db.transaction(async (tx): Promise<PlacedOrder> => {
    // Lock the account row for this user — the per-user serialization point.
    const [account] = await tx.select().from(schema.accounts)
      .where(eq(schema.accounts.userId, userId)).for("update");

    const resting = await tx.select().from(schema.orders).where(and(
      eq(schema.orders.userId, userId), eq(schema.orders.status, "accepted")));

    const rejectIn = async (reason: string): Promise<PlacedOrder> => {
      const r = { ...row, status: "rejected" as const, rejectReason: reason };
      await tx.insert(schema.orders).values(r);
      return r;
    };

    // ---- Margin gate (Reg-T). Signed positions; sells beyond holdings open
    // shorts, gated by equity, not blocked outright. ----
    const positions = await tx.select().from(schema.positions).where(eq(schema.positions.userId, userId));
    const equity = account?.equity ?? account?.cash ?? 0;
    const delta = input.side === "buy" ? input.qty : -input.qty;
    const cur = positions.find((p) => p.symbol === symbol);
    const q0 = cur?.qty ?? 0;
    const q1 = q0 + delta;

    // Crypto is cash + long-only.
    if (isCrypto && q1 < -1e-9) {
      return rejectIn("Crypto can't be shorted here — it trades cash and long-only.");
    }
    // Options are long-only: writing them carries open-ended risk whose margin
    // model this simulator doesn't teach yet. Buy to open, sell to close.
    if (isOption && q1 < -1e-9) {
      return rejectIn("Options are long-only here — you can buy to open and sell to close, but not write contracts.");
    }

    // Mark each symbol: this order's symbol at the live quote, others at cost.
    const markOf = (s: string, avg: number) => (s === symbol ? quote.price : avg);
    // Initial requirement over all positions with the target updated, plus a
    // conservative reservation for resting orders (assume they fill).
    // Requirements are in dollars, so every term carries its contract size.
    let requirement = 0;
    for (const p of positions) {
      const qty = p.symbol === symbol ? q1 : p.qty;
      requirement += initialRate(p.symbol)
        * Math.abs(qty * markOf(p.symbol, p.avgEntryPrice)) * multiplierFor(p.symbol);
    }
    if (!cur && Math.abs(q1) > 1e-9) {
      requirement += initialRate(symbol) * Math.abs(q1 * quote.price) * multiplierFor(symbol);
    }
    for (const o of resting) {
      const px = o.limitPrice ?? o.stopPrice ?? quote.price;
      requirement += initialRate(o.symbol) * px * o.qty * multiplierFor(o.symbol);
    }
    // Deleveraging (shrinking the target's absolute exposure) is always allowed;
    // otherwise you must hold enough equity to meet the initial requirement.
    const reducing = Math.abs(q1) < Math.abs(q0) - 1e-9;
    if (!reducing && requirement > equity + 1e-6) {
      return rejectIn("This order exceeds your buying power (Reg-T margin: 2:1 equities, cash on crypto).");
    }

    await tx.insert(schema.orders).values(row);
    if (venueOpen) {
      const filled = await tryFill(tx, row, quote.price);
      if (filled) return { ...row, ...filled };
    }
    return row;
  });
}

/** Attempt to fill an accepted order against a price. Returns fill patch or null. */
async function tryFill(tx: Tx, order: PlacedOrder, price: number): Promise<{ status: "filled"; filledPrice: number; filledAt: number } | null> {
  let fillPrice: number | null = null;
  const slip = order.side === "buy" ? 1 + SLIPPAGE : 1 - SLIPPAGE;

  switch (order.type) {
    case "market":
      fillPrice = price * slip;
      break;
    case "limit":
      if (order.side === "buy" && price <= order.limitPrice!) fillPrice = Math.min(price * slip, order.limitPrice!);
      if (order.side === "sell" && price >= order.limitPrice!) fillPrice = Math.max(price * slip, order.limitPrice!);
      break;
    case "stop":
      if (order.side === "buy" && price >= order.stopPrice!) fillPrice = price * slip;
      if (order.side === "sell" && price <= order.stopPrice!) fillPrice = price * slip;
      break;
    case "stop_limit": {
      // Once the stop is crossed the order BECOMES a live limit (persisted), so
      // it stays a limit even if price then moves away.
      let live = order.triggered === 1;
      if (!live) {
        const crossed = order.side === "buy" ? price >= order.stopPrice! : price <= order.stopPrice!;
        if (crossed) { live = true; await tx.update(schema.orders).set({ triggered: 1 }).where(eq(schema.orders.id, order.id)); }
      }
      if (live) {
        if (order.side === "buy" && price <= order.limitPrice!) fillPrice = Math.min(price * slip, order.limitPrice!);
        if (order.side === "sell" && price >= order.limitPrice!) fillPrice = Math.max(price * slip, order.limitPrice!);
      }
      break;
    }
    case "trailing_stop": {
      const t = trailingStop(order.side, order.trailAnchor ?? price, price, order.trailPercent ?? 0);
      // Persist a new high/low water even when it doesn't fire.
      if (t.newAnchor !== order.trailAnchor) {
        await tx.update(schema.orders).set({ trailAnchor: t.newAnchor }).where(eq(schema.orders.id, order.id));
      }
      if (t.triggered) fillPrice = price * slip;
      break;
    }
  }
  if (fillPrice == null) return null;

  await settle(tx, order, fillPrice);
  const patch = { status: "filled" as const, filledPrice: fillPrice, filledAt: Date.now() };
  await tx.update(schema.orders).set(patch).where(eq(schema.orders.id, order.id));
  return patch;
}

/*
  Apply a fill to cash + positions + journal — the only money mutation path.
  Signed-position accounting handles every case with one code path:

  - Cash always moves by side: a BUY debits fillPrice·qty, a SELL credits it
    (true whether opening a long, adding, covering a short, or opening a short).
  - Positions carry a signed qty and the avg price of the CURRENT open exposure.
  - When a fill REDUCES existing exposure (opposite sign), the overlapping
    quantity realizes P&L to the journal — (fill − avg) for a long close,
    (avg − fill) for a short cover. A fill that crosses zero closes the old
    side and opens the residual on the new side at the fill price.
*/
/*
  The pure position-math kernel — no DB, no side effects, fully unit-tested.
  Given the current signed position (q0 @ p0) and a fill, returns the new
  position, the cash flow, and any realized P&L. Every trading case — open
  long/short, add, reduce, close, cover, cross-zero — flows through here.
*/
export type FillResult = {
  q1: number; avg: number; cashFlow: number; realized: number; closedQty: number; flat: boolean;
};
export function applyFill(
  q0: number, p0: number, side: "buy" | "sell", qty: number, fill: number,
): FillResult {
  const delta = side === "buy" ? qty : -qty;
  const cashFlow = side === "buy" ? -fill * qty : fill * qty; // buy debits, sell credits
  const q1 = q0 + delta;

  let realized = 0, closedQty = 0;
  if (q0 !== 0 && Math.sign(delta) === -Math.sign(q0)) {
    closedQty = Math.min(Math.abs(delta), Math.abs(q0));
    realized = q0 > 0 ? (fill - p0) * closedQty : (p0 - fill) * closedQty;
  }

  const flat = Math.abs(q1) < 1e-9;
  let avg: number;
  if (flat) avg = 0;
  else if (q0 !== 0 && Math.sign(q1) === Math.sign(q0)) {
    avg = Math.sign(delta) === Math.sign(q0)
      ? (Math.abs(q0) * p0 + qty * fill) / (Math.abs(q0) + qty) // added same direction
      : p0; // reduced, not crossed
  } else avg = fill; // crossed zero or opened from flat
  return { q1, avg, cashFlow, realized, closedQty, flat };
}

async function settle(tx: Tx, order: PlacedOrder, fillPrice: number) {
  const { userId, symbol } = order;
  const [account] = await tx.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  if (!account) return;
  const [pos] = await tx.select().from(schema.positions)
    .where(and(eq(schema.positions.userId, userId), eq(schema.positions.symbol, symbol)));
  const now = Date.now();

  const r = applyFill(pos?.qty ?? 0, pos?.avgEntryPrice ?? 0, order.side, order.qty, fillPrice);
  // An option contract controls 100 shares: cash and realized P&L scale by it,
  // while qty and the average price stay per-contract (what the chain quotes).
  const mult = multiplierFor(symbol);

  await tx.update(schema.accounts)
    .set({ cash: account.cash + r.cashFlow * mult })
    .where(eq(schema.accounts.userId, userId));

  if (r.closedQty > 0) {
    // Realized P&L → journal, every close/cover is a learning artifact.
    await tx.insert(schema.journalEntries).values({
      id: randomUUID(), userId, symbol,
      side: (pos?.qty ?? 0) > 0 ? "sell" : "cover", qty: r.closedQty,
      entryPrice: pos?.avgEntryPrice ?? 0, exitPrice: fillPrice,
      pnl: r.realized * mult,
      thesis: null, agentId: order.agentId, createdAt: now,
    });
  }

  if (r.flat) {
    if (pos) await tx.delete(schema.positions).where(eq(schema.positions.id, pos.id));
  } else if (pos) {
    await tx.update(schema.positions).set({ qty: r.q1, avgEntryPrice: r.avg, updatedAt: now })
      .where(eq(schema.positions.id, pos.id));
  } else {
    await tx.insert(schema.positions).values({
      id: randomUUID(), userId, symbol, qty: r.q1, avgEntryPrice: r.avg, updatedAt: now,
    });
  }
}

/*
  Account risk snapshot for the UI — the numbers a margin desk watches. Equity
  is marked live by markEquity; here we split it into long/short market value,
  gross/net exposure, the maintenance requirement, and remaining buying power.
*/
export type AccountRisk = {
  equity: number; cash: number; longValue: number; shortValue: number;
  gross: number; net: number; maintenance: number; buyingPower: number; marginUsedPct: number;
};

export async function accountRisk(userId: string): Promise<AccountRisk> {
  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  const positions = await db.select().from(schema.positions).where(eq(schema.positions.userId, userId));
  const cash = account?.cash ?? 0;
  let longValue = 0, shortValue = 0, initialReq = 0, maintenance = 0;
  const optSyms = positions.filter((p) => isOptionSymbol(p.symbol)).map((p) => p.symbol);
  const fxSyms = positions.filter((p) => isFxSymbol(p.symbol)).map((p) => p.symbol);
  const plainSyms = positions
    .filter((p) => !isOptionSymbol(p.symbol) && !isFxSymbol(p.symbol))
    .map((p) => p.symbol);
  const [quotes, optMarks, fxMarks] = await Promise.all([
    plainSyms.length ? getQuotes(plainSyms) : Promise.resolve([]),
    optSyms.length ? optionQuotes(optSyms) : Promise.resolve(new Map<string, number>()),
    fxSyms.length ? fxQuotes(fxSyms) : Promise.resolve(new Map<string, { price: number; prevClose: number }>()),
  ]);
  const mark = new Map(quotes.map((q) => [q.symbol, q.price]));
  for (const p of positions) {
    const px = optMarks.get(p.symbol) ?? fxMarks.get(p.symbol)?.price
      ?? mark.get(p.symbol) ?? p.avgEntryPrice;
    const val = p.qty * px * multiplierFor(p.symbol); // signed, contract-scaled
    if (val >= 0) longValue += val; else shortValue += -val;
    initialReq += initialRate(p.symbol) * Math.abs(val);
    maintenance += maintRate(p.symbol) * Math.abs(val);
  }
  const equity = cash + longValue - shortValue;
  const gross = longValue + shortValue;
  // Buying power: extra equity-notional you can still add at the initial rate.
  const buyingPower = Math.max(0, (equity - initialReq) / 0.5);
  return {
    equity, cash, longValue, shortValue, gross, net: longValue - shortValue,
    maintenance, buyingPower, marginUsedPct: equity > 0 ? Math.min(1, initialReq / equity) : 0,
  };
}

export async function cancelOrder(userId: string, orderId: string): Promise<boolean> {
  const [order] = await db.select().from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId)));
  if (!order || order.status !== "accepted") return false;
  await db.update(schema.orders).set({ status: "canceled" }).where(eq(schema.orders.id, orderId));
  return true;
}

/** Re-check resting orders + mark equity. Called on quote refresh / cron. */
export async function reconcile(userId: string) {
  const resting = await db.select().from(schema.orders)
    .where(and(eq(schema.orders.userId, userId), eq(schema.orders.status, "accepted")));

  // Common case — nothing resting — skips all order I/O; just re-mark equity.
  if (resting.length === 0) { await markEquity(userId); return; }

  // Batch every quote first (network), in ONE call, then settle fills in a
  // locked transaction so we never hold the account lock across I/O.
  const open = isUSMarketOpen();
  const tradable = resting.filter((o) => venueOpenFor(o.symbol));
  const quotes = await getQuotes([...new Set(tradable.map((o) => o.symbol))]);
  const bySymbol = new Map(quotes.map((qt) => [qt.symbol, qt.price]));
  const priced: Array<{ order: PlacedOrder; price: number }> = [];
  for (const order of tradable) {
    const price = bySymbol.get(order.symbol);
    if (price != null) priced.push({ order, price });
  }

  if (priced.length) {
    await db.transaction(async (tx) => {
      // Lock + re-read so a concurrent placeOrder can't fill the same order twice.
      await tx.select().from(schema.accounts).where(eq(schema.accounts.userId, userId)).for("update");
      for (const { order, price } of priced) {
        const [fresh] = await tx.select().from(schema.orders).where(eq(schema.orders.id, order.id));
        if (fresh && fresh.status === "accepted") await tryFill(tx, fresh, price);
      }
    });
  }

  await markEquity(userId);
}

/** Mark account equity to current quotes; roll the day anchor when it changes. */
export async function markEquity(userId: string) {
  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  if (!account) return;
  const positions = await db.select().from(schema.positions)
    .where(eq(schema.positions.userId, userId));

  let value = 0;
  if (positions.length) {
    // Options price from the chain, everything else from the tape.
    const opts = positions.filter((p) => isOptionSymbol(p.symbol)).map((p) => p.symbol);
    const fx = positions.filter((p) => isFxSymbol(p.symbol)).map((p) => p.symbol);
    const plain = positions
      .filter((p) => !isOptionSymbol(p.symbol) && !isFxSymbol(p.symbol))
      .map((p) => p.symbol);
    const [quotes, optMarks, fxMarks] = await Promise.all([
      plain.length ? getQuotes(plain) : Promise.resolve([]),
      opts.length ? optionQuotes(opts) : Promise.resolve(new Map<string, number>()),
      fx.length ? fxQuotes(fx) : Promise.resolve(new Map<string, { price: number; prevClose: number }>()),
    ]);
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q.price]));
    for (const p of positions) {
      const mark = optMarks.get(p.symbol) ?? fxMarks.get(p.symbol)?.price
        ?? bySymbol.get(p.symbol);
      if (mark == null) {
        /*
          No mark means we do not know this position's value right now. Falling
          back to entry price would report unrealized P&L of exactly $0.00 —
          and because this function PERSISTS equity and appends to the equity
          curve, that fiction would be written permanently into Sharpe,
          drawdown and CAGR, where recovery never removes it. So we abandon the
          whole pass: a stale equity number is honest, a fabricated one isn't.
          (settleExpiredOptions already refuses to settle without a mark.)
        */
        return;
      }
      value += mark * p.qty * multiplierFor(p.symbol);
    }
  }
  const equity = account.cash + value;
  const today = etDay();
  const rolled = account.dayStamp !== today;

  await db.update(schema.accounts).set({
    equity,
    dayStartEquity: rolled ? equity : account.dayStartEquity,
    dayStamp: today,
  }).where(eq(schema.accounts.userId, userId));

  // Append to the equity curve at most once per minute.
  const [last] = await db.select().from(schema.equityHistory)
    .where(eq(schema.equityHistory.userId, userId))
    .orderBy(desc(schema.equityHistory.time)).limit(1);
  if (!last || Date.now() - last.time > 60_000) {
    await db.insert(schema.equityHistory)
      .values({ id: randomUUID(), userId, time: Date.now(), equity });
  }
}

/*
  Expiry settlement — the step that makes options honest.

  At expiry a contract stops existing: in-the-money it settles for its
  intrinsic value (cash-settled here rather than delivering 100 shares, which
  keeps a $100k simulated account from being blown up by an assignment it
  never chose), out-of-the-money it expires worthless. Either way the position
  is closed and journaled, so the trade shows up in the record like any other.

  Called from the heartbeat, so it happens whether or not anyone is watching.
*/
export async function settleExpiredOptions(userId: string): Promise<number> {
  const positions = await db.select().from(schema.positions)
    .where(eq(schema.positions.userId, userId));
  const expired = positions
    .map((p) => ({ p, leg: parseOptionSymbol(p.symbol) }))
    .filter((x) => x.leg && new Date(`${x.leg.expiry}T20:00:00Z`).getTime() < Date.now());
  if (!expired.length) return 0;

  // Underlying marks decide intrinsic value.
  const unders = [...new Set(expired.map((x) => x.leg!.underlying))];
  const quotes = await getQuotes(unders);
  const spot = new Map(quotes.map((q) => [q.symbol, q.price]));
  const now = Date.now();
  let settled = 0;

  for (const { p, leg } of expired) {
    const under = spot.get(leg!.underlying);
    // No mark for the underlying? Leave it for the next pass rather than
    // settling at a number we can't stand behind.
    if (under == null) continue;

    const intrinsic = leg!.type === "call"
      ? Math.max(0, under - leg!.strike)
      : Math.max(0, leg!.strike - under);
    const proceeds = intrinsic * p.qty * CONTRACT_SIZE;
    const pnl = (intrinsic - p.avgEntryPrice) * p.qty * CONTRACT_SIZE;

    await db.transaction(async (tx) => {
      const [acct] = await tx.select().from(schema.accounts)
        .where(eq(schema.accounts.userId, userId)).for("update");
      if (!acct) return;
      await tx.update(schema.accounts)
        .set({ cash: acct.cash + proceeds })
        .where(eq(schema.accounts.userId, userId));
      await tx.insert(schema.journalEntries).values({
        id: randomUUID(), userId, symbol: p.symbol,
        side: intrinsic > 0 ? "exercised" : "expired",
        qty: Math.abs(p.qty),
        entryPrice: p.avgEntryPrice, exitPrice: intrinsic, pnl,
        thesis: intrinsic > 0
          ? `Expired in the money — settled at $${intrinsic.toFixed(2)} intrinsic.`
          : "Expired worthless. The premium was the whole risk.",
        agentId: null, createdAt: now,
      });
      await tx.delete(schema.positions).where(eq(schema.positions.id, p.id));
    });
    settled++;
  }
  return settled;
}

/** Settle expired options for every account holding one. Heartbeat entry point. */
export async function settleAllExpiredOptions(): Promise<number> {
  // Only users who actually hold an option get looked at.
  const holders = await db.selectDistinct({ userId: schema.positions.userId })
    .from(schema.positions);
  let total = 0;
  for (const h of holders) {
    try { total += await settleExpiredOptions(h.userId); }
    catch { /* one account's failure must not stop the sweep */ }
  }
  return total;
}
