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

  Concurrency: on SQLite a synchronous transaction serialized everything.
  On Postgres we take a row lock on the user's account (SELECT … FOR UPDATE)
  at the top of every settling transaction, so all of a user's concurrent
  order placement and reconciliation serialize on that one row — N pending
  buys can't collectively overspend and a resting sell can't be double-sold.
  Quote fetches (network) always happen BEFORE the transaction opens, so we
  never hold a row lock across I/O.
*/

const SLIPPAGE = 0.0005;

/** Any drizzle executor — the base db or a transaction handle. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

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

  const reject = async (reason: string): Promise<PlacedOrder> => {
    const row = {
      id, userId, symbol, side: input.side, type: input.type, qty: input.qty,
      limitPrice: input.limitPrice ?? null, stopPrice: input.stopPrice ?? null,
      status: "rejected" as const, filledPrice: null, filledAt: null,
      agentId: input.agentId ?? null, rejectReason: reason, createdAt: now,
    };
    await db.insert(schema.orders).values(row);
    return row;
  };

  if (!Number.isFinite(input.qty) || input.qty <= 0) return reject("Quantity must be positive.");
  // Equities trade in whole shares; only crypto is fractional.
  if (!isCrypto && !Number.isInteger(input.qty)) return reject("Stocks trade in whole shares.");
  if (input.type === "limit" && !(input.limitPrice && input.limitPrice > 0))
    return reject("Limit orders need a limit price.");
  if (input.type === "stop" && !(input.stopPrice && input.stopPrice > 0))
    return reject("Stop orders need a stop price.");

  // Fetch the quote BEFORE the transaction — never hold a lock across network.
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

    if (input.side === "sell") {
      const [pos] = await tx.select().from(schema.positions)
        .where(and(eq(schema.positions.userId, userId), eq(schema.positions.symbol, symbol)));
      const lockedForSale = resting
        .filter((o) => o.side === "sell" && o.symbol === symbol)
        .reduce((s, o) => s + o.qty, 0);
      const available = (pos?.qty ?? 0) - lockedForSale;
      if (available < input.qty) {
        return rejectIn("You can't sell more than you hold (some may be committed to resting orders).");
      }
    } else {
      const estPrice = input.type === "limit" ? input.limitPrice! : quote.price * (1 + SLIPPAGE);
      const reservedByResting = resting
        .filter((o) => o.side === "buy")
        .reduce((s, o) => s + (o.limitPrice ?? o.stopPrice ?? quote.price * (1 + SLIPPAGE)) * o.qty, 0);
      const available = (account?.cash ?? 0) - reservedByResting;
      if (available < estPrice * input.qty) {
        return rejectIn("This order exceeds your buying power (some is committed to resting orders).");
      }
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
  }
  if (fillPrice == null) return null;

  await settle(tx, order, fillPrice);
  const patch = { status: "filled" as const, filledPrice: fillPrice, filledAt: Date.now() };
  await tx.update(schema.orders).set(patch).where(eq(schema.orders.id, order.id));
  return patch;
}

/** Apply a fill to cash + positions + journal. The only money mutation path. */
async function settle(tx: Tx, order: PlacedOrder, fillPrice: number) {
  const { userId, symbol, qty } = order;
  const [account] = await tx.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));
  if (!account) return;
  const [pos] = await tx.select().from(schema.positions)
    .where(and(eq(schema.positions.userId, userId), eq(schema.positions.symbol, symbol)));
  const now = Date.now();

  if (order.side === "buy") {
    await tx.update(schema.accounts)
      .set({ cash: account.cash - fillPrice * qty })
      .where(eq(schema.accounts.userId, userId));
    if (pos) {
      const newQty = pos.qty + qty;
      const blended = (pos.avgEntryPrice * pos.qty + fillPrice * qty) / newQty;
      await tx.update(schema.positions)
        .set({ qty: newQty, avgEntryPrice: blended, updatedAt: now })
        .where(eq(schema.positions.id, pos.id));
    } else {
      await tx.insert(schema.positions).values({
        id: randomUUID(), userId, symbol, qty, avgEntryPrice: fillPrice, updatedAt: now,
      });
    }
  } else {
    await tx.update(schema.accounts)
      .set({ cash: account.cash + fillPrice * qty })
      .where(eq(schema.accounts.userId, userId));
    if (pos) {
      const remaining = pos.qty - qty;
      // Realized P&L → journal, every close is a learning artifact.
      await tx.insert(schema.journalEntries).values({
        id: randomUUID(), userId, symbol, side: "sell", qty,
        entryPrice: pos.avgEntryPrice, exitPrice: fillPrice,
        pnl: (fillPrice - pos.avgEntryPrice) * qty,
        thesis: null, agentId: order.agentId, createdAt: now,
      });
      if (remaining > 1e-9) {
        await tx.update(schema.positions)
          .set({ qty: remaining, updatedAt: now })
          .where(eq(schema.positions.id, pos.id));
      } else {
        await tx.delete(schema.positions).where(eq(schema.positions.id, pos.id));
      }
    }
  }
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

  // Fetch every quote first (network), then settle any fills in one locked
  // transaction so we don't hold the account lock across I/O.
  const priced: Array<{ order: PlacedOrder; price: number }> = [];
  for (const order of resting) {
    const isCrypto = order.symbol.includes("/");
    if (!isCrypto && !isUSMarketOpen()) continue;
    const quote = await getQuote(order.symbol);
    if (quote) priced.push({ order, price: quote.price });
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
    const quotes = await getQuotes(positions.map((p) => p.symbol));
    const bySymbol = new Map(quotes.map((q) => [q.symbol, q.price]));
    for (const p of positions) {
      value += (bySymbol.get(p.symbol) ?? p.avgEntryPrice) * p.qty;
    }
  }
  const equity = account.cash + value;
  const today = new Date().toISOString().slice(0, 10);
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
