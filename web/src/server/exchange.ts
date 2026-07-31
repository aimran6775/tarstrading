import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { and, eq, desc } from "drizzle-orm";
import { getQuote, getQuotes, isUSMarketOpen, etDay } from "./market";
import { getPlatformConfig } from "./platform";
import { isOptionSymbol, parseOptionSymbol, optionQuotes, CONTRACT_SIZE } from "./options";
import { isFxSymbol, isFxOpen, fxQuotes, toUsd, usdRateMap } from "./fx";
import { isFuturesSymbol, futuresSpec, futuresMarks, isFuturesOpen, pickLiquidations, isExpired } from "./futures";
import { portfolioMargin, type SpanBreakdown } from "./span";
import { notify } from "./notify";
import { commissionFor, slippageFor } from "./costs";

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

/* Slippage and commissions live in ./costs — size-aware, per asset class
   (gaps 6 and 9). This constant remains only as the floor used when no
   volume profile is available. */
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
/* A SHORT option's requirement is its collateral, not its premium: the
   covered call is collateralised by the shares (already margined as a
   position) and the cash-secured put by cash. Both are checked at order
   time, so the ongoing requirement here stays the premium's mark. */
/*
  Futures are the exception to rate-based margin entirely: their requirement is
  a fixed DOLLAR amount per contract from the spec sheet (IM to open, MM to
  hold), not a percentage of notional — and no principal ever changes hands.
  Both requirement loops below branch on this.
*/
const futuresIM = (s: string, qty: number) => (futuresSpec(s)?.im ?? Infinity) * Math.abs(qty);
const futuresMM = (s: string, qty: number) => (futuresSpec(s)?.mm ?? Infinity) * Math.abs(qty);
/* FX is a 24/5 venue of its own; crypto never closes; futures run the Globex
   clock; everything else follows the US equity session. */
const venueOpenFor = (s: string) =>
  isCryptoSym(s) ? true
    : isFxSymbol(s) ? isFxOpen()
    : isFuturesSymbol(s) ? isFuturesOpen()
    : isUSMarketOpen();

/** Contract multiplier: options cover 100 shares, futures carry their spec
    multiplier (ES = $50/point), everything else is 1:1. */
