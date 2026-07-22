import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { asc, desc, eq } from "drizzle-orm";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const history = db.select().from(schema.equityHistory)
    .where(eq(schema.equityHistory.userId, user.id))
    .orderBy(asc(schema.equityHistory.time)).limit(5000).all();
  const journal = db.select().from(schema.journalEntries)
    .where(eq(schema.journalEntries.userId, user.id))
    .orderBy(desc(schema.journalEntries.createdAt)).limit(20).all();

  return NextResponse.json({
    ok: true,
    history: history.map((h) => ({ time: h.time, equity: h.equity })),
    journal,
  });
}
