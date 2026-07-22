import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { placeOrder, reconcile } from "@/server/exchange";
import { db, schema } from "@/server/db";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const orders = db.select().from(schema.orders)
    .where(eq(schema.orders.userId, user.id))
    .orderBy(desc(schema.orders.createdAt)).limit(100).all();
  return NextResponse.json({ ok: true, orders });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request body." }, { status: 400 }); }

  const symbol = String(body.symbol ?? "").toUpperCase().trim();
  if (!/^[A-Z.]{1,8}(\/[A-Z]{3,4})?$/.test(symbol)) {
    return NextResponse.json({ ok: false, error: "That doesn't look like a symbol." }, { status: 400 });
  }
  const order = await placeOrder(user.id, {
    symbol,
    side: body.side === "sell" ? "sell" : "buy",
    type: ["market", "limit", "stop"].includes(body.type as string) ? (body.type as "market" | "limit" | "stop") : "market",
    qty: Number(body.qty),
    limitPrice: body.limitPrice != null ? Number(body.limitPrice) : undefined,
    stopPrice: body.stopPrice != null ? Number(body.stopPrice) : undefined,
  });
  await reconcile(user.id);
  const status = order.status === "rejected" ? 422 : 201;
  return NextResponse.json({ ok: order.status !== "rejected", order }, { status });
}
