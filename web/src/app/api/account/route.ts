import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { reconcile } from "@/server/exchange";
import { db, schema } from "@/server/db";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Reconcile resting orders + mark equity before reporting — the account
  // the user sees is always the account after the market moved.
  await reconcile(user.id);

  const account = db.select().from(schema.accounts)
    .where(eq(schema.accounts.userId, user.id)).get();
  const positions = db.select().from(schema.positions)
    .where(eq(schema.positions.userId, user.id)).all();
  const watchlist = db.select().from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.userId, user.id))
    .orderBy(asc(schema.watchlistItems.rank)).all();

  return NextResponse.json({
    ok: true,
    user: { name: user.name, email: user.email },
    account,
    positions,
    watchlist: watchlist.map((w) => w.symbol),
  });
}
