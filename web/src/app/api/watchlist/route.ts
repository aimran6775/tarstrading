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
  const existing = db.select().from(schema.watchlistItems)
    .where(eq(schema.watchlistItems.userId, user.id))
    .orderBy(asc(schema.watchlistItems.rank)).all();
  if (existing.some((w) => w.symbol === clean)) {
    return NextResponse.json({ ok: true, watchlist: existing.map((w) => w.symbol) });
  }
  db.insert(schema.watchlistItems).values({
    id: randomUUID(), userId: user.id, symbol: clean, rank: existing.length,
  }).run();
  return NextResponse.json({ ok: true, watchlist: [...existing.map((w) => w.symbol), clean] });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { symbol } = await request.json();
  db.delete(schema.watchlistItems).where(and(
    eq(schema.watchlistItems.userId, user.id),
    eq(schema.watchlistItems.symbol, String(symbol ?? "").toUpperCase()),
  )).run();
  return NextResponse.json({ ok: true });
}
