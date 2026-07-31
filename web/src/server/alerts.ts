import "server-only";
import { db, schema } from "./db";
import { and, eq, isNull } from "drizzle-orm";
import type { Quote } from "./market";

/*
  Price alerts — set a level and a direction; the app watches quotes and fires
  once when price crosses. Checked server-side on the quote poll the terminal
  already runs, so no extra polling. One-shot: a fired alert stays as history.
*/

export type TriggeredAlert = { id: string; symbol: string; price: number; direction: "above" | "below" };

/** Check a user's active alerts against fresh quotes. Marks any that crossed
    and returns them so the caller can notify. */
export async function checkAlerts(userId: string, quotes: Quote[]): Promise<TriggeredAlert[]> {
  const active = await db.select().from(schema.priceAlerts)
    .where(and(eq(schema.priceAlerts.userId, userId), isNull(schema.priceAlerts.triggeredAt)));
  if (!active.length) return [];

  const priceOf = new Map(quotes.map((q) => [q.symbol, q.price]));
  const fired: TriggeredAlert[] = [];
  const now = Date.now();

  for (const a of active) {
    const px = priceOf.get(a.symbol);
    if (px == null) continue;
    const crossed = a.direction === "above" ? px >= a.price : px <= a.price;
    if (crossed) {
      await db.update(schema.priceAlerts).set({ triggeredAt: now }).where(eq(schema.priceAlerts.id, a.id));
      fired.push({ id: a.id, symbol: a.symbol, price: a.price, direction: a.direction });
    }
  }
  return fired;
}

/* ------------------------------------------------------- margin alerts ----

  A price alert warns you about the market. A MARGIN alert warns you about
  yourself — and that is the one worth having, because the market never
  liquidates you: your requirement does.

  Encoded in the same price_alerts table with the reserved symbol "$MARGIN"
  and price = the usage threshold as a fraction (0.8 = 80% of equity
  committed). No migration needed, and the whole existing UI — create,
  list, one-shot firing, history — works unchanged.

  One-shot like every other alert, so a book hovering at the line doesn't
  produce a notification every heartbeat.
*/

export const MARGIN_ALERT_SYMBOL = "$MARGIN";

export function isMarginAlert(symbol: string): boolean {
  return symbol.toUpperCase() === MARGIN_ALERT_SYMBOL;
}

/**
 * Check margin-usage alerts for one user. `used` is marginUsedPct from
 * accountRisk (0–1). Returns the alerts that fired.
 */
export async function checkMarginAlerts(userId: string, used: number): Promise<TriggeredAlert[]> {
  const active = await db.select().from(schema.priceAlerts)
    .where(and(
      eq(schema.priceAlerts.userId, userId),
      eq(schema.priceAlerts.symbol, MARGIN_ALERT_SYMBOL),
      isNull(schema.priceAlerts.triggeredAt),
    ));
  if (!active.length) return [];

  const fired: TriggeredAlert[] = [];
  const now = Date.now();
  for (const a of active) {
    // "above" is the sane default (warn me when usage RISES past this);
    // "below" lets a user watch for their book de-levering back under a line.
    const crossed = a.direction === "above" ? used >= a.price : used <= a.price;
    if (!crossed) continue;
    await db.update(schema.priceAlerts).set({ triggeredAt: now })
      .where(eq(schema.priceAlerts.id, a.id));
    fired.push({ id: a.id, symbol: a.symbol, price: a.price, direction: a.direction });
  }
  return fired;
}
