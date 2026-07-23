import { NextResponse } from "next/server";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { schedule, type Review } from "@/lib/academy/srs";

/*
  Spaced-repetition state for the practice deck. GET returns the learner's
  schedule so the client can surface due cards first; POST records one recall
  result and advances that card's Leitner box.
*/

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const rows = await db.select().from(schema.cardReviews)
    .where(eq(schema.cardReviews.userId, user.id));
  return NextResponse.json({
    ok: true,
    reviews: rows.map((r) => ({ cardKey: r.cardKey, box: r.box, dueAt: r.dueAt, reps: r.reps, lapses: r.lapses })),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const cardKey = String(body?.cardKey ?? "");
  if (!cardKey) return NextResponse.json({ ok: false, error: "Missing cardKey." }, { status: 400 });
  const got = Boolean(body?.got);

  const now = Date.now();
  const [existing] = await db.select().from(schema.cardReviews)
    .where(and(eq(schema.cardReviews.userId, user.id), eq(schema.cardReviews.cardKey, cardKey)));
  const prev: Review | null = existing
    ? { box: existing.box, dueAt: existing.dueAt, reps: existing.reps, lapses: existing.lapses }
    : null;

  const next = schedule(prev, got, now);

  if (existing) {
    await db.update(schema.cardReviews)
      .set({ box: next.box, dueAt: next.dueAt, reps: next.reps, lapses: next.lapses, updatedAt: now })
      .where(and(eq(schema.cardReviews.userId, user.id), eq(schema.cardReviews.cardKey, cardKey)));
  } else {
    await db.insert(schema.cardReviews).values({
      userId: user.id, cardKey, box: next.box, dueAt: next.dueAt,
      reps: next.reps, lapses: next.lapses, updatedAt: now,
    });
  }

  return NextResponse.json({ ok: true, box: next.box, dueAt: next.dueAt });
}
