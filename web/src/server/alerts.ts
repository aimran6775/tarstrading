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
