import "server-only";
import { db, schema } from "@/server/db";
import { eq, desc } from "drizzle-orm";
import { findLesson } from "@/lib/academy";

/*
  What you keep getting wrong — the signal the platform was already
  collecting and throwing away.

  Every quiz answer has been logged since the beginning, with how many
  tries it took: the schema comment calls it "the raw material for 'which
  checks are hard'". Nothing ever read it back. So a learner could miss
  position sizing in three separate lessons and the product would cheerfully
  march them on to options, never mentioning it.

  This reads that history and answers two questions a good tutor answers
  without being asked: which ideas haven't stuck, and what should I do
  about it. Struggle is measured per LESSON rather than per question,
  because "you're shaky on risk" is actionable and "you missed question 3"
  is trivia.
*/

export type WeakSpot = {
  lessonId: string;
  lessonTitle: string;
  trackTitle: string;
  /** Wrong-or-laboured answers on this lesson's checks. */
  misses: number;
  attempts: number;
  /** 0–1. Higher means shakier. */
  struggle: number;
};

/** How many tries counts as "knew it" — one. Anything more was a guess
    that got there, which is not the same as understanding. */
const CLEAN = 1;

export async function weakSpots(userId: string, limit = 3): Promise<WeakSpot[]> {
  const rows = await db.select({
    lessonId: schema.quizAttempts.lessonId,
    correct: schema.quizAttempts.correct,
    tries: schema.quizAttempts.tries,
    createdAt: schema.quizAttempts.createdAt,
  })
    .from(schema.quizAttempts)
    .where(eq(schema.quizAttempts.userId, userId))
    .orderBy(desc(schema.quizAttempts.createdAt))
    .limit(600);

  if (!rows.length) return [];

  const byLesson = new Map<string, { misses: number; attempts: number }>();
  for (const r of rows) {
    const agg = byLesson.get(r.lessonId) ?? { misses: 0, attempts: 0 };
    agg.attempts += 1;
    // A wrong answer counts; so does a right one that took several goes.
    if (r.correct === 0 || r.tries > CLEAN) agg.misses += 1;
    byLesson.set(r.lessonId, agg);
  }

  const out: WeakSpot[] = [];
  for (const [lessonId, agg] of byLesson) {
    if (agg.misses === 0) continue;
    const found = findLesson(lessonId);
    if (!found) continue;          // content moved on; don't cite a ghost
    out.push({
      lessonId,
      lessonTitle: found.lesson.title,
      trackTitle: found.track.title,
      misses: agg.misses,
      attempts: agg.attempts,
      struggle: agg.misses / Math.max(1, agg.attempts),
    });
  }

  // Shakiest first, then by volume — a 100% miss rate over one question is
  // less telling than 60% over five.
  out.sort((a, b) => b.struggle - a.struggle || b.attempts - a.attempts);
  return out.slice(0, limit);
}
