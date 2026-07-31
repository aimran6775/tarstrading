import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/server/db";
import { placeOrder } from "@/server/exchange";
import { commissionFor } from "@/server/costs";

/*
  The safety-critical claim of the Postgres migration: a user's concurrent
  orders can't collectively overspend. On SQLite the synchronous transaction
  gave that for free; on Postgres it comes from SELECT … FOR UPDATE on the
  account row. This fires many buys at once and asserts the invariant holds.

  Integration test — runs against the real Supabase DB, deterministic demo
  market (test/setup.ts unsets MASSIVE_API_KEY). Cleans up its own rows.
*/

async function seedUser(cash: number): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await db.insert(schema.users).values({
    id, email: `conc-${id}@test.local`, name: "Concurrency", passwordHash: "x", createdAt: now,
  });
  await db.insert(schema.accounts).values({
    userId: id, cash, equity: cash, dayStartEquity: cash,
    dayStamp: new Date().toISOString().slice(0, 10), createdAt: now,
  });
  return id;
}

describe("exchange per-user account lock", () => {
  const users: string[] = [];
  afterAll(async () => {
    for (const id of users) {
      await db.delete(schema.journalEntries).where(eq(schema.journalEntries.userId, id));
      await db.delete(schema.positions).where(eq(schema.positions.userId, id));
      await db.delete(schema.orders).where(eq(schema.orders.userId, id));
      await db.delete(schema.accounts).where(eq(schema.accounts.userId, id));
      await db.delete(schema.users).where(eq(schema.users.id, id));
    }
  });

  it("N concurrent buys never overspend the account", async () => {
    const cash = 100_000;
    const userId = await seedUser(cash);
    users.push(userId);

    // Demo BTC ≈ $97k, so 0.6 BTC ≈ $58k — only ONE such buy fits in $100k.
    // Without the row lock, several could read $100k and all settle negative.
    const qty = 0.6;
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        placeOrder(userId, { symbol: "BTC/USD", side: "buy", type: "market", qty })),
    );

    const filled = results.filter((r) => r.status === "filled");
    const [acct] = await db.select().from(schema.accounts).where(eq(schema.accounts.userId, userId));

    // THE invariant: cash is never driven negative by any interleaving.
    expect(acct.cash).toBeGreaterThanOrEqual(0);
    // Exactly one order fits; the rest are rejected for buying power.
    expect(filled.length).toBe(1);
    // Cash is exactly the start minus what actually filled AND the commission
    // that fill cost — crypto pays 25 bps of notional (see server/costs.ts),
    // so a test that ignored fees would now be asserting a fiction.
    const spent = filled.reduce((s, o) => {
      const notional = (o.filledPrice ?? 0) * qty;
      return s + notional + commissionFor("BTC/USD", qty, o.filledPrice ?? 0);
    }, 0);
    expect(Math.round(acct.cash)).toBe(Math.round(cash - spent));
  });

  it("concurrent sells can't oversell a position", async () => {
    const cash = 100_000;
    const userId = await seedUser(cash);
    users.push(userId);

    // Buy 1 BTC, then fire 5 concurrent full sells — only one may execute.
    const buy = await placeOrder(userId, { symbol: "BTC/USD", side: "buy", type: "market", qty: 1 });
    expect(buy.status).toBe("filled");

    const sells = await Promise.all(
      Array.from({ length: 5 }, () =>
        placeOrder(userId, { symbol: "BTC/USD", side: "sell", type: "market", qty: 1 })),
    );
    const soldOk = sells.filter((r) => r.status === "filled");
    const [pos] = await db.select().from(schema.positions).where(eq(schema.positions.userId, userId));

    expect(soldOk.length).toBe(1);              // exactly one sell clears
    expect(pos).toBeUndefined();                // position fully closed, not negative
  });
});
