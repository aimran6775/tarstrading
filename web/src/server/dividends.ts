import "server-only";
import { randomUUID } from "crypto";
import { db, schema } from "./db";
import { and, eq, gte, sql as dsql } from "drizzle-orm";
import { notify } from "./notify";

/*
  Dividends (gap 8).

  The board carries 220 Income instruments — preferreds, closed-end funds,
  bond ETFs — bought for the payments they make. Every one of them yielded
  exactly 0.00%, because dividends were never credited at all. On the
  section built to teach income investing, that isn't a rounding error; it
  is the entire lesson, missing.

  Source: Alpaca's corporate-actions API, free on our tier. We credit cash
  on the PAY date for whoever held on the ex-date, which is the mechanic
  that matters: buy after the ex-date and you don't get paid, and the price
  gaps down by roughly the dividend on that morning. The bar vault is
  split-adjusted already, so the price side is handled; this adds the cash.

  Idempotency: journal entries keyed by symbol + pay date, checked before
  insert, so re-running the sweep never double-pays.
*/

const DATA = "https://data.alpaca.markets";
const KEY = process.env.ALPACA_KEY_ID ?? "";
const SECRET = process.env.ALPACA_SECRET_KEY ?? "";

type CashDividend = {
  symbol: string;
  ex_date: string;
  payable_date?: string;
  rate: number;
};

/** Cash dividends with ex-dates in the window, for the symbols given. */
export async function fetchDividends(symbols: string[], sinceIso: string, untilIso: string) {
  if (!KEY || !SECRET || !symbols.length) return [] as CashDividend[];
  const out: CashDividend[] = [];
  for (let i = 0; i < symbols.length; i += 100) {
    const qs = new URLSearchParams({
      symbols: symbols.slice(i, i + 100).join(","),
      types: "cash_dividend",
      start: sinceIso, end: untilIso, limit: "1000",
    });
    try {
      const res = await fetch(`${DATA}/v1/corporate-actions?${qs}`, {
        headers: {
          "APCA-API-KEY-ID": KEY, "APCA-API-SECRET-KEY": SECRET,
          accept: "application/json",
        },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = await res.json() as {
        corporate_actions?: { cash_dividends?: CashDividend[] };
      };
      out.push(...(json.corporate_actions?.cash_dividends ?? []));
    } catch { /* one page's failure never sinks the sweep */ }
  }
  return out;
}

/**
 * Credit dividends for every holder. Runs on the heartbeat; cheap because
 * it only looks at symbols someone actually holds, over a short window.
 */
export async function creditDividends(): Promise<number> {
  const held = await db.selectDistinct({ symbol: schema.positions.symbol })
    .from(schema.positions);
  // Only plain equities/ETFs pay cash dividends here.
  const symbols = held.map((h) => h.symbol)
    .filter((s) => /^[A-Z.]{1,8}$/.test(s));
  if (!symbols.length) return 0;

  const day = 86_400_000;
  const since = new Date(Date.now() - 10 * day).toISOString().slice(0, 10);
  const until = new Date(Date.now() + day).toISOString().slice(0, 10);
  const divs = await fetchDividends(symbols, since, until);
  if (!divs.length) return 0;

  let paid = 0;
  for (const d of divs) {
    const payDate = d.payable_date ?? d.ex_date;
    // Only pay on/after the payable date.
    if (Date.parse(`${payDate}T12:00:00Z`) > Date.now()) continue;
    const exMs = Date.parse(`${d.ex_date}T00:00:00Z`);

    // Everyone holding this symbol — the position must predate the ex-date.
    const holders = await db.select().from(schema.positions)
      .where(and(eq(schema.positions.symbol, d.symbol), dsql`qty > 0`));
    for (const p of holders) {
      if (p.updatedAt >= exMs) continue; // bought on/after ex — no payment
      const amount = d.rate * p.qty;
      if (!(amount > 0)) continue;

      // Idempotency: has this symbol+payDate already been journaled here?
      const [dupe] = await db.select({ id: schema.journalEntries.id })
        .from(schema.journalEntries)
        .where(and(
          eq(schema.journalEntries.userId, p.userId),
          eq(schema.journalEntries.symbol, d.symbol),
          eq(schema.journalEntries.side, "dividend"),
          gte(schema.journalEntries.createdAt, Date.parse(`${payDate}T00:00:00Z`)),
        )).limit(1);
      if (dupe) continue;

      await db.transaction(async (tx) => {
        const [acct] = await tx.select().from(schema.accounts)
          .where(eq(schema.accounts.userId, p.userId)).for("update");
        if (!acct) return;
        await tx.update(schema.accounts).set({ cash: acct.cash + amount })
          .where(eq(schema.accounts.userId, p.userId));
        await tx.insert(schema.journalEntries).values({
          id: randomUUID(), userId: p.userId, symbol: d.symbol,
          side: "dividend", qty: p.qty,
          entryPrice: d.rate, exitPrice: d.rate, pnl: amount,
          thesis: `Cash dividend of $${d.rate.toFixed(4)} a share, ex-date ${d.ex_date}. You held through the ex-date, so you were paid — and the price gapped down by roughly this much that morning. That gap is why the dividend isn't free money.`,
          agentId: null, createdAt: Date.now(),
        });
      });
      await notify(p.userId, "system", `${d.symbol} paid a dividend`,
        { body: `$${amount.toFixed(2)} credited — $${d.rate.toFixed(4)} a share on ${Math.floor(p.qty)} shares.`, href: "/app/floor" });
      paid++;
    }
  }
  return paid;
}
