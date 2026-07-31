import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const alerts = await db.select().from(schema.priceAlerts)
    .where(eq(schema.priceAlerts.userId, user.id))
    .orderBy(desc(schema.priceAlerts.createdAt));
  return NextResponse.json({ ok: true, alerts });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  const symbol = String(body.symbol ?? "").toUpperCase().trim();
  const price = Number(body.price);
  const direction = body.direction === "below" ? "below" : "above";
  /* Alerts work on every market the board lists (gap 34) — a futures
     contract or a currency pair is exactly the kind of thing you want a
     level on, and the regex was silently refusing them. $MARGIN is the
     reserved symbol for a margin-usage alert, where "price" is the usage
     fraction (0.8 = warn me at 80% of equity committed). */
  if (!/^(\$MARGIN|[A-Z.]{1,8}(\/[A-Z]{3,4})?|FX:[A-Z]{6}|IDX:[A-Z]{1,6}|FUT:[A-Z0-9]{1,3}[FGHJKMNQUVXZ]\d{1,2})$/.test(symbol)) {
    return NextResponse.json({ ok: false, error: "That doesn't look like a symbol." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ ok: false, error: "Set a positive price." }, { status: 400 });
  }
  const row = {
    id: randomUUID(), userId: user.id, symbol, price, direction: direction as "above" | "below",
    triggeredAt: null, createdAt: Date.now(),
  };
  await db.insert(schema.priceAlerts).values(row);
  return NextResponse.json({ ok: true, alert: row }, { status: 201 });
}
