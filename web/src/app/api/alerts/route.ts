import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const alerts = db.select().from(schema.priceAlerts)
    .where(eq(schema.priceAlerts.userId, user.id))
    .orderBy(desc(schema.priceAlerts.createdAt)).all();
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
  if (!/^[A-Z.]{1,8}(\/[A-Z]{3,4})?$/.test(symbol)) {
    return NextResponse.json({ ok: false, error: "That doesn't look like a symbol." }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ ok: false, error: "Set a positive price." }, { status: 400 });
  }
  const row = {
    id: randomUUID(), userId: user.id, symbol, price, direction: direction as "above" | "below",
    triggeredAt: null, createdAt: Date.now(),
  };
  db.insert(schema.priceAlerts).values(row).run();
  return NextResponse.json({ ok: true, alert: row }, { status: 201 });
}
