import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { desc, eq } from "drizzle-orm";

/*
  The journal (gap 30) — the record of every closed trade, assignment,
  expiry, dividend and margin call, each carrying the sentence that explains
  what it taught. This is where the platform's most valuable writing lives,
  and until now it was buried inside one tab of the market-page tray, only
  reachable while looking at some particular symbol.
*/
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const limit = Math.min(500, Math.max(1,
    Number(new URL(request.url).searchParams.get("limit") ?? 200)));
  const entries = await db.select().from(schema.journalEntries)
    .where(eq(schema.journalEntries.userId, user.id))
    .orderBy(desc(schema.journalEntries.createdAt)).limit(limit);

  // Realized P&L totals, split so a lesson-bearing row (dividend, expiry,
  // margin call) isn't confused with a trade the user chose to close.
  const traded = entries.filter((e) => e.side === "sell" || e.side === "cover");
  const realized = traded.reduce((s, e) => s + (e.pnl ?? 0), 0);
  const wins = traded.filter((e) => (e.pnl ?? 0) > 0).length;

  return NextResponse.json({
    ok: true,
    entries,
    summary: {
      trades: traded.length,
      realized,
      winRate: traded.length ? wins / traded.length : null,
      events: entries.length - traded.length,
    },
  });
}
