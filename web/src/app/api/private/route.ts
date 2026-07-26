import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { commitToFund, privatePortfolio } from "@/server/private-markets";

/*
  The allocator's desk: which funds are open, what you've committed, and the
  cash-flow record behind the metrics.

  API-first like the rest of the control plane — the same shape a native
  iOS/Android client would consume.
*/
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const [funds, portfolio, account] = await Promise.all([
    db.select().from(schema.peFunds).where(eq(schema.peFunds.enabled, 1)),
    privatePortfolio(user.id),
    db.select().from(schema.accounts).where(eq(schema.accounts.userId, user.id)),
  ]);

  return NextResponse.json({
    ok: true,
    funds: funds.sort((a, b) => a.name.localeCompare(b.name)),
    ...portfolio,
    cash: account[0]?.cash ?? 0,
    equity: account[0]?.equity ?? 0,
  });
}

/** Commit capital to a fund. No cash moves here — calls come later. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const fundId = String(body.fundId ?? "");
  const amount = Number(body.amount);
  if (!fundId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "A fund and an amount are required." }, { status: 400 });
  }

  const result = await commitToFund(user.id, fundId, amount);
  if (!result.ok) return NextResponse.json(result, { status: 422 });
  return NextResponse.json({ ok: true, commitmentId: result.commitmentId }, { status: 201 });
}