export const multiplierFor = (s: string) =>
  isOptionSymbol(s) ? CONTRACT_SIZE : futuresSpec(s)?.multiplier ?? 1;

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
  const isFutures = isFuturesSymbol(symbol);
  if (!Number.isFinite(input.qty) || input.qty <= 0) return reject("Quantity must be positive.");
  // Equities trade in whole shares, options and futures in whole contracts;
  // only crypto is fractional.
  if (!isCrypto && !Number.isInteger(input.qty)) {
    return reject(isOption || isFutures ? "Contracts trade whole." : "Stocks trade in whole shares.");
  }
  if (isFutures && !futuresSpec(symbol)) {
    return reject("That contract has no margin spec on this desk.");
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
  } else if (isFutures) {
    const marks = await futuresMarks([symbol]);
    const px = marks.get(symbol);
    quote = px != null ? { symbol, price: px } : null;
    if (!quote) return reject(`No settlement mark for ${symbol}.`);
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
    /*
      Options writing (gap 7). Naked short options carry genuinely unbounded
      risk, so this desk allows exactly the two COVERED structures that a
      teaching platform should: a covered call (you own 100 shares per
      contract sold) and a cash-secured put (you hold strike × 100 in cash
      per contract). Both have defined, collateralised risk — and they are
      the two strategies most people actually want to learn.
    */
    if (isOption && q1 < -1e-9) {
      const leg = parseOptionSymbol(symbol)!;
      const short = Math.abs(q1);
      if (leg.type === "call") {
        const shares = positions.find((p) => p.symbol === leg.underlying)?.qty ?? 0;
        if (shares < short * CONTRACT_SIZE - 1e-9) {
          return rejectIn(
            `A covered call needs ${short * CONTRACT_SIZE} shares of ${leg.underlying} — you hold ${Math.floor(shares)}. Naked calls carry unlimited risk and aren't offered here.`);
        }
      } else {
        const collateral = leg.strike * CONTRACT_SIZE * short;
        if ((account?.cash ?? 0) < collateral - 1e-9) {
          return rejectIn(
            `A cash-secured put needs $${Math.round(collateral).toLocaleString()} set aside to buy the shares if assigned — you hold $${Math.round(account?.cash ?? 0).toLocaleString()}.`);
        }
      }
    }

    // Mark each symbol: this order's symbol at the live quote, others at cost.
    const markOf = (s: string, avg: number) => (s === symbol ? quote.price : avg);
    /*
      Initial requirement over all positions with the target updated, plus a
      conservative reservation for resting orders (assume they fill).

      Securities margin rate × notional. The futures BOOK margins as a
      PORTFOLIO (SPAN-lite): the whole hypothetical futures book — including
      this order and resting futures orders — goes through portfolioMargin(),
      so a calendar spread or a long-S&P/short-Nasdaq pair is charged what
      the spread risks, not two full outrights. Hedging your book can now
      LOWER the requirement — which is the entire point of a margin desk.
    */
    const securitiesReqOf = (s: string, qty: number, px: number) =>
      initialRate(s) * Math.abs(qty * px) * multiplierFor(s);
    let requirement = 0;
    const futuresBook: { symbol: string; qty: number }[] = [];
    const addLeg = (s: string, qty: number, px: number) => {
      if (isFuturesSymbol(s)) futuresBook.push({ symbol: s, qty });
      else requirement += securitiesReqOf(s, qty, px);
    };
    for (const p of positions) {
      const qty = p.symbol === symbol ? q1 : p.qty;
      addLeg(p.symbol, qty, markOf(p.symbol, p.avgEntryPrice));
    }
    if (!cur && Math.abs(q1) > 1e-9) {
      addLeg(symbol, q1, quote.price);
    }
    for (const o of resting) {
      const px = o.limitPrice ?? o.stopPrice ?? quote.price;
      addLeg(o.symbol, o.qty, px);
    }
    requirement += portfolioMargin(futuresBook).im;
    // Deleveraging (shrinking the target's absolute exposure) is always allowed;
    // otherwise you must hold enough equity to meet the initial requirement.
    const reducing = Math.abs(q1) < Math.abs(q0) - 1e-9;
    if (!reducing && requirement > equity + 1e-6) {
      return rejectIn(isFutures
        ? `Initial margin exceeds your equity: this book would require $${Math.round(requirement).toLocaleString()} against $${Math.round(equity).toLocaleString()}.`
        : "This order exceeds your buying power (Reg-T margin: 2:1 equities, cash on crypto).");
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
async function tryFill(
  tx: Tx, order: PlacedOrder, price: number, avgVolume?: number | null,
): Promise<{ status: "filled"; filledPrice: number; filledAt: number } | null> {
  let fillPrice: number | null = null;
  /*
    Size-aware slippage (gap 9): a flat 5 bps filled 1 share and 50,000
    shares at the same price, which quietly taught that size is free. The
    cost now carries an impact term scaling with participation in a typical
    session's volume; with no volume profile it falls back to the base
    spread rather than inventing a penalty.
  */
  const slipPct = slippageFor(order.symbol, order.qty, price, avgVolume);
  const slip = order.side === "buy" ? 1 + slipPct : 1 - slipPct;

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

  // FX fills need the rate map to convert quote-currency cash into the
  // account's currency; nothing else does, so it's fetched only for pairs.
  const fxRates = isFxSymbol(order.symbol) ? await usdRateMap() : undefined;
  await settle(tx, order, fillPrice, fxRates);
  const patch = { status: "filled" as const, filledPrice: fillPrice, filledAt: Date.now() };
  await tx.update(schema.orders).set(patch).where(eq(schema.orders.id, order.id));
  /*
    Tell the user (gap 28). A resting order that fills at 3am, or an analyst's
    entry while they read a lesson, used to be discoverable only by noticing a
    number had changed. Fire-and-forget so a notice can never roll back a
    settled trade.
  */
  void notify(order.userId, "fill",
    `${order.side === "buy" ? "Bought" : "Sold"} ${order.qty} ${order.symbol.replace(/^(FX|FUT|IDX):/, "")}`,
    {
      body: `Filled at ${fillPrice.toFixed(2)}${order.agentId ? " by one of your analysts" : ""}.`,
      href: `/app/m/${encodeURIComponent(order.symbol)}`,
    });
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

async function settle(tx: Tx, order: PlacedOrder, fillPrice: number, fxRates?: Map<string, number>) {
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

  /*
    Futures move NO principal: a fill posts margin (a requirement, not a
    debit) and cash changes only by realized P&L on whatever exposure the
    fill closed — variation margin at the moment of trade. Everything else
    keeps the buy-debits/sell-credits flow.
  */
  let cashDelta = isFuturesSymbol(symbol) ? r.realized * mult : r.cashFlow * mult;
  /*
    FX cash moves in the pair's QUOTE currency (gap 10) — buying USD/JPY
    spends yen-denominated notional, not dollars. Convert into the account's
    currency so cash and markEquity agree; a missing rate leaves the raw
    number rather than inventing one, and markEquity will decline to persist
    equity until the rate returns.
  */
  if (isFxSymbol(symbol) && fxRates) {
    const converted = toUsd(symbol, cashDelta, fxRates);
    if (converted != null) cashDelta = converted;
  }

  /*
    Commission (gap 6). Every fill used to be free — accidentally right for
    US equities, badly wrong for options ($0.65/contract), futures
    ($2.25/side) and crypto (25 bps). A free futures round-trip teaches that
    scalping ES costs nothing, which is the most expensive lesson a new
    trader can learn wrong. It debits cash and reduces realized P&L, because
    that is what a statement shows.
  */
  const commission = commissionFor(symbol, order.qty, fillPrice * mult);

  await tx.update(schema.accounts)
    .set({ cash: account.cash + cashDelta - commission })
    .where(eq(schema.accounts.userId, userId));

  if (r.closedQty > 0) {
    // Realized P&L → journal, every close/cover is a learning artifact.
    // Net of the commission that closing it actually cost.
    await tx.insert(schema.journalEntries).values({
      id: randomUUID(), userId, symbol,
      side: (pos?.qty ?? 0) > 0 ? "sell" : "cover", qty: r.closedQty,
      entryPrice: pos?.avgEntryPrice ?? 0, exitPrice: fillPrice,
      pnl: r.realized * mult - commission,
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
  /** Total initial requirement across the whole book (securities + SPAN futures). */
  initialReq: number;
  /** SPAN-lite portfolio view of the futures book — credits included. */
  span: SpanBreakdown;
};

export async function accountRisk(userId: string): Promise<AccountRisk> {
  const [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  const positions = await db.select().from(schema.positions).where(eq(schema.positions.userId, userId));
  const cash = account?.cash ?? 0;
  let longValue = 0, shortValue = 0, initialReq = 0, maintenance = 0;
  let futuresPnl = 0, futuresGross = 0, futuresNet = 0;
  const optSyms = positions.filter((p) => isOptionSymbol(p.symbol)).map((p) => p.symbol);
  const fxSyms = positions.filter((p) => isFxSymbol(p.symbol)).map((p) => p.symbol);
  const futSyms = positions.filter((p) => isFuturesSymbol(p.symbol)).map((p) => p.symbol);
  const plainSyms = positions
    .filter((p) => !isOptionSymbol(p.symbol) && !isFxSymbol(p.symbol) && !isFuturesSymbol(p.symbol))
    .map((p) => p.symbol);
  const [quotes, optMarks, fxMarks, futMarks] = await Promise.all([
    plainSyms.length ? getQuotes(plainSyms) : Promise.resolve([]),
    optSyms.length ? optionQuotes(optSyms) : Promise.resolve(new Map<string, number>()),
    fxSyms.length ? fxQuotes(fxSyms) : Promise.resolve(new Map<string, { price: number; prevClose: number }>()),
    futSyms.length ? futuresMarks(futSyms) : Promise.resolve(new Map<string, number>()),
  ]);
  const mark = new Map(quotes.map((q) => [q.symbol, q.price]));
  for (const p of positions) {
    const px = optMarks.get(p.symbol) ?? fxMarks.get(p.symbol)?.price
      ?? futMarks.get(p.symbol) ?? mark.get(p.symbol) ?? p.avgEntryPrice;
    if (isFuturesSymbol(p.symbol)) {
      // Futures: equity carries the unrealized VM, exposure carries the
      // NOTIONAL (a real margin desk counts the whole contract). The
      // requirements come from the SPAN pass below — the BOOK margins as a
      // portfolio, not contract-by-contract.
      const mult = multiplierFor(p.symbol);
      futuresPnl += (px - p.avgEntryPrice) * p.qty * mult;
      futuresGross += Math.abs(p.qty * px * mult);
      futuresNet += p.qty * px * mult;
      continue;
    }
    const val = p.qty * px * multiplierFor(p.symbol); // signed, contract-scaled
    if (val >= 0) longValue += val; else shortValue += -val;
    initialReq += initialRate(p.symbol) * Math.abs(val);
    maintenance += maintRate(p.symbol) * Math.abs(val);
  }
  // The futures book margins as a portfolio (SPAN-lite): spreads and
  // correlated pairs earn their credits here, exactly as at order time.
  const span = portfolioMargin(
    positions.filter((p) => isFuturesSymbol(p.symbol))
      .map((p) => ({ symbol: p.symbol, qty: p.qty })));
  initialReq += span.im;
  maintenance += span.mm;

  const equity = cash + longValue - shortValue + futuresPnl;
  // Gross/net exposure count futures at full notional — leverage the honest way.
  const gross = longValue + shortValue + futuresGross;
  // Buying power: extra equity-notional you can still add at the initial rate.
  const buyingPower = Math.max(0, (equity - initialReq) / 0.5);
  return {
    equity, cash, longValue, shortValue, gross, net: longValue - shortValue + futuresNet,
    maintenance, buyingPower, marginUsedPct: equity > 0 ? Math.min(1, initialReq / equity) : 0,
    initialReq, span,
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
    const futs = positions.filter((p) => isFuturesSymbol(p.symbol)).map((p) => p.symbol);
    const plain = positions
      .filter((p) => !isOptionSymbol(p.symbol) && !isFxSymbol(p.symbol) && !isFuturesSymbol(p.symbol))
      .map((p) => p.symbol);
    const [quotes, optMarks, fxMarks, futMarks, rates] = await Promise.all([
      plain.length ? getQuotes(plain) : Promise.resolve([]),
      opts.length ? optionQuotes(opts) : Promise.resolve(new Map<string, number>()),
      fx.length ? fxQuotes(fx) : Promise.resolve(new Map<string, { price: number; prevClose: number }>()),
      futs.length ? futuresMarks(futs) : Promise.resolve(new Map<string, number>()),
      fx.length ? usdRateMap() : Promise.resolve(new Map<string, number>([["USD", 1]])),
    ]);
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q.price]));
    for (const p of positions) {
      const mark = optMarks.get(p.symbol) ?? fxMarks.get(p.symbol)?.price
        ?? futMarks.get(p.symbol) ?? bySymbol.get(p.symbol);
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
      if (isFuturesSymbol(p.symbol)) {
        // A futures position is worth its UNREALIZED move against the VM
        // basis — the notional never belonged to the account.
        value += (mark - p.avgEntryPrice) * p.qty * multiplierFor(p.symbol);
      } else if (isFxSymbol(p.symbol)) {
        /*
          A currency pair is priced in its QUOTE currency (gap 10): USD/JPY
          at 157 means 157 YEN per dollar, so a 1,000-unit position is worth
          157,000 yen — about $1,000, not $157,000. Summing the raw number
          into a dollar equity overstated 12 of our 17 pairs by the exchange
          rate. settle() converts the cash side identically, so the two stay
          consistent; an unknown rate abandons the pass rather than
          persisting a fiction, exactly as a missing mark does.
        */
        const usd = toUsd(p.symbol, mark * p.qty, rates);
        if (usd == null) return;
        value += usd;
      } else {
        value += mark * p.qty * multiplierFor(p.symbol);
      }
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
    /*
      Signed quantities settle both directions (gap 7): a LONG contract
      receives intrinsic value, a SHORT one pays it — the writer's side of
      assignment, cash-settled. p.qty carries the sign, so one expression
      covers both and the P&L for a written option is premium kept minus
      intrinsic paid.
    */
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
        side: p.qty < 0 ? (intrinsic > 0 ? "assigned" : "expired")
          : (intrinsic > 0 ? "exercised" : "expired"),
        qty: Math.abs(p.qty),
        entryPrice: p.avgEntryPrice, exitPrice: intrinsic, pnl,
        thesis: p.qty < 0
          ? (intrinsic > 0
            ? `Assigned: the contract you wrote finished in the money, so you paid $${intrinsic.toFixed(2)} of intrinsic against the premium you kept. That is the writer's side of the trade.`
            : "The contract you wrote expired worthless — you keep the whole premium. That is the outcome a covered call is built for.")
          : (intrinsic > 0
            ? `Expired in the money — settled at $${intrinsic.toFixed(2)} intrinsic.`
            : "Expired worthless. The premium was the whole risk."),
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

/*
  Variation margin — the futures lifecycle's defining step.

  Once per session, every futures position settles its mark-to-market to CASH:
  cash moves by (settlement − basis) × qty × multiplier, and the basis resets
  to the settlement price — exactly what a real statement does overnight. The
  vm_stamp records the session settled through, so the sweep is idempotent no
  matter how often the heartbeat fires.

  After settling, the margin desk checks maintenance: if account equity has
  fallen below the book's total MM, futures positions liquidate — biggest
  margin consumer first (pickLiquidations, pure and tested) — and every
  forced close is journaled as what it is. The margin call is the lesson;
  hiding it would be the lie.
*/
export async function settleFuturesVM(userId: string): Promise<number> {
  const positions = await db.select().from(schema.positions)
    .where(eq(schema.positions.userId, userId));
  const futs = positions.filter((p) => isFuturesSymbol(p.symbol));
  if (!futs.length) return 0;

  const marks = await futuresMarks(futs.map((p) => p.symbol));
  const today = etDay();
  let settled = 0;

  for (const p of futs) {
    const settle = marks.get(p.symbol);
    if (settle == null || p.vmStamp === today) continue;
    const mult = multiplierFor(p.symbol);
    const vm = (settle - p.avgEntryPrice) * p.qty * mult;
    await db.transaction(async (tx) => {
      const [acct] = await tx.select().from(schema.accounts)
        .where(eq(schema.accounts.userId, userId)).for("update");
      if (!acct) return;
      const [fresh] = await tx.select().from(schema.positions)
        .where(eq(schema.positions.id, p.id));
      if (!fresh || fresh.vmStamp === today) return; // settled concurrently
      await tx.update(schema.accounts).set({ cash: acct.cash + vm })
        .where(eq(schema.accounts.userId, userId));
      await tx.update(schema.positions)
        .set({ avgEntryPrice: settle, vmStamp: today, updatedAt: Date.now() })
        .where(eq(schema.positions.id, p.id));
    });
    settled++;
  }

  settled += await settleExpiredFutures(userId);
  settled += await enforceMaintenance(userId);
  return settled;
}

/*
  Futures expiry (gap 2). A contract stops existing at its last trade date;
  a held position must cash-settle at the final mark, not mark forever
  against a quote row the mesh has stopped refreshing. Because VM already
  swept every session, avgEntryPrice IS the last settlement — so the final
  P&L is (final mark − basis), the same arithmetic as any other session,
  and the position closes with a journal entry naming the roll.
*/
export async function settleExpiredFutures(userId: string): Promise<number> {
  const positions = await db.select().from(schema.positions)
    .where(eq(schema.positions.userId, userId));
  const expired = positions.filter((p) => isFuturesSymbol(p.symbol) && isExpired(p.symbol));
  if (!expired.length) return 0;

  const marks = await futuresMarks(expired.map((p) => p.symbol));
  let done = 0;
  for (const p of expired) {
    const final = marks.get(p.symbol);
    // No final mark? Leave it for the next pass rather than settling at a
    // number we can't stand behind — the same rule markEquity follows.
    if (final == null) continue;
    const mult = multiplierFor(p.symbol);
    const pnl = (final - p.avgEntryPrice) * p.qty * mult;
    await db.transaction(async (tx) => {
      const [acct] = await tx.select().from(schema.accounts)
        .where(eq(schema.accounts.userId, userId)).for("update");
      if (!acct) return;
      await tx.update(schema.accounts).set({ cash: acct.cash + pnl })
        .where(eq(schema.accounts.userId, userId));
      await tx.insert(schema.journalEntries).values({
        id: randomUUID(), userId, symbol: p.symbol,
        side: "expired", qty: Math.abs(p.qty),
        entryPrice: p.avgEntryPrice, exitPrice: final, pnl,
        thesis: "The contract expired. Futures don't roll themselves — a desk that wants continued exposure buys the next month deliberately.",
        agentId: null, createdAt: Date.now(),
      });
      await tx.delete(schema.positions).where(eq(schema.positions.id, p.id));
    });
    await notify(userId, "system", `${p.symbol.replace("FUT:", "")} expired`,
      { body: `Cash-settled at ${final}. Roll to the next month yourself if you still want the exposure.`, href: "/app/floor" });
    done++;
  }
  return done;
}

/*
  The margin call — a STATE, not a guillotine.

  A real desk does not liquidate the instant equity dips below maintenance:
  it issues a call, gives you time to cure it (deposit, or close something
  yourself), and only forces if you don't. Instant liquidation taught the
  wrong lesson AND punished a 30-second dip. So:

    breach → margin_call_at stamped, user notified, nothing sold
    still breached after CURE_MS → forced liquidation, journaled
    cured any time → stamp cleared, notified

  Applies to the WHOLE book (gap 1): equities carry a 25% Reg-T maintenance
  requirement that was previously computed, displayed, and then ignored.
  Futures liquidate by spec MM; equities by Reg-T. Both come through here.
*/
const CURE_MS = 2 * 3600_000; // two hours of live marks to fix it yourself

export async function enforceMaintenance(userId: string): Promise<number> {
  const risk = await accountRisk(userId);
  const [account] = await db.select().from(schema.accounts)
    .where(eq(schema.accounts.userId, userId));
  if (!account) return 0;

  const breached = risk.equity < risk.maintenance - 1e-6;
  if (!breached) {
    if (account.marginCallAt != null) {
      await db.update(schema.accounts).set({ marginCallAt: null })
        .where(eq(schema.accounts.userId, userId));
      await notify(userId, "margin", "Margin call cleared",
        { body: "Your equity is back above the maintenance requirement. Nothing was liquidated.", href: "/app/floor" });
    }
    return 0;
  }

  const shortfall = risk.maintenance - risk.equity;
  const since = account.marginCallAt;
  if (since == null) {
    await db.update(schema.accounts).set({ marginCallAt: Date.now() })
      .where(eq(schema.accounts.userId, userId));
    await notify(userId, "margin", "Margin call",
      {
        body: `Equity ${usdish(risk.equity)} is ${usdish(shortfall)} below your ${usdish(risk.maintenance)} maintenance requirement. Close positions or the desk will do it in two hours.`,
        href: "/app/floor",
      });
    return 0; // the call is the action; the cure window starts now
  }
  if (Date.now() - since < CURE_MS) return 0; // still curable

  // The window closed. Liquidate futures first (spec MM frees the most per
  // order), then equities by position size, until the requirement is met.
  const positions = await db.select().from(schema.positions)
    .where(eq(schema.positions.userId, userId));
  const futs = positions.filter((p) => isFuturesSymbol(p.symbol));
  const toClose = pickLiquidations(futs.map((p) => ({ symbol: p.symbol, qty: p.qty })), shortfall);
  if (!toClose.length) {
    // No futures to sell — take the largest non-futures position instead.
    const biggest = positions
      .filter((p) => !isFuturesSymbol(p.symbol))
      .sort((a, b) => Math.abs(b.qty * b.avgEntryPrice) - Math.abs(a.qty * a.avgEntryPrice))[0];
    if (biggest) toClose.push({ symbol: biggest.symbol, qty: biggest.qty });
  }

  let closed = 0;
  for (const c of toClose) {
    const order = await placeOrder(userId, {
      symbol: c.symbol, side: c.qty > 0 ? "sell" : "buy",
      type: "market", qty: Math.abs(c.qty),
    });
    if (order.status !== "filled") continue;
    await db.insert(schema.journalEntries).values({
      id: randomUUID(), userId, symbol: c.symbol,
      side: "margin-call", qty: Math.abs(c.qty),
      entryPrice: 0, exitPrice: order.filledPrice ?? 0, pnl: 0,
      thesis: `Margin call not cured within two hours: equity sat ${usdish(shortfall)} below maintenance, so the desk closed this position — not you. That is what maintenance margin means.`,
      agentId: null, createdAt: Date.now(),
    }).catch(() => {});
    closed++;
  }
  if (closed) {
    await db.update(schema.accounts).set({ marginCallAt: null })
      .where(eq(schema.accounts.userId, userId));
    await notify(userId, "margin", `Liquidated ${closed} position${closed === 1 ? "" : "s"}`,
      { body: "The margin call went uncured for two hours. The journal explains exactly what was closed and why.", href: "/app/floor" });
  }
  return closed;
}

const usdish = (v: number) => `$${Math.round(v).toLocaleString()}`;

/** Maintenance enforcement for every account — heartbeat entry point.
    Separate from VM so equity-only books are checked too (gap 1). */
export async function enforceAllMaintenance(): Promise<number> {
  const holders = await db.selectDistinct({ userId: schema.positions.userId })
    .from(schema.positions);
  let total = 0;
  for (const h of holders) {
    try { total += await enforceMaintenance(h.userId); }
    catch { /* one account's failure must not stop the sweep */ }
  }
  return total;
}

/** Settle VM for every account holding a futures position. Heartbeat entry. */
export async function settleAllFuturesVM(): Promise<number> {
  const holders = await db.selectDistinct({ userId: schema.positions.userId })
    .from(schema.positions);
  let total = 0;
  for (const h of holders) {
    try { total += await settleFuturesVM(h.userId); }
    catch { /* one account's failure must not stop the sweep */ }
  }
  return total;
}

/*
  Re-check every account holding a resting order.

  reconcile() was only ever reached from a user's own request, so an order
  placed while the market was shut did not fill at the bell — it filled
  whenever its owner next loaded a page, at THAT moment's price. For a product
  teaching execution, the lesson was wrong. The heartbeat now runs it, so the
  market fills your order, not your page visit.
*/
export async function reconcileRestingOrders(): Promise<number> {
  const waiting = await db.selectDistinct({ userId: schema.orders.userId })
    .from(schema.orders).where(eq(schema.orders.status, "accepted"));
  let touched = 0;
  for (const w of waiting) {
    try { await reconcile(w.userId); touched++; }
    catch { /* one account's failure must not stop the sweep */ }
  }
  return touched;
}
