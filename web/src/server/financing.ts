import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { and, eq, gte } from "drizzle-orm";
import { getQuotes } from "./market";
import { isOptionSymbol } from "./options";
import { isFxSymbol } from "./fx";
import { isFuturesSymbol } from "./futures";
import { financingRates, DAYCOUNT, type FinancingRates } from "./rates";
import { notify } from "./notify";

/*
  Daily financing — what holding a position actually costs, and what idle
  cash actually earns.

  Before this, leverage was free: borrow $50k against your book and the
  ledger never noticed. That hides the single most important fact about
  margin — a leveraged position must OUTRUN ITS FINANCING to make money.

  Three accruals, one net cash entry per account per day:
  - Debit interest:  negative cash borrows at fed funds + spread.
  - Borrow fees:     short equity market value pays the GC rate.
  - Cash sweep:      positive cash EARNS fed funds − haircut. The big houses
    sweep client cash at near zero; paying a real rate is the honest
    counterexample this platform exists to be.

  Convention: simple interest, actual/360, accrued once per UTC day on the
  heartbeat. Idempotent the same way dividends are — a journal row of
  side "financing" stamped today means today is done.
*/

/** Pure daily accrual math, exported for tests. Returns signed cash delta. */
export function dailyAccrual(cash: number, shortMarketValue: number, r: FinancingRates): {
  debitInterest: number; borrowFee: number; sweepInterest: number; net: number;
} {
  const debitInterest = cash < 0 ? -(-cash * r.marginLoan) / DAYCOUNT : 0;
  const borrowFee = shortMarketValue > 0 ? -(shortMarketValue * r.borrowGC) / DAYCOUNT : 0;
  const sweepInterest = cash > 0 ? (cash * r.cashSweep) / DAYCOUNT : 0;
  return { debitInterest, borrowFee, sweepInterest, net: debitInterest + borrowFee + sweepInterest };
}

const utcDayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.getTime(); };

export async function accrueFinancingAll(): Promise<{ accounts: number; posted: number }> {
  const rates = await financingRates();
  const accounts = await db.select().from(schema.accounts);
  const dayStart = utcDayStart();
  let posted = 0;

  for (const acct of accounts) {
    try {
      // Today already accrued? One financing row per UTC day, same
      // idempotency shape the dividend engine uses.
      const [done] = await db.select({ id: schema.journalEntries.id })
        .from(schema.journalEntries)
        .where(and(
          eq(schema.journalEntries.userId, acct.userId),
          eq(schema.journalEntries.side, "financing"),
          gte(schema.journalEntries.createdAt, dayStart),
        )).limit(1);
      if (done) continue;

      // Short equity market value — equities/ETFs only: futures margin their
      // own way (no borrow), options here are covered, FX pairs have no
      // borrow desk in this model.
      const positions = await db.select().from(schema.positions)
        .where(eq(schema.positions.userId, acct.userId));
      const shorts = positions.filter((p) => p.qty < 0
        && !isFuturesSymbol(p.symbol) && !isOptionSymbol(p.symbol)
        && !isFxSymbol(p.symbol) && !p.symbol.includes("/"));
      let shortValue = 0;
      if (shorts.length) {
        const quotes = await getQuotes(shorts.map((s) => s.symbol));
        const mark = new Map(quotes.map((q) => [q.symbol, q.price]));
        for (const s of shorts) shortValue += Math.abs(s.qty) * (mark.get(s.symbol) ?? s.avgEntryPrice);
      }

      const a = dailyAccrual(acct.cash, shortValue, rates);
      if (Math.abs(a.net) < 0.01) continue; // nothing worth a ledger row

      await db.update(schema.accounts)
        .set({ cash: acct.cash + a.net })
        .where(eq(schema.accounts.userId, acct.userId));

      const parts = [
        a.sweepInterest > 0 && `+$${a.sweepInterest.toFixed(2)} interest on idle cash at ${(rates.cashSweep * 100).toFixed(2)}%`,
        a.debitInterest < 0 && `−$${(-a.debitInterest).toFixed(2)} margin interest at ${(rates.marginLoan * 100).toFixed(2)}%`,
        a.borrowFee < 0 && `−$${(-a.borrowFee).toFixed(2)} stock borrow at ${(rates.borrowGC * 100).toFixed(2)}%`,
      ].filter(Boolean).join(", ");
      await db.insert(schema.journalEntries).values({
        id: randomUUID(), userId: acct.userId,
        symbol: "$CASH", side: "financing", qty: 0,
        entryPrice: 0, exitPrice: null, pnl: a.net,
        thesis: `Daily financing (actual/360, fed funds ${(rates.fedFunds * 100).toFixed(2)}%): ${parts}. `
          + "A leveraged position has to outrun its financing — this is that cost, posted daily.",
        agentId: null, createdAt: Date.now(),
      });
      posted++;

      // A first margin-interest day is worth a heads-up; routine sweep isn't.
      if (a.debitInterest < -1) {
        void notify(acct.userId, "system", "Margin interest accrued",
          { body: `Your debit balance cost $${(-a.debitInterest).toFixed(2)} today at ${(rates.marginLoan * 100).toFixed(2)}%.`, href: "/app/margin" });
      }
    } catch { /* one account's accrual never stops the sweep */ }
  }
  return { accounts: accounts.length, posted };
}

