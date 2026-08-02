import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { currentUser } from "@/server/auth";
import { db, schema } from "@/server/db";
import { eq } from "drizzle-orm";
import { tracks } from "@/lib/academy";
import { PLACEMENT_QUESTIONS, placeFromAnswers } from "@/lib/academy/placement-quiz";

/*
  Grade the placement test and unlock the stages the learner tested out of.
  Grading is server-side and authoritative. Tested-out lessons are recorded with
  xp = 0 — they unlock the gate (they're "done") without inflating XP the learner
  didn't earn. Idempotent: lessons already complete are left untouched.
*/
/*
  The questions, without their answers.

  The web imports PLACEMENT_QUESTIONS straight from the library, so this
  never existed — which meant no other client could offer placement at
  all, and a returning trader on the phone had to start at "what is a
  market". Keys stay on the server, same as lesson quizzes: the client
  cannot mark its own exam.
*/
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    questions: PLACEMENT_QUESTIONS.map((q) => ({
      stage: q.stage, prompt: q.prompt, choices: q.choices,
    })),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const answers: number[] = Array.isArray(body?.answers)
    ? body.answers.slice(0, PLACEMENT_QUESTIONS.length).map((a: unknown) => Number(a))
    : [];

  const startStage = placeFromAnswers(answers); // stages 0..startStage-1 are tested out
  const placedTrack = tracks[Math.min(startStage, tracks.length - 1)];

  if (startStage <= 0) {
    return NextResponse.json({ ok: true, startStage: 0, startStageTitle: tracks[0].title, skipped: 0 });
  }

  const existing = await db.select({ lessonId: schema.lessonProgress.lessonId })
    .from(schema.lessonProgress).where(eq(schema.lessonProgress.userId, user.id));
  const done = new Set(existing.map((r) => r.lessonId));

  const now = Date.now();
  const toInsert = tracks.slice(0, startStage)
    .flatMap((t) => t.lessons)
    .filter((l) => !done.has(l.id))
    .map((l) => ({ id: randomUUID(), userId: user.id, lessonId: l.id, completedAt: now, xp: 0 }));

  if (toInsert.length) await db.insert(schema.lessonProgress).values(toInsert);

  return NextResponse.json({
    ok: true,
    startStage,
    startStageTitle: placedTrack.title,
    skipped: toInsert.length,
  });
}
