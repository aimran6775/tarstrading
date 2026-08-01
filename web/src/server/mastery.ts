import "server-only";
import { db, schema } from "@/server/db";
import { eq, asc } from "drizzle-orm";

/*
  Mastery — the difference between "finished" and "knows it".

  lesson_progress only ever recorded done/not-done, so a learner who aced
  every check looked identical to one who scraped through on third
  attempts. Nothing could say "your sizing is solid but your options grasp
  is thin", and review could not be ordered by weakness.

  The measure is FIRST-TRY correctness, because that is what recall looks
  like. Getting there on the third guess is a different skill — worth
  something, but not the same thing, and the schedule should treat it
  differently.

  Nothing new is stored. quiz_attempts has held this since the beginning;
  this only reads it. That matters: mastery is derived, so it stays honest
  when content changes, and there is no second ledger to drift.
*/

export type Mastery = {
  /** 0–1 first-try correctness across this lesson's checks. */
  score: number;
  /** How many distinct checks we have evidence for. */
  checks: number;
  band: "solid" | "shaky" | "unproven";
};

/** Above this, the idea stuck. Chosen so one slip in four still reads as
    solid — mastery should not demand perfection. */
const SOLID = 0.75;

export async function masteryByLesson(userId: string): Promise<Map<string, Mastery>> {
  const rows = await db.select({
    lessonId: schema.quizAttempts.lessonId,
    quizIndex: schema.quizAttempts.quizIndex,
    correct: schema.quizAttempts.correct,
    tries: schema.quizAttempts.tries,
    createdAt: schema.quizAttempts.createdAt,
  })
    .from(schema.quizAttempts)
    .where(eq(schema.quizAttempts.userId, userId))
    .orderBy(asc(schema.quizAttempts.createdAt));

  /*
    One verdict per (lesson, question): the FIRST time they met it. A
    retake that finally lands should not overwrite the fact that the idea
    did not stick the first time — otherwise every learner converges on
    perfect mastery by persistence alone.
  */
  const firstSeen = new Map<string, boolean>();
  for (const r of rows) {
    const key = `${r.lessonId}#${r.quizIndex}`;
    if (firstSeen.has(key)) continue;
    firstSeen.set(key, r.correct === 1 && r.tries === 1);
  }

  const agg = new Map<string, { right: number; total: number }>();
  for (const [key, clean] of firstSeen) {
    const lessonId = key.split("#")[0];
    const a = agg.get(lessonId) ?? { right: 0, total: 0 };
    a.total += 1;
    if (clean) a.right += 1;
    agg.set(lessonId, a);
  }

  const out = new Map<string, Mastery>();
  for (const [lessonId, a] of agg) {
    const score = a.total ? a.right / a.total : 0;
    out.set(lessonId, {
      score,
      checks: a.total,
      band: a.total === 0 ? "unproven" : score >= SOLID ? "solid" : "shaky",
    });
  }
  return out;
}
