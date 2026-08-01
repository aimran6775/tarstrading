import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { asc, eq } from "drizzle-orm";
import { recentNotifications } from "@/server/notify";
import { accountRisk } from "@/server/exchange";
import { financingRates } from "@/server/rates";

/*
  Cold start in ONE round trip. A native app opening to five sequential
  fetches feels like a webview; opening to everything-at-once feels like an
  instrument. Identity, the account with its full risk picture, watchlist,
  positions, and the unread count — one request, one paint.

  The board deliberately isn't here: it's a bigger payload with its own 15s
  server cache, and the markets tab fetches it the moment it appears. This
  endpoint is what the FIRST screen needs, nothing more.
*/
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const [risk, rates, watchlist, positions, notif] = await Promise.all([
    accountRisk(user.id),
    financingRates(),
    db.select().from(schema.watchlistItems)
      .where(eq(schema.watchlistItems.userId, user.id))
      .orderBy(asc(schema.watchlistItems.rank)),
    db.select().from(schema.positions).where(eq(schema.positions.userId, user.id)),
    recentNotifications(user.id),
  ]);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, fundName: user.fundName },
    risk,
    rates,
    watchlist: watchlist.map((w) => w.symbol),
    positions: positions.map((p) => ({
      id: p.id, symbol: p.symbol, qty: p.qty, avgEntryPrice: p.avgEntryPrice,
    })),
    unreadNotifications: notif.unread,
    serverTime: Date.now(),
  });
}
