import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";

/*
  The practice streak, server-side. It followed you nowhere when it lived in
  localStorage; now it follows the account. Bumping is idempotent within a
  calendar day (UTC): practice twice today, the streak counts once. Miss a day
  and it resets to 1 on the next visit.
*/

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const [row] = await db.select().from(schema.practiceStreaks)
    .where(eq(schema.practiceStreaks.userId, user.id));
  return NextResponse.json({ ok: true, current: row?.current ?? 0, longest: row?.longest ?? 0 });
}

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const now = Date.now();
  const today = dayOf(now);
  const yesterday = dayOf(now - 86_400_000);

  const [row] = await db.select().from(schema.practiceStreaks)
    .where(eq(schema.practiceStreaks.userId, user.id));

  if (row?.day === today) {
    return NextResponse.json({ ok: true, current: row.current, longest: row.longest });
  }

  const current = row && row.day === yesterday ? row.current + 1 : 1;
  const longest = Math.max(row?.longest ?? 0, current);

  if (row) {
    await db.update(schema.practiceStreaks)
      .set({ day: today, current, longest, updatedAt: now })
      .where(eq(schema.practiceStreaks.userId, user.id));
  } else {
    await db.insert(schema.practiceStreaks)
      .values({ userId: user.id, day: today, current, longest, updatedAt: now });
  }

  return NextResponse.json({ ok: true, current, longest });
}
