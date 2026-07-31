import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, asc, eq } from "drizzle-orm";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { symbol } = await request.json();
  const clean = String(symbol ?? "").toUpperCase().trim();
  if (!/^[A-Z.]{1,8}(\/[A-Z]{3,4})?$/.test(clean)) {
    return NextResponse.json({ ok: false, error: "That doesn't look like a symbol." }, { status: 400 });
  }
  const existing = await db.select().from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.userId, user.id))
    .orderBy(asc(schema.watchlistItems.rank));
  if (existing.some((w) => w.symbol === clean)) {
    return NextResponse.json({ ok: true, watchlist: existing.map((w) => w.symbol) });
  }
  await db.insert(schema.watchlistItems).values({
    id: randomUUID(), userId: user.id, symbol: clean, rank: existing.length,
  });
  return NextResponse.json({ ok: true, watchlist: [...existing.map((w) => w.symbol), clean] });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { symbol } = await request.json();
  await db.delete(schema.watchlistItems).where(and(
    eq(schema.watchlistItems.userId, user.id),
    eq(schema.watchlistItems.symbol, String(symbol ?? "").toUpperCase()),
  ));
  return NextResponse.json({ ok: true });
}

/*
  Reorder (gap 31). The watchlist had a rank column from the start but no way
  to set it — the order was whatever insertion happened to produce, and the
  symbol you check every morning could sit at the bottom forever. The client
  sends the full ordered list; ranks are rewritten to match.
*/
export async function PATCH(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const order = Array.isArray(body.order) ? body.order : null;
  if (!order) return NextResponse.json({ ok: false, error: "Send the ordered symbol list." }, { status: 400 });

  const items = await db.select().from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.userId, user.id));
  const owned = new Set(items.map((i) => i.symbol));
  let rank = 0;
  for (const raw of order) {
    const symbol = String(raw).toUpperCase();
    // Only reorder what the user actually holds — a payload can't add rows.
    if (!owned.has(symbol)) continue;
    await db.update(schema.watchlistItems).set({ rank: rank++ })
      .where(and(eq(schema.watchlistItems.userId, user.id), eq(schema.watchlistItems.symbol, symbol)));
  }
  return NextResponse.json({ ok: true, reordered: rank });
}
