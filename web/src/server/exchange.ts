import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { and, eq, desc } from "drizzle-orm";
import { getQuote, getQuotes, isUSMarketOpen } from "./market";

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
*/

const SLIPPAGE = 0.0005;

export type PlaceOrderInput = {
  symbol: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop";
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
  agentId?: string;
};

export type PlacedOrder = typeof schema.orders.$inferSelect;

export async function placeOrder(userId: string, input: PlaceOrderInput): Promise<PlacedOrder> {
  const symbol = input.symbol.toUpperCase();
  const isCrypto = symbol.includes("/");
  const now = Date.now();
  const id = randomUUID();

  const reject = (reason: string): PlacedOrder => {
    const row = {
      id, userId, symbol, side: input.side, type: input.type, qty: input.qty,
      limitPrice: input.limitPrice ?? null, stopPrice: input.stopPrice ?? null,
      status: "rejected" as const, filledPrice: null, filledAt: null,
      agentId: input.agentId ?? null, rejectReason: reason, createdAt: now,
    };
    db.insert(schema.orders).values(row).run();
    return row;
  };

  if (!Number.isFinite(input.qty) || input.qty <= 0) return reject("Quantity must be positive.");
  // Equities trade in whole shares; only crypto is fractional.
  if (!isCrypto && !Number.isInteger(input.qty)) return reject("Stocks trade in whole shares.");
  if (input.type === "limit" && !(input.limitPrice && input.limitPrice > 0))
    return reject("Limit orders need a limit price.");
  if (input.type === "stop" && !(input.stopPrice && input.stopPrice > 0))
    return reject("Stop orders need a stop price.");

  // The one await: fetch the quote BEFORE the transaction. Everything after is
  // synchronous, so no other request can interleave between check and settle.
  const quote = await getQuote(symbol);
  if (!quote) return reject(`No market data for ${symbol}.`);

  const row = {
    id, userId, symbol, side: input.side, type: input.type, qty: input.qty,
    limitPrice: input.limitPrice ?? null, stopPrice: input.stopPrice ?? null,
    status: "accepted" as const, filledPrice: null as number | null,
    filledAt: null as number | null,
    agentId: input.agentId ?? null, rejectReason: null as string | null, createdAt: now,
  };
  const venueOpen = isCrypto || isUSMarketOpen();

  // Atomic check → insert → (maybe) settle. Accounts for capital and inventory
  // already committed to resting orders, so N pending buys can't collectively
  // overspend and a resting sell can't be double-sold.
  const result = db.transaction((): PlacedOrder => {
    const resting = db.select().from(schema.orders).where(and(
      eq(schema.orders.userId, userId), eq(schema.orders.status, "accepted"))).all();

    if (input.side === "sell") {
      const pos = db.select().from(schema.positions)
        .where(and(eq(schema.positions.userId, userId), eq(schema.positions.symbol, symbol))).get();
      const lockedForSale = resting
        .filter((o) => o.side === "sell" && o.symbol === symbol)
        .reduce((s, o) => s + o.qty, 0);
      const available = (pos?.qty ?? 0) - lockedForSale;
      if (available < input.qty) {
        return rejectIn("You can't sell more than you hold (some may be committed to resting orders).");
      }
    } else {
      const account = db.select().from(schema.accounts)
        .where(eq(schema.accounts.userId, userId)).get();
      const estPrice = input.type === "limit" ? input.limitPrice! : quote.price * (1 + SLIPPAGE);
      const reservedByResting = resting
        .filter((o) => o.side === "buy")
        .reduce((s, o) => s + (o.limitPrice ?? o.stopPrice ?? quote.price * (1 + SLIPPAGE)) * o.qty, 0);
      const available = (account?.cash ?? 0) - reservedByResting;
      if (available < estPrice * input.qty) {
        return rejectIn("This order exceeds your buying power (some is committed to resting orders).");
      }
    }

    db.insert(schema.orders).values(row).run();
    if (venueOpen) {
      const filled = tryFill(row, quote.price);
      if (filled) return { ...row, ...filled };
    }
    return row;
  });

  return result;

  // reject that writes inside the surrounding transaction.
  function rejectIn(reason: string): PlacedOrder {
    const r = { ...row, status: "rejected" as const, rejectReason: reason };
    db.insert(schema.orders).values(r).run();
    return r;
  }
}

