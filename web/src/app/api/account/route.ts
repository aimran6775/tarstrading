import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { reconcile, accountRisk } from "@/server/exchange";
import { db, schema } from "@/server/db";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Reconcile resting orders + mark equity before reporting — the account
  // the user sees is always the account after the market moved.
  await reconcile(user.id);

  const [account] = await db.select().from(schema.accounts)
    .where(eq(schema.accounts.userId, user.id));
  const positions = await db.select().from(schema.positions)
    .where(eq(schema.positions.userId, user.id));
  const watchlist = await db.select().from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.userId, user.id))
    .orderBy(asc(schema.watchlistItems.rank));

  // The margin desk's numbers: buying power, gross/net exposure, margin used.
  const risk = await accountRisk(user.id);

  return NextResponse.json({
    ok: true,
    user: { name: user.name, email: user.email },
    account,
    positions,
    risk,
    watchlist: watchlist.map((w) => w.symbol),
  });
}
