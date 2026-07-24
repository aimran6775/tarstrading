import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { and, eq } from "drizzle-orm";
import { findLesson } from "@/lib/academy";
import { getAcademyProgress } from "@/server/academy-progress";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const p = await getAcademyProgress(user.id);
  return NextResponse.json({ ok: true, completed: p.completed, xp: p.xp });
}

type SubmittedAnswer = { choice: number; tries?: number };

/*
  Completing a lesson is EARNED, not asserted. The client sends its answers;
  the server re-grades them against the real quiz keys (which it holds via
  findLesson) and only banks XP when every check passes. A stray POST — or a
  wrong-answer submission — is refused. Every submission is logged so we can
  see which checks trip people up.
*/
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const found = findLesson(String(body?.lessonId ?? ""));
  if (!found) return NextResponse.json({ ok: false, error: "Unknown lesson." }, { status: 404 });

  const quizzes = found.lesson.sections.filter((s) => s.kind === "quiz") as
    Extract<(typeof found.lesson.sections)[number], { kind: "quiz" }>[];
  const answers: SubmittedAnswer[] = Array.isArray(body?.answers) ? body.answers : [];

  // Re-grade server-side. The client never gets to assert "I passed".
  const graded = quizzes.map((q, i) => {
    const a = answers[i];
    const choice = typeof a?.choice === "number" ? a.choice : -1;
    return { i, choice, correct: choice === q.answer, tries: Math.max(1, Number(a?.tries) || 1) };
  });
  const passed = graded.every((g) => g.correct);

  // Log every check, pass or fail — this is the struggle signal.
  const now = Date.now();
  if (graded.length > 0) {
    await db.insert(schema.quizAttempts).values(
      graded.map((g) => ({
        id: randomUUID(), userId: user.id, lessonId: found.lesson.id,
        quizIndex: g.i, choice: g.choice, correct: g.correct ? 1 : 0,
        tries: g.tries, createdAt: now,
      })),
    );
  }

  if (!passed) {
    return NextResponse.json({ ok: false, passed: false, error: "Not all checks passed." }, { status: 200 });
  }

  const [existing] = await db.select().from(schema.lessonProgress)
    .where(and(
      eq(schema.lessonProgress.userId, user.id),
      eq(schema.lessonProgress.lessonId, found.lesson.id),
    ));
  if (!existing) {
    // onConflictDoNothing + the (userId, lessonId) unique index makes a
    // double-submit idempotent — no double-banked XP under a race.
    await db.insert(schema.lessonProgress).values({
      id: randomUUID(), userId: user.id, lessonId: found.lesson.id,
      completedAt: now, xp: found.lesson.xp,
    }).onConflictDoNothing();
  }

  const rows = await db.select().from(schema.lessonProgress)
    .where(eq(schema.lessonProgress.userId, user.id));
  return NextResponse.json({
    ok: true,
    passed: true,
    xp: rows.reduce((s, r) => s + r.xp, 0),
    completed: rows.map((r) => r.lessonId),
  });
}