/** Attempt to fill an accepted order against a price. Returns fill patch or null. */
function tryFill(order: PlacedOrder, price: number): { status: "filled"; filledPrice: number; filledAt: number } | null {
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
  }
  if (fillPrice == null) return null;

  settle(order, fillPrice);
  const patch = { status: "filled" as const, filledPrice: fillPrice, filledAt: Date.now() };
  db.update(schema.orders).set(patch).where(eq(schema.orders.id, order.id)).run();
  return patch;
}

/** Apply a fill to cash + positions + journal. The only money mutation path. */
function settle(order: PlacedOrder, fillPrice: number) {
  const { userId, symbol, qty } = order;
  const account = db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId)).get();
  if (!account) return;
  const pos = db.select().from(schema.positions)
    .where(and(eq(schema.positions.userId, userId), eq(schema.positions.symbol, symbol))).get();
  const now = Date.now();

  if (order.side === "buy") {
    db.update(schema.accounts)
      .set({ cash: account.cash - fillPrice * qty })
      .where(eq(schema.accounts.userId, userId)).run();
    if (pos) {
      const newQty = pos.qty + qty;
      const blended = (pos.avgEntryPrice * pos.qty + fillPrice * qty) / newQty;
      db.update(schema.positions)
        .set({ qty: newQty, avgEntryPrice: blended, updatedAt: now })
        .where(eq(schema.positions.id, pos.id)).run();
    } else {
      db.insert(schema.positions).values({
        id: randomUUID(), userId, symbol, qty, avgEntryPrice: fillPrice, updatedAt: now,
      }).run();
    }
  } else {
    db.update(schema.accounts)
      .set({ cash: account.cash + fillPrice * qty })
      .where(eq(schema.accounts.userId, userId)).run();
    if (pos) {
      const remaining = pos.qty - qty;
      // Realized P&L → journal, every close is a learning artifact.
      db.insert(schema.journalEntries).values({
        id: randomUUID(), userId, symbol, side: "sell", qty,
        entryPrice: pos.avgEntryPrice, exitPrice: fillPrice,
        pnl: (fillPrice - pos.avgEntryPrice) * qty,
        thesis: null, agentId: order.agentId, createdAt: now,
      }).run();
      if (remaining > 1e-9) {
        db.update(schema.positions)
          .set({ qty: remaining, updatedAt: now })
          .where(eq(schema.positions.id, pos.id)).run();
      } else {
        db.delete(schema.positions).where(eq(schema.positions.id, pos.id)).run();
      }
    }
  }
}

export function cancelOrder(userId: string, orderId: string): boolean {
  const order = db.select().from(schema.orders)
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.userId, userId))).get();
  if (!order || order.status !== "accepted") return false;
  db.update(schema.orders).set({ status: "canceled" }).where(eq(schema.orders.id, orderId)).run();
  return true;
}

/** Re-check resting orders + mark equity. Called on quote refresh / cron. */
export async function reconcile(userId: string) {
  const resting = db.select().from(schema.orders)
    .where(and(eq(schema.orders.userId, userId), eq(schema.orders.status, "accepted"))).all();

  for (const order of resting) {
    const isCrypto = order.symbol.includes("/");
    if (!isCrypto && !isUSMarketOpen()) continue;
    const quote = await getQuote(order.symbol);
    if (quote) tryFill(order, quote.price);
  }

  await markEquity(userId);
}

/** Mark account equity to current quotes; roll the day anchor when it changes. */
export async function markEquity(userId: string) {
  const account = db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId)).get();
  if (!account) return;
  const positions = db.select().from(schema.positions)
    .where(eq(schema.positions.userId, userId)).all();

  let value = 0;
  if (positions.length) {
    const quotes = await getQuotes(positions.map((p) => p.symbol));
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q.price]));
    for (const p of positions) {
      value += (bySymbol.get(p.symbol) ?? p.avgEntryPrice) * p.qty;
    }
  }
  const equity = account.cash + value;
  const today = new Date().toISOString().slice(0, 10);
  const rolled = account.dayStamp !== today;

  db.update(schema.accounts).set({
    equity,
    dayStartEquity: rolled ? equity : account.dayStartEquity,
    dayStamp: today,
  }).where(eq(schema.accounts.userId, userId)).run();

  // Append to the equity curve at most once per minute.
  const last = db.select().from(schema.equityHistory)
    .where(eq(schema.equityHistory.userId, userId))
    .orderBy(desc(schema.equityHistory.time)).limit(1).get();
  if (!last || Date.now() - last.time > 60_000) {
    db.insert(schema.equityHistory)
      .values({ id: randomUUID(), userId, time: Date.now(), equity }).run();
  }
}
