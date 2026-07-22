import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { findLesson } from "@/lib/academy";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const rows = await db.select().from(schema.lessonProgress)
    .where(eq(schema.lessonProgress.userId, user.id));
  return NextResponse.json({
    ok: true,
    completed: rows.map((r) => r.lessonId),
    xp: rows.reduce((s, r) => s + r.xp, 0),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { lessonId } = await request.json();
  const found = findLesson(String(lessonId ?? ""));
  if (!found) return NextResponse.json({ ok: false, error: "Unknown lesson." }, { status: 404 });

  const [existing] = await db.select().from(schema.lessonProgress)
    .where(and(
      eq(schema.lessonProgress.userId, user.id),
      eq(schema.lessonProgress.lessonId, found.lesson.id),
    ));
  if (!existing) {
    await db.insert(schema.lessonProgress).values({
      id: randomUUID(), userId: user.id, lessonId: found.lesson.id,
      completedAt: Date.now(), xp: found.lesson.xp,
    });
  }
  const rows = await db.select().from(schema.lessonProgress)
    .where(eq(schema.lessonProgress.userId, user.id));
  return NextResponse.json({
    ok: true,
    xp: rows.reduce((s, r) => s + r.xp, 0),
    completed: rows.map((r) => r.lessonId),
  });
}
