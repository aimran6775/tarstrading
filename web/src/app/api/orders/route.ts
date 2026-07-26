import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { placeOrder, reconcile } from "@/server/exchange";
import { db, schema } from "@/server/db";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const orders = await db.select().from(schema.orders)
    .where(eq(schema.orders.userId, user.id))
    .orderBy(desc(schema.orders.createdAt)).limit(100);
  return NextResponse.json({ ok: true, orders });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request body." }, { status: 400 }); }

  const symbol = String(body.symbol ?? "").toUpperCase().trim();
  // Equity/crypto tickers, or an OCC option contract (AAPL260727C00335000).
  const EQUITY_OR_CRYPTO = /^[A-Z.]{1,8}(\/[A-Z]{3,4})?$/;
  const OCC_OPTION = /^[A-Z]{1,6}\d{6}[CP]\d{8}$/;
  if (!EQUITY_OR_CRYPTO.test(symbol) && !OCC_OPTION.test(symbol)) {
    return NextResponse.json({ ok: false, error: "That doesn't look like a symbol." }, { status: 400 });
  }
  const TYPES = ["market", "limit", "stop", "stop_limit", "trailing_stop"] as const;
  const type = TYPES.includes(body.type as (typeof TYPES)[number]) ? (body.type as (typeof TYPES)[number]) : "market";
  const order = await placeOrder(user.id, {
    symbol,
    side: body.side === "sell" ? "sell" : "buy",
    type,
    qty: Number(body.qty),
    limitPrice: body.limitPrice != null ? Number(body.limitPrice) : undefined,
    stopPrice: body.stopPrice != null ? Number(body.stopPrice) : undefined,
    trailPercent: body.trailPercent != null ? Number(body.trailPercent) : undefined,
  });
  await reconcile(user.id);
  const status = order.status === "rejected" ? 422 : 201;
  return NextResponse.json({ ok: order.status !== "rejected", order }, { status });
}
