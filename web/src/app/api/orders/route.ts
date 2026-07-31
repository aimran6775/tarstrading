import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { placeOrder, reconcile } from "@/server/exchange";
import { db, schema } from "@/server/db";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  /* 100 rows was a hard ceiling with no way past it (gap 29) — a week of
     active trading buried everything older. 500 covers a real history and
     the tray filters client-side over it. */
  const orders = await db.select().from(schema.orders)
    .where(eq(schema.orders.userId, user.id))
    .orderBy(desc(schema.orders.createdAt)).limit(500);
  return NextResponse.json({ ok: true, orders });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Bad request body." }, { status: 400 }); }

  const symbol = String(body.symbol ?? "").toUpperCase().trim();
  // Equity/crypto tickers, an OCC option contract (AAPL260727C00335000), an FX
  // pair, or a futures outright (FUT:ESU6 / FUT:NGU26). Indices stay quote-only.
  const EQUITY_OR_CRYPTO = /^[A-Z.]{1,8}(\/[A-Z]{3,4})?$/;
  const OCC_OPTION = /^[A-Z]{1,6}\d{6}[CP]\d{8}$/;
  const FX_PAIR = /^FX:[A-Z]{6}$/;
  const FUTURES = /^FUT:[A-Z0-9]{1,3}[FGHJKMNQUVXZ]\d{1,2}$/;
  if (!EQUITY_OR_CRYPTO.test(symbol) && !OCC_OPTION.test(symbol) && !FX_PAIR.test(symbol) && !FUTURES.test(symbol)) {
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
